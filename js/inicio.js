// ── Dashboard ─────────────────────────────────────────────────

function lastSesionDate(svc) {
  for (const z of svc.zonas || []) {
    const fechas = (z.sesiones || []).filter(s => s.fecha && s.asistio).map(s => s.fecha);
    if (fechas.length) return fechas.sort().at(-1);
  }
  return null;
}

function alertDate(svc) {
  const ls = lastSesionDate(svc);
  if (!ls) return null;
  const freq = svc.frecuenciaPlan || 21; // días
  return addDays(ls, freq);
}

function renderInicio() {
  // Stats
  const totalPacientes = patients.length;
  const totalSesiones  = patients.reduce((a, p) =>
    a + (p.servicios || []).reduce((b, sv) =>
      b + (sv.zonas || []).reduce((c, z) => c + (z.sesiones || []).filter(s => s.asistio).length, 0), 0), 0);

  // A contactar: última sesión ya superó la fecha sugerida
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const aContactar = patients.reduce((a, p) => {
    return a + (p.servicios || []).filter(sv => {
      const ad = alertDate(sv);
      if (!ad) return false;
      const diff = daysDiff(ad);
      return diff !== null && diff >= 0 && diff <= 3;
    }).length;
  }, 0);

  // Láser vs porcelana
  const laser = patients.reduce((a, p) =>
    a + (p.servicios || []).filter(sv => sv.servicio?.toLowerCase().includes('láser') || sv.servicio?.toLowerCase().includes('laser')).length, 0);

  document.getElementById('statPacientes').textContent = totalPacientes;
  document.getElementById('statSesiones').textContent  = totalSesiones;
  document.getElementById('statContactar').textContent = aContactar;
  document.getElementById('statLaser').textContent     = laser;

  // Agenda hoy
  renderAgendaHoy();
}

function renderAgendaHoy() {
  const container = document.getElementById('agendaHoyList');
  if (!container) return;

  const hoy = new Date().toISOString().split('T')[0];
  const citasHoy = citas.filter(c => c.fecha === hoy).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  if (!citasHoy.length) {
    container.innerHTML = '<div class="empty-state"><p>Sin citas programadas para hoy</p></div>';
    return;
  }

  container.innerHTML = citasHoy.map(c => `
    <div class="agenda-item">
      <span class="agenda-hora">${c.hora || '—'}</span>
      <div class="agenda-info">
        <div class="agenda-nombre">${escHtml(c.nombre)} ${escHtml(c.apellido || '')}</div>
        <div class="agenda-det">${escHtml(c.cubiculo || '')} · ${escHtml(c.servicio || '')}</div>
      </div>
      ${c.asistio ? '<span class="badge badge-green">✓ Confirmada</span>' : '<span class="badge badge-gray">Pendiente</span>'}
    </div>
  `).join('');
}
