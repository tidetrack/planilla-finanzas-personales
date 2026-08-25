/**
 * DEVTOOL_ProyeccionAbm.js
 * Capa de datos del ABM de "proyecciones elaboradas": ver, corregir y borrar lo que ya esta
 * guardado en la hoja-BD "Proyeccion", desde un modal del menu Tidetrack (no desde tidetrack Dev).
 *
 * [CONCEPTO DE NEGOCIO]
 * Franco, textual (encargo relayado por appscript-ui, coordinando la feature completa UI+backend):
 * "en el menu deberiamos poder hacer el ABM de proyecciones elaboradas". "Proyeccion" ya recibe
 * datos por DOS caminos: el promedio historico automatico (DEVTOOL_PresupuestoBase.js, marca
 * PB_MARCA) y el guardado manual deliberado desde la hoja "Presupuesto"
 * (DEVTOOL_PresupuestoGuardar.js, marca PG_MARCA). Ninguno de los dos ofrece hoy una forma de
 * REVISAR lo que quedo escrito sin abrir la hoja "Proyeccion" a mano y leer filas crudas. Este
 * modulo es la capa de datos que hace eso posible desde un modal: listar por periodo, ver el
 * detalle de un periodo, corregir un monto puntual y borrar un periodo completo.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: preflight por ROTULO (reusa `_preflightPb`, que ya verifica que
 * "Proyeccion" siga siendo un espejo exacto de "Registros"), respaldo verificado antes de mutar,
 * verificacion del VALOR resultante, reversion completa. Regla Estricta 1: nombres de hoja y
 * columnas SIEMPRE via SHEETS/RANGES, nunca hardcodeados.
 *
 * ============================================================================
 * TRES DECISIONES YA TOMADAS (appscript-ui, coordinando el encargo) -- NO SE REABREN AQUI
 * ============================================================================
 *
 * DECISION 1 -- ALTA: NO EXISTE EN ESTE ABM.
 * El alta ya existe: se elabora en la hoja "Presupuesto" (tres etapas, DEVTOOL_PresupuestoModo.js
 * / DEVTOOL_PresupuestoResumen.js / DEVTOOL_PresupuestoGuardar.js) y se guarda con
 * `aplicarGuardarProyeccion()` (hoy en el menu tidetrack Dev; Franco: "luego va a tener su
 * boton"). Reconstruir esa logica en un modal -- leer K/O/S, congelar cotizaciones via las custom
 * functions, verificar el invariante contra W8 -- duplicaria superficie peligrosa de escritura
 * sobre una BD de produccion, con dos caminos que podrian divergir con el tiempo. Este ABM asume
 * que las filas YA estan escritas por ese camino y trabaja sobre eso: ver, corregir, borrar.
 *
 * DECISION 2 -- MODIFICACION: SOLO MONTO, SOLO EN FILAS "GUARDADO A MANO" (marca PG_MARCA).
 * Nunca en filas PB_MARCA (presupuesto base historico, promedio automatico): editarlas a mano las
 * dejaria con la marca "presupuesto base historico" en la Nota pero un valor que ya no es ese
 * promedio -- una mentira en la hoja, indistinguible de un dato genuino hasta que alguien audite
 * a mano. Si Franco quiere reemplazar un mes de base por una decision deliberada, el mecanismo ya
 * existe: guardar ese mes desde "Presupuesto", que retira las filas base de ese mes por diseno
 * (decision 4 de DEVTOOL_PresupuestoGuardar.js, "la proyeccion manual gana"). Por eso
 * `actualizarMontoFilaProyeccion` verifica la marca de la fila ANTES de escribir, del lado del
 * servidor -- no confia en que el cliente ya haya filtrado por `editable`.
 *
 * DECISION 3 -- BAJA: POR PERIODO COMPLETO (clave+origen), CON RESPALDO Y REVERSION.
 * Misma disciplina que `aplicarGuardarProyeccion`/`revertirGuardarProyeccion`. Aplica a los DOS
 * origenes: hoy no existe forma de borrar SOLO un mes del presupuesto base
 * (`quitarPresupuestoBase()`, DEVTOOL_PresupuestoBase.js, borra TODOS los meses de una corrida),
 * asi que este ABM llena ese hueco real. Nunca se borra una fila individual: la unidad minima es
 * "todas las filas de una clave de periodo, para un origen".
 *
 * ============================================================================
 * QUE ES UN "PERIODO" Y COMO SE AGRUPA (dos tecnicas distintas, una por origen)
 * ============================================================================
 * "Proyeccion" NO tiene una columna de periodo: la clave de periodo se DERIVA distinto segun el
 * origen de la fila, con la MISMA tecnica que ya usan `_filasPorNotaPrefijoPg`/`_filasBasePorMesPg`
 * (DEVTOOL_PresupuestoGuardar.js), reusadas verbatim aca:
 *   - GUARDADO (PG_MARCA): la clave vive LITERAL en la Nota -- "<PG_MARCA> <clave> <sello>". Se
 *     extrae con `indexOf(PG_MARCA+' ')===0` y tomando el primer token despues del prefijo (el
 *     sello, que sigue, tambien tiene guiones y numeros: cortar con una regex ambigua se comeria
 *     parte del sello o de la clave. Se corta por el PROXIMO espacio, no por forma).
 *   - BASE (PB_MARCA): la clave NO esta en la Nota (la Nota es solo "<PB_MARCA> <sello>") -- se
 *     deriva de la columna Fecha, mismo mes/anio, con `_claveMesPg` (reusada verbatim).
 * Una fila SIN ninguna de las dos marcas no entra en ningun grupo: es lo cargado a mano en el
 * ledger real, o ruido. Nunca se toca, nunca se cuenta -- fuera del alcance de este ABM.
 *
 * ============================================================================
 * TOTALES POR BLOQUE Y MONEDA (nunca sumar monedas distintas entre si, ADR-003)
 * ============================================================================
 * Cada fila se ubica en un bloque (ingresos/fijos/variables) segun su columna `tipo_cuenta`
 * (`PA_CATEGORIA_A_CLAVE`). Una fila cuyo `tipo_cuenta` no es ninguna de las tres claves NUNCA se
 * descarta en silencio: se cuenta en `otrasFilas` y se reporta. Los totales se acumulan POR
 * MONEDA dentro de cada bloque -- jamas se convierte ni se suma ARS con USD, la misma disciplina
 * que ya aplica `_ajustarSinDesahorroPb` (DEVTOOL_PresupuestoBase.js) al recortar el presupuesto
 * base, y que aplica `aplicarGuardarProyeccion` al verificar su invariante bloque por bloque. El
 * `neto` (ingresos-fijos-variables) se calcula POR MONEDA sobre la UNION de monedas que aparecen
 * en cualquiera de los tres bloques del grupo: una moneda sin movimiento en un bloque cuenta como
 * 0 en ESE bloque para el neto, nunca se omite de el.
 *
 * QUE NO HACE
 * 1. NO escribe nunca en filas PB_MARCA: ni un monto, ni nada. Son de solo lectura para este ABM.
 * 2. NO reconstruye el guardado (decision 1): no lee K/O/S de "Presupuesto", no llama a las custom
 *    functions de cotizacion, no escribe una fila nueva.
 * 3. NO toca "Registros", el Plan de Cuentas, "Tipos de Cambio" ni la hoja "Presupuesto".
 * 4. NO usa `SpreadsheetApp.getUi()`: este modulo se llama desde `google.script.run` (un modal
 *    HtmlService, cableado por appscript-ui en 11_UIService.js), no desde el menu -- exito
 *    devuelve un objeto plano, fallo lanza `Error` (convencion de `UI_AbmPlanCuentas.html` /
 *    `saveAbmRecord`/`updateAbmRecord`/`deleteAbmRecord` en 11_UIService.js, NO el patron
 *    `{ok:false,error}` de los modulos DEVTOOL_Presupuesto*, que es para `ui.alert()` de menu).
 *
 * Reusa de DEVTOOL_PresupuestoGuardar.js: PG_MARCA, _claveMesPg, _mismoMesPg,
 * _filasPorNotaPrefijoPg, _filasBasePorMesPg, _leerRespaldoFilasPg, _escribirAlPieProyeccionPg.
 * Reusa de DEVTOOL_PresupuestoBase.js: PB_MARCA, _preflightPb, _borrarGeneradasPb.
 * Reusa de DEVTOOL_InicioPresupuesto.js: IP_MESES.
 * Reusa de DEVTOOL_FormulerioV0111.js: _nombreHojaLibreFormulerio.
 * Reusa de 00_Config.js/03_SheetManager.js: SHEETS, RANGES, MONEDAS_DISPONIBLES,
 * columnLetterToIndex, invalidarCacheNombresHojas.
 *
 * NO reusa `_respaldarFilasPg` (DEVTOOL_PresupuestoGuardar.js) tal cual: esa funcion hardcodea
 * `PG_PREFIJO_RESPALDO` en el nombre de la hoja de respaldo, y este modulo necesita el suyo
 * propio (`PA_PREFIJO_RESPALDO`) para no confundir, en la lista de hojas ocultas, un respaldo de
 * "Guardar Proyeccion" con uno de este ABM. `_respaldarFilasPa` es una copia deliberada del MISMO
 * algoritmo (escribir, `flush`, releer, verificar fila por fila, ocultar) con esa unica variable
 * cambiada -- no una reinvencion.
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @see DEVTOOL_PresupuestoGuardar.js
 * @see DEVTOOL_PresupuestoBase.js
 * @version 0.52.0
 * @since 2026-08-25
 * @lastModified 2026-08-25
 */

