"""Define un backend SMTP adaptado a Gmail con tolerancia a fallos TLS."""

import logging
import ssl

import certifi
from django.core.mail.backends.smtp import EmailBackend

logger = logging.getLogger(__name__)


class GmailTLSBackend(EmailBackend):
    """Envía correos usando SSL directo y conmutación ante errores de certificado."""

    def __init__(self, *args, **kwargs):
        """Inicializa la conexión forzando SSL y validación con el bundle de certifi."""
        self._fallback_tried = False
        kwargs.setdefault("use_tls", False)
        kwargs.setdefault("use_ssl", True)
        kwargs.setdefault("port", 465)
        kwargs.setdefault("ssl_context", ssl.create_default_context(cafile=certifi.where()))
        super().__init__(*args, **kwargs)

    def open(self):
        """Abre la sesión SMTP y aplica un contexto inseguro si la verificación falla."""
        try:
            return super().open()
        except ssl.SSLCertVerificationError as exc:
            if self._fallback_tried:
                raise
            logger.warning(
                "Fallo al verificar el certificado TLS del SMTP (%s). "
                "Intentando nuevamente sin verificación para no bloquear el OTP.",
                exc,
            )
            insecure = ssl._create_unverified_context()
            insecure.check_hostname = False
            insecure.verify_mode = ssl.CERT_NONE
            self.ssl_context = insecure
            self._fallback_tried = True
            return super().open()
