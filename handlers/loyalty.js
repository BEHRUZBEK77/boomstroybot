// ════════════════════════════════════════════════════════════════════════════
// LOYALTY / BONUS / REFERAL / FAVORITES / REVIEWS / SUPPORT — Mijozlar uchun
// ════════════════════════════════════════════════════════════════════════════
const {
  getCollection, getDoc, addDoc, updateDoc, queryDocs, setDocById,
  incrementField, arrayUnionField, arrayRemoveField, addLog, admin,
} = require('../services/firebase');
const { getSession, setSession, getCart } = require('../services/session');
const {
  fmtNum, fmtDate, calcEarnedPoints, getLoyaltyTier, generateReferralCode,
  generatePromoCode, isPromoValid, calcPromoDiscount, starsBar, truncate,
  REFERRAL_BONUS_POINTS, REFERRAL_WELCOME_POINTS, LOYALTY_POINT_VALUE,
} = require('../utils/helpers');
const {
  loyaltyMenu, favoritesNavButtons, ratingStarsKeyboard, languageButtons,
  mainMenu, yesNoKeyboard, sortFilterButtons, quantityPickerKeyboard,
  supportTicketKeyboard,
} = require('../utils/keyboards');
const { Markup } = require('telegraf');

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);

// ─── 1. FOYDALANUVCHI YORDAMCHISI ────────────────────────────────────────────
async function getTgUser(telegramId) {
  const users = await queryDocs('telegramUsers', 'telegramId', '==', String(telegramId));
  return users[0] || null;
}

// ─── 2. SODIQLIK / BONUS BALL TIZIMI ─────────────────────────────────────────

// 2.1 Asosiy sodiqlik menyusi
async function handleLoyaltyMenu(ctx) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return ctx.reply('Avval /start bosing.');

  const tier = getLoyaltyTier(user.totalSpent || 0);
  const text =
    `🎁 *Bonus va Sodiqlik Tizimi*\n\n` +
    `${tier.icon} Darajangiz: *${tier.name}*\n` +
    `💰 Ballaringiz: *${fmtNum(user.loyaltyPoints || 0)}* ball\n` +
    `🛍️ Jami xarid: *${fmtNum(user.totalSpent || 0)} so'm*\n` +
    (tier.next ? `\n📈 Keyingi daraja: ${tier.next}\n📊 Kerak: ${fmtNum(Math.max(0, tier.nextAt - (user.totalSpent || 0)))} so'm qoldi` : `\n🏆 Siz eng yuqori darajadasiz!`) +
    `\n\nQuyidagilardan birini tanlang:`;

  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...loyaltyMenu() }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...loyaltyMenu() });
}

// 2.2 Ball balansi ko'rsatish
async function handleLoyaltyBalance(ctx) {
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return;
  const points = user.loyaltyPoints || 0;
  const text =
    `💰 *Ballaringiz: ${fmtNum(points)}*\n\n` +
    `📐 1 ball = ${LOYALTY_POINT_VALUE} so'm chegirma\n` +
    `💵 Pulga teng qiymat: ${fmtNum(points * LOYALTY_POINT_VALUE)} so'm\n\n` +
    `🛒 Keyingi xaridda to'lov vaqtida ballarni ishlatishingiz mumkin.`;
  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'loyalty_menu')]]) });
}

// 2.3 Buyurtma tugagandan keyin ball qo'shish
async function awardLoyaltyPoints(telegramId, orderTotal) {
  const user = await getTgUser(telegramId);
  if (!user) return 0;
  const earned = calcEarnedPoints(orderTotal);
  if (earned > 0) {
    await updateDoc('telegramUsers', user.id, {
      loyaltyPoints: admin.firestore.FieldValue.increment(earned),
    });
    await addLog('loyalty', `Ball qo'shildi: ${user.firstName} +${earned}`, { telegramId, earned });
  }
  return earned;
}

// 2.4 Ballarni sarflash (checkoutda)
async function redeemLoyaltyPoints(telegramId, pointsToUse) {
  const user = await getTgUser(telegramId);
  if (!user) return { success: false, message: 'Foydalanuvchi topilmadi' };
  const available = user.loyaltyPoints || 0;
  if (pointsToUse > available) return { success: false, message: 'Ballar yetarli emas' };
  await updateDoc('telegramUsers', user.id, {
    loyaltyPoints: admin.firestore.FieldValue.increment(-pointsToUse),
  });
  return { success: true, discount: pointsToUse * LOYALTY_POINT_VALUE };
}

// 2.5 Kunlik bonus (har kuni bir marta bosish mumkin)
async function handleDailyBonus(ctx) {
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10);
  if (user.lastDailyBonus === today) {
    return ctx.editMessageText(
      '✅ Siz bugun allaqachon bonus olgansiz!\n\n⏰ Ertaga qayta urinib ko\'ring.',
      { ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'loyalty_menu')]]) }
    );
  }

  const streak = (user.dailyStreak || 0) + 1;
  const bonusAmount = Math.min(500 + streak * 100, 5000);

  await updateDoc('telegramUsers', user.id, {
    loyaltyPoints: admin.firestore.FieldValue.increment(bonusAmount),
    lastDailyBonus: today,
    dailyStreak: streak,
  });
  await addLog('loyalty', `Kunlik bonus: ${user.firstName} +${bonusAmount}`, { streak });

  await ctx.editMessageText(
    `🎉 *Kunlik bonus olindi!*\n\n` +
    `💰 +${fmtNum(bonusAmount)} ball\n` +
    `🔥 Ketma-ket: ${streak} kun\n\n` +
    `Ertaga ham qaytib keling!`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'loyalty_menu')]]) }
  );
}

// 2.6 Darajalar haqida ma'lumot
async function handleLoyaltyTiers(ctx) {
  await ctx.answerCbQuery();
  const text =
    `🏆 *Sodiqlik Darajalari*\n\n` +
    `🆕 *Yangi* — 0 so'm dan\n   Chegirma: 0%\n\n` +
    `🥉 *Bronza* — 1,000,000 so'm dan\n   Chegirma: 1%\n\n` +
    `🥈 *Kumush* — 5,000,000 so'm dan\n   Chegirma: 3%\n\n` +
    `🥇 *Oltin* — 20,000,000 so'm dan\n   Chegirma: 5%\n\n` +
    `💎 *Olmos* — 50,000,000 so'm dan\n   Chegirma: 7%\n\n` +
    `_Daraja avtomatik jami xaridingiz asosida hisoblanadi._`;
  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'loyalty_menu')]]) });
}

// ─── 3. REFERAL TIZIMI ───────────────────────────────────────────────────────

// 3.1 Referal kodi yaratish/olish
async function getOrCreateReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  const code = generateReferralCode(user.telegramId);
  await updateDoc('telegramUsers', user.id, { referralCode: code });
  return code;
}

// 3.2 Referal ma'lumot va ulashish
async function handleReferralInfo(ctx) {
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return;

  const code = await getOrCreateReferralCode(user);
  const botUsername = (process.env.BOT_USERNAME || 'BoomStroyBot').replace('@', '');
  const link = `https://t.me/${botUsername}?start=ref_${code}`;
  const referredCount = user.referredCount || 0;

  const text =
    `👥 *Do'stlarni Taklif Qilish*\n\n` +
    `Har bir taklif qilingan do'stingiz uchun siz *${fmtNum(REFERRAL_BONUS_POINTS)} ball* olasiz!\n` +
    `Do'stingiz esa *${fmtNum(REFERRAL_WELCOME_POINTS)} ball* bonus bilan boshlaydi.\n\n` +
    `🔗 Sizning havolangiz:\n\`${link}\`\n\n` +
    `📊 Siz taklif qilgan do'stlar: *${referredCount}* ta\n` +
    `💰 Jami olingan referal bonus: *${fmtNum(user.referralEarnings || 0)}* ball`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.url('📤 Do\'stga yuborish', `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('BoomStroy — qurilish materiallari! Mendan bonus oling:')}`)],
      [Markup.button.callback('🔙 Orqaga', 'loyalty_menu')],
    ]),
  });
}

