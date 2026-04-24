// ── DB / Supabase ──────────────────────────────────

// ══════════════════════════════════════════════════════
// MÓDULO — Pacientes: lectura desde elle_patients + servicios/zonas/sesiones

async function initPatients(){
  try{
    const [pRes,sRes,zRes,seRes] = await Promise.all([
      supa.from('elle_patients').select('*'),
      supa.from('elle_services').select('*').order('fecha_inicio',{ascending:true}),
      supa.from('elle_zones').select('*').order('_orden_original',{ascending:true}),
      supa.from('elle_sessions').select('*').order('_orden_original',{ascending:true}),
    ]);
    if(pRes.error) throw pRes.error;
    if(sRes.error) throw sRes.error;
    if(zRes.error) throw zRes.error;
    if(seRes.error) throw seRes.error;

    const sessMap=new Map();
    for(const se of seRes.data||[]){ const a=sessMap.get(se.zone_id)||[]; a.push(se); sessMap.set(se.zone_id,a); }
    const zoneMap=new Map();
    for(const z of zRes.data||[]){ const a=zoneMap.get(z.service_id)||[]; a.push(z); zoneMap.set(z.service_id,a); }
    const svcMap=new Map();
    for(const s of sRes.data||[]){ const a=svcMap.get(s.patient_id)||[]; a.push(s); svcMap.set(s.patient_id,a); }

    patients=(pRes.data||[])
      .filter(p=>!_deletedPatientIds.has(String(p.id)))
      .map(p=>{
        const servicios=(svcMap.get(p.id)||[]).map(s=>{
          const _dbZonas=(zoneMap.get(s.id)||[]).map(z=>{
            const sesiones=(sessMap.get(z.id)||[]).map(se=>Object.assign({},se.raw_json||{},{
              id:se.id, fecha:se.fecha||'', asistio:se.asistio||false, notas:se.notas||se.comentarios||'',
            }));
            return Object.assign({},z.raw_json||{},{id:z.id,nombre:z.nombre||'',estado:z.estado||'activa',sesiones});
          });
          // Si no hay zonas en DB (sync falló y las borró), recuperar desde raw_json del servicio
          const rp=s.raw_json||{};
          const zonas=_dbZonas.length>0?_dbZonas:(rp.zonas||[]);
          const pago=Object.assign({},rp.pago||{},{
            precioTotal:s.pago_precio_total!=null?parseFloat(s.pago_precio_total):(rp.pago&&rp.pago.precioTotal)||0,
            separacion:s.pago_separacion!=null?parseFloat(s.pago_separacion):(rp.pago&&rp.pago.separacion)||0,
          });
          return Object.assign({},rp,{id:s.id,servicio:s.servicio||'',cubiculo:s.cubiculo||'',plan:s.plan||'',fechaInicio:s.fecha_inicio||'',pago,zonas});
        });
        const prjp=p.raw_json||{};
        return Object.assign({},prjp,{id:p.id,nombre:p.nombre||'',apellido:p.apellido||'',telefono:p.telefono||'',creadoEn:p.fecha_inicio||prjp.creadoEn||prjp.fechaInicio||'',fechaInicio:p.fecha_inicio||prjp.fechaInicio||prjp.creadoEn||'',comentarios:p.comentarios||'',fotos:p.fotos||[],consentimiento:p.consentimiento||null,servicios});
      });
    // 🔁 Merge con cola de sync pendiente (datos que no llegaron a elle_* todavía)
    try{
      const syncQ=JSON.parse(localStorage.getItem('ce_elle_sync_q')||'[]')
        .filter(p=>!_deletedPatientIds.has(String(p.id)));
      if(syncQ.length){
        const pMap=new Map(patients.map(p=>[String(p.id),p]));
        for(const p of syncQ) pMap.set(String(p.id),p);
        patients=[...pMap.values()];
        syncQ.forEach(p=>_syncPatientToElle(p).catch(e=>console.warn('[retry elle]',e)));
        console.log('[initPatients] reintentando',syncQ.length,'syncs pendientes');
      }
    }catch(e){}
    // 🛡️ Safety-net: recuperar pacientes de tabla vieja que no llegaron a elle_*
    try{
      const elleIds=new Set(patients.map(p=>String(p.id)));
      const {data:oldRows}=await supa.from('patients').select('id,data');
      const faltantes=(oldRows||[]).filter(r=>r.data&&!elleIds.has(String(r.data.id||r.id))&&!_deletedPatientIds.has(String(r.data.id||r.id)));
      if(faltantes.length){
        const recuperados=faltantes.map(r=>r.data);
        recuperados.forEach(p=>{ patients.push(p); _syncPatientToElle(p).catch(e=>console.warn('[rescue sync]',e)); });
        console.warn('[initPatients] recuperados',faltantes.length,'pacientes de tabla vieja →',recuperados.map(p=>p.nombre));
      }
    }catch(e){}
    try{ localStorage.setItem('ce_v3_patients',JSON.stringify(patients)); localStorage.setItem('ce_v3_patients_ts',Date.now()); }catch(e){}
    console.log('[initPatients]',patients.length,'pacientes cargados desde elle_*');
  }catch(e){
    console.warn('initPatients: DB no disponible, usando localStorage',e);
    patients=JSON.parse(localStorage.getItem('ce_v3_patients')||'[]');
  }
}

