"""
interactions.py
════════════════════════════════════════════════════════════════════════════
Drug-drug interaction checking, backed by a CSV lookup table.

The interaction CSV is loaded once and cached in memory (see
`_load_interaction_table`); call `reload_interaction_table()` if the
underlying CSV file changes on disk and needs to be re-read.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Dict, List, Optional, Tuple

import pandas as pd

from drugbank_model import paths

logger = logging.getLogger(__name__)

_table_lock = threading.Lock()
_cached_table: Optional[pd.DataFrame] = None
_cache_checked = False

# Summary string returned when a drug couldn't actually be checked against
# the interaction table (missing file, failed to parse, out of memory, or an
# error during lookup). Callers MUST treat this differently from a genuine
# "no interactions found" result — `is_safe` is True in both cases (so
# existing callers that only look at `is_safe` degrade safely), but showing
# this as "Safe" to a clinician would be actively misleading: it means the
# check never ran, not that it ran and passed.
DATA_UNAVAILABLE = "Drug interaction data not available"


def is_available() -> bool:
    """Return True if the drug interaction CSV exists and has the expected
    columns.
    """
    try:
        table = _load_interaction_table()
        return table is not None
    except Exception:
        return False


def _load_interaction_table(force_reload: bool = False) -> Optional[pd.DataFrame]:
    """Load (and cache) the drug interaction CSV.

    Args:
        force_reload: If True, re-read the CSV from disk even if already
            cached.

    Returns:
        The interaction DataFrame, or None if the file is missing/invalid.
    """
    global _cached_table, _cache_checked

    if _cached_table is not None and not force_reload:
        return _cached_table

    with _table_lock:
        if _cached_table is not None and not force_reload:
            return _cached_table

        _cache_checked = True

        if not os.path.exists(paths.DRUG_INTERACTION_PATH):
            logger.warning(
                "Drug interactions CSV not found: %s", paths.DRUG_INTERACTION_PATH
            )
            _cached_table = None
            return None

        try:
            df = pd.read_csv(paths.DRUG_INTERACTION_PATH)
            logger.info(
                "Loaded drug interactions CSV: %d rows, columns=%s",
                len(df),
                list(df.columns),
            )
            _cached_table = df
            return df
        except Exception:
            logger.exception("Error loading drug interactions CSV")
            _cached_table = None
            return None


def reload_interaction_table() -> Optional[pd.DataFrame]:
    """Force a fresh read of the drug interaction CSV from disk."""
    return _load_interaction_table(force_reload=True)


def check_drug_safety(
    drug_name: str, current_medications: Optional[str]
) -> Tuple[bool, List[Dict], str]:
    """Check whether a drug interacts with a patient's current medications.

    Args:
        drug_name: The drug being considered for prescription.
        current_medications: Comma-separated string of the patient's current
            medications, or 'none'/empty if there are none.

    Returns:
        A tuple of:
            - is_safe: True if no interactions were found.
            - detailed_interactions: List of interaction detail dicts, each
              with `interacting_drug`, `interaction_type`, `severity`, and
              `description`.
            - summary: Human-readable summary string.
    """
    if not current_medications or current_medications == "none":
        return True, [], "No current medications"

    current_meds = [
        med.strip().lower() for med in str(current_medications).split(",")
    ]
    drug_lower = drug_name.lower().strip()

    table = _load_interaction_table()
    if table is None:
        return True, [], DATA_UNAVAILABLE

    detailed_interactions: List[Dict] = []

    try:
        matching_rows = table[table["name"].astype(str).str.lower().str.strip() == drug_lower]

        if not matching_rows.empty:
            row = matching_rows.iloc[0]
            interactions_str = str(row.get("drug-interactions", ""))

            if interactions_str and interactions_str != "nan":
                # The CSV stores each drug's interaction list as a single
                # comma-separated cell (e.g. "warfarin, aspirin, ..."), not
                # whitespace-separated — splitting on whitespace would chop
                # multi-word drug names in half and leave trailing commas.
                interaction_ids = [i.strip() for i in interactions_str.split(",") if i.strip()]

                for current_med in current_meds:
                    for interaction_id in interaction_ids:
                        interaction_name = interaction_id.lower().strip()
                        if (
                            current_med in interaction_name
                            or interaction_name in current_med
                            or current_med == interaction_name
                        ):
                            detailed_interactions.append(
                                {
                                    "interacting_drug": current_med,
                                    "interaction_type": "Direct match",
                                    "severity": "Moderate",
                                    "description": (
                                        f"{drug_name} interacts with {current_med}"
                                    ),
                                }
                            )
                            break
        else:
            logger.info("%s not found in interaction database", drug_name)

    except Exception:
        logger.exception("Error checking drug interactions for %s", drug_name)
        return True, [], DATA_UNAVAILABLE

    is_safe = len(detailed_interactions) == 0
    summary = (
        "Interactions: "
        + ", ".join(i["interacting_drug"] for i in detailed_interactions)
        if detailed_interactions
        else "No interactions"
    )

    return is_safe, detailed_interactions, summary
