from django.urls import path
from .views import (
    LoginView,
    LogoutView,
    TokenRefreshView,
    RegisterView,
    ProfileView,
    SettingsView,
    ChangePasswordView,
)

urlpatterns = [
    # Auth
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),

    # Profile
    path("profile/", ProfileView.as_view(), name="profile"),

    # Settings
    path("settings/", SettingsView.as_view(), name="settings"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
]
