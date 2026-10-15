// ════════════════════════════════════════════════════════════════════════════
// JONLI KATALOG (xotirada)
//   3800+ mahsulotni har bosishda Firestore'dan o'qish kunlik bepul kvotani
//   (50 000 o'qish) tez tugatadi va bot "ishlamay" qoladi. Shuning uchun
//   mahsulotlar ishga tushishda BIR MARTA o'qiladi, keyin onSnapshot orqali
//   faqat o'zgargan hujjatlar keladi (sayt admin panelidagi o'zgarishlar ham
//   darhol ko'rinadi).
//
//   Har bir mahsulot normallashtiriladi:
//     price         → har doim so'mda (USD bo'lsa kurs bo'yicha o'giriladi)
//     priceOriginal → bazadagi asl narx, currencyOriginal → asl valyuta
//     stockTracked  → zaxira haqiqatan yuritiladimi (stock bo'sh {} bo'lsa — yo'q)
// ════════════════════════════════════════════════════════════════════════════
const { toUZS, onRateChange } = require('./currency');

const raw = new Map();       // id -> bazadagi asl ma'lumot
const products = new Map();  // id -> normallashtirilgan
let ready = false;
let readyPromise = null;
let sortedCache = null;

function isStockTracked(p) {
  if (p.stock && typeof p.stock === 'object' && Object.keys(p.stock).length > 0) return true;
  return typeof p.quantity === 'number';
}

function normalizeProduct(id, data) {
  const currencyOriginal = String(data.currency || 'UZS').toUpperCase();
  return {
    ...data,
    id,
    priceOriginal: data.price,
    currencyOriginal,
    price: toUZS(data.price, currencyOriginal),
    currency: 'UZS',
    stockTracked: isStockTracked(data),
  };
}

function rebuildAll() {
  products.clear();
  for (const [id, d] of raw) products.set(id, normalizeProduct(id, d));
  sortedCache = null;
}

onRateChange(() => { if (raw.size) rebuildAll(); });

// ─── KESH (Firebase Storage) ──────────────────────────────────────────────────
// Bepul Firestore rejasida kuniga 50 000 o'qish bor. Har ishga tushishda 3800+
// mahsulotni o'qish limitni tez tugatadi (13–14-oktabrda shunday bo'lgan).
// Shuning uchun katalog Storage'dagi JSON faylda saqlanadi, ishga tushishda
// undan yuklanadi va Firestore'dan faqat o'shandan beri O'ZGARGAN mahsulotlar
// o'qiladi. Kuniga bir marta (04:00) to'liq yangilanadi.
const CACHE_PATH = 'cache/catalog-v1.json';
const CACHE_MAX_AGE = 26 * 60 * 60 * 1000;
let dirty = false;
let lastFullSync = 0;

function revive(v) {
  if (v && typeof v === 'object') {
    if (typeof v._seconds === 'number' && typeof v._nanoseconds === 'number' && Object.keys(v).length === 2) {
      const { admin } = require('./firebase');
      return new admin.firestore.Timestamp(v._seconds, v._nanoseconds);
    }
    for (const k of Object.keys(v)) v[k] = revive(v[k]);
  }
  return v;
}

function bucket() { return require('./firebase').getStorage().bucket(); }

// Kesh ikki joyda bo'lishi mumkin: Storage (afzal) yoki Firestore `_cache` kolleksiyasi
// (Storage yoqilmagan loyihalarda). Firestore'da JSON ~900 KB bo'laklarga bo'linadi —
// 3800 mahsulot o'rniga 3–5 ta hujjat o'qiladi.
const CHUNK = 300 * 1024; // belgi; UTF-8 da 3 baytgacha → 1 MB hujjat limitidan past
let storageOk = true;

async function loadCache() {
  let text = null;
  if (storageOk) {
    try {
      const [buf] = await bucket().file(CACHE_PATH).download();
      text = buf.toString('utf8');
    } catch (e) {
      if (/bucket does not exist|not found|404|No such object/i.test(e.message)) {
        if (/bucket/i.test(e.message)) storageOk = false;
      } else console.warn('Storage keshi o\'qilmadi:', e.message);
    }
  }
  if (!text) {
    const { getDb } = require('./firebase');
    const meta = await getDb().collection('_cache').doc('catalog').get();
    if (meta.exists && meta.data().parts) {
      const parts = await Promise.all(Array.from({ length: meta.data().parts }, (_, i) =>
        getDb().collection('_cache').doc(`catalog_${i}`).get()));
      if (parts.every(p => p.exists)) text = parts.map(p => p.data().d).join('');
    }
  }
  if (!text) return null;
  const data = JSON.parse(text);
  if (!data?.ts || !data.docs) return null;
  return { ts: data.ts, full: data.full || data.ts, docs: revive(data.docs) };
}

async function saveCache() {
  if (!dirty || !raw.size) return;
  dirty = false;
  const text = JSON.stringify({ ts: Date.now(), full: lastFullSync, docs: Object.fromEntries(raw) });
  try {
    if (storageOk) {
      try {
        await bucket().file(CACHE_PATH).save(text, { resumable: false, contentType: 'application/json' });
        return;
      } catch (e) {
        if (/bucket/i.test(e.message)) storageOk = false; else throw e;
      }
    }
    const { getDb } = require('./firebase');
    const n = Math.ceil(text.length / CHUNK);
    for (let i = 0; i < n; i++) {
      await getDb().collection('_cache').doc(`catalog_${i}`).set({ d: text.slice(i * CHUNK, (i + 1) * CHUNK) });
    }
    await getDb().collection('_cache').doc('catalog').set({ parts: n, ts: Date.now(), size: text.length });
  } catch (e) {
    dirty = true;
    console.warn('Katalog keshini saqlab bo\'lmadi:', e.message);
  }
}

function applyChange(type, id, d) {
  if (type === 'removed') { raw.delete(id); products.delete(id); }
  else { raw.set(id, d); products.set(id, normalizeProduct(id, d)); }
  sortedCache = null;
  dirty = true;
}

// Admin paneldan o'chirilganda darhol xotiradan ham olib tashlash
function removeLocal(id) { applyChange('removed', id); }

// Firestore jonli kuzatuvchi; `since` berilsa — faqat o'zgarganlar
function listen(since, onFirst) {
  const { getDb, admin } = require('./firebase');
  let attempt = 0;
  let first = true;
  const subscribe = () => {
    let q = getDb().collection('products');
    if (since) q = q.where('updatedAt', '>=', admin.firestore.Timestamp.fromMillis(since - 5 * 60 * 1000));
    const unsub = q.onSnapshot(
      (snap) => {
        attempt = 0;
        // Vaqt filtri bilan "removed" — hujjat o'chirilgan degani
        snap.docChanges().forEach((ch) => applyChange(ch.type, ch.doc.id, ch.doc.data()));
        if (first) { first = false; onFirst?.(snap.size); }
      },
      (err) => {
        attempt++;
        const delay = Math.min(5 * 60 * 1000, 5000 * 2 ** Math.min(attempt, 6));
        console.error(`products onSnapshot xato: ${err.message} — ${Math.round(delay / 1000)}s dan keyin qayta`);
        try { unsub(); } catch { }
        setTimeout(subscribe, delay);
      }
    );
  };
  subscribe();
}

// To'liq qayta o'qish (kuniga bir marta) — saytda o'chirilganlarni ham aniqlaydi
async function fullResync() {
  const { getDb } = require('./firebase');
  try {
    const snap = await getDb().collection('products').get();
    const seen = new Set();
    snap.docs.forEach(d => { seen.add(d.id); raw.set(d.id, d.data()); });
    for (const id of [...raw.keys()]) if (!seen.has(id)) raw.delete(id);
    rebuildAll();
    lastFullSync = Date.now();
    dirty = true;
    await saveCache();
    console.log(`🔄 Katalog to'liq yangilandi: ${raw.size} ta`);
  } catch (e) {
    console.error('Katalogni to\'liq yangilab bo\'lmadi:', e.message);
  }
}

function markReady(src) {
  if (ready) return;
  ready = true;
  console.log(`✅ Katalog yuklandi: ${products.size} ta mahsulot (${src})`);
}

function startCatalog() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    let cache = null;
    try { cache = await loadCache(); } catch (e) {
      console.warn('Katalog keshi o\'qilmadi:', e.message);
    }

    if (cache && Date.now() - cache.ts < CACHE_MAX_AGE) {
      for (const [id, d] of Object.entries(cache.docs)) raw.set(id, d);
      rebuildAll();
      lastFullSync = cache.full;
      markReady('kesh');
      listen(cache.ts, (n) => { if (n) console.log(`🔄 Keshdan keyin o'zgargan: ${n} ta`); });
    } else {
      await new Promise((resolve) => listen(null, () => {
        lastFullSync = Date.now();
        markReady('Firestore');
        resolve();
      }));
    }

    setInterval(saveCache, 10 * 60 * 1000).unref();
    setTimeout(saveCache, 30 * 1000).unref();
    // Kuniga bir marta to'liq yangilash (Toshkent 04:00)
    require('node-cron').schedule('0 4 * * *', fullResync, { timezone: 'Asia/Tashkent' });
  })();
  return readyPromise;
}

function isReady() { return ready; }

// Yangi qo'shilganlar birinchi (createdAt desc)
function allProducts() {
  if (!sortedCache) {
    const ts = (p) => p.createdAt?.seconds || p.createdAt?._seconds || 0;
    sortedCache = [...products.values()].sort((a, b) => ts(b) - ts(a));
  }
  return sortedCache;
}

function getProduct(id) { return products.get(id) || null; }

// Mijozga ko'rsatiladigan mahsulotmi: faol, narxi bor, zaxira (yuritilsa) > 0
function isAvailable(p) {
  if (!p || p.status === 'inactive' || p.active === false || p.hidden === true) return false;
  if (!(p.price > 0)) return false;
  if (p.stockTracked) {
    const { totalStock } = require('../utils/helpers');
    return totalStock(p) > 0;
  }
  return true;
}

module.exports = {
  startCatalog, isReady, removeLocal, saveCache, fullResync, allProducts, getProduct, isAvailable,
  normalizeProduct, isStockTracked,
};
