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
│   └── styles.css         ← sistema de diseño (~1600 líneas, custom properties)
├── js/
│   ├── app.js             ← orquestador UI (~1900 líneas, IIFE → App)
│   └── pyodide-bridge.js  ← comunicación JS ↔ Pyodide (~540 líneas, IIFE → PyBridge)
├── python/
│   └── conciliacion.py    ← lógica de procesamiento (~1200 líneas, pandas)
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

### Python (conciliacion.py ~1200 líneas)
```
Utilidades     : detectar_encoding, detectar_separador, leer_archivo, resultado_a_json
Helpers EDA    : _detectar_tipo_columna, _perfilar_columna, _verificar_consistencia_separador
                 _es_numero_valido, _contar_invalidos, _parsear_fecha, _quincena_actual
Análisis       : analizar_archivo (perfil completo con tipos, nulos, llave sugerida)
                 inferir_perfil, validar_fuente (umbral 20%/50% nulos, formato inconsistente)
Conciliación   : conciliar (OK/EXCEDENTE/FALTANTE/SIN_MATCH + novedades desde maestro)
                 Soporta maestro como fuente de verdad, NO_MAESTRO, SIN_ACTIVIDAD
Reportes       : generar_reportes (Excel vía openpyxl)
```

### JS — App (app.js ~1900 líneas)
```
Patrón         : IIFE → const App, API pública
Utilidades     : escapeHtml, formatSize, timeHHMM, classifyExtension
Constantes     : CONCEPTOS_FIJOS (5), CAMPOS_OPCIONALES (3)
Log            : addLog (ok/warn/error/info con timestamp)
Etapas         : setStageState, toggleStage, completeStage, initStageNavigation
Etapa 1        : initDirectoryPickers, pickInputDirectory, readInputDirectory
                 pickOutputDirectory, renderFileList, initSeparadorConfig
EDA            : renderEDA (tarjetas expandibles, paginación, mini-bar nulos,
                 detalle de inválidos expandible con mini-tabla)
Config cruce   : renderCrossConfig (roles por archivo, llave)
                 buildMappingTable (tabla matricial: conceptos como columnas,
                 archivos como filas, maestro primera fila)
                 buildMappingSelect, updateConceptColumns, collectMapping
                 validateCrossConfig (multi-CC TXT, intersección de conceptos)
Conciliación   : renderConciliation (métricas + resumen + excepciones + novedades)
                 renderTipoBadge (8 tipos con colores distintos)
Excepciones    : renderExcepcionesBody, sortExcepciones, updateSortIndicators
                 initExcSort (click en headers con data-col)
                 initAyudaPopovers (tooltips ? click-to-show, no hover)
Acciones       : renderActionButtons, showActionForm (panel flotante)
                 checkAllExceptionsResolved
Reportes       : renderReports, downloadBlob, writeAllToOutput (JSZip)
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
