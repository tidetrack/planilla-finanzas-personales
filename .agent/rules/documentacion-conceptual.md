# Regla: Documentacion Conceptual y de Negocios (NotebookLM)

## Contexto y Objetivo
Tidetrack no es solo un software; es una herramienta de habito financiero con vocacion educativa. Toda la base de conocimiento del proyecto sera eventualmente consumida o parseada por una IA tipo **NotebookLM** que actuara como tutor financiero/tecnico. Por lo tanto, **no basta con documentar como funciona el codigo**: se debe documentar de forma exhaustiva el **POR QUE** teorico, financiero y de producto de cada aspecto de la planilla.

## Division de Tareas
- `agente-contextual` / `docs-keeper`: encargados de generar (o requerir que se generen) los documentos teoricos dentro de `docs/permanente/` cada vez que se cierra una funcionalidad (ej: Modulo ABM Plan de Cuentas, Hoja de Cargas, Tablero, Presupuestacion mensual).
- `github-docs`: responsable de replicar ese valor en la cara publica del proyecto en GitHub. Los README y Wikis deben dejar claro el concepto funcional antes de explicar la implementacion en codigo.

## Criterios de Documentacion Obligatoria
Ante cualquier feature mayor o bloque del producto que se complete, se **debe crear/actualizar un documento conceptual**. El reporte debe contener obligatoriamente:
1. **Definicion simple**: Que es la herramienta.
2. **Valor para el usuario**: El problema financiero personal que resuelve (alineado a la promesa "paz financiera, todos los dias").
3. **Fundamento teorico/financiero**: Bases del modelo (ej. multi-moneda nativo, congelamiento de cotizaciones, flujo vs ahorro vs inversion segun tipo de proyecto).
4. **Guia de uso**: Como usarlo en la UI.
5. **Relaciones**: Que hojas se nutren de esta data (Plan de Cuentas, Registros, Tipos de cambio, hojas ocultas CALCU/ANUAL).

Ningun feature core o hito de la planilla debe darse por completado en GitHub si el equipo no ha alimentado la base de conocimiento conceptual.
