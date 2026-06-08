// ══════════════════════════════════════════════════════
//  scraper-pnp.js
//  Consulta requisitoria y robo en portal PNP
// ══════════════════════════════════════════════════════
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

async function scrapePNP(placa) {
  console.log(`[PNP] Consultando requisitoria/robo: ${placa}`);
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

    // Portal DIVIAC / PNP - vehículos robados
    await page.goto('https://www.pnp.gob.pe/servicios_pnp/requisitorias_vehiculos.html', {
      waitUntil: 'networkidle2', timeout: 30000
    });

    const input = await page.$('input[name*="placa"], input[id*="placa"]');
    if (input) {
      await input.type(placa.replace('-',''));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    const datos = await page.evaluate((placa) => {
      const body = document.body.innerText.toLowerCase();
      const placaLimpia = placa.replace('-','').toLowerCase();

      const tieneAlerta = body.includes(placaLimpia) &&
        (body.includes('robado') || body.includes('requisitoria') || body.includes('alerta'));

      return {
        tieneRQ: tieneAlerta,
        tieneRobo: body.includes('robado') && body.includes(placaLimpia),
        estado: tieneAlerta ? 'ALERTA ACTIVA' : 'Sin requisitoria ni reporte de robo',
        encontrado: true
      };
    }, placa);

    return datos;

  } catch (err) {
    console.error('[PNP] Error:', err.message);
    return { tieneRQ: false, tieneRobo: false, estado: 'No se pudo verificar', encontrado: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapePNP };
