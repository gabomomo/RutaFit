// admin.js (compatible con Firebase modular v11.0.1)
// Colección principal: clients
// Nota: NO mezclar versiones (v10/v11). Este archivo importa TODO desde v11.

import { auth, db } from "./firebase-init.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { bindLogout } from "./app-common.js";

document.addEventListener("DOMContentLoaded", () => {
  bindLogout({
    auth,
    buttonId: "btnLogoutAdmin",   // <-- ID REAL del botón en admin.html
    redirectTo: "login.html",
    signOutFn: signOut,
  });
});

// -------------------------
// Helpers UI
// -------------------------

const els = {
  tbody: () => document.getElementById("planUsersTableBody"),
  // admin.html usa este id
  whoami: () => document.getElementById("adminSessionEmail") || document.getElementById("sessionEmail"),
  // Botón "Nuevo usuario" (id real: btnNewUser)
  btnNewClient: () => document.getElementById("btnNewUser") || document.getElementById("btnNewPlanUser") || document.getElementById("btnNewPlanUser"),
  // Modal (id real: userModal)
  userModal: () => document.getElementById("userModal"),
  userModalTitle: () => document.getElementById("userModalTitle"),
  btnSaveUser: () => document.getElementById("btnSaveUser"),
  // Inputs
  firstName: () => document.getElementById("firstName"),
  lastName: () => document.getElementById("lastName"),
  email: () => document.getElementById("email"),
  phone: () => document.getElementById("phone"),
  country: () => document.getElementById("country"),
  city: () => document.getElementById("city"),
  address: () => document.getElementById("address"),
  postalCode: () => document.getElementById("postalCode"),
};
function fmtDate(tsOrDate) {
  try {
    const d = tsOrDate?.toDate ? tsOrDate.toDate() : tsOrDate instanceof Date ? tsOrDate : null;
    if (!d) return "";
    return d.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "";
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showGridLoading(msg = "Cargando usuarios…") {
  const tbody = els.tbody();
  if (!tbody) return;
  tbody.innerHTML = `
    <tr class="ds-loading-row">
      <td colspan="6" class="text-center py-5">
        <div class="ds-spinner" role="status" aria-label="loading"></div>
        <div class="mt-3 ds-muted">${escapeHtml(msg)}</div>
      </td>
    </tr>
  `;
}

function showGridEmpty(msg = "Todavía no hay usuarios del plan creados.") {
  const tbody = els.tbody();
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center py-5 ds-muted">${escapeHtml(msg)}</td>
    </tr>
  `;
}

function showGridError(msg) {
  const tbody = els.tbody();
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center py-5">
        <div class="ds-error">${escapeHtml(msg || "Ocurrió un error cargando usuarios.")}</div>
      </td>
    </tr>
  `;
}

// -------------------------
// Data
// -------------------------

let clientsCache = [];

async function hasNutritionPlan(clientId) {
  // Ajusta si tu esquema es distinto.
  // Opción A (recomendada): clients/{id}/nutrition/current
  // Opción B: clients/{id}/nutritionPlans/... (solo comprobamos si existe al menos uno)
  try {
    const currentRef = doc(db, "clients", clientId, "nutrition", "current");
    const snap = await getDoc(currentRef);
    if (snap.exists()) return true;
  } catch {
    // ignore
  }
  try {
    const q = query(collection(db, "clients", clientId, "nutritionPlans"));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}

async function hasRoutine(clientId) {
  // Placeholder: adapta a tu estructura real.
  // Opción A: clients/{id}/routines/current
  try {
    const currentRef = doc(db, "clients", clientId, "routines", "current");
    const snap = await getDoc(currentRef);
    if (snap.exists()) return true;
  } catch {
    // ignore
  }
  try {
    const q = query(collection(db, "clients", clientId, "routines"));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}

async function loadClients() {
  showGridLoading();

  try {
    // Cambia/ajusta el orderBy al campo que exista en tus docs.
    // En tus screenshots usas "createdAt".
    const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    clientsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!clientsCache.length) {
      showGridEmpty();
      return;
    }

    await renderClientsGrid(clientsCache);
  } catch (err) {
    console.error("Error cargando usuarios del plan:", err);
    showGridError(err?.message || String(err));
  }
}

async function renderClientsGrid(clients) {
  const tbody = els.tbody();
  if (!tbody) {
    console.warn("No existe #planUsersTableBody en admin.html");
    return;
  }

  // Pre-cargar flags plan/routine en paralelo (sin bloquear UI demasiado)
  const enriched = await Promise.all(
    clients.map(async (c, idx) => {
      const [hasPlan, hasRut] = await Promise.all([hasNutritionPlan(c.id), hasRoutine(c.id)]);
      return { ...c, _idx: idx + 1, _hasPlan: hasPlan, _hasRoutine: hasRut };
    })
  );

  tbody.innerHTML = enriched
    .map((u) => rowHtml(u))
    .join("\n");

  // Bind actions
  tbody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (!id) return;

      if (action === "edit") return editClient(id);
      if (action === "delete") return deleteClient(id);
      if (action === "plan") return openNutrition(id);
      if (action === "routine") return openRoutine(id);
    });
  });
}

