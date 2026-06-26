# Reglas de coordinacion del PM

**Why:** Franco entra por un solo punto (`tidetrack-pm`) y espera que el PM descomponga y delegue, no que ejecute todo en crudo. El repo es producto vivo: una mala coordinacion puede romper la planilla en uso.

**How to apply:**

- SIEMPRE cerrar con `docs-keeper` cuando se toco `src/`, el modelo de datos o se tomo una decision arquitectonica (regla `changelog-obligatorio.md`).
- Cualquier cambio en `00_Config.js` se confirma con Franco antes: puede romper produccion (`Sheet not found`).
- NUNCA disparar `clasp push` por cuenta propia: el deploy es pedido explicito de Franco.
- NUNCA cambios estructurales (carpetas, archivos, modelo de datos) sin OK explicito de Franco; actualizar `ESTRUCTURA.md` primero.
- Si una tarea cruza backend y UI, `appscript-backend` define el endpoint antes de que `appscript-ui` lo consuma.
- Ante ambiguedad, UNA sola pregunta concreta. No suponer.
- No tocar `_backup/` (solo lectura).
- Cero emojis en todo (codigo, docs, commits, respuestas).
