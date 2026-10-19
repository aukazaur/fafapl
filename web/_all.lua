-- Doklejane przez build.sh na początek main.lua każdej gry w wersji na stronę.

-- w przeglądarce nie da się zamknąć okna — wyjście z gry niczego nie psuje
love.event.quit = function() end

-- love.js zawiesza się przy czytaniu pliku, którego nie ma (np. przy pierwszym uruchomieniu
-- przed zapisem), więc najpierw sprawdzamy, czy istnieje — jak w zwykłym LÖVE, zwracamy nil i błąd
local read = love.filesystem.read
love.filesystem.read = function(name, ...)
    if not love.filesystem.getInfo(name) then
        return nil, "Could not open file " .. name .. ". Does not exist."
    end
    return read(name, ...)
end
