"""
Accounts Models
Custom User (extends AbstractUser) and per-user clinical preferences.
"""

import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Clinical user model. UUID primary key.
    Roles: Doctor | Nurse | Admin.
    """

    ROLE_CHOICES = [
        ("Doctor", "Doctor"),
        ("Nurse", "Nurse"),
        ("Admin", "Admin"),
    ]

    # Override the default int PK with a UUID
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # AbstractUser already provides username, first_name, last_name, email,
    # is_active, is_staff, date_joined, last_login — we extend with:
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="Doctor")
    department = models.CharField(max_length=120, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_user"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"


class UserSettings(models.Model):
    """Per-user preferences (theme, notifications, etc.)."""

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="settings"
    )
    language = models.CharField(max_length=10, default="en")
    theme = models.CharField(max_length=20, default="light")
    enable_face_recognition = models.BooleanField(default=False)
    email_notifications = models.BooleanField(default=True)
    high_risk_alerts = models.BooleanField(default=True)
    weekly_digest = models.BooleanField(default=False)

    class Meta:
        db_table = "accounts_user_settings"

    def __str__(self):
        return f"Settings for {self.user.username}"
