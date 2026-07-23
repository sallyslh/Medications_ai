"""
Dashboard Views
GET /api/dashboard/       — aggregated stats payload for the React dashboard
GET /api/system/status/   — lightweight health check for the Help/Support page

Dashboard payload shape:
  {
    "totals":             { patients, predictions, adrReports },
    "recentPatients":     [ ...last 5 Patient objects ],
    "recentPredictions":  [ ...last 5 Prediction objects ],
    "notifications":      [ ...system-generated alert messages ]
  }
"""

from django.db import connection
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.apps.patients.models import Patient
from core.apps.patients.serializers import PatientSerializer
from core.apps.predictions.models import Prediction
from core.apps.predictions.serializers import PredictionSerializer

try:
    from core.apps.adr.models import ADRReport
except Exception:  # pragma: no cover - guards against pre-migration state
    ADRReport = None


def _build_notifications(user, recent_predictions):
    """
    Generate lightweight in-app notification objects derived from
    recent activity. In production these would come from a dedicated
    Notification model; here we synthesise them on-the-fly.
    """
    notifications = []

    for pred in recent_predictions[:3]:
        if pred.status == "Completed" and pred.confidence_score and pred.confidence_score < 0.65:
            notifications.append(
                {
                    "id": f"pred-low-conf-{pred.id}",
                    "type": "warning",
                    "title": "Low Confidence Prediction",
                    "message": (
                        f"Prediction for {pred.patient_name} returned "
                        f"{int(pred.confidence_score * 100)}% confidence. "
                        "Manual review advised."
                    ),
                    "created_at": pred.created_at.isoformat(),
                    "read": False,
                }
            )
        if pred.status == "Failed":
            notifications.append(
                {
                    "id": f"pred-failed-{pred.id}",
                    "type": "error",
                    "title": "Prediction Failed",
                    "message": (
                        f"The prediction for {pred.patient_name} encountered "
                        f"an error: {pred.error_message or 'Unknown error'}."
                    ),
                    "created_at": pred.created_at.isoformat(),
                    "read": False,
                }
            )

    # Sort newest first
    notifications.sort(key=lambda n: n["created_at"], reverse=True)
    return notifications[:10]


class DashboardView(APIView):
    """GET /api/dashboard/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # ── Totals ────────────────────────────────────────────────────────────
        total_patients = Patient.objects.count()
        total_predictions = Prediction.objects.filter(doctor=user).count()
        total_adr_reports = (
            ADRReport.objects.filter(doctor=user).count() if ADRReport is not None else 0
        )

        # ── Recent records ────────────────────────────────────────────────────
        recent_patients = Patient.objects.order_by("-created_at")[:5]
        recent_predictions = Prediction.objects.filter(doctor=user).order_by("-created_at")[:5]

        # ── Notifications ─────────────────────────────────────────────────────
        notifications = _build_notifications(user, list(recent_predictions))

        return Response(
            {
                "totals": {
                    "patients": total_patients,
                    "predictions": total_predictions,
                    "adrReports": total_adr_reports,
                },
                "recentPatients": PatientSerializer(recent_patients, many=True).data,
                "recentPredictions": PredictionSerializer(recent_predictions, many=True).data,
                "notifications": notifications,
            }
        )


class SystemStatusView(APIView):
    """
    GET /api/system/status/
    Lightweight health check consumed by the Help & Support page.
    Reports real database connectivity; the AI prediction service and
    auth server are reported Online whenever this endpoint can execute
    (both run in-process with the Django app).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        db_status = "Online"
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            db_status = "Offline"

        overall = "Operational" if db_status == "Online" else "Degraded"

        return Response(
            {
                "status": overall,
                "services": {
                    "clinical_services": "Online",
                    "ai_prediction_service": "Online",
                    "database": db_status,
                    "authentication_server": "Online",
                },
                "last_checked": timezone.now().isoformat(),
            }
        )
