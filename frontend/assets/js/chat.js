import { auth, storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { enviarMensajeTrabajo, obtenerTrabajoPorId, obtenerUsuarioPorId, enviarMensajeDirecto, generarIdChat, enviarDenuncia, registrarConversacionActiva, obtenerMensajesChat, marcarMensajeLeido } from './database.js';

const listaMensajes = document.getElementById('messages');
const formulario = document.getElementById('chat-form');
const inputTexto = document.getElementById('message-input');
const otherAvatar = document.getElementById('otherAvatar');
const otherName = document.getElementById('otherName');
const jobTitle = document.getElementById('jobTitle');

const previewContainer = document.getElementById('image-preview-container');
const previewImage = document.getElementById('image-preview');
const btnRemovePreview = document.getElementById('btn-remove-preview');
const inputGallery = document.getElementById('input-file-gallery');

let currentUserData = null;
let otherUserData = null;

const urlParams = new URLSearchParams(window.location.search);
const idTrabajo = urlParams.get('id');
const userIdDirect = urlParams.get('userId');
// --- PRIORIZAR MODO TRABAJO SI HAY ID DE TRABAJO ---
let chatMode = 'direct';
if (idTrabajo) {
    chatMode = 'job';
} else if (!userIdDirect) {
    showCustomAlert("Error", "No se ha especificado un destinatario para el chat.", "Ir a Mensajes", () => {
        window.location.href = 'mensajes.html';
    });
}

async function loadChatMeta() {
    try {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUserData = await obtenerUsuarioPorId(user.uid);

                let otherId = userIdDirect || urlParams.get('userId');

                if (chatMode === 'job') {
                    const trabajo = await obtenerTrabajoPorId(idTrabajo);
                    if (trabajo) {
                        const url = (user.uid === trabajo.id_publicador) ? `mi-tarea.html?id=${idTrabajo}` : `trabajo.html?id=${idTrabajo}`;
                        jobTitle.innerHTML = `Trabajo: <a href="${url}" class="job-link">${trabajo.titulo}</a>`;

                        const jobContextMobile = document.getElementById('jobContextMobile');
                        const jobMobileLink = document.getElementById('jobMobileLink');
                        const btnJobMobile = document.getElementById('btnJobMobile');
                        const jobMobileDropdown = document.getElementById('jobMobileDropdown');

                        if (jobContextMobile && jobMobileLink && btnJobMobile && jobMobileDropdown) {
                            jobContextMobile.classList.remove('hidden');
                            jobMobileLink.href = url;
                            jobMobileLink.textContent = trabajo.titulo || 'Ir al trabajo';

                            btnJobMobile.onclick = (e) => {
                                e.stopPropagation();
                                jobMobileDropdown.classList.toggle('hidden');
                            };

                            document.addEventListener('click', (e) => {
                                if (!jobContextMobile.contains(e.target)) {
                                    jobMobileDropdown.classList.add('hidden');
                                }
                            });
                        }

                        if (!otherId) {
                            otherId = (user.uid === trabajo.id_publicador) ? trabajo.id_trabajador : trabajo.id_publicador;
                        }
                    }
                } else {
                    jobTitle.style.display = 'none';
                    const jobContextMobile = document.getElementById('jobContextMobile');
                    if (jobContextMobile) jobContextMobile.classList.add('hidden');
                }

                if (otherId) {
                    otherUserData = await obtenerUsuarioPorId(otherId);
                    if (otherUserData) {
                        const nameToDisplay = otherUserData.nombre_completo || otherUserData.nombre;
                        const avatarToDisplay = otherUserData.foto_perfil || "../assets/img/avatar-defecto.png";

                        otherName.textContent = nameToDisplay;
                        otherAvatar.src = avatarToDisplay;

                       // --- LINKS HEADER ---
                        const headerImgLink = document.getElementById("headerProfileLinkImg");
                        const headerTextLink = document.getElementById("headerProfileLinkText");
                        if (headerImgLink) headerImgLink.href = `usuario.html?id=${otherId}`;
                        if (headerTextLink) headerTextLink.href = `usuario.html?id=${otherId}`;

                        const reportModalName = document.getElementById('reportModalName');
                        const reportModalAvatar = document.getElementById('reportModalAvatar');
                        if (reportModalName) reportModalName.textContent = nameToDisplay;
                        if (reportModalAvatar) reportModalAvatar.src = avatarToDisplay;

                       // --- LINKS MODAL ---
                        const modalImgLink = document.getElementById("modalProfileLinkImg");
                        const modalTextLink = document.getElementById("modalProfileLinkText");
                        if (modalImgLink) modalImgLink.href = `usuario.html?id=${otherId}`;
                        if (modalTextLink) modalTextLink.href = `usuario.html?id=${otherId}`;

                       // --- RE-REGISTRAR CONVERSACIÓN ---
                       
                        const idChat = chatMode === 'job' ? generarIdChat(user.uid, otherId, idTrabajo) : generarIdChat(user.uid, otherId);
                        registrarConversacionActiva(user.uid, otherId, idChat, idTrabajo).catch(err => console.error("Error al re-registrar conv:", err));
                    }
                } else {
                   
                    otherName.textContent = "Chat";
                }

                startMessageListener(user.uid, otherId);

                // --- LÓGICA DE SOLO LECTURA (PARA ADMIN) ---
                if (urlParams.get('viewOnly') === 'true') {
                    if (formulario) formulario.style.display = 'none';
                    const chatActions = document.querySelector('.chat-actions');
                    if (chatActions) chatActions.style.display = 'none';
                    const btnReport = document.getElementById('btnReport');
                    if (btnReport) btnReport.style.display = 'none';
                    
                    // Ajustar altura de lista de mensajes ya que el form no está
                    if (listaMensajes) {
                        listaMensajes.style.height = 'calc(100vh - 150px)';
                    }
                }
            } else {
                sessionStorage.setItem('redirectAfterLogin', window.location.href);
                window.location.href = '../index.html';
            }
        });
    } catch (e) {
        console.error(e);
    }
}

loadChatMeta();
function startMessageListener(myUid, otherUid) {
    if (!listaMensajes) return;

    let chatId;
    if (chatMode === 'job' && idTrabajo && otherUid) {
        chatId = generarIdChat(myUid, otherUid, idTrabajo);
    } else if (chatMode === 'direct' && otherUid) {
        chatId = generarIdChat(myUid, otherUid);
    } else {
        return;
    }

    const renderMessages = async () => {
        const mensajes = await obtenerMensajesChat(chatId);

        mensajes.forEach((data) => {
            if (data.id_emisor !== myUid && data.leido === false) {
                marcarMensajeLeido(data.id).catch(err => console.warn('Error marcando leido:', err));
            }
        });

        listaMensajes.innerHTML = '';
        mensajes.forEach((data) => {
            const isOwn = (data.id_emisor === myUid);

            const groupDiv = document.createElement('div');
            groupDiv.className = `message-group ${isOwn ? 'own' : 'other'}`;

            const wrapperDiv = document.createElement('div');
            wrapperDiv.className = 'message-wrapper';

            const avatarImg = document.createElement('img');
            avatarImg.className = 'msg-avatar';
            if (isOwn) {
                avatarImg.src = currentUserData?.foto_perfil || "../assets/img/avatar-defecto.png";
            } else {
                avatarImg.src = otherUserData?.foto_perfil || "../assets/img/avatar-defecto.png";
            }

            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'burbuja-mensaje';

            const contentText = (data.tipo_contenido === 'texto') ? data.contenido : "[Imagen Adjunta]";

            let timeString = "";
            if (data.fecha_envio) {
                const date = data.fecha_envio.toDate ? data.fecha_envio.toDate() : new Date(data.fecha_envio);
                const now = new Date();
                const isToday = date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();

                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (isToday) {
                    timeString = timeStr;
                } else {
                    const d = date.getDate().toString().padStart(2, '0');
                    const m = (date.getMonth() + 1).toString().padStart(2, '0');
                    const y = date.getFullYear();
                    timeString = `${timeStr} ${d}/${m}/${y}`;
                }
            }

            if (data.tipo_contenido === 'imagen') {
                bubbleDiv.innerHTML = `<img src="${data.contenido}" alt="Imagen enviada" style="max-width:200px; border-radius:10px; display:block;">
                    <span class="msg-time">${timeString}</span>`;
            } else {
                bubbleDiv.innerHTML = `${contentText} <span class="msg-time">${timeString}</span>`;
            }

            wrapperDiv.appendChild(avatarImg);
            wrapperDiv.appendChild(bubbleDiv);
            groupDiv.appendChild(wrapperDiv);

            if (isOwn) {
                const isRead = data.leido === true;
                const statusDiv = document.createElement('div');
                statusDiv.className = `msg-status ${isRead ? 'msg-status--read' : 'msg-status--unread'}`;
                statusDiv.textContent = isRead ? '✓✓ Leído' : '✓ No leído';
                groupDiv.appendChild(statusDiv);
            }

            listaMensajes.appendChild(groupDiv);
        });
        listaMensajes.scrollTop = listaMensajes.scrollHeight;
    };

    renderMessages().catch(console.error);
    setInterval(() => renderMessages().catch(console.error), 3000);
}
// --- B: ENVIAR MENSAJE ---
let currentImageBlob = null;

function showPreview(fileOrBlob) {
    currentImageBlob = fileOrBlob;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(fileOrBlob);
}

function clearPreview() {
    currentImageBlob = null;
    previewImage.src = '';
    previewContainer.classList.add('hidden');
    if (inputGallery) inputGallery.value = '';
}

