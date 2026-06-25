const { getCollection } = require('../services/firebase');
const { getSession, setSession, updateCart, getCart, clearCart, getCartTotal } = require('../services/session');
const { fmtNum } = require('../utils/helpers');
const { cartActions, mainMenu, Markup: TMarkup } = require('../utils/keyboards');
const { Markup } = require('telegraf');

async function handleViewCart(ctx) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const cart = getCart(ctx.from.id);

  if (!cart.length) {
    const msg = '🛒 Savatingiz bo\'sh.\n\nMahsulotlar bo\'limiga o\'ting va tanlang!';
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('🛍️ Mahsulotlar', 'categories')],
    ]);
    if (ctx.callbackQuery) {
      return ctx.editMessageText(msg, kb);
    }
    return ctx.reply(msg, kb);
  }

  let text = '🛒 *Savatingiz:*\n━━━━━━━━━━━━━━━\n';
  for (const item of cart) {
    text += `• ${item.name}\n  ${item.qty} × ${fmtNum(item.price)} = *${fmtNum(item.qty * item.price)} so'm*\n`;
  }
  const total = getCartTotal(ctx.from.id);
  text += `━━━━━━━━━━━━━━━\n💰 *Jami: ${fmtNum(total)} so'm*\n_(yetkazib berish alohida)_`;

  if (ctx.callbackQuery) {
    try {
      return ctx.editMessageText(text, { parse_mode: 'Markdown', ...cartActions() });
    } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...cartActions() });
}

async function handleAddToCart(ctx, productId) {
  await ctx.answerCbQuery('✅ Savatga qo\'shildi');
  const products = await getCollection('products');
  const p = products.find(x => x.id === productId);
  if (!p) return ctx.answerCbQuery('❌ Mahsulot topilmadi');

  const cart = getCart(ctx.from.id);
  const currentQty = cart.find(i => i.productId === productId)?.qty || 0;

  if (currentQty >= (p.quantity || 0)) {
    return ctx.answerCbQuery('❌ Yetarli miqdor mavjud emas!', { show_alert: true });
  }

  updateCart(ctx.from.id, p, 1);
  const newCart = getCart(ctx.from.id);
  const item = newCart.find(i => i.productId === productId);

  // Update button
  const { productActions } = require('../utils/keyboards');
  try {
    await ctx.editMessageReplyMarkup(productActions(productId, item?.qty || 0).reply_markup);
  } catch { }
}

async function handleDecFromCart(ctx, productId) {
  const cart = getCart(ctx.from.id);
  const item = cart.find(i => i.productId === productId);
  if (!item || item.qty <= 0) return ctx.answerCbQuery('Savatingizda bu mahsulot yo\'q');

  const products = await getCollection('products');
  const p = products.find(x => x.id === productId);
  updateCart(ctx.from.id, p || { id: productId }, -1);

  const newCart = getCart(ctx.from.id);
  const newItem = newCart.find(i => i.productId === productId);
  await ctx.answerCbQuery(newItem ? `${newItem.qty} ta` : 'Savatdan olib tashlandi');

  const { productActions } = require('../utils/keyboards');
  try {
    await ctx.editMessageReplyMarkup(productActions(productId, newItem?.qty || 0).reply_markup);
  } catch { }
}

async function handleClearCart(ctx) {
  await ctx.answerCbQuery();
  clearCart(ctx.from.id);
  await ctx.editMessageText(
    '🗑️ Savat tozalandi.',
    Markup.inlineKeyboard([[Markup.button.callback('🛍️ Mahsulotlarga qaytish', 'categories')]])
  );
}

function buildCartSummary(cart) {
  if (!cart.length) return '🛒 Savat bo\'sh';
  let text = '🛒 *Savat:*\n';
  let total = 0;
  cart.forEach((item, i) => {
    const sum = item.qty * item.price;
    total += sum;
    text += `${i + 1}. ${item.name} × ${item.qty} = ${fmtNum(sum)} so'm\n`;
  });
  text += `\n💰 *Jami: ${fmtNum(total)} so'm*`;
  return text;
}

module.exports = { handleViewCart, handleAddToCart, handleDecFromCart, handleClearCart, buildCartSummary };
