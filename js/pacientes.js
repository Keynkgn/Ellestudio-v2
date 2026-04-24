// ── Compress image — target under 150KB, MAX 600px ───────────────────────────
function _compressToBlob(file){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=async()=>{
        const MAX=600;
        let w=img.width, h=img.height;
        if(w>MAX||h>MAX){const r=Math.min(MAX/w,MAX/h);w=Math.round(w*r);h=Math.round(h*r);}
        const c=document.createElement('canvas');
        c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);

        // Primer intento: calidad 0.55
        let quality=0.55;
        let blob = await new Promise(r=>c.toBlob(r,'image/jpeg',quality));

        // Si sigue pesando más de 150KB, bajar calidad hasta que entre
        const TARGET_KB = 150;
        while(blob && blob.size > TARGET_KB*1024 && quality > 0.2){
          quality = Math.round((quality - 0.1)*10)/10;
          blob = await new Promise(r=>c.toBlob(r,'image/jpeg',quality));
        }

        // Si aún pesa mucho, reducir también dimensiones a la mitad
        if(blob && blob.size > TARGET_KB*1024){
          w=Math.round(w*0.7); h=Math.round(h*0.7);
          c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          blob = await new Promise(r=>c.toBlob(r,'image/jpeg',0.5));
        }

        const dataUrl = await new Promise(r=>{
          const fr=new FileReader(); fr.onload=e=>r(e.target.result); fr.readAsDataURL(blob);
        });
        resolve({blob, dataUrl});
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Upload to Supabase Storage ───────────────────────────────────────────────
async function _uploadPhotoToStorage(blob,pid,idx,retries=2){
  for(let attempt=0; attempt<=retries; attempt++){
    try{
      const path=`fotos/${pid}/${Date.now()}_${idx}_${attempt}.jpg`;
      const {error}=await supa.storage.from('patient-photos').upload(path,blob,{contentType:'image/jpeg',upsert:true});
      if(error) throw error;
      const {data:urlData}=supa.storage.from('patient-photos').getPublicUrl(path);
      if(urlData?.publicUrl) return urlData.publicUrl;
      throw new Error('URL no disponible');
    }catch(e){
      console.error('Intento '+(attempt+1)+' foto falló:',e);
      if(attempt<retries) await new Promise(r=>setTimeout(r,1000*(attempt+1)));
    }
  }
  return null;
}

// ── Migrate existing base64 photos to Supabase Storage ───────────────────────
async function migratePhotosToStorage(){
  let migrated=0;
  for(const p of patients){
    if(!p.fotos||!p.fotos.length) continue;
    let changed=false;
    for(let i=0;i<p.fotos.length;i++){
      const foto=p.fotos[i];
      if(!foto||!foto.startsWith('data:')) continue;
      try{
        const res=await fetch(foto);
        const blob=await res.blob();
        const path=`fotos/${p.id}/${Date.now()}_${i}.jpg`;
        const {error}=await supa.storage.from('patient-photos').upload(path,blob,{contentType:'image/jpeg',upsert:false});
        if(!error){
          const {data:urlData}=supa.storage.from('patient-photos').getPublicUrl(path);
          if(urlData?.publicUrl){p.fotos[i]=urlData.publicUrl;changed=true;migrated++;}
        }
      }catch(e){}
    }
    if(changed){try{await supaUpsertPatient(p);}catch(e){}}
  }
  if(migrated>0){save();console.log(`[migration] ${migrated} fotos migradas a Supabase Storage.`);}
}

// ===== BACKUP =====
function exportBackup(){
  if(typeof XLSX==='undefined'){showToast('❌ Error: librería Excel no cargada','#c46060');return;}
  try{
    const wb=XLSX.utils.book_new();
    const d=new Date().toISOString().split('T')[0];
    const t=new Date().toTimeString().slice(0,5).replace(':','-');

    // Solo pacientes activos
    const activePats = (patients||[]).filter(p => p && p.id && !p.deleted);
    const fullName = p => ((p.nombre||'') + ' ' + (p.apellido||'')).trim();

    // ── HOJA 1: PACIENTES ──
    const rPac = activePats.map(p => ({
      'Nombre':       fullName(p),
      'Teléfono':     String(p.telefono||''),
      'Fecha Inicio': p.fechaInicio||'',
      'Comentarios':  p.comentarios||''
    }));
    const wsPac = XLSX.utils.json_to_sheet(rPac.length ? rPac : [{'Nombre':'','Teléfono':'','Fecha Inicio':'','Comentarios':''}]);
    wsPac['!cols'] = [{wch:30},{wch:18},{wch:16},{wch:40}];
    XLSX.utils.book_append_sheet(wb, wsPac, 'Pacientes');

    // ── HOJA 2: SESIONES ──
    const rSes = [];
    activePats.forEach(p => {
      (p.servicios||[]).forEach(svc => {
        (svc.zonas||[]).forEach(zona => {
          (zona.sesiones||[]).forEach((ses, i) => {
            rSes.push({
              'Paciente':      fullName(p),
              'Teléfono':      String(p.telefono||''),
              'Servicio':      svc.servicio||'',
              'Cubículo':      svc.cubiculo||'',
              'Plan':          svc.plan||'',
              'Zona':          zona.nombre||'',
              'Sesión #':      i + 1,
              'Fecha':         ses.fecha||'',
              'Estado':        ses.estado||'',
              'Observaciones': ses.notas||''
            });
          });
        });
      });
    });
    const wsSes = XLSX.utils.json_to_sheet(rSes.length ? rSes : [{'Paciente':'','Teléfono':'','Servicio':'','Cubículo':'','Plan':'','Zona':'','Sesión #':'','Fecha':'','Estado':'','Observaciones':''}]);
    wsSes['!cols'] = [{wch:28},{wch:16},{wch:22},{wch:10},{wch:14},{wch:22},{wch:10},{wch:14},{wch:14},{wch:35}];
    XLSX.utils.book_append_sheet(wb, wsSes, 'Sesiones');

    // ── HOJA 3: PRE-CITAS ──
    const rPC = (preCitas||[]).map(pc => ({
      'Paciente':        ((pc.nombre||'')+(pc.apellido?' '+pc.apellido:'')).trim(),
      'Teléfono':        String(pc.telefono||''),
      'Servicio':        pc.servicio||'',
      'Fecha Tentativa': pc.fechaTentativa||'',
      'Estado':          pc.estado||'',
      'Cubículo':        pc.cubiculo||'',
      'Separación S/':   pc.separacion||0,
      'Notas':           pc.notas||''
    }));
    const wsPC = XLSX.utils.json_to_sheet(rPC.length ? rPC : [{'Paciente':'','Teléfono':'','Servicio':'','Fecha Tentativa':'','Estado':'','Cubículo':'','Separación S/':'','Notas':''}]);
    wsPC['!cols'] = [{wch:28},{wch:16},{wch:22},{wch:16},{wch:14},{wch:10},{wch:14},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsPC, 'Pre-Citas');

    // ── HOJA 4: CAJA (registros de pago diarios) ──
    const rReg = (registros||[]).map(r => ({
      'Fecha':        r.fecha||'',
      'Paciente':     ((r.nombre||'')+(r.apellido?' '+r.apellido:'')).trim(),
      'Teléfono':     String(r.telefono||''),
      'Servicio':     r.servicio||'',
      'Atendió':      r.atendio||'',
      'Zonas':        r.zonas||'',
      'Total S/':     r.total||0,
      'Adelanto S/':  r.adelanto||0,
      'Saldo S/':     (r.total||0)-(r.adelanto||0),
      'Comisión S/':  r.comision||0,
      'Notas':        r.notas||''
    }));
    const wsReg = XLSX.utils.json_to_sheet(rReg.length ? rReg : [{'Fecha':'','Paciente':'','Teléfono':'','Servicio':'','Atendió':'','Zonas':'','Total S/':'','Adelanto S/':'','Saldo S/':'','Comisión S/':'','Notas':''}]);
    wsReg['!cols'] = [{wch:14},{wch:28},{wch:16},{wch:22},{wch:16},{wch:22},{wch:10},{wch:12},{wch:10},{wch:12},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsReg, 'Caja');

    // ── HOJA 5: PAGOS POR SERVICIO (separaciones y abonos) ──
    const rPag = [];
    activePats.forEach(p => {
      (p.servicios||[]).forEach(svc => {
        const pago = svc.pago;
        if(!pago) return;
        if(pago.separacion > 0) rPag.push({
          'Paciente': fullName(p), 'Teléfono': String(p.telefono||''),
          'Servicio': svc.servicio||'', 'Concepto': 'Separación',
          'Monto S/': pago.separacion||0, 'Fecha': svc.fechaInicio||'', 'Notas': pago.notas||''
        });
        (pago.abonos||[]).forEach(ab => rPag.push({
          'Paciente': fullName(p), 'Teléfono': String(p.telefono||''),
          'Servicio': svc.servicio||'', 'Concepto': 'Abono',
          'Monto S/': ab.monto||0, 'Fecha': ab.fecha||'', 'Notas': ab.desc||''
        }));
      });
    });
    const wsPag = XLSX.utils.json_to_sheet(rPag.length ? rPag : [{'Paciente':'','Teléfono':'','Servicio':'','Concepto':'','Monto S/':'','Fecha':'','Notas':''}]);
    wsPag['!cols'] = [{wch:28},{wch:16},{wch:22},{wch:14},{wch:10},{wch:14},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsPag, 'Pagos');

        XLSX.writeFile(wb,`ElleStudio_respaldo_${d}_${t}.xlsx`);
    // Guardar fecha del último respaldo
    localStorage.setItem('elle_last_backup', new Date().toISOString());
    updateBackupReminderBanner();
    showToast('✅ Respaldo Excel descargado','#6a9e7a');
  }catch(err){console.error(err);showToast('❌ Error al generar respaldo','#c46060');}
}
function doImport(){const file=document.getElementById('importFile').files[0];if(!file){alert('Selecciona un archivo .json');return;}const reader=new FileReader();reader.onload=e=>{try{const data=JSON.parse(e.target.result);if(!data.patients||!Array.isArray(data.patients))throw new Error();if(!confirm(`¿Restaurar ${data.patients.length} pacientes?`))return;patients=data.patients;save();if(data.preCitas){preCitas=data.preCitas;savePC();(async()=>{for(const pc of preCitas){try{await supa.from('elle_precitas').upsert([_pcToDb(pc)]);}catch(e){}}console.log('[import] precitas sincronizadas:',preCitas.length);})();}
if(data.registros){registros=data.registros;saveReg();(async()=>{for(const r of registros){try{await supa.from('elle_payments').upsert([{id:String(r.id||Date.now()),fecha:r.fecha||null,nombre:r.nombre||'',apellido:r.apellido||'',telefono:r.telefono||'',servicio:r.servicio||'',zonas:r.zonas||'',total:r.total!=null?parseFloat(r.total):null,adelanto:r.adelanto!=null?parseFloat(r.adelanto):null,atendio:r.atendio||'',comision:r.comision!=null?parseFloat(r.comision):null,notas:r.notas||'',raw_json:r}]);}catch(e){}}console.log('[import] registros sincronizados:',registros.length);})();}if(data.config){appConfig={...appConfig,...data.config};saveConfig();}closeModal('importModal');applyConfigToUI();renderAll();showToast(`✅ ${patients.length} pacientes restauradas`,'#6a9e7a');}catch{alert('Archivo inválido.');}};reader.readAsText(file);}

let _sf='';
function renderPatients(list){
  const g=document.getElementById('patientsGrid');
  if(!g) return;
  // Siempre leer del array global fresco si no se pasa lista
  if(list===undefined || list===null) list = patients.slice(0);
  renderContactBanner();
  // Aplicar filtro de servicio si está activo
  if(_sf) list = list.filter(p=>(p.servicios||[]).some(sv=>sv.servicio===_sf));
  list = sortedPatients(list);
  // Limpiar grid siempre primero
  g.innerHTML = '';
  if(!list.length){
    g.innerHTML = '<div class="empty-state"><span>🌸</span>Sin pacientes encontradas.</div>';
    return;
  }
  g.innerHTML=list.map(p=>{
    const svcs=p.servicios||[];
    const hasAlert=svcs.some(sv=>{const ls=lastSesForSvc(sv);if(!ls)return false;return daysDiff(addWeeks(ls,3))<=7;});
    const totalSes=svcs.reduce((a,sv)=>a+(sv.zonas||[]).reduce((b,z)=>b+z.sesiones.length,0),0);
    const svcBadges=svcs.map(sv=>`<span class="cubiculo-tag c0${sv.cubiculo}" style="margin-right:3px;">${sv.servicio.split(' ').slice(0,2).join(' ')}</span>`).join('');
    const nextDates=svcs.map(sv=>{const n=nextApptForSvc(sv);if(!n)return'';const d=daysDiff(n);const color=d<=0?'red':d<=7?'orange':'green';return`<span class="badge ${color}" style="font-size:0.65rem;">${sv.servicio.split(' ')[0]}: ${fmtDate(n)}</span>`;}).join('');
    const hasFotos = p.fotos && p.fotos.length > 0;
    const cardBorder = hasAlert ? 'border-color:#f0c040;box-shadow:0 0 0 2px rgba(240,192,64,0.3);' : hasFotos ? 'border-color:rgba(90,122,58,0.35);' : '';
    const photoStripe = hasFotos ? '<div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#7a9f52,#b5cc8e);border-radius:16px 16px 0 0;"></div>' : '';
    return`<div class="patient-card" style="${cardBorder}">
      ${photoStripe}
      ${hasAlert?'<div style="position:absolute;top:12px;right:12px;font-size:0.7rem;background:#fff3cd;color:#c47a00;padding:2px 8px;border-radius:20px;font-weight:700;">🔔 Contactar</div>':''}
      <div onclick="openDetail('${p.id}')" style="cursor:pointer;">
        <div class="patient-avatar">${ini(p.nombre,p.apellido)}</div>
        <div class="patient-name">${p.nombre} ${p.apellido}</div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px;">${svcBadges}</div>
        <div class="patient-meta" style="margin-top:8px;">
          <span class="badge rose">${totalSes} sesiones</span>
          <span class="badge">${svcs.length} servicio${svcs.length!==1?'s':''}</span>
        </div>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">${nextDates}</div>
        <div style="margin-top:6px;font-size:0.74rem;color:var(--text-light);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>Inicio: ${fmtDate(p.fechaInicio)}</span>
          ${p.fotos&&p.fotos.length?`<span style="display:inline-flex;align-items:center;gap:3px;background:#f0f4ec;border-radius:20px;padding:2px 8px;font-size:0.68rem;color:#5a7a3a;font-weight:600;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> ${p.fotos.length}</span>`:''}
          ${p.consentimiento&&p.consentimiento.firmado?`<span class="consent-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Consentimiento</span>`:''}
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
        <button onclick="openEditPatient('${p.id}')" class="btn btn-secondary" style="flex:1;font-size:0.78rem;padding:6px 10px;justify-content:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>
        <button onclick="deletePatientByIndex(${patients.indexOf(p)})" class="btn btn-danger" style="font-size:0.78rem;padding:6px 10px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        <button onclick="openDetail('${p.id}')" class="btn btn-primary" style="flex:1;font-size:0.78rem;padding:6px 10px;justify-content:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Ver</button>
      </div>
    </div>`;
  }).join('');
}
function filterPatients(q){renderPatients(patients.filter(p=>`${p.nombre} ${p.apellido}`.toLowerCase().includes(q.toLowerCase())));}
function filterByService(s){_sf=s;renderPatients();}
let _sortPatients = localStorage.getItem('elleSortPat') || 'nombre';
function setSortPatients(v){ _sortPatients=v; localStorage.setItem('elleSortPat',v); renderPatients(); }
function sortedPatients(list){
  const s = _sortPatients;
  if(s==='nombre') return [...list].sort((a,b)=>(a.nombre+a.apellido).localeCompare(b.nombre+b.apellido,'es'));
  if(s==='fecha_desc') return [...list].sort((a,b)=>new Date(b.fechaInicio||0)-new Date(a.fechaInicio||0));
  if(s==='fecha_asc') return [...list].sort((a,b)=>new Date(a.fechaInicio||0)-new Date(b.fechaInicio||0));
  if(s==='sesiones') return [...list].sort((a,b)=>{
    const tot=p=>(p.servicios||[]).reduce((a,sv)=>a+(sv.zonas||[]).reduce((b,z)=>b+z.sesiones.length,0),0);
    return tot(b)-tot(a);
  });
  if(s==='fotos') return [...list].sort((a,b)=>{
    const fa=(a.fotos||[]).length; const fb=(b.fotos||[]).length;
    if(fb!==fa) return fb-fa;
    return (a.nombre+a.apellido).localeCompare(b.nombre+b.apellido,'es');
  });
  return list;
}

// ===== DETAIL MODAL =====
let currentPid=null;let currentZoneRef=null;
function openDetail(id){
  const sid=String(id);
  currentPid=sid;
  // Guardar el pid en el DOM del modal para recuperarlo siempre de forma segura
  const modal=document.getElementById('patientDetailModal');
  if(modal) modal.dataset.pid=sid;
  const p=patients.find(x=>String(x.id)===sid);if(!p)return;
  document.getElementById('detailTitle').textContent=`${p.nombre} ${p.apellido}`;
  document.getElementById('dAvatar').textContent=ini(p.nombre,p.apellido);
  document.getElementById('dName').textContent=`${p.nombre} ${p.apellido}`;
  document.getElementById('dInfo').textContent=`${p.telefono||'Sin teléfono'} · Inicio: ${fmtDate(p.fechaInicio)}`;
  renderSvcTabs(p);renderPhotos(p);
  // Actualizar botón de consentimiento
  const btnC = document.getElementById('btnConsentimiento');
  if(btnC){
    const signed = p.consentimiento && p.consentimiento.firmado;
    btnC.style.color = signed ? 'var(--green)' : '';
    btnC.style.borderColor = signed ? 'var(--green)' : '';
    btnC.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> ${signed ? '✅ Firmado' : 'Consentimiento'}`;
  }
  openModal('patientDetailModal');
}
// Recupera currentPid desde el DOM del modal — más fiable que la variable global sola
function getDetailPid(){
  const modal=document.getElementById('patientDetailModal');
  if(modal && modal.dataset.pid) currentPid=modal.dataset.pid;
  return currentPid;
}

function saveDetailChanges(){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){ showToast('⚠️ Error: recarga la ficha','#c46060'); return; }
  save();
  // Sin renderPatients aquí: evita scroll jump con el modal abierto
  const msg = document.getElementById('detailSaveMsg');
  if(msg){ msg.style.opacity='1'; setTimeout(()=>{ msg.style.opacity='0'; }, 2500); }
  showToast('✅ Cambios guardados','var(--sage-dark)');
}

function renderSvcTabs(p){
  const svcs=p.servicios||[];
  const tabsRow=document.getElementById('svcTabsRow');
  const panelsContainer=document.getElementById('svcPanelsContainer');
  tabsRow.innerHTML=svcs.map((sv,i)=>`
    <button class="svc-tab-btn ${i===0?'active':''}" onclick="switchSvcTab(${i})" id="svcTab${i}">
      <span class="svc-dot" style="background:${CUB_COLORS['c0'+sv.cubiculo]||'#888'};"></span>
      ${sv.servicio.split(' ').slice(0,2).join(' ')} ${cubTag(sv.cubiculo)}
    </button>`).join('')+`<button class="add-svc-btn" onclick="openAddSvcModal()">+ Servicio</button>`;
  panelsContainer.innerHTML=svcs.map((sv,i)=>`
    <div class="svc-panel ${i===0?'active':''}" id="svcPanel${i}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div>
          <span style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:500;">${sv.servicio}</span>
          <select class="cub-select c0${sv.cubiculo}" title="Editar cubículo" onclick="event.stopPropagation()" onchange="changeSvcCubiculo('${p.id}','${sv.id}',this.value,this)">
            <option value="01" ${sv.cubiculo==='01'?'selected':''}>Cub. 01</option>
            <option value="02" ${sv.cubiculo==='02'?'selected':''}>Cub. 02</option>
            <option value="03" ${sv.cubiculo==='03'?'selected':''}>Cub. 03</option>
          </select>
          <span class="badge" style="margin-left:4px;">${sv.plan}</span>
          <span onclick="openPlanFrecModal('${p.id}','${sv.id}')" class="badge" style="margin-left:4px;background:${sv.frecuenciaPlan?'var(--sage-light)':'#f5f0e8'};color:${sv.frecuenciaPlan?'var(--sage-dark)':'var(--text-light)'};cursor:pointer;border:1px solid ${sv.frecuenciaPlan?'var(--sage)':'var(--border)'};" title="Click para cambiar frecuencia del plan">${sv.frecuenciaPlan?'📆 Cada '+sv.frecuenciaPlan+'d':'📆 Sin plan'}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button onclick="_abrirAgendaSvc('${p.id}','${sv.id}')" class="btn btn-secondary" style="font-size:0.78rem;padding:6px 12px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${sv.cubiculo==='01'?'Ver Agenda':'+ Agendar cita'}</button>
          <button class="btn btn-green" style="font-size:0.78rem;padding:6px 12px;" onclick="quickWa('${p.id}','${sv.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WA Recordatorio</button>
          <button onclick="deleteSvc('${sv.id}')" style="background:transparent;border:1px solid var(--red);color:var(--red);border-radius:8px;padding:5px 10px;cursor:pointer;font-size:0.78rem;">✕</button>
        </div>
      </div>
      ${sv.comentarios?`<div style="font-size:0.8rem;color:var(--text-light);font-style:italic;margin-bottom:12px;">${sv.comentarios}</div>`:''}
      <div id="zonesContainer_${i}"></div>
      <button class="btn btn-primary" style="font-size:0.8rem;margin-top:10px;" onclick="openAddZoneModal(${i})">+ Agregar Zona</button>
    </div>`).join('');
  svcs.forEach((sv,i)=>renderZones(p,sv,i));
}

function switchSvcTab(idx){
  document.querySelectorAll('.svc-tab-btn').forEach((b,i)=>b.classList.toggle('active',i===idx));
  document.querySelectorAll('.svc-panel').forEach((p,i)=>p.classList.toggle('active',i===idx));
}

function changeSvcCubiculo(pid, svId, newCub, selectEl){
  const p=patients.find(x=>String(x.id)===String(pid));
  if(!p)return;
  const sv=(p.servicios||[]).find(x=>String(x.id)===String(svId));
  if(!sv)return;
  sv.cubiculo=newCub;
  save();
  // Actualiza la pestaña del servicio
  renderSvcTabs(p);
  showToast('✅ Cubículo actualizado a Cub. '+newCub,'var(--sage-dark)');
}

// ===== CONSENTIMIENTO INFORMADO =====
let _consentPid = null;
let _consentCanvas = null;
let _consentCtx = null;
let _consentType = 'laser';
let _consentDrawing = false;
let _consentHasSig = false;
let _consentLastX = 0;
let _consentLastY = 0;

function openConsentModal(pid){
  _consentPid = pid;
  const p = patients.find(x=>String(x.id)===String(pid));
  if(!p) return;

  document.getElementById('consentPatientName').textContent = p.nombre + ' ' + p.apellido;

  // Siempre comenzar con laser, a menos que el usuario lo cambie
  _consentType = 'laser';

  // Actualizar botones de selector
  _updateConsentTypeButtons();

  // Renderizar texto del consentimiento
  _renderConsentText(p);

  // Mostrar/ocultar selector según si ya está firmado
  if(p.consentimiento && p.consentimiento.firmado){
    document.getElementById('consentTypeSelector').style.display = 'none';
  } else {
    document.getElementById('consentTypeSelector').style.display = 'flex';
  }

  // Inicializar canvas
  setTimeout(()=>{
    _consentCanvas = document.getElementById('consentCanvas');
    _consentCtx = _consentCanvas.getContext('2d');
    _consentCtx.strokeStyle = '#1c1c17';
    _consentCtx.lineWidth = 2.5;
    _consentCtx.lineCap = 'round';
    _consentCtx.lineJoin = 'round';
    _initConsentCanvas();
  }, 100);

  // Ver si ya está firmado
  if(p.consentimiento && p.consentimiento.firmado){
    _showConsentSigned(p.consentimiento);
    _updateConsentBtn(true);
  } else {
    document.getElementById('consentSignSection').style.display = 'block';
    document.getElementById('consentViewSection').style.display = 'none';
    document.getElementById('consentStatusBar').innerHTML = '<span class="consent-badge pending">⏳ Pendiente de firma</span>';
    _updateConsentBtn(false);
  }

  document.getElementById('consentModal').classList.add('open');
}

function selectConsentType(type){
  _consentType = type;
  _updateConsentTypeButtons();
  const p = patients.find(x=>String(x.id)===String(_consentPid));
  if(p) _renderConsentText(p);
}

function _updateConsentTypeButtons(){
  const btnLaser = document.getElementById('btnConsentLaser');
  const btnBody = document.getElementById('btnConsentBody');
  if(!btnLaser || !btnBody) return;

  if(_consentType === 'laser'){
    btnLaser.style.borderColor = 'var(--sage)';
    btnLaser.style.background = 'rgba(122,140,106,0.12)';
    btnLaser.style.color = 'var(--sage-dark)';
    btnLaser.style.fontWeight = '600';
    btnBody.style.borderColor = 'var(--border)';
    btnBody.style.background = 'white';
    btnBody.style.color = 'var(--text)';
    btnBody.style.fontWeight = '500';
  } else {
    btnBody.style.borderColor = 'var(--sage)';
    btnBody.style.background = 'rgba(122,140,106,0.12)';
    btnBody.style.color = 'var(--sage-dark)';
    btnBody.style.fontWeight = '600';
    btnLaser.style.borderColor = 'var(--border)';
    btnLaser.style.background = 'white';
    btnLaser.style.color = 'var(--text)';
    btnLaser.style.fontWeight = '500';
  }
}

function _renderConsentText(p){
  const textBody = document.getElementById('consentTextBody');
  const hoy = new Date();
  const fechaStr = hoy.toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'});
  const studioName = appConfig.studioName || 'ELLE STUDIO';
  const address = appConfig.address || 'Av. Paz Soldán 235, San Isidro, Lima';

  let textoConsentimiento = '';

  if(_consentType === 'laser'){
    textoConsentimiento = appConfig.consentimientoTexto || '';
  } else if(_consentType === 'body'){
    textoConsentimiento = appConfig.consentimientoTextoBody || '';
  }

  if(textoConsentimiento.trim()){
    let textoFinal = textoConsentimiento.replace(/\[Nombre\]/g, `<strong>${p.nombre} ${p.apellido}</strong>`);

    // Si no tiene [Nombre], agregar párrafo inicial con nombre automáticamente
    if(!textoConsentimiento.includes('[Nombre]')){
      textoFinal = `Yo, <strong>${p.nombre} ${p.apellido}</strong>, mayor de edad, declaro que he recibido información clara y comprensible sobre el tratamiento a realizarme en <strong>${studioName}</strong> y que consiento voluntariamente su ejecución.\n\n${textoFinal}`;
    }

    textBody.innerHTML = `
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:600;color:var(--rose-dark);">${studioName}</div>
        <div style="font-size:0.72rem;color:var(--text-light);letter-spacing:2px;text-transform:uppercase;">${address}</div>
      </div>
      <div style="white-space:pre-wrap;line-height:1.75;">${textoFinal}</div>
      <div style="margin-top:12px;font-size:0.75rem;color:var(--text-light);text-align:right;">Lima, ${fechaStr}</div>`;
  } else {
    // Texto por defecto si no hay configurado
    let textoDefault = '';
    if(_consentType === 'laser'){
      textoDefault = `Yo, <strong>${p.nombre} ${p.apellido}</strong>, mayor de edad, declaro que he recibido información clara y comprensible sobre el tratamiento a realizarme en <strong>${studioName}</strong> y que consiento voluntariamente su ejecución.

📌 Información del Tratamiento
• El tratamiento de Depilación Láser utiliza energía lumínica de alta intensidad para reducir el vello de forma progresiva y permanente.
• Se requieren múltiples sesiones para lograr resultados óptimos (generalmente entre 6 y 8 sesiones).
• Los resultados pueden variar según el tipo de piel, color del vello y respuesta individual de cada paciente.

⚠️ Posibles Efectos Secundarios
• Enrojecimiento y sensación de calor temporal en la zona tratada (24–48 horas).
• Hiperpigmentación o hipopigmentación temporal.
• Costras leves o ampollas en casos excepcionales.
• Sensibilidad aumentada en la zona tratada durante los primeros días.

✅ Contraindicaciones — Declaro NO presentar
• Embarazo o período de lactancia.
• Uso actual de medicamentos fotosensibilizantes.
• Enfermedades cutáneas activas en la zona a tratar.
• Exposición solar intensa o bronceado artificial en los últimos 15 días.
• Marcapasos u otros implantes metálicos en la zona a tratar.

📋 Cuidados Post-Tratamiento
• Evitar exposición solar directa por 15 días y usar protector solar FPS 50+.
• No aplicar cremas irritantes, perfumes ni exfoliantes por 48 horas.
• No depilarse con cera entre sesiones.
• Mantener la zona hidratada con crema suave.

Autorización: Habiendo sido debidamente informada/o, autorizo voluntariamente a <strong>${studioName}</strong> a realizar el tratamiento acordado.

Firma del cliente: ______________________________`;
    } else if(_consentType === 'body'){
      // Body usa el texto guardado si existe
      if(!appConfig.consentimientoTextoBody || !appConfig.consentimientoTextoBody.trim()){
        textoDefault = `⚠️ No hay texto de consentimiento Body configurado. Ve a Configuración → Consentimiento Body para pegar el texto exacto.`;
      }
    }

    textBody.innerHTML = `
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:600;color:var(--rose-dark);">${studioName}</div>
        <div style="font-size:0.72rem;color:var(--text-light);letter-spacing:2px;text-transform:uppercase;">${address}</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;margin-top:8px;font-weight:500;">Consentimiento Informado para Tratamiento Estético</div>
      </div>
      <div style="white-space:pre-wrap;line-height:1.75;">${textoDefault}</div>
      <div style="margin-top:12px;font-size:0.75rem;color:var(--text-light);text-align:right;">Lima, ${fechaStr}</div>`;
  }
}

function _updateConsentBtn(signed){
  const btn = document.getElementById('btnConsentimiento');
  if(!btn) return;
  btn.textContent = signed ? '✅ Consentimiento' : '📋 Consentimiento';
  btn.style.color = signed ? 'var(--green)' : '';
  btn.style.borderColor = signed ? 'var(--green)' : '';
}

function _showConsentSigned(c){
  document.getElementById('consentSignSection').style.display = 'none';
  document.getElementById('consentViewSection').style.display = 'block';
  document.getElementById('consentFirmaImg').src = c.firma;
  const d = new Date(c.fecha);
  document.getElementById('consentFechaGuardada').textContent =
    'Firmado el ' + d.toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'}) +
    ' a las ' + d.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
  document.getElementById('consentStatusBar').innerHTML = '<span class="consent-badge">✅ Consentimiento firmado</span>';
}

function _initConsentCanvas(){
  if(!_consentCanvas) return;
  _consentHasSig = false;
  // Limpiar canvas visualmente — fix bug firma anterior queda en otras fichas
  if(_consentCtx) _consentCtx.clearRect(0,0,_consentCanvas.width,_consentCanvas.height);
  _consentCanvas.classList.remove('signed');

  // Mouse events
  _consentCanvas.onmousedown = e => { _consentDrawing=true; const r=_consentCanvas.getBoundingClientRect(); _consentLastX=(e.clientX-r.left)*(_consentCanvas.width/r.width); _consentLastY=(e.clientY-r.top)*(_consentCanvas.height/r.height); };
  _consentCanvas.onmousemove = e => { if(!_consentDrawing)return; const r=_consentCanvas.getBoundingClientRect(); const x=(e.clientX-r.left)*(_consentCanvas.width/r.width); const y=(e.clientY-r.top)*(_consentCanvas.height/r.height); _consentDraw(x,y); };
  _consentCanvas.onmouseup = () => { _consentDrawing=false; };
  _consentCanvas.onmouseleave = () => { _consentDrawing=false; };

  // Touch events (tablet)
  _consentCanvas.ontouchstart = e => { e.preventDefault(); _consentDrawing=true; const r=_consentCanvas.getBoundingClientRect(); const t=e.touches[0]; _consentLastX=(t.clientX-r.left)*(_consentCanvas.width/r.width); _consentLastY=(t.clientY-r.top)*(_consentCanvas.height/r.height); };
  _consentCanvas.ontouchmove = e => { e.preventDefault(); if(!_consentDrawing)return; const r=_consentCanvas.getBoundingClientRect(); const t=e.touches[0]; const x=(t.clientX-r.left)*(_consentCanvas.width/r.width); const y=(t.clientY-r.top)*(_consentCanvas.height/r.height); _consentDraw(x,y); };
  _consentCanvas.ontouchend = () => { _consentDrawing=false; };
}

function _consentDraw(x,y){
  _consentCtx.beginPath();
  _consentCtx.moveTo(_consentLastX, _consentLastY);
  _consentCtx.lineTo(x, y);
  _consentCtx.stroke();
  _consentLastX = x; _consentLastY = y;
  _consentHasSig = true;
  _consentCanvas.classList.add('signed');
}

function clearConsentCanvas(){
  if(!_consentCtx) return;
  _consentCtx.clearRect(0,0,_consentCanvas.width,_consentCanvas.height);
  _consentHasSig = false;
  _consentCanvas.classList.remove('signed');
}

async function saveConsent(){
  if(!_consentHasSig){ showToast('⚠️ Dibuja la firma primero','#c47a00'); return; }
  const p = patients.find(x=>String(x.id)===String(_consentPid));
  if(!p) return;
  // Comprimir firma: escalar a máx 400px ancho + fondo blanco + JPEG calidad 0.7
  const maxW = 400;
  const scale = Math.min(1, maxW / _consentCanvas.width);
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(_consentCanvas.width * scale);
  tmp.height = Math.round(_consentCanvas.height * scale);
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0,0,tmp.width,tmp.height);
  tctx.drawImage(_consentCanvas, 0, 0, tmp.width, tmp.height);
  const firmaBase64 = tmp.toDataURL('image/jpeg', 0.7);
  p.consentimiento = { firmado: true, fecha: new Date().toISOString(), firma: firmaBase64, tipo: _consentType };
  // Guardar local primero
  try{ localStorage.setItem('ce_v3_patients', JSON.stringify(patients)); }catch(e){}
  // Sync explícito a Supabase con confirmación
  setSyncState('syncing');
  showToast('☁️ Subiendo firma a la nube...','var(--text-light)');
  try{
    await supaUpsertPatient(p);
    // Verificar que se guardó leyendo de vuelta
    const {data,error} = await supa.from('patients').select('data').eq('id',String(p.id)).single();
    if(error) throw error;
    if(!data?.data?.consentimiento?.firmado) throw new Error('Firma no persistió en Supabase');
    setSyncState('idle');
    renderPatients();
    _showConsentSigned(p.consentimiento);
    _updateConsentBtn(true);
    showToast('✅ Consentimiento ' + (_consentType === 'laser' ? 'Láser' : 'Body') + ' guardado en la nube','var(--sage-dark)');
  }catch(e){
    console.error('saveConsent Supabase error:',e);
    setSyncState('error');
    // Revertir para que la próxima vez reintente
    showToast('⚠️ Firma guardada local pero NO se subió a la nube. Revisa tu conexión e intenta de nuevo.','#c46060',6000);
    renderPatients();
    _showConsentSigned(p.consentimiento);
    _updateConsentBtn(true);
  }
}

