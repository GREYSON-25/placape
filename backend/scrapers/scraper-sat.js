// ══════════════════════════════════════════════════════
//  scraper-sat.js
//  Extrae multas y papeletas del SAT Lima
//  URL: https://www.sat.gob.pe
// ══════════════════════════════════════════════════════
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

async function scrapeSAT(placa) {
  console.log(`[SAT] Consultando multas para: ${placa}`);
  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // SAT Lima - consulta de deudas vehiculares
    await page.goto('https://www.sat.gob.pe/websitev9/PortalSAT/Consultas/ConsultaDeudaVehicular', {
      waitUntil: 'networkidle2', timeout: 30000
    });

    await page.waitForSelector('input[id*="placa"], input[name*="placa"]', { timeout: 10000 });
    await page.type('input[id*="placa"], input[name*="placa"]', placa.replace('-',''));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    const datos = await page.evaluate(() => {
      const resultado = {
        multas: [],
        impuesto: [],
        totalDeuda: 0
      };

      const body = document.body.innerText;

      // Extraer tabla de multas/papeletas
      const tablas = document.querySelectorAll('table');
      tablas.forEach(tabla => {
        const texto = tabla.innerText.toLowerCase();
        if (texto.includes('multa') || texto.includes('papeleta') || texto.includes('infraccion')) {
          const filas = tabla.querySelectorAll('tr');
          filas.forEach((fila, i) => {
            if (i === 0) return;
            const celdas = fila.querySelectorAll('td');
            if (celdas.length >= 3) {
              const monto = parseFloat(celdas[celdas.length-1]?.innerText?.replace(/[^0-9.]/g,'')) || 0;
              resultado.multas.push({
                descripcion: celdas[0]?.innerText?.trim(),
                fecha: celdas[1]?.innerText?.trim(),
                monto: monto
              });
              resultado.totalDeuda += monto;
            }
          });
        }
        // Impuesto vehicular
        if (texto.includes('impuesto') || texto.includes('arbitrio')) {
          const filas = tabla.querySelectorAll('tr');
          filas.forEach((fila, i) => {
            if (i === 0) return;
            const celdas = fila.querySelectorAll('td');
            if (celdas.length >= 2) {
              resultado.impuesto.push({
                concepto: celdas[0]?.innerText?.trim(),
                monto:    celdas[celdas.length-1]?.innerText?.trim()
              });
            }
          });
        }
      });

      resultado.tienePapeletas = resultado.multas.length > 0;
      resultado.numPapeletas   = resultado.multas.length;
      resultado.montoTotal     = `S/ ${resultado.totalDeuda.toFixed(2)}`;
      resultado.impuestoAlDia  = !body.toLowerCase().includes('pendiente') && resultado.impuesto.length === 0;
      return resultado;
    });

    console.log('[SAT] Multas encontradas:', datos.numPapeletas);
    return datos;

  } catch (err) {
    console.error('[SAT] Error:', err.message);
    return { tienePapeletas: false, multas: [], numPapeletas: 0, montoTotal: 'S/ 0.00', error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeSAT };
