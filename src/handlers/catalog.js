// ════════════════════════════════════════════════════════════════════════════
// KATALOG: bo'limlar → mahsulotlar ro'yxati → mahsulot kartochkasi, qidiruv
// Mahsulotlar xotiradagi jonli katalogdan olinadi (services/catalog.js),
// narxlar har doim so'mda.
// ════════════════════════════════════════════════════════════════════════════
const { getCollection } = require('../services/firebase');
const { setSession } = require('../services/session');
const { getStockStatus, fmtNum, totalStock, isStockTracked, escapeMarkdown, mdBold, truncate } = require('../utils/helpers');
const catalog = require('../services/catalog');
const { productActionsV2, mainMenu } = require('../utils/keyboards');
const { t, langOf } = require('../utils/i18n');
const { Markup } = require('telegraf');

const CATS_PER_PAGE = 12;
const PRODUCTS_PER_PAGE = 8;
const LINE = '━━━━━━━━━━━━━━━━';

const esc = (s) => escapeMarkdown(String(s ?? ''));
const short = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

function availableProducts() {
  return catalog.allProducts().filter(catalog.isAvailable);
}

async function getCategories() {
  const cats = await getCollection('categories', 'name', 'asc');
  return cats.filter(c => c.active !== false && c.hidden !== true);
}

// Callback bo'lsa — xabarni tahrirlaydi (rasmli xabar bo'lsa o'chirib, yangisini yuboradi)
async function show(ctx, text, extra) {
  const msg = ctx.callbackQuery?.message;
  if (msg) {
    if (msg.photo || msg.caption !== undefined) {
      await ctx.deleteMessage().catch(() => { });
      return ctx.reply(text, extra);
    }
    try {
      return await ctx.editMessageText(text, extra);
    } catch (e) {
      if (/message is not modified/i.test(e.description || '')) return;
    }
  }
  return ctx.reply(text, extra);
}

// ─── 1. BO'LIMLAR ────────────────────────────────────────────────────────────
function categoriesKeyboard(categories, counts, page, lang) {
  const start = page * CATS_PER_PAGE;
  const items = categories.slice(start, start + CATS_PER_PAGE);
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2).map(c =>
      Markup.button.callback(short(`${c.icon || '📦'} ${c.name} · ${counts.get(c.id) || 0}`, 32), `cat:${c.id}`)
    ));
  }
  const pages = Math.ceil(categories.length / CATS_PER_PAGE);
  if (pages > 1) {
    rows.push([
      Markup.button.callback(page > 0 ? '⬅️' : '·', page > 0 ? `cat_page:${page - 1}` : 'noop'),
      Markup.button.callback(`${page + 1} / ${pages}`, 'noop'),
      Markup.button.callback(page < pages - 1 ? '➡️' : '·', page < pages - 1 ? `cat_page:${page + 1}` : 'noop'),
    ]);
  }
  rows.push([
    Markup.button.callback(t(lang, 'btnSearch'), 'search_start'),
    Markup.button.callback(t(lang, 'btnCart'), 'view_cart'),
  ]);
  rows.push([Markup.button.callback(t(lang, 'mainMenuBtn'), 'main_menu')]);
  return Markup.inlineKeyboard(rows);
}

async function renderCatalog(ctx, page = 0) {
  const lang = langOf(ctx);
  const categories = await getCategories();
  const products = availableProducts();

  if (!categories.length || !products.length) {
    return show(ctx, t(lang, 'noProductsYet'), Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'mainMenuBtn'), 'main_menu')]]));
  }

  const counts = new Map();
  products.forEach(p => counts.set(p.category, (counts.get(p.category) || 0) + 1));
  const visible = categories.filter(c => counts.get(c.id));

  const text =
    `${t(lang, 'catalogHeader')}\n${LINE}\n` +
    `${t(lang, 'catalogStats', { n: fmtNum(products.length), c: visible.length })}\n\n` +
    t(lang, 'catalogHint');

  return show(ctx, text, { parse_mode: 'Markdown', ...categoriesKeyboard(visible, counts, page, lang) });
}

async function handleCatalog(ctx) {
  setSession(ctx.from.id, { step: null });
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
  return renderCatalog(ctx, 0);
}

async function handleCatalogPage(ctx, page) {
  await ctx.answerCbQuery().catch(() => { });
  return renderCatalog(ctx, page);
}