function resetConsentForResign(){
  if(!confirm('¿Borrar la firma actual y volver a firmar?')) return;
  const p = patients.find(x=>String(x.id)===String(_consentPid));
  if(p){ delete p.consentimiento; save(); renderPatients(); }
  document.getElementById('consentSignSection').style.display = 'block';
  document.getElementById('consentViewSection').style.display = 'none';
  document.getElementById('consentStatusBar').innerHTML = '<span class="consent-badge pending">⏳ Pendiente de firma</span>';
  _updateConsentBtn(false);
  setTimeout(()=>{ clearConsentCanvas(); _initConsentCanvas(); }, 100);
}

function printConsent(){
  const p = patients.find(x=>String(x.id)===String(_consentPid));
  const nombre = p ? p.nombre + ' ' + p.apellido : '___________________________';
  const dni = p && (p.dni || p.documento) ? p.dni || p.documento : '___________________________';
  const telefono = p && p.telefono ? p.telefono : '___________________________';
  const email = p && p.email ? p.email : '___________________________';
  const fechaActual = new Date().toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'});
  const hoy = new Date().toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'});
  const firmaHtml = (p&&p.consentimiento&&p.consentimiento.firma)
    ? `<img src="${p.consentimiento.firma}" style="width:280px;height:90px;object-fit:contain;border:1px solid #ccc;border-radius:6px;padding:4px;">`
    : '<div style="width:280px;height:60px;border-bottom:1px solid #333;"></div>';
  const area = document.getElementById('printConsentArea');
  const studioName = appConfig.studioName || 'ELLE STUDIO';
  const studioAddr = appConfig.address || 'Av. Paz Soldán 235, San Isidro, Lima, Perú';
  
  // Texto del consentimiento con formato exacto solicitado y datos del paciente insertados
  const cuerpoTexto = `
    <div style="white-space:pre-wrap;line-height:2;font-size:13px;">
DATOS DEL PACIENTE
Nombre y Apellido: ${nombre}
DNI / Documento: ${dni}
Teléfono: ${telefono}
Correo electrónico: ${email}
Fecha: ${fechaActual}


1.⁠ ⁠INFORMACIÓN DEL PROCEDIMIENTO
La depilación láser es un procedimiento estético que utiliza energía lumínica para debilitar
progresivamente el folículo piloso y reducir el crecimiento del vello. El número de sesiones
necesarias puede variar según el tipo de piel, vello, zona tratada y factores hormonales. No se
garantiza la eliminación total permanente del vello.
2.⁠ ⁠POSIBLES EFECTOS SECUNDARIOS
Pueden presentarse efectos temporales como enrojecimiento, inflamación leve, sensación de calor
o sensibilidad. En casos poco frecuentes pueden ocurrir quemaduras, ampollas o cambios
temporales en la pigmentación de la piel.
3.⁠ ⁠DECLARACIÓN DE SALUD DEL PACIENTE
Declaro que he informado sobre mi estado de salud y confirmo que no padezco condiciones
incompatibles con el tratamiento como embarazo, enfermedades dermatológicas activas, cáncer
de piel, epilepsia fotosensible, diabetes no controlada, infecciones cutáneas activas, herpes activo
en la zona a tratar, uso reciente de isotretinoína, medicamentos fotosensibles o bronceado
reciente.
4.⁠ ⁠RESPONSABILIDAD DEL PACIENTE
Me comprometo a seguir las recomendaciones indicadas por el centro estético. El incumplimiento
de dichas indicaciones puede aumentar el riesgo de efectos adversos, liberando de
responsabilidad al centro estético.
5.⁠ ⁠POLÍTICA DE CITAS E INASISTENCIAS
Si el paciente confirma su cita y no asiste, la sesión será descontada de su paquete. Más de dos
inasistencias confirmadas pueden ocasionar la cancelación total del paquete sin devolución del
dinero. Si el paciente no responde al llamado para agendar su cita en dos ocasiones consecutivas
(aproximadamente dos meses), el tratamiento podrá darse por finalizado perdiendo las sesiones
pendientes.
6.⁠ ⁠AUTORIZACIÓN DE REGISTRO FOTOGRÁFICO
Autorizo la toma de fotografías clínicas antes y después del tratamiento con fines de seguimiento y
registro interno.
7.⁠ ⁠CONSENTIMIENTO
Declaro haber leído y comprendido la información anterior y autorizo voluntariamente la realización
del procedimiento de depilación láser.
Firma del paciente: ______________________________
Nombre: ________________________________________
DNI: _________________________________________
    </div>
  `;

  area.innerHTML = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;padding:30px 40px;font-size:12px;color:#1c1c17;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:22px;font-weight:700;letter-spacing:3px;">${studioName}</div>
        <div style="font-size:10px;color:#666;margin-top:2px;">${studioAddr}</div>
        <div style="font-size:14px;font-weight:600;margin-top:10px;border-bottom:2px solid #3d4f30;padding-bottom:6px;">CONSENTIMIENTO INFORMADO PARA TRATAMIENTO ESTÉTICO</div>
      </div>
      ${cuerpoTexto}
      <div style="margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div style="margin-bottom:6px;">Firma de la Paciente:</div>
          ${firmaHtml}
        </div>
        <div style="text-align:right;">
          <div>Lima, ${hoy}</div>
          <div style="margin-top:20px;">___________________________</div>
          <div style="font-size:10px;color:#666;">Profesional Elle Studio</div>
        </div>
      </div>
    </div>`;
  window.print();
}

function downloadConsent(){
  const p = patients.find(x=>String(x.id)===String(_consentPid));
  if(!p){ showToast('Error: paciente no encontrada','#c46060'); return; }
  if(!p.consentimiento || !p.consentimiento.firma){
    showToast('⚠️ Guarda la firma primero','#c47a00'); return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxW = W - margin * 2;
  let y = 20;

  const studioName = appConfig.studioName || 'ELLE STUDIO';
  const studioAddr = appConfig.address || 'Av. Paz Soldán 235, San Isidro, Lima, Perú';
  const nombre = p.nombre + ' ' + p.apellido;
  const dni = p && (p.dni || p.documento) ? p.dni || p.documento : '___________________________';
  const telefono = p && p.telefono ? p.telefono : '___________________________';
  const email = p && p.email ? p.email : '___________________________';
  const hoy = new Date(p.consentimiento.fecha);
  const fechaStr = hoy.toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'});
  const horaStr = hoy.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
  const fechaActual = new Date().toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'});

  // Encabezado
  doc.setFont('helvetica','bold');
  doc.setFontSize(18);
  doc.setTextColor(60,79,48);
  doc.text(studioName.toUpperCase(), W/2, y, {align:'center'});
  y += 6;
  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(100,100,80);
  doc.text(studioAddr, W/2, y, {align:'center'});
  y += 8;
  doc.setFont('helvetica','bold');
  doc.setFontSize(12);
  doc.setTextColor(30,30,23);
  doc.text('CONSENTIMIENTO INFORMADO PARA TRATAMIENTO ESTÉTICO', W/2, y, {align:'center'});
  y += 3;
  doc.setDrawColor(60,79,48);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W-margin, y);
  y += 8;

  // Cuerpo del texto - Solo el texto de consentimiento, sin datos del paciente
  doc.setFont('helvetica','normal');
  doc.setFontSize(10);
  doc.setTextColor(30,30,23);

  let textoConsentimiento = '';
  const tipoConsent = p.consentimiento && p.consentimiento.tipo ? p.consentimiento.tipo : 'laser';

  if(tipoConsent === 'laser'){
    if(appConfig.consentimientoTexto && appConfig.consentimientoTexto.trim()){
      textoConsentimiento = appConfig.consentimientoTexto;
    } else {
      textoConsentimiento = `DATOS DEL PACIENTE
Nombre y Apellido: ${nombre}
DNI / Documento: ${dni}
Teléfono: ${telefono}
Correo electrónico: ${email}
Fecha: ${fechaActual}


1.⁠ ⁠INFORMACIÓN DEL PROCEDIMIENTO
La depilación láser es un procedimiento estético que utiliza energía lumínica para debilitar
progresivamente el folículo piloso y reducir el crecimiento del vello. El número de sesiones
necesarias puede variar según el tipo de piel, vello, zona tratada y factores hormonales. No se
garantiza la eliminación total permanente del vello.
2.⁠ ⁠POSIBLES EFECTOS SECUNDARIOS
Pueden presentarse efectos temporales como enrojecimiento, inflamación leve, sensación de calor
o sensibilidad. En casos poco frecuentes pueden ocurrir quemaduras, ampollas o cambios
temporales en la pigmentación de la piel.
3.⁠ ⁠DECLARACIÓN DE SALUD DEL PACIENTE
Declaro que he informado sobre mi estado de salud y confirmo que no padezco condiciones
incompatibles con el tratamiento como embarazo, enfermedades dermatológicas activas, cáncer
de piel, epilepsia fotosensible, diabetes no controlada, infecciones cutáneas activas, herpes activo
en la zona a tratar, uso reciente de isotretinoína, medicamentos fotosensibles o bronceado
reciente.
4.⁠ ⁠RESPONSABILIDAD DEL PACIENTE
Me comprometo a seguir las recomendaciones indicadas por el centro estético. El incumplimiento
de dichas indicaciones puede aumentar el riesgo de efectos adversos, liberando de
responsabilidad al centro estético.
5.⁠ ⁠POLÍTICA DE CITAS E INASISTENCIAS
Si el paciente confirma su cita y no asiste, la sesión será descontada de su paquete. Más de dos
inasistencias confirmadas pueden ocasionar la cancelación total del paquete sin devolución del
dinero. Si el paciente no responde al llamado para agendar su cita en dos ocasiones consecutivas
(aproximadamente dos meses), el tratamiento podrá darse por finalizado perdiendo las sesiones
pendientes.
6.⁠ ⁠AUTORIZACIÓN DE REGISTRO FOTOGRÁFICO
Autorizo la toma de fotografías clínicas antes y después del tratamiento con fines de seguimiento y
registro interno.
7.⁠ ⁠CONSENTIMIENTO
Declaro haber leído y comprendido la información anterior y autorizo voluntariamente la realización
del procedimiento de depilación láser.
Firma del paciente: ______________________________
Nombre: ________________________________________
DNI: _________________________________________`;
    }
  } else if(tipoConsent === 'body'){
    if(appConfig.consentimientoTextoBody && appConfig.consentimientoTextoBody.trim()){
      textoConsentimiento = appConfig.consentimientoTextoBody;
    } else {
      textoConsentimiento = `⚠️ No hay texto de consentimiento Body configurado.`;
    }
  }

  const lineas = doc.splitTextToSize(textoConsentimiento, maxW);
  lineas.forEach(linea => {
    if(y > 240){ doc.addPage(); y = 20; }
    doc.text(linea, margin, y);
    y += linea === '' ? 3 : 5.5;
  });

  y += 8;
  // Línea separadora antes de firma
  doc.setDrawColor(200,200,190);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W-margin, y);
  y += 8;

  // Firma
  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.setTextColor(60,79,48);
  doc.text('Firma del Paciente:', margin, y);
  y += 4;

  try {
    const firmaImg = p.consentimiento.firma;
    doc.addImage(firmaImg, 'PNG', margin, y, 70, 28, '', 'FAST');
  } catch(e){ console.error('Error firma PDF:',e); }
  y += 30;

  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(100,100,80);
  doc.text(`Firmado el ${fechaStr} a las ${horaStr}`, margin, y);

  // Pie de página
  const totalPages = doc.internal.getNumberOfPages();
  for(let i=1; i<=totalPages; i++){
    doc.setPage(i);
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(160,160,140);
    doc.text(`${studioName} · Documento Legal · Pág. ${i}/${totalPages}`, W/2, 290, {align:'center'});
  }

  const nombreArchivo = `Consentimiento_${p.nombre}_${p.apellido}_${hoy.toISOString().split('T')[0]}.pdf`.replace(/\s+/g,'_');
  doc.save(nombreArchivo);
  showToast('✅ PDF descargado','var(--sage-dark)');
}

function renderZones(p,sv,svi){
  const c=document.getElementById(`zonesContainer_${svi}`);if(!c)return;
  const isLaser=sv.servicio==='Depilación Láser';
  if(!sv.zonas||!sv.zonas.length){c.innerHTML='<div class="empty-state" style="padding:20px;"><span>📍</span>Sin zonas aún.</div>';return;}
  c.innerHTML=sv.zonas.map((z,zi)=>{
    _zoneMigrarLegacy(z);
    const estado=z.estado||'activa';
    const esActiva=estado==='activa';
    const toggleBtn=`<select onchange="setZoneEstado(${svi},${zi},this.value)" onclick="event.stopPropagation()" style="padding:3px 12px;border-radius:20px;border:1.5px solid ${esActiva?'#2e7d32':'#c46060'};background:${esActiva?'#e6f4ea':'#f3e5e5'};color:${esActiva?'#2e7d32':'#c46060'};font-size:0.72rem;font-weight:700;cursor:pointer;outline:none;font-family:'DM Sans',sans-serif;">
      <option value="activa" ${esActiva?'selected':''}>● Activa</option>
      <option value="concluida" ${!esActiva?'selected':''}>● Concluida</option>
    </select>`;
    const paqs=_zoneGetPaquetes(z);
    const sesCount=(z.sesiones||[]).length;
    const sueltas=_zoneSesionesSueltas(z);
    const active=_zoneActivePaquete(z);

    // Badge de progreso del paquete activo para el header
    let paqBadge='';
    if(paqs.length){
      if(active){
        const done=_zonePaqueteProgress(z,active.id);
        const total=active.tamano;
        const filled=Math.min(Math.round(done/total*5),5);
        const bar='█'.repeat(filled)+'░'.repeat(5-filled);
        const col=done>=total-1&&done<total?'#c47a00':(done>=total?'#2e7d32':'var(--sage-dark)');
        paqBadge=`<span style="display:inline-flex;align-items:center;gap:4px;background:#e8efe2;color:${col};font-size:0.65rem;padding:3px 8px;border-radius:12px;font-weight:700;">📦 ${done}/${total} <span style="font-family:monospace;letter-spacing:0.5px;">${bar}</span></span>`;
      }else{
        paqBadge=`<span class="badge" style="background:#e6f4ea;color:#2e7d32;">✅ ${paqs.length} paq.</span>`;
      }
    }

    // Resumen de paquetes
    let paqsHtml='';
    if(paqs.length){
      paqsHtml='<div style="padding:10px 14px;display:flex;flex-wrap:wrap;gap:8px;background:#faf5f0;border-bottom:1px solid var(--border);">';
      paqs.forEach((pq,idx)=>{
        const done=_zonePaqueteProgress(z,pq.id);
        const pct=Math.min(Math.round(done/pq.tamano*100),100);
        const completo=done>=pq.tamano;
        const casi=done>=pq.tamano-1&&!completo;
        const color=completo?'var(--green)':casi?'#c47a00':'var(--sage-dark)';
        const bgColor=completo?'#e6f4ea':casi?'#fff3e0':'#eef4ea';
        paqsHtml+='<div style="flex:1;min-width:200px;background:white;border:1px solid var(--border);border-radius:10px;padding:10px 12px;">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
            +'<div style="display:flex;align-items:center;gap:6px;">'
              +'<span style="font-size:0.85rem;font-weight:700;color:'+color+';">📦 Paquete '+pq.num+'</span>'
              +(completo?'<span style="font-size:0.62rem;background:'+bgColor+';color:'+color+';padding:1px 6px;border-radius:8px;font-weight:700;">✅</span>':'')
              +(casi?'<span style="font-size:0.62rem;background:'+bgColor+';color:'+color+';padding:1px 6px;border-radius:8px;font-weight:700;">⚠️ Última</span>':'')
            +'</div>'
            +'<div style="display:flex;gap:4px;">'
              +(pq._synth?'':'<button onclick="event.stopPropagation();editPaquete('+svi+','+zi+',\''+pq.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--text-light);font-size:0.72rem;padding:2px 6px;" title="Editar">✏</button>')
              +(pq._synth?'':'<button onclick="event.stopPropagation();deletePaquete('+svi+','+zi+',\''+pq.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:0.7rem;padding:2px 6px;" title="Eliminar paquete (las sesiones quedan sueltas)">🗑</button>')
            +'</div>'
          +'</div>'
          +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'
            +'<div style="flex:1;height:6px;background:#eee;border-radius:3px;overflow:hidden;"><div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:3px;"></div></div>'
            +'<span style="font-size:0.72rem;font-weight:700;color:'+color+';">'+done+'/'+pq.tamano+'</span>'
          +'</div>'
          +'<div style="font-size:0.7rem;color:var(--text-light);">'
            +(pq.fechaCompra?'📅 '+fmtDate(pq.fechaCompra):'Sin fecha')
            +(pq.precio?' · 💰 S/ '+Number(pq.precio).toFixed(0):'')
          +'</div>'
        +'</div>';
      });
      paqsHtml+='</div>';
    }

    // Nueva tabla con columna Paq
    return `
    <div class="zone-block">
      <div class="zone-header" onclick="toggleZone(${svi},${zi})">
        <h4>📍 ${z.nombre}</h4>
        <div style="display:flex;gap:8px;align-items:center;" onclick="event.stopPropagation()">
          ${toggleBtn}
          <span class="badge blue">${sesCount} ses.</span>
          ${paqBadge}
          <span id="zarr_${svi}_${zi}" onclick="toggleZone(${svi},${zi});event.stopPropagation();" style="cursor:pointer;">▼</span>
        </div>
      </div>
      ${paqsHtml}
      <div id="zbody_${svi}_${zi}">
        <div class="laser-table-wrap">
          <table class="laser"><thead><tr>
            <th>#</th><th>Paq</th><th>Fecha</th>${isLaser?'<th>Rate</th><th>Pulse</th><th>CM²</th>':''}
            <th>Plan</th><th>Atendió</th><th>Comentarios</th><th></th>
          </tr></thead><tbody>
          ${z.sesiones.map((s,si)=>{
            const pqSel=_zonePaqueteSelectHtml(z,s,svi,zi,si);
            return `<tr>
              <td><div class="ses-num">${si+1}</div></td>
              <td>${pqSel}</td>
              <td><input type="date" value="${s.fecha||''}" style="width:125px;min-height:36px;" onchange="updSes(${svi},${zi},${si},'fecha',this.value)" oninput="updSes(${svi},${zi},${si},'fecha',this.value)"></td>
              ${isLaser?`<td><input type="number" value="${s.rate||''}" placeholder="J" style="width:60px" oninput="updSes(${svi},${zi},${si},'rate',this.value)" onchange="updSes(${svi},${zi},${si},'rate',this.value)"></td><td><input type="number" value="${s.pulse||''}" placeholder="ms" style="width:60px" oninput="updSes(${svi},${zi},${si},'pulse',this.value)" onchange="updSes(${svi},${zi},${si},'pulse',this.value)"></td><td><input type="number" value="${s.cm2||''}" placeholder="cm²" style="width:60px" oninput="updSes(${svi},${zi},${si},'cm2',this.value)" onchange="updSes(${svi},${zi},${si},'cm2',this.value)"></td>`:''}
              <td><select style="width:80px;min-height:36px;" onchange="updSes(${svi},${zi},${si},'plan',this.value)"><option ${s.plan==='Sesión'?'selected':''}>Sesión</option><option ${s.plan==='Paquete'?'selected':''}>Paquete</option></select></td>
              <td><input type="text" value="${s.atencion||''}" placeholder="Prof." style="width:95px" oninput="updSes(${svi},${zi},${si},'atencion',this.value)" onchange="updSes(${svi},${zi},${si},'atencion',this.value)"></td>
              <td><input type="text" value="${s.comentarios||''}" placeholder="Notas..." style="width:140px" oninput="updSes(${svi},${zi},${si},'comentarios',this.value)" onchange="updSes(${svi},${zi},${si},'comentarios',this.value)"></td>
              <td><button class="btn-danger" onclick="delSes(${svi},${zi},${si})">✕</button></td>
            </tr>`;
          }).join('')}
          </tbody></table>
        </div>
        <div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;background:rgba(201,132,122,0.04);flex-wrap:wrap;gap:8px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary" style="font-size:0.8rem;padding:7px 14px;" onclick="addSes(${svi},${zi})">+ Sesión</button>
            <button class="btn btn-secondary" style="font-size:0.8rem;padding:7px 14px;" onclick="openNewPaqueteModal(${svi},${zi})">📦 Nuevo Paquete</button>
          </div>
          <button class="btn-danger" onclick="delZone(${svi},${zi})">Eliminar zona</button>
        </div>
      </div>
    </div>`;}).join('');
}
// Selector de paquete para cada sesión
function _zonePaqueteSelectHtml(z,s,svi,zi,si){
  const paqs=_zoneGetPaquetes(z).filter(p=>!p._synth);
  if(!paqs.length){
    return '<span style="font-size:0.68rem;color:var(--text-light);">—</span>';
  }
  let html='<select onchange="updSes('+svi+','+zi+','+si+',\'paqueteId\',this.value)" style="font-size:0.72rem;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:white;min-height:30px;">';
  html+='<option value="">Suelta</option>';
  paqs.forEach(pq=>{
    html+='<option value="'+pq.id+'" '+(String(s.paqueteId||'')===String(pq.id)?'selected':'')+'>Paq '+pq.num+'</option>';
  });
  html+='</select>';
  return html;
}

function toggleZone(svi,zi){const b=document.getElementById(`zbody_${svi}_${zi}`);const a=document.getElementById(`zarr_${svi}_${zi}`);const h=b.style.display==='none';b.style.display=h?'block':'none';a.textContent=h?'▼':'▶';}

// ============== PAQUETES MÚLTIPLES POR ZONA ==============
// Estructura: zona.paquetes = [{id, num, tamano, fechaCompra, precio, separacion, notas}]
// Cada sesión tiene s.paqueteId opcional que la asocia al paquete
function _zoneGetPaquetes(z){
  if(z.paquetes&&z.paquetes.length) return z.paquetes;
  // Legado: si tenía totalPaquete, sintetizar un paquete
  if(z.totalPaquete) return [{id:'legacy',num:1,tamano:z.totalPaquete,_synth:true}];
  return [];
}
function _zonePaqueteProgress(z,paqId){
  return (z.sesiones||[]).filter(s=>String(s.paqueteId||'')===String(paqId)).length;
}
function _zoneSesionesSueltas(z){
  return (z.sesiones||[]).filter(s=>!s.paqueteId);
}
function _zoneActivePaquete(z){
  const paqs=_zoneGetPaquetes(z);
  for(const pq of paqs){
    if(pq._synth) continue; // no asignar auto a sintéticos
    if(_zonePaqueteProgress(z,pq.id)<pq.tamano) return pq;
  }
  return null;
}
function _zoneMigrarLegacy(z){
  // Si tenía totalPaquete y aún no tiene paquetes, migrar
  if(z.totalPaquete&&(!z.paquetes||!z.paquetes.length)){
    const id='pq_'+Date.now();
    z.paquetes=[{id,num:1,tamano:z.totalPaquete,fechaCompra:(z.sesiones[0]||{}).fecha||''}];
    // Asignar todas las sesiones existentes a este paquete
    (z.sesiones||[]).forEach(s=>{if(!s.paqueteId)s.paqueteId=id;});
    delete z.totalPaquete;
  }
}
// === GESTIÓN DE PAQUETES MÚLTIPLES ===
let _paqSvi=null,_paqZi=null,_paqEditId=null;
function openNewPaqueteModal(svi,zi){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p)return;
  const z=p.servicios[svi].zonas[zi];
  _zoneMigrarLegacy(z);
  _paqSvi=svi;_paqZi=zi;_paqEditId=null;
  const paqs=_zoneGetPaquetes(z).filter(x=>!x._synth);
  document.getElementById('paqModalTitle').textContent='📦 Nuevo Paquete — '+z.nombre;
  document.getElementById('paqNum').value=paqs.length+1;
  document.getElementById('paqTamano').value='';
  document.getElementById('paqFechaCompra').value=new Date().toISOString().split('T')[0];
  document.getElementById('paqPrecio').value='';
  document.getElementById('paqSeparacion').value='';
  document.getElementById('paqNotas').value='';
  const asignarBox=document.getElementById('paqAsignarBox');
  const sueltas=_zoneSesionesSueltas(z);
  if(sueltas.length){
    asignarBox.style.display='block';
    document.getElementById('paqAsignarCount').textContent=sueltas.length;
  } else {
    asignarBox.style.display='none';
  }
  document.getElementById('paqModal').style.display='flex';
}
function editPaquete(svi,zi,paqId){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p)return;
  const z=p.servicios[svi].zonas[zi];
  const pq=(z.paquetes||[]).find(x=>String(x.id)===String(paqId));
  if(!pq)return;
  _paqSvi=svi;_paqZi=zi;_paqEditId=paqId;
  document.getElementById('paqModalTitle').textContent='📦 Editar Paquete '+pq.num+' — '+z.nombre;
  document.getElementById('paqNum').value=pq.num;
  document.getElementById('paqTamano').value=pq.tamano;
  document.getElementById('paqFechaCompra').value=pq.fechaCompra||'';
  document.getElementById('paqPrecio').value=pq.precio||'';
  document.getElementById('paqSeparacion').value=pq.separacion||'';
  document.getElementById('paqNotas').value=pq.notas||'';
  document.getElementById('paqAsignarBox').style.display='none';
  document.getElementById('paqModal').style.display='flex';
}
function closePaqueteModal(){document.getElementById('paqModal').style.display='none';}
function savePaquete(){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p)return;
  const z=p.servicios[_paqSvi].zonas[_paqZi];
  _zoneMigrarLegacy(z);
  if(!z.paquetes) z.paquetes=[];
  const tamano=parseInt(document.getElementById('paqTamano').value)||0;
  if(tamano<=0){alert('El tamaño del paquete debe ser mayor a 0');return;}
  const num=parseInt(document.getElementById('paqNum').value)||z.paquetes.length+1;
  const fechaCompra=document.getElementById('paqFechaCompra').value;
  const precio=parseFloat(document.getElementById('paqPrecio').value)||0;
  const separacion=parseFloat(document.getElementById('paqSeparacion').value)||0;
  const notas=document.getElementById('paqNotas').value.trim();
  const asignar=document.getElementById('paqAsignarSueltas')?.checked;
  if(_paqEditId){
    const pq=z.paquetes.find(x=>String(x.id)===String(_paqEditId));
    if(pq){
      pq.num=num;pq.tamano=tamano;pq.fechaCompra=fechaCompra;pq.precio=precio;pq.separacion=separacion;pq.notas=notas;
    }
    showToast('✅ Paquete actualizado','var(--sage-dark)');
  } else {
    const id='pq_'+Date.now();
    z.paquetes.push({id,num,tamano,fechaCompra,precio,separacion,notas});
    if(asignar){
      // Asignar todas las sesiones sueltas al nuevo paquete (hasta completar tamano)
      const sueltas=(z.sesiones||[]).filter(s=>!s.paqueteId);
      sueltas.slice(0,tamano).forEach(s=>s.paqueteId=id);
    }
    showToast('✅ Paquete creado','var(--sage-dark)');
  }
  save();
  closePaqueteModal();
  renderZones(p,p.servicios[_paqSvi],_paqSvi);
  renderStats();
}
function deletePaquete(svi,zi,paqId){
  if(_workerGuard('eliminar paquetes','eliminarPaquetes')) return;
  if(!confirm('¿Eliminar este paquete? Las sesiones de este paquete quedarán como "sueltas" (no se borran).'))return;
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p)return;
  const z=p.servicios[svi].zonas[zi];
  if(!z.paquetes)return;
  z.paquetes=z.paquetes.filter(x=>String(x.id)!==String(paqId));
  // Liberar sesiones que estaban en ese paquete
  (z.sesiones||[]).forEach(s=>{
    if(String(s.paqueteId||'')===String(paqId)) delete s.paqueteId;
  });
  save();
  renderZones(p,p.servicios[svi],svi);
  renderStats();
  showToast('🗑 Paquete eliminado','#c46060');
}

function setZonePaquete(svi,zi,val){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p)return;
  const num=parseInt(val)||0;
  p.servicios[svi].zonas[zi].totalPaquete=num>0?num:0;
  save();
  renderZones(p,p.servicios[svi],svi);
  if(num>0) showToast(`📦 Paquete de ${num} sesiones configurado`,'#6a8c5a');
}
function editZonePaquete(svi,zi){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p)return;
  const z=p.servicios[svi].zonas[zi];
  const nuevo=prompt(`Paquete para "${z.nombre}" — total de sesiones:`,z.totalPaquete||'');
  if(nuevo===null)return;
  const num=parseInt(nuevo)||0;
  z.totalPaquete=num>0?num:0;
  save();
  renderZones(p,p.servicios[svi],svi);
  showToast(num>0?`📦 Paquete actualizado a ${num} sesiones`:'📦 Paquete removido','#6a8c5a');
}
function setZoneEstado(svi,zi,val){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){ alert('Error: paciente no encontrado'); return; }
  p.servicios[svi].zonas[zi].estado=val;
  save();
  renderZones(p,p.servicios[svi],svi);
}
let _updSesTimer = null;
function updSes(svi,zi,si,f,v){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){ return; }
  p.servicios[svi].zonas[zi].sesiones[si][f]=v;
  // Guardado inmediato en localStorage para no perder datos
  try{ localStorage.setItem('ce_v3_patients', JSON.stringify(patients)); }catch(e){}
  // Debounce para Supabase
  clearTimeout(_updSesTimer);
  _updSesTimer = setTimeout(()=>{ save(); }, 800);
}
function flushUpdSes(){
  if(_updSesTimer){ clearTimeout(_updSesTimer); _updSesTimer=null; save(); }
}
// === TRACKING DE GUARDADOS PENDIENTES ===
window._pendingSaves=0;
function _addPending(){window._pendingSaves++;_updateSyncBadge();}
function _removePending(){window._pendingSaves=Math.max(0,window._pendingSaves-1);_updateSyncBadge();}
function _updateSyncBadge(){
  let badge=document.getElementById('_pendingBadge');
  if(window._pendingSaves>0){
    if(!badge){
      badge=document.createElement('div');
      badge.id='_pendingBadge';
      badge.style.cssText='position:fixed;bottom:16px;right:16px;background:#c47a00;color:white;padding:8px 14px;border-radius:20px;font-size:0.78rem;font-weight:600;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;gap:6px;';
      document.body.appendChild(badge);
    }
    badge.innerHTML='💾 Sincronizando... ('+window._pendingSaves+')';
    badge.style.display='flex';
  } else if(badge){ badge.style.display='none'; }
}
// Protección al cerrar pestaña / cambiar de app
window.addEventListener('beforeunload',function(e){
  if(_updSesTimer){
    clearTimeout(_updSesTimer);_updSesTimer=null;
    try{ localStorage.setItem('ce_v3_patients', JSON.stringify(patients)); }catch(e){}
    save();
  }
  if(window._pendingSaves>0){
    e.preventDefault();
    e.returnValue='Hay cambios sincronizándose. Si cierras ahora podrían perderse.';
    return e.returnValue;
  }
});
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden'&&_updSesTimer) flushUpdSes();
});
setInterval(function(){ if(_updSesTimer) flushUpdSes(); },15000);
function togAs(svi,zi,si){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){ alert('Error: paciente no encontrado'); return; }
  const s=p.servicios[svi].zonas[zi].sesiones[si];
  s.asistio=!s.asistio;
  save();
  renderZones(p,p.servicios[svi],svi);
  // No renderPatients() con modal abierto
}
let _addSesSvi=0, _addSesZi=0;
function addSes(svi,zi){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){ alert('Error: paciente no encontrado'); return; }
  _addSesSvi=svi; _addSesZi=zi;
  const sv=p.servicios[svi];
  const fechaEl=document.getElementById('sesFecha');
  if(fechaEl) fechaEl.value=new Date().toISOString().split('T')[0];
  document.querySelectorAll('.freq-btn').forEach(b=>b.classList.remove('freq-active'));
  // Usar frecuencia del plan del servicio (ya configurada en el servicio)
  const planFrec=sv&&sv.frecuenciaPlan?parseInt(sv.frecuenciaPlan):21;
  const customEl=document.getElementById('sesFrecCustom');
  if(customEl) customEl.value='';
  // Activar el botón correspondiente si existe, si no, setear custom
  const btnByDias=document.querySelector('.freq-btn[data-dias="'+planFrec+'"]');
  if(btnByDias) btnByDias.classList.add('freq-active');
  else if(customEl) customEl.value=planFrec;
  updateFrecPreview(planFrec);
  // Banner con info del plan
  const bannerText=document.getElementById('sesFrecBannerText');
  const labels={3:'2 veces por semana (cada 3 días)',7:'1 vez por semana (cada 7 días)',14:'Quincenal (cada 14 días)',15:'Cada 15 días',21:'Cada 21 días',30:'Mensual (cada 30 días)'};
  if(bannerText){
    if(sv&&sv.frecuenciaPlan){
      bannerText.innerHTML='✨ <strong>Plan de '+p.nombre+'</strong>: '+(labels[planFrec]||'cada '+planFrec+' días');
    } else {
      bannerText.innerHTML='ℹ️ Sin plan configurado — se usará cada 21 días por defecto';
    }
  }
  // Ocultar override al abrir (sólo se muestra con click)
  const overrideEl=document.getElementById('sesFrecOverride');
  if(overrideEl) overrideEl.style.display='none';
  openModal('addSesModal');
}
function _toggleFrecOverride(){
  const el=document.getElementById('sesFrecOverride');
  if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
}
function selFrec(btn){
  document.querySelectorAll('.freq-btn').forEach(b=>b.classList.remove('freq-active'));
  btn.classList.add('freq-active');
  const customEl=document.getElementById('sesFrecCustom');
  if(customEl) customEl.value='';
  updateFrecPreview(parseInt(btn.dataset.dias));
}
function selFrecCustom(input){
  const val=parseInt(input.value);
  if(val>0){
    document.querySelectorAll('.freq-btn').forEach(b=>b.classList.remove('freq-active'));
    updateFrecPreview(val);
  }
}
function updateFrecPreview(dias){
  const prev=document.getElementById('sesFrecPreview');
  if(!prev) return;
  if(!dias||dias===0){ prev.style.display='none'; return; }
  const fechaEl=document.getElementById('sesFecha');
  const fecha=fechaEl?fechaEl.value:new Date().toISOString().split('T')[0];
  const next=addDays(fecha,dias);
  prev.style.display='block';
  prev.textContent='Próximo recordatorio: '+fmtDate(next)+' (en '+dias+' días)';
}
function saveNewSes(){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){ alert('Error: paciente no encontrado'); return; }
  const sv=p.servicios[_addSesSvi];
  const fechaEl=document.getElementById('sesFecha');
  const fecha=fechaEl&&fechaEl.value?fechaEl.value:new Date().toISOString().split('T')[0];
  const customEl=document.getElementById('sesFrecCustom');
  let frecDias=null;
  if(customEl&&parseInt(customEl.value)>0){
    frecDias=parseInt(customEl.value);
  } else {
    const activeBtn=document.querySelector('.freq-btn.freq-active');
    if(activeBtn) frecDias=parseInt(activeBtn.dataset.dias)||null;
  }
  if(frecDias===0) frecDias=null;
  const sesion={fecha:fecha,creadoEn:new Date().toISOString().split('T')[0],rate:'',pulse:'',cm2:'',asistio:false,plan:sv.plan||'Sesión',atencion:'',comentarios:''};
  if(frecDias) sesion.frecuencia_dias=frecDias;
  // Auto-asignar al paquete activo si existe
  const zona=sv.zonas[_addSesZi];
  const paqActivo=_zoneActivePaquete(zona);
  if(paqActivo) sesion.paqueteId=paqActivo.id;
  sv.zonas[_addSesZi].sesiones.push(sesion);
  _logSave('Sesión agregada', p.nombre+' '+p.apellido+' · '+(sv.nombre||sv.servicio||'')+' · '+(sv.zonas[_addSesZi].nombre||'zona'));
  save();
  closeModal('addSesModal');
  renderZones(p,sv,_addSesSvi);
  renderStats();
}
function delSes(svi,zi,si){
  if(_workerGuard('eliminar sesiones','eliminarSesiones')) return;
  if(!confirm('⚠️ ¿Estás segura de eliminar esta sesión?')) return;
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){ alert('Error: paciente no encontrado'); return; }
  p.servicios[svi].zonas[zi].sesiones.splice(si,1);
  save();
  renderZones(p,p.servicios[svi],svi);
  renderStats();
  // No renderPatients() con modal abierto
}
function delZone(svi,zi){
  if(_workerGuard('eliminar zonas','eliminarZonas')) return;
  if(!confirm('⚠️ ¿Estás segura de eliminar esta zona y todas sus sesiones?')) return;
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){ alert('Error: paciente no encontrado'); return; }
  p.servicios[svi].zonas.splice(zi,1);
  save();
  renderZones(p,p.servicios[svi],svi);
  renderStats();
}
function deleteSvc(svId){
  if(_workerGuard('eliminar servicios','eliminarServicios')) return;
  if(!confirm('⚠️ ¿Estás segura de eliminar este servicio y todas sus sesiones?\n\nNo se puede deshacer.')) return;
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){ alert('Error: paciente no encontrado'); return; }
  p.servicios=p.servicios.filter(sv=>sv.id!=svId);
  save();
  renderSvcTabs(p);
  renderStats();
  // No renderPatients() con modal abierto
}

let _addZoneSvi=0;
function openAddZoneModal(svi){ getDetailPid(); _addZoneSvi=svi; const nameEl=document.getElementById('newZoneName'); if(nameEl)nameEl.value=''; openModal('addZoneModal'); }
function saveNewZone(){
  getDetailPid();
  const nameEl=document.getElementById('newZoneName');
  if(!nameEl){ alert('Error: formulario no disponible'); return; }
  const name=nameEl.value.trim();
  if(!name){alert('Ingresa el nombre de la zona.');return;}
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){alert('Error: cierra y vuelve a abrir la ficha.');return;}
  const sv=p.servicios[_addZoneSvi];
  if(!sv){alert('Error: no se encontró el servicio.');return;}
  if(!sv.zonas)sv.zonas=[];
  sv.zonas.push({nombre:name,estado:'activo',sesiones:[],creadoEn:new Date().toISOString().split('T')[0]});
  _logSave('Zona agregada', p.nombre+' '+p.apellido+' · '+(sv.nombre||sv.servicio||'')+' · '+name);
  save();
  // Cerrar modal sin disparar closeModal('patientDetailModal')
  document.getElementById('addZoneModal').classList.remove('open');
  renderZones(p,sv,_addZoneSvi);
  showToast('✅ Zona agregada','var(--sage-dark)');
}

// ===== ADD SERVICE TO PATIENT =====
function openAddSvcModal(){
  getDetailPid();
  const sel=document.getElementById('asSvc');
  if(sel){
    sel.innerHTML='<option value="">Seleccionar...</option>'+SERVICES().map(s=>`<option>${s}</option>`).join('');
    sel.onchange=_asFrecPlanAutoSet;
  }
  const fechaEl=document.getElementById('asFecha');
  const comEl=document.getElementById('asComentarios');
  if(fechaEl) fechaEl.value=new Date().toISOString().split('T')[0];
  if(comEl) comEl.value='';
  const frecSel=document.getElementById('asFrecuenciaPlan');
  if(frecSel){
    // Poblar con frecuencias configuradas
    let html='<option value="">Usar por defecto del servicio</option>';
    FRECUENCIAS().forEach(f=>{
      html+='<option value="'+f.dias+'">'+f.label+' (cada '+f.dias+' día'+(f.dias>1?'s':'')+')</option>';
    });
    html+='<option value="custom">Personalizado...</option>';
    frecSel.innerHTML=html;
    frecSel.value='';
  }
  const frecCustom=document.getElementById('asFrecuenciaCustom');
  if(frecCustom){frecCustom.style.display='none';frecCustom.value='';}
  const frecInfo=document.getElementById('asFrecInfo');
  if(frecInfo) frecInfo.style.display='none';
  // Si la paciente tiene pago inicial pendiente, mostrarlo
  const p=patients.find(x=>String(x.id)===String(currentPid));
  const pagoInfo=document.getElementById('asSvcPagoInfo');
  if(pagoInfo){
    const pi=p&&p._pagoInicial?p._pagoInicial:null;
    if(pi&&(pi.separacion>0||pi.precioTotal>0||pi.abonoHoy>0)){
      const totalPagado=(pi.separacion||0)+(pi.abonoHoy||0);
      const saldo=Math.max(0,(pi.precioTotal||0)-totalPagado);
      pagoInfo.innerHTML=`💰 <strong>Se aplicará el pago registrado al guardar:</strong><br>
        Precio total: S/${(pi.precioTotal||0).toFixed(2)} · Separación: S/${(pi.separacion||0).toFixed(2)} · Abono hoy: S/${(pi.abonoHoy||0).toFixed(2)} · <strong>Saldo pendiente: S/${saldo.toFixed(2)}</strong>`;
      pagoInfo.style.display='block';
    } else {pagoInfo.style.display='none';}
  }
  openModal('addSvcModal');
}
// === MODAL EDITAR FRECUENCIA DEL PLAN ===
let _planFrecPid=null,_planFrecSvId=null,_planFrecValor=null;
function openPlanFrecModal(pid,svId){
  const p=patients.find(x=>String(x.id)===String(pid));if(!p)return;
  const sv=(p.servicios||[]).find(x=>String(x.id)===String(svId));if(!sv)return;
  _planFrecPid=pid;_planFrecSvId=svId;
  _planFrecValor=sv.frecuenciaPlan||null;
  const info=document.getElementById('planFrecInfo');
  if(info)info.innerHTML='<strong>'+p.nombre+' '+p.apellido+'</strong> · '+sv.servicio+'<br>¿Cada cuánto viene esta paciente para este servicio?';
  const lock=document.getElementById('planFrecLaserLock');
  const isLaser=sv.servicio==='Depilación Láser';
  // Generar botones dinámicamente según las frecuencias configuradas
  const btnsEl=document.getElementById('planFrecBtns');
  if(btnsEl){
    btnsEl.innerHTML=FRECUENCIAS().map(f=>
      '<button type="button" class="freq-btn" data-dias="'+f.dias+'" onclick="_planFrecSel(this)">'+f.label+' <span style="font-size:0.7rem;opacity:0.7;">'+f.dias+'d</span></button>'
    ).join('');
  }
  document.querySelectorAll('#planFrecBtns .freq-btn').forEach(b=>{
    b.classList.remove('freq-active');
    if(isLaser&&b.dataset.dias!=='21') b.style.opacity='0.3';
    else b.style.opacity='';
  });
  if(lock) lock.style.display=isLaser?'block':'none';
  const customEl=document.getElementById('planFrecCustom');
  if(customEl) customEl.value='';
  if(_planFrecValor){
    const btn=document.querySelector('#planFrecBtns .freq-btn[data-dias="'+_planFrecValor+'"]');
    if(btn) btn.classList.add('freq-active');
    else if(customEl) customEl.value=_planFrecValor;
  } else if(isLaser){
    const btn=document.querySelector('#planFrecBtns .freq-btn[data-dias="21"]');
    if(btn) btn.classList.add('freq-active');
    _planFrecValor=21;
  }
  document.getElementById('planFrecModal').style.display='flex';
}
function closePlanFrecModal(){document.getElementById('planFrecModal').style.display='none';}
function _planFrecSel(btn){
  const p=patients.find(x=>String(x.id)===String(_planFrecPid));
  const sv=p?(p.servicios||[]).find(x=>String(x.id)===String(_planFrecSvId)):null;
  if(sv&&sv.servicio==='Depilación Láser'&&btn.dataset.dias!=='21')return;
  document.querySelectorAll('#planFrecBtns .freq-btn').forEach(b=>b.classList.remove('freq-active'));
  btn.classList.add('freq-active');
  _planFrecValor=parseInt(btn.dataset.dias);
  const custom=document.getElementById('planFrecCustom');
  if(custom) custom.value='';
}
function _planFrecCustom(input){
  const v=parseInt(input.value);
  if(v>0){
    document.querySelectorAll('#planFrecBtns .freq-btn').forEach(b=>b.classList.remove('freq-active'));
    _planFrecValor=v;
  }
}
function _planFrecClear(){
  _planFrecValor=null;
  document.querySelectorAll('#planFrecBtns .freq-btn').forEach(b=>b.classList.remove('freq-active'));
  const custom=document.getElementById('planFrecCustom');
  if(custom) custom.value='';
}
function _planFrecSave(){
  const p=patients.find(x=>String(x.id)===String(_planFrecPid));if(!p)return;
  const sv=(p.servicios||[]).find(x=>String(x.id)===String(_planFrecSvId));if(!sv)return;
  if(_planFrecValor){
    sv.frecuenciaPlan=_planFrecValor;
  } else {
    delete sv.frecuenciaPlan;
  }
  save();
  closePlanFrecModal();
  renderSvcTabs(p);
  renderStats();renderAlertsInicio&&renderAlertsInicio();renderAlerts&&renderAlerts();
  showToast('✅ Plan guardado','var(--sage-dark)');
}

// === FRECUENCIA DEL PLAN (selector) ===
function _asFrecPlanCheck(){
  const sel=document.getElementById('asFrecuenciaPlan');
  const custom=document.getElementById('asFrecuenciaCustom');
  const info=document.getElementById('asFrecInfo');
  if(!sel||!info)return;
  if(sel.value==='custom'){
    if(custom){custom.style.display='block';custom.focus();}
    info.style.display='none';
    return;
  }
  if(custom)custom.style.display='none';
  if(!sel.value){info.style.display='none';return;}
  const dias=parseInt(sel.value);
  const labels={3:'2 veces por semana',7:'Una vez por semana',14:'Cada 2 semanas',15:'Cada 15 días',21:'Cada 21 días',30:'Una vez al mes'};
  info.style.display='block';
  info.textContent='✨ La paciente vendrá '+(labels[dias]||'cada '+dias+' días')+'. Cada sesión nueva calculará automáticamente su próximo recordatorio.';
}
function _asFrecPlanAutoSet(){
  const svc=document.getElementById('asSvc').value;
  const sel=document.getElementById('asFrecuenciaPlan');
  if(!sel)return;
  if(svc==='Depilación Láser'){
    sel.value='21';
    sel.disabled=true;
  } else {
    sel.disabled=false;
  }
  _asFrecPlanCheck();
}

function saveNewSvc(){
  getDetailPid();
  const servicioEl=document.getElementById('asSvc');
  const cubiculoEl=document.getElementById('asCubiculo');
  if(!servicioEl || !cubiculoEl){ alert('Error: formulario no disponible'); return; }
  const servicio=servicioEl.value;
  const cubiculo=cubiculoEl.value;
  if(!servicio){alert('Selecciona un servicio.');return;}
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p){ alert('Error: paciente no encontrado'); return; }
  if(!p.servicios)p.servicios=[];
  const svcId=Date.now();
  const planEl=document.getElementById('asPlan');
  const fechaEl=document.getElementById('asFecha');
  const comentariosEl=document.getElementById('asComentarios');
  // Frecuencia del plan de la paciente
  const frecSel=document.getElementById('asFrecuenciaPlan');
  const frecCustom=document.getElementById('asFrecuenciaCustom');
  let frecuenciaPlan=null;
  if(frecSel){
    if(frecSel.value==='custom'&&frecCustom&&parseInt(frecCustom.value)>0){
      frecuenciaPlan=parseInt(frecCustom.value);
    } else if(frecSel.value&&frecSel.value!=='custom'){
      frecuenciaPlan=parseInt(frecSel.value);
    }
  }
  // Láser siempre 21 días
  if(servicio==='Depilación Láser') frecuenciaPlan=21;
  const newSvc={
    id:svcId,servicio,cubiculo,
    plan:planEl ? planEl.value : 'Sesión',
    fechaInicio:fechaEl ? fechaEl.value : new Date().toISOString().split('T')[0],
    comentarios:comentariosEl ? comentariosEl.value : '',
    zonas:[]
  };
  if(frecuenciaPlan) newSvc.frecuenciaPlan=frecuenciaPlan;
  // Aplicar pago inicial si existe
  const pi=p._pagoInicial;
  if(pi&&(pi.separacion>0||pi.precioTotal>0||pi.abonoHoy>0)){
    const abonos=[];
    if(pi.abonoHoy>0){
      abonos.push({monto:pi.abonoHoy,fecha:document.getElementById('asFecha').value,desc:'Abono del día de la cita'});
    }
    newSvc.pago={
      precioTotal:pi.precioTotal||0,
      separacion:pi.separacion||0,
      abonos,
      notas:'Pago registrado al crear la ficha'
    };
    // Limpiar pago inicial para que no se aplique dos veces
    delete p._pagoInicial;
  }
  p.servicios.push(newSvc);
  _logSave('Servicio agregado', p.nombre+' '+p.apellido+' · '+servicio);
  save();
  // Cerrar solo este modal sin efectos secundarios
  document.getElementById('addSvcModal').classList.remove('open');
  renderSvcTabs(p);renderStats();renderAlerts();renderPatients();
  showToast('✅ Servicio agregado','#6a9e7a');
}

function openEditFromDetail(){
  getDetailPid();
  const pidToEdit=currentPid;
  // Flush any pending session debounce before closing
  if(_updSesTimer){ clearTimeout(_updSesTimer); _updSesTimer=null; save(); }
  document.getElementById('patientDetailModal').classList.remove('open');
  openEditPatient(pidToEdit);
}

// ===== EDIT / DELETE PATIENT =====
let _editPid=null;
function openEditPatient(id){
  const sid=String(id);
  const p=patients.find(x=>String(x.id)===sid);if(!p)return;
  _editPid=sid;
  document.getElementById('eNombre').value=p.nombre||'';
  document.getElementById('eApellido').value=p.apellido||'';
  document.getElementById('eTel').value=p.telefono||'';
  document.getElementById('eFecha').value=p.fechaInicio||'';
  document.getElementById('eComentarios').value=p.comentarios||'';
  openModal('editPatientModal');
}
function saveEditPatient(){
  const nombreEl=document.getElementById('eNombre');
  const apellidoEl=document.getElementById('eApellido');
  if(!nombreEl || !apellidoEl){ alert('Error: formulario no disponible'); return; }
  const nombre=nombreEl.value.trim();
  const apellido=apellidoEl.value.trim();
  if(!nombre||!apellido){alert('Completa nombre y apellido.');return;}
  const p=patients.find(x=>String(x.id)===String(_editPid));if(!p)return;
  p.nombre=nombre;p.apellido=apellido;
  const telEl=document.getElementById('eTel');
  const fechaEl=document.getElementById('eFecha');
  const comEl=document.getElementById('eComentarios');
  p.telefono=telEl ? telEl.value.trim() : '';
  p.fechaInicio=fechaEl ? fechaEl.value : '';
  p.comentarios=comEl ? comEl.value.trim() : '';
  p._updatedAt = new Date().toISOString(); // garantiza que local siempre gana el sync
  saveOne(p); // solo guarda esta paciente, no todas
  document.getElementById('editPatientModal').classList.remove('open');
  renderPatients();renderStats();renderAlertsInicio();renderStatsInicio();
  showToast('✅ Paciente actualizada','#6a9e7a');
  // Volver a abrir la ficha del paciente después de editar
  if(_editPid){ setTimeout(()=>openDetail(_editPid), 150); }
}
function _doDeletePatient(targetId){
  // Comparar como string Y como número para máxima compatibilidad
  const sid = String(targetId);
  const nid = Number(targetId);
  const antes = patients.length;
  patients = patients.filter(x => String(x.id) !== sid && Number(x.id) !== nid);
  const despues = patients.length;
  const eliminado = antes - despues;
  // Guardar directamente en localStorage sin ningún intermediario
  try {
    localStorage.setItem('ce_v3_patients', JSON.stringify(patients));
    localStorage.setItem('ce_v3_patients_ts', Date.now());
    // Registrar como eliminado para que el sync no lo re-agregue
    _trackDeletedId(targetId);
    // Eliminar de Supabase
    supaDeletePatient(targetId);
  } catch(e) { console.error('Error guardando:', e); }
  // Limpiar y rerenderizar
  const g = document.getElementById('patientsGrid');
  if(g) g.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:0.85rem;">Actualizando...</div>';
  setTimeout(function(){
    renderPatients();
    renderStats();
    if(typeof renderAlertsInicio==='function') renderAlertsInicio();
    if(typeof renderStatsInicio==='function') renderStatsInicio();
  }, 80);
  return eliminado > 0;
}

function confirmDeletePatient(){
  const sid = String(_editPid);
  const p = patients.find(x => String(x.id) === sid);
  if(!p){ showToast('No se encontró la paciente','#e08000'); return; }
  if(!confirm('\u26A0\uFE0F PRIMERA CONFIRMACIÓN\n\n¿Eliminar a: ' + p.nombre + ' ' + p.apellido + '?\n\nSe borrarán TODOS sus datos.')) return;
  if(!confirm('\u26A0\uFE0F CONFIRMACIÓN FINAL\n\n¿Segura de eliminar a ' + p.nombre + ' ' + p.apellido + '?\n\nNo se puede deshacer.')) return;
  if(typeof autoBackupSnapshot==='function') autoBackupSnapshot('Antes de eliminar: '+p.nombre+' '+p.apellido);
  ['editPatientModal','patientDetailModal'].forEach(function(mid){
    var m = document.getElementById(mid);
    if(m) m.style.display='none';
  });
  var ok = _doDeletePatient(_editPid);
  showToast(ok ? '\uD83D\uDDD1 ' + p.nombre + ' eliminada' : '\u26A0\uFE0F Error al eliminar', ok ? '#c46060' : '#e08000');
}

function deletePatient(id){
  if(_workerGuard('eliminar pacientes','eliminarPacientes')) return;
  const sid = String(id);
  const p = patients.find(x => String(x.id) === sid);
  if(!p){ showToast('No se encontró la paciente','#e08000'); return; }
  if(!confirm('\u26A0\uFE0F PRIMERA CONFIRMACIÓN\n\n¿Eliminar a: ' + p.nombre + ' ' + p.apellido + '?\n\nSe borrarán TODOS sus datos.')) return;
  if(!confirm('\u26A0\uFE0F CONFIRMACIÓN FINAL\n\n¿Segura de eliminar a ' + p.nombre + ' ' + p.apellido + '?\n\nNo se puede deshacer.')) return;
  if(typeof autoBackupSnapshot==='function') autoBackupSnapshot('Antes de eliminar: '+p.nombre+' '+p.apellido);
  var ok = _doDeletePatient(id);
  showToast(ok ? '\uD83D\uDDD1 ' + p.nombre + ' eliminada' : '\u26A0\uFE0F Error al eliminar', ok ? '#c46060' : '#e08000');
}

// Eliminar por índice del array (permite borrar duplicados uno a uno)
function deletePatientByIndex(idx){
  if(_workerGuard('eliminar pacientes','eliminarPacientes')) return;
  const p = patients[idx];
  if(!p){ showToast('No se encontró la paciente','#e08000'); return; }
  if(!confirm('\u26A0\uFE0F PRIMERA CONFIRMACIÓN\n\n¿Eliminar a: ' + p.nombre + ' ' + p.apellido + '?\n\nSe borrarán TODOS sus datos.')) return;
  if(!confirm('\u26A0\uFE0F CONFIRMACIÓN FINAL\n\n¿Segura de eliminar a ' + p.nombre + ' ' + p.apellido + '?\n\nNo se puede deshacer.')) return;
  if(typeof autoBackupSnapshot==='function') autoBackupSnapshot('Antes de eliminar: '+p.nombre+' '+p.apellido);
  const nombre = p.nombre;
  const pid = p.id;
  patients.splice(idx, 1);
  try{
    localStorage.setItem('ce_v3_patients', JSON.stringify(patients));
    localStorage.setItem('ce_v3_patients_ts', Date.now());
    _trackDeletedId(pid);
    supaDeletePatient(pid);
  } catch(e){ console.error('Error guardando:',e); }
  const g = document.getElementById('patientsGrid');
  if(g) g.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:0.85rem;">Actualizando...</div>';
  setTimeout(function(){
    renderPatients();
    renderStats();
    if(typeof renderAlertsInicio==='function') renderAlertsInicio();
    if(typeof renderStatsInicio==='function') renderStatsInicio();
  }, 80);
  ['patientDetailModal','editPatientModal'].forEach(function(mid){
    var m=document.getElementById(mid); if(m) m.classList.remove('open');
  });
  showToast('\uD83D\uDDD1 ' + nombre + ' eliminada', '#c46060');
}
// ===== AUTO BACKUP SYSTEM =====
// Guarda snapshot automático en localStorage. Últimas 15 versiones.
function autoBackupSnapshot(label){
  // Deshabilitado — Supabase guarda todo en tiempo real
  // No guardamos copias en localStorage para no llenarlo
}

// Auto-snapshot debounced al hacer cambios importantes (no redeclara save)
function triggerAutoBackup(){
  clearTimeout(window._autoBackupTimer);
  window._autoBackupTimer=setTimeout(()=>autoBackupSnapshot('Guardado automático'),4000);
}

function openBackupHistory(){
  let history=[];
  try{history=JSON.parse(localStorage.getItem('elle_backups')||'[]');}catch(e){}
  let rows='';
  if(!history.length){
    rows='<p style="color:#999;padding:16px;text-align:center;">No hay respaldos automáticos aún.</p>';
  } else {
    rows=history.map((s,i)=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border);font-size:0.83rem;">
        <div>
          <div style="font-weight:600;color:var(--text);">${s.ts}</div>
          <div style="color:var(--text-light);font-size:0.77rem;">${s.label} · ${(s.patients||[]).length} pacientes</div>
        </div>
        <button onclick="restoreFromHistory(${i})" class="btn btn-secondary" style="font-size:0.76rem;padding:5px 12px;">↩ Restaurar</button>
      </div>`).join('');
  }
  document.getElementById('backupHistoryList').innerHTML=rows;
  openModal('backupHistoryModal');
}

