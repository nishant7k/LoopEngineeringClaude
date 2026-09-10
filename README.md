# Loop Engineering: AIDLC Demo

A proof-of-concept for **AI-Driven Life Cycle (AIDLC) loop engineering** —
specify, build, ship, observe, repeat — wired to **real GitHub
infrastructure**. Every loop iteration produces an actual commit, an actual
PR, an actual GitHub Actions run (lint, test, and a real AI security
review), and an actual GitHub Pages deployment. Nothing here is simulated
or mocked.

**Running the live demo? Start with [`DEMO.md`](DEMO.md)** — the talk-facing
script, running order, and narration notes. This README is the technical
reference underneath it. [`CLAUDE.md`](CLAUDE.md) is the deeper
architecture doc, for a Claude Code session working in this repo.

## The loop, in short

Ask for a feature → it opens a real PR → Lint, Test, and a real AI
**security review** run as PR checks → branch protection auto-merges only
once `security` + `Test` are green → CI builds and deploys → the live site
confirms the new commit. [`loop-live.html`](https://nishant7k.github.io/LoopEngineeringClaude/loop-live.html)
watches this entire path in real time, polling the real GitHub REST API —
nothing on that page is scripted.

A direct push to `main` (used by `scripts/reset-demo.sh` and
`scripts/run-loop.sh` below) skips the PR entirely, so it never touches
the security gate — that's a deliberate, visible difference, not a bug.

## What this demonstrates

- A small real-time feed app (`src/index.html`, `src/css/styles.css`,
  `src/js/app.js`, `src/js/globe.js`) as the subject of the loop — live ISS
  position via `wheretheiss.at`, plus a tracked-satellite globe (Hubble,
  Tiangong, Starlink) plotted from cached Celestrak TLEs. The live handshake
  is gated behind [`src/feature-flags.json`](src/feature-flags.json)`#liveFeed`:
  flipping that flag (a real commit → push → CI → deploy) is the
  live-implementation demo hook — while it's off, the UI shows an explicit
  "not yet implemented, ask the loop" state instead of faking the feature.
- A spec-driven process: [`specs/AIDLC-SPEC.md`](specs/AIDLC-SPEC.md)
  defines the loop methodology; [`specs/FEATURE-SPEC-realtime-feed.md`](specs/FEATURE-SPEC-realtime-feed.md)
  defines the feature under iteration.
- A running record of each loop pass in [`docs/LOOP-LOG.md`](docs/LOOP-LOG.md) —
  its commit-history table is regenerated from real `git log` output by
  `scripts/update-loop-log.js` (run by hand, e.g. right before a demo;
  it can't run as an unattended CI commit, since branch protection
  requires status checks on every push to `main` and giving CI a bypass
  credential would undercut the gate this repo is demonstrating).
- A CI/CD pipeline that actually builds and deploys on every push.
- Live tooling to watch that pipeline run, and a before/after view of the
  loop's effect.

## Run the app locally

No build step required — it's static HTML/CSS/JS.

```bash
open src/index.html
# or, to serve it over HTTP (needed for the feature-flags.json fetch):
cd src && python3 -m http.server
```

## Lint & test locally

```bash
npm run test:design   # design tokens + accessibility baseline, zero deps, ~200ms
npm run test:e2e      # real headless-Chromium e2e test (Playwright); self-serves over HTTP
npx playwright install --with-deps chromium   # one-time, if not already installed
```

Both run as CI jobs (`Lint & Design Standards`, `Test`) on every push and
PR — running them locally first catches the same failures before you push.

## CI/CD pipeline

Defined in [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml):

1. Push to `main`.
2. GitHub Actions builds a `dist/` directory and stamps it with
   `build-metadata.json` (commit SHA, build time).
3. The workflow deploys `dist/` to the `gh-pages` branch via
   `peaceiris/actions-gh-pages@v4`.
4. GitHub Pages serves the result at:

   **https://nishant7k.github.io/LoopEngineeringClaude/** (live — verified
   with `curl`, see [`docs/LOOP-LOG.md`](docs/LOOP-LOG.md) for the real run
   IDs and build metadata).

   Note: GitHub Pages requires a **public** repo (or GitHub
   Pro/Team/Enterprise for a private one) to actually serve. If you ever
   flip this repo private, the `build`/`deploy` jobs keep working and the
   `gh-pages` branch keeps updating — there just won't be a public URL
   until it's public again or the plan supports it.

### Security review

Defined in [`.github/workflows/security-review.yml`](.github/workflows/security-review.yml):
every pull request is scanned by [`anthropics/claude-code-security-review`](https://github.com/anthropics/claude-code-security-review),
an AI-powered, diff-aware security reviewer that comments findings directly
on the PR.

[`SECURITY-POLICY.md`](SECURITY-POLICY.md) is the threat model fed to the
scanner as both scan context and false-positive filtering guidance (full
rationale in [`specs/FEATURE-SPEC-security-loop.md`](specs/FEATURE-SPEC-security-loop.md)).
It's a living document, not a fixed rulebook: a `/security-fp <reason>`
comment on a PR triggers [`security-policy-update.yml`](.github/workflows/security-policy-update.yml),
which appends a new precedent and opens a PR against `main` with just that
one change — it only ever edits the policy doc, never application code, and
still goes through the normal checks-gated merge.

[`security/eval-fixtures/`](security/eval-fixtures/) holds intentionally
vulnerable snippets (never imported by the app, never bundled into `dist/`)
that exist solely to prove a policy edit didn't overreach into suppressing
a real bug class — see [`security/eval-fixtures/README.md`](security/eval-fixtures/README.md)
for the recall-check runbook.

### Watching the loop live

Open, side by side:

- **https://nishant7k.github.io/LoopEngineeringClaude/** — the real-time
  feed app itself.
- **https://nishant7k.github.io/LoopEngineeringClaude/monitoring.html** —
  the live Actions dashboard, polling the real GitHub REST API (1.5-4s,
  adaptive based on whether a token is saved).
- **https://nishant7k.github.io/LoopEngineeringClaude/loop-live.html** —
  the full ask-to-deploy stepper: PR, Lint/Test/Security, gate, build,
  deploy, monitor, all watched live.
- A terminal running `gh run watch` or `scripts/monitor-ci.sh` for the
  CLI-side view of the same CI/CD run.

(If the repo is ever private, `monitoring.html` still works — paste a
GitHub PAT into its token field, stored only in that browser's
`localStorage`, used only for `api.github.com` requests.)

## Real GitHub integration — prerequisites

This PoC drives the actual GitHub API and CLI, so you need:

- [`gh`](https://cli.github.com/) installed and authenticated:
  ```bash
  gh auth login
  ```
- The token must include the **`workflow`** OAuth scope. Without it,
  GitHub's push protection rejects any push that creates or modifies a file
  under `.github/workflows/` with an error like *"refusing to allow a
  Personal Access Token to create or update workflow ... without `workflow`
  scope."* If you hit that, run once (interactive, one-time):
  ```bash
  gh auth refresh -h github.com -s workflow
  ```

All three scripts below detect this failure mode and print the fix
automatically.

## Usage

**1. One-time setup** — verifies auth/scopes, creates the GitHub repo if
needed, and wires up the `origin` remote:

```bash
scripts/setup-github.sh
```

**2. Run the actual demo** — ask Claude directly to implement or change
something. It opens a PR, and `loop-live.html` shows Lint/Test/Security
run as real checks before branch protection auto-merges it. This is the
only path that exercises the security gate — see `DEMO.md`.

**3. Reset to the demo baseline** — diff-and-checkout against the
`demo-baseline` tag, then one real pushed "Reset:" commit. Direct push,
no PR — repeatable between rehearsals:

```bash
scripts/reset-demo.sh
```

**4. Quick non-gated iteration** (utility, not the demo path) — local
test gate, commit, push straight to `main`, watch the run, report the
Pages URL. Skips the PR entirely, so `security-review.yml` never runs for
it:

```bash
scripts/run-loop.sh                       # auto-generated commit message
scripts/run-loop.sh "Custom commit message"
```

**5. Monitor build status** — read-only, no git/GitHub mutations:

```bash
scripts/monitor-ci.sh          # terminal: recent runs + Pages status
open src/monitoring.html       # live dashboard in the browser (GitHub Actions REST API)
```

## Before / after

[`before-after.html`](src/before-after.html) shows a side-by-side comparison of
the app before and after a loop iteration, to make the effect of the loop
visible at a glance.
