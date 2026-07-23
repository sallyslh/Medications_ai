"""
utils.py
════════════════════════════════════════════════════════════════════════════
Stand-alone text-processing helper functions shared by the ML model.

These are pure functions with no side effects: no I/O, no globals, no model
loading. `model_classes.StreamlinedDrugSystem` delegates to these functions
internally so the exact same text-processing behavior is preserved from the
original notebook, just without duplicating the logic across modules.
"""

from __future__ import annotations

import re
from typing import Dict, List

import pandas as pd

# ──────────────────────────────────────────────────────────────────────────
# Medical synonyms dictionary
# ──────────────────────────────────────────────────────────────────────────


def create_medical_synonyms() -> Dict[str, List[str]]:
    """Return the medical synonyms lookup used for text enhancement."""
    return {
        "pain": ["discomfort", "ache", "soreness", "tenderness"],
        "infection": ["bacterial", "pathogen", "contamination"],
        "inflammation": ["swelling", "irritation", "inflammatory"],
        "treatment": ["therapy", "medication", "drug", "medicine"],
        "disease": ["disorder", "condition", "illness", "ailment"],
        "chronic": ["persistent", "long-term", "ongoing"],
        "acute": ["sudden", "severe", "immediate"],
        "cancer": ["tumor", "malignancy", "carcinoma", "neoplasm"],
        "diabetes": ["diabetic", "glucose", "blood sugar"],
        "hypertension": ["high blood pressure", "elevated pressure"],
        "depression": ["depressive", "mood disorder", "mental health"],
        "anxiety": ["anxious", "panic", "stress"],
        "allergy": ["allergic", "hypersensitivity", "reaction"],
        "asthma": ["respiratory", "breathing", "airways"],
        "heart": ["cardiac", "cardiovascular", "coronary"],
        "liver": ["hepatic", "hepato"],
        "kidney": ["renal", "nephro"],
        "brain": ["cerebral", "neurological", "neuro"],
        "bone": ["skeletal", "osteo"],
        "muscle": ["muscular", "myalgia"],
        "skin": ["dermal", "cutaneous", "dermatological"],
        "blood": ["hematological", "hemic"],
        "immune": ["immunological", "autoimmune"],
        "pediatric": ["children", "child", "infant", "pediatric"],
        "adult": ["grown-up", "mature"],
        "elderly": ["geriatric", "senior", "aged"],
    }


# ──────────────────────────────────────────────────────────────────────────
# Text processing
# ──────────────────────────────────────────────────────────────────────────


def enhance_text_with_synonyms(text: str, synonyms: Dict[str, List[str]]) -> str:
    """Enhance text by appending medical synonyms for known terms.

    Args:
        text: Input text (already lower-cased upstream is not required; this
            function lower-cases for matching but appends to the original).
        synonyms: Lookup produced by `create_medical_synonyms`.

    Returns:
        The original text with up to 2 synonyms appended per matched word.

    Deterministic by design: the original notebook picked a random subset of
    synonyms per call (`random.sample`, unseeded), so the exact same query
    text could score differently against the model from one request to the
    next — not a data or model problem, just unseeded randomness in this
    step. Always taking the first N candidates instead makes a given input
    always produce the same enhanced text and therefore the same
    recommendation, which matters far more than synonym variety for a
    clinical-decision-support tool.
    """
    enhanced_text = text
    words = text.lower().split()

    for word in words:
        if word in synonyms:
            candidates = synonyms[word]
            selected = candidates[:2]
            enhanced_text += " " + " ".join(selected)

    return enhanced_text


def advanced_text_cleaning(text: str) -> str:
    """Clean free-text medical indications while preserving medical terms.

    Args:
        text: Raw indication text (may be NaN/None/empty).

    Returns:
        Lower-cased, punctuation-stripped, whitespace-normalized text with
        very short non-medical tokens dropped.
    """
    if pd.isna(text) or text == "":
        return ""

    text = str(text).lower()
    text = re.sub(r"\b(\w+)-(\w+)\b", r"\1 \2", text)
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    words = text.split()
    filtered_words = [
        word
        for word in words
        if len(word) >= 2 or word.upper() in ["mg", "ml", "iv", "po", "pr"]
    ]

    return " ".join(filtered_words)


def create_enhanced_indication(text: str, synonyms: Dict[str, List[str]]) -> str:
    """Build the "enhanced" indication text used by the TF-IDF vectorizer.

    Duplicates the base text, appends synonym-enhanced text, and appends
    any "important" (length > 3) words a second time.

    Args:
        text: Cleaned indication text.
        synonyms: Lookup produced by `create_medical_synonyms`.

    Returns:
        The enhanced indication string.
    """
    enhanced = text + " " + text
    enhanced += " " + enhance_text_with_synonyms(text, synonyms)

    words = text.split()
    if len(words) > 1:
        important_words = [w for w in words if len(w) > 3]
        enhanced += " " + " ".join(important_words)

    return enhanced.strip()


def normalize_drug_name(drug_name: str) -> str:
    """Normalize a drug name to a canonical lookup key.

    Args:
        drug_name: Raw drug name (may be NaN/None).

    Returns:
        Lower-cased alphanumeric-only string, or '' if input was NaN.
    """
    if pd.isna(drug_name):
        return ""
    return re.sub(r"[^a-zA-Z0-9]", "", str(drug_name).lower())
