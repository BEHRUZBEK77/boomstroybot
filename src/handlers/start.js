const { getSession, setSession } = require('../services/session');
const { queryDocs, addDoc, updateDoc } = require('../services/firebase');
const { mainMenu, sharePhoneButton, adminMainMenu } = require('../utils/keyboards');
const { t, langOf, normalizeLang } = require('../utils/i18n');
const cfg = require('../services/config');
const { Markup } = require('telegraf');

const { ADMIN_IDS } = require('../utils/admins');

function defaultUserShape(ctx, extra = {}) {
  const tgId = String(ctx.from.id);
  return {
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
    lang: normalizeLang(ctx.from.language_code),
    ...extra,
  };
}

async function getOrCreateUser(ctx) {
  const tgId = String(ctx.from.id);
  const existing = await queryDocs('telegramUsers', 'telegramId', '==', tgId);
  if (existing.length > 0) return existing[0];

  const newUser = defaultUserShape(ctx);
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
  const lang = normalizeLang(user.lang || ctx.state.lang);
  ctx.state.lang = lang;
  setSession(ctx.from.id, { user });
  await require('../utils/premium').sendSticker(ctx.telegram, ctx.chat.id, 'welcome');

  // Admin uchun alohida menyu
  if (ctx.state.isAdmin) {
    await ctx.reply(t(lang, 'adminWelcome', { name: require('../utils/helpers').escapeMarkdown(user.firstName) }), { parse_mode: 'Markdown', ...adminMainMenu(lang) });
    return;
  }

  await handleReferralFromStart(ctx, user);

  if (!user.phone) {
    await ctx.reply(t(lang, 'askPhone', { name: require('../utils/helpers').escapeMarkdown(user.firstName) || t(lang, 'dearCustomer') }),
      { parse_mode: 'Markdown', ...sharePhoneButton(lang) });
    setSession(ctx.from.id, { step: 'waiting_phone' });
    return;
  }

  await showWelcome(ctx, user);
}

// Eski xabarlardagi "A'zo bo'ldim" tugmasi — kanal tekshiruvi olib tashlangan, shunchaki davom etadi
async function handleCheckSub(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery().catch(() => {});
  await ctx.deleteMessage().catch(() => {});

  const user = await getOrCreateUser(ctx);

  if (!user.phone) {
    await ctx.reply(t(lang, 'askPhone', { name: require('../utils/helpers').escapeMarkdown(user.firstName) || t(lang, 'dearCustomer') }), { parse_mode: 'Markdown', ...sharePhoneButton(lang) });
    setSession(ctx.from.id, { step: 'waiting_phone', user });
    return;
  }

  await showWelcome(ctx, user);
}

async function handleContact(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'waiting_phone') return;
  const lang = langOf(ctx);

  const phone = ctx.message.contact?.phone_number;
  if (!phone) return ctx.reply(t(lang, 'sharePhoneHint'));

  const tgId = String(ctx.from.id);
  const existing = await queryDocs('telegramUsers', 'telegramId', '==', tgId);

  let user;
  if (existing.length > 0) {
    await updateDoc('telegramUsers', existing[0].id, { phone });
    user = { ...existing[0], phone };
  } else {
    const newUser = defaultUserShape(ctx, { phone });
    const id = await addDoc('telegramUsers', newUser);
    user = { id, ...newUser };
  }

  setSession(ctx.from.id, { user, step: null });
  await ctx.reply(t(lang, 'registered'), { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
  await showWelcome(ctx, user);
}

async function showWelcome(ctx, user) {
  const lang = normalizeLang(user.lang || ctx.state.lang);
  ctx.state.lang = lang;
  await ctx.reply(
    t(lang, 'welcome', { name: require('../utils/helpers').escapeMarkdown(user.firstName), phone: cfg.get('supportPhone'), site: cfg.get('siteUrl') }),
    { parse_mode: 'Markdown', ...mainMenu(lang) }
  );
}

async function handleHelp(ctx) {
  const lang = langOf(ctx);
  await ctx.reply(
    t(lang, 'help', { phone: cfg.get('supportPhone'), site: cfg.get('siteUrl') }),
    { parse_mode: 'Markdown', ...mainMenu(lang) }
  );
}

module.exports = { handleStart, handleContact, showWelcome, handleHelp, getOrCreateUser, handleCheckSub };
