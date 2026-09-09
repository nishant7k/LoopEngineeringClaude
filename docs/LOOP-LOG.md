# Loop Log

Real record of each AIDLC loop iteration for the real-time data feed
feature. Filled in as each stage actually happens — commit SHAs and run
IDs are copied from real `git`/`gh` output, not written in advance.

## Iteration 0 — Plan

- **Plan**: [`specs/AIDLC-SPEC.md`](../specs/AIDLC-SPEC.md),
  [`specs/FEATURE-SPEC-realtime-feed.md`](../specs/FEATURE-SPEC-realtime-feed.md)
- **Commit**: `f9f133d`

## Iteration 1 — Before-state scaffold

- **Code**: static shell (`index.html`, `css/styles.css`, `js/app.js`) with
  a disabled Connect button and a "not yet implemented" panel.
- **Test**: opened `index.html` directly; confirmed the button is disabled
  and no JS errors appear in the console.
- **Commit**: `c320172`

## Iteration 2 — Connection management

- **Code**: enabled Connect/Disconnect toggle, `idle → connecting → active`
  state machine, simulated 5% handshake failure into `error`.
- **Test**: `node --check js/app.js` passed.
- **Commit**: `b8d478e`

## Iteration 3 — Live stream + status indicators

- **Code**: randomized-interval item generator with ISO timestamps and
  sequence numbers; four-state status dot with ARIA live region.
- **Test**: `node --check js/app.js` passed.
- **Commit**: `dad12d3`

## Iteration 4 — Feed management + polish (after state)

- **Code**: Clear control, 200-item cap, uptime/item-count header,
  animations, keyboard operability.
- **Test**: real Playwright run against `index.html` in headless Chromium —
  connect → status reaches `Active` → live timestamped items render →
  Clear empties the list and resets the count → Disconnect returns to
  `Idle`. Zero console/page errors.
- **Commit**: `7ecacf9`

## Iteration 5 — CI/CD

- **Code**: `.github/workflows/ci-cd.yml` (checkout@v4, setup-node@v4,
  build metadata generation, upload-artifact@v4, peaceiris/actions-gh-pages@v4).
- **Commit**: `3a4ceb6`
- **Push / Build / Deploy**: recorded below once pushed to
  `nishant7k/LoopEngineeringClaude`.

## Iteration 6 — Monitoring + before/after

- **Code**: `monitoring.html` (live GitHub REST API polling of Actions
  runs and Pages deployment status, verified error-free in headless
  Chromium against the not-yet-existing repo — correctly shows the 404
  "not found" state rather than fabricating data), `before-after.html`.
- **Commit**: `b4b2b56`
- **Monitor**: first real run ID and status recorded below once pushed.

## First real push / build / deploy — recorded live

- **Repo created**: `nishant7k/LoopEngineeringClaude` via `gh repo create ... --source=. --remote=origin`.
- **Push commit**: `7d50771` (`git push -u origin main`) — all 8 local commits landed in one push, real history preserved.
- **Actions run #1**: [33805610632](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/33805610632) — `build` (13s) and `deploy` (6s) jobs both succeeded.
- **Visibility flip**: briefly set to private (`gh repo edit --visibility private`), then confirmed via `gh api -X POST repos/.../pages` returning `422 "Your current plan does not support GitHub Pages for this repository"` — GitHub Pages requires a public repo (or Pro/Team/Enterprise) for a private one. Before flipping back to public, ran a full-history secret scan (`git log -p --all` against token/key/credential patterns, plus a filename scan for `.env`/`.pem`/`credentials`) — **clean, nothing found** — then set back to public with `gh repo edit --visibility public`.
- **Push commit #2**: `fa9e5be` (docs update) — **Actions run #2**: [33805895658](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/33805895658) — `success`.
- **Deploy evidence**: `gh-pages` branch created/updated by `peaceiris/actions-gh-pages@v4`.
- **Pages enabled**: `gh api -X POST repos/.../pages -f source[branch]=gh-pages -f source[path]=/` → `202`, serving from `gh-pages` root.
- **Public Pages URL — verified live**: **https://nishant7k.github.io/LoopEngineeringClaude/** (HTTP 200, confirmed by `curl`; took ~4 polling attempts / ~30s to propagate after enabling).
- **Live build metadata** (`curl https://nishant7k.github.io/LoopEngineeringClaude/build-metadata.json`):
  ```json
  {
    "buildNumber": "2",
    "commitSha": "fa9e5be5ba43786e4a82fe39aca714490f77a1b8",
    "branch": "main",
    "actor": "nishant7k",
    "timestamp": "2026-09-03T21:04:26Z",
    "workflowRunUrl": "https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/33805895658"
  }
  ```
- `monitoring.html` and `before-after.html` both verified reachable at `https://nishant7k.github.io/LoopEngineeringClaude/{monitoring,before-after}.html` (HTTP 200).

