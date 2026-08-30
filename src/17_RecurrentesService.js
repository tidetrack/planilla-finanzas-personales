/**
 * 17_RecurrentesService.js - la BD de gastos recurrentes y el horizonte que mantiene llena la
 * Proyeccion.
 *
 * [CONCEPTO DE NEGOCIO]
 * Pedido fundacional de Franco: suscripciones y pagos que se repiten todos los meses
 * (Netflix, alquiler, gimnasio) tienen que poder declararse UNA vez y contar SIEMPRE en las
 * proyecciones, sin retipearlos mes a mes en la hoja Presupuesto. La regla vive en una
 * hoja-BD propia ("Recurrentes", oculta) y se convierte en filas de la BD "Proyeccion".
 *
 * decision Franco 2026-08-30: EL USUARIO YA NO ELIGE UN MES. El recurrente se declara con su
 * VIGENCIA (Desde/Hasta, columnas J:K) y el sistema mantiene lleno un horizonte rodante de
 * REC_HORIZONTE_MESES meses hacia adelante. Se descartaron dos alternativas, y por que importa:
 *   (a) "que las vistas sumen al vuelo, sin volcar filas": dar de baja Netflix en julio le
 *       sacaria Netflix a la proyeccion de enero a junio TAMBIEN. Una proyeccion tiene que ser
 *       el REGISTRO de lo que se decidio entonces, no una consulta al estado de hoy -- el
 *       Tablero compara proyectado contra real mes a mes y esa columna dejaria de ser estable.
 *       Ademas el costo caeria en dos familias de FORMULAS de hoja (DEVTOOL_InicioPresupuesto y
 *       DEVTOOL_TableroFaltanteProyectado), en sintaxis en-US con la trampa del separador de
 *       locale: superficie que ningun verificador de este repo alcanza.
 *   (b) "volcar automaticamente al entrar a un mes": "entrar a un mes" es cambiar un desplegable
 *       de hoja, o sea un gesto de LECTURA. Escribir en una BD de produccion como efecto de una
 *       lectura va contra la regla del arnes de que el volcado es explicito y nunca efecto
 *       oculto, y ademas necesita UrlFetch para las cotizaciones, que un trigger simple no puede.
 * INVARIANTE DURO del horizonte: nunca se escribe ni se borra una fila con clave ANTERIOR al mes
 * en curso. Todo lo previo es historia congelada.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * La escritura calca los contratos ya probados de Guardar Proyeccion (DEVTOOL_PresupuestoGuardar.js):
 * marca propia en la Nota ("Gasto recurrente <clave> <sello>"), idempotencia por periodo
 * (sincronizar dos veces deja el mismo estado, nunca duplica), cotizaciones del
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
 * @see 18_RespaldoService.js (_conHojaActivaPreservada: el orden de la unica creacion de hoja)
 * @see DEVTOOL_ProyeccionAbm.js (_motivoBajaBloqueadaPa consulta _enVentanaRec)
 * @version 0.64.0
 * @since 0.56.0
 * @lastModified 2026-08-30
 */

// ============================================
// MARCADO Y GEOMETRIA PROPIA
// ============================================

// La marca de origen en la Nota de cada fila volcada a "Proyeccion". Tiene que
// distinguirse por prefijo de PB_MARCA ('Presupuesto base historico') y de PG_MARCA
// ('Presupuesto guardado'): ninguna es prefijo de otra, el indexOf(...)===0 nunca confunde.
const REC_MARCA = 'Gasto recurrente';
const REC_TITULO_HOJA = 'Recurrentes.';           // titulo en B2, punto final como los bloques del Plan
const REC_HEADERS = ['Nombre', 'Cuenta', 'Monto', 'Moneda', 'Medio', 'Dia del mes', 'Nota', 'Activo',
    'Desde', 'Hasta'];
const REC_ACTIVO_SI = 'Si';
const REC_ACTIVO_NO = 'No';
const REC_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
    'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// decision Franco 2026-08-30: HORIZONTE RODANTE CON VIGENCIA. El recurrente se declara UNA vez
// con su vigencia y el sistema mantiene lleno un horizonte de 12 meses hacia adelante; el
// usuario nunca elige un mes. 12 y no 6: un presupuesto anual necesita ver el ano cerrado. 12 y
// no 24: cada mes son ~N filas fisicas en la BD Proyeccion y el doble de horizonte no compra
// ninguna decision -- nadie planifica a dos anos un gasto recurrente que puede cambiar de monto.
// Literal puro y politica de ESTE modulo, no de Config: es una decision de producto de la vista
// de recurrentes, igual que REC_MESES. Cero simbolos de otro archivo (cicatriz v0.50.1).
const REC_HORIZONTE_MESES = 12;

// El formato de las columnas de vigencia. '@' es el patron de TEXTO PLANO de Sheets: sin el,
// "2026-08" se guarda como fecha y se relee como Date (patron de numero canonico, memoria del
// repo). Se aplica antes de la primera escritura y se verifica releyendo el VALOR.
const REC_FORMATO_TEXTO = '@';

// ============================================
// HOJA-BD (creada por el backend en el primer uso)
// ============================================

