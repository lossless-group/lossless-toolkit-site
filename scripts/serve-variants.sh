#!/usr/bin/env bash
#
# serve-variants.sh — build every toolkit variant and serve them all at once,
# each on its own port, so they can be compared by flipping browser tabs rather
# than by rebuilding between looks.
#
# The variants live on branches in the spike repos, not in this one. This repo
# holds the context-v record; the code lives in working copies outside the
# monorepo (that is deliberate — see the handoff). So this script builds each
# ref in a throwaway git worktree and serves the result.
#
#   ./scripts/serve-variants.sh          # build + serve everything
#   ./scripts/serve-variants.sh --stop   # kill the servers, remove worktrees
#   ./scripts/serve-variants.sh --no-build   # reuse existing dist/, just serve
#
# node_modules is symlinked from the matching source working copy rather than
# installed per worktree: A and B have different dependency sets (A ships zero
# JavaScript and has no Svelte), so they cannot share one store.
#
set -uo pipefail

A_SRC="/home/mps/code/lossless-toolkit-site-spike-variant-a"
B_SRC="/home/mps/code/lossless-toolkit-site-spike-variant-b"
WORK="/tmp/toolkit-variants"

# label | source repo | git ref | port | what it is
VARIANTS=(
  "variant-a|$A_SRC|spike/variant-a|4401|zero-JS, everything materialised"
  "variant-b|$B_SRC|spike/variant-b|4402|islands + one shared reactive atom"
  "current|$B_SRC|feat/wikilink-path-mapping|4403|B + content-map, wikilinks, /toolkit/"
)


# Neither fuser nor lsof is guaranteed on a minimal NixOS box — both are absent
# here — so port clearing has to go through `ss`. This failing SILENTLY is what
# makes it dangerous: Astro then auto-increments onto a free port and the
# comparison table points at the wrong build.
# Is anything listening on this port? Neither fuser nor lsof is guaranteed on a
# minimal NixOS box, so this goes through `ss`.
port_busy() {
  ss -lptnH "sport = :$1" 2>/dev/null | grep -q . && return 0
  return 1
}

# Find a free port, starting at the preferred one and counting upward.
#
# This function exists instead of a kill_port() because killing was the wrong
# instinct: the process holding a port is usually SOMEONE ELSE'S — a dev server
# the operator started deliberately — and terminating it to claim a number is
# rude and destructive. This harness serves throwaway builds; it has no claim
# on any particular port.
#
# Falling back also removes the reason kill_port existed. Astro's preview server
# silently auto-increments past a busy port, so the danger was never the
# collision itself, it was binding somewhere unannounced and then reporting the
# port we ASKED for. We now choose a free port up front and report the port the
# server actually bound, read back from its own log.
free_port() {
  local port="$1" limit=$(( $1 + 40 ))
  while [ "$port" -lt "$limit" ]; do
    port_busy "$port" || { echo "$port"; return 0; }
    port=$(( port + 1 ))
  done
  echo "$1" # give up and let Astro sort it out; the log read-back will tell us
  return 1
}

# Stop only the servers THIS script started, tracked by pid file. Never a blanket
# sweep of every astro process — see free_port() on not touching other people's.
stop_ours() {
  [ -f "$WORK/pids" ] || return 0
  while read -r pid label; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "  stopped $label (pid $pid)"
    fi
  done < "$WORK/pids"
  rm -f "$WORK/pids"
  return 0
}

stop() {
  echo "Stopping servers…"
  stop_ours
  for v in "${VARIANTS[@]}"; do
    IFS='|' read -r label src _ref _port _desc <<<"$v"
    wt="$WORK/$label"
    # Only ever touch throwaway worktrees under $WORK — never a source copy.
    if [ -d "$wt" ]; then
      rm -f "$wt/node_modules"
      git -C "$src" worktree remove "$wt" --force >/dev/null 2>&1
    fi
  done
  git -C "$A_SRC" worktree prune 2>/dev/null
  git -C "$B_SRC" worktree prune 2>/dev/null
  rm -rf "$WORK"
  echo "Done."
}

[ "${1:-}" = "--stop" ] && { stop; exit 0; }
BUILD=1
[ "${1:-}" = "--no-build" ] && BUILD=0

mkdir -p "$WORK"
echo

for v in "${VARIANTS[@]}"; do
  IFS='|' read -r label src ref port desc <<<"$v"
  # A branch can only be checked out in ONE worktree. Two of these refs are
  # already checked out in their own working copies, so serving those from a
  # fresh worktree is both impossible and pointless — use the copy directly.
  if [ "$(git -C "$src" branch --show-current 2>/dev/null)" = "$ref" ]; then
    wt="$src"
    echo "[$label] serving $ref in place ($src)"
  else
    wt="$WORK/$label"
    if [ ! -d "$wt" ]; then
      echo "[$label] worktree ← $ref"
      if ! git -C "$src" worktree add "$wt" "$ref" >/dev/null 2>&1; then
        echo "  FAILED to create worktree for $ref — skipping"
        continue
      fi
    fi
    # Dependencies come from the source working copy. Symlink, never install:
    # a per-worktree install would take minutes and duplicate the store.
    [ -e "$wt/node_modules" ] || ln -s "$src/node_modules" "$wt/node_modules"
  fi

  if [ "$BUILD" = "1" ]; then
    echo "[$label] building…"
    if ! (cd "$wt" && pnpm build) >"$WORK/$label-build.log" 2>&1; then
      echo "  BUILD FAILED — see $WORK/$label-build.log"
      tail -5 "$WORK/$label-build.log" | sed 's/^/    /'
      continue
    fi
  fi

  # Take the next FREE port rather than evicting whoever holds the preferred
  # one. The table below reports the port actually bound, so a fallback is
  # visible rather than silently wrong.
  port=$(free_port "$port")

  (cd "$wt" && nohup pnpm preview --port "$port" >"$WORK/$label-serve.log" 2>&1 & echo "$! $label" >>"$WORK/pids")
done

echo
echo "Waiting for servers…"
sleep 6

printf "\n  %-10s  %-24s  %s\n" "VARIANT" "URL" "WHAT IT IS"
printf "  %-10s  %-24s  %s\n" "----------" "------------------------" "----------------------------------------"
for v in "${VARIANTS[@]}"; do
  IFS='|' read -r label _src _ref port desc <<<"$v"
  # Trust the log, not the guess: this is the port it really bound to.
  actual=$(grep -oE 'localhost:[0-9]+' "$WORK/$label-serve.log" 2>/dev/null | head -1 | cut -d: -f2)
  actual=${actual:-$port}
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$actual/" 2>/dev/null)
  mark=$([ "$code" = "200" ] && echo "OK" || echo "FAIL ($code)")
  [ "$actual" != "$port" ] && mark="$mark (drifted from $port)"
  printf "  %-10s  %-24s  %s  %s\n" "$label" "http://localhost:$actual/" "$desc" "$mark"
done

echo
echo "  Stop everything:  ./scripts/serve-variants.sh --stop"
echo
