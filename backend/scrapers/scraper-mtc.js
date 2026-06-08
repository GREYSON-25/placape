// ══════════════════════════════════════════════════════
//  scraper-mtc.js
//  Extrae datos reales del portal MTC del Perú
//  URL: https://www.mtc.gob.pe/cnsv/cnsv_bus_placadet.asp
// ══════════════════════════════════════════════════════
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

async function scrapeMTC(placa) {
  console.log(`[MTC] Consultando placa: ${placa}`);
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

    // ─── PORTAL MTC ───
    await page.goto('https://www.mtc.gob.pe/cnsv/cnsv_bus_placadet.asp', {
      waitUntil: 'networkidle2', timeout: 30000
    });

    // Ingresar placa
    await page.waitForSelector('input[name="placa"]', { timeout: 10000 });
    await page.type('input[name="placa"]', placa.replace('-',''));
    await page.click('input[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });

    // Extraer todos los datos de la tabla de resultados
    const datos = await page.evaluate(() => {
      const resultado = {};
      const filas = document.querySelectorAll('table tr');
      filas.forEach(fila => {
        const celdas = fila.querySelectorAll('td');
        if (celdas.length >= 2) {
          const label = celdas[0].innerText.trim().toLowerCase();
          const valor = celdas[1].innerText.trim();
          if (label.includes('marca'))        resultado.marca       = valor;
          if (label.includes('modelo'))       resultado.modelo      = valor;
          if (label.includes('año'))          resultado.anio        = valor;
          if (label.includes('color'))        resultado.color       = valor;
          if (label.includes('motor'))        resultado.motor       = valor;
          if (label.includes('serie'))        resultado.serie       = valor;
          if (label.includes('carroceria'))   resultado.carroceria  = valor;
          if (label.includes('uso'))          resultado.uso         = valor;
          if (label.includes('propietario'))  resultado.propietario = valor;
          if (label.includes('categoria'))    resultado.categoria   = valor;
          if (label.includes('combustible'))  resultado.combustible = valor;
        }
      });
      // Detectar si hay error / no encontrado
      const body = document.body.innerText;
      resultado.encontrado = !body.includes('no se encontr') && !body.includes('no existe') && Object.keys(resultado).length > 2;
      return resultado;
    });

    console.log('[MTC] Datos obtenidos:', datos);
    return datos;

  } catch (err) {
    console.error('[MTC] Error:', err.message);
    return { encontrado: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeMTC };
