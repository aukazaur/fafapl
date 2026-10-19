-- Doklejane przez build.sh na początek main.lua w wersji na stronę.
-- Przeglądarka nie ma ENet ani UDP, więc gra przez sieć jest wyłączona
-- i zamiast błędu przy starcie gracz dostaje zrozumiały komunikat.
package.preload.enet = function() return {} end
package.preload.socket = function() return {} end
do
    local net = require("net")
    local MSG = "Gra przez sieć nie działa w przeglądarce"
    local failJoin = false
    net.startHost = function() return false, MSG end
    net.startJoin = function() failJoin = true return true end
    local update = net.update
    net.update = function(dt)
        if failJoin then
            failJoin = false
            return { { type = "failed", reason = MSG } }
        end
        return update(dt)
    end
end
