const { getSession, setSession, getCart, clearCart, getCartTotal } = require('../services/session');
const { addDoc, updateDoc, queryDocs, getCollection, addLog } = require('../services/firebase');
const { checkDelivery, WAREHOUSE } = require('../services/delivery');
const { fmtNum, fmtDate, generateOrderNumber, orderStatusLabel } = require('../utils/helpers');
const {
  paymentChoice, confirmOrder, mainMenu, receiveTypeChoice,
  pickupWarehouseButtons, addressRetryButtons, sendLocationButton, cancelButton,
} = require('../utils/keyboards');
const { t, langOf } = require('../utils/i18n');
const { Markup } = require('telegraf');
const { buildCartSummary } = require('./cart');

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);
const ADMIN_GROUP = process.env.ADMIN_GROUP_ID;
const CARD_NUMBER = process.env.CARD_NUMBER || '8600000000000000';
const CARD_OWNER = process.env.CARD_OWNER || 'BoomStroy LLC';

function payLabel(lang, payType, isPickup) {
  if (payType === 'card') return t(lang, 'payCard');
  return isPickup ? t(lang, 'payCashPickup') : t(lang, 'payCash');
}

// ─── STEP 1: Buyurtmani boshlash → olish turini tanlash ──────────────────────
async function handleOrderStart(ctx) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const cart = getCart(ctx.from.id);
  if (!cart.length) {
    const msg = t(lang, 'cartEmptyFirst');
    if (ctx.callbackQuery) { try { return ctx.editMessageText(msg); } catch { return ctx.reply(msg); } }
    return ctx.reply(msg);
  }

  const total = getCartTotal(ctx.from.id);
  setSession(ctx.from.id, { orderTotal: total });

  const text = t(lang, 'chooseReceiveType', { summary: buildCartSummary(cart, lang) });
  if (ctx.callbackQuery) {
    try { return await ctx.editMessageText(text, { parse_mode: 'Markdown', ...receiveTypeChoice(lang) }); }
    catch { return await ctx.reply(text, { parse_mode: 'Markdown', ...receiveTypeChoice(lang) }); }
  }
  return await ctx.reply(text, { parse_mode: 'Markdown', ...receiveTypeChoice(lang) });
}

// ─── STEP 1a: Yetkazib berish tanlandi → manzil so'rash ──────────────────────
async function handleReceiveDelivery(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  setSession(ctx.from.id, { deliveryType: 'delivery' });

  const kb = Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'btnSendLocation'), 'send_location')],
    [Markup.button.callback(t(lang, 'btnTypeAddress'), 'type_address')],
    [Markup.button.callback(t(lang, 'cancel'), 'cancel_order')],
  ]);
  try {
    return await ctx.editMessageText(t(lang, 'chooseAddress'), { parse_mode: 'Markdown', ...kb });
  } catch {
    return await ctx.reply(t(lang, 'chooseAddress'), { parse_mode: 'Markdown', ...kb });
  }
}

// ─── STEP 1b: Borib olish tanlandi → ombor tanlash ───────────────────────────
async function handlePickupStart(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();

  const warehouses = await getPickupWarehouses();
  if (!warehouses.length) {
    return ctx.editMessageText(t(lang, 'pickupNoWarehouses'), receiveTypeChoice(lang));
  }
  setSession(ctx.from.id, { deliveryType: 'pickup' });
  try {
    return await ctx.editMessageText(t(lang, 'pickupChoose'), { parse_mode: 'Markdown', ...pickupWarehouseButtons(warehouses, lang) });
  } catch {
    return await ctx.reply(t(lang, 'pickupChoose'), { parse_mode: 'Markdown', ...pickupWarehouseButtons(warehouses, lang) });
  }
}

// Omborlar ro'yxati: admin paneldagi `warehouses` + asosiy ombor
async function getPickupWarehouses() {
  let list = [];
  try { list = await getCollection('warehouses'); } catch { list = []; }
  const active = (list || []).filter(w => w.active !== false && (w.pickup !== false));
  const main = { id: 'main', name: WAREHOUSE.name, address: WAREHOUSE.address || '', phone: WAREHOUSE.phone || '', lat: WAREHOUSE.lat, lng: WAREHOUSE.lng };
  // Asosiy ombor allaqachon ro'yxatda bo'lmasa, oldiga qo'shamiz
  if (!active.find(w => w.id === 'main')) return [main, ...active];
  return active;
}

