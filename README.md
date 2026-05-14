# Conciliacion Quincenal

Sistema de conciliacion quincenal de recaudo por libranza para cooperativas y fondos de empleados. Corre 100% en el navegador — ningun dato sale de la maquina del usuario.

## Que hace

Cruza la **cuenta de cobro** (lo que la cooperativa espera recibir) contra los **archivos de descuentos** (lo que cada empresa realmente desconto), detectando:

- **OK** — valores coinciden
- **Faltante** — empresa desconto menos (riesgo de mora)
- **Excedente** — empresa desconto de mas (conflicto contable)
- **Sin match** — registro en una fuente pero no en la otra

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | HTML / CSS / JS vanilla (sin frameworks) |
| Procesamiento | Python via Pyodide (WebAssembly en el navegador) |
| Librerias | pandas, openpyxl |
| Deploy | GitHub Pages |

No hay servidor, base de datos, npm, ni APIs externas.

## Estructura

```
Conciliacion/
├── index.html              ← entrada principal
├── css/styles.css          ← sistema de diseno completo
├── js/
│   ├── app.js              ← orquestador UI (etapas, renderizado, acciones)
│   └── pyodide-bridge.js   ← comunicacion JS <-> Pyodide
├── python/
│   └── conciliacion.py     ← logica de procesamiento (EDA, validacion, cruce, reportes)
├── CLAUDE.md               ← contexto de negocio y reglas para Claude Code
├── STACK.md                ← decisiones tecnicas
├── DATA.md                 ← modelo de datos (se completa con archivos reales)
└── DESIGN.md               ← diseno UI y componentes
```

## Flujo de 5 etapas

1. **Revision de Entorno** — Carga de archivos, EDA automatico (perfil de columnas, tipos, nulos, llave sugerida), vista previa de salidas esperadas
2. **Validacion por Fuente** — Validacion individual de estructura, tipos y calidad por archivo
3. **Validacion Cruzada** — Verificacion de consistencia entre fuentes (match, cobertura, duplicados)
4. **Conciliacion + Excepciones** — Cruce cuenta de cobro vs descuentos, cola de excepciones con acciones del analista
5. **Reportes** — Generacion de conciliacion consolidada, extractos por empresa, excepciones y log de auditoria (.xlsx)

## Uso

Abrir `index.html` en un navegador moderno (Chrome/Edge/Firefox). Pyodide se carga desde CDN automaticamente. Arrastrar archivos a la zona de carga para iniciar el proceso.

## Salidas generadas

- Conciliacion consolidada (.xlsx)
- Extractos por empresa (.xlsx)
- Reporte de excepciones (.xlsx)
- Log de auditoria (.xlsx)
