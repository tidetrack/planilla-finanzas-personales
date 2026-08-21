/**
 * DEVTOOL_InicioPresupuesto.js
 * Llena el bloque "Presupuesto del Mes." de la hoja Inicio y repara los tres deltas del resumen.
 *
 * [CONCEPTO DE NEGOCIO]
 * Inicio es la portada: la hoja donde Franco mira su situacion sin navegar. El bloque
 * "Presupuesto del Mes." (C17:H22) tenia los rotulos escritos y la zona de numeros VACIA
 * (D19:H22, medido en el gemelo el 2026-08-20). Este modulo la llena con cuatro columnas:
 *
 *   D  PRESUPUESTO  lo proyectado para el mes, leido de la BD de Proyeccion (igual que
 *                   Tablero!N9/N10/N11, adaptado a los selectores de Inicio).
 *   E  REALIDAD     lo que efectivamente paso, leido del derrame del motor de la propia hoja
 *                   (T:AF, que ya es Registros filtrado por mes con los TC congelados).
 *   F  CONSUMO      una barra SPARKLINE de E/D acotada 0..1, con el semaforo de la planilla
 *                   anterior: verde por debajo del 50%, naranja hasta el 80%, rojo arriba.
 *   G  DISTRIBUCION el reparto de la plata disponible entre las tres categorias, el mismo
 *                   calculo que Tablero!O23:O25 (mismos tres regimenes, mismo invariante).
 *
 * LA IDENTIDAD DEL PRESUPUESTO (decision Franco 2026-08-20, costo tres versiones aprenderla):
 * en cualquier bloque de asignacion, Ingresos = Fijos + Variables + Capacidad de
 * Capitalizacion. La Capacidad es SIEMPRE el residuo =Ing-Fij-Var, nunca una medicion
 * independiente. Por eso D22 y E22 son restas de tres celdas y nada mas: no hay forma de que
 * no cierren. La verificacion post-escritura relee los VALORES y exige la identidad al centavo.
 *
 * Ademas, los tres deltas del resumen -- y desde v0.37.0, tambien CUANTO:
 *   F10  DELTA CAPITAL   tendencia de los cierres de capital en la ventana de 6 meses que
 *                        CIERRA en el mes del selector, MAS el promedio de esa ventana Y cuanto
 *                        capital se inyecto o retiro en el mes elegido (referencia a E22: ver
 *                        "EL TEXTO DE LOS TRES DELTAS" mas abajo).
 *   C15  DELTA INGRESOS  tendencia de los ingresos en la ventana de 6 meses que cierra en el mes
 *                        del selector, mas el ingreso promedio de esa ventana.
 *   F15  DELTA EGRESOS   idem egresos.
 * (C15 y F15 ya REEMPLAZARON en v0.32.2/v0.33.0 unas formulas rotas que mostraban "0%" siempre
 * por interseccion implicita; ver DEVTOOL_FormulerioV0111, defecto quinto.)
 *
 * decision Franco 2026-08-21: "podes ponerme ingresos/egresos y capitalizacion promedio, para
 * entender valores y por que estamos para arriba o para abajo en el mes... concatenado en los
 * deltas". Y sobre F10 en particular: "cuanto capital se inyecto o retiro en el periodo de
 * analisis". "Capitalizacion" en el pedido es el STOCK (capital acumulado, F8/F10), no el flujo
 * mensual hacia Ahorros/Inversiones (E22): no hay tarjeta nueva, los tres deltas siguen siendo
 * F10/C15/F15.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: preflight por ROTULO que aborta ante la minima discrepancia,
 * respaldo congelado y verificado antes de mutar, verificacion del VALOR resultante (no solo
 * del texto), reversion completa. Cicatriz 5: comprobar que escribiste lo que querias escribir
 * no es comprobar que funciona.
 *
 * DECISIONES DE GEOMETRIA Y FUENTE (todas medidas en el gemelo el 2026-08-20):
 * - Los selectores de Inicio son I2 (mes), I3 (anio) e I4 (moneda). G2/G4 son solo rotulos.
 *   El brief historico decia G4: MEDIDO es I4. Toda formula nueva usa I2/I3/I4 y JAMAS los
 *   selectores del Tablero (N2/N3/N4): son independientes y hoy coinciden por casualidad.
 * - El mes es texto en espanol: se resuelve con MATCH+SPLIT de la lista castellana, nunca con
 *   DATEVALUE (dependiente de locale).
 * - La Proyeccion no tiene TC congelados (J:M vacias): el PRESUPUESTO convierte con
 *   TIDETRACK_*() en vivo, igual que Tablero!N9. La REALIDAD si los tiene: usa la columna AF
 *   del motor, que ya viene convertida con los TC congelados de cada fila.
 * - decision Franco 2026-08-20: la liquidez del reparto (columna G) es $C$8, el "Saldo Actual"
 *   de la misma hoja, que ya es el saldo cotidiano convertido a la moneda de I4. Dos numeros
 *   distintos para la misma cosa en la misma pantalla seria una mentira; el preflight exige
 *   que C8 tenga formula antes de escribir nada que la lea.
 * - decision Franco 2026-08-20: G19 (fila Ingresos) queda vacia via ="". Los ingresos son la
 *   FUENTE de la plata disponible, no un destino: no reciben distribucion.
 * - decision Franco 2026-08-20: los umbrales del semaforo se escriben 1/2 y 4/5 en vez de
 *   0,5 y 0,8. Un literal decimal con coma es ambiguo dentro de una formula con separador ";"
 *   y uno con punto depende del locale; una fraccion no depende de nada.
 * - decision Franco 2026-08-21 (SUPERA la de 2026-08-20): la ventana de F10 ANCLA AL SELECTOR de
 *   Inicio ($I$2/$I$3), igual que C15/F15 -- no a TODAY(). La razon original ("el capital es un
 *   stock, no se filtra por periodo") seguia siendo cierta pero dejaba los tres deltas
 *   DESINCRONIZADOS: con el selector en un mes pasado, F10 mostraba la tendencia de HOY mientras
 *   C15/F15 mostraban la de ese mes -- medio renglon reaccionando al filtro y el otro medio no,
 *   sin que el numero lo dijera. El capital al cierre de cada mes de la ventana aplica la MISMA
 *   regla del ultimo "Inicio Mes" por medio, con el corte acotado a la fecha de cierre. Los tres
 *   deltas son COCIENTES: se calculan en ARS (F10 con TIDETRACK en vivo, C15/F15 con los TC
 *   congelados de cada fila, patron de Inicio!AF8) y el resultado no depende del selector de
 *   moneda. Coincide con TODAY() en cualquier corrida sobre el mes en curso (es lo que pasa hoy,
 *   2026-08-21, selector en Agosto) y solo cambia de verdad al mirar un mes pasado.
 * - OJO, esto NO se corrige: F8 (Capital Acumulado, DEVTOOL_StockYFlujo, fuera de jurisdiccion de
 *   este modulo) sigue anclado a HOY. Si el selector se mueve a un mes pasado, F8 sigue hablando
 *   de HOY mientras F10 pasa a hablar del mes elegido -- dos relojes distintos en la misma
 *   pantalla. Reportado a Franco, no resuelto aca.
 * - C8:E9 y F8:H9 NO se tocan: Franco pidio revisarlas, no reescribirlas. El preflight verifica
 *   que tengan formula y el dialogo reporta su estado. Sus formulas son de DEVTOOL_StockYFlujo.
 *
 * v0.38.1 (2026-08-21) -- LA CORRIDA DE v0.37.0 SALIO MAL EN LA PLANILLA, revertida con
 * revertirInicioPresupuesto(), y se arreglaron los dos defectos:
 *   1. LOS PATRONES DE TEXT() ESTABAN AL REVES. IP_PATRON_PORCENTAJE/IP_PATRON_MONEDA pasan de
 *      '0,0%'/'$#.##0,00' (coma decimal) a '0.0%'/'$ #,##0.00' (canonico, punto decimal). El
 *      comentario que justificaba la coma ("TEXT() SI es sensible al locale") era FALSO -- ver
 *      la medicion literal en "EL TEXTO DE LOS TRES DELTAS" mas abajo. Es la TERCERA vez en el
 *      mismo dia que una afirmacion sobre locale sin medir cuesta un bug (v0.32.2, v0.33.0).
 *   2. LAS AUXILIARES (AV:AW) QUEDABAN VISIBLES. Ahora aplicarInicioPresupuesto() las oculta
 *      (_ocultarAuxiliaresIp, mismo tratamiento que los otros dos motores de la hoja) y
 *      revertirInicioPresupuesto() las destapa solo si fue este modulo el que las oculto.
 *
 * QUE NO HACE
 * 1. NO toca el ledger, la Proyeccion, el Plan de Cuentas ni ninguna celda del Tablero.
 * 2. NO cambia rotulos ni selectores: son de Franco.
 * 3. NO escribe C8 ni F8 (celdas de DEVTOOL_StockYFlujo) ni ninguna celda de otro modulo.
 *
 * Contrato de las tres publicas: { ok: boolean, detalle?: string, error?: string }.
 *   estadoInicioPresupuesto()    -> solo lectura, dice que cambiaria. Se corre PRIMERO.
 *   aplicarInicioPresupuesto()   -> preflight + respaldo + escritura + verificacion del VALOR.
 *   revertirInicioPresupuesto()  -> restaura formulas, valores y formatos previos.
 *
 * Reusa helpers probados: _respaldarFormulerio, _leerRespaldoFormulerio, _errorDeCelda,
 * _normalizarRotulo, _rotulosCompatibles, _leerHeaderLedger (DEVTOOL_FormulerioV0111);
 * _refHoja, _colLedger, _colPlan, _condTipoSyf, _canonizarFormula, _verificarEscrituraSyf
 * (DEVTOOL_StockYFlujo); _formulaHaciaRiqueza, CAP_SELECTORES (DEVTOOL_Capitalizacion) -- para
 * F10 no se llama de nuevo: se REFERENCIA la celda E22 que ya la usa (ver mas abajo).
 *
 * @see docs/permanente/FUNCIONALIDADES.md
 * @version 0.38.1
 * @since 2026-08-20
 * @lastModified 2026-08-21
 */

// ============================================
// CONSTANTES DE GEOMETRIA (medidas en vivo el 2026-08-20, verificadas por rotulo)
// ============================================

/**
 * Selectores de la hoja Inicio. LA MONEDA VIVE EN I4, NO EN G4: G2 y G4 son rotulos.
 * El preflight verifica los rotulos Y que los valores sean un mes/anio/moneda validos.
 */
const IP_SELECTORES = {
    mes: 'I2', anio: 'I3', moneda: 'I4',
    rotuloPeriodo: { celda: 'G2', esperado: 'Periodo de Analisis' },
    rotuloMoneda: { celda: 'G4', esperado: 'Moneda' }
};

/** La lista castellana que ya usan T8/AH8: el mes del selector se resuelve contra ella. */
const IP_MESES = 'Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre';

/**
 * Bloque "Presupuesto del Mes." (C17:H22). Los rotulos son de Franco y deciden si se escribe:
 * un corrimiento se detecta comparando el rotulo, no la posicion. G19:H22 son celdas
 * combinadas por fila: se escribe SOLO en las anclas G.
 */
/**
 * Los dos sentidos posibles del semaforo de consumo (ver IP_BLOQUE.filas).
 * Declarados ANTES de IP_BLOQUE a proposito: son const de nivel superior en el MISMO archivo, y
 * IP_BLOQUE las evalua al cargar. Invertir el orden tira ReferenceError al abrir la planilla.
 */
const IP_MENOS_ES_MEJOR = 'menos_es_mejor';
const IP_MAS_ES_MEJOR = 'mas_es_mejor';

const IP_BLOQUE = {
    titulo: { celda: 'C17', esperado: 'Presupuesto del Mes' },
    headers: [
        { celda: 'C18', esperado: 'Composicion' },
        { celda: 'D18', esperado: 'Presupuesto' },
        { celda: 'E18', esperado: 'Realidad' },
        { celda: 'F18', esperado: 'Consumo del Presupuesto' },
        { celda: 'G18', esperado: 'Distribucion de fondos disponibles' }
    ],
    colRotulo: 'C', colPresupuesto: 'D', colRealidad: 'E', colConsumo: 'F', colDistribucion: 'G',
    // El campo `sentido` decide para que lado corre el semaforo de la barra de consumo.
    // decision Franco 2026-08-21: en Capacidad de Capitalizacion la barra tiene que dar VERDE a
    // partir del 80% de cumplimiento. No es un ajuste de umbral: es que ahi la escala se DA VUELTA.
    // Gastar el 100% de lo presupuestado en Gastos Variables es agotar el presupuesto (rojo);
    // capitalizar el 100% de lo planificado es cumplir el plan (verde). Son dos lecturas opuestas
    // del mismo numero, y un solo semaforo no puede servir a las dos.
    //
    // Ingresos entra en el mismo grupo por la misma razon, no por analogia: cobrar MAS de lo
    // presupuestado es una buena noticia, y hoy se pinta de rojo (se ve en la corrida del
    // 2026-08-21: 1.645.687 reales contra 1.546.662 presupuestados, barra roja al tope).
    filas: {
        ingresos:       { fila: 19, rotulo: 'Ingresos',                   sentido: IP_MAS_ES_MEJOR },
        fijos:          { fila: 20, rotulo: 'Gastos Fijos',               sentido: IP_MENOS_ES_MEJOR },
        variables:      { fila: 21, rotulo: 'Gastos Variables',           sentido: IP_MENOS_ES_MEJOR },
        capitalizacion: { fila: 22, rotulo: 'Capacidad de Capitalizacion', sentido: IP_MAS_ES_MEJOR }
    }
};

/**
 * El resumen de la portada. C8 y F8 son de DEVTOOL_StockYFlujo: se VERIFICAN (que tengan
 * formula) y se reportan, jamas se escriben. F10, C15 y F15 si son de este modulo.
 */
const IP_RESUMEN = {
    saldo:        { celda: 'C8',  rotulo: { celda: 'C7',  esperado: 'Saldo Actual' } },
    capital:      { celda: 'F8',  rotulo: { celda: 'F7',  esperado: 'Capital Acumulado' } },
    // El `sentido` decide de que color se pinta la flecha, y es lo que estaba mal en la hoja.
    // La flecha dice la DIRECCION (subio / bajo) y el color dice si eso es buena o mala noticia,
    // que no es lo mismo: un egreso que sube tambien es una flecha para arriba, y es mala.
    // decision Franco 2026-08-21.
    deltaCapital:  { celda: 'F10', sentido: IP_MAS_ES_MEJOR, nota: 'Tendencia del capital a 6 meses' },
    deltaIngresos: { celda: 'C15', sentido: IP_MAS_ES_MEJOR, rotulo: { celda: 'C12', esperado: 'Ingresos' }, nota: 'Tendencia de los ingresos a 6 meses' },
    deltaEgresos:  { celda: 'F15', sentido: IP_MENOS_ES_MEJOR, rotulo: { celda: 'F12', esperado: 'Egresos' }, nota: 'Tendencia de los egresos a 6 meses' }
};

