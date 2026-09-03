#!/usr/bin/env bash
# scripts/setup-github.sh
#
# One-time (idempotent) setup: verify gh auth + required scopes, ensure the
# nishant7k/LoopEngineeringClaude repo exists on GitHub, and wire up the
# 'origin' git remote. Does NOT push — that's scripts/run-loop.sh's job.
#
# Safe to re-run any number of times.

set -uo pipefail

REPO_SLUG="nishant7k/LoopEngineeringClaude"
PAGES_URL="https://nishant7k.github.io/LoopEngineeringClaude/"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\033[31mERROR:\033[0m %s\n' "$1" >&2; }
ok()   { printf '\033[32mOK:\033[0m %s\n' "$1"; }

command -v gh >/dev/null 2>&1 || {
  fail "GitHub CLI ('gh') not found. Install it: https://cli.github.com/"
  exit 1
}

# --- 1. Authentication check ------------------------------------------------
if ! gh auth status >/dev/null 2>&1; then
  fail "Not authenticated with GitHub CLI."
  echo "Run:"
  echo "    gh auth login"
  echo "then re-run this script."
  exit 1
fi
ok "gh is authenticated."

# --- 2. Scope check (need 'workflow' to push .github/workflows/*) ----------
AUTH_STATUS_OUTPUT="$(gh auth status 2>&1)"

HAS_WORKFLOW_SCOPE=0
if echo "$AUTH_STATUS_OUTPUT" | grep -qi "workflow"; then
  HAS_WORKFLOW_SCOPE=1
else
  # Fallback: check the OAuth scopes header via the API.
  SCOPES_HEADER="$(gh api -i /rate_limit 2>/dev/null | grep -i '^x-oauth-scopes:' || true)"
  if echo "$SCOPES_HEADER" | grep -qi "workflow"; then
    HAS_WORKFLOW_SCOPE=1
  fi
fi

if [ "$HAS_WORKFLOW_SCOPE" -ne 1 ]; then
  fail "Your gh token is missing the 'workflow' scope."
  echo "Pushing changes to .github/workflows/ci-cd.yml will be rejected by"
  echo "GitHub's push protection without it. Fix with:"
  echo
  echo "    gh auth refresh -h github.com -s workflow"
  echo
  echo "This is an interactive step (opens a browser/device-code flow) that"
  echo "a human needs to run once. Re-run this script afterward."
  exit 1
fi
ok "Token has 'workflow' scope."

# --- 3. Ensure the remote GitHub repo exists --------------------------------
if git remote get-url origin >/dev/null 2>&1; then
  ok "Local git remote 'origin' already set: $(git remote get-url origin)"
else
  if gh repo view "$REPO_SLUG" >/dev/null 2>&1; then
    ok "Repo $REPO_SLUG already exists on GitHub. Adding as 'origin'."
    REMOTE_URL="$(gh repo view "$REPO_SLUG" --json url -q .url)"
    git remote add origin "${REMOTE_URL}.git" || {
      fail "Failed to add remote 'origin'."
      exit 1
    }
  else
    ok "Repo $REPO_SLUG does not exist yet. Creating it."
    if ! gh repo create "$REPO_SLUG" --public --source=. --remote=origin; then
      fail "Failed to create $REPO_SLUG on GitHub."
      exit 1
    fi
  fi
fi

# --- 4. Summary --------------------------------------------------------------
echo
bold "===== setup-github.sh: ready ====="
echo "  Repo:        https://github.com/${REPO_SLUG}"
echo "  Remote:      $(git remote get-url origin 2>/dev/null || echo '(none)')"
echo "  Auth scopes: includes 'workflow' (required for CI/CD workflow pushes)"
echo "  Pages URL:   ${PAGES_URL} (live once the deploy job runs successfully)"
echo
echo "Next: run scripts/run-loop.sh to commit, push, and watch a CI/CD run."
