"""
model_classes.py
════════════════════════════════════════════════════════════════════════════
The `StreamlinedDrugSystem` ML model class.

This module contains ONLY class definitions. It imports no Django code, no
Gradio code, and performs no CSV loading, model loading, or other I/O at
import time.

IMPORTANT — Pickle compatibility:
The shipped `complete_drug_model_system.pkl` was originally created inside a
Colab notebook where this class lived in `__main__`. `loader.py` implements
the compatibility shim that lets the historical pickle deserialize into
*this* class. For that to work, `StreamlinedDrugSystem` must keep the same
attribute names it had when the model was trained/pickled
(`config`, `df`, `train_df`, `test_df`, `vectorizers`, `svd_models`,
`embeddings_matrices`, `indication_to_drugs`, `drug_to_indications`,
`drug_profiles`, `optimal_k`, `is_trained`, `medical_synonyms`).

Do not rename or remove these attributes, and do not change the prediction
algorithm — only the surrounding module layout has changed.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import normalize

from drugbank_model.config import StreamlinedConfig
from drugbank_model import utils

logger = logging.getLogger(__name__)


class StreamlinedDrugSystem:
    """Drug recommendation ML model using a TF-IDF + SVD ensemble.

    Recommends a fixed number (K, default 3) of drugs for a free-text
    medical condition/indication by combining three independent embedding
    strategies ('enhanced', 'char', 'word') via a weighted cosine-similarity
    ensemble.
    """

    def __init__(self, config: Optional[StreamlinedConfig] = None):
        self.config = config or StreamlinedConfig()
        self.df: Optional[pd.DataFrame] = None
        self.train_df: Optional[pd.DataFrame] = None
        self.test_df: Optional[pd.DataFrame] = None
        self.vectorizers: Dict[str, TfidfVectorizer] = {}
        self.svd_models: Dict[str, TruncatedSVD] = {}
        self.embeddings_matrices: Dict[str, np.ndarray] = {}
        self.indication_to_drugs: Optional[Dict[str, set]] = None
        self.drug_to_indications: Optional[Dict[str, set]] = None
        self.drug_profiles: Optional[Dict[str, dict]] = None
        self.optimal_k: int = self.config.fixed_k
        self.is_trained: bool = False
        self.medical_synonyms: Dict[str, List[str]] = utils.create_medical_synonyms()

    # ─────────────────────────────────────────────────────────────────────
    # Text processing (delegates to utils for the actual logic)
    # ─────────────────────────────────────────────────────────────────────
    def _enhance_text_with_synonyms(self, text: str) -> str:
        """Enhance text with medical synonyms."""
        return utils.enhance_text_with_synonyms(text, self.medical_synonyms)

    def _advanced_text_cleaning(self, text: str) -> str:
        """Advanced text cleaning with medical term preservation."""
        return utils.advanced_text_cleaning(text)

    def _create_enhanced_indication(self, text: str) -> str:
        """Create enhanced indication text."""
        return utils.create_enhanced_indication(text, self.medical_synonyms)

    def _normalize_drug_name(self, drug_name: str) -> str:
        """Normalize drug names."""
        return utils.normalize_drug_name(drug_name)

    # ─────────────────────────────────────────────────────────────────────
    # Data loading & preparation (training-time only)
    # ─────────────────────────────────────────────────────────────────────
    def load_and_prepare_data(self, filepath: str) -> None:
        """Load and prepare training data from a CSV file.

        Args:
            filepath: Path to the raw drug indications CSV.
        """
        self.df = pd.read_csv(filepath)

        if "name" in self.df.columns and "indication" in self.df.columns:
            self.df = self.df.rename(columns={"name": "drug_name"})
        elif "Name" in self.df.columns and "Indication" in self.df.columns:
            self.df = self.df.rename(
                columns={"Name": "drug_name", "Indication": "indication"}
            )

        self.df["drug_name"] = self.df["drug_name"].fillna("").astype(str)
        self.df["indication"] = self.df["indication"].fillna("").astype(str)
        self.df["clean_indication"] = self.df["indication"].apply(
            self._advanced_text_cleaning
        )
        self.df = self.df[
            self.df["clean_indication"].str.strip() != ""
        ].reset_index(drop=True)
        self.df["normalized_drug_name"] = self.df["drug_name"].apply(
            self._normalize_drug_name
        )
        self.df["enhanced_indication"] = self.df["clean_indication"].apply(
            self._create_enhanced_indication
        )
        self.df["synonym_enhanced"] = self.df["clean_indication"].apply(
            self._enhance_text_with_synonyms
        )

        self.indication_to_drugs = defaultdict(set)
        self.drug_to_indications = defaultdict(set)
        self.drug_profiles = {}

        for _, row in self.df.iterrows():
            drug = row["normalized_drug_name"]
            original_drug = row["drug_name"]
            indication = row["clean_indication"]

            self.drug_profiles[drug] = {
                "original_name": original_drug,
                "indication": indication,
                "enhanced_indication": row["enhanced_indication"],
                "synonym_enhanced": row["synonym_enhanced"],
            }

            if indication:
                self.indication_to_drugs[indication].add(drug)
                self.drug_to_indications[drug].add(indication)

        self.train_df, self.test_df = train_test_split(
            self.df,
            test_size=self.config.test_size,
            random_state=self.config.random_state,
            shuffle=True,
        )

    # ─────────────────────────────────────────────────────────────────────
    # Model training — embedding creation
    # ─────────────────────────────────────────────────────────────────────
    def create_enhanced_embeddings(self) -> Dict[str, np.ndarray]:
        """Create TF-IDF + SVD embeddings using three parallel strategies."""
        self.vectorizers["enhanced"] = TfidfVectorizer(
            max_features=self.config.tfidf_max_features,
            ngram_range=self.config.ngram_range,
            stop_words="english",
            min_df=self.config.min_df,
            max_df=self.config.max_df,
            sublinear_tf=True,
            norm="l2",
            analyzer="word",
        )

        self.vectorizers["char"] = TfidfVectorizer(
            max_features=self.config.tfidf_max_features // 2,
            ngram_range=(3, 5),
            analyzer="char",
            stop_words="english",
            min_df=self.config.min_df,
            max_df=self.config.max_df,
            sublinear_tf=True,
            norm="l2",
        )

        self.vectorizers["word"] = TfidfVectorizer(
            max_features=self.config.tfidf_max_features,
            ngram_range=(1, 2),
            stop_words="english",
            min_df=1,
            max_df=0.8,
            sublinear_tf=True,
            norm="l2",
        )

        text_versions = {
            "enhanced": self.train_df["enhanced_indication"].tolist(),
            "char": self.train_df["clean_indication"].tolist(),
            "word": self.train_df["synonym_enhanced"].tolist(),
        }

        for strategy, vectorizer in self.vectorizers.items():
            tfidf_matrix = vectorizer.fit_transform(text_versions[strategy])

            self.svd_models[strategy] = TruncatedSVD(
                n_components=self.config.svd_components,
                random_state=self.config.random_state,
            )

            embeddings = self.svd_models[strategy].fit_transform(tfidf_matrix)
            self.embeddings_matrices[strategy] = normalize(embeddings, norm="l2")

        return self.embeddings_matrices

    def train_model(self) -> None:
        """Train the model (fixed K recommendations, per config)."""
        self.create_enhanced_embeddings()
        self.is_trained = True

    # ─────────────────────────────────────────────────────────────────────
    # Prediction
    # ─────────────────────────────────────────────────────────────────────
    def _get_ensemble_query_embedding(self, query: Dict) -> Dict[str, np.ndarray]:
        """Compute the ensemble query embedding for a condition string."""
        indication_text = query.get("indication_text", "")

        enhanced_query = self._create_enhanced_indication(indication_text)
        synonym_query = self._enhance_text_with_synonyms(indication_text)

        query_embeddings = {}

        query_tfidf = self.vectorizers["enhanced"].transform([enhanced_query])
        query_embeddings["enhanced"] = normalize(
            self.svd_models["enhanced"].transform(query_tfidf), norm="l2"
        )[0]

        query_tfidf = self.vectorizers["char"].transform([indication_text])
        query_embeddings["char"] = normalize(
            self.svd_models["char"].transform(query_tfidf), norm="l2"
        )[0]

        query_tfidf = self.vectorizers["word"].transform([synonym_query])
        query_embeddings["word"] = normalize(
            self.svd_models["word"].transform(query_tfidf), norm="l2"
        )[0]

        return query_embeddings

    def search_similar_drugs_ensemble(
        self, query_embeddings: Dict[str, np.ndarray], top_k: int = 3
    ) -> Tuple[List[float], List[int]]:
        """Rank drugs by weighted ensemble cosine similarity."""
        all_similarities = []

        for strategy, weight in zip(
            ["enhanced", "char", "word"], self.config.ensemble_weights
        ):
            query_embedding = query_embeddings[strategy].reshape(1, -1)
            similarities = cosine_similarity(
                query_embedding, self.embeddings_matrices[strategy]
            )[0]
            all_similarities.append(similarities * float(weight))

        similarities = np.sum(all_similarities, axis=0)
        top_indices = np.argsort(similarities)[::-1][:top_k]
        top_scores = similarities[top_indices]

        return top_scores, top_indices

    def predict_drugs_for_condition(
        self, condition: str, top_k: Optional[int] = None
    ) -> List[Dict]:
        """Predict drug recommendations for a free-text condition.

        Args:
            condition: Free-text medical condition/indication.
            top_k: Number of recommendations to return. Defaults to
                `self.optimal_k` (the config's fixed_k).

        Returns:
            A list of recommendation dicts, each with `drug_name`,
            `normalized_name`, `indication`, `confidence_score`, and `rank`.
            Returns an empty list if the model isn't trained or on error.
        """
        if not self.is_trained:
            return []

        if top_k is None:
            top_k = self.optimal_k

        try:
            query = {"indication_text": condition}
            query_embeddings = self._get_ensemble_query_embedding(query)
            scores, indices = self.search_similar_drugs_ensemble(
                query_embeddings, top_k
            )

            recommendations = []
            for idx, score in zip(indices, scores):
                if idx < len(self.train_df):
                    drug_row = self.train_df.iloc[idx]
                    recommendations.append(
                        {
                            "drug_name": drug_row["drug_name"],
                            "normalized_name": drug_row["normalized_drug_name"],
                            "indication": drug_row["clean_indication"],
                            "confidence_score": float(score),
                            "rank": len(recommendations) + 1,
                        }
                    )

            return recommendations

        except Exception:
            logger.exception("Prediction failed for condition=%r", condition)
            return []
