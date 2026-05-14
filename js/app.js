/* app.js — Orquestador de la UI segun STACK.md */

const App = (() => {
  'use strict';

  /* ============================================
     CONFIGURACION
     ============================================ */

  const DEBUG = false;

  /* ============================================
     ESTADO INTERNO
     ============================================ */

  const state = {
    files: new Map(),
    edaResults: {},
    auditTrail: [],
    currentStage: 1,
    reportBlobs: [],
    inputDirHandle: null,
    outputDirHandle: null
  };

  /* ============================================
     UTILIDADES
     ============================================ */

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return document.querySelectorAll(selector);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    const s = String(str);
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function timeHHMM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' +
           String(d.getMinutes()).padStart(2, '0');
  }

  function classifyExtension(filename) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (ext === 'txt') return 'txt';
    if (ext === 'csv') return 'csv';
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    return 'otro';
  }

  function dbg() {
    if (DEBUG) console.log('[App]', ...arguments);
  }

  var ALLOWED_EXTENSIONS = ['txt', 'csv', 'xlsx', 'xls'];

  function supportsDirectoryPicker() {
    return typeof window.showDirectoryPicker === 'function';
  }

  /* ============================================
     LOG DE ACTIVIDAD
     ============================================ */

  function addLog(level, message) {
    const body = $('#log-body');
    if (!body) return;

    const icons = { ok: '✓', warn: '⚠', error: '✗', info: '•' };

    const entry = document.createElement('div');
    entry.className = 'log__entry log__entry--' + level;

    const ts = document.createElement('span');
    ts.className = 'log__timestamp';
    ts.textContent = timeHHMM();

    const icon = document.createElement('span');
    icon.className = 'log__icon';
    icon.textContent = ' ' + (icons[level] || icons.info) + ' ';

    const msg = document.createElement('span');
    msg.className = 'log__mensaje';
    msg.textContent = message;

    entry.appendChild(ts);
    entry.appendChild(icon);
    entry.appendChild(msg);
    body.appendChild(entry);

    body.scrollTop = body.scrollHeight;
  }

  /* ============================================
     GESTION DE ETAPAS
     ============================================ */

  function setStageState(stageNum, newState) {
    const section = $('#etapa-' + stageNum);
    if (!section) return;

    section.dataset.state = newState;

    const header = section.querySelector('.etapa__header');
    const body = section.querySelector('.etapa__body');
    const badgeSlot = section.querySelector('.etapa__badge');

    // Reconstruir badge
    badgeSlot.textContent = '';
    const badge = document.createElement('span');
    switch (newState) {
      case 'locked':
        badge.className = 'badge badge--locked';
        badge.textContent = 'Pendiente';
        break;
      case 'active':
        badge.className = 'badge badge--info';
        badge.textContent = 'Activa';
        break;
      case 'ok':
        badge.className = 'badge badge--ok';
        badge.textContent = 'OK';
        break;
      case 'warn':
        badge.className = 'badge badge--warn';
        badge.textContent = 'Advertencias';
        break;
      case 'error':
        badge.className = 'badge badge--error';
        badge.textContent = 'Error';
        break;
    }
    badgeSlot.appendChild(badge);

    // Visibilidad del body
    var expanded = (newState === 'active' || newState === 'error');
    if (expanded) {
      body.removeAttribute('hidden');
    } else {
      body.setAttribute('hidden', '');
    }
    header.setAttribute('aria-expanded', String(expanded));

    if (newState === 'active') {
      state.currentStage = stageNum;
    }
  }

  function setStageWarnCount(stageNum, count) {
    const section = $('#etapa-' + stageNum);
    if (!section) return;
    const badge = section.querySelector('.etapa__badge .badge');
    if (badge && section.dataset.state === 'warn') {
      badge.textContent = count + ' alerta' + (count !== 1 ? 's' : '');
    }
  }

  function toggleStage(stageNum) {
    const section = $('#etapa-' + stageNum);
    if (!section) return;
    if (section.dataset.state === 'locked') return;

    const header = section.querySelector('.etapa__header');
    const body = section.querySelector('.etapa__body');
    var isHidden = body.hasAttribute('hidden');

    if (isHidden) {
      body.removeAttribute('hidden');
      header.setAttribute('aria-expanded', 'true');
    } else {
      body.setAttribute('hidden', '');
      header.setAttribute('aria-expanded', 'false');
    }
  }

  function completeStage(stageNum, resultState) {
    setStageState(stageNum, resultState);
    addLog(
      resultState === 'ok' ? 'ok' : 'warn',
      'Etapa ' + stageNum + ' completada'
    );

    var next = stageNum + 1;
    if (next <= 5) {
      setStageState(next, 'active');
      addLog('info', 'Etapa ' + next + ' desbloqueada');
    }
  }

  /* ============================================
     SELECTOR DE CARPETAS (File System Access API)
     ============================================ */

  function initDirectoryPickers() {
    var btnInput = $('#btn-carpeta-entrada');
    var btnOutput = $('#btn-carpeta-salida');
    var alertEl = $('#alerta-fsapi');

    if (!supportsDirectoryPicker()) {
      if (alertEl) alertEl.removeAttribute('hidden');
      if (btnInput) btnInput.disabled = true;
      if (btnOutput) btnOutput.disabled = true;
      addLog('error', 'El navegador no soporta el selector de carpetas (usa Chrome, Edge o Brave)');
      return;
    }

    if (btnInput) {
      btnInput.addEventListener('click', pickInputDirectory);
    }
    if (btnOutput) {
      btnOutput.addEventListener('click', pickOutputDirectory);
    }
  }

  async function pickInputDirectory() {
    var dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({
        id: 'conciliacion-entrada',
        mode: 'read',
        startIn: 'documents'
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      addLog('error', 'Error al seleccionar carpeta: ' + (err.message || err));
      return;
    }

    state.inputDirHandle = dirHandle;
    var rutaEl = $('#ruta-entrada');
    if (rutaEl) rutaEl.textContent = dirHandle.name;
    var dotEntrada = $('#estado-entrada');
    if (dotEntrada) dotEntrada.className = 'dot dot--ok';
    addLog('info', 'Carpeta de entrada: ' + dirHandle.name);

    await readInputDirectory(dirHandle);
  }

  async function readInputDirectory(dirHandle) {
    state.files.clear();
    var fileCount = 0;
    var skippedCount = 0;

    try {
      for await (var entry of dirHandle.values()) {
        if (entry.kind !== 'file') continue;

        var ext = classifyExtension(entry.name);
        if (ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
          skippedCount++;
          continue;
        }

        try {
          var file = await entry.getFile();
          var buffer = await file.arrayBuffer();
          state.files.set(file.name, {
            file: file,
            buffer: buffer,
            type: ext,
            size: file.size,
            category: 'por clasificar'
          });
          fileCount++;
          addLog('info', file.name + ' cargado (' + formatSize(file.size) + ')');
        } catch (readErr) {
          addLog('error', 'Error al leer ' + entry.name + ': ' + (readErr.message || readErr));
        }
      }
    } catch (iterErr) {
      addLog('error', 'Error al recorrer la carpeta: ' + (iterErr.message || iterErr));
      return;
    }

    var conteoEl = $('#conteo-entrada');
    if (conteoEl) {
      conteoEl.textContent = fileCount + ' archivo(s)';
      if (skippedCount > 0) {
        conteoEl.textContent += ' (' + skippedCount + ' omitido(s))';
      }
    }

    if (fileCount === 0) {
      addLog('warn', 'No se encontraron archivos .txt, .csv o .xlsx en la carpeta');
      return;
    }

    renderFileList(state.files);

    var btnStage1 = $('#etapa-1 .boton--primario');
    if (btnStage1) btnStage1.disabled = false;

    document.dispatchEvent(new CustomEvent('app:files-loaded', {
      detail: { count: state.files.size }
    }));
  }

  async function pickOutputDirectory() {
    var dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({
        id: 'conciliacion-salida',
        mode: 'readwrite',
        startIn: 'documents'
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      addLog('error', 'Error al seleccionar carpeta de salida: ' + (err.message || err));
      return;
    }

    state.outputDirHandle = dirHandle;
    var rutaEl = $('#ruta-salida');
    if (rutaEl) rutaEl.textContent = dirHandle.name;
    var dotSalida = $('#estado-salida');
    if (dotSalida) dotSalida.className = 'dot dot--ok';
    addLog('ok', 'Carpeta de salida: ' + dirHandle.name);
  }

  /* ============================================
     RENDERIZADO: ETAPA 1 — ARCHIVOS
     ============================================ */

  function renderFileList(files) {
    const tbody = $('#archivos-detectados-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    var fileMap = (files instanceof Map) ? files : state.files;
    if (fileMap.size === 0) return;

    fileMap.forEach(function (info, name) {
      var tr = document.createElement('tr');

      // Dot de estado
      var tdDot = document.createElement('td');
      var dot = document.createElement('span');
      dot.className = 'dot dot--' + (info.category === 'por clasificar' ? 'warn' : 'ok');
      tdDot.appendChild(dot);

      // Nombre
      var tdName = document.createElement('td');
      tdName.textContent = name;

      // Tag de tipo
      var tdType = document.createElement('td');
      var tag = document.createElement('span');
      tag.className = 'tag-archivo tag-archivo--' + info.type;
      tag.textContent = info.type.toUpperCase();
      tdType.appendChild(tag);

      // Categoria
      var tdCat = document.createElement('td');
      tdCat.textContent = info.category;

      // Tamano
      var tdSize = document.createElement('td');
      tdSize.textContent = formatSize(info.size);

      tr.appendChild(tdDot);
      tr.appendChild(tdName);
      tr.appendChild(tdType);
      tr.appendChild(tdCat);
      tr.appendChild(tdSize);
      tbody.appendChild(tr);
    });

    addLog('ok', fileMap.size + ' archivo(s) detectado(s)');
  }

  /* ============================================
     RENDERIZADO: ETAPA 1 — ANALISIS EDA
     ============================================ */

  function renderEDA(edaResults) {
    state.edaResults = edaResults;
    var container = $('#eda-resultados');
    if (!container) return;
    container.innerHTML = '';

    var fileNames = Object.keys(edaResults);
    if (fileNames.length === 0) return;

    var totalWarnings = 0;

    for (var f = 0; f < fileNames.length; f++) {
      var name = fileNames[f];
      var result = edaResults[name];
      var datos = result.datos || {};
      var estado = result.estado || 'ok';
      var mensajes = result.mensajes || [];

      var card = document.createElement('div');
      card.className = 'tarjeta-eda tarjeta-eda--' + estado;

      // Header
      var header = document.createElement('div');
      header.className = 'tarjeta-eda__header';

      var dot = document.createElement('span');
      dot.className = 'dot dot--' + estado;

      var nombre = document.createElement('span');
      nombre.className = 'tarjeta-eda__nombre';
      nombre.textContent = datos.nombre || name;

      var meta = document.createElement('span');
      meta.className = 'tarjeta-eda__meta';
      var metaParts = [];
      if (datos.filas != null) metaParts.push(datos.filas + ' filas');
      if (datos.columnas != null) metaParts.push(datos.columnas + ' cols');
      if (datos.encoding && datos.encoding !== 'N/A') metaParts.push(datos.encoding);
      if (datos.llave_sugerida) metaParts.push('llave: ' + datos.llave_sugerida);
      meta.textContent = metaParts.join(' · ');

      var warnCount = mensajes.filter(function (m) {
        return m.nivel === 'warn' || m.nivel === 'error';
      }).length;
      totalWarnings += warnCount;

      var badge = document.createElement('span');
      if (estado === 'ok') {
        badge.className = 'badge badge--ok';
        badge.textContent = 'OK';
      } else if (estado === 'warn') {
        badge.className = 'badge badge--warn';
        badge.textContent = warnCount + ' alerta' + (warnCount !== 1 ? 's' : '');
      } else {
        badge.className = 'badge badge--error';
        badge.textContent = 'Error';
      }

      header.appendChild(dot);
      header.appendChild(nombre);
      header.appendChild(meta);
      header.appendChild(badge);
      card.appendChild(header);

      // Body: tabla de columnas
      var perfilColumnas = datos.perfil_columnas || [];
      if (perfilColumnas.length > 0) {
        var body = document.createElement('div');
        body.className = 'tarjeta-eda__body';
        body.setAttribute('hidden', '');

        var table = document.createElement('table');
        table.className = 'tabla tabla--eda';
        table.setAttribute('aria-label', 'Perfil de columnas de ' + name);

        var thead = document.createElement('thead');
        var trHead = document.createElement('tr');
        var headers = ['Columna', 'Tipo', 'Invalidos', 'Validos', 'Vacios', 'Unicos', 'Muestra'];
        for (var h = 0; h < headers.length; h++) {
          var th = document.createElement('th');
          th.setAttribute('scope', 'col');
          th.textContent = headers[h];
          trHead.appendChild(th);
        }
        thead.appendChild(trHead);
        table.appendChild(thead);

        var tbody = document.createElement('tbody');
        for (var c = 0; c < perfilColumnas.length; c++) {
          var col = perfilColumnas[c];
          var tr = document.createElement('tr');

          // Nombre de columna
          var tdNombre = document.createElement('td');
          tdNombre.textContent = col.nombre;
          if (col.nombre === datos.llave_sugerida) {
            var keyBadge = document.createElement('span');
            keyBadge.className = 'badge badge--info';
            keyBadge.textContent = 'llave';
            keyBadge.style.marginLeft = '0.5rem';
            tdNombre.appendChild(keyBadge);
          }

          // Tipo
          var tdTipo = document.createElement('td');
          var tipoTag = document.createElement('span');
          tipoTag.className = 'tag-tipo tag-tipo--' + col.tipo_detectado;
          tipoTag.textContent = col.tipo_detectado;
          tdTipo.appendChild(tipoTag);

          // Invalidos
          var tdInvalidos = document.createElement('td');
          var nInv = col.invalidos || 0;
          tdInvalidos.textContent = nInv + '/' + col.total;
          if (nInv > 0) {
            var invDot = document.createElement('span');
            invDot.className = 'dot dot--warn';
            invDot.style.marginLeft = '0.25rem';
            tdInvalidos.appendChild(invDot);
            var invMuestra = col.muestra_invalidos || [];
            if (invMuestra.length > 0) {
              tdInvalidos.title = 'Muestra: ' + invMuestra.join(', ');
            }
          }

          // Validos
          var tdValidos = document.createElement('td');
          tdValidos.textContent = (col.validos != null ? col.validos : 0) + '/' + col.total;

          // Vacios
          var tdVacios = document.createElement('td');
          tdVacios.textContent = col.vacios + '/' + col.total;

          // Unicos
          var tdUnicos = document.createElement('td');
          tdUnicos.textContent = col.unicos + '/' + col.total;

          // Muestra
          var tdMuestra = document.createElement('td');
          tdMuestra.className = 'eda-muestra';
          var vals = col.valores_muestra || [];
          tdMuestra.textContent = vals.length > 0 ? vals.join(', ') : '(vacio)';
          tdMuestra.title = vals.join(', ');

          tr.appendChild(tdNombre);
          tr.appendChild(tdTipo);
          tr.appendChild(tdInvalidos);
          tr.appendChild(tdValidos);
          tr.appendChild(tdVacios);
          tr.appendChild(tdUnicos);
          tr.appendChild(tdMuestra);
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        body.appendChild(table);

        // Alertas
        var alertMsgs = mensajes.filter(function (m) { return m.nivel !== 'ok'; });
        if (alertMsgs.length > 0) {
          var alertList = document.createElement('div');
          alertList.className = 'tarjeta-eda__alertas';
          for (var m = 0; m < alertMsgs.length; m++) {
            var alertDiv = document.createElement('div');
            alertDiv.className = 'tarjeta-eda__alerta';
            var aDot = document.createElement('span');
            aDot.className = 'dot dot--' + alertMsgs[m].nivel;
            var aText = document.createElement('span');
            aText.textContent = alertMsgs[m].texto;
            alertDiv.appendChild(aDot);
            alertDiv.appendChild(aText);
            alertList.appendChild(alertDiv);
          }
          body.appendChild(alertList);
        }

        card.appendChild(body);

        // Toggle body
        (function (hdr, bdy) {
          hdr.addEventListener('click', function () {
            if (bdy.hasAttribute('hidden')) {
              bdy.removeAttribute('hidden');
            } else {
              bdy.setAttribute('hidden', '');
            }
          });
        })(header, body);
      }

      container.appendChild(card);
    }

    if (totalWarnings > 0) {
      setStageState(2, 'warn');
      setStageWarnCount(2, totalWarnings);
    }

    // Habilitar boton Siguiente etapa 2: solo errores bloquean
    var btnStage2 = $('#etapa-2 .boton--primario');
    if (btnStage2) {
      var hasErrors = false;
      for (var fn = 0; fn < fileNames.length; fn++) {
        if (edaResults[fileNames[fn]] && edaResults[fileNames[fn]].estado === 'error') {
          hasErrors = true;
          break;
        }
      }
      btnStage2.disabled = hasErrors;
    }

    addLog('ok', fileNames.length + ' archivo(s) analizado(s)');
  }

  function buildMiniBar(pct) {
    var wrapper = document.createElement('div');
    wrapper.className = 'mini-bar';

    var fill = document.createElement('div');
    fill.className = 'mini-bar__fill';
    if (pct > 50) {
      fill.className += ' mini-bar__fill--error';
    } else if (pct > 20) {
      fill.className += ' mini-bar__fill--warn';
    }
    fill.style.width = Math.min(pct, 100) + '%';

    var label = document.createElement('span');
    label.className = 'mini-bar__label';
    label.textContent = pct + '%';

    wrapper.appendChild(fill);
    wrapper.appendChild(label);
    return wrapper;
  }

  /* ============================================
     RENDERIZADO: ETAPA 2 — VALIDACION
     ============================================ */

  function renderValidation(results) {
    var fuentes = results.fuentes || [];
    var catalogos = results.catalogos || [];
    var all = fuentes.concat(catalogos);

    var fuentesEl = $('#fuentes-datos');
    var catalogosEl = $('#fuentes-catalogos');
    var alertaEl = $('#etapa-2 .alerta');

    if (fuentesEl) {
      fuentesEl.innerHTML = '';
      buildSourceCards(fuentes, fuentesEl);
    }

    if (catalogosEl) {
      catalogosEl.innerHTML = '';
      buildSourceCards(catalogos, catalogosEl);
    }

    var errorCount = all.filter(function (s) { return s.status === 'error'; }).length;
    var warnCount = all.filter(function (s) { return s.status === 'warn'; }).length;

    // Alerta superior
    if (alertaEl) {
      if (errorCount > 0) {
        alertaEl.removeAttribute('hidden');
        var msg = alertaEl.querySelector('.alerta__mensaje');
        if (msg) {
          msg.textContent = errorCount + ' fuente(s) con errores — resolver antes de continuar';
        }
      } else {
        alertaEl.setAttribute('hidden', '');
      }
    }

    // Boton de avance
    var btn = $('#etapa-2 .boton--primario');
    if (btn) btn.disabled = (errorCount > 0);

    addLog('info', 'Validacion: ' + all.length + ' fuente(s) analizada(s)');
    if (errorCount > 0) addLog('error', errorCount + ' fuente(s) con errores');
    if (warnCount > 0) addLog('warn', warnCount + ' fuente(s) con advertencias');
  }

  function buildSourceCards(sources, container) {
    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];

      var card = document.createElement('div');
      card.className = 'tarjeta-fuente tarjeta-fuente--' + src.status;

      // --- Header ---
      var header = document.createElement('div');
      header.className = 'tarjeta-fuente__header';

      var dot = document.createElement('span');
      dot.className = 'dot dot--' + src.status;

      var nombre = document.createElement('span');
      nombre.className = 'tarjeta-fuente__nombre';
      nombre.textContent = src.name;

      var meta = document.createElement('span');
      meta.className = 'tarjeta-fuente__meta';
      var parts = [];
      if (src.records != null) parts.push(src.records + ' reg');
      if (src.key) parts.push('llave: ' + src.key);
      meta.textContent = parts.join(' · ');

      var badge = document.createElement('span');
      var alerts = src.alerts || [];
      if (src.status === 'ok') {
        badge.className = 'badge badge--ok';
        badge.textContent = 'OK';
      } else if (src.status === 'warn') {
        badge.className = 'badge badge--warn';
        badge.textContent = alerts.length + ' alerta' + (alerts.length !== 1 ? 's' : '');
      } else {
        badge.className = 'badge badge--error';
        badge.textContent = 'Error';
      }

      header.appendChild(dot);
      header.appendChild(nombre);
      header.appendChild(meta);
      header.appendChild(badge);
      card.appendChild(header);

      // --- Body (solo si hay alertas) ---
      if (alerts.length > 0) {
        var body = document.createElement('div');
        body.className = 'tarjeta-fuente__body';

        for (var j = 0; j < alerts.length; j++) {
          var detail = document.createElement('div');
          detail.className = 'tarjeta-fuente__detalle';

          var adot = document.createElement('span');
          adot.className = 'dot dot--' + alerts[j].level;

          var amsg = document.createElement('span');
          amsg.textContent = alerts[j].message;

          detail.appendChild(adot);
          detail.appendChild(amsg);
          body.appendChild(detail);
        }

        // Acciones de la tarjeta
        var acciones = document.createElement('div');
        acciones.className = 'tarjeta-fuente__acciones';

        if (src.status === 'warn') {
          acciones.appendChild(makeGhostBtn('Ver registros', src.name, 'view'));
        }
        acciones.appendChild(makeGhostBtn('Reemplazar', src.name, 'replace'));
        if (src.status === 'error') {
          acciones.appendChild(makeGhostBtn('Mapear columnas', src.name, 'map'));
        }

        body.appendChild(acciones);
        card.appendChild(body);

        // Toggle body al hacer click en header
        (function (h, b) {
          h.addEventListener('click', function () {
            if (b.hasAttribute('hidden')) {
              b.removeAttribute('hidden');
            } else {
              b.setAttribute('hidden', '');
            }
          });
        })(header, body);
      }

      container.appendChild(card);
    }
  }

  function makeGhostBtn(text, sourceName, action) {
    var btn = document.createElement('button');
    btn.className = 'boton boton--ghost';
    btn.textContent = text;
    btn.dataset.source = sourceName;
    btn.dataset.action = action;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      document.dispatchEvent(new CustomEvent('app:source-action', {
        detail: { source: sourceName, action: action }
      }));
    });
    return btn;
  }

  /* ============================================
     RENDERIZADO: ETAPA 3 — CRUCE
     ============================================ */

  function renderCrossCheck(results) {
    var m = $('#metrica-match');
    var sm = $('#metrica-sin-match');
    var d = $('#metrica-duplicados');
    var c = $('#metrica-cobertura');

    if (m) m.textContent = results.match != null ? results.match : 0;
    if (sm) sm.textContent = results.sinMatch != null ? results.sinMatch : 0;
    if (d) d.textContent = results.duplicados != null ? results.duplicados : 0;
    if (c) c.textContent = (results.cobertura != null ? results.cobertura : 0) + '%';

    // Tabla de sin match
    var tbody = $('#sin-match-body');
    if (tbody) {
      tbody.innerHTML = '';
      var items = results.detalles || [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var tr = document.createElement('tr');

        var tdLlave = document.createElement('td');
        tdLlave.textContent = item.llave;

        var tdPresente = document.createElement('td');
        tdPresente.textContent = item.presenteEn;

        var tdMonto = document.createElement('td');
        tdMonto.textContent = item.monto;

        var tdAccion = document.createElement('td');
        tdAccion.className = 'excepcion-acciones';
        renderActionButtons(tdAccion, item.llave, 'cruce');

        tr.appendChild(tdLlave);
        tr.appendChild(tdPresente);
        tr.appendChild(tdMonto);
        tr.appendChild(tdAccion);
        tbody.appendChild(tr);
      }
    }

    // Boton de avance: solo bloquear por errores reales, no por sin-match
    var btn = $('#etapa-3 .boton--primario');
    if (btn) {
      var coberturaError = results.cobertura != null && results.cobertura < 50;
      btn.disabled = coberturaError;
    }

    addLog('info', 'Cruce: ' + (results.match || 0) + ' coincidencias, ' + (results.sinMatch || 0) + ' sin match');
  }

  /* ============================================
     RENDERIZADO: ETAPA 4 — CONCILIACION
     ============================================ */

  function renderConciliation(results) {
    var okEl = $('#resumen-ok');
    var excEl = $('#resumen-excedente');
    var falEl = $('#resumen-faltante');
    var errEl = $('#resumen-error');

    if (okEl) okEl.textContent = results.ok != null ? results.ok : 0;
    if (excEl) excEl.textContent = results.excedente != null ? results.excedente : 0;
    if (falEl) falEl.textContent = results.faltante != null ? results.faltante : 0;
    if (errEl) errEl.textContent = results.error != null ? results.error : 0;

    // Cola de excepciones
    var tbody = $('#excepciones-body');
    if (tbody) {
      tbody.innerHTML = '';
      var excs = results.excepciones || [];
      for (var i = 0; i < excs.length; i++) {
        var exc = excs[i];
        var tr = document.createElement('tr');

        var fields = ['llave', 'concepto', 'esperado', 'real', 'diferencia'];
        for (var f = 0; f < fields.length; f++) {
          var td = document.createElement('td');
          td.textContent = exc[fields[f]] != null ? exc[fields[f]] : '';
          tr.appendChild(td);
        }

        var tdAccion = document.createElement('td');
        tdAccion.className = 'excepcion-acciones';
        renderActionButtons(tdAccion, exc.llave, 'conciliacion');
        tr.appendChild(tdAccion);

        tbody.appendChild(tr);
      }
    }

    // Novedades
    var novedadesEl = $('#novedades-lista');
    if (novedadesEl) {
      novedadesEl.innerHTML = '';
      var novs = results.novedades || [];
      if (novs.length === 0) {
        var p = document.createElement('p');
        p.style.color = 'var(--text-muted)';
        p.style.fontSize = '0.875rem';
        p.textContent = 'Sin novedades detectadas';
        novedadesEl.appendChild(p);
      } else {
        for (var n = 0; n < novs.length; n++) {
          var item = document.createElement('div');
          item.className = 'alerta alerta--info';
          var msg = document.createElement('span');
          msg.className = 'alerta__mensaje';
          msg.textContent = typeof novs[n] === 'string' ? novs[n] : novs[n].mensaje;
          item.appendChild(msg);
          novedadesEl.appendChild(item);
        }
      }
    }

    // Boton de avance
    var btn = $('#etapa-4 .boton--primario');
    if (btn) {
      btn.disabled = (results.excepciones || []).length > 0;
    }

    addLog('info', 'Conciliacion: ' + (results.ok || 0) + ' OK, ' +
      (results.excedente || 0) + ' excedente(s), ' +
      (results.faltante || 0) + ' faltante(s)');
  }

  /* ============================================
     RENDERIZADO: ETAPA 5 — REPORTES
     ============================================ */

  function renderReports(reports) {
    var lista = $('#reportes-lista');
    if (!lista) return;
    lista.innerHTML = '';

    state.reportBlobs = reports || [];

    for (var i = 0; i < state.reportBlobs.length; i++) {
      var report = state.reportBlobs[i];
      var li = document.createElement('li');
      li.className = 'reporte-item';

      var nombre = document.createElement('span');
      nombre.className = 'reporte-item__nombre';
      nombre.textContent = report.name;

      (function (blob, fname) {
        var btn = document.createElement('button');
        btn.className = 'boton boton--ghost';
        btn.textContent = state.outputDirHandle ? 'Guardar' : 'Descargar';
        btn.setAttribute('aria-label', 'Guardar ' + fname);
        btn.addEventListener('click', function () { writeFileToOutput(blob, fname); });
        li.appendChild(nombre);
        li.appendChild(btn);
      })(report.blob, report.name);

      lista.appendChild(li);
    }

    var btnAll = $('#etapa-5 .boton--primario');
    if (btnAll) {
      btnAll.disabled = (state.reportBlobs.length === 0);
      btnAll.textContent = state.outputDirHandle
        ? 'Guardar todo en ' + state.outputDirHandle.name
        : 'Descargar todo (.zip)';
    }

    addLog('ok', state.reportBlobs.length + ' reporte(s) generado(s)');
  }

  /* ============================================
     ACCIONES DE EXCEPCIONES
     ============================================ */

  function renderActionButtons(container, key, context) {
    var actions = [
      { label: 'Aprobar', value: 'aprobar' },
      { label: 'Corregir', value: 'corregir' },
      { label: 'Excluir', value: 'excluir' }
    ];

    for (var i = 0; i < actions.length; i++) {
      (function (act) {
        var btn = document.createElement('button');
        btn.className = 'boton boton--accion';
        btn.textContent = act.label;
        btn.addEventListener('click', function () {
          showActionForm(container, key, act.value, context);
        });
        container.appendChild(btn);
      })(actions[i]);
    }
  }

  function showActionForm(container, key, action, context) {
    container.innerHTML = '';

    var form = document.createElement('div');
    form.className = 'accion-form';

    // Input de valor nuevo (solo para corregir)
    var valueInput = null;
    if (action === 'corregir') {
      valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.className = 'accion-form__input';
      valueInput.placeholder = 'Nuevo valor';
      form.appendChild(valueInput);
    }

    // Input de comentario (obligatorio siempre)
    var commentInput = document.createElement('input');
    commentInput.type = 'text';
    commentInput.className = 'accion-form__input';
    commentInput.placeholder = 'Comentario obligatorio';
    form.appendChild(commentInput);

    // Fila de botones
    var btnRow = document.createElement('div');
    btnRow.className = 'accion-form__buttons';

    var btnConfirm = document.createElement('button');
    btnConfirm.className = 'boton boton--accion';
    btnConfirm.textContent = 'Confirmar';
    btnConfirm.addEventListener('click', function () {
      var comment = commentInput.value.trim();
      if (!comment) {
        commentInput.classList.add('accion-form__input--error');
        commentInput.focus();
        return;
      }

      state.auditTrail.push({
        timestamp: new Date().toISOString(),
        key: key,
        action: action,
        context: context,
        comment: comment,
        newValue: valueInput ? valueInput.value.trim() : null
      });

      // Reemplazar celda con badge de resultado
      container.innerHTML = '';
      var badge = document.createElement('span');
      badge.className = 'badge badge--' + (action === 'excluir' ? 'locked' : 'ok');
      badge.textContent = action.charAt(0).toUpperCase() + action.slice(1);
      container.appendChild(badge);

      addLog('ok', key + ': ' + action + ' — ' + comment);
      checkAllExceptionsResolved(context);
    });

    var btnCancel = document.createElement('button');
    btnCancel.className = 'boton boton--accion';
    btnCancel.textContent = 'Cancelar';
    btnCancel.addEventListener('click', function () {
      container.innerHTML = '';
      renderActionButtons(container, key, context);
    });

    btnRow.appendChild(btnConfirm);
    btnRow.appendChild(btnCancel);
    form.appendChild(btnRow);
    container.appendChild(form);

    (valueInput || commentInput).focus();
  }

  function checkAllExceptionsResolved(context) {
    var stageNum = (context === 'cruce') ? 3 : 4;
    var section = $('#etapa-' + stageNum);
    if (!section) return;

    var cells = section.querySelectorAll('.excepcion-acciones');
    var allResolved = true;
    for (var i = 0; i < cells.length; i++) {
      if (!cells[i].querySelector('.badge')) {
        allResolved = false;
        break;
      }
    }

    var btn = section.querySelector('.boton--primario');
    if (btn) btn.disabled = !allResolved;
  }

  /* ============================================
     DESCARGAS
     ============================================ */

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 100);
  }

  async function downloadAll() {
    var reports = state.reportBlobs;
    if (!reports || reports.length === 0) return;

    try {
      // Cargar JSZip dinamicamente si no esta disponible
      if (typeof JSZip === 'undefined') {
        await new Promise(function (resolve, reject) {
          var script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js';
          script.onload = resolve;
          script.onerror = function () { reject(new Error('No se pudo cargar JSZip')); };
          document.head.appendChild(script);
        });
      }

      var zip = new JSZip();
      for (var i = 0; i < reports.length; i++) {
        zip.file(reports[i].name, reports[i].blob);
      }

      var content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, 'reportes_conciliacion.zip');
      addLog('ok', 'Reportes descargados como ZIP');
    } catch (err) {
      addLog('error', 'Error al generar ZIP — descargando individualmente');
      dbg('JSZip error:', err);
      for (var i = 0; i < reports.length; i++) {
        downloadBlob(reports[i].blob, reports[i].name);
      }
    }
  }

  async function writeFileToOutput(blob, filename) {
    if (!state.outputDirHandle) {
      downloadBlob(blob, filename);
      return;
    }

    try {
      var permission = await state.outputDirHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        permission = await state.outputDirHandle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          addLog('warn', 'Permiso denegado, descargando ' + filename);
          downloadBlob(blob, filename);
          return;
        }
      }

      var fileHandle = await state.outputDirHandle.getFileHandle(filename, { create: true });
      var writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      addLog('ok', filename + ' guardado en ' + state.outputDirHandle.name);
    } catch (err) {
      addLog('error', 'Error al guardar ' + filename + ': ' + (err.message || err));
      downloadBlob(blob, filename);
    }
  }

  async function writeAllToOutput() {
    var reports = state.reportBlobs;
    if (!reports || reports.length === 0) return;

    if (state.outputDirHandle) {
      var successCount = 0;
      for (var i = 0; i < reports.length; i++) {
        try {
          await writeFileToOutput(reports[i].blob, reports[i].name);
          successCount++;
        } catch (err) {
          addLog('error', 'Error escribiendo ' + reports[i].name);
        }
      }
      if (successCount === reports.length) {
        addLog('ok', reports.length + ' reporte(s) guardados en ' + state.outputDirHandle.name);
      }
    } else {
      await downloadAll();
    }
  }

  /* ============================================
     EVENTOS: NAVEGACION DE ETAPAS
     ============================================ */

  function initStageNavigation() {
    var contenido = $('.contenido');
    if (!contenido) return;

    // Click en header de etapa (event delegation)
    contenido.addEventListener('click', function (e) {
      var header = e.target.closest('.etapa__header');
      if (!header) return;
      var section = header.closest('.etapa');
      if (!section) return;
      toggleStage(parseInt(section.dataset.stage, 10));
    });

    // Soporte de teclado para headers
    contenido.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var header = e.target.closest('.etapa__header');
      if (!header) return;
      e.preventDefault();
      var section = header.closest('.etapa');
      if (!section) return;
      toggleStage(parseInt(section.dataset.stage, 10));
    });
  }

  function initAdvanceButtons() {
    var contenido = $('.contenido');
    if (!contenido) return;

    contenido.addEventListener('click', function (e) {
      var btn = e.target.closest('.etapa__acciones .boton--primario');
      if (!btn || btn.disabled) return;

      var section = btn.closest('.etapa');
      if (!section) return;
      var stageNum = parseInt(section.dataset.stage, 10);

      // Etapa 5: descargar todo
      if (stageNum === 5) {
        writeAllToOutput();
        return;
      }

      // Etapa 1: avanzar y disparar EDA en etapa 2
      if (stageNum === 1) {
        completeStage(1, 'ok');
        runEDA();
        return;
      }

      // Emitir evento para que el bridge procese antes de avanzar
      var event = new CustomEvent('app:stage-advance', {
        detail: { stage: stageNum },
        cancelable: true
      });
      var dispatched = document.dispatchEvent(event);

      // Si el bridge no cancelo el evento, avanzar directamente
      if (dispatched) {
        completeStage(stageNum, 'ok');
      }
    });
  }

  function initRefreshButton() {
    var contenido = $('.contenido');
    if (!contenido) return;

    contenido.addEventListener('click', function (e) {
      var btn = e.target.closest('.boton--ghost');
      if (!btn) return;
      var section = btn.closest('#etapa-1');
      if (!section) return;
      if (btn.textContent.trim() === 'Actualizar') {
        if (state.inputDirHandle) {
          readInputDirectory(state.inputDirHandle);
        } else {
          renderFileList(state.files);
        }
      }
    });
  }

  /* ============================================
     EDA: ANALISIS DE CALIDAD POR ARCHIVO
     ============================================ */

  async function runEDA() {
    if (typeof PyBridge === 'undefined') return;

    if (!PyBridge.isReady()) {
      addLog('info', 'Inicializando motor de procesamiento...');
      try {
        await PyBridge.init(function (msg) { addLog('info', msg); });
      } catch (err) {
        addLog('error', 'No se pudo inicializar el motor de procesamiento');
        return;
      }
    }

    var filesMap = state.files;
    if (filesMap.size === 0) return;

    addLog('info', 'Analizando ' + filesMap.size + ' archivo(s)...');

    try {
      var decimalSep = (1.1).toLocaleString().charAt(1);
      var milesSep = decimalSep === ',' ? '.' : ',';

      var configCard = document.getElementById('config-detectada');
      if (configCard) {
        document.getElementById('config-decimal').textContent = decimalSep === ',' ? 'Coma ( , )' : 'Punto ( . )';
        document.getElementById('config-miles').textContent = milesSep === '.' ? 'Punto ( . )' : 'Coma ( , )';
        document.getElementById('config-locale').textContent = navigator.language || 'No detectado';
        configCard.hidden = false;
      }

      var results = await PyBridge.analyzeAllFiles(filesMap, decimalSep);
      renderEDA(results);

      filesMap.forEach(function (info, name) {
        if (results[name] && results[name].estado !== 'error') {
          info.category = 'analizado';
        }
      });
      renderFileList(filesMap);
    } catch (err) {
      addLog('error', 'Error en analisis EDA: ' + (err.message || err));
    }
  }

  /* ============================================
     INICIALIZACION
     ============================================ */

  function init() {
    addLog('info', 'Sistema iniciado');

    // Configurar estados iniciales
    setStageState(1, 'active');
    for (var i = 2; i <= 5; i++) {
      setStageState(i, 'locked');
    }

    initStageNavigation();
    initDirectoryPickers();
    initAdvanceButtons();
    initRefreshButton();

    addLog('info', 'Esperando archivos...');
  }

  /* ============================================
     API PUBLICA
     ============================================ */

  return {
    init: init,
    addLog: addLog,
    setStageState: setStageState,
    setStageWarnCount: setStageWarnCount,
    completeStage: completeStage,
    renderFileList: renderFileList,
    renderEDA: renderEDA,
    renderValidation: renderValidation,
    renderCrossCheck: renderCrossCheck,
    renderConciliation: renderConciliation,
    renderReports: renderReports,
    getFiles: function () { return state.files; },
    getEdaResults: function () { return state.edaResults; },
    getAuditTrail: function () { return state.auditTrail; },
    downloadAll: writeAllToOutput,
    getOutputDirHandle: function () { return state.outputDirHandle; }
  };
})();

document.addEventListener('DOMContentLoaded', function () { App.init(); });