// ============================================
// CONSTANTES PROPIAS (namespace PA_, no colisiona con PG_/PB_ de los modulos hermanos)
// ============================================

const PA_PROP_PREVIOS_BAJA = 'proyeccion_abm_baja_previos';
const PA_PROP_PREVIOS_EDICION = 'proyeccion_abm_edicion_previos';
const PA_PREFIJO_RESPALDO = 'Respaldo proyeccion abm ';

// Literal propio: no lee ningun simbolo de otro archivo, es seguro como const de nivel superior.
const PA_CATEGORIA_A_CLAVE = { 'Ingreso': 'ingresos', 'Gasto Fijo': 'fijos', 'Gasto Variable': 'variables' };

// decision Franco 2026-08-25: PG_MARCA, PB_MARCA, IP_MESES, RANGES, SHEETS, MONEDAS_DISPONIBLES y
// cualquier funcion de otro archivo (DEVTOOL_PresupuestoGuardar.js, DEVTOOL_PresupuestoBase.js,
// DEVTOOL_InicioPresupuesto.js, 00_Config.js, 03_SheetManager.js) se leen SOLO dentro de cuerpos
// de funcion en este archivo, nunca en un const/let de nivel superior. Apps Script evalua los
// archivos del proyecto en orden alfabetico (sin filePushOrder en .clasp.json): un const de
// nivel superior que lea un simbolo de un archivo que carga DESPUES revienta con ReferenceError
// al EVALUAR el proyecto entero -- no solo este modulo, TODAS las custom functions de la
// planilla quedan en #ERROR!. Paso en produccion el 2026-08-25 con
// DEVTOOL_PresupuestoGuardar.js/PM_UMBRAL_IDENTIDAD (ver su cabecera, decision de "_umbralIdentidadPg").
// En este caso puntual los simbolos que se reusan SI cargan antes por orden alfabetico
// ("PresupuestoBase"/"PresupuestoGuardar"/"InicioPresupuesto" < "ProyeccionAbm"), pero la regla
// se respeta igual: un archivo que se renombre manana no deberia poder romper la carga del
// proyecto por una diferencia de una letra.

