// ════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL: boshqariladigan bo'limlar ta'rifi
//   Har bir bo'lim uchun Firestore kolleksiyasi va maydonlar ro'yxati beriladi —
//   ro'yxat, ko'rish, qo'shish, tahrirlash va o'chirish shu ta'rif asosida
//   avtomatik ishlaydi (admin/panel.js).
//
// Maydon turlari:
//   text, longtext, number, date (KK.OO.YYYY), image (rasm yoki havola),
//   select (opts), ref (boshqa bo'limdan tanlash), bool (yoqish/o'chirish),
//   stock (zaxira soni yoki "-" = yuritilmaydi), location (xaritadagi nuqta)
// ════════════════════════════════════════════════════════════════════════════
const { fmtNum } = require('../utils/helpers');

const ENT = {
  p: {
    col: 'products', title: 'Mahsulotlar', one: 'mahsulot', icon: '🛍',
    fields: [
      { k: 'name', l: 'Nomi', t: 'text', req: true },
      { k: 'category', l: "Bo'lim", t: 'ref', ref: 'c', req: true },
      { k: 'price', l: 'Narxi', t: 'number', req: true, hint: 'Faqat raqam: 125000 yoki 2.5' },
      { k: 'currency', l: 'Valyuta', t: 'select', opts: [['UZS', "so'm"], ['USD', 'dollar ($)']], def: 'UZS' },
      { k: 'unit', l: "O'lchov birligi", t: 'text', def: 'dona', hint: 'dona, kg, m, m², qop, list…' },
      { k: 'stock', l: 'Zaxira', t: 'stock', hint: 'Son yozing (masalan 120). "-" — zaxira yuritilmaydi, doim sotuvda' },
      { k: 'brand', l: 'Brend', t: 'text' },
      { k: 'sku', l: 'Artikul (SKU)', t: 'text' },
      { k: 'description', l: 'Tavsif', t: 'longtext' },
      { k: 'imageUrl', l: 'Rasm', t: 'image' },
      { k: 'status', l: 'Sotuvda', t: 'bool', on: 'active', off: 'inactive', def: 'active', wizard: false },
    ],
    defaults: { stock: {}, minQuantity: 5, status: 'active', cost: 0, currency: 'UZS', unit: 'dona' },
    // Ro'yxat jonli katalogdan olinadi — narx u yerda har doim so'mda
    label: (d) => `${d.status === 'inactive' ? '⛔ ' : ''}${d.name || '—'} · ${fmtNum(d.price)} so'm`,
    sort: (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'uz'),
  },
  c: {
    col: 'categories', title: "Bo'limlar", one: "bo'lim", icon: '📁',
    fields: [
      { k: 'name', l: 'Nomi', t: 'text', req: true },
      { k: 'icon', l: 'Belgi (emoji)', t: 'text', hint: 'Bitta emoji, masalan 🚿' },
      { k: 'description', l: 'Tavsif', t: 'longtext' },
      { k: 'imageUrl', l: 'Rasm', t: 'image' },
      { k: 'hidden', l: 'Botda ko\'rinadi', t: 'bool', on: false, off: true, def: false, wizard: false },
    ],
    label: (d) => `${d.hidden ? '⛔ ' : ''}${d.name || '—'}`,
    sort: (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'uz'),
  },
  w: {
    col: 'warehouses', title: 'Omborlar', one: 'ombor', icon: '🏛',
    fields: [
      { k: 'name', l: 'Nomi', t: 'text', req: true },
      { k: 'address', l: 'Manzil', t: 'text' },
      { k: 'phone', l: 'Telefon', t: 'text' },
      { k: 'location', l: 'Xaritadagi joyi', t: 'location' },
      { k: 'active', l: 'Faol (olib ketish mumkin)', t: 'bool', on: true, off: false, def: true, wizard: false },
    ],
    defaults: { active: true, pickup: true },
    label: (d) => `${d.active === false ? '⛔ ' : ''}${d.name || '—'}`,
  },
  pr: {
    col: 'promoCodes', title: 'Promo-kodlar', one: 'promo-kod', icon: '🎟',
    fields: [
      { k: 'code', l: 'Kod', t: 'text', req: true, upper: true, hint: 'Masalan: YANGI10' },
      { k: 'type', l: 'Chegirma turi', t: 'select', opts: [['percent', 'Foiz (%)'], ['fixed', "Summa (so'm)"]], def: 'percent', req: true },
      { k: 'value', l: 'Chegirma miqdori', t: 'number', req: true, hint: 'Foiz uchun 10, summa uchun 50000' },
      { k: 'maxUses', l: 'Necha marta ishlatish mumkin', t: 'number', hint: 'Bo\'sh — cheklovsiz' },
      { k: 'expiresAt', l: 'Amal qilish muddati', t: 'date', hint: 'KK.OO.YYYY, masalan 31.12.2026' },
      { k: 'active', l: 'Faol', t: 'bool', on: true, off: false, def: true, wizard: false },
    ],
    defaults: { active: true, usedCount: 0, usedBy: [] },
    label: (d) => `${d.active === false ? '⛔ ' : ''}${d.code} · ${d.type === 'fixed' ? fmtNum(d.value) + " so'm" : (d.value || 0) + '%'} · ${d.usedCount || 0}${d.maxUses ? '/' + d.maxUses : ''}`,
  },
  rw: {
    col: 'rewards', title: "Sovg'alar (ball evaziga)", one: "sovg'a", icon: '💎',
    fields: [
      { k: 'name', l: 'Nomi', t: 'text', req: true },
      { k: 'pointsCost', l: 'Narxi (ball)', t: 'number', req: true },
      { k: 'description', l: 'Tavsif', t: 'longtext' },
      { k: 'stock', l: 'Soni', t: 'number', hint: 'Bo\'sh — cheklovsiz' },
      { k: 'imageUrl', l: 'Rasm', t: 'image' },
      { k: 'active', l: 'Faol', t: 'bool', on: true, off: false, def: true, wizard: false },
    ],
    defaults: { active: true },
    label: (d) => `${d.active === false ? '⛔ ' : ''}${d.name} · ${fmtNum(d.pointsCost)} ball`,
    sort: (a, b) => (a.pointsCost || 0) - (b.pointsCost || 0),
  },
  an: {
    col: 'announcements', title: "E'lonlar va aksiyalar", one: "e'lon", icon: '📣',
    note: "Yangi e'lon saqlangan zahoti barcha mijozlarga yuboriladi.",
    fields: [
      { k: 'title', l: 'Sarlavha', t: 'text' },
      { k: 'text', l: 'Matn', t: 'longtext', req: true },
      { k: 'imageUrl', l: 'Rasm', t: 'image' },
      { k: 'type', l: 'Turi', t: 'select', opts: [['promo', 'Aksiya'], ['info', 'Yangilik']], def: 'promo' },
    ],
    defaults: { active: true },
    label: (d) => `${d.sentToTelegram ? '✅ ' : '⏳ '}${d.title || String(d.text || '').slice(0, 30) || '—'}`,
    sort: (a, b) => (b.createdAt?.seconds || b.createdAt?._seconds || 0) - (a.createdAt?.seconds || a.createdAt?._seconds || 0),
  },
};

module.exports = { ENT };