/** Las tres celdas de delta, en orden. Unica fuente: IP_RESUMEN. */
const IP_CLAVES_DELTA = ['deltaCapital', 'deltaIngresos', 'deltaEgresos'];

/**
 * LAS CELDAS AUXILIARES DE LOS TRES DELTAS -- numeros de verdad, en la trastienda de la hoja.
 *
 * Desde v0.37.0 las celdas visibles (F10/C15/F15) son TEXTO (ver "EL TEXTO DE LOS TRES DELTAS"
 * mas abajo), y las reglas de color TIENEN que seguir siendo numericas. La serie de 6 meses que
 * arma cada delta ademas es CARA (un MAP con un FILTER por mes, y en Capital ademas un FILTER
 * por cada medio DENTRO de cada mes): calcularla dos veces -- una para la tendencia y otra para
 * el promedio -- duplicaria ese costo. Por eso cada delta escribe UNA sola formula pesada, en la
 * celda de aca abajo, y esa formula devuelve DOS numeros con HSTACK(tendencia; promedio): la
 * tendencia queda en la celda ancla y el promedio DERRAMA una columna a la derecha, por
 * construccion -- no hay forma de duplicar el calculo sin reescribir el HSTACK entero. La celda
 * visible y la regla de color solo LEEN esos dos numeros, nunca recalculan la serie.
 *
 * DONDE: medido contra el gemelo el 2026-08-21 (docs/permanente/celdas.tsv, refrescado antes de
 * medir con el webhook de sync). El motor de la hoja ya usa T:AF (mes en curso, filas 8 en
 * adelante) y AH:AT (mes anterior, filas 8 en adelante), con AG como columna en blanco entre los
 * dos -- ese blanco es angosto (UNA sola columna) y esta encajado entre dos motores que
 * spillean: no es lugar para escribir a mano, una fila con mas transacciones de las de hoy lo
 * invadiria. Un barrido columna por columna del gemelo confirma que AU en adelante no tiene
 * NINGUNA celda con contenido en toda la hoja Inicio, asi que las auxiliares van ahi: AU queda
 * en blanco como separador del ultimo motor (misma convencion que el propio AG) y AV/AW alojan
 * las tres auxiliares, una por fila (8=capital, 9=ingresos, 10=egresos, calcando las filas del
 * resumen visible).
 *
 * QUEDAN OCULTAS, igual que los otros dos motores. Bug reportado en la corrida de v0.37.0: AV/AW
 * se veian como numeros sueltos a la derecha del lienzo de Inicio, rompiendo el diseno. Medido
 * el 2026-08-21 con una funcion de diagnostico temporal (_DIAG_medirPatronYAuxIp, ya retirada
 * del codigo): T:U, AF:AI y AH:AT (los dos motores existentes) estan TODOS con
 * isColumnHiddenByUser()=true, mientras que AV/AW daban false -- ahi estaba el agujero.
 * _ocultarAuxiliaresIp() les da el mismo tratamiento (hoja.hideColumns), aplicarIp() la llama
 * despues de escribir y verificar, y revertirIp() la deshace SOLO si este modulo fue quien las
 * oculto (si Franco ya las tenia ocultas por su cuenta, revertir no las destapa).
 */
const IP_AUX = {
    deltaCapital:  { tendencia: 'AV8' },
    deltaIngresos: { tendencia: 'AV9' },
    deltaEgresos:  { tendencia: 'AV10' }
};

/**
 * La celda de promedio de un delta: una columna a la derecha de su tendencia, que es DONDE
 * DERRAMA el HSTACK de _tendenciaYPromedioIp. Se DERIVA en vez de declararse aparte a proposito:
 * declarar las dos por separado permitiria que quedaran desalineadas (un typo en IP_AUX) sin que
 * nada lo note hasta que alguien leyera un promedio que en realidad es la tendencia de otra fila.
 */
function _celdaPromedioIp(celdaTendencia) {
    const m = String(celdaTendencia).match(/^([A-Z]+)([0-9]+)$/);
    return columnIndexToLetter(columnLetterToIndex(m[1]) + 1) + m[2];
}

/**
 * La columna de las auxiliares (hoy 'AV'), DERIVADA de IP_AUX.deltaCapital.tendencia -- nunca
 * hardcodeada: si algun dia la trastienda se corre de columna, esta funcion la sigue sola. El
 * promedio siempre cae una columna a la derecha (_celdaPromedioIp), asi que ocultar DOS columnas
 * a partir de esta alcanza para tapar las seis celdas (tres tendencias + tres promedios).
 */
function _colAuxiliaresIp() {
    return String(IP_AUX.deltaCapital.tendencia).match(/^[A-Z]+/)[0];
}

/**
 * Oculta las dos columnas de las auxiliares (tendencia + promedio derramado), el MISMO
 * tratamiento que ya reciben los otros dos motores de la hoja (T:AG, AH:AT -- medidos ocultos el
 * 2026-08-21 con la misma funcion de diagnostico temporal, ya retirada). Sin esto, los numeros
 * de trastienda quedan a la vista a la derecha del lienzo: el bug reportado en la corrida de
 * v0.37.0. Idempotente: ocultar una columna que ya esta oculta no hace nada.
 */
function _ocultarAuxiliaresIp(hoja) {
    hoja.hideColumns(columnLetterToIndex(_colAuxiliaresIp()), 2);
}

/** Muestra de nuevo las dos columnas de las auxiliares (usado SOLO al revertir). */
function _mostrarAuxiliaresIp(hoja) {
    hoja.showColumns(columnLetterToIndex(_colAuxiliaresIp()), 2);
}

/**
 * El motor de la hoja: T8 derrama Registros del mes (12 columnas espejo de B:M) y AF8 es la
 * conversion con TC congelados. Las letras de las columnas consumidas NO se hardcodean: se
 * derivan de RANGES.REGISTROS por offset, y el preflight las verifica contra los rotulos vivos.
 */
const IP_MOTOR = { colBloque: 'T', colValor: 'AF', filaHeader: 7, filaDatos: 8 };

/**
 * EL SEMAFORO, con la paleta de los formatos condicionales del Tablero.
 *
 * decision Franco 2026-08-21: los colores propios que traia el modulo (#a9bca1 / #db9940 /
 * #da8b7b, heredados de la planilla anterior) salen. La hoja ya tiene UN lenguaje de color para
 * verde/amarillo/rojo -- el de los formatos condicionales del Tablero -- y dos paletas parecidas
 * pero distintas para la misma idea se leen como si dijeran cosas distintas.
 *
 * Cada nivel es un PAR: un tono saturado (la tinta) y uno palido (el fondo), tal como se usan
 * juntos en el Tablero. Las barras SPARKLINE pintan con el SATURADO porque son tinta sobre el
 * blanco de la hoja: el tono palido, que existe para ir DETRAS de un texto, sobre blanco
 * practicamente no se ve. Los palidos quedan declarados igual para que quien pinte fondos no
 * tenga que volver a buscar los hex.
 */
const IP_COLOR_VERDE = '#356854';
const IP_COLOR_NARANJA = '#ffb300';
const IP_COLOR_ROJO = '#c93232';
const IP_FONDO_VERDE = '#e6f4ea';
const IP_FONDO_NARANJA = '#fef7e0';
const IP_FONDO_ROJO = '#fce8e6';

/**
 * Largo de la ventana de los tres deltas, en meses.
 *
 * decision Franco 2026-08-21: los deltas NO son un mes contra la media de los seis previos --
 * son la TENDENCIA de la ventana de seis meses. La diferencia no es cosmetica: comparar un mes
 * contra una media mide cuanto se desvio ESE mes (un dato ruidoso, que salta con cualquier
 * sueldo que cae un dia antes o despues), mientras que la tendencia mide para donde viene
 * yendo la serie, que es lo que Franco quiere ver -- "crecimiento de tendencias de ingresos /
 * egresos", y lo mismo para el capital acumulado.
 */
const IP_MESES_TENDENCIA = 6;

/**
 * El sufijo de los tres deltas: dice contra que ventana se compara la tendencia.
 *
 * decision Franco 2026-08-21: "-10,4%" solo no se entiende -- no dice contra que se compara.
 * Se deriva de IP_MESES_TENDENCIA para que la etiqueta no pueda desfasarse de la ventana que
 * realmente se promedia.
 */
const IP_SUFIJO_DELTA = ' de tendencia a ' + IP_MESES_TENDENCIA + ' meses';
/**
 * LAS FLECHAS DE TICKER. decision Franco 2026-08-21: "seria ideal colocar flechitas de
 * sube-baja como en los tickers financieros".
 *
 * Son simbolos geometricos Unicode (U+25B2 / U+25BC / U+2013), NO emojis: se dibujan con la
 * fuente del texto, no con la de color, y son la notacion estandar de cualquier ticker. La
 * regla 6 del contrato prohibe emojis, no tipografia.
 *
 * LA FLECHA REEMPLAZA AL SIGNO, no lo acompana. En la seccion negativa de un patron de numero
 * Sheets muestra el VALOR ABSOLUTO salvo que uno escriba el "-" a mano; aca no se escribe, asi
 * que -0,527 se lee "BAJA 52,7%". Ademas de ser como se leen los tickers, degrada bien: si
 * algun dia el color fallara, la flecha sola sigue diciendo para donde fue.
 */
const IP_FLECHA_SUBE = '\u25B2';    // triangulo lleno hacia arriba
const IP_FLECHA_BAJA = '\u25BC';    // triangulo lleno hacia abajo
const IP_FLECHA_PLANA = '\u2013';   // raya: la tendencia no se movio

/**
 * EL TEXTO DE LOS TRES DELTAS -- desde v0.37.0 ya NO es un NUMERO con formato: es TEXTO armado
 * por formula.
 *
 * decision Franco 2026-08-21: "podes ponerme ingresos/egresos y capitalizacion promedio... para
 * entender valores", concatenado en los mismos deltas. Un formato de numero puede llevar texto
 * FIJO (la v0.34.0: '"' + IP_FLECHA_SUBE + ' "0.0%"' + IP_SUFIJO_DELTA + '"') pero no puede
 * embeber un VALOR CALCULADO -- el promedio no es un literal, sale de la misma serie que la
 * tendencia. Para concatenarlo la celda tiene que dejar de ser un numero.
 *
 * ESO ROMPE DOS COSAS A LA VEZ, y las dos se reparan en el mismo movimiento:
 *   1. El formato con flechas de v0.34.0 deja de aplicar sobre texto: la flecha se concatena a
 *      mano en la formula (ver _formulaVisibleFlujoIp / _formulaVisibleCapitalIp), con la MISMA
 *      logica de signo -- la flecha REEMPLAZA al signo, nunca lo acompana.
 *   2. Las seis reglas de color de v0.34.0 miraban '=$F$10>0': sobre un TEXTO esa condicion no
 *      se cumple NUNCA, y las reglas mueren en silencio -- exactamente la superficie del bug que
 *      Franco reporto ese mismo dia (una regla mirando el numero equivocado). No se repite: las
 *      reglas pasan a apuntar a la celda AUXILIAR numerica de IP_AUX, nunca al texto visible
 *      (ver "EL COLOR DE LOS DELTAS" mas abajo).
 *
 * POR QUE TEXT() Y NO setNumberFormat: sin numero no hay patron de numero que aplicar.
 *
 * EL COMENTARIO QUE ESTABA ACA ERA FALSO, y salio a la planilla en v0.37.0: afirmaba que TEXT()
 * "SI es sensible al locale" y que por eso el patron iba con coma decimal (al reves que
 * setNumberFormat). Es la MISMA superficie de error que ya habia costado v0.32.2 y v0.33.0 --
 * una afirmacion sobre locale sin medir -- y esta vez la corrida en vivo del 2026-08-21 la
 * contradijo de punta a punta: "82,0%" salio "133%" (perdio el decimal) y "$211.073,04" salio
 * "$211.073,04333" (cinco decimales de mas). NO HAY EXCEPCION a la regla de locale documentada
 * en DEVTOOL_FormatoMedios.js: TEXT() se comporta EXACTAMENTE como setNumberFormat en este
 * punto -- el patron va SIEMPRE canonico (punto decimal, coma de miles),
 * sea que viaje dentro de un TEXT() de una formula o directo a setNumberFormat, sin importar el
 * locale de la hoja. Lo que SI sigue el locale es el RENDERIZADO final: un patron canonico
 * "0.0%" se ve en pantalla como "82,0%", igual que cualquier celda con setNumberFormat.
 *
 * MEDIDO en la planilla real el 2026-08-21, escribiendo las dos variantes por setFormula (nunca
 * tipeadas a mano: la UI traduce al tipear y la API no) sobre numeros conocidos, con
 * _DIAG_medirPatronYAuxIp: una funcion de diagnostico temporal (corrida por Franco desde una
 * entrada de menu igualmente temporal, las dos retiradas del codigo despues de leer el
 * resultado):
 *   TEXT(0,82; "0,0%")                     -> "82%"           (el patron con coma PIERDE el decimal)
 *   TEXT(0,82; "0.0%")                     -> "82,0%"         (el patron canonico, correcto)
 *   TEXT(211073,043333; "$ #.##0,00")      -> "$ 211.073,04333"  (el patron con coma AGREGA decimales de sobra)
 *   TEXT(211073,043333; "$ #,##0.00")      -> "$ 211.073,04"     (el patron canonico, correcto)
 *   TEXT(16725,6; "$ #.##0,00")            -> "$ 16.725,6000"
 *   TEXT(16725,6; "$ #,##0.00")            -> "$ 16.725,60"
 * Los patrones de aca abajo van dentro de un TEXT() de una formula (setFormula), y por lo de
 * arriba se escriben CANONICOS -- igual que cualquier setNumberFormat del repo, sin excepcion.
 * El espacio despues del "$" no es cosmetica suelta: es el mismo patron que usan las 93 formulas
 * propias de Franco en esta hoja (setNumberFormat con "$ #,##0.00"); sin el espacio, el monto se
 * veria distinto al resto de la pantalla.
 */
const IP_PATRON_PORCENTAJE = '0.0%';
const IP_PATRON_MONEDA = '$ #,##0.00';
/** El separador visual entre pedazos del texto: tendencia, promedio y (solo capital) flujo. */
const IP_SEPARADOR = ' \u00B7 ';    // espacio, punto medio (U+00B7), espacio -- tipografia, no emoji

/** Tolerancia de la identidad D19=D20+D21+D22 (y E) al releer los valores. */
const IP_UMBRAL_IDENTIDAD = 0.01;

