"""
drugbank_model
════════════════════════════════════════════════════════════════════════════
Reusable inference package for the drug recommendation system.

Importing this package performs NO I/O, loads NO model/CSV/transformer, and
prints nothing. Django must explicitly call `initialize_models()` once
(e.g. from an AppConfig.ready() hook) to warm the caches, or simply call the
public functions below — they lazy-load on first use regardless.

Public API:

    from drugbank_model import load_model, predict_drugs, check_interactions, load_patients

    model = load_model()
    drugs = predict_drugs("hypertension", patient_age=54, patient_gender="F",
                           patient_medications="lisinopril")
    is_safe, details, summary = check_interactions("Metformin", "lisinopril")
    patients_df = load_patients()

For finer-grained access (structured recommendation dicts, patient search,
ADR prediction, etc.) import the relevant submodule directly, e.g.:

    from drugbank_model.predictor import predict_drugs_for_condition
    from drugbank_model.patient_loader import search_patients, select_patient
    from drugbank_model.adverse import predict_adverse_reactions
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

import pandas as pd

from drugbank_model import adverse, interactions, loader, patient_loader, predictor

logger = logging.getLogger(__name__)

__all__ = [
    "load_model",
    "predict_drugs",
    "check_interactions",
    "load_patients",
    "initialize_models",
]


def load_model():
    """Return the cached drug prediction model, loading it on first call."""
    return loader.get_model()


def predict_drugs(
    condition: str,
    patient_age: Optional[int] = None,
    patient_gender: Optional[str] = None,
    patient_medications: Optional[str] = None,
    top_k: int = 3,
) -> List[str]:
    """Return recommended drug names for a medical condition.

    See `drugbank_model.predictor.predict_multiple_drugs` for details.
    """
    return predictor.predict_multiple_drugs(
        condition, patient_age, patient_gender, patient_medications, top_k=top_k
    )


def check_interactions(
    drug_name: str, current_medications: Optional[str]
) -> Tuple[bool, List[Dict], str]:
    """Check a drug against a patient's current medications for interactions.

    See `drugbank_model.interactions.check_drug_safety` for details.
    """
    return interactions.check_drug_safety(drug_name, current_medications)


def load_patients(force_reload: bool = False) -> pd.DataFrame:
    """Return the cached patient DataFrame, loading it on first call.

    See `drugbank_model.patient_loader.load_patient_data` for details.
    """
    return patient_loader.load_patient_data(force_reload=force_reload)


def initialize_models() -> Dict[str, bool]:
    """Eagerly warm every cache: drug model, patient CSV, interaction CSV,
    and (optionally) the ADR model.

    This function is NEVER called automatically on import. Call it once at
    application startup (e.g. Django `AppConfig.ready()`) to avoid paying
    the load cost on the first user request.

    Returns:
        A dict reporting which components loaded successfully, e.g.:
        {"drug_model": True, "patients": True, "interactions": True,
         "adr_model": False}
    """
    status = {}

    model = loader.get_model()
    status["drug_model"] = model is not None
    if status["drug_model"]:
        logger.info("Drug prediction model loaded")
    else:
        logger.warning("Drug prediction model failed to load")

    patients_df = patient_loader.load_patient_data()
    status["patients"] = not patients_df.empty
    logger.info("Loaded %d patients", len(patients_df))

    status["interactions"] = interactions.is_available()
    if status["interactions"]:
        logger.info("Drug interactions CSV available")
    else:
        logger.warning("Drug interactions CSV not available")

    adr_model = adverse.get_adr_model()
    status["adr_model"] = adr_model is not None
    if status["adr_model"]:
        logger.info("ADR model loaded")
    else:
        logger.info("ADR model not available (optional)")

    return status
