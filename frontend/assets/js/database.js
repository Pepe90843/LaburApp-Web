import { auth } from './firebase-config.js';
import {
    deleteUser,
    updatePassword as firebaseUpdatePassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const API_BASE_URL = window.LABURAPP_API_BASE_URL || "http://127.0.0.1:8000/api";

function endpoint(path) {
    return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function toApiDate(value) {
    if (!value) return value;
    if (value instanceof Date) return value.toISOString();
    return value;
}

function toApiMoney(value) {
    const amount = Number(value || 0);
    return Number(amount.toFixed(2));
}

function normalizarLista(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
}

function normalizarTrabajo(t) {
    if (!t) return null;
    return {
        ...t,
        id: t.id || t.id_trabajo,
        id_publicador: t.id_publicador || t.publicador,
        id_trabajador: t.id_trabajador || t.trabajador || null,
        pago_cliente: Number(t.pago_cliente || 0),
        pago_trabajador: Number(t.pago_trabajador || 0),
        latitud: t.latitud === null || t.latitud === undefined ? null : Number(t.latitud),
        longitud: t.longitud === null || t.longitud === undefined ? null : Number(t.longitud),
    };
}

function normalizarUsuario(u) {
    if (!u) return null;
    return {
        ...u,
        saldo: Number(u.saldo || 0),
        dinero_ganado_total: Number(u.dinero_ganado_total || 0),
        valoracion_media: Number(u.valoracion_media || 0),
    };
}

function normalizarMensaje(m) {
    if (!m) return null;
    return {
        ...m,
        id: m.id || m.id_mensaje,
        id_chat: m.id_chat || m.chat,
        id_emisor: m.id_emisor || m.emisor,
        id_receptor: m.id_receptor || m.receptor,
    };
}

function normalizarConversacion(c) {
    if (!c) return null;
    return {
        ...c,
        id_chat: c.id_chat || c.chat,
        uid_usuario: c.uid_usuario || c.usuario,
        id_otro_usuario: c.id_otro_usuario || c.otro_usuario,
        id_trabajo: c.id_trabajo || c.trabajo,
    };
}

async function apiRequest(path, options = {}) {
    const response = await fetch(path.startsWith("http") ? path : endpoint(path), {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    if (response.status === 204) return null;

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const message = data?.detail || data?.non_field_errors?.join?.(" ") || JSON.stringify(data) || response.statusText;
        throw new Error(message);
    }
    return data;
}

async function apiList(path, params = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") search.set(key, value);
    });
    const suffix = search.toString() ? `?${search.toString()}` : "";
    const firstPage = await apiRequest(`${path}${suffix}`);
    if (!firstPage || !Array.isArray(firstPage.results)) return normalizarLista(firstPage);

    const items = [...firstPage.results];
    let nextUrl = firstPage.next;
    while (nextUrl) {
        const page = await apiRequest(nextUrl);
        items.push(...normalizarLista(page));
        nextUrl = page?.next || null;
    }
    return items;
}

async function apiCreate(path, payload) {
    return apiRequest(path, { method: "POST", body: JSON.stringify(payload) });
}

async function apiPatch(path, payload) {
    return apiRequest(path, { method: "PATCH", body: JSON.stringify(payload) });
}

async function apiDelete(path) {
    return apiRequest(path, { method: "DELETE" });
}

function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function incrementarUsuario(uid, cambios) {
    const user = await obtenerPerfilUsuario(uid);
    if (!user) return null;
    const payload = {};
    Object.entries(cambios).forEach(([key, delta]) => {
        payload[key] = Number(user[key] || 0) + Number(delta || 0);
    });
    return actualizarPerfilUsuario(uid, payload);
}

export async function obtenerPerfilUsuario(uid) {
    try {
        return normalizarUsuario(await apiRequest(`/usuarios/${uid}/`));
    } catch (error) {
        if (error.message.includes("Not found")) return null;
        throw error;
    }
}

export const obtenerUsuarioPorId = obtenerPerfilUsuario;

export async function actualizarPerfilUsuario(uid, datosNuevos) {
    await apiPatch(`/usuarios/${uid}/`, datosNuevos);
    return true;
}

export async function crearUsuario(uid, datosUsuario) {
    return normalizarUsuario(await apiCreate("/usuarios/", { uid, ...datosUsuario }));
}

export async function existeUsuarioConDni(dni) {
    const users = await apiList("/usuarios/", { dni });
    return users.length > 0;
}

export async function cambiarPassword(nuevaPass) {
    const user = auth.currentUser;
    if (!user) throw new Error("No hay usuario autenticado.");
    return firebaseUpdatePassword(user, nuevaPass);
}

export async function actualizarSuscripcionUsuario(uid, tipo, idSuscripcion) {
    const proximoMes = new Date();
    proximoMes.setMonth(proximoMes.getMonth() + 1);
    const esTrabajador = tipo === "trabajador";
    const payload = {
        [esTrabajador ? "id_suscripcion_trabajador" : "id_suscripcion_cliente"]: idSuscripcion,
        [esTrabajador ? "fecha_vencimiento_trabajador" : "fecha_vencimiento_cliente"]: proximoMes.toISOString(),
        [esTrabajador ? "renovacion_automatica_trabajador" : "renovacion_automatica_cliente"]: true,
    };
    await actualizarPerfilUsuario(uid, payload);
    await crearNotificacion(uid, "Nueva suscripcion adquirida", `Tu suscripcion de ${tipo} ahora es "${idSuscripcion}".`, "suscripcion");
    return true;
}

export async function cancelarSuscripcionUsuario(uid, tipo) {
    const esTrabajador = tipo === "trabajador";
    await actualizarPerfilUsuario(uid, {
        [esTrabajador ? "renovacion_automatica_trabajador" : "renovacion_automatica_cliente"]: false,
    });
    await crearNotificacion(uid, "Renovacion cancelada", `Has cancelado la renovacion automatica de tu suscripcion de ${tipo}.`, "info");
    return true;
}

export async function actualizarActividadSuscripcion(uid) {
    await actualizarPerfilUsuario(uid, { ultimo_login: new Date().toISOString() });
}

export async function obtenerTodosLosUsuarios() {
    return (await apiList("/usuarios/")).map(normalizarUsuario);
}

export async function verificarLimiteCreacionTrabajo(uid) {
    const user = await obtenerPerfilUsuario(uid);
    if (!user) return { permitida: false, mensaje: "Usuario no encontrado" };
    const hoy = new Date().toLocaleDateString("en-CA");
    const stats = user.stats_diarias?.fecha === hoy ? user.stats_diarias : { fecha: hoy, trabajos_creados: 0 };
    const limite = user.id_suscripcion_cliente === "jefe" ? 3 : 1;
    if (stats.trabajos_creados >= limite) {
        return { permitida: false, mensaje: "Has alcanzado el limite diario de creacion de tareas." };
    }
    return { permitida: true, statsActuales: stats };
}

export async function crearTrabajo(datosTrabajo) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesion.");
    const perfil = await obtenerPerfilUsuario(user.uid);
    const limitCheck = await verificarLimiteCreacionTrabajo(user.uid);
    if (!limitCheck.permitida) throw new Error(limitCheck.mensaje);

    const pagoCliente = toApiMoney(datosTrabajo.pagoCliente ?? datosTrabajo.pago_cliente);
    const trabajo = await apiCreate("/trabajos/", {
        titulo: datosTrabajo.titulo,
        descripcion: datosTrabajo.descripcion,
        direccion: datosTrabajo.direccion || "",
        foto_trabajo: datosTrabajo.foto_trabajo || "",
        latitud: datosTrabajo.latitud || 0,
        longitud: datosTrabajo.longitud || 0,
        fecha_limite: toApiDate(datosTrabajo.fecha_limite),
        tiempo_estimado_horas: datosTrabajo.tiempo_estimado_horas || null,
        estado: "Pendiente",
        pago_cliente: pagoCliente,
        pago_trabajador: toApiMoney(pagoCliente * 0.9),
        xp_otorgada: Math.round(pagoCliente * 10),
        id_categoria: datosTrabajo.id_categoria,
        publicador: user.uid,
        trabajador: null,
        prioridad_suscripcion: perfil?.id_suscripcion_cliente === "jefe" ? 1 : 0,
        es_tarea_premium: perfil?.id_suscripcion_cliente === "jefe",
    });

    const stats = limitCheck.statsActuales;
    stats.trabajos_creados += 1;
    await actualizarPerfilUsuario(user.uid, { stats_diarias: stats });
    return trabajo.id_trabajo;
}

