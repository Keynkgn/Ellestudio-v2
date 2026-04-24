// ── Auth ──

async function hashPw(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

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

function addLogoutBtn() {
  // Logout now lives in the dropdown menu (#logoutBtnMenu), nothing to inject
}

function logout() {
  if (!confirm('¿Cerrar sesión?')) return;
  unregisterSession();
  currentRole = null;
  localStorage.removeItem('es_session_role');
  localStorage.removeItem('es_session_ts');
  localStorage.removeItem('es_role');
  location.reload();
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
