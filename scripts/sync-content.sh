#!/usr/bin/env bash
#
# sync-content.sh — pull the toolkit corpus from the Lossless content vault.
#
# The spike hand-copied a ~10% sample (173 of 1,764 tools) and committed it.
# That was fine for proving a shell and useless for judging the real surface:
# tag counts, collision rates, pagination, and search relevance all behave
# differently at 1,764 than at 173.
#
# Content is VENDORED as a BASELINE — committed into this repo, bundled at
# build time — and the live site overlays the vault's GitHub head on top of it
# at request time (src/lib/corpus.ts). Freshness never depends on this script:
# re-vendoring only shrinks the overlay a cold server instance has to fetch.
#
#   ./scripts/sync-content.sh            # sync from the monorepo's content/ checkout
#   ./scripts/sync-content.sh <vault>    # or from an explicit vault path
#   ./scripts/sync-content.sh --dry-run
#
set -euo pipefail

SITE="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_VAULT="$(cd "$SITE/../../.." && pwd)/content"

VAULT="$DEFAULT_VAULT"
DRY=""
for a in "$@"; do
  if [ "$a" = "--dry-run" ]; then DRY="--dry-run"; else VAULT="$a"; fi
done

if [ ! -d "$VAULT/tooling" ]; then
  echo "No vault at $VAULT — pass the path to the content repo." >&2
  exit 1
fi

# Mirror, deletions included, so a file moved or removed in the vault does not
# linger here. Protected from deletion: config.ts (the collection schema) and
# the fixtures, which are site-owned and have no vault counterpart. corpus.ts
# keeps the fixtures through the live overlay for the same reason.
sync_area() {
  local area="$1"
  echo "→ $area"
  rsync -a --delete $DRY \
    --filter='P config.ts' \
    --filter='P Empty Tool Test.md' \
    --filter='P Precedence Test.md' \
    --filter='P Publish False Test.md' \
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