// ─── 2. BO'LIM ICHIDAGI MAHSULOTLAR ──────────────────────────────────────────
function productButton(p, lang) {
  return Markup.button.callback(short(`${p.name} · ${fmtNum(p.price)} ${t(lang, 'som')}`, 60), `product:${p.id}`);
}

async function handleCategoryCallback(ctx, catId, page = 0) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery().catch(() => { });

  const products = availableProducts()
    .filter(p => p.category === catId)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'uz'));
  const cat = (await getCollection('categories')).find(c => c.id === catId);
  const title = `${cat?.icon || '📦'} ${mdBold(cat?.name || t(lang, 'category'))}`;

  if (!products.length) {
    return show(ctx, `${title}\n\n${t(lang, 'catEmpty')}`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btnCategories'), 'categories')]]),
    });
  }

  const pages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
  page = Math.max(0, Math.min(page, pages - 1));
  setSession(ctx.from.id, { currentCat: catId, currentCatPage: page });

  const items = products.slice(page * PRODUCTS_PER_PAGE, (page + 1) * PRODUCTS_PER_PAGE);
  const rows = items.map(p => [productButton(p, lang)]);
  if (pages > 1) {
    rows.push([
      Markup.button.callback(page > 0 ? '⬅️' : '·', page > 0 ? `prod_page:${catId}:${page - 1}` : 'noop'),
      Markup.button.callback(`${page + 1} / ${pages}`, 'noop'),
      Markup.button.callback(page < pages - 1 ? '➡️' : '·', page < pages - 1 ? `prod_page:${catId}:${page + 1}` : 'noop'),
    ]);
  }
  rows.push([
    Markup.button.callback(t(lang, 'btnCategories'), 'categories'),
    Markup.button.callback(t(lang, 'btnCart'), 'view_cart'),
  ]);

  const text =
    `${title}\n${LINE}\n` +
    `${t(lang, 'catProductsCount', { n: fmtNum(products.length) })}` +
    (pages > 1 ? ` · ${t(lang, 'pageOf', { p: page + 1, n: pages })}` : '') +
    `\n\n${t(lang, 'chooseProduct')}`;

  return show(ctx, text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
}

// ─── 3. MAHSULOT KARTOCHKASI ─────────────────────────────────────────────────
function productCardText(p, cat, cartQty, lang) {
  const st = getStockStatus(p);
  const unit = p.unit || t(lang, 'pcs');
  const rating = p.avgRating ? `⭐ ${Number(p.avgRating).toFixed(1)} · ${p.reviewCount || 0} ${t(lang, 'reviewsWord')}\n` : '';
  const stockLine = isStockTracked(p)
    ? `${st.emoji} ${t(lang, 'available')}: ${totalStock(p)} ${esc(unit)}`
    : `🟢 ${t(lang, 'inStockOrder')}`;

  return (
    `${mdBold(p.name)}\n${LINE}\n` +
    `💰 *${fmtNum(p.price)} ${t(lang, 'som')}* / ${esc(unit)}\n` +
    `${stockLine}\n` +
    rating +
    `🏷 ${esc(cat?.name || '-')}` + (p.brand ? `  ·  🏭 ${esc(p.brand)}` : '') + '\n' +
    (p.sku ? `🔖 ${esc(p.sku)}\n` : '') +
    (p.description ? `\n📝 ${esc(truncate(String(p.description), 350))}\n` : '') +
    (cartQty ? `\n🛒 ${t(lang, 'inYourCart')}: *${cartQty} ${esc(unit)}*` : '')
  );
}

