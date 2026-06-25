const { queryDocs, updateDoc } = require('../services/firebase');
const { getSession, setSession } = require('../services/session');
const { fmtNum, fmtDate } = require('../utils/helpers');
const { mainMenu, sharePhoneButton } = require('../utils/keyboards');
const { Markup } = require('telegraf');
const { checkDelivery } = require('../services/delivery');
const { WAREHOUSE, BASE_FEE, PER_KM, MAX_KM, RESTRICTED_KEYWORDS } = require('../services/delivery');

async function handleProfile(ctx) {
  const tgId = String(ctx.from.id);
  const users = await queryDocs('telegramUsers', 'telegramId', '==', tgId);
  const user = users[0];

  if (!user) return ctx.reply('Ro\'yxatdan o\'tmadingiz. /start bosing.');

  const orders = await queryDocs('orders', 'telegramId', '==', tgId);
  const delivered = orders.filter(o => o.status === 'delivered');
  const { escapeMarkdown } = require('../utils/helpers');

  const text =
    `👤 *Profilim*\n\n` +
    `Ism: *${escapeMarkdown(user.firstName)} ${escapeMarkdown(user.lastName || '')}*\n` +
    `📱 Telefon: ${user.phone || 'Belgilanmagan'}\n` +
    `🆔 ID: ${user.telegramId}\n\n` +
    `📋 Jami buyurtmalar: *${orders.length}*\n` +
    `✅ Yetkazilgan: *${delivered.length}*\n` +
    `💰 Jami xarid: *${fmtNum(user.totalSpent || 0)} so'm*\n\n` +
    `📅 Ro'yxatdan: ${fmtDate(user.createdAt)}`;

  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('📋 Buyurtmalarim', 'my_orders')],
    [Markup.button.callback('📱 Raqamni o\'zgartirish', 'change_phone')],
  ]);

  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
}

async function handleChangePhone(ctx) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'change_phone' });
  await ctx.reply('📱 Yangi telefon raqamingizni ulashing:', sharePhoneButton());
}

async function handleUpdatePhone(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'change_phone') return;

  const phone = ctx.message.contact?.phone_number;
  if (!phone) return ctx.reply('Iltimos, tugmani bosib raqam ulashing.');

  const tgId = String(ctx.from.id);
  const users = await queryDocs('telegramUsers', 'telegramId', '==', tgId);
  if (users[0]) await updateDoc('telegramUsers', users[0].id, { phone });

  setSession(ctx.from.id, { step: null });
  await ctx.reply('✅ Telefon raqami yangilandi!', { reply_markup: { remove_keyboard: true } });
  await ctx.reply('Bosh menyu:', mainMenu());
}

async function handleDeliveryInfo(ctx) {
  const { escapeMarkdown } = require('../utils/helpers');
  const text =
    `🚚 *Yetkazib Berish Ma'lumotlari*\n\n` +
    `🏭 Ombor: ${escapeMarkdown(WAREHOUSE.name)}\n\n` +
    `💰 *Narx:*\n` +
    `• Boshlang'ich: ${fmtNum(BASE_FEE)} so'm\n` +
    `• + Har km uchun: ${fmtNum(PER_KM)} so'm\n` +
    `• Maksimal masofa: ${MAX_KM} km\n\n` +
    `📦 *Ko'p buyurtmada chegirma:*\n` +
    `• 3+ buyurtma: 5% chegirma\n` +
    `• 5+ buyurtma: 10% chegirma\n` +
    `• 10+ buyurtma: 15% chegirma\n\n` +
    `❌ *Yetkazib berilmaydigan hududlar:*\n` +
    `• Bo'ka tumani\n` +
    `• 50 km dan uzoq hududlar\n` +
    `• Viloyat markazlaridan uzoq qishloqlar\n\n` +
    `⏰ *Yetkazish vaqti:*\n` +
    `• 0–10 km: 1–2 soat\n` +
    `• 10–30 km: 2–4 soat\n` +
    `• 30–50 km: 4–8 soat\n\n` +
    `📞 Savol: @boomstroy\\_support`;

  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('📍 Manzilimni tekshirish', 'check_my_location')],
  ]);
  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
}

