const { getSession, setSession, getCart, clearCart, getCartTotal } = require('../services/session');
const { addDoc, updateDoc, queryDocs, addLog } = require('../services/firebase');
const { checkDelivery } = require('../services/delivery');
const { fmtNum, fmtDate, generateOrderNumber, orderStatusLabel } = require('../utils/helpers');
const {
  sendLocationButton, paymentChoice, confirmOrder,
  mainMenu, cancelButton,
} = require('../utils/keyboards');
const { Markup } = require('telegraf');
const { buildCartSummary } = require('./cart');

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);
const ADMIN_GROUP = process.env.ADMIN_GROUP_ID;
const CARD_NUMBER = process.env.CARD_NUMBER || '8600000000000000';
const CARD_OWNER = process.env.CARD_OWNER || 'BoomStroy LLC';

// ─── STEP 1: Buyurtmani boshlash ─────────────────────────────────────────────
async function handleOrderStart(ctx) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const cart = getCart(ctx.from.id);
  if (!cart.length) {
    const msg = '🛒 Savat bo\'sh! Avval mahsulot tanlang.';
    if (ctx.callbackQuery) return ctx.editMessageText(msg);
    return ctx.reply(msg);
  }

  const total = getCartTotal(ctx.from.id);
  const summary = buildCartSummary(cart);

  // Inline tugmalar: joylashuv yuborish YOKI matn yozish
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('📍 Joylashuvimni yuborish', 'send_location')],
    [Markup.button.callback('✍️ Manzilni qo\'lda yozish', 'type_address')],
    [Markup.button.callback('❌ Bekor qilish', 'cancel_order')],
  ]);

  const text =
    `${summary}\n\n` +
    `📍 *Yetkazib berish manzilini tanlang:*\n\n` +
    `📍 Joylashuvingizni yuboring *(aniqroq)*\n` +
    `✍️ Yoki manzilni qo'lda yozing\n\n` +
    `⚠️ _Bo'ka tumani va 50 km dan uzoqqa yetkazib berilmaydi!_`;

  setSession(ctx.from.id, { orderTotal: total });

  if (ctx.callbackQuery) {
    try {
      return await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb });
    } catch {
      return await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
    }
  }
  return await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
}

// ─── STEP 2a: Joylashuv (GPS) qabul qilish ───────────────────────────────────
async function handleLocationMessage(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'waiting_location') return;

  const { latitude: lat, longitude: lng } = ctx.message.location;

  await ctx.reply('⏳ Manzilingiz tekshirilmoqda...', { reply_markup: { remove_keyboard: true } });

  const cart = getCart(ctx.from.id);
  const orderCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const result = await checkDelivery(lat, lng, orderCount);

  if (!result.success) {
    await ctx.reply(result.message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📍 Joylashuvimni yuborish', 'send_location')],
        [Markup.button.callback('✍️ Manzilni yozish', 'type_address')],
        [Markup.button.callback('❌ Bekor qilish', 'cancel_order')],
      ]),
    });
    setSession(ctx.from.id, { step: null });
    return;
  }

  setSession(ctx.from.id, {
    step: 'waiting_payment',
    orderLat: lat,
    orderLng: lng,
    orderAddress: result.address,
    orderCity: result.city,
    deliveryFee: result.deliveryFee,
    deliveryDistance: result.distance,
    deliveryBreakdown: result.breakdown,
  });

  await showDeliveryInfo(ctx, result, cart);
}

