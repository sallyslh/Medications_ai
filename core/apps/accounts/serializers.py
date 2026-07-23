"""
Accounts Serializers
Converts User / UserSettings model instances to/from JSON.
"""

from rest_framework import serializers
from .models import User, UserSettings


class UserSerializer(serializers.ModelSerializer):
    """Read-only representation of a clinical user (used in login response and profile)."""

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "department",
            "first_name",
            "last_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class UserSettingsSerializer(serializers.ModelSerializer):
    """Preferences object nested inside /api/settings/ responses."""

    class Meta:
        model = UserSettings
        fields = [
            "language",
            "theme",
            "enable_face_recognition",
            "email_notifications",
            "high_risk_alerts",
            "weekly_digest",
        ]


class SettingsResponseSerializer(serializers.Serializer):
    """
    Shape returned by GET /api/settings/ — combines the user profile
    with their preferences in the structure the React frontend expects.
    """

    # source="*" passes the whole instance (the User) through to
    # UserSerializer, rather than DRF's default of looking up a `.profile`
    # attribute on it — which doesn't exist, and was causing this field to
    # be silently dropped from the response instead of erroring.
    profile = UserSerializer(source="*", read_only=True)
    preferences = serializers.SerializerMethodField()

    def get_preferences(self, obj):
        settings = getattr(obj, "settings", None)
        if settings is None:
            return {
                "language": "en",
                "theme": "light",
                "enableFaceRecognition": False,
                "notifications": {
                    "email": True,
                    "highRiskAlerts": True,
                    "weeklyDigest": False,
                },
            }
        return {
            "language": settings.language,
            "theme": settings.theme,
            "enableFaceRecognition": settings.enable_face_recognition,
            "notifications": {
                "email": settings.email_notifications,
                "highRiskAlerts": settings.high_risk_alerts,
                "weeklyDigest": settings.weekly_digest,
            },
        }
