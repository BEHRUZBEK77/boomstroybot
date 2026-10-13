// ════════════════════════════════════════════════════════════════════════════
// PREMIUM EMOJI, RANGLI TUGMALAR VA STIKERLAR
//
//  • Rangli tugmalar (style: success/danger/primary) — hamma uchun ishlaydi.
//  • Premium (custom) emoji ikonkalari — bot EGASIDA Telegram Premium bo'lsa
//    ishlaydi. Admin /emoji orqali oddiy emoji → premium emoji bog'laydi;
//    shu emoji bilan boshlanadigan BARCHA tugmalar avtomatik premium ikonka oladi.
//  • Stikerlar — /sticker orqali (salomlashish, buyurtma qabul qilindi va h.k.).
//
//  Sozlamalar Firestore: settings/premiumEmoji { map: {"🛒": "<id>"}, stickers: {...} }
// ════════════════════════════════════════════════════════════════════════════

const state = {
  map: {},          // admin qo'lda bog'lagan: oddiy emoji -> custom_emoji_id (ustun turadi)
  auto: {},         // Telegram rasmiy animatsion emojilaridan avtomatik
  stickers: {},     // slot -> sticker file_id
  iconsDisabled: false, // Telegram rad etsa (egasida Premium yo'q) — avtomatik o'chiriladi
  textDisabled: false,  // xabar matnidagi premium emoji uchun xuddi shunday
  textOkLogged: false,
  loaded: false,
};

const STICKER_SLOTS = {
  welcome: 'Salomlashish (/start)',
  order: 'Buyurtma qabul qilindi',
  delivered: 'Buyurtma yetkazildi',
  bonus: 'Kunlik bonus olindi',
};

function docRef() {
  const { getDb } = require('../services/firebase');
  return getDb().collection('settings').doc('premiumEmoji');
}

async function loadPremium() {
  try {
    const doc = await docRef().get();
    if (doc.exists) {
      const d = doc.data();
      state.map = d.map || {};
      state.stickers = d.stickers || {};
    }
    state.loaded = true;
    const n = Object.keys(state.map).length;
    if (n) console.log(`✨ Premium emoji: ${n} ta bog'langan, stikerlar: ${Object.keys(state.stickers).length}`);
  } catch (e) {
    console.error('Premium sozlamalarini yuklab bo\'lmadi:', e.message);
  }
}

async function save() {
  await docRef().set({ map: state.map, stickers: state.stickers, updatedAt: new Date() }, { merge: false });
}

// ── MINIMALISTIK EMOJI TO'PLAMI ──────────────────────────────────────────────
// Botdagi har bir emoji Telegram rasmiy premium to'plamidagi ma'nosi yaqin
// emojiga almashtiriladi. '' — emoji olib tashlanadi (bezak, tugma rangi o'zi
// ma'noni beradi). Natija: barcha emojilar animatsion premium.
const EMOJI_REPLACE = {
  '❌': '❗', '⚠': '❗', '⛔': '❗', '🆘': '❗', '🛑': '❗', '🔴': '❗',
  '📋': '📝', '🧾': '📝', '📒': '📚',
  '🎁': '💎', '✨': '⭐', '🙏': '❤', '💔': '❤', '👋': '🎉', '💥': '🔥', '🆕': '🔥',
  '🏪': '🏛', '🏗': '🏛', '🏙': '🏛', '🏦': '🏛', '🏭': '💼',
  '📍': '🏁', '🗺': '🏁', '📌': '🔝',
  '📦': '🛍', '🚚': '🚗', '📏': '🚗',
  '🌐': '💻', '⚙': '💻', '🔗': '💻',
  '💳': '💸', '🆔': '🪪', '👤': '🪪', '🔐': '🪪', '👥': '🗣',
  '⏳': '📆', '🕐': '📆', '⏰': '📆', '📅': '📆',
  '📢': '📣', '🔔': '📣', '📤': '📣',
  'ℹ': '💡', '📐': '🧮', '🔧': '🧪', '🔄': '⚡', '🚀': '⚡', '🟡': '⚡', '🟢': '✅',
  '🏷': '🎟', '🔖': '🎟', '✏': '✍', '📲': '📱', '📧': '💬', '📩': '💬', '👁': '👀',
  '🥉': '🎖', '🥈': '🎖', '🥇': '🏆',
  '🔙': '', '🗑': '', '🧹': '', '👇': '', '⏭': '', '🇺🇿': '', '🇷🇺': '', '🇬🇧': '',
};
// Belgilar (emoji emas) — minimalistik
const SYMBOL_REPLACE = { '⬅': '‹', '➡': '›', '➕': '+', '➖': '−' };

