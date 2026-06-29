const { getCollection, queryDocs, getDoc, updateDoc, addDoc, addLog } = require('../services/firebase');
const { getSession, setSession } = require('../services/session');
const { fmtNum, fmtDate, orderStatusLabel, getStockStatus } = require('../utils/helpers');
const { adminMainMenu, mainMenu, orderStatusActions, adminOrdersList } = require('../utils/keyboards');
const { Markup } = require('telegraf');

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);

function isAdmin(ctx) {
  return ADMIN_IDS.includes(String(ctx.from.id));
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
async function handleAdminDashboard(ctx) {
  if (!isAdmin(ctx)) return;
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const [products, categories, customers, orders, sales, stockIns] = await Promise.all([
    getCollection('products'),
    getCollection('categories'),
    queryDocs('orders', 'status', '!=', '___').catch(() => getCollection('orders')),
    getCollection('orders'),
    getCollection('sales'),
    getCollection('stockIns'),
  ]);

  const lowStock = products.filter(p => getStockStatus(p).val !== 'ok');
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'paid_pending');
  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.grandTotal || 0), 0);
  const todayOrders = orders.filter(o => {
    const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d >= today;
  });

  const text =
    `📊 *BOOMSTROY DASHBOARD*\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📦 Mahsulotlar: *${products.length}* ta\n` +
    `🏷️ Kategoriyalar: *${categories.length}* ta\n` +
    `🔴 Kam qolgan: *${lowStock.length}* ta\n\n` +
    `📋 Jami buyurtmalar: *${orders.length}* ta\n` +
    `⏳ Kutilayotgan: *${pendingOrders.length}* ta\n` +
    `📅 Bugun: *${todayOrders.length}* ta\n\n` +
    `💰 Jami daromad: *${fmtNum(totalRevenue)} so'm*\n` +
    `👥 Mijozlar: *${customers.length}* ta\n\n` +
    `🕐 ${new Date().toLocaleString('uz-UZ')}`;

  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('📋 Kutilayotgan buyurtmalar', 'admin_pending_orders')],
    [Markup.button.callback('⚠️ Kam qolgan mahsulotlar', 'admin_low_stock')],
    [Markup.button.callback('📈 Statistika', 'admin_stats')],
    [Markup.button.callback('🔄 Yangilash', 'admin_dashboard')],
  ]);

  const msg = { text, parse_mode: 'Markdown', ...kb };
  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
}

// ─── ORDERS MANAGEMENT ────────────────────────────────────────────────────────
async function handleAdminOrders(ctx, filter = 'all') {
  if (!isAdmin(ctx)) return;
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const allOrders = await getCollection('orders');
  let orders = allOrders;
  if (filter === 'pending') orders = allOrders.filter(o => ['pending', 'paid_pending'].includes(o.status));
  else if (filter === 'active') orders = allOrders.filter(o => !['delivered', 'cancelled'].includes(o.status));

  if (!orders.length) {
    const msg = '📋 Buyurtmalar yo\'q.';
    if (ctx.callbackQuery) return ctx.editMessageText(msg, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_dashboard')]]));
    return ctx.reply(msg, adminMainMenu());
  }

  const filterBtns = Markup.inlineKeyboard([
    [
      Markup.button.callback(filter === 'all' ? '✅ Barchasi' : 'Barchasi', 'admin_orders:all'),
      Markup.button.callback(filter === 'pending' ? '✅ Kutilayotgan' : 'Kutilayotgan', 'admin_orders:pending'),
      Markup.button.callback(filter === 'active' ? '✅ Aktiv' : 'Aktiv', 'admin_orders:active'),
    ],
    ...orders.slice(0, 8).map(o => [
      Markup.button.callback(
        `${o.status === 'paid_pending' ? '💳' : o.status === 'pending' ? '⏳' : '✅'} ${o.orderNumber} | ${o.customerName || '?'} | ${fmtNum(o.grandTotal)}`,
        `admin_order:${o.id}`
      )
    ]),
    [Markup.button.callback('🔙 Dashboard', 'admin_dashboard')],
  ]);

  const text = `📋 *Buyurtmalar* (${orders.length} ta)`;
  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...filterBtns }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...filterBtns });
}

