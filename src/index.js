require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const { initFirebase } = require('./services/firebase');
const { authMiddleware } = require('./middlewares/auth');
const { startCrons, setBotInstance } = require('./services/cron');
const { startWatchers } = require('./services/watchers');
const { getSession, setSession } = require('./services/session');
const { t, langOf, variantsOf, SITE_URL } = require('./utils/i18n');

// Handlers
const { handleStart, handleContact: handleContactMsg, handleHelp, handleCheckSub } = require('./handlers/start');
const { handleCatalog, handleCategoryCallback, handleProductCallback, handleProductDetail, performSearch } = require('./handlers/catalog');
const { handleViewCart, handleAddToCart, handleDecFromCart, handleClearCart } = require('./handlers/cart');
const {
  handleOrderStart,
  handleReceiveDelivery, handleReceivePickup, handlePickupWarehouseSelect,
  handleLocationMessage, handleTextAddress,
  handlePaymentChoice, handlePaymentPhoto, handleOrderConfirm,
  handleCancelOrder, handleMyOrders, handleViewMyOrder,
} = require('./handlers/order');
const {
  handleProfile, handleChangePhone, handleUpdatePhone,
  handleDeliveryInfo, handleCheckMyLocation, handleLocationCheckOnly,
  handleContact, handleAbout, handleSales, handleWebsite, handlePickupInfo,
} = require('./handlers/profile');
const {
  isAdmin, handleAdminDashboard, handleAdminOrders, handleAdminViewOrder,
  updateOrderStatus, handlePaymentApprove,
  handleAdminProducts, handleAdminLowStock, handleAdminCustomers,
  handleAdminStats, handleAdminBroadcast, handleBroadcastMessage,
  handleAdminWarehouses, handleWarehouseAddStart, handleWarehouseInput, handleWarehouseDelete,
} = require('./handlers/admin');
const {
  handleLoyaltyMenu, handleLoyaltyBalance, handleDailyBonus, handleLoyaltyTiers,
  handleRewardsShop, handleRewardDetail, handleRewardRedeem,
  handleReferralInfo, handlePromoEnterStart, handlePromoCodeText,
  handleFavoriteToggle, handleViewFavorites, handleAddAllFavoritesToCart,
  handleReviewStart, handleReviewStarSelect, handleReviewTextSave, handleReviewSkip,
  handleViewProductReviews, handleRecentlyViewed,
  handlePriceAlertSubscribe, handleStockAlertSubscribe,
  handleSupportNewTicket, handleSupportTicketSave, handleMySupportTickets,
  handleSupportReplyStart, handleSupportReplySave,
  handleLanguageMenu, handleLanguageSelect,
  handleQtyPickerInc, handleQtyPickerDec, handleQtyPickerConfirm,
  handleOrderRatingSave, handleFAQ,
} = require('./handlers/loyalty');

// ── INIT ──────────────────────────────────────────────────────────────────────
initFirebase();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN o\'rnatilmagan! .env faylida BOT_TOKEN ni belgilang.');
  process.exit(1);
}
const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 60_000, telegram: { webhookReply: false } });
setBotInstance(bot);

// ── TELEGRAM API QATLAMI ──────────────────────────────────────────────────────
// MUHIM: Telegraf webhook rejimida HAR BIR update uchun yangi Telegram obyekti
// yaratadi (ctx.telegram !== bot.telegram). Shuning uchun qatlam prototipga
// o'rnatiladi — shunda ctx.reply, ctx.editMessageText va h.k. ham undan o'tadi.
//  1) Rangli tugmalar + premium emoji (tugmalarda va xabar matnida)
//  2) Markdown buzilsa — xabar formatsiz qayta yuboriladi
//  3) Rasmli xabarni tahrirlab bo'lmasa — yangi xabar yuboriladi
//  4) "message is not modified" / eskirgan callback — jimgina o'tkaziladi
{
  const { Telegram } = require('telegraf');
  const premium = require('./utils/premium');
  const rawCallApi = Telegram.prototype.callApi;
  if (!rawCallApi.__boomstroy) {
    const wrapped = async function (method, payload = {}, opts) {
      const call = (m, p) => rawCallApi.call(this, m, p, opts);

      if (payload && payload.reply_markup && typeof payload.reply_markup === 'object') {
        payload = { ...payload, reply_markup: premium.decorateMarkup(payload.reply_markup) };
      }

      const withEmoji = premium.decorateText(method, payload);
      if (withEmoji) {
        try {
          const res = await call(method, withEmoji);
          premium.textWorked();
          return res;
        } catch (e) {
          const desc = String(e.description || e.message || '');
          if (!/emoji|ENTITY|entities|DOCUMENT_INVALID|PREMIUM/i.test(desc)) throw e;
          premium.disableText(desc);
        }
      }

      try {
        const res = await call(method, payload);
        if (premium.hasIcons(payload.reply_markup)) premium.iconsWorked();
        return res;
      } catch (e) {
        const desc = String(e.description || e.message || '');
        if (premium.hasIcons(payload.reply_markup) && /emoji|icon|BUTTON|DOCUMENT_INVALID|STICKER|PREMIUM/i.test(desc)) {
          premium.disableIcons(desc);
          return call(method, { ...payload, reply_markup: premium.stripIcons(payload.reply_markup) });
        }
        if (/message is not modified/i.test(desc)) return true;
        if (method === 'editMessageText' && payload.chat_id &&
          /no text in the message to edit|message to edit not found|message can't be edited/i.test(desc)) {
          const { message_id, inline_message_id, ...rest } = payload;
          return this.callApi('sendMessage', rest, opts);
        }
        if (method === 'answerCallbackQuery' && /query is too old|query ID is invalid/i.test(desc)) return true;
        if (/can't parse entities/i.test(desc)) {
          const plain = { ...payload };
          delete plain.parse_mode;
          if (Array.isArray(plain.media)) plain.media = plain.media.map(({ parse_mode, ...m }) => m);
          console.warn(`⚠️ ${method}: Markdown xatosi, formatsiz qayta yuborildi`);
          return call(method, plain);
        }
        throw e;
      }
    };
    wrapped.__boomstroy = true;
    Telegram.prototype.callApi = wrapped;
  }
}

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
// Monitoring holati (/health da ko'rinadi)
const status = {
  mode: null,
  botUsername: null,
  lastUpdateAt: null,
  updatesHandled: 0,
  webhook: null,         // getWebhookInfo dan oxirgi natija
  lastWebhookCheck: null,
  webhookRepairs: 0,
};
bot.use((ctx, next) => {
  status.lastUpdateAt = new Date();
  status.updatesHandled++;
  return next();
});
bot.use(authMiddleware);

// ── COMMANDS ──────────────────────────────────────────────────────────────────
bot.start(handleStart);
bot.help(handleHelp);
bot.command('admin', (ctx) => {
  if (isAdmin(ctx)) handleAdminDashboard(ctx);
  else ctx.reply(t(langOf(ctx), 'noAccess'));
});
bot.command('cancel', handleCancelOrder);
// Premium emoji va stikerlar (faqat admin)
const premiumAdmin = require('./handlers/premiumAdmin');
bot.command('emoji', premiumAdmin.handleEmojiCommand);
bot.command('sticker', premiumAdmin.handleStickerCommand);
bot.command('search', (ctx) => require('./handlers/catalog').handleSearch(ctx));
bot.command('cart', handleViewCart);
bot.command('orders', handleMyOrders);
bot.command('profile', handleProfile);
bot.command('faq', handleFAQ);
bot.command('referral', handleReferralInfo);
bot.command('bonus', handleLoyaltyMenu);
bot.command('support', handleSupportNewTicket);
bot.command('lang', handleLanguageMenu);
bot.command('recent', handleRecentlyViewed);
bot.command('site', handleWebsite);

