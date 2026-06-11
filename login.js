// login.js (sin verificación por correo)
import { auth, db } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Admin del panel
const ADMIN_EMAIL = "gmonestel@gmail.com";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const msgBox = document.getElementById("loginMessage");
  const resendBtn = document.getElementById("btnResendVerification"); // ya no se usa, pero por si existe en el HTML

  function setMessage(text, type = "error") {
    if (!msgBox) {
      if (text) alert(text);
      return;
    }
    msgBox.textContent = text || "";
    msgBox.style.color = type === "error" ? "red" : "limegreen";
  }

  // Mensaje si viene ?verify=1 ya no es necesario, pero no hace daño
  const params = new URLSearchParams(window.location.search);
  if (params.get("verify") === "1") {
    setMessage("", "ok");
  }

  // LOGIN PRINCIPAL (sin validar emailVerified)
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMessage("");

    const email = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;

    if (!email || !password) {
      setMessage("Ingresa tu email y contraseña.");
      return;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      // Opcional: si quieres seguir marcando emailVerified=true en Firestore aunque no enviemos correos
      try {
        const q = query(collection(db, "clients"), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        snap.forEach(async (docSnap) => {
          await updateDoc(docSnap.ref, { emailVerified: true });
        });
      } catch (fireErr) {
        console.warn("No se pudo actualizar emailVerified en clients:", fireErr);
      }

      // Redirección según tipo de usuario
      if (user.email === ADMIN_EMAIL) {
        window.location.href = "admin.html";
      } else {
        window.location.href = "index.html";
      }
    } catch (err) {
      console.error("Error en login:", err);
      let text = "Error al iniciar sesión.";
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        text = "Usuario o contraseña incorrectos.";
      } else if (err.code === "auth/user-not-found") {
        text = "No existe una cuenta con ese correo.";
      }
      setMessage(text);
    }
  });

  // Botón de reenviar verificación ya no hace nada útil
  resendBtn?.addEventListener("click", () => {
    setMessage("La verificación por correo está desactivada por ahora.", "ok");
  });
});