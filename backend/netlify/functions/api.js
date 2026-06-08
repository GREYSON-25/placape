// ══════════════════════════════════════════════════════
//  PlacaPE v4 — api.js (Netlify Function)
//  Informe completo con 20+ fuentes oficiales del Perú
// ══════════════════════════════════════════════════════
const nodemailer = require('nodemailer');

// ─── WHATSAPP ─────────────────────────────────────────
async function wa(msg) {
  const n = process.env.WA_NUMBER;
  const k = process.env.WA_APIKEY;
  if (!k) return;
  try {
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${n}&text=${encodeURIComponent(msg)}&apikey=${k}`);
  } catch(e) { console.error('[WA]', e.message); }
}

// ─── FETCH CON TIMEOUT ────────────────────────────────
async function fetchConTimeout(url, opciones = {}, segundos = 10) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), segundos * 1000);
  try {
    const r = await fetch(url, { ...opciones, signal: ctrl.signal });
    clearTimeout(timer);
    return r;
  } catch(e) {
    clearTimeout(timer);
    throw e;
  }
}

// ─── SUNARP — Datos del vehículo ──────────────────────
async function consultarSUNARP(placa) {
  try {
    const r = await fetchConTimeout(
      `https://consultavehicular.sunarp.gob.pe/cv/rest/obtenerConsultaVehicular/${placa.replace('-','')}`,
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }, 12
    );
    if (!r.ok) return null;
    const d = await r.json();
    return {
      marca:       d.marca       || d.marcaDescripcion || '—',
      modelo:      d.modelo      || d.modeloDescripcion || '—',
      anio:        d.anioFabricacion || d.ano || '—',
      color:       d.color       || d.colorDescripcion || '—',
      motor:       d.nroMotor    || d.numeroMotor || '—',
      serie:       d.nroSerie    || d.vin || '—',
      carroceria:  d.carroceria  || '—',
      uso:         d.uso         || '—',
      categoria:   d.categoria   || '—',
      combustible: d.combustible || '—',
      propietario: d.nombrePropietario || d.propietario || '—',
      alerta:      d.alertaRobo  || 'SIN ALERTA',
      encontrado:  true
    };
  } catch(e) {
    console.error('[SUNARP]', e.message);
    return null;
  }
}

// ─── MTC — Revisión Técnica ───────────────────────────
async function consultarRevTecnica(placa) {
  try {
    const r = await fetchConTimeout(
      `https://rec.mtc.gob.pe/Citv/ArConsultaCitv?placa=${placa.replace('-','')}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }, 12
    );
    const html = await r.text();
    const vigente   = html.includes('VIGENTE') || html.includes('APROBADO');
    const vencida   = html.includes('VENCIDO') || html.includes('DESAPROBADO');
    const matchFecha = html.match(/(\d{2}\/\d{2}\/\d{4})/g);
    const matchEmpresa = html.match(/CENTRO[^<"]{5,60}/i);
    return {
      vigente,
      estado: vigente ? 'VIGENTE' : vencida ? 'VENCIDO' : 'NO ENCONTRADO',
      vence:  matchFecha ? matchFecha[matchFecha.length-1] : '—',
      empresa: matchEmpresa ? matchEmpresa[0].trim() : '—',
      encontrado: vigente || vencida
    };
  } catch(e) {
    console.error('[RevTec]', e.message);
    return { vigente: false, estado: 'NO VERIFICADO', vence: '—', empresa: '—', encontrado: false };
  }
}

// ─── APESEG — SOAT ────────────────────────────────────
async function consultarSOAT(placa) {
  try {
    const r = await fetchConTimeout(
      `https://www.apeseg.org.pe/api/soat?placa=${placa.replace('-','')}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }, 12
    );
    const html = await r.text();
    const vigente = html.includes('VIGENTE') || html.includes('vigente');
    const vencido = html.includes('VENCIDO') || html.includes('vencido');
    const matchFecha = html.match(/(\d{2}\/\d{2}\/\d{4})/g);
    const aseguradoras = ['RIMAC','PACIFICO','MAPFRE','POSITIVA','INTERSEGURO','PROTECTA','CARDIF'];
    let empresa = '—';
    aseguradoras.forEach(a => { if (html.toUpperCase().includes(a)) empresa = a; });
    return {
      vigente,
      estado: vigente ? 'VIGENTE' : vencido ? 'VENCIDO' : 'NO ENCONTRADO',
      vence: matchFecha ? matchFecha[matchFecha.length-1] : '—',
      empresa,
      encontrado: vigente || vencido
    };
  } catch(e) {
    console.error('[SOAT]', e.message);
    return { vigente: false, estado: 'NO VERIFICADO', vence: '—', empresa: '—', encontrado: false };
  }
}

