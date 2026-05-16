from django.contrib import admin

from .models import (
    AdminLog,
    Chat,
    ChatUsuario,
    Conversacion,
    Denuncia,
    Disputa,
    HistorialPago,
    Mensaje,
    MetodoPago,
    Notificacion,
    Postulacion,
    PuntuacionCategoria,
    Trabajo,
    Usuario,
    UsuarioEliminado,
    Valoracion,
)


class AllFieldsAdmin(admin.ModelAdmin):
    list_display = ()

    def __init__(self, model, admin_site):
        self.list_display = tuple(field.name for field in model._meta.fields)
        super().__init__(model, admin_site)


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = tuple(field.name for field in Usuario._meta.fields)
    search_fields = ("uid", "email", "nombre_completo", "dni")
    list_filter = ("baneado", "renovacion_automatica_cliente", "renovacion_automatica_trabajador")


@admin.register(Trabajo)
class TrabajoAdmin(admin.ModelAdmin):
    list_display = tuple(field.name for field in Trabajo._meta.fields)
    search_fields = ("id_trabajo", "titulo", "descripcion", "direccion")
    list_filter = ("estado", "es_tarea_premium", "pago_retenido")


@admin.register(Mensaje)
class MensajeAdmin(admin.ModelAdmin):
    list_display = tuple(field.name for field in Mensaje._meta.fields)
    search_fields = ("id_mensaje", "contenido")
    list_filter = ("tipo_contenido", "leido")


for model in (
    Disputa,
    Chat,
    Valoracion,
    Notificacion,
    MetodoPago,
    HistorialPago,
    Denuncia,
    AdminLog,
    UsuarioEliminado,
):
    admin.site.register(model, AllFieldsAdmin)
