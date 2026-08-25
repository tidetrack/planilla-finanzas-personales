/**
 * DEVTOOL_FormulerioV0111.js
 * Reparacion del formulerio de "Inicio" y "Tablero" que quedo roto al portar las formulas
 * al layout del rediseno Fix (swap v0.11, 2026-08-18).
 *
 * [CONCEPTO DE NEGOCIO]
 * El Tablero y el Inicio son las dos superficies donde Franco LEE su situacion financiera.
 * Hoy mienten. No con un error visible -- eso seria benigno -- sino con numeros plausibles
 * calculados sobre datos mal apareados. Cuatro defectos, una sola raiz comun: el rediseno
 * movio las celdas y las formulas se copiaron apuntando a las direcciones viejas.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: toda operacion sobre datos vivos es idempotente, tiene respaldo
 * congelado y VERIFICADO antes de mutar, y declara su contrato. Cicatriz 5: un guard que
 * reporta exito sin hacer el trabajo es peor que no tener guard. Cicatriz 4: el respaldo se
 * relee antes de tocar nada; un respaldo no verificado es una afirmacion, no un respaldo.
 *
 * ============================================================================
 * LOS CUATRO DEFECTOS (medidos sobre la planilla viva el 2026-08-18/19)
 * ============================================================================
 *
 * 1. ANCLAS CORRIDAS TRES FILAS -- la raiz de casi todo.
 *    "Tablero"!AJ6 es el motor entero de la hoja: un unico QUERY sobre Registros!B6:M que
 *    DERRAMA doce columnas desde la fila 6 (AJ=Monto, AK=Tipo, AL=Cuenta, AM=Tipo de Cuenta,
 *    AN=Medio, AO=Moneda, AP=Fecha, AQ=Nota, AR/AS/AT/AU=los TC congelados). Pero quince
 *    formulas consumidoras piden "AK9:AK", "AO9:AO", "AR9:AR"... fila 9. Cada monto se aparea
 *    con el tipo, la moneda y la cotizacion del movimiento que esta TRES FILAS MAS ABAJO.
 *    No da error: da otro numero. Es el peor modo de falla posible y explica, por ejemplo,
 *    que N19 declare $63.567.848 de capitalizacion en un mes (montos en pesos multiplicados
 *    por la cotizacion del dolar porque cayeron en el bucket de moneda equivocado).
 *
 * 2. EL SELECTOR DE MONEDA PERDIDO ("Tablero"!N4 -> #REF!).
 *    En el layout viejo el selector vivia en $I$9. El rediseno lo movio a N4 y las formulas
 *    portadas quedaron con #REF! donde iba la referencia. Diecisiete tokens en ocho celdas.
 *    Donde el #REF! esta envuelto en IFERROR se degrada en silencio (AV6 devuelve una columna
 *    entera de ceros; N24/N25 devuelven 0%); donde no lo esta, propaga (O23:O25 = #REF!).
 *    AV6 es "Valor en ARS", la columna que alimenta TODO el bloque "Movimientos del mes":
 *    con AV en ceros, S7/V7/Y7 = $0, N16/N17/N18 = $0 y O16:O19 = 0%.
 *
 * 3. EL BLOQUE "Disponibilidad de fondos" ROTADO UNA POSICION.
 *    El rediseno reordeno los rotulos (el viejo empezaba por Ahorro; el nuevo por Gastos
 *    Fijos) pero las formulas se pegaron en el orden viejo. La formula de Capacidad de Ahorro
 *    quedo en la fila de Gastos Fijos. Cada una calcula bien lo suyo, en la fila del vecino.
 *
 * 4bis. LA CONVERSION DE MONEDA DE "Inicio" NO CONVIERTE (hallado el 2026-08-19, DESPUES de
 *    reparar los cuatro primeros: es el sexto defecto, no uno de los cuatro).
 *    "Inicio"!AF8 y AT8 son las columnas "Valor en X" de los dos motores de la hoja. Leen la
 *    moneda de la columna de CUENTA (V y AJ) en vez de la de MONEDA (Y y AM), asi que ninguna
 *    rama del IF se cumple nunca, `tasa_origen` cae al literal 1 y la columna entera es un
 *    passthrough del monto crudo. Cada movimiento en moneda extranjera entra a C13, F13, C15 y
 *    F15 A VALOR NOMINAL: un cobro de 200 USD cuenta como 200 pesos. Medido en junio de 2026:
 *    ~$376.740 de ingreso desaparecido, el 23% del mes. AT8 arrastra ademas una referencia
 *    todavia mas fragil -- toma la moneda de DESTINO de `Y13`, que no es un selector sino la
 *    celda de datos con la moneda del sexto movimiento del mes actual --, y el rotulo AT7 la
 *    repite. Es de la misma familia que el defecto 2: una referencia que el rediseno dejo
 *    apuntando a otra cosa.
 *
 * 4. 'Liquidez' HUERFANA -- un tipo de categoria que ya no existe.
 *    El Plan de Cuentas nuevo tiene cuatro tipos: Ahorros, Inversiones, Financiacion, Hogar.
 *    'Liquidez' era el nombre viejo de lo que hoy se llama 'Hogar' (ambos con una sola
 *    categoria: "Medio Cotidiano"). Catorce celdas comparan contra el literal viejo, asi que
 *    la condicion nunca se cumple: el gasto cotidiano se cuenta como capital acumulado, y los
 *    arrastres de "Inicio Mes" que si debian entrar quedan todos afuera.
 *
 * ============================================================================
 * POR QUE ESTE MODULO NO ESCRIBE NI UNA FORMULA NUEVA
 * ============================================================================
 * Todo el arreglo es CIRUGIA DE TOKENS sobre el texto que ya vive en cada celda: se lee con
 * getFormula(), se reemplazan las direcciones equivocadas, se escribe de vuelta. Nunca se
 * redacta una formula desde cero.
 *
 * Es deliberado, y evita de raiz la trampa de locale documentada en 07_MiradaInteranual.js:
 * la planilla es es_AR (separador ";", separador de columna "\" dentro de los literales {}) y
 * setFormula no traduce los arrays literales. Media docena de las formulas a reparar los usan
 * (R9, U9, X9, C18, AA9 y sus gemelas de Inicio). Al no autorizarlas nunca -- solo mover
 * tokens dentro de un string que salio de la propia celda -- el ida y vuelta es identidad y
 * los literales {} salen exactamente como entraron.
 *
 * Lo mismo vale para el bloque rotado: NO se reescriben O23:O25, se INTERCAMBIAN entre si.
 *
 * ============================================================================
 * LO QUE ESTE MODULO SE NIEGA A HACER
 * ============================================================================
 * 1. NO TOCA "AF9:AF12" ni "Inicio"!C8 mas alla de sus anclas. Filtran por el NOMBRE de
 *    categoria ("Medio Cotidiano") en vez de por el tipo. Es fragil -- hardcodea un dato de
 *    catalogo -- pero hoy da el numero correcto. Fragil no es roto: se documenta, no se toca.
 * 2. NO LIMPIA el Plan de Cuentas (la fila huerfana P19/Q19 sin nombre y con tipo Hogar, ni
 *    el duplicado "Meta de Ahorro 3" en P17/P18). Es dato de Franco, no formula.
 * 3. NO ARREGLA "Inicio"!C15/F15 mas alla del literal -- el QUINTO defecto, todavia abierto.
 *    Devuelven siempre "0% respecto del mes anterior" aunque la variacion real sea de +155%.
 *    Diagnostico del 2026-08-19: cuatro condiciones (cond_ingreso_act, cond_no_traspaso_act y
 *    sus gemelas _ant) se ligan a variables de LET SIN envolverlas en ARRAYFORMULA. En una
 *    formula de resultado escalar, la comparacion rango-contra-escalar se evalua por
 *    interseccion implicita, FILTER recibe una condicion de una sola fila, tira error de
 *    tamanio, y el IFERROR externo lo convierte en 0. Con ambos meses en 0, TEXT imprime la
 *    tercera seccion del formato: "0%". La correccion seria envolver esas cuatro (dos en F15)
 *    en ARRAYFORMULA. NO se aplica todavia porque es un mecanismo de falla distinto del de los
 *    otros seis y no esta verificado de forma independiente; y porque muestra un rotulo feo,
 *    no un numero equivocado en una cifra de portada.
 * 4. NO ESCRIBE si el catalogo o la geometria no son los esperados. El preflight deriva los
 *    rotulos del motor desde RANGES.REGISTROS.columns (regla SSOT) y aborta ante la minima
 *    discrepancia. Un mapeo de columnas supuesto y no verificado ya nos costo una vez.
 *
 * Contrato de las tres publicas: { ok: boolean, detalle?: string, error?: string }.
 *   estadoFormulerioV0111()    -> solo lectura, dice que cambiaria. Se corre PRIMERO.
 *   aplicarFormulerioV0111()   -> preflight + respaldo verificado + escritura + relectura.
 *   revertirFormulerioV0111()  -> restaura desde el respaldo de la ultima corrida.
 *
 * ============================================================================
 * LA CORRIDA FALLIDA DEL 2026-08-19 (v0.12.0) -- por que este archivo cambio
 * ============================================================================
 * La primera version escribio en la planilla productiva tres formulas que NO PARSEAN. En
 * `_reponerReferencias` habia dos reemplazos con string de reemplazo en vez de funcion:
 *     out.replace(/(\$N\$10\s*-\s*)#REF!/g, '$1$N$17')
 * En un string de reemplazo, '$1' es el grupo, '$N' es literal y '$17' vuelve a ser el grupo 1
 * seguido de un 7. En vez de "$N$10 - $N$17" escribio "$N$10 - $N$N$10 - 7". O23, O24 y O25
 * pasaron de #REF! a #ERROR!: quedaron PEOR que antes.
 *
 * Y el verificador lo dejo pasar, que es lo grave. `_verificarEscrituraFormulerio` comparaba el
 * TEXTO releido contra el texto escrito, y comprobaba ausencia de #REF!, de 'Liquidez' y de
 * anclas viejas. El texto corrupto cumplia las cuatro condiciones. Comprobar que escribiste lo
 * que querias escribir NO ES comprobar que funciona: es la cicatriz 5 del arnes cometida por el
 * modulo que la cita en su propia cabecera.
 *
 * Las dos correcciones de fondo, ninguna apoyada en la otra:
 *   (a) TODOS los reemplazos van por funcion. El valor devuelto se inserta tal cual y esta
 *       clase de bug deja de ser posible en un proyecto donde toda formula lleva '$'.
 *   (b) El verificador LEE EL VALOR RESULTANTE de cada celda escrita y aborta -- revirtiendo
 *       todo el lote -- si alguna quedo en error.
 * Y una tercera, fuera del codigo: las transformaciones se corren contra las formulas reales
 * del gemelo (docs/permanente/celdas.tsv) ANTES de desplegar. Ese banco de pruebas habria
 * cortado el bug en diez segundos; no correrlo fue el error de verdad.
 *
 * Ademas, este modulo repara ahora el artefacto "$N$N$10 - 7" que aquella corrida dejo escrito:
 * sin eso, re-correr "Aplicar" contestaria "nada que hacer" con tres celdas rotas a la vista.
 *
 * ============================================================================
 * EL RECORRIDO DEL 2026-08-21 -- cuatro celdas mas, misma raiz
 * ============================================================================
 * Franco agrego a mano una fila a los cuatro bloques de agregacion (Ingresos, Gastos Fijos,
 * Gastos Variables, Categorias) para dejar lugar al "Faltante proyectado" (ver
 * DEVTOOL_TableroFaltanteProyectado.js, v0.36.0): el header que vivia en la fila 8 paso a la 9 y
 * el derrame de datos que vivia en la 9 paso a la 10. FORM_CELDAS declaraba R9/U9/X9/AA9 -- ahora
 * apuntaban al HEADER ("Cuenta"/"Nombre"), no al derrame. `_planFormulerio` no se cae con esto
 * (getFormula() de un header vacio de formula es "" y el aviso ya lo cubre), pero es el MISMO modo
 * de falla documentado en la cabecera de este archivo: una direccion que el rediseno dejo
 * apuntando a otra cosa. Se corrige a R10/U10/X10/AA10, con preflight por ROTULO (nuevo, ver
 * FORM_ROTULOS_CELDAS): antes de tocar cualquiera de las cuatro, se lee la fila de header y se
 * verifica que diga lo esperado. Si no, el modulo entero aborta -- no silba en falso.
 *
 * "Comprobacion de traspasos" tuvo el mismo movimiento por un motivo distinto: el titulo bajo de
 * L27 a L28 (mismo rediseno), y la formula -- que YA vivia una fila debajo de su titulo, en L28 --
 * bajo con el a L29. FORM_CELDAS declaraba L28 (el titulo viejo se movio, la formula lo siguio):
 * se corrige a L29, tambien con preflight por rotulo contra L28.
 *
 * NO se tocan N19 ("Capitalizacion real del mes") ni AF9:AF12/AG9:AG12 ("Saldo actual"/"Capital"
 * por moneda): quedaron OBSOLETOS mucho antes de este movimiento. N19 lo escribe hoy
 * DEVTOOL_Capitalizacion.js en O19 (decision Franco 2026-08-20, rediseno L7:O19: "los montos
 * pasaron de N a O"). El bloque de saldos por moneda se corrio de las filas 9-12 a las 18-21
 * cuando se inserto el bloque "Tipo de Medios" arriba (DEVTOOL_StockYFlujo.js, SYF_SALDOS_TABLERO)
 * -- y las filas 9-12 de AG hoy son ESE bloque nuevo, no el viejo: tienen formula, pero de otra
 * cosa. Dejar estas cuatro entradas en FORM_CELDAS no escribe nada malo (el aviso de "sin formula"
 * o el "SIN CAMBIO" del patron que no matchea las protegen), pero repararlas ya no es trabajo de
 * este modulo. Ver docs/permanente/HISTORIAL_DESARROLLO.md v0.38.0 para el detalle completo.
 *
 * @version 0.12.2
 * @since 2026-08-19
 * @lastModified 2026-08-21
 * @see docs/permanente/FUNCIONALIDADES.md (seccion formulerio)
 */

