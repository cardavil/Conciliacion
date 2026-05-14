# CLAUDE.md — Conciliación Quincenal
> Documento de contexto para Claude Code. Leer completo antes de cualquier acción.

---

## 1. PROPÓSITO DEL PROYECTO

Sistema de conciliación quincenal de recaudo por libranza para una cooperativa o fondo de empleados.

### Flujo de negocio
```
Asociado (empleado)
    ↓  autoriza descuento por libranza o convenio
Empresa vinculante
    ↓  descuenta de nómina y transfiere a la cooperativa
Cooperativa / Fondo
    ↓  recibe y aplica el pago a cada producto del asociado
Cuenta del asociado
```

### Qué conciliamos
```
Cuenta de cobro vigente  ←  lo que la cooperativa ESPERA recibir de cada empresa
          vs
Archivo de descuentos    ←  lo que la empresa REALMENTE descontó y transfirió

Resultado por concepto y por asociado:
  FALTANTE  →  empresa envió menos   →  riesgo de cartera mora
  EXCEDENTE →  empresa envió de más  →  conflicto contable
  OK        →  cuadra exacto         →  conciliado
```

### Por qué es crítico
- FALTANTE no resuelto → asociado queda en mora sin saberlo → problema legal
- EXCEDENTE no resuelto → cooperativa retiene dinero ajeno → problema contable
- Debe existir respaldo documental de cada decisión del analista

### Conceptos de producto (referenciales — se confirman con archivos reales)
```
APORTES   →  descuento obligatorio por nómina
AHORROS   →  ahorro voluntario autorizado
CREDITO   →  cuota de crédito activo por libranza
SEGUROS   →  prima de seguro
INCENTIVO →  valor adicional (bono, auxilio, etc.)
             Si el asociado NO define aplicación → INCENTIVO_PENDIENTE
```

**Dominio:** Recaudo de nómina por libranza — cooperativas y fondos de empleados.
**Usuarios:** Analistas de recaudo (no desarrolladores).

---

## 2. STACK TECNOLÓGICO

```
Frontend     : HTML / CSS / JS estático (GitHub Pages)
Procesamiento: Python vía Pyodide (corre en el navegador, sin servidor)
Librerías    : pandas, openpyxl (cargadas por Pyodide)
Deploy       : GitHub Pages
God-file     : Un solo HTML que funciona offline (se genera al final)
```

### Lo que NO hay
```
- Sin servidor backend
- Sin base de datos
- Sin frameworks frontend
- Sin dependencias npm
- Sin Docker, sin nube, sin API externa
```

---

## 3. FLUJO DE EJECUCIÓN — 5 ETAPAS

```
ETAPA 1 — Revisión de Entorno
  Detectar y clasificar archivos subidos por el usuario

ETAPA 2 — Validación por Fuente
  Validar cada archivo individualmente (estructura, tipos, llaves)

ETAPA 3 — Validación Cruzada
  Verificar consistencia entre fuentes

ETAPA 4 — Conciliación + Excepciones
  Cruzar descuentos vs cuenta de cobro, detectar diferencias

ETAPA 5 — Reportes
  Generar outputs descargables + audit trail
```

---

## 4. ESTADOS DE CONCILIACIÓN

```
OK           : valores coinciden
EXCEDENTE    : empresa descontó más
FALTANTE     : empresa descontó menos
SIN_MATCH    : llave en una fuente pero no en otra
NOVEDAD      : registro nuevo vs período anterior
RETIRO       : asociado con indicador de retiro
ERROR        : dato inválido
```

---

## 5. REGLAS PARA CLAUDE CODE

### Siempre
- Leer este archivo completo antes de cualquier acción
- El modelo de datos se infiere de archivos reales, no se inventa
- Todo error debe ser visible para el analista (nunca silenciar)

### Nunca
- Hardcodear datos de negocio (CCs, montos, nombres de empresa)
- Inventar datos ficticios para pruebas
- Asumir nombres de columnas, llaves o tipos de dato
- Usar print() para debugging

---

## 6. GLOSARIO

```
Asociado          Empleado afiliado al fondo/cooperativa
Empresa           Empresa vinculante que descuenta por nómina
Período           Quincena activa
Cuenta de cobro   Lo que la cooperativa espera recibir
Descuentos        Lo que la empresa realmente descontó
Recaudo           Proceso de cobro de obligaciones del asociado
Novedad           Cambio respecto al período anterior
Excedente         Empresa descontó más de lo reportado
Faltante          Empresa descontó menos de lo reportado
Libranza          Autorización del empleado para descuento de nómina
```