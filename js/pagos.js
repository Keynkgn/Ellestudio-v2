function getPago(p,sv){if(!sv.pago)sv.pago={precioTotal:0,separacion:0,abonos:[],notas:''};return sv.pago;}
function totalAbonado(pago){return(pago.separacion||0)+(pago.abonos||[]).reduce((a,b)=>a+(b.monto||0),0);}
function saldo(pago){return Math.max(0,(pago.precioTotal||0)-totalAbonado(pago));}
function estadoPago(pago){const total=pago.precioTotal||0;if(!total)return'pendiente';const ab=totalAbonado(pago);if(ab>=total)return'pagado';if(ab>0)return'parcial';return'pendiente';}

// ---- Filtros y sort ----
let _pgSort = {col:'fecha', dir:-1};

function pgLimpiarFiltros(){
  ['pgSearch','pgFechaDesde','pgFechaHasta','pgFilterMes','pgFilterAtendio','pgFilterSvc'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  renderPagos(); renderPgSummary();
}

function pgSort(col){
  if(_pgSort.col===col) _pgSort.dir*=-1; else {_pgSort.col=col; _pgSort.dir=-1;}
  ['fecha','nombre','servicio','atendio','total'].forEach(c=>{
    const el=document.getElementById('pgSort'+c.charAt(0).toUpperCase()+c.slice(1));
    if(el) el.textContent = _pgSort.col===c ? (_pgSort.dir===1?'↑':'↓') : '';
  });
  renderPagos();
}

function pgGetFiltered(){
  const q=(document.getElementById('pgSearch')?.value||'').toLowerCase();
  const desde=document.getElementById('pgFechaDesde')?.value||'';
  const hasta=document.getElementById('pgFechaHasta')?.value||'';
  const mes=document.getElementById('pgFilterMes')?.value||'';
  const atendio=(document.getElementById('pgFilterAtendio')?.value||'').toLowerCase();
  const svcF=(document.getElementById('pgFilterSvc')?.value||'').toLowerCase();

  return registros.filter(r=>{
    const nombre=`${r.nombre||''} ${r.apellido||''}`.toLowerCase();
    if(q && !nombre.includes(q)) return false;
    if(mes && !(r.fecha||'').startsWith(mes)) return false;
    if(desde && (r.fecha||'') < desde) return false;
    if(hasta && (r.fecha||'') > hasta) return false;
    if(atendio && !(r.atendio||'').toLowerCase().includes(atendio)) return false;
    if(svcF && !(r.servicio||'').toLowerCase().includes(svcF)) return false;
    return true;
  }).sort((a,b)=>{
    let va,vb;
    if(_pgSort.col==='fecha'){va=a.fecha||'';vb=b.fecha||'';}
    else if(_pgSort.col==='nombre'){va=`${a.nombre} ${a.apellido}`;vb=`${b.nombre} ${b.apellido}`;}
    else if(_pgSort.col==='servicio'){va=a.servicio||'';vb=b.servicio||'';}
    else if(_pgSort.col==='atendio'){va=a.atendio||'';vb=b.atendio||'';}
    else if(_pgSort.col==='total'){return(_pgSort.dir)*((b.total||0)-(a.total||0));}
    else{va='';vb='';}
    return _pgSort.dir*(va<vb?-1:va>vb?1:0);
  });
}

function renderPgSummary(){
  const el=document.getElementById('pgSummary'); if(!el) return;
  const rows=pgGetFiltered();
  const totalFact=rows.reduce((s,r)=>s+(r.total||0),0);
  const totalAdel=rows.reduce((s,r)=>s+(r.adelanto||0),0);
  const totalCom=rows.reduce((s,r)=>s+(r.comision||0),0);
  const totalSaldo=rows.reduce((s,r)=>s+Math.max(0,(r.total||0)-(r.adelanto||0)),0);
  el.innerHTML=`
    <div class="finance-card total"><div class="finance-num" style="color:var(--rose-dark);">S/${totalFact.toFixed(0)}</div><div class="finance-lbl">Total Facturado</div></div>
    <div class="finance-card ingresos"><div class="finance-num" style="color:#2e7d32;">S/${totalAdel.toFixed(0)}</div><div class="finance-lbl">Total Adelantos</div></div>
    <div class="finance-card pendiente"><div class="finance-num" style="color:var(--red);">S/${totalSaldo.toFixed(0)}</div><div class="finance-lbl">Por cobrar</div></div>
    <div class="finance-card separaciones"><div class="finance-num" style="color:var(--gold);">S/${totalCom.toFixed(0)}</div><div class="finance-lbl">Comisiones</div></div>`;
}

function renderPagos(){
  const tb=document.getElementById('pgBody'); if(!tb) return;
  const foot=document.getElementById('pgFoot');

  // Populate filter dropdowns
  const allAtendio=[...new Set(registros.map(r=>r.atendio).filter(Boolean))].sort();
  const pgAt=document.getElementById('pgFilterAtendio');
  if(pgAt){const cur=pgAt.value; pgAt.innerHTML='<option value="">Quien atendió</option>'+allAtendio.map(a=>`<option value="${a}">${a}</option>`).join(''); pgAt.value=cur;}

  const allSvc=[...new Set(registros.map(r=>r.servicio).filter(Boolean))].sort();
  const pgSv=document.getElementById('pgFilterSvc');
  if(pgSv){const cur=pgSv.value; pgSv.innerHTML='<option value="">Todos los servicios</option>'+allSvc.map(s=>`<option value="${s}">${s}</option>`).join(''); pgSv.value=cur;}

  const allMes=[...new Set(registros.map(r=>(r.fecha||'').substring(0,7)).filter(Boolean))].sort().reverse();
  const pgMes=document.getElementById('pgFilterMes');
  if(pgMes){const cur=pgMes.value; pgMes.innerHTML='<option value="">Todos los meses</option>'+allMes.map(m=>`<option value="${m}">${m}</option>`).join(''); pgMes.value=cur;}

  const rows=pgGetFiltered();
  renderPgSummary();

  if(!rows.length){
    tb.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-light);">Sin registros. Usa <strong>+ Nuevo Registro</strong> para agregar.</td></tr>`;
    if(foot) foot.innerHTML='';
    return;
  }

  tb.innerHTML=rows.map(r=>{
    const saldoR=Math.max(0,(r.total||0)-(r.adelanto||0));
    const saldoColor=saldoR>0?'var(--red)':'var(--green)';
    return`<tr>
      <td style="white-space:nowrap;font-size:0.82rem;">${fmtDate(r.fecha)}</td>
      <td style="font-weight:600;white-space:nowrap;">${r.nombre||''} ${r.apellido||''}</td>
      <td style="font-size:0.82rem;">${r.servicio||'—'}</td>
      <td style="font-size:0.8rem;color:var(--text-light);max-width:200px;">${r.zonas||r.notas||'—'}</td>
      <td style="font-size:0.82rem;">${r.atendio||'—'}</td>
      <td style="font-weight:700;color:var(--rose-dark);">${r.total!=null&&r.total!==''?'S/'+Number(r.total).toFixed(2):'—'}</td>
      <td style="color:var(--gold);font-weight:600;">${r.adelanto!=null&&r.adelanto!==''?'S/'+Number(r.adelanto).toFixed(2):'—'}</td>
      <td style="font-size:0.82rem;color:#7a6a4f;">${r.comision!=null&&r.comision!==''?'S/'+Number(r.comision).toFixed(2):'—'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary" style="font-size:0.72rem;padding:4px 9px;" onclick="openEditRegistro('${r.id}')">✏️</button>
        <button class="btn btn-danger" style="font-size:0.72rem;padding:4px 9px;margin-left:4px;" onclick="deleteRegistro('${r.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </td>
    </tr>`;
  }).join('');

  // Footer totals
  const totFact=rows.reduce((s,r)=>s+(r.total||0),0);
  const totAdel=rows.reduce((s,r)=>s+(r.adelanto||0),0);
  const totCom=rows.reduce((s,r)=>s+(r.comision||0),0);
  if(foot) foot.innerHTML=`<tr style="background:var(--cream);font-weight:700;font-size:0.85rem;">
    <td colspan="5" style="padding:10px 12px;">TOTALES (${rows.length} registros)</td>
    <td style="color:var(--rose-dark);">S/${totFact.toFixed(2)}</td>
    <td style="color:var(--gold);">S/${totAdel.toFixed(2)}</td>
    <td style="color:#7a6a4f;">S/${totCom.toFixed(2)}</td>
    <td></td>
  </tr>`;
}

