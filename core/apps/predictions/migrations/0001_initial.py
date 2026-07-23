import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("patients", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Prediction",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("patient_name", models.CharField(blank=True, default="", max_length=255)),
                ("doctor_name", models.CharField(blank=True, default="", max_length=255)),
                ("input_conditions", models.TextField(blank=True, default="")),
                ("predicted_drug", models.CharField(blank=True, default="", max_length=255)),
                ("confidence_score", models.FloatField(default=0.0)),
                ("explanation", models.TextField(blank=True, default="")),
                ("alternative_drugs", models.JSONField(blank=True, default=list)),
                ("side_effects", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("selected_drug", models.CharField(blank=True, max_length=255, null=True)),
                ("selected_confidence", models.FloatField(blank=True, null=True)),
                ("selected_explanation", models.TextField(blank=True, null=True)),
                ("selected_at", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(
                    choices=[
                        ("Pending", "Pending"), ("Running", "Running"),
                        ("Completed", "Completed"), ("Failed", "Failed"),
                    ],
                    default="Pending", max_length=20,
                )),
                ("progress", models.IntegerField(default=0)),
                ("error_message", models.TextField(blank=True, null=True)),
                ("patient", models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name="predictions", to="patients.patient",
                )),
                ("doctor", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="predictions", to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "predictions_prediction", "ordering": ["-created_at"]},
        ),
    ]
