# Loop Engineering — Live Demo Companion

> Reference doc for the demo section of the talk. Everything below describes
> **this repository**, running live — not a mock. See `docs/LOOP-LOG.md` for
> the real commit/run history behind every claim here.

## The reframe, in one line

> "My job is to write loops." — Boris Cherny

A **prompt** asks for the next thing, does it, and stops — you judge it.
A **loop** names a condition and keeps going until it's true, or it runs out
of turns or money. This repo is one loop, running against a real GitHub
repo, that you can watch end to end.

## The six parts — and where each one lives in this repo

| Part (from the talk) | What it does | In this repo |
|---|---|---|
| Something that starts it | Wakes the loop up | You, asking Claude directly — or `push` / `workflow_dispatch` |
| Written-down rules | Conventions saved once, not re-explained every run | `specs/AIDLC-SPEC.md`, `specs/FEATURE-SPEC-realtime-feed.md` |
| Access to real tools | Reaches where the work actually lives | GitHub REST API, GitHub Actions, Celestrak, wheretheiss.at |
| A second, independent checker | Doesn't trust the writer's own judgment | **GitHub Actions** — `Lint & Design Standards` + `Test` jobs |
| The gate | Decides what's safe to ship | `needs: [lint, test]` — Build/Deploy literally cannot run if the checker disagrees |
| A file that remembers | Survives past the end of one conversation | `docs/LOOP-LOG.md` — real SHAs and run IDs, not a summary written after the fact |

Notice the checker here isn't a second LLM — it's deterministic tests and a
lint script. That's deliberate, and it's the same claim from the talk:
*"prefer checks a machine can settle — cheaper, and harder to argue with."*
`scripts/check-design-standards.js` and `tests/e2e.js` (a real headless-browser
run, not a mock DOM) are that check.

## The loop, live

```mermaid
%%{init: {'theme':'dark', 'themeVariables': {
  'primaryColor': '#1a242b',
  'primaryTextColor': '#edf2f4',
  'primaryBorderColor': '#5cbbcb',
  'lineColor': '#7f909a',
  'secondaryColor': '#243139',
  'tertiaryColor': '#0f1519',
  'fontFamily': 'IBM Plex Sans, sans-serif'
}}}%%
flowchart LR
    ASK["Ask the loop\n(you → Claude)"]:::human --> CODE["Code\nedit spec-gated feature"]:::write
    CODE --> COMMIT["Commit\nreal git commit"]:::write
    COMMIT --> PUSH["Push\norigin main"]:::write
    PUSH --> LINT{"Lint & Design\nStandards"}:::check
    PUSH --> TEST{"Test\nreal headless browser"}:::check
    LINT -->|pass| GATE{{"Gate\nneeds: lint, test"}}:::gate
    TEST -->|pass| GATE
    LINT -.->|fail| STOP["Nothing ships\nfix required"]:::stop
    TEST -.->|fail| STOP
    GATE --> BUILD["Build\ndist/ + build-metadata.json"]:::write
    BUILD --> DEPLOY["Deploy\ngh-pages"]:::write
    DEPLOY --> MONITOR["Monitor\nlive site confirms SHA"]:::state
    MONITOR --> LOG[("docs/LOOP-LOG.md\nthe file that remembers")]:::state
    LOG -.->|reset-demo.sh| ASK

    classDef human fill:#3b2e1b,stroke:#d9a45b,color:#edf2f4
    classDef write fill:#1a242b,stroke:#5cbbcb,color:#edf2f4
    classDef check fill:#123c45,stroke:#5cbbcb,color:#edf2f4
    classDef gate fill:#3b2e1b,stroke:#d9a45b,color:#edf2f4,stroke-width:2px
    classDef stop fill:#3a1414,stroke:#f2555a,color:#edf2f4
    classDef state fill:#0f1519,stroke:#7f909a,color:#edf2f4
```

Every box above is a real thing you can click on right now:

- **Ask** → you, live, in the terminal
- **Code / Commit / Push** → `git log` on `main`
- **Lint / Test** → [Actions tab](https://github.com/nishant7k/LoopEngineeringClaude/actions), real jobs, real durations
- **Gate** → the `needs:` line in [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) — not a metaphor, the actual YAML
- **Build / Deploy** → [gh-pages branch](https://github.com/nishant7k/LoopEngineeringClaude/tree/gh-pages)
- **Monitor** → [`loop-live.html`](https://nishant7k.github.io/LoopEngineeringClaude/loop-live.html), watching the same API you'd hit with `gh run list`
- **The loop-back** → `scripts/reset-demo.sh`, a real `git` revert-and-push, not a UI reset

## What to narrate live (three things, per the talk's own advice)

1. **The condition you typed** — say it out loud before you hit enter:
   *"implement the live ISS tracking feed"* (or whatever you're asking for
   that day). That sentence is the entire spec the loop needs.
2. **The checker disagreeing with the writer** — if you have time, this
   really happened tonight: a CI step hung on `npm install` for three
   minutes straight before the fix landed. The checker didn't wave it
   through because a human wanted it to work — it kept failing until the
   actual cause (`npm`'s audit/funding calls) was found and removed. That's
   the "never let it mark its own homework" line, live, with a timestamp.
3. **The state file afterwards** — open `docs/LOOP-LOG.md` and show that
   the SHAs and run IDs in it are the same ones just seen in the Actions
   tab. Nothing was written after the fact to look tidy.

## Fallback

Per the deck: *if it stalls, cut to the recording immediately — don't
debug on stage.* `monitoring.html` shows the real Actions history
regardless of whether a live trigger is running; `before-after.html` is
accurate as static snapshots without needing a live toggle at all.
