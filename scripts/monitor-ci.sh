#!/usr/bin/env bash
# scripts/monitor-ci.sh
#
# Read-only status check: recent Actions runs on main + GitHub Pages
# deployment status. Makes no git or GitHub mutations.
#
# Usage: scripts/monitor-ci.sh

set -uo pipefail

REPO_SLUG="nishant7k/LoopEngineeringClaude"
PAGES_URL="https://nishant7k.github.io/LoopEngineeringClaude/"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\033[31m%s\033[0m\n' "$1" >&2; }

command -v gh >/dev/null 2>&1 || {
  fail "GitHub CLI ('gh') not found. Install it: https://cli.github.com/"
  exit 1
}

if ! gh auth status >/dev/null 2>&1; then
  fail "Not authenticated with gh. Run: gh auth login"
  exit 1
fi

bold "===== Recent Actions runs on main (${REPO_SLUG}) ====="
gh run list \
  --repo "$REPO_SLUG" \
  --branch main \
  --limit 10 \
  --json databaseId,status,conclusion,displayTitle,workflowName,event,createdAt,updatedAt,url \
  --template '{{range .}}{{tablerow (printf "%v" .databaseId) .status .conclusion .workflowName .event .displayTitle}}{{end}}' \
  2>/tmp/monitor-ci-runlist-err.log || {
    fail "Failed to list runs:"
    cat /tmp/monitor-ci-runlist-err.log >&2
  }

echo
bold "===== GitHub Pages deployment status ====="
PAGES_JSON="$(gh api "repos/${REPO_SLUG}/pages" 2>/tmp/monitor-ci-pages-err.log)"
PAGES_API_STATUS=$?

if [ $PAGES_API_STATUS -ne 0 ]; then
  if grep -qi "404" /tmp/monitor-ci-pages-err.log; then
    echo "Pages not enabled yet (404) — it activates after the first successful"
    echo "deploy job pushes to the gh-pages branch."
  else
    fail "Could not fetch Pages status:"
    cat /tmp/monitor-ci-pages-err.log >&2
  fi
else
  STATUS="$(echo "$PAGES_JSON" | node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      try{const o=JSON.parse(d);
        console.log("  URL:        "+(o.html_url||o.url||""));
        console.log("  Status:     "+(o.status||"unknown"));
        console.log("  Source:     "+(o.source?(o.source.branch+" / "+o.source.path):"unknown"));
        console.log("  HTTPS:      "+(o.https_enforced?"enforced":"not enforced"));
      }catch(e){console.log("  (could not parse Pages response)")}
    })' 2>/dev/null)"
  echo "$STATUS"
fi

echo
bold "===== Most recent run — quick summary ====="
LATEST_JSON="$(gh run list --repo "$REPO_SLUG" --branch main --limit 1 \
  --json databaseId,status,conclusion,url,workflowName,createdAt 2>/dev/null)"

echo "$LATEST_JSON" | node -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
    try{
      const a=JSON.parse(d);
      if(!a.length){console.log("  No runs found yet on branch main.");return;}
      const r=a[0];
      console.log("  Workflow:   "+r.workflowName);
      console.log("  Status:     "+r.status);
      console.log("  Conclusion: "+(r.conclusion||"(in progress)"));
      console.log("  Started:    "+r.createdAt);
      console.log("  URL:        "+r.url);
    }catch(e){console.log("  Could not parse latest run data.")}
  })' 2>/dev/null

echo
echo "Live app: ${PAGES_URL}"
echo "Live dashboard: ${PAGES_URL}monitoring.html"
echo "(Pages needs a public repo, or Pro/Team/Enterprise for a private one.)"
