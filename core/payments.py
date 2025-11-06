import logging
import os
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Optional, Tuple

import requests
from django.conf import settings

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


@dataclass
class PayPalCaptureResult:
    order_id: str
    status: str
    capture_id: Optional[str]
    amount: Optional[Decimal]
    currency: Optional[str]


def _paypal_api_base() -> str:
    base = getattr(settings, "PAYPAL_API_BASE", "").strip()
    if base:
        return base
    mode = getattr(settings, "PAYPAL_MODE", "") or os.environ.get("PAYPAL_MODE", "")
    if (mode or "").lower() == "live":
        return "https://api-m.paypal.com"
    return "https://api-m.sandbox.paypal.com"


def paypal_is_configured() -> Tuple[bool, Optional[str]]:
    client_id = (getattr(settings, "PAYPAL_CLIENT_ID", "") or "").strip()
    client_secret = (getattr(settings, "PAYPAL_CLIENT_SECRET", "") or "").strip()
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
    client_id = settings.PAYPAL_CLIENT_ID.strip()
    client_secret = settings.PAYPAL_CLIENT_SECRET.strip()
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
    Crea una orden en PayPal y devuelve su ID.
    """
    if amount <= 0:
        raise PayPalError("El total a pagar debe ser mayor a cero.")

    token = _paypal_access_token()
    base = _paypal_api_base()
    create_url = f"{base}/v2/checkout/orders"

    amount_value = paypal_format_amount(amount, currency)
    purchase_unit: dict = {
        "amount": {
            "currency_code": (currency or "USD").upper(),
            "value": amount_value,
        }
    }
    if reference:
        purchase_unit["reference_id"] = reference[:127]
    if shipping:
        purchase_unit["shipping"] = shipping

    body = {
        "intent": "CAPTURE",
        "purchase_units": [purchase_unit],
        "application_context": {
            "shipping_preference": "SET_PROVIDED_ADDRESS" if shipping else "NO_SHIPPING",
            "user_action": "PAY_NOW",
        },
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation",
    }
    try:
        response = requests.post(create_url, json=body, headers=headers, timeout=20)
    except requests.RequestException as exc:
        logger.exception("Error al crear orden PayPal: %s", exc)
        raise PayPalError("No se pudo crear la orden de pago en PayPal.") from exc

    if response.status_code not in (201,):
        logger.error(
            "Fallo al crear orden PayPal (%s): %s", response.status_code, response.text
        )
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
