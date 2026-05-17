#!/usr/bin/env python3
"""build_god.py — Genera conciliacion_offline.html y GOD_MAP.md"""

import re
import os

SRC_DIR = os.path.dirname(os.path.abspath(__file__))

FILES = {
    "html": os.path.join(SRC_DIR, "index.html"),
    "css": os.path.join(SRC_DIR, "css", "styles.css"),
    "bridge": os.path.join(SRC_DIR, "js", "pyodide-bridge.js"),
    "app": os.path.join(SRC_DIR, "js", "app.js"),
    "python": os.path.join(SRC_DIR, "python", "conciliacion.py"),
}

# (original, code, description)
PY_RENAMES = [
    ("_verificar_consistencia_separador", "_p10", "Verifica separador header vs datos"),
    ("_detectar_tipo_columna", "_p08", "Detecta tipo: numerico/fecha/texto"),
    ("_normalizar_columnas", "_p12", "Convierte columnas a numerico con locale"),
    ("_comparar_conceptos", "_p13", "Compara CC vs Desc por concepto"),
    ("_contar_invalidos", "_p09", "Cuenta invalidos por tipo detectado"),
    ("_perfilar_columna", "_p11", "Perfil completo de columna"),
    ("_es_numero_valido", "_p07", "Valida numero con separador configurable"),
    ("_quincena_actual", "_p06", "Rango de la quincena actual"),
    ("_parsear_fecha", "_p05", "Parsea fecha multiples formatos"),
    ("_es_tipo_texto", "_p04", "Verifica dtype texto/object"),
    ("_enriquecer_df", "_p14", "Agrega columnas extra desde archivos"),
    ("_valor_final", "_p16", "Valor final con audit trail (nested)"),
    ("_respuesta", "_p02", "Estructura de respuesta estandar"),
    ("_convertir", "_p15", "Convierte a JSON serializable (nested)"),
    ("_ahora", "_p01", "Timestamp ISO 8601"),
    ("_msg", "_p03", "Crea mensaje individual"),
]

BRIDGE_RENAMES = [
    ("extractPythonError", "_b07", "Extrae mensaje error Python"),
    ("fetchPythonSource", "_b01", "Carga codigo Python (embebido)"),
    ("extractInvalids", "_b10", "Invalidos de EDA por concepto"),
    ("buildRenameDict", "_b09", "Dict de renombrado para mapping"),
    ("escapePyString", "_b02", "Escapa string para Python"),
    ("preparePyArgs", "_b04", "Prepara args para llamada Python"),
    ("toPyIfNeeded", "_b05", "Convierte a Pyodide si necesario"),
    ("withTimeout", "_b06", "Wrapper timeout para promesas"),
    ("convertToJS", "_b03", "Convierte proxy Pyodide a JS"),
    ("formatError", "_b08", "Formatea error para log"),
]

