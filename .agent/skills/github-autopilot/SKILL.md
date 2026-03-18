---
name: github-autopilot
description: Skill de automatización total. Permite activar un centinela ("watcher") local que observa cada modificación en los archivos del proyecto y automáticamente ejecuta un commit (chore) y un push a GitHub sin requerir intervención humana.
---

# GitHub Autopilot (Agente de Sincronización Continua)

## Cuándo usar este skill

- Cuando quieres concentrarte exclusivamente en codificar (o modificar sheets locally) y que el resguardo se haga "mágicamente" de fondo.
- Al inicio de una sesión de trabajo donde sospechás que harás muchas modificaciones o si temés perder tu progreso.
- Siempre que el usuario diga: _"ayudame a no tener que acordarme de guardar en GitHub"_.

## Inputs necesarios

- El entorno debe tener **Node.js** instalado (es un requisito ubicuo para usar `npx` o MCPs, por lo que casi seguro ya está cumplido en Antigravity).
- El proyecto ya debe tener un `git init` y un `git remote` validado con tokens o claves SSH funcionando (ver `github-mcp-agent` en caso de fallas de auth).

## Workflow (Activación)

1. Abrí una pestaña de Terminal en la raíz de tu proyecto (`planilla-finanzas-personales`).
2. Ejecutá el programa que escribimos para vos:
   ```bash
   node scripts/auto-sync.js
   ```
3. Verificá que la terminal indique "🚀 Iniciando Github Auto-Sync...".
4. Podés minimizar esa Terminal y olvidarte. Cada vez que modifiques, el programa va a juntar los cambios durante 10 segundos continuos, hacer `git add .`, armar un commit predefinido y enviarlo (push) a GitHub.

## Instrucciones y Precauciones

- **No lo uses para Sprints Finales**: Como los mensajes del commit son automáticos (`chore(auto): backup del proyecto...`), el repositorio quedará lleno de estos micro-commits en la rama que estés usando.
- **Detener el Autopilot**: Simplemente andá a la Terminal minimizada y apretá `CTRL + C` para matar el proceso de Node. 
- **Errores Ocasionales**: Al estar en vigilancia contínua, si editaste el archivo y todavía se está guardando y hace commit a medias, el próximo ciclo lo arreglará. No entres en pánico si dice "Error en push".

## Output (formato exacto)

El agente (script) no imprime Markdown, sino puro Log en tiempo real de tu terminal, viéndose así:
```text
[14:45:01] Modificación en 'src/00_Config.js'. Sincronizando con GitHub...
✅ Push exitoso.
```

### Notas adicionales
- El debounce de 10 segundos previene que un "guardar automático" que salva cada vez que tocás una tecla en tu teclado o IDE, spammee y abrume 100 veces seguidas la red remota o te bloquee la cuenta.
