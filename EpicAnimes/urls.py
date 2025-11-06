# EpicAnimes/urls.py
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static

from core.views import (
    # PÃ¡ginas
    VistaIndex, VistaSobreNosotros, VistaContacto,
    VistaAdministrador, VistaVendedor,
    VistaRegistro, VistaCarrito, VistaProductoDetalle,
    agregar_al_carrito, actualizar_carrito,
    eliminar_del_carrito, paypal_crear_orden, finalizar_compra,
    carrito_gracias,
    newsletter_suscribir,
    api_chatbot_ask,

    # RedirecciÃ³n inteligente post-login
    redireccion_usuario,
    CoreLoginView,
    send_login_otp,

    # APIs VENDEDOR
    api_vendedor_resumen,
    # extensión con rango dinámico
    api_vendedor_resumen_ext,
    api_vendedor_stock_resumen,
    api_vendedor_producto_detalle,

    # APIs ADMIN (grÃ¡ficos/stock/CRUD)
    api_admin_ventas_por_vendedor,
    api_admin_clientes_actividad,
    api_admin_vendedores_estado,
    api_admin_usuarios_online,
    api_admin_top_productos_linea,
    api_admin_ventas_actividad,
    api_admin_ventas_por_usuario,
    api_admin_productos_bajo_stock,
    api_admin_producto_update_stock,
    api_admin_producto_detalle,
    api_admin_producto_update_full,
    api_admin_producto_delete,
    api_vendedor_producto_delete,
    api_admin_vendedores,
    api_admin_postulaciones,
    export_admin_postulaciones_csv,
    export_admin_ventas_csv,
    export_vendedor_inventario_csv,
    export_vendedor_ventas_csv,
    api_vendedor_importar,
    # Excel endpoints
    export_admin_postulaciones_xlsx,
    export_admin_ventas_xlsx,
    export_vendedor_inventario_xlsx,
    export_vendedor_ventas_xlsx,
    api_vendedor_importar_excel,
)

