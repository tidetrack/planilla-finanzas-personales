/**
 * DEVTOOL_PresupuestoSembrar.js
 * Siembra K/O/S ("Monto a Proyectar", DISENO_HOJA_PRESUPUESTO.md) de la hoja "Presupuesto" con
 * lo que J/N/R ya muestran para el MODO vivo -- solo en las cuentas donde Franco todavia no
 * escribio nada a mano.
 *
 * [CONCEPTO DE NEGOCIO]
 * Pedido textual de Franco: "me agregas una funcion dev que te arme los valores de 'Monto a
 * proyectar' que sean iguales a la 'Proyeccion' del mes seleccionado?". El disparador concreto
 * fue estadoGuardarProyeccion() (DEVTOOL_PresupuestoGuardar.js) reportando "53 cuenta(s) con
 * Monto a Proyectar vacio": arrancar el presupuesto tipeando 53 numeros a mano, uno por uno, es
 * la friccion que este modulo saca del medio. En vez de eso, siembra K/O/S con lo que J/N/R YA
 * calculo (DEVTOOL_PresupuestoModo.js), y Franco corrige a mano solo las cuentas donde el
 * numero automatico no le sirve -- no las 53.
 *
 * LA CORRESPONDENCIA (verificada contra docs/permanente/DISENO_HOJA_PRESUPUESTO.md, seccion
 * "Que hay en cada columna", ANTES de escribir una linea de este modulo): J->K (Ingresos),
 * N->O (Gastos Fijos), R->S (Gastos Variables). Es exactamente _bloquesPc()[k].colModo ->
 * _bloquesPc()[k].colProyectar (DEVTOOL_PresupuestoResumen.js), asi que este modulo no retipea
 * la geometria: la LEE de ahi (ver "POR QUE NO SE DUPLICA LA GEOMETRIA" mas abajo).
 *
 * "Categorias" (U/V/W) queda AFUERA a proposito: V/W son un AGRUPADO por categoria (suma de
 * varias cuentas), no una cuenta individual con su propio "Monto a Proyectar" -- de hecho la
 * hoja no tiene una columna manual para Categorias en el mismo sentido que K/O/S. Sembrar ahi
 * no tiene equivalente 1:1 y no fue lo que Franco pidio.
 *
 * EL SELECTOR DE MODO MANDA, Y SE DICE EN VOZ ALTA (pedido explicito del encargo): J/N/R son
 * DINAMICAS (DEVTOOL_PresupuestoModo.js) -- en modo "Proyeccion" muestran el mes de referencia,
 * en modo "Historico" el promedio ponderado exponencial de 6 meses. Franco escribio "iguales a
 * la Proyeccion", pero si E7 esta en "Historico" al momento de correr este modulo, lo que se
 * copia NO es una proyeccion: es el historico ponderado. Este modulo NUNCA bloquea por eso (es
 * una eleccion legitima de Franco, no un error), pero tanto estadoPresupuestoSembrar() como
 * aplicarPresupuestoSembrar() lo anuncian EXPLICITO y en mayuscula cuando aplica, para que
 * nunca se copie una cosa por otra sin que quede dicho en la pantalla.
 *
 * NO PISA TRABAJO DE FRANCO (decision Franco 2026-08-25, tomada por mi -- appscript-backend --
 * dentro del encargo, que pedia explicitamente "decidi vos el default... justifica la decision
 * y dejala escrita inline"): el default, y la UNICA conducta de aplicarPresupuestoSembrar(), es
 * sembrar SOLO las celdas K/O/S que estan REALMENTE vacias. Una celda que ya tiene CUALQUIER
 * contenido (un numero tipeado, un cero, incluso texto raro) se cuenta como "llena" y NO se
 * toca -- ni siquiera si el valor sembrado seria identico. Por que este default y no el
 * opuesto: la hoja entera existe, segun su propio contrato, "para que Franco complete a mano...
 * con criterio en vez de a ojo" -- pisar una decision que YA tomo con un numero generado
 * automaticamente destruye exactamente el criterio que la hoja fue disenada para capturar. Un
 * modo "pisar tambien las llenas" queda deliberadamente FUERA de este encargo: no hay pedido
 * explicito de Franco para esa segunda accion, y agregarla sin que se pida es la clase de
 * superficie extra que despues alguien dispara sin querer. Si Franco la quiere, es un modulo
 * (o un parametro) aparte, a pedido.
 *
 * LA TRAMPA DE LA CELDA SPILL (advertencia explicita del encargo, y cicatriz REAL de este repo:
 * un SUMIF(rango;"<>") conto "" de un spill como celda llena y dio un total 2,8x inflado): una
 * celda J/N/R con la formula de _formulaMontoPm devuelve `IF($I9=""; ""; <numero>)` -- si la
 * cuenta existe pero por lo que sea la formula cae en la rama vacia, `getValues()` devuelve el
 * STRING "" y no un numero. Comparar eso contra '' con `!==` los distingue bien de un numero
 * real (0 es un numero real: `0 !== ''` es true), pero un chequeo ingenuo como "tiene contenido"
 * los confundiria. La condicion que este modulo usa para decidir si J/N/R trae un numero
 * sembrable -- `crudo !== '' && crudo !== null && isFinite(Number(crudo))` -- es la MISMA que ya
 * usa `_leerFilasPresupuestoPg` (DEVTOOL_PresupuestoGuardar.js) para leer K/O/S: se reusa el
 * criterio verbatim en vez de escribir una segunda version que pueda divergir.
 *
 * Consecuencia practica: una fila SIN nombre de cuenta (I/M/Q vacio) siempre tiene J/N/R = ""
 * (la formula lo garantiza) y se saltea sin mas -- pedido explicito del encargo ("Filas sin
 * nombre de cuenta: se saltean"). Una fila CON cuenta pero J/N/R invalido (no deberia pasar
 * nunca segun el diseno de _formulaMontoPm, salvo un #ERROR! de calculo) se trata como anomalia
 * real: aplicarPresupuestoSembrar() ABORTA sin escribir nada y nombra la celda exacta, en vez de
 * sembrar 89 cuentas bien y una mal en silencio.
 *
 * ESCRIBE VALORES, NUNCA FORMULAS (pedido explicito del encargo): K/O/S son la columna que
 * Franco edita a mano; una formula ahi se rompe apenas la toca. Cada celda sembrada usa
 * `setValue(numero)`, jamas `setFormula(...)`.
 *
 * RESPALDO PARA REVERTIR, MAS PROTECTOR QUE EL PATRON DE LOS HERMANOS (decision Franco
 * 2026-08-25, mia dentro del encargo): en DEVTOOL_PresupuestoModo.js/Resumen.js, "revertir"
 * repone SIEMPRE el estado exacto que capturo en el momento de aplicar, sin mirar si algo
 * cambio despues -- correcto ahi, porque esas columnas (J/N/R, V/W) son 100% del sistema, nunca
 * datos que Franco tipeo el mismo. K/O/S es distinto: es la unica columna de la hoja que es
 * dato humano por definicion. Por eso revertirPresupuestoSembrar() NO limpia a ciegas: por cada
 * celda que este modulo sembro, relee su valor VIVO y la vacia solo si TODAVIA es exactamente
 * el numero que este modulo escribio. Si Franco la edito despues de sembrarla (la corrigio a
 * mano, que es justo el comportamiento que la hoja busca fomentar), revertir la DEJA COMO ESTA
 * y lo dice en el reporte -- nunca destruye una correccion manual posterior so pretexto de
 * "deshacer la corrida". Como el modulo nunca pisa una celda que ya tenia contenido (ver
 * arriba), el estado "previo" de TODA celda que este modulo pudo haber escrito es siempre vacio:
 * no hace falta un respaldo de formulas en una hoja oculta (la tecnica que si necesitan Modo y
 * Resumen, porque J7/N7/R7 podian tener un texto previo real) -- alcanza con recordar QUE celda
 * y QUE numero se escribio, en Document Properties.
 *
 * POR QUE NO SE DUPLICA LA GEOMETRIA (y por que ESTE archivo es el peligroso, no los otros):
 * PM_BLOQUES/PM_SELECTORES/PM_MODO/PM_CLAVES_BLOQUE/PM_FILA_INI/PM_FILA_FIN (DEVTOOL_Presupuesto
 * Modo.js) y _bloquesPc()/PC_TITULO_PROYECTAR (DEVTOOL_PresupuestoResumen.js) YA describen esta
 * geometria completa (colCuenta, colModo, colProyectar, banda de filas, rotulos). Repetirla en
 * un tercer lugar es la forma barata de que un dia describan tres cosas distintas. Pero Apps
 * Script no tiene modulos -- comparte un scope global, evaluado en ORDEN ALFABETICO de archivo
 * (sin filePushOrder en .clasp.json) -- y HOY, hace apenas una hora (ver ZZ_Changelog.js v0.50.1
 * y v0.50.0), DOS archivos de este mismo grupo tumbaron el proyecto ENTERO por exactamente este
 * motivo: un `const` de nivel superior que leia un simbolo de OTRO archivo que carga despues
 * ("DEVTOOL_PresupuestoGuardar.js hacia const PG_UMBRAL_IDENTIDAD = PM_UMBRAL_IDENTIDAD, y
 * DEVTOOL_PresupuestoModo.js -- la M -- carga DESPUES de la G"). Ese ReferenceError no rompe su
 * propio modulo: rompe TODAS las funciones personalizadas de la planilla (Inicio quedo con
 * #ERROR! en Saldo Actual). Este archivo ("...Sembrar", la S) carga alfabeticamente DESPUES de
 * Modo (M) y Resumen (R), asi que un `const` de nivel superior aca funcionaria HOY -- pero es
 * la MISMA bomba con la mecha mas larga: alcanza con que alguien renombre un archivo o inserte
 * uno nuevo para que la letra deje de alcanzar. Por eso NINGUNA constante de este archivo lee
 * PM_* o PC_* al cargar: cada funcion publica y cada helper los referencia RECIEN cuando se
 * INVOCA (dentro de un cuerpo de funcion), momento en el que Apps Script ya evaluo el proyecto
 * entero y todo simbolo existe sin importar el orden alfabetico. El unico costo es no poder usar
 * esos valores en un nombre de constante de este archivo; el beneficio es que este archivo no
 * puede ser el que tumbe la planilla la proxima vez que alguien reordene el repo.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: preflight por ROTULO (nunca por coordenada fija), verificacion del
 * VALOR final releido (nunca del texto que se creyo escribir), reversion completa y sin pisar
 * datos que no son del modulo. Patron estado/aplicar/revertir compartido por todos los DEVTOOL_*
 * de este repo (ver DEVTOOL_CuentasComodin.js para la version mas corta del mismo patron).
 *
 * QUE NO HACE
 * 1. NO toca J/N/R, la columna V/W, las tablas resumen ni "Guardar Proyeccion": son las cuatro
 *    piezas de la hoja que YA existen y este modulo solo LEE la primera.
 * 2. NO pisa una celda K/O/S que ya tiene contenido. Ver "NO PISA TRABAJO DE FRANCO" arriba.
 * 3. NO escribe formulas. Ver "ESCRIBE VALORES" arriba.
 * 4. NO toca el ledger, el Plan de Cuentas, la BD de Proyeccion, Inicio ni el Tablero.
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @see DEVTOOL_PresupuestoModo.js
 * @see DEVTOOL_PresupuestoResumen.js
 * @see DEVTOOL_PresupuestoGuardar.js
 * @version 0.51.0
 * @since 0.51.0
 * @lastModified 2026-08-25
 */

