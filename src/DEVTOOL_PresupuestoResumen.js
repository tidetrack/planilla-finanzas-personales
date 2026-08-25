/**
 * DEVTOOL_PresupuestoResumen.js
 * Segunda etapa de la hoja "Presupuesto": el agrupado por categoria (columnas V y W), el rotulo
 * del mes de referencia en la Tabla 1 (C9) y la correccion del bug de copiar-pegar en la Tabla 2
 * (F19:F21).
 *
 * [CONCEPTO DE NEGOCIO]
 * La etapa 1 (DEVTOOL_PresupuestoModo.js, v0.45.0/v0.45.1, ya desplegada) cablea J/N/R: el monto
 * de CADA CUENTA segun el modo de E7. Esta etapa contesta la pregunta de un nivel mas arriba:
 * "en que categoria se me va la plata" y "cuanto me queda". Para eso agrupa esos mismos montos
 * por la categoria de cada cuenta (Plan de Cuentas) y alimenta las dos tablas resumen que ya
 * existian con formula pero sumaban sobre un rango vacio (daban $0,00 porque nada las llenaba).
 * No tiene logica de formulerio propia: es agrupar, nada mas (decision Franco 2026-08-24,
 * docs/permanente/DISENO_HOJA_PRESUPUESTO.md).
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: preflight por ROTULO, respaldo congelado y releido antes de mutar,
 * verificacion del VALOR resultante (invariante independiente, no solo del texto), reversion
 * completa. Reusa la geometria, la lectura del modo (_condModoHistoricoPm) y los selectores YA
 * medidos y desplegados por DEVTOOL_PresupuestoModo.js -- no se redeclara nada de eso aca.
 *
 * ============================================================================
 * DESCUBRIMIENTO: NO ES "LA COLUMNA V", SON DOS COLUMNAS (V Y W)
 * ============================================================================
 * El encargo original (docs/permanente/DISENO_HOJA_PRESUPUESTO.md, seccion "La columna V") habla
 * de UNA sola columna agrupada que cambiaria de fuente segun el modo. Medido en vivo contra
 * docs/permanente/celdas.tsv (snapshot 2026-08-18) antes de escribir una sola formula, la
 * geometria real de la hoja es OTRA: hay DOS columnas de agrupado, con titulos estaticos que YA
 * estan puestos y DOS celdas de total que YA tienen formula, esperando contenido:
 *
 *   V7 = "Monto \nHistórico"   V8 = SUM(V9:V)   <- espeja el titulo de J7/N7/R7 (la columna "modo")
 *   W7 = "Monto Proyectado"    W8 = SUM(W9:W)   <- espeja el titulo de K7/O7/S7 ("Monto a Proyectar")
 *
 * Y las DOS tablas resumen ya apuntan cada una a SU propio total, no al mismo:
 *
 *   Tabla 1 "Movimientos Promedio históricos." (C9:F14): E11=J8, E12=N8, E13=R8, E14=V8
 *   Tabla 2 "Presupuesto del Mes." (C16:F21):            E18=K8, E19=O8, E20=S8, E21=W8
 *
 * Osea: la Tabla 1 (que muestra el monto que cambia con el modo) cierra con V8 -- el agrupado de
 * J/N/R, el mismo par modo-dependiente que sus otras tres filas. La Tabla 2 (que muestra "Monto a
 * Proyectar", SIEMPRE K/O/S, sea cual sea el modo) cierra con W8 -- el agrupado de K/O/S. Cada
 * tabla se explica sola con SU columna; ninguna tabla mezcla fuentes.
 *
 * Por eso este modulo construye AMBAS columnas, cada una con una fuente FIJA (V siempre agrupa
 * J/N/R, W siempre agrupa K/O/S) -- ninguna de las dos cambia de fuente segun el modo por su
 * cuenta: el modo ya esta resuelto adentro de J/N/R (v0.45.0), y V simplemente re-parte ese
 * resultado por categoria. Esto es ademas la unica lectura consistente con la frase del propio
 * encargo "en el modo proyectado suma desde 'Monto a Proyectar'" -- esa frase describe a W, que
 * SIEMPRE suma desde K/O/S, tal cual dice.
 *
 * CONSECUENCIA sobre el invariante que proponia el encargo ("V8 debe ser igual a K8-O8-S8"): con
 * la geometria real, esa igualdad es la de W8, no la de V8. El invariante que este modulo verifica
 * es el par correcto y mas fuerte -- vale en los DOS modos, no solo en Proyeccion, porque V/W no
 * miran el modo, solo re-parten lo que J/N/R/K/O/S ya tienen calculado:
 *
 *   V8 = J8 - N8 - R8      (siempre, en los dos modos)
 *   W8 = K8 - O8 - S8      (siempre, independiente del modo)
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @see DEVTOOL_PresupuestoModo.js
 *
 * ============================================================================
 * EL SIGNO: VERIFICADO CONTRA LA FORMULA VIVA DEL TABLERO ANTES DE CONSTRUIR
 * ============================================================================
 * El encargo pedia confirmar la convencion de signo contra el bloque "Categorias." del Tablero
 * antes de asumir nada. Medido: docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json (gemelo
 * digital) trae la formula viva de esa celda (hoy Tablero!AA10, en el snapshot todavia AA9 --
 * corrida de fila del 2026-08-21, ver DEVTOOL_BloqueCategorias.js). La primera linea del LET:
 *
 *   monto_neto; ARRAYFORMULA(IF(AJ6:AJ=""; 0; IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ)))
 *
 * Un "Egreso" resta, un "Ingreso" suma -- y ese monto_neto (con signo) es lo que despues se agrupa
 * por categoria via QUERY...SUM. Confirmado: la convencion es por NATURALEZA del movimiento
 * (Ingreso positivo, Egreso negativo), no por bloque de la Tabla del Plan de Cuentas.
 *
 * Esta hoja no tiene, celda por celda, un "Tipo" de movimiento -- I/M/Q son ESPEJOS DE BLOQUE (el
 * bloque Ingresos del Plan de Cuentas SOLO tiene cuentas de ingreso; Gastos Fijos y Variables
 * SOLO cuentas de egreso). El bloque de origen reemplaza al "Tipo" como portador del signo: una
 * cuenta espejada desde I (Ingresos) suma, una espejada desde M o Q (Gastos) resta. Es la MISMA
 * convencion del Tablero expresada con el dato que esta hoja realmente tiene disponible, no una
 * alternativa inventada.
 *
 * ============================================================================
 * EL MES DE REFERENCIA EN C9 (Tabla 1)
 * ============================================================================
 * Franco: "en el cuadro C9:F14 deberia decir el mes de referencia". El rotulo se escribe en C9
 * -- el titulo de la Tabla 1 ("Movimientos Promedio históricos.") -- y NO en una celda nueva,
 * por dos razones medidas antes de decidir:
 *   1. C9 es un candidato SIEMPRE valido: si esta combinada (fusionando C9 con las columnas de al
 *      lado para centrar el titulo, un patron ya visto en otras hojas de este repo), C9 es el
 *      ANCLA de esa combinada -- la unica celda de un merge en la que escribir con setFormula()
 *      hace algo. Elegir una celda NUEVA (D9, G9...) hubiera exigido primero confirmar en vivo
 *      que esa celda ni es la mitad muda de otra combinada ni esta ocupada por otra cosa --
 *      exactamente el tipo de suposicion sobre geometria no medida que este repo ya pago caro
 *      (celdas.tsv es un snapshot del 2026-08-18, stale por definicion).
 *   2. El propio pedido dice "que lo diga", no "que lo diga en una celda aparte": ampliar el
 *      titulo existente con el mes de referencia es la forma minima de cumplirlo sin inventar
 *      geometria nueva no pedida.
 * El preflight (paso 5) verifica que C9 no sea la mitad muda de una combinada ajena antes de
 * escribir -- el mismo guard que ya usa DEVTOOL_PresupuestoModo.js para E7.
 *
 * En Proyeccion: "Movimientos Promedio históricos. (<mes calendario anterior a J2/J3>)".
 * En Historico: "Movimientos Promedio históricos. (<mes-5> - <mes>)", la ventana completa de
 * PM_MESES_HISTORICO=6 meses que informa el promedio ponderado. Se deriva del selector (E7,
 * J2, J3) en cada recalculo -- nunca un texto fijo -- reusando _fragmentoMesRefPm() y
 * _condModoHistoricoPm() de DEVTOOL_PresupuestoModo.js verbatim.
 *
 * ============================================================================
 * EL BUG DE F19:F21 (Tabla 2)
 * ============================================================================
 * Franco, textual: "Tabla 2: Debe filtrar por E18. Es un error de copiar-pegar". Medido
 * (celdas.tsv): F19/F20/F21 son "=IFERROR(E19/$E$11;0)" (y F20/F21 analogas) -- dividen por
 * $E$11, el Ingresos de la TABLA 1, en vez de $E$18, el Ingresos de su propia tabla. La correccion
 * es cirugia de token (mismo patron que _repararRangoTipoBcat en DEVTOOL_BloqueCategorias.js):
 * se reusa la formula viva completa y se reemplaza SOLO el token "$E$11" por "$E$18", nunca se
 * reescribe la formula entera de memoria.
 *
 * QUE NO HACE
 * 1. NO toca J/N/R/K/O/S ni sus titulos (J7/N7/R7): son de DEVTOOL_PresupuestoModo.js.
 * 2. NO toca "Guardar Proyeccion": encargo posterior segun el contrato de diseno.
 * 3. NO toca el ledger, el Plan de Cuentas, la BD de Proyeccion, Inicio ni el Tablero.
 *
 * Reusa de DEVTOOL_PresupuestoModo.js: PM_MODO, PM_SELECTORES, PM_BLOQUES, PM_CLAVES_BLOQUE,
 * PM_FILA_INI, PM_FILA_FIN, PM_FILA_TOTAL, PM_MESES_HISTORICO, PM_UMBRAL_IDENTIDAD, _absPm,
 * _condModoHistoricoPm, _fragmentoMesRefPm, _mesRefDesdeSelectoresPm, _entradaEscritaPm,
 * _revertirEscriturasPm, _respaldarPm (respalda TODA "Presupuesto", no solo sus propias celdas).
 * Reusa de DEVTOOL_StockYFlujo.js: _refHoja, _canonizarFormula, _verificarEscrituraSyf. Reusa de
 * DEVTOOL_FormulerioV0111.js: _errorDeCelda, _rotulosCompatibles, _leerRespaldoFormulerio.
 *
 * ============================================================================
 * EL FRENO DE v0.46.0 EN LA PLANILLA REAL, Y LA CORRECCION (v0.46.1)
 * ============================================================================
 * Franco desplego v0.46.0 y corrio "1. Ver estado": el preflight freno solo, sin escribir nada
 * ("W7 dice 'Monto a Proyectar' y se esperaba 'Monto Proyectado'"). Correcto: mejor abortar que
 * escribir sobre una hoja que el modulo no entendia bien.
 *
 * Medido en vivo por Franco (con el modo en "Historico"), el patron es uniforme en los CUATRO
 * bloques -- Ingresos, Gastos Fijos, Gastos Variables Y Categorias -- de tres columnas: nombre,
 * una columna que SIGUE AL MODO, y una columna FIJA:
 *
 *   Ingresos:          I7 "Ingresos."           J7 "Monto Historico" (sigue al modo)   K7 "Monto a Proyectar" (fijo)
 *   Gastos Fijos:       M7 "Gastos Fijos."       N7 "Monto Historico" (sigue al modo)   O7 "Monto a Proyectar" (fijo)
 *   Gastos Variables:   Q7 "Gastos Variables."   R7 "Monto Historico" (sigue al modo)   S7 "Monto a Proyectar" (fijo)
 *   Categorias:         U7 "Categorias."         V7 "Monto Historico" (sigue al modo)   W7 "Monto a Proyectar" (fijo)
 *
 * DOS ERRORES, NO UNO. El preflight solo reporto el segundo (el primero no llego a evaluarse
 * porque el chequeo de W7 aborto antes):
 *   1. V7 se trataba como un rotulo ESTATICO ('Monto Histórico', comparado por preflight, nunca
 *      escrito). Es DINAMICO -- sigue al modo exactamente igual que J7/N7/R7. La v0.46.0 nunca
 *      lo hubiera actualizado si Franco cambiaba E7 despues de aplicar.
 *   2. W7 se esperaba como 'Monto Proyectado'. El texto real es 'Monto a Proyectar' -- EL MISMO
 *      texto exacto que K7/O7/S7, no una variante.
 *
 * LA CAUSA DE LOS DOS: se midio contra docs/permanente/celdas.tsv, un snapshot commiteado del
 * 2026-08-18 que quedo viejo -- la cicatriz numero uno de este repo ("no fiarse de una geometria
 * memorizada"). Para un rotulo que OTRO modulo hace dinamico (V7, que sigue a J7/N7/R7 via
 * DEVTOOL_PresupuestoModo.js), un snapshot es especialmente traicionero: captura el texto de un
 * modo puntual (aca, "Historico") y lo hace pasar por una constante fija.
 *
 * EL FIX: V7 pasa a ESCRIBIRSE con _formulaTituloMontoPm() de DEVTOOL_PresupuestoModo.js,
 * REUSADA VERBATIM (nunca una segunda implementacion del mismo titulo) -- ver _planPc. Ya no
 * tiene una constante de texto esperado en el preflight (mismo criterio que J7/N7/R7 en
 * DEVTOOL_PresupuestoModo.js: la idempotencia la resuelve la comparacion de formulas de _planPc,
 * no un rotulo-chequeo). W7 pasa a compararse contra PC_TITULO_PROYECTAR -- LA MISMA constante
 * que ya usa el chequeo de K7/O7/S7 -- en vez de una segunda constante con un valor "parecido"
 * pero distinto: es el mismo texto en cuatro celdas, y una segunda constante para el mismo dato
 * es exactamente el patron que produjo este bug.
 *
 * CONFIRMADO ANTES DE APLICAR: este modulo sigue sin escribir K/O/S en ningun punto -- Franco ya
 * empezo a cargar "Monto a Proyectar" a mano (K8 muestra $1.000.000,00 en la planilla real) y el
 * plan de este modulo no toca esa columna.
 *
 * @see DEVTOOL_PresupuestoModo.js
 * @version 0.46.1
 * @since 2026-08-24
 * @lastModified 2026-08-24
 */

// ============================================
// GEOMETRIA (medida contra docs/permanente/celdas.tsv -- snapshot 2026-08-18 -- el preflight
// vuelve a medir todo contra la planilla viva antes de escribir una sola celda)
// ============================================

const PC_COL_CATEGORIA = 'U';
const PC_ROTULO_CATEGORIAS = { celda: 'U7', esperado: 'Categorías.' };
const PC_ROTULO_NOMBRE = { celda: 'U8', esperado: 'Nombre' };

// decision 2026-08-24 (correccion post-deploy, medida en vivo por Franco): V7 es DINAMICO --
// sigue al modo exactamente igual que J7/N7/R7 -- no un rotulo fijo. Por eso NO tiene una
// constante de texto esperado: este modulo lo ESCRIBE con _formulaTituloMontoPm(), la MISMA
// formula que ya usa DEVTOOL_PresupuestoModo.js para J7/N7/R7 (reusada verbatim, nunca una
// segunda implementacion). W7 en cambio es estatico, y dice EXACTAMENTE lo mismo que K7/O7/S7
// ("Monto a Proyectar") -- comparte la constante PC_TITULO_PROYECTAR de abajo, a proposito: son
// el mismo texto en cuatro celdas, y una segunda constante con un valor "parecido" fue
// exactamente el bug que freno el preflight en la corrida real (esperaba "Monto Proyectado",
// la hoja decia "Monto a Proyectar" -- medido contra celdas.tsv, un snapshot que quedo viejo
// para un rotulo que en realidad es SIEMPRE el mismo texto de "Monto a Proyectar").
const PC_COL_MODO_AGRUPADO = 'V';        // agrupa J/N/R (el "modo" -- referencia o ponderado); titulo DINAMICO, ver arriba
const PC_COL_PROYECTAR_AGRUPADO = 'W';   // agrupa K/O/S ("Monto a Proyectar", fijo, sin modo); titulo ESTATICO, PC_TITULO_PROYECTAR
const PC_TITULO_PROYECTAR = 'Monto a Proyectar';   // K7/O7/S7 Y W7 -- este modulo solo LEE las cuatro, ninguna la escribe (las cuatro ya son estaticas y correctas)

