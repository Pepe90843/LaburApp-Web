from django.shortcuts import get_object_or_404
from rest_framework import filters, mixins, viewsets

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
from .serializers import (
    AdminLogSerializer,
    ChatSerializer,
    ChatUsuarioSerializer,
    ConversacionSerializer,
    DenunciaSerializer,
    DisputaSerializer,
    HistorialPagoSerializer,
    MensajeSerializer,
    MetodoPagoSerializer,
    NotificacionSerializer,
    PostulacionSerializer,
    PuntuacionCategoriaSerializer,
    TrabajoSerializer,
    UsuarioEliminadoSerializer,
    UsuarioSerializer,
    ValoracionSerializer,
)


class BaseModelViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]


class UsuarioViewSet(BaseModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    lookup_field = "uid"
    search_fields = ["uid", "nombre", "apellidos", "nombre_completo", "email", "dni"]
    ordering_fields = ["fecha_ingreso", "nombre_completo", "email", "nivel", "valoracion_media"]


class TrabajoViewSet(BaseModelViewSet):
    queryset = Trabajo.objects.select_related("publicador", "trabajador").all()
    serializer_class = TrabajoSerializer
    lookup_field = "id_trabajo"
    search_fields = ["id_trabajo", "titulo", "descripcion", "estado", "direccion"]
    ordering_fields = ["fecha_publicacion", "fecha_actividad", "fecha_limite", "pago_cliente", "estado"]


class DisputaViewSet(BaseModelViewSet):
    queryset = Disputa.objects.select_related("trabajo").all()
    serializer_class = DisputaSerializer
    lookup_field = "id_disputa"
    search_fields = ["id_disputa", "estado_disputa", "motivo_publicador", "motivo_trabajador"]
    ordering_fields = ["fecha_creacion", "estado_disputa"]


class ChatViewSet(BaseModelViewSet):
    queryset = Chat.objects.select_related("trabajo").prefetch_related("usuarios").all()
    serializer_class = ChatSerializer
    lookup_field = "id_chat"
    search_fields = ["id_chat", "trabajo__titulo"]
    ordering_fields = ["ultima_actualizacion"]


class MensajeViewSet(BaseModelViewSet):
    queryset = Mensaje.objects.select_related("chat", "emisor", "receptor").all()
    serializer_class = MensajeSerializer
    lookup_field = "id_mensaje"
    search_fields = ["id_mensaje", "contenido", "tipo_contenido"]
    ordering_fields = ["fecha_envio", "leido"]


class ValoracionViewSet(BaseModelViewSet):
    queryset = Valoracion.objects.select_related("receptor", "usuario_emisor", "trabajo").all()
    serializer_class = ValoracionSerializer
    lookup_field = "id_valoracion"
    search_fields = ["id_valoracion", "titulo_trabajo", "comentario"]
    ordering_fields = ["fecha", "puntuacion"]


class NotificacionViewSet(BaseModelViewSet):
    queryset = Notificacion.objects.select_related("usuario", "chat", "trabajo").all()
    serializer_class = NotificacionSerializer
    lookup_field = "id_notificacion"
    search_fields = ["id_notificacion", "titulo", "mensaje", "tipo"]
    ordering_fields = ["fecha", "leida"]


class MetodoPagoViewSet(BaseModelViewSet):
    queryset = MetodoPago.objects.select_related("usuario").all()
    serializer_class = MetodoPagoSerializer
    lookup_field = "id_metodo"
    search_fields = ["id_metodo", "tipo", "detalle"]
    ordering_fields = ["favorito", "tipo"]


class HistorialPagoViewSet(BaseModelViewSet):
    queryset = HistorialPago.objects.select_related("usuario").all()
    serializer_class = HistorialPagoSerializer
    lookup_field = "id_pago"
    search_fields = ["id_pago", "detalle_pago"]
    ordering_fields = ["fecha_emision", "monto"]


class DenunciaViewSet(BaseModelViewSet):
    queryset = Denuncia.objects.select_related("denunciante", "denunciado").all()
    serializer_class = DenunciaSerializer
    lookup_field = "id_denuncia"
    search_fields = ["id_denuncia", "motivo", "estado", "nombre_denunciante", "nombre_denunciado"]
    ordering_fields = ["fecha", "estado"]


class AdminLogViewSet(BaseModelViewSet):
    queryset = AdminLog.objects.select_related("usuario").all()
    serializer_class = AdminLogSerializer
    lookup_field = "id_log"
    search_fields = ["id_log", "accion", "motivo"]
    ordering_fields = ["fecha", "accion", "duracion"]


class UsuarioEliminadoViewSet(BaseModelViewSet):
    queryset = UsuarioEliminado.objects.all()
    serializer_class = UsuarioEliminadoSerializer
    lookup_field = "id_log"
    search_fields = ["id_log", "uid_original", "nombre", "apellidos", "dni"]
    ordering_fields = ["fecha_eliminacion"]


class CompositeKeyViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    lookup_url_kwargs = ()
    lookup_model_fields = ()

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        filters_by_key = {
            model_field: self.kwargs[url_kwarg]
            for url_kwarg, model_field in zip(self.lookup_url_kwargs, self.lookup_model_fields, strict=True)
        }
        obj = get_object_or_404(queryset, **filters_by_key)
        self.check_object_permissions(self.request, obj)
        return obj


class ChatUsuarioViewSet(CompositeKeyViewSet):
    queryset = ChatUsuario.objects.select_related("chat", "usuario").all()
    serializer_class = ChatUsuarioSerializer
    lookup_url_kwargs = ("id_chat", "uid_usuario")
    lookup_model_fields = ("chat_id", "usuario_id")
    search_fields = ["chat__id_chat", "usuario__uid", "usuario__email"]


class PostulacionViewSet(CompositeKeyViewSet):
    queryset = Postulacion.objects.select_related("trabajador", "trabajo").all()
    serializer_class = PostulacionSerializer
    lookup_url_kwargs = ("uid_trabajador", "id_trabajo")
    lookup_model_fields = ("trabajador_id", "trabajo_id")
    search_fields = ["trabajador__uid", "trabajo__id_trabajo", "estado_postulacion"]
    ordering_fields = ["fecha_postulacion", "fecha_actividad", "estado_postulacion"]


class PuntuacionCategoriaViewSet(CompositeKeyViewSet):
    queryset = PuntuacionCategoria.objects.select_related("usuario").all()
    serializer_class = PuntuacionCategoriaSerializer
    lookup_url_kwargs = ("id_categoria", "uid_usuario")
    lookup_model_fields = ("id_categoria", "usuario_id")
    search_fields = ["id_categoria", "usuario__uid"]
    ordering_fields = ["puntos", "fecha_creacion"]


class ConversacionViewSet(CompositeKeyViewSet):
    queryset = Conversacion.objects.select_related("chat", "usuario", "otro_usuario", "trabajo").all()
    serializer_class = ConversacionSerializer
    lookup_url_kwargs = ("id_chat", "uid_usuario")
    lookup_model_fields = ("chat_id", "usuario_id")
    search_fields = ["chat__id_chat", "usuario__uid", "tipo", "trabajo__titulo"]
    ordering_fields = ["ultima_actualizacion", "tipo"]
