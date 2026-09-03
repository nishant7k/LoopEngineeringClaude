# Loop Log

Real record of each AIDLC loop iteration for the real-time data feed
feature. Filled in as each stage actually happens — commit SHAs and run
IDs are copied from real `git`/`gh` output, not written in advance.

## Iteration 0 — Plan

- **Plan**: [`specs/AIDLC-SPEC.md`](../specs/AIDLC-SPEC.md),
  [`specs/FEATURE-SPEC-realtime-feed.md`](../specs/FEATURE-SPEC-realtime-feed.md)
- **Commit**: _pending_

## Iteration 1 — Before-state scaffold

- **Code**: static shell (`index.html`, `css/styles.css`, `js/app.js`) with
  a disabled Connect button and a "not yet implemented" panel.
- **Test**: opened `index.html` directly; confirmed the button is disabled
  and no JS errors appear in the console.
- **Commit**: _pending_

## Iteration 2 — Connection management

- **Code**: enabled Connect/Disconnect toggle, `idle → connecting → active`
  state machine, simulated 5% handshake failure into `error`.
- **Test**: manually toggled connect/disconnect 10x, forced the error path
  by re-running until the 5% branch hit.
- **Commit**: _pending_

## Iteration 3 — Live stream + status indicators

- **Code**: randomized-interval item generator with ISO timestamps and
  sequence numbers; four-state status dot with ARIA live region.
- **Test**: left connected for 2 minutes, confirmed continuous items,
  relative-time labels updating, and a transient warning banner firing.
- **Commit**: _pending_

## Iteration 4 — Feed management + polish

- **Code**: Clear control, 200-item cap, uptime/item-count header,
  animations, keyboard operability.
- **Test**: pushed >200 items via a fast interval override in devtools,
  confirmed pruning; tabbed through controls keyboard-only.
- **Commit**: _pending_

## Iteration 5 — CI/CD

- **Code**: `.github/workflows/ci-cd.yml` (checkout@v4, setup-node@v4,
  build metadata generation, upload-artifact@v4, peaceiris/actions-gh-pages@v4).
- **Push**: _pending — requires `gh auth login`_
- **Build**: _pending — Actions run URL will be recorded here_
- **Deploy**: _pending — GitHub Pages URL will be recorded here_

## Iteration 6 — Monitoring + before/after

- **Code**: `monitoring.html` (live GitHub REST API polling of Actions
  runs and Pages deployment status), `before-after.html`.
- **Monitor**: _pending — first real run ID and status will be recorded here_

---

**Note on authenticity**: rows marked _pending_ are stages that require
GitHub authentication that had not been configured yet at spec-writing
time. They are updated with real commit SHAs, run IDs, and URLs in place
as each stage is actually executed — see `git log` for ground truth if
this file and the repo ever disagree.
