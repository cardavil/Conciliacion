# DATA.md — Modelo de Datos

> Este archivo se completa cuando lleguen los archivos reales.
> NO inventar columnas, tipos ni llaves.

---

## ESTADO: PENDIENTE DE ARCHIVOS REALES

---

## 1. FUENTES DE ENTRADA

### Maestro de asociados
```
Formato    : por confirmar
Separador  : por confirmar
Encoding   : por confirmar
Columnas   : por confirmar (se infieren del archivo real)
Llave      : por confirmar
```

### Maestro de ahorros
```
Formato    : por confirmar
Separador  : por confirmar
Encoding   : por confirmar
Columnas   : por confirmar
Llave      : por confirmar
```

### Cuenta de cobro (período anterior)
```
Formato    : por confirmar
Separador  : por confirmar
Encoding   : por confirmar
Columnas   : por confirmar
Llave      : por confirmar
```

### Archivos de descuentos por empresa
```
Formato    : TXT (por confirmar)
Separador  : | (por confirmar)
Encoding   : por confirmar
Columnas   : por confirmar
Llave      : por confirmar
Nota       : múltiples archivos, uno por empresa
```

### Catálogos de referencia
```
Formato    : CSV (por confirmar)
Separador  : , (por confirmar)
Nota       : fuente de verdad, no se valida contenido
```

---

## 2. CONVENCIÓN DE NOMBRES (REFERENCIAL)

```
Archivos TXT:
  YYYYMMDD_CODIGO_NOMBRE-EMPRESA_descuentos.txt
  YYYYMMDD_CODIGO_NOMBRE-EMPRESA_cuentacobro.txt

Se confirma cuando lleguen los archivos reales.
```

---

## 3. MAPEO DE COLUMNAS

Se define tras el primer EDA con archivos reales.
El analista confirma o ajusta el mapeo en la UI.

```
archivo → columna_real → columna_sistema → tipo → nullable
(por completar)
```

---

## 4. DETECCIÓN AUTOMÁTICA (EDA)

Al subir un archivo, el sistema detecta automáticamente:

```
Por archivo:
  - Encoding (UTF-8 / Latin-1)
  - Separador (| ; , \t) con verificación de consistencia
  - Filas, columnas, nombres de columna
  - Filas completamente vacías

Por columna:
  - Tipo: texto / numérico / fecha
  - Formato inconsistente (ej: mezcla de 1.234,56 y 1234.56)
  - Nulos (NaN) y vacíos (cadena vacía)
  - Porcentaje de nulos+vacíos (umbral 20% warn, 50% crítico)
  - Valores únicos
  - Muestra de hasta 5 valores (preserva ceros iniciales)

Llave sugerida:
  - Primera columna con 0 nulos, 0 vacíos y todos los valores únicos
  - Ignora filas completamente vacías para la evaluación

Tipos detectados:
  - texto    : no es numérico ni fecha, o tiene ceros iniciales (cédulas, códigos)
  - numérico : parseable como número, sin ceros iniciales
  - fecha    : matchea alguno de 8 formatos (ISO, dd/mm/yyyy, etc.) o parsing flexible
```

---

## 5. CONFIGURACIÓN DE CRUCE (post-EDA)

```
Antes del cruce, el analista configura en Etapa 2:

Por archivo:
  - Rol: Cuenta de cobro / Descuentos / Período anterior / No usar
  - Columna llave (default = llave sugerida del EDA)

Columnas de concepto:
  - Columnas numéricas compartidas entre CC y Desc
  - El analista selecciona cuáles comparar (checkboxes)

Validación requerida:
  - Exactamente 1 archivo como Cuenta de cobro
  - Exactamente 1 archivo como Descuentos
  - Llave seleccionada en archivos activos
  - Al menos 1 columna de concepto seleccionada
```

---

## 6. SALIDAS GENERADAS

```
Resumen ejecutivo         (.xlsx)  — Conteos OK/Excedente/Faltante/Sin Match/Error
Excepciones detalle       (.xlsx)  — Excepciones que requirieron acción del analista
Conciliación completa     (.xlsx)  — Cada comparación llave×concepto con estado
Novedades                 (.xlsx)  — Asociados nuevos/retirados vs período anterior
Log de auditoría          (.xlsx)  — Registro de todas las acciones y decisiones
```

---

## 6. NOTAS

- Todo lo que dice "por confirmar" se resuelve al subir el primer archivo real
- El sistema infiere columnas y tipos automáticamente (ver sección 4)
- El analista aprueba o corrige la inferencia en la UI
- Este archivo se actualiza cada vez que se confirma una fuente nueva