(function () {
  'use strict';
  var video = document.getElementById('video');
  var notice = document.getElementById('notice');
  var start = document.getElementById('start');
  var pause = document.getElementById('pause');
  var videos = [], index = 0, idleTimer, retryTimer, failures = 0, wakeLock;
  function message(text) { notice.textContent = text; notice.hidden = !text; }
  function showControls() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    if (!video.paused) idleTimer = setTimeout(function () {
      if (!document.querySelector('#controls :focus')) document.body.classList.add('idle');
    }, 4000);
  }
  function play() {
    var result = video.play();
    if (result && result.catch) result.catch(function (error) {
      if (error.name === 'NotAllowedError') { start.hidden = false; message(''); showControls(); }
    });
  }
  function load(next) {
    if (!videos.length) return;
    clearTimeout(retryTimer);
    index = (next + videos.length) % videos.length;
    message(''); start.hidden = true;
    document.getElementById('title').textContent = videos[index].name;
    document.getElementById('count').textContent = (index + 1) + ' / ' + videos.length + ' · EM LOOP';
    video.src = videos[index].url;
    video.load(); play(); showControls();
  }
  async function refresh() {
    try {
      var response = await fetch('/api/videos', { cache: 'no-store' });
      if (!response.ok) throw new Error('Falha na lista');
      var list = await response.json();
      var current = videos[index] && videos[index].url;
      videos = list;
      if (!videos.length) { video.pause(); video.removeAttribute('src'); video.load(); message('Adicione vídeos na pasta public/motions.'); return; }
      var position = videos.findIndex(function (item) { return item.url === current; });
      if (position >= 0) index = position;
      else { failures = 0; load(0); }
    } catch (error) { if (!videos.length) message('Aguardando conexão com o servidor…'); }
  }
  video.addEventListener('ended', function () { failures = 0; load(index + 1); });
  video.addEventListener('playing', function () { start.hidden = true; message(''); pause.textContent = 'Pausar'; pause.setAttribute('aria-label', 'Pausar'); showControls(); });
  video.addEventListener('pause', function () { pause.textContent = 'Reproduzir'; pause.setAttribute('aria-label', 'Reproduzir'); showControls(); });
  video.addEventListener('error', function () {
    failures++;
    message('Não foi possível reproduzir este vídeo. Tentando novamente…');
    retryTimer = setTimeout(function () { load(index + 1); }, failures >= videos.length ? 15000 : 1500);
  });
  video.addEventListener('timeupdate', function () {
    document.getElementById('progress-value').style.width = (video.duration ? video.currentTime / video.duration * 100 : 0) + '%';
  });
  function togglePause() { if (video.paused) play(); else video.pause(); }
  function toggleSound() { video.muted = !video.muted; document.getElementById('sound').textContent = video.muted ? 'Ativar som' : 'Silenciar'; }
  function fullscreen() {
    var active = document.fullscreenElement || document.webkitFullscreenElement;
    var method = active ? (document.exitFullscreen || document.webkitExitFullscreen) : (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    if (!method) { message('Use a opção de tela cheia do navegador da TV.'); return; }
    var result = method.call(active ? document : document.documentElement);
    if (result && result.catch) result.catch(function () { message('Use a opção de tela cheia do navegador da TV.'); });
  }
  async function keepAwake() {
    try { if (navigator.wakeLock && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch (error) {}
  }
  document.getElementById('start-button').onclick = function () { play(); fullscreen(); keepAwake(); };
  document.getElementById('previous').onclick = function () { failures = 0; load(index - 1); };
  document.getElementById('next').onclick = function () { failures = 0; load(index + 1); };
  pause.onclick = togglePause;
  document.getElementById('sound').onclick = toggleSound;
  document.getElementById('fullscreen').onclick = function () { fullscreen(); keepAwake(); };
  document.getElementById('fit').onclick = function () {
    video.classList.toggle('cover');
    this.textContent = video.classList.contains('cover') ? 'Mostrar vídeo inteiro' : 'Preencher tela';
  };
  document.addEventListener('mousemove', showControls);
  document.addEventListener('touchstart', showControls, { passive: true });
  document.addEventListener('focusin', showControls);
  document.addEventListener('focusout', showControls);
  document.addEventListener('keydown', function (event) {
    showControls();
    if (event.target.tagName === 'BUTTON' && (event.key === 'Enter' || event.key === ' ')) return;
    if (event.key === ' ') { event.preventDefault(); togglePause(); }
    else if (event.key === 'ArrowRight') load(index + 1);
    else if (event.key === 'ArrowLeft') load(index - 1);
    else if (event.key.toLowerCase() === 'f') fullscreen();
    else if (event.key.toLowerCase() === 'm') toggleSound();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { keepAwake(); if (video.ended) load(index + 1); } });
  refresh(); keepAwake(); setInterval(refresh, 30000);
}());
