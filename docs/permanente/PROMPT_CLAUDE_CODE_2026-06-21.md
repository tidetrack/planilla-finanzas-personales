# Mega-Prompt: Fix Bug Sort + Utilidad Renombrado de Hojas — 2026-06-21

Generado por Cowork tras auditoría visual de la planilla.
Ejecutar en orden. No hacer commit hasta completar TODAS las tareas.

---

## Contexto

La sesión de Cowork auditó la planilla y confirmó los siguientes cambios:

1. Las hojas "Registros" (gid=709656625) y "Tipos de cambio" (gid=42932214) fueron duplicadas.
2. Las copias ("Copia de Registros" gid=1546296548, "Copia de Tipos de Cambio" gid=779567597) deben renombrarse para tomar los nombres originales de producción.
3. Las hojas originales deben renombrarse a algo como "Registros_legacy" / "Tipos de cambio_legacy" antes de que las copias tomen sus nombres.
4. **Bug confirmado:** `procesarCargas()` sobrescribe el encabezado de la BD de Registros al ejecutarse.

### Estado post-renombrado (objetivo)

| Nombre final | GID | Estado |
|---|---|---|
| Registros | 1546296548 | Produccion activa (antes llamada "Copia de Registros") |
| Tipos de cambio | 779567597 | Produccion activa (antes llamada "Copia de Tipos de Cambio") |
| Registros_legacy | 709656625 | Legacy |
| Tipos de cambio_legacy | 42932214 | Legacy |

### Importante: sin cambios en SHEETS ni en fórmulas

Los nombres de producción siguen siendo 'Registros' y 'Tipos de cambio'. Por lo tanto:
- `src/00_Config.js` → las constantes SHEETS no cambian.
- Las fórmulas en Tablero, CALCU y ANUAL no cambian.
- Solo hay que renombrar las hojas en la planilla y corregir el bug de sort.

---

## TAREA 1 — Agregar `renameProductionSheets()` en `src/06_RegistrosService.js`

Esta función hace el renombrado en la planilla. Se ejecuta una única vez desde el menú [Dev].
El orden es crítico: primero renombrar las originales a legacy, luego las copias a producción.
Agregarla **al final del archivo**.

```javascript
/**
 * Renombra las hojas para completar la migración de producción 2026-06-21.
 * Orden de operaciones:
 *   1. Renombrar hojas originales a _legacy (para liberar los nombres)
 *   2. Renombrar copias a los nombres definitivos de producción
 * INVOCAR UNA SOLA VEZ desde el menú [Dev] → "Renombrar Hojas a Producción".
 * Idempotente: verifica existencia antes de renombrar.
 * @since 0.8.1
 */
function renameProductionSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const renames = [
        // Paso 1: liberar los nombres originales
        { from: 'Registros',        to: 'Registros_legacy' },
        { from: 'Tipos de cambio',  to: 'Tipos de cambio_legacy' },
        // Paso 2: asignar nombres de producción a las copias
        { from: 'Copia de Registros',       to: 'Registros' },
        { from: 'Copia de Tipos de Cambio', to: 'Tipos de cambio' },
    ];

    const results = [];

    renames.forEach(({ from, to }) => {
        const sheet = ss.getSheetByName(from);
        if (!sheet) {
            results.push(`SKIP: '${from}' no encontrada.`);
            return;
        }
        if (ss.getSheetByName(to)) {
            results.push(`SKIP: '${to}' ya existe — '${from}' no se renombró.`);
            return;
        }
        sheet.setName(to);
        results.push(`OK: '${from}' → '${to}'`);
        logSuccess(`renameProductionSheets: '${from}' → '${to}'`);
    });

    SpreadsheetApp.getUi().alert('Resultado del renombrado:\n\n' + results.join('\n'));
}
```

También agregar la entrada al menú en `src/00_Config.js`, dentro de `MENU_CONFIG.ITEMS`, al final del bloque Dev:

```javascript
{ separator: true },
{ name: '🔧 [Dev] Renombrar Hojas a Producción', function: 'renameProductionSheets' },
```

---

## TAREA 2 — Corregir bug en `src/06_RegistrosService.js`

**Leer el archivo primero.** Los cambios son quirúrgicos.

### Root cause

En línea 117, el sort arranca en fila 2:

```javascript
const baseFullRange = registrosSheet.getRange(2, 9, lastRowReg - 1, 12);
```

Pero `HEADER_ROW = 3`. El sort incluye la fila 3 (encabezado) y al ordenar por fecha descendente, el texto "Fecha" se desplaza hacia el fondo de la columna, moviendo el encabezado fuera de su lugar.

