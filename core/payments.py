import logging
import os
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Optional, Tuple

import requests
from django.conf import settings
from django.core.cache import cache
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

ZERO_DECIMAL_CURRENCIES = {
    "BIF",
    "CLP",
    "DJF",
    "GNF",
    "JPY",
    "KMF",
    "KRW",
    "MGA",
    "PYG",
    "RWF",
    "UGX",
    "VND",
    "VUV",
    "XAF",
    "XOF",
    "XPF",
}


class PayPalError(Exception):
    """Error controlado para flujos PayPal."""


def get_paypal_currencies() -> Tuple[str, str]:
    tienda = getattr(settings, "PAYPAL_CURRENCY", "CLP").strip().upper() or "CLP"
    orden = getattr(settings, "PAYPAL_ORDER_CURRENCY", tienda).strip().upper() or tienda
    return tienda, orden


def get_paypal_conversion_rate(force_refresh: bool = False) -> Tuple[Decimal, bool]:
    """
    Retorna la tasa configurada (moneda tienda por moneda de cobro) y un flag indicando
    si se usó el valor de respaldo manual.
    """
    tienda, orden = get_paypal_currencies()
    if tienda == orden:
        return Decimal("1"), False

    cache_key = f"paypal:conversion:{orden}:{tienda}"
    if not force_refresh:
        cached = cache.get(cache_key)
        if cached is not None:
            try:
                rate = Decimal(str(cached))
                if rate > 0:
                    return rate, False
            except (InvalidOperation, TypeError):
                pass

    url = getattr(settings, "PAYPAL_CONVERSION_API", "https://api.exchangerate.host/convert")
    timeout = getattr(settings, "PAYPAL_CONVERSION_TIMEOUT", 8)
    try:
        response = requests.get(
            url,
            params={"from": orden, "to": tienda, "amount": 1},
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()
        result = data.get("result")
        if result:
            rate = Decimal(str(result))
            if rate > 0:
                cache.set(
                    cache_key,
                    str(rate),
                    getattr(settings, "PAYPAL_CONVERSION_CACHE_SECONDS", 6 * 60 * 60),
                )
                return rate, False
    except requests.RequestException as exc:
        logger.warning("No se pudo actualizar la tasa PayPal %s/%s: %s", orden, tienda, exc)

    fallback = getattr(settings, "PAYPAL_CONVERSION_RATE", Decimal("1"))
    if fallback <= 0:
        fallback = Decimal("1")
    return fallback, True


def paypal_conversion_summary(total: Decimal) -> dict:
    moneda_tienda, moneda_orden = get_paypal_currencies()
    conversion_rate, used_fallback = get_paypal_conversion_rate()
    uses_conversion = (moneda_orden != moneda_tienda) or (conversion_rate != Decimal("1"))
    order_estimate = None
    if uses_conversion and conversion_rate not in (None, Decimal("0")):
        try:
            order_step_ctx = paypal_amount_step(moneda_orden)
            order_estimate = (total / conversion_rate).quantize(order_step_ctx)
        except (InvalidOperation, ZeroDivisionError):
            order_estimate = None
    try:
        rate_display = format(conversion_rate, "f")
        if "." in rate_display:
            rate_display = rate_display.rstrip("0").rstrip(".")
    except Exception:
        rate_display = str(conversion_rate)
    return {
        "paypal_currency": moneda_tienda,
        "paypal_order_currency": moneda_orden,
        "paypal_conversion_rate": conversion_rate,
        "paypal_conversion_rate_display": rate_display,
        "paypal_order_estimate": order_estimate,
        "paypal_uses_conversion": uses_conversion,
        "paypal_conversion_is_fallback": used_fallback,
    }


def normalize_paypal_totals(
    total: Decimal,
    *,
    conversion_rate: Optional[Decimal] = None,
    store_currency: Optional[str] = None,
    order_currency: Optional[str] = None,
) -> Tuple[Decimal, Decimal]:
    """
    Normaliza el total según la moneda de la tienda y calcula el monto que se enviará a PayPal.
    Devuelve una tupla (total_normalizado_tienda, total_en_moneda_paypal).
    """
    tienda = (store_currency or getattr(settings, "PAYPAL_CURRENCY", "CLP")).upper()
    orden = (order_currency or getattr(settings, "PAYPAL_ORDER_CURRENCY", tienda)).upper()
    conversion_rate = conversion_rate if conversion_rate is not None else get_paypal_conversion_rate()[0]

    paso_tienda = paypal_amount_step(tienda)
    try:
        total_normalizado = total.quantize(paso_tienda)
    except InvalidOperation:
        total_normalizado = (total / paso_tienda).to_integral_value() * paso_tienda

    total_paypal = total_normalizado
    paso_orden = paypal_amount_step(orden)
    if conversion_rate and conversion_rate != Decimal("1"):
        if conversion_rate <= 0:
            raise PayPalError("La tasa de conversión configurada para PayPal es inválida.")
        try:
            total_paypal = (total_normalizado / conversion_rate).quantize(paso_orden)
        except InvalidOperation:
            total_paypal = (total_normalizado / conversion_rate).quantize(paso_orden, rounding=ROUND_HALF_UP)
    elif orden != tienda:
        try:
            total_paypal = total_normalizado.quantize(paso_orden)
        except InvalidOperation:
            total_paypal = total_normalizado.quantize(paso_orden, rounding=ROUND_HALF_UP)

    return total_normalizado, total_paypal


@dataclass
class PayPalCaptureResult:
    order_id: str
    status: str
    capture_id: Optional[str]
    amount: Optional[Decimal]
    currency: Optional[str]


def _ensure_paypal_credentials() -> Tuple[str, str]:
    client_id = (getattr(settings, "PAYPAL_CLIENT_ID", "") or "").strip()
    client_secret = (getattr(settings, "PAYPAL_CLIENT_SECRET", "") or "").strip()
    if client_id and client_secret:
        return client_id, client_secret

    base_dir = getattr(settings, "BASE_DIR", None)
    if base_dir:
        env_path = os.path.join(base_dir, ".env")
        if os.path.exists(env_path):
            load_dotenv(env_path, override=True)
            client_id = (os.environ.get("PAYPAL_CLIENT_ID", "") or "").strip()
            client_secret = (os.environ.get("PAYPAL_CLIENT_SECRET", "") or "").strip()
            if client_id and client_secret:
                settings.PAYPAL_CLIENT_ID = client_id
                settings.PAYPAL_CLIENT_SECRET = client_secret
                return client_id, client_secret
    return client_id, client_secret


def _paypal_api_base() -> str:
    base = getattr(settings, "PAYPAL_API_BASE", "").strip()
    if base:
        return base
    mode = getattr(settings, "PAYPAL_MODE", "") or os.environ.get("PAYPAL_MODE", "")
    if (mode or "").lower() == "live":
        return "https://api-m.paypal.com"
    return "https://api-m.sandbox.paypal.com"


def paypal_is_configured() -> Tuple[bool, Optional[str]]:
    client_id, client_secret = _ensure_paypal_credentials()
    if not client_id or not client_secret:
        return (
            False,
            "La pasarela de pago no está configurada. Define PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET.",
        )
    return True, None


def paypal_amount_step(currency: Optional[str]) -> Decimal:
    """
    Devuelve la resolución mínima permitida para la moneda indicada.
    """
    code = (currency or "").upper()
    return Decimal("1") if code in ZERO_DECIMAL_CURRENCIES else Decimal("0.01")


def paypal_format_amount(amount: Decimal, currency: Optional[str]) -> str:
    """
    Convierte un Decimal a string en el formato esperado por PayPal.
    """
    step = paypal_amount_step(currency)
    quantized = amount.quantize(step)
    if step == Decimal("1"):
        return str(int(quantized))
    return format(quantized, "f")


def _paypal_access_token() -> str:
    ok, error = paypal_is_configured()
    if not ok:
        raise PayPalError(error or "Configuración PayPal incompleta.")
    client_id, client_secret = _ensure_paypal_credentials()
    url = f"{_paypal_api_base()}/v1/oauth2/token"
    try:
        response = requests.post(
            url,
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={
                "Accept": "application/json",
                "Accept-Language": "es-CL",
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        logger.exception("No se pudo contactar a PayPal para obtener token: %s", exc)
        raise PayPalError("No se pudo establecer conexión con PayPal. Inténtalo nuevamente.") from exc

    if response.status_code != 200:
        logger.error(
            "Respuesta inesperada PayPal token (%s): %s", response.status_code, response.text
        )
        raise PayPalError("PayPal rechazó la autenticación. Revisa tus credenciales.")

    data = response.json()
    token = data.get("access_token")
    if not token:
        logger.error("PayPal no devolvió access_token: %s", data)
        raise PayPalError("No se recibió el token de acceso de PayPal.")
    return token


def paypal_create_order(
    amount: Decimal,
    currency: str,
    *,
    shipping: Optional[dict] = None,
    reference: Optional[str] = None,
) -> str:
    """
    amount debe ir en la moneda de cobro (USD, CLP, etc).
    """
    if amount <= 0:
        raise PayPalError("El monto debe ser mayor a cero.")

    token = _paypal_access_token()
    base = _paypal_api_base()
    create_order_url = f"{base}/v2/checkout/orders"
    body = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": reference or "ORD-EPIC",
                "amount": {
                    "currency_code": currency,
                    "value": paypal_format_amount(amount, currency),
                },
            }
        ],
    }

    if shipping:
        body["purchase_units"][0]["shipping"] = shipping

    try:
        response = requests.post(
            create_order_url,
            json=body,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        logger.exception("Error al crear orden PayPal: %s", exc)
        raise PayPalError("No se pudo crear la orden en PayPal.") from exc

    if response.status_code not in (200, 201):
        logger.error("PayPal rechazó la orden (%s): %s", response.status_code, response.text)
        raise PayPalError("PayPal rechazó la creación de la orden.")

    data = response.json()
    order_id = data.get("id")
    if not order_id:
        logger.error("PayPal devolvió una respuesta sin id de orden: %s", data)
        raise PayPalError("No se recibió la orden de PayPal.")
    return order_id


def paypal_capture_order(
    order_id: str,
    *,
    expected_amount: Optional[Decimal] = None,
    expected_currency: Optional[str] = None,
) -> PayPalCaptureResult:
    if not order_id:
        raise PayPalError("Identificador de orden PayPal inválido.")

    token = _paypal_access_token()
    base = _paypal_api_base()
    capture_url = f"{base}/v2/checkout/orders/{order_id}/capture"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation",
    }

    try:
        response = requests.post(capture_url, headers=headers, timeout=20)
    except requests.RequestException as exc:
        logger.exception("Error al capturar orden PayPal %s: %s", order_id, exc)
        raise PayPalError("No se pudo capturar el pago en PayPal.") from exc

    if response.status_code in (200, 201):
        data = response.json()
    else:
        data = response.json() if response.headers.get("Content-Type", "").startswith("application/json") else {}
        # Orden ya capturada previamente
        if response.status_code == 422 and data.get("name") == "ORDER_ALREADY_CAPTURED":
            logger.info("Orden PayPal %s ya estaba capturada, consultando estado.", order_id)
            data = _paypal_fetch_order(order_id, token, base)
        else:
            logger.error(
                "Fallo al capturar orden PayPal %s (%s): %s",
                order_id,
                response.status_code,
                response.text,
            )
            raise PayPalError("PayPal rechazó la captura del pago.")

    status = data.get("status")
    if status != "COMPLETED":
        logger.warning("Orden PayPal %s con estado no completado: %s", order_id, status)
        raise PayPalError("El pago no fue completado en PayPal.")

    capture_id = None
    amount = None
    currency = None
    for purchase_unit in data.get("purchase_units", []):
        payments = purchase_unit.get("payments") or {}
        captures = payments.get("captures") or []
        for capture in captures:
            if not capture_id:
                capture_id = capture.get("id")
            amount_info = capture.get("amount") or {}
            value = amount_info.get("value")
            currency_code = amount_info.get("currency_code")
            if value is not None and amount is None:
                try:
                    amount = Decimal(value)
                except (InvalidOperation, TypeError):
                    amount = None
            if currency_code and not currency:
                currency = currency_code

    if expected_currency and currency and expected_currency.upper() != currency.upper():
        logger.error(
            "Moneda inesperada en orden PayPal %s: %s (esperado %s)",
            order_id,
            currency,
            expected_currency,
        )
        raise PayPalError("La moneda cobrada no coincide con la configuración de la tienda.")

    if expected_amount is not None and amount is not None:
        step = paypal_amount_step(expected_currency)
        try:
            normalized_paypal = amount.quantize(step)
            normalized_expected = expected_amount.quantize(step)
            if normalized_paypal != normalized_expected:
                logger.error(
                    "Monto capturado distinto al esperado (PayPal %s): %s vs %s",
                    order_id,
                    normalized_paypal,
                    normalized_expected,
                )
                raise PayPalError("El monto cobrado en PayPal no coincide con el total del carrito.")
        except InvalidOperation:
            pass

    return PayPalCaptureResult(
        order_id=order_id,
        status=status,
        capture_id=capture_id,
        amount=amount,
        currency=currency,
    )


def _paypal_fetch_order(order_id: str, token: str, base: str) -> dict:
    url = f"{base}/v2/checkout/orders/{order_id}"
    try:
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
            timeout=15,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.exception("No se pudo consultar la orden PayPal %s: %s", order_id, exc)
        raise PayPalError("No se pudo verificar el estado del pago en PayPal.") from exc
    return response.json()
