from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_alter_producto_options_producto_imagen_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='producto',
            name='vendedor',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='productos', to='core.vendedor'),
        ),
    ]

