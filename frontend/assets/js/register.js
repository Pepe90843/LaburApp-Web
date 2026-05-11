import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { crearUsuario, existeUsuarioConDni } from './database.js';

const formRegister = document.getElementById("formRegister");
const fase1 = document.getElementById("fase1");
const fase2 = document.getElementById("fase2");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordRptInput = document.getElementById("passwordRpt");
const nombreInput = document.getElementById("nombre");
const apellidosInput = document.getElementById("apellidos");
const fechaNacInput = document.getElementById("fechaNac");
const dniInput = document.getElementById("dni");
const termsCheckbox = document.getElementById("terms");

const btnSiguiente = document.getElementById("btnSiguiente");
const btnAtras = document.getElementById("btnAtras");
const togglePassword = document.getElementById("togglePassword");
const togglePasswordRpt = document.getElementById("togglePasswordRpt");
const errorMsg = document.getElementById("registerError");
const successMsg = document.getElementById("registerSuccess");

function toggleVisibility(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    const img = button.querySelector('img');

    if (input.type === "password") {
        input.type = "text";
        if (img) img.src = "../assets/img/icons/icono-ojo-no.png";
    } else {
        input.type = "password";
        if (img) img.src = "../assets/img/icons/icono-ojo-si.png";
    }
}

if (togglePassword) {
    togglePassword.addEventListener("click", () => toggleVisibility("password", "togglePassword"));
}
if (togglePasswordRpt) {
    togglePasswordRpt.addEventListener("click", () => toggleVisibility("passwordRpt", "togglePasswordRpt"));
}

if (btnSiguiente) {
    btnSiguiente.addEventListener("click", () => {
        errorMsg.textContent = "";

        if (!emailInput.value || !passwordInput.value || !passwordRptInput.value) {
            errorMsg.textContent = "Rellena todos los campos de la fase 1.";
            return;
        }

        if (passwordInput.value !== passwordRptInput.value) {
            errorMsg.textContent = "Las contraseñas no coinciden.";
            return;
        }

        if (passwordInput.value.length < 6) {
            errorMsg.textContent = "La contraseña debe tener al menos 6 caracteres.";
            return;
        }

        fase1.classList.add("hidden");
        fase2.classList.remove("hidden");
    });
}

if (btnAtras) {
    btnAtras.addEventListener("click", () => {
        fase2.classList.add("hidden");
        fase1.classList.remove("hidden");
        errorMsg.textContent = "";
    });
}

function isDniValid(dni) {
    const dniRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/i;
    return dniRegex.test(dni);
}

if (formRegister) {
    formRegister.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("Iniciando proceso de registro...");
        errorMsg.textContent = "";
        successMsg.textContent = "";

        const btnReg = document.getElementById("btnRegistrarse");
        if (btnReg) {
            btnReg.disabled = true;
            btnReg.textContent = "Registrando...";
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const nombre = nombreInput.value.trim();
        const apellidos = apellidosInput.value.trim();
        const dNac = fechaNacInput ? fechaNacInput.value.trim() : "";
        const dni = dniInput.value.trim().toUpperCase();

        if (!nombre || !apellidos || !dni || !dNac) {
            errorMsg.textContent = "Todos los campos de datos personales (incluyendo Fecha Nac.) son obligatorios.";
            if (btnReg) {
                btnReg.disabled = false;
                btnReg.textContent = "Registrarse";
            }
            return;
        }

        if (nombre.length > 30) {
            errorMsg.textContent = "El nombre no puede tener más de 30 caracteres.";
            return;
        }

        if (apellidos.length > 70) {
            errorMsg.textContent = "Los apellidos no pueden tener más de 70 caracteres.";
            return;
        }

        if (!isDniValid(dni)) {
            errorMsg.textContent = "El formato del DNI no es válido (ej: 12345678A).";
            if (btnReg) {
                btnReg.disabled = false;
                btnReg.textContent = "Registrarse";
            }
            return;
        }

        if (!termsCheckbox || !termsCheckbox.checked) {
            errorMsg.textContent = "Debes aceptar los términos y condiciones, la política de privacidad y el aviso legal para continuar.";
            if (btnReg) {
                btnReg.disabled = false;
                btnReg.textContent = "Registrarse";
            }
            return;
        }

       // --- VALIDACIÓN DE EDAD (MÍNIMO 16 AÑOS) ---
        const birthDate = new Date(dNac);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        console.log("Validando datos personales...");
        if (age < 16) {
            errorMsg.textContent = "Debes tener al menos 16 años para registrarte.";
            if (btnReg) {
                btnReg.disabled = false;
                btnReg.textContent = "Registrarse";
            }
            return;
        }

        const formattedDate = dNac;

        try {
            console.log("Verificando DNI único...");
            if (await existeUsuarioConDni(dni)) {
                errorMsg.textContent = "Ya existe un usuario registrado con este DNI.";
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await crearUsuario(user.uid, {
                nombre: nombre,
                nombre_completo: nombre + " " + apellidos,
                apellidos: apellidos,
                dni: dni,
                email: email,
                fecha_nacimiento: formattedDate, 
                nivel: 1,
                experiencia_total: 0,
                experiencia_nivel_actual: 0,
                valoracion_media: 2.5,
                num_valoraciones: 1,
                dinero_ganado_total: 0,
                id_suscripcion_trabajador: "ninguna",
                id_suscripcion_cliente: "ninguna"
            });

            formRegister.reset();
            window.showCustomAlert("¡Registro exitoso!", "Tu cuenta ha sido creada. Pulsa aceptar para ir al login.", "Aceptar", () => {
                window.location.href = "../index.html";
            });

        } catch (error) {
            console.error("Error al registrar:", error);
            if (btnReg) {
                btnReg.disabled = false;
                btnReg.textContent = "Registrarse";
            }
            if (error.code === 'auth/email-already-in-use') {
                errorMsg.textContent = "Este correo ya está registrado.";
            } else if (error.code === 'auth/invalid-email') {
                errorMsg.textContent = "El correo no tiene un formato válido.";
            } else if (error.code === 'auth/weak-password') {
                errorMsg.textContent = "La contraseña es muy débil (mínimo 6 caracteres).";
            } else {
                errorMsg.textContent = "Error al registrar el usuario: " + error.message;
            }
        }
    });
}
