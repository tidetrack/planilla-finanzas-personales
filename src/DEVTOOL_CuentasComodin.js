/**
 * DEVTOOL_CuentasComodin.js - el bloque oculto de cuentas comodin del Plan de Cuentas.
 *
 * [CONCEPTO DE NEGOCIO]
 * Hay movimientos que no son un ingreso ni un gasto: solo mueven plata de una caja propia a
 * otra ("Traspaso"), o declaran con cuanto arranca una caja el mes ("Inicio Mes"). El
 * patrimonio no cambia; cambia su composicion. Franco las llama CUENTAS COMODIN: no son
 * ingreso, no son gasto fijo, no son gasto variable, y por eso hasta hoy no tenian donde
 * vivir en la hoja "Plan de Cuentas" -- se tipeaban a mano en la grilla de Cargas.
 *
 * Ese "a mano" es el problema que este modulo cierra. El propio 00_Config.js lo documenta:
 * en el ledger conviven "Traspaso", "traspaso " y "Inicio  Mes", y una comparacion estricta
 * deja pasar justo las filas que hay que excluir de todo agregado. Con la cuenta en el
 * desplegable, la variante no se puede escribir.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Son cuentas de MOVIMIENTOS, permutativas: por definicion no afectan el resultado del
 * periodo. El concepto viene del plan de cuentas de planilla-pymes, donde tienen su propio
 * bloque. 00_Config.js declara textualmente que ese bloque todavia NO existe en la hoja y
 * que "hasta que la Fase 6 lo cree, esta constante ES el registro de cuentas neutras del
 * sistema". Este modulo lo crea.
 *
 * decision Franco 2026-08-24: la cuenta va en el Plan de Cuentas pero OCULTA. Es maquinaria
 * del sistema, no catalogo que el usuario administre: tiene que estar para que el
 * desplegable la ofrezca y para que el Plan sea el registro completo de las cuentas que el
 * ledger usa, y no tiene que estar a la vista compitiendo con los tres bloques reales.
 *
 * DOS COSAS QUE ESTE MODULO **NO** HACE, y son deliberadas:
 *
 *   1. NO cambia el "Tipo de Cuenta" de ninguna fila del ledger. deducirTipoCuenta() lee
 *      SOLO los catalogos de ingresos, fijos y variables (06_RegistrosService.js:255-259):
 *      una cuenta en un bloque nuevo sigue devolviendo '' -- que es exactamente lo correcto
 *      para un comodin, y no obliga a migrar una sola de las 3.469 filas historicas. El
 *      ledger hoy tiene 533 patas de traspaso con 'Ingreso' y 96 con vacio; esa asimetria
 *      queda como esta y la corrige la exclusion por CUENTAS_NEUTRAS, que ya funciona.
 *
 *   2. NO mueve la cuenta 'Ajuste'. Conceptualmente tambien es un comodin, pero hoy vive en
 *      el bloque de Ingresos con su destino declarado a proposito
 *      (DEVTOOL_AltaCuentas.js:62, ALTA_SIN_TIPO = { 'Ajuste': 'Ingreso' }). Moverla
 *      cambiaria el tipo de cuenta de todo Ajuste futuro. Es una decision de Franco, no de
 *      este modulo.
 *
 * EL CATALOGO NO SE RETIPEA: el bloque se siembra desde CUENTAS_NEUTRAS (00_Config.js:348),
 * que sigue siendo la fuente unica. Si manana entra una tercera cuenta comodin, se agrega
 * ahi y se vuelve a correr "2. Aplicar": la hoja es la proyeccion de la constante, nunca al
 * reves. El preflight verifica que sigan coincidiendo.
 *
 * @see docs/permanente/ARNES_TIDETRACK.md seccion 8 (Fase 6 - plan de cuentas)
 * @see 00_Config.js CUENTAS_NEUTRAS
 * @version 0.46.0
 * @since 0.46.0
 * @lastModified 2026-08-24
 */

// ============================================
// GEOMETRIA
// ============================================

// decision Franco 2026-08-24: el bloque va en T:U. Las columnas E, H, K, O y Q son el AIRE
// entre bloques -- la hoja separa por columna vacia y no por borde, y esa es su regla
// visual --, R es la consolidada de servicio, y S es el aire que le corresponde. T es la
// primera columna verdaderamente libre. Medido sobre el gemelo: la hoja usa
// C, D, F, G, I, J, L, M, N, P, R y nada mas.
const CC_COL_NOMBRE = 'T';
const CC_COL_NOTA = 'U';

