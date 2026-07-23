"""
paths.py
════════════════════════════════════════════════════════════════════════════
Single source of truth for every filesystem path used by the drugbank_model
package.

No other module in this package should hardcode a path. Import the constants
defined here instead.

All paths are resolved dynamically relative to this file's location so the
package works regardless of where it is deployed (local machine, Docker
container, server, etc.). Nothing here references Google Colab, Google Drive,
or any '/content/...' path.

Every path can be overridden with an environment variable, which is useful in
Django settings / deployment configs without needing to edit this file.
"""

from __future__ import annotations

import os

# ──────────────────────────────────────────────────────────────────────────
# Base directory: the drugbank_model package folder itself.
# ──────────────────────────────────────────────────────────────────────────
BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))


def _resolve(env_var: str, default_filename: str) -> str:
    """Resolve a path, preferring an environment variable override.

    Args:
        env_var: Name of the environment variable that may override the path.
        default_filename: Filename (relative to BASE_DIR) used when no
            environment variable is set.

    Returns:
        Absolute path to the resource.
    """
    override = os.environ.get(env_var)
    if override:
        return os.path.abspath(override)
    return os.path.join(BASE_DIR, default_filename)


# ──────────────────────────────────────────────────────────────────────────
# Core model & data files
# ──────────────────────────────────────────────────────────────────────────
MODEL_PATH: str = _resolve(
    "DRUGBANK_MODEL_PATH", "complete_drug_model_system.pkl"
)

PATIENT_DATA_PATH: str = _resolve(
    "DRUGBANK_PATIENT_DATA_PATH", "ER_data.csv"
)

DRUG_INTERACTION_PATH: str = _resolve(
    "DRUGBANK_INTERACTION_PATH", "drug_interaction.csv"
)

# Raw training data (only used by training.py, never at Django runtime).
TRAINING_DATA_PATH: str = _resolve(
    "DRUGBANK_TRAINING_DATA_PATH", "DRUG_indications.csv"
)

# Where training.py writes newly trained models.
TRAINING_OUTPUT_PATH: str = _resolve(
    "DRUGBANK_TRAINING_OUTPUT_PATH", "complete_drug_model_system.pkl"
)

# ──────────────────────────────────────────────────────────────────────────
# Adverse Drug Reaction (ADR) transformer model.
#
# This is optional. adverse.py must fail gracefully if this path does not
# exist or the `transformers` package is not installed.
# ──────────────────────────────────────────────────────────────────────────
ADR_MODEL_PATH: str = os.environ.get(
    "DRUGBANK_ADR_MODEL_PATH",
    os.path.join(BASE_DIR, "adr_model", "final_model"),
)

# Scratch directory used by `transformers`/`accelerate` for disk offloading
# of large models. Created lazily by adverse.py only if the ADR model is
# actually loaded.
ADR_OFFLOAD_DIR: str = os.environ.get(
    "DRUGBANK_ADR_OFFLOAD_DIR",
    os.path.join(BASE_DIR, ".offload"),
)