// ─── STEP 1c: Aniq ombor tanlandi → to'lovga o'tish ──────────────────────────
async function handlePickupSelect(ctx, warehouseId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();

  const warehouses = await getPickupWarehouses();
  const wh = warehouses.find(w => w.id === warehouseId) || warehouses[0];
  if (!wh) return ctx.editMessageText(t(lang, 'pickupNoWarehouses'));

  const total = getCartTotal(ctx.from.id);
  setSession(ctx.from.id, {
    step: 'waiting_payment',
    deliveryType: 'pickup',
    pickupWarehouseId: wh.id,
    pickupWarehouseName: wh.name,
    pickupAddress: wh.address || '',
    pickupPhone: wh.phone || '',
    orderAddress: wh.name,
    orderCity: wh.name,
    deliveryFee: 0,
    deliveryDistance: 0,
    deliveryBreakdown: '',
  });

  const addrLine = wh.address ? `📌 ${wh.address}\n` : '';
  const phoneLine = wh.phone ? `📞 ${wh.phone}\n` : '';
  const text = t(lang, 'pickupSelected', {
    wh: wh.name, addr: addrLine, phone: phoneLine,
    som: t(lang, 'som'), total: fmtNum(total), grand: fmtNum(total),
  });
  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...paymentChoice(lang, true) });
}

// ─── STEP 2a: Joylashuv (GPS) qabul qilish ───────────────────────────────────
async function handleLocationMessage(ctx) {
  const lang = langOf(ctx);
  const s = getSession(ctx.from.id);
  if (s.step !== 'waiting_location') return;

  const { latitude: lat, longitude: lng } = ctx.message.location;
  await ctx.reply(t(lang, 'addrChecking'), { reply_markup: { remove_keyboard: true } });

  const cart = getCart(ctx.from.id);
  const orderCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const result = await checkDelivery(lat, lng, orderCount, lang);

  if (!result.success) {
    await ctx.reply(result.message, { parse_mode: 'Markdown', ...addressRetryButtons(lang) });
    setSession(ctx.from.id, { step: null });
    return;
  }

  setSession(ctx.from.id, {
    step: 'waiting_payment',
    deliveryType: 'delivery',
    orderLat: lat, orderLng: lng,
    orderAddress: result.address, orderCity: result.city,
    deliveryFee: result.deliveryFee, deliveryDistance: result.distance,
    deliveryBreakdown: result.breakdown,
  });

  await showDeliveryInfo(ctx, result);
}

// ─── STEP 2b: Matn orqali manzil ─────────────────────────────────────────────
async function handleTextAddress(ctx) {
  const lang = langOf(ctx);
  const s = getSession(ctx.from.id);
  if (s.step !== 'waiting_text_address') return;

  const address = ctx.message.text;
  if (address === t(lang, 'cancel')) return handleCancelOrder(ctx);

  await ctx.reply(t(lang, 'addrSearching'));

  const { geocodeAddress } = require('../services/delivery');
  let geo = await geocodeAddress(address + ", O'zbekiston");
  if (!geo) geo = await geocodeAddress(address + ', Toshkent, O\'zbekiston');

  if (!geo) {
    return ctx.reply(t(lang, 'addrNotFound'), { parse_mode: 'Markdown', ...addressRetryButtons(lang) });
  }

  const cart = getCart(ctx.from.id);
  const orderCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const result = await checkDelivery(geo.lat, geo.lng, orderCount, lang);

  if (!result.success) {
    return ctx.reply(result.message, { parse_mode: 'Markdown', ...addressRetryButtons(lang) });
  }

  setSession(ctx.from.id, {
    step: 'waiting_payment',
    deliveryType: 'delivery',
    orderLat: geo.lat, orderLng: geo.lng,
    orderAddress: result.address || address, orderCity: result.city || address,
    deliveryFee: result.deliveryFee, deliveryDistance: result.distance,
    deliveryBreakdown: result.breakdown,
  });

  await showDeliveryInfo(ctx, result);
}

