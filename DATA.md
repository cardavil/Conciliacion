# DATA.md — Modelo de Datos

> Los nombres reales de columnas se infieren de archivos reales.
> NO inventar columnas, tipos ni llaves.

---

## 1. FUENTES DE ENTRADA

### Roles de archivo (configurados por el analista en Etapa 2)

```
Cuenta de cobro (CC)   : lo que la cooperativa ESPERA recibir
                         Puede ser 1 archivo (CSV/XLSX) o múltiples TXT (uno por empresa)
                         Multi-TXT: misma estructura, se concatenan automáticamente

Descuentos (Desc)      : lo que la empresa REALMENTE descontó
                         Siempre 1 archivo (CSV/XLSX/TXT)

Maestro                : fuente de verdad de asociados válidos
                         Opcional pero recomendado
                         Define el universo de llaves válidas para la conciliación
                         Puede contener: fecha_ingreso, fecha_retiro (novedades)

No usar                : archivo presente en la carpeta pero excluido del proceso
```

### Detección automática por archivo
```
Formato    : TXT / CSV / XLSX (se infiere de la extensión)
Separador  : | ; , \t (detectado automáticamente para TXT/CSV)
Encoding   : UTF-8 / Latin-1 (detectado automáticamente)
Columnas   : nombres reales del archivo (inferidos del header)
Llave      : sugerida automáticamente (primera columna 0 nulos, 0 vacíos, 100% únicos)
```

---

## 2. CONCEPTOS FIJOS (5)

```
APORTES    →  descuento obligatorio por nómina
AHORROS    →  ahorro voluntario autorizado
SEGUROS    →  prima de seguro
INCENTIVO  →  valor adicional (bono, auxilio, etc.)
CREDITO    →  cuota de crédito activo por libranza
```

Siempre estos 5. El analista mapea columnas reales de cada archivo a estos conceptos
mediante la tabla matricial de mapeo en Etapa 2.

### Campos opcionales (3)
```
nombre_asociado   →  nombre del asociado/empleado
cod_empresa       →  código de la empresa/convenio
nombre_empresa    →  nombre de la empresa
```

Estos campos enriquecen los reportes pero no participan en la conciliación numérica.

---

## 3. MAPEO DE COLUMNAS (tabla matricial)

El analista configura el mapeo en una tabla matricial única:

```
┌─────────────┬──────────┬──────────┬──────────┬─────────┬─────────┬─────────┬───────────┬─────────┐
│ Archivo     │ Nombre   │ Cod.emp. │ Nom.emp. │ APORTES │ AHORROS │ SEGUROS │ INCENTIVO │ CREDITO │
├─────────────┼──────────┼──────────┼──────────┼─────────┼─────────┼─────────┼───────────┼─────────┤
│ Maestro     │ [col ▼]  │ [col ▼]  │ [col ▼]  │ [col ▼] │ [col ▼] │ [col ▼] │ [col ▼]   │ [col ▼] │
│ CC          │ [col ▼]  │ [col ▼]  │ [col ▼]  │ [col ▼] │ [col ▼] │ [col ▼] │ [col ▼]   │ [col ▼] │
│ Desc        │ [col ▼]  │ [col ▼]  │ [col ▼]  │ [col ▼] │ [col ▼] │ [col ▼] │ [col ▼]   │ [col ▼] │
└─────────────┴──────────┴──────────┴──────────┴─────────┴─────────┴─────────┴───────────┴─────────┘
```

- Filas: Maestro (si existe, siempre primero) → CC → Desc
- Columnas: campos opcionales (3) → conceptos fijos (5)
- Cada celda es un dropdown con las columnas reales del archivo
- Multi-TXT CC: 1 sola fila (usan columnas del primer archivo, misma estructura)
- Auto-selección: si nombre de columna coincide con concepto, se selecciona automáticamente
- Defaults: Maestro todo "— No usar —"; CC/Desc conceptos "— Seleccionar —", opcionales "— No usar —"

### Renombrado en el bridge
El bridge renombra las columnas reales a nombres canónicos antes de pasar a Python:
```
mapping { APORTES: 'COL_APO', CREDITO: 'CUOTA' }
    → rename_dict { 'COL_APO': 'APORTES', 'CUOTA': 'CREDITO' }
    → df.rename(columns=rename_dict)
```
Python siempre recibe DataFrames con nombres canónicos (APORTES, AHORROS, etc.).

---

## 4. DETECCIÓN AUTOMÁTICA (EDA)

Al seleccionar la carpeta de entrada, el sistema detecta automáticamente:

