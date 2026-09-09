# Loop Engineering — Live Demo Companion

> Reference doc for the demo section of the talk. Everything below describes
> **this repository**, running live — not a mock. See `docs/LOOP-LOG.md` for
> the real commit/run history behind every claim here.

## Running order — one merged loop, then a second story about its gate

The feature loop and the security loop used to be tellable as two
separate demos. They no longer are: `feature-flags.json` (and any other
change) now ships through a real PR, and `loop-live.html` watches that
whole path in one stepper — Code → PR → **Lint / Test / Security**
(the actual required checks, polled from the PR's own check-runs) →
**Gate** (auto-merge, only once all three are green) → Build → Deploy →
Monitor. Ask for a feature once, and the security gate is already part
of the same picture the audience is watching — nothing extra to trigger.

1. **Loop 1 — the feature loop** ("The loop, live" below): ask the loop
   to implement something. It opens a PR, the audience watches Lint,
   Test, and **Security** run as real PR checks, then watches the gate
   auto-merge and deploy — one continuous stepper, no separate story
   needed to prove security ran.
2. **Loop 2 — the false-positive story** ("Second story: the security
   review loop" further down): once the audience has *seen* the gate
   run for real, pivot to the one time it got the answer to that gate
   wrong — the real PR #1 caching bug — as the "never let it mark its
   own homework" beat. This is now a callback to something they just
   watched happen correctly, not the first time security comes up.

`docs/LOOP-LOG.md` is the single artifact that ties both together at
the end — real evidence for both stories in one file.

> Note: a change pushed directly to `main` (e.g. `scripts/reset-demo.sh`)
> has no PR and so never touches the security gate —
> `security-review.yml` only triggers on `pull_request`. `loop-live.html`
> detects this and marks PR/Security/Gate as **skipped** rather than
> pretending they ran; the reset is a repeatable admin action, not a
> gated change, so this is accurate, not a bug.

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
| A second, independent checker | Doesn't trust the writer's own judgment | **GitHub Actions** — `Lint & Design Standards` + `Test` + `security` (an AI review, but *of the diff*, never of its own output) |
| The gate | Decides what's safe to ship | Branch protection on `main` — `security` + `Test` required, auto-merge only fires once both are green |
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
    ASK["Ask the loop\n(you → Claude)"]:::human --> CODE["Code · Commit\nreal git commit, a branch"]:::write
    CODE --> PR["Push → Pull Request\nagainst main"]:::write
    PR --> LINT{"Lint & Design\nStandards"}:::check
    PR --> TEST{"Test\nreal headless browser"}:::check
    PR --> SEC{"Security\nreal AI review of the diff"}:::check
    LINT -->|pass| GATE{{"Gate\nbranch protection: security + Test"}}:::gate
    TEST -->|pass| GATE
    SEC -->|pass| GATE
    LINT -.->|fail| STOP["Nothing merges\nfix required"]:::stop
    TEST -.->|fail| STOP
    SEC -.->|fail| STOP
    GATE -->|auto-merge| BUILD["Build\ndist/ + build-metadata.json"]:::write
    BUILD --> DEPLOY["Deploy\ngh-pages"]:::write
    DEPLOY --> MONITOR["Monitor\nlive site confirms SHA"]:::state
    MONITOR --> LOG[("docs/LOOP-LOG.md\nthe file that remembers")]:::state
    LOG -.->|reset-demo.sh, direct push| ASK

    classDef human fill:#3b2e1b,stroke:#d9a45b,color:#edf2f4
    classDef write fill:#1a242b,stroke:#5cbbcb,color:#edf2f4
    classDef check fill:#123c45,stroke:#5cbbcb,color:#edf2f4
    classDef gate fill:#3b2e1b,stroke:#d9a45b,color:#edf2f4,stroke-width:2px
    classDef stop fill:#3a1414,stroke:#f2555a,color:#edf2f4
    classDef state fill:#0f1519,stroke:#7f909a,color:#edf2f4
```

Every box above is a real thing you can click on right now:

- **Ask** → you, live, in the terminal
- **Code / Push → PR** → `git log` on the feature branch, and the PR itself on GitHub
- **Lint / Test / Security** → [Actions tab](https://github.com/nishant7k/LoopEngineeringClaude/actions), real jobs, real durations, all three run *as PR checks* before anything merges
- **Gate** → [branch protection on `main`](https://github.com/nishant7k/LoopEngineeringClaude/settings/branches) requiring `security` + `Test` — not a metaphor, the actual required-checks list
- **Build / Deploy** → [gh-pages branch](https://github.com/nishant7k/LoopEngineeringClaude/tree/gh-pages)
- **Monitor** → [`loop-live.html`](https://nishant7k.github.io/LoopEngineeringClaude/loop-live.html), which now watches this entire path — PR, checks, merge, deploy — in one stepper, polling the same API you'd hit with `gh run list` / `gh pr checks`
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

---

## Second story: the security review loop

> Adapted from Figma's ["How Figma stays ahead of vulnerabilities with
> agents"](https://www.figma.com/blog/how-figma-stays-ahead-of-vulnerabilities-with-agents/) —
> full rationale in `specs/FEATURE-SPEC-security-loop.md`. Same loop
> shape as above, pointed at the CI pipeline instead of the app.

### The six parts, this time for security

| Part (from the talk) | What it does | In this repo |
|---|---|---|
| Something that starts it | Wakes the loop up | Any PR against `main` |
| Written-down rules | Institutional reasoning, not re-litigated every scan | [`SECURITY-POLICY.md`](../SECURITY-POLICY.md) — precedents, not generic rules |
| Access to real tools | Reaches where the work actually lives | `anthropics/claude-code-security-review`, reading the real diff |
| A second, independent checker | Doesn't trust the writer's own judgment | The `security` job in `.github/workflows/security-review.yml` |
| The gate | Decides what's safe to ship | Branch protection on `main` — `security` + `Test` both required |
| A file that remembers | Survives past the end of one conversation | `docs/LOOP-LOG.md`'s security-loop section + run-history table |

The loop-back this time isn't a human editing the policy from memory —
it's `.github/workflows/security-policy-update.yml`: a `/security-fp
<reason>` PR comment appends a new precedent and opens a PR against
`main` with that change. The policy improves from real disputes, not
from someone remembering to update a doc.

### What to narrate live

1. **The condition** — open a PR (even a trivial one) and say out loud:
   *"every PR here gets a real AI security review before it can merge."*
2. **The checker disagreeing with the writer — a true story, already on
   the record.** This isn't hypothetical: PR #1 in this repo's own
   history merged with a `security` check that reported `pass` in
   **16 seconds** — but its own log reads *"ClaudeCode has already run on
   PR #1 (found marker file), forcing disable to avoid false
   positives."* A failed first attempt (missing API key) got cached as
   "already ran," and the retry silently skipped scanning. Open
   [run 34271699196](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34271699196)
   live and read that line out loud — then show
   [run 34272199324](https://github.com/nishant7k/LoopEngineeringClaude/actions/runs/34272199324),
   the real scan once the key was fixed, at 57s. **A real scan on this
   repo takes 50s to 3 minutes, never ~15 seconds** — that gap is now
   documented as the manual tell in both `monitoring.html` and
   `docs/LOOP-LOG.md`. This is the single best "never let it mark its
   own homework" moment in either loop, because it's not staged — it's
   what actually happened while building this.
3. **The state file afterwards** — `docs/LOOP-LOG.md`'s "Security review
   loop" section: real PR numbers, real commit SHAs, real run IDs and
   durations for every iteration, plus the run-history table showing the
   16s-fake-pass vs. 53s+-real-scan contrast side by side.

If time allows, a fourth beat: comment `/security-fp <reason>` on any
open PR and watch `security-policy-update.yml` open a new PR against
`SECURITY-POLICY.md` live — the loop editing its own rules.

### Fallback

Same rule as Loop 1: don't debug a stalled Action live.
`monitoring.html`'s "Security review loop" panel (real pass/fail counts
against the real GitHub API) and `docs/LOOP-LOG.md`'s run-history table
both work as static evidence without triggering anything new.
