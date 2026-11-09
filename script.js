(function () {
  'use strict';

  var KEY = 'contador_config_v1';
  var DEFAULT_TITLE = 'Contador Regressivo';
  var $ = function (id) { return document.getElementById(id); };

  var inTitle = $('inTitle'), inDays = $('inDays'),
      inHours = $('inHours'), inMinutes = $('inMinutes');

  /* ---------- Armazenamento local ---------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
  }

  /* ---------- Parâmetros de URL ----------
     ?titulo=Black Friday&fim=2026-11-27T00:00&limpo=1
     - titulo: título do contador
     - fim:    data/hora final (horário local do navegador)
     - limpo:  1 = oculta os campos (modo TV/painel, sem precisar de F11)  */
  var params = new URLSearchParams(location.search);
  var urlTitle = params.get('titulo');
  var urlFim = params.get('fim');
  var urlEnd = null;
  if (urlFim) {
    var t = new Date(urlFim).getTime();
    if (!isNaN(t)) urlEnd = t;
  }
  var cleanMode = params.get('limpo') === '1' || params.get('limpo') === 'true';

  function urlNum(name) {
    var v = params.get(name);
    if (v === null) return null;
    v = parseInt(v, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }

  var cfg = load();
  // A URL tem prioridade sobre os valores salvos no navegador
  if (urlTitle !== null) cfg.title = urlTitle;
  if (urlEnd !== null) cfg.endAt = urlEnd;
  if (urlNum('dias') !== null) cfg.days = urlNum('dias');
  if (urlNum('horas') !== null) cfg.hours = urlNum('horas');
  if (urlNum('minutos') !== null) cfg.minutes = urlNum('minutos');

  if (cfg.title) inTitle.value = cfg.title;
  if (cfg.days != null) inDays.value = cfg.days;
  if (cfg.hours != null) inHours.value = cfg.hours;
  if (cfg.minutes != null) inMinutes.value = cfg.minutes;

  /* ---------- Helpers ---------- */
  function num(el) {
    var v = parseInt(el.value, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function toLocalIso(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
           'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  /* Reflete a configuração atual nos parâmetros da URL (sem recarregar).
     Mantém outros parâmetros existentes, como limpo=1. */
  function syncUrl() {
    try {
      var q = new URLSearchParams(location.search);
      if (cfg.title) q.set('titulo', cfg.title); else q.delete('titulo');
      q.set('dias', cfg.days || 0);
      q.set('horas', cfg.hours || 0);
      q.set('minutos', cfg.minutes || 0);
      if (cfg.endAt) q.set('fim', toLocalIso(cfg.endAt)); else q.delete('fim');
      history.replaceState(null, '', location.pathname + '?' + q.toString());
    } catch (e) {}
  }

  /* ---------- Eventos dos campos ---------- */
  function persistFields() {
    var c = load();
    c.title = inTitle.value.trim();
    c.days = num(inDays);
    c.hours = num(inHours);
    c.minutes = num(inMinutes);
    if (cfg.endAt) c.endAt = cfg.endAt;
    save(c);
    cfg = c;
    syncUrl();
    render();
  }
  [inTitle, inDays, inHours, inMinutes].forEach(function (el) {
    el.addEventListener('input', persistFields);
  });

  $('btnApply').addEventListener('click', function () {
    var c = {
      title: inTitle.value.trim(),
      days: num(inDays), hours: num(inHours), minutes: num(inMinutes)
    };
    var ms = ((c.days * 24 + c.hours) * 60 + c.minutes) * 60000;
    c.endAt = Date.now() + ms;
    save(c);
    cfg = c;
    syncUrl();
    render();
  });

  /* ---------- Ocultar/mostrar campos em tela ---------- */
  var HIDE_KEY = 'contador_campos_ocultos_v1';
  var btnToggle = $('btnToggle');

  function setPanelHidden(hidden) {
    document.body.classList.toggle('hide-panel', hidden);
    btnToggle.textContent = hidden ? 'Mostrar campos' : 'Ocultar campos';
    btnToggle.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    try { localStorage.setItem(HIDE_KEY, hidden ? '1' : '0'); } catch (e) {}
  }
  btnToggle.addEventListener('click', function () {
    setPanelHidden(!document.body.classList.contains('hide-panel'));
  });
  var savedHidden = false;
  try { savedHidden = localStorage.getItem(HIDE_KEY) === '1'; } catch (e) {}
  setPanelHidden(savedHidden);

  /* ---------- Modo F11 ---------- */
  function isFullscreen() {
    return cleanMode ||
      !!document.fullscreenElement ||
      (window.innerWidth >= screen.width - 2 && window.innerHeight >= screen.height - 2);
  }
  function updateMode() {
    var fs = isFullscreen();
    document.body.classList.toggle('fs', fs);
    var t = (cfg.title || '').trim();
    document.title = (fs || cleanMode) ? (t || DEFAULT_TITLE) : DEFAULT_TITLE;
  }

  /* ---------- Renderização ---------- */
  function render() {
    var t = (cfg.title || '').trim();
    $('title').textContent = t || DEFAULT_TITLE;

    var remaining = cfg.endAt ? cfg.endAt - Date.now() : 0;
    if (remaining < 0) remaining = 0;
    var total = Math.floor(remaining / 1000);

    $('d').textContent = pad(Math.floor(total / 86400));
    $('h').textContent = pad(Math.floor((total % 86400) / 3600));
    $('m').textContent = pad(Math.floor((total % 3600) / 60));
    $('s').textContent = pad(total % 60);
    $('ended').style.display = (cfg.endAt && remaining === 0) ? 'block' : 'none';
    updateMode();
  }

  window.addEventListener('resize', updateMode);
  document.addEventListener('fullscreenchange', updateMode);

  render();
  setInterval(render, 1000);

  /* ---------- Auto refresh a cada minuto ----------
     Não recarrega enquanto alguém está digitando nos campos. */
  setInterval(function () {
    var a = document.activeElement;
    if (a && a.tagName === 'INPUT') return;
    location.reload();
  }, 60000);
})();
