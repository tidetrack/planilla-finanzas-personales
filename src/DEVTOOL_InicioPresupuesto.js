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
 * Ademas, los tres deltas del resumen:
 *   F10  DELTA CAPITAL   crecimiento del capital actual contra la MEDIA de los cierres de los
 *                        6 meses previos completos. Reemplaza el texto estatico "0% de
 *                        Crecimiento historico".
 *   C15  DELTA INGRESOS  ingresos del mes contra la media mensual de los 6 meses previos.
 *   F15  DELTA EGRESOS   idem egresos. C15 y F15 REEMPLAZAN formulas rotas: las vivas muestran
 *                        "0%" siempre porque sus condiciones de FILTER caen en interseccion
 *                        implicita (diagnostico en DEVTOOL_FormulerioV0111, defecto quinto).
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
 * - decision Franco 2026-08-20: F10 es un STOCK (capital), asi que ancla a TODAY() y no al
 *   selector de mes -- los stocks no se filtran por periodo (regla de DEVTOOL_StockYFlujo).
 *   El capital al cierre de cada mes previo aplica la MISMA regla del ultimo "Inicio Mes" por
 *   medio, con el corte acotado a la fecha de cierre. Los tres deltas son COCIENTES: se
 *   calculan en ARS (F10 con TIDETRACK en vivo, C15/F15 con los TC congelados de cada fila,
 *   patron de Inicio!AF8) y el resultado no depende del selector de moneda.
 * - C8:E9 y F8:H9 NO se tocan: Franco pidio revisarlas, no reescribirlas. El preflight verifica
 *   que tengan formula y el dialogo reporta su estado. Sus formulas son de DEVTOOL_StockYFlujo.
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
 * (DEVTOOL_StockYFlujo).
 *
 * @see docs/permanente/FUNCIONALIDADES.md
 * @version 0.31.0
 * @since 2026-08-20
 * @lastModified 2026-08-20
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
    filas: {
        ingresos:       { fila: 19, rotulo: 'Ingresos' },
        fijos:          { fila: 20, rotulo: 'Gastos Fijos' },
        variables:      { fila: 21, rotulo: 'Gastos Variables' },
        capitalizacion: { fila: 22, rotulo: 'Capacidad de Capitalizacion' }
    }
};

/**
 * El resumen de la portada. C8 y F8 son de DEVTOOL_StockYFlujo: se VERIFICAN (que tengan
 * formula) y se reportan, jamas se escriben. F10, C15 y F15 si son de este modulo.
 */
const IP_RESUMEN = {
    saldo:        { celda: 'C8',  rotulo: { celda: 'C7',  esperado: 'Saldo Actual' } },
    capital:      { celda: 'F8',  rotulo: { celda: 'F7',  esperado: 'Capital Acumulado' } },
    deltaCapital: { celda: 'F10', nota: 'Delta capital vs media de 6 meses' },
    deltaIngresos: { celda: 'C15', rotulo: { celda: 'C12', esperado: 'Ingresos' }, nota: 'Delta ingresos vs media de 6 meses' },
    deltaEgresos:  { celda: 'F15', rotulo: { celda: 'F12', esperado: 'Egresos' }, nota: 'Delta egresos vs media de 6 meses' }
};

/**
 * El motor de la hoja: T8 derrama Registros del mes (12 columnas espejo de B:M) y AF8 es la
 * conversion con TC congelados. Las letras de las columnas consumidas NO se hardcodean: se
 * derivan de RANGES.REGISTROS por offset, y el preflight las verifica contra los rotulos vivos.
 */
const IP_MOTOR = { colBloque: 'T', colValor: 'AF', filaHeader: 7, filaDatos: 8 };

/** Semaforo del consumo, calcado de la planilla anterior. Umbrales como fracciones (ver cabecera). */
const IP_COLOR_VERDE = '#a9bca1';
const IP_COLOR_NARANJA = '#db9940';
const IP_COLOR_ROJO = '#da8b7b';

/** Cantidad de meses previos completos que promedian los tres deltas. */
const IP_MESES_MEDIA = 6;

/** Formato de los tres deltas, tal cual lo pidio Franco. Se escribe, verifica y revierte. */
const IP_FORMATO_DELTA = '+0,0%;-0,0%';

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
 * La barra de consumo (F19:F22): SPARKLINE tipo bar de E/D acotado 0..1, semaforo de la
 * planilla anterior. Las opciones van con VSTACK/HSTACK: un array literal {} no lo traduce
 * setFormula en es_AR (trampa 1). Umbrales como fracciones (ver cabecera).
 */
