# Feature Spec — Real-Time Data Feed

## Problem

The app ships with a placeholder panel for a "real-time feed" that does
nothing. This spec defines what "done" looks like so the AIDLC loop has a
concrete target and a way to tell before-state from after-state.

## Before state (iteration 0)

- A "Connect" button exists but is `disabled`.
- The feed panel renders static text: "Real-time feed — not yet implemented."
- No status indicator, no data, no controls.

## After state (target)

### 1. Connection management
- A "Connect" / "Disconnect" toggle button drives the feed on and off.
- Connecting transitions through `connecting → active` (or `→ error` if the
  simulated handshake fails, ~5% of attempts, to exercise the error path).
- Disconnecting stops new items immediately and returns to `idle`.

### 2. Live data stream with timestamps
- While `active`, a new feed item is appended on a randomized interval
  (900–2200ms) with an ISO-8601 timestamp and a monotonically increasing
  sequence number.
- Each item shows a relative time ("2s ago") that updates live.

### 3. Status indicators
- A status dot + label reflects one of four states: `idle` (gray),
  `connecting` (amber, pulsing), `active` (green, pulsing), `error` (red).
- Occasional simulated transient warnings (`warning` sub-state) surface as
  a non-blocking banner without dropping the connection.

### 4. Feed management
- "Clear" empties the feed without disconnecting.
- The feed caps at 200 rendered items (oldest pruned) to bound DOM growth.
- Item count and connection uptime are shown in the panel header.

### 5. Polish
- State transitions animate (fade/slide-in for new items, color transition
  for the status dot).
- Fully keyboard-operable controls; status changes are announced via
  `aria-live="polite"`.

## Acceptance criteria

| # | Criterion | Verified by |
|---|-----------|-------------|
| 1 | Connect button is enabled and toggles state | Manual check in `docs/LOOP-LOG.md` |
| 2 | Feed items appear only while `active`, each with a real timestamp | Manual check |
| 3 | All four status states are reachable and visually distinct | Manual check |
| 4 | Clear empties the list; item count reflects reality | Manual check |
| 5 | No console errors; works with keyboard only | Manual check |

## Explicitly out of scope for this PoC

- A real backend/WebSocket server — the feed is simulated client-side and
  labeled as such in the UI. Swapping the simulated generator for a real
  `WebSocket`/SSE source is a drop-in replacement of one function
  (`js/app.js#startFeed`) and does not change the spec above.

## Iteration 7 — real data source (fulfills the note above)

The simulated generator was replaced with the Hacker News public Firebase
API (`hacker-news.firebaseio.com`, no key required, CORS-enabled):

- **Connect** performs a real handshake: fetches `topstories.json`. Success
  → `active`; a genuine network/HTTP failure → `error` (no more artificial
  5% fail rate — the error state is only reachable for real now).
  - Each feed item is a real story: title (links to the real article or
    HN discussion), score, author, and a real relative timestamp derived
    from the story's actual `time` field.
  - Acceptance criteria 1–5 from the table above still hold; timestamps and
  content are now real rather than synthetic, which the original spec
  already anticipated and did not require changing.