// ─── Yetkazib berish ma'lumotlarini ko'rsatish ────────────────────────────────
async function showDeliveryInfo(ctx, result) {
  const lang = langOf(ctx);
  const total = getCartTotal(ctx.from.id);
  const grandTotal = total + result.deliveryFee;
  const discount = result.discountPercent
    ? t(lang, 'discountLine', { d: t(lang, 'bulkDiscount', { pct: result.discountPercent, n: result.orderCount }) })
    : '';

  const text = t(lang, 'addrConfirmed', {
    city: result.city || result.address,
    dist: result.distance,
    fee: fmtNum(result.deliveryFee),
    breakdown: result.breakdown,
    discount,
    total: fmtNum(total),
    grand: fmtNum(grandTotal),
    som: t(lang, 'som'),
  });

  await ctx.reply(text, { parse_mode: 'Markdown', ...paymentChoice(lang, false) });
}

// ─── STEP 3: To'lov turini tanlash ───────────────────────────────────────────
async function handlePaymentChoice(ctx, payType) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const s = getSession(ctx.from.id);

  if (!s.orderAddress) {
    return ctx.reply(t(lang, 'payExpired'), mainMenu(lang));
  }

  const isPickup = s.deliveryType === 'pickup';
  setSession(ctx.from.id, { paymentType: payType });

  const cart = getCart(ctx.from.id);
  const total = getCartTotal(ctx.from.id);
  const grandTotal = total + (s.deliveryFee || 0);

  if (payType === 'card') {
    const text = t(lang, 'payCardText', { card: CARD_NUMBER, owner: CARD_OWNER, grand: fmtNum(grandTotal), som: t(lang, 'som') });
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'cancel'), 'cancel_order')]]),
    });
    setSession(ctx.from.id, { step: 'waiting_payment_photo', paymentType: 'card' });
  } else {
    setSession(ctx.from.id, { step: 'confirm_order', paymentType: 'cash' });
    await showOrderSummary(ctx, getSession(ctx.from.id), cart, total, grandTotal, 'cash', isPickup);
  }
}

// ─── STEP 3a: To'lov chekini qabul qilish ────────────────────────────────────
async function handlePaymentPhoto(ctx) {
  const lang = langOf(ctx);
  const s = getSession(ctx.from.id);
  if (s.step !== 'waiting_payment_photo') return;

  const photo = ctx.message.photo;
  const doc = ctx.message.document;
  if (!photo && !doc) return ctx.reply(t(lang, 'sendReceiptPhoto'));

  const fileId = photo ? photo[photo.length - 1].file_id : doc.file_id;
  setSession(ctx.from.id, { step: 'confirm_order', paymentPhotoId: fileId });

  const cart = getCart(ctx.from.id);
  const total = getCartTotal(ctx.from.id);
  const grandTotal = total + (s.deliveryFee || 0);

  await ctx.reply(t(lang, 'receiptAccepted'), { reply_markup: { remove_keyboard: true } });
  await showOrderSummary(ctx, getSession(ctx.from.id), cart, total, grandTotal, 'card', s.deliveryType === 'pickup');
}

// ─── Buyurtma xulosasini ko'rsatish ──────────────────────────────────────────
async function showOrderSummary(ctx, s, cart, total, grandTotal, payType, isPickup) {
  const lang = langOf(ctx);
  const items = cart.map((i, idx) =>
    `${idx + 1}. ${i.name} × ${i.qty} = ${fmtNum(i.qty * i.price)} ${t(lang, 'som')}`
  ).join('\n');

  const recv = isPickup
    ? t(lang, 'recvPickupBlock', { wh: s.pickupWarehouseName || s.orderAddress, som: t(lang, 'som') })
    : t(lang, 'recvDeliveryBlock', { city: s.orderCity || s.orderAddress, dist: s.deliveryDistance || 0, fee: fmtNum(s.deliveryFee || 0), som: t(lang, 'som') });

  const text = t(lang, 'orderSummary', {
    items, recv, pay: payLabel(lang, payType, isPickup),
    grand: fmtNum(grandTotal), som: t(lang, 'som'),
  });

  await ctx.reply(text, { parse_mode: 'Markdown', ...confirmOrder(lang) });
}