// Mismo layout que los otros bloques de la hoja: titulo fila 6, header fila 7, datos fila 8.
// No se declaran a mano: salen de los defaults globales, que describen esta hoja.
const CC_FILA_TITULO = 6;

/** El rotulo del bloque. Lleva punto final, como los otros cuatro de la hoja. */
const CC_TITULO = 'Comodines.';
const CC_HEADER_NOMBRE = 'Cuenta';
const CC_HEADER_NOTA = 'Que es';

/** Para que sirve cada comodin, escrito en la hoja para el que la abra dentro de un anio. */
const CC_NOTAS = {
    'Traspaso': 'Plata que se mueve entre dos cajas propias. No es ingreso ni gasto: el patrimonio no cambia, cambia donde esta.',
    'Inicio Mes': 'Saldo con el que una caja arranca el mes. Declara cuanto habia, no mueve nada.'
};

/** Nota de reserva para una cuenta comodin nueva que todavia no tenga texto propio. */
const CC_NOTA_DEFECTO = 'Cuenta comodin del sistema: no es ingreso ni gasto.';

/** El bloque del que se copia el formato, para no hardcodear un solo color. */
const CC_BLOQUE_MODELO = 'INGRESOS';

const CC_PROP_RESPALDO = 'cuentas_comodin_respaldo';
const CC_PROP_FORMULA_R = 'cuentas_comodin_formula_consolidada';
// El respaldo lo crea y lo nombra _respaldarCatalogo (DEVTOOL_AltaCuentas.js), que ya usa
// ALTA_PREFIJO_RESPALDO. Reusarlo, y no declarar un prefijo propio, tiene una consecuencia
// buena y buscada: DEVTOOL_PurgaRespaldos ya conoce ese prefijo, asi que estos respaldos
// entran solos en la rotacion de purga en vez de acumularse para siempre.

// ============================================
// PUBLICAS
// ============================================

/**
 * Solo lectura: que haria "2. Aplicar". No escribe una sola celda.
 * @returns {{ok:boolean, detalle?:string, error?:string}}
 */
function estadoCuentasComodin() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planCuentasComodin(ss);
        const l = [];
        l.push('BLOQUE DE CUENTAS COMODIN — ' + SHEETS.PLAN_CUENTAS + '!' +
            CC_COL_NOMBRE + ':' + CC_COL_NOTA);
        l.push('');
        l.push('Catalogo, tomado de CUENTAS_NEUTRAS (00_Config.js): ' +
            CUENTAS_NEUTRAS.join(', '));
        l.push('');

        if (plan.yaAplicado && plan.faltantes.length === 0 && plan.sobrantes.length === 0) {
            l.push('EL BLOQUE YA EXISTE Y COINCIDE. No hay nada que escribir.');
        } else if (plan.yaAplicado) {
            l.push('EL BLOQUE EXISTE PERO NO COINCIDE con la constante:');
            if (plan.faltantes.length) l.push('  faltan en la hoja: ' + plan.faltantes.join(', '));
            if (plan.sobrantes.length) l.push('  sobran en la hoja: ' + plan.sobrantes.join(', '));
            l.push('  "2. Aplicar" reescribe el bloque para que coincida.');
        } else {
            l.push('EL BLOQUE NO EXISTE. "2. Aplicar" va a:');
            l.push('  1. Respaldar el Plan de Cuentas entero (hoja oculta, verificada).');
            l.push('  2. Escribir el titulo "' + CC_TITULO + '" en ' + CC_COL_NOMBRE + CC_FILA_TITULO +
                ', los headers en la fila ' + HEADER_ROW + ' y ' + CUENTAS_NEUTRAS.length +
                ' cuenta(s) desde la fila ' + DATA_START_ROW + '.');
            l.push('  3. Copiar el formato del bloque "' + CC_BLOQUE_MODELO +
                '" para que se vea igual que los demas.');
            l.push('  4. OCULTAR las columnas ' + CC_COL_NOMBRE + ' y ' + CC_COL_NOTA + '.');
            l.push('  5. Sumar el bloque a la consolidada, para que el desplegable de Cuenta');
            l.push('     de la hoja "' + SHEETS.DATA_ENTRY + '" las ofrezca en vez de que se tipeen.');
        }

        l.push('');
        l.push('LA CONSOLIDADA (' + CC_COL_NOMBRE + ' -> ' + plan.colConsolidada + ')');
        if (plan.consolidadaYaIncluye) {
            l.push('  Ya incluye el bloque nuevo. No se toca.');
        } else if (plan.formulaConsolidada) {
            l.push('  Hoy:     ' + plan.formulaConsolidada);
            l.push('  Quedaria: ' + plan.formulaConsolidadaNueva);
        } else {
            l.push('  ATENCION: no se encontro formula en ' + plan.colConsolidada + DATA_START_ROW +
                '. El desplegable no se va a tocar.');
        }

        l.push('');
        l.push('LO QUE NO CAMBIA, y conviene saberlo:');
        l.push('  - Ninguna fila del ledger. El "Tipo de Cuenta" de un traspaso sigue saliendo');
        l.push('    como hasta hoy: deducirTipoCuenta solo mira ingresos, fijos y variables.');
        l.push('  - La cuenta "Ajuste" se queda en el bloque de Ingresos.');

        const detalle = l.join('\n');
        _mostrarComodin('Cuentas comodin - estado', detalle);
        return { ok: true, detalle: detalle };
    } catch (e) {
        logError('estadoCuentasComodin', e);
        _mostrarComodin('Cuentas comodin - error', String(e && e.message ? e.message : e));
        return { ok: false, error: String(e && e.message ? e.message : e) };
    }
}

