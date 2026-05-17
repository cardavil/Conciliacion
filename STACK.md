# STACK.md — Decisiones Técnicas

---

## 1. ARQUITECTURA

```
┌─────────────────────────────────────┐
│           NAVEGADOR                 │
│                                     │
│  ┌───────────┐    ┌──────────────┐  │
│  │  HTML/CSS  │    │   Pyodide    │  │
│  │    JS UI   │◄──►│   (Python)   │  │
│  │            │    │  pandas      │  │
│  │  archivos  │───►│  openpyxl    │  │
│  │  (File     │    │              │  │
│  │   System   │    │  procesa     │  │
│  │   Access)  │◄───│  y retorna   │  │
│  └───────────┘    └──────────────┘  │
│                                     │
│  Todo corre en el cliente.          │
│  Ningún dato sale de la máquina.    │
└─────────────────────────────────────┘
```

---

## 2. ¿POR QUÉ PYODIDE?

- El procesamiento requiere pandas (EDA, cruces, agrupaciones)
- openpyxl para leer/escribir Excel
- Python es el lenguaje natural para este tipo de análisis
- Pyodide lo ejecuta en WebAssembly dentro del navegador
- No necesita instalación, no necesita servidor
- Los datos nunca salen de la máquina del usuario

---

## 3. FLUJO DE DATOS

```
Usuario selecciona carpeta de entrada (File System Access API)
    ↓
JS lee los archivos como ArrayBuffer
    ↓
JS pasa los bytes a Pyodide (Python)
    ↓
Python (pandas) procesa, valida, cruza
    ↓
Python retorna resultados a JS (JSON o dict)
    ↓
JS renderiza en el DOM (tablas, métricas, alertas)
    ↓
Usuario descarga reportes generados por Python
    ↓ (opcional)
Si hay carpeta de salida: JS escribe directo al disco
```

---

## 4. ESTRUCTURA DE ARCHIVOS

```
Conciliacion/
├── index.html             ← entrada principal (GitHub Pages)
├── css/
│   └── styles.css         ← sistema de diseño (~1450 líneas, custom properties)
├── js/
│   ├── app.js             ← orquestador UI (~2000 líneas, IIFE → App)
│   └── pyodide-bridge.js  ← comunicación JS ↔ Pyodide (~560 líneas, IIFE → PyBridge)
├── python/
│   └── conciliacion.py    ← lógica de procesamiento (~1060 líneas, pandas)
├── CLAUDE.md              ← contexto de negocio y reglas
├── STACK.md               ← decisiones técnicas (este archivo)
├── DATA.md                ← modelo de datos
├── DESIGN.md              ← diseño UI y componentes
├── README.md
└── .gitignore
```

---

## 5. GITHUB PAGES

- Se sirve desde la rama `main`, carpeta raíz `/`
- `index.html` es el punto de entrada
- Pyodide se carga desde CDN (cdn.jsdelivr.net/pyodide/)
- No requiere build step ni CI/CD

---

## 6. GOD-FILE (FASE FINAL)

- Un solo archivo `.html` que contiene todo:
  - CSS inline
  - JS inline
  - Python como string embebido
  - Pyodide cargado desde CDN (o embebido si se quiere 100% offline)
- Funciona con doble clic en Windows
- No requiere internet si Pyodide se incluye localmente

---

## 7. MÓDULOS IMPLEMENTADOS

### Python (conciliacion.py ~1060 líneas)
```
Utilidades     : detectar_encoding, detectar_separador, leer_archivo, resultado_a_json
Helpers EDA    : _detectar_tipo_columna, _perfilar_columna, _verificar_consistencia_separador
                 _es_numero_valido, _contar_invalidos, _parsear_fecha, _quincena_actual
Análisis       : analizar_archivo (perfil completo con tipos, nulos, llave sugerida)
                 inferir_perfil, validar_fuente (umbral 20%/50% nulos, formato inconsistente)
Conciliación   : _normalizar_columnas (máscara inválidos + conversión numérica locale-aware)
                 _comparar_conceptos (comparación por llave: OK/EXCEDENTE/FALTANTE/ERROR)
                 conciliar (orquesta: normaliza, itera llaves, delega comparación)
                 Soporta maestro como fuente de verdad, NO_MAESTRO, SIN_ACTIVIDAD
                 Enriquece excepciones con novedad y tipo_retiro
Reportes       : _enriquecer_df (helper para columnas extra vía lookup)
                 generar_reportes → 2 archivos:
                   hoja_de_trabajo.xlsx (4 hojas: Conciliación+audit, Resumen, Novedades, Audit Trail)
                   descuentos_quincena.xlsx (pivot llave×concepto, columnas extras, TOTAL)
                 Normalización numérica (pd.to_numeric) antes de escribir a Excel
```

