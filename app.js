"use strict";
/*
  PLAN 30 DÍAS – GABO & KATHERINE

  - Usa el HTML de index.html (ids: dayName, nutritionFocus, chkGymMode, chkPadelDone, etc.).
  - Carga plan-config.json (usuarios, días, nutrición, entrenos, menús).
  - Soporta 2 usuarios: gabo y kathy.
  - Guarda progreso diario en localStorage por usuario y día.
*/

import { auth } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const btnLogout = document.getElementById("btnLogout");
const topAvatarEl = document.getElementById("topAvatar");
const topUserNameEl = document.getElementById("topUserName");

// Mapa de emails (Firebase Auth) → id de usuario del plan
// Ajusta estos correos según los que realmente uses en Auth
const EMAIL_TO_PLAN_USER = {
  "gmonestel@gmail.com": "gabo",
  "kmmas2@gmail.com": "kathy"
};

let authUser = null;
let preferredPlanUserId = null;

function getDisplayNameFromAuthUser(user) {
  if (!user) return "Usuario";
  if (user.displayName && user.displayName.trim()) {
    return user.displayName.trim();
  }
  if (user.email) {
    const local = user.email.split("@")[0];
    if (local) {
      return local.charAt(0).toUpperCase() + local.slice(1);
    }
  }
  return "Usuario";
}

// Proteger la página: si no hay usuario, redirige a login.html
onAuthStateChanged(auth, (user) => {
  authUser = user;

  if (!user) {
    console.log("No hay usuario, redirigiendo a login.html");
    document.body.classList.remove("logged");
    document.body.classList.add("logged-out");
    window.location.href = "login.html";
  } else {
    console.log("Usuario en dashboard:", user.email);
    document.body.classList.add("logged");
    document.body.classList.remove("logged-out");

    // Nombre y avatar en el top bar
    const displayName = getDisplayNameFromAuthUser(user);
    if (topUserNameEl) topUserNameEl.textContent = " " + displayName;
    if (topAvatarEl) topAvatarEl.textContent = displayName.charAt(0).toUpperCase();

    // Usuario del plan preferido según el email
    const emailLower = (user.email || "").toLowerCase();
    preferredPlanUserId = EMAIL_TO_PLAN_USER[emailLower] || null;

    // Si ya se cargó CONFIG y existe este usuario del plan, forzamos su selección
    if (
      preferredPlanUserId &&
      typeof CONFIG !== "undefined" &&
      CONFIG &&
      Array.isArray(CONFIG.users) &&
      CONFIG.users.some((u) => u.id === preferredPlanUserId)
    ) {
      ACTIVE_USER_ID = preferredPlanUserId;
      localStorage.setItem(STORAGE_ACTIVE_USER, ACTIVE_USER_ID);
      renderAll();
    }
  }
});

// Logout (si tienes un botón con id="btnLogout" en index.html)
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// --------------------------------------------------------------------------
// CONFIG Y ESTADO LOCAL
// --------------------------------------------------------------------------

// Clave base para localStorage
const STORAGE_KEY = "plan30_state_v3";
// Clave para recordar último usuario activo
const STORAGE_ACTIVE_USER = "plan30_active_user_v3";

// Días máximos (30 días de plan)
const MAX_DAYS = 30;

// Estado base por usuario y día
function createEmptyDayState(dayId) {
  return {
    id: dayId,
    nutrition: {
      proteins: false,
      carbs: false,
      fats: false,
      fruits: false,
      veggies: false,
      lacteos: false,
      whey: false
    },
    training: {
      gymMode: false,
      gymRoutine: null,
      gymBlocks: {},
      walkDone: false,
      padelDone: false
    },
    closed: false,
    notes: ""
  };
}

