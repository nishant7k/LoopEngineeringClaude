// Iteration 3 — live data stream with timestamps + status indicators.
// See specs/FEATURE-SPEC-realtime-feed.md sections 2 and 3.

const HANDSHAKE_FAIL_RATE = 0.05;
const CONNECTING_DELAY_MS = 600;
const ITEM_INTERVAL_MIN_MS = 900;
const ITEM_INTERVAL_MAX_MS = 2200;
const WARNING_RATE = 0.08;
const WARNING_DURATION_MS = 2500;

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
let feedTimer = null;
let warningTimeout = null;
let relativeTimeTimer = null;
let sequence = 0;

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

function relativeTime(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function appendItem() {
  sequence += 1;
  const ts = new Date().toISOString();
  const row = document.createElement("div");
  row.className = "feed-item";
  row.dataset.timestamp = ts;
  row.innerHTML = `
    <span class="feed-seq">#${sequence}</span>
    <span class="feed-ts">${ts}</span>
    <span class="feed-rel">just now</span>
  `;
  el.feedList.prepend(row);
}

function tickRelativeTimes() {
  el.feedList.querySelectorAll(".feed-item").forEach((row) => {
    const relEl = row.querySelector(".feed-rel");
    relEl.textContent = relativeTime(row.dataset.timestamp);
  });
}

function maybeShowWarning() {
  if (Math.random() >= WARNING_RATE) return;
  el.warningBanner.hidden = false;
  el.warningBanner.textContent = "Transient network jitter detected — feed still active.";
  clearTimeout(warningTimeout);
  warningTimeout = setTimeout(() => {
    el.warningBanner.hidden = true;
  }, WARNING_DURATION_MS);
}

function scheduleNextItem() {
  const delay = ITEM_INTERVAL_MIN_MS + Math.random() * (ITEM_INTERVAL_MAX_MS - ITEM_INTERVAL_MIN_MS);
  feedTimer = setTimeout(() => {
    if (state !== "active") return;
    appendItem();
    maybeShowWarning();
    scheduleNextItem();
  }, delay);
}

function startFeed() {
  scheduleNextItem();
  relativeTimeTimer = setInterval(tickRelativeTimes, 1000);
}

function stopFeed() {
  clearTimeout(feedTimer);
  clearInterval(relativeTimeTimer);
  clearTimeout(warningTimeout);
  el.warningBanner.hidden = true;
}

function connect() {
  setState("connecting");
  connectTimeout = setTimeout(() => {
    if (Math.random() < HANDSHAKE_FAIL_RATE) {
      setState("error");
      return;
    }
    setState("active");
    startFeed();
  }, CONNECTING_DELAY_MS);
}

function disconnect() {
  clearTimeout(connectTimeout);
  stopFeed();
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
