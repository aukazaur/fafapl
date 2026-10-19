// Gra przez sieć w przeglądarce: pomost między grą LÖVE (Lua) a WebRTC przez PeerJS.
// Host rejestruje się w PeerJS pod nazwą zrobioną z kodu gry, a znajomi łączą się z nią bezpośrednio.
// Druga połowa pomostu jest w web/<gra>.lua.
(function () {
  var PREFIX = '@@fafanet ';
  var INBOX = '/tmp/fafanet_inbox';
  var JOIN_TIMEOUT = 9000;

  var game = location.pathname.split('/').filter(Boolean).pop();
  var peer = null;      // nasz Peer z PeerJS
  var conns = {};       // id -> DataConnection (host: wszyscy gracze, klient: tylko host)
  var queue = [];       // zdarzenia czekające na odebranie przez grę
  var nextId = 1;

  function push(line) { queue.push(line); }
  function clean(s) { return String(s).replace(/[\r\n]+/g, ' '); }
  function roomId(code) { return 'fafapl-' + game.replace(/_/g, '-') + '-' + code.toLowerCase(); }

  function notice(text) {
    var el = document.getElementById('fafanet-notice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fafanet-notice';
      el.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:30;max-width:90%;' +
        'padding:10px 18px;border-radius:10px;background:#3a1020;color:#ffd0d8;border:2px solid #ff5f7a;' +
        'font:700 16px system-ui,sans-serif;text-align:center;box-shadow:0 4px 16px #0008';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.display = 'block';
    clearTimeout(notice.t);
    notice.t = setTimeout(function () { el.style.display = 'none'; }, 7000);
  }

  function stop() {
    Object.keys(conns).forEach(function (id) { try { conns[id].close(); } catch (e) {} });
    conns = {};
    queue = [];
    if (peer) { try { peer.destroy(); } catch (e) {} }
    peer = null;
  }

  function watch(conn, id) {
    conns[id] = conn;
    conn.on('data', function (d) { if (conns[id] === conn) push('recv ' + id + ' ' + clean(d)); });
    conn.on('close', function () {
      if (conns[id] !== conn) return;
      delete conns[id];
      push('disconnect ' + id);
    });
    conn.on('error', function () { try { conn.close(); } catch (e) {} });
  }

  function host(code) {
    stop();
    var me = peer = new Peer(roomId(code));
    me.on('connection', function (conn) {
      var id = 'p' + (nextId++);
      conn.on('open', function () {
        if (peer !== me) return conn.close();
        watch(conn, id);
        push('connect ' + id);
      });
    });
    me.on('error', function (err) {
      if (peer !== me) return;
      if (err.type === 'unavailable-id') notice('Kod gry ' + code + ' jest już zajęty — wróć do menu (ESC) i wybierz inny kod.');
      else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')
        notice('Brak połączenia z serwerem gry przez sieć — sprawdź internet.');
    });
  }

  function join(code) {
    stop();
    var me = peer = new Peer();
    var done = false;
    function fail(reason) {
      if (done || peer !== me) return;
      done = true;
      push('failed ' + reason);
    }
    var timer = setTimeout(function () { fail('Nie udało się połączyć z grą ' + code); }, JOIN_TIMEOUT);
    me.on('open', function () {
      var conn = me.connect(roomId(code), { reliable: true, serialization: 'json' });
      conn.on('open', function () {
        if (peer !== me) return conn.close();
        done = true;
        clearTimeout(timer);
        watch(conn, 'srv');
        push('found');
        push('connect srv');
      });
    });
    me.on('error', function (err) {
      if (err.type === 'peer-unavailable') fail('Nie znaleziono gry z kodem ' + code);
      else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')
        fail('Brak połączenia z serwerem gry przez sieć');
    });
  }

  // gra pyta o zdarzenia co klatkę; odpowiadamy plikiem, który Lua zaraz przeczyta
  function poll() {
    if (!queue.length) return;
    var data = new TextEncoder().encode(queue.join('\n') + '\n');
    queue = [];
    try { Module.FS_unlink(INBOX); } catch (e) {}
    Module.FS_createDataFile('/tmp', 'fafanet_inbox', data, true, true, true);
  }

  function handle(line) {
    var m = /^(\S+) ?(.*)$/.exec(line);
    var cmd = m[1], rest = m[2];
    if (cmd === 'poll') poll();
    else if (cmd === 'send') {
      var sp = rest.indexOf(' ');
      var conn = conns[rest.slice(0, sp)];
      if (conn && conn.open) conn.send(rest.slice(sp + 1));
    } else if (cmd === 'drop') {
      var c = conns[rest];
      // daj chwilę, żeby ostatnia wiadomość (np. powód odrzucenia) zdążyła dojść
      if (c) setTimeout(function () { try { c.close(); } catch (e) {} }, 300);
    } else if (cmd === 'host') host(rest);
    else if (cmd === 'join') join(rest);
    else if (cmd === 'stop') stop();
  }

  // wszystko, co gra wypisze przez print(), trafia tutaj
  Module.print = function (text) {
    if (text.lastIndexOf(PREFIX, 0) === 0) handle(text.slice(PREFIX.length));
    else console.log(text);
  };
  addEventListener('pagehide', stop);
})();
