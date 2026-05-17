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
    outputDirHandle: null,
    crossConfig: null,
    conciliationResult: null,
    excDataFull: [],
    excOutside: [],
    excInside: [],
    excOther: [],
    excSort: { col: null, asc: true }
  };

  var EXC_ACTIONS = [
    { value: 'cxc_anterior', label: 'CxC Anterior', shortLabel: 'CxC Ant' },
    { value: 'cxc_actual',   label: 'CxC Actual',   shortLabel: 'CxC Act' },
    { value: 'valor_mayor',  label: 'Valor mayor',   shortLabel: 'Mayor' },
    { value: 'valor_menor',  label: 'Valor menor',   shortLabel: 'Menor' }
  ];

  function calcActionValue(exc, action) {
    var esp = parseFloat(exc.esperado);
    var real = parseFloat(exc.real);
    if (action === 'cxc_anterior') return exc.esperado;
    if (action === 'cxc_actual') return exc.real;
    if (action === 'valor_mayor') return (isNaN(esp) || isNaN(real)) ? '' : Math.max(esp, real);
    if (action === 'valor_menor') return (isNaN(esp) || isNaN(real)) ? '' : Math.min(esp, real);
    return null;
  }

  function getActionDescription(action) {
    var descs = {
      cxc_anterior: 'Se usara el valor de CxC Anterior',
      cxc_actual: 'Se usara el valor de CxC Actual',
      valor_mayor: 'Se usara el valor mayor entre CxC Anterior y CxC Actual',
      valor_menor: 'Se usara el valor menor entre CxC Anterior y CxC Actual'
    };
    return descs[action] || '';
  }

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

  var CONCEPTOS_FIJOS = ['APORTES', 'AHORROS', 'SEGUROS', 'INCENTIVO', 'CREDITO'];
  var CAMPOS_OPCIONALES = [
    { key: 'nombre_asociado', label: 'Nombre asociado' },
    { key: 'cod_empresa', label: 'Cod. empresa/convenio' },
    { key: 'nombre_empresa', label: 'Nombre empresa' }
  ];

  function supportsDirectoryPicker() {
    return typeof window.showDirectoryPicker === 'function';
  }

  /* ============================================
     LOG DE ACTIVIDAD
     ============================================ */

  function showConfirmPopup(msg) {
    var overlay = document.createElement('div');
    overlay.className = 'accion-overlay';
    var panel = document.createElement('div');
    panel.className = 'accion-panel';
    var texto = document.createElement('p');
    texto.className = 'accion-panel__detalle';
    texto.style.textAlign = 'center';
    texto.textContent = msg;
    var btn = document.createElement('button');
    btn.className = 'boton boton--primario';
    btn.textContent = 'Aceptar';
    btn.addEventListener('click', function () {
      document.body.removeChild(overlay);
    });
    panel.appendChild(texto);
    panel.appendChild(btn);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

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
    if (next <= 4) {
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

    var btnStage1 = $('#etapa-1 .etapa__acciones .boton--primario');
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
          var detalle = col.detalle_invalidos || [];
          var detailRow = null;

          if (nInv > 0 && detalle.length > 0) {
            tdInvalidos.className = 'eda-invalidos-toggle';
            var chevron = document.createElement('span');
            chevron.className = 'eda-chevron';
            chevron.textContent = '▶';
            tdInvalidos.appendChild(chevron);
            tdInvalidos.appendChild(document.createTextNode(' ' + nInv + '/' + col.total + ' '));
            var invDot = document.createElement('span');
            invDot.className = 'dot dot--warn';
            tdInvalidos.appendChild(invDot);

            detailRow = document.createElement('tr');
            detailRow.className = 'eda-detalle-row';
            detailRow.setAttribute('hidden', '');
            var detailTd = document.createElement('td');
            detailTd.setAttribute('colspan', '7');
            detailTd.className = 'eda-detalle-cell';
            var scrollWrap = document.createElement('div');
            scrollWrap.className = 'eda-detalle-scroll';
            var subTable = document.createElement('table');
            subTable.className = 'tabla tabla--eda-detalle';
            var subThead = document.createElement('thead');
            var subTrHead = document.createElement('tr');
            ['Fila', 'Valor'].forEach(function (t) {
              var th = document.createElement('th');
              th.textContent = t;
              subTrHead.appendChild(th);
            });
            subThead.appendChild(subTrHead);
            subTable.appendChild(subThead);
            var subTbody = document.createElement('tbody');
            subTable.appendChild(subTbody);
            scrollWrap.appendChild(subTable);
            detailTd.appendChild(scrollWrap);

            var PAGE_SIZE = 20;
            var pagBar = document.createElement('div');
            pagBar.className = 'eda-detalle-paginacion';
            detailTd.appendChild(pagBar);

            (function (tbody, allItems, bar) {
              var page = 0;
              var totalPages = Math.ceil(allItems.length / PAGE_SIZE);

              function renderPage() {
                tbody.innerHTML = '';
                var start = page * PAGE_SIZE;
                var end = Math.min(start + PAGE_SIZE, allItems.length);
                for (var d = start; d < end; d++) {
                  var subTr = document.createElement('tr');
                  var tdF = document.createElement('td');
                  tdF.textContent = allItems[d].fila;
                  var tdV = document.createElement('td');
                  tdV.textContent = allItems[d].valor;
                  subTr.appendChild(tdF);
                  subTr.appendChild(tdV);
                  tbody.appendChild(subTr);
                }
                bar.innerHTML = '';
                if (totalPages > 1) {
                  var btnPrev = document.createElement('button');
                  btnPrev.className = 'boton boton--accion';
                  btnPrev.textContent = '← Anterior';
                  btnPrev.disabled = (page === 0);
                  btnPrev.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (page > 0) { page--; renderPage(); }
                  });
                  var label = document.createElement('span');
                  label.className = 'eda-detalle-paginacion__label';
                  label.textContent = (start + 1) + '-' + end + ' de ' + allItems.length;
                  var btnNext = document.createElement('button');
                  btnNext.className = 'boton boton--accion';
                  btnNext.textContent = 'Siguiente →';
                  btnNext.disabled = (page >= totalPages - 1);
                  btnNext.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (page < totalPages - 1) { page++; renderPage(); }
                  });
                  bar.appendChild(btnPrev);
                  bar.appendChild(label);
                  bar.appendChild(btnNext);
                }
              }
              renderPage();
            })(subTbody, detalle, pagBar);

            detailRow.appendChild(detailTd);

            (function (toggle, detail, chev) {
              toggle.addEventListener('click', function (e) {
                e.stopPropagation();
                if (detail.hasAttribute('hidden')) {
                  detail.removeAttribute('hidden');
                  chev.textContent = '▼';
                } else {
                  detail.setAttribute('hidden', '');
                  chev.textContent = '▶';
                }
              });
            })(tdInvalidos, detailRow, chevron);
          } else {
            tdInvalidos.textContent = nInv + '/' + col.total;
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
          if (detailRow) {
            tbody.appendChild(detailRow);
          }
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

    var hasErrors = false;
    for (var fn = 0; fn < fileNames.length; fn++) {
      if (edaResults[fileNames[fn]] && edaResults[fileNames[fn]].estado === 'error') {
        hasErrors = true;
        break;
      }
    }

    if (hasErrors) {
      var btnStage2 = $('#etapa-2 .boton--primario');
      if (btnStage2) btnStage2.disabled = true;
      addLog('error', 'Hay archivos con errores — corregir antes de continuar');
    } else {
      renderCrossConfig(edaResults);
    }

    var reanalizar = document.getElementById('eda-reanalizar');
    if (reanalizar) reanalizar.removeAttribute('hidden');

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
     CONFIG DE CRUCE (Etapa 2)
     ============================================ */

  function renderCrossConfig(edaResults) {
    var container = $('#config-cruce');
    var archivosEl = $('#config-cruce-archivos');
    if (!container || !archivosEl) return;

    archivosEl.innerHTML = '';
    var fileNames = Object.keys(edaResults);

    for (var i = 0; i < fileNames.length; i++) {
      var name = fileNames[i];
      var result = edaResults[name];
      var datos = result.datos || {};
      var columnas = datos.nombres_columnas || [];
      var llaveSugerida = datos.llave_sugerida || '';

      var row = document.createElement('div');
      row.className = 'config-cruce__archivo-row';

      var span = document.createElement('span');
      span.className = 'config-cruce__archivo-nombre';
      span.textContent = name;

      var rolSelect = document.createElement('select');
      rolSelect.className = 'config-cruce__select';
      rolSelect.dataset.filename = name;
      rolSelect.dataset.configType = 'rol';
      var roles = [
        { value: '', label: 'No usar en cruce' },
        { value: 'cuenta_cobro', label: 'CxC Anterior' },
        { value: 'descuentos', label: 'CxC Actual' },
        { value: 'maestro', label: 'Maestro' },
        { value: 'retiros', label: 'Retiros' }
      ];
      for (var r = 0; r < roles.length; r++) {
        var opt = document.createElement('option');
        opt.value = roles[r].value;
        opt.textContent = roles[r].label;
        rolSelect.appendChild(opt);
      }

      var llaveSelect = document.createElement('select');
      llaveSelect.className = 'config-cruce__select';
      llaveSelect.dataset.filename = name;
      llaveSelect.dataset.configType = 'llave';
      var optEmpty = document.createElement('option');
      optEmpty.value = '';
      optEmpty.textContent = '— Llave —';
      llaveSelect.appendChild(optEmpty);
      for (var c = 0; c < columnas.length; c++) {
        var optCol = document.createElement('option');
        optCol.value = columnas[c];
        optCol.textContent = columnas[c];
        if (columnas[c] === llaveSugerida) optCol.selected = true;
        llaveSelect.appendChild(optCol);
      }

      var fechaIngresoSelect = document.createElement('select');
      fechaIngresoSelect.className = 'config-cruce__select';
      fechaIngresoSelect.dataset.filename = name;
      fechaIngresoSelect.dataset.configType = 'fecha-ingreso';
      fechaIngresoSelect.style.display = 'none';
      var optFiEmpty = document.createElement('option');
      optFiEmpty.value = '';
      optFiEmpty.textContent = '— Fecha ingreso —';
      fechaIngresoSelect.appendChild(optFiEmpty);
      for (var fi = 0; fi < columnas.length; fi++) {
        var optFi = document.createElement('option');
        optFi.value = columnas[fi];
        optFi.textContent = columnas[fi];
        fechaIngresoSelect.appendChild(optFi);
      }

      var fechaRetiroSelect = document.createElement('select');
      fechaRetiroSelect.className = 'config-cruce__select';
      fechaRetiroSelect.dataset.filename = name;
      fechaRetiroSelect.dataset.configType = 'fecha-retiro';
      fechaRetiroSelect.style.display = 'none';
      var optFrEmpty = document.createElement('option');
      optFrEmpty.value = '';
      optFrEmpty.textContent = '— Fecha retiro —';
      fechaRetiroSelect.appendChild(optFrEmpty);
      for (var fr = 0; fr < columnas.length; fr++) {
        var optFr = document.createElement('option');
        optFr.value = columnas[fr];
        optFr.textContent = columnas[fr];
        fechaRetiroSelect.appendChild(optFr);
      }

      var tipoRetiroSelect = document.createElement('select');
      tipoRetiroSelect.className = 'config-cruce__select';
      tipoRetiroSelect.dataset.filename = name;
      tipoRetiroSelect.dataset.configType = 'tipo-retiro';
      tipoRetiroSelect.style.display = 'none';
      var optTrEmpty = document.createElement('option');
      optTrEmpty.value = '';
      optTrEmpty.textContent = '— Tipo retiro —';
      tipoRetiroSelect.appendChild(optTrEmpty);
      for (var tr = 0; tr < columnas.length; tr++) {
        var optTr = document.createElement('option');
        optTr.value = columnas[tr];
        optTr.textContent = columnas[tr];
        tipoRetiroSelect.appendChild(optTr);
      }

      row.appendChild(span);
      row.appendChild(rolSelect);
      row.appendChild(llaveSelect);
      row.appendChild(fechaIngresoSelect);
      row.appendChild(fechaRetiroSelect);
      row.appendChild(tipoRetiroSelect);
      archivosEl.appendChild(row);

      (function (rolSel, fiSel, frSel, trSel) {
        rolSel.addEventListener('change', function () {
          var isMaestro = rolSel.value === 'maestro';
          var isRetiros = rolSel.value === 'retiros';
          fiSel.style.display = isMaestro ? '' : 'none';
          frSel.style.display = isRetiros ? '' : 'none';
          trSel.style.display = isRetiros ? '' : 'none';
          if (!isMaestro) fiSel.value = '';
          if (!isRetiros) { frSel.value = ''; trSel.value = ''; }
          updateConceptColumns();
          validateCrossConfig();
        });
      })(rolSelect, fechaIngresoSelect, fechaRetiroSelect, tipoRetiroSelect);

      llaveSelect.addEventListener('change', function () {
        validateCrossConfig();
      });
      fechaIngresoSelect.addEventListener('change', function () {
        validateCrossConfig();
      });
      fechaRetiroSelect.addEventListener('change', function () {
        validateCrossConfig();
      });
      tipoRetiroSelect.addEventListener('change', function () {
        validateCrossConfig();
      });
    }

    container.removeAttribute('hidden');
  }

  function getFilesForRole(role) {
    var names = [];
    var rolSelects = document.querySelectorAll('[data-config-type="rol"]');
    for (var i = 0; i < rolSelects.length; i++) {
      if (rolSelects[i].value === role) names.push(rolSelects[i].dataset.filename);
    }
    return names;
  }

  function getColumnsForFiles(fileNames) {
    if (fileNames.length === 0) return [];
    var first = state.edaResults[fileNames[0]];
    if (!first || !first.datos) return [];
    return first.datos.nombres_columnas || [];
  }

  function buildMappingSelect(columns, groupKey, concepto, optional) {
    var sel = document.createElement('select');
    sel.className = 'config-mapeo__select';
    sel.dataset.mapeoGroup = groupKey;
    sel.dataset.mapeoConcepto = concepto;

    var optEmpty = document.createElement('option');
    optEmpty.value = '';
    optEmpty.textContent = optional ? '— No usar —' : '— Seleccionar —';
    sel.appendChild(optEmpty);

    var conceptoLower = concepto.toLowerCase();
    for (var i = 0; i < columns.length; i++) {
      var opt = document.createElement('option');
      opt.value = columns[i];
      opt.textContent = columns[i];
      if (columns[i].toLowerCase() === conceptoLower) opt.selected = true;
      sel.appendChild(opt);
    }

    sel.addEventListener('change', function () { validateCrossConfig(); });
    return sel;
  }

  function buildMappingTable(roles) {
    var allFields = [];
    for (var c = 0; c < CONCEPTOS_FIJOS.length; c++) {
      allFields.push({ key: CONCEPTOS_FIJOS[c], label: CONCEPTOS_FIJOS[c], optional: false });
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'config-mapeo__wrapper';

    var table = document.createElement('table');
    table.className = 'tabla config-mapeo__tabla';

    var thead = document.createElement('thead');
    var trHead = document.createElement('tr');
    var thArchivo = document.createElement('th');
    thArchivo.scope = 'col';
    thArchivo.textContent = 'Archivo';
    trHead.appendChild(thArchivo);

    for (var h = 0; h < allFields.length; h++) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.textContent = allFields[h].label;
      trHead.appendChild(th);
    }
    thead.appendChild(trHead);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    for (var r = 0; r < roles.length; r++) {
      var role = roles[r];
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      tdName.className = 'config-mapeo__archivo';
      tdName.textContent = role.label;
      tr.appendChild(tdName);

      var isMaestro = role.key === 'maestro';
      var isRetiros = role.key === 'retiros';
      for (var f = 0; f < allFields.length; f++) {
        var td = document.createElement('td');
        var isOptional = allFields[f].optional || isMaestro || isRetiros;
        td.appendChild(buildMappingSelect(role.columns, role.key, allFields[f].key, isOptional));
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  }

  function updateConceptColumns() {
    var conceptosSection = $('#config-cruce-conceptos');
    var listaEl = $('#config-conceptos-lista');
    if (!conceptosSection || !listaEl) return;

    var ccNames = getFilesForRole('cuenta_cobro');
    var descNames = getFilesForRole('descuentos');

    if (ccNames.length === 0 || descNames.length === 0) {
      conceptosSection.setAttribute('hidden', '');
      return;
    }

    var ccColumns = getColumnsForFiles(ccNames);
    var descColumns = getColumnsForFiles(descNames);

    if (ccColumns.length === 0 || descColumns.length === 0) {
      conceptosSection.setAttribute('hidden', '');
      return;
    }

    var roles = [];
    var maestroNames = getFilesForRole('maestro');
    if (maestroNames.length > 0) {
      var maestroColumns = getColumnsForFiles(maestroNames);
      roles.push({ key: 'maestro', label: 'Maestro: ' + maestroNames[0], columns: maestroColumns });
    }
    var retirosNames = getFilesForRole('retiros');
    if (retirosNames.length > 0) {
      var retirosColumns = getColumnsForFiles(retirosNames);
      roles.push({ key: 'retiros', label: 'Retiros: ' + retirosNames[0], columns: retirosColumns });
    }
    roles.push({ key: 'cc', label: 'CxC Ant: ' + ccNames.join(', '), columns: ccColumns });
    roles.push({ key: 'desc', label: 'CxC Act: ' + descNames[0], columns: descColumns });

    listaEl.innerHTML = '';
    listaEl.appendChild(buildMappingTable(roles));

    conceptosSection.removeAttribute('hidden');
  }

  function collectMapping(groupKey) {
    var mapping = {};
    var selects = document.querySelectorAll('[data-mapeo-group="' + groupKey + '"]');
    for (var i = 0; i < selects.length; i++) {
      var concepto = selects[i].dataset.mapeoConcepto;
      var colName = selects[i].value;
      if (colName) mapping[concepto] = colName;
    }
    return mapping;
  }

  function validateCrossConfig() {
    var validacionEl = $('#config-cruce-validacion');
    var btnStage2 = $('#etapa-2 .boton--primario');
    state.crossConfig = null;

    var rolSelects = document.querySelectorAll('[data-config-type="rol"]');
    var ccNames = [];
    var descNames = [];
    var maestroCount = 0;
    var maestroName = null;
    var retirosCount = 0;
    var retirosName = null;

    for (var i = 0; i < rolSelects.length; i++) {
      if (rolSelects[i].value === 'cuenta_cobro') ccNames.push(rolSelects[i].dataset.filename);
      if (rolSelects[i].value === 'descuentos') descNames.push(rolSelects[i].dataset.filename);
      if (rolSelects[i].value === 'maestro') { maestroCount++; maestroName = rolSelects[i].dataset.filename; }
      if (rolSelects[i].value === 'retiros') { retirosCount++; retirosName = rolSelects[i].dataset.filename; }
    }

    var errors = [];
    if (ccNames.length === 0) errors.push('Asigna un archivo como CxC Anterior');
    if (ccNames.length > 1) {
      var allTxt = true;
      for (var t = 0; t < ccNames.length; t++) {
        var fileInfo = state.files.get(ccNames[t]);
        if (!fileInfo || fileInfo.type !== 'txt') { allTxt = false; break; }
      }
      if (!allTxt) errors.push('Solo archivos TXT pueden asignarse como multiples CxC Anterior');
    }
    if (descNames.length === 0) errors.push('Asigna un archivo como CxC Actual');
    if (descNames.length > 1) errors.push('Solo un archivo puede ser CxC Actual');
    if (maestroCount > 1) errors.push('Solo un archivo puede ser Maestro');
    if (retirosCount > 1) errors.push('Solo un archivo puede ser Retiros');

    var ccLlave = '';
    var descLlave = '';
    var maestroLlave = '';
    var retirosLlave = '';
    var descName = descNames.length > 0 ? descNames[0] : null;
    var ccFirstName = ccNames.length > 0 ? ccNames[0] : null;

    var llaveSelects = document.querySelectorAll('[data-config-type="llave"]');
    for (var j = 0; j < llaveSelects.length; j++) {
      if (llaveSelects[j].dataset.filename === ccFirstName && !ccLlave) ccLlave = llaveSelects[j].value;
      if (llaveSelects[j].dataset.filename === descName) descLlave = llaveSelects[j].value;
      if (llaveSelects[j].dataset.filename === maestroName) maestroLlave = llaveSelects[j].value;
      if (llaveSelects[j].dataset.filename === retirosName) retirosLlave = llaveSelects[j].value;
    }

    if (ccNames.length > 0 && !ccLlave) errors.push('Selecciona llave para CxC Anterior');
    if (descName && !descLlave) errors.push('Selecciona llave para CxC Actual');
    if (maestroName && !maestroLlave) errors.push('Selecciona llave para Maestro');
    if (retirosName && !retirosLlave) errors.push('Selecciona llave para Retiros');

    var fechaIngreso = '';
    if (maestroName) {
      var fiSelects = document.querySelectorAll('[data-config-type="fecha-ingreso"]');
      for (var fi = 0; fi < fiSelects.length; fi++) {
        if (fiSelects[fi].dataset.filename === maestroName) fechaIngreso = fiSelects[fi].value;
      }
    }

    var fechaRetiro = '';
    var tipoRetiro = '';
    if (retirosName) {
      var frSelects = document.querySelectorAll('[data-config-type="fecha-retiro"]');
      for (var fr = 0; fr < frSelects.length; fr++) {
        if (frSelects[fr].dataset.filename === retirosName) fechaRetiro = frSelects[fr].value;
      }
      if (!fechaRetiro) errors.push('Selecciona columna de fecha retiro para Retiros');
      var trSelects = document.querySelectorAll('[data-config-type="tipo-retiro"]');
      for (var trs = 0; trs < trSelects.length; trs++) {
        if (trSelects[trs].dataset.filename === retirosName) tipoRetiro = trSelects[trs].value;
      }
    }

    var ccMapping = collectMapping('cc');
    var descMapping = collectMapping('desc');
    var maestroMapping = maestroName ? collectMapping('maestro') : {};
    var retirosMapping = retirosName ? collectMapping('retiros') : {};

    var conceptos = [];
    for (var c = 0; c < CONCEPTOS_FIJOS.length; c++) {
      var con = CONCEPTOS_FIJOS[c];
      if (ccMapping[con] && descMapping[con]) conceptos.push(con);
    }

    if (ccNames.length > 0 && descName && conceptos.length === 0) {
      errors.push('Mapea al menos un concepto en ambos archivos (CxC Ant y CxC Act)');
    }

    if (validacionEl) {
      if (errors.length > 0) {
        validacionEl.className = 'config-cruce__validacion config-cruce__validacion--error';
        validacionEl.textContent = errors[0];
      } else {
        validacionEl.className = 'config-cruce__validacion config-cruce__validacion--ok';
        validacionEl.textContent = 'Configuracion lista — ' + conceptos.length + ' concepto(s) mapeados';
      }
    }

    if (errors.length === 0) {
      state.crossConfig = {
        cc: { names: ccNames, llave: ccLlave, mapping: ccMapping },
        desc: { name: descName, llave: descLlave, mapping: descMapping },
        maestro: maestroName ? {
          name: maestroName,
          llave: maestroLlave,
          colFechaIngreso: fechaIngreso || null,
          mapping: maestroMapping
        } : null,
        retiros: retirosName ? {
          name: retirosName,
          llave: retirosLlave,
          colFechaRetiro: fechaRetiro,
          colTipoRetiro: tipoRetiro || null
        } : null,
        conceptos: conceptos
      };
      if (btnStage2) btnStage2.disabled = false;
    } else {
      if (btnStage2) btnStage2.disabled = true;
    }
  }

  /* ============================================
     RENDERIZADO: ETAPA 3 — CONCILIACION
     ============================================ */

  function renderConciliation(results) {
    var periodoEl = $('#periodo-valor');
    if (periodoEl) periodoEl.textContent = results.periodo || '';

    var mEl = $('#metrica-match');
    var smEl = $('#metrica-sin-match');
    var dEl = $('#metrica-duplicados');
    var cEl = $('#metrica-cobertura');
    if (mEl) mEl.textContent = results.match != null ? results.match : 0;
    if (smEl) smEl.textContent = results.sinMatch != null ? results.sinMatch : 0;
    if (dEl) dEl.textContent = results.duplicados != null ? results.duplicados : 0;
    if (cEl) cEl.textContent = (results.cobertura != null ? results.cobertura : 0) + '%';

    var okEl = $('#resumen-ok');
    var excEl = $('#resumen-excedente');
    var falEl = $('#resumen-faltante');
    var errEl = $('#resumen-error');

    if (okEl) okEl.textContent = results.ok != null ? results.ok : 0;
    if (excEl) excEl.textContent = results.excedente != null ? results.excedente : 0;
    if (falEl) falEl.textContent = results.faltante != null ? results.faltante : 0;
    if (errEl) errEl.textContent = results.error != null ? results.error : 0;

    // Metricas condicionales: No Maestro y Sin Actividad
    var nmCard = $('#metrica-no-maestro-card');
    var nmEl = $('#metrica-no-maestro');
    var saCard = $('#metrica-sin-actividad-card');
    var saEl = $('#metrica-sin-actividad');

    if (nmCard) {
      if (results.noMaestro > 0) {
        nmCard.removeAttribute('hidden');
        if (nmEl) nmEl.textContent = results.noMaestro;
      } else {
        nmCard.setAttribute('hidden', '');
      }
    }
    if (saCard) {
      if (results.sinActividad > 0) {
        saCard.removeAttribute('hidden');
        if (saEl) saEl.textContent = results.sinActividad;
      } else {
        saCard.setAttribute('hidden', '');
      }
    }

    // Cola de excepciones
    state.excDataFull = results.excepciones || [];
    state.excSort = { col: null, asc: true };
    initUmbralFilter();
    filterExcepciones();

    // Boton de avance
    var btn = $('#etapa-3 .boton--primario');
    if (btn) {
      btn.disabled = (results.excepciones || []).length > 0;
    }

    var logMsg = 'Conciliacion: ' + (results.ok || 0) + ' OK, ' +
      (results.excedente || 0) + ' excedente(s), ' +
      (results.faltante || 0) + ' faltante(s)';
    if (results.noMaestro > 0) logMsg += ', ' + results.noMaestro + ' no maestro';
    if (results.sinActividad > 0) logMsg += ', ' + results.sinActividad + ' sin actividad';
    addLog('info', logMsg);

    renderReportConfig();
  }

  /* ============================================
     EXCEPCIONES: RENDER + SORTING
     ============================================ */

  function initUmbralFilter() {
    var input = document.getElementById('umbral-diferencia');
    if (!input) return;
    input.value = '0';
    if (!input._umbralBound) {
      input.addEventListener('input', function () {
        filterExcepciones();
      });
      input._umbralBound = true;
    }
  }

  function filterExcepciones() {
    var input = document.getElementById('umbral-diferencia');
    var umbral = input ? parseFloat(input.value) : 0;
    if (isNaN(umbral)) umbral = 0;

    state.excOutside = [];
    state.excInside = [];
    state.excOther = [];

    for (var i = 0; i < state.excDataFull.length; i++) {
      var exc = state.excDataFull[i];
      var tipo = exc.tipo || '';
      if (tipo !== 'EXCEDENTE' && tipo !== 'FALTANTE') {
        state.excOther.push(exc);
      } else if (umbral > 0) {
        var diff = parseFloat(exc.diferencia);
        if (!isNaN(diff) && Math.abs(diff) <= umbral) {
          state.excInside.push(exc);
        } else {
          state.excOutside.push(exc);
        }
      } else {
        state.excOutside.push(exc);
      }
    }

    state.excSort = { col: null, asc: true };
    renderAllExcQueues();
  }

  function sortExcArray(arr, col, asc) {
    arr.sort(function (a, b) {
      var va = a[col] != null ? a[col] : '';
      var vb = b[col] != null ? b[col] : '';
      var na = parseFloat(va);
      var nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) {
        return asc ? na - nb : nb - na;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
  }

  function handleExcSort(col) {
    if (state.excSort.col === col) {
      state.excSort.asc = !state.excSort.asc;
    } else {
      state.excSort.col = col;
      state.excSort.asc = true;
    }
    sortExcArray(state.excOutside, col, state.excSort.asc);
    sortExcArray(state.excInside, col, state.excSort.asc);
    sortExcArray(state.excOther, col, state.excSort.asc);
    renderAllExcQueues();
    updateSortIndicators();
  }

  function updateSortIndicators() {
    var ths = document.querySelectorAll('#etapa-3 th[data-col]');
    for (var i = 0; i < ths.length; i++) {
      ths[i].classList.remove('th-sorted-asc', 'th-sorted-desc');
      if (ths[i].dataset.col === state.excSort.col) {
        ths[i].classList.add(state.excSort.asc ? 'th-sorted-asc' : 'th-sorted-desc');
      }
    }
  }

  var TIPO_LABELS = {
    'OK': 'Ok',
    'EXCEDENTE': 'Excedente',
    'FALTANTE': 'Faltante',
    'SIN_MATCH': 'Sin Match',
    'NO_MAESTRO': 'No Maestro',
    'SIN_ACTIVIDAD': 'Sin Actividad',
    'ERROR': 'Error',
    'DATA_QUALITY': 'Calidad'
  };

  function renderTipoBadge(tipo) {
    var span = document.createElement('span');
    var cls = (tipo || '').toLowerCase().replace(/ /g, '_');
    span.className = 'badge-tipo badge-tipo--' + cls;
    span.textContent = TIPO_LABELS[tipo] || tipo || '';
    return span;
  }

  function renderNovedadBadge(text) {
    var span = document.createElement('span');
    var cls = 'badge-novedad';
    if (text.indexOf('RETIRO') === 0) cls += ' badge-novedad--retiro';
    else if (text.indexOf('NUEVO') === 0) cls += ' badge-novedad--nuevo';
    span.className = cls;
    span.textContent = text;
    return span;
  }

  function renderExcRows(excs, tbodyId, withActions) {
    var tbody = $('#' + tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';

    for (var i = 0; i < excs.length; i++) {
      var exc = excs[i];
      var tr = document.createElement('tr');

      var tdLlave = document.createElement('td');
      tdLlave.textContent = exc.llave != null ? exc.llave : '';
      tr.appendChild(tdLlave);

      var tdTipo = document.createElement('td');
      tdTipo.appendChild(renderTipoBadge(exc.tipo));
      tr.appendChild(tdTipo);

      var textFields = ['concepto', 'esperado', 'real', 'diferencia'];
      for (var f = 0; f < textFields.length; f++) {
        var td = document.createElement('td');
        td.textContent = exc[textFields[f]] != null ? exc[textFields[f]] : '';
        tr.appendChild(td);
      }

      var tdNovedad = document.createElement('td');
      var nov = exc.novedad || '';
      if (nov) {
        var novText = nov;
        if (nov === 'RETIRO' && exc.tipo_retiro) novText += ' (' + exc.tipo_retiro + ')';
        tdNovedad.appendChild(renderNovedadBadge(novText));
      }
      tr.appendChild(tdNovedad);

      if (withActions) {
        var tdAccion = document.createElement('td');
        tdAccion.className = 'excepcion-acciones';
        renderActionButtons(tdAccion, exc, 'conciliacion');
        tr.appendChild(tdAccion);
      }

      tbody.appendChild(tr);
    }
  }

  function renderBulkAction(containerEl, excs) {
    containerEl.innerHTML = '';
    var isEmpty = excs.length === 0;

    var actionsRow = document.createElement('div');
    actionsRow.className = 'excepciones-masiva__actions';

    for (var i = 0; i < EXC_ACTIONS.length; i++) {
      (function (act) {
        var btn = document.createElement('button');
        btn.className = 'boton boton--accion excepciones-masiva__action';
        btn.textContent = act.label;
        if (isEmpty) btn.disabled = true;
        btn.addEventListener('click', function () {
          showBulkActionForm(containerEl, excs, act.value);
        });
        actionsRow.appendChild(btn);
      })(EXC_ACTIONS[i]);
    }

    containerEl.appendChild(actionsRow);
  }

  function _createActionModal(config) {
    var overlay = document.createElement('div');
    overlay.className = 'accion-overlay';

    var panel = document.createElement('div');
    panel.className = 'accion-panel';

    var titulo = document.createElement('h4');
    titulo.className = 'accion-panel__titulo';
    titulo.textContent = config.titleText;
    panel.appendChild(titulo);

    var detalle = document.createElement('p');
    detalle.className = 'accion-panel__detalle';
    detalle.textContent = config.detailContent;
    panel.appendChild(detalle);

    var commentInput = document.createElement('input');
    commentInput.type = 'text';
    commentInput.className = 'accion-form__input';
    commentInput.placeholder = 'Comentario obligatorio';
    panel.appendChild(commentInput);

    var btnRow = document.createElement('div');
    btnRow.className = 'accion-form__buttons';

    var btnConfirm = document.createElement('button');
    btnConfirm.className = 'boton boton--accion accion-form__btn-confirmar';
    btnConfirm.textContent = 'Confirmar';

    var btnCancel = document.createElement('button');
    btnCancel.className = 'boton boton--accion accion-form__btn-cancelar';
    btnCancel.textContent = 'Cancelar';

    function closePanel() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    btnConfirm.addEventListener('click', function () {
      var comment = commentInput.value.trim();
      if (!comment) {
        commentInput.classList.add('accion-form__input--error');
        commentInput.focus();
        return;
      }
      config.onConfirm(comment, closePanel);
    });

    btnCancel.addEventListener('click', closePanel);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePanel();
    });

    btnRow.appendChild(btnConfirm);
    btnRow.appendChild(btnCancel);
    panel.appendChild(btnRow);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    commentInput.focus();
  }

  function showBulkActionForm(containerEl, excs, action) {
    var actInfo = EXC_ACTIONS.filter(function (a) { return a.value === action; })[0];

    _createActionModal({
      titleText: actInfo.label + ' — ' + excs.length + ' excepciones',
      detailContent: getActionDescription(action),
      onConfirm: function (comment, closePanel) {
        var ts = new Date().toISOString();
        for (var j = 0; j < excs.length; j++) {
          state.auditTrail.push({
            timestamp: ts,
            key: excs[j].llave,
            concepto: excs[j].concepto || '',
            action: action,
            context: 'conciliacion',
            comment: comment,
            bulk: true,
            newValue: calcActionValue(excs[j], action)
          });
        }

        containerEl.innerHTML = '';
        var badge = document.createElement('span');
        badge.className = 'badge badge--ok';
        badge.textContent = actInfo.label + ' — ' + excs.length + ' registros';
        containerEl.appendChild(badge);

        var insideBody = $('#exc-inside-body');
        if (insideBody) {
          var rows = insideBody.querySelectorAll('tr');
          for (var r = 0; r < rows.length; r++) {
            rows[r].classList.add('exc-row--resolved');
          }
        }

        closePanel();
        addLog('ok', 'Accion masiva: ' + action + ' — ' + excs.length + ' excepciones — ' + comment);
        checkAllExceptionsResolved('conciliacion');
      }
    });
  }

  function renderAllExcQueues() {
    renderExcRows(state.excOutside, 'exc-outside-body', true);
    renderExcRows(state.excInside, 'exc-inside-body', false);
    renderExcRows(state.excOther, 'exc-other-body', true);

    var bulkEl = $('#exc-inside-bulk');
    if (bulkEl) renderBulkAction(bulkEl, state.excInside);

    var ths = document.querySelectorAll('#etapa-3 th[data-col]');
    for (var i = 0; i < ths.length; i++) {
      if (!ths[i]._sortBound) {
        (function (th) {
          th.addEventListener('click', function () {
            handleExcSort(th.dataset.col);
          });
          th._sortBound = true;
        })(ths[i]);
      }
    }

    updateSortIndicators();
  }

  function initAyudaPopovers() {
    var ayudas = document.querySelectorAll('#etapa-3 .th-ayuda');
    for (var i = 0; i < ayudas.length; i++) {
      (function (el) {
        if (el._ayudaBound) return;
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          var wasOpen = el.classList.contains('th-ayuda--open');
          closeAllAyudas();
          if (!wasOpen) el.classList.add('th-ayuda--open');
        });
        el._ayudaBound = true;
      })(ayudas[i]);
    }

    if (!document._ayudaDocBound) {
      document.addEventListener('click', function () {
        closeAllAyudas();
      });
      document._ayudaDocBound = true;
    }
  }

  function closeAllAyudas() {
    var open = document.querySelectorAll('.th-ayuda--open');
    for (var i = 0; i < open.length; i++) {
      open[i].classList.remove('th-ayuda--open');
    }
  }

  /* ============================================
     RENDERIZADO: ETAPA 4 — REPORTES
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

    var btnAll = $('#etapa-4 .boton--primario');
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

  function renderActionButtons(container, exc, context) {
    for (var i = 0; i < EXC_ACTIONS.length; i++) {
      (function (act) {
        var btn = document.createElement('button');
        btn.className = 'boton boton--accion';
        btn.textContent = act.label;
        btn.addEventListener('click', function () {
          showActionForm(container, exc, act.value, context);
        });
        container.appendChild(btn);
      })(EXC_ACTIONS[i]);
    }
  }

  function showActionForm(container, exc, action, context) {
    var key = exc.llave;
    var actInfo = EXC_ACTIONS.filter(function (a) { return a.value === action; })[0];

    var parts = [];
    if (exc.concepto != null) parts.push('Concepto: ' + exc.concepto);
    if (exc.esperado != null) parts.push('CxC Anterior: ' + exc.esperado);
    if (exc.real != null) parts.push('CxC Actual: ' + exc.real);
    if (exc.diferencia != null) parts.push('Diferencia: ' + exc.diferencia);
    if (exc.novedad) parts.push('Novedad: ' + exc.novedad + (exc.tipo_retiro ? ' (' + exc.tipo_retiro + ')' : ''));
    var valorAplicar = calcActionValue(exc, action);
    if (valorAplicar != null) parts.push('Valor a aplicar: ' + valorAplicar);

    _createActionModal({
      titleText: (actInfo ? actInfo.label : action) + ' — ' + key,
      detailContent: parts.join(' | '),
      onConfirm: function (comment, closePanel) {
        state.auditTrail.push({
          timestamp: new Date().toISOString(),
          key: key,
          concepto: exc.concepto || '',
          action: action,
          context: context,
          comment: comment,
          bulk: false,
          newValue: calcActionValue(exc, action)
        });

        container.innerHTML = '';
        var badge = document.createElement('span');
        badge.className = 'badge badge--ok';
        badge.textContent = actInfo ? actInfo.shortLabel : action;
        container.appendChild(badge);

        closePanel();
        addLog('ok', key + ': ' + action + ' — ' + comment);
        checkAllExceptionsResolved(context);
      }
    });
  }

  function checkAllExceptionsResolved(context) {
    var section = $('#etapa-3');
    if (!section) return;

    var totalExc = state.excDataFull.length;
    var allResolved = totalExc > 0 && state.auditTrail.length >= totalExc;

    var btn = section.querySelector('.boton--primario');
    if (btn) btn.disabled = !allResolved;
  }

  /* ============================================
     MAPEO PARA REPORTES (Etapa 3)
     ============================================ */

  function buildReportCheck(id, label, checked) {
    var div = document.createElement('div');
    div.className = 'config-reportes__check';
    var lbl = document.createElement('label');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'report-' + id;
    input.checked = checked;
    lbl.appendChild(input);
    lbl.appendChild(document.createTextNode(' ' + label));
    div.appendChild(lbl);
    return div;
  }

  function getAllSourceColumns() {
    var result = [];
    var cfg = state.crossConfig;
    var roles = [
      { name: cfg.maestro ? cfg.maestro.name : null, label: 'Maestro' },
      { name: cfg.cc ? cfg.cc.names[0] : null, label: 'CxC Ant' },
      { name: cfg.desc ? cfg.desc.name : null, label: 'CxC Act' },
      { name: cfg.retiros ? cfg.retiros.name : null, label: 'Retiros' }
    ];
    for (var r = 0; r < roles.length; r++) {
      if (!roles[r].name) continue;
      var cols = getColumnsForFiles([roles[r].name]);
      for (var c = 0; c < cols.length; c++) {
        result.push({ file: roles[r].name, col: cols[c], role: roles[r].label });
      }
    }
    return result;
  }

  function buildExtraFieldRow(campo) {
    var div = document.createElement('div');
    div.className = 'config-reportes__extra-row';

    var lbl = document.createElement('label');
    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = 'report-extra-' + campo.key;
    chk.checked = false;
    lbl.appendChild(chk);
    lbl.appendChild(document.createTextNode(' ' + campo.label + ': '));

    var sel = document.createElement('select');
    sel.className = 'config-cruce__select';
    sel.id = 'report-extra-sel-' + campo.key;
    sel.disabled = true;
    var optEmpty = document.createElement('option');
    optEmpty.value = '';
    optEmpty.textContent = '— Columna —';
    sel.appendChild(optEmpty);

    var allCols = getAllSourceColumns();
    for (var c = 0; c < allCols.length; c++) {
      var opt = document.createElement('option');
      opt.value = allCols[c].file + '::' + allCols[c].col;
      opt.textContent = allCols[c].col + ' (' + allCols[c].role + ')';
      sel.appendChild(opt);
    }

    chk.addEventListener('change', function () {
      sel.disabled = !chk.checked;
      if (!chk.checked) sel.value = '';
    });

    div.appendChild(lbl);
    div.appendChild(sel);
    return div;
  }

  function renderReportConfig() {
    var container = $('#config-reportes');
    var tablaEl = $('#config-reportes-tabla');
    if (!container || !tablaEl || !state.crossConfig) return;

    tablaEl.innerHTML = '';

    // Seccion: Hoja de trabajo (informativa)
    var htSection = document.createElement('div');
    htSection.className = 'config-reportes__seccion';
    var htTitle = document.createElement('h4');
    htTitle.className = 'config-reportes__subtitulo';
    htTitle.textContent = 'Hoja de trabajo';
    var htDesc = document.createElement('p');
    htDesc.className = 'config-reportes__desc';
    htDesc.textContent = 'Se genera automaticamente con conciliacion completa, decisiones, novedades y audit trail.';
    htSection.appendChild(htTitle);
    htSection.appendChild(htDesc);
    tablaEl.appendChild(htSection);

    // Seccion: Reporte de descuentos (configurable)
    var descSection = document.createElement('div');
    descSection.className = 'config-reportes__seccion';
    var descTitle = document.createElement('h4');
    descTitle.className = 'config-reportes__subtitulo';
    descTitle.textContent = 'Reporte de descuentos';

    var listaDiv = document.createElement('div');
    listaDiv.className = 'config-reportes__checks';

    for (var e = 0; e < CAMPOS_OPCIONALES.length; e++) {
      listaDiv.appendChild(buildExtraFieldRow(CAMPOS_OPCIONALES[e]));
    }
    var conceptos = state.crossConfig.conceptos || [];
    for (var i = 0; i < conceptos.length; i++) {
      listaDiv.appendChild(buildReportCheck('concepto-' + conceptos[i], conceptos[i], true));
    }
    listaDiv.appendChild(buildReportCheck('incluir-total', 'TOTAL', true));
    listaDiv.appendChild(buildReportCheck('incluir-conciliados', 'Incluir conciliados (OK)', true));

    descSection.appendChild(descTitle);
    descSection.appendChild(listaDiv);
    tablaEl.appendChild(descSection);

    container.removeAttribute('hidden');
  }

  function collectReportMapping() {
    var conceptos = state.crossConfig ? (state.crossConfig.conceptos || []) : [];
    var selectedConceptos = [];
    for (var i = 0; i < conceptos.length; i++) {
      var chk = document.getElementById('report-concepto-' + conceptos[i]);
      if (chk && chk.checked) selectedConceptos.push(conceptos[i]);
    }

    var chkTotal = document.getElementById('report-incluir-total');
    var chkConc = document.getElementById('report-incluir-conciliados');

    var extras = [];
    var extraMapping = {};
    for (var e = 0; e < CAMPOS_OPCIONALES.length; e++) {
      var campo = CAMPOS_OPCIONALES[e];
      var chkExtra = document.getElementById('report-extra-' + campo.key);
      var selExtra = document.getElementById('report-extra-sel-' + campo.key);
      if (chkExtra && chkExtra.checked && selExtra && selExtra.value) {
        var parts = selExtra.value.split('::');
        extras.push(campo.key);
        extraMapping[campo.key] = { file: parts[0], col: parts[1] };
      }
    }

    var files = {};
    if (state.crossConfig) {
      if (state.crossConfig.maestro) files.maestro = state.crossConfig.maestro.name;
      if (state.crossConfig.cc) files.cc = state.crossConfig.cc.names[0];
      if (state.crossConfig.desc) files.desc = state.crossConfig.desc.name;
      if (state.crossConfig.retiros) files.retiros = state.crossConfig.retiros.name;
    }

    return {
      files: files,
      descuentos: {
        conceptos: selectedConceptos,
        incluirTotal: chkTotal ? chkTotal.checked : false,
        incluirConciliados: chkConc ? chkConc.checked : true,
        columnasExtra: extras,
        extraMapping: extraMapping
      }
    };
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
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
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
      showConfirmPopup('Reportes descargados');
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
      showConfirmPopup(filename + ' guardado');
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
        showConfirmPopup(reports.length + ' reporte(s) guardados');
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

      // Etapa 1: avanzar y disparar EDA en etapa 2
      if (stageNum === 1) {
        completeStage(1, 'ok');
        runEDA();
        return;
      }

      // Etapa 2: avanzar y disparar conciliacion en etapa 3
      if (stageNum === 2) {
        if (!state.crossConfig) {
          addLog('error', 'Completa la configuracion de cruce antes de continuar');
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Procesando...';
        completeStage(2, 'ok');
        runConciliation().finally(function () {
          btn.textContent = 'Continuar a Etapa 3';
        });
        return;
      }

      // Etapa 3: generar reportes en etapa 4
      if (stageNum === 3) {
        btn.disabled = true;
        btn.textContent = 'Procesando...';
        completeStage(3, 'ok');
        runReports().finally(function () {
          btn.textContent = 'Generar Reportes';
        });
        return;
      }

      // Etapa 4: descargar todo
      if (stageNum === 4) {
        writeAllToOutput();
        return;
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

  function initReanalyzeButton() {
    var btn = document.getElementById('btn-reanalizar');
    if (!btn) return;

    btn.addEventListener('click', function () {
      setStageState(3, 'locked');
      setStageState(4, 'locked');

      state.crossConfig = null;
      state.conciliationResult = null;
      state.auditTrail = [];

      var configCruce = document.getElementById('config-cruce');
      if (configCruce) configCruce.setAttribute('hidden', '');

      var btnContinuar = document.querySelector('#etapa-2 .boton--primario');
      if (btnContinuar) btnContinuar.disabled = true;

      addLog('info', 'Re-analizando archivos...');

      if (state.inputDirHandle) {
        readInputDirectory(state.inputDirHandle).then(function () {
          runEDA();
        });
      } else {
        runEDA();
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

    var reanalizar = document.getElementById('eda-reanalizar');
    if (reanalizar) reanalizar.setAttribute('hidden', '');

    var filesMap = state.files;
    if (filesMap.size === 0) return;

    addLog('info', 'Analizando ' + filesMap.size + ' archivo(s)...');

    try {
      var selectDecimal = document.getElementById('select-decimal');
      var decimalSep = selectDecimal ? selectDecimal.value : ',';

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
     ETAPA 3: CONCILIACION
     ============================================ */

  async function runConciliation() {
    var config = state.crossConfig;
    if (!config) {
      addLog('error', 'Configuracion de cruce no definida');
      return;
    }

    addLog('info', 'Ejecutando conciliacion...');

    try {
      var result = await PyBridge.conciliate(config);
      state.conciliationResult = result;
      var datos = result.datos || {};
      var transformed = {
        match: datos.match || 0,
        sinMatch: datos.sin_match || 0,
        duplicados: datos.duplicados || 0,
        cobertura: datos.cobertura || 0,
        ok: datos.ok || 0,
        excedente: datos.excedente || 0,
        faltante: datos.faltante || 0,
        error: datos.error || 0,
        noMaestro: datos.no_maestro || 0,
        sinActividad: datos.sin_actividad || 0,
        excepciones: datos.excepciones || [],
        novedades: datos.novedades || [],
        periodo: datos.periodo || ''
      };
      renderConciliation(transformed);
    } catch (err) {
      addLog('error', 'Error en conciliacion: ' + (err.message || err));
    }
  }

  /* ============================================
     ETAPA 4: REPORTES
     ============================================ */

  async function runReports() {
    if (!state.conciliationResult) {
      addLog('error', 'No hay resultado de conciliacion para generar reportes');
      return;
    }

    addLog('info', 'Generando reportes...');

    try {
      var reportCfg = collectReportMapping();
      var reports = await PyBridge.generateReports(
        state.conciliationResult,
        state.auditTrail,
        reportCfg
      );
      renderReports(reports);
    } catch (err) {
      addLog('error', 'Error generando reportes: ' + (err.message || err));
    }
  }

  /* ============================================
     CONFIGURACION DE SEPARADORES
     ============================================ */

  function initSeparadorConfig() {
    var selectDecimal = $('#select-decimal');
    var selectMiles = $('#select-miles');
    var localeEl = $('#config-locale');

    var browserDecimal = (1.1).toLocaleString().charAt(1);
    if (selectDecimal) selectDecimal.value = browserDecimal;
    if (selectMiles) selectMiles.value = browserDecimal === ',' ? '.' : ',';
    if (localeEl) localeEl.textContent = navigator.language || 'No detectado';

    if (selectDecimal) {
      selectDecimal.addEventListener('change', function () {
        if (selectMiles) selectMiles.value = this.value === ',' ? '.' : ',';
      });
    }
    if (selectMiles) {
      selectMiles.addEventListener('change', function () {
        if (selectDecimal) selectDecimal.value = this.value === '.' ? ',' : '.';
      });
    }
  }

  /* ============================================
     INICIALIZACION
     ============================================ */

  function init() {
    addLog('info', 'Sistema iniciado');

    // Configurar estados iniciales
    setStageState(1, 'active');
    for (var i = 2; i <= 4; i++) {
      setStageState(i, 'locked');
    }

    initStageNavigation();
    initDirectoryPickers();
    initAdvanceButtons();
    initRefreshButton();
    initReanalyzeButton();
    initSeparadorConfig();

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
