/**
 * DEVTOOL_PresupuestoSembrar.js
 * Siembra K/O/S ("Monto a Proyectar", DISENO_HOJA_PRESUPUESTO.md) de la hoja "Presupuesto" con
 * lo que J/N/R muestran AHORA MISMO para el MODO y el periodo vivos -- en TODAS las cuentas con
 * nombre y una fuente numerica valida, pise o no pise lo que K/O/S ya tenia.
 *
 * [CONCEPTO DE NEGOCIO]
 * Pedido textual de Franco (encargo original, 2026-08-25): "me agregas una funcion dev que te
 * arme los valores de 'Monto a proyectar' que sean iguales a la 'Proyeccion' del mes
 * seleccionado?". El disparador concreto fue estadoGuardarProyeccion() (DEVTOOL_Presupuesto
 * Guardar.js) reportando "53 cuenta(s) con Monto a Proyectar vacio": arrancar el presupuesto
 * tipeando 53 numeros a mano, uno por uno, es la friccion que este modulo saca del medio.
 *
 * SEGUNDO PEDIDO, EL MISMO DIA (fix de diseno sobre v0.51.0/v0.51.1, todavia sin desplegar): "Si
 * quiero volver a sembrar otro mes, no me deja porque ya hay datos. Esta funcion deberia poder
 * sembrar valores sin problemas." Ver "PISA, CON CONFIRMACION EXPLICITA" mas abajo para el
 * porque completo -- en una linea: K/O/S no son por mes, asi que "nunca pisar" volvia la
 * funcion util una sola vez en la vida.
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
 * ============================================================================
 * PISA, CON CONFIRMACION EXPLICITA (decision Franco 2026-08-25, tomada por mi --
 * appscript-backend -- sobre el propio analisis de Franco, que resulto correcto)
 * ============================================================================
 * v0.51.0/v0.51.1 (todavia sin desplegar) tenian la regla contraria: NUNCA pisar una celda K/O/S
 * con contenido. Parecia prudente. Era equivocada, por una razon ESTRUCTURAL y no de criterio:
 *
 * K/O/S NO SON POR MES. Son las MISMAS celdas de la hoja "Presupuesto" para CUALQUIER periodo
 * que elijas en J2/J3 -- a diferencia de J/N/R, que SI son dinamicas y cambian solas con el
 * selector (DEVTOOL_PresupuestoModo.js). Cambiar J2/J3 no mueve ni vacia K/O/S. Entonces, con la
 * regla vieja: la primera vez que Franco sembraba, las 90 celdas quedaban llenas PARA SIEMPRE, y
 * la proxima vez que quisiera sembrar para OTRO mes, "nunca pisar" significaba "no hacer nada".
 * La funcion servia exactamente una vez en la vida de la planilla -- el sintoma textual de
 * Franco: "no me deja porque ya hay datos".
 *
 * Y mas de fondo: la celda no tiene forma de decir de donde vino su contenido. Un "1000" en K9
 * puede ser (a) un numero que Franco tipeo el mes pasado a mano, con criterio, para ESE mes, (b)
 * el residuo de la ULTIMA vez que este mismo modulo sembro, para un mes que ya no es el
 * seleccionado, o (c) un numero que Franco efectivamente quiere conservar para el mes actual
 * porque coincide. Las tres se ven IDENTICAS desde `getValue()`. Tratar "tiene contenido" como
 * sinonimo de "es sagrado, no tocar" -- que es lo que hacia la regla vieja -- confundia
 * sistematicamente (b) con (a), y ahi es donde la herramienta se volvia inutil.
 *
 * LA CONDUCTA NUEVA: aplicarPresupuestoSembrar() escribe TODAS las filas que tengan nombre de
 * cuenta y una fuente J/N/R numerica valida -- pise o no pise lo que K/O/S ya tenia. "Sembrar" es
 * "traer el mes de referencia (o el historico ponderado) tal cual esta AHORA", y eso implica
 * reemplazar lo que hubiera antes, sea de donde sea que vino.
 *
 * EL SEGURO YA NO ES ABSTENERSE DE ESCRIBIR -- son DOS controles nuevos, en su lugar:
 *   1. estadoPresupuestoSembrar() separa, por bloque y en total, cuantas celdas estan REALMENTE
 *      vacias (se llenan sin drama) de cuantas YA TENIAN un valor y por lo tanto SE VAN A PISAR.
 *      Franco ve ese numero ANTES de decidir si corre "2. Aplicar".
 *   2. aplicarPresupuestoSembrar() pide una confirmacion EXPLICITA (mismo patron que
 *      DEVTOOL_PurgaRespaldos.js, la otra operacion deliberadamente destructiva de este repo)
 *      SOLO cuando hay algo que pisar -- la cuenta exacta de cuantas, el periodo que se esta
 *      sembrando (para que quede claro que no es una repeticion accidental del mismo mes) y el
 *      desglose por bloque. Si NO hay ninguna celda con contenido previo (primera siembra, o una
 *      hoja recien vaciada), corre derecho, sin dialogo -- pedirle a Franco que confirme una
 *      operacion que no pisa nada seria friccion sin beneficio.
 * Ver "RESPALDO PARA REVERTIR" mas abajo: el respaldo pasa a ser el seguro PRINCIPAL, no un
 * anexo -- ahora que la operacion destruye por diseno, revertir tiene que poder reponer el
 * estado exacto previo a la ultima corrida, sea ese estado "vacia" o "tenia tal numero".
 *
 * Un modo "preguntame antes de CADA celda" o "dejame elegir cuales pisar" queda deliberadamente
 * FUERA de este encargo: no hay pedido de Franco para esa granularidad, y agregarla sin que se
 * pida es la clase de superficie extra que despues alguien dispara sin querer.
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
 * criterio verbatim en vez de escribir una segunda version que pueda divergir. La trampa NO
 * aplica del lado de K/O/S: el preflight ya garantiza que esa zona es solo VALORES (ver abajo),
 * asi que un "" ahi es siempre un vacio real, nunca un spill.
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
 * ============================================================================
 * RESPALDO PARA REVERTIR -- AHORA EL SEGURO PRINCIPAL (decision Franco 2026-08-25)
 * ============================================================================
 * En v0.51.0 el respaldo era una comodidad: como la regla vieja NUNCA pisaba una celda con
 * contenido, el estado "previo" de CUALQUIER celda que el modulo pudiera escribir era siempre
 * vacio -- alcanzaba con recordar QUE celda y QUE numero se escribio, y revertir era limpiarla.
 *
 * Eso ya NO alcanza. Ahora que aplicar puede pisar una celda que tenia un numero real (el de
 * Franco, o el de una siembra anterior), revertir "vaciar" seria BORRAR ese numero en vez de
 * reponerlo -- exactamente el desastre que este modulo existe para evitar. Por eso cada celda
 * que esta corrida escribe guarda, ademas del numero que le puso, el VALOR CRUDO que tenia
 * ANTES de esta corrida (vacio, o el numero/texto que fuera) en Document Properties. Revertir
 * repone ESO -- vacia si estaba vacia, restablece el valor previo si tenia uno.
 *
 * La proteccion que YA tenia el modulo se conserva IDENTICA: revertirPresupuestoSembrar() releE
 * el valor VIVO de cada celda y SOLO la toca si TODAVIA es exactamente el numero que ESTA
 * corrida escribio. Si Franco la corrigio a mano despues de sembrarla -- el comportamiento que
 * la hoja busca fomentar -- revertir la DEJA COMO ESTA y lo dice en el reporte, nunca destruye
 * una correccion manual posterior so pretexto de "deshacer la corrida". Sigue siendo un undo de
 * UN SOLO NIVEL (la ultima corrida, no un historial completo) -- igual que sus hermanos
 * (DEVTOOL_PresupuestoModo.js/Resumen.js) -- pero ahora repone el numero exacto, no solo "vacio".
 *
 * COMPATIBILIDAD CON UN RESPALDO VIEJO (v0.51.0/v0.51.1, formato `{celda, valor}` sin `pisa` ni
 * `valorPrevio`): si Franco llega a correr "3. Revertir" con un respaldo que quedo grabado por el
 * codigo VIEJO (antes de este fix), ese formato es compatible: la regla vieja NUNCA pisaba, asi
 * que todo lo que grabo partia de vacio. revertirPresupuestoSembrar() lo detecta (falta
 * `valorPrevio`) y asume `pisa: false` -- vaciar es exactamente lo correcto para esos casos.
 *
 * POR QUE NO SE DUPLICA LA GEOMETRIA (y por que ESTE archivo es el peligroso, no los otros):
 * PM_BLOQUES/PM_SELECTORES/PM_MODO/PM_CLAVES_BLOQUE/PM_FILA_INI/PM_FILA_FIN (DEVTOOL_Presupuesto
 * Modo.js) y _bloquesPc()/PC_TITULO_PROYECTAR (DEVTOOL_PresupuestoResumen.js) YA describen esta
 * geometria completa (colCuenta, colModo, colProyectar, banda de filas, rotulos). Repetirla en
 * un tercer lugar es la forma barata de que un dia describan tres cosas distintas. Pero Apps
 * Script no tiene modulos -- comparte un scope global, evaluado en ORDEN ALFABETICO de archivo
 * (sin filePushOrder en .clasp.json) -- y en v0.50.0/v0.50.1 DOS archivos de este mismo grupo
 * tumbaron el proyecto ENTERO por exactamente este motivo: un `const` de nivel superior que leia
 * un simbolo de OTRO archivo que carga despues. Ese ReferenceError no rompe su propio modulo:
 * rompe TODAS las funciones personalizadas de la planilla (Inicio quedo con #ERROR! en Saldo
 * Actual). Este archivo ("...Sembrar", la S) carga alfabeticamente DESPUES de Modo (M) y Resumen
 * (R), asi que un `const` de nivel superior aca funcionaria HOY -- pero es la MISMA bomba con la
 * mecha mas larga: alcanza con que alguien renombre un archivo o inserte uno nuevo para que la
 * letra deje de alcanzar. Por eso NINGUNA constante de este archivo lee PM_* o PC_* al cargar:
 * cada funcion publica y cada helper los referencia RECIEN cuando se INVOCA (dentro de un cuerpo
 * de funcion), momento en el que Apps Script ya evaluo el proyecto entero y todo simbolo existe
 * sin importar el orden alfabetico. Esto incluye PM_SELECTORES, IP_MESES y
 * _mesRefDesdeSelectoresPm (usados solo por _periodoPs, agregada en este fix): tambien se leen
 * SOLO dentro de un cuerpo de funcion, nunca en una const de nivel superior de este archivo.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: preflight por ROTULO (nunca por coordenada fija), verificacion del
 * VALOR final releido (nunca del texto que se creyo escribir), reversion completa y sin pisar
 * datos que no son del modulo. Confirmacion explicita antes de una operacion destructiva: mismo
 * patron que DEVTOOL_PurgaRespaldos.js (numero exacto, desglose, "Continuar?").
 *
 * QUE NO HACE
 * 1. NO toca J/N/R, la columna V/W, las tablas resumen ni "Guardar Proyeccion": son las cuatro
 *    piezas de la hoja que YA existen y este modulo solo LEE la primera.
 * 2. NO escribe formulas. Ver "ESCRIBE VALORES" arriba.
 * 3. NO pide confirmacion cuando no hay ninguna celda con contenido previo (corre derecho): la
 *    friccion de un dialogo solo tiene sentido cuando hay algo real que se puede perder.
 * 4. NO toca el ledger, el Plan de Cuentas, la BD de Proyeccion, Inicio ni el Tablero.
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @see DEVTOOL_PresupuestoModo.js
 * @see DEVTOOL_PresupuestoResumen.js
 * @see DEVTOOL_PresupuestoGuardar.js
 * @see DEVTOOL_PurgaRespaldos.js (patron de confirmacion explicita reusado)
 * @version 0.51.2
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
 *
 * decision Franco 2026-08-25: TODA fila con cuenta y fuente valida entra en `aSembrar`, tenga o
 * no tenga K/O/S contenido previo -- ya no existe una lista aparte de "llenas, no se tocan". La
 * regla vieja era estructuralmente equivocada: K/O/S NO SON POR MES, son las MISMAS celdas para
 * cualquier periodo de J2/J3 (a diferencia de J/N/R, que si son dinamicas). Tratar "tiene
 * contenido" como "no tocar" volvia la funcion util una sola vez en la vida -- el sintoma
 * textual de Franco fue "no me deja porque ya hay datos". Y no hay forma de distinguir, desde la
 * celda, "esto lo decidio Franco para ESTE mes" de "esto quedo sembrado del mes pasado": las dos
 * se ven identicas. Cada fila lleva ahora `pisa` (si K/O/S ya tenia contenido) y `valorPrevio`
 * (el crudo que tenia, para que revertir pueda reponerlo exacto -- ver cabecera del archivo,
 * "RESPALDO PARA REVERTIR").
 */