/** Escribe titulo, headers y el formato de texto de J:K, y RELEE para verificar. Tira si desvia. */
function _escribirYVerificarHeaderRec(ss, hoja) {
    const cfg = RANGES.RECURRENTES;
    const colIni = columnLetterToIndex(cfg.start);
    const colDesde = columnLetterToIndex(cfg.columns.desde);
    const colHasta = columnLetterToIndex(cfg.columns.hasta);

    // TEXTO PLANO en J:K ANTES de escribir nada ahi: si Sheets ve "2026-08" con formato
    // automatico lo guarda como fecha y lo relee como Date. Cubre header y banda de datos.
    hoja.getRange(cfg.headerRow, colDesde, hoja.getMaxRows() - cfg.headerRow + 1,
        colHasta - colDesde + 1).setNumberFormat(REC_FORMATO_TEXTO);

    hoja.getRange(2, colIni).setValue(REC_TITULO_HOJA);
    hoja.getRange(cfg.headerRow, colIni, 1, REC_HEADERS.length).setValues([REC_HEADERS]);

    // Formato del header copiado del ledger con PASTE_FORMAT: cero colores hardcodeados.
    // El formato NUNCA aborta: si el rango modelo no existe, se sigue sin formato.
    try {
        const cfgReg = RANGES.REGISTROS;
        const hojaReg = ss.getSheetByName(cfgReg.sheet);
        if (hojaReg) {
            const anchoModelo = Math.min(REC_HEADERS.length,
                columnLetterToIndex(cfgReg.end) - columnLetterToIndex(cfgReg.start) + 1);
            hojaReg.getRange(cfgReg.headerRow, columnLetterToIndex(cfgReg.start), 1, anchoModelo)
                .copyTo(hoja.getRange(cfg.headerRow, colIni, 1, anchoModelo),
                    SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        }
    } catch (e) {
        logInfo('_escribirYVerificarHeaderRec: header sin formato (' + (e && e.message ? e.message : e) + ').');
    }

    SpreadsheetApp.flush();

    // RELEER y comparar valor por valor. El VALOR, no el texto que se creyo escribir.
    const desvios = [];
    const titulo = String(hoja.getRange(2, colIni).getValue() || '');
    if (titulo !== REC_TITULO_HOJA) desvios.push('el titulo dice "' + titulo + '"');
    const vivos = hoja.getRange(cfg.headerRow, colIni, 1, REC_HEADERS.length).getValues()[0];
    REC_HEADERS.forEach(function (h, i) {
        const vivo = String(vivos[i] === null || vivos[i] === undefined ? '' : vivos[i]);
        if (vivo !== h) desvios.push('el header ' + (i + 1) + ' dice "' + vivo + '" y se esperaba "' + h + '"');
    });
    if (desvios.length) {
        throw new Error(desvios.join('; '));
    }
}

/**
 * Devuelve la hoja "Recurrentes", creandola si no existe. Se llama SOLO desde los caminos de
 * escritura (guardar/borrar): leer no crea la hoja.
 *
 * decision Franco 2026-08-30: DOS cambios.
 *
 * (1) EL ORDEN DE LA UNICA CREACION. Antes: insertSheet -> escribir -> flush -> verificar ->
 * hideSheet. insertSheet deja la hoja VISIBLE Y ACTIVA por contrato de Apps Script, el flush de
 * la verificacion empuja ese estado al cliente, y el hideSheet llegaba 40 lineas despues sin
 * devolver el foco: se veia la pestania y el usuario quedaba parado en otra hoja. Ahora se
 * delega en _conHojaActivaPreservada (18_RespaldoService.js), que repone el foco y oculta ANTES
 * de escribir una sola celda. Es una MITIGACION, no una garantia (las operaciones estructurales
 * pueden aplicarse antes que el resto del lote), y se paga UNA sola vez en la vida de la planilla.
 *
 * (2) CAMINO DE REPARACION DE HEADER. Antes hacia `if (hoja) return hoja;`: si la hoja YA existe
 * -- el caso de produccion -- nunca escribia los rotulos nuevos, asi que las columnas de vigencia
 * quedaban mudas y el modelo entero fallaba EN SILENCIO. Ahora, si la fila de header no tiene los
 * REC_HEADERS.length rotulos, los completa, aplica el formato de texto a J:K, relee y verifica; si
 * no puede, LANZA sin tocar nada mas.
 */
function _asegurarHojaRecurrentes(ss) {
    const existente = ss.getSheetByName(SHEETS.RECURRENTES);
    if (existente) {
        const cfg = RANGES.RECURRENTES;
        const colIni = columnLetterToIndex(cfg.start);
        const vivos = existente.getRange(cfg.headerRow, colIni, 1, REC_HEADERS.length).getValues()[0];
        const completo = REC_HEADERS.every(function (h, i) {
            return String(vivos[i] === null || vivos[i] === undefined ? '' : vivos[i]) === h;
        });
        if (completo) return existente;
        try {
            _escribirYVerificarHeaderRec(ss, existente);
        } catch (e) {
            throw new Error('La hoja "' + SHEETS.RECURRENTES + '" tiene el header incompleto y no se pudo ' +
                'reparar: ' + (e && e.message ? e.message : e) + '. No se escribio ningun dato.');
        }
        logSuccess('_asegurarHojaRecurrentes: header de "' + SHEETS.RECURRENTES + '" reparado a ' +
            REC_HEADERS.length + ' columnas (vigencia incluida).');
        return existente;
    }

    let hoja;
    try {
        hoja = _conHojaActivaPreservada(ss, SHEETS.RECURRENTES, function (h) {
            _escribirYVerificarHeaderRec(ss, h);
        });
    } catch (e) {
        throw new Error('No se pudo crear la hoja "' + SHEETS.RECURRENTES + '": ' +
            (e && e.message ? e.message : e) + '. Se borro la hoja a medio crear.');
    }

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
                    activo: String(f[ix('activo')] || '').trim() === REC_ACTIVO_SI,
                    // Vigencia: '' significa "desde siempre" / "sin fin". _claveVigenciaRec
                    // normaliza tambien el caso en que Sheets haya guardado la celda como Date
                    // (planillas anteriores al formato de texto de J:K).
                    desde: _claveVigenciaRec(f[ix('desde')]),
                    hasta: _claveVigenciaRec(f[ix('hasta')])
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
        poner('desde', _claveVigenciaRec(d.desde));
        poner('hasta', _claveVigenciaRec(d.hasta));

        const buscado = normalizarNombreCuenta(nombre);
        const ixNombre = columnLetterToIndex(cfg.columns.nombre) - base;
        const tabla = getTableData('RECURRENTES');
        let indice = -1;
        tabla.forEach(function (f, i) {
            if (indice === -1 && normalizarNombreCuenta(f[ixNombre]) === buscado) indice = i;
        });

        const esEdicion = indice !== -1;
        // La fila ANTERIOR se copia ANTES de pisarla: es lo unico con lo que se puede reponer si
        // la verificacion de mas abajo falla.
        const filaPrevia = esEdicion ? tabla[indice].slice() : null;
        if (esEdicion) updateRow('RECURRENTES', indice, fila);
        else appendRow('RECURRENTES', fila);

        // VERIFICAR EL VALOR RELEIDO de la vigencia, no el texto que se creyo escribir: si la
        // celda quedo como fecha en vez de texto, la regla de pertenencia compararia una Date
        // contra 'YYYY-MM' y el recurrente desapareceria del horizonte sin que nadie avise.
        const desvioVig = _verificarVigenciaEscritaRec(nombre, _claveVigenciaRec(d.desde), _claveVigenciaRec(d.hasta));
        if (desvioVig) {
            // decision Franco 2026-08-30: un ok:false NO puede dejar la BD cambiada. Antes se
            // devolvia el error con la fila YA ESCRITA y sin correr la fase 2: el usuario veia
            // un fallo, el recurrente quedaba en la hoja y la proyeccion no se sincronizaba --
            // un estado a medias que el mensaje ni siquiera nombraba. Ahora se deshace la
            // escritura, como ya hacen aplicarGuardarProyeccion y _escribirClavesRec, y el
            // mensaje DICE en que estado quedo todo (Regla Estricta 9 llevada a la BD: el
            // fallo se cuenta entero, nunca se silencia ni se deja implicito).
            return { ok: false, error: desvioVig + ' ' + _deshacerEscrituraRec(esEdicion, indice, filaPrevia, nombre) };
        }

        let mensaje = esEdicion
            ? 'Listo. Actualizaste "' + nombre + '".'
            : 'Listo. Guardaste "' + nombre + '": ' + _plata(d.monto, d.moneda) +
              ' el dia ' + Number(d.dia) + ' de cada mes.';
        if (d.activo === REC_ACTIVO_NO) mensaje += ' Quedo pausado: sale de los meses futuros del horizonte.';
        logSuccess('guardarRecurrente: "' + nombre + '" ' + (esEdicion ? 'actualizado' : 'creado') + '.');

        // FASE 2: propagar al horizonte. El usuario ya pidio el cambio; propagarlo no es un
        // efecto oculto, es terminar la accion. Si falla, el recurrente NO se pierde.
        return _conFase2Rec({ ok: true, mensaje: mensaje });
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
        return _conFase2Rec({ ok: true, mensaje: 'Listo. Se borro "' + nombre +
            '". Sale del horizonte; lo proyectado en meses ya pasados queda como esta.' });
    });
}

