// O!Деньги payment API — frontend helper.
// All actual API calls go through PocketBase hooks (server-side) for security.
import { PB_URL, pb } from './pb';

async function pbFetch(path, body) {
  // SECURITY: custom odengi endpoints now require a valid PB auth token.
  // The server verifies the caller owns the order before doing anything.
  const headers = { 'Content-Type': 'application/json' };
  if (pb.authStore.isValid) headers.Authorization = pb.authStore.token;
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

/**
 * Create O!Деньги invoice for an order.
 * @param {string} orderId — PocketBase order ID
 * @returns {{ invoiceId, paylink_url, qr_url, link_app, site_pay }}
 */
export async function createOdengiInvoice(orderId) {
  return pbFetch('/api/custom/odengi/create-invoice', { orderId });
}

/**
 * Check payment status for an order.
 * @param {string} orderId — PocketBase order ID
 * @returns {{ paymentApproved, status, orderStatus, paymentStatus }}
 */
export async function checkOdengiStatus(orderId) {
  return pbFetch('/api/custom/odengi/check-status', { orderId });
}

/**
 * Cancel O!Деньги invoice for an order.
 * @param {string} orderId — PocketBase order ID
 */
export async function cancelOdengiInvoice(orderId) {
  return pbFetch('/api/custom/odengi/cancel', { orderId });
}

/**
 * Poll payment status until approved, canceled, or timeout.
 * @param {string} orderId
 * @param {object} opts — { intervalMs=3000, timeoutMs=300000, onStatus }
 * @returns {Promise<boolean>} true if paid
 */
export function pollOdengiPayment(orderId, opts = {}) {
  const interval = opts.intervalMs || 3000;
  const timeout = opts.timeoutMs || 300000;
  const onStatus = opts.onStatus || (() => {});

  return new Promise((resolve) => {
    const start = Date.now();
    let timer;

    const check = async () => {
      try {
        const result = await checkOdengiStatus(orderId);
        onStatus(result);

        if (result.paymentApproved) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (result.paymentStatus === 'odengi_canceled') {
          clearInterval(timer);
          resolve(false);
          return;
        }
      } catch (e) {
        console.warn('O!Деньги poll error:', e);
      }

      if (Date.now() - start > timeout) {
        clearInterval(timer);
        resolve(false);
      }
    };

    timer = setInterval(check, interval);
    check();
  });
}