// ============================================
// CLAVE DE PERIODO Y ROTULO DE MES
// ============================================

/**
 * Convierte una clave 'YYYY-MM' al primer dia de ese mes, o null si el formato no es exacto o el
 * mes no es plausible (01-12). Es la validacion de entrada de `detalleFilasPeriodoProyeccion`,
 * `eliminarPeriodoProyeccion` y el parseo interno de grupos "base".
 */
function _fechaDesdeClavePa(clave) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(clave || ''));
    if (!m) return null;
    const anio = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    if (mes < 1 || mes > 12) return null;
    return new Date(anio, mes - 1, 1);
}

/** 'Septiembre 2026', reusando IP_MESES (DEVTOOL_InicioPresupuesto.js) igual que estadoGuardarProyeccion. */
function _mesLabelPa(anio, mesIndex) {
    return IP_MESES.split(',')[mesIndex] + ' ' + anio;
}

/**
 * Extrae { clave, sello } de una Nota "<PG_MARCA> <clave> <sello>", o null si la Nota no empieza
 * con el prefijo o la clave no tiene forma 'YYYY-MM'. La clave es el PRIMER token despues del
 * prefijo; el sello es todo lo que sigue despues de ESE espacio -- nunca se corta por una regex
 * sobre la Nota entera, porque el sello tambien tiene guiones y numeros (ver cabecera).
 */
function _partesNotaGuardadoPa(nota) {
    const prefijo = PG_MARCA + ' ';
    const texto = String(nota || '');
    if (texto.indexOf(prefijo) !== 0) return null;
    const resto = texto.slice(prefijo.length);
    const espacio = resto.indexOf(' ');
    if (espacio === -1) return null;
    const clave = resto.slice(0, espacio);
    const sello = resto.slice(espacio + 1);
    if (!/^\d{4}-\d{2}$/.test(clave)) return null;
    return { clave: clave, sello: sello };
}

// ============================================
// LECTURA CRUDA DE "PROYECCION"
// ============================================

/** Lee TODA la banda de datos de "Proyeccion" (B:M) de una sola vez, con el numero de fila real. */
function _leerTodasFilasPa(hoja) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return [];

    const pos = {};
    Object.keys(cfg.columns).forEach(function (k) { pos[k] = columnLetterToIndex(cfg.columns[k]) - colIni; });

    const valores = hoja.getRange(cfg.dataRow, colIni, ultima - cfg.dataRow + 1, ancho).getValues();
    return valores.map(function (v, i) {
        return {
            fila: cfg.dataRow + i,
            monto: Number(v[pos.monto]),
            tipo: String(v[pos.tipo] || ''),
            cuenta: String(v[pos.cuenta] || ''),
            tipoCuenta: String(v[pos.tipo_cuenta] || ''),
            medio: String(v[pos.medio] || ''),
            moneda: String(v[pos.moneda] || '') || 'ARS',
            fecha: v[pos.fecha],
            nota: String(v[pos.nota] || ''),
            tcArs: v[pos.tc_ars], tcUsd: v[pos.tc_usd], tcAud: v[pos.tc_aud], tcEur: v[pos.tc_eur]
        };
    });
}

