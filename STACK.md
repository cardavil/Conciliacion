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
│  │  (drag &   │    │              │  │
│  │   drop)    │    │  procesa     │  │
│  │            │◄───│  y retorna   │  │
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
Usuario sube archivos (input type=file)
    ↓
JS lee los archivos como ArrayBuffer
    ↓
JS pasa los bytes a Pyodide (Python)
    ↓
Python (pandas) procesa, valida, cruza
    ↓
Python retorna resultados a JS (JSON o dict)
    ↓
JS renderiza en el DOM (tablas, semáforos, alertas)
    ↓
Usuario descarga reportes generados por Python
```

---

## 4. ESTRUCTURA DE ARCHIVOS

```
Conciliacion/
├── index.html             ← entrada principal (GitHub Pages)
├── css/
│   └── styles.css         ← sistema de diseño (~1100 líneas, custom properties)
├── js/
│   ├── app.js             ← orquestador UI (~1300 líneas, IIFE → App)
│   └── pyodide-bridge.js  ← comunicación JS ↔ Pyodide (~400 líneas, IIFE → PyBridge)
├── python/
│   └── conciliacion.py    ← lógica de procesamiento (~770 líneas, pandas)
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

### Python (conciliacion.py)
```
Utilidades     : detectar_encoding, detectar_separador, leer_archivo, resultado_a_json
Helpers EDA    : _detectar_tipo_columna, _perfilar_columna, _verificar_consistencia_separador
Etapa 1        : analizar_archivo (perfil completo con tipos, nulos, llave sugerida)
Etapa 2        : inferir_perfil, validar_fuente (umbral 20%/50% nulos, formato inconsistente)
Etapa 3        : validar_cruzado (match, sin match, cobertura)
Etapa 4        : conciliar (OK/EXCEDENTE/FALTANTE/SIN_MATCH + novedades)
Etapa 5        : generar_reportes (Excel vía openpyxl)
```

### JS — App (app.js)
```
Patrón         : IIFE → const App, API pública
Etapa 1        : drag & drop, renderFileList, renderEDA, renderOutputs (salidas esperadas)
Etapa 2        : renderValidation, buildSourceCards
Etapa 3        : renderCrossCheck (métricas + tabla sin match)
Etapa 4        : renderConciliation (excepciones con acciones + audit trail)
Etapa 5        : renderReports, downloadBlob, downloadAll (JSZip dinámico)
Excepciones    : Aprobar/Corregir/Excluir con comentario obligatorio
```

### JS — Bridge (pyodide-bridge.js)
```
Patrón         : IIFE → const PyBridge, API pública
Carga          : init() → Pyodide + micropip + conciliacion.py
Transferencia  : loadFile, loadFiles (ArrayBuffer → Pyodide FS)
Ejecución      : callPython, callPythonSimple (con timeout 300s)
EDA            : analyzeFile, analyzeAllFiles
Lectura        : readGeneratedFile, readGeneratedFiles (Pyodide FS → Blob)
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