function restoreFromHistory(idx){
  let history=[];
  try{history=JSON.parse(localStorage.getItem('elle_backups')||'[]');}catch(e){}
  const snap=history[idx];
  if(!snap)return;
  if(!confirm(`¿Restaurar el respaldo del ${snap.ts}?\n\n"${snap.label}"\n\nSe reemplazarán los datos actuales.`))return;
  patients=snap.patients||[];
  if(snap.preCitas){preCitas=snap.preCitas;savePC();}
  if(snap.registros){registros=snap.registros;saveReg();}
  localStorage.setItem('ce_v3_patients',JSON.stringify(patients));
  closeModal('backupHistoryModal');
  renderAll();
  showToast('✅ Datos restaurados desde respaldo','#6a9e7a');
}

// ===== NEW PATIENT =====
let _npPcId = null; // pre-cita seleccionada para nueva paciente

function openNewPatientModal(){
  _npPcId = null;
  // Reset form
  ['nNombre','nApellido','nTel','nComentarios','nSeparacion','nPrecioTotal','nAbonoHoy'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.value='';
  });
  const sch=document.getElementById('nSaldoCalc'); if(sch)sch.value='';
  const sr=document.getElementById('nResumenPago'); if(sr){sr.style.display='none';sr.innerHTML='';}
  const card=document.getElementById('npPcCard'); if(card)card.style.display='none';
  const srch=document.getElementById('npPcSearch'); if(srch)srch.value='';
  document.getElementById('nFecha').value=new Date().toISOString().split('T')[0];
  openModal('newPatientModal');
}

