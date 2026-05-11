import { auth } from './firebase-config.js';
import { obtenerPerfilUsuario, actualizarPerfilUsuario, obtenerMetodosPago, obtenerHistorialPagos, agregarMetodoPago, registrarPagoHistorial, eliminarCuentaUsuario, eliminarMetodoPago, cancelarSuscripcionUsuario, cambiarPassword } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    const passLabel = document.getElementById('passLabel');
    const btnChangePass = document.getElementById('btnChangePass');
    const btnDeleteAccount = document.getElementById('btnDeleteAccount');

   // --- MODAL DE EDICIÓN DE DATOS PERSONALES ---
    const editModal = document.getElementById('editSettingsModal');
    const btnEditProfile = document.getElementById('btnEditProfile');
    const btnCancelEditSettings = document.getElementById('btnCancelEditSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');

    const displayNombre = document.getElementById('displayNombre');
    const displayApellidos = document.getElementById('displayApellidos');
    const displayDireccion = document.getElementById('displayDireccion');
    const displayFechaNac = document.getElementById('displayFechaNac');
    const displayDni = document.getElementById('displayDni');
    const displayTelefono = document.getElementById('displayTelefono');

    const settingsCards = document.querySelectorAll('.settings-card, .info-card');
    let subsBody = null;
    let paymentsList = null;
    let historyContainer = null;

    settingsCards.forEach(card => {
        const title = card.querySelector('.card-title')?.textContent || "";
        if (title.includes('Suscripciones')) subsBody = card.querySelector('.card-body');
        if (title.includes('Método de Pago')) paymentsList = card.querySelector('.payment-methods');
        if (title.includes('Historial de Pagos')) historyContainer = document.getElementById('paymentHistoryContainer');
    });

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = '../index.html';
            return;
        }

        try {
            const perfil = await obtenerPerfilUsuario(user.uid);
                if (perfil) {
                    if (displayNombre) displayNombre.textContent = perfil.nombre || "";
                    if (displayApellidos) displayApellidos.textContent = perfil.apellidos || "";
                    if (displayDireccion) displayDireccion.textContent = perfil.direccion_principal || "No especificada";
                    if (displayFechaNac) displayFechaNac.textContent = perfil.fecha_nacimiento || "";
                    if (displayDni) displayDni.textContent = perfil.dni || "";
                    if (displayTelefono) displayTelefono.textContent = perfil.telefono || "No especificado";

                    const emailDisplays = document.querySelectorAll('p strong');
                    emailDisplays.forEach(el => {
                        if (el.textContent.includes('Correo electrónico')) {
                            el.parentElement.innerHTML = `<strong>Correo electrónico:</strong> ${user.email}`;
                        }
                    });

                   // --- 1. RENDER SUSCRIPCIONES ---
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

                   // --- 2. RENDER MÉTODOS DE PAGO ---
                    if (paymentsList) {
                        await renderizarMetodosPago(user.uid);
                    }

                   // --- 3. RENDER HISTORIAL DE PAGOS ---
                    if (historyContainer) {
                        const historial = await obtenerHistorialPagos(user.uid);
                        renderHistorialPagos(historial, false);
                    }

                }
            } catch (error) {
                console.error("Error obteniendo perfil/pagos en Ajustes:", error);
            }
    });

   // --- LÓGICA DE CERRAR SESIÓN (MANEJADA GLOBALMENTE POR GENERAL.JS CLASE .LOGOUT-ACTION) ---

   // --- LÓGICA PARA CAMBIAR LA CONTRASEÑA ---
    if (btnChangePass) {
        btnChangePass.addEventListener('click', (e) => {
            e.preventDefault();
            showChangePasswordModal(async (nuevaPass) => {
                try {
                    await cambiarPassword(nuevaPass);
                    showCustomAlert("¡Éxito!", "Contraseña actualizada correctamente.");
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

   // --- LÓGICA PARA BORRAR LA CUENTA ---
    if (btnDeleteAccount) {
        btnDeleteAccount.addEventListener('click', (e) => {
            e.preventDefault();
            showCustomConfirm(
                "Borrar Cuenta",
                "¿Estás ABSOLUTAMENTE seguro de borrar tu cuenta? Todos tus datos, historial y saldo se perderán de forma permanente. Esta acción no se puede deshacer.",
                async () => {
                    try {
                        await eliminarCuentaUsuario();
                        window.location.href = "../index.html";
                    } catch (error) {
                        console.error("Error al borrar cuenta:", error);
                        if (error.code === 'auth/requires-recent-login') {
                            showCustomAlert(
                                "Seguridad",
                                "Por razones de seguridad, debes haber iniciado sesión recientemente para borrar tu cuenta. Por favor, cierra sesión y vuelve a entrar antes de intentarlo de nuevo."
                            );
                        } else {
                            showCustomAlert("Error", "No se pudo borrar la cuenta. Inténtalo de nuevo más tarde.");
                        }
                    }
                },
                "Borrar definitivamente",
                "Cancelar",
                "delete",
                true
            );
        });
    }

   // --- ABRIR MODAL EDITAR ---
    if (btnEditProfile) {
        btnEditProfile.onclick = () => {
            editModal.classList.remove('hidden');
            document.getElementById('inputSetNombre').value = displayNombre.innerText;
            document.getElementById('inputSetApellidos').value = displayApellidos.innerText;
            const dirSana = displayDireccion.innerText === 'No especificada' ? '' : displayDireccion.innerText;
            document.getElementById('inputSetDireccion').value = dirSana;

            const dateStr = displayFechaNac.innerText;
            if (dateStr && dateStr.includes("-") && dateStr.split("-")[0].length === 2) {
                const parts = dateStr.split("-");
                document.getElementById('inputSetFechaNac').value = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
                document.getElementById('inputSetFechaNac').value = dateStr;
            }

            document.getElementById('inputSetDni').value = displayDni.innerText;
            const telSano = displayTelefono.innerText === 'No especificado' ? '' : displayTelefono.innerText;
            document.getElementById('inputSetTelefono').value = telSano;
        };
    }

    if (btnCancelEditSettings) btnCancelEditSettings.onclick = () => editModal.classList.add('hidden');

   // --- GUARDAR EN FIREBASE ---
    if (btnSaveSettings) {
        btnSaveSettings.onclick = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const nom = document.getElementById('inputSetNombre').value.trim();
            const ape = document.getElementById('inputSetApellidos').value.trim();
            const rawFnac = document.getElementById('inputSetFechaNac').value.trim();// --- YYYY-MM-DD ---
            const dni = document.getElementById('inputSetDni').value.trim();
            const dir = document.getElementById('inputSetDireccion').value.trim();
            const tel = document.getElementById('inputSetTelefono').value.trim();

            if (!nom || !ape || !rawFnac || !dni) {
                showCustomAlert("Error", "Los campos Nombre, Apellidos, Fecha Nac. y DNI son obligatorios.");
                return;
            }

            let formattedFnac = rawFnac;
            if (rawFnac.includes("-") && rawFnac.split("-")[0].length === 4) {
                const parts = rawFnac.split("-");
                formattedFnac = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            try {
               
                await actualizarPerfilUsuario(user.uid, {
                    nombre: nom,
                    apellidos: ape,
                    nombre_completo: nom + " " + ape,
                    fecha_nacimiento: formattedFnac,
                    dni: dni,
                    direccion_principal: dir,
                    telefono: tel
                });

                displayNombre.innerText = nom;
                displayApellidos.innerText = ape;
                displayFechaNac.innerText = formattedFnac;
                displayDni.innerText = dni;
                displayDireccion.innerText = dir || 'No especificada';
                displayTelefono.innerText = tel || 'No especificado';

                editModal.classList.add('hidden');
                showCustomAlert("Éxito", "Datos actualizados correctamente en base de datos.");

            } catch (e) {
                console.error("Error guardando ajustes: ", e);
                showCustomAlert("Error", "Fallo al guardar en la nube.");
            }
        };
    }

   // --- MODAL Y LOGICA AÑADIR MÉTODO DE PAGO ---
    const paymentModal = document.getElementById('paymentModal');
    const selectPaymentType = document.getElementById('selectPaymentType');
    const tarjetaFields = document.getElementById('tarjetaFields');
    const plataformaFields = document.getElementById('plataformaFields');
    const btnAddPayment = document.getElementById('btnAddPayment');
    const btnCancelPayment = document.getElementById('btnCancelPayment');
    const btnSavePayment = document.getElementById('btnSavePayment');

    if (selectPaymentType) {
        selectPaymentType.addEventListener('change', (e) => {
            if (e.target.value === 'tarjeta') {
                tarjetaFields.style.display = 'block';
                plataformaFields.style.display = 'none';
            } else {
                tarjetaFields.style.display = 'none';
                plataformaFields.style.display = 'block';
            }
        });
    }

    if (btnAddPayment) {
        btnAddPayment.addEventListener('click', (e) => {
            e.preventDefault();
            paymentModal.classList.remove('hidden');

            if (selectPaymentType) {
                selectPaymentType.value = 'tarjeta';
                tarjetaFields.style.display = 'block';
                plataformaFields.style.display = 'none';
            }
            document.getElementById('inputCardNumber').value = '';
            document.getElementById('inputCardExpiry').value = '';
            document.getElementById('inputCardCVV').value = '';
            document.getElementById('inputPlataformaEmail').value = '';
            document.getElementById('inputPlataformaPass').value = '';
        });
    }

    if (btnCancelPayment) {
        btnCancelPayment.addEventListener('click', () => {
            paymentModal.classList.add('hidden');
        });
    }

    if (btnSavePayment) {
        btnSavePayment.addEventListener('click', async () => {
            let isValid = false;
            let listEntry = '';
            let dbTipo = '';
            let dbDetalle = '';
            const type = selectPaymentType ? selectPaymentType.value : 'tarjeta';

            if (type === 'tarjeta') {
                const num = document.getElementById('inputCardNumber').value.trim();
                const exp = document.getElementById('inputCardExpiry').value.trim();
                const cvv = document.getElementById('inputCardCVV').value.trim();

                if (num && exp && cvv) {
                    isValid = true;
                    dbTipo = 'Tarjeta Bancaria';
                    dbDetalle = `**** - *${num.slice(-4)}`;
                    listEntry = `<li><span class="dot-icon">•</span> <strong>${dbTipo}:</strong> ${dbDetalle}</li>`;
                }
            } else {
                const email = document.getElementById('inputPlataformaEmail').value.trim();
                const pass = document.getElementById('inputPlataformaPass').value.trim();

                if (email && pass) {
                    isValid = true;
                    dbTipo = 'Plataforma de Pago';
                    dbDetalle = email;
                    listEntry = `<li><span class="dot-icon">•</span> <strong>${dbTipo}:</strong> ${dbDetalle}</li>`;
                }
            }

            if (isValid) {
                try {
                    const user = auth.currentUser;
                    if (user) {
                        const idMetodo = await agregarMetodoPago(user.uid, dbTipo, dbDetalle);
                        await registrarPagoHistorial(user.uid, idMetodo, 0);
                    }

                    showCustomAlert("Éxito", "Método de pago añadido correctamente.");
                    paymentModal.classList.add('hidden');

                    if (paymentsList) {
                        await renderizarMetodosPago(user.uid);
                    }

                    if (historyContainer) {
                        const historial = await obtenerHistorialPagos(user.uid);
                        renderHistorialPagos(historial, false);
                    }
                } catch (e) {
                    console.error("Error al guardar método de pago:", e);
                    showCustomAlert("Error", "No se pudo guardar en la base de datos.");
                }
            } else {
                showCustomAlert("Error", "Por favor, rellena todos los campos.");
            }
        });
    }

   // --- RENDERIZADO DE HISTORIAL CON PAGINACIÓN ---
    function renderHistorialPagos(historial, showAll) {
        if (!historyContainer) return;

        if (historial.length === 0) {
            historyContainer.innerHTML = "<p style='color: var(--gray-6); font-style: italic;'>Aún no has realizado ningún movimiento de pago.</p>";
            return;
        }

        const itemsToShow = showAll ? historial : historial.slice(0, 5);
        let html = '<div class="payment-history">';
        itemsToShow.forEach(p => {
            const fecha = p.fecha_emision?.toDate ? p.fecha_emision.toDate().toLocaleDateString() : "Reciente";
            const montoVal = Number(p.monto);
            const sign = montoVal > 0 ? "+" : "";
            const montoClase = montoVal < 0 ? 'negative-amount' : (montoVal > 0 ? 'positive-amount' : '');

            html += `
                <div class="payment-row">
                    <p><strong>Pago:</strong> <strong class="${montoClase}">${sign}${p.monto}€</strong></p>
                    <p><strong>Fecha Emisión:</strong> ${fecha}</p>
                    <p><strong>Detalle:</strong> ${p.detalle_pago || 'Transacción de LaburApp'}</p>
                </div>
            `;
        });
        html += '</div>';

        if (!showAll && historial.length > 5) {
            html += `
                <div class="view-more-container">
                    <button id="btnViewMoreHistory" class="view-more-btn">Ver más</button>
                </div>
            `;
        }

        historyContainer.innerHTML = html;

        const btnMore = document.getElementById('btnViewMoreHistory');
        if (btnMore) {
            btnMore.addEventListener('click', () => {
                renderHistorialPagos(historial, true);
            });
        }
    }

    async function renderizarMetodosPago(uid) {
        if (!paymentsList) return;
        const metodos = await obtenerMetodosPago(uid);
        paymentsList.innerHTML = "";

        if (metodos.length === 0) {
            paymentsList.innerHTML = "<p style='color: var(--gray-6); font-style: italic;'>No tienes métodos de pago registrados.</p>";
            return;
        }

        metodos.forEach(m => {
            const li = document.createElement('li');
            const favorStar = m.favorito
                ? `<img src="../assets/img/icons/icono-estrella.png" class="icon-star-favorite" title="Favorito">`
                : ``;

            li.innerHTML = `
                ${favorStar}
                <span><strong>${m.tipo}:</strong> ${m.detalle}</span>
                <img src="../assets/img/icons/icono-no-blanco.png" class="btn-delete-payment" title="Eliminar método" data-id="${m.id_metodo}">
            `;
            paymentsList.appendChild(li);
        });

        paymentsList.querySelectorAll('.btn-delete-payment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idMetodo = e.target.getAttribute('data-id');
                confirmarBorradoMetodo(uid, idMetodo);
            });
        });
    }

    function confirmarBorradoMetodo(uid, idMetodo) {
        obtenerMetodosPago(uid).then(metodos => {
            if (metodos.length <= 1) {
                showCustomAlert("Acceso Restringido", "Debes tener al menos un método de pago. Añade uno nuevo antes de borrar este.");
                return;
            }

            const metodo = metodos.find(m => m.id_metodo === idMetodo);
            showCustomConfirm(
                "Borrar Método de Pago",
                `¿Estás seguro de que quieres eliminar tu ${metodo.tipo} (${metodo.detalle})?`,
                async () => {
                    try {
                        await eliminarMetodoPago(uid, idMetodo);
                        showCustomAlert("Éxito", "Método de pago eliminado.");
                        await renderizarMetodosPago(uid);
                    } catch (err) {
                        console.error("Error eliminando método:", err);
                        showCustomAlert("Error", "No se pudo eliminar el método.");
                    }
                },
                "Eliminar",
                "Cancelar",
                "delete",
                true
            );
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target == paymentModal) paymentModal.classList.add('hidden');
        if (event.target == editModal) editModal.classList.add('hidden');
    });

});