```
Por archivo:
  - Encoding (UTF-8 / Latin-1)
  - Separador (| ; , \t) con verificación de consistencia
  - Filas, columnas, nombres de columna
  - Filas completamente vacías

Por columna:
  - Tipo: texto / numérico / fecha
  - Validación numérica locale-aware (separador decimal configurable en Etapa 1)
  - Formato inconsistente (ej: mezcla de 1.234,56 y 1234.56)
  - Conteo de inválidos (valores que no parsean según tipo detectado)
  - Nulos (NaN) y vacíos (cadena vacía)
  - Porcentaje de nulos+vacíos (umbral 20% warn, 50% crítico)
  - Valores únicos
  - Muestra de hasta 5 valores (preserva ceros iniciales)

Detalle de inválidos:
  - Click en conteo de inválidos → mini-tabla expandible: Fila / Valor
  - Cap 50 registros por columna
  - Paginación si hay más columnas de las visibles

Llave sugerida:
  - Primera columna con 0 nulos, 0 vacíos y todos los valores únicos
  - Ignora filas completamente vacías para la evaluación

Tipos detectados:
  - texto    : no es numérico ni fecha, o tiene ceros iniciales (cédulas, códigos)
  - numérico : parseable como número, sin ceros iniciales, locale-aware
  - fecha    : matchea alguno de 8 formatos (ISO, dd/mm/yyyy, etc.) o parsing flexible
```

---

## 5. CONFIGURACIÓN DE CRUCE (post-EDA)

```
Antes del cruce, el analista configura en Etapa 2:

Por archivo:
  - Rol: Cuenta de cobro / Descuentos / Maestro / No usar
  - Columna llave (default = llave sugerida del EDA)

Mapeo de columnas (tabla matricial):
  - El analista mapea columnas reales a los 5 conceptos fijos + 3 opcionales
  - Los conceptos conciliados = intersección de lo mapeado en CC y Desc

Maestro (si se asigna):
  - Define el universo de llaves válidas
  - Llaves en CC/Desc que no están en Maestro → NO_MAESTRO
  - Llaves en Maestro sin actividad en CC ni Desc → SIN_ACTIVIDAD
  - Columnas fecha_ingreso y fecha_retiro → novedades

Validación requerida:
  - Al menos 1 archivo como Cuenta de cobro (puede ser multi-TXT)
  - Exactamente 1 archivo como Descuentos
  - Llave seleccionada en archivos activos
  - Al menos 1 concepto mapeado en ambos (CC y Desc)
  - Si multi-CC: todos deben ser TXT
```

---

## 6. ESTADOS DE CONCILIACIÓN

```
OK             : valores coinciden exactamente
EXCEDENTE      : empresa descontó más de lo esperado (Desc > CC)
FALTANTE       : empresa descontó menos de lo esperado (Desc < CC)
SIN_MATCH      : llave presente en una fuente pero no en la otra
NO_MAESTRO     : llave no encontrada en el archivo maestro
SIN_ACTIVIDAD  : llave en maestro pero sin registros en CC ni Desc
DATA_QUALITY   : dato con problema de calidad (inválido en origen)
ERROR          : dato inválido que impide comparación
```

---

## 7. SALIDAS GENERADAS

```
2 reportes Excel:

hoja_de_trabajo.xlsx — evidencia documental completa (fijo, no configurable)
  Hoja "Conciliación"  : resultados + decisiones del audit trail + campos extra
                         Columnas: llave, concepto, CxC Anterior, CxC Actual,
                         diferencia, estado, novedad, decision, comentario, valor_final
                         valor_final = newValue (si hubo decisión) o CxC Actual (si OK)
                         Valores numéricos normalizados (pd.to_numeric)
  Hoja "Resumen"       : conteos OK/Excedente/Faltante/Sin Match/Error
  Hoja "Novedades"     : asociados nuevos/retirados
  Hoja "Audit Trail"   : log completo de acciones del analista

descuentos_quincena.xlsx — reporte final configurable por el analista
  Una fila por asociado (llave), una columna por concepto seleccionado
  Orden de columnas: llave → extras (nombre, cod_empresa, nombre_empresa) → conceptos → TOTAL
  Valores = valor_final (decisión del analista si hubo excepción, o CxC Actual si OK)
  Configurable: conceptos a incluir, TOTAL, incluir conciliados, columnas extra
```

---

## 8. NOTAS

- Todo lo que dice "por confirmar" se resuelve al subir el primer archivo real
- El sistema infiere columnas y tipos automáticamente (ver sección 4)
- El analista aprueba o corrige la inferencia en la UI
- Este archivo se actualiza cada vez que se confirma una fuente nueva