// ─── STEP 2b: Matn orqali manzil ─────────────────────────────────────────────
async function handleTextAddress(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'waiting_text_address') return;

  const address = ctx.message.text;

  // Bekor qilish tugmalari
  if (address === '❌ Bekor qilish') return handleCancelOrder(ctx);

  await ctx.reply('⏳ Manzil qidirilmoqda...');

  const { geocodeAddress } = require('../services/delivery');

  // Avval O'zbekiston bilan qidirish
  let geo = await geocodeAddress(address + ', O\'zbekiston');

  // Topilmasa, Toshkent bilan qidirish
  if (!geo) {
    geo = await geocodeAddress(address + ', Toshkent, O\'zbekiston');
  }

  if (!geo) {
    return ctx.reply(
      '❌ Manzil topilmadi.\n\n' +
      '💡 *Maslahat:* Aniqroq yozing.\n' +
      '_Masalan: Yunusobod 19-mavze, Chilonzor 7-kvartal_',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✍️ Qayta yozish', 'type_address')],
          [Markup.button.callback('📍 Joylashuvni yuborish', 'send_location')],
          [Markup.button.callback('❌ Bekor qilish', 'cancel_order')],
        ]),
      }
    );
  }

  const cart = getCart(ctx.from.id);
  const orderCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const result = await checkDelivery(geo.lat, geo.lng, orderCount);

  if (!result.success) {
    return ctx.reply(result.message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✍️ Boshqa manzil yozish', 'type_address')],
        [Markup.button.callback('📍 Joylashuvni yuborish', 'send_location')],
        [Markup.button.callback('❌ Bekor qilish', 'cancel_order')],
      ]),
    });
  }

  setSession(ctx.from.id, {
    step: 'waiting_payment',
    orderLat: geo.lat,
    orderLng: geo.lng,
    orderAddress: result.address || address,
    orderCity: result.city || address,
    deliveryFee: result.deliveryFee,
    deliveryDistance: result.distance,
    deliveryBreakdown: result.breakdown,
  });

  await showDeliveryInfo(ctx, result, cart);
}

// ─── Yetkazib berish ma'lumotlarini ko'rsatish ────────────────────────────────
async function showDeliveryInfo(ctx, result, cart) {
  const total = getCartTotal(ctx.from.id);
  const grandTotal = total + result.deliveryFee;

  const text =
    `✅ *Manzil tasdiqlandi!*\n\n` +
    `📍 ${result.city || result.address}\n` +
    `📏 Masofa: ${result.distance} km\n` +
    `🚚 Yetkazib berish: *${fmtNum(result.deliveryFee)} so'm*\n` +
    `   (${result.breakdown})\n` +
    (result.discount ? `🎁 Chegirma: ${result.discount}\n` : '') +
    `━━━━━━━━━━━━━━━\n` +
    `🛒 Mahsulotlar: ${fmtNum(total)} so'm\n` +
    `🚚 Yetkazib berish: ${fmtNum(result.deliveryFee)} so'm\n` +
    `💰 *JAMI: ${fmtNum(grandTotal)} so'm*\n\n` +
    `To'lov turini tanlang:`;

  await ctx.reply(text, { parse_mode: 'Markdown', ...paymentChoice() });
}

// ─── STEP 3: To'lov turini tanlash ───────────────────────────────────────────
async function handlePaymentChoice(ctx, payType) {
  await ctx.answerCbQuery();
  const s = getSession(ctx.from.id);

  if (!s.orderAddress) {
    return ctx.reply('❌ Buyurtma muddati o\'tdi. Qayta boshlang.', mainMenu());
  }

  setSession(ctx.from.id, { paymentType: payType });

  const cart = getCart(ctx.from.id);
  const total = getCartTotal(ctx.from.id);
  const grandTotal = total + (s.deliveryFee || 0);

  if (payType === 'card') {
    const text =
      `💳 *Karta orqali to'lov*\n\n` +
      `Karta raqami: \`${CARD_NUMBER}\`\n` +
      `Karta egasi: ${CARD_OWNER}\n\n` +
      `💰 To'lov summasi: *${fmtNum(grandTotal)} so'm*\n\n` +
      `✅ To'lovni amalga oshirib, *chek rasmini* (screenshot) shu yerga yuboring.`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'cancel_order')]]),
    });
    setSession(ctx.from.id, { step: 'waiting_payment_photo', paymentType: 'card' });
  } else {
    setSession(ctx.from.id, { step: 'confirm_order', paymentType: 'cash' });
    await showOrderSummary(ctx, s, cart, total, grandTotal, 'cash');
  }
}

// ─── STEP 3a: To'lov chekini qabul qilish ────────────────────────────────────
async function handlePaymentPhoto(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'waiting_payment_photo') return;

  const photo = ctx.message.photo;
  const doc = ctx.message.document;

  if (!photo && !doc) {
    return ctx.reply('❌ Iltimos, chek rasmini (foto) yuboring.');
  }

  const fileId = photo ? photo[photo.length - 1].file_id : doc.file_id;
  setSession(ctx.from.id, { step: 'confirm_order', paymentPhotoId: fileId });

  const cart = getCart(ctx.from.id);
  const total = getCartTotal(ctx.from.id);
  const grandTotal = total + (s.deliveryFee || 0);

  await ctx.reply('✅ Chek qabul qilindi!', { reply_markup: { remove_keyboard: true } });
  await showOrderSummary(ctx, s, cart, total, grandTotal, 'card');
}

