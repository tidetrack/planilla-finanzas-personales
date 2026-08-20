/**
 * 99_MigrationLogic.js
 * Utilidades transitorias/dev para la migración de la BD Legacy "BD antigua".
 *
 * [CONCEPTO DE NEGOCIO]
 * Herramientas de ejecucion puntual para incorporar el historial de la planilla vieja al
 * ledger vigente y para recalcular en bloque los tipos de cambio congelados de Registros.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * El origen (BD Antigua) conserva su layout historico (datos desde la fila 2, cols A:G).
 * El destino (Registros) se movio ya dos veces (v0.9.5 y el swap v0.11), asi que este modulo
 * NO repite su geometria: escribir con coordenadas viejas corrompe el ledger, y por eso toda
 * coordenada de destino -- columnas Y fila de datos -- sale de RANGES.REGISTROS en vivo.
 * La unica fuente de esa geometria es 00_Config.js.
 *
 * @see 00_Config.js (RANGES.REGISTROS)
 *
 * @version 0.11.1
 * @since 0.1.0
 * @lastModified 2026-08-18
 */

/**
 * Analiza faltantes en el Plan de Cuentas actual vs la BD antigua.
 * Las Cuentas faltantes se listan en H2:H de BD antigua.
 * Los Medios faltantes se insertan en MEDIOS_PAGO con moneda ARS por defecto.
 */
function analizarBdAntigua() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bdSheet = ss.getSheetByName(SHEETS.BD_ANTIGUA);
    
    if (!bdSheet) {
        SpreadsheetApp.getUi().alert("No se encontró la hoja 'BD antigua'.");
        return;
    }

    const lastRow = bdSheet.getLastRow();
    if (lastRow < 2) return;

    // Extraer Detalles (Col D) y Medios (Col E)
    // A=0, B=1, C=2, D=3, E=4
    const dataRange = bdSheet.getRange(2, 4, lastRow - 1, 2); 
    const data = dataRange.getValues();

    const uniqueCuentas = [...new Set(data.map(r => r[0]).filter(v => v !== ''))];
    const uniqueMedios = [...new Set(data.map(r => r[1]).filter(v => v !== ''))];

    // Cargar Plan de Cuentas Actual
    const pcIngresos = getTableData('INGRESOS').map(r => r[0]);
    const pcFijos = getTableData('GASTOS_FIJOS').map(r => r[0]);
    const pcVariables = getTableData('GASTOS_VARIABLES').map(r => r[0]);
    const pcAllCuentas = [...pcIngresos, ...pcFijos, ...pcVariables];
    
    const pcMediosData = getTableData('MEDIOS_PAGO'); // [Nombre, Moneda, Proyecto]
    const pcAllMedios = pcMediosData.map(r => r[0]);

    // Faltantes de Cuentas
    const cuentasFaltantes = uniqueCuentas.filter(c => !pcAllCuentas.includes(c));
    
    // Anotar en Columna H (8) de BD antigua
    bdSheet.getRange('H:H').clearContent();
    bdSheet.getRange('H1').setValue('Cuentas Faltantes');
    if (cuentasFaltantes.length > 0) {
        const cuentasArr = cuentasFaltantes.map(c => [c]);
        bdSheet.getRange(2, 8, cuentasArr.length, 1).setValues(cuentasArr);
    }

    // Faltantes de Medios
    const mediosFaltantes = uniqueMedios.filter(m => !pcAllMedios.includes(m));
    if (mediosFaltantes.length > 0) {
        const mediosToAppend = mediosFaltantes.map(m => [m, 'ARS', '']); // Nombre, Moneda ARS, Proyecto vacio
        // Sin minRow explicito: MEDIOS_PAGO no declara dataRow y cae al default del Plan de Cuentas (4).
        appendMassive('MEDIOS_PAGO', mediosToAppend);
    }

    SpreadsheetApp.getUi().alert(
        'Análisis Completo',
        `Medios agregados automáticamente en Plan de Cuentas: ${mediosFaltantes.length}\n` +
        `Cuentas faltantes listadas en la Columna H de "BD antigua": ${cuentasFaltantes.length}\n\n` +
        `Por favor, agrega manualmente estas cuentas al Plan de Cuentas antes de ejecutar la Migración defintiva.`,
        SpreadsheetApp.getUi().ButtonSet.OK
    );
}

/**
 * Migra fila por fila hacia la DB Registros. 
 * Asume que ya se ejecutó forzarCargaHistorica().
 */