const PC_CELDA_TITULO_TABLA1 = 'C9';
const PC_TITULO_TABLA1 = 'Movimientos Promedio históricos.';

// Las tres filas de porcentaje de la Tabla 2 con el bug de copiar-pegar (dividen por $E$11 en
// vez de $E$18).
const PC_FILAS_TABLA2 = [19, 20, 21];
const PC_TOKEN_ROTO = '$E$11';
const PC_TOKEN_CORRECTO = '$E$18';

// Los tres bloques, derivados de PM_BLOQUES (DEVTOOL_PresupuestoModo.js) mas la columna
// "Monto a Proyectar" (K/O/S) y el rango del Plan de Cuentas que da la categoria de cada cuenta.
// decision Franco 2026-08-24: mismo criterio de signo confirmado contra Tablero!AA10 (ver
// cabecera) -- Ingresos suma, Gastos Fijos y Variables restan.
// decision Franco 2026-08-25: _bloquesPc() deja de ser un const de nivel superior. Leia
// PM_BLOQUES (DEVTOOL_PresupuestoModo.js) al CARGAR, y eso funcionaba SOLO porque la "R" de
// Resumen ordena despues de la "M" de Modo. Apps Script comparte un unico scope global y evalua
// los archivos en orden alfabetico: el gemelo exacto de este patron en
// DEVTOOL_PresupuestoGuardar.js (cuya "G" ordena ANTES) tumbo la carga del PROYECTO ENTERO el
// 2026-08-25 y dejo toda la planilla con #ERROR!. Este funcionaba de casualidad, no por diseno:
// bastaba renombrar un archivo para despertarlo. Se resuelve al INVOCAR y se memoiza, asi el
// orden de carga deja de importar. @see devtools/probar_carga_apps_script.js
var _cacheBloquesPc;
function _bloquesPc() {
    if (!_cacheBloquesPc) {
        _cacheBloquesPc = {
        ingresos: {
            colCuenta: PM_BLOQUES.ingresos.colCuenta, colModo: PM_BLOQUES.ingresos.colMonto,
            colProyectar: 'K', rangesCfg: RANGES.INGRESOS
        },
        fijos: {
            colCuenta: PM_BLOQUES.fijos.colCuenta, colModo: PM_BLOQUES.fijos.colMonto,
            colProyectar: 'O', rangesCfg: RANGES.GASTOS_FIJOS
        },
        variables: {
            colCuenta: PM_BLOQUES.variables.colCuenta, colModo: PM_BLOQUES.variables.colMonto,
            colProyectar: 'S', rangesCfg: RANGES.GASTOS_VARIABLES
        }
        };
    }
    return _cacheBloquesPc;
}
// decision Franco 2026-08-25: NO inicializar un const de nivel superior leyendo un simbolo de
// OTRO archivo. Apps Script evalua los archivos en orden alfabetico y no hay filePushOrder en
// .clasp.json, asi que aca el orden HOY zafa ("...Resumen" va despues de "...Modo"), pero es la misma bomba. El
// ReferenceError no rompe este modulo: rompe la carga del PROYECTO ENTERO, y con ella todas las
// funciones personalizadas de la planilla (Inicio quedo con #ERROR! en Saldo Actual y Capital
// Acumulado) por el caso gemelo de Guardar. Se lee al INVOCAR, que es cuando el simbolo ya existe, y asi el orden deja de importar.
function _clavesBloquePc() { return PM_CLAVES_BLOQUE; }   // ['ingresos','fijos','variables'], mismo orden

const PC_PROP_RESPALDO = 'presupuesto_resumen_respaldo';
const PC_PROP_PREVIOS = 'presupuesto_resumen_previos';

// ============================================
// FORMULAS
// ============================================

/**
 * El agrupado por categoria de UNA fila (una categoria de $U$fila), para la columna V (tipo=
 * 'modo', agrupa J/N/R) o W (tipo='proyectar', agrupa K/O/S). Ingresos suma, Gastos Fijos y
 * Variables restan (ver cabecera: convencion confirmada contra Tablero!AA10).
 *
 * El rango de busqueda del Plan de Cuentas se deriva de RANGES (nunca hardcodeado): el indice de
 * columna sale de la distancia entre `columns.nombre` y `columns.proyecto`.
 */
function _formulaAgrupadoPc(tipo, fila) {
    const celdaCategoria = _absPm(PC_COL_CATEGORIA + fila);
    const defs = [];
    const terminos = [];
    _clavesBloquePc().forEach(function (k, i) {
        const b = _bloquesPc()[k];
        const cfg = b.rangesCfg;
        const idx = columnLetterToIndex(cfg.columns.proyecto) - columnLetterToIndex(cfg.columns.nombre) + 1;
        const rangoPlan = _refHoja(cfg.sheet) + '!' + cfg.columns.nombre + ':' + cfg.columns.proyecto;
        const rangoCuentas = '$' + b.colCuenta + '$' + PM_FILA_INI + ':$' + b.colCuenta + '$' + PM_FILA_FIN;
        const varCat = 'cat_' + k;
        defs.push('    ' + varCat + '; ARRAYFORMULA(IFERROR(VLOOKUP(' + rangoCuentas + '; ' + rangoPlan + '; ' + idx + '; 0); ""));');
        const colOrigen = tipo === 'modo' ? b.colModo : b.colProyectar;
        const rangoOrigen = '$' + colOrigen + '$' + PM_FILA_INI + ':$' + colOrigen + '$' + PM_FILA_FIN;
        const termino = 'SUMIF(' + varCat + '; ' + celdaCategoria + '; ' + rangoOrigen + ')';
        terminos.push(i === 0 ? termino : ' - ' + termino);
    });
    return '=IF(' + celdaCategoria + '=""; "";\n  LET(\n' + defs.join('\n') + '\n    ' +
        terminos.join('') + '\n  )\n)';
}

