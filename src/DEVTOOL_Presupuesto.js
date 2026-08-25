/**
 * ============================================================================
 * NO LISTO -- FUERA DE SERVICIO DESDE EL 2026-08-13. NO EJECUTAR.
 * ============================================================================
 *
 * Este modulo NO esta en el menu (decision Franco 2026-08-13, ver MENU_CONFIG en 00_Config.js).
 * Sus funciones publicas siguen existiendo en el proyecto, asi que se pueden invocar a mano desde
 * el editor de Apps Script: NO HACERLO. Ejecutarlo hoy puede danar la planilla productiva.
 *
 * BLOQUEANTES ABIERTOS (tres rondas adversariales, ninguna cerrada):
 *   1. El motor puede declarar exito sobre una hoja en ceros. La ventana de doce meses y los
 *      controles de integridad todavia no cubren el caso de meses vacios o con una sola fila:
 *      se llego a devolver ok:true con 33,33 ARS de ingreso promedio y 0,00 en los tres montos
 *      sugeridos. "Exito" y "hay evidencia" no son lo mismo, y el modulo todavia los confunde.
 *   2. La maquina de estados (estado -> aplicar -> revertir, con respaldo y reversion de una hoja
 *      que el propio modulo crea) es la fuente de la mayoria de los defectos encontrados: cada
 *      ronda de revision encontro otro de la misma familia.
 *   3. Sin (1) resuelto, el cableado que lo consume (DEVTOOL_CableadoPresupuesto.js, tambien
 *      fuera de servicio) escribiria formulas del Tablero apuntando a celdas sin dato valido.
 *
 * POR QUE SE CONSERVA EL ARCHIVO: el contrato de calculo que documenta -- los cuatro agregados,
 * la exclusion de las cuentas neutras, la whitelist de proyectos de ahorro, la regla del ancla --
 * es trabajo cerrado con Franco y es de donde arranca la sesion dedicada. Se borra codigo, no
 * conocimiento.
 *
 * PARA VOLVER A HABILITARLO: cerrar los tres bloqueantes, reponer el submenu "Presupuesto -
 * construir la hoja" en MENU_CONFIG.DEV_ITEMS y la entrada de navegacion en MENU_CONFIG.ITEMS,
 * y recien ahi correr "1. Ver estado".
 *
 * ============================================================================
 *
 * DEVTOOL_Presupuesto.js
 * Construye y mantiene la hoja "Presupuesto": el motor del habito financiero.
 *
 * [CONCEPTO DE NEGOCIO]
 * Palabras de Franco: "El presupuesto es esa herramienta que mide tu comportamiento
 * financiero historico y te ayuda a pensar en tu proximo mes financiero, armando un
 * presupuesto que divide tus ingresos entre Gastos Fijos, Gastos Variables y Ahorro."
 * De ahi salen las dos mitades de la hoja, en este orden de importancia:
 *   (a) MEDIR. Doce meses cerrados, una fila por mes, con los cuatro agregados en ARS y
 *       el peso de cada macro grupo sobre los ingresos de ese mes. Es la evidencia.
 *   (b) DECIDIR. Tres montos presupuestados para el proximo mes, escritos por Franco,
 *       con el promedio historico al lado como sugerencia.
 * El Presupuesto no es un motor nuevo: el motor de reparto ya existe y funciona
 * (Tablero!Q20:U24, la "Disponibilidad de Fondos"). Lo que faltaba era la FUENTE de las
 * proporciones -- hoy Tablero!S13:S15 son tres numeros tipeados a mano, sin mes, sin
 * moneda y sin historia. Esta hoja es esa fuente.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Contrato de calculo cerrado por Franco el 2026-08-13 (NO se re-discute). Todo importe
 * se expresa en ARS: cada fila del ledger se convierte con el TC congelado de su propia
 * fila (monto x TC de SU moneda; 1 para ARS), de modo que el pasado no se recotiza.
 * Los cuatro agregados mensuales:
 *   1. INGRESOS         Tipo = "Ingreso" Y Cuenta <> "Traspaso". La exclusion de Traspaso
 *                       es obligatoria: 533 de 543 filas de traspaso llevan Tipo de Cuenta
 *                       "Ingreso" y sin excluirlas los ingresos se inflan un 77 % (31,1 M
 *                       contra 17,5 M reales, medido). Se corrige SOLO al leer: no se
 *                       migran las 2.904 filas ni se toca procesarCargas.
 *   2. GASTOS FIJOS     Tipo de Cuenta = "Gasto Fijo".
 *   3. GASTOS VARIABLES Tipo de Cuenta = "Gasto Variable".
 *   4. AHORRO           suma FIRMADA (+Ingreso / -Egreso) de TODAS las filas cuyo Medio
 *                       pertenece a un Proyecto cuyo Tipo esta en la whitelist. Es la
 *                       variacion total de los vehiculos de ahorro: incluye los traspasos
 *                       que entran, los ingresos cobrados directo ahi y los gastos pagados
 *                       desde ahi. Whitelist EXPLICITA (nunca "todo lo que no sea X"):
 *                       Ahorro, Inversiones, Fondo de Emergencia, Objetivos Personales,
 *                       Viajes. Financiacion queda AFUERA (tarjeta y prestamo son deuda,
 *                       no riqueza) y Liquidez tambien (es la caja operativa).
 * Estos cuatro son la unica fuente de verdad del Presupuesto y del Tablero. Cuando dos
 * hojas calculan lo mismo con criterios distintos los numeros dejan de ser comparables:
 * ya paso (Inicio y Tablero excluyen Traspaso e Inicio Mes, Mirada Interanual no excluye
 * ninguno) y es exactamente lo que esta hoja viene a cerrar.
 *
 * LA VENTANA ES PARTE DEL CALCULO, no un detalle de presentacion. Los doce meses del historico
 * se cuentan hacia atras desde el ANCLA, y el ancla es el ultimo mes con al menos
 * PRE_MIN_FILAS_MES_ACTIVO movimientos -- no el mes de MAX(fecha). Los promedios de 3/6/12 son
 * los 3/6/12 meses CON DATOS mas recientes, no las 3/6/12 filas de arriba. Las dos reglas salen
 * del mismo bloqueante: con abril y mayo 2026 vacios y junio con una sola fila de 100 ARS, la
 * version anterior anclaba en junio, promediaba dos meses vacios como si fueran meses de cero
 * pesos, mostraba 33,33 ARS de ingreso promedio y 0,00 en los tres montos sugeridos -- y devolvia
 * ok:true, porque sus nueve controles de integridad auditaban el ledger y ninguno auditaba la
 * ventana. Ahora hay tres controles de ventana, aplicar los RELEE antes de declarar exito, y una
 * hoja sin evidencia devuelve ok:false diciendo que la hoja esta bien y lo que faltan son datos.
 *
 * Ciclo cerrado del arnes, en este orden:
 *   estadoPresupuesto()   -> que hay, que falta y que escribiria. NO ESCRIBE NADA.
 *   aplicarPresupuesto()  -> preflight que aborta sin tocar nada + respaldo verificado +
 *                            creacion/actualizacion de la hoja + verificacion de la ventana.
 *   revertirPresupuesto() -> congela un respaldo final (para no destruir lo que Franco
 *                            haya escrito) y da de baja la hoja.
 *
 * NINGUNA CORRIDA CORTADA DEJA LA HOJA SIN SALIDA. La firma (N2) se escribe ANTES de las
 * operaciones largas y el marcador de N3 distingue "en curso" de "completa": una hoja cortada es
 * una hoja nuestra a medio escribir, y aplicar la completa. Si el corte llega a ser tan temprano
 * que ni la firma alcanzo a escribirse, revertir la da de baja igual, autorizada por el propio
 * registro del devtool (hojaCreada + creadaEn sin completadaEn). Antes esas dos puertas estaban
 * cerradas al mismo tiempo y el mensaje de error de aplicar mandaba justo a la que no abria.
 *
 * QUIEN ES DUENO DE CADA CELDA -- la regla que hace idempotente a este devtool:
 *   - El DEVTOOL es dueno de rotulos, formulas, formatos y geometria. Cada corrida los
 *     reescribe; correrlo dos veces no duplica nada.
 *   - FRANCO es dueno de seis celdas y solo seis: mes, anio, ingreso esperado y los tres
 *     montos presupuestados. El devtool las escribe UNICAMENTE si estan vacias. Eso es
 *     dato del usuario, no del devtool, y una corrida jamas lo pisa.
 *
 * @see docs/permanente/ARNES_TIDETRACK.md (seccion 6: gobernanza)
 * @see docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md (seccion 14: el hueco del Presupuesto)
 * @see MIGRACION_v0.9.5_LayoutNuevo.js (modulo molde: mismo contrato, mismo criterio de respaldo)
 * @see 07_MiradaInteranual.js (trampa de locale en la construccion de formulas)
 * @see 00_Config.js (SHEETS / RANGES: unico origen de nombres de hoja y de columnas)
 *
 * @version 0.9.11
 * @since 0.9.11
 * @lastModified 2026-08-13
 */

// ============================================
// CONSTANTES
// ============================================

var PRE_VERSION = '0.9.11';

/** Clave del estado en DocumentProperties. Auditoria + puntero al respaldo, NO fuente de verdad. */
var PRE_PROP_ESTADO = 'PRESUPUESTO_ESTADO';

/** Prefijo de las claves que guardan cada celda humana respaldada verbatim. */
var PRE_PROP_CELDA_PREFIJO = 'PRESUPUESTO_CELDA::';

/** Prefijo de las hojas de respaldo (ocultas, fechadas). */
var PRE_RESPALDO_PREFIJO = 'RESP_PRESUPUESTO_';

/** Milisegundos de espera por el lock del documento. */
var PRE_LOCK_MS = 30000;

/**
 * Firma de propiedad de la hoja. Vive en una celda del area oculta, no solo en
 * DocumentProperties: las propiedades se pueden borrar y entonces el devtool no sabria si
 * la hoja "Presupuesto" es suya o la hizo una persona a mano. Sin firma, aplicar ABORTA.
 */
var PRE_FIRMA = 'TIDETRACK_PRESUPUESTO_MOTOR';

// decision Franco 2026-08-13: la firma (N2) se escribe ANTES de las operaciones largas y el
// MARCADOR DE ESCRITURA (N3) distingue "empezada" de "terminada". Antes la firma iba al final,
// como paso 5 de 9: si la corrida se cortaba en el medio -- realista, con ~30 setValues, diez
// ARRAYFORMULA que derraman sobre 4.800 filas y ~40 llamadas de formato contra el limite de 6
// minutos de Apps Script -- la hoja quedaba sin firma y el modulo se cerraba solo: aplicar se
// negaba ("existe una hoja sin firma, no la toco"), revertir se negaba ("no lleva la firma, no la
// borro") y el mensaje de error de aplicar mandaba justo a revertir. Sin salida por codigo.
// Con la firma primero, una hoja cortada es una hoja NUESTRA a medio escribir, y la salida es la
// obvia: volver a correr aplicar, que es idempotente y reescribe todo.
var PRE_MARCA_EN_CURSO = 'ESCRITURA EN CURSO';
var PRE_MARCA_COMPLETA = 'ESCRITURA COMPLETA';

// decision Franco 2026-08-13: la whitelist de Ahorro vive en el CODIGO (esta constante) y se
// PUBLICA en la hoja como una tabla visible (bloque "Como se calcula el Ahorro"). Dos motivos:
//   1. Es la regla de negocio mas importante y mas invisible del sistema -- "que cuenta como
//      ahorro" -- y hoy no esta escrita en ningun lado donde Franco la vea. Publicarla la
//      vuelve auditable de un vistazo.
//   2. Tecnico: con la tabla en la hoja, el motor resuelve la pertenencia con UN VLOOKUP en
//      vez de repetir cinco comparaciones sobre la misma cadena de lookups. Sin array
//      literales {...} (prohibidos por la trampa de locale) y sin MATCH/COUNTIF sobre arrays
//      calculados, que son los idiomas fragiles dentro de ARRAYFORMULA.
// El codigo sigue siendo el SSOT: cada corrida de aplicar reescribe la tabla, y estado avisa
// si alguien la edito a mano.
var PRE_WHITELIST_AHORRO = [
    'Ahorro',
    'Inversiones',
    'Fondo de Emergencia',
    'Objetivos Personales',
    'Viajes'
];

// Tipos de proyecto que estan AFUERA a proposito. No se usan para calcular (el calculo es por
// whitelist, nunca por negacion): existen para que el diagnostico distinga "afuera por decision"
// de "afuera porque nadie lo reconoce" -- un typo en un campo de texto libre. La variante sin
// tilde esta a proposito: el campo lo escribe el ABM con `payload.tipoProyecto || 'General'` y
// nada garantiza la acentuacion.
// Verificado en vivo el 2026-08-13 sobre 'Plan de Cuentas'!V4:W11 (8 proyectos, 7 tipos).
var PRE_TIPOS_EXCLUIDOS_CONOCIDOS = ['Liquidez', 'Financiación', 'Financiacion'];

/** Meses en el formato que usan Tablero!I4 e Inicio!P4: CAPITALIZADO. Fuente unica de la lista. */
var PRE_MESES_CAP = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// decision Franco 2026-08-13: un mes cuenta como MES CON ACTIVIDAD a partir de este numero de
// filas en el ledger. Es la constante que arregla el bloqueante que dejo la hoja en 33,33 ARS y
// tres ceros, y no es arbitraria:
//   - Medido sobre el ledger vivo: los meses reales tienen del orden de 100 movimientos (abril
//     106, mayo 110, junio 112 en el lote que se esta migrando). Un mes de 1 a 4 filas no es un
//     mes de comportamiento financiero: es un mes en el que no se llevo la planilla, o una fila
//     suelta -- una carga varada, un registro de prueba, una fecha tipeada con el anio de mas.
//   - El caso que rompio la hoja fue exactamente ese: junio 2026 con UNA fila de 100 ARS mientras
//     abril y mayo estaban vacios. El promedio de tres meses dio 33,33 y los tres sugeridos 0,00,
//     y los nueve controles de integridad de la version anterior no lo veian.
// Con 5, un mes real jamas queda afuera (el margen es de 20 a 1) y una fila suelta jamas define
// la ventana ni entra en un promedio. La constante gobierna las TRES decisiones que dependen de
// "hay datos": el ancla, que meses promedian y que reporta el control de integridad. Una sola
// definicion para las tres, porque si difieren la hoja cuenta dos historias distintas.
var PRE_MIN_FILAS_MES_ACTIVO = 5;

// Cuantos meses hacia atras se buscan candidatos para el ancla. Acota el trabajo del motor (24
// COUNTIF sobre la columna de meses, no una comparacion de la columna contra si misma, que sobre
// 4.800 filas es cuadratica) y acota tambien la mentira posible: si el ultimo mes con actividad
// quedo a mas de dos anios, el ancla sale VACIA y la hoja entera queda en blanco -- ruidoso -- en
// vez de mostrar doce meses de ceros con cara de datos.
var PRE_CANDIDATOS_ANCLA = 24;

// --- GEOMETRIA DE LA HOJA (unico lugar donde vive; nada se repite mas abajo) ---
//
// decision Franco 2026-08-13: el bloque de PRESUPUESTO va ARRIBA y el HISTORICO abajo, aunque
// el orden de importancia sea el inverso. El motivo es de contrato, no de estetica: las tres
// celdas que otra pieza va a cablear al Tablero tienen que ser las mas ESTABLES de la hoja, y
// el bloque historico es el unico que puede crecer (de 12 a 24 meses, un desglose por cuenta).
// Todo lo que crece va debajo de lo que otros leen. El costo -- "decidir antes de mirar" -- se
// paga con la columna "Sugerido", que trae el promedio historico hasta la fila de la decision:
// la evidencia va al lado del input en vez de obligar a scrollear.
var PRE_FILA_TITULO = 2;
var PRE_FILA_NOTA = 3;

var PRE_FILA_BLOQUE_PRESUPUESTO = 5;
var PRE_FILA_SEL_MES = 6;
var PRE_FILA_SEL_ANIO = 7;
var PRE_FILA_MES_CLAVE = 8;
var PRE_FILA_INGRESO_ESPERADO = 9;
var PRE_FILA_PRESUP_HEADER = 11;
var PRE_FILA_PRESUP_GF = 12;
var PRE_FILA_PRESUP_GV = 13;
var PRE_FILA_PRESUP_AHORRO = 14;
var PRE_FILA_PRESUP_TOTAL = 15;
var PRE_FILA_PRESUP_SIN_ASIGNAR = 16;

var PRE_FILA_BLOQUE_REFERENCIA = 18;
var PRE_FILA_REF_HEADER = 19;
var PRE_FILA_REF_INGRESOS = 20;   // + Gastos Fijos (21), Gastos Variables (22), Ahorro (23)
var PRE_FILA_REF_MESES = 24;      // cuantos meses REALES promedio cada ventana (el denominador)

var PRE_FILA_BLOQUE_HISTORICO = 26;
var PRE_FILA_ANCLA = 27;
var PRE_FILA_HIST_HEADER = 28;
var PRE_FILA_HIST_PRIMERA = 29;
var PRE_MESES_HISTORICO = 12;     // ultima fila del historico: 29 + 12 - 1 = 40

var PRE_FILA_BLOQUE_INTEGRIDAD = 42;
var PRE_FILA_INTEGRIDAD_PRIMERA = 43;   // doce controles: 43..54

var PRE_FILA_BLOQUE_WHITELIST = 56;
var PRE_FILA_WL_HEADER = 57;
var PRE_FILA_WL_PRIMERA = 58;           // cinco tipos: 58..62
var PRE_FILA_WL_NOTA = 64;              // 63 queda libre como respiro visual

/** Ultima fila de la zona de presentacion (lo que se respalda y se verifica). */
var PRE_FILA_ULTIMA_PRESENTACION = 64;

// Columnas de presentacion: B..L. La A queda de margen (mismo criterio que Registros y
// Tipos de cambio despues de la migracion: el contenido arranca en B).
var PRE_COL_ROTULO = 'B';
var PRE_COL_VALOR = 'C';
/** Ultima columna VISIBLE del historico (K = filas del mes, la evidencia del control). */
var PRE_COL_ULTIMA_VISIBLE = 'K';
/**
 * Columna de orden entre meses CON DATOS. Es bookkeeping del devtool, no producto: se escribe,
 * se respalda y se verifica como el resto de la presentacion, pero queda oculta.
 */
var PRE_COL_ORDEN = 'L';
/**
 * Hasta M: la zona que se respalda y se verifica llega a la escalera de candidatos (columna M,
 * declarada mas abajo). Es bookkeeping oculto, si -- pero de la escalera cuelga el ancla, y del
 * ancla cuelga el historico entero. Una celda de la escalera en error mueve la ventana sin que
 * nada se vea roto: tiene que entrar en la verificacion posterior como cualquier otra.
 */
var PRE_COL_ULTIMA_PRESENTACION = 'M';