const IP_PROP_RESPALDO = 'inicio_presupuesto_respaldo';
const IP_PROP_PREVIOS = 'inicio_presupuesto_previos';

// ============================================
// GEOMETRIA DERIVADA (helpers puros, sin planilla)
// ============================================

/** '$I$2' desde 'I2': las referencias a selectores van siempre absolutas. */
function _absIp(celda) {
    const m = String(celda).match(/^([A-Z]+)([0-9]+)$/);
    return '$' + m[1] + '$' + m[2];
}

/**
 * Letra de la columna del motor de Inicio que espeja una clave del ledger.
 * T espeja B (monto), asi que cada clave se corre el mismo offset. Regla SSOT: la unica
 * fuente del orden de columnas es RANGES.REGISTROS.
 */
function _colMotorIp(clave) {
    const base = columnLetterToIndex(IP_MOTOR.colBloque) - columnLetterToIndex(RANGES.REGISTROS.start);
    return columnIndexToLetter(columnLetterToIndex(RANGES.REGISTROS.columns[clave]) + base);
}

/** Rango abierto de una columna del motor de Inicio ('U8:U'). */
function _rangoMotorIp(clave) {
    const letra = _colMotorIp(clave);
    return letra + IP_MOTOR.filaDatos + ':' + letra;
}

/**
 * Rango abierto de una columna de la BD de Proyeccion. La Proyeccion es un espejo geometrico
 * de Registros (mismas columnas B:M, header 6, datos 7): se reusa RANGES.REGISTROS y solo
 * cambia el nombre de hoja. El preflight verifica los rotulos antes de confiar en esto.
 */
function _colProyIp(clave) {
    const letra = RANGES.REGISTROS.columns[clave];
    return _refHoja(SHEETS.PROYECCION) + '!' + letra + RANGES.REGISTROS.dataRow + ':' + letra;
}

/** La exclusion de cuentas neutras, generada desde CUENTAS_NEUTRAS (regla SSOT: cero literales sueltos). */
function _exclusionNeutrasIp(variable) {
    return CUENTAS_NEUTRAS.map(function (c) { return '(' + variable + '<>"' + c + '")'; }).join(' * ');
}

// ============================================
// FORMULAS
// ============================================

/**
 * PRESUPUESTO del mes para una composicion (D19:D21): adaptacion de Tablero!N9 con los
 * selectores de INICIO. Lee la BD de Proyeccion; como esa hoja no congela TC, convierte con
 * TIDETRACK_*() en vivo (trampa medida: sus columnas J:M estan vacias y tiene filas en USD).
 * Excluye las cuentas neutras: en la Proyeccion los traspasos traen Tipo de Cuenta
 * inconsistente, filtrar solo por la columna E los contaria como ingresos.
 */
function _formulaPresupuestoIp(clave) {
    const cat = { ingresos: 'Ingreso', fijos: 'Gasto Fijo', variables: 'Gasto Variable' }[clave];
    const selMes = _absIp(IP_SELECTORES.mes);
    const selAnio = _absIp(IP_SELECTORES.anio);
    const selMoneda = _absIp(IP_SELECTORES.moneda);
    return '=LET(\n' +
        '  monto; ' + _colProyIp('monto') + ';\n' +
        '  cuenta; ' + _colProyIp('cuenta') + ';\n' +
        '  tipo_cuenta; ' + _colProyIp('tipo_cuenta') + ';\n' +
        '  moneda; ' + _colProyIp('moneda') + ';\n' +
        '  fecha; ' + _colProyIp('fecha') + ';\n' +
        '  mes_num; MATCH(' + selMes + '; SPLIT("' + IP_MESES + '"; ","); 0);\n' +
        '  desde; DATE(' + selAnio + '; mes_num; 1);\n' +
        '  hasta; EOMONTH(desde; 0);\n' +
        '  tasa_origen; ARRAYFORMULA(IF(moneda="USD"; TIDETRACK_USD(); IF(moneda="AUD"; TIDETRACK_AUD(); IF(moneda="EUR"; TIDETRACK_EUR(); 1))));\n' +
        '  tasa_destino; IFERROR(SWITCH(' + selMoneda + '; "ARS"; 1; "USD"; TIDETRACK_USD(); "AUD"; TIDETRACK_AUD(); "EUR"; TIDETRACK_EUR()); 1);\n' +
        '  convertido; ARRAYFORMULA(monto * tasa_origen / tasa_destino);\n' +
        '  del_mes; ARRAYFORMULA((tipo_cuenta="' + cat + '") * ' + _exclusionNeutrasIp('cuenta') + ' * (fecha>=desde) * (fecha<=hasta));\n' +
        '  SUM(IFERROR(FILTER(convertido; del_mes); 0))\n)';
}

/**
 * REALIDAD del mes para una composicion (E19:E21): mismo criterio que Tablero!N16 (que suma
 * la QUERY del staging), reconstruido sin QUERY y sin arrays literales sobre el derrame del
 * motor de la PROPIA hoja (T:AF). La columna AF ya viene convertida con los TC congelados de
 * cada fila y anclada a los mismos selectores, asi que no se duplica ni el filtro de mes ni
 * la conversion. Toda condicion ligada a variable de LET va envuelta en ARRAYFORMULA: la
 * interseccion implicita es exactamente lo que rompio C15/F15 (defecto quinto).
 */
function _formulaRealidadIp(clave) {
    const cat = { ingresos: 'Ingreso', fijos: 'Gasto Fijo', variables: 'Gasto Variable' }[clave];
    // El signo invierte el tipo CONTRARIO al bloque: en ingresos, un Egreso resta (devolucion);
    // en gastos, un Ingreso resta (reintegro). Es la convencion de C13/F13.
    const tipoQueResta = clave === 'ingresos' ? 'Egreso' : 'Ingreso';
    const colValor = IP_MOTOR.colValor;
    return '=LET(\n' +
        '  monto_conv; ' + colValor + IP_MOTOR.filaDatos + ':' + colValor + ';\n' +
        '  tipo_mov; ' + _rangoMotorIp('tipo') + ';\n' +
        '  cuenta_mov; ' + _rangoMotorIp('cuenta') + ';\n' +
        '  cat_mov; ' + _rangoMotorIp('tipo_cuenta') + ';\n' +
        '  neto_mov; ARRAYFORMULA(IF(tipo_mov="' + tipoQueResta + '"; -monto_conv; monto_conv));\n' +
        '  del_bloque; ARRAYFORMULA((cat_mov="' + cat + '") * ' + _exclusionNeutrasIp('cuenta_mov') + ' * (cuenta_mov<>""));\n' +
        '  SUM(IFERROR(FILTER(neto_mov; del_bloque); 0))\n)';
}

/**
 * El residuo que cierra el bloque (D22 y E22): la identidad del presupuesto. Es una resta de
 * tres celdas y esa es la virtud: no hay forma de que no cierre. Puede dar negativo y no se
 * tapa: es la senal de un mes sobrecomprometido (leccion de DEVTOOL_Capitalizacion v0.29.0).
 */
function _formulaResiduoIp(col) {
    const filas = IP_BLOQUE.filas;
    return '=' + col + filas.ingresos.fila + '-' + col + filas.fijos.fila + '-' + col + filas.variables.fila;
}

/**
 * La barra de consumo (F19:F22): SPARKLINE tipo bar del cumplimiento E/D acotado 0..1, con el
 * semaforo corriendo para el lado que corresponda a la fila (IP_BLOQUE.filas[k].sentido).
 * Las opciones van con VSTACK/HSTACK: un array literal {} no lo traduce setFormula en es_AR
 * (trampa 1). Umbrales como fracciones (ver cabecera).
 *
 * EL CUMPLIMIENTO CUANDO NO HAY PRESUPUESTO. El cociente E/D es una pregunta sin sentido si D
 * es cero o negativo, y taparlo con IFERROR(...;0) daba la respuesta EQUIVOCADA: capitalizar
 * 385.400 sobre un plan de 0 se leia como 0% de cumplimiento. Se resuelve antes de dividir:
 * sin presupuesto, cumplio el que movio plata (1) y no cumplio el que no la movio (0). Es la
 * misma trampa que Franco marco en N25 (=O19/O12 con O12 = 15,31 dando -391830%): dividir por
 * algo que tiende a cero no da un error, da un numero absurdo con cara de dato.
 *
 * POR QUE LA BARRA VA APILADA (consumo | 1 - consumo) Y NO SUELTA. Una barra suelta al 0% mide
 * CERO y no se dibuja: la fila queda visualmente vacia, indistinguible de una celda sin formula.
 * Se vio en la corrida del 2026-08-21: Capacidad de Capitalizacion, con 15,31 presupuestados y
 * -59.989 reales, quedo sin barra ninguna -- justo el mes que mas gritaba. Apilando el resto
 * contra un riel del color palido del nivel, la barra SIEMPRE ocupa el ancho completo y el 0%
 * se lee como un riel vacio, que es lo que Franco pidio: "del 0% al 100%".
 *
 * El riel usa el tono PALIDO del mismo nivel (IP_FONDO_*), o sea la otra mitad de los pares que
 * Franco usa en los formatos condicionales del Tablero: tinta saturada sobre fondo palido.
 */
function _formulaConsumoIp(fila, sentido) {
    const refReal = '$' + IP_BLOQUE.colRealidad + '$' + fila;
    const refPresu = '$' + IP_BLOQUE.colPresupuesto + '$' + fila;
    // Para gastos el semaforo sube con el consumo (agotar el presupuesto es malo); para ingresos
    // y capitalizacion baja (quedarse corto del plan es lo malo). Ver IP_BLOQUE.filas.
    const escala = function (verde, naranja, rojo) {
        return (sentido === IP_MAS_ES_MEJOR)
            ? 'IF(consumo >= 4/5; "' + verde + '"; IF(consumo >= 1/2; "' + naranja + '"; "' + rojo + '"))'
            : 'IF(consumo < 1/2; "' + verde + '"; IF(consumo <= 4/5; "' + naranja + '"; "' + rojo + '"))';
    };
    return '=LET(\n' +
        '  consumo; IF(' + refPresu + ' <= 0; IF(' + refReal + ' > 0; 1; 0); IFERROR(MAX(0; MIN(1; ' + refReal + ' / ' + refPresu + ')); 0));\n' +
        '  color_nivel; ' + escala(IP_COLOR_VERDE, IP_COLOR_NARANJA, IP_COLOR_ROJO) + ';\n' +
        '  riel_nivel; ' + escala(IP_FONDO_VERDE, IP_FONDO_NARANJA, IP_FONDO_ROJO) + ';\n' +
        '  SPARKLINE(HSTACK(consumo; 1 - consumo); VSTACK(HSTACK("charttype"; "bar"); HSTACK("max"; 1);\n' +
        '    HSTACK("color1"; color_nivel); HSTACK("color2"; riel_nivel)))\n)';
}

/**
 * La distribucion de fondos disponibles (G20:G22): el MISMO diseno que Tablero!O23:O25
 * (DEVTOOL_Capitalizacion), con las referencias de este bloque. Tres regimenes, y en los tres
 * las tres filas suman exactamente la liquidez:
 *   1. queda presupuesto y la plata no alcanza -> proporcional al remanente;
 *   2. queda presupuesto y la plata sobra -> cada una su remanente, el sobrante a capitalizar;
 *   3. no queda presupuesto -> por peso de presupuesto (decision Franco 2026-08-20, y si no
 *      hay nada presupuestado, partes iguales).
 * La liquidez es $C$8 (ver cabecera): el Saldo Actual de la misma hoja, ya en la moneda de I4,
 * asi que aca no hay paso de conversion como en O23 (que arranca de saldos por moneda).
 */
function _formulaDistribucionIp(cual) {
    const filas = IP_BLOQUE.filas;
    const claves = ['fijos', 'variables', 'capitalizacion'];
    const refPresu = function (k) { return '$' + IP_BLOQUE.colPresupuesto + '$' + filas[k].fila; };
    const refReal = function (k) { return '$' + IP_BLOQUE.colRealidad + '$' + filas[k].fila; };

    let s = '=LET(\n';
    s += '  liquidez; ' + _absIp(IP_RESUMEN.saldo.celda) + ';\n';
    claves.forEach(function (k) { s += '  rem_' + k + '; MAX(0; ' + refPresu(k) + ' - ' + refReal(k) + ');\n'; });
    s += '  suma_rem; ' + claves.map(function (k) { return 'rem_' + k; }).join(' + ') + ';\n';
    claves.forEach(function (k) { s += '  peso_' + k + '; MAX(0; ' + refPresu(k) + ');\n'; });
    s += '  suma_peso; ' + claves.map(function (k) { return 'peso_' + k; }).join(' + ') + ';\n';
    s += '  parte_sin_presupuesto; IF(suma_peso > 0; peso_' + cual + ' / suma_peso; 1/3);\n';
    s += '  reparto; IF(suma_rem > 0; MIN(rem_' + cual + '; liquidez * rem_' + cual +
        ' / suma_rem); liquidez * parte_sin_presupuesto);\n';
    if (cual === 'capitalizacion') {
        // El sobrante solo existe cuando queda presupuesto por cubrir y la plata alcanza para
        // todo. En el regimen 3 no hay sobrante: la liquidez ya se repartio entera por peso.
        s += '  excedente; IF(suma_rem > 0; MAX(0; liquidez - suma_rem); 0);\n';
        s += '  reparto + excedente\n)';
    } else {
        s += '  reparto\n)';
    }
    return s;
}

/**
 * EL CALCULO DE LA TENDENCIA *Y* EL PROMEDIO, unico para los tres deltas -- UNA sola formula
 * pesada por delta (ver la cabecera de IP_AUX: calcularla dos veces duplicaria el costo).
 *
 * Recibe el nombre LET de una serie de IP_MESES_TENDENCIA valores mensuales (el mas viejo
 * primero) y devuelve HSTACK(tendencia; promedio):
 *
 *   - tendencia: el crecimiento de la tendencia como fraccion. Se ajusta la recta de minimos
 *     cuadrados sobre los seis puntos (SLOPE) y se mide cuanto SUBIO ESA RECTA de punta a punta
 *     -- pendiente * (n-1) --, expresado como fraccion del nivel medio de la ventana. En
 *     criollo: "la tendencia subio un 12% del nivel tipico de estos seis meses". Se usa la
 *     recta y no los extremos crudos (ultimo/primero - 1) justamente para no volver al problema
 *     que Franco marco: dos puntos sueltos vuelven a ser un dato de un mes.
 *   - promedio: el NIVEL MEDIO de la ventana (AVERAGE). No es una cuenta nueva: es el mismo
 *     numero que esta formula YA hacia de denominador de la tendencia y se descartaba -- ahora
 *     se expone en vez de tirarse.
 *
 * POR QUE EL PROMEDIO EN EL DENOMINADOR (de la tendencia) y no el primer valor: el primer mes de
 * la ventana puede ser cero o casi cero (un mes sin egresos de una categoria, una cuenta recien
 * abierta) y ahi un cociente contra el arranque explota a miles por ciento. El promedio de la
 * ventana es el nivel tipico de la serie y no se anula salvo que la serie entera sea cero, caso
 * que se responde con 0 y no con una division. ABS() porque una serie negativa (un capital en
 * rojo) tiene que conservar el SIGNO de la pendiente: si la deuda se achica, eso es crecimiento.
 */
