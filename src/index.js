require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const { initFirebase } = require('./services/firebase');
const { authMiddleware } = require('./middlewares/auth');
const { startCrons, setBotInstance } = require('./services/cron');
const { getSession, setSession } = require('./services/session');

// Handlers
const { handleStart, handleContact: handleContactMsg, handleHelp, handleCheckSub } = require('./handlers/start');
const { handleCatalog, handleCategoryCallback, handleProductCallback, handleProductDetail, handleSearch, performSearch } = require('./handlers/catalog');
const { handleViewCart, handleAddToCart, handleDecFromCart, handleClearCart } = require('./handlers/cart');
const {
  handleOrderStart, handleLocationMessage, handleTextAddress,
  handlePaymentChoice, handlePaymentPhoto, handleOrderConfirm,
  handleCancelOrder, handleMyOrders, handleViewMyOrder,
} = require('./handlers/order');
const {
  handleProfile, handleChangePhone, handleUpdatePhone,
  handleDeliveryInfo, handleCheckMyLocation, handleLocationCheckOnly,
  handleContact, handleAbout, handleSales,
} = require('./handlers/profile');
const {
  isAdmin, handleAdminDashboard, handleAdminOrders, handleAdminViewOrder,
  updateOrderStatus, handlePaymentApprove,
  handleAdminProducts, handleAdminLowStock, handleAdminCustomers,
  handleAdminStats, handleAdminBroadcast, handleBroadcastMessage,
} = require('./handlers/admin');
const {
  handleLoyaltyMenu, handleLoyaltyBalance, handleDailyBonus, handleLoyaltyTiers,
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

const BOT_TOKEN = process.env.BOT_TOKEN || '7809793171:AAFACuPwz4-_YQOVPbXsZ0dJ8vcu_PcMtWQ';
const bot = new Telegraf(BOT_TOKEN);
setBotInstance(bot);

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
bot.use(authMiddleware);

// ── COMMANDS ──────────────────────────────────────────────────────────────────
bot.start(handleStart);
bot.help(handleHelp);
bot.command('admin', (ctx) => {
  if (isAdmin(ctx)) handleAdminDashboard(ctx);
  else ctx.reply('❌ Ruxsat yo\'q.');
});
bot.command('cancel', handleCancelOrder);
bot.command('cart', handleViewCart);
bot.command('orders', handleMyOrders);
bot.command('profile', handleProfile);

// ── TEXT MESSAGES ─────────────────────────────────────────────────────────────
bot.hears('🛍️ Mahsulotlar', handleCatalog);
bot.hears('🛒 Savat', handleViewCart);
bot.hears('📋 Buyurtmalarim', handleMyOrders);
bot.hears('👤 Profilim', handleProfile);
bot.hears('📍 Yetkazib berish', handleDeliveryInfo);
bot.hears('📞 Aloqa', handleContact);
bot.hears('ℹ️ Haqida', handleAbout);
bot.hears('⭐ Aksiyalar', handleSales);
bot.hears('❌ Bekor qilish', handleCancelOrder);

// Yangi mijoz funksiyalari
bot.hears('❤️ Sevimlilar', handleViewFavorites);
bot.hears('🎁 Bonus va Sodiqlik', handleLoyaltyMenu);
bot.command('faq', handleFAQ);
bot.command('referral', handleReferralInfo);
bot.command('bonus', handleLoyaltyMenu);
bot.command('support', handleSupportNewTicket);
bot.command('lang', handleLanguageMenu);
bot.command('recent', handleRecentlyViewed);

// Admin menu
bot.hears('📊 Dashboard', handleAdminDashboard);
bot.hears('📦 Mahsulotlar', handleAdminProducts);
bot.hears('📋 Buyurtmalar', (ctx) => handleAdminOrders(ctx, 'all'));
bot.hears('👥 Mijozlar', handleAdminCustomers);
bot.hears('🏭 Omborlar', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const { getCollection } = require('./services/firebase');
  const warehouses = await getCollection('warehouses');
  const products = await getCollection('products');
  let text = '🏭 *Omborlar*\n\n';
  const allWh = [{ id: 'main', name: 'Asosiy ombor' }, ...warehouses];
  allWh.forEach(w => {
    const cnt = products.filter(p => (p.warehouse || 'main') === w.id).length;
    text += `🏭 ${w.name}: ${cnt} ta mahsulot\n`;
  });
  ctx.reply(text, { parse_mode: 'Markdown' });
});
bot.hears('📈 Statistika', handleAdminStats);
bot.hears('💬 Xabar yuborish', handleAdminBroadcast);
bot.hears('⚙️ Sozlamalar', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const { Markup } = require('telegraf');
  ctx.reply(
    `⚙️ *Sozlamalar*\n\nAdmin panelni veb-sayt orqali boshqaring:\n🌐 ${process.env.WEBHOOK_URL || 'https://yourapp.railway.app'}`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.url('🌐 Saytga o\'tish', process.env.WEBHOOK_URL || 'https://yourapp.railway.app')]]) }
  );
});
bot.hears('🔙 Foydalanuvchi menyu', async (ctx) => {
  const { mainMenuV2 } = require('./utils/keyboards');
  ctx.reply('Bosh menyu:', mainMenuV2());
});

