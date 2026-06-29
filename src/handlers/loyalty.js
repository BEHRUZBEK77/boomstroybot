// ════════════════════════════════════════════════════════════════════════════
// LOYALTY / BONUS / REFERAL / FAVORITES / REVIEWS / SUPPORT / REWARDS
// ════════════════════════════════════════════════════════════════════════════
const {
  getCollection, getDoc, addDoc, updateDoc, queryDocs,
  arrayUnionField, arrayRemoveField, addLog, admin,
} = require('../services/firebase');
const { getSession, setSession } = require('../services/session');
const {
  fmtNum, calcEarnedPoints, getLoyaltyTier, generateReferralCode,
  generatePromoCode, isPromoValid, starsBar, truncate,
  REFERRAL_BONUS_POINTS, REFERRAL_WELCOME_POINTS, LOYALTY_POINT_VALUE,
} = require('../utils/helpers');
const {
  loyaltyMenu, favoritesNavButtons, ratingStarsKeyboard, languageButtons,
  mainMenu, quantityPickerKeyboard, rewardsButtons, rewardActions,
} = require('../utils/keyboards');
const { t, langOf, normalizeLang } = require('../utils/i18n');
const { Markup } = require('telegraf');

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);

// ─── 1. FOYDALANUVCHI YORDAMCHISI ────────────────────────────────────────────
async function getTgUser(telegramId) {
  const users = await queryDocs('telegramUsers', 'telegramId', '==', String(telegramId));
  return users[0] || null;
}

function backTo(lang, cb) {
  return Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'back'), cb)]]);
}

// ─── 2. SODIQLIK / BONUS BALL TIZIMI ─────────────────────────────────────────
async function handleLoyaltyMenu(ctx) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return ctx.reply(t(lang, 'pressStart'));

  const tier = getLoyaltyTier(user.totalSpent || 0);
  const points = user.loyaltyPoints || 0;
  const next = tier.nextKey
    ? t(lang, 'tierNext', { next: t(lang, tier.nextKey), amount: fmtNum(Math.max(0, tier.nextAt - (user.totalSpent || 0))), som: t(lang, 'som') })
    : t(lang, 'tierTop');

  const text = t(lang, 'loyaltyMenuTitle', {
    tierIcon: tier.icon, tier: t(lang, tier.key),
    points: fmtNum(points), value: fmtNum(points * LOYALTY_POINT_VALUE),
    spent: fmtNum(user.totalSpent || 0), next, som: t(lang, 'som'),
  });

  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...loyaltyMenu(lang) }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...loyaltyMenu(lang) });
}

async function handleLoyaltyBalance(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return;
  const points = user.loyaltyPoints || 0;
  const text = t(lang, 'pointsBalance', { points: fmtNum(points), value: fmtNum(points * LOYALTY_POINT_VALUE), som: t(lang, 'som') });
  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...backTo(lang, 'loyalty_menu') });
}

async function awardLoyaltyPoints(telegramId, orderTotal) {
  const user = await getTgUser(telegramId);
  if (!user) return 0;
  const earned = calcEarnedPoints(orderTotal);
  if (earned > 0) {
    await updateDoc('telegramUsers', user.id, { loyaltyPoints: admin.firestore.FieldValue.increment(earned) });
    await addLog('loyalty', `Ball qo'shildi: ${user.firstName} +${earned}`, { telegramId, earned });
  }
  return earned;
}

async function redeemLoyaltyPoints(telegramId, pointsToUse) {
  const user = await getTgUser(telegramId);
  if (!user) return { success: false };
  const available = user.loyaltyPoints || 0;
  if (pointsToUse > available) return { success: false };
  await updateDoc('telegramUsers', user.id, { loyaltyPoints: admin.firestore.FieldValue.increment(-pointsToUse) });
  return { success: true, discount: pointsToUse * LOYALTY_POINT_VALUE };
}

