// ════════════════════════════════════════════════════════════════════════════
// SOZLAMALAR (admin paneldan o'zgartiriladi)
//   Firestore: settings/config — raqamli va matnli sozlamalar
//              settings/texts  — bot matnlari ustidan yozish { key: { uz, ru, ... } }
//   Ikkalasi ham onSnapshot orqali jonli: admin o'zgartirsa darhol kuchga kiradi.
//   Qiymat bazada bo'lmasa — Railway Variables (env) dan, u ham bo'lmasa — standart.
// ════════════════════════════════════════════════════════════════════════════

// key → { env, def, type, label, group }
const CONFIG_FIELDS = {
  supportPhone:    { env: 'SUPPORT_PHONE', def: '+998 94 217 10 10', type: 'text', label: 'Aloqa telefoni', group: 'contact' },
  supportUsername: { env: 'SUPPORT_USERNAME', def: '@boomstroy_support', type: 'text', label: 'Yordam Telegram', group: 'contact' },
  supportEmail:    { env: 'SUPPORT_EMAIL', def: 'info@boomstroy.uz', type: 'text', label: 'Email', group: 'contact' },
  siteUrl:         { env: 'SITE_URL', def: 'https://boomstroyshop.netlify.app', type: 'text', label: 'Sayt manzili', group: 'contact' },
  cardNumber:      { env: 'CARD_NUMBER', def: '8600000000000000', type: 'text', label: 'Karta raqami', group: 'payment' },
  cardOwner:       { env: 'CARD_OWNER', def: 'BoomStroy LLC', type: 'text', label: 'Karta egasi', group: 'payment' },
  baseDeliveryFee: { env: 'BASE_DELIVERY_FEE', def: 10000, type: 'number', label: 'Yetkazish: boshlang\'ich narx (so\'m)', group: 'delivery' },
  deliveryPerKm:   { env: 'DELIVERY_PER_KM', def: 2000, type: 'number', label: 'Yetkazish: 1 km narxi (so\'m)', group: 'delivery' },
  maxDeliveryKm:   { env: 'MAX_DELIVERY_KM', def: 50, type: 'number', label: 'Yetkazish: maksimal masofa (km)', group: 'delivery' },
  usdRate:         { env: 'USD_RATE', def: 0, type: 'number', label: 'Dollar kursi (0 = Markaziy bank)', group: 'price' },
  usdRateMarkup:   { env: 'USD_RATE_MARKUP', def: 0, type: 'number', label: 'Kursga ustama (%)', group: 'price' },
  loyaltyPointValue: { env: 'LOYALTY_POINT_VALUE', def: 10, type: 'number', label: '1 ball qiymati (so\'m)', group: 'loyalty' },
  loyaltyEarnRate: { env: 'LOYALTY_EARN_RATE', def: 0.002, type: 'number', label: 'Xariddan ball ulushi (0.002 = 0.2%)', group: 'loyalty' },
};

// Admin tahrirlay oladigan bot matnlari
const EDITABLE_TEXTS = {
  welcome: 'Salomlashish (/start)',
  aboutInfo: 'Biz haqimizda',
  contactInfo: 'Aloqa',
  salesInfo: 'Aksiyalar',
  help: 'Yordam (/help)',
};

let config = {};
let texts = {};
const listeners = new Set();

function get(key) {
  const f = CONFIG_FIELDS[key];
  if (!f) return undefined;
  const v = config[key];
  if (v !== undefined && v !== null && v !== '') return f.type === 'number' ? Number(v) : v;
  const env = process.env[f.env];
  if (env !== undefined && env !== '') return f.type === 'number' ? Number(env) : env;
  return f.def;
}

function source(key) {
  const f = CONFIG_FIELDS[key];
  if (config[key] !== undefined && config[key] !== null && config[key] !== '') return 'panel';
  if (process.env[f.env]) return 'env';
  return 'standart';
}

function textOverride(key, lang) {
  const o = texts[key];
  if (!o) return null;
  return o[lang] || null;
}

function onChange(fn) { listeners.add(fn); }

function docRef(id) {
  const { getDb } = require('./firebase');
  return getDb().collection('settings').doc(id);
}

async function setConfig(key, value) {
  await docRef('config').set({ [key]: value, updatedAt: new Date() }, { merge: true });
  config[key] = value;
  listeners.forEach(fn => { try { fn(key); } catch { } });
}

async function setText(key, lang, value) {
  const cur = { ...(texts[key] || {}) };
  if (value === null) delete cur[lang]; else cur[lang] = value;
  texts[key] = cur;
  await docRef('texts').set({ [key]: cur, updatedAt: new Date() }, { merge: true });
}

function startConfig() {
  const watch = (id, apply) => {
    let attempt = 0;
    const sub = () => {
      const unsub = docRef(id).onSnapshot(
        (doc) => { attempt = 0; apply(doc.exists ? doc.data() : {}); },
        (err) => {
          attempt++;
          console.error(`settings/${id} onSnapshot xato:`, err.message);
          try { unsub(); } catch { }
          setTimeout(sub, Math.min(300000, 5000 * 2 ** Math.min(attempt, 6)));
        }
      );
    };
    sub();
  };
  watch('config', (d) => {
    const { updatedAt, ...rest } = d;
    const changed = Object.keys({ ...config, ...rest }).filter(k => config[k] !== rest[k]);
    config = rest;
    changed.forEach(k => listeners.forEach(fn => { try { fn(k); } catch { } }));
  });
  watch('texts', (d) => { const { updatedAt, ...rest } = d; texts = rest; });
}

module.exports = {
  CONFIG_FIELDS, EDITABLE_TEXTS,
  get, source, textOverride, setConfig, setText, startConfig, onChange,
};