// ============================================
// CONSTANTES
// ============================================

const FORM_PREFIJO_RESPALDO = 'Respaldo formulerio ';
const FORM_PROP_APLICADO = 'formulerio_v0111_aplicado';
const FORM_PROP_RESPALDO = 'formulerio_v0111_respaldo';

/** Techo de celdas a leer por hoja al respaldar, y piso de filas que igual se respaldan. */
const FORM_TOPE_CELDAS_RESPALDO = 400000;
const FORM_MIN_FILAS_RESPALDO = 60;

/**
 * Fila desde la que DERRAMA el motor del Tablero. No es una constante libre: es la fila en la
 * que vive la unica formula del bloque (AJ6). El preflight la verifica contra la planilla.
 */
const FORM_FILA_DERRAME_TABLERO = 6;
const FORM_CELDA_MOTOR_TABLERO = 'AJ6';
const FORM_FILA_HEADER_TABLERO = 4;
const FORM_COL_MOTOR_TABLERO = 'AJ';

/** Celda del selector de moneda del Tablero: lo que el rediseno dejo como #REF!. */
const FORM_SELECTOR_MONEDA_TABLERO = '$N$4';

/** Tipo de categoria que reemplaza al 'Liquidez' del catalogo viejo. */
const FORM_TIPO_VIEJO = 'Liquidez';
const FORM_TIPO_NUEVO = 'Hogar';

/**
 * Celdas del formulerio, hoja por hoja, con lo que hay que hacerle a cada una.
 *   anclas  -> re-apuntar las referencias del motor de la fila 9 a la 6 (defecto 1)
 *   refs    -> reponer el selector de moneda y los reales de fijos/variables (defecto 2)
 *   literal -> 'Liquidez' -> 'Hogar' (defecto 4)
 * El bloque rotado (defecto 3) se trata aparte: no es un reemplazo, es un intercambio.
 *
 * "Inicio" NO lleva anclas: su motor derrama desde la fila 8 y sus consumidores piden fila 8.
 * Esa hoja es internamente consistente; lo unico que arrastra es el literal huerfano.
 */
const FORM_CELDAS = [
    // --- Inicio: solo el literal ---
    { hoja: 'INICIO', celda: 'C13', anclas: false, refs: false, literal: true, nota: 'Ingresos del mes' },
    { hoja: 'INICIO', celda: 'F13', anclas: false, refs: false, literal: true, nota: 'Egresos del mes' },
    { hoja: 'INICIO', celda: 'C15', anclas: false, refs: false, literal: true, nota: 'Delta ingresos vs mes anterior' },
    { hoja: 'INICIO', celda: 'F15', anclas: false, refs: false, literal: true, nota: 'Delta egresos vs mes anterior' },

    // --- Tablero: la columna que alimenta todo el bloque "Movimientos del mes" ---
    { hoja: 'TABLERO', celda: 'AV6', anclas: true, refs: true, literal: false, nota: 'Valor convertido (raiz del bloque)' },

    { hoja: 'TABLERO', celda: 'C18', anclas: true, refs: false, literal: false, nota: 'Detalle por medio y moneda' },

    // "Comprobacion de traspasos": el TITULO bajo de L27 a L28 el 2026-08-21 y la formula -- que ya
    // vivia una fila debajo de su titulo -- lo siguio de L28 a L29.
    { hoja: 'TABLERO', celda: 'L29', anclas: true, refs: false, literal: false, nota: 'Comprobacion de traspasos',
        rotuloCelda: 'L28', rotuloEsperado: 'Comprobacion Traspasos' }
];

