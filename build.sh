#!/usr/bin/env bash
# Buduje stronę FafaPl: pakuje każdą grę LÖVE do wersji przeglądarkowej (love.js)
# i składa wszystko w katalogu site/.
#
# Użycie:   ./build.sh          — zbuduj
#           ./build.sh serve    — zbuduj i uruchom stronę na http://localhost:8000
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(dirname "$HERE")"
SITE="$HERE/site"
TMP="$HERE/.build"
LOVEJS="$HERE/.lovejs/node_modules/love.js"

# katalog_gry|tytuł|dodatki po przecinku: touch = przyciski na telefonie (układ w touch.js),
#                     net = gra przez sieć przez WebRTC (fafanet.js + web/<katalog>.lua)
GAMES=(
  "crystal_collector|Crystal Collector|touch"
  "dungeon_escape|Dungeon Escape|touch"
  "zapomniane_krolestwo|Zapomniane Królestwo|touch"
  "zelazne_imperium|Żelazne Imperium"
  "KrolestwoGiganta|Królestwo na Grzbiecie Giganta"
  "steal_a_squishy|Steal a Squishy|net,touch"
  "endless_waves|Endless Waves"
  "KronikiOstatniegoKrolestwa|Kroniki Ostatniego Królestwa"
  "steal_an_egg|Steal an Egg|touch"
)

if [ ! -d "$LOVEJS" ]; then
  echo ">> instaluję love.js"
  mkdir -p "$HERE/.lovejs"
  (cd "$HERE/.lovejs" && echo '{"name":"lovejs-tool","private":true}' > package.json && npm install --silent love.js@11.4.1)
fi

# numer wersji doklejany do adresów plików gry — po aktualizacji przeglądarka nie weźmie starej kopii z pamięci
VER="$(date +%s)"

rm -rf "$TMP" "$SITE/games"
mkdir -p "$TMP" "$SITE/games" "$SITE/engine"
cp "$LOVEJS/src/compat/love.js" "$LOVEJS/src/compat/love.wasm" "$SITE/engine/"

for entry in "${GAMES[@]}"; do
  IFS='|' read -r dir title extras <<< "$entry"
  id="$(echo "$dir" | tr 'A-Z' 'a-z')"
  echo ">> $title"

  stage="$TMP/$id"
  cp -r "$WORK/$dir" "$stage"
  # love.js to LÖVE 11.4 — gry są pisane pod 11.5, ale API jest to samo
  sed -i 's/t.version = "11.5"/t.version = "11.4"/' "$stage/conf.lua"
  # poprawki tylko dla wersji w przeglądarce: web/_all.lua dla wszystkich gier,
  # web/<katalog>.lua dla jednej gry (np. wyłączenie gry przez sieć)
  { cat "$HERE/web/_all.lua"
    [ -f "$HERE/web/$dir.lua" ] && cat "$HERE/web/$dir.lua"
    cat "$stage/main.lua"; } > "$stage/main.tmp"
  mv "$stage/main.tmp" "$stage/main.lua"

  (cd "$stage" && zip -qr "$TMP/$id.love" .)
  npx --prefix "$HERE/.lovejs" love.js -c -m 134217728 -t "$title" "$TMP/$id.love" "$TMP/$id-out" >/dev/null

  mkdir -p "$SITE/games/$id"
  cp "$TMP/$id-out/game.js" "$TMP/$id-out/game.data" "$SITE/games/$id/"
  extra=""
  case ",$extras," in *,touch,*) extra+="<script src=\"../../touch.js?v=$VER\"></script>" ;; esac
  case ",$extras," in *,net,*) extra+="<script src=\"https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js\"></script><script src=\"../../fafanet.js?v=$VER\"></script>" ;; esac
  sed -e "s|{{TITLE}}|$title|g" -e "s|{{EXTRA}}|$extra|" -e "s|{{VER}}|$VER|g" "$HERE/player.html" > "$SITE/games/$id/index.html"
done

cp "$HERE/index.html" "$HERE/touch.js" "$HERE/fafanet.js" "$SITE/"
sed "s|{{VER}}|$VER|g" "$HERE/play.html" > "$SITE/play.html"
cp -r "$HERE/thumbs" "$SITE/"
touch "$SITE/.nojekyll"  # GitHub Pages: serwuj pliki bez przetwarzania

rm -rf "$TMP"
echo ">> gotowe: $SITE"

if [ "${1:-}" = "serve" ]; then
  echo ">> strona działa na http://localhost:8000 (Ctrl+C kończy)"
  cd "$SITE" && python3 -m http.server 8000
fi

# ./build.sh publish — wyślij zbudowaną stronę na GitHub Pages (gałąź gh-pages)
if [ "${1:-}" = "publish" ]; then
  cd "$HERE"
  git add -A && git commit -qm "Aktualizacja strony" || true
  git push -q origin main
  git push -qf origin "$(git subtree split --prefix site)":gh-pages
  echo ">> wysłane — strona odświeży się za ok. minutę"
fi
