# Tidetrack - Personal Finance Tracker 🌊

> **"Paz financiera, todos los días"**

Sistema de finanzas personales *Principles First*, diseñado para sostener un hábito cotidiano con fricción mínima, operando a través de Hojas Modulares escalables y listo para la Inteligencia Artificial.

---

## 🎯 ¿Qué es Tidetrack?

**Tidetrack** es una herramienta de registro ultrarrápido, lectura clara y planificación financiera. En esta nueva etapa, el proyecto pivotó de una "mega base de datos relacional" compleja a un **Ecosistema de Hojas Modulares y Funciones Nativas**, haciendo que los datos sean legibles, estables y listos para ser consumidos y analizados por IAs (como Claude Code o herramientas MCP).

---

## 🚀 Navegación del Proyecto (Arquitectura Modular)

El proyecto está organizado para ser fácilmente navegable desde GitHub. Cada componente tiene un propósito aislado, de forma que agregar extensiones ("DLCs") no rompa el ecosistema central.

### 📚 Documentación Estratégica
- [Planilla Reinversión (Directivas User)](planilla-reinversión.md) - Documento fundacional del pivote arquitectónico.
- [Plan de Implementación Actual](docs/permanente/implementation_plan.md) - Pasos técnicos detallados para las nuevas Hojas Modulares.
- [Historial de Desarrollo](docs/permanente/HISTORIAL_DESARROLLO.md) - Bitácora cronológica con las decisiones Técnicas (ADRs).
- [Estructura de Directorios](ESTRUCTURA.md) - Mapa detallado de todos los archivos.

### 🧩 Bases de Datos y Módulos (En Desarrollo)
El sistema estará compuesto por las siguientes *Hojas Modulares*:
1. **Plan de Cuentas / Bases**: Catálogos estáticos de `Monedas`, `Medios de Pago`, `Proyectos` y `Cuentas`.
2. **Hoja de Cargas**: `DATA-ENTRY` simplificado (Idiot-Proof).
3. **Módulos de Análisis (vía `=QUERY()`)**:
   - Tablero General
   - Presupuestación Mensual
   - Resumen Anual

---

## 🤖 Agentes Inteligentes y Ecosistema (MCP)

Este proyecto no solo es operado por humanos, sino también desarrollado junto a un ecosistema de agentes en [Antigravity](https://antigravity.dev):
- **@agente-contextual**: Mantiene la estructura documental impoluta y previene el *Context Rot*.
- **@github-mcp-agent**: Administra la integración con este repositorio y el servidor MCP.
- **@github-autopilot**: Script de sincronización continua para *commit* y *push* sin intervención manual.

> **💡 Prompting the Repo**: La documentación está escrita de tal forma que cualquier LLM (Claude, ChatGPT, Gemini) puede "leer" el repositorio y construir lógicas encima de nuestras hojas de cálculo.

---

## 📂 Directorios Raíz

```text
/
├── .agent/          # Skills, Workflows y reglas de los agentes de IA
├── src/             # Scripts de Google Apps Script y Frontend UI (.js y .html)
├── docs/            # Backlog, ADRs y principios de diseño
├── scripts/         # Herramientas de automatización local (ej. auto-sync)
└── README.md        # Índice maestro
```

---

*Proyecto en transición: De v0.4.0 (Mega-Tabla Relacional) a v0.5.0 (Sistema Modular "Principles First"). Última actualización: 2026-03-17*