async function handleDailyBonus(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10);
  if (user.lastDailyBonus === today) {
    return ctx.editMessageText(t(lang, 'dailyAlready'), backTo(lang, 'loyalty_menu'));
  }

  const streak = (user.dailyStreak || 0) + 1;
  // 100 ball = 1 000 so'm bo'lgani uchun moderatsiya qilingan miqdor (20–100 ball = 200–1 000 so'm)
  const bonusAmount = Math.min(20 + streak * 5, 100);

  await updateDoc('telegramUsers', user.id, {
    loyaltyPoints: admin.firestore.FieldValue.increment(bonusAmount),
    lastDailyBonus: today,
    dailyStreak: streak,
  });
  await addLog('loyalty', `Kunlik bonus: ${user.firstName} +${bonusAmount}`, { streak });

  await ctx.editMessageText(
    t(lang, 'dailyClaimed', { amount: fmtNum(bonusAmount), streak }),
    { parse_mode: 'Markdown', ...backTo(lang, 'loyalty_menu') }
  );
}

async function handleLoyaltyTiers(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  await ctx.editMessageText(t(lang, 'tiersInfo', { som: t(lang, 'som') }), { parse_mode: 'Markdown', ...backTo(lang, 'loyalty_menu') });
}

// ─── 3. SOVG'ALAR DO'KONI (ballarni mahsulotga almashtirish) ─────────────────
async function handleRewardsShop(ctx, page = 0) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return;

  let rewards = [];
  try { rewards = await getCollection('rewards'); } catch { rewards = []; }
  rewards = (rewards || []).filter(r => r.active !== false && (r.stock === undefined || r.stock > 0));
  rewards.sort((a, b) => (a.pointsCost || 0) - (b.pointsCost || 0));

  const points = user.loyaltyPoints || 0;
  if (!rewards.length) {
    const msg = t(lang, 'rewardsEmpty');
    if (ctx.callbackQuery) { try { return ctx.editMessageText(msg, backTo(lang, 'loyalty_menu')); } catch { } }
    return ctx.reply(msg, backTo(lang, 'loyalty_menu'));
  }

  const text = t(lang, 'rewardsTitle', { points: fmtNum(points), som: t(lang, 'som') });
  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...rewardsButtons(rewards, page, lang) }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...rewardsButtons(rewards, page, lang) });
}

async function handleRewardDetail(ctx, rewardId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  const reward = await getDoc('rewards', rewardId);
  if (!reward) return ctx.editMessageText(t(lang, 'notFound'), backTo(lang, 'rewards_shop'));

  const points = user?.loyaltyPoints || 0;
  const cost = reward.pointsCost || 0;
  const stock = reward.stock === undefined ? '∞' : reward.stock;
  const canRedeem = points >= cost && (reward.stock === undefined || reward.stock > 0);
  const status = (reward.stock !== undefined && reward.stock <= 0)
    ? t(lang, 'rewardOutOfStock')
    : (canRedeem ? t(lang, 'rewardEnough') : t(lang, 'rewardNotEnough', { need: fmtNum(cost - points) }));

  const text = t(lang, 'rewardDetail', {
    name: reward.name,
    desc: reward.description ? `${reward.description}\n\n` : '',
    cost: fmtNum(cost), value: fmtNum(cost * LOYALTY_POINT_VALUE),
    stock, points: fmtNum(points), status, som: t(lang, 'som'),
  });

  const kb = rewardActions(rewardId, canRedeem, lang);
  try {
    if (reward.imageUrl) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb });
    } else {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb });
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
  }
}

