#!/usr/bin/env bash
# Fetches only the game tables the data layer reads (packages/data/tables.json)
# from the data/ submodules, at the commits this repository pins. Used by CI
# and the cloud session start hook. A full submodule checkout
# (git submodule update --init data/…) works too and is left alone.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

tables=$(node -e 'console.log(require("./packages/data/tables.json").tables.join(" "))')

fetch() {
  local path="$1" tabledir="$2"
  local url sha
  url=$(git config -f .gitmodules "submodule.$path.url")
  sha=$(git ls-tree HEAD "$path" | awk '{print $3}')
  local patterns=()
  for t in $tables; do patterns+=("/$tabledir/$t.json"); done

  if [ -e "$path/.git" ] && [ "$(git -C "$path" rev-parse HEAD 2>/dev/null)" = "$sha" ]; then
    local missing=0
    for p in "${patterns[@]}"; do [ -f "$path$p" ] || missing=1; done
    if [ "$missing" = 0 ]; then
      echo "$path: up to date at $sha"
      return
    fi
    if [ "$(git -C "$path" config core.sparseCheckout || echo false)" = true ]; then
      git -C "$path" sparse-checkout set --no-cone "${patterns[@]}"
      echo "$path: sparse paths updated"
      return
    fi
  fi

  echo "$path: fetching ${#patterns[@]} tables at $sha"
  rm -rf "$path"
  mkdir -p "$path"
  git -C "$path" init -q
  git -C "$path" remote add origin "$url"
  git -C "$path" sparse-checkout set --no-cone "${patterns[@]}"
  git -C "$path" fetch -q --depth 1 --filter=blob:none origin "$sha"
  git -C "$path" checkout -q FETCH_HEAD
}

fetch data/rmxlinux-EndfieldData TableCfg
fetch data/555me-beyondGameData tableCfg