APP_RENAMES = [
    ("checkAllExceptionsResolved", "_a39", "Verifica excepciones resueltas"),
    ("supportsDirectoryPicker", "_a14", "Verifica File System Access API"),
    ("collectReportMapping", "_a44", "Recolecta config reportes"),
    ("updateSortIndicators", "_a31", "Indicadores de orden"),
    ("initReanalyzeButton", "_a52", "Boton Re-analizar"),
    ("updateConceptColumns", "_a25", "Actualiza columnas conceptos"),
    ("_createActionModal", "_a06", "Modal de accion con comentario"),
    ("renderNovedadBadge", "_a08", "Badge novedad NUEVO/RETIRO"),
    ("initStageNavigation", "_a49", "Navegacion etapas"),
    ("renderActionButtons", "_a37", "Botones accion individual"),
    ("initDirectoryPickers", "_a16", "Inicializa selectores carpetas"),
    ("validateCrossConfig", "_a27", "Valida config cruce"),
    ("classifyExtension", "_a04", "Clasifica extension de archivo"),
    ("showBulkActionForm", "_a33", "Form accion masiva popup"),
    ("renderAllExcQueues", "_a34", "3 colas excepciones"),
    ("getActionDescription", "_a12", "Descripcion de accion"),
    ("getAllSourceColumns", "_a41", "Columnas archivos fuente"),
    ("writeAllToOutput", "_a48", "Escribe/descarga todos"),
    ("renderReportConfig", "_a43", "Config reportes Etapa 3"),
    ("pickInputDirectory", "_a17", "Seleccionar carpeta entrada"),
    ("readInputDirectory", "_a18", "Lee archivos carpeta entrada"),
    ("pickOutputDirectory", "_a19", "Seleccionar carpeta salida"),
    ("initAdvanceButtons", "_a50", "Botones avance"),
    ("buildExtraFieldRow", "_a42", "Fila campo extra"),
    ("initSeparadorConfig", "_a56", "Config separadores"),
    ("showConfirmPopup", "_a05", "Popup de confirmacion modal"),
    ("renderCrossConfig", "_a20", "Config cruce Etapa 2"),
    ("buildMappingSelect", "_a23", "Select mapeo concepto-columna"),
    ("filterExcepciones", "_a10", "Filtra excepciones por umbral"),
    ("buildMappingTable", "_a24", "Tabla mapeo conceptos"),
    ("writeFileToOutput", "_a47", "Escribe en carpeta salida"),
    ("initRefreshButton", "_a51", "Boton Actualizar"),
    ("initUmbralFilter", "_a28", "Inicializa filtro umbral"),
    ("renderTipoBadge", "_a07", "Badge tipo excepcion"),
    ("calcActionValue", "_a11", "Valor segun accion seleccionada"),
    ("getColumnsForFiles", "_a22", "Columnas de archivos"),
    ("buildReportCheck", "_a40", "Checkbox config reportes"),
    ("renderBulkAction", "_a32", "Botones accion masiva"),
    ("initAyudaPopovers", "_a35", "Popovers de ayuda"),
    ("collectMapping", "_a26", "Recolecta mapeo grupo"),
    ("getFilesForRole", "_a21", "Archivos asignados a rol"),
    ("showActionForm", "_a38", "Form accion individual popup"),
    ("renderExcRows", "_a09", "Filas excepciones en tabla"),
    ("runConciliation", "_a54", "Ejecuta conciliacion"),
    ("closeAllAyudas", "_a36", "Cierra popovers"),
    ("handleExcSort", "_a30", "Handler click header tabla"),
    ("sortExcArray", "_a29", "Ordena array excepciones"),
    ("downloadBlob", "_a45", "Descarga blob como archivo"),
    ("toggleStage", "_a15", "Toggle visibilidad etapa"),
    ("buildMiniBar", "_a57", "Barra mini porcentaje"),
    ("escapeHtml", "_a01", "Escapa HTML"),
    ("formatSize", "_a02", "Formatea bytes a KB/MB"),
    ("timeHHMM", "_a03", "Hora actual HH:MM"),
    ("runReports", "_a55", "Genera reportes"),
    ("runEDA", "_a53", "Ejecuta analisis EDA"),
    ("dbg", "_a13", "Debug log"),
]


def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def apply_renames(code, renames):
    for original, replacement, _ in renames:
        code = re.sub(r'\b' + re.escape(original) + r'\b', replacement, code)
    return code


def strip_py_comments(code):
    lines = code.split('\n')
    result = []
    in_docstring = False
    docstring_char = None
    for line in lines:
        stripped = line.strip()
        if not in_docstring:
            if stripped.startswith('"""') or stripped.startswith("'''"):
                docstring_char = stripped[:3]
                if stripped.count(docstring_char) >= 2 and len(stripped) > 3:
                    continue
                in_docstring = True
                continue
            if stripped.startswith('#'):
                continue
            result.append(line)
        else:
            if docstring_char in stripped:
                in_docstring = False
            continue
    return '\n'.join(result)


def strip_js_comments(code):
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
    lines = code.split('\n')
    result = []
    for line in lines:
        if line.strip().startswith('//'):
            continue
        result.append(line)
    return '\n'.join(result)


def strip_css_comments(code):
    return re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)


def collapse_blank_lines(code):
    return re.sub(r'\n{3,}', '\n\n', code)


def escape_template_literal(code):
    code = code.replace('\\', '\\\\')
    code = code.replace('`', '\\`')
    code = code.replace('${', '\\${')
    return code


