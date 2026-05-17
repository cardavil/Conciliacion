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
┌──────────────────────────────────────────────────────────────────┐
│ Etapa 3 · Conciliación                               [● ACT]    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Período: Q1 Mayo 2026                                           │
│                                                                  │
│  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐                  │
│  │  1618  │ │    24    │ │    3     │ │ 98.5%│                  │
│  │ Match  │ │Sin match │ │Duplicados│ │ Cob. │                  │
│  └────────┘ └──────────┘ └──────────┘ └──────┘                  │
│  ┌────────────┐ ┌──────────────┐  (condicionales)               │
│  │  5 No Mro. │ │ 12 Sin Act. │                                 │
│  └────────────┘ └──────────────┘                                 │
│                                                                  │
│  OK: 1500 · Excedente: 42 · Faltante: 68 · Error: 8            │
│                                                                  │
│  EXCEPCIONES FUERA DEL UMBRAL                                    │
│  Umbral: [0___]  Solo diferencias fuera del rango ±umbral        │
│  ┌───────┬──────────┬─────────┬────────┬───────┬──────┬────────┐│
│  │Llave↕ │ Tipo     │Concepto │CxC Ant │CxC Act│Difer.│Novedad ││
│  │ 12345 │●FALTANTE │ APORTES │ 50,000 │45,000 │-5,000│        ││
│  │ 67890 │●EXCEDENTE│ CREDITO │ 30,000 │35,000 │ 5,000│RETIRO  ││
│  │       │          │         │        │       │      │(volunt)││
│  │ Acción: [CxC Anterior] [CxC Actual] [Mayor] [Menor]         ││
│  │ → Popup: valor a aplicar + comentario obligatorio            ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  EXCEPCIONES DENTRO DEL UMBRAL                                   │
│  [CxC Anterior] [CxC Actual] [Mayor] [Menor]  ← acción masiva  │
│  → Popup masivo: descripción + conteo + comentario obligatorio   │
│  ┌───────┬──────────┬─────────┬────────┬───────┬──────┬────────┐│
│  │Llave  │ Tipo     │Concepto │CxC Ant │CxC Act│Difer.│Novedad ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  OTRAS EXCEPCIONES                                               │
│  ┌───────┬──────────┬─────────┬────────┬───────┬──────┬────────┐│
│  │Llave  │ Tipo     │Concepto │CxC Ant │CxC Act│Difer.│Novedad ││
│  │ 11111 │●SIN_MATCH│ —       │ 20,000 │  —    │  —   │NUEVO   ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  CONFIGURACIÓN DE REPORTES                                       │
│  ☐ Nombre asociado: [— Columna —▼]                              │
│  ☐ Cod. empresa:    [— Columna —▼]                              │
│  ☐ Nombre empresa:  [— Columna —▼]                              │
│  ☑ APORTES                                                       │
│  ☑ AHORROS                                                       │
│  ☑ SEGUROS                                                       │
│  ☑ INCENTIVO                                                     │
│  ☑ CREDITO                                                       │
│  ☑ TOTAL                                                         │
│  ☑ Incluir conciliados (OK)                                      │
│                                                                  │
│                              [▶ Generar Reportes]                │
└──────────────────────────────────────────────────────────────────┘
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

### 3 colas de excepciones
- **Fuera del umbral**: acción individual por excepción (popup con valor a aplicar)
- **Dentro del umbral**: acción masiva con 4 botones (popup con descripción + conteo)
- **Otras**: acción individual (SIN_MATCH, NO_MAESTRO, etc.)
- Todas sorteables por click en headers (Llave, Tipo, Concepto, CxC Ant, CxC Act, Diferencia, Novedad)
- Indicadores de sort: ▲/▼ en header activo
- Columna Tipo con badges de color (8 tipos)
- Columna Novedad: badge NUEVO (azul) o RETIRO (rojo) con tipo_retiro entre paréntesis
- Tooltips `?` en headers CxC Anterior/CxC Actual: click-to-show, explican CC vs Desc
- 4 acciones: CxC Anterior, CxC Actual, Valor mayor, Valor menor
- Popup de acción: muestra valor a aplicar + comentario obligatorio (audit trail)
- Botón "Generar Reportes" habilitado al resolver todas las excepciones

### Configuración de reportes (visible tras conciliación)
- Lista vertical unificada:
  - Campos extra: checkbox + select de columna fuente (deshabilitado si unchecked)
  - Conceptos: checkboxes (todos checked por default)
  - TOTAL: checkbox (checked por default)
  - Incluir conciliados: checkbox (checked por default)

---

## 7. ETAPA 4 — REPORTES

```
┌────────────────────────────────────────────────┐
│ Etapa 4 · Reportes                  [✓ OK]     │
├────────────────────────────────────────────────┤
│                                                │
│  Archivos generados:                           │
│  📄 hoja_de_trabajo.xlsx   [⬇ Guardar]         │
│  📄 descuentos_quincena.xlsx [⬇ Guardar]       │
│                                                │
│        [⬇ Guardar todo / Descargar todo]       │
└────────────────────────────────────────────────┘
```

### Elementos
- 2 reportes generados con botón de guardar/descargar individual
- Popup de confirmación ("X guardado" + botón Aceptar) al completar
- Descarga masiva como .zip (JSZip) si no hay carpeta de salida
- Si hay carpeta de salida configurada en Etapa 1: escribe directo al disco
- Botón dice "Guardar" (con carpeta salida) o "Descargar" (sin carpeta)

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

## 9. SISTEMA DE TOKENS CSS

Todos los valores visuales están centralizados en `:root` como custom properties.

### Semáforo de estados
```
--ok     / --ok-bg     / --ok-border      : verde   — exitoso
--warn   / --warn-bg   / --warn-border    : amarillo — advertencia
--error  / --error-bg  / --error-border   : rojo    — bloqueante
--info   / --info-bg   / --info-border    : azul    — informativo
--locked / --locked-bg / --locked-border  : gris    — pendiente
```

### Badges y tags
```
--badge-orange / --badge-orange-bg   : naranja — NO_MAESTRO
--badge-amber  / --badge-amber-bg    : ámbar   — SIN_ACTIVIDAD, DATA_QUALITY
--tag-purple   / --tag-purple-bg     : violeta — TXT, fecha
--tag-blue     / --tag-blue-bg       : azul    — CSV, numérico
--tag-green    / --tag-green-bg      : verde   — XLSX
```

### Escala tipográfica
```
--font-2xs : 0.625rem    tags pequeños
--font-xs  : 0.6875rem   headers tabla, badges
--font-sm  : 0.75rem     labels secundarios
--font-base: 0.8125rem   texto general (mayoría de la UI)
--font-md  : 0.875rem    campos, subtítulos
--font-lg  : 0.9375rem   títulos de etapa
--font-xl  : 1.125rem    título topbar
--font-2xl : 1.75rem     métricas destacadas
```

### Superficies, texto, espaciado
```
--surface-page / --surface-card / --surface-border
--text / --text-muted / --text-dim
--space-xs (0.25rem) → --space-2xl (3rem)
--radius-sm (4px) → --radius-pill (9999px)
--shadow-sm, --transition, --transition-slow
```

### Tema
```
Preferencia: tema claro (light mode)
Fondo      : gris muy claro (--surface-page)
Superficies: blanco (--surface-card)
Bordes     : gris suave (--surface-border)
Texto      : negro/gris oscuro (--text / --text-muted)
Monospace  : para datos, llaves, nombres de archivo (--font-mono)
```

---

## 10. COMPONENTES REUTILIZABLES

```
Badge            : píldora con texto + color de estado
Badge tipo       : variante para tipos de excepción (8 colores distintos)
Tarjeta          : bloque con header clickeable + body expandible
Tarjeta EDA      : variante con tabla de columnas (ok/warn/error) + paginación
Tabla            : filas con hover, cabeceras uppercase, sorteable por click
Tabla compacta   : variante para EDA (--font-sm, padding reducido)
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
Form de acción   : _createActionModal factory (overlay + panel + input + botones)
                   showActionForm: individual (valor a aplicar + comentario obligatorio)
                   showBulkActionForm: masivo Cola 2 (descripción + conteo + comentario)
Popup confirmar  : overlay modal con mensaje + botón Aceptar (para guardar reportes)
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
Acción excepción    : CxC Anterior/Actual/Mayor/Menor → popup con valor + comentario
Acción masiva       : mismas 4 acciones → popup con descripción + conteo + comentario
Guardar/Descargar   : guarda reportes + popup confirmación con Aceptar
Volver a analizar   : re-lee archivos de carpeta y re-ejecuta EDA
```
