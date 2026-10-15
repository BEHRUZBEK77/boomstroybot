// ════════════════════════════════════════════════════════════════════════════
// ADMIN: Mijozlar va buyurtmalar boshqaruvi
//   ac:l:<page>          mijozlar ro'yxati       ac:q            qidiruv
//   ac:v:<docId>         mijoz kartochkasi       ac:b:<docId>    bloklash/blokdan chiqarish
//   ac:pt:<docId>        ball qo'shish/ayirish   ac:msg:<docId>  shaxsiy xabar
//   ac:o:<docId>         mijoz buyurtmalari
//   ao:sm:<orderId>      holat tanlash           ao:st:<orderId>:<status>
//   ao:q                 buyurtmani raqami bo'yicha qidirish
// ════════════════════════════════════════════════════════════════════════════
const { Markup } = require('telegraf');
const fb = require('../services/firebase');
const { getSession, setSession } = require('../services/session');
const { fmtNum, escapeMarkdown, mdBold, fmtDate, orderStatusLabel } = require('../utils/helpers');

const PER_PAGE = 8;
const LINE = '━━━━━━━━━━━━━━━━';
const btn = Markup.button.callback;
const esc = (s) => escapeMarkdown(String(s ?? ''));
const short = (s, n = 58) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const ack = (ctx, t) => ctx.callbackQuery ? ctx.answerCbQuery(t).catch(() => { }) : null;
const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

async function show(ctx, text, rows) {
  const extra = { parse_mode: 'Markdown', disable_web_page_preview: true, ...Markup.inlineKeyboard(rows) };
  const msg = ctx.callbackQuery?.message;
  if (msg && !msg.photo && msg.caption === undefined) {
    try { return await ctx.editMessageText(text, extra); } catch { }
  } else if (msg) await ctx.deleteMessage().catch(() => { });
  return ctx.reply(text, extra);
}

const userName = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.username ? '@' + u.username : u.telegramId);

async function users() {
  const list = await fb.getCollection('telegramUsers');
  return [...list].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0) || (b.orderCount || 0) - (a.orderCount || 0));
}

// ─── Ro'yxat ─────────────────────────────────────────────────────────────────
async function showList(ctx, page = 0, list = null, title = null) {
  await ack(ctx);
  const all = list || await users();
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  page = Math.max(0, Math.min(page, pages - 1));
  const rows = all.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map(u => [
    btn(short(`${u.isBlocked ? '⛔ ' : ''}${userName(u)} · ${u.orderCount || 0} buyurtma`), `ac:v:${u.id}`),
  ]);
  if (pages > 1 && !list) rows.push([
    btn(page > 0 ? '‹' : '·', page > 0 ? `ac:l:${page - 1}` : 'noop'),
    btn(`${page + 1} / ${pages}`, 'noop'),
    btn(page < pages - 1 ? '›' : '·', page < pages - 1 ? `ac:l:${page + 1}` : 'noop'),
  ]);
  rows.push([btn('🔎 Qidirish', 'ac:q'), btn('🏠 Panel', 'ae:h')]);
  const blocked = all.filter(u => u.isBlocked).length;
  return show(ctx, `🪪 *${title || 'Mijozlar'}* · ${all.length} ta${blocked && !list ? ` (⛔ ${blocked})` : ''}\n${LINE}\nXarid summasi bo'yicha tartiblangan:`, rows);
}

