// ─── Local Notifications Service ─────────────────────────────────────────────
// Uses @capacitor/local-notifications for in-app triggered notifications.
// Falls back gracefully on web (browser Notification API) and when permissions
// are denied — callers never need to worry about platform checks.
//
// All notification text is in Russian (primary audience: Bishkek, Kyrgyzstan).

let LocalNotifications = null;
let permissionGranted = false;
let idCounter = 1;

// ─── Init: import Capacitor plugin or fall back to Web API ───────────────────
async function init() {
  if (LocalNotifications) return;
  try {
    // Dynamic import with variable to prevent Rolldown from resolving at build time
    const capLocalNotif = '@capacitor/local-notifications';
    const mod = await import(/* @vite-ignore */ capLocalNotif);
    LocalNotifications = mod.LocalNotifications;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'granted') {
      permissionGranted = true;
    } else if (perm.display !== 'denied') {
      const req = await LocalNotifications.requestPermissions();
      permissionGranted = req.display === 'granted';
    }
  } catch {
    // Capacitor not available (web) — try browser Notification API
    LocalNotifications = null;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { const r = await Notification.requestPermission(); permissionGranted = r === 'granted'; } catch { /* ignore */ }
    } else if (typeof Notification !== 'undefined') {
      permissionGranted = Notification.permission === 'granted';
    }
  }
}

// ─── Core: schedule a single local notification ──────────────────────────────
async function notify(title, body, extra = {}) {
  await init();
  if (!permissionGranted) return;

  const id = idCounter++;

  if (LocalNotifications) {
    // Native (iOS/Android)
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title,
          body,
          id,
          schedule: { at: new Date(Date.now() + 100) }, // immediate
          sound: 'default',
          smallIcon: 'ic_stat_notify',
          largeIcon: 'ic_launcher',
          extra: extra || {},
        }],
      });
    } catch (e) {
      console.warn('[notify] schedule error:', e);
    }
  } else if (typeof Notification !== 'undefined' && permissionGranted) {
    // Web fallback
    try {
      new Notification(title, { body, icon: '/favicon-192.png' });
    } catch { /* ignore */ }
  }
}

// ─── Convenience helpers — all status/event notifications ────────────────────

/** Zakaz yaratildi */
export function notifyOrderCreated(orderId, total, payMethod) {
  const payLabel = payMethod === 'odengi' ? 'O!Деньги' : 'Наличные';
  notify(
    '🛍 Заказ оформлен!',
    `Заказ №${orderId} на сумму ${total.toLocaleString()} сом (${payLabel}) успешно создан.`,
    { type: 'order_created', orderId }
  );
}

/** Status o'zgardi — klient uchun */
export function notifyOrderStatus(orderId, status, total) {
  const messages = {
    confirmed: {
      title: '✅ Заказ подтверждён',
      body: `Ваш заказ №${orderId} подтверждён! Мы уже готовим его для вас.`,
    },
    preparing: {
      title: '📦 Заказ готовится',
      body: `Заказ №${orderId} в процессе сборки. Совсем скоро будет готов!`,
    },
    delivering: {
      title: '🚗 Заказ в пути!',
      body: `Курьер уже в пути с вашим заказом №${orderId}. Держите телефон включённым.`,
    },
    delivered: {
      title: '🎉 Заказ доставлен!',
      body: `Заказ №${orderId} (${total?.toLocaleString() || ''} сом) доставлен. Спасибо за покупку!`,
    },
    cancelled: {
      title: '😔 Заказ отменён',
      body: `К сожалению, заказ №${orderId} был отменён. Напишите нам, если есть вопросы.`,
    },
  };
  const msg = messages[status];
  if (msg) notify(msg.title, msg.body, { type: 'order_status', orderId, status });
}

/** Admin uchun — yangi zakaz keldi */
export function notifyAdminNewOrder(orderId, clientName, total, payMethod) {
  const payLabel = payMethod === 'odengi' ? 'O!Деньги' : 'Наличные';
  notify(
    '🆕 Новый заказ!',
    `${clientName} — №${orderId}, ${total.toLocaleString()} сом (${payLabel})`,
    { type: 'admin_new_order', orderId }
  );
}

