"""
ADR Rule Engine
Lightweight, deterministic rule table for flagging known high-risk
drug-drug and drug-condition combinations. This mirrors the same
"fallback rule table" pattern used by predictions/ml_engine.py — if a
trained interaction model is added later, swap the implementation of
`analyze_interactions` without touching the view layer.
"""

# ── Known high-risk drug-drug interaction pairs (order-independent) ───────────
DRUG_DRUG_INTERACTIONS = {
    frozenset({"warfarin", "aspirin"}): {
        "risk": "High",
        "explanation": "Concurrent anticoagulant (Warfarin) and antiplatelet (Aspirin) therapy "
                       "significantly increases the risk of major bleeding events.",
        "recommendation": "Avoid combination where possible; if required, use the lowest effective "
                           "aspirin dose with close INR monitoring.",
        "alternative": "Clopidogrel",
    },
    frozenset({"warfarin", "ibuprofen"}): {
        "risk": "High",
        "explanation": "NSAIDs like Ibuprofen displace Warfarin from plasma proteins and impair "
                       "platelet function, compounding bleeding risk.",
        "recommendation": "Substitute with Acetaminophen for pain relief where clinically appropriate.",
        "alternative": "Acetaminophen",
    },
    frozenset({"lisinopril", "spironolactone"}): {
        "risk": "Moderate",
        "explanation": "Combined ACE inhibitor and potassium-sparing diuretic use raises the risk "
                       "of hyperkalaemia, particularly in renal impairment.",
        "recommendation": "Monitor serum potassium and renal function within 1-2 weeks of initiation.",
        "alternative": "Furosemide",
    },
    frozenset({"lisinopril", "ibuprofen"}): {
        "risk": "Moderate",
        "explanation": "NSAIDs can blunt the antihypertensive effect of ACE inhibitors and impair "
                       "renal perfusion ('triple whammy' risk if combined with diuretics).",
        "recommendation": "Use the lowest effective NSAID dose for the shortest duration; monitor "
                           "blood pressure and renal function.",
        "alternative": "Acetaminophen",
    },
    frozenset({"metformin", "furosemide"}): {
        "risk": "Moderate",
        "explanation": "Loop diuretics can worsen renal function, increasing the risk of Metformin "
                       "accumulation and lactic acidosis.",
        "recommendation": "Monitor renal function periodically while on this combination.",
        "alternative": "",
    },
    frozenset({"aspirin", "ibuprofen"}): {
        "risk": "Moderate",
        "explanation": "Ibuprofen can interfere with aspirin's antiplatelet (cardioprotective) effect "
                       "and increases GI bleeding risk when combined.",
        "recommendation": "Separate dosing times or use an alternative analgesic if aspirin is for "
                           "cardiovascular protection.",
        "alternative": "Acetaminophen",
    },
    frozenset({"metoprolol", "amlodipine"}): {
        "risk": "Low",
        "explanation": "Combined beta-blocker and calcium channel blocker use is common and generally "
                       "well tolerated, though additive hypotension/bradycardia can occur.",
        "recommendation": "Monitor heart rate and blood pressure, especially after dose changes.",
        "alternative": "",
    },
}

# ── Drug-condition contraindications ───────────────────────────────────────────
DRUG_CONDITION_WARNINGS = {
    "ibuprofen": {
        "conditions": {"asthma", "kidney disease", "renal impairment", "peptic ulcer", "gi bleeding"},
        "risk": "High",
        "explanation": "NSAIDs like Ibuprofen can trigger bronchospasm in asthmatics, worsen renal "
                       "function, and provoke GI bleeding in patients with ulcer disease.",
        "recommendation": "Avoid NSAIDs; use Acetaminophen for analgesia instead.",
        "alternative": "Acetaminophen",
    },
    "aspirin": {
        "conditions": {"asthma", "peptic ulcer", "gi bleeding", "hemophilia"},
        "risk": "High",
        "explanation": "Aspirin can precipitate bronchospasm ('aspirin-exacerbated respiratory "
                       "disease') and increases bleeding risk in ulcer disease or bleeding disorders.",
        "recommendation": "Avoid aspirin; consider Acetaminophen or Clopidogrel depending on indication.",
        "alternative": "Acetaminophen",
    },
    "metformin": {
        "conditions": {"kidney disease", "renal impairment", "renal failure"},
        "risk": "High",
        "explanation": "Metformin is renally cleared; impaired kidney function raises the risk of "
                       "lactic acidosis.",
        "recommendation": "Dose-adjust or avoid based on eGFR; monitor renal function regularly.",
        "alternative": "",
    },
    "furosemide": {
        "conditions": {"gout", "hyperuricemia"},
        "risk": "Moderate",
        "explanation": "Loop diuretics can raise serum uric acid and precipitate gout flares.",
        "recommendation": "Monitor uric acid levels; consider prophylaxis if recurrent flares occur.",
        "alternative": "",
    },
    "spironolactone": {
        "conditions": {"kidney disease", "renal impairment", "hyperkalemia"},
        "risk": "High",
        "explanation": "Spironolactone is a potassium-sparing diuretic and can cause dangerous "
                       "hyperkalaemia in patients with reduced renal clearance.",
        "recommendation": "Avoid or use with very close potassium monitoring.",
        "alternative": "Furosemide",
    },
    "metoprolol": {
        "conditions": {"asthma", "copd", "bradycardia"},
        "risk": "Moderate",
        "explanation": "Beta-blockers, even cardioselective ones, can provoke bronchospasm in "
                       "reactive airway disease and worsen bradyarrhythmias.",
        "recommendation": "Use a cardioselective agent cautiously and monitor respiratory status.",
        "alternative": "Amlodipine",
    },
}

RISK_ORDER = {"Low": 0, "Moderate": 1, "High": 2}


def analyze_interactions(checked_drugs: list, conditions: list | None = None) -> dict:
    """
    Evaluates a list of drug names (and optional patient conditions) against
    the known interaction/contraindication rule tables and returns the
    highest-severity finding.
    """
    conditions = conditions or []
    normalized_drugs = [d.strip().lower() for d in checked_drugs if d and d.strip()]
    normalized_conditions = {c.strip().lower() for c in conditions if c and c.strip()}

    findings = []

    # Drug-drug pairs
    for i in range(len(normalized_drugs)):
        for j in range(i + 1, len(normalized_drugs)):
            pair = frozenset({normalized_drugs[i], normalized_drugs[j]})
            rule = DRUG_DRUG_INTERACTIONS.get(pair)
            if rule:
                findings.append(rule)

    # Drug-condition contraindications
    for drug in normalized_drugs:
        rule = DRUG_CONDITION_WARNINGS.get(drug)
        if rule and rule["conditions"] & normalized_conditions:
            findings.append(rule)

    if not findings:
        return {
            "risk_level": "Low",
            "explanation": (
                "No known high-risk drug-drug or drug-condition interactions were found in the "
                "local reference table for this medication regimen. This does not replace full "
                "clinical pharmacist review."
            ),
            "recommendation": "Continue routine monitoring per standard clinical protocol.",
            "alternative_drug": "",
        }

    # Pick the highest-severity finding
    findings.sort(key=lambda f: RISK_ORDER[f["risk"]], reverse=True)
    top = findings[0]

    explanations = " ".join(dict.fromkeys(f["explanation"] for f in findings))
    recommendations = " ".join(dict.fromkeys(f["recommendation"] for f in findings if f["recommendation"]))

    return {
        "risk_level": top["risk"],
        "explanation": explanations,
        "recommendation": recommendations or "Monitor patient closely and consult a pharmacist.",
        "alternative_drug": top.get("alternative", ""),
    }
