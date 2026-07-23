from rest_framework import serializers
from .models import Patient


def _normalize_list_field(value):
    """
    Accepts either a JSON array (["Hypertension", "Diabetes"]) or a
    comma-separated string ("Hypertension, Diabetes") and returns a
    clean list of trimmed, non-empty strings.
    """
    if value is None:
        return []
    if isinstance(value, str):
        items = value.split(",")
    elif isinstance(value, (list, tuple)):
        items = value
    else:
        raise serializers.ValidationError(
            "Must be a list or a comma-separated string."
        )

    cleaned = []
    for item in items:
        text = str(item).strip()
        if text:
            cleaned.append(text)
    return cleaned


class PatientSerializer(serializers.ModelSerializer):
    # Accept either an array or a comma-separated string from the frontend.
    conditions = serializers.JSONField(required=False)
    current_drugs = serializers.JSONField(required=False)

    class Meta:
        model = Patient
        fields = [
            "id",
            "patient_id",
            "full_name",
            "age",
            "gender",
            "conditions",
            "current_drugs",
            "created_at",
            "updated_at",
        ]
        # patient_id is auto-generated server-side and must never be
        # supplied (or overwritten) by the client.
        read_only_fields = ["id", "patient_id", "created_at", "updated_at"]

    def validate_full_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Full name is required.")
        return value

    def validate_gender(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Gender is required.")
        # Standardized to Male/Female across the application. "Unknown" is
        # kept as an internal fallback for records created via the AI
        # prediction workflow's optional patient-save shortcut.
        allowed = {"Male", "Female", "Unknown"}
        if value not in allowed:
            raise serializers.ValidationError(
                "Gender must be one of: Male, Female."
            )
        return value

    def validate_age(self, value):
        try:
            value = int(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError("Age must be a whole number.")
        if value < 0 or value > 150:
            raise serializers.ValidationError("Age must be between 0 and 150.")
        return value

    def validate_conditions(self, value):
        return _normalize_list_field(value)

    def validate_current_drugs(self, value):
        return _normalize_list_field(value)


class PatientDetailSerializer(PatientSerializer):
    """
    Extends PatientSerializer with an embedded prediction + ADR history.
    The `history` field is populated by the serializer methods below,
    which lazily import the predictions/adr apps to avoid circular deps.
    """

    history = serializers.SerializerMethodField()

    class Meta(PatientSerializer.Meta):
        fields = PatientSerializer.Meta.fields + ["history"]

    def get_history(self, obj):
        # Import here to avoid circular dependency with predictions/adr apps
        from core.apps.predictions.models import Prediction
        from core.apps.predictions.serializers import PredictionSerializer

        predictions = Prediction.objects.filter(patient=obj).order_by("-created_at")[:20]

        adr_reports_data = []
        try:
            from core.apps.adr.models import ADRReport
            from core.apps.adr.serializers import ADRReportSerializer

            adr_reports = ADRReport.objects.filter(patient=obj).order_by("-created_at")[:20]
            adr_reports_data = ADRReportSerializer(adr_reports, many=True).data
        except Exception:
            # The adr app may not be migrated yet in some environments;
            # degrade gracefully rather than breaking the patient detail view.
            adr_reports_data = []

        return {
            "predictions": PredictionSerializer(predictions, many=True).data,
            "adrReports": adr_reports_data,
        }