// Plantilla de GYM_ROUTINES (ya no tan usada, pero por si quieres)
const GYM_ROUTINES = {
  gabo: {
    A: {
      title: "Rutina A — Tren superior (Gabo)",
      blocks: [
        { label: "Movilidad", key: "movilidad" },
        { label: "Cardio ligero", key: "cardio_ligero" },
        { label: "Pecho / Hombro", key: "fuerza_pecho_hombro" },
        { label: "Espalda", key: "fuerza_espalda" },
        { label: "Core", key: "core" },
        { label: "Estiramientos", key: "estiramientos" }
      ]
    },
    B: {
      title: "Rutina B — Tren inferior (Gabo)",
      blocks: [
        { label: "Movilidad", key: "movilidad" },
        { label: "Cardio moderado", key: "cardio_moderado" },
        { label: "Piernas (cuádriceps / femoral)", key: "fuerza_pierna" },
        { label: "Glúteos", key: "fuerza_gluteos" },
        { label: "Core", key: "core" },
        { label: "Estiramientos", key: "estiramientos" }
      ]
    },
    C: {
      title: "Rutina C — Full Body (Gabo)",
      blocks: [
        { label: "Movilidad", key: "movilidad" },
        { label: "Cardio HIIT suave", key: "cardio_hiitsuave" },
        { label: "Full Body (combinado)", key: "fuerza_full" },
        { label: "Core", key: "core" },
        { label: "Estiramientos", key: "estiramientos" }
      ]
    }
  },
  kathy: {
    A: {
      title: "Rutina A — Tren superior (Katherine)",
      blocks: [
        { label: "Movilidad", key: "movilidad" },
        { label: "Cardio ligero", key: "cardio_ligero" },
        { label: "Hombros y espalda", key: "fuerza_upper_pushpull" },
        { label: "Brazos", key: "fuerza_brazos" },
        { label: "Core", key: "core" },
        { label: "Estiramientos", key: "estiramientos" }
      ]
    },
    B: {
      title: "Rutina B — Tren inferior (Katherine)",
      blocks: [
        { label: "Movilidad", key: "movilidad" },
        { label: "Cardio moderado", key: "cardio_moderado" },
        { label: "Piernas y glúteos", key: "fuerza_lower" },
        { label: "Core", key: "core" },
        { label: "Estiramientos", key: "estiramientos" }
      ]
    },
    C: {
      title: "Rutina C — Intensiva (Katherine)",
      blocks: [
        { label: "Movilidad", key: "movilidad" },
        { label: "Cardio intenso", key: "cardio_intenso" },
        { label: "Upper Mix", key: "fuerza_upper_tiron" }, // a gusto
        { label: "Lower Mix", key: "fuerza_lower_b" },
        { label: "Core", key: "core" },
        { label: "Estiramientos", key: "estiramientos" }
      ]
    }
  }
};

let CONFIG = null;
let ACTIVE_USER_ID = null;
let currentDayId = 1;

// Estructura en memoria de estado del plan completo
let appState = {
  // userId => { days: { "1": {...}, "2": {...} }, metrics: {...} }
  users: {}
};

function getUserState(userId) {
  if (!appState.users[userId]) {
    appState.users[userId] = {
      days: {},
      metrics: {
        weightStart: null,
        weightTarget: null,
        weightCurrent: null,
        waterTarget: null,
        waterCurrent: null
      }
    };
  }
  return appState.users[userId];
}

function getDayState(userId, dayId) {
  const u = getUserState(userId);
  const key = String(dayId);
  if (!u.days[key]) {
    u.days[key] = createEmptyDayState(dayId);
  }
  return u.days[key];
}

function getActiveUserConfig() {
  if (!CONFIG || !Array.isArray(CONFIG.users)) return null;
  return CONFIG.users.find((u) => u.id === ACTIVE_USER_ID) || null;
}

// --------------------------------------------------------------------------
// LOCAL STORAGE: CARGA Y GUARDA
// --------------------------------------------------------------------------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { users: {} };
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = {};
    return parsed;
  } catch (err) {
    console.error("Error cargando estado de localStorage:", err);
    return { users: {} };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (err) {
    console.error("Error guardando estado en localStorage:", err);
  }
}

// --------------------------------------------------------------------------
// UTILIDADES DE CONFIG
// --------------------------------------------------------------------------

function getConfigDay(userConfig, dayId) {
  if (!userConfig || !userConfig.days) return null;
  return userConfig.days.find((d) => d.id === dayId) || null;
}

