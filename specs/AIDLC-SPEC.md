# AIDLC — AI-Driven Development Lifecycle (Loop Engineering Spec)

This document specifies the loop this repository is built to demonstrate:
an AI agent driving a feature from an empty scaffold to a deployed,
monitored application through repeatable, observable iterations.

## The Loop

Each iteration of the loop executes these stages in order. Every stage
produces a durable artifact (a file, a commit, a workflow run) so the loop
is auditable after the fact — nothing here is narrated without evidence.

| Stage    | Input                          | Action                                                        | Artifact / Evidence                                  |
|----------|---------------------------------|----------------------------------------------------------------|-------------------------------------------------------|
| Plan     | Feature request / gap analysis  | Write or update a spec describing the target behavior          | `specs/*.md`                                          |
| Code     | Spec                             | Implement the smallest coherent slice of the spec               | Diffs in `index.html`, `css/`, `js/`                  |
| Test     | Implementation                   | Validate locally (manual checklist + structural checks)         | `docs/LOOP-LOG.md` test notes, `scripts/test-local.sh`|
| Commit   | Validated change                 | `git commit` with a message naming the loop stage and intent    | `git log`                                             |
| Push     | Local commit                     | `git push origin main`                                           | Remote commit SHA on GitHub                           |
| Build    | Pushed commit                    | GitHub Actions runs `.github/workflows/ci-cd.yml`                | Workflow run in the Actions tab                        |
| Deploy   | Successful build                 | Workflow publishes `dist/` to the `gh-pages` branch              | GitHub Pages deployment                                |
| Monitor  | Deployment                       | Poll the GitHub REST API for run/deployment status               | `monitoring.html`, `scripts/monitor-ci.sh`             |

The loop is not linear-once: it repeats. Each pass through Code → Test →
Commit → Push → Build → Deploy → Monitor is one "iteration," and the
iterations for the real-time data feed feature are logged in
[`docs/LOOP-LOG.md`](../docs/LOOP-LOG.md) with real commit SHAs and (once
GitHub auth is configured — see README) real Actions run IDs.

## Non-negotiables for this PoC

- **No mocked GitHub state.** `monitoring.html` and `scripts/monitor-ci.sh`
  call the real GitHub REST API (`api.github.com`) against
  `nishant7k/LoopEngineeringDevin`. If the repo has no runs yet, the
  dashboard shows an empty state — it does not fabricate rows.
- **No framework.** The app is plain HTML/CSS/JS so every line of the
  "after" state is inspectable without a build step getting in the way.
- **Every stage is re-runnable.** `scripts/run-loop.sh` re-executes
  Code-adjacent validation → Commit → Push → Build-watch → Monitor for a
  fresh change, so the demo can be repeated on demand rather than replayed
  from a recording.

## Before / After

- **Before**: `git show <first-commit>:index.html` — a static page with a
  disabled "Connect" button and a placeholder panel that reads
  "Real-time feed — not yet implemented."
- **After**: the current `index.html` — a working connection-managed,
  timestamped, status-indicated, clearable live feed. See
  [`specs/FEATURE-SPEC-realtime-feed.md`](FEATURE-SPEC-realtime-feed.md)
  for the acceptance criteria that separate the two states, and
  `before-after.html` for a side-by-side rendered comparison.