// ── FOYDALANUVCHI MENYUSI (ko'p tilli) ──────────────────────────────────────
bot.hears(variantsOf('m_website'), handleWebsite);
bot.hears(variantsOf('m_products'), handleCatalog);
bot.hears(variantsOf('btnSearch'), (ctx) => require('./handlers/catalog').handleSearch(ctx));
bot.hears(variantsOf('m_cart'), handleViewCart);
bot.hears(variantsOf('m_orders'), handleMyOrders);
bot.hears(variantsOf('m_profile'), handleProfile);
bot.hears(variantsOf('m_favorites'), handleViewFavorites);
bot.hears(variantsOf('m_loyalty'), handleLoyaltyMenu);
bot.hears(variantsOf('m_delivery'), handleDeliveryInfo);
bot.hears(variantsOf('m_pickup'), handlePickupInfo);
bot.hears(variantsOf('m_contact'), handleContact);
bot.hears(variantsOf('m_about'), handleAbout);
bot.hears(variantsOf('m_sales'), handleSales);
bot.hears(variantsOf('m_language'), handleLanguageMenu);
bot.hears(variantsOf('cancel'), handleCancelOrder);

// ── ADMIN MENYUSI ─────────────────────────────────────────────────────────────
bot.hears(variantsOf('am_dashboard'), handleAdminDashboard);
bot.hears(variantsOf('am_products'), handleAdminProducts);
bot.hears(variantsOf('am_orders'), (ctx) => handleAdminOrders(ctx, 'all'));
bot.hears(variantsOf('am_customers'), handleAdminCustomers);
bot.hears(variantsOf('am_warehouses'), handleAdminWarehouses);
bot.hears(variantsOf('am_stats'), handleAdminStats);
bot.hears(variantsOf('am_broadcast'), handleAdminBroadcast);
bot.hears(variantsOf('am_settings'), async (ctx) => {
  if (!isAdmin(ctx)) return;
  const { Markup } = require('telegraf');
  const panel = process.env.ADMIN_PANEL_URL || SITE_URL;
  ctx.reply(
    `⚙️ *Sozlamalar*\n\nAdmin panelni veb-sayt orqali boshqaring:\n🌐 ${panel}`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.url('🌐 Saytga o\'tish', panel)]]) }
  );
});
bot.hears(variantsOf('am_userMenu'), async (ctx) => {
  const { mainMenu } = require('./utils/keyboards');
  ctx.reply(t(langOf(ctx), 'mainMenuTitle'), mainMenu(langOf(ctx)));
});

// ── CONTACT (phone) ───────────────────────────────────────────────────────────
bot.on('contact', async (ctx) => {
  const s = getSession(ctx.from.id);
  if (s.step === 'change_phone') return handleUpdatePhone(ctx);
  return handleContactMsg(ctx);
});

// ── LOCATION ──────────────────────────────────────────────────────────────────
bot.on('location', async (ctx) => {
  const s = getSession(ctx.from.id);
  if (s.step === 'waiting_location') return handleLocationMessage(ctx);
  if (s.step === 'check_location_only') return handleLocationCheckOnly(ctx);
  const { mainMenu } = require('./utils/keyboards');
  ctx.reply(t(langOf(ctx), 'locationReceived'), mainMenu(langOf(ctx)));
});

// ── STICKER (admin stiker sozlash) ───────────────────────────────────────────
bot.on('sticker', async (ctx) => {
  await premiumAdmin.handleStickerMessage(ctx);
});

// ── PHOTO / DOCUMENT (payment) ────────────────────────────────────────────────
bot.on(['photo', 'document'], async (ctx) => {
  const s = getSession(ctx.from.id);
  if (s.step === 'waiting_payment_photo') return handlePaymentPhoto(ctx);
});

