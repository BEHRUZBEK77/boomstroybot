const { Markup } = require('telegraf');
const { t, langOf } = require('../utils/i18n');

const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || '@boomstroyqurilishsavdo';
const CHANNEL_LINK = process.env.CHANNEL_LINK || 'https://t.me/boomstroyqurilishsavdo';

async function checkSubscription(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch {
    return false; // kanal topilmasa yoki xato bo'lsa, o'tkazib yubor
  }
}

async function sendSubscribePrompt(ctx) {
  const lang = langOf(ctx);
  await ctx.reply(
    t(lang, 'subPrompt'),
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url(t(lang, 'subBtnJoin'), CHANNEL_LINK)],
        [Markup.button.callback(t(lang, 'subBtnCheck'), 'check_sub')],
      ]),
    }
  );
}

module.exports = { checkSubscription, sendSubscribePrompt, CHANNEL_USERNAME, CHANNEL_LINK };
