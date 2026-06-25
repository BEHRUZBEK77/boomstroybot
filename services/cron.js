const cron = require('node-cron');
const { getCollection } = require('./firebase');
const { getStockStatus, fmtNum } = require('../utils/helpers');

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean);

let botInstance = null;

function setBotInstance(bot) {
  botInstance = bot;
}

function startCrons() {
  // Har kuni ertalab 9:00 da kam qolgan mahsulotlar haqida xabar
  cron.schedule('0 9 * * *', async () => {
    if (!botInstance) return;
    try {
      const products = await getCollection('products');
      const low = products.filter(p => getStockStatus(p).val !== 'ok');
      if (!low.length) return;

      const text =
        `⚠️ *Kunlik Zaxira Hisoboti*\n\n` +
        `Kam qolgan mahsulotlar (${low.length} ta):\n\n` +
        low.slice(0, 10).map(p => {
          const st = getStockStatus(p);
          return `${st.emoji} ${p.name}: ${p.quantity || 0} ${p.unit || 'dona'}`;
        }).join('\n') +
        (low.length > 10 ? `\n... va yana ${low.length - 10} ta` : '');

      for (const adminId of ADMIN_IDS) {
        await botInstance.telegram.sendMessage(adminId, text, { parse_mode: 'Markdown' }).catch(() => { });
      }
    } catch (e) {
      console.error('Cron error:', e.message);
    }
  }, { timezone: 'Asia/Tashkent' });

  // Har soatda kutilayotgan buyurtmalar eslatmasi
  cron.schedule('0 * * * *', async () => {
    if (!botInstance) return;
    try {
      const { queryDocs } = require('./firebase');
      const admin = require('firebase-admin');
      const db = require('./firebase').getDb();
      const snap = await db.collection('orders')
        .where('status', 'in', ['pending', 'paid_pending'])
        .get();
      const pending = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (pending.length === 0) return;

      // Only notify if there are pending orders older than 30 min
      const oldPending = pending.filter(o => {
        const created = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(0);
        return Date.now() - created.getTime() > 30 * 60 * 1000;
      });

      if (!oldPending.length) return;

      const text =
        `🔔 *${oldPending.length} ta buyurtma kutmoqda!*\n\n` +
        oldPending.slice(0, 5).map(o =>
          `• ${o.orderNumber} — ${o.customerName || '?'} — ${fmtNum(o.grandTotal || 0)} so'm`
        ).join('\n');

      for (const adminId of ADMIN_IDS) {
        await botInstance.telegram.sendMessage(adminId, text, {
          parse_mode: 'Markdown',
          ...require('telegraf').Markup.inlineKeyboard([[
            require('telegraf').Markup.button.callback('📋 Ko\'rish', 'admin_orders:pending'),
          ]]),
        }).catch(() => { });
      }
    } catch (e) {
      console.error('Cron pending error:', e.message);
    }
  }, { timezone: 'Asia/Tashkent' });

  console.log('✅ Cron joblar ishga tushdi');

  // Har kuni kechqurun 19:00 da uzoq vaqt faol bo'lmagan mijozlarga eslatma
  cron.schedule('0 19 * * *', async () => {
    if (!botInstance) return;
    try {
      const users = await getCollection('telegramUsers');
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      const inactive = users.filter(u => {
        const last = u.lastOrderAt?.toDate ? u.lastOrderAt.toDate().getTime() : 0;
        return u.phone && last && last < sevenDaysAgo && !u.isBlocked;
      });
      for (const u of inactive.slice(0, 200)) {
        try {
          await botInstance.telegram.sendMessage(
            u.telegramId,
            `👋 Sizni sog'indik!\n\n🎁 Qaytib kelganingiz uchun sizga maxsus bonus tayyorladik. "🎁 Bonus va Sodiqlik" bo'limini tekshiring!`,
          ).catch(() => { });
          await new Promise(r => setTimeout(r, 80));
        } catch { }
      }
    } catch (e) {
      console.error('Inactive users cron error:', e.message);
    }
  }, { timezone: 'Asia/Tashkent' });
}

module.exports = { startCrons, setBotInstance };