async function handleAdminViewOrder(ctx, orderId) {
  if (!isAdmin(ctx)) return;
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const order = await getDoc('orders', orderId);
  if (!order) return ctx.editMessageText('❌ Buyurtma topilmadi.');

  const { escapeMarkdown } = require('../utils/helpers');
  const text =
    `📋 *${order.orderNumber}*\n\n` +
    `👤 Mijoz: ${escapeMarkdown(order.customerName) || '-'}\n` +
    `📱 Tel: ${order.customerPhone || '-'}\n` +
    `🆔 TG: @${escapeMarkdown(order.customerUsername) || '-'}\n\n` +
    `📊 Holat: ${orderStatusLabel(order.status)}\n` +
    `💳 To'lov: ${order.paymentType === 'cash' ? '💵 Naqd' : '💳 Karta'}\n` +
    `💳 To'lov holati: ${order.paymentStatus || '-'}\n\n` +
    `🛒 *Mahsulotlar:*\n` +
    (order.items || []).map(i => `• ${escapeMarkdown(i.name)} × ${i.qty} = ${fmtNum(i.qty * i.price)} so'm`).join('\n') +
    `\n\n💰 Mahsulot: ${fmtNum(order.total)} so'm\n` +
    `🚚 Yetkazib berish: ${fmtNum(order.deliveryFee)} so'm\n` +
    `💰 *JAMI: ${fmtNum(order.grandTotal)} so'm*\n\n` +
    `📍 Manzil: ${escapeMarkdown(order.deliveryCity || order.deliveryAddress)}\n` +
    `📏 Masofa: ${order.deliveryDistance || 0} km\n` +
    `🕐 ${fmtDate(order.createdAt)}`;

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...orderStatusActions(orderId, order.status),
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...orderStatusActions(orderId, order.status),
    });
  }

  // Send location if exists
  if (order.location?.lat && ctx.callbackQuery) {
    setTimeout(() => {
      ctx.telegram.sendLocation(ctx.from.id, order.location.lat, order.location.lng).catch(() => { });
    }, 500);
  }
}

