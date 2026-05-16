import { auth } from './firebase-config.js';
import { obtenerTrabajos, crearTrabajo, obtenerMetodosPago, usuarioTieneMetodoPago } from './database.js';

let allTrabajosDB = [], myMarkers = [], tempMarker = null, creatingMode = false;
const map = L.map('map').setView([0, 0], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

let userMarker = null, userCircle = null;
let userLat = 0, userLng = 0;

/* --- UBICACIÓN REAL USUARIO --- */
const mobileFilterBtn = document.getElementById('mobile-filter-btn');
const filterPanel = document.getElementById('filter-panel');
if (mobileFilterBtn && filterPanel) {
    mobileFilterBtn.addEventListener('click', () => {
        const isOpening = !filterPanel.classList.contains('show-mobile-filters');
        if (isOpening) {
            const sideMenu = document.getElementById('sideMenu');
            const profileDropdown = document.getElementById('profileDropdown');
            const menuBtn = document.getElementById('menuBtn');
            const notificationsPanel = document.getElementById('notificationsPanel');

            if (sideMenu) sideMenu.classList.remove('active');
            if (menuBtn) menuBtn.classList.remove('active');
            if (profileDropdown) profileDropdown.classList.remove('show');
            if (notificationsPanel) notificationsPanel.classList.remove('active');
        }
        filterPanel.classList.toggle('show-mobile-filters');
        mobileFilterBtn.classList.toggle('active');
        mobileFilterBtn.style.opacity = '1';
    });

    document.addEventListener('click', (e) => {
        if (filterPanel.classList.contains('show-mobile-filters') &&
            !filterPanel.contains(e.target) &&
            !mobileFilterBtn.contains(e.target)) {

            filterPanel.classList.remove('show-mobile-filters');
            mobileFilterBtn.classList.remove('active');
        }
    });
}

auth.onAuthStateChanged(user => {
    loadRealJobs();
});

setTimeout(() => {
    map.invalidateSize();
}, 500);

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;

        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([userLat, userLng], { icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png', iconSize: [25, 25] }) })
            .addTo(map).bindPopup("Tú estás aquí").openPopup();
        map.setView([userLat, userLng], 13);

        updateVisibleMarkers();
        aplicarFiltros();
    }, () => {
       
        userLat = 43.2630; userLng = -2.9349;
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([userLat, userLng], { icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png', iconSize: [25, 25] }) })
            .addTo(map).bindPopup("Ubicación por defecto: Bilbao").openPopup();
        map.setView([userLat, userLng], 13);
        updateVisibleMarkers();
        aplicarFiltros();
    });
}

async function loadRealJobs() {
    try {
       
        myMarkers.forEach(m => map.removeLayer(m));
        myMarkers = [];

        allTrabajosDB = await obtenerTrabajos();

        const user = auth.currentUser;
        if (user) {
            allTrabajosDB = allTrabajosDB.filter(t => t.id_publicador !== user.uid);
        }

        allTrabajosDB.forEach(t => {
            if (t.latitud && t.longitud) {
                const color = getColor(t.id_categoria);
                const marker = L.circleMarker([t.latitud, t.longitud], {
                    radius: 8,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.9
                });

                const xp = t.xp_otorgada || Math.round(t.pago_cliente * 10);
                const pagoDisplay = t.pago_cliente || 0;

                const popupContent = `
            <div style="font-family: inherit; min-width: 180px;">
                <h3 style="margin: 0 0 8px; color: var(--gray-9); font-size: 1rem; display: flex; align-items: center; gap: 8px;">
                    ${t.titulo}
                    ${(t.prioridad_suscripcion || 0) !== 0 ? '<span style="background: var(--blue-2); color: var(--neutral-white); font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; font-weight: bold; display: flex; align-items: center; gap: 4px;"><img src="../assets/img/icons/icono-estrella.png" style="width: 10px; filter: brightness(0) invert(1);">JEFE</span>' : ''}
                </h3>
                <div style="display:flex; align-items:center; gap: 6px; margin-bottom: 5px;">
                    <img src="../assets/img/icons/icono-categoria-color.png" style="width:14px; vertical-align:middle; gap: 10px; margin-top: 2px;">
                    <span style="font-size: 0.8125rem; color: var(--gray-6);"><b>${getStandardName(t.id_categoria)}</b></span>
                </div>

                <div style="display:flex; align-items:center; gap: 6px; margin-bottom: 5px;">
                        <img src="../assets/img/icons/icono-dinero-color.png" style="width:14px; vertical-align:middle; gap: 10px; margin-top: 2px;"> 
                        <span style="font-size: 0.8125rem; color: var(--gray-6);"><b>${Number(t.pago_cliente).toFixed(2)} €</b></span>
                </div>

                <div style="display:flex; align-items:center; gap: 6px; margin-bottom: 5px;">
                        <img src="../assets/img/icons/icono-xp-color.png" style="width:14px; vertical-align:middle; gap: 10px; margin-top: 2px;"> 
                        <span style="font-size: 0.8125rem; color: var(--gray-6);"><b>${xp} XP</b></span>
                </div>

                <button class="popup-btn" data-id="${t.id}" style="cursor:pointer; background: var(--neutral-black); color: var(--neutral-white); border: none; padding: 2px 8px; border-radius: 4px; margin-top: 5px;">Más</button>
            </div>`;

                marker.bindPopup(popupContent);

                marker.on('popupopen', () => {
                    const btn = document.querySelector(`.popup-btn[data-id="${t.id}"]`);
                    if (btn) btn.onclick = () => verMasReal(t.id);
                });

                myMarkers.push(marker);
            }
        });

        aplicarFiltros();
    } catch (e) {
        console.error("Error cargando marcadores:", e);
    }
}

function getStandardName(catId) {
    const names = {
        'carpinteria': 'Carpintería',
        'construccion': 'Construcción/Reforma',
        'cuidado_personal': 'Cuidado personal',
        'diseno': 'Diseño',
        'evento': 'Evento',
        'gastronomia': 'Gastronomía',
        'informatica': 'Informática',
        'jardineria': 'Jardinería',
        'limpieza': 'Limpieza',
        'mascotas': 'Mascotas',
        'mudanza': 'Mudanza/Traslado',
        'transporte': 'Transporte',
        'otros': 'Otros'
    };
    return names[catId] || catId || 'Otros';
}

/* --- COLORES --- */
function getColor(cat) {
    const categoryMap = {
        "carpinteria": "var(--cat-1)",
        "construccion": "var(--cat-2)",
        "cuidado_personal": "var(--cat-3)",
        "diseno": "var(--cat-4)",
        "evento": "var(--cat-5)",
        "gastronomia": "var(--cat-6)",
        "informatica": "var(--cat-7)",
        "jardineria": "var(--cat-8)",
        "limpieza": "var(--cat-9)",
        "mascotas": "var(--cat-10)",
        "mudanza": "var(--cat-11)",
        "transporte": "var(--cat-12)",
        "otros": "var(--cat-13)"
    };

    if (!cat) return categoryMap["otros"];

    let key = cat.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .trim();

    return categoryMap[key] || categoryMap[key.replace(" ", "_")] || categoryMap["otros"];
}

/* --- CREAR MARCADOR --- */
function crearMarcador(latlng) {
    if (tempMarker) map.removeLayer(tempMarker);
    const initialColor = getColor(document.getElementById("job-category").value);
    tempMarker = L.circleMarker(latlng, { radius: 8, color: initialColor, fillColor: initialColor, fillOpacity: 0.9 }).addTo(map);

    document.getElementById("marker-view-box").classList.add("hidden");
    document.getElementById("marker-form-box").classList.remove("hidden");
    document.getElementById("marker-form-box").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("job-category").addEventListener("change", (e) => {
    if (tempMarker) {
        const newColor = getColor(e.target.value);
        tempMarker.setStyle({ color: newColor, fillColor: newColor });
    }
});

map.on("click", e => { if (creatingMode) { creatingMode = false; crearMarcador(e.latlng); } });

/* --- GUARDAR TRABAJO REAL --- */
document.getElementById("save-job-btn").addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
        showCustomAlert("Acceso Denegado", "Debes estar logueado para crear un trabajo.");
        return;
    }

    try {
        const metodos = await obtenerMetodosPago(user.uid);
        if (metodos.length === 0) {
            showCustomConfirm(
                "Método de Pago Requerido",
                "Para publicar un trabajo debes tener al menos un método de pago guardado.",
                () => { window.location.href = "ajustes.html"; },
                "Ir a Ajustes",
                "Cancelar"
            );
            return;
        }
    } catch (error) {
        console.error("Error al verificar métodos de pago:", error);
    }

    const t = document.getElementById("job-title").value,
        d = document.getElementById("job-desc").value,
        a = document.getElementById("job-address").value,
        dl = document.getElementById("job-deadline").value,
        pU = parseFloat(document.getElementById("job-price").value),
        time = parseInt(document.getElementById("job-time").value),
        cat = document.getElementById("job-category").value.toLowerCase();

    if (!t || !d || !a || !dl || isNaN(pU) || !time || !cat) {
        showCustomAlert("Error en Formulario", "Todos los campos son obligatorios.");
        return;
    }

    if (!tempMarker) {
        showCustomAlert("Error en Formulario", "Selecciona una ubicacion en el mapa antes de guardar.");
        return;
    }

    try {
        const coords = tempMarker.getLatLng();
        await crearTrabajo({
            titulo: t,
            descripcion: d,
            direccion: a,
            fecha_limite: new Date(dl),
            pagoCliente: pU,
            tiempo_estimado_horas: time,
            id_categoria: cat,
            latitud: Number(coords.lat.toFixed(6)),
            longitud: Number(coords.lng.toFixed(6))
        });

        showCustomAlert("Éxito", "Trabajo publicado correctamente en el mapa.");
        ["job-title", "job-desc", "job-address", "job-deadline", "job-price", "job-time"].forEach(id => document.getElementById(id).value = "");
        document.getElementById("job-category").value = "";
        document.getElementById("marker-form-box").classList.add("hidden");
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = null;

        await loadRealJobs();
    } catch (e) {
        console.error("Error al guardar:", e);
        showCustomAlert("Error", "No se pudo publicar el trabajo.");
    }
});

