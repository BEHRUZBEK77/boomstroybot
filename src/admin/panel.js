// ════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL (Telegram ichida to'liq boshqaruv)
//   Bosh panel → bo'lim → ro'yxat → kartochka → maydonni tahrirlash
//   Qo'shish — bosqichma-bosqich (har bir maydon so'raladi)
//
// Callback'lar ("ae:" prefiksi, 64 baytdan oshmaydi):
//   ae:h                     bosh panel
//   ae:l:<ent>:<page>        ro'yxat
//   ae:pc:<catId>:<page>     bo'lim ichidagi mahsulotlar (admin)
//   ae:v:<ent>:<id>          kartochka
//   ae:e:<ent>:<id>:<fi>     maydonni tahrirlash
//   ae:t:<ent>:<id>:<fi>     yoqish/o'chirish
//   ae:n:<ent>               yangi qo'shish
//   ae:d:<ent>:<id> / ae:dd  o'chirish (tasdiqlash / bajarish)
//   ae:q:<ent>               qidiruv
//   ae:pk:<value>            tanlovdan tanlash (select/ref)
//   ae:sk / ae:clr / ae:x    o'tkazib yuborish / tozalash / bekor qilish
// ════════════════════════════════════════════════════════════════════════════
const { Markup } = require('telegraf');
const crypto = require('crypto');
const { ENT } = require('./schemas');
const fb = require('../services/firebase');
const catalog = require('../services/catalog');
const { getSession, setSession } = require('../services/session');
const { fmtNum, escapeMarkdown, mdBold, fmtDateShort, isStockTracked, totalStock } = require('../utils/helpers');

const PER_PAGE = 8;
const LINE = '━━━━━━━━━━━━━━━━';
const esc = (s) => escapeMarkdown(String(s ?? ''));
const short = (s, n = 58) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const btn = Markup.button.callback;

function isAdmin(ctx) { return Boolean(ctx.state?.isAdmin); }

// Xabarni tahrirlaydi yoki yangisini yuboradi (rasmli xabar bo'lsa — o'chirib yangisi)
async function show(ctx, text, rows) {
  const extra = { parse_mode: 'Markdown', disable_web_page_preview: true, ...Markup.inlineKeyboard(rows) };
  const msg = ctx.callbackQuery?.message;
  if (msg && !msg.photo && msg.caption === undefined) {
    try { return await ctx.editMessageText(text, extra); } catch { }
  } else if (msg) {
    await ctx.deleteMessage().catch(() => { });
  }
  return ctx.reply(text, extra);
}
const ack = (ctx, t) => ctx.callbackQuery ? ctx.answerCbQuery(t).catch(() => { }) : null;

// ─── Ma'lumot olish ──────────────────────────────────────────────────────────
async function listDocs(entKey) {
  const e = ENT[entKey];
  let docs = e.col === 'products' ? catalog.allProducts() : await fb.getCollection(e.col);
  docs = [...docs];
  if (e.sort) docs.sort(e.sort);
  return docs;
}