async function _syncPatientToElle(p){
  const pid=String(p.id);
  try{
    // UPSERT paciente (nunca borrar — solo actualizar)
    await supa.from('elle_patients').upsert({id:pid,nombre:p.nombre||'',apellido:p.apellido||'',telefono:p.telefono||'',fecha_inicio:p.creadoEn||null,comentarios:p.comentarios||'',fotos:p.fotos||[],consentimiento:p.consentimiento||null,raw_json:p});
    // UPSERT servicios / zonas / sesiones (nunca borrar)
    for(let si=0;si<(p.servicios||[]).length;si++){
      const svc=p.servicios[si];
      const svcId=svc.id?String(svc.id):`${pid}_svc${si}`;
      await supa.from('elle_services').upsert({id:svcId,patient_id:pid,servicio:svc.servicio||'',cubiculo:svc.cubiculo||'',plan:svc.plan||'',pago_precio_total:svc.pago&&svc.pago.precioTotal!=null?svc.pago.precioTotal:null,pago_separacion:svc.pago&&svc.pago.separacion!=null?svc.pago.separacion:null,fecha_inicio:svc.fechaInicio||null,raw_json:svc});
      for(let zi=0;zi<(svc.zonas||[]).length;zi++){
        const z=svc.zonas[zi];
        const zId=z.id?String(z.id):`${svcId}_z${zi}`;
        await supa.from('elle_zones').upsert({id:zId,service_id:svcId,patient_id:pid,nombre:z.nombre||'',estado:z.estado||'activa',_estado_original:z.estado||'activa',_orden_original:zi,raw_json:z,source_path:`${svcId}_z${zi}`,source_hash:'manual'});
        const ses=z.sesiones||[];
        if(ses.length){
          await supa.from('elle_sessions').upsert(ses.map((se,sei)=>({id:se.id?String(se.id):`${zId}_s${sei}`,zone_id:zId,patient_id:pid,service_id:svcId,fecha:se.fecha||null,asistio:se.asistio||false,comentarios:se.notas||se.comentarios||'',_orden_original:sei,raw_json:se,source_path:`${svcId}_z${zi}_s${sei}`,source_hash:'manual'})));
        }
      }
    }
    // ✅ Éxito: quitar de la cola de pendientes
    try{
      const q=JSON.parse(localStorage.getItem('ce_elle_sync_q')||'[]');
      localStorage.setItem('ce_elle_sync_q',JSON.stringify(q.filter(x=>String(x.id)!==pid)));
    }catch(e2){}
  }catch(e){
    console.warn('[_syncPatientToElle]',pid,e);
    // ❌ Fallo: guardar en cola para reintentar al próximo load
    try{
      const q=JSON.parse(localStorage.getItem('ce_elle_sync_q')||'[]');
      const idx=q.findIndex(x=>String(x.id)===pid);
      if(idx>=0) q[idx]=p; else q.push(p);
      localStorage.setItem('ce_elle_sync_q',JSON.stringify(q));
    }catch(e2){}
  }
}

// Guardar un paciente en Supabase
async function supaUpsertPatient(p, retries=2){
  _addPending();
  p._updatedAt = new Date().toISOString();
  try{
    for(let i=0; i<=retries; i++){
      try{
        // Timeout 10s para no quedar colgado si la red es lenta
        const result = await Promise.race([
          supa.from('patients').upsert({id:String(p.id),data:p,updated_at:p._updatedAt}),
          new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout: Supabase no respondió en 10s')),10000))
        ]);
        // Supabase v2 no lanza excepciones — hay que revisar el objeto error
        if(result && result.error) throw result.error;
        _syncPatientToElle(p).catch(e=>console.warn('[bg elle sync]',e));
        return;
      } catch(e){
        if(i===retries){ console.error('Supabase upsert patient error (final):',e); setSyncState('error'); throw e; }
        await new Promise(r=>setTimeout(r,1000*(i+1)));
      }
    }
  } finally { _removePending(); }
}
// Eliminar un paciente en Supabase
// IDs de pacientes recientemente eliminados — evita que el sync los re-agregue
let _deletedPatientIds = new Set(
  JSON.parse(localStorage.getItem('ce_deleted_ids')||'[]')
);
function _trackDeletedId(id){
  _deletedPatientIds.add(String(id));
  try{ localStorage.setItem('ce_deleted_ids', JSON.stringify([..._deletedPatientIds])); }catch(e){}
}

async function supaDeletePatient(id){
  const sid = String(id);
  for(let attempt=0; attempt<3; attempt++){
    try{
      const {error}=await supa.from('patients').delete().eq('id',sid);
      if(error) throw error;
      try{ await supa.from('deleted_patients').upsert({id:sid}); }catch(e){}
      // Borrar también de elle_* (FK: sessions→zones→services→patients)
      try{
        await supa.from('elle_sessions').delete().eq('patient_id',sid);
        await supa.from('elle_zones').delete().eq('patient_id',sid);
        await supa.from('elle_services').delete().eq('patient_id',sid);
        await supa.from('elle_patients').delete().eq('id',sid);
      }catch(e){ console.warn('[elle delete patient]',e); }
      setSyncState('idle');
      return true;
    }catch(e){
      console.error('Supabase delete patient attempt '+(attempt+1)+':',e);
      if(attempt<2) await new Promise(r=>setTimeout(r,1500*(attempt+1)));
    }
  }
  setSyncState('error');
  showToast('⚠️ No se pudo eliminar en la nube. Se reintentará.','#c46060',5000);
  // Guardar para reintentar al reconectar
  try{
    const pending=JSON.parse(localStorage.getItem('ce_pending_deletes')||'[]');
    if(!pending.includes(sid)){ pending.push(sid); localStorage.setItem('ce_pending_deletes',JSON.stringify(pending)); }
  }catch(e){}
  return false;
}
// Reintentar eliminaciones pendientes que fallaron antes
async function supaRetryPendingDeletes(){
  try{
    const pending=JSON.parse(localStorage.getItem('ce_pending_deletes')||'[]');
    if(pending.length===0) return;
    const done=[];
    for(const sid of pending){
      const ok=await supaDeletePatient(sid);
      if(ok) done.push(sid);
    }
    if(done.length>0){
      const remaining=pending.filter(x=>!done.includes(x));
      localStorage.setItem('ce_pending_deletes',JSON.stringify(remaining));
      if(remaining.length===0) localStorage.removeItem('ce_pending_deletes');
    }
  }catch(e){ console.error('Retry pending deletes error:',e); }
}
// Cargar IDs eliminados globalmente desde Supabase
async function supaLoadDeletedIds(){
  try{
    const {data,error}=await _supaRace(supa.from('deleted_patients').select('id'));
    if(error)throw error;
    (data||[]).forEach(r=>_trackDeletedId(r.id));
  }catch(e){ console.error('Load deleted ids error:',e); }
}
// Guardar precios
async function supaSavePrecios(){
  _addPending();
  try{ await supa.from('config').upsert({key:'precios',value:preciosData,updated_at:new Date().toISOString()}); }
  catch(e){ console.error('Supabase savePrecios error:',e); setSyncState('error'); throw e; }
  finally{ _removePending(); }
}
async function supaSaveWaCustom(){
  try{ await supa.from('config').upsert({key:'waCustomMessages',value:waCustomCards,updated_at:new Date().toISOString()}); }
  catch(e){ console.error('Supabase saveWaCustom error:',e); setSyncState('error'); }
}
async function supaSavePcTemplates(){
  try{ await supa.from('config').upsert({key:'preCitaTemplates',value:preCitaTemplates,updated_at:new Date().toISOString()}); }
  catch(e){ console.error('Supabase savePcTemplates error:',e); setSyncState('error'); }
}
async function supaSaveWaTpls(){
  try{ await supa.from('config').upsert({key:'waTpls',value:waTpls,updated_at:new Date().toISOString()}); }
  catch(e){ console.error('Supabase saveWaTpls error:',e); setSyncState('error'); }
}
async function supaSaveWaSvcTpls(){
  try{ await supa.from('config').upsert({key:'waServiceTpls',value:waServiceTpls,updated_at:new Date().toISOString()}); }
  catch(e){ console.error('Supabase saveWaSvcTpls error:',e); setSyncState('error'); }
}
// Cargar config (precitas, registros, precios)
async function supaLoadConfig(key){
  try{
    const {data,error}=await _supaRace(supa.from('config').select('value').eq('key',key).single());
    if(error)return null;
    return data?.value||null;
  }catch(e){ return null; }
}

// Inicializar datos desde Supabase al cargar
async function initFromSupabase(){
  setSyncState('syncing');
  // Mostrar indicador de carga solo si no hay caché local
  const hasCache = patients.length > 0;
  if(!hasCache){
    showToast('⏳ Cargando datos...','#6a8c5a', 10000);
  } else {
    showToast('🔄 Actualizando desde la nube...','#6a8c5a');
  }
  let syncOk = true;
  try{
    await supaLoadDeletedIds(); // cargar IDs eliminados globalmente antes de merge
    await supaRetryPendingDeletes(); // reintentar deletes que fallaron antes
    // Cargar pacientes desde elle_patients + elle_services + elle_zones + elle_sessions
    await initPatients();

    // Cargar preCitas desde elle_precitas
    await initPreCitas();

    // Cargar registros desde elle_payments
    await initRegistros();

    // Cargar precios
    const remotePrecios = await supaLoadConfig('precios');
    if(remotePrecios !== null){
      preciosData = migratePrecios(remotePrecios)||preciosData;
      try{ localStorage.setItem('ellePrecios2',JSON.stringify(preciosData)); }catch(e){}
    }

    // Cargar plantillas WA principales
    const remoteWaTpls = await supaLoadConfig('waTpls');
    if(remoteWaTpls !== null){
      waTpls = remoteWaTpls;
      try{ localStorage.setItem('elleWaTpls',JSON.stringify(waTpls)); }catch(e){}
    }

    // Cargar plantillas WA por servicio
    const remoteWaSvcTpls = await supaLoadConfig('waServiceTpls');
    if(remoteWaSvcTpls !== null){
      waServiceTpls = remoteWaSvcTpls;
      try{ localStorage.setItem('elleWaSvcTpls',JSON.stringify(waServiceTpls)); }catch(e){}
    }

    // Cargar mensajes WhatsApp personalizados
    const remoteWaCustom = await supaLoadConfig('waCustomMessages');
    if(remoteWaCustom !== null){
      waCustomCards = remoteWaCustom;
      try{ localStorage.setItem('elleWaCustom',JSON.stringify(waCustomCards)); }catch(e){}
    }

    // Cargar plantillas pre-cita WhatsApp
    const remotePcTemplates = await supaLoadConfig('preCitaTemplates');
    if(remotePcTemplates !== null){
      preCitaTemplates = Object.assign({}, PC_TPL_DEFAULTS, remotePcTemplates);
      try{ localStorage.setItem('ellePcTemplates',JSON.stringify(preCitaTemplates)); }catch(e){}
    }

    // Cargar configuración
    const remoteConfig = await supaLoadConfig('appConfig');
    if(remoteConfig !== null){
      appConfig = Object.assign({}, DEFAULT_CONFIG, remoteConfig);
      try{ localStorage.setItem('ce_v3_config', JSON.stringify(appConfig)); }catch(e){}
      applyConfigToUI();
      // Si hay un usuario worker activo, re-aplicar permisos con los datos fresh
      if(currentRole==='worker'&&typeof disableDeleteButtons==='function') disableDeleteButtons();
    } else {
      applyConfigToUI();
    }

    // === MIGRACIÓN UNA SOLA VEZ: normalizar nombres de servicios a Title Case ===
    if(!appConfig._svcNamesNormalizedV2){
      const oldList=[...(appConfig.services||[])];
      const newList=oldList.map(s=>tcase(s));
      const renameMap={};
      for(let i=0;i<oldList.length;i++){
        if(oldList[i]!==newList[i]) renameMap[oldList[i]]=newList[i];
      }
      let changed=false;
      if(Object.keys(renameMap).length){
        appConfig.services=newList;
        patients.forEach(p=>{
          (p.servicios||[]).forEach(sv=>{
            if(renameMap[sv.servicio]){ sv.servicio=renameMap[sv.servicio]; changed=true; }
          });
        });
      }
      appConfig._svcNamesNormalizedV2=true;
      try{ localStorage.setItem('ce_v3_config', JSON.stringify(appConfig)); }catch(e){}
      try{ await supa.from('config').upsert({key:'appConfig',value:appConfig,updated_at:new Date().toISOString()}); }catch(e){}
      if(changed){ try{ localStorage.setItem('ce_v3_patients', JSON.stringify(patients)); }catch(e){} save(); }
      // Re-aplicar UI después de la migración
      try{ applyConfigToUI(); if(typeof renderAll==='function') renderAll(); }catch(e){}
      if(Object.keys(renameMap).length||changed){
        showToast('✅ Nombres de servicios normalizados','var(--sage-dark)');
      }
    }

    // Cargar citas desde elle_appointments (fuente única multi-dispositivo)
    await initCitas();

    // Cargar checks de agendadas
    const agKey = _agendaCheckKey();
    const remoteAgendadas = await supaLoadConfig('agendadas_'+agKey);
    if(remoteAgendadas !== null){
      try{ localStorage.setItem(agKey, JSON.stringify(remoteAgendadas)); }catch(e){}
    }
  }catch(e){
    console.error('Error en initFromSupabase',e);
    syncOk = false;
  }finally{
    renderAll();
    if(syncOk){
      setSyncState('idle');
      showToast('✅ Datos sincronizados','#6a8c5a');
    } else {
      setSyncState('error');
      showToast('⚠️ Sin conexión a Supabase — usando datos locales','#e08000');
    }
  }
}