/**
 * SOLO LECTURA: el estado del HORIZONTE. No escribe una sola celda: la vista lo pide al abrir y
 * pinta el boton "Poner al dia" solo si `desincronizado` es true.
 *
 * decision Franco 2026-08-30: sin parametros. "Entrar a un mes" en esta planilla es cambiar un
 * desplegable de hoja, y volcar ahi seria escribir en una BD de produccion como efecto de un
 * gesto de LECTURA. El usuario no elige un mes: el sistema mantiene lleno el horizonte.
 *
 * decision Franco 2026-08-30: ademas de la ventana, informa lo que quedo FUERA de ella hacia
 * adelante. El modelo viejo (`volcarRecurrentesAlMes`) dejaba elegir cualquier mes hasta 2100, asi
 * que una planilla puede tener filas "Gasto recurrente <clave> ..." en meses lejanos. El horizonte
 * rodante solo toca las claves de su ventana -- `_escribirClavesRec` no toca una sola fila fuera
 * de `claves`, jamas --, asi que esas filas no se duplican (cuando la ventana llegue a ese mes las
 * va a reemplazar) pero hasta entonces siguen sumando en la proyeccion aunque la vigencia diga
 * otra cosa: un "Hasta mar 2027" puesto hoy no borra un volcado viejo de 2028. Se INFORMAN y no se
 * borran: borrar por iniciativa propia va contra el criterio del modulo, y esas claves no estan
 * bloqueadas por `_motivoBajaBloqueadaPa` (devuelve '' fuera de ventana), asi que el camino de
 * baja existe y es Proyecciones Elaboradas.
 *
 * @returns {{ok:boolean, ventana?:{desde:string,hasta:string}, activos?:number, pausados?:number,
 *            totalPorMoneda?:Object, filasEnVentana?:number, mesesFaltantes?:Array<string>,
 *            sobrantes?:number, mesesSobrantes?:Array<string>, desincronizado?:boolean,
 *            error?:string}}
 */
