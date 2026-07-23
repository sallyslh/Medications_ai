"""
Accounts – initial migration.
Creates the custom User model and UserSettings table.
"""

import uuid
import django.contrib.auth.models
import django.contrib.auth.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                ("is_superuser", models.BooleanField(default=False, verbose_name="superuser status")),
                ("is_staff", models.BooleanField(default=False, verbose_name="staff status")),
                ("is_active", models.BooleanField(default=True, verbose_name="active")),
                ("date_joined", models.DateTimeField(default=django.utils.timezone.now, verbose_name="date joined")),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("username", models.CharField(
                    error_messages={"unique": "A user with that username already exists."},
                    max_length=150, unique=True,
                    validators=[django.contrib.auth.validators.UnicodeUsernameValidator()],
                    verbose_name="username",
                )),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("role", models.CharField(
                    choices=[("Doctor", "Doctor"), ("Nurse", "Nurse"), ("Admin", "Admin")],
                    default="Doctor", max_length=20,
                )),
                ("department", models.CharField(blank=True, default="", max_length=120)),
                ("first_name", models.CharField(blank=True, max_length=150)),
                ("last_name", models.CharField(blank=True, max_length=150)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("groups", models.ManyToManyField(
                    blank=True, related_name="user_set", related_query_name="user",
                    to="auth.group", verbose_name="groups",
                )),
                ("user_permissions", models.ManyToManyField(
                    blank=True, related_name="user_set", related_query_name="user",
                    to="auth.permission", verbose_name="user permissions",
                )),
            ],
            options={"db_table": "accounts_user", "ordering": ["-created_at"]},
            managers=[("objects", django.contrib.auth.models.UserManager())],
        ),
        migrations.CreateModel(
            name="UserSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("language", models.CharField(default="en", max_length=10)),
                ("theme", models.CharField(default="light", max_length=20)),
                ("enable_face_recognition", models.BooleanField(default=False)),
                ("email_notifications", models.BooleanField(default=True)),
                ("high_risk_alerts", models.BooleanField(default=True)),
                ("weekly_digest", models.BooleanField(default=False)),
                ("user", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="settings",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "accounts_user_settings"},
        ),
    ]
