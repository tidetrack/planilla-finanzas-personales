/**
 * 08_CuentaService.js
 * Servicio CRUD para DB_CUENTAS
 * Gestión de catálogo de cuentas (categorías de ingresos/egresos)
 * 
 * @version 0.3.0
 * @since 0.3.0
 * @lastModified 2026-01-18
 */

// [AGILE-VALOR] Módulo base del Plan de Cuentas. Estructura simplificada e integral.

// ============================================
// OPERACIONES DE LECTURA
// ============================================

/**
 * Obtiene todas las cuentas
 * @returns {Array<Object>} Array de cuentas
 */
function getAllCuentas() {
    const data = getTableData('CUENTAS');
    const colIndexes = getColumnIndexes('CUENTAS');

    return data.map(row => ({
        cuenta_id: row[colIndexes.cuenta_id],
        nombre_cuentas: row[colIndexes.nombre_cuentas],
        macro_tipo: row[colIndexes.macro_tipo],
        es_recurrente: row[colIndexes.es_recurrente] || ''
    }));
}

/**
 * Obtiene una cuenta por ID
 * @param {string} cuenta_id ID de la cuenta
 * @returns {Object|null} Objeto cuenta o null
 */
function getCuentaById(cuenta_id) {
    const result = findById('CUENTAS', cuenta_id, 0);

    if (!result) {
        return null;
    }

    const colIndexes = getColumnIndexes('CUENTAS');
    const row = result.rowData;

    return {
        cuenta_id: row[colIndexes.cuenta_id],
        nombre_cuentas: row[colIndexes.nombre_cuentas],
        macro_tipo: row[colIndexes.macro_tipo],
        es_recurrente: row[colIndexes.es_recurrente] || ''
    };
}

/**
 * Filtra cuentas por macro_tipo
 * @param {string} macro_tipo Tipo de cuenta (Ingreso/Egreso)
 * @returns {Array<Object>} Cuentas filtradas
 */
function getCuentasByMacroTipo(macro_tipo) {
    // Validar enum
    validateEnum(macro_tipo, ENUM_MACRO_TIPO, 'macro_tipo');

    const all = getAllCuentas();
    return all.filter(c => c.macro_tipo === macro_tipo);
}

/**
 * Verifica si una cuenta existe
 * @param {string} cuenta_id ID de la cuenta
 * @returns {boolean} true si existe
 */
function cuentaExists(cuenta_id) {
    return existsById('CUENTAS', cuenta_id, 0);
}

// ============================================
// OPERACIONES DE ESCRITURA
// ============================================

/**
 * Crea una nueva cuenta
 * @param {string} nombre_cuentas Nombre de la cuenta
 * @param {string} macro_tipo Tipo de cuenta (enum MACRO_TIPO)
 * @param {string} es_recurrente Si es recurrente (opcional)
 * @returns {Object} Cuenta creada
 */
function createCuenta(nombre_cuentas, macro_tipo, es_recurrente = '') {
    const cuenta = {
        cuenta_id: generateNextId('CUENTAS', 'CTA', 3),
        nombre_cuentas,
        macro_tipo,
        es_recurrente
    };

    // Validar
    validateCuenta(cuenta);

    // Convertir a array (4 columnas)
    const rowData = [
        cuenta.cuenta_id,
        cuenta.nombre_cuentas,
        cuenta.macro_tipo,
        cuenta.es_recurrente
    ];

    // Insertar
    appendRow('CUENTAS', rowData);

    logSuccess(`Cuenta creada: ${cuenta.cuenta_id} - ${cuenta.nombre_cuentas} (${cuenta.macro_tipo})`);
    showToast(`Cuenta "${cuenta.nombre_cuentas}" creada correctamente`);

    return cuenta;
}

/**
 * Actualiza una cuenta existente
 * @param {string} cuenta_id ID de la cuenta
 * @param {string} nombre_cuentas Nuevo nombre
 * @param {string} macro_tipo Nuevo tipo
 * @param {string} es_recurrente Nuevo valor recurrente
 * @returns {Object} Cuenta actualizada
 */
function updateCuenta(cuenta_id, nombre_cuentas, macro_tipo, es_recurrente = '') {
    const result = findById('CUENTAS', cuenta_id, 0);

    if (!result) {
        throw new Error(`Cuenta no encontrada: ${cuenta_id}`);
    }

    const cuenta = {
        cuenta_id,
        nombre_cuentas,
        macro_tipo,
        es_recurrente
    };

    // Validar
    validateCuenta(cuenta, true);

    const rowData = [
        cuenta_id,
        nombre_cuentas,
        macro_tipo,
        es_recurrente
    ];

    updateRow('CUENTAS', result.rowIndex, rowData);

    logSuccess(`Cuenta actualizada: ${cuenta_id}`);
    showToast(`Cuenta "${nombre_cuentas}" actualizada correctamente`);

    return cuenta;
}

/**
 * Elimina una cuenta (solo si no tiene referencias)
 * @param {string} cuenta_id ID de la cuenta
 */
function deleteCuenta(cuenta_id) {
    const result = findById('CUENTAS', cuenta_id, 0);

    if (!result) {
        throw new Error(`Cuenta no encontrada: ${cuenta_id}`);
    }

    // Verificar que no tenga transacciones asociadas (FK constraint)
    const transacciones = getAllTransacciones();
    const hasTransactions = transacciones.some(t => t.cuenta_id === cuenta_id);

    if (hasTransactions) {
        const cuenta = getCuentaById(cuenta_id);
        throw new Error(
            `No se puede eliminar la cuenta "${cuenta.nombre_cuentas}" (${cuenta_id}) porque tiene transacciones asociadas. ` +
            `Primero elimina o reasigna las transacciones.`
        );
    }

    deleteRow('CUENTAS', result.rowIndex);

    logSuccess(`Cuenta eliminada: ${cuenta_id}`);
    showToast(`Cuenta "${cuenta_id}" eliminada`);
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Obtiene lista de IDs de cuentas para dropdowns
 * @param {string} macro_tipo Filtrar por tipo (opcional)
 * @returns {Array<string>} Array de IDs
 */
function getCuentaCodesForDropdown(macro_tipo = null) {
    const cuentas = macro_tipo ? getCuentasByMacroTipo(macro_tipo) : getAllCuentas();
    return cuentas.map(c => c.cuenta_id);
}

/**
 * Obtiene lista de cuentas para dropdowns
 * @param {string} macro_tipo Filtrar por tipo (opcional)
 * @returns {Array<Object>} Array con {id, nombre}
 */
function getCuentasForDropdown(macro_tipo = null) {
    const cuentas = macro_tipo ? getCuentasByMacroTipo(macro_tipo) : getAllCuentas();
    return cuentas.map(c => ({
        id: c.cuenta_id,
        nombre: c.nombre_cuentas
    }));
}

/**
 * Inicializa cuentas básicas (3 ingresos + 8 egresos)
 * Solo agrega las que faltan
 */
function initializeCuentasBasicas() {
    const cuentasBasicas = [
        // Ingresos
        { nombre: 'Sueldo', macro_tipo: 'Ingreso' },
        { nombre: 'Freelance', macro_tipo: 'Ingreso' },
        { nombre: 'Otros ingresos', macro_tipo: 'Ingreso' },

        // Egresos
        { nombre: 'Alimentos y bebidas', macro_tipo: 'Gasto variable' },
        { nombre: 'Transporte', macro_tipo: 'Gasto variable' },
        { nombre: 'Vivienda (alquiler, servicios)', macro_tipo: 'Gasto fijo' },
        { nombre: 'Entretenimiento', macro_tipo: 'Gasto variable' },
        { nombre: 'Salud y medicina', macro_tipo: 'Gasto variable' },
        { nombre: 'Educación', macro_tipo: 'Gasto variable' },
        { nombre: 'Ropa y calzado', macro_tipo: 'Gasto variable' },
        { nombre: 'Otros egresos', macro_tipo: 'Gasto variable' }
    ];

    let agregados = 0;

    cuentasBasicas.forEach(c => {
        try {
            createCuenta(c.nombre, c.macro_tipo);
            agregados++;
        } catch (e) {
            logError(`Error creando cuenta ${c.nombre}`, { error: e.toString() });
        }
    });

    if (agregados > 0) {
        logSuccess(`Cuentas básicas inicializadas: ${agregados} agregadas`);
        showToast(`${agregados} cuenta(s) creada(s)`, 'Setup Completo', 5);
    } else {
        logInfo('No se agregaron cuentas (puede que ya existan o hubo errores)');
    }
}
