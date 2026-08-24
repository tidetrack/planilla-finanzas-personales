/**
 * DEVTOOL_TableroFaltanteProyectado.js
 * Agrega el "Faltante proyectado" a los tres bloques de cuentas del Tablero (Ingresos, Gastos
 * Fijos, Gastos Variables): dos SECCIONES dentro del mismo bloque, separadas por una FILA
 * ROTULADA explicita, no por color solo.
 *
 * [CONCEPTO DE NEGOCIO]
 * Los tres bloques de cuentas del Tablero (Ingresos, Gastos Fijos, Gastos Variables) mostraban
 * SOLO lo REALMENTE registrado en el mes, cuenta por cuenta. Eso contesta "cuanto paso", pero no
 * "cuanto falta" -- si Franco proyecto $1.000.000 de una cuenta y van $837.728,28 cargados, la
 * planilla no decia nada sobre los $162.271,72 restantes. Peor: una cuenta proyectada que
 * TODAVIA no tuvo ningun movimiento real no aparecia en absoluto, asi que lo que falta cobrar o
 * pagar de esa cuenta era invisible.
 *
 * decision Franco 2026-08-21 (layout de dos secciones, primera vuelta de diseno definitivo): NO
 * es una fila real seguida de una fila faltante por cuenta. Son DOS SECCIONES separadas dentro
 * del mismo bloque: arriba, TODO lo real (una fila por cuenta con movimiento, oscuro); abajo,
 * TODO lo faltante (una fila por cuenta con faltante > 0, gris, REPITIENDO el nombre de la
 * cuenta -- no lo deja vacio). Version 0.40.0, desplegada y verificada en la planilla real:
 * umoh no baja (ya supero lo proyectado) y Plata Prestada / Ingreso Viejo aparecen SOLO abajo
 * (proyectadas sin movimiento real, con el faltante completo).
 *
 * decision Franco 2026-08-24 (fila separadora + montos numericos, segunda vuelta): con las dos
 * secciones ya en la planilla, Franco reporto DOS problemas nuevos, textuales:
 *   1. "Necesito que, visualmente, se separe mas lo proyectado de lo ingresado realmente porque
 *      parece que no se registra bien. Busca la manera de diferenciarlos mas." El gris solo
 *      (decision #7 de la v0.40.0, mas abajo en el historial) no alcanzaba: Franco ve la misma
 *      cuenta dos veces sin nada que EXPLIQUE por que, y un tono de gris sutil no basta como
 *      esa explicacion.
 *   2. "Ademas, la columna de monto debe dejarme que, al seleccionar celdas, te de la suma
 *      total. Para asi hacer proyecciones." La v0.40.0 pasaba los montos de la seccion 2 por
 *      TEXT() para poder pintarlos gris con ISTEXT() (ver decision #7 de la v0.40.0): un TEXTO
 *      no suma en la barra de estado de Sheets. Esa afordancia basica de planilla se estaba
 *      rompiendo a cambio de un color.
 *
 * La resolucion (ver decisiones #7 y #8 de esta version, reescritas): una FILA SEPARADORA
 * explicita, con rotulo en la columna Cuenta, entre las dos secciones. Dos pajaros de un tiro:
 * dice con TEXTO por que la cuenta se repite (resuelve el problema 1), y libera a los montos de
 * necesitar TEXT() como senal de color -- pueden volver a ser NUMEROS de verdad (resuelve el
 * problema 2). La senal del gris pasa a ser posicional (COUNTIF expansivo: "aparecio el rotulo
 * del separador en algun renglon de arriba de este"), no de tipo de dato.
 *
 *     Cuenta                    Monto
 *     umoh                    $837.728,28   <- SECCION 1 (real): oscuro
 *     Tidetrack               $260.000,00
 *     Ingresos Extra           $40.069,53
 *     Intereses banc              $785,19
 *     Faltante proyectado                   <- FILA SEPARADORA: rotulo, Monto vacio, NO es gris
 *     umoh                    $162.271,72   <- SECCION 2 (faltante): gris, NUMERO real, suma
 *     Tidetrack                $40.000,00
 *
 * Una primera vuelta de diseno (v0.39.0/intento fallido, ver mas abajo "EL BUG QUE ESTO
 * REEMPLAZA") intercalaba las dos filas por cuenta con la de faltante SIN nombre. Franco la
 * corrigio ANTES de que llegara a la planilla: el layout real que el necesita es el de dos
 * secciones de arriba. El intento intercalado queda documentado como diagnostico (la causa raiz
 * que atrapo la verificacion sigue siendo valida y esta seccion la hereda), no como diseno vivo.
 *
 * El total de faltantes de cada bloque va debajo del titulo (R8/U8/X8, rotulo ya escrito por
 * Franco; S8/V8/Y8 son las celdas de valor que este modulo cablea, con el MISMO formato de
 * numero que su hermano S7/V7/Y7, copiado en vivo -- ver decision #12).
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: preflight por ROTULO que aborta ante la minima discrepancia,
 * respaldo congelado y verificado antes de mutar, verificacion del VALOR resultante, reversion
 * completa. Contrato de las tres publicas: { ok, detalle?, error? }.
 *
 * EL BUG QUE ESTO REEMPLAZA (diagnostico de la corrida real del 2026-08-21, v0.39.0): con el
 * layout intercalado, los totales se armaron como SUMIF(rango; "<>"; monto) para "real" y el
 * espejo SUMIF(rango; "="; monto) para "faltante", separando por si la celda de Cuenta estaba
 * vacia. La corrida real lo delato: el total real paso de $1.138.583,00 a $3.218.368,47 en
 * Ingresos (exactamente real + faltante), y el mismo patron en Gastos Fijos y Variables. La
 * causa: en Sheets, SUMIF/COUNTIF con el criterio "<>"/"=" A SECAS (sin operando) NO comparan el
 * VALOR de la celda contra "" -- preguntan si la celda "tiene contenido" (formula o dato), y una
 * celda que pertenece a un DERRAME de array y muestra "" (el resultado de una formula, no un
 * vacio real) CUENTA COMO "CON CONTENIDO". Con eso, TODAS las filas del derrame (las que tenian
 * nombre Y las que mostraban "") caian del lado "<>" (no vacio): el total real sumaba real +
 * faltante, y el total faltante quedaba en $0 sistematicamente (ningun SUMIF conseguia una fila
 * que calificara como "vacia" para el criterio "="). El banco de pruebas de esa version daba
 * VERDE con esto roto porque su mock en JS solo puede representar "" como string, sin la
 * distincion Sheets-especifica entre "celda vacia real" y "celda con formula que devolvio '  '":
 * un agujero de cobertura documentado y corregido en la seccion 3 de este banco.
 *
 * Con el layout de DOS SECCIONES ese mecanismo de deteccion (vacio vs no vacio en Cuenta) ya NO
 * EXISTE -- ninguna fila de Cuenta esta vacia nunca. Eso mata la ambiguedad de raiz, pero
 * tambien mata el unico dato que los totales viejos usaban para separarse: ver decision de
 * diseno #1 (totales por construccion) y #7 (el gris) mas abajo, las dos consecuencias directas.
 *
 * DECISIONES DE DISENO
 *
 * 1. LOS TOTALES SE CALCULAN POR CONSTRUCCION, NUNCA RELEYENDO EL DERRAME. Con el layout viejo
 *    (intercalado) esto ya era la opcion preferida por menos fragil; con el layout de dos
 *    secciones es la UNICA que funciona, porque el nombre de cuenta se repite en las dos
 *    secciones y ya no hay ninguna senal de "vacio" que un SUMIF pueda usar para separarlas.
 *    S7 (total real) es `=SUM(INDEX(<QUERY real de Franco, verbatim>; 0; 2))`: suma DIRECTO la
 *    columna 2 de la QUERY de Franco, sin pasar por el derrame ni por ningun filtro nuevo -- es
 *    matematicamente la MISMA cifra que Franco ya tenia antes de que este modulo tocara nada,
 *    por eso el invariante "el total real no se mueve" se cumple por construccion, no por
 *    coincidencia. S8 (total faltante) reusa el MISMO bloque de calculo LET que arma el derrame
 *    (`_bloqueComunTfp`, generado por UNA sola funcion JS para evitar que las dos formulas de
 *    Sheets diverjan con el tiempo) y suma `faltante_por_cuenta` sobre el UNIVERSO COMPLETO, no
 *    solo lo que entra en pantalla: si algun dia hay truncado, S8 sigue mostrando el faltante
 *    real total, no el recortado a la vista (mas util para Franco que un total que depende de
 *    cuantas filas entraron).
 *
 * 2. LA FORMULA "REAL" DE FRANCO SE REUSA VERBATIM, NUNCA SE REESCRIBE (sin cambios respecto de
 *    la version anterior). El preflight LEE la formula viva de la celda ancla, verifica su forma
 *    esperada y la EMPOTRA tal cual dentro de un LET nuevo como variable `tabla_real`.
 *
 * 3. LO PROYECTADO SE CALCULA FRESCO, cuenta por cuenta, desde la hoja "Proyeccion" (sin cambios
 *    respecto de la version anterior: mismo criterio que DEVTOOL_Proyeccion usa para N9:N11,
 *    agrupado POR CUENTA). El universo de cuentas es la UNION del catalogo del bloque y las
 *    cuentas que ya aparecen en `tabla_real`.
 *
 * 4. FALTANTE = MAX(0; proyectado - real). Nunca negativo (sin cambios).
 *
 * 5. SECCION 1 (real) ES `tabla_real` VERBATIM, EN SU PROPIO ORDEN (el de la QUERY de Franco,
 *    "ORDER BY SUM(Col2) DESC"): no se reordena, no se filtra por valor -- es la misma tabla que
 *    Franco ya tenia, mostrada tal cual. La UNICA depuracion que este modulo le aplica es
 *    descartar el caso extremo en que la QUERY entera fallo y el `IFERROR` externo de Franco
 *    devolvio su placeholder de una fila en blanco (`{"" \ ""}`, ver el fixture del banco): eso
 *    se detecta (una sola fila con nombre "") y se trata como "cero cuentas reales", no como una
 *    fila real con nombre vacio.
 *
 * 6. SECCION 2 (faltante) ES `FILTER` + `SORT` DESCENDENTE sobre TODO el universo con
 *    faltante_por_cuenta > 0 -- incluye cuentas que TAMBIEN estan en la seccion 1 (repiten
 *    nombre, decision de Franco) y cuentas SIN ningun movimiento real (aparecen SOLO en la
 *    seccion 2, con el faltante completo: es la razon de ser del modulo, ver decision #9). El
 *    orden (mayor faltante primero) es el mismo criterio de prioridad que ya usaba la seccion 1:
 *    si hay que truncar, se pierde lo mas chico primero.
 *
 * 7. [REESCRITA v0.41.0 -- ver decision #7 de v0.40.0 en el historial de ZZ_Changelog.js para el
 *    diseno que esta reemplaza] LOS MONTOS DE LA SECCION 2 VUELVEN A SER NUMEROS. La v0.40.0
 *    pasaba el importe por TEXT() para que ISTEXT() pudiera pintarlo gris -- pero un TEXTO no
 *    suma al seleccionarlo (Franco, textual: "la columna de monto debe dejarme que, al
 *    seleccionar celdas, te de la suma total. Para asi hacer proyecciones"). Esa afordancia de
 *    Sheets (SUM en la barra de estado) no se negocia: los dos numeros, seccion 1 y seccion 2,
 *    quedan como `INDEX(tabla_topada; pos; 2)` crudo, sin TEXT() de por medio. Como consecuencia
 *    directa, el gris YA NO PUEDE colgar del tipo de dato (esa senal se fue con el TEXT()): ver
 *    decision #8 para la senal que la reemplaza. La cuenta SIN ningun movimiento real (el
 *    contraejemplo que en v0.40.0 descarto un COUNTIF de "aparece 2+ veces": aparece una sola
 *    vez, solo en la seccion 2) sigue siendo el caso de prueba obligado de cualquier senal nueva
 *    -- ver decision #8, que la resuelve sin ese punto ciego.
 *
 * 8. LA SEPARACION VISUAL ES UNA FILA ROTULADA EXPLICITA, Y ES TAMBIEN LA NUEVA SENAL DEL GRIS.
 *    Franco, textual: "Necesito que, visualmente, se separe mas lo proyectado de lo ingresado
 *    realmente porque parece que no se registra bien. Busca la manera de diferenciarlos mas." El
 *    gris solo (decision #7 de v0.40.0) no alcanzaba: la MISMA cuenta aparece dos veces sin que
 *    nada diga POR QUE. La v0.40.0 descartaba una fila separadora por dos razones (ver el
 *    historial): (a) el color ya separaba, (b) el limite entre secciones es DINAMICO (depende de
 *    cuantas cuentas reales hay hoy), asi que la fila tendria que insertarse en una posicion que
 *    cambia con los datos. La razon (a) se cae con el pedido de Franco (el color solo no alcanza
 *    HOY); la razon (b) sigue siendo cierta pero deja de ser un obstaculo: el derrame de UNA sola
 *    formula (`MAP` sobre `idx_fila`, decision #1) puede perfectamente insertar una fila mas en
 *    una posicion calculada (`fila_separador; cant_real_mostradas + 1`) exactamente como ya
 *    inserta la fila de aviso en una posicion calculada (decision #11). No hace falta "saltear"
 *    nada: es una fila de datos mas del mismo MAP, con su propia rama del IF.
 *
 *    El rotulo (`TFP_ROTULO_SEPARADOR`, "Faltante proyectado" -- el MISMO texto que ya vive en
 *    R8/U8/X8, arriba del bloque, reforzando el significado en vez de inventar un texto nuevo) va
 *    en la columna Cuenta; la columna Monto de esa fila queda vacia ("", ni numero ni TEXT()): no
 *    hay nada que sumar en la fila que solo separa. Solo aparece si HAY algo que separar
 *    (`hay_separador; cant_faltante_mostradas > 0`): si un bloque no tiene NINGUNA cuenta con
 *    faltante este mes, no hay seccion 2 y tampoco fila separadora que la anuncie -- el bloque
 *    queda igual que antes de este modulo.
 *
 *    LA SENAL DEL GRIS pasa a ser POSICIONAL en vez de por tipo de dato: `=COUNTIF($R$9:R9;
 *    "Faltante proyectado")>0` (R9 es un ejemplo del bloque Ingresos: la fila INMEDIATAMENTE
 *    ARRIBA de la primera fila de datos, ver `_formulaReglaGrisTfp`) aplicada sobre R10:R29 con
 *    referencia de fila relativa: Sheets la reescribe por cada celda de ese rango, asi que en la
 *    fila N pregunta "¿aparecio el rotulo del separador en algun renglon entre el header (fila 9)
 *    y la fila N-1?" -- un rango EXPANSIVO anclado arriba (la idea original de Franco: "un
 *    COUNTIF de rango expansivo anclado arriba... marca todo lo posterior"), con el ancla UNA
 *    FILA POR ENCIMA de filaDatos a proposito: asi la propia fila separadora NUNCA se cuenta a si
 *    misma (en su fila, el rango expansivo termina en la fila anterior, todavia sin el rotulo) y
 *    queda con tratamiento normal (oscuro), mientras que TODA fila estrictamente debajo de ella
 *    si lo encuentra y se pinta gris -- incluida la cuenta sin ningun movimiento real (aparece
 *    una sola vez, pero esa unica vez esta SIEMPRE debajo del separador: la senal no depende de
 *    cuantas veces aparece el nombre, solo de la POSICION). Verificado con el mismo simulador
 *    fiel del algoritmo que uso v0.40.0 para descartar el COUNTIF de duplicados -- ver el banco.
 *
 * 9. UNA CUENTA PROYECTADA SIN NINGUN MOVIMIENTO REAL SIGUE APARECIENDO (sin cambios respecto de
 *    la version anterior, confirmado explicitamente para este layout): no tiene fila en la
 *    seccion 1 (no esta en `tabla_real`, porque no hay ningun registro real que agrupar), y
 *    aparece en la seccion 2 con el faltante completo (= todo lo proyectado, porque real = 0).
 *    Es la razon de ser del modulo -- sacarla reintroduciria la invisibilidad original que el
 *    "Faltante proyectado" vino a resolver.
 *
 * 10. LA CAPACIDAD SE RELAJA SOLA, PERO LA FILA SEPARADORA SE COBRA UNA (v0.41.0, cuenta
 *    rehecha). Las 21 filas del bloque (10 a 30) siguen siendo UN SOLO NUMERO (TFP_FILA_FIN),
 *    repartidas como veinte filas de DATOS (10 a 29, `_capacidadFilasTfp`, SIN CAMBIOS: sigue
 *    siendo un numero estructural, 20) mas la fila 30 reservada al aviso de truncado. Dentro de
 *    esas veinte, una cuenta ya cubierta (faltante = 0) sigue ocupando UNA sola fila -- eso no
 *    cambia --, pero AHORA, si hay al menos una cuenta con faltante > 0 (osea, si va a existir
 *    una seccion 2), una de las veinte filas la consume la fila separadora misma
 *    (`capacidad_datos; IF(cant_faltante > 0; 19; 20)` dentro de la formula, ver
 *    `_formulaCuentasTfp`). El PEOR CASO (el numero que hay que poder garantizar sin truncar) SI
 *    cambia: si TODAS las cuentas necesitaran sus dos filas (real y faltante pendiente) mas la
 *    fila separadora que ese escenario necesariamente dispara, el numero que entra completo baja
 *    de diez a **nueve** -- `_capacidadPeorCasoTfp` pasa a ser `floor((capacidadFilas - 1) / 2)`
 *    (19 filas utiles para pares, no 20) en vez de `floor(capacidadFilas / 2)`. Nueve cuentas x 2
 *    filas = 18, mas 1 separador = 19, con una fila de margen sobre las 20 disponibles; una
 *    decima cuenta en ese escenario ya no entra sin truncar. En la practica sigue entrando mas
 *    que el peor caso: cualquier cuenta ya cubierta libera una fila para otra, igual que antes.
 *
 * 11. TRUNCADO A LA VISTA, NUNCA SE ABORTA (sin cambios de principio respecto de la version
 *    anterior, adaptado al nuevo conteo por filas en vez de por pares): si el total de filas que
 *    hacen falta (cuentas reales + cuentas con faltante > 0 + la fila separadora si corresponde)
 *    supera las veinte disponibles, se muestran las mas importantes (seccion 1 completa primero,
 *    siempre que quepa; el resto para la seccion 2, ordenada de mayor a menor faltante) y la fila
 *    30 avisa "y N cuenta(s) mas" con la plata que representan, calculada como el total completo
 *    menos lo ya mostrado -- igual que en la version anterior, sin refiltrar. El conteo de
 *    "nombres distintos" que usa `_verificarInvariantesTfp` para chequear que ninguna cuenta real
 *    se perdio EXCLUYE el rotulo de la fila separadora (no es una cuenta, no debe contar como
 *    una): ver `_contarNombresDistintosYaCalculadoTfp`.
 *
 * 12. LOS TOTALES DE FALTANTE (S8/V8/Y8) HEREDAN EL FORMATO DE NUMERO DE SU HERMANO REAL
 *    (S7/V7/Y7), COPIADO EN VIVO. Bug reportado por Franco: S8/V8/Y8 salian sin formato de
 *    moneda (`1242057,19` al lado de `$1.138.583,00`) porque nunca se les seteo un
 *    `setNumberFormat` -- quedaban con el formato general por default de una celda nueva. La
 *    correccion NO inventa un patron (esa es justo la trampa ya medida en este repo: los
 *    patrones van con punto decimal canonico si se ESCRIBEN a mano, pero un patron ESCRITO a
 *    mano es exactamente lo que hay que evitar aca): se LEE `hoja.getRange(b.totalReal
 *    ).getNumberFormat()` en el preflight y se copia tal cual, sin transformarlo, a
 *    `hoja.getRange(b.totalFaltante).setNumberFormat(...)` en la escritura -- el hermano real ya
 *    tiene el patron correcto porque Franco lo formateo el mismo, mucho antes de que este modulo
 *    existiera. El formato previo de S8/V8/Y8 se respalda celda por celda (no lo cubre
 *    `_respaldarFormulerio`, que solo fotografia formulas) para que
 *    `revertirTableroFaltanteProyectado` lo pueda devolver exacto.
 *
 * QUE NO HACE
 * 1. NO cambia el titulo de los bloques (R7/U7/X7) ni la geometria del Plan de Cuentas.
 * 2. NO toca "Categorias" ni ningun otro bloque del Tablero.
 * 3. NO agranda el bloque mas alla de R10:S30 / U10:V30 / X10:Y30: si no entra todo, TRUNCA a
 *    las cuentas de mayor monto y lo dice en la ultima fila del bloque.
 * 4. NO le da a la fila separadora ningun formato condicional propio (ni gris, ni cursiva): su
 *    tratamiento visual es el default (oscuro, igual que la seccion 1) -- es la senal del gris de
 *    LAS DEMAS filas (decision #8) la que la deja afuera, no una regla que la persiga a ella.
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
 * @version 0.41.0
 * @since 2026-08-21
 * @lastModified 2026-08-24
 */

// ============================================
// GEOMETRIA (medida en vivo el 2026-08-21, verificada por rotulo en el preflight)
// ============================================

/**
 * Ultima fila del bloque de cuentas del Tablero: UNICO punto de verdad, compartido por los tres
 * bloques (Ingresos, Gastos Fijos, Gastos Variables). Sin cambios respecto de la version
 * anterior: sigue siendo 30 ("visible hasta la fila 30"), con la fila 30 reservada al aviso de
 * truncado. Lo que cambia es COMO se reparten las 20 filas de datos (10 a 29): ver decision #10.
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

/**
 * Patron de respaldo si la celda que se esta copiando (hoy: el total real, S7/V7/Y7) todavia no
 * tiene ningun formato de numero propio -- ver decision #12 de la cabecera.
 */
const TFP_PATRON_MONTO_DEFECTO = '#,##0.00';

/**
 * El rotulo de la fila separadora (decision #8 de la cabecera): mismo texto que ya vive en
 * R8/U8/X8 (el rotulo de seccion, escrito por Franco), reforzando el significado en vez de
 * inventar uno nuevo. Es tambien el literal que busca el COUNTIF del gris (_formulaReglaGrisTfp):
 * cambiar este texto cambia las dos cosas a la vez, nunca se desincronizan.
 */
