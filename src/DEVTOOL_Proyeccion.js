/**
 * DEVTOOL_Proyeccion.js
 * Crea la base de datos de PROYECCION -- espejo exacto de "Registros" -- y cablea el bloque
 * "Presupuesto Asignado" del Tablero para que lea de ahi en vez de ser numeros tipeados a mano.
 *
 * [CONCEPTO DE NEGOCIO]
 * El Tablero compara lo que PASO contra lo que estaba PREVISTO. La mitad de "lo que paso" sale
 * del ledger desde siempre; la mitad de "lo previsto" eran tres constantes escritas a mano en
 * N9, N10 y N11 que nadie podia auditar ni cambiar sin abrir la celda.
 *
 * decision Franco 2026-08-19: "necesito que armemos una nueva base de datos paralela a la de
 * Registros pero que sea Proyeccion... Esta nueva BD debe ser un espejo de la de registros.
 * Mismas columnas, mismo todo." La proyeccion se carga como se carga cualquier movimiento, y el
 * presupuesto del mes deja de ser un numero magico para pasar a ser la suma de lo que se planeo.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Es el mismo esquema relacional del ledger, aplicado al futuro. Que sea un ESPEJO y no una tabla
 * nueva no es comodidad: permite que el presupuesto y la realidad se agreguen con el MISMO
 * criterio (mismo Tipo de Cuenta, mismas exclusiones de Traspaso e Inicio Mes). Si el presupuesto
 * se sumara distinto que la realidad, el porcentaje de cumplimiento compararia peras con manzanas.
 *
 * ============================================================================
 * LA DECISION DE DISENO: UN MOVIMIENTO PROYECTADO NO TIENE COTIZACION CONGELADA
 * ============================================================================
 * En "Registros", las columnas J:M guardan el tipo de cambio del dia en que ocurrio el movimiento.
 * Un movimiento que todavia NO OCURRIO no tiene ese dato y no puede tenerlo: nadie sabe a cuanto
 * va a estar el dolar el mes que viene.
 *
 * Por eso la proyeccion se convierte con la cotizacion de HOY -- via TIDETRACK_USD/AUD/EUR(),
 * nunca apuntando a las celdas del bloque de Cotizaciones, que ya se mudo una vez --, no con J:M. Es la
 * unica opcion honesta: un presupuesto en dolares vale lo que vale hoy, y se re-evalua solo
 * cuando la cotizacion cambia. Las columnas J:M existen igual porque la hoja es un espejo exacto
 * -- si algun dia se quiere congelar un TC previsto, la columna esta.
 *
 * ============================================================================
 * COMO SE CLONA, Y POR QUE ASI
 * ============================================================================
 * Con `copyTo` de la hoja real, no reconstruyendo el diseno por codigo. Un copyTo trae en un solo
 * paso el ancho de las columnas, los formatos numericos, las validaciones de datos, el formato
 * condicional y las filas congeladas. Reponer todo eso a mano es superficie para equivocarse en
 * silencio, y el pedido fue explicito: "desde la arquitectura hasta el diseno".
 *
 * Despues se BORRAN los datos y se VERIFICA que quedo vacia. Un espejo que arranca con los 3.500
 * movimientos del ledger adentro seria un presupuesto igual a la realidad: el peor error posible
 * en esta hoja, porque daria 100% de cumplimiento siempre.
 *
 * QUE NO HACE
 * 1. NO toca "Registros". La hoja origen se lee, nunca se escribe.
 * 2. NO recrea la hoja si ya existe. Es re-ejecutable: si la hoja esta, solo cablea el Tablero.
 * 3. NO inventa un presupuesto. La hoja nace VACIA y N9:N11 dan cero hasta que Franco cargue.
 *
 * Contrato: { ok: boolean, detalle?: string, error?: string }.
 *   estadoProyeccion()   -> solo lectura. Se corre PRIMERO.
 *   aplicarProyeccion()  -> crea la hoja si falta y cablea N9:N11, con respaldo y verificacion.
 *
 * @version 0.18.0
 * @since 2026-08-19
 * @lastModified 2026-08-19
 * @see DEVTOOL_StockYFlujo.js (de donde salen _refHoja, _canonizarFormula y _errorDeCelda)
 */

