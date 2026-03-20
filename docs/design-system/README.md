# Ocean Theme Design System

Este directorio contiene la documentación del sistema de diseño **Ocean Theme** utilizado en todos los módulos de UI de Tidetrack.

## Archivos

### `UI_SharedStyles.css`

Archivo de **referencia completa** con todas las variables CSS, estilos base y componentes reutilizables del sistema de diseño.

**Nota:** Este archivo `.css` NO se puede usar directamente en Apps Script.

### En `src/UI_SharedStyles.html`

**Template de referencia OBLIGATORIO** para crear nuevos módulos HTML.

> **️ IMPORTANTE:** Apps Script NO soporta includes dinámicos de manera confiable.
>
> **En lugar de usar includes:** Cuando crees un nuevo módulo HTML, DEBES copiar el contenido completo de `<style>` desde `UI_SharedStyles.html` y pegarlo en tu nuevo archivo.

## Variables CSS Principales

### Colores

- `--ocean-bg`: #eff2f9 (Fondo principal)
- `--ocean-card`: #f4f7fc (Tarjetas/contenedores)
- `--ocean-primary`: #39444d (Texto principal/botones)
- `--ocean-secondary`: #6e7f8d (Texto secundario)
- `--accent-success`: #27ae60 (Éxito)
- `--accent-error`: #e74c3c (Error)
- `--accent-blue`: #3498db (Acento azul)

### Espaciado

- `--spacing-xs` a `--spacing-xxl` (0.25rem a 2.5rem)

### Bordes

- `--radius-sm` a `--radius-xxl` (0.5rem a 2.5rem)
- `--radius-pill`: 9999px (botones pill/badges)

### Sombras

- `--shadow-sm` a `--shadow-xl`
- `--shadow-inset`: Para efectos glassmorphism

## Componentes Reutilizables

- `.manager-container` - Contenedor principal (700px o 1000px wide)
- `.btn-back`, `.btn-add`, `.btn-icon` - Botones
- `.search-box` + `.search-input` - Búsqueda
- `.cuenta-item`, `.medio-item`, `.moneda-item` - Cards de items
- `.form-field`, `.field-input`, `.field-select` - Formularios
- `.modal-overlay` + `.modal-content` - Modales
- `.loading`, `.empty-state`, `.spinner` - Estados

## Uso

Al crear un nuevo módulo HTML, incluir los estilos compartidos y usar las clases definidas:

```html
<!DOCTYPE html>
<html>
 <head>
 <link
 href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
 rel="stylesheet"
 />
 <link
 href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
 rel="stylesheet"
 />

 <?!= include('UI_SharedStyles') ?>

 <!-- Estilos específicos del módulo aquí -->
 </head>
 <body>
 <div class="manager-container">
 <!-- Usar clases compartidas -->
 </div>
 </body>
</html>
```
