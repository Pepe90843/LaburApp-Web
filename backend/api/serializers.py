from uuid import uuid4

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


class AutoIdModelSerializer(serializers.ModelSerializer):
    auto_id_field = None

    def get_extra_kwargs(self):
        extra_kwargs = super().get_extra_kwargs()
        if self.auto_id_field:
            field_kwargs = extra_kwargs.setdefault(self.auto_id_field, {})
            field_kwargs["required"] = False
            field_kwargs["allow_blank"] = False
        return extra_kwargs

    def create(self, validated_data):
        if self.auto_id_field and not validated_data.get(self.auto_id_field):
            validated_data[self.auto_id_field] = uuid4().hex
        return super().create(validated_data)


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = "__all__"


class TrabajoSerializer(AutoIdModelSerializer):
    auto_id_field = "id_trabajo"

    class Meta:
        model = Trabajo
        fields = "__all__"

    def validate(self, attrs):
        publicador = attrs.get("publicador", getattr(self.instance, "publicador", None))
        trabajador = attrs.get("trabajador", getattr(self.instance, "trabajador", None))
        if publicador and trabajador and publicador.pk == trabajador.pk:
            raise serializers.ValidationError("El publicador y el trabajador no pueden ser el mismo usuario.")
        return attrs


class DisputaSerializer(AutoIdModelSerializer):
    auto_id_field = "id_disputa"

    class Meta:
        model = Disputa
        fields = "__all__"


class ChatSerializer(AutoIdModelSerializer):
    auto_id_field = "id_chat"
    usuarios = serializers.PrimaryKeyRelatedField(many=True, queryset=Usuario.objects.all(), required=False)

    class Meta:
        model = Chat
        fields = "__all__"

    def create(self, validated_data):
        usuarios = validated_data.pop("usuarios", [])
        chat = super().create(validated_data)
        if usuarios:
            chat.usuarios.set(usuarios)
        return chat

    def update(self, instance, validated_data):
        usuarios = validated_data.pop("usuarios", None)
        chat = super().update(instance, validated_data)
        if usuarios is not None:
            chat.usuarios.set(usuarios)
        return chat


class ChatUsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatUsuario
        fields = ["chat", "usuario"]


class MensajeSerializer(AutoIdModelSerializer):
    auto_id_field = "id_mensaje"

    class Meta:
        model = Mensaje
        fields = "__all__"


class ValoracionSerializer(AutoIdModelSerializer):
    auto_id_field = "id_valoracion"

    class Meta:
        model = Valoracion
        fields = "__all__"

    def validate(self, attrs):
        receptor = attrs.get("receptor", getattr(self.instance, "receptor", None))
        emisor = attrs.get("usuario_emisor", getattr(self.instance, "usuario_emisor", None))
        if receptor and emisor and receptor.pk == emisor.pk:
            raise serializers.ValidationError("El usuario emisor no puede valorarse a si mismo.")
        return attrs


class NotificacionSerializer(AutoIdModelSerializer):
    auto_id_field = "id_notificacion"

    class Meta:
        model = Notificacion
        fields = "__all__"


class MetodoPagoSerializer(AutoIdModelSerializer):
    auto_id_field = "id_metodo"

    class Meta:
        model = MetodoPago
        fields = "__all__"


class HistorialPagoSerializer(AutoIdModelSerializer):
    auto_id_field = "id_pago"

    class Meta:
        model = HistorialPago
        fields = "__all__"


class PostulacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Postulacion
        fields = ["trabajador", "trabajo", "estado_postulacion", "fecha_postulacion", "fecha_actividad"]
        read_only_fields = ["fecha_postulacion", "fecha_actividad"]


class DenunciaSerializer(AutoIdModelSerializer):
    auto_id_field = "id_denuncia"

    class Meta:
        model = Denuncia
        fields = "__all__"

    def validate(self, attrs):
        denunciante = attrs.get("denunciante", getattr(self.instance, "denunciante", None))
        denunciado = attrs.get("denunciado", getattr(self.instance, "denunciado", None))
        if denunciante and denunciado and denunciante.pk == denunciado.pk:
            raise serializers.ValidationError("El denunciante y el denunciado no pueden ser el mismo usuario.")
        return attrs


class AdminLogSerializer(AutoIdModelSerializer):
    auto_id_field = "id_log"

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


class UsuarioEliminadoSerializer(AutoIdModelSerializer):
    auto_id_field = "id_log"

    class Meta:
        model = UsuarioEliminado
        fields = "__all__"
