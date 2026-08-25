/**
 * probar_carga_apps_script.js
 *
 * [CONCEPTO DE NEGOCIO] Apps Script no tiene modulos: TODOS los archivos comparten un unico
 * scope global y se evaluan en orden. Sin "filePushOrder" en .clasp.json ese orden es el
 * alfabetico. Si un archivo inicializa algo de nivel superior leyendo un simbolo que define
 * OTRO archivo que carga despues, el proyecto ENTERO no carga.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO] El costo no es local: un ReferenceError de carga no
 * rompe solo su modulo, rompe todas las funciones personalizadas de la planilla. El 2026-08-25
 * la hoja Inicio aparecio con #ERROR! en Saldo Actual y Capital Acumulado porque
 * DEVTOOL_PresupuestoGuardar.js (G) hacia "const PG_UMBRAL_IDENTIDAD = PM_UMBRAL_IDENTIDAD"
 * y DEVTOOL_PresupuestoModo.js (M) carga despues. "node --check" NO lo agarra: la sintaxis es
 * valida, falla al EVALUAR. Este banco evalua el proyecto como lo hace Apps Script.
 *
 * @version 0.50.1
 * @since 0.50.1
 * @lastModified 2026-08-25
 * @see docs/permanente/ESTRUCTURA.md
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');
const DIR_SRC = path.join(RAIZ, 'src');

let fallas = 0;
function ok(cond, msg) {
    console.log((cond ? '  OK  ' : '  FALLA  ') + msg);
    if (!cond) fallas++;
}

// Orden REAL de Apps Script: alfabetico, porque .clasp.json no declara filePushOrder.
// Si algun dia lo declara, este banco tiene que leerlo de ahi en vez de asumir.
const clasp = JSON.parse(fs.readFileSync(path.join(RAIZ, '.clasp.json'), 'utf8'));
ok(!clasp.filePushOrder,
   '.clasp.json sigue sin filePushOrder (si se agrega, este banco debe leer ESE orden)');

const archivos = fs.readdirSync(DIR_SRC).filter(f => f.endsWith('.js')).sort();
ok(archivos.length > 0, 'hay archivos .js en src/ para evaluar (' + archivos.length + ')');

// Servicios de Apps Script: se declaran para que el top level pueda nombrarlos sin que eso
// cuente como el error que estamos buscando. Deliberadamente NO se usa un Proxy que resuelva
// cualquier identificador: eso haria que un simbolo realmente ausente pareciera existir, que
// es exactamente el bug que este banco tiene que ver.
const SERVICIOS = ['SpreadsheetApp', 'Logger', 'Utilities', 'UrlFetchApp', 'PropertiesService',
                   'Session', 'CacheService', 'HtmlService', 'ScriptApp', 'DriveApp', 'Browser',
                   'LockService', 'console'];
const contexto = {};
SERVICIOS.forEach(function (n) {
    contexto[n] = new Proxy(function () {}, {
        get: function () { return contexto[n]; },
        apply: function () { return contexto[n]; },
        construct: function () { return contexto[n]; }
    });
});

function _evaluarEnOrden(orden) {
    const fuente = orden.map(function (f) {
        return '\n//# ' + f + '\n' + fs.readFileSync(path.join(DIR_SRC, f), 'utf8');
    }).join('\n');
    const ctx = {};
    SERVICIOS.forEach(function (n) {
        ctx[n] = new Proxy(function () {}, {
            get: function () { return ctx[n]; },
            apply: function () { return ctx[n]; },
            construct: function () { return ctx[n]; }
        });
    });
    try {
        vm.runInNewContext(fuente, vm.createContext(ctx), { filename: 'proyecto-apps-script.js' });
        return null;
    } catch (e) { return e; }
}

const error = _evaluarEnOrden(archivos);

function _quienLoDefine(msg) {
    const m = /'?(\w+)'? is not defined|Cannot access '(\w+)' before initialization/.exec(msg);
    if (!m) return null;
    const simbolo = m[1] || m[2];
    const duenio = archivos.filter(function (f) {
        return new RegExp('^(?:const|var|let|function)\\s+' + simbolo + '\\b', 'm')
            .test(fs.readFileSync(path.join(DIR_SRC, f), 'utf8'));
    });
    return { simbolo: simbolo, archivo: duenio.length ? duenio[0] : null };
}

if (error) {
    console.log('\n  El proyecto NO carga. Apps Script daria este error y con el se caerian TODAS');
    console.log('  las funciones personalizadas de la planilla:\n');
    console.log('    ' + error.name + ': ' + error.message);
    const m = /(\w+) is not defined/.exec(error.message);
    if (m) {
        const duenio = archivos.filter(function (f) {
            return new RegExp('^(?:const|var|let|function)\\s+' + m[1] + '\\b', 'm')
                .test(fs.readFileSync(path.join(DIR_SRC, f), 'utf8'));
        });
        if (duenio.length) {
            console.log('\n    "' + m[1] + '" lo define ' + duenio[0] + ', que carga DESPUES.');
            console.log('    Arreglo: leerlo al INVOCAR (una funcion que lo devuelva), no al cargar.');
        } else {
            console.log('\n    "' + m[1] + '" no lo define ningun archivo de src/. Es una referencia muerta.');
        }
    }
    console.log('');
}
ok(!error, 'el proyecto entero evalua en orden alfabetico sin romper');

// ----------------------------------------------------------------------------
// CHEQUEO 2 - FRAGILIDAD, no rotura.
// El chequeo 1 solo ve lo que YA esta roto. PC_BLOQUES leia PM_BLOQUES al cargar y pasaba en
// verde porque la "R" de Resumen ordena despues de la "M" de Modo: funcionaba de casualidad, y
// bastaba renombrar un archivo para despertarlo.
// Prueba: los NUMERADOS (00_, 01_, ...) conservan su orden -- su prefijo es deliberado y ningun
// rename los mueve detras de un DEVTOOL, porque los digitos ordenan antes que las letras -- y el
// RESTO se invierte. Si el proyecto sigue cargando, ningun archivo no-numerado depende de otro
// no-numerado en su nivel superior, y el orden entre ellos es irrelevante.
// ----------------------------------------------------------------------------
const numerados = archivos.filter(function (f) { return /^[0-9]/.test(f); });
const resto = archivos.filter(function (f) { return !/^[0-9]/.test(f); });
const ordenInverso = numerados.concat(resto.slice().reverse());
const errorFragil = _evaluarEnOrden(ordenInverso);

if (errorFragil) {
    const q = _quienLoDefine(errorFragil.message);
    console.log('\n  FRAGIL: hoy carga, pero solo por el orden alfabetico de los nombres de archivo.');
    console.log('  Invirtiendo los no-numerados:\n');
    console.log('    ' + errorFragil.name + ': ' + errorFragil.message);
    if (q && q.archivo) {
        console.log('\n    "' + q.simbolo + '" lo define ' + q.archivo + ', otro archivo no-numerado.');
        console.log('    Leerlo en un const de nivel superior ata este modulo a que ESE archivo');
        console.log('    ordene antes. Un rename lo rompe. Arreglo: leerlo al INVOCAR.');
    }
    console.log('');
}
ok(!errorFragil, 'ningun archivo no-numerado depende del orden de otro no-numerado al cargar');

console.log('\n' + (fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