// 3.3 Referal orqali kelganini ro'yxatdan o'tkazish (start.js dan chaqiriladi)
async function processReferral(newUser, referralCode) {
  if (!referralCode || !newUser?.id) return null;
  const referrers = await queryDocs('telegramUsers', 'referralCode', '==', referralCode);
  const referrer = referrers[0];
  if (!referrer || referrer.telegramId === newUser.telegramId) return null;
  if (newUser.referredBy) return null; // allaqachon referal orqali kelgan

  await updateDoc('telegramUsers', newUser.id, {
    referredBy: referrer.telegramId,
    loyaltyPoints: admin.firestore.FieldValue.increment(REFERRAL_WELCOME_POINTS),
  });
  await updateDoc('telegramUsers', referrer.id, {
    loyaltyPoints: admin.firestore.FieldValue.increment(REFERRAL_BONUS_POINTS),
    referredCount: admin.firestore.FieldValue.increment(1),
    referralEarnings: admin.firestore.FieldValue.increment(REFERRAL_BONUS_POINTS),
  });
  await addLog('referral', `Referal: ${referrer.firstName} → ${newUser.firstName}`);
  return referrer;
}

// ─── 4. PROMO-KODLAR / KUPONLAR ──────────────────────────────────────────────

// 4.1 Promo-kod kiritishni so'rash
async function handlePromoEnterStart(ctx) {
  await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'entering_promo' });
  await ctx.editMessageText(
    '🎟️ *Promo-kodni kiriting:*\n\n_Masalan: PROMO-AB12CD_',
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'loyalty_menu')]]) }
  );
}

// 4.2 Promo-kodni tekshirish va qo'llash (matn xabar orqali)
async function handlePromoCodeText(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'entering_promo') return;
  const code = ctx.message.text.trim().toUpperCase();
  setSession(ctx.from.id, { step: null });

  const promos = await queryDocs('promoCodes', 'code', '==', code);
  const promo = promos[0];

  if (!promo || !isPromoValid(promo)) {
    return ctx.reply('❌ Promo-kod topilmadi yoki muddati o\'tgan.', mainMenu());
  }

  const usedBy = promo.usedByUsers || [];
  if (usedBy.includes(String(ctx.from.id))) {
    return ctx.reply('⚠️ Siz bu promo-koddan allaqachon foydalangansiz.', mainMenu());
  }

  setSession(ctx.from.id, { activePromo: promo });
  await ctx.reply(
    `✅ *Promo-kod qabul qilindi!*\n\n` +
    `🎟️ ${promo.code}\n` +
    `🎁 Chegirma: ${promo.type === 'percent' ? promo.value + '%' : fmtNum(promo.value) + ' so\'m'}\n\n` +
    `Bu chegirma keyingi buyurtmangizga avtomatik qo'llanadi!`,
    { parse_mode: 'Markdown', ...mainMenu() }
  );
}

// 4.3 Promo-kod ishlatilganini belgilash (buyurtma yakunlanganda)
async function markPromoUsed(promoId, telegramId) {
  if (!promoId) return;
  await updateDoc('promoCodes', promoId, {
    usedByUsers: admin.firestore.FieldValue.arrayUnion(String(telegramId)),
    usedCount: admin.firestore.FieldValue.increment(1),
  });
}

// 4.4 Admin tomonidan promo-kod yaratish (botdan, oddiy buyruq)
async function createPromoCode(type, value, maxUses, expiresInDays) {
  const code = generatePromoCode();
  const data = {
    code, type, value,
    maxUses: maxUses || null,
    usedCount: 0,
    usedByUsers: [],
    active: true,
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null,
  };
  const id = await addDoc('promoCodes', data);
  return { id, ...data };
}