const TFP_ROTULO_SEPARADOR = 'Faltante proyectado';

// ============================================
// GEOMETRIA DERIVADA
// ============================================

/** Cuantas filas de DATOS (real + faltante combinados) entran en el bloque, sin la fila de aviso. */
function _capacidadFilasTfp(b) {
    return b.filaFin - b.filaDatos;
}

/**
 * El PEOR CASO garantizado sin truncar: si TODAS las cuentas necesitaran sus dos filas (real Y
 * faltante pendiente), este es el numero de cuentas que entran completas SIN contar la fila
 * separadora. En la practica suele entrar mas, porque una cuenta ya cubierta (faltante = 0)
 * libera una fila para otra (decision #10 de la cabecera). Informativo: estado() lo reporta, no
 * es un limite duro del preflight.
 *
 * v0.41.0: baja de `floor(capacidad / 2)` a `floor((capacidad - 1) / 2)` -- en el peor caso
 * (TODAS las cuentas con faltante pendiente) la fila separadora SIEMPRE aparece (decision #10),
 * asi que una de las filas de datos deja de estar disponible para pares cuenta/faltante. Con
 * capacidad=20: antes 10 pares (20 filas exactas), ahora 9 pares + 1 separador = 19 filas (1 de
 * margen sobre las 20 disponibles); la decima cuenta en ese escenario ya no entra sin truncar.
 */