/**
 * Escalera de candidatos al ancla, en la columna OCULTA M.
 *
 * decision Franco 2026-08-13: el ancla NO se resuelve con una sola formula de array (LET +
 * SEQUENCE + FILTER + COUNTIF con criterio vectorial). Se resuelve con 24 formulas escalares,
 * una por candidato, y el ancla es el MAX de las que sobrevivieron. Cuesta 24 celdas ocultas y
 * compra tres cosas:
 *   1. Ninguna funcion exotica en el camino critico. En ESTA planilla las formulas LET escritas
 *      por codigo ya fallaron una vez con un parse error (las 48 celdas de Mirada Interanual);
 *      el ancla es la celda de la que cuelga TODO el historico y no puede depender de eso.
 *   2. Trabajo acotado y explicito: 24 COUNTIF sobre la columna de meses. La version vectorial
 *      elegante -- COUNTIF(rango, rango) -- es cuadratica sobre 4.800 filas y recalcula con cada
 *      edicion del ledger.
 *   3. Auditabilidad: al desocultar la columna se ve exactamente que meses calificaron y cuales
 *      no, que es la pregunta que uno se hace cuando el historico muestra algo raro.
 */
var PRE_COL_ESCALERA = 'M';
var PRE_FILA_ESCALERA_HEADER = 5;
var PRE_FILA_ESCALERA_PRIMERA = 6;   // 24 candidatos: 6..29

/** Columna de la celda que publica el mes del ULTIMO registro del ledger (la base de la escalera). */
var PRE_COL_ANCLA_BASE = 'E';

/**
 * Motor (staging) por fila del ledger, en columnas OCULTAS N..W.
 *
 * decision Franco 2026-08-13: el historico NO se calcula con 48 SUMPRODUCT sobre el ledger.
 * Se calcula UNA sola vez por fila del ledger en estas diez columnas de ARRAYFORMULA, y las
 * 48 celdas del historico son SUMIFS sobre una columna ya resuelta. Con 2.904 filas y
 * creciendo, la diferencia es diez pasadas contra cuarenta y ocho -- y las cuarenta y ocho
 * incluirian una cadena de VLOOKUP por fila y por mes. Es el patron de staging que la propia
 * planilla ya usa (Tablero!AN4) y el ADR-006 (Hidden Engines): el motor procesa, la vista
 * consume.
 *
 * REGLA DURA DE ESTE BLOQUE, y la razon de que algunas expresiones se repitan: cada columna
 * deriva EXCLUSIVAMENTE de rangos abiertos sobre "Registros". Ninguna referencia a otra
 * columna del staging. Un ARRAYFORMULA que mezcla 'Registros'!$H$6:$H (largo = grid del
 * ledger) con $N$6:$N (largo = grid de esta hoja) muere con "Array arguments to * are of
 * different size" en cuanto los dos grids difieren en una fila -- y procesarCargas amplia el
 * grid del ledger sola, sin avisar. Repetir una subexpresion cuesta unos milisegundos; el
 * acoplamiento de largos cuesta la hoja entera cada vez que entra un lote de cargas.
 */
var PRE_STG = {
    MES: 'N',            // clave de mes: primer dia del mes de la fecha de la fila
    TC: 'O',             // TC congelado que le corresponde a la moneda de la fila
    MONTO_ARS: 'P',      // monto x TC = importe en ARS
    PROYECTO: 'Q',       // Medio -> Proyecto (Plan de Cuentas R:T)
    TIPO_PROYECTO: 'R',  // Proyecto -> Tipo (Plan de Cuentas V:W)
    ES_AHORRO: 'S',      // 1 si el tipo esta en la whitelist publicada, 0 si no
    INGRESOS: 'T',
    GASTOS_FIJOS: 'U',
    GASTOS_VARIABLES: 'V',
    AHORRO: 'W'
};
var PRE_FILA_STG_FIRMA = 2;     // N2 = firma, N3 = marcador de escritura (en curso / completa)
var PRE_FILA_STG_HEADER = 5;
var PRE_FILA_STG_DATOS = 6;     // alineada con RANGES.REGISTROS.dataRow: staging fila N <-> ledger fila N

/** Celda de sonda del separador de argumentos. Fuera de la presentacion y fuera del staging. */
var PRE_CELDA_SONDA = 'Y1';

/** Ultima columna que la hoja necesita (la de la sonda). */
var PRE_COL_ULTIMA = 'Y';

/**
 * Filas de margen del motor por encima del grid del ledger. El staging derrama tantas filas
 * como tenga el grid de "Registros"; si esta hoja es mas corta, el derrame muere con #REF!
 * (ruidoso, no silencioso). Este colchon deja entrar unas 500 filas nuevas al ledger antes de
 * que haga falta correr aplicar de nuevo, y el control de integridad publica el margen que queda.
 */
var PRE_COLCHON_MOTOR = 500;

/** Ventanas de promedio del bloque de referencia. */
var PRE_VENTANAS = [3, 6, 12];

/** Formatos de numero. Se declaran una vez y se aplican por rango. */
var PRE_FMT_MONEDA = '$#,##0.00';
var PRE_FMT_PORCENTAJE = '0.0%';
var PRE_FMT_MES = 'mmmm yyyy';
var PRE_FMT_ENTERO = '0';
var PRE_FMT_FECHA_ISO = 'yyyy-mm-dd';

/** Paleta sobria. La identidad visual es dominio de Marcos: aca solo se marca jerarquia. */
var PRE_COLOR_TITULO_BLOQUE = '#e8eaed';
var PRE_COLOR_HEADER_TABLA = '#f1f3f4';
var PRE_COLOR_CELDA_HUMANA = '#fff2cc';   // amarillo suave: "esto lo escribis vos"

/** Marcas de error que una celda de esta hoja NUNCA deberia mostrar (todas van guardadas). */
var PRE_MARCAS_ERROR = ['#REF!', '#ERROR!', '#N/A', '#VALUE!', '#NAME?', '#DIV/0!', '#NUM!', '#NULL!'];

/** Estados transitorios: Sheets todavia calcula. No son un resultado ni un error. */
var PRE_DISPLAY_TRANSITORIOS = ['Loading...', 'Loading…', 'Cargando...', 'Cargando…'];

/**
 * Rotulos esperados en el header del ledger (fila 5), por clave de RANGES.REGISTROS.columns.
 * GUARD ANTI-DRIFT: si la planilla se movio de nuevo, las formulas leerian columnas que ya no
 * son las que dicen ser y devolverian numeros bien formateados y falsos. Verificado en vivo el
 * 2026-08-13. Las cuatro columnas de TC se llaman "Valor XXX" pero guardan COTIZACIONES.
 */
var PRE_HEADERS_LEDGER = {
    monto: 'Monto', tipo: 'Tipo', cuenta: 'Cuenta', tipo_cuenta: 'Tipo de Cuenta',
    medio: 'Medio', moneda: 'Moneda', fecha: 'Fecha', nota: 'Nota',
    tc_ars: 'Valor ARS', tc_usd: 'Valor USD', tc_aud: 'Valor AUD', tc_eur: 'Valor EUR'
};

/** Rotulos esperados en el header del Plan de Cuentas (fila 3), por tabla y clave de columna. */
var PRE_HEADERS_PLAN_CUENTAS = [
    { tabla: 'MEDIOS_PAGO', clave: 'nombre', rotulo: 'Medio' },
    { tabla: 'MEDIOS_PAGO', clave: 'proyecto', rotulo: 'Proyecto' },
    { tabla: 'PROYECTOS', clave: 'nombre', rotulo: 'Proyecto' },
    { tabla: 'PROYECTOS', clave: 'tipo', rotulo: 'Tipo' }
];

// ============================================
// HELPERS DE INFRAESTRUCTURA
// ============================================

// decision Franco 2026-08-13: yaConLock en las tres publicas porque el lock de Apps Script NO es
// reentrante. Un orquestador que encadene estado -> aplicar se colgaria contra si mismo.
/**
 * Ejecuta fn bajo el lock del documento, salvo que el llamador ya lo tenga.
 *
 * @param {boolean} yaConLock true si el llamador ya esta dentro de la seccion critica
 * @param {Function} fn cuerpo a ejecutar; debe devolver el contrato {ok, detalle?, error?}
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function _conLockPRE(yaConLock, fn) {
    if (yaConLock === true) return fn();

    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(PRE_LOCK_MS)) {
        return {
            ok: false,
            error: 'No se pudo tomar el lock del documento en ' + (PRE_LOCK_MS / 1000) +
                   's. Hay otra ejecucion en curso: esperar a que termine y reintentar. ' +
                   'No se toco ninguna celda.'
        };
    }
    try {
        return fn();
    } finally {
        lock.releaseLock();
    }
}

/** Devuelve la UI si el contexto la tiene (menu), o null (ejecucion headless). */
function _uiPRE() {
    try {
        return SpreadsheetApp.getUi();
    } catch (e) {
        return null;
    }
}

/** Alerta best-effort: en contexto headless no rompe, solo loguea. */
function _alertaPRE(titulo, texto) {
    var ui = _uiPRE();
    if (!ui) return;
    var recorte = texto.length > 1500
        ? texto.substring(0, 1500) + '\n\n[...] Informe completo en los logs (Ver > Registros).'
        : texto;
    try {
        ui.alert(titulo, recorte, ui.ButtonSet.OK);
    } catch (e) {
        logInfo('_alertaPRE: sin UI disponible para "' + titulo + '"');
    }
}

/**
 * Muestra en pantalla el error de un resultado que no fue avisado por su propio camino.
 * Apps Script descarta el retorno de un item de menu: sin esto, un abort seria indistinguible
 * de "no paso nada".
 *
 * @param {string} titulo
 * @param {{ok: boolean, detalle?: string, error?: string, _avisado?: boolean}} r
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function _informarResultadoPRE(titulo, r) {
    if (!r) return r;
    if (r.ok === false && r.error && r._avisado !== true) _alertaPRE(titulo, r.error);
    delete r._avisado;
    return r;
}

/** Sello temporal 'yyyy-MM-dd_HHmm' en la zona horaria del script. */
function _selloPRE() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
}

// decision Franco 2026-08-13: un estado ILEGIBLE no se trata como "no hay estado". El puntero al
// respaldo vive ahi: darlo por vacio haria que la corrida siguiente congelara un respaldo nuevo
// -- posiblemente sobre una hoja ya escrita a medias -- y perdiera el punto de retorno real.
/**
 * Lee el estado guardado.
 * @returns {Object} estado; {} si no hay ninguno; {_corrupto:true, _crudo:string} si es ilegible
 */
function _leerEstadoPRE() {
    var crudo = null;
    try {
        crudo = PropertiesService.getDocumentProperties().getProperty(PRE_PROP_ESTADO);
        if (!crudo) return {};
        var obj = JSON.parse(crudo);
        if (!obj || typeof obj !== 'object') throw new Error('el estado guardado no es un objeto');
        return obj;
    } catch (e) {
        logError('_leerEstadoPRE: estado ILEGIBLE en DocumentProperties', e);
        return { _corrupto: true, _crudo: String(crudo).substring(0, 300) };
    }
}

/** Persiste el estado (merge sobre lo existente). Las claves internas (_*) no se persisten. */
function _guardarEstadoPRE(parcial) {
    var previo = _leerEstadoPRE();
    var estado = {};
    for (var k0 in previo) {
        if (Object.prototype.hasOwnProperty.call(previo, k0) && k0.charAt(0) !== '_') estado[k0] = previo[k0];
    }
    for (var k in parcial) {
        if (Object.prototype.hasOwnProperty.call(parcial, k)) estado[k] = parcial[k];
    }
    estado.version = PRE_VERSION;
    PropertiesService.getDocumentProperties().setProperty(PRE_PROP_ESTADO, JSON.stringify(estado));
    return estado;
}

/** Clave de propiedad para el contenido original de una celda humana. */
function _claveCeldaPRE(celda) {
    return PRE_PROP_CELDA_PREFIJO + celda;
}

// decision Franco 2026-08-13: helper propio en vez de reusar _textoLiteralV095 o _textoLiteralRV.
// El primero vive en un modulo que su propia cabecera declara TRANSITORIO; el segundo en un
// devtool distinto. Un ReferenceError en medio del respaldo es un ReferenceError justo antes de
// mutar: diez lineas duplicadas cuestan menos que ese acoplamiento.
/**
 * Devuelve el valor listo para escribirse como TEXTO LITERAL en una celda.
 *
 * Sheets parsea todo string que arranque con "=", "+", "-", "@" o "'". En un respaldo eso es
 * inaceptable: la formula respaldada quedaria VIVA. El apostrofo inicial es la marca de texto de
 * Sheets y NO forma parte del valor: getValue() devuelve el string sin el.
 *
 * @param {*} v
 * @returns {string}
 */