function estadoHorizonteRecurrentes() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hojaProy = ss ? ss.getSheetByName(SHEETS.PROYECCION) : null;
        if (!hojaProy) {
            return { ok: false, error: 'No existe la hoja "' + SHEETS.PROYECCION +
                '". Corre primero tidetrack Dev > BD de Proyeccion.' };
        }
        const lect = obtenerRecurrentes();
        if (!lect.ok) return lect;

        const claves = _clavesVentanaRec();
        const activos = lect.recurrentes.filter(function (r) { return r.activo; });
        const totalPorMoneda = {};
        activos.forEach(function (r) {
            totalPorMoneda[r.moneda] = Math.round(((totalPorMoneda[r.moneda] || 0) + r.monto) * 100) / 100;
        });

        // Un mes "falta" cuando el deseado y lo escrito no coinciden en CANTIDAD de filas: es la
        // medicion mas barata que distingue "al dia" de "quedo corto" sin releer monto por monto.
        const escritasPorMes = _conteoRecPorClaveRec(hojaProy, claves);
        const mesesFaltantes = [];
        let filasEnVentana = 0;
        claves.forEach(function (c) {
            const esperadas = lect.recurrentes.filter(function (r) { return _correEnMesRec(r, c); }).length;
            const escritas = escritasPorMes[c] || 0;
            filasEnVentana += escritas;
            if (escritas !== esperadas) mesesFaltantes.push(c);
        });

        // Lo que quedo fuera de la ventana HACIA ADELANTE: filas que el horizonte no mide ni
        // toca, pero que la proyeccion si suma. Lo de ATRAS no se cuenta a proposito: es historia
        // congelada por el invariante duro del modulo, no un sobrante.
        const posteriores = _recPosterioresRec(hojaProy, claves[claves.length - 1]);

        return {
            ok: true,
            ventana: { desde: claves[0], hasta: claves[claves.length - 1] },
            activos: activos.length,
            pausados: lect.recurrentes.length - activos.length,
            totalPorMoneda: totalPorMoneda,
            filasEnVentana: filasEnVentana,
            mesesFaltantes: mesesFaltantes,
            sobrantes: posteriores.filas,
            mesesSobrantes: posteriores.claves,
            desincronizado: mesesFaltantes.length > 0
        };
    } catch (e) {
        logError('estadoHorizonteRecurrentes', e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
    }
}

/**
 * Mantiene lleno el horizonte de REC_HORIZONTE_MESES meses a partir del mes en curso: por cada
 * mes de la ventana escribe una fila por cada recurrente que CORRE en ese mes (regla de
 * pertenencia: activo, y la clave dentro de [Desde, Hasta]).
 *
 * Reemplaza a volcarRecurrentesAlMes(d): el mes como parametro era el modelo viejo.
 *
 * INVARIANTE DURO: nunca escribe ni borra una fila con clave ANTERIOR al mes en curso. Todo lo
 * previo es historia congelada -- una proyeccion es el registro de lo que se decidio entonces, no
 * una consulta al estado de hoy. Consecuencia declarada: editar un recurrente hoy SI reescribe el
 * mes en curso; quien quiera preservarlo pone Hasta = mes en curso.
 *
 * IDEMPOTENTE: dos corridas seguidas sin cambios dejan exactamente el mismo estado (mismas filas
 * por mes, mismos montos); lo unico que cambia es el sello de la Nota.
 *
 * @returns {{ok:boolean, mensaje?:string, error?:string}}
 */
function sincronizarRecurrentes() {
    return _conLock(function () { return _sincronizarRecurrentesSinLock(); });
}

/**
 * El nucleo de la sincronizacion, SIN lock. Lo llaman `sincronizarRecurrentes` (que si lo toma)
 * y la fase 2 de guardar/borrar, que ya corren adentro de _conLock -- tomarlo de nuevo ahi
 * devolveria "la planilla esta ocupada" contra uno mismo.
 *
 * Todo caller NUEVO tiene que envolverlo en _conLock; nunca llamarlo pelado desde un endpoint.
 */
function _sincronizarRecurrentesSinLock() {
    const claves = _clavesVentanaRec();
    const r = _escribirClavesRec(claves, 'sincronizarRecurrentes');
    if (!r.ok) return r;

    const desde = _mesLabelRec(claves[0]);
    const hasta = _mesLabelRec(claves[claves.length - 1]);
    let mensaje = r.escritas
        ? 'Listo. La proyeccion queda al dia hasta ' + hasta + ': ' + r.escritas +
          ' fila(s) entre ' + desde + ' y ' + hasta + '.'
        : 'Listo. No hay ningun recurrente corriendo: el horizonte de ' + desde + ' a ' + hasta +
          ' quedo sin filas de recurrentes.';
    if (r.previas) mensaje += ' Se reemplazo lo que ya habia en esos meses (' + r.previas + ' filas).';
    return { ok: true, mensaje: mensaje };
}

/**
 * EL UNICO ESCRITOR de filas de recurrentes en "Proyeccion". Reemplaza, en las claves de mes
 * indicadas, TODAS las filas REC por las que corresponden a la regla de pertenencia. Ninguna
 * fila fuera de `claves` se toca -- jamas.
 *
 * Lo comparten la sincronizacion del horizonte y el volcado transitorio a un mes: dos caminos
 * con un solo escritor, para que no puedan divergir con el tiempo.
 *
 * @returns {{ok:boolean, escritas?:number, previas?:number, error?:string}}
 */
