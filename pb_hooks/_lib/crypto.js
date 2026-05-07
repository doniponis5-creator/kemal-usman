// Tiny crypto helpers used by OTP hook.
// PocketBase JSVM exposes crypto via Goja — use $security.* helpers.

module.exports = {
  sha256(s) {
    return $security.hs256(s, ''); // HMAC-SHA256 with empty secret = sha256-equivalent for our use case
  },
  randomHex(n) {
    return $security.randomString(n);
  },
};