/** Numeros de fila de "Proyeccion" que pertenecen a `clave`+`origen`. Reusa los buscadores de PresupuestoGuardar.js. */
function _filasDelPeriodoPa(hoja, clave, origen) {
    if (origen === 'guardado') {
        return _filasPorNotaPrefijoPg(hoja, PG_MARCA + ' ' + clave + ' ');
    }
    const periodo = _fechaDesdeClavePa(clave);
    return _filasBasePorMesPg(hoja, periodo);
}

// ============================================
// TOTALES POR BLOQUE Y MONEDA (nunca sumar monedas distintas, ver cabecera)
// ============================================

/** Ordena una lista de monedas segun MONEDAS_DISPONIBLES, para que la salida sea determinista. */
function _ordenMonedasPa(monedas) {
    const orden = MONEDAS_DISPONIBLES;
    return monedas.slice().sort(function (a, b) { return orden.indexOf(a) - orden.indexOf(b); });
}

/** Las monedas que aparecen en un conjunto de filas crudas, en el orden de MONEDAS_DISPONIBLES. */
function _monedasEnFilasPa(filasCrudas) {
    const vistas = {};
    filasCrudas.forEach(function (f) { if (f.moneda) vistas[f.moneda] = true; });
    return _ordenMonedasPa(Object.keys(vistas));
}

/**
 * { ingresos: [{moneda,monto}], fijos: [...], variables: [...], neto: [...], otrasFilas: N }.
 * Ver cabecera: nunca suma monedas distintas entre si; el neto cubre la UNION de monedas de los
 * tres bloques, con 0 por defecto en el bloque donde una moneda no tuvo movimiento.
 */
function _totalesPorBloquePa(filasCrudas) {
    const acumIngresos = {}, acumFijos = {}, acumVariables = {};
    const acumPorBloque = { ingresos: acumIngresos, fijos: acumFijos, variables: acumVariables };
    let otrasFilas = 0;

    filasCrudas.forEach(function (f) {
        const bloque = PA_CATEGORIA_A_CLAVE[f.tipoCuenta];
        if (!bloque) { otrasFilas++; return; }
        const moneda = f.moneda || 'ARS';
        const monto = isFinite(f.monto) ? f.monto : 0;
        acumPorBloque[bloque][moneda] = (acumPorBloque[bloque][moneda] || 0) + monto;
    });

    const arrayDe = function (acum) {
        return _ordenMonedasPa(Object.keys(acum)).map(function (m) { return { moneda: m, monto: acum[m] }; });
    };

    const monedasUnion = {};
    [acumIngresos, acumFijos, acumVariables].forEach(function (acum) {
        Object.keys(acum).forEach(function (m) { monedasUnion[m] = true; });
    });
    const neto = _ordenMonedasPa(Object.keys(monedasUnion)).map(function (m) {
        return { moneda: m, monto: (acumIngresos[m] || 0) - (acumFijos[m] || 0) - (acumVariables[m] || 0) };
    });

    return { ingresos: arrayDe(acumIngresos), fijos: arrayDe(acumFijos), variables: arrayDe(acumVariables),
              neto: neto, otrasFilas: otrasFilas };
}

// ============================================
// SELLO Y RESPALDO (copia deliberada de _respaldarFilasPg con PA_PREFIJO_RESPALDO, ver cabecera)
// ============================================

// Resolucion de segundos, mismo criterio y misma razon que _selloPg (DEVTOOL_PresupuestoGuardar.js):
// es la unica pieza que distingue dos operaciones de este ABM que caigan en el mismo minuto.
function _selloPa() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
}

/**
 * Congela el contenido (B:M, valores crudos) de `filas` de "Proyeccion" en una hoja nueva,
 * oculta, y la RELEE para verificar. Copia deliberada de `_respaldarFilasPg`
 * (DEVTOOL_PresupuestoGuardar.js) con `PA_PREFIJO_RESPALDO` en vez de `PG_PREFIJO_RESPALDO`: esa
 * funcion hardcodea su propio prefijo, asi que no se puede parametrizar sin tocar ese archivo.
 */