function searchPcForPatient(q){
  const drop=document.getElementById('npPcDrop');
  if(!q.trim()){drop.style.display='none';return;}
  const res=preCitas.filter(pc=>
    `${pc.nombre} ${pc.apellido}`.toLowerCase().includes(q.toLowerCase()) &&
    pc.estado!=='cancelada' && !pc.convertidoAId
  ).slice(0,6);
  if(!res.length){
    drop.innerHTML='<div style="padding:10px 14px;font-size:0.83rem;color:var(--text-light);">Sin pre-citas disponibles</div>';
    drop.style.display='block'; return;
  }
  drop.innerHTML=res.map(pc=>`
    <div onclick="selectNpPc(${pc.id})" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.84rem;transition:background 0.15s;"
      onmouseover="this.style.background='var(--cream)'" onmouseout="this.style.background='white'">
      <div style="font-weight:600;">${pc.nombre} ${pc.apellido}
        <span class="estado-badge ${pc.estado}" style="margin-left:6px;">${pc.estado==='confirmada'?'✅ Confirmada':'⏳ Pendiente'}</span>
      </div>
      <div style="font-size:0.77rem;color:var(--text-light);margin-top:2px;">
        ${pc.servicio} · Cub.${pc.cubiculo}
        ${pc.separacion>0?` · <strong style="color:var(--green);">Sep. S/${pc.separacion.toFixed(2)}</strong>`:''}
        ${pc.fechaTentativa?` · ${fmtDate(pc.fechaTentativa)}`:''}
      </div>
    </div>`).join('');
  drop.style.display='block';
}