/**
 * El rotulo de la Tabla 1 (C9) con el mes de referencia agregado entre parentesis. Reusa
 * _fragmentoMesRefPm() y _condModoHistoricoPm() de DEVTOOL_PresupuestoModo.js verbatim: el mismo
 * mes de referencia que ya calcula J/N/R, nunca un texto fijo.
 *
 * Los nombres de mes salen de IP_MESES via INDEX (el inverso del MATCH que ya usa
 * _fragmentoMesRefPm) -- evita TEXT(fecha;"MMMM") a proposito: el formato de mes en letras
 * depende del locale del documento, y ese locale ya genero mas de un bug documentado en este
 * repo (ver IP_BLOQUE, 00_Config.js). IP_MESES no depende de ningun locale: es la MISMA lista
 * que ya usa el selector J2 para nombrar los meses.
 */
function _formulaRotuloMesRefPc() {
    return '=LET(\n' +
        _fragmentoMesRefPm() +
        '  nombres_mes; SPLIT("' + IP_MESES + '"; ",");\n' +
        '  mes_ini_hist; EDATE(mes_ref; 1 - ' + PM_MESES_HISTORICO + ');\n' +
        '  texto_mes_ref; INDEX(nombres_mes; 1; MONTH(mes_ref)) & " " & YEAR(mes_ref);\n' +
        '  texto_mes_ini; INDEX(nombres_mes; 1; MONTH(mes_ini_hist)) & " " & YEAR(mes_ini_hist);\n' +
        '  IF(' + _condModoHistoricoPm() + ';\n' +
        '    "' + PC_TITULO_TABLA1 + ' (" & texto_mes_ini & " - " & texto_mes_ref & ")";\n' +
        '    "' + PC_TITULO_TABLA1 + ' (" & texto_mes_ref & ")"\n' +
        '  )\n)';
}

/**
 * Cirugia de token sobre F19/F20/F21: reemplaza SOLO la referencia rota ($E$11, el Ingresos de
 * la Tabla 1) por la correcta ($E$18, el Ingresos de la propia Tabla 2). El resto de la formula
 * (=IFERROR(E19/...;0), con su propio numerador por fila) queda intacto -- se reusa la formula
 * viva completa, nunca se reescribe de memoria (mismo patron que _repararRangoTipoBcat,
 * DEVTOOL_BloqueCategorias.js). Reemplazo por FUNCION, no por string con "$": un replace de
 * string interpretaria "$E" como un patron especial de reemplazo.
 */
function _repararReferenciaTabla2Pc(formula) {
    if (typeof formula !== 'string' || !formula) return formula;
    const re = /\$E\$11\b/g;
    return formula.replace(re, function () { return PC_TOKEN_CORRECTO; });
}

// ============================================
// EL RECALCULO EN JS PURO (el invariante, espejo independiente de las formulas de arriba)
// ============================================

/**
 * Re-implementa en JS, sobre datos crudos (sin ninguna formula de Sheets), el mismo agrupado que
 * hacen las formulas de V/W: Ingresos suma, Gastos Fijos y Variables restan. `filas` es un array
 * de objetos { nombreI, nombreM, nombreQ, J, K, N, O, R, S, U } -- una fila por cada 9..38 de la
 * hoja. `mapaIngresos/mapaFijos/mapaVariables` mapean nombre de cuenta -> categoria (leidos del
 * Plan de Cuentas). Puro: sin SpreadsheetApp, testeable directo con datos sinteticos.
 */
function _recalcularAgrupadoPc(filas, mapaIngresos, mapaFijos, mapaVariables) {
    const gaps = [];
    const enriquecidas = filas.map(function (f) {
        const catI = f.nombreI ? (mapaIngresos[f.nombreI] || '') : '';
        const catM = f.nombreM ? (mapaFijos[f.nombreM] || '') : '';
        const catQ = f.nombreQ ? (mapaVariables[f.nombreQ] || '') : '';
        if (f.nombreI && !catI) gaps.push('Ingresos: "' + f.nombreI + '" sin categoria en el Plan de Cuentas');
        if (f.nombreM && !catM) gaps.push('Gastos Fijos: "' + f.nombreM + '" sin categoria en el Plan de Cuentas');
        if (f.nombreQ && !catQ) gaps.push('Gastos Variables: "' + f.nombreQ + '" sin categoria en el Plan de Cuentas');
        return Object.assign({}, f, { catI: catI, catM: catM, catQ: catQ });
    });

    const porCategoria = enriquecidas.map(function (f) {
        if (!f.U) return { U: '', esperadoV: null, esperadoW: null };
        let esperadoV = 0, esperadoW = 0;
        enriquecidas.forEach(function (g) {
            if (g.catI === f.U) { esperadoV += g.J; esperadoW += g.K; }
            if (g.catM === f.U) { esperadoV -= g.N; esperadoW -= g.O; }
            if (g.catQ === f.U) { esperadoV -= g.R; esperadoW -= g.S; }
        });
        return { U: f.U, esperadoV: esperadoV, esperadoW: esperadoW };
    });

    // El monto que se "escapa" del agrupado por no tener categoria -- explica por que
    // SUM(V9:V38) puede no cerrar exacto contra J8-N8-R8 sin que sea un bug de formula.
    let gapMontoV = 0, gapMontoW = 0;
    enriquecidas.forEach(function (f) {
        if (f.nombreI && !f.catI) { gapMontoV += f.J; gapMontoW += f.K; }
        if (f.nombreM && !f.catM) { gapMontoV -= f.N; gapMontoW -= f.O; }
        if (f.nombreQ && !f.catQ) { gapMontoV -= f.R; gapMontoW -= f.S; }
    });

    return {
        porCategoria: porCategoria,
        gaps: gaps.filter(function (g, i) { return gaps.indexOf(g) === i; }),
        gapMontoV: gapMontoV,
        gapMontoW: gapMontoW
    };
}

/** Lee un bloque del Plan de Cuentas y arma el mapa nombre -> categoria. Solo lectura. */
function _leerMapaCategoriaPc(ss, cfg) {
    const mapa = {};
    const hoja = ss.getSheetByName(cfg.sheet);
    if (!hoja) return mapa;
    const filaDatos = getDataRow(cfg);
    const ultFila = hoja.getLastRow();
    if (ultFila < filaDatos) return mapa;
    const colIni = columnLetterToIndex(cfg.columns.nombre);
    const nCols = columnLetterToIndex(cfg.columns.proyecto) - colIni + 1;
    const valores = hoja.getRange(filaDatos, colIni, ultFila - filaDatos + 1, nCols).getValues();
    valores.forEach(function (fila) {
        const nombre = String(fila[0] || '').trim();
        const categoria = String(fila[nCols - 1] || '').trim();
        if (nombre) mapa[nombre] = categoria;
    });
    return mapa;
}

