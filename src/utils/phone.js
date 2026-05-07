// Phone normalization — fixes the MyOrders "I don't see my orders" bug
// caused by comparing "+996 700 123 456" with "996700123456".
// Always store and compare the canonical form: '+996XXXXXXXXX'.

export function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('996') && d.length === 12) return '+' + d;
  if (d.length === 9) return '+996' + d;
  return '+' + d;
}

export function formatPhoneDisplay(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 12);
  if (d.length <= 3)  return '+' + d;
  if (d.length <= 6)  return '+' + d.slice(0, 3) + ' ' + d.slice(3);
  if (d.length <= 9)  return '+' + d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
  return '+' + d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6, 9) + ' ' + d.slice(9);
}

export function isValidKgPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length === 12 && d.startsWith('996');
}