function getConfigDayNutrition(dayConfig) {
  if (!dayConfig || !dayConfig.nutritionKey) return null;
  if (!CONFIG || !Array.isArray(CONFIG.nutrition)) return null;
  return CONFIG.nutrition.find((n) => n.key === dayConfig.nutritionKey) || null;
}

function getConfigDayTraining(dayConfig) {
  if (!dayConfig || !dayConfig.trainingKey) return null;
  if (!CONFIG || !Array.isArray(CONFIG.trainings)) return null;
  return (
    CONFIG.trainings.find((t) => t.key === dayConfig.trainingKey) || {
      blocks: []
    }
  );
}

function getUserMenusConfig(userConfig) {
  if (!CONFIG || !Array.isArray(CONFIG.menus)) return [];
  const ids =
    (userConfig && Array.isArray(userConfig.menuKeys) && userConfig.menuKeys) ||
    [];
  return CONFIG.menus.filter((m) => ids.includes(m.key));
}

// --------------------------------------------------------------------------
// INICIALIZACIÓN
// --------------------------------------------------------------------------

// Helper para manipular texto de un elemento
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// ----------- Inicialización ---------------------------------------------

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  appState = loadState();

  // Cargar config
  try {
    const res = await fetch("plan-config.json");
    CONFIG = await res.json();
  } catch (err) {
    console.error("Error cargando plan-config.json:", err);
    return;
  }

  // Selección de usuario activo
  initUserSelector();

  // Escuchar controles globales
  initGlobalControls();

  // Seleccionar usuario del plan y día inicial
  const storedUser = localStorage.getItem(STORAGE_ACTIVE_USER);

  if (
    preferredPlanUserId &&
    CONFIG.users.some((u) => u.id === preferredPlanUserId)
  ) {
    // 1) Prioridad: usuario del plan asociado al login actual
    ACTIVE_USER_ID = preferredPlanUserId;
  } else if (storedUser && CONFIG.users.some((u) => u.id === storedUser)) {
    // 2) Si no hay mapping, usamos el último usuario usado en este navegador
    ACTIVE_USER_ID = storedUser;
  } else {
    // 3) Por defecto, el primero de la lista
    ACTIVE_USER_ID = CONFIG.users[0].id;
  }

  const daySelector = document.getElementById("daySelect");
  if (daySelector) {
    daySelector.value = String(currentDayId);
    daySelector.addEventListener("change", (e) => {
      currentDayId = parseInt(e.target.value, 10);
      renderAll();
    });
  }

  // Listener botón "Cerrar día"
  const btnCloseDay = document.getElementById("btnCloseDay");
  if (btnCloseDay) {
    btnCloseDay.addEventListener("click", onCloseDayClick);
  }

  // Tab bar inferior
  initTabs();

  // Render inicial
  renderAll();
}

// --------------------------------------------------------------------------
// SELECTOR DE USUARIO (ya sin dropdown en HTML, es opcional)
// --------------------------------------------------------------------------

function initUserSelector() {
  const userSelect = document.getElementById("userSelect");
  if (!userSelect || !CONFIG || !Array.isArray(CONFIG.users)) return;

  userSelect.innerHTML = "";
  CONFIG.users.forEach((user) => {
    const opt = document.createElement("option");
    opt.value = user.id;
    opt.textContent = user.label;
    userSelect.appendChild(opt);
  });

  userSelect.value = ACTIVE_USER_ID || CONFIG.users[0].id;

  userSelect.addEventListener("change", (e) => {
    ACTIVE_USER_ID = e.target.value;
    localStorage.setItem(STORAGE_ACTIVE_USER, ACTIVE_USER_ID);
    renderAll();
  });
}

// --------------------------------------------------------------------------
// CONTROLES GLOBALES
// --------------------------------------------------------------------------