function _escribirClavesRec(claves, etiqueta) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaProy = ss.getSheetByName(SHEETS.PROYECCION);
    if (!hojaProy) {
        return { ok: false, error: 'No existe la hoja "' + SHEETS.PROYECCION +
            '". Corre primero tidetrack Dev > BD de Proyeccion.' };
    }
    // Preflight angosto: el espejo sigue siendo espejo. Se reusa el del shell (misma linea de
    // trabajo, mismas fuentes de Config); NO se reusa _preflightPb (devtool ajeno).
    _preflightEspejoProyeccionShell(ss, hojaProy);

    const lect = obtenerRecurrentes();
    if (!lect.ok) return lect;

    // Se REVALIDA lo leido de la hoja (oculta pero editable) ANTES de borrar nada, y ahora la
    // revalidacion cubre tambien la vigencia: una fila invalida aborta nombrando el recurrente.
    const invalidos = _revalidarRecurrentesRec(lect.recurrentes);
    if (invalidos.length) {
        return { ok: false, error: 'La hoja "' + SHEETS.RECURRENTES + '" tiene datos invalidos en ' +
            invalidos.join(', ') + '. Corregilos desde la vista de Gastos recurrentes y volve a ' +
            'poner al dia la proyeccion. No se toco nada.' };
    }

    const deseadoPorMes = {};
    let totalDeseado = 0;
    claves.forEach(function (c) {
        deseadoPorMes[c] = lect.recurrentes.filter(function (r) { return _correEnMesRec(r, c); });
        totalDeseado += deseadoPorMes[c].length;
    });

    // Cotizaciones ANTES de borrar nada: si la API falla no se toca una celda. La excepcion sube
    // al catch de _conLock (Regla Estricta 9, jamas un default).
    const cot = _cotizacionesVivasRec();
    // El MISMO clasificador del pipeline real, leido UNA vez por corrida.
    const catalogos = leerCatalogosPlanCuentas();
    const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');

    // Idempotencia por VENTANA: se retiran las filas REC de esos meses y NINGUNA de afuera.
    // Verificar cero restantes antes de escribir.
    const previas = _filasRecEnClaves(hojaProy, claves);
    if (previas.length) {
        _borrarFilasRec(hojaProy, previas);
        SpreadsheetApp.flush();
        const restantes = _filasRecEnClaves(hojaProy, claves);
        if (restantes.length) {
            return { ok: false, error: 'No se pudieron retirar las ' + restantes.length +
                ' fila(s) anteriores de ' + claves.join(', ') + '. No se escribio nada nuevo.' };
        }
    }

    const armado = _matrizRecParaClaves(claves, deseadoPorMes, cot, catalogos, sello);
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    if (armado.matriz.length) {
        const primera = Math.max(hojaProy.getLastRow() + 1, cfg.dataRow);
        if (primera + armado.matriz.length - 1 > hojaProy.getMaxRows()) {
            asegurarCapacidadFilas(hojaProy, primera + armado.matriz.length - 1);
        }
        hojaProy.getRange(primera, colIni, armado.matriz.length, armado.matriz[0].length).setValues(armado.matriz);
    }
    SpreadsheetApp.flush();

    // Verificacion del VALOR releido: cantidad de filas POR MES y suma POR MONEDA POR MES.
    const detalleFalla = _verificarHorizonteRec(hojaProy, claves, armado.esperadoPorMes);
    if (detalleFalla) {
        const escritas = _filasRecEnClaves(hojaProy, claves);
        if (escritas.length) { _borrarFilasRec(hojaProy, escritas); SpreadsheetApp.flush(); }
        logError(etiqueta + ': no verifica (' + detalleFalla + '); se quito lo recien escrito.');
        // Las previas ya borradas no se restauran solas: son filas REGENERABLES desde la hoja
        // Recurrentes (a diferencia de las de PG, por eso no hace falta respaldo).
        return { ok: false, error: 'Se escribio pero no verifica (' + detalleFalla +
            '). Se quito lo recien escrito. Volve a poner al dia la proyeccion: las filas se ' +
            'regeneran desde la hoja "' + SHEETS.RECURRENTES + '".' };
    }

    logSuccess(etiqueta + ': ' + totalDeseado + ' fila(s) en ' + claves.length + ' mes(es).');
    return { ok: true, escritas: totalDeseado, previas: previas.length };
}

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

    // Vigencia: vacia significa "desde siempre" / "sin fin". No hay default inventado.
    const desde = _claveVigenciaRec(d.desde);
    const hasta = _claveVigenciaRec(d.hasta);
    if (!_vigenciaValidaRec(desde)) p.push('El "Desde" tiene que ser un mes (por ejemplo 2026-09) o quedar vacio.');
    if (!_vigenciaValidaRec(hasta)) p.push('El "Hasta" tiene que ser un mes (por ejemplo 2027-07) o quedar vacio.');
    if (_vigenciaValidaRec(desde) && _vigenciaValidaRec(hasta) && desde && hasta && hasta < desde) {
        p.push('El "Hasta" (' + hasta + ') no puede ser anterior al "Desde" (' + desde + ').');
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

// --------------------------------------------
// VIGENCIA Y VENTANA (el modelo de horizonte rodante)
// --------------------------------------------

/** Clave estable de mes ('2026-09') a partir de una fecha. */
function _claveMesRec(fecha) {
    return fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');
}

/** 'Septiembre 2026' a partir de una clave 'YYYY-MM'. Reusa REC_MESES (nunca IP_MESES). */
function _mesLabelRec(clave) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(clave || ''));
    if (!m) return String(clave || '');
    return REC_MESES[parseInt(m[2], 10) - 1] + ' ' + m[1];
}

/**
 * Normaliza un valor de vigencia a '' o 'YYYY-MM'. Acepta Date porque una planilla anterior al
 * formato de texto de J:K pudo guardar "2026-08" como fecha; si el valor no se entiende se
 * devuelve TAL CUAL para que la validacion lo rechace nombrandolo, nunca se adivina un mes.
 */