function selectNpPc(id){
  const pc=preCitas.find(x=>String(x.id)===String(id)); if(!pc)return;
  _npPcId=id;
  // Llenar campos con datos de la pre-cita
  document.getElementById('nNombre').value=pc.nombre||'';
  document.getElementById('nApellido').value=pc.apellido||'';
  document.getElementById('nTel').value=pc.telefono||'';
  if(pc.fechaTentativa)document.getElementById('nFecha').value=pc.fechaTentativa;
  if(pc.notas)document.getElementById('nComentarios').value=pc.notas;
  if(pc.separacion>0)document.getElementById('nSeparacion').value=pc.separacion.toFixed(2);
  // Cerrar dropdown
  document.getElementById('npPcDrop').style.display='none';
  document.getElementById('npPcSearch').value='';
  // Mostrar tarjeta de confirmación
  const card=document.getElementById('npPcCard');
  const info=document.getElementById('npPcCardInfo');
  card.style.display='block';
  info.innerHTML=`✅ <strong>Pre-cita cargada:</strong> ${pc.nombre} ${pc.apellido} · ${pc.servicio} · Cub.${pc.cubiculo}
    ${pc.separacion>0?`<br><strong>Separación registrada: S/${pc.separacion.toFixed(2)}</strong> — ya aparece en el pago del día`:''}
    ${pc.fechaTentativa?`<br>Fecha tentativa: ${fmtDate(pc.fechaTentativa)}`:''}`;
  calcNpSaldo();
}

