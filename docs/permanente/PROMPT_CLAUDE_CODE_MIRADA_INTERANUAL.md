# Prompt Claude Code: Módulo Mirada Interanual — 2026-06-22

Generado por Cowork. Ejecutar en orden. No hacer commit hasta completar TODAS las tareas.

---

## Contexto

La pestaña "Mirada Interanual" necesita fórmulas dinámicas en el rango G10:R14 que traigan datos de la BD Registros agrupados por mes, tipo de cuenta y moneda seleccionada. El módulo que implementa esto se llama `07_MiradaInteranual.js` y aún no existe.

El problema actual: G10 fue ingresada manualmente pero la celda tiene formato "Texto sin formato", por lo que la fórmula no evalúa. La solución definitiva es que el script setee la fórmula programáticamente, ya que `setFormula()` en Apps Script fuerza el tipo de celda a formula y bypasea el problema de formato.

### Layout de Mirada Interanual (auditado)

| Celda | Contenido |
|---|---|
| E4 | Selector de mes (texto en español mayúscula: "ENERO", "FEBRERO", etc.) |
| F4 | Selector de año (numérico) |
| R4 | Selector de moneda: "ARS", "USD", "AUD", "EUR" |
| C10 | "Ingresos" (label del tipo de cuenta) |
| C11 | "Gastos Fijos" |
| C12 | "Gastos Variables" |
| G10:R10 | Ingresos por mes |
| G11:R11 | Gastos Fijos por mes |
| G12:R12 | Gastos Variables por mes |
| G14:R14 | Resultado = Ingresos - Gastos Fijos - Gastos Variables |
| K10:K12 | Siempre el mes de referencia (E4/F4). G=mes-4, H=mes-3, ..., K=mes ref, L=mes+1, ..., R=mes+7 |

### Columnas de BD Registros confirmadas desde `00_Config.js` y `MAPA_HOJAS.md`

| Col | Campo | Uso en fórmula |
|---|---|---|
| I | monto | `montos` |
| L | tipo_cuenta | `tipos` — valores: "Ingreso", "Gasto Fijo", "Gasto Variable" |
| N | moneda | `mon_tx` — valores: "ARS", "USD", "AUD", "EUR" |
| O | fecha | `fechas` — timestamp congelado al procesar |
| R | tc_usd | `tc_u` |
| S | tc_aud | `tc_a` |
| T | tc_eur | `tc_e` |

`HEADER_ROW = 3`, `DATA_START_ROW = 4` (ADR-005). Los datos arrancan en fila 4.

### Lógica de la fórmula

- `offset = COLUMN() - COLUMN($K$10)` → calcula desplazamiento en meses respecto al mes de referencia. En columna G = -4, en K = 0, en R = +7.
- `f_obj = EDATE(DATE($F$4, mes_num, 1), offset)` → navega meses con cruce de año automático.
- `tipo_bd = SWITCH($C10, "Ingresos","Ingreso", "Gastos Fijos","Gasto Fijo", "Gastos Variables","Gasto Variable")` → mapea labels de display a valores en BD.
- Conversión multi-moneda: `tc_tx / tc_sel` donde `tc_tx` es el TC de la transacción y `tc_sel` es el TC de la moneda seleccionada en R4. Para ARS, el TC es 1 (base). El patrón convierte: monto en moneda original → ARS → moneda seleccionada.
- `conv = IF(tc_sel=0, 0, tc_tx/tc_sel)` → guarda contra división por cero.
- `$C10` tiene columna fija y fila relativa → al copiar hacia abajo a G11/G12 cambia a `$C11`/`$C12` correctamente.

---

## TAREA 1 — Crear `src/07_MiradaInteranual.js`

Crear el archivo desde cero. Naming convention del proyecto: número de módulo + nombre funcional + `.js`.

