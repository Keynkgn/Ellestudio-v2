// ── Cargar pacientes desde elle_* ─────────────────────────────
async function loadPatients() {
  const [pRes, sRes, zRes, seRes] = await Promise.all([
    supa.from('elle_patients').select('*'),
    supa.from('elle_services').select('*').order('fecha_inicio', { ascending: true }),
    supa.from('elle_zones').select('*').order('_orden_original', { ascending: true }),
    supa.from('elle_sessions').select('*').order('_orden_original', { ascending: true }),
  ]);
  if (pRes.error) throw pRes.error;

  const sessMap = new Map();
  for (const se of seRes.data || []) {
    const arr = sessMap.get(se.zone_id) || []; arr.push(se); sessMap.set(se.zone_id, arr);
  }
  const zoneMap = new Map();
  for (const z of zRes.data || []) {
    const arr = zoneMap.get(z.service_id) || []; arr.push(z); zoneMap.set(z.service_id, arr);
  }
  const svcMap = new Map();
  for (const s of sRes.data || []) {
    const arr = svcMap.get(s.patient_id) || []; arr.push(s); svcMap.set(s.patient_id, arr);
  }

  patients = (pRes.data || []).map(p => {
    const servicios = (svcMap.get(p.id) || []).map(s => {
      const rp = s.raw_json || {};
      const zonas = (zoneMap.get(s.id) || []).map(z => {
        const sesiones = (sessMap.get(z.id) || []).map(se => Object.assign({}, se.raw_json || {}, {
          id: se.id, fecha: se.fecha || '', asistio: se.asistio || false,
          notas: se.notas || se.comentarios || '',
        }));
        return Object.assign({}, z.raw_json || {}, {
          id: z.id, nombre: z.nombre || '', estado: z.estado || 'activa', sesiones,
        });
      });
      const pago = Object.assign({}, rp.pago || {}, {
        precioTotal: s.pago_precio_total != null ? parseFloat(s.pago_precio_total) : (rp.pago?.precioTotal || 0),
        separacion:  s.pago_separacion  != null ? parseFloat(s.pago_separacion)  : (rp.pago?.separacion  || 0),
      });
      return Object.assign({}, rp, {
        id: s.id, servicio: s.servicio || '', cubiculo: s.cubiculo || '',
        plan: s.plan || '', fechaInicio: s.fecha_inicio || '',
        frecuenciaPlan: s.frecuencia_plan || null, pago, zonas,
      });
    });
    const rj = p.raw_json || {};
    return Object.assign({}, rj, {
      id: p.id, nombre: p.nombre || '', apellido: p.apellido || '',
      telefono: p.telefono || '',
      fechaInicio: p.fecha_inicio || rj.fechaInicio || '',
      comentarios: p.comentarios || '',
      fotos: p.fotos || [],
      servicios,
    });
  });

  try { localStorage.setItem('es2_patients', JSON.stringify(patients)); } catch(e) {}
  return patients;
}

// ── Cargar pagos ──────────────────────────────────────────────
async function loadPayments() {
  const { data, error } = await supa.from('elle_payments').select('*').order('fecha', { ascending: false });
  if (error) throw error;
  registros = (data || []).map(r => ({
    id:       r.id,
    fecha:    r.fecha    || '',
    nombre:   r.nombre   || '',
    apellido: r.apellido || '',
    telefono: r.telefono || '',
    servicio: r.servicio || '',
    zonas:    r.zonas    || '',
    total:    r.total    != null ? parseFloat(r.total)    : null,
    adelanto: r.adelanto != null ? parseFloat(r.adelanto) : null,
    atendio:  r.atendio  || '',
    comision: r.comision != null ? parseFloat(r.comision) : null,
    notas:    r.notas    || '',
  }));
  try { localStorage.setItem('es2_registros', JSON.stringify(registros)); } catch(e) {}
  return registros;
}

// ── Cargar pre-citas ──────────────────────────────────────────
async function loadPreCitas() {
  const { data, error } = await supa.from('elle_precitas').select('*').order('fecha_creacion', { ascending: false });
  if (error) throw error;
  preCitas = data || [];
  return preCitas;
}

// ── Cargar citas (appointments) ───────────────────────────────
async function loadCitas() {
  const { data, error } = await supa.from('elle_appointments').select('*').order('fecha', { ascending: true });
  if (error) throw error;
  citas = data || [];
  return citas;
}

// ── Init app data ─────────────────────────────────────────────
async function initApp() {
  setSyncState('syncing');
  try {
    await Promise.all([loadPatients(), loadPayments(), loadPreCitas(), loadCitas()]);
    setSyncState('idle');
    showSection('inicio');
    startAutoRefresh();
    subscribeRealtime();
  } catch(e) {
    console.error('[initApp]', e);
    setSyncState('error');
    showToast('❌ Error cargando datos. Revisa tu conexión.', '#c0392b', 5000);
    // fallback local
    try { patients  = JSON.parse(localStorage.getItem('es2_patients')  || '[]'); } catch(e2) {}
    try { registros = JSON.parse(localStorage.getItem('es2_registros') || '[]'); } catch(e2) {}
    showSection('inicio');
  }
}

// ── Auto-refresh cada 60s ─────────────────────────────────────
function startAutoRefresh() {
  setInterval(async () => {
    if (document.querySelector('.modal-overlay.open')) return;
    try {
      await Promise.all([loadPatients(), loadPayments(), loadPreCitas()]);
      renderInicio();
      if (document.getElementById('sec-pacientes')?.classList.contains('active')) renderPacientes();
      if (document.getElementById('sec-pagos')?.classList.contains('active'))     renderPagos();
      if (document.getElementById('sec-precitas')?.classList.contains('active'))  renderPreCitas();
    } catch(e) {}
  }, 60000);
}

// ── Realtime ──────────────────────────────────────────────────
function subscribeRealtime() {
  // Pagos
  supa.channel('es2_payments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'elle_payments' }, payload => {
      const { eventType, new: n, old: o } = payload;
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const r = {
          id: n.id, fecha: n.fecha||'', nombre: n.nombre||'', apellido: n.apellido||'',
          telefono: n.telefono||'', servicio: n.servicio||'', zonas: n.zonas||'',
          total: n.total!=null?parseFloat(n.total):null, adelanto: n.adelanto!=null?parseFloat(n.adelanto):null,
          atendio: n.atendio||'', comision: n.comision!=null?parseFloat(n.comision):null, notas: n.notas||'',
        };
        const idx = registros.findIndex(x => String(x.id) === String(r.id));
        if (idx >= 0) registros[idx] = r; else registros.unshift(r);
      } else if (eventType === 'DELETE') {
        registros = registros.filter(x => String(x.id) !== String(o.id));
      }
      if (document.getElementById('sec-pagos')?.classList.contains('active')) renderPagos();
    }).subscribe();

  // Pacientes (solo INSERT/DELETE simples — UPDATE se recarga en 60s)
  supa.channel('es2_patients')
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'elle_patients' }, payload => {
      patients = patients.filter(p => String(p.id) !== String(payload.old.id));
      renderInicio();
      if (document.getElementById('sec-pacientes')?.classList.contains('active')) renderPacientes();
    }).subscribe();
}
