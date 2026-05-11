import { auth } from './firebase-config.js';
import { obtenerTrabajoPorId, obtenerPostulacionesDeUnTrabajo, postularseATrabajo, usuarioTieneMetodoPago } from './database.js';

document.addEventListener("DOMContentLoaded", async function () {
   
    const urlParams = new URLSearchParams(window.location.search);
    const trabajoId = urlParams.get('id');

    if (!trabajoId) {
        console.error("No se proporcionó ID de trabajo");
        return;
    }

    let currentTrabajo = null;

    try {
        currentTrabajo = await obtenerTrabajoPorId(trabajoId);
        if (currentTrabajo) {
            renderTrabajo(currentTrabajo);
            checkUserRelation(currentTrabajo);
        } else {
            console.error("Trabajo no encontrado");
        }
    } catch (e) {
        console.error("Error cargando detalle del trabajo:", e);
    }

    async function checkUserRelation(trabajo) {
        auth.onAuthStateChanged(async (user) => {
            const btnPostular = document.getElementById("btn-postular");
            const btnChat = document.getElementById("btn-chat");

            if (!user) {
                if (btnPostular) {
                    btnPostular.style.display = 'block';
                    btnPostular.onclick = () => window.verificarSesion(null, "postularte a este trabajo");
                }
                if (btnChat) {
                    btnChat.onclick = (e) => {
                        e.preventDefault();
                        window.verificarSesion(null, "chatear con el publicador");
                    };
                }
                return;
            }

            if (user.uid === trabajo.id_publicador) {
                if (btnPostular) btnPostular.style.display = 'none';
                return;
            }

            if (trabajo.estado !== "Pendiente") {
                if (btnPostular) btnPostular.style.display = 'none';
                return;
            }

            const postulaciones = await obtenerPostulacionesDeUnTrabajo(trabajo.id);
            const yaPostulado = postulaciones.some((post) => post.id_usuario === user.uid);

            if (yaPostulado) {
                if (btnPostular) {
                    btnPostular.innerText = "YA POSTULADO";
                    btnPostular.disabled = true;
                    btnPostular.style.opacity = "0.6";
                    btnPostular.style.display = 'block';
                }
            } else {
                if (btnPostular) {
                    btnPostular.style.display = 'block';
                    btnPostular.onclick = async () => {
                       // --- VERIFICAR MÉTODO DE PAGO ---
                        const tienePago = await usuarioTieneMetodoPago(user.uid);
                        if (!tienePago) {
                            showCustomConfirm(
                                "Acción Requerida",
                                "Para poder postularte a un trabajo, primero debes añadir un método de pago en los ajustes.",
                                () => { window.location.href = "ajustes.html"; },
                                "Ir a Ajustes",
                                "Cancelar"
                            );
                            return;
                        }

                        showCustomConfirm(
                            "Postularse",
                            "¿Quieres postularte a este trabajo?",
                            async () => {
                                try {
                                    await postularseATrabajo(trabajo.id);
                                    showCustomAlert("¡Éxito!", "Te has postulado correctamente.");
                                    btnPostular.innerText = "YA POSTULADO";
                                    btnPostular.disabled = true;
                                    btnPostular.style.opacity = "0.6";
                                } catch (err) {
                                    showCustomAlert("Error", "No se pudo realizar la postulación.");
                                }
                            }
                        );
                    };
                }
            }
        });
    }

   // --- 3. LÓGICA DEL BOTÓN DE CHAT ---
    const btnChat = document.getElementById("btn-chat");
    if (btnChat) {
        btnChat.addEventListener("click", function (e) {
            e.preventDefault();

            window.verificarSesion(() => {
                if (currentTrabajo && currentTrabajo.id_publicador) {
                    window.location.href = `chat.html?id=${trabajoId}&userId=${currentTrabajo.id_publicador}`;
                }
            }, "chatear con el publicador");
        });
    }
});

function renderTrabajo(trabajo) {
   
    const imgEl = document.querySelector('.job-img');
    if (imgEl) {
        imgEl.src = trabajo.foto_trabajo || "../assets/img/trabajo-defecto.png";
    }

    const titleEl = document.querySelector('.job-title');
    if (titleEl) titleEl.innerText = trabajo.titulo;

    const descEl = document.querySelector('.job-description');
    if (descEl) descEl.innerText = trabajo.descripcion || "Sin descripción detallada.";

    const locEl = document.querySelector('.italic');
    if (locEl) locEl.innerText = trabajo.direccion || "Ubicación no especificada";

    const xp = trabajo.xp_otorgada || Math.round(trabajo.pago_cliente * 10);

    const statValues = document.querySelectorAll('.stat-value');
    if (statValues.length >= 2) {
        statValues[0].innerText = `${Number(trabajo.pago_cliente).toFixed(2)} €`;
        statValues[1].innerText = `${xp} XP`;
    }

    const infoTexts = document.querySelectorAll('.info-text');
    if (infoTexts.length >= 3) {
       
        const catName = trabajo.id_categoria ? trabajo.id_categoria.charAt(0).toUpperCase() + trabajo.id_categoria.slice(1) : "Otros";
        infoTexts[0].innerText = catName;

        infoTexts[1].innerText = `${trabajo.tiempo_estimado_horas}h`;

        let fechaStr = "Sin fecha";
        if (trabajo.fecha_limite) {
           
            const f = trabajo.fecha_limite.toDate ? trabajo.fecha_limite.toDate() : new Date(trabajo.fecha_limite);
            fechaStr = f.toLocaleDateString();
        }
        infoTexts[2].innerText = fechaStr;
    }

    if (trabajo.latitud && trabajo.longitud) {
        initMiniMap(trabajo.latitud, trabajo.longitud, trabajo.id_categoria);
    }
}

function initMiniMap(lat, lng, cat) {
    const miniMap = L.map('mini-map', {
        zoomControl: true,
        dragging: !L.Browser.mobile,
        touchZoom: true,
        scrollWheelZoom: false
    }).setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(miniMap);

    const colorMap = {
        "carpinteria": "var(--cat-1)", "construccion": "var(--cat-2)", "cuidado_personal": "var(--cat-3)",
        "diseno": "var(--cat-4)", "evento": "var(--cat-5)", "gastronomia": "var(--cat-6)",
        "informatica": "var(--cat-7)", "jardineria": "var(--cat-8)", "limpieza": "var(--cat-9)",
        "mascotas": "var(--cat-10)", "mudanza": "var(--cat-11)", "transporte": "var(--cat-12)", "otros": "var(--cat-13)"
    };
    const color = colorMap[cat?.toLowerCase()] || "var(--neutral-black)";

    L.circleMarker([lat, lng], {
        radius: 10,
        color: color,
        fillColor: color,
        fillOpacity: 0.8
    }).addTo(miniMap).bindPopup("Ubicación del trabajo").openPopup();

    setTimeout(() => miniMap.invalidateSize(), 500);
}
