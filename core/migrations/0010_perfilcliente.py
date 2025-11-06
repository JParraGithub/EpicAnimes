from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_newslettersubscriber'),
    ]

    operations = [
        migrations.CreateModel(
            name='PerfilCliente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(blank=True, max_length=120)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('telefono', models.CharField(blank=True, max_length=30)),
                ('direccion', models.CharField(blank=True, max_length=180)),
                ('ciudad', models.CharField(blank=True, max_length=80)),
                ('codigo_postal', models.CharField(blank=True, max_length=20)),
                ('pais', models.CharField(blank=True, default='Chile', max_length=60)),
                ('actualizado', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='perfil_cliente', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]

