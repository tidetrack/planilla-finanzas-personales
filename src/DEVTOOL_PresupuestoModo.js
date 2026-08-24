/**
 * DEVTOOL_PresupuestoModo.js
 * Cablea el selector de Modo (E7) de la hoja "Presupuesto" y llena J/N/R (filas 9-38) con el
 * monto que corresponde a cada modo, mas los titulos dinamicos de esas tres columnas.
 *
 * [CONCEPTO DE NEGOCIO]
 * "Presupuesto" no es un reporte: es la herramienta con la que Franco completa a mano K/O/S (el
 * monto a proyectar) con criterio en vez de a ojo. El selector de Modo (E7) decide QUE numero de
 * referencia ve mientras decide:
 *   - Proyeccion: el total de esa cuenta en el mes de referencia (el mes calendario anterior al
 *     periodo que se presupuesta) -- "lo que se repite igual: alquiler, prepaga, cuota".
 *   - Historico: un promedio EXPONENCIALMENTE ponderado de los ultimos meses -- "lo que varia:
 *     comidas, salidas, nafta". Franco fue explicito en por que no un promedio simple: "para
 *     entender la evolucion desde la realidad financiera y no como un simple promedio pedorro".
 * Hoy (medido el 2026-08-24, ver docs/permanente/DISENO_HOJA_PRESUPUESTO.md) el selector existe
 * pero NINGUNA formula de la hoja lo lee, y J/N/R (filas 9-38) estan vacias: los totales de la
 * fila 8 dan $0,00 porque suman un rango vacio. Este modulo escribe esas 90 celdas (30 filas x 3
 * bloques) mas los 3 titulos dinamicos.
 *
 * ALCANCE DE ESTE ENCARGO (decision Franco 2026-08-24, DISENO_HOJA_PRESUPUESTO.md): SOLO el
 * selector de Modo y las columnas J/N/R. La columna V (agrupado por categoria, incluye
 * ingresos), las dos tablas resumen (C9:F14 y C16:F21) y "Guardar Proyeccion" son encargos
 * POSTERIORES -- no los toca este modulo. K/O/S ("Monto a Proyectar") son lo que Franco escribe
 * a mano: tampoco se tocan.
 *
 * DE DONDE SALEN LOS DATOS: del ledger "Registros" (RANGES.REGISTROS, B:M, datos desde fila 7),
 * igual que el resto del sistema. El patron de filtro-por-mes + conversion con los TC congelados
 * de cada fila (columnas J:M) + exclusion de cuentas neutras es el MISMO que usan
 * _formulaRealidadIp y _formulaAuxFlujoIp en DEVTOOL_InicioPresupuesto.js -- se reusa a
 * proposito (ver "Reusa helpers probados" mas abajo) para que Presupuesto y Tablero/Inicio nunca
 * muestren numeros distintos para el mismo mes sin que nada lo delate.
 *
 * DIFERENCIA DELIBERADA CON ESE PATRON: alli el destino siempre es ARS (los tres deltas de
 * Inicio son cocientes). Aca la moneda de salida la manda J4 y puede ser cualquiera de las
 * cuatro (ADR-003). Como CADA FILA de Registros congela el vector COMPLETO de cotizaciones del
 * dia (J:M: TC ARS/USD/AUD/EUR, no solo la de su propia moneda -- es el "Data Lake" congelado
 * por fila, ADR-004), convertir de la moneda de origen a la de destino no necesita ninguna
 * cotizacion EN VIVO: alcanza con leer, DE LA MISMA FILA, la tasa de la moneda de origen y la de
 * la moneda de destino y dividir una por la otra. Por eso ninguna formula de este modulo llama a
 * TIDETRACK_*(): no hay "Loading..." que esperar (a diferencia de DEVTOOL_InicioPresupuesto, que
 * si necesita ese guardian porque una de sus fuentes -- la BD de Proyeccion -- no tiene TC
 * congelados).
 *
 * EL MES DE REFERENCIA (decision Franco 2026-08-24): el mes CALENDARIO anterior al del selector
 * J2/J3 -- no el corte de "Inicio Mes", que no siempre coincide con el mes calendario. Si J2 dice
 * Septiembre, la referencia es Agosto. Ambos modos usan el MISMO mes de referencia como ancla: la
 * Proyeccion mira solo ese mes; el Historico mira los 6 meses QUE TERMINAN en ese mes.
 *
 * EL ALPHA DEL PONDERADO EXPONENCIAL (decision Franco 2026-08-24, el numero es eleccion propia de
 * este modulo, pedida explicitamente): se modela como decaimiento geometrico. El mes mas
 * reciente de la ventana de PM_MESES_HISTORICO=6 meses (la MISMA ventana que ya usan los tres
 * deltas de Inicio, IP_MESES_TENDENCIA -- "para que todo el sistema hable del mismo horizonte")
 * pesa 1, y cada mes hacia atras pesa PM_ALPHA veces el mes siguiente. Con PM_ALPHA=0.65:
 *
 *   edad (meses atras)     0      1      2      3      4      5
 *   peso  (0.65^edad)      1      0.65   0.4225 0.2746 0.1785 0.1160
 *   peso normalizado    37.9%  24.6%  16.0%  10.4%   6.8%   4.4%
 *
 * EL NUMERO CONCRETO: el mes mas reciente pesa 1/0.65^5 = 8.62 VECES lo que pesa el mas viejo de
 * los seis. La vida media del peso (cuantos meses hacen falta para que un mes pierda la mitad de
 * su influencia) es ln(0.5)/ln(0.65) = 1.61 meses: bastante mas agresivo que una media simple
 * (los seis meses pesan LO MISMO -- el "promedio pedorro" que Franco rechazo, donde el mas viejo
 * pesa igual que el mas nuevo, proporcion 1:1) pero sin llegar a que solo el ultimo mes importe:
 * los tres meses mas viejos de la ventana siguen sumando 21,6% del total, asi que un mes atipico
 * aislado no vuelca el numero entero.
 *
 * Se descartaron dos alternativas: PM_ALPHA=0.5 (vida media de 1 mes, el mas reciente pesa 32
 * veces el mas viejo) deja practicamente sin voto a la mitad vieja de la ventana -- mas cerca de
 * "solo mira el ultimo mes" que de un PROMEDIO ponderado, que es lo que Franco pidio. Y
 * PM_ALPHA=2/7=0,2857 (la formula estandar de una media movil exponencial de span=6, alpha=2/
 * (span+1)) da un mas-reciente:mas-viejo de apenas 1/0,2857^5=598 (demasiado agresiva al reves:
 * el primer mes casi no pesa NADA, 1/598 del ultimo) -- se descarto por ir al extremo opuesto.
 * 0.65 es el punto intermedio deliberado.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: preflight por ROTULO que aborta ante la minima discrepancia
 * (la geometria de esta planilla se movio tres veces en un mes -- CLAUDE.md, memoria del
 * proyecto), respaldo congelado y verificado antes de mutar, verificacion del VALOR resultante
 * (no solo del texto), reversion completa.
 *
 * EL INVARIANTE (decision Franco 2026-08-24, pedido explicito del encargo: "si dos partes del
 * sistema miden lo mismo, tienen que dar lo mismo"): DESPUES de escribir, se recalcula en JS
 * PURO -- sin ninguna formula de hoja, leyendo "Registros" directo con getValues() -- el total
 * agregado de cada bloque (TODAS las cuentas de esa categoria, sin filtrar por una sola) para el
 * mes de referencia (o el promedio ponderado, segun el modo), y se compara contra J8/N8/R8 --
 * las celdas SUM(col9:col) que YA EXISTEN en la hoja y suman exactamente lo que este modulo
 * escribe en la banda 9-38. Las dos implementaciones son independientes (una formula de Sheets,
 * un recorrido de arrays en Apps Script) y calculan la MISMA pregunta por dos caminos distintos:
 * si no coinciden, hay una cuenta que quedo fuera del espejo I/M/Q, un filtro de fecha corrido,
 * un signo invertido o una moneda de destino mal aplicada. Por que NO se comparo contra una celda
 * del Tablero (la sugerencia original del encargo): el Tablero tiene sus PROPIOS selectores de
 * mes/anio (independientes de J2/J3 de Presupuesto), asi que "el mismo mes de referencia" ahi es
 * un blanco movil que exigiria escribirle a los selectores de OTRA hoja solo para verificar --
 * cross-sheet, con mas riesgo que beneficio. Recalcular en JS puro da la misma garantia
 * ("dos mediciones independientes de lo mismo, tienen que coincidir") sin ese acoplamiento.
 *
 * QUE NO HACE
 * 1. NO toca la columna V, las tablas resumen (C9:F14, C16:F21) ni "Guardar Proyeccion": son
 *    encargos posteriores (DISENO_HOJA_PRESUPUESTO.md).
 * 2. NO toca K/O/S ("Monto a Proyectar"): es lo que Franco escribe a mano.
 * 3. NO toca el ledger, el Plan de Cuentas, la BD de Proyeccion, Inicio ni el Tablero.
 * 4. NO llama a TIDETRACK_*() en ninguna formula (ver arriba: no hace falta, y evita el
 *    "Loading..." de las custom functions).
 *
 * Contrato de las tres publicas: { ok: boolean, detalle?: string, error?: string }.
 *   estadoPresupuestoModo()    -> solo lectura, dice que cambiaria. Se corre PRIMERO.
 *   aplicarPresupuestoModo()   -> preflight + respaldo + escritura + verificacion (invariante
 *                                 incluido) + reversion completa si no verifica.
 *   revertirPresupuestoModo()  -> restaura cada celda a su estado previo exacto (formula, o el
 *                                 texto estatico que tenia -- J7/N7/R7 hoy no son formula), y
 *                                 quita la validacion de datos si este modulo la agrego.
 *
 * Reusa helpers probados: IP_MESES, _exclusionNeutrasIp (DEVTOOL_InicioPresupuesto.js);
 * _refHoja, _colLedger, _canonizarFormula, _verificarEscrituraSyf, _revertirEscriturasSyf
 * (DEVTOOL_StockYFlujo.js); _leerRespaldoFormulerio, _errorDeCelda, _normalizarRotulo,
 * _rotulosCompatibles, _nombreHojaLibreFormulerio, FORM_TOPE_CELDAS_RESPALDO,
 * FORM_MIN_FILAS_RESPALDO (DEVTOOL_FormulerioV0111.js); esCuentaNeutra, columnLetterToIndex,
 * columnIndexToLetter (00_Config.js / 03_SheetManager.js). NO reusa _respaldarFormulerio: esa
 * funcion respalda EXCLUSIVAMENTE "Inicio" y "Tablero" (ocho modulos ya la comparten con ese
 * alcance fijo); "Presupuesto" es una tercera hoja, asi que este modulo trae su propio
 * _respaldarPm con la misma tecnica (formulas congeladas como texto, releidas y verificadas
 * antes de mutar nada).
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @version 0.45.0
 * @since 2026-08-24
 * @lastModified 2026-08-24
 */

