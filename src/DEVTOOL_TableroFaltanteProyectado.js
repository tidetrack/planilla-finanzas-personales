/**
 * DEVTOOL_TableroFaltanteProyectado.js
 * Agrega el "Faltante proyectado" a los tres bloques de cuentas del Tablero (Ingresos, Gastos
 * Fijos, Gastos Variables): cada cuenta pasa a ocupar DOS FILAS.
 *
 * [CONCEPTO DE NEGOCIO]
 * Los tres bloques de cuentas del Tablero (Ingresos, Gastos Fijos, Gastos Variables) mostraban
 * SOLO lo REALMENTE registrado en el mes, cuenta por cuenta. Eso contesta "cuanto paso", pero no
 * "cuanto falta" -- si Franco proyecto $1.000.000 de una cuenta y van $837.728,28 cargados, la
 * planilla no decia nada sobre los $162.271,72 restantes. Peor: una cuenta proyectada que
 * TODAVIA no tuvo ningun movimiento real no aparecia en absoluto, asi que lo que falta cobrar o
 * pagar de esa cuenta era invisible.
 *
 * decision Franco 2026-08-21: cada cuenta pasa a ocupar DOS FILAS en vez de una. Arriba, el
 * nombre de la cuenta y lo REALMENTE registrado (oscuro, sin cambios de fondo). Abajo, SIN
 * nombre, el FALTANTE proyectado para esa cuenta este mes (gris). Franco eligio esta opcion
 * explicitamente sobre las alternativas de agregar una columna nueva o de mostrar solo un total:
 *
 *     Cuenta              Monto
 *     umoh              $837.728,28   <- oscuro (real)
 *                       $162.271,72   <- gris (falta)
 *     Tidetrack         $260.000,00
 *                        $40.000,00
 *
 * El total de faltantes de cada bloque va debajo del titulo (R8/U8/X8, rotulo ya escrito por
 * Franco; S8/V8/Y8 son las celdas de valor que este modulo cablea).
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: preflight por ROTULO que aborta ante la minima discrepancia,
 * respaldo congelado y verificado antes de mutar, verificacion del VALOR resultante, reversion
 * completa. Contrato de las tres publicas: { ok, detalle?, error? }.
 *
 * decision Franco 2026-08-21 (segunda ronda, capacidad y truncado): el bloque sube de 19 a 21
 * filas visibles (10 a 30, no 10 a 28) -- 10 pares cuenta/faltante en vez de 9, con UNA fila
 * sobrante que el diseno usa a proposito (ver decision #5). Y el comportamiento ante desborde
 * cambia de raiz: la version anterior ABORTABA si habia mas cuentas reales que lugar ("Agrandar
 * el bloque antes de correr esto"). Corrida contra la planilla real, esa version aborto con
 * Gastos Variables (10 cuentas reales, capacidad 9): Franco se quedo SIN la funcionalidad
 * entera por una sola cuenta de mas, y la proxima categoria nueva iba a repetir el problema. El
 * principio "nunca se recorta una cuenta real en silencio" seguia siendo correcto -- la
 * conclusion (abortar) no. La nueva regla es TRUNCAR A LA VISTA: se muestran las cuentas de
 * mayor monto que entran, y la ULTIMA FILA del bloque (la que la capacidad en pares siempre deja
 * libre, ver decision #5) pasa a decir cuantas quedaron afuera y por cuanta plata, en vez de
 * desaparecer sin que nadie se entere. Ver decision #5b (el aviso) y #7 (estado() con numeros).
 *
 * decision Franco 2026-08-21 (cuentas proyectadas sin movimiento real): SIGUEN apareciendo. Es
 * la razon de ser de este modulo entero -- el [CONCEPTO DE NEGOCIO] de arriba dice literal que
 * antes "una cuenta proyectada que TODAVIA no tuvo ningun movimiento real no aparecia en
 * absoluto, asi que lo que falta cobrar o pagar de esa cuenta era invisible". Sacarlas
 * reintroduciria exactamente ese problema. Lo que SI se garantiza (por construccion, no por un
 * chequeo aparte): el orden `SORT(tabla_incluida; 2; FALSE; 3; FALSE)` ordena PRIMERO por monto
 * real descendente, asi que NINGUNA cuenta proyectada-sin-real (real = 0) puede desplazar a una
 * con movimiento real de este mes, sin importar cuan grande sea lo proyectado -- las
 * proyectadas-sin-real siempre quedan despues de las que si tienen movimiento, y son las
 * primeras en truncarse si no entran todas. Ver el test "5c" (mutacion) del banco.
 *
 * DECISIONES DE DISENO
 *
 * 1. LA FORMULA "REAL" DE FRANCO SE REUSA VERBATIM, NUNCA SE REESCRIBE. R10 (y U10, X10) ya
 *    tienen una QUERY que agrupa el derrame del motor del Tablero (AJ:AV) por cuenta y suma con
 *    el signo correcto -- es la formula que hoy da $1.138.583,00 en Ingresos, $506.851,30 en
 *    Fijos y $460.820,83 en Variables (Agosto 2026 / ARS). Reconstruir esa logica en JS arriesga
 *    un desvio sutil (una cuenta que aparece en el ledger pero no en el catalogo, por ejemplo, y
 *    que la QUERY de Franco SI captura por ser data-driven). En cambio, el preflight LEE la
 *    formula viva de la celda ancla, verifica que tenga la forma esperada (QUERY, SUM(Col2),
 *    GROUP BY Col1, la categoria correcta) y la EMPOTRA tal cual dentro de un LET nuevo como
 *    variable `tabla_real`. El total de la columna Monto no se mueve ni un centavo por este
 *    cambio: se verifica al releer contra el valor que tenia ANTES de tocar nada.
 *
 * 2. LO PROYECTADO SE CALCULA FRESCO, cuenta por cuenta, desde la hoja "Proyeccion" (espejo de
 *    Registros), con el mismo criterio que DEVTOOL_Proyeccion usa para N9:N11 (mes/anio/moneda
 *    de $N$2/$N$3/$N$4, exclusion de cuentas neutras, conversion con TIDETRACK_*() en vivo
 *    porque un movimiento previsto no tiene TC congelado) pero agrupado POR CUENTA en vez de
 *    sumado en un solo total. El universo de cuentas a mirar es la UNION de la lista del
 *    catalogo del bloque (Plan de Cuentas, la misma que alimenta el desplegable de Cargas) y las
 *    cuentas que ya aparecen en `tabla_real` -- asi una cuenta proyectada sin catalogar no se
 *    pierde, y una cuenta con datos reales pero fuera del catalogo (si la hubiera) tampoco.
 *
 * 3. FALTANTE = MAX(0; proyectado - real). Nunca negativo: una cuenta que ya supero lo
 *    proyectado no "debe" nada, y unificar eso a 0 es lo que Franco pidio explicitamente. Una
 *    cuenta proyectada sin ningun movimiento real aparece igual, con su faltante completo.
 *
 * 4. LAS DOS FILAS SE ARMAN INTERCALANDO EN LA MISMA FORMULA (SEQUENCE + MOD para decidir fila
 *    par/impar, INDEX para leer la tabla ordenada). Sigue siendo UNA sola formula anclada en
 *    R10/U10/X10 que derrama R10:S30 (etc., la fila 30 solo si hace falta el aviso de truncado):
 *    no hay una segunda formula "faltante" (ni una tercera "aviso") aparte que pudiera
 *    desalinearse de la primera en un recalculo.
 *
 * 5. LA CAPACIDAD SE DERIVA DE UN SOLO NUMERO: TFP_FILA_FIN (30), compartido por los tres
 *    bloques. `_capacidadCuentasTfp` la convierte en pares (21 filas, 10 a 30 -> 10 pares
 *    cuenta/faltante, ARRAY_CONSTRAIN a esa MISMA capacidad) -- nunca dos numeros que puedan
 *    desincronizarse, mismo criterio que SYF_BLOQUE_MEDIOS.filaFin/_altoBloqueMedios
 *    (DEVTOOL_StockYFlujo). 21 es IMPAR: 10 pares ocupan 20 filas y sobra EXACTAMENTE una (la
 *    30, la ultima del bloque) -- ver decision #5b, esa fila sobrante no es un desperdicio, es
 *    donde vive el aviso de truncado.
 *
 * 5b. EL BLOQUE NO CRECE, PERO NUNCA ABORTA: TRUNCA A LA VISTA. Si el universo de cuentas (real
 *    union proyectadas-con-actividad este mes) supera la capacidad, la formula ordena por monto
 *    real descendente y despues por proyectado descendente (decision de arriba) y se queda con
 *    las `capacidad` mas importantes via ARRAY_CONSTRAIN -- eso ya pasaba antes. LO NUEVO: si
 *    `n_total > n_cuentas` (algo quedo afuera), la fila sobrante que deja la capacidad impar
 *    (decision #5) se ocupa con UNA fila de aviso: el nombre de cuenta lleva el texto
 *    "y N cuenta(s) mas" y el monto lleva la suma de lo que quedo afuera (real + faltante de las
 *    cuentas no mostradas, calculado como el total de `tabla_ordenada` menos el total de
 *    `tabla_topada` -- no hace falta re-sumar por separado, es la resta de las dos tablas que la
 *    formula ya tiene). Si nada quedo afuera, esa fila del derrame ni se genera: la fila 30
 *    queda vacia sola, sin que nadie tenga que "borrar el aviso a mano" -- desaparece cuando
 *    deja de hacer falta, que es la condicion que pidio Franco.
 *
 * 6. LOS TOTALES SE REESCRIBEN, Y EXCLUYEN LA FILA DE AVISO. S7 pasa de SUM(S10:S28) (que ahora
 *    sumaria real+faltante mezclados) a SUMIF(R10:R29;"<>";S10:S29) -- solo las filas CON nombre
 *    de cuenta EN EL RANGO DE DATOS (10 a 29, sin la fila 30 reservada al aviso: si la incluyera,
 *    el monto oculto del aviso se sumaria como si fuera "real" y el total dejaria de coincidir
 *    con el que tenia antes del cambio, rompiendo el invariante que este modulo verifica al
 *    releer). El nuevo S8 es el espejo exacto: SUMIF(R10:R29;"=";S10:S29), las filas SIN nombre
 *    del rango de datos, que son las de faltante. `_rangoColTfp` es el UNICO lugar que define
 *    ese rango (10 a filaFin-1): totales, la regla gris y el invariante de conteo de cuentas lo
 *    heredan todos de ahi, nunca se repite el numero 29 a mano en otro lado.
 *
 * 7. EL GRIS ES FORMATO CONDICIONAL, no pintura. El bloque es un derrame que se reordena en
 *    cada recalculo: una pintura estatica quedaria pegada a la FILA, no a si esa fila es "de
 *    cuenta" o "de faltante". La regla ("la celda de Cuenta de esta fila esta vacia mientras la
 *    de Monto no") usa ';' como separador (NUNCA coma: con coma Sheets acepta la regla y no
 *    pinta nada, sin avisar -- medido en DEVTOOL_FormatoMedios v0.33.0) y no necesita INDIRECT
 *    porque las dos columnas que compara estan en la MISMA hoja. El rango de esta regla es el
 *    rango DE DATOS (10 a 29): la fila de aviso (30) queda fuera a proposito, tiene su propia
 *    regla (decision #8) porque Franco pidio explicitamente que no se confunda con el gris ya
 *    establecido de "falta". Las reglas ajenas de la hoja se reponen intactas y por referencia
 *    (setConditionalFormatRules reemplaza TODAS las reglas).
 *
 * 8. EL AVISO DE TRUNCADO TIENE SU PROPIO TRATAMIENTO VISUAL, NO EL GRIS DE "FALTA". Franco lo
 *    pidio explicito: "el gris del faltante ya es un lenguaje establecido en ese bloque; quizas
 *    ese renglon merece su propio tratamiento". Se eligio la MISMA tinta (TFP_COLOR_GRIS: sigue
 *    siendo informacion secundaria, no un dato de cuenta) pero EN CURSIVA -- suficiente para no
 *    confundirse con una fila real (nombre + monto oscuro, sin cursiva) ni con una fila de falta
 *    (sin nombre, gris recto), sin inventar un color nuevo al design system. La regla es una
 *    CUARTA por bloque, con formula COMPLETAMENTE ABSOLUTA ($col$fila, sin relativas) porque
 *    esta fija a UNA sola fila conocida de antemano (filaFin, la reservada por la decision #5):
 *    no necesita evaluar "esta fila" como la regla gris (que recorre 20 filas), solo pregunta si
 *    ESA fila especifica tiene contenido en Monto. Como la fila de aviso siempre tiene el
 *    NOMBRE lleno (a diferencia de una fila de falta, que lo tiene vacio), las dos reglas nunca
 *    compiten por la misma celda.
 *
 * QUE NO HACE
 * 1. NO cambia el titulo de los bloques (R7/U7/X7) ni la geometria del Plan de Cuentas.
 * 2. NO toca "Categorias" ni ningun otro bloque del Tablero.
 * 3. NO agranda el bloque mas alla de R10:S30 / U10:V30 / X10:Y30: si no entra todo, TRUNCA a
 *    las cuentas de mayor monto y lo dice en la ultima fila del bloque (nunca invade lo que hay
 *    debajo, y nunca aborta dejando a Franco sin el tablero).
 *
 * Contrato de las tres publicas: { ok: boolean, detalle?: string, error?: string }.
 *   estadoTableroFaltanteProyectado()    -> solo lectura. Se corre PRIMERO.
 *   aplicarTableroFaltanteProyectado()   -> preflight + respaldo + escritura + verificacion.
 *   revertirTableroFaltanteProyectado()  -> restaura formulas, valores, formatos y reglas.
 *
 * Reusa helpers probados: _respaldarFormulerio, _leerRespaldoFormulerio, _errorDeCelda,
 * _normalizarRotulo, _rotulosCompatibles (DEVTOOL_FormulerioV0111); _refHoja, _colPlan,
 * _canonizarFormula (DEVTOOL_StockYFlujo); CAP_SELECTORES (DEVTOOL_Capitalizacion); PROY_MESES
 * (DEVTOOL_Proyeccion).
 *
 * @see docs/permanente/FORMULAS_TABLERO.md
 * @version 0.39.0
 * @since 2026-08-21
 * @lastModified 2026-08-21
 */

