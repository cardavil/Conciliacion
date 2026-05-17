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

## 3. FLUJO DE EJECUCIÓN — 4 ETAPAS

```
ETAPA 1 — Revisión de Entorno
  Seleccionar carpeta de entrada (File System Access API)
  Seleccionar carpeta de salida
  Tabla de archivos detectados (nombre, tipo, categoría, tamaño)
  Configurar separador decimal y de miles (dropdowns, default del navegador)
  Botón "Continuar a Etapa 2" habilitado si hay archivos

ETAPA 2 — Validación por Fuente
  EDA automático al entrar (disparado por avance de Etapa 1)
  Perfil por columna: tipo, vacíos, válidos, inválidos, únicos, muestra
  Detalle de inválidos expandible: click en conteo → mini-tabla Fila/Valor (cap 50)
  Validación numérica locale-aware según separador configurado en Etapa 1
  Umbrales: >20% nulos = warn, >50% = crítico
  Configuración de cruce: rol por archivo (CC/Desc/Maestro), llave, conceptos
  Botón "Continuar a Etapa 3" habilitado solo con config válida

ETAPA 3 — Conciliación
  Ejecutada automáticamente al avanzar desde Etapa 2
  Métricas de cruce: match, sin match, duplicados, cobertura (%)
  Métricas condicionales: No Maestro, Sin Actividad (solo si maestro asignado)
  Resumen: OK, Excedente, Faltante, Error
  3 colas de excepciones:
    - Fuera del umbral: acción individual (popup con valor a aplicar + comentario)
    - Dentro del umbral: acción masiva (popup con descripción + comentario)
    - Otras: acción individual (SIN_MATCH, NO_MAESTRO, etc.)
  4 acciones: CxC Anterior, CxC Actual, Valor mayor, Valor menor
  Columna Novedad: NUEVO/RETIRO (tipo_retiro) como contexto en excepciones
  Sorting por click en headers (llave, tipo, concepto, CxC Ant, CxC Act, diferencia, novedad)
  Configuración de reportes: checkboxes para conceptos, TOTAL, campos extra
  Botón "Generar Reportes" habilitado al resolver todas las excepciones

ETAPA 4 — Reportes
  Generación automática al avanzar desde Etapa 3
  2 reportes:
    - hoja_de_trabajo.xlsx (4 hojas: Conciliación, Resumen, Novedades, Audit Trail)
    - descuentos_quincena.xlsx (pivotado por llave×concepto, configurable)
  Valores numéricos normalizados (pd.to_numeric) para uso directo en Excel
  Popup de confirmación al guardar/descargar
  Descarga individual o todo como .zip
  Si hay carpeta de salida: escribe directo al disco
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

### Ciclo obligatorio de cambios
```
1. Auditoría    → revisar estado actual del código/funcionalidad
2. Diagnóstico  → identificar problemas específicos con evidencia
3. Plan         → proponer cambios concretos (plan mode)
4. Aprobación   → el usuario revisa y aprueba antes de tocar código
5. Implementación → ejecutar solo lo aprobado
```
No se modifica código sin pasar por este ciclo. Sin autorización no se hace nada.

### Siempre
- Seguir el ciclo auditoría → diagnóstico → plan → aprobación → implementación
- Leer este archivo completo antes de cualquier acción
- El modelo de datos se infiere de archivos reales, no se inventa
- Todo error debe ser visible para el analista (nunca silenciar)
- Toda acción del analista requiere comentario (audit trail)
- Los datos nunca salen de la máquina del usuario

### Nunca
- Hardcodear datos de negocio (CCs, montos, nombres de empresa)
- Inventar datos ficticios para pruebas
- Asumir nombres de columnas, llaves o tipos de dato
- Usar print() para debugging
- Usar eval() en JavaScript
- Ejecutar código Python arbitrario del usuario (solo conciliacion.py del mismo origen)
- Usar pathlib, subprocess, threading ni multiprocessing en Python

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