// PlacaPE v3
const nodemailer = require('nodemailer');

async function enviarWhatsApp(msg) {
  const n = process.env.WA_NUMBER;
  const k = process.env.WA_APIKEY;
  if (!k) return;
  await fetch(`https://api.callmebot.com/whatsapp.php?phone=${n}&text=${encodeURIComponent(msg)}&apikey=${k}`);
}

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
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { placa, email, yapeCode } = body;
  if (!placa || !email || !yapeCode) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan campos' }) };

  const p = placa.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  console.log(`[INICIO] Placa: ${p} | Email: ${email} | Yape: ${yapeCode}`);

  try {
    console.log('[WA] Enviando WhatsApp...');
    await enviarWhatsApp(`🔔 NUEVA CONSULTA PlacaPE\n\nPlaca: ${p}\nEmail: ${email}\nYape: ${yapeCode}\nMonto: S/ 20.00`);
    console.log('[WA] WhatsApp enviado');

    console.log('[EMAIL] Conectando Gmail...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });

    await transporter.verify();
    console.log('[EMAIL] Gmail verificado OK');

    await transporter.sendMail({
      from: `"PlacaPE" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Tu Informe Vehicular - Placa ${p} | PlacaPE`,
      html: `<div style="font-family:Arial,sans-serif;padding:20px">
        <h2 style="color:#2563EB">🔍 PlacaPE - Informe Vehicular</h2>
        <p>Hola, recibimos tu consulta para la placa <strong style="font-size:20px;letter-spacing:3px">${p}</strong></p>
        <p>Tu informe completo está siendo procesado y lo recibirás en los próximos minutos.</p>
        <p>Gracias por usar PlacaPE.</p>
        <hr>
        <p style="font-size:12px;color:#94A3B8">Soporte: <a href="https://wa.me/51962103328">962 103 328</a></p>
      </div>`
    });

    console.log('[EMAIL] Correo enviado a:', email);
    await enviarWhatsApp(`✅ EMAIL ENVIADO\nPlaca: ${p}\nCorreo: ${email}`);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  } catch(err) {
    console.error('[ERROR]', err.message);
    await enviarWhatsApp(`⚠️ ERROR: ${err.message}`).catch(()=>{});
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