// Refresco manual desde el encabezado
async function manualRefreshData(){
  await initFromSupabase();
  renderAll();
}

// ══════════════════════════════════════════════════════
// MÓDULO 1 — Citas: fuente única elle_appointments
// ══════════════════════════════════════════════════════

function _normalizeCita(row){
  return {
    id:         row.id,
    fecha:      row.fecha       || '',
    hora:       row.hora        || '',
    cubiculo:   row.cubiculo    || '01',
    nombre:     row.nombre      || '',
    apellido:   row.apellido    || '',
    telefono:   row.telefono    || '',
    servicio:   row.servicio    || '',
    notas:      row.notas       || '',
    origenTipo: row.origen_tipo || 'nuevo',
    origenId:   row.origen_id   || null,
    asistio:    row.asistio     || false,
  };
}

function _upsertCitaArr(cita){
  const idx = window._citasArr.findIndex(c => c.id === cita.id);
  if(idx >= 0) window._citasArr[idx] = cita;
  else window._citasArr.push(cita);
}

function _removeCitaArr(id){
  window._citasArr = window._citasArr.filter(c => c.id !== id);
}

function _renderCitasViews(){
  renderAgendaHoy();
  if(document.getElementById('mesInternoGrid')) renderMesInterno();
  if(document.getElementById('agendaSemanalGrid')) renderAgendaSemanal();
}