### Fix A — línea 111: corregir minRow del append de REGISTROS

```javascript
// ANTES:
appendMassive('REGISTROS', registrosToAppend, 2);

// DESPUÉS:
appendMassive('REGISTROS', registrosToAppend, DATA_START_ROW);
```

Por qué: con minRow=2, si la hoja estuviera vacía, escribiría desde fila 2, antes del encabezado en fila 3.

### Fix B — líneas 114-120: corregir el sort range

```javascript
// ANTES:
const lastRowReg = registrosSheet.getLastRow();
if (lastRowReg >= 2) {
    const baseFullRange = registrosSheet.getRange(2, 9, lastRowReg - 1, 12);
    baseFullRange.sort({ column: 15, ascending: false });
}

// DESPUÉS:
// El sort arranca en DATA_START_ROW para no incluir el encabezado en HEADER_ROW (3).
const lastRowReg = registrosSheet.getLastRow();
if (lastRowReg >= DATA_START_ROW) {
    const rowCount = lastRowReg - DATA_START_ROW + 1;
    const baseFullRange = registrosSheet.getRange(DATA_START_ROW, 9, rowCount, 12);
    baseFullRange.sort({ column: 15, ascending: false });
}
```

### Fix C — actualizar el JSDoc de appendMassive

Reemplazar el `@param minRow` actual:

```javascript
 * @param {number} minRow Fila mínima donde puede escribir (inclusive).
 *   DEBE ser >= DATA_START_ROW (4). Si se pasa un valor menor y la hoja está vacía,
 *   se puede sobreescribir el encabezado en HEADER_ROW (3).
 *   Default: DATA_START_ROW.
```

---

## TAREA 3 — Actualizar JSDoc headers

- `src/00_Config.js`: `@lastModified` → 2026-06-21, `@version` → 0.2.0
- `src/06_RegistrosService.js`: `@lastModified` → 2026-06-21

---

## TAREA 4 — Changelog dual

### `src/ZZ_Changelog.js`

```
v0.8.1 — 2026-06-21
- NUEVO: renameProductionSheets() — utilidad de ejecución única para completar la migración de hojas de producción (Registros y Tipos de cambio).
- FIX CRÍTICO: sort en procesarCargas() arrancaba en fila 2 e incluía HEADER_ROW=3, desplazando el encabezado al ordenar. Corregido a DATA_START_ROW=4.
- FIX: appendMassive para REGISTROS usaba minRow=2; corregido a DATA_START_ROW para evitar escritura antes del encabezado en hoja vacía.
- NUEVO: entrada de menú [Dev] → "Renombrar Hojas a Producción".
```

### `docs/permanente/CHANGELOG.md`

Misma entrada en formato markdown al inicio.

---

## TAREA 5 — Deploy

```bash
npx clasp push
```

Verificar que no hay errores de sintaxis. Después del push exitoso:

1. En la planilla, ir a Tidetrack → [Dev] → "Renombrar Hojas a Producción" y ejecutar.
2. Verificar que las hojas quedaron renombradas correctamente.
3. Ejecutar `procesarCargas()` con un registro de prueba y confirmar que el encabezado de "Registros" permanece intacto.

---

## TAREA 6 — Un único commit

```
fix(registros): rename production sheets utility + fix sort header bug [v0.8.1]

- Add renameProductionSheets(): one-time utility to rename Copia de Registros → Registros
  and Copia de Tipos de Cambio → Tipos de cambio (originals get _legacy suffix)
- Fix sort range in procesarCargas(): started at row 2, now starts at DATA_START_ROW (4)
  to exclude HEADER_ROW (3) from sort — this was the header deletion bug
- Fix appendMassive minRow for REGISTROS: 2 → DATA_START_ROW (4)
- Add menu item [Dev] Renombrar Hojas a Producción
- Bump to v0.8.1
```

---

## Notas para el agente

- `MAPA_HOJAS.md` ya fue actualizado por Cowork — **no tocar**.
- Los SHEETS en `00_Config.js` **no cambian**: siguen apuntando a 'Registros' y 'Tipos de cambio'.
- Las fórmulas del Tablero/CALCU/ANUAL **no requieren cambios** por la misma razón.
- El inventario de fórmulas completo (SKU + descripción) queda pendiente. Vía recomendada: ejecutar `exportarArquitecturaTotal()` desde el menú [DevTools] y analizar el JSON resultante.