// ============================================
// GEOMETRIA (medida en vivo el 2026-08-21, verificada por rotulo en el preflight)
// ============================================

/**
 * Ultima fila del bloque de cuentas del Tablero: UNICO punto de verdad, compartido por los tres
 * bloques (Ingresos, Gastos Fijos, Gastos Variables).
 *
 * decision Franco 2026-08-21: sube de 28 a 30 ("visible hasta la fila 30. Si hay mas cuentas,
 * que aparezcan a medida que existe un registro"). Con filaDatos=10 son 21 filas -> 10 pares
 * cuenta/faltante (`_capacidadCuentasTfp`) y sobra UNA fila (21 es impar): esa fila sobrante es
 * la que ocupa el aviso de truncado cuando hace falta (ver decision #5b en la cabecera). Cambiar
 * este numero alcanza para mover la capacidad, el ARRAY_CONSTRAIN de `_formulaCuentasTfp` y el
 * rango de los totales/la regla gris (todos derivados, ninguno hardcodea filaFin de nuevo) --
 * mismo patron que SYF_BLOQUE_MEDIOS.filaFin en DEVTOOL_StockYFlujo.
 */
const TFP_FILA_FIN = 30;

const TFP_BLOQUES = {
    ingresos: {
        clave: 'ingresos', categoria: 'Ingreso',
        titulo: { celda: 'R7', esperado: 'Ingresos' },
        rotuloFaltante: { celda: 'R8', esperado: 'Faltante proyectado' },
        totalReal: 'S7', totalFaltante: 'S8',
        headerCuenta: { celda: 'R9', esperado: 'Cuenta' },
        headerMonto: { celda: 'S9', esperado: 'Monto' },
        colCuenta: 'R', colMonto: 'S',
        filaDatos: 10, filaFin: TFP_FILA_FIN
    },
    fijos: {
        clave: 'fijos', categoria: 'Gasto Fijo',
        titulo: { celda: 'U7', esperado: 'Gastos Fijos' },
        rotuloFaltante: { celda: 'U8', esperado: 'Faltante proyectado' },
        totalReal: 'V7', totalFaltante: 'V8',
        headerCuenta: { celda: 'U9', esperado: 'Cuenta' },
        headerMonto: { celda: 'V9', esperado: 'Monto' },
        colCuenta: 'U', colMonto: 'V',
        filaDatos: 10, filaFin: TFP_FILA_FIN
    },
    variables: {
        clave: 'variables', categoria: 'Gasto Variable',
        titulo: { celda: 'X7', esperado: 'Gastos Variables' },
        rotuloFaltante: { celda: 'X8', esperado: 'Faltante proyectado' },
        totalReal: 'Y7', totalFaltante: 'Y8',
        headerCuenta: { celda: 'X9', esperado: 'Cuenta' },
        headerMonto: { celda: 'Y9', esperado: 'Monto' },
        colCuenta: 'X', colMonto: 'Y',
        filaDatos: 10, filaFin: TFP_FILA_FIN
    }
};

