// ── Config ──

// ===== CONFIG =====
const DEFAULT_SERVICES=['Depilación Láser','Glúteos de Porcelana','Limpieza Facial Post Operatorio','Limpieza de Espalda','Reductores'];
const CAL_LINKS={laser:'https://calendar.app.google/3hRGipXZtueFVbVm6',cal02:'https://cal.com/elle-studio-56pfyg/tratamientos-ellestudio02',cal03:'https://cal.com/elle-studio-56pfyg/gluteos-de-porcelana'};
const CUB_COLORS={c01:'#b87c7c',c02:'#4a5530',c03:'#1a5c38'};

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

// ===== SUPABASE CONFIG =====
const SUPA_URL = 'https://bwgiktpsmrvfaoyoftwy.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Z2lrdHBzbXJ2ZmFveW9mdHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzY2NjUsImV4cCI6MjA4NzU1MjY2NX0.-3YsxigCNWDeZnW8uLSro6UXsHhRNLmcJHEap0fnHz0';
const supa = supabase.createClient(SUPA_URL, SUPA_KEY);

// ===== GLOBAL STATE =====
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

let preCitas=JSON.parse(localStorage.getItem('ce_v3_precitas')||'[]');
let registros = JSON.parse(localStorage.getItem('ce_v3_registros') || '[]');
let currentRole = null;
let _selectedRole = null;

// ===== FILTER/SORT STATE =====
let _sf='';
let _tf='';
let _trkSort={col:'fecha',dir:-1};
let _trkFilters={search:'',svc:'',month:'',cub:''};
let _trkStatsData={hoy:[],semana:[],'30':[],vencidas:[]};
let _trkGrouped=false;
let _trkStoreRows=[];
let _proxSesPid=null,_proxSesSvId=null,_proxSesZona=null,_proxSesIdx=null;

// ===== TEMPLATES =====
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
const WA_TPL=WA_TPL_DEFAULT;

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

const MAX_FOTOS_POR_PACIENTE = 999; // Sin límite de cantidad

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

// ===== SESSION =====
const SESSION_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

// ===== CAL API =====
const CAL_API_KEY = 'cal_live_3e3bdf7be1475e3c0892eef82c80c921';

// ===== AUTH =====
const PASSWORDS = {
  admin: 'bc6e0f75f4e9f5c905cb5ae58eeee078538dbe63150b6b7205f839e3ac5514e5',
  worker: '2c4b90224e2c428116c1289f7b9fe71d360ef1e9452b83a653881ce6acd3a223'
};
// Fri Apr 24 18:27:03 EDT 2026
