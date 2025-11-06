from django.contrib import admin
from django.urls import path
from django.shortcuts import render, redirect
from django.utils import timezone
from datetime import timedelta
import random
from django.contrib.auth.models import User
from .models import (
    Vendedor,
    Producto,
    Venta,
    Compra,
    PerfilCliente,
    DashboardMetricas,
    PostulacionVendedor,
    NewsletterSubscriber,
)

@admin.register(Vendedor)
class VendedorAdmin(admin.ModelAdmin):
    list_display = ("usuario", "telefono", "fecha_ingreso")
    search_fields = ("usuario__username",)

@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = (
        "nombre",
        "descripcion",
        "marca",
        "precio",
        "existencias",
        "categoria",
        "fecha_ingreso"
        )
    search_fields = ("nombre", "marca", "categoria")
    list_filter = ("categoria", "calidad")

@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ("vendedor", "producto", "cantidad", "total", "fecha_venta")
    search_fields = ("vendedor__usuario__username", "producto__nombre")
    list_filter = ("fecha_venta",)

@admin.register(Compra)
class CompraAdmin(admin.ModelAdmin):
    list_display = ("cliente", "producto", "valor_producto", "cantidad", "fecha_compra")
    search_fields = ("cliente",)
    list_filter = ("fecha_compra",)

    # Agrega una vista personalizada para simular compras desde el admin
    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                'simular/',
                self.admin_site.admin_view(self.simular_view),
                name='core_compra_simular',
            ),
        ]
        return custom + urls

    def simular_view(self, request):
        if request.method == 'POST':
            try:
                n = max(1, int(request.POST.get('n', 20)))
            except (TypeError, ValueError):
                n = 20
            try:
                days = max(1, min(365, int(request.POST.get('days', 90))))
            except (TypeError, ValueError):
                days = 90
            try:
                min_qty = max(1, int(request.POST.get('min_qty', 1)))
            except (TypeError, ValueError):
                min_qty = 1
            try:
                max_qty = max(min_qty, int(request.POST.get('max_qty', 3)))
            except (TypeError, ValueError):
                max_qty = max(3, min_qty)

            productos = list(Producto.objects.all())
            usuarios = list(User.objects.filter(is_active=True))

            if productos and usuarios:
                hoy = timezone.localdate()
                for _ in range(n):
                    p = random.choice(productos)
                    u = random.choice(usuarios)
                    qty = random.randint(min_qty, max_qty)
                    fecha = hoy - timedelta(days=random.randint(0, max(0, days - 1)))
                    # Simula la compra del usuario (para dashboards de usuarios)
                    Compra.objects.create(
                        cliente=u.username,
                        usuario=u,
                        producto=p,
                        valor_producto=p.precio,
                        cantidad=qty,
                        fecha_compra=fecha,
                    )
                    # Además, si el producto pertenece a un vendedor, reflejar la venta del vendedor
                    if getattr(p, 'vendedor', None):
                        try:
                            Venta.objects.create(
                                vendedor=p.vendedor,
                                producto=p,
                                cantidad=qty,
                                fecha_venta=fecha,
                            )
                        except Exception:
                            pass
                    # Ajusta stock simulando una compra real
                    try:
                        nuevo_stock = max(0, int(p.existencias or 0) - int(qty))
                        if nuevo_stock != p.existencias:
                            p.existencias = nuevo_stock
                            p.save(update_fields=['existencias'])
                    except Exception:
                        pass
                return redirect('admin:core_compra_changelist')

        # GET o falta de datos -> renderiza formulario
        context = { **self.admin_site.each_context(request) }
        return render(request, 'admin/core/compra/simular.html', context)


@admin.register(PerfilCliente)
class PerfilClienteAdmin(admin.ModelAdmin):
    list_display = ("user", "nombre", "email", "telefono", "ciudad", "pais", "actualizado")
    search_fields = ("user__username", "email", "nombre")

@admin.register(DashboardMetricas)
class DashboardMetricasAdmin(admin.ModelAdmin):
    list_display = ("fecha", "total_ventas", "total_productos", "total_vendedores", "total_clientes")
    list_filter = ("fecha",)

@admin.register(PostulacionVendedor)
class PostulacionVendedorAdmin(admin.ModelAdmin):
    list_display = ("nombre", "email", "telefono", "tienda", "fecha_envio", "estado")
    search_fields = ("nombre", "email", "tienda")
    list_filter = ("estado", "fecha_envio")


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ("email", "fecha_suscripcion")
    search_fields = ("email",)
