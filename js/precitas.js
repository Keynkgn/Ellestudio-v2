function savePC(){
  // Cache local — writes individuales van directo a elle_precitas
  try{ localStorage.setItem('ce_v3_precitas',JSON.stringify(preCitas)); }catch(e){}
}

function populatePcServiceSelect(selId){
  const sel=document.getElementById(selId);if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">Seleccionar...</option>'+SERVICES().map(s=>`<option value="${s}">${s}</option>`).join('');
  if(cur)sel.value=cur;
}

function cubiculoParaServicio(svc){
  if(svc==='Depilación Láser')return'01';
  return'02';
}
function updatePcCubiculo(){
  const svc=document.getElementById('pcServicio')?.value||'';
  const cub=document.getElementById('pcCubiculo');
  if(cub)cub.value=cubiculoParaServicio(svc);
  updatePcWaPreview();
}

function buildPcWaMsg(){
  const nombre=document.getElementById('pcNombre')?.value||'[Nombre]';
  const apellido=document.getElementById('pcApellido')?.value||'';
  const svc=document.getElementById('pcServicio')?.value||'[Servicio]';
  const cub=(document.getElementById('pcCubiculo')||document.getElementById('epcCubiculo'))?.value||'02';
  const link=getLinkForCubiculo(cub);
  const sep=parseFloat(document.getElementById('pcSeparacion')?.value||0);
  const sepTxt=sep>0?`\n\n\uD83D\uDCB3 *Separaci\u00f3n registrada:* S/ ${sep.toFixed(2)}`:'';
  return`Hola ${nombre} ${apellido}! \u2728\n\nGracias por contactarte con *Elle Studio*. Hemos registrado tu separacion para *${svc}*.\n\nConfirma tu cita eligiendo d\u00eda y horario:\n${link}${sepTxt}\n\nAv. Paz Soldan 235, San Isidro, Lima, Peru\nhttps://maps.google.com/?q=Av+Paz+Soldan+235+San+Isidro+Lima+Peru\n\n\u00a1Te esperamos! \uD83C\uDF38`
}
function updatePcWaPreview(){
  const el=document.getElementById('pcWaPreview');
  if(el)el.textContent=buildPcWaMsg();
}
function sendPcWa(){
  const tel=(document.getElementById('pcTel')?.value||'').replace(/\D/g,'');
  if(!tel){alert('Ingresa el teléfono primero.');return;}
  sendWaClipboard(tel, buildPcWaMsg());
}
function copyPcWa(){navigator.clipboard.writeText(buildPcWaMsg()).then(()=>showToast('Copiado','var(--sage-dark)'));}

