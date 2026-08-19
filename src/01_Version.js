/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 *
 * @version 0.11.1
 * @since 0.1.0
 * @lastModified 2026-08-18
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 15,
 patch: 0,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-08-19',
 releaseName: 'v0.15.0 - Saldos bancarios reales, capitalizacion como residuo, alta de cuentas',

 /**
 * Changelog embebido (solo refleja el release vigente).
 * FUENTE DE VERDAD del historial completo: src/ZZ_Changelog.js
 * Formato: Semantic Versioning
 * + Agregado
 * * Mejorado
 * - Corregido
 * ! Breaking change
 */
 changelog: `
v0.15.0 (2026-08-19) - Saldos bancarios reales
! EL SALDO EXIGE QUE EL MEDIO EXISTA EN EL PLAN. La v0.14 clasificaba por "el tipo de categoria no es de riqueza", condicion que un medio inexistente cumple: las 39 filas sin medio valido ($2.147.186) caian enteras en el saldo cotidiano. Franco lo vio de una. De los $2.574.778 que mostraba, $2.407.180 eran filas sin medio. El saldo real de las cuentas es $517.658 (ARS: cotidiano $427.591 + riqueza $90.067; USD: -434,41).
! FUERA la fila "Flujo Cotidiano" (decision Franco: "no es una categoria definida"). La Capacidad de Capitalizacion pasa a ser el RESIDUO: Ingresos - Gastos Fijos - Gastos Variables. Los tres buckets reparten el 100% por construccion.
+ Tablero!C18 pasa a mostrar el SALDO ACTUAL de cada cuenta bancaria con su moneda, sobre todo el historico. Antes sumaba solo el mes seleccionado, asi que nunca era un saldo.
+ DEVTOOL_AltaCuentas: da de alta las 12 cuentas que el ledger usa y el catalogo no tiene (111 movimientos), entre ellas 'Ajuste' con 70. Once traen su tipo declarado por el propio ledger de forma unanime; 'Ajuste' no tiene tipo en ninguna fila y se ubica en Ingresos por decision declarada.
- "Frasco transitorio USD" NO EXISTE: ni en el ledger ni en el catalogo. El unico parecido es "Frasco Transitorio NaranjaX", que es ARS y apunta a Meta de Ahorro 1. El total USD del ledger es -434,41 y esta enteramente en medios de riqueza.

v0.14.1 (2026-08-19) - Los dos defectos que abortaron la corrida de v0.14.0
- COMILLAS DE MAS: se escribia 'Registros'!B7:B y Sheets lo guarda como Registros!B7:B, porque el nombre no necesita comillas. La verificacion comparaba texto contra texto, no coincidia, y revertia diez formulas CORRECTAS. En la planilla viva hay 256 referencias sin comillas y cero con comillas: la evidencia estaba a la vista y no la mire. Ahora el nombre se entrecomilla solo si lo necesita (_refHoja) y la comparacion canonicaliza ambos lados.
- VARIABLE LET QUE CHOCA CON UNA FUNCION: Tablero!L29 usaba 'n' como nombre de variable y N() es una funcion de Sheets, asi que la formula entera no parseaba y la celda quedaba sin nada. Pasa a llamarse 'cantidad' y 'monto_total'.
+ El banco de pruebas rechaza las dos clases de error, y ademas toda variable LET de una o dos letras. Verificado que los guards DISPARAN reproduciendo los bugs viejos: un guard que no salta es peor que no tenerlo.
+ Preflight: detecta celdas combinadas con isPartOfMerge(). Una celda que es parte de un merge sin ser su ancla se lee vacia y se deja escribir, pero lo escrito no queda.
NOTA: la corrida fallida NO dejo dano. La reversion del lote funciono como debia y las 21 celdas volvieron a su formula previa.

v0.14.0 (2026-08-19) - Stock y flujo separados
! Los SALDOS dejan de filtrarse por mes: leen el ledger entero y muestran siempre el saldo actual. Los MOVIMIENTOS siguen filtrados por mes. Es la diferencia entre un balance y un estado de resultados; mezclarlas era lo que estaba roto.
! Los asientos "Inicio Mes" dejan de tener efecto en toda la planilla. NO se borran: quedan como historia, pero ninguna formula los mira. Hacian dos trabajos a la vez -- saldo de apertura (redundante) y ajuste de conciliacion (legitimo) -- y por eso sumar el historico daba $10.153.852 contra $884.860 de saldo real.
- Los Ingresos del mes BAJAN: la clausula "(Col1 <> 'Inicio Mes' OR Col5 = 'Hogar')" dejaba entrar los arrastres de las cuentas de casa al bucket de ingresos. Se apaga en las seis formulas que la tenian.
+ Fila 20 del Tablero: "Flujo Cotidiano", el termino que le faltaba al bloque. N16 = N17 + N18 + N19 + N20. O16 pasa a sumar cuatro filas.
+ Tablero!L29: indicador de movimientos sin clasificar. Le pone nombre y numero a lo que le falte al 100% en vez de disimularlo -- son 116 movimientos (36 sin medio, 70 de cuenta 'Ajuste', 10 sin cuenta).
+ devtools/probar_stock_flujo.js: banco de pruebas de las formulas nuevas antes de desplegar.

v0.13.0 (2026-08-19) - Riqueza por lista blanca
! CAMBIO DE DEFINICION (decision Franco): riqueza deja de ser "todo lo que no sea Hogar" y pasa a ser la lista blanca TIPOS_RIQUEZA = Ahorros + Inversiones. La Financiacion (tarjetas y prestamos) SALE del patrimonio: una tarjeta es un pasivo, no capital.
+ TIPOS_RIQUEZA en 00_Config.js: la regla de negocio en el SSOT y no repartida por seis formulas. Con lista negra, cualquier tipo nuevo entraba a riqueza por el solo hecho de no llamarse Hogar.
+ DEVTOOL_RiquezaYCategorias: trio estado / aplicar / revertir. Toca SEIS celdas (Inicio!F8, Tablero!N19 y AG9:AG12) y deja intactas las DIEZ que preguntan por flujo cotidiano.
+ La columna del Tipo del bloque de categorias (Tablero!AB, cuyo rotulo AB8 ya decia "Tipo") deja de estar vacia: trae el tipo de cada categoria desde el catalogo. Y el bloque deja de ocultar las de tipo Hogar, que era lo que impedia leerlo como macrosegmentacion.
+ devtools/probar_riqueza.js: banco de pruebas contra las formulas reales del gemelo antes de desplegar.

v0.12.1 (2026-08-19) - Reparar la reparacion
- BUG PROPIO: la v0.12.0 escribio en produccion tres formulas que NO PARSEAN. En _reponerReferencias, el string de reemplazo '$1$N$17' se expande como grupo1 + "$N" + grupo1 + "7": escribio "$N$10 - $N$N$10 - 7". O23/O24/O25 pasaron de #REF! a #ERROR!, o sea PEOR que antes.
- Todos los reemplazos pasan a ir por FUNCION de reemplazo: el valor devuelto se inserta tal cual y esta clase de bug deja de ser posible.
- El modulo repara ademas el artefacto "$N$N$10 - 7" que aquella corrida dejo escrito; sin eso, re-correr Aplicar contestaria "nada que hacer" con tres celdas rotas.
! El verificador ahora LEE EL VALOR de cada celda escrita y revierte el lote entero si alguna queda en error. Antes solo comparaba texto, y por eso el texto corrupto paso sus cuatro pruebas: cicatriz 5 cometida por el modulo que la cita.
+ devtools/probar_formulerio.js: corre las transformaciones reales contra las formulas reales del gemelo antes de desplegar. Habria cortado el bug en diez segundos.
+ SEXTO DEFECTO reparado: "Inicio"!AF8 y AT8 ("Valor en X") leian la moneda de la columna de CUENTA en vez de la de MONEDA, asi que nunca convertian: todo movimiento en moneda extranjera entraba a C13/F13/C15/F15 a valor nominal (junio 2026: ~$376.740 de ingreso desaparecido, el 23% del mes). AT8 tomaba ademas la moneda de destino de Y13, una CELDA DE DATOS, en vez del selector G4.

v0.12.0 (2026-08-19) - Formulerio reparado
+ DEVTOOL_FormulerioV0111: repara los cuatro defectos que el swap v0.11 dejo en las formulas de "Inicio" y "Tablero". Trio estado / aplicar / revertir, con respaldo congelado y verificado.
- Anclas corridas: quince formulas del Tablero pedian AK9:AK / AO9:AO / AR9:AR mientras el motor (AJ6) derrama desde la fila 6. Cada monto se apareaba con el tipo, la moneda y la cotizacion del movimiento tres filas mas abajo. No daba error: daba otro numero.
- Selector de moneda: diecisiete #REF! en ocho celdas repuestos a $N$4 (y a N17/N18 los reales de fijos y variables). Con AV6 en #REF! toda la columna "Valor en ARS" devolvia cero y con ella el bloque "Movimientos del mes" entero.
- Bloque "Disponibilidad de fondos": estaba rotado una posicion respecto de sus rotulos. La formula de Capacidad de Ahorro vivia en la fila de Gastos Fijos. Se intercambian, no se reescriben.
- Tipo 'Liquidez' huerfano: catorce celdas comparaban contra un tipo de categoria que el Plan de Cuentas nuevo ya no tiene. Pasa a 'Hogar', su equivalente 1:1.
+ columnIndexToLetter en 03_SheetManager (inverso de columnLetterToIndex).

v0.11.1 (2026-08-18) - Armas descargadas
- fetchArsRate: fecha invalida o FUTURA lanza en vez de devolver la ultima cotizacion publicada.
- migrarBdAntigua / recalcularTcRegistros: sin cotizacion real se aborta todo-o-nada (fuera 1050/650/1100).
- recalcularTcRegistros: pide confirmacion nombrando cuantas filas pisa, saltea (sin blanquear) las filas sin fecha y acota el rango a la ultima fila con Fecha, no a getLastRow().
- MIGRACION v0.9.5: el guard de obsolescencia pasa a estar en TODA funcion que escribe, no solo en las publicas. La auditoria encontro que cuerpoRevertirV095_ se invocaba directo y pisaba Tipos de Cambio declarando exito.
! Privacidad real de plataforma: en Apps Script una funcion es privada si TERMINA en guion bajo, no si empieza. Las internas que escriben (v0.9.5, v0.11, v031) se renombraron con el guion bajo al final.
- Menu: salen Sincronizar / Aplicar / Revertir del swap v0.11 (ya aplicado); quedan Ver estado y Purgar. Revertir ahora exige confirmacion.
! procesarCargas: una sola fecha futura en la grilla aborta el LOTE COMPLETO sin escribir nada.

Historial completo y canónico en: src/ZZ_Changelog.js
 `
};

/**
 * Obtiene la versión actual del sistema
 * @returns {string} Versión formateada
 */
function getVersion() {
 return VERSION.toString();
}

/**
 * Obtiene el changelog completo
 * @returns {string} Historial de cambios
 */
function getChangelog() {
 return VERSION.changelog;
}

/**
 * Muestra información de versión en log
 */
function logVersionInfo() {
 Logger.log('='.repeat(50));
 Logger.log('Tidetrack Personal Finance - Apps Script');
 Logger.log(`Versión: ${getVersion()}`);
 Logger.log(`Release: ${VERSION.releaseName}`);
 Logger.log(`Fecha: ${VERSION.releaseDate}`);
 Logger.log('='.repeat(50));
}