// ─── ORDER STATUS UPDATES ─────────────────────────────────────────────────────
async function updateOrderStatus(ctx, orderId, newStatus) {
  await ctx.answerCbQuery('Yangilanmoqda...');
  const order = await getDoc('orders', orderId);
  if (!order) return ctx.answerCbQuery('❌ Buyurtma topilmadi');

  await updateDoc('orders', orderId, { status: newStatus });
  await addLog('order', `Buyurtma holati: ${order.orderNumber} → ${newStatus}`);

  // Bekor qilinganda mahsulot sonini qaytarish
  if (newStatus === 'cancelled' && order.items && order.items.length > 0) {
    const { getCollection } = require('../services/firebase');
    const allProducts = await getCollection('products');
    for (const item of order.items) {
      const prod = allProducts.find(p => p.id === item.productId);
      if (prod) {
        await updateDoc('products', item.productId, {
          quantity: (prod.quantity || 0) + item.qty,
        });
      }
    }
    await addLog('order', `Bekor: ${order.orderNumber} — mahsulotlar qaytarildi`);
  }

  // Mijozga uning tilida xabar yuborish
  const { t, normalizeLang } = require('../utils/i18n');
  const isPickup = order.deliveryType === 'pickup';
  let custLang = normalizeLang(order.lang);
  try {
    const cu = await queryDocs('telegramUsers', 'telegramId', '==', String(order.telegramId));
    if (cu[0]?.lang) custLang = normalizeLang(cu[0].lang);
  } catch { }
  const som = t(custLang, 'som');
  const vars = {
    num: order.orderNumber, grand: fmtNum(order.grandTotal), som,
    city: order.deliveryCity || order.deliveryAddress,
    wh: order.pickupWarehouseName || order.deliveryAddress,
  };
  const statusMessages = {
    confirmed: t(custLang, 'notifyConfirmed', vars),
    shipped: isPickup ? t(custLang, 'notifyReadyPickup', vars) : t(custLang, 'notifyShipped', vars),
    delivered: t(custLang, 'notifyDelivered', vars),
    cancelled: t(custLang, 'notifyCancelled', vars),
  };

  const customerMsg = statusMessages[newStatus];
  if (customerMsg && order.telegramId) {
    try {
      await ctx.telegram.sendMessage(order.telegramId, customerMsg, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('Customer notify error:', e.message);
    }
  }
  // Yetkazib berilganda baholash so'rovi
  if (newStatus === 'delivered' && order.telegramId) {
    try {
      const { handleOrderRatingRequest } = require('./loyalty');
      await handleOrderRatingRequest(ctx, order.telegramId, orderId, order.orderNumber);
    } catch { }
  }

  await ctx.editMessageText(
    `✅ Holat yangilandi: *${orderStatusLabel(newStatus)}*\n\n📋 ${order.orderNumber}`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Buyurtmalar', 'admin_orders:all')]]) }
  );
}

async function handlePaymentApprove(ctx, orderId, approved) {
  await ctx.answerCbQuery();
  const order = await getDoc('orders', orderId);
  if (!order) return;

  const { t, normalizeLang } = require('../utils/i18n');
  let custLang = normalizeLang(order.lang);
  try {
    const cu = await queryDocs('telegramUsers', 'telegramId', '==', String(order.telegramId));
    if (cu[0]?.lang) custLang = normalizeLang(cu[0].lang);
  } catch { }
  const vars = { num: order.orderNumber, grand: fmtNum(order.grandTotal), som: t(custLang, 'som') };

  if (approved) {
    await updateDoc('orders', orderId, { status: 'confirmed', paymentStatus: 'paid' });
    await ctx.telegram.sendMessage(order.telegramId, t(custLang, 'notifyPayOk', vars), { parse_mode: 'Markdown' }).catch(() => { });
    await ctx.editMessageText('✅ To\'lov tasdiqlandi. Buyurtma holatiga o\'tkazildi.',
      Markup.inlineKeyboard([[Markup.button.callback('📋 Buyurtmalar', 'admin_orders:all')]]))
  } else {
    await updateDoc('orders', orderId, { status: 'cancelled', paymentStatus: 'rejected' });
    await ctx.telegram.sendMessage(order.telegramId, t(custLang, 'notifyPayFail', vars), { parse_mode: 'Markdown' }).catch(() => { });
    await ctx.editMessageText('❌ To\'lov rad etildi.',
      Markup.inlineKeyboard([[Markup.button.callback('📋 Buyurtmalar', 'admin_orders:all')]]))
  }
}

// ─── PRODUCTS MANAGEMENT ──────────────────────────────────────────────────────
async function handleAdminProducts(ctx) {
  if (!isAdmin(ctx)) return;
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const products = await getCollection('products');
  const lowStock = products.filter(p => getStockStatus(p).val !== 'ok');

  const text =
    `📦 *Mahsulotlar* (${products.length} ta)\n` +
    `🔴 Kam qolgan: ${lowStock.length} ta\n\n` +
    `Boshqarish uchun saytni ishlating:\n` +
    `🌐 ${process.env.WEBHOOK_URL || 'https://yourapp.railway.app'}/admin`;

  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('⚠️ Kam qolganlar', 'admin_low_stock')],
    [Markup.button.callback('📊 Kategoriyalar', 'admin_cat_stats')],
    [Markup.button.callback('🔙 Dashboard', 'admin_dashboard')],
  ]);

  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
}