/**
 * ============================================================================
 * LO QUE SE RETIRO DE FORM_CELDAS EL 2026-08-21 -- decision Franco, y por que
 * ============================================================================
 * Nueve coordenadas salieron de la lista de arriba. NINGUNA se saco por estar rota: todas tienen
 * hoy un dueño distinto, verificado contra el gemelo digital celda por celda. Dejarlas declaradas
 * costaba dos cosas a la vez -- ruido permanente en el banco (5 FALLA(S) fijas que habia que
 * aprender a ignorar, que es justo donde se esconde el rojo nuevo) y, en dos casos, riesgo real de
 * pisar la formula de otro modulo.
 *
 *   - INICIO!F8 "Capital Acumulado"     -> lo administra DEVTOOL_StockYFlujo.js. Lo dice tambien
 *                                          la cabecera de DEVTOOL_InicioPresupuesto.js: "F8 [...]
 *                                          DEVTOOL_StockYFlujo, fuera de jurisdiccion".
 *   - TABLERO!AF9:AF12 "Saldo actual"   -> ESTAN VACIAS. El bloque real se corrio a AF18:AF21
 *                                          (headers AF17 "Flujo" / AG17 "Capital") cuando se
 *                                          inserto "Tipo de Medios" arriba. Lo escribe
 *                                          DEVTOOL_StockYFlujo.js (SYF_SALDOS_TABLERO).
 *   - TABLERO!AG9:AG12 "Capital"        -> RIESGO REAL, no celdas vacias: esas filas son HOY el
 *                                          bloque "Tipo de Medios" (AG8 = "Monto"), que escribe
 *                                          DEVTOOL_StockYFlujo.js (SYF_TIPOS_TABLERO). Con
 *                                          literal:true, este modulo le aplicaba su reemplazo a
 *                                          una formula ajena y viva. El "Capital" de verdad esta
 *                                          en AG18:AG21.
 *   - TABLERO!N19 "Capitalizacion"      -> ESTA VACIA desde el rediseno L7:O19 del 2026-08-20. La
 *                                          escribe DEVTOOL_Capitalizacion.js en O19
 *                                          (CAP_BLOQUES.realidad.celda).
 *
 * Y tres mas por la decision de duenio unico sobre el bloque de agregacion por cuenta:
 *   - TABLERO!R10/U10/X10               -> duenio unico: DEVTOOL_TableroFaltanteProyectado.js, que
 *                                          las REESCRIBE empotrando la QUERY original de Franco.
 *                                          Este modulo les aplicaba _repararFormula buscando el
 *                                          patron viejo "AL9:AL"; hoy es un no-op (todas usan
 *                                          AL6:AL), pero el dia que ese patron reapareciera,
 *                                          correr "Formulerio" DESPUES de "Tablero Faltante"
 *                                          reescribia una celda que es territorio de TFP.
 *                                          DEVTOOL_StockYFlujo.js SI se queda con estas tres
 *                                          (SYF_ARRASTRE): hace cirugia de token -- reemplaza un
 *                                          patron y deja el resto intacto --, asi que respeta el
 *                                          envoltorio de TFP corra en el orden que corra.
 *   - TABLERO!AA10 "Agregado por categoria" -> duenio unico: DEVTOOL_BloqueCategorias.js, el unico
 *                                          con trabajo VIGENTE ahi (cambia el eje de agrupacion a
 *                                          la categoria de la cuenta, con su propio preflight por
 *                                          rotulo contra AA9 "Nombre").
 *
 * QUE QUEDA EN LA LISTA, y su overlap conocido: Inicio!C13/F13 las comparte con
 * DEVTOOL_StockYFlujo.js (SYF_ARRASTRE) y Inicio!C15/F15 con DEVTOOL_InicioPresupuesto.js. Las
 * tres transformaciones son de token y hoy conviven, pero NO estan resueltas por la decision de
 * duenio unico del 2026-08-21: quedan reportadas para que Franco decida, igual que se reporto en
 * su momento la colision de R10/U10/X10.
 */


/**
 * Los FORM_CELDAS que declaran rotuloCelda/rotuloEsperado se verifican por ROTULO antes de que
 * el modulo toque nada: es la defensa contra exactamente el bug del 2026-08-21 (una fila se
 * inserta arriba, la celda declarada pasa a ser el header, y sin este chequeo el modulo la
 * hubiera visto "sin formula" y seguido de largo en silencio). Devuelve la lista de desvios; una
 * lista vacia significa que todos los rotulos vivos coinciden con lo declarado.
 */
function _verificarRotulosFormulerio(ss, nombreTablero) {
    const hoja = ss.getSheetByName(nombreTablero);
    const desvios = [];
    if (!hoja) return desvios;
    FORM_CELDAS.forEach(function (spec) {
        if (!spec.rotuloCelda) return;
        const vivo = String(hoja.getRange(spec.rotuloCelda).getValue() || '').trim();
        if (_normalizarRotulo(vivo) !== _normalizarRotulo(spec.rotuloEsperado)) {
            desvios.push(spec.hoja + '!' + spec.celda + ' (' + spec.nota + '): su rotulo ' +
                spec.rotuloCelda + ' dice "' + vivo + '" y se esperaba "' + spec.rotuloEsperado +
                '". La geometria se movio de nuevo: hay que remedir antes de tocar nada.');
        }
    });
    return desvios;
}

/** Geometria del motor de "Inicio": derrama desde la fila 8, con sus rotulos en la fila 7. */
const FORM_FILA_DERRAME_INICIO = 8;
const FORM_FILA_HEADER_INICIO = 7;

/**
 * SEXTO DEFECTO (hallado el 2026-08-19, despues de reparar los cuatro primeros): las dos
 * columnas "Valor en X" de "Inicio" NO CONVIERTEN MONEDA. Leen la moneda de la columna
 * equivocada -- la de Cuenta -- asi que ninguna de las cuatro ramas del IF se cumple nunca,
 * `tasa_origen` cae al literal 1, y toda la columna es un passthrough del monto crudo.
 *
 * Consecuencia medida: cada movimiento en moneda extranjera entra a C13, F13, C15 y F15 A
 * VALOR NOMINAL. Un cobro de 200 USD se cuenta como 200 pesos. En junio de 2026 eso son
 * ~$376.740 de ingreso desaparecido, el 23% del mes.
 *
 * "Inicio"!AT8 (mes anterior) tiene ademas un segundo error, mas raro: toma la moneda de
 * DESTINO de `Y13`, que no es un selector sino UNA CELDA DE DATOS del derrame del mes actual
 * -- la moneda del sexto movimiento del mes. Hoy no se nota porque ese movimiento es en ARS;
 * el dia que sea en USD, la conversion del mes anterior entera cambia sin que nadie toque nada.
 * El rotulo AT7 arrastra la misma referencia.
 *
 * `colMal` y `colBien` NO se dan por sabidas: el preflight lee los rotulos de la fila 7 y exige
 * que `colMal` diga "Cuenta" (probando que hoy lee lo que no debe) y `colBien` diga "Moneda"
 * (probando que el destino es el correcto). Si no, se saltea con aviso y no se toca nada.
 */
const FORM_MONEDA_INICIO = [
    {
        celda: 'AF8', nota: 'Valor convertido del mes actual',
        colMal: 'V', colBien: 'Y', destinoMal: null, destinoBien: null
    },
    {
        celda: 'AT8', nota: 'Valor convertido del mes anterior',
        colMal: 'AJ', colBien: 'AM', destinoMal: 'Y13', destinoBien: '$G$4'
    },
    {
        celda: 'AT7', nota: 'Rotulo "Valor en X" del mes anterior',
        colMal: null, colBien: null, destinoMal: 'Y13', destinoBien: '$G$4'
    }
];

/**
 * Bloque "Disponibilidad de fondos": las tres filas rotadas.
 * `rotulo` es lo que DEBE decir la etiqueta de la fila; el preflight lo verifica antes de
 * mover nada. Sin ese chequeo el modulo estaria adivinando a que fila corresponde cada
 * formula, que es exactamente el error que vino a reparar.
 */
const FORM_BLOQUE_ROTADO = {
    hoja: 'TABLERO',
    filas: [
        { fila: 23, rotuloCol: 'L', rotulo: 'Gastos Fijos', variante: 'fijos' },
        { fila: 24, rotuloCol: 'L', rotulo: 'Gastos Variables', variante: 'variables' },
        { fila: 25, rotuloCol: 'L', rotulo: 'Capacidad de Capitalizacion', variante: 'capitalizacion' }
    ],
    colCumplimiento: 'N',
    colDistribucion: 'O'
};

// ============================================
// PUBLICAS
// ============================================

/**
 * Solo lectura. Mide el formulerio y reporta que cambiaria, celda por celda. No escribe nada.
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function estadoFormulerioV0111() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightFormulerio(ss);
        const plan = _planFormulerio(ss, pre);

        const lineas = [];
        lineas.push('FORMULERIO v0.11 - ESTADO (no se escribio ninguna celda)');
        lineas.push('');
        lineas.push('Preflight:');
        lineas.push('  - Motor del Tablero: ' + pre.motorResumen);
        lineas.push('  - Selector de moneda ' + FORM_SELECTOR_MONEDA_TABLERO + ': "' + pre.monedaSeleccionada + '"');
        lineas.push('  - Catalogo de tipos: ' + pre.tiposResumen);
        lineas.push('  - Rotulos del bloque rotado: ' + pre.rotulosResumen);
        lineas.push('');

        if (!plan.cambios.length && !plan.rotacion) {
            lineas.push('NADA QUE HACER: las ' + FORM_CELDAS.length + ' celdas del formulerio ya estan');
            lineas.push('reparadas y el bloque de Disponibilidad de fondos ya esta en su orden correcto.');
            const yaHecho = lineas.join('\n');
            _mostrarFormulerio('Formulerio v0.11 - estado', yaHecho);
            return { ok: true, detalle: yaHecho };
        }

        lineas.push('CAMBIOS PENDIENTES: ' + plan.cambios.length + ' celda(s)' +
            (plan.rotacion ? ' + la rotacion del bloque Disponibilidad de fondos' : ''));
        lineas.push('');
        plan.cambios.forEach(function (c) {
            lineas.push('  ' + c.hoja + '!' + c.celda + '  (' + c.nota + ')');
            lineas.push('      ' + c.resumen);
        });

        if (plan.rotacion) {
            lineas.push('');
            lineas.push('  Bloque rotado (' + FORM_BLOQUE_ROTADO.hoja + '):');
            plan.rotacion.movimientos.forEach(function (m) {
                lineas.push('      fila ' + m.filaDestino + ' ("' + m.rotulo + '") <- la formula que hoy vive en la fila ' + m.filaOrigen);
            });
        }

        if (plan.avisos.length) {
            lineas.push('');
            lineas.push('Avisos:');
            plan.avisos.forEach(function (a) { lineas.push('  - ' + a); });
        }

        lineas.push('');
        lineas.push('Para aplicarlo: tidetrack Dev > Formulerio v0.11 > 2. Aplicar.');

        const detalle = lineas.join('\n');
        _mostrarFormulerio('Formulerio v0.11 - estado', detalle);
        logInfo('estadoFormulerioV0111: ' + plan.cambios.length + ' celda(s) pendientes.');
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'No se pudo medir el formulerio: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarFormulerio('Formulerio v0.11 - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Repara el formulerio. Preflight que aborta sin tocar nada, respaldo congelado y VERIFICADO,
 * escritura, y relectura de cada celda escrita. Si la relectura no verifica, restaura todo lo
 * escrito en esta corrida y lanza: el modulo no afirma sobre lo que no verifico.
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function aplicarFormulerioV0111() {
    const escritas = [];
    let ss = null;
    let yaRevertido = false;
    let ui = null;
    try {
        ui = SpreadsheetApp.getUi();
    } catch (e) {
        return { ok: false, error: 'aplicarFormulerioV0111 necesita UI (correr desde el menu tidetrack Dev).' };
    }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightFormulerio(ss);
        const plan = _planFormulerio(ss, pre);

        if (!plan.cambios.length && !plan.rotacion) {
            const yaHecho = 'El formulerio ya estaba reparado: ninguna de las ' + FORM_CELDAS.length +
                ' celdas tiene anclas corridas, #REF! ni el literal "' + FORM_TIPO_VIEJO + '", y el bloque ' +
                'de Disponibilidad de fondos ya esta en su orden correcto. No se escribio nada.';
            _mostrarFormulerio('Formulerio v0.11', yaHecho);
            return { ok: true, detalle: yaHecho };
        }

        const confirmacion = ui.alert(
            'Reparar el formulerio v0.11',
            'Se van a reescribir ' + plan.cambios.length + ' formula(s) de "Inicio" y "Tablero"' +
            (plan.rotacion ? ', y se va a rotar el bloque "Disponibilidad de fondos" a su orden correcto' : '') +
            '.\n\nAntes de tocar nada se congela un respaldo de TODAS las formulas de las dos hojas ' +
            'y se verifica releyendolo.\n\nCorriste antes "1. Ver estado" para saber que va a cambiar?\n\n' +
            'Continuar?',
            ui.ButtonSet.YES_NO
        );
        if (confirmacion !== ui.Button.YES) {
            return { ok: false, error: 'Cancelado por el operador. No se escribio ninguna celda.' };
        }

        // --- RESPALDO ANTES DE MUTAR, Y VERIFICADO (cicatriz 4) ---
        const sello = _selloFormulerio();
        const respaldo = _respaldarFormulerio(ss, sello);

        // --- ESCRITURA ---
        const escribir = function (w) {
            const rango = ss.getSheetByName(w.nombreHoja).getRange(w.celda);
            // El valor PREVIO se lee antes de pisar la celda: sin el no se puede distinguir
            // "esta celda ya estaba en error" de "esta celda la rompi yo".
            const errorPrevio = _errorDeCelda(rango);
            rango.setFormula(w.formulaNueva);
            escritas.push({
                nombreHoja: w.nombreHoja, celda: w.celda,
                previa: w.formulaActual, nueva: w.formulaNueva,
                errorPrevio: errorPrevio
            });
        };

        plan.cambios.forEach(escribir);
        if (plan.rotacion) plan.rotacion.escrituras.forEach(escribir);

        SpreadsheetApp.flush();

        // --- RELECTURA: sin esto "aplicado" es una afirmacion sin evidencia (cicatriz 5) ---
        const fallas = _verificarEscrituraFormulerio(ss, escritas);
        if (fallas.length) {
            _revertirEscrituras(ss, escritas);
            yaRevertido = true;
            throw new Error('Las formulas se escribieron pero NO VERIFICAN al releerlas: ' +
                fallas.join('; ') + '. Se restauro cada celda a su formula previa. ' +
                'El respaldo quedo en "' + respaldo.nombre + '".');
        }

        _guardarPropiedadFormulerio(sello, respaldo.nombre);

        const detalle = 'FORMULERIO v0.11 REPARADO\n\n' +
            '- Celdas reescritas y verificadas: ' + escritas.length + '\n' +
            (plan.rotacion ? '- Bloque "Disponibilidad de fondos": rotado a su orden correcto (Gastos Fijos / Gastos Variables / Capacidad de Capitalizacion)\n' : '') +
            '- Respaldo congelado y verificado en la hoja oculta "' + respaldo.nombre + '" (' + respaldo.filas + ' formulas)\n' +
            (respaldo.acotados.length ? '- ATENCION, el respaldo se acoto: ' + respaldo.acotados.join('; ') + '\n' : '') + '\n' +
            'QUE MIRAR AHORA:\n' +
            '  1. "Tablero"!L29 debe decir "Traspasos balanceados" (o declarar el descuadre real).\n' +
            '  2. El bloque "Movimientos del Mes" (N16:N19) debe dejar de estar en $0,00.\n' +
            '  3. "Tablero"!O23:O25 debe dejar de estar en #REF!.\n' +
            '  4. "Inicio"!F8 (Capital Acumulado) debe BAJAR: hoy incluye el gasto cotidiano.\n\n' +
            'Si algo quedo peor que antes: tidetrack Dev > Formulerio v0.11 > 3. Revertir.';

        logSuccess('aplicarFormulerioV0111: ' + escritas.length + ' celda(s) reparadas y verificadas.');
        _mostrarFormulerio('Formulerio v0.11 - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        // Si la falla ocurrio DESPUES de empezar a escribir, se devuelve cada celda a su lugar:
        // una planilla a medio reparar es peor que una planilla rota de forma conocida.
        let restaurado = '';
        if (ss && escritas.length && !yaRevertido) {
            try {
                _revertirEscrituras(ss, escritas);
                restaurado = ' Se restauraron las ' + escritas.length + ' celda(s) ya escritas.';
            } catch (e2) {
                restaurado = ' ADEMAS fallo la restauracion de las ' + escritas.length +
                    ' celda(s) ya escritas (' + e2.message + '): revisar el respaldo a mano.';
            }
        }
        const msg = 'FORMULERIO NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack, escritas: escritas.length });
        _mostrarFormulerio('Formulerio v0.11 - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Restaura las formulas desde el respaldo de la ultima corrida aplicada.
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function revertirFormulerioV0111() {
    let ui = null;
    try {
        ui = SpreadsheetApp.getUi();
    } catch (e) {
        return { ok: false, error: 'revertirFormulerioV0111 necesita UI (correr desde el menu tidetrack Dev).' };
    }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const nombreRespaldo = props.getProperty(FORM_PROP_RESPALDO);

        if (!nombreRespaldo) {
            throw new Error('No hay ninguna corrida registrada, asi que no hay respaldo al que volver.');
        }
        const hojaRespaldo = ss.getSheetByName(nombreRespaldo);
        if (!hojaRespaldo) {
            throw new Error('La corrida registrada apunta al respaldo "' + nombreRespaldo +
                '" y esa hoja ya no existe en la planilla. No hay desde donde restaurar.');
        }

        const filas = _leerRespaldoFormulerio(hojaRespaldo);
        if (!filas.length) {
            throw new Error('El respaldo "' + nombreRespaldo + '" no tiene ninguna formula registrada.');
        }

        const confirmacion = ui.alert(
            'Revertir el formulerio',
            'Se van a restaurar ' + filas.length + ' formula(s) de "Inicio" y "Tablero" tal como estaban ' +
            'antes de la reparacion, desde el respaldo "' + nombreRespaldo + '".\n\n' +
            'Eso devuelve la planilla al estado con #REF!, anclas corridas y el literal "' + FORM_TIPO_VIEJO + '".\n\n' +
            'Continuar?',
            ui.ButtonSet.YES_NO
        );
        if (confirmacion !== ui.Button.YES) {
            return { ok: false, error: 'Cancelado por el operador. No se restauro nada.' };
        }

        let restauradas = 0;
        const noRestauradas = [];
        filas.forEach(function (f) {
            const hoja = ss.getSheetByName(f.nombreHoja);
            if (!hoja) { noRestauradas.push(f.nombreHoja + '!' + f.celda + ' (la hoja no existe)'); return; }
            hoja.getRange(f.celda).setFormula(f.formula);
            restauradas++;
        });
        SpreadsheetApp.flush();

        props.deleteProperty(FORM_PROP_APLICADO);

        const detalle = 'FORMULERIO REVERTIDO\n\n' +
            '- Formulas restauradas: ' + restauradas + ' de ' + filas.length + '\n' +
            (noRestauradas.length ? '- NO restauradas: ' + noRestauradas.join(', ') + '\n' : '') +
            '- Respaldo usado: "' + nombreRespaldo + '" (se conserva)\n\n' +
            'La planilla volvio al estado previo a la reparacion, con sus cuatro defectos.';

        logSuccess('revertirFormulerioV0111: ' + restauradas + ' formula(s) restauradas.');
        _mostrarFormulerio('Formulerio v0.11 - revertido', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarFormulerio('Formulerio v0.11 - ERROR', msg);
        return { ok: false, error: msg };
    }
}

// ============================================
// PREFLIGHT
// ============================================

/**
 * Verifica que la planilla sea la que este modulo cree que es, ANTES de que nadie escriba.
 * Aborta lanzando ante la minima discrepancia: preferimos no hacer nada a hacerlo sobre una
 * geometria que no entendemos.
 *
 * @throws {Error} si el motor, el catalogo, el selector o los rotulos no son los esperados
 */
function _preflightFormulerio(ss) {
    const nombreInicio = NAV_CONFIG.SHEETS.INICIO;
    const nombreTablero = NAV_CONFIG.SHEETS.TABLERO;

    const hojaInicio = ss.getSheetByName(nombreInicio);
    const hojaTablero = ss.getSheetByName(nombreTablero);
    if (!hojaInicio) throw new Error('No existe la hoja "' + nombreInicio + '".');
    if (!hojaTablero) throw new Error('No existe la hoja "' + nombreTablero + '".');

    // --- 1. El motor del Tablero esta donde creemos, y derrama las columnas que creemos ---
    const formulaMotor = hojaTablero.getRange(FORM_CELDA_MOTOR_TABLERO).getFormula();
    if (!formulaMotor) {
        throw new Error('"' + nombreTablero + '"!' + FORM_CELDA_MOTOR_TABLERO + ' no tiene formula. ' +
            'Ese QUERY es el motor entero de la hoja: sin el no hay nada que re-apuntar. ' +
            'Si el motor se movio, este modulo esta desactualizado y no debe correr.');
    }
    if (formulaMotor.indexOf(RANGES.REGISTROS.sheet) === -1) {
        throw new Error('El motor "' + nombreTablero + '"!' + FORM_CELDA_MOTOR_TABLERO +
            ' no consulta la hoja "' + RANGES.REGISTROS.sheet + '". Geometria inesperada: no se toca nada.');
    }

    // Los rotulos del motor se derivan de RANGES.REGISTROS.columns (regla SSOT), no se hardcodean.
    const anclas = _anclasMotorTablero();
    const idxAJ = columnLetterToIndex(FORM_COL_MOTOR_TABLERO);
    const rotulosEsperados = [];
    const colsLedger = Object.keys(RANGES.REGISTROS.columns);
    colsLedger.forEach(function (clave) {
        const letraLedger = RANGES.REGISTROS.columns[clave];
        const offset = columnLetterToIndex(letraLedger) - columnLetterToIndex(RANGES.REGISTROS.start);
        rotulosEsperados.push({
            clave: clave,
            colTablero: columnIndexToLetter(idxAJ + offset)
        });
    });

    const headerLedger = _leerHeaderLedger(ss);
    const desalineados = [];
    rotulosEsperados.forEach(function (r) {
        const esperado = headerLedger[r.clave];
        if (!esperado) return;   // el ledger no rotula esa columna: no hay contra que comparar
        const vivo = hojaTablero.getRange(r.colTablero + FORM_FILA_HEADER_TABLERO).getValue();
        if (!_rotulosCompatibles(vivo, esperado)) {
            desalineados.push(r.colTablero + FORM_FILA_HEADER_TABLERO + ' dice "' + vivo +
                '" y el ledger llama a esa columna "' + esperado + '"');
        }
    });
    if (desalineados.length) {
        throw new Error('El bloque motor del Tablero no mapea 1:1 contra el ledger: ' +
            desalineados.join('; ') + '. Re-apuntar las anclas sobre este mapeo escribiria ' +
            'formulas que leen la columna equivocada. No se toca nada.');
    }

    // La fila de derrame se VERIFICA: si AJ6 esta vacia el QUERY no derramo (mes sin datos, o
    // el motor arranca en otra fila). Sin dato no se puede afirmar donde empieza el bloque.
    const derrameVivo = hojaTablero.getRange(FORM_COL_MOTOR_TABLERO + FORM_FILA_DERRAME_TABLERO).getValue();
    const derramePoblado = !(derrameVivo === '' || derrameVivo === null);

    // --- 2. El selector de moneda existe y tiene un valor conocido ---
    const celdaSelector = FORM_SELECTOR_MONEDA_TABLERO.replace(/\$/g, '');
    const monedaSeleccionada = String(hojaTablero.getRange(celdaSelector).getValue() || '').trim();
    if (MONEDAS_DISPONIBLES.indexOf(monedaSeleccionada) === -1) {
        throw new Error('El selector de moneda "' + nombreTablero + '"!' + celdaSelector + ' dice "' +
            monedaSeleccionada + '", que no es ninguna de las monedas del sistema (' +
            MONEDAS_DISPONIBLES.join(', ') + '). Reponer el #REF! apuntando ahi convertiria ' +
            'todos los montos por una tasa que no existe.');
    }

    // --- 3. El catalogo de tipos ya no tiene 'Liquidez' y 'Hogar' es su reemplazo 1:1 ---
    const tipos = _leerTiposCategoria(ss);
    if (tipos.conTipoViejo.length) {
        throw new Error('El Plan de Cuentas TODAVIA usa el tipo "' + FORM_TIPO_VIEJO + '" en ' +
            tipos.conTipoViejo.length + ' categoria(s): ' + tipos.conTipoViejo.join(', ') +
            '. Cambiar las formulas a "' + FORM_TIPO_NUEVO + '" las dejaria ciegas a esas categorias. ' +
            'Primero hay que unificar el catalogo.');
    }
    if (tipos.conTipoNuevo.length === 0) {
        throw new Error('Ninguna categoria del Plan de Cuentas tiene tipo "' + FORM_TIPO_NUEVO + '". ' +
            'Las formulas reparadas no encontrarian nada y el gasto cotidiano quedaria clasificado ' +
            'como capital, que es justo el defecto que se viene a arreglar.');
    }

    // --- 4. Los rotulos del bloque rotado dicen lo que este modulo cree ---
    const rotulosBloque = [];
    const malRotulados = [];
    FORM_BLOQUE_ROTADO.filas.forEach(function (f) {
        const vivo = String(hojaTablero.getRange(f.rotuloCol + f.fila).getValue() || '').trim();
        rotulosBloque.push(f.fila + '="' + vivo + '"');
        if (_normalizarRotulo(vivo) !== _normalizarRotulo(f.rotulo)) {
            malRotulados.push('la fila ' + f.fila + ' dice "' + vivo + '" y se esperaba "' + f.rotulo + '"');
        }
    });
    if (malRotulados.length) {
        throw new Error('Los rotulos del bloque "Disponibilidad de fondos" no son los esperados: ' +
            malRotulados.join('; ') + '. La rotacion se decide POR EL ROTULO: si el rotulo cambio, ' +
            'mover las formulas seria repetir el error original con otro orden.');
    }

    // --- 5. Las celdas de FORM_CELDAS que declaran rotuloCelda siguen apuntando a lo que dicen ---
    const desviosRotulo = _verificarRotulosFormulerio(ss, nombreTablero);
    if (desviosRotulo.length) {
        throw new Error('La geometria del Tablero volvio a moverse: ' + desviosRotulo.join(' | ') +
            '. No se toco nada.');
    }

    return {
        nombreInicio: nombreInicio,
        nombreTablero: nombreTablero,
        anclas: anclas,
        monedaSeleccionada: monedaSeleccionada,
        derramePoblado: derramePoblado,
        motorResumen: FORM_CELDA_MOTOR_TABLERO + ' consulta "' + RANGES.REGISTROS.sheet + '" y derrama ' +
            colsLedger.length + ' columnas desde la fila ' + FORM_FILA_DERRAME_TABLERO +
            (derramePoblado ? '' : ' (HOY SIN DATOS: el mes seleccionado no tiene movimientos)'),
        tiposResumen: tipos.conTipoNuevo.length + ' categoria(s) de tipo "' + FORM_TIPO_NUEVO + '" (' +
            tipos.conTipoNuevo.join(', ') + '), cero de tipo "' + FORM_TIPO_VIEJO + '"',
        rotulosResumen: rotulosBloque.join(', ')
    };
}

/**
 * Las columnas del Tablero que espejan al ledger y que las formulas consumen como rangos
 * abiertos ("AK9:AK"). Se derivan de RANGES.REGISTROS.columns, no se hardcodean.
 *
 * La columna del monto (AJ) queda AFUERA a proposito: es la unica que ya esta bien anclada
 * ("AJ6:AJ"), porque es la celda que lleva la formula del motor.
 */
function _anclasMotorTablero() {
    const idxAJ = columnLetterToIndex(FORM_COL_MOTOR_TABLERO);
    const idxInicioLedger = columnLetterToIndex(RANGES.REGISTROS.start);
    const cols = [];
    Object.keys(RANGES.REGISTROS.columns).forEach(function (clave) {
        const offset = columnLetterToIndex(RANGES.REGISTROS.columns[clave]) - idxInicioLedger;
        if (offset === 0) return;   // el monto: ya anclado en la fila del motor
        cols.push(columnIndexToLetter(idxAJ + offset));
    });
    return cols;
}

/** Lee los rotulos del header del ledger, indexados por clave logica de RANGES. */
function _leerHeaderLedger(ss) {
    const cfg = RANGES.REGISTROS;
    const hoja = ss.getSheetByName(cfg.sheet);
    const salida = {};
    if (!hoja) return salida;
    const idxInicio = columnLetterToIndex(cfg.start);
    Object.keys(cfg.columns).forEach(function (clave) {
        const idx = columnLetterToIndex(cfg.columns[clave]);
        if (idx > hoja.getMaxColumns()) return;
        salida[clave] = String(hoja.getRange(cfg.headerRow, idx).getValue() || '').trim();
    });
    return salida;
}

/** Lee el bloque de categorias del Plan de Cuentas y clasifica por tipo. */
function _leerTiposCategoria(ss) {
    const cfg = RANGES.PROYECTOS;
    const hoja = ss.getSheetByName(cfg.sheet);
    const salida = { conTipoViejo: [], conTipoNuevo: [], otros: [] };
    if (!hoja) {
        throw new Error('No existe la hoja "' + cfg.sheet + '": sin catalogo no se puede verificar ' +
            'que "' + FORM_TIPO_NUEVO + '" haya reemplazado a "' + FORM_TIPO_VIEJO + '".');
    }
    const colIni = columnLetterToIndex(cfg.start);
    const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    const filaDatos = getDataRow(cfg);   // PROYECTOS no declara dataRow propio: default global
    const alto = hoja.getMaxRows() - filaDatos + 1;
    if (alto <= 0) return salida;

    const datos = hoja.getRange(filaDatos, colIni, alto, nCols).getValues();
    datos.forEach(function (f) {
        const nombre = String(f[0] || '').trim();
        const tipo = String(f[1] || '').trim();
        if (!nombre && !tipo) return;
        if (_normalizarRotulo(tipo) === _normalizarRotulo(FORM_TIPO_VIEJO)) salida.conTipoViejo.push(nombre || '(sin nombre)');
        else if (_normalizarRotulo(tipo) === _normalizarRotulo(FORM_TIPO_NUEVO)) { if (nombre) salida.conTipoNuevo.push(nombre); }
        else if (tipo) salida.otros.push(tipo);
    });
    return salida;
}

// ============================================
// PLAN (que cambiaria, sin escribir)
// ============================================

/**
 * Construye el plan de reparacion leyendo las formulas vivas. No escribe nada.
 * @returns {{cambios: Array, rotacion: (Object|null), avisos: Array<string>}}
 */
function _planFormulerio(ss, pre) {
    const cambios = [];
    const avisos = [];

    FORM_CELDAS.forEach(function (spec) {
        const nombreHoja = spec.hoja === 'INICIO' ? pre.nombreInicio : pre.nombreTablero;
        const hoja = ss.getSheetByName(nombreHoja);
        const actual = hoja.getRange(spec.celda).getFormula();

        if (!actual) {
            const vivo = String(hoja.getRange(spec.celda).getValue() || '').trim();
            avisos.push(nombreHoja + '!' + spec.celda + ' (' + spec.nota + ') no tiene formula' +
                (vivo ? ' -- hoy tiene "' + vivo + '"' : ' -- esta vacia') + ': se saltea. ' +
                'Si esa celda deberia tener una, el formulerio no esta completo o la geometria se movio de nuevo.');
            return;
        }

        const nueva = _repararFormula(actual, spec, pre);
        if (nueva === actual) return;

        cambios.push({
            hoja: spec.hoja,
            nombreHoja: nombreHoja,
            celda: spec.celda,
            nota: spec.nota,
            formulaActual: actual,
            formulaNueva: nueva,
            resumen: _resumirCambio(actual, nueva, spec, pre)
        });
    });

    // --- Sexto defecto: la conversion de moneda de "Inicio" (aditivo, se saltea sin bloquear) ---
    const motivoSalteo = _motivoSaltearMonedaInicio(ss, pre);
    if (motivoSalteo) {
        avisos.push('NO se repara la conversion de moneda de "' + pre.nombreInicio + '" (' +
            motivoSalteo + '). El resto del formulerio SI se repara.');
    } else {
        const hojaInicio = ss.getSheetByName(pre.nombreInicio);
        FORM_MONEDA_INICIO.forEach(function (spec) {
            const actual = hojaInicio.getRange(spec.celda).getFormula();
            if (!actual) {
                avisos.push(pre.nombreInicio + '!' + spec.celda + ' (' + spec.nota + ') no tiene formula: se saltea.');
                return;
            }
            const nueva = _repararMonedaInicio(actual, spec);
            if (nueva === actual) return;
            cambios.push({
                hoja: 'INICIO', nombreHoja: pre.nombreInicio, celda: spec.celda, nota: spec.nota,
                formulaActual: actual, formulaNueva: nueva,
                resumen: (spec.colMal ? 'moneda leida de ' + spec.colMal + ' (Cuenta) -> ' + spec.colBien + ' (Moneda)' : '') +
                    (spec.colMal && spec.destinoMal ? ' | ' : '') +
                    (spec.destinoMal ? 'moneda destino ' + spec.destinoMal + ' (celda de datos) -> ' + spec.destinoBien + ' (el selector)' : '')
            });
        });
    }

    const rotacion = _planRotacion(ss, pre, avisos);
    return { cambios: cambios, rotacion: rotacion, avisos: avisos };
}

/**
 * Cirugia de tokens sobre una formula. NUNCA redacta: solo reemplaza direcciones dentro del
 * texto que salio de la propia celda, para que los literales de array {a\b} y los separadores
 * es_AR salgan exactamente como entraron (@see cabecera del modulo).
 */
function _repararFormula(formula, spec, pre) {
    // UNA CELDA SIN FORMULA NO ES UN ERROR, ES UN ESTADO. Pasa cada vez que la geometria de la
    // hoja se mueve y una direccion declarada en FORM_CELDAS queda apuntando a un rotulo o a una
    // celda vacia. Hasta el 2026-08-21 esto tiraba "Cannot read properties of undefined (reading
    // 'replace')" y volteaba la corrida entera: dos bancos (probar_stock_flujo, probar_riqueza)
    // quedaron sin poder correr, y el crash TAPO justamente la senal que importaba -- que cuatro
    // celdas del Tablero se habian corrido una fila. Un modulo cuyo trabajo es detectar formulas
    // desalineadas no puede morirse al encontrar la primera.
    if (typeof formula !== 'string' || !formula) return formula;
    let out = formula;

    // --- Defecto 1: anclas de la fila 9 a la fila del derrame ---
    if (spec.anclas) {
        pre.anclas.forEach(function (col) {
            // Solo rangos ABIERTOS de dos letras ("AK9:AK"). Deja intactas las referencias a
            // celdas sueltas de esas mismas filas -- AF9, AF10, $AF$17 -- que son otro bloque
            // de la hoja y hoy funcionan. Un reemplazo numerico 9->6 a ciegas las corromperia.
            const re = new RegExp('\\b' + col + '9:' + col + '\\b', 'g');
            out = out.replace(re, col + FORM_FILA_DERRAME_TABLERO + ':' + col);
        });
    }

    // --- Defecto 2: el selector de moneda y los reales de fijos/variables ---
    if (spec.refs) {
        out = _reponerReferencias(out);
    }

    // --- Defecto 4: el tipo de categoria huerfano ---
    if (spec.literal) {
        out = out.split(FORM_TIPO_VIEJO).join(FORM_TIPO_NUEVO);
    }

    return out;
}

/**
 * Repone las referencias que el rediseno dejo como #REF!.
 * Cada patron es especifico: se sabe QUE referencia iba en cada lugar por su contexto
 * sintactico, no por adivinanza. Lo que no matchea ningun patron queda como #REF! y el
 * verificador lo detecta y aborta.
 */
