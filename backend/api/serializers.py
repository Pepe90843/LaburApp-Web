from rest_framework import serializers

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


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = "__all__"


class TrabajoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trabajo
        fields = "__all__"


class DisputaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Disputa
        fields = "__all__"


class ChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chat
        fields = "__all__"


class ChatUsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatUsuario
        fields = ["chat", "usuario"]


class MensajeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mensaje
        fields = "__all__"


class ValoracionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Valoracion
        fields = "__all__"


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = "__all__"


class MetodoPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetodoPago
        fields = "__all__"


class HistorialPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistorialPago
        fields = "__all__"


class PostulacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Postulacion
        fields = ["trabajador", "trabajo", "estado_postulacion", "fecha_postulacion", "fecha_actividad"]
        read_only_fields = ["fecha_postulacion", "fecha_actividad"]


class DenunciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Denuncia
        fields = "__all__"


class AdminLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminLog
        fields = "__all__"


class PuntuacionCategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PuntuacionCategoria
        fields = ["id_categoria", "usuario", "puntos", "fecha_creacion"]
        read_only_fields = ["fecha_creacion"]


class ConversacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversacion
        fields = [
            "chat",
            "usuario",
            "otro_usuario",
            "id_trabajador",
            "trabajo",
            "tipo",
            "ultima_actualizacion",
        ]


class UsuarioEliminadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = UsuarioEliminado
        fields = "__all__"