// ── TEXT (dynamic steps) ──────────────────────────────────────────────────────
bot.on('text', async (ctx) => {
  const s = getSession(ctx.from.id);
  const text = ctx.message.text;

  if (variantsOf('cancel').includes(text)) return handleCancelOrder(ctx);

  switch (s.step) {
    case 'searching': return performSearch(ctx, text);
    case 'waiting_text_address': return handleTextAddress(ctx);
    case 'admin_broadcast': return handleBroadcastMessage(ctx);
    case 'admin_wh_name':
    case 'admin_wh_address':
    case 'admin_wh_phone': return handleWarehouseInput(ctx);
    case 'change_phone': return ctx.reply(t(langOf(ctx), 'phoneShareHint'));
    case 'entering_promo': return handlePromoCodeText(ctx);
    case 'writing_review': return handleReviewTextSave(ctx);
    case 'support_writing': return handleSupportTicketSave(ctx);
    case 'support_admin_reply': return handleSupportReplySave(ctx);
    case 'premium_emoji': if (ctx.state.isAdmin) return premiumAdmin.handlePremiumEmojiText(ctx); break;
  }
});

// ── INLINE CALLBACKS ──────────────────────────────────────────────────────────
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data) return ctx.answerCbQuery();

  try {
    const lang = langOf(ctx);

    // Categories
    if (data === 'categories') return handleCatalog(ctx);
    if (data.startsWith('cat:')) return handleCategoryCallback(ctx, data.slice(4));
    if (data.startsWith('cat_page:')) return require('./handlers/catalog').handleCatalogPage(ctx, parseInt(data.slice(9)) || 0);
    if (data === 'search_start') return require('./handlers/catalog').handleSearch(ctx);
    if (data.startsWith('prod_page:')) {
      const parts = data.split(':');
      return handleCategoryCallback(ctx, parts[1], parseInt(parts[2]));
    }
    if (data.startsWith('product:')) return handleProductCallback(ctx, data.slice(8));
    if (data.startsWith('product_detail:')) return handleProductDetail(ctx, data.slice(15));

    // Cart
    if (data === 'view_cart') return handleViewCart(ctx);
    if (data.startsWith('cart_add:')) return handleAddToCart(ctx, data.slice(9));
    if (data.startsWith('cart_inc:')) return handleAddToCart(ctx, data.slice(9));
    if (data.startsWith('cart_dec:')) return handleDecFromCart(ctx, data.slice(9));
    if (data === 'cart_clear') return handleClearCart(ctx);
    if (data === 'continue_shopping') { await ctx.answerCbQuery(); return handleCatalog(ctx); }

    // Order flow
    if (data === 'order_start') return handleOrderStart(ctx);
    if (data === 'recv_delivery') return handleReceiveDelivery(ctx);
    if (data === 'recv_pickup') return handleReceivePickup(ctx);
    if (data.startsWith('pickup_wh:')) return handlePickupWarehouseSelect(ctx, data.slice(10));
    if (data === 'send_location') {
      await ctx.answerCbQuery();
      const { sendLocationButton } = require('./utils/keyboards');
      setSession(ctx.from.id, { step: 'waiting_location' });
      return ctx.reply(t(lang, 'sendLocationPrompt'), sendLocationButton(lang));
    }
    if (data === 'type_address') {
      await ctx.answerCbQuery();
      const { cancelButton } = require('./utils/keyboards');
      setSession(ctx.from.id, { step: 'waiting_text_address' });
      return ctx.reply(t(lang, 'typeAddressPrompt'), cancelButton(lang));
    }
    if (data.startsWith('pay_cash')) return handlePaymentChoice(ctx, 'cash');
    if (data.startsWith('pay_card')) return handlePaymentChoice(ctx, 'card');
    if (data === 'order_confirm') return handleOrderConfirm(ctx);
    if (data === 'cancel_order') return handleCancelOrder(ctx);
    if (data === 'back_to_cart') return handleViewCart(ctx);
    if (data === 'order_edit') { await ctx.answerCbQuery(); return handleOrderStart(ctx); }

    // My orders
    if (data === 'my_orders') return handleMyOrders(ctx);
    if (data.startsWith('my_order:')) return handleViewMyOrder(ctx, data.slice(9));
    if (data.startsWith('my_orders_page:')) {
      const page = parseInt(data.slice(15));
      const { queryDocs } = require('./services/firebase');
      const orders = await queryDocs('orders', 'telegramId', '==', String(ctx.from.id));
      orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      await ctx.answerCbQuery();
      const { myOrdersButtons } = require('./utils/keyboards');
      return ctx.editMessageReplyMarkup(myOrdersButtons(orders, page, lang).reply_markup);
    }

    // Profile
    if (data === 'change_phone') return handleChangePhone(ctx);
    if (data === 'check_my_location') return handleCheckMyLocation(ctx);

    // ── LOYALTY / BONUS ──
    if (data === 'loyalty_menu') return handleLoyaltyMenu(ctx);
    if (data === 'loyalty_balance') return handleLoyaltyBalance(ctx);
    if (data === 'loyalty_daily') return handleDailyBonus(ctx);
    if (data === 'loyalty_tiers') return handleLoyaltyTiers(ctx);

    // Rewards shop
    if (data === 'rewards_shop') return handleRewardsShop(ctx, 0);
    if (data.startsWith('rewards_page:')) return handleRewardsShop(ctx, parseInt(data.slice(13)));
    if (data.startsWith('reward_redeem:')) return handleRewardRedeem(ctx, data.slice(14));
    if (data.startsWith('reward:')) return handleRewardDetail(ctx, data.slice(7));

    // Referral / Promo
    if (data === 'referral_info') return handleReferralInfo(ctx);
    if (data === 'promo_enter') return handlePromoEnterStart(ctx);

    // Favorites
    if (data.startsWith('fav_toggle:')) return handleFavoriteToggle(ctx, data.slice(11));
    if (data.startsWith('fav_page:')) return handleViewFavorites(ctx, parseInt(data.slice(9)));
    if (data === 'fav_add_all_cart') return handleAddAllFavoritesToCart(ctx);

    // Reviews
    if (data.startsWith('review_start:')) return handleReviewStart(ctx, data.slice(13));
    if (data.startsWith('review_star:')) {
      const [, pid, stars] = data.split(':');
      return handleReviewStarSelect(ctx, pid, stars);
    }
    if (data.startsWith('review_skip:')) {
      const [, pid, stars] = data.split(':');
      return handleReviewSkip(ctx, pid, stars);
    }
    if (data === 'review_cancel') {
      await ctx.answerCbQuery();
      setSession(ctx.from.id, { step: null });
      return ctx.editMessageText(t(lang, 'reviewCancelled'));
    }
    if (data.startsWith('view_reviews:')) return handleViewProductReviews(ctx, data.slice(13));

    // Recently viewed
    if (data === 'recently_viewed') return handleRecentlyViewed(ctx);

    // Alerts
    if (data.startsWith('price_alert:')) return handlePriceAlertSubscribe(ctx, data.slice(12));
    if (data.startsWith('stock_alert:')) return handleStockAlertSubscribe(ctx, data.slice(12));

    // Support
    if (data === 'support_new') return handleSupportNewTicket(ctx);
    if (data === 'support_my') return handleMySupportTickets(ctx);
    if (data.startsWith('support_reply:')) {
      const [, ticketId, custId] = data.split(':');
      return handleSupportReplyStart(ctx, ticketId, custId);
    }

    // Language
    if (data.startsWith('lang:')) return handleLanguageSelect(ctx, data.slice(5));

    // Quantity picker
    if (data.startsWith('qty_inc:')) return handleQtyPickerInc(ctx, data.slice(8));
    if (data.startsWith('qty_dec:')) return handleQtyPickerDec(ctx, data.slice(8));
    if (data.startsWith('qty_confirm:')) return handleQtyPickerConfirm(ctx, data.slice(12));
    if (data === 'noop') return ctx.answerCbQuery();

    // Order rating
    if (data.startsWith('order_rate:')) {
      const [, orderId, stars] = data.split(':');
      return handleOrderRatingSave(ctx, orderId, stars);
    }

    // Main menu / subscription
    if (data === 'check_sub') return handleCheckSub(ctx);
    if (data === 'main_menu') {
      await ctx.answerCbQuery();
      const { mainMenu } = require('./utils/keyboards');
      return ctx.reply(t(lang, 'mainMenuTitle'), mainMenu(lang));
    }

    // ── ADMIN CALLBACKS ──
    if (!isAdmin(ctx)) return ctx.answerCbQuery(t(lang, 'noAccess'));

    if (data === 'admin_dashboard') return handleAdminDashboard(ctx);
    if (data.startsWith('stk:')) return premiumAdmin.handleStickerSlot(ctx, data.slice(4));
    if (data.startsWith('stk_del:')) return premiumAdmin.handleStickerDelete(ctx, data.slice(8));
    if (data.startsWith('admin_orders:')) return handleAdminOrders(ctx, data.slice(13));
    if (data === 'admin_pending_orders') return handleAdminOrders(ctx, 'pending');
    if (data.startsWith('admin_order:')) return handleAdminViewOrder(ctx, data.slice(12));
    if (data.startsWith('admin_view_order:')) return handleAdminViewOrder(ctx, data.slice(17));
    if (data === 'admin_products') return handleAdminProducts(ctx);
    if (data === 'admin_low_stock') return handleAdminLowStock(ctx);
    if (data === 'admin_customers') return handleAdminCustomers(ctx);
    if (data === 'admin_stats') return handleAdminStats(ctx);

    // Omborlar boshqaruvi
    if (data === 'admin_warehouses') return handleAdminWarehouses(ctx);
    if (data === 'wh_add') return handleWarehouseAddStart(ctx);
    if (data.startsWith('wh_del:')) return handleWarehouseDelete(ctx, data.slice(7));

    if (data.startsWith('admin_confirm:')) return updateOrderStatus(ctx, data.slice(14), 'confirmed');
    if (data.startsWith('admin_cancel:')) return updateOrderStatus(ctx, data.slice(13), 'cancelled');
    if (data.startsWith('admin_ship:')) return updateOrderStatus(ctx, data.slice(11), 'shipped');
    if (data.startsWith('admin_deliver:')) return updateOrderStatus(ctx, data.slice(14), 'delivered');
    if (data.startsWith('admin_pay_ok:')) return handlePaymentApprove(ctx, data.slice(13), true);
    if (data.startsWith('admin_pay_fail:')) return handlePaymentApprove(ctx, data.slice(15), false);

    if (data === 'admin_cat_stats') {
      const { getCollection } = require('./services/firebase');
      const [cats, prods] = await Promise.all([getCollection('categories'), getCollection('products')]);
      const text = '📊 *Kategoriyalar:*\n\n' +
        cats.map(c => `${c.icon || '📦'} ${c.name}: ${prods.filter(p => p.category === c.id).length} ta mahsulot`).join('\n');
      await ctx.answerCbQuery();
      const { Markup } = require('telegraf');
      return ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_products')]]) });
    }

    await ctx.answerCbQuery();
  } catch (e) {
    console.error('Callback error:', e.message);
    try { await ctx.answerCbQuery(t(langOf(ctx), 'errorShort')); } catch { }
  }
});

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error('Bot xatosi:', err.message);
  try {
    ctx.reply(t(langOf(ctx), 'error')).catch(() => { });
  } catch { }
});