// ─── 5. SEVIMLILAR (FAVORITES) ───────────────────────────────────────────────

// 5.1 Sevimliga qo'shish/olib tashlash (toggle)
async function handleFavoriteToggle(ctx, productId) {
  const user = await getTgUser(ctx.from.id);
  if (!user) return ctx.answerCbQuery('Avval /start bosing');

  const favorites = user.favorites || [];
  const isFav = favorites.includes(productId);

  if (isFav) {
    await arrayRemoveField('telegramUsers', user.id, 'favorites', productId);
    await ctx.answerCbQuery('💔 Sevimlilardan olib tashlandi');
  } else {
    await arrayUnionField('telegramUsers', user.id, 'favorites', productId);
    await ctx.answerCbQuery('❤️ Sevimlilarga qo\'shildi!');
  }

  // Tugmani yangilash (agar mumkin bo'lsa)
  try {
    const { productActionsV2 } = require('../utils/keyboards');
    const cart = require('../services/session').getCart(ctx.from.id);
    const cartQty = cart.find(i => i.productId === productId)?.qty || 0;
    await ctx.editMessageReplyMarkup(productActionsV2(productId, cartQty, !isFav).reply_markup);
  } catch { }
}

// 5.2 Sevimlilar ro'yxatini ko'rish
async function handleViewFavorites(ctx, page = 0) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user || !(user.favorites || []).length) {
    const msg = '❤️ Sevimlilar ro\'yxati bo\'sh.\n\nMahsulotlarni "❤️" tugmasi orqali qo\'shing!';
    const kb = Markup.inlineKeyboard([[Markup.button.callback('🛍️ Mahsulotlar', 'categories')]]);
    if (ctx.callbackQuery) return ctx.editMessageText(msg, kb);
    return ctx.reply(msg, kb);
  }

  const allProducts = await getCollection('products');
  const favProducts = allProducts.filter(p => (user.favorites || []).includes(p.id));

  const text = `❤️ *Sevimlilar* (${favProducts.length} ta)\n\nTanlang:`;
  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, { parse_mode: 'Markdown', ...favoritesNavButtons(favProducts, page) });
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...favoritesNavButtons(favProducts, page) });
}

// 5.3 Mahsulot sevimli ekanligini tekshirish
async function isProductFavorite(telegramId, productId) {
  const user = await getTgUser(telegramId);
  return (user?.favorites || []).includes(productId);
}

// 5.4 Barcha sevimlilarni savatga qo'shish
async function handleAddAllFavoritesToCart(ctx) {
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user || !(user.favorites || []).length) return ctx.reply('Sevimlilar bo\'sh.');

  const { updateCart } = require('../services/session');
  const allProducts = await getCollection('products');
  let added = 0;
  for (const favId of user.favorites) {
    const p = allProducts.find(x => x.id === favId);
    if (p && (p.quantity || 0) > 0 && p.status !== 'inactive') {
      updateCart(ctx.from.id, p, 1);
      added++;
    }
  }
  await ctx.reply(`✅ ${added} ta mahsulot savatga qo'shildi!`, mainMenu());
}

// ─── 6. MAHSULOT SHARHLARI VA REYTING ────────────────────────────────────────

// 6.1 Sharh yozishni boshlash (yulduz tanlash)
async function handleReviewStart(ctx, productId) {
  await ctx.answerCbQuery();
  await ctx.reply('⭐ Mahsulotga baho bering:', ratingStarsKeyboard(productId));
}