## Reset infrastructure — for repeatable live-implementation demos

- `demo-baseline` git tag marks a clean state (app + all demo tooling
  present, no live-implemented feature yet). `scripts/reset-demo.sh`
  restores the tree to exactly match it (diff-and-checkout, not
  force-push) and pushes one visible "Reset:" commit — safe to run
  between rehearsals or before a live talk.
- Rationale: this lets a feature be implemented live (e.g. by asking
  Claude directly, "implement X via the AIDLC loop") and then reset back
  to a known-clean starting point so the exact same ask can be repeated.

## Iteration 7 — real Hacker News integration (rehearsed live-implementation)

- **Plan**: added to `specs/FEATURE-SPEC-realtime-feed.md` under "Iteration 7".
- **Code**: `js/app.js` rewritten to fetch `hacker-news.firebaseio.com` for
  real top stories instead of generating synthetic timestamps; `index.html`
  / `css/styles.css` updated for real article rows (title link, score,
  author, real relative time) and a "Source: Hacker News" label.
- **CI/CD redesign (permanent, not iteration-specific)**: `.github/workflows/ci-cd.yml`
  now has 4 named jobs — **Lint & Design Standards** (`scripts/check-design-standards.js`,
  zero-dependency token + accessibility check), **Test** (`tests/e2e.js`, a
  real headless-Chromium Playwright smoke test, browser binaries cached via
  `actions/cache`), **Build**, **Deploy** — each maps 1:1 to a node in the
  new live visualizer.
- **New**: `loop-live.html` — a 7-node stepper (Plan · Code/Commit/Push ·
  Lint & Design Standards · Test · Build · Deploy · Monitor) that polls the
  real GitHub REST API (commits, Actions runs, job status) plus the live
  Pages `build-metadata.json`, every 3s, and lights up each node the moment
  its real signal appears. No fabricated states.
- **Test (local)**: `node tests/e2e.js index.html` passed against the real
  HN API before pushing; `loop-live.html` verified locally against the real
  GitHub API (correctly captured baseline SHA `d5d25a9`, correctly showed
  Plan done / Code watching / rest pending).
- **Commit / Push / Build / Deploy / Monitor**: `0a7caa4`, run
  [33808260376](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/33808260376) —
  all 4 jobs succeeded (Test 42s, Lint 10s, Build 11s, Deploy 6s). Live site
  verified via `curl build-metadata.json` matching the pushed SHA.
- **Reset rehearsal**: pushed a trivial README change, watched all 4 stages
  pass, ran `scripts/reset-demo.sh`, watched all 4 stages pass again on the
  revert commit, confirmed `git diff demo-baseline HEAD` was empty
  afterward. Full ask → implement → reset cycle proven end-to-end.
- **`demo-baseline` retagged** to this state (`0a7caa4`, later moved again
  — see iteration 8) once it was clear the CI/CD redesign and
  `loop-live.html` needed to be permanent, not reset targets.

## Iteration 8 — feature-flag gate + live ISS tracking

- **Plan**: `specs/FEATURE-SPEC-realtime-feed.md` "Iteration 8".
- **Code**: `feature-flags.json` (`liveFeed: false` by default), `js/app.js`
  rewritten for a real `awaiting` state + live ISS polling via
  `api.wheretheiss.at`, `index.html`/`css/styles.css` updated (dynamic
  source label, dashed "awaiting" status dot), `tests/e2e.js` fixed to
  serve over real HTTP instead of `file://` (relative `fetch()` of
  `feature-flags.json` is refused entirely under `file://` by Chromium,
  independent of CORS — this would have silently broken both local
  double-click usage and the CI test job), `.github/workflows/ci-cd.yml`
  gained a cache-busting step (`?v=<short-sha>` on `css/js` references in
  every deployed HTML file) so a browser tab can never mix a cached old
  `app.js` with a freshly deployed `index.html` again — this exact bug was
  hit once live during rehearsal (screenshot showed old simulated-feed
  rendering after a real deploy had already shipped the HN version).
