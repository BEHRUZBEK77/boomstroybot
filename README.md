# 🏗️ BoomStroy — Telegram Bot

Qurilish materiallari uchun ko'p tilli, professional Telegram savdo boti.
Firebase (Firestore) bilan ishlaydi, Railway / webhook yoki long-polling rejimida ishga tushadi.

🌐 Onlayn do'kon: **https://boomstroyshop.netlify.app**

---

## ✨ Asosiy imkoniyatlar

- **🌐 Ko'p tillilik (4 til, 100% tarjima qilingan)**
  - 🇺🇿 O'zbekcha (lotin)
  - 🇺🇿 Ўзбекча (кирилл)
  - 🇷🇺 Русский
  - 🇬🇧 English

  Foydalanuvchining tili `telegramUsers.lang` da saqlanadi, har bir xabar uchun
  Firestore o'qilmasligi uchun keshlanadi va `🌐 Til` menyusi yoki `/lang` orqali
  istalgan vaqt o'zgartiriladi.

- **🌐 "Bizning sayt"** — asosiy menyuning eng tepasida; onlayn do'konga havola.

- **🛍️ To'liq xarid oqimi** — katalog, qidiruv, savat, miqdor tanlagich,
  sevimlilar, oxirgi ko'rilganlar, mahsulot sharhlari va reytinglar.

- **📦 Buyurtmani olish turi**
  - 🚚 **Yetkazib berish** — GPS yoki matnli manzil, masofaga qarab avtomatik narx.
  - 🏪 **Borib olish (pickup)** — admin paneldagi **omborlardan** birini nomi bilan
    tanlab, **bepul** olib ketish.

- **🎁 Bonus va Sodiqlik tizimi**
  - **100 ball = 1 000 so'm** (1 ball = 10 so'm).
  - Har xariddan ball qaytimi (cashback), kunlik bonus, referal, promo-kodlar.
  - 🏆 5 darajali sodiqlik tizimi (Yangi → Bronza → Kumush → Oltin → Olmos).
  - **🎁 Sovg'alar do'koni** — ballarni admin panel orqali qo'shilgan
    **cheklangan mahsulotlarga** almashtirish.

- **🛡️ Barqarorlik** — har bir handler `try/catch` bilan himoyalangan, global
  `bot.catch`, rate-limiting, lazy Firebase init va xavfsiz fallback'lar.

- **👑 Admin** — dashboard, buyurtmalar, mijozlar, omborlar, statistika, broadcast,
  mijozlarga ularning tilida holat xabarnomalari.

---

## 🚀 Ishga tushirish

```bash
# 1. Bog'liqliklar
npm install

# 2. Muhitni sozlang
cp .env.example .env
#   .env ichidagi BOT_TOKEN, FIREBASE_*, ADMIN_TELEGRAM_ID ... ni to'ldiring

# 3. Lokal (long-polling)
npm run dev      # nodemon
npm start        # node

# Production (webhook): .env da NODE_ENV=production va WEBHOOK_URL ni bering
```

Node.js **18+** talab qilinadi.

---

## 🔧 Muhit o'zgaruvchilari

Barcha o'zgaruvchilar `.env.example` da izohlar bilan keltirilgan. Eng muhimlari:

| O'zgaruvchi | Tavsif |
|---|---|
| `BOT_TOKEN` | @BotFather bergan token |
| `ADMIN_TELEGRAM_ID` | Admin(lar) id si, vergul bilan |
| `FIREBASE_*` | Firebase service account ma'lumotlari |
| `SITE_URL` | Onlayn do'kon havolasi (sayt tugmasi) |
| `LOYALTY_POINT_VALUE` | 1 ball necha so'm (default `10`) |
| `LOYALTY_EARN_RATE` | Ball qaytimi koeffitsienti (default `0.002`) |
| `WAREHOUSE_*` | Asosiy ombor koordinatalari va nomi |

---

## 🗄️ Firestore kolleksiyalari

Bot quyidagi kolleksiyalar bilan ishlaydi (admin panel orqali boshqariladi):

| Kolleksiya | Vazifa |
|---|---|
| `products` | Mahsulotlar |
| `categories` | Kategoriyalar |
| `orders` | Buyurtmalar (`deliveryType: 'delivery' | 'pickup'`) |
| `telegramUsers` | Foydalanuvchilar (`lang`, `loyaltyPoints`, `favorites` ...) |
| `warehouses` | **Borib olish omborlari** — `{ name, address?, phone?, lat?, lng?, active? }` |
| `rewards` | **Sovg'alar do'koni** — `{ name, pointsCost, description?, stock?, imageUrl?, active? }` |
| `rewardRedemptions` | Ballga olingan sovg'a so'rovlari |
| `promoCodes` | Promo-kodlar |
| `reviews` | Mahsulot sharhlari |
| `supportTickets` | Murojaatlar |

### Borib olish omborlari (`warehouses`)
Har bir hujjat foydalanuvchiga ombor sifatida ko'rsatiladi. `active: false` bo'lsa
yashiriladi. Asosiy ombor (`WAREHOUSE_NAME`) ro'yxat boshida avtomatik qo'shiladi.

### Sovg'alar (`rewards`)
`pointsCost` — ball narxi. `stock` berilsa, har olishda 1 taga kamayadi va
tugaganda yashiriladi. Foydalanuvchi ballari yetsa "🎁 Sovg'ani olish" tugmasi chiqadi.

---

## 🧩 Loyiha tuzilmasi

```
src/
├── index.js                 # Bot, marshrutlash (ko'p tilli menyu + callbacklar)
├── middlewares/
│   ├── auth.js              # Rate-limit, bloklash, til keshi
│   └── subscription.js      # Kanal majburiy obuna
├── services/
│   ├── firebase.js          # Firestore CRUD
│   ├── delivery.js          # Masofa/narx, geokodlash, ombor
│   ├── session.js           # In-memory sessiyalar, savat
│   └── cron.js              # Rejalashtirilgan vazifalar
├── handlers/
│   ├── start.js             # /start, ro'yxat, welcome
│   ├── catalog.js           # Katalog, qidiruv
│   ├── cart.js              # Savat
│   ├── order.js             # Buyurtma + yetkazib berish/borib olish
│   ├── profile.js           # Profil, aloqa, sayt, yetkazib berish ma'lumoti
│   ├── loyalty.js           # Bonus, sovg'alar, referal, sharh, support, til
│   └── admin.js             # Admin panel
└── utils/
    ├── i18n.js              # 4 tilli tarjima tizimi (t, variantsOf)
    ├── keyboards.js         # Til-bog'liq tugmalar
    └── helpers.js           # Format, sodiqlik hisob-kitobi
```

---

## 🌍 Til qo'shish / tarjimani kengaytirish

Barcha matnlar `src/utils/i18n.js` dagi `T` obyektida `key: { uz, uz_cyrl, ru, en }`
ko'rinishida saqlanadi. Yangi matn qo'shish uchun shu yerga kalit qo'shing va
handlerda `t(lang, 'kalit', { o'zgaruvchilar })` deb chaqiring. Menyu tugmalari
uchun `variantsOf('kalit')` barcha tillardagi variantlarni `bot.hears` ga beradi.
