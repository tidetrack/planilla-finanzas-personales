/**
 * DEVTOOL_TipoDeMedios.js
 * Saca el nivel intermedio del eje de medios: cada medio pasa a declarar su TIPO directamente.
 *
 * [CONCEPTO DE NEGOCIO]
 * El eje de medios contesta DONDE ESTA la plata, y para eso alcanza con la finalidad: Hogar,
 * Ahorros, Inversiones, Financiacion. Entre el medio y su tipo habia un nivel de "categorias"
 * (Meta de Ahorro 1, Chanchito, Europa...) pensado como objetivos de ahorro, y la medicion dice
 * que no estaba clasificando nada:
 *
 *   - "Meta de Ahorro 1" concentraba 16 de los 28 medios -- el 57%. No es una meta, es un cajon
 *     de sastre donde cayo todo lo que no era cotidiano.
 *   - 5 de las 11 categorias no tenian NINGUN medio: Tarjeta de Credito, Cambiar el Celular,
 *     Meta de Ahorro 2, Meta de Ahorro 3, y una sin nombre.
 *   - Las 4 restantes tenian exactamente un medio cada una.
 *
 * decision Franco 2026-08-19: "en medios bancarios utilicemos simplemente tipo".
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Un nivel de agrupamiento que deja el 57% en un solo grupo y el 45% de los grupos vacios no
 * agrega informacion: agrega un salto mas donde equivocarse. Sacarlo simplifica ademas todas las
 * formulas, que hoy hacen DOS VLOOKUP encadenados (medio -> categoria -> tipo) y pasan a hacer uno.
 *
 * ============================================================================
 * ES UN CAMBIO ATOMICO: CATALOGO Y FORMULAS JUNTOS
 * ============================================================================
 * Si se cambia la columna del catalogo sin cambiar las formulas, el segundo VLOOKUP busca un tipo
 * dentro de la tabla de categorias, no lo encuentra, y TODA clasificacion devuelve cadena vacia:
 * el capital se va a cero y el saldo cotidiano se come todo. Por eso las dos mitades se escriben
 * en la misma corrida y se revierten juntas.
 *
 * ============================================================================
 * LA RIQUEZA NO SE MUEVE, Y ESO SE VERIFICA
 * ============================================================================
 * Reasignar los medios podria cambiar quien cuenta como riqueza (Ahorros + Inversiones). Medido
 * medio por medio: los unicos que cambian de tipo se mueven DENTRO de la riqueza -- IOL, CEDEARS,
 * CRYPTO, FCI y los Galicia Fima pasan de "Ahorros" a "Inversiones", que estan los dos en la
 * lista blanca. El unico que sale de la riqueza es "Brubank", que pasa a Hogar y no tiene NINGUN
 * movimiento en el ledger. Total de riqueza: sin cambio.
 *
 * ============================================================================
 * LA VALIDACION DE DATOS ES PARTE DEL CAMBIO, NO UN DETALLE
 * ============================================================================
 * La columna del catalogo tiene un DESPLEGABLE con la lista de valores permitidos. Mientras esa
 * lista sea la de categorias, escribir "Hogar" es un valor invalido: Sheets lo rechaza, la celda
 * queda VACIA, y setValue no lanza ninguna excepcion. Es exactamente lo que paso en la primera
 * corrida de la v0.20.0 -- los 28 medios fallaron la verificacion y, peor, la columna quedo sin
 * nada, dejando a todos los medios sin tipo.
 *
 * Cambiar lo que una columna significa incluye cambiar lo que esa columna ACEPTA. Por eso el
 * modulo reemplaza la validacion por la lista de los cuatro tipos ANTES de escribir, y la
 * restaura si algo falla. Una migracion que cambia el dominio de una columna y no toca su
 * validacion no esta terminada: esta escribiendo contra una regla que dice lo contrario.
 *
 * QUE NO HACE
 * 1. NO borra el bloque P:Q. Queda como estaba, sin uso: es dato de Franco y borrarlo no aporta.
 *    Si algun dia quiere volver a tener objetivos de ahorro, el bloque esta.
 * 2. NO toca el ledger.
 * 3. NO cambia la lista blanca de riqueza (TIPOS_RIQUEZA sigue siendo Ahorros + Inversiones).
 *
 * @version 0.20.0
 * @since 2026-08-19
 * @lastModified 2026-08-19
 */