function _textoLiteralPRE(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return /^[=+\-@']/.test(s) ? "'" + s : s;
}

/** Devuelve un nombre de hoja libre, agregando sufijo si hace falta. */
function _nombreHojaLibrePRE(ss, base) {
    var nombre = base;
    var i = 2;
    while (ss.getSheetByName(nombre)) {
        nombre = base + '_' + i;
        i++;
        if (i > 50) throw new Error('No se pudo encontrar un nombre libre para el respaldo "' + base + '".');
    }
    return nombre;
}

/** true si el valor mostrado es una de las marcas de error de Sheets. */
function _esErrorPRE(display) {
    var s = String(display === null || display === undefined ? '' : display).trim();
    for (var i = 0; i < PRE_MARCAS_ERROR.length; i++) {
        if (s.indexOf(PRE_MARCAS_ERROR[i]) === 0) return true;
    }
    return false;
}

/** true si el valor mostrado es un estado transitorio de calculo. */
function _esTransitorioPRE(display) {
    var s = String(display === null || display === undefined ? '' : display).trim();
    for (var i = 0; i < PRE_DISPLAY_TRANSITORIOS.length; i++) {
        if (s === PRE_DISPLAY_TRANSITORIOS[i]) return true;
    }
    return false;
}

// ============================================
// HELPERS DE REFERENCIA A1
// ============================================

/** Envuelve un nombre de hoja en comillas simples (puede venir del resolver de alias, con espacios). */
function _hojaRefPRE(nombre) {
    return "'" + String(nombre).replace(/'/g, "''") + "'";
}

/**
 * Referencia A1 absoluta y ABIERTA de una columna del ledger: 'Registros'!$H$6:$H
 *
 * Abierta a proposito: un rango cerrado en una fila inventada queda corto en cuanto el ledger
 * crece, sin que nadie se entere. El abierto no puede exceder el grid por definicion.
 *
 * @param {string} clave clave de RANGES.REGISTROS.columns
 * @returns {string}
 */
function _refLedgerPRE(clave) {
    var cfg = RANGES.REGISTROS;
    var col = cfg.columns[clave];
    if (!col) {
        throw new Error('_refLedgerPRE: RANGES.REGISTROS.columns no declara "' + clave + '".');
    }
    var fila = cfg.dataRow;
    if (!fila) {
        throw new Error('_refLedgerPRE: RANGES.REGISTROS.dataRow no definido en 00_Config.js.');
    }
    return _hojaRefPRE(cfg.sheet) + '!$' + col + '$' + fila + ':$' + col;
}

/**
 * Referencia A1 absoluta y abierta de una tabla del Plan de Cuentas, lista para VLOOKUP.
 * Ejemplo: _refTablaPCPRE('MEDIOS_PAGO') -> 'Plan de Cuentas'!$R$4:$T
 *
 * @param {string} tabla clave de RANGES
 * @returns {string}
 */
function _refTablaPCPRE(tabla) {
    var cfg = RANGES[tabla];
    if (!cfg) throw new Error('_refTablaPCPRE: RANGES no declara la tabla "' + tabla + '".');
    var fila = getDataRow(cfg);
    return _hojaRefPRE(cfg.sheet) + '!$' + cfg.start + '$' + fila + ':$' + cfg.end;
}

/**
 * Indice 1-based de una columna DENTRO de una tabla, para el tercer argumento de VLOOKUP.
 * Se deriva de RANGES: si manana el Plan de Cuentas mueve una columna, el indice se mueve solo.
 *
 * @param {string} tabla clave de RANGES
 * @param {string} clave clave de columns
 * @returns {number}
 */
function _indiceEnTablaPRE(tabla, clave) {
    var cfg = RANGES[tabla];
    var col = cfg && cfg.columns ? cfg.columns[clave] : null;
    if (!col) throw new Error('_indiceEnTablaPRE: RANGES.' + tabla + '.columns no declara "' + clave + '".');
    return columnLetterToIndex(col) - columnLetterToIndex(cfg.start) + 1;
}

/** Referencia absoluta local a una celda de esta hoja: 'C', 9 -> $C$9 */
function _absPRE(col, fila) {
    return '$' + col + '$' + fila;
}

/** Rango A1 local: 'B', 28, 'J', 39 -> B28:J39 */
function _rangoPRE(col1, fila1, col2, fila2) {
    return col1 + fila1 + ':' + col2 + fila2;
}

/** Rango absoluto de una columna del staging desde su fila de datos: 'N' -> $N$6:$N */
function _colStagingPRE(col) {
    return '$' + col + '$' + PRE_FILA_STG_DATOS + ':$' + col;
}

/** Ultima fila del bloque historico. */
function _filaHistoricoUltimaPRE() {
    return PRE_FILA_HIST_PRIMERA + PRE_MESES_HISTORICO - 1;
}

/** Ultima fila de la tabla de whitelist publicada. */
function _filaWhitelistUltimaPRE() {
    return PRE_FILA_WL_PRIMERA + PRE_WHITELIST_AHORRO.length - 1;
}

/** Ultima fila de la escalera de candidatos al ancla. */
function _filaEscaleraUltimaPRE() {
    return PRE_FILA_ESCALERA_PRIMERA + PRE_CANDIDATOS_ANCLA - 1;
}

/** Rango absoluto de la escalera de candidatos: $M$6:$M$29 */
function _rangoEscaleraPRE() {
    return '$' + PRE_COL_ESCALERA + '$' + PRE_FILA_ESCALERA_PRIMERA +
           ':$' + PRE_COL_ESCALERA + '$' + _filaEscaleraUltimaPRE();
}

/** Rango absoluto de una columna del bloque historico: 'K' -> $K$29:$K$40 */
function _colHistoricoPRE(col) {
    return '$' + col + '$' + PRE_FILA_HIST_PRIMERA + ':$' + col + '$' + _filaHistoricoUltimaPRE();
}

/** Criterio de texto que define "mes con actividad" para COUNTIF/AVERAGEIFS: ">=5" */
function _criterioMesActivoPRE() {
    return '">=' + PRE_MIN_FILAS_MES_ACTIVO + '"';
}

/** Rango absoluto de la tabla de whitelist, tal como lo consume el VLOOKUP del motor. */
function _rangoWhitelistPRE() {
    return '$B$' + PRE_FILA_WL_PRIMERA + ':$C$' + _filaWhitelistUltimaPRE();
}

// ============================================
// CONSTRUCCION DE FORMULAS
// ============================================
//
// TRAMPA DE LOCALE (documentada en 07_MiradaInteranual.js, y la razon de que el separador sea
// un PARAMETRO y no una constante): la planilla esta en es_AR, donde el separador de argumentos
// es ";" y el decimal es ",". Si setFormula() no traduce, "=SUM(1,2)" no da error: da 1,2. Por
// eso aplicar() SONDEA el motor una vez con esa formula exacta antes de escribir nada
// (_detectarSeparadorPRE) y construye las 150 formulas con el separador que la planilla
// confirmo. Los array literales {...} estan PROHIBIDOS: no se traducen y rompen con "Error de
// analisis". Donde hizo falta una lista se uso SPLIT de un string (el selector de mes) o una
// tabla publicada en la hoja (la whitelist de Ahorro).
//
// Las comas que quedan DENTRO de comillas son datos, no separadores: no se tocan nunca.

/**
 * TC congelado que le corresponde a la moneda de cada fila. ARS entra como literal 1: esa
 * columna vale 1 en las 2.904 filas del ledger y leerla obligaria a barrer una columna entera
 * para multiplicar por uno.
 *
 * N() en cada rama: una fila con moneda declarada y cotizacion vacia daria "" y envenenaria la
 * multiplicacion con #VALUE!. Con N() aporta 0 y el control de integridad la cuenta.
 *
 * @param {string} s separador de argumentos
 * @returns {string}
 */
function _exprTcFilaPRE(s) {
    var mon = _refLedgerPRE('moneda');
    return 'IF(' + mon + '="USD"' + s + 'N(' + _refLedgerPRE('tc_usd') + ')' + s +
           'IF(' + mon + '="AUD"' + s + 'N(' + _refLedgerPRE('tc_aud') + ')' + s +
           'IF(' + mon + '="EUR"' + s + 'N(' + _refLedgerPRE('tc_eur') + ')' + s + '1)))';
}

/** Importe de la fila en ARS: monto x TC de su propia moneda. */
function _exprMontoArsPRE(s) {
    return 'N(' + _refLedgerPRE('monto') + ')*' + _exprTcFilaPRE(s);
}

/** Medio -> Proyecto (Plan de Cuentas R:T). "" si el medio no esta en el catalogo. */
function _exprProyectoPRE(s) {
    return 'IFERROR(VLOOKUP(TRIM(' + _refLedgerPRE('medio') + ')' + s +
           _refTablaPCPRE('MEDIOS_PAGO') + s + _indiceEnTablaPRE('MEDIOS_PAGO', 'proyecto') + s +
           'FALSE)' + s + '"")';
}

/** Proyecto -> Tipo de proyecto (Plan de Cuentas V:W). "" si no resuelve. */
function _exprTipoProyectoPRE(s) {
    return 'IFERROR(VLOOKUP(TRIM(' + _exprProyectoPRE(s) + ')' + s +
           _refTablaPCPRE('PROYECTOS') + s + _indiceEnTablaPRE('PROYECTOS', 'tipo') + s +
           'FALSE)' + s + '"")';
}

/**
 * 1 si el tipo de proyecto de la fila esta en la whitelist publicada, 0 si no.
 *
 * TRIM tolera espacios; VLOOKUP en Sheets es insensible a mayusculas, asi que "ahorro" y
 * "Ahorro" caen en la misma fila. Lo que NUNCA hace es aceptar por descarte: si el tipo no
 * figura en la tabla, devuelve 0. "Financiacion" queda afuera por no estar, no por una regla
 * negativa que manana meta la deuda adentro del ahorro.
 */
function _exprEsAhorroPRE(s) {
    return 'IFERROR(VLOOKUP(TRIM(' + _exprTipoProyectoPRE(s) + ')' + s + _rangoWhitelistPRE() + s +
           '2' + s + 'FALSE)' + s + '0)';
}

/**
 * Signo de la fila: +1 Ingreso, -1 Egreso, 0 cualquier otra cosa.
 * El 0 es deliberado: un Tipo que no es ninguno de los dos no se adivina, no suma, y el control
 * de integridad lo cuenta.
 */
function _exprSignoPRE() {
    var tipo = _refLedgerPRE('tipo');
    return '((' + tipo + '="Ingreso")-(' + tipo + '="Egreso"))';
}

/** Envuelve una expresion por fila en el ARRAYFORMULA del staging, con el guard de fila vacia. */
function _arrayStagingPRE(expr, s) {
    return '=ARRAYFORMULA(IF(' + _refLedgerPRE('fecha') + '=""' + s + '""' + s + expr + '))';
}

/**
 * Las diez formulas del motor, en orden de columna.
 *
 * @param {string} s separador de argumentos
 * @returns {Array<{col: string, titulo: string, formula: string, formato: ?string}>}
 */
function _formulasStagingPRE(s) {
    var fec = _refLedgerPRE('fecha');
    var montoArs = _exprMontoArsPRE(s);

    return [
        {
            col: PRE_STG.MES, titulo: 'mes', formato: PRE_FMT_FECHA_ISO,
            formula: _arrayStagingPRE('IFERROR(DATE(YEAR(' + fec + ')' + s + 'MONTH(' + fec + ')' + s + '1)' + s + '"")', s)
        },
        {
            col: PRE_STG.TC, titulo: 'tc de la fila', formato: null,
            formula: _arrayStagingPRE(_exprTcFilaPRE(s), s)
        },
        {
            col: PRE_STG.MONTO_ARS, titulo: 'monto ARS', formato: PRE_FMT_MONEDA,
            formula: _arrayStagingPRE(montoArs, s)
        },
        {
            col: PRE_STG.PROYECTO, titulo: 'proyecto del medio', formato: null,
            formula: _arrayStagingPRE(_exprProyectoPRE(s), s)
        },
        {
            col: PRE_STG.TIPO_PROYECTO, titulo: 'tipo de proyecto', formato: null,
            formula: _arrayStagingPRE(_exprTipoProyectoPRE(s), s)
        },
        {
            col: PRE_STG.ES_AHORRO, titulo: 'es ahorro', formato: PRE_FMT_ENTERO,
            formula: _arrayStagingPRE(_exprEsAhorroPRE(s), s)
        },
        {
            // AGREGADO 1 - INGRESOS: Tipo = "Ingreso" Y Cuenta <> "Traspaso".
            col: PRE_STG.INGRESOS, titulo: 'ingresos ARS', formato: PRE_FMT_MONEDA,
            formula: _arrayStagingPRE(
                '(' + _refLedgerPRE('tipo') + '="Ingreso")*(TRIM(' + _refLedgerPRE('cuenta') +
                ')<>"Traspaso")*' + montoArs, s)
        },
        {
            // AGREGADO 2 - GASTOS FIJOS: Tipo de Cuenta = "Gasto Fijo".
            col: PRE_STG.GASTOS_FIJOS, titulo: 'gastos fijos ARS', formato: PRE_FMT_MONEDA,
            formula: _arrayStagingPRE(
                '(TRIM(' + _refLedgerPRE('tipo_cuenta') + ')="Gasto Fijo")*' + montoArs, s)
        },
        {
            // AGREGADO 3 - GASTOS VARIABLES: Tipo de Cuenta = "Gasto Variable".
            col: PRE_STG.GASTOS_VARIABLES, titulo: 'gastos variables ARS', formato: PRE_FMT_MONEDA,
            formula: _arrayStagingPRE(
                '(TRIM(' + _refLedgerPRE('tipo_cuenta') + ')="Gasto Variable")*' + montoArs, s)
        },
        {
            // AGREGADO 4 - AHORRO: suma FIRMADA de todo lo que entra o sale de un vehiculo de
            // ahorro. Es variacion de riqueza, no un gasto: por eso el signo y por eso incluye
            // los traspasos, que son justamente el flujo de ahorro que hay que medir.
            col: PRE_STG.AHORRO, titulo: 'ahorro ARS (firmado)', formato: PRE_FMT_MONEDA,
            formula: _arrayStagingPRE(
                _exprSignoPRE() + '*' + _exprEsAhorroPRE(s) + '*' + montoArs, s)
        }
    ];
}

/** SUMIFS de una columna del motor contra la clave de mes de una fila del historico. */
function _sumifsMesPRE(colStaging, filaHistorico, s) {
    return 'SUMIFS(' + _colStagingPRE(colStaging) + s + _colStagingPRE(PRE_STG.MES) + s +
           '$' + PRE_COL_ROTULO + filaHistorico + ')';
}

/**
 * Matriz completa del bloque historico (12 filas x 11 columnas, B..L).
 * Fila 1 = mes mas reciente. El orden descendente es el del propio ledger y deja las tres
 * filas mas recientes -- la ventana de 3 meses -- pegadas al encabezado.
 *
 * decision Franco 2026-08-13: el historico sigue mostrando DOCE MESES CALENDARIO consecutivos,
 * huecos incluidos. Un mes vacio es informacion -- "aca no se cargo nada" -- y esconderlo seria
 * la misma clase de mentira que promediarlo como si fuera un mes de cero pesos. Lo que cambia es
 * que ahora cada fila declara CUANTAS FILAS del ledger la respaldan (columna K) y que lugar
 * ocupa entre los meses que si tienen datos (columna L, oculta). Con esas dos columnas los
 * promedios pueden saltear los huecos sin que la tabla mienta sobre que meses existieron.
 *
 * @param {string} s separador de argumentos
 * @returns {Array<Array<string>>}
 */
function _matrizHistoricoPRE(s) {
    var ancla = _absPRE(PRE_COL_VALOR, PRE_FILA_ANCLA);
    var f0 = PRE_FILA_HIST_PRIMERA;
    var crit = _criterioMesActivoPRE();
    var filas = [];

    for (var i = 0; i < PRE_MESES_HISTORICO; i++) {
        var f = f0 + i;
        var mes = '$' + PRE_COL_ROTULO + f;
        var ing = '$C' + f;
        var celFilas = '$' + PRE_COL_ULTIMA_VISIBLE + f;
        // Guard unico de toda la fila: sin clave de mes no se calcula nada.
        var vivo = function (expr) { return '=IF(' + mes + '=""' + s + '""' + s + expr + ')'; };
        // Un porcentaje sobre ingresos cero no es 0 %: es indefinido. Se deja en blanco.
        var pct = function (colValor) {
            return '=IF(N(' + ing + ')=0' + s + '""' + s + '$' + colValor + f + '/' + ing + ')';
        };

        filas.push([
            '=IFERROR(EDATE(' + ancla + s + (i === 0 ? '0' : '-' + i) + ')' + s + '"")',
            vivo(_sumifsMesPRE(PRE_STG.INGRESOS, f, s)),
            vivo(_sumifsMesPRE(PRE_STG.GASTOS_FIJOS, f, s)),
            pct('D'),
            vivo(_sumifsMesPRE(PRE_STG.GASTOS_VARIABLES, f, s)),
            pct('F'),
            vivo(_sumifsMesPRE(PRE_STG.AHORRO, f, s)),
            pct('H'),
            vivo('$C' + f + '-$D' + f + '-$F' + f),
            // K - cuantas filas del ledger cayeron en este mes. Es la EVIDENCIA de la que cuelgan
            // el control de integridad y la exclusion del promedio: un numero, a la vista, al lado
            // de los importes que produjo.
            vivo('COUNTIF(' + _colStagingPRE(PRE_STG.MES) + s + mes + ')'),
            // L - orden entre los meses CON DATOS, contando desde el mas reciente. Vacio si este
            // mes no llega al minimo. Es lo que le permite a la ventana de "3 meses" significar
            // "los 3 meses reales mas recientes" en vez de "las 3 filas de arriba, tengan o no
            // datos". Rango creciente desde la primera fila del historico hasta la propia.
            '=IF(N(' + celFilas + ')<' + PRE_MIN_FILAS_MES_ACTIVO + s + '""' + s +
            'COUNTIF($' + PRE_COL_ULTIMA_VISIBLE + '$' + f0 + ':' + celFilas + s + crit + '))'
        ]);
    }
    return filas;
}

/**
 * Matriz del bloque de referencia (4 filas x 7 columnas, B..H).
 *
 * decision Franco 2026-08-13: el "% promedio" es COCIENTE DE PROMEDIOS (total del macro grupo
 * sobre total de ingresos de la ventana), no promedio de porcentajes mensuales. El segundo le
 * da el mismo peso a un mes de ingresos altos que a uno flojo y distorsiona justamente lo que
 * se quiere decidir: que proporcion del ingreso se va a cada bolsillo.
 *
 * decision Franco 2026-08-13 (correccion del bloqueante): la ventana de N ya NO son las N filas
 * de arriba del historico, son LOS N MESES CON DATOS mas recientes. Antes cada ventana era un
 * AVERAGE de N celdas contiguas, asi que un mes sin movimientos entraba como CERO y arrastraba
 * el promedio hacia abajo. Eso no es "un mes en el que no gaste": es un mes en el que no se
 * cargo la planilla, y meterlo en un promedio es afirmar algo que el ledger nunca dijo. Fue
 * exactamente el bloqueante que dejo la hoja mostrando 33,33 ARS de ingreso promedio (una sola
 * fila de 100 ARS repartida entre tres meses, dos de ellos vacios) y los tres montos sugeridos
 * en 0,00, con nueve controles de integridad en cero y aplicar devolviendo ok:true.
 * Ahora la ventana se filtra por la columna L del historico (orden entre meses con datos), asi
 * que promedia siempre meses reales. Dos consecuencias buscadas:
 *   - Los cuatro macro grupos usan EL MISMO filtro, asi que el cociente de promedios sigue
 *     comparando el mismo conjunto de meses y el porcentaje sigue siendo interpretable.
 *   - El denominador deja de ser implicito: la fila "Meses promediados" publica cuantos meses
 *     REALES entraron en cada ventana, y el control de integridad avisa cuando no llegan a N.
 *     Un promedio de 3 meses calculado sobre 1 sigue siendo el mejor dato disponible, pero
 *     ahora lo dice.
 *
 * @param {string} s separador de argumentos
 * @returns {Array<Array<string>>}
 */
function _matrizReferenciaPRE(s) {
    var orden = _colHistoricoPRE(PRE_COL_ORDEN);
    // Columna del historico de la que sale cada macro grupo.
    var grupos = [
        { rotulo: 'Ingresos', col: 'C', esBase: true },
        { rotulo: 'Gastos Fijos', col: 'D', esBase: false },
        { rotulo: 'Gastos Variables', col: 'F', esBase: false },
        { rotulo: 'Ahorro', col: 'H', esBase: false }
    ];
    // Columnas de salida por ventana: promedio y porcentaje.
    var salida = [{ prom: 'C', pct: 'D' }, { prom: 'E', pct: 'F' }, { prom: 'G', pct: 'H' }];

    return grupos.map(function (g, idx) {
        var filaRef = PRE_FILA_REF_INGRESOS + idx;
        var fila = [g.rotulo];
        PRE_VENTANAS.forEach(function (n, j) {
            // AVERAGEIFS sobre los meses cuyo orden entre los meses CON DATOS esta entre 1 y n.
            // Cuando ningun mes califica devuelve #DIV/0! y el IFERROR lo deja en blanco: vacio
            // es "no hay evidencia", que es distinto de un cero.
            fila.push('=IFERROR(AVERAGEIFS(' + _colHistoricoPRE(g.col) + s + orden + s + '">=1"' +
                      s + orden + s + '"<=' + n + '")' + s + '""' + ')');
            if (g.esBase) {
                // El porcentaje de los ingresos sobre si mismos es 100 % por definicion: no
                // informa nada y ocupa el lugar donde el ojo busca un dato.
                fila.push('base');
            } else {
                var promGrupo = '$' + salida[j].prom + filaRef;
                var promIng = _absPRE(salida[j].prom, PRE_FILA_REF_INGRESOS);
                fila.push('=IF(N(' + promIng + ')=0' + s + '""' + s + promGrupo + '/' + promIng + ')');
            }
        });
        return fila;
    });
}

/**
 * Fila "Meses promediados" del bloque de referencia (1 fila x 7 columnas, B..H).
 *
 * Es el denominador, publicado. Sin esta fila, "Promedio 3 meses" es una afirmacion sin respaldo:
 * puede estar hecho sobre tres meses, sobre uno, o sobre ninguno, y la celda se ve igual en los
 * tres casos. Las columnas de porcentaje quedan vacias a proposito: aca no hay proporcion que
 * mostrar, y llenarlas con algo solo para que la fila "cierre" seria ruido.
 *
 * @param {string} s separador de argumentos
 * @returns {Array<*>}
 */
function _filaMesesPromediadosPRE(s) {
    var orden = _colHistoricoPRE(PRE_COL_ORDEN);
    var fila = ['Meses promediados (de ' + PRE_MESES_HISTORICO + ' de ventana)'];
    PRE_VENTANAS.forEach(function (n) {
        fila.push('=COUNTIFS(' + orden + s + '">=1"' + s + orden + s + '"<=' + n + '")');
        fila.push('');
    });
    return fila;
}

/**
 * Matriz del bloque de presupuesto (3 filas x 6 columnas, B..G), SIN la columna C: esa es de
 * Franco y se escribe por otro camino, solo si esta vacia.
 *
 * "Sugerido" = ingreso esperado x proporcion historica de 3 meses, no el importe promedio
 * pelado. Cuando el ingreso esperado es el promedio de 3 meses -- la semilla -- los dos numeros
 * coinciden; cuando Franco espera cobrar mas, la sugerencia escala con el ingreso, que es lo
 * que significa "dividir tus ingresos" en proporciones.
 *
 * @param {string} s separador de argumentos
 * @returns {Array<{fila: number, valores: Array<string>}>} valores para D..G
 */
function _matrizPresupuestoPRE(s) {
    var ingEsp = _absPRE(PRE_COL_VALOR, PRE_FILA_INGRESO_ESPERADO);
    var filas = [PRE_FILA_PRESUP_GF, PRE_FILA_PRESUP_GV, PRE_FILA_PRESUP_AHORRO];

    return filas.map(function (f, idx) {
        // Fila del bloque de referencia que le corresponde a este macro grupo (D = % 3 meses).
        var pctHist = '$D$' + (PRE_FILA_REF_INGRESOS + 1 + idx);
        var montoHumano = '$C' + f;
        // decision Franco 2026-08-13: mientras el monto no este escrito, su % y su desvio quedan
        // EN BLANCO, no en cero. Una celda vacia vale 0 en la aritmetica de Sheets, asi que sin
        // este guard la hoja mostraria "0,0 % del ingreso" antes de que Franco decida nada: un
        // cero que se lee como decision tomada. "Todavia no decidi" y "decidi cero" son estados
        // distintos, igual que "no hay datos" y "el dato es cero" en el resto del sistema.
        var siEstaEscrito = function (expr) {
            return '=IF(' + montoHumano + '=""' + s + '""' + s + 'IFERROR(' + expr + s + '""))';
        };
        return {
            fila: f,
            valores: [
                siEstaEscrito(montoHumano + '/' + ingEsp),
                '=IFERROR(' + ingEsp + '*' + pctHist + s + '"")',
                '=IFERROR(' + pctHist + s + '"")',
                siEstaEscrito(montoHumano + '-$E' + f)
            ]
        };
    });
}

/**
 * Los doce controles de integridad. Cada uno responde una pregunta con un numero, y salvo los
 * dos declarados como magnitud, ese numero deberia ser CERO.
 *
 * Los tres controles de VENTANA (ancla, meses sin actividad, meses que le faltan a la ventana de
 * 3) son la correccion del bloqueante que dejo la hoja mostrando 33,33 ARS y tres ceros. Los
 * nueve controles anteriores auditaban el LEDGER -- fechas ilegibles, monedas raras, medios sin
 * catalogar -- y ninguno auditaba la VENTANA, que es la otra mitad del calculo: con un ledger
 * impecable, doce meses vacios producen doce filas de ceros y los nueve controles dan cero, que
 * es su forma de decir "todo bien". Por eso aplicar podia devolver ok:true sobre una hoja en
 * ceros. Estos tres cierran ese agujero, y aplicar los RELEE antes de declarar exito.
 *
 * REGLA TECNICA que explica por que cada formula vive de un solo lado: SUMPRODUCT exige arrays
 * del mismo largo. Un rango abierto de "Registros" mide el grid del ledger y uno de esta hoja
 * mide el suyo: mezclarlos en un producto revienta. Por eso los controles que cruzan las dos
 * hojas usan funciones ESCALARES (COUNTA, COUNT, ROWS), que devuelven un numero y no un array.
 *
 * @param {string} s separador de argumentos
 * @returns {Array<{id: string, rotulo: string, formula: string}>}
 */
function _controlesIntegridadPRE(s) {
    var fec = _refLedgerPRE('fecha');
    var mon = _refLedgerPRE('moneda');
    var tipo = _refLedgerPRE('tipo');
    var tcta = _refLedgerPRE('tipo_cuenta');
    var mes = _colStagingPRE(PRE_STG.MES);
    var colFilas = _colHistoricoPRE(PRE_COL_ULTIMA_VISIBLE);
    var orden = _colHistoricoPRE(PRE_COL_ORDEN);
    var ancla = _absPRE(PRE_COL_VALOR, PRE_FILA_ANCLA);
    var ventana3 = PRE_VENTANAS[0];

    return [
        {
            id: 'filas_con_mes',
            rotulo: 'Filas del ledger con mes valido (las que suman) [magnitud]',
            formula: '=COUNT(' + mes + ')'
        },
        {
            id: 'fecha_ilegible',
            rotulo: 'Filas con fecha ilegible (no entran en ningun mes)',
            formula: '=COUNTA(' + fec + ')-COUNT(' + mes + ')'
        },
        {
            id: 'monto_sin_fecha',
            rotulo: 'Filas con monto pero sin fecha (no entran en ningun mes)',
            formula: '=SUMPRODUCT((' + fec + '="")*(' + _refLedgerPRE('monto') + '<>""))'
        },
        {
            id: 'moneda_desconocida',
            rotulo: 'Filas con moneda desconocida (se convierten como ARS)',
            formula: '=SUMPRODUCT((' + fec + '<>"")*(' + mon + '<>"ARS")*(' + mon + '<>"USD")*(' +
                     mon + '<>"AUD")*(' + mon + '<>"EUR"))'
        },
        {
            id: 'tipo_desconocido',
            rotulo: 'Filas con Tipo distinto de Ingreso/Egreso (no suman al Ahorro)',
            formula: '=SUMPRODUCT((' + fec + '<>"")*(' + tipo + '<>"Ingreso")*(' + tipo + '<>"Egreso"))'
        },
        {
            id: 'medio_sin_catalogo',
            rotulo: 'Filas cuyo Medio no figura en el Plan de Cuentas (nunca son Ahorro)',
            formula: '=SUMPRODUCT((' + mes + '<>"")*(' + _colStagingPRE(PRE_STG.PROYECTO) + '=""))'
        },
        {
            id: 'importe_cero',
            rotulo: 'Filas con importe ARS = 0 (monto vacio o cotizacion faltante)',
            formula: '=SUMPRODUCT((' + mes + '<>"")*(' + _colStagingPRE(PRE_STG.MONTO_ARS) + '=0))'
        },
        {
            // Un reintegro cargado como Ingreso sobre una cuenta de gasto SUMA al gasto en vez
            // de restarlo. El contrato manda sumar sin signo: se respeta y se cuenta aparte.
            id: 'reintegros',
            rotulo: 'Filas de gasto cargadas como Ingreso (reintegros: inflan el gasto)',
            formula: '=SUMPRODUCT((' + fec + '<>"")*(' + tipo + '="Ingreso")*((TRIM(' + tcta +
                     ')="Gasto Fijo")+(TRIM(' + tcta + ')="Gasto Variable")))'
        },
        {
            // CONTROL DE VENTANA 1. Sin ancla no hay historico: las doce filas quedan en blanco y
            // los promedios tambien. Es el estado mas facil de leer mal ("la hoja no anduvo")
            // cuando en realidad significa "el ledger no tiene ni un mes con actividad en los
            // ultimos dos anios".
            id: 'ancla_sin_resolver',
            rotulo: 'Ancla de la ventana SIN resolver (1 = ningun mes con actividad en la escalera)',
            formula: '=IF(ISNUMBER(' + ancla + ')' + s + '0' + s + '1)'
        },
        {
            // CONTROL DE VENTANA 2. ROWS menos los que califican, y no COUNTIF("<5"), a proposito:
            // un mes sin fila en el historico deja la celda de "Filas del mes" en "" (texto), que
            // COUNTIF con criterio numerico NO cuenta. Restar del total cuenta los huecos y los
            // meses flacos con la misma vara.
            id: 'meses_sin_actividad',
            rotulo: 'Meses de la ventana sin actividad suficiente (menos de ' +
                    PRE_MIN_FILAS_MES_ACTIVO + ' filas): huecos del ledger',
            formula: '=ROWS(' + colFilas + ')-COUNTIF(' + colFilas + s + _criterioMesActivoPRE() + ')'
        },
        {
            // CONTROL DE VENTANA 3. El que decide si los tres montos "Sugerido" significan algo:
            // salen del promedio de la ventana corta y del porcentaje historico de esa ventana.
            id: 'faltan_meses_ventana_corta',
            rotulo: 'Meses REALES que le faltan a la ventana de ' + ventana3 +
                    ' (si no es 0, los promedios y los sugeridos no representan comportamiento)',
            formula: '=' + ventana3 + '-COUNTIFS(' + orden + s + '">=1"' + s + orden + s +
                     '"<=' + ventana3 + '")'
        },
        {
            id: 'margen_motor',
            rotulo: 'Filas de margen del motor (si es negativo, correr Aplicar de nuevo) [magnitud]',
            formula: '=ROWS(' + mes + ')-ROWS(' + fec + ')'
        }
    ];
}

/**
 * Fila (1-based, en la hoja) del control de integridad con ese id.
 * Se deriva del orden de la lista: mover un control no desincroniza al lector.
 *
 * @param {string} id
 * @returns {?number} null si el id no existe
 */
function _filaControlPRE(id) {
    var lista = _controlesIntegridadPRE(',');
    for (var i = 0; i < lista.length; i++) {
        if (lista[i].id === id) return PRE_FILA_INTEGRIDAD_PRIMERA + i;
    }
    return null;
}

/** Formula de la clave de mes del presupuesto: el numero que va a leer el Tablero. */
function _formulaMesClavePRE(s) {
    var mesesMayus = PRE_MESES_CAP.map(function (m) { return m.toUpperCase(); }).join(',');
    // UPPER + TRIM: la planilla tiene HOY dos convenciones vivas para el mismo dato (Tablero e
    // Inicio capitalizan, Mirada Interanual y CALCU van en mayusculas) y un MATCH que no
    // encuentra devuelve #N/A y tumba la vista. Este acepta las dos, y de paso los espacios.
    return '=IFERROR(DATE(' + _absPRE(PRE_COL_VALOR, PRE_FILA_SEL_ANIO) + s +
           'MATCH(UPPER(TRIM(' + _absPRE(PRE_COL_VALOR, PRE_FILA_SEL_MES) + '))' + s +
           'SPLIT("' + mesesMayus + '"' + s + '","' + ')' + s + '0)' + s + '1)' + s + '"")';
}

/**
 * Formula de la BASE de la escalera: primer dia del mes del ULTIMO registro del ledger.
 *
 * decision Franco 2026-08-13: la ventana se ancla en el dato, no en TODAY() ni en el mes del
 * presupuesto. Anclarla en hoy mostraria meses vacios cuando el ledger va atrasado (paso: el
 * pipeline estuvo cortado cuatro meses y medio) y anclarla en el selector haria que la
 * evidencia se moviera cada vez que Franco toca el mes que esta planificando. El historico mide
 * comportamiento, y el comportamiento vive donde estan los datos.
 *
 * Lo que este numero YA NO ES es el ancla. MAX(fecha) responde "cual es la fecha mas grande",
 * que no es la misma pregunta que "hasta donde llegan los datos": una unica fila -- una carga
 * varada, una prueba, un anio tipeado de mas -- alcanza para llevarlo meses o anios adelante del
 * ultimo mes realmente cargado, y entonces la ventana entera cae del lado lejano del hueco. Es
 * literalmente lo que paso: junio 2026 tenia UNA fila de 100 ARS y abril y mayo estaban vacios.
 * Se publica igual, en su propia celda, porque es el diagnostico que explica por que el ancla
 * quedo donde quedo.
 */
function _formulaBaseLedgerPRE(s) {
    var fec = _refLedgerPRE('fecha');
    return '=IFERROR(DATE(YEAR(MAX(' + fec + '))' + s + 'MONTH(MAX(' + fec + '))' + s + '1)' + s + '"")';
}

/**
 * Las 24 formulas de la escalera de candidatos al ancla, de la mas reciente a la mas vieja.
 * Cada una devuelve su propio mes SI ese mes tiene al menos PRE_MIN_FILAS_MES_ACTIVO filas en el
 * ledger, y "" si no.
 *
 * @param {string} s separador de argumentos
 * @returns {Array<string>}
 */
function _formulasEscaleraPRE(s) {
    var base = _absPRE(PRE_COL_ANCLA_BASE, PRE_FILA_ANCLA);
    var mesStg = _colStagingPRE(PRE_STG.MES);
    var out = [];
    for (var i = 0; i < PRE_CANDIDATOS_ANCLA; i++) {
        var cand = 'EDATE(' + base + s + (i === 0 ? '0' : '-' + i) + ')';
        out.push('=IFERROR(IF(COUNTIF(' + mesStg + s + cand + ')>=' + PRE_MIN_FILAS_MES_ACTIVO + s +
                 cand + s + '"")' + s + '"")');
    }
    return out;
}

/**
 * Formula del ancla: el mes MAS RECIENTE de la escalera que califico como mes con actividad.
 *
 * COUNT y no COUNTA: cuenta solo numeros, y las fechas son numeros. Los candidatos que no
 * calificaron devolvieron "" (texto) y no suman. El guard de COUNT=0 no es decorativo: MAX sobre
 * una columna enteramente de texto devuelve 0, y un ancla de 0 es el 30/12/1899 -- doce filas de
 * un mes imposible, cada una con sus ceros bien formateados. Exactamente la clase de resultado
 * creible y falso que este bloqueante vino a eliminar. Sin candidatos, el ancla queda VACIA: el
 * historico entero se apaga y el control de integridad lo reporta.
 */
function _formulaAnclaPRE(s) {
    var esc = _rangoEscaleraPRE();
    return '=IF(COUNT(' + esc + ')=0' + s + '""' + s + 'MAX(' + esc + '))';
}

// ============================================
// ESPECIFICACION DE LA HOJA
// ============================================

/**
 * Celdas de Franco. Son las unicas seis que este devtool no pisa jamas: se escriben solo si
 * estan vacias. El resto de la hoja es del devtool y se reescribe en cada corrida.
 *
 * @param {string} s separador de argumentos
 * @returns {Array<{celda: string, rol: string, semilla: *, formato: string}>}
 */
function _celdasHumanasPRE(s) {
    var tz = Session.getScriptTimeZone();
    var hoy = new Date();
    var anio = Number(Utilities.formatDate(hoy, tz, 'yyyy'));
    var mes = Number(Utilities.formatDate(hoy, tz, 'MM'));   // 1..12
    // El presupuesto es del PROXIMO mes: es la definicion del producto, no un default arbitrario.
    mes += 1;
    if (mes > 12) { mes = 1; anio += 1; }

    return [
        {
            celda: PRE_COL_VALOR + PRE_FILA_SEL_MES, rol: 'mes del presupuesto',
            semilla: PRE_MESES_CAP[mes - 1], formato: null
        },
        {
            celda: PRE_COL_VALOR + PRE_FILA_SEL_ANIO, rol: 'anio del presupuesto',
            semilla: anio, formato: PRE_FMT_ENTERO
        },
        {
            // Semilla como FORMULA a proposito: si Franco no la toca, el ingreso esperado sigue
            // solo al promedio de los ultimos tres meses. Si escribe un numero, manda el numero.
            celda: PRE_COL_VALOR + PRE_FILA_INGRESO_ESPERADO, rol: 'ingreso esperado (ARS)',
            semilla: '=IFERROR(' + _absPRE(PRE_COL_VALOR, PRE_FILA_REF_INGRESOS) + s + '"")',
            formato: PRE_FMT_MONEDA
        },
        {
            celda: PRE_COL_VALOR + PRE_FILA_PRESUP_GF, rol: 'presupuesto de Gastos Fijos (ARS)',
            semilla: null, formato: PRE_FMT_MONEDA
        },
        {
            celda: PRE_COL_VALOR + PRE_FILA_PRESUP_GV, rol: 'presupuesto de Gastos Variables (ARS)',
            semilla: null, formato: PRE_FMT_MONEDA
        },
        {
            celda: PRE_COL_VALOR + PRE_FILA_PRESUP_AHORRO, rol: 'presupuesto de Ahorro (ARS)',
            semilla: null, formato: PRE_FMT_MONEDA
        }
    ];
}

/**
 * Rangos con nombre que expone la hoja. Existen para que la pieza que cablea el Tablero no
 * dependa de coordenadas: un nombre sobrevive a una fila insertada, "C12" no.
 *
 * @returns {Array<{nombre: string, celda: string, rol: string}>}
 */
function _rangosConNombrePRE() {
    return [
        { nombre: 'PRE_MES_CLAVE', celda: PRE_COL_VALOR + PRE_FILA_MES_CLAVE,
          rol: 'primer dia del mes presupuestado (fecha); con esto el Tablero decide si el presupuesto aplica a su mes' },
        { nombre: 'PRE_INGRESO_ESPERADO', celda: PRE_COL_VALOR + PRE_FILA_INGRESO_ESPERADO,
          rol: 'ingreso esperado en ARS -> Tablero!S13 (Presupuesto de Ingresos)' },
        { nombre: 'PRE_GASTOS_FIJOS', celda: PRE_COL_VALOR + PRE_FILA_PRESUP_GF,
          rol: 'presupuesto de Gastos Fijos en ARS -> Tablero!S14' },
        { nombre: 'PRE_GASTOS_VARIABLES', celda: PRE_COL_VALOR + PRE_FILA_PRESUP_GV,
          rol: 'presupuesto de Gastos Variables en ARS -> Tablero!S15' },
        { nombre: 'PRE_AHORRO', celda: PRE_COL_VALOR + PRE_FILA_PRESUP_AHORRO,
          rol: 'presupuesto de Ahorro en ARS (el Tablero lo deriva como S13-S14-S15: si no coinciden, hay ingreso sin asignar)' }
    ];
}

/**
 * Especificacion completa de lo que escribe el devtool: bloques rectangulares de valores y/o
 * formulas. Un string que arranca con "=" lo escribe Sheets como formula.
 *
 * Ningun bloque incluye una celda humana: las rectangulares saltean la columna C donde hace
 * falta. Esa separacion es lo que permite reescribir la hoja entera sin leer nada antes.
 *
 * @param {string} s separador de argumentos
 * @returns {Array<{rango: string, valores: Array<Array<*>>}>}
 */
function _bloquesPRE(s) {
    var B = PRE_COL_ROTULO;
    var ultimaHist = _filaHistoricoUltimaPRE();
    var controles = _controlesIntegridadPRE(s);
    var bloques = [];

    // --- Cabecera ---
    bloques.push({ rango: B + PRE_FILA_TITULO, valores: [['Presupuesto']] });
    bloques.push({
        rango: B + PRE_FILA_NOTA,
        valores: [['Todos los importes en ARS, convertidos con el tipo de cambio congelado de cada ' +
                   'registro. Fuente unica: la hoja ' + SHEETS.REGISTROS + '.']]
    });

    // --- Bloque A: presupuesto del mes ---
    bloques.push({ rango: B + PRE_FILA_BLOQUE_PRESUPUESTO, valores: [['PRESUPUESTO DEL MES']] });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_SEL_MES, B, PRE_FILA_INGRESO_ESPERADO),
        valores: [['Mes'], ['Anio'], ['Mes presupuestado'], ['Ingreso esperado (ARS)']]
    });
    bloques.push({ rango: PRE_COL_VALOR + PRE_FILA_MES_CLAVE, valores: [[_formulaMesClavePRE(s)]] });
    bloques.push({
        rango: _rangoPRE('D', PRE_FILA_SEL_MES, 'D', PRE_FILA_INGRESO_ESPERADO),
        valores: [
            ['como en Tablero!I4 e Inicio!P4: Enero..Diciembre'],
            ['numero de cuatro digitos'],
            ['derivado: es la celda que lee el Tablero'],
            ['si se deja la formula, sigue al promedio de 3 meses']
        ]
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_PRESUP_HEADER, 'G', PRE_FILA_PRESUP_HEADER),
        valores: [['Macro grupo', 'Presupuestado (ARS)', '% del ingreso esperado',
                   'Sugerido (ARS)', '% sugerido (3 meses)', 'Desvio vs sugerido']]
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_PRESUP_GF, B, PRE_FILA_PRESUP_AHORRO),
        valores: [['Gastos Fijos'], ['Gastos Variables'], ['Ahorro']]
    });
    bloques.push({
        rango: _rangoPRE('D', PRE_FILA_PRESUP_GF, 'G', PRE_FILA_PRESUP_AHORRO),
        valores: _matrizPresupuestoPRE(s).map(function (r) { return r.valores; })
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_PRESUP_TOTAL, 'D', PRE_FILA_PRESUP_SIN_ASIGNAR),
        valores: [
            ['Total asignado',
             '=IF(COUNT($C$' + PRE_FILA_PRESUP_GF + ':$C$' + PRE_FILA_PRESUP_AHORRO + ')=0' + s +
             '""' + s + 'SUM($C$' + PRE_FILA_PRESUP_GF + ':$C$' + PRE_FILA_PRESUP_AHORRO + '))',
             '=IFERROR($C' + PRE_FILA_PRESUP_TOTAL + '/' +
             _absPRE(PRE_COL_VALOR, PRE_FILA_INGRESO_ESPERADO) + s + '"")'],
            ['Sin asignar',
             '=IFERROR(' + _absPRE(PRE_COL_VALOR, PRE_FILA_INGRESO_ESPERADO) + '-$C' +
             PRE_FILA_PRESUP_TOTAL + s + '"")',
             '=IFERROR($C' + PRE_FILA_PRESUP_SIN_ASIGNAR + '/' +
             _absPRE(PRE_COL_VALOR, PRE_FILA_INGRESO_ESPERADO) + s + '"")']
        ]
    });

    // --- Bloque B: referencia ---
    bloques.push({
        rango: B + PRE_FILA_BLOQUE_REFERENCIA,
        valores: [['REFERENCIA - PROMEDIOS MENSUALES REALES (ARS)']]
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_REF_HEADER, 'H', PRE_FILA_REF_HEADER),
        valores: [['Macro grupo', 'Promedio 3 meses', '% s/ ingresos', 'Promedio 6 meses',
                   '% s/ ingresos', 'Promedio 12 meses', '% s/ ingresos']]
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_REF_INGRESOS, 'H', PRE_FILA_REF_INGRESOS + 3),
        valores: _matrizReferenciaPRE(s)
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_REF_MESES, 'H', PRE_FILA_REF_MESES),
        valores: [_filaMesesPromediadosPRE(s)]
    });

    // --- Bloque C: historico ---
    bloques.push({
        rango: B + PRE_FILA_BLOQUE_HISTORICO,
        valores: [['COMPORTAMIENTO HISTORICO - ULTIMOS ' + PRE_MESES_HISTORICO + ' MESES (ARS)']]
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_ANCLA, 'F', PRE_FILA_ANCLA),
        valores: [[
            'Ancla de la ventana', _formulaAnclaPRE(s),
            'Ultimo mes cargado', _formulaBaseLedgerPRE(s),
            'el ancla es el ultimo mes con al menos ' + PRE_MIN_FILAS_MES_ACTIVO + ' movimientos; ' +
            'si difiere del ultimo mes cargado, ese mes tiene una o dos filas sueltas y no alcanza ' +
            'para medir comportamiento'
        ]]
    });
    bloques.push({
        // Hasta L, no hasta M: la columna M es la escalera, que se escribe en su propio bloque y
        // ocupa filas que se cruzan con estas. Dos bloques que se pisan es una bomba de relojeria
        // que depende del orden del array.
        rango: _rangoPRE(B, PRE_FILA_HIST_HEADER, PRE_COL_ORDEN, PRE_FILA_HIST_HEADER),
        valores: [['Mes', 'Ingresos', 'Gastos Fijos', '%', 'Gastos Variables', '%',
                   'Ahorro', '%', 'Resultado (Ing - GF - GV)', 'Filas del mes',
                   'orden entre meses con datos']]
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_HIST_PRIMERA, PRE_COL_ORDEN, ultimaHist),
        valores: _matrizHistoricoPRE(s)
    });

    // --- Escalera de candidatos al ancla (columna oculta M) ---
    bloques.push({
        rango: PRE_COL_ESCALERA + PRE_FILA_ESCALERA_HEADER,
        valores: [['candidatos al ancla (mes con >= ' + PRE_MIN_FILAS_MES_ACTIVO + ' filas)']]
    });
    bloques.push({
        rango: _rangoPRE(PRE_COL_ESCALERA, PRE_FILA_ESCALERA_PRIMERA,
                         PRE_COL_ESCALERA, _filaEscaleraUltimaPRE()),
        valores: _formulasEscaleraPRE(s).map(function (f) { return [f]; })
    });

    // --- Bloque D: integridad ---
    bloques.push({
        rango: B + PRE_FILA_BLOQUE_INTEGRIDAD,
        valores: [['CONTROL DE INTEGRIDAD - si un control no da cero, los numeros de arriba mienten']]
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_INTEGRIDAD_PRIMERA, PRE_COL_VALOR,
                         PRE_FILA_INTEGRIDAD_PRIMERA + controles.length - 1),
        valores: controles.map(function (c) { return [c.rotulo, c.formula]; })
    });

    // --- Bloque E: whitelist publicada (la lee el motor por VLOOKUP) ---
    bloques.push({
        rango: B + PRE_FILA_BLOQUE_WHITELIST,
        valores: [['COMO SE CALCULA EL AHORRO - tipos de proyecto que cuentan como ahorro']]
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_WL_HEADER, PRE_COL_VALOR, PRE_FILA_WL_HEADER),
        valores: [['Tipo de proyecto', 'Cuenta como ahorro']]
    });
    bloques.push({
        rango: _rangoPRE(B, PRE_FILA_WL_PRIMERA, PRE_COL_VALOR, _filaWhitelistUltimaPRE()),
        valores: PRE_WHITELIST_AHORRO.map(function (t) { return [t, 1]; })
    });
    bloques.push({
        rango: B + PRE_FILA_WL_NOTA,
        valores: [['Financiacion (tarjeta, prestamos) y Liquidez quedan AFUERA a proposito: la deuda ' +
                   'no es riqueza y la caja operativa no es ahorro. El Ahorro se mide por el Medio de ' +
                   'pago (Medio -> Proyecto -> Tipo), no por la cuenta, y por eso incluye los traspasos.']]
    });

    return bloques;
}