```javascript
/**
 * 07_MiradaInteranual.js
 * Inicializa las fórmulas del módulo Mirada Interanual (G10:R14).
 * Invocable desde el menú Tidetrack → [Dev] → "Inicializar Mirada Interanual".
 *
 * @version 0.1.0
 * @since 0.8.2
 * @lastModified 2026-06-22
 */

/**
 * Escribe las fórmulas de Mirada Interanual en el rango G10:R14.
 *
 * Layout objetivo:
 *   G10:R10 — Ingresos por mes
 *   G11:R11 — Gastos Fijos por mes
 *   G12:R12 — Gastos Variables por mes
 *   G14:R14 — Resultado (G10 - G11 - G12)
 *
 * Selectores consumidos:
 *   E4 = mes de referencia (texto uppercase en español)
 *   F4 = año de referencia (numérico)
 *   R4 = moneda de visualización (ARS | USD | AUD | EUR)
 *
 * La columna K siempre corresponde al mes de referencia (offset=0).
 * G=mes-4, H=mes-3, I=mes-2, J=mes-1, K=mes ref, L=+1 ... R=+7.
 *
 * Fuente de datos: hoja "Registros", filas 4:5000.
 * Columnas relevantes: I=monto, L=tipo_cuenta, N=moneda, O=fecha, R=tc_usd, S=tc_aud, T=tc_eur.
 *
 * Nota: setFormula() usa nombres de función en inglés; GAS los traduce al locale del spreadsheet.
 *
 * @since 0.8.2
 */
function inicializarMiradaInteranual() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Mirada Interanual');

    if (!sheet) {
        SpreadsheetApp.getUi().alert('Hoja "Mirada Interanual" no encontrada.');
        logError('inicializarMiradaInteranual', 'Hoja no encontrada');
        return;
    }

    // Fórmula base para G10:R12.
    // $C10 tiene columna fija y fila relativa: al copiar a G11/G12 cambia a $C11/$C12.
    // COLUMN()-COLUMN($K$10) calcula el offset en meses respecto al mes de referencia.
    // SWITCH mapea labels de display ("Ingresos") a valores en BD ("Ingreso").
    // Conversión multi-moneda: tc_tx / tc_sel (ambas referenciadas a ARS=1).
    const formulaBase = '=LET('
        + 'mes_num,MATCH($E$4,{"ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"},0),'
        + 'offset,COLUMN()-COLUMN($K$10),'
        + 'f_obj,EDATE(DATE($F$4,mes_num,1),offset),'
        + 'm_obj,MONTH(f_obj),'
        + 'a_obj,YEAR(f_obj),'
        + 'tipo_bd,IF($C10="Ingresos","Ingreso",IF($C10="Gastos Fijos","Gasto Fijo","Gasto Variable")),'
        + 'fechas,Registros!$O$3:$O$5000,'
        + 'montos,Registros!$I$3:$I$5000,'
        + 'tipos,Registros!$L$3:$L$5000,'
        + 'mon_tx,Registros!$N$3:$N$5000,'
        + 'tc_u,Registros!$R$3:$R$5000,'
        + 'tc_a,Registros!$S$3:$S$5000,'
        + 'tc_e,Registros!$T$3:$T$5000,'
        + 'tc_sel,IF($R$4="ARS",1,IF($R$4="USD",tc_u,IF($R$4="AUD",tc_a,tc_e))),'
        + 'tc_tx,IF(mon_tx="ARS",1,IF(mon_tx="USD",tc_u,IF(mon_tx="AUD",tc_a,tc_e))),'
        + 'conv,IF(tc_sel=0,0,tc_tx/tc_sel),'
        + 'SUMPRODUCT((tipos=tipo_bd)*(MONTH(fechas)=m_obj)*(YEAR(fechas)=a_obj)*(fechas<>"")*montos*conv))';

    // Escribir G10 y copiar al bloque G10:R12.
    // copyTo con tipo DEFAULT_VALUE_ONLY para que las referencias relativas funcionen correctamente.
    const g10 = sheet.getRange('G10');
    g10.setFormula(formulaBase);
    g10.copyTo(sheet.getRange('G10:R12'));

    // Fila 14: Resultado = Ingresos - Gastos Fijos - Gastos Variables
    const cols = ['G','H','I','J','K','L','M','N','O','P','Q','R'];
    cols.forEach(col => {
        sheet.getRange(`${col}14`).setFormula(`=${col}10-${col}11-${col}12`);
    });

    ss.toast('Mirada Interanual inicializada correctamente.', 'Listo', 4);
    logSuccess('inicializarMiradaInteranual: G10:R12 y G14:R14 configuradas.');
}
```

