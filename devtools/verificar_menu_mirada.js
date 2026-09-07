/**
 * devtools/verificar_menu_mirada.js
 * Regresion puntual del cableado del submenu "Mirada Interanual" (Tidetrack Dev).
 *
 * [CONCEPTO DE NEGOCIO]
 * El menu Dev es la unica forma en que Franco dispara codigo de mantenimiento sobre la
 * planilla productiva. Un item de menu que exige argumentos que Apps Script nunca provee
 * (menu.addItem llama a la funcion con CERO parametros) no falla en el commit ni en el
 * clasp push: falla recien al click, en produccion, con un TypeError generico.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * v0.66.1 saco del menu 'verificarPrecondicionesMirada' (ss, sheet) y
 * 'auditarBalanceFormulaMirada' (formula) por esa razon exacta. Este banco fija esa
 * correccion: no vuelven al menu sin un wrapper de cero argumentos, y los dos items que
 * quedan siguen apuntando a funciones declaradas con aridad cero. No requiere stubs de
 * SpreadsheetApp (no ejecuta nada de Apps Script): parsea los archivos reales de src/, igual
 * que devtools/probar_shell.js.
 *
 * @see src/00_Config.js (MENU_CONFIG.DEV_ITEMS, submenu 'Mirada Interanual')
 * @see src/07_MiradaInteranual.js
 *
 * USO:  node devtools/verificar_menu_mirada.js   (exit 0 si pasa, 1 si algo sale mal)
 *
 * @version 1.0.0
 * @since 2026-09-07
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', 'src');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };
const seccion = (t) => console.log('\n== ' + t + ' ==');

const configSrc = fs.readFileSync(path.join(RAIZ, '00_Config.js'), 'utf8');
const miradaSrc = fs.readFileSync(path.join(RAIZ, '07_MiradaInteranual.js'), 'utf8');

// ============================================
// Extraer el bloque exacto del submenu 'Mirada Interanual' dentro de MENU_CONFIG
// ============================================
seccion('Extraccion del submenu Mirada Interanual');

const marcaSubmenu = "submenu: 'Mirada Interanual'";
const inicioSubmenu = configSrc.indexOf(marcaSubmenu);
ok(inicioSubmenu > -1, 'MENU_CONFIG declara el submenu "Mirada Interanual"');

// El bloque termina en el primer "]" que cierra su array "items" (no hay submenus anidados
// dentro de Mirada Interanual, asi que el primer "]" tras la marca alcanza).
const finSubmenu = configSrc.indexOf(']', inicioSubmenu);
const bloqueSubmenu = inicioSubmenu > -1 ? configSrc.slice(inicioSubmenu, finSubmenu + 1) : '';

const funcionesEnSubmenu = [...bloqueSubmenu.matchAll(/function:\s*'([^']+)'/g)].map(m => m[1]);
console.log('  Funciones wireadas hoy: ' + (funcionesEnSubmenu.join(', ') || '(ninguna)'));

// ============================================
// 1. Las dos funciones que exigen argumentos NO estan mas en el submenu
// ============================================
seccion('Las funciones con argumentos obligatorios no vuelven al menu sin wrapper');

const PROHIBIDAS_SIN_WRAPPER = ['verificarPrecondicionesMirada', 'auditarBalanceFormulaMirada'];
PROHIBIDAS_SIN_WRAPPER.forEach(nombre => {
    ok(!funcionesEnSubmenu.includes(nombre),
        '"' + nombre + '" no esta wireada directo en el submenu (exige argumentos)');
});

// ============================================
// 2. Las funciones que SI quedan en el submenu existen y tienen aridad cero
// ============================================
seccion('Las funciones que quedan en el menu existen con cero parametros obligatorios');

ok(funcionesEnSubmenu.length > 0, 'el submenu no quedo vacio (al menos un item util)');

funcionesEnSubmenu.forEach(nombre => {
    const declRe = new RegExp('function\\s+' + nombre + '\\s*\\(([^)]*)\\)');
    const m = declRe.exec(miradaSrc);
    if (!m) {
        ok(false, '"' + nombre + '" no se encontro declarada en 07_MiradaInteranual.js');
        return;
    }
    const params = m[1].trim();
    ok(params === '', '"' + nombre + '(' + params + ')" se puede invocar con cero argumentos');
});

// ============================================
// 3. Las dos funciones retiradas del menu siguen existiendo enteras (no se borro logica,
//    solo el gatillo que no podia dispararlas bien)
// ============================================
seccion('Las funciones retiradas siguen existiendo (solo se les quito el boton directo)');

PROHIBIDAS_SIN_WRAPPER.forEach(nombre => {
    const existe = new RegExp('function\\s+' + nombre + '\\s*\\(').test(miradaSrc);
    ok(existe, '"' + nombre + '" sigue declarada en 07_MiradaInteranual.js');
});

// ============================================
// 4. Siguen siendo llamadas desde algun lado del modulo (si no, quedarian muertas de verdad)
// ============================================
seccion('Siguen teniendo un llamador real dentro del modulo');

ok((miradaSrc.match(/verificarPrecondicionesMirada\(/g) || []).length >= 2,
    'verificarPrecondicionesMirada(...) tiene al menos un llamador ademas de su declaracion');
ok((miradaSrc.match(/auditarBalanceFormulaMirada\(/g) || []).length >= 2,
    'auditarBalanceFormulaMirada(...) tiene al menos un llamador ademas de su declaracion');

// ============================================
console.log('\n' + '='.repeat(50));
if (fallas === 0) {
    console.log('TODO OK. 0 fallas.');
    process.exit(0);
} else {
    console.log(fallas + ' falla(s). Revisar arriba.');
    process.exit(1);
}