/** Formatos por rango. Se aplican despues de escribir, en cada corrida. */
function _formatosPRE() {
    var B = PRE_COL_ROTULO;
    var ultimaHist = _filaHistoricoUltimaPRE();
    var controles = _controlesIntegridadPRE(',').length;

    return {
        moneda: [
            _rangoPRE('C', PRE_FILA_PRESUP_GF, 'C', PRE_FILA_PRESUP_SIN_ASIGNAR),
            _rangoPRE('E', PRE_FILA_PRESUP_GF, 'E', PRE_FILA_PRESUP_AHORRO),
            _rangoPRE('G', PRE_FILA_PRESUP_GF, 'G', PRE_FILA_PRESUP_AHORRO),
            _rangoPRE('C', PRE_FILA_REF_INGRESOS, 'C', PRE_FILA_REF_INGRESOS + 3),
            _rangoPRE('E', PRE_FILA_REF_INGRESOS, 'E', PRE_FILA_REF_INGRESOS + 3),
            _rangoPRE('G', PRE_FILA_REF_INGRESOS, 'G', PRE_FILA_REF_INGRESOS + 3),
            _rangoPRE('C', PRE_FILA_HIST_PRIMERA, 'D', ultimaHist),
            _rangoPRE('F', PRE_FILA_HIST_PRIMERA, 'F', ultimaHist),
            _rangoPRE('H', PRE_FILA_HIST_PRIMERA, 'H', ultimaHist),
            _rangoPRE('J', PRE_FILA_HIST_PRIMERA, 'J', ultimaHist)
        ],
        porcentaje: [
            _rangoPRE('D', PRE_FILA_PRESUP_GF, 'D', PRE_FILA_PRESUP_SIN_ASIGNAR),
            _rangoPRE('F', PRE_FILA_PRESUP_GF, 'F', PRE_FILA_PRESUP_AHORRO),
            _rangoPRE('D', PRE_FILA_REF_INGRESOS + 1, 'D', PRE_FILA_REF_INGRESOS + 3),
            _rangoPRE('F', PRE_FILA_REF_INGRESOS + 1, 'F', PRE_FILA_REF_INGRESOS + 3),
            _rangoPRE('H', PRE_FILA_REF_INGRESOS + 1, 'H', PRE_FILA_REF_INGRESOS + 3),
            _rangoPRE('E', PRE_FILA_HIST_PRIMERA, 'E', ultimaHist),
            _rangoPRE('G', PRE_FILA_HIST_PRIMERA, 'G', ultimaHist),
            _rangoPRE('I', PRE_FILA_HIST_PRIMERA, 'I', ultimaHist)
        ],
        mes: [
            PRE_COL_VALOR + PRE_FILA_MES_CLAVE,
            PRE_COL_VALOR + PRE_FILA_ANCLA,
            PRE_COL_ANCLA_BASE + PRE_FILA_ANCLA,
            _rangoPRE(B, PRE_FILA_HIST_PRIMERA, B, ultimaHist),
            _rangoPRE(PRE_COL_ESCALERA, PRE_FILA_ESCALERA_PRIMERA,
                      PRE_COL_ESCALERA, _filaEscaleraUltimaPRE())
        ],
        entero: [
            _rangoPRE('C', PRE_FILA_INTEGRIDAD_PRIMERA, 'C', PRE_FILA_INTEGRIDAD_PRIMERA + controles - 1),
            _rangoPRE('C', PRE_FILA_WL_PRIMERA, 'C', _filaWhitelistUltimaPRE()),
            _rangoPRE(PRE_COL_ULTIMA_VISIBLE, PRE_FILA_HIST_PRIMERA, PRE_COL_ORDEN, ultimaHist),
            PRE_COL_VALOR + PRE_FILA_REF_MESES,
            'E' + PRE_FILA_REF_MESES,
            'G' + PRE_FILA_REF_MESES
        ],
        titulosBloque: [
            B + PRE_FILA_TITULO,
            B + PRE_FILA_BLOQUE_PRESUPUESTO,
            B + PRE_FILA_BLOQUE_REFERENCIA,
            B + PRE_FILA_BLOQUE_HISTORICO,
            B + PRE_FILA_BLOQUE_INTEGRIDAD,
            B + PRE_FILA_BLOQUE_WHITELIST
        ],
        headersTabla: [
            _rangoPRE(B, PRE_FILA_PRESUP_HEADER, 'G', PRE_FILA_PRESUP_HEADER),
            _rangoPRE(B, PRE_FILA_REF_HEADER, 'H', PRE_FILA_REF_HEADER),
            _rangoPRE(B, PRE_FILA_HIST_HEADER, PRE_COL_ORDEN, PRE_FILA_HIST_HEADER),
            _rangoPRE(B, PRE_FILA_WL_HEADER, PRE_COL_VALOR, PRE_FILA_WL_HEADER)
        ],
        anchos: [
            { col: 'B', ancho: 320 }, { col: 'C', ancho: 130 }, { col: 'D', ancho: 130 },
            { col: 'E', ancho: 130 }, { col: 'F', ancho: 130 }, { col: 'G', ancho: 130 },
            { col: 'H', ancho: 130 }, { col: 'I', ancho: 90 }, { col: 'J', ancho: 140 },
            { col: PRE_COL_ULTIMA_VISIBLE, ancho: 100 }
        ]
    };
}

