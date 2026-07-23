from django.contrib import admin
from .models import ADRReport


@admin.register(ADRReport)
class ADRReportAdmin(admin.ModelAdmin):
    list_display = ("id", "patient_name", "doctor_name", "risk_level", "is_manual", "created_at")
    list_filter = ("risk_level", "is_manual")
