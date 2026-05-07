import { auth, db } from './firebase-config.js';
import { 
    obtenerPerfilUsuario, 
    obtenerNotificaciones, 
    marcarNotificacionesComoLeidas, 
    eliminarNotificacion,
    actualizarActividadSuscripcion,
    obtenerTareasPendientesConfirmacion,
    registrarRespuestaConfirmacion,
    verificarSuscripcionesRecurrentes,
    ejecutarResolucionTarea
} from './database.js';
import { onSnapshot, collection, query, where, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initCookieConsent } from './cookies.js';
// --- UTILIDAD GLOBAL: VERIFICAR SESIÓN ---// --- ESTA FUNCIÓN COMPRUEBA SI EL USUARIO ESTÁ LOGUEADO. SI NO, MUESTRA EL MODAL DE BLOQUEO. ---
window.verificarSesion = function (callback, mensajeAux = "realizar esta acción") {
    const user = auth.currentUser;
    if (user) {
        if (typeof callback === 'function') callback();
        return true;
    } else {
        const isPage = window.location.pathname.includes('/pages/');
        const loginUrl = isPage ? 'login.html' : 'pages/login.html';

        showCustomConfirm(
            "Acceso Restringido",
            `Para ${mensajeAux} necesitas una cuenta en LaburApp. ¿Quieres iniciar sesión ahora?`,
            () => {
               // --- GUARDAMOS LA URL ACTUAL PARA INTENTAR VOLVER DESPUÉS DEL LOGIN SI FUERA POSIBLE (OPCIONAL) ---
                sessionStorage.setItem('redirectAfterLogin', window.location.href);
                window.location.href = loginUrl;
            },
            "Iniciar Sesión",
            "Cancelar",
            "confirm",
            true
        );
        return false;
    }
};

