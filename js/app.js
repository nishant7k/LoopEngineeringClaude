// Iteration 2 — connection management.
// State machine: idle -> connecting -> (active | error) -> idle
// See specs/FEATURE-SPEC-realtime-feed.md section 1.

const HANDSHAKE_FAIL_RATE = 0.05;
const CONNECTING_DELAY_MS = 600;

const el = {
  connectBtn: document.getElementById("connect-btn"),
  statusDot: document.getElementById("status-dot"),
  statusLabel: document.getElementById("status-label"),
  emptyState: document.getElementById("empty-state"),
  feedList: document.getElementById("feed-list"),
  warningBanner: document.getElementById("warning-banner"),
};

let state = "idle"; // idle | connecting | active | error
let connectTimeout = null;

function setState(next) {
  state = next;
  el.statusDot.className = `status-dot status-${next}`;

  const labels = {
    idle: "Idle",
    connecting: "Connecting…",
    active: "Active",
    error: "Error — handshake failed",
  };
  el.statusLabel.textContent = labels[next];

  el.connectBtn.disabled = next === "connecting";
  el.connectBtn.textContent = next === "active" ? "Disconnect" : "Connect";

  if (next === "idle" || next === "error") {
    el.emptyState.hidden = false;
    el.feedList.hidden = true;
    el.emptyState.textContent =
      next === "error"
        ? "Connection failed. Click Connect to retry."
        : "Not connected. Click Connect to start the simulated feed.";
  } else if (next === "active") {
    el.emptyState.hidden = true;
    el.feedList.hidden = false;
  }
}

function connect() {
  setState("connecting");
  connectTimeout = setTimeout(() => {
    if (Math.random() < HANDSHAKE_FAIL_RATE) {
      setState("error");
      return;
    }
    setState("active");
  }, CONNECTING_DELAY_MS);
}

function disconnect() {
  clearTimeout(connectTimeout);
  setState("idle");
}

el.connectBtn.addEventListener("click", () => {
  if (state === "active") {
    disconnect();
  } else {
    connect();
  }
});

setState("idle");