function migrarBdAntigua() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert('Precaución', '¿Verificaste que agregaste todas las Cuentas faltantes al Plan de Cuentas? Si faltan cuentas, el sistema se verá obligado a ignorarlas y listarlas como Sin Clasificar.', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bdSheet = ss.getSheetByName(SHEETS.BD_ANTIGUA);
    const lastRow = bdSheet.getLastRow();
    if (lastRow < 2) return;

    ss.toast("Procesando Migración Masiva...", "En progreso", 10);

    const oldData = bdSheet.getRange(2, 1, lastRow - 1, 7).getValues(); 
    // A=0(Fecha), B=1(Ing), C=2(Egr), D=3(Cuenta), E=4(Medio), F=5(Ignorar), G=6(Nota)

    // Diccionarios actuales de Cotizaciones
    const tcUsdData = getTableData('TC_USD');
    const tcAudData = getTableData('TC_AUD');
    const tcEurData = getTableData('TC_EUR');
    
    // Hash Maps rápidos
    const cacheMap = { USD: {}, AUD: {}, EUR: {} };
    tcUsdData.forEach(r => { if (r[0]) cacheMap.USD[formatDateISO(r[0])] = r[1]; });
    tcAudData.forEach(r => { if (r[0]) cacheMap.AUD[formatDateISO(r[0])] = r[1]; });
    tcEurData.forEach(r => { if (r[0]) cacheMap.EUR[formatDateISO(r[0])] = r[1]; });

    const ingresosCat = getTableData('INGRESOS').map(r => r[0]);
    const fijosCat = getTableData('GASTOS_FIJOS').map(r => r[0]);
    const variablesCat = getTableData('GASTOS_VARIABLES').map(r => r[0]);

    // Mapa de Medios -> Moneda
    const pcMediosData = getTableData('MEDIOS_PAGO');
    const medioToCurrency = {};
    pcMediosData.forEach(m => { medioToCurrency[m[0]] = m[1] || 'ARS'; });

    const registrosToAppend = [];
    let fallbackCounter = 0;
    const fechasSinTc = [];   // fechas sin cotizacion real: si hay alguna, se aborta sin escribir

    oldData.forEach(row => {
        let rawDate = row[0];
        if (!rawDate) return;
        
        let dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) return;

        let monto = 0;
        let tipo = '';
        if (row[1] !== '' && row[1] > 0) { // Hay Ingreso
            monto = row[1];
            tipo = 'Ingreso';
        } else if (row[2] !== '' && row[2] > 0) { // Hay Egreso
            monto = row[2];
            tipo = 'Egreso';
        } else {
            return; // ignorar fila sin montos
        }

        const cuenta = row[3] || 'Desconocida';
        let tipoCuenta = 'Sin Clasificar';
        if (ingresosCat.includes(cuenta)) tipoCuenta = 'Ingreso';
        else if (fijosCat.includes(cuenta)) tipoCuenta = 'Gasto Fijo';
        else if (variablesCat.includes(cuenta)) tipoCuenta = 'Gasto Variable';

        const medio = row[4];
        let moneda = medioToCurrency[medio] || 'ARS';
        const nota = row[6] || '';

        const dateStr = formatDateISO(dateObj);

        // Uso de caché pre-llenada por forzarCargaHistorica(). 
        // Si no se encuentra, usa fallback genérico
        let tcUsd = cacheMap.USD[dateStr];
        let tcAud = cacheMap.AUD[dateStr];
        let tcEur = cacheMap.EUR[dateStr];
        
        // decision Franco 2026-08-18: ante una cotizacion ausente se ABORTA, no se inventa.
        // Antes se asignaban 1050/650/1100, numeros sin ningun respaldo que quedaban CONGELADOS
        // en el registro: el TC congelado es el unico dato del ledger que despues no se puede
        // recalcular, asi que un valor fabricado es un error permanente e invisible. Es la misma
        // decision que ya se tomo para el hardcode 1000 de fetchArsRate (Regla Estricta 9).
        if (!tcUsd || !tcAud || !tcEur) {
            fallbackCounter++;
            const faltan = [];
            if (!tcUsd) faltan.push('USD');
            if (!tcAud) faltan.push('AUD');
            if (!tcEur) faltan.push('EUR');
            if (fechasSinTc.length < 20) fechasSinTc.push(dateStr + ' (' + faltan.join(', ') + ')');
        }

        registrosToAppend.push([
            monto, tipo, cuenta, tipoCuenta, medio, moneda, dateObj, nota,
            1.0, tcUsd, tcAud, tcEur
        ]);
    });

    if (registrosToAppend.length > 0) {
        // Datos de Registros desde la fila 6 (header en la 5) en el layout migrado.
    // ABORTO TODO-O-NADA: si falto la cotizacion de alguna fecha, no se escribe NADA.
        // Escribir "lo que se pudo" dejaria un ledger mezclado -- parte con TC reales y parte sin --
        // imposible de distinguir despues sin auditar fila por fila.
        if (fechasSinTc.length > 0) {
            const detalle = fechasSinTc.join('\n  ') + (fallbackCounter > fechasSinTc.length
                ? '\n  ... y ' + (fallbackCounter - fechasSinTc.length) + ' fecha(s) mas' : '');
            logError('migrarBdAntigua: abortada, faltan cotizaciones en el Data Lake', {
                fechasAfectadas: fallbackCounter, muestra: fechasSinTc
            });
            ui.alert(
                'Faltan cotizaciones: no se escribio nada',
                'Hay ' + fallbackCounter + ' fecha(s) sin cotizacion en la hoja de tipos de cambio.\n\n' +
                'Primeras:\n  ' + detalle + '\n\n' +
                'No se modifico ninguna celda. Corre primero "Tidetrack Dev > Tipos de cambio > ' +
                'Forzar carga historica" para completar el Data Lake, y volve a intentarlo.\n\n' +
                'Antes esta funcion rellenaba los faltantes con valores fijos (1050/650/1100). Esos ' +
                'numeros quedaban congelados en el registro y no se pueden recalcular despues.',
                ui.ButtonSet.OK
            );
            return;
        }

        appendMassive('REGISTROS', registrosToAppend, RANGES.REGISTROS.dataRow);

        // Ordenar BD por Fecha descendente. Layout migrado: B:M = cols 2..13, fecha en H = 8.
        // Sort best-effort: los registros ya estan escritos; un fallo de orden no debe empujar
        // al usuario a re-ejecutar la migracion (duplicaria todo el historico).
        const registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);
        const dataRowReg = RANGES.REGISTROS.dataRow;
        const lastRowReg = registrosSheet.getLastRow();
        if (lastRowReg >= dataRowReg) {
            try {
                const rowCount = lastRowReg - dataRowReg + 1;
                const baseFullRange = registrosSheet.getRange(dataRowReg, 2, rowCount, 12); // B:M
                baseFullRange.sort({ column: 8, ascending: false }); // H = 8 = Fecha
                SpreadsheetApp.flush();
            } catch (sortErr) {
                logError('migrarBdAntigua: sort omitido (posibles celdas combinadas en Registros)', sortErr);
            }
        }
    }

    // Llegar aca implica fallbackCounter === 0: el aborto todo-o-nada de mas arriba retorna
    // ante la primera fecha sin cotizacion. El aviso de "se usaron fallbacks" que vivia aca
    // era inalcanzable desde ese cambio, y un mensaje que no puede dispararse solo confunde
    // al proximo que lea el cierre buscando por que no aparecio.
    ui.alert('Proceso Completo',
             `Se migraron ${registrosToAppend.length} transacciones exitosamente, todas con cotizacion real.`,
             ui.ButtonSet.OK);
}