/** Orden fijo de recorrido: el mismo en todos lados, para que planes y reportes calcen. */
const TFP_ORDEN = ['ingresos', 'fijos', 'variables'];

const TFP_PROP_RESPALDO = 'tablero_faltante_respaldo';
const TFP_PROP_PREVIOS = 'tablero_faltante_previos';

/** Tinta gris de las filas de faltante. Un solo tono: es texto, no una barra con riel. */
const TFP_COLOR_GRIS = '#757575';

// ============================================
// GEOMETRIA DERIVADA
// ============================================

/** Cuantos pares cuenta/faltante entran en el bloque, dado su alto en filas. */
function _capacidadCuentasTfp(b) {
    return Math.floor((b.filaFin - b.filaDatos + 1) / 2);
}

/** La celda ancla del derrame: donde vive HOY la QUERY de Franco y donde va la formula nueva. */
function _celdaAnclaTfp(b) {
    return b.colCuenta + b.filaDatos;
}

/**
 * La ULTIMA fila del bloque de datos propiamente dicho (pares cuenta/faltante), es decir
 * `b.filaFin` MENOS la fila que la capacidad impar deja sobrante (ver TFP_FILA_FIN y decision
 * #5b): esa fila sobrante (`b.filaFin`) esta reservada al aviso de truncado, nunca a un par de
 * datos, asi que ni los totales ni la regla gris ni el conteo de cuentas del invariante deben
 * incluirla como si fuera una cuenta mas.
 */
function _filaFinDatosTfp(b) {
    return b.filaFin - 1;
}

/** El rango de DATOS de la columna Cuenta (o Monto) de un bloque: excluye la fila de aviso. */
function _rangoColTfp(b, col) {
    return col + b.filaDatos + ':' + col + _filaFinDatosTfp(b);
}

/** La celda (o rango de 2 columnas) fija donde vive el aviso de truncado de un bloque. */
function _rangoAvisoTfp(b) {
    return b.colCuenta + b.filaFin + ':' + b.colMonto + b.filaFin;
}

/** El catalogo de cuentas del Plan que corresponde a cada bloque (fuente del desplegable de Cargas). */
function _catalogoTfp(clave) {
    return { ingresos: RANGES.INGRESOS, fijos: RANGES.GASTOS_FIJOS, variables: RANGES.GASTOS_VARIABLES }[clave];
}

/** La formula viva de una celda, sin el '=' inicial, lista para empotrar como valor de un LET. */
function _formulaSinIgualTfp(hoja, celda) {
    const f = hoja.getRange(celda).getFormula();
    if (!f) throw new Error('"' + celda + '" no tiene formula.');
    return f.charAt(0) === '=' ? f.substring(1) : f;
}

// ============================================
// LA FORMULA NUEVA DE CADA BLOQUE
// ============================================

/**
 * La celda ancla (R10, U10, X10): reusa la QUERY real de Franco como caja negra, calcula lo
 * proyectado por cuenta desde "Proyeccion", arma el faltante (MAX(0; proy - real)) y devuelve
 * las dos filas por cuenta intercaladas, acotadas a la capacidad del bloque -- y si el universo
 * de cuentas no entra entero, agrega una fila final de aviso (decision #5b de la cabecera).
 *
 * `formulaRealVerbatim` es el texto de la formula viva en la celda ancla, YA LEIDO por el
 * preflight: no se vuelve a leer aca para que el plan sea una funcion pura de sus argumentos
 * (facil de probar sin una hoja falsa que sepa devolver formulas).
 */
