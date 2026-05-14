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


def _es_tipo_texto(dtype):
    return pd.api.types.is_string_dtype(dtype) or dtype == object


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
            df = pd.read_excel(ruta, engine="openpyxl", dtype=str, keep_default_na=False)
        elif ext in (".csv", ".txt", ".tsv"):
            encoding = detectar_encoding(ruta)
            sep = detectar_separador(ruta, encoding)
            df = pd.read_csv(ruta, sep=sep, encoding=encoding, dtype=str, keep_default_na=False)
        else:
            # Intentar como texto con deteccion automatica
            encoding = detectar_encoding(ruta)
            sep = detectar_separador(ruta, encoding)
            df = pd.read_csv(ruta, sep=sep, encoding=encoding, dtype=str, keep_default_na=False)

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
            return obj.to_dict(orient="records")
        if isinstance(obj, pd.Series):
            return obj.to_list()
        if isinstance(obj, dict):
            return {k: _convertir(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_convertir(v) for v in obj]
        if isinstance(obj, (pd.Timestamp, datetime)):
            return obj.isoformat()
        try:
            if pd.isna(obj):
                return None
        except (TypeError, ValueError):
            pass
        return obj

    converted = _convertir(resultado)
    return json.dumps(converted, ensure_ascii=False, default=str)


FORMATOS_FECHA = [
    "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y",
    "%Y%m%d", "%d-%m-%Y", "%d.%m.%Y",
    "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S",
]

def _es_numero_valido(val, decimal_sep=","):
    s = str(val).strip()
    if not s:
        return False
    if s.startswith("-"):
        s = s[1:]
    if not s:
        return False
    miles_sep = "." if decimal_sep == "," else ","
    if s.endswith(miles_sep):
        return False
    if s.startswith(miles_sep):
        return False
    if miles_sep in s:
        partes = s.split(miles_sep)
        if not partes[0].isdigit() or len(partes[0]) > 3 or len(partes[0]) == 0:
            return False
        for p in partes[1:]:
            if decimal_sep in p:
                sub = p.split(decimal_sep)
                if len(sub) != 2:
                    return False
                if not sub[0].isdigit() or len(sub[0]) != 3:
                    return False
                if not sub[1].isdigit() or len(sub[1]) == 0:
                    return False
            else:
                if not p.isdigit() or len(p) != 3:
                    return False
    elif decimal_sep in s:
        partes = s.split(decimal_sep)
        if len(partes) != 2:
            return False
        if not partes[0].isdigit() or not partes[1].isdigit() or len(partes[1]) == 0:
            return False
    else:
        if not s.isdigit():
            return False
    return True


def _detectar_tipo_columna(serie, decimal_sep=","):
    """
    Detecta el tipo de una columna: 'numerico', 'fecha' o 'texto'.
    Analiza una muestra de hasta 100 valores no vacios.
    Usa umbral > 50% para tolerar valores invalidos mezclados.
    """
    es_texto = _es_tipo_texto(serie.dtype)
    muestra = serie[serie.astype(str).str.strip() != ""].head(100)

    if len(muestra) == 0:
        return "texto"

    if es_texto and muestra.astype(str).str.match(r'^0\d+').any():
        return "texto"

    if es_texto:
        tasa_num = muestra.apply(lambda v: _es_numero_valido(v, decimal_sep)).sum() / len(muestra)
        if tasa_num > 0.5:
            return "numerico"
    elif pd.api.types.is_numeric_dtype(serie):
        return "numerico"

    if es_texto:
        for fmt in FORMATOS_FECHA:
            try:
                parsed = pd.to_datetime(muestra, format=fmt, errors="coerce")
                if parsed.notna().sum() / len(muestra) > 0.5:
                    return "fecha"
            except Exception:
                continue

        try:
            resultado = pd.to_datetime(muestra, errors="coerce", dayfirst=True)
            tasa_exito = resultado.notna().sum() / len(muestra)
            if tasa_exito > 0.5:
                return "fecha"
        except Exception:
            pass

    return "texto"


def _contar_invalidos(serie, tipo_detectado, decimal_sep=","):
    """
    Cuenta valores que no cumplen el tipo detectado.
    serie: valores no-vacios.
    Retorna: (n_validos, n_invalidos, muestra_invalidos)
    """
    if len(serie) == 0:
        return 0, 0, []

    if tipo_detectado == "texto":
        return len(serie), 0, []

    if tipo_detectado == "numerico":
        invalidos_mask = ~serie.apply(lambda v: _es_numero_valido(v, decimal_sep))

    elif tipo_detectado == "fecha":
        mejor_mask = pd.Series(False, index=serie.index)
        for fmt in FORMATOS_FECHA:
            try:
                parsed = pd.to_datetime(serie[~mejor_mask], format=fmt, errors="coerce")
                mejor_mask[~mejor_mask] = parsed.notna()
            except Exception:
                continue
        if not mejor_mask.all():
            flexible = pd.to_datetime(serie[~mejor_mask], errors="coerce", dayfirst=True)
            mejor_mask[~mejor_mask] = flexible.notna()
        invalidos_mask = ~mejor_mask

    else:
        return len(serie), 0, []

    n_invalidos = int(invalidos_mask.sum())
    n_validos = len(serie) - n_invalidos
    muestra = [str(v) for v in serie[invalidos_mask].unique()[:5]]
    return n_validos, n_invalidos, muestra


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


def _perfilar_columna(serie, decimal_sep=","):
    """
    Genera perfil de una columna: tipo, vacios, validos, invalidos, muestra.
    """
    n_total = len(serie)
    vacios_mask = serie.astype(str).str.strip() == ""
    n_vacios = int(vacios_mask.sum())
    con_valor = serie[~vacios_mask]

    tipo_detectado = _detectar_tipo_columna(serie, decimal_sep)
    n_validos, n_invalidos, muestra_invalidos = _contar_invalidos(con_valor, tipo_detectado, decimal_sep)

    n_unicos = int(serie.nunique())
    valores_muestra = [str(v) for v in con_valor.unique()[:5]]
    pct_vacios = round(n_vacios / n_total * 100, 1) if n_total > 0 else 0
    n_con_valor = n_total - n_vacios
    pct_invalidos = round(n_invalidos / n_con_valor * 100, 1) if n_con_valor > 0 else 0

    return {
        "nombre": serie.name,
        "tipo_detectado": tipo_detectado,
        "vacios": n_vacios,
        "pct_vacios": pct_vacios,
        "validos": n_validos,
        "invalidos": n_invalidos,
        "pct_invalidos": pct_invalidos,
        "muestra_invalidos": muestra_invalidos,
        "unicos": n_unicos,
        "total": n_total,
        "valores_muestra": valores_muestra,
    }


# ============================================
# ETAPA 1 — REVISION DE ENTORNO
# ============================================

def analizar_archivo(nombre, ruta, decimal_sep=","):
    """
    Analiza un archivo individual sin asumir estructura.
    Detecta: formato, encoding, separador, filas, columnas,
    perfil por columna (tipo, vacios, validos, invalidos, muestra),
    llave sugerida, filas vacias, consistencia de separador.
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
            df = pd.read_excel(ruta, engine="openpyxl", dtype=str, keep_default_na=False)
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

            df = pd.read_csv(ruta, sep=sep, encoding=encoding, dtype=str, keep_default_na=False)
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
        pc = _perfilar_columna(df[col], decimal_sep)
        perfil_columnas.append(pc)

        if pc["invalidos"] > 0:
            mensajes.append(_msg("warn", "{}: {} valores invalidos para tipo {}".format(
                col, pc["invalidos"], pc["tipo_detectado"]
            )))

    meta["perfil_columnas"] = perfil_columnas

    # Sugerir llave primaria
    for pc in perfil_columnas:
        n_effective = pc["total"] - pc["vacios"]
        unicos_sin_vacios = pc["unicos"] - (1 if pc["vacios"] > 0 else 0)
        if n_effective > 0 and unicos_sin_vacios == n_effective:
            meta["llave_sugerida"] = pc["nombre"]
            break

    # Detectar filas completamente vacias
    filas_vacias = df.astype(str).apply(
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

def inferir_perfil(df, nombre, decimal_sep=","):
    """
    Infiere el perfil de un DataFrame: columnas, tipos detectados,
    posible llave primaria, muestra de valores.
    La llave se infiere buscando la columna con valores unicos y sin vacios.
    """
    perfil = {
        "nombre": nombre,
        "columnas": [],
        "llave_sugerida": None,
        "filas": len(df),
    }

    for col in df.columns:
        info_col = _perfilar_columna(df[col], decimal_sep)
        perfil["columnas"].append(info_col)

        n_eff = info_col["total"] - info_col["vacios"]
        uniq_eff = info_col["unicos"] - (1 if info_col["vacios"] > 0 else 0)
        if n_eff > 0 and uniq_eff == n_eff and perfil["llave_sugerida"] is None:
            perfil["llave_sugerida"] = col

    return perfil


def validar_fuente(nombre, ruta, perfil=None, decimal_sep=","):
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

    perfil_inferido = inferir_perfil(df, nombre, decimal_sep)
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

    # Detectar valores invalidos por columna
    for info_col in perfil_inferido["columnas"]:
        if info_col.get("invalidos", 0) > 0:
            if estado != "error":
                estado = "warn"
            mensajes.append(_msg("warn", "{}: {} valores invalidos para tipo {}".format(
                info_col["nombre"], info_col["invalidos"], info_col["tipo_detectado"]
            )))

    # Detectar filas completamente vacias
    filas_vacias = df.astype(str).apply(
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
            vals = df[llave_col].astype(str)
            llaves_por_fuente[nombre] = set(vals[vals.str.strip() != ""].unique())
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
            llave_vals = df[llave_col].astype(str)
            llave_vals = llave_vals[llave_vals.str.strip() != ""]
            n_dup = int(llave_vals.duplicated().sum())
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