async function handleProductCallback(ctx, productId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery().catch(() => { });
  const p = catalog.getProduct(productId) || (await getCollection('products')).find(x => x.id === productId);
  if (!p) return show(ctx, t(lang, 'productNotFound'), Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btnCategories'), 'categories')]]));

  const cat = (await getCollection('categories')).find(c => c.id === p.category);
  const cartItem = require('../services/session').getCart(ctx.from.id).find(i => i.productId === productId);

  const { isProductFavorite, trackRecentlyViewed } = require('./loyalty');
  let isFav = false;
  try { isFav = await isProductFavorite(ctx.from.id, productId); } catch { }
  trackRecentlyViewed(ctx.from.id, productId).catch(() => { });

  const text = productCardText(p, cat, cartItem?.qty || 0, lang);
  const keyboard = catalog.isAvailable(p)
    ? productActionsV2(productId, cartItem?.qty || 0, isFav, lang)
    : Markup.inlineKeyboard([
      [Markup.button.callback(isFav ? t(lang, 'btnFavRemove') : t(lang, 'btnFavAdd'), `fav_toggle:${productId}`)],
      [Markup.button.callback(t(lang, 'btnNotifyStock'), `stock_alert:${productId}`)],
      [Markup.button.callback(t(lang, 'back'), `cat:${p.category}`)],
    ]);

  const extra = { parse_mode: 'Markdown', ...keyboard };
  if (p.imageUrl && /^https?:\/\//.test(p.imageUrl)) {
    await ctx.deleteMessage().catch(() => { });
    try {
      return await ctx.replyWithPhoto(p.imageUrl, { caption: text.slice(0, 1024), ...extra });
    } catch (e) {
      console.warn('Mahsulot rasmi yuborilmadi:', productId, e.message);
      return ctx.reply(text, extra);
    }
  }
  return show(ctx, text, extra);
}

async function handleProductDetail(ctx, productId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery().catch(() => { });
  const p = catalog.getProduct(productId);
  if (!p) return;

  const specs = p.specifications && typeof p.specifications === 'object'
    ? Object.entries(p.specifications).map(([k, v]) => `• ${esc(k)}: ${esc(v)}`).join('\n') : '';
  const unit = p.unit || t(lang, 'pcs');

  const text =
    `${t(lang, 'detailInfo')}\n${LINE}\n` +
    `📦 ${t(lang, 'name')}: ${mdBold(p.name)}\n` +
    `💰 ${t(lang, 'price')}: *${fmtNum(p.price)} ${t(lang, 'som')}* / ${esc(unit)}\n` +
    (p.currencyOriginal === 'USD' ? `💱 $${p.priceOriginal}\n` : '') +
    `🔖 SKU: ${esc(p.sku || '-')}\n` +
    `🏭 ${t(lang, 'brand')}: ${esc(p.brand || '-')}\n` +
    (specs ? `\n📐 *${t(lang, 'specs')}:*\n${specs}\n` : '') +
    (p.description ? `\n📝 *${t(lang, 'description')}:*\n${esc(String(p.description).slice(0, 2500))}` : '');

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'back'), `product:${productId}`)]]),
  });
}

// ─── 4. QIDIRUV ──────────────────────────────────────────────────────────────
async function handleSearch(ctx) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => { });
  setSession(ctx.from.id, { step: 'searching' });
  await ctx.reply(t(lang, 'searchPrompt'), Markup.keyboard([[t(lang, 'cancel')]]).resize().oneTime());
}

function searchScore(p, words) {
  const name = String(p.name || '').toLowerCase();
  const hay = `${name} ${p.brand || ''} ${p.sku || ''} ${p.description || ''}`.toLowerCase();
  if (!words.every(w => hay.includes(w))) return 0;
  let s = 1;
  if (name.startsWith(words[0])) s += 5;
  if (words.every(w => name.includes(w))) s += 3;
  if (String(p.sku || '').toLowerCase() === words.join(' ')) s += 10;
  return s;
}

async function performSearch(ctx, query) {
  const lang = langOf(ctx);
  setSession(ctx.from.id, { step: null });
  const words = String(query).toLowerCase().split(/\s+/).filter(w => w.length > 0).slice(0, 5);
  if (!words.length) return ctx.reply(t(lang, 'searchPrompt'));

  const found = availableProducts()
    .map(p => ({ p, s: searchScore(p, words) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.p);

  // Pastki menyuni qaytaramiz
  await ctx.reply('🔍', mainMenu(lang));

  if (!found.length) {
    return ctx.reply(t(lang, 'searchNoResult', { q: query }), Markup.inlineKeyboard([
      [Markup.button.callback(t(lang, 'btnSearch'), 'search_start'), Markup.button.callback(t(lang, 'btnCategories'), 'categories')],
    ]));
  }

  const top = found.slice(0, 15);
  const rows = top.map(p => [productButton(p, lang)]);
  rows.push([
    Markup.button.callback(t(lang, 'btnSearch'), 'search_start'),
    Markup.button.callback(t(lang, 'btnCategories'), 'categories'),
  ]);
  await ctx.reply(
    t(lang, 'searchResults', { q: String(query).replace(/[_*`\[\]"]/g, ''), n: found.length }) +
    (found.length > top.length ? `\n${t(lang, 'searchMore', { n: found.length - top.length })}` : ''),
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) }
  );
}

module.exports = {
  handleCatalog, handleCatalogPage, handleCategoryCallback, handleProductCallback,
  handleProductDetail, handleSearch, performSearch,
};
