/**
 * probar_claves_duplicadas.js
 *
 * [CONCEPTO DE NEGOCIO] En un literal de objeto de JavaScript una clave repetida NO es error:
 * gana la ultima, en silencio. Este banco recorre TODOS los literales de nivel superior de
 * src/*.js y no deja pasar ninguno con una clave repetida.
 *
 * ALCANCE, y lo que deliberadamente NO hace: la coherencia del NUMERO de version entre sus
 * cuatro declaraciones (VERSION, releaseName, changelog embebido y ZZ_Changelog.js) la verifica
 * devtools/verificar_sintaxis.py, que ademas ya esta cableado como gate de sync_targets.command.
 * Este banco cubre la CLASE del defecto -- cualquier objeto, cualquier archivo -- no el caso.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO] El 2026-08-25 un merge dejo DOS lineas "patch:" en el
 * literal VERSION (git conservo las dos porque son lineas distintas, no un conflicto textual).
 * En JavaScript una clave repetida en un literal de objeto NO es error: gana la ultima. Asi que
 * toString() devolvia "0.55.1" mientras releaseName decia "v0.55.0" y targets.yaml declaraba
 * "0.55.0" -- tres fuentes en desacuerdo, desplegadas. Ningun banco lo vio porque el archivo
 * parsea perfecto. Es un defecto SILENCIOSO, y esos son los que se despliegan.
 *
 * @version 0.55.1
 * @since 0.55.1
 * @lastModified 2026-08-25
 * @see devtools/verificar_sintaxis.py (la mitad complementaria: coherencia del numero)
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

// ----------------------------------------------------------------------------
// CHEQUEO 1 - CLAVES DUPLICADAS en literales de objeto de nivel superior.
// Se busca la CLASE entera, no el caso de VERSION: cualquier "const X = { ... };" de nivel
// superior de src/*.js. Se cuentan solo las claves de la profundidad 1 del literal, para no
// confundir una clave repetida en dos objetos anidados distintos (eso es legitimo).
// ----------------------------------------------------------------------------
// Escaner de verdad, caracter por caracter. La primera version de este banco usaba regex y
// heuristicas de profundidad por linea, y acuso TRES claves duplicadas de las cuales DOS eran
// falsas ("NOTA" y "toString"): confundia la prosa del changelog embebido -- que vive dentro de
// un template literal de mil lineas con llaves sueltas -- con codigo. Un banco que acusa de mas
// es peor que no tenerlo: ensenia a ignorarlo. Por eso esto respeta comentarios, comillas,
// template literals y su interpolacion ${...}, y cuenta claves solo en la profundidad 1 del
// literal de nivel superior.
function _duplicadasEnArchivo(src) {
    const hallazgos = [];
    let i = 0, prof = 0, nombreActual = null, profBase = 0, vistas = null;
    const n = src.length;

    function esIdent(c) { return /[A-Za-z0-9_$]/.test(c); }

    while (i < n) {
        const c = src[i], d = src.substr(i, 2);

        if (d === '//') { while (i < n && src[i] !== '\n') i++; continue; }
        if (d === '/*') { i += 2; while (i < n && src.substr(i, 2) !== '*/') i++; i += 2; continue; }
        if (c === '"' || c === "'") {
            const q = c; i++;
            while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
            i++; continue;
        }
        if (c === '`') {
            i++;
            let anid = 0;
            while (i < n) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src.substr(i, 2) === '${') { anid++; i += 2; continue; }
                if (anid > 0 && src[i] === '}') { anid--; i++; continue; }
                if (anid === 0 && src[i] === '`') break;
                i++;
            }
            i++; continue;
        }

        if (c === '{' || c === '[') { prof++; i++; continue; }
        if (c === '}' || c === ']') {
            prof--;
            if (nombreActual && prof < profBase) {
                Object.keys(vistas).forEach(function (k) {
                    if (vistas[k] > 1) hallazgos.push({ objeto: nombreActual, clave: k, veces: vistas[k] });
                });
                nombreActual = null; vistas = null;
            }
            i++; continue;
        }

        // apertura de un literal de nivel superior: const X = {
        if (prof === 0 && !nombreActual && /^const\s+/.test(src.substr(i, 6))) {
            const m = /^const\s+([A-Za-z_$][\w$]*)\s*=\s*\{/.exec(src.substr(i, 200));
            if (m) {
                nombreActual = m[1]; vistas = {}; profBase = 1;
                i += m[0].length; prof++; continue;
            }
        }

        // clave dentro del literal, en su profundidad 1
        if (nombreActual && prof === profBase && esIdent(c) && !esIdent(src[i - 1] || ' ')) {
            let j = i; while (j < n && esIdent(src[j])) j++;
            let k = j; while (k < n && /\s/.test(src[k])) k++;
            if (src[k] === ':') {
                const clave = src.slice(i, j);
                vistas[clave] = (vistas[clave] || 0) + 1;
            }
            i = j; continue;
        }
        i++;
    }
    return hallazgos;
}

const archivos = fs.readdirSync(DIR_SRC).filter(f => f.endsWith('.js')).sort();
let conDup = [];
archivos.forEach(function (f) {
    _duplicadasEnArchivo(fs.readFileSync(path.join(DIR_SRC, f), 'utf8')).forEach(function (h) {
        conDup.push(f + ': const ' + h.objeto + ' repite "' + h.clave + '" (' + h.veces + ' veces)');
    });
});
if (conDup.length) {
    console.log('\n  En JavaScript una clave repetida NO es error: gana la ultima, en silencio.');
    conDup.forEach(function (d) { console.log('    ' + d); });
    console.log('');
}
ok(archivos.length > 0, 'hay archivos de src/ para inspeccionar (' + archivos.length + ')');
ok(conDup.length === 0, 'ningun literal de objeto de nivel superior repite una clave');

console.log('\n' + (fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
