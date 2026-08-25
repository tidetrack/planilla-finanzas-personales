/**
 * DEVTOOL_PurgaRespaldos.js
 * Borra las hojas de respaldo que los devtools de este repo van dejando en cada corrida.
 *
 * [CONCEPTO DE NEGOCIO]
 * Cada modulo que escribe sobre "Inicio", "Tablero" o "Plan de Cuentas" primero congela un
 * respaldo -- una hoja nueva, oculta, fechada -- por si la escritura sale mal. Es la garantia
 * que sostiene TODO el patron estado/aplicar/revertir de este repo (ver CLAUDE.md, seccion 6).
 * El costo de esa garantia es que las hojas de respaldo se ACUMULAN: no se borran solas. Franco:
 * "Las 50 hojas de respaldo acumuladas eliminalas. Generan ruido". El bloque de navegacion, el
 * selector de hojas, cualquier vista que liste pestanias -- todo eso se vuelve mas dificil de
 * leer con 50 hojas ocultas de mas mezcladas entre las utiles.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Es el mismo principio que ya rige la purga de la migracion v0.11 (purgarRespaldosV011,
 * MIGRACION_v0.11_SwapHojasFix.js): un respaldo cumple su funcion mientras existe una CHANCE
 * real de necesitarlo. Pasado ese punto, es puro ruido que ademas invita al error humano --
 * cuantas mas hojas "Respaldo X <fecha>" hay, mas facil es abrir la vieja por error y confundirla
 * con la vigente. Este modulo generaliza esa idea a TODOS los prefijos de respaldo conocidos del
 * repo, no solo a los del swap v0.11.
 *
 * ============================================================================
 * POR QUE NO HAY revertirPurgaRespaldos() -- Y NO ES UN OLVIDO
 * ============================================================================
 * Todo otro modulo de este repo que escribe sigue el patron estado/aplicar/revertir porque
 * "revertir" tiene sentido: existe un respaldo (una copia) al que volver. Ese respaldo, en si
 * mismo, es una HOJA. Sheets no tiene papelera de reciclaje propia para esto -- DriveApp.getTrash()
 * no aplica a una hoja dentro de un spreadsheet, solo a archivos enteros -- asi que borrar una
 * hoja de este spreadsheet es DEFINITIVO en el momento en que se confirma. No hay una copia de la
 * copia. Escribir un `revertirPurgaRespaldos()` que promete "deshacer" algo que estructuralmente
 * no se puede deshacer seria peor que no tenerlo: un boton de mentira invita a confiar en el,
 * exactamente cuando mas importa que no se confien. Por eso este modulo tiene SOLO dos publicas
 * (estado, aplicar) en vez de las tres habituales, y la cabecera lo dice en letras grandes en vez
 * de dejar que alguien lo infiera.
 *
 * ============================================================================
 * QUE PATRONES SE BORRAN, Y COMO SE LLEGO A ELLOS (derivados, no inventados)
 * ============================================================================
 * Se barrio TODO src/ buscando cada `insertSheet(` que crea una hoja de respaldo. Aparecieron
 * OCHO prefijos distintos, no tres. Los TRES que Franco nombro son los unicos que hoy siguen
 * VIVOS -- sus modulos estan en el menu y pueden crear una hoja nueva en cualquier corrida futura
 * (ver 00_Config.js, MENU_CONFIG):
 *
 *   1. FORM_PREFIJO_RESPALDO ('Respaldo formulerio ', DEVTOOL_FormulerioV0111.js) -- compartido
 *      via _respaldarFormulerio() por OCHO modulos mas: DEVTOOL_BloqueCategorias.js,
 *      DEVTOOL_Capitalizacion.js, DEVTOOL_InicioPresupuesto.js, DEVTOOL_RiquezaYCategorias.js,
 *      DEVTOOL_Proyeccion.js, DEVTOOL_TipoDeMedios.js, DEVTOOL_TableroFaltanteProyectado.js y
 *      DEVTOOL_StockYFlujo.js. Es, por lejos, el prefijo con mas hojas acumuladas.
 *   2. ALTA_PREFIJO_RESPALDO ('Respaldo Plan de Cuentas ', DEVTOOL_AltaCuentas.js).
 *   3. V031_PREFIJO_RESPALDO ('RESP_REGISTROS_v031_', MIGRACION_v031_Historico.js).
 *
 * Los otros CINCO prefijos encontrados pertenecen a modulos que MENU_CONFIG saco del menu por
 * decision de Franco (DEVTOOL_Presupuesto.js y DEVTOOL_CableadoPresupuesto.js: "SALE DEL MENU
 * hasta su sesion dedicada"; DEVTOOL_RobustezVistas.js: "SALE DEL MENU con el swap v0.11";
 * MIGRACION_v0.9.5_LayoutNuevo.js: superada por el swap v0.11 completo) -- no pueden crear una
 * hoja nueva hoy porque no hay forma de dispararlos desde la planilla, y ninguna hoja con esos
 * nombres aparece en el gemelo digital (docs/permanente/celdas.tsv). SE DEJAN AFUERA A PROPOSITO,
 * no por descuido: `RESP_CABLEADO_` (DEVTOOL_CableadoPresupuesto.js), `RESP_PRESUPUESTO_`
 * (DEVTOOL_Presupuesto.js), `RESP_ROBUSTEZ_` (DEVTOOL_RobustezVistas.js), `RESP_TC_v095_` y
 * `RESP_FORMULAS_v095_` (MIGRACION_v0.9.5_LayoutNuevo.js). Si alguna vez aparece una hoja con
 * alguno de estos prefijos, este modulo NO la toca -- no matchea ningun patron de
 * PURGA_RESPALDOS_PATRONES() -- y queda para que Franco decida si se suma a la lista.
 *
 * Cada patron se arma con el prefijo REAL importado del modulo que lo crea (nunca retipeado a
 * mano) mas el formato de sello que ese mismo modulo usa (`yyyy-MM-dd_HHmm`, con el sufijo de
 * colision que le agrega su propio "nombre libre": ` (2)`, ` (3)`... para Formulerio/AltaCuentas
 * -- _nombreHojaLibreFormulerio --, `_2`, `_3`... para v031 -- _nombreHojaLibreV031). Verificado
 * contra el gemelo digital: las 50 hojas que aparecen ahi con estos tres prefijos matchean todas.
 *
 * `Cuarentena Plan (<fecha>)` (MIGRACION_v0.11_SwapHojasFix.js) NO es un respaldo: es contenido
 * real que el swap v0.11 encontro fuera del catalogo y movio para que Franco decida que hacer con
 * el. No matchea ningun patron de este modulo -- no hace falta excluirla a mano, la forma del
 * nombre ya es otra.
 *
 * ============================================================================
 * TRES GUARDAS, EN ORDEN DE EVALUACION
 * ============================================================================
 * 1. REGISTRADA EN PROPERTIES PARA EL REVERTIR DE OTRO MODULO -- la mas importante. Trece
 *    modulos guardan el nombre de su ultimo respaldo en PropertiesService.getDocumentProperties()
 *    (BCAT_PROP_RESPALDO, CAP_PROP_RESPALDO, IP_PROP_RESPALDO, FORM_PROP_RESPALDO,
 *    RIQ_PROP_RESPALDO, PROY_PROP_RESPALDO, TDM_PROP_RESPALDO, TFP_PROP_RESPALDO,
 *    SYF_PROP_RESPALDO, ALTA_PROP_RESPALDO, CONC_PROP_RESPALDO, LPC_PROP_RESPALDO,
 *    CATZ_PROP_RESPALDO) para que su propio "3. Revertir" sepa a que hoja volver. Borrar esa hoja
 *    rompe ese revertir EN SILENCIO -- el boton sigue ahi, pero apunta a una hoja que ya no
 *    existe. En vez de mantener una lista de las trece claves (que crece cada vez que un modulo
 *    nuevo suma su propio respaldo, y que quedaria vieja el dia que alguien lo olvide aca), este
 *    modulo lee TODOS los VALORES de Document Properties, sin filtrar por clave: cualquier hoja
 *    cuyo NOMBRE aparezca como valor de CUALQUIER propiedad del documento queda protegida. Mas
 *    caro de calcular no es (son, a lo sumo, unas pocas decenas de propiedades), y el costo de un falso
 *    positivo (conservar una hoja de mas) es cero comparado con el de un falso negativo (borrar
 *    el respaldo que alguien necesitaba).
 * 2. LOS N=3 MAS RECIENTES DE CADA PATRON SE CONSERVAN IGUAL, aunque nadie los tenga registrados.
 *    Son la red de las corridas de HOY: si algo de lo que se aplico en las ultimas horas necesita
 *    un revertir manual (por ejemplo, porque la propiedad que lo registraba se borro sin querer,
 *    o porque el respaldo es de un modulo que no llego a escribir la propiedad antes de fallar),
 *    tres versiones recientes por tipo dan margen real sin dejar de purgar el grueso del ruido
 *    (que son las decenas de corridas de PRUEBA de dias anteriores, no las de hoy). N=3 y no 1:
 *    una sola conservada no distingue "la ultima corrida buena" de "la ultima corrida, que fallo
 *    y por eso Franco esta mirando el respaldo". N=3 y no 10: en un prefijo compartido por nueve
 *    modulos (Respaldo formulerio, contando al que lo declara) diez respaldos recientes seguirian siendo ruido, no red de
 *    seguridad. La cuenta es POR PATRON, no global: cada patron es el mecanismo de revertir de un
 *    grupo de modulos distinto, y mezclar la recencia entre "Respaldo formulerio" (compartido por
 *    nueve modulos, docenas de corridas por dia) y "RESP_REGISTROS_v031" (una migracion que corre
 *    una vez cada tanto) dejaria a este ultimo sin ningun respaldo conservado la primera vez que
 *    el otro tipo generara mas de tres hojas el mismo dia.
 * 3. NINGUNA HOJA VISIBLE SE BORRA, aunque matchee un patron y no este en Properties ni entre las
 *    recientes. Los respaldos se crean SIEMPRE ocultos (`.hideSheet()`, ver _respaldarFormulerio,
 *    _respaldarCatalogo y equivalentes). Si una aparece visible es porque alguien la destapo A
 *    PROPOSITO para mirarla -- la evidencia de que todavia importa. `estado()` la reporta aparte,
 *    con el motivo, para que quede a la vista sin que haga falta ir hoja por hoja a mano.
 *
 * QUE NO HACE
 * 1. NO toca ninguna hoja que no matchee EXACTO uno de los tres patrones de arriba. Nada de
 *    heuristicas ("empieza con Respaldo", "tiene una fecha en el nombre"): el regex de cada
 *    patron sale del prefijo real mas el formato de sello real, character por character.
 * 2. NO decide "cuanto es demasiado viejo": no hay ventana de dias. La unica regla de antiguedad
 *    es la posicion en el ranking de recencia (guarda 2).
 * 3. NO opina sobre RESP_CABLEADO_/RESP_PRESUPUESTO_/RESP_ROBUSTEZ_/RESP_TC_v095_/
 *    RESP_FORMULAS_v095_: quedan fuera de PURGA_RESPALDOS_PATRONES() a proposito (ver arriba).
 *
 * @version 0.1.0
 * @since 2026-08-24
 * @see docs/permanente/FUNCIONALIDADES.md
 * @see docs/permanente/HISTORIAL_DESARROLLO.md (entrada 2026-08-24)
 */

