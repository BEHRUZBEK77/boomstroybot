const moment = require('moment');
moment.locale('uz');

function fmtNum(n) {
  return Math.round(n || 0).toLocaleString('uz-UZ');
}

function fmtDate(ts) {
  if (!ts) return '-';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return moment(d).format('DD.MM.YYYY HH:mm');
  } catch {
    return '-';
  }
}

function fmtDateShort(ts) {
  if (!ts) return '-';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return moment(d).format('DD.MM.YYYY');
  } catch {
    return '-';
  }
}

function timeAgo(ts) {
  if (!ts) return '-';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return moment(d).fromNow();
  } catch {
    return '-';
  }
}

function getStockStatus(p) {
  const qty = p.quantity || 0;
  const min = p.minQuantity || 5;
  if (qty <= 0) return { emoji: '🔴', label: 'Tugagan', val: 'out' };
  if (qty <= min) return { emoji: '🟡', label: 'Kam qolgan', val: 'low' };
  return { emoji: '🟢', label: 'Mavjud', val: 'ok' };
}

function paymentLabel(p) {
  const map = { cash: '💵 Naqd', card: '💳 Karta', transfer: "🏦 O'tkazma", credit: '📒 Nasiya' };
  return map[p] || p || '-';
}

function orderStatusLabel(s, lang = 'uz') {
  const { t } = require('./i18n');
  const known = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'paid', 'paid_pending'];
  if (known.includes(s)) return t(lang, 'st_' + s);
  return s || '-';
}

function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `BS-${y}${m}${d}-${rand}`;
}

function parseCoords(text) {
  const match = text.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  return null;
}

// ─── LOYALTY / BONUS / REFERAL YORDAMCHI FUNKSIYALARI ────────────────────────

// Ball iqtisodiyoti:  100 ball = 1 000 so'm  →  1 ball = 10 so'm
// 1 ball necha so'mga teng (sarflashda / sovg'a narxida)
const LOYALTY_POINT_VALUE = parseInt(process.env.LOYALTY_POINT_VALUE || '10');
// Har xarid summasidan ball ko'rinishidagi qaytim koeffitsienti.
// 0.002 × 10 so'm = ~2% naqd qiymatli cashback.
const LOYALTY_EARN_RATE = parseFloat(process.env.LOYALTY_EARN_RATE || '0.002');
// Referal taklif qilgan kishiga necha ball beriladi (500 ball = 5 000 so'm)
const REFERRAL_BONUS_POINTS = parseInt(process.env.REFERRAL_BONUS_POINTS || '500');
// Referal qabul qilgan (yangi) kishiga necha ball beriladi (200 ball = 2 000 so'm)
const REFERRAL_WELCOME_POINTS = parseInt(process.env.REFERRAL_WELCOME_POINTS || '200');

function calcEarnedPoints(orderTotal) {
  return Math.floor((orderTotal || 0) * LOYALTY_EARN_RATE);
}

// Tier obyektida `key` — i18n nomi (tier_new, tier_bronze, ...), `nextKey` — keyingi daraja kaliti
function getLoyaltyTier(totalSpent = 0) {
  if (totalSpent >= 50000000) return { key: 'tier_diamond', icon: '💎', discount: 7, nextKey: null, nextAt: null };
  if (totalSpent >= 20000000) return { key: 'tier_gold', icon: '🥇', discount: 5, nextKey: 'tier_diamond', nextAt: 50000000 };
  if (totalSpent >= 5000000) return { key: 'tier_silver', icon: '🥈', discount: 3, nextKey: 'tier_gold', nextAt: 20000000 };
  if (totalSpent >= 1000000) return { key: 'tier_bronze', icon: '🥉', discount: 1, nextKey: 'tier_silver', nextAt: 5000000 };
  return { key: 'tier_new', icon: '🆕', discount: 0, nextKey: 'tier_bronze', nextAt: 1000000 };
}

function generateReferralCode(telegramId) {
  return 'BS' + String(telegramId).slice(-6) + Math.random().toString(36).slice(2, 4).toUpperCase();
}

function generatePromoCode(prefix = 'PROMO') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${code}`;
}

function isPromoValid(promo) {
  if (!promo) return false;
  if (promo.active === false) return false;
  if (promo.maxUses && (promo.usedCount || 0) >= promo.maxUses) return false;
  if (promo.expiresAt) {
    const exp = promo.expiresAt?.toDate ? promo.expiresAt.toDate() : new Date(promo.expiresAt);
    if (exp.getTime() < Date.now()) return false;
  }
  return true;
}

function calcPromoDiscount(promo, subtotal) {
  if (!promo) return 0;
  if (promo.type === 'percent') return Math.round(subtotal * (promo.value / 100));
  if (promo.type === 'fixed') return Math.min(promo.value, subtotal);
  return 0;
}

function maskCardNumber(num) {
  if (!num) return '-';
  const clean = String(num).replace(/\s/g, '');
  if (clean.length < 8) return clean;
  return clean.slice(0, 4) + ' **** **** ' + clean.slice(-4);
}

function starsBar(rating = 0, max = 5) {
  const full = Math.round(rating);
  return '⭐'.repeat(Math.max(0, Math.min(full, max))) + '☆'.repeat(Math.max(0, max - full));
}

function pluralUnit(qty, unit) {
  return `${qty} ${unit || 'dona'}`;
}

function truncate(text, len = 80) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len - 1) + '…' : text;
}

module.exports = {
  fmtNum, fmtDate, fmtDateShort, timeAgo,
  getStockStatus, paymentLabel, orderStatusLabel,
  escapeMarkdown, chunk, generateOrderNumber, parseCoords,
  LOYALTY_EARN_RATE, LOYALTY_POINT_VALUE, REFERRAL_BONUS_POINTS, REFERRAL_WELCOME_POINTS,
  calcEarnedPoints, getLoyaltyTier, generateReferralCode, generatePromoCode,
  isPromoValid, calcPromoDiscount, maskCardNumber, starsBar, pluralUnit, truncate,
};
