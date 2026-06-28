const { getCollection, queryDocs } = require('../services/firebase');
const { setSession } = require('../services/session');
const { getStockStatus, fmtNum } = require('../utils/helpers');
const { categoryButtons, productListButtons, productActions, productActionsV2, backButton, mainMenu } = require('../utils/keyboards');
const { t, langOf } = require('../utils/i18n');
const { Markup } = require('telegraf');

async function handleCatalog(ctx) {
  const lang = langOf(ctx);
  const categories = await getCollection('categories', 'name', 'asc');
  if (!categories.length) {
    return ctx.reply(t(lang, 'noProductsYet'));
  }
  setSession(ctx.from.id, { step: null });
  await ctx.reply(t(lang, 'catTitle'), { parse_mode: 'Markdown', ...categoryButtons(categories, 0, lang) });
}

async function handleCategoryCallback(ctx, catId, page = 0) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const products = await queryDocs('products', 'category', '==', catId);
  const available = products.filter(p => p.status !== 'inactive' && (p.quantity || 0) > 0);
  const cat = (await getCollection('categories')).find(c => c.id === catId);

  if (!available.length) {
    return ctx.editMessageText(
      `${cat?.icon || '📦'} *${cat?.name || t(lang, 'category')}*\n\n${t(lang, 'catEmpty')}`,
      { parse_mode: 'Markdown', ...backButton('categories', lang) }
    );
  }

  setSession(ctx.from.id, { currentCat: catId });

  const text = `${cat?.icon || '📦'} *${cat?.name}*\n${t(lang, 'catProductsCount', { n: available.length })}\n\n${t(lang, 'chooseProduct')}`;
  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...productListButtons(available, catId, page, lang),
  });
}

async function handleProductCallback(ctx, productId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const products = await getCollection('products');
  const p = products.find(x => x.id === productId);
  if (!p) return ctx.editMessageText(t(lang, 'productNotFound'));

  const categories = await getCollection('categories');
  const cat = categories.find(c => c.id === p.category);
  const st = getStockStatus(p);
  const cart = require('../services/session').getCart(ctx.from.id);
  const cartItem = cart.find(i => i.productId === productId);
  const unit = p.unit || t(lang, 'pcs');

  // Sevimli ekanligini va oxirgi ko'rilganlarni kuzatish
  const { isProductFavorite, trackRecentlyViewed } = require('./loyalty');
  const isFav = await isProductFavorite(ctx.from.id, productId);
  trackRecentlyViewed(ctx.from.id, productId).catch(() => { });

  const ratingLine = p.avgRating
    ? `⭐ ${p.avgRating.toFixed(1)} (${p.reviewCount || 0} ${t(lang, 'reviewsWord')})\n`
    : '';

  const text =
    `${st.emoji} *${p.name}*\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🏷️ ${t(lang, 'category')}: ${cat?.name || '-'}\n` +
    `💰 ${t(lang, 'price')}: *${fmtNum(p.price)} ${t(lang, 'som')}*/${unit}\n` +
    (p.brand ? `🏭 ${t(lang, 'brand')}: ${p.brand}\n` : '') +
    ratingLine +
    `📦 ${t(lang, 'available')}: ${p.quantity || 0} ${unit}\n` +
    (p.description ? `\n📝 ${p.description}` : '') +
    `\n━━━━━━━━━━━━━━━\n` +
    (st.val === 'out' ? t(lang, 'soldOut') : `🛒 ${t(lang, 'inYourCart')}: ${cartItem?.qty || 0}`);

  const keyboard = st.val === 'out'
    ? Markup.inlineKeyboard([
      [Markup.button.callback(isFav ? t(lang, 'btnFavRemove') : t(lang, 'btnFavAdd'), `fav_toggle:${productId}`)],
      [Markup.button.callback(t(lang, 'btnNotifyStock'), `stock_alert:${productId}`)],
      [Markup.button.callback(t(lang, 'back'), `cat:${p.category}`)],
    ])
    : productActionsV2(productId, cartItem?.qty || 0, isFav, lang);

  try {
    if (p.imageUrl) {
      await ctx.replyWithPhoto(p.imageUrl, { caption: text, parse_mode: 'Markdown', ...keyboard });
    } else {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
  }
}

async function handleProductDetail(ctx, productId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const products = await getCollection('products');
  const p = products.find(x => x.id === productId);
  if (!p) return;

  const specs = p.specifications ? Object.entries(p.specifications).map(([k, v]) => `• ${k}: ${v}`).join('\n') : '';
  const unit = p.unit || t(lang, 'pcs');

  const text =
    `${t(lang, 'detailInfo')}\n\n` +
    `📦 ${t(lang, 'name')}: *${p.name}*\n` +
    `💰 ${t(lang, 'price')}: *${fmtNum(p.price)} ${t(lang, 'som')}*\n` +
    `📏 ${t(lang, 'unit')}: ${unit}\n` +
    `🔖 SKU: ${p.sku || '-'}\n` +
    `🏷️ ${t(lang, 'brand')}: ${p.brand || '-'}\n` +
    (specs ? `\n📐 *${t(lang, 'specs')}:*\n${specs}\n` : '') +
    (p.description ? `\n📝 *${t(lang, 'description')}:*\n${p.description}` : '');

  await ctx.reply(text, { parse_mode: 'Markdown', ...productActions(productId, 0, lang) });
}

async function handleSearch(ctx) {
  const lang = langOf(ctx);
  setSession(ctx.from.id, { step: 'searching' });
  await ctx.reply(t(lang, 'searchPrompt'), { ...Markup.keyboard([[t(lang, 'cancel')]]).resize().oneTime() });
}

async function performSearch(ctx, query) {
  const lang = langOf(ctx);
  const products = await getCollection('products');
  const q = query.toLowerCase();
  const found = products.filter(p =>
    (p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)) &&
    p.status !== 'inactive'
  );

  setSession(ctx.from.id, { step: null });

  if (!found.length) {
    return ctx.reply(t(lang, 'searchNoResult', { q: query }), mainMenu(lang));
  }

  await ctx.reply(t(lang, 'searchResults', { q: query, n: found.length }), { parse_mode: 'Markdown' });

  const categories = await getCollection('categories');

  for (const p of found.slice(0, 8)) {
    const cat = categories.find(c => c.id === p.category);
    const st = getStockStatus(p);
    const text = `${st.emoji} *${p.name}*\n💰 ${fmtNum(p.price)} ${t(lang, 'som')}/${p.unit || t(lang, 'pcs')}\n🏷️ ${cat?.name || '-'}`;
    await ctx.reply(text, { parse_mode: 'Markdown', ...productActions(p.id, 0, lang) });
    await new Promise(r => setTimeout(r, 200));
  }

  if (found.length > 8) {
    await ctx.reply(t(lang, 'searchMore', { n: found.length - 8 }));
  }
}

module.exports = {
  handleCatalog, handleCategoryCallback, handleProductCallback,
  handleProductDetail, handleSearch, performSearch,
};