async function handleRewardRedeem(ctx, rewardId) {
  const lang = langOf(ctx);
  const user = await getTgUser(ctx.from.id);
  const reward = await getDoc('rewards', rewardId);
  if (!user || !reward) return ctx.answerCbQuery(t(lang, 'notFound'));

  const cost = reward.pointsCost || 0;
  const points = user.loyaltyPoints || 0;

  if (reward.stock !== undefined && reward.stock <= 0) {
    return ctx.answerCbQuery(t(lang, 'rewardOutOfStock'), { show_alert: true });
  }
  if (points < cost) {
    return ctx.answerCbQuery(t(lang, 'rewardNotEnough', { need: fmtNum(cost - points) }), { show_alert: true });
  }

  await ctx.answerCbQuery();
  // Ballarni yechish va sovg'a zaxirasini kamaytirish
  await updateDoc('telegramUsers', user.id, { loyaltyPoints: admin.firestore.FieldValue.increment(-cost) });
  if (reward.stock !== undefined) {
    await updateDoc('rewards', rewardId, { stock: Math.max(0, reward.stock - 1) }).catch(() => { });
  }

  const redemptionId = await addDoc('rewardRedemptions', {
    rewardId, rewardName: reward.name, pointsSpent: cost,
    telegramId: String(ctx.from.id),
    customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    customerPhone: user.phone || '',
    status: 'pending',
  });
  await addLog('reward', `Sovg'a olindi: ${reward.name} — ${user.firstName} (-${cost})`, { redemptionId });

  const remaining = Math.max(0, points - cost);
  await ctx.editMessageText(
    t(lang, 'rewardRedeemed', { name: reward.name, cost: fmtNum(cost), points: fmtNum(remaining) }),
    { parse_mode: 'Markdown', ...backTo(lang, 'rewards_shop') }
  );

  // Adminlarga xabar
  for (const adminId of ADMIN_IDS) {
    try {
      await ctx.telegram.sendMessage(adminId,
        `🎁 *Yangi sovg'a so'rovi!*\n\n👤 ${user.firstName} (${ctx.from.id})\n📱 ${user.phone || '-'}\n🎁 ${reward.name}\n💰 ${fmtNum(cost)} ball`,
        { parse_mode: 'Markdown' }
      );
    } catch { }
  }
}

// ─── 4. REFERAL TIZIMI ───────────────────────────────────────────────────────
async function getOrCreateReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  const code = generateReferralCode(user.telegramId);
  await updateDoc('telegramUsers', user.id, { referralCode: code });
  return code;
}

async function handleReferralInfo(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user) return;

  const code = await getOrCreateReferralCode(user);
  const botUsername = (process.env.BOT_USERNAME || 'BoomStroyBot').replace('@', '');
  const link = `https://t.me/${botUsername}?start=ref_${code}`;

  const text = t(lang, 'referralInfo', {
    bonus: fmtNum(REFERRAL_BONUS_POINTS), welcome: fmtNum(REFERRAL_WELCOME_POINTS),
    link, count: user.referredCount || 0, earnings: fmtNum(user.referralEarnings || 0),
  });

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.url(t(lang, 'btnSendToFriend'), `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t(lang, 'referralShareText'))}`)],
      [Markup.button.callback(t(lang, 'back'), 'loyalty_menu')],
    ]),
  });
}

async function processReferral(newUser, referralCode) {
  if (!referralCode || !newUser?.id) return null;
  const referrers = await queryDocs('telegramUsers', 'referralCode', '==', referralCode);
  const referrer = referrers[0];
  if (!referrer || referrer.telegramId === newUser.telegramId) return null;
  if (newUser.referredBy) return null;

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

// ─── 5. PROMO-KODLAR ─────────────────────────────────────────────────────────
async function handlePromoEnterStart(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'entering_promo' });
  await ctx.editMessageText(t(lang, 'promoEnterPrompt'), {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'cancel'), 'loyalty_menu')]]),
  });
}

async function handlePromoCodeText(ctx) {
  const lang = langOf(ctx);
  const s = getSession(ctx.from.id);
  if (s.step !== 'entering_promo') return;
  const code = ctx.message.text.trim().toUpperCase();
  setSession(ctx.from.id, { step: null });

  const promos = await queryDocs('promoCodes', 'code', '==', code);
  const promo = promos[0];

  if (!promo || !isPromoValid(promo)) {
    return ctx.reply(t(lang, 'promoInvalid'), mainMenu(lang));
  }
  const usedBy = promo.usedByUsers || [];
  if (usedBy.includes(String(ctx.from.id))) {
    return ctx.reply(t(lang, 'promoUsed'), mainMenu(lang));
  }

  setSession(ctx.from.id, { activePromo: promo });
  const disc = promo.type === 'percent' ? promo.value + '%' : fmtNum(promo.value) + ' ' + t(lang, 'som');
  await ctx.reply(t(lang, 'promoAccepted', { code: promo.code, disc }), { parse_mode: 'Markdown', ...mainMenu(lang) });
}

