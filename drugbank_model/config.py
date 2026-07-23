"""
config.py
════════════════════════════════════════════════════════════════════════════
Configuration dataclass for the drug recommendation ML system.

This module contains ONLY the configuration definition. It performs no
loading, no inference, and defines no module-level globals or side effects.

IMPORTANT: `StreamlinedConfig` must keep its exact original field names and
defaults. The trained model pickle (complete_drug_model_system.pkl) contains
a serialized `StreamlinedConfig` instance and relies on this exact class
shape to unpickle correctly (see loader.py for the pickle-compatibility
shim that remaps the historical `__main__.StreamlinedConfig` reference to
this module).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Tuple


@dataclass
class StreamlinedConfig:
    """Configuration for the drug recommendation system.

    Attributes:
        test_size: Fraction of data held out for the test split.
        random_state: Random seed used for reproducibility.
        tfidf_max_features: Max vocabulary size for TF-IDF vectorizers.
        ngram_range: N-gram range used by the "enhanced" word vectorizer.
        min_df: Minimum document frequency for TF-IDF terms.
        max_df: Maximum document frequency for TF-IDF terms.
        svd_components: Number of components for TruncatedSVD.
        fixed_k: Fixed number of drug recommendations to return.
        ensemble_weights: Weights applied to each embedding strategy
            ('enhanced', 'char', 'word') when combining similarity scores.
    """

    test_size: float = 0.2
    random_state: int = 42
    tfidf_max_features: int = 5000
    ngram_range: Tuple[int, int] = (1, 4)
    min_df: int = 1
    max_df: float = 0.9
    svd_components: int = 300
    fixed_k: int = 3
    ensemble_weights: List[float] = field(
        default_factory=lambda: ["0.337", "0.496", "0.167"]
    )