function _capacidadPeorCasoTfp(b) {
    return Math.floor((_capacidadFilasTfp(b) - 1) / 2);
}

/** La celda ancla del derrame: donde vive HOY la QUERY de Franco y donde va la formula nueva. */
function _celdaAnclaTfp(b) {
    return b.colCuenta + b.filaDatos;
}

/**
 * La ULTIMA fila del bloque de datos propiamente dicho, es decir `b.filaFin` MENOS la fila
 * reservada al aviso de truncado (ver TFP_FILA_FIN y decision #11): ni los totales ni la regla
 * gris ni el conteo de cuentas del invariante deben incluirla como si fuera un dato mas.
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

/**
 * Extrae el texto embebido de la variable `tabla_real` de una formula ancla YA APLICADA por este
 * modulo (ver _anclaYaEsNuestraTfp): escanea desde 'tabla_real; ' hasta el primer ';' de NIVEL 0
 * (fuera de parentesis y de comillas), el mismo delimitador que _bloqueComunTfp usa para cerrar
 * esa variable del LET. Hace falta porque, en una segunda corrida (bloque ya aplicado), la celda
 * ancla ya NO contiene la QUERY cruda de Franco -- la contiene ENVUELTA dentro de este LET -- y
 * los totales (S7/S8) necesitan ese mismo texto para poder recalcular su formula esperada y
 * comparar idempotencia, sin volver a pedirle a Franco su formula original.
 *
 * El toggle de comillas es deliberadamente ingenuo (cuenta comillas, no distingue apertura de
 * cierre): una comilla ESCAPADA en Sheets se escribe doblada (""), asi que dos toggles seguidos
 * se cancelan solos y el estado neto queda correcto sin necesidad de un caso especial.
 */
function _extraerTablaRealTfp(formulaAncla) {
    const marca = 'tabla_real; ';
    const inicio = formulaAncla.indexOf(marca);
    if (inicio === -1) throw new Error('no se encontro "tabla_real;" en la formula ancla ya aplicada');
    let i = inicio + marca.length;
    let profundidad = 0, dentroComillas = false;
    for (; i < formulaAncla.length; i++) {
        const ch = formulaAncla.charAt(i);
        if (ch === '"') { dentroComillas = !dentroComillas; continue; }
        if (dentroComillas) continue;
        if (ch === '(') profundidad++;
        else if (ch === ')') profundidad--;
        else if (ch === ';' && profundidad === 0) break;
    }
    if (i >= formulaAncla.length) {
        throw new Error('"tabla_real;" no cierra con un ";" de nivel 0: la formula ancla no tiene la forma esperada');
    }
    return formulaAncla.substring(inicio + marca.length, i);
}

// ============================================
// LA FORMULA NUEVA DE CADA BLOQUE
// ============================================

/**
 * El bloque de variables LET compartido por la celda ancla (seccion 1 + seccion 2) y por el
 * total de faltantes (S8/V8/Y8): UNA sola funcion JS que genera este texto para evitar que las
 * dos formulas de Sheets diverjan con el tiempo (decision #1 de la cabecera). Es exactamente el
 * calculo de "cuanto es real" y "cuanto falta" por cuenta, sin decidir todavia como se muestra.
 */
function _bloqueComunTfp(b, formulaRealVerbatim) {
    const cfgCat = _catalogoTfp(b.clave);
    const catCol = _colPlan(cfgCat, 'nombre');
    const cfgReg = RANGES.REGISTROS;
    const colProy = function (clave) {
        const l = cfgReg.columns[clave];
        return _refHoja(SHEETS.PROYECCION) + '!' + l + cfgReg.dataRow + ':' + l;
    };
    const neutras = CUENTAS_NEUTRAS.map(function (c) { return '(cuenta_proy<>"' + c + '")'; }).join(' * ');
    const sel = CAP_SELECTORES.tablero;

    return '  tabla_real; ' + formulaRealVerbatim + ';\n' +
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
        '  faltante_por_cuenta; MAP(real_por_cuenta; proy_por_cuenta; LAMBDA(val_real; val_proy; MAX(0; val_proy - val_real)));\n';
}

/**
 * La celda ancla (R10, U10, X10): reusa la QUERY real de Franco como caja negra (seccion 1,
 * verbatim y en su propio orden), calcula lo proyectado por cuenta desde "Proyeccion" (bloque
 * comun), arma la seccion 2 (faltante > 0, ordenada de mayor a menor) y las apila UNA DEBAJO DE
 * LA OTRA -- nunca intercaladas, decision Franco 2026-08-21 -- con una FILA SEPARADORA rotulada
 * entre las dos (decision #8, v0.41.0). Los montos de las dos secciones son NUMEROS crudos (sin
 * TEXT(): decision #7, v0.41.0) para que sumen al seleccionarlos; el separador solo aparece si
 * hay algo que separar (`hay_separador`) y su celda de Monto queda vacia.
 */