/**
 * El invariante completo, contra la hoja viva: lee I..W (9-38) de "Presupuesto" y los tres
 * catalogos del Plan de Cuentas, delega el calculo a _recalcularAgrupadoPc (puro) y compara
 * contra lo que V/W/V8/W8 muestran en vivo. Ademas verifica que ninguna celda quedo en error, que
 * C9 menciona el mes de referencia y que F19:F21 ya no referencian el token roto.
 */
function _verificarInvariantesPc(ss, hoja) {
    const fallas = [];
    const avisos = [];

    const colIni = columnLetterToIndex('I');
    const nFilas = PM_FILA_FIN - PM_FILA_INI + 1;
    const ultColLetra = PC_COL_PROYECTAR_AGRUPADO;
    const nCols = columnLetterToIndex(ultColLetra) - colIni + 1;
    const valores = hoja.getRange(PM_FILA_INI, colIni, nFilas, nCols).getValues();
    const idx = function (col) { return columnLetterToIndex(col) - colIni; };
    const iI = idx('I'), iJ = idx('J'), iK = idx('K'), iM = idx('M'), iN = idx('N'), iO = idx('O'),
        iQ = idx('Q'), iR = idx('R'), iS = idx('S'), iU = idx(PC_COL_CATEGORIA),
        iV = idx(PC_COL_MODO_AGRUPADO), iW = idx(PC_COL_PROYECTAR_AGRUPADO);
    const numero = function (v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; };

    const filasCrudas = [];
    const vivoV = [], vivoW = [];
    for (let i = 0; i < valores.length; i++) {
        const fila = valores[i];
        filasCrudas.push({
            nombreI: String(fila[iI] || '').trim(), nombreM: String(fila[iM] || '').trim(),
            nombreQ: String(fila[iQ] || '').trim(), U: String(fila[iU] || '').trim(),
            J: numero(fila[iJ]), K: numero(fila[iK]), N: numero(fila[iN]), O: numero(fila[iO]),
            R: numero(fila[iR]), S: numero(fila[iS])
        });
        vivoV.push(fila[iV]);
        vivoW.push(fila[iW]);
    }

    const mapaIngresos = _leerMapaCategoriaPc(ss, RANGES.INGRESOS);
    const mapaFijos = _leerMapaCategoriaPc(ss, RANGES.GASTOS_FIJOS);
    const mapaVariables = _leerMapaCategoriaPc(ss, RANGES.GASTOS_VARIABLES);
    const recalculo = _recalcularAgrupadoPc(filasCrudas, mapaIngresos, mapaFijos, mapaVariables);

    recalculo.porCategoria.forEach(function (r, i) {
        const filaNum = PM_FILA_INI + i;
        if (r.esperadoV === null) return;   // sin categoria en esa fila del espejo: nada que comparar
        if (typeof vivoV[i] !== 'number' || Math.abs(vivoV[i] - r.esperadoV) >= PM_UMBRAL_IDENTIDAD) {
            fallas.push(PC_COL_MODO_AGRUPADO + filaNum + ' = ' + JSON.stringify(vivoV[i]) +
                ' pero la categoria "' + r.U + '" recalculada de forma independiente en JS da ' + r.esperadoV.toFixed(2));
        }
        if (typeof vivoW[i] !== 'number' || Math.abs(vivoW[i] - r.esperadoW) >= PM_UMBRAL_IDENTIDAD) {
            fallas.push(PC_COL_PROYECTAR_AGRUPADO + filaNum + ' = ' + JSON.stringify(vivoW[i]) +
                ' pero la categoria "' + r.U + '" recalculada de forma independiente en JS da ' + r.esperadoW.toFixed(2));
        }
    });

    [PC_COL_MODO_AGRUPADO, PC_COL_PROYECTAR_AGRUPADO].forEach(function (col) {
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            const err = _errorDeCelda(hoja.getRange(col + f));
            if (err) fallas.push(col + f + ' quedo en ' + err);
        }
    });

    // El invariante de totales: V8=J8-N8-R8, W8=K8-O8-S8, salvo el hueco que explican las
    // cuentas sin categoria (reportado como aviso, no como falla: es un dato del catalogo, no
    // un bug de formula -- mismo criterio que _contarCategoriasSinTipoBcat en
    // DEVTOOL_BloqueCategorias.js).
    const leer = function (celda) { return numero(hoja.getRange(celda).getValue()); };
    const v8 = leer(PC_COL_MODO_AGRUPADO + PM_FILA_TOTAL), j8 = leer('J' + PM_FILA_TOTAL),
        n8 = leer('N' + PM_FILA_TOTAL), r8 = leer('R' + PM_FILA_TOTAL);
    const w8 = leer(PC_COL_PROYECTAR_AGRUPADO + PM_FILA_TOTAL), k8 = leer('K' + PM_FILA_TOTAL),
        o8 = leer('O' + PM_FILA_TOTAL), s8 = leer('S' + PM_FILA_TOTAL);

    const desvioV = (j8 - n8 - r8) - v8;
    if (Math.abs(desvioV - recalculo.gapMontoV) >= PM_UMBRAL_IDENTIDAD) {
        fallas.push(PC_COL_MODO_AGRUPADO + PM_FILA_TOTAL + ' (' + v8.toFixed(2) + ') no cierra contra J8-N8-R8 (' +
            (j8 - n8 - r8).toFixed(2) + '): la diferencia (' + desvioV.toFixed(2) +
            ') no la explican las cuentas sin categoria (' + recalculo.gapMontoV.toFixed(2) + '). Puede haber un signo invertido o una cuenta fuera del espejo.');
    } else if (Math.abs(recalculo.gapMontoV) >= PM_UMBRAL_IDENTIDAD) {
        avisos.push('V8 (' + v8.toFixed(2) + ') no cierra exacto contra J8-N8-R8 (' + (j8 - n8 - r8).toFixed(2) +
            ') por ' + recalculo.gapMontoV.toFixed(2) + ' de cuentas sin categoria en el Plan de Cuentas.');
    }
    const desvioW = (k8 - o8 - s8) - w8;
    if (Math.abs(desvioW - recalculo.gapMontoW) >= PM_UMBRAL_IDENTIDAD) {
        fallas.push(PC_COL_PROYECTAR_AGRUPADO + PM_FILA_TOTAL + ' (' + w8.toFixed(2) + ') no cierra contra K8-O8-S8 (' +
            (k8 - o8 - s8).toFixed(2) + '): la diferencia (' + desvioW.toFixed(2) +
            ') no la explican las cuentas sin categoria (' + recalculo.gapMontoW.toFixed(2) + '). Puede haber un signo invertido o una cuenta fuera del espejo.');
    } else if (Math.abs(recalculo.gapMontoW) >= PM_UMBRAL_IDENTIDAD) {
        avisos.push('W8 (' + w8.toFixed(2) + ') no cierra exacto contra K8-O8-S8 (' + (k8 - o8 - s8).toFixed(2) +
            ') por ' + recalculo.gapMontoW.toFixed(2) + ' de cuentas sin categoria en el Plan de Cuentas.');
    }
    if (recalculo.gaps.length) {
        avisos.push('Cuentas sin categoria en el Plan de Cuentas (quedan fuera de V/W): ' + recalculo.gaps.join('; '));
    }

    // C9: el texto tiene que contener el nombre del mes de referencia
    const mesRef = _mesRefDesdeSelectoresPm(hoja.getRange(PM_SELECTORES.mes).getValue(), Number(hoja.getRange(PM_SELECTORES.anio).getValue()));
    if (mesRef) {
        const nombreMesRef = IP_MESES.split(',')[mesRef.getMonth()];
        const textoC9 = String(hoja.getRange(PC_CELDA_TITULO_TABLA1).getDisplayValue() || '');
        if (textoC9.indexOf(nombreMesRef) === -1) {
            fallas.push(PC_CELDA_TITULO_TABLA1 + ' muestra "' + textoC9 + '" y no contiene "' + nombreMesRef + '" (el mes de referencia)');
        }
    } else {
        avisos.push('No se pudo determinar el mes de referencia a partir de ' + PM_SELECTORES.mes + '/' + PM_SELECTORES.anio +
            ': se omite el chequeo del rotulo de ' + PC_CELDA_TITULO_TABLA1 + '.');
    }

    // V7: titulo DINAMICO que este modulo escribe -- tiene que mostrar la MISMA palabra que
    // J7/N7/R7 para el modo vivo (mismo chequeo que _verificarInvariantesPm hace sobre esas tres).
    const modoVivo = String(hoja.getRange(PM_MODO.celda).getValue() || '').trim();
    const tituloEsperadoV7 = _esModoHistoricoPm(modoVivo) ? PM_TITULO_PALABRA.historico : PM_TITULO_PALABRA.proyectado;
    const textoV7 = String(hoja.getRange(PC_COL_MODO_AGRUPADO + '7').getDisplayValue() || '');
    if (textoV7.indexOf(tituloEsperadoV7) === -1) {
        fallas.push(PC_COL_MODO_AGRUPADO + '7 muestra "' + textoV7 + '" y se esperaba que contuviera "' + tituloEsperadoV7 + '"');
    }

    // F19:F21 no puede seguir referenciando el token roto
    PC_FILAS_TABLA2.forEach(function (f) {
        const celda = 'F' + f;
        const formula = hoja.getRange(celda).getFormula();
        if (formula.indexOf(PC_TOKEN_ROTO) !== -1) {
            fallas.push(celda + ' todavia referencia ' + PC_TOKEN_ROTO + ' (deberia ser ' + PC_TOKEN_CORRECTO + '): "' + formula + '"');
        }
        if (formula.indexOf(PC_TOKEN_CORRECTO) === -1) {
            fallas.push(celda + ' no referencia ' + PC_TOKEN_CORRECTO + ' despues de la reparacion: "' + formula + '"');
        }
        const err = _errorDeCelda(hoja.getRange(celda));
        if (err) fallas.push(celda + ' quedo en ' + err);
    });

    return { fallas: fallas, avisos: avisos };
}