// ─── STEP 4: Buyurtmani tasdiqlash ───────────────────────────────────────────
async function handleOrderConfirm(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery(t(lang, 'orderPlacing'));
  const s = getSession(ctx.from.id);
  const cart = getCart(ctx.from.id);

  if (!cart.length || !s.orderAddress) {
    return ctx.editMessageText(t(lang, 'orderErrorRetry'));
  }

  const isPickup = s.deliveryType === 'pickup';
  const tgId = String(ctx.from.id);
  const users = await queryDocs('telegramUsers', 'telegramId', '==', tgId);
  const user = users[0] || {};

  const total = getCartTotal(ctx.from.id);
  const deliveryFee = isPickup ? 0 : (s.deliveryFee || 0);

  const { calcPromoDiscount } = require('../utils/helpers');
  const promo = s.activePromo || null;
  const promoDiscount = promo ? calcPromoDiscount(promo, total) : 0;

  const pointsToRedeem = Math.min(s.redeemPoints || 0, user.loyaltyPoints || 0);
  const pointsDiscount = pointsToRedeem * require('../utils/helpers').LOYALTY_POINT_VALUE;

  const grandTotal = Math.max(0, total + deliveryFee - promoDiscount - pointsDiscount);
  const orderNum = generateOrderNumber();

  const orderData = {
    orderNumber: orderNum,
    telegramId: tgId,
    customerId: user.id || '',
    customerName: (user.firstName || '') + ' ' + (user.lastName || ''),
    customerPhone: user.phone || '',
    customerUsername: user.username || '',
    items: cart.map(i => ({ ...i })),
    total,
    deliveryFee,
    deliveryType: isPickup ? 'pickup' : 'delivery',
    pickupWarehouseId: isPickup ? (s.pickupWarehouseId || '') : null,
    pickupWarehouseName: isPickup ? (s.pickupWarehouseName || '') : null,
    promoCode: promo?.code || null,
    promoDiscount,
    pointsRedeemed: pointsToRedeem,
    pointsDiscount,
    grandTotal,
    paymentType: s.paymentType || 'cash',
    paymentPhotoId: s.paymentPhotoId || null,
    paymentStatus: s.paymentType === 'card' ? 'pending_check' : 'pending',
    status: s.paymentType === 'card' ? 'paid_pending' : 'pending',
    deliveryAddress: s.orderAddress,
    deliveryCity: s.orderCity || '',
    location: s.orderLat ? { lat: s.orderLat, lng: s.orderLng } : null,
    deliveryDistance: s.deliveryDistance || 0,
    note: s.orderNote || '',
    lang,
    source: 'telegram',
  };

  const orderId = await addDoc('orders', orderData);
  await addLog('order', `Yangi buyurtma: ${orderNum} — ${user.firstName || tgId}`, { orderId, total: grandTotal });

  if (user.id) {
    await updateDoc('telegramUsers', user.id, {
      orderCount: (user.orderCount || 0) + 1,
      totalSpent: (user.totalSpent || 0) + grandTotal,
      lastOrderAt: require('../services/firebase').admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
  }

  // Mahsulot miqdorlarini yangilash
  try {
    const all = await getCollection('products');
    for (const item of cart) {
      const prod = all.find(p => p.id === item.productId);
      if (prod) {
        await updateDoc('products', item.productId, {
          quantity: Math.max(0, (prod.quantity || 0) - item.qty),
        }).catch(() => { });
      }
    }
  } catch { }

  clearCart(ctx.from.id);
  setSession(ctx.from.id, { step: null, currentOrderId: orderId, activePromo: null, redeemPoints: 0 });

  try {
    const { redeemLoyaltyPoints, awardLoyaltyPoints, markPromoUsed } = require('./loyalty');
    if (pointsToRedeem > 0) await redeemLoyaltyPoints(tgId, pointsToRedeem);
    await awardLoyaltyPoints(tgId, grandTotal);
    if (promo?.id) await markPromoUsed(promo.id, tgId);
  } catch (e) {
    console.error('Loyalty award error:', e.message);
  }

  const earnedPoints = require('../utils/helpers').calcEarnedPoints(grandTotal);
  const som = t(lang, 'som');

  const recv = isPickup
    ? t(lang, 'acceptedRecvPickup', { wh: s.pickupWarehouseName || s.orderAddress })
    : t(lang, 'acceptedRecvDelivery', { fee: fmtNum(deliveryFee), city: s.orderCity || s.orderAddress, som });

  const promoLine = promoDiscount > 0 ? t(lang, 'promoDiscLine', { d: fmtNum(promoDiscount), som }) : '';
  const pointsLine = pointsDiscount > 0 ? t(lang, 'pointsDiscLine', { d: fmtNum(pointsDiscount), p: pointsToRedeem, som }) : '';
  const payNote = s.paymentType === 'card'
    ? t(lang, 'payNoteCard')
    : (isPickup ? t(lang, 'payNoteCashPickup') : t(lang, 'payNoteCashDelivery'));

  const userText = t(lang, 'orderAccepted', {
    num: orderNum, promo: promoLine, points: pointsLine,
    grand: fmtNum(grandTotal), recv, earned: fmtNum(earnedPoints), payNote, som,
  });

  await ctx.editMessageText(userText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btnMyOrders'), 'my_orders')]]),
  });

  await notifyAdmins(ctx, orderData, orderId, s);
}

// ─── Adminlarga xabar yuborish ────────────────────────────────────────────────
async function notifyAdmins(ctx, order, orderId, s) {
  const bot = ctx.telegram;
  const isPickup = order.deliveryType === 'pickup';

  const recvLine = isPickup
    ? `🏪 Borib olish: ${order.pickupWarehouseName || '-'}\n`
    : `📍 Manzil: ${order.deliveryCity || order.deliveryAddress}\n📏 Masofa: ${order.deliveryDistance} km\n` +
      (order.location ? `🗺️ [Xaritada ko'rish](https://maps.google.com/?q=${order.location.lat},${order.location.lng})\n` : '');

  const adminText =
    `🆕 *YANGI BUYURTMA!*\n\n` +
    `📋 №: *${order.orderNumber}*\n` +
    `👤 Mijoz: ${order.customerName}\n` +
    `📱 Tel: ${order.customerPhone || '-'}\n` +
    `🆔 TG: @${order.customerUsername || '-'} (${order.telegramId})\n\n` +
    `🛒 *Mahsulotlar:*\n` +
    order.items.map(i => `• ${i.name} × ${i.qty} = ${fmtNum(i.qty * i.price)} so'm`).join('\n') +
    `\n\n💰 Mahsulot: ${fmtNum(order.total)} so'm\n` +
    `🚚 Yetkazib berish: ${isPickup ? '0 (borib olish)' : fmtNum(order.deliveryFee)} so'm\n` +
    `💳 *JAMI: ${fmtNum(order.grandTotal)} so'm*\n\n` +
    recvLine +
    `💳 To'lov: ${order.paymentType === 'card' ? '💳 Karta (chek kutilmoqda)' : '💵 Naqd'}\n\n` +
    `🕐 ${new Date().toLocaleString('uz-UZ')}`;

  const { orderStatusActions } = require('../utils/keyboards');
  const keyboard = orderStatusActions(orderId, order.status);
  const targets = ADMIN_GROUP ? [ADMIN_GROUP] : ADMIN_IDS;

  for (const adminId of targets) {
    try {
      const allProducts = await getCollection('products');
      const itemsWithImages = order.items.filter(i => {
        const prod = allProducts.find(p => p.id === i.productId);
        return prod && prod.imageUrl;
      });

      if (itemsWithImages.length > 0) {
        const mediaGroup = itemsWithImages.slice(0, 10).map((item, idx) => {
          const prod = allProducts.find(p => p.id === item.productId);
          return {
            type: 'photo', media: prod.imageUrl,
            caption: idx === 0 ? `🖼️ *Buyurtma rasmlari*\n📋 ${order.orderNumber}` : `📦 ${item.name} × ${item.qty}`,
            parse_mode: 'Markdown',
          };
        });
        await bot.sendMediaGroup(adminId, mediaGroup).catch(async () => {
          const firstProd = allProducts.find(p => p.id === itemsWithImages[0].productId);
          if (firstProd?.imageUrl) {
            await bot.sendPhoto(adminId, firstProd.imageUrl, { caption: `🖼️ Buyurtma: ${order.orderNumber}` }).catch(() => { });
          }
        });
      }

      if (order.paymentType === 'card' && order.paymentPhotoId) {
        await bot.sendPhoto(adminId, order.paymentPhotoId, {
          caption: `💳 *KARTA TO'LOV CHEKI*\n📋 ${order.orderNumber}\n💰 ${fmtNum(order.grandTotal)} so'm`,
          parse_mode: 'Markdown',
        }).catch(() => { });
      }

      if (order.location) {
        await bot.sendLocation(adminId, order.location.lat, order.location.lng).catch(() => { });
      }

      await bot.sendMessage(adminId, adminText, { parse_mode: 'Markdown', ...keyboard, disable_web_page_preview: true });
    } catch (e) {
      console.error('Admin notify error:', e.message);
    }
  }
}

// ─── Buyurtmani bekor qilish ──────────────────────────────────────────────────
async function handleCancelOrder(ctx) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: null });
  clearCart(ctx.from.id);
  const msg = t(lang, 'orderCancelled');
  if (ctx.callbackQuery) {
    try { await ctx.editMessageText(msg, mainMenu(lang)); } catch { await ctx.reply(msg, mainMenu(lang)); }
  } else {
    await ctx.reply(msg, mainMenu(lang));
  }
}

