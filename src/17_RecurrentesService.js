/**
 * 17_RecurrentesService.js - la BD de gastos recurrentes y su volcado a la Proyeccion.
 *
 * [CONCEPTO DE NEGOCIO]
 * Pedido fundacional de Franco: suscripciones y pagos que se repiten todos los meses
 * (Netflix, alquiler, gimnasio) tienen que poder declararse UNA vez y contar SIEMPRE en las
 * proyecciones, sin retipearlos mes a mes en la hoja Presupuesto. La regla vive en una
 * hoja-BD propia ("Recurrentes", oculta) y un volcado explicito la convierte en filas de la
 * BD "Proyeccion" para el mes elegido.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * El volcado calca los contratos ya probados de Guardar Proyeccion (DEVTOOL_PresupuestoGuardar.js):
 * marca propia en la Nota ("Gasto recurrente <clave> <sello>"), idempotencia por periodo
 * (volcar dos veces el mismo mes reemplaza las filas propias, nunca duplica), cotizaciones del
 * dia congeladas como VALOR via las custom functions TIDETRACK_* (Regla Estricta 9: un fallo
 * de la API LANZA, jamas se escribe con un default), fecha con el dia real del recurrente
 * recortado al largo del mes (los dos consumidores de Proyeccion filtran por rango de mes
 * completo, nunca por dia exacto -- verificado en la decision 2 de PG; cualquier consumidor
 * futuro que filtre por dia debe conocer esta convencion), y verificacion del VALOR releido
 * antes de declarar exito. Los recurrentes son ADITIVOS: conviven con el presupuesto base
 * (PB_MARCA) y con el guardado manual (PG_MARCA), no tocan filas ajenas, y
 * aplicarGuardarProyeccion tampoco los retira porque no conoce REC_MARCA.
 *
 * decision Franco 2026-08-26: este modulo NO llama funciones de DEVTOOL_Presupuesto*.js
 * aunque el patron venga de ahi (esos archivos son de la otra linea de trabajo y ademas
 * son candidatos a salir del deploy cuando pese menos el proyecto; una ruta de uso DIARIO
 * no puede depender de un devtool). Los helpers chicos (_filasRecPorPrefijo, _borrarFilasRec)
 * se copian con cita de origen. TIDETRACK_*, deducirTipoCuenta y leerCatalogosPlanCuentas SI
 * se llaman: viven en modulos nucleo (15/06) y son EL clasificador y EL motor FX del sistema
 * -- duplicarlos seria la forma barata de clasificar distinto sin que nadie se entere.
 *
 * NINGUN const de nivel superior de este archivo lee simbolos de otro archivo (cicatriz
 * v0.50.1: el orden de carga de Apps Script es alfabetico y un ReferenceError de carga tumba
 * el proyecto entero). PG_MARCA y PB_MARCA se leen DENTRO de cuerpos de funcion.
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @see 16_ShellService.js (el shell que abre la vista y aporta _conLock y _plata)
 * @version 0.56.0
 * @since 0.56.0
 * @lastModified 2026-08-27
 */

// ============================================
// MARCADO Y GEOMETRIA PROPIA
// ============================================

// La marca de origen en la Nota de cada fila volcada a "Proyeccion". Tiene que
// distinguirse por prefijo de PB_MARCA ('Presupuesto base historico') y de PG_MARCA
// ('Presupuesto guardado'): ninguna es prefijo de otra, el indexOf(...)===0 nunca confunde.
const REC_MARCA = 'Gasto recurrente';
const REC_TITULO_HOJA = 'Recurrentes.';           // titulo en B2, punto final como los bloques del Plan
const REC_HEADERS = ['Nombre', 'Cuenta', 'Monto', 'Moneda', 'Medio', 'Dia del mes', 'Nota', 'Activo'];
const REC_ACTIVO_SI = 'Si';
const REC_ACTIVO_NO = 'No';
const REC_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
    'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ============================================
// HOJA-BD (creada por el backend en el primer uso)
// ============================================