### JS — App (app.js ~2000 líneas)
```
Patrón         : IIFE → const App, API pública
Utilidades     : escapeHtml, formatSize, timeHHMM, classifyExtension
Constantes     : CONCEPTOS_FIJOS (5), CAMPOS_OPCIONALES (3), EXC_ACTIONS (4)
                 calcActionValue, getActionDescription
UI             : showConfirmPopup (popup modal con Aceptar)
                 _createActionModal (factory: overlay + panel + input + botones)
Log            : addLog (ok/warn/error/info con timestamp)
Etapas         : setStageState, toggleStage, completeStage, initStageNavigation
Etapa 1        : initDirectoryPickers, pickInputDirectory, readInputDirectory
                 pickOutputDirectory, renderFileList, initSeparadorConfig
EDA            : renderEDA (tarjetas expandibles, paginación, mini-bar nulos,
                 detalle de inválidos expandible con mini-tabla)
Config cruce   : renderCrossConfig (roles por archivo, llave, tipo_retiro)
                 buildMappingTable (tabla matricial: conceptos como columnas,
                 archivos como filas, maestro primera fila)
                 buildMappingSelect, updateConceptColumns, collectMapping
                 validateCrossConfig (multi-CC TXT, intersección de conceptos)
Conciliación   : renderConciliation (métricas + resumen + 3 colas de excepciones)
                 renderTipoBadge (8 tipos con colores distintos)
                 renderNovedadBadge (NUEVO/RETIRO en columna Novedad)
Excepciones    : 3 colas: fuera umbral (individual), dentro umbral (masiva), otras (individual)
                 renderAllExcQueues, renderExcRows, filterExcepciones
                 sortExcArray, handleExcSort, updateSortIndicators (sort por data-col)
                 renderBulkAction, showBulkActionForm (usa _createActionModal)
Acciones       : renderActionButtons (4 botones: CxC Ant/Act, Mayor, Menor)
                 showActionForm (usa _createActionModal)
                 checkAllExceptionsResolved
Config reportes: renderReportConfig (lista vertical: extras → conceptos → TOTAL → conciliados)
                 buildReportCheck, buildExtraFieldRow, getAllSourceColumns
                 collectReportMapping
Reportes       : renderReports, downloadBlob (10s revoke), downloadAll (JSZip)
                 writeFileToOutput, writeAllToOutput (File System Access API)
Inicialización : init, initAdvanceButtons, initRefreshButton, initReanalyzeButton
```

### JS — Bridge (pyodide-bridge.js ~540 líneas)
```
Patrón         : IIFE → const PyBridge, API pública
Carga          : init() → Pyodide + micropip + conciliacion.py
Transferencia  : loadFile, loadFiles (ArrayBuffer → Pyodide FS)
Ejecución      : callPython, callPythonSimple (con timeout 300s)
Conversión     : convertToJS, preparePyArgs, toPyIfNeeded, escapePyString
EDA            : analyzeFile, analyzeAllFiles
Mapeo          : buildRenameDict (mapping → rename dict para pandas)
Conciliación   : conciliate (multi-CC concat vía pd.concat,
                 rename columnas CC/Desc/Maestro a nombres canónicos,
                 rename llave Desc si difiere de CC,
                 extractInvalids para datos inválidos por archivo)
Reportes       : generateReports (→ generar_reportes + escritura /output/)
Lectura        : readGeneratedFile, readGeneratedFiles (Pyodide FS → Blob)
Errores        : extractPythonError, formatError, withTimeout
```

---

## 8. RESTRICCIONES

```
- No usar frameworks JS (no React, no Vue, no Angular)
- No usar bundlers (no Webpack, no Vite)
- No usar npm ni node_modules
- No usar fetch a APIs externas
- No usar localStorage para datos sensibles
- CSS vanilla, sin preprocesadores
- JS vanilla (ES6+), sin TypeScript
```
