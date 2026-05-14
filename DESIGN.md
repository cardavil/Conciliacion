# DESIGN.md — Diseño del Sistema

> Referencia visual y funcional para la UI. Basado en mockups iniciales.

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
│  Etapas apiladas verticalmente (acordeón)        │
│  Cada etapa se expande/colapsa                   │
│  Solo una etapa activa a la vez                  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Etapa 1 · Revisión de Entorno     [✓ OK]  │  │
│  ├────────────────────────────────────────────┤  │
│  │ (contenido colapsado o expandido)          │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Etapa 2 · Validación por Fuente   [⚠ 2]   │  │
│  ├────────────────────────────────────────────┤  │
│  │ (contenido colapsado o expandido)          │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Etapa 3 · Validación Cruzada      [● ACT] │  │
│  ├────────────────────────────────────────────┤  │
│  │ (contenido expandido — etapa activa)       │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Etapa 4 · Conciliación            [🔒]     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Etapa 5 · Reportes                [🔒]     │  │
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
- Las etapas son secuenciales (1 → 2 → 3 → 4 → 5)
- No se puede avanzar si la etapa actual tiene errores críticos
- Se puede volver a etapas anteriores (para revisar, no para editar)
- La etapa activa se expande automáticamente
- Las completadas muestran resumen colapsado
- Las pendientes muestran solo el header con candado
```

---

## 4. ETAPA 1 — REVISIÓN DE ENTORNO

### Contenido expandido
```
┌────────────────────────────────────────────────┐
│ Etapa 1 · Revisión de Entorno          [✓ OK] │
├────────────────────────────────────────────────┤
│                                                │
│  [Zona de carga de archivos — drag & drop]     │
│                                                │
│  ─────────────────────────────────────         │
│  Archivos detectados (N)                       │
│                                                │
│  ●  archivo1.txt     TXT·|   Fuente    248 KB  │
│  ●  archivo2.txt     TXT·|   Fuente    312 KB  │
│  ●  archivo3.xlsx    XLSX    Fuente    189 KB  │
│  ●  catalogo1.csv    CSV     Catálogo    4 KB  │
│  ⚠  otro.xlsx        XLSX   Sin clasificar     │
│                                                │
│                          [↻ Actualizar]        │
└────────────────────────────────────────────────┘
```

### Análisis EDA por archivo (tarjetas expandibles)
```
┌────────────────────────────────────────────────┐
│ Análisis de calidad por archivo                │
│                                                │
│ ┌────────────────────────────────────────────┐ │
│ │● archivo1.txt  1842 filas · 8 cols  [OK]  │ │
│ │  (click para expandir tabla de columnas)   │ │
│ │  Columna  │ Tipo     │ Nulos │ Vacíos │ Muestra │
│ │  cedula   │ texto    │  ▓ 0% │   0    │ 00123.. │
│ │  monto    │ numérico │  ▓ 2% │   0    │ 1234.56 │
│ │  fecha    │ fecha    │  ▓ 0% │   0    │ 2024-.. │
│ │  ⚠ col_a: 25% valores nulos/vacíos        │ │
│ └────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │
│ │⚠ archivo2.xlsx  671 filas · 5 cols [2 ⚠]  │ │
│ └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Salidas esperadas
```
┌────────────────────────────────────────────────┐
│ Salidas esperadas                              │
│                                                │
│  ○  Conciliación consolidada    .xlsx  Etapa 4 │
│  ○  Extractos por empresa       .xlsx  Etapa 4 │
│  ○  Reporte de excepciones      .xlsx  Etapa 4 │
│  ○  Log de auditoría            .xlsx  Etapa 5 │
│                                                │
│  (estado se actualiza: Bloqueado → En proceso  │
│   → Generado según avance de etapas)           │
└────────────────────────────────────────────────┘
```

