"""
Predictions Views
Manages the drug recommendation pipeline: create → simulate async run → 
allow clinician to select final prescription.

Endpoints:
  GET  /api/predictions/queue/         — all predictions for the authenticated doctor
  POST /api/predictions/               — create a new prediction job
  GET  /api/predictions/<id>/          — detail view for a single prediction
  POST /api/predictions/<id>/retry/    — retry a failed prediction
  POST /api/predict/<id>/select/       — clinician selects a recommended drug
"""

import threading
import time
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.apps.patients.models import Patient
from drugbank_model.interactions import DATA_UNAVAILABLE, check_drug_safety
from .ml_engine import predict_drugs, KNOWN_DRUG_NAMES
from .models import Prediction
from .serializers import PredictionSerializer


def _find_drug_names_used_as_conditions(conditions: list) -> list:
    """Returns any entries in `conditions` that are actually drug names."""
    return [c for c in conditions if isinstance(c, str) and c.strip().lower() in KNOWN_DRUG_NAMES]

COMMON_SIDE_EFFECTS = {
    "lisinopril":     ["Dry cough", "Dizziness", "Hyperkalemia", "Renal impairment"],
    "amlodipine":     ["Peripheral oedema", "Flushing", "Headache"],
    "metformin":      ["Nausea", "Diarrhoea", "Lactic acidosis (rare)"],
    "atorvastatin":   ["Myalgia", "Elevated liver enzymes", "Headache"],
    "furosemide":     ["Electrolyte imbalance", "Dehydration", "Ototoxicity (high doses)"],
    "spironolactone": ["Hyperkalaemia", "Gynaecomastia", "Menstrual irregularity"],
    "metoprolol":     ["Bradycardia", "Fatigue", "Cold extremities"],
    "ibuprofen":      ["GI upset", "Peptic ulceration", "Renal impairment"],
    "amoxicillin":    ["Diarrhoea", "Rash", "Anaphylaxis (allergy)"],
    "warfarin":       ["Haemorrhage", "Bruising", "Hair loss"],
    "aspirin":        ["GI bleeding", "Tinnitus", "Bronchospasm"],
    "omeprazole":     ["Headache", "Nausea", "Hypomagnesaemia (long-term)"],
    "nitroglycerin":  ["Headache", "Hypotension", "Tachycardia (reflex)"],
    "doxycycline":            ["Photosensitivity", "GI upset", "Oesophageal irritation"],
    "ezetimibe":              ["Myalgia", "Diarrhoea", "Elevated liver enzymes"],
    "sumatriptan":            ["Tingling/flushing", "Chest tightness", "Dizziness"],
    "paracetamol":            ["Hepatotoxicity (overdose)", "Rare rash"],
    "aspirin":                ["GI bleeding", "Tinnitus", "Bronchospasm"],
    "dextromethorphan":       ["Drowsiness", "Dizziness", "Nausea"],
    "guaifenesin":            ["Nausea", "Headache", "Dizziness"],
    "pseudoephedrine":        ["Insomnia", "Palpitations", "Elevated blood pressure"],
    "oseltamivir":            ["Nausea", "Vomiting", "Headache"],
    "ondansetron":            ["Headache", "Constipation", "QT prolongation (high dose)"],
    "metoclopramide":         ["Drowsiness", "Extrapyramidal symptoms", "Restlessness"],
    "loperamide":             ["Constipation", "Dizziness", "Abdominal cramps"],
    "oral rehydration salts": ["Bloating", "Nausea (rare)"],
    "polyethylene glycol":    ["Bloating", "Abdominal cramps", "Diarrhoea"],
    "docusate":               ["Abdominal cramps", "Diarrhoea"],
    "senna":                  ["Abdominal cramps", "Diarrhoea", "Electrolyte imbalance (long-term)"],
    "cetirizine":             ["Drowsiness", "Dry mouth", "Fatigue"],
    "loratadine":             ["Headache", "Dry mouth", "Fatigue"],
    "prednisone":             ["Weight gain", "Mood changes", "Hyperglycaemia"],
    "hydrocortisone cream":   ["Skin thinning (prolonged use)", "Local irritation"],
    "sertraline":             ["Nausea", "Insomnia", "Sexual dysfunction"],
    "buspirone":              ["Dizziness", "Headache", "Nausea"],
    "diazepam":               ["Sedation", "Dependence (long-term)", "Respiratory depression (high dose)"],
    "fluoxetine":             ["Nausea", "Insomnia", "Sexual dysfunction"],
    "bupropion":              ["Insomnia", "Dry mouth", "Seizure risk (high dose)"],
    "zolpidem":               ["Drowsiness", "Dizziness", "Dependence (long-term)"],
    "melatonin":              ["Drowsiness", "Headache", "Dizziness"],
    "trazodone":              ["Sedation", "Dizziness", "Orthostatic hypotension"],
    "nitrofurantoin":         ["Nausea", "Pulmonary toxicity (long-term)", "Urine discolouration"],
    "trimethoprim":           ["Rash", "Hyperkalaemia", "GI upset"],
    "ciprofloxacin":          ["Tendon rupture (rare)", "GI upset", "QT prolongation"],
    "salbutamol":             ["Tremor", "Tachycardia", "Palpitations"],
    "budesonide":             ["Oral thrush", "Hoarseness", "Cough"],
    "montelukast":            ["Headache", "Mood changes", "GI upset"],
    "famotidine":             ["Headache", "Dizziness", "Constipation"],
    "calcium carbonate":      ["Constipation", "Bloating", "Hypercalcaemia (excess use)"],
}


