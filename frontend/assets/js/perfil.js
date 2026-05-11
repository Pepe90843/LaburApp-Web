import { auth, storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { obtenerPerfilUsuario, actualizarPerfilUsuario, obtenerTodosPuntosCategorias, cancelarSuscripcionUsuario, cambiarPassword } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    const passLabel = document.getElementById('passLabel');
    const btnChangePass = document.getElementById('btnChangePass');

    const displayName = document.getElementById('displayName');
    const displayDescription = document.getElementById('displayDescription');
    const displayAddress = document.getElementById('displayAddress');
    const displayPic = document.getElementById('displayPic');

    const lvlVal = document.querySelector('.lvl-val');
    const lvlBars = document.querySelectorAll('.xp-header span');// --- [0 XP, ACTUAL XP, MAX XP] ---
    const xpFill = document.querySelector('.xp-fill');
    const statItems = document.querySelectorAll('.stat-item strong');
    const catGrid = document.querySelector('.cat-grid');

    const infoCards = document.querySelectorAll('.info-card');
    let subsBody = null;
    let cuentaBody = null;
    infoCards.forEach(card => {
        if (card.querySelector('.card-title') && card.querySelector('.card-title').textContent.includes('Suscripciones')) {
            subsBody = card.querySelector('.card-body');
        }
        if (card.querySelector('.card-title') && card.querySelector('.card-title').textContent.includes('Cuenta')) {
            cuentaBody = card.querySelector('.card-body');
        }
    });

   // --- REFERENCIAS MODAL ---
    const modal = document.getElementById('editModal');
    const btnOpen = document.getElementById('btnOpenEdit');
    const btnClose = document.getElementById('modal-btn cancel');
    const btnSave = document.getElementById('modal-btn confirm');

    const avatarEditBtn = document.getElementById('avatarEditBtn');
    const inputPhotoDirect = document.getElementById('inputPhotoDirect');

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

   // --- CARGAR LOS DATOS DESDE FIREBASE AL ABRIR LA APP O INICIAR SESIÓN ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
           
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = '../index.html';
            return;
        }

        try {
           
            if (cuentaBody) {
                const emailP = cuentaBody.querySelector('p');
                if (emailP) emailP.innerHTML = `<strong>Correo electrónico:</strong> ${user.email}`;
            }

                const perfil = await obtenerPerfilUsuario(user.uid);
               
                const ptsCat = await obtenerTodosPuntosCategorias(user.uid);

                if (perfil) {
                   
                    displayName.textContent = perfil.nombre_completo || (perfil.nombre + " " + perfil.apellidos);

                    if (perfil.bio) {
                        displayDescription.textContent = perfil.bio;
                    } else {
                        displayDescription.textContent = "¡Hola! Soy nuevo en LaburApp. Todavía no he escrito mi biografía.";
                    }

                    if (perfil.direccion_principal) {
                        displayAddress.textContent = perfil.direccion_principal;
                    }

                   // --- 1. LÓGICA DE NIVEL Y BARRA DE XP ---
                    const nLvl = perfil.nivel || 1;
                    const xpActual = perfil.experiencia_nivel_actual || 0;
                    const maxXP = 100 + (nLvl - 1) * 50;

                    if (lvlVal) lvlVal.textContent = nLvl;
                    if (lvlBars.length >= 3) {
                        lvlBars[0].textContent = "0 XP";
                        lvlBars[1].textContent = xpActual.toLocaleString() + " XP";
                        lvlBars[2].textContent = maxXP.toLocaleString() + " XP";
                    }
                    if (xpFill) {
                        let percent = (xpActual / maxXP) * 100;
                        if (percent > 100) percent = 100;
                        xpFill.style.width = percent + "%";
                    }

                   // --- 2. VALORACIÓN, ESPECIALIDAD Y DINERO ---
                    if (statItems.length >= 3) {
                        const valMedia = perfil.valoracion_media !== undefined ? perfil.valoracion_media : 2.5;
                        statItems[0].textContent = valMedia.toFixed(1);

                        let maxPts = -1;
                        let bestCat = null;
                        let oldestDate = Infinity;

                        for (let c of ptsCat) {
                            if (c.puntos > maxPts) {
                                maxPts = c.puntos;
                                bestCat = c.id_categoria;
                                oldestDate = c.fecha_creacion;
                            } else if (c.puntos === maxPts && c.puntos > 0) {
                               
                                if (c.fecha_creacion < oldestDate) {
                                    bestCat = c.id_categoria;
                                    oldestDate = c.fecha_creacion;
                                }
                            }
                        }

                        if (bestCat && maxPts > 0) {
                            const n = catInfo[bestCat] ? catInfo[bestCat].nombre : bestCat;
                            statItems[1].textContent = `${n} (${maxPts} pts)`;
                        } else {
                            statItems[1].textContent = "Ninguna (0 pts)";
                        }

                        statItems[2].textContent = (perfil.dinero_ganado_total || 0).toLocaleString() + " €";
                    }

                   // --- 3. RENDIMIENTO DE TABLA DE CATEGORIAS ---
                    if (catGrid) {
                        ptsCat.sort((a, b) => b.puntos - a.puntos);
                        catGrid.innerHTML = "";
                        let hasCats = false;
                        for (let c of ptsCat) {
                            if (c.puntos > 0) {
                                hasCats = true;
                                const info = catInfo[c.id_categoria.toLowerCase()] || { nombre: c.id_categoria, color: 'cat-dot-otros' };
                                const div = document.createElement('div');
                                div.className = 'cat-item';
                                div.innerHTML = `<span class="dot ${info.color}"></span> <strong>${info.nombre}:</strong> ${c.puntos} puntos`;
                                catGrid.appendChild(div);
                            }
                        }
                        if (!hasCats) {
                            catGrid.innerHTML = "<p style='color: var(--gray-6); font-style: italic; grid-column: 1 / -1;'>Aún no tienes puntos en ninguna categoría de trabajo.</p>";
                        }
                    }

                   // --- 4. RENDER DE SUSCRIPCIONES ---
                    if (subsBody) {
                        const sTrabajador = perfil.id_suscripcion_trabajador || "ninguna";
                        const sCliente = perfil.id_suscripcion_cliente || "ninguna";

                        const workerSubRow = document.getElementById('workerSubRow');
                        const clientSubRow = document.getElementById('clientSubRow');

                        if (workerSubRow) {
                            let workerHtml = `<p><strong>Suscripcion Trabajador:</strong> `;
                            if (sTrabajador.toLowerCase() !== "ninguna") {
                                const fechaV = perfil.fecha_vencimiento_trabajador?.toDate ? perfil.fecha_vencimiento_trabajador.toDate().toLocaleDateString() : null;
                                workerHtml += `<img src="../assets/img/icons/icono-suscripciones.png" class="icon-img" alt="Diamante"> ${sTrabajador.toUpperCase()}`;
                                if (fechaV) {
                                    workerHtml += ` <span class="sub-renewal-date">(Renueva: ${fechaV})</span>`;
                                }
                                workerHtml += `</p><img src="../assets/img/icons/icono-no-blanco.png" class="btn-cancel-subscription" data-tipo="trabajador" title="Cancelar Suscripción">`;
                            } else {
                                workerHtml += `Ninguna</p>`;
                            }
                            workerSubRow.innerHTML = workerHtml;
                        }

                        if (clientSubRow) {
                            let clientHtml = `<p><strong>Suscripción Cliente:</strong> `;
                            if (sCliente.toLowerCase() !== "ninguna") {
                                const fechaV = perfil.fecha_vencimiento_cliente?.toDate ? perfil.fecha_vencimiento_cliente.toDate().toLocaleDateString() : null;
                                clientHtml += `<img src="../assets/img/icons/icono-suscripciones.png" class="icon-img" alt="Diamante"> ${sCliente.toUpperCase()}`;
                                if (fechaV) {
                                    clientHtml += ` <span class="sub-renewal-date">(Renueva: ${fechaV})</span>`;
                                }
                                clientHtml += `</p><img src="../assets/img/icons/icono-no-blanco.png" class="btn-cancel-subscription" data-tipo="cliente" title="Cancelar Suscripción">`;
                            } else {
                                clientHtml += `Ninguna</p>`;
                            }
                            clientSubRow.innerHTML = clientHtml;
                        }

                        document.querySelectorAll('.btn-cancel-subscription').forEach(btn => {
                            btn.onclick = () => {
                                const tipo = btn.dataset.tipo;
                                window.showCustomConfirm(
                                    "Cancelar Suscripción",
                                    `¿Estás seguro de que deseas cancelar tu suscripción de ${tipo}? Perderás todos los beneficios asociados.`,
                                    async () => {
                                        try {
                                            await cancelarSuscripcionUsuario(user.uid, tipo);
                                            window.showCustomAlert("¡Cancelada!", "Tu suscripción ha sido cancelada correctamente.");
                                            location.reload();
                                        } catch (error) {
                                            console.error("Error al cancelar:", error);
                                            window.showCustomAlert("Error", "No se pudo cancelar la suscripción.");
                                        }
                                    },
                                    "Confirmar",
                                    "Volver",
                                    "delete"
                                );
                            };
                        });
                    }

                   // --- 5. RENDER FOTO DE PERFIL Y CV ---
                    if (displayPic) {
                        displayPic.src = perfil.foto_perfil || "../assets/img/avatar-defecto.png";
                    }

                    const displayPDF = document.getElementById('displayPDF');
                    if (displayPDF) {
                        if (perfil.curriculum_url) {
                            displayPDF.href = perfil.curriculum_url;
                            displayPDF.style.display = "inline";
                        } else {
                            displayPDF.removeAttribute('href');
                            displayPDF.style.display = "none";
                           
                            const pdfRow = displayPDF.closest('.link-row');
                            if (pdfRow) pdfRow.style.display = "none";
                        }
                    }
                }
            } catch (error) {
                console.error("Error cargando perfil:", error);
            }
    });

   // --- LÓGICA DE SUBIDA DIRECTA DE FOTO DE PERFIL ---
    if (avatarEditBtn && inputPhotoDirect) {
        avatarEditBtn.onclick = () => inputPhotoDirect.click();
    
        inputPhotoDirect.onchange = async (e) => {
            const user = auth.currentUser;
            if (!user) return;
    
            const file = e.target.files[0];
            if (file) {
                try {
                   
                    const previewUrl = URL.createObjectURL(file);
                    if (displayPic) displayPic.src = previewUrl;
    
                   // --- ACTUALIZAR TAMBIÉN LA FOTO DEL HEADER Y DROPDOWN SI EXISTEN (PREVIEW) ---
                    const headerPic = document.querySelector('.profile-toggle');
                    const dropdownPic = document.querySelector('.dropdown-avatar');
                    if (headerPic) headerPic.src = previewUrl;
                    if (dropdownPic) dropdownPic.src = previewUrl;

                    const photoRef = ref(storage, `avatars/${user.uid}/profile.jpg`);
                    await uploadBytes(photoRef, file, { contentType: file.type });
                    const downloadUrl = await getDownloadURL(photoRef);

                    await actualizarPerfilUsuario(user.uid, { foto_perfil: downloadUrl });
    
                    showCustomAlert("¡Éxito!", "Tu foto de perfil se ha actualizado correctamente.");
                } catch (error) {
                    console.error("Error subiendo foto:", error);
                    showCustomAlert("Error", "No se pudo actualizar la foto.");
                }
            }
        };
    }

   // --- LÓGICA DE CAMBIAR CONTRASEÑA ---
    if (btnChangePass) {
        btnChangePass.addEventListener('click', (e) => {
            e.preventDefault();
            showChangePasswordModal(async (nuevaPass) => {
                try {
                    await cambiarPassword(nuevaPass);
                    showCustomAlert("¡Éxito!", "Tu contraseña ha sido actualizada correctamente.");
                    if (passLabel) passLabel.textContent = " " + "*".repeat(nuevaPass.length);
                } catch (error) {
                    console.error("Error al cambiar contraseña:", error);
                    if (error.code === 'auth/requires-recent-login') {
                        showCustomAlert(
                            "Seguridad",
                            "Por razones de seguridad, debes haber iniciado sesión recientemente para cambiar tu contraseña. Por favor, cierra sesión y vuelve a entrar antes de intentarlo de nuevo."
                        );
                    } else {
                        showCustomAlert("Error", "No se pudo actualizar la contraseña. Inténtalo de nuevo más tarde.");
                    }
                }
            });
        });
    }

   // --- LÓGICA DEL MODAL DE EDICIÓN ---
    if (btnOpen) {
        btnOpen.onclick = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const perfil = await obtenerPerfilUsuario(user.uid);
            modal.style.display = "flex";

            document.getElementById('inputName').value = perfil.nombre || "";
            document.getElementById('inputLastname').value = perfil.apellidos || "";

            const currDesc = displayDescription.textContent.trim();
            if (currDesc.includes("Todavía no he escrito mi biografía")) {
                document.getElementById('inputDescription').value = "";
            } else {
                document.getElementById('inputDescription').value = currDesc;
            }

            const addressMatch = displayAddress.textContent;
            const dirSana = (addressMatch.includes("Uribarri") || addressMatch.includes("Bilbao 48007")) ? "" : addressMatch;
            document.getElementById('inputAddress').value = dirSana;
        };
    }

    if (btnClose) btnClose.onclick = () => modal.style.display = "none";

    if (btnSave) {
        btnSave.onclick = async () => {
            const user = auth.currentUser;
            if (!user) {
                showCustomAlert("Error", "No estás logueado.");
                return;
            }

           // --- DATOS EXTRAIDOS DEL MODAL ---
            const newName = document.getElementById('inputName').value.trim();
            const newLastname = document.getElementById('inputLastname').value.trim();
            const newDescription = document.getElementById('inputDescription').value.trim();
            const newAddress = document.getElementById('inputAddress').value.trim();
            const pdfFile = document.getElementById('inputPDF').files[0];

            try {
                const updateData = {
                    nombre: newName,
                    apellidos: newLastname,
                    nombre_completo: `${newName} ${newLastname}`.trim(),
                    bio: newDescription,
                    direccion_principal: newAddress
                };

                if (pdfFile) {
                    const pdfRef = ref(storage, `curricula/${user.uid}/cv.pdf`);
                    await uploadBytes(pdfRef, pdfFile, { contentType: 'application/pdf' });
                    const pdfUrl = await getDownloadURL(pdfRef);
                    updateData.curriculum_url = pdfUrl;

                    const displayPDF = document.getElementById('displayPDF');
                    if (displayPDF) {
                        displayPDF.href = pdfUrl;
                        displayPDF.style.display = "inline";
                        const pdfRow = displayPDF.closest('.link-row');
                        if (pdfRow) pdfRow.style.display = "flex";
                    }
                }

                await actualizarPerfilUsuario(user.uid, updateData);

                displayName.textContent = updateData.nombre_completo;
                displayDescription.textContent = newDescription || "¡Hola! Soy nuevo en LaburApp. Todavía no he escrito mi biografía.";
                displayAddress.textContent = newAddress || "Ubicación no establecida";

                showCustomAlert("Éxito", "Perfil guardado correctamente en la Base de Datos.");
                modal.style.display = "none";

            } catch (error) {
                console.error("Error actualizando perfil:", error);
                showCustomAlert("Error", "No se pudo actualizar el perfil. Inténtalo de nuevo.");
            }
        };
    }

   // --- LÓGICA DEL BOTÓN TU USUARIO (VER PERFIL PÚBLICO) ---
    const btnViewMyUser = document.getElementById('btnViewMyUser');
    if (btnViewMyUser) {
        btnViewMyUser.onclick = () => {
            const user = auth.currentUser;
            if (user) {
                window.location.href = `usuario.html?id=${user.uid}`;
            }
        };
    }

   // --- CERRAR AL HACER CLIC FUERA DEL MODAL ---
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    };
});