function _formulaCuentasTfp(b, formulaRealVerbatim) {
    const capacidad = _capacidadFilasTfp(b);

    return '=LET(\n' + _bloqueComunTfp(b, formulaRealVerbatim) +
        '  cant_real_bruto; ROWS(tabla_real);\n' +
        '  cant_real; IF(AND(cant_real_bruto = 1; INDEX(tabla_real; 1; 1) = ""); 0; cant_real_bruto);\n' +
        '  tabla_faltante; IFERROR(SORT(FILTER(HSTACK(universo; faltante_por_cuenta); faltante_por_cuenta > 0); 2; FALSE); HSTACK(""; 0));\n' +
        '  cant_faltante; SUMPRODUCT(N(faltante_por_cuenta > 0));\n' +
        '  cant_total_bruto; cant_real + cant_faltante;\n' +
        '  cant_total; IF(cant_total_bruto = 0; 1; cant_total_bruto);\n' +
        '  combinado; IF(cant_total_bruto = 0; HSTACK("Sin movimientos ni proyeccion"; 0);\n' +
        '    IF(cant_real = 0; tabla_faltante; VSTACK(tabla_real; tabla_faltante)));\n' +
        // La fila separadora se cobra una de las filas de DATOS solo si va a hacer falta
        // (decision #10): si no hay ninguna cuenta con faltante en TODO el universo, no hay
        // seccion 2 que separar y la capacidad se queda entera.
        '  capacidad_datos; IF(cant_faltante > 0; ' + (capacidad - 1) + '; ' + capacidad + ');\n' +
        '  cant_mostradas; MIN(cant_total; capacidad_datos);\n' +
        '  cant_ocultas; cant_total - cant_mostradas;\n' +
        '  hay_ocultas; cant_ocultas > 0;\n' +
        '  tabla_topada; ARRAY_CONSTRAIN(combinado; cant_mostradas; 2);\n' +
        '  monto_oculto; SUM(INDEX(combinado; 0; 2)) - SUM(INDEX(tabla_topada; 0; 2));\n' +
        '  aviso_texto; "y " & cant_ocultas & " cuenta" & IF(cant_ocultas = 1; ""; "s") & " mas";\n' +
        '  cant_real_mostradas; MIN(cant_real; cant_mostradas);\n' +
        // Acotado por cant_faltante (el universo real, no solo el resto de cant_mostradas): sin
        // este MIN, el caso "Sin movimientos ni proyeccion" (cant_total forzado a 1 con cero
        // faltante de verdad) calcularia cant_faltante_mostradas=1 y dispararia un separador
        // fantasma antes del placeholder.
        '  cant_faltante_mostradas; MIN(cant_faltante; cant_mostradas - cant_real_mostradas);\n' +
        '  hay_separador; cant_faltante_mostradas > 0;\n' +
        '  offset_separador; IF(hay_separador; 1; 0);\n' +
        '  fila_separador; cant_real_mostradas + 1;\n' +
        '  rotulo_separador; "' + TFP_ROTULO_SEPARADOR + '";\n' +
        '  filas_total; cant_mostradas + offset_separador + IF(hay_ocultas; 1; 0);\n' +
        '  idx_fila; SEQUENCE(filas_total);\n' +
        '  nombre_out; MAP(idx_fila; LAMBDA(pos;\n' +
        '    IF(pos > cant_mostradas + offset_separador; aviso_texto;\n' +
        '    IF(AND(hay_separador; pos = fila_separador); rotulo_separador;\n' +
        '    IF(pos <= cant_real_mostradas; INDEX(tabla_topada; pos; 1); INDEX(tabla_topada; pos - offset_separador; 1))))));\n' +
        '  monto_out; MAP(idx_fila; LAMBDA(pos;\n' +
        '    IF(pos > cant_mostradas + offset_separador; monto_oculto;\n' +
        '    IF(AND(hay_separador; pos = fila_separador); "";\n' +
        '    IF(pos <= cant_real_mostradas; INDEX(tabla_topada; pos; 2); INDEX(tabla_topada; pos - offset_separador; 2))))));\n' +
        '  HSTACK(nombre_out; monto_out)\n)';
}

/**
 * Total FALTANTE (S8/V8/Y8): reusa el MISMO bloque comun que la ancla (via _bloqueComunTfp,
 * nunca copiado a mano) y suma `faltante_por_cuenta` sobre el UNIVERSO COMPLETO -- no el
 * truncado a la vista: si algun dia hay truncado, este total sigue reflejando el faltante real
 * total (mas util para Franco que un numero que depende de cuantas filas entraron en pantalla).
 */
function _formulaTotalFaltanteTfp(b, formulaRealVerbatim) {
    return '=LET(\n' + _bloqueComunTfp(b, formulaRealVerbatim) +
        '  SUM(faltante_por_cuenta)\n)';
}

/**
 * Total REAL (S7/V7/Y7): suma DIRECTO la columna 2 de la QUERY real de Franco, sin pasar por el
 * derrame. Es matematicamente la MISMA cifra que Franco ya tenia (decision #1 de la cabecera):
 * el invariante "el total real no se mueve" se cumple por construccion, no por verificacion.
 */
function _formulaTotalRealTfp(formulaRealVerbatim) {
    return '=SUM(INDEX(' + formulaRealVerbatim + '; 0; 2))';
}

// ============================================
// EL GRIS DE LA SECCION DE FALTANTE (formato condicional)
// ============================================

/**
 * La formula de la regla propia de un bloque (decision #8 de la cabecera, v0.41.0): un COUNTIF
 * de rango EXPANSIVO, anclado UNA fila arriba de la primera fila de datos (filaDatos - 1), que
 * pregunta si el rotulo de la fila separadora ya aparecio en algun renglon de arriba. Con
 * referencia de fila relativa (col sin "$" en el segundo operando), Sheets reescribe el rango por
 * cada celda del rango al que se aplica la regla: en la fila N, el rango va desde el ancla hasta
 * N-1 -- ESTRICTAMENTE arriba de la fila evaluada. Eso deja afuera a la fila separadora misma (en
 * su propia fila, el rango todavia no llego a incluirla) y marca TODA fila estrictamente debajo
 * de ella, sin excepcion -- incluida la cuenta sin ningun movimiento real, que aparece una sola
 * vez pero esa unica vez esta siempre debajo del separador (la senal es POSICIONAL, no depende de
 * cuantas veces se repite el nombre).
 */
