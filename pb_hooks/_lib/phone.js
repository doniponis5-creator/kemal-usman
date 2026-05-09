// Phone normalization for Kyrgyzstan numbers.
// Used by otp.pb.js — extracted to _lib so it's accessible inside routerAdd callbacks.

module.exports = {
  normalizePhone(raw) {
    const d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('996') && d.length === 12) return '+' + d;
    if (d.length === 9) return '+996' + d;
    return '+' + d;
  }
};
