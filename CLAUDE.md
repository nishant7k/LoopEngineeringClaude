# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A proof-of-concept for AIDLC (AI-Driven Development Lifecycle) "loop
engineering": every feature goes through Plan (spec) → Code → Test →
Commit → Push → Build → Deploy → Monitor against **real** GitHub
infrastructure — no mocked commits, no fabricated Actions runs, no
simulated API responses. The methodology is documented in
[`specs/AIDLC-SPEC.md`](specs/AIDLC-SPEC.md); read it before making
non-trivial changes, since the discipline it describes (spec first, real
evidence after, nothing narrated without a commit SHA or run ID to back
it) governs how work in this repo should be done, not just what the app
does.

## Commands

```bash
# Run locally — static site, no build step
open index.html
python3 -m http.server        # or serve over HTTP (needed for feature-flags.json fetch)

# Lint (design tokens + accessibility baseline, zero deps, ~200ms)
npm run test:design           # node scripts/check-design-standards.js

# Real headless-Chromium e2e test (Playwright) — self-serves over HTTP internally
npm run test:e2e              # node tests/e2e.js index.html
npx playwright install --with-deps chromium   # one-time, if not already installed

# Structural syntax check (used in CI before the e2e test)
node --check js/app.js

# One-time GitHub setup: verify gh auth/scopes, ensure repo + origin remote exist
scripts/setup-github.sh

# Full loop iteration against real GitHub: test gate -> commit -> push -> watch Actions -> report Pages URL
scripts/run-loop.sh ["optional commit message"]

# Read-only status: recent Actions runs + Pages deployment (no mutations)
scripts/monitor-ci.sh

# Reset the working tree to the `demo-baseline` git tag, commit + push that as one visible "Reset:" commit
scripts/reset-demo.sh
```

There is no bundler, no package build, no `npm run build` — `index.html`,
`css/styles.css`, `js/app.js`, `js/globe.js` are the actual shipped app.
`dist/` only exists as a CI artifact, assembled by explicitly copying that
same file list (see the `Assemble dist` step in `ci-cd.yml`) — it is not
a bundler output and has no separate source of truth.

## Architecture

**Spec → Log, not code → docs.** Every feature has a spec in `specs/`
written *before* implementation (`FEATURE-SPEC-realtime-feed.md`,
`FEATURE-SPEC-security-loop.md`), and every real iteration against it is
recorded in `docs/LOOP-LOG.md` *after* it actually happens — real commit
SHAs, real Actions run IDs and URLs, filled in as each stage executes,
never written in advance to look tidy. If a spec and `LOOP-LOG.md` ever
disagree with `git log`, `git log` is ground truth. When adding a
feature, add or extend a spec first, then log the real evidence once
each stage actually runs — don't skip straight to code, and don't
narrate a stage that hasn't happened yet.

**Two independent loops share the same CI gate.** `.github/workflows/ci-cd.yml`
has four jobs — `Lint & Design Standards`, `Test`, `Build`, `Deploy` — where
`Build`/`Deploy` `need: [lint, test]` and `Deploy` additionally requires
`github.event_name == 'push' && github.ref == 'refs/heads/main'`, so PRs
run the first three as checks but can never publish to `gh-pages`.
`.github/workflows/security-review.yml` runs an AI security scan
(`anthropics/claude-code-security-review`) on every PR, reading
[`SECURITY-POLICY.md`](SECURITY-POLICY.md) as both scan context and
false-positive filtering guidance via the action's
`custom-security-scan-instructions` / `false-positive-filtering-instructions`
inputs. Branch protection on `main` requires both `security` and `Test`
to pass; PRs are opened with `gh pr merge --auto --squash` rather than
merged directly, so the gate is what actually decides what ships, not a
manual click.

**The security loop treats false positives as data, not noise.**
`SECURITY-POLICY.md` is a living set of precedents (not generic rules)
specific to this codebase's real patterns — see the file itself for the
current list. `.github/workflows/security-policy-update.yml` lets a
`/security-fp <reason>` PR comment append a new precedent and open a PR
against `main` with that change; it only ever edits the policy doc, never
application code, and the resulting PR still goes through the normal
checks-gated merge. `security/eval-fixtures/` holds intentionally
vulnerable snippets (never imported by the app, never bundled into
`dist/`) that exist solely to prove a policy edit didn't overreach into
suppressing a real bug class — see `security/eval-fixtures/README.md` for
the recall-check runbook. Full rationale in
`specs/FEATURE-SPEC-security-loop.md`.

**A real Claude Code security scan on this repo takes ~1-3 minutes, not
seconds.** A `security` check that completes in ~15s almost always means
the action's own caching skipped a rescan (either because this exact PR
already got a real scan on an earlier commit, which is expected, or —
the bug that shipped once, in PR #1 — because a *failed* run's cache
marker got misread as "already ran"). Read the job log's own text
(`"ClaudeCode will run"` vs `"ClaudeCode has already run ... forcing
disable"`) before trusting a fast pass. `monitoring.html`'s "Security
review loop" panel and `docs/LOOP-LOG.md`'s run-history table document
this.

**No mocked GitHub state, anywhere.** `monitoring.html` and `loop-live.html`
poll the real `api.github.com` REST API client-side (optionally
authenticated via a PAT typed into a password field, stored only in that
browser's own `localStorage`, sent only to `api.github.com` — there is no
app server, this is a static site). If there's nothing to show, they
render an empty/error state; they never fabricate rows. `scripts/monitor-ci.sh`
and `scripts/run-loop.sh` hit the real GitHub CLI (`gh`), authenticated
via the operator's own `gh auth login` session — never a hardcoded token.

**The live-implementation demo mechanic.** `feature-flags.json#liveFeed`
gates whether Connect performs a real satellite-tracking handshake or
shows an explicit "not yet implemented, ask the loop" state — this is
what lets a feature be implemented live on stage and then reset.
`js/app.js` polls ISS position live (`api.wheretheiss.at`); `js/globe.js`
additionally plots Hubble/Tiangong/Starlink via cached TLEs
(Celestrak, refreshed hourly via `localStorage`) propagated locally with
`satellite.js` (SGP4) rather than repeated network polling. `demo-baseline`
(a git tag) plus `scripts/reset-demo.sh` (diff-and-checkout against that
tag, then one real pushed "Reset:" commit — never a force-push or hard
reset) make the ask-implement-watch-reset cycle repeatable across
rehearsals. Check what `demo-baseline` currently points to
(`git show demo-baseline:feature-flags.json`) before relying on
`reset-demo.sh` for a specific demo — the tag records whatever state it
was last moved to, which may not match a given spec iteration's intended
"before" state.
