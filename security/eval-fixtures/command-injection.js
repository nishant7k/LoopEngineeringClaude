// TEST FIXTURE — intentionally vulnerable, not part of the real app.
// See security/eval-fixtures/README.md: exists only to verify the
// security scanner still catches this bug class after policy edits.
// Never imported, never bundled, never deployed.

const { exec } = require("child_process");

// Vulnerability: unsanitized user input concatenated directly into a
// shell command. An attacker-controlled `hostname` like
// "example.com; rm -rf /" executes arbitrary shell commands.
function pingHost(hostname) {
  exec(`ping -c 1 ${hostname}`, (err, stdout) => {
    console.log(stdout);
  });
}

module.exports = { pingHost };