function initGlobalControls() {
  // Porciones diarias: checkboxes
  const nutritionCheckboxIds = [
    "chkProt",
    "chkCarb",
    "chkFats",
    "chkFruits",
    "chkVeggies",
    "chkLact",
    "chkWhey"
  ];
  nutritionCheckboxIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      updateNutritionFromUI();
      saveState();
      renderDayProgress();
    });
  });

  // Entrenamientos: Gym / Caminata / Pádel / Natación, etc.
  const chkGymMode = document.getElementById("chkGymMode");
  if (chkGymMode) {
    chkGymMode.addEventListener("change", () => {
      updateTrainingFromUI();
      saveState();
      renderTrainingSection();
      renderDayProgress();
    });
  }

  ["chkWalkDone", "chkPadelDone", "chkSwimDone"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      updateTrainingFromUI();
      saveState();
      renderTrainingSection();
      renderDayProgress();
    });
  });

  // Notas del día
  const txtNotes = document.getElementById("txtNotes");
  if (txtNotes) {
    txtNotes.addEventListener("input", () => {
      const dayState = getDayState(ACTIVE_USER_ID, currentDayId);
      dayState.notes = txtNotes.value;
      saveState();
    });
  }

  // Métricas (peso, agua, etc.)
  const weightCurrentInput = document.getElementById("weightCurrent");
  const waterCurrentInput = document.getElementById("waterCurrent");
  if (weightCurrentInput) {
    weightCurrentInput.addEventListener("change", () => {
      const u = getUserState(ACTIVE_USER_ID);
      u.metrics.weightCurrent = parseFloat(weightCurrentInput.value) || null;
      saveState();
      renderProgressTab();
    });
  }
  if (waterCurrentInput) {
    waterCurrentInput.addEventListener("change", () => {
      const u = getUserState(ACTIVE_USER_ID);
      u.metrics.waterCurrent = parseFloat(waterCurrentInput.value) || null;
      saveState();
      renderProgressTab();
    });
  }
}

// --------------------------------------------------------------------------
// TABS INFERIORES
// --------------------------------------------------------------------------

function initTabs() {
  const tabButtons = document.querySelectorAll("[data-tab]");

  function showTab(tabName) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    // Panels are identified by id matching the data-tab value
    document.querySelectorAll(".tab-content").forEach((panel) => {
      panel.classList.toggle("active", panel.id === tabName);
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  // Tab por defecto: Día
  showTab("tab-dia");
}

// --------------------------------------------------------------------------
// RENDER PRINCIPAL
// --------------------------------------------------------------------------

function renderAll() {
  if (!CONFIG) return;

  // Día actual y config de usuario
  const userConfig = getActiveUserConfig();
  if (!userConfig) return;

  const dayConfig = getConfigDay(userConfig, currentDayId);
  const dayState = getDayState(ACTIVE_USER_ID, currentDayId);

  renderTopBarUser();
  renderDayHeader(userConfig, dayConfig, dayState);
  renderNutritionSection(dayConfig, dayState);
  renderTrainingSection(dayConfig, dayState);
  renderNotesSection(dayState);
  renderDayProgress(dayConfig, dayState);
  renderMenusTab(userConfig);
  renderProgressTab(userConfig);
  renderProfileTab(userConfig);
}

function renderTopBarUser() {
  const userConfig = getActiveUserConfig();
  if (!userConfig) return;
  // Aquí podrías usar userConfig.label si quieres mostrar "Plan de Gabo", etc.
}

// --------------------------------------------------------------------------
// RENDERIZADO: TAB DÍA
// --------------------------------------------------------------------------

function renderDayHeader(userConfig, dayConfig, dayState) {
  if (!dayConfig) return;

  const dayName = `Día ${dayConfig.id}`;
  setText("dayName", dayName);

  setText("nutritionFocus", dayConfig.nutritionFocus || "");

  const goalCalories = userConfig && userConfig.caloriesGoal;
  const caloriesText = goalCalories
    ? `~${goalCalories.toLocaleString("es-CR")} kcal`
    : "~2400 kcal";
  setText("caloriesGoalLabel", caloriesText);

  const badgeLabel = dayState.closed ? "Día cerrado" : "Día en curso";
  const badgeEl = document.getElementById("badgeDayStatus");
  if (badgeEl) {
    badgeEl.textContent = badgeLabel;
    if (dayState.closed) {
      badgeEl.classList.add("badge-closed");
    } else {
      badgeEl.classList.remove("badge-closed");
    }
  }

  const btnCloseDay = document.getElementById("btnCloseDay");
  if (btnCloseDay) {
    btnCloseDay.disabled = dayState.closed;
  }
}

// Nutrición
function renderNutritionSection(dayConfig, dayState) {
  if (!dayConfig) return;
  const nutritionConfig = getConfigDayNutrition(dayConfig);
  if (!nutritionConfig) return;

  // Marcamos los checkboxes según dayState
  const n = dayState.nutrition || {};
  const map = {
    chkProt: "proteins",
    chkCarb: "carbs",
    chkFats: "fats",
    chkFruits: "fruits",
    chkVeggies: "veggies",
    chkLact: "lacteos",
    chkWhey: "whey"
  };

  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = !!n[key];
  });

  // Texto auxiliar
  setText(
    "nutritionShortDesc",
    nutritionConfig.shortLabel || "Guía de porciones diarias."
  );
}

