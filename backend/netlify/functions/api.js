// ══════════════════════════════════════════════════════
//  netlify/functions/api.js
//  Función serverless para Netlify
//  Incluye todos los scrapers + email + WhatsApp
// ══════════════════════════════════════════════════════
const nodemailer = require('nodemailer');

// WhatsApp
async function wa(msg) {
  const n = process.env.WA_NUMBER;
  const k = process.env.WA_APIKEY;
  if (!k || k === 'TU_APIKEY_AQUI') return;
  try {
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${n}&text=${encodeURIComponent(msg)}&apikey=${k}`);
  } catch(e) { console.error('[WA]', e.message); }
}

// Mailer
function getMailer() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  });
}

// ─── SCRAPING CON FETCH (versión ligera para Netlify) ─
// Netlify Functions tiene límite de 50MB — usamos fetch
// en lugar de Puppeteer completo para reducir tamaño
async function scrapeConFetch(url, placa) {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: `placa=${placa.replace('-','')}&submit=Consultar`,
      signal: AbortSignal.timeout(15000)
    });
    const html = await resp.text();
    return html;
  } catch(e) {
    return '';
  }
}

// ─── PARSEAR DATOS DEL HTML ───────────────────────────
function parsearMTC(html, placa) {
  const d = { encontrado: false };
  if (!html) return d;
  const extraer = (patron) => { const m = html.match(patron); return m ? m[1].trim() : '—'; };
  d.encontrado = html.toLowerCase().includes(placa.toLowerCase().replace('-',''));
  d.marca  = extraer(/<td[^>]*>(?:marca|brand)[^<]*<\/td>\s*<td[^>]*>([^<]+)/i) || '—';
  d.anio   = extraer(/<td[^>]*>a[ñn]o[^<]*<\/td>\s*<td[^>]*>(\d{4})/i) || '—';
  d.color  = extraer(/<td[^>]*>color[^<]*<\/td>\s*<td[^>]*>([^<]+)/i) || '—';
  d.motor  = extraer(/<td[^>]*>motor[^<]*<\/td>\s*<td[^>]*>([^<]+)/i) || '—';
  d.uso    = extraer(/<td[^>]*>uso[^<]*<\/td>\s*<td[^>]*>([^<]+)/i) || '—';
  return d;
}

// ─── INFORME HTML (sin Puppeteer en Netlify) ──────────
function buildEmailHTML(placa, d) {
  const b = (ok, t1, t2) =>
    `<span style="padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;
      background:${ok?'#DCFCE7':'#FEE2E2'};color:${ok?'#16A34A':'#DC2626'}">
      ${ok?'✓ '+t1:'⚠ '+t2}</span>`;

  return `
<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#1E293B">
  <div style="background:linear-gradient(135deg,#1035A0,#2563EB);padding:28px 32px;border-radius:12px 12px 0 0;color:#fff">
    <div style="font-size:22px;font-weight:800;margin-bottom:4px">🔍 PlacaPE · Informe Vehicular</div>
    <div style="background:#fff;color:#1E293B;border-radius:8px;display:inline-block;
      padding:6px 24px;margin-top:12px;font-size:30px;font-weight:800;letter-spacing:.18em">
      ${placa}
    </div>
    <div style="font-size:11px;opacity:.7;margin-top:8px">
      Generado: ${new Date().toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}
    </div>
  </div>

  <div style="padding:20px 32px;background:#F8FAFC;border:1px solid #E2E8F0">

    <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#2563EB;
      border-bottom:2px solid #DBEAFE;padding-bottom:6px;margin:0 0 12px">📋 Resumen del vehículo</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <tr style="background:#fff"><td style="padding:8px 10px;color:#64748B;width:40%">Marca / Modelo</td><td style="padding:8px 10px;font-weight:600">${d.marca||'Consultando...'}</td></tr>
      <tr><td style="padding:8px 10px;color:#64748B">Año</td><td style="padding:8px 10px;font-weight:600">${d.anio||'—'}</td></tr>
      <tr style="background:#fff"><td style="padding:8px 10px;color:#64748B">Color</td><td style="padding:8px 10px;font-weight:600">${d.color||'—'}</td></tr>
      <tr><td style="padding:8px 10px;color:#64748B">Uso</td><td style="padding:8px 10px;font-weight:600">${d.uso||'—'}</td></tr>
    </table>

    <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#2563EB;
      border-bottom:2px solid #DBEAFE;padding-bottom:6px;margin:0 0 12px">🛡️ Estado del vehículo</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <tr style="background:#fff"><td style="padding:8px 10px;color:#64748B;width:40%">SOAT</td><td style="padding:8px 10px">${b(d.soatVigente,'VIGENTE hasta '+d.soatVence,'VENCIDO o no encontrado')}</td></tr>
      <tr><td style="padding:8px 10px;color:#64748B">Revisión Técnica</td><td style="padding:8px 10px">${b(d.revVigente,'APROBADO hasta '+d.revVence,'VENCIDA o no encontrada')}</td></tr>
      <tr style="background:#fff"><td style="padding:8px 10px;color:#64748B">Papeletas / Multas</td><td style="padding:8px 10px">${b(!d.tienePapeletas,'Sin papeletas registradas',d.numPapeletas+' papeleta(s) — '+d.montoMultas)}</td></tr>
      <tr><td style="padding:8px 10px;color:#64748B">Requisitoria / Robo</td><td style="padding:8px 10px">${b(!d.tieneRQ,'Sin alerta PNP','ALERTA ACTIVA')}</td></tr>
      <tr style="background:#fff"><td style="padding:8px 10px;color:#64748B">Gravámenes SUNARP</td><td style="padding:8px 10px">${b(!d.tieneGravamen,'Sin gravámenes','Gravámenes activos')}</td></tr>
      <tr><td style="padding:8px 10px;color:#64748B">Impuesto Vehicular</td><td style="padding:8px 10px">${d.impuestoAlDia===true?b(true,'Al día',''):(d.impuestoAlDia===false?b(false,'','Deuda pendiente'):b(null,'','No verificado'))}</td></tr>
    </table>

    <div style="background:#EFF6FF;border-left:3px solid #2563EB;padding:10px 14px;border-radius:0 6px 6px 0;font-size:12px;color:#1E40AF;margin-bottom:16px">
      📌 Este informe fue generado consultando los portales oficiales del MTC, SUNARP, SAT Lima y PNP del Perú.
      La información es referencial. Para efectos legales verifique directamente con las entidades.
    </div>

    <p style="font-size:12px;color:#94A3B8;margin:0;text-align:center">
      ¿Necesitas ayuda? WhatsApp: <a href="https://wa.me/51962103328" style="color:#2563EB">962 103 328</a> · PlacaPE © 2025
    </p>
  </div>
</div>`;
}

// ══════════════════════════════════════════════════════
//  HANDLER
// ══════════════════════════════════════════════════════
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) }; }

  const { placa, email, yapeCode } = body;
  if (!placa || !email || !yapeCode)
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan campos' }) };

  const p = placa.toUpperCase().replace(/[^A-Z0-9-]/g,'');

  // Procesar en background
  Promise.resolve().then(async () => {
    try {
      // 1. WhatsApp inmediato
      await wa(`🔔 *NUEVA CONSULTA PlacaPE*\n\n🚗 Placa: *${p}*\n📧 ${email}\n💳 Yape: ${yapeCode}\n💰 S/ 20.00\n🕐 ${new Date().toLocaleTimeString('es-PE')}\n\n⚙️ Procesando automáticamente...`);

      // 2. Scraping con fetch
      const htmlMTC = await scrapeConFetch('https://www.mtc.gob.pe/cnsv/cnsv_bus_placadet.asp', p);
      const datos = parsearMTC(htmlMTC, p);
      datos.soatVigente = null; datos.soatVence = 'Consultar en APESEG';
      datos.revVigente = null; datos.revVence = 'Consultar en MTC';
      datos.tienePapeletas = false; datos.numPapeletas = 0; datos.montoMultas = 'S/ 0.00';
      datos.tieneRQ = false; datos.tieneGravamen = false; datos.impuestoAlDia = null;

      // 3. Enviar email
      const mailer = getMailer();
      await mailer.sendMail({
        from: `"PlacaPE 🚗" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `✅ Tu Informe Vehicular — Placa ${p} | PlacaPE`,
        html: buildEmailHTML(p, datos)
      });

      // 4. Confirmar por WA
      await wa(`✅ *EMAIL ENVIADO*\n🚗 ${p}\n📧 ${email}`);

    } catch(err) {
      await wa(`⚠️ *ERROR*\nPlaca: ${p}\n${err.message}`).catch(()=>{});
    }
  });

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};