// ============================================
// PREFLIGHT (SOLO LECTURA)
// ============================================

/**
 * Lee la planilla y arma el plan. NO ESCRIBE NADA.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object} plan con problemas (bloqueantes), avisos y todo lo medido
 */
function _planPRE(ss) {
    var plan = {
        problemas: [],
        avisos: [],
        hoja: { nombre: SHEETS.PRESUPUESTO, existe: false, esNuestra: false, filas: 0, columnas: 0,
                escrituraCompleta: null, marcador: '', recuperable: false, adoptada: false },
        ventana: null,
        ledger: { nombre: SHEETS.REGISTROS, filasGrid: 0, headersOk: false },
        planCuentas: { nombre: SHEETS.PLAN_CUENTAS, headersOk: false, tiposVivos: [], faltantes: [], desconocidos: [] },
        humanas: [],
        capacidad: { requerida: 0, actual: 0 },
        estadoGuardado: _leerEstadoPRE()
    };

    if (plan.estadoGuardado._corrupto) {
        plan.problemas.push('El registro del devtool en DocumentProperties es ILEGIBLE. No se escribe ' +
                            'nada a ciegas: revisar antes de seguir. Fragmento: ' + plan.estadoGuardado._crudo);
    }

    // --- El ledger: existencia, geometria y GUARD ANTI-DRIFT sobre el header ---
    var hojaLedger = ss.getSheetByName(SHEETS.REGISTROS);
    if (!hojaLedger) {
        plan.problemas.push('No existe la hoja "' + SHEETS.REGISTROS + '": sin ledger no hay historico.');
    } else {
        plan.ledger.filasGrid = hojaLedger.getMaxRows();
        var cfg = RANGES.REGISTROS;
        var filaHeader = cfg.headerRow;
        var desvios = [];
        if (!filaHeader) {
            plan.problemas.push('RANGES.REGISTROS.headerRow no esta definido en 00_Config.js: no se ' +
                                'puede verificar que el ledger siga donde dice el config.');
        } else {
            var col1 = columnLetterToIndex(cfg.start);
            var col2 = columnLetterToIndex(cfg.end);
            var leidos = hojaLedger.getRange(filaHeader, col1, 1, col2 - col1 + 1).getDisplayValues()[0];
            for (var clave in PRE_HEADERS_LEDGER) {
                if (!Object.prototype.hasOwnProperty.call(PRE_HEADERS_LEDGER, clave)) continue;
                var letra = cfg.columns[clave];
                if (!letra) continue;
                var idx = columnLetterToIndex(letra) - col1;
                var real = String(leidos[idx] || '').trim();
                var esperado = PRE_HEADERS_LEDGER[clave];
                if (real.toUpperCase() !== esperado.toUpperCase()) {
                    desvios.push(letra + filaHeader + ' dice "' + real + '" y deberia decir "' + esperado + '"');
                }
            }
            plan.ledger.headersOk = (desvios.length === 0);
            if (desvios.length) {
                // Este es EL guard del modulo: si el ledger se movio, las formulas leerian columnas
                // que ya no son las que dicen ser y devolverian numeros creibles y falsos.
                plan.problemas.push('DRIFT en el header de "' + SHEETS.REGISTROS + '" (fila ' + filaHeader +
                                    '): ' + desvios.join(' | ') + '. Actualizar 00_Config.js ANTES de escribir ' +
                                    'una sola formula sobre esas columnas.');
            }
        }
    }

    // --- Plan de Cuentas: headers y tipos de proyecto vivos ---
    var hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    if (!hojaPC) {
        plan.problemas.push('No existe la hoja "' + SHEETS.PLAN_CUENTAS + '": sin catalogo no se puede ' +
                            'resolver Medio -> Proyecto -> Tipo, que es como se mide el Ahorro.');
    } else {
        var desviosPC = [];
        PRE_HEADERS_PLAN_CUENTAS.forEach(function (h) {
            var cfgPC = RANGES[h.tabla];
            var letraPC = cfgPC.columns[h.clave];
            var filaHeaderPC = cfgPC.headerRow || HEADER_ROW;
            var realPC = String(hojaPC.getRange(letraPC + filaHeaderPC).getDisplayValue() || '').trim();
            if (realPC.toUpperCase() !== h.rotulo.toUpperCase()) {
                desviosPC.push(letraPC + filaHeaderPC + ' dice "' + realPC + '" y deberia decir "' + h.rotulo + '"');
            }
        });
        plan.planCuentas.headersOk = (desviosPC.length === 0);
        if (desviosPC.length) {
            plan.problemas.push('DRIFT en el header de "' + SHEETS.PLAN_CUENTAS + '": ' + desviosPC.join(' | ') + '.');
        }

        // Tipos de proyecto vivos: se contrastan contra la whitelist SIN corregir nada.
        var cfgProy = RANGES.PROYECTOS;
        var filaProy = getDataRow(cfgProy);
        var ultimaProy = hojaPC.getLastRow();
        if (ultimaProy >= filaProy) {
            var filasProy = hojaPC.getRange(filaProy, columnLetterToIndex(cfgProy.start),
                                            ultimaProy - filaProy + 1, 2).getDisplayValues();
            var vistos = Object.create(null);
            filasProy.forEach(function (f) {
                var nombre = String(f[0] || '').trim();
                var tipo = String(f[1] || '').trim();
                if (!nombre || !tipo) return;
                if (!vistos[tipo]) {
                    vistos[tipo] = true;
                    plan.planCuentas.tiposVivos.push(tipo);
                }
            });
        }
        var normal = function (t) { return String(t).trim().toUpperCase(); };
        var wl = PRE_WHITELIST_AHORRO.map(normal);
        var excl = PRE_TIPOS_EXCLUIDOS_CONOCIDOS.map(normal);
        PRE_WHITELIST_AHORRO.forEach(function (t) {
            var hay = plan.planCuentas.tiposVivos.some(function (v) { return normal(v) === normal(t); });
            if (!hay) plan.planCuentas.faltantes.push(t);
        });
        plan.planCuentas.tiposVivos.forEach(function (v) {
            if (wl.indexOf(normal(v)) === -1 && excl.indexOf(normal(v)) === -1) {
                plan.planCuentas.desconocidos.push(v);
            }
        });
        if (plan.planCuentas.faltantes.length) {
            plan.avisos.push('Tipos de la whitelist que hoy NO usa ningun proyecto: ' +
                             plan.planCuentas.faltantes.join(', ') + '. No rompe nada (la whitelist es la ' +
                             'regla, no el inventario), pero conviene saberlo.');
        }
        if (plan.planCuentas.desconocidos.length) {
            plan.avisos.push('Tipos de proyecto que no estan ni en la whitelist ni entre los excluidos ' +
                             'conocidos: ' + plan.planCuentas.desconocidos.join(', ') + '. El campo es texto ' +
                             'libre: si alguno deberia contar como ahorro, se agrega a PRE_WHITELIST_AHORRO ' +
                             'en el codigo, no a mano en la hoja.');
        }
    }

    // --- La hoja Presupuesto ---
    var hoja = ss.getSheetByName(SHEETS.PRESUPUESTO);
    if (hoja) {
        plan.hoja.existe = true;
        plan.hoja.filas = hoja.getMaxRows();
        plan.hoja.columnas = hoja.getMaxColumns();
        var firma = plan.hoja.columnas >= columnLetterToIndex(PRE_STG.MES)
            ? String(hoja.getRange(PRE_STG.MES + PRE_FILA_STG_FIRMA).getDisplayValue() || '').trim()
            : '';
        plan.hoja.esNuestra = (firma === PRE_FIRMA);
        plan.hoja.marcador = plan.hoja.columnas >= columnLetterToIndex(PRE_STG.MES)
            ? String(hoja.getRange(PRE_STG.MES + (PRE_FILA_STG_FIRMA + 1)).getDisplayValue() || '').trim()
            : '';
        plan.hoja.escrituraCompleta = (plan.hoja.marcador.indexOf(PRE_MARCA_COMPLETA) === 0);
        // La hoja sin firma es recuperable si el registro dice que la creo una corrida propia que
        // nunca se completo. Se calcula aca para que estado lo INFORME: la version anterior no lo
        // decia en ningun lado y el usuario no tenia como saber que revertir podia sacarlo del paso.
        var eg = plan.estadoGuardado;
        plan.hoja.recuperable = (eg && eg.hojaCreada === true && !!eg.creadaEn &&
                                 (!eg.completadaEn || String(eg.completadaEn) < String(eg.creadaEn)));

        if (!plan.hoja.esNuestra && !plan.hoja.recuperable) {
            // No se bulldozea el trabajo de nadie. Si Franco hizo su propia hoja "Presupuesto",
            // este devtool no la conoce y no la toca.
            plan.problemas.push('Ya existe una hoja "' + SHEETS.PRESUPUESTO + '" que NO lleva la firma de ' +
                                'este devtool (' + PRE_STG.MES + PRE_FILA_STG_FIRMA + ' deberia decir "' +
                                PRE_FIRMA + '" y dice "' + firma + '"). No se toca: renombrarla o ' +
                                'borrarla a mano si se quiere que el devtool la cree de cero.');
        } else if (!plan.hoja.esNuestra) {
            // decision Franco 2026-08-13: una hoja sin firma que el propio registro dice que creo
            // una corrida propia sin terminar NO es un bloqueante: es una corrida a medias, y la
            // salida natural es completarla. Dejarla como bloqueante era la mitad del deadlock --
            // aplicar se negaba a tocar "una hoja ajena" que en realidad era suya, de hace treinta
            // segundos y vacia.
            //
            // RIESGO ASUMIDO, dicho en voz alta: el registro es un indicio, no una prueba. Si entre
            // el corte y el reintento alguien borro esa hoja y creo a mano otra con el mismo nombre,
            // la adopcion la reescribe. Se acepta porque las tres barreras que quedan son las que
            // importan: (1) el respaldo se congela y se VERIFICA antes de mutar, y si no verifica se
            // aborta sin escribir -- o sea que el contenido no se destruye, se muda a una hoja
            // oculta; (2) estado lo dice antes, con todas las letras; (3) el dialogo de confirmacion
            // se rotula RECUPERACION y describe lo que va a pasar. La alternativa era conservar un
            // deadlock sin salida por codigo, que es un dano seguro contra uno hipotetico y
            // reversible.
            plan.hoja.adoptada = true;
            plan.avisos.push('La hoja "' + SHEETS.PRESUPUESTO + '" existe SIN firma, pero el registro ' +
                             'del devtool dice que la creo la corrida del ' + eg.creadaEn + ' y que ' +
                             'esa corrida nunca se completo. Se ADOPTA y se reescribe entera (antes ' +
                             'se congela un respaldo). Si preferis empezar de cero, ' +
                             'revertirPresupuesto() tambien puede darla de baja.');
        }

        // Todo lo que sigue se lee tanto de una hoja firmada como de una adoptada: una corrida
        // cortada pudo alcanzar a sembrar las celdas de Franco antes de morir, y esas no se pisan
        // nunca -- ni siquiera cuando la hoja que las contiene es un cascaron a medio escribir.
        if (plan.hoja.esNuestra || plan.hoja.adoptada) {
            if (plan.hoja.esNuestra && !plan.hoja.escrituraCompleta) {
                // Aviso y NO bloqueante: la salida de una escritura cortada es volver a aplicar.
                plan.avisos.push('La ultima escritura de la hoja quedo INCOMPLETA (' + PRE_STG.MES +
                                 (PRE_FILA_STG_FIRMA + 1) + ' dice "' + (plan.hoja.marcador || '(vacio)') +
                                 '" en vez de empezar con "' + PRE_MARCA_COMPLETA + '"). Se corto a ' +
                                 'mitad de camino. aplicarPresupuesto() la completa: es idempotente, ' +
                                 'reescribe todo y no pisa las celdas de Franco.');
            }
            // Que hay hoy en las celdas de Franco: se informa para que nadie espere que se pisen.
            _celdasHumanasPRE(',').forEach(function (h) {
                var rango = hoja.getRange(h.celda);
                plan.humanas.push({
                    celda: h.celda, rol: h.rol,
                    vacia: rango.isBlank(),
                    contenido: rango.getFormula() || String(rango.getDisplayValue() || '')
                });
            });
            // Drift en la tabla de whitelist: la lee el motor, y editarla a mano cambia el Ahorro.
            // Solo tiene sentido sobre una hoja TERMINADA: en un cascaron a medio escribir la tabla
            // todavia no existe, y reportarla como "editada a mano" seria un aviso falso.
            if (plan.hoja.escrituraCompleta) {
                var wlLeida = hoja.getRange(PRE_FILA_WL_PRIMERA, columnLetterToIndex(PRE_COL_ROTULO),
                                            PRE_WHITELIST_AHORRO.length, 1).getDisplayValues();
                var difWl = [];
                PRE_WHITELIST_AHORRO.forEach(function (t, i) {
                    var real = String(wlLeida[i][0] || '').trim();
                    if (real !== t) difWl.push('fila ' + (PRE_FILA_WL_PRIMERA + i) + ': "' + real + '" en vez de "' + t + '"');
                });
                if (difWl.length) {
                    plan.avisos.push('La tabla publicada de la whitelist fue editada a mano (' + difWl.join(' | ') +
                                     '). Aplicar la vuelve a dejar como manda el codigo.');
                }
            }

            // La ventana, en solo lectura. Es el diagnostico que antes no existia: la hoja podia
            // estar entera y en ceros, y estado no tenia como decirlo.
            if (plan.hoja.escrituraCompleta) {
                try {
                    plan.ventana = _verificarVentanaPRE(hoja);
                } catch (e) {
                    logError('_planPRE: no se pudo leer la ventana del historico', e);
                    plan.ventana = { verificable: false, problemas: ['no se pudo leer: ' + e.message],
                                     avisos: [], datos: {} };
                }
            }
        }
    }

    // --- Capacidad del motor ---
    plan.capacidad.requerida = plan.ledger.filasGrid + PRE_COLCHON_MOTOR;
    plan.capacidad.actual = plan.hoja.filas;

    plan.nadaQueHacer = false;
    return plan;
}

