-- Doklejane przez build.sh na początek main.lua w wersji na stronę.
-- Przeglądarka nie ma ENet ani UDP, więc gra przez sieć idzie przez WebRTC (PeerJS) w fafanet.js.
-- Podmieniamy tylko funkcje z net.lua, które dotykają sieci; kodowanie wiadomości zostaje oryginalne.
--
-- Pomost Lua <-> JavaScript:
--   Lua -> JS: print("@@fafanet <polecenie>") — strona przechwytuje te linie z konsoli
--   JS -> Lua: na "@@fafanet poll" strona zapisuje zaległe zdarzenia do pliku INBOX, Lua go czyta
package.preload.enet = function() return {} end
package.preload.socket = function() return {} end
do
    local net = require("net")
    local INBOX = "/tmp/fafanet_inbox"
    local mode, server
    local peers = {}

    local function cmd(...)
        print("@@fafanet " .. table.concat({ ... }, " "))
    end

    -- udaje obiekt peer z ENet w takim zakresie, w jakim używa go gra
    local function newPeer(id)
        local p = { id = id, connected = true }
        function p:send(data, channel, flag)
            if self.connected then cmd("send", self.id, data) end
        end
        function p:disconnect_later() cmd("drop", self.id) end
        function p:disconnect_now() self.connected = false cmd("drop", self.id) end
        function p:state() return self.connected and "connected" or "disconnected" end
        return p
    end

    local function peerFor(id)
        if not peers[id] then peers[id] = newPeer(id) end
        return peers[id]
    end

    function net.startHost(gameCode)
        net.stop()
        mode = "host"
        cmd("host", gameCode)
        return true
    end

    function net.startJoin(gameCode)
        net.stop()
        mode = "client"
        cmd("join", gameCode)
        return true
    end

    function net.stop()
        if mode then cmd("stop") end
        mode, server, peers = nil, nil, {}
    end

    function net.mode() return mode end

    function net.update(dt)
        local events = {}
        if not mode then return events end
        cmd("poll")
        local f = io.open(INBOX, "rb")
        if not f then return events end
        local text = f:read("*a")
        f:close()
        os.remove(INBOX)
        for line in text:gmatch("[^\n]+") do
            local kind, rest = line:match("^(%S+) ?(.*)$")
            if kind == "found" then
                events[#events + 1] = { type = "found", ip = "hosta" }
            elseif kind == "failed" then
                events[#events + 1] = { type = "failed", reason = rest }
            elseif kind == "connect" then
                local p = peerFor(rest)
                if mode == "client" then server = p end
                events[#events + 1] = { type = "connect", peer = p }
            elseif kind == "disconnect" then
                local p = peerFor(rest)
                p.connected = false
                peers[rest] = nil
                events[#events + 1] = { type = "disconnect", peer = p }
            elseif kind == "recv" then
                local id, data = rest:match("^(%S+) (.*)$")
                local msg = id and net.decode(data)
                if type(msg) == "table" then events[#events + 1] = { type = "receive", peer = peerFor(id), msg = msg } end
            end
        end
        return events
    end

    function net.send(peer, msg) peer:send(net.encode(msg)) end

    function net.sendServer(msg)
        if server and server.connected then net.send(server, msg) end
    end

    function net.flush() end
end
