# Loop Engineering: AIDLC Demo

A proof-of-concept for **AI-Driven Life Cycle (AIDLC) loop engineering** —
specify, build, ship, observe, repeat — wired to **real GitHub
infrastructure**. Every loop iteration produces an actual commit, an actual
push, an actual GitHub Actions run, and an actual GitHub Pages deployment.
Nothing here is simulated or mocked.

## What this demonstrates

- A small real-time feed app (`index.html`, `css/styles.css`, `js/app.js`)
  as the subject of the loop.
- A spec-driven process: [`specs/AIDLC-SPEC.md`](specs/AIDLC-SPEC.md)
  defines the loop methodology; [`specs/FEATURE-SPEC-realtime-feed.md`](specs/FEATURE-SPEC-realtime-feed.md)
  defines the feature under iteration.
- A running record of each loop pass in [`docs/LOOP-LOG.md`](docs/LOOP-LOG.md).
- A CI/CD pipeline that actually builds and deploys on every push.
- Live tooling to watch that pipeline run, and a before/after view of the
  loop's effect.

## Run the app locally

No build step required — it's static HTML/CSS/JS.

```bash
open index.html
# or, to serve it over HTTP:
python3 -m http.server
```

## CI/CD pipeline

Defined in [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml):

1. Push to `main`.
2. GitHub Actions builds a `dist/` directory and stamps it with
   `build-metadata.json` (commit SHA, build time).
3. The workflow deploys `dist/` to the `gh-pages` branch via
   `peaceiris/actions-gh-pages@v4`.
4. GitHub Pages would serve the result publicly — **but this repo is
   private**, and GitHub Pages requires a public repo (or GitHub
   Pro/Team/Enterprise) to actually go live. The build and deploy jobs both
   run for real and the `gh-pages` branch really does get updated on every
   push (see [`docs/LOOP-LOG.md`](docs/LOOP-LOG.md) for the first real run);
   there just isn't a public URL while the repo stays private.

### Demoing it live without public Pages

```bash
python3 -m http.server 8888   # from the repo root
```

Then open, side by side:

- `http://localhost:8888/index.html` — the real-time feed app itself.
- `http://localhost:8888/monitoring.html` — the live Actions dashboard.
  Since the repo is private, paste a GitHub PAT (or run `gh auth token` and
  copy it) into the token field — otherwise the GitHub API returns 404 for
  everything. The token is stored only in that browser's `localStorage`.
- A terminal running `gh run watch` or `scripts/monitor-ci.sh` for the
  CLI-side view of the same CI/CD run.

That combination — local live feed, live dashboard, live Actions log — is
the full loop visible at once, without needing a public Pages URL.

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

**2. Run a loop iteration on demand** — local test gate, commit, push,
watch the Actions run to completion, report the Pages URL. Re-runnable for
repeated demos:

```bash
scripts/run-loop.sh                       # auto-generated commit message
scripts/run-loop.sh "Custom commit message"
```

**3. Monitor build status** — read-only, no git/GitHub mutations:

```bash
scripts/monitor-ci.sh          # terminal: recent runs + Pages status
open monitoring.html           # live dashboard in the browser (GitHub Actions REST API)
```

## Before / after

[`before-after.html`](before-after.html) shows a side-by-side comparison of
the app before and after a loop iteration, to make the effect of the loop
visible at a glance.
