// PocketBase API wrapper — extracted from App.jsx (P2.1).
// CONTRACT: never rename existing api.* methods or change return shapes.
import { pb, PB_URL } from "./pb";

// ─── POCKETBASE API ────────────────────────────────────────────────────────────
export const api = {
  // Products
  getProducts: () => pb.collection("products").getFullList({ sort: "created", requestKey: null }),
  createProduct: (data) => pb.collection("products").create(data, { requestKey: null }),
  updateProduct: (id, data) => pb.collection("products").update(id, data, { requestKey: null }),
  deleteProduct: (id) => pb.collection("products").delete(id, { requestKey: null }),
  // FIX (CRITICAL): use env-driven PB_URL — was hardcoded HTTP, would break on HTTPS migration.
  getImageUrl: (record, filename) => `${PB_URL}/api/files/products/${record.id}/${filename}`,

  // Orders
  getOrders: () => pb.collection("orders").getFullList({ sort: "-created", requestKey: null }),
  createOrder: (data) => pb.collection("orders").create(data, { requestKey: null }),
  updateOrder: (id, data) => pb.collection("orders").update(id, data, { requestKey: null }),
  deleteOrder: (id) => pb.collection("orders").delete(id, { requestKey: null }),

  // Clients
  getClients: () => pb.collection("clients").getFullList({ sort: "-created", requestKey: null }),
  createClient: (data) => pb.collection("clients").create(data, { requestKey: null }),
  updateClient: (id, data) => pb.collection("clients").update(id, data, { requestKey: null }),
  // Reviews
  getReviews: () => pb.collection("reviews").getFullList({ sort: "-created", requestKey: null }),
  createReview: (data) => pb.collection("reviews").create(data, { requestKey: null }),
  updateReview: (id, data) => pb.collection("reviews").update(id, data, { requestKey: null }),
  deleteReview: (id) => pb.collection("reviews").delete(id, { requestKey: null }),

  // ─── Site Media (shared images — visible to ALL users) ─────────
  // Collection: site_media { key(text,unique), file(file) }
  // Used for: instagramScreen, instaStories, etc.
  getSiteMedia: async (key) => {
    try {
      const records = await pb.collection("site_media").getFullList({ filter: `key="${key}"`, requestKey: null });
      if (records.length > 0 && records[0].file) {
        return `${PB_URL}/api/files/site_media/${records[0].id}/${records[0].file}`;
      }
      return null;
    } catch { return null; }
  },
  uploadSiteMedia: async (key, file) => {
    try {
      const existing = await pb.collection("site_media").getFullList({ filter: `key="${key}"`, requestKey: null });
      const formData = new FormData();
      formData.append("key", key);
      formData.append("file", file);
      if (existing.length > 0) {
        return await pb.collection("site_media").update(existing[0].id, formData, { requestKey: null });
      } else {
        return await pb.collection("site_media").create(formData, { requestKey: null });
      }
    } catch (e) { console.warn('uploadSiteMedia error:', e); return null; }
  },
  deleteSiteMedia: async (key) => {
    try {
      const existing = await pb.collection("site_media").getFullList({ filter: `key="${key}"`, requestKey: null });
      if (existing.length > 0) await pb.collection("site_media").delete(existing[0].id, { requestKey: null });
    } catch { /* ignore */ }
  },

  // ─── Notifications ────────────────────────────────────────────
  // Collection: notifications { title, body, type, productId, promoTag, targetPhone, readBy, created }
  getNotifications: () => pb.collection("notifications").getFullList({ sort: "-created", requestKey: null }),
  getNotificationsForClient: (phone) => pb.collection("notifications").getFullList({
    sort: "-created",
    filter: `targetPhone="" || targetPhone="${phone}"`,
    requestKey: null,
  }),
  createNotification: (data) => pb.collection("notifications").create(data, { requestKey: null }),
  deleteNotification: (id) => pb.collection("notifications").delete(id, { requestKey: null }),
  markNotificationRead: async (id, _phone) => {
    // Server hook orqali — mijoz faqat O'ZINI readBy'ga qo'shadi
    // (to'g'ridan-to'g'ri update endi superuser-only qoida bilan yopilgan).
    try {
      const { authedFetch } = await import('./pb');
      await authedFetch('/api/custom/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      return true;
    } catch (e) { console.warn('markNotificationRead:', e); return false; }
  },

  // ─── Banners (PocketBase-synced via site_media) ───────────────
  // Each banner image → site_media key "banner_<id>"
  // Banner metadata (title, subtitle, overlays, order) → site_media key "banners_meta" (JSON in "value" text field)
  saveBannerImage: async (bannerId, base64DataUrl) => {
    try {
      const res = await fetch(base64DataUrl);
      const blob = await res.blob();
      const ext = blob.type?.includes('png') ? 'png' : 'jpg';
      const file = new File([blob], `banner_${bannerId}.${ext}`, { type: blob.type || 'image/jpeg' });
      const key = `banner_${bannerId}`;
      const existing = await pb.collection("site_media").getFullList({ filter: `key="${key}"`, requestKey: null });
      const formData = new FormData();
      formData.append("key", key);
      formData.append("file", file);
      let record;
      if (existing.length > 0) {
        record = await pb.collection("site_media").update(existing[0].id, formData, { requestKey: null });
      } else {
        record = await pb.collection("site_media").create(formData, { requestKey: null });
      }
      return `${PB_URL}/api/files/site_media/${record.id}/${record.file}`;
    } catch (e) { console.warn('saveBannerImage error:', e); return null; }
  },
  saveBannersMeta: async (banners) => {
    try {
      // Strip base64 img from meta — only store PB URLs or /public paths
      const meta = banners.map(b => {
        const { ...rest } = b;
        // Keep img only if it's a URL (not base64)
        if (rest.img && rest.img.startsWith('data:')) rest.img = null;
        return rest;
      });
      const key = "banners_meta";
      const existing = await pb.collection("site_media").getFullList({ filter: `key="${key}"`, requestKey: null });
      const formData = new FormData();
      formData.append("key", key);
      // Store as a tiny text file so PB accepts it
      const jsonBlob = new Blob([JSON.stringify(meta)], { type: 'application/json' });
      formData.append("file", new File([jsonBlob], "banners_meta.json", { type: 'application/json' }));
      if (existing.length > 0) {
        await pb.collection("site_media").update(existing[0].id, formData, { requestKey: null });
      } else {
        await pb.collection("site_media").create(formData, { requestKey: null });
      }
    } catch (e) { console.warn('saveBannersMeta error:', e); }
  },
  loadBannersMeta: async () => {
    try {
      const records = await pb.collection("site_media").getFullList({ filter: `key="banners_meta"`, requestKey: null });
      if (records.length > 0 && records[0].file) {
        const url = `${PB_URL}/api/files/site_media/${records[0].id}/${records[0].file}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) return data;
        }
      }
      return null;
    } catch { return null; }
  },
  deleteBannerImage: async (bannerId) => {
    try {
      const key = `banner_${bannerId}`;
      const existing = await pb.collection("site_media").getFullList({ filter: `key="${key}"`, requestKey: null });
      if (existing.length > 0) await pb.collection("site_media").delete(existing[0].id, { requestKey: null });
    } catch { /* ignore */ }
  },

  // ─── Global Settings (PB `settings` kolleksiyasi — server hooks ham o'qiydi) ──
  // getSettings: birinchi yozuvni qaytaradi (id='main' bo'lishi shart emas).
  // saveSettings: mavjud yozuvni yangilaydi, bo'lmasa yaratadi (faqat admin
  // token bilan ishlaydi — kolleksiya update/create rule superuser-only).
  getSettings: async () => {
    try {
      const recs = await pb.collection("settings").getFullList({ requestKey: null });
      return recs.length > 0 ? recs[0] : null;
    } catch (e) { console.warn('getSettings error:', e); return null; }
  },
  saveSettings: async (data) => {
    // PB meta maydonlarini va katta media'larni yubormaslik
    const { id, created, updated, collectionId, collectionName,
            instagramScreen, loginBg, instaStories, ...clean } = data || {};
    try {
      const recs = await pb.collection("settings").getFullList({ requestKey: null });
      if (recs.length > 0) {
        return await pb.collection("settings").update(recs[0].id, clean, { requestKey: null });
      }
      return await pb.collection("settings").create(clean, { requestKey: null });
    } catch (e) { console.warn('saveSettings error:', e); return null; }
  },

  // ─── Payment Settings ─────────────
  // Stored in site_media as key="payment_settings", file=JSON blob.
  // Shape: { }
  savePaymentSettings: async (data) => {
    try {
      const key = "payment_settings";
      const existing = await pb.collection("site_media").getFullList({ filter: `key="${key}"`, requestKey: null });
      const formData = new FormData();
      formData.append("key", key);
      const jsonBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      formData.append("file", new File([jsonBlob], "payment_settings.json", { type: 'application/json' }));
      if (existing.length > 0) {
        await pb.collection("site_media").update(existing[0].id, formData, { requestKey: null });
      } else {
        await pb.collection("site_media").create(formData, { requestKey: null });
      }
      return true;
    } catch (e) { console.warn('savePaymentSettings error:', e); return false; }
  },
  loadPaymentSettings: async () => {
    try {
      const records = await pb.collection("site_media").getFullList({ filter: `key="payment_settings"`, requestKey: null });
      if (records.length > 0 && records[0].file) {
        const url = `${PB_URL}/api/files/site_media/${records[0].id}/${records[0].file}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') return data;
        }
      }
      return null;
    } catch { return null; }
  },

  // ─── Instagram Graph API ───────────────────────────────────────
  // Fetches recent media from Instagram Graph API using long-lived token.
  // Token must be set in settings.instagramToken by admin.
  // Endpoint: GET /me/media?fields=...&access_token=TOKEN
  // Also fetches profile info from /me?fields=...
  getInstagramProfile: async (token) => {
    if (!token) return null;
    try {
      const res = await fetch(
        `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${token}`
      );
      if (!res.ok) throw new Error('IG profile fetch failed');
      return await res.json();
    } catch (e) { console.warn('Instagram profile error:', e); return null; }
  },

  getInstagramPosts: async (token, limit = 12) => {
    if (!token) return [];
    try {
      const res = await fetch(
        `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${token}`
      );
      if (!res.ok) throw new Error('IG fetch failed');
      const data = await res.json();
      return (data.data || []).filter(
        m => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM'
      );
    } catch (e) { console.warn('Instagram posts error:', e); return []; }
  },

  // Refresh long-lived token (valid 60 days, call every ~50 days)
  refreshInstagramToken: async (token) => {
    if (!token) return null;
    try {
      const res = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`
      );
      if (!res.ok) throw new Error('IG token refresh failed');
      const data = await res.json();
      return data.access_token || null;
    } catch (e) { console.warn('Instagram token refresh error:', e); return null; }
  },

  findClientByPhone: async (phone) => {
    try {
      const res = await pb.collection("clients").getFirstListItem(`phone="${phone}"`, { requestKey: null });
      return res;
    } catch { return null; }
  },
};