urlpatterns = [
    # Admin Django
    path('admin/', admin.site.urls),

    # Auth (login/logout/password reset, etc.)
    path('accounts/login/', CoreLoginView.as_view(), name='login'),
    path('accounts/send-otp/', send_login_otp, name='send_login_otp'),
    path('accounts/', include('django.contrib.auth.urls')),
    path('accounts/signup/', VistaRegistro, name='signup'),

    # Páginas públicas
    path('index/', VistaIndex, name='index'),
    path('sobrenosotros/', VistaSobreNosotros, name='sobre_nosotros'),
    path('contacto/', VistaContacto, name='contacto'),
    path('producto/<int:producto_id>/', VistaProductoDetalle, name='producto_detalle'),
    path('carrito/', VistaCarrito, name='carrito'),
    path('carrito/agregar/<int:producto_id>/', agregar_al_carrito, name='carrito_agregar'),
    path('carrito/actualizar/<int:producto_id>/', actualizar_carrito, name='carrito_actualizar'),
    path('carrito/eliminar/<int:producto_id>/', eliminar_del_carrito, name='carrito_eliminar'),
    path('carrito/paypal/create-order/', paypal_crear_orden, name='carrito_paypal_create_order'),
    path('carrito/checkout/', finalizar_compra, name='carrito_checkout'),
    path('carrito/gracias/', carrito_gracias, name='carrito_gracias'),
    path('newsletter/suscribir/', newsletter_suscribir, name='newsletter_suscribir'),
    path('api/chatbot/ask/', api_chatbot_ask, name='api_chatbot_ask'),

    # Dashboards
    path('dashboard_administrador/', VistaAdministrador, name='dashboard_administrador'),
    path('dashboard_vendedor/', VistaVendedor, name='dashboard_vendedor'),

    # Redirección automática después del login (/accounts/profile/ por defecto en Django)
    path('accounts/profile/', redireccion_usuario, name='redireccion_usuario'),

    # ===================== APIs VENDEDOR =====================
    path('api/vendedor/resumen/', api_vendedor_resumen, name='api_vendedor_resumen'),
    path('api/vendedor/resumen_ext/', api_vendedor_resumen_ext, name='api_vendedor_resumen_ext'),
    path('api/vendedor/stock/', api_vendedor_stock_resumen, name='api_vendedor_stock_resumen'),
    path('api/vendedor/export/ventas.csv', export_vendedor_ventas_csv, name='export_vendedor_ventas_csv'),
    path('api/vendedor/export/ventas.xlsx', export_vendedor_ventas_xlsx, name='export_vendedor_ventas_xlsx'),
    path('api/vendedor/producto/<int:pk>/', api_vendedor_producto_detalle, name='api_vendedor_producto_detalle'),
    
    # ===================== APIs ADMIN ========================
    # Gráficos
    path('api/admin/ventas-por-vendedor/', api_admin_ventas_por_vendedor, name='api_admin_ventas_por_vendedor'),
    path('api/admin/clientes-actividad/', api_admin_clientes_actividad, name='api_admin_clientes_actividad'),
    path('api/admin/vendedores-estado/', api_admin_vendedores_estado, name='api_admin_vendedores_estado'),
    path('api/admin/usuarios-online/', api_admin_usuarios_online, name='api_admin_usuarios_online'),
    path('api/admin/top-productos-linea/', api_admin_top_productos_linea, name='api_admin_top_productos_linea'),
    path('api/admin/ventas-actividad/', api_admin_ventas_actividad, name='api_admin_ventas_actividad'),
    path('api/admin/ventas-por-usuario/', api_admin_ventas_por_usuario, name='api_admin_ventas_por_usuario'),
    path('api/admin/export/postulaciones.csv', export_admin_postulaciones_csv, name='export_admin_postulaciones_csv'),
    path('api/admin/export/ventas.csv', export_admin_ventas_csv, name='export_admin_ventas_csv'),
    path('api/admin/export/postulaciones.xlsx', export_admin_postulaciones_xlsx, name='export_admin_postulaciones_xlsx'),
    path('api/admin/export/ventas.xlsx', export_admin_ventas_xlsx, name='export_admin_ventas_xlsx'),
    path('api/admin/postulaciones/', api_admin_postulaciones, name='api_admin_postulaciones'),

    # Stock
    path('api/admin/productos-bajo-stock/', api_admin_productos_bajo_stock, name='api_admin_productos_bajo_stock'),
    path('api/admin/productos/<int:pk>/', api_admin_producto_update_stock, name='api_admin_producto_update_stock'),
    path('api/admin/producto/<int:pk>/detalle/', api_admin_producto_detalle, name='api_admin_producto_detalle'),
    path('api/admin/producto/<int:pk>/edit/', api_admin_producto_update_full, name='api_admin_producto_update_full'),
    path('api/admin/producto/<int:pk>/delete/', api_admin_producto_delete, name='api_admin_producto_delete'),
    path('api/vendedor/producto/<int:pk>/delete/', api_vendedor_producto_delete, name='api_vendedor_producto_delete'),

    # CRUD vendedores
    path('api/admin/vendedores/', api_admin_vendedores, name='api_admin_vendedores'),
    path('api/vendedor/export/inventario.csv', export_vendedor_inventario_csv, name='export_vendedor_inventario_csv'),
    path('api/vendedor/export/inventario.xlsx', export_vendedor_inventario_xlsx, name='export_vendedor_inventario_xlsx'),
    path('api/vendedor/importar/', api_vendedor_importar, name='api_vendedor_importar'),
    path('api/vendedor/importar_excel/', api_vendedor_importar_excel, name='api_vendedor_importar_excel'),

    # Índex
    path('', RedirectView.as_view(pattern_name='index', permanent=False)),
]

# Servir archivos de MEDIA en desarrollo (imÃ¡genes subidas, etc.)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)