document.addEventListener('DOMContentLoaded', () => {
   
    if (sessionStorage.getItem('forceScrollTop') === 'true') {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);

        setTimeout(() => {
            window.scrollTo(0, 0);
            sessionStorage.removeItem('forceScrollTop');
            if ('scrollRestoration' in history) {
                history.scrollRestoration = 'auto';
            }
        }, 100);
    }

   // --- LÓGICA DE USUARIO EN CABECERA ---
    auth.onAuthStateChanged(async (user) => {
        const isPage = window.location.pathname.includes('/pages/');
        const assetsBase = isPage ? '../assets/img/' : 'assets/img/';
        const guestAvatar = assetsBase + 'avatar-defecto.png';
        const loginUrl = isPage ? 'login.html' : 'pages/login.html';

        if (user) {
           // --- MOSTRAR AVATAR Y OCULTAR BOTÓN DE LOGIN DE INVITADO ---
            const headerAvatar = document.getElementById('profileBtn');
            if (headerAvatar) headerAvatar.style.display = 'block';
            const guestLoginBtn = document.getElementById('guestLoginBtn');
            if (guestLoginBtn) guestLoginBtn.style.display = 'none';

            const sideFooter = document.querySelector('.side-menu-footer');
            if (sideFooter) sideFooter.style.display = 'flex';
            const dropFooter = document.querySelector('.profile-dropdown .dropdown-footer');
            if (dropFooter) dropFooter.style.display = 'flex';

            setupNotificationBadgeListener(user.uid);

            injectNotificationsHtml();
            setupNotificationsLogic();

            const loginTimestamp = localStorage.getItem("loginTimestamp");
            if (loginTimestamp) {
                const sieteDiasEnMs = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - parseInt(loginTimestamp) > sieteDiasEnMs) {
                    console.log("Sesión expirada (7 días). Cerrando sesión...");
                    localStorage.removeItem("loginTimestamp");
                    auth.signOut().then(() => {
                        console.log("Sesión expirada (7 días).");
                    });
                    return;
                }
            }

            const perfil = await obtenerPerfilUsuario(user.uid);
            if (perfil) {
                // --- VERIFICAR BANEO ---
                if (perfil.baneado) {
                    const ahora = Date.now();
                    if (perfil.baneado_hasta === -1 || ahora < perfil.baneado_hasta) {
                        const hastaStr = perfil.baneado_hasta === -1 ? "de forma permanente" : "hasta el " + new Date(perfil.baneado_hasta).toLocaleString();
                        window.showCustomAlert("Acceso Denegado", `Tu cuenta está restringida ${hastaStr}. Motivo: ${perfil.motivo_baneo || 'No especificado'}`, "Aceptar", () => {
                            auth.signOut();
                        });
                        return;
                    }
                }

                actualizarActividadSuscripcion(user.uid).catch(e => {
                    console.error("Error actualizando actividad suscripción:", e);
                });

                verificarSuscripcionesRecurrentes(user.uid).catch(e => {
                    console.error("Error verificando suscripciones recurrentes:", e);
                });

                gestionarVisibilidadAnuncios(perfil);

                const avatarUrl = perfil.foto_perfil || guestAvatar;

                const dropdownAvatar = document.querySelector('.dropdown-avatar');
                if (headerAvatar) headerAvatar.src = avatarUrl;
                if (dropdownAvatar) dropdownAvatar.src = avatarUrl;

                const dropdownName = document.querySelector('.dropdown-name');
                const dropdownEmail = document.querySelector('.dropdown-email');
                if (dropdownName) dropdownName.innerText = perfil.nombre || user.displayName || "Usuario";
                if (dropdownEmail) dropdownEmail.innerText = user.email;

                // --- INYECTAR ENLACE DE ADMIN SI ES EL USUARIO CORRECTO ---
                const adminUID = "Phym2MgXuhMKqOLV97cUe5uzDKC2";
                if (user.uid === adminUID) {
                    injectAdminLinks(isPage);
                }

                const dropFooter = document.querySelector('.profile-dropdown .dropdown-footer');
                if (dropFooter) {
                    const dropLink = dropFooter.querySelector('a');
                    if (dropLink) {
                        dropLink.innerText = "Cerrar Sesión";
                        dropLink.href = loginUrl;
                    }
                }

                setTimeout(() => checkExpiredTasks(user.uid), 0);
            }
        } else {
           // --- USUARIO INVITADO (GUEST) ---
            console.log("Navegando como invitado.");
            
           // --- 1. OCULTAR AVATAR Y MOSTRAR BOTÓN DE LOGIN ---
            const headerAvatar = document.getElementById('profileBtn');
            if (headerAvatar) headerAvatar.style.display = 'none';

            let guestLoginBtn = document.getElementById('guestLoginBtn');
            if (!guestLoginBtn) {
                guestLoginBtn = document.createElement('button');
                guestLoginBtn.id = 'guestLoginBtn';
                guestLoginBtn.className = 'login-btn-header';
                guestLoginBtn.innerText = 'Iniciar Sesión';
                guestLoginBtn.onclick = () => window.location.href = loginUrl;
                
                const headerIcons = document.querySelector('.header-icons');
                if (headerIcons) {
                   
                    const menuBtn = document.getElementById('menuBtn');
                    headerIcons.insertBefore(guestLoginBtn, menuBtn);
                }
            } else {
                guestLoginBtn.style.display = 'block';
            }

            const dropdownName = document.querySelector('.dropdown-name');
            const dropdownEmail = document.querySelector('.dropdown-email');
            if (dropdownName) dropdownName.innerText = "Invitado";
            if (dropdownEmail) dropdownEmail.innerText = "Inicia sesión para más funciones";

            const sideFooter = document.querySelector('.side-menu-footer');
            if (sideFooter) sideFooter.style.display = 'none';
            const dropFooter = document.querySelector('.profile-dropdown .dropdown-footer');
            if (dropFooter) dropFooter.style.display = 'none';

            const restrictedItems = [
                'Perfil', 'Mis Tareas', 'Mis Trabajos', 'Postulaciones', 'Mensajes', 'Ajustes'
            ];
            
            const menuLinks = document.querySelectorAll('.side-menu ul li a');
            menuLinks.forEach(link => {
                if (restrictedItems.some(item => link.textContent.includes(item))) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.verificarSesion(null, "entrar a esta sección");
                    });
                }
            });

            const dropdownProfileLink = document.querySelector('.profile-dropdown a[href*="perfil.html"]');
            if (dropdownProfileLink) {
                dropdownProfileLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.verificarSesion(null, "ver tu perfil");
                });
            }
        }
    });

    const menuBtn = document.getElementById('menuBtn');
    const sideMenu = document.getElementById('sideMenu');

    function closeMobileFilters() {
        const filters = document.querySelectorAll('.show-mobile-filters');
        filters.forEach(f => f.classList.remove('show-mobile-filters'));
        const filterBtn = document.getElementById('mobile-filter-btn');
        if (filterBtn) {
            filterBtn.classList.remove('active');
            filterBtn.style.opacity = '1';
        }
    }

    if (menuBtn && sideMenu) {
        menuBtn.addEventListener('click', (e) => {
            const isOpening = !sideMenu.classList.contains('active');
            if (isOpening) {
               
                if (profileDropdown) profileDropdown.classList.remove('show');
                toggleNotificationsPanel(false);
                closeMobileFilters();
            }

            sideMenu.classList.toggle('active');

            menuBtn.classList.toggle('active');

            e.stopPropagation();
        });

        document.addEventListener('click', (e) => {
           
            if (!sideMenu.contains(e.target) && !menuBtn.contains(e.target)) {
                sideMenu.classList.remove('active');
                menuBtn.classList.remove('active');
            }
        });
    }

   // --- LÓGICA DEL MENÚ DESPLEGABLE DEL PERFIL ---
   
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            const isOpening = !profileDropdown.classList.contains('show');
            if (isOpening) {
               
                if (sideMenu) {
                    sideMenu.classList.remove('active');
                    if (menuBtn) menuBtn.classList.remove('active');
                }
                toggleNotificationsPanel(false);
                closeMobileFilters();
            }
            profileDropdown.classList.toggle('show');
            e.stopPropagation();
        });

        document.addEventListener('click', (e) => {
            if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        });
    }

   // --- LÓGICA GLOBAL DE CERRAR SESIÓN ---
    function procesarCerrarSesion() {
        showCustomConfirm(
            "Cerrar Sesión",
            "¿Estás seguro de que quieres cerrar sesión?",
            () => {
                localStorage.removeItem("loginTimestamp");
                auth.signOut().then(() => {

                    console.log("Sesión cerrada con éxito.");
                }).catch((error) => {
                    console.error("Error al cerrar sesión:", error);
                });
            },
            "Cerrar Sesión",
            "Cancelar",
            "delete",
            true
        );
    }

    const logoutLinks = document.querySelectorAll('a[href="login.html"], a[href="pages/login.html"]');
    logoutLinks.forEach(link => {
        if (link.textContent.toLowerCase().includes('cerrar sesi') || link.parentElement.innerHTML.includes('icono-cerrar-sesion')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                procesarCerrarSesion();
            });
        }
    });

   // --- 2. CAJA COMPLETA DEL SIDE MENU FOOTER ---
    const sideMenuFooter = document.querySelector('.side-menu-footer');
    if (sideMenuFooter) {
        sideMenuFooter.addEventListener('click', (e) => {
            procesarCerrarSesion();
        });
    }

   // --- 3. CAJA COMPLETA DEL DROPDOWN FOOTER (ESPECIALMENTE PARA MÓVIL DONDE EL TEXTO ESTÁ OCULTO) ---
    const dropdownFooter = document.querySelector('.profile-dropdown .dropdown-footer');
    if (dropdownFooter) {
        dropdownFooter.addEventListener('click', (e) => {
            procesarCerrarSesion();
        });
    }

    document.querySelectorAll('.logout-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            procesarCerrarSesion();
        });
    });

   // --- LÓGICA DE CONSENTIMIENTO DE COOKIES (RGPD) ---
    initCookieConsent();

    // --- LÓGICA DE ASISTENCIA AL CLIENTE ---
    const asistenciaLinks = document.querySelectorAll('#asistencia-cliente');
    asistenciaLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const adminUID = "Phym2MgXuhMKqOLV97cUe5uzDKC2";
            const isPage = window.location.pathname.includes('/pages/');
            const chatUrl = isPage ? `chat.html?userId=${adminUID}` : `pages/chat.html?userId=${adminUID}`;
            
            window.verificarSesion(() => {
                window.location.href = chatUrl;
            }, "abrir un chat de asistencia");
        });
    });

});