// ─── SBS — Siniestros/Accidentes ─────────────────────
async function consultarSiniestros(placa) {
  try {
    const r = await fetchConTimeout(
      `https://servicios.sbs.gob.pe/reportesoat/app/frmBusquedaPlaca.aspx`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
        body: `placa=${placa.replace('-','')}`
      }, 12
    );
    const html = await r.text();
    const accidentes = (html.match(/accidente/gi) || []).length;
    return {
      total: accidentes,
      tiene: accidentes > 0,
      encontrado: html.length > 500
    };
  } catch(e) {
    return { total: 0, tiene: false, encontrado: false };
  }
}

// ─── SAT Lima — Multas y papeletas ───────────────────
async function consultarSAT(placa) {
  try {
    const r = await fetchConTimeout(
      `https://www.sat.gob.pe/VirtualSAT/modulos/papeletas/papeletas.aspx?placa=${placa.replace('-','')}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }, 12
    );
    const html = await r.text();
    const tienePapeletas = html.includes('papeleta') && !html.includes('no se encontr');
    const matchMonto = html.match(/S\/\s*[\d,]+\.?\d*/g);
    return {
      tienePapeletas,
      monto: matchMonto ? matchMonto[0] : 'S/ 0.00',
      encontrado: html.length > 500
    };
  } catch(e) {
    return { tienePapeletas: false, monto: 'S/ 0.00', encontrado: false };
  }
}

// ─── SUTRAN — Multas carreteras ───────────────────────
async function consultarSUTRAN(placa) {
  try {
    const r = await fetchConTimeout(
      `https://www.sutran.gob.pe/consultas/record-de-infracciones/record-de-infracciones/?placa=${placa.replace('-','')}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }, 12
    );
    const html = await r.text();
    const tieneMultas = html.includes('papeleta') && !html.includes('no se encontr');
    return { tieneMultas, encontrado: html.length > 500 };
  } catch(e) {
    return { tieneMultas: false, encontrado: false };
  }
}

// ─── PNP — Robo/Requisitoria ─────────────────────────
async function consultarPNP(placa) {
  try {
    const r = await fetchConTimeout(
      `https://sistemas1.policia.gob.pe/ConsultaPVR/frmConsultaPlaca.aspx?placa=${placa.replace('-','')}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }, 12
    );
    const html = await r.text();
    const tieneAlerta = html.toLowerCase().includes('robado') || html.toLowerCase().includes('requisitoria');
    return {
      tieneAlerta,
      estado: tieneAlerta ? 'ALERTA ACTIVA' : 'SIN ALERTA',
      encontrado: html.length > 200
    };
  } catch(e) {
    return { tieneAlerta: false, estado: 'NO VERIFICADO', encontrado: false };
  }
}

// ─── INFOGAS — GNV ───────────────────────────────────
async function consultarGNV(placa) {
  try {
    const r = await fetchConTimeout(
      `https://vh.infogas.com.pe/consulta?placa=${placa.replace('-','')}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }, 12
    );
    const html = await r.text();
    const tieneGNV = html.toLowerCase().includes('gas') && !html.includes('no se encontr');
    const matchFecha = html.match(/(\d{2}\/\d{2}\/\d{4})/g);
    return {
      tieneGNV,
      vencimiento: matchFecha ? matchFecha[0] : '—',
      encontrado: html.length > 200
    };
  } catch(e) {
    return { tieneGNV: false, vencimiento: '—', encontrado: false };
  }
}

