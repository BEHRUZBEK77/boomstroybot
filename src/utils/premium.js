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
  map: {},          // oddiy emoji -> custom_emoji_id
  stickers: {},     // slot -> sticker file_id
  iconsDisabled: false, // Telegram rad etsa (egasida Premium yo'q) — avtomatik o'chiriladi
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

function customIdFor(emoji) {
  if (!emoji || state.iconsDisabled) return null;
  return state.map[emoji] || state.map[baseEmoji(emoji)] || null;
}

// ── Tugma ranglari (callback_data bo'yicha) ──────────────────────────────────
const STYLE_RULES = [
  [/^(order_confirm|qty_confirm:|cart_add:|admin_confirm:|admin_pay_ok:|admin_deliver:|reward_redeem:|loyalty_daily|check_sub|fav_add_all_cart)/, 'success'],
  [/^(cancel_order|cart_clear|admin_cancel:|admin_pay_fail:|wh_del:|review_cancel)/, 'danger'],
  [/^(order_start|view_cart|search_start|admin_ship:)/, 'primary'],
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
    set('m_products', 'primary');
    set('m_cart', 'success');
    set('btnSharePhone', 'success');
    set('btnSendLocation', 'success');
  }
  return replyStyles.get(text) || null;
}

function decorateButton(btn, isReply) {
  if (!btn || typeof btn !== 'object' || typeof btn.text !== 'string') return btn;
  const out = { ...btn };

  if (!out.style) {
    const st = isReply ? styleForReplyText(out.text) : (out.callback_data ? styleForCallback(out.callback_data) : null);
    if (st) out.style = st;
  }

  if (!out.icon_custom_emoji_id) {
    const [emoji, rest] = splitLeadingEmoji(out.text);
    const id = customIdFor(emoji);
    if (id && rest.trim()) {
      out.icon_custom_emoji_id = id;
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
    const emoji = Object.keys(state.map).find(k => state.map[k] === icon_custom_emoji_id);
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
};
