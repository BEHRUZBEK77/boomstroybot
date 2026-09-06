const { Markup } = require('telegraf');
const { t, SITE_URL } = require('./i18n');

// ─── ASOSIY MENYU (foydalanuvchi) ────────────────────────────────────────────
// "Bizning sayt" va "Borib olish" eng tepada yonma-yon turadi.
const mainMenu = (lang = 'uz') => Markup.keyboard([
  [t(lang, 'm_website'), t(lang, 'm_pickup')],
  [t(lang, 'm_products'), t(lang, 'm_cart')],
  [t(lang, 'm_orders'), t(lang, 'm_profile')],
  [t(lang, 'm_favorites'), t(lang, 'm_loyalty')],
  [t(lang, 'm_delivery'), t(lang, 'm_contact')],
  [t(lang, 'm_about'), t(lang, 'm_sales')],
  [t(lang, 'm_language')],
]).resize();

// Eski nom bilan ham chaqirilsa ishlashi uchun (alias)
const mainMenuV2 = mainMenu;

const adminMainMenu = (lang = 'uz') => Markup.keyboard([
  [t(lang, 'am_dashboard'), t(lang, 'am_products')],
  [t(lang, 'am_orders'), t(lang, 'am_customers')],
  [t(lang, 'am_warehouses'), t(lang, 'am_stats')],
  [t(lang, 'am_broadcast'), t(lang, 'am_settings')],
  [t(lang, 'am_userMenu')],
]).resize();

// ─── VEB-SAYT ────────────────────────────────────────────────────────────────
const websiteButton = (lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.url(t(lang, 'websiteBtn'), SITE_URL)],
]);

// ─── MAHSULOT TUGMALARI ──────────────────────────────────────────────────────
const productActions = (productId, qty = 0, lang = 'uz') => Markup.inlineKeyboard([
  [
    Markup.button.callback('➖', `cart_dec:${productId}`),
    Markup.button.callback(qty > 0 ? t(lang, 'btnInCartQty', { n: qty }) : t(lang, 'btnAdd'), `cart_add:${productId}`),
    Markup.button.callback('➕', `cart_inc:${productId}`),
  ],
  [Markup.button.callback(t(lang, 'btnDetail'), `product_detail:${productId}`)],
]);

const productActionsV2 = (productId, qty = 0, isFav = false, lang = 'uz') => Markup.inlineKeyboard([
  [
    Markup.button.callback('➖', `cart_dec:${productId}`),
    Markup.button.callback(qty > 0 ? t(lang, 'btnInCartQty', { n: qty }) : t(lang, 'btnAdd'), `cart_add:${productId}`),
    Markup.button.callback('➕', `cart_inc:${productId}`),
  ],
  [
    Markup.button.callback(isFav ? '💔' : '❤️', `fav_toggle:${productId}`),
    Markup.button.callback(t(lang, 'btnDetail'), `product_detail:${productId}`),
    Markup.button.callback(t(lang, 'btnRate'), `review_start:${productId}`),
  ],
]);

const favoriteToggleBtn = (productId, isFav, lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.callback(isFav ? t(lang, 'btnFavRemove') : t(lang, 'btnFavAdd'), `fav_toggle:${productId}`)],
]);

// ─── SAVAT ───────────────────────────────────────────────────────────────────
const cartActions = (lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'btnCheckout'), 'order_start')],
  [
    Markup.button.callback(t(lang, 'btnClear'), 'cart_clear'),
    Markup.button.callback(t(lang, 'btnContinue'), 'continue_shopping'),
  ],
]);

// ─── BUYURTMA: olish turi (yetkazib berish / borib olish) ────────────────────
const receiveTypeChoice = (lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'btnDelivery'), 'recv_delivery')],
  [Markup.button.callback(t(lang, 'btnPickup'), 'recv_pickup')],
  [Markup.button.callback(t(lang, 'cancel'), 'cancel_order')],
]);

