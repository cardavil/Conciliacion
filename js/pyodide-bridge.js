/* pyodide-bridge.js — Comunicacion JS <-> Pyodide segun STACK.md */

const PyBridge = (() => {
  'use strict';

  /* ============================================
     ESTADO INTERNO
     ============================================ */

  let pyodide = null;
  let ready = false;

  const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
  const PYTHON_SOURCE = 'python/conciliacion.py';
  const LOAD_TIMEOUT_MS = 120000;
  const CALL_TIMEOUT_MS = 300000;

  /* ============================================
     CARGA DE PYODIDE
     ============================================ */

  async function init(onProgress) {
    var progress = typeof onProgress === 'function' ? onProgress : function () {};

    try {
      // Paso 1: cargar Pyodide
      progress('Cargando motor de procesamiento...');
      App.addLog('info', 'Cargando Pyodide...');

      if (typeof loadPyodide !== 'function') {
        throw new Error('No se pudo cargar el motor de procesamiento. Verifica tu conexion.');
      }

      pyodide = await withTimeout(
        loadPyodide({ indexURL: PYODIDE_CDN }),
        LOAD_TIMEOUT_MS,
        'Tiempo de espera agotado al cargar Pyodide.'
      );

      App.addLog('ok', 'Pyodide cargado');

      // Paso 2: instalar paquetes via micropip
      progress('Instalando dependencias (pandas, openpyxl)...');
      App.addLog('info', 'Instalando pandas y openpyxl...');

      await withTimeout(
        pyodide.loadPackage('micropip'),
        LOAD_TIMEOUT_MS,
        'Tiempo de espera agotado al instalar micropip.'
      );

      var micropip = pyodide.pyimport('micropip');
      await withTimeout(
        micropip.install(['pandas', 'openpyxl']),
        LOAD_TIMEOUT_MS,
        'Tiempo de espera agotado al instalar dependencias.'
      );

      App.addLog('ok', 'Dependencias instaladas');

      // Paso 3: cargar codigo Python
      progress('Cargando logica de procesamiento...');
      App.addLog('info', 'Cargando conciliacion.py...');

      var pyCode = await withTimeout(
        fetchPythonSource(),
        30000,
        'Tiempo de espera agotado al cargar conciliacion.py.'
      );

      await pyodide.runPythonAsync(pyCode);
      App.addLog('ok', 'Logica de procesamiento cargada');

      // Listo
      ready = true;
      progress('Listo');
      App.addLog('ok', 'Motor de procesamiento listo');

    } catch (err) {
      ready = false;
      var msg = formatError(err);
      App.addLog('error', msg);
      progress('Error: ' + msg);
      throw err;
    }
  }

  async function fetchPythonSource() {
    var response = await fetch(PYTHON_SOURCE);
    if (!response.ok) {
      throw new Error('No se pudo cargar ' + PYTHON_SOURCE + ' (HTTP ' + response.status + ')');
    }
    return await response.text();
  }

  /* ============================================
     TRANSFERENCIA DE ARCHIVOS JS -> PYTHON
     ============================================ */

  async function loadFile(name, arrayBuffer) {
    if (!pyodide) {
      throw new Error('Pyodide no esta inicializado');
    }

    var bytes = new Uint8Array(arrayBuffer);
    var dir = '/uploads';

    // Crear directorio si no existe
    try {
      pyodide.FS.mkdir(dir);
    } catch (e) {
      // Ya existe, ignorar
    }

    var path = dir + '/' + name;
    pyodide.FS.writeFile(path, bytes);
    App.addLog('info', 'Archivo transferido a Python: ' + name);

    return path;
  }

  async function loadFiles(filesMap) {
    var paths = {};
    var entries = Array.from(filesMap.entries());

    for (var i = 0; i < entries.length; i++) {
      var name = entries[i][0];
      var info = entries[i][1];
      paths[name] = await loadFile(name, info.buffer);
    }

    return paths;
  }

  /* ============================================
     EJECUCION DE FUNCIONES PYTHON
     ============================================ */

  async function callPython(fn, args) {
    if (!ready || !pyodide) {
      throw new Error('Pyodide no esta listo. Espera a que termine la inicializacion.');
    }

    // Validar que la funcion exista en el namespace de Python
    var exists = pyodide.runPython(
      'callable(globals().get("' + escapePyString(fn) + '", None))'
    );
    if (!exists) {
      throw new Error('Funcion Python no encontrada: ' + fn);
    }

    try {
      // Construir la llamada
      var pyArgs = preparePyArgs(args);
      var pyFunc = pyodide.globals.get(fn);

      var resultProxy = await withTimeout(
        pyFunc.callKwargs.apply(pyFunc, pyArgs.positional.concat([pyArgs.kwargs])),
        CALL_TIMEOUT_MS,
        'Tiempo de espera agotado ejecutando ' + fn
      );

      // Convertir resultado a JS
      var result = convertToJS(resultProxy);

      // Liberar proxy si aplica
      if (resultProxy && typeof resultProxy.destroy === 'function') {
        resultProxy.destroy();
      }

      return result;

    } catch (err) {
      var msg = extractPythonError(err);
      App.addLog('error', 'Error en ' + fn + ': ' + msg);
      throw new Error(msg);
    }
  }

  async function callPythonSimple(code) {
    if (!ready || !pyodide) {
      throw new Error('Pyodide no esta listo.');
    }

    try {
      var result = await withTimeout(
        pyodide.runPythonAsync(code),
        CALL_TIMEOUT_MS,
        'Tiempo de espera agotado en ejecucion Python.'
      );
      return convertToJS(result);
    } catch (err) {
      var msg = extractPythonError(err);
      App.addLog('error', 'Error Python: ' + msg);
      throw new Error(msg);
    }
  }

  /* ============================================
     TRANSFERENCIA DE RESULTADOS PYTHON -> JS
     ============================================ */

  function convertToJS(proxy) {
    if (proxy == null) return null;

    // Tipos primitivos
    if (typeof proxy !== 'object' || proxy instanceof Blob) {
      return proxy;
    }

    // Proxy de Pyodide
    if (typeof proxy.toJs === 'function') {
      var converted = proxy.toJs({ dict_converter: Object.fromEntries });
      if (typeof proxy.destroy === 'function') {
        proxy.destroy();
      }
      return converted;
    }

    return proxy;
  }

  function readGeneratedFile(path) {
    if (!pyodide) {
      throw new Error('Pyodide no esta inicializado');
    }

    var bytes = pyodide.FS.readFile(path);
    return new Blob([bytes]);
  }

  function readGeneratedFiles(paths) {
    var results = [];
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      var name = p.split('/').pop();
      results.push({
        name: name,
        blob: readGeneratedFile(p)
      });
    }
    return results;
  }

  /* ============================================
     UTILIDADES
     ============================================ */

  function withTimeout(promise, ms, message) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error(message));
      }, ms);

      Promise.resolve(promise).then(
        function (val) {
          clearTimeout(timer);
          resolve(val);
        },
        function (err) {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  function preparePyArgs(args) {
    var result = { positional: [], kwargs: {} };
    if (args == null) return result;

    if (Array.isArray(args)) {
      for (var i = 0; i < args.length; i++) {
        result.positional.push(toPyIfNeeded(args[i]));
      }
    } else if (typeof args === 'object') {
      var keys = Object.keys(args);
      for (var k = 0; k < keys.length; k++) {
        result.kwargs[keys[k]] = toPyIfNeeded(args[keys[k]]);
      }
    } else {
      result.positional.push(toPyIfNeeded(args));
    }

    return result;
  }

  function toPyIfNeeded(value) {
    if (value == null || typeof value === 'string' ||
        typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (pyodide && typeof pyodide.toPy === 'function') {
      return pyodide.toPy(value);
    }
    return value;
  }

  function escapePyString(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function extractPythonError(err) {
    if (!err) return 'Error desconocido';

    // Pyodide incluye el traceback en el mensaje
    var msg = String(err.message || err);

    // Extraer la ultima linea del traceback (el mensaje real)
    var lines = msg.split('\n').filter(function (l) { return l.trim() !== ''; });
    if (lines.length > 1) {
      var lastLine = lines[lines.length - 1].trim();
      // Si la ultima linea parece un error Python, usarla como resumen
      if (/^[A-Z]\w*(Error|Exception|Warning):/.test(lastLine)) {
        return lastLine;
      }
    }

    // Limitar longitud
    if (msg.length > 300) {
      return msg.substring(0, 300) + '...';
    }

    return msg;
  }

  function formatError(err) {
    var msg = String(err.message || err);

    if (msg.indexOf('NetworkError') !== -1 || msg.indexOf('fetch') !== -1) {
      return 'No se pudo cargar el motor de procesamiento. Verifica tu conexion.';
    }
    if (msg.indexOf('micropip') !== -1 || msg.indexOf('install') !== -1) {
      return 'No se pudieron instalar las dependencias. Reintenta.';
    }
    if (msg.indexOf('SyntaxError') !== -1) {
      return 'Error de sintaxis en el codigo Python: ' + msg;
    }

    return msg;
  }

  /* ============================================
     EDA: ANALISIS DE ARCHIVOS (ETAPA 1)
     ============================================ */

  async function analyzeFile(name, path) {
    var resultJson = await callPythonSimple(
      'resultado_a_json(analizar_archivo("' +
      escapePyString(name) + '", "' +
      escapePyString(path) + '"))'
    );
    return JSON.parse(resultJson);
  }

  async function analyzeAllFiles(filesMap) {
    var paths = await loadFiles(filesMap);
    var results = {};
    var entries = Object.entries(paths);

    for (var i = 0; i < entries.length; i++) {
      var name = entries[i][0];
      var path = entries[i][1];
      try {
        results[name] = await analyzeFile(name, path);
        App.addLog('info', name + ' analizado');
      } catch (err) {
        App.addLog('error', 'Error analizando ' + name + ': ' + extractPythonError(err));
        results[name] = {
          estado: 'error',
          mensajes: [{ nivel: 'error', texto: extractPythonError(err) }],
          datos: { nombre: name }
        };
      }
    }

    return results;
  }

  /* ============================================
     API PUBLICA
     ============================================ */

  return {
    init: init,
    loadFile: loadFile,
    loadFiles: loadFiles,
    callPython: callPython,
    callPythonSimple: callPythonSimple,
    readGeneratedFile: readGeneratedFile,
    readGeneratedFiles: readGeneratedFiles,
    analyzeFile: analyzeFile,
    analyzeAllFiles: analyzeAllFiles,
    isReady: function () { return ready; }
  };
})();