// ── CONTACT (phone) ───────────────────────────────────────────────────────────
bot.on('contact', async (ctx) => {
  const s = getSession(ctx.from.id);
  if (s.step === 'waiting_phone') return handleContactMsg(ctx);
  if (s.step === 'change_phone') return handleUpdatePhone(ctx);
  return handleContactMsg(ctx);
});

// ── LOCATION ──────────────────────────────────────────────────────────────────
bot.on('location', async (ctx) => {
  const s = getSession(ctx.from.id);
  if (s.step === 'waiting_location') return handleLocationMessage(ctx);
  if (s.step === 'check_location_only') return handleLocationCheckOnly(ctx);
  ctx.reply('📍 Joylashuv qabul qilindi. Buyurtma berish uchun savatdan boshlang.', require('./utils/keyboards').mainMenu());
});

// ── PHOTO (payment check) ─────────────────────────────────────────────────────
bot.on(['photo', 'document'], async (ctx) => {
  const s = getSession(ctx.from.id);
  if (s.step === 'waiting_payment_photo') return handlePaymentPhoto(ctx);
});

// ── TEXT (dynamic steps) ──────────────────────────────────────────────────────
bot.on('text', async (ctx) => {
  const s = getSession(ctx.from.id);
  const text = ctx.message.text;

  if (text === '❌ Bekor qilish') return handleCancelOrder(ctx);

  switch (s.step) {
    case 'searching': return performSearch(ctx, text);
    case 'waiting_text_address': return handleTextAddress(ctx);
    case 'admin_broadcast': return handleBroadcastMessage(ctx);
    case 'change_phone': return ctx.reply('Iltimos, tugmani bosib raqam ulashing.');
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
    // Categories
    if (data === 'categories') return handleCatalog(ctx);
    if (data.startsWith('cat:')) return handleCategoryCallback(ctx, data.slice(4));
    if (data.startsWith('cat_page:')) {
      const page = parseInt(data.slice(9));
      const { getCollection } = require('./services/firebase');
      const cats = await getCollection('categories', 'name', 'asc');
      await ctx.answerCbQuery();
      const { categoryButtons } = require('./utils/keyboards');
      return ctx.editMessageReplyMarkup(categoryButtons(cats, page).reply_markup);
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
      return ctx.reply('📍 Joylashuvingizni yuboring:', sendLocationButton());
    }
    if (data === 'type_address') {
      await ctx.answerCbQuery();
      setSession(ctx.from.id, { step: 'waiting_text_address' });
      return ctx.reply('✍️ Manzilingizni yozing (masalan: Yunusobod, 19-mavze):',
        require('./utils/keyboards').cancelButton());
    }
    if (data.startsWith('pay_cash')) return handlePaymentChoice(ctx, 'cash');
    if (data.startsWith('pay_card')) return handlePaymentChoice(ctx, 'card');
    if (data === 'order_confirm') return handleOrderConfirm(ctx);
    if (data === 'cancel_order') return handleCancelOrder(ctx);
    if (data === 'back_to_cart') return handleViewCart(ctx);
    if (data === 'order_edit') {
      await ctx.answerCbQuery();
      return handleOrderStart(ctx);
    }

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
      return ctx.editMessageReplyMarkup(myOrdersButtons(orders, page).reply_markup);
    }

    // Profile
    if (data === 'change_phone') return handleChangePhone(ctx);

    // Delivery check
    if (data === 'check_my_location') return handleCheckMyLocation(ctx);

    // ── YANGI MIJOZ FUNKSIYALARI ──────────────────────────────────────────────
    // Loyalty / Bonus
    if (data === 'loyalty_menu') return handleLoyaltyMenu(ctx);
    if (data === 'loyalty_balance') return handleLoyaltyBalance(ctx);
    if (data === 'loyalty_daily') return handleDailyBonus(ctx);
    if (data === 'loyalty_tiers') return handleLoyaltyTiers(ctx);

    // Referral
    if (data === 'referral_info') return handleReferralInfo(ctx);

    // Promo
    if (data === 'promo_enter') return handlePromoEnterStart(ctx);

    // Favorites
    if (data.startsWith('fav_toggle:')) return handleFavoriteToggle(ctx, data.slice(11));
    if (data.startsWith('fav_page:')) {
      const page = parseInt(data.slice(9));
      return handleViewFavorites(ctx, page);
    }
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
      return ctx.editMessageText('❌ Bekor qilindi.');
    }
    if (data.startsWith('view_reviews:')) return handleViewProductReviews(ctx, data.slice(13));

    // Recently viewed
    if (data === 'recently_viewed') return handleRecentlyViewed(ctx);

    // Price / Stock alerts
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

    // Main menu
    if (data === 'check_sub') return handleCheckSub(ctx);

    if (data === 'main_menu') {
      await ctx.answerCbQuery();
      const { mainMenuV2 } = require('./utils/keyboards');
      return ctx.reply('Bosh menyu:', mainMenuV2());
    }

    // ── ADMIN CALLBACKS ──────────────────────────────────────────────────────
    if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Ruxsat yo\'q');

    if (data === 'admin_dashboard') return handleAdminDashboard(ctx);
    if (data.startsWith('admin_orders:')) return handleAdminOrders(ctx, data.slice(13));
    if (data === 'admin_pending_orders') return handleAdminOrders(ctx, 'pending');
    if (data.startsWith('admin_order:')) return handleAdminViewOrder(ctx, data.slice(12));
    if (data.startsWith('admin_view_order:')) return handleAdminViewOrder(ctx, data.slice(17));
    if (data === 'admin_products') return handleAdminProducts(ctx);
    if (data === 'admin_low_stock') return handleAdminLowStock(ctx);
    if (data === 'admin_customers') return handleAdminCustomers(ctx);
    if (data === 'admin_stats') return handleAdminStats(ctx);

    // Order status updates
    if (data.startsWith('admin_confirm:')) return updateOrderStatus(ctx, data.slice(14), 'confirmed');
    if (data.startsWith('admin_cancel:')) return updateOrderStatus(ctx, data.slice(13), 'cancelled');
    if (data.startsWith('admin_ship:')) return updateOrderStatus(ctx, data.slice(11), 'shipped');
    if (data.startsWith('admin_deliver:')) return updateOrderStatus(ctx, data.slice(14), 'delivered');
    if (data.startsWith('admin_pay_ok:')) return handlePaymentApprove(ctx, data.slice(13), true);
    if (data.startsWith('admin_pay_fail:')) return handlePaymentApprove(ctx, data.slice(15), false);

    // Admin category stats
    if (data === 'admin_cat_stats') {
      const { getCollection } = require('./services/firebase');
      const [cats, prods] = await Promise.all([getCollection('categories'), getCollection('products')]);
      const text = '📊 *Kategoriyalar:*\n\n' +
        cats.map(c => `${c.icon || '📦'} ${c.name}: ${prods.filter(p => p.category === c.id).length} ta mahsulot`).join('\n');
      await ctx.answerCbQuery();
      return ctx.editMessageText(text, { parse_mode: 'Markdown', ...require('telegraf').Markup.inlineKeyboard([[require('telegraf').Markup.button.callback('🔙', 'admin_products')]]) });
    }

    await ctx.answerCbQuery();
  } catch (e) {
    console.error('Callback error:', e.message);
    try { await ctx.answerCbQuery('❌ Xatolik yuz berdi'); } catch { }
  }
});

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error('Bot xatosi:', err.message);
  try {
    ctx.reply('❌ Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.').catch(() => { });
  } catch { }
});