// ============================================
// GEOMETRIA (medida en docs/permanente/celdas.tsv -- snapshot del 2026-08-18 -- y confirmada
// por DISENO_HOJA_PRESUPUESTO.md, medido en vivo el 2026-08-24. El PREFLIGHT vuelve a medir
// todo esto contra la planilla viva antes de escribir una sola celda: "no asumas, medi y
// reporta" (pedido explicito del encargo). Ver "1. Ver estado" antes de "2. Aplicar".
// ============================================

const PM_TITULO = { celda: 'C2', esperado: 'Presupuesto financiero del Mes' };

const PM_SELECTORES = {
    rotuloPeriodo: { celda: 'I2', esperado: 'Periodo a Presupuestar' },
    mes: 'J2',
    anio: 'J3',
    rotuloMoneda: { celda: 'I4', esperado: 'Moneda' },
    moneda: 'J4'
};

/**
 * El selector de Modo (C7 rotulo, E7 valor). Los dos valores exactos que muestra la dropdown --
 * medidos en vivo, con sus acentos, porque son texto de UI igual que el resto de los rotulos de
 * esta hoja ("Categorias.", "Periodo a Presupuestar"). La LOGICA que decide que rama toma cada
 * formula NO compara contra estos literales exactos (ver _condModoHistoricoPm): compara si el
 * valor CONTIENE "hist", insensible a mayusculas/acentos, para no quedar fragil ante una tilde
 * que falte. Estos dos valores son la referencia de la VALIDACION (el dropdown) y del chequeo de
 * cordura del preflight (paso 2: "E7 dice algo que no es ninguno de los dos modos").
 */
const PM_MODO = {
    rotulo: { celda: 'C7', esperado: 'Modo' },
    celda: 'E7',
    proyeccion: 'Proyección',
    historico: 'Histórico'
};

// Las dos palabras del TITULO dinamico de J7/N7/R7 (DISENO_HOJA_PRESUPUESTO.md: "Monto
// Historico" o "Monto Proyectado"). Son un ADJETIVO, no el nombre del modo (que es un
// sustantivo, "Proyeccion"): por eso es una constante aparte y no PM_MODO.historico/proyeccion
// reciclados -- mezclarlos escribiria "Monto Proyeccion" en vez de "Monto Proyectado".
const PM_TITULO_PALABRA = { historico: 'Histórico', proyectado: 'Proyectado' };

/**
 * Los tres bloques que este encargo cablea. 'categorias' (U/V/W, "Monto Proyectado" agrupado
 * por categoria) QUEDA AFUERA A PROPOSITO: es la columna V, un encargo posterior.
 *
 * tipoQueResta: el mismo criterio de signo que _formulaRealidadIp (DEVTOOL_InicioPresupuesto.js)
 * -- un movimiento del tipo CONTRARIO resta: en Ingresos, un Egreso resta (una devolucion); en
 * Gastos, un Ingreso resta (un reintegro).
 */