def _get_side_effects(drug_name: str) -> list:
    return COMMON_SIDE_EFFECTS.get(drug_name.lower(), ["Monitor for adverse effects"])


def _get_interaction_status(drug_name: str, current_drugs: list) -> tuple:
    """Check `drug_name` against the patient's current medications.

    Returns (status, warning):
      - ("safe", "")               — checked (or nothing to check against),
                                      no interaction found.
      - ("warning", "Interacts with X, Y") — checked, found a match.
      - ("unavailable", "")        — the check couldn't actually run (e.g.
                                      the interaction CSV failed to load
                                      under memory pressure). This is NOT
                                      the same as "safe" and must never be
                                      displayed as such — it means we don't
                                      know, not that we verified it's fine.

    This is purely a safety-awareness check against the DrugBank interaction
    table — it never blocks a recommendation, only annotates it.
    """
    if not current_drugs:
        return "safe", ""

    is_safe, detailed, summary = check_drug_safety(drug_name, ", ".join(current_drugs))

    if summary == DATA_UNAVAILABLE:
        return "unavailable", ""

    if is_safe or not detailed:
        return "safe", ""

    interacting_names = ", ".join(d["interacting_drug"].title() for d in detailed)
    return "warning", f"Interacts with {interacting_names}"


# Number of recommendations shown to the clinician (1 primary + N-1
# alternatives). We ask the prediction engine for a larger pool than this
# so that, after ranking by interaction safety below, there's still room to
# promote a non-interacting candidate into the visible set.
_RECOMMENDATION_COUNT = 3
_CANDIDATE_POOL_SIZE = 6


def _rank_by_interaction_safety(candidates: list, current_drugs: list) -> list:
    """Annotate each candidate with its interaction status, then reorder so
    confirmed-interacting candidates sink to the bottom.

    A drug that interacts with something the patient is already taking is
    demoted below every non-interacting (or unchecked) candidate rather than
    dropped — the clinician should still see it (and why it was
    deprioritised) if nothing better is available. Candidates whose status
    is "unavailable" are NOT demoted — we simply don't know, which isn't
    grounds for penalising them the way a confirmed interaction is. Within
    each group, the original model ranking (by confidence) is preserved,
    since `sorted` is stable.
    """
    annotated = []
    for c in candidates:
        interaction_status, warning = _get_interaction_status(c["drug_name"], current_drugs)
        annotated.append({**c, "interaction_status": interaction_status, "interaction_warning": warning})
    return sorted(annotated, key=lambda c: c["interaction_status"] == "warning")