const ANY_EMOJI_RE = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator})*/gu;

function replaceEmojis(text) {
  if (typeof text !== 'string' || !text) return text;
  const out = text.replace(ANY_EMOJI_RE, (m) => {
    const k = m.replace(/\uFE0F/g, '');
    if (k in SYMBOL_REPLACE) return SYMBOL_REPLACE[k];
    if (k in EMOJI_REPLACE) return EMOJI_REPLACE[k] ? EMOJI_REPLACE[k] : '\u0000';
    return m;
  });
  // olib tashlangan emojidan keyingi ortiqcha bo'shliqni ham tozalaymiz
  return out.includes('\u0000') ? out.replace(/\u0000[ \t]?/g, '').replace(/^[ \t]+/gm, (sp) => sp) : out;
}

// ── Emoji yordamchilari ──────────────────────────────────────────────────────
// Matn boshidagi emoji klasterini ajratadi ("🛒 Savat" → ["🛒", "Savat"])
const LEADING_EMOJI_RE = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍(?:\p{Extended_Pictographic})|\p{Emoji_Modifier}|\p{Regional_Indicator})*)\s*/u;

function splitLeadingEmoji(text) {
  const m = String(text || '').match(LEADING_EMOJI_RE);
  if (!m) return [null, text];
  return [m[1], text.slice(m[0].length)];
}
const baseEmoji = (e) => String(e || '').replace(/️/g, '');

function stripLeadingEmoji(text) {
  const [, rest] = splitLeadingEmoji(text);
  return rest;
}

function effectiveMap() { return { ...state.auto, ...state.map }; }

function customIdFor(emoji) {
  if (!emoji || state.iconsDisabled) return null;
  const m = effectiveMap();
  return m[emoji] || m[baseEmoji(emoji)] || null;
}

// Ma'nosi bir xil bo'lgan o'xshash emojilar (to'plamda aynan shunisi bo'lmasa)
const ALIASES = { '🔍': '🔎', '📂': '📁', '📊': '📈', '📞': '📱', '☎': '📱', '💵': '💰', '💸': '💰' };

// Telegram'ning rasmiy animatsion custom emojilarini yuklaydi (har qanday bot uchun ochiq).
// Qo'shimcha to'plamlar: PREMIUM_EMOJI_PACKS=pack1,pack2 (t.me/addemoji/<nom>)
async function autoLoadEmoji(telegram) {
  const auto = {};
  const add = (st) => {
    if (!st?.custom_emoji_id || !st.emoji) return;
    const k = baseEmoji(st.emoji);
    if (!auto[k]) auto[k] = st.custom_emoji_id;
  };
  try {
    const icons = await telegram.callApi('getForumTopicIconStickers', {});
    (icons || []).forEach(add);
  } catch (e) {
    console.warn('Premium emoji (rasmiy) yuklanmadi:', e.message);
  }
  for (const name of String(process.env.PREMIUM_EMOJI_PACKS || '').split(',').map(x => x.trim()).filter(Boolean)) {
    try {
      const set = await telegram.callApi('getStickerSet', { name });
      (set?.stickers || []).forEach(add);
    } catch (e) {
      console.warn(`Premium emoji to'plami "${name}" yuklanmadi:`, e.message);
    }
  }
  for (const [from, to] of Object.entries(ALIASES)) if (!auto[from] && auto[to]) auto[from] = auto[to];
  state.auto = auto;
  console.log(`✨ Premium emoji: ${Object.keys(auto).length} ta avtomatik, qo'lda: ${Object.keys(state.map).length}`);
  console.log(`✨ Premium ro'yxat: ${Object.keys(auto).join(' ')}`);
}