// ============================================
// PREFLIGHT
// ============================================

function _preflightPc(ss) {
    const nombre = SHEETS.PRESUPUESTO;
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) throw new Error('No existe la hoja "' + nombre + '".');

    const desvios = [];
    const vivoDe = function (celda) { return hoja.getRange(celda).getValue(); };
    const chequear = function (celda, esperado) {
        const vivo = vivoDe(celda);
        if (!_rotulosCompatibles(vivo, esperado)) {
            desvios.push(celda + ' dice "' + vivo + '" y se esperaba "' + esperado + '"');
        }
    };

    // --- 1. El espejo de categorias (U) ---
    chequear(PC_ROTULO_CATEGORIAS.celda, PC_ROTULO_CATEGORIAS.esperado);
    chequear(PC_ROTULO_NOMBRE.celda, PC_ROTULO_NOMBRE.esperado);

    // --- 2. Las tres columnas "Monto a Proyectar" (K/O/S) -- este modulo las LEE, no las escribe ---
    _clavesBloquePc().forEach(function (k) {
        chequear(_bloquesPc()[k].colProyectar + '7', PC_TITULO_PROYECTAR);
    });

    // --- 3. W7 dice EXACTAMENTE lo mismo que K7/O7/S7 ("Monto a Proyectar") -- este modulo lo
    // LEE, no lo escribe. V7 NO se rotulo-chequea aca a proposito: es DINAMICO (este modulo SI
    // lo escribe, con la MISMA formula que J7/N7/R7 -- ver _planPc) y su contenido previo no
    // importa, igual que DEVTOOL_PresupuestoModo.js no rotulo-chequea J7/N7/R7 antes de
    // escribirlos: la idempotencia la resuelve _planPc comparando formulas, no un chequeo de
    // texto aca.
    chequear(PC_COL_PROYECTAR_AGRUPADO + '7', PC_TITULO_PROYECTAR);

    // --- 4. El titulo de la Tabla 1 (C9), que este modulo SI reescribe ---
    const c9Vivo = String(vivoDe(PC_CELDA_TITULO_TABLA1) || '');
    if (!_rotulosCompatibles(c9Vivo, PC_TITULO_TABLA1) && c9Vivo.indexOf(PC_TITULO_TABLA1) === -1) {
        desvios.push(PC_CELDA_TITULO_TABLA1 + ' dice "' + c9Vivo + '" y no contiene "' + PC_TITULO_TABLA1 + '"');
    }

    if (desvios.length) {
        throw new Error('La hoja "' + nombre + '" no es la que este modulo espera: ' + desvios.join('; ') +
            '. Hay que volver a medir antes de escribir. No se toco nada.');
    }

    // --- 5. C9 no puede ser la mitad muda de una celda combinada ---
    const rangoC9 = hoja.getRange(PC_CELDA_TITULO_TABLA1);
    if (rangoC9.isPartOfMerge()) {
        const ancla = rangoC9.getMergedRanges()[0].getCell(1, 1);
        if (ancla.getA1Notation() !== PC_CELDA_TITULO_TABLA1) {
            throw new Error(PC_CELDA_TITULO_TABLA1 + ' es la mitad muda de una celda combinada (ancla ' +
                ancla.getA1Notation() + '): escribir aca no haria nada. No se toco nada.');
        }
    }

    // --- 5b. V7 (el titulo dinamico que este modulo SI escribe, igual que J7/N7/R7) tampoco ---
    // --- puede ser la mitad muda de una combinada -- mismo guard que DEVTOOL_PresupuestoModo.js ---
    // --- aplica sobre J7/N7/R7 (su paso 8). ---
    const celdaV7 = PC_COL_MODO_AGRUPADO + '7';
    const rangoV7 = hoja.getRange(celdaV7);
    if (rangoV7.isPartOfMerge()) {
        const anclaV7 = rangoV7.getMergedRanges()[0].getCell(1, 1);
        if (anclaV7.getA1Notation() !== celdaV7) {
            throw new Error(celdaV7 + ' es la mitad muda de una celda combinada (ancla ' +
                anclaV7.getA1Notation() + '): escribir aca no haria nada. No se toco nada.');
        }
    }

    // --- 6. El espejo de categorias (U) cubre TODA la banda 9-38 con formula ---
    const sinMirror = [];
    for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
        if (!hoja.getRange(PC_COL_CATEGORIA + f).getFormula()) sinMirror.push(PC_COL_CATEGORIA + f);
    }
    if (sinMirror.length) {
        throw new Error('El espejo de categorias no cubre toda la banda ' + PM_FILA_INI + '-' + PM_FILA_FIN +
            ': faltan formulas en ' + sinMirror.slice(0, 8).join(', ') +
            (sinMirror.length > 8 ? ' (y ' + (sinMirror.length - 8) + ' mas)' : '') + '. No se toco nada.');
    }

    // --- 7. V/W (9-38) no pueden tener VALORES estaticos: seria dato de Franco ---
    const conValor = [];
    [PC_COL_MODO_AGRUPADO, PC_COL_PROYECTAR_AGRUPADO].forEach(function (col) {
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            const r = hoja.getRange(col + f);
            if (!r.getFormula() && String(r.getValue()) !== '') conValor.push(col + f);
        }
    });
    if (conValor.length) {
        throw new Error('Hay valores escritos a mano en ' + conValor.slice(0, 8).join(', ') +
            (conValor.length > 8 ? ' (y ' + (conValor.length - 8) + ' mas)' : '') +
            ': puede ser dato de Franco y este modulo no pisa datos. No se toco nada.');
    }

    // --- 8. Los totales V8/W8 tienen que tener formula: el invariante los necesita ---
    const sinTotal = [];
    [PC_COL_MODO_AGRUPADO, PC_COL_PROYECTAR_AGRUPADO].forEach(function (col) {
        if (!hoja.getRange(col + PM_FILA_TOTAL).getFormula()) sinTotal.push(col + PM_FILA_TOTAL);
    });
    if (sinTotal.length) {
        throw new Error('Estas celdas de total no tienen formula: ' + sinTotal.join(', ') +
            '. El invariante de este modulo las necesita. No se toco nada.');
    }

    // --- 9. F19/F20/F21 tienen que tener el patron esperado: roto ($E$11) o ya reparado ($E$18) ---
    const patronInesperado = [];
    PC_FILAS_TABLA2.forEach(function (f) {
        const formula = hoja.getRange('F' + f).getFormula();
        if (!formula) { patronInesperado.push('F' + f + ' no tiene formula'); return; }
        if (formula.indexOf(PC_TOKEN_ROTO) === -1 && formula.indexOf(PC_TOKEN_CORRECTO) === -1) {
            patronInesperado.push('F' + f + ' no referencia ' + PC_TOKEN_ROTO + ' ni ' + PC_TOKEN_CORRECTO + ': "' + formula + '"');
        }
    });
    if (patronInesperado.length) {
        throw new Error('La Tabla 2 (F19:F21) no tiene la forma esperada: ' + patronInesperado.join('; ') +
            '. Hay que revisar a mano antes de escribir. No se toco nada.');
    }

    return { hoja: hoja, nombre: nombre };
}

