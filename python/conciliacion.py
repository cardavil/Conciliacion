"""
conciliacion.py — Motor de procesamiento
Ejecuta dentro de Pyodide (navegador).
Ref: CLAUDE.md, DATA.md
"""

import pandas as pd
import json
import os
from io import BytesIO
from datetime import datetime


# ============================================
# UTILIDADES
# ============================================

def _ahora():
    """Timestamp ISO 8601 actual."""
    return datetime.now().isoformat()


def _respuesta(estado, mensajes, datos=None):
    """Estructura estandar de respuesta."""
    return {
        "estado": estado,
        "mensajes": mensajes,
        "datos": datos if datos is not None else {},
        "timestamp": _ahora()
    }


def _msg(nivel, texto):
    """Crea un mensaje individual."""
    return {"nivel": nivel, "texto": texto}


def detectar_encoding(ruta):
    """
    Detecta el encoding de un archivo de texto.
    Intenta utf-8 primero, si falla usa latin-1 como fallback.
    """
    for enc in ("utf-8", "latin-1"):
        try:
            with open(ruta, "r", encoding=enc) as f:
                f.read(8192)
            return enc
        except (UnicodeDecodeError, UnicodeError):
            continue
    return "latin-1"


def detectar_separador(ruta, encoding="utf-8"):
    """
    Detecta el separador de un archivo de texto plano.
    Analiza las primeras lineas y cuenta ocurrencias de separadores comunes.
    """
    candidatos = ["|", ";", ",", "\t"]
    try:
        with open(ruta, "r", encoding=encoding) as f:
            muestra = ""
            for i, linea in enumerate(f):
                if i >= 20:
                    break
                muestra += linea
    except Exception:
        return ","

    if not muestra:
        return ","

    conteos = {}
    lineas = muestra.strip().split("\n")
    for sep in candidatos:
        counts = [linea.count(sep) for linea in lineas if linea.strip()]
        if not counts:
            conteos[sep] = 0
            continue
        # Un buen separador aparece consistentemente en todas las lineas
        if min(counts) > 0 and max(counts) == min(counts):
            conteos[sep] = min(counts)
        elif min(counts) > 0:
            conteos[sep] = min(counts)
        else:
            conteos[sep] = 0

    if not conteos or max(conteos.values()) == 0:
        return ","

    return max(conteos, key=conteos.get)


def leer_archivo(ruta):
    """
    Lee un archivo (txt, csv, xlsx) y retorna un DataFrame.
    Detecta separador y encoding automaticamente para archivos de texto.
    Maneja errores con mensajes descriptivos.
    """
    ext = os.path.splitext(ruta)[1].lower()

    try:
        if ext in (".xlsx", ".xls"):
            df = pd.read_excel(ruta, engine="openpyxl", dtype=str)
        elif ext in (".csv", ".txt", ".tsv"):
            encoding = detectar_encoding(ruta)
            sep = detectar_separador(ruta, encoding)
            df = pd.read_csv(ruta, sep=sep, encoding=encoding, dtype=str)
        else:
            # Intentar como texto con deteccion automatica
            encoding = detectar_encoding(ruta)
            sep = detectar_separador(ruta, encoding)
            df = pd.read_csv(ruta, sep=sep, encoding=encoding, dtype=str)

        # Limpiar nombres de columna
        df.columns = [str(c).strip() for c in df.columns]
        return df

    except Exception as e:
        raise ValueError(
            "No se pudo leer el archivo {}: {}".format(os.path.basename(ruta), str(e))
        )