const PM_BLOQUES = {
    ingresos: {
        colCuenta: 'I', colMonto: 'J',
        tituloBloque: { celda: 'I7', esperado: 'Ingresos' },
        rotuloCuenta: { celda: 'I8', esperado: 'Cuenta' },
        categoria: 'Ingreso', tipoQueResta: 'Egreso'
    },
    fijos: {
        colCuenta: 'M', colMonto: 'N',
        tituloBloque: { celda: 'M7', esperado: 'Gastos Fijos' },
        rotuloCuenta: { celda: 'M8', esperado: 'Cuenta' },
        categoria: 'Gasto Fijo', tipoQueResta: 'Ingreso'
    },
    variables: {
        colCuenta: 'Q', colMonto: 'R',
        tituloBloque: { celda: 'Q7', esperado: 'Gastos Variables' },
        rotuloCuenta: { celda: 'Q8', esperado: 'Cuenta' },
        categoria: 'Gasto Variable', tipoQueResta: 'Ingreso'
    }
};
const PM_CLAVES_BLOQUE = ['ingresos', 'fijos', 'variables'];

const PM_FILA_INI = 9;
// decision Franco 2026-08-24 (DISENO_HOJA_PRESUPUESTO.md, "Dos correcciones de Franco"): los
// cuatro bloques quedaron emparejados, todos espejan 30 filas.
const PM_FILAS = 30;
const PM_FILA_FIN = PM_FILA_INI + PM_FILAS - 1;   // 38
// Fila del SUM(col9:col) que YA EXISTE en la hoja (J8/N8/R8). Este modulo NUNCA la escribe: la
// LEE, como parte del invariante (ver cabecera).
const PM_FILA_TOTAL = 8;

const PM_MESES_HISTORICO = 6;
const PM_ALPHA = 0.65;   // ver la justificacion numerica completa en la cabecera del archivo

// decision Franco 2026-08-24: PM_ALPHA se usa DOS veces -- como numero JS (el recalculo del
// invariante y el banco de pruebas, donde 0.65 no tiene ningun problema) y adentro de una
// FORMULA DE HOJA (_formulaMontoPm), donde SI lo tiene. Ya esta documentado en este mismo repo
// (00_Config.js/IP_BLOQUE, DEVTOOL_InicioPresupuesto.js): "un literal decimal con coma es
// ambiguo dentro de una formula con separador ';' y uno con punto depende del locale; una
// fraccion no depende de nada". 0.65 = 13/20 exacto (sin error de redondeo binario: ver el
// banco, que verifica esta igualdad para que las dos constantes no puedan desincronizarse).
const PM_ALPHA_FRACCION = '(13/20)';

const PM_UMBRAL_IDENTIDAD = 0.01;

const PM_PROP_RESPALDO = 'presupuesto_modo_respaldo';
const PM_PROP_PREVIOS = 'presupuesto_modo_previos';
const PM_PREFIJO_RESPALDO = 'Respaldo presupuesto modo ';

// ============================================
// GEOMETRIA DERIVADA
// ============================================

/** '$I$9' desde 'I9': toda referencia a una celda-fuente puntual va absoluta. */
function _absPm(celda) {
    const m = String(celda).match(/^([A-Z]+)([0-9]+)$/);
    return '$' + m[1] + '$' + m[2];
}

// ============================================
// FORMULAS
// ============================================

/**
 * La condicion de modo que comparten el titulo y el monto: "el valor de E7 contiene 'hist'",
 * insensible a mayusculas y sin exigir el acento exacto. Robusta a que el dropdown muestre
 * "Historico" o "Histórico", a mayusculas sueltas o a un espacio de mas -- la MISMA leccion de
 * locale que ya costo tres bugs en este repo (ver DEVTOOL_InicioPresupuesto.js, "EL TEXTO DE LOS
 * TRES DELTAS"): no asumir la forma exacta de un string cuando alcanza con reconocer el patron.
 * Cualquier otro valor de E7 (incluida "Proyección" o una celda vacia) cae en la rama Proyeccion.
 */
function _condModoHistoricoPm() {
    return 'REGEXMATCH(LOWER(TRIM(' + _absPm(PM_MODO.celda) + ')); "hist")';
}

/** El fragmento LET compartido: las columnas del ledger y la conversion via TC congelados. */
function _preludioMontoPm() {
    const selMoneda = _absPm(PM_SELECTORES.moneda);
    return '  monto; ' + _colLedger('monto') + ';\n' +
        '  tipo_mov; ' + _colLedger('tipo') + ';\n' +
        '  cuenta_mov; ' + _colLedger('cuenta') + ';\n' +
        '  cat_mov; ' + _colLedger('tipo_cuenta') + ';\n' +
        '  moneda_mov; ' + _colLedger('moneda') + ';\n' +
        '  fecha_mov; ' + _colLedger('fecha') + ';\n' +
        '  tc_ars; ' + _colLedger('tc_ars') + ';\n' +
        '  tc_usd; ' + _colLedger('tc_usd') + ';\n' +
        '  tc_aud; ' + _colLedger('tc_aud') + ';\n' +
        '  tc_eur; ' + _colLedger('tc_eur') + ';\n' +
        '  tasa_origen; ARRAYFORMULA(IF(moneda_mov="ARS"; tc_ars; IF(moneda_mov="USD"; tc_usd; IF(moneda_mov="AUD"; tc_aud; tc_eur))));\n' +
        '  tasa_destino; ARRAYFORMULA(IF(' + selMoneda + '="ARS"; tc_ars; IF(' + selMoneda + '="USD"; tc_usd; IF(' + selMoneda + '="AUD"; tc_aud; tc_eur))));\n';
}

/** El mes de referencia: el mes calendario ANTERIOR al periodo de J2/J3 (ver cabecera). */
function _fragmentoMesRefPm() {
    const selMes = _absPm(PM_SELECTORES.mes);
    const selAnio = _absPm(PM_SELECTORES.anio);
    return '  mes_num; MATCH(' + selMes + '; SPLIT("' + IP_MESES + '"; ","); 0);\n' +
        '  ancla_periodo; DATE(' + selAnio + '; mes_num; 1);\n' +
        '  mes_ref; EDATE(ancla_periodo; -1);\n';
}

/**
 * El monto de UNA cuenta (una fila de un bloque) segun el modo vivo de E7. Reusa el criterio de
 * "neto_mov" y la exclusion de cuentas neutras de _formulaRealidadIp (DEVTOOL_InicioPresupuesto)
 * pero, a diferencia de esa formula (siempre ARS), convierte a la moneda de J4 usando la MISMA
 * fila del ledger para origen y destino (ver cabecera del archivo: "no hace falta ninguna
 * cotizacion en vivo").
 *
 * Toda condicion ligada a una variable de LET va en ARRAYFORMULA (la interseccion implicita es
 * la trampa que ya rompio C15/F15 de Inicio, DEVTOOL_FormulerioV0111.js, defecto quinto).
 */