// ─── Consultar múltiples municipalidades ──────────────
async function consultarMunicipalidades(placa) {
  const p = placa.replace('-','');
  const municipalidades = [
    { nombre: 'Callao',       url: `https://pagopapeletascallao.pe/consulta?placa=${p}` },
    { nombre: 'Trujillo',     url: `https://satt.gob.pe/servicios/record-de-infracciones?placa=${p}` },
    { nombre: 'Chiclayo',     url: `https://virtualsatch.satch.gob.pe/virtualsatch/record_infracciones/buscar_placa_?placa=${p}` },
    { nombre: 'Arequipa',     url: `https://www.muniarequipa.gob.pe/oficina-virtual/c0nInfrPermisos/faltas/papeletas.php?placa=${p}` },
    { nombre: 'Ica',          url: `https://m.satica.gob.pe/consulta?placa=${p}` },
    { nombre: 'Cusco',        url: `https://cusco.gob.pe/informatica/index.php/?placa=${p}` },
    { nombre: 'Tacna',        url: `https://www.munitacna.gob.pe/pagina/sf/servicios/papeletas?placa=${p}` },
    { nombre: 'Cajamarca',    url: `https://www.satcajamarca.gob.pe/consulta?placa=${p}` },
    { nombre: 'Huancayo',     url: `http://sathuancayo.fortiddns.com:888/VentanillaVirtual/ConsultaPIT.aspx?placa=${p}` },
    { nombre: 'Piura',        url: `http://www.munipiura.gob.pe/consulta-de-multas-de-transito?placa=${p}` },
    { nombre: 'Tarapoto',     url: `https://www.sat-t.gob.pe/consulta?placa=${p}` },
    { nombre: 'Chachapoyas',  url: `https://app.munichachapoyas.gob.pe/servicios/consulta_papeletas/app/papeletas.php?placa=${p}` },
    { nombre: 'Andahuaylas',  url: `https://muniandahuaylas.gob.pe/consultar-papeleta/?placa=${p}` },
    { nombre: 'Huánuco',      url: `https://www.munihuanuco.gob.pe/wp-content/servicios/transportes/gt_papeletas.php?placa=${p}` },
  ];

  const resultados = await Promise.allSettled(
    municipalidades.map(async (m) => {
      try {
        const r = await fetchConTimeout(m.url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 8);
        const html = await r.text();
        const tienePapeleta = html.toLowerCase().includes('papeleta') && !html.includes('no se encontr') && !html.includes('no existen');
        return { nombre: m.nombre, tienePapeleta, verificado: html.length > 300 };
      } catch(e) {
        return { nombre: m.nombre, tienePapeleta: false, verificado: false };
      }
    })
  );

  return resultados.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { nombre: municipalidades[i].nombre, tienePapeleta: false, verificado: false }
  );
}

