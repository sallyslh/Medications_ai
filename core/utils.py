"""
Utility helpers for MedAI backend.
Provides a custom DRF exception handler that normalises all error
responses to a consistent { "detail": "..." } shape so the React
frontend can rely on a single error-reading path.
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """
    Wraps DRF's default exception handler.
    - Ensures all error bodies include a top-level `detail` key.
    - Maps unexpected exceptions to a 500 payload instead of crashing.
    """
    response = exception_handler(exc, context)

    if response is not None:
        # Normalise list-of-error dicts (e.g. from serializer validation)
        data = response.data
        if isinstance(data, dict) and "detail" not in data:
            # Flatten field-level errors into a single message string
            messages = []
            for field, errors in data.items():
                if isinstance(errors, list):
                    for err in errors:
                        messages.append(f"{field}: {err}")
                else:
                    messages.append(f"{field}: {errors}")
            response.data = {"detail": " | ".join(messages)}
        elif isinstance(data, list):
            response.data = {"detail": " | ".join(str(e) for e in data)}

    return response
