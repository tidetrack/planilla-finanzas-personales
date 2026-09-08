/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 *
 * @version 0.67.0
 * @since 0.1.0
 * @lastModified 2026-09-07
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 67,
 patch: 0,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-09-07',
 releaseName: 'v0.67.0 - Mirada Interanual: meses con nombre y grafico de tendencias',

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
v0.67.0 (2026-09-07) - Mirada Interanual: meses con nombre y grafico de tendencias
+ Nueva entrada de menu Tidetrack Dev > Mirada Interanual > "1. Meses y grafico (G7:R7 + C14:R21)" (inicializarMesesYGraficoMirada, aridad cero). Escribe en G7:R7 el nombre del mes de cada columna, derivado del selector I2 (mes) e I3 (anio) con el offset contra K7 (la simulacion =I2 de Franco), y dibuja en C14:R21 un grafico de lineas rectas con las cuatro series de G8:R11: Ingresos, Gastos Fijos, Gastos Variables y Capitalizacion. Pedido textual de Franco del 2026-09-07.
+ construirFormulaMesMirada(sep): LET con mes_num / f_obj / nom_mes (ninguno colisiona con una funcion de Sheets), MATCH sobre SPLIT de MIRADA_MESES (la MISMA lista que la formula de datos: una sola verdad), EDATE con COLUMN()-COLUMN($K$7) y PROPER del nombre ("Septiembre", el estilo del selector). Sin array literals. Sufijo de anio en dos digitos ("Enero 27") cuando el anio del mes difiere de I3: la ventana movil de 12 meses casi siempre cruza dos anios calendario y un "Enero" bajo un selector que dice 2026 seria ambiguo. Gobernado por MIRADA_MESES_SUFIJO_ANIO = true con decision inline: en false la fila muestra solo el nombre.
+ _etiquetasMesesEsperadasMirada(mesRef, anioRef): gemela pura en JS de esa formula. Es la referencia contra la que se verifica el VALOR de cada celda de G7:R7 despues de escribir (getDisplayValues, celda a celda), nunca el texto de la formula. Insensible a mayusculas; lanza si el mes no es un mes o el anio no es entero entre 2000 y 2100.
+ Grafico: _especificacionGraficoMirada() (pura, probada sin SpreadsheetApp) fija los dos rangos C7:C11 + G7:R11, transponer filas/columnas, 1 encabezado, ancla C14, ultima celda R21, y las cuatro series con colores SOLO de la lista blanca del brandbook Ed.03: Ingresos verde #1D6A4F, Gastos Fijos rojo #B84A3E, Gastos Variables ambar #6B4A18, Capitalizacion navy #182040 con la linea mas gruesa (es la voz de la marca y la metrica que importa). _construirGraficoMirada la consume: Charts.ChartType.LINE, curveType none, leyenda arriba, sin titulo interno (la banda C13:R13 ya lo es), fondo #FFFFFF, eje vertical "#,##0" canonico (enviado como cinturon: vAxis.format no figura en la referencia de opciones de Apps Script, se confirma mirando el eje en vivo), setMergeStrategy(MERGE_COLUMNS) explicito (el default, pero es el parametro que pega C7:C11 y G7:R11 lado a lado como 5 x 13 antes de transponer), tamano en pixeles medido en la hoja al correr (suma de anchos C..R por suma de altos 14..21, nunca hardcodeado). Semantica de addRange / setMergeStrategy / setTransposeRowsAndColumns / setNumHeaders / setPosition (1-indexed) / setOption confirmada en la referencia oficial de EmbeddedChartBuilder y citada en la decision inline.
+ Contrato de escritura completo en la entrada nueva: preflight por ROTULO (el de la vista mas C11 = Capitalizacion, C13 = Evolucion de Tendencias, K7 no vacia, grid hasta R21, I3 numerico), respaldo verificado de G7:R7 (formulas, valores, formatos y alineacion horizontal, repuesta via _alineacionRestaurableMirada: 'general*' vuelve como null = reset, y una alineacion no repuesta se informa como aviso aparte, nunca como restauracion no verificada), escritura en G7 probando "," y ";" (_escribirFormulaMiradaVerificada), replicacion con PASTE_FORMULA para no pisar el color del resaltado de K7, verificacion de VALOR contra las 12 etiquetas esperadas con restauracion verificada ante cualquier diferencia. El grafico se inserta PRIMERO y solo si quedo insertado y verificado (rangos y ancla releidos de sheet.getCharts()) se retiran los previos anclados en C14: si la insercion falla, el grafico anterior sobrevive. Idempotente: correrlo dos veces deja UN grafico.
* 07_MiradaInteranual.js re-alineado a la geometria REAL de la hoja, medida en vivo el 2026-09-07 (export de Drive del dia, coincidente con el gemelo celdas.tsv del 2026-08-18): selectores I2/I3/I4 (antes E4/F4/R4), fila de meses 7 (nueva), rotulos C8:C11 (antes C10:C12), Capitalizacion en la fila 11 (antes 14), offset contra $K$8 (antes $K$10), titulo del grafico C13 y zona C14:R21. Cada constante lleva "MEDIDO EN VIVO 2026-09-07"; las constantes quedan DENTRO del modulo (recomendacion del diagnostico v0.66.1: geometria de presentacion de una sola hoja, cardinalidad 1, fuera del archivo de mas alto riesgo). Todos los docstrings que nombraban G10:R14, E4/F4/R4 o la fila 14 quedan corregidos o marcados como historia del layout pre-Fix. Helpers puros extraidos para que el banco pruebe lo que corre y no una copia: _argumentosFormulaDatosMirada, _formulasResultadoMirada, _filaMesesMirada, _anioSelectorMirada.
* verificarPrecondicionesMirada verifica tambien el rotulo de C11 (es el nombre de una serie del grafico). Con la re-alineacion, el preflight que bloqueaba desde el rediseno Fix vuelve a pasar sobre la hoja real.
* Submenu reordenado (decision inline 2026-09-07): "1. Meses y grafico (G7:R7 + C14:R21)" es lo que FALTA en la hoja y va primero; "2. Reescribir formulas G8:R11 (hoy identicas)" es inicializarMiradaInteranual, hoy un no-op seguro porque la hoja ya guarda formulas IDENTICAS a las que construye el modulo (probado, no supuesto: banco T1); queda como camino de reparacion si alguien pisa el bloque a mano. "Diagnosticar (hoja DEBUG)" suma la fila de meses actual, las 12 etiquetas esperadas calculadas en JS y la formula de mes en sus dos separadores.
+ devtools/probar_mirada_meses_grafico.js, NUEVO banco node (sin red, sin SpreadsheetApp, RAIZ desde __dirname, modulo cargado del archivo real con vm.runInContext): T1 las formulas que arma el modulo para G8, G9, G10 y G11 son IDENTICAS a las del gemelo tras normalizar las comillas del nombre de hoja; T2 etiquetas esperadas en cinco casos (Mayo/Agosto/Enero/Diciembre 2026 y MAYO en mayusculas) mas seis entradas invalidas que lanzan; T3 la formula de mes en "," y ";" IDENTICA caracter a caracter a la formula dorada de la spec (mas balance, referencias derivadas de las constantes, ninguna referencia vieja, sin "{", sin el otro separador fuera de comillas, nombres de LET fuera de la lista de funciones de Sheets, los 12 meses presentes); T4 la especificacion del grafico con la PALETA extraida por regex de devtools/probar_shell.js y un color esperado por NOMBRE de serie; T4b _construirGraficoMirada EJECUTADO con un builder grabador (rangos, merge, transponer, encabezados, ancla y opciones iguales a la spec); T4c dominio de la alineacion restaurable; T5 coherencia geometrica contra las constantes y contra los rotulos del gemelo; T6 el menu wirea la funcion nueva con aridad cero; T7 el banco se prueba a si mismo con siete sabotajes en memoria (geometria pre-Fix, formula de mes con sufijo o offset cambiados, constructor que ignora la spec, swap de colores) y exige que el chequeo que protege cada cosa FALLE. 171 chequeos en verde; los cinco gates existentes (verificar_sintaxis, verificar_cobertura_changelog, probar_carga_apps_script, probar_claves_duplicadas, verificar_menu_mirada) en exit 0.
! PENDIENTE DE EJECUCION EN VIVO: este release deja el codigo listo y probado en seco; la fila G7:R7 y el grafico C14:R21 se generan recien al correr Tidetrack Dev > Mirada Interanual > "1. Meses y grafico (G7:R7 + C14:R21)" en la planilla real, despues del deploy. Ese boton pisa la simulacion =I2 de K7 con la formula real (K7 sigue mostrando el mes de referencia). Lo que Franco tiene que mirar despues: G7:R7 con los 12 nombres, K7 igual al selector I2, y en C14:R21 un grafico con cuatro lineas y la leyenda Ingresos / Gastos Fijos / Gastos Variables / Capitalizacion sobre el eje X de meses (si sale al reves, el ajuste es una linea en _construirGraficoMirada).

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