- **Test (local)**: `tests/e2e.js` passed against both `liveFeed: false`
  (asserts the awaiting-state copy) and `liveFeed: true` (asserts a real
  `.feed-title`/`.feed-hn-meta` row renders) before pushing. Manual
  Playwright check confirmed real ISS numbers rendering (e.g. "45.09°,
  88.99°" · "420.9 km alt · 27599 km/h · daylight").
- **`demo-baseline` intent going forward**: this iteration, with the flag
  at `false`, IS the baseline. Enabling the flag (`liveFeed: true`) is the
  live-demo action; `scripts/reset-demo.sh` reverts it back to `false`.
- **Commit / Push / Build / Deploy / Monitor**: recorded live below.

## Security review loop — AIDLC applied to the security gate itself

Spec: [`specs/FEATURE-SPEC-security-loop.md`](../specs/FEATURE-SPEC-security-loop.md),
adapting practices from
[Figma's "How Figma stays ahead of vulnerabilities with agents"](https://www.figma.com/blog/how-figma-stays-ahead-of-vulnerabilities-with-agents/)
to demo scale. Every PR below is real, on `nishant7k/LoopEngineeringClaude`,
merged only after its own `security`/`Test` checks passed — the loop
mechanism proving itself on its own change.

### Iteration 0 — bootstrap, and a real gap it caught in itself

- **Code**: `.github/workflows/security-review.yml` added — commit
  `ed6364d` (direct push, before the PR-based loop below started).
- **PR #1** (`6a49cc0`) wired `ci-cd.yml`'s `Test` job into PRs and armed
  auto-merge + branch protection (`security` + `Test` required).
- **Real gap found live, not simulated**: PR #1's first `security` run
  ([34271430538](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34271430538),
  `failure`, 0s) failed correctly — `CLAUDE_API_KEY` wasn't set yet. The
  retry
  ([34271699196](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34271699196),
  `success`, **16s**) reported `pass` — but its own log reads *"ClaudeCode
  has already run on PR #1 (found marker file), forcing disable to avoid
  false positives"*: the action's caching treated the failed attempt as
  "already ran" and silently skipped scanning. PR #1 merged with a green
  check that never actually scanned anything.
- **PR #2** (`ebe67ff`) proved the fix once `CLAUDE_API_KEY` was added: a
  fresh diff forces a new cache key, so its run
  ([34272199324](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34272199324),
  `success`, 57s) shows *"ClaudeCode will run for PR #2 (first run)"* and
  a real `"findings": []` result. This gap — a fake pass indistinguishable
  from a real one without reading raw logs — is exactly what iteration 3
  below (loop metrics) makes visible at a glance instead.

### Iteration 1 — policy as threat model

- PR #3 (`8ad9832`): `SECURITY-POLICY.md` (6 precedents) + wired into
  `security-review.yml` via `custom-security-scan-instructions` /
  `false-positive-filtering-instructions`.
- `security` run [34274986063](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34274986063) —
  `success`, **1m16s** (a real scan referencing the new policy, not a
  cache-skip).

### Iteration 2 — recall eval fixtures

- PR #4 (`89dfe8a`): `security/eval-fixtures/` (command injection,
  reflected XSS, hardcoded secret) + runbook. First push attempt was
  blocked by **GitHub push protection** for a Stripe-shaped fake key in
  `hardcoded-secret.js` — real, unplanned validation that the fixture
  looked realistic; fixed to a non-vendor-pattern placeholder before the
  successful push.
- `security` run [34275256803](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34275256803) —
  `success`, **2m52s** (longest scan yet — 3 fixtures to analyze).

### Iteration 3 — loop metrics (observe)

- PR #5 (`7bd3181`): `monitoring.html` gained a "Security review loop"
  stat row (scans shown / pass / fail / latest), filtered from the same
  already-fetched `/actions/runs` data — no new endpoint.
- `security` run [34275682458](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34275682458) —
  `success`, 53s.

### Iteration 4 — false-positive feedback loop (repeat)

- PR #6 (`4fe9430`): `.github/workflows/security-policy-update.yml` — a
  `/security-fp <reason>` PR comment appends a precedent to
  `SECURITY-POLICY.md` and opens a new PR against `main`.
- `security` run [34276006065](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34276006065) —
  `success`, **1m31s**.
- **Not yet exercised live**: no `/security-fp` comment has been posted
  against a real finding yet — this row updates the moment one is.

### Security-review run history (real durations, not illustrative)

| Run | PR | Conclusion | Duration | Note |
|-----|----|----|----------|------|
| [34271430538](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34271430538) | #1 | failure | 0s | missing `CLAUDE_API_KEY` |
| [34271699196](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34271699196) | #1 | success | 16s | **fake pass** — cache-skipped, no scan ran |
| [34272199324](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34272199324) | #2 | success | 57s | real scan, 0 findings |
| [34274986063](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34274986063) | #3 | success | 1m16s | real scan, policy wired in |
| [34275256803](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34275256803) | #4 | success | 2m52s | real scan, 3 fixtures analyzed |
| [34275682458](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34275682458) | #5 | success | 53s | real scan |
| [34276006065](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34276006065) | #6 | success | 1m31s | real scan |

The 16s-vs-53s+ gap is the whole lesson: a real Claude Code security scan
on this repo consistently takes closer to a minute, not seconds. That's
now the manual tell documented in `monitoring.html` itself.

---

**Note on authenticity**: rows marked _pending_ are stages that require
GitHub authentication that had not been configured yet at spec-writing
time. They are updated with real commit SHAs, run IDs, and URLs in place
as each stage is actually executed — see `git log` for ground truth if
this file and the repo ever disagree.
