// ════════════════════════════════════════════════════════════════════════════
// Telegram "Markdown" (v1) → { text, entities } konvertori
//   Premium (custom) emoji'ni xabar matniga qo'shish uchun parse_mode o'rniga
//   entities ishlatish kerak (ikkalasini aralashtirib bo'lmaydi). Shu sababli
//   Markdown'ni o'zimiz tahlil qilamiz. Qo'shimcha foyda: yopilmagan belgilar
//   Telegram'dagidek xato bermaydi — oddiy matn sifatida qoladi.
// ════════════════════════════════════════════════════════════════════════════

const MARKS = { '*': 'bold', '_': 'italic' };

// i dan keyin escape qilinmagan ch belgisini qidiradi
function findClose(src, ch, from) {
  for (let j = from; j < src.length; j++) {
    if (src[j] === '\\' && j + 1 < src.length) { j++; continue; }
    if (src[j] === ch) return j;
    if (src[j] === '\n' && ch !== '`') { /* Markdown v1 qator oxirigacha */ }
  }
  return -1;
}

function parseMarkdownV1(src) {
  let out = '';
  const entities = [];
  const open = {}; // type -> start offset

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (c === '\\' && i + 1 < src.length && '_*`['.includes(src[i + 1])) {
      out += src[i + 1]; i++; continue;
    }

    if (c === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i) {
        const code = src.slice(i + 1, end);
        if (code.length) entities.push({ type: 'code', offset: out.length, length: code.length });
        out += code; i = end; continue;
      }
    }

    if (c === '[') {
      const close = findClose(src, ']', i + 1);
      if (close > i && src[close + 1] === '(') {
        const urlEnd = src.indexOf(')', close + 2);
        if (urlEnd > close) {
          const label = src.slice(i + 1, close).replace(/\\([_*`[])/g, '$1');
          const url = src.slice(close + 2, urlEnd);
          if (label.length && /^(https?:\/\/|tg:\/\/)/i.test(url)) {
            entities.push({ type: 'text_link', offset: out.length, length: label.length, url });
          }
          out += label; i = urlEnd; continue;
        }
      }
    }

    if (MARKS[c]) {
      const type = MARKS[c];
      if (open[type] !== undefined) {
        const start = open[type];
        if (out.length > start) entities.push({ type, offset: start, length: out.length - start });
        delete open[type];
        continue;
      }
      if (findClose(src, c, i + 1) > i) { open[type] = out.length; continue; }
    }

    out += c;
  }
  entities.sort((a, b) => a.offset - b.offset || b.length - a.length);
  return { text: out, entities };
}

// Matndagi oddiy emojilarga premium emoji entity'larini qo'shadi
function addCustomEmoji(text, entities, map) {
  const keys = Object.keys(map || {});
  if (!keys.length || !text) return entities;
  const code = (entities || []).filter(e => e.type === 'code' || e.type === 'pre');
  const inCode = (pos) => code.some(e => pos >= e.offset && pos < e.offset + e.length);

  const found = [];
  for (const key of keys) {
    for (const variant of [key + '️', key]) {
      let from = 0, idx;
      while ((idx = text.indexOf(variant, from)) !== -1) {
        from = idx + variant.length;
        if (inCode(idx)) continue;
        if (found.some(f => idx < f.offset + f.length && f.offset < idx + variant.length)) continue;
        found.push({ type: 'custom_emoji', offset: idx, length: variant.length, custom_emoji_id: map[key] });
      }
    }
  }
  if (!found.length) return entities;
  const all = [...(entities || []), ...found.slice(0, 100)];
  all.sort((a, b) => a.offset - b.offset || b.length - a.length);
  return all;
}

module.exports = { parseMarkdownV1, addCustomEmoji };
