"""
adverse.py
════════════════════════════════════════════════════════════════════════════
Optional adverse drug reaction (ADR) prediction using a fine-tuned causal LM
(originally `epfl-llm/meditron-7b`, fine-tuned on FAERS data).

This module MUST fail gracefully:
    - If the `transformers`/`torch` packages aren't installed, or
    - If the model files aren't present at `paths.ADR_MODEL_PATH`,

then `get_adr_model()` returns None and `predict_adverse_reactions()` returns
"None" — Django must never crash because this optional model is missing.

The transformer is lazy-loaded on first use and cached afterward (loaded at
most once per process).
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any, Dict, Optional

from drugbank_model import paths

logger = logging.getLogger(__name__)

_model_lock = threading.Lock()
_cached_adr_model: Optional[Dict[str, Any]] = None
_load_attempted = False

_NO_REACTION_RESPONSE = "None"


def _load_adr_model() -> Optional[Dict[str, Any]]:
    """Load the ADR tokenizer + model with disk offloading, if available.

    Imports `transformers`/`torch` lazily, right here on first call, rather
    than at module import time — these are large (multi-hundred-MB) optional
    dependencies, and the vast majority of requests only need the core
    drug-recommendation model, not ADR prediction. Importing them eagerly
    inflated every process's memory footprint enough to make the (much
    smaller) drug-recommendation pickle fail to load under memory pressure.

    Returns:
        A dict with keys `model`, `tokenizer`, `device`, `type`, or None if
        the model can't be loaded for any reason (missing dependency,
        missing files, out of memory, etc).
    """
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch
    except Exception as exc:
        # Broad except: torch's native DLL loading can raise OSError (e.g. Windows
        # "paging file too small") rather than ImportError, and this dependency
        # must never take down the rest of the package.
        logger.info("transformers/torch unavailable (%s); ADR model will be unavailable", exc)
        return None

    if not os.path.exists(paths.ADR_MODEL_PATH):
        logger.info("ADR model path not found: %s", paths.ADR_MODEL_PATH)
        return None

    try:
        logger.info("Loading ADR tokenizer from %s", paths.ADR_MODEL_PATH)
        tokenizer = AutoTokenizer.from_pretrained(paths.ADR_MODEL_PATH)

        os.makedirs(paths.ADR_OFFLOAD_DIR, exist_ok=True)

        logger.info("Loading ADR model (with disk offloading)")
        model = AutoModelForCausalLM.from_pretrained(
            paths.ADR_MODEL_PATH,
            device_map="auto",
            torch_dtype=torch.float16,
            low_cpu_mem_usage=True,
            offload_folder=paths.ADR_OFFLOAD_DIR,
            offload_state_dict=True,
        )

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.eval()

        logger.info("ADR model loaded successfully on device=%s", device)

        return {
            "model": model,
            "tokenizer": tokenizer,
            "device": device,
            "type": "huggingface_transformers",
        }

    except Exception:
        logger.exception("Failed to load ADR model")
        return None


def get_adr_model() -> Optional[Dict[str, Any]]:
    """Return the cached ADR model, lazily loading it on first call.

    Thread-safe. Returns None (without raising) if the model can't be
    loaded, so callers can always safely check the return value.
    """
    global _cached_adr_model, _load_attempted

    if _cached_adr_model is not None:
        return _cached_adr_model

    with _model_lock:
        if not _load_attempted:
            _load_attempted = True
            _cached_adr_model = _load_adr_model()

    return _cached_adr_model


def _clean_output(text: str) -> str:
    """Strip prompt residue and cap the length of a generated response."""
    text = (
        text.replace("### Instruction:", "")
        .replace("### Input:", "")
        .replace("### Output:", "")
    )
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    text = "\n".join(lines)

    if len(text) > 500:
        text = text[:500] + "..."

    return text


def predict_adverse_reactions(
    recommended_drug: str,
    patient_age: Any,
    patient_gender: str,
    current_medications: str,
) -> str:
    """Predict possible adverse reactions for a new drug given patient context.

    Args:
        recommended_drug: The drug being considered for prescription.
        patient_age: Patient age.
        patient_gender: Patient gender.
        current_medications: Comma-separated current medications, or 'none'.

    Returns:
        A generated adverse-reaction description, or the literal string
        "None" if the ADR model is unavailable or generation fails.
    """
    model_bundle = get_adr_model()

    if model_bundle is None:
        return _NO_REACTION_RESPONSE

    import torch  # already imported successfully by _load_adr_model; cached

    try:
        model = model_bundle["model"]
        tokenizer = model_bundle["tokenizer"]
        device = model_bundle["device"]

        current_meds_text = (
            current_medications
            if current_medications and current_medications != "none"
            else "No current medications"
        )

        prompt = f"""### Instruction:
You are a clinical pharmacology expert. Given the patient information and current medications below, predict the possible adverse reactions and drug interactions that could occur when adding the specified new drug to their treatment regimen. Consider patient demographics, existing medications, and potential drug-drug interactions.

### Input:
Patient Demographics:
- Age: {patient_age} years old
- Gender: {patient_gender}

Current Medications: {current_meds_text}

New Drug Being Prescribed: {recommended_drug}

Task: Predict adverse reactions that could occur when adding {recommended_drug} to this patient's current medication regimen, considering their age, gender, and potential drug-drug interactions.

### Output:
"""

        inputs = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_length=300,
                num_beams=5,
                no_repeat_ngram_size=2,
                early_stopping=True,
                temperature=0.7,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
            )

        generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

        if "### Output:" in generated_text:
            reaction_text = generated_text.split("### Output:")[-1].strip()
        else:
            reaction_text = generated_text.replace(prompt, "").strip()

        return _clean_output(reaction_text)

    except Exception:
        logger.exception(
            "Error generating adverse reactions for drug=%r", recommended_drug
        )
        return _NO_REACTION_RESPONSE
