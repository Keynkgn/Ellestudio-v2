# Elle Studio v2 — Instrucciones para Claude

## Estructura del proyecto
App CRM para Elle Studio (spa de belleza). HTML + CSS + JS modular. Sin frameworks.
Desplegada en: https://ellestudio-v2.vercel.app
Repositorio: https://github.com/Keynkgn/Ellestudio-v2

## Base de datos
- **Supabase** (misma DB que ellestudio.vercel.app — datos compartidos)
- URL y KEY están en `js/config.js`
- Tablas principales: `elle_patients`, `elle_services`, `elle_zones`, `elle_sessions`, `elle_payments`, `elle_appointments`, `elle_precitas`

## Arquitectura de archivos

```
index.html          ← Solo HTML estructural. NO contiene JS ni CSS inline.
css/styles.css      ← Todo el CSS
js/config.js        ← Variables globales, constantes, cliente Supabase
js/utils.js         ← Funciones helper (fmtDate, showToast, etc.)
js/auth.js          ← Login, roles, permisos
js/db.js            ← Todas las queries a Supabase
js/inicio.js        ← Dashboard: stats, agenda, alertas
js/pacientes.js     ← CRUD pacientes, zonas, sesiones, fotos
js/pagos.js         ← Pagos y finanzas
js/precitas.js      ← Pre-citas / separaciones
js/seguimiento.js   ← Hoja de seguimiento
js/whatsapp.js      ← Templates de WhatsApp
js/precios.js       ← Lista de precios
js/app.js           ← Init, intervalos, showSection, save()
```

## Reglas CRÍTICAS — NUNCA romper

### 1. Variables globales van SOLO en config.js
Estas variables están declaradas en `config.js` con `let`. NUNCA re-declararlas en otros archivos:
```
patients, preCitas, registros, currentRole, _selectedRole,
_sf, _tf, _trkSort, _trkFilters, _trkStatsData,
_trkGrouped, _trkStoreRows, _proxSesPid, _proxSesSvId, _proxSesZona, _proxSesIdx,
appConfig, waTpls, waCustomCards, waServiceTpls, preCitaTemplates
```
Si necesitas usar una de estas en otro archivo, úsalas directamente (son globales). Si declaras `let _sf = ''` en pacientes.js cuando ya está en config.js → **SyntaxError: Identifier has already been declared**.

### 2. Orden de carga de scripts (index.html)
El orden en `index.html` importa. No cambiar:
```
config.js → utils.js → auth.js → db.js → inicio.js →
pacientes.js → pagos.js → precitas.js → seguimiento.js →
whatsapp.js → precios.js → app.js
```

### 3. No modificar db.js sin entender el patrón UPSERT
La función `_syncPatientToElle` usa UPSERT para no borrar datos. Si cambias cómo se sincronizan pacientes, mantén el patrón o perderás datos.

### 4. renderAll() está en inicio.js
`renderAll()` llama a todas las funciones de render. Si inicio.js tiene un error de sintaxis, NADA se renderiza. Verificar siempre inicio.js primero si la app aparece vacía.

### 5. No usar pkill -f electron ni comandos destructivos

## Cómo modificar correctamente

### Agregar una función nueva
1. Identifica en qué módulo pertenece (ver tabla de archivos)
2. Agrégala al final del archivo correspondiente
3. Si necesita una variable global nueva, declárarla en `config.js`

### Modificar CSS
Solo editar `css/styles.css`. No agregar `<style>` en index.html.

### Modificar HTML (estructura de secciones)
Solo editar `index.html`. Los IDs de los elementos son usados por los JS — no cambiarlos sin buscar dónde se usan.

### Desplegar cambios
```bash
git add -A && git commit -m "descripcion" && git push
npx vercel --prod --yes --token TOKEN --scope ellestudiolr-5835s-projects
```
Token Vercel disponible en las instrucciones del usuario.

## Cómo verificar que no rompiste nada
```bash
node -e "const fs=require('fs'); ['config','utils','auth','db','inicio','pacientes','pagos','precitas','seguimiento','whatsapp','precios','app'].forEach(f=>{try{new Function(fs.readFileSync('js/'+f+'.js','utf8'));console.log('OK:',f);}catch(e){console.log('ERROR:',f,e.message);}})"
```

## Contraseñas (hashes SHA-256)
- Admin: `bc6e0f75...` → contraseña real guardada por la usuaria
- Worker: `2c4b9022...` → contraseña real guardada por la usuaria
NO cambiar estos hashes sin coordinarlo con la usuaria.