function _reponerReferencias(formula) {
    let out = formula;
    const sel = FORM_SELECTOR_MONEDA_TABLERO;

    // TODOS los reemplazos van por FUNCION, nunca por string de reemplazo. Es la leccion cara
    // del 2026-08-19: en String.replace, un string de reemplazo interpreta '$'. La linea
    //     out.replace(/(\$N\$10\s*-\s*)#REF!/g, '$1$N$17')
    // no produce "$N$10 - $N$17" sino "$N$10 - $N$N$10 - 7", porque '$1' es el grupo, '$N' es
    // literal y '$17' vuelve a ser el grupo 1 seguido de un 7. Escribio tres formulas que no
    // parsean en la planilla productiva de Franco, y el verificador no lo vio porque solo
    // comparaba TEXTO. Con funcion de reemplazo el valor devuelto se inserta tal cual y el
    // problema no puede existir. Toda formula de este proyecto lleva '$' por todos lados:
    // la regla es no volver a usar nunca un string de reemplazo aca.

    // SWITCH(#REF!; "ARS"; 1; ...) -> el selector de moneda de la hoja
    out = out.replace(/SWITCH\(\s*#REF!\s*;/g, function () { return 'SWITCH(' + sel + ';'; });
    // IF(#REF!="ARS"; ...) -> idem (AV6 lo usa cuatro veces)
    out = out.replace(/IF\(\s*#REF!\s*=/g, function () { return 'IF(' + sel + '='; });
    // MAX(0; $N$10 - #REF!) -> el REAL de gastos fijos (N17), contra el PRESUPUESTO (N10)
    out = out.replace(/(\$N\$10\s*-\s*)#REF!/g, function (m, g1) { return g1 + '$N$17'; });
    // MAX(0; $N$11 - #REF!) -> el REAL de gastos variables (N18), contra el presupuesto (N11)
    out = out.replace(/(\$N\$11\s*-\s*)#REF!/g, function (m, g1) { return g1 + '$N$18'; });
    // IFERROR(#REF! / N10; 0) -> cumplimiento de gastos fijos = real / presupuesto
    out = out.replace(/IFERROR\(\s*#REF!(\s*\/\s*N10)/g, function (m, g1) { return 'IFERROR(N17' + g1; });
    // IFERROR(#REF! / N11; 0) -> cumplimiento de gastos variables
    out = out.replace(/IFERROR\(\s*#REF!(\s*\/\s*N11)/g, function (m, g1) { return 'IFERROR(N18' + g1; });

    // --- REPARACION DE LA CORRIDA FALLIDA DEL 2026-08-19 ---
    // La v0.12.0 dejo "$N$10 - $N$N$10 - 7" y "$N$11 - $N$N$11 - 8" escritos en O23:O25 de la
    // planilla productiva: fallan al parsear y las tres celdas quedaron en #ERROR!. Como ya no
    // contienen #REF!, ningun otro patron de arriba las alcanza. Se reconocen por su forma
    // exacta -- es una cadena que nadie escribiria a mano -- y se las devuelve a lo que debieron
    // ser. Sin esto, re-correr "Aplicar" contesta "nada que hacer" con tres celdas rotas a la
    // vista, que es justo el modo de falla que este modulo dice combatir.
    out = out.replace(/(\$N\$10\s*-\s*)\$N\$N\$10\s*-\s*7/g, function (m, g1) { return g1 + '$N$17'; });
    out = out.replace(/(\$N\$11\s*-\s*)\$N\$N\$11\s*-\s*8/g, function (m, g1) { return g1 + '$N$18'; });

    return out;
}

/**
 * Repone la columna de moneda (y, en el bloque del mes anterior, la moneda de destino) en las
 * formulas "Valor en X" de "Inicio". Cirugia de tokens, igual que todo lo demas de este modulo.
 *
 * Los rangos se reconocen ABIERTOS y de columna completa ("V8:V"): el \b inicial impide que
 * "V8:V" matchee dentro de "AV8:AV", y el final impide que matchee "V8:V200".
 */
function _repararMonedaInicio(formula, spec) {
    let out = formula;
    if (spec.colMal && spec.colBien) {
        const re = new RegExp('\\b' + spec.colMal + FORM_FILA_DERRAME_INICIO + ':' + spec.colMal + '\\b', 'g');
        out = out.replace(re, function () {
            return spec.colBien + FORM_FILA_DERRAME_INICIO + ':' + spec.colBien;
        });
    }
    if (spec.destinoMal && spec.destinoBien) {
        const re2 = new RegExp('\\b' + spec.destinoMal.replace(/\$/g, '\\$') + '\\b', 'g');
        out = out.replace(re2, function () { return spec.destinoBien; });
    }
    return out;
}

/**
 * Verifica los rotulos que justifican la reparacion del sexto defecto. NO lanza: devuelve el
 * motivo por el que hay que saltearla, o '' si esta habilitada.
 *
 * Es deliberadamente NO BLOQUEANTE. Este arreglo es aditivo e independiente de los otros cinco;
 * si su geometria no verifica, lo correcto es saltearlo con un aviso a la vista, no impedir que
 * se reparen los defectos que si estan confirmados.
 */
function _motivoSaltearMonedaInicio(ss, pre) {
    const hoja = ss.getSheetByName(pre.nombreInicio);
    if (!hoja) return 'no existe la hoja "' + pre.nombreInicio + '"';

    const problemas = [];
    FORM_MONEDA_INICIO.forEach(function (spec) {
        if (!spec.colMal || !spec.colBien) return;
        const rotuloMal = hoja.getRange(spec.colMal + FORM_FILA_HEADER_INICIO).getValue();
        const rotuloBien = hoja.getRange(spec.colBien + FORM_FILA_HEADER_INICIO).getValue();
        if (_normalizarRotulo(rotuloMal) !== 'cuenta') {
            problemas.push(spec.colMal + FORM_FILA_HEADER_INICIO + ' dice "' + rotuloMal +
                '" y se esperaba "Cuenta" (es la columna que ' + spec.celda + ' lee por error)');
        }
        if (_normalizarRotulo(rotuloBien) !== 'moneda') {
            problemas.push(spec.colBien + FORM_FILA_HEADER_INICIO + ' dice "' + rotuloBien +
                '" y se esperaba "Moneda" (es la columna que ' + spec.celda + ' deberia leer)');
        }
    });

    const selector = String(hoja.getRange('G4').getValue() || '').trim();
    if (MONEDAS_DISPONIBLES.indexOf(selector) === -1) {
        problemas.push('el selector de moneda "' + pre.nombreInicio + '"!G4 dice "' + selector +
            '", que no es ninguna moneda del sistema');
    }

    return problemas.length ? problemas.join('; ') : '';
}

/**
 * Decide la rotacion del bloque "Disponibilidad de fondos".
 * NO reescribe las formulas: las CLASIFICA por su contenido, comprueba que las tres variantes
 * esten presentes exactamente una vez, y las manda a la fila que le corresponde a cada una
 * segun el rotulo (que el preflight ya verifico).
 */
function _planRotacion(ss, pre, avisos) {
    const hoja = ss.getSheetByName(pre.nombreTablero);
    const colN = FORM_BLOQUE_ROTADO.colCumplimiento;
    const colO = FORM_BLOQUE_ROTADO.colDistribucion;

    const actuales = {};
    let faltantes = 0;
    FORM_BLOQUE_ROTADO.filas.forEach(function (f) {
        const fN = hoja.getRange(colN + f.fila).getFormula();
        const fO = hoja.getRange(colO + f.fila).getFormula();
        if (!fN || !fO) faltantes++;
        actuales[f.fila] = { cumplimiento: fN, distribucion: fO };
    });
    if (faltantes) {
        avisos.push('El bloque "Disponibilidad de fondos" tiene ' + faltantes +
            ' celda(s) sin formula: no se rota. Revisar a mano ' + colN + '23:' + colO + '25.');
        return null;
    }

    // Clasificar cada fila por lo que su formula CALCULA, no por donde esta.
    const porVariante = {};
    const sinClasificar = [];
    FORM_BLOQUE_ROTADO.filas.forEach(function (f) {
        const v = _clasificarFilaDisponibilidad(actuales[f.fila]);
        if (!v) { sinClasificar.push('fila ' + f.fila); return; }
        if (porVariante[v]) { sinClasificar.push('fila ' + f.fila + ' repite la variante "' + v + '"'); return; }
        porVariante[v] = f.fila;
    });

    if (sinClasificar.length) {
        avisos.push('No se pudo identificar que calcula cada fila del bloque "Disponibilidad de fondos" (' +
            sinClasificar.join('; ') + '): NO se rota nada. Un intercambio a ciegas seria peor que el defecto.');
        return null;
    }

    const movimientos = [];
    const escrituras = [];
    let hayCambio = false;

    FORM_BLOQUE_ROTADO.filas.forEach(function (f) {
        const filaOrigen = porVariante[f.variante];
        movimientos.push({ filaDestino: f.fila, filaOrigen: filaOrigen, rotulo: f.rotulo, variante: f.variante });
        if (filaOrigen !== f.fila) hayCambio = true;

        const origen = actuales[filaOrigen];
        [[colN, 'cumplimiento'], [colO, 'distribucion']].forEach(function (par) {
            const col = par[0];
            const nueva = _reponerReferencias(origen[par[1]]);
            const actual = actuales[f.fila][par[1]];
            if (nueva === actual) return;
            hayCambio = true;
            escrituras.push({
                nombreHoja: pre.nombreTablero,
                celda: col + f.fila,
                formulaActual: actual,
                formulaNueva: nueva
            });
        });
    });

    if (!hayCambio) return null;
    return { movimientos: movimientos, escrituras: escrituras };
}

/**
 * Identifica que calcula una fila del bloque "Disponibilidad de fondos" por su estructura.
 * Las tres se parecen muchisimo (comparten todo el preambulo LET); lo que las distingue es
 * la ultima expresion y, en la columna de cumplimiento, el denominador.
 */
function _clasificarFilaDisponibilidad(par) {
    const dist = par.distribucion || '';
    if (/base_ahorro\s*\+\s*excedente/.test(dist)) return 'capitalizacion';
    if (/MIN\(\s*rem_fijos/.test(dist)) return 'fijos';
    if (/MIN\(\s*rem_var/.test(dist)) return 'variables';

    // Fallback por el denominador del cumplimiento, si la distribucion no fuera reconocible.
    const cump = par.cumplimiento || '';
    if (/N9\s*-\s*N10\s*-\s*N11/.test(cump) || /\/\s*N12\b/.test(cump)) return 'capitalizacion';
    if (/\/\s*N10\b/.test(cump)) return 'fijos';
    if (/\/\s*N11\b/.test(cump)) return 'variables';
    return null;
}

/** Describe en una linea que cambia en una celda, para el informe de estado. */
function _resumirCambio(actual, nueva, spec, pre) {
    const partes = [];
    if (spec.anclas) {
        let n = 0;
        pre.anclas.forEach(function (col) {
            const re = new RegExp('\\b' + col + '9:' + col + '\\b', 'g');
            const m = actual.match(re);
            if (m) n += m.length;
        });
        if (n) partes.push(n + ' ancla(s) de la fila 9 -> fila ' + FORM_FILA_DERRAME_TABLERO);
    }
    if (spec.refs) {
        const antes = (actual.match(/#REF!/g) || []).length;
        const despues = (nueva.match(/#REF!/g) || []).length;
        if (antes) partes.push((antes - despues) + ' de ' + antes + ' #REF! repuestos a ' + FORM_SELECTOR_MONEDA_TABLERO + '/N17/N18');
    }
    if (spec.literal) {
        const n = (actual.split(FORM_TIPO_VIEJO).length - 1);
        if (n) partes.push(n + ' vez/veces "' + FORM_TIPO_VIEJO + '" -> "' + FORM_TIPO_NUEVO + '"');
    }
    return partes.length ? partes.join(' | ') : 'cambia el texto de la formula';
}

// ============================================
// RESPALDO Y VERIFICACION
// ============================================

/**
 * Congela en una hoja nueva TODAS las formulas de "Inicio" y "Tablero" -- no solo las que se
 * van a tocar -- y la RELEE para verificarla. Si la copia no coincide, LANZA antes de mutar.
 *
 * Las formulas se guardan como TEXTO con apostrofo inicial. setNumberFormat('@') NO alcanza:
 * ya nos paso (v0.9.8) que un respaldo "de texto" quedara vivo, recalculando, y por lo tanto
 * inservible como punto de retorno.
 */
function _respaldarFormulerio(ss, sello) {
    const nombre = _nombreHojaLibreFormulerio(ss, FORM_PREFIJO_RESPALDO + sello);
    const filas = [];
    const acotados = [];

    [NAV_CONFIG.SHEETS.INICIO, NAV_CONFIG.SHEETS.TABLERO].forEach(function (nombreHoja) {
        const hoja = ss.getSheetByName(nombreHoja);
        if (!hoja) return;
        // NUNCA sobre getMaxRows(): "Tablero" declara 50.500 filas y leer formulas sobre esa
        // superficie agota el limite de ejecucion ANTES de haber respaldado nada, que es el
        // peor momento posible para quedarse sin tiempo. Se barre el area con datos, y si
        // hasta eso fuera desmesurado se acota y se DECLARA en el informe (nunca en silencio).
        const ultFila = Math.max(1, hoja.getLastRow());
        const ultCol = Math.max(1, hoja.getLastColumn());
        let filasLeer = ultFila;
        if (ultFila * ultCol > FORM_TOPE_CELDAS_RESPALDO) {
            filasLeer = Math.max(FORM_MIN_FILAS_RESPALDO, Math.floor(FORM_TOPE_CELDAS_RESPALDO / ultCol));
            acotados.push(nombreHoja + ': se respaldaron las primeras ' + filasLeer + ' de ' + ultFila + ' filas');
        }
        const formulas = hoja.getRange(1, 1, filasLeer, ultCol).getFormulas();
        for (let r = 0; r < formulas.length; r++) {
            for (let c = 0; c < formulas[r].length; c++) {
                const f = formulas[r][c];
                if (!f) continue;
                filas.push([nombreHoja, columnIndexToLetter(c + 1) + (r + 1), "'" + f]);
            }
        }
    });

    if (!filas.length) {
        throw new Error('No se encontro ninguna formula en "' + NAV_CONFIG.SHEETS.INICIO + '" ni en "' +
            NAV_CONFIG.SHEETS.TABLERO + '". Sin nada que respaldar no hay punto de retorno, ' +
            'asi que tampoco se escribe.');
    }

    const destino = ss.insertSheet(nombre);
    invalidarCacheNombresHojas();
    destino.getRange(1, 1, 1, 3).setValues([['hoja', 'celda', 'formula']]);
    destino.getRange(2, 1, filas.length, 3).setValues(filas);
    SpreadsheetApp.flush();

    // --- VERIFICACION: se relee la copia (cicatriz 4) ---
    const leidas = _leerRespaldoFormulerio(destino);
    const fallas = [];
    if (leidas.length !== filas.length) {
        fallas.push('se escribieron ' + filas.length + ' formula(s) y al releer aparecen ' + leidas.length);
    } else {
        for (let i = 0; i < filas.length; i++) {
            const esperado = filas[i][2].substring(1);   // sin el apostrofo
            if (leidas[i].formula !== esperado || leidas[i].nombreHoja !== filas[i][0] || leidas[i].celda !== filas[i][1]) {
                fallas.push('la fila ' + (i + 2) + ' del respaldo (' + filas[i][0] + '!' + filas[i][1] +
                    ') no coincide con la formula viva');
                break;
            }
        }
    }
    // Que ninguna formula haya quedado VIVA en el respaldo: si Sheets la interpreto, el
    // respaldo es una hoja que recalcula, no una foto.
    const vivas = destino.getRange(2, 3, filas.length, 1).getFormulas();
    for (let i = 0; i < vivas.length; i++) {
        if (vivas[i][0]) {
            fallas.push('la fila ' + (i + 2) + ' quedo como formula VIVA en el respaldo, no como texto');
            break;
        }
    }

    if (fallas.length) {
        // Se deja VISIBLE: hay que poder mirarla para entender que paso.
        throw new Error('El respaldo quedo en "' + nombre + '" pero NO VERIFICA: ' + fallas.join('; ') +
            '. No se muto ninguna formula.');
    }

    destino.hideSheet();
    logInfo('_respaldarFormulerio: ' + filas.length + ' formulas congeladas y verificadas en "' + nombre + '".');
    return { nombre: nombre, filas: filas.length, acotados: acotados };
}

/** Lee un respaldo de formulerio y devuelve sus filas en orden. */
function _leerRespaldoFormulerio(hoja) {
    const alto = hoja.getLastRow() - 1;
    if (alto <= 0) return [];
    const datos = hoja.getRange(2, 1, alto, 3).getValues();
    const salida = [];
    datos.forEach(function (f) {
        const nombreHoja = String(f[0] || '').trim();
        const celda = String(f[1] || '').trim();
        const formula = String(f[2] || '');
        if (!nombreHoja || !celda || !formula) return;
        salida.push({ nombreHoja: nombreHoja, celda: celda, formula: formula });
    });
    return salida;
}

/**
 * Relee cada celda escrita y comprueba que la formula quedo Y QUE CALCULA.
 *
 * La comparacion del texto es NORMALIZADA por espacios: Sheets reacomoda saltos de linea y
 * sangrias al guardar, y una diferencia cosmetica no es una falla. Lo que si se exige
 * literalmente son las garantias semanticas del arreglo: cero #REF!, cero anclas en la fila 9,
 * cero literal viejo.
 *
 * Y SOBRE TODO: se lee el VALOR RESULTANTE de cada celda. La version anterior de este
 * verificador solo comparaba texto, y por eso dejo pasar tres formulas que no parseaban --
 * el texto habia ido y vuelto perfecto, pero la planilla mostraba #ERROR!. Comprobar que
 * escribiste lo que querias escribir NO es comprobar que funciona. Es la cicatriz 5 del arnes
 * cometida por el propio modulo que la cita.
 */
function _verificarEscrituraFormulerio(ss, escritas) {
    const fallas = [];
    const anclas = _anclasMotorTablero();

    escritas.forEach(function (w) {
        const leida = ss.getSheetByName(w.nombreHoja).getRange(w.celda).getFormula();
        const ref = w.nombreHoja + '!' + w.celda;

        if (!leida) {
            fallas.push(ref + ' quedo SIN formula');
            return;
        }
        if (_normalizarFormula(leida) !== _normalizarFormula(w.nueva)) {
            fallas.push(ref + ' no coincide con lo que se le escribio');
            return;
        }
        if (leida.indexOf('#REF!') !== -1) {
            fallas.push(ref + ' todavia tiene #REF! (hay un patron de referencia rota que este modulo no conoce)');
        }
        if (leida.indexOf(FORM_TIPO_VIEJO) !== -1) {
            fallas.push(ref + ' todavia menciona "' + FORM_TIPO_VIEJO + '"');
        }
        if (w.nombreHoja === NAV_CONFIG.SHEETS.TABLERO) {
            for (let i = 0; i < anclas.length; i++) {
                const re = new RegExp('\\b' + anclas[i] + '9:' + anclas[i] + '\\b');
                if (re.test(leida)) {
                    fallas.push(ref + ' todavia ancla ' + anclas[i] + '9 en vez de ' + anclas[i] + FORM_FILA_DERRAME_TABLERO);
                    break;
                }
            }
        }

        // --- LA PRUEBA QUE FALTABA: la celda tiene que CALCULAR, no solo decir lo correcto ---
        const errorAhora = _errorDeCelda(ss.getSheetByName(w.nombreHoja).getRange(w.celda));
        if (errorAhora) {
            fallas.push(ref + ' quedo en ' + errorAhora +
                (w.errorPrevio
                    ? ' (ya estaba en ' + w.errorPrevio + ' antes, y el objetivo del arreglo era sacarla de ahi)'
                    : ' (ANTES CALCULABA BIEN: la rompio esta corrida)'));
        }
    });

    return fallas;
}

/**
 * Devuelve el codigo de error que muestra una celda, o '' si calcula.
 *
 * Se lee el valor MOSTRADO y se compara contra la lista cerrada de errores de Sheets: no basta
 * con "empieza con #", porque una celda podria contener texto legitimo que arranque asi.
 */
function _errorDeCelda(rango) {
    let mostrado;
    try {
        mostrado = String(rango.getDisplayValue() || '').trim();
    } catch (e) {
        return '';   // no se pudo leer: no se inventa un error que no se comprobo
    }
    const ERRORES = ['#REF!', '#VALUE!', '#DIV/0!', '#N/A', '#NAME?', '#NUM!', '#NULL!', '#ERROR!'];
    for (let i = 0; i < ERRORES.length; i++) {
        if (mostrado.indexOf(ERRORES[i]) === 0) return ERRORES[i];
    }
    return '';
}

/** Devuelve cada celda escrita a su formula previa. Se usa cuando la verificacion falla. */
function _revertirEscrituras(ss, escritas) {
    escritas.forEach(function (w) {
        try {
            ss.getSheetByName(w.nombreHoja).getRange(w.celda).setFormula(w.previa);
        } catch (e) {
            logError('No se pudo restaurar ' + w.nombreHoja + '!' + w.celda + ': ' + e.message);
        }
    });
    SpreadsheetApp.flush();
}

// ============================================
// AUXILIARES
// ============================================

function _normalizarFormula(f) {
    return String(f || '').replace(/\s+/g, ' ').trim();
}

/**
 * Decide si dos rotulos nombran la misma columna. NO exige igualdad: el ledger rotula sus
 * cotizaciones congeladas "Valor ARS" y el espejo del Tablero las rotula "Ars". Son la misma
 * columna y una comparacion estricta abortaria la reparacion por una diferencia de estilo.
 * Lo que si detecta -- que es para lo que existe -- es un corrimiento real de columnas:
 * "cuenta" no esta contenido en "tipo".
 */
function _rotulosCompatibles(vivo, esperado) {
    const a = _normalizarRotulo(vivo);
    const b = _normalizarRotulo(esperado);
    if (!a || !b) return false;
    return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}

/** Compara rotulos sin que un acento o una mayuscula decidan si se escribe en la planilla. */
function _normalizarRotulo(v) {
    return String(v === null || v === undefined ? '' : v)
        .trim()
        .toLowerCase()
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/\s+/g, ' ');
}

function _selloFormulerio() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
}

function _nombreHojaLibreFormulerio(ss, base) {
    let nombre = base;
    let n = 2;
    while (ss.getSheetByName(nombre)) {
        nombre = base + ' (' + n + ')';
        n++;
    }
    return nombre;
}

function _guardarPropiedadFormulerio(sello, nombreRespaldo) {
    const props = PropertiesService.getDocumentProperties();
    props.setProperty(FORM_PROP_APLICADO, sello);
    props.setProperty(FORM_PROP_RESPALDO, nombreRespaldo);
}

function _mostrarFormulerio(titulo, mensaje) {
    try {
        SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
        Logger.log(titulo + '\n' + mensaje);
    }
}
