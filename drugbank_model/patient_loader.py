"""
patient_loader.py
════════════════════════════════════════════════════════════════════════════
Patient data loading, search, selection, and updates.

The patient CSV is loaded once and cached in memory (thread-safe). All
functions here are pure with respect to their inputs — `update_patient`
returns a new DataFrame rather than mutating shared global state, so it is
safe to call from concurrent Django requests. Callers (e.g. a Django view)
are responsible for persisting any changes to durable storage (a database),
since an in-memory DataFrame is not a substitute for one in production.

Required CSV columns: patient_id, name, age, gender, conditions, medications
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Dict, Optional

import pandas as pd

from drugbank_model import paths

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = ["patient_id", "name", "age", "gender", "conditions", "medications"]

_df_lock = threading.Lock()
_cached_df: Optional[pd.DataFrame] = None


def load_patient_data(force_reload: bool = False) -> pd.DataFrame:
    """Load (and cache) patient data from the configured CSV file.

    Args:
        force_reload: If True, re-read the CSV from disk even if already
            cached.

    Returns:
        A DataFrame of patients. Empty DataFrame if the file is missing,
        unreadable, or missing required columns.
    """
    global _cached_df

    if _cached_df is not None and not force_reload:
        return _cached_df

    with _df_lock:
        if _cached_df is not None and not force_reload:
            return _cached_df

        if not os.path.exists(paths.PATIENT_DATA_PATH):
            logger.warning("Patient data file not found: %s", paths.PATIENT_DATA_PATH)
            _cached_df = pd.DataFrame()
            return _cached_df

        try:
            df = pd.read_csv(paths.PATIENT_DATA_PATH)
        except Exception:
            logger.exception("Error loading patient data")
            _cached_df = pd.DataFrame()
            return _cached_df

        missing_columns = [c for c in REQUIRED_COLUMNS if c not in df.columns]
        if missing_columns:
            logger.error("Missing columns in patient data: %s", missing_columns)
            _cached_df = pd.DataFrame()
            return _cached_df

        df["name"] = df["name"].fillna("Unknown")
        df["conditions"] = df["conditions"].fillna("")
        df["medications"] = df["medications"].fillna("none")

        logger.info("Loaded %d patients from %s", len(df), paths.PATIENT_DATA_PATH)
        _cached_df = df
        return _cached_df


def search_patients(search_term: str, df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """Search patients by ID, name, age, or gender substring match.

    Args:
        search_term: Free-text search term.
        df: Optional patient DataFrame to search. Defaults to the cached
            data returned by `load_patient_data()`.

    Returns:
        A filtered DataFrame of matching patients.
    """
    df = df if df is not None else load_patient_data()

    if df.empty:
        return df

    if not search_term:
        return df

    term = str(search_term).lower()
    mask = (
        df["patient_id"].str.lower().str.contains(term, na=False)
        | df["name"].str.lower().str.contains(term, na=False)
        | df["age"].astype(str).str.contains(term, na=False)
        | df["gender"].str.lower().str.contains(term, na=False)
    )
    return df[mask]


def select_patient(
    patient_id: str, df: Optional[pd.DataFrame] = None
) -> Optional[Dict]:
    """Look up a single patient's details by ID.

    Args:
        patient_id: The patient's ID.
        df: Optional patient DataFrame to search. Defaults to the cached
            data returned by `load_patient_data()`.

    Returns:
        A dict of the patient's fields, or None if not found.
    """
    df = df if df is not None else load_patient_data()

    if df.empty:
        return None

    matches = df[df["patient_id"] == patient_id]
    if matches.empty:
        return None

    return matches.iloc[0].to_dict()


def update_patient(
    patient_id: str,
    new_medication: str,
    new_condition: str,
    df: Optional[pd.DataFrame] = None,
) -> tuple[bool, str, pd.DataFrame]:
    """Add a medication/condition to a patient's record.

    Args:
        patient_id: The patient's ID.
        new_medication: Medication name to add (if not already present).
        new_condition: Condition name to add (if not already present).
        df: Optional patient DataFrame to update. Defaults to the cached
            data returned by `load_patient_data()`.

    Returns:
        A tuple of (success, message, updated_dataframe). The returned
        DataFrame is a new object — callers must persist it (e.g. write
        back to a database) if the change should outlive this call.
    """
    df = df if df is not None else load_patient_data()

    if df.empty or patient_id not in df["patient_id"].values:
        return False, "Patient not found", df

    df = df.copy()
    idx = df[df["patient_id"] == patient_id].index[0]

    current_meds = str(df.loc[idx, "medications"])
    if current_meds in ("none", "nan"):
        updated_meds = new_medication
    else:
        meds_list = [m.strip() for m in current_meds.split(",")]
        if new_medication not in meds_list:
            meds_list.append(new_medication)
        updated_meds = ", ".join(meds_list)

    current_conditions = str(df.loc[idx, "conditions"])
    if current_conditions in ("", "nan"):
        updated_conditions = new_condition
    else:
        conditions_list = [c.strip() for c in current_conditions.split(",")]
        if new_condition not in conditions_list:
            conditions_list.append(new_condition)
        updated_conditions = ", ".join(conditions_list)

    df.loc[idx, "medications"] = updated_meds
    df.loc[idx, "conditions"] = updated_conditions

    return True, f"Added {new_medication} for {new_condition} to patient record", df
