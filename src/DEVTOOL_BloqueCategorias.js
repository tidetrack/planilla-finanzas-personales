/**
 * DEVTOOL_BloqueCategorias.js
 * El bloque "Categorias" del Tablero pasa a agrupar por la CATEGORIA DE LA CUENTA.
 *
 * [CONCEPTO DE NEGOCIO]
 * Ese bloque tiene que contestar "en que se me va la plata": Vehiculo, Alimentacion y social,
 * Deuda y financiacion. Hoy muestra Hogar / Ahorros / Inversiones / Financiacion, que son los
 * TIPOS DE MEDIO -- o sea DONDE estaba la plata, no PARA QUE se uso. Dos preguntas distintas, y
 * la que el bloque promete es la segunda.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Es una consecuencia no prevista de la v0.20.0. Cuando los medios declaraban su tipo a traves de
 * una categoria intermedia, la formula hacia medio -> categoria -> tipo y el bloque agrupaba por
 * esa categoria del medio, que al menos era un nombre propio ("Chanchito", "Meta de Ahorro 1").
 * Al sacar el nivel intermedio, el mismo VLOOKUP pasa a devolver el TIPO, y el bloque quedo
 * mostrando cuatro filas genericas.
 *
 * La correccion no es volver atras: es apuntar al eje correcto. La categoria de la CUENTA vive en
 * los tres bloques de cuentas del Plan (C:D, F:G, I:J), asi que la busqueda es una cascada de
 * tres IFERROR -- una cuenta esta en uno y solo uno de los tres.
 *
 * QUE NO HACE
 * 1. NO toca ninguna otra celda del Tablero. Es una sola formula.
 * 2. NO cambia la estructura del bloque ni sus rotulos.
 *
 * @version 0.22.0
 * @since 2026-08-19
 * @lastModified 2026-08-19
 */

const BCAT_CELDA = 'AA9';
const BCAT_PROP_RESPALDO = 'bloque_categorias_respaldo';

/**
 * Reemplaza la definicion de la variable que alimenta el agrupamiento.
 *
 * De:  proyecto; ARRAYFORMULA(IFERROR(VLOOKUP(<medio>; ...L:N; 3; 0); ""));
 * A:   proyecto; ARRAYFORMULA(la categoria de la CUENTA, buscada en los tres bloques);
 *
 * Se conserva el nombre de la variable a proposito: cambiarlo obligaria a tocar todas sus
 * apariciones mas abajo en la misma formula, y cada token de mas es una chance de romperla.
 */
function _reapuntarBloqueCategorias(formula) {
    const cuenta = _colMotorTablero('cuenta');
    const bloques = ['INGRESOS', 'GASTOS_FIJOS', 'GASTOS_VARIABLES'].map(function (clave) {
        const cfg = RANGES[clave];
        const idx = columnLetterToIndex(cfg.columns.proyecto) - columnLetterToIndex(cfg.columns.nombre) + 1;
        return { rango: _refHoja(cfg.sheet) + '!' + cfg.columns.nombre + ':' + cfg.columns.proyecto, idx: idx };
    });
    let expr = '""';
    for (let i = bloques.length - 1; i >= 0; i--) {
        expr = 'IFERROR(VLOOKUP(' + cuenta + '; ' + bloques[i].rango + '; ' + bloques[i].idx + '; 0); ' + expr + ')';
    }
    const nueva = 'ARRAYFORMULA(' + expr + ')';

    // Solo la linea que define la variable, y solo si hoy busca por el bloque de medios.
    const medios = RANGES.MEDIOS_PAGO;
    const rangoMedios = medios.start + ':' + medios.end;
    const re = new RegExp(
        '(\\w+)\\s*;\\s*ARRAYFORMULA\\(\\s*IFERROR\\(\\s*VLOOKUP\\([^;]+;[^;]*' +
        rangoMedios.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*;\\s*\\d+\\s*;\\s*0\\s*\\)\\s*;\\s*""\\s*\\)\\s*\\)', 'g');
    return formula.replace(re, function (m, variable) { return variable + '; ' + nueva; });
}

