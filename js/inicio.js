
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
// MOVED TO db.js — _normalizeCita, _upsertCitaArr, _removeCitaArr, _renderCitasViews
// MOVED TO db.js — _realtimeCitasSub, _subscribeRealtimeCitas, initCitas

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
// MOVED TO config.js — CAL_API_KEY

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
function renderAll(){renderAgendaHoy();renderAgendaSemanal();if(typeof renderMesInterno==='function'&&document.getElementById('mesInternoGrid'))renderMesInterno();renderStatsInicio();renderAlertsInicio();renderStats();renderPatients();renderAlerts();renderPcStats();renderPagos();renderPgSummary();if(document.getElementById('trackingBody'))renderTracking();populateWaSelects();}
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
