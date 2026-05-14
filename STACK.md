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
│   └── styles.css
├── js/
│   ├── app.js             ← orquestador UI
│   └── pyodide-bridge.js  ← comunicación JS ↔ Pyodide
├── python/
│   └── conciliacion.py    ← lógica de procesamiento (pandas)
├── CLAUDE.md
├── STACK.md
├── DATA.md
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

## 7. RESTRICCIONES

```
- No usar frameworks JS (no React, no Vue, no Angular)
- No usar bundlers (no Webpack, no Vite)
- No usar npm ni node_modules
- No usar fetch a APIs externas
- No usar localStorage para datos sensibles
- CSS vanilla, sin preprocesadores
- JS vanilla (ES6+), sin TypeScript
```