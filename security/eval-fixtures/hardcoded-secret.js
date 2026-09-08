// TEST FIXTURE — intentionally vulnerable, not part of the real app.
// See security/eval-fixtures/README.md: exists only to verify the
// security scanner still catches this bug class after policy edits.
// Never imported, never bundled, never deployed. This is a fake,
// non-functional placeholder value, not a real credential.

// Vulnerability: a payment-provider API credential committed directly
// to source instead of read from an environment variable or secret
// store. Deliberately not shaped like any real vendor's key format
// (GitHub push protection blocks those on push) — the point is the
// hardcoded-secret pattern itself, not a specific vendor's prefix.
const PAYMENTS_API_KEY = "REPLACE_ME_WITH_ENV_LOOKUP_NOT_A_REAL_FIXTURE_VALUE";

function chargeCard(token, amountCents) {
  return fetch("https://api.example.com/v1/charges", {
    method: "POST",
    headers: { Authorization: `Bearer ${PAYMENTS_API_KEY}` },
    body: JSON.stringify({ token, amount: amountCents }),
  });
}

module.exports = { chargeCard };