function _tendenciaYPromedioIp(nombreSerie) {
    return 'LET(\n' +
        '    nivel_tend; AVERAGE(' + nombreSerie + ');\n' +
        '    pend_tend; IFERROR(SLOPE(' + nombreSerie + '; SEQUENCE(' + IP_MESES_TENDENCIA + ')); 0);\n' +
        '    tend_frac; IF(nivel_tend=0; 0; pend_tend * ' + (IP_MESES_TENDENCIA - 1) + ' / ABS(nivel_tend));\n' +
        '    HSTACK(tend_frac; nivel_tend)\n' +
        '  )';
}

/**
 * LA FORMULA PESADA DE CAPITAL -- va en la celda auxiliar IP_AUX.deltaCapital.tendencia (F10 la
 * LEE, no la recalcula: ver _formulaVisibleCapitalIp). La serie de los cierres de capital de los
 * 6 meses que TERMINAN en el mes del selector, y de ahi tendencia y promedio via
 * _tendenciaYPromedioIp. El capital de una fecha aplica la MISMA regla de saldo del sistema (el
 * ultimo "Inicio Mes" de cada medio + lo posterior, validada al centavo en DEVTOOL_StockYFlujo)
 * con el corte y los movimientos acotados a esa fecha, sobre los medios de la lista blanca
 * TIPOS_RIQUEZA. Se calcula en ARS: el delta es un cociente y la conversion se cancela.
 * MAP/LAMBDA sobre SEQUENCE(6), sin arrays literales.
 *
 * decision Franco 2026-08-21 (reemplaza la de 2026-08-20, ver cabecera del archivo): la ventana
 * ANCLA AL SELECTOR de Inicio ($I$2/$I$3) -- no a TODAY(). Coincide con TODAY() en el mes en
 * curso (hoy, 2026-08-21, selector en Agosto) y solo cambia de verdad al mirar un mes pasado,
 * que es justo donde antes desincronizaba a F10 de C15/F15.
 */
function _formulaAuxCapitalIp() {
    const medios = RANGES.MEDIOS_PAGO;
    const colTipoMedio = columnLetterToIndex(medios.columns.proyecto) - columnLetterToIndex(medios.start) + 1;
    const rangoMedios = _refHoja(medios.sheet) + '!' + medios.start + ':' + medios.end;
    const selMes = _absIp(IP_SELECTORES.mes);
    const selAnio = _absIp(IP_SELECTORES.anio);
    return '=LET(\n' +
        '  col_medio; ' + _colLedger('medio') + ';\n' +
        '  col_cuenta; ' + _colLedger('cuenta') + ';\n' +
        '  col_fecha; ' + _colLedger('fecha') + ';\n' +
        '  col_moneda; ' + _colLedger('moneda') + ';\n' +
        '  neto_mov; ARRAYFORMULA(IF(' + _colLedger('tipo') + '="Egreso"; -' + _colLedger('monto') + '; ' + _colLedger('monto') + '));\n' +
        '  lista_medios; IFERROR(FILTER(' + _colPlan(medios, 'nombre') + '; ' + _colPlan(medios, 'nombre') + '<>""); "");\n' +
        '  capital_al; LAMBDA(tope; LET(\n' +
        '    cortes_tope; MAP(lista_medios; LAMBDA(un_medio; MAX(IFERROR(FILTER(col_fecha; col_medio=un_medio; col_cuenta="' + CUENTA_ARRASTRE + '"; col_fecha<=tope); 0))));\n' +
        '    corte_fila; ARRAYFORMULA(IFERROR(VLOOKUP(col_medio; HSTACK(lista_medios; cortes_tope); 2; 0); ""));\n' +
        '    tipo_fila; ARRAYFORMULA(IFERROR(VLOOKUP(col_medio; ' + rangoMedios + '; ' + colTipoMedio + '; 0); ""));\n' +
        '    grupo_fila; ARRAYFORMULA(' + _condTipoSyf(true, 'tipo_fila') + ');\n' +
        '    vigente_fila; ARRAYFORMULA((corte_fila<>"") * (col_fecha>=corte_fila) * (col_fecha<=tope));\n' +
        '    suma_ars; SUM(IFERROR(FILTER(neto_mov; vigente_fila; grupo_fila; col_moneda="ARS"); 0));\n' +
        '    suma_usd; SUM(IFERROR(FILTER(neto_mov; vigente_fila; grupo_fila; col_moneda="USD"); 0));\n' +
        '    suma_aud; SUM(IFERROR(FILTER(neto_mov; vigente_fila; grupo_fila; col_moneda="AUD"); 0));\n' +
        '    suma_eur; SUM(IFERROR(FILTER(neto_mov; vigente_fila; grupo_fila; col_moneda="EUR"); 0));\n' +
        '    suma_ars + (suma_usd * TIDETRACK_USD()) + (suma_aud * TIDETRACK_AUD()) + (suma_eur * TIDETRACK_EUR())\n' +
        '  ));\n' +
        '  mes_num; MATCH(' + selMes + '; SPLIT("' + IP_MESES + '"; ","); 0);\n' +
        '  ancla_mes; DATE(' + selAnio + '; mes_num; 1);\n' +
        '  serie_cap; MAP(SEQUENCE(' + IP_MESES_TENDENCIA + '); LAMBDA(k_mes; capital_al(EOMONTH(ancla_mes; k_mes - ' + IP_MESES_TENDENCIA + '))));\n' +
        '  ' + _tendenciaYPromedioIp('serie_cap') + '\n)';
}

/**
 * LA FORMULA PESADA DE FLUJO (ingresos/egresos) -- va en la celda auxiliar
 * IP_AUX.deltaIngresos/deltaEgresos.tendencia (C15/F15 la LEEN, no la recalculan: ver
 * _formulaVisibleFlujoIp). El mes del selector y los 5 previos, directo desde Registros. Cada
 * fila se lleva a ARS con SU TC congelado (patron de Inicio!AF8: las columnas J:M congelan la
 * cotizacion del dia del registro). Excluye cuentas neutras y filas sin cuenta, como los bloques
 * del mes. Toda condicion ligada a LET va en ARRAYFORMULA y las de FILTER van inline, que es lo
 * que ya funciona en C8 (la interseccion implicita fue lo que rompio la formula original de
 * C15/F15, ver DEVTOOL_FormulerioV0111, defecto quinto).
 */
function _formulaAuxFlujoIp(esIngresos) {
    const cond = esIngresos
        ? '(col_cat="Ingreso")'
        : '(((col_cat="Gasto Fijo") + (col_cat="Gasto Variable")) > 0)';
    const tipoQueResta = esIngresos ? 'Egreso' : 'Ingreso';
    const selMes = _absIp(IP_SELECTORES.mes);
    const selAnio = _absIp(IP_SELECTORES.anio);
    return '=LET(\n' +
        '  col_cuenta; ' + _colLedger('cuenta') + ';\n' +
        '  col_cat; ' + _colLedger('tipo_cuenta') + ';\n' +
        '  col_moneda; ' + _colLedger('moneda') + ';\n' +
        '  col_fecha; ' + _colLedger('fecha') + ';\n' +
        '  tasa_congelada; ARRAYFORMULA(IF(col_moneda="ARS"; ' + _colLedger('tc_ars') + '; IF(col_moneda="USD"; ' + _colLedger('tc_usd') + '; IF(col_moneda="AUD"; ' + _colLedger('tc_aud') + '; IF(col_moneda="EUR"; ' + _colLedger('tc_eur') + '; 1)))));\n' +
        '  neto_valor; ARRAYFORMULA(IF(' + _colLedger('tipo') + '="' + tipoQueResta + '"; -' + _colLedger('monto') + '; ' + _colLedger('monto') + ') * tasa_congelada);\n' +
        '  mes_num; MATCH(' + selMes + '; SPLIT("' + IP_MESES + '"; ","); 0);\n' +
        '  ancla_mes; DATE(' + selAnio + '; mes_num; 1);\n' +
        '  base_mov; ARRAYFORMULA(' + cond + ' * ' + _exclusionNeutrasIp('col_cuenta') + ' * (col_cuenta<>""));\n' +
        '  serie_flujo; MAP(SEQUENCE(' + IP_MESES_TENDENCIA + '); LAMBDA(k_mes; LET(\n' +
        '    ini_k; EDATE(ancla_mes; k_mes - ' + IP_MESES_TENDENCIA + ');\n' +
        '    fin_k; EOMONTH(ini_k; 0);\n' +
        '    SUM(IFERROR(FILTER(neto_valor; base_mov; col_fecha>=ini_k; col_fecha<=fin_k); 0))\n' +
        '  )));\n' +
        '  ' + _tendenciaYPromedioIp('serie_flujo') + '\n)';
}

/**
 * EL TEXTO VISIBLE de un delta de flujo (C15 ingresos / F15 egresos): formula LIVIANA que solo
 * LEE las dos celdas auxiliares (tendencia, promedio) y arma el string. La serie pesada NO se
 * vuelve a calcular aca -- vive unicamente en la celda auxiliar de _formulaAuxFlujoIp.
 */
function _formulaVisibleFlujoIp(clave) {
    const refTend = _absIp(IP_AUX[clave].tendencia);
    const refProm = _absIp(_celdaPromedioIp(IP_AUX[clave].tendencia));
    return '=LET(\n' +
        '  tendencia; ' + refTend + ';\n' +
        '  promedio; ' + refProm + ';\n' +
        '  flecha; IF(tendencia>0; "' + IP_FLECHA_SUBE + '"; IF(tendencia<0; "' + IP_FLECHA_BAJA + '"; "' + IP_FLECHA_PLANA + '"));\n' +
        '  flecha & " " & TEXT(ABS(tendencia); "' + IP_PATRON_PORCENTAJE + '") & "' + IP_SUFIJO_DELTA + '" & "' + IP_SEPARADOR + '" & "promedio " & TEXT(promedio; "' + IP_PATRON_MONEDA + '")\n' +
        ')';
}

/**
 * EL TEXTO VISIBLE de F10 (capital): igual estructura que el de flujo, mas un tercer dato que
 * Franco pidio el 2026-08-21: "cuanto capital se inyecto o retiro en el periodo de analisis".
 * Ese numero YA EXISTE: es Inicio!E22, la capitalizacion EFECTIVA del mes elegido
 * (_formulaHaciaRiqueza con los selectores de Inicio -- la MISMA formula que alimenta
 * Tablero!O19, ver DEVTOOL_Capitalizacion). Se REFERENCIA esa celda -- no se llama de nuevo a
 * _formulaHaciaRiqueza ni se reescribe su logica -- para que sea IMPOSIBLE que Inicio muestre
 * dos numeros distintos para la misma cosa en la misma pantalla: no son dos formulas iguales,
 * es LA MISMA celda leida dos veces.
 *
 * "inyectados" si E22 > 0, "retirados" si E22 < 0 -- en valor absoluto, porque la palabra ya
 * dice el signo: repetirlo con un "-" adelante ("-$59.989 retirados") diria lo mismo dos veces.
 * Si da 0, una frase aparte ("sin movimientos de capital en <mes>"): ni "inyectados" ni
 * "retirados" describen a cero.
 *
 * EL GUARDIAN ISNUMBER. F10 depende de su propia auxiliar (que llama a TIDETRACK_* adentro de
 * capital_al) Y de E22 (que tambien llama a TIDETRACK_* para convertir). Las dos pueden mostrar
 * "Loading..." mientras la cotizacion resuelve -- la misma cicatriz que ya obligo a
 * _leerYaCalculadoIp en la verificacion de E22 (v0.31.0). Concatenar TEXT()/IF() directo sobre
 * ese string pendiente arriesgaba un resultado con forma de dato pero sin serlo, en vez de un
 * error visible. Por eso ISNUMBER() se fija ANTES de armar la frase: si alguna de las tres
 * entradas todavia no es numero, F10 devuelve ESA MISMA celda pendiente tal cual (se ve
 * "Loading...", no se disimula), y recien arma el texto cuando las tres estan listas.
 */
function _formulaVisibleCapitalIp() {
    const refTend = _absIp(IP_AUX.deltaCapital.tendencia);
    const refProm = _absIp(_celdaPromedioIp(IP_AUX.deltaCapital.tendencia));
    const refFlujo = _absIp(IP_BLOQUE.colRealidad + IP_BLOQUE.filas.capitalizacion.fila);
    const refMes = _absIp(IP_SELECTORES.mes);
    return '=LET(\n' +
        '  tendencia; ' + refTend + ';\n' +
        '  promedio; ' + refProm + ';\n' +
        '  flujo; ' + refFlujo + ';\n' +
        '  pendiente; IF(NOT(ISNUMBER(tendencia)); tendencia; IF(NOT(ISNUMBER(promedio)); promedio; IF(NOT(ISNUMBER(flujo)); flujo; "")));\n' +
        '  IF(pendiente<>""; pendiente; LET(\n' +
        '    flecha; IF(tendencia>0; "' + IP_FLECHA_SUBE + '"; IF(tendencia<0; "' + IP_FLECHA_BAJA + '"; "' + IP_FLECHA_PLANA + '"));\n' +
        '    texto_flujo; IF(flujo>0; TEXT(flujo; "' + IP_PATRON_MONEDA + '") & " inyectados en " & ' + refMes + ';\n' +
        '      IF(flujo<0; TEXT(ABS(flujo); "' + IP_PATRON_MONEDA + '") & " retirados en " & ' + refMes + ';\n' +
        '      "sin movimientos de capital en " & ' + refMes + '));\n' +
        '    flecha & " " & TEXT(ABS(tendencia); "' + IP_PATRON_PORCENTAJE + '") & "' + IP_SUFIJO_DELTA + '" & "' + IP_SEPARADOR + '" & "promedio " & TEXT(promedio; "' + IP_PATRON_MONEDA + '") & "' + IP_SEPARADOR + '" & texto_flujo\n' +
        '  ))\n' +
        ')';
}


// ============================================
// EL COLOR DE LOS DELTAS (reglas de formato condicional)
// ============================================

