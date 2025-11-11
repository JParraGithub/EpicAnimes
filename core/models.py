"""Define los modelos principales que describen el dominio de EpicAnimes."""

from django.conf import settings
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Vendedor(models.Model):
    """Representa a un vendedor asociado a un usuario interno."""

    usuario = models.OneToOneField(User, on_delete=models.CASCADE)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    direccion = models.CharField(max_length=120, blank=True, null=True)
    fecha_ingreso = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"{self.usuario.username}"


class Producto(models.Model):
    """Contiene los datos descriptivos de un artículo publicado."""

    vendedor = models.ForeignKey(Vendedor, on_delete=models.CASCADE, related_name='productos', null=True, blank=True)
    nombre = models.CharField(max_length=80)
    descripcion = models.TextField(blank=True)
    marca = models.CharField(max_length=60)
    fecha_ingreso = models.DateField(default=timezone.now)
    calidad = models.CharField(max_length=30)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    existencias = models.IntegerField()
    categoria = models.CharField(max_length=40)
    imagen = models.ImageField(upload_to='productos/', null=True, blank=True)

    class Meta:
        ordering = ("-fecha_ingreso", "nombre")

    def __str__(self):
        return f"{self.nombre} - {self.marca}"


class Venta(models.Model):
    """Registra las operaciones de venta asociadas a un vendedor."""

    vendedor = models.ForeignKey(Vendedor, on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    cantidad = models.IntegerField()
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fecha_venta = models.DateField(auto_now_add=True)

    def save(self, *args, **kwargs):
        """Calcula el total a partir de la cantidad y del precio del producto."""
        self.total = self.cantidad * self.producto.precio
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.vendedor} - {self.producto} ({self.cantidad})"


class Compra(models.Model):
    """Almacena la información de compras realizadas por clientes."""

    cliente = models.CharField(max_length=60)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="compras",
    )
    nombre_completo = models.CharField(max_length=120, blank=True)
    correo_contacto = models.EmailField(blank=True)
    telefono_contacto = models.CharField(max_length=30, blank=True)
    direccion_envio = models.CharField(max_length=180, blank=True)
    ciudad_envio = models.CharField(max_length=80, blank=True)
    notas_extra = models.CharField(max_length=250, blank=True)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    valor_producto = models.DecimalField(max_digits=10, decimal_places=2)
    cantidad = models.IntegerField()
    fecha_compra = models.DateField(auto_now_add=True)
    referencia_pago = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        nombre = self.cliente or (self.usuario.username if self.usuario else "Cliente")
        return f"{nombre} - {self.producto}"


class PerfilCliente(models.Model):
    """Guarda los datos del cliente para agilizar futuras compras."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="perfil_cliente")
    nombre = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    direccion = models.CharField(max_length=180, blank=True)
    ciudad = models.CharField(max_length=80, blank=True)
    codigo_postal = models.CharField(max_length=20, blank=True)
    pais = models.CharField(max_length=60, blank=True, default="Chile")
    actualizado = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Perfil de {self.user.username}"


class DashboardMetricas(models.Model):
    """Consolida totales diarios utilizados en los tableros."""

    fecha = models.DateField(auto_now_add=True)
    total_ventas = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_productos = models.IntegerField(default=0)
    total_vendedores = models.IntegerField(default=0)
    total_clientes = models.IntegerField(default=0)

    def __str__(self):
        return f"Métricas {self.fecha}"


class PostulacionVendedor(models.Model):
    """Describe la postulación enviada por un potencial vendedor."""

    nombre = models.CharField(max_length=120)
    email = models.EmailField()
    telefono = models.CharField(max_length=30, blank=True)
    tienda = models.CharField(max_length=120, blank=True)
    instagram = models.CharField(max_length=180, blank=True)
    mensaje = models.TextField(blank=True)
    notas = models.TextField(blank=True, help_text="Notas internas del equipo")
    fecha_envio = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=20, default="nuevo")

    class Meta:
        ordering = ("-fecha_envio",)

    def __str__(self):
        return f"Postulación {self.nombre} - {self.email}"


class NewsletterSubscriber(models.Model):
    """Mantiene el registro de correos suscritos al newsletter."""

    email = models.EmailField(unique=True)
    fecha_suscripcion = models.DateTimeField(auto_now_add=True)
    segmento = models.CharField(max_length=60, blank=True)
    ruta_origen = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ("-fecha_suscripcion",)

    def __str__(self):
        return self.email
