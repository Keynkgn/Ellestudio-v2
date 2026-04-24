// ===== CONFIG =====
const DEFAULT_SERVICES=['Depilación Láser','Glúteos de Porcelana','Limpieza Facial Post Operatorio','Limpieza de Espalda','Reductores'];
const CAL_LINKS={laser:'https://calendar.app.google/3hRGipXZtueFVbVm6',cal02:'https://cal.com/elle-studio-56pfyg/tratamientos-ellestudio02',cal03:'https://cal.com/elle-studio-56pfyg/gluteos-de-porcelana'};
const CUB_COLORS={c01:'#b87c7c',c02:'#4a5530',c03:'#1a5c38'};

function getLinkForCubiculo(cub){
  if(cub==='01')return document.getElementById('calendarLink')?.value||appConfig.calLaser;
  if(cub==='03')return document.getElementById('bookingLink2')?.value||appConfig.calOtros2;
  return document.getElementById('bookingLink')?.value||appConfig.calOtros;
}

// Abrir agenda desde ficha de paciente: Cub 01 → Google, Cub 02/03 → modal manual
function _abrirAgendaSvc(pacId, svcId){
  var p=(typeof patients!=='undefined'?patients:[]).find(function(x){return String(x.id)===String(pacId);});
  if(!p){alert('Paciente no encontrado');return;}
  var sv=(p.servicios||[]).find(function(s){return String(s.id)===String(svcId);});
  if(!sv){alert('Servicio no encontrado');return;}
  // Cub 01 sigue usando Google Calendar
  if(sv.cubiculo==='01'){
    var link=getLinkForCubiculo('01');
    if(link) window.open(link,'_blank');
    return;
  }
  // Cub 02/03 → abrir modal con paciente pre-cargado
  if(typeof openNuevaCitaModal==='function'){
    openNuevaCitaModal();
    setTimeout(function(){
      _ncSwitchOrigen('paciente');
      _ncOrigen.pacId=p.id;
      document.getElementById('ncNombre').value=p.nombre||'';
      document.getElementById('ncApellido').value=p.apellido||'';
      var telEl=document.getElementById('ncTelefono'); if(telEl) telEl.value=p.telefono||'';
      document.getElementById('ncCubiculo').value=sv.cubiculo;
      document.getElementById('ncServicio').value=sv.servicio||'';
      var card=document.getElementById('ncSelCard');
      var info=document.getElementById('ncSelCardInfo');
      if(info) info.innerHTML='👤 <strong>'+(p.nombre||'')+' '+(p.apellido||'')+'</strong>'+(p.telefono?' · '+p.telefono:'');
      if(card) card.style.display='block';
      var box=document.getElementById('ncSearchBox'); if(box) box.style.display='block';
      var input=document.getElementById('ncSearchInput'); if(input) input.value='';
      checkNcConflict();
    },120);
  }
}

// Permisos por defecto para Trabajadora (todo prohibido = marca ❌ significa "NO puede hacerlo")
const DEFAULT_WORKER_PERMS={
  eliminarPacientes:false,
  eliminarServicios:false,
  eliminarZonas:false,
  eliminarSesiones:false,
  eliminarPaquetes:false,
  eliminarPreCitas:false,
  eliminarCitas:false,
  eliminarFotos:false,
  eliminarMensajesWA:false,
  verPagos:false,
  verComisiones:false,
  verConfiguracion:false,
  verPrecios:true,  // por default ve precios
  editarPrecios:false
};
const DEFAULT_FRECUENCIAS=[
  {label:'21 días',dias:21},
  {label:'1 vez por semana',dias:7},
  {label:'2 veces por semana',dias:3},
  {label:'3 veces por semana',dias:2},
  {label:'Mensual',dias:30}
];
const DEFAULT_CONFIG={studioName:"Elle Studio",address:"Av. Paz Soldán 235, San Isidro, Lima, Perú",calLaser:CAL_LINKS.laser,calOtros:CAL_LINKS.cal02,calOtros2:CAL_LINKS.cal03,calEmbedUrl:"https://calendar.google.com/calendar/embed?src=ellestudiolr%40gmail.com&ctz=America%2FLima",services:[...DEFAULT_SERVICES],frecuencias:[...DEFAULT_FRECUENCIAS],workerPerms:{...DEFAULT_WORKER_PERMS}};
const _saved=JSON.parse(localStorage.getItem("ce_v3_config")||"null")||{};
// Never let an empty calEmbedUrl from old localStorage override the default
if(!_saved.calEmbedUrl) delete _saved.calEmbedUrl;
let appConfig=Object.assign({},DEFAULT_CONFIG,_saved);
function saveConfig(){try{localStorage.setItem("ce_v3_config",JSON.stringify(appConfig));}catch(e){console.error("saveConfig localStorage:",e);}}
function SERVICES(){return appConfig.services;}
function FRECUENCIAS(){
  if(!appConfig.frecuencias||!appConfig.frecuencias.length) appConfig.frecuencias=[...DEFAULT_FRECUENCIAS];
  return appConfig.frecuencias;
}
// Normalizar nombres: "REVOLVERA- ZONA TROCANTEIRA" → "Revolvera - Zona Trocanteira"
function tcase(s){
  if(!s||typeof s!=='string')return s;
  return s.toLowerCase().replace(/\s*-\s*/g,' - ').replace(/\s+/g,' ').trim()
    .replace(/\b\p{L}/gu,c=>c.toUpperCase());
}

