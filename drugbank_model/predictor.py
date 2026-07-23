"""
predictor.py
════════════════════════════════════════════════════════════════════════════
Inference-only entry points for the drug recommendation model.

This module never loads the model itself — it always obtains it through
`loader.get_model()`, which caches a single instance per process.

This is the primary module Django should import:

    from drugbank_model.predictor import predict_multiple_drugs

    drugs = predict_multiple_drugs(condition, age, gender, medications)
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from drugbank_model import loader

logger = logging.getLogger(__name__)

_NO_MODEL_MESSAGE = "Drug prediction model not available"
_NO_RECOMMENDATION_MESSAGE = "No recommendation available"


def predict_drugs_for_condition(condition: str, top_k: int = 3) -> List[Dict]:
    """Return structured drug recommendations for a condition.

    Args:
        condition: Free-text medical condition/indication.
        top_k: Number of recommendations requested.

    Returns:
        A list of recommendation dicts (see
        `model_classes.StreamlinedDrugSystem.predict_drugs_for_condition`),
        or an empty list if the model is unavailable or prediction fails.
    """
    model = loader.get_model()

    if model is None:
        logger.error("Drug prediction model not available")
        return []

    if not hasattr(model, "predict_drugs_for_condition"):
        logger.error("Loaded model has no predict_drugs_for_condition method")
        return []

    try:
        return model.predict_drugs_for_condition(condition, top_k=top_k)
    except Exception:
        logger.exception("Prediction failed for condition=%r", condition)
        return []


def predict_multiple_drugs(
    condition: str,
    patient_age: Optional[int] = None,
    patient_gender: Optional[str] = None,
    patient_medications: Optional[str] = None,
    top_k: int = 3,
) -> List[str]:
    """Return a simple list of recommended drug names for a condition.

    This is the primary function Django views should call. It wraps
    `predict_drugs_for_condition` and extracts just the drug names, matching
    the original notebook's `predict_multiple_drugs_for_condition` behavior.

    Args:
        condition: Free-text medical condition/indication.
        patient_age: Patient age (currently informational; the underlying
            model is condition-only, kept for API/signature stability and
            future model versions that may use it).
        patient_gender: Patient gender (see note above).
        patient_medications: Patient's current medications (see note above).
        top_k: Number of drug names to return.

    Returns:
        A list of drug name strings. On failure, returns a single-item list
        with a human-readable error message (matching legacy behavior so
        existing UI code doesn't need to special-case an empty list).
    """
    recommendations = predict_drugs_for_condition(condition, top_k=top_k)

    if not recommendations:
        model = loader.get_model()
        if model is None:
            return [_NO_MODEL_MESSAGE]
        return [_NO_RECOMMENDATION_MESSAGE]

    drug_names = []
    for rec in recommendations[:top_k]:
        if isinstance(rec, dict):
            drug_names.append(rec.get("drug_name", str(rec)))
        else:
            drug_names.append(str(rec))

    return drug_names
