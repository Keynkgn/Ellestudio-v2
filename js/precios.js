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
// MOVED TO config.js — PERM_LABELS
// === PERMISOS TRABAJADORA ===
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

let _editPrecioCI=null,_editPrecioII=null,_editPromoIdx=null,_preciosSvcActivo='';

// MOVED TO config.js — SVC_ICONS, PRECIOS_DEFAULT, migratePrecios, preciosData, savePrecios
// MOVED TO utils.js — fmtS
// (migratePrecios y preciosData re-declarados aquí para inicialización local)
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

// MOVED TO utils.js — fmtN

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
// MOVED TO config.js — SESSION_ID
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