export async function obtenerTrabajoPorId(idTrabajo) {
    try {
        return normalizarTrabajo(await apiRequest(`/trabajos/${idTrabajo}/`));
    } catch (error) {
        if (error.message.includes("Not found")) return null;
        throw error;
    }
}

export async function actualizarTrabajo(idTrabajo, datosNuevos) {
    const payload = { ...datosNuevos, fecha_actividad: new Date().toISOString() };
    if (payload.pago_cliente !== undefined) {
        const pago = toApiMoney(payload.pago_cliente);
        payload.pago_cliente = pago;
        payload.pago_trabajador = toApiMoney(pago * 0.9);
        payload.xp_otorgada = Math.round(pago * 10);
    }
    if (payload.id_publicador !== undefined) {
        payload.publicador = payload.id_publicador;
        delete payload.id_publicador;
    }
    if (payload.id_trabajador !== undefined) {
        payload.trabajador = payload.id_trabajador;
        delete payload.id_trabajador;
    }
    Object.keys(payload).forEach((key) => {
        payload[key] = toApiDate(payload[key]);
    });
    await apiPatch(`/trabajos/${idTrabajo}/`, payload);
    return true;
}

export async function obtenerTrabajos(idCategoria = "todas") {
    const trabajos = (await apiList("/trabajos/")).map(normalizarTrabajo);
    return trabajos.filter((t) => {
        const estadoOk = ["Pendiente", "Pausada", "En disputa"].includes(t.estado);
        const categoriaOk = !idCategoria || idCategoria === "todas" || t.id_categoria === idCategoria;
        return estadoOk && categoriaOk;
    });
}

