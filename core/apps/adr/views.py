"""
ADR Views
Endpoints:
  POST /api/adr/check/    — run a drug interaction / contraindication safety check
  GET  /api/adr/history/  — list all ADR reports run by the authenticated doctor
"""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.apps.patients.models import Patient
from .engine import analyze_interactions
from .models import ADRReport
from .serializers import ADRReportSerializer


class ADRCheckView(APIView):
    """POST /api/adr/check/"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        checked_drugs = data.get("checked_drugs", [])
        is_manual = bool(data.get("is_manual", False))

        if not isinstance(checked_drugs, list) or len(checked_drugs) == 0:
            return Response(
                {"detail": "checked_drugs must be a non-empty list of medication names."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        patient = None
        patient_name = "Manual Analysis"
        conditions = []

        if is_manual:
            manual_profile = data.get("manual_profile", {}) or {}
            conditions = manual_profile.get("conditions", []) or []
            gender = manual_profile.get("gender", "")
            age = manual_profile.get("age", "")
            patient_name = f"Manual Profile ({age}y, {gender})".strip()
        else:
            patient_id = data.get("patient_id")
            if not patient_id:
                return Response(
                    {"detail": "patient_id is required when is_manual is false."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                patient = Patient.objects.get(pk=patient_id)
            except Patient.DoesNotExist:
                return Response(
                    {"detail": f"Patient '{patient_id}' not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            patient_name = patient.full_name
            conditions = patient.conditions or []

        result = analyze_interactions(checked_drugs, conditions)

        report = ADRReport.objects.create(
            patient=patient,
            patient_name=patient_name,
            doctor=request.user,
            doctor_name=request.user.get_full_name() or request.user.username,
            is_manual=is_manual,
            checked_drugs=checked_drugs,
            conditions=conditions,
            risk_level=result["risk_level"],
            explanation=result["explanation"],
            recommendation=result["recommendation"],
            alternative_drug=result["alternative_drug"],
        )

        return Response(ADRReportSerializer(report).data, status=status.HTTP_201_CREATED)


class ADRHistoryView(APIView):
    """GET /api/adr/history/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        reports = ADRReport.objects.filter(doctor=request.user).order_by("-created_at")
        return Response(ADRReportSerializer(reports, many=True).data)