/**
 * Devuelve la hoja "Recurrentes", creandola si no existe. Se llama SOLO desde los caminos de
 * escritura (guardar/borrar): leer no crea la hoja.
 *
 * El patron es el de _respaldarFilasPg / aplicarCuentasComodin: escribir, RELEER y comparar
 * el VALOR (memoria del repo: verificar el valor, no el texto que se creyo escribir), y
 * ocultar RECIEN despues de verificar. Si la verificacion falla, la hoja recien creada se
 * borra y se lanza: el caller lo convierte en {ok:false}.
 */
function _asegurarHojaRecurrentes(ss) {
    let hoja = ss.getSheetByName(SHEETS.RECURRENTES);
    if (hoja) return hoja;

    hoja = ss.insertSheet(SHEETS.RECURRENTES);
    invalidarCacheNombresHojas();

    const cfg = RANGES.RECURRENTES;
    const colIni = columnLetterToIndex(cfg.start);
    hoja.getRange(2, colIni).setValue(REC_TITULO_HOJA);
    hoja.getRange(cfg.headerRow, colIni, 1, REC_HEADERS.length).setValues([REC_HEADERS]);

    // Formato del header copiado del ledger con PASTE_FORMAT: cero colores hardcodeados.
    // El formato NUNCA aborta: si el rango modelo no existe, se sigue sin formato.
    try {
        const cfgReg = RANGES.REGISTROS;
        const hojaReg = ss.getSheetByName(cfgReg.sheet);
        if (hojaReg) {
            hojaReg.getRange(cfgReg.headerRow, columnLetterToIndex(cfgReg.start), 1, REC_HEADERS.length)
                .copyTo(hoja.getRange(cfg.headerRow, colIni, 1, REC_HEADERS.length),
                    SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        }
    } catch (e) {
        logInfo('_asegurarHojaRecurrentes: header sin formato (' + (e && e.message ? e.message : e) + ').');
    }

    SpreadsheetApp.flush();

    // RELEER y comparar valor por valor antes de dar la hoja por creada.
    const desvios = [];
    const titulo = String(hoja.getRange(2, colIni).getValue() || '');
    if (titulo !== REC_TITULO_HOJA) desvios.push('el titulo dice "' + titulo + '"');
    const vivos = hoja.getRange(cfg.headerRow, colIni, 1, REC_HEADERS.length).getValues()[0];
    REC_HEADERS.forEach(function (h, i) {
        const vivo = String(vivos[i] === null || vivos[i] === undefined ? '' : vivos[i]);
        if (vivo !== h) desvios.push('el header ' + (i + 1) + ' dice "' + vivo + '" y se esperaba "' + h + '"');
    });
    if (desvios.length) {
        ss.deleteSheet(hoja);
        invalidarCacheNombresHojas();
        throw new Error('No se pudo crear la hoja "' + SHEETS.RECURRENTES + '": ' + desvios.join('; ') +
            '. Se borro la hoja a medio crear.');
    }

    hoja.hideSheet();
    logSuccess('_asegurarHojaRecurrentes: hoja "' + SHEETS.RECURRENTES + '" creada, verificada y oculta.');
    return hoja;
}

// ============================================
// PUBLICAS (google.script.run)
// ============================================

/**
 * La lista completa de recurrentes, en el orden de la hoja (el de alta).
 *
 * Solo lectura, sin lock, NUNCA lanza (patron obtenerCatalogoShell). Si la hoja no existe
 * devuelve la lista vacia: leer no crea la hoja, la crea el primer guardado.
 *
 * @returns {{ok:boolean, recurrentes?:Array<Object>, error?:string}}
 */
function obtenerRecurrentes() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hoja = ss ? ss.getSheetByName(SHEETS.RECURRENTES) : null;
        if (!hoja) return { ok: true, recurrentes: [] };

        const cfg = RANGES.RECURRENTES;
        const base = columnLetterToIndex(cfg.start);
        const ix = function (clave) { return columnLetterToIndex(cfg.columns[clave]) - base; };
        const recurrentes = getTableData('RECURRENTES')
            .map(function (f) {
                return {
                    nombre: String(f[ix('nombre')] || '').trim(),
                    cuenta: String(f[ix('cuenta')] || '').trim(),
                    monto: Number(f[ix('monto')]),
                    moneda: String(f[ix('moneda')] || '').trim(),
                    medio: String(f[ix('medio')] || '').trim(),
                    dia: Number(f[ix('dia')]),
                    nota: String(f[ix('nota')] || ''),
                    activo: String(f[ix('activo')] || '').trim() === REC_ACTIVO_SI
                };
            })
            .filter(function (r) { return r.nombre !== ''; });
        return { ok: true, recurrentes: recurrentes };
    } catch (e) {
        logError('obtenerRecurrentes', e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
    }
}

