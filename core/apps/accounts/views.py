"""
Accounts Views
Handles JWT authentication, user profile, settings management,
and password changes.

Endpoints:
  POST /api/auth/login/
  POST /api/auth/logout/
  POST /api/auth/refresh/
  GET  /api/profile/
  GET  /api/settings/
  PUT  /api/settings/
  PUT  /api/change-password/
"""

from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import User, UserSettings
from .serializers import UserSerializer, UserSettingsSerializer, SettingsResponseSerializer


# ─── Authentication ───────────────────────────────────────────────────────────

class LoginView(APIView):
    """
    POST /api/auth/login/
    Accepts { username, password }.
    Returns { access, refresh, user }.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")

        if not username or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Support login by email OR username
        user = None
        if "@" in username:
            try:
                u = User.objects.get(email__iexact=username)
                user = authenticate(request, username=u.username, password=password)
            except User.DoesNotExist:
                pass
        else:
            user = authenticate(request, username=username, password=password)

        if user is None:
            return Response(
                {"detail": "Invalid credentials. Please check your username and password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {"detail": "This account has been deactivated."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Issue JWT pair
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Accepts { refresh } token and blacklists it.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required for logout."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            # Token already expired or invalid — still treat as success
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class TokenRefreshView(APIView):
    """
    POST /api/auth/refresh/
    Accepts { refresh } and returns a new { access, refresh } pair.
    Implements rotation (new refresh token issued, old one blacklisted).
    """

    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            # Rotate: blacklist old, generate new pair
            new_access = str(token.access_token)
            token.blacklist()
            new_refresh = RefreshToken.for_user(token.payload["user_id"])  # type: ignore[arg-type]
        except TokenError as e:
            return Response(
                {"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED
            )
        return Response(
            {"access": new_access, "refresh": str(new_refresh)},
            status=status.HTTP_200_OK,
        )


# ─── Profile ──────────────────────────────────────────────────────────────────

class ProfileView(APIView):
    """GET /api/profile/ — Returns authenticated user's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ─── Settings ─────────────────────────────────────────────────────────────────

class SettingsView(APIView):
    """
    GET /api/settings/ — Returns { profile, preferences }.
    PUT /api/settings/ — Updates profile fields and/or preferences.
    """

    permission_classes = [IsAuthenticated]

    def _get_or_create_settings(self, user):
        settings, _ = UserSettings.objects.get_or_create(user=user)
        return settings

    def get(self, request):
        self._get_or_create_settings(request.user)
        serializer = SettingsResponseSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        user = request.user
        user_settings = self._get_or_create_settings(user)
        data = request.data

        # ── Update profile fields ──────────────────────────────────────────
        profile_data = data.get("profile", {})
        if profile_data:
            for field in ("first_name", "last_name", "email", "department"):
                if field in profile_data:
                    setattr(user, field, profile_data[field])
            user.save(update_fields=["first_name", "last_name", "email", "department", "updated_at"])

        # ── Update preferences ─────────────────────────────────────────────
        prefs = data.get("preferences", {})
        if prefs:
            if "language" in prefs:
                user_settings.language = prefs["language"]
            if "theme" in prefs:
                user_settings.theme = prefs["theme"]
            if "enableFaceRecognition" in prefs:
                user_settings.enable_face_recognition = prefs["enableFaceRecognition"]
            notifs = prefs.get("notifications", {})
            if "email" in notifs:
                user_settings.email_notifications = notifs["email"]
            if "highRiskAlerts" in notifs:
                user_settings.high_risk_alerts = notifs["highRiskAlerts"]
            if "weeklyDigest" in notifs:
                user_settings.weekly_digest = notifs["weeklyDigest"]
            user_settings.save()

        return Response({"success": True, "message": "Settings updated successfully."})


class ChangePasswordView(APIView):
    """PUT /api/change-password/ — Verifies current password and sets a new one."""

    permission_classes = [IsAuthenticated]

    def put(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")

        if not current_password or not new_password:
            return Response(
                {"detail": "Both current_password and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(current_password):
            return Response(
                {"detail": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "New password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save()
        return Response({"success": True, "message": "Password changed successfully."})


class RegisterView(APIView):
    """
    POST /api/auth/register/
    Creates a new clinical user account and returns a JWT pair.
    Accepts { username, email, password, role, department, first_name, last_name }.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        required = ["username", "email", "password", "first_name", "last_name"]
        for field in required:
            if not request.data.get(field, "").strip():
                return Response(
                    {"detail": f"{field} is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        username = request.data["username"].strip()
        email = request.data["email"].strip().lower()
        password = request.data["password"]
        role = request.data.get("role", "Doctor")
        department = request.data.get("department", "")
        first_name = request.data["first_name"].strip()
        last_name = request.data["last_name"].strip()

        if User.objects.filter(username__iexact=username).exists():
            return Response(
                {"detail": "A user with that username already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {"detail": "A user with that email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role=role,
            department=department,
            first_name=first_name,
            last_name=last_name,
        )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )
