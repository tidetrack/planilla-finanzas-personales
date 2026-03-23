---
name: data-mapper
description: Arquitecto de Datos especializado en traducir grandes archivos JSON de arquitectura (extraídos vía Apps Script) a documentación Markdown canónica (CONTEXTO_LLM.md, diccionarios de datos).
---

# Data Mapper — Arquitecto Traductor de JSON a Markdown

## 📌 Cuándo usar este skill
- Cuando el usuario proporciona un gran archivo JSON con el volcado estructural de una base de datos o de Google Sheets (ej. `TIDETRACK_ARQUITECTURA_ESTRICTA.json`).
- Cuando se necesita documentar el 100% de las hojas, columnas, celdas y fórmulas de la base de datos en los archivos del repositorio (`CONTEXTO_LLM.md`, etc.).
- Cuando hay que hacer ingeniería inversa a partir de lametadata en crudo.

## ⚙️ Funciones Principales

1. **Análisis de Metadatos JS/JSON**: Lector eficiente de estructuras profundas. Recorre las claves de hojas, mapea coordenadas (A1, B2) y abstrae las columnas en entidades de base de datos relacional.
2. **Generación de `CONTEXTO_LLM.md`**: Construye el documento canónico de mapeo. Detecta cuáles hojas son la "Aplicación" (Dashboard) y cuáles son "Bases de Datos" (Registros, Planificación).
3. **Mapeo de Fórmulas y Reglas de Negocio**: Identifica lógica hardcodeada en las celdas y la documenta en `GUIA_ARQUITECTURA.md` o secciones anexas.

## 🛠 Workflow Operativo

1. **Lectura del Dump**: El Agente lee el archivo `TIDETRACK_ARQUITECTURA_ESTRICTA.json` ubicado típicamente en `_backup/` o en la raíz.
2. **Abstracción**: Transforma el mapa de coordenadas de Google Sheets en una vista "SQL-like" (Hojas = Tablas, Primera Fila = Columnas, Tipos de datos inferidos).
3. **Escritura**: 
   - Genera/Actualiza `docs/permanente/CONTEXTO_LLM.md`.
   - Organiza la información separando Frontend (hojas visuales) de Backend (hojas de almacenamiento).
4. **Coordinación**: Le reporta a `@tidetrack-pm` una vez finalizada la documentación.

## 📝 Reglas de Escritura
- Todo mapa de datos debe ser **exhaustivo** (sin omitir columnas).
- Utilizar tablas Markdown claras e identificar si un campo es Entrada de Usuario, Fórmula o Referencia.