/**
 * Alta Y edicion Y pausa: es un UPSERT por nombre (normalizado con normalizarNombreCuenta).
 *
 * @param {Object} d {nombre, cuenta, monto, moneda, medio, dia, nota, activo ('Si'|'No')}
 * @returns {{ok:boolean, mensaje?:string, problemas?:Array<string>, error?:string}}
 */
function guardarRecurrente(d) {
    return _conLock(function () {
        d = d || {};
        const problemas = _validarRecurrente(d, { medios: _nombresDeMedio() });
        if (problemas.length) return { ok: false, problemas: problemas };

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        _asegurarHojaRecurrentes(ss);

        const cfg = RANGES.RECURRENTES;
        const base = columnLetterToIndex(cfg.start);
        const ancho = columnLetterToIndex(cfg.end) - base + 1;
        // La fila se arma derivando posiciones de RANGES (patron _filaDeCarga, sin retipear).
        const fila = new Array(ancho).fill('');
        const poner = function (clave, valor) { fila[columnLetterToIndex(cfg.columns[clave]) - base] = valor; };
        const nombre = String(d.nombre).trim();
        poner('nombre', nombre);
        poner('cuenta', String(d.cuenta).trim());
        poner('monto', Number(d.monto));
        poner('moneda', d.moneda);
        poner('medio', d.medio);
        poner('dia', Number(d.dia));
        poner('nota', d.nota || '');
        poner('activo', d.activo);

        const buscado = normalizarNombreCuenta(nombre);
        const ixNombre = columnLetterToIndex(cfg.columns.nombre) - base;
        let indice = -1;
        getTableData('RECURRENTES').forEach(function (f, i) {
            if (indice === -1 && normalizarNombreCuenta(f[ixNombre]) === buscado) indice = i;
        });

        const esEdicion = indice !== -1;
        if (esEdicion) updateRow('RECURRENTES', indice, fila);
        else appendRow('RECURRENTES', fila);

        let mensaje = esEdicion
            ? 'Listo. Actualizaste "' + nombre + '".'
            : 'Listo. Guardaste "' + nombre + '": ' + _plata(d.monto, d.moneda) +
              ' el dia ' + Number(d.dia) + ' de cada mes.';
        if (d.activo === REC_ACTIVO_NO) mensaje += ' Quedo pausado: no entra en los proximos volcados.';
        logSuccess('guardarRecurrente: "' + nombre + '" ' + (esEdicion ? 'actualizado' : 'creado') + '.');
        return { ok: true, mensaje: mensaje };
    });
}

/**
 * Borra un recurrente por nombre. La confirmacion es del CLIENTE (boton de dos pasos): el
 * backend no pregunta -- no hay UI de Sheets dentro de google.script.run.
 *
 * @param {string} nombre
 * @returns {{ok:boolean, mensaje?:string, error?:string}}
 */
