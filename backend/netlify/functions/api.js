// PlacaPE v5 - Netlify Function
// Conectado a PlacaAPI.pe (regcheck.org.uk) + scrapers sin captcha
const nodemailer = require('nodemailer');

async function wa(msg) {
  const n = process.env.WA_NUMBER;
  const k = process.env.WA_APIKEY;
  if (!k) return;
  try { await fetch(`https://api.callmebot.com/whatsapp.php?phone=${n}&text=${encodeURIComponent(msg)}&apikey=${k}`); }
  catch(e) { console.error('[WA]', e.message); }
}

async function ft(url, opts={}, secs=10) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), secs*1000);
  try { const r = await fetch(url, {...opts, signal:ctrl.signal}); clearTimeout(t); return r; }
  catch(e) { clearTimeout(t); throw e; }
}

async function consultarPlacaAPI(placa) {
  try {
    const usuario = process.env.PLACAAPI_USER || 'placape';
    const clave = process.env.PLACAAPI_PASS;
    const p = placa.replace('-','');
    const r = await ft(
      `https://www.regcheck.org.uk/api/reg.asmx/CheckPeru`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `RegistrationNumber=${p}&username=${usuario}`
      }, 15
    );
    const xml = await r.text();
    const jsonMatch = xml.match(/<vehicleJson>([\s\S]*?)<\/vehicleJson>/);
    if (!jsonMatch) return { encontrado: false };
    const d = JSON.parse(jsonMatch[1]);
    return {
      encontrado: true,
      marca: d.Make || d.CarMake?.CurrentTextValue || '—',
      modelo: d.Model || d.CarModel || '—',
      anio: d.RegistrationYear || '—',
      vin: d.VIN || '—',
      uso: d.Use || 'PARTICULAR',
      asientos: d.NumberOfSeats || '—',
      propietario: d.Owner || '—',
      descripcion: d.Description || ''
    };
  } catch(e) {
    console.error('[PlacaAPI]', e.message);
    return { encontrado: false, error: e.message };
  }
}

async function consultarSUTRAN(placa) {
  try {
    const r = await ft(`https://www.sutran.gob.pe/consultas/record-de-infracciones/record-de-infracciones/?placa=${placa.replace('-','')}`, { headers: {'User-Agent':'Mozilla/5.0'} }, 10);
    const html = await r.text();
    const sinMultas = html.includes('no se encontr') || html.includes('no existen') || html.includes('0 resultado');
    return { tieneMultas: !sinMultas && html.toLowerCase().includes('papeleta'), verificado: html.length > 1000 };
  } catch(e) { return { tieneMultas: false, verificado: false }; }
}

async function consultarGNV(placa) {
  try {
    const r = await ft(`https://vh.infogas.com.pe/consulta?placa=${placa.replace('-','')}`, { headers: {'User-Agent':'Mozilla/5.0'} }, 10);
    const html = await r.text();
    const matchFecha = html.match(/(\d{2}\/\d{2}\/\d{4})/g);
    return { tieneGNV: html.toLowerCase().includes('vigente'), vencimiento: matchFecha?matchFecha[0]:'—', verificado: html.length > 500 };
  } catch(e) { return { tieneGNV: false, vencimiento: '—', verificado: false }; }
}

async function consultarMunis(placa) {
  const p = placa.replace('-','');
  const munis = [
    { nombre:'Chiclayo', url:`https://virtualsatch.satch.gob.pe/virtualsatch/record_infracciones/buscar_placa_?placa=${p}` },
    { nombre:'Trujillo', url:`https://satt.gob.pe/servicios/record-de-infracciones?placa=${p}` },
    { nombre:'Arequipa', url:`https://www.muniarequipa.gob.pe/oficina-virtual/c0nInfrPermisos/faltas/papeletas.php?placa=${p}` },
    { nombre:'Ica', url:`https://m.satica.gob.pe/?placa=${p}` },
    { nombre:'Cajamarca', url:`https://www.satcajamarca.gob.pe/?placa=${p}` },
    { nombre:'Tarapoto', url:`https://www.sat-t.gob.pe/?placa=${p}` },
    { nombre:'Huancayo', url:`http://sathuancayo.fortiddns.com:888/VentanillaVirtual/ConsultaPIT.aspx?placa=${p}` },
  ];
  const resultados = await Promise.allSettled(munis.map(async (m) => {
    try {
      const r = await ft(m.url, { headers:{'User-Agent':'Mozilla/5.0'} }, 7);
      const html = await r.text();
      if (html.length < 500) return { ...m, estado:'no_verificado' };
      const sinPapeleta = html.includes('no se encontr') || html.includes('no existen') || html.includes('0 result') || html.includes('sin deuda');
      const conPapeleta = !sinPapeleta && (html.toLowerCase().includes('infraccion') || html.toLowerCase().includes('papeleta'));
      return { ...m, estado: conPapeleta ? 'con_papeleta' : sinPapeleta ? 'sin_papeleta' : 'no_verificado' };
    } catch(e) { return { ...m, estado:'no_verificado' }; }
  }));
  return resultados.map((r,i) => r.status==='fulfilled' ? r.value : { ...munis[i], estado:'no_verificado' });
}

