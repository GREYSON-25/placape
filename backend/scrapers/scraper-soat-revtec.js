// ══════════════════════════════════════════════════════
//  scraper-soat-revtec.js
//  SOAT: Portal del Asegurado APESEG
//  Rev. Técnica: Portal MTC
// ══════════════════════════════════════════════════════
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

async function scrapeSOAT(placa) {
  console.log(`[SOAT] Consultando: ${placa}`);
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

    // Portal del Asegurado - consulta SOAT
    await page.goto('https://www.apeseg.org.pe/soat/', {
      waitUntil: 'networkidle2', timeout: 30000
    });

    // Buscar input de placa
    await page.waitForSelector('input[name*="placa"], input[id*="placa"], input[placeholder*="placa"]', { timeout: 10000 });
    await page.type('input[name*="placa"], input[id*="placa"], input[placeholder*="placa"]', placa.replace('-',''));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const soat = await page.evaluate(() => {
      const body = document.body.innerText;
      const bodyLower = body.toLowerCase();
      const hoy = new Date();

      // Extraer fecha de vencimiento
      const matchFecha = body.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g);
      let vigente = false;
      let vencimiento = '—';
      let empresa = '—';

      if (matchFecha && matchFecha.length > 0) {
        vencimiento = matchFecha[matchFecha.length - 1];
        const partes = vencimiento.split(/[\/\-]/);
        const fechaVenc = new Date(partes[2], partes[1]-1, partes[0]);
        vigente = fechaVenc >= hoy;
      }

      // Buscar empresa aseguradora
      const aseguradoras = ['rimac','pacífico','mapfre','la positiva','interseguro','protecta'];
      aseguradoras.forEach(a => {
        if (bodyLower.includes(a)) empresa = a.charAt(0).toUpperCase() + a.slice(1);
      });

      const encontrado = !bodyLower.includes('no se encontr') && !bodyLower.includes('no existe') && matchFecha !== null;
      return { vigente, vencimiento, empresa, encontrado };
    });

    return soat;

  } catch (err) {
    console.error('[SOAT] Error:', err.message);
    return { vigente: false, vencimiento: '—', empresa: '—', encontrado: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

async function scrapeRevTecnica(placa) {
  console.log(`[RevTec] Consultando: ${placa}`);
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

    await page.goto('https://www.mtc.gob.pe/cnsv/cnsv_bus_rev_tec.asp', {
      waitUntil: 'networkidle2', timeout: 30000
    });

    await page.waitForSelector('input[name="placa"]', { timeout: 10000 });
    await page.type('input[name="placa"]', placa.replace('-',''));
    await page.click('input[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });

    const rev = await page.evaluate(() => {
      const body = document.body.innerText;
      const bodyLower = body.toLowerCase();
      const hoy = new Date();

      const matchFecha = body.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g);
      let vigente = false;
      let vencimiento = '—';
      let estado = '—';
      let empresa = '—';

      if (matchFecha && matchFecha.length > 0) {
        vencimiento = matchFecha[matchFecha.length - 1];
        const partes = vencimiento.split(/[\/\-]/);
        const fechaVenc = new Date(partes[2], partes[1]-1, partes[0]);
        vigente = fechaVenc >= hoy;
      }

      if (bodyLower.includes('aprobado'))    estado = 'Aprobado';
      else if (bodyLower.includes('observ')) estado = 'Observado';
      else if (bodyLower.includes('desap'))  estado = 'Desaprobado';

      // Centro de inspección
      const centros = ['LIDERCON','ITEV','REVTEC','CITV'];
      centros.forEach(c => { if (body.toUpperCase().includes(c)) empresa = c; });

      const encontrado = !bodyLower.includes('no se encontr') && estado !== '—';
      return { vigente, vencimiento, estado, empresa, encontrado };
    });

    return rev;

  } catch (err) {
    console.error('[RevTec] Error:', err.message);
    return { vigente: false, vencimiento: '—', estado: '—', encontrado: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeSOAT, scrapeRevTecnica };