const TDM_PROP_RESPALDO = 'tipo_de_medios_respaldo';

/**
 * El tipo de cada medio, asignado por lo que el medio ES, no por donde estaba archivado.
 *
 * Criterio: Hogar = cuentas de uso diario; Ahorros = plata guardada que no se mueve;
 * Inversiones = vehiculos que buscan rendimiento; Financiacion = deuda.
 */
const TDM_TIPOS = {
    'Efectivo': 'Hogar', 'NaranjaX': 'Hogar', 'Mercado Pago': 'Hogar', 'Galicia': 'Hogar',
    'Patagonia': 'Hogar', 'Santander': 'Hogar', 'Ualá': 'Hogar', 'YPF': 'Hogar', 'Brubank': 'Hogar',

    'Plazo Fijo': 'Ahorros', 'Ahorro Pesos': 'Ahorros', 'Frascos Naranja X': 'Ahorros',
    'Frasco Transitorio NaranjaX': 'Ahorros', 'Reserva MP': 'Ahorros', 'Lemon Cash': 'Ahorros',
    'Dolar Cash': 'Ahorros', 'Dolar NaranjaX': 'Ahorros', 'Dolar Mercado Pago': 'Ahorros',
    'Dolar MEP': 'Ahorros', 'Dolar Patagonia': 'Ahorros',

    'IOL': 'Inversiones', 'CEDEARS': 'Inversiones', 'CRYPTO': 'Inversiones', 'FCI': 'Inversiones',
    'Dolar Galicia': 'Inversiones', 'Galicia Fima - Fran': 'Inversiones', 'Galicia Fima - Dima': 'Inversiones',

    'Frascos Nx - Préstamo': 'Financiación'
};

