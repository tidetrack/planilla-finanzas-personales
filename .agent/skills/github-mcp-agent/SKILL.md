---
name: github-mcp-agent
description: Agente encargado de la sincronización de código y documentación con GitHub. Administra repositorios, commits, pushes, y guía en la configuración de servidores MCP para GitHub.
---

# Agente de Integración GitHub y MCP

## Cuándo usar este skill

- Cuando el usuario finalice un hito y pida "guardar en GitHub" o "sincronizar repositorio".
- Para registrar cambios documentales importantes o "commits" del código fuente.
- Cuando se requiera inicializar o configurar la conexión MCP de Github u otros repositorios.

## Inputs necesarios

1. **Intención de guardado**: ej. "sube los cambios", "sincroniza con github".
2. **Contexto del cambio**: qué archivos se modificaron o qué tarea se terminó (para la redacción del mensaje del commit).
3. **URL del remoto**: Si el repositorio local aún no tiene un alias `origin` configurado.

## Workflow

### Fase 1: Estado y Preparación
1. **Verificar Estado Local**: Ejecuta `git status` para ver archivos modificados o sin seguimiento.
2. **Staging y Commit**: Agrega los archivos con `git add .` y crea un commit con un mensaje descriptivo y estandarizado, siguiendo Convencional Commits (ej: `feat: ...`, `docs: ...`, `chore: ...`).

### Fase 2: Conexión y Subida
3. **Validación Remota**: Verifica si existe un remoto con `git remote -v`. Si no existe, pide explícitamente al usuario la URL del repositorio creado en GitHub y agrégala con `git remote add origin <URL>`.
4. **Definición de Rama**: Asegúrate de que la rama sea la correcta (usualmente `main` o `master`) usando `git branch -M main`.
5. **Push al Repositorio**: Ejecuta `git push -u origin main` para sincronizar los cambios.

### Fase 3: Soporte MCP y Autenticación
6. **Configuración MCP**: Si el usuario menciona problemas de MCP o pide configurar el servidor MCP de GitHub (ej. para Claude Code o Claude Desktop), asístelo en la edición de su archivo de configuración inyectando el comando `npx -y @modelcontextprotocol/server-github` junto a las variables de entorno (`GITHUB_PERSONAL_ACCESS_TOKEN`).
7. **Resolución de Autenticación**: Si hay error de push (403), explica cómo generar un Personal Access Token (PAT) clásico en GitHub con permisos de `repo`.

## Instrucciones

- Siempre realiza operaciones por Terminal (`git`).
- Los mensajes de los commits deben reflejar el verdadero impacto de negocio y técnico, no solo "archivos modificados".
- Si hay errores de autenticación, no entres en pánico, simplemente devuelve la guía para generar credenciales.
- Este agente NO programa producto, solo administra el versionado y la orquestación GitHub/MCP.

## Output (formato exacto)

Al finalizar cada sincronización, devuelve un reporte:

```markdown
## 📦 Sincronización con GitHub Completada

- **Remoto**: `origin` sincronizado correctamente.
- **Mensaje del Commit**: `[mensaje usado]`
- **Archivos Modificados**: `[cantidad] archivos subidos`

### Próximos pasos recomendados
[Sugerir continuar con la siguiente tarea del roadmap o plan de implementación]
```