function injectAdminLinks(isPage) {
    const assetsBase = isPage ? '../assets/img/icons/' : 'assets/img/icons/';
    const adminUrl = isPage ? 'admin.html' : 'pages/admin.html';

    // 1. Inyectar en Menú Lateral (antes de Cerrar Sesión)
    const sideMenu = document.getElementById('sideMenu');
    if (sideMenu) {
        const ul = sideMenu.querySelector('ul');
        if (ul && !document.getElementById('side-admin-link')) {
            const li = document.createElement('li');
            li.id = 'side-admin-link';
            li.innerHTML = `<img src="${assetsBase}icono-panel-control.png"><a href="${adminUrl}">Panel de control</a>`;
            ul.appendChild(li);
        }
    }


}

function setupNotificationsLogic() {
    const sideMenu = document.getElementById('sideMenu');
    if (!sideMenu) return;

    let notifLink = document.getElementById('notifLink');
    if (!notifLink) {
        const ul = sideMenu.querySelector('ul');
        if (ul) {
            const li = document.createElement('li');
            li.innerHTML = `<img src="${window.location.pathname.includes('/pages/') ? '../assets/img/icons/icono-ajustes.png' : 'frontend/assets/img/icons/icono-ajustes.png'}"><a href="#" id="notifLink">Notificaciones</a>`;
            ul.appendChild(li);
            notifLink = li.querySelector('a');
        }
    }

    if (notifLink) {
        notifLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (profileDropdown) profileDropdown.classList.remove('show');

            if (sideMenu) {
                sideMenu.classList.remove('active');
                if (menuBtn) menuBtn.classList.remove('active');
            }

            toggleNotificationsPanel(true);
        });
    }

    const closeBtn = document.getElementById('closeNotifPanel');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => toggleNotificationsPanel(false));
    }
}