// ── Tugma ranglari (callback_data bo'yicha) ──────────────────────────────────
const STYLE_RULES = [
  [/^(order_confirm|order_start|qty_confirm:|cart_add:|cart_inc:|admin_confirm:|admin_pay_ok:|admin_deliver:|reward_redeem:|loyalty_daily|check_sub|fav_add_all_cart|pay_cash|pay_card|recv_|pickup_wh:|send_location|wh_add|support_new)/, 'success'],
  [/^(cancel_order|cart_clear|cart_dec:|admin_cancel:|admin_pay_fail:|wh_del:|stk_del:|review_cancel)/, 'danger'],
];
function styleForCallback(data) {
  for (const [re, st] of STYLE_RULES) if (re.test(data)) return st;
  return null;
}

// Reply-klaviatura tugmalari ranglari (matn kaliti bo'yicha)
let replyStyles = null;
function styleForReplyText(text) {
  if (!replyStyles) {
    const { variants } = require('./i18n');
    replyStyles = new Map();
    const set = (key, st) => variants(key).forEach(v => {
      replyStyles.set(v, st);
      replyStyles.set(stripLeadingEmoji(v), st);
    });
    set('cancel', 'danger');
    set('m_cart', 'success');
    set('am_userMenu', 'success');
    set('btnSharePhone', 'success');
    set('btnSendLocation', 'success');
  }
  return replyStyles.get(text) || null;
}

function decorateButton(btn, isReply) {
  if (!btn || typeof btn !== 'object' || typeof btn.text !== 'string') return btn;
  const out = { ...btn, text: replaceEmojis(btn.text).trim() || btn.text };

  if (!out.style) {
    const st = isReply ? styleForReplyText(btn.text) : (out.callback_data ? styleForCallback(out.callback_data) : null);
    out.style = st || 'primary'; // barcha tugmalar rangli
  }

  if (!out.icon_custom_emoji_id) {
    const [emoji, rest] = splitLeadingEmoji(out.text);
    const id = customIdFor(emoji);
    if (id && rest.trim()) {
      out.icon_custom_emoji_id = id;
      out.text = rest;
    } else if (emoji && rest.trim() && !state.iconsDisabled && Object.keys(state.auto).length) {
      // Premium varianti yo'q emoji (masalan, bazadagi bo'lim ikonkasi) — minimalistik: olib tashlaymiz
      out.text = rest;
    }
  }
  return out;
}

// reply_markup ni bezaydi (inline va oddiy klaviatura)
function decorateMarkup(markup) {
  if (!markup || typeof markup !== 'object') return markup;
  if (Array.isArray(markup.inline_keyboard)) {
    return { ...markup, inline_keyboard: markup.inline_keyboard.map(r => r.map(b => decorateButton(b, false))) };
  }
  if (Array.isArray(markup.keyboard)) {
    return {
      ...markup,
      keyboard: markup.keyboard.map(r => r.map(b => decorateButton(typeof b === 'string' ? { text: b } : b, true))),
    };
  }
  return markup;
}

function hasIcons(markup) {
  const rows = markup?.inline_keyboard || markup?.keyboard || [];
  return rows.some(r => r.some(b => b && b.icon_custom_emoji_id));
}
function stripIcons(markup) {
  const strip = (b) => {
    if (!b || !b.icon_custom_emoji_id) return b;
    const { icon_custom_emoji_id, ...rest } = b;
    // Ikonka o'rniga oddiy emojini matnga qaytaramiz
    const m = effectiveMap();
    const emoji = Object.keys(m).find(k => m[k] === icon_custom_emoji_id);
    return { ...rest, text: emoji ? `${emoji} ${rest.text}` : rest.text };
  };
  if (markup?.inline_keyboard) return { ...markup, inline_keyboard: markup.inline_keyboard.map(r => r.map(strip)) };
  if (markup?.keyboard) return { ...markup, keyboard: markup.keyboard.map(r => r.map(strip)) };
  return markup;
}
function disableIcons(reason) {
  if (state.iconsDisabled) return;
  state.iconsDisabled = true;
  console.warn(`⚠️ Premium ikonkalar o'chirildi: ${reason}. Bot egasida Telegram Premium faolligini tekshiring.`);
}