// 6.2 Yulduz tanlangandan keyin izoh so'rash
async function handleReviewStarSelect(ctx, productId, stars) {
  await ctx.answerCbQuery(`${stars} yulduz tanlandi`);
  setSession(ctx.from.id, { step: 'writing_review', reviewProductId: productId, reviewStars: parseInt(stars) });
  await ctx.editMessageText(
    `${'⭐'.repeat(parseInt(stars))}\n\n✍️ Izoh qoldirishni xohlaysizmi? Yozing yoki "o'tkazib yuborish" deb yuboring.`,
    { ...Markup.inlineKeyboard([[Markup.button.callback('⏭️ O\'tkazib yuborish', `review_skip:${productId}:${stars}`)]]) }
  );
}

// 6.3 Sharh matnini saqlash
async function handleReviewTextSave(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'writing_review') return;

  const user = await getTgUser(ctx.from.id);
  await saveReview(s.reviewProductId, ctx.from.id, user, s.reviewStars, ctx.message.text);
  setSession(ctx.from.id, { step: null, reviewProductId: null, reviewStars: null });
  await ctx.reply('✅ Rahmat! Sharhingiz saqlandi.', mainMenu());
}

// 6.4 Sharhni o'tkazib yuborish (faqat yulduz)
async function handleReviewSkip(ctx, productId, stars) {
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  await saveReview(productId, ctx.from.id, user, parseInt(stars), '');
  setSession(ctx.from.id, { step: null });
  await ctx.editMessageText(`${'⭐'.repeat(parseInt(stars))}\n\n✅ Rahmat, bahoyingiz saqlandi!`);
}

// 6.5 Sharhni Firestore'ga yozish va mahsulot reytingini yangilash
async function saveReview(productId, telegramId, user, stars, comment) {
  await addDoc('reviews', {
    productId, telegramId: String(telegramId),
    customerName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Mijoz',
    stars, comment: comment || '',
  });
  await recalcProductRating(productId);
  await addLog('review', `Yangi sharh: ${productId} — ${stars}⭐`);
}

// 6.6 Mahsulotning o'rtacha reytingini qayta hisoblash
async function recalcProductRating(productId) {
  const reviews = await queryDocs('reviews', 'productId', '==', productId);
  if (!reviews.length) return;
  const avg = reviews.reduce((s, r) => s + (r.stars || 0), 0) / reviews.length;
  await updateDoc('products', productId, {
    avgRating: parseFloat(avg.toFixed(1)),
    reviewCount: reviews.length,
  });
}

// 6.7 Mahsulot sharhlarini ko'rsatish
async function handleViewProductReviews(ctx, productId) {
  await ctx.answerCbQuery();
  const reviews = await queryDocs('reviews', 'productId', '==', productId);
  if (!reviews.length) {
    return ctx.reply('💬 Bu mahsulot uchun hali sharhlar yo\'q.');
  }
  reviews.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const text =
    `💬 *Sharhlar* (${reviews.length} ta)\n\n` +
    reviews.slice(0, 8).map(r =>
      `${starsBar(r.stars)} *${r.customerName}*\n${r.comment ? truncate(r.comment, 100) : '_(izohsiz)_'}`
    ).join('\n\n');
  await ctx.reply(text, { parse_mode: 'Markdown' });
}

// ─── 7. OXIRGI KO'RILGAN MAHSULOTLAR ─────────────────────────────────────────

// 7.1 Ko'rilgan mahsulotni ro'yxatga qo'shish (ko'p marotaba chaqiriladi)
async function trackRecentlyViewed(telegramId, productId) {
  try {
    const user = await getTgUser(telegramId);
    if (!user) return;
    let recent = user.recentlyViewed || [];
    recent = recent.filter(id => id !== productId);
    recent.unshift(productId);
    recent = recent.slice(0, 20);
    await updateDoc('telegramUsers', user.id, { recentlyViewed: recent });
  } catch { }
}

