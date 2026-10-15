const { queryDocs } = require('../services/firebase');
const { t, normalizeLang } = require('../utils/i18n');

const { ADMIN_IDS } = require('../utils/admins');

// Til keshi — har bir xabarda Firestore o'qimaslik uchun (5 daqiqa TTL)
const langCache = new Map();
function cacheLang(userId, lang) { langCache.set(String(userId), { lang, at: Date.now() }); }
function getCachedLang(userId) {
  const r = langCache.get(String(userId));
  if (r && Date.now() - r.at < 300000) return r.lang;
  return null;
}

const userCache = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of userCache) if (now - v.at > 60000) userCache.delete(k); }, 300000).unref();

// Rate limiting
const rateLimits = new Map();
function checkRateLimit(userId, limit = Number(process.env.RATE_LIMIT_PER_MIN) || 60, window = 60000) {
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
  if (!checkRateLimit(userId) && !ctx.state.isAdmin) {
    // Tugma bosilgan bo'lsa — soat belgisi osilib qolmasin
    if (ctx.callbackQuery) return ctx.answerCbQuery(t(lang, 'rateLimited')).catch(() => { });
    return ctx.reply(t(lang, 'rateLimited'));
  }

  // Savatni tiklash (bot qayta ishga tushgan bo'lsa) — 3 soniyadan ko'p kutmaymiz
  await Promise.race([
    require('../services/session').ensureCartLoaded(ctx.from.id),
    new Promise(r => setTimeout(r, 3000)),
  ]).catch(() => { });

  // Foydalanuvchini yuklash: til + bloklash holati
  try {
    // Firestore sekinlashsa butun bot qotib qolmasligi uchun 4 soniya chegarasi
    // 30 soniyalik kesh — har bir bosishda Firestore o'qilmasin
    const cached = userCache.get(userId);
    const users = cached && Date.now() - cached.at < 30000 ? cached.users : await Promise.race([
      queryDocs('telegramUsers', 'telegramId', '==', userId).then(u => { userCache.set(userId, { users: u, at: Date.now() }); return u; }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('firestore timeout')), 4000)),
    ]);
    const user = users[0];
    if (user) {
      ctx.state.user = user;
      if (user.lang) {
        lang = normalizeLang(user.lang);
        ctx.state.lang = lang;
        cacheLang(userId, lang);
      }
      if (user.isBlocked) {
        return ctx.reply(t(lang, 'blocked', { support: require('../services/config').get('supportUsername') }));
      }
    }
  } catch (e) {
    console.error('auth: foydalanuvchini yuklab bo\'lmadi:', e.message);
  }

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
