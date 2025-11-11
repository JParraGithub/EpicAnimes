"""Endpoints de stock crítico del vendedor (separados de views.py para claridad).

Expone:
- api_vendedor_stock_resumen: KPI de stock con umbral configurable y envío de correo.
- api_vendedor_stock_set_umbral: guarda el umbral (3 o 5) en sesión del vendedor.
"""

from datetime import timedelta
import json

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.mail import send_mail
from django.http import JsonResponse, HttpResponseForbidden
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .models import Vendedor, Producto


@login_required
@require_http_methods(["POST"])
def api_vendedor_stock_set_umbral(request):
    """Guarda el umbral (3 o 5) en la sesión del vendedor actual."""
    vendedor = Vendedor.objects.filter(usuario=request.user).first()
    if not vendedor:
        return JsonResponse({"ok": False, "error": "no_vendor"}, status=400)
    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        data = {}
    try:
        valor = int(data.get("umbral"))
    except Exception:
        valor = None
    if valor not in (3, 5):
        return JsonResponse({"ok": False, "error": "invalid_umbral"}, status=400)
    request.session[f"stock_umbral_{vendedor.id}"] = valor
    request.session.modified = True
    return JsonResponse({"ok": True, "umbral": valor})


@login_required
@require_http_methods(["GET"])
def api_vendedor_stock_resumen(request):
    """Resumen de stock del vendedor con umbral y alerta por correo.

    - Usa umbral (3 o 5) guardado en sesión; por defecto 5.
    - Envia correo 1 vez cada 12h cuando existan productos bajo el umbral.
    - Devuelve "umbral" y "alerta_reciente" para el banner del frontend.
    """
    vendedor = Vendedor.objects.filter(usuario=request.user).first()
    if not vendedor:
        return HttpResponseForbidden("No es vendedor")

    # Umbral
    try:
        umbral = int(request.session.get(f"stock_umbral_{vendedor.id}", 5))
        if umbral not in (3, 5):
            umbral = 5
    except Exception:
        umbral = 5

    productos = (
        Producto.objects
        .filter(vendedor=vendedor)
        .only("id", "nombre", "categoria", "existencias", "precio")
    )

    valor_total = 0.0
    criticos = 0
    items_bajos = []
    for p in productos:
        e = int(p.existencias or 0)
        valor_total += float(p.precio or 0) * e
        if e <= umbral:
            criticos += 1
            items_bajos.append({
                "id": p.id,
                "nombre": p.nombre,
                "categoria": p.categoria,
                "existencias": e,
            })

    items_bajos.sort(key=lambda x: (x["existencias"], x["nombre"]))
    items = items_bajos[:50]

    # Correo con anti-ruido 12h
    alerta_reciente = False
    if criticos > 0:
        try:
            user = getattr(vendedor, "usuario", None)
            email = (getattr(user, "email", "") or "").strip()
            if email:
                key = f"stock_alert_ts_{vendedor.id}"
                now = timezone.now()
                last_iso = request.session.get(key)
                can_send = True
                if last_iso:
                    try:
                        last_dt = timezone.datetime.fromisoformat(last_iso)
                        if timezone.is_naive(last_dt):
                            last_dt = timezone.make_aware(last_dt, timezone=timezone.get_current_timezone())
                        delta = now - last_dt
                        can_send = delta >= timedelta(hours=12)
                        alerta_reciente = delta <= timedelta(hours=12)
                    except Exception:
                        can_send = True
                        alerta_reciente = False
                if can_send:
                    asunto = "Alerta de stock bajo - EpicAnimes"
                    nombre = (getattr(user, "get_full_name", lambda: "")() or "").strip() or (
                        (getattr(user, "first_name", "") or "").strip() or user.username
                    )
                    lineas = [
                        f"Hola {nombre}.",
                        "",
                        f"🔔 Detectamos que algunos de tus productos presentan stock critico (<= {umbral} unidades):",
                        "",
                    ]
                    for it in items_bajos[:20]:
                        lineas.append(f"• {it['nombre']}  —  Categoria: {it['categoria'] or '-'}  —  Stock: {it['existencias']}")
                    if len(items_bajos) > 20:
                        lineas.append(f"... y {len(items_bajos) - 20} productos mas.")
                    lineas += [
                        "",
                        "📦  Te recomendamos revisar tu inventario lo antes posible.",
                        "",
                        "Accede a tu panel para reponerlos:",
                    ]
                    try:
                        url = request.build_absolute_uri(reverse('dashboard_vendedor'))
                    except Exception:
                        url = "http://127.0.0.1:8000/dashboard_vendedor/"
                    lineas.append(url)
                    lineas += ["", "Gracias,", "Equipo EpicAnimes"]
                    cuerpo = "\n".join(lineas)
                    try:
                        send_mail(asunto, cuerpo, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=True)
                        request.session[key] = now.isoformat()
                        request.session.modified = True
                        alerta_reciente = True
                    except Exception as e:
                        print(f"Error al enviar correo: {e}")
        except Exception as e:
            print(f"Error general en alerta de stock: {e}")

    return JsonResponse({
        "valor_total": float(valor_total),
        "criticos": int(criticos),
        "items_bajos": items,
        "items": items,
        "umbral": int(umbral),
        "alerta_reciente": bool(alerta_reciente),
    })

