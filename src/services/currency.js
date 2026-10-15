// ════════════════════════════════════════════════════════════════════════════
// VALYUTA KURSI (USD → UZS)
//   Bazada narxlarning bir qismi dollarda (currency: 'USD'). Mijozga hammasi
//   so'mda ko'rsatiladi. Kurs O'zbekiston Markaziy banki (cbu.uz) dan olinadi,
//   har 6 soatda yangilanadi va Firestore `settings/exchangeRate` da saqlanadi.
//
//   Qo'lda belgilash: Railway Variables → USD_RATE=12800 (CBU dan ustun turadi)
//   Ustama:           USD_RATE_MARKUP=1.5  (CBU kursiga +1.5% qo'shadi)
// ════════════════════════════════════════════════════════════════════════════
const axios = require('axios');

let rate = null;
let source = null;
let updatedAt = null;
const cfg = () => require('./config');
const manualRate = () => Number(cfg().get('usdRate')) || 0;
const listeners = new Set();

function getUsdRate() { return rate; }
function rateInfo() { return { rate, source, updatedAt }; }
function onRateChange(fn) { listeners.add(fn); }

function setRate(r, src) {
  if (!r || !isFinite(r) || r < 1000) return;
  const changed = Math.round(r) !== Math.round(rate || 0);
  rate = r; source = src; updatedAt = new Date();
  if (changed) {
    console.log(`💱 USD kursi: ${rate.toFixed(2)} so'm (${src})`);
    listeners.forEach(fn => { try { fn(rate); } catch { } });
  }
}

async function fetchCbuRate() {
  const { data } = await axios.get('https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/', { timeout: 10000 });
  const r = parseFloat(String(data?.[0]?.Rate || '').replace(',', '.'));
  if (!r) throw new Error('CBU javobida kurs yo\'q');
  const markup = Number(cfg().get('usdRateMarkup')) || 0;
  return r * (1 + markup / 100);
}

async function refreshRate() {
  if (manualRate() > 0) { setRate(manualRate(), 'qo\'lda (admin)'); return; }
  const { getDb } = require('./firebase');
  try {
    const r = await fetchCbuRate();
    setRate(r, 'cbu.uz');
    getDb().collection('settings').doc('exchangeRate')
      .set({ usd: r, source: 'cbu.uz', updatedAt: new Date() }, { merge: true }).catch(() => { });
  } catch (e) {
    console.error('💱 CBU kursini olib bo\'lmadi:', e.message);
    if (!rate) {
      // Oxirgi saqlangan kurs
      try {
        const doc = await getDb().collection('settings').doc('exchangeRate').get();
        if (doc.exists && doc.data().usd) setRate(Number(doc.data().usd), 'saqlangan');
      } catch { }
    }
  }
}

async function startCurrency() {
  // Admin kurs yoki ustamani o'zgartirsa — darhol qayta hisoblaymiz
  cfg().onChange((k) => { if (k === 'usdRate' || k === 'usdRateMarkup') refreshRate(); });
  await refreshRate();
  if (!rate) {
    // Hech qanday kurs yo'q — xavfsiz zaxira qiymat, logda ogohlantiramiz
    setRate(12800, 'standart (CBU ishlamadi)');
    console.warn('⚠️ USD kursi standart qiymatda. Railway Variables da USD_RATE ni belgilang.');
  }
  setInterval(refreshRate, 6 * 60 * 60 * 1000).unref();
}

// Narxni so'mga o'giradi. Natija 100 so'mga yaxlitlanadi (USD uchun).
function toUZS(price, currency) {
  const n = Number(price) || 0;
  const cur = String(currency || 'UZS').toUpperCase();
  if (cur === 'USD' || cur === '$') {
    const r = rate || 12800;
    return Math.round((n * r) / 100) * 100;
  }
  return Math.round(n);
}

module.exports = { startCurrency, refreshRate, getUsdRate, rateInfo, onRateChange, toUZS };
