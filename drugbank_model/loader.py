"""
loader.py
════════════════════════════════════════════════════════════════════════════
Loads the trained `StreamlinedDrugSystem` model exactly once, caches it, and
hands it out to the rest of the package through `get_model()`.

Nothing in this module runs automatically at import time. Django (or any
caller) must explicitly call `get_model()` / `initialize_models()`.

Pickle compatibility
---------------------
`complete_drug_model_system.pkl` was produced in a Colab notebook where
`StreamlinedConfig` and `StreamlinedDrugSystem` lived in `__main__`. Loading
it directly now raises::

    AttributeError: Can't get attribute 'StreamlinedConfig' on <module '__main__'>

We fix this WITHOUT retraining, using two complementary strategies:

1. Primary path (`_load_via_joblib_shim`): the pickle was written with
   `joblib.dump`, which stores large numpy arrays in a joblib-specific
   on-disk format. We temporarily register `drugbank_model.config.
   StreamlinedConfig` and `drugbank_model.model_classes.StreamlinedDrugSystem`
   as attributes of `__main__` (creating a throwaway `__main__` module if the
   caller has none, e.g. under Gunicorn/uWSGI workers), call `joblib.load`,
   then restore `__main__` to its original state. This preserves joblib's
   own numpy-array reconstruction logic, so it works for both compressed and
   uncompressed joblib pickles.

2. Fallback path (`CustomUnpickler`): if joblib.load isn't applicable (e.g.
   the file is a plain `pickle.dump`, optionally zlib-compressed), we use a
   `pickle.Unpickler` subclass that remaps `__main__.StreamlinedConfig` and
   `__main__.StreamlinedDrugSystem` references to this package's classes via
   `find_class`.

Thread safety
-------------
`get_model()` is safe to call concurrently (e.g. from multiple Gunicorn/
Uvicorn worker threads): a module-level lock guards the singleton cache so
the (expensive) pickle load only ever happens once per process.
"""

from __future__ import annotations

import io
import logging
import pickle
import sys
import threading
import types
import zlib
from typing import Any, Optional

import joblib

from drugbank_model import paths
from drugbank_model.config import StreamlinedConfig
from drugbank_model.model_classes import StreamlinedDrugSystem

logger = logging.getLogger(__name__)

# Historical (Colab) locations that must resolve to the current classes.
_LEGACY_CLASS_MAP = {
    ("__main__", "StreamlinedConfig"): StreamlinedConfig,
    ("__main__", "StreamlinedDrugSystem"): StreamlinedDrugSystem,
}

_model_lock = threading.Lock()
_cached_model: Optional[Any] = None


class CustomUnpickler(pickle.Unpickler):
    """Unpickler that remaps legacy `__main__` class references.

    Used as a fallback when the pickle is a plain `pickle.dump` (rather than
    a `joblib.dump`) and therefore doesn't need joblib's array-reconstruction
    machinery.
    """

    def find_class(self, module: str, name: str) -> Any:
        remapped = _LEGACY_CLASS_MAP.get((module, name))
        if remapped is not None:
            return remapped
        return super().find_class(module, name)


class _MainModuleShim:
    """Context manager that temporarily exposes the model classes as
    attributes of `sys.modules['__main__']`, so that `joblib.load` /
    `pickle.load` can resolve legacy `__main__.ClassName` references without
    needing a custom Unpickler (which joblib's numpy-aware unpickler does
    not straightforwardly support).

    Restores `__main__` to its original state on exit, including removing a
    placeholder module entirely if one had to be created (e.g. when running
    under a WSGI worker that has no real `__main__` script).
    """

    _ATTRS = {
        "StreamlinedConfig": StreamlinedConfig,
        "StreamlinedDrugSystem": StreamlinedDrugSystem,
    }

    def __enter__(self) -> "_MainModuleShim":
        self._created_module = False
        self._previous_values = {}
        self._had_attr = {}

        main_mod = sys.modules.get("__main__")
        if main_mod is None:
            main_mod = types.ModuleType("__main__")
            sys.modules["__main__"] = main_mod
            self._created_module = True

        self._main_mod = main_mod

        for attr_name, klass in self._ATTRS.items():
            self._had_attr[attr_name] = hasattr(main_mod, attr_name)
            self._previous_values[attr_name] = getattr(main_mod, attr_name, None)
            setattr(main_mod, attr_name, klass)

        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self._created_module:
            sys.modules.pop("__main__", None)
            return

        for attr_name in self._ATTRS:
            if self._had_attr[attr_name]:
                setattr(self._main_mod, attr_name, self._previous_values[attr_name])
            else:
                if hasattr(self._main_mod, attr_name):
                    delattr(self._main_mod, attr_name)


def _load_via_joblib_shim(filepath: str) -> Any:
    """Load a joblib-dumped model, remapping legacy `__main__` classes."""
    with _MainModuleShim():
        return joblib.load(filepath)


def _load_via_custom_unpickler(filepath: str) -> Any:
    """Load a plain (optionally zlib-compressed) pickle file.

    Args:
        filepath: Path to the pickle file.

    Returns:
        The deserialized object.
    """
    with open(filepath, "rb") as f:
        raw = f.read()

    # Some export pipelines zlib-compress the whole pickle stream.
    try:
        raw = zlib.decompress(raw)
    except zlib.error:
        pass  # Not zlib-compressed; use the bytes as-is.

    return CustomUnpickler(io.BytesIO(raw)).load()


def load_pickle(filepath: str = None) -> Any:
    """Load the drug model pickle from disk, without caching.

    Tries the joblib-shim path first (handles the common case where the
    model was saved with `joblib.dump`, including embedded numpy arrays),
    then falls back to a plain pickle load with class remapping.

    Args:
        filepath: Path to the model file. Defaults to `paths.MODEL_PATH`.

    Returns:
        The deserialized `StreamlinedDrugSystem` instance.

    Raises:
        FileNotFoundError: If the model file does not exist.
        Exception: Re-raises the last error if all loading strategies fail.
    """
    filepath = filepath or paths.MODEL_PATH

    import os

    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Drug model file not found: {filepath}")

    try:
        model = _load_via_joblib_shim(filepath)
        logger.info("Loaded drug model via joblib from %s", filepath)
        return model
    except Exception as joblib_error:
        logger.warning(
            "joblib load failed (%s); falling back to custom unpickler", joblib_error
        )

    model = _load_via_custom_unpickler(filepath)
    logger.info("Loaded drug model via custom unpickler from %s", filepath)
    return model


def get_model(filepath: str = None) -> Any:
    """Return the cached `StreamlinedDrugSystem` instance, loading it once.

    Thread-safe: concurrent callers will block on the first load and then
    share the same cached instance.

    Args:
        filepath: Optional override path to the model file.

    Returns:
        The loaded model, or None if loading failed.
    """
    global _cached_model

    if _cached_model is not None:
        return _cached_model

    with _model_lock:
        if _cached_model is None:
            try:
                _cached_model = load_pickle(filepath)
            except Exception:
                logger.exception("Failed to load drug prediction model")
                _cached_model = None

    return _cached_model


def reload_model(filepath: str = None) -> Any:
    """Force a fresh load of the model, replacing any cached instance.

    Args:
        filepath: Optional override path to the model file.

    Returns:
        The newly loaded model, or None if loading failed.
    """
    global _cached_model

    with _model_lock:
        try:
            _cached_model = load_pickle(filepath)
        except Exception:
            logger.exception("Failed to reload drug prediction model")
            _cached_model = None

    return _cached_model


def is_model_loaded() -> bool:
    """Return True if a model is currently cached in memory."""
    return _cached_model is not None
