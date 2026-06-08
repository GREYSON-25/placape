// ══════════════════════════════════════════════════════
//  generar-pdf.js
//  Genera el PDF del informe vehicular con Puppeteer
//  Diseño profesional, listo para enviar por email
// ══════════════════════════════════════════════════════
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

function buildHTML(r) {
  const ok  = (txt) => `<span class="badge ok">✓ ${txt}</span>`;
  const mal = (txt) => `<span class="badge mal">⚠ ${txt}</span>`;
  const nd  = (txt) => `<span class="badge nd">— ${txt}</span>`;

  const badgeSOAT     = r.soatVigente  ? ok('VIGENTE') : r.soatVence === '—' ? nd('NO VERIFICADO') : mal('VENCIDO');
  const badgeRevTec   = r.revVigente   ? ok(r.revEstado||'APROBADO') : r.revEstado === '—' ? nd('NO VERIFICADO') : mal(r.revEstado||'VENCIDO');
  const badgeMultas   = !r.tienePapeletas ? ok('SIN PAPELETAS') : mal(`${r.numPapeletas} PAPELETA(S)`);
  const badgeRQ       = !r.tieneRQ && !r.tieneRobo ? ok('SIN ALERTA') : mal('ALERTA ACTIVA');
  const badgeGravamen = !r.tieneGravamen ? ok('SIN GRAVÁMENES') : mal('TIENE GRAVÁMENES');
  const badgeImp      = r.impuestoAlDia === true ? ok('AL DÍA') : r.impuestoAlDia === false ? mal('DEUDA PENDIENTE') : nd('NO VERIFICADO');

  const filasPropietarios = r.propietarios.length > 0
    ? r.propietarios.map((p,i) =>
        `<tr><td>${i===0?'Actual':'Anterior'}</td><td><strong>${p.nombre}</strong></td><td>${p.fecha}</td></tr>`
      ).join('')
    : `<tr><td colspan="3" style="color:#94A3B8;text-align:center">No se obtuvieron datos de propietarios</td></tr>`;

  const filasMultas = r.multas.length > 0
    ? r.multas.map(m =>
        `<tr><td>${m.descripcion||'—'}</td><td>${m.fecha||'—'}</td><td style="color:#DC2626;font-weight:600">${m.monto?'S/ '+Number(m.monto).toFixed(2):'—'}</td></tr>`
      ).join('')
    : `<tr><td colspan="3" style="color:#16A34A;text-align:center">✓ No se encontraron multas ni papeletas</td></tr>`;

  const filasGravamen = r.gravamenes.length > 0
    ? r.gravamenes.map(g =>
        `<tr><td>${g.tipo||'—'}</td><td>${g.detalle||'—'}</td></tr>`
      ).join('')
    : `<tr><td colspan="2" style="color:#16A34A;text-align:center">✓ Sin gravámenes registrados</td></tr>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:13px;color:#1E293B;background:#fff}
  .header{background:linear-gradient(135deg,#1035A0,#2563EB);color:#fff;padding:28px 36px}
  .header-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
  .logo{font-size:24px;font-weight:800}
  .fecha{font-size:11px;opacity:.75;text-align:right}
  .placa-box{background:#fff;color:#1E293B;border-radius:8px;display:inline-block;
    padding:8px 32px;font-size:36px;font-weight:800;letter-spacing:.2em}
  .fuentes{font-size:11px;opacity:.7;margin-top:8px}
  .resumen{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:20px 36px;background:#F8FAFC;border-bottom:1px solid #E2E8F0}
  .res-card{background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:12px 14px}
  .res-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;margin-bottom:6px}
  .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700}
  .badge.ok{background:#DCFCE7;color:#16A34A}
  .badge.mal{background:#FEE2E2;color:#DC2626}
  .badge.nd{background:#F1F5F9;color:#64748B}
  .body{padding:24px 36px}
  .sec{margin-bottom:24px}
  .sec-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
    color:#2563EB;border-bottom:2px solid #DBEAFE;padding-bottom:6px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  td,th{padding:8px 10px;border-bottom:1px solid #F1F5F9;vertical-align:top}
  th{background:#F8FAFC;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748B;font-weight:600}
  tr:last-child td{border-bottom:none}
  .lbl{color:#64748B;width:40%}
  .val{font-weight:600}
  .footer{background:#F8FAFC;border-top:1px solid #E2E8F0;padding:14px 36px;text-align:center;font-size:10px;color:#94A3B8}
  .alert-box{background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;padding:10px 14px;margin-bottom:8px;font-size:12px}
</style>
</head><body>

<div class="header">
  <div class="header-top">
    <div>
      <div class="logo">🔍 PlacaPE</div>
      <div style="font-size:13px;opacity:.85;margin-top:2px">Informe Vehicular Completo · Perú</div>
    </div>
    <div class="fecha">
      Generado:<br>${r.fechaConsulta}<br>
      Consulta en: ${r.tiempoConsulta}
    </div>
  </div>
  <div class="placa-box">${r.placa}</div>
  <div class="fuentes">Fuentes consultadas: MTC · SUNARP · SAT Lima · APESEG (SOAT) · PNP · OSINERGMIN</div>
</div>

<!-- RESUMEN EJECUTIVO -->
<div class="resumen">
  <div class="res-card"><div class="res-label">SOAT</div>${badgeSOAT}</div>
  <div class="res-card"><div class="res-label">Revisión Técnica</div>${badgeRevTec}</div>
  <div class="res-card"><div class="res-label">Papeletas / Multas</div>${badgeMultas}</div>
  <div class="res-card"><div class="res-label">Requisitoria / Robo</div>${badgeRQ}</div>
  <div class="res-card"><div class="res-label">Gravámenes SUNARP</div>${badgeGravamen}</div>
  <div class="res-card"><div class="res-label">Impuesto Vehicular</div>${badgeImp}</div>
</div>

<div class="body">

  <!-- DATOS DEL VEHÍCULO -->
  <div class="sec">
    <div class="sec-title">📋 Datos del Vehículo (MTC)</div>
    <table>
      <tr><td class="lbl">Placa</td><td class="val">${r.placa}</td><td class="lbl">Marca / Modelo</td><td class="val">${r.marca}</td></tr>
      <tr><td class="lbl">Año</td><td class="val">${r.anio}</td><td class="lbl">Color</td><td class="val">${r.color}</td></tr>
      <tr><td class="lbl">Combustible</td><td class="val">${r.combustible}</td><td class="lbl">Uso</td><td class="val">${r.uso}</td></tr>
      <tr><td class="lbl">Carrocería</td><td class="val">${r.carroceria}</td><td class="lbl">Categoría</td><td class="val">${r.categoria}</td></tr>
      <tr><td class="lbl">N° Motor</td><td class="val">${r.motor}</td><td class="lbl">N° Serie</td><td class="val">${r.serie}</td></tr>
    </table>
  </div>

  <!-- PROPIETARIOS -->
  <div class="sec">
    <div class="sec-title">👥 Historial de Propietarios (SUNARP)</div>
    <table>
      <tr><th>Tipo</th><th>Nombre / Razón Social</th><th>Fecha Inscripción</th></tr>
      ${filasPropietarios}
    </table>
  </div>

  <!-- SOAT Y REV TEC -->
  <div class="sec">
    <div class="sec-title">🛡️ SOAT · Revisión Técnica</div>
    <table>
      <tr><td class="lbl">Estado SOAT</td><td class="val">${badgeSOAT}</td><td class="lbl">Empresa Aseguradora</td><td class="val">${r.soatEmpresa}</td></tr>
      <tr><td class="lbl">Vence SOAT</td><td class="val">${r.soatVence}</td><td class="lbl">Estado Rev. Técnica</td><td class="val">${badgeRevTec}</td></tr>
      <tr><td class="lbl">Vence Rev. Técnica</td><td class="val">${r.revVence}</td><td class="lbl">Centro Inspección</td><td class="val">${r.revCentro}</td></tr>
    </table>
  </div>

  <!-- PAPELETAS -->
  <div class="sec">
    <div class="sec-title">🚨 Papeletas y Multas (SAT Lima)</div>
    ${r.tienePapeletas ? `<div class="alert-box">⚠ Se encontraron <strong>${r.numPapeletas} papeleta(s)</strong> con un total de <strong>${r.montoMultas}</strong></div>` : ''}
    <table>
      <tr><th>Descripción</th><th>Fecha</th><th>Monto</th></tr>
      ${filasMultas}
    </table>
  </div>

  <!-- REQUISITORIA / ROBO -->
  <div class="sec">
    <div class="sec-title">🚔 Requisitoria y Robo (PNP)</div>
    <table>
      <tr><td class="lbl">Estado PNP</td><td class="val">${badgeRQ}</td></tr>
      <tr><td class="lbl">Detalle</td><td>${r.estadoPNP}</td></tr>
    </table>
  </div>

  <!-- GRAVÁMENES -->
  <div class="sec">
    <div class="sec-title">⚖️ Gravámenes SUNARP</div>
    <table>
      <tr><th>Tipo</th><th>Detalle</th></tr>
      ${filasGravamen}
    </table>
  </div>

  <!-- IMPUESTO / GNV -->
  <div class="sec">
    <div class="sec-title">💰 Impuesto Vehicular · GNV / GLP</div>
    <table>
      <tr><td class="lbl">Impuesto Vehicular SAT</td><td class="val">${badgeImp}</td><td class="lbl">GNV / GLP</td><td class="val">${r.gnv ? '✓ Convertido' : 'No convertido'}</td></tr>
    </table>
  </div>

  ${r.errores.length > 0 ? `
  <div style="background:#F1F5F9;border-radius:6px;padding:10px 14px;font-size:11px;color:#64748B">
    ⚠ Las siguientes fuentes no respondieron y se omitieron del informe: ${r.errores.join(', ')}. Puede consultarlas directamente en sus portales oficiales.
  </div>` : ''}

</div>

<div class="footer">
  PlacaPE · Informe generado automáticamente consultando portales públicos del Estado Peruano (MTC, SUNARP, SAT, PNP).<br>
  La información es referencial. Para efectos legales verifique directamente con las entidades oficiales.<br>
  Soporte: <strong>962 103 328</strong> (WhatsApp) · © 2025 PlacaPE · Lima, Perú
</div>

</body></html>`;
}

async function generarPDF(reporte) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildHTML(reporte), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' }
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { generarPDF, buildHTML };