function _planPs(pre) {
    const hoja = pre.hoja;
    const nFilas = PM_FILA_FIN - PM_FILA_INI + 1;

    const aSembrar = [];       // [{celda, bloque, fila, valor, pisa, valorPrevio}]
    const fuenteInvalida = []; // [{celda, bloque, fila, crudo}]
    const porBloque = {};

    PM_CLAVES_BLOQUE.forEach(function (k) {
        const colCuenta = PM_BLOQUES[k].colCuenta;
        const colFuente = PM_BLOQUES[k].colMonto;         // J / N / R
        const colDestino = _bloquesPc()[k].colProyectar;     // K / O / S

        const cuentas = hoja.getRange(colCuenta + PM_FILA_INI + ':' + colCuenta + PM_FILA_FIN).getValues();
        const fuentes = hoja.getRange(colFuente + PM_FILA_INI + ':' + colFuente + PM_FILA_FIN).getValues();
        const destinos = hoja.getRange(colDestino + PM_FILA_INI + ':' + colDestino + PM_FILA_FIN).getValues();

        let vacias = 0, pisa = 0, sinCuenta = 0, invalidas = 0;

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

            if (destinoTieneContenido) pisa++; else vacias++;

            aSembrar.push({
                celda: colDestino + fila, bloque: k, fila: fila,
                valor: Number(crudoFuente),
                pisa: destinoTieneContenido,
                valorPrevio: destinoTieneContenido ? crudoDestino : ''
            });
        }

        porBloque[k] = { vacias: vacias, pisa: pisa, sinCuenta: sinCuenta, invalidas: invalidas };
    });

    return { aSembrar: aSembrar, fuenteInvalida: fuenteInvalida, porBloque: porBloque };
}

