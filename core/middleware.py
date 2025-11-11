"""Incluye middleware para registrar la última actividad de usuarios autenticados."""

from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import get_user_model


class LastSeenMiddleware(MiddlewareMixin):
    """Actualiza el campo `last_login` con un intervalo mínimo entre escrituras."""

    min_delta_seconds = 30

    def process_request(self, request):
        """Marca la actividad del usuario cuando supera el intervalo configurado."""
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None

        now = timezone.now()
        try:
            last_seen = float(request.session.get("_last_seen_ts", "0"))
        except (TypeError, ValueError):
            last_seen = 0.0

        if now.timestamp() - last_seen < self.min_delta_seconds:
            return None

        request.session["_last_seen_ts"] = str(now.timestamp())
        # Realiza una actualización directa para evitar cargar el modelo en memoria.
        UserModel = get_user_model()
        if getattr(user, 'pk', None):
            UserModel.objects.filter(pk=user.pk).update(last_login=now)
        return None