function _formulaConsumoIp(fila) {
    const refReal = '$' + IP_BLOQUE.colRealidad + '$' + fila;
    const refPresu = '$' + IP_BLOQUE.colPresupuesto + '$' + fila;
    return '=LET(\n' +
        '  consumo; IFERROR(MAX(0; MIN(1; ' + refReal + ' / ' + refPresu + ')); 0);\n' +
        '  color_nivel; IF(consumo < 1/2; "' + IP_COLOR_VERDE + '"; IF(consumo <= 4/5; "' + IP_COLOR_NARANJA + '"; "' + IP_COLOR_ROJO + '"));\n' +
        '  SPARKLINE(consumo; VSTACK(HSTACK("charttype"; "bar"); HSTACK("max"; 1); HSTACK("color1"; color_nivel)))\n)';
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
 * DELTA CAPITAL (F10): capital actual contra la media de los cierres de los 6 meses previos
 * completos. El capital de una fecha aplica la MISMA regla de saldo del sistema (el ultimo
 * "Inicio Mes" de cada medio + lo posterior, validada al centavo en DEVTOOL_StockYFlujo) con
 * el corte y los movimientos acotados a esa fecha, sobre los medios de la lista blanca
 * TIPOS_RIQUEZA. Se calcula en ARS: el delta es un cociente y la conversion se cancela.
 * MAP/LAMBDA sobre SEQUENCE(6), sin arrays literales. Ancla a TODAY(), no al selector: es un
 * stock (ver cabecera).
 */
function _formulaDeltaCapitalIp() {
    const medios = RANGES.MEDIOS_PAGO;
    const colTipoMedio = columnLetterToIndex(medios.columns.proyecto) - columnLetterToIndex(medios.start) + 1;
    const rangoMedios = _refHoja(medios.sheet) + '!' + medios.start + ':' + medios.end;
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
        '  capital_hoy; capital_al(TODAY());\n' +
        '  cierres_previos; MAP(SEQUENCE(' + IP_MESES_MEDIA + '); LAMBDA(mes_atras; capital_al(EOMONTH(TODAY(); -mes_atras))));\n' +
        '  media_hist; AVERAGE(cierres_previos);\n' +
        '  IF(media_hist=0; IF(capital_hoy>0; 1; 0); capital_hoy / media_hist - 1)\n)';
}

/**
 * DELTA DE FLUJO (C15 ingresos / F15 egresos): el mes del selector contra la media mensual de
 * los 6 meses previos completos, directo desde Registros. Cada fila se lleva a ARS con SU TC
 * congelado (patron de Inicio!AF8: las columnas J:M congelan la cotizacion del dia del
 * registro). Excluye cuentas neutras y filas sin cuenta, como los bloques del mes.
 * REEMPLAZA la formula rota actual (interseccion implicita, siempre "0%"): aca toda condicion
 * ligada a LET va en ARRAYFORMULA y las de FILTER van inline, que es lo que ya funciona en C8.
 */
function _formulaDeltaFlujoIp(esIngresos) {
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
        '  desde_act; DATE(' + selAnio + '; mes_num; 1);\n' +
        '  hasta_act; EOMONTH(desde_act; 0);\n' +
        '  desde_prev; EDATE(desde_act; -' + IP_MESES_MEDIA + ');\n' +
        '  base_mov; ARRAYFORMULA(' + cond + ' * ' + _exclusionNeutrasIp('col_cuenta') + ' * (col_cuenta<>""));\n' +
        '  monto_actual; SUM(IFERROR(FILTER(neto_valor; base_mov; col_fecha>=desde_act; col_fecha<=hasta_act); 0));\n' +
        '  monto_previos; SUM(IFERROR(FILTER(neto_valor; base_mov; col_fecha>=desde_prev; col_fecha<desde_act); 0));\n' +
        '  media_prev; monto_previos / ' + IP_MESES_MEDIA + ';\n' +
        '  IF(media_prev=0; IF(monto_actual>0; 1; 0); monto_actual / media_prev - 1)\n)';
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
    const proponerFormato = function (celda, nota) {
        const vivo = pre.hoja.getRange(celda).getNumberFormat();
        if (vivo === IP_FORMATO_DELTA) return;
        cambios.push({
            celda: celda, nota: nota, esFormato: true,
            formatoActual: vivo, formatoNuevo: IP_FORMATO_DELTA,
            formulaActual: '', formulaNueva: '',
            resumen: 'el delta se muestra como porcentaje con signo'
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
    proponer(IP_BLOQUE.colRealidad + filas.capitalizacion.fila, 'Realidad: ' + filas.capitalizacion.rotulo,
        _formulaResiduoIp(IP_BLOQUE.colRealidad),
        'idem sobre lo que realmente paso');

    // --- Columna F: la barra de consumo ---
    Object.keys(filas).forEach(function (k) {
        proponer(IP_BLOQUE.colConsumo + filas[k].fila, 'Consumo: ' + filas[k].rotulo,
            _formulaConsumoIp(filas[k].fila),
            'barra de E/D acotada 0..1 con el semaforo de la planilla anterior');
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

    // --- Los tres deltas del resumen ---
    proponer(IP_RESUMEN.deltaCapital.celda, IP_RESUMEN.deltaCapital.nota,
        _formulaDeltaCapitalIp(),
        'capital de hoy contra la media de los cierres de los ' + IP_MESES_MEDIA + ' meses previos');
    proponer(IP_RESUMEN.deltaIngresos.celda, IP_RESUMEN.deltaIngresos.nota,
        _formulaDeltaFlujoIp(true),
        'ingresos del mes contra su media de ' + IP_MESES_MEDIA + ' meses; reemplaza la formula rota');
    proponer(IP_RESUMEN.deltaEgresos.celda, IP_RESUMEN.deltaEgresos.nota,
        _formulaDeltaFlujoIp(false),
        'egresos del mes contra su media de ' + IP_MESES_MEDIA + ' meses; reemplaza la formula rota');

    // --- El formato de los tres deltas es parte del plan (se verifica y se revierte) ---
    proponerFormato(IP_RESUMEN.deltaCapital.celda, 'Formato del delta de capital');
    proponerFormato(IP_RESUMEN.deltaIngresos.celda, 'Formato del delta de ingresos');
    proponerFormato(IP_RESUMEN.deltaEgresos.celda, 'Formato del delta de egresos');

    return { cambios: cambios };
}

// ============================================
// VERIFICACION E INVARIANTES
// ============================================

/**
 * Los invariantes del bloque, sobre los VALORES releidos (no sobre el texto):
 *   1. IDENTIDAD: |D19-D20-D21-D22| < 0.01, y lo mismo en E. Es la definicion del bloque.
 *   2. G19 queda vacia (los ingresos no reciben distribucion).
 *   3. G20+G21+G22 = C8 (el reparto ni pierde ni inventa plata), si C8 es numerico.
 *   4. Los tres deltas son numeros finitos.
 */
function _verificarInvariantesIp(hoja) {
    const fallas = [];
    const filas = IP_BLOQUE.filas;
    const orden = ['ingresos', 'fijos', 'variables', 'capitalizacion'];
    const leer = function (celda) { return hoja.getRange(celda).getValue(); };

    [[IP_BLOQUE.colPresupuesto, 'Presupuesto'], [IP_BLOQUE.colRealidad, 'Realidad']].forEach(function (par) {
        const col = par[0];
        const vals = orden.map(function (k) { return leer(col + filas[k].fila); });
        if (vals.some(function (v) { return typeof v !== 'number' || !isFinite(v); })) {
            fallas.push('la columna ' + par[1] + ' (' + col + ') no releyo numeros en las cuatro filas');
            return;
        }
        const desvio = Math.abs(vals[0] - vals[1] - vals[2] - vals[3]);
        if (desvio >= IP_UMBRAL_IDENTIDAD) {
            fallas.push('la identidad de ' + par[1] + ' no cierra: |' + col + filas.ingresos.fila +
                '-' + col + filas.fijos.fila + '-' + col + filas.variables.fila + '-' +
                col + filas.capitalizacion.fila + '| = ' + desvio.toFixed(4));
        }
    });

    const g19 = leer(IP_BLOQUE.colDistribucion + filas.ingresos.fila);
    if (String(g19) !== '') {
        fallas.push('G' + filas.ingresos.fila + ' (Distribucion de Ingresos) tendria que quedar vacia y muestra "' + g19 + '"');
    }

    const repartos = ['fijos', 'variables', 'capitalizacion'].map(function (k) {
        return leer(IP_BLOQUE.colDistribucion + filas[k].fila);
    });
    if (repartos.some(function (v) { return typeof v !== 'number' || !isFinite(v); })) {
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

    [IP_RESUMEN.deltaCapital, IP_RESUMEN.deltaIngresos, IP_RESUMEN.deltaEgresos].forEach(function (d) {
        const v = leer(d.celda);
        if (typeof v !== 'number' || !isFinite(v)) {
            fallas.push(d.celda + ' (' + d.nota + ') no releyo un numero');
        }
    });

    return fallas;
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
            l.push('  - F19:F22 con la barra de consumo (verde/naranja/rojo como la planilla vieja).');
            l.push('  - G20:G22 reparten la liquidez de C8 como Tablero!O23:O25; G19 queda vacia.');
            l.push('  - F10, C15 y F15 pasan a ser deltas contra la media de ' + IP_MESES_MEDIA + ' meses,');
            l.push('    con formato ' + IP_FORMATO_DELTA + '. C15/F15 reemplazan formulas rotas (0% eterno).');
        }
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
        if (!plan.cambios.length) {
            const t = 'El bloque y los tres deltas ya estan como corresponde. No se escribio nada.';
            _mostrarIp('Inicio: presupuesto', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Inicio: presupuesto del mes y deltas',
            'Se van a escribir ' + plan.cambios.length + ' celda(s) de "' + pre.nombre + '".\n\n' +
            'QUE CAMBIA:\n' +
            '  - El bloque "Presupuesto del Mes." se llena: D con lo proyectado (BD de\n' +
            '    Proyeccion), E con la realidad (motor de la hoja), y en las dos columnas la\n' +
            '    Capacidad de Capitalizacion es EL RESIDUO Ingresos - Fijos - Variables:\n' +
            '    la identidad del presupuesto, verificada al releer los valores.\n' +
            '  - F19:F22 muestran la barra de consumo con el semaforo de la planilla vieja.\n' +
            '  - G20:G22 reparten la liquidez de C8 igual que Tablero!O23:O25; G19 queda\n' +
            '    vacia porque los ingresos no reciben distribucion.\n' +
            '  - F10 deja de decir "0% de Crecimiento historico": pasa a medir el capital de\n' +
            '    hoy contra la media de los ultimos ' + IP_MESES_MEDIA + ' meses.\n' +
            '  - C15 y F15 REEMPLAZAN las formulas rotas (hoy dan 0% siempre) por el delta\n' +
            '    contra la media de ' + IP_MESES_MEDIA + ' meses. Los tres deltas quedan con formato ' + IP_FORMATO_DELTA + '.\n\n' +
            'C8 y F8 NO se tocan. No se toca el ledger, la Proyeccion ni el Tablero.\n\nContinuar?',
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
        SpreadsheetApp.flush();

        // Texto y estado de cada celda escrita, MAS los invariantes sobre los valores releidos.
        const fallas = _verificarEscrituraSyf(ss, escritas)
            .concat(_verificarInvariantesIp(pre.hoja));

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
            '- Celdas escritas y verificadas: ' + escritas.length + '\n' +
            '- Respaldo en la hoja oculta "' + respaldo.nombre + '"\n' +
            '- Identidad verificada al releer: D' + filas.ingresos.fila + ' = D' + filas.fijos.fila +
            ' + D' + filas.variables.fila + ' + D' + filas.capitalizacion.fila + ' (y lo mismo en E)\n' +
            '- C8 revisada: ' + (pre.estadoResumen.saldo.error ? 'en ' + pre.estadoResumen.saldo.error :
                'con formula, muestra ' + pre.estadoResumen.saldo.muestra) + '\n' +
            '- F8 revisada: ' + (pre.estadoResumen.capital.conFormula ?
                'con formula, muestra ' + pre.estadoResumen.capital.muestra : 'SIN FORMULA (reponerla con Stock y Flujo)') + '\n\n' +
            'QUE MIRAR:\n' +
            '  1. D22 y E22 pueden dar NEGATIVO: es la senal de un mes sobrecomprometido, no un error.\n' +
            '  2. Las barras de F: verde por debajo del 50% de consumo, naranja hasta 80%, rojo arriba.\n' +
            '  3. G20+G21+G22 tiene que dar exactamente el Saldo Actual de C8, siempre.\n' +
            '  4. F10, C15 y F15 muestran +x,x% o -x,x% contra la media de ' + IP_MESES_MEDIA + ' meses.\n\n' +
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
        SpreadsheetApp.flush();
        props.deleteProperty(IP_PROP_PREVIOS);

        const t = 'INICIO: PRESUPUESTO REVERTIDO\n\n- Celdas repuestas: ' + repuestas + '\n' +
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
