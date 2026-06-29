const { queryDocs } = require('../services/firebase');
const { t, normalizeLang } = require('../utils/i18n');

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || '@boomstroy_support';

// Til keshi — har bir xabarda Firestore o'qimaslik uchun (5 daqiqa TTL)
const langCache = new Map();
function cacheLang(userId, lang) { langCache.set(String(userId), { lang, at: Date.now() }); }
function getCachedLang(userId) {
  const r = langCache.get(String(userId));
  if (r && Date.now() - r.at < 300000) return r.lang;
  return null;
}

// Rate limiting
const rateLimits = new Map();
function checkRateLimit(userId, limit = 30, window = 60000) {
  const now = Date.now();
  const key = String(userId);
  const record = rateLimits.get(key) || { count: 0, resetAt: now + window };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + window; }
  record.count++;
  rateLimits.set(key, record);
  return record.count <= limit;
}

async function authMiddleware(ctx, next) {
  if (!ctx.from) return;

  const userId = String(ctx.from.id);

  // Tilni keshdan tezda o'rnatamiz (Telegram tilidan default)
  let lang = getCachedLang(userId) || normalizeLang(ctx.from.language_code);
  ctx.state.lang = lang;
  ctx.state.isAdmin = ADMIN_IDS.includes(userId);

  // Rate limit check
  if (!checkRateLimit(userId)) {
    return ctx.reply(t(lang, 'rateLimited'));
  }

  // Foydalanuvchini yuklash: til + bloklash holati
  try {
    const users = await queryDocs('telegramUsers', 'telegramId', '==', userId);
    const user = users[0];
    if (user) {
      ctx.state.user = user;
      if (user.lang) {
        lang = normalizeLang(user.lang);
        ctx.state.lang = lang;
        cacheLang(userId, lang);
      }
      if (user.isBlocked) {
        return ctx.reply(t(lang, 'blocked', { support: SUPPORT_USERNAME }));
      }
    }
  } catch { }

  return next();
}

// Boshqa modullar foydalanuvchi tilini o'zgartirganda keshni yangilash uchun
function setUserLangCache(userId, lang) { cacheLang(userId, normalizeLang(lang)); }

function adminOnly(ctx, next) {
  if (!ADMIN_IDS.includes(String(ctx.from?.id))) {
    return ctx.reply('❌ Ruxsat yo\'q.');
  }
  return next();
}

module.exports = { authMiddleware, adminOnly, checkRateLimit, setUserLangCache };
