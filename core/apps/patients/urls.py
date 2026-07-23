from django.urls import path
from .views import PatientListCreateView, PatientDetailView

urlpatterns = [
    path("patients/", PatientListCreateView.as_view(), name="patient-list-create"),
    path("patients/<uuid:pk>/", PatientDetailView.as_view(), name="patient-detail"),
]