// ============================================
// CONSTANTES PROPIAS (sin leer PM_*/PC_* al cargar -- ver cabecera, "POR QUE NO SE DUPLICA")
// ============================================

const PS_UMBRAL_IDENTIDAD = 0.01;
const PS_PROP_PREVIOS = 'presupuesto_sembrar_previos';

// ============================================
// PREFLIGHT
// ============================================

/**
 * Verifica que "Presupuesto" sea la hoja que este modulo cree que es, ANTES de leer o escribir
 * una sola celda. Por ROTULO, como el resto del arnes. Todas las referencias a PM_* y PC_* van
 * ACA DENTRO (invocacion, no carga) a proposito: ver la cabecera del archivo.
 */
function _preflightPs(ss) {
    const nombre = SHEETS.PRESUPUESTO;
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) throw new Error('No existe la hoja "' + nombre + '".');

    const desvios = [];
    const vivoDe = function (celda) { return hoja.getRange(celda).getValue(); };
    const chequear = function (celda, esperado) {
        const vivo = vivoDe(celda);
        if (!_rotulosCompatibles(vivo, esperado)) {
            desvios.push(celda + ' dice "' + vivo + '" y se esperaba "' + esperado + '"');
        }
    };

    // --- El selector de Modo: rotulo y un valor reconocible ---
    chequear(PM_MODO.rotulo.celda, PM_MODO.rotulo.esperado);
    const modoVivo = String(vivoDe(PM_MODO.celda) || '').trim();
    const esProyeccion = _rotulosCompatibles(modoVivo, PM_MODO.proyeccion);
    const esHistorico = _rotulosCompatibles(modoVivo, PM_MODO.historico);
    if (!esProyeccion && !esHistorico) {
        desvios.push(PM_MODO.celda + ' dice "' + modoVivo + '", que no es "' + PM_MODO.proyeccion +
            '" ni "' + PM_MODO.historico + '"');
    }

    // --- Los tres bloques: titulo, rotulo "Cuenta" y el titulo de "Monto a Proyectar" ---
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const bPm = PM_BLOQUES[k];
        const bPc = _bloquesPc()[k];
        chequear(bPm.tituloBloque.celda, bPm.tituloBloque.esperado);
        chequear(bPm.rotuloCuenta.celda, bPm.rotuloCuenta.esperado);
        chequear(bPc.colProyectar + '7', PC_TITULO_PROYECTAR);
    });

    if (desvios.length) {
        throw new Error('La hoja "' + nombre + '" no es la que este modulo espera: ' + desvios.join('; ') +
            '. Hay que volver a medir antes de escribir. No se toco nada.');
    }

    // --- K/O/S (9-38) tienen que ser una zona de VALORES: si alguna celda ya tiene formula, ---
    // --- algo escribio ahi que no es Franco a mano y este modulo no sabe convivir con eso. ---
    const conFormula = [];
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const col = _bloquesPc()[k].colProyectar;
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            if (hoja.getRange(col + f).getFormula()) conFormula.push(col + f);
        }
    });
    if (conFormula.length) {
        throw new Error('Hay formulas en la zona de "Monto a Proyectar" (deberia ser solo valores ' +
            'tipeados a mano): ' + conFormula.slice(0, 8).join(', ') +
            (conFormula.length > 8 ? ' (y ' + (conFormula.length - 8) + ' mas)' : '') +
            '. No se toco nada.');
    }

    return { hoja: hoja, nombre: nombre, modoVivo: modoVivo, esHistorico: esHistorico };
}

