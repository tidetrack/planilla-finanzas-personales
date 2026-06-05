# Regla: Insercion de Contexto Estrategico en el Codigo (`src/`)

## Objetivo
Por instruccion directa, el ecosistema de codigo no debe ser puramente tecnico. El codigo fuente (`src/`) DEBE portar consigo su propia "razon de ser" dentro del modelo de finanzas personales Tidetrack. Esto garantiza que cualquier modelo de lenguaje o IA (como NotebookLM) que analice los archivos `.js` entienda inmediatamente el contexto de negocio sin necesitar inferirlo.

## A quien aplica
Aplica irrestrictamente a cualquier agente desarrollador (ej. `appscript-backend`, `appscript-ui`, `lean-refactor`) que intervenga el codigo en `src/`.

## Instruccion de Formato
Todo archivo script o HTML dentro del sistema debe comenzar con un bloque de documentacion estructurado en tres micro-bloques:

1. **[CONCEPTO DE NEGOCIO]:** Que objetivo cumple este script para sostener el habito financiero del usuario (Ej: "Congela la cotizacion del dia en cada registro", "Estandariza el alta de cuentas del Plan", "Deduce el tipo de cuenta automaticamente").
2. **[FUNDAMENTO TEORICO / ADMINISTRATIVO]:** La regla directiva teorica subyacente (Ej: "Respeta el modelo multi-moneda nativo", "Separa concerns: las vistas solo consumen resultados procesados", "Disciplina relacional estricta sobre Sheets").
3. **@see**: Vinculo al documento conceptual detallado que resida en `docs/permanente/` (o `docs/permanente/notebookLM/` cuando exista).

## Restriccion de Despliegue
Al igual que el auto-changelog, no se autoriza considerar un script "Terminado" hasta que dichas firmas teoricas existan en su cabecera. Esto convive con la cabecera JSDoc (`@version`, `@since`, `@lastModified`) que ya usa el proyecto: una no reemplaza a la otra.
