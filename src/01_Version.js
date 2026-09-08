/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 *
 * @version 0.68.0
 * @since 0.1.0
 * @lastModified 2026-09-07
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 68,
 patch: 0,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-09-07',
 releaseName: 'v0.68.0 - Mirada Interanual: meses con nombre y grafico de tendencias',

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
v0.68.0 (2026-09-07) - Mirada Interanual: meses con nombre y grafico de tendencias
+ Nueva entrada de menu Tidetrack Dev > Mirada Interanual > "1. Meses y grafico (G7:R7 + C14:R21)" (inicializarMesesYGraficoMirada, aridad cero). Escribe en G7:R7 el nombre del mes de cada columna, derivado del selector I2 (mes) e I3 (anio) con el offset contra K7 (la simulacion =I2 de Franco), y dibuja en C14:R21 un grafico de lineas rectas con las cuatro series de G8:R11: Ingresos, Gastos Fijos, Gastos Variables y Capitalizacion. Pedido textual de Franco del 2026-09-07.
+ construirFormulaMesMirada(sep): LET con mes_num / f_obj / nom_mes (ninguno colisiona con una funcion de Sheets), MATCH sobre SPLIT de MIRADA_MESES (la MISMA lista que la formula de datos: una sola verdad), EDATE con COLUMN()-COLUMN($K$7) y PROPER del nombre ("Septiembre", el estilo del selector). Sin array literals. Sufijo de anio en dos digitos ("Enero 27") cuando el anio del mes difiere de I3: la ventana movil de 12 meses casi siempre cruza dos anios calendario y un "Enero" bajo un selector que dice 2026 seria ambiguo. Gobernado por MIRADA_MESES_SUFIJO_ANIO = true con decision inline: en false la fila muestra solo el nombre.
+ _etiquetasMesesEsperadasMirada(mesRef, anioRef): gemela pura en JS de esa formula. Es la referencia contra la que se verifica el VALOR de cada celda de G7:R7 despues de escribir (getDisplayValues, celda a celda), nunca el texto de la formula. Insensible a mayusculas; lanza si el mes no es un mes o el anio no es entero entre 2000 y 2100.
+ Grafico: _especificacionGraficoMirada() (pura, probada sin SpreadsheetApp) fija los dos rangos C7:C11 + G7:R11, transponer filas/columnas, 1 encabezado, ancla C14, ultima celda R21, y las cuatro series con colores SOLO de la lista blanca del brandbook Ed.03: Ingresos verde #1D6A4F, Gastos Fijos rojo #B84A3E, Gastos Variables ambar #6B4A18, Capitalizacion navy #182040 con la linea mas gruesa (es la voz de la marca y la metrica que importa). _construirGraficoMirada la consume: Charts.ChartType.LINE, curveType none, leyenda arriba, sin titulo interno (la banda C13:R13 ya lo es), fondo #FFFFFF, eje vertical "#,##0" canonico, setMergeStrategy(MERGE_COLUMNS) explicito (el default, pero es el parametro que pega C7:C11 y G7:R11 lado a lado como 5 x 13 antes de transponer), tamano en pixeles medido en la hoja al correr (suma de anchos C..R por suma de altos 14..21, nunca hardcodeado). Semantica de addRange / setMergeStrategy / setTransposeRowsAndColumns / setNumHeaders / setPosition (1-indexed) / setOption confirmada en la referencia oficial de EmbeddedChartBuilder y citada en la decision inline.
+ Contrato de escritura completo en la entrada nueva: preflight por ROTULO (el de la vista mas C11 = Capitalizacion, C13 = Evolucion de Tendencias, K7 no vacia, grid hasta R21, I3 numerico), respaldo verificado de G7:R7 (formulas, valores, formatos y alineacion horizontal, repuesta via _alineacionRestaurableMirada: 'general*' vuelve como null = reset, y una alineacion no repuesta se informa como aviso aparte, nunca como restauracion no verificada), escritura en G7 probando los dos separadores (_escribirFormulaMiradaVerificada), replicacion con PASTE_FORMULA para no pisar el color del resaltado de K7, verificacion de VALOR contra las 12 etiquetas esperadas con restauracion verificada ante cualquier diferencia. El grafico se inserta PRIMERO y solo si quedo insertado y verificado (rangos y ancla releidos de sheet.getCharts()) se retiran los previos: si la insercion falla, el grafico anterior sobrevive. Idempotente: correrlo dos veces deja UN grafico.
* 07_MiradaInteranual.js re-alineado a la geometria REAL de la hoja, medida en vivo el 2026-09-07 (export de Drive del dia): selectores I2/I3/I4 (antes E4/F4/R4), fila de meses 7 (nueva), rotulos C8:C11 (antes C10:C12), Capitalizacion en la fila 11 (antes 14), offset contra $K$8 (antes $K$10), titulo del grafico C13 y zona C14:R21. La estructura coincide con el gemelo docs/permanente/celdas.tsv del 2026-08-18, con DOS diferencias medidas y no cosmeticas: en vivo I2 dice "Mayo" y el gemelo "Agosto", y en vivo G7:J7 y L7:R7 estan VACIAS mientras el gemelo guarda los numeros 1..12 (Franco los borro). Por eso la fila de meses es trabajo nuevo y no una reparacion, y por eso el gemelo no sirve como referencia de VALORES de la fila 7. Cada constante lleva "MEDIDO EN VIVO 2026-09-07"; las constantes quedan DENTRO del modulo (recomendacion del diagnostico v0.66.1: geometria de presentacion de una sola hoja, cardinalidad 1, fuera del archivo de mas alto riesgo). Todos los docstrings que nombraban G10:R14, E4/F4/R4 o la fila 14 quedan corregidos o marcados como historia del layout pre-Fix. Helpers puros extraidos para que el banco pruebe lo que corre y no una copia: _argumentosFormulaDatosMirada, _formulasResultadoMirada, _filaMesesMirada, _anioSelectorMirada.
* verificarPrecondicionesMirada verifica tambien el rotulo de C11 (es el nombre de una serie del grafico). Con la re-alineacion, el preflight que bloqueaba desde el rediseno Fix vuelve a pasar sobre la hoja real.
* Submenu reordenado (decision inline 2026-09-07): "1. Meses y grafico (G7:R7 + C14:R21)" es lo que FALTA en la hoja y va primero; "2. Reescribir formulas G8:R11 (hoy identicas)" es inicializarMiradaInteranual, hoy un no-op seguro porque la hoja ya guarda formulas IDENTICAS a las que construye el modulo (probado, no supuesto: banco T1); queda como camino de reparacion si alguien pisa el bloque a mano. "Diagnosticar (hoja DEBUG)" suma la fila de meses actual, las 12 etiquetas esperadas calculadas en JS y la formula de mes en sus dos separadores.
- RONDA DE ROBUSTEZ (2026-09-07), seis correcciones sobre el modulo, cada una con su decision inline: (1) el formato numerico de G7:R7 se fija ANTES del setFormula, igual que ya hacia la funcion hermana -- esas celdas tenian los numeros 1..12 y su formato pudo quedar en "Texto sin formato", donde Sheets guarda la formula como TEXTO y la muestra tal cual SIN dar error; ademas, si aun asi el estado queda en TEXTO, el aviso nombra la causa y el arreglo exacto en vez del generico "TEXTO: =LET(..."; (2) el orden de separadores pasa a ";" primero y "," de reintento: ";" es el MEDIDO en esta planilla, y arrancar por "," gastaba una escritura de prueba y dejaba un logError garantizado en cada corrida sana -- ruido que ensena a ignorar el log; (3) mergeStrategy era la unica clave de la spec sin guard y se indexa contra el enum: una clave equivocada no lanza, da undefined, y setMergeStrategy(undefined) pega los rangos con el default sin decir nada. Se valida en la spec y otra vez antes de usarla; (4) _graficosPropiosMirada reconoce el grafico propio por ancla O por contenido (los dos rangos de la spec): un grafico se arrastra con el mouse, y por ancla sola la segunda corrida no lo reconocia, insertaba otro sobre C14 y cantaba exito con DOS graficos de la misma cosa; (5) restaurarFila repone alineacion y contenido en dos try separados y ya no lanza: antes, si la restauracion del contenido lanzaba, el catch del llamador armaba el objeto de fallo con alineacionNoRepuesta: null, que en el resto del codigo significa "repuesta bien" -- un verde sobre algo que ni se habia intentado; (6) la etapa del grafico se parte en dos try (preparar / insertar): con uno solo, una excepcion al armar la spec o al medir dimensiones se reportaba como "EXCEPCION al insertar" y el aviso afirmaba "No habia grafico previo" sin haber mirado ninguno. previos === null es ahora un tercer estado, distinto de cero.
- El changelog dual y HISTORIAL_DESARROLLO.md decian que useFirstColumnAsDomain era un cinturon "no documentado" y quedan corregidos; la decision inline de _construirGraficoMirada ya lo decia bien. Es al reves y se verifico contra la referencia oficial de opciones de charts de Apps Script el 2026-09-07: useFirstColumnAsDomain SI figura ("If set to true, the chart will treat the column as the domain"), junto con legend.position, backgroundColor, colors, series, width y height. La que NO figura es vAxis.format: la referencia lista para vAxis solo direction, gridlines, logScale, maxValue, minValue, minorGridlines, textPosition, textStyle, title, titleTextStyle y viewWindow. vAxis.format se sigue enviando como cinturon -- no dana y los datos de G8:R11 ya estan en #,##0.00 --, pero el que se confirma mirando el eje en vivo es ese, no useFirstColumnAsDomain.
+ devtools/probar_mirada_meses_grafico.js, NUEVO banco node (sin red, sin SpreadsheetApp, RAIZ desde __dirname, modulo cargado del archivo real con vm.runInContext): T1 las formulas que arma el modulo para G8, G9, G10 y G11 son IDENTICAS a las del gemelo tras normalizar las comillas del nombre de hoja; T2 etiquetas esperadas en cinco casos mas seis entradas invalidas que lanzan; T3 la formula de mes en "," y ";" IDENTICA caracter a caracter a la formula dorada de la spec; T4 la especificacion del grafico con la PALETA extraida por regex de devtools/probar_shell.js y un color esperado por NOMBRE de serie; T4b _construirGraficoMirada EJECUTADO con un builder grabador; T4c dominio de la alineacion restaurable; T5 coherencia geometrica contra las constantes y contra los rotulos del gemelo; T6 el menu wirea la funcion nueva con aridad cero; T7 el banco se prueba a si mismo con sabotajes en memoria y exige que el chequeo que protege cada cosa FALLE.
+ T8 (ronda de cobertura): la ENTRADA DE MENU ENTERA ejecutada contra un DOBLE de hoja en memoria, en SIETE direcciones. Era el hueco mas grande del banco: preflight, respaldo, escritura, verificacion de valor, restauracion y grafico no tenian un solo chequeo -- las piezas estaban probadas y la orquestacion no. El doble reproduce la geometria medida (I2 "Mayo", I3 2026 numerico, K7 con =I2, G7:J7 y L7:R7 vacias, rotulos C8:C11 y C13, G8:R11 con formula y valor, grid 883 x 20) y hace tres cosas que lo vuelven una prueba y no un decorado: EVALUA las formulas con un mini-interprete propio que acepta UNICAMENTE ";" (una coma fuera de comillas es parse error, o sea la trampa de locale de verdad, y asi lo que se verifica es el VALOR de la celda y no el texto de la formula); modela la celda en "@" guardando la formula como TEXTO sin error; y hace LANZAR a setHorizontalAlignment(s) ante cualquier valor fuera de 'left'|'center'|'right'|'normal'|null, como el setter real. Las siete direcciones: (a) verde -- doce meses correctos, un chart en (14,3) con los dos rangos, logSuccess una vez, K7 conserva color y formato (PASTE_FORMULA); (b) dos corridas seguidas dejan UN grafico; (c) preflight en rojo por cuatro causas distintas (C11, C13, K7 vacia, I3 texto) con CERO escrituras MEDIDAS y la causa nombrada; (d) G7 en "@": la fila nunca queda mostrando el texto de la formula, y se acepta cualquiera de las dos salidas legitimas (neutralizar el formato y escribir, que es la que el modulo eligio, o abortar nombrando el formato y restaurar); (e) insertChart lanza: la fila queda escrita y los graficos previos SOBREVIVEN; (f) el chart sale con rangos equivocados: se retira EL NUEVO y el previo queda; (g) la celda devuelve #REF!: no se canta exito, G7:R7 vuelve EXACTAMENTE a como estaba y el grafico previo no se toca.
+ Tres sabotajes nuevos en T7, uno por cada comportamiento que T8 estrena: M30 revierte el fix de alineacion a su forma cruda (T8 g cae), M31 hace que el preflight deje de bloquear (T8 c cae) y M32 quita el retiro de los graficos previos (T8 b cae). El de alineacion es el que faltaba de verdad: sin guard, revertir su unico callsite dejaba los chequeos en verde y el helper como codigo muerto.
* El literal changelog de 01_Version.js vuelve a UN solo bloque. El merge con la sesion paralela lo habia dejado con cinco (v0.68.0, v0.67.1, v0.66.2, v0.66.1, v0.66.0), rompiendo sin querer el invariante que v0.66.0 establecio y que el docstring del propio literal promete. La poda no pierde nada y esta medida: devtools/verificar_cobertura_changelog.py comprobo los cinco contra src/ZZ_Changelog.js (misma version, misma fecha, cuerpo real; 0 sin cobertura, 0 flacos) ANTES de sacarlos.
* PENDIENTE DE EJECUCION EN VIVO: este release deja el codigo listo y probado en seco; la fila G7:R7 y el grafico C14:R21 se generan recien al correr Tidetrack Dev > Mirada Interanual > "1. Meses y grafico (G7:R7 + C14:R21)" en la planilla real, despues del deploy. Ese boton pisa la simulacion =I2 de K7 con la formula real (K7 sigue mostrando el mes de referencia). Lo que Franco tiene que mirar despues: G7:R7 con los 12 nombres, K7 igual al selector I2, y en C14:R21 un grafico con cuatro lineas y la leyenda Ingresos / Gastos Fijos / Gastos Variables / Capitalizacion sobre el eje X de meses (si sale al reves, el ajuste es una linea en _construirGraficoMirada).


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