function openNewPreCita(){
  populatePcServiceSelect('pcServicio');
  ['pcNombre','pcApellido','pcTel','pcNotas','pcHora'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('pcFechaTentativa').value=new Date().toISOString().split('T')[0];
  document.getElementById('pcSeparacion').value='';
  document.getElementById('pcEstado').value='pendiente';
  document.getElementById('pcCubiculo').value='02';
  const alertEl=document.getElementById('pcConflictAlert');if(alertEl)alertEl.style.display='none';
  updatePcWaPreview();
  openModal('newPreCitaModal');
}
// === DETECCIÓN DE CONFLICTOS DE CUBÍCULO ===
function _findCubicleConflict(fecha,hora,cubiculo,excludeId){
  if(!fecha||!hora)return null;
  return preCitas.find(pc=>
    String(pc.id)!==String(excludeId) &&
    pc.estado!=='cancelada' &&
    pc.fechaTentativa===fecha &&
    pc.hora===hora &&
    pc.cubiculo===cubiculo
  )||null;
}
function _findFreeCubicle(fecha,hora,preferido){
  const cubs=['01','02','03'];
  const opciones=[preferido,...cubs.filter(c=>c!==preferido)];
  for(const c of opciones){
    if(!_findCubicleConflict(fecha,hora,c,null)) return c;
  }
  return null;
}
function _showConflictAlert(alertElId,fecha,hora,cubiculo,excludeId,cubSelectId){
  const alertEl=document.getElementById(alertElId);
  if(!alertEl)return;
  if(!fecha||!hora){alertEl.style.display='none';return;}
  const conflict=_findCubicleConflict(fecha,hora,cubiculo,excludeId);
  if(!conflict){
    alertEl.style.display='block';
    alertEl.style.background='#e6f4ea';
    alertEl.style.border='1px solid #2e7d32';
    alertEl.style.color='#2e7d32';
    alertEl.innerHTML='✅ Cubículo '+cubiculo+' disponible a las '+hora;
    return;
  }
  const free=_findFreeCubicle(fecha,hora,cubiculo);
  const otrosCubs=['01','02','03'].filter(c=>c!==cubiculo&&!_findCubicleConflict(fecha,hora,c,excludeId));
  alertEl.style.display='block';
  alertEl.style.background='#fff3e0';
  alertEl.style.border='1px solid #c47a00';
  alertEl.style.color='#c47a00';
  let html='⚠️ Cub. '+cubiculo+' ocupado a las '+hora+' con <strong>'+conflict.nombre+' '+conflict.apellido+'</strong>.';
  if(otrosCubs.length){
    html+='<div style="margin-top:6px;">Disponibles: ';
    otrosCubs.forEach(c=>{
      html+='<button type="button" onclick="document.getElementById(\''+cubSelectId+'\').value=\''+c+'\';document.getElementById(\''+cubSelectId+'\').dispatchEvent(new Event(\'change\'))" style="margin-right:6px;padding:3px 10px;border-radius:14px;border:1px solid #c47a00;background:white;color:#c47a00;cursor:pointer;font-size:0.78rem;font-weight:600;">Cub '+c+'</button>';
    });
    html+='</div>';
  } else {
    html+='<div style="margin-top:6px;color:var(--red);font-weight:600;">Todos los cubículos ocupados a esa hora.</div>';
  }
  alertEl.innerHTML=html;
}
function checkPcConflict(){
  const fecha=document.getElementById('pcFechaTentativa').value;
  const hora=document.getElementById('pcHora').value;
  const cub=document.getElementById('pcCubiculo').value;
  _showConflictAlert('pcConflictAlert',fecha,hora,cub,null,'pcCubiculo');
}
function checkEpcConflict(){
  const fecha=document.getElementById('epcFechaTentativa').value;
  const hora=document.getElementById('epcHora').value;
  const cub=document.getElementById('epcCubiculo').value;
  _showConflictAlert('epcConflictAlert',fecha,hora,cub,_editPcId,'epcCubiculo');
}

async function savePreCita(){
  const nombre=document.getElementById('pcNombre').value.trim();
  const apellido=document.getElementById('pcApellido').value.trim();
  const telefono=document.getElementById('pcTel').value.trim();
  const servicio=document.getElementById('pcServicio').value;
  if(!nombre||!apellido){alert('Completa nombre y apellido.');return;}
  if(!servicio){alert('Selecciona un servicio.');return;}
  const fechaTentativa=document.getElementById('pcFechaTentativa').value;
  const hora=document.getElementById('pcHora').value||'';
  const cubiculo=document.getElementById('pcCubiculo').value;
  // Validar conflicto si hay fecha+hora
  if(fechaTentativa&&hora){
    const conflict=_findCubicleConflict(fechaTentativa,hora,cubiculo,null);
    if(conflict){
      if(!confirm(`⚠️ Cub. ${cubiculo} ocupado a las ${hora} con ${conflict.nombre} ${conflict.apellido}.\n\n¿Guardar de todos modos?`))return;
    }
  }
  const pc={
    id:Date.now(),nombre,apellido,telefono,servicio,
    cubiculo,
    separacion:parseFloat(document.getElementById('pcSeparacion').value||0),
    estado:document.getElementById('pcEstado').value,
    fechaTentativa,hora,
    notas:document.getElementById('pcNotas').value.trim(),
    fechaCreacion:new Date().toISOString().split('T')[0]
  };
  try{
    setSyncState('syncing');
    const { error } = await supa.from('elle_precitas').insert([_pcToDb(pc)]);
    if(error) throw error;
    preCitas.unshift(pc);
    try{ localStorage.setItem('ce_v3_precitas',JSON.stringify(preCitas)); }catch(e){}
    setSyncState('idle');
    closeModal('newPreCitaModal');renderPreCitas();renderPcStats();renderAgendaHoy();if(document.getElementById('mesInternoGrid'))renderMesInterno();
    showToast('✅ Pre-cita guardada','#6a9e7a');
  }catch(e){
    console.error('savePreCita:',e);
    setSyncState('error');
    showToast('❌ No se pudo guardar la pre-cita.','#c0392b',5000);
  }
}

let _editPcId=null;
function openEditPreCita(id){
  const pc=preCitas.find(x=>String(x.id)===String(id));if(!pc)return;
  _editPcId=id;
  populatePcServiceSelect('epcServicio');
  document.getElementById('epcNombre').value=pc.nombre||'';
  document.getElementById('epcApellido').value=pc.apellido||'';
  document.getElementById('epcTel').value=pc.telefono||'';
  document.getElementById('epcFechaTentativa').value=pc.fechaTentativa||'';
  document.getElementById('epcHora').value=pc.hora||'';
  document.getElementById('epcServicio').value=pc.servicio||'';
  document.getElementById('epcCubiculo').value=pc.cubiculo||'02';
  document.getElementById('epcSeparacion').value=pc.separacion||'';
  document.getElementById('epcEstado').value=pc.estado||'pendiente';
  document.getElementById('epcNotas').value=pc.notas||'';
  openModal('editPreCitaModal');
}
async function saveEditPreCita(){
  const pc=preCitas.find(x=>String(x.id)===String(_editPcId));if(!pc)return;
  const fechaTentativa=document.getElementById('epcFechaTentativa').value;
  const hora=document.getElementById('epcHora').value||'';
  const cubiculo=document.getElementById('epcCubiculo').value;
  // Validar conflicto (excluyendo la pre-cita actual)
  if(fechaTentativa&&hora){
    const conflict=_findCubicleConflict(fechaTentativa,hora,cubiculo,pc.id);
    if(conflict){
      if(!confirm(`⚠️ Cub. ${cubiculo} ocupado a las ${hora} con ${conflict.nombre} ${conflict.apellido}.\n\n¿Guardar de todos modos?`))return;
    }
  }
  pc.nombre=document.getElementById('epcNombre').value.trim();
  pc.apellido=document.getElementById('epcApellido').value.trim();
  pc.telefono=document.getElementById('epcTel').value.trim();
  pc.fechaTentativa=fechaTentativa;
  pc.hora=hora;
  pc.servicio=document.getElementById('epcServicio').value;
  pc.cubiculo=cubiculo;
  pc.separacion=parseFloat(document.getElementById('epcSeparacion').value||0);
  pc.estado=document.getElementById('epcEstado').value;
  pc.notas=document.getElementById('epcNotas').value.trim();
  try{
    setSyncState('syncing');
    const { error } = await supa.from('elle_precitas').upsert([_pcToDb(pc)]);
    if(error) throw error;
    try{ localStorage.setItem('ce_v3_precitas',JSON.stringify(preCitas)); }catch(e){}
    setSyncState('idle');
    closeModal('editPreCitaModal');renderPreCitas();renderPcStats();renderAgendaHoy();if(document.getElementById('mesInternoGrid'))renderMesInterno();
    showToast('✅ Pre-cita actualizada','#6a9e7a');
  }catch(e){
    console.error('saveEditPreCita:',e);
    setSyncState('error');
    showToast('❌ No se pudo actualizar la pre-cita.','#c0392b',5000);
  }
}
async function deletePreCita(){
  if(_workerGuard('eliminar pre-citas','eliminarPreCitas')) return;
  const pc=preCitas.find(x=>String(x.id)===String(_editPcId));if(!pc)return;
  if(!confirm(`¿Eliminar pre-cita de ${pc.nombre} ${pc.apellido}?`))return;
  try{
    const { error } = await supa.from('elle_precitas').delete().eq('id',String(_editPcId));
    if(error) throw error;
    preCitas=preCitas.filter(x=>x.id!==_editPcId);
    try{ localStorage.setItem('ce_v3_precitas',JSON.stringify(preCitas)); }catch(e){}
    closeModal('editPreCitaModal');renderPreCitas();renderPcStats();
    showToast('🗑 Pre-cita eliminada','#c46060');
  }catch(e){
    console.error('deletePreCita:',e);
    showToast('❌ No se pudo eliminar la pre-cita.','#c0392b',4000);
  }
}
async function convertirAPaciente(){
  const pc=preCitas.find(x=>String(x.id)===String(_editPcId));if(!pc)return;
  if(pc.convertidoAId){showToast('⚠️ Esta pre-cita ya fue convertida a paciente.','#c47a00',4000);return;}
  if(!confirm(`¿Convertir a ${pc.nombre} ${pc.apellido} en paciente activa? Se creará su ficha y podrás agregar sus sesiones.`))return;
  const p={
    id:Date.now(),nombre:pc.nombre,apellido:pc.apellido,
    telefono:pc.telefono,fechaInicio:pc.fechaTentativa||new Date().toISOString().split('T')[0],
    comentarios:`Convertida desde Pre-cita. ${pc.notas||''}`.trim(),
    fotos:[],servicios:[]
  };
  patients.unshift(p);save();
  // Mark pre-cita as confirmed y sincronizar
  pc.estado='confirmada';pc.convertidoAId=p.id;savePC();
  try{ await supa.from('elle_precitas').upsert([_pcToDb(pc)]); }catch(e){ console.error('convertirAPaciente sync:',e); }
  closeModal('editPreCitaModal');
  // Open detail to add service
  currentPid=String(p.id);
  renderPatients();renderStats();renderAll();
  showSectionById('pacientes');
  setTimeout(()=>{openDetail(p.id);setTimeout(()=>openAddSvcModal(),600);},300);
  showToast(`✅ ${pc.nombre} convertida a paciente`,'#6a9e7a');
}
let _pcTplTab='confirmacion';
function openPcTemplateModal(){
  _pcTplTab='confirmacion';
  switchPcTab('confirmacion');
  document.getElementById('pcTemplateModal').style.display='flex';
}
function closePcTemplateModal(){document.getElementById('pcTemplateModal').style.display='none';}
function switchPcTab(tab){
  // Guardar texto del tab actual antes de cambiar
  if(_pcTplTab){
    const body=document.getElementById('pcTemplateBody').value.trim();
    if(body)preCitaTemplates[_pcTplTab]=body;
  }
  _pcTplTab=tab;
  document.getElementById('pcTemplateBody').value=preCitaTemplates[tab]||PC_TPL_DEFAULTS[tab]||'';
  ['confirmacion','dia_antes','mismo_dia'].forEach(t=>{
    const btn=document.getElementById('pcTab-'+t);
    if(btn){btn.className=t===tab?'btn btn-primary':'btn btn-secondary';btn.style.cssText='font-size:0.75rem;padding:6px 12px;';}
  });
}
function savePcTemplates(){
  const body=document.getElementById('pcTemplateBody').value.trim();
  if(!body){alert('El mensaje no puede estar vacío.');return;}
  preCitaTemplates[_pcTplTab]=body;
  localStorage.setItem('ellePcTemplates',JSON.stringify(preCitaTemplates));
  supaSavePcTemplates().catch(()=>showToast('⚠️ Guardado local pero no en la nube','#c46060'));
  closePcTemplateModal();
  showToast('✅ Plantillas guardadas','#6a8c5a');
}
function resetPcTemplate(){
  if(!confirm('¿Restaurar este mensaje al predeterminado?'))return;
  document.getElementById('pcTemplateBody').value=PC_TPL_DEFAULTS[_pcTplTab]||'';
}

function renderPcStats(){
  const el=document.getElementById('pcStats');if(!el)return;
  const total=preCitas.length;
  const pendientes=preCitas.filter(x=>x.estado==='pendiente').length;
  const confirmadas=preCitas.filter(x=>x.estado==='confirmada').length;
  const totalSep=preCitas.reduce((a,x)=>a+(x.separacion||0),0);
  el.innerHTML=`
    <div class="finance-card total"><div class="finance-num" style="color:var(--rose-dark);">${total}</div><div class="finance-lbl">Total Pre-citas</div></div>
    <div class="finance-card pendiente"><div class="finance-num" style="color:#c47a00;">${pendientes}</div><div class="finance-lbl">Pendientes</div></div>
    <div class="finance-card ingresos"><div class="finance-num" style="color:#2e7d32;">${confirmadas}</div><div class="finance-lbl">Confirmadas</div></div>
    <div class="finance-card separaciones"><div class="finance-num" style="color:var(--gold);">S/${totalSep.toFixed(0)}</div><div class="finance-lbl">Total Separaciones</div></div>`;
}

function pcQuickFilter(tipo){
  const desde=document.getElementById('pcFechaDesde');
  const hasta=document.getElementById('pcFechaHasta');
  const tipoFecha=document.getElementById('pcTipoFecha');
  const today=new Date();
  const todayStr=today.toISOString().split('T')[0];
  if(tipo==='hoy'||tipo==='ayer'||tipo==='semana'){
    // Filtrar por fecha de REGISTRO
    if(tipoFecha) tipoFecha.value='creacion';
    if(tipo==='hoy'){desde.value=todayStr;hasta.value=todayStr;}
    if(tipo==='ayer'){
      const ayer=new Date(today);ayer.setDate(today.getDate()-1);
      const ayerStr=ayer.toISOString().split('T')[0];
      desde.value=ayerStr;hasta.value=ayerStr;
    }
    if(tipo==='semana'){
      const lunes=new Date(today);lunes.setDate(today.getDate()-((today.getDay()+6)%7));
      desde.value=lunes.toISOString().split('T')[0];hasta.value=todayStr;
    }
  } else if(tipo==='citaHoy'||tipo==='citaSemana'){
    // Filtrar por fecha de CITA
    if(tipoFecha) tipoFecha.value='tentativa';
    if(tipo==='citaHoy'){desde.value=todayStr;hasta.value=todayStr;}
    if(tipo==='citaSemana'){
      const lunes=new Date(today);lunes.setDate(today.getDate()-((today.getDay()+6)%7));
      const domingo=new Date(lunes);domingo.setDate(lunes.getDate()+6);
      desde.value=lunes.toISOString().split('T')[0];hasta.value=domingo.toISOString().split('T')[0];
    }
  }
  // Marcar chip activo visualmente
  ['hoy','ayer','semana','citaHoy','citaSemana'].forEach(t=>{
    const el=document.getElementById('pcChip-'+t);
    if(!el)return;
    if(t===tipo){el.classList.remove('btn-secondary');el.classList.add('btn-primary');}
    else{el.classList.add('btn-secondary');el.classList.remove('btn-primary');}
  });
  renderPreCitas();
}
function pcLimpiarFiltros(){
  ['pcSearch','pcFechaDesde','pcFechaHasta','pcFilterMes','pcFilterEstado','pcFilterServicio'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  // Reset tipo de fecha y chips
  const tf=document.getElementById('pcTipoFecha'); if(tf) tf.value='tentativa';
  ['hoy','ayer','semana','citaHoy','citaSemana'].forEach(t=>{
    const el=document.getElementById('pcChip-'+t);
    if(el){el.classList.add('btn-secondary');el.classList.remove('btn-primary');}
  });
  renderPreCitas(); renderPcStats();
}

// Función segura para enviar WA desde tarjeta de pre-cita (funciona en móvil)
function sendWaPreCita(pcId,tipo){
  tipo=tipo||'confirmacion';
  const pc=preCitas.find(x=>String(x.id)===String(pcId));
  if(!pc){showToast('❌ Pre-cita no encontrada','#c46060');return;}
  const tel=(pc.telefono||'').replace(/\D/g,'');
  if(!tel){alert('Esta pre-cita no tiene teléfono registrado.');return;}
  const link=getLinkForCubiculo(pc.cubiculo);
  const tpl=preCitaTemplates[tipo]||PC_TPL_DEFAULTS[tipo]||PC_TPL_DEFAULTS.confirmacion;
  const msg=tpl.replace(/\[Nombre\]/g,`${pc.nombre} ${pc.apellido}`).replace(/\[Servicio\]/g,pc.servicio||'').replace(/\[Link\]/g,link||'');
  sendWaClipboard(tel, msg);
}
function togglePcWaMenu(pcId){
  const el=document.getElementById('pcWaMenu-'+pcId);
  if(!el)return;
  const isOpen=el.style.display==='block';
  document.querySelectorAll('[id^="pcWaMenu-"]').forEach(x=>x.style.display='none');
  if(!isOpen)el.style.display='block';
}
// Cerrar menus al click fuera
document.addEventListener('click',function(e){if(!e.target.closest('[id^="pcWaWrap-"]'))document.querySelectorAll('[id^="pcWaMenu-"]').forEach(x=>x.style.display='none');});

function renderPreCitas(){
  const el=document.getElementById('pcList');if(!el)return;
  const q=(document.getElementById('pcSearch')?.value||'').toLowerCase();
  const ef=document.getElementById('pcFilterEstado')?.value||'';
  const esvc=document.getElementById('pcFilterServicio')?.value||'';
  const desde=document.getElementById('pcFechaDesde')?.value||'';
  const hasta=document.getElementById('pcFechaHasta')?.value||'';
  const mes=document.getElementById('pcFilterMes')?.value||'';

  // Populate mes dropdown
  const mesEl=document.getElementById('pcFilterMes');
  if(mesEl && mesEl.options.length<=1){
    const meses=new Set(preCitas.map(pc=>(pc.fechaTentativa||'').slice(0,7)).filter(Boolean));
    const MNAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    [...meses].sort().reverse().forEach(m=>{
      const [y,mo]=m.split('-');
      const opt=document.createElement('option');
      opt.value=m; opt.textContent=`${MNAMES[parseInt(mo)-1]} ${y}`;
      mesEl.appendChild(opt);
    });
  }
  // Populate servicio dropdown
  const svcEl=document.getElementById('pcFilterServicio');
  if(svcEl && svcEl.options.length<=1){
    const svcs=new Set(preCitas.map(pc=>pc.servicio).filter(Boolean));
    svcs.forEach(s=>{const opt=document.createElement('option');opt.value=s;opt.textContent=s;svcEl.appendChild(opt);});
  }

  const tipoFecha=document.getElementById('pcTipoFecha')?.value||'tentativa';
  // Helper: obtiene la fecha según el tipo seleccionado
  const getFecha=(pc)=>tipoFecha==='creacion'?(pc.fechaCreacion||''):(pc.fechaTentativa||'');

  let list=[...preCitas];
  if(q)list=list.filter(pc=>`${pc.nombre} ${pc.apellido}`.toLowerCase().includes(q));
  if(ef)list=list.filter(pc=>pc.estado===ef);
  if(esvc)list=list.filter(pc=>pc.servicio===esvc);
  if(desde)list=list.filter(pc=>{const f=getFecha(pc);return f&&f>=desde;});
  if(hasta)list=list.filter(pc=>{const f=getFecha(pc);return f&&f<=hasta;});
  if(mes)list=list.filter(pc=>(pc.fechaTentativa||'').startsWith(mes));
  // Sort by fecha desc
  list.sort((a,b)=>(b.fechaTentativa||'')>(a.fechaTentativa||'')?1:-1);
  if(!list.length){el.innerHTML='<div class="empty-state"><span>📋</span>Sin pre-citas para los filtros seleccionados.</div>';return;}
  el.innerHTML=list.map(pc=>{
    const link=getLinkForCubiculo(pc.cubiculo);
    const tel=(pc.telefono||'').replace(/\D/g,'');
    return`<div class="precita-card ${pc.estado}">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:600;">${pc.nombre} ${pc.apellido}</span>
          <span class="estado-badge ${pc.estado}">${pc.estado==='pendiente'?'⏳ Pendiente':pc.estado==='confirmada'?'✅ Confirmada':'❌ Cancelada'}</span>
          ${pc.convertidoAId?'<span style="background:#e8f4ea;color:#2e7d32;padding:2px 8px;border-radius:12px;font-size:0.68rem;font-weight:700;display:inline-flex;align-items:center;gap:4px;"><svg width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 20c0-4 3.6-7 8-7s8 3 8 7\"/></svg> Convertida</span>':''}
        </div>
        <div style="font-size:0.8rem;color:var(--text-light);display:flex;gap:12px;flex-wrap:wrap;">
          <span>${pc.servicio}</span>
          <span>${cubLabel(pc.cubiculo)}</span>
          ${pc.fechaTentativa?`<span>📅 ${fmtDate(pc.fechaTentativa)}</span>`:''}
          ${pc.separacion>0?`<span style="color:var(--green);font-weight:600;">S/ ${pc.separacion.toFixed(2)} separación</span>`:''}
          ${pc.telefono?`<span>${pc.telefono}</span>`:''}
        </div>
        ${pc.notas?`<div style="font-size:0.77rem;color:var(--text-light);margin-top:4px;font-style:italic;">📝 ${pc.notas}</div>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        ${tel?`<div id="pcWaWrap-${pc.id}" style="position:relative;">
          <button class="btn btn-green" style="font-size:0.78rem;padding:6px 12px;min-height:44px;" onclick="event.stopPropagation();togglePcWaMenu('${pc.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WA ▾</button>
          <div id="pcWaMenu-${pc.id}" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:white;border:1px solid var(--border);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:99;min-width:180px;overflow:hidden;">
            <div style="padding:10px 14px;cursor:pointer;font-size:0.8rem;border-bottom:1px solid #f5f0eb;" onmouseover="this.style.background='#f8f5f0'" onmouseout="this.style.background=''" onclick="sendWaPreCita('${pc.id}','confirmacion')">✉️ Confirmación</div>
            <div style="padding:10px 14px;cursor:pointer;font-size:0.8rem;border-bottom:1px solid #f5f0eb;" onmouseover="this.style.background='#f8f5f0'" onmouseout="this.style.background=''" onclick="sendWaPreCita('${pc.id}','dia_antes')">⏰ Recordatorio 1 día antes</div>
            <div style="padding:10px 14px;cursor:pointer;font-size:0.8rem;" onmouseover="this.style.background='#f8f5f0'" onmouseout="this.style.background=''" onclick="sendWaPreCita('${pc.id}','mismo_dia')">💜 Recordatorio mismo día</div>
          </div>
        </div>`:""}
        <button class="btn btn-secondary" style="font-size:0.78rem;padding:6px 12px;min-height:44px;" onclick="openEditPreCita(${pc.id})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>
      </div>
    </div>`;
  }).join('');
}