// ============================================
// PLAN
// ============================================

function _planPc(pre) {
    const cambios = [];
    const proponer = function (celda, nota, nueva, resumen) {
        const rango = pre.hoja.getRange(celda);
        const actual = rango.getFormula();
        if (_canonizarFormula(actual) === _canonizarFormula(nueva)) return;
        cambios.push({
            celda: celda, nota: nota, formulaActual: actual, formulaNueva: nueva,
            valorActual: actual ? '' : rango.getValue(), resumen: resumen
        });
    };

    // V7: titulo DINAMICO, sigue al modo -- la MISMA formula que J7/N7/R7 (DEVTOOL_PresupuestoModo.js),
    // reusada verbatim (nunca una segunda implementacion). W7 NO se toca: es estatico y ya dice
    // "Monto a Proyectar" (verificado en preflight, paso 3).
    proponer(PC_COL_MODO_AGRUPADO + '7', 'Titulo V7: sigue al modo, igual que J7/N7/R7', _formulaTituloMontoPm(),
        '"Monto Historico" o "Monto Proyectado" segun ' + PM_MODO.celda + ' -- misma formula que J7/N7/R7');

    for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
        proponer(PC_COL_MODO_AGRUPADO + f, 'Categorias (modo): fila ' + f, _formulaAgrupadoPc('modo', f),
            'agrupado por categoria de J/N/R -- Ingresos positivo, Gastos Fijos/Variables negativo');
        proponer(PC_COL_PROYECTAR_AGRUPADO + f, 'Categorias (a proyectar): fila ' + f, _formulaAgrupadoPc('proyectar', f),
            'agrupado por categoria de K/O/S -- Ingresos positivo, Gastos Fijos/Variables negativo');
    }

    proponer(PC_CELDA_TITULO_TABLA1, 'Titulo Tabla 1: mes de referencia', _formulaRotuloMesRefPc(),
        'agrega el mes de referencia (o la ventana de ' + PM_MESES_HISTORICO + ' meses en Historico), derivado de ' + PM_MODO.celda);

    PC_FILAS_TABLA2.forEach(function (f) {
        const celda = 'F' + f;
        const actual = pre.hoja.getRange(celda).getFormula();
        proponer(celda, 'Tabla 2: porcentaje fila ' + f, _repararReferenciaTabla2Pc(actual),
            'divide por ' + PC_TOKEN_CORRECTO + ' (Ingresos de su propia tabla), no por ' + PC_TOKEN_ROTO + ' (Tabla 1)');
    });

    return { cambios: cambios };
}

// ============================================
// PUBLICAS
// ============================================

