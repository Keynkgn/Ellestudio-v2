// ── Pre-citas ─────────────────────────────────────────────────
function renderPreCitas() {
  const list = [...preCitas].sort((a, b) => (a.fecha_tentativa||'').localeCompare(b.fecha_tentativa||''));
  const tbody = document.getElementById('preCitasBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-light)">Sin pre-citas</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${fmtDate(c.fecha_tentativa)}</td>
      <td><strong>${escHtml(c.nombre)}</strong> ${escHtml(c.apellido || '')}</td>
      <td>${escHtml(c.telefono || '—')}</td>
      <td>${escHtml(c.servicio || '—')}</td>
      <td>
        <span class="badge ${c.estado==='pendiente'?'badge-blue':c.estado==='confirmada'?'badge-green':'badge-gray'}">
          ${c.estado || 'pendiente'}
        </span>
      </td>
      <td>${c.separacion ? 'S/ ' + parseFloat(c.separacion).toFixed(2) : '—'}</td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="abrirWA('${escHtml(c.telefono||'')}')">📱</button>
        ${currentRole === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="eliminarPreCita('${escHtml(c.id)}')">🗑</button>` : ''}
      </td>
    </tr>
  `).join('');

  // Stats
  const pend = list.filter(c => c.estado === 'pendiente').length;
  const conf = list.filter(c => c.estado === 'confirmada').length;
  document.getElementById('pcCount').textContent = `${pend} pendientes · ${conf} confirmadas`;
}

async function eliminarPreCita(id) {
  if (currentRole !== 'admin') return;
  if (!confirm('¿Eliminar esta pre-cita?')) return;
  try {
    const { error } = await supa.from('elle_precitas').delete().eq('id', String(id));
    if (error) throw error;
    preCitas = preCitas.filter(c => String(c.id) !== String(id));
    renderPreCitas();
    showToast('Pre-cita eliminada', '#c46060');
  } catch(e) {
    showToast('❌ No se pudo eliminar.', '#c0392b', 4000);
  }
}

async function guardarNuevaPreCita() {
  const nombre  = (document.getElementById('pcNombre')?.value || '').trim();
  const telefono = (document.getElementById('pcTelefono')?.value || '').trim();
  const servicio = document.getElementById('pcServicio')?.value || '';
  const fecha   = document.getElementById('pcFecha')?.value || '';

  if (!nombre) { showToast('El nombre es obligatorio', '#c0392b'); return; }

  const id = 'pc_' + Date.now();
  const nueva = {
    id, nombre,
    apellido:        (document.getElementById('pcApellido')?.value || '').trim(),
    telefono,
    servicio,
    cubiculo:        document.getElementById('pcCubiculo')?.value || '',
    hora:            (document.getElementById('pcHora')?.value || '').trim(),
    fecha_tentativa: fecha || null,
    estado:          'pendiente',
    separacion:      parseFloat(document.getElementById('pcSeparacion')?.value) || 0,
    notas:           (document.getElementById('pcNotas')?.value || '').trim(),
    fecha_creacion:  new Date().toISOString().split('T')[0],
    raw_json:        {},
  };

  try {
    setSyncState('syncing');
    const { error } = await supa.from('elle_precitas').insert([nueva]);
    if (error) throw error;
    preCitas.unshift(nueva);
    setSyncState('idle');
    closeModal('nuevaPreCitaModal');
    renderPreCitas();
    showToast(`✅ Pre-cita guardada: ${nombre}`);
  } catch(e) {
    console.error('[guardarNuevaPreCita]', e);
    setSyncState('error');
    showToast('❌ No se pudo guardar.', '#c0392b', 5000);
  }
}

function abrirWA(tel) {
  if (!tel) return;
  const num = tel.replace(/\D/g, '');
  window.open(`https://wa.me/${num}`, '_blank');
}