// Entrenamiento
function renderTrainingSection(dayConfig, dayState) {
  const trainingConfig = getConfigDayTraining(dayConfig || {});
  const t = dayState.training || {};

  const chkGymMode = document.getElementById("chkGymMode");
  if (chkGymMode) {
    chkGymMode.checked = !!t.gymMode;
  }

  const map = {
    chkWalkDone: "walkDone",
    chkPadelDone: "padelDone",
    chkSwimDone: "swimDone"
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = !!t[key];
  });

  setText("gymRoutineTitle", trainingConfig.title || "Rutina de hoy");
  setHTML(
    "gymRoutineBlocks",
    trainingConfig.blocks
      .map((b) => `<li>${b.label}</li>`)
      .join("")
  );
}

// Notas
function renderNotesSection(dayState) {
  const txtNotes = document.getElementById("txtNotes");
  if (!txtNotes) return;
  txtNotes.value = dayState.notes || "";
}

// --------------------------------------------------------------------------
// CIERRE DE DÍA
// --------------------------------------------------------------------------

function onCloseDayClick() {
  const dayState = getDayState(ACTIVE_USER_ID, currentDayId);
  dayState.closed = !dayState.closed;
  saveState();
  renderAll();
}

// --------------------------------------------------------------------------
// PROGRESO DEL DÍA (porcentaje general)
// --------------------------------------------------------------------------

function calculateDayProgress(dayConfig, dayState) {
  if (!dayConfig || !dayState) return 0;

  let totalItems = 0;
  let completed = 0;

  const n = dayState.nutrition || {};
  const nutritionKeys = [
    "proteins",
    "carbs",
    "fats",
    "fruits",
    "veggies",
    "lacteos",
    "whey"
  ];
  nutritionKeys.forEach((k) => {
    totalItems += 1;
    if (n[k]) completed += 1;
  });

  const t = dayState.training || {};
  const trainingKeys = ["walkDone", "padelDone", "swimDone"];
  trainingKeys.forEach((k) => {
    totalItems += 1;
    if (t[k]) completed += 1;
  });

  if (totalItems === 0) return 0;
  return Math.round((completed / totalItems) * 100);
}

function renderDayProgress(dayConfig, dayState) {
  dayConfig = dayConfig || getConfigDay(getActiveUserConfig(), currentDayId);
  dayState = dayState || getDayState(ACTIVE_USER_ID, currentDayId);

  const pct = calculateDayProgress(dayConfig, dayState);
  const bar = document.getElementById("dayProgressFill");
  const label = document.getElementById("dayProgressPercent");

  if (bar) bar.style.width = `${pct}%`;
  if (label) label.textContent = `${pct}%`;
}

// --------------------------------------------------------------------------
// ACTUALIZAR ESTADO DESDE LA UI
// --------------------------------------------------------------------------

function updateNutritionFromUI() {
  const dayState = getDayState(ACTIVE_USER_ID, currentDayId);
  const n = dayState.nutrition;

  const map = {
    chkProt: "proteins",
    chkCarb: "carbs",
    chkFats: "fats",
    chkFruits: "fruits",
    chkVeggies: "veggies",
    chkLact: "lacteos",
    chkWhey: "whey"
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    n[key] = !!el.checked;
  });
}