// decision Franco 2026-08-24: 3 -- ver la justificacion completa en la cabecera, seccion
// "TRES GUARDAS", punto 2. Constante visible a proposito: nunca un "3" suelto en medio del codigo.
const PURGA_RESPALDOS_N_CONSERVAR = 3;

/** Formato del sello que usan los tres modulos: Utilities.formatDate(..., 'yyyy-MM-dd_HHmm'). */
const PURGA_RESPALDOS_SELLO_REGEX = '\\d{4}-\\d{2}-\\d{2}_\\d{4}';

function _purgaRespaldosEscapar(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Los tres patrones conocidos, derivados de las constantes REALES de los modulos que crean cada
 * respaldo (nunca retipeadas a mano). Cada uno declara su propio sufijo de colision porque cada
 * modulo usa su propio "nombre libre": _nombreHojaLibreFormulerio agrega ' (2)', ' (3)'...
 * (Formulerio y AltaCuentas comparten esa funcion); _nombreHojaLibreV031 agrega '_2', '_3'...
 */
function _purgaRespaldosPatrones() {
    return [
        {
            etiqueta: 'Respaldo formulerio',
            duenio: 'DEVTOOL_FormulerioV0111.js (_respaldarFormulerio, compartida por 8 modulos mas -- ver cabecera)',
            regex: new RegExp('^' + _purgaRespaldosEscapar(FORM_PREFIJO_RESPALDO) +
                '(' + PURGA_RESPALDOS_SELLO_REGEX + ')(?: \\(\\d+\\))?$')
        },
        {
            etiqueta: 'Respaldo Plan de Cuentas',
            duenio: 'DEVTOOL_AltaCuentas.js (ALTA_PREFIJO_RESPALDO)',
            regex: new RegExp('^' + _purgaRespaldosEscapar(ALTA_PREFIJO_RESPALDO) +
                '(' + PURGA_RESPALDOS_SELLO_REGEX + ')(?: \\(\\d+\\))?$')
        },
        {
            etiqueta: 'RESP_REGISTROS_v031',
            duenio: 'MIGRACION_v031_Historico.js (V031_PREFIJO_RESPALDO)',
            regex: new RegExp('^' + _purgaRespaldosEscapar(V031_PREFIJO_RESPALDO) +
                '(' + PURGA_RESPALDOS_SELLO_REGEX + ')(?:_\\d+)?$')
        }
    ];
}

/**
 * Mapa nombre-de-hoja -> lista de claves de Document Properties que lo tienen como VALOR.
 * Guarda 1: no importa la clave (hay trece hoy, y puede sumarse una catorceava manana sin que
 * nadie se acuerde de tocar este modulo); importa que el nombre este registrado en ALGUN lado.
 */
function _purgaRespaldosValoresProtegidos() {
    const props = PropertiesService.getDocumentProperties().getProperties();
    const mapa = {};
    Object.keys(props).forEach(function (clave) {
        const valor = String(props[clave] || '').trim();
        if (!valor) return;
        if (!mapa[valor]) mapa[valor] = [];
        mapa[valor].push(clave);
    });
    return mapa;
}

/**
 * El nucleo de solo lectura: clasifica CADA hoja de la planilla. Nunca escribe ni borra nada.
 * estado() y aplicar() comparten esta funcion para no poder mostrar una lista y borrar otra.
 *
 * `nConservar` es un parametro opcional -- SOLO para que devtools/probar_purga_respaldos.js
 * pueda probar por mutacion la guarda de recencia (ver seccion 5 del banco) sin reasignar la
 * constante real (PURGA_RESPALDOS_N_CONSERVAR es `const` a proposito: "N sea una constante
 * visible, no un numero suelto"). En produccion nunca se pasa: los dos llamadores reales
 * (estado/aplicar) usan siempre el default.
 *
 * @returns {{totalHojas:number, matcheadas:Array, aBorrar:Array, aConservar:Array}}
 */
function _purgaRespaldosEvaluar(ss, nConservar) {
    if (typeof nConservar !== 'number') nConservar = PURGA_RESPALDOS_N_CONSERVAR;
    const hojas = ss.getSheets();
    const protegidasPorProp = _purgaRespaldosValoresProtegidos();
    const patrones = _purgaRespaldosPatrones();

    const matcheadas = [];
    hojas.forEach(function (hoja) {
        const nombre = hoja.getName();
        let patron = null, sello = null;
        for (let i = 0; i < patrones.length; i++) {
            const m = nombre.match(patrones[i].regex);
            if (m) { patron = patrones[i]; sello = m[1]; break; }
        }
        if (!patron) return;   // no matchea NINGUN patron conocido: no se toca, ni se lista

        const item = { hoja: hoja, nombre: nombre, patron: patron, sello: sello };
        if (protegidasPorProp[nombre]) {
            item.conservar = true;
            item.categoria = 'propiedad';
            item.motivo = 'registrada en Document Properties (' + protegidasPorProp[nombre].join(', ') +
                ') como respaldo para revertir otro modulo';
        } else if (hoja.isSheetHidden() === false) {
            item.conservar = true;
            item.categoria = 'visible';
            item.motivo = 'esta VISIBLE -- alguien la destapo a proposito, se reporta y no se toca';
        }
        matcheadas.push(item);
    });

    // Guarda 2: entre las que NO quedaron protegidas por guarda 1, las N mas recientes de CADA
    // patron se conservan igual. El ranking es por sello (string, formato fijo yyyy-MM-dd_HHmm:
    // el orden lexicografico YA es el orden cronologico, sin parsear fecha).
    const porPatron = {};
    matcheadas.forEach(function (it) {
        if (it.conservar) return;
        const k = it.patron.etiqueta;
        if (!porPatron[k]) porPatron[k] = [];
        porPatron[k].push(it);
    });
    Object.keys(porPatron).forEach(function (k) {
        const lista = porPatron[k].slice().sort(function (a, b) { return b.sello.localeCompare(a.sello); });
        lista.forEach(function (it, i) {
            if (i < nConservar) {
                it.conservar = true;
                it.categoria = 'reciente';
                it.motivo = 'entre las ' + nConservar + ' mas recientes de "' + k + '"';
            } else {
                it.conservar = false;
                it.categoria = 'borrar';
            }
        });
    });

    const aBorrar = matcheadas.filter(function (it) { return !it.conservar; });
    const aConservar = matcheadas.filter(function (it) { return it.conservar; });

    return { totalHojas: hojas.length, matcheadas: matcheadas, aBorrar: aBorrar, aConservar: aConservar };
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura. Lista exactamente que se borraria y que se conserva, y por que. */
function estadoPurgaRespaldos() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const ev = _purgaRespaldosEvaluar(ss);

        const l = ['PURGAR RESPALDOS - ESTADO (no se borro nada)', ''];
        l.push('Hojas totales en la planilla HOY: ' + ev.totalHojas);
        l.push('Hojas de respaldo (matchean alguno de los 3 patrones conocidos): ' + ev.matcheadas.length);
        l.push('Hojas totales DESPUES de aplicar: ' + (ev.totalHojas - ev.aBorrar.length));
        l.push('');
        l.push('A BORRAR: ' + ev.aBorrar.length);
        l.push('A CONSERVAR: ' + ev.aConservar.length + ' (de las que matchean un patron)');
        l.push('');

        if (ev.aBorrar.length) {
            l.push('SE BORRARIAN (' + ev.aBorrar.length + '):');
            ev.aBorrar.forEach(function (it) {
                l.push('  - ' + it.nombre + '  [' + it.patron.etiqueta + ', sello ' + it.sello + ']');
            });
        } else {
            l.push('No hay ninguna hoja para borrar ahora mismo.');
        }
        l.push('');

        if (ev.aConservar.length) {
            l.push('SE CONSERVAN (' + ev.aConservar.length + '), con el motivo de cada una:');
            ev.aConservar.forEach(function (it) {
                l.push('  - ' + it.nombre + '  [' + it.patron.etiqueta + ']');
                l.push('      motivo: ' + it.motivo);
            });
        }

        const t = l.join('\n');
        _mostrarPurgaRespaldos('Purgar respaldos - estado', t);
        logInfo('estadoPurgaRespaldos: ' + ev.aBorrar.length + ' a borrar, ' + ev.aConservar.length +
            ' a conservar, de ' + ev.totalHojas + ' hojas totales.');
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPurgaRespaldos('Purgar respaldos - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Borra. Dialogo de confirmacion con el numero EXACTO de hojas y la advertencia de que la
 * accion no se puede deshacer. Sin respaldo previo (seria un respaldo... del respaldo) y sin
 * revertir (ver cabecera). Corre estadoPurgaRespaldos() primero, siempre.
 */
function aplicarPurgaRespaldos() {
    let ui = null;
    try {
        ui = SpreadsheetApp.getUi();
    } catch (e) {
        return { ok: false, error: 'aplicarPurgaRespaldos necesita UI (correr desde el menu tidetrack Dev).' };
    }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const ev = _purgaRespaldosEvaluar(ss);

        if (!ev.aBorrar.length) {
            const t = 'No hay ninguna hoja de respaldo para borrar ahora mismo (' + ev.totalHojas +
                ' hojas totales, ' + ev.aConservar.length + ' de respaldo, todas protegidas). No se borro nada.';
            _mostrarPurgaRespaldos('Purgar respaldos', t);
            return { ok: true, detalle: t };
        }

        const TOPE_PREVIEW = 8;
        const preview = ev.aBorrar.slice(0, TOPE_PREVIEW).map(function (it) { return '  - ' + it.nombre; }).join('\n');
        const resto = ev.aBorrar.length - TOPE_PREVIEW;

        const confirmacion = ui.alert(
            'Purgar respaldos -- ACCION IRREVERSIBLE',
            'Se van a borrar EXACTAMENTE ' + ev.aBorrar.length + ' hoja(s) de respaldo, de ' +
            ev.totalHojas + ' hojas totales que tiene la planilla hoy.\n\n' +
            'ESTA ACCION NO SE PUEDE DESHACER: una hoja borrada no vuelve. No hay un "revertir" ' +
            'para esto, ni en este modulo ni en ningun otro.\n\n' +
            'Se conservan ' + ev.aConservar.length + ' hoja(s) de respaldo: las ' +
            PURGA_RESPALDOS_N_CONSERVAR + ' mas recientes de cada tipo, las que otro modulo tiene ' +
            'registradas para su propio revertir, y cualquiera que este visible.\n\n' +
            'Primeras ' + Math.min(TOPE_PREVIEW, ev.aBorrar.length) + ' de las ' + ev.aBorrar.length +
            ' a borrar:\n' + preview + (resto > 0 ? '\n  ... y ' + resto + ' mas' : '') + '\n\n' +
            'Corriste antes "1. Ver estado" y revisaste la lista completa?\n\nContinuar?',
            ui.ButtonSet.YES_NO
        );
        if (confirmacion !== ui.Button.YES) {
            return { ok: false, error: 'Cancelado por el operador. No se borro nada.' };
        }

        const totalAntes = ev.totalHojas;
        const borradas = [];
        const fallidas = [];
        ev.aBorrar.forEach(function (it) {
            try {
                ss.deleteSheet(it.hoja);
                borradas.push(it.nombre);
            } catch (e) {
                fallidas.push(it.nombre + ': ' + e.message);
            }
        });
        invalidarCacheNombresHojas();
        const totalDespues = ss.getSheets().length;

        const l = ['PURGA APLICADA', ''];
        l.push('Hojas borradas: ' + borradas.length + ' de ' + ev.aBorrar.length + ' candidatas.');
        l.push('Hojas totales: ' + totalAntes + ' -> ' + totalDespues + '.');
        if (fallidas.length) {
            l.push('');
            l.push('NO SE PUDIERON BORRAR (' + fallidas.length + '), revisar a mano:');
            fallidas.forEach(function (f) { l.push('  - ' + f); });
        }
        const detalle = l.join('\n');
        logSuccess('aplicarPurgaRespaldos: ' + borradas.length + ' hoja(s) borradas de ' + ev.aBorrar.length +
            ' candidatas; quedan ' + totalDespues + ' hojas totales (' + fallidas.length + ' fallida(s)).');
        _mostrarPurgaRespaldos('Purgar respaldos - listo', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO SE COMPLETO LA PURGA. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPurgaRespaldos('Purgar respaldos - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarPurgaRespaldos(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