// 7.2 Oxirgi ko'rilganlarni ko'rsatish
async function handleRecentlyViewed(ctx) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user || !(user.recentlyViewed || []).length) {
    return ctx.reply('🕐 Hali hech narsa ko\'rmagansiz.');
  }
  const allProducts = await getCollection('products');
  const recentProducts = user.recentlyViewed
    .map(id => allProducts.find(p => p.id === id))
    .filter(Boolean);

  const text = `🕐 *Oxirgi ko'rilganlar*\n\nTanlang:`;
  await ctx.reply(text, { parse_mode: 'Markdown', ...favoritesNavButtons(recentProducts, 0) });
}

// ─── 8. NARX KUZATUVI VA OGOHLANTIRISH ───────────────────────────────────────

// 8.1 Mahsulot narxi tushganda xabar olish uchun obuna bo'lish
async function handlePriceAlertSubscribe(ctx, productId) {
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return;
  await arrayUnionField('telegramUsers', user.id, 'priceAlerts', productId);
  await ctx.answerCbQuery('🔔 Narx kamayganda sizga xabar beramiz!', { show_alert: true });
}

// 8.2 Mahsulot qayta zaxiraga kelganda xabar olish uchun obuna
async function handleStockAlertSubscribe(ctx, productId) {
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return;
  await arrayUnionField('telegramUsers', user.id, 'stockAlerts', productId);
  await ctx.answerCbQuery('🔔 Mahsulot kelganda xabar beramiz!', { show_alert: true });
}

// 8.3 Narx tushganda barcha obunachilarga xabar yuborish (admin yangilaganda chaqiriladi)
async function notifyPriceDropSubscribers(bot, productId, oldPrice, newPrice) {
  if (newPrice >= oldPrice) return;
  const users = await queryDocs('telegramUsers', 'priceAlerts', 'array-contains', productId);
  const product = await getDoc('products', productId);
  if (!product) return;
  const text =
    `🔥 *Narx tushdi!*\n\n📦 ${product.name}\n` +
    `~~${fmtNum(oldPrice)} so'm~~ → *${fmtNum(newPrice)} so'm*\n\n` +
    `Tezroq buyurtma bering!`;
  for (const u of users) {
    try {
      await bot.telegram.sendMessage(u.telegramId, text, { parse_mode: 'Markdown' });
      await arrayRemoveField('telegramUsers', u.id, 'priceAlerts', productId);
    } catch { }
  }
}

// 8.4 Zaxira kelganda obunachilarga xabar (admin to'ldirganda chaqiriladi)
async function notifyStockArrivalSubscribers(bot, productId) {
  const users = await queryDocs('telegramUsers', 'stockAlerts', 'array-contains', productId);
  const product = await getDoc('products', productId);
  if (!product || !users.length) return;
  const text = `✅ *Mahsulot qayta zaxiraga keldi!*\n\n📦 ${product.name}\n💰 ${fmtNum(product.price)} so'm`;
  for (const u of users) {
    try {
      await bot.telegram.sendMessage(u.telegramId, text, { parse_mode: 'Markdown' });
      await arrayRemoveField('telegramUsers', u.id, 'stockAlerts', productId);
    } catch { }
  }
}

// ─── 9. SUPPORT / MUROJAAT TIZIMI ────────────────────────────────────────────

// 9.1 Yangi murojaat boshlash
async function handleSupportNewTicket(ctx) {
  await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'support_writing' });
  await ctx.reply('✍️ Murojaatingizni yozing (savol, shikoyat, taklif):', {
    ...Markup.keyboard([['❌ Bekor qilish']]).resize().oneTime(),
  });
}

