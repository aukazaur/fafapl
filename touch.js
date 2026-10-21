// Sterowanie dotykowe dla gier LÖVE w przeglądarce.
// Joystick i przyciski udają naciśnięcia klawiszy, więc gra nie musi nic wiedzieć o dotyku.
// Pokazuje się tylko na telefonach i tabletach (główne sterowanie palcem).
(function () {
  if (!matchMedia('(pointer: coarse)').matches) return;

  var KEYS = {
    a: { key: 'a', code: 'KeyA', keyCode: 65 },
    d: { key: 'd', code: 'KeyD', keyCode: 68 },
    w: { key: 'w', code: 'KeyW', keyCode: 87 },
    s: { key: 's', code: 'KeyS', keyCode: 83 },
    e: { key: 'e', code: 'KeyE', keyCode: 69 },
    f: { key: 'f', code: 'KeyF', keyCode: 70 },
    j: { key: 'j', code: 'KeyJ', keyCode: 74 },
    m: { key: 'm', code: 'KeyM', keyCode: 77 },
    r: { key: 'r', code: 'KeyR', keyCode: 82 },
    space: { key: ' ', code: 'Space', keyCode: 32 },
    enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
    escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    tab: { key: 'Tab', code: 'Tab', keyCode: 9 }
  };

  // Układ dla każdej gry (nazwa katalogu w games/).
  //   stick: 'x' — tylko lewo/prawo, 'xy' — też góra/dół (W/S)
  //   big:   duże przyciski akcji po prawej, od dołu
  //   small: małe przyciski u góry, od prawej
  var LAYOUTS = {
    crystal_collector: {
      stick: 'x',
      big: [['SKOK', 'space']],
      small: [['↻', 'r'], ['START', 'enter']]
    },
    dungeon_escape: {
      stick: 'x',
      big: [['SKOK', 'space']],
      small: [['↻', 'r'], ['MAPA', 'm'], ['START', 'enter']]
    },
    zapomniane_krolestwo: {
      stick: 'xy',
      big: [['SKOK', 'space'], ['MIECZ', 'j']],
      small: [['❚❚', 'escape'], ['START', 'enter']]
    },
    // na ekranie tytułowym joystick w lewo/prawo zmienia liczbę botów
    steal_a_squishy: {
      stick: 'xy',
      big: [['KUP', 'e'], ['PLASK', 'space'], ['SPRZEDAJ', 'f']],
      small: [['MENU', 'escape'], ['START', 'enter'], ['📖', 'tab']]
    }
  };
  var game = location.pathname.split('/').filter(Boolean).pop();
  var layout = LAYOUTS[game];
  if (!layout) return;

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
    '  font: 800 13px system-ui, sans-serif; color: #fff; background: rgba(255,255,255,.14);' +
    '  border: 3px solid rgba(255,255,255,.4); text-shadow: 0 1px 3px #000; }' +
    '.tc-btn.on { background: rgba(255,211,77,.6); }' +
    '.tc-big { width: 96px; height: 96px; font-size: 18px; }' +
    '.tc-small { width: 58px; height: 58px; top: 14px; }' +
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

  // joystick
  var stick = el('tc-stick', '<div class="tc-knob"></div>');
  var knob = stick.firstChild;
  var stickId = null;
  function moveStick(e) {
    var r = stick.getBoundingClientRect();
    var max = r.width / 2;
    var dx = e.clientX - (r.left + max), dy = e.clientY - (r.top + max);
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    if (layout.stick === 'x') dy = 0;
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    var dead = max * 0.35;
    send('a', dx < -dead);
    send('d', dx > dead);
    if (layout.stick === 'xy') {
      // góra/dół trzeba wychylić wyraźniej, żeby bieg w bok nie włączał ich przypadkiem
      send('w', dy < -max * 0.55);
      send('s', dy > max * 0.55);
    }
  }
  function releaseStick() {
    stickId = null;
    knob.style.transform = '';
    ['a', 'd', 'w', 's'].forEach(function (k) { send(k, false); });
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

  function button(cls, label, name, pos) {
    var b = el('tc-btn ' + cls, label);
    if (label.length > 5) b.style.fontSize = '14px';  // długie napisy muszą się zmieścić w kółku
    for (var p in pos) b.style[p] = pos[p] + 'px';
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
  }
  // duże przyciski: pierwszy w rogu, kolejne ukośnie w lewo i w górę (wygodnie pod kciukiem)
  layout.big.forEach(function (b, i) {
    button('tc-big', b[0], b[1], { right: 28 + i * 100, bottom: 30 + i * 60 });
  });
  layout.small.forEach(function (b, i) {
    button('tc-small', b[0], b[1], { right: 20 + i * 70 });
  });

  el('tc-rotate', 'Obróć telefon poziomo 📱↻');

  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('touchstart', unlockAudio, { passive: true });
})();
