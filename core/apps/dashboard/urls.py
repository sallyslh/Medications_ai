from django.urls import path
from .views import DashboardView, SystemStatusView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("system/status/", SystemStatusView.as_view(), name="system-status"),
]
