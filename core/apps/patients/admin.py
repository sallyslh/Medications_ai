from django.contrib import admin
from .models import Patient

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = (
    "id",
    "patient_id",
    "full_name",
    "age",
    "gender",
    "conditions",
    "current_drugs",
    "created_at",
    "updated_at",
    )

#@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = "__str__"