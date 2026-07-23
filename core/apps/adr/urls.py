from django.urls import path
from .views import ADRCheckView, ADRHistoryView

urlpatterns = [
    path("adr/check/", ADRCheckView.as_view(), name="adr-check"),
    path("adr/history/", ADRHistoryView.as_view(), name="adr-history"),
]
