from rest_framework import serializers
from .models import SupportTicket


class SupportTicketSerializer(serializers.ModelSerializer):
    user_id = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "user_id",
            "username",
            "title",
            "description",
            "status",
            "category",
            "priority",
            "browser",
            "os",
            "steps_to_reproduce",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "user_id", "username", "status"]

    def get_user_id(self, obj):
        return str(obj.user.id)

    def get_username(self, obj):
        return obj.user.username