// ── Xabar matnidagi premium emoji ───────────────────────────────────────────
const TEXT_METHODS = {
  sendMessage: ['text', 'entities'],
  editMessageText: ['text', 'entities'],
  sendPhoto: ['caption', 'caption_entities'],
  sendVideo: ['caption', 'caption_entities'],
  sendAnimation: ['caption', 'caption_entities'],
  sendDocument: ['caption', 'caption_entities'],
  editMessageCaption: ['caption', 'caption_entities'],
};

// Markdown matnni entities'ga o'girib, oddiy emojilarga premium emoji qo'shadi.
// O'zgartirish kerak bo'lmasa — null qaytaradi.
// Xabar matnidagi emojilarni minimalistik to'plamga almashtiradi (premiumdan qat'i nazar)
function normalizeText(method, payload) {
  const spec = TEXT_METHODS[method];
  if (!spec) return payload;
  const field = spec[0];
  if (typeof payload[field] !== 'string' || payload[spec[1]]) return payload;
  const replaced = replaceEmojis(payload[field]);
  return replaced === payload[field] ? payload : { ...payload, [field]: replaced };
}

function decorateText(method, payload) {
  if (state.textDisabled) return null;
  const map = effectiveMap();
  if (!Object.keys(map).length) return null;
  const spec = TEXT_METHODS[method];
  if (!spec) return null;
  const [field, entField] = spec;
  const text = payload[field];
  if (typeof text !== 'string' || !text) return null;
  if (payload[entField]) return null;
  const pm = payload.parse_mode;
  if (pm && pm !== 'Markdown') return null; // HTML/MarkdownV2 ga tegmaymiz

  const { parseMarkdownV1, addCustomEmoji } = require('./mdEntities');
  const parsed = pm === 'Markdown' ? parseMarkdownV1(text) : { text, entities: [] };
  const entities = addCustomEmoji(parsed.text, parsed.entities, map);
  if (!entities.some(e => e.type === 'custom_emoji')) return null;

  const out = { ...payload, [field]: parsed.text, [entField]: entities };
  delete out.parse_mode;
  return out;
}
function disableText(reason) {
  if (state.textDisabled) return;
  state.textDisabled = true;
  console.warn(`⚠️ Xabarlardagi premium emoji o'chirildi: ${reason}. Bot egasida (BotFather'da botni yaratgan akkauntda) Telegram Premium bo'lishi kerak.`);
}
function iconsWorked() {
  if (state.iconsOkLogged) return;
  state.iconsOkLogged = true;
  console.log('✨ Premium ikonkali tugmalar muvaffaqiyatli yuborildi');
}
function textWorked() {
  if (state.textOkLogged) return;
  state.textOkLogged = true;
  console.log('✨ Premium emoji xabarda muvaffaqiyatli yuborildi');
}

// ── Stikerlar ────────────────────────────────────────────────────────────────
async function sendSticker(telegram, chatId, slot) {
  const id = state.stickers[slot];
  if (!id) return;
  await telegram.sendSticker(chatId, id).catch(() => { });
}

module.exports = {
  state, STICKER_SLOTS, loadPremium, save,
  splitLeadingEmoji, stripLeadingEmoji, baseEmoji,
  decorateMarkup, hasIcons, stripIcons, disableIcons, sendSticker,
  decorateText, normalizeText, replaceEmojis, disableText, textWorked, iconsWorked, autoLoadEmoji, effectiveMap,
};
