// O!Деньги payment API — frontend helper.
import { PB_URL, pb } from './pb';

async function pbFetch(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  let token = pb.authStore.isValid ? pb.authStore.token : null;
  if (!token) {
    try {
      const raw = localStorage.getItem('pocketbase_auth');
      if (raw) token = JSON.parse(raw).token;
    } catch (_) {}
  }
  if (token) headers.Authorization = token;
  const res = await fetch(PB_URL + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export async function createOdengiInvoice(orderId) {
  return pbFetch('/api/custom/odengi/create-invoice', { orderId });
}

export async function cancelOdengiInvoice(orderId) {
  return pbFetch('/api/custom/odengi/cancel', { orderId });
}

export async function pollOdengiPayment(orderId, options = {}) {
  const intervalMs = options.intervalMs || 3000;
  const timeoutMs  = options.timeoutMs  || 300000;
  const onStatus   = options.onStatus   || (() => {});
  return new Promise((resolve) => {
    const started = Date.now();
    let timer;
    const check = async () => {
      try {
        const data = await pbFetch('/api/custom/odengi/check-status', { orderId });
        onStatus(data);
        if (data.paymentApproved) { clearInterval(timer); resolve(true); return; }
        if (data.paymentStatus === 'odengi_canceled') { clearInterval(timer); resolve(false); return; }
      } catch (e) { console.warn('O!Деньги poll error:', e); }
      if (Date.now() - started > timeoutMs) { clearInterval(timer); resolve(false); }
    };
    timer = setInterval(check, intervalMs);
    check();
  });
}
