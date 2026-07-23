from django.contrib import admin
from django.contrib.auth.admin import UserAdmin


from .models import User, UserSettings

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    pass


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    pass