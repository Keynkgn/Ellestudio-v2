// MOVED TO config.js — DEFAULT_SERVICES, CAL_LINKS, CUB_COLORS
// ===== CONFIG =====
// const DEFAULT_SERVICES=[...] — MOVED TO config.js
// const CAL_LINKS={...} — MOVED TO config.js
// const CUB_COLORS={...} — MOVED TO config.js
// MOVED TO inicio.js — getLinkForCubiculo, _abrirAgendaSvc

// MOVED TO config.js — DEFAULT_WORKER_PERMS, DEFAULT_FRECUENCIAS, DEFAULT_CONFIG, _saved, appConfig, saveConfig
// MOVED TO utils.js — SERVICES(), FRECUENCIAS(), tcase()

// MOVED TO config.js — patients, removeDemoPatients, SUPA_URL, SUPA_KEY, supa
// ===== NEW DATA STRUCTURE =====
// patient.servicios = [{id, servicio, cubiculo, plan, fechaInicio, comentarios, zonas:[{nombre, sesiones:[...]}]}]

// MOVED TO pacientes.js — _compressToBlob, _uploadPhotoToStorage, migratePhotosToStorage

// MOVED TO db.js — initPatients, _syncPatientToElle, supaUpsertPatient, _deletedPatientIds, _trackDeletedId
// MOVED TO db.js — supaDeletePatient, supaRetryPendingDeletes, supaLoadDeletedIds
// MOVED TO db.js — supaSavePrecios, supaSaveWaCustom, supaSavePcTemplates, supaSaveWaTpls, supaSaveWaSvcTpls
// MOVED TO db.js — supaLoadConfig, initFromSupabase

// MOVED TO utils.js — _logSave, window._saveLog, escapeHtml
// MOVED TO db.js — syncStyle (animación syncPulse inline)
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

// MOVED TO db.js — manualRefreshData

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

// MOVED TO utils.js — ini, addWeeks, addDays, fmt12h, fmtDate, monthName, daysDiff, showToast, lastSesForSvc, lastSesAny, nextApptForSvc, alertDateForSvc, cubTag, cubLabel

// MOVED TO pacientes.js — exportBackup, doImport

// ===== TABS =====
function showSection(id,el){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('sec-'+id).classList.add('active');
  if(el&&el.classList)el.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  try{localStorage.setItem('es_last_section',id);}catch(e){}
  if(id==='pacientes'){renderContactBanner();}
  if(id==='seguimiento'){populateTrkSvcFilter();renderTracking();}
  if(id==='whatsapp'){populateWaSelects();initCalEmbedWA();setTimeout(loadCalBookingsWA,800);}
  if(id==='precitas'){populatePcServiceSelect('pcServicio');renderPreCitas();renderPcStats();}
  if(id==='pagos'){renderPagos();renderPgSummary();}
  if(id==='precios'){renderPrecios();}
  _syncBottomNav(id);
}
// MOVED TO seguimiento.js — populateTrkSvcFilter
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

// MOVED TO inicio.js — renderAgendaHoy, showEvtPopup, _sendCitaManualWa, closeEvtPopup, navMesInterno, renderMesInterno, toggleAgendaSemanal, navSemana, renderAgendaSemanal, openNuevaCitaModal, checkNcConflict, saveNuevaCita, toggleAsistio, deleteCitaHoy, getCalUrls, buildCalFrame, renderCalFrames, initCalEmbedWA, renderCalBookings, loadCalBookingsWA

// MOVED TO inicio.js — _getAlertDays, renderStatsInicio, toggleDashMetricas, renderDashMetricas, _getStore21, _getListaContactar, _saveStore21, _uid21, _agendaCheckKey, toggleAgendada, _contactar, _regresarContactada, renderAlertsInicio, _btn21Act, inicioSearchFn, renderStats, renderAlerts
// ===== PATIENTS GRID =====
// MOVED TO inicio.js — _sf var, renderContactBanner, toggleContactBanner

