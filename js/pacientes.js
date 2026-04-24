// ── Pacientes ─────────────────────────────────────────────────
let _pacSearch = '';
let _pacSelected = null; // paciente abierto

function renderPacientes() {
  const q = _pacSearch.toLowerCase().trim();
  const list = q
    ? patients.filter(p => `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) || (p.telefono||'').includes(q))
    : patients;

  const sorted = [...list].sort((a, b) => `${a.nombre}${a.apellido}`.localeCompare(`${b.nombre}${b.apellido}`));

  document.getElementById('pacCount').textContent = sorted.length + ' pacientes';

  const grid = document.getElementById('pacientesGrid');
  if (!grid) return;

  if (!sorted.length) {
    grid.innerHTML = '<div class="empty-state"><p>Sin resultados</p></div>';
    return;
  }

  grid.innerHTML = sorted.map(p => {
    const svc = (p.servicios || [])[0];
    const numZonas = (p.servicios || []).reduce((a, s) => a + (s.zonas || []).length, 0);
    const numSes   = (p.servicios || []).reduce((a, s) =>
      a + (s.zonas || []).reduce((b, z) => b + (z.sesiones || []).filter(se => se.asistio).length, 0), 0);

    return `
      <div class="card" onclick="abrirPaciente('${escHtml(p.id)}')">
        <div class="card-avatar">${ini(p.nombre, p.apellido)}</div>
        <div class="card-name">${escHtml(p.nombre)} ${escHtml(p.apellido || '')}</div>
        <div style="font-size:0.8rem;color:var(--text-light);margin-top:4px">${escHtml(p.telefono || '—')}</div>
        <div class="card-meta">
          ${svc ? `<span class="badge badge-rose">${escHtml(svc.servicio)}</span>` : ''}
          ${numZonas ? `<span class="badge badge-blue">${numZonas} zona${numZonas>1?'s':''}</span>` : ''}
          ${numSes   ? `<span class="badge badge-green">${numSes} ses.</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Detalle paciente ──────────────────────────────────────────
function abrirPaciente(id) {
  _pacSelected = patients.find(p => String(p.id) === String(id));
  if (!_pacSelected) return;
  const p = _pacSelected;

  document.getElementById('detNombre').textContent   = `${p.nombre} ${p.apellido || ''}`;
  document.getElementById('detTelefono').textContent = p.telefono || '—';
  document.getElementById('detInicio').textContent   = p.fechaInicio ? fmtDate(p.fechaInicio) : '—';

  // Servicios
  const svcHtml = (p.servicios || []).map(sv => {
    const zonaRows = (sv.zonas || []).map(z => {
      const ses = z.sesiones || [];
      const hechas = ses.filter(s => s.asistio).length;
      const pct = ses.length ? Math.round(hechas / ses.length * 100) : 0;
      return `
        <div class="zona-row">
          <div class="zona-nombre">${escHtml(z.nombre)}</div>
          <div class="zona-progress">
            <div class="zona-bar"><div class="zona-fill" style="width:${pct}%"></div></div>
            <span class="zona-count">${hechas}/${ses.length}</span>
          </div>
          <span class="badge ${z.estado==='activa'?'badge-green':'badge-gray'}">${z.estado || 'activa'}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="svc-block">
        <div class="svc-header">
          <span class="badge badge-rose">${escHtml(sv.servicio)}</span>
          <span style="font-size:0.78rem;color:var(--text-light)">${sv.cubiculo || ''} · ${sv.plan || ''}</span>
        </div>
        ${zonaRows || '<div style="font-size:0.82rem;color:var(--text-light);padding:8px 0">Sin zonas registradas</div>'}
      </div>
    `;
  }).join('') || '<div style="font-size:0.82rem;color:var(--text-light)">Sin servicios</div>';

  document.getElementById('detServicios').innerHTML = svcHtml;

  // Comentarios
  document.getElementById('detComentarios').textContent = p.comentarios || 'Sin comentarios';

  openModal('pacienteModal');
}

// ── Nuevo paciente ────────────────────────────────────────────
async function guardarNuevoPaciente() {
  const nombre   = document.getElementById('npNombre')?.value.trim();
  const apellido = document.getElementById('npApellido')?.value.trim();
  const telefono = document.getElementById('npTelefono')?.value.trim();
  const servicio = document.getElementById('npServicio')?.value;
  const cubiculo = document.getElementById('npCubiculo')?.value;

  if (!nombre) { showToast('El nombre es obligatorio', '#c0392b'); return; }
  if (!servicio) { showToast('Selecciona un servicio', '#c0392b'); return; }

  const pid  = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const svcId = `${pid}_svc0`;
  const hoy  = new Date().toISOString().split('T')[0];

  const paciente = {
    id: pid, nombre, apellido: apellido || '', telefono: telefono || '',
    fechaInicio: hoy, comentarios: '',
    servicios: [{ id: svcId, servicio, cubiculo, plan: 'Sesión', fechaInicio: hoy, zonas: [], pago: { precioTotal: 0, separacion: 0 } }],
  };

  try {
    setSyncState('syncing');
    // Insertar en elle_patients
    const { error: ep } = await supa.from('elle_patients').insert([{
      id: pid, nombre, apellido: apellido || '', telefono: telefono || '',
      fecha_inicio: hoy, raw_json: paciente,
    }]);
    if (ep) throw ep;
    // Insertar en elle_services
    const { error: es } = await supa.from('elle_services').insert([{
      id: svcId, patient_id: pid, servicio, cubiculo,
      plan: 'Sesión', fecha_inicio: hoy,
      pago_precio_total: 0, pago_separacion: 0,
      raw_json: paciente.servicios[0],
    }]);
    if (es) throw es;

    patients.push(paciente);
    setSyncState('idle');
    closeModal('nuevoPacienteModal');
    renderPacientes(); renderInicio();
    showToast(`✅ Paciente ${nombre} ${apellido||''} agregada`);
    document.getElementById('npNombre').value = '';
    document.getElementById('npApellido').value = '';
    document.getElementById('npTelefono').value = '';
  } catch(e) {
    console.error('[guardarNuevoPaciente]', e);
    setSyncState('error');
    showToast('❌ No se pudo guardar. Revisa tu conexión.', '#c0392b', 5000);
  }
}