let _realtimeCitasSub = null;
function _subscribeRealtimeCitas(){
  if(_realtimeCitasSub) return;
  _realtimeCitasSub = supa
    .channel('elle_appointments_live')
    .on('postgres_changes',
        {event:'*', schema:'public', table:'elle_appointments'},
        payload => {
          const { eventType, new: n, old: o } = payload;
          if(eventType === 'INSERT' || eventType === 'UPDATE'){
            _upsertCitaArr(_normalizeCita(n));
          } else if(eventType === 'DELETE'){
            _removeCitaArr(o.id);
          }
          _renderCitasViews();
        })
    .subscribe();
}

async function initCitas(){
  try{
    const { data, error } = await supa
      .from('elle_appointments')
      .select('*')
      .order('fecha', { ascending: true });
    if(error) throw error;
    window._citasArr = (data || []).map(_normalizeCita);
    try{ localStorage.setItem('ce_v3_citas', JSON.stringify(window._citasArr)); }catch(e){}
    // Reintentar cola de citas pendientes (guardadas offline)
    try{
      const q=JSON.parse(localStorage.getItem('ce_citas_pending')||'[]');
      if(q.length){
        const ok=[];
        for(const c of q){
          try{
            const {error:e2}=await supa.from('elle_appointments').upsert([c]);
            if(!e2){ _upsertCitaArr(_normalizeCita(c)); ok.push(c.id); }
          }catch(e3){}
        }
        if(ok.length){
          localStorage.setItem('ce_citas_pending',JSON.stringify(q.filter(c=>!ok.includes(c.id))));
          console.log('[initCitas] reintentadas',ok.length,'citas pendientes');
        }
      }
    }catch(e){}
  }catch(e){
    console.warn('initCitas: DB no disponible, usando localStorage', e);
    const cached = JSON.parse(localStorage.getItem('ce_v3_citas')||'[]');
    window._citasArr = cached;
  }
  _subscribeRealtimeCitas();
}

// ══════════════════════════════════════════════════════
// MÓDULO 2 — Pre-citas: fuente única elle_precitas
// ══════════════════════════════════════════════════════
function _normalizePreCita(row){
  return {
    id:           row.id,
    nombre:       row.nombre        || '',
    apellido:     row.apellido      || '',
    telefono:     row.telefono      || '',
    servicio:     row.servicio      || '',
    cubiculo:     row.cubiculo      || '02',
    hora:         row.hora          || '',
    estado:       row.estado        || 'pendiente',
    fechaTentativa: row.fecha_tentativa || '',
    fechaCreacion:  row.fecha_creacion  || '',
    notas:        row.notas         || '',
    separacion:   parseFloat(row.separacion) || 0,
    convertidoAId: row.convertido_a_id || null,
    asistio:      (row.raw_json && row.raw_json.asistio) || false,
  };
}
function _pcToDb(pc){
  return {
    id:              String(pc.id),
    nombre:          pc.nombre       || '',
    apellido:        pc.apellido     || '',
    telefono:        pc.telefono     || '',
    servicio:        pc.servicio     || '',
    cubiculo:        pc.cubiculo     || '02',
    hora:            pc.hora         || '',
    estado:          pc.estado       || 'pendiente',
    fecha_tentativa: pc.fechaTentativa || null,
    fecha_creacion:  pc.fechaCreacion  || new Date().toISOString().split('T')[0],
    notas:           pc.notas        || '',
    separacion:      pc.separacion   || 0,
    convertido_a_id: pc.convertidoAId || null,
    raw_json:        pc
  };
}
let _realtimePreCitasSub = null;
function _subscribeRealtimePreCitas(){
  if(_realtimePreCitasSub) return;
  _realtimePreCitasSub = supa.channel('elle_precitas_live')
    .on('postgres_changes',{event:'*',schema:'public',table:'elle_precitas'}, payload=>{
      const {eventType,new:n,old:o} = payload;
      if(eventType==='INSERT'||eventType==='UPDATE'){
        const pc=_normalizePreCita(n);
        const idx=preCitas.findIndex(x=>x.id===pc.id);
        if(idx>=0) preCitas[idx]=pc; else preCitas.unshift(pc);
      } else if(eventType==='DELETE'){
        preCitas=preCitas.filter(x=>String(x.id)!==String(o.id));
      }
      savePC();
      if(typeof renderPreCitas==='function') renderPreCitas();
    }).subscribe();
}

