// ── Utils ──

// ===== UTILS =====
const ini=(n,a)=>(n[0]||'')+(a[0]||'');
// Normalizar nombres: "REVOLVERA- ZONA TROCANTEIRA" → "Revolvera - Zona Trocanteira"
function tcase(s){
  if(!s||typeof s!=='string')return s;
  return s.toLowerCase().replace(/\s*-\s*/g,' - ').replace(/\s+/g,' ').trim()
    .replace(/\b\p{L}/gu,c=>c.toUpperCase());
}
function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
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

function SERVICES(){return appConfig.services;}
function FRECUENCIAS(){
  if(!appConfig.frecuencias||!appConfig.frecuencias.length) appConfig.frecuencias=[...DEFAULT_FRECUENCIAS];
  return appConfig.frecuencias;
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

// Log de guardados en tiempo real
window._saveLog = [];
function _logSave(accion, detalle){
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  window._saveLog.unshift({hora, accion, detalle, ts: ahora.getTime()});
  if(window._saveLog.length > 50) window._saveLog.pop();
}

// Helper: timeout para queries de Supabase (evita que un fetch colgado bloquee toda la app)
function _supaRace(promise, ms=10000){
  return Promise.race([
    promise,
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout: Supabase no respondió en '+(ms/1000)+'s')),ms))
  ]);
}

function fmtS(v){if(v==null||v===''||v===undefined)return null;var n=parseFloat(v);if(isNaN(n))return null;var s=n.toFixed(2);return 'S/ '+(s.endsWith('.00')?s.slice(0,-3):s);}

function fmtN(v){
  if(v==null||v===''||v===undefined)return `<span class="precio-dash">-</span>`;
  var n=parseFloat(v);
  if(isNaN(n))return `<span class="precio-dash">-</span>`;
  return n%1===0?String(n):n.toFixed(2);
}