async function markPromoUsed(promoId, telegramId) {
  if (!promoId) return;
  await updateDoc('promoCodes', promoId, {
    usedByUsers: admin.firestore.FieldValue.arrayUnion(String(telegramId)),
    usedCount: admin.firestore.FieldValue.increment(1),
  });
}

async function createPromoCode(type, value, maxUses, expiresInDays) {
  const code = generatePromoCode();
  const data = {
    code, type, value, maxUses: maxUses || null, usedCount: 0,
    usedByUsers: [], active: true,
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null,
  };
  const id = await addDoc('promoCodes', data);
  return { id, ...data };
}

// ─── 6. SEVIMLILAR ───────────────────────────────────────────────────────────
async function handleFavoriteToggle(ctx, productId) {
  const lang = langOf(ctx);
  const user = await getTgUser(ctx.from.id);
  if (!user) return ctx.answerCbQuery(t(lang, 'pressStart'));

  const favorites = user.favorites || [];
  const isFav = favorites.includes(productId);

  if (isFav) {
    await arrayRemoveField('telegramUsers', user.id, 'favorites', productId);
    await ctx.answerCbQuery(t(lang, 'favRemoved'));
  } else {
    await arrayUnionField('telegramUsers', user.id, 'favorites', productId);
    await ctx.answerCbQuery(t(lang, 'favAdded'));
  }

  try {
    const { productActionsV2 } = require('../utils/keyboards');
    const cart = require('../services/session').getCart(ctx.from.id);
    const cartQty = cart.find(i => i.productId === productId)?.qty || 0;
    await ctx.editMessageReplyMarkup(productActionsV2(productId, cartQty, !isFav, lang).reply_markup);
  } catch { }
}

async function handleViewFavorites(ctx, page = 0) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user || !(user.favorites || []).length) {
    const msg = t(lang, 'favEmpty');
    const kb = Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btnProducts'), 'categories')]]);
    if (ctx.callbackQuery) { try { return ctx.editMessageText(msg, kb); } catch { } }
    return ctx.reply(msg, kb);
  }

  const allProducts = await getCollection('products');
  const favProducts = allProducts.filter(p => (user.favorites || []).includes(p.id));

  const text = t(lang, 'favTitle', { n: favProducts.length });
  if (ctx.callbackQuery) {
    try { return ctx.editMessageText(text, { parse_mode: 'Markdown', ...favoritesNavButtons(favProducts, page, lang) }); } catch { }
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...favoritesNavButtons(favProducts, page, lang) });
}

async function isProductFavorite(telegramId, productId) {
  const user = await getTgUser(telegramId);
  return (user?.favorites || []).includes(productId);
}

async function handleAddAllFavoritesToCart(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user || !(user.favorites || []).length) return ctx.reply(t(lang, 'favEmpty'));

  const { updateCart } = require('../services/session');
  const allProducts = await getCollection('products');
  let added = 0;
  for (const favId of user.favorites) {
    const p = allProducts.find(x => x.id === favId);
    if (p && (p.quantity || 0) > 0 && p.status !== 'inactive') { updateCart(ctx.from.id, p, 1); added++; }
  }
  await ctx.reply(t(lang, 'cartAdded'), mainMenu(lang));
}

// ─── 7. SHARHLAR VA REYTING ──────────────────────────────────────────────────
async function handleReviewStart(ctx, productId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  await ctx.reply(t(lang, 'rateProduct'), ratingStarsKeyboard(productId, lang));
}

async function handleReviewStarSelect(ctx, productId, stars) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery(t(lang, 'reviewStarsChosen', { stars }));
  setSession(ctx.from.id, { step: 'writing_review', reviewProductId: productId, reviewStars: parseInt(stars) });
  await ctx.editMessageText(
    `${'⭐'.repeat(parseInt(stars))}${t(lang, 'reviewAskComment')}`,
    { ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btnSkip'), `review_skip:${productId}:${stars}`)]]) }
  );
}