/**
 * Arma el informe humano del plan.
 * @param {Object} plan
 * @param {string} titulo
 * @returns {string}
 */
function _redactarPRE(plan, titulo) {
    var l = [titulo + ' (devtool v' + PRE_VERSION + ')'];
    l.push('');

    l.push('1) FUENTES');
    l.push('   ledger "' + plan.ledger.nombre + '": ' + (plan.ledger.filasGrid || '?') + ' filas de grid, ' +
           'header ' + (plan.ledger.headersOk ? 'VERIFICADO' : 'CON DRIFT') + '.');
    l.push('   catalogo "' + plan.planCuentas.nombre + '": header ' +
           (plan.planCuentas.headersOk ? 'VERIFICADO' : 'CON DRIFT') + '; tipos de proyecto vivos: ' +
           (plan.planCuentas.tiposVivos.length ? plan.planCuentas.tiposVivos.join(', ') : '(ninguno leido)') + '.');
    l.push('   whitelist de Ahorro (codigo): ' + PRE_WHITELIST_AHORRO.join(', ') + '.');
    l.push('   un mes cuenta como "mes con actividad" desde ' + PRE_MIN_FILAS_MES_ACTIVO +
           ' movimientos; el ancla y los promedios solo usan esos meses.');
    l.push('');

    l.push('2) HOJA "' + plan.hoja.nombre + '"');
    if (!plan.hoja.existe) {
        l.push('   NO EXISTE todavia: aplicar la crea, con ' + plan.capacidad.requerida + ' filas de motor.');
    } else {
        l.push('   existe (' + plan.hoja.filas + ' filas x ' + plan.hoja.columnas + ' columnas), firma ' +
               (plan.hoja.esNuestra ? 'CORRECTA' : 'AUSENTE O DISTINTA') + '.');
        l.push('   ultima escritura: ' + (plan.hoja.escrituraCompleta ? 'COMPLETA' : 'INCOMPLETA') +
               ' (' + PRE_STG.MES + (PRE_FILA_STG_FIRMA + 1) + ' = "' + (plan.hoja.marcador || '(vacio)') + '").');
        if (!plan.hoja.esNuestra) {
            l.push('   sin firma. Se puede ADOPTAR y reescribir con aplicarPresupuesto(): ' +
                   (plan.hoja.adoptada ? 'SI' : 'NO') + '.');
            l.push('   baja por codigo: ' + (plan.hoja.recuperable
                ? 'POSIBLE (revertirPresupuesto(): el registro dice que la creo una corrida propia sin terminar).'
                : 'NO (hay que renombrarla o borrarla a mano).'));
        }
        l.push('   capacidad del motor: ' + plan.capacidad.actual + ' filas; se necesitan ' +
               plan.capacidad.requerida + ' (grid del ledger + ' + PRE_COLCHON_MOTOR + ' de colchon).');
    }
    l.push('');

    l.push('2b) VENTANA DEL HISTORICO (si esto no cierra, los promedios y los sugeridos no valen)');
    if (!plan.ventana) {
        l.push('   sin medir: la hoja no existe todavia, no es nuestra, o su ultima escritura quedo incompleta.');
    } else if (!plan.ventana.verificable) {
        l.push('   NO VERIFICABLE: ' + plan.ventana.problemas.join(' | '));
    } else {
        l.push('   ancla: ' + (plan.ventana.datos.ancla.display || '(vacia)') +
               '   ultimo mes cargado: ' + (plan.ventana.datos.base.display || '(vacio)'));
        l.push('   meses reales que promedia la ventana de ' + PRE_VENTANAS[0] + ': ' +
               plan.ventana.datos.mesesPromediadosCorta.display + ' de ' + PRE_VENTANAS[0] +
               '   |   meses flojos en los ' + PRE_MESES_HISTORICO + ' de ventana: ' +
               plan.ventana.datos.mesesSinActividad.display);
        l.push('   promedio de ingresos de ' + PRE_VENTANAS[0] + ' meses: ' +
               (plan.ventana.datos.promedioIngresos.display || '(vacio)'));
        plan.ventana.problemas.forEach(function (p) { l.push('   PROBLEMA: ' + p); });
        plan.ventana.avisos.forEach(function (a) { l.push('   aviso: ' + a); });
        if (!plan.ventana.problemas.length) l.push('   la ventana tiene evidencia suficiente.');
    }
    l.push('');

    l.push('3) CELDAS DE FRANCO (las unicas seis que aplicar NO pisa nunca)');
    if (!plan.humanas.length) {
        l.push('   la hoja todavia no existe: se van a sembrar mes, anio e ingreso esperado, y los tres ' +
               'montos quedan VACIOS para que los escriba Franco.');
    } else {
        plan.humanas.forEach(function (h) {
            l.push('   ' + h.celda + ' (' + h.rol + '): ' +
                   (h.vacia ? 'VACIA -> se siembra' : 'con valor "' + h.contenido + '" -> se respeta'));
        });
    }
    l.push('');

    l.push('4) CONTRATO QUE PUBLICA LA HOJA (lo que va a cablear el Tablero)');
    _rangosConNombrePRE().forEach(function (r) {
        l.push('   ' + SHEETS.PRESUPUESTO + '!' + r.celda + '  [' + r.nombre + ']  ' + r.rol);
    });
    l.push('');

    if (plan.avisos.length) {
        l.push('AVISOS (no bloquean):');
        plan.avisos.forEach(function (a) { l.push('   - ' + a); });
        l.push('');
    }

    if (plan.problemas.length) {
        l.push('BLOQUEANTES: aplicarPresupuesto() ABORTARIA sin tocar nada por:');
        plan.problemas.forEach(function (p) { l.push('   - ' + p); });
    } else {
        l.push('VEREDICTO: aplicable. aplicarPresupuesto() ' +
               (plan.hoja.existe ? 'reescribe rotulos y formulas de la hoja existente'
                                 : 'crea la hoja') + ' sin tocar las celdas de Franco.');
        if (plan.ventana && plan.ventana.problemas.length) {
            l.push('   PERO la hoja de hoy no tiene evidencia suficiente (ver 2b): escribirla de ' +
                   'nuevo no la arregla, hacen falta movimientos en el ledger.');
        }
    }

    return l.join('\n');
}

// ============================================
// SONDA DE LOCALE
// ============================================

/**
 * Determina con que separador de argumentos hay que construir las formulas de ESTA planilla.
 *
 * No se asume: se pregunta. "=SUM(1,2)" da 3 si la coma separa argumentos y 1,2 si la coma es
 * el separador decimal del locale -- las dos respuestas son numeros validos, ninguna es un
 * error, y por eso la unica forma de saberlo es leer el resultado.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja hoja donde sondear (celda PRE_CELDA_SONDA)
 * @returns {string} ',' o ';'
 * @throws {Error} si la planilla no acepta ninguno de los dos
 */
function _detectarSeparadorPRE(hoja) {
    var celda = hoja.getRange(PRE_CELDA_SONDA);
    try {
        celda.setFormula('=SUM(1,2)');
        SpreadsheetApp.flush();
        if (celda.getValue() === 3) return ',';

        celda.setFormula('=SUM(1;2)');
        SpreadsheetApp.flush();
        if (celda.getValue() === 3) {
            logInfo('_detectarSeparadorPRE: la planilla espera ";" (locale es). Las formulas se ' +
                    'construyen con ese separador.');
            return ';';
        }

        throw new Error('La sonda de separador no dio 3 con ninguna de las dos sintaxis (' +
                        'valor leido: "' + celda.getDisplayValue() + '"). No se escribio ninguna formula.');
    } finally {
        celda.clearContent();
    }
}

// ============================================
// RESPALDO (ANTES DE MUTAR, Y VERIFICADO)
// ============================================

/**
 * Congela el contenido actual de la hoja en una hoja oculta fechada y lo RELEE para verificarlo.
 *
 * Se respalda TODA la zona de presentacion mas la fila de formulas del motor: celda, formula
 * literal y valor mostrado. Las celdas humanas van ademas a DocumentProperties, que es el
 * registro primario -- son las unicas irrecuperables, porque las formulas las regenera el codigo.
 *
 * Un respaldo que no se releyo no es un respaldo, es una afirmacion.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja hoja Presupuesto viva
 * @param {string} sello
 * @returns {{nombre: string, celdas: number}}
 * @throws {Error} si el respaldo no queda verificado
 */
function _respaldarHojaPRE(ss, hoja, sello) {
    var props = PropertiesService.getDocumentProperties();
    var encabezado = ['celda', 'formula original', 'valor mostrado', 'sello'];
    var filas = [];

    // Solo la PRESENTACION (B..J). El area del motor se respalda aparte, y unicamente su fila de
    // ARRAYFORMULA: lo que hay debajo es derrame calculado, no contenido. Barrerlo entero meteria
    // miles de filas de valores derivados en un respaldo que existe para guardar lo irrepetible.
    var colIni = columnLetterToIndex(PRE_COL_ROTULO);
    var colFin = Math.min(columnLetterToIndex(PRE_COL_ULTIMA_PRESENTACION), hoja.getMaxColumns());
    var filaFin = Math.min(PRE_FILA_ULTIMA_PRESENTACION, hoja.getMaxRows());

    var rango = hoja.getRange(1, colIni, filaFin, colFin - colIni + 1);
    var formulas = rango.getFormulas();
    var mostrados = rango.getDisplayValues();

    for (var r = 0; r < formulas.length; r++) {
        for (var c = 0; c < formulas[r].length; c++) {
            var f = formulas[r][c];
            var v = mostrados[r][c];
            if (!f && (v === '' || v === null)) continue;
            var letra = _letraColumnaPRE(colIni + c);
            filas.push([letra + (r + 1), f, v, sello]);
        }
    }

    // El motor: la firma y la unica fila que tiene formulas propias (la de los ARRAYFORMULA).
    var colStgIni = columnLetterToIndex(PRE_STG.MES);
    var colStgFin = Math.min(columnLetterToIndex(PRE_STG.AHORRO), hoja.getMaxColumns());
    if (colStgFin >= colStgIni && hoja.getMaxRows() >= PRE_FILA_STG_DATOS) {
        [PRE_FILA_STG_FIRMA, PRE_FILA_STG_FIRMA + 1].forEach(function (f) {
            var celFirma = hoja.getRange(PRE_STG.MES + f);
            var vFirma = celFirma.getDisplayValue();
            if (vFirma !== '') filas.push([PRE_STG.MES + f, celFirma.getFormula() || '', vFirma, sello]);
        });
        var fStg = hoja.getRange(PRE_FILA_STG_DATOS, colStgIni, 1, colStgFin - colStgIni + 1).getFormulas()[0];
        fStg.forEach(function (formula, i) {
            if (!formula) return;
            filas.push([_letraColumnaPRE(colStgIni + i) + PRE_FILA_STG_DATOS, formula, '(ARRAYFORMULA)', sello]);
        });
    }

    // Las celdas humanas, ademas, al registro primario.
    var humanas = _celdasHumanasPRE(',');
    humanas.forEach(function (h) {
        var rangoH = hoja.getRange(h.celda);
        var contenido = rangoH.getFormula() || String(rangoH.getValue());
        props.setProperty(_claveCeldaPRE(h.celda), contenido);
    });

    if (!filas.length) {
        // Hoja vacia: no hay nada que congelar y decir lo contrario seria mentir.
        logInfo('_respaldarHojaPRE: la hoja no tiene contenido, no se crea respaldo.');
        return { nombre: null, celdas: 0 };
    }

    var nombre = _nombreHojaLibrePRE(ss, PRE_RESPALDO_PREFIJO + sello);
    var destino = ss.insertSheet(nombre);
    invalidarCacheNombresHojas();   // el cache de nombres del config quedo viejo

    var bloque = [encabezado].concat(filas);
    asegurarCapacidadFilas(destino, bloque.length);

    var rangoDestino = destino.getRange(1, 1, bloque.length, 4);
    rangoDestino.setNumberFormat('@');   // texto plano para la VISUALIZACION
    // El formato '@' NO alcanza: setValues con un string que arranca en "=" lo parsea como
    // FORMULA igual y el respaldo queda VIVO. Es la cicatriz que ya pago el modulo de migracion.
    rangoDestino.setValues(bloque.map(function (fila) {
        return fila.map(_textoLiteralPRE);
    }));

    SpreadsheetApp.flush();
    var releido = destino.getRange(1, 1, bloque.length, 4);
    var valores = releido.getValues();
    var vivas = releido.getFormulas();
    var malas = [];

    for (var i = 0; i < bloque.length; i++) {
        for (var j = 0; j < 4; j++) {
            if (vivas[i][j]) {
                malas.push(bloque[i][0] + ' (columna ' + (j + 1) + ': quedo como FORMULA VIVA)');
                break;
            }
            if (String(valores[i][j]) !== String(bloque[i][j])) {
                malas.push(bloque[i][0] + ' (columna ' + (j + 1) + ': el respaldo no coincide)');
                break;
            }
        }
    }

    humanas.forEach(function (h) {
        var guardada = props.getProperty(_claveCeldaPRE(h.celda));
        var rangoH = hoja.getRange(h.celda);
        var esperada = rangoH.getFormula() || String(rangoH.getValue());
        if (guardada !== esperada) malas.push(h.celda + ' (DocumentProperties)');
    });

    if (malas.length) {
        throw new Error('El respaldo no quedo verificado en: ' + malas.slice(0, 12).join(', ') +
                        (malas.length > 12 ? ' [...y ' + (malas.length - 12) + ' mas]' : '') +
                        '. No se muto ninguna celda.');
    }

    destino.hideSheet();
    logSuccess('Respaldo VERIFICADO de ' + filas.length + ' celda(s) en "' + nombre + '".');
    return { nombre: nombre, celdas: filas.length };
}

/** Convierte un indice 1-based de columna en letras (1 -> A, 28 -> AB). */
function _letraColumnaPRE(n) {
    var s = '';
    var x = n;
    while (x > 0) {
        var resto = (x - 1) % 26;
        s = String.fromCharCode(65 + resto) + s;
        x = Math.floor((x - resto) / 26);
    }
    return s;
}

// ============================================
// ESCRITURA
// ============================================

/** Garantiza que la hoja tenga al menos `ultimaCol` columnas fisicas. */
function _asegurarCapacidadColumnasPRE(hoja, ultimaCol) {
    var actuales = hoja.getMaxColumns();
    if (ultimaCol <= actuales) return 0;
    hoja.insertColumnsAfter(actuales, ultimaCol - actuales);
    logInfo('_asegurarCapacidadColumnasPRE: "' + hoja.getName() + '" ampliada de ' + actuales +
            ' a ' + ultimaCol + ' columnas.');
    return ultimaCol - actuales;
}

/**
 * Escribe la hoja entera: firma, geometria, rotulos, formulas, formatos y marcador de completitud.
 * Las celdas de Franco se escriben SOLO si estan vacias.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @param {Object} plan
 * @param {string} sello
 * @param {{firmada: boolean}} [progreso] se marca en cuanto la hoja queda firmada
 * @returns {{bloques: number, formulasMotor: number, humanasSembradas: Array<string>, humanasRespetadas: Array<string>, separador: string, filasAgregadas: number}}
 */