// ─── Buyurtmalarim ────────────────────────────────────────────────────────────
async function handleMyOrders(ctx) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const tgId = String(ctx.from.id);
  const orders = await queryDocs('orders', 'telegramId', '==', tgId);
  orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  if (!orders.length) {
    const msg = t(lang, 'noOrdersYet');
    const kb = Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btnShop'), 'categories')]]);
    if (ctx.callbackQuery) return ctx.editMessageText(msg, kb);
    return ctx.reply(msg, kb);
  }

  const { myOrdersButtons } = require('../utils/keyboards');
  const text = t(lang, 'myOrdersTitle', { n: orders.length });
  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...myOrdersButtons(orders, 0, lang) });
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...myOrdersButtons(orders, 0, lang) });
}

// ─── Buyurtma tafsilotlari ────────────────────────────────────────────────────
async function handleViewMyOrder(ctx, orderId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const order = await require('../services/firebase').getDoc('orders', orderId);
  if (!order) return ctx.editMessageText(t(lang, 'orderNotFound'));

  const isPickup = order.deliveryType === 'pickup';
  const som = t(lang, 'som');
  const recv = isPickup
    ? t(lang, 'acceptedRecvPickup', { wh: order.pickupWarehouseName || order.deliveryAddress })
    : t(lang, 'recvDeliveryBlock', { city: order.deliveryCity || order.deliveryAddress, dist: order.deliveryDistance || 0, fee: fmtNum(order.deliveryFee), som });

  const items = (order.items || []).map(i => `• ${i.name} × ${i.qty} = ${fmtNum(i.qty * i.price)} ${som}`).join('\n');
  const text = t(lang, 'orderDetail', {
    num: order.orderNumber,
    status: orderStatusLabel(order.status, lang),
    grand: fmtNum(order.grandTotal), som, recv,
    pay: payLabel(lang, order.paymentType, isPickup),
    items, date: fmtDate(order.createdAt),
  });

  const btns = [];
  if (order.location) btns.push([Markup.button.url(t(lang, 'btnOnMap'), `https://maps.google.com/?q=${order.location.lat},${order.location.lng}`)]);
  btns.push([Markup.button.callback(t(lang, 'back'), 'my_orders')]);

  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
}

module.exports = {
  handleOrderStart,
  handleReceiveDelivery,
  handlePickupStart,
  handlePickupSelect,
  handleLocationMessage,
  handleTextAddress,
  handlePaymentChoice,
  handlePaymentPhoto,
  handleOrderConfirm,
  handleCancelOrder,
  handleMyOrders,
  handleViewMyOrder,
};