function _formulaReglaGrisTfp(b) {
    const filaAncla = b.filaDatos - 1;
    return '=COUNTIF($' + b.colCuenta + '$' + filaAncla + ':' + b.colCuenta + filaAncla +
        '; "' + TFP_ROTULO_SEPARADOR + '")>0';
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
 * solo pregunta si ESA celda fija de Monto tiene contenido. Sin cambios respecto de la version
 * anterior.
 */
function _formulaReglaAvisoTfp(b) {
    return '=$' + b.colMonto + '$' + b.filaFin + '<>""';
}

/** Las tres reglas "de aviso" (cursiva): una por bloque, sobre su fila reservada. */
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

/** La regla "de aviso": MISMA tinta que la de falta, pero en cursiva (su propio tratamiento). */
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
 * true si la formula ancla ya fue ENVUELTA por ALGUNA VERSION de este modulo (v0.40.0 o
 * v0.41.0), aplicada en una corrida anterior.
 *
 * IMPORTA DISTINGUIRLO: la formula que este modulo escribe EMPOTRA la QUERY original de Franco
 * como variable `tabla_real`, asi que sigue conteniendo 'QUERY(', 'SUM(Col2)' y 'GROUP BY Col1'
 * -- pasaria el chequeo de "_formaAnclaValidaTfp" igual que la original. Se identifica por tres
 * nombres de variable que `_bloqueComunTfp` genera SIEMPRE, sin cambios entre versiones (v0.40.0
 * y v0.41.0 llaman a la MISMA funcion JS para esa parte): si no se detectara, un segundo
 * "Aplicar" envolveria la formula ya aplicada dentro de si misma, un anidamiento creciente que
 * ademas corrompe nombres_real/montos_real.
 *
 * A PROPOSITO usa markers de `_bloqueComunTfp` (compartidos entre TODAS las versiones) y NO
 * markers de `_formulaCuentasTfp` (que SI cambiaron en v0.41.0: `tabla_topada` y
 * `cant_real_mostradas` siguen existiendo, pero ya no alcanzan para decidir si hace falta
 * REESCRIBIR -- esa decision es aparte, ver `anclaVigente` en `_preflightTfp`). Con este marcador
 * mas amplio, una ancla v0.40.0 YA DESPLEGADA en la planilla real (el caso concreto de Franco:
 * "v0.40.0, que funciona en la planilla de Franco") se reconoce como "envuelta por este modulo"
 * (asi `_extraerTablaRealTfp` sabe que tiene que desenvolverla en vez de tratarla como la QUERY
 * cruda) SIN por eso saltarse la reescritura a la forma v0.41.0: eso lo decide la comparacion
 * exacta de formulas en `_preflightTfp`, no esta funcion.
 */
function _anclaYaEsNuestraTfp(formula) {
    return formula.indexOf('tabla_real;') !== -1 &&
        formula.indexOf('real_por_cuenta;') !== -1 &&
        formula.indexOf('faltante_por_cuenta;') !== -1;
}

/**
 * Verifica los tres bloques por ROTULO antes de que nadie escriba, cuenta las cuentas reales
 * vivas de cada uno (informativo: estado() lo reporta, _verificarInvariantesTfp lo usa despues
 * de escribir -- nunca frena el preflight) y captura su total real ANTES del cambio (para el
 * invariante: el total real no se puede mover ni un centavo por este refactor).
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
        // Envuelta por ALGUNA version de este modulo (v0.40.0 o v0.41.0) -- solo decide si hay
        // que EXTRAER la QUERY real de adentro del LET o usar la celda tal cual (Franco, sin
        // tocar). Version-proof a proposito: ver _anclaYaEsNuestraTfp.
        const estabaEnvueltaPorTfp = _anclaYaEsNuestraTfp(formulaAnclaVivaTexto);

        // La QUERY real de Franco, lista para reusar como `tabla_real`: si el bloque ya estaba
        // envuelto (cualquier version), hay que EXTRAERLA de dentro del LET vivo (ya no esta
        // cruda en la celda); ver _extraerTablaRealTfp.
        let formulaRealParaTotales;
        try {
            formulaRealParaTotales = estabaEnvueltaPorTfp
                ? _extraerTablaRealTfp(formulaAnclaVivaTexto)
                : formulaAnclaVivaTexto;
        } catch (e) {
            desvios.push(celdaAncla + ' (bloque "' + tituloVivo + '") ya fue escrita por este modulo pero ' +
                'no se pudo leer su QUERY real embebida: ' + e.message + '. No se toco nada.');
            return;
        }

        if (!_formaAnclaValidaTfp(formulaRealParaTotales, b.categoria)) {
            desvios.push(celdaAncla + ' no tiene la forma esperada (QUERY agrupando por cuenta, ' +
                'WHERE Col3 = \'' + b.categoria + '\'): la formula real cambio y hay que volver a medirla.');
            return;
        }

        // La formula que este modulo ESCRIBIRIA hoy, a partir de la QUERY real (cruda o
        // extraida). Si la celda viva ya coincide (canonizada), esta VIGENTE y no hace falta
        // reescribirla -- ni siquiera si viene de una corrida anterior de esta misma version.
        // Si NO coincide (formula cruda de Franco, o una version anterior como v0.40.0 con
        // TEXT()/sin separador), se reescribe usando la QUERY ya recuperada arriba.
        const formulaAnclaEsperada = _formulaCuentasTfp(b, formulaRealParaTotales);
        // formulaAnclaVivaTexto viene SIN el '=' inicial (asi la devuelve _formulaSinIgualTfp);
        // formulaAnclaEsperada lo trae (asi la arma _formulaCuentasTfp). Sin re-anteponerlo aca,
        // _canonizarFormula jamas encontraria coincidencia y anclaVigente daria SIEMPRE false.
        const anclaVigente = _canonizarFormula('=' + formulaAnclaVivaTexto) === _canonizarFormula(formulaAnclaEsperada);

        // El formato de numero del total real (S7/V7/Y7): decision #12, se copia tal cual al
        // total de faltantes (S8/V8/Y8) -- nunca se inventa un patron nuevo.
        const formatoTotalRealVivo = hoja.getRange(b.totalReal).getNumberFormat() || TFP_PATRON_MONTO_DEFECTO;

        const totalRealVivo = hoja.getRange(b.totalReal).getFormula();
        if (!totalRealVivo) {
            desvios.push(b.totalReal + ' no tiene formula.');
            return;
        }
        const formulaTotalRealEsperada = _formulaTotalRealTfp(formulaRealParaTotales);
        const totalRealYaEsNueva = _canonizarFormula(totalRealVivo) === _canonizarFormula(formulaTotalRealEsperada);
        const totalRealValorPrevio = hoja.getRange(b.totalReal).getValue();

        const totalFaltanteVivo = hoja.getRange(b.totalFaltante);
        const faltanteFormula = totalFaltanteVivo.getFormula();
        const faltanteValor = totalFaltanteVivo.getValue();
        const formulaTotalFaltanteEsperada = _formulaTotalFaltanteTfp(b, formulaRealParaTotales);
        const faltanteEsNuestra = _canonizarFormula(faltanteFormula) === _canonizarFormula(formulaTotalFaltanteEsperada);
        if (!faltanteEsNuestra && (faltanteFormula || String(faltanteValor) !== '')) {
            desvios.push(b.totalFaltante + ' no esta vacia (formula="' + faltanteFormula + '", valor="' +
                faltanteValor + '"): podria ser un dato de Franco. No se toco nada.');
            return;
        }
        const formatoTotalFaltanteVivo = totalFaltanteVivo.getNumberFormat();
        const formatoTotalFaltanteYaEsNueva = formatoTotalFaltanteVivo === formatoTotalRealVivo;

        const rotuloFaltanteVivo = String(hoja.getRange(b.rotuloFaltante.celda).getValue() || '').trim();
        const rotuloYaEsta = _normalizarRotulo(rotuloFaltanteVivo) === _normalizarRotulo(b.rotuloFaltante.esperado);

        const valoresCuenta = hoja.getRange(_rangoColTfp(b, b.colCuenta)).getValues();
        const cuentasVivas = valoresCuenta.filter(function (f) { return String(f[0] || '').trim() !== ''; }).length;
        const capacidadFilas = _capacidadFilasTfp(b);
        const capacidadPeorCaso = _capacidadPeorCasoTfp(b);
        // decision Franco 2026-08-21: nunca aborta si cuentasVivas > capacidad. La formula nueva
        // trunca sola a las cuentas mas importantes y avisa en la propia hoja cuantas quedaron
        // afuera (ver _formulaCuentasTfp).

        bloques[clave] = {
            b: b, anclaVigente: anclaVigente, formulaAnclaEsperada: formulaAnclaEsperada,
            formulaRealParaTotales: formulaRealParaTotales,
            formatoTotalRealVivo: formatoTotalRealVivo,
            formatoTotalFaltanteYaEsNueva: formatoTotalFaltanteYaEsNueva,
            totalRealFormulaVieja: totalRealVivo,
            totalRealYaEsNueva: totalRealYaEsNueva, totalRealValorPrevio: totalRealValorPrevio,
            formulaTotalRealEsperada: formulaTotalRealEsperada,
            formulaTotalFaltanteEsperada: formulaTotalFaltanteEsperada,
            faltanteEsNuestra: faltanteEsNuestra, faltanteFormulaVieja: faltanteFormula,
            faltanteValorVieja: faltanteValor, rotuloYaEsta: rotuloYaEsta, cuentasVivas: cuentasVivas,
            capacidadFilas: capacidadFilas, capacidadPeorCaso: capacidadPeorCaso
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

        if (!info.anclaVigente) {
            cambios.push({
                bloque: clave, celda: _celdaAnclaTfp(b), tipo: 'ancla',
                formulaNueva: info.formulaAnclaEsperada,
                nota: 'Cuentas + faltante: ' + b.titulo.esperado,
                resumen: 'dos secciones con fila separadora explicita ("' + TFP_ROTULO_SEPARADOR + '"): real ' +
                    'arriba oscuro, faltante abajo en NUMEROS reales (suman en la barra de estado), ' +
                    'reusando la QUERY real existente'
            });
        }

        if (!info.totalRealYaEsNueva) {
            cambios.push({
                bloque: clave, celda: b.totalReal, tipo: 'total_real',
                formulaVieja: info.totalRealFormulaVieja, formulaNueva: info.formulaTotalRealEsperada,
                nota: 'Total real: ' + b.titulo.esperado,
                resumen: 'suma directa de la columna 2 de la QUERY real (por construccion, no relee el derrame)'
            });
        }
        if (!info.faltanteEsNuestra || !info.formatoTotalFaltanteYaEsNueva) {
            cambios.push({
                bloque: clave, celda: b.totalFaltante, tipo: 'total_faltante',
                formulaVieja: info.faltanteFormulaVieja, valorVieja: info.faltanteValorVieja,
                formulaNueva: info.formulaTotalFaltanteEsperada, formatoNuevo: info.formatoTotalRealVivo,
                nota: 'Total faltante: ' + b.titulo.esperado,
                resumen: 'suma del faltante por cuenta sobre el universo completo (por construccion); ' +
                    'formato de numero copiado en vivo de ' + b.totalReal
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
 * Cuenta los nombres DISTINTOS no vacios en el rango vivo de Cuenta, con los mismos reintentos:
 * mientras la formula ancla no termino de calcular, la columna entera puede mostrar "Cargando...".
 * Distintos, no filas: con el layout de dos secciones un nombre puede repetirse (real + faltante).
 * EXCLUYE el rotulo de la fila separadora (TFP_ROTULO_SEPARADOR, v0.41.0): no es una cuenta, y
 * contarlo infla el piso de "nombres distintos" -- podria enmascarar una cuenta real perdida por
 * exactamente uno.
 */
function _contarNombresDistintosYaCalculadoTfp(hoja, rangoA1) {
    const esperas = [0, 600, 1500, 3000];
    for (let i = 0; i < esperas.length; i++) {
        if (esperas[i]) { SpreadsheetApp.flush(); Utilities.sleep(esperas[i]); }
        const valores = hoja.getRange(rangoA1).getValues();
        const pendiente = valores.some(function (f) {
            const v = f[0];
            return typeof v === 'string' && v !== '' && v.indexOf('#') !== 0 &&
                _normalizarRotulo(v).indexOf('cargando') !== -1;
        });
        if (!pendiente) {
            const nombres = valores.map(function (f) { return String(f[0] || '').trim(); })
                .filter(function (v) { return v !== '' && v !== TFP_ROTULO_SEPARADOR; });
            const distintos = nombres.filter(function (v, i) { return nombres.indexOf(v) === i; });
            return distintos.length;
        }
    }
    return TFP_PENDIENTE;
}

/**
 * Invariantes por bloque, sobre los VALORES releidos:
 *   1. El total real NO SE MOVIO respecto del valor previo a este refactor -- garantizado por
 *      construccion (S7 suma directo la QUERY de Franco), pero se releen igual: la construccion
 *      correcta en la formula generadora no reemplaza la verificacion contra la planilla viva.
 *   2. El total faltante es un numero finito y no negativo.
 *   3. Cuantos NOMBRES DISTINTOS con contenido quedaron en el rango de datos (excluida la fila de
 *      aviso): un piso, no una igualdad exacta, salvo en el caso de truncado real (mismo espiritu
 *      que la version anterior, adaptado a que ahora un nombre puede repetirse en dos filas).
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

        const distintosAhora = _contarNombresDistintosYaCalculadoTfp(pre.hoja, _rangoColTfp(b, b.colCuenta));
        if (distintosAhora === TFP_PENDIENTE) {
            avisos.push('"' + nombreBloque + '": la columna Cuenta todavia estaba calculando al releerla.');
        } else if (info.cuentasVivas > info.capacidadFilas) {
            // TRUNCADO ESPERADO (caso extremo: mas cuentas reales que filas de datos disponibles
            // incluso usando una sola fila cada una): el piso pasa a ser la capacidad completa.
            if (distintosAhora < info.capacidadFilas) {
                fallas.push('"' + nombreBloque + '": con truncado esperado (' + info.cuentasVivas +
                    ' cuenta(s) real(es) para ' + info.capacidadFilas + ' fila(s) de datos) quedaron ' +
                    distintosAhora + ' nombre(s) distinto(s) y se esperaban al menos ' + info.capacidadFilas +
                    '. Una cuenta real no puede perderse.');
            }
        } else if (distintosAhora < info.cuentasVivas) {
            // SIN truncado esperado: todos los nombres reales de antes tienen que seguir
            // apareciendo (piso, no igualdad: el universo union con el catalogo puede sumar
            // proyectadas-sin-real ademas, y esas SUMAN nombres distintos, no los reemplazan).
            fallas.push('"' + nombreBloque + '": quedaron ' + distintosAhora + ' nombre(s) distinto(s) y ' +
                'antes habia ' + info.cuentasVivas + ' cuenta(s) con movimiento real. Una cuenta real no puede perderse.');
        }
    });
    return { fallas: fallas, avisos: avisos };
}

// ============================================
// ESCRITURA Y REVERSION
// ============================================

function _escribirCambioTfp(hoja, c) {
    const rango = hoja.getRange(c.celda);
    if (c.tipo === 'rotulo') {
        rango.setValue(TFP_BLOQUES[c.bloque].rotuloFaltante.esperado);
        return;
    }
    rango.setFormula(c.formulaNueva);
    // Decision #12: solo 'total_faltante' trae formatoNuevo (el patron copiado en vivo de su
    // hermano real). 'ancla' y 'total_real' no tocan formato de numero.
    if (c.formatoNuevo) rango.setNumberFormat(c.formatoNuevo);
}

/** Restaura cada celda escrita a su estado previo (formula, valor, formato o vacio). */
function _revertirEscriturasTfp(ss, escritas) {
    escritas.forEach(function (w) {
        try {
            const r = ss.getSheetByName(w.nombreHoja).getRange(w.celda);
            if (w.previaFormula) {
                r.setFormula(w.previaFormula);
            } else if (w.previoValor !== undefined && w.previoValor !== null && String(w.previoValor) !== '') {
                r.setValue(w.previoValor);
            } else {
                r.clearContent();
            }
            // El formato de numero se restaura SIEMPRE que se haya capturado uno (decision #12),
            // sin importar por que rama vino el contenido -- son dos propiedades independientes
            // de la celda.
            if (w.previoFormato) r.setNumberFormat(w.previoFormato);
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
            l.push('"' + b.titulo.esperado + '": ' + info.cuentasVivas + ' cuenta(s) con movimiento real ' +
                'hoy. Peor caso garantizado sin truncar (si TODAS tuvieran faltante pendiente): ' +
                info.capacidadPeorCaso + ' cuentas. En la practica suele entrar mas: una cuenta ya cubierta ' +
                '(faltante = 0) ocupa una sola fila de las ' + info.capacidadFilas + ' disponibles.' +
                (info.cuentasVivas > info.capacidadFilas
                    ? ' ATENCION: ya hoy hay mas cuentas reales (' + info.cuentasVivas + ') que filas de ' +
                      'datos (' + info.capacidadFilas + '), incluso a una fila cada una: va a truncar y avisar.'
                    : ''));
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
        l.push('');
        l.push('NOTA: los montos de las dos secciones son NUMEROS (no texto, decision #7 v0.41.0): ' +
            'seleccionar celdas de la columna Monto suma en la barra de estado de Sheets, real y ' +
            'faltante juntos si se seleccionan ambos.');
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
            '  - El bloque pasa a tener DOS SECCIONES separadas por una FILA ROTULADA explicita\n' +
            '    ("' + TFP_ROTULO_SEPARADOR + '"): arriba TODO lo real (una fila por cuenta con\n' +
            '    movimiento, sin cambios de fondo), abajo TODO lo faltante (una fila por cuenta con\n' +
            '    faltante > 0 este mes, gris, REPITIENDO el nombre de la cuenta).\n' +
            '  - Los montos de las dos secciones son NUMEROS reales (no texto): sumar en la barra\n' +
            '    de estado al seleccionar celdas vuelve a funcionar en toda la columna Monto.\n' +
            '  - Los totales de la fila 7 (S7/V7/Y7) se recalculan por construccion desde la QUERY\n' +
            '    real de siempre: el total real NO se mueve, se verifica al releerlo.\n' +
            '  - Los totales nuevos (S8/V8/Y8) suman el faltante de TODAS las cuentas (aunque no\n' +
            '    entren todas en pantalla), con el MISMO formato de moneda que su hermano real.\n' +
            '  - El bloque sigue yendo hasta la fila 30 y NUNCA aborta por falta de lugar: si un dia\n' +
            '    hay mas filas que hacen falta que lugar, se muestran las cuentas mas importantes y\n' +
            '    la ULTIMA fila avisa, en cursiva, cuantas quedaron afuera y por cuanta plata.\n\n' +
            'Ninguna cuenta con movimiento real puede perderse (se verifica que la cantidad de nombres ' +
            'distintos mostrados coincida con lo esperado).' +
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
            // Solo los cambios que traen formatoNuevo (decision #12: total_faltante) necesitan
            // respaldar el formato de numero previo -- _respaldarFormulerio SOLO fotografia
            // formulas, asi que esto viaja aparte, en el mismo objeto previos.
            const previoFormato = c.formatoNuevo ? rango.getNumberFormat() : undefined;
            previos.celdas.push({
                celda: c.celda, tenia: previaFormula ? 'formula' : (String(previoValor) !== '' ? 'valor' : 'vacia'),
                valor: previoValor, formatoPrevio: previoFormato
            });

            _escribirCambioTfp(pre.hoja, c);
            escritas.push({
                nombreHoja: pre.nombre, celda: c.celda,
                previaFormula: previaFormula, previoValor: previoValor, previoFormato: previoFormato
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
            '  1. Arriba de cada bloque, una fila por cuenta con movimiento real (oscuro). Despues,\n' +
            '     una fila que dice "' + TFP_ROTULO_SEPARADOR + '" (Monto vacio). Debajo de esa,\n' +
            '     una fila por cuenta con faltante > 0 (gris), repitiendo el nombre de la cuenta.\n' +
            '  2. Los montos son NUMEROS: seleccionar celdas de la columna Monto (real y/o\n' +
            '     faltante) tiene que mostrar la SUMA en la barra de estado de Sheets.\n' +
            '  3. Los totales de la fila 7 no se movieron (se verifico); el total de faltantes de\n' +
            '     la fila 8 es nuevo, suma TODAS las cuentas con faltante (entren o no en pantalla)\n' +
            '     y tiene el mismo formato de moneda que su hermano de la fila 7.\n' +
            '  4. Una cuenta proyectada sin movimiento real todavia aparece, solo en la seccion de\n' +
            '     faltante, con el faltante completo.\n' +
            '  5. Si algun bloque no tenia lugar para todas las filas, su ULTIMA fila (30) dice\n' +
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
            let hecho = false;
            if (p.tenia === 'formula') {
                const fila = filasRespaldo.find(function (f) {
                    return f.nombreHoja === NAV_CONFIG.SHEETS.TABLERO && f.celda === p.celda;
                });
                if (!fila) { faltantes.push(p.celda); }
                else { rango.setFormula(fila.formula); hecho = true; }
            } else if (p.tenia === 'valor') {
                rango.setValue(p.valor); hecho = true;
            } else {
                rango.clearContent(); hecho = true;
            }
            // El formato de numero (decision #12) es una propiedad aparte de la formula/valor: se
            // restaura siempre que se haya respaldado, sin importar por que rama vino el contenido.
            if (p.formatoPrevio) rango.setNumberFormat(p.formatoPrevio);
            if (hecho) repuestas++;
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
