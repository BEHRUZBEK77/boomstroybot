const { getCollection } = require('../services/firebase');
const { updateCart, getCart, clearCart, getCartTotal } = require('../services/session');
const { fmtNum, totalStock, maxOrderQty } = require('../utils/helpers');
const { cartActions } = require('../utils/keyboards');
const { t, langOf } = require('../utils/i18n');
const { Markup } = require('telegraf');

// Callback bo'lsa xabarni tahrirlaydi; rasmli xabar bo'lsa o'chirib, yangisini yuboradi
async function show(ctx, text, extra) {
  const msg = ctx.callbackQuery?.message;
  if (msg) {
    if (msg.photo || msg.caption !== undefined) {
      await ctx.deleteMessage().catch(() => { });
      return ctx.reply(text, extra);
    }
    try { return await ctx.editMessageText(text, extra); } catch { }
  }
  return ctx.reply(text, extra);
}

async function handleViewCart(ctx) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
  const cart = getCart(ctx.from.id);
  const som = t(lang, 'som');

  if (!cart.length) {
    return show(ctx, t(lang, 'cartEmpty'), Markup.inlineKeyboard([
      [Markup.button.callback(t(lang, 'btnProducts'), 'categories')],
      [Markup.button.callback(t(lang, 'btnSearch'), 'search_start')],
    ]));
  }

  const { escapeMarkdown } = require('../utils/helpers');
  let text = `${t(lang, 'cartTitle')}\n━━━━━━━━━━━━━━━━\n`;
  cart.forEach((item, i) => {
    text += `*${i + 1}.* ${escapeMarkdown(item.name)}\n` +
      `      ${item.qty} × ${fmtNum(item.price)} = *${fmtNum(item.qty * item.price)} ${som}*\n`;
  });
  const total = getCartTotal(ctx.from.id);
  const count = cart.reduce((a, i) => a + i.qty, 0);
  text += `━━━━━━━━━━━━━━━━\n🧾 ${t(lang, 'cartItemsCount', { n: cart.length, q: count })}\n` +
    `💰 *${t(lang, 'cartTotal')}: ${fmtNum(total)} ${som}*\n${t(lang, 'cartDeliverySeparate')}`;

  return show(ctx, text, { parse_mode: 'Markdown', ...cartActions(lang) });
}

async function handleAddToCart(ctx, productId) {
  const lang = langOf(ctx);
  const products = await getCollection('products');
  const p = products.find(x => x.id === productId);
  if (!p) return ctx.answerCbQuery(t(lang, 'productNotFound'), { show_alert: true });

  const cart = getCart(ctx.from.id);
  const currentQty = cart.find(i => i.productId === productId)?.qty || 0;

  if (currentQty >= maxOrderQty(p)) {
    return ctx.answerCbQuery(t(lang, 'cartNotEnough'), { show_alert: true });
  }

  updateCart(ctx.from.id, p, 1);
  await ctx.answerCbQuery(t(lang, 'cartAdded')).catch(() => { });
  const newCart = getCart(ctx.from.id);
  const item = newCart.find(i => i.productId === productId);

  const { productActionsV2 } = require('../utils/keyboards');
  const { isProductFavorite } = require('./loyalty');
  let isFav = false;
  try { isFav = await isProductFavorite(ctx.from.id, productId); } catch { }
  try {
    await ctx.editMessageReplyMarkup(productActionsV2(productId, item?.qty || 0, isFav, lang).reply_markup);
  } catch { }
}

async function handleDecFromCart(ctx, productId) {
  const lang = langOf(ctx);
  const cart = getCart(ctx.from.id);
  const item = cart.find(i => i.productId === productId);
  if (!item || item.qty <= 0) return ctx.answerCbQuery(t(lang, 'cartNotInCart'));

  const products = await getCollection('products');
  const p = products.find(x => x.id === productId);
  updateCart(ctx.from.id, p || { id: productId }, -1);

  const newCart = getCart(ctx.from.id);
  const newItem = newCart.find(i => i.productId === productId);
  await ctx.answerCbQuery(newItem ? t(lang, 'btnInCartQty', { n: newItem.qty }) : t(lang, 'cartItemRemoved'));

  const { productActionsV2 } = require('../utils/keyboards');
  const { isProductFavorite } = require('./loyalty');
  let isFav = false;
  try { isFav = await isProductFavorite(ctx.from.id, productId); } catch { }
  try {
    await ctx.editMessageReplyMarkup(productActionsV2(productId, newItem?.qty || 0, isFav, lang).reply_markup);
  } catch { }
}

async function handleClearCart(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  clearCart(ctx.from.id);
  await ctx.editMessageText(
    t(lang, 'cartCleared'),
    Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btnBackToProducts'), 'categories')]])
  );
}

function buildCartSummary(cart, lang = 'uz') {
  if (!cart.length) return t(lang, 'cartEmptyFirst');
  let text = `${t(lang, 'cartTitle')}\n`;
  let total = 0;
  cart.forEach((item, i) => {
    const sum = item.qty * item.price;
    total += sum;
    text += `${i + 1}. ${item.name} × ${item.qty} = ${fmtNum(sum)} ${t(lang, 'som')}\n`;
  });
  text += `\n💰 *${t(lang, 'cartTotal')}: ${fmtNum(total)} ${t(lang, 'som')}*`;
  return text;
}

module.exports = { handleViewCart, handleAddToCart, handleDecFromCart, handleClearCart, buildCartSummary };
