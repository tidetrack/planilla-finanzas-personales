/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 *
 * @version 0.68.1
 * @since 0.1.0
 * @lastModified 2026-09-07
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 68,
 patch: 1,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-09-07',
 releaseName: 'v0.68.1 - La fila de meses y el grafico existen en la planilla',

 // decision Franco 2026-09-07: el literal guardaba 75 releases (155.8 KB, el 99% de este
 // archivo) mientras su propio docstring prometia "solo refleja el release vigente". Apps
 // Script parsea el proyecto entero en cada ejecucion y un template literal se asigna como
 // constante en cada carga, asi que ese texto se pagaba en cada clic. Queda el release
 // vigente y nada mas. La historia NO se pierde: vive completa en src/ZZ_Changelog.js, que
 // es comentario puro (el lexer lo descarta) y que devtools/verificar_cobertura_changelog.py
 // comprobo entrada por entrada -- 75 bloques, 0 sin cobertura, 0 stubs -- ANTES de podar.
 //
 // decision Franco 2026-09-07 (ronda de cobertura): el literal habia vuelto a acumular CINCO
 // bloques (v0.68.0, v0.67.1, v0.66.2, v0.66.1, v0.66.0). No fue una decision: los trajo el
 // merge con la sesion paralela, que sumo sus releases arriba sin que nadie evaluara el
 // invariante de v0.66.0. Se poda de nuevo a uno solo, que es lo que el docstring de abajo y
 // la decision de arriba vienen prometiendo. La poda NO pierde nada y eso esta MEDIDO, no
 // supuesto: verificar_cobertura_changelog.py comprobo los cinco bloques contra
 // src/ZZ_Changelog.js -- misma version, misma fecha, cuerpo real, 0 sin cobertura y 0 flacos
 // -- ANTES de sacarlos. La regla de fondo es la misma de siempre: ninguna linea sale de un
 // lugar sin estar comprobada en su destino. Y el gate queda cableado: con un solo bloque el
 // script sigue exigiendo que el release vigente tenga su entrada real en ZZ.
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
v0.68.1 (2026-09-07) - La fila de meses y el grafico existen en la planilla
* Registra la EJECUCION EN VIVO de v0.68.0 sobre la planilla productiva, y por eso es un release y no un comentario suelto: el bloque de v0.68.0 decia "PENDIENTE DE EJECUCION EN VIVO" y dejo de ser cierto en el momento en que se apreto el boton. Corregirlo sin subir la version habria dejado el repo y la planilla diciendo "0.68.0" con src/ distinto -- la cicatriz que el guard de despliegue de verificar_sintaxis.py existe para atajar, y que efectivamente lo atajo.
+ Corrido desde tidetrack Dev > Mirada Interanual > "1. Meses y grafico (G7:R7 + C14:R21)" sobre el commit e182593. La fila entro con separador ";" al PRIMER intento -- el orden nuevo de separadores de la ronda de robustez hizo lo que decia, y la corrida sana no dejo ni un logError -- y el toast informo "12/12 etiquetas verificadas".
+ Verificado aparte, no por lo que el script dice de si mismo: leyendo la hoja se midio G7:R7 = Enero, Febrero, Marzo, Abril, Mayo, Junio, Julio, Agosto, Septiembre, Octubre, Noviembre, Diciembre para I2=Mayo e I3=2026, con las cuatro filas de datos intactas valor por valor. K7 sigue mostrando "Mayo" y conservo el color del resaltado: PASTE_FORMULA cumplio.
+ EL GRAFICO SALIO CON LA ORIENTACION CORRECTA, la unica duda que no se podia cerrar en seco: meses en el eje X y las cuatro series en la leyenda (Ingresos, Gastos Fijos, Gastos Variables, Capitalizacion), lineas rectas, Capitalizacion en navy y mas gruesa. setMergeStrategy(MERGE_COLUMNS) + setTransposeRowsAndColumns(true) + setNumHeaders(1) + useFirstColumnAsDomain queda confirmada en vivo y no solo contra la referencia.
+ Idempotencia probada donde importa: la segunda corrida sobre la planilla real dejo UN solo grafico.
- Lo unico que no tomo es vAxis.format: el eje vertical muestra la moneda con decimales en vez de "#,##0". Estaba previsto -- esa opcion no figura en la referencia de opciones de charts de Apps Script y se enviaba como cinturon declarado. Es legible y se deja; si molesta, se quita la opcion y listo.
* FUNCIONALIDADES.md seccion 06 pasa "Tendencias (graficos)" de NO VERIFICABLE a FUNCIONA, y MAPA_HOJAS.md pone Mirada Interanual en Produccion. Los dos decian "pendiente de ejecutar en vivo".

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