const PROY_PROP_RESPALDO = 'proyeccion_respaldo';

/**
 * Celdas del bloque "Presupuesto Asignado" que dejan de ser constantes.
 * El `tipoCuenta` es el valor de la columna "Tipo de Cuenta" que suma cada fila, y es EL MISMO
 * que usan los bloques de la realidad (R9/U9/X9): si difirieran, el porcentaje de cumplimiento
 * no significaria nada.
 */
const PROY_PRESUPUESTO = [
    // decision Franco 2026-08-20 (rediseno manual del bloque L7:O12): los MONTOS viven en la
    // columna O y los porcentajes en la N -- y los porcentajes son formulas de Franco, no de
    // ningun modulo. Antes los montos estaban en N; reanclar esto fue obligatorio para que un
    // re-run no pisara su layout.
    { celda: 'O9', rotuloFila: 'L9', rotulo: 'Ingresos', tipoCuenta: 'Ingreso' },
    { celda: 'O10', rotuloFila: 'L10', rotulo: 'Gastos Fijos', tipoCuenta: 'Gasto Fijo' },
    { celda: 'O11', rotuloFila: 'L11', rotulo: 'Gastos Variables', tipoCuenta: 'Gasto Variable' }
];

/** Los meses, en el orden y la grafia que ya usa el motor del Tablero (AJ6). */
const PROY_MESES = 'Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre';

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: que haria. @returns {{ok:boolean, detalle?:string, error?:string}} */
function estadoProyeccion() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightProy(ss);
        const l = ['BD DE PROYECCION - ESTADO (no se escribio nada)', ''];
        l.push('Hoja "' + pre.nombreProyeccion + '": ' +
            (pre.existe ? 'YA EXISTE (' + pre.filasConDato + ' movimiento(s) cargados)' : 'NO existe, se crearia clonando "' + RANGES.REGISTROS.sheet + '"'));
        l.push('');
        l.push('Bloque "Presupuesto Asignado" del Tablero:');
        PROY_PRESUPUESTO.forEach(function (p) {
            const actual = ss.getSheetByName(pre.nombreTablero).getRange(p.celda).getFormula();
            l.push('  ' + p.celda + ' (' + p.rotulo + '): ' +
                (actual ? 'ya tiene formula' : 'HOY ES UNA CONSTANTE tipeada a mano -> pasaria a leer de la proyeccion'));
        });
        l.push('');
        l.push('La hoja nace VACIA: N9:N11 van a dar cero hasta que cargues movimientos previstos.');
        l.push('Se cargan igual que en "' + RANGES.REGISTROS.sheet + '": mismas columnas, mismo Tipo de Cuenta.');
        if (pre.avisos.length) {
            l.push('');
            l.push('Avisos:');
            pre.avisos.forEach(function (a) { l.push('  - ' + a); });
        }
        const t = l.join('\n');
        _mostrarProy('BD de Proyeccion - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarProy('BD de Proyeccion - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Crea la hoja si falta y cablea N9:N11. */
function aplicarProyeccion() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarProyeccion necesita UI (menu tidetrack Dev).' }; }

    const escritas = [];
    let ss = null, hojaCreada = '';
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightProy(ss);

        const conf = ui.alert('Crear la BD de Proyeccion',
            (pre.existe
                ? 'La hoja "' + pre.nombreProyeccion + '" ya existe y NO se toca.\n\n'
                : 'Se va a CREAR la hoja "' + pre.nombreProyeccion + '" clonando "' + RANGES.REGISTROS.sheet +
                  '" (mismo diseno, mismas columnas) y se le van a BORRAR los datos para que nazca vacia.\n\n') +
            'Y el bloque "Presupuesto Asignado" del Tablero (N9, N10, N11) deja de ser constantes ' +
            'tipeadas a mano y pasa a sumar lo que cargues en la proyeccion, para el mes y la ' +
            'moneda seleccionados.\n\n' +
            'OJO: hasta que cargues movimientos previstos, N9:N11 van a dar CERO y los porcentajes ' +
            'del bloque tambien. Es correcto: hoy esos numeros no salen de ningun lado.\n\n' +
            'No se toca "' + RANGES.REGISTROS.sheet + '".\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        // --- 1. La hoja espejo ---
        if (!pre.existe) {
            hojaCreada = _crearEspejoProy(ss, pre.nombreProyeccion);
        }

        // --- 2. Respaldo de las formulas del Tablero antes de cablear ---
        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarFormulerio(ss, sello);

        // --- 3. Cableado de N9:N11 ---
        const hojaT = ss.getSheetByName(pre.nombreTablero);
        PROY_PRESUPUESTO.forEach(function (p) {
            const rango = hojaT.getRange(p.celda);
            const previa = rango.getFormula();
            const previoValor = rango.getValue();
            const nueva = _formulaPresupuestoProy(p.tipoCuenta, pre.nombreProyeccion);
            if (_canonizarFormula(previa) === _canonizarFormula(nueva)) return;
            rango.setFormula(nueva);
            escritas.push({ celda: p.celda, previa: previa, previoValor: previoValor, nueva: nueva });
        });
        SpreadsheetApp.flush();

        // --- 4. Relectura: la formula quedo Y calcula ---
        const fallas = [];
        escritas.forEach(function (w) {
            const rango = hojaT.getRange(w.celda);
            const leida = rango.getFormula();
            if (!leida) { fallas.push(w.celda + ' quedo SIN formula'); return; }
            if (_canonizarFormula(leida) !== _canonizarFormula(w.nueva)) {
                fallas.push(w.celda + ' no coincide con lo que se le escribio'); return;
            }
            const err = _errorDeCelda(rango);
            if (err) fallas.push(w.celda + ' quedo en ' + err);
        });
        if (fallas.length) {
            escritas.forEach(function (w) {
                try {
                    if (w.previa) hojaT.getRange(w.celda).setFormula(w.previa);
                    else hojaT.getRange(w.celda).setValue(w.previoValor);
                } catch (e2) { logError('No se pudo restaurar ' + w.celda + ': ' + e2.message); }
            });
            SpreadsheetApp.flush();
            throw new Error('El cableado NO VERIFICA al releer: ' + fallas.join('; ') +
                '. Se restauro cada celda a su valor previo.' +
                (hojaCreada ? ' La hoja "' + hojaCreada + '" quedo creada y vacia: se puede borrar a mano.' : ''));
        }

        PropertiesService.getDocumentProperties().setProperty(PROY_PROP_RESPALDO, respaldo.nombre);

        const detalle = 'BD DE PROYECCION LISTA\n\n' +
            (hojaCreada ? '- Hoja creada y verificada vacia: "' + hojaCreada + '"\n'
                        : '- La hoja "' + pre.nombreProyeccion + '" ya existia y no se toco\n') +
            '- Celdas cableadas y verificadas: ' + escritas.length + ' (' +
            PROY_PRESUPUESTO.map(function (p) { return p.celda; }).join(', ') + ')\n' +
            '- Respaldo de las formulas previas: "' + respaldo.nombre + '"\n\n' +
            'COMO SE USA: carga en "' + pre.nombreProyeccion + '" lo que PLANEAS, igual que un\n' +
            'movimiento normal -- monto, tipo, cuenta, tipo de cuenta, medio, moneda y fecha. El\n' +
            'Tablero suma lo del mes y la moneda que tengas seleccionados.\n\n' +
            'QUE MIRAR: N9, N10 y N11 van a dar CERO hasta que cargues algo. Es correcto: hoy esos\n' +
            'numeros estaban tipeados a mano y no salian de ningun lado.\n\n' +
            'La moneda se convierte con la cotizacion de HOY, no con una congelada: un movimiento\n' +
            'que todavia no ocurrio no tiene tipo de cambio propio.';

        logSuccess('aplicarProyeccion: hoja ' + (hojaCreada || 'existente') + ', ' + escritas.length + ' celda(s) cableadas.');
        _mostrarProy('BD de Proyeccion - lista', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarProy('BD de Proyeccion - ERROR', msg);
        return { ok: false, error: msg };
    }
}

// ============================================
// INTERNAS
// ============================================

function _preflightProy(ss) {
    const nombreTablero = NAV_CONFIG.SHEETS.TABLERO;
    const hojaT = ss.getSheetByName(nombreTablero);
    if (!hojaT) throw new Error('No existe la hoja "' + nombreTablero + '".');
    const cfg = RANGES.REGISTROS;
    const hojaReg = ss.getSheetByName(cfg.sheet);
    if (!hojaReg) throw new Error('No existe "' + cfg.sheet + '": sin la hoja origen no hay espejo que clonar.');

    const nombreProyeccion = SHEETS.PROYECCION;
    const hojaProy = ss.getSheetByName(nombreProyeccion);

    // Los rotulos del bloque de presupuesto se verifican ANTES de escribir: si la fila no dice
    // lo que creemos, estariamos cableando el numero equivocado bajo la etiqueta equivocada.
    const avisos = [];
    const malRotulados = [];
    PROY_PRESUPUESTO.forEach(function (p) {
        const vivo = String(hojaT.getRange(p.rotuloFila).getValue() || '').trim();
        if (_normalizarRotulo(vivo) !== _normalizarRotulo(p.rotulo)) {
            malRotulados.push(p.rotuloFila + ' dice "' + vivo + '" y se esperaba "' + p.rotulo + '"');
        }
    });
    if (malRotulados.length) {
        throw new Error('Los rotulos del bloque "Presupuesto Asignado" no son los esperados: ' +
            malRotulados.join('; ') + '. Cablear a ciegas pondria el numero equivocado bajo la ' +
            'etiqueta equivocada, que es peor que dejarlo como constante.');
    }

    let filasConDato = 0;
    if (hojaProy) {
        const colIni = columnLetterToIndex(cfg.start);
        const alto = hojaProy.getMaxRows() - cfg.dataRow + 1;
        if (alto > 0) {
            hojaProy.getRange(cfg.dataRow, colIni, alto, 1).getValues().forEach(function (f) {
                if (String(f[0] || '').trim() !== '') filasConDato++;
            });
        }
    }

    return {
        nombreTablero: nombreTablero, nombreProyeccion: nombreProyeccion,
        existe: !!hojaProy, filasConDato: filasConDato, avisos: avisos
    };
}

/**
 * Clona "Registros" con copyTo, la renombra, le borra los datos y VERIFICA que quedo vacia.
 * Un espejo que arranca con el ledger adentro daria 100% de cumplimiento siempre.
 */
function _crearEspejoProy(ss, nombreDestino) {
    const cfg = RANGES.REGISTROS;
    const origen = ss.getSheetByName(cfg.sheet);
    const copia = origen.copyTo(ss);
    copia.setName(nombreDestino);
    invalidarCacheNombresHojas();

    // Se borran TODOS los datos por debajo del header, en todo el ancho de la hoja: el espejo
    // conserva el diseno, no el contenido.
    const alto = copia.getMaxRows() - cfg.dataRow + 1;
    if (alto > 0) copia.getRange(cfg.dataRow, 1, alto, copia.getMaxColumns()).clearContent();
    SpreadsheetApp.flush();

    // VERIFICACION: el header sigue, y no quedo un solo dato.
    const colIni = columnLetterToIndex(cfg.start);
    const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    const header = copia.getRange(cfg.headerRow, colIni, 1, nCols).getValues()[0]
        .filter(function (v) { return String(v || '').trim() !== ''; });
    if (!header.length) {
        throw new Error('La hoja "' + nombreDestino + '" quedo sin encabezados despues de limpiarla. ' +
            'Se creo pero no sirve como espejo: revisarla o borrarla a mano.');
    }
    let sobrantes = 0;
    if (alto > 0) {
        copia.getRange(cfg.dataRow, colIni, alto, nCols).getValues().forEach(function (f) {
            f.forEach(function (v) { if (String(v || '').trim() !== '') sobrantes++; });
        });
    }
    if (sobrantes > 0) {
        throw new Error('La hoja "' + nombreDestino + '" quedo con ' + sobrantes + ' celda(s) con dato ' +
            'despues de limpiarla. Un espejo con los movimientos del ledger adentro daria 100% de ' +
            'cumplimiento siempre: se aborta antes de cablear nada.');
    }

    // La proyeccion se ordena por fecha como el ledger, pero sin datos no hay nada que ordenar.
    logInfo('_crearEspejoProy: "' + nombreDestino + '" creada desde "' + cfg.sheet + '" y verificada vacia.');
    return nombreDestino;
}

/**
 * Suma de la proyeccion para un Tipo de Cuenta, en el mes/anio/moneda del Tablero.
 *
 * Usa EL MISMO criterio que los bloques de la realidad: filtra por Tipo de Cuenta y excluye las
 * cuentas neutras. Si el presupuesto se sumara distinto que lo real, el porcentaje de
 * cumplimiento compararia peras con manzanas.
 */
function _formulaPresupuestoProy(tipoCuenta, nombreProyeccion) {
    const cfg = RANGES.REGISTROS;   // el espejo comparte geometria con el ledger
    const h = _refHoja(nombreProyeccion);
    const col = function (clave) {
        const l = cfg.columns[clave];
        return h + '!' + l + cfg.dataRow + ':' + l;
    };
    const neutras = CUENTAS_NEUTRAS.map(function (c) { return '(cuenta<>"' + c + '")'; }).join(' * ');
    return '=LET(\n' +
        '  monto; ' + col('monto') + ';\n' +
        '  cuenta; ' + col('cuenta') + ';\n' +
        '  tipo_cuenta; ' + col('tipo_cuenta') + ';\n' +
        '  moneda; ' + col('moneda') + ';\n' +
        '  fecha; ' + col('fecha') + ';\n' +
        '  mes_num; MATCH($N$2; SPLIT("' + PROY_MESES + '"; ","); 0);\n' +
        '  desde; DATE($N$3; mes_num; 1);\n' +
        '  hasta; EOMONTH(desde; 0);\n' +
        // Un movimiento previsto no tiene TC congelado: se convierte con la cotizacion de hoy,
        // y esa cotizacion se pide por FUNCION, no por coordenada.
        //
        // decision Franco 2026-08-20: esto apuntaba a $AF$17/18/19, que era el bloque de
        // Cotizaciones cuando se escribio. El rediseno bajo ese bloque a las filas 27-29 y hoy
        // AF17:AF19 es "Saldos Actuales": AF17 es el texto "Flujo" y AF18/AF19 son montos de
        // saldo en cientos de miles de ARS. Un previsto en AUD se multiplicaba por un saldo en
        // vez de por una cotizacion -- presupuesto inflado varios ordenes de magnitud, sin un
        // solo aviso. Una coordenada que se pudre no da error: da otro numero. Una funcion no
        // tiene coordenada que se pueda mover.
        '  tasa_origen; ARRAYFORMULA(IF(moneda="USD"; TIDETRACK_USD(); IF(moneda="AUD"; TIDETRACK_AUD(); IF(moneda="EUR"; TIDETRACK_EUR(); 1))));\n' +
        '  tasa_destino; IFERROR(SWITCH($N$4; "ARS"; 1; "USD"; TIDETRACK_USD(); "AUD"; TIDETRACK_AUD(); "EUR"; TIDETRACK_EUR()); 1);\n' +
        '  convertido; ARRAYFORMULA(monto * tasa_origen / tasa_destino);\n' +
        '  del_mes; ARRAYFORMULA((tipo_cuenta="' + tipoCuenta + '") * ' + neutras +
        ' * (fecha>=desde) * (fecha<=hasta));\n' +
        '  SUM(IFERROR(FILTER(convertido; del_mes); 0))\n)';
}

function _mostrarProy(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
