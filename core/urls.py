"""
MedAI Root URL Configuration
All /api/ routes are dispatched from here to their respective app routers.
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    # Django admin (keep available for superuser management)
    path("admin/", admin.site.urls),

    # ── Authentication ────────────────────────────────────────────────────────
    path("api/", include("core.apps.accounts.urls")),

    # ── Patients ──────────────────────────────────────────────────────────────
    path("api/", include("core.apps.patients.urls")),

    # ── Drug Predictions ──────────────────────────────────────────────────────
    path("api/", include("core.apps.predictions.urls")),

    # ── Dashboard ─────────────────────────────────────────────────────────────
    path("api/", include("core.apps.dashboard.urls")),

    # ── Settings & Help / Support ─────────────────────────────────────────────
    path("api/", include("core.apps.support.urls")),

    # ── Adverse Drug Reaction (ADR) Analysis ──────────────────────────────────
    path("api/", include("core.apps.adr.urls")),
]