// ─── Kartochka ───────────────────────────────────────────────────────────────
async function showView(ctx, id, notice) {
  await ack(ctx);
  const u = await fb.getDoc('telegramUsers', id);
  if (!u) return show(ctx, '❗ Mijoz topilmadi.', [[btn('‹ Orqaga', 'ac:l:0')]]);
  const text = (notice ? `${notice}\n\n` : '') +
    `🪪 ${mdBold(userName(u))}${u.isBlocked ? ' · ⛔ bloklangan' : ''}\n${LINE}\n` +
    `📞 Telefon: ${esc(u.phone || '—')}\n` +
    `💬 Telegram: ${u.username ? '@' + esc(u.username) : '—'} · ID \`${u.telegramId}\`\n` +
    `🗣 Til: ${esc(u.lang || 'uz')}\n\n` +
    `📝 Buyurtmalar: *${u.orderCount || 0}*\n` +
    `💰 Jami xarid: *${fmtNum(u.totalSpent || 0)} so'm*\n` +
    `💎 Ballar: *${fmtNum(u.loyaltyPoints || 0)}*\n` +
    `📆 Ro'yxatdan o'tgan: ${fmtDate(u.createdAt)}`;
  return show(ctx, text, [
    [btn('📝 Buyurtmalari', `ac:o:${id}`), btn('💬 Xabar yozish', `ac:msg:${id}`)],
    [btn("💎 Ball qo'shish/ayirish", `ac:pt:${id}`)],
    [btn(u.isBlocked ? '✅ Blokdan chiqarish' : '⛔ Bloklash', `ac:b:${id}`)],
    [btn('‹ Mijozlar', 'ac:l:0'), btn('🏠 Panel', 'ae:h')],
  ]);
}

async function toggleBlock(ctx, id) {
  const u = await fb.getDoc('telegramUsers', id);
  if (!u) return ack(ctx, 'Topilmadi');
  await fb.updateDoc('telegramUsers', id, { isBlocked: !u.isBlocked });
  await fb.addLog('admin', `Mijoz ${u.isBlocked ? 'blokdan chiqarildi' : 'bloklandi'}: ${userName(u)}`, { by: ctx.from.id }).catch(() => { });
  return showView(ctx, id, u.isBlocked ? '✅ Blokdan chiqarildi' : '⛔ Bloklandi');
}

async function showUserOrders(ctx, id) {
  await ack(ctx);
  const u = await fb.getDoc('telegramUsers', id);
  const orders = u ? await fb.queryDocs('orders', 'telegramId', '==', String(u.telegramId)) : [];
  orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const rows = orders.slice(0, 15).map(o => [btn(short(`${o.orderNumber} · ${orderStatusLabel(o.status)} · ${fmtNum(o.grandTotal)}`), `admin_order:${o.id}`)]);
  rows.push([btn('‹ Mijoz', `ac:v:${id}`)]);
  return show(ctx, `📝 *Buyurtmalari* · ${orders.length} ta`, rows);
}

// ─── Kiritish talab qiladigan amallar ────────────────────────────────────────
async function startInput(ctx, kind, id) {
  await ack(ctx);
  setSession(ctx.from.id, { step: 'ac_input', acInput: { kind, id } });
  const prompts = {
    pt: "💎 Necha ball qo'shish kerak? Ayirish uchun minus bilan yozing (masalan -200).",
    msg: '💬 Mijozga yuboriladigan xabarni yozing (matn, rasm yoki video).',
    q: '🔎 Ism, telefon, @username yoki Telegram ID yozing:',
    oq: '🔎 Buyurtma raqamini yozing (masalan BS-1234):',
  };
  return show(ctx, prompts[kind], [[btn('❗ Bekor qilish', id ? `ac:v:${id}` : 'ae:h')]]);
}

