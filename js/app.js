// Iteration 8 — feature-flag-gated live ISS tracking.
// The feed's real data source (International Space Station live position,
// via wheretheiss.at — no key, CORS-enabled) is fully implemented but
// gated behind feature-flags.json#liveFeed. While the flag is false,
// Connect surfaces an explicit "awaiting" state instead of pretending the
// feature doesn't exist — this is the demo hook: flipping the flag (a
// real commit -> push -> CI -> deploy) is what the AIDLC loop does live.
// The flag is re-fetched (cache-busted) on every Connect click, so a tab
// left open during a live demo picks up a fresh deploy without a reload.

const CONNECTING_DELAY_MS = 300;
const ITEM_INTERVAL_MS = 3500;
const MAX_ITEMS = 200;

const FLAGS_URL = "./feature-flags.json";
const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";

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
  sourceLabel: document.getElementById("source-label"),
};

let state = "idle"; // idle | connecting | awaiting | active | error
let connectTimeout = null;
let feedTimer = null;
let tickTimer = null;
let itemTotal = 0;
let connectedAt = null;
let connectGeneration = 0;

function setState(next, detail) {
  state = next;
  el.statusDot.className = `status-dot status-${next}`;

  const labels = {
    idle: "Idle",
    connecting: "Connecting…",
    awaiting: "Awaiting feature",
    active: "Active — live ISS tracking",
    error: detail || "Error — could not reach the ISS API",
  };
  el.statusLabel.textContent = labels[next];

  const sourceLabels = {
    idle: "Source: not yet connected",
    connecting: "Source: checking feature status…",
    awaiting: "Source: not implemented yet",
    active: "Source: ISS live position — wheretheiss.at",
    error: "Source: unreachable",
  };
  if (el.sourceLabel) el.sourceLabel.textContent = sourceLabels[next];

  el.connectBtn.disabled = next === "connecting";
  el.connectBtn.textContent = next === "active" ? "Disconnect" : "Connect";
  el.clearBtn.disabled = itemTotal === 0;

  if (next === "idle" || next === "error" || next === "awaiting") {
    el.emptyState.hidden = false;
    el.feedList.hidden = true;
    el.uptime.textContent = "not connected";
    if (next === "awaiting") {
      el.emptyState.textContent =
        'This feature has not been implemented yet. Ask the AIDLC loop: "implement the live ISS tracking feed."';
    } else if (next === "error") {
      el.emptyState.textContent = "Connection failed — ISS API unreachable. Click Connect to retry.";
    } else {
      el.emptyState.textContent = "Not connected. Click Connect to start the live feed.";
    }
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

function relativeTime(epochMs) {
  const seconds = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function updateItemCount() {
  el.itemCount.textContent = `${itemTotal} item${itemTotal === 1 ? "" : "s"}`;
  el.clearBtn.disabled = itemTotal === 0;
}

function appendIssItem(pos) {
  itemTotal += 1;
  const epochMs = pos.timestamp * 1000;
  const row = document.createElement("div");
  row.className = "feed-item";
  row.dataset.epoch = String(epochMs);

  const lat = pos.latitude.toFixed(2);
  const lon = pos.longitude.toFixed(2);
  const altitudeM = Math.round(pos.altitude * 1000);
  const velocityMs = pos.velocity / 3.6; // km/h -> m/s
  const distanceSinceLastM = Math.round(velocityMs * (ITEM_INTERVAL_MS / 1000));

  const titleLink = document.createElement("a");
  titleLink.className = "feed-title";
  titleLink.href = `https://www.google.com/maps?q=${pos.latitude},${pos.longitude}`;
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  titleLink.textContent = `🛰️ ISS at ${lat}°, ${lon}°`;

  const metaSpan = document.createElement("span");
  metaSpan.className = "feed-hn-meta";
  metaSpan.textContent =
    `${altitudeM.toLocaleString()} m alt · ${Math.round(velocityMs).toLocaleString()} m/s · ` +
    `+${distanceSinceLastM.toLocaleString()} m since last update · ${pos.visibility}`;

  const relSpan = document.createElement("span");
  relSpan.className = "feed-rel";
  relSpan.textContent = "just now";

  row.appendChild(titleLink);
  row.appendChild(metaSpan);
  row.appendChild(relSpan);
  el.feedList.prepend(row);

  while (el.feedList.children.length > MAX_ITEMS) {
    el.feedList.removeChild(el.feedList.lastChild);
  }
  updateItemCount();
}

function showWarning(message) {
  el.warningBanner.hidden = false;
  el.warningBanner.textContent = message;
  setTimeout(() => { el.warningBanner.hidden = true; }, 2500);
}

function tick() {
  el.feedList.querySelectorAll(".feed-item").forEach((row) => {
    row.querySelector(".feed-rel").textContent = relativeTime(Number(row.dataset.epoch));
  });
  if (state === "active" && connectedAt) {
    el.uptime.textContent = formatUptime(Date.now() - connectedAt);
  }
}

function scheduleNextItem(generation) {
  feedTimer = setTimeout(async () => {
    if (state !== "active" || generation !== connectGeneration) return;
    try {
      const res = await fetch(ISS_URL);
      if (generation !== connectGeneration) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const pos = await res.json();
      if (generation !== connectGeneration) return;
      appendIssItem(pos);
    } catch (err) {
      if (generation !== connectGeneration) return;
      showWarning("Transient ISS API error — retrying.");
    }
    scheduleNextItem(generation);
  }, ITEM_INTERVAL_MS);
}

function startFeed(generation) {
  connectedAt = Date.now();
  scheduleNextItem(generation);
  tickTimer = setInterval(tick, 1000);
}

function stopFeed() {
  clearTimeout(feedTimer);
  clearInterval(tickTimer);
  el.warningBanner.hidden = true;
  connectedAt = null;
}

async function fetchFlags() {
  try {
    const res = await fetch(`${FLAGS_URL}?cachebust=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch (err) {
    return {};
  }
}

async function connect() {
  connectGeneration += 1;
  const generation = connectGeneration;
  setState("connecting");

  const flags = await fetchFlags();
  if (generation !== connectGeneration) return;

  if (!flags.liveFeed) {
    setState("awaiting");
    return;
  }

  connectTimeout = setTimeout(async () => {
    try {
      const res = await fetch(ISS_URL);
      if (generation !== connectGeneration) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const pos = await res.json();
      if (generation !== connectGeneration) return;
      setState("active");
      appendIssItem(pos);
      startFeed(generation);
    } catch (err) {
      if (generation !== connectGeneration) return;
      setState("error", `Error — ${err.message}`);
    }
  }, CONNECTING_DELAY_MS);
}

function disconnect() {
  connectGeneration += 1; // invalidate any in-flight fetches
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
