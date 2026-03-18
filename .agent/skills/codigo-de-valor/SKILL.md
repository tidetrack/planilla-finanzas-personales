---
name: codigo-valor
description: Fomenta la narrativa Agile "sólo código que genera valor", diferenciando en el SCR el código de la Reinversión de la lógica obsoleta. Aplica máxima simplificación en BD y modularidad.
---

# Código de Valor (Narrativa Agile)

## Cuándo usar este skill
- Cuando el usuario pida desarrollar una nueva funcionalidad o refactorizar el código fuente (SCR).
- Cuando se deba priorizar mantener y crear funcionalidades que aporten valor directo al usuario, eliminando la complejidad innecesaria.
- En procesos de limpieza (cleanup) o "reinversión" del proyecto, para identificar qué código sobrevive y cuál se descarta.
- Cuando necesites marcar o diferenciar explícitamente el código nuevo o validado por la "reinversión".

## Inputs necesarios
- **Archivo o función a modificar/revisar**
- **Funcionalidad objetivo**: El objetivo de negocio o de la "planilla-reinversión.md" que justifica este código.

## Workflow

### Fase 1: Análisis de Valor
1. **Analizar la necesidad:** ¿Esta función o archivo responde directamente a los módulos core (Plan de Cuentas, Hoja de Cargas, Anual, Presupuestación, Panel, DB Centralizada)?
2. **Identificar "Deuda / Obsoleto":** Revisar si el código pertenece a una arquitectura anterior y compleja que no aporta valor.

### Fase 2: Diferenciación en el SCR
3. **Marcar código válido:** Todo código que sea parte de la "reinversión" y genere valor será documentado mediante pragmas, comentarios (por ejemplo, `// [AGILE-VALOR]`) o etiquetas correspondientes a su módulo.
4. **Descartar/Eliminar:** Todo código que no justifique su existencia basada en valor y simplicidad será etiquetado para su eliminación (ej. `// [DEPRECADO]`) o eliminado directamente si el usuario lo ordena.

### Fase 3: Ejecución Ágil
5. **No sobrediseñar:** Evitar variables huérfanas o bases de datos excesivamente complejas. La simplicidad ("Integralidad") es la meta.
6. **Desarrollo Modular:** Asegurar que el código del módulo no interfiera negativamente con otros, y pueda funcionar independientemente como un "DLC".

## Instrucciones
- **Cuestiona cada línea:** Si el código no aporta una función CLAVE para la gestión de finanzas, elimínalo.
- **Diferencia lo nuevo:** Siempre deja una constancia de lo nuevo/validado. Utiliza convenciones de comentarios para "separar la paja del trigo".
- **Mantén la documentación sincronizada:** Asegura que los cambios estén documentados en los Historiales (ej. ADRs o `HISTORIAL_DESARROLLO.md`).

## Output
1. Código revisado, simplificado y etiquetado.
2. Un resumen breve explicándole al usuario qué valor se aportó y qué partes complejas o inútiles fueron retiradas de la ecuación.
