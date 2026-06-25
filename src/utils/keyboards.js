const { Markup } = require('telegraf');

// ─── MAIN MENU ───────────────────────────────────────────────────────────────
const mainMenu = () => Markup.keyboard([
  ['🛍️ Mahsulotlar', '🛒 Savat'],
  ['📋 Buyurtmalarim', '👤 Profilim'],
  ['📍 Yetkazib berish', '📞 Aloqa'],
  ['ℹ️ Haqida', '⭐ Aksiyalar'],
]).resize();

const adminMainMenu = () => Markup.keyboard([
  ['📊 Dashboard', '📦 Mahsulotlar'],
  ['📋 Buyurtmalar', '👥 Mijozlar'],
  ['🏭 Omborlar', '📈 Statistika'],
  ['💬 Xabar yuborish', '⚙️ Sozlamalar'],
  ['🔙 Foydalanuvchi menyu'],
]).resize();

// ─── INLINE KEYBOARDS ────────────────────────────────────────────────────────
const productActions = (productId, qty = 0) => Markup.inlineKeyboard([
  [
    Markup.button.callback('➖', `cart_dec:${productId}`),
    Markup.button.callback(qty > 0 ? `🛒 ${qty} ta` : '🛒 Qo\'shish', `cart_add:${productId}`),
    Markup.button.callback('➕', `cart_inc:${productId}`),
  ],
  [Markup.button.callback('ℹ️ Batafsil', `product_detail:${productId}`)],
]);

const cartActions = () => Markup.inlineKeyboard([
  [Markup.button.callback('✅ Buyurtma berish', 'order_start')],
  [
    Markup.button.callback('🗑️ Tozalash', 'cart_clear'),
    Markup.button.callback('🛍️ Davom etish', 'continue_shopping'),
  ],
]);

const locationChoice = () => Markup.inlineKeyboard([
  [Markup.button.callback('📍 Joylashuvni yuborish', 'send_location')],
  [Markup.button.callback('✍️ Manzil yozish', 'type_address')],
  [Markup.button.callback('❌ Bekor qilish', 'cancel_order')],
]);

const sendLocationButton = () => Markup.keyboard([
  [Markup.button.locationRequest('📍 Joylashuvimni yuborish')],
  ['❌ Bekor qilish'],
]).resize().oneTime();

const paymentChoice = () => Markup.inlineKeyboard([
  [Markup.button.callback('💵 Naqd (Yetkazganda)', 'pay_cash')],
  [Markup.button.callback('💳 Karta orqali', 'pay_card')],
  [Markup.button.callback('🔙 Orqaga', 'back_to_cart')],
]);

const confirmOrder = () => Markup.inlineKeyboard([
  [Markup.button.callback('✅ Tasdiqlash', 'order_confirm')],
  [Markup.button.callback('✏️ O\'zgartirish', 'order_edit')],
  [Markup.button.callback('❌ Bekor qilish', 'cancel_order')],
]);

const orderStatusActions = (orderId, status) => {
  const btns = [];
  if (status === 'pending') {
    btns.push([
      Markup.button.callback('✅ Tasdiqlash', `admin_confirm:${orderId}`),
      Markup.button.callback('❌ Bekor', `admin_cancel:${orderId}`),
    ]);
  }
  if (status === 'confirmed') {
    btns.push([Markup.button.callback('🚚 Yo\'lga chiqdi', `admin_ship:${orderId}`)]);
  }
  if (status === 'shipped') {
    btns.push([Markup.button.callback('✅ Yetkazildi', `admin_deliver:${orderId}`)]);
  }
  if (status === 'paid_pending') {
    btns.push([Markup.button.callback('✅ To\'lovni tasdiqlash', `admin_pay_ok:${orderId}`)]);
    btns.push([Markup.button.callback('❌ To\'lovni rad etish', `admin_pay_fail:${orderId}`)]);
  }
  btns.push([Markup.button.callback('👁️ Batafsil', `admin_view_order:${orderId}`)]);
  return Markup.inlineKeyboard(btns);
};

