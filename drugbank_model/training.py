"""
training.py
════════════════════════════════════════════════════════════════════════════
Model training driver.

This module is ONLY ever run offline/manually (e.g. `python -m
drugbank_model.training`) to produce a new `complete_drug_model_system.pkl`.
It must never be imported by the Django runtime — Django only needs
`predictor.py`, which loads the already-trained pickle via `loader.py`.

Nothing in this module executes at import time; run training explicitly via
`train_and_save_streamlined_system()` or the `__main__` entry point below.
"""

from __future__ import annotations

import logging
import pickle

import joblib

from drugbank_model import paths
from drugbank_model.config import StreamlinedConfig
from drugbank_model.model_classes import StreamlinedDrugSystem

logger = logging.getLogger(__name__)


def save_complete_system(system: StreamlinedDrugSystem, filepath: str = None) -> bool:
    """Persist a trained `StreamlinedDrugSystem` to disk.

    Saves via `joblib.dump` (primary) with a `pickle.dump` backup, matching
    the original notebook's save strategy.

    Args:
        system: A trained `StreamlinedDrugSystem` instance.
        filepath: Destination path. Defaults to `paths.TRAINING_OUTPUT_PATH`.

    Returns:
        True on success, False otherwise.
    """
    if not system.is_trained:
        logger.error("Refusing to save an untrained model")
        return False

    filepath = filepath or paths.TRAINING_OUTPUT_PATH

    try:
        joblib.dump(system, filepath, compress=3)
        logger.info("Model saved to %s", filepath)

        backup_path = filepath + ".bak"
        with open(backup_path, "wb") as f:
            pickle.dump(system, f, protocol=pickle.HIGHEST_PROTOCOL)
        logger.info("Backup pickle saved to %s", backup_path)

        return True

    except Exception:
        logger.exception("Failed to save trained model")
        return False


def train_and_save_streamlined_system(
    data_filepath: str = None,
    output_filepath: str = None,
) -> StreamlinedDrugSystem | None:
    """Train a new `StreamlinedDrugSystem` from raw indication data and save it.

    Args:
        data_filepath: Path to the raw drug indications CSV. Defaults to
            `paths.TRAINING_DATA_PATH`.
        output_filepath: Where to save the trained model. Defaults to
            `paths.TRAINING_OUTPUT_PATH`.

    Returns:
        The trained system, or None if training or saving failed.
    """
    data_filepath = data_filepath or paths.TRAINING_DATA_PATH
    output_filepath = output_filepath or paths.TRAINING_OUTPUT_PATH

    config = StreamlinedConfig(
        tfidf_max_features=5000,
        ngram_range=(1, 4),
        svd_components=300,
        fixed_k=3,
        ensemble_weights=[0.4, 0.3, 0.3],
    )

    system = StreamlinedDrugSystem(config)

    try:
        logger.info("Loading training data from %s", data_filepath)
        system.load_and_prepare_data(data_filepath)

        logger.info("Training model...")
        system.train_model()

        if save_complete_system(system, output_filepath):
            return system
        return None

    except Exception:
        logger.exception("Training failed")
        return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    trained_system = train_and_save_streamlined_system()
    if trained_system is not None:
        logger.info("Training complete.")
    else:
        logger.error("Training failed.")
