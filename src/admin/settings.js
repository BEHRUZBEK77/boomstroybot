// ════════════════════════════════════════════════════════════════════════════
// ADMIN: Sozlamalar va bot matnlari
//   as:h               sozlamalar bosh sahifasi
//   as:g:<group>       guruh (aloqa, to'lov, yetkazish, narx, bonus)
//   as:e:<key>         qiymatni o'zgartirish     as:r:<key>   standartga qaytarish
//   as:tx              matnlar ro'yxati           as:tl:<key>  tilni tanlash
//   as:te:<key>:<lang> matnni o'zgartirish        as:tr:<key>:<lang> standartga qaytarish
// ════════════════════════════════════════════════════════════════════════════
const { Markup } = require('telegraf');
const cfg = require('../services/config');
const { setSession, getSession } = require('../services/session');
const { escapeMarkdown, fmtNum } = require('../utils/helpers');

const LINE = '━━━━━━━━━━━━━━━━';
const btn = Markup.button.callback;
const esc = (s) => escapeMarkdown(String(s ?? ''));
const ack = (ctx, t) => ctx.callbackQuery ? ctx.answerCbQuery(t).catch(() => { }) : null;

const GROUPS = {
  contact: '📞 Aloqa ma\'lumotlari',
  payment: "💸 To'lov (karta)",
  delivery: '🚗 Yetkazib berish narxlari',
  price: '💰 Dollar kursi',
  loyalty: '💎 Bonus tizimi',
};
const LANGS = { uz: "O'zbekcha", uz_cyrl: 'Ўзбекча', ru: 'Русский', en: 'English' };

async function show(ctx, text, rows) {
  const extra = { parse_mode: 'Markdown', disable_web_page_preview: true, ...Markup.inlineKeyboard(rows) };
  const msg = ctx.callbackQuery?.message;
  if (msg && !msg.photo && msg.caption === undefined) {
    try { return await ctx.editMessageText(text, extra); } catch { }
  } else if (msg) await ctx.deleteMessage().catch(() => { });
  return ctx.reply(text, extra);
}

function fmtVal(key) {
  const f = cfg.CONFIG_FIELDS[key];
  const v = cfg.get(key);
  const src = { panel: '', env: ' _(Railway)_', standart: ' _(standart)_' }[cfg.source(key)];
  if (key === 'usdRate' && !(Number(v) > 0)) {
    const { rateInfo } = require('../services/currency');
    const r = rateInfo();
    return `Markaziy bank: *${r.rate ? fmtNum(r.rate) : '—'}* so'm`;
  }
  return `*${esc(f.type === 'number' ? Number(v).toLocaleString('ru-RU') : v)}*${src}`;
}

async function showHome(ctx) {
  await ack(ctx);
  const rows = Object.entries(GROUPS).map(([g, l]) => [btn(l, `as:g:${g}`)]);
  rows.push([btn('✍ Bot matnlari', 'as:tx')]);
  rows.push([btn('✨ Premium emoji', 'as:emoji'), btn('🎨 Stikerlar', 'as:stk')]);
  rows.push([btn('🏠 Panel', 'ae:h')]);
  return show(ctx, `💻 *Sozlamalar*\n${LINE}\nO'zgarishlar darhol kuchga kiradi — qayta ishga tushirish shart emas.`, rows);
}

async function showGroup(ctx, g) {
  await ack(ctx);
  const keys = Object.keys(cfg.CONFIG_FIELDS).filter(k => cfg.CONFIG_FIELDS[k].group === g);
  let text = `${GROUPS[g]}\n${LINE}\n`;
  for (const k of keys) text += `${esc(cfg.CONFIG_FIELDS[k].label)}: ${fmtVal(k)}\n`;
  const rows = keys.map(k => [btn(`✍ ${cfg.CONFIG_FIELDS[k].label}`, `as:e:${k}`)]);
  rows.push([btn('‹ Sozlamalar', 'as:h')]);
  return show(ctx, text, rows);
}

async function startEdit(ctx, key) {
  await ack(ctx);
  const f = cfg.CONFIG_FIELDS[key];
  setSession(ctx.from.id, { step: 'as_input', asInput: { key } });
  const hint = key === 'usdRate' ? "\n_0 yozsangiz — Markaziy bank kursi avtomatik ishlatiladi._" : '';
  return show(ctx, `✍ *${esc(f.label)}*\nHozirgi: ${fmtVal(key)}\n\nYangi qiymatni yozing:${hint}`, [
    [btn('↺ Standartga qaytarish', `as:r:${key}`)],
    [btn('❗ Bekor qilish', `as:g:${f.group}`)],
  ]);
}

async function resetKey(ctx, key) {
  setSession(ctx.from.id, { step: null, asInput: null });
  await cfg.setConfig(key, null);
  await ack(ctx, '↺ Qaytarildi');
  return showGroup(ctx, cfg.CONFIG_FIELDS[key].group);
}