/**
 * [CONCEPTO DE NEGOCIO]
 * La flecha dice PARA DONDE fue la tendencia; el color dice si eso es buena o mala noticia.
 * No son lo mismo, y confundirlos es exactamente el bug que Franco encontro el 2026-08-21: el
 * capital acumulado mostraba "+82,0%" EN ROJO.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * La causa medida en la planilla ese dia: habia cuatro reglas de formato condicional del tipo
 * "el texto contiene", y estaban bien pensadas por metrica...
 *
 *   C15       contiene "+" -> verde     C15       contiene "-" -> rojo
 *   F10,F15   contiene "+" -> ROJO      F10,F15   contiene "-" -> verde
 *
 * ...pero F10 (capital) estaba AGRUPADO con F15 (egresos) en el mismo par. Para egresos "sube =
 * rojo" es correcto; para el capital es exactamente al reves. Una sola regla servia a dos celdas
 * de significado opuesto, que es la misma falla que el semaforo de las barras (ver IP_BLOQUE).
 *
 * POR ESO ACA CADA CELDA TIENE SU PROPIO PAR DE REGLAS, con rango de UNA sola celda. Son seis
 * reglas donde podrian ser cuatro; el par de mas es barato y hace imposible que una celda quede
 * arrastrada por la polaridad de otra.
 *
 * Y POR ESO LA CONDICION ES NUMERICA (=$F$10>0) Y NO DE TEXTO. Las reglas viejas miraban si el
 * texto mostrado contenia "+" o "-": funcionaban de casualidad, y se rompen solas en cuanto
 * cambia el formato de numero -- que es justo lo que pasa ahora, porque la flecha REEMPLAZA al
 * signo. Un modulo que es dueno del formato tiene que ser dueno del color, o los dos se
 * desincronizan sin que nada lo delate.
 *
 * ACTUALIZACION v0.37.0: F10/C15/F15 pasan a ser TEXTO (ver "EL TEXTO DE LOS TRES DELTAS"). Una
 * condicion "=$F$10>0" sobre un texto NO SE CUMPLE NUNCA -- exactamente la misma clase de bug
 * que el parrafo de arriba, en otro punto del mismo modulo. La condicion pasa a apuntar a la
 * celda AUXILIAR NUMERICA de IP_AUX (=$AV$8>0, nunca =$F$10>0), mientras que el RANGO que se
 * pinta sigue siendo la celda visible (F10/C15/F15): una regla de formato condicional puede
 * evaluar una celda y pintar otra, y es justo lo que hace falta aca.
 *
 * @see docs/permanente/FORMULAS_TABLERO.md
 */

/**
 * El par de reglas de una celda de delta: [{ formula, color }]. `celda` es la que se PINTA (el
 * texto visible, F10/C15/F15); la formula EVALUA la auxiliar numerica de IP_AUX -- nunca la
 * celda que se pinta, que desde v0.37.0 es texto y no cumpliria la condicion jamas.
 */
function _reglasDeUnDeltaIp(clave) {
    const celda = IP_RESUMEN[clave].celda;
    const refNumerica = _absIp(IP_AUX[clave].tendencia);
    const subeEsBueno = IP_RESUMEN[clave].sentido === IP_MAS_ES_MEJOR;
    return [
        { clave: clave, celda: celda, formula: '=' + refNumerica + '>0',
          color: subeEsBueno ? IP_COLOR_VERDE : IP_COLOR_ROJO },
        { clave: clave, celda: celda, formula: '=' + refNumerica + '<0',
          color: subeEsBueno ? IP_COLOR_ROJO : IP_COLOR_VERDE }
    ];
}

/** Las seis reglas que este modulo escribe, en orden. */
function _reglasDeltaIp() {
    return IP_CLAVES_DELTA.reduce(function (acc, k) {
        return acc.concat(_reglasDeUnDeltaIp(k));
    }, []);
}

/** Las formulas de las seis, para reconocerlas despues. */
function _formulasPropiasIp() {
    return _reglasDeltaIp().map(function (r) { return r.formula; });
}

/** Los rangos A1 de una regla viva, como lista de strings. */
function _rangosDeReglaIp(regla) {
    return (regla.getRanges() || []).map(function (r) { return r.getA1Notation(); });
}

/**
 * Clasifica las reglas vivas de la hoja en tres montones:
 *   propias    - las seis de este modulo (formula numerica sobre UNA celda de delta)
 *   superadas  - reglas "el texto contiene" cuyos rangos caen TODOS dentro de los tres deltas.
 *                Son las de Franco: quedan sin efecto en cuanto la flecha reemplaza al signo,
 *                asi que este modulo las levanta (y las guarda para poder reponerlas).
 *   ajenas     - todo lo demas. Se repone INTACTO y por referencia, nunca reconstruido:
 *                setConditionalFormatRules reemplaza TODAS las reglas de la hoja, y perder las
 *                del calendario (J8:P14) seria un destrozo silencioso.
 *
 * Una regla que TOCA una celda de delta pero ademas se extiende afuera NO se toca: se reporta.
 * Levantarla apagaria formato en celdas que no son de este modulo.
 */
function _clasificarReglasIp(todas) {
    const celdas = IP_CLAVES_DELTA.map(function (k) { return IP_RESUMEN[k].celda; });
    const propias = [], superadas = [], ajenas = [], desbordan = [];
    const mias = _formulasPropiasIp();

    (todas || []).forEach(function (regla) {
        const cond = regla.getBooleanCondition && regla.getBooleanCondition();
        if (!cond) { ajenas.push(regla); return; }
        const tipo = String(cond.getCriteriaType());
        const valores = cond.getCriteriaValues() || [];
        const rangos = _rangosDeReglaIp(regla);
        const dentro = rangos.filter(function (r) { return celdas.indexOf(r) !== -1; });

        if (tipo === 'CUSTOM_FORMULA' && rangos.length === 1 && dentro.length === 1 &&
            mias.indexOf(String(valores[0])) !== -1) {
            propias.push(regla);
            return;
        }
        if (!dentro.length) { ajenas.push(regla); return; }
        // Toca deltas. Solo se levanta si NO desborda y si es del tipo que sabemos reponer.
        if (dentro.length !== rangos.length || tipo !== 'TEXT_CONTAINS') {
            desbordan.push({ tipo: tipo, valor: String(valores[0] || ''), rangos: rangos });
            ajenas.push(regla);
            return;
        }
        superadas.push({
            regla: regla,
            foto: {
                criterio: tipo, valores: valores.map(String), rangos: rangos,
                texto: _hexDeColorIp(cond.getFontColorObject && cond.getFontColorObject()),
                fondo: _hexDeColorIp(cond.getBackgroundObject && cond.getBackgroundObject()),
                negrita: !!(cond.getBold && cond.getBold()),
                cursiva: !!(cond.getItalic && cond.getItalic()),
                tachado: !!(cond.getStrikethrough && cond.getStrikethrough()),
                subrayado: !!(cond.getUnderline && cond.getUnderline())
            }
        });
    });
    return { propias: propias, superadas: superadas, ajenas: ajenas, desbordan: desbordan };
}

/**
 * El hex de un color de regla, o null. Un color de TEMA no se puede convertir a RGB (asRgbColor
 * lanza) y adivinarle un hex seria inventar un color que Franco no eligio: se devuelve null y
 * la reposicion lo deja sin ese atributo, que es honesto.
 */
function _hexDeColorIp(color) {
    if (!color) return null;
    try {
        const rgb = color.asRgbColor();
        let h = String(rgb.asHexString() || '').toLowerCase();
        if (h.length === 9) h = '#' + h.slice(3);
        return h || null;
    } catch (e) {
        return null;
    }
}

/**
 * Si las reglas ya estan como corresponden, aplicar no las toca. Se compara formula Y color:
 * una regla propia con la formula correcta pero el color viejo tiene que reescribirse, que es
 * justamente el caso del capital (la formula miraba bien y el color estaba invertido).
 */
function _reglasHacenFaltaIp(clases) {
    if (clases.superadas.length) return true;
    const quiero = _reglasDeltaIp().map(function (r) { return r.formula + '|' + r.color; });
    const tengo = clases.propias.map(function (regla) {
        const cond = regla.getBooleanCondition();
        return String((cond.getCriteriaValues() || [])[0]) + '|' +
               _hexDeColorIp(cond.getFontColorObject && cond.getFontColorObject());
    });
    if (quiero.length !== tengo.length) return true;
    return quiero.some(function (q) { return tengo.indexOf(q) === -1; });
}

/** Construye una de las seis reglas propias. */
function _construirReglaDeltaIp(hoja, item) {
    return SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(item.formula)
        .setFontColor(item.color)
        .setBold(true)
        .setRanges([hoja.getRange(item.celda)])
        .build();
}

/** Reconstruye una regla "el texto contiene" desde su foto, para revertir. */
function _reponerReglaSuperadaIp(hoja, foto) {
    let b = SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains(foto.valores[0])
        .setRanges(foto.rangos.map(function (r) { return hoja.getRange(r); }));
    if (foto.texto) b = b.setFontColor(foto.texto);
    if (foto.fondo) b = b.setBackground(foto.fondo);
    if (foto.negrita) b = b.setBold(true);
    if (foto.cursiva) b = b.setItalic(true);
    if (foto.tachado) b = b.setStrikethrough(true);
    if (foto.subrayado) b = b.setUnderline(true);
    return b.build();
}

// ============================================
// PREFLIGHT
// ============================================

/**
 * Verifica que la hoja sea la que este modulo cree que es, ANTES de que nadie escriba.
 * Todo por ROTULO; aborta lanzando ante la minima discrepancia. Ademas junta el estado de
 * C8/F8 (Franco pidio revisarlas) y aborta si una celda destino tiene un VALOR estatico:
 * seria dato de Franco y el respaldo de formulas no lo salvaria.
 */
