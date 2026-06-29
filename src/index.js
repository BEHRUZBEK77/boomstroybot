require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const { initFirebase } = require('./services/firebase');
const { authMiddleware } = require('./middlewares/auth');
const { startCrons, setBotInstance } = require('./services/cron');
const { getSession, setSession } = require('./services/session');
const { t, langOf, variantsOf, SITE_URL } = require('./utils/i18n');

// Handlers
const { handleStart, handleContact: handleContactMsg, handleHelp, handleCheckSub } = require('./handlers/start');
const { handleCatalog, handleCategoryCallback, handleProductCallback, handleProductDetail, performSearch } = require('./handlers/catalog');
const { handleViewCart, handleAddToCart, handleDecFromCart, handleClearCart } = require('./handlers/cart');
const {
  handleOrderStart,
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
const bot = new Telegraf(BOT_TOKEN);
setBotInstance(bot);

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
bot.use(authMiddleware);

// ── COMMANDS ──────────────────────────────────────────────────────────────────
bot.start(handleStart);
bot.help(handleHelp);
bot.command('admin', (ctx) => {
  if (isAdmin(ctx)) handleAdminDashboard(ctx);
  else ctx.reply(t(langOf(ctx), 'noAccess'));
});
bot.command('cancel', handleCancelOrder);
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
    if (data.startsWith('cat_page:')) {
      const page = parseInt(data.slice(9));
      const { getCollection } = require('./services/firebase');
      const cats = await getCollection('categories', 'name', 'asc');
      await ctx.answerCbQuery();
      const { categoryButtons } = require('./utils/keyboards');
      return ctx.editMessageReplyMarkup(categoryButtons(cats, page, lang).reply_markup);
    }
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

// ── EXPRESS SERVER (Railway + Webhook) ────────────────────────────────────────
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (WEBHOOK_URL && process.env.NODE_ENV === 'production') {
  app.use(bot.webhookCallback('/webhook'));
  app.get('/', (req, res) => res.send('🏗️ BoomStroy Bot ishlayapti!'));
  app.get('/health', (req, res) => res.json({ status: 'ok', bot: 'BoomStroy', time: new Date() }));

  app.get('/admin', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8"><title>BoomStroy Bot</title>
      <style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#f1f5f9}
      .card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.1);margin-bottom:16px}
      h1{color:#1a56db}a.btn{background:#1a56db;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px}</style>
      </head><body><div class="card"><h1>🏗️ BoomStroy Bot</h1><p>✅ Bot faol va ishlayapti!</p>
      <a class="btn" href="${SITE_URL}">🌐 Saytga o'tish</a></div></body></html>`);
  });

  app.listen(PORT, async () => {
    console.log(`🚀 Server port ${PORT} da ishlamoqda`);
    try {
      await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
      console.log(`✅ Webhook o'rnatildi: ${WEBHOOK_URL}/webhook`);
    } catch (e) {
      console.error('Webhook xatosi:', e.message);
    }
    startCrons();
  });
} else {
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.listen(PORT, () => console.log(`Server port ${PORT} da`));

  bot.launch({ allowedUpdates: ['message', 'callback_query', 'my_chat_member'] }).then(() => {
    console.log('✅ BoomStroy Bot polling rejimida ishlamoqda...');
    startCrons();
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = { bot };
