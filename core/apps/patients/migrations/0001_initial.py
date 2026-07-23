import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Patient",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("patient_id", models.CharField(db_index=True, max_length=50, unique=True)),
                ("full_name", models.CharField(max_length=255)),
                ("age", models.PositiveIntegerField()),
                ("gender", models.CharField(max_length=20)),
                ("conditions", models.JSONField(blank=True, default=list)),
                ("current_drugs", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "patients_patient", "ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="patient",
            index=models.Index(fields=["patient_id"], name="patient_id_idx"),
        ),
        migrations.AddIndex(
            model_name="patient",
            index=models.Index(fields=["full_name"], name="patient_name_idx"),
        ),
    ]
