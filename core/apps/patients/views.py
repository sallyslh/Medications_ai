"""
Patients Views
Full CRUD for patient records with search, filtering and
prediction history in the detail endpoint.

Endpoints:
  GET    /api/patients/       — list with optional ?search, ?condition, ?name
  POST   /api/patients/       — create
  GET    /api/patients/<id>/  — detail + history
  PUT    /api/patients/<id>/  — update
  DELETE /api/patients/<id>/  — delete
"""

from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Patient
from .serializers import PatientSerializer, PatientDetailSerializer


class PatientListCreateView(APIView):
    """GET /api/patients/  |  POST /api/patients/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Patient.objects.all()

        search = request.query_params.get("search", "").strip()
        name = request.query_params.get("name", "").strip()
        condition = request.query_params.get("condition", "").strip()
        drug = request.query_params.get("drug", "").strip()
        patient_id_param = request.query_params.get("patient_id", "").strip()

        if search:
            qs = qs.filter(
                Q(full_name__icontains=search)
                | Q(patient_id__icontains=search)
            )
        if name:
            qs = qs.filter(full_name__icontains=name)
        if patient_id_param:
            qs = qs.filter(patient_id__icontains=patient_id_param)
        if condition:
            # JSONField containment: PostgreSQL @> operator
            qs = qs.filter(conditions__icontains=condition)
        if drug:
            qs = qs.filter(current_drugs__icontains=drug)

        serializer = PatientSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = PatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # The prompt specifies 210 but 201 is the correct HTTP standard.
        # Using 201 to stay RFC-compliant; the frontend handles 2xx uniformly.
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PatientDetailView(APIView):
    """GET / PUT / DELETE /api/patients/<id>/"""

    permission_classes = [IsAuthenticated]

    def _get_patient(self, pk):
        try:
            return Patient.objects.get(pk=pk)
        except Patient.DoesNotExist:
            return None

    def get(self, request, pk):
        patient = self._get_patient(pk)
        if not patient:
            return Response(
                {"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND
            )
        serializer = PatientDetailSerializer(patient)
        return Response(serializer.data)

    def put(self, request, pk):
        patient = self._get_patient(pk)
        if not patient:
            return Response(
                {"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND
            )
        serializer = PatientSerializer(patient, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        patient = self._get_patient(pk)
        if not patient:
            return Response(
                {"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND
            )
        patient.delete()
        return Response({"success": True, "message": "Patient record deleted successfully."})