export async function obtenerTrabajosPublicadosPorMi(uid) {
    return (await apiList("/trabajos/", { publicador: uid })).map(normalizarTrabajo);
}

export async function obtenerTrabajosAceptadosPorMi(uid) {
    return (await apiList("/trabajos/", { trabajador: uid })).map(normalizarTrabajo);
}

export async function postularseATrabajo(idTrabajo) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesion.");
    await apiCreate("/postulaciones/", {
        trabajador: user.uid,
        trabajo: idTrabajo,
        estado_postulacion: "Pendiente",
    });
    const trabajo = await obtenerTrabajoPorId(idTrabajo);
    if (trabajo?.id_publicador) {
        await crearNotificacion(trabajo.id_publicador, "Nueva postulacion", `Un usuario ha postulado a tu trabajo "${trabajo.titulo}".`, "nueva_postulacion", { id_trabajo: idTrabajo });
    }
    return true;
}

export async function obtenerPostulacionesDeUnTrabajo(idTrabajo) {
    return (await apiList("/postulaciones/", { trabajo: idTrabajo })).map((p) => ({
        ...p,
        id_usuario: p.trabajador,
        id_trabajo: p.trabajo,
    }));
}

export async function obtenerMisPostulaciones(uid) {
    const postulaciones = await apiList("/postulaciones/", { trabajador: uid });
    const trabajos = [];
    for (const post of postulaciones) {
        const trabajo = await obtenerTrabajoPorId(post.trabajo);
        if (trabajo) trabajos.push({ ...trabajo, postulacion: post });
    }
    return trabajos;
}

export async function obtenerPostulacionesParaMisTareas(uid) {
    const pendientes = (await obtenerTrabajosPublicadosPorMi(uid)).filter((t) => t.estado === "Pendiente");
    const todas = [];
    for (const trabajo of pendientes) {
        const posts = await obtenerPostulacionesDeUnTrabajo(trabajo.id);
        posts.forEach((p) => todas.push({ ...p, trabajo_titulo: trabajo.titulo, id_trabajo: trabajo.id, pago_cliente: trabajo.pago_cliente }));
    }
    return todas;
}

export async function cancelarPostulacion(idTrabajo, uid) {
    await apiDelete(`/postulaciones/${uid}/${idTrabajo}/`);
    return true;
}

