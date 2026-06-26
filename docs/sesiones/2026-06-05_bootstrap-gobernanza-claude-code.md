# Sesion 2026-06-05 - Bootstrap de gobernanza Claude Code

## Objetivo
Nivelar este repo (Tidetrack Finanzas Personales) a la gobernanza del repo hermano de pymes, para poder operarlo desde Claude Code ademas de Google Antigravity. Capa puramente aditiva: no se toco `src/`, ni la documentacion existente, ni la estructura del repo.

## Contexto
El repo ya estaba maduro (v0.8.0) y armado para Antigravity: su ecosistema de agentes vivia solo en `.agent/` (skills, workflows, rules). Faltaba la capa de Claude Code (`.claude/agents/`) y 4 reglas operativas. Decision de Franco: clonar el equipo de agentes del repo de pymes, adaptado a un producto Apps Script single-user (sin webapp ni multi-tenant todavia).

## Que se agrego

### `.claude/agents/` (6 agentes + PM)
- `tidetrack-pm` - orquestador, punto de entrada unico.
- `appscript-backend` - guardian de `src/*.js` (GAS, 00_Config, procesarCargas, cotizaciones, SheetManager).
- `appscript-ui` - UI HtmlService, Design System neumorfico, endpoints google.script.run.
- `docs-keeper` - changelog dual, ADRs, esquema de datos, ESTRUCTURA.
- `qa-tester` - verificacion del pipeline batch, cascada FX, integridad relacional.
- `lean-refactor` - duplicacion / dead code / simplificacion en `src/`.
- `security-auditor` - scopes OAuth, secrets, claves API, superficie expuesta.

### `.claude/agent-memory/tidetrack-pm/`
Memoria persistente del PM: perfil de Franco, equipo de agentes, reglas de coordinacion.

### `.agent/rules/` (4 reglas nuevas)
`changelog-obligatorio`, `contexto-en-codigo`, `documentacion-conceptual`, `appscript-link`. Se suman a las 3 existentes (`no-emojis`, `estructura-obligatoria`, `dispatcher`).

### Otros
- `CLAUDE.md` raiz: nueva seccion "Equipo de Agentes (Claude Code)" con tabla de ruteo. Resto intacto.
- `.gitignore`: se agrego `.env.local` (estaba sin ignorar; riesgo de commitear secrets).

## Que NO se hizo (y por que)
- No se scaffoldeo webapp. En este repo la webapp es vision futura (ADR-001: migrar cuando se superen ~3.000 transacciones). Queda para cuando Franco lo decida.
- No se modifico ningun `.js`, ni docs existentes, ni la estructura. Todo aditivo y reversible.

## Pendiente / proximos pasos
- Extraccion con Claude Cowork: recorrer la planilla viva para validar/actualizar el modelo de datos documentado y el dump del Apps Script.
- Evaluar limpiar los emojis heredados en `MENU_CONFIG` de `00_Config.js` (violan `no-emojis.md`).