function _formulaMontoPm(claveBloque, fila) {
    const b = PM_BLOQUES[claveBloque];
    const celdaCuenta = _absPm(b.colCuenta + fila);
    return '=LET(\n' +
        _preludioMontoPm() +
        _fragmentoMesRefPm() +
        '  neto_mov; ARRAYFORMULA(IF(tipo_mov="' + b.tipoQueResta + '"; -monto; monto) * tasa_origen / tasa_destino);\n' +
        '  suma_mes; LAMBDA(ini_m; fin_m; LET(\n' +
        '    del_mes; ARRAYFORMULA((cuenta_mov=' + celdaCuenta + ') * (cat_mov="' + b.categoria + '") * (cuenta_mov<>"") * ' +
        _exclusionNeutrasIp('cuenta_mov') + ' * (fecha_mov>=ini_m) * (fecha_mov<=fin_m));\n' +
        '    SUM(IFERROR(FILTER(neto_mov; del_mes); 0))\n' +
        '  ));\n' +
        '  IF(' + celdaCuenta + '=""; "";\n' +
        '    IF(' + _condModoHistoricoPm() + ';\n' +
        '      LET(\n' +
        '        serie; MAP(SEQUENCE(' + PM_MESES_HISTORICO + '); LAMBDA(k_mes; LET(\n' +
        '          ini_k; EDATE(mes_ref; k_mes - ' + PM_MESES_HISTORICO + ');\n' +
        '          fin_k; EOMONTH(ini_k; 0);\n' +
        '          suma_mes(ini_k; fin_k)\n' +
        '        )));\n' +
        '        pesos; MAP(SEQUENCE(' + PM_MESES_HISTORICO + '); LAMBDA(k_mes; ' + PM_ALPHA_FRACCION + '^(' + PM_MESES_HISTORICO + ' - k_mes)));\n' +
        '        SUMPRODUCT(serie; pesos) / SUM(pesos)\n' +
        '      );\n' +
        '      suma_mes(mes_ref; EOMONTH(mes_ref; 0))\n' +
        '    )\n' +
        '  )\n)';
}

/**
 * El titulo dinamico de J7/N7/R7: "Monto " + salto de linea + "Historico" o "Proyectado", segun
 * el MISMO modo que lee _formulaMontoPm (ver _condModoHistoricoPm). El salto de linea via
 * CHAR(10) replica el formato de dos renglones que ya tenian estas celdas como texto estatico
 * (medido: "Monto " + salto + "Historico"), asi que el cambio no mueve el layout visual.
 */
function _formulaTituloMontoPm() {
    return '=IF(' + _condModoHistoricoPm() + '; "Monto "&CHAR(10)&"' + PM_TITULO_PALABRA.historico +
        '"; "Monto "&CHAR(10)&"' + PM_TITULO_PALABRA.proyectado + '")';
}

/** La validacion de datos del selector de Modo: exactamente las dos opciones medidas. */
function _construirValidacionModoPm() {
    return SpreadsheetApp.newDataValidation()
        .requireValueInList([PM_MODO.proyeccion, PM_MODO.historico], true)
        .setAllowInvalid(false)
        .build();
}

// ============================================
// EL INVARIANTE, EN JS PURO (ver cabecera: "EL INVARIANTE")
// ============================================

/** true si un valor de E7 (o cualquier variante) activa la rama Historico. Espeja _condModoHistoricoPm. */
function _esModoHistoricoPm(valor) {
    return /hist/i.test(String(valor === null || valor === undefined ? '' : valor).trim());
}

/** EDATE en JS: fecha +/- n meses, preservando el dia (alcanza con dia=1, que es lo unico que usa este modulo). */
function _edateMesesPm(fecha, delta) {
    return new Date(fecha.getFullYear(), fecha.getMonth() + delta, fecha.getDate());
}