function _preflightIp(ss) {
    const nombre = NAV_CONFIG.SHEETS.INICIO;
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) throw new Error('No existe la hoja "' + nombre + '".');

    const desvios = [];
    const avisos = [];
    const vivoDe = function (celda) { return hoja.getRange(celda).getValue(); };
    const chequear = function (celda, esperado) {
        const vivo = vivoDe(celda);
        if (!_rotulosCompatibles(vivo, esperado)) {
            desvios.push(celda + ' dice "' + vivo + '" y se esperaba "' + esperado + '"');
        }
    };

    // --- 1. Selectores: rotulos y valores ---
    chequear(IP_SELECTORES.rotuloPeriodo.celda, IP_SELECTORES.rotuloPeriodo.esperado);
    chequear(IP_SELECTORES.rotuloMoneda.celda, IP_SELECTORES.rotuloMoneda.esperado);
    const mesVivo = String(vivoDe(IP_SELECTORES.mes) || '').trim();
    const mesesNorm = IP_MESES.split(',').map(_normalizarRotulo);
    if (mesesNorm.indexOf(_normalizarRotulo(mesVivo)) === -1) {
        desvios.push(IP_SELECTORES.mes + ' dice "' + mesVivo + '", que no es un mes en espanol');
    }
    const anioVivo = Number(vivoDe(IP_SELECTORES.anio));
    if (!isFinite(anioVivo) || anioVivo < 2000 || anioVivo > 2100) {
        desvios.push(IP_SELECTORES.anio + ' dice "' + vivoDe(IP_SELECTORES.anio) + '", que no es un anio plausible');
    }
    const monedaViva = String(vivoDe(IP_SELECTORES.moneda) || '').trim();
    if (MONEDAS_DISPONIBLES.indexOf(monedaViva) === -1) {
        desvios.push(IP_SELECTORES.moneda + ' dice "' + monedaViva + '" y no es ninguna moneda del sistema (' +
            MONEDAS_DISPONIBLES.join(', ') + ')');
    }

    // --- 2. Bloque "Presupuesto del Mes.": titulo, headers y rotulos de fila ---
    chequear(IP_BLOQUE.titulo.celda, IP_BLOQUE.titulo.esperado);
    IP_BLOQUE.headers.forEach(function (h) { chequear(h.celda, h.esperado); });
    Object.keys(IP_BLOQUE.filas).forEach(function (k) {
        const f = IP_BLOQUE.filas[k];
        chequear(IP_BLOQUE.colRotulo + f.fila, f.rotulo);
    });

    // --- 3. Rotulos del resumen ---
    chequear(IP_RESUMEN.saldo.rotulo.celda, IP_RESUMEN.saldo.rotulo.esperado);
    chequear(IP_RESUMEN.capital.rotulo.celda, IP_RESUMEN.capital.rotulo.esperado);
    chequear(IP_RESUMEN.deltaIngresos.rotulo.celda, IP_RESUMEN.deltaIngresos.rotulo.esperado);
    chequear(IP_RESUMEN.deltaEgresos.rotulo.celda, IP_RESUMEN.deltaEgresos.rotulo.esperado);

    if (desvios.length) {
        throw new Error('La hoja "' + nombre + '" no es la que este modulo espera: ' +
            desvios.join('; ') + '. Hay que volver a medir antes de escribir. No se toco nada.');
    }

    // --- 4. El motor de la hoja esta vivo y sus columnas espejan al ledger (regla SSOT) ---
    const headerLedger = _leerHeaderLedger(ss);
    if (!Object.keys(headerLedger).length) {
        throw new Error('No se pudo leer el header de "' + RANGES.REGISTROS.sheet +
            '": sin ledger no hay realidad que medir. No se toco nada.');
    }
    const celdaMotor = IP_MOTOR.colBloque + IP_MOTOR.filaDatos;
    if (!hoja.getRange(celdaMotor).getFormula()) {
        throw new Error('El motor "' + nombre + '"!' + celdaMotor + ' no tiene formula: la columna ' +
            'Realidad se quedaria sin fuente. No se toco nada.');
    }
    const celdaValor = IP_MOTOR.colValor + IP_MOTOR.filaDatos;
    if (!hoja.getRange(celdaValor).getFormula()) {
        throw new Error('La conversion "' + nombre + '"!' + celdaValor + ' no tiene formula: la columna ' +
            'Realidad leeria montos sin convertir. No se toco nada.');
    }
    ['tipo', 'cuenta', 'tipo_cuenta'].forEach(function (clave) {
        const esperado = headerLedger[clave];
        if (!esperado) return;
        const vivo = hoja.getRange(_colMotorIp(clave) + IP_MOTOR.filaHeader).getValue();
        if (!_rotulosCompatibles(vivo, esperado)) {
            desvios.push(_colMotorIp(clave) + IP_MOTOR.filaHeader + ' dice "' + vivo +
                '" y el ledger llama a esa columna "' + esperado + '"');
        }
    });
    const rotuloValor = _normalizarRotulo(hoja.getRange(IP_MOTOR.colValor + IP_MOTOR.filaHeader).getValue());
    if (rotuloValor.indexOf('valor') !== 0) {
        desvios.push(IP_MOTOR.colValor + IP_MOTOR.filaHeader + ' dice "' +
            hoja.getRange(IP_MOTOR.colValor + IP_MOTOR.filaHeader).getValue() +
            '" y se esperaba el rotulo "Valor en ..."');
    }
    if (desvios.length) {
        throw new Error('El motor de "' + nombre + '" no mapea 1:1 contra el ledger: ' +
            desvios.join('; ') + '. Leerlo asi aparearia montos con la columna equivocada. No se toco nada.');
    }

    // --- 5. La BD de Proyeccion existe y espeja al ledger ---
    const hojaProy = ss.getSheetByName(SHEETS.PROYECCION);
    if (!hojaProy) {
        throw new Error('No existe la hoja "' + SHEETS.PROYECCION + '": sin ella la columna ' +
            'Presupuesto no tiene fuente. Correr antes Tidetrack Dev > BD de Proyeccion. No se toco nada.');
    }
    ['monto', 'cuenta', 'tipo_cuenta', 'moneda', 'fecha'].forEach(function (clave) {
        const esperado = headerLedger[clave];
        if (!esperado) return;
        const vivo = hojaProy.getRange(RANGES.REGISTROS.headerRow,
            columnLetterToIndex(RANGES.REGISTROS.columns[clave])).getValue();
        if (!_rotulosCompatibles(vivo, esperado)) {
            desvios.push(SHEETS.PROYECCION + ' col ' + RANGES.REGISTROS.columns[clave] + ' dice "' + vivo +
                '" y el ledger llama a esa columna "' + esperado + '"');
        }
    });
    if (desvios.length) {
        throw new Error('La BD de Proyeccion no espeja al ledger: ' + desvios.join('; ') +
            '. No se toco nada.');
    }

    // --- 6. C8 y F8: se REVISAN, no se tocan (pedido de Franco) ---
    const estadoResumen = {};
    [['saldo', IP_RESUMEN.saldo], ['capital', IP_RESUMEN.capital]].forEach(function (par) {
        const r = hoja.getRange(par[1].celda);
        estadoResumen[par[0]] = {
            celda: par[1].celda,
            conFormula: !!r.getFormula(),
            muestra: r.getDisplayValue(),
            error: _errorDeCelda(r)
        };
    });
    if (!estadoResumen.saldo.conFormula) {
        // C8 es la liquidez del reparto: sin formula ahi, la columna G repartiria basura.
        throw new Error('"' + nombre + '"!' + IP_RESUMEN.saldo.celda + ' (Saldo Actual) no tiene ' +
            'formula, y es la liquidez que reparte la columna G. Reponerla con Tidetrack Dev > ' +
            'Stock y Flujo antes de correr esto. No se toco nada.');
    }
    if (!estadoResumen.capital.conFormula) {
        avisos.push('"' + nombre + '"!' + IP_RESUMEN.capital.celda + ' (Capital Acumulado) no tiene ' +
            'formula. Este modulo no la escribe (es de Stock y Flujo); F10 calcula su capital por ' +
            'su cuenta, pero conviene reponer F8.');
    }
    if (estadoResumen.saldo.error) {
        avisos.push('"' + nombre + '"!' + IP_RESUMEN.saldo.celda + ' esta en ' + estadoResumen.saldo.error +
            ': la columna G va a heredar ese error hasta que se repare.');
    }
    if (estadoResumen.capital.error) {
        avisos.push('"' + nombre + '"!' + IP_RESUMEN.capital.celda + ' esta en ' + estadoResumen.capital.error + '.');
    }

    // --- 7. La zona destino no puede tener VALORES estaticos: serian datos de Franco y el ---
    // --- respaldo de formulas no los salvaria. (F10, C15 y F15 son la excepcion pedida: sus ---
    // --- contenidos previos se capturan aparte y la reversion los repone.) ---
    const conValor = [];
    Object.keys(IP_BLOQUE.filas).forEach(function (k) {
        const fila = IP_BLOQUE.filas[k].fila;
        [IP_BLOQUE.colPresupuesto, IP_BLOQUE.colRealidad, IP_BLOQUE.colConsumo, IP_BLOQUE.colDistribucion]
            .forEach(function (col) {
                const r = hoja.getRange(col + fila);
                if (!r.getFormula() && String(r.getValue()) !== '') conValor.push(col + fila);
            });
    });
    if (conValor.length) {
        throw new Error('La zona del bloque tiene valores escritos a mano en ' + conValor.join(', ') +
            ': puede ser dato de Franco y este modulo no pisa datos. Vaciarlas (o convertirlas en ' +
            'formula) antes de correr. No se toco nada.');
    }

    // --- 8. Las celdas AUXILIARES (trastienda AV/AW) tienen que estar libres. Cada delta ---
    // --- escribe en su celda de tendencia (IP_AUX) y el HSTACK derrama el promedio una ---
    // --- columna a la derecha (_celdaPromedioIp): las dos tienen que estar vacias, o el ---
    // --- derrame fallaria con "el resultado de la formula se superpone con datos". ---
    const conValorAux = [];
    IP_CLAVES_DELTA.forEach(function (k) {
        const cTend = IP_AUX[k].tendencia;
        const cProm = _celdaPromedioIp(cTend);
        [cTend, cProm].forEach(function (celda) {
            const r = hoja.getRange(celda);
            if (!r.getFormula() && String(r.getValue()) !== '') conValorAux.push(celda);
        });
    });
    if (conValorAux.length) {
        throw new Error('Las celdas auxiliares de los deltas (' + conValorAux.join(', ') + ') no ' +
            'estan vacias. Medido contra el gemelo el 2026-08-21: esa zona (columnas AV/AW, a la ' +
            'derecha del motor de la hoja) no tenia ninguna celda con contenido. Si algo la ocupo ' +
            'desde entonces, hay que volver a medir antes de escribir. No se toco nada.');
    }

    return { hoja: hoja, nombre: nombre, estadoResumen: estadoResumen, avisos: avisos };
}

// ============================================
// PLAN
// ============================================

/**
 * Construye el plan leyendo lo vivo. No escribe nada. Salta lo que ya esta identico
 * (idempotencia) comparando la formula canonizada, y el formato por igualdad literal.
 */
function _planIp(ss, pre) {
    const cambios = [];
    const filas = IP_BLOQUE.filas;

    const proponer = function (celda, nota, nueva, resumen) {
        const rango = pre.hoja.getRange(celda);
        const actual = rango.getFormula();
        if (_canonizarFormula(actual) === _canonizarFormula(nueva)) return;
        cambios.push({
            celda: celda, nota: nota, formulaActual: actual, formulaNueva: nueva,
            valorActual: actual ? '' : rango.getValue(), resumen: resumen
        });
    };
    // --- Columna D: presupuesto proyectado + residuo ---
    ['ingresos', 'fijos', 'variables'].forEach(function (k) {
        proponer(IP_BLOQUE.colPresupuesto + filas[k].fila, 'Presupuesto: ' + filas[k].rotulo,
            _formulaPresupuestoIp(k),
            'lo proyectado del mes para ' + filas[k].rotulo + ', desde la BD de Proyeccion');
    });
    proponer(IP_BLOQUE.colPresupuesto + filas.capitalizacion.fila, 'Presupuesto: ' + filas.capitalizacion.rotulo,
        _formulaResiduoIp(IP_BLOQUE.colPresupuesto),
        'el residuo Ingresos - Fijos - Variables: la identidad que hace cerrar el bloque');

    // --- Columna E: realidad + residuo ---
    ['ingresos', 'fijos', 'variables'].forEach(function (k) {
        proponer(IP_BLOQUE.colRealidad + filas[k].fila, 'Realidad: ' + filas[k].rotulo,
            _formulaRealidadIp(k),
            'lo que realmente paso este mes, desde el motor de la hoja (TC congelados)');
    });
    // decision Franco 2026-08-20, aplicada aca el 2026-08-21: EL PLAN ASIGNA, LA REALIDAD SE MIDE.
    // D22 es el residuo porque un presupuesto reparte los ingresos y el residuo es lo unico que
    // cierra la asignacion en 100%. E22 NO: mide lo que efectivamente entro a los medios de
    // Ahorros e Inversiones en el mes, traspasos incluidos, neteado con signo.
    //
    // Se reutiliza _formulaHaciaRiqueza de DEVTOOL_Capitalizacion con los selectores de ESTA hoja
    // en vez de escribir una segunda formula: una copia diverge en el primer arreglo que se haga
    // en una sola de las dos, y entonces Inicio y Tablero mostrarian capitalizaciones distintas
    // para el mismo mes sin que nada lo delate.
    proponer(IP_BLOQUE.colRealidad + filas.capitalizacion.fila, 'Realidad: ' + filas.capitalizacion.rotulo,
        _formulaHaciaRiqueza(RANGES.REGISTROS.sheet, CAP_SELECTORES.inicio),
        'la capitalizacion MEDIDA del mes (identica a Tablero!O19, con los selectores de Inicio)');

    // --- Columna F: la barra de consumo ---
    Object.keys(filas).forEach(function (k) {
        proponer(IP_BLOQUE.colConsumo + filas[k].fila, 'Consumo: ' + filas[k].rotulo,
            _formulaConsumoIp(filas[k].fila, filas[k].sentido),
            'barra de cumplimiento 0..1, semaforo ' + filas[k].sentido);
    });

    // --- Columna G: la distribucion. G19 queda vacia via formula (ver cabecera). ---
    proponer(IP_BLOQUE.colDistribucion + filas.ingresos.fila, 'Distribucion: ' + filas.ingresos.rotulo,
        '=""',
        'los ingresos son la fuente de la plata disponible, no un destino: sin distribucion');
    ['fijos', 'variables', 'capitalizacion'].forEach(function (k) {
        proponer(IP_BLOQUE.colDistribucion + filas[k].fila, 'Distribucion: ' + filas[k].rotulo,
            _formulaDistribucionIp(k),
            'reparte la liquidez de C8 por remanente, y por peso cuando no queda remanente');
    });

    // --- Las celdas AUXILIARES de los tres deltas: la formula pesada, UNA vez por delta ---
    // --- (ver cabecera de IP_AUX). Trastienda -- Franco no las lee directo. ---
    proponer(IP_AUX.deltaCapital.tendencia, 'Auxiliar: ' + IP_RESUMEN.deltaCapital.nota,
        _formulaAuxCapitalIp(),
        'tendencia y promedio de los cierres de capital en la ventana de ' + IP_MESES_TENDENCIA +
        ' meses que cierra en el mes del selector (celda de trastienda, F10 la lee)');
    proponer(IP_AUX.deltaIngresos.tendencia, 'Auxiliar: ' + IP_RESUMEN.deltaIngresos.nota,
        _formulaAuxFlujoIp(true),
        'tendencia y promedio de los ingresos en la ventana de ' + IP_MESES_TENDENCIA +
        ' meses que cierra en el mes del selector (celda de trastienda, C15 la lee)');
    proponer(IP_AUX.deltaEgresos.tendencia, 'Auxiliar: ' + IP_RESUMEN.deltaEgresos.nota,
        _formulaAuxFlujoIp(false),
        'tendencia y promedio de los egresos en la ventana de ' + IP_MESES_TENDENCIA +
        ' meses que cierra en el mes del selector (celda de trastienda, F15 la lee)');

    // --- Las celdas VISIBLES: formula liviana, solo LEE las auxiliares y arma el texto ---
    proponer(IP_RESUMEN.deltaCapital.celda, IP_RESUMEN.deltaCapital.nota,
        _formulaVisibleCapitalIp(),
        'texto con flecha + tendencia + promedio + cuanto capital se inyecto/retiro en el mes elegido (lee E22, no lo recalcula)');
    proponer(IP_RESUMEN.deltaIngresos.celda, IP_RESUMEN.deltaIngresos.nota,
        _formulaVisibleFlujoIp('deltaIngresos'),
        'texto con flecha + tendencia + el ingreso promedio de la ventana');
    proponer(IP_RESUMEN.deltaEgresos.celda, IP_RESUMEN.deltaEgresos.nota,
        _formulaVisibleFlujoIp('deltaEgresos'),
        'texto con flecha + tendencia + el egreso promedio de la ventana');

    // --- Y el COLOR de los tres deltas, que va junto con el texto y no aparte ---
    // Separarlos es lo que produjo el bug de v0.34.0: el formato decia "+82,0%" y una regla de
    // color ajena decidia que ese "+" era rojo. Mientras el mismo modulo sea dueno de los dos, no
    // pueden contradecirse. Ver la cabecera de la seccion "EL COLOR DE LOS DELTAS".
    const clases = _clasificarReglasIp(pre.hoja.getConditionalFormatRules());
    return { cambios: cambios, reglas: clases };
}

// ============================================
// VERIFICACION E INVARIANTES
// ============================================

/**
 * Los invariantes del bloque, sobre los VALORES releidos (no sobre el texto de setFormula):
 *   1. IDENTIDAD: |D19-D20-D21-D22| < 0.01, y lo mismo en E. Es la definicion del bloque.
 *   2. G19 queda vacia (los ingresos no reciben distribucion).
 *   3. G20+G21+G22 = C8 (el reparto ni pierde ni inventa plata), si C8 es numerico.
 *   4. Las seis celdas AUXILIARES (IP_AUX: tendencia + su promedio derramado) son numeros
 *      finitos -- son la unica fuente numerica de la que dependen el color y el texto.
 *   5. Las tres celdas VISIBLES (F10/C15/F15) son TEXTO no vacio y sin error -- desde v0.37.0 YA
 *      NO son numeros (ver "EL TEXTO DE LOS TRES DELTAS"), asi que "correcto" aca es cualquier
 *      string que no sea un error de celda ni el marcador de "todavia calculando".
 */
/**
 * Lee una celda ESPERANDO a que las custom functions terminen de calcular.
 *
 * Las funciones propias -- TIDETRACK_USD/AUD/EUR -- no calculan de forma sincronica: en su primer
 * calculo la celda devuelve el texto "Loading..." (o "Cargando..." segun el idioma) y recien
 * despues el numero. Un verificador que relee inmediatamente despues del flush() ve ese string,
 * concluye "esto no es un numero" y REVIERTE formulas que estaban perfectas.
 *
 * Paso el 2026-08-21 con E22, que empezo a llamar a TIDETRACK_* al medir la capitalizacion: la
 * corrida entera se revirtio con el mensaje "la columna Realidad no releyo numeros". Es un falso
 * negativo caro, porque destruye trabajo correcto y manda a buscar el bug donde no esta.
 *
 * Se reintenta con pausas crecientes. Si al final sigue en "cargando", se devuelve el marcador
 * PENDIENTE: no es un numero, pero tampoco es una falla -- es una celda que todavia no resolvio,
 * y el que decide que hacer con eso es quien llama, no esta funcion.
 */
const IP_PENDIENTE = { pendiente: true };

