from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Usuario(models.Model):
    uid = models.CharField(max_length=255, primary_key=True)
    nombre = models.CharField(max_length=100, blank=True, null=True)
    apellidos = models.CharField(max_length=150, blank=True, null=True)
    nombre_completo = models.CharField(max_length=255, blank=True, null=True)
    dni = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(max_length=255, unique=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    direccion_principal = models.TextField(blank=True, null=True)
    fecha_nacimiento = models.DateField(blank=True, null=True)
    fecha_ingreso = models.DateTimeField(auto_now_add=True)
    foto_perfil = models.TextField(blank=True, null=True)
    curriculum_url = models.TextField(blank=True, null=True)
    nivel = models.IntegerField(default=1)
    experiencia_total = models.IntegerField(default=0)
    experiencia_nivel_actual = models.IntegerField(default=0)
    tareas_realizadas = models.IntegerField(default=0)
    saldo = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    dinero_ganado_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    especialidad_principal = models.CharField(max_length=100, blank=True, null=True)
    puntos_especialidad = models.IntegerField(default=0)
    id_suscripcion_cliente = models.CharField(max_length=100, blank=True, null=True)
    fecha_vencimiento_cliente = models.DateTimeField(blank=True, null=True)
    renovacion_automatica_cliente = models.BooleanField(default=False)
    id_suscripcion_trabajador = models.CharField(max_length=100, blank=True, null=True)
    fecha_vencimiento_trabajador = models.DateTimeField(blank=True, null=True)
    renovacion_automatica_trabajador = models.BooleanField(default=False)
    ultimo_login = models.DateTimeField(blank=True, null=True)
    ultimo_login_suscrito = models.BooleanField(default=False)
    valoracion_media = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    num_valoraciones = models.IntegerField(default=0)
    stats_diarias = models.JSONField(blank=True, null=True)
    baneado = models.BooleanField(default=False)
    baneado_hasta = models.DateTimeField(blank=True, null=True)
    motivo_baneo = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "usuarios"
        ordering = ["nombre_completo", "email"]

    def __str__(self):
        return self.nombre_completo or self.email


class Trabajo(models.Model):
    id_trabajo = models.CharField(max_length=255, primary_key=True)
    publicador = models.ForeignKey(
        Usuario,
        db_column="id_publicador",
        on_delete=models.CASCADE,
        related_name="trabajos_publicados",
    )
    trabajador = models.ForeignKey(
        Usuario,
        db_column="id_trabajador",
        on_delete=models.SET_NULL,
        related_name="trabajos_asignados",
        blank=True,
        null=True,
    )
    id_categoria = models.CharField(max_length=255, blank=True, null=True)
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, null=True)
    estado = models.CharField(max_length=50, default="Pendiente")
    pago_cliente = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    pago_trabajador = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    pago_retenido = models.BooleanField(default=True)
    xp_otorgada = models.IntegerField(blank=True, null=True)
    latitud = models.DecimalField(max_digits=10, decimal_places=8, blank=True, null=True)
    longitud = models.DecimalField(max_digits=11, decimal_places=8, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    foto_trabajo = models.TextField(blank=True, null=True)
    fecha_publicacion = models.DateTimeField(auto_now_add=True)
    fecha_actividad = models.DateTimeField(auto_now=True)
    fecha_limite = models.DateTimeField(blank=True, null=True)
    fecha_inicio = models.DateTimeField(blank=True, null=True)
    fecha_completada = models.DateTimeField(blank=True, null=True)
    tiempo_estimado_horas = models.IntegerField(blank=True, null=True)
    es_tarea_premium = models.BooleanField(default=False)
    prioridad_suscripcion = models.IntegerField(default=0)
    borrado_por_publicador = models.BooleanField(default=False)
    borrado_por_trabajador = models.BooleanField(default=False)
    confirmacion_publicador = models.CharField(max_length=50, blank=True, null=True)
    confirmacion_trabajador = models.CharField(max_length=50, blank=True, null=True)
    xp_ajustado_por_valoracion = models.BooleanField(default=False)
    nota_sistema = models.TextField(blank=True, null=True)
    admin_leido = models.BooleanField(default=False)

    class Meta:
        db_table = "trabajos"
        ordering = ["-fecha_publicacion"]

    def __str__(self):
        return self.titulo


class Disputa(models.Model):
    id_disputa = models.CharField(max_length=255, primary_key=True)
    trabajo = models.ForeignKey(Trabajo, db_column="id_trabajo", on_delete=models.CASCADE, related_name="disputas")
    motivo_publicador = models.TextField(blank=True, null=True)
    motivo_trabajador = models.TextField(blank=True, null=True)
    estado_disputa = models.CharField(max_length=50, default="Abierta")
    resolucion_admin = models.TextField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "disputas"
        ordering = ["-fecha_creacion"]


class Chat(models.Model):
    id_chat = models.CharField(max_length=255, primary_key=True)
    trabajo = models.ForeignKey(
        Trabajo,
        db_column="id_trabajo",
        on_delete=models.SET_NULL,
        related_name="chats",
        blank=True,
        null=True,
    )
    ultima_actualizacion = models.DateTimeField(blank=True, null=True)
    usuarios = models.ManyToManyField(Usuario, through="ChatUsuario", related_name="chats")

    class Meta:
        db_table = "chats"
        ordering = ["-ultima_actualizacion"]


class ChatUsuario(models.Model):
    pk = models.CompositePrimaryKey("chat", "usuario")
    chat = models.ForeignKey(Chat, db_column="id_chat", on_delete=models.CASCADE)
    usuario = models.ForeignKey(Usuario, db_column="uid_usuario", on_delete=models.CASCADE)

    class Meta:
        db_table = "chat_usuarios"


class Mensaje(models.Model):
    id_mensaje = models.CharField(max_length=255, primary_key=True)
    chat = models.ForeignKey(Chat, db_column="id_chat", on_delete=models.CASCADE, related_name="mensajes")
    emisor = models.ForeignKey(Usuario, db_column="id_emisor", on_delete=models.CASCADE, related_name="mensajes_enviados")
    receptor = models.ForeignKey(
        Usuario,
        db_column="id_receptor",
        on_delete=models.CASCADE,
        related_name="mensajes_recibidos",
    )
    contenido = models.TextField(blank=True, null=True)
    tipo_contenido = models.CharField(max_length=50, default="texto")
    leido = models.BooleanField(default=False)
    fecha_envio = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "mensajes"
        ordering = ["fecha_envio"]


class Valoracion(models.Model):
    id_valoracion = models.CharField(max_length=255, primary_key=True)
    receptor = models.ForeignKey(Usuario, db_column="uid_receptor", on_delete=models.CASCADE, related_name="valoraciones_recibidas")
    usuario_emisor = models.ForeignKey(
        Usuario,
        db_column="id_usuario_emisor",
        on_delete=models.CASCADE,
        related_name="valoraciones_emitidas",
    )
    trabajo = models.ForeignKey(
        Trabajo,
        db_column="id_trabajo",
        on_delete=models.SET_NULL,
        related_name="valoraciones",
        blank=True,
        null=True,
    )
    titulo_trabajo = models.CharField(max_length=255, blank=True, null=True)
    puntuacion = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comentario = models.TextField(blank=True, null=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "valoraciones"
        ordering = ["-fecha"]


class Notificacion(models.Model):
    id_notificacion = models.CharField(max_length=255, primary_key=True)
    usuario = models.ForeignKey(Usuario, db_column="uid_usuario", on_delete=models.CASCADE, related_name="notificaciones")
    titulo = models.CharField(max_length=255, blank=True, null=True)
    mensaje = models.TextField(blank=True, null=True)
    tipo = models.CharField(max_length=50, blank=True, null=True)
    leida = models.BooleanField(default=False)
    fecha = models.DateTimeField(auto_now_add=True)
    chat = models.ForeignKey(Chat, db_column="id_chat", on_delete=models.SET_NULL, blank=True, null=True)
    trabajo = models.ForeignKey(Trabajo, db_column="id_trabajo", on_delete=models.SET_NULL, blank=True, null=True)

    class Meta:
        db_table = "notificaciones"
        ordering = ["-fecha"]


class MetodoPago(models.Model):
    id_metodo = models.CharField(max_length=255, primary_key=True)
    usuario = models.ForeignKey(Usuario, db_column="uid_usuario", on_delete=models.CASCADE, related_name="metodos_pago")
    tipo = models.CharField(max_length=100, blank=True, null=True)
    detalle = models.TextField(blank=True, null=True)
    favorito = models.BooleanField(default=False)

    class Meta:
        db_table = "metodos_pago"


class HistorialPago(models.Model):
    id_pago = models.CharField(max_length=255, primary_key=True)
    usuario = models.ForeignKey(Usuario, db_column="uid_usuario", on_delete=models.CASCADE, related_name="historial_pagos")
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    id_metodo = models.CharField(max_length=255, blank=True, null=True)
    detalle_pago = models.TextField(blank=True, null=True)
    fecha_emision = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "historial_pagos"
        ordering = ["-fecha_emision"]


class Postulacion(models.Model):
    pk = models.CompositePrimaryKey("trabajador", "trabajo")
    trabajador = models.ForeignKey(Usuario, db_column="uid_trabajador", on_delete=models.CASCADE, related_name="postulaciones")
    trabajo = models.ForeignKey(Trabajo, db_column="id_trabajo", on_delete=models.CASCADE, related_name="postulaciones")
    estado_postulacion = models.CharField(max_length=50, default="Pendiente")
    fecha_postulacion = models.DateTimeField(auto_now_add=True)
    fecha_actividad = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "postulaciones"
        ordering = ["-fecha_postulacion"]


class Denuncia(models.Model):
    id_denuncia = models.CharField(max_length=255, primary_key=True)
    denunciante = models.ForeignKey(Usuario, db_column="id_denunciante", on_delete=models.CASCADE, related_name="denuncias_realizadas")
    denunciado = models.ForeignKey(Usuario, db_column="id_denunciado", on_delete=models.CASCADE, related_name="denuncias_recibidas")
    nombre_denunciante = models.CharField(max_length=255, blank=True, null=True)
    nombre_denunciado = models.CharField(max_length=255, blank=True, null=True)
    motivo = models.TextField()
    estado = models.CharField(max_length=50, default="pendiente")
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "denuncias"
        ordering = ["-fecha"]


class AdminLog(models.Model):
    id_log = models.CharField(max_length=255, primary_key=True)
    usuario = models.ForeignKey(Usuario, db_column="uid_usuario", on_delete=models.CASCADE, related_name="admin_logs")
    accion = models.CharField(max_length=100)
    duracion = models.IntegerField(blank=True, null=True)
    motivo = models.TextField(blank=True, null=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "admin_logs"
        ordering = ["-fecha"]


class PuntuacionCategoria(models.Model):
    pk = models.CompositePrimaryKey("id_categoria", "usuario")
    id_categoria = models.CharField(max_length=255)
    usuario = models.ForeignKey(Usuario, db_column="uid_usuario", on_delete=models.CASCADE, related_name="puntuaciones_categorias")
    puntos = models.IntegerField(default=0)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "puntuaciones_categorias"


class Conversacion(models.Model):
    pk = models.CompositePrimaryKey("chat", "usuario")
    chat = models.ForeignKey(Chat, db_column="id_chat", on_delete=models.CASCADE, related_name="conversaciones")
    usuario = models.ForeignKey(Usuario, db_column="uid_usuario", on_delete=models.CASCADE, related_name="conversaciones")
    otro_usuario = models.ForeignKey(
        Usuario,
        db_column="id_otro_usuario",
        on_delete=models.SET_NULL,
        related_name="conversaciones_con_otro",
        blank=True,
        null=True,
    )
    id_trabajador = models.CharField(max_length=255, blank=True, null=True)
    trabajo = models.ForeignKey(
        Trabajo,
        db_column="id_trabajo",
        on_delete=models.SET_NULL,
        related_name="conversaciones",
        blank=True,
        null=True,
    )
    tipo = models.CharField(max_length=50, blank=True, null=True)
    ultima_actualizacion = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "conversaciones"
        ordering = ["-ultima_actualizacion"]


class UsuarioEliminado(models.Model):
    id_log = models.CharField(max_length=255, primary_key=True)
    uid_original = models.CharField(max_length=255, blank=True, null=True)
    nombre = models.CharField(max_length=100, blank=True, null=True)
    apellidos = models.CharField(max_length=150, blank=True, null=True)
    dni = models.CharField(max_length=50, blank=True, null=True)
    fecha_eliminacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "usuarios_eliminados"
        ordering = ["-fecha_eliminacion"]