/**
 * Crea (o realinea) el bloque oculto. Respalda antes y verifica despues; si la verificacion
 * falla, revierte todo lo escrito en esta corrida.
 * @returns {{ok:boolean, detalle?:string, error?:string}}
 */
function aplicarCuentasComodin() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let respaldo = null;
    try {
        const plan = _planCuentasComodin(ss);
        if (plan.yaAplicado && !plan.faltantes.length && !plan.sobrantes.length &&
            plan.consolidadaYaIncluye) {
            const msg = 'El bloque ya existe, coincide con CUENTAS_NEUTRAS y ya esta en la ' +
                'consolidada. No se escribio nada.';
            _mostrarComodin('Cuentas comodin', msg);
            return { ok: true, detalle: msg };
        }

        const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
        const sello = _selloComodin();

        // 1. Respaldo del Plan entero, verificado celda por celda antes de tocar nada.
        respaldo = _respaldarCatalogo(ss, hojaPC, sello);
        PropertiesService.getDocumentProperties().setProperty(CC_PROP_RESPALDO, respaldo.nombre);

        // 2. La formula de la consolidada se guarda ANTES de pisarla: el respaldo es a
        //    VALORES, asi que restaurarlo desde ahi la destruiria.
        if (plan.formulaConsolidada) {
            PropertiesService.getDocumentProperties()
                .setProperty(CC_PROP_FORMULA_R, plan.formulaConsolidada);
        }

        const colNombre = columnLetterToIndex(CC_COL_NOMBRE);
        const colNota = columnLetterToIndex(CC_COL_NOTA);

        // 3. El bloque. Se limpia primero el area para que un realineo no deje restos de una
        //    corrida anterior con mas cuentas.
        const altoLimpieza = Math.max(CUENTAS_NEUTRAS.length, plan.filasEnHoja) + 5;
        hojaPC.getRange(DATA_START_ROW, colNombre, altoLimpieza, 2).clearContent();

        hojaPC.getRange(CC_FILA_TITULO, colNombre).setValue(CC_TITULO);
        hojaPC.getRange(HEADER_ROW, colNombre).setValue(CC_HEADER_NOMBRE);
        hojaPC.getRange(HEADER_ROW, colNota).setValue(CC_HEADER_NOTA);

        const filas = CUENTAS_NEUTRAS.map(function (nombre) {
            return [nombre, CC_NOTAS[nombre] || CC_NOTA_DEFECTO];
        });
        hojaPC.getRange(DATA_START_ROW, colNombre, filas.length, 2).setValues(filas);

        // 4. Formato copiado del bloque modelo. No se hardcodea un hex: si Franco cambia el
        //    azul de la hoja, este bloque lo sigue solo.
        _copiarFormatoBloqueComodin(hojaPC, colNombre, colNota);

        // 5. La consolidada.
        let formulaNueva = null;
        if (!plan.consolidadaYaIncluye && plan.formulaConsolidadaNueva) {
            hojaPC.getRange(DATA_START_ROW, columnLetterToIndex(plan.colConsolidada))
                .setFormula(plan.formulaConsolidadaNueva);
            formulaNueva = plan.formulaConsolidadaNueva;
        }
        SpreadsheetApp.flush();

        // 6. Verificacion: se lee el VALOR de vuelta, no el texto que se creyo escribir.
        const problemas = _verificarComodin(hojaPC, plan.colConsolidada);
        if (problemas.length) {
            _revertirEscrituraComodin(ss, hojaPC, plan);
            throw new Error('La escritura NO verifica y se revirtio entera:\n  - ' +
                problemas.join('\n  - ') + '\nEl respaldo quedo en "' + respaldo.nombre + '".');
        }

        // 7. Recien con todo verificado se ocultan las columnas. Al reves, un fallo dejaria
        //    el problema escondido justo cuando hay que mirarlo.
        hojaPC.hideColumns(colNombre, 2);
        SpreadsheetApp.flush();

        const l = [];
        l.push('BLOQUE DE CUENTAS COMODIN CREADO.');
        l.push('');
        l.push('  ' + SHEETS.PLAN_CUENTAS + '!' + CC_COL_NOMBRE + CC_FILA_TITULO + ' = "' + CC_TITULO + '"');
        CUENTAS_NEUTRAS.forEach(function (n, i) {
            l.push('  ' + CC_COL_NOMBRE + (DATA_START_ROW + i) + ' = "' + n + '"');
        });
        l.push('  Columnas ' + CC_COL_NOMBRE + ' y ' + CC_COL_NOTA + ' ocultas.');
        if (formulaNueva) {
            l.push('');
            l.push('  La consolidada ahora las incluye: el desplegable de Cuenta de la hoja "' +
                SHEETS.DATA_ENTRY + '" las ofrece y ya no hay que tipearlas.');
        }
        l.push('');
        l.push('  Respaldo: "' + respaldo.nombre + '" (oculta).');
        l.push('  Para deshacer: "3. Revertir".');
        const detalle = l.join('\n');
        logSuccess('aplicarCuentasComodin: bloque creado en ' + CC_COL_NOMBRE + ':' + CC_COL_NOTA);
        _mostrarComodin('Cuentas comodin - aplicado', detalle);
        return { ok: true, detalle: detalle };
    } catch (e) {
        logError('aplicarCuentasComodin', e);
        _mostrarComodin('Cuentas comodin - error', String(e && e.message ? e.message : e));
        return { ok: false, error: String(e && e.message ? e.message : e) };
    }
}

/**
 * Deshace la corrida: borra el bloque, repone la formula de la consolidada y muestra de
 * nuevo las columnas. No usa el respaldo a valores para la consolidada, por lo dicho arriba.
 * @returns {{ok:boolean, detalle?:string, error?:string}}
 */
function revertirCuentasComodin() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
        if (!hojaPC) throw new Error('No existe la hoja "' + SHEETS.PLAN_CUENTAS + '".');
        const props = PropertiesService.getDocumentProperties();
        const formulaPrevia = props.getProperty(CC_PROP_FORMULA_R);

        const colNombre = columnLetterToIndex(CC_COL_NOMBRE);
        hojaPC.showColumns(colNombre, 2);
        hojaPC.getRange(CC_FILA_TITULO, colNombre,
            hojaPC.getMaxRows() - CC_FILA_TITULO + 1, 2).clear();

        let repuesta = false;
        if (formulaPrevia) {
            const colCons = columnLetterToIndex(_colConsolidadaComodin());
            hojaPC.getRange(DATA_START_ROW, colCons).setFormula(formulaPrevia);
            repuesta = true;
        }
        SpreadsheetApp.flush();

        props.deleteProperty(CC_PROP_FORMULA_R);
        const nombreRespaldo = props.getProperty(CC_PROP_RESPALDO);

        const l = [];
        l.push('BLOQUE REVERTIDO.');
        l.push('  Columnas ' + CC_COL_NOMBRE + ':' + CC_COL_NOTA + ' vaciadas y visibles de nuevo.');
        l.push(repuesta
            ? '  La formula de la consolidada quedo como estaba antes.'
            : '  ATENCION: no habia formula previa guardada; la consolidada NO se toco.');
        if (nombreRespaldo) l.push('  El respaldo "' + nombreRespaldo + '" se conserva.');
        const detalle = l.join('\n');
        logSuccess('revertirCuentasComodin: bloque revertido.');
        _mostrarComodin('Cuentas comodin - revertido', detalle);
        return { ok: true, detalle: detalle };
    } catch (e) {
        logError('revertirCuentasComodin', e);
        _mostrarComodin('Cuentas comodin - error', String(e && e.message ? e.message : e));
        return { ok: false, error: String(e && e.message ? e.message : e) };
    }
}

