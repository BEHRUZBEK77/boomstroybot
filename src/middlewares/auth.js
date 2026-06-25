const { queryDocs } = require('../services/firebase');

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);

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

  // Rate limit check
  if (!checkRateLimit(userId)) {
    return ctx.reply('⚠️ Juda tez xabar yuboryapsiz. Biroz kuting.');
  }

  // Check if blocked
  try {
    const users = await queryDocs('telegramUsers', 'telegramId', '==', userId);
    if (users[0]?.isBlocked) {
      return ctx.reply('❌ Hisobingiz bloklangan. @boomstroy_support ga murojaat qiling.');
    }
  } catch { }

  return next();
}

function adminOnly(ctx, next) {
  if (!ADMIN_IDS.includes(String(ctx.from?.id))) {
    return ctx.reply('❌ Ruxsat yo\'q.');
  }
  return next();
}

module.exports = { authMiddleware, adminOnly, checkRateLimit };
