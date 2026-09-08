# Security-scanner recall fixtures

These files are **intentionally vulnerable test fixtures**. None of them
are imported by the real app (`index.html`, `js/app.js`, etc.), none are
copied into `dist/` by `ci-cd.yml`'s build step (which lists the real
app files explicitly — see the `Assemble dist` step), and none affect
`scripts/check-design-standards.js` or `tests/e2e.js` (both target
`index.html` only). They exist for one purpose: proving the security
scanner still catches known bug classes after `SECURITY-POLICY.md` gets
edited.

This is a scaled-down stand-in for the "recall floor" Figma's post
describes — they replay 66 real vulnerabilities against every scanner
change; this repo has 3 synthetic ones. Same idea, demo scale. See
`specs/FEATURE-SPEC-security-loop.md` for the full context.

## Running the recall check

The security-review action is diff-aware — it only scans files a PR
actually touches. So to check recall:

1. Branch from `main`, touch **only** files under `security/eval-fixtures/`
   (e.g. bump this README, or re-save a fixture unchanged to force a new
   diff hash — the action skips a rescan if it thinks nothing changed).
2. Open a PR. Watch the `security` check.
3. Confirm it reports 3 findings — one per fixture below — each matching
   the vulnerability class in the filename.
4. **Close the PR without merging.** These fixtures must never land in
   `main`'s history as "real" code, and the whole point is a scan that
   flags them, not a merge that ships them.

If a scan comes back with fewer than 3 findings after a `SECURITY-POLICY.md`
edit, the edit was too broad — a precedent meant to suppress one false
positive is now suppressing a real bug class. Narrow it and rerun.

## Fixtures

| File | Vulnerability class |
|------|---------------------|
| `command-injection.js` | OS command injection via unsanitized `child_process.exec` |
| `reflected-xss.html` | Reflected XSS via unsanitized `innerHTML` from a URL parameter |
| `hardcoded-secret.js` | Hardcoded API credential committed to source |