function borrarRecurrente(nombre) {
    return _conLock(function () {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hoja = ss.getSheetByName(SHEETS.RECURRENTES);
        const buscado = normalizarNombreCuenta(nombre);
        let indice = -1;
        if (hoja && buscado !== '') {
            const cfg = RANGES.RECURRENTES;
            const ixNombre = columnLetterToIndex(cfg.columns.nombre) - columnLetterToIndex(cfg.start);
            // El indice sale de la MISMA lectura getTableData con la que deleteRow reconstruye
            // la tabla compactada: por eso es el correcto.
            getTableData('RECURRENTES').forEach(function (f, i) {
                if (indice === -1 && normalizarNombreCuenta(f[ixNombre]) === buscado) indice = i;
            });
        }
        if (indice === -1) return { ok: false, error: 'No existe un recurrente llamado "' + nombre + '".' };

        deleteRow('RECURRENTES', indice);
        logSuccess('borrarRecurrente: "' + nombre + '" borrado.');
        return { ok: true, mensaje: 'Listo. Se borro "' + nombre + '". Lo ya volcado a la proyeccion no se toca.' };
    });
}

/**
 * SOLO LECTURA: alimenta la confirmacion del cliente ANTES de escribir (el volcado es
 * explicito, nunca efecto oculto). Cuenta activos/pausados, el total por moneda, las filas
 * propias ya volcadas para ese periodo (se REEMPLAZAN) y las ajenas del mismo mes
 * (INFORMATIVO: no se tocan).
 *
 * @param {Object} d {mes: 1..12, anio}
 * @returns {{ok:boolean, periodo?:string, activos?:number,
 *            totalPorMoneda?:Object, previasPropias?:number,
 *            otrasDelMes?:{base:number, manual:number}, error?:string}}
 */