// ============================================
// PRIVADAS
// ============================================

/** La columna de la consolidada, desde el SSOT si existe y con el fallback medido. */
function _colConsolidadaComodin() {
    if (typeof RANGES === 'object' && RANGES.PLAN_CONSOLIDADA &&
        RANGES.PLAN_CONSOLIDADA.columns && RANGES.PLAN_CONSOLIDADA.columns.nombre) {
        return RANGES.PLAN_CONSOLIDADA.columns.nombre;
    }
    // Medido el 2026-08-24: la consolidada vive en R, no en S. La movio la limpieza que
    // borro la columna Q (DEVTOOL_LimpiarPlanCuentas.js, LPC_COL_CONSOLIDADA = 'R').
    return 'R';
}

/**
 * Lee la planilla y arma el plan. NO escribe.
 * @returns {Object}
 */
function _planCuentasComodin(ss) {
    const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    if (!hojaPC) throw new Error('No existe la hoja "' + SHEETS.PLAN_CUENTAS + '".');
    if (!Array.isArray(CUENTAS_NEUTRAS) || !CUENTAS_NEUTRAS.length) {
        throw new Error('CUENTAS_NEUTRAS esta vacia en 00_Config.js: no hay nada que dar de alta.');
    }

    // Preflight POR ROTULO, no por coordenada: una posicion se pudre sin avisar, un rotulo no.
    // Esta es la cicatriz del 2026-08-20, cuando el gemelo tenia el layout viejo y se escribio
    // en celdas equivocadas sin que nada fallara.
    const cfgModelo = RANGES[CC_BLOQUE_MODELO];
    const colModelo = columnLetterToIndex(cfgModelo.columns.nombre);
    const tituloModelo = String(hojaPC.getRange(CC_FILA_TITULO, colModelo).getValue() || '').trim();
    if (!tituloModelo) {
        throw new Error('El bloque modelo "' + CC_BLOQUE_MODELO + '" no tiene titulo en ' +
            cfgModelo.columns.nombre + CC_FILA_TITULO + '. La hoja no tiene la geometria esperada: ' +
            'no se escribe nada.');
    }

    const colNombre = columnLetterToIndex(CC_COL_NOMBRE);
    const colNota = columnLetterToIndex(CC_COL_NOTA);

    // El destino tiene que estar libre, o ser un bloque nuestro de una corrida anterior.
    const tituloDestino = String(hojaPC.getRange(CC_FILA_TITULO, colNombre).getValue() || '').trim();
    const yaAplicado = (tituloDestino === CC_TITULO);
    if (tituloDestino && !yaAplicado) {
        throw new Error('La celda ' + CC_COL_NOMBRE + CC_FILA_TITULO + ' ya dice "' + tituloDestino +
            '" y no es este bloque. Alguien ocupo la columna: no se pisa nada.');
    }

    const alto = hojaPC.getMaxRows() - DATA_START_ROW + 1;
    const enHoja = [];
    if (alto > 0) {
        hojaPC.getRange(DATA_START_ROW, colNombre, alto, 1).getValues().forEach(function (f) {
            const v = String(f[0] || '').trim();
            if (v) enHoja.push(v);
        });
    }
    // La columna de notas tampoco puede estar ocupada por otra cosa.
    const notaHeader = String(hojaPC.getRange(HEADER_ROW, colNota).getValue() || '').trim();
    if (notaHeader && notaHeader !== CC_HEADER_NOTA) {
        throw new Error('La celda ' + CC_COL_NOTA + HEADER_ROW + ' ya dice "' + notaHeader +
            '". No se pisa nada.');
    }

    const faltantes = CUENTAS_NEUTRAS.filter(function (n) { return enHoja.indexOf(n) === -1; });
    const sobrantes = enHoja.filter(function (n) { return CUENTAS_NEUTRAS.indexOf(n) === -1; });

    // --- La consolidada ---
    const colCons = _colConsolidadaComodin();
    const celdaCons = hojaPC.getRange(DATA_START_ROW, columnLetterToIndex(colCons));
    const formula = String(celdaCons.getFormula() || '');
    const rangoNuevo = CC_COL_NOMBRE + DATA_START_ROW + ':' + CC_COL_NOMBRE;
    let formulaNueva = null;
    let yaIncluye = false;

    if (formula) {
        // Se detecta el rango del ULTIMO bloque que la formula ya aplana y se le agrega el
        // nuestro al lado, con el separador que la propia formula usa. No se reescribe la
        // formula entera: el separador de argumentos depende del locale de la planilla
        // (aca es ";") y una formula rearmada a mano es la forma barata de romper el
        // desplegable de Cargas, que es lo unico que la consume.
        const mBloques = formula.match(/([A-Z]+)(\d+):\1(\d+)/g);
        if (mBloques && mBloques.length) {
            const ultimo = mBloques[mBloques.length - 1];
            const sep = _separadorFormulaComodin(formula, mBloques);
            const tope = ultimo.match(/:[A-Z]+(\d+)$/);
            const rangoConTope = tope
                ? CC_COL_NOMBRE + DATA_START_ROW + ':' + CC_COL_NOMBRE + tope[1]
                : rangoNuevo;
            yaIncluye = formula.indexOf(CC_COL_NOMBRE + DATA_START_ROW + ':' + CC_COL_NOMBRE) !== -1;
            if (!yaIncluye) {
                formulaNueva = formula.replace(ultimo, ultimo + sep + rangoConTope);
            }
        }
    }

    return {
        hojaPC: hojaPC,
        yaAplicado: yaAplicado,
        filasEnHoja: enHoja.length,
        faltantes: faltantes,
        sobrantes: sobrantes,
        colConsolidada: colCons,
        formulaConsolidada: formula,
        formulaConsolidadaNueva: formulaNueva,
        consolidadaYaIncluye: yaIncluye
    };
}