// ── GLOBAL XATOLARNI USHLASH ──────────────────────────────────────────────────
// Bitta kutilmagan xato butun jarayonni jimgina "o'ldirmasligi" uchun.
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ unhandledRejection:', reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err?.stack || err);
});

// ── EXPRESS SERVER (Railway + Webhook) ────────────────────────────────────────
const crypto = require('crypto');
const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT) || 3000;

// Webhook manzili: WEBHOOK_URL bo'lmasa Railway domenidan avtomatik olinadi
const BASE_URL = (
  process.env.WEBHOOK_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')
).trim().replace(/\/+$/, '').replace(/^(?!https?:\/\/)(?=.)/i, 'https://').replace(/^http:\/\//i, 'https://');
const USE_WEBHOOK = Boolean(BASE_URL) && process.env.USE_POLLING !== 'true';

const WEBHOOK_PATH = '/webhook';
const WEBHOOK_FULL_URL = `${BASE_URL}${WEBHOOK_PATH}`;
// Faqat Telegram yuborgan so'rovlarni qabul qilish uchun maxfiy kalit (BOT_TOKEN dan hosil qilinadi)
const WEBHOOK_SECRET = crypto.createHash('sha256').update(BOT_TOKEN).digest('hex').slice(0, 48);
const ALLOWED_UPDATES = ['message', 'edited_message', 'callback_query', 'my_chat_member'];

const startedAt = new Date();
status.mode = USE_WEBHOOK ? 'webhook' : 'polling';

app.get('/', (req, res) => res.send('🏗️ BoomStroy Bot ishlayapti!'));
app.get('/health', (req, res) => res.json({
  status: 'ok',
  bot: 'BoomStroy',
  username: status.botUsername,
  mode: status.mode,
  uptimeSec: Math.round((Date.now() - startedAt.getTime()) / 1000),
  lastUpdateAt: status.lastUpdateAt,
  updatesHandled: status.updatesHandled,
  webhook: status.webhook && {
    ok: status.webhook.url === WEBHOOK_FULL_URL,
    pending: status.webhook.pending_update_count,
    lastError: status.webhook.last_error_message || null,
    lastErrorAt: status.webhook.last_error_date ? new Date(status.webhook.last_error_date * 1000) : null,
  },
  lastWebhookCheck: status.lastWebhookCheck,
  webhookRepairs: status.webhookRepairs,
  time: new Date(),
}));

app.get('/admin', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8"><title>BoomStroy Bot</title>
    <style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#f1f5f9}
    .card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.1);margin-bottom:16px}
    h1{color:#1a56db}a.btn{background:#1a56db;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px}</style>
    </head><body><div class="card"><h1>🏗️ BoomStroy Bot</h1><p>✅ Bot faol va ishlayapti!</p>
    <a class="btn" href="${SITE_URL}">🌐 Saytga o'tish</a></div></body></html>`);
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Webhook to'g'ri o'rnatilganini tekshiradi; yo'qolgan yoki o'zgargan bo'lsa qayta o'rnatadi.
// Bu botning "o'chib qolishi"ga qarshi asosiy himoya: webhook biror sababdan
// (lokal ishga tushirish, deleteWebhook, Telegram xatosi) yo'qolsa ham 5 daqiqada tiklanadi.
async function ensureWebhook(reason = 'check') {
  try {
    const info = await bot.telegram.getWebhookInfo();
    status.webhook = info;
    status.lastWebhookCheck = new Date();

    if (info.url !== WEBHOOK_FULL_URL) {
      console.warn(`🔧 Webhook noto'g'ri (${reason}): hozirgi="${info.url || 'yo\'q'}" → o'rnatilmoqda`);
      await bot.telegram.setWebhook(WEBHOOK_FULL_URL, {
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ALLOWED_UPDATES,
        max_connections: 40,
        drop_pending_updates: false,
      });
      status.webhookRepairs++;
      status.webhook = await bot.telegram.getWebhookInfo();
      console.log(`✅ Webhook o'rnatildi: ${WEBHOOK_FULL_URL}`);
    } else if (info.last_error_message && info.last_error_date &&
      Date.now() / 1000 - info.last_error_date < 600) {
      console.warn(`⚠️ Telegram webhook xatosi: ${info.last_error_message} (kutilmoqda: ${info.pending_update_count})`);
    }
    return true;
  } catch (e) {
    console.error(`❌ Webhook tekshirish xatosi (${reason}):`, e.message);
    return false;
  }
}

async function startBot() {
  // Valyuta kursi va mahsulotlar katalogi (xotirada) — update'lar kelishidan oldin
  await require('./services/currency').startCurrency();
  await require('./utils/premium').loadPremium();
  await Promise.race([require('./services/catalog').startCatalog(), sleep(20000)]);

  // Token to'g'riligini tekshiramiz — noto'g'ri bo'lsa logda aniq ko'rinadi
  for (let attempt = 1; ; attempt++) {
    try {
      const me = await bot.telegram.getMe();
      status.botUsername = me.username;
      bot.botInfo = me;
      console.log(`🤖 Bot: @${me.username} (id ${me.id})`);
      await require('./utils/premium').autoLoadEmoji(bot.telegram);
      break;
    } catch (e) {
      const code = e.response?.error_code;
      console.error(`❌ getMe xatosi (urinish ${attempt}):`, e.message);
      if (code === 401 || code === 404) {
        console.error('❌ BOT_TOKEN yaroqsiz! BotFather dan yangi token olib, Railway Variables da BOT_TOKEN ni yangilang.');
        process.exit(1);
      }
      await sleep(Math.min(30000, 2000 * attempt));
    }
  }

  if (USE_WEBHOOK) {
    app.use(bot.webhookCallback(WEBHOOK_PATH, { secretToken: WEBHOOK_SECRET }));

    // Webhook o'rnatilmaguncha qayta urinamiz
    for (let attempt = 1; !(await ensureWebhook('startup')); attempt++) {
      await sleep(Math.min(30000, 2000 * attempt));
    }
    // Har 5 daqiqada webhookni tekshirib turamiz
    setInterval(() => ensureWebhook('periodic'), 5 * 60 * 1000).unref();
    console.log(`✅ BoomStroy Bot webhook rejimida ishlamoqda (${WEBHOOK_FULL_URL})`);
  } else {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => { });
    bot.launch({ allowedUpdates: ALLOWED_UPDATES }).catch((e) => {
      console.error('❌ Polling to\'xtadi:', e.message);
      process.exit(1); // Railway qayta ishga tushiradi
    });
    console.log('✅ BoomStroy Bot polling rejimida ishlamoqda...');
  }

  startCrons();
  startWatchers(bot);
  setupCommands().catch(e => console.warn('setMyCommands:', e.message));
}

