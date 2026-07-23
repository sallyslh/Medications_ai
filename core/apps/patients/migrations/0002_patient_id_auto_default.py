from django.db import migrations, models
import core.apps.patients.models


class Migration(migrations.Migration):

    dependencies = [
        ("patients", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="patient",
            name="patient_id",
            field=models.CharField(
                db_index=True,
                blank=True,
                editable=False,
                max_length=50,
                unique=True,
            ),
        ),
    ]