function _formulaCuentasTfp(b, formulaRealVerbatim) {
    const cfgCat = _catalogoTfp(b.clave);
    const catCol = _colPlan(cfgCat, 'nombre');
    const cfgReg = RANGES.REGISTROS;
    const colProy = function (clave) {
        const l = cfgReg.columns[clave];
        return _refHoja(SHEETS.PROYECCION) + '!' + l + cfgReg.dataRow + ':' + l;
    };
    const neutras = CUENTAS_NEUTRAS.map(function (c) { return '(cuenta_proy<>"' + c + '")'; }).join(' * ');
    const sel = CAP_SELECTORES.tablero;
    const capacidad = _capacidadCuentasTfp(b);

    return '=LET(\n' +
        '  tabla_real; ' + formulaRealVerbatim + ';\n' +
        '  nombres_real; INDEX(tabla_real; 0; 1);\n' +
        '  montos_real; ARRAYFORMULA(N(INDEX(tabla_real; 0; 2)));\n' +
        '  monto_proy; ' + colProy('monto') + ';\n' +
        '  cuenta_proy; ' + colProy('cuenta') + ';\n' +
        '  tipo_cuenta_proy; ' + colProy('tipo_cuenta') + ';\n' +
        '  moneda_proy; ' + colProy('moneda') + ';\n' +
        '  fecha_proy; ' + colProy('fecha') + ';\n' +
        '  mes_num; MATCH(' + sel.mes + '; SPLIT("' + PROY_MESES + '"; ","); 0);\n' +
        '  desde; DATE(' + sel.anio + '; mes_num; 1);\n' +
        '  hasta; EOMONTH(desde; 0);\n' +
        '  tasa_origen; ARRAYFORMULA(IF(moneda_proy="USD"; TIDETRACK_USD(); IF(moneda_proy="AUD"; TIDETRACK_AUD(); IF(moneda_proy="EUR"; TIDETRACK_EUR(); 1))));\n' +
        '  tasa_destino; IFERROR(SWITCH(' + sel.moneda + '; "ARS"; 1; "USD"; TIDETRACK_USD(); "AUD"; TIDETRACK_AUD(); "EUR"; TIDETRACK_EUR()); 1);\n' +
        '  convertido_proy; ARRAYFORMULA(monto_proy * tasa_origen / tasa_destino);\n' +
        '  del_mes_proy; ARRAYFORMULA((tipo_cuenta_proy="' + b.categoria + '") * ' + neutras +
        ' * (fecha_proy>=desde) * (fecha_proy<=hasta) * (cuenta_proy<>""));\n' +
        '  catalogo_cuentas; IFERROR(FILTER(' + catCol + '; ' + catCol + '<>""); "");\n' +
        '  universo_bruto; VSTACK(catalogo_cuentas; nombres_real);\n' +
        '  universo; IFERROR(UNIQUE(FILTER(universo_bruto; universo_bruto<>"")); "");\n' +
        '  real_por_cuenta; MAP(universo; LAMBDA(nombre; IFERROR(INDEX(montos_real; MATCH(nombre; nombres_real; 0)); 0)));\n' +
        '  proy_por_cuenta; MAP(universo; LAMBDA(nombre; SUM(IFERROR(FILTER(convertido_proy; del_mes_proy; cuenta_proy=nombre); 0))));\n' +
        '  faltante_por_cuenta; MAP(real_por_cuenta; proy_por_cuenta; LAMBDA(val_real; val_proy; MAX(0; val_proy - val_real)));\n' +
        '  incluir; ARRAYFORMULA((real_por_cuenta<>0) + (proy_por_cuenta<>0) > 0);\n' +
        '  tabla_incluida; IFERROR(FILTER(HSTACK(universo; real_por_cuenta; proy_por_cuenta; faltante_por_cuenta); incluir);\n' +
        '    HSTACK("Sin movimientos ni proyeccion"; 0; 0; 0));\n' +
        // ORDEN: real descendente primero. Ninguna cuenta proyectada-sin-movimiento-real (real=0)
        // puede desplazar a una con movimiento real de este mes, sin importar cuan grande sea lo
        // proyectado -- asi las "proyectadas sin registro" siempre quedan despues de las que ya
        // tienen actividad, y son las primeras en truncarse si no entran todas (decision Franco
        // 2026-08-21, cabecera del archivo).
        '  tabla_ordenada; SORT(tabla_incluida; 2; FALSE; 3; FALSE);\n' +
        '  n_total; ROWS(tabla_ordenada);\n' +
        '  tabla_topada; ARRAY_CONSTRAIN(tabla_ordenada; ' + capacidad + '; 4);\n' +
        '  n_cuentas; ROWS(tabla_topada);\n' +
        // TRUNCADO A LA VISTA (decision Franco 2026-08-21): nunca se aborta por falta de lugar.
        // Si `n_total` supera la capacidad, `n_ocultas` cuenta cuantas quedaron afuera y
        // `monto_oculto` es lo que representan (real + faltante de las NO mostradas), calculado
        // como el total completo menos el total ya topado -- no hace falta filtrar de nuevo.
        '  n_ocultas; n_total - n_cuentas;\n' +
        '  hay_ocultas; n_ocultas > 0;\n' +
        '  monto_oculto; (SUM(INDEX(tabla_ordenada; 0; 2)) - SUM(INDEX(tabla_topada; 0; 2))) +\n' +
        '    (SUM(INDEX(tabla_ordenada; 0; 4)) - SUM(INDEX(tabla_topada; 0; 4)));\n' +
        '  aviso_texto; "y " & n_ocultas & " cuenta" & IF(n_ocultas = 1; ""; "s") & " mas";\n' +
        // La fila de aviso ocupa la UNICA fila que la capacidad (impar) deja sobrante (ver
        // TFP_FILA_FIN): nunca compite por lugar con un par de datos, y si `hay_ocultas` es
        // FALSO ese renglon del derrame ni se genera -- la celda queda vacia sola, sin que haga
        // falta "limpiarla" en ningun otro lado.
        '  filas_datos; n_cuentas * 2;\n' +
        '  filas_total; filas_datos + IF(hay_ocultas; 1; 0);\n' +
        '  idx_fila; SEQUENCE(filas_total);\n' +
        '  nombre_out; MAP(idx_fila; LAMBDA(pos; IF(pos > filas_datos; aviso_texto;\n' +
        '    IF(MOD(pos; 2) = 0; ""; INDEX(tabla_topada; ROUNDUP(pos / 2; 0); 1)))));\n' +
        '  monto_out; MAP(idx_fila; LAMBDA(pos; IF(pos > filas_datos; monto_oculto;\n' +
        '    IF(MOD(pos; 2) = 0; INDEX(tabla_topada; ROUNDUP(pos / 2; 0); 4); INDEX(tabla_topada; ROUNDUP(pos / 2; 0); 2)))));\n' +
        '  HSTACK(nombre_out; monto_out)\n)';
}

/** Total REAL (S7/V7/Y7): solo las filas con nombre de cuenta. */
function _formulaTotalRealTfp(b) {
    return '=SUMIF(' + _rangoColTfp(b, b.colCuenta) + '; "<>"; ' + _rangoColTfp(b, b.colMonto) + ')';
}

/** Total FALTANTE (S8/V8/Y8): el espejo exacto, las filas SIN nombre de cuenta. */
function _formulaTotalFaltanteTfp(b) {
    return '=SUMIF(' + _rangoColTfp(b, b.colCuenta) + '; "="; ' + _rangoColTfp(b, b.colMonto) + ')';
}

// ============================================
// EL GRIS DE LAS FILAS DE FALTANTE (formato condicional)
// ============================================

/** La formula de la regla propia de un bloque: "esta fila no tiene cuenta pero si tiene monto". */
function _formulaReglaGrisTfp(b) {
    return '=AND($' + b.colCuenta + b.filaDatos + '=""; ' + b.colMonto + b.filaDatos + '<>"")';
}

/** Las tres reglas "de falta" que este modulo escribe, en el orden de TFP_ORDEN. */
function _reglasGrisTfp() {
    return TFP_ORDEN.map(function (k) {
        const b = TFP_BLOQUES[k];
        return { clave: k, tipo: 'gris', celda: _rangoColTfp(b, b.colMonto), formula: _formulaReglaGrisTfp(b) };
    });
}

/**
 * La formula de la regla de aviso: totalmente ABSOLUTA ($col$fila en las dos coordenadas) a
 * proposito -- esta regla vive en UN SOLO rango de una sola fila (la que reserva TFP_FILA_FIN),
 * asi que no necesita evaluar "esta fila" como la regla gris (que recorre 20 filas relativas):
 * solo pregunta si ESA celda fija de Monto tiene contenido. Ver decision #8 de la cabecera.
 */
function _formulaReglaAvisoTfp(b) {
    return '=$' + b.colMonto + '$' + b.filaFin + '<>""';
}

/** Las tres reglas "de aviso" (cursiva, decision #8): una por bloque, sobre su fila reservada. */
function _reglasAvisoTfp() {
    return TFP_ORDEN.map(function (k) {
        const b = TFP_BLOQUES[k];
        return { clave: k, tipo: 'aviso', celda: _rangoAvisoTfp(b), formula: _formulaReglaAvisoTfp(b) };
    });
}

/** Las seis reglas propias de este modulo: tres de falta (gris) + tres de aviso (gris cursiva). */
function _reglasPropiasTfp() {
    return _reglasGrisTfp().concat(_reglasAvisoTfp());
}

/** Una regla viva es propia si es CUSTOM_FORMULA, con la formula EXACTA de un bloque y su MISMO rango. */
function _esReglaPropiaTfp(regla) {
    const cond = regla.getBooleanCondition && regla.getBooleanCondition();
    if (!cond || String(cond.getCriteriaType()) !== 'CUSTOM_FORMULA') return false;
    const valores = cond.getCriteriaValues() || [];
    const formula = valores.length ? String(valores[0]) : '';
    const rangos = (regla.getRanges() || []).map(function (r) { return r.getA1Notation(); });
    if (rangos.length !== 1) return false;
    return _reglasPropiasTfp().some(function (r) { return r.formula === formula && r.celda === rangos[0]; });
}

/** Separa las reglas vivas de la hoja en propias (de este modulo) y ajenas (intocables). */
function _clasificarReglasTfp(reglas) {
    const propias = [], ajenas = [];
    (reglas || []).forEach(function (r) { (_esReglaPropiaTfp(r) ? propias : ajenas).push(r); });
    return { propias: propias, ajenas: ajenas };
}