function estadoPresupuestoResumen() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPc(ss);
        const plan = _planPc(pre);

        const l = ['PRESUPUESTO: CATEGORIAS Y RESUMEN - ESTADO (no se escribio nada)', ''];
        if (!plan.cambios.length) {
            l.push('NADA QUE HACER: ' + PC_COL_MODO_AGRUPADO + '/' + PC_COL_PROYECTAR_AGRUPADO +
                ' (filas ' + PM_FILA_INI + '-' + PM_FILA_FIN + '), ' + PC_CELDA_TITULO_TABLA1 + ' y F19:F21 ya estan como corresponde.');
        } else {
            l.push('CELDAS A ESCRIBIR: ' + plan.cambios.length);
            l.push('');
            l.push('QUE CAMBIA:');
            l.push('  - ' + PC_COL_MODO_AGRUPADO + PM_FILA_INI + ':' + PC_COL_MODO_AGRUPADO + PM_FILA_FIN +
                ': cada categoria agrupada desde J/N/R (Ingresos positivo, Gastos negativo).');
            l.push('  - ' + PC_COL_PROYECTAR_AGRUPADO + PM_FILA_INI + ':' + PC_COL_PROYECTAR_AGRUPADO + PM_FILA_FIN +
                ': lo mismo desde K/O/S ("Monto a Proyectar").');
            l.push('  - ' + PC_CELDA_TITULO_TABLA1 + ': agrega el mes de referencia al titulo, derivado de ' + PM_MODO.celda + '.');
            l.push('  - F19:F21: dividen por ' + PC_TOKEN_CORRECTO + ' en vez de ' + PC_TOKEN_ROTO + ' (bug de copiar-pegar).');
        }
        const t = l.join('\n');
        _mostrarPc('Presupuesto: categorias y resumen - estado', t);
        logInfo('estadoPresupuestoResumen: ' + plan.cambios.length + ' celda(s) pendientes.');
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPc('Presupuesto: categorias y resumen - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function aplicarPresupuestoResumen() {
    let ui = null, ss = null, escritas = [], yaRevertido = false;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarPresupuestoResumen necesita UI (menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPc(ss);
        const plan = _planPc(pre);

        if (!plan.cambios.length) {
            const t = PC_COL_MODO_AGRUPADO + '/' + PC_COL_PROYECTAR_AGRUPADO + ', ' + PC_CELDA_TITULO_TABLA1 +
                ' y F19:F21 ya estan como corresponde. No se escribio nada.';
            _mostrarPc('Presupuesto: categorias y resumen', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Presupuesto: categorias y resumen',
            'Se van a escribir ' + plan.cambios.length + ' celda(s) de "' + pre.nombre + '".\n\n' +
            'QUE CAMBIA:\n' +
            '  - ' + PC_COL_MODO_AGRUPADO + PM_FILA_INI + ':' + PC_COL_MODO_AGRUPADO + PM_FILA_FIN + ' y ' +
            PC_COL_PROYECTAR_AGRUPADO + PM_FILA_INI + ':' + PC_COL_PROYECTAR_AGRUPADO + PM_FILA_FIN +
            ': cada categoria del Plan de Cuentas agrupada (Ingresos incluidos),\n' +
            '    positiva si es Ingreso, negativa si es Gasto Fijo o Variable.\n' +
            '  - ' + PC_CELDA_TITULO_TABLA1 + ': agrega el mes de referencia al titulo.\n' +
            '  - F19:F21 dividen por ' + PC_TOKEN_CORRECTO + ' en vez de ' + PC_TOKEN_ROTO +
            ' (bug de copiar-pegar confirmado por Franco).\n\n' +
            'NO se toca J/N/R/K/O/S ni el ledger.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarPm(ss, sello);   // reusa el respaldo de TODA "Presupuesto" (DEVTOOL_PresupuestoModo.js)

        const previosCeldas = [];
        plan.cambios.forEach(function (c) {
            if (c.formulaActual) previosCeldas.push({ celda: c.celda, tenia: 'formula' });
            else if (String(c.valorActual) !== '') previosCeldas.push({ celda: c.celda, tenia: 'valor', valor: c.valorActual });
            else previosCeldas.push({ celda: c.celda, tenia: 'vacia' });
        });

        plan.cambios.forEach(function (c) {
            const rango = pre.hoja.getRange(c.celda);
            const errorPrevio = _errorDeCelda(rango);
            rango.setFormula(c.formulaNueva);
            escritas.push(_entradaEscritaPm(pre.nombre, c, errorPrevio));
        });
        SpreadsheetApp.flush();

        const fallasEscritura = _verificarEscrituraSyf(ss, escritas);
        const inv = _verificarInvariantesPc(ss, pre.hoja);
        const fallas = fallasEscritura.concat(inv.fallas);

        if (fallas.length) {
            _revertirEscriturasPm(ss, escritas);
            yaRevertido = true;
            throw new Error('Se escribio pero NO VERIFICA: ' + fallas.join('; ') +
                '. Se restauro cada celda. El respaldo quedo en "' + respaldo.nombre + '".');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(PC_PROP_RESPALDO, respaldo.nombre);
        props.setProperty(PC_PROP_PREVIOS, JSON.stringify({ respaldo: respaldo.nombre, celdas: previosCeldas }));

        const detalle = 'PRESUPUESTO: CATEGORIAS Y RESUMEN APLICADO\n\n' +
            (inv.avisos.length ? 'PARA LEER:\n' + inv.avisos.map(function (a) { return '  - ' + a; }).join('\n') + '\n\n' : '') +
            '- Celdas escritas y verificadas: ' + escritas.length + '\n' +
            '- Respaldo en la hoja oculta "' + respaldo.nombre + '"\n' +
            '- Invariante verificado (independiente, en JS): ' + PC_COL_MODO_AGRUPADO + PM_FILA_TOTAL + '=J' + PM_FILA_TOTAL +
            '-N' + PM_FILA_TOTAL + '-R' + PM_FILA_TOTAL + ', ' + PC_COL_PROYECTAR_AGRUPADO + PM_FILA_TOTAL + '=K' + PM_FILA_TOTAL +
            '-O' + PM_FILA_TOTAL + '-S' + PM_FILA_TOTAL + '\n\n' +
            'Si algo quedo peor: revertirPresupuestoResumen (menu Tidetrack Dev).';

        logSuccess('aplicarPresupuestoResumen: ' + escritas.length + ' celda(s).');
        _mostrarPc('Presupuesto: categorias y resumen - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && escritas.length && !yaRevertido) {
            try { _revertirEscriturasPm(ss, escritas); restaurado = ' Se restauraron las celdas ya escritas.'; }
            catch (e2) { restaurado = ' ADEMAS fallo la restauracion (' + e2.message + ').'; }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack });
        _mostrarPc('Presupuesto: categorias y resumen - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Vuelve al estado previo a la ultima corrida aplicada. Mismo patron que
 * revertirPresupuestoModo(): usa `previos.celdas` (Document Properties) y el respaldo
 * ('previos.respaldo') para devolver cada celda a su formula, valor o vacio anteriores.
 */
function revertirPresupuestoResumen() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const crudo = props.getProperty(PC_PROP_PREVIOS);
        if (!crudo) throw new Error('No hay ninguna corrida registrada de este modulo.');
        const previos = JSON.parse(crudo);

        const hoja = ss.getSheetByName(SHEETS.PRESUPUESTO);
        if (!hoja) throw new Error('No existe la hoja "' + SHEETS.PRESUPUESTO + '".');

        const resp = ss.getSheetByName(previos.respaldo);
        const filasRespaldo = resp ? _leerRespaldoFormulerio(resp) : [];

        let repuestas = 0;
        const faltantes = [];
        (previos.celdas || []).forEach(function (p) {
            const rango = hoja.getRange(p.celda);
            if (p.tenia === 'formula') {
                const fila = filasRespaldo.find(function (f) {
                    return f.nombreHoja === SHEETS.PRESUPUESTO && f.celda === p.celda;
                });
                if (!fila) { faltantes.push(p.celda); return; }
                rango.setFormula(fila.formula);
                repuestas++;
                return;
            }
            if (p.tenia === 'valor') { rango.setValue(p.valor); repuestas++; return; }
            rango.clearContent();
            repuestas++;
        });

        SpreadsheetApp.flush();
        props.deleteProperty(PC_PROP_PREVIOS);

        const t = 'PRESUPUESTO: CATEGORIAS Y RESUMEN REVERTIDO\n\n- Celdas repuestas: ' + repuestas + '\n' +
            (faltantes.length ? '- SIN respaldo (quedaron como estan): ' + faltantes.join(', ') + '\n' : '') +
            '- Respaldo usado: "' + previos.respaldo + '"' + (resp ? '' : ' (la hoja ya no existe)');
        logSuccess('revertirPresupuestoResumen: ' + repuestas + ' celda(s).');
        _mostrarPc('Presupuesto: categorias y resumen - revertido', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPc('Presupuesto: categorias y resumen - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarPc(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
