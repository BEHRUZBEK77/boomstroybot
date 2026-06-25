const { Markup } = require('telegraf');

const CHANNEL_USERNAME = '@boomstroyqurilishsavdo';
const CHANNEL_LINK = 'https://t.me/boomstroyqurilishsavdo';

async function checkSubscription(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch {
    return false; // kanal topilmasa yoki xato bo'lsa, o'tkazib yubor
  }
}

async function sendSubscribePrompt(ctx) {
  await ctx.reply(
    `🏗️ *BoomStroy — Qurilish Materiallari*\n\n` +
    `Assalomu alaykum! 👋\n\n` +
    `🔔 Botdan foydalanish uchun avval rasmiy kanalimizga\n` +
    `a'zo bo'lishingiz kerak!\n\n` +
    `📢 *@boomstroyqurilishsavdo* kanalida:\n` +
    `• 🏷️ Eng yangi narxlar va aksiyalar\n` +
    `• 📦 Yangi mahsulotlar haqida xabarlar\n` +
    `• 🎁 Maxsus chegirmalar va takliflar\n\n` +
    `👇 Kanalga a'zo bo'ling va "✅ Tekshirish" tugmasini bosing:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 Kanalga A\'zo Bo\'lish', CHANNEL_LINK)],
        [Markup.button.callback('✅ A\'zo Bo\'ldim — Tekshirish', 'check_sub')],
      ])
    }
  );
}

module.exports = { checkSubscription, sendSubscribePrompt, CHANNEL_USERNAME, CHANNEL_LINK };
