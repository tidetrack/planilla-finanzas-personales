/**
 * 07_MedioPagoService.js
 * Servicio CRUD para DB_MEDIOS_PAGO
 * Gestión de catálogo de medios de pago
 * 
 * @version 0.3.0
 * @since 0.3.0
 * @lastModified 2026-01-18
 */

// [AGILE-VALOR] Módulo base para el Catálogo de Cuentas y referenciación en transacciones.

// ============================================
// OPERACIONES DE LECTURA
// ============================================

/**
 * Obtiene todos los medios de pago
 * @returns {Array<Object>} Array de medios de pago
 */
function getAllMediosPago() {
 const data = getTableData('MEDIOS_PAGO');
 const colIndexes = getColumnIndexes('MEDIOS_PAGO');

 return data.map(row => ({
 medio_id: row[colIndexes.medio_id],
 nombre_medio: row[colIndexes.nombre_medio],
 tipo: row[colIndexes.tipo],
 moneda_id: row[colIndexes.moneda_id] || '',
 uso_principal: row[colIndexes.uso_principal] || ''
 }));
}

/**
 * Obtiene un medio de pago por ID
 * @param {string} medio_id ID del medio
 * @returns {Object|null} Objeto medio o null
 */
function getMedioPagoById(medio_id) {
 const result = findById('MEDIOS_PAGO', medio_id, 0);

 if (!result) {
 return null;
 }

 const colIndexes = getColumnIndexes('MEDIOS_PAGO');
 const row = result.rowData;

 return {
 medio_id: row[colIndexes.medio_id],
 nombre_medio: row[colIndexes.nombre_medio],
 tipo: row[colIndexes.tipo],
 moneda_id: row[colIndexes.moneda_id] || '',
 uso_principal: row[colIndexes.uso_principal] || ''
 };
}

/**
 * Filtra medios de pago por tipo
 * @param {string} tipo Tipo de medio (enum TIPO_MEDIO)
 * @returns {Array<Object>} Medios filtrados
 */
function getMediosByTipo(tipo) {
 // Validar enum
 validateEnum(tipo, ENUM_TIPO_MEDIO, 'tipo');

 const all = getAllMediosPago();
 return all.filter(m => m.tipo === tipo);
}

/**
 * Verifica si un medio de pago existe
 * @param {string} medio_id ID del medio
 * @returns {boolean} true si existe
 */
function medioPagoExists(medio_id) {
 return existsById('MEDIOS_PAGO', medio_id, 0);
}

// ============================================
// OPERACIONES DE ESCRITURA
// ============================================

/**
 * Crea un nuevo medio de pago
 * @param {string} nombre_medio Nombre del medio
 * @param {string} tipo Tipo de medio (enum)
 * @param {string} moneda_id ID de moneda (opcional, default: primera moneda disponible)
 * @param {string} uso_principal Uso principal (opcional)
 * @returns {Object} Medio creado
 */
function createMedioPago(nombre_medio, tipo, moneda_id = null, uso_principal = null) {
 // Si no se provee moneda_id, usar la primera disponible
 if (!moneda_id) {
 const monedas = getAllMonedas();
 if (monedas.length === 0) {
 throw new Error('No hay monedas disponibles. Ejecutar setupCompleto() primero.');
 }
 moneda_id = monedas[0].moneda_id;
 }

 const medio = {
 medio_id: generateNextId('MEDIOS_PAGO', 'MED', 3),
 nombre_medio,
 tipo,
 moneda_id,
 uso_principal: uso_principal || ''
 };

 // Validar
 validateMedioPago(medio);

 // Convertir a array (5 columnas)
 const rowData = [
 medio.medio_id,
 medio.nombre_medio,
 medio.tipo,
 medio.moneda_id,
 medio.uso_principal
 ];

 // Insertar
 appendRow('MEDIOS_PAGO', rowData);

 logSuccess(`Medio de pago creado: ${medio.medio_id} - ${medio.nombre_medio} (${medio.tipo})`);
 showToast(`Medio "${medio.nombre_medio}" creado correctamente`);

 return medio;
}

/**
 * Actualiza un medio de pago existente
 * @param {string} medio_id ID del medio
 * @param {string} nombre_medio Nuevo nombre
 * @param {string} tipo Nuevo tipo
 * @param {string} moneda_id Nueva moneda (opcional)
 * @param {string} uso_principal Nuevo uso (opcional)
 * @returns {Object} Medio actualizado
 */
function updateMedioPago(medio_id, nombre_medio, tipo, moneda_id = null, uso_principal = null) {
 const result = findById('MEDIOS_PAGO', medio_id, 0);

 if (!result) {
 throw new Error(`Medio de pago no encontrado: ${medio_id}`);
 }

 // Si no se provee moneda_id, mantener el actual
 if (!moneda_id) {
 const colIndexes = getColumnIndexes('MEDIOS_PAGO');
 moneda_id = result.rowData[colIndexes.moneda_id];
 }

 const medio = {
 medio_id,
 nombre_medio,
 tipo,
 moneda_id,
 uso_principal: uso_principal || ''
 };

 // Validar (indicar que es UPDATE para no verificar duplicados)
 validateMedioPago(medio, true);

 const rowData = [
 medio_id,
 nombre_medio,
 tipo,
 moneda_id,
 uso_principal || ''
 ];

 updateRow('MEDIOS_PAGO', result.rowIndex, rowData);

 logSuccess(`Medio de pago actualizado: ${medio_id}`);
 showToast(`Medio "${nombre_medio}" actualizado correctamente`);

 return medio;
}

/**
 * Elimina un medio de pago (solo si no tiene referencias)
 * @param {string} medio_id ID del medio
 */
function deleteMedioPago(medio_id) {
 const result = findById('MEDIOS_PAGO', medio_id, 0);

 if (!result) {
 throw new Error(`Medio de pago no encontrado: ${medio_id}`);
 }

 // Verificar que no tenga transacciones asociadas (FK constraint)
 const transacciones = getAllTransacciones();
 const hasTransactions = transacciones.some(t => t.medio_id === medio_id);

 if (hasTransactions) {
 const medio = getMedioPagoById(medio_id);
 throw new Error(
 `No se puede eliminar el medio "${medio.nombre_medio}" (${medio_id}) porque tiene transacciones asociadas. ` +
 `Primero elimina o reasigna las transacciones.`
 );
 }

 deleteRow('MEDIOS_PAGO', result.rowIndex);

 logSuccess(`Medio de pago eliminado: ${medio_id}`);
 showToast(`Medio "${medio_id}" eliminado`);
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Obtiene lista de IDs de medios para dropdowns
 * @returns {Array<string>} Array de IDs
 */
function getMedioCodesForDropdown() {
 const medios = getAllMediosPago();
 return medios.map(m => m.medio_id);
}

/**
 * Obtiene lista de medios por tipo para dropdowns
 * @param {string} tipo Tipo de medio (opcional)
 * @returns {Array<Object>} Array con {id, nombre}
 */
function getMediosForDropdown(tipo = null) {
 const medios = tipo ? getMediosByTipo(tipo) : getAllMediosPago();
 return medios.map(m => ({
 id: m.medio_id,
 nombre: m.nombre_medio
 }));
}

/**
 * Inicializa medios de pago básicos
 * Solo agrega los que faltan
 */
function initializeMediosPagoBasicos() {
 const mediosBasicos = [
 { nombre: 'Efectivo', tipo: 'efectivo' },
 { nombre: 'Tarjeta Visa débito', tipo: 'débito' },
 { nombre: 'Tarjeta Amex crédito', tipo: 'crédito' },
 { nombre: 'Transferencia bancaria', tipo: 'banco' },
 { nombre: 'Mercado Pago', tipo: 'billetera' }
 ];

 let agregados = 0;

 mediosBasicos.forEach(m => {
 try {
 createMedioPago(m.nombre, m.tipo);
 agregados++;
 } catch (e) {
 logError(`Error creando medio ${m.nombre}`, { error: e.toString() });
 }
 });

 if (agregados > 0) {
 logSuccess(`Medios de pago inicializados: ${agregados} agregados`);
 showToast(`${agregados} medio(s) de pago creado(s)`, 'Setup Completo', 5);
 } else {
 logInfo('No se agregaron medios (puede que ya existan o hubo errores)');
 }
}