/** Texto de una linea por bloque, reusado por estado y aplicar. */
function _lineaBloquePs(k, p) {
    const nombre = k === 'ingresos' ? 'Ingresos' : (k === 'fijos' ? 'Gastos Fijos' : 'Gastos Variables');
    return '  ' + nombre + ': ' + p.vacias + ' vacia(s) se llenan, ' + p.pisa +
        ' SE PISAN (ya tenian un valor), ' + p.sinCuenta + ' fila(s) sin cuenta (se saltean)' +
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

/**
 * Texto legible de QUE periodo esta mostrando J/N/R ahora mismo -- el que se va a copiar a
 * K/O/S. Agregada en este fix para que la confirmacion de pisado (ver aplicarPresupuestoSembrar)
 * diga "de que periodo se esta sembrando", no solo "cuantas celdas". Lee J2/J3 EN VIVO y calcula
 * el mes de referencia con _mesRefDesdeSelectoresPm (DEVTOOL_PresupuestoModo.js) -- referenciado
 * DENTRO del cuerpo de esta funcion, nunca en una const de nivel superior (ver cabecera del
 * archivo, "POR QUE NO SE DUPLICA LA GEOMETRIA").
 *
 * Si J2/J3 no se pueden interpretar (no deberia pasar: si estan mal, J/N/R ya estarian vacias y
 * el plan entero vendria sin nada que sembrar), esta funcion NO tira excepcion -- devuelve un
 * texto honesto en vez de romper el reporte por algo que es puramente informativo.
 */
function _periodoPs(pre) {
    const hoja = pre.hoja;
    const mesTexto = String(hoja.getRange(PM_SELECTORES.mes).getValue() || '').trim();
    const anioCrudo = hoja.getRange(PM_SELECTORES.anio).getValue();
    const anio = Number(anioCrudo);
    const mesRef = _mesRefDesdeSelectoresPm(mesTexto, anio);

    if (!mesRef) {
        return 'PERIODO: no se pudo interpretar el selector ' + PM_SELECTORES.mes + '/' +
            PM_SELECTORES.anio + ' ("' + mesTexto + '" / "' + anioCrudo + '").';
    }
    const meses = IP_MESES.split(',');
    return 'PERIODO: mes de referencia ' + meses[mesRef.getMonth()] + ' ' + mesRef.getFullYear() +
        ' (periodo presupuestado seleccionado en ' + PM_SELECTORES.mes + '/' + PM_SELECTORES.anio +
        ': ' + mesTexto + ' ' + anio + ').';
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
        l.push(_periodoPs(pre));
        l.push('');
        l.push(_anuncioModoPs(pre));
        l.push('');

        const totalVacias = plan.aSembrar.filter(function (c) { return !c.pisa; }).length;
        const totalPisa = plan.aSembrar.length - totalVacias;
        const totalASembrar = plan.aSembrar.length;
        const totalInvalidas = plan.fuenteInvalida.length;

        if (!totalASembrar && !totalInvalidas) {
            l.push('NADA QUE HACER: ninguna cuenta con nombre tiene un monto de origen (J/N/R) valido.');
        } else {
            l.push('CELDAS A SEMBRAR: ' + totalASembrar + ' -- ' + totalVacias + ' vacia(s) se llenan, ' +
                totalPisa + ' SE PISAN (ya tienen un valor cargado)');
            if (totalPisa) {
                l.push('"2. Aplicar" va a pedir CONFIRMACION EXPLICITA antes de pisar esas ' + totalPisa +
                    ' celda(s) (mismo patron que "Purgar respaldos").');
            }
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
        logInfo('estadoPresupuestoSembrar: ' + totalASembrar + ' celda(s) a sembrar (' + totalVacias +
            ' vacias, ' + totalPisa + ' pisan), ' + totalInvalidas + ' invalida(s).');
        return { ok: true, detalle: detalle };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPs('Presupuesto: sembrar Monto a Proyectar - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Siembra TODAS las celdas K/O/S que tengan cuenta y fuente J/N/R valida -- pisa o no pisa (ver
 * cabecera del archivo, "PISA, CON CONFIRMACION EXPLICITA"). Pide confirmacion explicita SOLO
 * cuando hay al menos una celda con contenido previo; si no hay ninguna, corre derecho. Escribe
 * VALORES (setValue), nunca formulas. Verifica releyendo cada celda escrita y revierte la
 * corrida entera al estado previo si algo no coincide.
 */
function aplicarPresupuestoSembrar() {
    let ui = null, ss = null, hoja = null, escritas = [];
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarPresupuestoSembrar necesita UI (menu tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPs(ss);
        hoja = pre.hoja;
        const plan = _planPs(pre);

        if (plan.fuenteInvalida.length) {
            throw new Error(plan.fuenteInvalida.length + ' cuenta(s) tienen una celda de origen (J/N/R) ' +
                'que no es un numero valido, por ejemplo ' + plan.fuenteInvalida[0].celda + ' = ' +
                JSON.stringify(plan.fuenteInvalida[0].crudo) + '. No deberia pasar mientras la cuenta ' +
                'exista (revisar "Presupuesto: selector de Modo" en tidetrack Dev). No se escribio nada.');
        }

        if (!plan.aSembrar.length) {
            const t = 'Ninguna cuenta con nombre tiene un monto de origen (J/N/R) valido. No se escribio nada.';
            _mostrarPs('Presupuesto: sembrar Monto a Proyectar', t);
            return { ok: true, detalle: t };
        }

        const aPisar = plan.aSembrar.filter(function (c) { return c.pisa; });
        const periodoTexto = _periodoPs(pre);

        // decision Franco 2026-08-25: confirmacion explicita SOLO si hay algo que pisar. K/O/S no
        // son por mes (ver cabecera): sembrar de nuevo para otro periodo va a pisar, por diseno,
        // lo que quedo del anterior -- Franco tiene que ver el numero exacto y el periodo antes de
        // confirmar. Si no hay nada que pisar (primera siembra, o todo esta vacio), no hay nada
        // real que perder: pedir confirmacion igual seria friccion sin beneficio.
        if (aPisar.length) {
            const confirmacion = [
                'Se van a escribir ' + plan.aSembrar.length + ' celda(s) de "Monto a Proyectar" en "' +
                pre.nombre + '", de las cuales ' + aPisar.length + ' SE VAN A PISAR (ya tienen un valor cargado).',
                '',
                'Motivo: "Monto a Proyectar" (K/O/S) no es una columna por mes -- son las MISMAS celdas',
                'para cualquier periodo que elijas en ' + PM_SELECTORES.mes + '/' + PM_SELECTORES.anio + '.',
                'Sembrar para otro periodo reemplaza lo que quedo sembrado del periodo anterior.',
                '', periodoTexto, '',
                _anuncioModoPs(pre), '',
                'POR BLOQUE:'
            ];
            PM_CLAVES_BLOQUE.forEach(function (k) { confirmacion.push(_lineaBloquePs(k, plan.porBloque[k])); });
            confirmacion.push('');
            confirmacion.push('Si alguna de esas celdas pisadas era un numero que Franco escribio a mano y');
            confirmacion.push('queres conservarlo, cancela y anotalo antes de aplicar: "3. Revertir" solo');
            confirmacion.push('repone el estado previo a la corrida MAS RECIENTE, no un historial completo.');
            confirmacion.push('');
            confirmacion.push('Corriste antes "1. Ver estado" y revisaste la lista completa?');
            confirmacion.push('');
            confirmacion.push('Continuar?');

            const conf = ui.alert(
                'Presupuesto: sembrar Monto a Proyectar -- SE VAN A PISAR ' + aPisar.length + ' CELDA(S)',
                confirmacion.join('\n'), ui.ButtonSet.YES_NO
            );
            if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };
        }

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
            // Reversion de TODO el lote al estado previo exacto de cada celda -- ya no "vaciar
            // todo" (eso solo era correcto cuando el estado previo era SIEMPRE vacio). Ver
            // cabecera, "RESPALDO PARA REVERTIR".
            escritas.forEach(function (c) {
                try {
                    if (c.pisa) hoja.getRange(c.celda).setValue(c.valorPrevio);
                    else hoja.getRange(c.celda).clearContent();
                } catch (e2) { logError('No se pudo reponer ' + c.celda + ' al revertir: ' + e2.message); }
            });
            SpreadsheetApp.flush();
            throw new Error('Se escribio pero NO VERIFICA: ' + fallas.join('; ') + '. Se repuso el estado ' +
                'previo de cada celda de esta corrida (vacia, o el valor que tenia antes).');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(PS_PROP_PREVIOS, JSON.stringify({
            sello: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm'),
            modoVivo: pre.modoVivo,
            celdas: escritas.map(function (c) {
                return { celda: c.celda, valorEscrito: c.valor, pisa: c.pisa, valorPrevio: c.valorPrevio };
            })
        }));

        const l = ['PRESUPUESTO: "MONTO A PROYECTAR" SEMBRADO.', ''];
        l.push(periodoTexto);
        l.push('');
        l.push(_anuncioModoPs(pre));
        l.push('');
        l.push('Celdas escritas y verificadas: ' + escritas.length);
        l.push('  vacias que se llenaron: ' + (escritas.length - aPisar.length));
        l.push('  con valor previo que SE PISARON: ' + aPisar.length);
        l.push('');
        l.push('Para deshacer: "3. Revertir" (tidetrack Dev). Repone EXACTAMENTE el estado previo a');
        l.push('esta corrida (vacia, o el valor que tenia antes) en cada celda que TODAVIA tenga el');
        l.push('numero que esta corrida escribio -- si corregiste alguna a mano despues, revertir la');
        l.push('deja como la dejaste, no la pisa.');
        const detalle = l.join('\n');

        logSuccess('aplicarPresupuestoSembrar: ' + escritas.length + ' celda(s) sembradas (' +
            aPisar.length + ' pisadas).');
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
 * el numero que esa corrida escribio (ver cabecera del archivo, "RESPALDO PARA REVERTIR"). Una
 * celda que Franco corrigio despues de sembrarla se queda como esta. Repone el estado previo
 * EXACTO: vacia si estaba vacia antes de esa corrida, o el valor que tenia si la corrida la piso.
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

        let restauradas = 0;
        const dejadasComoEstan = [];
        (previos.celdas || []).forEach(function (c) {
            // Compatibilidad con un respaldo grabado por el codigo VIEJO (v0.51.0/v0.51.1, formato
            // {celda, valor}, sin pisa/valorPrevio): esa version NUNCA pisaba, asi que todo lo que
            // grabo partia de vacio -- ver cabecera, "COMPATIBILIDAD CON UN RESPALDO VIEJO".
            const valorEscrito = (typeof c.valorEscrito === 'number') ? c.valorEscrito : c.valor;
            const pisaba = c.pisa === true;

            const rango = hoja.getRange(c.celda);
            const vivo = rango.getValue();
            const sigueIgual = typeof vivo === 'number' && isFinite(vivo) &&
                Math.abs(vivo - valorEscrito) < PS_UMBRAL_IDENTIDAD;
            if (sigueIgual) {
                if (pisaba) rango.setValue(c.valorPrevio);
                else rango.clearContent();
                restauradas++;
            } else {
                dejadasComoEstan.push(c.celda);
            }
        });
        SpreadsheetApp.flush();
        props.deleteProperty(PS_PROP_PREVIOS);

        const l = ['PRESUPUESTO: "MONTO A PROYECTAR" REVERTIDO.', ''];
        l.push('Corrida original: modo "' + (previos.modoVivo || '?') + '", sello ' + (previos.sello || '?'));
        l.push('Celdas repuestas a su estado previo: ' + restauradas + ' de ' + (previos.celdas || []).length + ' sembradas.');
        if (dejadasComoEstan.length) {
            l.push('Celdas que Franco edito despues de sembrarlas y por eso NO se tocaron: ' +
                dejadasComoEstan.slice(0, 8).join(', ') +
                (dejadasComoEstan.length > 8 ? ' (y ' + (dejadasComoEstan.length - 8) + ' mas)' : ''));
        }
        const detalle = l.join('\n');
        logSuccess('revertirPresupuestoSembrar: ' + restauradas + ' celda(s) repuestas, ' +
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