// Borib olish: omborlar ro'yxati (admin paneldagi nomlari bilan)
const pickupWarehouseButtons = (warehouses, lang = 'uz') => {
  const btns = warehouses.map(w => [
    Markup.button.callback(`🏪 ${w.name}`, `pickup_wh:${w.id}`),
  ]);
  btns.push([Markup.button.callback(t(lang, 'back'), 'order_start')]);
  return Markup.inlineKeyboard(btns);
};

const locationChoice = (lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'btnSendLocation'), 'send_location')],
  [Markup.button.callback(t(lang, 'btnTypeAddressShort'), 'type_address')],
  [Markup.button.callback(t(lang, 'cancel'), 'cancel_order')],
]);

const addressRetryButtons = (lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'btnSendLocation'), 'send_location')],
  [Markup.button.callback(t(lang, 'btnTypeAddressShort'), 'type_address')],
  [Markup.button.callback(t(lang, 'cancel'), 'cancel_order')],
]);

const sendLocationButton = (lang = 'uz') => Markup.keyboard([
  [Markup.button.locationRequest(t(lang, 'btnSendLocation'))],
  [t(lang, 'cancel')],
]).resize().oneTime();

const paymentChoice = (lang = 'uz', isPickup = false) => Markup.inlineKeyboard([
  [Markup.button.callback(isPickup ? t(lang, 'payCashPickup') : t(lang, 'payCash'), 'pay_cash')],
  [Markup.button.callback(t(lang, 'payCard'), 'pay_card')],
  [Markup.button.callback(t(lang, 'back'), 'back_to_cart')],
]);

const confirmOrder = (lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'btnConfirm'), 'order_confirm')],
  [Markup.button.callback(t(lang, 'btnEdit'), 'order_edit')],
  [Markup.button.callback(t(lang, 'cancel'), 'cancel_order')],
]);

// ─── ADMIN: buyurtma holati tugmalari ────────────────────────────────────────
const orderStatusActions = (orderId, status) => {
  const btns = [];
  if (status === 'pending') {
    btns.push([
      Markup.button.callback('✅ Tasdiqlash', `admin_confirm:${orderId}`),
      Markup.button.callback('❌ Bekor', `admin_cancel:${orderId}`),
    ]);
  }
  if (status === 'confirmed') {
    btns.push([Markup.button.callback("🚚 Yo'lga chiqdi", `admin_ship:${orderId}`)]);
  }
  if (status === 'shipped') {
    btns.push([Markup.button.callback('✅ Yetkazildi', `admin_deliver:${orderId}`)]);
  }
  if (status === 'paid_pending') {
    btns.push([Markup.button.callback("✅ To'lovni tasdiqlash", `admin_pay_ok:${orderId}`)]);
    btns.push([Markup.button.callback("❌ To'lovni rad etish", `admin_pay_fail:${orderId}`)]);
  }
  btns.push([Markup.button.callback('👁️ Batafsil', `admin_view_order:${orderId}`)]);
  return Markup.inlineKeyboard(btns);
};

// ─── KATEGORIYA / MAHSULOT RO'YXATI ──────────────────────────────────────────
const categoryButtons = (categories, page = 0, lang = 'uz') => {
  const perPage = 6;
  const start = page * perPage;
  const items = categories.slice(start, start + perPage);
  const btns = [];

  for (let i = 0; i < items.length; i += 2) {
    const row = [Markup.button.callback(`${items[i].icon || '📦'} ${items[i].name}`, `cat:${items[i].id}`)];
    if (items[i + 1]) row.push(Markup.button.callback(`${items[i + 1].icon || '📦'} ${items[i + 1].name}`, `cat:${items[i + 1].id}`));
    btns.push(row);
  }

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `cat_page:${page - 1}`));
  if (start + perPage < categories.length) nav.push(Markup.button.callback('➡️', `cat_page:${page + 1}`));
  if (nav.length) btns.push(nav);
  btns.push([Markup.button.callback(t(lang, 'mainMenuBtn'), 'main_menu')]);

  return Markup.inlineKeyboard(btns);
};

