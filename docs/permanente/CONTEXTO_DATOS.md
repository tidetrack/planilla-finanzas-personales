# 🗄 Contexto de Datos (Backend Tracker)

Este documento reconstruye de forma semántica las Hojas de Cálculo que actúan como **Bases de Datos** (Data Lakes) dentro de Tidetrack, basándose en la extracción profunda del JSON de Arquitectura. 

## 1. Registros (Transaccional Core)
- **Rol**: La tabla transaccional principal donde se asientan todos los movimientos financieros.
- **Estructura Habilitada**: 2879 filas × 20 columnas. Sin celdas congeladas.
- **Segmentos Detectados**:
  - El header principal comienza en la 8va columna con la etiqueta literal `"Registros."`. Esto significa que las columnas reales (A-G o A-H) se utilizan como márgenes o metadatos, y la base de datos inicia desplazada (probablemente desde I).
  - **Paleta de Colores Asociada**: `#34475d` (Seguramente Headers o divisores) y `#eff2f9` (Fondo de celdas transaccionales).
- **Fórmulas**: No se detectaron fórmulas complejas de negocio inyectadas. Es una tabla de ingesta pura (CRUD a través de Apps Script).

## 2. Plan de Cuentas (Dimensión / Catálogo)
- **Rol**: El maestro de cuentas, proyectos y clasificaciones.
- **Estructura Habilitada**: 1000 filas × 25 columnas.
- **Segmentos Detectados**:
  - Similar a Registros, el header de anclaje se encuentra en la 8va columna (`"Plan de Cuentas."`).
  - Contiene una fórmula agregadora maestra (`ARRAYFORMULA(QUERY(FLATTEN({I4:I;L4:L...})))`) que consolida dinámicamente elementos distribuidos en varias sub-columnas (probablemente agrupando Ingresos, Gastos Fijos, Gastos Variables y Medios de Pago en una lista plana para validaciones de datos).
- **Paleta Relacional**: Comparte estéticamente la paleta de la Base de Datos (`#34475d`, `#eff2f9`).

## 3. Tipos de Cambio (Dimensión Histórica)
- **Rol**: Repositorio de cotizaciones históricas.
- **Estructura Habilitada**: 815 filas × 19 columnas.
- **Segmentos Detectados**:
  - Header de anclaje `"Monedas."` en la columna 8.

## 4. BD Antigua (Archivo Histórico)
- **Rol**: Tabla plana legacy.
- **Estructura Habilitada**: 2950 filas × 8 columnas. 
- **Mapeo Explícito**: Es la única tabla que retiene una estructura columnar tradicional desde la celda A1: `"Fecha", "Ingreso", "Egreso", "Detalle", "Medio", "Tipo", "Observacion", "Cuentas Faltantes"`.
- **Paleta Relacional**: Usa un color oscuro (`#39444d`) indicando archivo "muerto" o no interactivo.

---
> [!NOTE]
> **Patrón Arquitectónico Universal:** Exceptuando la `BD Antigua`, todas las hojas de "Backend" de Tidetrack tienen un offset estructural. Desplazan sus encabezados hacia la columna 8 (H) o 9 (I) para reservar el margen izquierdo, muy probablemente para alojar controles UI o facilitar visualizaciones parciales.
