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

const fuente = archivos.map(function (f) {
    return '\n//# ' + f + '\n' + fs.readFileSync(path.join(DIR_SRC, f), 'utf8');
}).join('\n');

let error = null;
try {
    vm.runInNewContext(fuente, vm.createContext(contexto), { filename: 'proyecto-apps-script.js' });
} catch (e) {
    error = e;
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

console.log('\n' + (fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