const productListButtons = (products, catId, page = 0, lang = 'uz') => {
  const perPage = 5;
  const start = page * perPage;
  const items = products.slice(start, start + perPage);
  const btns = items.map(p => [
    Markup.button.callback(
      `${p.name} — ${(p.price || 0).toLocaleString()} ${t(lang, 'som')}`,
      `product:${p.id}`
    ),
  ]);

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `prod_page:${catId}:${page - 1}`));
  if (start + perPage < products.length) nav.push(Markup.button.callback('➡️', `prod_page:${catId}:${page + 1}`));
  if (nav.length) btns.push(nav);
  btns.push([
    Markup.button.callback(t(lang, 'btnCategories'), 'categories'),
    Markup.button.callback(t(lang, 'btnCart'), 'view_cart'),
  ]);

  return Markup.inlineKeyboard(btns);
};

const myOrdersButtons = (orders, page = 0, lang = 'uz') => {
  const perPage = 5;
  const start = page * perPage;
  const items = orders.slice(start, start + perPage);
  const btns = items.map(o => [
    Markup.button.callback(
      `${o.orderNumber} — ${o.status === 'delivered' ? '✅' : '⏳'} ${(o.grandTotal || o.total || 0).toLocaleString()} ${t(lang, 'som')}`,
      `my_order:${o.id}`
    ),
  ]);

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `my_orders_page:${page - 1}`));
  if (start + perPage < orders.length) nav.push(Markup.button.callback('➡️', `my_orders_page:${page + 1}`));
  if (nav.length) btns.push(nav);

  return Markup.inlineKeyboard(btns);
};

const adminOrdersList = (orders, page = 0) => {
  const perPage = 5;
  const start = page * perPage;
  const items = orders.slice(start, start + perPage);
  const btns = items.map(o => [
    Markup.button.callback(
      `${o.orderNumber} | ${o.customerName || '?'} | ${(o.grandTotal || o.total || 0).toLocaleString()} so'm`,
      `admin_order:${o.id}`
    ),
  ]);

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `admin_orders_page:${page - 1}`));
  if (start + perPage < orders.length) nav.push(Markup.button.callback('➡️', `admin_orders_page:${page + 1}`));
  if (nav.length) btns.push(nav);

  return Markup.inlineKeyboard(btns);
};

const backButton = (cb = 'main_menu', lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'back'), cb)],
]);

const cancelButton = (lang = 'uz') => Markup.keyboard([[t(lang, 'cancel')]]).resize().oneTime();

const sharePhoneButton = (lang = 'uz') => Markup.keyboard([
  [Markup.button.contactRequest(t(lang, 'btnSharePhone'))],
  [t(lang, 'cancel')],
]).resize().oneTime();

// ─── SODIQLIK / BONUS ────────────────────────────────────────────────────────
const loyaltyMenu = (lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'btnMyPoints'), 'loyalty_balance')],
  [Markup.button.callback(t(lang, 'btnRewardsShop'), 'rewards_shop')],
  [Markup.button.callback(t(lang, 'btnDailyBonus'), 'loyalty_daily')],
  [Markup.button.callback(t(lang, 'btnInviteFriend'), 'referral_info')],
  [Markup.button.callback(t(lang, 'btnEnterPromo'), 'promo_enter')],
  [Markup.button.callback(t(lang, 'btnTiers'), 'loyalty_tiers')],
]);

// Sovg'alar do'koni ro'yxati
const rewardsButtons = (rewards, page = 0, lang = 'uz', perPage = 6) => {
  const start = page * perPage;
  const slice = rewards.slice(start, start + perPage);
  const btns = slice.map(r => [
    Markup.button.callback(t(lang, 'rewardCost', { name: r.name, cost: (r.pointsCost || 0).toLocaleString() }), `reward:${r.id}`),
  ]);
  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `rewards_page:${page - 1}`));
  if (start + perPage < rewards.length) nav.push(Markup.button.callback('➡️', `rewards_page:${page + 1}`));
  if (nav.length) btns.push(nav);
  btns.push([Markup.button.callback(t(lang, 'back'), 'loyalty_menu')]);
  return Markup.inlineKeyboard(btns);
};