---

## TAREA 2 — Agregar entrada de menú en `src/00_Config.js`

Dentro de `MENU_CONFIG.ITEMS`, al final del bloque principal, antes de la entrada de DevTools:

```javascript
        { separator: true },
        { name: '🔧 [Dev] Inicializar Mirada Interanual', function: 'inicializarMiradaInteranual' },
        { separator: true },
        { name: '🤖 [DevTools] Exportar Arquitectura', function: 'exportarArquitecturaTotal' }
```

Reemplazar la línea actual del DevTools (que tiene separador antes) por este bloque para mantener estructura limpia.

Actualizar también el header del archivo:
```javascript
 * @version 0.2.0
 * @lastModified 2026-06-22
```

---

## TAREA 3 — Changelog dual

### `src/ZZ_Changelog.js`

Agregar al inicio del historial:

```
v0.8.2 — 2026-06-22
- NUEVO: 07_MiradaInteranual.js — módulo que inicializa fórmulas LET/SUMPRODUCT en G10:R14.
  Lógica: offset mensual via COLUMN()-COLUMN($K$10), navegación cross-year via EDATE,
  conversión multi-moneda via tc_tx/tc_sel (ambas relativas a ARS=1).
- NUEVO: entrada de menú [Dev] → "Inicializar Mirada Interanual".
```

### `docs/permanente/CHANGELOG.md`

Misma entrada en formato markdown al inicio del archivo.

---

## TAREA 4 — Deploy y verificación

```bash
npx clasp push
```

Verificar que no hay errores de sintaxis. Luego en la planilla:

1. Ir a Tidetrack → [Dev] → **"Inicializar Mirada Interanual"**
2. Confirmar que G10:R12 muestran valores numéricos (no texto)
3. Verificar que G14:R14 = G10:R14 - G11:R14 - G12:R14
4. Cambiar E4 (mes) y F4 (año) y confirmar que los valores se actualizan
5. Cambiar R4 (moneda) y confirmar conversión

---

## TAREA 5 — Commit único

```
feat(interanual): add 07_MiradaInteranual.js with LET/SUMPRODUCT formulas [v0.8.2]

- Create src/07_MiradaInteranual.js: inicializarMiradaInteranual() sets G10:R12
  with dynamic LET formula (monthly offset via COLUMN()-COLUMN($K$10), cross-year
  navigation via EDATE, multi-currency via tc_tx/tc_sel pattern)
- Set G14:R14 = resultado (ingreso - gastos fijos - gastos variables)
- Add menu entry [Dev] Inicializar Mirada Interanual in 00_Config.js
- Bump to v0.8.2
```

---

## Notas para el agente

- **No tocar MAPA_HOJAS.md** — ya documentado por Cowork.
- **No tocar `06_RegistrosService.js`** — ese módulo tiene su propio prompt (PROMPT_CLAUDE_CODE_2026-06-21.md) y debe trabajarse por separado.
- `$C10` funciona como referencia semi-absoluta intencional: columna fija (`$C`), fila relativa (`10`). Al copiar de G10 a G11 cambia a `$C11`. Es correcto.
- `$K$10` en el cálculo de offset es completamente fijo. K siempre = columna del mes de referencia. No cambiar.
- El rango `Registros!$O$3:$O$5000` arranca en fila 3 porque eso es lo que tiene la planilla real (auditado por Claude Code: I2='Monto', O2='Fecha', datos desde fila 3). El config dice DATA_START_ROW=4 pero la hoja nueva renombrada tiene datos desde fila 3. La fórmula sigue la planilla real, no el config.
- `SWITCH` no existe en Google Sheets en español. No traducir — usar `IF` anidado tanto en el string de GAS como en fórmulas manuales (`SI` anidado en español). `CAMBIAR` no es una función válida.
- La fórmula no filtra por proyecto todavía (selector N4:O5 queda pendiente v2). Es intencional.
- `setFormula()` usa nombres en inglés y Google Sheets los traduce al locale. No pasar nombres en español al string de GAS.