export async function aceptarPostulacion(idTrabajo, uidTrabajador) {
    const trabajo = await obtenerTrabajoPorId(idTrabajo);
    if (!trabajo) return false;
    await actualizarTrabajo(idTrabajo, {
        id_trabajador: uidTrabajador,
        estado: "Aceptada",
        pago_retenido: true,
    });
    await incrementarUsuario(trabajo.id_publicador, { saldo: -Number(trabajo.pago_cliente || 0) });
    await registrarPagoHistorial(trabajo.id_publicador, "Saldo LaburApp", -Number(trabajo.pago_cliente || 0), `Retencion por tarea: ${trabajo.titulo}`);
    await apiPatch(`/postulaciones/${uidTrabajador}/${idTrabajo}/`, { estado_postulacion: "Aceptada" });
    await crearNotificacion(uidTrabajador, "Postulacion aceptada", `Has sido aceptado para el trabajo "${trabajo.titulo}".`, "aceptado", { id_trabajo: idTrabajo });
    return true;
}

export async function rechazarPostulacion(idTrabajo, uidTrabajador) {
    await apiPatch(`/postulaciones/${uidTrabajador}/${idTrabajo}/`, { estado_postulacion: "Rechazada" });
    return true;
}

export async function completarTrabajo(idTrabajo, uidTrabajador) {
    const trabajo = await obtenerTrabajoPorId(idTrabajo);
    if (!trabajo) return false;
    const pago = Number(trabajo.pago_trabajador || trabajo.pago_cliente * 0.9 || 0);
    await actualizarTrabajo(idTrabajo, {
        estado: "Completada",
        fecha_completada: new Date().toISOString(),
        pago_retenido: false,
    });
    await aplicarXPTrabajador(uidTrabajador, Number(trabajo.xp_otorgada || 0), trabajo.id_categoria);
    await incrementarUsuario(uidTrabajador, {
        tareas_realizadas: 1,
        saldo: pago,
        dinero_ganado_total: pago,
    });
    await registrarPagoHistorial(uidTrabajador, "Saldo LaburApp", pago, `Cobro por trabajo: ${trabajo.titulo}`);
    return true;
}

export async function obtenerPuntosCategoria(uid, idCategoria) {
    try {
        const data = await apiRequest(`/puntuaciones-categorias/${idCategoria}/${uid}/`);
        return data.puntos || 0;
    } catch (_) {
        return 0;
    }
}

export async function obtenerTodosPuntosCategorias(uid) {
    return (await apiList("/puntuaciones-categorias/", { usuario: uid })).map((p) => ({
        id_categoria: p.id_categoria,
        puntos: p.puntos,
    }));
}

export async function sumarPuntosCategoria(uid, idCategoria, puntosASumar) {
    const actual = await obtenerPuntosCategoria(uid, idCategoria);
    const payload = { id_categoria: idCategoria, usuario: uid, puntos: actual + puntosASumar };
    if (actual === 0) {
        await apiCreate("/puntuaciones-categorias/", payload).catch(() => apiPatch(`/puntuaciones-categorias/${idCategoria}/${uid}/`, payload));
    } else {
        await apiPatch(`/puntuaciones-categorias/${idCategoria}/${uid}/`, payload);
    }
    return true;
}

export async function aplicarXPTrabajador(uid, xpDelta, idCategoria) {
    const user = await obtenerPerfilUsuario(uid);
    if (!user) return false;
    const experienciaTotal = Number(user.experiencia_total || 0) + Number(xpDelta || 0);
    const nivel = Math.max(1, Math.floor(experienciaTotal / 1000) + 1);
    await actualizarPerfilUsuario(uid, {
        experiencia_total: experienciaTotal,
        experiencia_nivel_actual: experienciaTotal % 1000,
        nivel,
    });
    if (idCategoria) await sumarPuntosCategoria(uid, idCategoria, 1);
    return true;
}

export async function recalcularEspecialidadPrincipal(uid) {
    const puntos = await obtenerTodosPuntosCategorias(uid);
    const best = puntos.sort((a, b) => b.puntos - a.puntos)[0];
    await actualizarPerfilUsuario(uid, {
        especialidad_principal: best?.id_categoria || null,
        puntos_especialidad: best?.puntos || 0,
    });
    return best || null;
}