// ─── ANÁLISIS INTELIGENTE (sin mencionar IA) ──────────
function generarResumen(datos) {
  const alertas = [];
  const positivos = [];

  if (datos.soat?.vigente) positivos.push('SOAT vigente');
  else if (datos.soat?.estado === 'VENCIDO') alertas.push('SOAT vencido');

  if (datos.revtec?.vigente) positivos.push('revisión técnica al día');
  else if (datos.revtec?.estado === 'VENCIDO') alertas.push('revisión técnica vencida');

  if (!datos.sat?.tienePapeletas) positivos.push('sin papeletas en SAT Lima');
  else alertas.push(`papeletas pendientes en SAT Lima por ${datos.sat.monto}`);

  if (!datos.pnp?.tieneAlerta) positivos.push('sin alertas policiales');
  else alertas.push('ALERTA POLICIAL ACTIVA');

  if (!datos.sunarp?.alerta || datos.sunarp.alerta === 'SIN ALERTA') positivos.push('sin anotación de robo en SUNARP');
  else alertas.push('anotación de robo en SUNARP');

  if (!datos.sutran?.tieneMultas) positivos.push('sin multas SUTRAN');
  else alertas.push('multas pendientes en SUTRAN');

  const multsProvinciales = (datos.municipalidades || []).filter(m => m.tienePapeleta);
  if (multsProvinciales.length > 0) alertas.push(`papeletas en ${multsProvinciales.map(m=>m.nombre).join(', ')}`);

  // Semáforo
  let semaforo = 'VERDE';
  let puntaje = 10;
  if (alertas.length === 1) { semaforo = 'AMARILLO'; puntaje = 6; }
  if (alertas.length >= 2) { semaforo = 'ROJO'; puntaje = Math.max(1, 10 - alertas.length * 2); }

  // Texto del resumen
  let resumen = '';
  if (alertas.length === 0) {
    resumen = `El vehículo con placa ${datos.placa} no presenta observaciones en las fuentes consultadas. `;
    resumen += positivos.length > 0 ? `Se verificó que cuenta con ${positivos.join(', ')}.` : '';
  } else {
    resumen = `El vehículo con placa ${datos.placa} presenta ${alertas.length} observación(es): ${alertas.join('; ')}. `;
    if (positivos.length > 0) resumen += `Por otro lado, se verificó que cuenta con ${positivos.join(', ')}.`;
  }

  return { resumen, semaforo, puntaje, alertas, positivos };
}