### Elementos
- Zona de drag & drop para subir archivos
- Tabla de archivos detectados con: indicador (●/⚠), nombre, tipo, categoría, tamaño
- Tags de tipo de archivo (TXT, XLSX, CSV) con color diferenciado
- Archivos sin clasificar marcados con advertencia
- Tarjetas EDA expandibles por archivo con tabla de columnas (tipo, nulos, vacíos, únicos, muestra)
- Tags de tipo de columna: texto (gris), numérico (azul), fecha (violeta)
- Mini-bar visual de porcentaje de nulos por columna
- Badge de llave sugerida en columna candidata
- Sección de salidas esperadas con estado por etapa (bloqueado/pendiente/generado)
- Botón actualizar

---

## 5. ETAPA 2 — VALIDACIÓN POR FUENTE

### Contenido expandido
```
┌────────────────────────────────────────────────┐
│ Etapa 2 · Validación por Fuente     [⚠ 2]     │
├────────────────────────────────────────────────┤
│                                                │
│  ANÁLISIS DE CALIDAD POR ARCHIVO               │
│  ┌────────────────────────────────────────────┐│
│  │● archivo1.txt  1842 filas · 8 cols  [OK]  ││
│  │  (click para expandir perfil de columnas)  ││
│  └────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────┐│
│  │⚠ archivo2.xlsx  671 filas · 5 cols [2 ⚠]  ││
│  └────────────────────────────────────────────┘│
│                                                │
│  CONFIGURACIÓN DE CRUCE                        │
│  ┌──────────────────────────────────────────┐  │
│  │ archivo1.txt  [Cuenta de cobro ▼] [cedula▼]│
│  │ archivo2.xlsx [Descuentos ▼]      [cc ▼]   │
│  │ archivo3.xlsx [No usar ▼]         [— ▼]    │
│  └──────────────────────────────────────────┘  │
│                                                │
│  COLUMNAS DE CONCEPTO                          │
│  [✓ APORTES] [✓ CREDITO] [ ] SEGUROS          │
│                                                │
│  ✓ Configuración lista                         │
│              [▶ Continuar a Etapa 3]           │
└────────────────────────────────────────────────┘
```

### Elementos
- Tarjetas EDA expandibles por archivo con perfil de columnas
- Sección de configuración de cruce (aparece tras EDA):
  - Fila por archivo: nombre + dropdown de rol + dropdown de llave
  - Roles: No usar / Cuenta de cobro / Descuentos / Período anterior
  - Llave: columnas del archivo (default = llave sugerida del EDA)
- Checkboxes de columnas de concepto (numéricas compartidas entre CC y Desc)
- Mensaje de validación (ok/error)
- Botón de avance habilitado solo con configuración válida

---

## 6. ETAPA 3 — VALIDACIÓN CRUZADA

### Contenido expandido
```
┌────────────────────────────────────────────────┐
│ Etapa 3 · Validación Cruzada        [● ACT]   │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────┐│
│  │  1,618   │ │    24    │ │    3     │ │98.5%││
│  │  Match   │ │ Sin match│ │Duplicados│ │Cob. ││
│  └──────────┘ └──────────┘ └──────────┘ └────┘│
│                                                │
│  DETALLE SIN MATCH                             │
│  ┌──────────────────────────────────────────┐  │
│  │ Llave │ Presente en    │ Monto │ Acción  │  │
│  │ XXX   │ Fuente A no B  │ $NNN  │ [✓][✏][✗]│  │
│  │ YYY   │ Fuente B no A  │ $NNN  │ [✓][✏][✗]│  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [▶ Continuar] (deshabilitado si hay críticos) │
└────────────────────────────────────────────────┘
```

### Elementos
- Tarjetas de métricas: match exitoso, sin match, duplicados, cobertura
- Tabla de registros sin match con acciones (Aprobar / Corregir / Excluir)
- Cada acción requiere comentario obligatorio
- Botón de avance condicionado

---

## 7. ETAPA 4 — CONCILIACIÓN + EXCEPCIONES

### Contenido expandido
```
┌────────────────────────────────────────────────┐
│ Etapa 4 · Conciliación              [● ACT]   │
├────────────────────────────────────────────────┤
│                                                │
│  RESUMEN                                       │
│  OK: N · EXCEDENTE: N · FALTANTE: N · ERROR: N│
│                                                │
│  COLA DE EXCEPCIONES                           │
│  ┌──────────────────────────────────────────┐  │
│  │ Llave │ Concepto │ Esperado │ Real │ Dif │  │
│  │       │          │          │      │     │  │
│  │ Acciones: [Aprobar] [Corregir] [Excluir] │  │
│  │ Comentario: ________________________     │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  NOVEDADES VS PERÍODO ANTERIOR                 │
│  (nuevos, retirados, cambios de valor)         │
│                                                │
│              [▶ Generar Reportes]               │
└────────────────────────────────────────────────┘
```

