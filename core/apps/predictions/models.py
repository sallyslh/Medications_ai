"""
Prediction Model
Tracks asynchronous drug-recommendation jobs through their lifecycle:
Pending → Running → Completed | Failed
"""

import uuid
from django.conf import settings
from django.db import models


class Prediction(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Running", "Running"),
        ("Completed", "Completed"),
        ("Failed", "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    patient = models.ForeignKey(
        "patients.Patient",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="predictions",
    )
    patient_name = models.CharField(max_length=255, blank=True, default="")

    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="predictions",
    )
    doctor_name = models.CharField(max_length=255, blank=True, default="")

    input_conditions = models.TextField(blank=True, default="")

    # Snapshot of the patient's current medications at request time, used by
    # the interaction-safety check. Stored on the prediction itself (rather
    # than always reading `patient.current_drugs`) so the check still works
    # when a "New Patient" request isn't saved to the patient directory.
    current_drugs_snapshot = models.JSONField(default=list, blank=True)

    # ── Primary AI recommendation ─────────────────────────────────────────────
    predicted_drug = models.CharField(max_length=255, blank=True, default="")
    confidence_score = models.FloatField(default=0.0)
    explanation = models.TextField(blank=True, default="")
    alternative_drugs = models.JSONField(default=list, blank=True)
    side_effects = models.JSONField(default=list, blank=True)
    # "safe" (checked, clear), "warning" (checked, conflict found), or
    # "unavailable" (couldn't be checked at all — must not be shown as safe).
    interaction_status = models.CharField(max_length=20, blank=True, default="safe")
    interaction_warning = models.CharField(max_length=500, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    # ── Clinician-selected prescription ───────────────────────────────────────
    selected_drug = models.CharField(max_length=255, blank=True, null=True)
    selected_confidence = models.FloatField(null=True, blank=True)
    selected_explanation = models.TextField(blank=True, null=True)
    selected_at = models.DateTimeField(null=True, blank=True)

    # ── Queue state ───────────────────────────────────────────────────────────
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    progress = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "predictions_prediction"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Prediction {self.id} — {self.predicted_drug} ({self.status})"