/** true si faltan, sobran o difieren las reglas propias respecto de las seis esperadas. */
function _reglasHacenFaltaTfp(clases) {
    const quiero = _reglasPropiasTfp();
    if (clases.propias.length !== quiero.length) return true;
    const vivas = clases.propias.map(function (r) {
        const cond = r.getBooleanCondition();
        return String((cond.getCriteriaValues() || [])[0]) + '|' + r.getRanges()[0].getA1Notation();
    });
    return quiero.some(function (q) { return vivas.indexOf(q.formula + '|' + q.celda) === -1; });
}

/** La regla "de falta": misma tinta que siempre, sin cursiva -- el lenguaje ya establecido. */
function _construirReglaGrisTfp(hoja, item) {
    return SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(item.formula)
        .setFontColor(TFP_COLOR_GRIS)
        .setRanges([hoja.getRange(item.celda)])
        .build();
}

/** La regla "de aviso": MISMA tinta que la de falta, pero en cursiva (decision #8: su propio
 * tratamiento, sin inventar un color nuevo al design system). */
function _construirReglaAvisoTfp(hoja, item) {
    return SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(item.formula)
        .setFontColor(TFP_COLOR_GRIS)
        .setItalic(true)
        .setRanges([hoja.getRange(item.celda)])
        .build();
}

// ============================================
// PREFLIGHT
// ============================================

/** true si el texto de la formula ancla tiene la forma que este modulo sabe reusar (la de Franco). */
function _formaAnclaValidaTfp(formula, categoria) {
    return formula.indexOf('QUERY(') !== -1 &&
        formula.indexOf('SUM(Col2)') !== -1 &&
        formula.indexOf('GROUP BY Col1') !== -1 &&
        formula.indexOf("'" + categoria + "'") !== -1;
}

/**
 * true si la formula ancla YA ES la de este modulo (una corrida anterior ya la reescribio).
 *
 * IMPORTA DISTINGUIRLO: la formula que este modulo escribe EMPOTRA la QUERY original de Franco
 * como variable `tabla_real`, asi que sigue conteniendo 'QUERY(', 'SUM(Col2)' y 'GROUP BY Col1'
 * -- pasaria el chequeo de "_formaAnclaValidaTfp" igual que la original. Sin esta deteccion, un
 * segundo "Aplicar" tomaria la formula YA transformada (cuyo Col1 real ahora incluye filas de
 * faltante sin nombre) como si fuera la original de Franco y la volveria a envolver: un
 * anidamiento que crece en cada corrida y ademas corrompe `nombres_real`/`montos_real` (dejarian
 * de ser el agrupado limpio por cuenta). Se identifica por tres nombres de variable propios de
 * esta formula que no tienen motivo para aparecer en ninguna otra.
 */
function _anclaYaEsNuestraTfp(formula) {
    return formula.indexOf('tabla_topada') !== -1 &&
        formula.indexOf('faltante_por_cuenta') !== -1 &&
        formula.indexOf('n_cuentas') !== -1;
}

/**
 * Verifica los tres bloques por ROTULO antes de que nadie escriba, cuenta las cuentas reales
 * vivas de cada uno (informativo: estado() lo reporta, _verificarInvariantesTfp lo usa despues
 * de escribir -- YA NO frena el preflight, ver decision Franco 2026-08-21) y captura su total
 * real ANTES del cambio (para el invariante: el total real no se puede mover ni un centavo por
 * este refactor).
 */
function _preflightTfp(ss) {
    const nombre = NAV_CONFIG.SHEETS.TABLERO;
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) throw new Error('No existe la hoja "' + nombre + '".');

    const desvios = [];
    const bloques = {};

    TFP_ORDEN.forEach(function (clave) {
        const b = TFP_BLOQUES[clave];
        const tituloVivo = String(hoja.getRange(b.titulo.celda).getValue() || '').trim();
        if (tituloVivo.indexOf(b.titulo.esperado) === -1) {
            desvios.push(b.titulo.celda + ' dice "' + tituloVivo + '" y se esperaba contener "' + b.titulo.esperado + '"');
            return;
        }
        const headerCuenta = String(hoja.getRange(b.headerCuenta.celda).getValue() || '').trim();
        const headerMonto = String(hoja.getRange(b.headerMonto.celda).getValue() || '').trim();
        if (!_rotulosCompatibles(headerCuenta, b.headerCuenta.esperado) ||
            !_rotulosCompatibles(headerMonto, b.headerMonto.esperado)) {
            desvios.push('los headers de "' + tituloVivo + '" no son los esperados (' +
                b.headerCuenta.celda + '="' + headerCuenta + '", ' + b.headerMonto.celda + '="' + headerMonto + '")');
            return;
        }

        const celdaAncla = _celdaAnclaTfp(b);
        let formulaAnclaVivaTexto;
        try {
            formulaAnclaVivaTexto = _formulaSinIgualTfp(hoja, celdaAncla);
        } catch (e) {
            desvios.push(celdaAncla + ' (bloque "' + tituloVivo + '") no tiene formula: sin ella no hay ' +
                'nada "real" que reusar. No se toco nada.');
            return;
        }
        // Si ya es la formula de este modulo (corrida anterior), NO se vuelve a validar contra
        // la forma de Franco ni se reusa como `tabla_real`: ver _anclaYaEsNuestraTfp.
        const anclaYaAplicada = _anclaYaEsNuestraTfp(formulaAnclaVivaTexto);
        if (!anclaYaAplicada && !_formaAnclaValidaTfp(formulaAnclaVivaTexto, b.categoria)) {
            desvios.push(celdaAncla + ' no tiene la forma esperada (QUERY agrupando por cuenta, ' +
                'WHERE Col3 = \'' + b.categoria + '\'): la formula real cambio y hay que volver a medirla.');
            return;
        }

        const totalRealVivo = hoja.getRange(b.totalReal).getFormula();
        const yaEsSumif = _canonizarFormula(totalRealVivo) === _canonizarFormula(_formulaTotalRealTfp(b));
        if (!totalRealVivo) {
            desvios.push(b.totalReal + ' no tiene formula.');
            return;
        }
        const totalRealValorPrevio = totalRealVivo ? hoja.getRange(b.totalReal).getValue() : null;

        const totalFaltanteVivo = hoja.getRange(b.totalFaltante);
        const faltanteFormula = totalFaltanteVivo.getFormula();
        const faltanteValor = totalFaltanteVivo.getValue();
        const faltanteEsNuestra = _canonizarFormula(faltanteFormula) === _canonizarFormula(_formulaTotalFaltanteTfp(b));
        if (!faltanteEsNuestra && (faltanteFormula || String(faltanteValor) !== '')) {
            desvios.push(b.totalFaltante + ' no esta vacia (formula="' + faltanteFormula + '", valor="' +
                faltanteValor + '"): podria ser un dato de Franco. No se toco nada.');
            return;
        }

        const rotuloFaltanteVivo = String(hoja.getRange(b.rotuloFaltante.celda).getValue() || '').trim();
        const rotuloYaEsta = _normalizarRotulo(rotuloFaltanteVivo) === _normalizarRotulo(b.rotuloFaltante.esperado);

        const valoresCuenta = hoja.getRange(_rangoColTfp(b, b.colCuenta)).getValues();
        const cuentasVivas = valoresCuenta.filter(function (f) { return String(f[0] || '').trim() !== ''; }).length;
        const capacidad = _capacidadCuentasTfp(b);
        // decision Franco 2026-08-21: YA NO ABORTA si cuentasVivas > capacidad. cuentasVivas y
        // capacidad se siguen midiendo igual (estado() los reporta, y _verificarInvariantesTfp
        // los usa para saber cuanto exigir despues de escribir) pero nunca frenan el preflight:
        // la formula nueva trunca sola a las cuentas de mayor monto y avisa en la propia hoja
        // cuantas quedaron afuera (ver _formulaCuentasTfp). Abortar dejaba a Franco sin la
        // funcionalidad entera por una sola cuenta de mas; truncar avisando cumple el mismo
        // principio ("nunca se pierde una cuenta real en silencio") sin ese costo.

        bloques[clave] = {
            b: b, anclaYaAplicada: anclaYaAplicada,
            formulaReal: anclaYaAplicada ? null : formulaAnclaVivaTexto,
            totalRealFormulaVieja: totalRealVivo,
            totalRealYaEsSumif: yaEsSumif, totalRealValorPrevio: totalRealValorPrevio,
            faltanteEsNuestra: faltanteEsNuestra, faltanteFormulaVieja: faltanteFormula,
            faltanteValorVieja: faltanteValor, rotuloYaEsta: rotuloYaEsta, cuentasVivas: cuentasVivas,
            capacidad: capacidad
        };
    });

    if (desvios.length) {
        throw new Error('Los bloques de cuentas de "' + nombre + '" no son los que este modulo espera: ' +
            desvios.join('; ') + '. No se toco nada.');
    }

    if (!ss.getSheetByName(SHEETS.PROYECCION)) {
        throw new Error('No existe la hoja "' + SHEETS.PROYECCION + '": sin ella no hay proyectado que ' +
            'restar. Correr antes Tidetrack Dev > BD de Proyeccion. No se toco nada.');
    }

    // Selectores del Tablero: mismo chequeo liviano que usa el resto del formulerio.
    const sel = CAP_SELECTORES.tablero;
    const mesVivo = String(hoja.getRange(sel.mes.replace(/\$/g, '')).getValue() || '').trim();
    const mesesNorm = PROY_MESES.split(',').map(_normalizarRotulo);
    if (mesesNorm.indexOf(_normalizarRotulo(mesVivo)) === -1) {
        throw new Error(sel.mes + ' dice "' + mesVivo + '", que no es un mes en espanol. No se toco nada.');
    }
    const monedaVivo = String(hoja.getRange(sel.moneda.replace(/\$/g, '')).getValue() || '').trim();
    if (MONEDAS_DISPONIBLES.indexOf(monedaVivo) === -1) {
        throw new Error(sel.moneda + ' dice "' + monedaVivo + '" y no es ninguna moneda del sistema. No se toco nada.');
    }

    return { hoja: hoja, nombre: nombre, bloques: bloques };
}

