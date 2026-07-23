from rest_framework import serializers
from .models import Prediction


class PredictionSerializer(serializers.ModelSerializer):
    patient_id = serializers.SerializerMethodField()
    doctor_id = serializers.SerializerMethodField()

    class Meta:
        model = Prediction
        fields = [
            "id",
            "patient_id",
            "patient_name",
            "doctor_id",
            "doctor_name",
            "input_conditions",
            "predicted_drug",
            "confidence_score",
            "explanation",
            "alternative_drugs",
            "side_effects",
            "interaction_status",
            "interaction_warning",
            "created_at",
            "selected_drug",
            "selected_confidence",
            "selected_explanation",
            "selected_at",
            "status",
            "progress",
            "error_message",
        ]
        read_only_fields = ["id", "created_at"]

    def get_patient_id(self, obj):
        return str(obj.patient.id) if obj.patient else None

    def get_doctor_id(self, obj):
        return str(obj.doctor.id) if obj.doctor else None
