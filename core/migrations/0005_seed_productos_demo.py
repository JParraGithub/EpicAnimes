from django.db import migrations
from django.utils import timezone


def crear_productos_demo(apps, schema_editor):
    Producto = apps.get_model("core", "Producto")
    if Producto.objects.exists():
        return

    from decimal import Decimal

    hoy = timezone.now().date()
    productos = [
        {
            "nombre": "Figura Asta Black Clover",
            "descripcion": "Figura Banpresto de 18 cm con acabado sombreado y base transparente inspirada en la magia anti-demonio.",
            "marca": "Banpresto",
            "calidad": "Nuevo",
            "precio": Decimal("34990"),
            "existencias": 10,
            "categoria": "Figuras",
            "imagen": "productos/Asta.jpg",
        },
        {
            "nombre": "Figura Sukuna Jujutsu Kaisen",
            "descripcion": "Colección King of Artist: Sukuna con pose de dominio y detalles de tatuajes a todo color.",
            "marca": "Banpresto",
            "calidad": "Nuevo",
            "precio": Decimal("38990"),
            "existencias": 9,
            "categoria": "Figuras",
            "imagen": "productos/sukuna.jpg",
        },
        {
            "nombre": "Figura Vegeta Super Saiyajin Blue",
            "descripcion": "Edición Limit Breaker 30 cm, licencia oficial Toei, incluye peana de combate.",
            "marca": "Bandai",
            "calidad": "Nuevo",
            "precio": Decimal("45990"),
            "existencias": 7,
            "categoria": "Figuras",
            "imagen": "productos/Vegetta.jpeg",
        },
        {
            "nombre": "Dr. Stone - Estatua Senku Ishigami",
            "descripcion": "Figura PVC 1/8 de 22 cm con matraz removible y efecto de humo químico.",
            "marca": "Kotobukiya",
            "calidad": "Nuevo",
            "precio": Decimal("52990"),
            "existencias": 5,
            "categoria": "Figuras",
            "imagen": "productos/drstone.jpg",
        },
        {
            "nombre": "Kazuma Satou - Articulado Figuras Max",
            "descripcion": "Set articulado de 15 cm con accesorios de aventura y rostro intercambiable.",
            "marca": "Max Factory",
            "calidad": "Nuevo",
            "precio": Decimal("39990"),
            "existencias": 6,
            "categoria": "Coleccionables",
            "imagen": "productos/kazuma.jpg",
        },
        {
            "nombre": "Onichichi - Poster ilustración premium",
            "descripcion": "Impresión en papel couché 250g tamaño 50x70cm con barniz UV y marco negro.",
            "marca": "EpicArt",
            "calidad": "Nuevo",
            "precio": Decimal("14990"),
            "existencias": 18,
            "categoria": "Decoración",
            "imagen": "productos/Onichichi.jpg",
        },
        {
            "nombre": "Okarun DanDaDan - Print edición limitada",
            "descripcion": "Arte oficial en alta resolución firmado, incluye certificado numerado.",
            "marca": "Shueisha",
            "calidad": "Nuevo",
            "precio": Decimal("16990"),
            "existencias": 20,
            "categoria": "Decoración",
            "imagen": "productos/okarun.jpeg",
        },
        {
            "nombre": "Figura Hero Academia - Mirko",
            "descripcion": "Figura de 25 cm línea Age of Heroes con acabado mate y base con logo UA.",
            "marca": "Banpresto",
            "calidad": "Nuevo",
            "precio": Decimal("37990"),
            "existencias": 11,
            "categoria": "Figuras",
            "imagen": "productos/FiguraH.jpg",
        },
        {
            "nombre": "Taza térmica One Piece Going Merry",
            "descripcion": "Taza metálica de 450 ml con doble pared y tapa de bambú certificada.",
            "marca": "ABYstyle",
            "calidad": "Nuevo",
            "precio": Decimal("12990"),
            "existencias": 15,
            "categoria": "Accesorios",
            "imagen": None,
        },
    ]

    Producto.objects.bulk_create(
        [
            Producto(
                nombre=prod["nombre"],
                descripcion=prod["descripcion"],
                marca=prod["marca"],
                fecha_ingreso=hoy,
                calidad=prod["calidad"],
                precio=prod["precio"],
                existencias=prod["existencias"],
                categoria=prod["categoria"],
                imagen=prod.get("imagen") or "",
            )
            for prod in productos
        ]
    )


def eliminar_productos_demo(apps, schema_editor):
    Producto = apps.get_model("core", "Producto")
    nombres = [
        "Figura Asta Black Clover",
        "Figura Sukuna Jujutsu Kaisen",
        "Figura Vegeta Super Saiyajin Blue",
        "Dr. Stone - Estatua Senku Ishigami",
        "Kazuma Satou - Articulado Figuras Max",
        "Onichichi - Poster ilustración premium",
        "Okarun DanDaDan - Print edición limitada",
        "Figura Hero Academia - Mirko",
        "Taza térmica One Piece Going Merry",
    ]
    Producto.objects.filter(nombre__in=nombres).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_compra_referencia_pago_compra_usuario"),
    ]

    operations = [
        migrations.RunPython(crear_productos_demo, eliminar_productos_demo),
    ]