async function handleInput(ctx) {
  const s = getSession(ctx.from.id);
  const { kind, id } = s.acInput || {};
  setSession(ctx.from.id, { step: null, acInput: null });
  const text = String(ctx.message?.text || '').trim();

  if (kind === 'pt') {
    const n = parseInt(text.replace(/\s/g, ''), 10);
    if (!n) return ctx.reply('❗ Butun son yozing, masalan 500 yoki -200');
    await fb.incrementField('telegramUsers', id, 'loyaltyPoints', n);
    await fb.addLog('admin', `Ball ${n > 0 ? '+' : ''}${n}: ${id}`, { by: ctx.from.id }).catch(() => { });
    const u = await fb.getDoc('telegramUsers', id);
    if (u?.telegramId && n > 0) {
      ctx.telegram.sendMessage(u.telegramId, `💎 Sizga *${fmtNum(n)}* bonus ball qo'shildi!\nJami: *${fmtNum(u.loyaltyPoints || 0)}* ball`, { parse_mode: 'Markdown' }).catch(() => { });
    }
    return showView(ctx, id, `✅ Ball ${n > 0 ? "qo'shildi" : 'ayirildi'}: ${n > 0 ? '+' : ''}${fmtNum(n)}`);
  }
  if (kind === 'msg') {
    const u = await fb.getDoc('telegramUsers', id);
    try {
      await ctx.telegram.copyMessage(u.telegramId, ctx.chat.id, ctx.message.message_id);
      return showView(ctx, id, '✅ Xabar yuborildi');
    } catch (e) {
      return showView(ctx, id, `❗ Yuborilmadi: ${esc(e.description || e.message)}`);
    }
  }
  if (kind === 'q') {
    const q = text.toLowerCase().replace(/^@/, '');
    const digits = q.replace(/\D/g, '');
    const found = (await users()).filter(u =>
      String(u.telegramId) === q ||
      `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(q) ||
      String(u.username || '').toLowerCase().includes(q) ||
      (digits.length >= 4 && String(u.phone || '').replace(/\D/g, '').includes(digits))
    ).slice(0, 20);
    return showList(ctx, 0, found, `Qidiruv: ${esc(text)}`);
  }
  if (kind === 'oq') {
    const q = text.toUpperCase();
    const all = await fb.getCollection('orders');
    const found = all.filter(o => String(o.orderNumber || '').toUpperCase().includes(q)).slice(0, 15);
    const rows = found.map(o => [btn(short(`${o.orderNumber} · ${o.customerName || '?'} · ${fmtNum(o.grandTotal)}`), `admin_order:${o.id}`)]);
    rows.push([btn('🏠 Panel', 'ae:h')]);
    return ctx.reply(found.length ? `🔎 Topildi: ${found.length}` : '🔎 Topilmadi.', Markup.inlineKeyboard(rows));
  }
}

// ─── Buyurtma holatini istalgan holatga o'tkazish ────────────────────────────
async function showStatusMenu(ctx, orderId) {
  await ack(ctx);
  const o = await fb.getDoc('orders', orderId);
  if (!o) return show(ctx, '❗ Buyurtma topilmadi.', [[btn('🏠 Panel', 'ae:h')]]);
  const rows = STATUSES.map(st => [btn(`${st === o.status ? '● ' : ''}${orderStatusLabel(st)}`, `ao:st:${orderId}:${st}`)]);
  rows.push([btn('‹ Buyurtma', `admin_order:${orderId}`)]);
  return show(ctx, `📝 *${esc(o.orderNumber)}* — yangi holatni tanlang:\n_Mijozga avtomatik xabar boradi._`, rows);
}

async function handleCallback(ctx, data) {
  if (!ctx.state?.isAdmin) return ack(ctx, "Ruxsat yo'q");
  const p = data.split(':');
  if (p[0] === 'ao') {
    if (p[1] === 'sm') return showStatusMenu(ctx, p[2]);
    if (p[1] === 'st') {
      const o = await fb.getDoc('orders', p[2]);
      if (o?.status === p[3]) return ack(ctx, 'Holat allaqachon shu');
      return require('../handlers/admin').updateOrderStatus(ctx, p[2], p[3]);
    }
    if (p[1] === 'q') return startInput(ctx, 'oq');
  }
  switch (p[1]) {
    case 'l': return showList(ctx, parseInt(p[2]) || 0);
    case 'v': return showView(ctx, p[2]);
    case 'b': return toggleBlock(ctx, p[2]);
    case 'o': return showUserOrders(ctx, p[2]);
    case 'pt': return startInput(ctx, 'pt', p[2]);
    case 'msg': return startInput(ctx, 'msg', p[2]);
    case 'q': return startInput(ctx, 'q');
  }
  return ack(ctx);
}

module.exports = { handleCallback, handleInput, showList };
