// ══════════════════════════════════════════════════════
//  scraper-sunarp.js
//  Extrae propietarios y gravámenes de SUNARP
//  URL: https://www.sunarp.gob.pe/seccion/servicios/vehicular.html
// ══════════════════════════════════════════════════════
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

async function scrapeSUNARP(placa) {
  console.log(`[SUNARP] Consultando placa: ${placa}`);
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

    // ─── Consulta vehicular SUNARP ───
    await page.goto('https://enlinea.sunarp.gob.pe/sunarp-al-dia/vehicular', {
      waitUntil: 'networkidle2', timeout: 30000
    });

    // Buscar campo de placa e ingresar
    await page.waitForSelector('input[placeholder*="placa"], input[name*="placa"], input[id*="placa"]', { timeout: 10000 });
    const inputPlaca = await page.$('input[placeholder*="placa"], input[name*="placa"], input[id*="placa"]');
    await inputPlaca.type(placa.replace('-',''));

    // Buscar y hacer clic en botón consultar
    const btnConsultar = await page.$('button[type="submit"], input[type="submit"], button:contains("Consultar")');
    if (btnConsultar) await btnConsultar.click();
    else await page.keyboard.press('Enter');

    await page.waitForTimeout(3000);

    const datos = await page.evaluate(() => {
      const resultado = { propietarios: [], gravamenes: [] };
      const body = document.body.innerText.toLowerCase();

      // Propietarios
      const tablasProp = document.querySelectorAll('table');
      tablasProp.forEach(tabla => {
        const texto = tabla.innerText.toLowerCase();
        if (texto.includes('propietario') || texto.includes('titular')) {
          const filas = tabla.querySelectorAll('tr');
          filas.forEach((fila, i) => {
            if (i === 0) return; // skip header
            const celdas = fila.querySelectorAll('td');
            if (celdas.length >= 2) {
              resultado.propietarios.push({
                nombre: celdas[0]?.innerText?.trim() || '—',
                fecha:  celdas[1]?.innerText?.trim() || '—',
              });
            }
          });
        }
        // Gravámenes
        if (texto.includes('gravamen') || texto.includes('hipoteca') || texto.includes('prenda')) {
          const filas = tabla.querySelectorAll('tr');
          filas.forEach((fila, i) => {
            if (i === 0) return;
            const celdas = fila.querySelectorAll('td');
            if (celdas.length >= 2) {
              resultado.gravamenes.push({
                tipo:   celdas[0]?.innerText?.trim() || '—',
                detalle: celdas[1]?.innerText?.trim() || '—',
              });
            }
          });
        }
      });

      resultado.tieneGravamen = resultado.gravamenes.length > 0;
      resultado.numPropietarios = resultado.propietarios.length;
      resultado.encontrado = !body.includes('no se encontr') && !body.includes('no existe');
      return resultado;
    });

    console.log('[SUNARP] Datos:', JSON.stringify(datos));
    return datos;

  } catch (err) {
    console.error('[SUNARP] Error:', err.message);
    return { encontrado: false, propietarios: [], gravamenes: [], tieneGravamen: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeSUNARP };
