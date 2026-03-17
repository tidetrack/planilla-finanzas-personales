/**
 * 04_DataValidation.js
 * Validaciones de integridad referencial y reglas de negocio
 * Implementa las reglas del DATABASE_SCHEMA
 * 
 * @version 0.1.0
 * @since 0.1.0
 * @lastModified 2026-01-17
 */

// ============================================
// VALIDACIONES DE MONEDAS
// ============================================

/**
 * Valida un objeto moneda
 * @param {Object} moneda Objeto {moneda_id, nombre_moneda, simbolo}
 * @throws {Error} Si la validación falla
 */
function validateMoneda(moneda) {
    validateRequired(moneda.moneda_id, 'moneda_id');
    validateRequired(moneda.nombre_moneda, 'nombre_moneda');
    validateRequired(moneda.simbolo, 'simbolo');

    // Verificar duplicados
    if (existsById('MONEDAS', moneda.moneda_id, 0)) {
        throw new Error(`${ERROR_MESSAGES.DUPLICATE_ID}moneda_id = "${moneda.moneda_id}"`);
    }
}

/**
 * Verifica que una moneda existe en CURRENCIES hardcodeadas
 * @param {string} moneda_id ID de la moneda
 * @returns {boolean} true si existe
 * @throws {Error} Si no existe
 */
function checkMonedaExists(moneda_id) {
    // Validar contra CURRENCIES hardcodeadas (no tabla MONEDAS)
    if (!CURRENCIES[moneda_id]) {
        throw new Error(
            `${ERROR_MESSAGES.FK_NOT_FOUND}CURRENCIES. ` +
            `moneda_id = "${moneda_id}" no existe. ` +
            `Monedas disponibles: ${AVAILABLE_CURRENCY_IDS.join(', ')}`
        );
    }
    return true;
}

/**
 * Valida un medio de pago
 * @param {Object} medio Objeto medio de pago
 */
function validateMedioPago(medio) {
    const errors = [];

    // Campos obligatorios
    if (!medio.nombre_medio || medio.nombre_medio.trim() === '') {
        errors.push('nombre_medio es obligatorio');
    }

    if (!medio.tipo_medio || medio.tipo_medio.trim() === '') {
        errors.push('tipo_medio es obligatorio');
    }

    // Validar enum tipo_medio
    if (medio.tipo_medio) {
        try {
            validateEnum(medio.tipo_medio, ENUM_TIPO_MEDIO, 'tipo_medio');
        } catch (e) {
            errors.push(e.message);
        }
    }

    if (errors.length > 0) {
        throw new Error(`Validación de medio de pago falló:\n- ${errors.join('\n- ')}`);
    }
}

// ============================================
// VALIDACIONES DE TIPOS DE CAMBIO
// ============================================

/**
 * Valida un objeto de tipo de cambio
 * @param {Object} fx Objeto de tipo de cambio
 * @throws {Error} Si la validación falla
 */
function validateExchangeRate(fx) {
    // Campos obligatorios
    validateRequired(fx.fx_id, 'fx_id');
    validateRequired(fx.fecha, 'fecha');
    validateRequired(fx.base_moneda_id, 'base_moneda_id');
    validateRequired(fx.quote_moneda_id, 'quote_moneda_id');
    validateRequired(fx.tc, 'tc');
    validateRequired(fx.fuente, 'fuente');
    validateRequired(fx.status, 'status');

    // tc > 0
    validatePositive(fx.tc, 'tc');

    // base ≠ quote
    if (fx.base_moneda_id === fx.quote_moneda_id) {
        throw new Error(
            'base_moneda_id no puede ser igual a quote_moneda_id. ' +
            `Valor: "${fx.base_moneda_id}"`
        );
    }

    // Validar enums
    validateEnum(fx.fuente, ENUM_FUENTE_FX, 'fuente');
    validateEnum(fx.status, ENUM_STATUS_FX, 'status');

    // Verificar FKs
    checkMonedaExists(fx.base_moneda_id);
    checkMonedaExists(fx.quote_moneda_id);

    // Verificar duplicados
    if (existsById('TIPOS_CAMBIO', fx.fx_id, 0)) {
        throw new Error(`${ERROR_MESSAGES.DUPLICATE_ID}fx_id = "${fx.fx_id}"`);
    }
}

// ============================================
// VALIDACIÓN: DB_MEDIOS_PAGO
// ============================================

/**
 * Valida un medio de pago
 * @param {Object} medio Objeto medio de pago {medio_id, nombre_medio, tipo, moneda_id, uso_principal}
 * @param {boolean} isUpdate Si es true, no verifica duplicados (para updates)
 * @throws {Error} Si la validación falla
 */
function validateMedioPago(medio, isUpdate = false) {
    const errors = [];

    // Campos obligatorios
    if (!medio.nombre_medio || medio.nombre_medio.trim() === '') {
        errors.push('nombre_medio es obligatorio');
    }

    if (!medio.tipo || medio.tipo.trim() === '') {
        errors.push('tipo es obligatorio');
    }

    if (!medio.moneda_id || medio.moneda_id.trim() === '') {
        errors.push('moneda_id es obligatorio');
    }

    // Validar enum tipo
    if (medio.tipo) {
        try {
            validateEnum(medio.tipo, ENUM_TIPO_MEDIO, 'tipo');
        } catch (e) {
            errors.push(e.message);
        }
    }

    // Validar enum uso_principal (opcional)
    if (medio.uso_principal && medio.uso_principal.trim() !== '') {
        try {
            validateEnum(medio.uso_principal, ENUM_USO_PRINCIPAL, 'uso_principal');
        } catch (e) {
            errors.push(e.message);
        }
    }

    // Verificar FK moneda
    if (medio.moneda_id) {
        try {
            checkMonedaExists(medio.moneda_id);
        } catch (e) {
            errors.push(e.message);
        }
    }

    // Verificar duplicados solo en CREATE (no en UPDATE)
    if (!isUpdate && medio.medio_id && existsById('MEDIOS_PAGO', medio.medio_id, 0)) {
        errors.push(`medio_id "${medio.medio_id}" ya existe`);
    }

    if (errors.length > 0) {
        throw new Error(`Validación de medio de pago falló:\n- ${errors.join('\n- ')}`);
    }
}

// ============================================
// VALIDACIÓN: DB_CUENTAS
// ============================================

/**
 * Valida una cuenta
 * @param {Object} cuenta Objeto cuenta {cuenta_id, nombre_cuentas, macro_tipo, es_recurrente}
 * @param {boolean} isUpdate Si es true, no verifica duplicados (para updates)
 * @throws {Error} Si la validación falla
 */
function validateCuenta(cuenta, isUpdate = false) {
    const errors = [];

    // Campos obligatorios
    if (!cuenta.nombre_cuentas || cuenta.nombre_cuentas.trim() === '') {
        errors.push('nombre_cuentas es obligatorio');
    }

    if (!cuenta.macro_tipo || cuenta.macro_tipo.trim() === '') {
        errors.push('macro_tipo es obligatorio');
    }

    // Validar enum macro_tipo
    if (cuenta.macro_tipo) {
        try {
            validateEnum(cuenta.macro_tipo, ENUM_MACRO_TIPO, 'macro_tipo');
        } catch (e) {
            errors.push(e.message);
        }
    }

    // Verificar duplicados solo en CREATE (no en UPDATE)
    if (!isUpdate && cuenta.cuenta_id && existsById('CUENTAS', cuenta.cuenta_id, 0)) {
        errors.push(`cuenta_id "${cuenta.cuenta_id}" ya existe`);
    }

    if (errors.length > 0) {
        throw new Error(`Validación de cuenta falló:\n- ${errors.join('\n- ')}`);
    }
}

// ============================================
// VALIDACIÓN: DB_TIPOS_CAMBIO
// ============================================

// ============================================
// VALIDACIONES DE TRANSACCIONES
// ============================================

/**
 * Valida un objeto transacción (REGLA CRÍTICA)
 * @param {Object} trx Objeto de transacción
 * @param {Object} config Configuración global
 * @param {boolean} isUpdate Si es true, no verifica duplicados (para updates)
 * @throws {Error} Si la validación falla
 */
function validateTransaction(trx, config, isUpdate = false) {
    // Campos obligatorios
    validateRequired(trx.trx_id, 'trx_id');
    validateRequired(trx.fecha, 'fecha');
    validateRequired(trx.monto, 'monto');
    validateRequired(trx.moneda_id, 'moneda_id');
    validateRequired(trx.sentido, 'sentido');
    validateRequired(trx.cuenta_id, 'cuenta_id');
    validateRequired(trx.medio_id, 'medio_id');

    // REGLA: monto > 0
    validatePositive(trx.monto, 'monto');

    // Validar enums
    validateEnum(trx.sentido, ENUM_SENTIDO, 'sentido');

    // Verificar FKs
    checkMonedaExists(trx.moneda_id);

    if (!existsById('CUENTAS', trx.cuenta_id, 0)) {
        throw new Error(
            `${ERROR_MESSAGES.FK_NOT_FOUND}DB_CUENTAS. ` +
            `cuenta_id = "${trx.cuenta_id}" no existe`
        );
    }

    if (!existsById('MEDIOS_PAGO', trx.medio_id, 0)) {
        throw new Error(
            `${ERROR_MESSAGES.FK_NOT_FOUND}DB_MEDIOS_PAGO. ` +
            `medio_id = "${trx.medio_id}" no existe`
        );
    }

    // REGLA CRÍTICA: fx_id obligatorio si moneda ≠ base
    const baseMoneda = config.base_moneda_id;

    if (trx.moneda_id !== baseMoneda) {
        validateRequired(trx.fx_id, 'fx_id (obligatorio para moneda extranjera)');

        // Verificar que fx_id existe y tiene status=ok
        const fxResult = findById('TIPOS_CAMBIO', trx.fx_id, 0);
        if (!fxResult) {
            throw new Error(
                `${ERROR_MESSAGES.FK_NOT_FOUND}DB_TIPOS_CAMBIO. ` +
                `fx_id = "${trx.fx_id}" no existe`
            );
        }

        const fxRow = fxResult.rowData;
        const colIndexes = getColumnIndexes('TIPOS_CAMBIO');
        const status = fxRow[colIndexes.status];

        if (status !== 'ok') {
            throw new Error(
                `fx_id = "${trx.fx_id}" tiene status="${status}". ` +
                `Solo se permiten fx con status="ok"`
            );
        }
    }

    // Verificar duplicados solo en CREATE (no en UPDATE)
    if (!isUpdate && existsById('TRANSACCIONES', trx.trx_id, 0)) {
        throw new Error(`${ERROR_MESSAGES.DUPLICATE_ID}trx_id = "${trx.trx_id}"`);
    }
}

// ============================================
// VALIDACIONES DE CONFIGURACIÓN
// ============================================

/**
 * Valida objeto de configuración
 * @param {Object} config Objeto de configuración
 * @throws {Error} Si la validación falla
 */
function validateConfig(config) {
    validateRequired(config.config_id, 'config_id');
    validateRequired(config.base_moneda_id, 'base_moneda_id');
    validateRequired(config.fuente_tc_preferida, 'fuente_tc_preferida');

    checkMonedaExists(config.base_moneda_id);
    validateEnum(config.fuente_tc_preferida, ENUM_FUENTE_FX, 'fuente_tc_preferida');
}
