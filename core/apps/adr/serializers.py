from rest_framework import serializers
from .models import ADRReport


class ADRReportSerializer(serializers.ModelSerializer):
    patient_id = serializers.SerializerMethodField()
    doctor_id = serializers.SerializerMethodField()

    class Meta:
        model = ADRReport
        fields = [
            "id",
            "patient_id",
            "patient_name",
            "doctor_id",
            "doctor_name",
            "is_manual",
            "checked_drugs",
            "conditions",
            "risk_level",
            "explanation",
            "recommendation",
            "alternative_drug",
            "created_at",
        ]
        read_only_fields = fields

    def get_patient_id(self, obj):
        return str(obj.patient.id) if obj.patient else None

    def get_doctor_id(self, obj):
        return str(obj.doctor.id) if obj.doctor else None
