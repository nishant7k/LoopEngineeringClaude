// Iteration 7 — real Hacker News integration (live-implemented AIDLC demo).
// Replaces the simulated generator with the real data source the spec
// anticipated: see specs/FEATURE-SPEC-realtime-feed.md "Explicitly out of
// scope" — "swapping the simulated generator for a real source is a
// drop-in replacement of one function." This is that replacement.

const CONNECTING_DELAY_MS = 300;
const ITEM_INTERVAL_MIN_MS = 900;
const ITEM_INTERVAL_MAX_MS = 2200;
const MAX_ITEMS = 200;
const STORY_POOL_SIZE = 30;

const HN_TOPSTORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const hnItemUrl = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

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
let itemTotal = 0;
let connectedAt = null;
let storyQueue = [];
let connectGeneration = 0;

function setState(next, detail) {
  state = next;
  el.statusDot.className = `status-dot status-${next}`;

  const labels = {
    idle: "Idle",
    connecting: "Connecting…",
    active: "Active — live from Hacker News",
    error: detail || "Error — could not reach Hacker News",
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
        ? "Connection failed — Hacker News API unreachable. Click Connect to retry."
        : "Not connected. Click Connect to start the live Hacker News feed.";
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

function relativeTime(epochMs) {
  const seconds = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function updateItemCount() {
  el.itemCount.textContent = `${itemTotal} item${itemTotal === 1 ? "" : "s"}`;
  el.clearBtn.disabled = itemTotal === 0;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function appendStoryItem(story) {
  itemTotal += 1;
  const epochMs = story.time * 1000;
  const row = document.createElement("div");
  row.className = "feed-item";
  row.dataset.epoch = String(epochMs);

  const titleLink = document.createElement("a");
  titleLink.className = "feed-title";
  titleLink.href = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  titleLink.textContent = story.title || "(untitled)";

  const metaSpan = document.createElement("span");
  metaSpan.className = "feed-hn-meta";
  metaSpan.textContent = `${story.score ?? 0} pts · by ${story.by || "unknown"}`;

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
  clearTimeout(warningTimeout);
  warningTimeout = setTimeout(() => {
    el.warningBanner.hidden = true;
  }, 2500);
}

function tick() {
  el.feedList.querySelectorAll(".feed-item").forEach((row) => {
    row.querySelector(".feed-rel").textContent = relativeTime(Number(row.dataset.epoch));
  });
  if (state === "active" && connectedAt) {
    el.uptime.textContent = formatUptime(Date.now() - connectedAt);
  }
}

async function fetchNextStory(generation) {
  if (storyQueue.length === 0) {
    storyQueue = shuffle(storyQueue.length ? storyQueue : []);
  }
  const id = storyQueue.shift();
  if (id === undefined) return null;
  const res = await fetch(hnItemUrl(id));
  if (generation !== connectGeneration) return null; // connection state changed mid-fetch
  if (!res.ok) throw new Error(`HN item fetch failed: HTTP ${res.status}`);
  const story = await res.json();
  return story;
}

function scheduleNextItem(generation, pool) {
  const delay = ITEM_INTERVAL_MIN_MS + Math.random() * (ITEM_INTERVAL_MAX_MS - ITEM_INTERVAL_MIN_MS);
  feedTimer = setTimeout(async () => {
    if (state !== "active" || generation !== connectGeneration) return;
    if (storyQueue.length === 0) {
      storyQueue = shuffle(pool);
    }
    try {
      const story = await fetchNextStory(generation);
      if (generation !== connectGeneration) return;
      if (story && story.title) {
        appendStoryItem(story);
      }
    } catch (err) {
      if (generation !== connectGeneration) return;
      showWarning("Transient Hacker News API error — retrying.");
    }
    scheduleNextItem(generation, pool);
  }, delay);
}

function startFeed(generation, pool) {
  connectedAt = Date.now();
  storyQueue = shuffle(pool);
  scheduleNextItem(generation, pool);
  tickTimer = setInterval(tick, 1000);
}

function stopFeed() {
  clearTimeout(feedTimer);
  clearInterval(tickTimer);
  clearTimeout(warningTimeout);
  el.warningBanner.hidden = true;
  connectedAt = null;
}

async function connect() {
  connectGeneration += 1;
  const generation = connectGeneration;
  setState("connecting");

  connectTimeout = setTimeout(async () => {
    try {
      const res = await fetch(HN_TOPSTORIES_URL);
      if (generation !== connectGeneration) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ids = await res.json();
      if (generation !== connectGeneration) return;
      const pool = ids.slice(0, STORY_POOL_SIZE);
      if (pool.length === 0) throw new Error("empty story list");
      setState("active");
      startFeed(generation, pool);
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
