# Security review policy

This is this repo's threat model, in the sense
[Figma's security-agent post](https://www.figma.com/blog/how-figma-stays-ahead-of-vulnerabilities-with-agents/)
means it: not a list of generic rules, but a living set of precedents —
contextual reasoning for why a given pattern in *this* codebase is or
isn't a real vulnerability. It's fed to
[`anthropics/claude-code-security-review`](https://github.com/anthropics/claude-code-security-review)
on every PR (see `.github/workflows/security-review.yml`) as both scan
context and false-positive filtering guidance.

New precedents get appended here — by hand, or automatically via a
`/security-fp <reason>` PR comment (see
`.github/workflows/security-policy-update.yml`) — whenever a real finding
turns out to be a false positive for a reason not yet captured below.
Every addition should explain **why**, the same way the entries below do,
so the next scan (and the next reviewer) can reuse the reasoning instead
of re-litigating it.

## Precedents

- **The GitHub PAT field in `monitoring.html` is not a credential leak.**
  It's a password-type `<input>` the user types into themselves; the
  value is stored only in that browser's own `localStorage` and sent only
  to `api.github.com` over HTTPS. There is no app server here — this is a
  static site — so there is nothing else the token could be exfiltrated
  to. Only flag this pattern if a change makes the token reachable from a
  third-party origin, a log line, or an error message.

- **`feature-flags.json` is public, non-secret config, not attack
  surface.** It's fetched over plain HTTP by static clients and today
  contains exactly one boolean (`liveFeed`). Treat additions to this file
  as ordinary config unless a new key introduces something executable
  (e.g., a URL that gets fetched-and-`eval`'d, or an HTML string that gets
  assigned to `innerHTML`).

- **`el.innerHTML = ""` is not an XSS sink.** Assigning the empty string
  clears a node; it can't inject anything regardless of what any other
  variable in scope contains. This pattern appears in `js/app.js`,
  `js/globe.js`, `loop-live.html`, and `monitoring.html` purely to reset
  DOM content between renders. Only flag `innerHTML` assignments that
  interpolate untrusted or remote data into the string.

- **The `sed`-based cache-busting step in `ci-cd.yml` is not injection.**
  It rewrites `src`/`href` on local `js/*.js` and `css/*.css` references
  with `?v=<short-sha>`, where the SHA comes from `$GITHUB_SHA` — a value
  GitHub itself sets for the triggering commit, not user-controllable
  input. Don't flag interpolating it into the `sed` expression as command
  or regex injection.

- **`scripts/*.sh` never hardcode a GitHub credential.** They all
  authenticate via the operator's own `gh auth login` session (OS
  keychain-backed). Missing explicit token handling in these scripts is
  the intended design, not an omission.

- **The public API calls in `js/app.js` are not SSRF risk.** All of
  `api.wheretheiss.at`, `api.bigdatacloud.net`, and
  `hacker-news.firebaseio.com` are unauthenticated, keyless, CORS-enabled,
  read-only endpoints, and every URL is a hardcoded constant — none are
  built from user or query input. Don't flag these as unvalidated
  outbound requests.

<!-- new-precedents-appended-below -->
