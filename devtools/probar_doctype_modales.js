/**
 * probar_doctype_modales.js
 *
 * [CONCEPTO DE NEGOCIO] Un archivo servido por HtmlService tiene que empezar con <!DOCTYPE html>.
 * Si algo lo precede -- aunque sea un comentario -- el navegador entra en quirks mode y el puente
 * que Apps Script inyecta para google.script.run puede no quedar montado.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO] El 2026-08-25 el ABM de Proyecciones Elaboradas tenia 90
 * lineas de cabecera antes del DOCTYPE. El modal ABRIA PERFECTO -- titulo, estilos, todo -- y
 * CUALQUIER llamada al servidor moria con "Se produjo un error en el servidor al leer desde el
 * almacenamiento. PERMISSION_DENIED", un mensaje que no tiene que ver ni con permisos ni con
 * almacenamiento. Costo una tarde: se descarto timing (3 reintentos, 12 s), gesto del usuario
 * (el boton Reintentar falla igual), tamanio del payload (un ping que devuelve dos constantes
 * falla igual) y la funcion (invocada directo desde el menu devuelve sus 7 grupos sin chistar).
 * La unica diferencia con los dos modales sanos del repo era la linea del DOCTYPE: 93 contra 1.
 *
 * @version 0.57.1
 * @since 0.57.1
 * @lastModified 2026-08-25
 */

const fs = require('fs');
const path = require('path');

const DIR_SRC = path.resolve(__dirname, '..', 'src');
let fallas = 0;
function ok(cond, msg) {
    console.log((cond ? '  OK  ' : '  FALLA  ') + msg);
    if (!cond) fallas++;
}

// UI_SharedStyles.html se incluye DENTRO de otro documento (via include()), asi que no lleva
// DOCTYPE propio: no es un documento, es un fragmento. Se excluye por eso, no por comodidad.
const FRAGMENTOS = ['UI_SharedStyles.html'];

const modales = fs.readdirSync(DIR_SRC)
    .filter(f => f.endsWith('.html') && FRAGMENTOS.indexOf(f) === -1)
    .sort();

ok(modales.length > 0, 'hay modales para revisar (' + modales.length + ')');

modales.forEach(function (f) {
    const texto = fs.readFileSync(path.join(DIR_SRC, f), 'utf8');
    const antes = texto.slice(0, texto.toUpperCase().indexOf('<!DOCTYPE'));
    const linea = antes.split('\n').length;
    const vacio = antes.trim() === '';
    if (!vacio) {
        console.log('\n    ' + f + ': el DOCTYPE arranca en la linea ' + linea + ', no en la 1.');
        console.log('    Lo precede esto, y alcanza para romper google.script.run:');
        console.log('      ' + antes.trim().split('\n')[0].slice(0, 70) + ' ...');
        console.log('    Mové ese bloque ADENTRO del <head>.\n');
    }
    ok(vacio, f + ': empieza con <!DOCTYPE html>, sin nada antes');
});

console.log('\n' + (fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
