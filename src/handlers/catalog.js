const { getCollection, queryDocs } = require('../services/firebase');
const { getSession, setSession } = require('../services/session');
const { getStockStatus, fmtNum } = require('../utils/helpers');
const { categoryButtons, productListButtons, productActions, backButton, mainMenu } = require('../utils/keyboards');
const { Markup } = require('telegraf');

async function handleCatalog(ctx) {
  const categories = await getCollection('categories', 'name', 'asc');
  if (!categories.length) {
    return ctx.reply('📦 Hozircha mahsulotlar yo\'q. Tez orada qo\'shiladi!');
  }
  setSession(ctx.from.id, { step: null });
  const msg = await ctx.reply(
    `📂 *Kategoriyalar*\n\nQaysi bo'limni ko'rmoqchisiz?`,
    { parse_mode: 'Markdown', ...categoryButtons(categories, 0) }
  );
}

async function handleCategoryCallback(ctx, catId, page = 0) {
  await ctx.answerCbQuery();
  const products = await queryDocs('products', 'category', '==', catId);
  const available = products.filter(p => p.status !== 'inactive' && (p.quantity || 0) > 0);
  const cat = (await getCollection('categories')).find(c => c.id === catId);

  if (!available.length) {
    return ctx.editMessageText(
      `${cat?.icon || '📦'} *${cat?.name || 'Kategoriya'}*\n\nHozircha mahsulotlar mavjud emas.`,
      { parse_mode: 'Markdown', ...backButton('categories') }
    );
  }

  setSession(ctx.from.id, { currentCat: catId });

  const text = `${cat?.icon || '📦'} *${cat?.name}*\n${available.length} ta mahsulot\n\nMahsulot tanlang:`;
  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...productListButtons(available, catId, page),
  });
}

async function handleProductCallback(ctx, productId) {
  await ctx.answerCbQuery();
  const products = await getCollection('products');
  const p = products.find(x => x.id === productId);
  if (!p) return ctx.editMessageText('❌ Mahsulot topilmadi.');

  const categories = await getCollection('categories');
  const cat = categories.find(c => c.id === p.category);
  const st = getStockStatus(p);
  const cart = require('../services/session').getCart(ctx.from.id);
  const cartItem = cart.find(i => i.productId === productId);

  // Sevimli ekanligini va oxirgi ko'rilganlarni kuzatish
  const { isProductFavorite, trackRecentlyViewed } = require('./loyalty');
  const isFav = await isProductFavorite(ctx.from.id, productId);
  trackRecentlyViewed(ctx.from.id, productId).catch(() => { });

  const ratingLine = p.avgRating
    ? `⭐ ${p.avgRating.toFixed(1)} (${p.reviewCount || 0} sharh)\n`
    : '';

  const text =
    `${st.emoji} *${p.name}*\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🏷️ Kategoriya: ${cat?.name || '-'}\n` +
    `💰 Narx: *${fmtNum(p.price)} so'm*/${p.unit || 'dona'}\n` +
    (p.brand ? `🏭 Brend: ${p.brand}\n` : '') +
    ratingLine +
    `📦 Mavjud: ${p.quantity || 0} ${p.unit || 'dona'}\n` +
    (p.description ? `\n📝 ${p.description}` : '') +
    `\n━━━━━━━━━━━━━━━\n` +
    (st.val === 'out' ? '❌ Sotib bo\'lingan' : `🛒 Savatingizda: ${cartItem?.qty || 0} ta`);

  const { productActionsV2 } = require('../utils/keyboards');
  const keyboard = st.val === 'out'
    ? Markup.inlineKeyboard([
      [Markup.button.callback(isFav ? '💔 Sevimlilardan olib tashlash' : '❤️ Sevimlilarga qo\'shish', `fav_toggle:${productId}`)],
      [Markup.button.callback('🔔 Kelganda xabar bering', `stock_alert:${productId}`)],
      [Markup.button.callback('🔙 Orqaga', `cat:${p.category}`)],
    ])
    : productActionsV2(productId, cartItem?.qty || 0, isFav);

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
  await ctx.answerCbQuery('Mahsulot ma\'lumotlari');
  const products = await getCollection('products');
  const p = products.find(x => x.id === productId);
  if (!p) return;

  const specs = p.specifications ? Object.entries(p.specifications).map(([k, v]) => `• ${k}: ${v}`).join('\n') : '';

  const text =
    `📋 *Batafsil ma'lumot*\n\n` +
    `📦 Nomi: *${p.name}*\n` +
    `💰 Narx: *${fmtNum(p.price)} so'm*\n` +
    `🏭 Ombor narxi: ${fmtNum(p.cost || 0)} so'm\n` +
    `📏 O'lchov: ${p.unit || 'dona'}\n` +
    `🔖 SKU: ${p.sku || '-'}\n` +
    `🏷️ Brend: ${p.brand || '-'}\n` +
    (specs ? `\n📐 *Xususiyatlar:*\n${specs}\n` : '') +
    (p.description ? `\n📝 *Tavsif:*\n${p.description}` : '');

  await ctx.reply(text, { parse_mode: 'Markdown', ...productActions(productId) });
}

async function handleSearch(ctx) {
  setSession(ctx.from.id, { step: 'searching' });
  await ctx.reply('🔍 Mahsulot nomini yozing:', {
    ...Markup.keyboard([['❌ Bekor qilish']]).resize().oneTime(),
  });
}

async function performSearch(ctx, query) {
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
    return ctx.reply(`🔍 "${query}" bo'yicha hech narsa topilmadi.`, mainMenu());
  }

  await ctx.reply(`🔍 *"${query}"* bo'yicha ${found.length} ta natija:`, { parse_mode: 'Markdown' });

  const categories = await getCollection('categories');

  for (const p of found.slice(0, 8)) {
    const cat = categories.find(c => c.id === p.category);
    const st = getStockStatus(p);
    const text = `${st.emoji} *${p.name}*\n💰 ${fmtNum(p.price)} so'm/${p.unit || 'dona'}\n🏷️ ${cat?.name || '-'}`;
    await ctx.reply(text, { parse_mode: 'Markdown', ...productActions(p.id) });
    await new Promise(r => setTimeout(r, 200));
  }

  if (found.length > 8) {
    await ctx.reply(`... va yana ${found.length - 8} ta natija. Qidiruvni aniqlashtiring.`);
  }
}

module.exports = {
  handleCatalog, handleCategoryCallback, handleProductCallback,
  handleProductDetail, handleSearch, performSearch,
};