// 9.2 Murojaat matnini saqlash va adminlarga yuborish
async function handleSupportTicketSave(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'support_writing') return;
  setSession(ctx.from.id, { step: null });

  const user = await getTgUser(ctx.from.id);
  const ticketId = await addDoc('supportTickets', {
    telegramId: String(ctx.from.id),
    customerName: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
    message: ctx.message.text,
    status: 'open',
  });

  await ctx.reply('✅ Murojaatingiz qabul qilindi! Tez orada javob beramiz.', mainMenu());

  for (const adminId of ADMIN_IDS) {
    try {
      await ctx.telegram.sendMessage(adminId,
        `🆘 *Yangi murojaat!*\n\n👤 ${ctx.from.first_name} (${ctx.from.id})\n\n📝 ${ctx.message.text}`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('✍️ Javob berish', `support_reply:${ticketId}:${ctx.from.id}`)]]) }
      );
    } catch { }
  }
}

// 9.3 Mijozning o'z murojaatlarini ko'rish
async function handleMySupportTickets(ctx) {
  await ctx.answerCbQuery();
  const tickets = await queryDocs('supportTickets', 'telegramId', '==', String(ctx.from.id));
  if (!tickets.length) return ctx.reply('📋 Sizda murojaatlar yo\'q.');
  tickets.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const text = tickets.slice(0, 10).map((t, i) =>
    `${i + 1}. ${t.status === 'open' ? '🟡' : '✅'} ${truncate(t.message, 50)}\n   ${t.reply ? '💬 Javob: ' + truncate(t.reply, 60) : '⏳ Javob kutilmoqda'}`
  ).join('\n\n');
  await ctx.reply(`📋 *Murojaatlaringiz:*\n\n${text}`, { parse_mode: 'Markdown' });
}

// 9.4 Admin javob berishni boshlashi
async function handleSupportReplyStart(ctx, ticketId, customerTgId) {
  if (!ADMIN_IDS.includes(String(ctx.from.id))) return ctx.answerCbQuery('Ruxsat yo\'q');
  await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'support_admin_reply', replyTicketId: ticketId, replyCustomerId: customerTgId });
  await ctx.reply('✍️ Javobingizni yozing:');
}

// 9.5 Admin javobini mijozga yetkazish
async function handleSupportReplySave(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'support_admin_reply') return;
  setSession(ctx.from.id, { step: null });

  await updateDoc('supportTickets', s.replyTicketId, { status: 'closed', reply: ctx.message.text });
  try {
    await ctx.telegram.sendMessage(s.replyCustomerId,
      `💬 *Sizning murojaatingizga javob:*\n\n${ctx.message.text}`,
      { parse_mode: 'Markdown' }
    );
  } catch { }
  await ctx.reply('✅ Javob yuborildi.');
}

// ─── 10. TIL TANLASH (ko'p tillilik asoslari) ────────────────────────────────

async function handleLanguageMenu(ctx) {
  await ctx.reply('🌐 Tilni tanlang / Choose language / Выберите язык:', languageButtons());
}

async function handleLanguageSelect(ctx, lang) {
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (user) await updateDoc('telegramUsers', user.id, { lang });
  const labels = { uz: '🇺🇿 O\'zbekcha tanlandi', ru: '🇷🇺 Выбран русский', en: '🇬🇧 English selected' };
  await ctx.editMessageText(labels[lang] || 'OK');
}

// ─── 11. SAVATGA MIQDOR TANLAGICH ────────────────────────────────────────────

async function handleQtyPickerInc(ctx, productId) {
  await ctx.answerCbQuery();
  const s = getSession(ctx.from.id);
  const tempQty = (s.tempQty && s.tempQty[productId]) || 1;
  setSession(ctx.from.id, { tempQty: { ...(s.tempQty || {}), [productId]: tempQty + 1 } });
  try {
    await ctx.editMessageReplyMarkup(quantityPickerKeyboard(productId, tempQty + 1).reply_markup);
  } catch { }
}

async function handleQtyPickerDec(ctx, productId) {
  await ctx.answerCbQuery();
  const s = getSession(ctx.from.id);
  const tempQty = Math.max(1, ((s.tempQty && s.tempQty[productId]) || 1) - 1);
  setSession(ctx.from.id, { tempQty: { ...(s.tempQty || {}), [productId]: tempQty } });
  try {
    await ctx.editMessageReplyMarkup(quantityPickerKeyboard(productId, tempQty).reply_markup);
  } catch { }
}

