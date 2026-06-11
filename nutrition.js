// nutrition.js
import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/** =========================
 * Helpers (DEBEN IR ARRIBA)
 * ========================= */
function qs(id){ return document.getElementById(id); }
function num(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function round1(n){ return Math.round(n * 10) / 10; }

function uidFromUrl() {
  const p = new URLSearchParams(window.location.search);
  return p.get("uid") || "";
}

function makeTimeOptions() {
  const opts = [];
  for (let h=0; h<24; h++){
    for (let m=0; m<60; m+=30){
      const hh = String(h).padStart(2,"0");
      const mm = String(m).padStart(2,"0");
      opts.push(`${hh}:${mm}`);
    }
  }
  return opts;
}

function escapeHtml(s=""){
  return String(s).replace(/[&<>"']/g, (c)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

/** =========================
 * Config
 * ========================= */
const MAX_PLANS = 3;

const GROUPS = [
  { key: "protein", label: "Proteínas" },
  { key: "carb", label: "Carbos" },
  { key: "veg", label: "Vegetales" },
  { key: "fruit", label: "Frutas" },
  { key: "fat", label: "Grasas" },
  { key: "dairy", label: "Lácteos" }
];

const SUGGESTED = {
  protein: ["Pechuga de pollo", "Atún", "Huevos", "Carne magra", "Pescado", "Tofu"],
  carb: ["Arroz", "Papa", "Avena", "Pan integral", "Pasta", "Tortilla"],
  veg: ["Ensalada verde", "Brócoli", "Zanahoria", "Pepino", "Espinaca", "Tomate"],
  fruit: ["Banano", "Manzana", "Fresa", "Papaya", "Piña", "Uvas"],
  fat: ["Aguacate", "Aceite de oliva", "Nueces", "Mantequilla de maní", "Semillas"],
  dairy: ["Leche", "Yogurt griego", "Queso cottage", "Queso bajo en grasa"]
};

function unitOptions(selected){
  const units = ["porciones", "gramos", "ml", "cucharadas", "piezas"];
  return units.map(u=>{
    const sel = u === selected ? "selected" : "";
    return `<option value="${u}" ${sel}>${u}</option>`;
  }).join("");
}

function groupOptions(selected){
  return GROUPS.map(g=>{
    const sel = g.key === selected ? "selected" : "";
    return `<option value="${g.key}" ${sel}>${g.label}</option>`;
  }).join("");
}

function datalistHtml(){
  return GROUPS.map(g=>{
    const opts = (SUGGESTED[g.key] || [])
      .map(v=>`<option value="${escapeHtml(v)}"></option>`)
      .join("");
    return `<datalist id="dl-${g.key}">${opts}</datalist>`;
  }).join("");
}

/** =========================
 * State
 * ========================= */
const state = {
  uid: uidFromUrl(),
  userDoc: null,
  plans: [],
  activePlanIndex: 0,
  baseSaved: false
};

function newEmptyPlan(n){
  return {
    id: `plan${n}`,
    base: {
      calories: 0,
      waterPerDay: "",
      quotas: { protein:0, carb:0, veg:0, fruit:0, fat:0, dairy:0 }
    },
    meals: [],
    updatedAt: null
  };
}

/** =========================
 * DOM refs
 * ========================= */
const lblSessionEmail = qs("lblSessionEmail");
const lblUserName = qs("lblUserName");
const lblUserEmail = qs("lblUserEmail");
const btnLogout = qs("btnLogout");

const planTabs = qs("planTabs");
const btnAddPlan = qs("btnAddPlan");
const btnDeletePlan = qs("btnDeletePlan");

const inpCalories = qs("inpCalories");
const inpWater = qs("inpWater");

const qProtein = qs("qProtein");
const qCarb = qs("qCarb");
const qVeg = qs("qVeg");
const qFruit = qs("qFruit");
const qFat = qs("qFat");
const qDairy = qs("qDairy");

const btnSaveBase = qs("btnSaveBase");
const baseSavedHint = qs("baseSavedHint");

const mealsSection = qs("mealsSection");
const mealsList = qs("mealsList");
const btnAddMeal = qs("btnAddMeal");
const btnSavePlanAll = qs("btnSavePlanAll");

const quotaSummary = qs("quotaSummary");
const quotaRemaining = qs("quotaRemaining");

// Modal
const mealModalEl = qs("mealModal");
const mealType = qs("mealType");
const mealTime = qs("mealTime");
const btnCreateMeal = qs("btnCreateMeal");

const mealModal = mealModalEl ? new bootstrap.Modal(mealModalEl) : null;

/** =========================
 * Auth + load
 * ========================= */
onAuthStateChanged(auth, async (user)=>{
  if (!user){
    window.location.href = "login.html";
    return;
  }
  lblSessionEmail.textContent = user.email || "—";

  if (!state.uid){
    alert("Falta uid en la URL. Abre esta página desde Admin con ?uid=DOC_ID");
    window.location.href = "admin.html";
    return;
  }

  await loadUserAndPlans();
  renderPlanTabs();
  loadActivePlanToUI();
});

btnLogout?.addEventListener("click", async ()=>{
  await signOut(auth);
  window.location.href = "login.html";
});

/** =========================
 * Load Firestore
 * ========================= */
async function loadUserAndPlans(){
  const ref = doc(db, "clients", state.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()){
    alert("No se encontró el usuario del plan en Firestore.");
    window.location.href = "admin.html";
    return;
  }

  state.userDoc = { id: snap.id, ...(snap.data() || {}) };

  const fullName = `${state.userDoc.firstName || ""} ${state.userDoc.lastName || ""}`.trim() || "Usuario";
  lblUserName.textContent = fullName;
  lblUserEmail.textContent = state.userDoc.email || "—";

  const existing = Array.isArray(state.userDoc.nutritionPlans) ? state.userDoc.nutritionPlans : null;

  if (existing && existing.length){
    state.plans = existing.slice(0, MAX_PLANS).map((p, i)=>({
      ...newEmptyPlan(i+1),
      ...p,
      base: { ...newEmptyPlan(i+1).base, ...(p.base || {}) },
      meals: Array.isArray(p.meals) ? p.meals : []
    }));
  } else {
    state.plans = [ newEmptyPlan(1) ];
  }

  if (state.activePlanIndex >= state.plans.length) state.activePlanIndex = 0;
}

/** =========================
 * Tabs / plans
 * ========================= */
function renderPlanTabs(){
  planTabs.innerHTML = "";
  state.plans.forEach((p, idx)=>{
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn ${idx===state.activePlanIndex ? "btn-primary" : "btn-soft"}`;
    btn.textContent = `Plan ${idx+1}`;
    btn.addEventListener("click", ()=>{
      state.activePlanIndex = idx;
      renderPlanTabs();
      loadActivePlanToUI();
    });
    planTabs.appendChild(btn);
  });

  if (btnAddPlan) btnAddPlan.disabled = state.plans.length >= MAX_PLANS;
  if (btnDeletePlan) btnDeletePlan.disabled = state.plans.length <= 1;
}

btnAddPlan?.addEventListener("click", ()=>{
  if (state.plans.length >= MAX_PLANS) return;
  state.plans.push(newEmptyPlan(state.plans.length+1));
  state.activePlanIndex = state.plans.length - 1;
  renderPlanTabs();
  loadActivePlanToUI();
});

/** =========================
 * 3) Eliminar plan completo + reindex
 * ========================= */
btnDeletePlan?.addEventListener("click", ()=>{
  if (state.plans.length <= 1){
    alert("Debe existir al menos 1 plan.");
    return;
  }

  const idx = state.activePlanIndex;
  const ok = confirm(`¿Eliminar Plan ${idx+1}? Esta acción no se puede deshacer.`);
  if (!ok) return;

  state.plans.splice(idx, 1);

  // Reindex IDs plan1, plan2, plan3...
  state.plans = state.plans.map((p, i)=>({
    ...p,
    id: `plan${i+1}`
  }));

  if (state.activePlanIndex >= state.plans.length) state.activePlanIndex = state.plans.length - 1;

  renderPlanTabs();
  loadActivePlanToUI();
});

/** =========================
 * Step 1: Base
 * ========================= */
btnSaveBase?.addEventListener("click", ()=>{
  const p = state.plans[state.activePlanIndex];

  // ✅ DECLARAR ANTES DE USAR (evita TDZ)
  const caloriesVal = num(inpCalories?.value);
  const waterPerDayVal = (inpWater?.value || "").trim();

  const quotasVal = {
    protein: num(qProtein?.value),
    carb: num(qCarb?.value),
    veg: num(qVeg?.value),
    fruit: num(qFruit?.value),
    fat: num(qFat?.value),
    dairy: num(qDairy?.value)
  };

  if (!caloriesVal || caloriesVal <= 0){
    alert("Ingresa calorías válidas (ej: 1800).");
    return;
  }

  // Guardar en el plan activo
  p.base = { calories: caloriesVal, waterPerDay: waterPerDayVal, quotas: quotasVal };
  state.baseSaved = true;

  if (baseSavedHint) baseSavedHint.style.display = "";
  if (mealsSection) mealsSection.style.display = "";

  updateQuotaPanels();
  renderMeals();
});

/** =========================
 * Meals
 * ========================= */
(function initTimeDropdown(){
  if (!mealTime) return;
  mealTime.innerHTML = makeTimeOptions()
    .map(t=>`<option value="${t}">${t}</option>`)
    .join("");
})();

btnAddMeal?.addEventListener("click", ()=>{
  if (!state.baseSaved){
    alert("Primero guarda la base (calorías y cupos).");
    return;
  }
  mealType.value = "Desayuno";
  mealTime.value = "07:00";
  mealModal?.show();
});

btnCreateMeal?.addEventListener("click", ()=>{
  const p = state.plans[state.activePlanIndex];

  const meal = {
    id: crypto.randomUUID(),
    type: mealType.value,
    time: mealTime.value,
    locked: false,
    rows: [
      { group: "protein", amount: 1, unit: "porciones", suggested: "" }
    ]
  };

  p.meals.push(meal);
  mealModal?.hide();

  renderMeals();
  updateQuotaPanels();
});

function loadActivePlanToUI(){
  const p = state.plans[state.activePlanIndex];

  // base
  if (inpWater) inpWater.value = p.base?.waterPerDay ?? "";
  if (inpCalories) inpCalories.value = p.base?.calories ?? "";

  if (qProtein) qProtein.value = p.base?.quotas?.protein ?? "";
  if (qCarb) qCarb.value = p.base?.quotas?.carb ?? "";
  if (qVeg) qVeg.value = p.base?.quotas?.veg ?? "";
  if (qFruit) qFruit.value = p.base?.quotas?.fruit ?? "";
  if (qFat) qFat.value = p.base?.quotas?.fat ?? "";
  if (qDairy) qDairy.value = p.base?.quotas?.dairy ?? "";

  state.baseSaved = (num(p.base?.calories) > 0);

  if (baseSavedHint) baseSavedHint.style.display = state.baseSaved ? "" : "none";
  if (mealsSection) mealsSection.style.display = state.baseSaved ? "" : "none";

  renderPlanTabs();

  if (state.baseSaved){
    updateQuotaPanels();
    renderMeals();
  } else {
    if (mealsList) mealsList.innerHTML = "";
  }
}

function totalsUsed(plan){
  const used = { protein:0, carb:0, veg:0, fruit:0, fat:0, dairy:0 };
  for (const m of (plan.meals || [])){
    if (!m.locked) continue;
    for (const r of (m.rows || [])){
      const g = r.group;
      const a = num(r.amount);
      if (used[g] != null) used[g] += a;
    }
  }
  for (const k of Object.keys(used)) used[k] = round1(used[k]);
  return used;
}

function remaining(plan){
  const q = plan.base?.quotas || {};
  const u = totalsUsed(plan);
  const rem = {};
  for (const g of Object.keys(u)){
    rem[g] = round1(num(q[g]) - num(u[g]));
  }
  return { used: u, remaining: rem, quotas: q };
}

function updateQuotaPanels(){
  const p = state.plans[state.activePlanIndex];
  const { used, remaining: rem, quotas: q } = remaining(p);

  if (quotaSummary){
    quotaSummary.textContent =
      `Proteínas ${q.protein||0} · Carbos ${q.carb||0} · Vegetales ${q.veg||0} · Frutas ${q.fruit||0} · Grasas ${q.fat||0} · Lácteos ${q.dairy||0}`;
  }

  if (quotaRemaining){
    quotaRemaining.textContent =
      `Proteínas ${rem.protein} (usado ${used.protein}) · Carbos ${rem.carb} (usado ${used.carb}) · ` +
      `Vegetales ${rem.veg} (usado ${used.veg}) · Frutas ${rem.fruit} (usado ${used.fruit}) · ` +
      `Grasas ${rem.fat} (usado ${used.fat}) · Lácteos ${rem.dairy} (usado ${used.dairy})`;
  }
}

function renderMeals(){
  const p = state.plans[state.activePlanIndex];
  if (!mealsList) return;

  mealsList.innerHTML = "";

  if (!p.meals.length){
    mealsList.innerHTML = `<div class="muted">No hay tiempos de comida. Usa “Agregar tiempo de comida”.</div>`;
    return;
  }

  p.meals.forEach((m)=>{
    const card = document.createElement("div");
    card.className = "glass-card p-3";

    const header = document.createElement("div");
    header.className = "d-flex align-items-start justify-content-between flex-wrap gap-2";

    header.innerHTML = `
      <div>
        <div class="fw-semibold">${escapeHtml(m.type)} · <span class="muted">${escapeHtml(m.time)}</span></div>
        <div class="muted small">${m.locked ? "Guardado" : "En edición"}</div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-soft-editar btn-sm" data-action="toggle">
          ${m.locked ? '<i class="bi bi-pencil"></i> Editar' : '<i class="bi bi-lock"></i> Guardar tiempo'}
        </button>
        <button class="btn btn-outline-danger btn-sm" data-action="remove" title="Eliminar tiempo">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "mt-3";

    const rowsHtml = (m.rows || []).map((r, rIdx)=>`
      <tr>
        <td style="width: 28%;">
          <select class="form-select form-select-sm"
                  data-row="${m.id}" data-ridx="${rIdx}" data-field="group"
                  ${m.locked ? "disabled":""}>
            ${groupOptions(r.group)}
          </select>
        </td>

        <td style="width: 14%;">
          <input class="form-control form-control-sm" type="number" min="0" step="0.5"
                 value="${r.amount ?? 0}"
                 data-row="${m.id}" data-ridx="${rIdx}" data-field="amount"
                 ${m.locked ? "disabled":""}>
        </td>

        <td style="width: 16%;">
          <select class="form-select form-select-sm"
                  data-row="${m.id}" data-ridx="${rIdx}" data-field="unit"
                  ${m.locked ? "disabled":""}>
            ${unitOptions(r.unit || "porciones")}
          </select>
        </td>

        <td style="width: 44%;">
          <input class="form-control form-control-sm"
                 value="${escapeHtml(r.suggested || "")}"
                 list="dl-${r.group}"
                 placeholder="Escribe o elige…"
                 data-row="${m.id}" data-ridx="${rIdx}" data-field="suggested"
                 ${m.locked ? "disabled":""}>
        </td>

        <td class="text-end" style="width: 10%;">
          <div class="d-flex justify-content-end gap-2">
            <button class="btn btn-soft-editar btn-sm" data-action="addRow" ${m.locked ? "disabled":""} title="Agregar fila">+</button>
            <button class="btn btn-soft-editar btn-sm" data-action="delRow" ${m.locked ? "disabled":""} title="Eliminar fila">-</button>
          </div>
        </td>
      </tr>
    `).join("");

    body.innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm table-darkish table-striped align-middle mb-0">
          <thead>
            <tr class="muted">
              <th>Tipo de alimento</th>
              <th style="width: 14%;">Cantidad</th>
              <th style="width: 16%;">Unidad</th>
              <th>Sugeridos</th>
              <th class="text-end">Filas</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${datalistHtml()}
    `;

    card.appendChild(header);
    card.appendChild(body);

    // Botones del card
    card.addEventListener("click", (ev)=>{
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;

      if (action === "remove"){
        p.meals = p.meals.filter(x=>x.id !== m.id);
        renderMeals();
        updateQuotaPanels();
        return;
      }

      if (action === "toggle"){
        if (!m.locked){
          const ok = validateMealAgainstQuotas(p, m);
          if (!ok) return;
          m.locked = true;
        } else {
          m.locked = false;
        }
        renderMeals();
        updateQuotaPanels();
        return;
      }

      if (action === "addRow"){
        m.rows.push({ group: "protein", amount: 1, unit: "porciones", suggested: "" });
        renderMeals();
        return;
      }

      if (action === "delRow"){
        if (m.rows.length <= 1) return;
        m.rows.pop();
        renderMeals();
        return;
      }
    });

    // Change (selects)
    card.addEventListener("change", (ev)=>{
      const el = ev.target;
      const mealId = el.getAttribute("data-row");
      if (!mealId) return;

      const ridx = Number(el.getAttribute("data-ridx"));
      const field = el.getAttribute("data-field");
      if (!Number.isFinite(ridx) || !field) return;

      const meal = p.meals.find(x=>x.id === mealId);
      if (!meal) return;

      const row = meal.rows[ridx];
      if (!row) return;

      if (field === "group"){
        row.group = el.value;
        row.suggested = "";
        renderMeals(); // refresca datalist/atributo list
        return;
      }

      if (field === "unit"){
        row.unit = el.value;
        return;
      }
    });

    // Input (amount + suggested libre)
    card.addEventListener("input", (ev)=>{
      const el = ev.target;
      const mealId = el.getAttribute("data-row");
      if (!mealId) return;

      const ridx = Number(el.getAttribute("data-ridx"));
      const field = el.getAttribute("data-field");
      if (!Number.isFinite(ridx) || !field) return;

      const meal = p.meals.find(x=>x.id === mealId);
      if (!meal) return;

      const row = meal.rows[ridx];
      if (!row) return;

      if (field === "amount"){
        row.amount = num(el.value);
        return;
      }

      if (field === "suggested"){
        row.suggested = el.value;
        return;
      }
    });

    mealsList.appendChild(card);
  });
}

function validateMealAgainstQuotas(plan, mealToLock){
  const q = plan.base?.quotas || {};
  const used = { protein:0, carb:0, veg:0, fruit:0, fat:0, dairy:0 };

  for (const m of plan.meals){
    const willCount = (m.id === mealToLock.id) ? true : !!m.locked;
    if (!willCount) continue;

    for (const r of (m.rows || [])){
      const g = r.group;
      const a = num(r.amount);
      if (used[g] != null) used[g] += a;
    }
  }

  for (const g of Object.keys(used)){
    used[g] = round1(used[g]);
    const quota = num(q[g]);

    if (used[g] - quota > 1e-9){
      const label = GROUPS.find(x=>x.key===g)?.label || g;
      alert(`No se puede guardar este tiempo de comida.\n\nExcede el cupo de ${label}.\nCupo: ${quota} · Usado: ${used[g]}`);
      return false;
    }
  }
  return true;
}

/** =========================
 * Guardar plan completo (Firestore)
 * ========================= */
btnSavePlanAll?.addEventListener("click", async ()=>{
  const p = state.plans[state.activePlanIndex];

  if (!(num(p.base?.calories) > 0)){
    alert("Primero guarda la base (Paso 1).");
    return;
  }

  const anyEditing = p.meals.some(m=>!m.locked);
  if (anyEditing){
    alert("Hay tiempos de comida en edición. Guarda cada tiempo antes de guardar el plan completo.");
    return;
  }

  try{
    const ref = doc(db, "clients", state.uid);

    const cleanedPlans = state.plans.slice(0, MAX_PLANS).map((pl, i)=>({
      id: pl.id || `plan${i+1}`,
      base: {
        calories: num(pl.base?.calories),
        waterPerDay: (pl.base?.waterPerDay || "").trim(),
        quotas: {
          protein: num(pl.base?.quotas?.protein),
          carb: num(pl.base?.quotas?.carb),
          veg: num(pl.base?.quotas?.veg),
          fruit: num(pl.base?.quotas?.fruit),
          fat: num(pl.base?.quotas?.fat),
          dairy: num(pl.base?.quotas?.dairy)
        }
      },
      meals: (pl.meals || []).map(m=>({
        id: m.id,
        type: m.type,
        time: m.time,
        locked: true,
        rows: (m.rows || []).map(r=>({
          group: r.group,
          amount: num(r.amount),
          unit: r.unit || "porciones",
          suggested: r.suggested || ""
        }))
      })),
      updatedAt: new Date().toISOString()
    }));

    await updateDoc(ref, {
      nutritionPlans: cleanedPlans,
      updatedAt: serverTimestamp()
    });

    alert("Plan nutricional guardado ✅");
  } catch (err){
    console.error(err);
    alert("Error guardando plan nutricional.");
  }
});
