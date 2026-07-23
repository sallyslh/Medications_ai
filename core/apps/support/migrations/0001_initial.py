import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SupportTicket",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField()),
                ("status", models.CharField(
                    choices=[
                        ("Pending", "Pending"), ("Open", "Open"),
                        ("In Progress", "In Progress"), ("Resolved", "Resolved"),
                        ("Closed", "Closed"),
                    ],
                    default="Pending", max_length=20,
                )),
                ("category", models.CharField(blank=True, max_length=100, null=True)),
                ("priority", models.CharField(
                    choices=[("Low", "Low"), ("Medium", "Medium"), ("High", "High")],
                    default="Medium", max_length=10,
                )),
                ("browser", models.CharField(blank=True, max_length=100, null=True)),
                ("os", models.CharField(blank=True, max_length=100, null=True)),
                ("steps_to_reproduce", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="support_tickets", to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "support_ticket", "ordering": ["-created_at"]},
        ),
    ]
