# Equipo de agentes Claude Code

Tidetrack Finanzas Personales tiene 6 agentes especializados en `.claude/agents/` ademas del PM. Clon adaptado del equipo del repo hermano de pymes, ajustado a un producto Apps Script single-user (sin webapp ni multi-tenant todavia).

| Agente | Jurisdiccion | Invocar cuando |
|---|---|---|
| `appscript-backend` | `src/*.js` | Logica GAS, 00_Config (SHEETS/RANGES), procesarCargas, triggers, cotizaciones, SheetManager, migraciones, deploy clasp |
| `appscript-ui` | `src/*.html`, 11_UIService, menus | UI embebida HtmlService, Design System neumorfico, endpoints google.script.run, navegacion |
| `docs-keeper` | `docs/`, ZZ_Changelog, CLAUDE.md, ESTRUCTURA | Changelog dual, ADRs, esquema de datos, mapa de archivos |
| `qa-tester` | verificacion | Validar pipeline batch, cascada FX, integridad relacional, idempotencia |
| `lean-refactor` | `src/` (forma) | Duplicacion, dead code, simplificacion sin cambiar comportamiento |
| `security-auditor` | secrets, scopes | OAuth scopes, .env.local, claves API, funciones expuestas |

## Notas

- No existe agente de webapp ni de pipeline Supabase: ese frente no esta construido (ADR-001, migracion futura). Si Franco lo arranca, se agregaran agentes nuevos.
- El equipo Antigravity (`.agent/skills/`, `.agent/workflows/`) sigue existiendo en paralelo. Los nombres se solapan parcialmente (tidetrack-pm, appscript-backend, lean-code-expert/lean-refactor): cuando se trabaja desde Claude Code, mandan los de `.claude/agents/`.