export async function dejarValoracion(uidReceptor, idTrabajo, puntuacion, comentario) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesion.");
    const trabajo = idTrabajo ? await obtenerTrabajoPorId(idTrabajo) : null;
    await apiCreate("/valoraciones/", {
        receptor: uidReceptor,
        usuario_emisor: user.uid,
        trabajo: idTrabajo,
        titulo_trabajo: trabajo?.titulo || "",
        puntuacion,
        comentario,
    });
    const receptor = await obtenerPerfilUsuario(uidReceptor);
    if (receptor) {
        const num = Number(receptor.num_valoraciones || 0) + 1;
        const media = ((Number(receptor.valoracion_media || 0) * Number(receptor.num_valoraciones || 0)) + Number(puntuacion)) / num;
        await actualizarPerfilUsuario(uidReceptor, { num_valoraciones: num, valoracion_media: media.toFixed(2) });
    }
    return true;
}

export async function crearNotificacion(uid, titulo, mensaje, tipo = "info", metadata = {}) {
    return apiCreate("/notificaciones/", {
        usuario: uid,
        titulo,
        mensaje,
        tipo,
        leida: false,
        chat: metadata.id_chat || null,
        trabajo: metadata.id_trabajo || null,
    });
}

export async function obtenerNotificaciones(uid) {
    return (await apiList("/notificaciones/", { usuario: uid, ordering: "-fecha" })).map((n) => ({
        ...n,
        id: n.id_notificacion,
        id_trabajo: n.trabajo,
        id_chat: n.chat,
    }));
}

export async function marcarNotificacionesComoLeidas(uid) {
    const notifs = await obtenerNotificaciones(uid);
    await Promise.all(notifs.filter((n) => !n.leida).map((n) => apiPatch(`/notificaciones/${n.id}/`, { leida: true })));
    return true;
}

export async function eliminarNotificacion(uid, notifId) {
    await apiDelete(`/notificaciones/${notifId}/`);
    return true;
}

export async function obtenerValoracionesRecibidas(uid) {
    return apiList("/valoraciones/", { receptor: uid, ordering: "-fecha" });
}

export async function agregarMetodoPago(uid, tipo, detalle) {
    const metodo = await apiCreate("/metodos-pago/", { usuario: uid, tipo, detalle, favorito: false });
    return metodo.id_metodo;
}

export async function obtenerMetodosPago(uid) {
    return (await apiList("/metodos-pago/", { usuario: uid })).map((m) => ({ ...m, id: m.id_metodo }));
}

export async function eliminarMetodoPago(uid, idMetodo) {
    await apiDelete(`/metodos-pago/${idMetodo}/`);
    return true;
}

export async function usuarioTieneMetodoPago(uid) {
    return (await obtenerMetodosPago(uid)).length > 0;
}

export async function registrarPagoHistorial(uid, idMetodo, monto, detallePago = "Transaccion de LaburApp") {
    return apiCreate("/historial-pagos/", {
        usuario: uid,
        id_metodo: idMetodo,
        monto,
        detalle_pago: detallePago,
    });
}

export async function obtenerHistorialPagos(uid) {
    return (await apiList("/historial-pagos/", { usuario: uid, ordering: "-fecha_emision" })).map((p) => ({ ...p, id: p.id_pago, monto: Number(p.monto || 0) }));
}

export function generarIdChat(uid1, uid2, idTrabajo = null) {
    const sorted = [uid1, uid2].filter(Boolean).sort().join("_");
    return idTrabajo ? `${sorted}_${idTrabajo}` : sorted;
}

export async function registrarConversacionActiva(uidActor, uidOtro, idChat, idTrabajo = null) {
    await apiCreate("/chats/", { id_chat: idChat, trabajo: idTrabajo, usuarios: [uidActor, uidOtro], ultima_actualizacion: new Date().toISOString() }).catch(() => apiPatch(`/chats/${idChat}/`, { ultima_actualizacion: new Date().toISOString(), usuarios: [uidActor, uidOtro] }));
    const base = { chat: idChat, tipo: idTrabajo ? "trabajo" : "directo", ultima_actualizacion: new Date().toISOString(), trabajo: idTrabajo };
    await apiCreate("/conversaciones/", { ...base, usuario: uidActor, otro_usuario: uidOtro, id_trabajador: uidOtro }).catch(() => apiPatch(`/conversaciones/${idChat}/${uidActor}/`, { ...base, otro_usuario: uidOtro, id_trabajador: uidOtro }));
    await apiCreate("/conversaciones/", { ...base, usuario: uidOtro, otro_usuario: uidActor, id_trabajador: uidActor }).catch(() => apiPatch(`/conversaciones/${idChat}/${uidOtro}/`, { ...base, otro_usuario: uidActor, id_trabajador: uidActor }));
    return true;
}