// ─── CONSTRUIR HTML DEL INFORME ───────────────────────
function buildInformeHTML(placa, datos, analisis) {
  const fecha = new Date().toLocaleDateString('es-PE', {
    day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'
  });

  const colorSemaforo = { VERDE: '#16A34A', AMARILLO: '#D97706', ROJO: '#DC2626' };
  const bgSemaforo    = { VERDE: '#DCFCE7', AMARILLO: '#FEF3C7', ROJO: '#FEE2E2' };
  const emojiSemaforo = { VERDE: '🟢', AMARILLO: '🟡', ROJO: '🔴' };

  const badge = (ok, txtOk, txtMal) =>
    `<span style="display:inline-block;padding:3px 12px;border-radius:99px;font-size:12px;font-weight:700;
      background:${ok?'#DCFCE7':'#FEE2E2'};color:${ok?'#16A34A':'#DC2626'}">
      ${ok ? '✓ '+txtOk : '⚠ '+txtMal}</span>`;

  const nd = (txt) =>
    `<span style="display:inline-block;padding:3px 12px;border-radius:99px;font-size:12px;font-weight:700;
      background:#F1F5F9;color:#64748B">— ${txt}</span>`;

  const fila = (label, valor) =>
    `<tr><td style="padding:8px 12px;font-size:12px;color:#64748B;border-bottom:1px solid #F1F5F9;width:42%">${label}</td>
         <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1E293B;border-bottom:1px solid #F1F5F9">${valor}</td></tr>`;

  const seccion = (emoji, titulo, fuente, contenido) => `
    <div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#2563EB;margin:0">
          ${emoji} ${titulo}
        </h3>
        <span style="font-size:10px;color:#94A3B8;font-weight:500">Fuente: ${fuente}</span>
      </div>
      ${contenido}
    </div>`;

  // Municipalidades con papeletas
  const munisConPapeletas = (datos.municipalidades || []).filter(m => m.tienePapeleta);
  const munisSinPapeletas = (datos.municipalidades || []).filter(m => !m.tienePapeleta && m.verificado);
  const munisNoVerificadas = (datos.municipalidades || []).filter(m => !m.verificado);

  const filaMuni = (m) =>
    `<tr><td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #F8FAFC">${m.nombre}</td>
         <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #F8FAFC">
           ${m.tienePapeleta
             ? '<span style="color:#DC2626;font-weight:700">⚠ Papeleta encontrada</span>'
             : m.verificado
               ? '<span style="color:#16A34A">✓ Sin papeletas</span>'
               : '<span style="color:#94A3B8">— No verificado</span>'}
         </td></tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PlacaPE — Informe ${placa}</title>
</head>
<body style="font-family:Arial,sans-serif;background:#F1F5F9;margin:0;padding:20px;color:#1E293B">
<div style="max-width:700px;margin:0 auto">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1035A0,#2563EB);border-radius:12px 12px 0 0;padding:28px 32px;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:22px;font-weight:800;margin-bottom:4px">🔍 PlacaPE · Informe Vehicular</div>
        <div style="font-size:12px;opacity:.75">Generado: ${fecha}</div>
      </div>
      <div style="background:#fff;border-radius:8px;padding:8px 24px;text-align:center">
        <div style="font-size:32px;font-weight:800;letter-spacing:.18em;color:#1E293B">${placa}</div>
      </div>
    </div>
  </div>

  <!-- SEMÁFORO / RESUMEN INTELIGENTE -->
  <div style="background:${bgSemaforo[analisis.semaforo]};border:2px solid ${colorSemaforo[analisis.semaforo]};
    border-radius:0;padding:20px 28px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
      <span style="font-size:32px">${emojiSemaforo[analisis.semaforo]}</span>
      <div>
        <div style="font-size:16px;font-weight:800;color:${colorSemaforo[analisis.semaforo]}">
          ${analisis.semaforo === 'VERDE' ? 'SIN OBSERVACIONES' : analisis.semaforo === 'AMARILLO' ? 'CON OBSERVACIONES MENORES' : 'CON OBSERVACIONES IMPORTANTES'}
        </div>
        <div style="font-size:12px;color:#475569;margin-top:2px">Puntaje: ${analisis.puntaje}/10</div>
      </div>
    </div>
    <p style="font-size:13px;color:#475569;line-height:1.7;margin:0">${analisis.resumen}</p>
  </div>

  <!-- CUERPO DEL INFORME -->
  <div style="background:#fff;padding:24px 28px;border-radius:0 0 12px 12px;border:1px solid #E2E8F0">

    ${seccion('📋', 'Datos del Vehículo', 'SUNARP',
      `<table style="width:100%;border-collapse:collapse">
        ${fila('Marca / Modelo', `${datos.sunarp?.marca||'—'} ${datos.sunarp?.modelo||''}`)}
        ${fila('Año de Fabricación', datos.sunarp?.anio||'—')}
        ${fila('Color', datos.sunarp?.color||'—')}
        ${fila('Tipo de Combustible', datos.sunarp?.combustible||'—')}
        ${fila('Carrocería / Uso', `${datos.sunarp?.carroceria||'—'} / ${datos.sunarp?.uso||'—'}`)}
        ${fila('N° Motor', datos.sunarp?.motor||'—')}
        ${fila('N° Serie / VIN', datos.sunarp?.serie||'—')}
        ${fila('Propietario Registral', datos.sunarp?.propietario||'—')}
      </table>`
    )}

    ${seccion('🛡️', 'SOAT', 'APESEG',
      `<p style="margin:0 0 8px">${
        datos.soat?.vigente ? badge(true,'VIGENTE','') :
        datos.soat?.estado==='VENCIDO' ? badge(false,'','VENCIDO') : nd('NO VERIFICADO')
      }</p>
      <table style="width:100%;border-collapse:collapse">
        ${fila('Empresa Aseguradora', datos.soat?.empresa||'—')}
        ${fila('Vence', datos.soat?.vence||'—')}
      </table>`
    )}

    ${seccion('🔧', 'Revisión Técnica Vehicular', 'MTC',
      `<p style="margin:0 0 8px">${
        datos.revtec?.vigente ? badge(true,'VIGENTE - APROBADO','') :
        datos.revtec?.estado==='VENCIDO' ? badge(false,'','VENCIDA O DESAPROBADA') : nd('NO VERIFICADO')
      }</p>
      <table style="width:100%;border-collapse:collapse">
        ${fila('Estado', datos.revtec?.estado||'—')}
        ${fila('Vence', datos.revtec?.vence||'—')}
        ${fila('Centro de Inspección', datos.revtec?.empresa||'—')}
      </table>`
    )}

    ${seccion('💥', 'Registro de Siniestros y Accidentes', 'SBS / APESEG',
      `<p style="margin:0 0 8px">${
        !datos.siniestros?.tiene ? badge(true,'SIN ACCIDENTES REGISTRADOS','') : badge(false,'',`${datos.siniestros.total} ACCIDENTE(S) REGISTRADO(S)`)
      }</p>
      <p style="font-size:12px;color:#64748B;margin:0">Registro de siniestros reportados ante aseguradoras.</p>`
    )}

    ${seccion('🚨', 'Papeletas y Multas — SAT Lima', 'SAT Lima',
      `<p style="margin:0 0 8px">${
        !datos.sat?.tienePapeletas ? badge(true,'SIN PAPELETAS EN SAT LIMA','') : badge(false,'',`PAPELETAS PENDIENTES — ${datos.sat.monto}`)
      }</p>`
    )}

    ${seccion('🛣️', 'Multas en Carreteras — SUTRAN', 'SUTRAN',
      `<p style="margin:0">${
        !datos.sutran?.tieneMultas ? badge(true,'SIN MULTAS SUTRAN','') : badge(false,'','MULTAS PENDIENTES EN SUTRAN')
      }</p>`
    )}

    ${seccion('🚔', 'Requisitoria y Robo', 'PNP / SUNARP',
      `<p style="margin:0 0 8px">${
        !datos.pnp?.tieneAlerta ? badge(true,'SIN ALERTA POLICIAL','') : badge(false,'','ALERTA POLICIAL ACTIVA')
      }</p>
      <table style="width:100%;border-collapse:collapse">
        ${fila('Estado PNP', datos.pnp?.estado||'—')}
        ${fila('Alerta Robo SUNARP', datos.sunarp?.alerta||'—')}
      </table>`
    )}

    ${seccion('⛽', 'Gas Natural Vehicular — GNV', 'INFOGAS',
      `<p style="margin:0 0 8px">${
        datos.gnv?.tieneGNV ? badge(true,'CONVERTIDO A GNV','') : badge(false,'','NO CONVERTIDO A GNV')
      }</p>
      ${datos.gnv?.tieneGNV ? `<table style="width:100%;border-collapse:collapse">${fila('Vencimiento', datos.gnv.vencimiento)}</table>` : ''}`
    )}

    ${seccion('🏛️', 'Papeletas en Municipalidades del Perú', '14 entidades provinciales',
      `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:#F8FAFC">
          <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748B">Municipalidad</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748B">Estado</th>
        </tr>
        ${(datos.municipalidades||[]).map(m => filaMuni(m)).join('')}
      </table>`
    )}

    <!-- CHECKLIST DEL COMPRADOR -->
    <div style="background:#EFF6FF;border-radius:8px;padding:16px 20px;margin-top:8px;margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;color:#1D4ED8;margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em">
        📋 Checklist para el Comprador
      </h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#475569">
        <div>☐ Verificar tarjeta de propiedad original</div>
        <div>☐ Comparar N° de motor y serie con el físico</div>
        <div>☐ Revisar coincidencia de color con SUNARP</div>
        <div>☐ Solicitar pago de papeletas al vendedor</div>
        <div>☐ Verificar cancelación de gravámenes activos</div>
        <div>☐ Confirmar SOAT antes de circular</div>
        <div>☐ Hacer peritaje mecánico independiente</div>
        <div>☐ Firmar contrato de compra-venta notarial</div>
      </div>
    </div>

    <!-- FUENTES CONSULTADAS -->
    <div style="border-top:1px solid #E2E8F0;padding-top:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;margin-bottom:8px">
        Fuentes Oficiales Consultadas
      </div>
      <div style="font-size:11px;color:#64748B;line-height:1.8">
        SUNARP · MTC · SAT Lima · SUTRAN · APESEG · SBS · PNP · INFOGAS · ATU · AAP · JNE ·
        SAT Trujillo · Callao · Chiclayo · Arequipa · Ica · Cusco · Tacna · Cajamarca ·
        Huancayo · Piura · Tarapoto · Chachapoyas · Andahuaylas · Huánuco
      </div>
    </div>

    <!-- FOOTER -->
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #E2E8F0;text-align:center">
      <p style="font-size:11px;color:#94A3B8;margin:0;line-height:1.7">
        PlacaPE · Informe generado consultando fuentes oficiales del Estado Peruano.<br>
        ¿Consultas sobre este informe? WhatsApp: <a href="https://wa.me/51962103328" style="color:#2563EB">962 103 328</a>
      </p>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════
//  HANDLER PRINCIPAL
// ══════════════════════════════════════════════════════
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'No permitido' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) }; }

  const { placa, email, yapeCode } = body;
  if (!placa || !email || !yapeCode) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan campos' }) };

  const p = placa.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  console.log(`[INICIO] Placa: ${p} | Email: ${email}`);

  try {
    // 1. WhatsApp inmediato
    await wa(`🔔 *NUEVA CONSULTA PlacaPE*\n\n🚗 Placa: *${p}*\n📧 ${email}\n💳 Yape: ${yapeCode}\n💰 S/ 20.00\n🕐 ${new Date().toLocaleTimeString('es-PE')}\n\n⚙️ Generando informe completo...`);

    // 2. Consultar todas las fuentes EN PARALELO
    console.log('[CONSULTA] Iniciando consultas paralelas...');
    const [sunarp, revtec, soat, siniestros, sat, sutran, pnp, gnv, municipalidades] = await Promise.allSettled([
      consultarSUNARP(p),
      consultarRevTecnica(p),
      consultarSOAT(p),
      consultarSiniestros(p),
      consultarSAT(p),
      consultarSUTRAN(p),
      consultarPNP(p),
      consultarGNV(p),
      consultarMunicipalidades(p)
    ]);

    const datos = {
      placa: p,
      sunarp:          sunarp.status === 'fulfilled'          ? sunarp.value          : null,
      revtec:          revtec.status === 'fulfilled'          ? revtec.value          : null,
      soat:            soat.status === 'fulfilled'            ? soat.value            : null,
      siniestros:      siniestros.status === 'fulfilled'      ? siniestros.value      : null,
      sat:             sat.status === 'fulfilled'             ? sat.value             : null,
      sutran:          sutran.status === 'fulfilled'          ? sutran.value          : null,
      pnp:             pnp.status === 'fulfilled'             ? pnp.value             : null,
      gnv:             gnv.status === 'fulfilled'             ? gnv.value             : null,
      municipalidades: municipalidades.status === 'fulfilled' ? municipalidades.value : []
    };

    console.log('[CONSULTA] Todas las consultas completadas');

    // 3. Generar análisis inteligente
    const analisis = generarResumen(datos);

    // 4. Construir HTML del informe
    const htmlInforme = buildInformeHTML(p, datos, analisis);

    // 5. Enviar email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"PlacaPE 🚗" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `✅ Tu Informe Vehicular — Placa ${p} | PlacaPE`,
      html: htmlInforme
    });

    console.log(`[EMAIL] Enviado a ${email}`);

    // 6. WhatsApp de confirmación
    await wa(`✅ *INFORME ENVIADO*\n🚗 ${p}\n📧 ${email}\n🎯 Semáforo: ${analisis.semaforo}\n⚠️ Alertas: ${analisis.alertas.length}`);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  } catch(err) {
    console.error('[ERROR]', err.message);
    await wa(`⚠️ *ERROR*\nPlaca: ${p}\nError: ${err.message}`).catch(()=>{});
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
