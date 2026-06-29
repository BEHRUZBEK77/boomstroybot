// ════════════════════════════════════════════════════════════════════════════
// FIRESTORE REAL-VAQT KUZATUVCHILARI
//   - orders        → buyurtma holati o'zgarsa (admin panel YOKI bot orqali),
//                     foydalanuvchiga uning tilida 100% xabar yuboriladi.
//   - announcements → yangi e'lon/aksiya qo'shilsa, barcha foydalanuvchilarga
//                     100% yuboriladi (idempotent: sentToTelegram bilan).
// Bu yondashuv xabarlar QAYERDA o'zgartirilganidan qat'i nazar ishlaydi.
// ════════════════════════════════════════════════════════════════════════════
const { getDb, getCollection, admin } = require('./firebase');
const { t, normalizeLang } = require('../utils/i18n');
const { fmtNum } = require('../utils/helpers');

let started = false;

// Qaysi holatlarda mijozga xabar yuboriladi
const NOTIFY_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'paid'];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function startWatchers(bot) {
  if (started) return;
  started = true;
  const db = getDb();
  watchOrders(bot, db);
  watchAnnouncements(bot, db);
  console.log("✅ Firestore kuzatuvchilari ishga tushdi (orders, announcements)");
}

// ─── 1. BUYURTMA HOLATI KUZATUVCHISI ─────────────────────────────────────────
function watchOrders(bot, db) {
  let initial = true;
  db.collection('orders').onSnapshot(
    (snap) => {
      const isInitial = initial;
      initial = false;
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        const order = { id: ch.doc.id, ...ch.doc.data() };
        onOrderChange(bot, db, order, isInitial).catch(e => console.error('order watch:', e.message));
      });
    },
    (err) => console.error('orders onSnapshot xato:', err.message)
  );
}

async function markOrderNotified(db, id, status) {
  await db.collection('orders').doc(id).update({ lastNotifiedStatus: status }).catch(() => { });
}

async function onOrderChange(bot, db, order, isInitial) {
  const status = order.status;
  if (!order.telegramId || !status) return;

  // Allaqachon shu holat uchun xabar berilgan
  if (order.lastNotifiedStatus === status) return;

  // Birinchi yuklash: eski buyurtmalarni JIMGINA belgilab qo'yamiz (spam bo'lmasligi uchun)
  if (isInitial) {
    if (order.lastNotifiedStatus === undefined || order.lastNotifiedStatus === null) {
      await markOrderNotified(db, order.id, status);
      return;
    }
    // lastNotifiedStatus bor, lekin farq qiladi → bot o'chiq paytda o'zgargan, xabar beramiz (davom etadi)
  }

  // Xabar talab qilmaydigan holat (masalan, pending) — jimgina belgilaymiz
  if (!NOTIFY_STATUSES.includes(status)) {
    await markOrderNotified(db, order.id, status);
    return;
  }

  // Mijoz tili
  let lang = normalizeLang(order.lang);
  try {
    const { queryDocs } = require('./firebase');
    const u = await queryDocs('telegramUsers', 'telegramId', '==', String(order.telegramId));
    if (u[0]?.lang) lang = normalizeLang(u[0].lang);
  } catch { }

  const isPickup = order.deliveryType === 'pickup';
  const som = t(lang, 'som');
  const vars = {
    num: order.orderNumber, grand: fmtNum(order.grandTotal), som,
    city: order.deliveryCity || order.deliveryAddress,
    wh: order.pickupWarehouseName || order.deliveryAddress,
  };

  let msg;
  switch (status) {
    case 'confirmed':
    case 'processing': msg = t(lang, 'notifyConfirmed', vars); break;
    case 'paid': msg = t(lang, 'notifyPayOk', vars); break;
    case 'shipped': msg = isPickup ? t(lang, 'notifyReadyPickup', vars) : t(lang, 'notifyShipped', vars); break;
    case 'delivered': msg = t(lang, 'notifyDelivered', vars); break;
    case 'cancelled': msg = t(lang, 'notifyCancelled', vars); break;
  }

  if (msg) {
    try {
      await bot.telegram.sendMessage(order.telegramId, msg, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('order notify yuborish xato:', e.message);
    }
  }

  // Yetkazib berilganda baholash so'rovi
  if (status === 'delivered') {
    try {
      const { handleOrderRatingRequest } = require('../handlers/loyalty');
      await handleOrderRatingRequest(bot, order.telegramId, order.id, order.orderNumber);
    } catch { }
  }

  await markOrderNotified(db, order.id, status);
}

// ─── 2. E'LON / AKSIYA KUZATUVCHISI ──────────────────────────────────────────
function watchAnnouncements(bot, db) {
  let initial = true;
  db.collection('announcements').onSnapshot(
    (snap) => {
      const isInitial = initial;
      initial = false;
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'removed') return;
        const ann = { id: ch.doc.id, ...ch.doc.data() };
        onAnnouncement(bot, db, ann, isInitial).catch(e => console.error('announcement watch:', e.message));
      });
    },
    (err) => console.error('announcements onSnapshot xato:', err.message)
  );
}

const sendingAnn = new Set();

async function onAnnouncement(bot, db, ann, isInitial) {
  if (ann.active === false) return;
  if (ann.sentToTelegram) return;

  // Birinchi yuklash: mavjud e'lonlarni JIMGINA belgilaymiz (qayta yuborilmasligi uchun)
  if (isInitial) {
    await db.collection('announcements').doc(ann.id).update({ sentToTelegram: true }).catch(() => { });
    return;
  }

  if (sendingAnn.has(ann.id)) return;
  sendingAnn.add(ann.id);
  try {
    // Avval belgilab qo'yamiz — ikki marta yuborilmasligi uchun
    await db.collection('announcements').doc(ann.id).update({
      sentToTelegram: true,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });

    const users = await getCollection('telegramUsers');
    let ok = 0, fail = 0;
    for (const u of users) {
      if (u.isBlocked) continue;
      const lang = normalizeLang(u.lang);
      const text = buildAnnouncementText(ann, lang);
      if (!text) continue;
      try {
        if (ann.imageUrl) {
          await bot.telegram.sendPhoto(u.telegramId, ann.imageUrl, { caption: text, parse_mode: 'Markdown' });
        } else {
          await bot.telegram.sendMessage(u.telegramId, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
        }
        ok++;
        await sleep(50); // Telegram rate-limit
      } catch { fail++; }
    }
    console.log(`📢 E'lon yuborildi: ✅ ${ok}, ❌ ${fail}`);
  } finally {
    sendingAnn.delete(ann.id);
  }
}

// E'lon matnini foydalanuvchi tilida tayyorlaydi.
// Qo'llab-quvvatlanadigan maydonlar:
//   title / title_uz / title_uz_cyrl / title_ru / title_en
//   text|message|body / text_uz / text_uz_cyrl / text_ru / text_en
//   type: 'promo'|'aksiya' bo'lsa ⭐, aks holda 📢
function buildAnnouncementText(ann, lang) {
  const pick = (base) =>
    ann[`${base}_${lang}`] || ann[`${base}_uz`] || ann[base] || '';

  const title = pick('title');
  const body = ann[`text_${lang}`] || ann[`text_uz`] || ann.text || ann.message || ann.body || '';
  if (!title && !body) return '';

  const emoji = ['promo', 'aksiya', 'sale', 'discount'].includes(String(ann.type || '').toLowerCase()) ? '⭐' : '📢';
  let out = '';
  if (title) out += `${emoji} *${title}*\n\n`;
  else out += `${emoji} `;
  out += body;
  return out.trim();
}

module.exports = { startWatchers };