export async function eliminarReferenciaConversacion(uid, idChat) {
    await apiDelete(`/conversaciones/${idChat}/${uid}/`);
    return true;
}

async function enviarMensaje(idChat, uidReceptor, texto, tipo = "texto", idTrabajo = null) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesion.");
    await registrarConversacionActiva(user.uid, uidReceptor, idChat, idTrabajo);
    const msg = await apiCreate("/mensajes/", {
        chat: idChat,
        emisor: user.uid,
        receptor: uidReceptor,
        contenido: texto,
        tipo_contenido: tipo,
        leido: false,
    });
    await apiPatch(`/chats/${idChat}/`, { ultima_actualizacion: new Date().toISOString() });
    await crearNotificacion(uidReceptor, "Nuevo mensaje", "Tienes un nuevo mensaje.", "mensaje", { id_chat: idChat, id_trabajo: idTrabajo });
    return normalizarMensaje(msg);
}

export async function enviarMensajeTrabajo(idTrabajo, texto, tipo = "texto", idReceptorOverride = null) {
    const user = auth.currentUser;
    const trabajo = await obtenerTrabajoPorId(idTrabajo);
    if (!user || !trabajo) throw new Error("No se pudo enviar el mensaje.");
    const receptor = idReceptorOverride || (user.uid === trabajo.id_publicador ? trabajo.id_trabajador : trabajo.id_publicador);
    return enviarMensaje(generarIdChat(user.uid, receptor, idTrabajo), receptor, texto, tipo, idTrabajo);
}

export async function enviarMensajeDirecto(uidOtro, texto, tipo = "texto") {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesion.");
    return enviarMensaje(generarIdChat(user.uid, uidOtro), uidOtro, texto, tipo);
}

export async function obtenerConversacionesActivas(uid) {
    return (await apiList("/conversaciones/", { usuario: uid, ordering: "-ultima_actualizacion" })).map(normalizarConversacion);
}

export async function obtenerTodasLasConversaciones(uid) {
    return obtenerConversacionesActivas(uid);
}

export async function obtenerMensajesChat(idChat) {
    return (await apiList("/mensajes/", { chat: idChat, ordering: "fecha_envio" })).map(normalizarMensaje);
}

export async function marcarMensajeLeido(idMensaje) {
    await apiPatch(`/mensajes/${idMensaje}/`, { leido: true });
}

export async function tieneNoLeidosEnChat(idChat, uid) {
    return (await apiList("/mensajes/", { chat: idChat, receptor: uid, leido: false })).length > 0;
}

export async function obtenerUltimoMensaje(idChat) {
    const mensajes = await obtenerMensajesChat(idChat);
    return mensajes[mensajes.length - 1] || null;
}

export async function enviarDenuncia(idDenunciado, motivo) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesion.");
    const [denunciante, denunciado] = await Promise.all([obtenerPerfilUsuario(user.uid), obtenerPerfilUsuario(idDenunciado)]);
    await apiCreate("/denuncias/", {
        denunciante: user.uid,
        denunciado: idDenunciado,
        nombre_denunciante: denunciante?.nombre_completo || denunciante?.email || user.uid,
        nombre_denunciado: denunciado?.nombre_completo || denunciado?.email || idDenunciado,
        motivo,
        estado: "pendiente",
    });
    return true;
}

export async function eliminarChatDeTrabajo(idTrabajo, uidPublicador, uidTrabajador) {
    const idChat = generarIdChat(uidPublicador, uidTrabajador, idTrabajo);
    await eliminarChat(idChat);
}

export async function gestionarBorradoTarea(idTrabajo, rol) {
    const field = rol === "publicador" ? "borrado_por_publicador" : "borrado_por_trabajador";
    await actualizarTrabajo(idTrabajo, { [field]: true });
    return true;
}

