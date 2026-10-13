// Botdagi tugma va matnlarda ishlatiladigan bosh emojilar ro'yxati (admin uchun maslahat)
const { T } = require('../utils/i18n');
const { splitLeadingEmoji, baseEmoji } = require('../utils/premium');

const counts = new Map();
for (const entry of Object.values(T)) {
  const [e] = splitLeadingEmoji(entry.uz || '');
  if (e) counts.set(baseEmoji(e), (counts.get(baseEmoji(e)) || 0) + 1);
}
const T_KEYS_EMOJIS = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);

module.exports = { T_KEYS_EMOJIS };
