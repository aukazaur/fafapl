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

# katalog_gry|tytuł|sterowanie dotykowe (touch = joystick i przycisk skoku na telefonie)
GAMES=(
  "crystal_collector|Crystal Collector|touch"
  "dungeon_escape|Dungeon Escape"
  "zapomniane_krolestwo|Zapomniane Królestwo"
  "zelazne_imperium|Żelazne Imperium"
  "KrolestwoGiganta|Królestwo na Grzbiecie Giganta"
)

if [ ! -d "$LOVEJS" ]; then
  echo ">> instaluję love.js"
  mkdir -p "$HERE/.lovejs"
  (cd "$HERE/.lovejs" && echo '{"name":"lovejs-tool","private":true}' > package.json && npm install --silent love.js@11.4.1)
fi

rm -rf "$TMP" "$SITE/games"
mkdir -p "$TMP" "$SITE/games" "$SITE/engine"
cp "$LOVEJS/src/compat/love.js" "$LOVEJS/src/compat/love.wasm" "$SITE/engine/"

for entry in "${GAMES[@]}"; do
  IFS='|' read -r dir title touch <<< "$entry"
  id="$(echo "$dir" | tr 'A-Z' 'a-z')"
  echo ">> $title"

  stage="$TMP/$id"
  cp -r "$WORK/$dir" "$stage"
  # love.js to LÖVE 11.4 — gry są pisane pod 11.5, ale API jest to samo
  sed -i 's/t.version = "11.5"/t.version = "11.4"/' "$stage/conf.lua"
  # w przeglądarce nie da się zamknąć okna — wyjście z gry niczego nie psuje
  printf 'love.event.quit = function() end\n' | cat - "$stage/main.lua" > "$stage/main.tmp"
  mv "$stage/main.tmp" "$stage/main.lua"

  (cd "$stage" && zip -qr "$TMP/$id.love" .)
  npx --prefix "$HERE/.lovejs" love.js -c -m 134217728 -t "$title" "$TMP/$id.love" "$TMP/$id-out" >/dev/null

  mkdir -p "$SITE/games/$id"
  cp "$TMP/$id-out/game.js" "$TMP/$id-out/game.data" "$SITE/games/$id/"
  touchtag=""
  [ "$touch" = "touch" ] && touchtag='<script src="../../touch.js"></script>'
  sed -e "s|{{TITLE}}|$title|g" -e "s|{{TOUCH}}|$touchtag|" "$HERE/player.html" > "$SITE/games/$id/index.html"
done

cp "$HERE/index.html" "$HERE/play.html" "$HERE/touch.js" "$SITE/"
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
