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

## 4. NOTAS

- Todo lo que dice "por confirmar" se resuelve al subir el primer archivo real
- El sistema debe inferir columnas y tipos automáticamente
- El analista aprueba o corrige la inferencia
- Este archivo se actualiza cada vez que se confirma una fuente nueva