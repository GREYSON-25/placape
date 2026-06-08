// ══════════════════════════════════════════════════════
//  consulta-vehicular.js
//  Orquestador principal — corre todos los scrapers
//  en paralelo y consolida el reporte completo
// ══════════════════════════════════════════════════════
const { scrapeMTC }              = require('./scrapers/scraper-mtc');
const { scrapeSUNARP }           = require('./scrapers/scraper-sunarp');
const { scrapeSAT }              = require('./scrapers/scraper-sat');
const { scrapeSOAT, scrapeRevTecnica } = require('./scrapers/scraper-soat-revtec');
const { scrapePNP }              = require('./scrapers/scraper-pnp');

async function consultarVehiculo(placa) {
  console.log(`\n🔍 Iniciando consulta completa para placa: ${placa}`);
  const inicio = Date.now();

  // ─── Ejecutar todos los scrapers en PARALELO ───────
  // Así tarda ~15-20 seg en lugar de 60-90 seg en serie
  const [mtc, sunarp, sat, soat, revtec, pnp] = await Promise.allSettled([
    scrapeMTC(placa),
    scrapeSUNARP(placa),
    scrapeSAT(placa),
    scrapeSOAT(placa),
    scrapeRevTecnica(placa),
    scrapePNP(placa),
  ]);

  const seg = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`✅ Consulta completa en ${seg} segundos`);

  // Extraer valores con fallback seguro
  const d = {
    mtc:    mtc.status    === 'fulfilled' ? mtc.value    : {},
    sunarp: sunarp.status === 'fulfilled' ? sunarp.value : {},
    sat:    sat.status    === 'fulfilled' ? sat.value    : {},
    soat:   soat.status   === 'fulfilled' ? soat.value   : {},
    revtec: revtec.status === 'fulfilled' ? revtec.value : {},
    pnp:    pnp.status    === 'fulfilled' ? pnp.value    : {},
  };

  // ─── Consolidar reporte ────────────────────────────
  return {
    placa,
    fechaConsulta: new Date().toLocaleDateString('es-PE', {
      day:'2-digit', month:'long', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    }),
    tiempoConsulta: `${seg} segundos`,

    // Datos del vehículo (MTC)
    marca:       `${d.mtc.marca || '—'} ${d.mtc.modelo || ''}`.trim(),
    anio:        d.mtc.anio        || '—',
    color:       d.mtc.color       || '—',
    motor:       d.mtc.motor       || '—',
    serie:       d.mtc.serie       || '—',
    carroceria:  d.mtc.carroceria  || '—',
    uso:         d.mtc.uso         || '—',
    combustible: d.mtc.combustible || '—',
    categoria:   d.mtc.categoria   || '—',

    // Propietarios (SUNARP)
    propietarios:      d.sunarp.propietarios    || [],
    numPropietarios:   d.sunarp.numPropietarios || 0,
    propietarioActual: d.sunarp.propietarios?.[0]?.nombre || '—',
    ultimaTransf:      d.sunarp.propietarios?.[0]?.fecha  || '—',

    // Gravámenes (SUNARP)
    tieneGravamen:    d.sunarp.tieneGravamen || false,
    gravamenes:       d.sunarp.gravamenes    || [],

    // Multas y papeletas (SAT)
    tienePapeletas: d.sat.tienePapeletas || false,
    numPapeletas:   d.sat.numPapeletas   || 0,
    montoMultas:    d.sat.montoTotal     || 'S/ 0.00',
    multas:         d.sat.multas         || [],
    impuesto:       d.sat.impuesto       || [],
    impuestoAlDia:  d.sat.impuestoAlDia  !== undefined ? d.sat.impuestoAlDia : null,

    // SOAT
    soatVigente:  d.soat.vigente     || false,
    soatVence:    d.soat.vencimiento || '—',
    soatEmpresa:  d.soat.empresa     || '—',

    // Revisión Técnica
    revVigente: d.revtec.vigente  || false,
    revEstado:  d.revtec.estado   || '—',
    revVence:   d.revtec.vencimiento || '—',
    revCentro:  d.revtec.empresa  || '—',

    // PNP
    tieneRQ:    d.pnp.tieneRQ   || false,
    tieneRobo:  d.pnp.tieneRobo || false,
    estadoPNP:  d.pnp.estado    || '—',

    // GNV/GLP (MTC - campo adicional)
    gnv:          d.mtc.combustible?.toLowerCase().includes('gas') || false,
    gnvVigencia:  '—',

    // Meta
    fuentesConsultadas: 6,
    errores: [
      mtc.status    === 'rejected' ? 'MTC'    : null,
      sunarp.status === 'rejected' ? 'SUNARP' : null,
      sat.status    === 'rejected' ? 'SAT'    : null,
      soat.status   === 'rejected' ? 'SOAT'   : null,
      revtec.status === 'rejected' ? 'RevTec' : null,
      pnp.status    === 'rejected' ? 'PNP'    : null,
    ].filter(Boolean)
  };
}

module.exports = { consultarVehiculo };
