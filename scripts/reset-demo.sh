#!/usr/bin/env bash
# scripts/reset-demo.sh
#
# Resets the working tree back to exactly match the `demo-baseline` tag,
# then commits and pushes that as one new "Reset" commit — NOT a
# force-push/hard-reset. Full history is preserved (the "before", the
# live-implemented "after", and the reset are all real, inspectable
# commits); the branch only ever moves forward.
#
# This restores the tree by diffing against the tag and checking out /
# removing exactly the paths that differ, rather than `git revert`-ing a
# commit range — that avoids any chance of a revert conflict if a demo
# run made several overlapping edits to the same files.
#
# Use this between rehearsals/demo runs of a live-implemented feature
# (e.g. "implement a real Hacker News feed via the AIDLC loop") so the
# same ask can be repeated from a known-clean starting point.
#
# Usage: scripts/reset-demo.sh

set -uo pipefail

BASELINE_TAG="demo-baseline"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\033[31mERROR:\033[0m %s\n' "$1" >&2; }
ok()   { printf '\033[32mOK:\033[0m %s\n' "$1"; }

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  fail "Not inside a git repository."
  exit 1
}
cd "$REPO_ROOT" || exit 1

git fetch origin --tags --quiet 2>/dev/null

if ! git rev-parse "$BASELINE_TAG" >/dev/null 2>&1; then
  fail "Tag '$BASELINE_TAG' not found locally or on origin."
  echo "Create it once with: git tag -a $BASELINE_TAG -m 'demo baseline' && git push origin $BASELINE_TAG"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  fail "Working tree has uncommitted changes. Commit, stash, or discard them first."
  git status --short
  exit 1
fi

BASELINE_SHA="$(git rev-parse "$BASELINE_TAG")"
HEAD_SHA="$(git rev-parse HEAD)"

if [ "$BASELINE_SHA" = "$HEAD_SHA" ]; then
  ok "Already at $BASELINE_TAG ($BASELINE_SHA) — nothing to reset."
  exit 0
fi

CHANGED_FILES="$(git diff --name-only "$BASELINE_TAG" HEAD)"
if [ -z "$CHANGED_FILES" ]; then
  ok "Tree already matches $BASELINE_TAG — nothing to reset."
  exit 0
fi

bold "==> Restoring tree to match $BASELINE_TAG ($BASELINE_SHA)"
echo "Files differing from baseline:"
echo "$CHANGED_FILES" | sed 's/^/  /'

while IFS= read -r f; do
  [ -z "$f" ] && continue
  if git cat-file -e "${BASELINE_TAG}:${f}" 2>/dev/null; then
    git checkout "$BASELINE_TAG" -- "$f"
  else
    git rm -q -f "$f" >/dev/null 2>&1 || rm -f "$f"
  fi
done <<< "$CHANGED_FILES"

if git diff --cached --quiet && git diff --quiet; then
  ok "Nothing to commit after restore — tree already matched."
  exit 0
fi

git add -A
git commit -q -m "Reset: revert to demo-baseline for next loop-engineering demo run"
ok "Created reset commit: $(git rev-parse --short HEAD)"

bold "==> Pushing reset to origin main"
if ! git push origin main; then
  fail "git push failed — inspect output above."
  exit 1
fi

ok "Pushed. main matches demo-baseline again (plus one visible reset commit)."
LATEST_RUN_ID="$(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null)"
if [ -n "$LATEST_RUN_ID" ]; then
  echo "Watch it deploy with: gh run watch $LATEST_RUN_ID --exit-status"
fi
echo "Then ask the same implementation prompt again to re-run the demo."
