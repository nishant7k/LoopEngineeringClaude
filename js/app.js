// Iteration 4 — feed management + polish (after state).
// See specs/FEATURE-SPEC-realtime-feed.md sections 4 and 5.

const HANDSHAKE_FAIL_RATE = 0.05;
const CONNECTING_DELAY_MS = 600;
const ITEM_INTERVAL_MIN_MS = 900;
const ITEM_INTERVAL_MAX_MS = 2200;
const WARNING_RATE = 0.08;
const WARNING_DURATION_MS = 2500;
const MAX_ITEMS = 200;

const el = {
  connectBtn: document.getElementById("connect-btn"),
  clearBtn: document.getElementById("clear-btn"),
  statusDot: document.getElementById("status-dot"),
  statusLabel: document.getElementById("status-label"),
  emptyState: document.getElementById("empty-state"),
  feedList: document.getElementById("feed-list"),
  warningBanner: document.getElementById("warning-banner"),
  itemCount: document.getElementById("item-count"),
  uptime: document.getElementById("uptime"),
};

let state = "idle"; // idle | connecting | active | error
let connectTimeout = null;
let feedTimer = null;
let warningTimeout = null;
let tickTimer = null;
let sequence = 0;
let itemTotal = 0;
let connectedAt = null;

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
  el.clearBtn.disabled = itemTotal === 0;

  if (next === "idle" || next === "error") {
    el.emptyState.hidden = false;
    el.feedList.hidden = true;
    el.emptyState.textContent =
      next === "error"
        ? "Connection failed. Click Connect to retry."
        : "Not connected. Click Connect to start the simulated feed.";
    el.uptime.textContent = "not connected";
  } else if (next === "active") {
    el.emptyState.hidden = true;
    el.feedList.hidden = false;
  }
}

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `up ${m}m ${s.toString().padStart(2, "0")}s`;
}

function relativeTime(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function updateItemCount() {
  el.itemCount.textContent = `${itemTotal} item${itemTotal === 1 ? "" : "s"}`;
  el.clearBtn.disabled = itemTotal === 0;
}

function appendItem() {
  sequence += 1;
  itemTotal += 1;
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

  while (el.feedList.children.length > MAX_ITEMS) {
    el.feedList.removeChild(el.feedList.lastChild);
  }
  updateItemCount();
}

function tick() {
  el.feedList.querySelectorAll(".feed-item").forEach((row) => {
    row.querySelector(".feed-rel").textContent = relativeTime(row.dataset.timestamp);
  });
  if (state === "active" && connectedAt) {
    el.uptime.textContent = formatUptime(Date.now() - connectedAt);
  }
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
  connectedAt = Date.now();
  scheduleNextItem();
  tickTimer = setInterval(tick, 1000);
}

function stopFeed() {
  clearTimeout(feedTimer);
  clearInterval(tickTimer);
  clearTimeout(warningTimeout);
  el.warningBanner.hidden = true;
  connectedAt = null;
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

function clearFeed() {
  el.feedList.innerHTML = "";
  itemTotal = 0;
  updateItemCount();
}

el.connectBtn.addEventListener("click", () => {
  if (state === "active") {
    disconnect();
  } else {
    connect();
  }
});

el.clearBtn.addEventListener("click", clearFeed);

setState("idle");
updateItemCount();
