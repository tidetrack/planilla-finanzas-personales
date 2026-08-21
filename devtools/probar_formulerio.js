/**
 * devtools/probar_formulerio.js
 * Banco de pruebas de las transformaciones de src/DEVTOOL_FormulerioV0111.js.
 *
 * [CONCEPTO DE NEGOCIO]
 * El devtool del formulerio reescribe formulas de las dos hojas que Franco mira. Este script
 * corre esas mismas transformaciones -- las de verdad, cargadas del archivo, no una copia --
 * contra las formulas REALES de la planilla que guarda el gemelo digital, y muestra el antes y
 * el despues de cada celda. Sirve para mirar con los ojos lo que se va a escribir ANTES de que
 * toque la planilla productiva.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Existe por una cicatriz propia. La v0.12.0 escribio tres formulas que no parseaban porque un
 * string de reemplazo interpreto los '$' ('$1$N$17' produce "$N$N$10 - 7", no "$N$17"). El
 * verificador del modulo no lo vio porque comparaba texto contra texto. Este banco lo habria
 * cortado en diez segundos: no correrlo fue el error de verdad, mas que el bug en si.
 *
 * POR QUE NO VIVE EN src/: src/ es el rootDir de clasp -- todo lo que este ahi se DESPLIEGA a
 * Apps Script. Este archivo es una herramienta local que no debe subir a la planilla. Es la
 * excepcion razonada a la Regla Estricta 3 ("todo codigo .js va en src/"), cuya intencion es
 * que no haya codigo de Apps Script suelto, no que las herramientas locales entren al deploy.
 * Convive con las herramientas Python del gemelo, que estan aca por el mismo motivo.
 *
 * USO:  node devtools/probar_formulerio.js
 * Sale con codigo 0 si todo pasa, 1 si alguna transformacion produce algo invalido.
 *
 * QUE COMPRUEBA, por celda: que no aparezca la firma "$N$N" del bug de escape, que no quede
 * ningun #REF! ni el literal viejo ni una ancla de la fila 9 donde el spec dice que no debe
 * haberlos, que los parentesis queden balanceados y las comillas cerradas, y que aplicar la
 * transformacion dos veces de el mismo resultado que aplicarla una (idempotencia).
 *
 * CICATRIZ DEL 2026-08-21: una celda declarada en FORM_CELDAS/FORM_MONEDA_INICIO sin formula viva
 * imprimia "(sin snapshot)" y el banco seguia de largo sin marcar falla -- el mismo agujero que
 * se corrigio el mismo dia en probar_stock_flujo.js. Ahora es FALLA, con el rotulo o valor que
 * hoy ocupa esa celda.
 *
 * @version 0.12.2
 * @since 2026-08-19
 * @see src/DEVTOOL_FormulerioV0111.js
 * @see docs/permanente/celdas.tsv (las formulas contra las que se prueba)
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = '/Users/francodiazpizarro/Desktop/Antigravity/planilla-finanzas-personales/.claude/worktrees/gracious-kalam-00e92c';

// --- Stubs de los globales de Apps Script que el modulo usa en sus funciones puras ---
const ctx = {
  console,
  MONEDAS_DISPONIBLES: ['ARS', 'USD', 'AUD', 'EUR'],
  NAV_CONFIG: { SHEETS: { INICIO: 'Inicio', TABLERO: 'Tablero' } },
  RANGES: {
    REGISTROS: {
      sheet: 'Registros', start: 'B', end: 'M', headerRow: 6, dataRow: 7,
      columns: { monto:'B', tipo:'C', cuenta:'D', tipo_cuenta:'E', medio:'F', moneda:'G',
                 fecha:'H', nota:'I', tc_ars:'J', tc_usd:'K', tc_aud:'L', tc_eur:'M' }
    },
    PROYECTOS: { sheet: 'Plan de Cuentas', start: 'P', end: 'Q', columns: { nombre:'P', tipo:'Q' } }
  },
  columnLetterToIndex(l){let i=0;for(let k=0;k<l.length;k++)i=i*26+(l.charCodeAt(k)-64);return i;},
  columnIndexToLetter(n){let s='';while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;},
  getDataRow: c => c.dataRow || 8,
  logInfo(){}, logError(){}, logSuccess(){},
  SpreadsheetApp: {}, PropertiesService: {}, Utilities: {}, Session: {}, Logger: { log(){} }
};
vm.createContext(ctx);
// Las declaraciones `const` de un script no cuelgan del objeto global: hay que exportarlas
// desde el mismo ambito lexico.
const fuente = fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_FormulerioV0111.js'), 'utf8');
vm.runInContext(fuente + `
;Object.assign(globalThis, {
  FORM_CELDAS, FORM_MONEDA_INICIO, FORM_BLOQUE_ROTADO, FORM_TIPO_VIEJO, FORM_TIPO_NUEVO,
  FORM_FILA_DERRAME_TABLERO, FORM_SELECTOR_MONEDA_TABLERO
});`, ctx);

// --- Formulas reales del snapshot ---
const tsv = fs.readFileSync(path.join(RAIZ, 'docs/permanente/celdas.tsv'), 'utf8').split('\n');
const F = {}, V = {};
for (const linea of tsv) {
  const p = linea.split('\t');
  if (p.length < 4) continue;
  const clave = p[0] + '!' + p[1];
  if (p[2]) F[clave] = p[2].replace(/\\\\/g, '\x00').replace(/\\n/g, '\n').replace(/\x00/g, '\\');
  if (p[3]) V[clave] = p[3];
}
/** Que hay HOY en una celda, para el mensaje de falla ("y que se encontro en su lugar"). */
function queHayEn(clave) { return V[clave] ? 'hoy tiene "' + V[clave] + '"' : 'esta vacia'; }

