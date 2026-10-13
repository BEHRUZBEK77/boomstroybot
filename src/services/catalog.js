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

function startCatalog() {
  if (readyPromise) return readyPromise;
  const { getDb } = require('./firebase');
  readyPromise = new Promise((resolve) => {
    let attempt = 0;
    const subscribe = () => {
      const unsub = getDb().collection('products').onSnapshot(
        (snap) => {
          attempt = 0;
          snap.docChanges().forEach((ch) => {
            if (ch.type === 'removed') { raw.delete(ch.doc.id); products.delete(ch.doc.id); return; }
            const d = ch.doc.data();
            raw.set(ch.doc.id, d);
            products.set(ch.doc.id, normalizeProduct(ch.doc.id, d));
          });
          sortedCache = null;
          if (!ready) {
            ready = true;
            console.log(`✅ Katalog yuklandi: ${products.size} ta mahsulot`);
            resolve();
          }
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
  });
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
  startCatalog, isReady, allProducts, getProduct, isAvailable,
  normalizeProduct, isStockTracked,
};
