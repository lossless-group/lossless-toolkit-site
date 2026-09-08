#!/usr/bin/env bash
#
# sync-content.sh — pull the toolkit corpus from the Lossless content vault.
#
# The spike hand-copied a ~10% sample (173 of 1,764 tools) and committed it.
# That was fine for proving a shell and useless for judging the real surface:
# tag counts, collision rates, pagination, and search relevance all behave
# differently at 1,764 than at 173.
#
# Content is VENDORED — committed into this repo, not read from a sibling path
# at build time — because the site must build from its own repo alone. This
# script is how the vendored copy gets refreshed.
#
#   ./scripts/sync-content.sh            # sync from ../lossless-monorepo/content
#   ./scripts/sync-content.sh <vault>    # or from an explicit vault path
#   ./scripts/sync-content.sh --dry-run
#
set -euo pipefail

VAULT="${1:-/home/mps/code/lossless-monorepo/content}"
[ "$VAULT" = "--dry-run" ] && VAULT="/home/mps/code/lossless-monorepo/content"
DRY=""
for a in "$@"; do [ "$a" = "--dry-run" ] && DRY="--dry-run"; done

SITE="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$VAULT/tooling" ]; then
  echo "No vault at $VAULT — pass the path to the content repo." >&2
  exit 1
fi

# Fixtures are site-owned and have no vault counterpart. They pin behaviour the
# corpus cannot be relied on to exhibit — a zero-byte file, a frontmatter
# precedence chain, a publish:false entry. --delete would remove them, so it is
# deliberately NOT used; likewise config.ts, which is the collection schema.
sync_area() {
  local area="$1"
  echo "→ $area"
  rsync -a $DRY \
    --include='*/' --include='*.md' --exclude='*' \
    --prune-empty-dirs \
    "$VAULT/$area/" "$SITE/src/content/$area/"
}

sync_area tooling
sync_area vertical-toolkits

if [ -z "$DRY" ]; then
  echo
  echo "tooling:            $(find "$SITE/src/content/tooling" -name '*.md' | wc -l) files"
  echo "vertical-toolkits:  $(find "$SITE/src/content/vertical-toolkits" -name '*.md' | wc -l) files"
  echo
  echo "Fixtures still present:"
  for f in "Empty Tool Test.md" "Precedence Test.md" "Publish False Test.md"; do
    [ -f "$SITE/src/content/tooling/$f" ] && echo "  ok   $f" || echo "  LOST $f"
  done
fi