export async function eliminarCuentaUsuario() {
    const user = auth.currentUser;
    if (!user) throw new Error("No hay usuario autenticado.");
    await apiCreate("/usuarios-eliminados/", { uid_original: user.uid, nombre: user.displayName || "", dni: "" }).catch(() => null);
    await apiDelete(`/usuarios/${user.uid}/`);
    await deleteUser(user);
    return true;
}

export async function cancelarTrabajo(idTrabajo) {
    await actualizarTrabajo(idTrabajo, { estado: "Cancelada" });
    return true;
}

export async function obtenerTareasPendientesConfirmacion(uid) {
    const trabajos = [
        ...(await obtenerTrabajosPublicadosPorMi(uid)).map((t) => ({ ...t, es_publicador: true })),
        ...(await obtenerTrabajosAceptadosPorMi(uid)).map((t) => ({ ...t, es_publicador: false })),
    ];
    return trabajos.filter((t) => t.estado === "En curso" && t.fecha_limite && new Date(t.fecha_limite) <= new Date());
}

export async function registrarRespuestaConfirmacion(idTarea, uid, respuesta) {
    const tarea = await obtenerTrabajoPorId(idTarea);
    const campo = tarea?.id_publicador === uid ? "confirmacion_publicador" : "confirmacion_trabajador";
    await actualizarTrabajo(idTarea, { [campo]: respuesta });
    return true;
}

export async function ejecutarResolucionTarea(idTarea) {
    const tarea = await obtenerTrabajoPorId(idTarea);
    if (!tarea) return;
    if (tarea.confirmacion_publicador === "si" && tarea.confirmacion_trabajador === "si") {
        await completarTrabajo(idTarea, tarea.id_trabajador);
    }
}

export async function eliminarTareaResolucion(idTarea) {
    await eliminarTrabajo(idTarea);
}

export async function reembolsarTrabajo(idTarea) {
    const tarea = await obtenerTrabajoPorId(idTarea);
    if (!tarea || !tarea.pago_retenido) return;
    await incrementarUsuario(tarea.id_publicador, { saldo: Number(tarea.pago_cliente || 0) });
    await actualizarTrabajo(idTarea, { pago_retenido: false });
}

export async function verificarSuscripcionesRecurrentes(uid) {
    return true;
}

export async function banearUsuario(uid, duracionMs, motivo = "Incumplimiento de normas") {
    const hasta = duracionMs === -1 ? "9999-12-31T23:59:59Z" : new Date(Date.now() + duracionMs).toISOString();
    await actualizarPerfilUsuario(uid, { baneado: true, baneado_hasta: hasta, motivo_baneo: motivo });
    await apiCreate("/admin-logs/", { usuario: uid, accion: "BANEO", duracion: duracionMs, motivo });
}

export async function quitarBaneo(uid) {
    await actualizarPerfilUsuario(uid, { baneado: false, baneado_hasta: null, motivo_baneo: null });
    await apiCreate("/admin-logs/", { usuario: uid, accion: "UNBAN" });
}

export async function obtenerUsuariosBaneados() {
    return (await apiList("/usuarios/", { baneado: true })).map(normalizarUsuario);
}

export async function cambiarEstadoTrabajo(idTrabajo, nuevoEstado) {
    await actualizarTrabajo(idTrabajo, { estado: nuevoEstado });
}

export async function marcarTrabajoLeido(idTrabajo) {
    await actualizarTrabajo(idTrabajo, { admin_leido: true });
}

export async function actualizarEstadoDenuncia(idDenuncia, nuevoEstado) {
    await apiPatch(`/denuncias/${idDenuncia}/`, { estado: nuevoEstado });
}

export async function resolverDisputa(idTrabajo, destino) {
    const trabajo = await obtenerTrabajoPorId(idTrabajo);
    if (!trabajo) return;
    if (destino === "cliente") {
        await reembolsarTrabajo(idTrabajo);
        await cambiarEstadoTrabajo(idTrabajo, "Cancelada (Disputa)");
    } else if (destino === "trabajador" && trabajo.id_trabajador) {
        await incrementarUsuario(trabajo.id_trabajador, { saldo: Number(trabajo.pago_trabajador || 0), dinero_ganado_total: Number(trabajo.pago_trabajador || 0) });
        await cambiarEstadoTrabajo(idTrabajo, "Completada (Disputa)");
    }
}