function estadoVolcadoRecurrentes(d) {
    try {
        d = d || {};
        const mes = Number(d.mes);
        const anio = Number(d.anio);
        if (!_periodoValidoRec(mes, anio)) {
            return { ok: false, error: REC_MSJ_PERIODO };
        }
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hojaProy = ss.getSheetByName(SHEETS.PROYECCION);
        if (!hojaProy) {
            return { ok: false, error: 'No existe la hoja "' + SHEETS.PROYECCION +
                '". Corre primero tidetrack Dev > BD de Proyeccion.' };
        }
        const lect = obtenerRecurrentes();
        if (!lect.ok) return lect;

        const activos = lect.recurrentes.filter(function (r) { return r.activo; });
        const totalPorMoneda = {};
        activos.forEach(function (r) {
            totalPorMoneda[r.moneda] = Math.round(((totalPorMoneda[r.moneda] || 0) + r.monto) * 100) / 100;
        });
        const clave = anio + '-' + String(mes).padStart(2, '0');
        // decision Franco 2026-08-29: se podo `pausados` del retorno -- ningun cliente lo
        // leia (el conteo de pausados en pantalla lo arma actualizarResumenRecurrentes desde
        // el DOM). El guard campo->consumidor de probar_shell.js lo caza si reaparece.
        return {
            ok: true,
            periodo: REC_MESES[mes - 1] + ' ' + anio,
            activos: activos.length,
            totalPorMoneda: totalPorMoneda,
            previasPropias: _filasRecPorPrefijo(hojaProy, REC_MARCA + ' ' + clave + ' ').length,
            otrasDelMes: _otrasDelMesRec(hojaProy, mes, anio)
        };
    } catch (e) {
        logError('estadoVolcadoRecurrentes', e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
    }
}

/**
 * Vuelca los recurrentes ACTIVOS al mes elegido: filas espejo de Registros en la hoja
 * Proyeccion, con la marca REC_MARCA en la Nota. IDEMPOTENTE por periodo: retira primero las
 * filas propias de ese mes y reescribe. NO toca ninguna fila PB_MARCA, PG_MARCA ni sin marca.
 *
 * @param {Object} d {mes: 1..12, anio}
 * @returns {{ok:boolean, mensaje?:string, error?:string}}
 */
function volcarRecurrentesAlMes(d) {
    return _conLock(function () {
        d = d || {};
        const mes = Number(d.mes);
        const anio = Number(d.anio);
        if (!_periodoValidoRec(mes, anio)) {
            return { ok: false, error: REC_MSJ_PERIODO };
        }
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hojaProy = ss.getSheetByName(SHEETS.PROYECCION);
        if (!hojaProy) {
            return { ok: false, error: 'No existe la hoja "' + SHEETS.PROYECCION +
                '". Corre primero tidetrack Dev > BD de Proyeccion.' };
        }
        // Preflight angosto: el espejo sigue siendo espejo. Se reusa el del shell (misma linea
        // de trabajo, mismas fuentes de Config); NO se reusa _preflightPb (devtool ajeno).
        _preflightEspejoProyeccionShell(ss, hojaProy);

        const lect = obtenerRecurrentes();
        if (!lect.ok) return lect;
        const activos = lect.recurrentes.filter(function (r) { return r.activo; });
        if (!activos.length) return { ok: false, error: 'No hay recurrentes activos para volcar.' };

        // decision Franco 2026-08-29: se REVALIDA lo leido de la hoja (oculta pero editable)
        // ANTES de borrar el volcado previo. Un Monto pegado como texto daba monto=NaN, y
        // NaN > tolerancia evalua false: la verificacion final fallaba ABIERTA con la fila
        // basura escrita en Proyeccion (o lanzaba DESPUES de borrar el volcado anterior).
        // guardarRecurrente valida solo en el alta; este es el otro camino de entrada.
        const invalidos = [];
        activos.forEach(function (r) {
            if (!isFinite(r.monto) || r.monto <= 0 ||
                !isFinite(r.dia) || r.dia < 1 || r.dia > 31) {
                invalidos.push('"' + r.nombre + '"');
            }
        });
        if (invalidos.length) {
            return { ok: false, error: 'La hoja "' + SHEETS.RECURRENTES + '" tiene datos ' +
                'invalidos en ' + invalidos.join(', ') + ' (monto o dia no numericos). ' +
                'Corregilos desde la vista de recurrentes y volve a volcar. No se toco nada.' };
        }

        const clave = anio + '-' + String(mes).padStart(2, '0');
        // Segundos, misma razon que _selloPg: dos corridas en el mismo minuto son plausibles.
        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
        const prefijo = REC_MARCA + ' ' + clave + ' ';

        // Cotizaciones ANTES de borrar nada: si la API falla no se toca una celda. La
        // excepcion sube al catch de _conLock (Regla Estricta 9, jamas un default).
        const cot = _cotizacionesVivasRec();
        // El MISMO clasificador del pipeline real, leido UNA vez por corrida. Puede dar ''
        // (gap conocido del pipeline: la fila queda sin tipo, igual que en procesarCargas).
        const catalogos = leerCatalogosPlanCuentas();

        // Idempotencia: retirar las propias del periodo y verificar CERO restantes.
        const previas = _filasRecPorPrefijo(hojaProy, prefijo);
        const otras = _otrasDelMesRec(hojaProy, mes, anio);
        if (previas.length) {
            _borrarFilasRec(hojaProy, previas);
            SpreadsheetApp.flush();
            const restantes = _filasRecPorPrefijo(hojaProy, prefijo);
            if (restantes.length) {
                return { ok: false, error: 'No se pudieron retirar las ' + restantes.length +
                    ' fila(s) del volcado anterior de ' + clave + '. No se escribio nada nuevo.' };
            }
        }

        // Matriz de filas nuevas (patron _matrizNuevaPg: posiciones derivadas de
        // RANGES.REGISTROS.columns -- el espejo comparte geometria con el ledger).
        const cfg = RANGES.REGISTROS;
        const colIni = columnLetterToIndex(cfg.start);
        const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
        const pos = {};
        Object.keys(cfg.columns).forEach(function (k) { pos[k] = columnLetterToIndex(cfg.columns[k]) - colIni; });
        const ultimoDia = new Date(anio, mes, 0).getDate();
        const totalPorMoneda = {};
        const matriz = activos.map(function (r) {
            const fila = new Array(ancho).fill('');
            const tipoCuenta = deducirTipoCuenta(r.cuenta, catalogos);
            fila[pos.monto] = r.monto;
            fila[pos.tipo] = tipoCuenta === 'Ingreso' ? 'Ingreso' : 'Egreso';
            fila[pos.cuenta] = r.cuenta;
            fila[pos.tipo_cuenta] = tipoCuenta;
            // A diferencia de PG, el recurrente SI captura medio: se escribe.
            fila[pos.medio] = r.medio;
            fila[pos.moneda] = r.moneda;
            // El dia REAL del recurrente, recortado al largo del mes (31 en febrero -> 28/29).
            fila[pos.fecha] = new Date(anio, mes - 1, Math.min(r.dia, ultimoDia));
            // El prefijo maquina va INTACTO al principio; el nombre despues del sello hace
            // legible la fila en la hoja.
            fila[pos.nota] = prefijo + sello + ' - ' + r.nombre + (r.nota ? ': ' + r.nota : '');
            fila[pos.tc_ars] = cot.ARS;
            fila[pos.tc_usd] = cot.USD;
            fila[pos.tc_aud] = cot.AUD;
            fila[pos.tc_eur] = cot.EUR;
            totalPorMoneda[r.moneda] = Math.round(((totalPorMoneda[r.moneda] || 0) + r.monto) * 100) / 100;
            return fila;
        });

        // Escritura al pie en UNA sola setValues (patron _escribirAlPieProyeccionPg).
        const primera = Math.max(hojaProy.getLastRow() + 1, cfg.dataRow);
        if (primera + matriz.length - 1 > hojaProy.getMaxRows()) {
            asegurarCapacidadFilas(hojaProy, primera + matriz.length - 1);
        }
        hojaProy.getRange(primera, colIni, matriz.length, matriz[0].length).setValues(matriz);
        SpreadsheetApp.flush();

        // Verificacion del VALOR releido, no de lo que se creyo escribir.
        const escritas = _filasRecPorPrefijo(hojaProy, prefijo);
        let detalleFalla = '';
        if (escritas.length !== activos.length) {
            detalleFalla = 'se esperaban ' + activos.length + ' fila(s) y se releyeron ' + escritas.length;
        } else {
            const fin = hojaProy.getLastRow();
            const nRe = fin - cfg.dataRow + 1;
            const montosRe = hojaProy.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.monto), nRe, 1).getValues();
            const monedasRe = hojaProy.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.moneda), nRe, 1).getValues();
            const releido = {};
            escritas.forEach(function (f) {
                const i = f - cfg.dataRow;
                const mon = String(monedasRe[i][0] || '');
                releido[mon] = (releido[mon] || 0) + (Number(montosRe[i][0]) || 0);
            });
            Object.keys(totalPorMoneda).forEach(function (mon) {
                const dif = Math.abs((releido[mon] || 0) - totalPorMoneda[mon]);
                // !isFinite es falla EXPLICITA: NaN > 0.01 da false y la verificacion
                // pasaba abierta justo cuando un valor releido no era un numero.
                if (!isFinite(dif) || dif > 0.01) {
                    detalleFalla = 'la suma en ' + mon + ' no cierra al releer';
                }
            });
        }
        if (detalleFalla) {
            _borrarFilasRec(hojaProy, escritas);
            SpreadsheetApp.flush();
            logError('volcarRecurrentesAlMes: no verifica (' + detalleFalla + '); se quito lo recien escrito.');
            // Las previas ya borradas no se restauran solas: son filas REGENERABLES desde la
            // hoja Recurrentes (a diferencia de las de PG, por eso no hace falta respaldo).
            return { ok: false, error: 'Se escribio pero no verifica (' + detalleFalla +
                '). Se quito lo recien escrito; el volcado anterior de ese mes ya se habia ' +
                'retirado. Corre el volcado de nuevo: las filas se regeneran desde la hoja "' +
                SHEETS.RECURRENTES + '".' };
        }

        const totales = Object.keys(totalPorMoneda).map(function (mon) {
            return _plata(totalPorMoneda[mon], mon);
        });
        let mensaje = 'Listo. Se volcaron ' + activos.length + ' recurrente(s) a ' +
            REC_MESES[mes - 1] + ' ' + anio + ' por ' + totales.join(' | ') + '.';
        if (previas.length) {
            mensaje += ' Se reemplazo el volcado anterior de ese mes (' + previas.length + ' filas).';
        }
        if (otras.base || otras.manual) {
            mensaje += ' El mes ya tiene ademas ' + otras.base + ' fila(s) del presupuesto base y ' +
                otras.manual + ' del guardado manual, que no se tocaron.';
        }
        logSuccess('volcarRecurrentesAlMes: ' + activos.length + ' fila(s) a ' + clave + '.');
        return { ok: true, mensaje: mensaje };
    });
}

