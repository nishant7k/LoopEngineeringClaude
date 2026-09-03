#!/usr/bin/env node
// Design-standards gate for CI. Zero dependencies (plain Node), so it runs
// in a couple hundred ms — checks the design tokens and accessibility
// baseline this project has committed to, not a generic linter ruleset.

const fs = require("fs");

const REQUIRED_TOKENS = [
  "--bg", "--panel", "--panel-border", "--text", "--text-dim",
  "--accent", "--green", "--amber", "--red", "--gray", "--radius",
];

const failures = [];

function checkCssTokens() {
  const css = fs.readFileSync("css/styles.css", "utf8");
  const rootBlockMatch = css.match(/:root\s*{([^}]*)}/);
  const rootBlock = rootBlockMatch ? rootBlockMatch[1] : "";
  for (const token of REQUIRED_TOKENS) {
    if (!rootBlock.includes(`${token}:`)) {
      failures.push(`Missing required design token '${token}' in :root of css/styles.css`);
    }
  }
}

function checkButtonsHaveLabels(file) {
  const html = fs.readFileSync(file, "utf8");
  const buttonRe = /<button\b[^>]*>([\s\S]*?)<\/button>/g;
  let match;
  while ((match = buttonRe.exec(html)) !== null) {
    const inner = match[1].replace(/<[^>]+>/g, "").trim();
    if (!inner) {
      failures.push(`${file}: found a <button> with no visible text content (accessibility)`);
    }
  }
}

function checkLiveRegions(file) {
  const html = fs.readFileSync(file, "utf8");
  if (/id="status-label"/.test(html) && !/id="status-label"[^>]*aria-live/.test(html)) {
    failures.push(`${file}: #status-label is missing aria-live for screen-reader announcements`);
  }
}

checkCssTokens();
for (const file of ["index.html"]) {
  checkButtonsHaveLabels(file);
  checkLiveRegions(file);
}

if (failures.length > 0) {
  console.error("Design standards check FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`Design standards check passed (${REQUIRED_TOKENS.length} tokens, accessibility baseline OK).`);
