# Feature Spec — Security Review Loop

## Problem

`.github/workflows/security-review.yml` runs
[`anthropics/claude-code-security-review`](https://github.com/anthropics/claude-code-security-review)
on every PR, but as first wired up it was a single stateless check: no
memory of what's actually a false positive in this codebase, no way to
prove it still catches real bugs after tuning, no visible trend over time,
and no feedback path from "this finding was wrong" back into the check
itself. That's a gate, not a loop.

## Origin

Adapted from Figma's
["How Figma stays ahead of vulnerabilities with agents"](https://www.figma.com/blog/how-figma-stays-ahead-of-vulnerabilities-with-agents/) —
specifically the idea that **the policy is the threat model**: a living
document of contextual precedents ("dbops is fine because only privileged
operators touch it"), not generic rules, referenced by the scanner and
updated every time a finding is disputed. Figma's full system (a
TypeScript service with provider failover, Datadog/Slack telemetry, dual
frontier-model adjudication, bug-bounty triage, sandboxed fix-writing
agents, repo-wide sharded audits) is enterprise-scale infrastructure this
PoC has no use for — see "Explicitly out of scope" below. This spec
replicates the **loop pattern** at demo scale: Plan (policy) → Code
(scanner reads it) → Test (eval fixtures prove recall) → Observe (metrics)
→ Repeat (false positives rewrite the policy).

## Before state (iteration 0)

- `security-review.yml` calls the action with only `comment-pr` and
  `claude-api-key` — no policy input, no precedent memory.
- Demonstrated gap, live, in this repo's own history: PR #1 merged after
  the `security` check reported `pass` in 16s — but it never actually
  scanned anything. A first attempt failed (missing API key), and the
  action's own caching treated that failure as "already ran," so the
  retry silently skipped the scan and reported success. See
  `docs/LOOP-LOG.md` for the real run IDs.
- No record of findings-count or scan health over time; no way to tell a
  real 0-findings pass from a silently-skipped one without reading raw
  Action logs by hand (as happened here).

## After state (target)

### Iteration 1 — Policy as threat model

- `SECURITY-POLICY.md` at repo root: a living set of precedents specific
  to this codebase's actual patterns (the client-side GitHub PAT field in
  `monitoring.html`, `innerHTML = ""` clears, hardcoded public/keyless API
  endpoints, `gh auth`-based script credentials, etc.), each with the
  reasoning a reviewer would need — not a blanket allow/deny rule.
- Wired into `security-review.yml` via the action's own
  `custom-security-scan-instructions` and
  `false-positive-filtering-instructions` inputs (both accept a path to a
  text file) — no forked action, no custom scanning logic.

### Iteration 2 — Recall eval fixtures

- `security/eval-fixtures/`: a handful of small, clearly-labeled,
  intentionally-vulnerable snippets (command injection, reflected XSS,
  hardcoded secret) that are never imported by the real app and never
  bundled into `dist/`.
- A documented runbook (`security/eval-fixtures/README.md`) for the
  recall check Figma's loop performs automatically at their scale: open a
  PR touching only this directory, confirm the scanner still flags all of
  them, close without merging. Exists so a future policy edit that's too
  broad gets caught before it ships, not after.

### Iteration 3 — Loop metrics (observe)

- `monitoring.html` gains a second stat row reading the same
  already-fetched `/actions/runs` data, filtered to the `Security Review`
  workflow: runs shown, pass, fail, latest — same real-API-only rule as
  the existing CI/CD stats, no new endpoint, no mocked data.

### Iteration 4 — False-positive feedback loop (repeat)

- `.github/workflows/security-policy-update.yml`: triggered on a
  `/security-fp <reason>` PR comment, appends a new precedent to
  `SECURITY-POLICY.md` and opens a PR against `main` with that change —
  a human still reviews and merges it (this repo's auto-merge gate still
  applies), same as Figma's agent-drafts / on-call-reviews pattern, just
  without the agent-authored patch part.

## Acceptance criteria

| # | Criterion | Verified by |
|---|-----------|-------------|
| 1 | `SECURITY-POLICY.md` exists and is passed to the action via both instruction inputs | `security-review.yml` diff |
| 2 | A real PR triggers a real scan that reads the policy (not a cache-skip) | Action log for that PR's `security` job |
| 3 | Eval fixtures exist, are excluded from `dist/`, and are documented as test-only | `security/eval-fixtures/`, `scripts/check-design-standards.js` unaffected |
| 4 | `monitoring.html` shows real pass/fail counts for the `Security Review` workflow | Manual check against `api.github.com` data |
| 5 | Commenting `/security-fp <reason>` on a PR opens a new PR appending that precedent | `docs/LOOP-LOG.md` real run evidence |

## Explicitly out of scope

- A custom TypeScript scanning service, provider failover/retry, or
  Datadog/Slack telemetry — the GitHub Action as shipped is sufficient at
  this scale.
- Dual-model adjudication (Figma runs both Claude Opus and GPT-5.6 per
  PR) — one model, one pass.
- Bug-bounty triage, a 66-case real-vulnerability recall corpus, or
  repo-wide sharded historical auditing — this is a handful of fixtures
  proving the mechanism, not a production recall floor.
- Sandboxed agent-authored fix PRs — the false-positive loop only ever
  edits `SECURITY-POLICY.md`, never application code, and always through
  a human-reviewed PR.