if (btnRemovePreview) {
    btnRemovePreview.addEventListener('click', clearPreview);
}

if (formulario && (idTrabajo || userIdDirect)) {
    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();
        const texto = inputTexto.value.trim();

        if (texto !== "" || currentImageBlob) {
            try {
                let imageUrl = null;

                if (currentImageBlob) {
                    const fileName = currentImageBlob.name || `capture_${Date.now()}.jpg`;
                    const path = `chat-images/${Date.now()}_${fileName}`;
                    const storageRef = ref(storage, path);
                    await uploadBytes(storageRef, currentImageBlob);
                    imageUrl = await getDownloadURL(storageRef);
                }

                if (chatMode === 'job') {
                    const recipientId = otherUserData?.uid;
                    if (imageUrl) {
                        await enviarMensajeTrabajo(idTrabajo, imageUrl, "imagen", recipientId);
                    }
                    if (texto !== "") {
                        await enviarMensajeTrabajo(idTrabajo, texto, "texto", recipientId);
                    }
                } else {
                    if (imageUrl) {
                        await enviarMensajeDirecto(userIdDirect, imageUrl, "imagen");
                    }
                    if (texto !== "") {
                        await enviarMensajeDirecto(userIdDirect, texto, "texto");
                    }
                }

                inputTexto.value = '';
                clearPreview();
            } catch (error) {
                console.error("Error al enviar mensaje:", error);
                alert("Error: No pudimos enviar el mensaje. " + error.message);
            }
        }
    });
}
// --- C: MODAL DE DENUNCIA ---
const btnReport = document.getElementById('btnReport');
const reportModal = document.getElementById('reportModal');
const btnSubmitReport = document.getElementById('btnSubmitReport');
const reportReason = document.getElementById('reportReason');

if (btnReport && reportModal) {
    btnReport.addEventListener('click', (e) => {
        e.stopPropagation();
        reportModal.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!reportModal.contains(e.target) && !btnReport.contains(e.target)) {
            reportModal.classList.add('hidden');
        }
    });

    if (btnSubmitReport) {
        btnSubmitReport.addEventListener('click', async () => {
            const motivo = reportReason.value.trim();
            if (!motivo) {
                alert("Por favor, escribe el motivo de la denuncia.");
                return;
            }

            const otherId = userIdDirect || urlParams.get('userId') || (otherUserData?.uid);

            if (!otherId) {
                alert("Error: No se puede identificar al usuario para denunciar.");
                return;
            }

            try {
                btnSubmitReport.disabled = true;
                btnSubmitReport.textContent = "ENVIANDO...";
                await enviarDenuncia(otherId, motivo);
                alert("Denuncia enviada correctamente. Gracias por ayudarnos a mantener la comunidad segura.");
                reportModal.classList.add('hidden');
                reportReason.value = "";
            } catch (error) {
                console.error("Error al enviar denuncia:", error);
                alert("Hubo un error al enviar la denuncia. Inténtalo de nuevo más tarde.");
            } finally {
                btnSubmitReport.disabled = false;
                btnSubmitReport.textContent = "DENUNCIAR";
            }
        });
    }
}
// --- D: SELECCIÓN DE IMAGEN (GALERÍA) ---
const btnImage = document.getElementById('btnImage');

if (btnImage && inputGallery) {
    btnImage.addEventListener('click', () => inputGallery.click());
    inputGallery.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) showPreview(file);
    });
}
// --- E: MODAL CÁMARA (GETUSERMEDIA) ---
const btnCamera = document.getElementById('btnCamera');
const modalCamera = document.getElementById('modalCamera');
const cameraStream = document.getElementById('cameraStream');
const cameraCanvas = document.getElementById('cameraCanvas');
const btnCapture = document.getElementById('btnCapture');
const btnCancelCamera = document.getElementById('btnCancelCamera');

let activeStream = null;

async function openCamera() {
    modalCamera.classList.remove('hidden');
    try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStream.srcObject = activeStream;
    } catch (err) {
        alert("No se pudo acceder a la cámara: " + err.message);
        modalCamera.classList.add('hidden');
    }
}

function stopCamera() {
    if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        activeStream = null;
    }
    cameraStream.srcObject = null;
    modalCamera.classList.add('hidden');
}

if (btnCamera) {
    btnCamera.addEventListener('click', openCamera);
}

if (btnCancelCamera) {
    btnCancelCamera.addEventListener('click', stopCamera);
}

if (btnCapture) {
    btnCapture.addEventListener('click', () => {
        if (!cameraStream.srcObject) return;

        cameraCanvas.width = cameraStream.videoWidth;
        cameraCanvas.height = cameraStream.videoHeight;
        cameraCanvas.getContext('2d').drawImage(cameraStream, 0, 0);

        stopCamera();

        cameraCanvas.toBlob((blob) => {
            if (blob) showPreview(blob);
        }, 'image/jpeg', 0.85);
    });
}