function _claveVigenciaRec(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return isNaN(v.getTime()) ? '' : _claveMesRec(v);
    const s = String(v).trim();
    if (s === '') return '';
    const m = /^(\d{4})-(\d{1,2})$/.exec(s);
    if (!m) return s;
    const mes = parseInt(m[2], 10);
    if (mes < 1 || mes > 12) return s;
    return m[1] + '-' + String(mes).padStart(2, '0');
}

/** true si el valor ya normalizado es una vigencia aceptable: vacia o 'YYYY-MM' plausible. */
function _vigenciaValidaRec(v) {
    if (v === '') return true;
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/**
 * Las claves de mes de la ventana: [mes en curso, mes en curso + REC_HORIZONTE_MESES - 1].
 * `hoy` es un parametro SOLO para que el banco pueda fijar el reloj; en produccion nunca se pasa.
 */
function _clavesVentanaRec(hoy) {
    const base = (hoy instanceof Date && !isNaN(hoy.getTime())) ? hoy : new Date();
    const out = [];
    for (let i = 0; i < REC_HORIZONTE_MESES; i++) {
        out.push(_claveMesRec(new Date(base.getFullYear(), base.getMonth() + i, 1)));
    }
    return out;
}

/** true si `clave` cae dentro de la ventana vigente. Lo consulta el ABM para bloquear la baja. */
function _enVentanaRec(clave) {
    return _clavesVentanaRec().indexOf(String(clave || '')) !== -1;
}

/**
 * LA UNICA REGLA DEL MODELO: un recurrente corre en el mes `clave` si esta activo y la clave cae
 * dentro de su vigencia. Las tres cadenas son 'YYYY-MM', comparables lexicograficamente.
 *
 * 'Activo' y 'Hasta' NO son lo mismo: pausado sale de los meses futuros y es reversible sin
 * perder las fechas; Hasta es el ULTIMO mes en que corre, o sea la baja de verdad.
 */
function _correEnMesRec(r, clave) {
    if (!r || !r.activo) return false;
    if (r.desde && r.desde > clave) return false;
    if (r.hasta && clave > r.hasta) return false;
    return true;
}

/**
 * Revalida lo leido de la hoja (oculta pero editable). Devuelve la lista de recurrentes con
 * problemas, ya entrecomillada para el mensaje. Vacia = todo bien.
 */
function _revalidarRecurrentesRec(lista) {
    const invalidos = [];
    lista.forEach(function (r) {
        const problemas = [];
        // El monto y el dia se revalidan aunque el recurrente este pausado: un NaN guardado hoy
        // rompe la corrida del dia en que alguien lo reactive, y ese dia nadie mira esta hoja.
        if (!isFinite(r.monto) || r.monto <= 0) problemas.push('monto');
        if (!isFinite(r.dia) || r.dia < 1 || r.dia > 31) problemas.push('dia');
        if (!_vigenciaValidaRec(r.desde)) problemas.push('Desde');
        if (!_vigenciaValidaRec(r.hasta)) problemas.push('Hasta');
        if (!problemas.length && r.desde && r.hasta && r.hasta < r.desde) problemas.push('Hasta anterior a Desde');
        if (problemas.length) invalidos.push('"' + r.nombre + '" (' + problemas.join(', ') + ')');
    });
    return invalidos;
}

/**
 * Relee la vigencia recien escrita y devuelve el desvio, o '' si coincide. Verificar el VALOR y
 * no el texto que se creyo escribir: si la celda quedo como Date, la comparacion lexicografica
 * de _correEnMesRec dejaria de encontrar el recurrente y nadie se enteraria.
 */
function _verificarVigenciaEscritaRec(nombre, desdeEsperado, hastaEsperado) {
    const lect = obtenerRecurrentes();
    if (!lect.ok) return 'No se pudo releer la hoja "' + SHEETS.RECURRENTES + '" para verificar la vigencia.';
    const buscado = normalizarNombreCuenta(nombre);
    let fila = null;
    lect.recurrentes.forEach(function (r) {
        if (fila === null && normalizarNombreCuenta(r.nombre) === buscado) fila = r;
    });
    if (!fila) {
        return 'Se guardo "' + nombre + '" pero al releer la hoja "' + SHEETS.RECURRENTES +
            '" no aparece. No se sincronizo la proyeccion.';
    }
    if (fila.desde !== desdeEsperado || fila.hasta !== hastaEsperado) {
        return 'La vigencia de "' + nombre + '" no quedo como se escribio (se releyo Desde "' +
            fila.desde + '" y Hasta "' + fila.hasta + '", se esperaba "' + desdeEsperado + '" y "' +
            hastaEsperado + '"). Revisar el formato de las columnas ' + RANGES.RECURRENTES.columns.desde +
            ':' + RANGES.RECURRENTES.columns.hasta + ' de la hoja.';
    }
    return '';
}

/**
 * Deshace la escritura de `guardarRecurrente` cuando la verificacion posterior falla, y devuelve
 * la frase que CUENTA en que estado quedo la hoja. Nunca lanza: el error que manda es el de la
 * verificacion, y este texto se le pega.
 *
 * decision Franco 2026-08-30: el alta se localiza POR NOMBRE, no por "la ultima fila". Adentro
 * del lock nadie mas escribe, asi que asumir la posicion funcionaria -- pero borrar por numero de
 * fila asumido es exactamente la cicatriz que este mismo release esta cerrando en el deshacer del
 * ABM de proyecciones. Si el upsert dejo dos filas con el mismo nombre (no deberia), se quita la
 * ULTIMA, que es la recien appendeada.
 */
function _deshacerEscrituraRec(esEdicion, indice, filaPrevia, nombre) {
    try {
        if (esEdicion) {
            updateRow('RECURRENTES', indice, filaPrevia);
            return 'El recurrente "' + nombre + '" se repuso como estaba antes: la hoja "' +
                SHEETS.RECURRENTES + '" no quedo cambiada y la proyeccion no se toco.';
        }
        const cfg = RANGES.RECURRENTES;
        const ix = columnLetterToIndex(cfg.columns.nombre) - columnLetterToIndex(cfg.start);
        const buscado = normalizarNombreCuenta(nombre);
        let ultima = -1;
        getTableData('RECURRENTES').forEach(function (f, i) {
            if (normalizarNombreCuenta(f[ix]) === buscado) ultima = i;
        });
        if (ultima === -1) {
            return 'No quedo nada que deshacer: la fila recien escrita ya no esta en la hoja "' +
                SHEETS.RECURRENTES + '".';
        }
        deleteRow('RECURRENTES', ultima);
        return 'Se quito el alta recien escrita: "' + nombre + '" NO quedo guardado y la ' +
            'proyeccion no se toco.';
    } catch (e) {
        logError('_deshacerEscrituraRec', e);
        return 'ADEMAS fallo el deshacer automatico (' + String(e && e.message ? e.message : e) +
            '): "' + nombre + '" QUEDO ESCRITO en la hoja "' + SHEETS.RECURRENTES + '" y la ' +
            'proyeccion NO se sincronizo. Revisar esa hoja a mano antes de volver a guardar.';
    }
}

// --------------------------------------------
// FASE 2: propagar al horizonte despues de guardar o borrar
// --------------------------------------------

/**
 * Le agrega a un resultado ya exitoso la SEGUNDA FASE: sincronizar el horizonte.
 *
 * decision Franco 2026-08-30: si la fase 1 (escribir en la hoja Recurrentes) salio bien y la
 * fase 2 falla (API de cotizaciones caida, verificacion), el recurrente NO se pierde: se
 * devuelve ok:true con `sincronizado:false` y un `aviso` con la razon EXACTA, para que la vista
 * ofrezca reintentar. El fallo se loguea y se muestra: no se silencia ni se sustituye por un
 * default (Regla Estricta 9). Corre SIN lock porque ya estamos adentro de uno.
 */
function _conFase2Rec(resultado) {
    let aviso = '';
    try {
        const sync = _sincronizarRecurrentesSinLock();
        if (sync && sync.ok) {
            resultado.sincronizado = true;
            return resultado;
        }
        aviso = (sync && sync.error) ? sync.error : 'No se pudo actualizar la proyeccion.';
    } catch (e) {
        aviso = String(e && e.message ? e.message : e);
    }
    resultado.sincronizado = false;
    resultado.aviso = aviso;
    logError('_conFase2Rec: el recurrente quedo guardado, la proyeccion no se sincronizo', { aviso: aviso });
    return resultado;
}

// --------------------------------------------
// LECTURA Y ESCRITURA POR CLAVE DE MES
// --------------------------------------------

/**
 * Filas de "Proyeccion" con marca REC cuya clave de mes este en `claves`. UNA sola lectura de la
 * columna Nota. La clave se corta por el PRIMER espacio despues del prefijo, nunca con una regex
 * sobre la Nota entera (el sello tambien tiene guiones y numeros).
 */
function _filasRecEnClaves(hoja, claves) {
    const cfg = RANGES.REGISTROS;
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return [];
    const enVentana = {};
    claves.forEach(function (c) { enVentana[c] = true; });
    const prefijo = REC_MARCA + ' ';
    const notas = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.nota),
        ultima - cfg.dataRow + 1, 1).getValues();
    const out = [];
    notas.forEach(function (f, i) {
        const nota = String(f[0] || '');
        if (nota.indexOf(prefijo) !== 0) return;
        const resto = nota.slice(prefijo.length);
        const esp = resto.indexOf(' ');
        const clave = esp === -1 ? resto : resto.slice(0, esp);
        if (enVentana[clave]) out.push(cfg.dataRow + i);
    });
    return out;
}

