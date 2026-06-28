const { queryDocs, updateDoc } = require('../services/firebase');
const { getSession, setSession } = require('../services/session');
const { fmtNum, fmtDate, escapeMarkdown } = require('../utils/helpers');
const { mainMenu, sharePhoneButton, sendLocationButton } = require('../utils/keyboards');
const { t, langOf, SITE_URL } = require('../utils/i18n');
const { Markup } = require('telegraf');
const { checkDelivery, WAREHOUSE, BASE_FEE, PER_KM, MAX_KM } = require('../services/delivery');

const SUPPORT_PHONE = process.env.SUPPORT_PHONE || '+998 94 217 10 10';
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || '@boomstroy_support';
const EMAIL = process.env.SUPPORT_EMAIL || 'info@boomstroy.uz';
const BOT_USERNAME = '@' + (process.env.BOT_USERNAME || 'BoomStroyBot').replace('@', '');

async function handleProfile(ctx) {
  const lang = langOf(ctx);
  const tgId = String(ctx.from.id);
  const users = await queryDocs('telegramUsers', 'telegramId', '==', tgId);
  const user = users[0];
  if (!user) return ctx.reply(t(lang, 'pressStart'));

  const orders = await queryDocs('orders', 'telegramId', '==', tgId);
  const delivered = orders.filter(o => o.status === 'delivered');

  const text = t(lang, 'profileTitle', {
    name: `${escapeMarkdown(user.firstName)} ${escapeMarkdown(user.lastName || '')}`.trim(),
    phone: user.phone || t(lang, 'phoneNotSet'),
    id: user.telegramId,
    orders: orders.length,
    delivered: delivered.length,
    spent: fmtNum(user.totalSpent || 0),
    points: fmtNum(user.loyaltyPoints || 0),
    som: t(lang, 'som'),
    date: fmtDate(user.createdAt),
  });

  const kb = Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'btnMyOrders'), 'my_orders')],
    [Markup.button.callback(t(lang, 'btnChangePhone'), 'change_phone')],
  ]);

  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
}

async function handleChangePhone(ctx) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'change_phone' });
  await ctx.reply(t(lang, 'changePhonePrompt'), sharePhoneButton(lang));
}

async function handleUpdatePhone(ctx) {
  const lang = langOf(ctx);
  const s = getSession(ctx.from.id);
  if (s.step !== 'change_phone') return;

  const phone = ctx.message.contact?.phone_number;
  if (!phone) return ctx.reply(t(lang, 'phoneShareHint'));

  const tgId = String(ctx.from.id);
  const users = await queryDocs('telegramUsers', 'telegramId', '==', tgId);
  if (users[0]) await updateDoc('telegramUsers', users[0].id, { phone });

  setSession(ctx.from.id, { step: null });
  await ctx.reply(t(lang, 'phoneUpdated'), { reply_markup: { remove_keyboard: true } });
  await ctx.reply(t(lang, 'mainMenuTitle'), mainMenu(lang));
}

async function handleDeliveryInfo(ctx) {
  const lang = langOf(ctx);
  const text = t(lang, 'deliveryInfo', {
    wh: WAREHOUSE.name,
    base: fmtNum(BASE_FEE),
    perkm: fmtNum(PER_KM),
    maxkm: MAX_KM,
    som: t(lang, 'som'),
    support: SUPPORT_USERNAME,
  });
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'btnCheckMyAddress'), 'check_my_location')],
  ]);
  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
}

async function handleCheckMyLocation(ctx) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'check_location_only' });
  await ctx.reply(t(lang, 'checkAddrPrompt'), sendLocationButton(lang));
}

async function handleLocationCheckOnly(ctx) {
  const lang = langOf(ctx);
  const s = getSession(ctx.from.id);
  if (s.step !== 'check_location_only') return;

  const { latitude: lat, longitude: lng } = ctx.message.location;
  setSession(ctx.from.id, { step: null });

  await ctx.reply(t(lang, 'checking'), { reply_markup: { remove_keyboard: true } });
  const result = await checkDelivery(lat, lng, 1, lang);

  if (!result.success) {
    await ctx.reply(result.message, { parse_mode: 'Markdown', ...mainMenu(lang) });
  } else {
    const text = t(lang, 'deliverableMsg', {
      city: result.city || result.address,
      dist: result.distance,
      fee: fmtNum(result.deliveryFee),
      breakdown: result.breakdown,
      maps: result.mapsLink,
      som: t(lang, 'som'),
    });
    await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true, ...mainMenu(lang) });
  }
}

// Joriy lokatsiyani aniqlash uchun (faqat tekshiruv emas, asosiy buyurtma oqimida ham foydalaniladi)
async function handleLocationCheckOnlyAlias(ctx) { return handleLocationCheckOnly(ctx); }

async function handleContact(ctx) {
  const lang = langOf(ctx);
  const text = t(lang, 'contactInfo', {
    phone: SUPPORT_PHONE,
    support: SUPPORT_USERNAME,
    email: EMAIL,
    site: SITE_URL,
    wh: WAREHOUSE.name,
  });
  await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true, ...mainMenu(lang) });
}

async function handleAbout(ctx) {
  const lang = langOf(ctx);
  const text = t(lang, 'aboutInfo', { site: SITE_URL, bot: BOT_USERNAME });
  await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true, ...mainMenu(lang) });
}

async function handleSales(ctx) {
  const lang = langOf(ctx);
  const text = t(lang, 'salesInfo', { som: t(lang, 'som') });
  await ctx.reply(text, { parse_mode: 'Markdown', ...mainMenu(lang) });
}

// "Bizning sayt" tugmasi
async function handleWebsite(ctx) {
  const lang = langOf(ctx);
  const { websiteButton } = require('../utils/keyboards');
  await ctx.reply(t(lang, 'websiteTitle'), { parse_mode: 'Markdown', disable_web_page_preview: true, ...websiteButton(lang) });
}

module.exports = {
  handleProfile, handleChangePhone, handleUpdatePhone,
  handleDeliveryInfo, handleCheckMyLocation, handleLocationCheckOnly,
  handleContact, handleAbout, handleSales, handleWebsite,
};