function _leerYaCalculadoIp(hoja, celda) {
    const esperas = [0, 600, 1500, 3000];
    for (let i = 0; i < esperas.length; i++) {
        if (esperas[i]) { SpreadsheetApp.flush(); Utilities.sleep(esperas[i]); }
        const v = hoja.getRange(celda).getValue();
        if (typeof v === 'number') return v;
        // Un error de celda (#REF!, #VALUE!) SI es una falla y no hay que esperarlo.
        if (typeof v === 'string' && v.indexOf('#') === 0) return v;
        // Cualquier otro texto en una celda que deberia dar numero es, casi seguro, el
        // "Loading..." de una custom function. Se le da otra oportunidad.
    }
    const ult = hoja.getRange(celda).getValue();
    return typeof ult === 'number' ? ult : IP_PENDIENTE;
}

/**
 * Como _leerYaCalculadoIp, pero para las celdas VISIBLES (F10/C15/F15), que desde v0.37.0 son
 * TEXTO a proposito -- un NUMERO ahi seria el error de diseno, no un exito. "Correcto" es
 * cualquier string no vacio que no sea un error de celda (#...) ni el marcador de "todavia
 * calculando" (el mismo "Loading.../Cargando..." de _leerYaCalculadoIp: F10 depende de su
 * auxiliar y de E22, las dos con TIDETRACK_* adentro, asi que hereda la misma cicatriz).
 */
function _leerTextoYaCalculadoIp(hoja, celda) {
    const esperas = [0, 600, 1500, 3000];
    const esPendiente = function (v) { return v === 'Loading...' || v === 'Cargando...'; };
    for (let i = 0; i < esperas.length; i++) {
        if (esperas[i]) { SpreadsheetApp.flush(); Utilities.sleep(esperas[i]); }
        const v = hoja.getRange(celda).getValue();
        if (typeof v === 'string' && v && v.indexOf('#') === 0) return v;   // error real: no se espera
        if (typeof v === 'string' && v && !esPendiente(v)) return v;
    }
    const ult = hoja.getRange(celda).getValue();
    return (typeof ult === 'string' && ult && !esPendiente(ult)) ? ult : IP_PENDIENTE;
}

function _verificarInvariantesIp(hoja) {
    const fallas = [];
    const avisos = [];
    const filas = IP_BLOQUE.filas;
    const orden = ['ingresos', 'fijos', 'variables', 'capitalizacion'];
    const leer = function (celda) { return _leerYaCalculadoIp(hoja, celda); };

    [[IP_BLOQUE.colPresupuesto, 'Presupuesto'], [IP_BLOQUE.colRealidad, 'Realidad']].forEach(function (par) {
        const col = par[0];
        const vals = orden.map(function (k) { return leer(col + filas[k].fila); });
        const enError = vals.filter(function (v) { return typeof v === 'string' && v.indexOf('#') === 0; });
        if (enError.length) {
            fallas.push('la columna ' + par[1] + ' (' + col + ') quedo en error: ' + enError.join(', '));
            return;
        }
        if (vals.some(function (v) { return v === IP_PENDIENTE; })) {
            // Todavia calculando una custom function. NO es una falla: revertir aca destruiria
            // formulas correctas. Se avisa y se saltea la identidad, que sin numeros no se puede
            // comprobar.
            avisos.push('la columna ' + par[1] + ' (' + col + ') todavia estaba calculando al ' +
                'releerla (las cotizaciones tardan en resolver). Verificar a ojo que los cuatro ' +
                'numeros aparezcan y que ' + col + filas.ingresos.fila + ' = la suma de los otros tres.');
            return;
        }
        if (vals.some(function (v) { return typeof v !== 'number' || !isFinite(v); })) {
            fallas.push('la columna ' + par[1] + ' (' + col + ') no releyo numeros en las cuatro filas');
            return;
        }
        const desvio = Math.abs(vals[0] - vals[1] - vals[2] - vals[3]);
        // LA IDENTIDAD RIGE SOLO EN EL PLAN. decision Franco 2026-08-20: el plan ASIGNA -- por eso
        // D22 es el residuo y los tres destinos suman el 100% de los ingresos por construccion --
        // pero la realidad SE MIDE: E22 es la capitalizacion efectiva del mes, no lo que sobro.
        //
        // En la columna E la diferencia NO es un error: es la plata que entro y no se gasto ni se
        // capitalizo (o el gasto por encima de lo que entro). Es informacion, y se reporta como
        // tal. Exigirle la identidad a E revertia la corrida entera con las formulas correctas:
        // se midio un desvio de 230.899,99 el 2026-08-21, que era exactamente ese dato.
        if (col !== IP_BLOQUE.colPresupuesto) {
            if (desvio >= IP_UMBRAL_IDENTIDAD) {
                avisos.push('en ' + par[1] + ' quedaron ' + desvio.toFixed(2) + ' sin asignar: es la ' +
                    'plata que entro y no se gasto ni se capitalizo. NO es un error -- el bloque de ' +
                    'la realidad no tiene por que sumar 100%, a diferencia del plan.');
            }
            return;
        }
        if (desvio >= IP_UMBRAL_IDENTIDAD) {
            fallas.push('la identidad de ' + par[1] + ' no cierra: |' + col + filas.ingresos.fila +
                '-' + col + filas.fijos.fila + '-' + col + filas.variables.fila + '-' +
                col + filas.capitalizacion.fila + '| = ' + desvio.toFixed(4));
        }
    });

    // Lectura CRUDA: esta celda tiene que estar VACIA, y el lector que espera a las custom
    // functions interpreta el vacio como "todavia calculando". Esperar por una celda cuyo valor
    // correcto es la nada no tiene sentido, y ademas hace fallar el chequeo por el motivo opuesto
    // al real. Lo atrapo el banco el 2026-08-21, en el mismo commit que introdujo el lector.
    const g19 = hoja.getRange(IP_BLOQUE.colDistribucion + filas.ingresos.fila).getValue();
    if (String(g19) !== '') {
        fallas.push('G' + filas.ingresos.fila + ' (Distribucion de Ingresos) tendria que quedar vacia y muestra "' + g19 + '"');
    }

    const repartos = ['fijos', 'variables', 'capitalizacion'].map(function (k) {
        return leer(IP_BLOQUE.colDistribucion + filas[k].fila);
    });
    if (repartos.some(function (v) { return v === IP_PENDIENTE; })) {
        avisos.push('la columna Distribucion todavia estaba calculando al releerla. Verificar a ' +
            'ojo que sus tres filas sumen el saldo de ' + IP_RESUMEN.saldo.celda + '.');
    } else if (repartos.some(function (v) { return typeof v !== 'number' || !isFinite(v); })) {
        fallas.push('la columna Distribucion no releyo numeros en sus tres filas');
    } else {
        const liquidez = leer(IP_RESUMEN.saldo.celda);
        if (typeof liquidez === 'number' && isFinite(liquidez)) {
            const suma = repartos[0] + repartos[1] + repartos[2];
            if (Math.abs(suma - liquidez) >= IP_UMBRAL_IDENTIDAD) {
                fallas.push('las tres filas de distribucion suman ' + suma.toFixed(2) +
                    ' y la liquidez de ' + IP_RESUMEN.saldo.celda + ' es ' + liquidez.toFixed(2));
            }
        }
    }

    // Las celdas AUXILIARES (trastienda): tienen que releer NUMEROS, tanto la tendencia como el
    // promedio derramado a su derecha. Son la unica fuente numerica del color y del texto.
    IP_CLAVES_DELTA.forEach(function (k) {
        const cTend = IP_AUX[k].tendencia;
        const cProm = _celdaPromedioIp(cTend);
        [[cTend, 'tendencia'], [cProm, 'promedio']].forEach(function (par) {
            const celda = par[0], v = leer(celda);
            if (v === IP_PENDIENTE) {
                avisos.push(celda + ' (' + par[1] + ' auxiliar de ' + IP_RESUMEN[k].nota.toLowerCase() +
                    ') todavia estaba calculando al releerla.');
            } else if (typeof v !== 'number' || !isFinite(v)) {
                fallas.push(celda + ' (' + par[1] + ' auxiliar de ' + IP_RESUMEN[k].nota.toLowerCase() + ') no releyo un numero');
            }
        });
    });

    // Las celdas VISIBLES (F10/C15/F15): desde v0.37.0 ya NO son numeros -- son TEXTO con la
    // flecha, la tendencia, el promedio y (solo capital) el flujo del periodo. "Correcto" aca es
    // cualquier string no vacio que no sea un error de celda ni el marcador de "todavia calculando".
    const leerTexto = function (celda) { return _leerTextoYaCalculadoIp(hoja, celda); };
    [IP_RESUMEN.deltaCapital, IP_RESUMEN.deltaIngresos, IP_RESUMEN.deltaEgresos].forEach(function (d) {
        const v = leerTexto(d.celda);
        if (v === IP_PENDIENTE) {
            avisos.push(d.celda + ' (' + d.nota + ') todavia estaba calculando al releerla.');
        } else if (typeof v === 'string' && v.indexOf('#') === 0) {
            fallas.push(d.celda + ' (' + d.nota + ') quedo en ' + v);
        } else if (typeof v !== 'string' || !v) {
            fallas.push(d.celda + ' (' + d.nota + ') no releyo un texto');
        }
    });

    return { fallas: fallas, avisos: avisos };
}

/**
 * Devuelve cada celda escrita en ESTA corrida a su estado previo: formula, valor o vacio, y
 * el formato. No alcanza con _revertirEscriturasSyf: aca hay celdas cuyo estado previo era un
 * VALOR (el texto viejo de F10) y setFormula('') lo perderia.
 */