async function handleReviewTextSave(ctx) {
  const lang = langOf(ctx);
  const s = getSession(ctx.from.id);
  if (s.step !== 'writing_review') return;

  const user = await getTgUser(ctx.from.id);
  await saveReview(s.reviewProductId, ctx.from.id, user, s.reviewStars, ctx.message.text);
  setSession(ctx.from.id, { step: null, reviewProductId: null, reviewStars: null });
  await ctx.reply(t(lang, 'reviewSaved'), mainMenu(lang));
}

async function handleReviewSkip(ctx, productId, stars) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  await saveReview(productId, ctx.from.id, user, parseInt(stars), '');
  setSession(ctx.from.id, { step: null });
  await ctx.editMessageText(`${'⭐'.repeat(parseInt(stars))}${t(lang, 'reviewRatingSaved')}`);
}

async function saveReview(productId, telegramId, user, stars, comment) {
  await addDoc('reviews', {
    productId, telegramId: String(telegramId),
    customerName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Mijoz',
    stars, comment: comment || '',
  });
  await recalcProductRating(productId);
  await addLog('review', `Yangi sharh: ${productId} — ${stars}⭐`);
}

async function recalcProductRating(productId) {
  const reviews = await queryDocs('reviews', 'productId', '==', productId);
  if (!reviews.length) return;
  const avg = reviews.reduce((s, r) => s + (r.stars || 0), 0) / reviews.length;
  await updateDoc('products', productId, { avgRating: parseFloat(avg.toFixed(1)), reviewCount: reviews.length });
}

async function handleViewProductReviews(ctx, productId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const reviews = await queryDocs('reviews', 'productId', '==', productId);
  if (!reviews.length) return ctx.reply(t(lang, 'noReviews'));
  reviews.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const text =
    `${t(lang, 'reviewsTitle', { n: reviews.length })}\n\n` +
    reviews.slice(0, 8).map(r =>
      `${starsBar(r.stars)} *${r.customerName}*\n${r.comment ? truncate(r.comment, 100) : t(lang, 'noComment')}`
    ).join('\n\n');
  await ctx.reply(text, { parse_mode: 'Markdown' });
}

// ─── 8. OXIRGI KO'RILGANLAR ──────────────────────────────────────────────────
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

async function handleRecentlyViewed(ctx) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const user = await getTgUser(ctx.from.id);
  if (!user || !(user.recentlyViewed || []).length) return ctx.reply(t(lang, 'recentEmpty'));
  const allProducts = await getCollection('products');
  const recentProducts = user.recentlyViewed.map(id => allProducts.find(p => p.id === id)).filter(Boolean);
  await ctx.reply(t(lang, 'recentTitle'), { parse_mode: 'Markdown', ...favoritesNavButtons(recentProducts, 0, lang) });
}

// ─── 9. NARX / ZAXIRA OGOHLANTIRISHLARI ──────────────────────────────────────
async function handlePriceAlertSubscribe(ctx, productId) {
  const lang = langOf(ctx);
  const user = await getTgUser(ctx.from.id);
  if (!user) return ctx.answerCbQuery();
  await arrayUnionField('telegramUsers', user.id, 'priceAlerts', productId);
  await ctx.answerCbQuery(t(lang, 'priceAlertSet'), { show_alert: true });
}

async function handleStockAlertSubscribe(ctx, productId) {
  const lang = langOf(ctx);
  const user = await getTgUser(ctx.from.id);
  if (!user) return ctx.answerCbQuery();
  await arrayUnionField('telegramUsers', user.id, 'stockAlerts', productId);
  await ctx.answerCbQuery(t(lang, 'stockAlertSet'), { show_alert: true });
}

