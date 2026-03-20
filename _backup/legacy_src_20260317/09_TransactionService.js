/**
 * 09_TransactionService.js
 * Servicio CRUD para DB_TRANSACCIONES
 * Gestión de transacciones financieras (core del sistema)
 * 
 * @version 0.3.0
 * @since 0.3.0
 * @lastModified 2026-01-18
 */

// [AGILE-VALOR] Módulo base de Hoja de Cargas. Maneja registros simplificados con referencias al Plan de Cuentas.

// ============================================
// OPERACIONES DE LECTURA
// ============================================

/**
 * Obtiene todas las transacciones
 * @returns {Array<Object>} Array de transacciones
 */
function getAllTransacciones() {
 const data = getTableData('TRANSACCIONES');
 const colIndexes = getColumnIndexes('TRANSACCIONES');

 return data.map(row => ({
 trx_id: row[colIndexes.trx_id],
 fecha: row[colIndexes.fecha],
 monto: row[colIndexes.monto],
 moneda_id: row[colIndexes.moneda_id],
 sentido: row[colIndexes.sentido],
 cuenta_id: row[colIndexes.cuenta_id],
 medio_id: row[colIndexes.medio_id],
 nota: row[colIndexes.nota] || '',
 fx_id: row[colIndexes.fx_id] || '',
 monto_base: row[colIndexes.monto_base]
 }));
}

/**
 * Obtiene una transacción por ID
 * @param {string} trx_id ID de la transacción
 * @returns {Object|null} Objeto transacción o null
 */
function getTransaccionById(trx_id) {
 const result = findById('TRANSACCIONES', trx_id, 0);

 if (!result) {
 return null;
 }

 const colIndexes = getColumnIndexes('TRANSACCIONES');
 const row = result.rowData;

 return {
 trx_id: row[colIndexes.trx_id],
 fecha: row[colIndexes.fecha],
 monto: row[colIndexes.monto],
 moneda_id: row[colIndexes.moneda_id],
 sentido: row[colIndexes.sentido],
 cuenta_id: row[colIndexes.cuenta_id],
 medio_id: row[colIndexes.medio_id],
 nota: row[colIndexes.nota] || '',
 fx_id: row[colIndexes.fx_id] || '',
 monto_base: row[colIndexes.monto_base]
 };
}

/**
 * Filtra transacciones por sentido
 * @param {string} sentido 'Ingreso' o 'Egreso'
 * @returns {Array<Object>} Transacciones filtradas
 */
function getTransaccionesBySentido(sentido) {
 validateEnum(sentido, ENUM_SENTIDO, 'sentido');
 const all = getAllTransacciones();
 return all.filter(t => t.sentido === sentido);
}

/**
 * Filtra transacciones por rango de fechas
 * @param {Date|string} fechaDesde Fecha desde
 * @param {Date|string} fechaHasta Fecha hasta
 * @returns {Array<Object>} Transacciones filtradas
 */
function getTransaccionesByFechas(fechaDesde, fechaHasta) {
 const all = getAllTransacciones();
 const desde = new Date(fechaDesde);
 const hasta = new Date(fechaHasta);

 return all.filter(t => {
 const fecha = new Date(t.fecha);
 return fecha >= desde && fecha <= hasta;
 });
}

// ============================================
// OPERACIONES DE ESCRITURA
// ============================================

/**
 * Crea una nueva transacción
 * @param {Object} trx Objeto transacción
 * @returns {Object} Transacción creada
 */
function createTransaccion(trx) {
 // Obtener config para validación
 const config = getConfig();

 // Auto-generar ID si no existe
 if (!trx.trx_id) {
 trx.trx_id = generateNextId('TRANSACCIONES', 'TRX', 6);
 }

 // Formatear fecha
 if (!trx.fecha) {
 trx.fecha = getCurrentDate();
 }

 // Asegurar que nota existe
 if (!trx.nota) {
 trx.nota = '';
 }

 // Si la moneda es igual a la base, NO se requiere fx_id
 if (trx.moneda_id === config.base_moneda_id) {
 trx.fx_id = '';
 trx.monto_base = trx.monto;
 } else {
 // REGLA CRÍTICA: Para moneda extranjera, fx_id es OBLIGATORIO
 if (!trx.fx_id) {
 throw new Error(
 `fx_id es obligatorio para moneda extranjera.\n` +
 `Moneda de transacción: ${trx.moneda_id}\n` +
 `Moneda base: ${config.base_moneda_id}\n` +
 `Obtener fx_id con getLatestRate()`
 );
 }

 // Calcular monto_base usando el fx_id proporcionado
 trx.monto_base = calculateMontoBase(trx.monto, trx.moneda_id, trx.fx_id);
 }

 // Validar transacción completa
 validateTransaction(trx, config);

 // Lookup de nombres de cuenta y medio para columnas de visualización
 const cuenta = getCuentaById(trx.cuenta_id);
 const medio = getMedioPagoById(trx.medio_id);

 if (!cuenta) {
 throw new Error(`Cuenta no encontrada: ${trx.cuenta_id}`);
 }
 if (!medio) {
 throw new Error(`Medio de pago no encontrado: ${trx.medio_id}`);
 }

 // Convertir a array (12 columnas: 10 originales + 2 nuevas para nombres)
 const rowData = [
 trx.trx_id, // AD
 trx.fecha, // AE
 trx.monto, // AF
 trx.moneda_id, // AG
 trx.sentido, // AH
 trx.cuenta_id, // AI (ID - para código)
 trx.medio_id, // AJ (ID - para código)
 trx.nota, // AK
 trx.fx_id, // AL
 trx.monto_base, // AM
 cuenta.nombre_cuentas, // AN (NOMBRE - para visualización)
 medio.nombre_medio // AO (NOMBRE - para visualización)
 ];

 // Insertar
 appendRow('TRANSACCIONES', rowData);

 logSuccess(
 `Transacción creada: ${trx.trx_id} - ${trx.sentido} $${trx.monto} ${trx.moneda_id} ` +
 `(Base: $${trx.monto_base}) - Cuenta: ${cuenta.nombre_cuentas}, Medio: ${medio.nombre_medio}`
 );

 return trx;
}

/**
 * Actualiza una transacción existente
 * @param {string} trx_id ID de la transacción
 * @param {Object} data Datos a actualizar
 * @returns {Object} Transacción actualizada
 */
function updateTransaccion(trx_id, data) {
 const result = findById('TRANSACCIONES', trx_id, 0);

 if (!result) {
 throw new Error(`Transacción no encontrada: ${trx_id}`);
 }

 // Obtener config
 const config = getConfig();

 // Mantener el ID original
 data.trx_id = trx_id;

 // Recalcular monto_base si cambió moneda, monto o fx_id
 if (data.moneda_id === config.base_moneda_id) {
 data.fx_id = '';
 data.monto_base = data.monto;
 } else {
 if (!data.fx_id) {
 throw new Error('fx_id requerido para moneda extranjera en UPDATE');
 }
 data.monto_base = calculateMontoBase(data.monto, data.moneda_id, data.fx_id);
 }

 // Validar (indicar que es UPDATE para no verificar duplicados)
 validateTransaction(data, config, true);

 // Lookup de nombres de cuenta y medio para columnas de visualización
 const cuenta = getCuentaById(data.cuenta_id);
 const medio = getMedioPagoById(data.medio_id);

 if (!cuenta) {
 throw new Error(`Cuenta no encontrada: ${data.cuenta_id}`);
 }
 if (!medio) {
 throw new Error(`Medio de pago no encontrado: ${data.medio_id}`);
 }

 // Convertir a array (12 columnas: 10 originales + 2 nuevas para nombres)
 const rowData = [
 trx_id, // AD
 data.fecha, // AE
 data.monto, // AF
 data.moneda_id, // AG
 data.sentido, // AH
 data.cuenta_id, // AI (ID - para código)
 data.medio_id, // AJ (ID - para código)
 data.nota || '', // AK
 data.fx_id || '', // AL
 data.monto_base, // AM
 cuenta.nombre_cuentas, // AN (NOMBRE - para visualización)
 medio.nombre_medio // AO (NOMBRE - para visualización)
 ];

 updateRow('TRANSACCIONES', result.rowIndex, rowData);

 logSuccess(`Transacción actualizada: ${trx_id} - Cuenta: ${cuenta.nombre_cuentas}, Medio: ${medio.nombre_medio}`);

 return data;
}

/**
 * Elimina una transacción
 * @param {string} trx_id ID de la transacción
 */
function deleteTransaccion(trx_id) {
 const result = findById('TRANSACCIONES', trx_id, 0);

 if (!result) {
 throw new Error(`Transacción no encontrada: ${trx_id}`);
 }

 deleteRow('TRANSACCIONES', result.rowIndex);

 logSuccess(`Transacción eliminada: ${trx_id}`);
 showToast(`Transacción ${trx_id} eliminada`);
}

/**
 * Elimina TODAS las transacciones (para re-seed)
 * ️ CUIDADO: Esta operación es irreversible
 */
function clearAllTransacciones() {
 const sheet = getSheet();
 const range = getTableRange('TRANSACCIONES');

 // Obtener cuántas filas tienen datos
 const data = getTableData('TRANSACCIONES');

 if (data.length === 0) {
 logInfo('No hay transacciones para borrar');
 return;
 }

 // Borrar todas las filas de datos (mantener headers)
 const startRow = DATA_START_ROW;
 const numRows = data.length;

 // Limpiar el rango
 sheet.getRange('AD' + startRow + ':AM' + (startRow + numRows - 1)).clearContent();

 logSuccess(`${data.length} transacciones eliminadas`);
 showToast(`${data.length} transacciones borradas`, 'Clear Completo', 5);
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Calcula totales por sentido
 * @returns {Object} {ingresos: number, egresos: number, balance: number}
 */
function calcularTotales() {
 const transacciones = getAllTransacciones();

 const totales = {
 ingresos: 0,
 egresos: 0,
 balance: 0
 };

 transacciones.forEach(t => {
 if (t.sentido === 'Ingreso') {
 totales.ingresos += t.monto_base;
 } else if (t.sentido === 'Egreso') {
 totales.egresos += t.monto_base;
 }
 });

 totales.balance = totales.ingresos - totales.egresos;

 return totales;
}

/**
 * Obtiene resumen de transacciones
 * @returns {Object} Estadísticas
 */
function getResumenTransacciones() {
 const transacciones = getAllTransacciones();
 const totales = calcularTotales();

 return {
 total: transacciones.length,
 ingresos_count: transacciones.filter(t => t.sentido === 'Ingreso').length,
 egresos_count: transacciones.filter(t => t.sentido === 'Egreso').length,
 ingresos_monto: totales.ingresos,
 egresos_monto: totales.egresos,
 balance: totales.balance
 };
}