// ===== NEW DATA STRUCTURE =====
// patient.servicios = [{id, servicio, cubiculo, plan, fechaInicio, comentarios, zonas:[{nombre, sesiones:[...]}]}]
// Pacientes: localStorage solo como caché temporal — Supabase es la fuente principal
let patients = JSON.parse(localStorage.getItem('ce_v3_patients')||'[]');
// Eliminar pacientes de demo si aún están en localStorage
(function removeDemoPatients(){
  const demoNames=['Valentina Rossi','Camila Fernández','Luciana Martínez'];
  const before = patients.length;
  patients = patients.filter(p => {
    const fullName = (p.nombre||'') + ' ' + (p.apellido||'');
    return !demoNames.includes(fullName.trim());
  });
  if(patients.length !== before){
    try{ localStorage.setItem('ce_v3_patients', JSON.stringify(patients)); }catch(e){}
  }
})();
// ===== SUPABASE CONFIG =====
const SUPA_URL = 'https://bwgiktpsmrvfaoyoftwy.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Z2lrdHBzbXJ2ZmFveW9mdHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzY2NjUsImV4cCI6MjA4NzU1MjY2NX0.-3YsxigCNWDeZnW8uLSro6UXsHhRNLmcJHEap0fnHz0';
const supa = supabase.createClient(SUPA_URL, SUPA_KEY);

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
          const zonas=_dbZonas.length>0?_dbZonas:(rp.zonas||[]);
          const rp=s.raw_json||{};
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
// Helper: timeout para queries de Supabase (evita que un fetch colgado bloquee toda la app)
function _supaRace(promise, ms=10000){
  return Promise.race([
    promise,
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout: Supabase no respondió en '+(ms/1000)+'s')),ms))
  ]);
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

// Indicador visual de sincronización con Supabase
let _syncTimer = null;
let _currentSyncState = 'syncing';
function setSyncState(state){
  _currentSyncState = state;
  const ind=document.getElementById('syncIndicator');
  const icon=document.getElementById('syncIcon');
  if(ind && icon){
    if(state==='syncing'){
      ind.title='Sincronizando con la nube';
      icon.style.background='#f0c26a';
      icon.style.animation='syncPulse 0.9s infinite alternate';
    }else if(state==='error'){
      ind.title='Sin conexión a Supabase';
      icon.style.background='#c46060';
      icon.style.animation='none';
    }else{
      ind.title='Datos sincronizados en la nube';
      icon.style.background='#6a9e7a';
      icon.style.animation='none';
    }
  }
  // Refrescar stat box del terminal si está abierto (para que no quede pegado en "Sincronizando")
  if(typeof _diagOpen !== 'undefined' && _diagOpen && typeof _diagUpdateStats === 'function'){
    try{ _diagUpdateStats(); }catch(e){}
  }
}
// Pequeña animación suave para el punto de sincronización
const syncStyle=document.createElement('style');
syncStyle.textContent='@keyframes syncPulse{from{transform:scale(0.9);opacity:0.7;}to{transform:scale(1.2);opacity:1;}}';
document.head.appendChild(syncStyle);

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

// Log de guardados en tiempo real
window._saveLog = [];
function _logSave(accion, detalle){
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  window._saveLog.unshift({hora, accion, detalle, ts: ahora.getTime()});
  if(window._saveLog.length > 50) window._saveLog.pop();
}

function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function save(){
  if(typeof _diagTrackSave==='function') _diagTrackSave();
  const ts = new Date().toISOString();
  const tsNum = Date.now();
  // Marcar timestamp en todos los pacientes modificados recientemente
  // (solo si no tienen uno ya de este segundo — evitar sobrescribir el de Supabase)
  // localStorage como caché opcional
  try{
    localStorage.setItem('ce_v3_patients', JSON.stringify(patients));
    localStorage.setItem('ce_v3_patients_ts', tsNum);
  }catch(e){
    console.warn('localStorage lleno — usando solo Supabase');
    try{ localStorage.removeItem('ce_v3_patients'); }catch(e2){}
  }
  // Supabase es el guardado real
  (async()=>{
    setSyncState('syncing');
    const failed = [];
    for(const p of patients){
      try{ await supaUpsertPatient(p); }
      catch(e){ failed.push(p); console.error('Fallo upsert:',p.id,e); }
    }
    if(failed.length > 0){
      for(const p of failed){
        try{ await supaUpsertPatient(p); }
        catch(e){ console.error('Reintento fallido:',p.nombre,p.apellido); }
      }
    }
    setSyncState(failed.length>0?'error':'idle');
    if(failed.length>0) showToast('⚠️ Error al guardar. Revisa conexión.','#c46060');
  })();
  if(typeof triggerAutoBackup==='function')triggerAutoBackup();
}

// Guardar solo UNA paciente (más eficiente que guardar todas)
async function saveOne(p){
  if(!p) return;
  p._updatedAt = new Date().toISOString();
  try{
    localStorage.setItem('ce_v3_patients', JSON.stringify(patients));
    localStorage.setItem('ce_v3_patients_ts', Date.now());
  }catch(e){}
  setSyncState('syncing');
  try{
    await supaUpsertPatient(p);
    setSyncState('idle');
  }catch(e){
    // Reintento
    try{ await supaUpsertPatient(p); setSyncState('idle'); }
    catch(e2){ setSyncState('error'); showToast('⚠️ Error al guardar. Revisa conexión.','#c46060'); }
  }
}

// Refresco manual desde el encabezado
async function manualRefreshData(){
  await initFromSupabase();
  renderAll();
}

// Migrate old data format (ce_v2_patients)
(function migrateOldData(){
  if(patients.length) return;
  const old=JSON.parse(localStorage.getItem('ce_v2_patients')||'[]');
  if(old.length){
    patients=old.map(p=>({
      id:p.id,nombre:p.nombre,apellido:p.apellido,telefono:p.telefono||'',
      fechaInicio:p.fechaInicio||'',comentarios:p.comentarios||'',fotos:p.fotos||[],
      servicios:[{
        id:Date.now()+Math.random(),
        servicio:p.servicio||'Depilación Láser',
        cubiculo:p.servicio==='Depilación Láser'?'01':'02',
        plan:p.plan||'Sesión',fechaInicio:p.fechaInicio||'',
        comentarios:p.comentarios||'',zonas:p.zonas||[]
      }]
    }));
    save();
    showToast('✅ Datos migrados correctamente','#6a9e7a');
  }
})();

// Sin datos de demo — la app empieza vacía y guarda datos reales en localStorage

// ===== UTILS =====
const ini=(n,a)=>(n[0]||'')+(a[0]||'');
function addWeeks(ds,w){if(!ds)return'';const d=new Date(ds);d.setDate(d.getDate()+w*7);return d.toISOString().split('T')[0];}
function addDays(ds,days){if(!ds)return'';const d=new Date(ds);d.setDate(d.getDate()+days);return d.toISOString().split('T')[0];}
// Convierte "18:00" → "6:00 PM" / "09:30" → "9:30 AM"
function fmt12h(h){
  if(!h||!/^\d{1,2}:\d{2}/.test(h))return h||'';
  const [hh,mm]=h.split(':');
  let n=parseInt(hh,10);const ampm=n>=12?'PM':'AM';
  n=n%12;if(n===0)n=12;
  return n+':'+mm+' '+ampm;
}
function fmtDate(ds){if(!ds)return'—';const[y,m,d]=ds.split('-');return`${d}/${m}/${y}`;}
function monthName(ds){if(!ds)return'—';return['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][parseInt(ds.split('-')[1])-1];}
function daysDiff(ds){if(!ds)return null;const diff=new Date(ds)-new Date(new Date().toISOString().split('T')[0]);return Math.round(diff/(1000*60*60*24));}
function showToast(msg,color='#1a0f0e',duration=2500){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:0.85rem;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.3);transition:opacity 0.3s;color:white;';document.body.appendChild(t);}t.style.background=color;t.textContent=msg;t.style.opacity='1';clearTimeout(t._to);t._to=setTimeout(()=>t.style.opacity='0',2800);}

// Per-service utils
function lastSesForSvc(svc){let l=null;(svc.zonas||[]).forEach(z=>z.sesiones.forEach(s=>{if(s.asistio&&(!l||s.fecha>l))l=s.fecha;}));return l;}
function lastSesAny(svc){let l=null;(svc.zonas||[]).forEach(z=>z.sesiones.forEach(s=>{if(s.fecha&&(!l||s.fecha>l))l=s.fecha;}));return l;}
function nextApptForSvc(svc){
  const ls=lastSesForSvc(svc);
  if(!ls) return null;
  const weeks=svc.servicio==='Depilación Láser'?4:3;
  const calculated=addWeeks(ls,weeks);
  // Si la fecha ya pasó, no mostrarla en la card
  if(daysDiff(calculated)<0) return null;
  return calculated;
}
function alertDateForSvc(svc){
  const ls=lastSesForSvc(svc);if(!ls)return null;
  // Jerarquía: frecuenciaPlan del servicio (paciente) → 21 días default
  if(svc.frecuenciaPlan){
    const d=new Date(ls);d.setDate(d.getDate()+parseInt(svc.frecuenciaPlan));
    return d.toISOString().split('T')[0];
  }
  return addWeeks(ls,3);
}
function cubTag(cub){return`<span class="cubiculo-tag c0${cub}">Cub. ${cub}</span>`;}
function cubLabel(cub){return cub==='01'?'Cub. 01 · Láser':cub==='02'?'Cub. 02':'Cub. 03';}

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

// ===== TABS =====
function showSection(id,el){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('sec-'+id).classList.add('active');
  if(el&&el.classList)el.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  if(id==='pacientes'){renderContactBanner();}
  if(id==='seguimiento'){populateTrkSvcFilter();renderTracking();}
  if(id==='whatsapp'){populateWaSelects();initCalEmbedWA();setTimeout(loadCalBookingsWA,800);}
  if(id==='precitas'){populatePcServiceSelect('pcServicio');renderPreCitas();renderPcStats();}
  if(id==='pagos'){renderPagos();renderPgSummary();}
  if(id==='precios'){renderPrecios();}
  _syncBottomNav(id);
}
function populateTrkSvcFilter(){const sel=document.getElementById('trk-svc');if(!sel)return;const cur=sel.value;sel.innerHTML='<option value="">Todos</option>'+SERVICES().map(s=>`<option value="${s}">${s}</option>`).join('');sel.value=cur;}
function showSectionById(id){const tabs=document.querySelectorAll('.tab');const sections=['inicio','precitas','pacientes','seguimiento','pagos','whatsapp','precios'];const idx=sections.indexOf(id);if(idx>=0&&tabs[idx])showSection(id,tabs[idx]);_syncBottomNav(id);}
function _syncBottomNav(id){const map={inicio:0,pacientes:1,precitas:2,whatsapp:3};const items=document.querySelectorAll('.bn-item');items.forEach(x=>x.classList.remove('active'));if(map[id]!==undefined&&items[map[id]])items[map[id]].classList.add('active');else if(items[4])items[4].classList.add('active');}
function bnNav(id,el){
  const masMenu=document.getElementById('bnMasMenu');
  if(id==='mas'){masMenu.style.display=masMenu.style.display==='block'?'none':'block';return;}
  masMenu.style.display='none';
  const sectionIds=['inicio','precitas','pacientes','seguimiento','pagos','whatsapp','precios'];
  const tabs=document.querySelectorAll('.tab');
  const tabEl=tabs[sectionIds.indexOf(id)]||null;
  showSection(id,tabEl);
}

// ===== AGENDA DEL DÍA =====
function renderAgendaHoy(){
  const el=document.getElementById('agendaHoyContainer');
  const fechaEl=document.getElementById('agendaHoyFecha');
  const countEl=document.getElementById('agendaHoyCount');
  if(!el)return;

  const today=new Date().toISOString().split('T')[0];
  const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const now=new Date();
  if(fechaEl)fechaEl.textContent=`${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;

  // Load manual citas for today
  const todasCitas=window._citasArr||[];
  const citasManual=todasCitas.filter(c=>c.fecha===today).map(c=>({...c,_origen:'manual'}));
  // Pre-citas con hora para hoy
  const pcHoy=(preCitas||[]).filter(pc=>pc.fechaTentativa===today&&pc.hora&&pc.estado!=='cancelada')
    .map(pc=>({id:'pc_'+pc.id,_pcId:pc.id,_origen:'precita',fecha:pc.fechaTentativa,hora:pc.hora,cubiculo:pc.cubiculo,nombre:pc.nombre,apellido:pc.apellido,servicio:pc.servicio,notas:pc.notas,asistio:pc.asistio||false,estado:pc.estado}));
  const citasHoy=[...citasManual,...pcHoy].sort((a,b)=>(a.hora||'')>(b.hora||'')?1:-1);

  if(countEl)countEl.textContent=citasHoy.length>0?`${citasHoy.length} cita${citasHoy.length!==1?'s':''} hoy`:'';

  const cubColors={'01':{color:'var(--rose-dark)',bg:'rgba(184,124,124,0.1)',label:'Cub. 01 · Láser'},'02':{color:'#4a5530',bg:'rgba(74,85,48,0.08)',label:'Cub. 02'},'03':{color:'#1a5c38',bg:'rgba(26,92,56,0.08)',label:'Cub. 03'}};

  if(!citasHoy.length){
    el.innerHTML=`<div style="color:var(--text-light);font-size:0.85rem;padding:8px 0 12px;">Sin citas registradas para hoy. Usa <strong>+ Agregar cita</strong> o crea una <strong>Pre-cita con hora</strong>.</div>`;
    return;
  }

  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:7px;padding-bottom:10px;">
    ${citasHoy.map(c=>{
      const cc=cubColors[c.cubiculo]||cubColors['01'];
      const initials=((c.nombre||'?')[0]+(c.apellido||'')[0]||'').toUpperCase();
      const esPrecita=c._origen==='precita';
      var _tagOrig='';
      if(esPrecita) _tagOrig='<span style="font-size:0.62rem;background:var(--sage-light);color:var(--sage-dark);padding:1px 6px;border-radius:10px;font-weight:700;margin-left:4px;">PRE-CITA</span>';
      else if(c.origenTipo==='paciente') _tagOrig='<span style="font-size:0.62rem;background:#e8eaf3;color:#4a5530;padding:1px 6px;border-radius:10px;font-weight:700;margin-left:4px;">PACIENTE</span>';
      else if(c.origenTipo==='precita') _tagOrig='<span style="font-size:0.62rem;background:#fff4e6;color:#c47a00;padding:1px 6px;border-radius:10px;font-weight:700;margin-left:4px;">DESDE PRE-CITA</span>';
      const tagPrecita=_tagOrig;
      const estadoPc=esPrecita?(c.estado==='confirmada'?'<span style="padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:700;background:#e6f4ea;color:#2e7d32;">✅ Confirmada</span>':'<span style="padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:700;background:#fff3cd;color:#c47a00;">⏳ Pendiente</span>'):'';
      const asistioBadge=!esPrecita?`<span style="padding:3px 10px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${c.asistio?'#e6f4ea':'#fff3cd'};color:${c.asistio?'#2e7d32':'#c47a00'};">${c.asistio?'✅ Asistió':'⏳ Pendiente'}</span>`:estadoPc;
      const botones=esPrecita?
        `<button onclick="openEditPreCita(${c._pcId})" style="background:none;border:1px solid var(--border);border-radius:7px;padding:3px 8px;cursor:pointer;font-size:0.7rem;color:var(--text-dark);">✏ Editar</button>`:
        `<button onclick="toggleAsistio('${c.id}')" style="background:none;border:1px solid var(--border);border-radius:7px;padding:3px 8px;cursor:pointer;font-size:0.7rem;color:var(--text-dark);">${c.asistio?'Desmarcar':'✔ Asistió'}</button>
         <button onclick="deleteCitaHoy('${c.id}')" style="background:none;border:1px solid #f0c0c0;border-radius:7px;padding:3px 8px;cursor:pointer;font-size:0.7rem;color:#c46060;">✕</button>`;
      return`<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${cc.bg};border-radius:11px;border-left:3px solid ${cc.color};">
        <div style="font-size:0.85rem;font-weight:700;color:${cc.color};min-width:70px;font-variant-numeric:tabular-nums;">${fmt12h(c.hora)||'--:--'}</div>
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--rose-light),var(--gold-light));display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:0.95rem;color:var(--rose-dark);font-weight:700;flex-shrink:0;">${initials}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.9rem;">${c.nombre||''} ${c.apellido||''}${tagPrecita}</div>
          <div style="font-size:0.75rem;color:var(--text-light);">${cc.label}${c.servicio?' · '+c.servicio:''}${c.notas?' · '+c.notas:''}</div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0;align-items:center;">
          ${asistioBadge}
          ${botones}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ===== POPUP DETALLE DE EVENTO =====
function showEvtPopup(key){
  const e=window._calEvtMap?window._calEvtMap[key]:null;
  if(!e)return;
  const cubColors={'01':'#b87c7c','02':'#4a5530','03':'#1a5c38'};
  const cc=cubColors[e.cub]||cubColors['01'];
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  let fechaStr='';
  if(e.fecha){const d=new Date(e.fecha+'T12:00:00');fechaStr=dias[d.getDay()]+', '+d.getDate()+' '+meses[d.getMonth()];}
  const nombreCompleto=((e.nombre||'')+' '+(e.apellido||'')).trim()||'(Sin nombre)';
  const esPrecita=!!e._pc;
  const estadoBadge=esPrecita?(e.estado==='confirmada'
    ?'<span style="background:#e6f4ea;color:#2e7d32;padding:3px 10px;border-radius:12px;font-size:0.7rem;font-weight:700;">✅ Confirmada</span>'
    :'<span style="background:#fff3cd;color:#c47a00;padding:3px 10px;border-radius:12px;font-size:0.7rem;font-weight:700;">⏳ Pendiente</span>')
    :'<span style="background:#e8eaf3;color:#4a5530;padding:3px 10px;border-radius:12px;font-size:0.7rem;font-weight:700;">📋 Cita manual</span>';

  // Header
  const header=document.getElementById('evtPopupDotTitle');
  header.innerHTML=
    '<div style="width:14px;height:14px;border-radius:4px;background:'+cc+';margin-top:6px;flex-shrink:0;"></div>'
    +'<div style="flex:1;min-width:0;">'
      +'<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.3rem;font-weight:600;line-height:1.2;color:var(--text);word-break:break-word;">'+(e.servicio||'Cita')+'</div>'
      +'<div style="font-size:0.82rem;color:var(--text-light);margin-top:4px;">'+fechaStr+' · <strong style="color:'+cc+';">'+fmt12h(e.hora)+'</strong></div>'
      +'<div style="margin-top:8px;">'+estadoBadge+'</div>'
    +'</div>';

  // Body
  const body=document.getElementById('evtPopupBody');
  let html='<div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">';
  // Paciente
  html+='<div style="display:flex;align-items:flex-start;gap:10px;">'
    +'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="'+cc+'" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:2px;"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>'
    +'<div style="flex:1;min-width:0;">'
      +'<div style="font-weight:600;font-size:0.95rem;">'+nombreCompleto+'</div>'
      +(e.telefono?'<div style="font-size:0.8rem;color:var(--text-light);">📱 '+e.telefono+'</div>':'')
    +'</div></div>';
  // Cubículo
  html+='<div style="display:flex;align-items:center;gap:10px;">'
    +'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="'+cc+'" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>'
    +'<div style="font-size:0.88rem;">Cubículo <strong>'+(e.cub||'-')+'</strong></div></div>';
  // Separación (solo pre-citas)
  if(esPrecita&&e.separacion>0){
    html+='<div style="display:flex;align-items:center;gap:10px;">'
      +'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
      +'<div style="font-size:0.88rem;">Separación: <strong style="color:#2e7d32;">S/ '+Number(e.separacion).toFixed(2)+'</strong></div></div>';
  }
  // Notas
  if(e.notas){
    html+='<div style="display:flex;align-items:flex-start;gap:10px;margin-top:4px;padding:10px 12px;background:#fff8e7;border-radius:8px;border-left:3px solid #c47a00;">'
      +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c47a00" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:2px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
      +'<div style="font-size:0.82rem;color:var(--text);">'+e.notas+'</div></div>';
  }
  html+='</div>';
  body.innerHTML=html;

  // Buscar si corresponde a un paciente (por convertidoAId o por nombre si es cita manual)
  let pacienteVinculado=null;
  if(esPrecita&&e.convertidoAId){
    pacienteVinculado=patients.find(x=>String(x.id)===String(e.convertidoAId));
  } else {
    // Buscar por nombre+apellido (case-insensitive)
    const nc=(e.nombre||'').toLowerCase().trim();
    const ac=(e.apellido||'').toLowerCase().trim();
    if(nc){
      pacienteVinculado=patients.find(p=>
        (p.nombre||'').toLowerCase().trim()===nc &&
        (!ac||(p.apellido||'').toLowerCase().trim()===ac)
      );
    }
  }

  // Actions — WhatsApp con 3 opciones + editar/ver ficha
  const actions=document.getElementById('evtPopupActions');
  actions.style.flexDirection='column';
  actions.style.gap='8px';
  actions.style.alignItems='stretch';
  let actHtml='';

  // Fila 1: WhatsApp (3 opciones)
  actHtml+='<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">';
  actHtml+='<span style="font-size:0.72rem;color:var(--text-light);align-self:center;margin-right:auto;">📱 Enviar WhatsApp:</span>';
  if(esPrecita){
    actHtml+='<button class="btn btn-green" style="font-size:0.75rem;padding:6px 10px;" onclick="closeEvtPopup();sendWaPreCita(\''+e.id+'\',\'confirmacion\')">✉️ Confirmación</button>';
    actHtml+='<button class="btn btn-green" style="font-size:0.75rem;padding:6px 10px;" onclick="closeEvtPopup();sendWaPreCita(\''+e.id+'\',\'dia_antes\')">⏰ 1 día antes</button>';
    actHtml+='<button class="btn btn-green" style="font-size:0.75rem;padding:6px 10px;" onclick="closeEvtPopup();sendWaPreCita(\''+e.id+'\',\'mismo_dia\')">💜 Mismo día</button>';
  } else {
    // Cita manual — enviar genérico con plantillas si hay paciente vinculado
    if(pacienteVinculado&&pacienteVinculado.telefono){
      actHtml+='<button class="btn btn-green" style="font-size:0.75rem;padding:6px 10px;" onclick="closeEvtPopup();_sendCitaManualWa(\''+e.id+'\',\'confirmacion\')">✉️ Confirmación</button>';
      actHtml+='<button class="btn btn-green" style="font-size:0.75rem;padding:6px 10px;" onclick="closeEvtPopup();_sendCitaManualWa(\''+e.id+'\',\'dia_antes\')">⏰ 1 día antes</button>';
      actHtml+='<button class="btn btn-green" style="font-size:0.75rem;padding:6px 10px;" onclick="closeEvtPopup();_sendCitaManualWa(\''+e.id+'\',\'mismo_dia\')">💜 Mismo día</button>';
    } else {
      actHtml+='<span style="font-size:0.72rem;color:var(--text-light);align-self:center;">Sin teléfono vinculado</span>';
    }
  }
  actHtml+='</div>';

  // Fila 2: Acciones (editar, ver ficha, eliminar, asistencia)
  actHtml+='<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border);">';
  if(pacienteVinculado){
    actHtml+='<button class="btn btn-secondary" style="font-size:0.78rem;" onclick="closeEvtPopup();openDetail(\''+pacienteVinculado.id+'\')">👤 Ver ficha</button>';
  }
  if(esPrecita){
    actHtml+='<button class="btn btn-secondary" style="font-size:0.78rem;" onclick="closeEvtPopup();openEditPreCita('+e.id+')">✏ Editar pre-cita</button>';
  } else {
    actHtml+='<button class="btn btn-primary" style="font-size:0.78rem;" onclick="closeEvtPopup();toggleAsistio(\''+e.id+'\')">✔ Marcar asistencia</button>';
    actHtml+='<button class="btn btn-secondary" style="font-size:0.78rem;color:#c46060;border-color:#f0c0c0;" onclick="closeEvtPopup();deleteCitaHoy(\''+e.id+'\')">🗑 Eliminar</button>';
  }
  actHtml+='</div>';

  actions.innerHTML=actHtml;

  document.getElementById('evtPopup').style.display='flex';
}
// Enviar WhatsApp desde cita manual (usa paciente vinculado por nombre)
function _sendCitaManualWa(citaId,tipo){
  const citas=window._citasArr||[];
  const c=citas.find(x=>String(x.id)===String(citaId));
  if(!c){showToast('❌ Cita no encontrada','#c46060');return;}
  // Buscar paciente por nombre
  const nc=(c.nombre||'').toLowerCase().trim();
  const ac=(c.apellido||'').toLowerCase().trim();
  const p=patients.find(x=>
    (x.nombre||'').toLowerCase().trim()===nc&&
    (!ac||(x.apellido||'').toLowerCase().trim()===ac)
  );
  if(!p||!p.telefono){alert('No se encontró paciente con teléfono para: '+c.nombre+' '+c.apellido);return;}
  // Usar las plantillas de pre-cita
  const tpl=(preCitaTemplates&&preCitaTemplates[tipo])||PC_TPL_DEFAULTS[tipo]||PC_TPL_DEFAULTS.confirmacion;
  const link=getLinkForCubiculo(c.cubiculo);
  const msg=tpl.replace(/\[Nombre\]/g,(c.nombre||'')+' '+(c.apellido||''))
    .replace(/\[Servicio\]/g,c.servicio||'')
    .replace(/\[Link\]/g,link||'');
  sendWaClipboard(p.telefono,msg);
}
function closeEvtPopup(){document.getElementById('evtPopup').style.display='none';}

// ===== CALENDARIO INTERNO · VISTA MENSUAL =====
let _mesInternoOffset=0;
function navMesInterno(dir){_mesInternoOffset+=dir;renderMesInterno();}
function renderMesInterno(){
  const grid=document.getElementById('mesInternoGrid');
  const label=document.getElementById('mesInternoLabel');
  if(!grid)return;
  const hoy=new Date();
  const base=new Date(hoy.getFullYear(),hoy.getMonth()+_mesInternoOffset,1);
  const year=base.getFullYear();
  const month=base.getMonth();
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  if(label)label.textContent=meses[month]+' '+year;
  const primerDia=new Date(year,month,1);
  // dow: 0=Dom..6=Sab. Queremos que la semana empiece en Dom (dom=col0)
  const offset=primerDia.getDay();
  const diasEnMes=new Date(year,month+1,0).getDate();
  const todayStr=hoy.toISOString().split('T')[0];
  const todasCitas=window._citasArr||[];
  const cubColors={'01':'#b87c7c','02':'#4a5530','03':'#1a5c38'};
  const dowLabels=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  let html='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">';
  // Header días
  dowLabels.forEach(d=>{html+='<div style="padding:6px 4px;text-align:center;font-size:0.65rem;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:1px;">'+d+'</div>';});
  // Celdas vacías antes del día 1
  for(let i=0;i<offset;i++){html+='<div></div>';}
  // Días del mes
  for(let d=1;d<=diasEnMes;d++){
    const dia=new Date(year,month,d);
    const dStr=dia.toISOString().split('T')[0];
    const isHoy=dStr===todayStr;
    const citasM=todasCitas.filter(c=>c.fecha===dStr);
    const pcDia=(preCitas||[]).filter(pc=>pc.fechaTentativa===dStr&&pc.hora&&pc.estado!=='cancelada');
    const allEvt=[...citasM.map(c=>({id:c.id,hora:c.hora,nombre:c.nombre,apellido:c.apellido,cub:c.cubiculo,servicio:c.servicio,notas:c.notas,_pc:false,fecha:c.fecha})),
                  ...pcDia.map(pc=>({id:pc.id,hora:pc.hora,nombre:pc.nombre,apellido:pc.apellido,telefono:pc.telefono,cub:pc.cubiculo,servicio:pc.servicio,notas:pc.notas,separacion:pc.separacion,_pc:true,estado:pc.estado,fecha:pc.fechaTentativa}))]
                  .sort((a,b)=>(a.hora||'')>(b.hora||'')?1:-1);
    const borde=isHoy?'2px solid var(--rose)':'1px solid var(--border)';
    const bg=isHoy?'rgba(184,124,124,0.08)':'white';
    html+='<div onclick="openNuevaCitaModal(\''+dStr+'\')" style="min-height:68px;border:'+borde+';border-radius:7px;padding:4px 5px;background:'+bg+';font-size:0.66rem;overflow:hidden;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(184,124,124,0.12)\'" onmouseout="this.style.background=\''+bg+'\'">';
    html+='<div style="font-weight:'+(isHoy?'700':'500')+';color:'+(isHoy?'var(--rose-dark)':'var(--text)')+';font-size:0.72rem;margin-bottom:2px;">'+d+'</div>';
    allEvt.slice(0,3).forEach((e,ei)=>{
      const cc=cubColors[e.cub]||cubColors['01'];
      const dot=e._pc?(e.estado==='confirmada'?'●':'○'):'▸';
      const name=(e.nombre||'').split(' ')[0];
      const svc=(e.servicio||'').slice(0,18);
      const evtKey='evt_'+dStr+'_'+ei;
      if(!window._calEvtMap) window._calEvtMap={};
      window._calEvtMap[evtKey]=e;
      html+='<div onclick="event.stopPropagation();showEvtPopup(\''+evtKey+'\')" style="color:'+cc+';line-height:1.25;margin-bottom:3px;padding:2px 4px;border-radius:4px;background:rgba(0,0,0,0.02);cursor:pointer;" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'rgba(0,0,0,0.02)\'">'
        +'<div style="font-weight:700;font-size:0.66rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+dot+' '+fmt12h(e.hora)+' · Cub'+(e.cub||'-')+'</div>'
        +'<div style="font-size:0.64rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+name+'</div>'
        +(svc?'<div style="font-size:0.6rem;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+svc+'</div>':'')
        +'</div>';
    });
    if(allEvt.length>3)html+='<div style="color:var(--text-light);font-size:0.62rem;">+'+(allEvt.length-3)+' más</div>';
    html+='</div>';
  }
  html+='</div>';
  // Leyenda
  html+='<div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;font-size:0.7rem;color:var(--text-light);">';
  html+='<span>● Confirmada</span><span>○ Pendiente</span><span>▸ Manual</span>';
  html+='<span style="color:#b87c7c;">━ Cub 01</span><span style="color:#4a5530;">━ Cub 02</span><span style="color:#1a5c38;">━ Cub 03</span>';
  html+='</div>';
  grid.innerHTML=html;
}

// ===== AGENDA SEMANAL =====
let _semanaOffset=0;
function toggleAgendaSemanal(){
  const w=document.getElementById('agendaSemanalWrap');
  const a=document.getElementById('agSemArrow');
  if(w.style.display==='none'){w.style.display='block';a.textContent='▼';renderAgendaSemanal();}
  else{w.style.display='none';a.textContent='▶';}
}
function navSemana(dir){_semanaOffset+=dir;renderAgendaSemanal();}
function renderAgendaSemanal(){
  const grid=document.getElementById('agendaSemanalGrid');
  const label=document.getElementById('agSemLabel');
  if(!grid)return;
  const hoy=new Date();
  const lunes=new Date(hoy);
  lunes.setDate(hoy.getDate()-((hoy.getDay()+6)%7)+_semanaOffset*7);
  const dias=['Lun','Mar','Mié','Jue','Vie','Sáb'];
  const meses=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const todasCitas=window._citasArr||[];
  const todayStr=hoy.toISOString().split('T')[0];
  const cubColors={'01':'var(--rose-dark)','02':'#4a5530','03':'#1a5c38'};
  let html='';
  const fechaInicio=new Date(lunes);
  const fechaFin=new Date(lunes);fechaFin.setDate(fechaFin.getDate()+5);
  if(label)label.textContent=`${fechaInicio.getDate()} ${meses[fechaInicio.getMonth()]} — ${fechaFin.getDate()} ${meses[fechaFin.getMonth()]} ${fechaFin.getFullYear()}`;
  for(let d=0;d<6;d++){
    const dia=new Date(lunes);dia.setDate(lunes.getDate()+d);
    const dStr=dia.toISOString().split('T')[0];
    const isHoy=dStr===todayStr;
    const citasManualDia=todasCitas.filter(c=>c.fecha===dStr).map(c=>({id:c.id,hora:c.hora,nombre:c.nombre,apellido:c.apellido,cub:c.cubiculo,servicio:c.servicio,notas:c.notas,_pc:false,fecha:c.fecha}));
    const pcDia=(preCitas||[]).filter(pc=>pc.fechaTentativa===dStr&&pc.hora&&pc.estado!=='cancelada')
      .map(pc=>({id:pc.id,hora:pc.hora,cubiculo:pc.cubiculo,cub:pc.cubiculo,nombre:pc.nombre,apellido:pc.apellido,telefono:pc.telefono,servicio:pc.servicio,notas:pc.notas,separacion:pc.separacion,_pc:true,estado:pc.estado,fecha:pc.fechaTentativa,convertidoAId:pc.convertidoAId}));
    const citasDia=[...citasManualDia,...pcDia].sort((a,b)=>(a.hora||'')>(b.hora||'')?1:-1);
    html+=`<div style="background:${isHoy?'rgba(184,124,124,0.08)':'white'};border:1px solid ${isHoy?'var(--rose)':'var(--border)'};border-radius:10px;padding:8px;min-height:100px;">
      <div style="text-align:center;margin-bottom:6px;">
        <div style="font-size:0.72rem;font-weight:700;color:${isHoy?'var(--rose-dark)':'var(--text-light)'};text-transform:uppercase;letter-spacing:1px;">${dias[d]}</div>
        <div style="font-size:0.85rem;font-weight:${isHoy?'700':'400'};color:${isHoy?'var(--rose-dark)':'var(--text)'};">${dia.getDate()}</div>
      </div>`;
    if(!citasDia.length){
      html+=`<div style="text-align:center;font-size:0.7rem;color:var(--text-light);padding:8px 0;">—</div>`;
    }else{
      citasDia.forEach((c,ei)=>{
        const cc=cubColors[c.cub]||cubColors['01'];
        const dot=c._pc?(c.estado==='confirmada'?'●':'○'):'▸';
        const bg=c._pc?'rgba(122,140,106,0.08)':'rgba(0,0,0,0.02)';
        const evtKey='sem_'+dStr+'_'+ei;
        if(!window._calEvtMap) window._calEvtMap={};
        window._calEvtMap[evtKey]=c;
        html+=`<div onclick="showEvtPopup('${evtKey}')" style="padding:4px 6px;margin-bottom:3px;border-radius:6px;border-left:2.5px solid ${cc};background:${bg};font-size:0.68rem;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='rgba(184,124,124,0.12)'" onmouseout="this.style.background='${bg}'">
          <div style="font-weight:700;color:${cc};">${dot} ${fmt12h(c.hora)||'--:--'} · Cub${c.cub||'-'}</div>
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.nombre||''}</div>
          <div style="color:var(--text-light);font-size:0.62rem;">${c.servicio||''}</div>
        </div>`;
      });
    }
    html+=`</div>`;
  }
  grid.innerHTML=html;
}

// ===== CITAS MANUALES (cualquier día) =====
// Estado del origen del modal (nuevo/paciente/precita + id)
var _ncOrigen={tipo:'nuevo',pacId:null,pcId:null};
function openNuevaCitaModal(fechaPref){
  const today=new Date().toISOString().split('T')[0];
  document.getElementById('ncFecha').value=fechaPref||today;
  document.getElementById('ncHora').value='';
  document.getElementById('ncCubiculo').value='01';
  document.getElementById('ncNombre').value='';
  document.getElementById('ncApellido').value='';
  var telEl=document.getElementById('ncTelefono'); if(telEl) telEl.value='';
  document.getElementById('ncServicio').value='';
  document.getElementById('ncNotas').value='';
  const alertEl=document.getElementById('ncConflictAlert');if(alertEl)alertEl.style.display='none';
  _ncOrigen={tipo:'nuevo',pacId:null,pcId:null};
  _ncSwitchOrigen('nuevo');
  openModal('nuevaCitaModal');
}
function _ncSwitchOrigen(tipo){
  _ncOrigen.tipo=tipo;
  _ncOrigen.pacId=null;
  _ncOrigen.pcId=null;
  // Reset botones
  var btns={nuevo:'ncOrigNuevo',paciente:'ncOrigPac',precita:'ncOrigPc'};
  Object.keys(btns).forEach(function(k){
    var el=document.getElementById(btns[k]); if(!el)return;
    if(k===tipo){ el.style.background='var(--sage-light)'; el.style.borderColor='var(--sage)'; el.style.color='var(--sage-dark)'; el.style.fontWeight='600'; }
    else{ el.style.background='white'; el.style.borderColor='var(--border)'; el.style.color='var(--text)'; el.style.fontWeight='500'; }
  });
  var box=document.getElementById('ncSearchBox');
  var card=document.getElementById('ncSelCard');
  var input=document.getElementById('ncSearchInput');
  var drop=document.getElementById('ncSearchDrop');
  if(input) input.value='';
  if(drop){ drop.style.display='none'; drop.innerHTML=''; }
  if(card) card.style.display='none';
  if(tipo==='nuevo'){
    if(box) box.style.display='none';
  } else {
    if(box) box.style.display='block';
    if(input) input.placeholder=tipo==='paciente'?'🔍 Buscar paciente por nombre...':'🔍 Buscar pre-cita por nombre...';
  }
}
function _ncSearch(q){
  var drop=document.getElementById('ncSearchDrop'); if(!drop)return;
  q=(q||'').trim().toLowerCase();
  if(!q){ drop.style.display='none'; drop.innerHTML=''; return; }
  var res=[];
  if(_ncOrigen.tipo==='paciente'){
    res=(typeof patients!=='undefined'?patients:[]).filter(function(p){
      return ((p.nombre||'')+' '+(p.apellido||'')).toLowerCase().indexOf(q)>=0;
    }).slice(0,8).map(function(p){
      var svs=(p.servicios||[]).map(function(s){return s.servicio;}).join(', ');
      return {id:p.id,title:(p.nombre||'')+' '+(p.apellido||''),sub:(p.telefono||'sin tel')+(svs?' · '+svs:'')};
    });
  } else if(_ncOrigen.tipo==='precita'){
    res=(preCitas||[]).filter(function(pc){
      return ((pc.nombre||'')+' '+(pc.apellido||'')).toLowerCase().indexOf(q)>=0 && pc.estado!=='cancelada';
    }).slice(0,8).map(function(pc){
      return {id:pc.id,title:(pc.nombre||'')+' '+(pc.apellido||''),sub:(pc.servicio||'')+' · Cub.'+(pc.cubiculo||'?')+(pc.fechaTentativa?' · '+fmtDate(pc.fechaTentativa):'')+(pc.hora?' '+pc.hora:'')};
    });
  }
  if(!res.length){
    drop.innerHTML='<div style="padding:10px 14px;font-size:0.82rem;color:var(--text-light);">Sin resultados</div>';
    drop.style.display='block'; return;
  }
  drop.innerHTML=res.map(function(r){
    return '<div onclick="_ncPick(\''+r.id+'\')" style="padding:10px 13px;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.83rem;" onmouseover="this.style.background=\'#faf6f0\'" onmouseout="this.style.background=\'white\'">'+
      '<div style="font-weight:600;">'+r.title+'</div>'+
      '<div style="font-size:0.74rem;color:var(--text-light);margin-top:2px;">'+r.sub+'</div>'+
    '</div>';
  }).join('');
  drop.style.display='block';
}
function _ncPick(id){
  var drop=document.getElementById('ncSearchDrop');
  var input=document.getElementById('ncSearchInput');
  var card=document.getElementById('ncSelCard');
  var info=document.getElementById('ncSelCardInfo');
  if(_ncOrigen.tipo==='paciente'){
    var _pats=(typeof patients!=='undefined'?patients:[]);
    var p=_pats.find(function(x){return String(x.id)===String(id);});
    if(!p)return;
    _ncOrigen.pacId=p.id;
    document.getElementById('ncNombre').value=p.nombre||'';
    document.getElementById('ncApellido').value=p.apellido||'';
    document.getElementById('ncTelefono').value=p.telefono||'';
    if(info) info.innerHTML='👤 <strong>'+(p.nombre||'')+' '+(p.apellido||'')+'</strong>'+(p.telefono?' · '+p.telefono:'');
  } else if(_ncOrigen.tipo==='precita'){
    var pc=(preCitas||[]).find(function(x){return String(x.id)===String(id);});
    if(!pc)return;
    _ncOrigen.pcId=pc.id;
    document.getElementById('ncNombre').value=pc.nombre||'';
    document.getElementById('ncApellido').value=pc.apellido||'';
    document.getElementById('ncTelefono').value=pc.telefono||'';
    document.getElementById('ncServicio').value=pc.servicio||'';
    if(pc.fechaTentativa) document.getElementById('ncFecha').value=pc.fechaTentativa;
    if(pc.hora) document.getElementById('ncHora').value=pc.hora;
    if(pc.cubiculo) document.getElementById('ncCubiculo').value=pc.cubiculo;
    if(pc.notas) document.getElementById('ncNotas').value=pc.notas;
    if(info) info.innerHTML='📋 <strong>'+(pc.nombre||'')+' '+(pc.apellido||'')+'</strong> · '+(pc.servicio||'')+' · Cub.'+(pc.cubiculo||'');
    checkNcConflict();
  }
  if(drop){ drop.style.display='none'; drop.innerHTML=''; }
  if(input) input.value='';
  if(card) card.style.display='block';
}
function _ncClearSel(){
  _ncOrigen.pacId=null;
  _ncOrigen.pcId=null;
  var card=document.getElementById('ncSelCard'); if(card) card.style.display='none';
  document.getElementById('ncNombre').value='';
  document.getElementById('ncApellido').value='';
  document.getElementById('ncTelefono').value='';
  document.getElementById('ncServicio').value='';
  document.getElementById('ncNotas').value='';
}
// Detección de conflicto para cita manual (revisa citas + pre-citas)
function checkNcConflict(){
  const fecha=document.getElementById('ncFecha').value;
  const hora=document.getElementById('ncHora').value;
  const cub=document.getElementById('ncCubiculo').value;
  const alertEl=document.getElementById('ncConflictAlert');
  if(!alertEl)return;
  if(!fecha||!hora){alertEl.style.display='none';return;}
  const citas=window._citasArr||[];
  const conflictCita=citas.find(c=>c.fecha===fecha&&c.hora===hora&&c.cubiculo===cub);
  const conflictPc=(preCitas||[]).find(pc=>pc.fechaTentativa===fecha&&pc.hora===hora&&pc.cubiculo===cub&&pc.estado!=='cancelada');
  const conflict=conflictCita||conflictPc;
  if(!conflict){
    alertEl.style.display='block';
    alertEl.style.background='#e6f4ea';alertEl.style.border='1px solid #2e7d32';alertEl.style.color='#2e7d32';
    alertEl.innerHTML='✅ Cubículo '+cub+' disponible a las '+hora;
    return;
  }
  const otrosCubs=['01','02','03'].filter(c=>c!==cub&&
    !citas.find(x=>x.fecha===fecha&&x.hora===hora&&x.cubiculo===c)&&
    !(preCitas||[]).find(pc=>pc.fechaTentativa===fecha&&pc.hora===hora&&pc.cubiculo===c&&pc.estado!=='cancelada'));
  alertEl.style.display='block';
  alertEl.style.background='#fff3e0';alertEl.style.border='1px solid #c47a00';alertEl.style.color='#c47a00';
  let html='⚠️ Cub. '+cub+' ocupado a las '+hora+' con <strong>'+(conflict.nombre||'')+' '+(conflict.apellido||'')+'</strong>.';
  if(otrosCubs.length){
    html+='<div style="margin-top:6px;">Disponibles: ';
    otrosCubs.forEach(c=>{
      html+='<button type="button" onclick="document.getElementById(\'ncCubiculo\').value=\''+c+'\';checkNcConflict()" style="margin-right:6px;padding:3px 10px;border-radius:14px;border:1px solid #c47a00;background:white;color:#c47a00;cursor:pointer;font-size:0.78rem;font-weight:600;">Cub '+c+'</button>';
    });
    html+='</div>';
  } else html+='<div style="margin-top:6px;color:var(--red);font-weight:600;">Todos los cubículos ocupados a esa hora.</div>';
  alertEl.innerHTML=html;
}

// ══════════════════════════════════════════════════════
// MÓDULO 1 — Citas: fuente única elle_appointments
// ══════════════════════════════════════════════════════
window._citasArr = [];

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

async function saveNuevaCita(){
  const nombreEl=document.getElementById('ncNombre');
  if(!nombreEl){ alert('Error: formulario no disponible'); return; }
  const nombre=nombreEl.value.trim();
  if(!nombre){alert('El nombre es obligatorio.');return;}
  const fechaEl=document.getElementById('ncFecha');
  const horaEl=document.getElementById('ncHora');
  const cubEl=document.getElementById('ncCubiculo');
  const apellidoEl=document.getElementById('ncApellido');
  const servicioEl=document.getElementById('ncServicio');
  const notasEl=document.getElementById('ncNotas');
  const fecha=fechaEl&&fechaEl.value?fechaEl.value:new Date().toISOString().split('T')[0];
  const hora=horaEl?horaEl.value:'';
  const cubiculo=cubEl?cubEl.value:'01';
  // Validar conflicto
  if(fecha&&hora){
    const c1=window._citasArr.find(c=>c.fecha===fecha&&c.hora===hora&&c.cubiculo===cubiculo);
    const c2=(preCitas||[]).find(pc=>pc.fechaTentativa===fecha&&pc.hora===hora&&pc.cubiculo===cubiculo&&pc.estado!=='cancelada');
    const cf=c1||c2;
    if(cf){
      if(!confirm(`⚠️ Cub. ${cubiculo} ocupado a las ${hora} con ${cf.nombre||''} ${cf.apellido||''}.\n\n¿Guardar de todos modos?`))return;
    }
  }
  var telEl=document.getElementById('ncTelefono');
  var tel=telEl?telEl.value.trim():'';
  var origenTipo=(_ncOrigen&&_ncOrigen.tipo)||'nuevo';
  var origenId=origenTipo==='paciente'?(_ncOrigen.pacId||null):(origenTipo==='precita'?(_ncOrigen.pcId||null):null);
  const nuevaCita = {
    id:'cita_'+Date.now(),
    fecha, hora, cubiculo,
    nombre,
    apellido: apellidoEl ? apellidoEl.value.trim() : '',
    telefono: tel,
    servicio: servicioEl ? servicioEl.value.trim() : '',
    notas:    notasEl ? notasEl.value.trim() : '',
    origen_tipo: origenTipo,
    origen_id:   origenId,
    asistio: false,
    raw_json: {}
  };
  // Guardar en memoria y cerrar modal inmediatamente (optimista)
  _upsertCitaArr(_normalizeCita(nuevaCita));
  try{ localStorage.setItem('ce_v3_citas', JSON.stringify(window._citasArr)); }catch(e){}
  closeModal('nuevaCitaModal');
  _renderCitasViews();
  showToast(`✅ Cita guardada: ${nombre} (${fecha})`,'#6a9e7a');
  // Sincronizar con Supabase en background con reintentos
  (async()=>{
    for(let i=0;i<3;i++){
      try{
        setSyncState('syncing');
        const {error}=await supa.from('elle_appointments').upsert([nuevaCita]);
        if(error) throw error;
        // Quitar de cola pendiente si estaba
        try{
          const q=JSON.parse(localStorage.getItem('ce_citas_pending')||'[]');
          localStorage.setItem('ce_citas_pending',JSON.stringify(q.filter(c=>c.id!==nuevaCita.id)));
        }catch(e2){}
        setSyncState('idle');
        return;
      }catch(e){
        if(i<2){ await new Promise(r=>setTimeout(r,1500*(i+1))); continue; }
        // 3 intentos fallaron — guardar en cola para reintentar al recargar
        try{
          const q=JSON.parse(localStorage.getItem('ce_citas_pending')||'[]');
          if(!q.find(c=>c.id===nuevaCita.id)) q.push(nuevaCita);
          localStorage.setItem('ce_citas_pending',JSON.stringify(q));
        }catch(e2){}
        setSyncState('error');
        showToast('⚠️ Cita guardada localmente. Se subirá cuando haya conexión.','#c47a00',6000);
      }
    }
  })();
}

// Sync TODAS las citas a Supabase bajo una sola key (no solo "hoy")

async function toggleAsistio(id){
  const cita = window._citasArr.find(x => x.id === id);
  if(!cita) return;
  const nuevoVal = !cita.asistio;
  try{
    const { error } = await supa.from('elle_appointments').update({ asistio: nuevoVal }).eq('id', id);
    if(error) throw error;
    cita.asistio = nuevoVal;
    try{ localStorage.setItem('ce_v3_citas', JSON.stringify(window._citasArr)); }catch(e){}
    _renderCitasViews();
  }catch(e){
    console.error('toggleAsistio:',e);
    showToast('❌ No se pudo actualizar asistencia.','#c0392b',4000);
  }
}

async function deleteCitaHoy(id){
  if(_workerGuard('eliminar citas','eliminarCitas')) return;
  if(!confirm('⚠️ ¿Estás segura de eliminar esta cita?'))return;
  try{
    const { error } = await supa.from('elle_appointments').delete().eq('id', id);
    if(error) throw error;
    _removeCitaArr(id);
    try{ localStorage.setItem('ce_v3_citas', JSON.stringify(window._citasArr)); }catch(e){}
    _renderCitasViews();
  }catch(e){
    console.error('deleteCitaHoy:',e);
    showToast('❌ No se pudo eliminar la cita.','#c0392b',4000);
  }
}

// ===== CALENDARIOS EMBEBIDOS =====
let _calsRendered = false;

function getCalUrls(){
  return {
    google: appConfig.calEmbedUrl||'https://calendar.google.com/calendar/embed?src=ellestudiolr%40gmail.com&ctz=America%2FLima'
  };
}

function buildCalFrame(url, isGoogle, height){
  if(!url) return `<div style="padding:28px;text-align:center;color:var(--text-light);background:var(--cream);border-radius:10px;">
    <div style="font-size:1.8rem;margin-bottom:8px;">${isGoogle?'📅':'📅️'}</div>
    <div style="font-weight:600;margin-bottom:6px;">Configura el link del calendario</div>
    <div style="font-size:0.82rem;margin-bottom:14px;">Ve a <strong>Configuración → Calendarios embebidos</strong> y pega el link.</div>
    <button class="btn btn-secondary" style="font-size:0.8rem;" onclick="openSettings()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Configuración</button>
  </div>`;
  if(isGoogle){
    // Google Calendar embed via iframe
    return `<iframe src="${url}" style="width:100%;height:${height}px;border:none;display:block;" frameborder="0" scrolling="no" allowfullscreen></iframe>`;
  } else {
    // Cal.com — embed como iframe usando el link directo
    const embedUrl = url.includes('?') ? url + '&embed=true' : url + '?embed=true';
    return `<iframe src="${embedUrl}" style="width:100%;height:${height}px;border:none;display:block;" frameborder="0" scrolling="no" allowfullscreen></iframe>`;
  }
}

// Scroll al calendario interno manual (Cub 02 & 03)
function _scrollToCalInterno(cubFocus){
  var sec=document.getElementById('sec-inicio');
  if(sec && typeof showSectionById==='function'){ showSectionById('inicio'); }
  setTimeout(function(){
    var el=document.getElementById('mesInternoGrid');
    if(el){
      el.scrollIntoView({behavior:'smooth',block:'center'});
      // Destello visual para destacar
      var wrap=el.parentElement;
      if(wrap){
        var prev=wrap.style.transition||'';
        var prevBg=wrap.style.background||'';
        wrap.style.transition='background 0.6s';
        wrap.style.background='rgba(184,124,124,0.12)';
        setTimeout(function(){wrap.style.background=prevBg;wrap.style.transition=prev;},900);
      }
    }
  },80);
}
function renderCalFrames(){
  const urls = getCalUrls();
  const f0=document.getElementById('calEmbedFrame0');
  if(f0) f0.innerHTML = buildCalFrame(urls.google, true, 520);
  _calsRendered = true;
}

function initCalEmbedWA(){
  const urls = getCalUrls();
  const fwa = document.getElementById('calEmbedFrameWA');
  if(fwa && !fwa.dataset.loaded){ fwa.innerHTML = buildCalFrame(urls.google, true, 520); fwa.dataset.loaded='1'; }
}

// ===== CAL.COM API KEY =====
const CAL_API_KEY = 'cal_live_3e3bdf7be1475e3c0892eef82c80c921';

function renderCalBookings(bookings, statusFilter, containerId){
  const container = document.getElementById(containerId || 'calBookingsContainer');
  if(!container) return;

  if(!bookings.length){
    container.innerHTML = `<div style="text-align:center;padding:28px;color:var(--text-light);font-size:0.85rem;">
      <div style="font-size:1.8rem;margin-bottom:8px;">📭</div>
      <strong>Sin reservas para este período</strong>
    </div>`;
    return;
  }

  // Sort by start time
  bookings.sort((a,b) => new Date(a.startTime) - new Date(b.startTime));

  // Group by date
  const groups = {};
  bookings.forEach(b => {
    const d = new Date(b.startTime);
    const dateKey = d.toLocaleDateString('es-PE', {weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'America/Lima'});
    if(!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(b);
  });

  let html = `<div style="display:flex;flex-direction:column;gap:16px;">`;

  Object.entries(groups).forEach(([date, items]) => {
    html += `<div>
      <div style="font-size:0.78rem;font-weight:700;color:var(--rose-dark);text-transform:capitalize;margin-bottom:8px;padding:4px 10px;background:rgba(184,124,124,0.1);border-radius:8px;display:inline-block;">
        ${date}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">`;

    items.forEach(b => {
      const start = new Date(b.startTime);
      const end = new Date(b.endTime);
      const hora = start.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit', timeZone:'America/Lima'});
      const horaFin = end.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit', timeZone:'America/Lima'});
      const status = b.status || 'upcoming';
      const attendee = (b.attendees && b.attendees[0]) ? b.attendees[0] : {};
      const nombre = attendee.name || 'Sin nombre';
      const email = attendee.email || '';
      const servicio = b.eventType?.title || b.title || 'Tratamiento';
      const cubículo = servicio.includes('02') || servicio.toLowerCase().includes('tratamiento') ? 'Cub. 02' :
                       servicio.includes('01') || servicio.toLowerCase().includes('laser') ? 'Cub. 01' :
                       servicio.includes('03') || servicio.toLowerCase().includes('glut') ? 'Cub. 03' : 'Cal.com';

      const statusColor = status === 'upcoming' ? '#27ae60' :
                          status === 'cancelled' ? '#c0392b' :
                          status === 'past' ? '#7f8c8d' : '#2980b9';
      const statusLabel = status === 'upcoming' ? '✅ Confirmada' :
                          status === 'cancelled' ? '❌ Cancelada' :
                          status === 'past' ? '✔ Realizada' : status;

      // Phone from attendee or location
      const phone = attendee.phoneNumber || '';
      const whatsappBtn = phone ?
        `<button onclick="window.open('https://wa.me/${phone.replace(/[^0-9]/g,'')}','_blank')" style="padding:4px 10px;border-radius:12px;border:none;background:#25d366;color:white;font-size:0.72rem;font-weight:600;cursor:pointer;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WA</button>` : '';

      html += `<div style="background:white;border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div style="min-width:52px;text-align:center;background:var(--cream);border-radius:8px;padding:6px 4px;">
          <div style="font-size:1rem;font-weight:700;color:var(--rose-dark);">${hora}</div>
          <div style="font-size:0.65rem;color:var(--text-light);">${horaFin}</div>
        </div>
        <div style="flex:1;min-width:160px;">
          <div style="font-weight:600;font-size:0.9rem;color:var(--text);">${nombre}</div>
          <div style="font-size:0.78rem;color:var(--text-light);margin-top:2px;">${servicio}</div>
          ${email ? `<div style="font-size:0.72rem;color:var(--text-light);">${email}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <span style="font-size:0.7rem;font-weight:600;color:${statusColor};background:${statusColor}18;padding:3px 9px;border-radius:10px;">${statusLabel}</span>
          <span style="font-size:0.7rem;color:var(--text-light);">${cubículo}</span>
          ${whatsappBtn}
        </div>
      </div>`;
    });

    html += `</div></div>`;
  });

  html += `</div>
  <div style="text-align:right;margin-top:10px;font-size:0.72rem;color:var(--text-light);">
    ${bookings.length} reserva${bookings.length !== 1 ? 's' : ''} · Última actualización: ${new Date().toLocaleTimeString('es-PE', {timeZone:'America/Lima'})}
  </div>`;

  container.innerHTML = html;
}
// ===== CAL.COM API — WHATSAPP TAB =====
async function loadCalBookingsWA(){
  const container = document.getElementById('calBookingsContainerWA');
  if(!container) return;
  container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-light);font-size:0.85rem;"><div style="font-size:1.5rem;margin-bottom:6px;">⏳</div>Cargando reservas…</div>`;
  try {
    const daysEl = document.getElementById('calFilterDaysWA');
    const statusEl = document.getElementById('calFilterStatusWA');
    const days = daysEl ? parseInt(daysEl.value) : 7;
    const statusFilter = statusEl ? statusEl.value : 'upcoming';
    let params = new URLSearchParams();
    params.set('take', '100');
    const now = new Date();
    if(days > 0) {
      if(statusFilter === 'past') {
        const past = new Date(now); past.setDate(past.getDate() - days);
        params.set('afterStart', past.toISOString()); params.set('beforeEnd', now.toISOString());
      } else {
        const future = new Date(now); future.setDate(future.getDate() + days);
        params.set('afterStart', now.toISOString()); params.set('beforeEnd', future.toISOString());
      }
    }
    if(statusFilter === 'upcoming') params.set('status','upcoming');
    else if(statusFilter === 'past') params.set('status','past');
    else if(statusFilter === 'cancelled') params.set('status','cancelled');
    const resp = await fetch('https://api.cal.com/v2/bookings?' + params.toString(), {
      headers: { 'Authorization': 'Bearer ' + CAL_API_KEY, 'cal-api-version': '2024-08-13' }
    });
    if(!resp.ok) throw new Error('Error ' + resp.status);
    const data = await resp.json();
    const bookings = (data.data || []).map(function(b){ return Object.assign({}, b, {startTime: b.start, endTime: b.end}); });
    renderCalBookings(bookings, statusFilter, 'calBookingsContainerWA');
  } catch(err) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:#c0392b;font-size:0.85rem;"><div style="font-size:1.5rem;margin-bottom:6px;">❌</div><strong>No se pudieron cargar las reservas</strong><br><span style="font-size:0.78rem;color:var(--text-light);">${err.message}</span></div>`;
  }
}
// ===== FIN CAL.COM API =====

// ===== STATS INICIO =====
function _getAlertDays(){var el=document.getElementById('alertDaysFilter');return el?parseInt(el.value):7;}
function renderStatsInicio(){
  const el=document.getElementById('statsInicio');if(!el)return;
  const totalSes=patients.reduce((a,p)=>a+(p.servicios||[]).reduce((b,sv)=>b+(sv.zonas||[]).reduce((c,z)=>c+z.sesiones.length,0),0),0);
  const maxD=_getAlertDays();
  const alertCount=patients.reduce((a,p)=>a+(p.servicios||[]).filter(sv=>{const ls=lastSesAny(sv);if(!ls)return false;const ad=alertDateForSvc(sv);if(!ad)return false;const d=daysDiff(ad);return d!==null&&d>=0&&d<=maxD;}).length,0);
  el.innerHTML=`
    <div class="stat-inicio"><div class="num">${patients.length}</div><div class="lbl">Pacientes</div></div>
    <div class="stat-inicio"><div class="num">${totalSes}</div><div class="lbl">Sesiones</div></div>
    <div class="stat-inicio"><div class="num">${alertCount}</div><div class="lbl">A Contactar</div></div>
    <div class="stat-inicio"><div class="num">${patients.filter(p=>(p.servicios||[]).some(sv=>sv.servicio==='Depilación Láser')).length}</div><div class="lbl">Láser</div></div>`;
}

// ===== DASHBOARD MÉTRICAS =====
function toggleDashMetricas(){
  const w=document.getElementById('dashMetricasWrap');
  const a=document.getElementById('dashMetArrow');
  if(w.style.display==='none'){w.style.display='block';a.textContent='▼';renderDashMetricas();}
  else{w.style.display='none';a.textContent='▶';}
}
function renderDashMetricas(){
  const el=document.getElementById('dashMetricasWrap');if(!el)return;
  const now=new Date();
  const mesActual=now.toISOString().slice(0,7);
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesNombre=meses[now.getMonth()]+' '+now.getFullYear();

  // Sesiones este mes por servicio
  const sesPorSvc={};
  let totalSesMes=0;
  patients.forEach(p=>{
    (p.servicios||[]).forEach(sv=>{
      (sv.zonas||[]).forEach(z=>{
        (z.sesiones||[]).forEach(s=>{
          if((s.fecha||'').startsWith(mesActual)){
            const sn=sv.servicio||'Sin servicio';
            sesPorSvc[sn]=(sesPorSvc[sn]||0)+1;
            totalSesMes++;
          }
        });
      });
    });
  });

  // Ingresos por servicio (de registros)
  const ingPorSvc={};
  let totalIngMes=0;
  (registros||[]).forEach(r=>{
    if((r.fecha||'').startsWith(mesActual)){
      const sn=r.servicio||'Otro';
      ingPorSvc[sn]=(ingPorSvc[sn]||0)+(r.total||0);
      totalIngMes+=(r.total||0);
    }
  });

  // Pacientes sin volver en 60+ días
  const hoyMs=now.getTime();
  const sinVolver=[];
  patients.forEach(p=>{
    let ultimaFecha=null;
    (p.servicios||[]).forEach(sv=>{
      const ls=lastSesAny(sv);
      if(ls&&(!ultimaFecha||ls>ultimaFecha))ultimaFecha=ls;
    });
    if(ultimaFecha){
      const diff=Math.floor((hoyMs-new Date(ultimaFecha).getTime())/(1000*60*60*24));
      if(diff>=60)sinVolver.push({p,dias:diff,ultima:ultimaFecha});
    }
  });
  sinVolver.sort((a,b)=>b.dias-a.dias);

  // Render
  const svcKeys=Object.keys(sesPorSvc).sort((a,b)=>sesPorSvc[b]-sesPorSvc[a]);
  const ingKeys=Object.keys(ingPorSvc).sort((a,b)=>ingPorSvc[b]-ingPorSvc[a]);
  const maxSes=Math.max(...Object.values(sesPorSvc),1);
  const maxIng=Math.max(...Object.values(ingPorSvc),1);

  let html=`<div style="font-size:0.82rem;color:var(--text-light);margin-bottom:12px;">📊 ${mesNombre}</div>`;
  html+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">`;

  // Sesiones por servicio
  html+=`<div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px;">
    <div style="font-size:0.78rem;font-weight:700;margin-bottom:10px;color:var(--text);">Sesiones por servicio · <span style="color:var(--sage-dark);">${totalSesMes}</span></div>`;
  if(!svcKeys.length) html+=`<div style="font-size:0.78rem;color:var(--text-light);">Sin sesiones este mes</div>`;
  svcKeys.forEach(s=>{
    const pct=Math.round(sesPorSvc[s]/maxSes*100);
    html+=`<div style="margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:2px;"><span>${s}</span><span style="font-weight:700;">${sesPorSvc[s]}</span></div>
      <div style="height:5px;background:#eee;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:var(--sage);border-radius:3px;"></div></div>
    </div>`;
  });
  html+=`</div>`;

  // Ingresos por servicio
  html+=`<div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px;">
    <div style="font-size:0.78rem;font-weight:700;margin-bottom:10px;color:var(--text);">Ingresos por servicio · <span style="color:var(--green);">S/${totalIngMes.toFixed(0)}</span></div>`;
  if(!ingKeys.length) html+=`<div style="font-size:0.78rem;color:var(--text-light);">Sin registros este mes</div>`;
  ingKeys.forEach(s=>{
    const pct=Math.round(ingPorSvc[s]/maxIng*100);
    html+=`<div style="margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:2px;"><span>${s}</span><span style="font-weight:700;">S/${ingPorSvc[s].toFixed(0)}</span></div>
      <div style="height:5px;background:#eee;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:var(--green);border-radius:3px;"></div></div>
    </div>`;
  });
  html+=`</div></div>`;

  // Pacientes sin volver 60+ días
  html+=`<div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px;">
    <div style="font-size:0.78rem;font-weight:700;margin-bottom:10px;color:var(--text);">⚠️ Sin volver hace 60+ días · <span style="color:var(--red);">${sinVolver.length}</span></div>`;
  if(!sinVolver.length) html+=`<div style="font-size:0.78rem;color:var(--text-light);">Todas las pacientes están al día ✅</div>`;
  sinVolver.slice(0,10).forEach(x=>{
    html+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f5f0eb;font-size:0.78rem;cursor:pointer;" onclick="openDetail('${x.p.id}');showSectionById('pacientes');">
      <span>${x.p.nombre} ${x.p.apellido}</span>
      <span style="color:var(--red);font-weight:600;">${x.dias} días</span>
    </div>`;
  });
  if(sinVolver.length>10) html+=`<div style="font-size:0.72rem;color:var(--text-light);margin-top:6px;">...y ${sinVolver.length-10} más</div>`;
  html+=`</div>`;

  el.innerHTML=html;
}

// ===== ALERTS INICIO =====
function _getStore21(){try{return JSON.parse(localStorage.getItem('d21_v2')||'{}')}catch{return{}}}
function _getListaContactar(){
  var store=_getStore21();
  var maxDays=_getAlertDays();
  var lista=[];
  patients.forEach(function(p){
    (p.servicios||[]).forEach(function(sv){
      var ls=lastSesAny(sv); if(!ls)return;
      var alertDate=alertDateForSvc(sv)||addWeeks(ls,3);
      var days=daysDiff(alertDate);
      if(days===null||days<0||days>maxDays)return;
      var uid=_uid21(p,sv);
      if(store[uid])return;
      lista.push({p:p,sv:sv,days:days,ls:ls,uid:uid});
    });
  });
  lista.sort(function(a,b){return a.days-b.days;});
  return lista;
}
function _saveStore21(d){
  localStorage.setItem('d21_v2',JSON.stringify(d));
  try{supa.from('config').upsert({key:'agendadas_d21_v2',value:d,updated_at:new Date().toISOString()}).catch(function(){});}catch(e){}
}
function _uid21(p,sv){return 'u21_'+p.id+'_'+sv.id+'_'+(lastSesAny(sv)||'');}
// Clave para sincronizar el store "a contactar" con Supabase
function _agendaCheckKey(){ return 'd21_v2'; }
// Alternar estado agendada desde las alertas
function toggleAgendada(uid){
  var d=_getStore21();
  if(d[uid]) delete d[uid];
  else d[uid]={hora:new Date().toISOString()};
  _saveStore21(d);
  renderAlertsInicio();
}

function _contactar(uid, nombre, servicio){
  var d=_getStore21();
  d[uid]={nombre:nombre, servicio:servicio, hora:new Date().toISOString()};
  _saveStore21(d);
  renderAlertsInicio();
  renderContactBanner();
}
function _regresarContactada(uid){
  var d=_getStore21();
  delete d[uid];
  _saveStore21(d);
  renderAlertsInicio();
  renderContactBanner();
}

function renderAlertsInicio(){
  var el=document.getElementById('alertBannerInicio'); if(!el)return;
  var store=_getStore21();
  var maxDays=_getAlertDays();

  var pendientes=[], contactadas=[];
  patients.forEach(function(p){
    (p.servicios||[]).forEach(function(sv){
      var ls=lastSesAny(sv); if(!ls)return;
      var alertDate=alertDateForSvc(sv)||addWeeks(ls,3);
      var days=daysDiff(alertDate);
      if(days===null||days<0||days>maxDays)return;
      var uid=_uid21(p,sv);
      if(store[uid]) contactadas.push({p:p,sv:sv,days:days,ls:ls,uid:uid,info:store[uid]});
      else pendientes.push({p:p,sv:sv,days:days,ls:ls,uid:uid});
    });
  });

  pendientes.sort(function(a,b){return a.days-b.days;});

  if(!pendientes.length && !contactadas.length){
    el.innerHTML='<p style="color:var(--text-light);font-size:0.85rem;margin:0;">&#x2705; Sin pacientes para contactar en los próximos '+maxDays+' días.</p>';
    return;
  }

  var icoEye='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="pointer-events:none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var icoWA='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" style="pointer-events:none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var icoCheck='<svg width="11" height="11" viewBox="0 0 13 13" fill="none" style="pointer-events:none"><path d="M2 6.5L5.5 10L11 3" stroke="#6a8c5a" stroke-width="2.5" stroke-linecap="round"/></svg>';
  var icoUndo='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5a7a4a" stroke-width="2.5" stroke-linecap="round" style="pointer-events:none"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>';

  var html='<div style="border:1px solid #5a7a4a22;border-radius:11px;overflow:hidden;">';
  // Header
  html+='<div id="_d21hdr" style="display:flex;align-items:center;justify-content:space-between;padding:11px 15px;cursor:pointer;background:#5a7a4a08;user-select:none;">';
  html+='<div style="display:flex;align-items:center;gap:8px;">';
  html+='<span style="font-size:0.72rem;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#5a7a4a;">Pacientes a contactar</span>';
  if(pendientes.length) html+='<span style="font-size:0.7rem;background:#5a7a4a18;color:#5a7a4a;padding:1px 9px;border-radius:20px;font-weight:700;">'+pendientes.length+'</span>';
  if(contactadas.length) html+='<span style="font-size:0.7rem;background:#e8f0e8;color:#6a8c5a;padding:1px 9px;border-radius:20px;font-weight:700;">✓ '+contactadas.length+'</span>';
  html+='</div>';
  html+='<svg id="_d21arr" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5a7a4a" stroke-width="2.5" stroke-linecap="round" style="transition:transform 0.2s;pointer-events:none;"><polyline points="6 9 12 15 18 9"/></svg>';
  html+='</div>';
  html+='<div id="_d21body" style="padding:8px 12px;">';

  // Pendientes agrupados por urgencia
  window._d21p=pendientes;
  var _grupos=[
    {key:'hoy',      label:'Hoy',         emoji:'🔴', color:'#c0392b', bg:'#fef5f3', filter:function(it){return it.days===0;}},
    {key:'manana',   label:'Mañana',      emoji:'🟠', color:'#c47a00', bg:'#fef9f0', filter:function(it){return it.days===1;}},
    {key:'semana',   label:'Esta semana', emoji:'🟡', color:'#a08617', bg:'#fefcf0', filter:function(it){return it.days>=2&&it.days<=6;}},
    {key:'proximos', label:'Próximos',    emoji:'⚪', color:'#5a7a4a', bg:'#f5f8f3', filter:function(it){return it.days>=7;}}
  ];
  var _idxG=0;
  _grupos.forEach(function(g){
    var items=pendientes.filter(g.filter);
    if(!items.length) return;
    // Header del grupo
    html+='<div style="margin:10px 2px 6px 2px;display:flex;align-items:center;gap:6px;">';
    html+='<span style="font-size:0.72rem;">'+g.emoji+'</span>';
    html+='<span style="font-size:0.68rem;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:'+g.color+';">'+g.label+'</span>';
    html+='<span style="font-size:0.65rem;background:'+g.color+'18;color:'+g.color+';padding:1px 8px;border-radius:20px;font-weight:700;">'+items.length+'</span>';
    html+='</div>';
    // Items del grupo
    items.forEach(function(item){
      var i=_idxG++;
      var label=item.days===0?'Hoy':item.days===1?'Mañana':'En '+item.days+'d';
      html+='<div style="display:flex;align-items:center;gap:8px;padding:8px 6px;border-left:3px solid '+g.color+';margin-bottom:5px;border-radius:0 8px 8px 0;background:'+g.bg+';">';
      html+='<div style="flex:1;min-width:0;">';
      html+='<div style="font-weight:600;font-size:0.85rem;">'+item.p.nombre+' '+item.p.apellido+' '+cubTag(item.sv.cubiculo)+'</div>';
      html+='<div style="font-size:0.72rem;color:var(--text-light);">'+item.sv.servicio+' · última: '+fmtDate(item.ls)+'</div>';
      // Badges: plan frecuencia + WA disponible
      var _bdg='';
      if(item.sv.frecuenciaPlan) _bdg+='<span style="font-size:0.62rem;background:#eef3e9;color:#5a7a4a;padding:1px 6px;border-radius:10px;font-weight:600;">📆 '+item.sv.frecuenciaPlan+'d</span>';
      if(item.p.telefono) _bdg+='<span style="font-size:0.62rem;background:#e6f5ec;color:#128c7e;padding:1px 6px;border-radius:10px;font-weight:600;">📱 WA</span>';
      if(_bdg) html+='<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;">'+_bdg+'</div>';
      html+='</div>';
      html+='<span style="font-size:0.68rem;color:'+g.color+';font-weight:700;white-space:nowrap;margin-right:4px;">'+label+'</span>';
      html+='<div style="display:flex;gap:4px;flex-shrink:0;">';
      html+='<button id="_d21e'+i+'" style="width:28px;height:28px;border-radius:7px;border:1px solid var(--border);background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Ver ficha">'+icoEye+'</button>';
      html+='<button id="_d21w'+i+'" style="width:28px;height:28px;border-radius:7px;border:none;background:linear-gradient(135deg,#25d366,#128c7e);cursor:pointer;display:flex;align-items:center;justify-content:center;" title="WhatsApp">'+icoWA+'</button>';
      html+='<button id="_d21c'+i+'" style="width:28px;height:28px;border-radius:7px;border:1.5px solid #ccc;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Ya contacté">'+icoCheck+'</button>';
      html+='</div></div>';
    });
  });

  // Contactadas (colapsadas)
  if(contactadas.length){
    html+='<div id="_d21chdr" style="display:flex;align-items:center;gap:6px;padding:6px 4px;cursor:pointer;margin-top:4px;">';
    html+='<span style="font-size:0.7rem;font-weight:700;color:#6a8c5a;">✅ Ya contactadas · '+contactadas.length+'</span>';
    html+='<svg id="_d21carr" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6a8c5a" stroke-width="2.5" stroke-linecap="round" style="transform:rotate(-90deg);transition:transform 0.2s;pointer-events:none;"><polyline points="6 9 12 15 18 9"/></svg>';
    html+='</div>';
    html+='<div id="_d21cbody" style="display:none;">';
    window._d21c=contactadas;
    contactadas.forEach(function(item,i){
      var hora=item.info.hora?new Date(item.info.hora).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}):'';
      html+='<div style="display:flex;align-items:center;gap:8px;padding:6px 6px;border-left:3px solid #6a8c5a;margin-bottom:4px;border-radius:0 8px 8px 0;background:#f5fbf5;opacity:0.85;">';
      html+='<div style="flex:1;min-width:0;">';
      html+='<div style="font-weight:600;font-size:0.82rem;text-decoration:line-through;color:#6a8c5a;">'+item.p.nombre+' '+item.p.apellido+'</div>';
      html+='<div style="font-size:0.7rem;color:#8aac7a;">'+item.sv.servicio+(hora?' · '+hora:'')+'</div>';
      html+='</div>';
      html+='<button id="_d21u'+i+'" style="width:28px;height:28px;border-radius:7px;border:1px solid #b0d4b0;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Regresar a pendientes">'+icoUndo+'</button>';
      html+='</div>';
    });
    html+='</div>';
  }

  html+='</div></div>';
  el.innerHTML=html;

  // Toggle principal
  document.getElementById('_d21hdr').onclick=function(){
    var b=document.getElementById('_d21body');
    var a=document.getElementById('_d21arr');
    var open=b.style.display!=='none';
    b.style.display=open?'none':'block';
    if(a)a.style.transform=open?'rotate(-90deg)':'rotate(0deg)';
  };

  // Toggle contactadas
  var chdr=document.getElementById('_d21chdr');
  if(chdr) chdr.onclick=function(){
    var b=document.getElementById('_d21cbody');
    var a=document.getElementById('_d21carr');
    var open=b.style.display!=='none';
    b.style.display=open?'none':'block';
    if(a)a.style.transform=open?'rotate(-90deg)':'rotate(0deg)';
  };

  // Botones pendientes
  pendientes.forEach(function(item,i){
    var pid=String(item.p.id), sid=String(item.sv.id), uid=item.uid;
    var nombre=item.p.nombre+' '+item.p.apellido;
    var be=document.getElementById('_d21e'+i);
    var bw=document.getElementById('_d21w'+i);
    var bc=document.getElementById('_d21c'+i);
    if(be)be.onclick=function(e){e.stopPropagation();openDetail(pid);};
    if(bw)bw.onclick=function(e){e.stopPropagation();quickWa(pid,sid);};
    if(bc)bc.onclick=function(e){e.stopPropagation();_contactar(uid,nombre,item.sv.servicio);};
  });

  // Botones regresar
  contactadas.forEach(function(item,i){
    var bu=document.getElementById('_d21u'+i);
    if(bu)bu.onclick=function(e){e.stopPropagation();_regresarContactada(item.uid);};
  });
}

// ===== INICIO SEARCH =====
// ===== LISTENER DELEGADO PARA BOTONES DE PACIENTES A CONTACTAR =====
function _btn21Act(el, action){
  var row = el.closest ? el.closest('[data-uid]') : null;
  if(!row){ row = el; while(row && !row.getAttribute('data-uid')) row = row.parentElement; }
  if(!row) return;
  var uid = row.getAttribute('data-uid');
  var pid = row.getAttribute('data-pid');
  var sid = row.getAttribute('data-sid');
  if(action==='eye')   { openDetail(pid); }
  if(action==='wa')    { quickWa(pid, sid); }
  if(action==='check') { toggleAgendada(uid); }
  if(action==='del')   { descartarAlerta(uid); }
}

function inicioSearchFn(q){
  const drop=document.getElementById('inicioSearchDrop');
  if(!q.trim()){drop.classList.remove('open');return;}
  const results=patients.filter(p=>`${p.nombre} ${p.apellido}`.toLowerCase().includes(q.toLowerCase())).slice(0,8);
  if(!results.length){drop.innerHTML='<div class="search-result-item" style="color:var(--text-light);">Sin resultados</div>';drop.classList.add('open');return;}
  drop.innerHTML=results.map(p=>{
    const svcs=(p.servicios||[]).map(sv=>`<span class="cubiculo-tag c0${sv.cubiculo}">${sv.servicio.split(' ')[0]}</span>`).join(' ');
    const hasAlert=(p.servicios||[]).some(sv=>{const ad=alertDateForSvc(sv);return ad&&daysDiff(ad)<=7;});
    return`<div class="search-result-item" data-pid="${p.id}">
      <div><strong>${p.nombre} ${p.apellido}</strong>${hasAlert?'':''}<div style="margin-top:3px;">${svcs}</div></div>
      <div style="font-size:0.73rem;color:var(--text-light);">${p.telefono||''}</div>
    </div>`;
  }).join('');
  drop.classList.add('open');
  drop.querySelectorAll('[data-pid]').forEach(el=>{
    const pid = el.getAttribute('data-pid');
    el.addEventListener('pointerdown', function(e){
      e.preventDefault();
      document.getElementById('inicioSearch').value='';
      document.getElementById('inicioSearchDrop').classList.remove('open');
      openDetail(pid);
    }, {once:true});
  });
}

// ===== STATS =====
function renderStats(){
  const el=document.getElementById('statsRow');
  const totalSes=patients.reduce((a,p)=>a+(p.servicios||[]).reduce((b,sv)=>b+(sv.zonas||[]).reduce((c,z)=>c+z.sesiones.length,0),0),0);
  // Métricas extra
  const mesActual=new Date().toISOString().slice(0,7);
  const ingresosMes=(registros||[]).filter(r=>(r.fecha||'').startsWith(mesActual)).reduce((a,r)=>a+(parseFloat(r.total)||0),0);
  const nuevasMes=patients.filter(p=>(p.creadoEn||p.fechaInicio||'').startsWith(mesActual)).length;
  const todasSes=patients.flatMap(p=>(p.servicios||[]).flatMap(sv=>(sv.zonas||[]).flatMap(z=>z.sesiones||[])));
  const conFecha=todasSes.filter(s=>s.fecha);
  const asistidas=conFecha.filter(s=>s.asistio);
  const tasa=conFecha.length?Math.round(asistidas.length/conFecha.length*100):0;
  const sc=(n,label)=>`<div class="stat-card"><div class="stat-number" style="font-family:'DM Sans',sans-serif;font-size:2.4rem;font-weight:200;letter-spacing:4px;">${n}</div><div class="stat-label" style="font-size:0.62rem;letter-spacing:4px;text-transform:uppercase;margin-top:6px;">${label}</div></div>`;
  let h=sc(patients.length,'Pacientes');
  h+=sc(totalSes,'Sesiones Total');
  h+=sc('S/'+ingresosMes.toFixed(0),'Ingresos Mes');
  h+=sc(nuevasMes,'Nuevas este Mes');
  h+=sc(tasa+'%','Asistencia');
  SERVICES().forEach(s=>{const c=patients.filter(p=>(p.servicios||[]).some(sv=>sv.servicio===s)).length;h+=sc(c,s.split(' ').slice(0,2).join(' '));});
  el.innerHTML=h;
}


// ===== ALERTS (legacy - now handled by renderAlertsInicio) =====
function renderAlerts(){renderAlertsInicio();renderStatsInicio();}

// ===== PATIENTS GRID =====
let _sf='';
function renderContactBanner(list) {
  const el = document.getElementById('patContactBanner');
  if (!el) return;
  const lista = _getListaContactar().slice(0,6);
  if (!lista.length) { el.innerHTML=''; return; }
  const wasOpen = el.querySelector('.contact-dropdown') !== null;
  const chips = lista.map(item => {
    const days = item.days;
    const label = days===0?'Hoy':days===1?'Mañana':'En '+days+'d';
    const color = days===0?'#c0392b':days===1?'#c47a00':'#5a7a4a';
    return `<div class="contact-chip" onclick="openDetail('${item.p.id}')">
      <div class="contact-chip-avatar">${ini(item.p.nombre,item.p.apellido)}</div>
      <span class="contact-chip-name">${item.p.nombre} ${item.p.apellido}</span>
      <span class="contact-chip-days" style="color:${color};font-weight:600;">· ${label}</span>
    </div>`;
  }).join('');
  const toContact = lista;
  const dropdownHtml = wasOpen ? `<div class="contact-dropdown">${chips}</div>` : '';
  el.innerHTML = `
    <div class="contact-pill" onclick="toggleContactBanner(this)">
      <div class="contact-pill-dot"></div>
      <span class="contact-pill-text">${toContact.length} paciente${toContact.length!==1?'s':''} a contactar</span>
      <span class="contact-pill-arrow ${wasOpen?'open':''}">▾</span>
    </div>
    ${dropdownHtml}`;
}
function toggleContactBanner(pill) {
  const el = document.getElementById('patContactBanner');
  const arrow = pill.querySelector('.contact-pill-arrow');
  const existing = el.querySelector('.contact-dropdown');
  if (existing) { existing.remove(); arrow.classList.remove('open'); return; }
  arrow.classList.add('open');
  const lista2 = _getListaContactar().slice(0,6);
  const chips = lista2.map(item => {
    const days = item.days;
    const label = days===0?'Hoy':days===1?'Mañana':'En '+days+'d';
    const color = days===0?'#c0392b':days===1?'#c47a00':'#5a7a4a';
    return `<div class="contact-chip" onclick="openDetail('${item.p.id}')">
      <div class="contact-chip-avatar">${ini(item.p.nombre,item.p.apellido)}</div>
      <span class="contact-chip-name">${item.p.nombre} ${item.p.apellido}</span>
      <span class="contact-chip-days" style="color:${color};font-weight:600;">· ${label}</span>
    </div>`;
  }).join('');
  const dropdown = document.createElement('div');
  dropdown.className = 'contact-dropdown';
  dropdown.innerHTML = chips;
  el.appendChild(dropdown);
}

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
const MAX_FOTOS_POR_PACIENTE = 999; // Sin límite de cantidad

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

// ===== TRACKING =====
let _tf='';let _trkSort={col:'fecha',dir:-1};let _trkFilters={search:'',svc:'',month:'',cub:''};

function filterTracking(s,el){
  _tf=s;
  document.querySelectorAll('.service-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const sel=document.getElementById('trk-svc');if(sel)sel.value=s;
  _trkFilters.svc=s;
  renderTracking();
}

function applyTrackingFilters(){
  _trkFilters.search=(document.getElementById('trk-search')||{}).value||'';
  _trkFilters.svc=(document.getElementById('trk-svc')||{}).value||'';
  _trkFilters.cub=(document.getElementById('trk-cub')||{}).value||'';
  _trkFilters.fechaDesde=(document.getElementById('trk-fecha-desde')||{}).value||'';
  _trkFilters.fechaHasta=(document.getElementById('trk-fecha-hasta')||{}).value||'';
  _trkFilters.proximas=(document.getElementById('trk-proximas')||{}).value||'';
  _tf=_trkFilters.svc;
  renderTracking();
}

function clearTrackingFilters(){
  ['trk-search','trk-svc','trk-cub','trk-fecha-desde','trk-fecha-hasta','trk-proximas'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  _trkFilters={search:'',svc:'',cub:'',fechaDesde:'',fechaHasta:'',contacto:''};
  _tf='';
  document.querySelectorAll('.service-tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  renderTracking();
}

function sortTracking(col){
  if(_trkSort.col===col)_trkSort.dir*=-1;else{_trkSort.col=col;_trkSort.dir=-1;}
  ['nombre','servicio','fecha','proxima'].forEach(c=>{
    const el=document.getElementById('sort-'+c);
    if(el)el.textContent=(_trkSort.col===c)?(_trkSort.dir===-1?'↓':'↑'):'';
  });
  renderTracking();
}

// Calcular grupos de stats + guardar rows
let _trkStatsData={hoy:[],semana:[],'30':[],vencidas:[]};
function _trkComputeStatsData(){
  const out={hoy:[],semana:[],'30':[],vencidas:[]};
  const today=new Date();
  const domingo=new Date(today);domingo.setDate(today.getDate()+(7-today.getDay()));
  const domStr=domingo.toISOString().split('T')[0];
  const mes30=addDays(today.toISOString().split('T')[0],30);
  patients.forEach(p=>{
    (p.servicios||[]).forEach(sv=>{
      (sv.zonas||[]).forEach(z=>{
        const ult=[...(z.sesiones||[])].sort((a,b)=>(a.fecha||'')<(b.fecha||'')?1:-1)[0];
        if(!ult||!ult.fecha)return;
        const next=_nextForSes(sv,ult);if(!next)return;
        const nd=daysDiff(next);if(nd===null)return;
        const item={p,sv,z,s:ult,next,nd};
        if(nd===0)out.hoy.push(item);
        if(nd>=0&&next<=domStr)out.semana.push(item);
        if(nd>=0&&next<=mes30)out['30'].push(item);
        if(nd<0)out.vencidas.push(item);
      });
    });
  });
  Object.keys(out).forEach(k=>out[k].sort((a,b)=>a.next>b.next?1:-1));
  _trkStatsData=out;
}
function renderTrkStats(){
  const el=document.getElementById('trkStats');if(!el)return;
  _trkComputeStatsData();
  const d=_trkStatsData;
  const currentFilter=(document.getElementById('trk-proximas')||{}).value||'';
  const openKey=window._trkStatOpen||'';
  const statCard=(num,lbl,color,key)=>{
    const activo=currentFilter===key||openKey===key;
    const border=activo?'2px solid '+color:'1px solid var(--border)';
    const bg=activo?'linear-gradient(135deg,'+color+'15,'+color+'05)':'white';
    return `<div style="position:relative;"><div onclick="trkStatClick('${key}',event)" style="background:${bg};border:${border};border-radius:12px;padding:12px 14px;text-align:center;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'" onmouseout="this.style.transform='';this.style.boxShadow=''">`
      +`<div style="font-size:1.6rem;font-weight:300;color:${color};line-height:1;">${num}</div>`
      +`<div style="font-size:0.65rem;letter-spacing:2px;text-transform:uppercase;color:var(--text-light);margin-top:6px;">${lbl}</div>`
      +`<div style="font-size:0.62rem;color:${color};margin-top:4px;opacity:0.6;">${openKey===key?'▲ cerrar':'▼ ver lista'}</div>`
      +`</div>`
      +(openKey===key?_trkStatListHtml(key,color):'')
      +`</div>`;
  };
  el.innerHTML=statCard(d.hoy.length,'Hoy','var(--rose-dark)','hoy')+statCard(d.semana.length,'Esta semana','#c47a00','semana')+statCard(d['30'].length,'Próx. 30 días','var(--sage-dark)','30')+statCard(d.vencidas.length,'Vencidas','var(--red)','vencidas');
}
function _trkStatListHtml(key,color){
  const items=_trkStatsData[key]||[];
  if(!items.length) return '<div style="position:absolute;top:calc(100%+6px);left:0;right:0;background:white;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;font-size:0.8rem;color:var(--text-light);box-shadow:0 8px 24px rgba(0,0,0,0.1);z-index:100;">Sin registros</div>';
  let html='<div style="position:absolute;top:calc(100%+6px);left:0;right:0;background:white;border:1px solid var(--border);border-radius:10px;max-height:320px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:100;">';
  items.slice(0,30).forEach(it=>{
    const ndLabel=it.nd===0?'Hoy':it.nd===1?'Mañana':it.nd>0?'En '+it.nd+'d':'Hace '+Math.abs(it.nd)+'d';
    const ndColor=it.nd<0?'var(--red)':it.nd===0?'var(--rose-dark)':it.nd<=7?'#c47a00':'var(--sage-dark)';
    const tel=it.p.telefono?`<a href="https://wa.me/${it.p.telefono.replace(/\\D/g,'')}" target="_blank" onclick="event.stopPropagation()" style="color:#128c7e;text-decoration:none;font-size:0.72rem;">📱 WA</a>`:'';
    html+=`<div onclick="event.stopPropagation();window._trkStatOpen='';openDetail('${it.p.id}')" style="padding:10px 14px;border-bottom:1px solid #f5f0eb;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;" onmouseover="this.style.background='#faf5f0'" onmouseout="this.style.background=''">`
      +`<div style="flex:1;min-width:0;">`
        +`<div style="font-weight:600;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${it.p.nombre} ${it.p.apellido}</div>`
        +`<div style="font-size:0.7rem;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${it.sv.servicio} · ${it.z.nombre}</div>`
      +`</div>`
      +`<div style="text-align:right;flex-shrink:0;">`
        +`<div style="font-size:0.72rem;font-weight:700;color:${ndColor};">${fmtDate(it.next)}</div>`
        +`<div style="font-size:0.66rem;color:${ndColor};">${ndLabel}</div>`
      +`</div>`
      +(tel?`<div style="flex-shrink:0;">${tel}</div>`:'')
      +`</div>`;
  });
  if(items.length>30) html+=`<div style="padding:8px;text-align:center;font-size:0.72rem;color:var(--text-light);">...y ${items.length-30} más. Usa el filtro en la tabla.</div>`;
  html+='</div>';
  return html;
}
function trkStatClick(key,ev){
  if(ev)ev.stopPropagation();
  if(window._trkStatOpen===key){
    window._trkStatOpen='';
  } else {
    window._trkStatOpen=key;
  }
  renderTrkStats();
}
// Cerrar al click fuera
document.addEventListener('click',function(e){
  if(!e.target.closest('#trkStats')&&window._trkStatOpen){
    window._trkStatOpen='';
    if(document.getElementById('trkStats'))renderTrkStats();
  }
});
// Sync scrollbar superior con inferior
function _trkSyncScroll(origin){
  const top=document.getElementById('trkTopScroll');
  const bottom=document.getElementById('trkTableContainer');
  if(!top||!bottom)return;
  if(origin==='top') bottom.scrollLeft=top.scrollLeft;
  else top.scrollLeft=bottom.scrollLeft;
}
function _trkResizeTopScroll(){
  const table=document.getElementById('trkTable');
  const inner=document.getElementById('trkTopScrollInner');
  if(!table||!inner)return;
  inner.style.width=table.scrollWidth+'px';
}
function renderTracking(){
  renderTrkStats();
  const tb=document.getElementById('trackingBody');let rows=[];
  const f=_trkFilters;

  patients.forEach(p=>{
    const fullName=`${p.nombre} ${p.apellido}`.toLowerCase();
    if(f.search&&!fullName.includes(f.search.toLowerCase()))return;
    (p.servicios||[]).forEach(sv=>{
      if(f.svc&&sv.servicio!==f.svc)return;
      if(f.cub&&sv.cubiculo!==f.cub)return;
      (sv.zonas||[]).forEach(z=>z.sesiones.forEach((s,i)=>{
        if(f.fechaDesde&&s.fecha&&s.fecha<f.fechaDesde)return;
        if(f.fechaHasta&&s.fecha&&s.fecha>f.fechaHasta)return;
        // Filtro próximas sesiones
        if(f.proximas){
          const next=s.fecha?_nextForSes(sv,s):'';
          if(!next)return;
          const nd=daysDiff(next);
          if(nd===null)return;
          if(f.proximas==='hoy'&&nd!==0)return;
          if(f.proximas==='vencidas'&&nd>=0)return;
          if(f.proximas==='semana'){
            const today=new Date();const domingo=new Date(today);domingo.setDate(today.getDate()+(7-today.getDay()));
            const domStr=domingo.toISOString().split('T')[0];
            if(nd<0||next>domStr)return;
          }
          if(['7','14','30'].includes(f.proximas)){
            const max=parseInt(f.proximas);
            if(nd<0||nd>max)return;
          }
        }
        rows.push({p,sv,z,s,i});
      }));
    });
  });

  // Sort
  rows.sort((a,b)=>{
    let va,vb;
    const c=_trkSort.col;
    if(c==='nombre')va=`${a.p.nombre} ${a.p.apellido}`,vb=`${b.p.nombre} ${b.p.apellido}`;
    else if(c==='servicio')va=a.sv.servicio,vb=b.sv.servicio;
    else if(c==='proxima'){va=a.s.fecha?_nextForSes(a.sv,a.s):'';vb=b.s.fecha?_nextForSes(b.sv,b.s):'';}
    else va=a.s.fecha||'',vb=b.s.fecha||'';
    if(va<vb)return _trkSort.dir;if(va>vb)return -_trkSort.dir;return 0;
  });

  // Update count
  const countEl=document.getElementById('trackingCount');
  if(countEl)countEl.textContent=`${rows.length} registro${rows.length!==1?'s':''}`;

  if(!rows.length){tb.innerHTML='<tr><td colspan="15" style="text-align:center;padding:28px;color:var(--text-light);">Sin resultados para esta búsqueda.</td></tr>';return;}
  // Agrupar por paciente si toggle activo
  if(_trkGrouped){
    const groups={};
    rows.forEach(r=>{const k=r.p.id;if(!groups[k])groups[k]={p:r.p,rows:[]};groups[k].rows.push(r);});
    let html='';
    Object.values(groups).forEach(g=>{
      html+=`<tr style="background:linear-gradient(90deg,#fff7f0,#fff);"><td colspan="15" style="padding:8px 12px;font-weight:600;color:var(--rose-dark);border-top:2px solid var(--rose-light);cursor:pointer;" onclick="openDetail('${g.p.id}')">👤 ${g.p.nombre} ${g.p.apellido} · ${g.rows.length} sesiones ${g.p.telefono?' · 📱 '+g.p.telefono:''}</td></tr>`;
      html+=g.rows.map(r=>_trkRowHtml(r)).join('');
    });
    tb.innerHTML=html;
  } else {
    tb.innerHTML=rows.map(r=>_trkRowHtml(r)).join('');
  }
  _trkStoreRows=rows;
  _trkUpdateBulkUI();
  setTimeout(()=>_trkResizeTopScroll(),50);
}
function _trkRowHtml({p,sv,z,s,i}){
  const next=s.fecha?_nextForSes(sv,s):'';
  const nd=next?daysDiff(next):null;
  const esHoy=nd===0;
  const nextStyle=nd!==null&&nd<0?'color:var(--red);font-weight:700;':esHoy?'color:var(--rose-dark);font-weight:700;':nd!==null&&nd<=7?'color:#c47a00;font-weight:600;':'';
  const frecTag=s.frecuencia_dias?`<span style="margin-left:4px;font-size:0.68rem;background:var(--sage-light);color:var(--sage-dark);border-radius:10px;padding:1px 6px;">${s.frecuencia_dias}d</span>`:'';
  const tienTel=!!p.telefono;
  const waBtn=tienTel
    ?`<button onclick="quickWa('${p.id}','${sv.id}')" title="Enviar recordatorio por WhatsApp" style="background:linear-gradient(135deg,#25d366,#128c7e);color:white;border:none;border-radius:16px;padding:4px 10px;font-size:0.72rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>WA</button>`
    :`<span style="color:var(--text-light);font-size:0.7rem;">Sin tel.</span>`;
  const rowBg=esHoy?'background:rgba(184,124,124,0.08);':'';
  const selKey=`${p.id}__${sv.id}__${z.nombre}__${i}`;
  return`<tr style="${rowBg}">
    <td style="text-align:center;"><input type="checkbox" class="trk-sel" data-sel="${selKey}" onchange="_trkUpdateBulkUI()"></td>
    <td>${monthName(s.fecha)}</td>
    <td style="white-space:nowrap;">${fmtDate(s.fecha)}</td>
    <td style="cursor:pointer;font-weight:500;white-space:nowrap;" onclick="openDetail('${p.id}')">${p.nombre} ${p.apellido}</td>
    <td style="white-space:nowrap;">${sv.servicio}</td>
    <td>${z.nombre}</td>
    <td style="text-align:center;">${i+1}</td>
    <td style="white-space:nowrap;cursor:pointer;${nextStyle}" onclick="openProximaModal('${p.id}','${sv.id}','${z.nombre}',${i})" title="Click para reagendar/confirmar">${fmtDate(next)}${frecTag}${esHoy?' 📅':nd!==null&&nd<0?' !':''}</td>
    <td>${waBtn}</td>
    <td><button class="${s.asistio?'on-badge':'off-badge'}" onclick="togAsistioTrk('${p.id}','${sv.id}','${z.nombre}',${i})">${s.asistio?'✓ Sí':'— No'}</button></td>
    <td>${s.plan||sv.plan}</td>
    <td>${s.atencion||'—'}</td>
    <td style="max-width:140px;">
      <input type="text" value="${(s.comentarios||'').replace(/"/g,'&quot;')}" placeholder="Notas..." onchange="_trkEditNota('${p.id}','${sv.id}','${z.nombre}',${i},this.value)" style="width:100%;border:1px solid transparent;background:transparent;padding:4px 6px;border-radius:6px;font-size:0.77rem;font-family:inherit;" onfocus="this.style.border='1px solid var(--border)';this.style.background='white';" onblur="this.style.border='1px solid transparent';this.style.background='transparent';">
    </td>
    <td>${cubTag(sv.cubiculo)}</td>
  </tr>`;
}
// === MEJORAS SEGUIMIENTO: estado, agrupar, bulk, export, notas inline, próxima modal ===
let _trkGrouped=false;
let _trkStoreRows=[];
function trkToggleGroup(){
  _trkGrouped=!_trkGrouped;
  const btn=document.getElementById('trkGroupBtn');
  if(btn)btn.innerHTML=_trkGrouped?'📋 Ver lista':'👥 Agrupar por paciente';
  renderTracking();
}
function trkToggleSelectAll(checked){
  document.querySelectorAll('.trk-sel').forEach(cb=>cb.checked=checked);
  _trkUpdateBulkUI();
}
function _trkUpdateBulkUI(){
  const selected=document.querySelectorAll('.trk-sel:checked');
  const count=selected.length;
  const cEl=document.getElementById('trkBulkCount');
  const bEl=document.getElementById('trkBulkBtn');
  if(cEl){cEl.textContent=count>0?count+' seleccionada'+(count!==1?'s':''):'';cEl.style.display=count>0?'inline':'none';}
  if(bEl)bEl.style.display=count>0?'inline-block':'none';
}
function trkMarkSelected(){
  const selected=document.querySelectorAll('.trk-sel:checked');
  if(!selected.length)return;
  if(!confirm(`¿Marcar ${selected.length} sesiones como asistió?`))return;
  let changed=0;
  selected.forEach(cb=>{
    const key=cb.getAttribute('data-sel');
    const [pid,svId,zona,siStr]=key.split('__');
    const p=patients.find(x=>String(x.id)===String(pid));
    if(!p)return;
    const sv=(p.servicios||[]).find(x=>String(x.id)===String(svId));
    if(!sv)return;
    const z=(sv.zonas||[]).find(x=>x.nombre===zona);
    if(!z)return;
    const s=z.sesiones[parseInt(siStr)];
    if(s&&!s.asistio){s.asistio=true;changed++;}
  });
  if(changed>0){save();renderTracking();renderStats();renderTrkStats();showToast(`✅ ${changed} asistencias marcadas`,'var(--sage-dark)');}
}
function _trkEditNota(pid,svId,zona,si,val){
  const p=patients.find(x=>String(x.id)===String(pid));
  if(!p)return;
  const sv=(p.servicios||[]).find(x=>String(x.id)===String(svId));
  if(!sv)return;
  const z=(sv.zonas||[]).find(x=>x.nombre===zona);
  if(!z)return;
  const s=z.sesiones[parseInt(si)];
  if(!s)return;
  s.comentarios=val;
  save();
  showToast('✏ Nota guardada','var(--sage-dark)',1500);
}
function trkExportExcel(){
  const rows=_trkStoreRows||[];
  if(!rows.length){showToast('Sin datos para exportar','#c47a00');return;}
  const data=rows.map(({p,sv,z,s,i})=>{
    const next=s.fecha?_nextForSes(sv,s):'';
    return {
      'Paciente': p.nombre+' '+p.apellido,
      'Teléfono': p.telefono||'',
      'Servicio': sv.servicio||'',
      'Cubículo': sv.cubiculo||'',
      'Zona': z.nombre||'',
      'Mes': monthName(s.fecha),
      'Fecha': fmtDate(s.fecha),
      'Sesión #': i+1,
      'Próxima': fmtDate(next),
      'Frecuencia (días)': s.frecuencia_dias||'',
      'Asistió': s.asistio?'Sí':'No',
      'Plan': s.plan||sv.plan||'',
      'Atendió': s.atencion||'',
      'Rate (J)': s.rate||'',
      'Pulse (ms)': s.pulse||'',
      'CM²': s.cm2||'',
      'Notas': s.comentarios||''
    };
  });
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(data);
  ws['!cols']=[{wch:26},{wch:14},{wch:20},{wch:10},{wch:20},{wch:12},{wch:12},{wch:9},{wch:12},{wch:14},{wch:9},{wch:12},{wch:14},{wch:9},{wch:9},{wch:9},{wch:35}];
  XLSX.utils.book_append_sheet(wb,ws,'Seguimiento');
  const hoy=new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb,`Seguimiento_${hoy}.xlsx`);
  showToast('📊 Excel descargado','var(--sage-dark)');
}
// === MODAL PRÓXIMA SESIÓN (confirmar/reagendar) ===
let _proxSesPid=null,_proxSesSvId=null,_proxSesZona=null,_proxSesIdx=null;
function openProximaModal(pid,svId,zona,si){
  const p=patients.find(x=>String(x.id)===String(pid));if(!p)return;
  const sv=(p.servicios||[]).find(x=>String(x.id)===String(svId));if(!sv)return;
  const z=(sv.zonas||[]).find(x=>x.nombre===zona);if(!z)return;
  const s=z.sesiones[si];if(!s)return;
  _proxSesPid=pid;_proxSesSvId=svId;_proxSesZona=zona;_proxSesIdx=si;
  const next=_nextForSes(sv,s);
  const txt=document.getElementById('proxInfo');
  if(txt)txt.innerHTML=`<strong>${p.nombre} ${p.apellido}</strong> · ${sv.servicio} · ${z.nombre}<br><span style="color:var(--text-light);font-size:0.8rem;">Última sesión: ${fmtDate(s.fecha)} · Próxima sugerida: ${fmtDate(next)}</span>`;
  const frecEl=document.getElementById('proxFrecInput');
  if(frecEl)frecEl.value=s.frecuencia_dias||'';
  document.getElementById('proximaModal').style.display='flex';
}
function closeProximaModal(){document.getElementById('proximaModal').style.display='none';}
function proxAction(accion){
  const p=patients.find(x=>String(x.id)===String(_proxSesPid));if(!p)return;
  const sv=(p.servicios||[]).find(x=>String(x.id)===String(_proxSesSvId));if(!sv)return;
  const z=(sv.zonas||[]).find(x=>x.nombre===_proxSesZona);if(!z)return;
  const s=z.sesiones[_proxSesIdx];if(!s)return;
  if(accion==='wa'){
    closeProximaModal();
    quickWa(p.id,sv.id);return;
  }
  if(accion==='guardar'){
    const frecEl=document.getElementById('proxFrecInput');
    const nuevaFrec=parseInt(frecEl?.value)||0;
    if(nuevaFrec>0)s.frecuencia_dias=nuevaFrec;
    else delete s.frecuencia_dias;
    save();
    closeProximaModal();
    renderTracking();
    showToast('✅ Frecuencia actualizada','var(--sage-dark)');
  }
}

// Calcula la próxima fecha respetando frecuencia_dias de la sesión si existe
function _nextForSes(sv,s){
  if(!s.fecha) return '';
  if(s.frecuencia_dias) return addDays(s.fecha, s.frecuencia_dias);
  const w=sv.servicio==='Depilación Láser'?4:3;
  return addWeeks(s.fecha,w);
}
function togContacto(pid,svId,zona,si){
  const p=patients.find(x=>String(x.id)===String(pid));
  if(!p){ console.warn('Paciente no encontrado en togContacto'); return; }
  const sv=(p.servicios||[]).find(x=>x.id==svId);
  if(!sv)return;
  const z=(sv.zonas||[]).find(z=>z.nombre===zona);
  if(!z)return;
  const s=z.sesiones[si];
  if(s){s.contactado=!s.contactado;save();renderTracking();}
}
function togAsistioTrk(pid,svId,zona,si){
  const p=patients.find(x=>String(x.id)===String(pid));
  if(!p){ console.warn('Paciente no encontrado en togAsistioTrk'); return; }
  const sv=(p.servicios||[]).find(x=>x.id==svId);
  if(!sv)return;
  const z=(sv.zonas||[]).find(z=>z.nombre===zona);
  if(!z)return;
  const s=z.sesiones[si];
  if(s){s.asistio=!s.asistio;save();renderTracking();renderStats();}
}

// ===== WHATSAPP =====
const LASER_TPL=`Hola [Nombre]! Queremos recordarte que tu proxima sesion de *Depilacion Laser* esta por llegar. Agenda tu turno cuando quieras eligiendo el dia y horario que mas te convenga:

[Link]

Te esperamos con todo preparado para ti!`;
const WA_TPL_DEFAULT={
  1:`Hola [Nombre]! Desde *Elle Studio* te recordamos que tu proxima sesion de *[Servicio]* esta por llegar.

Agenda tu turno aqui:
[Link]

Te esperamos!`,
  2:`Hola [Nombre]! Te recordamos que *manana* tienes tu sesion de *[Servicio]* en *Elle Studio*.

Av. Paz Soldan 235, San Isidro, Lima, Peru
https://maps.google.com/?q=-12.0977,-77.0365
Hora segun tu reserva

- Llega 5 minutos antes
- Zona limpia y sin cremas
- Ropa comoda

Te esperamos!`,
  3:`Hola [Nombre]! Hoy es tu sesion de *[Servicio]* en *Elle Studio*!

Av. Paz Soldan 235, San Isidro, Lima, Peru
https://maps.google.com/?q=-12.0977,-77.0365

Recuerda:
- Zona limpia y sin cremas
- Ropa comoda
- Hidratate bien

Te esperamos hoy!`
};
let waTpls=JSON.parse(localStorage.getItem('elleWaTpls')||'{}');
let waCustomCards=JSON.parse(localStorage.getItem('elleWaCustom')||'[]');
let waServiceTpls=JSON.parse(localStorage.getItem('elleWaSvcTpls')||'{}');
const PC_TPL_DEFAULTS={
  confirmacion:`Hola [Nombre]! ✨\n\nTu separación para *[Servicio]* en *Elle Studio* está registrada.\n\nElige tu horario aquí:\n[Link]\n\nAv. Paz Soldan 235, San Isidro, Lima, Peru\nhttps://maps.google.com/?q=Av+Paz+Soldan+235+San+Isidro+Lima+Peru\n\n¡Te esperamos! 🌸`,
  dia_antes:`Hola [Nombre]! ⏰\n\nTe recordamos que *mañana* tienes tu sesión de *[Servicio]* en *Elle Studio*.\n\nAv. Paz Soldan 235, San Isidro, Lima, Peru\nhttps://maps.google.com/?q=Av+Paz+Soldan+235+San+Isidro+Lima+Peru\n\nRecuerda:\n- Zona limpia y sin cremas\n- Ropa cómoda\n\n¡Te esperamos! 🌸`,
  mismo_dia:`Hola [Nombre]! 💜\n\nHoy es tu sesión de *[Servicio]* en *Elle Studio*!\n\nAv. Paz Soldan 235, San Isidro, Lima, Peru\nhttps://maps.google.com/?q=Av+Paz+Soldan+235+San+Isidro+Lima+Peru\n\nRecuerda:\n- Zona limpia y sin cremas\n- Ropa cómoda\n- Hidrátate bien\n\n¡Te esperamos! ✨`
};
let preCitaTemplates=JSON.parse(localStorage.getItem('ellePcTemplates')||'null')||{...PC_TPL_DEFAULTS};
// Migrar template viejo si existe
(function(){const old=localStorage.getItem('ellePcTemplate');if(old){try{preCitaTemplates.confirmacion=JSON.parse(old);localStorage.removeItem('ellePcTemplate');}catch(e){}}})();
function getWaTpl(n){return waTpls[n]||WA_TPL_DEFAULT[n];}
const WA_TPL=WA_TPL_DEFAULT;

function populateWaSelects(){
  // Now patient selection is via search input, just clear dropdowns
  [1,2,3].forEach(n=>{
    const svcSel=document.getElementById(`waP${n}svc`);
    if(svcSel) svcSel.innerHTML='<option value="">Servicio...</option>';
  });
  renderWaCustomCards();
  initWaTemplates();
}
function initWaTemplates(){
  // Load saved templates into textareas
  [1,2,3].forEach(n=>{
    const ta=document.getElementById(`waTpl${n}`);
    if(ta) ta.value=getWaTpl(n);
    const preview=document.getElementById(`waMsg${n}`);
    if(preview) preview.textContent=getWaTpl(n);
  });
}
function filterWaPatients(n){
  const query=document.getElementById(`waSearch${n}`).value.toLowerCase();
  const dd=document.getElementById(`waDropdown${n}`);
  if(!query){dd.style.display='none';return;}
  const matches=patients.filter(p=>(p.nombre+' '+p.apellido).toLowerCase().includes(query)).slice(0,8);
  if(!matches.length){dd.style.display='none';return;}
  dd.innerHTML=matches.map(p=>`<div data-wapid="${p.id}" style="padding:13px 14px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid #f5f0eb;min-height:44px;display:flex;align-items:center;" onmouseover="this.style.background='#fdf8f5'" onmouseout="this.style.background=''">${escapeHtml(p.nombre)} ${escapeHtml(p.apellido)}${p.telefono?' · '+escapeHtml(p.telefono):''}</div>`).join('');
  dd.querySelectorAll('[data-wapid]').forEach(el=>{
    const pid=el.getAttribute('data-wapid');
    el.addEventListener('pointerdown',function(e){e.preventDefault();selectWaPatient(n,pid);},{once:true});
  });
  dd.style.display='block';
}
function selectWaPatient(n,pid){
  const p=patients.find(x=>String(x.id)===String(pid));
  if(!p)return;
  document.getElementById(`waSearch${n}`).value=p.nombre+' '+p.apellido;
  document.getElementById(`waP${n}`).value=p.id;
  document.getElementById(`waDropdown${n}`).style.display='none';
  updateWaSvcOptions(n);
}
function updateWaSvcOptions(n){
  const pid=document.getElementById(`waP${n}`).value;
  const svcSel=document.getElementById(`waP${n}svc`);
  const p=patients.find(x=>String(x.id)===String(pid));
  if(!p){svcSel.innerHTML='<option value="">Servicio...</option>';return;}
  svcSel.innerHTML='<option value="">Seleccionar...</option>'+(p.servicios||[]).map(sv=>`<option value="${sv.id}">${sv.servicio} · Cub.${sv.cubiculo}</option>`).join('');
  updateWa(n);
}
function updateWa(n){
  const pid=document.getElementById(`waP${n}`).value;
  const svId=document.getElementById(`waP${n}svc`)?.value;
  document.getElementById(`waMsg${n}`).textContent=buildMsg(n,pid,svId);
}
function toggleEditWa(n){
  const editDiv=document.getElementById(`waEdit${n}`);
  const ta=document.getElementById(`waTpl${n}`);
  if(editDiv.style.display==='none'){
    ta.value=getWaTpl(n);
    editDiv.style.display='block';
  } else {
    editDiv.style.display='none';
  }
}
function saveWaTpl(n){
  const ta=document.getElementById(`waTpl${n}`);
  waTpls[n]=ta.value;
  localStorage.setItem('elleWaTpls',JSON.stringify(waTpls));
  supaSaveWaTpls().catch(()=>showToast('⚠️ Guardado local pero no en la nube','#c46060'));
  document.getElementById(`waEdit${n}`).style.display='none';
  updateWa(n);
  showToast('✅ Mensaje guardado','#6a8c5a');
}
function cancelEditWa(n){document.getElementById(`waEdit${n}`).style.display='none';}
function resetWaTpl(n){
  if(!confirm('¿Restaurar el mensaje original?'))return;
  delete waTpls[n];
  localStorage.setItem('elleWaTpls',JSON.stringify(waTpls));
  supaSaveWaTpls().catch(()=>{});
  document.getElementById(`waTpl${n}`).value=WA_TPL_DEFAULT[n];
  document.getElementById(`waEdit${n}`).style.display='none';
  updateWa(n);
  showToast('↺ Mensaje restaurado','var(--sage-dark)');
}
// === PLANTILLAS POR SERVICIO ===
function openWaSvcTplModal(){
  const sel=document.getElementById('waSvcTplSelect');
  sel.textContent='';
  SERVICES().forEach(s=>{
    const o=document.createElement('option');o.value=s;o.textContent=s;
    if(waServiceTpls[s])o.textContent=s+' ✓';
    sel.appendChild(o);
  });
  loadSvcTpl();
  document.getElementById('waSvcTplModal').style.display='flex';
}
function closeWaSvcTplModal(){document.getElementById('waSvcTplModal').style.display='none';}
function loadSvcTpl(){
  const svc=document.getElementById('waSvcTplSelect').value;
  document.getElementById('waSvcTplBody').value=waServiceTpls[svc]||'';
}
function saveSvcTpl(){
  const svc=document.getElementById('waSvcTplSelect').value;
  const body=document.getElementById('waSvcTplBody').value.trim();
  if(body) waServiceTpls[svc]=body;
  else delete waServiceTpls[svc];
  localStorage.setItem('elleWaSvcTpls',JSON.stringify(waServiceTpls));
  supaSaveWaSvcTpls().catch(()=>showToast('⚠️ Guardado local pero no en la nube','#c46060'));
  closeWaSvcTplModal();
  showToast('✅ Plantilla guardada','#6a8c5a');
}
function clearSvcTpl(){
  const svc=document.getElementById('waSvcTplSelect').value;
  if(!waServiceTpls[svc]){showToast('No hay plantilla para este servicio','var(--text-light)');return;}
  if(!confirm('¿Borrar la plantilla de '+svc+'? Se usará el mensaje genérico.'))return;
  delete waServiceTpls[svc];
  localStorage.setItem('elleWaSvcTpls',JSON.stringify(waServiceTpls));
  supaSaveWaSvcTpls().catch(()=>{});
  document.getElementById('waSvcTplBody').value='';
  showToast('🗑 Plantilla eliminada','#c46060');
}
function renderWaCustomCards(){
  const container=document.getElementById('waCustomCards');
  if(!container)return;
  container.innerHTML=waCustomCards.map((card,i)=>`
    <div class="wa-card" id="waCustomCard-${i}" style="border-left:3px solid var(--rose);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <h3 style="margin:0;" id="waTitleH3-${i}"></h3>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary" style="font-size:0.72rem;padding:4px 10px;" onclick="editCustomCard(${i})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>
          <button class="btn" style="font-size:0.72rem;padding:4px 10px;background:#fdf0ef;border:1px solid #e8c5c5;color:#c0696a;" onclick="deleteCustomCard(${i})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div>
      </div>
      <div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <div style="position:relative;flex:1;min-width:180px;">
          <input id="waSearchC${i}" class="search-box" placeholder="🔍 Buscar paciente..." oninput="filterWaCustom(${i})" autocomplete="off" style="width:100%;box-sizing:border-box;">
          <div id="waDropdownC${i}" style="display:none;position:absolute;top:100%;left:0;right:0;background:white;border:1px solid var(--border);border-radius:8px;max-height:180px;overflow-y:auto;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
        </div>
        <input type="hidden" id="waPidC${i}" value="">
        <select id="waSvcC${i}" class="search-box" style="width:auto;flex:0;" onchange="updateCustomPreview(${i})"><option value="">Servicio...</option></select>
      </div>
      <div class="wa-preview" id="waMsgC${i}"></div>
      <div id="waEditC${i}" style="display:none;margin-top:8px;">
        <input id="waTitleC${i}" class="search-box" style="margin-bottom:8px;">
        <textarea id="waBodyC${i}" style="width:100%;min-height:100px;border-radius:10px;border:1px solid var(--border);padding:10px;font-family:inherit;font-size:0.85rem;resize:vertical;box-sizing:border-box;"></textarea>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button class="btn btn-primary" style="font-size:0.75rem;" onclick="saveCustomCardEdit(${i})">💾 Guardar</button>
          <button class="btn btn-secondary" style="font-size:0.75rem;" onclick="document.getElementById('waEditC${i}').style.display='none'">✕</button>
        </div>
      </div>
      <div class="wa-actions">
        <button class="btn btn-green" onclick="sendCustomWa(${i})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Enviar WhatsApp</button>
        <button class="btn btn-secondary" onclick="copyCustomWa(${i})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar</button>
      </div>
    </div>`).join('');
  // Asignar contenido via textContent/.value para que emojis y caracteres especiales se manejen correctamente
  waCustomCards.forEach((card,i)=>{
    const h3=document.getElementById(`waTitleH3-${i}`);
    if(h3)h3.textContent=`✨ ${card.title}`;
    const preview=document.getElementById(`waMsgC${i}`);
    if(preview)preview.textContent=card.body;
    const bodyTA=document.getElementById(`waBodyC${i}`);
    if(bodyTA)bodyTA.value=card.body;
    const titleIN=document.getElementById(`waTitleC${i}`);
    if(titleIN)titleIN.value=card.title;
    populateCustomSvcSelect(i);
  });
}
function filterWaCustom(i){
  const query=document.getElementById(`waSearchC${i}`).value.toLowerCase();
  const dd=document.getElementById(`waDropdownC${i}`);
  if(!query){dd.style.display='none';return;}
  const matches=patients.filter(p=>(p.nombre+' '+p.apellido).toLowerCase().includes(query)).slice(0,8);
  if(!matches.length){dd.style.display='none';return;}
  dd.innerHTML=matches.map(p=>`<div data-cpid="${p.id}" style="padding:13px 14px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid #f5f0eb;min-height:44px;display:flex;align-items:center;" onmouseover="this.style.background='#fdf8f5'" onmouseout="this.style.background=''">${escapeHtml(p.nombre)} ${escapeHtml(p.apellido)}</div>`).join('');
  dd.querySelectorAll('[data-cpid]').forEach(el=>{
    const pid=el.getAttribute('data-cpid');
    el.addEventListener('pointerdown',function(e){e.preventDefault();selectCustomPatient(i,pid);},{once:true});
  });
  dd.style.display='block';
}
function populateCustomSvcSelect(i){
  const sel=document.getElementById(`waSvcC${i}`);
  if(!sel)return;
  const svcs=SERVICES();
  sel.textContent='';
  const def=document.createElement('option');def.value='';def.textContent='Servicio...';sel.appendChild(def);
  svcs.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;sel.appendChild(o);});
}
function updateCustomPreview(i){
  const pid=document.getElementById(`waPidC${i}`).value;
  const p=patients.find(x=>String(x.id)===String(pid));
  const svc=document.getElementById(`waSvcC${i}`)?.value||'';
  const nombre=p?p.nombre:'[Nombre]';
  const msg=waCustomCards[i].body.replace(/\[Nombre\]/g,nombre).replace(/\[Servicio\]/g,svc||'[Servicio]').replace(/\[Dirección\]/g,"Av. Paz Sold\u00e1n 235, San Isidro, Lima, Per\u00fa\nhttps://maps.google.com/?q=-12.0977,-77.0365");
  document.getElementById(`waMsgC${i}`).textContent=msg;
}
function selectCustomPatient(i,pid){
  const p=patients.find(x=>String(x.id)===String(pid));
  if(!p)return;
  document.getElementById(`waSearchC${i}`).value=p.nombre+' '+p.apellido;
  document.getElementById(`waPidC${i}`).value=p.id;
  document.getElementById(`waDropdownC${i}`).style.display='none';
  updateCustomPreview(i);
}
function sendCustomWa(i){
  const pid=document.getElementById(`waPidC${i}`).value;
  const p=patients.find(x=>String(x.id)===String(pid));
  const svc=document.getElementById(`waSvcC${i}`)?.value||'';
  const msg=waCustomCards[i].body.replace(/\[Nombre\]/g,p?p.nombre:'[Nombre]').replace(/\[Servicio\]/g,svc||'[Servicio]').replace(/\[Dirección\]/g,"Av. Paz Sold\u00e1n 235, San Isidro, Lima, Per\u00fa\nhttps://maps.google.com/?q=-12.0977,-77.0365");
  if(p&&p.telefono) sendWaClipboard(p.telefono, msg);
  else navigator.clipboard.writeText(msg).then(()=>showToast('Copiado','var(--sage-dark)'));
}
function copyCustomWa(i){
  const pid=document.getElementById(`waPidC${i}`).value;
  const p=patients.find(x=>String(x.id)===String(pid));
  const svc=document.getElementById(`waSvcC${i}`)?.value||'';
  const msg=waCustomCards[i].body.replace(/\[Nombre\]/g,p?p.nombre:'[Nombre]').replace(/\[Servicio\]/g,svc||'[Servicio]').replace(/\[Dirección\]/g,"Av. Paz Sold\u00e1n 235, San Isidro, Lima, Per\u00fa\nhttps://maps.google.com/?q=-12.0977,-77.0365");
  navigator.clipboard.writeText(msg).then(()=>showToast('Copiado','var(--sage-dark)'));
}
function deleteCustomCard(i){
  if(!confirm('⚠️ ¿Estás segura de eliminar este mensaje?'))return;
  waCustomCards.splice(i,1);
  localStorage.setItem('elleWaCustom',JSON.stringify(waCustomCards));
  supaSaveWaCustom().catch(()=>showToast('⚠️ Borrado local pero no en la nube','#c46060'));
  renderWaCustomCards();
}
function editCustomCard(i){
  document.getElementById(`waEditC${i}`).style.display='block';
}
function saveCustomCardEdit(i){
  waCustomCards[i].title=document.getElementById(`waTitleC${i}`).value;
  waCustomCards[i].body=document.getElementById(`waBodyC${i}`).value;
  localStorage.setItem('elleWaCustom',JSON.stringify(waCustomCards));
  supaSaveWaCustom().catch(()=>showToast('⚠️ Guardado local pero no en la nube','#c46060'));
  renderWaCustomCards();
  showToast('✅ Guardado','#6a8c5a');
}
function openNewWaCard(){
  const t=document.getElementById('waNewTitle');
  const b=document.getElementById('waNewBody');
  if(t)t.value='';
  if(b)b.value='';
  document.getElementById('waNewModal').style.display='flex';
}
function closeNewWaCard(){document.getElementById('waNewModal').style.display='none';}
function saveNewWaCard(){
  const title=document.getElementById('waNewTitle').value.trim();
  const body=document.getElementById('waNewBody').value.trim();
  if(!title||!body){alert('Completa el título y el mensaje.');return;}
  waCustomCards.push({title,body});
  localStorage.setItem('elleWaCustom',JSON.stringify(waCustomCards));
  supaSaveWaCustom().catch(()=>showToast('⚠️ Guardado local pero no en la nube','#c46060'));
  closeNewWaCard();
  renderWaCustomCards();
  document.getElementById('waNewTitle').value='';
  document.getElementById('waNewBody').value='';
  showToast('✅ Mensaje creado','#6a8c5a');
}

function sendWaClipboard(tel, msg) {
  const url = 'https://wa.me/' + tel.replace(/\D/g,'') + '?text=' + encodeURIComponent(msg);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function buildMsg(n,pid,svId){
  const p=patients.find(x=>String(x.id)===String(pid));
  const sv=p?(p.servicios||[]).find(x=>x.id==svId)||(p.servicios||[])[0]:null;
  const link=sv?getLinkForCubiculo(sv.cubiculo):(document.getElementById('bookingLink')?.value||appConfig.calOtros);
  const addr=document.getElementById('clinicAddress')?.value||appConfig.address;
  const svcName=sv?.servicio||'';
  let msg;
  if(waServiceTpls[svcName]&&n===1) msg=waServiceTpls[svcName];
  else if(svcName==='Depilación Láser'&&n===1) msg=LASER_TPL;
  else msg=getWaTpl(n);
  if(p)msg=msg.replace(/\[Nombre\]/g,p.nombre);
  if(sv)msg=msg.replace(/\[Servicio\]/g,sv.servicio);
  return msg.replace(/\[Link\]/g,link).replace(/\[Dirección\]/g,addr);
}
function sendWa(n){
  const pid=document.getElementById(`waP${n}`).value;
  const p=patients.find(x=>String(x.id)===String(pid));
  if(!p||!p.telefono){alert('Selecciona una paciente con teléfono registrado.');return;}
  const svId=document.getElementById(`waP${n}svc`)?.value;
  sendWaClipboard(p.telefono, buildMsg(n,pid,svId));
}
function copyWa(n){const pid=document.getElementById(`waP${n}`).value;const svId=document.getElementById(`waP${n}svc`)?.value;navigator.clipboard.writeText(buildMsg(n,pid,svId)).then(()=>showToast('Copiado','var(--sage-dark)'));}
function quickWa(pid,svId){
  const p=patients.find(x=>x.id==pid||String(x.id)===String(pid));
  if(!p){return;}
  if(!p.telefono){
    // Mostrar modal para ingresar teléfono
    const existing=document.getElementById('quickWaPhoneModal');
    if(existing)existing.remove();
    const modal=document.createElement('div');
    modal.id='quickWaPhoneModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(45,31,28,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    modal.innerHTML=`<div style="background:white;border-radius:18px;padding:28px 28px 22px;max-width:380px;width:92%;box-shadow:0 24px 60px rgba(45,31,28,0.25);animation:slideUp 0.3s ease;">
      <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:600;color:var(--rose-dark);margin-bottom:6px;">Teléfono de ${p.nombre}</div>
      <div style="font-size:0.82rem;color:var(--text-light);margin-bottom:16px;">Esta paciente no tiene teléfono registrado. Ingrésalo para enviar el WhatsApp y guardarlo en su perfil.</div>
      <input id="quickWaPhoneInput" type="tel" placeholder="Ej: 51987654321" style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:'DM Sans',sans-serif;font-size:0.95rem;outline:none;color:var(--text);margin-bottom:16px;" />
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="document.getElementById('quickWaPhoneModal').remove()" style="padding:9px 18px;border-radius:10px;border:1px solid var(--border);background:white;color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.85rem;cursor:pointer;">Cancelar</button>
        <button onclick="quickWaSendWithPhone('${pid}','${svId}')" style="padding:9px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#25d366,#128c7e);color:white;font-family:'DM Sans',sans-serif;font-size:0.85rem;font-weight:600;cursor:pointer;">📲 Enviar WA</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
    setTimeout(()=>{const inp=document.getElementById('quickWaPhoneInput');if(inp)inp.focus();},100);
    return;
  }
  _doQuickWa(p,svId);
}
function quickWaSendWithPhone(pid,svId){
  const inp=document.getElementById('quickWaPhoneInput');
  const tel=(inp?inp.value:'').trim();
  if(!tel){inp&&(inp.style.borderColor='var(--red)');return;}
  const p=patients.find(x=>String(x.id)===String(pid));
  if(!p)return;
  // Guardar teléfono en el perfil
  p.telefono=tel;
  save();
  document.getElementById('quickWaPhoneModal').remove();
  showToast('📱 Teléfono guardado','#6a8c5a');
  _doQuickWa(p,svId);
}
function _doQuickWa(p,svId){
  const sv=(p.servicios||[]).find(x=>x.id==svId)||(p.servicios||[])[0];
  const link=sv?getLinkForCubiculo(sv.cubiculo):appConfig.calOtros;
  const addr=appConfig.address;
  const svcName=sv?.servicio||'';
  // Jerarquía: plantilla por servicio → LASER_TPL → genérica
  let msg;
  if(waServiceTpls[svcName]) msg=waServiceTpls[svcName];
  else if(svcName==='Depilación Láser') msg=LASER_TPL;
  else msg=getWaTpl(1);
  msg=msg.replace(/\[Nombre\]/g,p.nombre).replace(/\[Servicio\]/g,svcName).replace(/\[Link\]/g,link).replace(/\[Dirección\]/g,addr);
  sendWaClipboard(p.telefono, msg);
}

// Add listener for patient select change in WA
document.addEventListener('change',e=>{
  const m=e.target.id.match(/^waP(\d)$/);
  if(m)updateWaSvcOptions(parseInt(m[1]));
});
// Close WA dropdowns on outside click
document.addEventListener('click',e=>{
  if(!e.target.closest('[id^="waSearch"]')&&!e.target.closest('[id^="waDropdown"]')){
    document.querySelectorAll('[id^="waDropdown"]').forEach(d=>d.style.display='none');
  }
});

// ===== SETTINGS =====
function openSettings(){
  document.getElementById('cfg-name').value=appConfig.studioName;
  document.getElementById('cfg-address').value=appConfig.address;
  document.getElementById('cfg-calLaser').value=appConfig.calLaser;
  const ct=document.getElementById('cfg-consentText'); if(ct)ct.value=appConfig.consentimientoTexto||'';
  const ctb=document.getElementById('cfg-consentTextBody'); if(ctb)ctb.value=appConfig.consentimientoTextoBody||'';
  document.getElementById('cfg-calOtros').value=appConfig.calOtros;
  document.getElementById('cfg-calOtros2').value=appConfig.calOtros2||CAL_LINKS.cal03;
  const eu=document.getElementById('calEmbedUrl'); if(eu)eu.value=appConfig.calEmbedUrl||'';
  renderServicesList();
  renderFrecuenciasList();
  renderWorkerPermsList();
  openModal('settingsModal');
}
// === PERMISOS TRABAJADORA ===
const PERM_LABELS={
  eliminarPacientes:'🗑 Eliminar pacientes',
  eliminarServicios:'🗑 Eliminar servicios',
  eliminarZonas:'🗑 Eliminar zonas',
  eliminarSesiones:'🗑 Eliminar sesiones',
  eliminarPaquetes:'🗑 Eliminar paquetes',
  eliminarPreCitas:'🗑 Eliminar pre-citas',
  eliminarCitas:'🗑 Eliminar citas',
  eliminarFotos:'🗑 Eliminar fotos',
  eliminarMensajesWA:'🗑 Eliminar mensajes WhatsApp',
  verPagos:'💰 Ver sección Pagos',
  verComisiones:'💵 Ver comisiones',
  verConfiguracion:'⚙️ Acceder a Configuración',
  verPrecios:'💲 Ver lista de precios',
  editarPrecios:'✏ Editar precios'
};
function renderWorkerPermsList(){
  const c=document.getElementById('workerPermsList');
  if(!c)return;
  const perms=WORKER_PERMS();
  c.innerHTML=Object.keys(PERM_LABELS).map(key=>
    '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#faf5f0;border:1px solid var(--border);border-radius:10px;cursor:pointer;font-size:0.85rem;">'
      +'<input type="checkbox" id="perm-'+key+'" '+(perms[key]?'checked':'')+' style="width:18px;height:18px;cursor:pointer;accent-color:var(--sage-dark);">'
      +'<span>'+PERM_LABELS[key]+'</span>'
    +'</label>'
  ).join('');
}
function renderServicesList(){
  const c=document.getElementById('servicesList');
  c.innerHTML=appConfig.services.map((s,i)=>`<div style="display:flex;gap:8px;align-items:center;"><input value="${s}" id="svc-${i}" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:9px;font-size:0.88rem;"><button onclick="removeService(${i})" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--red);background:transparent;color:var(--red);cursor:pointer;">✕</button></div>`).join('');
}
function addServiceRow(){appConfig.services.push('Nuevo servicio');renderServicesList();}
function removeService(i){if(appConfig.services.length<=1){alert('Mínimo 1 servicio.');return;}appConfig.services.splice(i,1);renderServicesList();}
// === FRECUENCIAS ===
function renderFrecuenciasList(){
  const c=document.getElementById('frecuenciasList');
  if(!c)return;
  const frecs=FRECUENCIAS();
  c.innerHTML=frecs.map((f,i)=>
    '<div style="display:flex;gap:8px;align-items:center;">'
      +'<input value="'+(f.label||'').replace(/"/g,'&quot;')+'" id="frec-label-'+i+'" placeholder="Nombre (ej: 1 vez por semana)" style="flex:2;padding:8px 12px;border:1px solid var(--border);border-radius:9px;font-size:0.88rem;">'
      +'<input type="number" min="1" max="365" value="'+(f.dias||'')+'" id="frec-dias-'+i+'" placeholder="Días" style="width:90px;padding:8px 12px;border:1px solid var(--border);border-radius:9px;font-size:0.88rem;text-align:center;">'
      +'<span style="font-size:0.78rem;color:var(--text-light);">días</span>'
      +'<button onclick="removeFrecuencia('+i+')" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--red);background:transparent;color:var(--red);cursor:pointer;">✕</button>'
    +'</div>'
  ).join('');
}
function addFrecuenciaRow(){
  if(!appConfig.frecuencias)appConfig.frecuencias=[...DEFAULT_FRECUENCIAS];
  appConfig.frecuencias.push({label:'Nueva frecuencia',dias:7});
  renderFrecuenciasList();
}
function removeFrecuencia(i){
  if(!appConfig.frecuencias)return;
  if(appConfig.frecuencias.length<=1){alert('Mínimo 1 frecuencia.');return;}
  // Preservar valores antes de re-render
  const labels=document.querySelectorAll('[id^="frec-label-"]');
  const dias=document.querySelectorAll('[id^="frec-dias-"]');
  appConfig.frecuencias=[...labels].map((el,idx)=>({label:el.value.trim()||'Sin nombre',dias:parseInt(dias[idx].value)||21}));
  appConfig.frecuencias.splice(i,1);
  renderFrecuenciasList();
}
async function saveSettings(){
  const inputs=document.querySelectorAll('[id^="svc-"]');
  const rawSvcs=[...inputs].map(i=>i.value.trim()).filter(Boolean);
  if(!rawSvcs.length){alert('Agrega al menos un servicio.');return;}
  // Construir mapa viejo → nuevo para actualizar pacientes
  const oldSvcs=[...(appConfig.services||[])];
  const svcs=rawSvcs.map(s=>tcase(s));
  const renameMap={};
  for(let i=0;i<oldSvcs.length&&i<svcs.length;i++){
    if(oldSvcs[i]!==svcs[i]) renameMap[oldSvcs[i]]=svcs[i];
  }
  // Aplicar rename a todos los pacientes
  if(Object.keys(renameMap).length){
    patients.forEach(p=>{
      (p.servicios||[]).forEach(sv=>{
        if(renameMap[sv.servicio]) sv.servicio=renameMap[sv.servicio];
      });
    });
  }
  appConfig.studioName=document.getElementById('cfg-name').value.trim()||'Elle Studio';
  appConfig.address=document.getElementById('cfg-address').value.trim();
  appConfig.calLaser=document.getElementById('cfg-calLaser').value.trim();
  appConfig.calOtros=document.getElementById('cfg-calOtros').value.trim();
  appConfig.calOtros2=document.getElementById('cfg-calOtros2').value.trim();
  appConfig.calEmbedUrl=(document.getElementById('calEmbedUrl')?.value||'').trim();
  appConfig.services=svcs;
  // Guardar frecuencias
  const frecLabels=document.querySelectorAll('[id^="frec-label-"]');
  const frecDias=document.querySelectorAll('[id^="frec-dias-"]');
  if(frecLabels.length){
    const nuevasFrec=[...frecLabels].map((el,idx)=>({
      label:el.value.trim()||'Sin nombre',
      dias:parseInt(frecDias[idx].value)||21
    })).filter(f=>f.dias>0);
    if(nuevasFrec.length) appConfig.frecuencias=nuevasFrec;
  }
  // Guardar permisos de trabajadora
  const newPerms={...DEFAULT_WORKER_PERMS};
  Object.keys(PERM_LABELS).forEach(key=>{
    const cb=document.getElementById('perm-'+key);
    if(cb) newPerms[key]=cb.checked;
  });
  appConfig.workerPerms=newPerms;
  // Re-aplicar estilos si el usuario actual es worker
  if(currentRole==='worker') disableDeleteButtons();
  const ctEl=document.getElementById('cfg-consentText');
  if(ctEl) appConfig.consentimientoTexto=ctEl.value.trim();
  const ctbEl=document.getElementById('cfg-consentTextBody');
  if(ctbEl) appConfig.consentimientoTextoBody=ctbEl.value.trim();
  saveConfig();
  // Guardar configuración también en Supabase CON TRACKING (para que no se pierda)
  _addPending();
  setSyncState('syncing');
  try{
    await supa.from('config').upsert({key:'appConfig',value:appConfig,updated_at:new Date().toISOString()});
    // Verificar que se guardó leyendo de vuelta
    const {data,error}=await supa.from('config').select('value').eq('key','appConfig').single();
    if(error) throw error;
    if(!data||JSON.stringify(data.value.workerPerms||{})!==JSON.stringify(appConfig.workerPerms||{})){
      throw new Error('Los permisos no persistieron en Supabase');
    }
    setSyncState('idle');
    _removePending();
    applyConfigToUI();renderAll();closeModal('settingsModal');
    showToast('✅ Configuración guardada y sincronizada','#6a9e7a');
  }catch(e){
    console.error('Error guardando config en Supabase:',e);
    setSyncState('error');
    _removePending();
    applyConfigToUI();renderAll();
    showToast('⚠️ Guardado local, pero no llegó a la nube. Revisa tu conexión e intenta de nuevo.','#c46060',5000);
  }
}
function applyConfigToUI(){
  const h1=document.getElementById('headerStudioName');const hp=document.getElementById('headerAddress');
  if(h1)h1.textContent=appConfig.studioName;if(hp)hp.textContent=`Gestión de Pacientes · ${appConfig.address}`;
  // Inicio cal buttons
  const lbi=document.getElementById('laserCalBtnI');if(lbi)lbi.href=appConfig.calLaser;
  const c2i=document.getElementById('cal02BtnI');if(c2i)c2i.href=appConfig.calOtros;
  const c3i=document.getElementById('cal03BtnI');if(c3i)c3i.href=appConfig.calOtros2||CAL_LINKS.cal03;
  const svcs=SERVICES();
  const sfs=document.getElementById('serviceFilterSelect');
  if(sfs)sfs.innerHTML='<option value="">Todos los servicios</option>'+svcs.map(s=>`<option>${s}</option>`).join('');
  const trkSvc=document.getElementById('trk-svc');
  if(trkSvc)trkSvc.innerHTML='<option value="">Todos los servicios</option>'+svcs.map(s=>`<option>${s}</option>`).join('');
  const st=document.getElementById('serviceTabsContainer');
  if(st)st.innerHTML='<div class="service-tab active" onclick="filterTracking(\'\',this)">Todos</div>'+svcs.map(s=>`<div class="service-tab" onclick="filterTracking(\'${s}\',this)">${s.split(' ').slice(0,2).join(' ')}</div>`).join('');
  const bl=document.getElementById('bookingLink');if(bl)bl.value=appConfig.calOtros;
  const bl2=document.getElementById('bookingLink2');if(bl2)bl2.value=appConfig.calOtros2||CAL_LINKS.cal03;
  const cl=document.getElementById('calendarLink');if(cl)cl.value=appConfig.calLaser;
  const ca=document.getElementById('clinicAddress');if(ca)ca.value=appConfig.address;
  const ceu=document.getElementById('calEmbedUrl');if(ceu)ceu.value=appConfig.calEmbedUrl||'';
  // Re-render calendar frames when config changes
  _calsRendered=false;
  renderCalFrames();
}
function renderAll(){renderAgendaHoy();renderAgendaSemanal();if(typeof renderMesInterno==='function'&&document.getElementById('mesInternoGrid'))renderMesInterno();renderStatsInicio();renderAlertsInicio();renderStats();renderPatients();renderAlerts();renderPcStats();renderPagos();renderPgSummary();if(document.getElementById('trackingBody'))renderTracking();populateWaSelects();}


// ===== PRE-CITAS DATA =====
let preCitas=JSON.parse(localStorage.getItem('ce_v3_precitas')||'[]');

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

// ===== PAGOS / REGISTROS (sistema independiente) =====
// Estructura: registros = [{id, fecha, nombre, apellido, telefono, patientId|null, servicio, zonas, atendio, total, adelanto, comision, notas}]
let registros = JSON.parse(localStorage.getItem('ce_v3_registros') || '[]');

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

// Mantener compatibilidad: getPago/totalAbonado/saldo/estadoPago siguen funcionando para legacy
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

function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){
  // Si hay cambios de sesión pendientes (debounce), guardarlos antes de cerrar
  if(_updSesTimer){ clearTimeout(_updSesTimer); _updSesTimer=null; save(); }
  document.getElementById(id).classList.remove('open');
  // Al cerrar la ficha del paciente, actualizar la lista
  if(id==='patientDetailModal'){ renderPatients(); renderStats(); }
}
document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{
  if(e.target===m){
    // Pasar siempre por closeModal para no perder currentPid ni efectos secundarios
    if(typeof closeModal==='function') closeModal(m.id);
    else m.classList.remove('open');
  }
}));


// ===== LOGIN & ROLES SYSTEM =====
const PASSWORDS = {
  admin: 'bc6e0f75f4e9f5c905cb5ae58eeee078538dbe63150b6b7205f839e3ac5514e5',
  worker: '2c4b90224e2c428116c1289f7b9fe71d360ef1e9452b83a653881ce6acd3a223'
};
async function hashPw(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

let currentRole = null;
let _selectedRole = null;

function selectRole(role) {
  _selectedRole = role;
  document.getElementById('loginRoleBtns').style.opacity = '0.4';
  document.getElementById('loginRoleBtns').style.pointerEvents = 'none';
  const wrap = document.getElementById('loginPwWrap');
  wrap.style.display='block';
  document.getElementById('loginBack').style.display = 'block';
  setTimeout(() => document.getElementById('loginPwInput').focus(), 100);
}

function backToRoles() {
  _selectedRole = null;
  document.getElementById('loginRoleBtns').style.opacity = '1';
  document.getElementById('loginRoleBtns').style.pointerEvents = 'auto';
  document.getElementById('loginPwWrap').style.display='none';
  document.getElementById('loginPwInput').value = '';
  document.getElementById('loginError').style.display = 'none';
}

async function doLogin() {
  const pw = document.getElementById('loginPwInput').value.trim();
  const errEl = document.getElementById('loginError');
  const hashed = await hashPw(pw);
  if (hashed === PASSWORDS[_selectedRole]) {
    currentRole = _selectedRole;
    localStorage.setItem('es_session_role', currentRole);
    localStorage.setItem('es_session_ts', Date.now());
    localStorage.removeItem('es_role'); // limpiar el viejo
    document.getElementById('loginScreen').style.opacity = '0';
    document.getElementById('loginScreen').style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      document.getElementById('loginScreen').style.display = 'none';
      applyRoleRestrictions();
      setTimeout(updateBackupReminderBanner, 600);
      initFromSupabase();
      setTimeout(renderCalFrames, 900);
    }, 500);
    errEl.style.display = 'none';
  } else {
    errEl.style.display = 'block';
    document.getElementById('loginPwInput').value = '';
    document.getElementById('loginPwInput').focus();
  }
}


// ============================================================
// ⚡ TERMINAL DE DIAGNÓSTICO — solo admin
// ============================================================
let _diagErrors = [];
let _diagSaveLog = [];
let _diagOpen = false;

// Interceptar todos los errores JS globales
(function(){
  const origError = window.onerror;
  window.onerror = function(msg, src, line, col, err){
    const entry = {type:'error', ts: new Date().toLocaleTimeString('es-PE'), msg: String(msg), src: (src||'').split('/').pop(), line};
    _diagErrors.push(entry);
    if(_diagOpen) _diagLog('🔴 ERROR JS: ' + entry.msg + ' · ' + entry.src + ':' + entry.line, 'error');
    if(origError) return origError.apply(this, arguments);
  };
  window.addEventListener('unhandledrejection', function(e){
    const entry = {type:'promise', ts: new Date().toLocaleTimeString('es-PE'), msg: String(e.reason)};
    _diagErrors.push(entry);
    if(_diagOpen) _diagLog('🔴 PROMISE ERROR: ' + entry.msg, 'error');
  });
})();

// Interceptar console.error para capturar errores de Supabase etc
(function(){
  const orig = console.error;
  console.error = function(){
    const msg = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    _diagErrors.push({type:'console', ts: new Date().toLocaleTimeString('es-PE'), msg});
    if(_diagOpen) _diagLog('🟠 CONSOLE.ERROR: ' + msg, 'warn');
    orig.apply(console, arguments);
  };
})();

// Registrar cada save() exitoso
const _origSave = window.save;
function _diagTrackSave(){
  _diagSaveLog.push(new Date().toLocaleTimeString('es-PE'));
  if(_diagSaveLog.length > 50) _diagSaveLog.shift();
  if(_diagOpen) {
    _diagLog('✅ save() ejecutado · pacientes en memoria: ' + (patients||[]).length, 'ok');
    _diagUpdateStats();
  }
}

function openDiagTerminal(){
  if(currentRole !== 'admin'){ showToast('Solo admin puede ver el terminal','#c46060'); return; }
  const m = document.getElementById('diagTerminalModal');
  if(m){ m.style.display='flex'; _diagOpen=true; }
  _diagUpdateStats();
  _diagLog('⚡ Terminal iniciado · ' + new Date().toLocaleString('es-PE'), 'system');
  if(_diagErrors.length > 0){
    _diagLog('⚠️ ' + _diagErrors.length + ' errores capturados desde que se cargó la página:', 'warn');
    _diagErrors.slice(-10).forEach(e => _diagLog('  [' + e.ts + '] ' + e.msg, 'error'));
  } else {
    _diagLog('✅ Sin errores JS detectados desde el inicio', 'ok');
  }
  setTimeout(()=>{ const inp=document.getElementById('diagInput'); if(inp) inp.focus(); }, 100);
}

function closeDiagTerminal(){
  const m = document.getElementById('diagTerminalModal');
  if(m) m.style.display='none';
  _diagOpen=false;
}

function _diagLog(msg, type){
  const el = document.getElementById('diagLog');
  if(!el) return;
  const colors = {error:'#f85149', warn:'#e3b341', ok:'#3fb950', system:'#58a6ff', info:'#8b949e'};
  const color = colors[type||'info'] || '#8b949e';
  const ts = new Date().toLocaleTimeString('es-PE');
  const line = document.createElement('div');
  line.style.cssText = 'color:' + color + ';padding:1px 0;white-space:pre-wrap;word-break:break-all;';
  line.textContent = '[' + ts + '] ' + msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function _diagGetLSSize(){
  let total = 0;
  try{
    for(let k in localStorage){
      if(localStorage.hasOwnProperty(k)){
        total += ((localStorage[k]||'').length + k.length) * 2;
      }
    }
  }catch(e){}
  return total;
}

function _diagUpdateStats(){
  // Pacientes
  const pEl = document.getElementById('dstat-patients-val');
  if(pEl) pEl.textContent = (patients||[]).length + ' pacientes';
  
  // localStorage
  const lsEl = document.getElementById('dstat-ls-val');
  if(lsEl){
    const bytes = _diagGetLSSize();
    const kb = (bytes/1024).toFixed(1);
    const pct = Math.round(bytes/(5*1024*1024)*100);
    const lsColor = pct > 80 ? '#f85149' : pct > 50 ? '#e3b341' : '#3fb950';
    lsEl.style.color = lsColor;
    lsEl.textContent = kb + ' KB (' + pct + '%)';
  }
  
  // Supabase
  const supaEl = document.getElementById('dstat-supa-val');
  if(supaEl){
    if(_currentSyncState === 'idle'){ supaEl.style.color='#3fb950'; supaEl.textContent='\u2705 Conectado'; }
    else if(_currentSyncState === 'error'){ supaEl.style.color='#f85149'; supaEl.textContent='\u274C Error'; }
    else { supaEl.style.color='#e3b341'; supaEl.textContent='\uD83D\uDD04 Sincronizando'; }
  }
  
  // Último guardado
  const saveEl = document.getElementById('dstat-save-val');
  if(saveEl){
    const ts = localStorage.getItem('ce_v3_patients_ts');
    if(ts){
      const d = new Date(parseInt(ts));
      const diff = Math.round((Date.now()-parseInt(ts))/1000);
      saveEl.textContent = diff < 60 ? 'Hace ' + diff + 's' : d.toLocaleTimeString('es-PE');
    } else {
      saveEl.textContent = 'Sin registro';
    }
  }
}

function diagClear(){
  const el = document.getElementById('diagLog');
  if(el) el.innerHTML = '';
  _diagLog('🧹 Log limpiado', 'system');
}

async function diagRunCheck(){
  _diagLog('', 'info');
  _diagLog('══════════ VERIFICACIÓN COMPLETA ══════════', 'system');
  
  // 1. Pacientes en memoria vs localStorage
  const localPats = JSON.parse(localStorage.getItem('ce_v3_patients')||'[]');
  if(localPats.length === (patients||[]).length){
    _diagLog('✅ Pacientes: ' + localPats.length + ' en memoria = ' + localPats.length + ' en localStorage', 'ok');
  } else {
    _diagLog('⚠️ Pacientes: ' + (patients||[]).length + ' en memoria ≠ ' + localPats.length + ' en localStorage', 'warn');
  }
  
  // 2. Supabase ping CON TIMEOUT (para que no se cuelgue si la red es lenta)
  _diagLog('🔄 Verificando Supabase...', 'info');
  const _withTimeout = (promise, ms)=>Promise.race([
    promise,
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout: Supabase no respondió en '+(ms/1000)+'s')),ms))
  ]);
  try{
    const {data, error} = await _withTimeout(
      supa.from('patients').select('id').limit(1),
      10000
    );
    if(error) throw error;
    _diagLog('✅ Supabase responde correctamente', 'ok');
    // Reset agresivo: Supabase confirmado OK, limpiar contadores/estado viejo
    window._pendingSaves = 0;
    if(typeof _updateSyncBadge === 'function') _updateSyncBadge();
    setSyncState('idle');

    // 3. Contar pacientes en Supabase
    try{
      const {data: allData, error: err2} = await _withTimeout(
        supa.from('elle_patients').select('id'),
        15000
      );
      if(!err2){
        const supaCount = (allData||[]).filter(r=>!_deletedPatientIds.has(String(r.id))).length;
        const localCount = (patients||[]).length;
        if(supaCount === localCount){
          _diagLog('✅ Supabase: ' + supaCount + ' pacientes = memoria: ' + localCount, 'ok');
        } else {
          _diagLog('⚠️ Supabase: ' + supaCount + ' pacientes ≠ memoria: ' + localCount + ' — presiona Refrescar', 'warn');
        }
      }
    }catch(e2){
      _diagLog('⚠️ No se pudo contar pacientes en Supabase: ' + e2.message, 'warn');
    }
  }catch(e){
    _diagLog('❌ Supabase NO responde: ' + (e.message||String(e)), 'error');
    _diagLog('ℹ️ Posibles causas: red lenta, Supabase caído, o token expirado', 'info');
  }
  
  // 4. localStorage usage
  const bytes = _diagGetLSSize();
  const kb = (bytes/1024).toFixed(1);
  const pct = Math.round(bytes/(5*1024*1024)*100);
  if(pct > 80){
    _diagLog('🔴 localStorage CRÍTICO: ' + kb + 'KB (' + pct + '%) — puede fallar el guardado', 'error');
  } else if(pct > 50){
    _diagLog('🟡 localStorage al ' + pct + '% (' + kb + 'KB) — aceptable pero vigilar fotos', 'warn');
  } else {
    _diagLog('✅ localStorage: ' + kb + 'KB (' + pct + '%) — OK', 'ok');
  }
  
  // 5. Desglose de fotos
  let totalFotos = 0;
  let fotoSize = 0;
  (patients||[]).forEach(p => {
    const f = (p.fotos||[]);
    totalFotos += f.length;
    f.forEach(img => { fotoSize += (img||'').length * 2; });
  });
  const fotoKb = (fotoSize/1024).toFixed(1);
  if(fotoSize > 2*1024*1024){
    _diagLog('🟡 Fotos: ' + totalFotos + ' imágenes ocupan ' + fotoKb + 'KB — considera limpiar fotos antiguas', 'warn');
  } else {
    _diagLog('✅ Fotos: ' + totalFotos + ' imágenes · ' + fotoKb + 'KB', 'ok');
  }
  
  // 6. Errores JS
  if(_diagErrors.length === 0){
    _diagLog('✅ Sin errores JS desde que se cargó la página', 'ok');
  } else {
    _diagLog('⚠️ ' + _diagErrors.length + ' errores JS detectados:', 'warn');
    _diagErrors.slice(-5).forEach(e => _diagLog('  ' + e.msg, 'error'));
  }
  
  // 7. Último guardado
  const ts = localStorage.getItem('ce_v3_patients_ts');
  if(ts){
    const diff = Math.round((Date.now()-parseInt(ts))/1000);
    _diagLog('✅ Último save(): hace ' + diff + ' segundos', diff > 300 ? 'warn' : 'ok');
  } else {
    _diagLog('⚠️ No hay registro de último save()', 'warn');
  }
  
  _diagLog('══════════ FIN DE VERIFICACIÓN ══════════', 'system');
  _diagUpdateStats();
}

function diagRunCmd(cmd){
  const inp = document.getElementById('diagInput');
  if(inp) inp.value = '';
  cmd = (cmd||'').trim().toLowerCase();
  if(!cmd) return;
  _diagLog('elle@studio $ ' + cmd, 'system');
  
  if(cmd === 'help'){
    _diagLog('Comandos disponibles:', 'info');
    _diagLog('  today     → Ver todo lo ingresado/modificado hoy', 'info');
    _diagLog('  verify    → Verificar que Supabase tiene todo lo que hay en local', 'info');
    _diagLog('  log       → Ver últimas acciones guardadas con hora exacta', 'info');
    _diagLog('  pat <nombre> → Ver datos de una paciente (ej: pat maria)', 'info');
    _diagLog('  check     → Verificar todo (Supabase, localStorage, errores)', 'info');
    _diagLog('  ls        → Ver uso de localStorage por clave', 'info');
    _diagLog('  supa      → Ping a Supabase', 'info');
    _diagLog('  errors    → Ver todos los errores capturados', 'info');
    _diagLog('  patients  → Contar pacientes local vs Supabase', 'info');
    _diagLog('  fotos     → Ver uso de fotos por paciente', 'info');
    _diagLog('  sync      → Forzar re-sincronización a Supabase', 'info');
    _diagLog('  clear     → Limpiar la consola', 'info');
  } else if(cmd === 'today'){
    const hoy = new Date().toISOString().slice(0,10);
    const esHoy = (s) => {
      if(!s) return false;
      try{
        // Handle DD/MM/YYYY and YYYY-MM-DD formats
        let d;
        if(typeof s==='string' && s.includes('/')){
          const p=s.split('/'); d=new Date(`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`);
        } else { d=new Date(s); }
        return d.toISOString().slice(0,10)===hoy;
      }catch(e){return false;}
    };
    _diagLog('══════ REGISTRO DEL DÍA · ' + new Date().toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'}).toUpperCase() + ' ══════', 'system');

    // 1. Pacientes nuevas (fecha de inicio = hoy)
    const nuevas = (patients||[]).filter(p => esHoy(p.fechaInicio)||esHoy(p.creadoEn)||esHoy(p.createdAt));
    _diagLog('── PACIENTES NUEVAS (' + nuevas.length + ') ──', 'info');
    if(nuevas.length === 0) _diagLog('  Ninguna paciente nueva hoy', 'info');
    else nuevas.forEach(p => _diagLog('  ✅ ' + p.nombre + ' ' + p.apellido + (p.telefono?' · '+p.telefono:''), 'ok'));

    // 2. Sesiones con fecha de hoy — busca dentro de sv.zonas[].sesiones
    let sesHoy = [];
    (patients||[]).forEach(p => {
      (p.servicios||[]).forEach(sv => {
        const svNombre = sv.nombre||sv.servicio||sv.tipo||'';
        // Sesiones directo en sv.sesiones (estructura antigua)
        (sv.sesiones||[]).forEach(ses => {
          if(esHoy(ses.fecha)||esHoy(ses.date)||esHoy(ses.creadoEn)){
            sesHoy.push({nombre:p.nombre+' '+p.apellido, servicio:svNombre, zona:'', fecha:ses.fecha||ses.date||hoy, asistio:ses.asistio});
          }
        });
        // Sesiones dentro de zonas (estructura actual)
        (sv.zonas||[]).forEach(z => {
          const zonaNombre = z.nombre||z.zona||'';
          (z.sesiones||[]).forEach(ses => {
            // Mostrar si: fecha de la sesión es hoy, O fue creada hoy
            if(esHoy(ses.fecha)||esHoy(ses.date)||esHoy(ses.creadoEn)){
              sesHoy.push({nombre:p.nombre+' '+p.apellido, servicio:svNombre, zona:zonaNombre, fecha:ses.fecha||ses.date||hoy, asistio:ses.asistio});
            }
          });
        });
      });
    });
    _diagLog('── SESIONES DE HOY (' + sesHoy.length + ') ──', 'info');
    if(sesHoy.length === 0) _diagLog('  Ninguna sesión para hoy', 'info');
    else sesHoy.forEach(s => _diagLog('  '+(s.asistio?'✅':'📅')+' '+s.nombre+' · '+s.servicio+(s.zona?' · '+s.zona:'')+' · '+s.fecha, s.asistio?'ok':'info'));

    // 3. Zonas con fecha de hoy
    let zonasHoy = [];
    (patients||[]).forEach(p => {
      (p.servicios||[]).forEach(sv => {
        const svNombre = sv.nombre||sv.servicio||sv.tipo||'';
        (sv.zonas||[]).forEach(z => {
          const zfecha = z.creadoEn||z.ts||z.fecha||z.date||'';
          if(esHoy(zfecha)){
            zonasHoy.push({nombre:p.nombre+' '+p.apellido, servicio:svNombre, zona:z.nombre||z.zona||String(z)});
          }
        });
      });
    });
    _diagLog('── ZONAS AGREGADAS (' + zonasHoy.length + ') ──', 'info');
    if(zonasHoy.length === 0) _diagLog('  Ninguna zona nueva hoy', 'info');
    else zonasHoy.forEach(z => _diagLog('  ✅ '+z.nombre+' · '+z.servicio+' · '+z.zona, 'ok'));

    // 4. Fotos — pacientes con fotos en Supabase Storage subidas hoy (URL contiene timestamp)
    let fotosHoy = [];
    (patients||[]).forEach(p => {
      const hoyStr = hoy.replace(/-/g,'');
      const n = (p.fotos||[]).filter(f => f && (
        (f.startsWith('http') && f.includes('/fotos/'+p.id+'/')) ||
        f.startsWith('data:')
      )).length;
      if(n>0) fotosHoy.push({nombre:p.nombre+' '+p.apellido, n});
    });
    _diagLog('── FOTOS (' + fotosHoy.reduce((a,b)=>a+b.n,0) + ' imágenes) ──', 'info');
    if(fotosHoy.length===0) _diagLog('  Sin fotos registradas', 'info');
    else fotosHoy.forEach(f => _diagLog('  📷 '+f.nombre+': '+f.n+' foto'+(f.n>1?'s':''), 'ok'));

    // 5. Pagos de hoy
    const pagosHoy = (registros||[]).filter(r => esHoy(r.fecha));
    _diagLog('── PAGOS REGISTRADOS (' + pagosHoy.length + ') ──', 'info');
    if(pagosHoy.length === 0) _diagLog('  Ningún pago registrado hoy', 'info');
    else{
      let totalHoy = 0;
      pagosHoy.forEach(r => {
        const monto=Number(r.monto||r.total||0);
        totalHoy+=monto;
        _diagLog('  💰 '+(r.nombre||r.paciente||'—')+' · S/'+monto.toFixed(2)+' · '+(r.servicio||'—'), 'ok');
      });
      _diagLog('  TOTAL DEL DÍA: S/'+totalHoy.toFixed(2), 'ok');
    }
    _diagLog('══════ FIN DEL REPORTE ══════', 'system');
  } else if(cmd === 'verify'){
    _diagLog('🔍 Verificando consistencia local ↔ Supabase...', 'system');
    (async()=>{
      try{
        const {data:elleData,error:elleErr} = await supa.from('elle_patients').select('id');
        if(elleErr) throw elleErr;
        const remoteIds = new Set((elleData||[]).map(r=>String(r.id)).filter(id=>!_deletedPatientIds.has(id)));
        const localCount = patients.length;
        const remoteCount = remoteIds.size;
        _diagLog(`Pacientes memoria: ${localCount} | elle_patients: ${remoteCount}`, remoteCount === localCount ? 'ok' : 'warn');
        if(remoteCount !== localCount){
          const faltantesEnElle = patients.filter(p=>!remoteIds.has(String(p.id)));
          if(faltantesEnElle.length){
            _diagLog(`⚠️ Faltan ${faltantesEnElle.length} en elle_patients — sincronizando...`, 'warn');
            for(const p of faltantesEnElle) await _syncPatientToElle(p);
            _diagLog('✅ Sincronizados a elle_*', 'ok');
          } else {
            _diagLog('ℹ️ Diferencia en IDs — presiona Refrescar para recargar', 'info');
          }
        } else {
          _diagLog('✅ Pacientes en sync con elle_patients', 'ok');
        }
        // Verificar registros contra elle_payments
        const {data:ellePagos} = await supa.from('elle_payments').select('id');
        const localRegCount = (registros||[]).length;
        const remoteRegCount = (ellePagos||[]).length;
        _diagLog(`Pagos memoria: ${localRegCount} | elle_payments: ${remoteRegCount}`, remoteRegCount === localRegCount ? 'ok' : 'warn');
        if(remoteRegCount !== localRegCount){
          _diagLog('ℹ️ Diferencia en pagos — presiona Refrescar para recargar', 'info');
        }
        _diagLog('══ Verificación completa ══', 'system');
      }catch(e){
        _diagLog('❌ Error en verificación: '+e.message, 'error');
      }
    })();
  } else if(cmd === 'log'){
    const logs = window._saveLog||[];
    _diagLog('══════ LOG DE GUARDADOS (' + logs.length + ' acciones) ══════', 'system');
    if(logs.length === 0){ _diagLog('  Sin acciones registradas en esta sesión', 'info'); }
    else logs.forEach(l => _diagLog('  ['+l.hora+'] '+l.accion+' → '+l.detalle, 'ok'));
    _diagLog('══════════════════════════════════════', 'system');
  } else if(cmd.startsWith('pat ')){
    const query = cmd.slice(4).trim().toLowerCase();
    const found = (patients||[]).filter(p => (p.nombre+' '+p.apellido).toLowerCase().includes(query));
    if(found.length === 0){ _diagLog('❌ No encontrado: "'+query+'"', 'error'); return; }
    found.slice(0,3).forEach(p => {
      _diagLog('── '+p.nombre+' '+p.apellido+' (id:'+p.id+') ──', 'info');
      _diagLog('  fechaInicio: '+(p.fechaInicio||'—')+' | creadoEn: '+(p.creadoEn||'—'), 'info');
      (p.servicios||[]).forEach((sv,i) => {
        const svNom = sv.nombre||sv.servicio||sv.tipo||'srv'+i;
        (sv.zonas||[]).forEach(z => {
          _diagLog('  ['+svNom+'] zona:"'+(z.nombre||z.zona||'?')+'" | '+( z.sesiones||[]).length+' ses | creadoEn:'+(z.creadoEn||'—'), 'info');
          (z.sesiones||[]).slice(-3).forEach(s => _diagLog('    → fecha:'+(s.fecha||'—')+' asistio:'+(s.asistio?'sí':'no'), 'info'));
        });
      });
    });
  } else if(cmd === 'check'){
    diagRunCheck();
  } else if(cmd === 'clear'){
    diagClear();
  } else if(cmd === 'errors'){
    if(_diagErrors.length === 0){ _diagLog('✅ Sin errores capturados', 'ok'); return; }
    _diagLog(_diagErrors.length + ' errores:', 'warn');
    _diagErrors.forEach(e => _diagLog('[' + e.ts + '] ' + e.msg, 'error'));
  } else if(cmd === 'ls'){
    _diagLog('Uso de localStorage:', 'info');
    let items = [];
    for(let k in localStorage){
      if(localStorage.hasOwnProperty(k)){
        const kb = ((localStorage[k]||'').length*2/1024).toFixed(1);
        items.push({k, kb: parseFloat(kb)});
      }
    }
    items.sort((a,b)=>b.kb-a.kb);
    items.forEach(it => _diagLog('  ' + it.k + ': ' + it.kb + ' KB', it.kb > 500 ? 'warn' : 'info'));
    const total = items.reduce((a,b)=>a+b.kb, 0);
    _diagLog('  TOTAL: ' + total.toFixed(1) + ' KB / 5120 KB (' + Math.round(total/5120*100) + '%)', total > 2560 ? 'warn' : 'ok');
  } else if(cmd === 'supa'){
    _diagLog('🔄 Haciendo ping a Supabase...', 'info');
    supa.from('patients').select('id').limit(1).then(({data,error})=>{
      if(error) _diagLog('❌ Supabase error: ' + JSON.stringify(error), 'error');
      else _diagLog('✅ Supabase OK · respondió correctamente', 'ok');
    }).catch(e => _diagLog('❌ Supabase excepción: ' + e, 'error'));
  } else if(cmd === 'patients'){
    _diagLog('Pacientes en memoria: ' + (patients||[]).length, 'info');
    _diagLog('Pacientes en localStorage: ' + JSON.parse(localStorage.getItem('ce_v3_patients')||'[]').length, 'info');
    supa.from('patients').select('id').then(({data,error})=>{
      if(!error) _diagLog('Pacientes en Supabase: ' + (data||[]).length, 'info');
      else _diagLog('Error Supabase: ' + JSON.stringify(error), 'error');
    });
  } else if(cmd === 'fotos'){
    let total = 0;
    (patients||[]).forEach(p => {
      const n = (p.fotos||[]).length;
      if(n > 0){
        const kb = ((p.fotos||[]).join('').length*2/1024).toFixed(1);
        _diagLog('  ' + p.nombre + ' ' + p.apellido + ': ' + n + ' fotos · ' + kb + 'KB', parseFloat(kb)>500?'warn':'info');
        total += n;
      }
    });
    _diagLog('Total: ' + total + ' fotos', 'ok');
  } else if(cmd === 'sync'){
    _diagLog('🔄 Forzando sync a Supabase...', 'info');
    let count = 0;
    (patients||[]).forEach(p => { supaUpsertPatient(p); count++; });
    _diagLog('✅ ' + count + ' pacientes enviados a Supabase', 'ok');
  } else if(cmd === 'state'){
    _diagLog('📊 ESTADO DE SINCRONIZACIÓN:', 'system');
    _diagLog('  stat box: ' + (document.getElementById('dstat-supa-val')?.textContent || '—'), 'info');
    _diagLog('  _currentSyncState: ' + _currentSyncState, 'info');
    _diagLog('  _pendingSaves: ' + (window._pendingSaves||0), 'info');
    _diagLog('  punto header color: ' + (document.getElementById('syncIcon')?.style?.background || '—'), 'info');
    _diagLog('  punto header title: ' + (document.getElementById('syncIndicator')?.title || '—'), 'info');
    const badge = document.getElementById('_pendingBadge');
    _diagLog('  badge amarillo: ' + (badge && badge.style.display !== 'none' ? ('VISIBLE → "' + badge.innerText + '"') : 'oculto'), 'info');
  } else if(cmd === 'reset'){
    window._pendingSaves = 0;
    if(typeof _updateSyncBadge === 'function') _updateSyncBadge();
    setSyncState('idle');
    _diagUpdateStats();
    _diagLog('✅ Estado reseteado: pendientes=0, sync=idle', 'ok');
  } else {
    _diagLog('❓ Comando no reconocido. Escribe "help" para ver los comandos.', 'warn');
  }
}


function applyRoleRestrictions() {
  const isWorker = currentRole === 'worker';
  // Show terminal button only for admin
  const termBtn = document.getElementById('terminalMenuBtn');
  if(termBtn) termBtn.style.display = isWorker ? 'none' : 'block';
  const ri = document.getElementById('roleIndicator');
  if (ri) {
    ri.style.display = 'flex';
    ri.className = isWorker ? 'worker' : 'admin';
    ri.textContent = isWorker ? '🌸 Trabajadora' : '🔑 Admin';
  }

  if (isWorker) {
    // Ocultar pestaña Pagos
    document.querySelectorAll('.tab').forEach(t => {
      if (t.textContent.includes('Pagos')) t.style.display = 'none';
    });
    // Ocultar botones de Configuración y Respaldo
    document.querySelectorAll('button').forEach(b => {
      if (b.textContent.includes('Configuración') || b.textContent.includes('Respaldo')) {
        b.style.display = 'none';
      }
    });
    // Ocultar botón sesiones
    const asb = document.getElementById('activeSessionsBtn');
    if(asb) asb.style.display = 'none';
    // Ocultar botones de eliminar paciente en cards
    disableDeleteButtons();
    // Añadir botón cerrar sesión
    addLogoutBtn();
  } else {
    // Admin: mostrar todo + botón cerrar sesión + botón sesiones
    const asb = document.getElementById('activeSessionsBtn');
    if(asb) asb.style.display = 'flex';
    addLogoutBtn();
  }
  // Registrar sesión activa en Supabase
  registerSession();
}

function disableDeleteButtons() {
  // Primero eliminar style anterior si existe (para re-aplicar al cambiar permisos)
  const old=document.getElementById('_workerStyle');
  if(old) old.remove();
  const perms=WORKER_PERMS();
  const rules=[];
  // Cada permiso agrega selector si está desactivado
  if(!perms.eliminarPacientes){rules.push('button[onclick*="deletePatient"]');}
  if(!perms.eliminarServicios){rules.push('button[onclick*="deleteSvc"]','button[onclick*="removeService"]');}
  if(!perms.eliminarZonas){rules.push('button[onclick*="delZone"]');}
  if(!perms.eliminarSesiones){rules.push('button[onclick*="delSes"]');}
  if(!perms.eliminarPaquetes){rules.push('button[onclick*="deletePaquete"]');}
  if(!perms.eliminarPreCitas){rules.push('button[onclick*="deletePreCita"]');}
  if(!perms.eliminarCitas){rules.push('button[onclick*="deleteCitaHoy"]');}
  if(!perms.eliminarFotos){rules.push('button[onclick*="deleteCurrentPhoto"]');}
  if(!perms.eliminarMensajesWA){rules.push('button[onclick*="deleteCustomCard"]');}
  if(!perms.editarPrecios){rules.push('button[onclick*="deletePrecioItem"]','button[onclick*="deleteCategoria"]','button[onclick*="deleteServicio"]','button[onclick*="deletePromo"]');}
  // Registros/pagos
  rules.push('button[onclick*="deleteRegistro"]','button[onclick*="deleteAbono"]');
  const css=[];
  if(rules.length) css.push(rules.join(',\n')+' { display: none !important; }');
  css.push('.worker-hide { display: none !important; }');
  css.push('.worker-hide-comision { display: none !important; }');
  if(!perms.verPagos){
    css.push('#sec-pagos { display: none !important; }');
    css.push('.tab:nth-child(5) { display: none !important; }');
  }
  if(!perms.verConfiguracion){
    css.push('button[onclick*="openSettings"] { display: none !important; }');
  }
  if(!perms.verComisiones){
    css.push('.worker-hide-comision { display: none !important; }');
  }
  // Botones permitidos SIEMPRE (independiente de eliminar)
  css.push('button[onclick*="openAddZoneModal"], button[onclick*="openCameraCapture"], button[onclick*="photoInput"], button[onclick*="openNewPaqueteModal"], button[onclick*="openAddSvcModal"], button[onclick*="openAddSesModal"], button[onclick*="addSes"], button[onclick*="openNewPreCita"], button[onclick*="openNuevaCitaModal"], button[onclick*="openNewPatient"] { display: inline-flex !important; }');
  css.push('#photoInput, #cameraInputCapture, #cameraInputFile { display: none !important; }');
  const style = document.createElement('style');
  style.id='_workerStyle';
  style.textContent = css.join('\n');
  document.head.appendChild(style);
}
// Obtener permisos actuales (default + config)
function WORKER_PERMS(){
  return Object.assign({},DEFAULT_WORKER_PERMS,appConfig.workerPerms||{});
}
// Guard para funciones de eliminar - acepta key de permiso específica
function _workerGuard(accion,permKey){
  if(currentRole!=='worker')return false;
  const perms=WORKER_PERMS();
  if(permKey&&perms[permKey]===true)return false; // admin le dio permiso
  showToast('🔒 Sin permiso para '+accion+'. Pide a la administradora habilitarlo.','#c46060',4000);
  return true;
}

function addLogoutBtn() {
  // Logout now lives in the dropdown menu (#logoutBtnMenu), nothing to inject
}

function toggleHeaderMenu() {
  const d = document.getElementById('headerDropdown');
  d.style.display = d.style.display === 'none' ? 'block' : 'none';
}
function closeHeaderMenu() {
  document.getElementById('headerDropdown').style.display = 'none';
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('#headerMenuBtn') && !e.target.closest('#headerDropdown')) {
    const d = document.getElementById('headerDropdown');
    if (d) d.style.display = 'none';
  }
});
function logout() {
  if (!confirm('¿Cerrar sesión?')) return;
  unregisterSession();
  currentRole = null;
  localStorage.removeItem('es_session_role');
  localStorage.removeItem('es_session_ts');
  localStorage.removeItem('es_role');
  location.reload();
}

// Sesión persiste 7 días en localStorage
(function checkSavedSession() {
  const saved = localStorage.getItem('es_session_role');
  const ts = parseInt(localStorage.getItem('es_session_ts')||'0');
  const expired = Date.now() - ts > 7 * 24 * 60 * 60 * 1000;
  if ((saved === 'admin' || saved === 'worker') && !expired) {
    currentRole = saved;
    const ls = document.getElementById('loginScreen');
    if(ls) ls.style.display = 'none';
    setTimeout(()=>{ applyRoleRestrictions(); initFromSupabase(); }, 50);
  }
})();

// ===== INIT =====
// Limpiar backups viejos al iniciar — Supabase es el respaldo real
try{
  localStorage.removeItem('elle_backups');
}catch(e){}
applyConfigToUI();renderAll();
setTimeout(updateBackupReminderBanner, 500);
setTimeout(()=>{ migratePhotosToStorage().catch(()=>{}); }, 5000);
setTimeout(renderCalFrames, 800);
// Auto-refresh agendadas checks every 30s so all devices stay in sync
setInterval(async function(){
  try{
    // No sincronizar si hay un modal abierto (usuario editando activamente)
    const anyModalOpen = document.querySelector('.modal-overlay.open');
    if(anyModalOpen) return;
    const agKey = _agendaCheckKey();
    const remoteAgendadas = await supaLoadConfig('agendadas_'+agKey);
    if(remoteAgendadas !== null){
      localStorage.setItem(agKey, JSON.stringify(remoteAgendadas));
      renderAlertsInicio();
    }
  }catch(e){}
}, 30000);

// Auto-refresh cada 60s — fallback multi-dispositivo cuando Realtime falla
setInterval(async function(){
  try{
    const anyModalOpen = document.querySelector('.modal-overlay.open');
    if(anyModalOpen) return; // no interrumpir si están editando
    await supaLoadDeletedIds();
    await supaRetryPendingDeletes();
    const prevCount = patients.length;
    await initPatients();
    renderPatients(); renderStats(); renderAlertsInicio(); renderStatsInicio();
    if(patients.length !== prevCount) console.log('[autorefresh] pacientes:',prevCount,'→',patients.length);
    // Sincronizar citas y pre-citas (fallback si Realtime no funciona)
    await initCitas();
    await initPreCitas();
    _renderCitasViews();
    renderPcStats();
    // Sincronizar pagos (fallback si Realtime falla — evita que pagos eliminados reaparezcan)
    await initRegistros();
    renderPagos(); renderPgSummary();
  }catch(e){}
}, 60000);
(function(){
  const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const now=new Date();
  const el=document.getElementById('calTodayDateI');
  if(el)el.textContent=`${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;
})();

// ===== RECORDATORIO RESPALDO SEMANAL =====
function updateBackupReminderBanner(){
  // Solo mostrar a admin Y solo en PC (no en móvil/tablet)
  if(currentRole !== 'admin') return;
  if(window.innerWidth < 1025) return; // Solo PC
  const dismissed = localStorage.getItem('backupBannerDismissed');
  if(dismissed === new Date().toISOString().split('T')[0]){ return; }
  const banner = document.getElementById('backupReminderBanner');
  if(!banner) return;

  const lastBackupStr = localStorage.getItem('elle_last_backup');
  const snoozeStr = localStorage.getItem('elle_backup_snooze');
  const now = new Date();

  // Si pospuso para hoy, no mostrar
  if(snoozeStr){
    const snoozeDate = new Date(snoozeStr);
    if(snoozeDate.toDateString() === now.toDateString()){
      banner.style.display = 'none';
      return;
    }
  }

  let diasSinRespaldo = null;
  if(lastBackupStr){
    const last = new Date(lastBackupStr);
    diasSinRespaldo = Math.floor((now - last) / (1000*60*60*24));
  }

  const title = document.getElementById('backupReminderTitle');
  const sub = document.getElementById('backupReminderSub');

  // Sin ningún respaldo registrado
  if(diasSinRespaldo === null){
    title.textContent = '¡Aún no tienes ningún respaldo guardado!';
    sub.textContent = 'Descarga tu primer respaldo ahora para proteger todos tus datos.';
    banner.style.display = 'flex';
    return;
  }

  // Han pasado 7 o más días
  if(diasSinRespaldo >= 7){
    title.textContent = diasSinRespaldo === 7
      ? '¡Es momento de tu respaldo semanal!'
      : `! Llevas ${diasSinRespaldo} días sin hacer un respaldo`;
    sub.textContent = 'Descarga tu respaldo ahora para no perder ningún dato de Elle Studio.';
    banner.style.display = 'flex';
    return;
  }

  // Todavía no hace falta
  banner.style.display = 'none';
}

function dismissBackupBannerForever(){
  document.getElementById('backupReminderBanner').style.display='none';
  localStorage.setItem('backupBannerDismissed', new Date().toISOString().split('T')[0]);
}
function snoozeBackupReminder(){
  // Posponer: no mostrar hasta mañana
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  localStorage.setItem('elle_backup_snooze', tomorrow.toISOString());
  document.getElementById('backupReminderBanner').style.display = 'none';
  showToast('⏰ Te recordaremos mañana','#a0522d');
}

// ===== LISTA DE PRECIOS =====
let _editPrecioCI=null,_editPrecioII=null,_editPromoIdx=null,_preciosSvcActivo='';

const SVC_ICONS={'Depilación Láser':'✨','Aparatología':'💆','Skincare':'✅','Faciales':'🧖','Glúteos':'🍑','Otros':'💎'};

const PRECIOS_DEFAULT={
  servicios:['Depilación Láser','Faciales','Glúteos','Aparatología','Skincare'],
  categorias:[
    {servicio:'Depilación Láser',nombre:'Mini Zonas',items:[
      {zona:'Frente',mSesion:25,mPaq3:null,mPaq6:null,mPaquete:45,hSesion:25,hPaq3:null,hPaq6:null,hPaquete:45},
      {zona:'Entrecejo',mSesion:25,mPaq3:null,mPaq6:null,mPaquete:45,hSesion:25,hPaq3:null,hPaq6:null,hPaquete:45},
      {zona:'Patilla',mSesion:25,mPaq3:null,mPaq6:null,mPaquete:45,hSesion:25,hPaq3:null,hPaq6:null,hPaquete:45},
      {zona:'Bozo',mSesion:25,mPaq3:null,mPaq6:null,mPaquete:45,hSesion:25,hPaq3:null,hPaq6:null,hPaquete:45},
      {zona:'Mejillas',mSesion:25,mPaq3:null,mPaq6:null,mPaquete:45,hSesion:25,hPaq3:null,hPaq6:null,hPaquete:45},
      {zona:'Mentón',mSesion:25,mPaq3:null,mPaq6:null,mPaquete:45,hSesion:25,hPaq3:null,hPaq6:null,hPaquete:45},
      {zona:'Dedos (manos y pies)',mSesion:25,mPaq3:null,mPaq6:null,mPaquete:45,hSesion:25,hPaq3:null,hPaq6:null,hPaquete:45},
    ]},
    {servicio:'Depilación Láser',nombre:'Zonas Pequeñas',items:[
      {zona:'Axilas',mSesion:35,mPaq3:90,mPaq6:165,mPaquete:75,hSesion:35,hPaq3:90,hPaq6:165,hPaquete:75},
      {zona:'Línea alba',mSesion:35,mPaq3:90,mPaq6:165,mPaquete:75,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Pezones',mSesion:35,mPaq3:90,mPaq6:165,mPaquete:75,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
    ]},
    {servicio:'Depilación Láser',nombre:'Zonas Medias',items:[
      {zona:'Media pierna',mSesion:95,mPaq3:255,mPaq6:480,mPaquete:225,hSesion:110,hPaq3:290,hPaq6:540,hPaquete:240},
      {zona:'Medio Brazo',mSesion:95,mPaq3:255,mPaq6:480,mPaquete:225,hSesion:110,hPaq3:290,hPaq6:540,hPaquete:240},
      {zona:'Medio pecho',mSesion:95,mPaq3:255,mPaq6:480,mPaquete:225,hSesion:110,hPaq3:290,hPaq6:540,hPaquete:240},
      {zona:'Media espalda',mSesion:95,mPaq3:255,mPaq6:480,mPaquete:225,hSesion:110,hPaq3:290,hPaq6:540,hPaquete:240},
    ]},
    {servicio:'Depilación Láser',nombre:'Zonas Completas',items:[
      {zona:'Pierna completa',mSesion:179.90,mPaq3:480,mPaq6:899,mPaquete:299.90,hSesion:179.90,hPaq3:480,hPaq6:899,hPaquete:399.90},
      {zona:'Brazos completo',mSesion:90,mPaq3:240,mPaq6:450,mPaquete:220,hSesion:105,hPaq3:275,hPaq6:510,hPaquete:265},
      {zona:'Pecho completo',mSesion:90,mPaq3:240,mPaq6:450,mPaquete:220,hSesion:105,hPaq3:275,hPaq6:510,hPaquete:265},
      {zona:'Espalda completa',mSesion:90,mPaq3:240,mPaq6:450,mPaquete:220,hSesion:105,hPaq3:275,hPaq6:510,hPaquete:265},
    ]},
    {servicio:'Depilación Láser',nombre:'Zonas Íntimas (Mujer)',items:[
      {zona:'Bikini',mSesion:45,mPaq3:120,mPaq6:225,mPaquete:135,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Bikini brasileño',mSesion:55,mPaq3:145,mPaq6:275,mPaquete:159.90,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Entre pierna',mSesion:35,mPaq3:90,mPaq6:165,mPaquete:75,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Periné',mSesion:35,mPaq3:90,mPaq6:165,mPaquete:75,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Perianal',mSesion:35,mPaq3:90,mPaq6:165,mPaquete:75,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Interglútea',mSesion:35,mPaq3:90,mPaq6:165,mPaquete:75,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
    ]},
    {servicio:'Depilación Láser',nombre:'Zonas Íntimas (Hombre)',items:[
      {zona:'Pene',mSesion:null,mPaq3:null,mPaq6:null,mPaquete:null,hSesion:65,hPaq3:170,hPaq6:320,hPaquete:175},
      {zona:'Testículos',mSesion:null,mPaq3:null,mPaq6:null,mPaquete:null,hSesion:55,hPaq3:145,hPaq6:275,hPaquete:145},
    ]},
    {servicio:'Glúteos',nombre:'Tratamientos',items:[
      {zona:'Glúteos con aparatología',mSesion:80,mPaq3:210,mPaq6:390,mPaquete:null,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Moldeo corporal glúteos',mSesion:70,mPaq3:185,mPaq6:340,mPaquete:null,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Glúteos + masaje drenante',mSesion:100,mPaq3:265,mPaq6:495,mPaquete:null,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
    ]},
    {servicio:'Faciales',nombre:'Tratamientos Faciales',items:[
      {zona:'Limpieza facial profunda',mSesion:60,mPaq3:160,mPaq6:300,mPaquete:null,hSesion:60,hPaq3:160,hPaq6:300,hPaquete:null},
      {zona:'Hidratación facial',mSesion:55,mPaq3:145,mPaq6:270,mPaquete:null,hSesion:55,hPaq3:145,hPaq6:270,hPaquete:null},
      {zona:'Peeling químico',mSesion:80,mPaq3:210,mPaq6:390,mPaquete:null,hSesion:80,hPaq3:210,hPaq6:390,hPaquete:null},
      {zona:'Radiofrecuencia facial',mSesion:90,mPaq3:240,mPaq6:450,mPaquete:null,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Microdermoabrasión',mSesion:75,mPaq3:195,mPaq6:365,mPaquete:null,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
    ]},
    {servicio:'Aparatología',nombre:'Tratamientos Corporales',items:[
      {zona:'Cavitación',mSesion:70,mPaq3:185,mPaq6:340,mPaquete:null,hSesion:70,hPaq3:185,hPaq6:340,hPaquete:null},
      {zona:'Radiofrecuencia corporal',mSesion:80,mPaq3:210,mPaq6:390,mPaquete:null,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Presoterapia',mSesion:60,mPaq3:160,mPaq6:300,mPaquete:null,hSesion:null,hPaq3:null,hPaq6:null,hPaquete:null},
    ]},
    {servicio:'Skincare',nombre:'Cuidado de Piel',items:[
      {zona:'Consulta + rutina personalizada',mSesion:50,mPaq3:null,mPaq6:null,mPaquete:null,hSesion:50,hPaq3:null,hPaq6:null,hPaquete:null},
      {zona:'Tratamiento anti-acné',mSesion:70,mPaq3:185,mPaq6:340,mPaquete:null,hSesion:70,hPaq3:185,hPaq6:340,hPaquete:null},
    ]},
  ],
  promociones:[
    {nombre:'Bikini brasileño + Entre piernas',precio:159.90,mes:'Febrero'},
    {nombre:'Piernas completas + Axilas',precio:199.90,mes:'Febrero'},
  ]
};

// Migrate old data that doesn't have paq3/paq6
function migratePrecios(data){
  if(!data||!data.categorias)return data;
  data.categorias.forEach(cat=>{
    cat.items.forEach(item=>{
      if(item.mPaq3===undefined)item.mPaq3=null;
      if(item.mPaq6===undefined)item.mPaq6=null;
      if(item.hPaq3===undefined)item.hPaq3=null;
      if(item.hPaq6===undefined)item.hPaq6=null;
    });
  });
  // Add new services if missing
  ['Glúteos','Faciales','Aparatología','Skincare'].forEach(svc=>{
    if(!data.servicios.includes(svc))data.servicios.push(svc);
  });
  return data;
}

let preciosData=migratePrecios(JSON.parse(localStorage.getItem('ellePrecios2')||'null'))||JSON.parse(JSON.stringify(PRECIOS_DEFAULT));
function savePrecios(){
  try{localStorage.setItem('ellePrecios2',JSON.stringify(preciosData));}catch(e){console.error('savePrecios localStorage:',e);}
  supaSavePrecios();
}

function fmtS(v){if(v==null||v===''||v===undefined)return null;var n=parseFloat(v);if(isNaN(n))return null;var s=n.toFixed(2);return 'S/ '+(s.endsWith('.00')?s.slice(0,-3):s);}
function fmtCell(v){const f=fmtS(v);return f?`<span class="precio-cell">${f}</span>`:`<span class="precio-dash">—</span>`;}

function switchMpriceTab(panel,btn){
  document.querySelectorAll('.mprice-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.mprice-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('mpanel-'+panel).classList.add('active');
}

function togglePreciosGenero(svcId, genero, btn){
  const table = document.getElementById('ptable-'+svcId);
  if(!table) return;
  // Toggle button styles
  const toggle = btn.closest('.precios-gender-toggle');
  toggle.querySelectorAll('.pgender-btn').forEach(b=>{
    b.style.background='white'; b.style.color='var(--text-light)'; b.style.fontWeight='500';
  });
  btn.style.background= genero==='mujer'?'#f0f4ec':'#dde6d0';
  btn.style.color='#3d4f30'; btn.style.fontWeight='600';
  // Show/hide columns using inline style to override the CSS !important
  table.querySelectorAll('.precios-col-mujer').forEach(el=>{
    el.style.setProperty('display', genero==='mujer' ? 'table-cell' : 'none', 'important');
  });
  table.querySelectorAll('.precios-col-hombre').forEach(el=>{
    el.style.setProperty('display', genero==='hombre' ? 'table-cell' : 'none', 'important');
  });
}
function renderPrecios(){
  const isAdmin=currentRole==='admin';
  const adminBtns=document.getElementById('preciosAdminBtns');
  if(adminBtns)adminBtns.style.display=isAdmin?'flex':'none';

  const tabsEl=document.getElementById('preciosTabs');
  if(tabsEl){
    tabsEl.innerHTML=`<button class="precio-tab${!_preciosSvcActivo?' active':''}" onclick="setPrecioTab('',this)">Todos</button>`+
      preciosData.servicios.map(s=>`<button class="precio-tab${_preciosSvcActivo===s?' active':''}" onclick="setPrecioTab('${s}',this)">${s}</button>`).join('');
  }

  const buscar=(document.getElementById('preciosBuscar')?.value||'').toLowerCase();
  const container=document.getElementById('preciosContent');
  if(!container)return;

  const serviciosToShow=_preciosSvcActivo?[_preciosSvcActivo]:preciosData.servicios;
  let tablesHtml='';

  serviciosToShow.forEach(svc=>{
    const cats=preciosData.categorias.filter(c=>c.servicio===svc);
    if(!cats.length)return;
    const catsF=cats.map(cat=>{
      const items=cat.items.filter(item=>!buscar||item.zona.toLowerCase().includes(buscar));
      return {...cat,items};
    }).filter(c=>c.items.length);
    if(!catsF.length&&buscar)return;

    const allItems=cats.flatMap(c=>c.items);
    const hasPaq3=allItems.some(i=>i.mPaq3!=null||i.hPaq3!=null);
    const hasPaq6=allItems.some(i=>i.mPaq6!=null||i.hPaq6!=null);
    const hasPaq12=false; // columna Paquete x12 oculta
    const hasH=allItems.some(i=>i.hSesion!=null||i.hPaq3!=null||i.hPaq6!=null||i.hPaquete!=null);
    const icon=SVC_ICONS[svc]||'💎';

    let mCols=1+(hasPaq3?1:0)+(hasPaq6?1:0);
    let hCols=hasH?(1+(hasPaq3?1:0)+(hasPaq6?1:0)):0;
    const totalCols=1+mCols+hCols;

    const svcId = svc.replace(/[^a-z0-9]/gi,'_');
    tablesHtml+=`<div class="precios-wrap">
      <div class="precios-svc-header">
        <span><span class="precios-svc-icon">${icon}</span>${svc}</span>
        ${isAdmin?`<button onclick="openPrecioModal('${svc}')" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;padding:5px 14px;border-radius:8px;font-size:0.75rem;cursor:pointer;">+ Zona</button>`:''}
      </div>
      ${hasH?`<div class="precios-gender-toggle" style="display:none;gap:0;border-bottom:1px solid var(--border);">
        <button onclick="togglePreciosGenero('${svcId}','mujer',this)" class="pgender-btn active" style="flex:1;padding:10px;font-size:0.85rem;font-weight:600;border:none;background:#f0f4ec;color:#3d4f30;cursor:pointer;border-right:1px solid var(--border);">Mujer</button>
        <button onclick="togglePreciosGenero('${svcId}','hombre',this)" class="pgender-btn" style="flex:1;padding:10px;font-size:0.85rem;font-weight:500;border:none;background:white;color:var(--text-light);cursor:pointer;">Hombre</button>
      </div>`:''}
      <div style="overflow-x:auto;">
      <table class="precios-table" id="ptable-${svcId}"><thead>
        <tr>
          <th class="th-zona" rowspan="2">Zonas:</th>
          <th class="th-mujer precios-col-mujer" colspan="${mCols}">Mujer</th>
          ${hasH?`<th class="th-hombre precios-col-hombre" colspan="${hCols}">Hombre</th>`:''}
        </tr>
        <tr>
          <th class="th-sub-mujer precios-col-mujer">Sesión</th>
          ${hasPaq3?`<th class="th-sub-mujer precios-col-mujer">×3</th>`:''}
          ${hasPaq6?`<th class="th-sub-mujer precios-col-mujer">×6</th>`:''}
          ${hasH?`<th class="th-sub-hombre precios-col-hombre">Sesión</th>`:''}
          ${hasH&&hasPaq3?`<th class="th-sub-hombre precios-col-hombre">×3</th>`:''}
          ${hasH&&hasPaq6?`<th class="th-sub-hombre precios-col-hombre">×6</th>`:''}
        </tr>
      </thead><tbody>`;

    catsF.forEach(cat=>{
      const realCI=preciosData.categorias.findIndex(c=>c.servicio===cat.servicio&&c.nombre===cat.nombre);
      tablesHtml+=`<tr class="cat-row"><td colspan="${totalCols}" style="display:table-cell;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          ${isAdmin
            ?`<input type="text" class="cat-nombre-inline" value="${cat.nombre}" onchange="renameCat(${realCI},this.value)" title="Clic para renombrar categoría">`
            :`<span>${cat.nombre}</span>`}
          ${isAdmin?`<button onclick="deleteCategoria(${realCI})" title="Eliminar categoría completa" style="background:rgba(196,96,96,0.25);border:1px solid rgba(196,96,96,0.4);color:#ffd0d0;border-radius:6px;padding:2px 8px;font-size:0.7rem;cursor:pointer;">🗑 Eliminar categoría</button>`:''}
        </div>
      </td></tr>`;
      cat.items.forEach(item=>{
        const realII=preciosData.categorias[realCI]?.items.findIndex(x=>x.zona===item.zona);
        const pc=`${realCI},${realII}`;
        const editCell=(cls,field,val)=>isAdmin
          ?`<td class="${cls}"><input type="number" class="precio-inline-input" value="${val==null?'':val}" placeholder="—" min="0" step="0.10" onchange="updatePrecioInline(${pc},'${field}',this.value)" onfocus="this.select()"></td>`
          :`<td class="${cls}">${fmtN(val)}</td>`;
        tablesHtml+=`<tr class="data-row">
          <td class="zona-cell">${isAdmin?`<input type="text" class="zona-nombre-inline" value="${item.zona}" onchange="renameZona(${pc},this.value)" title="Clic para renombrar zona">`:`${item.zona}`}</td>
          ${editCell('mujer-cell precios-col-mujer','mSesion',item.mSesion)}
          ${hasPaq3?editCell('mujer-cell precios-col-mujer','mPaq3',item.mPaq3):''}
          ${hasPaq6?editCell('mujer-cell precios-col-mujer','mPaq6',item.mPaq6):''}
          ${hasH?editCell('hombre-cell precios-col-hombre','hSesion',item.hSesion):''}
          ${hasH&&hasPaq3?editCell('hombre-cell precios-col-hombre','hPaq3',item.hPaq3):''}
          ${hasH&&hasPaq6?editCell('hombre-cell precios-col-hombre','hPaq6',item.hPaq6):''}
        </tr>`;
      });
    });
    tablesHtml+=`</tbody></table></div></div>`;
  });

  if(!tablesHtml)tablesHtml=`<div style="text-align:center;padding:50px;color:var(--text-light);font-size:0.9rem;">No se encontraron resultados.</div>`;

  // Build promo panel (right side)
  const mesList=[...new Set(preciosData.promociones.map(p=>p.mes||''))].filter(Boolean);
  let promoHtml=`<div class="precios-promo-panel">
    <div class="promo-panel-header">
      <span>Promociones</span>
      ${isAdmin?`<button onclick="openPromoModal()" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:white;padding:3px 10px;border-radius:6px;font-size:0.72rem;cursor:pointer;">+ Agregar</button>`:''}
    </div>`;

  if(preciosData.promociones.length){
    if(mesList.length){
      mesList.forEach(mes=>{
        promoHtml+=`<div class="promo-panel-mes">${mes}</div>`;
        preciosData.promociones.forEach((p,i)=>{
          if((p.mes||'')!==mes)return;
          promoHtml+=`<div class="promo-item">
            <span class="promo-item-nombre">${p.nombre}</span>
            <div style="display:flex;align-items:center;gap:6px;">
              ${p.precio?`<span class="promo-item-precio">${fmtN(p.precio)}</span>`:''}
              ${isAdmin?`<button class="btn-edit-zona" onclick="openPromoModal(${i})">✏️</button>`:''}
            </div>
          </div>`;
        });
      });
    }
    const noMes=preciosData.promociones.filter(p=>!p.mes);
    noMes.forEach((p,i)=>{
      const realI=preciosData.promociones.indexOf(p);
      promoHtml+=`<div class="promo-item">
        <span class="promo-item-nombre">${p.nombre}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          ${p.precio?`<span class="promo-item-precio">${fmtN(p.precio)}</span>`:''}
          ${isAdmin?`<button class="btn-edit-zona" onclick="openPromoModal(${realI})">✏️</button>`:''}
        </div>
      </div>`;
    });
  } else {
    promoHtml+=`<div style="padding:14px;color:#888;font-size:0.82rem;">Sin promociones activas.</div>`;
  }
  promoHtml+=`</div>`;

  container.innerHTML=`<div class="precios-layout"><div>${tablesHtml}</div>${promoHtml}</div>`;
}

function updatePrecioInline(ci,ii,field,val){
  const item=preciosData.categorias[ci]?.items[ii];
  if(!item)return;
  item[field]=val===''?null:parseFloat(val);
  savePrecios();
  showToast('✅ Precio actualizado');
}

function renameCat(ci,newName){
  newName=newName.trim();
  if(!newName)return;
  if(preciosData.categorias[ci])preciosData.categorias[ci].nombre=newName;
  savePrecios();
  showToast('✅ Categoría renombrada');
}

function renameZona(ci,ii,newName){
  newName=newName.trim();
  if(!newName)return;
  const item=preciosData.categorias[ci]?.items[ii];
  if(item)item.zona=newName;
  savePrecios();
  showToast('✅ Zona renombrada');
}

function fmtN(v){
  if(v==null||v===''||v===undefined)return `<span class="precio-dash">-</span>`;
  var n=parseFloat(v);
  if(isNaN(n))return `<span class="precio-dash">-</span>`;
  return n%1===0?String(n):n.toFixed(2);
}

function setPrecioTab(svc,btn){
  _preciosSvcActivo=svc;
  renderPrecios();
}

function openPrecioModal(svcPreset){
  if(currentRole!=='admin'){showToast('Solo admin puede editar precios','#c46060');return;}
  _editPrecioCI=null;_editPrecioII=null;
  document.getElementById('precioModalTitle').textContent='Nueva Zona';
  document.getElementById('pZona').value='';
  ['pMSesion','pMPaq3','pMPaq6','pMPaquete','pHSesion','pHPaq3','pHPaq6','pHPaquete'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('pDeleteBtn').style.display='none';
  // Reset to mujer tab
  document.querySelectorAll('.mprice-tab').forEach((b,i)=>{b.classList.toggle('active',i===0);});
  document.querySelectorAll('.mprice-panel').forEach((p,i)=>{p.classList.toggle('active',i===0);});
  populatePServicio(typeof svcPreset==='string'?svcPreset:(preciosData.servicios[0]||''));
  openModal('precioModal');
}

function openEditPrecioItem(ci,ii){
  if(currentRole!=='admin'){showToast('Solo admin puede editar precios','#c46060');return;}
  _editPrecioCI=ci;_editPrecioII=ii;
  const cat=preciosData.categorias[ci];const item=cat.items[ii];
  document.getElementById('precioModalTitle').textContent='Editar: '+item.zona;
  document.getElementById('pZona').value=item.zona;
  const setV=(id,v)=>{const el=document.getElementById(id);if(el)el.value=(v!=null?v:'');};
  setV('pMSesion',item.mSesion);setV('pMPaq3',item.mPaq3);setV('pMPaq6',item.mPaq6);setV('pMPaquete',item.mPaquete);
  setV('pHSesion',item.hSesion);setV('pHPaq3',item.hPaq3);setV('pHPaq6',item.hPaq6);setV('pHPaquete',item.hPaquete);
  document.getElementById('pDeleteBtn').style.display='block';
  document.querySelectorAll('.mprice-tab').forEach((b,i)=>{b.classList.toggle('active',i===0);});
  document.querySelectorAll('.mprice-panel').forEach((p,i)=>{p.classList.toggle('active',i===0);});
  populatePServicio(cat.servicio);
  populatePCategoria(cat.nombre);
  openModal('precioModal');
}

function populatePServicio(selected){
  const sel=document.getElementById('pServicio');
  sel.innerHTML=preciosData.servicios.map(s=>`<option value="${s}"${s===selected?'selected':''}>${s}</option>`).join('');
  populatePCategoria('');
}

function populatePCategoria(selected){
  const svc=document.getElementById('pServicio').value;
  const cats=[...new Set(preciosData.categorias.filter(c=>c.servicio===svc).map(c=>c.nombre))];
  const sel=document.getElementById('pCategoria');
  sel.innerHTML=cats.map(c=>`<option value="${c}"${c===selected?'selected':''}>${c}</option>`).join('')+'<option value="__nueva__">+ Nueva categoría...</option>';
  if(selected&&cats.includes(selected))sel.value=selected;
  toggleNewCat();
}

function toggleNewCat(){
  const sel=document.getElementById('pCategoria');
  const wrap=document.getElementById('pNuevaCatWrap');
  if(wrap)wrap.style.display=sel.value==='__nueva__'?'block':'none';
}

function closePrecioModal(){closeModal('precioModal');}

function savePrecioItem(){
  const zona=document.getElementById('pZona').value.trim();
  if(!zona){showToast('Ingresa el nombre de la zona','#c46060');return;}
  const svc=document.getElementById('pServicio').value;
  const catSel=document.getElementById('pCategoria').value;
  const catNombre=catSel==='__nueva__'?document.getElementById('pNuevaCategoria').value.trim():catSel;
  if(!catNombre){showToast('Ingresa el nombre de la categoría','#c46060');return;}
  const val=id=>{const el=document.getElementById(id);if(!el)return null;const v=el.value;return v===''?null:parseFloat(v);};
  const item={zona,
    mSesion:val('pMSesion'),mPaq3:val('pMPaq3'),mPaq6:val('pMPaq6'),mPaquete:val('pMPaquete'),
    hSesion:val('pHSesion'),hPaq3:val('pHPaq3'),hPaq6:val('pHPaq6'),hPaquete:val('pHPaquete')
  };
  if(_editPrecioCI!==null&&_editPrecioII!==null){
    const oldCat=preciosData.categorias[_editPrecioCI];
    if(oldCat.servicio===svc&&oldCat.nombre===catNombre){
      oldCat.items[_editPrecioII]=item;
    } else {
      oldCat.items.splice(_editPrecioII,1);
      if(!oldCat.items.length)preciosData.categorias.splice(_editPrecioCI,1);
      ensureCategory(svc,catNombre).items.push(item);
    }
  } else {
    ensureCategory(svc,catNombre).items.push(item);
  }
  savePrecios();closePrecioModal();renderPrecios();
  showToast('✅ Zona guardada correctamente');
}

function ensureCategory(svc,nombre){
  let cat=preciosData.categorias.find(c=>c.servicio===svc&&c.nombre===nombre);
  if(!cat){cat={servicio:svc,nombre,items:[]};preciosData.categorias.push(cat);}
  return cat;
}

function deletePrecioItem(){
  if(_editPrecioCI===null)return;
  const item=preciosData.categorias[_editPrecioCI].items[_editPrecioII];
  if(!confirm(`¿Eliminar "${item.zona}" de la lista de precios?`))return;
  preciosData.categorias[_editPrecioCI].items.splice(_editPrecioII,1);
  if(!preciosData.categorias[_editPrecioCI].items.length)preciosData.categorias.splice(_editPrecioCI,1);
  savePrecios();closePrecioModal();renderPrecios();
  showToast('🗑 Zona eliminada','#c46060');
}

function deleteCategoria(ci){
  if(currentRole!=='admin'){showToast('Solo admin puede editar precios','#c46060');return;}
  const cat=preciosData.categorias[ci];
  if(!cat)return;
  if(!confirm(`¿Eliminar la categoría "${cat.nombre}" y TODAS sus zonas (${cat.items.length} zonas)?\n\nNo se puede deshacer.`))return;
  preciosData.categorias.splice(ci,1);
  savePrecios();renderPrecios();
  showToast(`🗑 Categoría "${cat.nombre}" eliminada`,'#c46060');
}

function openServicioModal(){
  if(currentRole!=='admin')return;
  renderServiciosList();openModal('servicioModal');
}
function closeServicioModal(){closeModal('servicioModal');}
function renderServiciosList(){
  const el=document.getElementById('serviciosList');
  el.innerHTML=preciosData.servicios.map((s,i)=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:0.88rem;">${SVC_ICONS[s]||'💎'} ${s}</span>
      ${preciosData.servicios.length>1?`<button class="btn btn-danger" style="padding:3px 10px;font-size:0.73rem;" onclick="deleteServicio(${i})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`:''}
    </div>`).join('');
}
function addServicio(){
  const v=document.getElementById('nuevoServicioInput').value.trim();
  if(!v||preciosData.servicios.includes(v)){showToast('Nombre inválido o ya existe','#c46060');return;}
  preciosData.servicios.push(v);
  document.getElementById('nuevoServicioInput').value='';
  savePrecios();renderServiciosList();renderPrecios();
  showToast('✅ Servicio agregado');
}
function deleteServicio(i){
  const svc=preciosData.servicios[i];
  if(preciosData.categorias.some(c=>c.servicio===svc)){
    if(!confirm(`⚠️ ¿Estás segura de eliminar "${svc}" y TODAS sus zonas?\n\nNo se puede deshacer.`))return;
    preciosData.categorias=preciosData.categorias.filter(c=>c.servicio!==svc);
  } else {
    if(!confirm(`⚠️ ¿Estás segura de eliminar el servicio "${svc}"?`))return;
  }
  preciosData.servicios.splice(i,1);
  if(_preciosSvcActivo===svc)_preciosSvcActivo='';
  savePrecios();renderServiciosList();renderPrecios();
  showToast('🗑 Servicio eliminado','#c46060');
}

function openPromoModal(i){
  if(currentRole!=='admin')return;
  _editPromoIdx=(i!=null)?i:null;
  if(i!=null){
    const p=preciosData.promociones[i];
    document.getElementById('promoModalTitle').textContent='Editar Promoción';
    document.getElementById('promoNombre').value=p.nombre;
    document.getElementById('promoPrecio').value=p.precio!=null?p.precio:'';
    document.getElementById('promoMes').value=p.mes;
    document.getElementById('promoDeleteBtn').style.display='block';
  } else {
    document.getElementById('promoModalTitle').textContent='Nueva Promoción';
    ['promoNombre','promoPrecio','promoMes'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('promoDeleteBtn').style.display='none';
  }
  openModal('promoModal');
}
function closePromoModal(){closeModal('promoModal');}
function savePromo(){
  const nombre=document.getElementById('promoNombre').value.trim();
  if(!nombre){showToast('Ingresa el nombre','#c46060');return;}
  const precio=document.getElementById('promoPrecio').value;
  const mes=document.getElementById('promoMes').value.trim();
  const obj={nombre,precio:precio===''?null:parseFloat(precio),mes};
  if(_editPromoIdx!=null)preciosData.promociones[_editPromoIdx]=obj;
  else preciosData.promociones.push(obj);
  savePrecios();closePromoModal();renderPrecios();
  showToast('✅ Promoción guardada');
}
function deletePromo(i){
  if(!confirm('⚠️ ¿Estás segura de eliminar esta promoción?'))return;
  preciosData.promociones.splice(i,1);
  savePrecios();closePromoModal();renderPrecios();
  showToast('🗑 Promoción eliminada','#c46060');
}

// ===== SESIONES ACTIVAS (solo admin) =====
const SESSION_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
let _sessionHeartbeat = null;

async function getPublicIP() {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const d = await r.json();
    return d.ip || 'IP desconocida';
  } catch {
    try {
      const r2 = await fetch('https://api4.my-ip.io/ip.json');
      const d2 = await r2.json();
      return d2.ip || 'IP desconocida';
    } catch { return 'IP desconocida'; }
  }
}

async function registerSession() {
  const ip = await getPublicIP();
  const now = new Date().toISOString();
  const ua = navigator.userAgent;
  const device = /Mobi|Android/i.test(ua) ? '📱 Móvil' : '💻 Escritorio';
  try {
    await supa.from('active_sessions').upsert({
      id: SESSION_ID,
      role: currentRole,
      ip: ip,
      device: device,
      last_seen: now,
      logged_in_at: now
    });
  } catch(e) { console.warn('Session tracking no disponible:', e.message); }
  // Heartbeat cada 45s
  clearInterval(_sessionHeartbeat);
  _sessionHeartbeat = setInterval(async () => {
    try {
      await supa.from('active_sessions').update({ last_seen: new Date().toISOString() }).eq('id', SESSION_ID);
    } catch {}
  }, 45000);
}

async function unregisterSession() {
  try { await supa.from('active_sessions').delete().eq('id', SESSION_ID); } catch {}
  clearInterval(_sessionHeartbeat);
}

async function openActiveSessions() {
  // Limpiar sesiones inactivas (más de 3 min sin heartbeat)
  const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  try { await supa.from('active_sessions').delete().lt('last_seen', cutoff); } catch {}

  let sessions = [];
  try {
    const { data } = await supa.from('active_sessions').select('*').order('logged_in_at', { ascending: false });
    sessions = data || [];
  } catch { sessions = []; }

  const now = Date.now();
  const rows = sessions.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:var(--text-light);padding:20px;">Sin sesiones activas registradas</td></tr>'
    : sessions.map(s => {
        const isMe = s.id === SESSION_ID;
        const ago = Math.floor((now - new Date(s.last_seen).getTime()) / 1000);
        const agoStr = ago < 60 ? `Hace ${ago}s` : `Hace ${Math.floor(ago/60)}m`;
        const roleLabel = s.role === 'admin' ? '🔑 Admin' : '🌸 Trabajadora';
        return `<tr style="${isMe ? 'background:rgba(122,140,106,0.08);' : ''}">
          <td style="padding:10px 12px;font-size:0.85rem;font-weight:500;">${roleLabel}${isMe ? ' <span style="font-size:0.7rem;color:#6a9e7a;">(tú)</span>' : ''}</td>
          <td style="padding:10px 12px;font-size:0.85rem;font-family:monospace;color:var(--text-light);">${s.ip}</td>
          <td style="padding:10px 12px;font-size:0.82rem;color:var(--text-light);">${s.device}</td>
          <td style="padding:10px 12px;font-size:0.8rem;color:var(--text-light);">${agoStr}</td>
        </tr>`;
      }).join('');

  const html = `
    <div class="modal-overlay" id="activeSessionsModal" onclick="if(event.target===this)closeActiveSessions()">
      <div class="modal" style="max-width:600px;">
        <div class="modal-header"><h2>👁 Sesiones Activas</h2><button class="close-btn" onclick="closeActiveSessions()">✕</button></div>
        <div style="padding:20px;">
          <p style="font-size:0.82rem;color:var(--text-light);margin-bottom:16px;">Usuarios con la página abierta en este momento (actualizado cada 45 seg).</p>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:var(--warm-white);">
                  <th style="padding:10px 12px;text-align:left;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-light);">Rol</th>
                  <th style="padding:10px 12px;text-align:left;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-light);">IP</th>
                  <th style="padding:10px 12px;text-align:left;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-light);">Dispositivo</th>
                  <th style="padding:10px 12px;text-align:left;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-light);">Última actividad</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <p style="font-size:0.75rem;color:var(--text-light);margin-top:12px;">Total: <strong>${sessions.length}</strong> sesión(es) activa(s)</p>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
            <button class="btn btn-secondary" onclick="openActiveSessions()">🔄 Actualizar</button>
            <button class="btn btn-secondary" onclick="closeActiveSessions()">Cerrar</button>
          </div>
        </div>
      </div>
    </div>`;

  // Remove existing if any
  const existing = document.getElementById('activeSessionsModal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeActiveSessions() {
  const m = document.getElementById('activeSessionsModal');
  if (m) m.remove();
}

// Limpiar sesión al cerrar/recargar
window.addEventListener('beforeunload', () => unregisterSession());