async function handleCheckMyLocation(ctx) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'check_location_only' });
  const { sendLocationButton } = require('../utils/keyboards');
  await ctx.reply('📍 Joylashuvingizni yuboring — yetkazib berish narxini hisoblayman:', sendLocationButton());
}

async function handleLocationCheckOnly(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'check_location_only') return;

  const { latitude: lat, longitude: lng } = ctx.message.location;
  setSession(ctx.from.id, { step: null });

  await ctx.reply('⏳ Tekshirilmoqda...', { reply_markup: { remove_keyboard: true } });
  const result = await checkDelivery(lat, lng, 1);

  if (!result.success) {
    await ctx.reply(result.message, { parse_mode: 'Markdown', ...mainMenu() });
  } else {
    const { escapeMarkdown } = require('../utils/helpers');
    const text =
      `✅ *Yetkazib beriladi!*\n\n` +
      `📍 Manzil: ${escapeMarkdown(result.city || result.address)}\n` +
      `📏 Masofa: ${result.distance} km\n\n` +
      `💰 *Yetkazib berish narxi:*\n` +
      `${fmtNum(result.deliveryFee)} so'm\n` +
      `(${escapeMarkdown(result.breakdown)})\n\n` +
      `🗺️ [Google Maps](${result.mapsLink})`;
    await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true, ...mainMenu() });
  }
}

async function handleContact(ctx) {
  const { escapeMarkdown } = require('../utils/helpers');
  const text =
    `📞 *Biz bilan bog'laning*\n\n` +
    `📱 Telefon: +998 94 217 10 10\n` +
    `💬 Telegram: @boomstroy\\_support\n` +
    `📧 Email: info@boomstroy.uz\n` +
    `📍 Manzil: ${escapeMarkdown(WAREHOUSE.name)}\n\n` +
    `⏰ Ish vaqti:\n` +
    `Du–Sh: 09:00 – 18:00\n` +
    `Yak: 10:00 – 15:00`;

  await ctx.reply(text, { parse_mode: 'Markdown', ...mainMenu() });
}

async function handleAbout(ctx) {
  const text =
    `🏗️ *BoomStroy Haqida*\n\n` +
    `BoomStroy — Toshkentdagi yetakchi qurilish materiallari do'koni.\n\n` +
    `✅ *Afzalliklarimiz:*\n` +
    `• 10 yildan ortiq tajriba\n` +
    `• 5000+ mahsulot assortimenti\n` +
    `• Sifat kafolati\n` +
    `• Tez yetkazib berish\n` +
    `• Eng arzon narxlar\n\n` +
    `🌐 Sayt: shop.boom-stroy.netlify.app\n` +
    `📱 Bot: @BoomStroyBot`;

  await ctx.reply(text, { parse_mode: 'Markdown', ...mainMenu() });
}

async function handleSales(ctx) {
  const text =
    `⭐ *Aksiyalar va Chegirmalar*\n\n` +
    `🎁 *Faol aksiyalar:*\n` +
    `• 3+ mahsulot — 5% chegirma\n` +
    `• 5+ mahsulot — 10% chegirma\n` +
    `• 10+ mahsulot — 15% chegirma\n\n` +
    `🚚 *Yetkazib berish chegirmasi:*\n` +
    `• Ko'p buyurtmada kumulyativ chegirma\n\n` +
    `📢 Yangi aksiyalar uchun kanalimizga a'zo bo'ling!\n` +
    `👉 @boomstroy\\_channel`;

  await ctx.reply(text, { parse_mode: 'Markdown', ...mainMenu() });
}

module.exports = {
  handleProfile, handleChangePhone, handleUpdatePhone,
  handleDeliveryInfo, handleCheckMyLocation, handleLocationCheckOnly,
  handleContact, handleAbout, handleSales,
};