// ---- Nuevo Registro ----
function openNuevoRegistro(){
  // Reset titulo
  const h2=document.querySelector('#nuevoRegistroModal .modal-header h2');
  if(h2) h2.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Registro';
  document.getElementById('nrBuscar').value='';
  document.getElementById('nrResultados').style.display='none';
  document.getElementById('nrNombre').value='';
  document.getElementById('nrApellido').value='';
  const nrTelEl=document.getElementById('nrTel'); if(nrTelEl) nrTelEl.value='';
  document.getElementById('nrFecha').value=new Date().toISOString().split('T')[0];
  document.getElementById('nrAtendio').value='';
  document.getElementById('nrZonas').value='';
  document.getElementById('nrTotal').value='';
  document.getElementById('nrAdelanto').value='';
  document.getElementById('nrComision').value='';
  document.getElementById('nrNotas').value='';
  document.getElementById('nrSaldo').textContent='S/0.00';
  const sel=document.getElementById('nrServicio');
  sel.innerHTML='<option value="">-- Selecciona --</option>'+SERVICES().map(s=>`<option value="${s}">${s}</option>`).join('');
  openModal('nuevoRegistroModal');
}

function nrBuscarPaciente(){
  const q=(document.getElementById('nrBuscar').value||'').toLowerCase().trim();
  const res=document.getElementById('nrResultados');
  if(!q){res.style.display='none';return;}
  const found=patients.filter(p=>`${p.nombre} ${p.apellido}`.toLowerCase().includes(q)).slice(0,7);
  if(!found.length){
    res.innerHTML='<div style="padding:12px 14px;color:var(--text-light);font-size:0.85rem;">Sin resultados</div>';
    res.style.display='block';return;
  }
  res.innerHTML=found.map((p,idx)=>`<div 
    data-pid="${p.id}"
    style="padding:13px 16px;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.86rem;min-height:48px;display:flex;align-items:center;-webkit-tap-highlight-color:rgba(0,0,0,0.05);${idx===0?'border-radius:8px 8px 0 0;':''}${idx===found.length-1?'border-radius:0 0 8px 8px;border-bottom:none;':''}"
    onmouseover="this.style.background='#f5f0eb'" onmouseout="this.style.background=''">
    <strong>${p.nombre} ${p.apellido}</strong>&nbsp;<span style="color:#999;font-size:0.82rem;">${p.telefono?'· '+p.telefono:''}</span>
  </div>`).join('');
  res.style.display='block';
  // Attach events AFTER rendering — one clean listener per item
  res.querySelectorAll('[data-pid]').forEach(el=>{
    const pid = el.getAttribute('data-pid');
    el.addEventListener('pointerdown', function(e){
      e.preventDefault();
      nrSeleccionarPaciente(pid);
    }, {once:true});
  });
}