/**
 * Herramienta [Dev] para recalcular en bloque los TC congelados del ledger Registros.
 *
 * Lee la columna Fecha y reescribe las cuatro columnas de cotizacion con el Data Lake actual.
 * Tres limites deliberados, todos verificados en vivo el 2026-08-18:
 *   1. TODO-O-NADA ante cotizaciones faltantes: si alguna fecha no esta en el Data Lake no se
 *      escribe ninguna celda (antes se rellenaba con 1050/650/1100, valores inventados que
 *      quedaban congelados para siempre).
 *   2. Las filas sin fecha legible se SALTEAN conservando sus cotizaciones, y se cuentan y se
 *      nombran (antes recibian vacios en silencio y se contaban como recalculadas).
 *   3. El alto se acota a la ultima fila con dato en la columna Fecha, no a getLastRow().
 * Toda coordenada sale de RANGES.REGISTROS.
 */
function recalcularTcRegistros() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert('Precaución', '¿Verificaste tener la Caché cargada al 100%? Esta acción sobreescribirá todas las cotizaciones de la Hoja Registros.', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);

    const cfgReg = RANGES.REGISTROS;
    const dataRow = cfgReg.dataRow;
    const colFecha = columnLetterToIndex(cfgReg.columns.fecha);
    const colTcIni = columnLetterToIndex(cfgReg.columns.tc_ars);
    const lastRow = registrosSheet.getLastRow();
    if (lastRow < dataRow) return;

    // decision Franco 2026-08-18: el alto se acota a la ultima fila con dato en la columna
    // FECHA, no a getLastRow(). getLastRow() devuelve la ultima fila con contenido en
    // CUALQUIER columna de la hoja: un valor suelto lejos del ledger (verificado en vivo: un
    // dato en T40) estiraba el rango a J7:M40 para 2 registros reales, y esas 32 filas fuera
    // del ledger recibian escritura. La columna Fecha es la que define hasta donde llega el
    // ledger de verdad: es obligatoria en todo registro que el pipeline escribe.
    const fechasCrudas = registrosSheet.getRange(dataRow, colFecha, lastRow - dataRow + 1, 1).getValues();
    let ultimaConFecha = dataRow - 1;
    for (let i = 0; i < fechasCrudas.length; i++) {
        if (fechasCrudas[i][0] !== '' && fechasCrudas[i][0] !== null) ultimaConFecha = dataRow + i;
    }
    if (ultimaConFecha < dataRow) {
        ui.alert('Nada que recalcular',
                 'No hay ninguna fila con Fecha en "' + SHEETS.REGISTROS + '" desde la fila ' + dataRow +
                 '. No se modifico ninguna celda.', ui.ButtonSet.OK);
        return;
    }
    const rowCount = ultimaConFecha - dataRow + 1;
    const fechasData = fechasCrudas.slice(0, rowCount);

    // Valores actuales de J:M. Son el punto de partida: las filas que no se puedan recalcular
    // conservan EXACTAMENTE lo que ya tenian en vez de recibir vacios.
    const tcRange = registrosSheet.getRange(dataRow, colTcIni, rowCount, 4);
    const tcActuales = tcRange.getValues();

    // Diccionarios actuales de Cotizaciones
    const tcUsdData = getTableData('TC_USD');
    const tcAudData = getTableData('TC_AUD');
    const tcEurData = getTableData('TC_EUR');
    
    const cacheMap = { USD: {}, AUD: {}, EUR: {} };
    tcUsdData.forEach(r => { if (r[0]) cacheMap.USD[formatDateISO(r[0])] = r[1]; });
    tcAudData.forEach(r => { if (r[0]) cacheMap.AUD[formatDateISO(r[0])] = r[1]; });
    tcEurData.forEach(r => { if (r[0]) cacheMap.EUR[formatDateISO(r[0])] = r[1]; });

    const newValues = [];
    let fallbackCounter = 0;
    const fechasSinTc = [];   // fechas sin cotizacion real: si hay alguna, se aborta sin escribir
    const filasSinFecha = []; // numeros de fila que se SALTEAN (fecha vacia o ilegible)

    // decision Franco 2026-08-18: una fila sin fecha legible se SALTEA conservando sus TC, no
    // se blanquea. Antes recibia ['','','',''] en J:M -- destruccion de tipos de cambio
    // congelados, el unico dato del ledger que despues no se puede recalcular -- sin contarse
    // ni avisarse, y el cierre la sumaba a las "recalculadas exitosamente". Era destruccion
    // silenciosa por fuera del guard todo-o-nada que cubre las cotizaciones faltantes.
    fechasData.forEach((row, idx) => {
        const nroFila = dataRow + idx;
        let rawDate = row[0];
        if (!rawDate) {
            newValues.push(tcActuales[idx].slice());
            filasSinFecha.push(nroFila + ' (Fecha vacia)');
            return;
        }

        let dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) {
            newValues.push(tcActuales[idx].slice());
            filasSinFecha.push(nroFila + ' (Fecha ilegible: "' + String(rawDate) + '")');
            return;
        }

        const dateStr = formatDateISO(dateObj);

        let tcUsd = cacheMap.USD[dateStr];
        let tcAud = cacheMap.AUD[dateStr];
        let tcEur = cacheMap.EUR[dateStr];
        
        // decision Franco 2026-08-18: misma regla que en migrarBdAntigua -- sin cotizacion real
        // no se escribe nada. Esta funcion ademas SOBREESCRIBE J:M de todo el ledger, asi que
        // un valor fabricado aca contamina de una vez miles de registros ya validados.
        if (!tcUsd || !tcAud || !tcEur) {
            fallbackCounter++;
            const faltan = [];
            if (!tcUsd) faltan.push('USD');
            if (!tcAud) faltan.push('AUD');
            if (!tcEur) faltan.push('EUR');
            if (fechasSinTc.length < 20) fechasSinTc.push(dateStr + ' (' + faltan.join(', ') + ')');
        }

        // Layout migrado: J=10(ARS), K=11(USD), L=12(AUD), M=13(EUR)
        newValues.push([1.0, tcUsd, tcAud, tcEur]);
    });

    // ABORTO TODO-O-NADA: si falto la cotizacion de alguna fecha, no se escribe NADA.
    // Escribir "lo que se pudo" dejaria un ledger mezclado -- parte con TC reales y parte sin --
    // imposible de distinguir despues sin auditar fila por fila.
    if (fechasSinTc.length > 0) {
        const detalle = fechasSinTc.join('\n  ') + (fallbackCounter > fechasSinTc.length
            ? '\n  ... y ' + (fallbackCounter - fechasSinTc.length) + ' fecha(s) mas' : '');
        logError('recalcularTcRegistros: abortada, faltan cotizaciones en el Data Lake', {
            fechasAfectadas: fallbackCounter, muestra: fechasSinTc
        });
        ui.alert(
            'Faltan cotizaciones: no se escribio nada',
            'Hay ' + fallbackCounter + ' fecha(s) sin cotizacion en la hoja de tipos de cambio.\n\n' +
            'Primeras:\n  ' + detalle + '\n\n' +
            'No se modifico ninguna celda. Corre primero "Tidetrack Dev > Tipos de cambio > ' +
            'Forzar carga historica" para completar el Data Lake, y volve a intentarlo.\n\n' +
            'Antes esta funcion rellenaba los faltantes con valores fijos (1050/650/1100). Esos ' +
            'numeros quedaban congelados en el registro y no se pueden recalcular despues.',
            ui.ButtonSet.OK
        );
        return;
    }

    // Sobreescribir columnas J:M desde la fila de datos.
    // decision Franco 2026-08-18: se exige confirmacion explicita nombrando cuantas filas se
    // van a pisar. Esta funcion reescribe los TC congelados de TODO el ledger de una sola vez.
    const filasRecalculadas = rowCount - filasSinFecha.length;
    const muestraSinFecha = filasSinFecha.slice(0, 10).join(', ') +
        (filasSinFecha.length > 10 ? ', ... y ' + (filasSinFecha.length - 10) + ' mas' : '');
    const confirmar = ui.alert(
        'Reescribir tipos de cambio del ledger',
        'Se van a sobreescribir las columnas de cotizacion (' + cfgReg.columns.tc_ars + ':' +
        cfgReg.columns.tc_eur + ') de ' + filasRecalculadas + ' registro(s) con los valores del ' +
        'Data Lake actual.\n\n' +
        'Rango: filas ' + dataRow + ' a ' + ultimaConFecha + ' (ultima fila con Fecha).\n' +
        (filasSinFecha.length > 0
            ? filasSinFecha.length + ' fila(s) se SALTEAN por no tener fecha legible y CONSERVAN sus ' +
              'cotizaciones actuales: ' + muestraSinFecha + '.\n'
            : '') +
        '\nLos tipos de cambio congelados hoy en las filas recalculadas se PIERDEN. Continuar?',
        ui.ButtonSet.YES_NO
    );
    if (confirmar !== ui.Button.YES) {
        ui.alert('Cancelado', 'No se modifico ninguna celda.', ui.ButtonSet.OK);
        return;
    }

    tcRange.setValues(newValues);

    // El cierre cuenta lo que REALMENTE se recalculo. Las salteadas se nombran aparte: darlas
    // por recalculadas era la mentira que hacia invisible la destruccion de TC.
    let msg = `Se recalcularon ${filasRecalculadas} transaccion(es) sobre las filas ${dataRow}-${ultimaConFecha}.\n\n`;
    if (filasSinFecha.length > 0) {
        msg += `${filasSinFecha.length} fila(s) NO se recalcularon por no tener fecha legible y ` +
               `conservan sus cotizaciones anteriores: ${muestraSinFecha}.`;
        logInfo('recalcularTcRegistros: ' + filasSinFecha.length + ' fila(s) salteadas sin fecha legible -> ' +
                filasSinFecha.join(', '));
    }
    ui.alert('Proceso Completo', msg, ui.ButtonSet.OK);
}