async function handleAdminLowStock(ctx) {
  if (!isAdmin(ctx)) return;
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const products = await getCollection('products');
  const low = products.filter(p => getStockStatus(p).val !== 'ok');

  if (!low.length) {
    const msg = '✅ Barcha mahsulotlar normal miqdorda!';
    if (ctx.callbackQuery) return ctx.editMessageText(msg, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_products')]]));
    return ctx.reply(msg);
  }

  const { escapeMarkdown } = require('../utils/helpers');
  const text =
    `⚠️ *Kam qolgan mahsulotlar:*\n\n` +
    low.map(p => {
      const st = getStockStatus(p);
      return `${st.emoji} ${escapeMarkdown(p.name)}\n   Qoldi: ${p.quantity || 0} ${p.unit || 'dona'} (min: ${p.minQuantity || 5})`;
    }).join('\n\n');

  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_products')]]) }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown' });
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
async function handleAdminCustomers(ctx) {
  if (!isAdmin(ctx)) return;
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const users = await getCollection('telegramUsers');
  const { escapeMarkdown } = require('../utils/helpers');
  const text =
    `👥 *Telegram Mijozlar* (${users.length} ta)\n\n` +
    users.slice(0, 15).map((u, i) =>
      `${i + 1}. ${escapeMarkdown(u.firstName)} ${escapeMarkdown(u.lastName || '')} | ${u.phone || '-'} | ${u.orderCount || 0} buyurtma`
    ).join('\n') +
    (users.length > 15 ? `\n... va yana ${users.length - 15} ta` : '');

  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_dashboard')]]) }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown' });
}

// ─── STATS ────────────────────────────────────────────────────────────────────
async function handleAdminStats(ctx) {
  if (!isAdmin(ctx)) return;
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const [orders, products, users] = await Promise.all([
    getCollection('orders'),
    getCollection('products'),
    getCollection('telegramUsers'),
  ]);

  const delivered = orders.filter(o => o.status === 'delivered');
  const totalRevenue = delivered.reduce((s, o) => s + (o.grandTotal || 0), 0);
  const totalDelivery = delivered.reduce((s, o) => s + (o.deliveryFee || 0), 0);
  const avgOrder = delivered.length ? totalRevenue / delivered.length : 0;

  const now = new Date();
  const thisMonth = orders.filter(o => {
    const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(0);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const text =
    `📈 *Statistika*\n\n` +
    `📦 Jami mahsulotlar: ${products.length}\n` +
    `👥 Jami mijozlar: ${users.length}\n\n` +
    `📋 Jami buyurtmalar: ${orders.length}\n` +
    `✅ Yetkazilgan: ${delivered.length}\n` +
    `❌ Bekor: ${orders.filter(o => o.status === 'cancelled').length}\n` +
    `📅 Bu oy: ${thisMonth.length}\n\n` +
    `💰 Jami daromad: *${fmtNum(totalRevenue)} so'm*\n` +
    `🚚 Yetkazib berish: ${fmtNum(totalDelivery)} so'm\n` +
    `📊 O'rtacha buyurtma: ${fmtNum(avgOrder)} so'm\n\n` +
    `🕐 ${new Date().toLocaleString('uz-UZ')}`;

  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_dashboard')]]) }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown' });
}

// ─── BROADCAST ────────────────────────────────────────────────────────────────
async function handleAdminBroadcast(ctx) {
  if (!isAdmin(ctx)) return;
  setSession(ctx.from.id, { step: 'admin_broadcast' });
  await ctx.reply(
    '📢 *Barcha foydalanuvchilarga xabar*\n\nXabarni yozing (matn, rasm yoki video):\n\n/cancel - bekor qilish',
    { parse_mode: 'Markdown', ...Markup.keyboard([['❌ Bekor qilish']]).resize().oneTime() }
  );
}

async function handleBroadcastMessage(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'admin_broadcast' || !isAdmin(ctx)) return;

  if (ctx.message.text === '❌ Bekor qilish') {
    setSession(ctx.from.id, { step: null });
    return ctx.reply('Bekor qilindi.', adminMainMenu());
  }

  const users = await getCollection('telegramUsers');
  let success = 0, failed = 0;

  setSession(ctx.from.id, { step: null });
  await ctx.reply(`📤 ${users.length} ta foydalanuvchiga jo'natilmoqda...`);

  for (const user of users) {
    try {
      if (ctx.message.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        await ctx.telegram.sendPhoto(user.telegramId, photo, { caption: ctx.message.caption || '' });
      } else if (ctx.message.text) {
        await ctx.telegram.sendMessage(user.telegramId, ctx.message.text, { parse_mode: 'Markdown' });
      }
      success++;
      await new Promise(r => setTimeout(r, 50));
    } catch {
      failed++;
    }
  }

  await ctx.reply(`✅ Jo'natildi: ${success}\n❌ Xato: ${failed}`, adminMainMenu());
}