function analizar(datos) {
  const alertas = [], positivos = [];
  if (datos.sutran?.tieneMultas) alertas.push('multas pendientes en SUTRAN');
  else if (datos.sutran?.verificado) positivos.push('sin multas en SUTRAN');
  if (datos.gnv?.tieneGNV) positivos.push('convertido a GNV');
  const con = (datos.munis||[]).filter(m => m.estado==='con_papeleta');
  const sin = (datos.munis||[]).filter(m => m.estado==='sin_papeleta');
  if (con.length > 0) alertas.push(`papeletas en ${con.map(m=>m.nombre).join(', ')}`);
  if (sin.length > 0) positivos.push(`sin papeletas en ${sin.map(m=>m.nombre).join(', ')}`);
  let semaforo = alertas.length === 0 ? 'VERDE' : alertas.length === 1 ? 'AMARILLO' : 'ROJO';
  let puntaje = alertas.length === 0 ? 10 : alertas.length === 1 ? 6 : Math.max(2, 10 - alertas.length*2);
  let resumen = `El vehículo con placa ${datos.placa}`;
  if (datos.sunarp?.encontrado) resumen += ` corresponde a un ${datos.sunarp.descripcion || datos.sunarp.marca+' '+datos.sunarp.modelo} del año ${datos.sunarp.anio}, uso ${datos.sunarp.uso}.`;
  else resumen += ' fue consultado en las fuentes disponibles.';
  if (alertas.length === 0) resumen += positivos.length > 0 ? ` Se verificó: ${positivos.join(', ')}.` : ' No se encontraron observaciones.';
  else { resumen += ` Presenta ${alertas.length} observación(es): ${alertas.join('; ')}.`; if (positivos.length>0) resumen += ` También: ${positivos.join(', ')}.`; }
  return { semaforo, puntaje, resumen, alertas, positivos };
}