function updateTrainingFromUI() {
  const dayState = getDayState(ACTIVE_USER_ID, currentDayId);
  const t = dayState.training;

  const chkGymMode = document.getElementById("chkGymMode");
  t.gymMode = !!(chkGymMode && chkGymMode.checked);

  const map = {
    chkWalkDone: "walkDone",
    chkPadelDone: "padelDone",
    chkSwimDone: "swimDone"
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    t[key] = !!el.checked;
  });
}

// --------------------------------------------------------------------------
// TABS: MENÚS, PROGRESO, PERFIL
// --------------------------------------------------------------------------

function renderMenusTab(userConfig) {
  const container = document.getElementById("menusList");
  if (!container) return;

  const menus = getUserMenusConfig(userConfig);
  if (!menus.length) {
    container.innerHTML = "<p>No hay menús configurados todavía.</p>";
    return;
  }

  container.innerHTML = menus
    .map(
      (m) => `
      <article class="card mb-3">
        <div class="card-body">
          <h3 class="card-title h6 mb-2">${m.title}</h3>
          <p class="small text-muted mb-1">${m.desc || ""}</p>
          ${
            m.items && m.items.length
              ? `<ul class="mb-0 small">
                  ${m.items
                    .map(
                      (it) =>
                        `<li><strong>${it.name}</strong>: ${it.detail || ""}</li>`
                    )
                    .join("")}
                 </ul>`
              : ""
          }
        </div>
      </article>
    `
    )
    .join("");
}

function renderProgressTab(userConfig) {
  const weightDiffText = document.getElementById("weightDiffText");
  const waterStatusText = document.getElementById("waterStatusText");
  const monthGridEl = document.getElementById("monthGrid");

  const u = getUserState(ACTIVE_USER_ID);
  const m = u.metrics;

  if (weightDiffText) {
    if (m.weightStart != null && m.weightCurrent != null) {
      const diff = m.weightCurrent - m.weightStart;
      const sign = diff > 0 ? "+" : "";
      weightDiffText.textContent = `${sign}${diff.toFixed(1)} kg desde el inicio del plan.`;
    } else {
      weightDiffText.textContent =
        "Registra tu peso inicial y el peso actual para ver el progreso.";
    }
  }

  if (waterStatusText) {
    if (m.waterTarget != null && m.waterCurrent != null) {
      const pct = Math.round((m.waterCurrent / m.waterTarget) * 100);
      waterStatusText.textContent = `Has cumplido aproximadamente un ${pct}% de tu objetivo de agua hoy.`;
    } else {
      waterStatusText.textContent =
        "Registra tu objetivo y tu consumo de agua para ver el progreso.";
    }
  }

  if (monthGridEl) {
    const cells = [];
    for (let d = 1; d <= MAX_DAYS; d++) {
      const dayState = getDayState(ACTIVE_USER_ID, d);
      const pct = calculateDayProgress(
        getConfigDay(userConfig, d),
        dayState
      );
      cells.push(
        `<div class="month-day-summary">
          <div class="small">Día ${d}</div>
          <div class="small text-muted">${pct}% completado</div>
        </div>`
      );
    }
    monthGridEl.innerHTML = cells.join("");
  }
}

function renderProfileTab(userConfig) {
  const profileNameEl = document.getElementById("profileName");
  const profileGoalEl = document.getElementById("profileGoal");
  const profileCaloriesEl = document.getElementById("profileCalories");
  const profileNotesEl = document.getElementById("profileNotes");

  if (!userConfig) return;

  if (profileNameEl) profileNameEl.textContent = userConfig.label || "";
  if (profileGoalEl)
    profileGoalEl.textContent = userConfig.goal || "Meta general del plan.";
  if (profileCaloriesEl) {
    profileCaloriesEl.textContent = userConfig.caloriesGoal
      ? `${userConfig.caloriesGoal.toLocaleString("es-CR")} kcal diarias`
      : "Meta de calorías no definida.";
  }
  if (profileNotesEl) {
    profileNotesEl.textContent =
      userConfig.notes || "Este es tu plan personal de 30 días.";
  }
}