// ============================================
// PRIVADAS
// ============================================

/**
 * Valida UN recurrente. Espejo de _validarMovimiento (16_ShellService.js): la cuenta NO se
 * valida contra los catalogos (mismo criterio que la grilla y vigilarCombo: la hoja acepta
 * valores fuera de lista; el cliente avisa sin bloquear), pero una cuenta comodin SI bloquea.
 *
 * @returns {Array<string>} problemas; vacio = todo bien
 */
function _validarRecurrente(d, catalogos) {
    const p = [];
    if (!d.nombre || !String(d.nombre).trim()) p.push('Falta el nombre.');

    const monto = Number(d.monto);
    if (!d.monto && d.monto !== 0) p.push('Falta el monto.');
    else if (isNaN(monto)) p.push('El monto no es un numero.');
    else if (monto <= 0) p.push('El monto tiene que ser mayor a cero.');

    if (!d.cuenta) p.push('Falta la cuenta.');
    else if (esCuentaNeutra(d.cuenta)) {
        p.push('La cuenta "' + d.cuenta + '" es una cuenta comodin del sistema: un recurrente ' +
            'sobre ella arruinaria los agregados.');
    }

    if (!d.medio) p.push('Falta el medio.');
    else if (catalogos && catalogos.medios && catalogos.medios.indexOf(d.medio) === -1) {
        p.push('El medio "' + d.medio + '" no esta en el Plan de Cuentas.');
    }

    if (!d.moneda || MONEDAS_DISPONIBLES.indexOf(d.moneda) === -1) {
        p.push('La moneda "' + (d.moneda || '') + '" no es una de las que maneja la planilla.');
    }

    const dia = Number(d.dia);
    if (!isFinite(dia) || dia !== Math.floor(dia) || dia < 1 || dia > 31) {
        p.push('El dia del mes tiene que ser un numero entero entre 1 y 31.');
    }

    if (d.activo !== REC_ACTIVO_SI && d.activo !== REC_ACTIVO_NO) {
        p.push('El estado tiene que ser "' + REC_ACTIVO_SI + '" o "' + REC_ACTIVO_NO + '".');
    }

    // Texto que empieza con '=' se escribiria como FORMULA VIVA via setValues; el nombre
    // releido diferiria del guardado y el upsert por nombre dejaria de encontrar la fila.
    // Se reusa el chequeo del shell (16_ShellService.js, misma linea de trabajo).
    if (_empiezaComoFormulaShell(d.nombre)) {
        p.push('El nombre no puede empezar con "=": la hoja lo leeria como formula.');
    }
    if (_empiezaComoFormulaShell(d.nota)) p.push(_MSJ_NOTA_FORMULA);
    return p;
}

