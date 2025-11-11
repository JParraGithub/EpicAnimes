"""Define la configuración central del proyecto EpicAnimes y sus integraciones."""

from pathlib import Path
from decimal import Decimal, InvalidOperation
import os

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Carga las variables declaradas en .env para unificar credenciales locales.
load_dotenv(BASE_DIR / ".env")
SECRET_KEY = 'django-insecure-xib&5e3w-6x4dl+eao4vqke*l(@+blwru@!4h)m@zp)*to^*do'
DEBUG = True

ALLOWED_HOSTS = []


# Declara las aplicaciones instaladas que participan en el proyecto.
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'core.apps.CoreConfig',
]

# Define la cadena de middleware aplicada a cada solicitud.
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # Registra la última actividad del usuario para exponer estados en tiempo real.
    'core.middleware.LastSeenMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'EpicAnimes.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'EpicAnimes.wsgi.application'


# Configura la base de datos MySQL empleada en entornos locales.

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'epicanimes',
        'USER': 'root',
        'PASSWORD': '',  # Define la contraseña configurada en el equipo local.
        'HOST': '127.0.0.1',
        'PORT': '3306',
        'OPTIONS': {
            'charset': 'utf8mb4',
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}



# Aplica validaciones de seguridad para las contraseñas de los usuarios.

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'
    },
    {
        'NAME': 'core.validators.PasswordComplexityValidator',
        'OPTIONS': {
            'min_uppercase': 1,
            'min_lowercase': 1,
            'min_digits': 1,
            'min_symbols': 1,
        },
    },
]


# Configura el lenguaje y la zona horaria de la plataforma.

LANGUAGE_CODE = 'es-cl'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Gestiona los archivos estáticos y multimedia utilizados en el frontend.

STATIC_URL = '/static/'

# Definir STATIC_ROOT al desplegar en producción, por ejemplo:
# STATIC_ROOT = os.path.join(BASE_DIR, 'production_static')

STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]

MEDIA_URL = '/media/'

MEDIA_ROOT = os.path.join(BASE_DIR, "media")

LOGIN_REDIRECT_URL = '/accounts/profile/'
LOGOUT_REDIRECT_URL = '/index/'
LOGIN_URL = '/accounts/login/'

def _decimal_from_env(name: str, default: Decimal) -> Decimal:
    """Obtiene un decimal desde el entorno y recurre a un valor predeterminado si falla."""
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError):
        return default


# Define parámetros de integración con PayPal y conversión de moneda.
DEFAULT_PAYPAL_CLIENT_ID = "Ab01_QyLiiJGCfRl3_4Bt_-WUJZADm5bJJ8vFRVqmwyUNyUIHYmKQqrubfrZq5mn6O-zZoJ0CQCX6tAU"
DEFAULT_PAYPAL_CLIENT_SECRET = "EJRVuzIHBG3J49Z2QjJPVXtcrbWGrQEaY4-hEBtlhHQA9d4kc6mhiwQBImU2kSBD4xx0xxLE03vmI3DW"

PAYPAL_CLIENT_ID = (os.environ.get("PAYPAL_CLIENT_ID") or DEFAULT_PAYPAL_CLIENT_ID).strip()
PAYPAL_CLIENT_SECRET = (os.environ.get("PAYPAL_CLIENT_SECRET") or DEFAULT_PAYPAL_CLIENT_SECRET).strip()
PAYPAL_MODE = (os.environ.get("PAYPAL_MODE") or "sandbox").strip().lower() or "sandbox"
PAYPAL_API_BASE = os.environ.get("PAYPAL_API_BASE", "").strip()
PAYPAL_CURRENCY = os.environ.get("PAYPAL_CURRENCY", "CLP").strip().upper() or "CLP"
_default_order_currency = os.environ.get("PAYPAL_ORDER_CURRENCY") or ("USD" if PAYPAL_CURRENCY != "USD" else "USD")
PAYPAL_ORDER_CURRENCY = _default_order_currency.strip().upper() or PAYPAL_CURRENCY
PAYPAL_CONVERSION_RATE = _decimal_from_env("PAYPAL_CONVERSION_RATE", Decimal("900"))
PAYPAL_CONVERSION_CACHE_SECONDS = int(os.environ.get("PAYPAL_CONVERSION_CACHE_SECONDS", 6 * 60 * 60))
PAYPAL_CONVERSION_API = os.environ.get("PAYPAL_CONVERSION_API", "https://api.exchangerate.host/convert").strip()
PAYPAL_CONVERSION_TIMEOUT = int(os.environ.get("PAYPAL_CONVERSION_TIMEOUT", 8))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Configura el backend de correo que utiliza la plataforma.
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_HOST_USER = 'miguelneira.albo@gmail.com'  # Identifica la casilla del bot epicanimes_bot_correos.
EMAIL_HOST_PASSWORD = 'zgzonkwvbixixqjn'
EMAIL_BACKEND = 'core.email_backends.GmailTLSBackend'
EMAIL_PORT = 465
EMAIL_USE_SSL = True
EMAIL_USE_TLS = False
DEFAULT_FROM_EMAIL = f'EpicAnimes <{EMAIL_HOST_USER}>'
SERVER_EMAIL = DEFAULT_FROM_EMAIL
