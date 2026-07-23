"""
Patient Model
Stores clinical patient profiles including conditions and baseline medications.
"""

import uuid
from django.db import models
from django.db import transaction


# def generate_patient_id() -> str:
#     """Generates a unique, human-friendly patient identifier, e.g. PAT-A1B2C3D4."""
#     return f"PAT-{uuid.uuid4().hex[:8].upper()}"


class Patient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient_id = models.CharField(
        max_length=50, unique=True, db_index=True,  editable=False, blank=True)
    full_name = models.CharField(max_length=255)
    age = models.PositiveIntegerField()
    gender = models.CharField(max_length=20)
    # JSONField stores lists like ["Hypertension", "Diabetes"]
    conditions = models.JSONField(default=list, blank=True)
    current_drugs = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "patients_patient"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["patient_id"], name="patient_id_idx"),
            models.Index(fields=["full_name"], name="patient_name_idx"),
        ]

    def save(self, *args, **kwargs):
      if not self.patient_id:
        last_patient = Patient.objects.filter(
            patient_id__startswith="PAT-"
        ).only("patient_id")

        if last_patient.exists():
            last_number = max(
                int(p.patient_id.split("-")[1])
                for p in last_patient
            )
            self.patient_id = f"PAT-{last_number + 1}"
        else:
            self.patient_id = "PAT-1"

      super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} ({self.patient_id})"
