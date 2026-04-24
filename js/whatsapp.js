function getWaTpl(n){return waTpls[n]||WA_TPL_DEFAULT[n];}

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