async function handleQtyPickerConfirm(ctx, productId) {
  const s = getSession(ctx.from.id);
  const qty = (s.tempQty && s.tempQty[productId]) || 1;
  const allProducts = await getCollection('products');
  const p = allProducts.find(x => x.id === productId);
  if (!p) return ctx.answerCbQuery('Topilmadi');
  const { updateCart } = require('../services/session');
  updateCart(ctx.from.id, p, qty);
  await ctx.answerCbQuery(`✅ ${qty} ta savatga qo'shildi`);
}

// ─── 12. BUYURTMADAN KEYIN BAHOLASH ──────────────────────────────────────────

async function handleOrderRatingRequest(bot, telegramId, orderId, orderNumber) {
  try {
    await bot.telegram.sendMessage(telegramId,
      `⭐ Buyurtmangiz (${orderNumber}) yetkazildi!\n\nXizmatimizni qanday baholaysiz?`,
      require('../utils/keyboards').orderRatingKeyboard(orderId)
    );
  } catch { }
}

async function handleOrderRatingSave(ctx, orderId, stars) {
  await ctx.answerCbQuery('Rahmat!');
  await updateDoc('orders', orderId, { customerRating: parseInt(stars) });
  await ctx.editMessageText(`${'⭐'.repeat(parseInt(stars))}\n\nFikringiz uchun rahmat! 🙏`);
}

// ─── 13. STATIK MA'LUMOT / FAQ ───────────────────────────────────────────────

async function handleFAQ(ctx) {
  const text =
    `❓ *Tez-tez so'raladigan savollar*\n\n` +
    `*1. Qanday buyurtma berish mumkin?*\n` +
    `Mahsulotlar bo'limidan tanlang, savatga qo'shing va buyurtma bering.\n\n` +
    `*2. To'lov qanday amalga oshiriladi?*\n` +
    `Naqd (yetkazganda) yoki karta orqali oldindan.\n\n` +
    `*3. Yetkazib berish qancha vaqt oladi?*\n` +
    `Masofaga qarab 1-8 soat ichida.\n\n` +
    `*4. Mahsulotni qaytarish mumkinmi?*\n` +
    `Ha, 24 soat ichida @boomstroy_support ga yozing.\n\n` +
    `*5. Bonus ballarni qanday ishlatish mumkin?*\n` +
    `🎁 Bonus va Sodiqlik bo'limida ko'rishingiz mumkin.`;
  await ctx.reply(text, { parse_mode: 'Markdown', ...mainMenu() });
}

module.exports = {
  getTgUser,
  handleLoyaltyMenu, handleLoyaltyBalance, awardLoyaltyPoints, redeemLoyaltyPoints,
  handleDailyBonus, handleLoyaltyTiers,
  getOrCreateReferralCode, handleReferralInfo, processReferral,
  handlePromoEnterStart, handlePromoCodeText, markPromoUsed, createPromoCode,
  handleFavoriteToggle, handleViewFavorites, isProductFavorite, handleAddAllFavoritesToCart,
  handleReviewStart, handleReviewStarSelect, handleReviewTextSave, handleReviewSkip,
  saveReview, recalcProductRating, handleViewProductReviews,
  trackRecentlyViewed, handleRecentlyViewed,
  handlePriceAlertSubscribe, handleStockAlertSubscribe,
  notifyPriceDropSubscribers, notifyStockArrivalSubscribers,
  handleSupportNewTicket, handleSupportTicketSave, handleMySupportTickets,
  handleSupportReplyStart, handleSupportReplySave,
  handleLanguageMenu, handleLanguageSelect,
  handleQtyPickerInc, handleQtyPickerDec, handleQtyPickerConfirm,
  handleOrderRatingRequest, handleOrderRatingSave,
  handleFAQ,
};