// ============================================
// PLAN (solo lectura)
// ============================================

/**
 * Lee I/M/Q (cuenta), J/N/R (fuente segun el modo) y K/O/S (destino) para las 30 filas de los
 * tres bloques, y clasifica cada fila. No escribe nada. Aborta si encuentra una anomalia real
 * (cuenta con fuente invalida, ver cabecera "LA TRAMPA DE LA CELDA SPILL") -- eso SI corta el
 * plan entero, porque senala un #ERROR! upstream que sembrar igual tapa en vez de mostrar.
 */
function _planPs(pre) {
    const hoja = pre.hoja;
    const nFilas = PM_FILA_FIN - PM_FILA_INI + 1;

    const aSembrar = [];       // [{celda, bloque, fila, valor}]
    const yaLlenas = [];       // [{celda, bloque, fila, valorActual}]
    const fuenteInvalida = []; // [{celda, bloque, fila, crudo}]
    const porBloque = {};

    PM_CLAVES_BLOQUE.forEach(function (k) {
        const colCuenta = PM_BLOQUES[k].colCuenta;
        const colFuente = PM_BLOQUES[k].colMonto;         // J / N / R
        const colDestino = _bloquesPc()[k].colProyectar;     // K / O / S

        const cuentas = hoja.getRange(colCuenta + PM_FILA_INI + ':' + colCuenta + PM_FILA_FIN).getValues();
        const fuentes = hoja.getRange(colFuente + PM_FILA_INI + ':' + colFuente + PM_FILA_FIN).getValues();
        const destinos = hoja.getRange(colDestino + PM_FILA_INI + ':' + colDestino + PM_FILA_FIN).getValues();

        let vacias = 0, llenas = 0, sinCuenta = 0, invalidas = 0;

        for (let i = 0; i < nFilas; i++) {
            const fila = PM_FILA_INI + i;
            const cuenta = String(cuentas[i][0] || '').trim();
            if (!cuenta) { sinCuenta++; continue; }   // "Filas sin nombre de cuenta: se saltean"

            // LA TRAMPA: un spill "" no es un numero. Mismo criterio que _leerFilasPresupuestoPg
            // (DEVTOOL_PresupuestoGuardar.js) -- ver cabecera del archivo.
            const crudoFuente = fuentes[i][0];
            const fuenteEsNumero = crudoFuente !== '' && crudoFuente !== null && isFinite(Number(crudoFuente));
            if (!fuenteEsNumero) {
                invalidas++;
                fuenteInvalida.push({ celda: colFuente + fila, bloque: k, fila: fila, crudo: crudoFuente });
                continue;
            }

            const crudoDestino = destinos[i][0];
            const destinoTieneContenido = crudoDestino !== '' && crudoDestino !== null;

            if (destinoTieneContenido) {
                llenas++;
                yaLlenas.push({ celda: colDestino + fila, bloque: k, fila: fila, valorActual: crudoDestino });
            } else {
                vacias++;
                aSembrar.push({ celda: colDestino + fila, bloque: k, fila: fila, valor: Number(crudoFuente) });
            }
        }

        porBloque[k] = { vacias: vacias, llenas: llenas, sinCuenta: sinCuenta, invalidas: invalidas };
    });

    return {
        aSembrar: aSembrar, yaLlenas: yaLlenas, fuenteInvalida: fuenteInvalida, porBloque: porBloque
    };
}