/**
 * El separador de argumentos que usa ESTA formula, leido de ella misma.
 *
 * La planilla esta en espanol y usa ";", pero getFormula() puede devolver "," segun como se
 * escribio la celda. Adivinarlo es exactamente el error que la cabecera de
 * 07_MiradaInteranual.js documenta. Se mira el caracter real que separa dos rangos que la
 * formula ya tiene.
 */
function _separadorFormulaComodin(formula, bloques) {
    if (bloques.length >= 2) {
        const i = formula.indexOf(bloques[0]) + bloques[0].length;
        const j = formula.indexOf(bloques[1], i);
        const entre = formula.substring(i, j).trim();
        if (entre === ';' || entre === ',') return entre;
    }
    return ';';
}

/** Copia al bloque nuevo el formato del bloque modelo, sin hardcodear un solo color. */
function _copiarFormatoBloqueComodin(hojaPC, colNombre, colNota) {
    const cfgModelo = RANGES[CC_BLOQUE_MODELO];
    const colModelo = columnLetterToIndex(cfgModelo.columns.nombre);
    const colModeloNota = columnLetterToIndex(cfgModelo.columns.proyecto || cfgModelo.columns.nombre);

    hojaPC.getRange(CC_FILA_TITULO, colModelo)
        .copyTo(hojaPC.getRange(CC_FILA_TITULO, colNombre),
            SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    hojaPC.getRange(HEADER_ROW, colModelo)
        .copyTo(hojaPC.getRange(HEADER_ROW, colNombre),
            SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    hojaPC.getRange(HEADER_ROW, colModeloNota)
        .copyTo(hojaPC.getRange(HEADER_ROW, colNota),
            SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

    // El cuerpo hereda el formato de la primera fila de datos del bloque modelo.
    const filas = Math.max(CUENTAS_NEUTRAS.length, 1);
    hojaPC.getRange(DATA_START_ROW, colModelo)
        .copyTo(hojaPC.getRange(DATA_START_ROW, colNombre, filas, 1),
            SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    hojaPC.getRange(DATA_START_ROW, colModeloNota)
        .copyTo(hojaPC.getRange(DATA_START_ROW, colNota, filas, 1),
            SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
}

/**
 * Relee la hoja y devuelve los problemas encontrados. Lista vacia = todo bien.
 *
 * Se compara el VALOR leido de vuelta, no el texto que se creyo escribir: una celda
 * combinada se traga la escritura sin lanzar excepcion, y una formula que no parsea deja la
 * celda vacia sin error visible. Las dos cosas ya pasaron en este repo.
 */
function _verificarComodin(hojaPC, colCons) {
    const problemas = [];
    const colNombre = columnLetterToIndex(CC_COL_NOMBRE);

    const titulo = String(hojaPC.getRange(CC_FILA_TITULO, colNombre).getValue() || '').trim();
    if (titulo !== CC_TITULO) {
        problemas.push('el titulo quedo como "' + titulo + '" y no como "' + CC_TITULO +
            '" (celda combinada o protegida?)');
    }

    const leidas = hojaPC.getRange(DATA_START_ROW, colNombre, CUENTAS_NEUTRAS.length, 1)
        .getValues().map(function (f) { return String(f[0] || '').trim(); });
    CUENTAS_NEUTRAS.forEach(function (esperada, i) {
        if (leidas[i] !== esperada) {
            problemas.push('la fila ' + (DATA_START_ROW + i) + ' quedo con "' + leidas[i] +
                '" y no con "' + esperada + '"');
        }
    });

    // La consolidada: se comprueba que las cuentas comodin APAREZCAN en su derrame. Verificar
    // el texto de la formula no probaria nada -- una formula puede estar escrita y no derramar.
    const colConsIdx = columnLetterToIndex(colCons);
    const altoCons = hojaPC.getMaxRows() - DATA_START_ROW + 1;
    if (altoCons > 0) {
        const derrame = hojaPC.getRange(DATA_START_ROW, colConsIdx, altoCons, 1).getValues()
            .map(function (f) { return String(f[0] || '').trim(); });
        if (derrame.filter(function (v) { return v !== ''; }).length === 0) {
            problemas.push('la consolidada ' + colCons + ' quedo VACIA: la formula no derrama. ' +
                'Sin ella el desplegable de Cuenta de "' + SHEETS.DATA_ENTRY + '" se queda sin lista.');
        } else {
            CUENTAS_NEUTRAS.forEach(function (n) {
                if (derrame.indexOf(n) === -1) {
                    problemas.push('"' + n + '" no aparece en la consolidada ' + colCons +
                        ': el desplegable no la va a ofrecer');
                }
            });
        }
    }
    return problemas;
}

/** Deshace lo escrito en ESTA corrida. Se llama solo cuando la verificacion fallo. */
function _revertirEscrituraComodin(ss, hojaPC, plan) {
    try {
        const colNombre = columnLetterToIndex(CC_COL_NOMBRE);
        hojaPC.getRange(CC_FILA_TITULO, colNombre,
            hojaPC.getMaxRows() - CC_FILA_TITULO + 1, 2).clear();
        if (plan.formulaConsolidada) {
            hojaPC.getRange(DATA_START_ROW, columnLetterToIndex(plan.colConsolidada))
                .setFormula(plan.formulaConsolidada);
        }
        SpreadsheetApp.flush();
        logInfo('_revertirEscrituraComodin: se deshizo la escritura de esta corrida.');
    } catch (e) {
        logError('_revertirEscrituraComodin: la reversa automatica fallo', e);
    }
}

/** Sello de tiempo para el nombre del respaldo. */
function _selloComodin() {
    return Utilities.formatDate(new Date(),
        Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
}

/** Muestra el resultado si hay UI; si corre sin planilla activa, solo loguea. */
function _mostrarComodin(titulo, mensaje) {
    try {
        SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
        Logger.log(titulo + '\n' + mensaje);
    }
}