async function toggleNotificationsPanel(show) {
    const panel = document.getElementById('notificationsPanel');
    if (!panel) return;

    if (show) {
        panel.classList.add('active');
       
        await renderNotifications();
    } else {
        panel.classList.remove('active');
       
        const user = auth.currentUser;
        if (user) {
            await marcarNotificacionesComoLeidas(user.uid);
        }
    }
}

async function renderNotifications() {
    const container = document.getElementById('notifHeaderList');
    if (!container) return;

    const user = auth.currentUser;
    if (!user) {
        container.innerHTML = "<p class='notif-empty'>Inicia sesión para ver notificaciones.</p>";
        return;
    }

    container.innerHTML = "<div class='notif-loader'>Cargando...</div>";

    try {
        const notifs = await obtenerNotificaciones(user.uid);
        if (notifs.length === 0) {
            container.innerHTML = "<p class='notif-empty'>No tienes notificaciones todavía.</p>";
            return;
        }

        container.innerHTML = "";
        notifs.forEach(n => {
            const date = n.fecha?.toDate ? n.fecha.toDate().toLocaleString() : "";
            const item = document.createElement('div');
            item.className = `notif-item ${n.leida ? 'read' : 'unread'} type-${n.tipo}`;
            item.innerHTML = `
                <button class="notif-delete" title="Eliminar">×</button>
                <div class="notif-icon-box">
                    <img src="${getNotifIcon(n.tipo)}" alt="">
                </div>
                <div class="notif-content">
                    <h4>${n.titulo}</h4>
                    <p>${n.mensaje}</p>
                    <span class="notif-date">${date}</span>
                </div>
            `;

            const delBtn = item.querySelector('.notif-delete');
            delBtn.onclick = async (e) => {
                e.stopPropagation();
                try {
                    await eliminarNotificacion(user.uid, n.id);
                    item.style.opacity = '0';
                    item.style.transform = 'translateX(20px)';
                    setTimeout(() => {
                        item.remove();
                        if (container.children.length === 0) {
                            container.innerHTML = "<p class='notif-empty'>No tienes notificaciones todavía.</p>";
                        }
                    }, 300);
                } catch (err) {
                    console.error("Error eliminando notificación:", err);
                }
            };

            item.style.cursor = 'pointer';
            item.onclick = async () => {
                let targetUrl = null;
                const isPage = window.location.pathname.includes('/pages/');
                const prefix = isPage ? '' : 'pages/';

                switch (n.tipo) {
                    case 'nueva_postulacion':
                        targetUrl = prefix + 'postulaciones.html';
                        break;
                    case 'nuevo_trabajo':
                        if (n.id_trabajo) targetUrl = prefix + `mi-trabajo.html?id=${n.id_trabajo}`;
                        break;
                    case 'nivel':
                        targetUrl = prefix + 'perfil.html';
                        break;
                    case 'tarea_empezada':
                        if (n.id_trabajo) targetUrl = prefix + `mi-tarea.html?id=${n.id_trabajo}`;
                        break;
                    case 'trabajo_cancelado':
                        if (n.id_trabajo) targetUrl = prefix + `mi-trabajo.html?id=${n.id_trabajo}`;
                        break;
                    case 'tarea_abandonada':
                        if (n.id_trabajo) targetUrl = prefix + `mi-tarea.html?id=${n.id_trabajo}`;
                        break;
                    case 'pago':
                        targetUrl = prefix + 'ajustes.html#paymentHistoryContainer';
                        break;
                    case 'mensaje':
                        targetUrl = prefix + 'mensajes.html';
                        break;
                }

                if (targetUrl) {
                    try {
                        await eliminarNotificacion(user.uid, n.id);
                        window.location.href = targetUrl;
                    } catch (err) {
                        console.error("Error al procesar click en notificación:", err);
                    }
                }
            };

            container.appendChild(item);
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = "<p class='notif-empty'>Error al cargar notificaciones.</p>";
    }
}

function getNotifIcon(tipo) {
    const base = window.location.pathname.includes('/pages/') ? '../assets/img/icons/' : 'assets/img/icons/';
    switch (tipo) {
        case 'nivel': return base + 'noti/icono-noti-nivel.png';
        case 'mensaje': return base + 'noti/icono-noti-nuevo-mensaje.png';
        case 'pago': return base + 'noti/icono-noti-pago.png';
        case 'suscripcion': return base + 'noti/icono-noti-suscripcion.png';
        case 'valoracion': return base + 'noti/icono-noti-valoracion.png';
        case 'tarea_empezada': return base + 'noti/icono-noti-tarea-empezada.png';
        case 'nuevo_trabajo': return base + 'noti/icono-noti-nuevo-trabajo.png';
        case 'nueva_postulacion': return base + 'noti/icono-noti-nueva-postulacion.png';
        case 'trabajo_cancelado': return base + 'icono-no-blanco.png';
        case 'tarea_abandonada': return base + 'icono-no-blanco.png';
        case 'rechazado': return base + 'icono-no-blanco.png';
        case 'aceptado': return base + 'icono-si-blanco.png';
        case 'info': return base + 'icono-notificaciones.png';
        default: return base + 'icono-notificaciones.png';
    }
}

function injectNotificationsHtml() {
    if (document.getElementById('notificationsPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'notificationsPanel';
    panel.className = 'notifications-sidebar';
    panel.innerHTML = `
        <div class="notif-sidebar-header">
            <h3>Notificaciones</h3>
            <button id="closeNotifPanel">&times;</button>
        </div>
        <div class="notif-sidebar-body" id="notifHeaderList">
            <!-- Las notificaciones se inyectan aquí -->
        </div>
    `;
    document.body.appendChild(panel);
}

/* --- MODAL GLOBAL (ALERTS & CONFIRMS) --- */// --- FUNCIÓN PRINCIPAL QUE INYECTA EN TIEMPO DE EJECUCIÓN O RECUPERA (SI YA EXISTE) LA ESTRUCTURA BASE DEL MODAL DE ALERTAS GLOBAL EN EL BODY DE LA PÁGINA. ---
function injectModalHtml() {
    let modal = document.getElementById('global-custom-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'global-custom-modal';
        modal.className = 'modal-overlay hidden';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 id="global-modal-title"></h3>
                <p id="global-modal-message"></p>
                <div class="modal-buttons" id="global-modal-buttons"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    return modal;
}

window.showCustomAlert = function (title, message, btnText = "Aceptar", onClose = null) {
    const modal = injectModalHtml();
    document.getElementById('global-modal-title').innerText = title;

    const msgEl = document.getElementById('global-modal-message');
    msgEl.innerText = message;
    modal.querySelector('.modal-content').classList.remove('has-inputs');

    const btnContainer = document.getElementById('global-modal-buttons');
    btnContainer.innerHTML = `<button class="modal-btn confirm" id="global-modal-ok">${btnText}</button>`;

    modal.classList.remove('hidden');

    document.getElementById('global-modal-ok').onclick = () => {
        modal.classList.add('hidden');
        if (typeof onClose === 'function') onClose();
    };
};

window.showCustomConfirm = function (title, message, onConfirm, confirmText = "Aceptar", cancelText = "Cancelar", confirmClass = "confirm", centerText = false) {
    const modal = injectModalHtml();
    document.getElementById('global-modal-title').innerText = title;

    const msgEl = document.getElementById('global-modal-message');
    msgEl.innerText = message;
    modal.querySelector('.modal-content').classList.remove('has-inputs');

    const btnContainer = document.getElementById('global-modal-buttons');
    btnContainer.innerHTML = `
        <button class="modal-btn cancel" id="global-modal-cancel">${cancelText}</button>
        <button class="modal-btn ${confirmClass}" id="global-modal-confirm">${confirmText}</button>
    `;

    modal.classList.remove('hidden');

    document.getElementById('global-modal-cancel').onclick = () => {
        modal.classList.add('hidden');
    };

    document.getElementById('global-modal-confirm').onclick = () => {
        modal.classList.add('hidden');
        if (typeof onConfirm === 'function') onConfirm();
    };
};
// --- FUNCIÓN GENÉRICA PARA CUANDO SE REQUIERE PEDIR UN DATO AL USUARIO DE MANERA ACTIVA USANDO MODALES (COMO EL CAMBIO DE CONTRASEÑA) ---
window.showCustomPrompt = function (title, message, onConfirm, confirmText = "Aceptar", cancelText = "Cancelar", inputType = "text") {
    const modal = injectModalHtml();
    document.getElementById('global-modal-title').innerText = title;

    const msgEl = document.getElementById('global-modal-message');
    modal.querySelector('.modal-content').classList.add('has-inputs');

    msgEl.innerHTML = `
        <span>${message}</span><br>
        <input type="${inputType}" id="global-modal-input" class="modal-input" style="margin-top: 15px;">
    `;

    const btnContainer = document.getElementById('global-modal-buttons');
    btnContainer.innerHTML = `
        <button class="modal-btn cancel" id="global-modal-cancel">${cancelText}</button>
        <button class="modal-btn confirm" id="global-modal-confirm">${confirmText}</button>
    `;

    modal.classList.remove('hidden');

    setTimeout(() => document.getElementById('global-modal-input').focus(), 100);

    document.getElementById('global-modal-cancel').onclick = () => {
        modal.classList.add('hidden');
    };

    document.getElementById('global-modal-confirm').onclick = () => {
        modal.classList.add('hidden');
        const val = document.getElementById('global-modal-input').value;
        if (typeof onConfirm === 'function') onConfirm(val);
    };
};// --- LÓGICA DEL BADGE DE NOTIFICACIONES ---
function setupNotificationBadgeListener(uid) {
    const notifLink = document.getElementById('notifLink');
    if (!notifLink) return;

    let badge = notifLink.querySelector('.notif-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notif-badge hidden';
        notifLink.appendChild(badge);
    }

    const q = query(
        collection(db, "usuarios", uid, "notificaciones")
    );

    onSnapshot(q, (snapshot) => {
        const count = snapshot.size;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

window.showChangePasswordModal = function (onConfirm) {
    const modal = injectModalHtml();
    document.getElementById('global-modal-title').innerText = "Cambiar Contraseña";

    const msgEl = document.getElementById('global-modal-message');
    msgEl.innerHTML = `
        <div class="password-modal-container">
            <p style="margin-bottom: 20px; text-align: left; color: var(--gray-5);">Gestiona tu seguridad con una nueva clave.</p>
            
            <div class="modal-input-group">
                <label>Nueva Contraseña:</label>
                <div class="modal-pass-wrapper">
                    <input type="password" id="passNew" class="modal-input-pass" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
                    <button type="button" class="eye-toggle" data-target="passNew">
                        <img src="${getIconPath('icono-ojo-si.png')}" alt="Ver">
                    </button>
                </div>
            </div>

            <div class="modal-input-group">
                <label>Repetir Contraseña:</label>
                <div class="modal-pass-wrapper">
                    <input type="password" id="passRepeat" class="modal-input-pass" placeholder="Repite la clave" autocomplete="new-password">
                    <button type="button" class="eye-toggle" data-target="passRepeat">
                        <img src="${getIconPath('icono-ojo-si.png')}" alt="Ver">
                    </button>
                </div>
            </div>
            <p id="modalPassError" style="color: var(--red-2); font-size: 0.8125rem; margin-top: 10px; display: none; text-align: left;"></p>
        </div>
    `;

    const btnContainer = document.getElementById('global-modal-buttons');
    btnContainer.innerHTML = `
        <button class="modal-btn cancel" id="global-modal-cancel">Cancelar</button>
        <button class="modal-btn confirm" id="global-modal-confirm">Actualizar</button>
    `;

    modal.classList.remove('hidden');

    modal.querySelectorAll('.eye-toggle').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const img = btn.querySelector('img');
            if (input.type === 'password') {
                input.type = 'text';
                img.src = getIconPath('icono-ojo-no.png');
            } else {
                input.type = 'password';
                img.src = getIconPath('icono-ojo-si.png');
            }
        };
    });

    document.getElementById('global-modal-cancel').onclick = () => modal.classList.add('hidden');

    document.getElementById('global-modal-confirm').onclick = () => {
        const p1 = document.getElementById('passNew').value.trim();
        const p2 = document.getElementById('passRepeat').value.trim();
        const err = document.getElementById('modalPassError');

        if (p1.length < 6) {
            err.textContent = "La contraseña debe tener al menos 6 caracteres.";
            err.style.display = "block";
            return;
        }
        if (p1 !== p2) {
            err.textContent = "Las contraseñas no coinciden.";
            err.style.display = "block";
            return;
        }

        modal.classList.add('hidden');
        if (typeof onConfirm === 'function') onConfirm(p1);
    };

    function getIconPath(name) {
        const isPage = window.location.pathname.includes('/pages/');
        return isPage ? `../assets/img/icons/${name}` : `assets/img/icons/${name}`;
    }
};

/* --- *
 * --- LÓGICA DE CONFIRMACIÓN DE TAREAS VENCIDAS --- */

async function checkExpiredTasks(uid) {
    try {
        const tareas = await obtenerTareasPendientesConfirmacion(uid);
        
       // --- LIMPIEZA SILENCIOSA ---
       
       // --- ESTO PERMITE QUE EL SISTEMA CUMPLA CON EL MANUAL INCLUSO SI EL USUARIO IGNORA EL MODAL. ---
        for (const tarea of tareas) {
            await ejecutarResolucionTarea(tarea.id);
        }

        const tareasPendientes = await obtenerTareasPendientesConfirmacion(uid);
        if (tareasPendientes.length > 0) {
            showMandatoryCompletionModal(tareasPendientes[0]);
        }
    } catch (e) {
        console.error("Error al comprobar tareas vencidas:", e);
    }
}

function showMandatoryCompletionModal(tarea) {
    const isPublicador = tarea.es_publicador;
    const title = "Confirmación Obligatoria";
    const question = isPublicador
        ? `¿El trabajador ha completado el trabajo "${tarea.titulo}"?`
        : `¿Has completado el trabajo "${tarea.titulo}"?`;

    const modal = injectModalHtml();

    document.getElementById('global-modal-title').innerText = title;
    const msgEl = document.getElementById('global-modal-message');
    msgEl.innerText = question;
    msgEl.style.textAlign = 'center';
    msgEl.style.fontWeight = '600';

    const btnContainer = document.getElementById('global-modal-buttons');
    btnContainer.innerHTML = `
        <button class="modal-btn confirm" id="modal-resp-si" style="flex: 1;">Sí</button>
        <button class="modal-btn cancel" id="modal-resp-no" style="flex: 1;">No</button>
        <button class="modal-btn" id="modal-resp-espera" style="flex: 1; background: var(--gray-3); color: var(--neutral-white);">Espera</button>
    `;

   // --- MOSTRAR MODAL ---
    modal.classList.remove('hidden');

    const responder = async (respuesta) => {
        try {
            await registrarRespuestaConfirmacion(tarea.id, auth.currentUser.uid, respuesta);
            modal.classList.add('hidden');

            if (respuesta === 'si' || respuesta === 'no') {
                showCustomAlert("Respuesta Registrada", "Gracias por tu respuesta. Se procesará la resolución adecuada.");
            }
        } catch (e) {
            console.error("Error al registrar respuesta:", e);
            showCustomAlert("Error", "No se pudo registrar tu respuesta. Inténtalo de nuevo.");
        }
    };

    document.getElementById('modal-resp-si').onclick = () => responder('si');
    document.getElementById('modal-resp-no').onclick = () => responder('no');
    document.getElementById('modal-resp-espera').onclick = () => responder('espera');
}

/* --- *
 * --- LÓGICA DE INSTALACIÓN PWA --- */

const swPath = window.location.pathname.includes('/pages/') ? '../sw.js' : 'sw.js';
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(swPath).then(registration => {
            console.log('Service Worker registrado con éxito:', registration.scope);
        }).catch(err => {
            console.log('Error al registrar el Service Worker:', err);
        });
    });
}

window.deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
   
    e.preventDefault();
   // --- GUARDAR EL EVENTO PARA DISPARARLO CUANDO EL USUARIO HAGA CLIC EN "DESCARGAR APP" ---
    window.deferredPrompt = e;
    console.log('Evento beforeinstallprompt guardado y listo.');
});