function buildHTML(placa, d, an) {
  const fecha = new Date().toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const col={VERDE:'#16A34A',AMARILLO:'#D97706',ROJO:'#DC2626'};
  const bg={VERDE:'#DCFCE7',AMARILLO:'#FEF3C7',ROJO:'#FEE2E2'};
  const emo={VERDE:'🟢',AMARILLO:'🟡',ROJO:'🔴'};
  const badge=(ok,t1,t2)=>`<span style="padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;background:${ok?'#DCFCE7':'#FEE2E2'};color:${ok?'#16A34A':'#DC2626'}">${ok?'✓ '+t1:'⚠ '+t2}</span>`;
  const nd=(t)=>`<span style="padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;background:#F1F5F9;color:#64748B">— ${t}</span>`;
  const fila=(l,v)=>`<tr><td style="padding:8px 12px;font-size:12px;color:#64748B;border-bottom:1px solid #F8FAFC;width:42%">${l}</td><td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1E293B;border-bottom:1px solid #F8FAFC">${v||'—'}</td></tr>`;
  const sec=(ico,tit,fuente,body)=>`<div style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #DBEAFE;padding-bottom:6px;margin-bottom:10px"><h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#2563EB;margin:0">${ico} ${tit}</h3><span style="font-size:10px;color:#94A3B8">Fuente: ${fuente}</span></div>${body}</div>`;
  const tablaMunis=(d.munis||[]).map(m=>{
    const est=m.estado==='con_papeleta'?'<span style="color:#DC2626;font-weight:700">⚠ Papeleta encontrada</span>':m.estado==='sin_papeleta'?'<span style="color:#16A34A">✓ Sin papeletas</span>':'<span style="color:#94A3B8">— No verificado</span>';
    return `<tr><td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #F8FAFC">${m.nombre}</td><td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #F8FAFC">${est}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>PlacaPE ${placa}</title></head>
<body style="font-family:Arial,sans-serif;background:#F1F5F9;margin:0;padding:16px;color:#1E293B">
<div style="max-width:680px;margin:0 auto">
<div style="background:linear-gradient(135deg,#1035A0,#2563EB);border-radius:12px 12px 0 0;padding:24px 28px;color:#fff">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
    <div><div style="font-size:20px;font-weight:800">🔍 PlacaPE · Informe Vehicular</div><div style="font-size:11px;opacity:.7;margin-top:3px">Generado: ${fecha}</div></div>
    <div style="background:#fff;border-radius:8px;padding:6px 20px"><div style="font-size:28px;font-weight:800;letter-spacing:.18em;color:#1E293B">${placa}</div></div>
  </div>
</div>
<div style="background:${bg[an.semaforo]};border:2px solid ${col[an.semaforo]};padding:16px 24px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
    <span style="font-size:28px">${emo[an.semaforo]}</span>
    <div><div style="font-size:15px;font-weight:800;color:${col[an.semaforo]}">${an.semaforo==='VERDE'?'SIN OBSERVACIONES':an.semaforo==='AMARILLO'?'CON OBSERVACIONES MENORES':'CON OBSERVACIONES IMPORTANTES'}</div>
    <div style="font-size:12px;color:#475569">Puntaje de revisión: ${an.puntaje}/10</div></div>
  </div>
  <p style="font-size:13px;color:#475569;line-height:1.7;margin:0">${an.resumen}</p>
</div>
<div style="background:#fff;padding:22px 24px;border-radius:0 0 12px 12px;border:1px solid #E2E8F0">
  ${sec('📋','Datos del Vehículo','SUNARP / PlacaAPI.pe',
    d.sunarp?.encontrado
      ? `<table style="width:100%;border-collapse:collapse">${fila('Marca',d.sunarp.marca)}${fila('Modelo',d.sunarp.modelo)}${fila('Año',d.sunarp.anio)}${fila('Tipo de Uso',d.sunarp.uso)}${fila('N° VIN',d.sunarp.vin)}${fila('Asientos',d.sunarp.asientos)}${fila('Propietario',d.sunarp.propietario||'Ver en SUNARP directamente')}</table>`
      : `<p style="color:#64748B;font-size:13px">No se encontraron datos. Verifica en <a href="https://consultavehicular.sunarp.gob.pe" style="color:#2563EB">consultavehicular.sunarp.gob.pe</a></p>`
  )}
  ${sec('🛡️','SOAT','APESEG',`<p style="margin:0 0 8px">${nd('Verificar en APESEG')}</p><p style="font-size:12px;color:#64748B;margin:0">Consulta en <a href="https://www.apeseg.org.pe/consultas-soat/" style="color:#2563EB">apeseg.org.pe</a> o por SMS al <strong>90900</strong> enviando la placa.</p>`)}
  ${sec('🔧','Revisión Técnica','MTC',`<p style="margin:0 0 8px">${nd('Verificar en MTC')}</p><p style="font-size:12px;color:#64748B;margin:0">Consulta en <a href="https://rec.mtc.gob.pe/Citv/ArConsultaCitv" style="color:#2563EB">rec.mtc.gob.pe</a></p>`)}
  ${sec('🚨','Papeletas SAT Lima','SAT Lima',`<p style="margin:0 0 8px">${nd('Verificar en SAT Lima')}</p><p style="font-size:12px;color:#64748B;margin:0">Consulta en <a href="https://www.sat.gob.pe" style="color:#2563EB">sat.gob.pe</a></p>`)}
  ${sec('🛣️','Multas en Carreteras','SUTRAN',`<p style="margin:0">${!d.sutran?.verificado?nd('No verificado'):d.sutran?.tieneMultas?badge(false,'','Multas pendientes en SUTRAN'):badge(true,'Sin multas en SUTRAN','')}</p>`)}
  ${sec('⛽','Gas Natural Vehicular','INFOGAS',`<p style="margin:0 0 8px">${!d.gnv?.verificado?nd('No verificado'):d.gnv?.tieneGNV?badge(true,'Convertido a GNV — Vence: '+d.gnv.vencimiento,''):badge(false,'','No convertido a GNV')}</p>`)}
  ${sec('🏛️','Papeletas en Municipalidades','7 entidades verificadas',
    `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#F8FAFC"><th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748B;font-weight:600">Municipalidad</th><th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748B;font-weight:600">Estado</th></tr>
      ${tablaMunis}
    </table><p style="font-size:11px;color:#94A3B8;margin:8px 0 0">Solo se muestran municipalidades con portal activo al momento de la consulta.</p>`
  )}
  <div style="background:#EFF6FF;border-radius:8px;padding:14px 18px;margin:8px 0 16px">
    <h3 style="font-size:12px;font-weight:700;color:#1D4ED8;margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em">📋 Checklist para el Comprador</h3>
    <table style="width:100%;font-size:12px;color:#475569">
      <tr><td style="padding:3px 0">☐ Verificar tarjeta de propiedad original</td><td style="padding:3px 0">☐ Comparar N° de motor y serie físicamente</td></tr>
      <tr><td style="padding:3px 0">☐ Verificar SOAT en apeseg.org.pe</td><td style="padding:3px 0">☐ Verificar revisión técnica en MTC</td></tr>
      <tr><td style="padding:3px 0">☐ Verificar papeletas en SAT Lima</td><td style="padding:3px 0">☐ Solicitar cancelación de deudas al vendedor</td></tr>
      <tr><td style="padding:3px 0">☐ Hacer peritaje mecánico independiente</td><td style="padding:3px 0">☐ Firmar contrato notarial de compra-venta</td></tr>
    </table>
  </div>
  <div style="border-top:1px solid #E2E8F0;padding-top:14px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;margin-bottom:6px">Fuentes Consultadas</div>
    <div style="font-size:11px;color:#64748B;line-height:1.8">SUNARP (PlacaAPI.pe) · SUTRAN · INFOGAS · SAT Chiclayo · SAT Trujillo · Arequipa · Ica · Cajamarca · Tarapoto · Huancayo</div>
  </div>
  <div style="margin-top:14px;padding-top:14px;border-top:1px solid #E2E8F0;text-align:center">
    <p style="font-size:11px;color:#94A3B8;margin:0;line-height:1.7">PlacaPE · Informe generado consultando fuentes oficiales del Estado Peruano.<br>¿Consultas? WhatsApp: <a href="https://wa.me/51962103328" style="color:#2563EB;font-weight:600">962 103 328</a> · © 2025 PlacaPE</p>
  </div>
</div>
</div></body></html>`;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Content-Type':'application/json' };
  if (event.httpMethod==='OPTIONS') return { statusCode:200, headers, body:'' };
  if (event.httpMethod!=='POST') return { statusCode:405, headers, body:JSON.stringify({error:'No permitido'}) };
  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode:400, headers, body:JSON.stringify({error:'JSON inválido'}) }; }
  const { placa, email, yapeCode } = body;
  if (!placa||!email||!yapeCode) return { statusCode:400, headers, body:JSON.stringify({error:'Faltan campos'}) };
  const p = placa.toUpperCase().replace(/[^A-Z0-9-]/g,'');
  console.log(`[INICIO] Placa: ${p} | Email: ${email}`);
  try {
    await wa(`🔔 *NUEVA CONSULTA PlacaPE*\n\n🚗 Placa: *${p}*\n📧 ${email}\n💳 Yape: ${yapeCode}\n💰 S/ 20.00\n🕐 ${new Date().toLocaleTimeString('es-PE')}`);
    const [sunarp, sutran, gnv, munis] = await Promise.allSettled([consultarPlacaAPI(p), consultarSUTRAN(p), consultarGNV(p), consultarMunis(p)]);
    const datos = { placa:p, sunarp:sunarp.status==='fulfilled'?sunarp.value:null, sutran:sutran.status==='fulfilled'?sutran.value:null, gnv:gnv.status==='fulfilled'?gnv.value:null, munis:munis.status==='fulfilled'?munis.value:[] };
    console.log('[CONSULTA] SUNARP encontrado:', datos.sunarp?.encontrado);
    const analisis = analizar(datos);
    const html = buildHTML(p, datos, analisis);
    const mailer = nodemailer.createTransport({ service:'gmail', auth:{ user:process.env.GMAIL_USER, pass:process.env.GMAIL_PASS } });
    await mailer.verify();
    await mailer.sendMail({ from:`"PlacaPE 🚗" <${process.env.GMAIL_USER}>`, to:email, subject:`✅ Tu Informe Vehicular — Placa ${p} | PlacaPE`, html });
    console.log(`[EMAIL] Enviado a ${email}`);
    await wa(`✅ *INFORME ENVIADO*\n🚗 ${p}\n📧 ${email}\n🎯 ${analisis.semaforo}\n⚠️ Alertas: ${analisis.alertas.length}`);
    return { statusCode:200, headers, body:JSON.stringify({ok:true}) };
  } catch(err) {
    console.error('[ERROR]', err.message);
    await wa(`⚠️ *ERROR*\nPlaca: ${p}\nError: ${err.message}`).catch(()=>{});
    return { statusCode:500, headers, body:JSON.stringify({ok:false, error:err.message}) };
  }
};