/** EOMONTH(fecha; 0) en JS: el ultimo dia del mes de `fecha`. */
function _finDeMesPm(fecha) {
    return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** El mes de referencia (ver cabecera) a partir de los valores vivos de J2/J3. Null si no son validos. */
function _mesRefDesdeSelectoresPm(mesTexto, anio) {
    const meses = IP_MESES.split(',');
    const idx = meses.map(_normalizarRotulo).indexOf(_normalizarRotulo(mesTexto));
    if (idx === -1 || !isFinite(anio)) return null;
    return _edateMesesPm(new Date(anio, idx, 1), -1);
}

/** La tasa congelada de una fila del ledger para una moneda dada, o null si no hay dato. */
function _tasaFilaPm(fila, moneda) {
    let v;
    if (moneda === 'ARS') v = fila.tc_ars;
    else if (moneda === 'USD') v = fila.tc_usd;
    else if (moneda === 'AUD') v = fila.tc_aud;
    else if (moneda === 'EUR') v = fila.tc_eur;
    else return null;
    return (typeof v === 'number' && isFinite(v) && v > 0) ? v : null;
}

/**
 * Recalculo en JS puro del monto de una ventana [desde,hasta], espejo de la parte "suma_mes" de
 * _formulaMontoPm. `cuenta=null` suma TODA la categoria (lo que usa el invariante); una cuenta
 * puntual filtra como cada celda J/N/R.
 */
function _sumaMesPm(filas, cuenta, categoria, tipoQueResta, monedaDestino, desde, hasta) {
    let total = 0;
    for (let i = 0; i < filas.length; i++) {
        const f = filas[i];
        if (cuenta !== null && f.cuenta !== cuenta) continue;
        if (f.tipo_cuenta !== categoria) continue;
        if (!f.cuenta || esCuentaNeutra(f.cuenta)) continue;
        if (!(f.fecha >= desde && f.fecha <= hasta)) continue;
        const tasaOrigen = _tasaFilaPm(f, f.moneda);
        const tasaDestino = _tasaFilaPm(f, monedaDestino);
        if (tasaOrigen === null || tasaDestino === null) continue;   // sin TC congelado: se excluye, no se inventa un 0 que tape el hueco
        const monto = f.tipo === tipoQueResta ? -f.monto : f.monto;
        total += monto * tasaOrigen / tasaDestino;
    }
    return total;
}

/** El promedio ponderado exponencial (modo Historico), espejo JS de la rama "historico" de _formulaMontoPm. */
function _promedioPonderadoPm(filas, cuenta, categoria, tipoQueResta, monedaDestino, mesRef) {
    let sumaPesos = 0, sumaPonderada = 0;
    for (let k = 1; k <= PM_MESES_HISTORICO; k++) {
        const iniK = _edateMesesPm(mesRef, k - PM_MESES_HISTORICO);
        const finK = _finDeMesPm(iniK);
        const valor = _sumaMesPm(filas, cuenta, categoria, tipoQueResta, monedaDestino, iniK, finK);
        const peso = Math.pow(PM_ALPHA, PM_MESES_HISTORICO - k);
        sumaPonderada += valor * peso;
        sumaPesos += peso;
    }
    return sumaPesos ? sumaPonderada / sumaPesos : 0;
}

/** Lee "Registros" entero y lo devuelve como filas parseadas, listas para _sumaMesPm/_promedioPonderadoPm. */
function _leerRegistrosPm(ss) {
    const hoja = ss.getSheetByName(RANGES.REGISTROS.sheet);
    if (!hoja) return [];
    const ultFila = hoja.getLastRow();
    const filaIni = RANGES.REGISTROS.dataRow;
    if (ultFila < filaIni) return [];
    const colIni = columnLetterToIndex(RANGES.REGISTROS.start);
    const nCols = columnLetterToIndex(RANGES.REGISTROS.end) - colIni + 1;
    const valores = hoja.getRange(filaIni, colIni, ultFila - filaIni + 1, nCols).getValues();
    const idx = function (clave) { return columnLetterToIndex(RANGES.REGISTROS.columns[clave]) - colIni; };
    const iMonto = idx('monto'), iTipo = idx('tipo'), iCuenta = idx('cuenta'), iCat = idx('tipo_cuenta'),
        iMoneda = idx('moneda'), iFecha = idx('fecha'), iArs = idx('tc_ars'), iUsd = idx('tc_usd'),
        iAud = idx('tc_aud'), iEur = idx('tc_eur');
    const salida = [];
    for (let r = 0; r < valores.length; r++) {
        const fila = valores[r];
        const cuenta = String(fila[iCuenta] || '').trim();
        const fecha = fila[iFecha];
        if (!cuenta || !(fecha instanceof Date)) continue;
        salida.push({
            monto: Number(fila[iMonto]) || 0, tipo: String(fila[iTipo] || '').trim(),
            cuenta: cuenta, tipo_cuenta: String(fila[iCat] || '').trim(),
            moneda: String(fila[iMoneda] || '').trim(), fecha: fecha,
            tc_ars: Number(fila[iArs]) || 0, tc_usd: Number(fila[iUsd]) || 0,
            tc_aud: Number(fila[iAud]) || 0, tc_eur: Number(fila[iEur]) || 0
        });
    }
    return salida;
}

// ============================================
// PREFLIGHT
// ============================================

/**
 * Verifica que la hoja "Presupuesto" sea la que este modulo cree que es, ANTES de que nadie
 * escriba. Todo por ROTULO; aborta lanzando ante la minima discrepancia.
 */
function _preflightPm(ss) {
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

    // --- 1. Titulo y selectores de periodo/moneda ---
    chequear(PM_TITULO.celda, PM_TITULO.esperado);
    chequear(PM_SELECTORES.rotuloPeriodo.celda, PM_SELECTORES.rotuloPeriodo.esperado);
    chequear(PM_SELECTORES.rotuloMoneda.celda, PM_SELECTORES.rotuloMoneda.esperado);
    const mesVivo = String(vivoDe(PM_SELECTORES.mes) || '').trim();
    const mesesNorm = IP_MESES.split(',').map(_normalizarRotulo);
    if (mesesNorm.indexOf(_normalizarRotulo(mesVivo)) === -1) {
        desvios.push(PM_SELECTORES.mes + ' dice "' + mesVivo + '", que no es un mes en espanol');
    }
    const anioVivo = Number(vivoDe(PM_SELECTORES.anio));
    if (!isFinite(anioVivo) || anioVivo < 2000 || anioVivo > 2100) {
        desvios.push(PM_SELECTORES.anio + ' dice "' + vivoDe(PM_SELECTORES.anio) + '", que no es un anio plausible');
    }
    const monedaViva = String(vivoDe(PM_SELECTORES.moneda) || '').trim();
    if (MONEDAS_DISPONIBLES.indexOf(monedaViva) === -1) {
        desvios.push(PM_SELECTORES.moneda + ' dice "' + monedaViva + '" y no es ninguna moneda del sistema (' +
            MONEDAS_DISPONIBLES.join(', ') + ')');
    }

    // --- 2. El selector de Modo: rotulo y un valor reconocible ---
    chequear(PM_MODO.rotulo.celda, PM_MODO.rotulo.esperado);
    const modoVivo = String(vivoDe(PM_MODO.celda) || '').trim();
    const esProyeccion = _rotulosCompatibles(modoVivo, PM_MODO.proyeccion);
    const esHistorico = _rotulosCompatibles(modoVivo, PM_MODO.historico);
    if (!esProyeccion && !esHistorico) {
        desvios.push(PM_MODO.celda + ' dice "' + modoVivo + '", que no es "' + PM_MODO.proyeccion +
            '" ni "' + PM_MODO.historico + '"');
    }

    // --- 3. Los tres bloques: titulo y rotulo "Cuenta" ---
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const b = PM_BLOQUES[k];
        chequear(b.tituloBloque.celda, b.tituloBloque.esperado);
        chequear(b.rotuloCuenta.celda, b.rotuloCuenta.esperado);
    });

    if (desvios.length) {
        throw new Error('La hoja "' + nombre + '" no es la que este modulo espera: ' + desvios.join('; ') +
            '. Hay que volver a medir antes de escribir. No se toco nada.');
    }

    // --- 4. E7 no puede ser la mitad muda de una celda combinada (trampa medida en este repo) ---
    const rangoModo = hoja.getRange(PM_MODO.celda);
    if (rangoModo.isPartOfMerge()) {
        const ancla = rangoModo.getMergedRanges()[0].getCell(1, 1);
        if (ancla.getA1Notation() !== PM_MODO.celda) {
            throw new Error(PM_MODO.celda + ' es la mitad muda de una celda combinada (la anda es ' +
                ancla.getA1Notation() + '): escribir la validacion ahi no haria nada. No se toco nada.');
        }
    }

    // --- 5. La validacion de datos de E7: si existe, tiene que ser la lista de estos dos modos ---
    const validacionViva = rangoModo.getDataValidation();
    let validacion = { existe: false, correcta: false };
    if (validacionViva) {
        validacion.existe = true;
        const tipo = String(validacionViva.getCriteriaType());
        const valores = validacionViva.getCriteriaValues() || [];
        if (tipo.indexOf('VALUE_IN_LIST') !== -1 && valores[0]) {
            const vivas = valores[0].map(_normalizarRotulo).slice().sort();
            const esperadas = [PM_MODO.proyeccion, PM_MODO.historico].map(_normalizarRotulo).sort();
            validacion.correcta = JSON.stringify(vivas) === JSON.stringify(esperadas);
        }
        if (!validacion.correcta) {
            throw new Error(PM_MODO.celda + ' ya tiene una validacion de datos que NO son exactamente ' +
                '"' + PM_MODO.proyeccion + '" / "' + PM_MODO.historico + '" (tipo ' + tipo + ', valores ' +
                JSON.stringify(valores) + '). Puede ser una eleccion deliberada de Franco: este modulo no ' +
                'la pisa sin confirmar. No se toco nada.');
        }
    }

    // --- 6. El espejo de cuentas (I/M/Q) tiene que cubrir TODA la banda 9-38 con formula: sin ---
    // --- eso no hay nombre de cuenta contra el cual filtrar ("Tienen que aparecer TODAS las ---
    // --- cuentas", DISENO_HOJA_PRESUPUESTO.md). ---
    const sinMirror = [];
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const col = PM_BLOQUES[k].colCuenta;
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            if (!hoja.getRange(col + f).getFormula()) sinMirror.push(col + f);
        }
    });
    if (sinMirror.length) {
        throw new Error('El espejo del Plan de Cuentas no cubre toda la banda ' + PM_FILA_INI + '-' +
            PM_FILA_FIN + ' en "' + nombre + '": faltan formulas en ' + sinMirror.slice(0, 8).join(', ') +
            (sinMirror.length > 8 ? ' (y ' + (sinMirror.length - 8) + ' mas)' : '') +
            '. Sin espejo no hay cuenta contra la cual filtrar. No se toco nada.');
    }

    // --- 7. La zona destino (J/N/R, 9-38) no puede tener VALORES estaticos: seria dato de ---
    // --- Franco y este modulo no pisa datos. ---
    const conValor = [];
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const col = PM_BLOQUES[k].colMonto;
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            const r = hoja.getRange(col + f);
            if (!r.getFormula() && String(r.getValue()) !== '') conValor.push(col + f);
        }
    });
    if (conValor.length) {
        throw new Error('Hay valores escritos a mano en ' + conValor.slice(0, 8).join(', ') +
            (conValor.length > 8 ? ' (y ' + (conValor.length - 8) + ' mas)' : '') +
            ': puede ser dato de Franco y este modulo no pisa datos. Vaciarlas antes de correr. No se toco nada.');
    }

    // --- 8. Los tres titulos (J7/N7/R7) no pueden ser la mitad muda de una combinada ---
    const tituloCombinado = [];
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const celda = PM_BLOQUES[k].colMonto + '7';
        const r = hoja.getRange(celda);
        if (r.isPartOfMerge()) {
            const ancla = r.getMergedRanges()[0].getCell(1, 1);
            if (ancla.getA1Notation() !== celda) tituloCombinado.push(celda + ' (ancla real: ' + ancla.getA1Notation() + ')');
        }
    });
    if (tituloCombinado.length) {
        throw new Error('Estas celdas de titulo son la mitad muda de una combinada: ' +
            tituloCombinado.join(', ') + '. No se toco nada.');
    }

    // --- 9. La fila de totales (J8/N8/R8) tiene que tener formula: el invariante la lee ---
    const sinTotal = [];
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const celda = PM_BLOQUES[k].colMonto + PM_FILA_TOTAL;
        if (!hoja.getRange(celda).getFormula()) sinTotal.push(celda);
    });
    if (sinTotal.length) {
        throw new Error('Estas celdas de total no tienen formula: ' + sinTotal.join(', ') +
            '. El invariante de este modulo las necesita para comparar contra el recalculo en JS. No se toco nada.');
    }

    return { hoja: hoja, nombre: nombre, modoVivo: modoVivo, validacion: validacion };
}

