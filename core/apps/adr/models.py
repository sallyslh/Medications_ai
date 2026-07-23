"""
ADR (Adverse Drug Reaction) Model
Stores the results of a drug-drug / drug-condition interaction safety
check, whether run against a registered patient or a manual profile.
"""

import uuid
from django.conf import settings
from django.db import models


class ADRReport(models.Model):
    RISK_CHOICES = [
        ("Low", "Low"),
        ("Moderate", "Moderate"),
        ("High", "High"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    patient = models.ForeignKey(
        "patients.Patient",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="adr_reports",
    )
    patient_name = models.CharField(max_length=255, blank=True, default="")

    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="adr_reports",
    )
    doctor_name = models.CharField(max_length=255, blank=True, default="")

    is_manual = models.BooleanField(default=False)
    checked_drugs = models.JSONField(default=list, blank=True)
    conditions = models.JSONField(default=list, blank=True)

    risk_level = models.CharField(max_length=20, choices=RISK_CHOICES, default="Low")
    explanation = models.TextField(blank=True, default="")
    recommendation = models.TextField(blank=True, default="")
    alternative_drug = models.CharField(max_length=255, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "adr_report"
        ordering = ["-created_at"]

    def __str__(self):
        return f"ADR {self.id} — {self.risk_level} ({self.patient_name})"