/**
 * Filas REC con clave POSTERIOR a `ultimaClave` (el ultimo mes de la ventana). Una sola lectura de
 * la columna Nota, el mismo recorte de clave que `_conteoRecPorClaveRec`.
 *
 * Solo mira hacia ADELANTE. Lo anterior al mes en curso es historia congelada por el invariante
 * duro del modulo -- no es un sobrante, es el registro de lo que se decidio entonces.
 *
 * @returns {{filas:number, claves:Array<string>}} claves ordenadas, sin repetir
 */
function _recPosterioresRec(hoja, ultimaClave) {
    const cfg = RANGES.REGISTROS;
    const out = { filas: 0, claves: [] };
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return out;
    const prefijo = REC_MARCA + ' ';
    const notas = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.nota),
        ultima - cfg.dataRow + 1, 1).getValues();
    const vistas = {};
    notas.forEach(function (f) {
        const nota = String(f[0] || '');
        if (nota.indexOf(prefijo) !== 0) return;
        const resto = nota.slice(prefijo.length);
        const esp = resto.indexOf(' ');
        const clave = esp === -1 ? resto : resto.slice(0, esp);
        // Comparacion lexicografica: 'YYYY-MM' ordena igual que cronologicamente. Una clave
        // malformada (que no matchea el formato) NO cuenta como sobrante: no se puede afirmar
        // que este adelante, y afirmar de mas es peor que callar.
        if (!/^\d{4}-\d{2}$/.test(clave) || clave <= ultimaClave) return;
        out.filas++;
        if (!vistas[clave]) { vistas[clave] = true; out.claves.push(clave); }
    });
    out.claves.sort();
    return out;
}