def embed_python_in_bridge(bridge_code, py_escaped):
    bridge_code = bridge_code.replace(
        "const PYTHON_SOURCE = 'python/conciliacion.py';",
        "const PYTHON_SOURCE = `" + py_escaped + "`;"
    )
    marker = 'async function fetchPythonSource()'
    idx = bridge_code.find(marker)
    if idx == -1:
        raise ValueError("fetchPythonSource not found in bridge")
    brace_start = bridge_code.find('{', idx)
    depth, pos = 1, brace_start + 1
    while pos < len(bridge_code) and depth > 0:
        if bridge_code[pos] == '{':
            depth += 1
        elif bridge_code[pos] == '}':
            depth -= 1
        pos += 1
    bridge_code = (
        bridge_code[:idx]
        + 'async function fetchPythonSource() { return PYTHON_SOURCE; }'
        + bridge_code[pos:]
    )
    return bridge_code


def extract_body(html):
    match = re.search(r'<body>(.*?)</body>', html, re.DOTALL)
    if not match:
        raise ValueError("<body> not found in HTML")
    body = match.group(1)
    body = re.sub(r'\s*<script[^>]*>.*?</script>', '', body, flags=re.DOTALL)
    body = re.sub(r'<!--.*?-->', '', body, flags=re.DOTALL)
    return body.strip()


TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Conciliacion Quincenal</title>
<style>
__CSS__
</style>
</head>
<body>
__BODY__
<script src="https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js"></script>
<script>
__BRIDGE__
</script>
<script>
__APP__
</script>
</body>
</html>"""


def build_god_map(py, bridge, app):
    lines = [
        "# GOD_MAP — Mapa de funciones ofuscadas",
        "",
        "Generado por `build_god.py`. NO editar manualmente.",
        "",
    ]
    for title, renames in [
        ("Python (conciliacion.py)", py),
        ("JS Bridge (pyodide-bridge.js)", bridge),
        ("JS App (app.js)", app),
    ]:
        lines.append("## " + title)
        lines.append("")
        lines.append("| Codigo | Original | Descripcion |")
        lines.append("|--------|----------|-------------|")
        for original, code, desc in sorted(renames, key=lambda r: r[1]):
            lines.append("| {} | `{}` | {} |".format(code, original, desc))
        lines.append("")
    return '\n'.join(lines)


def main():
    print("build_god.py")
    print()

    src = {k: read_file(v) for k, v in FILES.items()}
    for k, v in src.items():
        print("  leido: {} ({:,} bytes)".format(k, len(v)))

    css = strip_css_comments(src["css"])
    bridge = strip_js_comments(src["bridge"])
    app = strip_js_comments(src["app"])
    py = strip_py_comments(src["python"])
    print("\n  comentarios eliminados")

    py = apply_renames(py, PY_RENAMES)
    print("  python: {} funciones renombradas".format(len(PY_RENAMES)))

    py_escaped = escape_template_literal(py)
    bridge = embed_python_in_bridge(bridge, py_escaped)
    print("  bridge: python embebido ({:,} chars)".format(len(py_escaped)))

    bridge = apply_renames(bridge, BRIDGE_RENAMES)
    print("  bridge: {} funciones renombradas".format(len(BRIDGE_RENAMES)))

    app = apply_renames(app, APP_RENAMES)
    print("  app: {} funciones renombradas".format(len(APP_RENAMES)))

    css = collapse_blank_lines(css)
    bridge = collapse_blank_lines(bridge)
    app = collapse_blank_lines(app)

    body = extract_body(src["html"])
    body = collapse_blank_lines(body)

    god = (TEMPLATE
           .replace("__CSS__", css)
           .replace("__BODY__", body)
           .replace("__BRIDGE__", bridge)
           .replace("__APP__", app))

    out_html = os.path.join(SRC_DIR, "conciliacion_offline.html")
    with open(out_html, "w", encoding="utf-8") as f:
        f.write(god)
    print("\n  => {} ({:,} bytes)".format(os.path.basename(out_html), len(god)))

    god_map = build_god_map(PY_RENAMES, BRIDGE_RENAMES, APP_RENAMES)
    out_map = os.path.join(SRC_DIR, "GOD_MAP.md")
    with open(out_map, "w", encoding="utf-8") as f:
        f.write(god_map)
    print("  => {} generado".format(os.path.basename(out_map)))

    total_renames = len(PY_RENAMES) + len(BRIDGE_RENAMES) + len(APP_RENAMES)
    print("\n  Total: {} funciones ofuscadas".format(total_renames))
    print("\nListo.")


if __name__ == "__main__":
    main()
