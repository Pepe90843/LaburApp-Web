import { auth } from './firebase-config.js';
import { obtenerUsuarioPorId, obtenerTodosPuntosCategorias, obtenerValoracionesRecibidas } from './database.js';
// --- LÓGICA CARGADA AL VISUALIZAR EL PERFIL DE UN USUARIO EXTERNO ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (!userId) {
        console.error("No se proporcionó ID de usuario");
        return;
    }

    const catInfo = {
        'carpinteria': { nombre: 'Carpintería', color: 'cat-dot-carpinteria' },
        'construccion': { nombre: 'Construcción/Reforma', color: 'cat-dot-construccion' },
        'cuidado_personal': { nombre: 'Cuidado personal', color: 'cat-dot-cuidado_personal' },
        'diseno': { nombre: 'Diseño', color: 'cat-dot-diseno' },
        'evento': { nombre: 'Evento', color: 'cat-dot-evento' },
        'gastronomia': { nombre: 'Gastronomía', color: 'cat-dot-gastronomia' },
        'informatica': { nombre: 'Informática', color: 'cat-dot-informatica' },
        'jardineria': { nombre: 'Jardinería', color: 'cat-dot-jardineria' },
        'limpieza': { nombre: 'Limpieza', color: 'cat-dot-limpieza' },
        'mascotas': { nombre: 'Mascotas', color: 'cat-dot-mascotas' },
        'mudanza': { nombre: 'Mudanza/Traslado', color: 'cat-dot-mudanza' },
        'transporte': { nombre: 'Transporte', color: 'cat-dot-transporte' },
        'otros': { nombre: 'Otros', color: 'cat-dot-otros' }
    };

    loadUserData(userId);

    async function loadUserData(uid) {
        try {
            const user = await obtenerUsuarioPorId(uid);

            const ptsCat = await obtenerTodosPuntosCategorias(uid);

            const valoraciones = await obtenerValoracionesRecibidas(uid);

            if (user) {
                renderUser(user, ptsCat);
                renderValoraciones(valoraciones);
            } else {
                console.error("Usuario no encontrado");
            }
        } catch (e) {
            console.error("Error cargando usuario:", e);
        }
    }

    function renderUser(user, ptsCat) {
        document.querySelector('h1').textContent = user.nombre_completo || (user.nombre + " " + user.apellidos);
        document.querySelector('.description').textContent = user.bio || "Este usuario aún no tiene biografia.";
        document.querySelector('.italic').textContent = user.direccion_principal || "Ubicación no especificada";

        const pdfRow = document.getElementById('pdfRow');
        const displayPDF = document.getElementById('displayPDF');
        if (user.curriculum_url) {
            if (pdfRow) pdfRow.style.display = "flex";
            if (displayPDF) displayPDF.href = user.curriculum_url;
        } else {
            if (pdfRow) pdfRow.style.display = "none";
        }

        const pic = document.querySelector('.profile-pic');
        if (pic) pic.src = user.foto_perfil || "../assets/img/avatar-defecto.png";

        const nLvl = user.nivel || 1;
        const xpActual = user.experiencia_nivel_actual || 0;
        const maxXP = 100 + (nLvl - 1) * 50;

        document.querySelector('.lvl-val').textContent = nLvl;
        const xpBars = document.querySelectorAll('.xp-header span');
        if (xpBars.length >= 3) {
            xpBars[1].textContent = `${xpActual} XP`;
            xpBars[2].textContent = `${maxXP} XP`;
        }
        const xpFill = document.querySelector('.xp-fill');
        if (xpFill) {
            xpFill.style.width = Math.min((xpActual / maxXP) * 100, 100) + "%";
        }

        const stats = document.querySelectorAll('.stat-item strong');
        if (stats.length >= 3) {
            stats[0].textContent = (user.valoracion_media !== undefined ? user.valoracion_media : 2.5).toFixed(1);

            let maxPts = -1;
            let bestCatId = null;
            let oldestDate = Infinity;

            ptsCat.forEach(c => {
                if (c.puntos > maxPts) {
                    maxPts = c.puntos;
                    bestCatId = c.id_categoria;
                    oldestDate = c.fecha_creacion;
                } else if (c.puntos === maxPts && c.puntos > 0) {
                   
                    if (c.fecha_creacion < oldestDate) {
                        bestCatId = c.id_categoria;
                        oldestDate = c.fecha_creacion;
                    }
                }
            });

            if (bestCatId && maxPts > 0) {
                const info = catInfo[bestCatId] || { nombre: bestCatId };
                stats[1].textContent = `${info.nombre} (${maxPts} pts)`;
            } else {
                stats[1].textContent = "Ninguna (0 pts)";
            }

            stats[2].textContent = (user.dinero_ganado_total || 0).toLocaleString() + " €";
        }

        const grid = document.querySelector('.cat-grid');
        if (grid) {
            ptsCat.sort((a, b) => b.puntos - a.puntos);
            grid.innerHTML = "";
            ptsCat.forEach(c => {
                if (c.puntos > 0) {
                    const info = catInfo[c.id_categoria.toLowerCase()] || { nombre: c.id_categoria, color: 'cat-dot-otros' };
                    const div = document.createElement('div');
                    div.className = 'cat-item';
                    div.innerHTML = `<span class="dot ${info.color}"></span> <strong>${info.nombre}:</strong> ${c.puntos} puntos`;
                    grid.appendChild(div);
                }
            });
            if (grid.innerHTML === "") {
                grid.innerHTML = "<p>Sin puntuaciones en categorías.</p>";
            }
        }
    }

    function renderValoraciones(valoraciones) {
        const list = document.getElementById('reviewsList');
        if (!list) return;

        list.innerHTML = "";

        if (!valoraciones || valoraciones.length === 0) {
            list.innerHTML = "<p style='color: var(--gray-5);'>Este usuario aún no tiene valoraciones.</p>";
            return;
        }

        const LIMIT = 5;
        const visibles = valoraciones.slice(0, LIMIT);
        const ocultas = valoraciones.slice(LIMIT);

        function crearCard(val) {
            const div = document.createElement('div');
            div.className = 'review-card';

            const foto = val.emisor_foto || "../assets/img/avatar-defecto.png";
            const nombre = val.emisor_nombre || "Usuario Anónimo";
            const puntos = val.puntuacion || 0;
            const comentario = val.comentario || "<i style='color:#999'>Sin comentario.</i>";

            let estrellasHTML = "";
            for (let i = 1; i <= 5; i++) {
                if (i <= puntos) {
                    estrellasHTML += `<span style="color: var(--yellow-2); font-size: 1.125rem;">&#9733;</span>`;
                } else {
                    estrellasHTML += `<span style="color: var(--gray-3); font-size: 1.125rem;">&#9733;</span>`;
                }
            }

            let fechaStr = "";
            if (val.fecha) {
                const date = val.fecha.toDate ? val.fecha.toDate() : new Date(val.fecha);
                fechaStr = date.toLocaleDateString();
            }

            div.innerHTML = `
                <div class="review-header">
                    <a href="usuario.html?id=${val.id_usuario_emisor}" style="text-decoration:none; display:flex; align-items:center; gap:12px; color:inherit;">
                        <img src="${foto}" alt="${nombre}" class="review-avatar" style="margin:0;">
                    </a>
                    <div class="review-user-info">
                        <a href="usuario.html?id=${val.id_usuario_emisor}" style="text-decoration:none; color:inherit;">
                            <strong>${nombre}</strong>
                        </a>
                        <div class="review-stars-date">
                            <span class="stars">${estrellasHTML}</span>
                            <span class="review-date">${fechaStr}</span>
                        </div>
                    </div>
                </div>
                <div class="review-body">
                    ${val.titulo_trabajo ? `<span style="display:block; font-size: 0.75rem; color: var(--gray-4); margin-bottom: 5px;">Trabajo: <b>${val.titulo_trabajo}</b></span>` : ''}
                    <p>${comentario}</p>
                </div>
            `;
            return div;
        }

        visibles.forEach(val => list.appendChild(crearCard(val)));

        if (ocultas.length > 0) {
            const btnVerMas = document.createElement('button');
            btnVerMas.id = 'btnVerMasValoraciones';
            btnVerMas.className = 'btn-ver-mas-valoraciones';
            btnVerMas.textContent = `Ver más valoraciones (${ocultas.length} restantes)`;
            btnVerMas.addEventListener('click', () => {
                ocultas.forEach(val => list.appendChild(crearCard(val)));
                btnVerMas.remove();
            });
            list.after(btnVerMas);
        }
    }

    const btnChat = document.getElementById('btn-chat');
    if (btnChat) {
        btnChat.addEventListener('click', (e) => {
            e.preventDefault();
            window.verificarSesion(() => {
                window.location.href = `chat.html?userId=${userId}`;
            }, "iniciar un chat con este usuario");
        });
    }
});