function _escribirHojaPRE(ss, hoja, plan, sello, progreso) {
    var res = {
        bloques: 0, formulasMotor: 0, humanasSembradas: [], humanasRespetadas: [],
        separador: ',', filasAgregadas: 0
    };

    // 1. Columnas ANTES que nada: la firma vive en N2 y sin columnas no hay N.
    _asegurarCapacidadColumnasPRE(hoja, columnLetterToIndex(PRE_COL_ULTIMA));

    // 2. FIRMA Y MARCADOR "EN CURSO", antes de cualquier operacion larga.
    //
    // decision Franco 2026-08-13: este es el paso que estaba al final (era el 5 de 9) y es el que
    // creaba el deadlock de recuperacion. Todo lo que viene despues -- ~30 setValues, diez
    // ARRAYFORMULA que derraman sobre miles de filas, ~40 llamadas de formato -- puede consumir
    // los 6 minutos de Apps Script; si eso pasaba antes de la firma, la hoja quedaba huerfana y
    // ni aplicar ni revertir la reconocian. Ahora una corrida cortada deja una hoja FIRMADA y
    // marcada "en curso": aplicar la reconoce y la completa (es idempotente), revertir la
    // reconoce y la da de baja. La firma no afirma "esta hoja esta bien"; afirma "esta hoja es
    // mia". Quien afirma que esta terminada es el marcador de N3, y solo al final.
    //
    // El parentesis de (PRE_FILA_STG_FIRMA + 1) no es decorativo: sin el, "N" + 2 + 1 da "N21"
    // -- una celda DENTRO del area de derrame del motor, que bloquearia el ARRAYFORMULA de N6
    // con #REF!. Lo cazo el banco de pruebas antes de que llegara a la planilla.
    hoja.getRange(PRE_STG.MES + PRE_FILA_STG_FIRMA).setValue(PRE_FIRMA);
    hoja.getRange(PRE_STG.MES + (PRE_FILA_STG_FIRMA + 1))
        .setValue(PRE_MARCA_EN_CURSO + ' | v' + PRE_VERSION + ' | ' + sello);
    if (progreso) progreso.firmada = true;

    // 3. Resto de la geometria: si el motor no entra, no se escribe nada a medias.
    res.filasAgregadas = asegurarCapacidadFilas(hoja, plan.capacidad.requerida);

    // 4. Sonda de locale.
    res.separador = _detectarSeparadorPRE(hoja);
    var s = res.separador;

    // 5. Bloques de presentacion.
    _bloquesPRE(s).forEach(function (b) {
        hoja.getRange(b.rango).setValues(b.valores);
        res.bloques++;
    });

    // 6. Motor.
    var motor = _formulasStagingPRE(s);
    var titulos = [];
    motor.forEach(function (m) {
        hoja.getRange(m.col + PRE_FILA_STG_DATOS).setFormula(m.formula);
        titulos.push(m.titulo);
        if (m.formato) {
            hoja.getRange(m.col + PRE_FILA_STG_DATOS + ':' + m.col).setNumberFormat(m.formato);
        }
        res.formulasMotor++;
    });
    hoja.getRange(PRE_FILA_STG_HEADER, columnLetterToIndex(PRE_STG.MES), 1, titulos.length)
        .setValues([titulos]);

    // 7. Celdas de Franco: se siembran solo si estan vacias.
    _celdasHumanasPRE(s).forEach(function (h) {
        var rango = hoja.getRange(h.celda);
        if (h.formato) rango.setNumberFormat(h.formato);
        rango.setBackground(PRE_COLOR_CELDA_HUMANA);
        if (!rango.isBlank()) {
            res.humanasRespetadas.push(h.celda);
            return;
        }
        if (h.semilla === null || h.semilla === undefined) return;   // los tres montos quedan vacios
        if (typeof h.semilla === 'string' && h.semilla.charAt(0) === '=') {
            rango.setFormula(h.semilla);
        } else {
            rango.setValue(h.semilla);
        }
        res.humanasSembradas.push(h.celda);
    });

    // 8. Formatos.
    var fmt = _formatosPRE();
    fmt.moneda.forEach(function (r) { hoja.getRange(r).setNumberFormat(PRE_FMT_MONEDA); });
    fmt.porcentaje.forEach(function (r) { hoja.getRange(r).setNumberFormat(PRE_FMT_PORCENTAJE); });
    fmt.mes.forEach(function (r) { hoja.getRange(r).setNumberFormat(PRE_FMT_MES); });
    fmt.entero.forEach(function (r) { hoja.getRange(r).setNumberFormat(PRE_FMT_ENTERO); });
    fmt.titulosBloque.forEach(function (r) {
        hoja.getRange(r).setFontWeight('bold').setBackground(PRE_COLOR_TITULO_BLOQUE);
    });
    fmt.headersTabla.forEach(function (r) {
        hoja.getRange(r).setFontWeight('bold').setBackground(PRE_COLOR_HEADER_TABLA);
    });
    hoja.getRange(PRE_COL_ROTULO + PRE_FILA_TITULO).setFontSize(14);
    fmt.anchos.forEach(function (a) {
        hoja.setColumnWidth(columnLetterToIndex(a.col), a.ancho);
    });

    // 9. Se ocultan el bookkeeping (orden y escalera) y el motor: son infraestructura, no producto.
    // L y M van juntas en una sola llamada porque son contiguas.
    hoja.hideColumns(columnLetterToIndex(PRE_COL_ORDEN),
                     columnLetterToIndex(PRE_COL_ESCALERA) - columnLetterToIndex(PRE_COL_ORDEN) + 1);
    hoja.hideColumns(columnLetterToIndex(PRE_STG.MES),
                     columnLetterToIndex(PRE_STG.AHORRO) - columnLetterToIndex(PRE_STG.MES) + 1);
    hoja.setFrozenRows(0);

    // 10. Rangos con nombre: el contrato estable para quien cablee el Tablero.
    _sincronizarRangosConNombrePRE(ss, hoja);

    // 11. MARCADOR DE COMPLETITUD. Ultima escritura de la corrida, a proposito: es lo unico que
    // afirma "esta hoja quedo entera". Si la corrida se corta antes, N3 sigue diciendo "en curso"
    // y tanto estado como aplicar lo informan en vez de dar la hoja por buena.
    hoja.getRange(PRE_STG.MES + (PRE_FILA_STG_FIRMA + 1))
        .setValue(PRE_MARCA_COMPLETA + ' | v' + PRE_VERSION + ' | ' + sello +
                  ' | separador "' + s + '"');

    return res;
}

/**
 * Deja los rangos con nombre apuntando a las celdas del contrato. Idempotente: si el nombre ya
 * existe se lo elimina y se lo vuelve a crear, para no acumular duplicados.
 */
function _sincronizarRangosConNombrePRE(ss, hoja) {
    var declarados = _rangosConNombrePRE();
    var existentes = ss.getNamedRanges();
    declarados.forEach(function (d) {
        existentes.forEach(function (nr) {
            if (nr.getName() === d.nombre) nr.remove();
        });
        ss.setNamedRange(d.nombre, hoja.getRange(d.celda));
    });
}

/**
 * Relee la zona de presentacion y devuelve las celdas que muestran un error o un estado
 * transitorio. El modulo no afirma sobre lo que no verifico.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @returns {{errores: Array<string>, transitorias: Array<string>}}
 */
function _verificarResultadoPRE(hoja) {
    SpreadsheetApp.flush();
    var colIni = columnLetterToIndex(PRE_COL_ROTULO);
    var colFin = columnLetterToIndex(PRE_COL_ULTIMA_PRESENTACION);
    var mostrados = hoja.getRange(1, colIni, PRE_FILA_ULTIMA_PRESENTACION, colFin - colIni + 1)
                        .getDisplayValues();
    var errores = [];
    var transitorias = [];

    for (var r = 0; r < mostrados.length; r++) {
        for (var c = 0; c < mostrados[r].length; c++) {
            var celda = _letraColumnaPRE(colIni + c) + (r + 1);
            if (_esErrorPRE(mostrados[r][c])) errores.push(celda + ' = ' + mostrados[r][c]);
            else if (_esTransitorioPRE(mostrados[r][c])) transitorias.push(celda);
        }
    }
    return { errores: errores, transitorias: transitorias };
}

/**
 * Relee los controles de VENTANA y dice si el historico que quedo escrito significa algo.
 *
 * decision Franco 2026-08-13: este es el control que faltaba, y es el motivo de que aplicar haya
 * podido devolver ok:true sobre una hoja que mostraba 33,33 ARS de ingreso promedio y 0,00 en los
 * tres montos sugeridos. Los nueve controles de integridad anteriores auditaban el LEDGER, y el
 * ledger estaba impecable: el problema era que la VENTANA de doce meses caia sobre un hueco. Un
 * modulo que escribe formulas tiene que verificar lo que las formulas DEVOLVIERON, no solo que se
 * escribieron sin excepcion.
 *
 * Se reintenta porque Sheets calcula asincronico: leer "Loading..." y declarar un problema seria
 * tan falso como no mirar. Si despues de los reintentos las celdas siguen sin dar un numero, se
 * devuelve `verificable:false` y el llamador NO declara exito -- el modulo no afirma sobre lo que
 * no verifico, ni en una direccion ni en la otra.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @returns {{verificable: boolean, problemas: Array<string>, avisos: Array<string>, datos: Object}}
 */
function _verificarVentanaPRE(hoja) {
    var ventana3 = PRE_VENTANAS[0];
    var lectura = {
        ancla: PRE_COL_VALOR + PRE_FILA_ANCLA,
        base: PRE_COL_ANCLA_BASE + PRE_FILA_ANCLA,
        anclaSinResolver: PRE_COL_VALOR + _filaControlPRE('ancla_sin_resolver'),
        mesesSinActividad: PRE_COL_VALOR + _filaControlPRE('meses_sin_actividad'),
        faltanEnVentanaCorta: PRE_COL_VALOR + _filaControlPRE('faltan_meses_ventana_corta'),
        mesesPromediadosCorta: PRE_COL_VALOR + PRE_FILA_REF_MESES,
        promedioIngresos: PRE_COL_VALOR + PRE_FILA_REF_INGRESOS
    };

    var datos = null;
    for (var intento = 1; intento <= 3; intento++) {
        SpreadsheetApp.flush();
        var leido = {};
        var listo = true;
        for (var clave in lectura) {
            if (!Object.prototype.hasOwnProperty.call(lectura, clave)) continue;
            var celda = hoja.getRange(lectura[clave]);
            var display = String(celda.getDisplayValue() || '');
            leido[clave] = { display: display, valor: celda.getValue() };
            // El ancla y el promedio pueden estar legitimamente vacios; los tres controles no.
            var esControl = (clave !== 'ancla' && clave !== 'base' && clave !== 'promedioIngresos');
            if (_esTransitorioPRE(display) || _esErrorPRE(display) ||
                (esControl && typeof leido[clave].valor !== 'number')) {
                listo = false;
            }
        }
        if (listo) { datos = leido; break; }
        if (intento < 3) Utilities.sleep(1200);
    }

    if (!datos) {
        return {
            verificable: false,
            problemas: ['Los controles de ventana (' + lectura.anclaSinResolver + ', ' +
                        lectura.mesesSinActividad + ', ' + lectura.faltanEnVentanaCorta +
                        ') no devolvieron un numero despues de tres lecturas: la planilla sigue ' +
                        'calculando o alguna formula quedo en error. La hoja esta escrita, pero ' +
                        'NO se pudo comprobar que el historico tenga datos.'],
            avisos: [],
            datos: {}
        };
    }

    var problemas = [];
    var avisos = [];

    if (datos.anclaSinResolver.valor !== 0) {
        problemas.push('El ancla de la ventana no se resolvio: en los ultimos ' +
                       PRE_CANDIDATOS_ANCLA + ' meses no hay NINGUNO con al menos ' +
                       PRE_MIN_FILAS_MES_ACTIVO + ' movimientos (el ultimo mes cargado del ledger ' +
                       'es "' + datos.base.display + '"). El historico y los promedios quedan en ' +
                       'blanco a proposito: no hay comportamiento que medir.');
    } else if (datos.faltanEnVentanaCorta.valor > 0) {
        problemas.push('La ventana de ' + ventana3 + ' meses se apoya en solo ' +
                       datos.mesesPromediadosCorta.display + ' mes(es) con datos (faltan ' +
                       datos.faltanEnVentanaCorta.display + '): los promedios de referencia y los ' +
                       'tres montos "Sugerido" NO representan comportamiento. La hoja quedo bien ' +
                       'escrita; lo que falta son movimientos en el ledger. Ancla: "' +
                       datos.ancla.display + '", ultimo mes cargado: "' + datos.base.display + '".');
    }

    if (datos.mesesSinActividad.valor > 0) {
        avisos.push(datos.mesesSinActividad.display + ' de los ' + PRE_MESES_HISTORICO +
                    ' meses de la ventana no llegan a ' + PRE_MIN_FILAS_MES_ACTIVO +
                    ' movimientos. Se muestran igual en el historico (con su cuenta de filas en la ' +
                    'columna "' + PRE_COL_ULTIMA_VISIBLE + '") pero NO entran en ningun promedio.');
    }
    if (datos.ancla.display && datos.base.display && datos.ancla.display !== datos.base.display) {
        avisos.push('El ancla ("' + datos.ancla.display + '") no coincide con el ultimo mes ' +
                    'cargado ("' + datos.base.display + '"): ese mes tiene filas sueltas que no ' +
                    'alcanzan el minimo. Es el caso que antes tiraba la ventana entera sobre un hueco.');
    }

    return { verificable: true, problemas: problemas, avisos: avisos, datos: datos };
}

// ============================================
// FUNCIONES PUBLICAS (MENU)
// ============================================

/**
 * Informa que hay, que falta y que escribiria aplicar. NO ESCRIBE NADA.
 * Es lo primero que se corre.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}} ok=false si hay bloqueantes
 */
function estadoPresupuesto(yaConLock) {
    return _informarResultadoPRE('Presupuesto - estado', _conLockPRE(yaConLock, function () {
        try {
            var ss = SpreadsheetApp.getActiveSpreadsheet();
            var plan = _planPRE(ss);
            var informe = _redactarPRE(plan, 'PRESUPUESTO - ESTADO');
            Logger.log(informe);
            _alertaPRE('Presupuesto - estado', informe);

            if (plan.problemas.length) {
                return {
                    ok: false,
                    error: 'La planilla no esta en el estado esperado: ' + plan.problemas.length +
                           ' bloqueante(s). aplicarPresupuesto() abortaria sin tocar nada.',
                    detalle: informe,
                    _avisado: true
                };
            }
            // decision Franco 2026-08-13: una hoja escrita pero sin evidencia NO devuelve ok:true.
            // Quien orqueste el cableado del Tablero consulta este ok antes de conectar las celdas,
            // y conectar un presupuesto calculado sobre meses vacios es meterle ceros al motor de
            // reparto de Q20:U24. La distincion es explicita en el texto: la hoja esta bien, lo que
            // falta son datos.
            if (plan.ventana && plan.ventana.problemas.length) {
                return {
                    ok: false,
                    error: 'La hoja "' + SHEETS.PRESUPUESTO + '" esta bien escrita, pero su historico ' +
                           'no alcanza para decidir ni para cablear el Tablero: ' +
                           plan.ventana.problemas.join(' | '),
                    detalle: informe,
                    _avisado: true
                };
            }
            return { ok: true, detalle: informe };
        } catch (err) {
            logError('estadoPresupuesto: fallo la lectura del estado', err);
            var traza = err && err.stack ? String(err.stack).split('\n').slice(0, 6).join('\n') : '(sin stack)';
            return {
                ok: false,
                error: 'No se pudo leer el estado: ' + err.message + '. No se escribio nada.',
                detalle: 'DETALLE TECNICO (copiar y pasar a la sesion de trabajo):\n' + traza
            };
        }
    }));
}

/**
 * Crea la hoja "Presupuesto" si no existe y escribe rotulos, formulas y formatos.
 *
 * Aborta ANTES de tocar una celda si el plan trae cualquier bloqueante. Es idempotente: correrla
 * dos veces deja la hoja igual y NO pisa las seis celdas de Franco.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function aplicarPresupuesto(yaConLock) {
    return _informarResultadoPRE('Presupuesto - NO APLICADO', _conLockPRE(yaConLock, function () {
        // progreso.muto se enciende justo antes de la PRIMERA escritura sobre la hoja viva: es lo
        // que le permite al catch de ultima instancia no mentir en ninguna direccion.
        var progreso = { muto: false, firmada: false, respaldo: null, hojaCreada: false };
        try {
            return _cuerpoAplicarPRE(progreso, yaConLock === true);
        } catch (err) {
            logError('aplicarPresupuesto: excepcion no prevista', err);
            return {
                ok: false,
                error: 'Excepcion no prevista ' + (progreso.muto ? 'DESPUES de' : 'antes de') +
                       ' empezar a escribir: ' + err.message + '. ' + _salidaTrasCorteAplicarPRE(progreso)
            };
        }
    }));
}

/**
 * Dice, con la verdad y sin ceremonias, que camino de salida existe cuando aplicar se corto.
 *
 * decision Franco 2026-08-13: este helper existe porque los mensajes anteriores mentian. Uno
 * decia "quedo creada la hoja vacia: revertirPresupuesto() la da de baja" y revertir se negaba
 * (la hoja no tenia firma); el otro mandaba a "correr estadoPresupuesto() y, si hace falta,
 * revertirPresupuesto()" y ninguno de los dos podia hacer nada. Un mensaje de error que manda a
 * una salida que no existe es peor que no decir nada: convierte un problema recuperable en una
 * media hora buscando el error propio. El texto ahora se deriva del progreso REAL de la corrida.
 *
 * @param {{muto: boolean, firmada: boolean, respaldo: ?string, hojaCreada: boolean}} progreso
 * @returns {string}
 */
function _salidaTrasCorteAplicarPRE(progreso) {
    var partes = [];

    if (progreso.firmada) {
        partes.push('La hoja "' + SHEETS.PRESUPUESTO + '" quedo FIRMADA y marcada "' +
                    PRE_MARCA_EN_CURSO + '" en ' + PRE_STG.MES + (PRE_FILA_STG_FIRMA + 1) +
                    ', asi que el modulo la reconoce como suya. SALIDA: volver a correr ' +
                    'aplicarPresupuesto(), que es idempotente, reescribe todo y no pisa las celdas ' +
                    'de Franco. Si preferis empezar de cero, revertirPresupuesto() la da de baja ' +
                    'despues de congelar un respaldo.');
    } else if (progreso.hojaCreada) {
        partes.push('La hoja "' + SHEETS.PRESUPUESTO + '" quedo creada SIN firma, pero el registro ' +
                    'del devtool anoto que la creo esta corrida y que nunca la completo. SALIDA: ' +
                    'volver a correr aplicarPresupuesto(), que la ADOPTA y la reescribe entera. Si ' +
                    'preferis empezar de cero, revertirPresupuesto() igual la da de baja.');
    } else {
        partes.push('No se creo ninguna hoja y no se modifico ninguna celda.');
    }

    if (progreso.respaldo) {
        partes.push('El respaldo "' + progreso.respaldo + '" quedo congelado y verificado ANTES ' +
                    'de escribir: es una hoja oculta y tiene el contenido previo.');
    }
    partes.push('Antes de nada, correr estadoPresupuesto(): no escribe y dice en que quedo todo.');
    return partes.join(' ');
}

/**
 * Cuerpo de aplicarPresupuesto(). Ya corre bajo el lock y bajo el catch de ultima instancia.
 *
 * @param {{muto: boolean, respaldo: ?string, hojaCreada: boolean}} progreso
 * @param {boolean} conducida true si el llamador ya tenia el lock
 */