// ─── Buyurtma xulosasini ko'rsatish ──────────────────────────────────────────
async function showOrderSummary(ctx, s, cart, total, grandTotal, payType) {
  const cartText = cart.map((i, idx) =>
    `${idx + 1}. ${i.name} × ${i.qty} = ${fmtNum(i.qty * i.price)} so'm`
  ).join('\n');

  const text =
    `📋 *Buyurtma xulosasi*\n\n` +
    `🛒 *Mahsulotlar:*\n${cartText}\n\n` +
    `📍 Manzil: ${s.orderCity || s.orderAddress}\n` +
    `📏 Masofa: ${s.deliveryDistance || 0} km\n` +
    `🚚 Yetkazib berish: ${fmtNum(s.deliveryFee || 0)} so'm\n` +
    `💳 To'lov: ${payType === 'cash' ? '💵 Naqd' : '💳 Karta'}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💰 *JAMI: ${fmtNum(grandTotal)} so'm*\n\n` +
    `Tasdiqlaysizmi?`;

  await ctx.reply(text, { parse_mode: 'Markdown', ...confirmOrder() });
}

// ─── STEP 4: Buyurtmani tasdiqlash ───────────────────────────────────────────
async function handleOrderConfirm(ctx) {
  await ctx.answerCbQuery('✅ Buyurtma joylashtirilmoqda...');
  const s = getSession(ctx.from.id);
  const cart = getCart(ctx.from.id);

  if (!cart.length || !s.orderAddress) {
    return ctx.editMessageText('❌ Xatolik. Qayta buyurtma bering.');
  }

  const tgId = String(ctx.from.id);
  const users = await queryDocs('telegramUsers', 'telegramId', '==', tgId);
  const user = users[0] || {};

  const total = getCartTotal(ctx.from.id);
  const deliveryFee = s.deliveryFee || 0;

  // Promo-kod chegirmasini qo'llash (agar mavjud bo'lsa)
  const { calcPromoDiscount } = require('../utils/helpers');
  const promo = s.activePromo || null;
  const promoDiscount = promo ? calcPromoDiscount(promo, total) : 0;

  // Sodiqlik ballarini sarflash (agar foydalanuvchi tanlagan bo'lsa)
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
    source: 'telegram',
  };

  const orderId = await addDoc('orders', orderData);
  await addLog('order', `Yangi buyurtma: ${orderNum} — ${user.firstName || tgId}`, { orderId, total: grandTotal });

  // Foydalanuvchi statistikasini yangilash
  if (user.id) {
    await updateDoc('telegramUsers', user.id, {
      orderCount: (user.orderCount || 0) + 1,
      totalSpent: (user.totalSpent || 0) + grandTotal,
      lastOrderAt: require('../services/firebase').admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
  }

  // Mahsulot miqdorlarini yangilash
  for (const item of cart) {
    try {
      const all = await require('../services/firebase').getCollection('products');
      const prod = all.find(p => p.id === item.productId);
      if (prod) {
        await updateDoc('products', item.productId, {
          quantity: Math.max(0, (prod.quantity || 0) - item.qty),
        });
      }
    } catch { }
  }

  clearCart(ctx.from.id);
  setSession(ctx.from.id, { step: null, currentOrderId: orderId, activePromo: null, redeemPoints: 0 });

  // Sodiqlik ballarini sarflash va yangi ball qo'shish
  try {
    const { redeemLoyaltyPoints, awardLoyaltyPoints, markPromoUsed } = require('./loyalty');
    if (pointsToRedeem > 0) await redeemLoyaltyPoints(tgId, pointsToRedeem);
    await awardLoyaltyPoints(tgId, grandTotal);
    if (promo?.id) await markPromoUsed(promo.id, tgId);
  } catch (e) {
    console.error('Loyalty award error:', e.message);
  }

  // Foydalanuvchiga tasdiqlash xabari
  const earnedPoints = require('../utils/helpers').calcEarnedPoints(grandTotal);
  const userText =
    `🎉 *Buyurtma qabul qilindi!*\n\n` +
    `📋 Buyurtma №: *${orderNum}*\n` +
    (promoDiscount > 0 ? `🎟️ Promo chegirma: -${fmtNum(promoDiscount)} so'm\n` : '') +
    (pointsDiscount > 0 ? `💰 Ball chegirmasi: -${fmtNum(pointsDiscount)} so'm (${pointsToRedeem} ball)\n` : '') +
    `💰 Jami: *${fmtNum(grandTotal)} so'm*\n` +
    `🚚 Yetkazib berish: ${fmtNum(deliveryFee)} so'm\n` +
    `📍 Manzil: ${s.orderCity || s.orderAddress}\n\n` +
    `🎁 Siz *+${fmtNum(earnedPoints)} bonus ball* olasiz!\n\n` +
    (s.paymentType === 'card'
      ? '⏳ _To\'lovingiz tekshirilmoqda. Tez orada xabar beramiz._\n\n'
      : '💵 _To\'lovni yetkazuvchiga naqd to\'laysiz._\n\n') +
    `📞 Muammo bo'lsa bog'laning.\n\n` +
    `_Buyurtma holati o'zgarganda xabardor qilinasiz!_ 📲`;

  await ctx.editMessageText(userText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('📋 Buyurtmalarim', 'my_orders')]]),
  });

  // Adminlarga xabar yuborish
  await notifyAdmins(ctx, orderData, orderId, s);
}