// Bazadagi ASL hujjat (mahsulot narxi asl valyutada)
async function rawDoc(entKey, id) {
  const snap = await fb.getDb().collection(ENT[entKey].col).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function refOptions(refKey) {
  const docs = await listDocs(refKey);
  return docs.map(d => [d.id, `${d.icon ? d.icon + ' ' : ''}${d.name || d.id}`]);
}

// ─── Qiymatni ko'rsatish ─────────────────────────────────────────────────────
async function fmtValue(f, v, doc) {
  if (f.t === 'stock') {
    if (!isStockTracked({ stock: v, quantity: doc?.quantity })) return '_yuritilmaydi — doim sotuvda_';
    return `*${fmtNum(totalStock({ stock: v, quantity: doc?.quantity }))}* ${esc(doc?.unit || 'dona')}`;
  }
  if (f.t === 'bool') return (v === f.on || (v === undefined && f.def === f.on)) ? '✅ Ha' : '⛔ Yo\'q';
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '—';
  if (f.t === 'number') {
    if (f.k === 'price') {
      if (String(doc?.currency || 'UZS').toUpperCase() === 'USD') return `*$${v}* (≈ ${fmtNum(catalog.getProduct(doc.id)?.price || 0)} so'm)`;
      return `*${fmtNum(v)}* so'm`;
    }
    return `*${Number(v).toLocaleString('ru-RU')}*`;
  }
  if (f.t === 'select') return esc((f.opts.find(o => o[0] === v) || [, v])[1]);
  if (f.t === 'ref') {
    const opts = await refOptions(f.ref);
    return esc((opts.find(o => o[0] === v) || [, '⚠️ topilmadi'])[1]);
  }
  if (f.t === 'date') return fmtDateShort(v);
  if (f.t === 'image') return /^https?:\/\//.test(v) ? '🖼 bor' : '—';
  if (f.t === 'location') return v?.lat ? `${Number(v.lat).toFixed(5)}, ${Number(v.lng).toFixed(5)}` : '—';
  if (f.t === 'longtext') return esc(short(v, 300));
  return esc(v);
}

// ─── BOSH PANEL ──────────────────────────────────────────────────────────────
async function showHub(ctx) {
  await ack(ctx);
  const orders = await fb.getCollection('orders').catch(() => []);
  const pending = orders.filter(o => ['pending', 'paid_pending'].includes(o.status)).length;
  const products = catalog.allProducts();
  const text =
    `💼 *Boshqaruv paneli*\n${LINE}\n` +
    `🛍 Mahsulotlar: *${fmtNum(products.length)}*\n` +
    `📝 Kutilayotgan buyurtmalar: *${pending}*\n\n` +
    `Bo'limni tanlang:`;
  return show(ctx, text, [
    [btn('🛍 Mahsulotlar', 'ae:l:p:0'), btn("📁 Bo'limlar", 'ae:l:c:0')],
    [btn(`📝 Buyurtmalar${pending ? ' · ' + pending : ''}`, 'admin_orders:pending'), btn('🪪 Mijozlar', 'ac:l:0')],
    [btn('🎟 Promo-kodlar', 'ae:l:pr:0'), btn("💎 Sovg'alar", 'ae:l:rw:0')],
    [btn("📣 E'lonlar", 'ae:l:an:0'), btn('🏛 Omborlar', 'ae:l:w:0')],
    [btn('💻 Sozlamalar', 'as:h'), btn('📈 Statistika', 'admin_stats')],
    [btn('💬 Xabar yuborish', 'ae:bc')],
  ]);
}

// ─── RO'YXAT ─────────────────────────────────────────────────────────────────
async function showList(ctx, entKey, page = 0) {
  await ack(ctx);
  const e = ENT[entKey];
  if (entKey === 'p') return showProductHub(ctx);

  const docs = await listDocs(entKey);
  const pages = Math.max(1, Math.ceil(docs.length / PER_PAGE));
  page = Math.max(0, Math.min(page, pages - 1));
  const rows = docs.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map(d => [btn(short(e.label(d)), `ae:v:${entKey}:${d.id}`)]);
  if (pages > 1) rows.push(navRow(`ae:l:${entKey}`, page, pages));
  rows.push([btn(`➕ Yangi ${e.one}`, `ae:n:${entKey}`)]);
  rows.push([btn('🏠 Panel', 'ae:h')]);

  const text = `${e.icon} *${e.title}* · ${docs.length} ta\n${LINE}\n` +
    (e.note ? `💡 ${e.note}\n\n` : '') +
    (docs.length ? 'Tahrirlash uchun tanlang:' : "Hozircha bo'sh. Qo'shish uchun pastdagi tugmani bosing.");
  return show(ctx, text, rows);
}

function navRow(prefix, page, pages) {
  return [
    btn(page > 0 ? '‹' : '·', page > 0 ? `${prefix}:${page - 1}` : 'noop'),
    btn(`${page + 1} / ${pages}`, 'noop'),
    btn(page < pages - 1 ? '›' : '·', page < pages - 1 ? `${prefix}:${page + 1}` : 'noop'),
  ];
}

// Mahsulotlar: bo'limlar bo'yicha + qidiruv
async function showProductHub(ctx) {
  const products = catalog.allProducts();
  const cats = await listDocs('c');
  const counts = new Map();
  products.forEach(p => counts.set(p.category, (counts.get(p.category) || 0) + 1));
  const orphan = products.filter(p => !cats.some(c => c.id === p.category)).length;
  const inactive = products.filter(p => p.status === 'inactive').length;

  const rows = [[btn('➕ Yangi mahsulot', 'ae:n:p'), btn('🔎 Qidirish', 'ae:q:p')]];
  for (let i = 0; i < cats.length; i += 2) {
    rows.push(cats.slice(i, i + 2).map(c => btn(short(`${c.name} · ${counts.get(c.id) || 0}`, 30), `ae:pc:${c.id}:0`)));
  }
  if (orphan) rows.push([btn(`⚠️ Bo'limsiz · ${orphan}`, 'ae:pc:_none:0')]);
  rows.push([btn('🏠 Panel', 'ae:h')]);

  const text = `🛍 *Mahsulotlar* · ${fmtNum(products.length)} ta\n${LINE}\n` +
    (inactive ? `⛔ Sotuvdan olingan: ${inactive}\n` : '') +
    `Bo'limni tanlang yoki qidiring:`;
  return show(ctx, text, rows);
}

async function showProductsInCat(ctx, catId, page = 0) {
  await ack(ctx);
  const cats = await listDocs('c');
  let list = catalog.allProducts().filter(p => catId === '_none' ? !cats.some(c => c.id === p.category) : p.category === catId);
  list = [...list].sort(ENT.p.sort);
  const cat = cats.find(c => c.id === catId);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  page = Math.max(0, Math.min(page, pages - 1));
  setSession(ctx.from.id, { aeBack: `ae:pc:${catId}:${page}` });

  const rows = list.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map(p => [btn(short(ENT.p.label(p)), `ae:v:p:${p.id}`)]);
  if (pages > 1) rows.push(navRow(`ae:pc:${catId}`, page, pages));
  rows.push([btn('➕ Shu bo\'limga qo\'shish', catId === '_none' ? 'ae:n:p' : `ae:np:${catId}`)]);
  rows.push([btn('‹ Mahsulotlar', 'ae:l:p:0'), btn('🏠 Panel', 'ae:h')]);
  return show(ctx, `📁 ${mdBold(cat?.name || "Bo'limsiz")} · ${list.length} ta\n${LINE}\nTahrirlash uchun tanlang:`, rows);
}

// ─── KARTOCHKA ───────────────────────────────────────────────────────────────
async function showView(ctx, entKey, id, notice) {
  await ack(ctx);
  const e = ENT[entKey];
  const d = await rawDoc(entKey, id);
  if (!d) return show(ctx, '❗ Topilmadi (o\'chirilgan bo\'lishi mumkin).', [[btn('‹ Orqaga', `ae:l:${entKey}:0`)]]);

  let text = (notice ? `${notice}\n\n` : '') + `${e.icon} ${mdBold(e.label(entKey === 'p' ? (catalog.getProduct(id) || d) : d))}\n${LINE}\n`;
  for (const f of e.fields) text += `${esc(f.l)}: ${await fmtValue(f, d[f.k], d)}\n`;
  if (entKey === 'pr') text += `Ishlatilgan: *${d.usedCount || 0}* marta\n`;
  if (entKey === 'an') text += `Yuborilgan: ${d.sentToTelegram ? '✅ ha' : '⏳ navbatda'}\n`;

  const rows = [];
  const editBtns = e.fields.map((f, i) => f.t === 'bool'
    ? btn(`${(d[f.k] === f.on || (d[f.k] === undefined && f.def === f.on)) ? '⛔ ' : '✅ '}${f.l}`, `ae:t:${entKey}:${id}:${i}`)
    : btn(`✍ ${f.l}`, `ae:e:${entKey}:${id}:${i}`));
  for (let i = 0; i < editBtns.length; i += 2) rows.push(editBtns.slice(i, i + 2));
  rows.push([btn("🗑 O'chirish", `ae:d:${entKey}:${id}`)]);
  const back = entKey === 'p' ? (getSession(ctx.from.id).aeBack || `ae:pc:${d.category}:0`) : `ae:l:${entKey}:0`;
  rows.push([btn('‹ Orqaga', back), btn('🏠 Panel', 'ae:h')]);

  if (d.imageUrl && /^https?:\/\//.test(d.imageUrl) && text.length < 1000) {
    await ctx.deleteMessage?.().catch(() => { });
    try {
      return await ctx.replyWithPhoto(d.imageUrl, { caption: text, parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
    } catch { /* rasm ochilmasa — matn */ }
    return ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  }
  return show(ctx, text, rows);
}

// ─── TAHRIRLASH / QO'SHISH: maydon so'rash ───────────────────────────────────
function promptFor(f, mode) {
  const req = f.req ? '' : '';
  switch (f.t) {
    case 'image': return `🖼 *${esc(f.l)}* — rasm yuboring (yoki rasm havolasini yozing)`;
    case 'location': return `🏁 *${esc(f.l)}* — 📎 → Joylashuv orqali nuqtani yuboring`;
    case 'number': return `✍ *${esc(f.l)}* — raqam yozing${f.hint ? `\n_${esc(f.hint)}_` : ''}`;
    case 'date': return `📆 *${esc(f.l)}* — sanani yozing${f.hint ? `\n_${esc(f.hint)}_` : ''}`;
    case 'stock': return `🛍 *${esc(f.l)}* — ${esc(f.hint)}`;
    default: return `✍ *${esc(f.l)}* — yozib yuboring${f.hint ? `\n_${esc(f.hint)}_` : ''}${req}`;
  }
}

async function askField(ctx, st) {
  const e = ENT[st.ent];
  const f = e.fields[st.fi];
  const rows = [];

  if (f.t === 'select' || f.t === 'ref') {
    const opts = f.t === 'select' ? f.opts : await refOptions(f.ref);
    for (let i = 0; i < opts.length; i += 2) rows.push(opts.slice(i, i + 2).map(([v, l]) => btn(short(l, 30), `ae:pk:${v}`)));
  }
  if (st.mode === 'new' && !f.req) rows.push([btn("O'tkazib yuborish ›", 'ae:sk')]);
  if (st.mode === 'edit' && !f.req && f.t !== 'select') rows.push([btn('🧹 Tozalash', 'ae:clr')]);
  rows.push([btn('❗ Bekor qilish', 'ae:x')]);

  const step = st.mode === 'new' ? `➕ *Yangi ${e.one}* · ${st.step}/${st.total}\n${LINE}\n` : `✍ *Tahrirlash*\n${LINE}\n`;
  const cur = st.mode === 'edit' && !['select', 'ref'].includes(f.t)
    ? `\nHozirgi: ${await fmtValue(f, st.cur, st.doc)}\n` : '';
  const body = ['select', 'ref'].includes(f.t) ? `*${esc(f.l)}* — tanlang:` : promptFor(f);
  setSession(ctx.from.id, { step: 'ae', ae: st });
  return show(ctx, step + body + cur, rows);
}

function wizardFields(entKey) {
  return ENT[entKey].fields.map((f, i) => ({ f, i })).filter(x => x.f.wizard !== false);
}

async function startNew(ctx, entKey, preset = {}) {
  await ack(ctx);
  const wf = wizardFields(entKey).filter(x => preset[x.f.k] === undefined);
  return askField(ctx, { mode: 'new', ent: entKey, draft: { ...preset }, queue: wf.map(x => x.i), fi: wf[0].i, step: 1, total: wf.length });
}

async function startEdit(ctx, entKey, id, fi) {
  await ack(ctx);
  const d = await rawDoc(entKey, id);
  if (!d) return showView(ctx, entKey, id);
  const f = ENT[entKey].fields[fi];
  return askField(ctx, { mode: 'edit', ent: entKey, id, fi, cur: d[f.k], doc: d });
}

// ─── Kiritilgan qiymatni tekshirish ──────────────────────────────────────────
function parseNumber(s) {
  const n = Number(String(s).replace(/[\s']/g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
}
function parseDate(s) {
  const m = String(s).trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 23, 59, 59);
  return isNaN(d) ? null : d;
}

async function uploadImage(ctx, fileId, folder) {
  const axios = require('axios');
  const link = await ctx.telegram.getFileLink(fileId);
  const { data } = await axios.get(String(link), { responseType: 'arraybuffer', timeout: 30000 });
  const bucket = fb.getStorage().bucket();
  const token = crypto.randomUUID();
  const path = `${folder}/${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
  await bucket.file(path).save(Buffer.from(data), {
    resumable: false,
    metadata: { contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

// Matn / rasm / joylashuvdan qiymat olish. { ok, value } yoki { error }
async function readValue(ctx, f, st) {
  const m = ctx.message || {};
  const text = (m.text || '').trim();

  if (f.t === 'image') {
    const photo = m.photo?.[m.photo.length - 1];
    const doc = m.document?.mime_type?.startsWith('image/') ? m.document : null;
    if (photo || doc) {
      try {
        await ctx.reply('⏳ Rasm yuklanmoqda…');
        return { ok: true, value: await uploadImage(ctx, (photo || doc).file_id, ENT[st.ent].col) };
      } catch (e) {
        console.error('Rasm yuklash xatosi:', e.message);
        return { error: "Rasmni saqlab bo'lmadi (Firebase Storage). Rasm havolasini (https://…) yozib yuboring." };
      }
    }
    if (/^https?:\/\/\S+$/i.test(text)) return { ok: true, value: text };
    return { error: 'Rasm yoki https:// bilan boshlanadigan havola yuboring.' };
  }
  if (f.t === 'location') {
    if (m.location) return { ok: true, value: { lat: m.location.latitude, lng: m.location.longitude } };
    return { error: '📎 → Joylashuv orqali nuqta yuboring.' };
  }
  if (!text) return { error: 'Matn yozib yuboring.' };
  if (f.t === 'number') {
    const n = parseNumber(text);
    if (n === null || n < 0) return { error: 'Faqat musbat raqam yozing, masalan 125000' };
    return { ok: true, value: n };
  }
  if (f.t === 'stock') {
    if (text === '-') return { ok: true, value: {} };
    const n = parseNumber(text);
    if (n === null || n < 0 || !Number.isInteger(n)) return { error: 'Butun son yozing (masalan 120) yoki "-"' };
    const keys = Object.keys(st.doc?.stock || {});
    return { ok: true, value: { [keys[0] || 'main']: n } };
  }
  if (f.t === 'date') {
    const d = parseDate(text);
    if (!d) return { error: 'Sana formati: KK.OO.YYYY, masalan 31.12.2026' };
    return { ok: true, value: d };
  }
  if (f.t === 'select' || f.t === 'ref') return { error: 'Tugmalardan birini tanlang.' };
  const v = f.upper ? text.toUpperCase().replace(/\s+/g, '') : text;
  if (f.t === 'text' && v.length > 200) return { error: 'Juda uzun (200 belgigacha).' };
  return { ok: true, value: v };
}

// Qiymatni qabul qilish (matn, rasm, tanlov, tozalash)
async function acceptValue(ctx, value) {
  const s = getSession(ctx.from.id);
  const st = s.ae;
  if (!st) return;
  const e = ENT[st.ent];
  const f = e.fields[st.fi];

  // Promo-kod takrorlanmasin
  if (st.ent === 'pr' && f.k === 'code' && value) {
    const ex = await fb.queryDocs('promoCodes', 'code', '==', value);
    if (ex.some(x => x.id !== st.id)) return ctx.reply('❗ Bunday kod allaqachon bor. Boshqasini yozing.');
  }

  if (st.mode === 'edit') {
    const patch = { [f.k]: value === undefined ? require('firebase-admin').firestore.FieldValue.delete() : value };
    if (st.ent === 'w' && f.k === 'location' && value) Object.assign(patch, { lat: value.lat, lng: value.lng });
    await fb.updateDoc(e.col, st.id, patch);
    await fb.addLog('admin', `${e.one} tahrirlandi: ${st.id} · ${f.k}`, { by: ctx.from.id }).catch(() => { });
    setSession(ctx.from.id, { step: null, ae: null });
    await new Promise(r => setTimeout(r, 300)); // jonli katalog yangilanishi uchun
    return showView(ctx, st.ent, st.id, '✅ Saqlandi');
  }

  // Yangi: keyingi maydon
  if (value !== undefined) st.draft[f.k] = value;
  const idx = st.queue.indexOf(st.fi);
  const next = st.queue[idx + 1];
  if (next !== undefined) return askField(ctx, { ...st, fi: next, step: st.step + 1 });
  return saveNew(ctx, st);
}

async function saveNew(ctx, st) {
  const e = ENT[st.ent];
  const data = { ...(e.defaults || {}) };
  for (const f of e.fields) if (f.def !== undefined && data[f.k] === undefined) data[f.k] = f.def;
  Object.assign(data, st.draft);
  if (st.ent === 'w' && data.location) Object.assign(data, { lat: data.location.lat, lng: data.location.lng });
  if (st.ent === 'p' && data.currency) data.currency = String(data.currency).toUpperCase();
  const id = await fb.addDoc(e.col, data);
  await fb.addLog('admin', `Yangi ${e.one}: ${data.name || data.code || data.title || id}`, { by: ctx.from.id }).catch(() => { });
  setSession(ctx.from.id, { step: null, ae: null });
  await new Promise(r => setTimeout(r, 400));
  const note = st.ent === 'an' ? "✅ Saqlandi va mijozlarga yuborilmoqda" : `✅ Yangi ${e.one} qo'shildi`;
  return showView(ctx, st.ent, id, note);
}

// ─── Kirish nuqtalari ────────────────────────────────────────────────────────
// Matn / rasm / joylashuv (session.step === 'ae')
async function handleInput(ctx) {
  const s = getSession(ctx.from.id);
  if (s.step === 'ae_search') return doSearch(ctx);
  if (s.step === 'ae_broadcast') return doBroadcast(ctx);
  const st = s.ae;
  if (!st) { setSession(ctx.from.id, { step: null }); return; }
  const f = ENT[st.ent].fields[st.fi];
  const r = await readValue(ctx, f, st);
  if (r.error) return ctx.reply(`❗ ${r.error}`);
  return acceptValue(ctx, r.value);
}

async function toggle(ctx, entKey, id, fi) {
  const e = ENT[entKey];
  const f = e.fields[fi];
  const d = await rawDoc(entKey, id);
  if (!d) return ack(ctx, 'Topilmadi');
  const isOn = d[f.k] === f.on || (d[f.k] === undefined && f.def === f.on);
  await fb.updateDoc(e.col, id, { [f.k]: isOn ? f.off : f.on });
  await ack(ctx, isOn ? "⛔ O'chirildi" : '✅ Yoqildi');
  await new Promise(r => setTimeout(r, 300));
  return showView(ctx, entKey, id);
}

async function confirmDelete(ctx, entKey, id) {
  await ack(ctx);
  const e = ENT[entKey];
  if (entKey === 'c') {
    const n = catalog.allProducts().filter(p => p.category === id).length;
    if (n) return show(ctx, `❗ Bu bo'limda *${n}* ta mahsulot bor.\nAvval ularni boshqa bo'limga o'tkazing yoki o'chiring.`, [[btn('‹ Orqaga', `ae:v:c:${id}`)]]);
  }
  return show(ctx, `🗑 Rostdan ham bu ${e.one}ni o'chirasizmi?\n_Qaytarib bo'lmaydi._`, [
    [btn("Ha, o'chirish", `ae:dd:${entKey}:${id}`), btn('Yo\'q', `ae:v:${entKey}:${id}`)],
  ]);
}

async function doDelete(ctx, entKey, id) {
  const e = ENT[entKey];
  const d = await rawDoc(entKey, id);
  await fb.deleteDocById(e.col, id);
  if (entKey === 'p') catalog.removeLocal(id);
  await fb.addLog('admin', `${e.one} o'chirildi: ${d?.name || d?.code || d?.title || id}`, { by: ctx.from.id }).catch(() => { });
  await ack(ctx, "🗑 O'chirildi");
  await new Promise(r => setTimeout(r, 300));
  if (entKey === 'p' && d?.category) return showProductsInCat(ctx, d.category, 0);
  return showList(ctx, entKey, 0);
}

// ─── Qidiruv ─────────────────────────────────────────────────────────────────
async function startSearch(ctx, entKey) {
  await ack(ctx);
  setSession(ctx.from.id, { step: 'ae_search', aeSearch: entKey });
  return show(ctx, '🔎 Mahsulot nomi, brendi yoki artikulini yozing:', [[btn('❗ Bekor qilish', 'ae:x')]]);
}

async function doSearch(ctx) {
  const q = String(ctx.message?.text || '').toLowerCase().trim();
  setSession(ctx.from.id, { step: null });
  if (!q) return;
  const words = q.split(/\s+/);
  const found = catalog.allProducts().filter(p => {
    const hay = `${p.name || ''} ${p.brand || ''} ${p.sku || ''}`.toLowerCase();
    return words.every(w => hay.includes(w));
  }).slice(0, 20);
  const rows = found.map(p => [btn(short(ENT.p.label(p)), `ae:v:p:${p.id}`)]);
  rows.push([btn('🔎 Yana qidirish', 'ae:q:p'), btn('🏠 Panel', 'ae:h')]);
  setSession(ctx.from.id, { aeBack: 'ae:l:p:0' });
  return ctx.reply(found.length ? `🔎 Topildi: ${found.length}${found.length === 20 ? '+' : ''}` : '🔎 Hech narsa topilmadi.', Markup.inlineKeyboard(rows));
}

// ─── Ommaviy xabar ───────────────────────────────────────────────────────────
async function startBroadcast(ctx) {
  await ack(ctx);
  setSession(ctx.from.id, { step: 'ae_broadcast' });
  return show(ctx, "💬 *Barcha mijozlarga xabar*\n\nMatn, rasm yoki video yuboring — u qanday bo'lsa, shunday nusxa qilib yuboriladi.", [[btn('❗ Bekor qilish', 'ae:x')]]);
}

async function doBroadcast(ctx) {
  setSession(ctx.from.id, { step: null });
  const users = (await fb.getCollection('telegramUsers')).filter(u => u.telegramId && !u.isBlocked);
  await ctx.reply(`⏳ ${users.length} ta mijozga yuborilmoqda…`);
  let ok = 0, fail = 0;
  for (const u of users) {
    try { await ctx.telegram.copyMessage(u.telegramId, ctx.chat.id, ctx.message.message_id); ok++; } catch { fail++; }
    await new Promise(r => setTimeout(r, 40));
  }
  await fb.addLog('admin', `Ommaviy xabar: ✅${ok} ❌${fail}`, { by: ctx.from.id }).catch(() => { });
  return ctx.reply(`✅ Yuborildi: ${ok}\n❗ Yetmadi: ${fail}`, Markup.inlineKeyboard([[btn('🏠 Panel', 'ae:h')]]));
}

// ─── Callback yo'naltirish ───────────────────────────────────────────────────
async function handleCallback(ctx, data) {
  if (!isAdmin(ctx)) return ack(ctx, "Ruxsat yo'q");
  const p = data.split(':');
  const s = getSession(ctx.from.id);
  switch (p[1]) {
    case 'h': setSession(ctx.from.id, { step: null, ae: null }); return showHub(ctx);
    case 'l': return showList(ctx, p[2], parseInt(p[3]) || 0);
    case 'pc': return showProductsInCat(ctx, p[2], parseInt(p[3]) || 0);
    case 'v': return showView(ctx, p[2], p[3]);
    case 'e': return startEdit(ctx, p[2], p[3], parseInt(p[4]));
    case 't': return toggle(ctx, p[2], p[3], parseInt(p[4]));
    case 'n': return startNew(ctx, p[2]);
    case 'np': return startNew(ctx, 'p', { category: p[2] });
    case 'd': return confirmDelete(ctx, p[2], p[3]);
    case 'dd': return doDelete(ctx, p[2], p[3]);
    case 'q': return startSearch(ctx, p[2]);
    case 'bc': return startBroadcast(ctx);
    case 'pk': {
      await ack(ctx);
      if (!s.ae) return showHub(ctx);
      return acceptValue(ctx, p.slice(2).join(':'));
    }
    case 'sk': await ack(ctx); return s.ae ? acceptValue(ctx, undefined) : showHub(ctx);
    case 'clr': await ack(ctx); return s.ae ? acceptValue(ctx, undefined) : showHub(ctx);
    case 'x': {
      await ack(ctx, 'Bekor qilindi');
      const st = s.ae;
      setSession(ctx.from.id, { step: null, ae: null });
      if (st?.mode === 'edit') return showView(ctx, st.ent, st.id);
      if (st?.ent) return showList(ctx, st.ent, 0);
      return showHub(ctx);
    }
  }
  return ack(ctx);
}

module.exports = { showHub, handleCallback, handleInput, isAdmin };
