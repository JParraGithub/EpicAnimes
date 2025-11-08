import logging
import ssl

import certifi
from django.core.mail.backends.smtp import EmailBackend

logger = logging.getLogger(__name__)


class GmailTLSBackend(EmailBackend):
    """
    SMTP backend que usa conexión SSL directa (puerto 465) para Gmail, con bundle de certifi
    y fallback sin verificación cuando el entorno bloquea la cadena TLS.
    """

    def __init__(self, *args, **kwargs):
        self._fallback_tried = False
        kwargs.setdefault("use_tls", False)
        kwargs.setdefault("use_ssl", True)
        kwargs.setdefault("port", 465)
        kwargs.setdefault("ssl_context", ssl.create_default_context(cafile=certifi.where()))
        super().__init__(*args, **kwargs)

    def open(self):
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