// MOVED TO pacientes.js — renderPatients, filterPatients, filterByService, setSortPatients, sortedPatients, openDetail, saveDetailChanges, renderSvcTabs, consent functions, renderZones, paquete functions, session functions, patient CRUD, backup, photos
// MOVED TO seguimiento.js — filterTracking, applyTrackingFilters, clearTrackingFilters, sortTracking, renderTrkStats, renderTracking, trkToggleGroup, trkMarkSelected, trkExportExcel, openProximaModal, togContacto, togAsistioTrk
// MOVED TO whatsapp.js — getWaTpl, populateWaSelects, initWaTemplates, filterWaPatients, selectWaPatient, updateWa, toggleEditWa, saveWaTpl, renderWaCustomCards, sendWaClipboard, buildMsg, sendWa, quickWa, _doQuickWa
// ===== SETTINGS =====
// MOVED TO precios.js — openSettings, renderWorkerPermsList, renderServicesList, renderFrecuenciasList, saveSettings, applyConfigToUI
// MOVED TO inicio.js — renderAll


// ===== PRE-CITAS DATA =====
// MOVED TO config.js — preCitas

// ══════════════════════════════════════════════════════
// MÓDULO 2 — Pre-citas: fuente única elle_precitas
// ══════════════════════════════════════════════════════
// MOVED TO db.js — _normalizePreCita, _pcToDb, _realtimePreCitasSub, _subscribeRealtimePreCitas, initPreCitas

// MOVED TO precitas.js — savePC, populatePcServiceSelect, openNewPreCita, savePreCita, openEditPreCita, saveEditPreCita, deletePreCita, convertirAPaciente, renderPcStats, renderPreCitas

// ===== PAGOS / REGISTROS (sistema independiente) =====
// Estructura: registros = [{id, fecha, nombre, apellido, telefono, patientId|null, servicio, zonas, atendio, total, adelanto, comision, notas}]
// MOVED TO config.js — registros

// ══════════════════════════════════════════════════════
// MÓDULO 5 — Pagos: fuente única elle_payments
// ══════════════════════════════════════════════════════
// MOVED TO db.js — _normalizeRegistro, _realtimeRegistrosSub, _subscribeRealtimeRegistros, initRegistros, saveReg

// Mantener compatibilidad: getPago/totalAbonado/saldo/estadoPago siguen funcionando para legacy
// MOVED TO pagos.js — getPago, totalAbonado, saldo, estadoPago, pgSort, renderPgSummary, renderPagos, openNuevoRegistro, saveNuevoRegistro, openEditRegistro, saveEditRegistro, deleteRegistro

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
// MOVED TO auth.js — PASSWORDS, hashPw, currentRole, _selectedRole, selectRole, backToRoles, doLogin


// MOVED TO precios.js — _diagErrors, _diagSaveLog, _diagOpen, error interceptors

// Registrar cada save() exitoso
// MOVED TO precios.js — _diagTrackSave, openDiagTerminal, closeDiagTerminal, _diagLog, _diagUpdateStats, diagClear, diagRunCheck, diagRunCmd


// MOVED TO auth.js — applyRoleRestrictions, disableDeleteButtons, WORKER_PERMS, _workerGuard, addLogoutBtn, toggleHeaderMenu, closeHeaderMenu, logout, checkSavedSession

// ===== INIT =====
// Limpiar backups viejos al iniciar — Supabase es el respaldo real
try{
  localStorage.removeItem('elle_backups');
}catch(e){}
applyConfigToUI();renderAll();
// Restaurar última sección activa
(function(){
  const last=localStorage.getItem('es_last_section');
  const valid=['inicio','pacientes','seguimiento','pagos','precitas','whatsapp','precios'];
  if(last&&valid.includes(last)&&last!=='inicio'){
    setTimeout(()=>showSectionById(last),200);
  }
})();
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
// MOVED TO inicio.js — updateBackupReminderBanner, dismissBackupBannerForever, snoozeBackupReminder

// ===== LISTA DE PRECIOS =====
// MOVED TO precios.js — migratePrecios, preciosData, savePrecios, renderPrecios, openSettings for precios, promos, sessions management

// Limpiar sesión al cerrar/recargar
window.addEventListener('beforeunload', () => unregisterSession());
