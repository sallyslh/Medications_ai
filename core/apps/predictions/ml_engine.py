"""
ML Engine
Delegates drug prediction to the `drugbank_model` package, which loads and
caches the trained model (TF-IDF + SVD ensemble) on first use.

If the model is unavailable or prediction fails, the engine falls back to a
keyword-based rule table covering the most common clinical conditions.
"""

import logging
import re

from drugbank_model.predictor import predict_drugs_for_condition

logger = logging.getLogger(__name__)


# ─── Fallback Rule Table ──────────────────────────────────────────────────────
# Used when the .pkl model is unavailable.
FALLBACK_RULES = {
    "hypertension": [
        {"drug_name": "Lisinopril",   "confidence_score": 0.88, "explanation": "ACE inhibitor — first-line for hypertension."},
        {"drug_name": "Amlodipine",   "confidence_score": 0.82, "explanation": "CCB — effective monotherapy for hypertension."},
        {"drug_name": "Metoprolol",   "confidence_score": 0.75, "explanation": "Beta-blocker — adjunct for hypertension with tachycardia."},
    ],
    "diabetes": [
        {"drug_name": "Metformin",    "confidence_score": 0.92, "explanation": "First-line biguanide for type-2 diabetes."},
        {"drug_name": "Atorvastatin", "confidence_score": 0.74, "explanation": "Statin — cardiovascular risk reduction in diabetics."},
        {"drug_name": "Lisinopril",   "confidence_score": 0.70, "explanation": "ACE inhibitor — renoprotective in diabetic nephropathy."},
    ],
    "infection": [
        {"drug_name": "Amoxicillin",  "confidence_score": 0.88, "explanation": "Broad-spectrum penicillin — first-line for community infections."},
        {"drug_name": "Doxycycline",  "confidence_score": 0.62, "explanation": "Alternative for penicillin-allergic patients or atypical organisms."},
        {"drug_name": "Metronidazole","confidence_score": 0.65, "explanation": "Indicated for anaerobic and protozoal infections."},
    ],
    "dyslipidaemia": [
        {"drug_name": "Atorvastatin", "confidence_score": 0.93, "explanation": "High-intensity statin — first-line for LDL reduction."},
        {"drug_name": "Ezetimibe",    "confidence_score": 0.58, "explanation": "Cholesterol absorption inhibitor — add-on when statin alone is insufficient."},
        {"drug_name": "Omeprazole",   "confidence_score": 0.35, "explanation": "Gastroprotection only."},
    ],
    "heart failure": [
        {"drug_name": "Furosemide",     "confidence_score": 0.89, "explanation": "Loop diuretic — symptom relief in heart failure."},
        {"drug_name": "Spironolactone", "confidence_score": 0.80, "explanation": "Aldosterone antagonist — mortality benefit in HFrEF."},
        {"drug_name": "Metoprolol",     "confidence_score": 0.78, "explanation": "Beta-blocker — proven mortality benefit in HFrEF."},
    ],
    "angina": [
        {"drug_name": "Nitroglycerin", "confidence_score": 0.91, "explanation": "Short-acting nitrate — acute angina relief."},
        {"drug_name": "Metoprolol",    "confidence_score": 0.82, "explanation": "Beta-blocker — reduces anginal frequency."},
        {"drug_name": "Amlodipine",    "confidence_score": 0.77, "explanation": "CCB — reduces coronary vasospasm."},
    ],
    "migraine": [
        {"drug_name": "Sumatriptan",  "confidence_score": 0.85, "explanation": "Triptan — first-line abortive therapy for acute migraine."},
        {"drug_name": "Ibuprofen",    "confidence_score": 0.74, "explanation": "NSAID — effective for mild-to-moderate migraine pain."},
        {"drug_name": "Paracetamol",  "confidence_score": 0.65, "explanation": "Analgesic alternative when NSAIDs/triptans are contraindicated."},
    ],
    "headache": [
        {"drug_name": "Paracetamol",  "confidence_score": 0.80, "explanation": "First-line analgesic for tension-type headache."},
        {"drug_name": "Ibuprofen",    "confidence_score": 0.76, "explanation": "NSAID — effective for headache with inflammatory component."},
        {"drug_name": "Sumatriptan",  "confidence_score": 0.55, "explanation": "Consider if migrainous features are present."},
    ],
    "fever": [
        {"drug_name": "Paracetamol",  "confidence_score": 0.90, "explanation": "Antipyretic — first-line for fever/pyrexia."},
        {"drug_name": "Ibuprofen",    "confidence_score": 0.78, "explanation": "NSAID — antipyretic and analgesic alternative."},
        {"drug_name": "Aspirin",      "confidence_score": 0.50, "explanation": "Antipyretic — avoid in children (Reye's syndrome risk)."},
    ],
    "cough": [
        {"drug_name": "Dextromethorphan", "confidence_score": 0.80, "explanation": "Antitussive — suppresses dry, non-productive cough."},
        {"drug_name": "Guaifenesin",      "confidence_score": 0.72, "explanation": "Expectorant — loosens chest congestion in productive cough."},
        {"drug_name": "Amoxicillin",      "confidence_score": 0.50, "explanation": "Consider if secondary bacterial chest infection suspected."},
    ],
    "cold": [
        {"drug_name": "Paracetamol",     "confidence_score": 0.82, "explanation": "Symptomatic relief of fever and aches in viral upper respiratory infection."},
        {"drug_name": "Pseudoephedrine", "confidence_score": 0.70, "explanation": "Decongestant — relieves nasal congestion."},
        {"drug_name": "Guaifenesin",     "confidence_score": 0.58, "explanation": "Expectorant for associated chest congestion."},
    ],
    "flu": [
        {"drug_name": "Oseltamivir",  "confidence_score": 0.72, "explanation": "Antiviral — most effective if started within 48h of symptom onset."},
        {"drug_name": "Paracetamol",  "confidence_score": 0.82, "explanation": "Symptomatic relief of fever, myalgia and malaise."},
        {"drug_name": "Ibuprofen",    "confidence_score": 0.68, "explanation": "NSAID — additional relief for aches and fever."},
    ],
    "sore throat": [
        {"drug_name": "Paracetamol",  "confidence_score": 0.78, "explanation": "Analgesic — relieves throat pain and fever."},
        {"drug_name": "Ibuprofen",    "confidence_score": 0.70, "explanation": "NSAID — reduces throat inflammation and pain."},
        {"drug_name": "Amoxicillin",  "confidence_score": 0.55, "explanation": "Consider if streptococcal pharyngitis suspected."},
    ],
    "nausea": [
        {"drug_name": "Ondansetron",    "confidence_score": 0.87, "explanation": "5-HT3 antagonist — first-line antiemetic."},
        {"drug_name": "Metoclopramide", "confidence_score": 0.74, "explanation": "Prokinetic antiemetic — also aids gastric emptying."},
        {"drug_name": "Omeprazole",     "confidence_score": 0.45, "explanation": "Consider if nausea is reflux-related."},
    ],
    "vomiting": [
        {"drug_name": "Ondansetron",    "confidence_score": 0.87, "explanation": "5-HT3 antagonist — first-line antiemetic."},
        {"drug_name": "Metoclopramide", "confidence_score": 0.74, "explanation": "Prokinetic antiemetic — also aids gastric emptying."},
        {"drug_name": "Omeprazole",     "confidence_score": 0.40, "explanation": "Consider if vomiting is reflux-related."},
    ],
    "diarrh": [  # matches both "diarrhea" and "diarrhoea"
        {"drug_name": "Loperamide",              "confidence_score": 0.85, "explanation": "Antimotility agent — symptomatic control of acute diarrhoea."},
        {"drug_name": "Oral Rehydration Salts",  "confidence_score": 0.80, "explanation": "Prevents dehydration — first-line supportive care."},
        {"drug_name": "Metronidazole",           "confidence_score": 0.50, "explanation": "Consider if an infective/parasitic cause is suspected."},
    ],
    "constipation": [
        {"drug_name": "Polyethylene Glycol", "confidence_score": 0.80, "explanation": "Osmotic laxative — first-line for constipation."},
        {"drug_name": "Docusate",            "confidence_score": 0.70, "explanation": "Stool softener — for mild constipation."},
        {"drug_name": "Senna",               "confidence_score": 0.65, "explanation": "Stimulant laxative — effective for short-term use."},
    ],
    "allerg": [  # matches "allergy" and "allergic"
        {"drug_name": "Cetirizine",  "confidence_score": 0.86, "explanation": "Second-generation antihistamine — first-line for allergic symptoms."},
        {"drug_name": "Loratadine",  "confidence_score": 0.75, "explanation": "Non-sedating antihistamine alternative."},
        {"drug_name": "Prednisone",  "confidence_score": 0.50, "explanation": "Short-course corticosteroid for severe allergic reactions."},
    ],
    "rash": [
        {"drug_name": "Cetirizine",           "confidence_score": 0.78, "explanation": "Antihistamine — relieves allergic/urticarial rash."},
        {"drug_name": "Hydrocortisone Cream", "confidence_score": 0.74, "explanation": "Topical corticosteroid — reduces inflammation and itching."},
        {"drug_name": "Loratadine",           "confidence_score": 0.55, "explanation": "Alternative non-sedating antihistamine."},
    ],
    "anxi": [  # matches "anxiety" and "anxious"
        {"drug_name": "Sertraline", "confidence_score": 0.80, "explanation": "SSRI — first-line for generalized anxiety disorder."},
        {"drug_name": "Buspirone",  "confidence_score": 0.65, "explanation": "Non-benzodiazepine anxiolytic — lower dependence risk."},
        {"drug_name": "Diazepam",   "confidence_score": 0.45, "explanation": "Short-term relief for acute anxiety — caution: dependence risk."},
    ],
    "depress": [  # matches "depression" and "depressed"
        {"drug_name": "Sertraline",  "confidence_score": 0.88, "explanation": "SSRI — first-line for major depressive disorder."},
        {"drug_name": "Fluoxetine",  "confidence_score": 0.75, "explanation": "SSRI alternative — long half-life."},
        {"drug_name": "Bupropion",   "confidence_score": 0.60, "explanation": "Atypical antidepressant — alternative when sexual side effects are a concern."},
    ],
    "insomnia": [
        {"drug_name": "Melatonin",  "confidence_score": 0.70, "explanation": "Circadian regulator — favourable safety profile, first-line trial."},
        {"drug_name": "Zolpidem",   "confidence_score": 0.68, "explanation": "Sedative-hypnotic — short-term treatment of insomnia."},
        {"drug_name": "Trazodone",  "confidence_score": 0.58, "explanation": "Sedating antidepressant used off-label for sleep."},
    ],
    "urinary tract infection": [
        {"drug_name": "Nitrofurantoin", "confidence_score": 0.88, "explanation": "First-line for uncomplicated UTI."},
        {"drug_name": "Trimethoprim",   "confidence_score": 0.75, "explanation": "Alternative first-line agent for UTI."},
        {"drug_name": "Ciprofloxacin",  "confidence_score": 0.50, "explanation": "Reserve for complicated or resistant UTI."},
    ],
    "uti": [
        {"drug_name": "Nitrofurantoin", "confidence_score": 0.88, "explanation": "First-line for uncomplicated UTI."},
        {"drug_name": "Trimethoprim",   "confidence_score": 0.75, "explanation": "Alternative first-line agent for UTI."},
        {"drug_name": "Ciprofloxacin",  "confidence_score": 0.50, "explanation": "Reserve for complicated or resistant UTI."},
    ],
    "asthma": [
        {"drug_name": "Salbutamol",   "confidence_score": 0.90, "explanation": "Short-acting beta agonist — first-line reliever for acute asthma."},
        {"drug_name": "Budesonide",   "confidence_score": 0.75, "explanation": "Inhaled corticosteroid — controller therapy."},
        {"drug_name": "Montelukast",  "confidence_score": 0.55, "explanation": "Leukotriene antagonist — add-on control therapy."},
    ],
    "heartburn": [
        {"drug_name": "Omeprazole",        "confidence_score": 0.88, "explanation": "PPI — first-line for GERD/heartburn."},
        {"drug_name": "Famotidine",        "confidence_score": 0.72, "explanation": "H2 blocker — alternative acid suppression."},
        {"drug_name": "Calcium Carbonate", "confidence_score": 0.55, "explanation": "Antacid — rapid symptomatic relief."},
    ],
    "reflux": [
        {"drug_name": "Omeprazole",        "confidence_score": 0.88, "explanation": "PPI — first-line for GERD/reflux."},
        {"drug_name": "Famotidine",        "confidence_score": 0.72, "explanation": "H2 blocker — alternative acid suppression."},
        {"drug_name": "Calcium Carbonate", "confidence_score": 0.55, "explanation": "Antacid — rapid symptomatic relief."},
    ],
    # Generic catch-all — kept last so more specific symptom keywords above
    # (headache, migraine, sore throat, etc.) take priority over the bare
    # word "pain" when both appear in the same free-text description.
    "pain": [
        {"drug_name": "Ibuprofen",    "confidence_score": 0.85, "explanation": "NSAID — first-line for mild-to-moderate inflammatory pain."},
        {"drug_name": "Paracetamol",  "confidence_score": 0.70, "explanation": "Analgesic alternative when NSAIDs are contraindicated."},
        {"drug_name": "Omeprazole",   "confidence_score": 0.45, "explanation": "PPI gastroprotection when NSAIDs are prescribed."},
    ],
}

