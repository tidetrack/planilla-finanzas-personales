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
+ Grafico: _especificacionGraficoMirada() (pura, probada sin SpreadsheetApp) fija los dos rangos C7:C11 + G7:R11, transponer filas/columnas, 1 encabezado, ancla C14, ultima celda R21, y las cuatro series con colores SOLO de la lista blanca del brandbook Ed.03: Ingresos verde #1D6A4F, Gastos Fijos rojo #B84A3E, Gastos Variables ambar #6B4A18, Capitalizacion navy #182040 con la linea mas gruesa (es la voz de la marca y la metrica que importa). _construirGraficoMirada la consume: Charts.ChartType.LINE, curveType none, leyenda arriba, sin titulo interno (la banda C13:R13 ya lo es), fondo #FFFFFF, eje vertical "#,##0" canonico (enviado como cinturon: vAxis.format no figura en la referencia de opciones de Apps Script, se confirma mirando el eje en vivo), setMergeStrategy(MERGE_COLUMNS) explicito (el default, pero es el parametro que pega C7:C11 y G7:R11 lado a lado como 5 x 13 antes de transponer), tamano en pixeles medido en la hoja al correr (suma de anchos C..R por suma de altos 14..21, nunca hardcodeado). Semantica de addRange / setMergeStrategy / setTransposeRowsAndColumns / setNumHeaders / setPosition (1-indexed) / setOption confirmada en la referencia oficial de EmbeddedChartBuilder y citada en la decision inline.
+ Contrato de escritura completo en la entrada nueva: preflight por ROTULO (el de la vista mas C11 = Capitalizacion, C13 = Evolucion de Tendencias, K7 no vacia, grid hasta R21, I3 numerico), respaldo verificado de G7:R7 (formulas, valores, formatos y alineacion horizontal, repuesta via _alineacionRestaurableMirada: 'general*' vuelve como null = reset, y una alineacion no repuesta se informa como aviso aparte, nunca como restauracion no verificada), escritura en G7 probando "," y ";" (_escribirFormulaMiradaVerificada), replicacion con PASTE_FORMULA para no pisar el color del resaltado de K7, verificacion de VALOR contra las 12 etiquetas esperadas con restauracion verificada ante cualquier diferencia. El grafico se inserta PRIMERO y solo si quedo insertado y verificado (rangos y ancla releidos de sheet.getCharts()) se retiran los previos anclados en C14: si la insercion falla, el grafico anterior sobrevive. Idempotente: correrlo dos veces deja UN grafico.
* 07_MiradaInteranual.js re-alineado a la geometria REAL de la hoja, medida en vivo el 2026-09-07 (export de Drive del dia, coincidente con el gemelo celdas.tsv del 2026-08-18): selectores I2/I3/I4 (antes E4/F4/R4), fila de meses 7 (nueva), rotulos C8:C11 (antes C10:C12), Capitalizacion en la fila 11 (antes 14), offset contra $K$8 (antes $K$10), titulo del grafico C13 y zona C14:R21. Cada constante lleva "MEDIDO EN VIVO 2026-09-07"; las constantes quedan DENTRO del modulo (recomendacion del diagnostico v0.66.1: geometria de presentacion de una sola hoja, cardinalidad 1, fuera del archivo de mas alto riesgo). Todos los docstrings que nombraban G10:R14, E4/F4/R4 o la fila 14 quedan corregidos o marcados como historia del layout pre-Fix. Helpers puros extraidos para que el banco pruebe lo que corre y no una copia: _argumentosFormulaDatosMirada, _formulasResultadoMirada, _filaMesesMirada, _anioSelectorMirada.
* verificarPrecondicionesMirada verifica tambien el rotulo de C11 (es el nombre de una serie del grafico). Con la re-alineacion, el preflight que bloqueaba desde el rediseno Fix vuelve a pasar sobre la hoja real.
* Submenu reordenado (decision inline 2026-09-07): "1. Meses y grafico (G7:R7 + C14:R21)" es lo que FALTA en la hoja y va primero; "2. Reescribir formulas G8:R11 (hoy identicas)" es inicializarMiradaInteranual, hoy un no-op seguro porque la hoja ya guarda formulas IDENTICAS a las que construye el modulo (probado, no supuesto: banco T1); queda como camino de reparacion si alguien pisa el bloque a mano. "Diagnosticar (hoja DEBUG)" suma la fila de meses actual, las 12 etiquetas esperadas calculadas en JS y la formula de mes en sus dos separadores.
+ devtools/probar_mirada_meses_grafico.js, NUEVO banco node (sin red, sin SpreadsheetApp, RAIZ desde __dirname, modulo cargado del archivo real con vm.runInContext): T1 las formulas que arma el modulo para G8, G9, G10 y G11 son IDENTICAS a las del gemelo tras normalizar las comillas del nombre de hoja; T2 etiquetas esperadas en cinco casos (Mayo/Agosto/Enero/Diciembre 2026 y MAYO en mayusculas) mas seis entradas invalidas que lanzan; T3 la formula de mes en "," y ";" IDENTICA caracter a caracter a la formula dorada de la spec (mas balance, referencias derivadas de las constantes, ninguna referencia vieja, sin "{", sin el otro separador fuera de comillas, nombres de LET fuera de la lista de funciones de Sheets, los 12 meses presentes); T4 la especificacion del grafico con la PALETA extraida por regex de devtools/probar_shell.js y un color esperado por NOMBRE de serie; T4b _construirGraficoMirada EJECUTADO con un builder grabador (rangos, merge, transponer, encabezados, ancla y opciones iguales a la spec); T4c dominio de la alineacion restaurable; T5 coherencia geometrica contra las constantes y contra los rotulos del gemelo; T6 el menu wirea la funcion nueva con aridad cero; T7 el banco se prueba a si mismo con siete sabotajes en memoria (geometria pre-Fix, formula de mes con sufijo o offset cambiados, constructor que ignora la spec, swap de colores) y exige que el chequeo que protege cada cosa FALLE. 171 chequeos en verde; los cinco gates existentes (verificar_sintaxis, verificar_cobertura_changelog, probar_carga_apps_script, probar_claves_duplicadas, verificar_menu_mirada) en exit 0.
! PENDIENTE DE EJECUCION EN VIVO: este release deja el codigo listo y probado en seco; la fila G7:R7 y el grafico C14:R21 se generan recien al correr Tidetrack Dev > Mirada Interanual > "1. Meses y grafico (G7:R7 + C14:R21)" en la planilla real, despues del deploy. Ese boton pisa la simulacion =I2 de K7 con la formula real (K7 sigue mostrando el mes de referencia). Lo que Franco tiene que mirar despues: G7:R7 con los 12 nombres, K7 igual al selector I2, y en C14:R21 un grafico con cuatro lineas y la leyenda Ingresos / Gastos Fijos / Gastos Variables / Capitalizacion sobre el eje X de meses (si sale al reves, el ajuste es una linea en _construirGraficoMirada).

v0.67.1 (2026-09-07) - Plasmar avisa mejor, y llega el limpiador de Monto a Proyectar
+ El mensaje de "nada que plasmar" distingue el mes SIN NINGUNA fila en Proyeccion del mes CON filas de otro origen (shell, recurrentes, presupuesto base, otros): cuenta cada origen y nombra la ruta real de menu para generar lo que falta. El sintoma real de Franco: agosto tenia 64 filas de presupuesto base y el mensaje viejo no lo decia, aunque era tecnicamente correcto.
+ Boton nuevo "Presupuesto: limpiar Monto a Proyectar" (aplicarPresupuestoLimpiar, sin parametros, asignable a un dibujo): vacia K/O/S, cuenta cuantas celdas tienen monto y por cuanto antes de borrar, verifica por relectura y revierte protegiendo una edicion posterior. Modulo nuevo DEVTOOL_PresupuestoLimpiar.js.
* Plasmar deja de correr derecho sin dialogo cuando no pisa nada: la confirmacion sigue apareciendo (nunca se elimina), pero deja de hablar de sobreescritura o de perdida cuando no hay ninguna.

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
