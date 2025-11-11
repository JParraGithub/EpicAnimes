from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_perfilcliente"),
    ]

    operations = [
        migrations.AddField(
            model_name="newslettersubscriber",
            name="segmento",
            field=models.CharField(blank=True, max_length=60),
        ),
        migrations.AddField(
            model_name="newslettersubscriber",
            name="ruta_origen",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