/** Cuantas filas REC hay escritas por cada clave de `claves`. Una sola lectura. */
function _conteoRecPorClaveRec(hoja, claves) {
    const cfg = RANGES.REGISTROS;
    const conteo = {};
    claves.forEach(function (c) { conteo[c] = 0; });
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return conteo;
    const prefijo = REC_MARCA + ' ';
    const notas = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.nota),
        ultima - cfg.dataRow + 1, 1).getValues();
    notas.forEach(function (f) {
        const nota = String(f[0] || '');
        if (nota.indexOf(prefijo) !== 0) return;
        const resto = nota.slice(prefijo.length);
        const esp = resto.indexOf(' ');
        const clave = esp === -1 ? resto : resto.slice(0, esp);
        if (conteo[clave] !== undefined) conteo[clave]++;
    });
    return conteo;
}

/**
 * Arma la matriz de filas nuevas para todas las claves, de una sola vez (patron _matrizNuevaPg:
 * posiciones derivadas de RANGES.REGISTROS.columns -- el espejo comparte geometria con el ledger).
 *
 * CONTRATO DE NOTA INTACTO: "<REC_MARCA> <YYYY-MM> <sello> - <nombre>[: <nota>]". No se toca:
 * _origenNotaPa (DEVTOOL_ProyeccionAbm.js) lo parsea tal cual y hay filas de ese formato en
 * produccion; cambiarlo haria caer una poblacion entera del ABM a 'otros'.
 *
 * @returns {{matriz:Array<Array<*>>, esperadoPorMes:Object}}
 */
function _matrizRecParaClaves(claves, deseadoPorMes, cot, catalogos, sello) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const pos = {};
    Object.keys(cfg.columns).forEach(function (k) { pos[k] = columnLetterToIndex(cfg.columns[k]) - colIni; });

    const matriz = [];
    const esperadoPorMes = {};
    claves.forEach(function (clave) {
        const anio = parseInt(clave.slice(0, 4), 10);
        const mes = parseInt(clave.slice(5, 7), 10);
        const ultimoDia = new Date(anio, mes, 0).getDate();
        const prefijo = REC_MARCA + ' ' + clave + ' ';
        const porMoneda = {};
        (deseadoPorMes[clave] || []).forEach(function (r) {
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
            fila[pos.nota] = prefijo + sello + ' - ' + r.nombre + (r.nota ? ': ' + r.nota : '');
            fila[pos.tc_ars] = cot.ARS;
            fila[pos.tc_usd] = cot.USD;
            fila[pos.tc_aud] = cot.AUD;
            fila[pos.tc_eur] = cot.EUR;
            porMoneda[r.moneda] = Math.round(((porMoneda[r.moneda] || 0) + r.monto) * 100) / 100;
            matriz.push(fila);
        });
        esperadoPorMes[clave] = { n: (deseadoPorMes[clave] || []).length, porMoneda: porMoneda };
    });
    return { matriz: matriz, esperadoPorMes: esperadoPorMes };
}

/**
 * Relee y compara: cantidad de filas POR MES y suma POR MONEDA POR MES. Devuelve el detalle del
 * primer desvio, o '' si todo cierra. `!isFinite` es falla EXPLICITA: NaN > 0.01 da false y la
 * verificacion pasaba abierta justo cuando un valor releido no era un numero.
 */
function _verificarHorizonteRec(hoja, claves, esperadoPorMes) {
    const cfg = RANGES.REGISTROS;
    const conteo = _conteoRecPorClaveRec(hoja, claves);
    for (let i = 0; i < claves.length; i++) {
        const clave = claves[i];
        const esperado = esperadoPorMes[clave];
        if (conteo[clave] !== esperado.n) {
            return 'en ' + clave + ' se esperaban ' + esperado.n + ' fila(s) y se releyeron ' + conteo[clave];
        }
    }
    const filas = _filasRecEnClaves(hoja, claves);
    if (!filas.length) return '';

    const ultima = hoja.getLastRow();
    const n = ultima - cfg.dataRow + 1;
    const notas = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.nota), n, 1).getValues();
    const montos = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.monto), n, 1).getValues();
    const monedas = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.moneda), n, 1).getValues();
    const prefijo = REC_MARCA + ' ';
    const releido = {};
    filas.forEach(function (f) {
        const i = f - cfg.dataRow;
        const resto = String(notas[i][0] || '').slice(prefijo.length);
        const esp = resto.indexOf(' ');
        const clave = esp === -1 ? resto : resto.slice(0, esp);
        const mon = String(monedas[i][0] || '');
        if (!releido[clave]) releido[clave] = {};
        releido[clave][mon] = (releido[clave][mon] || 0) + (Number(montos[i][0]) || 0);
    });
    for (let i = 0; i < claves.length; i++) {
        const clave = claves[i];
        const esperado = esperadoPorMes[clave].porMoneda;
        const monedas0 = Object.keys(esperado);
        for (let j = 0; j < monedas0.length; j++) {
            const mon = monedas0[j];
            const dif = Math.abs(((releido[clave] || {})[mon] || 0) - esperado[mon]);
            if (!isFinite(dif) || dif > 0.01) {
                return 'la suma en ' + mon + ' de ' + clave + ' no cierra al releer';
            }
        }
    }
    return '';
}