/** El rotulo que pasa a llevar la columna, para que la hoja diga lo que la columna hace. */
const TDM_ROTULO_COLUMNA = 'Tipo';

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: que cambiaria en el catalogo y en las formulas. */
function estadoTipoDeMedios() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planTdm(ss);
        const l = ['TIPO DE MEDIOS - ESTADO (no se escribio nada)', ''];
        l.push('El medio pasa a declarar su TIPO directamente. Desaparece el salto por categoria.');
        l.push('');
        l.push('CATALOGO: ' + plan.medios.length + ' medio(s) a reescribir en la columna ' +
            RANGES.MEDIOS_PAGO.columns.proyecto);
        const porTipo = {};
        plan.medios.forEach(function (m) { (porTipo[m.tipo] = porTipo[m.tipo] || []).push(m); });
        Object.keys(porTipo).forEach(function (t) {
            l.push('   ' + _padTdm(t, 14) + porTipo[t].length + ' medio(s)');
            porTipo[t].forEach(function (m) {
                l.push('        ' + _padTdm(m.medio, 30) + (m.categoriaPrevia || '(sin categoria)') + ' -> ' + m.tipo +
                    (m.cambiaRiqueza ? '   *** CAMBIA DE LADO EN RIQUEZA ***' : ''));
            });
        });
        l.push('');
        l.push('FORMULAS: ' + plan.formulas.length + ' celda(s) pasan de dos VLOOKUP a uno');
        plan.formulas.forEach(function (f) { l.push('   ' + f.nombreHoja + '!' + f.celda); });
        if (plan.sinAsignar.length) {
            l.push('');
            l.push('MEDIOS DEL CATALOGO SIN TIPO ASIGNADO (se saltean): ' + plan.sinAsignar.join(', '));
        }
        if (plan.avisos.length) {
            l.push('');
            l.push('Avisos:');
            plan.avisos.forEach(function (a) { l.push('  - ' + a); });
        }
        const t = l.join('\n');
        _mostrarTdm('Tipo de medios - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarTdm('Tipo de medios - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Aplica catalogo y formulas EN LA MISMA CORRIDA. Son inseparables. */
function aplicarTipoDeMedios() {
    const escritas = [];
    let ss = null, ui = null, fotoCatalogo = null, yaRevertido = false;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarTipoDeMedios necesita UI (menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planTdm(ss);
        if (!plan.medios.length && !plan.formulas.length) {
            const t = 'Ya esta aplicado: los medios declaran su tipo directamente. No se escribio nada.';
            _mostrarTdm('Tipo de medios', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Tipo de medios, sin nivel intermedio',
            'Se va a escribir, EN LA MISMA CORRIDA:\n\n' +
            '  - el TIPO de ' + plan.medios.length + ' medio(s) en la columna ' +
            RANGES.MEDIOS_PAGO.columns.proyecto + ' del Plan de Cuentas\n' +
            '  - ' + plan.formulas.length + ' formula(s) que dejan de hacer el segundo VLOOKUP\n\n' +
            'Las dos mitades son INSEPARABLES: cambiar el catalogo sin las formulas dejaria toda la ' +
            'clasificacion en blanco y el capital en cero.\n\n' +
            'El bloque P:Q queda como esta, sin uso. No se toca el ledger.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
        const respaldoCat = _respaldarCatalogo(ss, hojaPC, sello);
        const respaldoForm = _respaldarFormulerio(ss, sello);
        fotoCatalogo = _fotografiarColumnaTdm(ss);

        // --- 1. El catalogo. Primero el DOMINIO de la columna, despues los valores: mientras
        // el desplegable siga listando categorias, "Hogar" es un valor invalido y Sheets lo
        // rechaza dejando la celda vacia, sin lanzar ninguna excepcion.
        const cfg = RANGES.MEDIOS_PAGO;
        const col = columnLetterToIndex(cfg.columns.proyecto);
        _abrirDominioColumnaTdm(ss);
        hojaPC.getRange(HEADER_ROW, col).setValue(TDM_ROTULO_COLUMNA);
        plan.medios.forEach(function (m) { hojaPC.getRange(m.fila, col).setValue(m.tipo); });

        // --- 2. Las formulas ---
        plan.formulas.forEach(function (f) {
            const rango = ss.getSheetByName(f.nombreHoja).getRange(f.celda);
            const errorPrevio = _errorDeCelda(rango);
            rango.setFormula(f.nueva);
            escritas.push({ nombreHoja: f.nombreHoja, celda: f.celda, previa: f.actual, nueva: f.nueva, errorPrevio: errorPrevio });
        });
        SpreadsheetApp.flush();

        // --- 3. Relectura ---
        const fallas = _verificarEscrituraSyf(ss, escritas);
        plan.medios.forEach(function (m) {
            if (String(hojaPC.getRange(m.fila, col).getValue() || '').trim() !== m.tipo) {
                fallas.push(m.medio + ' no quedo con su tipo en el catalogo');
            }
        });
        if (fallas.length) {
            _revertirEscriturasSyf(ss, escritas);
            _restaurarColumnaTdm(ss, fotoCatalogo);
            yaRevertido = true;
            throw new Error('Se escribio pero NO VERIFICA al releer: ' + fallas.slice(0, 5).join('; ') +
                (fallas.length > 5 ? ' (y ' + (fallas.length - 5) + ' mas)' : '') +
                '. Se restauro el catalogo y las formulas. Respaldos: "' + respaldoCat.nombre +
                '" y "' + respaldoForm.nombre + '".');
        }

        PropertiesService.getDocumentProperties().setProperty(TDM_PROP_RESPALDO, respaldoCat.nombre);

        const detalle = 'TIPO DE MEDIOS APLICADO\n\n' +
            '- Medios con su tipo directo: ' + plan.medios.length + '\n' +
            '- Formulas simplificadas a un solo VLOOKUP: ' + escritas.length + '\n' +
            '- Respaldos: "' + respaldoCat.nombre + '" (catalogo) y "' + respaldoForm.nombre + '" (formulas)\n\n' +
            'QUE MIRAR:\n' +
            '  1. En el Plan de Cuentas, la columna ' + cfg.columns.proyecto + ' de los medios dice ahora\n' +
            '     "' + TDM_ROTULO_COLUMNA + '" y trae Hogar / Ahorros / Inversiones / Financiacion.\n' +
            '  2. "Tablero"!AG9 (capital ARS) NO tiene que moverse: los medios que cambian de tipo se\n' +
            '     mueven dentro de la riqueza. Si se movio, avisar.\n' +
            '  3. El bloque P:Q sigue ahi, sin uso. No se borro nada.';

        logSuccess('aplicarTipoDeMedios: ' + plan.medios.length + ' medios, ' + escritas.length + ' formulas.');
        _mostrarTdm('Tipo de medios - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && !yaRevertido && (escritas.length || fotoCatalogo)) {
            try {
                _revertirEscriturasSyf(ss, escritas);
                _restaurarColumnaTdm(ss, fotoCatalogo);
                restaurado = ' Se restauro el catalogo y las formulas.';
            } catch (e2) { restaurado = ' ADEMAS fallo la restauracion (' + e2.message + '): usar los respaldos.'; }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack });
        _mostrarTdm('Tipo de medios - ERROR', msg);
        return { ok: false, error: msg };
    }
}

// ============================================
// PLAN
// ============================================

function _planTdm(ss) {
    const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    if (!hojaPC) throw new Error('No existe la hoja "' + SHEETS.PLAN_CUENTAS + '".');
    const avisos = [];
    const cfg = RANGES.MEDIOS_PAGO;
    const colNombre = columnLetterToIndex(cfg.columns.nombre);
    const colTipo = columnLetterToIndex(cfg.columns.proyecto);
    const desde = getDataRow(cfg);
    const alto = hojaPC.getMaxRows() - desde + 1;

    // Tipos que ya tenian los medios via el nivel intermedio, para poder avisar si alguno cruza
    // el limite de la riqueza.
    const cfgCat = RANGES.PROYECTOS;
    const colCatN = columnLetterToIndex(cfgCat.columns.nombre);
    const colCatT = columnLetterToIndex(cfgCat.columns.tipo);
    const altoCat = hojaPC.getMaxRows() - getDataRow(cfgCat) + 1;
    const tipoDeCategoria = Object.create(null);
    if (altoCat > 0) {
        hojaPC.getRange(getDataRow(cfgCat), colCatN, altoCat, colCatT - colCatN + 1).getValues().forEach(function (f) {
            const n = String(f[0] || '').trim();
            if (n) tipoDeCategoria[_normalizarRotulo(n)] = String(f[f.length - 1] || '').trim();
        });
    }
    const esRiqueza = function (t) { return TIPOS_RIQUEZA.indexOf(t) !== -1; };

    const medios = [];
    const sinAsignar = [];
    if (alto > 0) {
        const vals = hojaPC.getRange(desde, colNombre, alto, colTipo - colNombre + 1).getValues();
        vals.forEach(function (f, i) {
            const nombre = String(f[0] || '').trim();
            if (!nombre) return;
            const actual = String(f[f.length - 1] || '').trim();
            const clave = Object.keys(TDM_TIPOS).filter(function (k) {
                return _normalizarRotulo(k) === _normalizarRotulo(nombre);
            })[0];
            if (!clave) { sinAsignar.push(nombre); return; }
            const tipo = TDM_TIPOS[clave];
            if (_normalizarRotulo(actual) === _normalizarRotulo(tipo)) return;   // ya esta
            const tipoPrevio = tipoDeCategoria[_normalizarRotulo(actual)] || '';
            medios.push({
                fila: desde + i, medio: nombre, tipo: tipo, categoriaPrevia: actual,
                cambiaRiqueza: !!tipoPrevio && (esRiqueza(tipoPrevio) !== esRiqueza(tipo))
            });
        });
    }
    if (sinAsignar.length) {
        avisos.push('Estos medios del catalogo no estan en el mapa y se saltean: ' + sinAsignar.join(', ') +
            '. Van a quedar sin tipo y por lo tanto fuera de todo saldo.');
    }
    const cruzan = medios.filter(function (m) { return m.cambiaRiqueza; });
    if (cruzan.length) {
        avisos.push('CAMBIAN DE LADO EN LA RIQUEZA (' + cruzan.length + '): ' +
            cruzan.map(function (m) { return m.medio; }).join(', ') +
            '. Verificar el capital despues de aplicar.');
    }

    // La validacion de la columna: si restringe a una lista, hay que cambiarla o la escritura
    // se rechaza en silencio. Es la cicatriz de la primera corrida de la v0.20.0.
    let validacionPrevia = '';
    try {
        const dv = hojaPC.getRange(desde, colTipo).getDataValidation();
        if (dv) validacionPrevia = String(dv.getCriteriaType());
    } catch (e) { validacionPrevia = ''; }
    if (validacionPrevia) {
        avisos.push('La columna ' + cfg.columns.proyecto + ' tiene una validacion de tipo ' +
            validacionPrevia + '. Se reemplaza por la lista de los cuatro tipos ANTES de escribir: ' +
            'si no, cada valor nuevo se rechaza y la celda queda vacia sin avisar.');
    }
    const vacias = alto > 0 ? hojaPC.getRange(desde, colTipo, alto, 1).getValues()
        .filter(function (f, i) { return i < medios.length + sinAsignar.length && String(f[0] || '').trim() === ''; }).length : 0;
    if (vacias > 0) {
        avisos.push(vacias + ' medio(s) estan HOY sin tipo. Mientras esa columna este vacia, ' +
            'ningun medio clasifica: el capital del Tablero da cero y todo cae en cotidiano.');
    }

    // Formulas que hacen el doble VLOOKUP.
    const formulas = _formulasConDobleLookup(ss);
    return { medios: medios, formulas: formulas, sinAsignar: sinAsignar,
             validacionPrevia: validacionPrevia, avisos: avisos };
}

/**
 * Encuentra y reescribe las formulas que encadenan medio -> categoria -> tipo.
 *
 * Dos formas de la misma cadena, y las dos se colapsan al primer VLOOKUP:
 *   (a) anidada en linea, dentro de los arrays de QUERY (R9, U9, X9, Inicio C13/F13)
 *   (b) en dos variables de LET consecutivas (AA9, N19, AG9:AG12, Inicio F8/C15/F15)
 * El reemplazo va por FUNCION, nunca por string: en un proyecto donde toda formula lleva '$',
 * un string de reemplazo ya rompio tres celdas una vez.
 */
function _formulasConDobleLookup(ss) {
    const cfgCat = RANGES.PROYECTOS;
    const rangoCat = cfgCat.start + ':' + cfgCat.end;
    const salida = [];
    [NAV_CONFIG.SHEETS.INICIO, NAV_CONFIG.SHEETS.TABLERO].forEach(function (nombreHoja) {
        const hoja = ss.getSheetByName(nombreHoja);
        if (!hoja) return;
        const ultF = Math.max(1, hoja.getLastRow());
        const ultC = Math.max(1, hoja.getLastColumn());
        if (ultF * ultC > 400000) return;
        const formulas = hoja.getRange(1, 1, ultF, ultC).getFormulas();
        for (let r = 0; r < formulas.length; r++) {
            for (let c = 0; c < formulas[r].length; c++) {
                const f = formulas[r][c];
                if (!f || f.indexOf(rangoCat) === -1) continue;
                const nueva = _colapsarDobleLookupTdm(f, rangoCat);
                if (nueva === f) continue;
                salida.push({
                    nombreHoja: nombreHoja, celda: columnIndexToLetter(c + 1) + (r + 1),
                    actual: f, nueva: nueva
                });
            }
        }
    });
    return salida;
}

/** Colapsa las dos formas de la cadena. Expuesta para el banco de pruebas. */
function _colapsarDobleLookupTdm(formula, rangoCat) {
    const cat = (rangoCat || (RANGES.PROYECTOS.start + ':' + RANGES.PROYECTOS.end)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let out = formula;
    // (a) anidada: IFERROR(VLOOKUP(IFERROR(VLOOKUP(X; ...L:N; 3; 0); ""); ...P:Q; 2; 0); "")
    const reAnidada = new RegExp(
        'IFERROR\\(\\s*VLOOKUP\\(\\s*(IFERROR\\(\\s*VLOOKUP\\([^;]+;[^;]+;\\s*3;\\s*0\\)\\s*;\\s*""\\s*\\))\\s*;' +
        '[^;]*' + cat + '\\s*;\\s*2\\s*;\\s*0\\s*\\)\\s*;\\s*""\\s*\\)', 'g');
    out = out.replace(reAnidada, function (m, interno) { return interno; });
    // (b) dos variables de LET: tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; ...P:Q; 2; 0); ""));
    const reLet = new RegExp(
        '(\\w+)\\s*;\\s*ARRAYFORMULA\\(\\s*IFERROR\\(\\s*VLOOKUP\\(\\s*(\\w+)\\s*;' +
        '[^;]*' + cat + '\\s*;\\s*2\\s*;\\s*0\\s*\\)\\s*;\\s*""\\s*\\)\\s*\\)', 'g');
    out = out.replace(reLet, function (m, destino, origen) { return destino + '; ' + origen; });
    return out;
}

// ============================================
// RESPALDO PUNTUAL DE LA COLUMNA
// ============================================

/**
 * Fotografia la columna ENTERA: valores Y reglas de validacion.
 *
 * Sin las validaciones la foto no sirve como punto de retorno: restaurar los valores viejos
 * contra una lista de valores permitidos nueva los rechazaria uno por uno, en silencio.
 */
function _fotografiarColumnaTdm(ss) {
    const cfg = RANGES.MEDIOS_PAGO;
    const hoja = ss.getSheetByName(cfg.sheet);
    const col = columnLetterToIndex(cfg.columns.proyecto);
    const desde = HEADER_ROW;
    const alto = hoja.getMaxRows() - desde + 1;
    if (alto <= 0) return null;
    const rango = hoja.getRange(desde, col, alto, 1);
    let validaciones = null;
    try { validaciones = rango.getDataValidations(); } catch (e) { validaciones = null; }
    return { col: col, desde: desde, valores: rango.getValues(), validaciones: validaciones };
}

/**
 * Cambia el DOMINIO de la columna: saca la validacion vieja y pone la lista de los cuatro tipos.
 * Se corre ANTES de escribir. Sin esto, cada valor nuevo es rechazado en silencio.
 */
function _abrirDominioColumnaTdm(ss) {
    const cfg = RANGES.MEDIOS_PAGO;
    const hoja = ss.getSheetByName(cfg.sheet);
    const col = columnLetterToIndex(cfg.columns.proyecto);
    const desde = getDataRow(cfg);
    const alto = hoja.getMaxRows() - desde + 1;
    if (alto <= 0) return;
    const rango = hoja.getRange(desde, col, alto, 1);
    rango.clearDataValidations();
    const tipos = [];
    Object.keys(TDM_TIPOS).forEach(function (m) {
        if (tipos.indexOf(TDM_TIPOS[m]) === -1) tipos.push(TDM_TIPOS[m]);
    });
    const regla = SpreadsheetApp.newDataValidation()
        .requireValueInList(tipos, true)
        .setAllowInvalid(false)
        .setHelpText('Finalidad del medio: ' + tipos.join(', '))
        .build();
    rango.setDataValidation(regla);
    SpreadsheetApp.flush();
}

/**
 * Devuelve la columna a como estaba: primero se LIBERA la validacion, despues se escriben los
 * valores, y recien al final se repone la regla vieja. En ese orden, porque escribir los valores
 * viejos con la regla nueva puesta los rechazaria -- que es la trampa que rompio la primera
 * corrida.
 */
function _restaurarColumnaTdm(ss, foto) {
    if (!foto) return;
    const hoja = ss.getSheetByName(RANGES.MEDIOS_PAGO.sheet);
    const rango = hoja.getRange(foto.desde, foto.col, foto.valores.length, 1);
    rango.clearDataValidations();
    rango.setValues(foto.valores);
    SpreadsheetApp.flush();
    if (foto.validaciones) {
        try { rango.setDataValidations(foto.validaciones); }
        catch (e) { logError('_restaurarColumnaTdm: no se pudo reponer la validacion (' + e.message + ')'); }
        SpreadsheetApp.flush();
    }
}

function _padTdm(s, n) {
    let t = String(s);
    while (t.length < n) t += ' ';
    return t;
}

function _mostrarTdm(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