function _respaldarFilasPa(ss, hojaProy, filas, sello) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const nombre = _nombreHojaLibreFormulerio(ss, PA_PREFIJO_RESPALDO + sello);

    const destino = ss.insertSheet(nombre);
    invalidarCacheNombresHojas();
    destino.getRange(1, 1, 1, 2).setValues([['fila_original', 'valores_json']]);

    if (filas.length) {
        const filasVivas = hojaProy.getRange(1, colIni, hojaProy.getLastRow(), ancho).getValues();
        const matrizRespaldo = filas.map(function (fila) {
            const vals = filasVivas[fila - 1];
            const serial = vals.map(function (v) { return v instanceof Date ? { __fecha__: v.toISOString() } : v; });
            return [fila, JSON.stringify(serial)];
        });
        destino.getRange(2, 1, matrizRespaldo.length, 2).setValues(matrizRespaldo);
    }
    SpreadsheetApp.flush();

    const leidas = filas.length ? destino.getRange(2, 1, filas.length, 2).getValues() : [];
    if (leidas.length !== filas.length) {
        throw new Error('El respaldo de filas quedo en "' + nombre + '" pero NO VERIFICA: ' +
            'se esperaban ' + filas.length + ' fila(s) y se releyeron ' + leidas.length +
            '. No se toco "' + hojaProy.getName() + '".');
    }
    for (let i = 0; i < leidas.length; i++) {
        if (Number(leidas[i][0]) !== filas[i]) {
            throw new Error('El respaldo en "' + nombre + '" no coincide fila por fila con lo esperado. ' +
                'No se toco "' + hojaProy.getName() + '".');
        }
    }

    destino.hideSheet();
    logInfo('_respaldarFilasPa: ' + filas.length + ' fila(s) de "' + hojaProy.getName() + '" respaldadas en "' + nombre + '".');
    return { nombre: nombre, filas: filas.length };
}

// ============================================
// PUBLICAS -- consumidas via google.script.run desde 11_UIService.js (appscript-ui)
// ============================================

/**
 * Agrupa TODAS las filas de "Proyeccion" en dos poblaciones (guardado/base). Solo lectura.
 * Una hoja "Proyeccion" que no existe o dejo de espejar a "Registros" hace TIRAR esta funcion
 * (via `_preflightPb`, con un mensaje que ya nombra el desvio exacto).
 */
function listarPeriodosProyeccion() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pre = _preflightPb(ss);
    const todas = _leerTodasFilasPa(pre.hoja);

    const gruposGuardadoMap = {};
    const gruposBaseMap = {};

    todas.forEach(function (f) {
        const partesG = _partesNotaGuardadoPa(f.nota);
        if (partesG) {
            if (!gruposGuardadoMap[partesG.clave]) {
                gruposGuardadoMap[partesG.clave] = { filas: [], sello: partesG.sello, crudasFilas: [] };
            }
            gruposGuardadoMap[partesG.clave].filas.push(f.fila);
            gruposGuardadoMap[partesG.clave].crudasFilas.push(f);
            return;
        }
        if (String(f.nota).indexOf(PB_MARCA) === 0) {
            if (!(f.fecha instanceof Date) || isNaN(f.fecha.getTime())) return;   // sin fecha valida: no se puede agrupar, no se inventa un mes
            const clave = _claveMesPg(f.fecha);
            const sello = String(f.nota).slice(PB_MARCA.length).trim();
            if (!gruposBaseMap[clave]) gruposBaseMap[clave] = { filas: [], sellos: {}, crudasFilas: [] };
            gruposBaseMap[clave].filas.push(f.fila);
            if (sello) gruposBaseMap[clave].sellos[sello] = true;
            gruposBaseMap[clave].crudasFilas.push(f);
            return;
        }
        // Sin ninguna marca: cargado a mano en el ledger real, o ruido. Fuera del alcance de este
        // ABM -- nunca se toca, nunca se cuenta (ver cabecera).
    });

    const armarGrupo = function (clave, datos, origen) {
        const periodo = _fechaDesdeClavePa(clave);
        const totales = _totalesPorBloquePa(datos.crudasFilas);
        const grupo = {
            clave: clave,
            mesLabel: _mesLabelPa(periodo.getFullYear(), periodo.getMonth()),
            anio: periodo.getFullYear(),
            filas: datos.filas.slice().sort(function (a, b) { return a - b; }),
            monedas: _monedasEnFilasPa(datos.crudasFilas),
            totales: totales,
            otrasFilas: totales.otrasFilas
        };
        if (origen === 'guardado') grupo.sello = datos.sello;
        else grupo.sellos = Object.keys(datos.sellos);
        return grupo;
    };

    // Orden desc por clave (mas reciente primero): 'YYYY-MM' ordena lexicograficamente igual que
    // cronologicamente, asi que un sort ascendente + reverse alcanza.
    const clavesDesc = function (mapa) { return Object.keys(mapa).sort().reverse(); };

    const guardado = clavesDesc(gruposGuardadoMap).map(function (c) { return armarGrupo(c, gruposGuardadoMap[c], 'guardado'); });
    const base = clavesDesc(gruposBaseMap).map(function (c) { return armarGrupo(c, gruposBaseMap[c], 'base'); });

    return {
        grupos: { guardado: guardado, base: base },
        vacioGuardado: guardado.length === 0,
        vacioBase: base.length === 0
    };
}