/** MBank to'lov kutilmoqda */
export function notifyPaymentPending(orderId, bankName) {
  notify(
    '💳 Ожидание оплаты',
    `Заказ №${orderId} — ожидаем подтверждение оплаты через ${bankName}.`,
    { type: 'payment_pending', orderId }
  );
}

/** To'lov tasdiqlandi */
export function notifyPaymentConfirmed(orderId, bankName) {
  notify(
    '✅ Оплата подтверждена',
    `Оплата заказа №${orderId} через ${bankName} успешно подтверждена!`,
    { type: 'payment_confirmed', orderId }
  );
}

/** Bonus qo'shildi (cashback) */
export function notifyBonusEarned(amount) {
  notify(
    '🎁 Бонус начислен!',
    `Вам начислено ${amount} бонусных баллов. Используйте их при следующей покупке!`,
    { type: 'bonus_earned' }
  );
}

/** Welcome bonus */
export function notifyWelcomeBonus(amount) {
  notify(
    '🎉 Добро пожаловать!',
    `Вам начислен приветственный бонус: ${amount} баллов! Используйте при первой покупке.`,
    { type: 'welcome_bonus' }
  );
}

/** Referral bonus */
export function notifyReferralBonus(amount, isReferrer) {
  notify(
    '🤝 Реферальный бонус!',
    isReferrer
      ? `Ваш друг сделал заказ! Вам начислено ${amount} бонусных баллов.`
      : `Вы получили ${amount} бонусных баллов по реферальному коду!`,
    { type: 'referral_bonus' }
  );
}

/** Aksiya / sale boshlandi */
export function notifySaleStarted(productName, percent) {
  notify(
    '🔥 Акция!',
    `${productName} — скидка ${percent}%! Успейте купить по выгодной цене.`,
    { type: 'sale_started' }
  );
}

/** Yangi tovar qo'shildi */
export function notifyNewProduct(productName) {
  notify(
    '✨ Новинка!',
    `${productName} уже в каталоге! Посмотрите прямо сейчас.`,
    { type: 'new_product' }
  );
}

/** Admin: otziv keldi */
export function notifyNewReview(clientName, rating) {
  const stars = '⭐'.repeat(Math.min(5, Math.max(1, rating)));
  notify(
    '💬 Новый отзыв!',
    `${clientName} оставил отзыв ${stars}. Проверьте и одобрите в настройках.`,
    { type: 'new_review' }
  );
}

/** Korzina eslatma (abandoned cart reminder) — 2 soatdan keyin */
export async function scheduleCartReminder(itemCount) {
  await init();
  if (!permissionGranted || !LocalNotifications) return;
  // Cancel any existing cart reminder first
  try { await LocalNotifications.cancel({ notifications: [{ id: 99999 }] }); } catch { /* ignore */ }
  try {
    await LocalNotifications.schedule({
      notifications: [{
        title: '🛒 Не забудьте о корзине!',
        body: `У вас ${itemCount} ${itemCount === 1 ? 'товар' : itemCount < 5 ? 'товара' : 'товаров'} в корзине. Оформите заказ, пока всё в наличии!`,
        id: 99999,
        schedule: { at: new Date(Date.now() + 2 * 60 * 60 * 1000) }, // 2 hours
        sound: 'default',
        extra: { type: 'cart_reminder' },
      }],
    });
  } catch { /* ignore */ }
}

/** Korzina eslatmasini bekor qilish */
export async function cancelCartReminder() {
  await init();
  if (!LocalNotifications) return;
  try { await LocalNotifications.cancel({ notifications: [{ id: 99999 }] }); } catch { /* ignore */ }
}

// Auto-init on module load
init().catch(() => {});

export default {
  notifyOrderCreated,
  notifyOrderStatus,
  notifyAdminNewOrder,
  notifyPaymentPending,
  notifyPaymentConfirmed,
  notifyBonusEarned,
  notifyWelcomeBonus,
  notifyReferralBonus,
  notifySaleStarted,
  notifyNewProduct,
  notifyNewReview,
  scheduleCartReminder,
  cancelCartReminder,
};