function nrSeleccionarPaciente(pid){
  const p=patients.find(x=>String(x.id)===String(pid)); if(!p) return;
  document.getElementById('nrNombre').value=p.nombre||'';
  document.getElementById('nrApellido').value=p.apellido||'';
  const nrTelEl=document.getElementById('nrTel'); if(nrTelEl) nrTelEl.value=p.telefono||'';
  document.getElementById('nrResultados').style.display='none';
  document.getElementById('nrBuscar').value=`${p.nombre} ${p.apellido}`;
  // Auto-fill last service
  const svcs=p.servicios||[];
  if(svcs.length){
    const last=svcs[svcs.length-1];
    const sel=document.getElementById('nrServicio');
    for(let i=0;i<sel.options.length;i++) if(sel.options[i].value===last.servicio){sel.selectedIndex=i;break;}
  }
}

function nrCalcSaldo(){
  const total=parseFloat(document.getElementById('nrTotal').value)||0;
  const adel=parseFloat(document.getElementById('nrAdelanto').value)||0;
  const saldoV=Math.max(0,total-adel);
  const el=document.getElementById('nrSaldo');
  el.textContent=`S/${saldoV.toFixed(2)}`;
  el.style.color=saldoV>0?'var(--red)':'var(--green)';
}

async function saveNuevoRegistro(){
  const nombre=document.getElementById('nrNombre').value.trim();
  const apellido=document.getElementById('nrApellido').value.trim();
  const fecha=document.getElementById('nrFecha').value;
  if(!nombre||!apellido){alert('Nombre y apellido son obligatorios.');return;}
  if(!fecha){alert('Selecciona una fecha.');return;}
  const r={
    id:'reg_'+Date.now(),
    fecha, nombre, apellido,
    telefono:(document.getElementById('nrTel')?.value||'').trim(),
    servicio:document.getElementById('nrServicio').value,
    atendio:document.getElementById('nrAtendio').value.trim(),
    zonas:document.getElementById('nrZonas').value.trim(),
    total:parseFloat(document.getElementById('nrTotal').value)||null,
    adelanto:parseFloat(document.getElementById('nrAdelanto').value)||null,
    comision:parseFloat(document.getElementById('nrComision').value)||null,
    notas:document.getElementById('nrNotas').value.trim(),
  };
  try{
    setSyncState('syncing');
    const { error } = await supa.from('elle_payments').insert([{...r, raw_json:r}]);
    if(error) throw error;
    registros.unshift(r);
    try{ localStorage.setItem('ce_v3_registros',JSON.stringify(registros)); }catch(e){}
    setSyncState('idle');
    _logSave('Pago registrado', r.nombre+' '+r.apellido+' · S/'+(r.total||0)+' · '+r.servicio);
    closeModal('nuevoRegistroModal');
    renderPagos();
    showToast(`✅ Registro guardado: ${nombre} ${apellido}`,'#6a9e7a');
  }catch(e){
    console.error('saveNuevoRegistro:',e);
    setSyncState('error');
    showToast('❌ No se pudo guardar el pago. Revisa tu conexión.','#c0392b',5000);
  }
}