function _revertirEscriturasIp(ss, escritas) {
    escritas.forEach(function (w) {
        try {
            const r = ss.getSheetByName(w.nombreHoja).getRange(w.celda);
            if (w.esFormato) { r.setNumberFormat(w.previoFormato || 'General'); return; }
            if (w.previa) { r.setFormula(w.previa); return; }
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

/** Solo lectura: preflight + plan + estado de C8/F8. No escribe nada. */
function estadoInicioPresupuesto() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightIp(ss);
        const plan = _planIp(ss, pre);

        const l = ['INICIO: PRESUPUESTO DEL MES Y DELTAS - ESTADO (no se escribio nada)', ''];
        l.push('Revision pedida de C8/F8 (no se tocan):');
        [pre.estadoResumen.saldo, pre.estadoResumen.capital].forEach(function (e) {
            l.push('  ' + e.celda + ': ' + (e.conFormula ? 'con formula' : 'SIN FORMULA') +
                (e.error ? ', en ' + e.error : '') + ', muestra ' + (e.muestra || '(vacio)'));
        });
        l.push('');
        if (!plan.cambios.length) {
            l.push('NADA QUE HACER: el bloque y los tres deltas ya estan como corresponde.');
        } else {
            l.push('CELDAS A ESCRIBIR: ' + plan.cambios.length);
            plan.cambios.forEach(function (c) {
                l.push('  ' + c.celda.padEnd(5) + (c.esFormato ? '[formato] ' : '') + c.nota);
            });
            l.push('');
            l.push('QUE CAMBIA:');
            l.push('  - D19:D21 con lo proyectado del mes (BD de Proyeccion) y D22 el residuo.');
            l.push('  - E19:E21 con la realidad del mes (motor de la hoja) y E22 el residuo.');
            l.push('  - La identidad Ingresos = Fijos + Variables + Capacidad se cumple por');
            l.push('    construccion en las dos columnas, y se verifica al releer los valores.');
            l.push('  - F19:F22 con la barra de cumplimiento; verde a partir del 80% en Ingresos y');
            l.push('    Capitalizacion, verde por debajo del 50% en los dos bloques de gastos.');
            l.push('  - G20:G22 reparten la liquidez de C8 como Tablero!O23:O25; G19 queda vacia.');
            l.push('  - F10, C15 y F15 pasan a ser TEXTO: flecha + tendencia de la ventana de ' +
                IP_MESES_TENDENCIA + ' meses + el promedio de esa ventana. F10 suma ademas cuanto');
            l.push('    capital se inyecto o retiro en el mes elegido (lee E22, no lo recalcula).');
            l.push('    La serie pesada de cada delta se calcula UNA vez, en una celda auxiliar de');
            l.push('    trastienda (AV8/AV9/AV10); las visibles solo la leen.');
        }

        // EL COLOR DE LOS DELTAS. Se reporta SIEMPRE, aunque no haya celdas que escribir: el bug
        // que Franco encontro el 2026-08-21 vivia exactamente aca, en una regla, con las formulas
        // perfectas. Un estado que solo mira formulas no lo habria visto nunca.
        l.push('');
        l.push('COLOR DE LOS DELTAS (reglas de formato condicional):');
        if (_reglasHacenFaltaIp(plan.reglas)) {
            _reglasDeltaIp().forEach(function (r) {
                const sube = r.formula.indexOf('>0') !== -1;
                l.push('  ' + r.celda.padEnd(5) + (sube ? IP_FLECHA_SUBE + ' sube' : IP_FLECHA_BAJA + ' baja') +
                       ' -> ' + r.color + (r.color === IP_COLOR_VERDE ? '  (buena noticia)' : '  (mala noticia)'));
            });
            if (plan.reglas.superadas.length) {
                l.push('');
                l.push('  Se levantan estas reglas viejas, que dejan de servir cuando la flecha');
                l.push('  reemplaza al signo (miran el TEXTO, no el numero):');
                plan.reglas.superadas.forEach(function (x) {
                    l.push('    - "el texto contiene ' + x.foto.valores[0] + '" sobre ' +
                           x.foto.rangos.join(',') + ', texto ' + (x.foto.texto || 'sin color'));
                });
            }
        } else {
            l.push('  Ya estan las seis reglas correctas. Nada que hacer.');
        }
        if (plan.reglas.desbordan.length) {
            l.push('');
            l.push('  NO SE TOCAN (tocan un delta pero se extienden fuera de el, o no son del');
            l.push('  tipo que este modulo sabe reponer):');
            plan.reglas.desbordan.forEach(function (d) {
                l.push('    - ' + d.tipo + ' "' + d.valor + '" sobre ' + d.rangos.join(','));
            });
        }
        l.push('  Reglas ajenas de la hoja que se reponen intactas: ' + plan.reglas.ajenas.length);
        if (pre.avisos.length) {
            l.push('');
            l.push('Avisos:');
            pre.avisos.forEach(function (a) { l.push('  - ' + a); });
        }
        const t = l.join('\n');
        _mostrarIp('Inicio: presupuesto - estado', t);
        logInfo('estadoInicioPresupuesto: ' + plan.cambios.length + ' celda(s) pendientes.');
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarIp('Inicio: presupuesto - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Aplica el bloque y los deltas, con respaldo, verificacion de invariantes y reversion. */
function aplicarInicioPresupuesto() {
    const escritas = [];
    let ui = null, ss = null, yaRevertido = false;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarInicioPresupuesto necesita UI (menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightIp(ss);
        const plan = _planIp(ss, pre);
        const tocarReglas = _reglasHacenFaltaIp(plan.reglas);
        // Se mide ANTES de escribir nada: si Franco ya las tenia ocultas por su cuenta, revertir
        // no tiene que destaparlas -- solo deshace lo que este modulo hizo.
        const colAux = columnLetterToIndex(_colAuxiliaresIp());
        const auxYaOcultaAntes = pre.hoja.isColumnHiddenByUser(colAux) && pre.hoja.isColumnHiddenByUser(colAux + 1);
        if (!plan.cambios.length && !tocarReglas) {
            const t = 'El bloque, los tres deltas y sus colores ya estan como corresponde. No se escribio nada.';
            _mostrarIp('Inicio: presupuesto', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Inicio: presupuesto del mes y deltas',
            'Se van a escribir ' + plan.cambios.length + ' celda(s) de "' + pre.nombre + '"' +
            (tocarReglas ? ', y se rehacen las reglas\nde color de los tres deltas' : '') + '.\n\n' +
            'QUE CAMBIA:\n' +
            '  - El bloque "Presupuesto del Mes." se llena: D con lo proyectado (BD de\n' +
            '    Proyeccion) y E con la realidad (motor de la hoja).\n' +
            '  - EL PLAN ASIGNA, LA REALIDAD SE MIDE: D22 es EL RESIDUO Ingresos - Fijos -\n' +
            '    Variables (la identidad del presupuesto, verificada al releer los valores),\n' +
            '    y E22 MIDE lo que realmente entro a los frascos este mes, con la misma\n' +
            '    formula que Tablero!O19. Por eso E22 puede dar negativo y D22 no.\n' +
            '  - F19:F22 muestran la barra de cumplimiento con el semaforo de cada fila.\n' +
            '  - G20:G22 reparten la liquidez de C8 igual que Tablero!O23:O25; G19 queda\n' +
            '    vacia porque los ingresos no reciben distribucion.\n' +
            '  - F10, C15 y F15 PASAN A SER TEXTO (antes eran numero con formato): flecha +\n' +
            '    tendencia de la ventana de ' + IP_MESES_TENDENCIA + ' meses + el PROMEDIO de esa ventana.\n' +
            '    "' + IP_FLECHA_SUBE + ' 82,0% de tendencia a 6 meses · promedio $1.610.284,12".\n' +
            '  - F10 SUMA UN TERCER DATO: cuanto capital se inyecto o retiro en el mes elegido\n' +
            '    ("$59.989 retirados en Agosto" / "inyectados" / "sin movimientos de capital"),\n' +
            '    leyendo E22 -- no se recalcula, para que no puedan divergir.\n' +
            '  - LA VENTANA DE F10 PASA A ANCLAR AL SELECTOR de mes/anio, igual que C15/F15 (antes\n' +
            '    ataba a HOY). Coincide con hoy en el mes en curso y solo cambia al mirar un mes\n' +
            '    pasado. OJO: F8 (Capital Acumulado) sigue anclado a HOY -- no es de este modulo.\n' +
            '  - La serie pesada de cada delta se calcula UNA sola vez, en una celda auxiliar de\n' +
            '    trastienda (AV8/AV9/AV10, a la derecha del motor de la hoja); las celdas visibles\n' +
            '    solo la leen. Esas columnas QUEDAN OCULTAS, igual que los otros dos motores de\n' +
            '    la hoja: no se ven numeros sueltos a la derecha del lienzo.\n' +
            '  - Y EL COLOR LO DECIDE ESTE MODULO, con una regla NUMERICA por celda que apunta a\n' +
            '    la auxiliar (nunca al texto visible): verde si la noticia es buena, rojo si es\n' +
            '    mala. Ojo que no es lo mismo que la direccion: en Egresos una flecha para ARRIBA\n' +
            '    se pinta ROJA.\n' +
            (plan.reglas.superadas.length
                ? '  - Se levantan ' + plan.reglas.superadas.length + ' regla(s) vieja(s) del tipo "el texto contiene",\n' +
                  '    que dejan de servir en cuanto la flecha reemplaza al signo. Revertir las repone.\n'
                : '') +
            '\nC8 y F8 NO se tocan. No se toca el ledger, la Proyeccion ni el Tablero.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarFormulerio(ss, sello);

        // Los estados previos que el respaldo de formulas NO captura (valores estaticos como el
        // texto viejo de F10, y los formatos) se guardan aparte para la reversion publica.
        const previos = { respaldo: respaldo.nombre, celdas: [] };
        plan.cambios.forEach(function (c) {
            if (c.esFormato) {
                previos.celdas.push({ celda: c.celda, esFormato: true, formato: c.formatoActual || 'General' });
            } else if (c.formulaActual) {
                previos.celdas.push({ celda: c.celda, tenia: 'formula' });
            } else if (String(c.valorActual) !== '') {
                previos.celdas.push({ celda: c.celda, tenia: 'valor', valor: c.valorActual });
            } else {
                previos.celdas.push({ celda: c.celda, tenia: 'vacia' });
            }
        });

        plan.cambios.forEach(function (c) {
            const rango = pre.hoja.getRange(c.celda);
            const errorPrevio = _errorDeCelda(rango);
            if (c.esFormato) rango.setNumberFormat(c.formatoNuevo);
            else rango.setFormula(c.formulaNueva);
            escritas.push({
                nombreHoja: pre.nombre, celda: c.celda, esFormato: !!c.esFormato,
                previa: c.formulaActual, previoValor: c.valorActual, previoFormato: c.formatoActual,
                nueva: c.esFormato ? c.formatoNuevo : c.formulaNueva,
                errorPrevio: errorPrevio
            });
        });

        // LAS REGLAS DE COLOR. Las ajenas se reponen POR REFERENCIA y primero, intactas y en su
        // orden: setConditionalFormatRules reemplaza TODAS las de la hoja, y perder las del
        // calendario (J8:P14) seria un destrozo silencioso. Las superadas quedan fuera, pero se
        // guarda su foto para poder reponerlas al revertir.
        previos.reglas = null;
        if (tocarReglas) {
            const nuevasReglas = _reglasDeltaIp().map(function (item) {
                return _construirReglaDeltaIp(pre.hoja, item);
            });
            pre.hoja.setConditionalFormatRules(plan.reglas.ajenas.concat(nuevasReglas));
            previos.reglas = {
                superadas: plan.reglas.superadas.map(function (x) { return x.foto; })
            };
        }

        // LAS AUXILIARES (AV:AW) QUEDAN OCULTAS, igual que los otros dos motores de la hoja (ver
        // "QUEDAN OCULTAS" en la cabecera de IP_AUX). previos.auxOcultaPorModulo solo es true si
        // ESTE modulo fue quien las oculto: si Franco ya las tenia ocultas, revertir no las toca.
        _ocultarAuxiliaresIp(pre.hoja);
        previos.auxOcultaPorModulo = !auxYaOcultaAntes;
        SpreadsheetApp.flush();

        // Texto y estado de cada celda escrita, MAS los invariantes sobre los valores releidos.
        // Los invariantes distinguen FALLAS de PENDIENTES: una celda que todavia esta calculando
        // una custom function no es un error, y revertir por eso destruiria formulas correctas.
        const inv = _verificarInvariantesIp(pre.hoja);
        const fallas = _verificarEscrituraSyf(ss, escritas).concat(inv.fallas);
        const pendientes = inv.avisos;

        if (fallas.length) {
            _revertirEscriturasIp(ss, escritas);
            yaRevertido = true;
            throw new Error('Se escribio pero NO VERIFICA: ' + fallas.join('; ') +
                '. Se restauro cada celda. El respaldo quedo en "' + respaldo.nombre + '".');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(IP_PROP_RESPALDO, respaldo.nombre);
        props.setProperty(IP_PROP_PREVIOS, JSON.stringify(previos));

        const filas = IP_BLOQUE.filas;
        const detalle = 'INICIO: PRESUPUESTO DEL MES Y DELTAS APLICADOS\n\n' +
            (pendientes.length
                // El encabezado NO puede atribuirle una causa unica a la lista: ahi caen tanto los
                // invariantes que no se pudieron comprobar (cotizaciones todavia calculando) como
                // los datos informativos, y el 2026-08-21 el titulo dijo "las cotizaciones seguian
                // calculando" arriba de un aviso que no tenia nada que ver con cotizaciones.
                ? 'PARA LEER (' + pendientes.length + '). Las formulas quedaron escritas; esto NO\n' +
                  'es un error:\n' +
                  pendientes.map(function (a) { return '  - ' + a; }).join('\n') + '\n\n'
                : '') +
            '- Celdas escritas y verificadas: ' + escritas.length + '\n' +
            '- Respaldo en la hoja oculta "' + respaldo.nombre + '"\n' +
            '- Identidad del PLAN verificada al releer: D' + filas.ingresos.fila + ' = D' + filas.fijos.fila +
            ' + D' + filas.variables.fila + ' + D' + filas.capitalizacion.fila + '\n' +
            '  (en E no aplica: ahi la capitalizacion se MIDE, no es el residuo)\n' +
            '- C8 revisada: ' + (pre.estadoResumen.saldo.error ? 'en ' + pre.estadoResumen.saldo.error :
                'con formula, muestra ' + pre.estadoResumen.saldo.muestra) + '\n' +
            '- F8 revisada: ' + (pre.estadoResumen.capital.conFormula ?
                'con formula, muestra ' + pre.estadoResumen.capital.muestra : 'SIN FORMULA (reponerla con Stock y Flujo)') + '\n\n' +
            'QUE MIRAR:\n' +
            '  1. D22 y E22 pueden dar NEGATIVO: es la senal de un mes sobrecomprometido, no un error.\n' +
            '  2. Las barras de F: en Gastos, verde por debajo del 50% de consumo, naranja hasta 80% y\n' +
            '     rojo arriba. En Ingresos y Capitalizacion la escala se da vuelta: verde del 80% de\n' +
            '     cumplimiento para arriba.\n' +
            '  3. G20+G21+G22 tiene que dar exactamente el Saldo Actual de C8, siempre.\n' +
            '  4. F10, C15 y F15 muestran flecha + x,x% de tendencia a ' + IP_MESES_TENDENCIA + ' meses + el\n' +
            '     promedio de la ventana. F10 suma cuanto capital se inyecto/retiro en el mes\n' +
            '     elegido. Si alguna muestra "Loading..." es la cotizacion todavia resolviendo,\n' +
            '     no un error -- se corrige sola al reabrir o recalcular la hoja.\n' +
            '  5. Las columnas AV:AW (la trastienda de los tres deltas) tienen que quedar OCULTAS.\n\n' +
            'Si algo quedo peor: revertirInicioPresupuesto (menu Tidetrack Dev).';

        logSuccess('aplicarInicioPresupuesto: ' + escritas.length + ' celda(s).');
        _mostrarIp('Inicio: presupuesto - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && escritas.length && !yaRevertido) {
            try { _revertirEscriturasIp(ss, escritas); restaurado = ' Se restauraron las celdas ya escritas.'; }
            catch (e2) { restaurado = ' ADEMAS fallo la restauracion (' + e2.message + ').'; }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack });
        _mostrarIp('Inicio: presupuesto - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Vuelve al estado previo a la ultima corrida aplicada: las formulas desde el respaldo, los
 * valores estaticos y formatos desde el registro propio (el respaldo de formulas no los
 * captura, y F10 era un texto).
 */
function revertirInicioPresupuesto() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const crudo = props.getProperty(IP_PROP_PREVIOS);
        if (!crudo) throw new Error('No hay ninguna corrida registrada de este modulo.');
        const previos = JSON.parse(crudo);

        const hoja = ss.getSheetByName(NAV_CONFIG.SHEETS.INICIO);
        if (!hoja) throw new Error('No existe la hoja "' + NAV_CONFIG.SHEETS.INICIO + '".');

        const resp = ss.getSheetByName(previos.respaldo);
        const filasRespaldo = resp ? _leerRespaldoFormulerio(resp) : [];

        let repuestas = 0;
        const faltantes = [];
        previos.celdas.forEach(function (p) {
            const rango = hoja.getRange(p.celda);
            if (p.esFormato) { rango.setNumberFormat(p.formato || 'General'); repuestas++; return; }
            if (p.tenia === 'formula') {
                const fila = filasRespaldo.find(function (f) {
                    return f.nombreHoja === NAV_CONFIG.SHEETS.INICIO && f.celda === p.celda;
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

        // LAS REGLAS DE COLOR: se quitan las propias y se reponen las que se habian levantado.
        // Las ajenas nunca se reconstruyen -- se pasan por referencia --, asi que no hay forma
        // de que revertir dane el calendario ni ninguna otra regla que este modulo no escribio.
        let reglasQuitadas = 0, reglasRepuestas = 0;
        if (previos.reglas) {
            const clases = _clasificarReglasIp(hoja.getConditionalFormatRules());
            reglasQuitadas = clases.propias.length;
            const repuestas2 = (previos.reglas.superadas || []).map(function (foto) {
                return _reponerReglaSuperadaIp(hoja, foto);
            });
            reglasRepuestas = repuestas2.length;
            hoja.setConditionalFormatRules(clases.ajenas.concat(repuestas2));
        }

        // LAS AUXILIARES: se destapan SOLO si fue este modulo el que las oculto (previos.
        // auxOcultaPorModulo). Si Franco ya las tenia ocultas por su cuenta antes de aplicar,
        // revertir no le toca esa decision.
        let auxDestapadas = false;
        if (previos.auxOcultaPorModulo) {
            _mostrarAuxiliaresIp(hoja);
            auxDestapadas = true;
        }
        SpreadsheetApp.flush();
        props.deleteProperty(IP_PROP_PREVIOS);

        const t = 'INICIO: PRESUPUESTO REVERTIDO\n\n- Celdas repuestas: ' + repuestas + '\n' +
            (previos.reglas
                ? '- Reglas de color quitadas: ' + reglasQuitadas +
                  '; reglas viejas repuestas: ' + reglasRepuestas + '\n'
                : '') +
            (auxDestapadas ? '- Columnas auxiliares (AV:AW) repuestas visibles (este modulo las habia ocultado)\n' : '') +
            (faltantes.length ? '- SIN respaldo (quedaron como estan): ' + faltantes.join(', ') + '\n' : '') +
            '- Respaldo usado: "' + previos.respaldo + '"' + (resp ? '' : ' (la hoja ya no existe)');
        logSuccess('revertirInicioPresupuesto: ' + repuestas + ' celda(s).');
        _mostrarIp('Inicio: presupuesto - revertido', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarIp('Inicio: presupuesto - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarIp(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
