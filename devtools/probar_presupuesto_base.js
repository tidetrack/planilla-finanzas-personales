/**
 * devtools/probar_presupuesto_base.js
 * Banco de pruebas de DEVTOOL_PresupuestoBase.js.
 *
 * Corre la agregacion REAL del modulo contra un ledger sintetico donde la respuesta correcta se
 * conoce de antemano, y contra el ledger real del gemelo para verificar la forma del resultado.
 *
 * Existe porque el numero que este modulo produce es un PRESUPUESTO: si el promedio esta mal, el
 * Tablero compara la realidad contra una linea inventada y nadie se da cuenta -- no hay error,
 * hay otro numero. Es la misma clase de falla que la coordenada podrida.
 *
 * USO:  node devtools/probar_presupuesto_base.js
 * @version 0.25.0
 * @since 2026-08-20
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = '/Users/francodiazpizarro/Desktop/Antigravity/planilla-finanzas-personales/.claude/worktrees/gracious-kalam-00e92c';

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };

// --- El ledger sintetico. HOY se fija al 2026-08-20, igual que la sesion. -------------------
const HOY = new Date(2026, 7, 20);
// Con promedio movil, cada mes de destino promedia los 6 meses ANTERIORES a el.
// Para 08/2026 la ventana es 02/2026..07/2026; para 07/2026 es 01/2026..06/2026.
const LEDGER = [
    // cuenta         tipo_cuenta      tipo      moneda  medio       monto  fecha
    ['Comidas',       'Gasto Variable', 'Egreso', 'ARS', 'NaranjaX', 60000, new Date(2026, 1, 5)],
    ['Comidas',       'Gasto Variable', 'Egreso', 'ARS', 'NaranjaX', 60000, new Date(2026, 3, 5)],
    ['Comidas',       'Gasto Variable', 'Egreso', 'ARS', 'Efectivo', 60000, new Date(2026, 5, 5)],
    ['Comidas',       'Gasto Variable', 'Egreso', 'ARS', 'NaranjaX', 60000, new Date(2026, 6, 5)],
    // -> JULIO (mes 6) es el mes que separa las dos ventanas: entra en la de agosto (02..07) y
    //    NO en la de julio (01..06). Sin un movimiento aca, los dos meses darian identico y el
    //    invariante "el presupuesto se mueve" no probaria nada.
    //    Agosto: 240000/6 = 40000.  Julio: 180000/6 = 30000.
    ['Sueldo',        'Ingreso',        'Ingreso','ARS', 'Santander', 600000, new Date(2026, 2, 1)],
    ['Sueldo',        'Ingreso',        'Ingreso','ARS', 'Santander', 600000, new Date(2026, 3, 1)],
    // -> 1200000 / 6 = 200000
    ['Servidor',      'Gasto Fijo',     'Egreso', 'USD', 'Dolar Cash', 30, new Date(2026, 4, 10)],
    ['Servidor',      'Gasto Fijo',     'Egreso', 'USD', 'Dolar Cash', 30, new Date(2026, 5, 10)],
    // -> 60 USD / 6 = 10 USD. NO se mezcla con las lineas en ARS.
    // Un traspaso son DOS filas (verificado en el gemelo: sale de un medio, entra en otro).
    // El de casa a casa no cuenta por ninguna de sus dos patas.
    ['Traspaso',      '',               'Egreso', 'ARS', 'Efectivo',  999999, new Date(2026, 3, 9)],
    ['Traspaso',      '',               'Ingreso','ARS', 'NaranjaX',  999999, new Date(2026, 3, 9)],
    // El de casa a un FRASCO si: entra la pata de Ingreso, cuyo medio es de tipo Ahorros.
    // OJO: esta pata trae 'Ingreso' TAMBIEN en Tipo de Cuenta, como pasa en el ledger real.
    // El lector se lo tiene que sacar: un traspaso no pertenece a ningun bloque.
    ['Traspaso',      '',               'Egreso', 'ARS', 'Efectivo',  150000, new Date(2026, 2, 4)],
    ['Traspaso',      'Ingreso',        'Ingreso','ARS', 'Frasco',    150000, new Date(2026, 2, 4)],
    // -> 150000/6 = 25000/mes de capitalizacion presupuestada.
    ['Inicio Mes',    'Ingreso',        'Ingreso','ARS', 'Frasco',   888888, new Date(2026, 3, 1)],
    // -> el arrastre NUNCA entra, ni siquiera tocando un medio de riqueza
    ['Viejo',         'Gasto Variable', 'Egreso', 'ARS', 'Efectivo', 500000, new Date(2025, 11, 3)],
    // -> anterior a la ventana, se descarta
    ['DelMesEnCurso', 'Gasto Variable', 'Egreso', 'ARS', 'Efectivo', 700000, new Date(2026, 7, 3)],
    // -> el mes en curso NO entra al promedio: esta a medio transcurrir
    ['Centavos',      'Gasto Variable', 'Egreso', 'ARS', 'Efectivo', 3, new Date(2026, 3, 3)],
    // -> 3/6 = 0.50, por debajo de PB_MINIMO: es ruido, no una linea
    ['Viajes',        'Gasto Variable', 'Egreso', 'ARS', 'NaranjaX',  120000, new Date(2026, 2, 8)],
    ['Viajes',        'Gasto Variable', 'Egreso', 'USD', 'Dolar Cash',    90, new Date(2026, 4, 8)],
    // -> LA MISMA cuenta pagada en dos monedas: tienen que salir DOS lineas, 20.000 ARS y 15 USD.
    //    Si se agruparan sin la moneda darian una sola linea de 20.015, un numero que no existe.
];

function hojaFalsa(nombre, filas, headerRow, dataRow) {
    // Columnas B..M = indices 2..13 en notacion 1-based de Sheets.
    const HEAD = { 2: 'Monto', 3: 'Tipo', 4: 'Cuenta', 5: 'Tipo de Cuenta', 6: 'Medio', 7: 'Moneda', 8: 'Fecha', 9: 'Nota' };
    const matriz = filas.map(f => {
        const r = new Array(12).fill('');
        r[0] = f[5]; r[1] = f[2]; r[2] = f[0]; r[3] = f[1]; r[4] = f[4]; r[5] = f[3]; r[6] = f[6];
        return r;
    });
    return {
        _nombre: nombre,
        getLastRow: () => dataRow + matriz.length - 1,
        getMaxRows: () => 1000,
        getMaxColumns: () => 20,
        getRange(fila, col, nf, nc) {
            if (nf === undefined) return { getValue: () => (fila === headerRow ? (HEAD[col] || '') : ''), getFormula: () => '' };
            return {
                getValues: () => {
                    const out = [];
                    for (let i = 0; i < nf; i++) {
                        const src = matriz[fila - dataRow + i] || new Array(12).fill('');
                        out.push(src.slice(col - 2, col - 2 + nc));
                    }
                    return out;
                },
            };
        },
    };
}

// --- Contexto: se cargan Config y el modulo de verdad, sin reimplementar nada -----------------
const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON,
    SpreadsheetApp: { flush() {} },
    PropertiesService: { getDocumentProperties: () => ({ setProperty() {}, getProperty: () => null, deleteProperty() {} }) },
    Utilities: { formatDate: (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` },
    Session: { getScriptTimeZone: () => 'America/Argentina/Buenos_Aires' },
    Logger: { log() {} },
    logInfo() {}, logError() {}, logSuccess() {},
    // Cotizaciones fijas para _tasasPb: el balance multi-moneda tiene que ser determinista aca.
    TIDETRACK_USD: () => 1000, TIDETRACK_AUD: () => 700, TIDETRACK_EUR: () => 1100,
};
vm.createContext(ctx);
vm.runInContext(
    fs.readFileSync(path.join(RAIZ, 'src/00_Config.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/03_SheetManager.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_FormulerioV0111.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoBase.js'), 'utf8') +
    '\n;Object.assign(globalThis,{RANGES,SHEETS,PB_MARCA,PB_MESES_VENTANA,PB_MESES_DESTINO,PB_MINIMO});',
    ctx);

// El modulo lee `new Date()` para ubicar la ventana: se fija al dia de la sesion.
const DateReal = Date;
ctx.Date = function (...a) { return a.length ? new DateReal(...a) : new DateReal(HOY); };
ctx.Date.prototype = DateReal.prototype;
Object.setPrototypeOf(ctx.Date, DateReal);

// --- 0. Integridad del fuente ---------------------------------------------------------------
// Un byte de control dentro de un literal de string no rompe la sintaxis, no lo muestra ningun
// editor y viaja al deploy sin que nadie lo note. Aparecio uno el 2026-08-20 -- un NUL adentro de
// un .join() -- inyectado por una herramienta de edicion, no por un humano. Se chequea aca porque
// es la clase de defecto que solo se ve mirando los bytes.
console.log('=== 0. Integridad de los fuentes (sin bytes de control) ===');
{
    const dirs = ['src', 'devtools'];
    const sospechosos = [];
    dirs.forEach(d => fs.readdirSync(path.join(RAIZ, d)).forEach(f => {
        const full = path.join(RAIZ, d, f);
        if (fs.statSync(full).isDirectory()) return;
        const b = fs.readFileSync(full);
        for (let i = 0; i < b.length; i++) {
            const c = b[i];
            if (c < 9 || c === 11 || c === 12 || (c >= 14 && c < 32)) {
                sospechosos.push(`${d}/${f} byte ${i} = 0x${c.toString(16)}`);
                break;
            }
        }
    }));
    ok(sospechosos.length === 0, sospechosos.length ? 'bytes de control: ' + sospechosos.join('; ')
                                                    : 'ningun byte de control en src/ ni devtools/');

    // Y NINGUNA funcion definida dos veces. En Apps Script la ultima definicion pisa a las
    // anteriores EN SILENCIO: node --check no protesta, la planilla tampoco, y uno edita la copia
    // muerta creyendo que edita la viva. Paso el 2026-08-20: _planCap quedo definida CUATRO veces
    // tras una serie de cirugias de texto, y las tres primeras eran cadaveres.
    const defs = {};
    dirs.filter(d => d === 'src').forEach(d => fs.readdirSync(path.join(RAIZ, d)).forEach(f => {
        if (!/\.js$/.test(f)) return;
        const lineas = fs.readFileSync(path.join(RAIZ, d, f), 'utf8').split('\n');
        lineas.forEach((l, i) => {
            const m = l.match(/^\s*function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
            if (m) (defs[m[1]] = defs[m[1]] || []).push(f + ':' + (i + 1));
        });
    }));
    const dup = Object.keys(defs).filter(k => defs[k].length > 1);
    ok(dup.length === 0, dup.length ? 'FUNCIONES DUPLICADAS (la ultima pisa en silencio): ' +
       dup.map(k => k + ' [' + defs[k].join(', ') + ']').join('; ') : 'ninguna funcion definida dos veces en src/');
}

const cfg = ctx.RANGES.REGISTROS;
// El catalogo de medios: solo "Frasco" es de riqueza.
const MEDIOS = [['NaranjaX','ARS','Hogar'],['Efectivo','ARS','Hogar'],['Santander','ARS','Hogar'],
                ['Dolar Cash','USD','Ahorros'],['Frasco','ARS','Ahorros']];
const hojaMedios = () => ({
  getLastRow: () => 7 + MEDIOS.length - 1,
  getRange: (fila, col, nf, nc) => ({ getValues: () => MEDIOS.map(m => [m[0], m[1], m[2]].slice(0, nc)) })
});
const ss = { getSheetByName: (n) => n === cfg.sheet ? hojaFalsa(n, LEDGER, cfg.headerRow, cfg.dataRow)
                                 : (n === ctx.RANGES.MEDIOS_PAGO.sheet ? hojaMedios() : null) };

console.log('=== 1. La ventana movil de cada mes ===');
const datos = ctx._leerLedgerPb(ss);
const meses = ctx._mesesDestinoPb();
const plan = ctx._planPorMesPb(datos, meses);
const porMes = {};
plan.forEach(m => { porMes[m.mes.getFullYear() * 100 + m.mes.getMonth()] = m; });
const AGO = 2026 * 100 + 7, JUL = 2026 * 100 + 6;
ok(porMes[AGO] && porMes[AGO].desde.getMonth() === 1, 'agosto promedia desde 02/2026');
ok(porMes[JUL] && porMes[JUL].desde.getMonth() === 0, 'julio promedia desde 01/2026');
ok(plan.every(m => m.mes > m.desde), 'ningun mes se promedia a si mismo ni a su futuro');

// El mes en curso (08) tiene un movimiento de 700.000 que NO debe entrar en su propio promedio.
const agoLineas = porMes[AGO].lineas;
ok(!agoLineas.some(l => l.cuenta === 'DelMesEnCurso'),
   'el gasto de agosto no entra en el presupuesto de agosto');

const h = { lineas: agoLineas, neutras: datos.neutras };

console.log('\n=== 2. El promedio se divide por los meses de la VENTANA, no por los meses con dato ===');
const porCuenta = {};
h.lineas.forEach(l => { porCuenta[l.cuenta + '|' + l.moneda] = l; });
ok(porCuenta['Comidas|ARS'] && porCuenta['Comidas|ARS'].promedio === 40000,
   'Comidas en AGOSTO: 240.000 en 4 meses -> 40.000/mes (divisor 6, no 4). Dio ' + (porCuenta['Comidas|ARS'] || {}).promedio);
const comidasJul = porMes[JUL].lineas.find(l => l.cuenta === 'Comidas' && l.moneda === 'ARS');
ok(comidasJul && comidasJul.promedio === 30000,
   'Comidas en JULIO: 180.000 -> 30.000/mes, sin el gasto de julio. Dio ' + (comidasJul || {}).promedio);
ok(porCuenta['Sueldo|ARS'] && porCuenta['Sueldo|ARS'].promedio === 200000,
   'Sueldo: 1.200.000 -> 200.000/mes. Dio ' + (porCuenta['Sueldo|ARS'] || {}).promedio);

console.log('\n=== 3. Cada moneda es su propia linea, sin promediarse con las otras ===');
ok(porCuenta['Servidor|USD'] && porCuenta['Servidor|USD'].promedio === 10,
   'Servidor: 60 USD -> 10 USD/mes, en USD. Dio ' + JSON.stringify(porCuenta['Servidor|USD'] || null));
ok(!porCuenta['Servidor|ARS'], 'no se creo una linea en ARS para una cuenta que se paga en USD');
ok(porCuenta['Viajes|ARS'] && porCuenta['Viajes|ARS'].promedio === 20000,
   'Viajes en ARS: 120.000 -> 20.000/mes. Dio ' + (porCuenta['Viajes|ARS'] || {}).promedio);
ok(porCuenta['Viajes|USD'] && porCuenta['Viajes|USD'].promedio === 15,
   'Viajes en USD: 90 -> 15/mes, como linea SEPARADA. Dio ' + (porCuenta['Viajes|USD'] || {}).promedio);
ok(h.lineas.filter(l => l.cuenta === 'Viajes').length === 2,
   'una cuenta pagada en dos monedas produce dos lineas, no un promedio mezclado. Dio ' +
   h.lineas.filter(l => l.cuenta === 'Viajes').length);

console.log('\n=== 4. Lo que NO entra ===');
ok(porCuenta['Traspaso|ARS'] && porCuenta['Traspaso|ARS'].promedio === 25000,
   'el traspaso a un FRASCO se presupuesta: 150.000 -> 25.000/mes. Dio ' + (porCuenta['Traspaso|ARS'] || {}).promedio);
ok(porCuenta['Traspaso|ARS'] && porCuenta['Traspaso|ARS'].tipoCuenta === '',
   'la pata de traspaso PIERDE su Tipo de Cuenta: no es ingreso ni gasto de ningun bloque. Dio "' +
   (porCuenta['Traspaso|ARS']||{}).tipoCuenta + '"');
ok(porCuenta['Traspaso|ARS'] && porCuenta['Traspaso|ARS'].medio === 'Frasco',
   'entra la pata que ENTRA al frasco, no la que sale de Efectivo. Dio "' + (porCuenta['Traspaso|ARS']||{}).medio + '"');
ok(!agoLineas.some(l => l.cuenta === 'Traspaso' && l.medio === 'Efectivo'),
   'el traspaso de casa a casa (999.999) NO se presupuesta por ninguna de sus dos patas');
ok(!porCuenta['Inicio Mes|ARS'],
   '"Inicio Mes" excluido AUNQUE toque un frasco: es un punto de corte, no una capitalizacion');
ok(!porCuenta['Viejo|ARS'], 'un movimiento anterior a la ventana no entra');
ok(!porCuenta['DelMesEnCurso|ARS'], 'el mes en curso no entra al promedio');
ok(!porCuenta['Centavos|ARS'], 'una linea por debajo de PB_MINIMO no se presupuesta');
ok(h.neutras === 4, 'se descartaron 4 filas neutras (2 del traspaso de casa, 1 pata de salida, 1 arrastre). Dio ' + h.neutras);

console.log('\n=== 5. El medio elegido es el mas frecuente de esa cuenta ===');
ok(porCuenta['Comidas|ARS'].medio === 'NaranjaX',
   'Comidas: 2 de NaranjaX contra 1 de Efectivo -> NaranjaX. Dio "' + porCuenta['Comidas|ARS'].medio + '"');

const colIni = ctx.columnLetterToIndex(cfg.start);
const pos = k => ctx.columnLetterToIndex(cfg.columns[k]) - colIni;

console.log('\n=== 5b. NINGUN MES SE PROYECTA CON DESAHORRO (decision Franco 2026-08-20) ===');
{
    const tasas = { ARS: 1, USD: 1000, AUD: 700, EUR: 1100 };
    const linea = (tc, moneda, monto, cuenta) =>
        ({ cuenta: cuenta || (tc + ' ' + monto), moneda, tipoCuenta: tc, tipo: tc === 'Ingreso' ? 'Ingreso' : 'Egreso', medio: 'X', promedio: monto, movimientos: 1 });
    const balance = (ls) => {
        let ing = 0, gas = 0;
        ls.forEach(l => { const v = l.promedio * tasas[l.moneda]; if (l.tipoCuenta === 'Ingreso') ing += v; else gas += v; });
        return { ing, gas, capacidad: ing - gas };
    };

    // Caso 1: mes sano, no se toca nada.
    let ls = [linea('Ingreso','ARS',1000), linea('Gasto Fijo','ARS',400), linea('Gasto Variable','ARS',300)];
    let a = ctx._ajustarSinDesahorroPb(ls, tasas);
    ok(!a.recortado && ls[1].promedio === 400 && ls[2].promedio === 300,
       'mes sin deficit: intacto, sin recorte');

    // Caso 2: deficit absorbible por variables. ing=1000, fij=600, var=600 -> deficit 200.
    ls = [linea('Ingreso','ARS',1000), linea('Gasto Fijo','ARS',600),
          linea('Gasto Variable','ARS',400,'VarA'), linea('Gasto Variable','ARS',200,'VarB')];
    a = ctx._ajustarSinDesahorroPb(ls, tasas);
    let b = balance(ls);
    ok(a.recortado && a.factorFijo === 1, 'deficit chico: recortan SOLO los variables');
    ok(ls[1].promedio === 600, 'los fijos quedan intactos: los contratos no se recortan en el plan');
    ok(Math.abs(ls[2].promedio / ls[3].promedio - 2) < 0.01,
       'el recorte de variables es proporcional (VarA sigue siendo el doble de VarB)');
    ok(b.capacidad >= 0 && b.capacidad < 1,
       'la capacidad queda en cero por RECORTE, no por tapado. Dio ' + b.capacidad.toFixed(2));

    // Caso 3: los fijos solos superan al ingreso -> variables a cero y fijos recortados.
    ls = [linea('Ingreso','ARS',1000), linea('Gasto Fijo','ARS',1400), linea('Gasto Variable','ARS',300)];
    a = ctx._ajustarSinDesahorroPb(ls, tasas);
    b = balance(ls);
    ok(a.recortado && a.factorFijo < 1, 'anomalia estructural: los fijos tambien se recortan');
    ok(!ls.some(l => l.tipoCuenta === 'Gasto Variable'),
       'los variables quedaron en cero y salieron de la lista (debajo del minimo)');
    ok(b.capacidad >= 0, 'aun asi la capacidad no baja de cero. Dio ' + b.capacidad.toFixed(2));

    // Caso 4: multi-moneda. ing=1000 ARS; gasto variable de 1 USD (=1000 ARS) -> deficit 500 con fij 500.
    ls = [linea('Ingreso','ARS',1000), linea('Gasto Fijo','ARS',500), linea('Gasto Variable','USD',1)];
    a = ctx._ajustarSinDesahorroPb(ls, tasas);
    b = balance(ls);
    ok(a.recortado && b.capacidad >= 0 && ls[2].moneda === 'USD' && ls[2].promedio === 0.5,
       'el balance convierte a ARS pero el recorte se aplica EN LA MONEDA de la linea (1 USD -> 0,5 USD)');

    // Caso 5: el redondeo va hacia abajo -- el piso no se perfora por centavos.
    ls = [linea('Ingreso','ARS',100), linea('Gasto Variable','ARS',33.335,'V1'),
          linea('Gasto Variable','ARS',33.335,'V2'), linea('Gasto Variable','ARS',66.67,'V3')];
    ctx._ajustarSinDesahorroPb(ls, tasas);
    b = balance(ls);
    ok(b.capacidad >= 0, 'con montos que no dividen exacto, el piso aguanta. Capacidad ' + b.capacidad.toFixed(4));

    // Caso 5b: una pata de traspaso con tipoCuenta vacio no mueve el balance del recorte.
    ls = [linea('Ingreso','ARS',1000), linea('Gasto Variable','ARS',1200),
          { cuenta:'Traspaso', moneda:'ARS', tipoCuenta:'', tipo:'Ingreso', medio:'Frasco', promedio:500, movimientos:1 }];
    a = ctx._ajustarSinDesahorroPb(ls, tasas);
    ok(a.recortado && Math.abs(a.deficit - 200) < 0.01,
       'el traspaso proyectado NO cuenta como ingreso en el balance: deficit 200, no -300. Dio ' + a.deficit.toFixed(2));
    ok(ls[2].promedio === 500, 'y el traspaso no se recorta: capitalizar es el objetivo, no el problema');

    // Caso 6: 3000 meses al azar -- el invariante capacidad >= 0 SIEMPRE tras el ajuste.
    let peor = 1;
    for (let i = 0; i < 3000; i++) {
        const r = n => ((i * 7919 + n * 104729) % 1000003) / 1000003;
        const ms = ['ARS','USD','AUD','EUR'];
        const lz = [linea('Ingreso', ms[i % 4], 1 + r(1) * 500000)];
        for (let k = 0; k < 5; k++) {
            lz.push(linea(k % 2 ? 'Gasto Fijo' : 'Gasto Variable', ms[(i + k) % 4], r(k + 2) * 300000, 'L' + k));
        }
        ctx._ajustarSinDesahorroPb(lz, tasas);
        peor = Math.min(peor, balance(lz).capacidad);
    }
    ok(peor >= -0.01, '3000 meses al azar multi-moneda: la capacidad nunca baja de cero (peor ' + peor.toFixed(4) + ')');
}

console.log('\n=== 6. La matriz que se escribe ===');
ok(meses.length === ctx.PB_MESES_DESTINO, meses.length + ' meses de destino');
ok(meses[meses.length - 1].getMonth() === 7, 'el ultimo mes de destino es el mes en curso (08)');
const m = ctx._matrizPb(plan, 'sello');
ok(m.length === plan.reduce((a, x) => a + x.lineas.length, 0),
   m.length + ' filas = la suma de las lineas de cada mes');

// EL INVARIANTE DE ESTA VERSION: el presupuesto tiene que MOVERSE entre meses. Si dos meses
// consecutivos dan lo mismo, el Tablero vuelve a mostrar un numero que no responde al periodo,
// que es exactamente el defecto que esta version viene a arreglar.
const sumaMesArs = (clave) => m
  .filter(f => (f[pos('fecha')].getFullYear() * 100 + f[pos('fecha')].getMonth()) === clave && f[pos('moneda')] === 'ARS')
  .reduce((a, f) => a + Number(f[pos('monto')]), 0);
ok(sumaMesArs(AGO) !== sumaMesArs(JUL),
   'el presupuesto de agosto (' + sumaMesArs(AGO) + ') difiere del de julio (' + sumaMesArs(JUL) + ')');

ok(m.every(f => String(f[pos('nota')]).indexOf(ctx.PB_MARCA) === 0),
   'todas las filas llevan la marca en Nota: sin eso la carga no es repetible');
ok(m.every(f => f[pos('tc_ars')] === '' && f[pos('tc_usd')] === '' && f[pos('tc_aud')] === '' && f[pos('tc_eur')] === ''),
   'las columnas de TC congelado quedan VACIAS: un previsto no tiene cotizacion del dia');
ok(m.every(f => f[pos('fecha')] instanceof DateReal && f[pos('fecha')].getDate() === 1),
   'cada fila cae el dia 1 de su mes, dentro del rango que filtra el Tablero');
ok(m.every(f => Number(f[pos('monto')]) > 0), 'los montos son positivos: el Tablero suma crudo y filtra por Tipo de Cuenta');
ok(new Set(m.map(f => f[pos('cuenta')] + '|' + f[pos('moneda')] + '|' + f[pos('fecha')].getTime())).size === m.length,
   'no hay dos filas para la misma cuenta, moneda y mes');

const sumaMes = m.filter(f => f[pos('fecha')].getMonth() === 7 &&
        f[pos('tipo_cuenta')] === 'Gasto Variable' && f[pos('moneda')] === 'ARS')
    .reduce((a, f) => a + Number(f[pos('monto')]), 0);
ok(sumaMes === 60000, 'Gastos Variables ARS de agosto = 60.000 (Comidas 40.000 + Viajes 20.000). Dio ' + sumaMes);

console.log('\n' + (fallas === 0 ? '===> SIN FALLAS' : '===> ' + fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
