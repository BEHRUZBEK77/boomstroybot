// In-memory session store (Railway restart bo'lsa o'chadi, production uchun Redis ishlatish mumkin)
const sessions = new Map();

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
  return s.cart;
}

function getCart(userId) {
  return getSession(userId).cart || [];
}

function clearCart(userId) {
  const s = getSession(userId);
  s.cart = [];
  sessions.set(userId, s);
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

module.exports = { getSession, setSession, clearSession, updateCart, getCart, clearCart, getCartTotal };