// ─── OMBORLAR (borib olish manzillari) ────────────────────────────────────────
async function handleAdminWarehouses(ctx) {
  if (!isAdmin(ctx)) return;
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const { getCollection } = require('../services/firebase');
  const { WAREHOUSE } = require('../services/delivery');
  const warehouses = await getCollection('warehouses');
  const products = await getCollection('products');

  let text = '🏭 *Omborlar (borib olish manzillari)*\n\n';
  text += `🏠 *Asosiy ombor:* ${WAREHOUSE.name}\n`;
  if (WAREHOUSE.address) text += `📌 ${WAREHOUSE.address}\n`;
  text += '\n';

  if (!warehouses.length) {
    text += `_Qo'shimcha omborlar yo'q. "➕ Ombor qo'shish" orqali qo'shing._\n`;
  } else {
    warehouses.forEach((w, i) => {
      const cnt = products.filter(p => (p.warehouse || 'main') === w.id).length;
      text += `${i + 1}. 🏪 *${w.name}*\n`;
      if (w.address) text += `   📌 ${w.address}\n`;
      if (w.phone) text += `   📞 ${w.phone}\n`;
      text += `   📦 ${cnt} ta mahsulot\n`;
    });
  }
  text += `\n_Bu omborlar foydalanuvchilarga "🏪 Borib olish" bo'limida ko'rinadi._`;

  const rows = [[Markup.button.callback("➕ Ombor qo'shish", 'wh_add')]];
  warehouses.forEach(w => rows.push([Markup.button.callback(`🗑️ ${w.name}`, `wh_del:${w.id}`)]));

  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
}

async function handleWarehouseAddStart(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('Ruxsat yo\'q');
  await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'admin_wh_name', newWarehouse: {} });
  await ctx.reply('🏪 Yangi ombor *nomini* yozing:\n\n_Masalan: Chilonzor filiali_', { parse_mode: 'Markdown' });
}

async function handleWarehouseInput(ctx) {
  if (!isAdmin(ctx)) return;
  const s = getSession(ctx.from.id);
  const text = (ctx.message.text || '').trim();
  const skip = text === '-' || text.toLowerCase() === 'skip';

  if (s.step === 'admin_wh_name') {
    setSession(ctx.from.id, { step: 'admin_wh_address', newWarehouse: { ...s.newWarehouse, name: text } });
    return ctx.reply('📌 Ombor *manzilini* yozing (yoki "-" deb tashlab keting):', { parse_mode: 'Markdown' });
  }
  if (s.step === 'admin_wh_address') {
    setSession(ctx.from.id, { step: 'admin_wh_phone', newWarehouse: { ...s.newWarehouse, address: skip ? '' : text } });
    return ctx.reply('📞 Ombor *telefon raqamini* yozing (yoki "-"):', { parse_mode: 'Markdown' });
  }
  if (s.step === 'admin_wh_phone') {
    const { addDoc } = require('../services/firebase');
    const wh = { ...s.newWarehouse, phone: skip ? '' : text, active: true, pickup: true };
    await addDoc('warehouses', wh);
    setSession(ctx.from.id, { step: null, newWarehouse: null });
    await ctx.reply(`✅ Ombor qo'shildi: *${wh.name}*\n\nEndi u "🏪 Borib olish" bo'limida ko'rinadi.`, { parse_mode: 'Markdown', ...adminMainMenu() });
    return handleAdminWarehouses(ctx);
  }
}

async function handleWarehouseDelete(ctx, id) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('Ruxsat yo\'q');
  const { deleteDocById } = require('../services/firebase');
  await deleteDocById('warehouses', id).catch(() => { });
  await ctx.answerCbQuery('🗑️ O\'chirildi');
  return handleAdminWarehouses(ctx);
}

module.exports = {
  isAdmin,
  handleAdminDashboard, handleAdminOrders, handleAdminViewOrder,
  updateOrderStatus, handlePaymentApprove,
  handleAdminProducts, handleAdminLowStock, handleAdminCustomers,
  handleAdminStats, handleAdminBroadcast, handleBroadcastMessage,
  handleAdminWarehouses, handleWarehouseAddStart, handleWarehouseInput, handleWarehouseDelete,
};
