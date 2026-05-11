from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="trabajo",
            name="fecha_aceptacion",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="trabajo",
            name="prueba_finalizado",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="trabajo",
            name="resolucion_finalizada",
            field=models.BooleanField(default=False),
        ),
    ]