function clearNpPc(){
  _npPcId=null;
  document.getElementById('npPcCard').style.display='none';
  document.getElementById('npPcSearch').value='';
  ['nNombre','nApellido','nTel','nComentarios','nSeparacion'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.value='';
  });
  calcNpSaldo();
}

function calcNpSaldo(){
  const sep=parseFloat(document.getElementById('nSeparacion')?.value||0)||0;
  const total=parseFloat(document.getElementById('nPrecioTotal')?.value||0)||0;
  const abono=parseFloat(document.getElementById('nAbonoHoy')?.value||0)||0;
  const saldo=Math.max(0, total - sep - abono);
  const sc=document.getElementById('nSaldoCalc');
  if(sc) sc.value=total>0?`S/ ${saldo.toFixed(2)}`:'';
  const res=document.getElementById('nResumenPago');
  if(res&&total>0){
    const totalPagado=sep+abono;
    res.innerHTML=`Total pagado hoy: <strong>S/${totalPagado.toFixed(2)}</strong>
      (Sep. S/${sep.toFixed(2)} + Abono S/${abono.toFixed(2)})
      · Saldo: <strong style="color:${saldo>0?'var(--red)':'var(--green)'};">S/${saldo.toFixed(2)}</strong>`;
    res.style.display='block';
  } else if(res){res.style.display='none';}
}

