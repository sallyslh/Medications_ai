import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("patients", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ADRReport",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("patient_name", models.CharField(blank=True, default="", max_length=255)),
                ("is_manual", models.BooleanField(default=False)),
                ("checked_drugs", models.JSONField(blank=True, default=list)),
                ("conditions", models.JSONField(blank=True, default=list)),
                (
                    "risk_level",
                    models.CharField(
                        choices=[("Low", "Low"), ("Moderate", "Moderate"), ("High", "High")],
                        default="Low",
                        max_length=20,
                    ),
                ),
                ("explanation", models.TextField(blank=True, default="")),
                ("recommendation", models.TextField(blank=True, default="")),
                ("alternative_drug", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("doctor_name", models.CharField(blank=True, default="", max_length=255)),
                (
                    "doctor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="adr_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "patient",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="adr_reports",
                        to="patients.patient",
                    ),
                ),
            ],
            options={
                "db_table": "adr_report",
                "ordering": ["-created_at"],
            },
        ),
    ]
