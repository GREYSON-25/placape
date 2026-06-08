// ══════════════════════════════════════════════════════
//  server.js — PlacaPE Backend Completo
//  Node.js + Express · Automatización 100%
// ══════════════════════════════════════════════════════
const express   = require('express');
const cors      = require('cors');
const nodemailer = require('nodemailer');
const path      = require('path');
require('dotenv').config();

const { consultarVehiculo } = require('./consulta-vehicular');
const { generarPDF }        = require('./generar-pdf');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── WHATSAPP (CallMeBot gratuito) ────────────────────
async function wa(msg) {
  const n = process.env.WA_NUMBER;
  const k = process.env.WA_APIKEY;
  if (!k || k === 'TU_APIKEY_AQUI') { console.log('[WA] Sin apikey configurado'); return; }
  try {
    const r = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${n}&text=${encodeURIComponent(msg)}&apikey=${k}`);
    console.log('[WA] Status:', r.status);
  } catch(e) { console.error('[WA]', e.message); }
}

// ─── GMAIL ────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
});

// ══════════════════════════════════════════════════════
//  POST /api/consulta — Endpoint principal
// ══════════════════════════════════════════════════════
app.post('/api/consulta', async (req, res) => {
  const { placa, email, yapeCode } = req.body;
  if (!placa || !email || !yapeCode) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const p = placa.toUpperCase().replace(/[^A-Z0-9-]/g,'');
  console.log(`\n[CONSULTA] ${p} | ${email} | Yape: ${yapeCode}`);

  // Respuesta inmediata al frontend
  res.json({ ok: true, placa: p });

  // ─── Proceso en background ────────────────────────
  ;(async () => {
    try {
      // 1. WhatsApp: nueva consulta recibida
      await wa(
        `🔔 *NUEVA CONSULTA PlacaPE*\n\n` +
        `🚗 Placa: *${p}*\n📧 Email: ${email}\n` +
        `💳 Yape: ${yapeCode}\n💰 S/ 20.00\n` +
        `🕐 ${new Date().toLocaleTimeString('es-PE')}\n\n` +
        `⚙️ Consultando bases de datos...`
      );

      // 2. Consultar todas las fuentes en paralelo
      const reporte = await consultarVehiculo(p);

      // 3. Generar PDF
      const pdfBuffer = await generarPDF(reporte);

      // 4. Enviar email con PDF adjunto
      await mailer.sendMail({
        from:    `"PlacaPE 🚗" <${process.env.GMAIL_USER}>`,
        to:      email,
        subject: `✅ Tu Informe Vehicular — Placa ${p} | PlacaPE`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#1A4ECC,#2563EB);padding:28px 32px;border-radius:12px 12px 0 0;color:#fff;text-align:center">
    <h1 style="margin:0;font-size:26px">🔍 PlacaPE</h1>
    <p style="margin:6px 0 0;opacity:.9;font-size:14px">Tu informe vehicular está listo</p>
  </div>
  <div style="background:#F8FAFC;padding:24px 32px;border:1px solid #E2E8F0">
    <h2 style="color:#1E293B;font-size:18px;margin-bottom:4px">Placa: <strong style="color:#2563EB;letter-spacing:.1em">${p}</strong></h2>
    <p style="color:#475569;line-height:1.7;font-size:14px;margin-bottom:16px">
      Adjuntamos el informe completo en PDF con toda la información actualizada de las fuentes oficiales del Perú.
    </p>
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:14px 16px;margin-bottom:16px">
      <p style="margin:0;font-size:12px;color:#64748B">
        <strong>📋 Incluye:</strong> Datos del vehículo · SOAT · Revisión Técnica · Papeletas y multas · Historial de propietarios · Gravámenes SUNARP · Requisitoria PNP · Impuesto vehicular · GNV/GLP
      </p>
    </div>
    <p style="margin:0;font-size:12px;color:#94A3B8">
      ¿Problemas con el reporte? Escríbenos al WhatsApp:
      <a href="https://wa.me/51962103328" style="color:#2563EB;font-weight:600">962 103 328</a>
    </p>
  </div>
  <div style="background:#fff;padding:12px 32px;border:1px solid #E2E8F0;border-radius:0 0 12px 12px;text-align:center">
    <p style="font-size:11px;color:#94A3B8;margin:0">PlacaPE · Lima, Perú · © 2025</p>
  </div>
</div>`,
        attachments: [{
          filename:    `PlacaPE_${p}.pdf`,
          content:     pdfBuffer,
          contentType: 'application/pdf'
        }]
      });

      console.log(`[OK] Email enviado a ${email}`);

      // 5. WhatsApp: confirmación de éxito
      await wa(
        `✅ *PDF ENVIADO EXITOSAMENTE*\n\n` +
        `🚗 Placa: ${p}\n📧 Enviado a: ${email}\n` +
        `⏱ ${reporte.tiempoConsulta}\n` +
        `💰 Cobrado: S/ 20.00`
      );

    } catch(err) {
      console.error('[ERROR]', err.message);
      await wa(`⚠️ *ERROR en consulta*\nPlaca: ${p}\nEmail: ${email}\nError: ${err.message}`).catch(()=>{});
    }
  })();
});

// ─── Health check ────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date() }));

// ─── Servir frontend ─────────────────────────────────
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n🚀 PlacaPE corriendo en http://localhost:${PORT}\n`));