def _run_prediction_in_background(prediction_id: str):
    """
    Simulates an async ML prediction pipeline.
    In production replace this thread with a Celery task.
    """
    from .models import Prediction  # local import to avoid App-registry issues

    try:
        pred = Prediction.objects.get(pk=prediction_id)
        pred.status = "Running"
        pred.progress = 10
        pred.save(update_fields=["status", "progress"])

        time.sleep(1.5)  # Simulate model latency

        candidates = predict_drugs(pred.input_conditions, top_k=_CANDIDATE_POOL_SIZE)

        if not candidates:
            raise ValueError("No drugs returned by prediction engine.")

        current_drugs = pred.current_drugs_snapshot

        # Candidates that interact with something the patient already takes
        # are pushed below every non-interacting candidate, so the primary
        # recommendation is the highest-confidence drug that's actually safe
        # to add — not just the highest-confidence drug overall.
        ranked = _rank_by_interaction_safety(candidates, current_drugs)[:_RECOMMENDATION_COUNT]

        primary = ranked[0]
        alternatives = [
            {
                "drug_name": r["drug_name"],
                "confidence_score": r["confidence_score"],
                "explanation": r.get("explanation", ""),
                "interaction_status": r["interaction_status"],
                "interaction_warning": r["interaction_warning"],
            }
            for r in ranked[1:]
        ]
        side_effects = _get_side_effects(primary["drug_name"])

        pred.predicted_drug = primary["drug_name"]
        pred.confidence_score = primary["confidence_score"]
        pred.explanation = primary.get("explanation", "")
        pred.alternative_drugs = alternatives
        pred.side_effects = side_effects
        pred.interaction_status = primary["interaction_status"]
        pred.interaction_warning = primary["interaction_warning"]
        pred.status = "Completed"
        pred.progress = 100
        pred.save()

    except Exception as exc:
        try:
            pred = Prediction.objects.get(pk=prediction_id)
            pred.status = "Failed"
            pred.error_message = str(exc)
            pred.progress = 0
            pred.save(update_fields=["status", "error_message", "progress"])
        except Exception:
            pass


