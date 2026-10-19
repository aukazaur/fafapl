// Sterowanie dotykowe dla gier LÖVE w przeglądarce.
// Joystick i przyciski udają naciśnięcia klawiszy, więc gra nie musi nic wiedzieć o dotyku.
// Pokazuje się tylko na telefonach i tabletach (główne sterowanie palcem).
(function () {
  if (!matchMedia('(pointer: coarse)').matches) return;

  var KEYS = {
    left:  { key: 'a', code: 'KeyA', keyCode: 65 },
    right: { key: 'd', code: 'KeyD', keyCode: 68 },
    jump:  { key: ' ', code: 'Space', keyCode: 32 },
    enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
    r:     { key: 'r', code: 'KeyR', keyCode: 82 }
  };
  var down = {};

  function send(name, pressed) {
    if (!!down[name] === pressed) return;
    down[name] = pressed;
    var k = KEYS[name];
    var e = new KeyboardEvent(pressed ? 'keydown' : 'keyup', { key: k.key, code: k.code, bubbles: true, cancelable: true });
    // przeglądarki nie pozwalają ustawić keyCode w konstruktorze, a silnik czyta właśnie je
    Object.defineProperty(e, 'keyCode', { get: function () { return k.keyCode; } });
    Object.defineProperty(e, 'which', { get: function () { return k.keyCode; } });
    document.getElementById('canvas').dispatchEvent(e);
  }

  // na telefonach dźwięk wolno włączyć dopiero po dotknięciu ekranu
  function unlockAudio() {
    var ctx = window.Module && Module.SDL2 && Module.SDL2.audioContext;
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  var css = document.createElement('style');
  css.textContent =
    'html, body { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }' +
    '.tc { position: fixed; z-index: 10; touch-action: none; }' +
    '.tc-stick { left: 24px; bottom: 24px; width: 150px; height: 150px; border-radius: 50%;' +
    '  background: rgba(255,255,255,.12); border: 3px solid rgba(255,255,255,.35); }' +
    '.tc-knob { position: absolute; left: 50%; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px;' +
    '  border-radius: 50%; background: rgba(255,211,77,.75); box-shadow: 0 2px 8px #0008; }' +
    '.tc-btn { display: flex; align-items: center; justify-content: center; border-radius: 50%;' +
    '  font: 800 16px system-ui, sans-serif; color: #fff; background: rgba(255,255,255,.14);' +
    '  border: 3px solid rgba(255,255,255,.4); text-shadow: 0 1px 3px #000; }' +
    '.tc-btn.on { background: rgba(255,211,77,.6); }' +
    '.tc-jump { right: 28px; bottom: 36px; width: 104px; height: 104px; font-size: 20px; }' +
    '.tc-small { width: 58px; height: 58px; font-size: 13px; top: 14px; }' +
    '.tc-enter { right: 90px; } .tc-r { right: 20px; }' +
    '.tc-rotate { position: fixed; inset: 0; z-index: 20; display: none; align-items: center; justify-content: center;' +
    '  text-align: center; padding: 24px; background: #12101f; color: #ffd34d; font: 700 20px system-ui, sans-serif; }' +
    '@media (orientation: portrait) { .tc-rotate { display: flex; } }';
  document.head.appendChild(css);

  function el(cls, html) {
    var d = document.createElement('div');
    d.className = 'tc ' + cls;
    if (html) d.innerHTML = html;
    document.body.appendChild(d);
    return d;
  }

  // joystick: wychylenie w lewo/prawo, wychylenie w górę też skacze
  var stick = el('tc-stick', '<div class="tc-knob"></div>');
  var knob = stick.firstChild;
  var stickId = null;
  function moveStick(e) {
    var r = stick.getBoundingClientRect();
    var max = r.width / 2;
    var dx = e.clientX - (r.left + max), dy = e.clientY - (r.top + max);
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    var dead = max * 0.3;
    send('left', dx < -dead);
    send('right', dx > dead);
  }
  function releaseStick() {
    stickId = null;
    knob.style.transform = '';
    send('left', false);
    send('right', false);
  }
  stick.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    unlockAudio();
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  stick.addEventListener('pointermove', function (e) { if (e.pointerId === stickId) moveStick(e); });
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);

  function button(cls, label, name) {
    var b = el('tc-btn ' + cls, label);
    function up() { b.classList.remove('on'); send(name, false); }
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      unlockAudio();
      b.setPointerCapture(e.pointerId);
      b.classList.add('on');
      send(name, true);
    });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    return b;
  }
  button('tc-jump', 'SKOK', 'jump');
  button('tc-small tc-enter', 'START', 'enter');
  button('tc-small tc-r', '↻', 'r');

  el('tc-rotate', 'Obróć telefon poziomo 📱↻');

  // bez tego długie przytrzymanie otwiera menu, a dwa stuknięcia powiększają stronę
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('touchstart', unlockAudio, { passive: true });
})();
