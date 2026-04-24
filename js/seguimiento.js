// ===== TRACKING =====

function populateTrkSvcFilter(){const sel=document.getElementById('trk-svc');if(!sel)return;const cur=sel.value;sel.innerHTML='<option value="">Todos</option>'+SERVICES().map(s=>`<option value="${s}">${s}</option>`).join('');sel.value=cur;}

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
// MOVED TO config.js — LASER_TPL, WA_TPL_DEFAULT, waTpls, waCustomCards, waServiceTpls, PC_TPL_DEFAULTS, preCitaTemplates, WA_TPL