function _cuerpoAplicarPRE(progreso, conducida) {
    var ss, plan, informe;
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        plan = _planPRE(ss);
        informe = _redactarPRE(plan, 'PRESUPUESTO - PLAN DE APLICACION');
        Logger.log(informe);
    } catch (err) {
        logError('aplicarPresupuesto: fallo el preflight', err);
        return { ok: false, error: 'Fallo el preflight: ' + err.message + '. No se escribio nada.' };
    }

    if (plan.problemas.length) {
        _alertaPRE('Presupuesto - ABORTADO', informe);
        return {
            ok: false,
            error: 'Abortado por preflight, no se toco ninguna celda. Bloqueantes: ' + plan.problemas.join(' | '),
            detalle: informe,
            _avisado: true
        };
    }

    // --- Confirmacion ---
    var ui = _uiPRE();
    if (ui) {
        var conValor = plan.humanas.filter(function (h) { return !h.vacia; });
        var resp = ui.alert(
            'Presupuesto' + (plan.hoja.existe ? ' (actualizar)' : ' (crear)'),
            (plan.hoja.adoptada
                ? 'RECUPERACION: la hoja "' + SHEETS.PRESUPUESTO + '" quedo a medio escribir por una ' +
                  'corrida anterior que se corto (no llego a firmarse). Se ADOPTA y se reescribe entera.\n'
                : plan.hoja.existe
                ? 'Se van a REESCRIBIR los rotulos, las formulas y los formatos de la hoja "' +
                  SHEETS.PRESUPUESTO + '".\n'
                : 'Se va a CREAR la hoja "' + SHEETS.PRESUPUESTO + '" con ' + plan.capacidad.requerida +
                  ' filas.\n') +
            '\nLas seis celdas de Franco NO se tocan: ' +
            (conValor.length ? conValor.length + ' ya tiene(n) valor y se respetan.'
                             : 'hoy estan vacias y se siembran mes, anio e ingreso esperado.') + '\n' +
            (plan.hoja.existe ? '\nAntes de escribir se congela un respaldo verificado (hoja oculta fechada).\n' : '') +
            '\nCorriste estadoPresupuesto() y leiste el informe? Continuar?',
            ui.ButtonSet.YES_NO
        );
        if (resp !== ui.Button.YES) {
            logInfo('aplicarPresupuesto: cancelado por el usuario.');
            return { ok: false, error: 'Cancelado por el usuario. No se escribio nada.' };
        }
    } else if (conducida !== true) {
        return {
            ok: false,
            error: 'Sin UI para confirmar una operacion que escribe sobre produccion. ' +
                   'Ejecutar desde el menu tidetrack Dev. No se escribio nada.'
        };
    } else {
        logInfo('aplicarPresupuesto: sin UI, ejecutado por un llamador que ya tiene el lock.');
    }

    var sello = _selloPRE();
    var hechos = [];
    var hoja = ss.getSheetByName(SHEETS.PRESUPUESTO);

    // --- RESPALDO ANTES DE MUTAR (solo si hay algo que respaldar) ---
    if (hoja) {
        var resp2 = _respaldarHojaPRE(ss, hoja, sello);
        progreso.respaldo = resp2.nombre;
        hechos.push('respaldo: ' + (resp2.nombre
            ? '"' + resp2.nombre + '" con ' + resp2.celdas + ' celda(s) congeladas y verificadas.'
            : 'la hoja estaba vacia, no habia nada que congelar.'));
        _guardarEstadoPRE({
            sello: sello,
            respaldo: resp2.nombre,
            celdasRespaldadas: resp2.celdas,
            respaldoVerificadoEn: new Date().toISOString()
        });
    } else {
        // La hoja se crea al lado del Tablero: es donde la va a buscar el ojo.
        var indice = ss.getSheets().length;
        var tablero = ss.getSheetByName(NAV_CONFIG.SHEETS.TABLERO);
        if (tablero) indice = tablero.getIndex();   // getIndex es 1-based: esto la deja justo despues
        hoja = ss.insertSheet(SHEETS.PRESUPUESTO, indice);
        invalidarCacheNombresHojas();
        progreso.hojaCreada = true;
        hechos.push('hoja "' + SHEETS.PRESUPUESTO + '" creada' + (tablero ? ' a continuacion del Tablero' : '') + '.');
        // creadaEn / completadaEn son la AUTORIZACION de revertir para una hoja sin firma: si el
        // registro dice que la creo esta migracion y que nunca la completo, darla de baja no
        // destruye trabajo ajeno. Se escribe ANTES del insertSheet... no: inmediatamente despues,
        // que es lo mas cerca que se puede estar sin perder el nombre de la hoja creada.
        _guardarEstadoPRE({
            sello: sello,
            respaldo: null,
            hojaCreada: true,
            creadaEn: new Date().toISOString(),
            completadaEn: null,
            revertidaEn: null
        });
    }

    // --- ESCRITURA ---
    progreso.muto = true;
    var res = _escribirHojaPRE(ss, hoja, plan, sello, progreso);
    hechos.push('escritos ' + res.bloques + ' bloque(s) de presentacion y ' + res.formulasMotor +
                ' formula(s) de motor, con separador "' + res.separador + '".');
    if (res.filasAgregadas) hechos.push('grid ampliado en ' + res.filasAgregadas + ' fila(s) para el motor.');
    hechos.push('celdas de Franco: ' +
                (res.humanasSembradas.length ? res.humanasSembradas.join(', ') + ' sembradas' : 'ninguna sembrada') +
                '; ' +
                (res.humanasRespetadas.length ? res.humanasRespetadas.join(', ') + ' respetadas (ya tenian valor)'
                                              : 'ninguna tenia valor previo') + '.');

    // --- VERIFICACION POSTERIOR ---
    var ver = _verificarResultadoPRE(hoja);
    var ventana = _verificarVentanaPRE(hoja);

    var ahora = new Date().toISOString();
    _guardarEstadoPRE({
        aplicadaEn: ahora,
        completadaEn: ahora,
        revertidaEn: null,
        separador: res.separador,
        hojaCreada: (plan.estadoGuardado && plan.estadoGuardado.hojaCreada === true) || progreso.hojaCreada
    });

    var salida = ['PRESUPUESTO v' + PRE_VERSION + ' APLICADO'];
    salida.push('');
    hechos.forEach(function (h) { salida.push('  ' + h); });
    salida.push('');
    salida.push('CONTRATO (celdas que va a leer el Tablero):');
    _rangosConNombrePRE().forEach(function (r) {
        salida.push('  ' + SHEETS.PRESUPUESTO + '!' + r.celda + '  [' + r.nombre + ']');
    });
    salida.push('');
    if (ver.errores.length) {
        salida.push('CELDAS CON ERROR (' + ver.errores.length + '):');
        ver.errores.slice(0, 15).forEach(function (e) { salida.push('  - ' + e); });
        if (ver.errores.length > 15) salida.push('  [...] ver el resto en la hoja.');
        salida.push('');
    }
    if (ver.transitorias.length) {
        salida.push('Celdas todavia calculando al momento de verificar: ' + ver.transitorias.length +
                    ' (no es un error; volver a mirar la hoja en unos segundos).');
        salida.push('');
    }

    salida.push('VENTANA DEL HISTORICO (mide si los promedios significan algo):');
    if (!ventana.verificable) {
        salida.push('  NO SE PUDO VERIFICAR.');
    } else {
        salida.push('  ancla: ' + (ventana.datos.ancla.display || '(vacia)') +
                    '   ultimo mes cargado: ' + (ventana.datos.base.display || '(vacio)'));
        salida.push('  meses reales que promedia la ventana de ' + PRE_VENTANAS[0] + ': ' +
                    ventana.datos.mesesPromediadosCorta.display + ' de ' + PRE_VENTANAS[0] +
                    '   |   meses flojos en los ' + PRE_MESES_HISTORICO + ' de ventana: ' +
                    ventana.datos.mesesSinActividad.display);
        salida.push('  promedio de ingresos de ' + PRE_VENTANAS[0] + ' meses: ' +
                    (ventana.datos.promedioIngresos.display || '(vacio)'));
    }
    ventana.problemas.forEach(function (p) { salida.push('  PROBLEMA: ' + p); });
    ventana.avisos.forEach(function (a) { salida.push('  aviso: ' + a); });
    salida.push('');

    salida.push('Siguiente paso: abrir la hoja, mirar el historico, y escribir los tres montos en ' +
                PRE_COL_VALOR + PRE_FILA_PRESUP_GF + ':' + PRE_COL_VALOR + PRE_FILA_PRESUP_AHORRO + '.');

    var texto = salida.join('\n');
    Logger.log(texto);

    if (ver.errores.length) {
        _alertaPRE('Presupuesto aplicado CON ERRORES', texto);
        return {
            ok: false,
            error: 'Aplicado, pero ' + ver.errores.length + ' celda(s) quedaron en error. NO se puede dar ' +
                   'por bueno el resultado hasta revisarlas: ' + ver.errores.slice(0, 5).join(' | '),
            detalle: texto,
            _avisado: true
        };
    }

    // decision Franco 2026-08-13: una hoja escrita sin errores pero sin ventana NO es un exito.
    // Es la diferencia entre "las formulas se escribieron" y "las formulas devolvieron algo": la
    // version anterior solo comprobaba lo primero, y por eso devolvia ok:true sobre una hoja que
    // mostraba 33,33 ARS y tres ceros. El ok:false de aca no dice "la hoja esta rota" -- la hoja
    // esta impecable -- dice "no la uses todavia para decidir". La hoja se DEJA escrita: no hay
    // nada que revertir y volver a correr aplicar cuando entren los movimientos la actualiza.
    if (!ventana.verificable || ventana.problemas.length) {
        _alertaPRE('Presupuesto aplicado - SIN EVIDENCIA SUFICIENTE', texto);
        return {
            ok: false,
            error: 'La hoja quedo escrita y sin celdas en error, pero el historico no alcanza para ' +
                   'decidir: ' + ventana.problemas.join(' | ') +
                   ' NO hay nada que revertir: cuando entren los movimientos al ledger, volver a ' +
                   'correr aplicarPresupuesto() (o simplemente estadoPresupuesto() para mirar).',
            detalle: texto,
            _avisado: true
        };
    }

    _alertaPRE('Presupuesto aplicado', texto);
    logSuccess('aplicarPresupuesto: completado sin celdas en error y con ventana verificada.');
    return { ok: true, detalle: texto };
}

/**
 * Da de baja la hoja "Presupuesto", congelando antes un respaldo verificado.
 *
 * El respaldo NO es opcional ni ceremonial: para cuando se revierte, la hoja puede tener los
 * montos que Franco escribio a mano, y esos no los regenera ningun codigo. Se congelan primero
 * y despues se borra.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @param {{recuperarSinFirma?: boolean}} [opciones] solo para llamadores headless: autoriza dar de
 *        baja una hoja SIN firma cuando el registro del devtool dice que la creo una corrida
 *        propia que nunca se completo. Desde el menu no hace falta: ahi la autoriza Franco.
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function revertirPresupuesto(yaConLock, opciones) {
    return _informarResultadoPRE('Presupuesto - NO REVERTIDO', _conLockPRE(yaConLock, function () {
        var progreso = { muto: false, respaldo: null };
        try {
            return _cuerpoRevertirPRE(progreso, yaConLock === true, opciones || {});
        } catch (err) {
            logError('revertirPresupuesto: excepcion no prevista', err);
            if (!progreso.muto) {
                return {
                    ok: false,
                    error: 'Excepcion no prevista antes de dar de baja la hoja: ' + err.message +
                           '. No se borro nada.'
                };
            }
            return {
                ok: false,
                error: 'Excepcion no prevista DESPUES de haber empezado: ' + err.message +
                       '. NO SE PUDO CONFIRMAR el estado' +
                       (progreso.respaldo ? '; el respaldo "' + progreso.respaldo + '" sigue intacto' : '') + '.'
            };
        }
    }));
}

/**
 * Cuerpo de revertirPresupuesto(). Ya corre bajo el lock y bajo el catch de ultima instancia.
 *
 * @param {{muto: boolean, respaldo: ?string}} progreso
 * @param {boolean} conducida true si el llamador ya tenia el lock
 * @param {{recuperarSinFirma?: boolean}} opciones
 */
function _cuerpoRevertirPRE(progreso, conducida, opciones) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var estado = _leerEstadoPRE();

    if (estado._corrupto) {
        return {
            ok: false,
            error: 'El registro del devtool en DocumentProperties es ilegible, asi que no se sabe que ' +
                   'corrida se estaria revirtiendo. NO se borra nada a ciegas. Fragmento crudo: ' +
                   estado._crudo + '. Revisar a mano.'
        };
    }

    var hoja = ss.getSheetByName(SHEETS.PRESUPUESTO);
    if (!hoja) {
        return {
            ok: false,
            error: 'No existe la hoja "' + SHEETS.PRESUPUESTO + '": no hay nada que revertir. ' +
                   'Los respaldos, si los hay, son las hojas ocultas "' + PRE_RESPALDO_PREFIJO + '*".'
        };
    }

    // --- AUTORIZACION ---
    //
    // decision Franco 2026-08-13: la firma sigue siendo la autorizacion normal, pero YA NO es la
    // unica. Antes, una hoja sin firma era intocable sin excepciones, y eso cerraba la unica
    // puerta de salida cuando aplicar se cortaba antes de firmar: aplicar se negaba a tocar una
    // hoja ajena, revertir se negaba a borrar una hoja ajena, y la hoja quedaba en el limbo. La
    // informacion para desatarlo ya existia y no se usaba: el propio devtool anota, al crear la
    // hoja, que la creo el (hojaCreada + creadaEn) y si llego a completarla (completadaEn).
    // Se autoriza la baja sin firma UNICAMENTE cuando ese registro dice las tres cosas: la creo
    // este devtool, la creo en una corrida que nunca completo, y esa corrida no fue revertida.
    // Si la hoja se completo alguna vez y hoy no tiene firma, alguien la edito a mano y el
    // registro ya no describe lo que hay: ahi se sigue sin tocar.
    // El riesgo de la excepcion esta acotado por el respaldo, que se congela y se VERIFICA antes
    // de borrar: la baja no destruye, mueve.
    var firma = String(hoja.getRange(PRE_STG.MES + PRE_FILA_STG_FIRMA).getDisplayValue() || '').trim();
    var sinFirma = (firma !== PRE_FIRMA);
    var creadaYNoCompletada = (estado.hojaCreada === true) && !!estado.creadaEn &&
                              (!estado.completadaEn || String(estado.completadaEn) < String(estado.creadaEn));

    if (sinFirma && !creadaYNoCompletada) {
        return {
            ok: false,
            error: 'La hoja "' + SHEETS.PRESUPUESTO + '" NO lleva la firma de este devtool (' +
                   PRE_STG.MES + PRE_FILA_STG_FIRMA + ' dice "' + firma + '") y el registro del ' +
                   'devtool tampoco dice que la haya creado una corrida propia sin terminar' +
                   (estado.completadaEn ? ' (figura completada el ' + estado.completadaEn + ')' : '') +
                   '. No se borra: darla de baja destruiria trabajo que este modulo no escribio. ' +
                   'Si es una hoja vieja que ya no sirve, renombrarla o borrarla a mano.'
        };
    }

    var humanasConValor = _celdasHumanasPRE(',').filter(function (h) {
        return !hoja.getRange(h.celda).isBlank();
    });

    var textoRecuperacion = sinFirma
        ? 'RECUPERACION: esta hoja NO tiene la firma del devtool, pero el registro dice que la ' +
          'creo la corrida del ' + estado.creadaEn + ' y que esa corrida nunca se completo (se ' +
          'corto antes de terminar de escribir). Por eso se puede dar de baja.\n\n' +
          'Alternativa sin borrar nada: correr aplicarPresupuesto(), que la reescribe entera.\n\n'
        : '';

    var ui = _uiPRE();
    if (ui) {
        var resp = ui.alert(
            'Revertir el Presupuesto' + (sinFirma ? ' (recuperacion)' : ''),
            textoRecuperacion +
            'Se va a DAR DE BAJA la hoja "' + SHEETS.PRESUPUESTO + '".\n\n' +
            'Antes se congela un respaldo verificado (hoja oculta fechada) con todo su contenido' +
            (humanasConValor.length
                ? ', incluidas las ' + humanasConValor.length + ' celda(s) que escribio Franco.'
                : '.') + '\n\n' +
            (estado.revertidaEn ? 'AVISO: ya figura una reversion el ' + estado.revertidaEn + '.\n\n' : '') +
            'Continuar?',
            ui.ButtonSet.YES_NO
        );
        if (resp !== ui.Button.YES) return { ok: false, error: 'Cancelado por el usuario. No se borro nada.' };
    } else if (conducida !== true) {
        return { ok: false, error: 'Sin UI para confirmar. Ejecutar desde el menu tidetrack Dev. No se borro nada.' };
    } else if (sinFirma && opciones.recuperarSinFirma !== true) {
        // Sin UI, la excepcion no se toma sola: el llamador headless la pide por escrito.
        return {
            ok: false,
            error: 'La hoja "' + SHEETS.PRESUPUESTO + '" no tiene firma y se esta corriendo sin UI. ' +
                   'El registro autoriza la baja (creada el ' + estado.creadaEn + ' por una corrida ' +
                   'que nunca se completo), pero un llamador headless tiene que pedirlo explicito: ' +
                   'revertirPresupuesto(true, { recuperarSinFirma: true }). No se borro nada.'
        };
    }

    var sello = _selloPRE();
    var resp3 = _respaldarHojaPRE(ss, hoja, sello);
    progreso.respaldo = resp3.nombre;

    // Los rangos con nombre se van con la hoja: si quedaran, apuntarian a la nada.
    var declarados = _rangosConNombrePRE();
    var nombresBorrados = 0;
    ss.getNamedRanges().forEach(function (nr) {
        for (var i = 0; i < declarados.length; i++) {
            if (nr.getName() === declarados[i].nombre) { nr.remove(); nombresBorrados++; return; }
        }
    });

    progreso.muto = true;
    ss.deleteSheet(hoja);
    invalidarCacheNombresHojas();

    _guardarEstadoPRE({
        revertidaEn: new Date().toISOString(),
        respaldoReversion: resp3.nombre,
        hojaCreada: false,
        completadaEn: null
    });

    var texto = ['PRESUPUESTO v' + PRE_VERSION + ' REVERTIDO' + (sinFirma ? ' (recuperacion)' : ''), '',
                 (sinFirma ? '  la hoja no tenia firma: se dio de baja porque el registro del devtool ' +
                             'decia que la creo la corrida del ' + estado.creadaEn + ' y que nunca ' +
                             'se completo.\n' : '') +
                 '  respaldo congelado: ' + (resp3.nombre ? '"' + resp3.nombre + '" (' + resp3.celdas + ' celdas)'
                                                          : 'la hoja estaba vacia'),
                 '  rangos con nombre eliminados: ' + nombresBorrados,
                 '  hoja "' + SHEETS.PRESUPUESTO + '" dada de baja.', '',
                 'Los montos que habia escrito Franco viven en el respaldo: es una hoja oculta, se ve ' +
                 'con Ver > Hojas ocultas.'].join('\n');
    Logger.log(texto);
    _alertaPRE('Presupuesto revertido', texto);
    logSuccess('revertirPresupuesto: completado.');
    return { ok: true, detalle: texto };
}
