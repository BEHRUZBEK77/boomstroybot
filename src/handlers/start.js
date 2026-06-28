const { getSession, setSession } = require('../services/session');
const { queryDocs, addDoc, updateDoc } = require('../services/firebase');
const { mainMenu, mainMenuV2, sharePhoneButton, adminMainMenu } = require('../utils/keyboards');
const { fmtDate } = require('../utils/helpers');
const { checkSubscription, sendSubscribePrompt, CHANNEL_LINK } = require('../middlewares/subscription');
const { Markup } = require('telegraf');

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);

async function getOrCreateUser(ctx) {
  const tgId = String(ctx.from.id);
  const existing = await queryDocs('telegramUsers', 'telegramId', '==', tgId);
  if (existing.length > 0) return existing[0];

  const newUser = {
    telegramId: tgId,
    firstName: ctx.from.first_name || '',
    lastName: ctx.from.last_name || '',
    username: ctx.from.username || '',
    phone: '',
    isAdmin: ADMIN_IDS.includes(tgId),
    isBlocked: false,
    orderCount: 0,
    totalSpent: 0,
    loyaltyPoints: 0,
    favorites: [],
    recentlyViewed: [],
    priceAlerts: [],
    stockAlerts: [],
    lang: 'uz',
  };
  const id = await addDoc('telegramUsers', newUser);
  return { id, ...newUser };
}

async function handleReferralFromStart(ctx, user) {
  try {
    const payload = ctx.startPayload || (ctx.message?.text || '').split(' ')[1];
    if (!payload || !payload.startsWith('ref_')) return;
    if (user.referredBy) return;
    const code = payload.slice(4);
    const { processReferral } = require('./loyalty');
    await processReferral(user, code);
  } catch (e) {
    console.error('Referral start error:', e.message);
  }
}

async function handleStart(ctx) {
  const user = await getOrCreateUser(ctx);
  setSession(ctx.from.id, { user });

  // Admin uchun subscription tekshirmaymiz
  if (user.isAdmin) {
    await ctx.reply(
      `👑 *Admin Paneliga Xush Kelibsiz!*\n\n` +
      `Salom, *${user.firstName}*! 🎉\n` +
      `BoomStroy boshqaruv tizimi tayyor.`,
      { parse_mode: 'Markdown', ...adminMainMenu() }
    );
    return;
  }

  // Kanalga obuna tekshirish
  const subscribed = await checkSubscription(ctx);
  if (!subscribed) {
    await sendSubscribePrompt(ctx);
    return;
  }

  await handleReferralFromStart(ctx, user);

  if (!user.phone) {
    await ctx.reply(
      `🏗️ *BoomStroy — Qurilish Materiallari*\n\n` +
      `Xush kelibsiz, *${user.firstName || 'hurmatli mijoz'}*! 🎉\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 Davom etish uchun telefon raqamingizni ulashing.\n` +
      `Bu bir martadan so'raladi va buyurtma berishni osonlashtiradi 🔐`,
      { parse_mode: 'Markdown', ...sharePhoneButton() }
    );
    setSession(ctx.from.id, { step: 'waiting_phone' });
    return;
  }

  await showWelcome(ctx, user);
}

// "A'zo bo'ldim" tugmasi bosilganda
async function handleCheckSub(ctx) {
  await ctx.answerCbQuery('Tekshirilmoqda...').catch(() => {});

  const subscribed = await checkSubscription(ctx);
  if (!subscribed) {
    await ctx.reply(
      `❌ *Siz hali kanalga a'zo bo'lmadingiz!*\n\n` +
      `Iltimos, avval a'zo bo'ling, keyin qayta tekshiring. 👇`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.url('📢 Kanalga O\'tish', CHANNEL_LINK)],
          [Markup.button.callback('🔄 Qayta Tekshirish', 'check_sub')],
        ])
      }
    );
    return;
  }

  const tgId = String(ctx.from.id);
  const users = await queryDocs('telegramUsers', 'telegramId', '==', tgId);
  const user = users[0] || await getOrCreateUser(ctx);

  if (!user.phone) {
    await ctx.reply(
      `✅ *Ajoyib! Kanalga a'zo bo'ldingiz!*\n\n` +
      `Endi telefon raqamingizni ulashing 📱`,
      { parse_mode: 'Markdown', ...sharePhoneButton() }
    );
    setSession(ctx.from.id, { step: 'waiting_phone', user });
    return;
  }

  await showWelcome(ctx, user);
}

async function handleContact(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'waiting_phone') return;

  const phone = ctx.message.contact?.phone_number;
  if (!phone) return ctx.reply('Iltimos, raqamingizni yuborish uchun tugmani bosing. 📱');

  const tgId = String(ctx.from.id);
  const existing = await queryDocs('telegramUsers', 'telegramId', '==', tgId);

  let user;
  if (existing.length > 0) {
    await updateDoc('telegramUsers', existing[0].id, { phone });
    user = { ...existing[0], phone };
  } else {
    const newUser = {
      telegramId: tgId,
      firstName: ctx.from.first_name || '',
      lastName: ctx.from.last_name || '',
      username: ctx.from.username || '',
      phone,
      isAdmin: ADMIN_IDS.includes(tgId),
      isBlocked: false,
      orderCount: 0,
      totalSpent: 0,
      loyaltyPoints: 0,
      favorites: [],
      lang: 'uz',
    };
    const id = await addDoc('telegramUsers', newUser);
    user = { id, ...newUser };
  }

  setSession(ctx.from.id, { user, step: null });
  await ctx.reply(
    `✅ *Muvaffaqiyatli ro'yxatdan o'tdingiz!* 🎉`,
    { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
  );
  await showWelcome(ctx, user);
}

async function showWelcome(ctx, user) {
  const text =
    `🏗️ *BoomStroy — Qurilish Materiallari*\n\n` +
    `Xush kelibsiz, *${user.firstName}*! 👋\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏙️ Toshkent va atroflarga yetkazib berish\n` +
    `⚡ Tez va ishonchli yetkazish xizmati\n` +
    `💎 Faqat sifatli va original mahsulotlar\n` +
    `💰 Bozordagi eng raqobatbardosh narxlar\n` +
    `🎁 Har xariddan bonus ball to'plang!\n` +
    `📞 Qo'llab-quvvatlash: +998 94 217 10 10\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👇 Kerakli bo'limni tanlang:`;

  await ctx.reply(text, { parse_mode: 'Markdown', ...mainMenuV2() });
}

async function handleHelp(ctx) {
  await ctx.reply(
    `ℹ️ *BoomStroy Bot — Yordam*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛍️ *Mahsulotlar* — Katalogni ko'rish\n` +
    `🛒 *Savat* — Tanlangan mahsulotlar\n` +
    `📋 *Buyurtmalarim* — Buyurtma tarixi\n` +
    `👤 *Profilim* — Shaxsiy ma'lumotlar\n` +
    `❤️ *Sevimlilar* — Yoqtirgan mahsulotlar\n` +
    `🎁 *Bonus va Sodiqlik* — Ball va chegirmalar\n` +
    `📍 *Yetkazib berish* — Narx va shartlar\n` +
    `📞 *Aloqa* — Bog'lanish\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 Buyruqlar: /faq /referral /bonus /support /lang /recent\n\n` +
    `📞 Savol uchun: +998 94 217 10 10\n` +
    `💬 Telegram: @boomstroy_support`,
    { parse_mode: 'Markdown', ...mainMenuV2() }
  );
}

module.exports = { handleStart, handleContact, showWelcome, handleHelp, getOrCreateUser, handleCheckSub };