const anclas = ctx._anclasMotorTablero();
const pre = { anclas, nombreInicio: 'Inicio', nombreTablero: 'Tablero' };
const ERRS = ['#REF!','#VALUE!','#DIV/0!','#N/A','#NAME?','#NUM!','#NULL!','#ERROR!'];

let fallas = 0;
function chequear(nombre, antes, despues, exigencias) {
  const problemas = [];
  if (/\$N\$N/.test(despues)) problemas.push('CONTIENE $N$N (bug de escape de $)');
  if (/#REF!/.test(despues) && exigencias.sinRef) problemas.push('quedo un #REF!');
  if (/Liquidez/.test(despues) && exigencias.sinLiquidez) problemas.push('quedo "Liquidez"');
  for (const a of anclas) if (new RegExp('\\b'+a+'9:'+a+'\\b').test(despues) && exigencias.sinAnclas) problemas.push('quedo ancla '+a+'9');
  // Parentesis balanceados fuera de los strings
  let d=0, enStr=false;
  for (const ch of despues) {
    if (ch === '"') enStr = !enStr;
    else if (!enStr && ch === '(') d++;
    else if (!enStr && ch === ')') d--;
    if (d < 0) break;
  }
  if (d !== 0) problemas.push('parentesis desbalanceados (delta ' + d + ')');
  if (enStr) problemas.push('comillas sin cerrar');
  if (problemas.length) { fallas++; console.log('\n### FALLA ' + nombre + ': ' + problemas.join(', ')); console.log(despues); }
  return problemas.length === 0;
}

console.log('=== 1. Las celdas del formulerio (defectos 1, 2 y 4) ===');
for (const spec of ctx.FORM_CELDAS) {
  const clave = (spec.hoja === 'INICIO' ? 'Inicio' : 'Tablero') + '!' + spec.celda;
  const antes = F[clave];
  if (!antes) {
    // CICATRIZ DEL 2026-08-21: esto imprimia "(sin snapshot)" y seguia de largo sin marcar falla
    // -- el mismo agujero que probar_stock_flujo.js tenia el mismo dia con R9/U9/X9. FORM_CELDAS
    // declara administrar esta celda; que no tenga formula viva es una senal, no un dato benigno.
    fallas++;
    console.log('  ### FALLA (sin formula) ' + clave + ' (' + spec.nota + '): ' + queHayEn(clave) +
      '. FORM_CELDAS declara administrar esta celda y no hay nada que reparar.');
    continue;
  }
  const despues = ctx._repararFormula(antes, spec, pre);
  const ok = chequear(clave, antes, despues, { sinRef: spec.refs, sinLiquidez: spec.literal, sinAnclas: spec.anclas });
  if (ok) console.log('  OK  ' + clave.padEnd(16) + ' ' + (ctx._resumirCambio(antes, despues, spec, pre)));
}

console.log('\n=== 2. El bloque rotado: reposicion de referencias en O23:O25 y N23:N25 ===');
for (const c of ['O23','O24','O25','N23','N24','N25']) {
  const antes = F['Tablero!'+c]; if (!antes) continue;
  const despues = ctx._reponerReferencias(antes);
  const ok = chequear('Tablero!'+c, antes, despues, { sinRef: true, sinLiquidez: false, sinAnclas: false });
  if (ok) {
    const l = despues.split('\n').filter(x => /rem_fijos|rem_var|IFERROR\(N1|tasa_cambio/.test(x));
    console.log('  OK  Tablero!'+c);
    l.forEach(x => console.log('        ' + x.trim()));
  }
}

console.log('\n=== 3. REPARAR lo que la v0.12.0 rompio en la planilla (input = el texto roto real) ===');
const roto = F['Tablero!O23'].replace(/(\$N\$10\s*-\s*)#REF!/g, '$1$N$17').replace(/(\$N\$11\s*-\s*)#REF!/g, '$1$N$18');
console.log('  Lo que hay HOY en la planilla:');
roto.split('\n').filter(x=>/rem_fijos|rem_var/.test(x)).forEach(x=>console.log('        ' + x.trim()));
const reparado = ctx._reponerReferencias(roto);
console.log('  Despues de re-correr "Aplicar":');
reparado.split('\n').filter(x=>/rem_fijos|rem_var/.test(x)).forEach(x=>console.log('        ' + x.trim()));
chequear('Tablero!O23 (reparacion del roto)', roto, reparado, { sinRef: true });
if (/\$N\$N/.test(reparado)) { console.log('  !!! SIGUE ROTO'); fallas++; }

console.log('\n=== 4. Sexto defecto: la conversion de moneda de Inicio ===');
for (const spec of ctx.FORM_MONEDA_INICIO) {
  const antes = F['Inicio!'+spec.celda];
  if (!antes) {
    fallas++;
    console.log('  ### FALLA (sin formula) Inicio!'+spec.celda+' ('+spec.nota+'): '+queHayEn('Inicio!'+spec.celda)+
      '. FORM_MONEDA_INICIO declara administrar esta celda y no hay nada que reparar.');
    continue;
  }
  const despues = ctx._repararMonedaInicio(antes, spec);
  const ok = chequear('Inicio!'+spec.celda, antes, despues, {});
  if (ok) {
    console.log('  OK  Inicio!'+spec.celda+'  ('+spec.nota+')');
    despues.split('\n').filter(x=>/tasa_origen|tasa_destino|Valor en/.test(x)).forEach(x=>console.log('        ' + x.trim()));
  }
}

console.log('\n=== 5. Idempotencia: re-aplicar sobre lo ya reparado no debe cambiar nada ===');
let noIdem = 0;
for (const spec of ctx.FORM_CELDAS) {
  const clave = (spec.hoja === 'INICIO' ? 'Inicio' : 'Tablero') + '!' + spec.celda;
  if (!F[clave]) continue;
  const a = ctx._repararFormula(F[clave], spec, pre);
  const b = ctx._repararFormula(a, spec, pre);
  if (a !== b) { console.log('  NO IDEMPOTENTE: ' + clave); noIdem++; }
}
for (const spec of ctx.FORM_MONEDA_INICIO) {
  if (!F['Inicio!'+spec.celda]) continue;
  const a = ctx._repararMonedaInicio(F['Inicio!'+spec.celda], spec);
  const b = ctx._repararMonedaInicio(a, spec);
  if (a !== b) { console.log('  NO IDEMPOTENTE: Inicio!'+spec.celda); noIdem++; }
}
console.log(noIdem === 0 ? '  OK  todas idempotentes' : '  ' + noIdem + ' no idempotentes');

console.log('\n' + (fallas + noIdem === 0 ? '===> SIN FALLAS' : '===> ' + (fallas+noIdem) + ' FALLA(S)'));
process.exit(fallas + noIdem === 0 ? 0 : 1);