// ─── Adminlarga xabar yuborish ────────────────────────────────────────────────
async function notifyAdmins(ctx, order, orderId, s) {
  const bot = ctx.telegram;

  const adminText =
    `🆕 *YANGI BUYURTMA!*\n\n` +
    `📋 №: *${order.orderNumber}*\n` +
    `👤 Mijoz: ${order.customerName}\n` +
    `📱 Tel: ${order.customerPhone || '-'}\n` +
    `🆔 TG: @${order.customerUsername || '-'} (${order.telegramId})\n\n` +
    `🛒 *Mahsulotlar:*\n` +
    order.items.map(i => `• ${i.name} × ${i.qty} = ${fmtNum(i.qty * i.price)} so'm`).join('\n') +
    `\n\n💰 Mahsulot: ${fmtNum(order.total)} so'm\n` +
    `🚚 Yetkazib berish: ${fmtNum(order.deliveryFee)} so'm\n` +
    `💳 *JAMI: ${fmtNum(order.grandTotal)} so'm*\n\n` +
    `📍 Manzil: ${order.deliveryCity || order.deliveryAddress}\n` +
    `📏 Masofa: ${order.deliveryDistance} km\n` +
    (order.location ? `🗺️ [Xaritada ko'rish](https://maps.google.com/?q=${order.location.lat},${order.location.lng})\n` : '') +
    `💳 To'lov: ${order.paymentType === 'card' ? '💳 Karta (chek kutilmoqda)' : '💵 Naqd'}\n\n` +
    `🕐 ${new Date().toLocaleString('uz-UZ')}`;

  const { orderStatusActions } = require('../utils/keyboards');
  const keyboard = orderStatusActions(orderId, order.status);
  const targets = ADMIN_GROUP ? [ADMIN_GROUP] : ADMIN_IDS;

  for (const adminId of targets) {
    try {
      // 1. Mahsulot rasmlari
      const { getCollection } = require('../services/firebase');
      const allProducts = await getCollection('products');
      const itemsWithImages = order.items.filter(i => {
        const prod = allProducts.find(p => p.id === i.productId);
        return prod && prod.imageUrl;
      });

      if (itemsWithImages.length > 0) {
        const mediaGroup = itemsWithImages.slice(0, 10).map((item, idx) => {
          const prod = allProducts.find(p => p.id === item.productId);
          return {
            type: 'photo',
            media: prod.imageUrl,
            caption: idx === 0
              ? `🖼️ *Buyurtma rasmlari*\n📋 ${order.orderNumber}`
              : `📦 ${item.name} × ${item.qty}`,
            parse_mode: 'Markdown',
          };
        });
        await bot.sendMediaGroup(adminId, mediaGroup).catch(async () => {
          const firstProd = allProducts.find(p => p.id === itemsWithImages[0].productId);
          if (firstProd?.imageUrl) {
            await bot.sendPhoto(adminId, firstProd.imageUrl, {
              caption: `🖼️ Buyurtma: ${order.orderNumber}`,
            }).catch(() => { });
          }
        });
      }

      // 2. Karta to'lov cheki
      if (order.paymentType === 'card' && order.paymentPhotoId) {
        await bot.sendPhoto(adminId, order.paymentPhotoId, {
          caption: `💳 *KARTA TO'LOV CHEKI*\n📋 ${order.orderNumber}\n💰 ${fmtNum(order.grandTotal)} so'm`,
          parse_mode: 'Markdown',
        }).catch(() => { });
      }

      // 3. Lokatsiya (GPS bo'lsa)
      if (order.location) {
        await bot.sendLocation(adminId, order.location.lat, order.location.lng).catch(() => { });
      }

      // 4. Asosiy xabar
      await bot.sendMessage(adminId, adminText, {
        parse_mode: 'Markdown',
        ...keyboard,
        disable_web_page_preview: true,
      });
    } catch (e) {
      console.error('Admin notify error:', e.message);
    }
  }
}