// ============================================
// PLAN
// ============================================

/** Construye el plan leyendo lo vivo (via `pre`). No escribe nada. Idempotente por bloque. */
function _planTfp(pre) {
    const cambios = [];
    TFP_ORDEN.forEach(function (clave) {
        const info = pre.bloques[clave];
        const b = info.b;

        if (!info.anclaYaAplicada) {
            cambios.push({
                bloque: clave, celda: _celdaAnclaTfp(b), tipo: 'ancla',
                formulaNueva: _formulaCuentasTfp(b, info.formulaReal),
                nota: 'Cuentas + faltante: ' + b.titulo.esperado,
                resumen: 'dos filas por cuenta (real oscura, faltante gris), reusando la QUERY real existente'
            });
        }

        if (!info.totalRealYaEsSumif) {
            cambios.push({
                bloque: clave, celda: b.totalReal, tipo: 'total_real',
                formulaVieja: info.totalRealFormulaVieja, formulaNueva: _formulaTotalRealTfp(b),
                nota: 'Total real: ' + b.titulo.esperado,
                resumen: 'SUMIF de las filas CON nombre de cuenta (antes sumaba real+faltante mezclados)'
            });
        }
        if (!info.faltanteEsNuestra) {
            cambios.push({
                bloque: clave, celda: b.totalFaltante, tipo: 'total_faltante',
                formulaVieja: info.faltanteFormulaVieja, valorVieja: info.faltanteValorVieja,
                formulaNueva: _formulaTotalFaltanteTfp(b),
                nota: 'Total faltante: ' + b.titulo.esperado,
                resumen: 'SUMIF de las filas SIN nombre de cuenta: el espejo del total real'
            });
        }
        if (!info.rotuloYaEsta) {
            cambios.push({
                bloque: clave, celda: b.rotuloFaltante.celda, tipo: 'rotulo',
                nota: 'Rotulo: ' + b.titulo.esperado,
                resumen: 'texto "' + b.rotuloFaltante.esperado + '"'
            });
        }
    });

    const clasesReglas = _clasificarReglasTfp(pre.hoja.getConditionalFormatRules());
    return { cambios: cambios, reglas: clasesReglas };
}

// ============================================
// VERIFICACION
// ============================================

/** Marcador de "todavia calculando" para la relectura con reintentos. */
const TFP_PENDIENTE = { pendiente: true };

/**
 * Relee un valor esperando a TIDETRACK_*(): la primera pasada de una custom function devuelve
 * "Cargando..."/"Loading..." y no un numero. Ver la misma trampa, medida, en
 * DEVTOOL_InicioPresupuesto._leerYaCalculadoIp.
 */
function _leerYaCalculadoTfp(hoja, celda) {
    const esperas = [0, 600, 1500, 3000];
    for (let i = 0; i < esperas.length; i++) {
        if (esperas[i]) { SpreadsheetApp.flush(); Utilities.sleep(esperas[i]); }
        const v = hoja.getRange(celda).getValue();
        if (typeof v === 'number') return v;
        if (typeof v === 'string' && v.indexOf('#') === 0) return v;
    }
    const ult = hoja.getRange(celda).getValue();
    return typeof ult === 'number' ? ult : TFP_PENDIENTE;
}

/**
 * Cuenta las filas con nombre de cuenta no vacio en el rango vivo, con los mismos reintentos:
 * mientras la formula ancla no termino de calcular, la columna entera puede mostrar "Cargando...".
 */
function _contarCuentasYaCalculadoTfp(hoja, rangoA1) {
    const esperas = [0, 600, 1500, 3000];
    for (let i = 0; i < esperas.length; i++) {
        if (esperas[i]) { SpreadsheetApp.flush(); Utilities.sleep(esperas[i]); }
        const valores = hoja.getRange(rangoA1).getValues();
        const pendiente = valores.some(function (f) {
            const v = f[0];
            return typeof v === 'string' && v !== '' && v.indexOf('#') !== 0 &&
                _normalizarRotulo(v).indexOf('cargando') !== -1;
        });
        if (!pendiente) return valores.filter(function (f) { return String(f[0] || '').trim() !== ''; }).length;
    }
    return TFP_PENDIENTE;
}

/**
 * Invariantes por bloque, sobre los VALORES releidos:
 *   1. El total real NO SE MOVIO respecto del valor previo a este refactor.
 *   2. El total faltante es un numero finito y no negativo.
 *   3. Cuantas cuentas con nombre quedaron en el rango de datos (excluida la fila de aviso, ver
 *      _rangoColTfp) depende de si hubo truncado o no:
 *        - SIN truncar (cuentasVivas <= capacidad): TODAS las reales de antes tienen que seguir
 *          -- es un PISO, no una igualdad exacta, porque el universo union con el catalogo
 *          (decision de diseno #2) puede sumar cuentas proyectadas-sin-real ademas de las
 *          reales; eso no es perder nada, es el comportamiento buscado.
 *        - CON truncado (cuentasVivas > capacidad): el orden por monto real descendente
 *          garantiza que los `capacidad` lugares se llenan SOLO con cuentas reales (ninguna
 *          proyectada-sin-real puede desplazar a una real, ver decision de diseno de la
 *          cabecera) -- asi que el numero es EXACTO: ni una real de mas, ni una de menos.
 */
