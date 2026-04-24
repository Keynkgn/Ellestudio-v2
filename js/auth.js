// ── Session ───────────────────────────────────────────────────
function saveSession(role) {
  localStorage.setItem(SESSION_KEY, role);
  localStorage.setItem(SESSION_TS_KEY, Date.now());
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TS_KEY);
}
function getSavedSession() {
  const role = localStorage.getItem(SESSION_KEY);
  const ts   = parseInt(localStorage.getItem(SESSION_TS_KEY) || '0');
  if ((role === 'admin' || role === 'worker') && Date.now() - ts < SESSION_TTL) return role;
  return null;
}

// ── Login ─────────────────────────────────────────────────────
function doLogin() {
  const pass = document.getElementById('loginPass')?.value || '';
  const err  = document.getElementById('loginError');
  if (pass === PASSWORDS.admin) {
    currentRole = 'admin';
  } else if (pass === PASSWORDS.worker) {
    currentRole = 'worker';
  } else {
    if (err) err.textContent = 'Contraseña incorrecta';
    return;
  }
  saveSession(currentRole);
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  initApp();
}

function doLogout() {
  clearSession();
  currentRole = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  const f = document.getElementById('loginPass');
  if (f) { f.value = ''; }
}

// ── Boot ──────────────────────────────────────────────────────
function bootAuth() {
  const saved = getSavedSession();
  if (saved) {
    currentRole = saved;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initApp();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
  // enter key on login
  document.getElementById('loginPass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
}