/** Referencia abierta a una columna del motor del Tablero, derivada de RANGES (regla SSOT). */
function _colMotorTablero(clave) {
    const cfg = RANGES.REGISTROS;
    const offset = columnLetterToIndex(cfg.columns[clave]) - columnLetterToIndex(cfg.start);
    const letra = columnIndexToLetter(columnLetterToIndex(FORM_COL_MOTOR_TABLERO) + offset);
    return letra + FORM_FILA_DERRAME_TABLERO + ':' + letra;
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura. */
function estadoBloqueCategorias() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hoja = ss.getSheetByName(NAV_CONFIG.SHEETS.TABLERO);
        if (!hoja) throw new Error('No existe la hoja "' + NAV_CONFIG.SHEETS.TABLERO + '".');
        const actual = hoja.getRange(BCAT_CELDA).getFormula();
        if (!actual) throw new Error(BCAT_CELDA + ' no tiene formula.');
        const nueva = _reapuntarBloqueCategorias(actual);
        const l = ['BLOQUE "CATEGORIAS" DEL TABLERO - ESTADO (no se escribio nada)', ''];
        if (nueva === actual) {
            l.push('NADA QUE HACER: ' + BCAT_CELDA + ' ya agrupa por la categoria de la cuenta.');
        } else {
            l.push('HOY agrupa por el TIPO DEL MEDIO (Hogar / Ahorros / Inversiones / Financiacion):');
            l.push('eso contesta DONDE estaba la plata, no PARA QUE se uso.');
            l.push('');
            l.push('PASA A AGRUPAR por la CATEGORIA DE LA CUENTA, buscada en los tres bloques del Plan.');
            l.push('Vas a ver Vehiculo, Alimentacion y social, Deuda y financiacion, etc.');
            l.push('');
            l.push('Es UNA sola celda: ' + NAV_CONFIG.SHEETS.TABLERO + '!' + BCAT_CELDA);
        }
        const t = l.join('\n');
        _mostrarBcat('Bloque Categorias - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarBcat('Bloque Categorias - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Aplica. Respaldo, escritura y relectura del valor. */
function aplicarBloqueCategorias() {
    let ss = null, previa = '';
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const hoja = ss.getSheetByName(NAV_CONFIG.SHEETS.TABLERO);
        if (!hoja) throw new Error('No existe la hoja "' + NAV_CONFIG.SHEETS.TABLERO + '".');
        const rango = hoja.getRange(BCAT_CELDA);
        previa = rango.getFormula();
        if (!previa) throw new Error(BCAT_CELDA + ' no tiene formula.');
        const nueva = _reapuntarBloqueCategorias(previa);
        if (nueva === previa) {
            const t = BCAT_CELDA + ' ya agrupa por la categoria de la cuenta. No se escribio nada.';
            _mostrarBcat('Bloque Categorias', t);
            return { ok: true, detalle: t };
        }

        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarFormulerio(ss, sello);

        const errorPrevio = _errorDeCelda(rango);
        rango.setFormula(nueva);
        SpreadsheetApp.flush();

        const leida = rango.getFormula();
        const err = _errorDeCelda(rango);
        const fallas = [];
        if (!leida) fallas.push('quedo SIN formula');
        else if (_canonizarFormula(leida) !== _canonizarFormula(nueva)) fallas.push('no coincide con lo escrito');
        if (err) fallas.push('quedo en ' + err + (errorPrevio ? ' (ya estaba en ' + errorPrevio + ')' : ' (antes calculaba bien)'));
        if (fallas.length) {
            rango.setFormula(previa);
            SpreadsheetApp.flush();
            throw new Error(BCAT_CELDA + ' ' + fallas.join('; ') + '. Se restauro la formula previa. ' +
                'Respaldo en "' + respaldo.nombre + '".');
        }

        PropertiesService.getDocumentProperties().setProperty(BCAT_PROP_RESPALDO, respaldo.nombre);
        const detalle = 'BLOQUE "CATEGORIAS" REAPUNTADO\n\n' +
            '- Celda: ' + NAV_CONFIG.SHEETS.TABLERO + '!' + BCAT_CELDA + '\n' +
            '- Respaldo: "' + respaldo.nombre + '"\n\n' +
            'Ahora agrupa por la CATEGORIA DE LA CUENTA en vez del tipo del medio. Vas a ver\n' +
            'Vehiculo, Alimentacion y social, Deuda y financiacion, y no las cuatro finalidades.';
        logSuccess('aplicarBloqueCategorias: ' + BCAT_CELDA + ' reapuntado.');
        _mostrarBcat('Bloque Categorias - listo', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarBcat('Bloque Categorias - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarBcat(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
