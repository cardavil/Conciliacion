# DESIGN.md — Diseño del Sistema

> Referencia visual y funcional para la UI.

---

## 1. LAYOUT GENERAL

```
┌──────────────────────────────────────────────────┐
│  TOPBAR                                          │
│  Logo · Período activo · Estado general          │
├──────────────────────────────────────────────────┤
│                                                  │
│  CONTENIDO PRINCIPAL                             │
│                                                  │
│  4 etapas apiladas verticalmente (acordeón)      │
│  Cada etapa se expande/colapsa                   │
│  Solo una etapa activa a la vez                  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Etapa 1 · Revisión de Entorno     [✓ OK]  │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ Etapa 2 · Validación por Fuente   [⚠ 2]   │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ Etapa 3 · Conciliación            [● ACT] │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ Etapa 4 · Reportes                [🔒]     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Log de actividad                           │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 2. TOPBAR

```
┌──────────────────────────────────────────────────┐
│  Conciliación Quincenal · Q1 · Mayo 2026  [● EN PROCESO] │
└──────────────────────────────────────────────────┘
```

- Título del sistema
- Período activo (quincena, mes, año)
- Badge de estado general (EN PROCESO / COMPLETADO / ERROR)

---

## 3. SISTEMA DE ETAPAS

### Estados de cada etapa
```
LOCKED   →  gris, no clickeable, etapa anterior no completada
ACTIVE   →  azul, expandida, etapa en curso
OK       →  verde, completada sin problemas
WARN     →  amarillo, completada con advertencias
ERROR    →  rojo, tiene errores que bloquean avance
```

### Reglas de navegación
```
- Las etapas son secuenciales (1 → 2 → 3 → 4)
- No se puede avanzar si la etapa actual tiene errores críticos
- Se puede volver a etapas anteriores (para revisar, no para editar)
- La etapa activa se expande automáticamente
- Las completadas muestran resumen colapsado
- Las pendientes muestran solo el header con candado
```

---

## 4. ETAPA 1 — REVISIÓN DE ENTORNO

```
┌────────────────────────────────────────────────────┐
│ Etapa 1 · Revisión de Entorno              [✓ OK] │
├────────────────────────────────────────────────────┤
│                                                    │
│  [📁 Seleccionar carpeta de entrada]               │
│  Ruta: C:\datos\quincena_mayo  ●                   │
│  3 archivos detectados                             │
│                                                    │
│  [📁 Seleccionar carpeta de salida]                │
│  Ruta: C:\datos\salida  ●                          │
│                                                    │
│  ─────────────────────────────────────             │
│  Archivos detectados                               │
│                                                    │
│  Estado │ Nombre          │ Tipo  │ Categoría │ KB │
│  ●      │ emp1.txt        │ TXT   │ Fuente    │248 │
│  ●      │ emp2.txt        │ TXT   │ Fuente    │312 │
│  ●      │ descuentos.xlsx │ XLSX  │ Fuente    │189 │
│  ●      │ maestro.xlsx    │ XLSX  │ Fuente    │  4 │
│                                                    │
│  ─────────────────────────────────────             │
│  Formato numérico                                  │
│  Separador decimal: [Coma (,) ▼]                   │
│  Separador miles:   [Punto (.) ▼]                  │
│  Idioma detectado:  es-CO                          │
│                                                    │
│           [↻ Actualizar] [▶ Continuar a Etapa 2]  │
└────────────────────────────────────────────────────┘
```

### Elementos
- Selector de carpeta de entrada (File System Access API, no drag & drop)
- Selector de carpeta de salida (opcional, para escribir reportes directo a disco)
- Tabla de archivos detectados: estado (dot), nombre, tipo, categoría, tamaño
- Tags de tipo de archivo (TXT, CSV, XLSX) con color diferenciado
- Configuración de formato numérico: separador decimal y de miles (dropdowns)
- Idioma detectado del navegador
- Botón actualizar (re-lee carpeta)
- Botón continuar (habilitado si hay archivos)

---

## 5. ETAPA 2 — VALIDACIÓN POR FUENTE

```
┌──────────────────────────────────────────────────────────┐
│ Etapa 2 · Validación por Fuente                  [⚠ 2]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ℹ Si necesita corregir valores, actualice el archivo    │
│    y presione [Volver a analizar]                        │
│                                                          │
│  ANÁLISIS DE CALIDAD POR ARCHIVO                         │
│  ┌──────────────────────────────────────────────────┐    │
│  │● emp1.txt  1842 filas · 8 cols  [OK]             │    │
│  │  Columna │ Tipo   │ Inv. │ Válidos │ Vacíos │ Mu.│    │
│  │  CEDULA  │ texto  │  0   │  1842   │   0    │ 00.│    │
│  │  MONTO   │ numér. │  3↗  │  1839   │   0    │ 1..│    │
│  │  ↗ = click para ver detalle de inválidos         │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │⚠ descuentos.xlsx  671 filas · 5 cols  [2 ⚠]     │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  CONFIGURACIÓN DE CRUCE                                  │
│  ┌──────────────────────────────────────────────────┐    │
│  │ emp1.txt, emp2.txt  [Cuenta de cobro ▼] [CEDULA▼]│    │
│  │ descuentos.xlsx     [Descuentos ▼]      [CC ▼]   │    │
│  │ maestro.xlsx        [Maestro ▼]         [ID ▼]   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  MAPEO DE COLUMNAS (tabla matricial)                     │
│  ┌─────────┬────────┬────────┬────────┬───────┬─────┐   │
│  │ Archivo │Nombre  │Cod.emp │APORTES │AHORROS│CRED.│   │
│  │ Maestro │[— ▼]   │[— ▼]   │[— ▼]   │[— ▼]  │[— ▼]│   │
│  │ CC      │[NOM ▼] │[COD ▼] │[APO ▼] │[AHO ▼]│[CRE]│   │
│  │ Desc    │[NOM ▼] │[COD ▼] │[APO ▼] │[AHO ▼]│[CRE]│   │
│  └─────────┴────────┴────────┴────────┴───────┴─────┘   │
│                                                          │
│  ✓ Configuración lista — 3 conceptos: APORTES, ...      │
│                    [▶ Continuar a Etapa 3]               │
└──────────────────────────────────────────────────────────┘
```

### Elementos
- Alerta informativa con botón "Volver a analizar" (re-lee archivos de carpeta)
- Tarjetas EDA expandibles por archivo:
  - Tabla de columnas: nombre, tipo, inválidos, válidos, vacíos, únicos, muestra
  - Click en conteo de inválidos → mini-tabla Fila/Valor (cap 50 registros)
  - Tags de tipo: texto (gris), numérico (azul), fecha (violeta)
  - Mini-bar visual de porcentaje de nulos por columna
  - Badge de llave sugerida en columna candidata
  - Paginación si hay muchas columnas
- Configuración de cruce:
  - Fila por archivo: nombre + dropdown de rol + dropdown de llave
  - Roles: No usar / Cuenta de cobro / Descuentos / Maestro
  - Multi-TXT: todos los TXT de CC se muestran como una sola fila con nombres combinados
  - Llave: columnas del archivo (default = llave sugerida del EDA)
- Tabla matricial de mapeo de columnas:
  - Filas: Maestro (si existe, primero) → CC → Desc
  - Columnas: campos opcionales (Nombre, Cod, Empresa) → conceptos fijos (APORTES..CREDITO)
  - Cada celda = dropdown con columnas reales del archivo
  - Auto-selección por coincidencia de nombre
- Mensaje de validación: conceptos detectados (intersección CC ∩ Desc)
- Botón de avance habilitado solo con configuración válida

---

## 6. ETAPA 3 — CONCILIACIÓN

```
┌──────────────────────────────────────────────────────────┐
│ Etapa 3 · Conciliación                       [● ACT]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Período: Q1 Mayo 2026                                   │
│                                                          │
│  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐          │
│  │  1618  │ │    24    │ │    3     │ │ 98.5%│          │
│  │ Match  │ │Sin match │ │Duplicados│ │ Cob. │          │
│  └────────┘ └──────────┘ └──────────┘ └──────┘          │
│  ┌────────────┐ ┌──────────────┐  (condicionales)       │
│  │  5 No Mro. │ │ 12 Sin Act. │                         │
│  └────────────┘ └──────────────┘                         │
│                                                          │
│  OK: 1500 · Excedente: 42 · Faltante: 68 · Error: 8    │
│                                                          │
│  COLA DE EXCEPCIONES                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Llave↕ │ Tipo     │ Concepto │ Esperado │ Real  │    │
│  │        │          │          │    ?     │   ?   │    │
│  │ 12345  │●FALTANTE │ APORTES  │ $50,000  │$45,000│    │
│  │ 67890  │●EXCEDENTE│ CREDITO  │ $30,000  │$35,000│    │
│  │ 11111  │●SIN_MATCH│ —        │ $20,000  │   —   │    │
│  │                                                 │    │
│  │ Acciones: [✓ Aprobar] [✏ Corregir] [✗ Excluir] │    │
│  │ Comentario: ______________________________ (req)│    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  NOVEDADES                                               │
│  (nuevos, retirados filtrados por quincena)              │
│                                                          │
│                      [▶ Generar Reportes]                │
└──────────────────────────────────────────────────────────┘
```

### Métricas de cruce (siempre visibles)
- Match: llaves presentes en ambas fuentes
- Sin match: llaves en una fuente pero no en la otra
- Duplicados: llaves repetidas
- Cobertura: porcentaje de match sobre total

### Métricas condicionales (visibles solo si aplican)
- No Maestro: llaves en CC/Desc que no están en maestro (solo si maestro asignado)
- Sin Actividad: llaves en maestro sin registros en CC ni Desc (solo si maestro asignado)

### Resumen de conciliación
- OK / Excedente / Faltante / Error con conteos

### Cola de excepciones
- Tabla sorteable por click en headers (Llave, Tipo, Concepto, Esperado, Real, Diferencia)
- Indicadores de sort: ▲/▼ en header activo
- Columna Tipo con badges de color:
  - OK (verde), EXCEDENTE (naranja), FALTANTE (rojo), SIN_MATCH (azul)
  - NO_MAESTRO (rojo oscuro), SIN_ACTIVIDAD (amarillo)
  - DATA_QUALITY (violeta), ERROR (rojo)
- Tooltips `?` en headers Esperado/Real: click-to-show (no hover), explican CC vs Desc
- Cada excepción tiene botones de acción: Aprobar / Corregir / Excluir
- Panel flotante de acción con comentario obligatorio (audit trail)
- Botón "Generar Reportes" habilitado al resolver todas las excepciones

### Novedades
- Asociados nuevos (fecha_ingreso en quincena actual)
- Asociados retirados (fecha_retiro en quincena actual)
- Solo si maestro tiene columnas de fecha configuradas

---

## 7. ETAPA 4 — REPORTES

```
┌────────────────────────────────────────────────┐
│ Etapa 4 · Reportes                  [✓ OK]     │
├────────────────────────────────────────────────┤
│                                                │
│  Archivos generados:                           │
│  📄 resumen_ejecutivo          [⬇ Descargar]   │
│  📄 excepciones_detalle        [⬇ Descargar]   │
│  📄 conciliacion_completa      [⬇ Descargar]   │
│  📄 novedades                  [⬇ Descargar]   │
│  📄 audit_log                  [⬇ Descargar]   │
│                                                │
│           [⬇ Descargar todo (.zip)]             │
└────────────────────────────────────────────────┘
```

### Elementos
- Lista de reportes generados con botón de descarga individual
- Descarga masiva como .zip (JSZip)
- Si hay carpeta de salida configurada en Etapa 1: escribe directo al disco

---

## 8. LOG DE ACTIVIDAD

```
┌────────────────────────────────────────────────┐
│ Log de actividad                               │
├────────────────────────────────────────────────┤
│ 14:02  ✓ Entorno validado                      │
│ 14:04  ✓ emp1.txt — 1842 registros OK          │
│ 14:05  ⚠ descuentos.xlsx — 2 advertencias      │
│ 14:08  • Conciliación ejecutada                │
│ 14:10  ✓ Reportes generados                    │
└────────────────────────────────────────────────┘
```

- Siempre visible al fondo de la página
- Scroll independiente
- Cada entrada: timestamp HH:MM + icono de nivel + mensaje
- Niveles: ok (✓ verde), warn (⚠ amarillo), error (✗ rojo), info (• gris)

---

## 9. PALETA DE COLORES

### Semáforo de estados
```
OK         : verde   — operación exitosa, sin problemas
ADVERTENCIA: amarillo — hay problemas menores, puede continuar
ERROR      : rojo    — problemas bloqueantes, requiere acción
INFO       : azul    — informativo, etapa activa
LOCKED     : gris    — etapa pendiente, no disponible
```

### Badges de tipo de excepción
```
OK             : verde
EXCEDENTE      : naranja
FALTANTE       : rojo
SIN_MATCH      : azul
NO_MAESTRO     : rojo oscuro
SIN_ACTIVIDAD  : amarillo
DATA_QUALITY   : violeta
ERROR          : rojo
```

### Tema
```
Preferencia: tema claro (light mode)
Fondo      : gris muy claro
Superficies: blanco
Bordes     : gris suave
Texto      : negro/gris oscuro
Monospace  : para datos, llaves, nombres de archivo
```

---

## 10. COMPONENTES REUTILIZABLES

```
Badge            : píldora con texto + color de estado
Badge tipo       : variante para tipos de excepción (8 colores distintos)
Tarjeta          : bloque con header clickeable + body expandible
Tarjeta EDA      : variante con tabla de columnas (ok/warn/error) + paginación
Tabla            : filas con hover, cabeceras uppercase, sorteable por click
Tabla compacta   : variante para EDA (font 0.75rem, padding reducido)
Tabla matricial  : variante para mapeo de columnas (dropdowns en celdas)
Alerta           : barra con icono + mensaje + color de fondo (info/warn/error)
Botón primario   : fondo oscuro, texto blanco, deshabilitado si no aplica
Botón ghost      : borde sutil, texto gris, hover con color
Dot              : círculo de 6px con color de estado (ok/warn/error/info/locked/muted)
Tag de archivo   : badge pequeño con tipo (TXT, CSV, XLSX)
Tag de tipo      : badge de tipo de columna (texto gris, numérico azul, fecha violeta)
Mini-bar         : barra de porcentaje de nulos (verde < 20%, amarillo < 50%, rojo ≥ 50%)
Tooltip popover  : click-to-show ? con popup informativo (no hover)
Sort indicator   : ▲/▼ en header de tabla sorteable
Form de acción   : panel flotante para excepciones (comentario obligatorio)
Selector carpeta : File System Access API con ruta + estado (dot)
Select numérico  : dropdown de separador decimal/miles
```

---

## 11. INTERACCIONES CLAVE

```
Seleccionar carpeta : File System Access API (showDirectoryPicker)
Click en etapa      : expande/colapsa (solo si está desbloqueada)
Click en tarjeta EDA: expande detalle de validación por columna
Click en inválidos  : expande mini-tabla con filas/valores inválidos
Click en ? tooltip  : muestra/oculta popover informativo
Click en header tabla: ordena por esa columna (asc/desc toggle)
Mapear columnas     : dropdown en tabla matricial (columna real → concepto)
Aprobar/Corregir/Excluir : acciones sobre excepciones con comentario obligatorio
Descargar           : genera y descarga archivos de reporte
Volver a analizar   : re-lee archivos de carpeta y re-ejecuta EDA
```
