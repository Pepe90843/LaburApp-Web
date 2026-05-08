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


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ("uid", "email", "nombre_completo", "nivel", "baneado")
    search_fields = ("uid", "email", "nombre_completo", "dni")
    list_filter = ("baneado", "renovacion_automatica_cliente", "renovacion_automatica_trabajador")


@admin.register(Trabajo)
class TrabajoAdmin(admin.ModelAdmin):
    list_display = ("id_trabajo", "titulo", "estado", "publicador", "trabajador", "fecha_publicacion")
    search_fields = ("id_trabajo", "titulo", "descripcion", "direccion")
    list_filter = ("estado", "es_tarea_premium", "pago_retenido")


@admin.register(Mensaje)
class MensajeAdmin(admin.ModelAdmin):
    list_display = ("id_mensaje", "chat", "emisor", "receptor", "tipo_contenido", "leido", "fecha_envio")
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
    admin.site.register(model)
