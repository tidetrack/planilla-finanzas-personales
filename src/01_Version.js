/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 *
 * @version 0.66.0
 * @since 0.1.0
 * @lastModified 2026-09-07
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 66,
 patch: 2,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-09-07',
 releaseName: 'v0.66.2 - Plasmar: la proyeccion guardada vuelve a las columnas manuales',

 // decision Franco 2026-09-07: el literal guardaba 75 releases (155.8 KB, el 99% de este
 // archivo) mientras su propio docstring prometia "solo refleja el release vigente". Apps
 // Script parsea el proyecto entero en cada ejecucion y un template literal se asigna como
 // constante en cada carga, asi que ese texto se pagaba en cada clic. Queda el release
 // vigente y nada mas. La historia NO se pierde: vive completa en src/ZZ_Changelog.js, que
 // es comentario puro (el lexer lo descarta) y que devtools/verificar_cobertura_changelog.py
 // comprobo entrada por entrada -- 75 bloques, 0 sin cobertura, 0 stubs -- ANTES de podar.
 /**
 * Changelog embebido (solo refleja el release vigente).
 * FUENTE DE VERDAD del historial completo: src/ZZ_Changelog.js
 * Formato: Semantic Versioning
 * + Agregado
 * * Mejorado
 * - Corregido
 * ! Breaking change
 */
 changelog: `
v0.66.2 (2026-09-07) - Plasmar: la proyeccion guardada vuelve a las columnas manuales
+ La operacion INVERSA de aplicarGuardarProyeccion: trae de la hoja-BD Proyeccion lo del mes elegido y lo escribe en las columnas "Monto a proyectar" (K/O/S). Funcion asignable a un dibujo: aplicarPresupuestoPlasmar.
+ Decision de Franco, TEXTUAL: "Solo lo manual. Lo proyectado no." Se trae UNICAMENTE el origen 'guardado' -- lo que salio de esas mismas columnas. NO recurrentes, NO presupuesto base, NO proyecciones sueltas del menu. No es circular: es RESTAURAR y COPIAR HACIA ADELANTE (recuperar la hoja despues de limpiarla, o arrancar un mes desde lo presupuestado en otro). Por eso el mes lo elige el operador.
+ El criterio de fondo es de producto: K/O/S son la superficie de trabajo MANUAL. Volcar ahi lo que el sistema infirio borraria la linea entre lo decidido y lo deducido.
* Y la correccion de Franco ELIMINO un modo de falla, no solo simplifico: la version anterior traia los cinco origenes, y como "Guardar Proyeccion" no retira lo ajeno, replasmar y volver a guardar contaba esa porcion DOS VECES. Con solo 'guardado', re-guardar retira exactamente esas filas. El aviso que documentaba ese riesgo se retiro entero por quedar sin sentido.
- Advertencia antes de escribir: cuenta cuantas celdas de K/O/S YA tienen monto, dice cuanto se pierde y cuanto va a quedar, pide SI/NO y respalda por la boveda. Sin conversion silenciosa de monedas: si una cuenta mezcla monedas o difiere de la del presupuesto, esa celda NO se escribe y se reporta.

v0.66.1 (2026-09-07) - El menu Dev deja de ofrecer dos botones que revientan al clic
- verificarPrecondicionesMirada y auditarBalanceFormulaMirada exigian argumentos que addItem() de Apps Script nunca provee: un clic terminaba en TypeError. Salen del submenu sin wrapper, porque "Diagnosticar (hoja DEBUG)" ya las corre con argumentos reales y vuelca mas detalle. Las funciones siguen enteras en el modulo.
- Diagnostico completo de Mirada Interanual con su tabla de desalineacion en HISTORIAL_DESARROLLO.md. El hallazgo que cambia la prioridad: la HOJA ya funciona, lo desalineado es el generador.

v0.66.0 (2026-09-07) - El changelog embebido deja de pesar en cada clic
! El literal "changelog" de este archivo guardaba 75 bloques de release, 155,8 KB: el 99% del archivo y el 5,73% de todo src/. Apps Script parsea el proyecto ENTERO en cada ejecucion -- cada apertura de menu, cada onEdit, cada boton --, y un template literal no es un comentario: se ASIGNA como constante en cada carga. Queda SOLO el release vigente, que es exactamente lo que el docstring de arriba viene prometiendo desde siempre ("solo refleja el release vigente"). El comentario dejo de mentir. Medido con el code-cache de V8 invalidado y las dos variantes ALTERNADAS en la misma corrida: compilar este archivo pasa de 0,49 ms a 0,031 ms (-94%), y el archivo de 161.726 bytes a unos 5 KB (-97%). Los bytes exactos se mueven con cada retoque del bloque vigente; el orden de magnitud no.
- Nadie consumia la historia: getChangelog() no lo llama ningun modulo de src/ ni ningun devtool. Era peso muerto que se pagaba en cada clic del usuario.
+ devtools/verificar_cobertura_changelog.py: antes de sacar una sola linea, comprueba que los 75 bloques del literal existan en src/ZZ_Changelog.js con la misma version y la misma fecha, y que el bloque de ZZ no sea un stub (menos de la mitad de largo). Verde con los 75, 0 sin cobertura, 0 flacos. Probado tambien en rojo: borrando de ZZ el bloque de v0.64.0 (EXIT 1, "FALTA 0.64.0") y vaciandole el cuerpo a v0.63.0 dejando el rotulo (EXIT 1, "FLACO 0.63.0, 3034 -> 69"). Queda como gate permanente Y CABLEADO: lo corre sync_targets.command antes de cada despliegue, junto a verificar_sintaxis.py. Un gate que nadie ejecuta no frena nada. Cableado probado en rojo (el deploy corta con EXIT 5 diciendo "gate del historial", antes de tocar la red) y en verde (el --dry-run sigue de largo hasta el drift-check).
- La regex con la que el verificador lee ZZ_Changelog.js indexaba 143 de los 144 bloques reales: exigia el guion pegado a la version y se le escapaba "[2026-06-05] v0.8.0 (mantenimiento) - ...". Inofensivo hoy, pero el modo de falla es el peor: un rojo que nombra mal la causa, mandando a portar historia que ya estaba portada. Corregida: 144.
* src/ZZ_Changelog.js NO se toca, y la decision es medida, no de tramite: es 100% comentario -- al sacarle los comentarios quedan 0 bytes --, y un comentario se lexea y se tira sin construir AST. Medido aca, en la misma corrida alternada: sus 373 KB cuestan 0,18 ms y los 157,9 KB del literal costaban 0,49 ms, o sea 0,0005 ms/KB contra 0,0031 ms/KB, 6,4 veces mas barato por KB pese a ser 2,4 veces mas grande. Ademas es el archivo con el que se mide el drift contra produccion y es el superconjunto que hace seguro este recorte: podar los dos a la vez dejaba la historia sin ninguna copia completa en el codigo.
- La identidad de un release en el verificador es (version, fecha) y no el titulo: cuatro releases (v0.39.1, v0.40.0, v0.42.0, v0.42.1) tienen el titulo reescrito entre las dos copias sin cambio de contenido, y exigir titulo identico daba cuatro rojos falsos.

Historial completo y canonico en: src/ZZ_Changelog.js
 `
};

/**
 * Obtiene la versión actual del sistema
 * @returns {string} Versión formateada
 */
function getVersion() {
 return VERSION.toString();
}

/**
 * Obtiene el changelog completo
 * @returns {string} Historial de cambios
 */
function getChangelog() {
 return VERSION.changelog;
}

/**
 * Muestra información de versión en log
 */
function logVersionInfo() {
 Logger.log('='.repeat(50));
 Logger.log('Tidetrack Personal Finance - Apps Script');
 Logger.log(`Versión: ${getVersion()}`);
 Logger.log(`Release: ${VERSION.releaseName}`);
 Logger.log(`Fecha: ${VERSION.releaseDate}`);
 Logger.log('='.repeat(50));
}