function saveNewPatient(){
  const nombre=document.getElementById('nNombre').value.trim();
  const apellido=document.getElementById('nApellido').value.trim();
  const tel=document.getElementById('nTel').value.trim();
  if(!nombre||!apellido){
    showToast('Completa nombre y apellido.','#c46060');
    return;
  }
  // Teléfono: mínimo 6 dígitos, solo números y + opcional al inicio
  const telClean=tel.replace(/\s+/g,'');
  const telRe=/^\+?\d{6,15}$/;
  if(telClean && !telRe.test(telClean)){
    showToast('Teléfono inválido. Usa solo números y opcional +.','#c46060');
    return;
  }
  const p={
    id:Date.now()+'_'+Math.random().toString(36).slice(2,7),nombre,apellido,
    telefono:telClean,
    fechaInicio:document.getElementById('nFecha').value,
    creadoEn:new Date().toISOString().split('T')[0],
    comentarios:document.getElementById('nComentarios').value.trim(),
    fotos:[],servicios:[],
    precitaId:_npPcId||null,
    // Guardar datos de pago pendiente para aplicar al primer servicio
    _pagoInicial:(()=>{
      const sep=parseFloat(document.getElementById('nSeparacion')?.value||0)||0;
      const tot=parseFloat(document.getElementById('nPrecioTotal')?.value||0)||0;
      const abo=parseFloat(document.getElementById('nAbonoHoy')?.value||0)||0;
      return (sep||tot||abo)?{separacion:sep,precioTotal:tot,abonoHoy:abo}:null;
    })()
  };
  patients.unshift(p);
  _logSave('Paciente nueva', p.nombre+' '+p.apellido+(p.telefono?' · '+p.telefono:''));
  save();

  // Marcar pre-cita como convertida
  if(_npPcId){
    const pc=preCitas.find(x=>x.id===_npPcId);
    if(pc){pc.convertidoAId=p.id;pc.estado='confirmada';savePC();}
  }

  closeModal('newPatientModal');
  currentPid=String(p.id);
  const _modal=document.getElementById('patientDetailModal');
  if(_modal) _modal.dataset.pid=String(p.id);
  ['nNombre','nApellido','nTel','nComentarios'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderPatients();renderStats();
  openDetail(p.id);
  setTimeout(()=>openAddSvcModal(),600);
  showToast('✅ Paciente guardada. Agrega su primer servicio.','#6a9e7a');
}

// ===== PHOTOS =====
let _photoViewerIdx = 0;
function renderPhotos(p){
  const g=document.getElementById('photoGrid');
  const fotos=p.fotos||[];
  let h=fotos.map((src,i)=>`<div class="photo-box" style="cursor:zoom-in;" onclick="viewPhotoPopup('${p.id}',${i})"><img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;pointer-events:none;" draggable="false"></div>`).join('');
  g.innerHTML=h;
  const dlBtn=document.getElementById('downloadAllPhotosBtn');
  if(dlBtn) dlBtn.style.display=fotos.length?'inline-flex':'none';
  const pi=document.getElementById('photoInput');
  const cc=document.getElementById('cameraInputCapture');
  const cf=document.getElementById('cameraInputFile');
  if(pi)pi.value='';
  if(cc)cc.value='';
  if(cf)cf.value='';
}
function openCameraCapture(){
  // Show source modal
  const m = document.getElementById("photoSourceModal");
  if(m){ m.style.display="flex"; }
}
function closePhotoSourceModal(){
  const m = document.getElementById("photoSourceModal");
  if(m) m.style.display="none";
}
function triggerCameraCapture(){
  closePhotoSourceModal();
  const ci = document.getElementById("cameraInputCapture");
  if(ci){ ci.value=""; ci.click(); }
}
function triggerGalleryPick(){
  closePhotoSourceModal();
  const pi = document.getElementById("cameraInputFile");
  if(pi){ pi.value=""; pi.click(); }
}
// MOVED TO config.js — MAX_FOTOS_POR_PACIENTE

async function handlePhoto(e){
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p)return;
  if(!p.fotos)p.fotos=[];

  const files = Array.from(e.target.files);
  let ok=0, fallos=0, usedBase64=0;
  showToast('⏳ Subiendo '+files.length+' foto'+(files.length>1?'s':'')+'...','var(--text-light)',3000);

  // Procesar una por una para guardar después de cada foto
  for(let idx=0; idx<files.length; idx++){
    try{
      const {blob,dataUrl}=await _compressToBlob(files[idx]);
      const url=await _uploadPhotoToStorage(blob,p.id,idx);
      if(url){ p.fotos.push(url); ok++; }
      else { p.fotos.push(dataUrl); usedBase64++; }
      // Guardar después de CADA foto
      try{ localStorage.setItem('ce_v3_patients', JSON.stringify(patients)); }catch(e){}
      await supaUpsertPatient(p).catch(err=>{console.error('Upsert falló:',err);fallos++;});
      renderPhotos(p);
    }catch(err){
      console.error('Error en foto '+idx+':',err);
      fallos++;
    }
  }
  if(fallos===0&&usedBase64===0) showToast('✅ '+ok+' foto'+(ok>1?'s':'')+' en la nube','#6a9e7a',4000);
  else if(fallos>0) showToast('⚠️ '+ok+' subidas, '+fallos+' con error. Revisa conexión.','#c46060',5000);
  else if(usedBase64>0) showToast('⚠️ '+ok+' en nube, '+usedBase64+' local. Storage falló.','#c47a00',5000);
}
function viewPhotoPopup(pid, idx){
  currentPid=pid;
  // Sync dataset so getDetailPid() stays consistent
  const modal=document.getElementById('patientDetailModal');
  if(modal) modal.dataset.pid=String(pid);
  openPhotoViewer(idx);
}
function _pvSlide(dir){
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p||!p.fotos)return;
  const newIdx=Math.max(0,Math.min(p.fotos.length-1,_photoViewerIdx+dir));
  if(newIdx===_photoViewerIdx)return;
  const img=document.getElementById('photoViewerImg');
  if(!img)return;
  img.style.transition='transform 0.18s ease,opacity 0.18s ease';
  img.style.transform='translateX('+(dir<0?'80px':'-80px')+')';
  img.style.opacity='0';
  setTimeout(function(){
    _photoViewerIdx=newIdx;
    img.src=p.fotos[_photoViewerIdx]||'';
    img.style.transition='none';
    img.style.transform='translateX('+(dir<0?'-80px':'80px')+')';
    img.style.opacity='0';
    requestAnimationFrame(function(){requestAnimationFrame(function(){
      img.style.transition='transform 0.18s ease,opacity 0.18s ease';
      img.style.transform='translateX(0)';
      img.style.opacity='1';
    });});
    var counter=document.getElementById('photoViewerCounter');
    if(counter)counter.textContent=(_photoViewerIdx+1)+' / '+p.fotos.length;
    _updatePhotoViewerNav(p.fotos);
  },180);
}
function openPhotoViewer(idx){
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p||!p.fotos||!p.fotos.length)return;
  _photoViewerIdx=idx;
  closePhotoViewer();
  const fotos=p.fotos;
  const overlay=document.createElement('div');
  overlay.id='photoViewerModal';
  overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:2147483647;overflow:hidden;user-select:none;';
  overlay.innerHTML=`
    <button onclick="closePhotoViewer()" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.2);border:none;color:white;font-size:1.4rem;width:44px;height:44px;border-radius:50%;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;">✕</button>
    <button id="photoViewerPrev" onclick="_pvSlide(-1)" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:white;font-size:2rem;width:50px;height:50px;border-radius:50%;cursor:pointer;z-index:10;">‹</button>
    <img id="photoViewerImg" src="${fotos[idx]||''}" style="max-width:92vw;max-height:78vh;border-radius:10px;object-fit:contain;cursor:grab;transition:transform 0.18s ease,opacity 0.18s ease;">
    <div style="display:flex;gap:12px;margin-top:14px;align-items:center;z-index:10;">
      <span id="photoViewerCounter" style="color:rgba(255,255,255,0.6);font-size:0.82rem;">${idx+1} / ${fotos.length}</span>
      <button onclick="deleteCurrentPhoto()" style="background:rgba(196,96,96,0.3);border:1px solid rgba(196,96,96,0.5);color:#ff9090;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:0.82rem;">Eliminar foto</button>
    </div>
    <button id="photoViewerNext" onclick="_pvSlide(1)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:white;font-size:2rem;width:50px;height:50px;border-radius:50%;cursor:pointer;z-index:10;">›</button>
  `;
  overlay.addEventListener('click',function(e){if(e.target===overlay)closePhotoViewer();});

  // Arrastre con mouse (desktop) y swipe táctil (móvil)
  var dragStartX=0, dragging=false, moved=false;
  overlay.addEventListener('mousedown',function(e){
    if(e.target.closest('button'))return;
    dragStartX=e.clientX; dragging=true; moved=false;
    e.preventDefault();
  });
  document.addEventListener('mousemove',function pvMove(e){
    if(!dragging)return;
    if(Math.abs(e.clientX-dragStartX)>8)moved=true;
  });
  document.addEventListener('mouseup',function pvUp(e){
    if(!dragging)return;
    dragging=false;
    var dx=e.clientX-dragStartX;
    if(moved&&Math.abs(dx)>50)_pvSlide(dx<0?1:-1);
    // limpiar listeners cuando se cierra
    if(!document.getElementById('photoViewerModal')){
      document.removeEventListener('mousemove',pvMove);
      document.removeEventListener('mouseup',pvUp);
    }
  });

  var touchStartX=0,touchStartY=0;
  overlay.addEventListener('touchstart',function(e){
    touchStartX=e.touches[0].clientX;
    touchStartY=e.touches[0].clientY;
  },{passive:true});
  overlay.addEventListener('touchend',function(e){
    var dx=e.changedTouches[0].clientX-touchStartX;
    var dy=e.changedTouches[0].clientY-touchStartY;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40)_pvSlide(dx<0?1:-1);
  },{passive:true});

  document.body.appendChild(overlay);
  _updatePhotoViewerNav(fotos);
}
function _updatePhotoViewer(p){
  const fotos=p.fotos||[];
  const img=document.getElementById('photoViewerImg');
  const counter=document.getElementById('photoViewerCounter');
  if(img)img.src=fotos[_photoViewerIdx]||'';
  if(counter)counter.textContent=`${_photoViewerIdx+1} / ${fotos.length}`;
  _updatePhotoViewerNav(fotos);
}
function _updatePhotoViewerNav(fotos){
  const prev=document.getElementById('photoViewerPrev');
  const next=document.getElementById('photoViewerNext');
  if(prev)prev.style.opacity=_photoViewerIdx>0?'1':'0.25';
  if(next)next.style.opacity=_photoViewerIdx<fotos.length-1?'1':'0.25';
}
function photoViewerNav(dir){
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p||!p.fotos)return;
  _photoViewerIdx=Math.max(0,Math.min(p.fotos.length-1,_photoViewerIdx+dir));
  _updatePhotoViewer(p);
}
async function _savePhotoWithDialog(src, filename){
  // Convert base64 to blob
  const parts=src.split(',');
  const mime=parts[0].match(/:(.*?);/)[1];
  const byteStr=atob(parts[1]);
  const ab=new ArrayBuffer(byteStr.length);
  const ia=new Uint8Array(ab);
  for(let i=0;i<byteStr.length;i++) ia[i]=byteStr.charCodeAt(i);
  const blob=new Blob([ab],{type:mime});

  // Try File System Access API (Chrome — shows native Save dialog)
  if(window.showSaveFilePicker){
    try{
      const fh=await window.showSaveFilePicker({
        suggestedName: filename,
        types:[{description:'Imagen JPEG',accept:{'image/jpeg':['.jpg','.jpeg']}}]
      });
      const ws=await fh.createWritable();
      await ws.write(blob);
      await ws.close();
      showToast('✅ Foto guardada','#6a9e7a');
      return;
    }catch(e){
      if(e.name==='AbortError') return; // user cancelled
    }
  }
  // Fallback: blob URL download
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename; a.style.display='none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  showToast('✅ Foto descargada','#6a9e7a');
}
function downloadCurrentPhoto(){
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p||!p.fotos||!p.fotos[_photoViewerIdx])return;
  const nombre=(p.nombre||'paciente').replace(/[^a-zA-Z0-9 ]/g,'').trim().replace(/ +/g,'-').toLowerCase();
  _savePhotoWithDialog(p.fotos[_photoViewerIdx], nombre+'-foto-'+(_photoViewerIdx+1)+'.jpg');
}
async function downloadAllPhotos(){
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p||!p.fotos||!p.fotos.length)return;
  const nombre=(p.nombre||'paciente').replace(/[^a-zA-Z0-9 ]/g,'').trim().replace(/ +/g,'-').toLowerCase();
  for(let i=0;i<p.fotos.length;i++){
    await _savePhotoWithDialog(p.fotos[i], nombre+'-foto-'+(i+1)+'.jpg');
  }
}
function closePhotoViewer(){
  const m=document.getElementById('photoViewerModal');
  if(m)m.remove();
}
function deleteCurrentPhoto(){
  if(_workerGuard('eliminar fotos','eliminarFotos')) return;
  getDetailPid();
  const p=patients.find(x=>String(x.id)===String(currentPid));
  if(!p||!p.fotos)return;
  if(!confirm('⚠️ ¿Estás segura de eliminar esta foto?\n\nNo se puede recuperar.'))return;
  p.fotos.splice(_photoViewerIdx,1);
  save();
  if(p.fotos.length===0){closePhotoViewer();renderPhotos(p);return;}
  _photoViewerIdx=Math.min(_photoViewerIdx,p.fotos.length-1);
  _updatePhotoViewer(p);
  renderPhotos(p);
}

