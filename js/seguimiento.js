// ── Seguimiento ───────────────────────────────────────────────
function renderSeguimiento() {
  const container = document.getElementById('seguimientoList');
  if (!container) return;

  // Pacientes con sesión activa y zona activa
  const activos = patients.filter(p =>
    (p.servicios || []).some(sv => (sv.zonas || []).some(z => z.estado === 'activa'))
  ).sort((a, b) => `${a.nombre}${a.apellido}`.localeCompare(`${b.nombre}${b.apellido}`));

  if (!activos.length) {
    container.innerHTML = '<div class="empty-state"><p>Sin pacientes activos</p></div>';
    return;
  }

  container.innerHTML = activos.map(p => {
    const rows = (p.servicios || []).flatMap(sv =>
      (sv.zonas || []).filter(z => z.estado === 'activa').map(z => {
        const ses = z.sesiones || [];
        const hechas = ses.filter(s => s.asistio).length;
        const total  = ses.length;
        const pct    = total ? Math.round(hechas / total * 100) : 0;
        const ultima = ses.filter(s => s.asistio && s.fecha).map(s => s.fecha).sort().at(-1);
        const ad     = alertDate(sv);
        const diff   = ad ? daysDiff(ad) : null;
        const alertClass = diff !== null && diff >= 0 && diff <= 3 ? 'badge-red' : diff !== null && diff < 0 ? 'badge-gray' : '';

        return `
          <div class="zona-row">
            <div class="zona-nombre">${escHtml(z.nombre)}</div>
            <div class="zona-progress">
              <div class="zona-bar"><div class="zona-fill" style="width:${pct}%"></div></div>
              <span class="zona-count">${hechas}/${total}</span>
            </div>
            ${ultima ? `<span style="font-size:0.78rem;color:var(--text-light)">Últ: ${fmtDate(ultima)}</span>` : ''}
            ${alertClass ? `<span class="badge ${alertClass}">Contactar</span>` : ''}
          </div>
        `;
      })
    ).join('');

    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div class="card-avatar">${ini(p.nombre, p.apellido)}</div>
          <div>
            <div class="card-name">${escHtml(p.nombre)} ${escHtml(p.apellido || '')}</div>
            <div style="font-size:0.8rem;color:var(--text-light)">${escHtml(p.telefono || '—')}</div>
          </div>
        </div>
        ${rows}
      </div>
    `;
  }).join('');
}
