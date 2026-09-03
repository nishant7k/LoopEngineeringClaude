#!/usr/bin/env bash
# scripts/run-loop.sh
#
# Runs one "loop iteration" of the AIDLC demo against real GitHub
# infrastructure: local test gate -> commit -> push -> watch the Actions run
# -> report the Pages URL. Re-runnable on demand for repeated demos.
#
# Usage:
#   scripts/run-loop.sh ["optional commit message"]

set -uo pipefail

REPO_SLUG="nishant7k/LoopEngineeringClaude"
PAGES_URL="https://nishant7k.github.io/LoopEngineeringClaude/"
COMMIT_MSG="${1:-Loop: rerun demo iteration $(date -u +%Y-%m-%dT%H:%M:%SZ)}"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\033[31mERROR:\033[0m %s\n' "$1" >&2; }
ok()   { printf '\033[32mOK:\033[0m %s\n' "$1"; }

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  fail "Not inside a git repository."
  exit 1
}
cd "$REPO_ROOT" || exit 1

# --- 1. Fast local test gate -------------------------------------------------
bold "==> Test gate: node --check js/app.js"
if ! node --check js/app.js; then
  fail "js/app.js failed syntax check. Aborting loop before commit/push."
  exit 1
fi
ok "js/app.js syntax check passed."

# --- 2. Stage changes ---------------------------------------------------------
git add -A

if git diff --cached --quiet; then
  echo "No changes — nothing to loop"
  exit 0
fi

# --- 3. Commit -----------------------------------------------------------------
bold "==> Committing"
if ! git commit -m "$COMMIT_MSG"; then
  fail "git commit failed."
  exit 1
fi
ok "Committed: $COMMIT_MSG"

# --- 4. Push ---------------------------------------------------------------------
bold "==> Pushing to origin main"
PUSH_OUTPUT="$(git push origin main 2>&1)"
PUSH_STATUS=$?
echo "$PUSH_OUTPUT"

if [ $PUSH_STATUS -ne 0 ]; then
  if echo "$PUSH_OUTPUT" | grep -qi "workflow"; then
    fail "Push rejected — your token is missing the 'workflow' scope, which"
    echo "is required to create/update files under .github/workflows/."
    echo "Fix with:"
    echo
    echo "    gh auth refresh -h github.com -s workflow"
    echo
    echo "Then re-run: scripts/run-loop.sh"
  else
    fail "git push failed:"
    echo "$PUSH_OUTPUT"
  fi
  exit 1
fi
ok "Pushed to origin main."

# --- 5. Find and watch the new Actions run ---------------------------------------
bold "==> Waiting for the Actions run to appear"
RUN_ID=""
for i in $(seq 1 12); do
  RUN_JSON="$(gh run list --branch main --limit 1 --json databaseId,status,conclusion,url,headSha 2>/dev/null)"
  RUN_ID="$(echo "$RUN_JSON" | node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      try{const a=JSON.parse(d);console.log(a[0]?a[0].databaseId:"")}catch(e){console.log("")}
    })' 2>/dev/null)"
  if [ -n "$RUN_ID" ]; then
    break
  fi
  sleep 5
done

if [ -z "$RUN_ID" ]; then
  fail "Could not find a new Actions run for branch main after waiting. Check manually:"
  echo "    gh run list --branch main --limit 5"
  exit 1
fi

RUN_URL="$(echo "$RUN_JSON" | node -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
    try{const a=JSON.parse(d);console.log(a[0]?a[0].url:"")}catch(e){console.log("")}
  })' 2>/dev/null)"
ok "Found run #$RUN_ID — $RUN_URL"

bold "==> Watching run #$RUN_ID"
if gh run watch "$RUN_ID" --exit-status; then
  WATCH_STATUS=0
else
  WATCH_STATUS=$?
fi

# --- 6. Final report ---------------------------------------------------------------
FINAL_JSON="$(gh run view "$RUN_ID" --json status,conclusion,url 2>/dev/null)"
CONCLUSION="$(echo "$FINAL_JSON" | node -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
    try{const o=JSON.parse(d);console.log(o.conclusion||o.status||"unknown")}catch(e){console.log("unknown")}
  })' 2>/dev/null)"

echo
bold "===== run-loop.sh: result ====="
echo "  Run:        $RUN_URL"
echo "  Conclusion: $CONCLUSION"

if [ "$WATCH_STATUS" -eq 0 ] && [ "$CONCLUSION" = "success" ]; then
  ok "CI/CD pipeline succeeded."
  echo "  Live app:   $PAGES_URL"
  echo "  (Requires a public repo, or GitHub Pro/Team/Enterprise for a private"
  echo "  one, to actually serve. Pages deployment may take ~30s to propagate"
  echo "  on first enable.)"
  exit 0
else
  fail "CI/CD pipeline did not succeed (conclusion: $CONCLUSION)."
  echo "  Inspect:    $RUN_URL"
  exit 1
fi
