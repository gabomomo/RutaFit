// auth.js (versión pro)
// Maneja registro, login y redirección usando Firebase Auth (modular).

import { auth } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ----------------------------------------------------------------------
// Referencias al DOM
// ----------------------------------------------------------------------
const formLogin    = document.getElementById("formLogin");
const formRegister = document.getElementById("formRegister");
const authMessage  = document.getElementById("authMessage");

// ----------------------------------------------------------------------
// Mapeo de errores de Firebase → mensajes amigables en español
// ----------------------------------------------------------------------
const ERROR_MESSAGES = {
  "auth/email-already-in-use":
    "Este correo ya está registrado. Intenta iniciar sesión.",
  "auth/invalid-email":
    "El correo no tiene un formato válido.",
  "auth/operation-not-allowed":
    "El método de autenticación no está habilitado en el proyecto.",
  "auth/weak-password":
    "La contraseña es muy débil. Usa al menos 6 caracteres.",
  "auth/user-disabled":
    "Esta cuenta ha sido deshabilitada.",
  "auth/user-not-found":
    "No existe una cuenta con este correo.",
  "auth/wrong-password":
    "La contraseña no es correcta.",
  "auth/too-many-requests":
    "Demasiados intentos fallidos. Intenta de nuevo más tarde."
};

// Devuelve un texto para mostrar al usuario a partir del error
function translateError(error) {
  if (!error) return "Ha ocurrido un error desconocido.";
  const code = error.code || "";
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];

  // Fallback: si no conocemos el código, mostramos mensaje genérico
  return "Ha ocurrido un error: " + (error.message || code || "desconocido");
}

// ----------------------------------------------------------------------
// Helpers de UI
// ----------------------------------------------------------------------

// Muestra un mensaje en el área de mensajes
function showMessage(text, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = text;
  authMessage.style.color = isError ? "red" : "green";
}

// Activa/desactiva el estado de "cargando" en un formulario
function setFormLoading(form, isLoading, loadingText = "Procesando...") {
  if (!form) return;
  const button = form.querySelector("button[type='submit']");
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;

    // Deshabilitar todos los inputs mientras se procesa
    form.querySelectorAll("input, button").forEach((el) => {
      el.disabled = true;
    });
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    // Rehabilitar inputs
    form.querySelectorAll("input, button").forEach((el) => {
      el.disabled = false;
    });
  }
}

// ----------------------------------------------------------------------
// Registro
// ----------------------------------------------------------------------
if (formRegister) {
  formRegister.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = event.target.email.value.trim();
    const pass  = event.target.password.value.trim();

    // Validaciones básicas de frontend
    if (!email || !pass) {
      showMessage("Por favor completa correo y contraseña.", true);
      return;
    }
    if (pass.length < 6) {
      showMessage("La contraseña debe tener al menos 6 caracteres.", true);
      return;
    }

    try {
      setFormLoading(formRegister, true, "Creando cuenta...");
      showMessage(""); // limpiar mensajes previos

      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      console.log("Usuario registrado:", cred.user);

      showMessage("Usuario registrado con éxito. Ahora puedes iniciar sesión.");
      formRegister.reset();
    } catch (err) {
      console.error("Error en registro:", err);
      showMessage(translateError(err), true);
    } finally {
      setFormLoading(formRegister, false);
    }
  });
}

// ----------------------------------------------------------------------
// Login
// ----------------------------------------------------------------------
if (formLogin) {
  formLogin.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = event.target.email.value.trim();
    const pass  = event.target.password.value.trim();

    if (!email || !pass) {
      showMessage("Por favor ingresa tu correo y contraseña.", true);
      return;
    }

    try {
      setFormLoading(formLogin, true, "Iniciando sesión...");
      showMessage(""); // limpiar mensajes previos

      const cred = await signInWithEmailAndPassword(auth, email, pass);
      console.log("Login correcto:", cred.user);

      // No redirigimos aquí directamente; dejamos que onAuthStateChanged lo haga
      showMessage("Inicio de sesión correcto. Redirigiendo...");
      formLogin.reset();
    } catch (err) {
      console.error("Error en login:", err);
      showMessage(translateError(err), true);
    } finally {
      setFormLoading(formLogin, false);
    }
  });
}

// ----------------------------------------------------------------------
// onAuthStateChanged: decide qué hacer según haya sesión o no
// ----------------------------------------------------------------------
// Nota: esta lógica asume que este archivo se usa en login.html.
// - Si hay usuario → lo manda a index.html
// - Si no hay usuario → permanece en login.html

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Sesión detectada en login.html, redirigiendo a index...");
    // Pequeño delay opcional para que el usuario vea el mensaje
    setTimeout(() => {
      window.location.href = "index.html";
    }, 500);
  } else {
    console.log("No hay usuario autenticado. Permaneciendo en login.html.");
  }
});