/** El mensaje unico del rechazo de periodo (mismo texto en estado y volcado). */
const REC_MSJ_PERIODO = 'El periodo no se entiende: se espera mes (1-12) y anio de cuatro cifras.';

/**
 * Valida el periodo del volcado. El anio se exige entero y en rango: new Date(26, ...) mapea
 * al anio 1926 (regla 0-99 de Date) y el volcado "exitoso" escribia filas con fecha 1926 que
 * ningun consumidor (filtran por rango de mes) iba a mostrar jamas.
 */
function _periodoValidoRec(mes, anio) {
    return isFinite(mes) && mes >= 1 && mes <= 12 && mes === Math.floor(mes) &&
        isFinite(anio) && anio === Math.floor(anio) && anio >= 2024 && anio <= 2100;
}

/**
 * Las cuatro tasas EN VIVO, llamadas como funciones JS (nunca como formula de celda: trampa
 * "Loading..."). Copia local del patron _leerCotizacionesVivasPg, con cita: no se invoca el
 * helper privado del devtool. Ante fallo LANZA sin silenciar (Regla Estricta 9).
 */
function _cotizacionesVivasRec() {
    const usd = Number(TIDETRACK_USD());
    const aud = Number(TIDETRACK_AUD());
    const eur = Number(TIDETRACK_EUR());
    const chequear = function (nombre, v) {
        if (!isFinite(v) || v <= 0) {
            throw new Error('La cotizacion de ' + nombre + ' no es un numero valido ("' + v +
                '"): no se volco nada.');
        }
    };
    chequear('USD', usd);
    chequear('AUD', aud);
    chequear('EUR', eur);
    return { ARS: 1, USD: usd, AUD: aud, EUR: eur };
}