function openPagoDesdeDetalle(){
  getDetailPid();
  // Prellenar con datos de la paciente actual
  const p = patients.find(x => String(x.id) === String(currentPid));
  // Reset campos (con null guards para compatibilidad mobile)
  const _ge=id=>document.getElementById(id);
  if(_ge('nrBuscar')) _ge('nrBuscar').value = '';
  if(_ge('nrResultados')) _ge('nrResultados').style.display = 'none';
  if(_ge('nrFecha')) _ge('nrFecha').value = new Date().toISOString().split('T')[0];
  if(_ge('nrAtendio')) _ge('nrAtendio').value = '';
  if(_ge('nrZonas')) _ge('nrZonas').value = '';
  if(_ge('nrTotal')) _ge('nrTotal').value = '';
  if(_ge('nrAdelanto')) _ge('nrAdelanto').value = '';
  if(_ge('nrComision')) _ge('nrComision').value = '';
  if(_ge('nrNotas')) _ge('nrNotas').value = '';
  if(_ge('nrSaldo')){ _ge('nrSaldo').textContent = 'S/0.00'; _ge('nrSaldo').style.color = 'var(--red)'; }
  // Poblar select servicios
  const sel = document.getElementById('nrServicio');
  sel.innerHTML = '<option value="">-- Selecciona --</option>' + SERVICES().map(s => `<option value="${s}">${s}</option>`).join('');
  if(p){
    document.getElementById('nrNombre').value = p.nombre || '';
    document.getElementById('nrApellido').value = p.apellido || '';
    const nrTelEl = document.getElementById('nrTel'); if(nrTelEl) nrTelEl.value = p.telefono || '';
    document.getElementById('nrBuscar').value = `${p.nombre||''} ${p.apellido||''}`.trim();
    // Auto-seleccionar ultimo servicio
    const svcs = p.servicios || [];
    if(svcs.length){
      const last = svcs[svcs.length-1];
      for(let i=0;i<sel.options.length;i++) if(sel.options[i].value===last.servicio){sel.selectedIndex=i;break;}
      // Si hay pago en el servicio, prefill separacion
      if(last.pago && last.pago.separacion > 0){
        document.getElementById('nrAdelanto').value = last.pago.separacion.toFixed(2);
        nrCalcSaldo();
      }
    }
  } else {
    document.getElementById('nrNombre').value = '';
    document.getElementById('nrApellido').value = '';
  }
  // Cambiar titulo del modal temporalmente
  const h2 = document.querySelector('#nuevoRegistroModal .modal-header h2');
  if(h2) h2.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2m-4-7h8M8 13h8"/></svg> Registrar Pago del Día';
  openModal('nuevoRegistroModal');
}