function rowHtml(u) {
  const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "(Sin nombre)";
  const email = u.email || "";
  const location1 = [u.city || "", u.country || ""].filter(Boolean).join(", ");
  const location2 = u.address || u.province || "";
  const phone = u.phone || "";
  const created = fmtDate(u.createdAt);

  const planBtnClass = u._hasPlan ? "icon-btn icon-solid-plan" : "icon-btn neutral";
  const routineBtnClass = u._hasRoutine ? "icon-btn icon-solid-routine" : "icon-btn neutral";

  return `
    <tr>
      <td class="ds-idx">${u._idx}</td>
      <td>
        <div class="ds-user">
          <div class="ds-user-name">${escapeHtml(fullName)}</div>
          <div class="ds-user-sub ds-muted">${escapeHtml(email)}</div>
        </div>
      </td>
      <td>
        <div class="ds-loc">
          <div>${escapeHtml(location1)}</div>
          <div class="ds-muted">${escapeHtml(location2)}</div>
        </div>
      </td>
      <td>${escapeHtml(phone)}</td>
      <td class="ds-created">${escapeHtml(created)}</td>
      <td class="text-end">
        <div class="d-flex justify-content-end flex-wrap gap-2">
          <button class="icon-btn icon-solid-edit" data-action="edit" data-id="${escapeHtml(u.id)}" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="${planBtnClass}" data-action="plan" data-id="${escapeHtml(u.id)}" title="${u._hasPlan ? "Editar plan nutricional" : "Crear plan nutricional"}">
            <i class="bi bi-egg-fried"></i>
          </button>
          <button class="${routineBtnClass}" data-action="routine" data-id="${escapeHtml(u.id)}" title="${u._hasRoutine ? "Editar rutina" : "Crear rutina"}">
            <i class="bi bi-activity"></i>
          </button>
          <button class="icon-btn icon-solid-delete" data-action="delete" data-id="${escapeHtml(u.id)}" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

// -------------------------
// Actions
// -------------------------

function editClient(clientId) {
  const user = clientsCache.find((u) => u.id === clientId);
  if (!user) return;
  // Aquí puedes abrir tu modal de edición.
  alert(`Editar usuario: ${user.firstName || ""} ${user.lastName || ""}`.trim());
}

async function deleteClient(clientId) {
  const user = clientsCache.find((u) => u.id === clientId);
  if (!user) return;

  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || clientId;
  if (!confirm(`¿Eliminar este usuario del plan?\n\n${name}`)) return;

  try {
    await deleteDoc(doc(db, "clients", clientId));
    await loadClients();
  } catch (err) {
    console.error("Error eliminando usuario:", err);
    alert(err?.message || String(err));
  }
}

function openNutrition(clientId) {
  // Navega a nutrition.html para ese usuario
  window.location.href = `nutrition.html?uid=${encodeURIComponent(clientId)}`;
}

function openRoutine(clientId) {
  // Placeholder. Si ya tienes rutina.html, cambia aquí.
  alert(`Aquí abriría Rutina para uid=${clientId}`);
}

// -------------------------
// Modal: Nuevo usuario del plan
// -------------------------
let userModalInstance = null;

function openNewClientModal() {
  const el = els.userModal();
  if (!el) return;
  if (els.userModalTitle()) els.userModalTitle().textContent = "Nuevo usuario del plan";

  // limpiar inputs
  for (const k of ["firstName","lastName","email","phone","country","city","address","postalCode"]) {
    const inp = els[k] && els[k]();
    if (inp) inp.value = "";
  }

  userModalInstance = window.bootstrap?.Modal?.getOrCreateInstance(el);
  userModalInstance?.show();
}

async function saveNewClient() {
  const data = {
    firstName: els.firstName()?.value?.trim() || "",
    lastName: els.lastName()?.value?.trim() || "",
    email: els.email()?.value?.trim() || "",
    phone: els.phone()?.value?.trim() || "",
    country: els.country()?.value?.trim() || "",
    city: els.city()?.value?.trim() || "",
    address: els.address()?.value?.trim() || "",
    postalCode: els.postalCode()?.value?.trim() || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!data.email) {
    alert("Email requerido");
    return;
  }
  if (!data.firstName && !data.lastName) {
    alert("Nombre requerido");
    return;
  }

  await addDoc(collection(db, "clients"), data);
  userModalInstance?.hide();

  // refrescar grid
  showGridLoading();
  await loadClients();
}

// -------------------------
// Init
// -------------------------

function init() {
  // Modal bindings
  const btnNew = els.btnNewClient();
  if (btnNew) btnNew.addEventListener("click", openNewClientModal);

  const btnSave = els.btnSaveUser();
  if (btnSave) btnSave.addEventListener("click", () => saveNewClient().catch(console.error));

  // Auth guard + carga
  showGridLoading();
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const whoami = els.whoami();
    if (whoami) whoami.textContent = user.email || "";

    await loadClients();
  });
}

// Esperar DOM (por si el script está en <head>)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
