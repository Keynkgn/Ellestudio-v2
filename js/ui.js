// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, color = '#1c1c17', duration = 2800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = color;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── Active tab / section ──────────────────────────────────────
function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
  const sec = document.getElementById('sec-' + sectionId);
  if (sec) sec.classList.add('active');
  const tab = document.querySelector(`.app-tab[data-section="${sectionId}"]`);
  if (tab) tab.classList.add('active');
  // render on switch
  if (sectionId === 'inicio')     renderInicio();
  if (sectionId === 'pacientes')  renderPacientes();
  if (sectionId === 'pagos')      renderPagos();
  if (sectionId === 'precitas')   renderPreCitas();
  if (sectionId === 'agenda')     renderAgenda();
  if (sectionId === 'seguimiento') renderSeguimiento();
}

// ── Sync dot ──────────────────────────────────────────────────
function setSyncState(state) {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  dot.className = 'sync-dot' + (state !== 'idle' ? ' ' + state : '');
}

// ── Utils ─────────────────────────────────────────────────────
function ini(n = '', a = '') { return (n[0] || '') + (a[0] || ''); }
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function daysDiff(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}
function addDays(ds, days) {
  if (!ds) return '';
  const d = new Date(ds); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function tcase(s) {
  return String(s || '').replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