window.instalarPWA = async function() {
    if (window.deferredPrompt) {
       
        window.deferredPrompt.prompt();
       
        const { outcome } = await window.deferredPrompt.userChoice;
        console.log(`El usuario decidió: ${outcome}`);
       
        window.deferredPrompt = null;
    } else {
       // --- COMPROBAR SI ES UN DISPOSITIVO IOS, DONDE APPLE NO PERMITE LANZAR EL PROMPT ---
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            window.showCustomAlert(
                "Instalar LaburApp", 
                "Para instalar la app en iOS, toca el botón 'Compartir' (el cuadrado con la flecha hacia arriba) en la barra de tu navegador y selecciona 'Añadir a la pantalla de inicio'."
            );
        } else {
           
            window.showCustomAlert(
                "Error al instalar", 
                "La aplicación ya está instalada en tu dispositivo o tu navegador no permite usar este botón. Puedes instalarla manualmente desde el menú superior de tu navegador."
            );
        }
    }
};

/**
 * --- GESTIÓN DE VISIBILIDAD DE ANUNCIOS ---
 * Oculta los anuncios si el usuario tiene una suscripción activa (Jefe o Currante).
 */
function gestionarVisibilidadAnuncios(perfil) {
    if (!perfil) return;
    const esSuscrito = (perfil.id_suscripcion_cliente === 'jefe') || (perfil.id_suscripcion_trabajador === 'currante');

    if (esSuscrito) {
        // Ocultar todos los contenedores de AdSense
        const ads = document.querySelectorAll('.adsbygoogle, ins.adsbygoogle');
        ads.forEach(ad => {
            ad.style.display = 'none';
            // También ocultamos el contenedor padre si es un div de anuncio
            if (ad.parentElement && ad.parentElement.classList.contains('ad-container')) {
                ad.parentElement.style.display = 'none';
            }
        });
        console.log("Suscripción activa detectada: Anuncios ocultos.");
    }
}