/**
 * Filas de la hoja Proyeccion cuya Nota empieza con `prefijo` exacto.
 * Copia del patron _filasPorNotaPrefijoPg (DEVTOOL_PresupuestoGuardar.js), con cita.
 */
function _filasRecPorPrefijo(hoja, prefijo) {
    const cfg = RANGES.REGISTROS;
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return [];
    const colNota = columnLetterToIndex(cfg.columns.nota);
    const notas = hoja.getRange(cfg.dataRow, colNota, ultima - cfg.dataRow + 1, 1).getValues();
    const out = [];
    notas.forEach(function (f, i) {
        if (String(f[0] || '').indexOf(prefijo) === 0) out.push(cfg.dataRow + i);
    });
    return out;
}

/**
 * Borra filas de abajo hacia arriba y EN BLOQUES CONTIGUOS.
 * Copia del patron _borrarGeneradasPb (DEVTOOL_PresupuestoBase.js), con cita: de abajo hacia
 * arriba para no correr los indices, en bloques porque deleteRow una por una no escala.
 */
function _borrarFilasRec(hoja, filas) {
    if (!filas.length) return 0;
    const ordenadas = filas.slice().sort(function (a, b) { return a - b; });
    const bloques = [];
    let ini = ordenadas[0], largo = 1;
    for (let i = 1; i < ordenadas.length; i++) {
        if (ordenadas[i] === ordenadas[i - 1] + 1) { largo++; continue; }
        bloques.push({ ini: ini, largo: largo });
        ini = ordenadas[i]; largo = 1;
    }
    bloques.push({ ini: ini, largo: largo });
    for (let i = bloques.length - 1; i >= 0; i--) hoja.deleteRows(bloques[i].ini, bloques[i].largo);
    return bloques.length;
}

/**
 * Cuantas filas AJENAS tiene el mes en Proyeccion: del presupuesto base (PB_MARCA, cruzado
 * por mes de la Fecha, patron _filasBasePorMesPg) y del guardado manual (PG_MARCA, idem).
 * PB_MARCA y PG_MARCA se leen ACA ADENTRO (cicatriz de orden de carga v0.50.1).
 *
 * @returns {{base:number, manual:number}}
 */
function _otrasDelMesRec(hoja, mes, anio) {
    const cfg = RANGES.REGISTROS;
    const ultima = hoja.getLastRow();
    const out = { base: 0, manual: 0 };
    if (ultima < cfg.dataRow) return out;
    const n = ultima - cfg.dataRow + 1;
    const notas = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.nota), n, 1).getValues();
    const fechas = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.fecha), n, 1).getValues();
    for (let i = 0; i < n; i++) {
        const f = fechas[i][0];
        const esDelMes = f instanceof Date && !isNaN(f.getTime()) &&
            f.getFullYear() === anio && f.getMonth() === mes - 1;
        if (!esDelMes) continue;
        const nota = String(notas[i][0] || '');
        if (nota.indexOf(PB_MARCA) === 0) out.base++;
        else if (nota.indexOf(PG_MARCA) === 0) out.manual++;
        // Sin ninguna de las dos marcas: no se toca, no se cuenta (contrato del ABM).
    }
    return out;
}
