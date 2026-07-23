"""
Management command: import_patients

Bulk-loads the hospital's baseline patient roster from a CSV export
(columns: patient_id, name, age, gender, conditions, medications) into the
Patient table. This becomes the live dataset — patients added afterward
through the app land in the same table.

Usage:
    python manage.py import_patients ER_data_chronic_only.csv
    python manage.py import_patients ER_data_chronic_only.csv --flush
"""

import csv

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.apps.patients.models import Patient

GENDER_MAP = {"M": "Male", "F": "Female"}


def _split_list(raw: str) -> list:
    if not raw:
        return []
    return [part.strip().title() for part in raw.split(",") if part.strip()]


class Command(BaseCommand):
    help = "Bulk-import patients from a CSV file (patient_id,name,age,gender,conditions,medications)."

    def add_arguments(self, parser):
        parser.add_argument("csv_path", type=str)
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all existing patients before importing.",
        )

    def handle(self, *args, **options):
        csv_path = options["csv_path"]

        try:
            fh = open(csv_path, newline="", encoding="utf-8")
        except OSError as exc:
            raise CommandError(f"Could not open {csv_path}: {exc}")

        with fh:
            rows = list(csv.DictReader(fh))

        with transaction.atomic():
            if options["flush"]:
                deleted, _ = Patient.objects.all().delete()
                self.stdout.write(self.style.WARNING(f"Deleted {deleted} existing patients."))

            existing = set(Patient.objects.values_list("full_name", "age"))

            last_number = 0
            for patient_id in Patient.objects.filter(
                patient_id__startswith="PAT-"
            ).values_list("patient_id", flat=True):
                try:
                    last_number = max(last_number, int(patient_id.split("-")[1]))
                except (IndexError, ValueError):
                    continue

            to_create = []
            skipped = 0
            for row in rows:
                name = (row.get("name") or "").strip()
                age_raw = (row.get("age") or "").strip()
                if not name or not age_raw:
                    skipped += 1
                    continue
                age = int(age_raw)

                key = (name, age)
                if key in existing:
                    skipped += 1
                    continue
                existing.add(key)

                last_number += 1
                to_create.append(
                    Patient(
                        patient_id=f"PAT-{last_number}",
                        full_name=name,
                        age=age,
                        gender=GENDER_MAP.get((row.get("gender") or "").strip().upper(), "Male"),
                        conditions=_split_list(row.get("conditions", "")),
                        current_drugs=_split_list(row.get("medications", "")),
                    )
                )

            Patient.objects.bulk_create(to_create, batch_size=500)

        self.stdout.write(
            self.style.SUCCESS(f"Imported {len(to_create)} patients, skipped {skipped}.")
        )