async function notifyPriceDropSubscribers(bot, productId, oldPrice, newPrice) {
  if (newPrice >= oldPrice) return;
  const users = await queryDocs('telegramUsers', 'priceAlerts', 'array-contains', productId);
  const product = await getDoc('products', productId);
  if (!product) return;
  for (const u of users) {
    try {
      const lang = normalizeLang(u.lang);
      await bot.telegram.sendMessage(u.telegramId,
        t(lang, 'priceDrop', { name: product.name, old: fmtNum(oldPrice), new: fmtNum(newPrice), som: t(lang, 'som') }),
        { parse_mode: 'Markdown' });
      await arrayRemoveField('telegramUsers', u.id, 'priceAlerts', productId);
    } catch { }
  }
}

async function notifyStockArrivalSubscribers(bot, productId) {
  const users = await queryDocs('telegramUsers', 'stockAlerts', 'array-contains', productId);
  const product = await getDoc('products', productId);
  if (!product || !users.length) return;
  for (const u of users) {
    try {
      const lang = normalizeLang(u.lang);
      await bot.telegram.sendMessage(u.telegramId,
        t(lang, 'stockArrived', { name: product.name, price: fmtNum(product.price), som: t(lang, 'som') }),
        { parse_mode: 'Markdown' });
      await arrayRemoveField('telegramUsers', u.id, 'stockAlerts', productId);
    } catch { }
  }
}

// ─── 10. SUPPORT ─────────────────────────────────────────────────────────────
async function handleSupportNewTicket(ctx) {
  const lang = langOf(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'support_writing' });
  await ctx.reply(t(lang, 'supportPrompt'), { ...Markup.keyboard([[t(lang, 'cancel')]]).resize().oneTime() });
}

async function handleSupportTicketSave(ctx) {
  const lang = langOf(ctx);
  const s = getSession(ctx.from.id);
  if (s.step !== 'support_writing') return;
  setSession(ctx.from.id, { step: null });

  const ticketId = await addDoc('supportTickets', {
    telegramId: String(ctx.from.id),
    customerName: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
    message: ctx.message.text, status: 'open',
  });

  await ctx.reply(t(lang, 'supportSent'), mainMenu(lang));

  for (const adminId of ADMIN_IDS) {
    try {
      await ctx.telegram.sendMessage(adminId,
        `🆘 *Yangi murojaat!*\n\n👤 ${ctx.from.first_name} (${ctx.from.id})\n\n📝 ${ctx.message.text}`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('✍️ Javob berish', `support_reply:${ticketId}:${ctx.from.id}`)]]) });
    } catch { }
  }
}

async function handleMySupportTickets(ctx) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const tickets = await queryDocs('supportTickets', 'telegramId', '==', String(ctx.from.id));
  if (!tickets.length) return ctx.reply(t(lang, 'supportNoTickets'));
  tickets.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const text = tickets.slice(0, 10).map((t2, i) =>
    `${i + 1}. ${t2.status === 'open' ? '🟡' : '✅'} ${truncate(t2.message, 50)}\n   ${t2.reply ? t(lang, 'supportReplyLabel') + truncate(t2.reply, 60) : t(lang, 'supportWaiting')}`
  ).join('\n\n');
  await ctx.reply(`${t(lang, 'supportMyTitle')}\n\n${text}`, { parse_mode: 'Markdown' });
}

async function handleSupportReplyStart(ctx, ticketId, customerTgId) {
  if (!ADMIN_IDS.includes(String(ctx.from.id))) return ctx.answerCbQuery('Ruxsat yo\'q');
  await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: 'support_admin_reply', replyTicketId: ticketId, replyCustomerId: customerTgId });
  await ctx.reply('✍️ Javobingizni yozing:');
}

async function handleSupportReplySave(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step !== 'support_admin_reply') return;
  setSession(ctx.from.id, { step: null });

  await updateDoc('supportTickets', s.replyTicketId, { status: 'closed', reply: ctx.message.text });
  try {
    // Mijozning tilida javob sarlavhasi
    const cust = await getTgUser(s.replyCustomerId);
    const lang = normalizeLang(cust?.lang);
    await ctx.telegram.sendMessage(s.replyCustomerId,
      `${t(lang, 'supportReplyToYou')}\n\n${ctx.message.text}`, { parse_mode: 'Markdown' });
  } catch { }
  await ctx.reply('✅ Javob yuborildi.');
}