/**
 * El detalle fila por fila de un periodo+origen puntual. Solo lectura. `clave`+`origen` invalidos
 * tiran; una clave+origen SIN ninguna fila (carrera con otra pestana, doble click) NO es un
 * error: devuelve `filas: []`.
 */
function detalleFilasPeriodoProyeccion(clave, origen) {
    if (origen !== 'guardado' && origen !== 'base') {
        throw new Error('origen invalido: "' + origen + '" (debe ser "guardado" o "base").');
    }
    if (!_fechaDesdeClavePa(clave)) {
        throw new Error('clave invalida: "' + clave + '" (formato esperado "YYYY-MM").');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pre = _preflightPb(ss);
    const todas = _leerTodasFilasPa(pre.hoja);

    const delGrupo = todas.filter(function (f) {
        if (origen === 'guardado') {
            const partes = _partesNotaGuardadoPa(f.nota);
            return !!partes && partes.clave === clave;
        }
        if (String(f.nota).indexOf(PB_MARCA) !== 0) return false;
        if (!(f.fecha instanceof Date) || isNaN(f.fecha.getTime())) return false;
        return _claveMesPg(f.fecha) === clave;
    }).sort(function (a, b) { return a.fila - b.fila; });

    const periodo = _fechaDesdeClavePa(clave);
    const filas = delGrupo.map(function (f) {
        return {
            fila: f.fila, cuenta: f.cuenta, tipoCuenta: f.tipoCuenta, tipo: f.tipo, monto: f.monto,
            moneda: f.moneda,
            fecha: (f.fecha instanceof Date && !isNaN(f.fecha.getTime())) ? f.fecha.toISOString() : null,
            tcArs: f.tcArs, tcUsd: f.tcUsd, tcAud: f.tcAud, tcEur: f.tcEur,
            editable: origen === 'guardado'
        };
    });

    return {
        clave: clave, origen: origen, mesLabel: _mesLabelPa(periodo.getFullYear(), periodo.getMonth()),
        filas: filas, totales: _totalesPorBloquePa(delGrupo)
    };
}

/**
 * Borra TODAS las filas de `clave`+`origen`, con respaldo previo y verificacion. Si algo no
 * verifica, intenta reponer desde el respaldo automaticamente antes de tirar. Solo la ULTIMA
 * baja aplicada es reversible (`revertirBajaProyeccionAbm`): guardar una nueva PISA el registro
 * de la anterior sin avisar -- misma limitacion que `revertirGuardarProyeccion`.
 */
function eliminarPeriodoProyeccion(clave, origen) {
    if (origen !== 'guardado' && origen !== 'base') {
        throw new Error('origen invalido: "' + origen + '" (debe ser "guardado" o "base").');
    }
    if (!_fechaDesdeClavePa(clave)) {
        throw new Error('clave invalida: "' + clave + '" (formato esperado "YYYY-MM").');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pre = _preflightPb(ss);
    const hoja = pre.hoja;

    const filas = _filasDelPeriodoPa(hoja, clave, origen);
    if (!filas.length) {
        throw new Error('No hay ninguna fila de "' + clave + '" (' + origen + ') en "' + SHEETS.PROYECCION +
            '" para borrar: probablemente ya se borro en otra pestana o es un doble click. No se hizo nada.');
    }

    const sello = _selloPa();
    let respaldo = null;
    try {
        respaldo = _respaldarFilasPa(ss, hoja, filas, sello);

        _borrarGeneradasPb(hoja, filas);
        SpreadsheetApp.flush();

        const quedan = _filasDelPeriodoPa(hoja, clave, origen);
        if (quedan.length) {
            throw new Error('Quedaron ' + quedan.length + ' fila(s) sin borrar de "' + clave + '" (' + origen + ').');
        }
    } catch (e) {
        let restaurado = '';
        if (respaldo) {
            try {
                const backup = ss.getSheetByName(respaldo.nombre);
                const matrizBackup = backup ? _leerRespaldoFilasPg(backup) : [];
                if (matrizBackup.length) {
                    const yaQuedan = _filasDelPeriodoPa(hoja, clave, origen);
                    if (yaQuedan.length) _borrarGeneradasPb(hoja, yaQuedan);
                    _escribirAlPieProyeccionPg(hoja, matrizBackup);
                    SpreadsheetApp.flush();
                }
                restaurado = ' Se revirtio: se repusieron las filas desde el respaldo "' + respaldo.nombre + '".';
            } catch (e2) {
                restaurado = ' ADEMAS fallo la reversion automatica (' + e2.message + '). El respaldo sigue en "' +
                    respaldo.nombre + '": revision manual.';
            }
        }
        throw new Error('NO SE BORRO "' + clave + '" (' + origen + '): ' + e.message + restaurado);
    }

    PropertiesService.getDocumentProperties().setProperty(PA_PROP_PREVIOS_BAJA, JSON.stringify({
        respaldo: respaldo.nombre, clave: clave, origen: origen, filas: filas.length
    }));

    logSuccess('eliminarPeriodoProyeccion: ' + filas.length + ' fila(s) de ' + clave + ' (' + origen + ') borradas.');
    return { clave: clave, origen: origen, filasBorradas: filas.length, respaldo: respaldo.nombre };
}

/** Repone la ULTIMA baja aplicada por este ABM (solo una, ver `eliminarPeriodoProyeccion`). */
function revertirBajaProyeccionAbm() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const props = PropertiesService.getDocumentProperties();
    const crudo = props.getProperty(PA_PROP_PREVIOS_BAJA);
    if (!crudo) throw new Error('No hay ninguna baja de este ABM para revertir.');
    const previos = JSON.parse(crudo);

    const pre = _preflightPb(ss);
    const hoja = pre.hoja;

    const backup = ss.getSheetByName(previos.respaldo);
    if (!backup) {
        throw new Error('La hoja de respaldo "' + previos.respaldo + '" ya no existe: no se puede revertir la ' +
            'baja de "' + previos.clave + '" (' + previos.origen + ').');
    }
    const matrizBackup = _leerRespaldoFilasPg(backup);
    if (!matrizBackup.length) {
        throw new Error('El respaldo "' + previos.respaldo + '" esta vacio: no hay nada que reponer.');
    }

    _escribirAlPieProyeccionPg(hoja, matrizBackup);
    SpreadsheetApp.flush();

    const repuestas = _filasDelPeriodoPa(hoja, previos.clave, previos.origen);
    if (repuestas.length < previos.filas) {
        throw new Error('Se intento reponer ' + matrizBackup.length + ' fila(s) pero solo se verifican ' +
            repuestas.length + ' de "' + previos.clave + '" (' + previos.origen + '). Revisar "' +
            SHEETS.PROYECCION + '" a mano; el respaldo sigue en "' + previos.respaldo + '".');
    }

    props.deleteProperty(PA_PROP_PREVIOS_BAJA);

    logSuccess('revertirBajaProyeccionAbm: ' + matrizBackup.length + ' fila(s) repuestas de ' + previos.clave + ' (' + previos.origen + ').');
    return { clave: previos.clave, origen: previos.origen, filasRepuestas: matrizBackup.length };
}

/**
 * Valida `nuevoMonto` como numero finito, o devuelve null. NO usa `isFinite(Number(v))` solo:
 * `Number('')` da 0 (finito) en JS, asi que un campo vacio pasaria como "monto cero" en vez de
 * rechazarse -- exactamente lo que el encargo pide rechazar ("vacio"). Se corta ANTES de convertir.
 */
function _montoValidoPa(v) {
    if (v === null || v === undefined) return null;
    if (String(v).trim() === '') return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
}

/**
 * Corrige el monto de UNA fila, con el gate de seguridad del lado del servidor (decision 2): solo
 * filas PG_MARCA. Rechaza filas PB_MARCA o sin marca con un mensaje explicito, y rechaza cualquier
 * `nuevoMonto` que no sea un numero finito (ver `_montoValidoPa`). Respalda la fila completa antes
 * de escribir.
 */
function actualizarMontoFilaProyeccion(fila, nuevoMonto) {
    const filaNum = parseInt(fila, 10);
    if (!isFinite(filaNum)) throw new Error('El numero de fila "' + fila + '" no es valido.');

    const montoNuevoNum = _montoValidoPa(nuevoMonto);
    if (montoNuevoNum === null) {
        throw new Error('El nuevo monto "' + nuevoMonto + '" no es un numero valido.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pre = _preflightPb(ss);
    const hoja = pre.hoja;
    const cfg = RANGES.REGISTROS;

    const ultima = hoja.getLastRow();
    if (filaNum < cfg.dataRow || filaNum > ultima) {
        throw new Error('La fila ' + filaNum + ' esta fuera del rango de datos vivo de "' + SHEETS.PROYECCION +
            '" (' + cfg.dataRow + ' a ' + ultima + ').');
    }

    const colNota = columnLetterToIndex(cfg.columns.nota);
    const nota = String(hoja.getRange(filaNum, colNota).getValue() || '');
    if (nota.indexOf(PG_MARCA + ' ') !== 0) {
        throw new Error('Esta fila no es un guardado manual: las filas de presupuesto base se recalculan ' +
            'corriendo de nuevo ese modulo, no se editan a mano.');
    }
    const partes = _partesNotaGuardadoPa(nota);

    const colMonto = columnLetterToIndex(cfg.columns.monto);
    const colCuenta = columnLetterToIndex(cfg.columns.cuenta);
    const colMoneda = columnLetterToIndex(cfg.columns.moneda);
    const montoAnterior = Number(hoja.getRange(filaNum, colMonto).getValue());
    const cuenta = String(hoja.getRange(filaNum, colCuenta).getValue() || '');
    const moneda = String(hoja.getRange(filaNum, colMoneda).getValue() || '');

    const sello = _selloPa();
    const respaldo = _respaldarFilasPa(ss, hoja, [filaNum], sello);

    try {
        hoja.getRange(filaNum, colMonto).setValue(montoNuevoNum);
        SpreadsheetApp.flush();

        const releido = Number(hoja.getRange(filaNum, colMonto).getValue());
        if (releido !== montoNuevoNum) {
            throw new Error('el monto releido (' + releido + ') no coincide con el escrito (' + montoNuevoNum + ')');
        }
    } catch (e) {
        let restaurado = '';
        try {
            hoja.getRange(filaNum, colMonto).setValue(montoAnterior);
            SpreadsheetApp.flush();
            restaurado = ' Se revirtio al valor anterior (' + montoAnterior + ').';
        } catch (e2) {
            restaurado = ' ADEMAS fallo la reversion automatica (' + e2.message + '). El respaldo sigue en "' +
                respaldo.nombre + '": revision manual.';
        }
        throw new Error('NO SE ACTUALIZO la fila ' + filaNum + ': ' + e.message + restaurado);
    }

    PropertiesService.getDocumentProperties().setProperty(PA_PROP_PREVIOS_EDICION, JSON.stringify({
        respaldo: respaldo.nombre, fila: filaNum, montoAnterior: montoAnterior, montoNuevo: montoNuevoNum
    }));

    logSuccess('actualizarMontoFilaProyeccion: fila ' + filaNum + ' de ' + montoAnterior + ' a ' + montoNuevoNum + '.');
    return { fila: filaNum, cuenta: cuenta, clave: partes ? partes.clave : null, moneda: moneda,
              montoAnterior: montoAnterior, montoNuevo: montoNuevoNum };
}

/** Repone la ULTIMA edicion de monto aplicada por este ABM, leyendo el valor original del respaldo. */
function revertirEdicionMontoProyeccion() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const props = PropertiesService.getDocumentProperties();
    const crudo = props.getProperty(PA_PROP_PREVIOS_EDICION);
    if (!crudo) throw new Error('No hay ninguna edicion de este ABM para revertir.');
    const previos = JSON.parse(crudo);

    const pre = _preflightPb(ss);
    const hoja = pre.hoja;
    const cfg = RANGES.REGISTROS;

    const ultima = hoja.getLastRow();
    if (previos.fila < cfg.dataRow || previos.fila > ultima) {
        throw new Error('La fila ' + previos.fila + ' de la edicion registrada ya no existe en "' +
            SHEETS.PROYECCION + '". No se pudo revertir.');
    }

    const backup = ss.getSheetByName(previos.respaldo);
    if (!backup) {
        throw new Error('La hoja de respaldo "' + previos.respaldo + '" ya no existe: no se puede revertir la ' +
            'edicion de la fila ' + previos.fila + '.');
    }
    const matrizBackup = _leerRespaldoFilasPg(backup);
    if (!matrizBackup.length) {
        throw new Error('El respaldo "' + previos.respaldo + '" esta vacio: no hay nada que reponer.');
    }

    const colIni = columnLetterToIndex(cfg.start);
    const idxMonto = columnLetterToIndex(cfg.columns.monto) - colIni;
    const montoOriginal = Number(matrizBackup[0][idxMonto]);
    const colMonto = columnLetterToIndex(cfg.columns.monto);

    hoja.getRange(previos.fila, colMonto).setValue(montoOriginal);
    SpreadsheetApp.flush();

    const releido = Number(hoja.getRange(previos.fila, colMonto).getValue());
    if (releido !== montoOriginal) {
        throw new Error('Se intento revertir la fila ' + previos.fila + ' pero el monto releido (' + releido +
            ') no coincide con el original del respaldo (' + montoOriginal + '). Revisar "' + SHEETS.PROYECCION +
            '" a mano; el respaldo sigue en "' + previos.respaldo + '".');
    }

    props.deleteProperty(PA_PROP_PREVIOS_EDICION);

    logSuccess('revertirEdicionMontoProyeccion: fila ' + previos.fila + ' restaurada a ' + montoOriginal + '.');
    return { fila: previos.fila, montoRestaurado: montoOriginal };
}
