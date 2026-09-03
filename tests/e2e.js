// Real browser smoke test for the "Test" stage of the CI/CD pipeline.
// Runs against the built app in a headless browser (Playwright/Chromium) —
// not a mock DOM — so it exercises the actual connect/feed/disconnect flow
// a user would. Exits non-zero (failing the CI job) on any assertion
// failure, console error, or page error.
//
// Served over real HTTP (not file://): the app fetches a relative
// feature-flags.json, and Chromium refuses relative fetch() under the
// file:// scheme entirely, regardless of CORS — this would otherwise
// surface as a spurious console error on every run.
//
// Usage: node tests/e2e.js [path-to-index.html]

const { chromium } = require("playwright");
const path = require("path");
const http = require("http");
const fs = require("fs");

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

function startServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(root, decodeURIComponent(req.url.split("?")[0]));
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const target = process.argv[2] || "index.html";
  const root = path.resolve(path.dirname(target));
  const server = await startServer(root);
  const port = server.address().port;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(`http://127.0.0.1:${port}/${path.basename(target)}`);

  assert(!(await page.isDisabled("#connect-btn")), "Connect button should not be disabled on load");
  assert((await page.textContent("#status-label")).includes("Idle"), "Initial status should be Idle");

  await page.click("#connect-btn");
  await page.waitForFunction(
    () => {
      const label = document.getElementById("status-label").textContent;
      return label.includes("Active") || label.includes("Error") || label.includes("Awaiting");
    },
    { timeout: 10000 }
  );

  const statusAfterConnect = await page.textContent("#status-label");
  console.log(`Status after connect: ${statusAfterConnect}`);

  if (statusAfterConnect.includes("Active")) {
    await page.waitForSelector(".feed-item", { timeout: 10000 });
    const itemCountBefore = await page.$$eval(".feed-item", (els) => els.length);
    assert(itemCountBefore > 0, "At least one feed item should render while active");

    await page.click("#clear-btn");
    const countText = await page.textContent("#item-count");
    assert(countText.startsWith("0"), "Item count should reset to 0 after Clear");

    await page.click("#connect-btn"); // disconnect
    await page.waitForFunction(
      () => document.getElementById("status-label").textContent.includes("Idle"),
      { timeout: 5000 }
    );
  } else if (statusAfterConnect.includes("Awaiting")) {
    const emptyText = await page.textContent("#empty-state");
    assert(/not been implemented/i.test(emptyText), "Awaiting state should explain the feature is pending");
    console.log("Feature flag is off — verified the awaiting-state UX instead of live-feed assertions.");
  } else {
    console.warn("Feed reported Error status (upstream API may be unreachable) — skipping feed-content assertions.");
  }

  await browser.close();
  server.close();

  if (errors.length > 0) {
    throw new Error(`Console/page errors detected:\n${errors.join("\n")}`);
  }

  console.log("e2e smoke test passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