### Elementos
- Resumen de estados (OK/EXCEDENTE/FALTANTE/ERROR) con conteo
- Tabla de excepciones con: llave, concepto, valor esperado, valor real, diferencia
- Acciones con comentario obligatorio
- Sección de novedades detectadas automáticamente
- Botón para generar reportes

---

## 8. ETAPA 5 — REPORTES

### Contenido expandido
```
┌────────────────────────────────────────────────┐
│ Etapa 5 · Reportes                  [✓ OK]     │
├────────────────────────────────────────────────┤
│                                                │
│  Archivos generados:                           │
│  📄 resumen_ejecutivo          [⬇ Descargar]   │
│  📄 excepciones_detalle        [⬇ Descargar]   │
│  📄 cuenta_cobro_siguiente     [⬇ Descargar]   │
│  📄 audit_log                  [⬇ Descargar]   │
│  📄 extractos_individuales     [⬇ Descargar]   │
│                                                │
│           [⬇ Descargar todo (.zip)]             │
└────────────────────────────────────────────────┘
```

---

## 9. LOG DE ACTIVIDAD

```
┌────────────────────────────────────────────────┐
│ Log de actividad                               │
├────────────────────────────────────────────────┤
│ 14:02  ✓ Entorno validado                      │
│ 14:04  ✓ archivo1.txt — N registros OK         │
│ 14:05  ⚠ archivo2.xlsx — N advertencias        │
│ 14:05  ✗ archivo3.csv — columna X no encontrada│
│ 14:08  Esperando resolución de errores...      │
└────────────────────────────────────────────────┘
```

- Siempre visible al fondo
- Scroll independiente
- Cada entrada: timestamp + icono de nivel + mensaje
- Colores: verde (OK), amarillo (advertencia), rojo (error), gris (info)

---

## 10. PALETA DE COLORES

### Semáforo de estados
```
OK         : verde   — operación exitosa, sin problemas
ADVERTENCIA: amarillo — hay problemas menores, puede continuar
ERROR      : rojo    — problemas bloqueantes, requiere acción
INFO       : azul    — informativo, etapa activa
LOCKED     : gris    — etapa pendiente, no disponible
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

## 11. COMPONENTES REUTILIZABLES

```
Badge            : píldora con texto + color de estado
Tarjeta          : bloque con header clickeable + body expandible
Tarjeta EDA      : variante de tarjeta con tabla de columnas (ok/warn/error)
Tabla            : filas con hover, cabeceras uppercase
Tabla compacta   : variante para EDA (font 0.75rem, padding reducido)
Alerta           : barra con icono + mensaje + color de fondo
Botón primario   : fondo oscuro, texto blanco, deshabilitado si no aplica
Botón ghost      : borde sutil, texto gris, hover con color
Dot              : círculo de 6px con color de estado (ok/warn/error/info/locked/muted)
Tag de archivo   : badge pequeño con tipo (TXT, CSV, XLSX)
Tag de tipo      : badge de tipo de columna (texto gris, numérico azul, fecha violeta)
Mini-bar         : barra de porcentaje de nulos (verde < 20%, amarillo < 50%, rojo ≥ 50%)
Salida esperada  : ítem de output con dot + nombre + formato + estado
Form de acción   : formulario inline para excepciones (comentario obligatorio)
```

---

## 12. INTERACCIONES CLAVE

```
Drag & drop     : subir archivos arrastrándolos a la zona de carga
Click en etapa  : expande/colapsa (solo si está desbloqueada)
Click en fuente : expande detalle de validación
Mapear columnas : modal o inline para asignar columna_real → columna_sistema
Aprobar/Corregir/Excluir : acciones sobre excepciones con comentario obligatorio
Descargar       : genera y descarga archivos de reporte
```