// ============================================
// PLAN
// ============================================

/**
 * Construye el plan leyendo lo vivo. No escribe nada. Salta lo que ya esta identico
 * (idempotencia). J7/N7/R7 HOY son texto ESTATICO (medido: "Monto " + salto de linea +
 * "Historico"), no formula -- por eso `proponer` tambien captura `valorActual` (igual que
 * `_planIp` en DEVTOOL_InicioPresupuesto.js, cabecera "aca hay celdas cuyo estado previo era un
 * VALOR"): sin esto, revertir perderia el texto original de Franco en vez de restaurarlo.
 */
function _planPm(pre) {
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

    PM_CLAVES_BLOQUE.forEach(function (k) {
        proponer(PM_BLOQUES[k].colMonto + '7', 'Titulo: ' + k, _formulaTituloMontoPm(),
            '"Monto Historico" o "Monto Proyectado" segun ' + PM_MODO.celda);
    });

    PM_CLAVES_BLOQUE.forEach(function (k) {
        const col = PM_BLOQUES[k].colMonto;
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            proponer(col + f, 'Monto: ' + k + ' fila ' + f, _formulaMontoPm(k, f),
                'mes de referencia (Proyeccion) o promedio ponderado de ' + PM_MESES_HISTORICO + ' meses (Historico)');
        }
    });

    return { cambios: cambios, faltaValidacion: !pre.validacion.existe };
}

// ============================================
// RESPALDO
// ============================================

/**
 * Congela TODAS las formulas de "Presupuesto" (no solo las que se van a tocar) en una hoja
 * nueva, oculta, y la RELEE para verificarla -- misma tecnica que _respaldarFormulerio
 * (DEVTOOL_FormulerioV0111.js), pero acotada a esta unica hoja porque esa funcion compartida
 * solo respalda "Inicio" y "Tablero" (ver cabecera del archivo).
 */
function _respaldarPm(ss, sello) {
    const nombreHoja = SHEETS.PRESUPUESTO;
    const hoja = ss.getSheetByName(nombreHoja);
    const nombre = _nombreHojaLibreFormulerio(ss, PM_PREFIJO_RESPALDO + sello);

    const ultFila = Math.max(1, hoja.getLastRow());
    const ultCol = Math.max(1, hoja.getLastColumn());
    let filasLeer = ultFila;
    const acotados = [];
    if (ultFila * ultCol > FORM_TOPE_CELDAS_RESPALDO) {
        filasLeer = Math.max(FORM_MIN_FILAS_RESPALDO, Math.floor(FORM_TOPE_CELDAS_RESPALDO / ultCol));
        acotados.push(nombreHoja + ': se respaldaron las primeras ' + filasLeer + ' de ' + ultFila + ' filas');
    }

    const formulas = hoja.getRange(1, 1, filasLeer, ultCol).getFormulas();
    const filas = [];
    for (let r = 0; r < formulas.length; r++) {
        for (let c = 0; c < formulas[r].length; c++) {
            const f = formulas[r][c];
            if (!f) continue;
            filas.push([nombreHoja, columnIndexToLetter(c + 1) + (r + 1), "'" + f]);
        }
    }
    if (!filas.length) {
        throw new Error('No se encontro ninguna formula en "' + nombreHoja + '". Sin nada que respaldar ' +
            'no hay punto de retorno, asi que tampoco se escribe.');
    }

    const destino = ss.insertSheet(nombre);
    invalidarCacheNombresHojas();
    destino.getRange(1, 1, 1, 3).setValues([['hoja', 'celda', 'formula']]);
    destino.getRange(2, 1, filas.length, 3).setValues(filas);
    SpreadsheetApp.flush();

    const leidas = _leerRespaldoFormulerio(destino);
    const fallas = [];
    if (leidas.length !== filas.length) {
        fallas.push('se escribieron ' + filas.length + ' formula(s) y al releer aparecen ' + leidas.length);
    } else {
        for (let i = 0; i < filas.length; i++) {
            const esperado = filas[i][2].substring(1);
            if (leidas[i].formula !== esperado || leidas[i].nombreHoja !== filas[i][0] || leidas[i].celda !== filas[i][1]) {
                fallas.push('la fila ' + (i + 2) + ' del respaldo no coincide con la formula viva');
                break;
            }
        }
    }
    const vivas = destino.getRange(2, 3, filas.length, 1).getFormulas();
    for (let i = 0; i < vivas.length; i++) {
        if (vivas[i][0]) { fallas.push('la fila ' + (i + 2) + ' quedo como formula VIVA en el respaldo, no como texto'); break; }
    }
    if (fallas.length) {
        throw new Error('El respaldo quedo en "' + nombre + '" pero NO VERIFICA: ' + fallas.join('; ') +
            '. No se muto ninguna formula.');
    }

    destino.hideSheet();
    logInfo('_respaldarPm: ' + filas.length + ' formulas congeladas y verificadas en "' + nombre + '".');
    return { nombre: nombre, filas: filas.length, acotados: acotados };
}

