// ── Pagos ─────────────────────────────────────────────────────
let _pgSearch = '';
let _pgSort   = { col: 'fecha', dir: -1 };

function renderPagos() {
  const q = _pgSearch.toLowerCase().trim();
  let list = q
    ? registros.filter(r => `${r.nombre} ${r.apellido}`.toLowerCase().includes(q) || (r.servicio||'').toLowerCase().includes(q))
    : [...registros];

  list.sort((a, b) => {
    const va = a[_pgSort.col] || '';
    const vb = b[_pgSort.col] || '';
    return _pgSort.dir * (va < vb ? -1 : va > vb ? 1 : 0);
  });

  const tbody = document.getElementById('pagosBody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-light)">Sin registros</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td>${fmtDate(r.fecha)}</td>
      <td><strong>${escHtml(r.nombre)}</strong> ${escHtml(r.apellido || '')}</td>
      <td>${escHtml(r.servicio || '—')}</td>
      <td>${escHtml(r.atendio || '—')}</td>
      <td><strong>S/ ${(r.total||0).toFixed(2)}</strong></td>
      <td>${r.adelanto ? 'S/ ' + r.adelanto.toFixed(2) : '—'}</td>
      <td>${r.notas ? `<span title="${escHtml(r.notas)}" style="cursor:help">📝</span>` : '—'}</td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="editarPago('${escHtml(r.id)}')">✏</button>
        ${currentRole === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="eliminarPago('${escHtml(r.id)}')">🗑</button>` : ''}
      </td>
    </tr>
  `).join('');

  // Summary
  const total   = list.reduce((a, r) => a + (r.total   || 0), 0);
  const adelanto = list.reduce((a, r) => a + (r.adelanto || 0), 0);
  document.getElementById('pgTotal').textContent    = 'S/ ' + total.toFixed(2);
  document.getElementById('pgAdelanto').textContent = 'S/ ' + adelanto.toFixed(2);
  document.getElementById('pgCount').textContent    = list.length + ' registros';
}

// ── Eliminar pago ─────────────────────────────────────────────
async function eliminarPago(id) {
  if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
  try {
    const { error } = await supa.from('elle_payments').delete().eq('id', String(id));
    if (error) throw error;
    registros = registros.filter(x => String(x.id) !== String(id));
    try { localStorage.setItem('es2_registros', JSON.stringify(registros)); } catch(e) {}
    renderPagos();
    showToast('Registro eliminado', '#c46060');
  } catch(e) {
    console.error('[eliminarPago]', e);
    showToast('❌ No se pudo eliminar.', '#c0392b', 4000);
  }
}

// ── Nuevo pago ────────────────────────────────────────────────
async function guardarNuevoPago() {
  const fecha    = document.getElementById('nrFecha')?.value;
  const nombre   = (document.getElementById('nrNombre')?.value || '').trim();
  const apellido = (document.getElementById('nrApellido')?.value || '').trim();
  if (!fecha || !nombre) { showToast('Fecha y nombre son obligatorios', '#c0392b'); return; }

  const r = {
    id:       'reg_' + Date.now(),
    fecha,
    nombre,
    apellido,
    telefono: (document.getElementById('nrTelefono')?.value || '').trim(),
    servicio: document.getElementById('nrServicio')?.value || '',
    atendio:  (document.getElementById('nrAtendio')?.value || '').trim(),
    zonas:    (document.getElementById('nrZonas')?.value || '').trim(),
    total:    parseFloat(document.getElementById('nrTotal')?.value) || null,
    adelanto: parseFloat(document.getElementById('nrAdelanto')?.value) || null,
    comision: parseFloat(document.getElementById('nrComision')?.value) || null,
    notas:    (document.getElementById('nrNotas')?.value || '').trim(),
  };

  try {
    setSyncState('syncing');
    const { error } = await supa.from('elle_payments').insert([{ ...r, raw_json: r }]);
    if (error) throw error;
    registros.unshift(r);
    try { localStorage.setItem('es2_registros', JSON.stringify(registros)); } catch(e) {}
    setSyncState('idle');
    closeModal('nuevoPagoModal');
    renderPagos();
    showToast(`✅ Pago registrado: ${nombre} ${apellido}`);
    // limpiar form
    ['nrFecha','nrNombre','nrApellido','nrTelefono','nrZonas','nrTotal','nrAdelanto','nrComision','nrNotas']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch(e) {
    console.error('[guardarNuevoPago]', e);
    setSyncState('error');
    showToast('❌ No se pudo guardar el pago.', '#c0392b', 5000);
  }
}

// ── Editar pago (stub – abre modal pre-llenado) ───────────────
function editarPago(id) {
  const r = registros.find(x => String(x.id) === String(id));
  if (!r) return;
  // Pre-llenar form de nuevo pago (modo edición)
  document.getElementById('nrFecha').value    = r.fecha    || '';
  document.getElementById('nrNombre').value   = r.nombre   || '';
  document.getElementById('nrApellido').value = r.apellido || '';
  document.getElementById('nrTelefono').value = r.telefono || '';
  document.getElementById('nrServicio').value = r.servicio || '';
  document.getElementById('nrAtendio').value  = r.atendio  || '';
  document.getElementById('nrZonas').value    = r.zonas    || '';
  document.getElementById('nrTotal').value    = r.total    != null ? r.total    : '';
  document.getElementById('nrAdelanto').value = r.adelanto != null ? r.adelanto : '';
  document.getElementById('nrComision').value = r.comision != null ? r.comision : '';
  document.getElementById('nrNotas').value    = r.notas    || '';
  // Cambiar el botón guardar a actualizar
  const btn = document.getElementById('btnGuardarPago');
  if (btn) {
    btn.textContent = 'Actualizar';
    btn.onclick = () => actualizarPago(id);
  }
  openModal('nuevoPagoModal');
}

async function actualizarPago(id) {
  const fecha    = document.getElementById('nrFecha')?.value;
  const nombre   = (document.getElementById('nrNombre')?.value || '').trim();
  if (!fecha || !nombre) { showToast('Fecha y nombre son obligatorios', '#c0392b'); return; }

  const updates = {
    fecha, nombre,
    apellido: (document.getElementById('nrApellido')?.value || '').trim(),
    telefono: (document.getElementById('nrTelefono')?.value || '').trim(),
    servicio: document.getElementById('nrServicio')?.value || '',
    atendio:  (document.getElementById('nrAtendio')?.value || '').trim(),
    zonas:    (document.getElementById('nrZonas')?.value || '').trim(),
    total:    parseFloat(document.getElementById('nrTotal')?.value) || null,
    adelanto: parseFloat(document.getElementById('nrAdelanto')?.value) || null,
    comision: parseFloat(document.getElementById('nrComision')?.value) || null,
    notas:    (document.getElementById('nrNotas')?.value || '').trim(),
  };

  try {
    setSyncState('syncing');
    const { error } = await supa.from('elle_payments').update(updates).eq('id', String(id));
    if (error) throw error;
    const idx = registros.findIndex(x => String(x.id) === String(id));
    if (idx >= 0) registros[idx] = { ...registros[idx], ...updates };
    setSyncState('idle');
    closeModal('nuevoPagoModal');
    renderPagos();
    showToast('✅ Pago actualizado');
    // resetear botón
    const btn = document.getElementById('btnGuardarPago');
    if (btn) { btn.textContent = 'Guardar'; btn.onclick = guardarNuevoPago; }
  } catch(e) {
    console.error('[actualizarPago]', e);
    setSyncState('error');
    showToast('❌ No se pudo actualizar.', '#c0392b', 5000);
  }
}
