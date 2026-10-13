// Ishga tushishda ma'lumotlar tuzilishini logga yozadi (faqat maydon nomlari/turlari va sonlar).
const { getDb } = require('./firebase');

function shape(obj) {
  return Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => {
    let type = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
    if (v && typeof v === 'object' && v.toDate) type = 'timestamp';
    let sample = '';
    if (['category', 'categoryId', 'categoryName', 'status', 'active', 'stock', 'quantity', 'qty', 'inStock', 'unit', 'isActive', 'visible', 'price'].includes(k)) {
      sample = JSON.stringify(v).slice(0, 80);
    }
    return [k, sample ? `${type}=${sample}` : type];
  }));
}

async function diagnoseData() {
  try {
    const db = getDb();
    const [cats, prods] = await Promise.all([db.collection('categories').get(), db.collection('products').get()]);
    console.log(`🔎 DIAG categories=${cats.size} products=${prods.size}`);
    cats.docs.slice(0, 3).forEach(d => console.log('🔎 DIAG cat', d.id, JSON.stringify(shape(d.data()))));
    prods.docs.slice(0, 4).forEach(d => console.log('🔎 DIAG prod', d.id, JSON.stringify(shape(d.data()))));
    const catIds = new Set(cats.docs.map(d => d.id));
    const catNames = new Set(cats.docs.map(d => d.data().name));
    let byId = 0, byName = 0, other = 0;
    prods.docs.forEach(d => {
      const c = d.data().category;
      if (catIds.has(c)) byId++; else if (catNames.has(c)) byName++; else other++;
    });
    console.log(`🔎 DIAG product.category match: byId=${byId} byName=${byName} none=${other}`);
  } catch (e) {
    console.error('🔎 DIAG xato:', e.message);
  }
}

module.exports = { diagnoseData };