// ============================================
// VERIFICACION E INVARIANTE
// ============================================

/**
 * Ver "EL INVARIANTE" en la cabecera del archivo. Recalcula en JS puro (leyendo Registros con
 * getValues(), sin ninguna formula) el total agregado de cada bloque para el mes de referencia
 * (o el promedio ponderado, segun el modo vivo) y lo compara contra J8/N8/R8 -- que YA suman lo
 * que este modulo escribio en la banda 9-38. Ademas confirma que ninguna celda de la banda quedo
 * en error y que los tres titulos muestran la palabra que corresponde al modo vivo.
 */
function _verificarInvariantesPm(ss, hoja) {
    const fallas = [];
    const avisos = [];

    const modoVivo = String(hoja.getRange(PM_MODO.celda).getValue() || '').trim();
    const esHistorico = _esModoHistoricoPm(modoVivo);
    const mesRef = _mesRefDesdeSelectoresPm(hoja.getRange(PM_SELECTORES.mes).getValue(), Number(hoja.getRange(PM_SELECTORES.anio).getValue()));
    const monedaDestino = String(hoja.getRange(PM_SELECTORES.moneda).getValue() || '').trim();

    PM_CLAVES_BLOQUE.forEach(function (k) {
        const b = PM_BLOQUES[k];
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            const err = _errorDeCelda(hoja.getRange(b.colMonto + f));
            if (err) fallas.push(b.colMonto + f + ' quedo en ' + err);
        }
    });

    if (!mesRef) {
        avisos.push('no se pudo determinar el mes de referencia a partir de ' + PM_SELECTORES.mes + '/' +
            PM_SELECTORES.anio + ': se omite el invariante de totales.');
    } else {
        const filas = _leerRegistrosPm(ss);
        PM_CLAVES_BLOQUE.forEach(function (k) {
            const b = PM_BLOQUES[k];
            const totalEsperado = esHistorico
                ? _promedioPonderadoPm(filas, null, b.categoria, b.tipoQueResta, monedaDestino, mesRef)
                : _sumaMesPm(filas, null, b.categoria, b.tipoQueResta, monedaDestino, mesRef, _finDeMesPm(mesRef));
            const celdaTotal = b.colMonto + PM_FILA_TOTAL;
            const totalVivo = hoja.getRange(celdaTotal).getValue();
            if (typeof totalVivo !== 'number' || !isFinite(totalVivo)) {
                fallas.push(celdaTotal + ' no releyo un numero (deberia sumar ' + b.colMonto + PM_FILA_INI +
                    ':' + b.colMonto + PM_FILA_FIN + ')');
                return;
            }
            const desvio = Math.abs(totalVivo - totalEsperado);
            if (desvio >= PM_UMBRAL_IDENTIDAD) {
                fallas.push(celdaTotal + ' = ' + totalVivo.toFixed(2) + ' pero "' + b.categoria + '" recalculado ' +
                    'de forma independiente en JS para ' + mesRef.getFullYear() + '-' + (mesRef.getMonth() + 1) +
                    (esHistorico ? ' (promedio ponderado de ' + PM_MESES_HISTORICO + ' meses)' : '') +
                    ' da ' + totalEsperado.toFixed(2) + ' (desvio ' + desvio.toFixed(2) + '). Puede haber una ' +
                    'cuenta fuera del espejo, un filtro de fecha corrido o una moneda mal aplicada.');
            }
        });
    }

    const tituloEsperado = esHistorico ? PM_TITULO_PALABRA.historico : PM_TITULO_PALABRA.proyectado;
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const celda = PM_BLOQUES[k].colMonto + '7';
        const texto = String(hoja.getRange(celda).getDisplayValue() || '');
        if (texto.indexOf(tituloEsperado) === -1) {
            fallas.push(celda + ' muestra "' + texto + '" y se esperaba que contuviera "' + tituloEsperado + '"');
        }
    });

    return { fallas: fallas, avisos: avisos };
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: preflight + plan. No escribe nada. */
function estadoPresupuestoModo() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPm(ss);
        const plan = _planPm(pre);

        const l = ['PRESUPUESTO: SELECTOR DE MODO - ESTADO (no se escribio nada)', ''];
        l.push('Modo vivo en ' + PM_MODO.celda + ': "' + pre.modoVivo + '"');
        l.push('Validacion de datos en ' + PM_MODO.celda + ': ' +
            (pre.validacion.existe ? 'ya existe y coincide con los dos modos' : 'NO EXISTE (se va a agregar)'));
        l.push('');
        if (!plan.cambios.length && !plan.faltaValidacion) {
            l.push('NADA QUE HACER: las columnas J/N/R (filas ' + PM_FILA_INI + '-' + PM_FILA_FIN +
                ') y sus titulos ya estan como corresponde.');
        } else {
            l.push('CELDAS A ESCRIBIR: ' + plan.cambios.length + (plan.faltaValidacion ? ' + la validacion de ' + PM_MODO.celda : ''));
            l.push('');
            l.push('QUE CAMBIA:');
            l.push('  - J7/N7/R7: titulo dinamico "Monto Historico" / "Monto Proyectado" segun ' + PM_MODO.celda + '.');
            l.push('  - J9:J38, N9:N38, R9:R38: el monto de cada cuenta segun el modo -- el total del mes de');
            l.push('    referencia (Proyeccion) o el promedio ponderado exponencial de ' + PM_MESES_HISTORICO + ' meses (Historico).');
            if (plan.faltaValidacion) {
                l.push('  - ' + PM_MODO.celda + ' recibe una validacion de datos con exactamente dos opciones: "' +
                    PM_MODO.proyeccion + '" / "' + PM_MODO.historico + '".');
            }
        }
        const t = l.join('\n');
        _mostrarPm('Presupuesto: selector de Modo - estado', t);
        logInfo('estadoPresupuestoModo: ' + plan.cambios.length + ' celda(s) pendientes.');
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPm('Presupuesto: selector de Modo - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Aplica: preflight + respaldo + escritura + verificacion (invariante incluido) + reversion si falla. */
function aplicarPresupuestoModo() {
    let ui = null, ss = null, escritas = [], yaRevertido = false, validacionAgregada = false;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarPresupuestoModo necesita UI (menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPm(ss);
        const plan = _planPm(pre);

        if (!plan.cambios.length && !plan.faltaValidacion) {
            const t = 'Las columnas J/N/R y sus titulos ya estan como corresponde. No se escribio nada.';
            _mostrarPm('Presupuesto: selector de Modo', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Presupuesto: selector de Modo',
            'Se van a escribir ' + plan.cambios.length + ' celda(s) de "' + pre.nombre + '"' +
            (plan.faltaValidacion ? ', y se agrega la validacion de datos de ' + PM_MODO.celda : '') + '.\n\n' +
            'QUE CAMBIA:\n' +
            '  - J7/N7/R7 pasan a decir "Monto Historico" o "Monto Proyectado" segun ' + PM_MODO.celda + '.\n' +
            '  - J9:J38, N9:N38, R9:R38 (30 cuentas x 3 bloques) muestran, por cuenta:\n' +
            '      Proyeccion -> el total de esa cuenta en el mes CALENDARIO anterior al de ' + PM_SELECTORES.mes + '/' + PM_SELECTORES.anio + '.\n' +
            '      Historico  -> el promedio ponderado EXPONENCIAL de los ultimos ' + PM_MESES_HISTORICO + ' meses (alpha=' + PM_ALPHA + ':\n' +
            '                    el mes mas reciente pesa 8,6 veces el mas viejo de la ventana).\n' +
            '  - Convierten con los TC CONGELADOS de cada fila de Registros (nunca en vivo): sin\n' +
            '    "Loading...", la moneda de salida la manda ' + PM_SELECTORES.moneda + '.\n' +
            (plan.faltaValidacion
                ? '  - ' + PM_MODO.celda + ' recibe un desplegable con exactamente "' + PM_MODO.proyeccion + '" / "' + PM_MODO.historico + '".\n'
                : '') +
            '\nNO se toca K/O/S, la columna V, las tablas resumen ni el ledger.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarPm(ss, sello);

        // El estado previo de CADA celda, para la reversion PUBLICA (persistido en Document
        // Properties -- el respaldo de formulas no alcanza para J7/N7/R7, que hoy son texto
        // estatico sin formula: ver la cabecera de _planPm).
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
            const teniaValor = !c.formulaActual && String(c.valorActual) !== '';
            escritas.push({
                nombreHoja: pre.nombre, celda: c.celda,
                esValor: teniaValor, previoValor: teniaValor ? c.valorActual : undefined,
                previa: c.formulaActual, nueva: c.formulaNueva, errorPrevio: errorPrevio
            });
        });

        if (plan.faltaValidacion) {
            pre.hoja.getRange(PM_MODO.celda).setDataValidation(_construirValidacionModoPm());
            validacionAgregada = true;
        }
        SpreadsheetApp.flush();

        const fallasEscritura = _verificarEscrituraSyf(ss, escritas);
        const inv = _verificarInvariantesPm(ss, pre.hoja);
        const fallas = fallasEscritura.concat(inv.fallas);

        if (fallas.length) {
            _revertirEscriturasSyf(ss, escritas);
            if (validacionAgregada) pre.hoja.getRange(PM_MODO.celda).setDataValidation(null);
            yaRevertido = true;
            throw new Error('Se escribio pero NO VERIFICA: ' + fallas.join('; ') +
                '. Se restauro cada celda. El respaldo quedo en "' + respaldo.nombre + '".');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(PM_PROP_RESPALDO, respaldo.nombre);
        props.setProperty(PM_PROP_PREVIOS, JSON.stringify({
            respaldo: respaldo.nombre, validacionAgregada: validacionAgregada, celdas: previosCeldas
        }));

        const detalle = 'PRESUPUESTO: SELECTOR DE MODO APLICADO\n\n' +
            (inv.avisos.length ? 'PARA LEER:\n' + inv.avisos.map(function (a) { return '  - ' + a; }).join('\n') + '\n\n' : '') +
            '- Celdas escritas y verificadas: ' + escritas.length + '\n' +
            (validacionAgregada ? '- Validacion de datos agregada en ' + PM_MODO.celda + '\n' : '') +
            '- Respaldo en la hoja oculta "' + respaldo.nombre + '"\n' +
            '- Invariante verificado: J8/N8/R8 (SUM ya existente) coincide, recalculado de forma\n' +
            '  independiente en JS a partir de "Registros", para los tres bloques\n\n' +
            'QUE MIRAR:\n' +
            '  1. Cambiar ' + PM_MODO.celda + ' entre "' + PM_MODO.proyeccion + '" y "' + PM_MODO.historico +
            '" tiene que mover J/N/R y sus titulos, sin volver a correr este menu.\n' +
            '  2. Una fila sin cuenta mirror (I/M/Q vacia) queda en blanco, no en $0,00.\n\n' +
            'Si algo quedo peor: revertirPresupuestoModo (menu Tidetrack Dev).';

        logSuccess('aplicarPresupuestoModo: ' + escritas.length + ' celda(s).');
        _mostrarPm('Presupuesto: selector de Modo - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && escritas.length && !yaRevertido) {
            try {
                _revertirEscriturasSyf(ss, escritas);
                if (validacionAgregada) ss.getSheetByName(SHEETS.PRESUPUESTO).getRange(PM_MODO.celda).setDataValidation(null);
                restaurado = ' Se restauraron las celdas ya escritas.';
            } catch (e2) { restaurado = ' ADEMAS fallo la restauracion (' + e2.message + ').'; }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack });
        _mostrarPm('Presupuesto: selector de Modo - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Vuelve al estado previo a la ultima corrida aplicada. Usa `previos.celdas` (persistido en
 * Document Properties al aplicar, ver aplicarPresupuestoModo): para cada celda, si TENIA
 * formula la busca en el respaldo; si tenia un VALOR estatico (el caso de J7/N7/R7, texto
 * "Monto...Historico" antes de este modulo) lo repone tal cual; si estaba VACIA, la limpia.
 * No se reconstruye por diferencia contra el respaldo de formulas (que no captura valores): esa
 * version perdia el texto original de los titulos en vez de restaurarlo.
 */
function revertirPresupuestoModo() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const crudo = props.getProperty(PM_PROP_PREVIOS);
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

        let validacionQuitada = false;
        if (previos.validacionAgregada) {
            hoja.getRange(PM_MODO.celda).setDataValidation(null);
            validacionQuitada = true;
        }
        SpreadsheetApp.flush();
        props.deleteProperty(PM_PROP_PREVIOS);

        const t = 'PRESUPUESTO: SELECTOR DE MODO REVERTIDO\n\n- Celdas repuestas: ' + repuestas + '\n' +
            (validacionQuitada ? '- Validacion de datos de ' + PM_MODO.celda + ' quitada (este modulo la habia agregado)\n' : '') +
            (faltantes.length ? '- SIN respaldo (quedaron como estan): ' + faltantes.join(', ') + '\n' : '') +
            '- Respaldo usado: "' + previos.respaldo + '"' + (resp ? '' : ' (la hoja ya no existe)');
        logSuccess('revertirPresupuestoModo: ' + repuestas + ' celda(s).');
        _mostrarPm('Presupuesto: selector de Modo - revertido', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPm('Presupuesto: selector de Modo - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarPm(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
