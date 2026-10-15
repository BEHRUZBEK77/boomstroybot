// Admin: premium emoji va stikerlarni sozlash (/emoji, /sticker)
const { Markup } = require('telegraf');
const { setSession, getSession } = require('../services/session');
const premium = require('../utils/premium');
const { T_KEYS_EMOJIS } = require('./premiumEmojiList');

function isAdminCtx(ctx) { return ctx.state?.isAdmin; }

async function notAdmin(ctx) {
  console.log(`ℹ️ Admin bo'lmagan foydalanuvchi admin buyrug'ini yubordi: ${ctx.from.id}`);
  return ctx.reply(
    `⛔ Bu buyruq faqat adminlar uchun.\n\nSizning Telegram ID: \`${ctx.from.id}\`\n` +
    `Admin bo'lish uchun Railway → Variables → ADMIN_EXTRA_IDS ga shu raqamni qo'shing.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleEmojiCommand(ctx) {
  if (!isAdminCtx(ctx)) return notAdmin(ctx);
  const arg = (ctx.message?.text || '').split(/\s+/)[1];
  if (arg === 'reset') {
    premium.state.map = {};
    premium.state.iconsDisabled = false;
    await premium.save();
    return ctx.reply("🧹 Barcha premium emoji bog'lanishlari o'chirildi.");
  }

  const mapped = Object.keys(premium.effectiveMap());
  const suggestions = T_KEYS_EMOJIS.filter(e => !premium.effectiveMap()[e]).slice(0, 40).join(' ');

  setSession(ctx.from.id, { step: 'premium_emoji' });
  await ctx.reply(
    '✨ *Premium emoji sozlash*\n\n' +
    'Har bir qatorga avval *oddiy emoji*, keyin uning o\'rniga chiqadigan *premium emoji*ni yozib yuboring:\n\n' +
    '`🛒 ` + premium savat\n`📦 ` + premium quti\n\n' +
    'Bir xabarda istalgancha qator bo\'lishi mumkin. Faqat premium emoji yuborsangiz, uning asosidagi emoji avtomatik olinadi.\n\n' +
    `✅ Bog'langan (${mapped.length}): ${mapped.join(' ') || '—'}\n` +
    (suggestions ? `\n💡 Botda ishlatiladigan emojilar:\n${suggestions}\n` : '') +
    (premium.state.iconsDisabled ? '\n⚠️ Telegram premium ikonkalarni rad etdi — bot egasining akkauntida *Telegram Premium* faol bo\'lishi kerak.\n' : '') +
    '\nHammasini o\'chirish: `/emoji reset`\nBekor qilish: /cancel',
    { parse_mode: 'Markdown' }
  );
}

// Admin yuborgan xabardan premium emojilarni ajratib oladi
async function handlePremiumEmojiText(ctx) {
  const msg = ctx.message;
  const text = msg.text || '';
  const ents = (msg.entities || []).filter(e => e.type === 'custom_emoji');
  setSession(ctx.from.id, { step: null });

  if (!ents.length) {
    return ctx.reply("❌ Xabarda premium emoji topilmadi. Premium emoji faqat Telegram Premium akkauntdan yuborilishi mumkin. Qayta urinish: /emoji");
  }

  const added = [];
  for (const e of ents) {
    const fallback = text.substr(e.offset, e.length);
    const lineStart = text.lastIndexOf('\n', e.offset - 1) + 1;
    const before = text.slice(lineStart, e.offset).trim();
    const [lead] = premium.splitLeadingEmoji(before);
    const key = premium.baseEmoji(lead || fallback);
    if (!key) continue;
    premium.state.map[key] = e.custom_emoji_id;
    added.push(`${key} → ${fallback}`);
  }
  premium.state.iconsDisabled = false;
  await premium.save();

  await ctx.reply(
    `✅ ${added.length} ta premium emoji saqlandi:\n${added.join('\n')}\n\nEndi shu emojilar bilan boshlanadigan tugmalar premium ikonka bilan chiqadi.`,
  );
}

async function handleStickerCommand(ctx) {
  if (!isAdminCtx(ctx)) return notAdmin(ctx);
  const rows = Object.entries(premium.STICKER_SLOTS).map(([slot, label]) => {
    const has = premium.state.stickers[slot];
    return [
      Markup.button.callback(`${has ? '✅' : '➕'} ${label}`, `stk:${slot}`),
      ...(has ? [Markup.button.callback('🗑', `stk_del:${slot}`)] : []),
    ];
  });
  await ctx.reply(
    '🎨 *Stikerlar*\n\nQaysi holat uchun stiker o\'rnatmoqchisiz? Tanlang, so\'ng stikerni yuboring (animatsion va video stikerlar ham bo\'ladi).',
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) }
  );
}

async function handleStickerSlot(ctx, slot) {
  await ctx.answerCbQuery();
  if (!premium.STICKER_SLOTS[slot]) return;
  setSession(ctx.from.id, { step: `premium_sticker:${slot}` });
  await ctx.reply(`📩 "${premium.STICKER_SLOTS[slot]}" uchun stikerni yuboring.\nBekor qilish: /cancel`);
}

async function handleStickerDelete(ctx, slot) {
  delete premium.state.stickers[slot];
  await premium.save();
  await ctx.answerCbQuery('🗑 O\'chirildi');
  return handleStickerCommand(ctx);
}

async function handleStickerMessage(ctx) {
  const s = getSession(ctx.from.id);
  if (!isAdminCtx(ctx) || !String(s.step || '').startsWith('premium_sticker:')) return false;
  const slot = s.step.split(':')[1];
  premium.state.stickers[slot] = ctx.message.sticker.file_id;
  await premium.save();
  setSession(ctx.from.id, { step: null });
  await ctx.reply(`✅ "${premium.STICKER_SLOTS[slot]}" stikeri saqlandi.`);
  return true;
}

module.exports = {
  handleEmojiCommand, handlePremiumEmojiText,
  handleStickerCommand, handleStickerSlot, handleStickerDelete, handleStickerMessage,
};
