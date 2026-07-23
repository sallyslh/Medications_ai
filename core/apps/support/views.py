"""
Support Views
Handles help centre FAQ content and technical support ticket management.

Endpoints:
  GET  /api/help/faq/          — static FAQ list
  POST /api/help/ticket/       — create a new support ticket
  GET  /api/help/tickets/      — list all tickets for the authenticated user
  GET  /api/help/ticket/<id>/  — retrieve a single ticket
"""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SupportTicket
from .serializers import SupportTicketSerializer


# ─── Static FAQ Data ──────────────────────────────────────────────────────────
FAQ_LIST = [
    {
        "id": 1,
        "category": "Authentication",
        "question": "How do I reset my password?",
        "answer": (
            "Navigate to Settings → Security, enter your current password and "
            "your new password in the provided fields, then click 'Change Password'. "
            "If you have forgotten your current password, contact your system administrator."
        ),
    },
    {
        "id": 2,
        "category": "Predictions",
        "question": "How does the AI drug prediction engine work?",
        "answer": (
            "The MedAI engine uses a trained machine-learning model built on "
            "clinical condition data to recommend the most appropriate drug therapy. "
            "Enter the patient's symptoms and existing conditions, then submit. "
            "Results appear within seconds on the Predictions queue page."
        ),
    },
    {
        "id": 3,
        "category": "Predictions",
        "question": "What do the confidence scores mean?",
        "answer": (
            "The confidence score (0–100%) represents the model's statistical certainty "
            "in its recommendation. Scores above 80% are considered high confidence; "
            "scores below 60% should prompt additional clinical review before prescribing."
        ),
    },
    {
        "id": 6,
        "category": "Patients",
        "question": "How do I add a new patient?",
        "answer": (
            "Open the Patients section and click '+ New Patient'. Fill in the required "
            "fields (name, age, gender), add any active conditions and current medications, "
            "then click Save. The patient record will immediately be available for "
            "prediction workflows."
        ),
    },
    {
        "id": 7,
        "category": "Data & Privacy",
        "question": "Is patient data encrypted?",
        "answer": (
            "Yes. All data in transit is encrypted via TLS 1.2+. At rest, the PostgreSQL "
            "database supports column-level encryption for sensitive fields. Access to "
            "patient records is restricted to authenticated staff only, and all actions "
            "are logged for audit purposes."
        ),
    },
    {
        "id": 8,
        "category": "Account",
        "question": "How do I change my display theme?",
        "answer": (
            "Go to Settings → Preferences and toggle between Light and Dark themes. "
            "Your preference is saved to your profile and persists across sessions."
        ),
    },
    {
        "id": 9,
        "category": "Technical",
        "question": "The prediction is stuck in 'Running' status — what should I do?",
        "answer": (
            "Refresh the Predictions queue page after 30 seconds. If the status has "
            "not updated, click the Retry button on the prediction card. If the problem "
            "persists, submit a support ticket using the form below and include the "
            "Prediction ID shown on the card."
        ),
    },
    {
        "id": 10,
        "category": "Technical",
        "question": "Which browsers are supported?",
        "answer": (
            "MedAI is optimised for the latest versions of Google Chrome, Mozilla Firefox, "
            "Microsoft Edge, and Safari. Internet Explorer is not supported. "
            "For the best experience keep your browser up to date."
        ),
    },
]


class FAQListView(APIView):
    """GET /api/help/faq/ — returns static FAQ content."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(FAQ_LIST)


class TicketCreateView(APIView):
    """POST /api/help/ticket/ — create a new support ticket."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SupportTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TicketListView(APIView):
    """GET /api/help/tickets/ — list all tickets for the current user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tickets = SupportTicket.objects.filter(user=request.user).order_by("-created_at")
        return Response(SupportTicketSerializer(tickets, many=True).data)


class TicketDetailView(APIView):
    """GET /api/help/ticket/<id>/ — retrieve a single ticket."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            ticket = SupportTicket.objects.get(pk=pk, user=request.user)
        except SupportTicket.DoesNotExist:
            return Response(
                {"detail": "Ticket not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(SupportTicketSerializer(ticket).data)