export async function obtenerTodosLosTrabajos() {
    return (await apiList("/trabajos/", { ordering: "-fecha_publicacion" })).map(normalizarTrabajo);
}

export async function obtenerDenuncias() {
    return (await apiList("/denuncias/", { ordering: "-fecha" })).map((d) => ({ ...d, id: d.id_denuncia }));
}

export async function obtenerUsuariosEliminados() {
    return (await apiList("/usuarios-eliminados/", { ordering: "-fecha_eliminacion" })).map((u) => ({ ...u, id: u.id_log }));
}

export async function eliminarTrabajo(idTrabajo) {
    await apiDelete(`/trabajos/${idTrabajo}/`);
}

export async function eliminarDenuncia(idDenuncia) {
    await apiDelete(`/denuncias/${idDenuncia}/`);
}

export async function obtenerTodosLosChats() {
    return (await apiList("/chats/", { ordering: "-ultima_actualizacion" })).map((c) => ({ ...c, id: c.id_chat }));
}

export async function eliminarChat(idChat) {
    const mensajes = await obtenerMensajesChat(idChat);
    await Promise.all(mensajes.map((m) => apiDelete(`/mensajes/${m.id}/`)));
    await apiDelete(`/chats/${idChat}/`);
    return true;
}

export async function enviarAnuncioGlobal(titulo, mensaje, filtro) {
    const users = await obtenerTodosLosUsuarios();
    let targets = users;
    if (filtro === "cliente") targets = users.filter((u) => u.id_suscripcion_cliente && u.id_suscripcion_cliente !== "ninguna");
    if (filtro === "trabajador") targets = users.filter((u) => u.id_suscripcion_trabajador && u.id_suscripcion_trabajador !== "ninguna");
    if (filtro === "no_suscritos") targets = users.filter((u) => (!u.id_suscripcion_cliente || u.id_suscripcion_cliente === "ninguna") && (!u.id_suscripcion_trabajador || u.id_suscripcion_trabajador === "ninguna"));
    await Promise.all(targets.map((u) => crearNotificacion(u.uid, titulo, mensaje, "info")));
    return targets.length;
}

export async function obtenerHistorialPagosGlobal() {
    const usuarios = await obtenerTodosLosUsuarios();
    const pagos = [];
    for (const usuario of usuarios) {
        const userPagos = await obtenerHistorialPagos(usuario.uid);
        userPagos.forEach((p) => pagos.push({ ...p, uid_pagador: usuario.uid, nombre_pagador: usuario.nombre_completo || usuario.nombre || usuario.email }));
    }
    return pagos.sort((a, b) => new Date(b.fecha_emision || 0) - new Date(a.fecha_emision || 0));
}

export async function obtenerEstadisticasAdmin() {
    const [usuarios, trabajos, pagos] = await Promise.all([obtenerTodosLosUsuarios(), obtenerTodosLosTrabajos(), obtenerHistorialPagosGlobal()]);
    const topTrabajador = [...usuarios].sort((a, b) => Number(b.tareas_realizadas || 0) - Number(a.tareas_realizadas || 0))[0];
    const conteoClientes = {};
    trabajos.forEach((t) => {
        if (t.id_publicador) conteoClientes[t.id_publicador] = (conteoClientes[t.id_publicador] || 0) + 1;
    });
    const topClienteId = Object.entries(conteoClientes).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topCliente = usuarios.find((u) => u.uid === topClienteId);
    return {
        totalUsuarios: usuarios.length,
        suscriptoresCliente: usuarios.filter((u) => u.id_suscripcion_cliente && u.id_suscripcion_cliente !== "ninguna").length,
        suscriptoresTrabajador: usuarios.filter((u) => u.id_suscripcion_trabajador && u.id_suscripcion_trabajador !== "ninguna").length,
        totalTrabajos: trabajos.length,
        dineroComisiones: pagos.reduce((total, p) => total + Math.abs(Number(p.monto || 0)) * 0.1, 0),
        topTrabajador: topTrabajador?.nombre_completo || topTrabajador?.email || "N/A",
        topCliente: topCliente?.nombre_completo || topCliente?.email || "N/A",
        ultimoUsuario: usuarios[0]?.nombre_completo || usuarios[0]?.email || "N/A",
        topCategoria: "N/A",
    };
}