// ─── Bot matnlari ────────────────────────────────────────────────────────────
async function showTexts(ctx) {
  await ack(ctx);
  const rows = Object.entries(cfg.EDITABLE_TEXTS).map(([k, l]) => [btn(l, `as:tl:${k}`)]);
  rows.push([btn('‹ Sozlamalar', 'as:h')]);
  return show(ctx, `✍ *Bot matnlari*\n${LINE}\nQaysi matnni o'zgartirasiz?`, rows);
}

async function showTextLangs(ctx, key) {
  await ack(ctx);
  const rows = Object.entries(LANGS).map(([l, n]) => [btn(`${cfg.textOverride(key, l) ? '✍ ' : ''}${n}`, `as:te:${key}:${l}`)]);
  rows.push([btn('‹ Matnlar', 'as:tx')]);
  return show(ctx, `✍ *${esc(cfg.EDITABLE_TEXTS[key])}*\nTilni tanlang (✍ — o'zgartirilgan):`, rows);
}

async function startTextEdit(ctx, key, lang) {
  await ack(ctx);
  const { T } = require('../utils/i18n');
  const cur = cfg.textOverride(key, lang) || T[key]?.[lang] || '';
  setSession(ctx.from.id, { step: 'as_input', asInput: { key, lang, text: true } });
  // Joriy matnni nusxa olish oson bo'lishi uchun kod blokida ko'rsatamiz
  const vars = (cur.match(/\{[a-z]+\}/gi) || []).filter((v, i, a) => a.indexOf(v) === i).join(' ');
  return show(ctx,
    `✍ *${esc(cfg.EDITABLE_TEXTS[key])}* · ${LANGS[lang]}\n${LINE}\n` +
    `Hozirgi matn (bosib nusxa oling):\n\`\`\`\n${cur.replace(/`/g, "'").slice(0, 3000)}\n\`\`\`\n` +
    `Yangi matnni yuboring. *qalin*, _kursiv_ ishlatish mumkin.` +
    (vars ? `\nAvtomatik qo'yiladigan qiymatlar: ${esc(vars)}` : ''),
    [[btn('↺ Standart matnga qaytarish', `as:tr:${key}:${lang}`)], [btn('❗ Bekor qilish', `as:tl:${key}`)]]);
}

async function resetText(ctx, key, lang) {
  setSession(ctx.from.id, { step: null, asInput: null });
  await cfg.setText(key, lang, null);
  await ack(ctx, '↺ Qaytarildi');
  return showTextLangs(ctx, key);
}

async function handleInput(ctx) {
  const s = getSession(ctx.from.id);
  const inp = s.asInput || {};
  const text = String(ctx.message?.text || '').trim();
  if (!text) return ctx.reply('❗ Matn yozib yuboring.');

  if (inp.text) {
    // Telegram'da Markdown buzilmasligini tekshiramiz
    try {
      await ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (e) {
      return ctx.reply("❗ Matnda formatlash xatosi bor (yopilmagan * yoki _). Tuzatib qayta yuboring.");
    }
    setSession(ctx.from.id, { step: null, asInput: null });
    await cfg.setText(inp.key, inp.lang, text);
    await ctx.reply('✅ Matn saqlandi — yuqorida ko\'rinishi.');
    return showTextLangs(ctx, inp.key);
  }

  const f = cfg.CONFIG_FIELDS[inp.key];
  if (!f) { setSession(ctx.from.id, { step: null }); return; }
  let value = text;
  if (f.type === 'number') {
    value = Number(text.replace(/[\s']/g, '').replace(',', '.'));
    if (!isFinite(value) || value < 0) return ctx.reply('❗ Faqat musbat raqam yozing.');
  }
  setSession(ctx.from.id, { step: null, asInput: null });
  await cfg.setConfig(inp.key, value);
  await require('../services/firebase').addLog('admin', `Sozlama: ${inp.key} = ${value}`, { by: ctx.from.id }).catch(() => { });
  if (inp.key === 'usdRate' || inp.key === 'usdRateMarkup') {
    await require('../services/currency').refreshRate();
  }
  await ctx.reply(`✅ Saqlandi: ${f.label}`);
  return showGroup(ctx, f.group);
}

async function handleCallback(ctx, data) {
  if (!ctx.state?.isAdmin) return ack(ctx, "Ruxsat yo'q");
  const p = data.split(':');
  switch (p[1]) {
    case 'h': setSession(ctx.from.id, { step: null, asInput: null }); return showHome(ctx);
    case 'g': setSession(ctx.from.id, { step: null, asInput: null }); return showGroup(ctx, p[2]);
    case 'e': return startEdit(ctx, p[2]);
    case 'r': return resetKey(ctx, p[2]);
    case 'tx': return showTexts(ctx);
    case 'tl': setSession(ctx.from.id, { step: null, asInput: null }); return showTextLangs(ctx, p[2]);
    case 'te': return startTextEdit(ctx, p[2], p[3]);
    case 'tr': return resetText(ctx, p[2], p[3]);
    case 'emoji': await ack(ctx); return require('../handlers/premiumAdmin').handleEmojiCommand(ctx);
    case 'stk': await ack(ctx); return require('../handlers/premiumAdmin').handleStickerCommand(ctx);
  }
  return ack(ctx);
}

module.exports = { handleCallback, handleInput, showHome };
