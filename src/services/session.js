// Sessiya xotirada; SAVAT esa Firestore `carts/<telegramId>` da ham saqlanadi —
// bot qayta ishga tushsa (deploy) mijozlarning savati yo'qolmaydi.
const sessions = new Map();
const saveTimers = new Map();

function persistCart(userId) {
  clearTimeout(saveTimers.get(userId));
  saveTimers.set(userId, setTimeout(async () => {
    saveTimers.delete(userId);
    const s = sessions.get(userId);
    if (!s) return;
    try {
      const { getDb } = require('./firebase');
      await getDb().collection('carts').doc(String(userId)).set({ items: s.cart || [], updatedAt: new Date() });
    } catch (e) { console.warn('Savatni saqlab bo\'lmadi:', e.message); }
  }, 1500));
}

// Bot qayta ishga tushgandan keyin birinchi murojaatda savatni bazadan tiklaydi
async function ensureCartLoaded(userId) {
  const s = getSession(userId);
  if (s._cartLoaded) return;
  s._cartLoaded = true;
  try {
    const { getDb } = require('./firebase');
    const doc = await getDb().collection('carts').doc(String(userId)).get();
    const items = doc.exists ? doc.data().items : null;
    if (Array.isArray(items) && items.length && !(s.cart || []).length) s.cart = items;
  } catch (e) {
    s._cartLoaded = false;
    console.warn('Savatni tiklab bo\'lmadi:', e.message);
  }
}

const DEFAULT_SESSION = () => ({
  step: null,
  cart: [],
  order: {},
  profile: {},
  lastActivity: Date.now(),
  page: 0,
  searchQuery: '',
  tempData: {},
});

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, DEFAULT_SESSION());
  }
  const s = sessions.get(userId);
  s.lastActivity = Date.now();
  return s;
}

function setSession(userId, data) {
  const current = getSession(userId);
  sessions.set(userId, { ...current, ...data, lastActivity: Date.now() });
}

function clearSession(userId) {
  sessions.set(userId, DEFAULT_SESSION());
}

function updateCart(userId, product, qty = 1) {
  const s = getSession(userId);
  const existing = s.cart.find(i => i.productId === product.id);
  if (existing) {
    existing.qty += qty;
    if (existing.qty <= 0) s.cart = s.cart.filter(i => i.productId !== product.id);
  } else if (qty > 0) {
    s.cart.push({
      productId: product.id,
      name: product.name,
      price: product.price || 0,
      unit: product.unit || 'dona',
      qty,
    });
  }
  sessions.set(userId, s);
  persistCart(userId);
  return s.cart;
}

// Narx va nomni har doim katalogdagi joriy qiymatdan oladi (admin narxni o'zgartirsa ham to'g'ri)
function getCart(userId) {
  const s = getSession(userId);
  const cart = s.cart || [];
  try {
    const catalog = require('./catalog');
    if (catalog.isReady()) {
      for (const i of cart) {
        const p = catalog.getProduct(i.productId);
        if (p) { i.price = p.price || 0; i.name = p.name; i.unit = p.unit || i.unit; }
      }
    }
  } catch { }
  return cart;
}

function clearCart(userId) {
  const s = getSession(userId);
  s.cart = [];
  sessions.set(userId, s);
  persistCart(userId);
}

function getCartTotal(userId) {
  const cart = getCart(userId);
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

// Eski sessionlarni tozalash (24 soat)
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastActivity > 86400000) sessions.delete(id);
  }
}, 3600000);

module.exports = { ensureCartLoaded, getSession, setSession, clearSession, updateCart, getCart, clearCart, getCartTotal };