// ── EXPRESS SERVER (for Railway + Webhook) ────────────────────────────────────
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (WEBHOOK_URL && process.env.NODE_ENV === 'production') {
  // Webhook mode (Railway)
  app.use(bot.webhookCallback('/webhook'));
  app.get('/', (req, res) => res.send('🏗️ BoomStroy Bot ishlayapti!'));
  app.get('/health', (req, res) => res.json({ status: 'ok', bot: 'BoomStroy', time: new Date() }));

  // Simple admin info page
  app.get('/admin', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="uz">
      <head><meta charset="UTF-8"><title>BoomStroy Bot</title>
      <style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#f1f5f9}
      .card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.1);margin-bottom:16px}
      h1{color:#1a56db}a.btn{background:#1a56db;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px}</style>
      </head>
      <body>
        <div class="card">
          <h1>🏗️ BoomStroy Bot</h1>
          <p>✅ Bot faol va ishlayapti!</p>
          <p>📊 Admin panel uchun asosiy HTML faylni ishlating yoki Telegram botdan foydalaning.</p>
          <a class="btn" href="https://t.me/${(process.env.BOT_TOKEN || '').split(':')[0]}">📱 Botga o'tish</a>
        </div>
        <div class="card">
          <h2>📡 Webhook holati</h2>
          <p>URL: ${WEBHOOK_URL}/webhook</p>
          <p>Bot: @BoomStroyBot</p>
        </div>
      </body></html>
    `);
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
  // Long polling mode (local development)
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.listen(PORT, () => console.log(`Server port ${PORT} da`));

  bot.launch({
    allowedUpdates: ['message', 'callback_query', 'my_chat_member'],
  }).then(() => {
    console.log('✅ BoomStroy Bot polling rejimida ishlamoqda...');
    startCrons();
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = { bot };