function _verificarInvariantesTfp(pre) {
    const fallas = [], avisos = [];
    TFP_ORDEN.forEach(function (clave) {
        const info = pre.bloques[clave];
        const b = info.b;
        const nombreBloque = b.titulo.esperado;

        const totalReal = _leerYaCalculadoTfp(pre.hoja, b.totalReal);
        if (totalReal === TFP_PENDIENTE) {
            avisos.push('"' + nombreBloque + '": el total real todavia estaba calculando al releerlo ' +
                '(las cotizaciones tardan). Verificar a ojo que ' + b.totalReal + ' no haya cambiado.');
        } else if (typeof totalReal === 'string') {
            fallas.push('"' + nombreBloque + '": el total real quedo en ' + totalReal);
        } else if (Math.abs(totalReal - info.totalRealValorPrevio) >= 0.01) {
            fallas.push('"' + nombreBloque + '": el total real paso de ' + info.totalRealValorPrevio +
                ' a ' + totalReal + '. Este refactor no puede mover el total real.');
        }

        const totalFaltante = _leerYaCalculadoTfp(pre.hoja, b.totalFaltante);
        if (totalFaltante === TFP_PENDIENTE) {
            avisos.push('"' + nombreBloque + '": el total de faltantes todavia estaba calculando al releerlo.');
        } else if (typeof totalFaltante === 'string') {
            fallas.push('"' + nombreBloque + '": el total de faltantes quedo en ' + totalFaltante);
        } else if (totalFaltante < -0.01) {
            fallas.push('"' + nombreBloque + '": el total de faltantes dio negativo (' + totalFaltante +
                '): el MAX(0; proyectado - real) de la formula no esta funcionando.');
        }

        const cuentasAhora = _contarCuentasYaCalculadoTfp(pre.hoja, _rangoColTfp(b, b.colCuenta));
        if (cuentasAhora === TFP_PENDIENTE) {
            avisos.push('"' + nombreBloque + '": la columna Cuenta todavia estaba calculando al releerla.');
        } else if (info.cuentasVivas > info.capacidad) {
            // TRUNCADO ESPERADO: exactamente `capacidad` cuentas reales (las de mayor monto),
            // ni una mas ni una menos -- ver el comentario del invariante 3 mas arriba.
            if (cuentasAhora !== info.capacidad) {
                fallas.push('"' + nombreBloque + '": con truncado esperado (' + info.cuentasVivas +
                    ' cuenta(s) real(es) para ' + info.capacidad + ' lugar(es)) quedaron ' + cuentasAhora +
                    ' cuenta(s) con nombre en el rango de datos y se esperaban exactamente ' + info.capacidad +
                    '. Una cuenta real no puede perderse ni duplicarse.');
            }
        } else if (cuentasAhora < info.cuentasVivas) {
            // SIN truncar: todas las reales de antes tienen que seguir (piso, no igualdad: el
            // universo union con el catalogo puede sumar proyectadas-sin-real ademas).
            fallas.push('"' + nombreBloque + '": quedaron ' + cuentasAhora + ' cuenta(s) con nombre y ' +
                'antes habia ' + info.cuentasVivas + ' con movimiento real. Una cuenta real no puede perderse.');
        }
    });
    return { fallas: fallas, avisos: avisos };
}

// ============================================
// ESCRITURA Y REVERSION
// ============================================

function _escribirCambioTfp(hoja, c) {
    const rango = hoja.getRange(c.celda);
    if (c.tipo === 'ancla') {
        rango.setFormula(c.formulaNueva);
    } else if (c.tipo === 'rotulo') {
        rango.setValue(TFP_BLOQUES[c.bloque].rotuloFaltante.esperado);
    } else {
        rango.setFormula(c.formulaNueva);
    }
}