DEFAULT_FALLBACK = [
    {"drug_name": "Consult Pharmacist", "confidence_score": 0.50,
     "explanation": "Condition not in local reference. Manual pharmacist review recommended."},
]

# ── Known drug names ───────────────────────────────────────────────────────────
# Used by the predictions view to catch the common data-entry mistake of typing
# a drug name into a "medical condition" field. Derived from every drug that
# appears anywhere in the fallback rule table above.
KNOWN_DRUG_NAMES = {
    drug["drug_name"].lower()
    for drugs in FALLBACK_RULES.values()
    for drug in drugs
    if drug["drug_name"] != "Consult Pharmacist"
}


# Below this raw cosine-similarity confidence, the model hasn't actually
# found an indication-text match — it's returning whatever scored least-bad
# out of nothing relevant (e.g. an obscure/discontinued drug at ~1-5%
# confidence). Observed "real" matches cluster around 70-90%; observed
# "no real match" cases cluster near 0%, with a wide, unambiguous gap
# between the two — so this doesn't need to be finely tuned.
_MIN_CONFIDENCE = 0.20


def predict_drugs(condition_text: str, top_k: int = 3) -> list[dict]:
    """
    Predict the most suitable drugs for a given clinical condition text.

    Returns a list of up to top_k dicts:
        [{ "drug_name": str, "confidence_score": float, "explanation": str }, ...]
    """
    try:
        results = predict_drugs_for_condition(condition_text, top_k=top_k)
        reliable = [r for r in results if r.get("confidence_score", 0) >= _MIN_CONFIDENCE]
        if reliable:
            return reliable[:top_k]
        if results:
            # The model returned candidates, but none cleared the confidence
            # floor — treat this the same as "no result" and fall through to
            # the keyword rules below, rather than presenting a near-zero-
            # confidence guess as if it were a normal recommendation.
            logger.warning(
                "[ML Engine] Best match for %r scored %.1f%% — below the %.0f%% "
                "confidence floor, falling back to keyword rules.",
                condition_text, results[0].get("confidence_score", 0) * 100, _MIN_CONFIDENCE * 100,
            )
    except Exception as exc:
        logger.error("[ML Engine] Prediction error: %s", exc)

    # ── Keyword fallback ──────────────────────────────────────────────────────
    # Matched with a leading word boundary (rather than plain substring `in`)
    # so short keywords like "flu" don't false-positive inside unrelated
    # words such as "reflux" or "influenza". No trailing boundary is
    # required, since some keys (e.g. "diarrh", "allerg", "depress") are
    # deliberately word stems meant to catch multiple inflected forms.
    text_lower = condition_text.lower()
    for keyword, drugs in FALLBACK_RULES.items():
        if re.search(r"\b" + re.escape(keyword), text_lower):
            return drugs[:top_k]

    return DEFAULT_FALLBACK
