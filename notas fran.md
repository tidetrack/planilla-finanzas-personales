## Notas de claude

Qué consultar con Cowork (priorizado por lo que desbloquea)

1. Hoja de Cargas — validación de entrada (desbloquea: decidir si Gap 2 es crítico o teórico)
¿El rango de carga I5:O19 usa listas de validación (dropdowns) en las columnas Cuenta y Medio, alimentadas desde el Plan de Cuentas? ¿O es texto libre? Y si el catálogo cambia después de una carga, ¿qué pasa con los valores ya escritos?

2. Presupuesto del Tablero S13:S15 (desbloquea: el ABM de Presupuesto mensual, que es el próximo dev que te recomendé)
¿Cómo se ingresan hoy esos valores? ¿Son celdas manuales en el Tablero, o salen de otra hoja? ¿Hay estructura mensual (12 columnas / una fila por mes) o un solo set de valores? Esto define el esquema del ABM antes de programarlo.

3. Hoja oculta CALCU (gid=367882887) (desbloquea: backend del Tablero + migración de fórmulas, ADR-006)
Mapear su layout interno en MAPA_HOJAS.md: qué rangos calcula, qué fórmulas matriciales usa (QUERY/LET), de qué hojas lee y qué consume el Tablero de ahí.

4. Hoja oculta ANUAL (gid=1358411018) (desbloquea: Resumen anual, Fase 2.3)
Layout y fórmulas del motor, y su relación con la hoja visible "Mirada Interanual".

5. DATA-ENTRY (gid=1849033622) (desbloquea: confiar en DATABASE_SCHEMA)
Confirmar su rol real y validar que el esquema documentado esté al día.

Las 1 y 2 son las que destraban acción inmediata mía. Con la respuesta a #2 puedo arrancar el ABM de Presupuesto mensual sin depender de nada más; con la #1 decidimos si meto el fix de Gap 1/Gap 2 en appscript-backend ahora o lo dejamos como pendiente.

¿Querés que prepare ya el plan del ABM de Presupuesto para tenerlo listo apenas Cowork confirme el punto 2, o preferís que primero ataque los gaps de validación?