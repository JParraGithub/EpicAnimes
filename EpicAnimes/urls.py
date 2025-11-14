"""Mapea las rutas públicas y privadas del proyecto EpicAnimes."""

from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.contrib.staticfiles.storage import staticfiles_storage

from core.views import (
    # Agrupa las vistas públicas utilizadas por el sitio.
    VistaIndex, VistaSobreNosotros, VistaTerminos, VistaContacto,
    VistaAdministrador, VistaVendedor,
    VistaRegistro, VistaCarrito, VistaProductoDetalle,
    agregar_al_carrito, actualizar_carrito,
    eliminar_del_carrito, paypal_crear_orden, finalizar_compra, carrito_compra_ficticia,
    carrito_gracias,
    newsletter_suscribir,
    api_chatbot_ask,

    # Describe vistas auxiliares para el proceso de autenticación.
    redireccion_usuario,
    editar_perfil,
    historial_pedidos,
    CoreLoginView,
    CustomPasswordResetView,
    send_login_otp,

    # Declara endpoints dedicados a los vendedores.
    api_vendedor_resumen,
    api_vendedor_resumen_ext,
    # api_vendedor_stock_resumen,  # reemplazado por version separada
    api_vendedor_producto_detalle,

    # Declara endpoints administrativos para gráficos, stock y CRUD.
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
    # Define exportaciones en formato Excel para ambos roles.
    export_admin_postulaciones_xlsx,
    export_admin_ventas_xlsx,
    export_vendedor_inventario_xlsx,
    export_vendedor_ventas_xlsx,
    api_vendedor_importar_excel,
)
from core.stock_alerts import (
    api_vendedor_stock_resumen as api_vendedor_stock_resumen_new,
    api_vendedor_stock_set_umbral,
)

urlpatterns = [
    # Expone la administración nativa de Django.
    path('admin/', admin.site.urls),

    # Sirve el favicon en la raíz del sitio para las solicitudes automáticas del navegador.
    path('favicon.ico', RedirectView.as_view(url=staticfiles_storage.url('media/favicons/favicon.ico'), permanent=False)),

    # Configura las rutas de autenticación.
    path('accounts/login/', CoreLoginView.as_view(), name='login'),
    path('accounts/send-otp/', send_login_otp, name='send_login_otp'),
    path('accounts/password_reset/', CustomPasswordResetView.as_view(), name='password_reset'),
    path('accounts/', include('django.contrib.auth.urls')),
    path('accounts/signup/', VistaRegistro, name='signup'),

    # Describe las rutas visibles para visitantes.
    path('index/', VistaIndex, name='index'),
    path('sobrenosotros/', VistaSobreNosotros, name='sobre_nosotros'),
    path('terminos/', VistaTerminos, name='terminos'),
    path('contacto/', VistaContacto, name='contacto'),
    path('producto/<int:producto_id>/', VistaProductoDetalle, name='producto_detalle'),
    path('carrito/', VistaCarrito, name='carrito'),
    path('carrito/agregar/<int:producto_id>/', agregar_al_carrito, name='carrito_agregar'),
    path('carrito/actualizar/<int:producto_id>/', actualizar_carrito, name='carrito_actualizar'),
    path('carrito/eliminar/<int:producto_id>/', eliminar_del_carrito, name='carrito_eliminar'),
    path('carrito/paypal/create-order/', paypal_crear_orden, name='carrito_paypal_create_order'),
    path('carrito/checkout/', finalizar_compra, name='carrito_checkout'),
    path('carrito/simular/', carrito_compra_ficticia, name='carrito_simular'),
    path('carrito/gracias/', carrito_gracias, name='carrito_gracias'),
    path('newsletter/suscribir/', newsletter_suscribir, name='newsletter_suscribir'),
    path('api/chatbot/ask/', api_chatbot_ask, name='api_chatbot_ask'),

    # Mapea los paneles privados.
    path('dashboard_administrador/', VistaAdministrador, name='dashboard_administrador'),
    path('dashboard_vendedor/', VistaVendedor, name='dashboard_vendedor'),

    # Controla la redirección posterior al login.
    path('accounts/profile/', redireccion_usuario, name='redireccion_usuario'),
    path('accounts/profile/editar/', editar_perfil, name='perfil_usuario'),  # alias para ir a la cuenta del usuario
    path('accounts/profile/editar/', editar_perfil, name='editar_perfil'),
    path('accounts/profile/historial/', historial_pedidos, name='historial_pedidos'),

    # Endpoints disponibles para vendedores.
    path('api/vendedor/resumen/', api_vendedor_resumen, name='api_vendedor_resumen'),
    path('api/vendedor/resumen_ext/', api_vendedor_resumen_ext, name='api_vendedor_resumen_ext'),
    path('api/vendedor/stock/', api_vendedor_stock_resumen_new, name='api_vendedor_stock_resumen'),
    path('api/vendedor/stock/umbral/', api_vendedor_stock_set_umbral, name='api_vendedor_stock_set_umbral'),
    path('api/vendedor/export/ventas.csv', export_vendedor_ventas_csv, name='export_vendedor_ventas_csv'),
    path('api/vendedor/export/ventas.xlsx', export_vendedor_ventas_xlsx, name='export_vendedor_ventas_xlsx'),
    path('api/vendedor/producto/<int:pk>/', api_vendedor_producto_detalle, name='api_vendedor_producto_detalle'),

    # Endpoints administrativos utilizados para reportes y mantenimiento.
    # Atiende consultas para reportes y gráficos.
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

    # Gestiona inventario, stock y operaciones de limpieza.
    path('api/admin/productos-bajo-stock/', api_admin_productos_bajo_stock, name='api_admin_productos_bajo_stock'),
    path('api/admin/productos/<int:pk>/', api_admin_producto_update_stock, name='api_admin_producto_update_stock'),
    path('api/admin/producto/<int:pk>/detalle/', api_admin_producto_detalle, name='api_admin_producto_detalle'),
    path('api/admin/producto/<int:pk>/edit/', api_admin_producto_update_full, name='api_admin_producto_update_full'),
    path('api/admin/producto/<int:pk>/delete/', api_admin_producto_delete, name='api_admin_producto_delete'),
    path('api/vendedor/producto/<int:pk>/', api_vendedor_producto_delete, name='api_vendedor_producto_delete'),

    # Expone operaciones de exportación e importación para los vendedores.
    path('api/admin/vendedores/', api_admin_vendedores, name='api_admin_vendedores'),
    path('api/vendedor/export/inventario.csv', export_vendedor_inventario_csv, name='export_vendedor_inventario_csv'),
    path('api/vendedor/export/inventario.xlsx', export_vendedor_inventario_xlsx, name='export_vendedor_inventario_xlsx'),
    path('api/vendedor/importar/', api_vendedor_importar, name='api_vendedor_importar'),
    path('api/vendedor/importar_excel/', api_vendedor_importar_excel, name='api_vendedor_importar_excel'),

    # Mantiene la redirección por defecto hacia la página principal.
    path('', RedirectView.as_view(pattern_name='index', permanent=False)),
]

# Sirve los archivos multimedia durante el desarrollo.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += staticfiles_urlpatterns()