def resultado_a_json(resultado):
    """
    Convierte un resultado (puede incluir DataFrames) a JSON serializable.
    Los DataFrames se convierten a lista de dicts.
    """
    def _convertir(obj):
        if isinstance(obj, pd.DataFrame):
            return obj.where(obj.notna(), None).to_dict(orient="records")
        if isinstance(obj, pd.Series):
            return obj.where(obj.notna(), None).to_list()
        if isinstance(obj, dict):
            return {k: _convertir(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_convertir(v) for v in obj]
        if isinstance(obj, (pd.Timestamp, datetime)):
            return obj.isoformat()
        if pd.isna(obj):
            return None
        return obj

    converted = _convertir(resultado)
    return json.dumps(converted, ensure_ascii=False, default=str)


def _detectar_tipo_columna(serie):
    """
    Detecta el tipo de una columna: 'numerico', 'fecha' o 'texto'.
    Analiza una muestra de hasta 100 valores no nulos.
    Retorna: (tipo_detectado, formato_inconsistente)
    """
    muestra = serie.dropna()
    if serie.dtype == object:
        muestra = muestra[muestra.astype(str).str.strip() != ""]
    muestra = muestra.head(100)

    if len(muestra) == 0:
        return "texto", False

    # Intentar numerico
    if serie.dtype == object:
        try:
            pd.to_numeric(muestra, errors="raise")
            return "numerico", False
        except (ValueError, TypeError):
            pass

        # Detectar formato numerico regional inconsistente
        patron = muestra.astype(str).str.match(
            r'^-?\d{1,3}([.,]\d{3})*([.,]\d+)?$'
        )
        if patron.sum() > len(muestra) * 0.5:
            return "numerico", True
    elif pd.api.types.is_numeric_dtype(serie):
        return "numerico", False

    # Intentar fecha
    if serie.dtype == object:
        formatos_fecha = [
            "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y",
            "%Y%m%d", "%d-%m-%Y", "%d.%m.%Y",
            "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S",
        ]
        for fmt in formatos_fecha:
            try:
                pd.to_datetime(muestra, format=fmt, errors="raise")
                return "fecha", False
            except (ValueError, TypeError):
                continue

        try:
            resultado = pd.to_datetime(muestra, errors="coerce", dayfirst=True)
            tasa_exito = resultado.notna().sum() / len(muestra)
            if tasa_exito > 0.8:
                return "fecha", False
        except Exception:
            pass

    return "texto", False


def _verificar_consistencia_separador(ruta, encoding, sep):
    """
    Verifica que el separador sea consistente entre header y datos.
    Retorna: (consistente, mensaje o None)
    """
    try:
        with open(ruta, "r", encoding=encoding) as f:
            lineas = []
            for i, linea in enumerate(f):
                if i >= 20:
                    break
                lineas.append(linea.rstrip("\n\r"))
    except Exception:
        return True, None

    if len(lineas) < 2:
        return True, None

    conteo_header = lineas[0].count(sep)
    conteos_datos = [linea.count(sep) for linea in lineas[1:] if linea.strip()]

    if not conteos_datos or conteo_header == 0:
        return True, None

    inconsistentes = sum(1 for c in conteos_datos if c != conteo_header)
    if inconsistentes > 0:
        return False, "Header tiene {} separadores, pero {}/{} lineas de datos difieren".format(
            conteo_header, inconsistentes, len(conteos_datos)
        )

    return True, None


def _perfilar_columna(serie):
    """
    Genera perfil completo de una columna: tipo, nulos, vacios, muestra.
    Retorna dict con el perfil.
    """
    n_total = len(serie)
    n_nulos = int(serie.isna().sum())
    n_vacios = 0
    if serie.dtype == object:
        n_vacios = int((serie.astype(str).str.strip() == "").sum())

    tipo_detectado, formato_inconsistente = _detectar_tipo_columna(serie)

    muestra_vals = serie.dropna()
    if serie.dtype == object:
        muestra_vals = muestra_vals[muestra_vals.astype(str).str.strip() != ""]
    valores_muestra = [str(v) for v in muestra_vals.unique()[:5]]

    n_unicos = int(serie.nunique())
    pct_nulo = round((n_nulos + n_vacios) / n_total * 100, 1) if n_total > 0 else 0

    return {
        "nombre": serie.name,
        "tipo_detectado": tipo_detectado,
        "formato_inconsistente": formato_inconsistente,
        "nulos": n_nulos,
        "vacios": n_vacios,
        "pct_nulo": pct_nulo,
        "unicos": n_unicos,
        "total": n_total,
        "valores_muestra": valores_muestra,
    }


# ============================================
# ETAPA 1 — REVISION DE ENTORNO
# ============================================

def analizar_archivo(nombre, ruta):
    """
    Analiza un archivo individual sin asumir estructura.
    Detecta: formato, encoding, separador, filas, columnas,
    perfil por columna (tipo, nulos, vacios, muestra), llave sugerida,
    filas vacias, consistencia de separador.
    Retorna dict con metadatos y perfil completo.
    """
    mensajes = []
    ext = os.path.splitext(nombre)[1].lower()

    meta = {
        "nombre": nombre,
        "extension": ext,
        "tamano_bytes": 0,
        "encoding": None,
        "separador": None,
        "filas": 0,
        "columnas": 0,
        "nombres_columnas": [],
        "perfil_columnas": [],
        "llave_sugerida": None,
        "filas_vacias": 0,
    }

    try:
        meta["tamano_bytes"] = os.path.getsize(ruta)
    except Exception:
        pass

    df = None
    try:
        if ext in (".xlsx", ".xls"):
            df = pd.read_excel(ruta, engine="openpyxl", dtype=str)
            df.columns = [str(c).strip() for c in df.columns]
            meta["encoding"] = "N/A"
            meta["separador"] = "N/A"
            mensajes.append(_msg("ok", "Archivo Excel leido correctamente"))
        else:
            encoding = detectar_encoding(ruta)
            sep = detectar_separador(ruta, encoding)
            meta["encoding"] = encoding
            meta["separador"] = repr(sep)

            sep_ok, sep_msg = _verificar_consistencia_separador(ruta, encoding, sep)
            if not sep_ok:
                mensajes.append(_msg("warn", sep_msg))

            df = pd.read_csv(ruta, sep=sep, encoding=encoding, dtype=str)
            df.columns = [str(c).strip() for c in df.columns]
            mensajes.append(_msg("ok", "Archivo de texto leido ({}, sep={})".format(
                encoding, repr(sep)
            )))

    except Exception as e:
        mensajes.append(_msg("error", "No se pudo analizar: {}".format(str(e))))
        return _respuesta("error", mensajes, meta)

    meta["filas"] = len(df)
    meta["columnas"] = len(df.columns)
    meta["nombres_columnas"] = list(df.columns)

    if len(df) == 0:
        mensajes.append(_msg("warn", "El archivo no tiene filas de datos"))
        estado_final = "warn"
        return _respuesta(estado_final, mensajes, meta)

    # Perfil por columna
    perfil_columnas = []
    for col in df.columns:
        pc = _perfilar_columna(df[col])
        perfil_columnas.append(pc)

        if pc["pct_nulo"] > 50:
            mensajes.append(_msg("warn", "{}: {:.0f}% valores nulos/vacios (critico)".format(
                col, pc["pct_nulo"]
            )))
        elif pc["pct_nulo"] > 20:
            mensajes.append(_msg("warn", "{}: {:.0f}% valores nulos/vacios".format(
                col, pc["pct_nulo"]
            )))
        if pc["formato_inconsistente"]:
            mensajes.append(_msg("warn", "{}: formato numerico inconsistente".format(col)))

    meta["perfil_columnas"] = perfil_columnas

    # Sugerir llave primaria
    for pc in perfil_columnas:
        if pc["nulos"] == 0 and pc["vacios"] == 0 and pc["unicos"] == pc["total"]:
            meta["llave_sugerida"] = pc["nombre"]
            break

    # Detectar filas completamente vacias
    filas_vacias = df.isna().all(axis=1)
    if df.dtypes.apply(lambda dt: dt == object).any():
        filas_vacias = filas_vacias | df.astype(str).apply(
            lambda row: row.str.strip().eq("").all(), axis=1
        )
    n_filas_vacias = int(filas_vacias.sum())
    meta["filas_vacias"] = n_filas_vacias
    if n_filas_vacias > 0:
        mensajes.append(_msg("warn", "{} fila(s) completamente vacia(s)".format(n_filas_vacias)))

    tiene_warn = any(m["nivel"] == "warn" for m in mensajes)
    tiene_error = any(m["nivel"] == "error" for m in mensajes)
    estado_final = "error" if tiene_error else ("warn" if tiene_warn else "ok")

    return _respuesta(estado_final, mensajes, meta)


# ============================================
# ETAPA 2 — VALIDACION POR FUENTE
# ============================================

def inferir_perfil(df, nombre):
    """
    Infiere el perfil de un DataFrame: columnas, tipos detectados,
    posible llave primaria, muestra de valores.
    La llave se infiere buscando la columna con valores unicos y sin nulos.
    Retorna dict con el perfil inferido para aprobacion del analista.
    """
    perfil = {
        "nombre": nombre,
        "columnas": [],
        "llave_sugerida": None,
        "filas": len(df),
    }

    for col in df.columns:
        info_col = _perfilar_columna(df[col])
        perfil["columnas"].append(info_col)

        if (info_col["nulos"] == 0 and info_col["vacios"] == 0
                and info_col["unicos"] == info_col["total"]
                and perfil["llave_sugerida"] is None):
            perfil["llave_sugerida"] = col

    return perfil


def validar_fuente(nombre, ruta, perfil=None):
    """
    Valida un archivo contra su perfil (si existe) o infiere perfil nuevo.
    Detecta: columnas faltantes, tipos inconsistentes, vacios, duplicados en llave.
    Retorna: estado, mensajes, perfil inferido, registros validos/con error.
    """
    mensajes = []

    try:
        df = leer_archivo(ruta)
    except ValueError as e:
        mensajes.append(_msg("error", str(e)))
        return _respuesta("error", mensajes)

    if len(df) == 0:
        mensajes.append(_msg("error", "El archivo no tiene filas de datos"))
        return _respuesta("error", mensajes)

    perfil_inferido = inferir_perfil(df, nombre)
    mensajes.append(_msg("info", "{} filas, {} columnas detectadas".format(
        len(df), len(df.columns)
    )))

    estado = "ok"

    # Validar contra perfil proporcionado si existe
    if perfil is not None:
        cols_esperadas = set(perfil.get("columnas_esperadas", []))
        cols_reales = set(df.columns)
        faltantes = cols_esperadas - cols_reales
        if faltantes:
            estado = "error"
            mensajes.append(_msg("error", "Columnas esperadas no encontradas: {}".format(
                ", ".join(sorted(faltantes))
            )))
            mensajes.append(_msg("info", "Columnas encontradas: {}".format(
                ", ".join(sorted(cols_reales))
            )))

    # Detectar columnas con muchos nulos (umbral 20%, critico 50%)
    for info_col in perfil_inferido["columnas"]:
        pct_nulo = info_col.get("pct_nulo", 0)
        if pct_nulo > 50:
            if estado != "error":
                estado = "warn"
            mensajes.append(_msg("warn", "{}: {:.0f}% de valores vacios o nulos (critico)".format(
                info_col["nombre"], pct_nulo
            )))
        elif pct_nulo > 20:
            if estado != "error":
                estado = "warn"
            mensajes.append(_msg("warn", "{}: {:.0f}% de valores vacios o nulos".format(
                info_col["nombre"], pct_nulo
            )))

    # Detectar formato numerico inconsistente
    for info_col in perfil_inferido["columnas"]:
        if info_col.get("formato_inconsistente", False):
            if estado != "error":
                estado = "warn"
            mensajes.append(_msg("warn",
                "{}: formato numerico inconsistente (posible mezcla de separadores)".format(
                    info_col["nombre"]
                )))

    # Detectar filas completamente vacias
    filas_vacias = df.isna().all(axis=1)
    if df.dtypes.apply(lambda dt: dt == object).any():
        filas_vacias = filas_vacias | df.astype(str).apply(
            lambda row: row.str.strip().eq("").all(), axis=1
        )
    n_filas_vacias = int(filas_vacias.sum())
    if n_filas_vacias > 0:
        if estado != "error":
            estado = "warn"
        mensajes.append(_msg("warn", "{} fila(s) completamente vacia(s)".format(n_filas_vacias)))

    # Detectar duplicados en llave sugerida
    llave = perfil_inferido.get("llave_sugerida")
    if perfil is not None and "llave" in perfil:
        llave = perfil["llave"]
    if llave and llave in df.columns:
        n_dup = int(df[llave].duplicated().sum())
        if n_dup > 0:
            if estado != "error":
                estado = "warn"
            mensajes.append(_msg("warn", "Llave '{}': {} valores duplicados".format(
                llave, n_dup
            )))
            perfil_inferido["llave_sugerida"] = llave

    if estado == "ok":
        mensajes.append(_msg("ok", "Validacion correcta"))

    datos = {
        "perfil": perfil_inferido,
        "registros": len(df),
        "llave": perfil_inferido.get("llave_sugerida"),
        "dataframe": df,
    }

    return _respuesta(estado, mensajes, datos)


# ============================================
# ETAPA 3 — VALIDACION CRUZADA
# ============================================

def validar_cruzado(fuentes):
    """
    Recibe dict de {nombre: {"df": DataFrame, "llave": str}}.
    Cruza llaves entre fuentes para detectar registros sin match,
    duplicados cruzados e inconsistencias.
    Retorna: metricas, registros sin match, estado.
    """
    mensajes = []
    nombres = list(fuentes.keys())

    if len(nombres) < 2:
        mensajes.append(_msg("warn", "Se necesitan al menos 2 fuentes para cruce"))
        return _respuesta("warn", mensajes, {
            "match": 0, "sin_match": 0, "duplicados": 0,
            "cobertura": 0, "detalles": []
        })

    # Recolectar todas las llaves por fuente
    llaves_por_fuente = {}
    for nombre in nombres:
        info = fuentes[nombre]
        df = info["df"]
        llave_col = info.get("llave")
        if llave_col and llave_col in df.columns:
            llaves_por_fuente[nombre] = set(df[llave_col].dropna().astype(str).unique())
        else:
            llaves_por_fuente[nombre] = set()
            mensajes.append(_msg("warn", "{}: sin columna llave definida".format(nombre)))

    # Cruzar: encontrar union e interseccion de llaves
    todas_llaves = set()
    for s in llaves_por_fuente.values():
        todas_llaves |= s

    if not todas_llaves:
        mensajes.append(_msg("error", "No se encontraron llaves para cruzar"))
        return _respuesta("error", mensajes, {
            "match": 0, "sin_match": 0, "duplicados": 0,
            "cobertura": 0, "detalles": []
        })

    # Interseccion de todas las fuentes
    comun = set(todas_llaves)
    for s in llaves_por_fuente.values():
        comun &= s

    sin_match_detalles = []
    for llave_val in sorted(todas_llaves - comun):
        presente_en = []
        ausente_en = []
        for nombre in nombres:
            if llave_val in llaves_por_fuente[nombre]:
                presente_en.append(nombre)
            else:
                ausente_en.append(nombre)
        sin_match_detalles.append({
            "llave": llave_val,
            "presente_en": ", ".join(presente_en),
            "ausente_en": ", ".join(ausente_en),
            "monto": "",
        })

    # Detectar duplicados cruzados (misma llave en misma fuente)
    n_duplicados = 0
    for nombre in nombres:
        info = fuentes[nombre]
        df = info["df"]
        llave_col = info.get("llave")
        if llave_col and llave_col in df.columns:
            n_dup = int(df[llave_col].dropna().duplicated().sum())
            n_duplicados += n_dup
            if n_dup > 0:
                mensajes.append(_msg("warn", "{}: {} llaves duplicadas".format(
                    nombre, n_dup
                )))

    n_match = len(comun)
    n_sin_match = len(todas_llaves) - n_match
    cobertura = round(n_match / len(todas_llaves) * 100, 1) if todas_llaves else 0

    estado = "ok"
    if n_sin_match > 0:
        estado = "warn"
    if cobertura < 50:
        estado = "error"
        mensajes.append(_msg("error", "Cobertura inferior al 50%"))

    mensajes.append(_msg("info", "{} llaves en comun, {} sin match, cobertura {:.1f}%".format(
        n_match, n_sin_match, cobertura
    )))

    datos = {
        "match": n_match,
        "sin_match": n_sin_match,
        "duplicados": n_duplicados,
        "cobertura": cobertura,
        "detalles": sin_match_detalles,
    }

    return _respuesta(estado, mensajes, datos)


# ============================================
# ETAPA 4 — CONCILIACION
# ============================================

def conciliar(cuenta_cobro, descuentos, llave, conceptos, periodo_anterior=None):
    """
    Cruza cuenta de cobro vs descuentos por llave y conceptos.
    Por cada registro determina: OK, EXCEDENTE, FALTANTE, SIN_MATCH.
    Detecta novedades vs periodo anterior si se proporciona.
    Retorna: registros conciliados, excepciones, resumen, novedades.
    """
    mensajes = []
    resultados = []
    excepciones = []
    novedades = []

    if llave not in cuenta_cobro.columns:
        mensajes.append(_msg("error", "Llave '{}' no encontrada en cuenta de cobro".format(llave)))
        return _respuesta("error", mensajes)

    if llave not in descuentos.columns:
        mensajes.append(_msg("error", "Llave '{}' no encontrada en descuentos".format(llave)))
        return _respuesta("error", mensajes)

    # Normalizar llaves a string
    cc = cuenta_cobro.copy()
    desc = descuentos.copy()
    cc[llave] = cc[llave].astype(str).str.strip()
    desc[llave] = desc[llave].astype(str).str.strip()

    # Convertir columnas de concepto a numerico
    for col in conceptos:
        if col in cc.columns:
            cc[col] = pd.to_numeric(cc[col], errors="coerce").fillna(0)
        if col in desc.columns:
            desc[col] = pd.to_numeric(desc[col], errors="coerce").fillna(0)

    llaves_cc = set(cc[llave].unique())
    llaves_desc = set(desc[llave].unique())
    todas = llaves_cc | llaves_desc

    conteo = {"ok": 0, "excedente": 0, "faltante": 0, "sin_match": 0, "error": 0}

    for llave_val in sorted(todas):
        fila_cc = cc[cc[llave] == llave_val]
        fila_desc = desc[desc[llave] == llave_val]

        if fila_cc.empty and not fila_desc.empty:
            conteo["sin_match"] += 1
            excepciones.append({
                "llave": llave_val,
                "concepto": "(todos)",
                "esperado": "0",
                "real": "presente en descuentos",
                "diferencia": "SIN_MATCH",
                "tipo": "SIN_MATCH",
            })
            continue

        if not fila_cc.empty and fila_desc.empty:
            conteo["sin_match"] += 1
            excepciones.append({
                "llave": llave_val,
                "concepto": "(todos)",
                "esperado": "presente en cuenta cobro",
                "real": "0",
                "diferencia": "SIN_MATCH",
                "tipo": "SIN_MATCH",
            })
            continue

        # Ambas presentes: comparar por concepto
        fila_cc_first = fila_cc.iloc[0]
        fila_desc_first = fila_desc.iloc[0]

        for concepto in conceptos:
            val_esperado = 0
            val_real = 0

            if concepto in cc.columns:
                val_esperado = float(fila_cc_first.get(concepto, 0) or 0)
            if concepto in desc.columns:
                val_real = float(fila_desc_first.get(concepto, 0) or 0)

            diferencia = val_real - val_esperado

            if abs(diferencia) < 0.01:
                estado_reg = "OK"
                conteo["ok"] += 1
            elif diferencia > 0:
                estado_reg = "EXCEDENTE"
                conteo["excedente"] += 1
                excepciones.append({
                    "llave": llave_val,
                    "concepto": concepto,
                    "esperado": str(val_esperado),
                    "real": str(val_real),
                    "diferencia": str(round(diferencia, 2)),
                    "tipo": "EXCEDENTE",
                })
            else:
                estado_reg = "FALTANTE"
                conteo["faltante"] += 1
                excepciones.append({
                    "llave": llave_val,
                    "concepto": concepto,
                    "esperado": str(val_esperado),
                    "real": str(val_real),
                    "diferencia": str(round(diferencia, 2)),
                    "tipo": "FALTANTE",
                })

            resultados.append({
                "llave": llave_val,
                "concepto": concepto,
                "esperado": val_esperado,
                "real": val_real,
                "diferencia": round(diferencia, 2),
                "estado": estado_reg,
            })

    # Novedades vs periodo anterior
    if periodo_anterior is not None and llave in periodo_anterior.columns:
        pa = periodo_anterior.copy()
        pa[llave] = pa[llave].astype(str).str.strip()
        llaves_ant = set(pa[llave].unique())

        nuevos = llaves_cc - llaves_ant
        retirados = llaves_ant - llaves_cc

        for lv in sorted(nuevos):
            novedades.append({
                "llave": lv,
                "tipo": "NUEVO",
                "mensaje": "Asociado nuevo: {}".format(lv),
            })
        for lv in sorted(retirados):
            novedades.append({
                "llave": lv,
                "tipo": "RETIRO",
                "mensaje": "Asociado retirado: {}".format(lv),
            })

    # Estado general
    estado = "ok"
    if excepciones:
        estado = "warn"
    if conteo["error"] > 0:
        estado = "error"

    total_comparaciones = sum(conteo.values())
    mensajes.append(_msg("info", "{} comparaciones realizadas".format(total_comparaciones)))
    mensajes.append(_msg("info", "OK: {}, Excedente: {}, Faltante: {}, Sin match: {}".format(
        conteo["ok"], conteo["excedente"], conteo["faltante"], conteo["sin_match"]
    )))
    if novedades:
        mensajes.append(_msg("info", "{} novedad(es) detectada(s)".format(len(novedades))))

    datos = {
        "resultados": resultados,
        "excepciones": excepciones,
        "novedades": novedades,
        "resumen": conteo,
        "ok": conteo["ok"],
        "excedente": conteo["excedente"],
        "faltante": conteo["faltante"],
        "error": conteo["error"],
    }

    return _respuesta(estado, mensajes, datos)


# ============================================
# ETAPA 5 — REPORTES
# ============================================

def generar_reportes(conciliacion_resultado, audit_trail=None):
    """
    Genera archivos de reporte como bytes.
    Retorna dict de {nombre_archivo: bytes} para descarga.
    """
    mensajes = []
    archivos = {}
    datos_conc = conciliacion_resultado.get("datos", {})

    try:
        # Resumen ejecutivo
        resumen_buf = BytesIO()
        resumen_data = {
            "Metrica": ["OK", "Excedente", "Faltante", "Sin Match", "Error"],
            "Cantidad": [
                datos_conc.get("ok", 0),
                datos_conc.get("excedente", 0),
                datos_conc.get("faltante", 0),
                datos_conc.get("resumen", {}).get("sin_match", 0),
                datos_conc.get("error", 0),
            ]
        }
        df_resumen = pd.DataFrame(resumen_data)
        df_resumen.to_excel(resumen_buf, index=False, engine="openpyxl",
                            sheet_name="Resumen")
        archivos["resumen_ejecutivo.xlsx"] = resumen_buf.getvalue()
        mensajes.append(_msg("ok", "Resumen ejecutivo generado"))

    except Exception as e:
        mensajes.append(_msg("error", "Error generando resumen: {}".format(str(e))))

    try:
        # Detalle de excepciones
        excepciones = datos_conc.get("excepciones", [])
        if excepciones:
            exc_buf = BytesIO()
            df_exc = pd.DataFrame(excepciones)
            df_exc.to_excel(exc_buf, index=False, engine="openpyxl",
                            sheet_name="Excepciones")
            archivos["excepciones_detalle.xlsx"] = exc_buf.getvalue()
            mensajes.append(_msg("ok", "Detalle de excepciones generado"))

    except Exception as e:
        mensajes.append(_msg("error", "Error generando excepciones: {}".format(str(e))))

    try:
        # Resultados completos de conciliacion
        resultados = datos_conc.get("resultados", [])
        if resultados:
            res_buf = BytesIO()
            df_res = pd.DataFrame(resultados)
            df_res.to_excel(res_buf, index=False, engine="openpyxl",
                            sheet_name="Conciliacion")
            archivos["conciliacion_completa.xlsx"] = res_buf.getvalue()
            mensajes.append(_msg("ok", "Conciliacion completa generada"))

    except Exception as e:
        mensajes.append(_msg("error", "Error generando conciliacion: {}".format(str(e))))

    try:
        # Novedades
        novedades = datos_conc.get("novedades", [])
        if novedades:
            nov_buf = BytesIO()
            df_nov = pd.DataFrame(novedades)
            df_nov.to_excel(nov_buf, index=False, engine="openpyxl",
                            sheet_name="Novedades")
            archivos["novedades.xlsx"] = nov_buf.getvalue()
            mensajes.append(_msg("ok", "Novedades generadas"))

    except Exception as e:
        mensajes.append(_msg("error", "Error generando novedades: {}".format(str(e))))

    try:
        # Audit trail
        if audit_trail:
            at_buf = BytesIO()
            df_at = pd.DataFrame(audit_trail)
            df_at.to_excel(at_buf, index=False, engine="openpyxl",
                           sheet_name="Audit Trail")
            archivos["audit_log.xlsx"] = at_buf.getvalue()
            mensajes.append(_msg("ok", "Audit trail generado"))

    except Exception as e:
        mensajes.append(_msg("error", "Error generando audit trail: {}".format(str(e))))

    estado = "ok"
    for m in mensajes:
        if m["nivel"] == "error":
            estado = "error"
            break

    datos = {
        "archivos": archivos,
        "total": len(archivos),
    }

    return _respuesta(estado, mensajes, datos)