// ---- Editar Registro ----
let _erId=null;
function openEditRegistro(id){
  const r=registros.find(x=>String(x.id)===String(id)); if(!r) return;
  _erId=id;
  document.getElementById('erFecha').value=r.fecha||'';
  document.getElementById('erNombre').value=`${r.nombre||''} ${r.apellido||''}`.trim();
  document.getElementById('erAtendio').value=r.atendio||'';
  document.getElementById('erZonas').value=r.zonas||(r.notas||'')||'';
  document.getElementById('erTotal').value=r.total!=null?r.total:'';
  document.getElementById('erAdelanto').value=r.adelanto!=null?r.adelanto:'';
  document.getElementById('erComision').value=r.comision!=null?r.comision:'';
  document.getElementById('erNotas').value=r.notas||'';
  const sel=document.getElementById('erServicio');
  sel.innerHTML='<option value="">-- Selecciona --</option>'+SERVICES().map(s=>`<option value="${s}"${s===r.servicio?' selected':''}>${s}</option>`).join('');
  erCalcSaldo();
  openModal('editRegistroModal');
}

function erCalcSaldo(){
  const total=parseFloat(document.getElementById('erTotal').value)||0;
  const adel=parseFloat(document.getElementById('erAdelanto').value)||0;
  const saldoV=Math.max(0,total-adel);
  const el=document.getElementById('erSaldo');
  el.textContent=`S/${saldoV.toFixed(2)}`;
  el.style.color=saldoV>0?'var(--red)':'var(--green)';
}

async function saveEditRegistro(){
  const r=registros.find(x=>String(x.id)===String(_erId)); if(!r) return;
  r.fecha=document.getElementById('erFecha').value;
  // Split nombre into nombre + apellido for backward compat
  const fullName=document.getElementById('erNombre').value.trim();
  const parts=fullName.split(' ');
  r.nombre=parts[0]||'';
  r.apellido=parts.slice(1).join(' ')||'';
  r.servicio=document.getElementById('erServicio').value;
  r.atendio=document.getElementById('erAtendio').value.trim();
  r.zonas=document.getElementById('erZonas').value.trim();
  r.total=parseFloat(document.getElementById('erTotal').value)||null;
  r.adelanto=parseFloat(document.getElementById('erAdelanto').value)||null;
  r.comision=parseFloat(document.getElementById('erComision').value)||null;
  r.notas=document.getElementById('erNotas').value.trim();
  try{
    setSyncState('syncing');
    const { error } = await supa.from('elle_payments').update({
      fecha:r.fecha, nombre:r.nombre, apellido:r.apellido,
      servicio:r.servicio, atendio:r.atendio, zonas:r.zonas,
      total:r.total, adelanto:r.adelanto, comision:r.comision, notas:r.notas,
      raw_json:r
    }).eq('id',String(r.id));
    if(error) throw error;
    try{ localStorage.setItem('ce_v3_registros',JSON.stringify(registros)); }catch(e){}
    setSyncState('idle');
    closeModal('editRegistroModal');
    renderPagos();
    showToast('✅ Registro actualizado','#6a9e7a');
  }catch(e){
    console.error('saveEditRegistro:',e);
    setSyncState('error');
    showToast('❌ No se pudo actualizar el registro.','#c0392b',5000);
  }
}

function deleteRegistroActual(){
  if(!_erId)return;
  deleteRegistro(_erId);
  closeModal('editRegistroModal');
}

async function deleteRegistro(id){
  if(!confirm('⚠️ ¿Estás segura de eliminar este registro?\n\nNo se puede deshacer.')) return;
  try{
    const { error } = await supa.from('elle_payments').delete().eq('id',String(id));
    if(error) throw error;
    registros=registros.filter(x=>String(x.id)!==String(id));
    try{ localStorage.setItem('ce_v3_registros',JSON.stringify(registros)); }catch(e){}
    renderPagos();
    showToast('Registro eliminado','#c46060');
  }catch(e){
    console.error('deleteRegistro:',e);
    showToast('❌ No se pudo eliminar el registro.','#c0392b',4000);
  }
}

// Stubs legacy para no romper código viejo que llama openAbonoModal / verAbonos
function openAbonoModal(){}
function saveAbono(){}
function verAbonos(){}
function deleteAbono(){}
function updatePrecioTotal(){}
function updatePagoNotas(){}