// ─── 11. TIL TANLASH ─────────────────────────────────────────────────────────
async function handleLanguageMenu(ctx) {
  const lang = langOf(ctx);
  await ctx.reply(t(lang, 'chooseLang'), languageButtons());
}

async function handleLanguageSelect(ctx, lang) {
  await ctx.answerCbQuery();
  const normalized = normalizeLang(lang);
  const user = await getTgUser(ctx.from.id);
  if (user) await updateDoc('telegramUsers', user.id, { lang: normalized });
  ctx.state.lang = normalized;
  try { require('../middlewares/auth').setUserLangCache(ctx.from.id, normalized); } catch { }

  try { await ctx.editMessageText(t(normalized, 'langSet')); } catch { }
  await ctx.reply(t(normalized, 'mainMenuTitle'), mainMenu(normalized));
}

// ─── 12. MIQDOR TANLAGICH ────────────────────────────────────────────────────
async function handleQtyPickerInc(ctx, productId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const s = getSession(ctx.from.id);
  const tempQty = (s.tempQty && s.tempQty[productId]) || 1;
  setSession(ctx.from.id, { tempQty: { ...(s.tempQty || {}), [productId]: tempQty + 1 } });
  try { await ctx.editMessageReplyMarkup(quantityPickerKeyboard(productId, tempQty + 1, lang).reply_markup); } catch { }
}

async function handleQtyPickerDec(ctx, productId) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery();
  const s = getSession(ctx.from.id);
  const tempQty = Math.max(1, ((s.tempQty && s.tempQty[productId]) || 1) - 1);
  setSession(ctx.from.id, { tempQty: { ...(s.tempQty || {}), [productId]: tempQty } });
  try { await ctx.editMessageReplyMarkup(quantityPickerKeyboard(productId, tempQty, lang).reply_markup); } catch { }
}

async function handleQtyPickerConfirm(ctx, productId) {
  const lang = langOf(ctx);
  const s = getSession(ctx.from.id);
  const qty = (s.tempQty && s.tempQty[productId]) || 1;
  const allProducts = await getCollection('products');
  const p = allProducts.find(x => x.id === productId);
  if (!p) return ctx.answerCbQuery(t(lang, 'notFound'));
  const { updateCart } = require('../services/session');
  updateCart(ctx.from.id, p, qty);
  await ctx.answerCbQuery(t(lang, 'cartAdded'));
}

// ─── 13. BUYURTMADAN KEYIN BAHOLASH ──────────────────────────────────────────
async function handleOrderRatingRequest(bot, telegramId, orderId, orderNumber) {
  try {
    const cust = await getTgUser(telegramId);
    const lang = normalizeLang(cust?.lang);
    await bot.telegram.sendMessage(telegramId,
      t(lang, 'orderRateAsk', { num: orderNumber }),
      require('../utils/keyboards').orderRatingKeyboard(orderId));
  } catch { }
}

async function handleOrderRatingSave(ctx, orderId, stars) {
  const lang = langOf(ctx);
  await ctx.answerCbQuery(t(lang, 'thanks'));
  await updateDoc('orders', orderId, { customerRating: parseInt(stars) });
  await ctx.editMessageText(`${'⭐'.repeat(parseInt(stars))}${t(lang, 'thanksFeedback')}`);
}

// ─── 14. FAQ ─────────────────────────────────────────────────────────────────
async function handleFAQ(ctx) {
  const lang = langOf(ctx);
  const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || '@boomstroy_support';
  await ctx.reply(t(lang, 'faq', { support: SUPPORT_USERNAME, som: t(lang, 'som') }), { parse_mode: 'Markdown', ...mainMenu(lang) });
}

module.exports = {
  getTgUser,
  handleLoyaltyMenu, handleLoyaltyBalance, awardLoyaltyPoints, redeemLoyaltyPoints,
  handleDailyBonus, handleLoyaltyTiers,
  handleRewardsShop, handleRewardDetail, handleRewardRedeem,
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