/** Texto de una linea por bloque, reusado por estado y aplicar. */
function _lineaBloquePs(k, p) {
    const nombre = k === 'ingresos' ? 'Ingresos' : (k === 'fijos' ? 'Gastos Fijos' : 'Gastos Variables');
    return '  ' + nombre + ': ' + p.vacias + ' vacia(s) se llenan, ' + p.llenas +
        ' ya tenian valor (no se tocan), ' + p.sinCuenta + ' fila(s) sin cuenta (se saltean)' +
        (p.invalidas ? ', ' + p.invalidas + ' con fuente invalida' : '');
}

/** El anuncio del modo, en voz alta, reusado por estado y aplicar (ver cabecera del archivo). */
function _anuncioModoPs(pre) {
    if (pre.esHistorico) {
        return 'MODO VIVO: "' + pre.modoVivo + '" (Historico).\n' +
            'ATENCION: lo que se va a copiar a "Monto a Proyectar" NO es la Proyeccion del mes de ' +
            'referencia -- es el promedio ponderado exponencial de los ultimos 6 meses (Historico). ' +
            'Si lo que queres sembrar es la Proyeccion, cambia el selector de Modo (E7) a "' +
            PM_MODO.proyeccion + '" antes de aplicar.';
    }
    return 'MODO VIVO: "' + pre.modoVivo + '" (Proyeccion). Se copia el total del mes de referencia -- ' +
        'lo que Franco pidio.';
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: preflight + plan. No escribe nada. */
function estadoPresupuestoSembrar() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPs(ss);
        const plan = _planPs(pre);

        const l = ['PRESUPUESTO: SEMBRAR "MONTO A PROYECTAR" - ESTADO (no se escribio nada)', ''];
        l.push(_anuncioModoPs(pre));
        l.push('');

        const totalASembrar = plan.aSembrar.length;
        const totalLlenas = plan.yaLlenas.length;
        const totalInvalidas = plan.fuenteInvalida.length;

        if (!totalASembrar && !totalInvalidas) {
            l.push('NADA QUE HACER: no hay ninguna celda K/O/S vacia con una cuenta y un monto de ' +
                'origen validos (' + totalLlenas + ' ya tenian valor cargado a mano).');
        } else {
            l.push('CELDAS A SEMBRAR: ' + totalASembrar + ' (nunca pisa las ' + totalLlenas +
                ' que ya tienen contenido)');
            l.push('');
            l.push('POR BLOQUE:');
            PM_CLAVES_BLOQUE.forEach(function (k) { l.push(_lineaBloquePs(k, plan.porBloque[k])); });
        }

        if (totalInvalidas) {
            l.push('');
            l.push('ANOMALIA: ' + totalInvalidas + ' cuenta(s) con celda de origen que no es un numero ' +
                'valido (deberia serlo siempre que la cuenta existe -- revisar DEVTOOL_PresupuestoModo.js ' +
                'sobre esa fila antes de aplicar, "2. Aplicar" va a abortar por esto):');
            plan.fuenteInvalida.slice(0, 8).forEach(function (a) {
                l.push('  ' + a.celda + ' = ' + JSON.stringify(a.crudo));
            });
        }

        const detalle = l.join('\n');
        _mostrarPs('Presupuesto: sembrar Monto a Proyectar - estado', detalle);
        logInfo('estadoPresupuestoSembrar: ' + totalASembrar + ' celda(s) pendientes, ' +
            totalLlenas + ' ya llenas, ' + totalInvalidas + ' invalida(s).');
        return { ok: true, detalle: detalle };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPs('Presupuesto: sembrar Monto a Proyectar - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Siembra las celdas K/O/S vacias con el numero que J/N/R muestra para el modo vivo. Nunca pisa
 * una celda con contenido. Escribe VALORES (setValue), nunca formulas. Verifica releyendo cada
 * celda escrita y revierte la corrida entera si algo no coincide.
 */
function aplicarPresupuestoSembrar() {
    let ui = null, ss = null, hoja = null, escritas = [];
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarPresupuestoSembrar necesita UI (menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPs(ss);
        hoja = pre.hoja;
        const plan = _planPs(pre);

        if (plan.fuenteInvalida.length) {
            throw new Error(plan.fuenteInvalida.length + ' cuenta(s) tienen una celda de origen (J/N/R) ' +
                'que no es un numero valido, por ejemplo ' + plan.fuenteInvalida[0].celda + ' = ' +
                JSON.stringify(plan.fuenteInvalida[0].crudo) + '. No deberia pasar mientras la cuenta ' +
                'exista (revisar "Presupuesto: selector de Modo" en Tidetrack Dev). No se escribio nada.');
        }

        if (!plan.aSembrar.length) {
            const t = 'No hay ninguna celda K/O/S vacia con cuenta y monto de origen validos (' +
                plan.yaLlenas.length + ' ya tenian valor cargado a mano). No se escribio nada.';
            _mostrarPs('Presupuesto: sembrar Monto a Proyectar', t);
            return { ok: true, detalle: t };
        }

        const confirmacion = [
            'Se van a escribir ' + plan.aSembrar.length + ' celda(s) de "Monto a Proyectar" en "' +
            pre.nombre + '".', '',
            _anuncioModoPs(pre), '',
            'POR BLOQUE:'
        ];
        PM_CLAVES_BLOQUE.forEach(function (k) { confirmacion.push(_lineaBloquePs(k, plan.porBloque[k])); });
        confirmacion.push('');
        confirmacion.push('Las ' + plan.yaLlenas.length + ' celda(s) que ya tienen contenido NO se tocan ' +
            '(pisar una celda con dato es una accion aparte, no la de este modulo).');
        confirmacion.push('');
        confirmacion.push('Continuar?');

        const conf = ui.alert('Presupuesto: sembrar Monto a Proyectar', confirmacion.join('\n'), ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        plan.aSembrar.forEach(function (c) {
            hoja.getRange(c.celda).setValue(c.valor);
            escritas.push(c);
        });
        SpreadsheetApp.flush();

        // Verificacion: se relee el VALOR de vuelta, nunca se asume que setValue funciono.
        const fallas = [];
        escritas.forEach(function (c) {
            const releido = hoja.getRange(c.celda).getValue();
            if (typeof releido !== 'number' || !isFinite(releido) || Math.abs(releido - c.valor) >= PS_UMBRAL_IDENTIDAD) {
                fallas.push(c.celda + ' deberia ser ' + c.valor + ' y quedo ' + JSON.stringify(releido));
            }
        });

        if (fallas.length) {
            escritas.forEach(function (c) {
                try { hoja.getRange(c.celda).clearContent(); }
                catch (e2) { logError('No se pudo limpiar ' + c.celda + ' al revertir: ' + e2.message); }
            });
            SpreadsheetApp.flush();
            throw new Error('Se escribio pero NO VERIFICA: ' + fallas.join('; ') + '. Se vacio cada celda ' +
                'de esta corrida (todas partian de vacias, asi que revertir es limpiarlas).');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(PS_PROP_PREVIOS, JSON.stringify({
            sello: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm'),
            modoVivo: pre.modoVivo,
            celdas: escritas.map(function (c) { return { celda: c.celda, valor: c.valor }; })
        }));

        const l = ['PRESUPUESTO: "MONTO A PROYECTAR" SEMBRADO.', ''];
        l.push(_anuncioModoPs(pre));
        l.push('');
        l.push('Celdas escritas y verificadas: ' + escritas.length);
        l.push('Celdas que ya tenian contenido y NO se tocaron: ' + plan.yaLlenas.length);
        l.push('');
        l.push('Para deshacer: "3. Revertir" (Tidetrack Dev). Solo vacia las celdas que TODAVIA tengan');
        l.push('exactamente el numero que esta corrida escribio -- si corregiste alguna a mano despues,');
        l.push('revertir la deja como la dejaste, no la pisa.');
        const detalle = l.join('\n');

        logSuccess('aplicarPresupuestoSembrar: ' + escritas.length + ' celda(s) sembradas.');
        _mostrarPs('Presupuesto: sembrar Monto a Proyectar - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPs('Presupuesto: sembrar Monto a Proyectar - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Deshace la ultima corrida aplicada -- pero SOLO celda por celda que TODAVIA tenga exactamente
 * el numero que esa corrida escribio (ver cabecera del archivo, "RESPALDO PARA REVERTIR, MAS
 * PROTECTOR"). Una celda que Franco corrigio despues de sembrarla se queda como esta.
 */
function revertirPresupuestoSembrar() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const crudo = props.getProperty(PS_PROP_PREVIOS);
        if (!crudo) throw new Error('No hay ninguna corrida registrada de este modulo.');
        const previos = JSON.parse(crudo);

        const hoja = ss.getSheetByName(SHEETS.PRESUPUESTO);
        if (!hoja) throw new Error('No existe la hoja "' + SHEETS.PRESUPUESTO + '".');

        let vaciadas = 0;
        const dejadasComoEstan = [];
        (previos.celdas || []).forEach(function (c) {
            const rango = hoja.getRange(c.celda);
            const vivo = rango.getValue();
            const sigueIgual = typeof vivo === 'number' && isFinite(vivo) &&
                Math.abs(vivo - c.valor) < PS_UMBRAL_IDENTIDAD;
            if (sigueIgual) {
                rango.clearContent();
                vaciadas++;
            } else {
                dejadasComoEstan.push(c.celda);
            }
        });
        SpreadsheetApp.flush();
        props.deleteProperty(PS_PROP_PREVIOS);

        const l = ['PRESUPUESTO: "MONTO A PROYECTAR" REVERTIDO.', ''];
        l.push('Corrida original: modo "' + (previos.modoVivo || '?') + '", sello ' + (previos.sello || '?'));
        l.push('Celdas vaciadas: ' + vaciadas + ' de ' + (previos.celdas || []).length + ' sembradas.');
        if (dejadasComoEstan.length) {
            l.push('Celdas que Franco edito despues de sembrarlas y por eso NO se tocaron: ' +
                dejadasComoEstan.slice(0, 8).join(', ') +
                (dejadasComoEstan.length > 8 ? ' (y ' + (dejadasComoEstan.length - 8) + ' mas)' : ''));
        }
        const detalle = l.join('\n');
        logSuccess('revertirPresupuestoSembrar: ' + vaciadas + ' celda(s) vaciadas, ' +
            dejadasComoEstan.length + ' dejadas como estan.');
        _mostrarPs('Presupuesto: sembrar Monto a Proyectar - revertido', detalle);
        return { ok: true, detalle: detalle };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPs('Presupuesto: sembrar Monto a Proyectar - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarPs(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