/* --- CANCELAR CREACIÓN --- */
document.getElementById("cancel-job-btn").addEventListener("click", () => {
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = null;
    document.getElementById("marker-form-box").classList.add("hidden");
});

/* --- VER MÁS REAL --- */
function verMasReal(jobId) {
    const t = allTrabajosDB.find(x => x.id === jobId);
    if (!t) return;

    document.getElementById("view-title").innerText = t.titulo;
    document.getElementById("view-desc").innerText = t.descripcion || "Sin descripción";
    document.getElementById("view-address").innerText = t.direccion || "No especificada";

    let dlStr = "Sin fecha";
    if (t.fecha_limite) {
        const d = t.fecha_limite.toDate ? t.fecha_limite.toDate() : new Date(t.fecha_limite);
        dlStr = d.toLocaleDateString();
    }
    document.getElementById("view-deadline").innerText = dlStr;

    const xp = t.xp_otorgada || Math.round(t.pago_cliente * 10);
    const pagoDisplay = t.pago_cliente || 0;

    document.getElementById("view-price").innerText = Number(pagoDisplay).toFixed(2);
    document.getElementById("view-category").innerText = getStandardName(t.id_categoria);
    document.getElementById("view-xp").innerText = xp;

    const btnVerTodo = document.getElementById("view-all-btn");
    if (btnVerTodo) {
        btnVerTodo.onclick = () => {
            window.location.href = `trabajo.html?id=${t.id}`;
        };
    }

    document.getElementById("marker-form-box").classList.add("hidden");
    document.getElementById("marker-view-box").classList.remove("hidden");
    document.getElementById("marker-view-box").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("close-view-btn").addEventListener("click", () => document.getElementById("marker-view-box").classList.add("hidden"));

/* --- BOTÓN AÑADIR MARCADOR --- */
const btnAdd = document.getElementById("create-marker-btn");
if (btnAdd) {
    btnAdd.addEventListener("click", async () => {
        if (creatingMode || tempMarker) {
            showCustomAlert("Atención", "Ya tienes un marcador pendiente de colocar o configurar en el mapa.");
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            window.verificarSesion(null, "publicar un trabajo");
            return;
        }

        try {
           
            const tienePago = await usuarioTieneMetodoPago(user.uid);
            if (!tienePago) {
                showCustomConfirm(
                    "Atención",
                    "Antes de publicar trabajos en el mapa, necesitas añadir un método de pago en los ajustes.",
                    () => { window.location.href = "ajustes.html"; },
                    "Ir a Ajustes",
                    "Cancelar"
                );
                return;
            }

            creatingMode = true;
            tempMarker = null;
            showCustomAlert("Añadir Marcador", "Haz click en un lugar del mapa para ubicar tu nuevo trabajo.", "Entendido");
        } catch (error) {
            console.error("Error al verificar métodos de pago:", error);
            showCustomAlert("Error", "No pudimos verificar tu información de pago. Inténtalo de nuevo.");
        }
    });
}

function updateVisibleMarkers() {
    if (!userMarker) return;
    const range = parseFloat(document.getElementById("filter-range")?.value || 10);
    if (userCircle) map.removeLayer(userCircle);
    userCircle = L.circle([userLat, userLng], { radius: range * 1000, color: 'rgb(220,108,108)', fillOpacity: 0.1 }).addTo(map);
}

function aplicarFiltros() {
    const cat = document.getElementById("filter-cat").value.toLowerCase();
    const range = parseFloat(document.getElementById("filter-range").value);
    const priceMin = parseFloat(document.getElementById("filter-price-min").value);
    const priceMax = parseFloat(document.getElementById("filter-price-max").value);

    const isFiltered = cat !== "" || range !== 1 || priceMin !== 2 || priceMax !== 1000;
    const title = document.getElementById('mapa-title');
    const iconHtml = '<img src="../assets/img/icons/icono-mapa-blanco.png" style="width: 35px; vertical-align: middle; margin-right: 10px;" alt=""> ';
    if (title) {
        title.innerHTML = isFiltered ? iconHtml + "MAPA: Filtrado" : iconHtml + "MAPA: Todos";
    }

    updateVisibleMarkers();

    myMarkers.forEach(m => map.removeLayer(m));

    allTrabajosDB.forEach((t, index) => {
        const marker = myMarkers[index];
        if (!marker) return;

        const dist = calcDist(userLat, userLng, t.latitud, t.longitud);
        const pagoFiltro = t.pago_cliente || 0;

        const matchCat = cat === "" || (t.id_categoria && t.id_categoria.toLowerCase() === cat);
       
        const matchRange = userLat === 0 || dist <= range;
        const matchPrice = pagoFiltro >= priceMin && pagoFiltro <= priceMax;

        if (matchCat && matchRange && matchPrice) {
            marker.addTo(map);
        }
    });
}

function calcDist(lat1, lon1, lat2, lon2) {
    let R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    let a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

document.getElementById("filter-range").addEventListener("input", function () {
    document.getElementById("range-val").textContent = this.value;
    updateVisibleMarkers();
});

document.getElementById("apply-filters-btn").addEventListener("click", () => {
    aplicarFiltros();

    const filterPanel = document.getElementById('filter-panel');
    const mobileFilterBtn = document.getElementById('mobile-filter-btn');
    if (filterPanel && filterPanel.classList.contains('show-mobile-filters')) {
        filterPanel.classList.remove('show-mobile-filters');
        if (mobileFilterBtn) mobileFilterBtn.classList.remove('active');
    }
});
