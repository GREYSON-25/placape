// ══════════════════════════════════════════════════════
//  test-consulta.js
//  Prueba real del sistema completo
//  Ejecutar: node test-consulta.js
// ══════════════════════════════════════════════════════
require('dotenv').config();
const { consultarVehiculo } = require('./consulta-vehicular');
const { generarPDF }        = require('./generar-pdf');
const nodemailer = require('nodemailer');
const fs = require('fs');

// ─── Placa de prueba (placa real para testear) ────────
const PLACA_PRUEBA = process.argv[2] || 'ABC123';
const EMAIL_PRUEBA = process.env.GMAIL_USER; // envía al mismo correo

async function runTest() {
  console.log('═══════════════════════════════════════');
  console.log('  PlacaPE — TEST COMPLETO DEL SISTEMA');
  console.log('═══════════════════════════════════════\n');

  // ─── TEST 1: Variables de entorno ─────────────────
  console.log('📋 TEST 1: Verificando variables de entorno...');
  const vars = ['WA_NUMBER','WA_APIKEY','GMAIL_USER','GMAIL_PASS'];
  let envOk = true;
  vars.forEach(v => {
    const val = process.env[v];
    if (!val || val.includes('TU_')) {
      console.log(`  ❌ ${v}: NO CONFIGURADA`);
      envOk = false;
    } else {
      console.log(`  ✅ ${v}: configurada (${val.slice(0,6)}...)`);
    }
  });
  if (!envOk) {
    console.log('\n⚠️  Configura el archivo .env antes de continuar\n');
    process.exit(1);
  }

  // ─── TEST 2: WhatsApp ─────────────────────────────
  console.log('\n📱 TEST 2: Probando WhatsApp...');
  try {
    const n = process.env.WA_NUMBER;
    const k = process.env.WA_APIKEY;
    const r = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${n}&text=${encodeURIComponent('🧪 PlacaPE TEST — Sistema funcionando correctamente ✅')}&apikey=${k}`);
    if (r.status === 200) console.log('  ✅ WhatsApp: mensaje enviado correctamente');
    else console.log(`  ⚠️  WhatsApp: status ${r.status} — verifica tu APIKEY`);
  } catch(e) {
    console.log(`  ❌ WhatsApp: ${e.message}`);
  }

  // ─── TEST 3: Gmail ────────────────────────────────
  console.log('\n📧 TEST 3: Probando conexión Gmail...');
  try {
    const t = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });
    await t.verify();
    console.log('  ✅ Gmail: conexión exitosa');
  } catch(e) {
    console.log(`  ❌ Gmail: ${e.message}`);
    console.log('     → Verifica que usas "Contraseña de Aplicación" (no tu contraseña normal)');
  }

  // ─── TEST 4: Scrapers ─────────────────────────────
  console.log(`\n🔍 TEST 4: Consultando placa ${PLACA_PRUEBA} en tiempo real...`);
  console.log('    (Este proceso toma 20-40 segundos)\n');
  try {
    const reporte = await consultarVehiculo(PLACA_PRUEBA);
    console.log('  ✅ Consulta completada:');
    console.log(`     - Marca/Modelo: ${reporte.marca}`);
    console.log(`     - Año: ${reporte.anio}`);
    console.log(`     - SOAT: ${reporte.soatVigente ? '✅ Vigente' : '⚠️ Vencido/No verificado'}`);
    console.log(`     - Rev. Técnica: ${reporte.revVigente ? '✅ Vigente' : '⚠️ Vencida/No verificada'}`);
    console.log(`     - Papeletas: ${reporte.tienePapeletas ? '⚠️ '+reporte.numPapeletas+' encontradas' : '✅ Sin papeletas'}`);
    console.log(`     - Requisitoria: ${reporte.tieneRQ ? '⚠️ ALERTA' : '✅ Sin alerta'}`);
    console.log(`     - Gravámenes: ${reporte.tieneGravamen ? '⚠️ Tiene' : '✅ Sin gravámenes'}`);
    if (reporte.errores.length > 0) console.log(`     - ⚠️ Fuentes no disponibles: ${reporte.errores.join(', ')}`);

    // ─── TEST 5: Generar PDF ───────────────────────
    console.log('\n📄 TEST 5: Generando PDF...');
    const pdf = await generarPDF(reporte);
    fs.writeFileSync(`test_reporte_${PLACA_PRUEBA}.pdf`, pdf);
    console.log(`  ✅ PDF generado: test_reporte_${PLACA_PRUEBA}.pdf (${(pdf.length/1024).toFixed(0)} KB)`);

    // ─── TEST 6: Enviar email con PDF ─────────────
    console.log('\n📬 TEST 6: Enviando email con PDF...');
    const t = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });
    await t.sendMail({
      from: `"PlacaPE Test" <${process.env.GMAIL_USER}>`,
      to: EMAIL_PRUEBA,
      subject: `🧪 TEST PlacaPE — Placa ${PLACA_PRUEBA}`,
      html: `<p>Este es un correo de prueba del sistema PlacaPE.<br>Se adjunta el PDF generado para la placa <strong>${PLACA_PRUEBA}</strong>.</p>`,
      attachments: [{ filename: `PlacaPE_${PLACA_PRUEBA}_TEST.pdf`, content: pdf, contentType: 'application/pdf' }]
    });
    console.log(`  ✅ Email enviado a ${EMAIL_PRUEBA} — revisa tu bandeja de entrada`);

  } catch(e) {
    console.log(`  ❌ Error en scrapers o PDF: ${e.message}`);
  }

  // ─── RESUMEN ──────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  PRUEBA COMPLETADA');
  console.log('  Si todos los TEST muestran ✅ el sistema');
  console.log('  está listo para publicar en producción.');
  console.log('═══════════════════════════════════════\n');
}

runTest().catch(console.error);