/** Restaura cada celda escrita a su estado previo (formula, valor o vacio). */
function _revertirEscriturasTfp(ss, escritas) {
    escritas.forEach(function (w) {
        try {
            const r = ss.getSheetByName(w.nombreHoja).getRange(w.celda);
            if (w.previaFormula) { r.setFormula(w.previaFormula); return; }
            if (w.previoValor !== undefined && w.previoValor !== null && String(w.previoValor) !== '') {
                r.setValue(w.previoValor);
                return;
            }
            r.clearContent();
        } catch (e) {
            logError('No se pudo restaurar ' + w.nombreHoja + '!' + w.celda + ': ' + e.message);
        }
    });
    SpreadsheetApp.flush();
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: preflight + plan. No escribe nada. */
function estadoTableroFaltanteProyectado() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightTfp(ss);
        const plan = _planTfp(pre);

        const l = ['TABLERO: FALTANTE PROYECTADO - ESTADO (no se escribio nada)', ''];
        TFP_ORDEN.forEach(function (clave) {
            const info = pre.bloques[clave];
            const b = info.b;
            // "Entran"/"quedan afuera" son sobre CUENTAS REALES unicamente (lo unico que se
            // puede afirmar sin reimplementar en JS el filtro de "Proyeccion" -- ver decision
            // de diseno #1 de la cabecera). El total real puede sumar ademas cuentas
            // proyectadas-sin-movimiento-real (catalogo union real): esas nunca desplazan a una
            // real (orden por real descendente), asi que este piso es exacto para lo que
            // importa: ninguna cuenta real se recorta sin que Franco lo sepa.
            const entran = Math.min(info.cuentasVivas, info.capacidad);
            const afuera = Math.max(0, info.cuentasVivas - info.capacidad);
            l.push('"' + b.titulo.esperado + '": ' + info.cuentasVivas + ' cuenta(s) con movimiento real ' +
                'hoy (capacidad del bloque: ' + info.capacidad + ' pares cuenta/faltante). Entran: ' + entran +
                (afuera > 0
                    ? '. Quedan afuera (garantizado; se truncan primero las de menor monto real, y la ' +
                      'hoja lo va a avisar en su ultima fila): ' + afuera + '.'
                    : '. Ninguna cuenta real queda afuera' +
                      (info.capacidad > info.cuentasVivas
                          ? ' (y todavia entran cuentas proyectadas sin movimiento real, si las hay).'
                          : '.')));
        });
        l.push('');
        if (!plan.cambios.length && !_reglasHacenFaltaTfp(plan.reglas)) {
            l.push('NADA QUE HACER: los tres bloques ya tienen el faltante proyectado aplicado.');
        } else {
            l.push('CELDAS A ESCRIBIR: ' + plan.cambios.length);
            plan.cambios.forEach(function (c) {
                l.push('  ' + c.celda.padEnd(5) + ' [' + c.tipo + '] ' + c.nota);
                l.push('      ' + c.resumen);
            });
            l.push('');
            l.push('Reglas de formato condicional (gris de faltante + cursiva de aviso): ' +
                (_reglasHacenFaltaTfp(plan.reglas) ? 'se escriben/rehacen las 6 propias (3 + 3)' : 'ya estan correctas'));
        }
        l.push('Reglas ajenas de la hoja que se reponen intactas: ' + plan.reglas.ajenas.length);
        const t = l.join('\n');
        _mostrarTfp('Tablero: faltante proyectado - estado', t);
        logInfo('estadoTableroFaltanteProyectado: ' + plan.cambios.length + ' celda(s) pendientes.');
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarTfp('Tablero: faltante proyectado - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Aplica el faltante proyectado en los tres bloques, con respaldo, verificacion y reversion. */
function aplicarTableroFaltanteProyectado() {
    const escritas = [];
    let ui = null, ss = null, yaRevertido = false;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarTableroFaltanteProyectado necesita UI (menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightTfp(ss);
        const plan = _planTfp(pre);
        const tocarReglas = _reglasHacenFaltaTfp(plan.reglas);

        if (!plan.cambios.length && !tocarReglas) {
            const t = 'Los tres bloques ya tienen el faltante proyectado aplicado. No se escribio nada.';
            _mostrarTfp('Tablero: faltante proyectado', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Tablero: faltante proyectado',
            'Se van a escribir ' + plan.cambios.length + ' celda(s) en "' + pre.nombre + '"' +
            (tocarReglas ? ', y se rehacen las 6 reglas de color (3 gris de faltante + 3 cursiva de aviso)' : '') + '.\n\n' +
            'QUE CAMBIA en Ingresos, Gastos Fijos y Gastos Variables:\n' +
            '  - Cada cuenta pasa a ocupar DOS FILAS: arriba el nombre y lo REAL (sin cambios de\n' +
            '    fondo), abajo sin nombre el FALTANTE proyectado del mes (gris).\n' +
            '  - Los totales de la fila 7 (S7/V7/Y7) pasan de sumar TODO a sumar solo las filas\n' +
            '    CON nombre de cuenta: el total real NO se mueve, se verifica al releerlo.\n' +
            '  - Los totales nuevos (S8/V8/Y8) suman las filas SIN nombre: el total de faltantes.\n' +
            '  - El bloque va hasta la fila 30 (10 pares cuenta/faltante) y NUNCA aborta por\n' +
            '    falta de lugar: si algun dia hay mas cuentas con actividad que lugar, se\n' +
            '    muestran las mas importantes (por monto real y despues por proyectado) y la\n' +
            '    ULTIMA fila del bloque avisa, en cursiva, cuantas quedaron afuera y por cuanta\n' +
            '    plata -- nunca desaparecen en silencio.\n\n' +
            'Ninguna cuenta con movimiento real puede perderse (ni siquiera cuando trunca: se ' +
            'verifica que la cantidad exacta de cuentas reales mostradas coincida con lo esperado).' +
            '\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarFormulerio(ss, sello);

        const previos = { respaldo: respaldo.nombre, celdas: [] };
        plan.cambios.forEach(function (c) {
            const rango = pre.hoja.getRange(c.celda);
            const previaFormula = rango.getFormula();
            const previoValor = previaFormula ? '' : rango.getValue();
            previos.celdas.push({ celda: c.celda, tenia: previaFormula ? 'formula' : (String(previoValor) !== '' ? 'valor' : 'vacia'), valor: previoValor });

            _escribirCambioTfp(pre.hoja, c);
            escritas.push({
                nombreHoja: pre.nombre, celda: c.celda,
                previaFormula: previaFormula, previoValor: previoValor
            });
        });

        // `tocaronReglas` queda registrado en el respaldo publico para que revertir sepa si tiene
        // que quitar reglas propias o dejarlas como estan (si no se tocaron, no hay nada que
        // revertir ahi y tocarlas seria un efecto secundario que este modulo no causo).
        previos.tocaronReglas = tocarReglas;
        if (tocarReglas) {
            const nuevasReglas = _reglasGrisTfp().map(function (item) { return _construirReglaGrisTfp(pre.hoja, item); })
                .concat(_reglasAvisoTfp().map(function (item) { return _construirReglaAvisoTfp(pre.hoja, item); }));
            pre.hoja.setConditionalFormatRules(plan.reglas.ajenas.concat(nuevasReglas));
        }
        SpreadsheetApp.flush();

        const inv = _verificarInvariantesTfp(pre);
        if (inv.fallas.length) {
            _revertirEscriturasTfp(ss, escritas);
            if (tocarReglas) {
                try {
                    const clasesAhora = _clasificarReglasTfp(pre.hoja.getConditionalFormatRules());
                    pre.hoja.setConditionalFormatRules(clasesAhora.ajenas);
                    SpreadsheetApp.flush();
                } catch (e2) { logError('No se pudieron quitar las reglas nuevas al revertir: ' + e2.message); }
            }
            yaRevertido = true;
            throw new Error('Se escribio pero NO VERIFICA: ' + inv.fallas.join('; ') +
                '. Se restauro cada celda. El respaldo quedo en "' + respaldo.nombre + '".');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(TFP_PROP_RESPALDO, respaldo.nombre);
        props.setProperty(TFP_PROP_PREVIOS, JSON.stringify(previos));

        const detalle = 'TABLERO: FALTANTE PROYECTADO APLICADO\n\n' +
            (inv.avisos.length
                ? 'PARA LEER (' + inv.avisos.length + '). Las formulas quedaron escritas; esto NO es\n' +
                  'un error:\n' + inv.avisos.map(function (a) { return '  - ' + a; }).join('\n') + '\n\n'
                : '') +
            '- Celdas escritas y verificadas: ' + escritas.length + '\n' +
            '- Reglas de color (gris de faltante + cursiva de aviso): ' +
            (tocarReglas ? 'rehechas (6 propias: 3 + 3)' : 'ya estaban correctas') + '\n' +
            '- Respaldo en la hoja oculta "' + respaldo.nombre + '"\n\n' +
            'QUE MIRAR:\n' +
            '  1. Cada cuenta con nombre y monto oscuro es lo REAL; la fila de abajo sin nombre,\n' +
            '     en gris, es el FALTANTE proyectado.\n' +
            '  2. Los totales de la fila 7 no se movieron (se verifico); el total de faltantes de\n' +
            '     la fila 8 es nuevo.\n' +
            '  3. Una cuenta proyectada sin movimiento real todavia aparece con su faltante completo.\n' +
            '  4. Si algun bloque no tenia lugar para todas las cuentas, su ULTIMA fila (30) dice\n' +
            '     en cursiva "y N cuentas mas" y cuanta plata representan.\n\n' +
            'Si algo quedo peor: revertirTableroFaltanteProyectado (menu Tidetrack Dev).';

        logSuccess('aplicarTableroFaltanteProyectado: ' + escritas.length + ' celda(s).');
        _mostrarTfp('Tablero: faltante proyectado - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && escritas.length && !yaRevertido) {
            try { _revertirEscriturasTfp(ss, escritas); restaurado = ' Se restauraron las celdas ya escritas.'; }
            catch (e2) { restaurado = ' ADEMAS fallo la restauracion (' + e2.message + ').'; }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack });
        _mostrarTfp('Tablero: faltante proyectado - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Vuelve al estado previo a la ultima corrida aplicada. */
function revertirTableroFaltanteProyectado() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const crudo = props.getProperty(TFP_PROP_PREVIOS);
        if (!crudo) throw new Error('No hay ninguna corrida registrada de este modulo.');
        const previos = JSON.parse(crudo);

        const hoja = ss.getSheetByName(NAV_CONFIG.SHEETS.TABLERO);
        if (!hoja) throw new Error('No existe la hoja "' + NAV_CONFIG.SHEETS.TABLERO + '".');

        const resp = ss.getSheetByName(previos.respaldo);
        const filasRespaldo = resp ? _leerRespaldoFormulerio(resp) : [];

        let repuestas = 0;
        const faltantes = [];
        previos.celdas.forEach(function (p) {
            const rango = hoja.getRange(p.celda);
            if (p.tenia === 'formula') {
                const fila = filasRespaldo.find(function (f) {
                    return f.nombreHoja === NAV_CONFIG.SHEETS.TABLERO && f.celda === p.celda;
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

        let reglasQuitadas = 0;
        if (previos.tocaronReglas) {
            const clases = _clasificarReglasTfp(hoja.getConditionalFormatRules());
            reglasQuitadas = clases.propias.length;
            if (reglasQuitadas) hoja.setConditionalFormatRules(clases.ajenas);
        }
        SpreadsheetApp.flush();
        props.deleteProperty(TFP_PROP_PREVIOS);

        const t = 'TABLERO: FALTANTE PROYECTADO REVERTIDO\n\n- Celdas repuestas: ' + repuestas + '\n' +
            '- Reglas de color quitadas: ' + reglasQuitadas + '\n' +
            (faltantes.length ? '- SIN respaldo (quedaron como estan): ' + faltantes.join(', ') + '\n' : '') +
            '- Respaldo usado: "' + previos.respaldo + '"' + (resp ? '' : ' (la hoja ya no existe)');
        logSuccess('revertirTableroFaltanteProyectado: ' + repuestas + ' celda(s).');
        _mostrarTfp('Tablero: faltante proyectado - revertido', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarTfp('Tablero: faltante proyectado - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarTfp(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