// "/" menyusidagi buyruqlar — har bir til uchun
async function setupCommands() {
  const L = {
    uz: ['Botni ishga tushirish', 'Mahsulot qidirish', 'Savat', 'Buyurtmalarim', 'Profil', 'Bonuslar', 'Tilni o\'zgartirish', 'Yordam'],
    ru: ['Запустить бота', 'Поиск товаров', 'Корзина', 'Мои заказы', 'Профиль', 'Бонусы', 'Сменить язык', 'Помощь'],
    en: ['Start the bot', 'Search products', 'Cart', 'My orders', 'Profile', 'Bonuses', 'Change language', 'Help'],
  };
  const names = ['start', 'search', 'cart', 'orders', 'profile', 'bonus', 'lang', 'help'];
  const build = (d) => names.map((command, i) => ({ command, description: d[i] }));
  await bot.telegram.setMyCommands(build(L.uz));
  await bot.telegram.setMyCommands(build(L.ru), { language_code: 'ru' });
  await bot.telegram.setMyCommands(build(L.en), { language_code: 'en' });
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server port ${PORT} da ishlamoqda (${status.mode})`);
  startBot().catch((e) => {
    console.error('❌ Bot ishga tushmadi:', e?.stack || e);
    process.exit(1);
  });
});

// Railway yangi deploy qilganda toza to'xtash.
// MUHIM: webhookni O'CHIRMAYMIZ — aks holda yangi versiya ishga tushguncha bot jim qoladi.
function shutdown(signal) {
  console.log(`🛑 ${signal} olindi, to'xtatilmoqda...`);
  if (!USE_WEBHOOK) { try { bot.stop(signal); } catch { } }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { bot };
