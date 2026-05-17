# GOD_MAP — Mapa de funciones ofuscadas

Generado por `build_god.py`. NO editar manualmente.

## Python (conciliacion.py)

| Codigo | Original | Descripcion |
|--------|----------|-------------|
| _p01 | `_ahora` | Timestamp ISO 8601 |
| _p02 | `_respuesta` | Estructura de respuesta estandar |
| _p03 | `_msg` | Crea mensaje individual |
| _p04 | `_es_tipo_texto` | Verifica dtype texto/object |
| _p05 | `_parsear_fecha` | Parsea fecha multiples formatos |
| _p06 | `_quincena_actual` | Rango de la quincena actual |
| _p07 | `_es_numero_valido` | Valida numero con separador configurable |
| _p08 | `_detectar_tipo_columna` | Detecta tipo: numerico/fecha/texto |
| _p09 | `_contar_invalidos` | Cuenta invalidos por tipo detectado |
| _p10 | `_verificar_consistencia_separador` | Verifica separador header vs datos |
| _p11 | `_perfilar_columna` | Perfil completo de columna |
| _p12 | `_normalizar_columnas` | Convierte columnas a numerico con locale |
| _p13 | `_comparar_conceptos` | Compara CC vs Desc por concepto |
| _p14 | `_enriquecer_df` | Agrega columnas extra desde archivos |
| _p15 | `_convertir` | Convierte a JSON serializable (nested) |
| _p16 | `_valor_final` | Valor final con audit trail (nested) |

## JS Bridge (pyodide-bridge.js)

| Codigo | Original | Descripcion |
|--------|----------|-------------|
| _b01 | `fetchPythonSource` | Carga codigo Python (embebido) |
| _b02 | `escapePyString` | Escapa string para Python |
| _b03 | `convertToJS` | Convierte proxy Pyodide a JS |
| _b04 | `preparePyArgs` | Prepara args para llamada Python |
| _b05 | `toPyIfNeeded` | Convierte a Pyodide si necesario |
| _b06 | `withTimeout` | Wrapper timeout para promesas |
| _b07 | `extractPythonError` | Extrae mensaje error Python |
| _b08 | `formatError` | Formatea error para log |
| _b09 | `buildRenameDict` | Dict de renombrado para mapping |
| _b10 | `extractInvalids` | Invalidos de EDA por concepto |

## JS App (app.js)

| Codigo | Original | Descripcion |
|--------|----------|-------------|
| _a01 | `escapeHtml` | Escapa HTML |
| _a02 | `formatSize` | Formatea bytes a KB/MB |
| _a03 | `timeHHMM` | Hora actual HH:MM |
| _a04 | `classifyExtension` | Clasifica extension de archivo |
| _a05 | `showConfirmPopup` | Popup de confirmacion modal |
| _a06 | `_createActionModal` | Modal de accion con comentario |
| _a07 | `renderTipoBadge` | Badge tipo excepcion |
| _a08 | `renderNovedadBadge` | Badge novedad NUEVO/RETIRO |
| _a09 | `renderExcRows` | Filas excepciones en tabla |
| _a10 | `filterExcepciones` | Filtra excepciones por umbral |
| _a11 | `calcActionValue` | Valor segun accion seleccionada |
| _a12 | `getActionDescription` | Descripcion de accion |
| _a13 | `dbg` | Debug log |
| _a14 | `supportsDirectoryPicker` | Verifica File System Access API |
| _a15 | `toggleStage` | Toggle visibilidad etapa |
| _a16 | `initDirectoryPickers` | Inicializa selectores carpetas |
| _a17 | `pickInputDirectory` | Seleccionar carpeta entrada |
| _a18 | `readInputDirectory` | Lee archivos carpeta entrada |
| _a19 | `pickOutputDirectory` | Seleccionar carpeta salida |
| _a20 | `renderCrossConfig` | Config cruce Etapa 2 |
| _a21 | `getFilesForRole` | Archivos asignados a rol |
| _a22 | `getColumnsForFiles` | Columnas de archivos |
| _a23 | `buildMappingSelect` | Select mapeo concepto-columna |
| _a24 | `buildMappingTable` | Tabla mapeo conceptos |
| _a25 | `updateConceptColumns` | Actualiza columnas conceptos |
| _a26 | `collectMapping` | Recolecta mapeo grupo |
| _a27 | `validateCrossConfig` | Valida config cruce |
| _a28 | `initUmbralFilter` | Inicializa filtro umbral |
| _a29 | `sortExcArray` | Ordena array excepciones |
| _a30 | `handleExcSort` | Handler click header tabla |
| _a31 | `updateSortIndicators` | Indicadores de orden |
| _a32 | `renderBulkAction` | Botones accion masiva |
| _a33 | `showBulkActionForm` | Form accion masiva popup |
| _a34 | `renderAllExcQueues` | 3 colas excepciones |
| _a35 | `initAyudaPopovers` | Popovers de ayuda |
| _a36 | `closeAllAyudas` | Cierra popovers |
| _a37 | `renderActionButtons` | Botones accion individual |
| _a38 | `showActionForm` | Form accion individual popup |
| _a39 | `checkAllExceptionsResolved` | Verifica excepciones resueltas |
| _a40 | `buildReportCheck` | Checkbox config reportes |
| _a41 | `getAllSourceColumns` | Columnas archivos fuente |
| _a42 | `buildExtraFieldRow` | Fila campo extra |
| _a43 | `renderReportConfig` | Config reportes Etapa 3 |
| _a44 | `collectReportMapping` | Recolecta config reportes |
| _a45 | `downloadBlob` | Descarga blob como archivo |
| _a47 | `writeFileToOutput` | Escribe en carpeta salida |
| _a48 | `writeAllToOutput` | Escribe/descarga todos |
| _a49 | `initStageNavigation` | Navegacion etapas |
| _a50 | `initAdvanceButtons` | Botones avance |
| _a51 | `initRefreshButton` | Boton Actualizar |
| _a52 | `initReanalyzeButton` | Boton Re-analizar |
| _a53 | `runEDA` | Ejecuta analisis EDA |
| _a54 | `runConciliation` | Ejecuta conciliacion |
| _a55 | `runReports` | Genera reportes |
| _a56 | `initSeparadorConfig` | Config separadores |
| _a57 | `buildMiniBar` | Barra mini porcentaje |