const categoryButtons = (categories, page = 0) => {
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
  btns.push([Markup.button.callback('🏠 Bosh menyu', 'main_menu')]);

  return Markup.inlineKeyboard(btns);
};

const productListButtons = (products, catId, page = 0) => {
  const perPage = 5;
  const start = page * perPage;
  const items = products.slice(start, start + perPage);
  const btns = items.map(p => [
    Markup.button.callback(
      `${p.name} — ${p.price?.toLocaleString()} so'm`,
      `product:${p.id}`
    ),
  ]);

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `prod_page:${catId}:${page - 1}`));
  if (start + perPage < products.length) nav.push(Markup.button.callback('➡️', `prod_page:${catId}:${page + 1}`));
  if (nav.length) btns.push(nav);
  btns.push([
    Markup.button.callback('🔙 Kategoriyalar', 'categories'),
    Markup.button.callback('🛒 Savat', 'view_cart'),
  ]);

  return Markup.inlineKeyboard(btns);
};

const myOrdersButtons = (orders, page = 0) => {
  const perPage = 5;
  const start = page * perPage;
  const items = orders.slice(start, start + perPage);
  const btns = items.map(o => [
    Markup.button.callback(
      `${o.orderNumber} — ${o.status === 'delivered' ? '✅' : '⏳'} ${(o.total || 0).toLocaleString()} so'm`,
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
      `${o.orderNumber} | ${o.customerName || '?'} | ${(o.total || 0).toLocaleString()} so'm`,
      `admin_order:${o.id}`
    ),
  ]);

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `admin_orders_page:${page - 1}`));
  if (start + perPage < orders.length) nav.push(Markup.button.callback('➡️', `admin_orders_page:${page + 1}`));
  if (nav.length) btns.push(nav);

  return Markup.inlineKeyboard(btns);
};

const backButton = (cb = 'main_menu') => Markup.inlineKeyboard([
  [Markup.button.callback('🔙 Orqaga', cb)],
]);

const cancelButton = () => Markup.keyboard([['❌ Bekor qilish']]).resize().oneTime();

const sharePhoneButton = () => Markup.keyboard([
  [Markup.button.contactRequest('📱 Raqamimni ulashish')],
  ['❌ Bekor qilish'],
]).resize().oneTime();

// ─── YANGI MIJOZ FUNKSIYALARI UCHUN TUGMALAR ─────────────────────────────────

const mainMenuV2 = () => Markup.keyboard([
  ['🛍️ Mahsulotlar', '🛒 Savat'],
  ['📋 Buyurtmalarim', '👤 Profilim'],
  ['❤️ Sevimlilar', '🎁 Bonus va Sodiqlik'],
  ['📍 Yetkazib berish', '📞 Aloqa'],
  ['ℹ️ Haqida', '⭐ Aksiyalar'],
]).resize();

const favoriteToggleBtn = (productId, isFav) => Markup.inlineKeyboard([
  [Markup.button.callback(isFav ? '💔 Sevimlilardan olib tashlash' : '❤️ Sevimlilarga qo\'shish', `fav_toggle:${productId}`)],
]);

const productActionsV2 = (productId, qty = 0, isFav = false) => Markup.inlineKeyboard([
  [
    Markup.button.callback('➖', `cart_dec:${productId}`),
    Markup.button.callback(qty > 0 ? `🛒 ${qty} ta` : '🛒 Qo\'shish', `cart_add:${productId}`),
    Markup.button.callback('➕', `cart_inc:${productId}`),
  ],
  [
    Markup.button.callback(isFav ? '💔' : '❤️', `fav_toggle:${productId}`),
    Markup.button.callback('ℹ️ Batafsil', `product_detail:${productId}`),
    Markup.button.callback('⭐ Baholash', `review_start:${productId}`),
  ],
]);

const loyaltyMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('💰 Ballarim', 'loyalty_balance')],
  [Markup.button.callback('🎁 Kunlik bonus', 'loyalty_daily')],
  [Markup.button.callback('👥 Do\'stni taklif qilish', 'referral_info')],
  [Markup.button.callback('🎟️ Promo-kod kiritish', 'promo_enter')],
  [Markup.button.callback('🏆 Daraja haqida', 'loyalty_tiers')],
]);

const favoritesNavButtons = (items, page = 0, perPage = 5) => {
  const start = page * perPage;
  const slice = items.slice(start, start + perPage);
  const btns = slice.map(p => [
    Markup.button.callback(`${p.name} — ${(p.price || 0).toLocaleString()} so'm`, `product:${p.id}`),
  ]);
  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅️', `fav_page:${page - 1}`));
  if (start + perPage < items.length) nav.push(Markup.button.callback('➡️', `fav_page:${page + 1}`));
  if (nav.length) btns.push(nav);
  btns.push([Markup.button.callback('🏠 Bosh menyu', 'main_menu')]);
  return Markup.inlineKeyboard(btns);
};

const ratingStarsKeyboard = (productId) => Markup.inlineKeyboard([
  [1, 2, 3, 4, 5].map(n => Markup.button.callback('⭐'.repeat(n), `review_star:${productId}:${n}`)),
  [Markup.button.callback('❌ Bekor qilish', 'review_cancel')],
]);

const languageButtons = () => Markup.inlineKeyboard([
  [Markup.button.callback('🇺🇿 O\'zbekcha', 'lang:uz')],
  [Markup.button.callback('🇷🇺 Русский', 'lang:ru')],
  [Markup.button.callback('🇬🇧 English', 'lang:en')],
]);

const sortFilterButtons = (catId) => Markup.inlineKeyboard([
  [
    Markup.button.callback('💰 Arzon→Qimmat', `sort:${catId}:price_asc`),
    Markup.button.callback('💰 Qimmat→Arzon', `sort:${catId}:price_desc`),
  ],
  [
    Markup.button.callback('🆕 Yangi', `sort:${catId}:new`),
    Markup.button.callback('⭐ Reyting', `sort:${catId}:rating`),
  ],
]);

const quantityPickerKeyboard = (productId, qty = 1) => Markup.inlineKeyboard([
  [
    Markup.button.callback('➖', `qty_dec:${productId}`),
    Markup.button.callback(`${qty} ta`, 'noop'),
    Markup.button.callback('➕', `qty_inc:${productId}`),
  ],
  [Markup.button.callback('🛒 Savatga qo\'shish', `qty_confirm:${productId}`)],
]);

const supportTicketKeyboard = () => Markup.inlineKeyboard([
  [Markup.button.callback('🆕 Murojaat yuborish', 'support_new')],
  [Markup.button.callback('📋 Murojaatlarim', 'support_my')],
]);

const wishlistShareButton = (userId) => Markup.inlineKeyboard([
  [Markup.button.url('📤 Ulashish', `https://t.me/share/url?url=Mening BoomStroy sevimlilar ro'yxatim`)],
]);

const yesNoKeyboard = (yesData, noData) => Markup.inlineKeyboard([
  [Markup.button.callback('✅ Ha', yesData), Markup.button.callback('❌ Yo\'q', noData)],
]);

const orderRatingKeyboard = (orderId) => Markup.inlineKeyboard([
  [1, 2, 3, 4, 5].map(n => Markup.button.callback(String(n) + '⭐', `order_rate:${orderId}:${n}`)),
]);

module.exports = {
  mainMenu, adminMainMenu, mainMenuV2,
  productActions, productActionsV2, cartActions, locationChoice,
  sendLocationButton, paymentChoice, confirmOrder,
  orderStatusActions, categoryButtons, productListButtons,
  myOrdersButtons, adminOrdersList,
  backButton, cancelButton, sharePhoneButton,
  favoriteToggleBtn, loyaltyMenu, favoritesNavButtons,
  ratingStarsKeyboard, languageButtons, sortFilterButtons,
  quantityPickerKeyboard, supportTicketKeyboard, wishlistShareButton,
  yesNoKeyboard, orderRatingKeyboard,
};
