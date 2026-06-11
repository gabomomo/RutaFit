// app-common.js (ESM)

// Query helpers
export function getQuery() {
  return Object.fromEntries(new URLSearchParams(window.location.search).entries());
}

export function buildUrl(path, params = {}) {
  const url = new URL(path, window.location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length) url.searchParams.set(k, String(v));
  });
  return url.pathname + url.search;
}

export function navigateWithUid(path, uid) {
  window.location.href = buildUrl(path, { uid });
}

// UI helpers
export function setSessionUI({ emailEl, avatarEl, user }) {
  const email = user?.email || '';
  if (emailEl) emailEl.textContent = email;
  if (avatarEl) avatarEl.textContent = (email?.[0] || 'A').toUpperCase();
}

// Auth helpers
export function bindLogout({ auth, buttonId, redirectTo = 'login.html', signOutFn }) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      if (typeof signOutFn === 'function') {
        await signOutFn(auth);
      } else {
        // fallback si no pasás signOutFn (pero lo ideal es pasarlo)
        console.warn('bindLogout: faltó signOutFn(auth).');
      }
    } finally {
      window.location.href = redirectTo;
    }
  });
}