from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminLogViewSet,
    ChatUsuarioViewSet,
    ChatViewSet,
    ConversacionViewSet,
    DenunciaViewSet,
    DisputaViewSet,
    HistorialPagoViewSet,
    MensajeViewSet,
    MetodoPagoViewSet,
    NotificacionViewSet,
    PostulacionViewSet,
    PuntuacionCategoriaViewSet,
    TrabajoViewSet,
    UsuarioEliminadoViewSet,
    UsuarioViewSet,
    ValoracionViewSet,
)

router = DefaultRouter()
router.register("usuarios", UsuarioViewSet, basename="usuario")
router.register("trabajos", TrabajoViewSet, basename="trabajo")
router.register("disputas", DisputaViewSet, basename="disputa")
router.register("chats", ChatViewSet, basename="chat")
router.register("mensajes", MensajeViewSet, basename="mensaje")
router.register("valoraciones", ValoracionViewSet, basename="valoracion")
router.register("notificaciones", NotificacionViewSet, basename="notificacion")
router.register("metodos-pago", MetodoPagoViewSet, basename="metodo-pago")
router.register("historial-pagos", HistorialPagoViewSet, basename="historial-pago")
router.register("denuncias", DenunciaViewSet, basename="denuncia")
router.register("admin-logs", AdminLogViewSet, basename="admin-log")
router.register("usuarios-eliminados", UsuarioEliminadoViewSet, basename="usuario-eliminado")

chat_usuario_list = ChatUsuarioViewSet.as_view({"get": "list", "post": "create"})
chat_usuario_detail = ChatUsuarioViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
)
postulacion_list = PostulacionViewSet.as_view({"get": "list", "post": "create"})
postulacion_detail = PostulacionViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
)
puntuacion_categoria_list = PuntuacionCategoriaViewSet.as_view({"get": "list", "post": "create"})
puntuacion_categoria_detail = PuntuacionCategoriaViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
)
conversacion_list = ConversacionViewSet.as_view({"get": "list", "post": "create"})
conversacion_detail = ConversacionViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
)

urlpatterns = [
    *router.urls,
    path("chat-usuarios/", chat_usuario_list, name="chat-usuario-list"),
    path("chat-usuarios/<str:id_chat>/<str:uid_usuario>/", chat_usuario_detail, name="chat-usuario-detail"),
    path("postulaciones/", postulacion_list, name="postulacion-list"),
    path("postulaciones/<str:uid_trabajador>/<str:id_trabajo>/", postulacion_detail, name="postulacion-detail"),
    path("puntuaciones-categorias/", puntuacion_categoria_list, name="puntuacion-categoria-list"),
    path(
        "puntuaciones-categorias/<str:id_categoria>/<str:uid_usuario>/",
        puntuacion_categoria_detail,
        name="puntuacion-categoria-detail",
    ),
    path("conversaciones/", conversacion_list, name="conversacion-list"),
    path("conversaciones/<str:id_chat>/<str:uid_usuario>/", conversacion_detail, name="conversacion-detail"),
]