const rewardActions = (rewardId, canRedeem, lang = 'uz') => {
  const rows = [];
  if (canRedeem) rows.push([Markup.button.callback(t(lang, 'btnRedeem'), `reward_redeem:${rewardId}`)]);
  rows.push([Markup.button.callback(t(lang, 'back'), 'rewards_shop')]);
  return Markup.inlineKeyboard(rows);
};

const favoritesNavButtons = (items, page = 0, lang = 'uz', perPage = 5) => {
  const start = page * perPage;
  const slice = items.slice(start, start + perPage);
  const btns = slice.map(p => [
    Markup.button.callback(`${p.name} — ${(p.price || 0).toLocaleString()} ${t(lang, 'som')}`, `product:${p.id}`),
  ]);
  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `fav_page:${page - 1}`));
  if (start + perPage < items.length) nav.push(Markup.button.callback('➡️', `fav_page:${page + 1}`));
  if (nav.length) btns.push(nav);
  btns.push([Markup.button.callback(t(lang, 'mainMenuBtn'), 'main_menu')]);
  return Markup.inlineKeyboard(btns);
};

const ratingStarsKeyboard = (productId, lang = 'uz') => Markup.inlineKeyboard([
  [1, 2, 3, 4, 5].map(n => Markup.button.callback('⭐'.repeat(n), `review_star:${productId}:${n}`)),
  [Markup.button.callback(t(lang, 'cancel'), 'review_cancel')],
]);

const languageButtons = () => Markup.inlineKeyboard([
  [Markup.button.callback("🇺🇿 O'zbekcha", 'lang:uz')],
  [Markup.button.callback('🇺🇿 Ўзбекча (кирилл)', 'lang:uz_cyrl')],
  [Markup.button.callback('🇷🇺 Русский', 'lang:ru')],
  [Markup.button.callback('🇬🇧 English', 'lang:en')],
]);

const quantityPickerKeyboard = (productId, qty = 1, lang = 'uz') => Markup.inlineKeyboard([
  [
    Markup.button.callback('➖', `qty_dec:${productId}`),
    Markup.button.callback(t(lang, 'btnInCartQty', { n: qty }), 'noop'),
    Markup.button.callback('➕', `qty_inc:${productId}`),
  ],
  [Markup.button.callback(t(lang, 'btnAdd'), `qty_confirm:${productId}`)],
]);

const supportTicketKeyboard = (lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'btnNewTicket'), 'support_new')],
  [Markup.button.callback(t(lang, 'btnMyTickets'), 'support_my')],
]);

const yesNoKeyboard = (yesData, noData, lang = 'uz') => Markup.inlineKeyboard([
  [Markup.button.callback(t(lang, 'yes'), yesData), Markup.button.callback(t(lang, 'no'), noData)],
]);

const orderRatingKeyboard = (orderId) => Markup.inlineKeyboard([
  [1, 2, 3, 4, 5].map(n => Markup.button.callback(String(n) + '⭐', `order_rate:${orderId}:${n}`)),
]);

module.exports = {
  mainMenu, adminMainMenu, mainMenuV2, websiteButton,
  productActions, productActionsV2, cartActions, locationChoice, addressRetryButtons,
  receiveTypeChoice, pickupWarehouseButtons,
  sendLocationButton, paymentChoice, confirmOrder,
  orderStatusActions, categoryButtons, productListButtons,
  myOrdersButtons, adminOrdersList,
  backButton, cancelButton, sharePhoneButton,
  favoriteToggleBtn, loyaltyMenu, rewardsButtons, rewardActions, favoritesNavButtons,
  ratingStarsKeyboard, languageButtons,
  quantityPickerKeyboard, supportTicketKeyboard,
  yesNoKeyboard, orderRatingKeyboard,
};