// ─── Buyurtmani bekor qilish ──────────────────────────────────────────────────
async function handleCancelOrder(ctx) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: null });
  clearCart(ctx.from.id);
  const msg = '❌ Buyurtma bekor qilindi. Savatdagi mahsulotlar o\'chirildi.';
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(msg, mainMenu());
    } catch {
      await ctx.reply(msg, mainMenu());
    }
  } else {
    await ctx.reply(msg, mainMenu());
  }
}

// ─── Buyurtmalarim ────────────────────────────────────────────────────────────
async function handleMyOrders(ctx) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const tgId = String(ctx.from.id);
  const orders = await queryDocs('orders', 'telegramId', '==', tgId);
  orders.sort((a, b) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  });

  if (!orders.length) {
    const msg = '📋 Siz hali buyurtma bermagansiz.';
    const kb = Markup.inlineKeyboard([[Markup.button.callback('🛍️ Xarid qilish', 'categories')]]);
    if (ctx.callbackQuery) return ctx.editMessageText(msg, kb);
    return ctx.reply(msg, kb);
  }

  const { myOrdersButtons } = require('../utils/keyboards');
  const text = `📋 *Buyurtmalarim* (${orders.length} ta)\n\nBuyurtmani tanlang:`;

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...myOrdersButtons(orders, 0) });
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...myOrdersButtons(orders, 0) });
}

// ─── Buyurtma tafsilotlari ────────────────────────────────────────────────────
async function handleViewMyOrder(ctx, orderId) {
  await ctx.answerCbQuery();
  const order = await require('../services/firebase').getDoc('orders', orderId);
  if (!order) return ctx.editMessageText('❌ Buyurtma topilmadi.');

  const text =
    `📋 *Buyurtma: ${order.orderNumber}*\n\n` +
    `📊 Holat: ${orderStatusLabel(order.status)}\n` +
    `💰 Jami: *${fmtNum(order.grandTotal)} so'm*\n` +
    `🚚 Yetkazib berish: ${fmtNum(order.deliveryFee)} so'm\n` +
    `📍 Manzil: ${order.deliveryCity || order.deliveryAddress}\n` +
    `💳 To'lov: ${order.paymentType === 'cash' ? '💵 Naqd' : '💳 Karta'}\n\n` +
    `🛒 *Mahsulotlar:*\n` +
    (order.items || []).map(i => `• ${i.name} × ${i.qty} = ${fmtNum(i.qty * i.price)} so'm`).join('\n') +
    `\n\n🕐 Sana: ${fmtDate(order.createdAt)}`;

  const btns = [];
  if (order.location) {
    btns.push([Markup.button.url('🗺️ Xaritada', `https://maps.google.com/?q=${order.location.lat},${order.location.lng}`)]);
  }
  btns.push([Markup.button.callback('🔙 Orqaga', 'my_orders')]);

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(btns),
  });
}

module.exports = {
  handleOrderStart,
  handleLocationMessage,
  handleTextAddress,
  handlePaymentChoice,
  handlePaymentPhoto,
  handleOrderConfirm,
  handleCancelOrder,
  handleMyOrders,
  handleViewMyOrder,
};