class PredictionQueueView(APIView):
    """GET /api/predictions/queue/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        predictions = Prediction.objects.filter(doctor=request.user).order_by("-created_at")
        return Response(PredictionSerializer(predictions, many=True).data)


class PredictionCreateView(APIView):
    """POST /api/predictions/"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        symptoms = data.get("symptoms", "").strip()
        if not symptoms:
            return Response(
                {"detail": "symptoms field is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        patient = None
        patient_name = "General Inquiry"
        # Snapshot of current medications used for the interaction-safety
        # check. Stored on the Prediction itself (not just read off
        # `patient.current_drugs`) so the check still works for a "New
        # Patient" request that isn't saved to the patient directory.
        current_drugs_snapshot = []

        prediction_mode = data.get("predictionMode", "general")

        if prediction_mode == "existing":
            patient_id = data.get("patient_id")
            if not patient_id:
                return Response(
                    {"detail": "patient_id is required for existing patient mode."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                patient = Patient.objects.get(pk=patient_id)
                patient_name = patient.full_name
                current_drugs_snapshot = patient.current_drugs
                # Deliberately NOT merging patient.conditions (stored chronic
                # history) into the model query below: it would make an
                # acute complaint (e.g. "nausea") compete in the same query
                # text as an unrelated long-standing condition (e.g.
                # "Hypertension"), biasing predictions toward treating the
                # old condition instead of what the patient presents with now.
            except Patient.DoesNotExist:
                return Response(
                    {"detail": f"Patient '{patient_id}' not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        elif prediction_mode == "new":
            full_name = data.get("full_name", "").strip()
            age = data.get("age")
            gender = data.get("gender", "").strip()
            # Current medications, not chronic conditions: this is what the
            # interaction-safety check (see `_get_interaction_warning`) reads
            # against the recommended drug, so it's what's worth capturing
            # here. Chronic-condition history can be added later from the
            # full patient record — it's deliberately never mixed into the
            # prediction query (see the "existing" branch above).
            current_drugs_snapshot = data.get("current_drugs", [])

            if data.get("save_patient") and full_name:
                #import uuid
                patient = Patient.objects.create(
                    #patient_id=f"PAT-{str(uuid.uuid4())[:8].upper()}",
                    full_name=full_name,
                    age=age or 0,
                    gender=gender or "Unknown",
                    conditions=[],
                    current_drugs=current_drugs_snapshot,
                )
                patient_name = patient.full_name
            else:
                patient_name = full_name or "New Patient"

        elif prediction_mode == "general":
            conditions = data.get("conditions", [])

            bad_conditions = _find_drug_names_used_as_conditions(conditions)
            if bad_conditions:
                return Response(
                    {
                        "detail": (
                            f"'{', '.join(bad_conditions)}' looks like a medication name, not a "
                            "medical condition. Please enter the diagnosed condition (e.g. "
                            "'Hypertension') in this field instead."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            patient_name = "General Inquiry"

        # The prediction query is the acute complaint alone — never chronic
        # conditions/history. Mixing e.g. "nausea" with a baseline condition
        # like "Hypertension" biases the model toward treating the old
        # condition instead of what the patient presents with now, and can
        # surface a clinically nonsensical pick (an obscure antihypertensive
        # as a "nausea" recommendation). Conditions stay on the patient
        # record (see `save_patient` above) for later drug-interaction/
        # safety checks, not for driving this recommendation.
        input_text = symptoms

        prediction = Prediction.objects.create(
            patient=patient,
            patient_name=patient_name,
            doctor=request.user,
            doctor_name=request.user.get_full_name() or request.user.username,
            input_conditions=input_text,
            current_drugs_snapshot=current_drugs_snapshot,
            status="Pending",
            progress=0,
        )

        # Kick off background thread (replace with Celery in production)
        thread = threading.Thread(
            target=_run_prediction_in_background,
            args=(str(prediction.id),),
            daemon=True,
        )
        thread.start()

        return Response(PredictionSerializer(prediction).data, status=status.HTTP_201_CREATED)


class PredictionDetailView(APIView):
    """GET /api/predictions/<id>/"""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            prediction = Prediction.objects.get(pk=pk)
        except Prediction.DoesNotExist:
            return Response(
                {"detail": "Prediction not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(PredictionSerializer(prediction).data)


class PredictionRetryView(APIView):
    """POST /api/predictions/<id>/retry/"""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            prediction = Prediction.objects.get(pk=pk, doctor=request.user)
        except Prediction.DoesNotExist:
            return Response(
                {"detail": "Prediction not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if prediction.status not in ("Failed", "Pending"):
            return Response(
                {"detail": f"Cannot retry a prediction with status '{prediction.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prediction.status = "Pending"
        prediction.progress = 0
        prediction.error_message = None
        prediction.save(update_fields=["status", "progress", "error_message"])

        thread = threading.Thread(
            target=_run_prediction_in_background,
            args=(str(prediction.id),),
            daemon=True,
        )
        thread.start()

        return Response(
            {
                "success": True,
                "message": "Prediction queued for retry.",
                "prediction": PredictionSerializer(prediction).data,
            }
        )


class DrugSelectView(APIView):
    """POST /api/predict/<id>/select/ — clinician selects their chosen drug."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            prediction = Prediction.objects.get(pk=pk)
        except Prediction.DoesNotExist:
            return Response(
                {"detail": "Prediction not found."}, status=status.HTTP_404_NOT_FOUND
            )

        drug_name = request.data.get("drug_name", "").strip()
        if not drug_name:
            return Response(
                {"detail": "drug_name is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        prediction.selected_drug = drug_name
        prediction.selected_confidence = request.data.get("confidence_score")
        prediction.selected_explanation = request.data.get("explanation", "")
        prediction.selected_at = timezone.now()
        prediction.save(
            update_fields=[
                "selected_drug", "selected_confidence",
                "selected_explanation", "selected_at",
            ]
        )

        return Response(
            {
                "success": True,
                "message": f"Drug '{drug_name}' selected and recorded.",
                "selected_drug": prediction.selected_drug,
                "selected_at": prediction.selected_at.isoformat(),
            }
        )
