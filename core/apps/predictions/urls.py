from django.urls import path
from .views import (
    PredictionQueueView,
    PredictionCreateView,
    PredictionDetailView,
    PredictionRetryView,
    DrugSelectView,
)

urlpatterns = [
    path("predictions/queue/", PredictionQueueView.as_view(), name="prediction-queue"),
    path("predictions/", PredictionCreateView.as_view(), name="prediction-create"),
    path("predictions/<uuid:pk>/", PredictionDetailView.as_view(), name="prediction-detail"),
    path("predictions/<uuid:pk>/retry/", PredictionRetryView.as_view(), name="prediction-retry"),
    path("predict/<uuid:pk>/select/", DrugSelectView.as_view(), name="drug-select"),
]