async function initPreCitas(){
  try{
    const { data, error } = await supa.from('elle_precitas').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    preCitas = (data||[]).map(_normalizePreCita);
    try{ localStorage.setItem('ce_v3_precitas',JSON.stringify(preCitas)); }catch(e){}
  }catch(e){
    console.warn('initPreCitas: usando localStorage',e);
    preCitas = JSON.parse(localStorage.getItem('ce_v3_precitas')||'[]');
  }
  _subscribeRealtimePreCitas();
}

// ══════════════════════════════════════════════════════
// MÓDULO 5 — Pagos: fuente única elle_payments
// ══════════════════════════════════════════════════════
function _normalizeRegistro(row){
  return {
    id:       row.id,
    fecha:    row.fecha    || '',
    nombre:   row.nombre   || '',
    apellido: row.apellido || '',
    telefono: row.telefono || '',
    servicio: row.servicio || '',
    zonas:    row.zonas    || '',
    total:    row.total    != null ? parseFloat(row.total)    : null,
    adelanto: row.adelanto != null ? parseFloat(row.adelanto) : null,
    atendio:  row.atendio  || '',
    comision: row.comision != null ? parseFloat(row.comision) : null,
    notas:    row.notas    || '',
  };
}
let _realtimeRegistrosSub = null;
function _subscribeRealtimeRegistros(){
  if(_realtimeRegistrosSub) return;
  _realtimeRegistrosSub = supa.channel('elle_payments_live')
    .on('postgres_changes',{event:'*',schema:'public',table:'elle_payments'}, payload=>{
      const {eventType,new:n,old:o} = payload;
      if(eventType==='INSERT'||eventType==='UPDATE'){
        const r=_normalizeRegistro(n);
        const idx=registros.findIndex(x=>x.id===r.id);
        if(idx>=0) registros[idx]=r; else registros.unshift(r);
      } else if(eventType==='DELETE'){
        registros=registros.filter(x=>String(x.id)!==String(o.id));
      }
      saveReg();
      if(typeof renderPagos==='function') renderPagos();
    }).subscribe();
}

async function initRegistros(){
  try{
    const { data, error } = await supa.from('elle_payments').select('*').order('fecha',{ascending:false});
    if(error) throw error;
    registros = (data||[]).map(_normalizeRegistro);
    try{ localStorage.setItem('ce_v3_registros',JSON.stringify(registros)); }catch(e){}
  }catch(e){
    console.warn('initRegistros: usando localStorage',e);
    registros = JSON.parse(localStorage.getItem('ce_v3_registros')||'[]');
  }
  _subscribeRealtimeRegistros();
}

function saveReg(){
  // Cache local — writes individuales van directo a elle_payments
  try{ localStorage.setItem('ce_v3_registros',JSON.stringify(registros)); }catch(e){}
}
