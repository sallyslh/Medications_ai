from django.urls import path
from .views import FAQListView, TicketCreateView, TicketListView, TicketDetailView

urlpatterns = [
    path("help/faq/", FAQListView.as_view(), name="faq-list"),
    path("help/ticket/", TicketCreateView.as_view(), name="ticket-create"),
    path("help/tickets/", TicketListView.as_view(), name="ticket-list"),
    path("help/ticket/<uuid:pk>/", TicketDetailView.as_view(), name="ticket-detail"),
]
