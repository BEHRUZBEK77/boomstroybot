// ════════════════════════════════════════════════════════════════════════════
// i18n — Ko'p tillilik tizimi (4 til)
//   uz       — O'zbekcha (lotin)
//   uz_cyrl  — Ўзбекча (кирилл)
//   ru       — Русский
//   en       — English
//
// Foydalanish: const { t } = require('./i18n'); t(lang, 'key', { name: 'Ali' })
// ════════════════════════════════════════════════════════════════════════════

const LANGS = ['uz', 'uz_cyrl', 'ru', 'en'];
const DEFAULT_LANG = 'uz';

// Rasmiy veb-sayt
const SITE_URL = process.env.SITE_URL || 'https://boomstroyshop.netlify.app';

// Tilni normallashtirish (eski qiymatlar ham ishlashi uchun)
function normalizeLang(lang) {
  if (!lang) return DEFAULT_LANG;
  const l = String(lang).toLowerCase();
  if (l === 'uz' || l === 'uz_latn' || l === 'uz-latn') return 'uz';
  if (l === 'uz_cyrl' || l === 'uz-cyrl' || l === 'uzc' || l === 'cyrl') return 'uz_cyrl';
  if (l === 'ru' || l === 'rus') return 'ru';
  if (l === 'en' || l === 'eng') return 'en';
  return DEFAULT_LANG;
}

// ─── TARJIMALAR ──────────────────────────────────────────────────────────────
const T = {
  // ── UMUMIY ──
  back:          { uz: '🔙 Orqaga', uz_cyrl: '🔙 Орқага', ru: '🔙 Назад', en: '🔙 Back' },
  cancel:        { uz: '❌ Bekor qilish', uz_cyrl: '❌ Бекор қилиш', ru: '❌ Отмена', en: '❌ Cancel' },
  mainMenuBtn:   { uz: '🏠 Bosh menyu', uz_cyrl: '🏠 Бош меню', ru: '🏠 Главное меню', en: '🏠 Main menu' },
  mainMenuTitle: { uz: 'Bosh menyu:', uz_cyrl: 'Бош меню:', ru: 'Главное меню:', en: 'Main menu:' },
  som:           { uz: "so'm", uz_cyrl: 'сўм', ru: 'сум', en: 'UZS' },
  pcs:           { uz: 'dona', uz_cyrl: 'дона', ru: 'шт', en: 'pcs' },
  checking:      { uz: '⏳ Tekshirilmoqda...', uz_cyrl: '⏳ Текширилмоқда...', ru: '⏳ Проверяется...', en: '⏳ Checking...' },
  error:         { uz: "❌ Xatolik yuz berdi. Iltimos qayta urinib ko'ring.", uz_cyrl: '❌ Хатолик юз берди. Илтимос қайта уриниб кўринг.', ru: '❌ Произошла ошибка. Пожалуйста, попробуйте снова.', en: '❌ An error occurred. Please try again.' },
  errorShort:    { uz: '❌ Xatolik yuz berdi', uz_cyrl: '❌ Хатолик юз берди', ru: '❌ Произошла ошибка', en: '❌ An error occurred' },
  pressStart:    { uz: 'Avval /start bosing.', uz_cyrl: 'Аввал /start босинг.', ru: 'Сначала нажмите /start.', en: 'Please press /start first.' },
  noAccess:      { uz: "❌ Ruxsat yo'q.", uz_cyrl: '❌ Рухсат йўқ.', ru: '❌ Нет доступа.', en: '❌ Access denied.' },
  notFound:      { uz: '❌ Topilmadi.', uz_cyrl: '❌ Топилмади.', ru: '❌ Не найдено.', en: '❌ Not found.' },
  done:          { uz: '✅ Bajarildi', uz_cyrl: '✅ Бажарилди', ru: '✅ Готово', en: '✅ Done' },
  yes:           { uz: '✅ Ha', uz_cyrl: '✅ Ҳа', ru: '✅ Да', en: '✅ Yes' },
  no:            { uz: "❌ Yo'q", uz_cyrl: '❌ Йўқ', ru: '❌ Нет', en: '❌ No' },

  // ── ASOSIY MENYU TUGMALARI (reply keyboard) ──
  m_website:   { uz: '🌐 Bizning sayt', uz_cyrl: '🌐 Бизнинг сайт', ru: '🌐 Наш сайт', en: '🌐 Our website' },
  m_products:  { uz: '🛍️ Mahsulotlar', uz_cyrl: '🛍️ Маҳсулотлар', ru: '🛍️ Товары', en: '🛍️ Products' },
  m_cart:      { uz: '🛒 Savat', uz_cyrl: '🛒 Сават', ru: '🛒 Корзина', en: '🛒 Cart' },
  m_orders:    { uz: '📋 Buyurtmalarim', uz_cyrl: '📋 Буюртмаларим', ru: '📋 Мои заказы', en: '📋 My orders' },
  m_profile:   { uz: '👤 Profilim', uz_cyrl: '👤 Профилим', ru: '👤 Профиль', en: '👤 Profile' },
  m_favorites: { uz: '❤️ Sevimlilar', uz_cyrl: '❤️ Севимлилар', ru: '❤️ Избранное', en: '❤️ Favorites' },
  m_loyalty:   { uz: '🎁 Bonus va Sodiqlik', uz_cyrl: '🎁 Бонус ва Содиқлик', ru: '🎁 Бонусы и Лояльность', en: '🎁 Bonus & Loyalty' },
  m_delivery:  { uz: '📍 Yetkazib berish', uz_cyrl: '📍 Етказиб бериш', ru: '📍 Доставка', en: '📍 Delivery' },
  m_contact:   { uz: '📞 Aloqa', uz_cyrl: '📞 Алоқа', ru: '📞 Контакты', en: '📞 Contact' },
  m_about:     { uz: 'ℹ️ Haqida', uz_cyrl: 'ℹ️ Ҳақида', ru: 'ℹ️ О нас', en: 'ℹ️ About' },
  m_sales:     { uz: '⭐ Aksiyalar', uz_cyrl: '⭐ Акциялар', ru: '⭐ Акции', en: '⭐ Promotions' },
  m_language:  { uz: '🌐 Til', uz_cyrl: '🌐 Тил', ru: '🌐 Язык', en: '🌐 Language' },
  m_pickup:    { uz: '🏪 Borib olish', uz_cyrl: '🏪 Бориб олиш', ru: '🏪 Самовывоз', en: '🏪 Pickup' },

  // ── BORIB OLISH MANZILLARI ──
  pickupInfoTitle: {
    uz: "🏪 *Borib olish — manzillarimiz*\n\nBuyurtmangizni quyidagi omborlarimizdan bemalol kelib olib ketishingiz mumkin (bepul):\n",
    uz_cyrl: '🏪 *Бориб олиш — манзилларимиз*\n\nБуюртмангизни қуйидаги омборларимиздан бемалол келиб олиб кетишингиз мумкин (бепул):\n',
    ru: '🏪 *Самовывоз — наши адреса*\n\nВы можете свободно забрать свой заказ с наших складов (бесплатно):\n',
    en: '🏪 *Pickup — our locations*\n\nYou can freely collect your order from our warehouses (free):\n',
  },
  pickupInfoItem: { uz: '\n🏭 *{name}*\n{addr}{phone}', uz_cyrl: '\n🏭 *{name}*\n{addr}{phone}', ru: '\n🏭 *{name}*\n{addr}{phone}', en: '\n🏭 *{name}*\n{addr}{phone}' },
  pickupInfoFooter: {
    uz: "\n\n_⏰ Ish vaqti: Du–Sh 09:00–18:00, Yak 10:00–15:00. Bemalol keling!_",
    uz_cyrl: '\n\n_⏰ Иш вақти: Ду–Ш 09:00–18:00, Як 10:00–15:00. Бемалол келинг!_',
    ru: '\n\n_⏰ Часы работы: Пн–Сб 09:00–18:00, Вс 10:00–15:00. Добро пожаловать!_',
    en: '\n\n_⏰ Hours: Mon–Sat 09:00–18:00, Sun 10:00–15:00. Welcome!_',
  },
  pickupInfoEmpty: {
    uz: "🏪 Hozircha borib olish manzillari qo'shilmagan.\n\nTez orada qo'shiladi yoki yetkazib berish xizmatidan foydalaning.",
    uz_cyrl: '🏪 Ҳозирча бориб олиш манзиллари қўшилмаган.\n\nТез орада қўшилади ёки етказиб бериш хизматидан фойдаланинг.',
    ru: '🏪 Адреса самовывоза пока не добавлены.\n\nСкоро добавим или воспользуйтесь доставкой.',
    en: '🏪 No pickup locations added yet.\n\nComing soon, or use the delivery service.',
  },

  // ── ADMIN MENYU TUGMALARI ──
  am_dashboard:  { uz: '📊 Dashboard', uz_cyrl: '📊 Дашборд', ru: '📊 Панель', en: '📊 Dashboard' },
  am_products:   { uz: '📦 Mahsulotlar', uz_cyrl: '📦 Маҳсулотлар', ru: '📦 Товары', en: '📦 Products' },
  am_orders:     { uz: '📋 Buyurtmalar', uz_cyrl: '📋 Буюртмалар', ru: '📋 Заказы', en: '📋 Orders' },
  am_customers:  { uz: '👥 Mijozlar', uz_cyrl: '👥 Мижозлар', ru: '👥 Клиенты', en: '👥 Customers' },
  am_warehouses: { uz: '🏭 Omborlar', uz_cyrl: '🏭 Омборлар', ru: '🏭 Склады', en: '🏭 Warehouses' },
  am_stats:      { uz: '📈 Statistika', uz_cyrl: '📈 Статистика', ru: '📈 Статистика', en: '📈 Statistics' },
  am_broadcast:  { uz: '💬 Xabar yuborish', uz_cyrl: '💬 Хабар юбориш', ru: '💬 Рассылка', en: '💬 Broadcast' },
  am_settings:   { uz: '⚙️ Sozlamalar', uz_cyrl: '⚙️ Созламалар', ru: '⚙️ Настройки', en: '⚙️ Settings' },
  am_userMenu:   { uz: '🔙 Foydalanuvchi menyu', uz_cyrl: '🔙 Фойдаланувчи меню', ru: '🔙 Меню клиента', en: '🔙 User menu' },

  // ── VEB-SAYT ──
  websiteTitle: {
    uz: '🌐 *BoomStroy onlayn do\'koni*\n\nBarcha mahsulotlarni qulay katalogda ko\'ring va onlayn xarid qiling:',
    uz_cyrl: '🌐 *BoomStroy онлайн дўкони*\n\nБарча маҳсулотларни қулай каталогда кўринг ва онлайн харид қилинг:',
    ru: '🌐 *Интернет-магазин BoomStroy*\n\nСмотрите все товары в удобном каталоге и покупайте онлайн:',
    en: '🌐 *BoomStroy online store*\n\nBrowse all products in a convenient catalog and shop online:',
  },
  websiteBtn: { uz: '🌐 Saytni ochish', uz_cyrl: '🌐 Сайтни очиш', ru: '🌐 Открыть сайт', en: '🌐 Open website' },

  // ── TIL TANLASH ──
  chooseLang: {
    uz: '🌐 Tilni tanlang:',
    uz_cyrl: '🌐 Тилни танланг:',
    ru: '🌐 Выберите язык:',
    en: '🌐 Choose your language:',
  },
  langSet: {
    uz: '✅ Til o\'zbekchaga (lotin) o\'zgartirildi.',
    uz_cyrl: '✅ Тил ўзбекчага (кирилл) ўзгартирилди.',
    ru: '✅ Язык изменён на русский.',
    en: '✅ Language switched to English.',
  },

  // ── OBUNA (subscription) ──
  subPrompt: {
    uz: `🏗️ *BoomStroy — Qurilish Materiallari*\n\nAssalomu alaykum! 👋\n\n🔔 Botdan foydalanish uchun avval rasmiy kanalimizga a'zo bo'lishingiz kerak!\n\n📢 Kanalimizda:\n• 🏷️ Eng yangi narxlar va aksiyalar\n• 📦 Yangi mahsulotlar haqida xabarlar\n• 🎁 Maxsus chegirmalar va takliflar\n\n👇 Kanalga a'zo bo'ling va tugmani bosing:`,
    uz_cyrl: `🏗️ *BoomStroy — Қурилиш Материаллари*\n\nАссалому алайкум! 👋\n\n🔔 Ботдан фойдаланиш учун аввал расмий каналимизга аъзо бўлишингиз керак!\n\n📢 Каналимизда:\n• 🏷️ Энг янги нархлар ва акциялар\n• 📦 Янги маҳсулотлар ҳақида хабарлар\n• 🎁 Махсус чегирмалар ва таклифлар\n\n👇 Каналга аъзо бўлинг ва тугмани босинг:`,
    ru: `🏗️ *BoomStroy — Строительные материалы*\n\nЗдравствуйте! 👋\n\n🔔 Чтобы пользоваться ботом, сначала подпишитесь на наш официальный канал!\n\n📢 На канале:\n• 🏷️ Самые свежие цены и акции\n• 📦 Новости о новых товарах\n• 🎁 Специальные скидки и предложения\n\n👇 Подпишитесь на канал и нажмите кнопку:`,
    en: `🏗️ *BoomStroy — Construction Materials*\n\nHello! 👋\n\n🔔 To use the bot, please subscribe to our official channel first!\n\n📢 On our channel:\n• 🏷️ Latest prices and promotions\n• 📦 News about new products\n• 🎁 Special discounts and offers\n\n👇 Subscribe to the channel and press the button:`,
  },
  subBtnJoin:   { uz: "📢 Kanalga A'zo Bo'lish", uz_cyrl: '📢 Каналга Аъзо Бўлиш', ru: '📢 Подписаться на канал', en: '📢 Join channel' },
  subBtnCheck:  { uz: "✅ A'zo Bo'ldim — Tekshirish", uz_cyrl: '✅ Аъзо Бўлдим — Текшириш', ru: '✅ Я подписался — Проверить', en: "✅ I subscribed — Check" },
  subBtnRecheck:{ uz: '🔄 Qayta Tekshirish', uz_cyrl: '🔄 Қайта Текшириш', ru: '🔄 Проверить снова', en: '🔄 Check again' },
  subBtnGoto:   { uz: "📢 Kanalga O'tish", uz_cyrl: '📢 Каналга Ўтиш', ru: '📢 Перейти на канал', en: '📢 Go to channel' },
  subChecking:  { uz: 'Tekshirilmoqda...', uz_cyrl: 'Текширилмоқда...', ru: 'Проверяется...', en: 'Checking...' },
  subNotYet: {
    uz: `❌ *Siz hali kanalga a'zo bo'lmadingiz!*\n\nIltimos, avval a'zo bo'ling, keyin qayta tekshiring. 👇`,
    uz_cyrl: `❌ *Сиз ҳали каналга аъзо бўлмадингиз!*\n\nИлтимос, аввал аъзо бўлинг, кейин қайта текширинг. 👇`,
    ru: `❌ *Вы ещё не подписаны на канал!*\n\nПожалуйста, сначала подпишитесь, затем проверьте снова. 👇`,
    en: `❌ *You haven't subscribed to the channel yet!*\n\nPlease subscribe first, then check again. 👇`,
  },

  // ── START / WELCOME ──
  adminWelcome: {
    uz: `👑 *Admin Paneliga Xush Kelibsiz!*\n\nSalom, *{name}*! 🎉\nBoomStroy boshqaruv tizimi tayyor.`,
    uz_cyrl: `👑 *Админ Панелига Хуш Келибсиз!*\n\nСалом, *{name}*! 🎉\nBoomStroy бошқарув тизими тайёр.`,
    ru: `👑 *Добро пожаловать в Админ-панель!*\n\nЗдравствуйте, *{name}*! 🎉\nСистема управления BoomStroy готова.`,
    en: `👑 *Welcome to the Admin Panel!*\n\nHello, *{name}*! 🎉\nThe BoomStroy management system is ready.`,
  },
  askPhone: {
    uz: `🏗️ *BoomStroy — Qurilish Materiallari*\n\nXush kelibsiz, *{name}*! 🎉\n\n━━━━━━━━━━━━━━━━━━━━\n📱 Davom etish uchun telefon raqamingizni ulashing.\nBu bir martadan so'raladi va buyurtma berishni osonlashtiradi 🔐`,
    uz_cyrl: `🏗️ *BoomStroy — Қурилиш Материаллари*\n\nХуш келибсиз, *{name}*! 🎉\n\n━━━━━━━━━━━━━━━━━━━━\n📱 Давом этиш учун телефон рақамингизни улашинг.\nБу бир мартадан сўралади ва буюртма беришни осонлаштиради 🔐`,
    ru: `🏗️ *BoomStroy — Строительные материалы*\n\nДобро пожаловать, *{name}*! 🎉\n\n━━━━━━━━━━━━━━━━━━━━\n📱 Чтобы продолжить, поделитесь номером телефона.\nЭто спросят один раз и упростит оформление заказов 🔐`,
    en: `🏗️ *BoomStroy — Construction Materials*\n\nWelcome, *{name}*! 🎉\n\n━━━━━━━━━━━━━━━━━━━━\n📱 To continue, please share your phone number.\nThis is asked once and makes ordering easier 🔐`,
  },
  dearCustomer: { uz: 'hurmatli mijoz', uz_cyrl: 'ҳурматли мижоз', ru: 'уважаемый клиент', en: 'dear customer' },
  registered: {
    uz: `✅ *Muvaffaqiyatli ro'yxatdan o'tdingiz!* 🎉`,
    uz_cyrl: `✅ *Муваффақиятли рўйхатдан ўтдингиз!* 🎉`,
    ru: `✅ *Вы успешно зарегистрировались!* 🎉`,
    en: `✅ *You have successfully registered!* 🎉`,
  },
  subSuccess: {
    uz: `✅ *Ajoyib! Kanalga a'zo bo'ldingiz!*\n\nEndi telefon raqamingizni ulashing 📱`,
    uz_cyrl: `✅ *Ажойиб! Каналга аъзо бўлдингиз!*\n\nЭнди телефон рақамингизни улашинг 📱`,
    ru: `✅ *Отлично! Вы подписались на канал!*\n\nТеперь поделитесь номером телефона 📱`,
    en: `✅ *Great! You've subscribed to the channel!*\n\nNow share your phone number 📱`,
  },
  sharePhoneHint: {
    uz: 'Iltimos, raqamingizni yuborish uchun tugmani bosing. 📱',
    uz_cyrl: 'Илтимос, рақамингизни юбориш учун тугмани босинг. 📱',
    ru: 'Пожалуйста, нажмите кнопку, чтобы отправить номер. 📱',
    en: 'Please press the button to share your number. 📱',
  },
  welcome: {
    uz: `🏗️ *BoomStroy — Qurilish Materiallari*\n\nXush kelibsiz, *{name}*! 👋\n\n━━━━━━━━━━━━━━━━━━━━\n🏙️ Toshkent va atroflarga yetkazib berish\n⚡ Tez va ishonchli yetkazish xizmati\n💎 Faqat sifatli va original mahsulotlar\n💰 Bozordagi eng raqobatbardosh narxlar\n🎁 Har xariddan bonus ball to'plang!\n🏪 Borib olish — omborlarimizdan bepul\n📞 Qo'llab-quvvatlash: {phone}\n🌐 Sayt: {site}\n\n━━━━━━━━━━━━━━━━━━━━\n👇 Kerakli bo'limni tanlang:`,
    uz_cyrl: `🏗️ *BoomStroy — Қурилиш Материаллари*\n\nХуш келибсиз, *{name}*! 👋\n\n━━━━━━━━━━━━━━━━━━━━\n🏙️ Тошкент ва атрофларга етказиб бериш\n⚡ Тез ва ишончли етказиш хизмати\n💎 Фақат сифатли ва оригинал маҳсулотлар\n💰 Бозордаги энг рақобатбардош нархлар\n🎁 Ҳар хариддан бонус балл тўпланг!\n🏪 Бориб олиш — омборларимиздан бепул\n📞 Қўллаб-қувватлаш: {phone}\n🌐 Сайт: {site}\n\n━━━━━━━━━━━━━━━━━━━━\n👇 Керакли бўлимни танланг:`,
    ru: `🏗️ *BoomStroy — Строительные материалы*\n\nДобро пожаловать, *{name}*! 👋\n\n━━━━━━━━━━━━━━━━━━━━\n🏙️ Доставка по Ташкенту и окрестностям\n⚡ Быстрая и надёжная доставка\n💎 Только качественные и оригинальные товары\n💰 Самые конкурентные цены на рынке\n🎁 Копите бонусные баллы с каждой покупки!\n🏪 Самовывоз — с наших складов бесплатно\n📞 Поддержка: {phone}\n🌐 Сайт: {site}\n\n━━━━━━━━━━━━━━━━━━━━\n👇 Выберите нужный раздел:`,
    en: `🏗️ *BoomStroy — Construction Materials*\n\nWelcome, *{name}*! 👋\n\n━━━━━━━━━━━━━━━━━━━━\n🏙️ Delivery across Tashkent and surroundings\n⚡ Fast and reliable delivery service\n💎 Only quality and original products\n💰 The most competitive prices on the market\n🎁 Earn bonus points with every purchase!\n🏪 Pickup — free from our warehouses\n📞 Support: {phone}\n🌐 Website: {site}\n\n━━━━━━━━━━━━━━━━━━━━\n👇 Choose a section:`,
  },
  help: {
    uz: `ℹ️ *BoomStroy Bot — Yordam*\n\n━━━━━━━━━━━━━━━━━━━━\n🌐 *Bizning sayt* — Onlayn katalog\n🛍️ *Mahsulotlar* — Katalogni ko'rish\n🛒 *Savat* — Tanlangan mahsulotlar\n📋 *Buyurtmalarim* — Buyurtma tarixi\n👤 *Profilim* — Shaxsiy ma'lumotlar\n❤️ *Sevimlilar* — Yoqtirgan mahsulotlar\n🎁 *Bonus va Sodiqlik* — Ball va sovg'alar\n📍 *Yetkazib berish* — Narx va shartlar\n📞 *Aloqa* — Bog'lanish\n\n━━━━━━━━━━━━━━━━━━━━\n📌 Buyruqlar: /faq /referral /bonus /support /lang /recent\n\n📞 Savol uchun: {phone}\n🌐 Sayt: {site}`,
    uz_cyrl: `ℹ️ *BoomStroy Бот — Ёрдам*\n\n━━━━━━━━━━━━━━━━━━━━\n🌐 *Бизнинг сайт* — Онлайн каталог\n🛍️ *Маҳсулотлар* — Каталогни кўриш\n🛒 *Сават* — Танланган маҳсулотлар\n📋 *Буюртмаларим* — Буюртма тарихи\n👤 *Профилим* — Шахсий маълумотлар\n❤️ *Севимлилар* — Ёқтирган маҳсулотлар\n🎁 *Бонус ва Содиқлик* — Балл ва совғалар\n📍 *Етказиб бериш* — Нарх ва шартлар\n📞 *Алоқа* — Боғланиш\n\n━━━━━━━━━━━━━━━━━━━━\n📌 Буйруқлар: /faq /referral /bonus /support /lang /recent\n\n📞 Савол учун: {phone}\n🌐 Сайт: {site}`,
    ru: `ℹ️ *BoomStroy Бот — Помощь*\n\n━━━━━━━━━━━━━━━━━━━━\n🌐 *Наш сайт* — Онлайн-каталог\n🛍️ *Товары* — Просмотр каталога\n🛒 *Корзина* — Выбранные товары\n📋 *Мои заказы* — История заказов\n👤 *Профиль* — Личные данные\n❤️ *Избранное* — Понравившиеся товары\n🎁 *Бонусы и Лояльность* — Баллы и подарки\n📍 *Доставка* — Цены и условия\n📞 *Контакты* — Связаться\n\n━━━━━━━━━━━━━━━━━━━━\n📌 Команды: /faq /referral /bonus /support /lang /recent\n\n📞 Вопросы: {phone}\n🌐 Сайт: {site}`,
    en: `ℹ️ *BoomStroy Bot — Help*\n\n━━━━━━━━━━━━━━━━━━━━\n🌐 *Our website* — Online catalog\n🛍️ *Products* — Browse the catalog\n🛒 *Cart* — Selected products\n📋 *My orders* — Order history\n👤 *Profile* — Personal information\n❤️ *Favorites* — Liked products\n🎁 *Bonus & Loyalty* — Points and rewards\n📍 *Delivery* — Prices and terms\n📞 *Contact* — Get in touch\n\n━━━━━━━━━━━━━━━━━━━━\n📌 Commands: /faq /referral /bonus /support /lang /recent\n\n📞 Questions: {phone}\n🌐 Website: {site}`,
  },

  // ── KATALOG ──
  noProductsYet: { uz: "📦 Hozircha mahsulotlar yo'q. Tez orada qo'shiladi!", uz_cyrl: '📦 Ҳозирча маҳсулотлар йўқ. Тез орада қўшилади!', ru: '📦 Пока товаров нет. Скоро добавим!', en: '📦 No products yet. Coming soon!' },
  catTitle: { uz: `📂 *Kategoriyalar*\n\nQaysi bo'limni ko'rmoqchisiz?`, uz_cyrl: `📂 *Категориялар*\n\nҚайси бўлимни кўрмоқчисиз?`, ru: `📂 *Категории*\n\nКакой раздел хотите посмотреть?`, en: `📂 *Categories*\n\nWhich section would you like to see?` },
  catEmpty: { uz: 'Hozircha mahsulotlar mavjud emas.', uz_cyrl: 'Ҳозирча маҳсулотлар мавжуд эмас.', ru: 'Пока нет доступных товаров.', en: 'No products available yet.' },
  catProductsCount: { uz: '{n} ta mahsulot', uz_cyrl: '{n} та маҳсулот', ru: '{n} товаров', en: '{n} products' },
  chooseProduct: { uz: 'Mahsulot tanlang:', uz_cyrl: 'Маҳсулот танланг:', ru: 'Выберите товар:', en: 'Choose a product:' },
  productNotFound: { uz: '❌ Mahsulot topilmadi.', uz_cyrl: '❌ Маҳсулот топилмади.', ru: '❌ Товар не найден.', en: '❌ Product not found.' },
  category: { uz: 'Kategoriya', uz_cyrl: 'Категория', ru: 'Категория', en: 'Category' },
  price: { uz: 'Narx', uz_cyrl: 'Нарх', ru: 'Цена', en: 'Price' },
  brand: { uz: 'Brend', uz_cyrl: 'Бренд', ru: 'Бренд', en: 'Brand' },
  available: { uz: 'Mavjud', uz_cyrl: 'Мавжуд', ru: 'В наличии', en: 'In stock' },
  reviewsWord: { uz: 'sharh', uz_cyrl: 'шарҳ', ru: 'отзыв(ов)', en: 'reviews' },
  inYourCart: { uz: 'Savatingizda', uz_cyrl: 'Саватингизда', ru: 'В корзине', en: 'In your cart' },
  soldOut: { uz: "❌ Sotib bo'lingan", uz_cyrl: '❌ Сотиб бўлинган', ru: '❌ Распродано', en: '❌ Sold out' },
  detailInfo: { uz: "📋 *Batafsil ma'lumot*", uz_cyrl: '📋 *Батафсил маълумот*', ru: '📋 *Подробная информация*', en: '📋 *Detailed information*' },
  name: { uz: 'Nomi', uz_cyrl: 'Номи', ru: 'Название', en: 'Name' },
  unit: { uz: "O'lchov", uz_cyrl: 'Ўлчов', ru: 'Ед. изм.', en: 'Unit' },
  specs: { uz: 'Xususiyatlar', uz_cyrl: 'Хусусиятлар', ru: 'Характеристики', en: 'Specifications' },
  description: { uz: 'Tavsif', uz_cyrl: 'Тавсиф', ru: 'Описание', en: 'Description' },
  searchPrompt: { uz: '🔍 Mahsulot nomini yozing:', uz_cyrl: '🔍 Маҳсулот номини ёзинг:', ru: '🔍 Введите название товара:', en: '🔍 Type a product name:' },
  searchNoResult: { uz: `🔍 "{q}" bo'yicha hech narsa topilmadi.`, uz_cyrl: `🔍 "{q}" бўйича ҳеч нарса топилмади.`, ru: `🔍 По запросу "{q}" ничего не найдено.`, en: `🔍 Nothing found for "{q}".` },
  searchResults: { uz: `🔍 *"{q}"* bo'yicha {n} ta natija:`, uz_cyrl: `🔍 *"{q}"* бўйича {n} та натижа:`, ru: `🔍 По запросу *"{q}"* найдено {n}:`, en: `🔍 {n} results for *"{q}"*:` },
  searchMore: { uz: `... va yana {n} ta natija. Qidiruvni aniqlashtiring.`, uz_cyrl: `... ва яна {n} та натижа. Қидирувни аниқлаштиринг.`, ru: `... и ещё {n} результатов. Уточните поиск.`, en: `... and {n} more. Refine your search.` },

  // ── KATALOG TUGMALARI ──
  btnAdd: { uz: "🛒 Qo'shish", uz_cyrl: '🛒 Қўшиш', ru: '🛒 В корзину', en: '🛒 Add' },
  btnInCartQty: { uz: '🛒 {n} ta', uz_cyrl: '🛒 {n} та', ru: '🛒 {n} шт', en: '🛒 {n} pcs' },
  btnDetail: { uz: 'ℹ️ Batafsil', uz_cyrl: 'ℹ️ Батафсил', ru: 'ℹ️ Подробнее', en: 'ℹ️ Details' },
  btnRate: { uz: '⭐ Baholash', uz_cyrl: '⭐ Баҳолаш', ru: '⭐ Оценить', en: '⭐ Rate' },
  btnFavAdd: { uz: "❤️ Sevimlilarga qo'shish", uz_cyrl: '❤️ Севимлиларга қўшиш', ru: '❤️ В избранное', en: '❤️ Add to favorites' },
  btnFavRemove: { uz: '💔 Sevimlilardan olib tashlash', uz_cyrl: '💔 Севимлилардан олиб ташлаш', ru: '💔 Убрать из избранного', en: '💔 Remove from favorites' },
  btnNotifyStock: { uz: '🔔 Kelganda xabar bering', uz_cyrl: '🔔 Келганда хабар беринг', ru: '🔔 Сообщить о поступлении', en: '🔔 Notify when in stock' },
  btnCategories: { uz: '🔙 Kategoriyalar', uz_cyrl: '🔙 Категориялар', ru: '🔙 Категории', en: '🔙 Categories' },
  btnCart: { uz: '🛒 Savat', uz_cyrl: '🛒 Сават', ru: '🛒 Корзина', en: '🛒 Cart' },

  // ── SAVAT ──
  cartEmpty: { uz: `🛒 Savatingiz bo'sh.\n\nMahsulotlar bo'limiga o'ting va tanlang!`, uz_cyrl: `🛒 Саватингиз бўш.\n\nМаҳсулотлар бўлимига ўтинг ва танланг!`, ru: `🛒 Ваша корзина пуста.\n\nПерейдите в раздел товаров и выберите!`, en: `🛒 Your cart is empty.\n\nGo to the products section and choose!` },
  cartTitle: { uz: '🛒 *Savatingiz:*', uz_cyrl: '🛒 *Саватингиз:*', ru: '🛒 *Ваша корзина:*', en: '🛒 *Your cart:*' },
  cartTotal: { uz: 'Jami', uz_cyrl: 'Жами', ru: 'Итого', en: 'Total' },
  cartDeliverySeparate: { uz: '_(yetkazib berish alohida)_', uz_cyrl: '_(етказиб бериш алоҳида)_', ru: '_(доставка отдельно)_', en: '_(delivery separate)_' },
  cartAdded: { uz: "✅ Savatga qo'shildi", uz_cyrl: '✅ Саватга қўшилди', ru: '✅ Добавлено в корзину', en: '✅ Added to cart' },
  cartNotEnough: { uz: '❌ Yetarli miqdor mavjud emas!', uz_cyrl: '❌ Етарли миқдор мавжуд эмас!', ru: '❌ Недостаточно товара!', en: '❌ Not enough stock!' },
  cartItemRemoved: { uz: 'Savatdan olib tashlandi', uz_cyrl: 'Саватдан олиб ташланди', ru: 'Удалено из корзины', en: 'Removed from cart' },
  cartNotInCart: { uz: "Savatingizda bu mahsulot yo'q", uz_cyrl: 'Саватингизда бу маҳсулот йўқ', ru: 'Этого товара нет в корзине', en: 'This item is not in your cart' },
  cartCleared: { uz: '🗑️ Savat tozalandi.', uz_cyrl: '🗑️ Сават тозаланди.', ru: '🗑️ Корзина очищена.', en: '🗑️ Cart cleared.' },
  btnCheckout: { uz: '✅ Buyurtma berish', uz_cyrl: '✅ Буюртма бериш', ru: '✅ Оформить заказ', en: '✅ Checkout' },
  btnClear: { uz: '🗑️ Tozalash', uz_cyrl: '🗑️ Тозалаш', ru: '🗑️ Очистить', en: '🗑️ Clear' },
  btnContinue: { uz: '🛍️ Davom etish', uz_cyrl: '🛍️ Давом этиш', ru: '🛍️ Продолжить', en: '🛍️ Continue' },
  btnBackToProducts: { uz: '🛍️ Mahsulotlarga qaytish', uz_cyrl: '🛍️ Маҳсулотларга қайтиш', ru: '🛍️ Вернуться к товарам', en: '🛍️ Back to products' },
  btnProducts: { uz: '🛍️ Mahsulotlar', uz_cyrl: '🛍️ Маҳсулотлар', ru: '🛍️ Товары', en: '🛍️ Products' },

  // ── BUYURTMA (order) ──
  cartEmptyFirst: { uz: "🛒 Savat bo'sh! Avval mahsulot tanlang.", uz_cyrl: '🛒 Сават бўш! Аввал маҳсулот танланг.', ru: '🛒 Корзина пуста! Сначала выберите товар.', en: '🛒 Cart is empty! Choose a product first.' },
  chooseReceiveType: {
    uz: `{summary}\n\n📦 *Buyurtmani qanday olasiz?*\n\n🚚 *Yetkazib berish* — manzilingizga keltiramiz\n🏪 *Borib olish* — omborimizdan o'zingiz olasiz (bepul)`,
    uz_cyrl: `{summary}\n\n📦 *Буюртмани қандай оласиз?*\n\n🚚 *Етказиб бериш* — манзилингизга келтирамиз\n🏪 *Бориб олиш* — омборимиздан ўзингиз оласиз (бепул)`,
    ru: `{summary}\n\n📦 *Как вы получите заказ?*\n\n🚚 *Доставка* — привезём по вашему адресу\n🏪 *Самовывоз* — заберёте сами со склада (бесплатно)`,
    en: `{summary}\n\n📦 *How will you receive your order?*\n\n🚚 *Delivery* — we bring it to your address\n🏪 *Pickup* — collect it yourself from our warehouse (free)`,
  },
  btnDelivery: { uz: '🚚 Yetkazib berish', uz_cyrl: '🚚 Етказиб бериш', ru: '🚚 Доставка', en: '🚚 Delivery' },
  btnPickup: { uz: '🏪 Borib olish', uz_cyrl: '🏪 Бориб олиш', ru: '🏪 Самовывоз', en: '🏪 Pickup' },
  chooseAddress: {
    uz: `📍 *Yetkazib berish manzilini tanlang:*\n\n📍 Joylashuvingizni yuboring *(aniqroq)*\n✍️ Yoki manzilni qo'lda yozing\n\n⚠️ _Bo'ka tumani va 50 km dan uzoqqa yetkazib berilmaydi!_`,
    uz_cyrl: `📍 *Етказиб бериш манзилини танланг:*\n\n📍 Жойлашувингизни юборинг *(аниқроқ)*\n✍️ Ёки манзилни қўлда ёзинг\n\n⚠️ _Бўка тумани ва 50 км дан узоққа етказиб берилмайди!_`,
    ru: `📍 *Выберите адрес доставки:*\n\n📍 Отправьте геолокацию *(точнее)*\n✍️ Или введите адрес вручную\n\n⚠️ _Доставка не осуществляется в Бўка и далее 50 км!_`,
    en: `📍 *Choose your delivery address:*\n\n📍 Send your location *(more accurate)*\n✍️ Or type the address manually\n\n⚠️ _No delivery to Bo'ka district or beyond 50 km!_`,
  },
  btnSendLocation: { uz: '📍 Joylashuvimni yuborish', uz_cyrl: '📍 Жойлашувимни юбориш', ru: '📍 Отправить геолокацию', en: '📍 Send my location' },
  btnTypeAddress: { uz: "✍️ Manzilni qo'lda yozish", uz_cyrl: '✍️ Манзилни қўлда ёзиш', ru: '✍️ Ввести адрес вручную', en: '✍️ Type address manually' },
  btnTypeAddressShort: { uz: '✍️ Manzil yozish', uz_cyrl: '✍️ Манзил ёзиш', ru: '✍️ Ввести адрес', en: '✍️ Type address' },
  btnRetypeAddress: { uz: '✍️ Qayta yozish', uz_cyrl: '✍️ Қайта ёзиш', ru: '✍️ Ввести заново', en: '✍️ Retype' },
  btnOtherAddress: { uz: '✍️ Boshqa manzil yozish', uz_cyrl: '✍️ Бошқа манзил ёзиш', ru: '✍️ Другой адрес', en: '✍️ Another address' },
  pickupChoose: {
    uz: '🏪 *Borib olish ombori*\n\nQaysi ombordan olmoqchisiz?',
    uz_cyrl: '🏪 *Бориб олиш омбори*\n\nҚайси омбордан олмоқчисиз?',
    ru: '🏪 *Самовывоз со склада*\n\nС какого склада хотите забрать?',
    en: '🏪 *Pickup warehouse*\n\nWhich warehouse will you collect from?',
  },
  pickupNoWarehouses: {
    uz: "🏪 Hozircha borib olish uchun ombor mavjud emas. Iltimos, yetkazib berishni tanlang.",
    uz_cyrl: '🏪 Ҳозирча бориб олиш учун омбор мавжуд эмас. Илтимос, етказиб беришни танланг.',
    ru: '🏪 Пока нет складов для самовывоза. Пожалуйста, выберите доставку.',
    en: '🏪 No pickup warehouses available yet. Please choose delivery.',
  },
  pickupSelected: {
    uz: `🏪 *Borib olish tanlandi*\n\n📍 Ombor: *{wh}*\n{addr}{phone}\n🚚 Yetkazib berish: *0 {som}* (bepul)\n━━━━━━━━━━━━━━━\n🛒 Mahsulotlar: {total} {som}\n💰 *JAMI: {grand} {som}*\n\nTo'lov turini tanlang:`,
    uz_cyrl: `🏪 *Бориб олиш танланди*\n\n📍 Омбор: *{wh}*\n{addr}{phone}\n🚚 Етказиб бериш: *0 {som}* (бепул)\n━━━━━━━━━━━━━━━\n🛒 Маҳсулотлар: {total} {som}\n💰 *ЖАМИ: {grand} {som}*\n\nТўлов турини танланг:`,
    ru: `🏪 *Выбран самовывоз*\n\n📍 Склад: *{wh}*\n{addr}{phone}\n🚚 Доставка: *0 {som}* (бесплатно)\n━━━━━━━━━━━━━━━\n🛒 Товары: {total} {som}\n💰 *ИТОГО: {grand} {som}*\n\nВыберите способ оплаты:`,
    en: `🏪 *Pickup selected*\n\n📍 Warehouse: *{wh}*\n{addr}{phone}\n🚚 Delivery: *0 {som}* (free)\n━━━━━━━━━━━━━━━\n🛒 Products: {total} {som}\n💰 *TOTAL: {grand} {som}*\n\nChoose payment method:`,
  },
  addrSearching: { uz: '⏳ Manzil qidirilmoqda...', uz_cyrl: '⏳ Манзил қидирилмоқда...', ru: '⏳ Поиск адреса...', en: '⏳ Searching address...' },
  addrChecking: { uz: '⏳ Manzilingiz tekshirilmoqda...', uz_cyrl: '⏳ Манзилингиз текширилмоқда...', ru: '⏳ Проверка адреса...', en: '⏳ Checking your address...' },
  addrNotFound: {
    uz: `❌ Manzil topilmadi.\n\n💡 *Maslahat:* Aniqroq yozing.\n_Masalan: Yunusobod 19-mavze, Chilonzor 7-kvartal_`,
    uz_cyrl: `❌ Манзил топилмади.\n\n💡 *Маслаҳат:* Аниқроқ ёзинг.\n_Масалан: Юнусобод 19-мавзе, Чилонзор 7-квартал_`,
    ru: `❌ Адрес не найден.\n\n💡 *Совет:* Напишите точнее.\n_Например: Юнусабад 19-квартал, Чиланзар 7-квартал_`,
    en: `❌ Address not found.\n\n💡 *Tip:* Be more specific.\n_For example: Yunusobod block 19, Chilonzor block 7_`,
  },
  typeAddressPrompt: { uz: '✍️ Manzilingizni yozing (masalan: Yunusobod, 19-mavze):', uz_cyrl: '✍️ Манзилингизни ёзинг (масалан: Юнусобод, 19-мавзе):', ru: '✍️ Введите адрес (например: Юнусабад, 19-квартал):', en: '✍️ Type your address (e.g. Yunusobod, block 19):' },
  sendLocationPrompt: { uz: '📍 Joylashuvingizni yuboring:', uz_cyrl: '📍 Жойлашувингизни юборинг:', ru: '📍 Отправьте геолокацию:', en: '📍 Send your location:' },
  addrConfirmed: {
    uz: `✅ *Manzil tasdiqlandi!*\n\n📍 {city}\n📏 Masofa: {dist} km\n🚚 Yetkazib berish: *{fee} {som}*\n   ({breakdown})\n{discount}━━━━━━━━━━━━━━━\n🛒 Mahsulotlar: {total} {som}\n🚚 Yetkazib berish: {fee} {som}\n💰 *JAMI: {grand} {som}*\n\nTo'lov turini tanlang:`,
    uz_cyrl: `✅ *Манзил тасдиқланди!*\n\n📍 {city}\n📏 Масофа: {dist} км\n🚚 Етказиб бериш: *{fee} {som}*\n   ({breakdown})\n{discount}━━━━━━━━━━━━━━━\n🛒 Маҳсулотлар: {total} {som}\n🚚 Етказиб бериш: {fee} {som}\n💰 *ЖАМИ: {grand} {som}*\n\nТўлов турини танланг:`,
    ru: `✅ *Адрес подтверждён!*\n\n📍 {city}\n📏 Расстояние: {dist} км\n🚚 Доставка: *{fee} {som}*\n   ({breakdown})\n{discount}━━━━━━━━━━━━━━━\n🛒 Товары: {total} {som}\n🚚 Доставка: {fee} {som}\n💰 *ИТОГО: {grand} {som}*\n\nВыберите способ оплаты:`,
    en: `✅ *Address confirmed!*\n\n📍 {city}\n📏 Distance: {dist} km\n🚚 Delivery: *{fee} {som}*\n   ({breakdown})\n{discount}━━━━━━━━━━━━━━━\n🛒 Products: {total} {som}\n🚚 Delivery: {fee} {som}\n💰 *TOTAL: {grand} {som}*\n\nChoose payment method:`,
  },
  discountLine: { uz: '🎁 Chegirma: {d}\n', uz_cyrl: '🎁 Чегирма: {d}\n', ru: '🎁 Скидка: {d}\n', en: '🎁 Discount: {d}\n' },
  bulkDiscount: { uz: '{pct}% chegirma ({n} dona)', uz_cyrl: '{pct}% чегирма ({n} дона)', ru: 'скидка {pct}% ({n} шт)', en: '{pct}% off ({n} pcs)' },
  payCard: { uz: '💳 Karta orqali', uz_cyrl: '💳 Карта орқали', ru: '💳 Картой', en: '💳 By card' },
  payCash: { uz: '💵 Naqd (Yetkazganda)', uz_cyrl: '💵 Нақд (Етказганда)', ru: '💵 Наличными (при получении)', en: '💵 Cash (on delivery)' },
  payCashPickup: { uz: '💵 Naqd (Olganda)', uz_cyrl: '💵 Нақд (Олганда)', ru: '💵 Наличными (при получении)', en: '💵 Cash (on pickup)' },
  payExpired: { uz: "❌ Buyurtma muddati o'tdi. Qayta boshlang.", uz_cyrl: '❌ Буюртма муддати ўтди. Қайта бошланг.', ru: '❌ Срок заказа истёк. Начните заново.', en: '❌ Order expired. Please start again.' },
  payCardText: {
    uz: `💳 *Karta orqali to'lov*\n\nKarta raqami: \`{card}\`\nKarta egasi: {owner}\n\n💰 To'lov summasi: *{grand} {som}*\n\n✅ To'lovni amalga oshirib, *chek rasmini* (screenshot) shu yerga yuboring.`,
    uz_cyrl: `💳 *Карта орқали тўлов*\n\nКарта рақами: \`{card}\`\nКарта эгаси: {owner}\n\n💰 Тўлов суммаси: *{grand} {som}*\n\n✅ Тўловни амалга ошириб, *чек расмини* (скриншот) шу ерга юборинг.`,
    ru: `💳 *Оплата картой*\n\nНомер карты: \`{card}\`\nВладелец: {owner}\n\n💰 Сумма к оплате: *{grand} {som}*\n\n✅ Совершите оплату и отправьте сюда *фото чека* (скриншот).`,
    en: `💳 *Card payment*\n\nCard number: \`{card}\`\nCardholder: {owner}\n\n💰 Amount: *{grand} {som}*\n\n✅ Make the payment and send the *receipt photo* (screenshot) here.`,
  },
  sendReceiptPhoto: { uz: '❌ Iltimos, chek rasmini (foto) yuboring.', uz_cyrl: '❌ Илтимос, чек расмини (фото) юборинг.', ru: '❌ Пожалуйста, отправьте фото чека.', en: '❌ Please send the receipt photo.' },
  receiptAccepted: { uz: '✅ Chek qabul qilindi!', uz_cyrl: '✅ Чек қабул қилинди!', ru: '✅ Чек принят!', en: '✅ Receipt accepted!' },
  orderSummary: {
    uz: `📋 *Buyurtma xulosasi*\n\n🛒 *Mahsulotlar:*\n{items}\n\n{recv}💳 To'lov: {pay}\n━━━━━━━━━━━━━━━\n💰 *JAMI: {grand} {som}*\n\nTasdiqlaysizmi?`,
    uz_cyrl: `📋 *Буюртма хулосаси*\n\n🛒 *Маҳсулотлар:*\n{items}\n\n{recv}💳 Тўлов: {pay}\n━━━━━━━━━━━━━━━\n💰 *ЖАМИ: {grand} {som}*\n\nТасдиқлайсизми?`,
    ru: `📋 *Сводка заказа*\n\n🛒 *Товары:*\n{items}\n\n{recv}💳 Оплата: {pay}\n━━━━━━━━━━━━━━━\n💰 *ИТОГО: {grand} {som}*\n\nПодтверждаете?`,
    en: `📋 *Order summary*\n\n🛒 *Products:*\n{items}\n\n{recv}💳 Payment: {pay}\n━━━━━━━━━━━━━━━\n💰 *TOTAL: {grand} {som}*\n\nConfirm?`,
  },
  recvDeliveryBlock: {
    uz: `📍 Manzil: {city}\n📏 Masofa: {dist} km\n🚚 Yetkazib berish: {fee} {som}\n`,
    uz_cyrl: `📍 Манзил: {city}\n📏 Масофа: {dist} км\n🚚 Етказиб бериш: {fee} {som}\n`,
    ru: `📍 Адрес: {city}\n📏 Расстояние: {dist} км\n🚚 Доставка: {fee} {som}\n`,
    en: `📍 Address: {city}\n📏 Distance: {dist} km\n🚚 Delivery: {fee} {som}\n`,
  },
  recvPickupBlock: {
    uz: `🏪 Borib olish: {wh}\n🚚 Yetkazib berish: 0 {som} (bepul)\n`,
    uz_cyrl: `🏪 Бориб олиш: {wh}\n🚚 Етказиб бериш: 0 {som} (бепул)\n`,
    ru: `🏪 Самовывоз: {wh}\n🚚 Доставка: 0 {som} (бесплатно)\n`,
    en: `🏪 Pickup: {wh}\n🚚 Delivery: 0 {som} (free)\n`,
  },
  btnConfirm: { uz: '✅ Tasdiqlash', uz_cyrl: '✅ Тасдиқлаш', ru: '✅ Подтвердить', en: '✅ Confirm' },
  btnEdit: { uz: "✏️ O'zgartirish", uz_cyrl: '✏️ Ўзгартириш', ru: '✏️ Изменить', en: '✏️ Edit' },
  orderPlacing: { uz: '✅ Buyurtma joylashtirilmoqda...', uz_cyrl: '✅ Буюртма жойлаштирилмоқда...', ru: '✅ Оформляем заказ...', en: '✅ Placing your order...' },
  orderErrorRetry: { uz: '❌ Xatolik. Qayta buyurtma bering.', uz_cyrl: '❌ Хатолик. Қайта буюртма беринг.', ru: '❌ Ошибка. Оформите заказ заново.', en: '❌ Error. Please order again.' },
  orderAccepted: {
    uz: `🎉 *Buyurtma qabul qilindi!*\n\n📋 Buyurtma №: *{num}*\n{promo}{points}💰 Jami: *{grand} {som}*\n{recv}🎁 Siz *+{earned} bonus ball* olasiz!\n\n{payNote}📞 Muammo bo'lsa bog'laning.\n\n_Buyurtma holati o'zgarganda xabardor qilinasiz!_ 📲`,
    uz_cyrl: `🎉 *Буюртма қабул қилинди!*\n\n📋 Буюртма №: *{num}*\n{promo}{points}💰 Жами: *{grand} {som}*\n{recv}🎁 Сиз *+{earned} бонус балл* оласиз!\n\n{payNote}📞 Муаммо бўлса боғланинг.\n\n_Буюртма ҳолати ўзгарганда хабардор қилинасиз!_ 📲`,
    ru: `🎉 *Заказ принят!*\n\n📋 Заказ №: *{num}*\n{promo}{points}💰 Итого: *{grand} {som}*\n{recv}🎁 Вы получите *+{earned} бонусных баллов*!\n\n{payNote}📞 При проблемах свяжитесь с нами.\n\n_Вы получите уведомление при изменении статуса заказа!_ 📲`,
    en: `🎉 *Order accepted!*\n\n📋 Order №: *{num}*\n{promo}{points}💰 Total: *{grand} {som}*\n{recv}🎁 You'll earn *+{earned} bonus points*!\n\n{payNote}📞 Contact us if there's a problem.\n\n_You'll be notified when the order status changes!_ 📲`,
  },
  acceptedRecvDelivery: { uz: `🚚 Yetkazib berish: {fee} {som}\n📍 Manzil: {city}\n`, uz_cyrl: `🚚 Етказиб бериш: {fee} {som}\n📍 Манзил: {city}\n`, ru: `🚚 Доставка: {fee} {som}\n📍 Адрес: {city}\n`, en: `🚚 Delivery: {fee} {som}\n📍 Address: {city}\n` },
  acceptedRecvPickup: { uz: `🏪 Borib olish: {wh}\n`, uz_cyrl: `🏪 Бориб олиш: {wh}\n`, ru: `🏪 Самовывоз: {wh}\n`, en: `🏪 Pickup: {wh}\n` },
  promoDiscLine: { uz: `🎟️ Promo chegirma: -{d} {som}\n`, uz_cyrl: `🎟️ Промо чегирма: -{d} {som}\n`, ru: `🎟️ Промо-скидка: -{d} {som}\n`, en: `🎟️ Promo discount: -{d} {som}\n` },
  pointsDiscLine: { uz: `💰 Ball chegirmasi: -{d} {som} ({p} ball)\n`, uz_cyrl: `💰 Балл чегирмаси: -{d} {som} ({p} балл)\n`, ru: `💰 Скидка баллами: -{d} {som} ({p} баллов)\n`, en: `💰 Points discount: -{d} {som} ({p} points)\n` },
  payNoteCard: { uz: `⏳ _To'lovingiz tekshirilmoqda. Tez orada xabar beramiz._\n\n`, uz_cyrl: `⏳ _Тўловингиз текширилмоқда. Тез орада хабар берамиз._\n\n`, ru: `⏳ _Ваша оплата проверяется. Скоро сообщим._\n\n`, en: `⏳ _Your payment is being verified. We'll notify you soon._\n\n` },
  payNoteCashDelivery: { uz: `💵 _To'lovni yetkazuvchiga naqd to'laysiz._\n\n`, uz_cyrl: `💵 _Тўловни етказувчига нақд тўлайсиз._\n\n`, ru: `💵 _Оплата наличными курьеру._\n\n`, en: `💵 _Pay cash to the courier._\n\n` },
  payNoteCashPickup: { uz: `💵 _To'lovni omborda olganingizda naqd to'laysiz._\n\n`, uz_cyrl: `💵 _Тўловни омборда олганингизда нақд тўлайсиз._\n\n`, ru: `💵 _Оплата наличными при получении на складе._\n\n`, en: `💵 _Pay cash when collecting at the warehouse._\n\n` },
  btnMyOrders: { uz: '📋 Buyurtmalarim', uz_cyrl: '📋 Буюртмаларим', ru: '📋 Мои заказы', en: '📋 My orders' },
  orderCancelled: { uz: "❌ Buyurtma bekor qilindi. Savatdagi mahsulotlar o'chirildi.", uz_cyrl: '❌ Буюртма бекор қилинди. Саватдаги маҳсулотлар ўчирилди.', ru: '❌ Заказ отменён. Товары из корзины удалены.', en: '❌ Order cancelled. Cart items removed.' },
  noOrdersYet: { uz: '📋 Siz hali buyurtma bermagansiz.', uz_cyrl: '📋 Сиз ҳали буюртма бермагансиз.', ru: '📋 Вы ещё не делали заказов.', en: '📋 You have no orders yet.' },
  btnShop: { uz: '🛍️ Xarid qilish', uz_cyrl: '🛍️ Харид қилиш', ru: '🛍️ За покупками', en: '🛍️ Shop now' },
  myOrdersTitle: { uz: '📋 *Buyurtmalarim* ({n} ta)\n\nBuyurtmani tanlang:', uz_cyrl: '📋 *Буюртмаларим* ({n} та)\n\nБуюртмани танланг:', ru: '📋 *Мои заказы* ({n})\n\nВыберите заказ:', en: '📋 *My orders* ({n})\n\nSelect an order:' },
  orderNotFound: { uz: '❌ Buyurtma topilmadi.', uz_cyrl: '❌ Буюртма топилмади.', ru: '❌ Заказ не найден.', en: '❌ Order not found.' },
  orderDetail: {
    uz: `📋 *Buyurtma: {num}*\n\n📊 Holat: {status}\n💰 Jami: *{grand} {som}*\n{recv}💳 To'lov: {pay}\n\n🛒 *Mahsulotlar:*\n{items}\n\n🕐 Sana: {date}`,
    uz_cyrl: `📋 *Буюртма: {num}*\n\n📊 Ҳолат: {status}\n💰 Жами: *{grand} {som}*\n{recv}💳 Тўлов: {pay}\n\n🛒 *Маҳсулотлар:*\n{items}\n\n🕐 Сана: {date}`,
    ru: `📋 *Заказ: {num}*\n\n📊 Статус: {status}\n💰 Итого: *{grand} {som}*\n{recv}💳 Оплата: {pay}\n\n🛒 *Товары:*\n{items}\n\n🕐 Дата: {date}`,
    en: `📋 *Order: {num}*\n\n📊 Status: {status}\n💰 Total: *{grand} {som}*\n{recv}💳 Payment: {pay}\n\n🛒 *Products:*\n{items}\n\n🕐 Date: {date}`,
  },
  btnOnMap: { uz: '🗺️ Xaritada', uz_cyrl: '🗺️ Харитада', ru: '🗺️ На карте', en: '🗺️ On map' },

  // ── PROFIL ──
  profileTitle: {
    uz: `👤 *Profilim*\n\nIsm: *{name}*\n📱 Telefon: {phone}\n🆔 ID: {id}\n\n📋 Jami buyurtmalar: *{orders}*\n✅ Yetkazilgan: *{delivered}*\n💰 Jami xarid: *{spent} {som}*\n🎁 Bonus ballar: *{points}*\n\n📅 Ro'yxatdan: {date}`,
    uz_cyrl: `👤 *Профилим*\n\nИсм: *{name}*\n📱 Телефон: {phone}\n🆔 ID: {id}\n\n📋 Жами буюртмалар: *{orders}*\n✅ Етказилган: *{delivered}*\n💰 Жами харид: *{spent} {som}*\n🎁 Бонус баллар: *{points}*\n\n📅 Рўйхатдан: {date}`,
    ru: `👤 *Профиль*\n\nИмя: *{name}*\n📱 Телефон: {phone}\n🆔 ID: {id}\n\n📋 Всего заказов: *{orders}*\n✅ Доставлено: *{delivered}*\n💰 Всего покупок: *{spent} {som}*\n🎁 Бонусные баллы: *{points}*\n\n📅 Регистрация: {date}`,
    en: `👤 *Profile*\n\nName: *{name}*\n📱 Phone: {phone}\n🆔 ID: {id}\n\n📋 Total orders: *{orders}*\n✅ Delivered: *{delivered}*\n💰 Total spent: *{spent} {som}*\n🎁 Bonus points: *{points}*\n\n📅 Registered: {date}`,
  },
  phoneNotSet: { uz: 'Belgilanmagan', uz_cyrl: 'Белгиланмаган', ru: 'Не указан', en: 'Not set' },
  btnChangePhone: { uz: "📱 Raqamni o'zgartirish", uz_cyrl: '📱 Рақамни ўзгартириш', ru: '📱 Изменить номер', en: '📱 Change phone' },
  changePhonePrompt: { uz: '📱 Yangi telefon raqamingizni ulashing:', uz_cyrl: '📱 Янги телефон рақамингизни улашинг:', ru: '📱 Поделитесь новым номером телефона:', en: '📱 Share your new phone number:' },
  phoneShareHint: { uz: 'Iltimos, tugmani bosib raqam ulashing.', uz_cyrl: 'Илтимос, тугмани босиб рақам улашинг.', ru: 'Пожалуйста, нажмите кнопку и поделитесь номером.', en: 'Please press the button to share your number.' },
  phoneUpdated: { uz: '✅ Telefon raqami yangilandi!', uz_cyrl: '✅ Телефон рақами янгиланди!', ru: '✅ Номер телефона обновлён!', en: '✅ Phone number updated!' },
  btnSharePhone: { uz: "📱 Raqamimni ulashish", uz_cyrl: '📱 Рақамимни улашиш', ru: '📱 Поделиться номером', en: '📱 Share my number' },

  deliveryInfo: {
    uz: `🚚 *Yetkazib Berish Ma'lumotlari*\n\n🏭 Ombor: {wh}\n\n💰 *Narx:*\n• Boshlang'ich: {base} {som}\n• + Har km uchun: {perkm} {som}\n• Maksimal masofa: {maxkm} km\n\n🏪 *Borib olish — BEPUL!*\nOmborlarimizdan o'zingiz olib ketishingiz mumkin.\n\n📦 *Ko'p buyurtmada chegirma:*\n• 3+ buyurtma: 5% chegirma\n• 5+ buyurtma: 10% chegirma\n• 10+ buyurtma: 15% chegirma\n\n❌ *Yetkazib berilmaydigan hududlar:*\n• Bo'ka tumani\n• 50 km dan uzoq hududlar\n\n⏰ *Yetkazish vaqti:*\n• 0–10 km: 1–2 soat\n• 10–30 km: 2–4 soat\n• 30–50 km: 4–8 soat\n\n📞 Savol: {support}`,
    uz_cyrl: `🚚 *Етказиб Бериш Маълумотлари*\n\n🏭 Омбор: {wh}\n\n💰 *Нарх:*\n• Бошланғич: {base} {som}\n• + Ҳар км учун: {perkm} {som}\n• Максимал масофа: {maxkm} км\n\n🏪 *Бориб олиш — БЕПУЛ!*\nОмборларимиздан ўзингиз олиб кетишингиз мумкин.\n\n📦 *Кўп буюртмада чегирма:*\n• 3+ буюртма: 5% чегирма\n• 5+ буюртма: 10% чегирма\n• 10+ буюртма: 15% чегирма\n\n❌ *Етказиб берилмайдиган ҳудудлар:*\n• Бўка тумани\n• 50 км дан узоқ ҳудудлар\n\n⏰ *Етказиш вақти:*\n• 0–10 км: 1–2 соат\n• 10–30 км: 2–4 соат\n• 30–50 км: 4–8 соат\n\n📞 Савол: {support}`,
    ru: `🚚 *Информация о доставке*\n\n🏭 Склад: {wh}\n\n💰 *Стоимость:*\n• Базовая: {base} {som}\n• + За каждый км: {perkm} {som}\n• Макс. расстояние: {maxkm} км\n\n🏪 *Самовывоз — БЕСПЛАТНО!*\nВы можете забрать заказ сами с наших складов.\n\n📦 *Скидка при большом заказе:*\n• 3+ товара: 5% скидка\n• 5+ товаров: 10% скидка\n• 10+ товаров: 15% скидка\n\n❌ *Зоны без доставки:*\n• Район Бўка\n• Дальше 50 км\n\n⏰ *Время доставки:*\n• 0–10 км: 1–2 часа\n• 10–30 км: 2–4 часа\n• 30–50 км: 4–8 часов\n\n📞 Вопросы: {support}`,
    en: `🚚 *Delivery Information*\n\n🏭 Warehouse: {wh}\n\n💰 *Pricing:*\n• Base: {base} {som}\n• + Per km: {perkm} {som}\n• Max distance: {maxkm} km\n\n🏪 *Pickup — FREE!*\nYou can collect your order from our warehouses.\n\n📦 *Bulk order discount:*\n• 3+ items: 5% off\n• 5+ items: 10% off\n• 10+ items: 15% off\n\n❌ *No-delivery zones:*\n• Bo'ka district\n• Beyond 50 km\n\n⏰ *Delivery time:*\n• 0–10 km: 1–2 h\n• 10–30 km: 2–4 h\n• 30–50 km: 4–8 h\n\n📞 Questions: {support}`,
  },
  btnCheckMyAddress: { uz: '📍 Manzilimni tekshirish', uz_cyrl: '📍 Манзилимни текшириш', ru: '📍 Проверить мой адрес', en: '📍 Check my address' },
  checkAddrPrompt: { uz: '📍 Joylashuvingizni yuboring — yetkazib berish narxini hisoblayman:', uz_cyrl: '📍 Жойлашувингизни юборинг — етказиб бериш нархини ҳисоблайман:', ru: '📍 Отправьте геолокацию — рассчитаю стоимость доставки:', en: '📍 Send your location — I\'ll calculate the delivery cost:' },
  deliverableMsg: {
    uz: `✅ *Yetkazib beriladi!*\n\n📍 Manzil: {city}\n📏 Masofa: {dist} km\n\n💰 *Yetkazib berish narxi:*\n{fee} {som}\n({breakdown})\n\n🗺️ [Google Maps]({maps})`,
    uz_cyrl: `✅ *Етказиб берилади!*\n\n📍 Манзил: {city}\n📏 Масофа: {dist} км\n\n💰 *Етказиб бериш нархи:*\n{fee} {som}\n({breakdown})\n\n🗺️ [Google Maps]({maps})`,
    ru: `✅ *Доставка возможна!*\n\n📍 Адрес: {city}\n📏 Расстояние: {dist} км\n\n💰 *Стоимость доставки:*\n{fee} {som}\n({breakdown})\n\n🗺️ [Google Maps]({maps})`,
    en: `✅ *Delivery available!*\n\n📍 Address: {city}\n📏 Distance: {dist} km\n\n💰 *Delivery cost:*\n{fee} {som}\n({breakdown})\n\n🗺️ [Google Maps]({maps})`,
  },
  contactInfo: {
    uz: `📞 *Biz bilan bog'laning*\n\n📱 Telefon: {phone}\n💬 Telegram: {support}\n📧 Email: {email}\n🌐 Sayt: {site}\n📍 Manzil: {wh}\n\n⏰ Ish vaqti:\nDu–Sh: 09:00 – 18:00\nYak: 10:00 – 15:00`,
    uz_cyrl: `📞 *Биз билан боғланинг*\n\n📱 Телефон: {phone}\n💬 Телеграм: {support}\n📧 Email: {email}\n🌐 Сайт: {site}\n📍 Манзил: {wh}\n\n⏰ Иш вақти:\nДу–Ш: 09:00 – 18:00\nЯк: 10:00 – 15:00`,
    ru: `📞 *Свяжитесь с нами*\n\n📱 Телефон: {phone}\n💬 Telegram: {support}\n📧 Email: {email}\n🌐 Сайт: {site}\n📍 Адрес: {wh}\n\n⏰ Часы работы:\nПн–Сб: 09:00 – 18:00\nВс: 10:00 – 15:00`,
    en: `📞 *Contact us*\n\n📱 Phone: {phone}\n💬 Telegram: {support}\n📧 Email: {email}\n🌐 Website: {site}\n📍 Address: {wh}\n\n⏰ Working hours:\nMon–Sat: 09:00 – 18:00\nSun: 10:00 – 15:00`,
  },
  aboutInfo: {
    uz: `🏗️ *BoomStroy Haqida*\n\nBoomStroy — Toshkentdagi yetakchi qurilish materiallari do'koni.\n\n✅ *Afzalliklarimiz:*\n• 10 yildan ortiq tajriba\n• 5000+ mahsulot assortimenti\n• Sifat kafolati\n• Tez yetkazib berish\n• Borib olish imkoniyati\n• Eng arzon narxlar\n\n🌐 Sayt: {site}\n📱 Bot: {bot}`,
    uz_cyrl: `🏗️ *BoomStroy Ҳақида*\n\nBoomStroy — Тошкентдаги етакчи қурилиш материаллари дўкони.\n\n✅ *Афзалликларимиз:*\n• 10 йилдан ортиқ тажриба\n• 5000+ маҳсулот ассортименти\n• Сифат кафолати\n• Тез етказиб бериш\n• Бориб олиш имконияти\n• Энг арзон нархлар\n\n🌐 Сайт: {site}\n📱 Бот: {bot}`,
    ru: `🏗️ *О BoomStroy*\n\nBoomStroy — ведущий магазин строительных материалов в Ташкенте.\n\n✅ *Наши преимущества:*\n• Более 10 лет опыта\n• Ассортимент 5000+ товаров\n• Гарантия качества\n• Быстрая доставка\n• Возможность самовывоза\n• Самые низкие цены\n\n🌐 Сайт: {site}\n📱 Бот: {bot}`,
    en: `🏗️ *About BoomStroy*\n\nBoomStroy is a leading construction materials store in Tashkent.\n\n✅ *Our advantages:*\n• Over 10 years of experience\n• 5000+ product range\n• Quality guarantee\n• Fast delivery\n• Pickup option\n• Lowest prices\n\n🌐 Website: {site}\n📱 Bot: {bot}`,
  },
  salesInfo: {
    uz: `⭐ *Aksiyalar va Chegirmalar*\n\n🎁 *Faol aksiyalar:*\n• 3+ mahsulot — 5% chegirma\n• 5+ mahsulot — 10% chegirma\n• 10+ mahsulot — 15% chegirma\n\n🚚 *Yetkazib berish chegirmasi:*\n• Ko'p buyurtmada kumulyativ chegirma\n\n🎁 *Bonus ballar:*\n• Har xariddan ball to'plang\n• 100 ball = 1 000 {som}\n• Ballarni sovg'alarga almashtiring!\n\n📢 Yangi aksiyalar uchun kanalimizga a'zo bo'ling!`,
    uz_cyrl: `⭐ *Акциялар ва Чегирмалар*\n\n🎁 *Фаол акциялар:*\n• 3+ маҳсулот — 5% чегирма\n• 5+ маҳсулот — 10% чегирма\n• 10+ маҳсулот — 15% чегирма\n\n🚚 *Етказиб бериш чегирмаси:*\n• Кўп буюртмада кумулятив чегирма\n\n🎁 *Бонус баллар:*\n• Ҳар хариддан балл тўпланг\n• 100 балл = 1 000 {som}\n• Балларни совғаларга алмаштиринг!\n\n📢 Янги акциялар учун каналимизга аъзо бўлинг!`,
    ru: `⭐ *Акции и Скидки*\n\n🎁 *Активные акции:*\n• 3+ товара — 5% скидка\n• 5+ товаров — 10% скидка\n• 10+ товаров — 15% скидка\n\n🚚 *Скидка на доставку:*\n• Накопительная скидка при больших заказах\n\n🎁 *Бонусные баллы:*\n• Копите баллы с каждой покупки\n• 100 баллов = 1 000 {som}\n• Обменивайте баллы на подарки!\n\n📢 Подпишитесь на канал, чтобы узнавать об акциях!`,
    en: `⭐ *Promotions & Discounts*\n\n🎁 *Active promotions:*\n• 3+ items — 5% off\n• 5+ items — 10% off\n• 10+ items — 15% off\n\n🚚 *Delivery discount:*\n• Cumulative discount on large orders\n\n🎁 *Bonus points:*\n• Earn points with every purchase\n• 100 points = 1,000 {som}\n• Exchange points for rewards!\n\n📢 Subscribe to our channel for new promotions!`,
  },

  // ── LOYALTY / BONUS ──
  loyaltyMenuTitle: {
    uz: `🎁 *Bonus va Sodiqlik Tizimi*\n\n{tierIcon} Darajangiz: *{tier}*\n💰 Ballaringiz: *{points}* ball\n💵 Pul qiymati: *{value} {som}*\n🛍️ Jami xarid: *{spent} {som}*\n{next}\n📐 100 ball = 1 000 {som}\n\nQuyidagilardan birini tanlang:`,
    uz_cyrl: `🎁 *Бонус ва Содиқлик Тизими*\n\n{tierIcon} Даражангиз: *{tier}*\n💰 Балларингиз: *{points}* балл\n💵 Пул қиймати: *{value} {som}*\n🛍️ Жами харид: *{spent} {som}*\n{next}\n📐 100 балл = 1 000 {som}\n\nҚуйидагилардан бирини танланг:`,
    ru: `🎁 *Система Бонусов и Лояльности*\n\n{tierIcon} Ваш уровень: *{tier}*\n💰 Ваши баллы: *{points}* баллов\n💵 Денежная ценность: *{value} {som}*\n🛍️ Всего покупок: *{spent} {som}*\n{next}\n📐 100 баллов = 1 000 {som}\n\nВыберите одно из:`,
    en: `🎁 *Bonus & Loyalty System*\n\n{tierIcon} Your tier: *{tier}*\n💰 Your points: *{points}* points\n💵 Cash value: *{value} {som}*\n🛍️ Total spent: *{spent} {som}*\n{next}\n📐 100 points = 1,000 {som}\n\nChoose one of the following:`,
  },
  tierNext: { uz: `\n📈 Keyingi daraja: {next}\n📊 Kerak: {amount} {som} qoldi`, uz_cyrl: `\n📈 Кейинги даража: {next}\n📊 Керак: {amount} {som} қолди`, ru: `\n📈 Следующий уровень: {next}\n📊 Осталось: {amount} {som}`, en: `\n📈 Next tier: {next}\n📊 {amount} {som} to go` },
  tierTop: { uz: `\n🏆 Siz eng yuqori darajadasiz!`, uz_cyrl: `\n🏆 Сиз энг юқори даражадасиз!`, ru: `\n🏆 Вы на высшем уровне!`, en: `\n🏆 You're at the highest tier!` },
  btnMyPoints: { uz: '💰 Ballarim', uz_cyrl: '💰 Балларим', ru: '💰 Мои баллы', en: '💰 My points' },
  btnRewardsShop: { uz: "🎁 Sovg'alar do'koni", uz_cyrl: '🎁 Совғалар дўкони', ru: '🎁 Магазин подарков', en: '🎁 Rewards shop' },
  btnDailyBonus: { uz: '🎁 Kunlik bonus', uz_cyrl: '🎁 Кунлик бонус', ru: '🎁 Ежедневный бонус', en: '🎁 Daily bonus' },
  btnInviteFriend: { uz: "👥 Do'stni taklif qilish", uz_cyrl: '👥 Дўстни таклиф қилиш', ru: '👥 Пригласить друга', en: '👥 Invite a friend' },
  btnEnterPromo: { uz: '🎟️ Promo-kod kiritish', uz_cyrl: '🎟️ Промо-код киритиш', ru: '🎟️ Ввести промокод', en: '🎟️ Enter promo code' },
  btnTiers: { uz: '🏆 Daraja haqida', uz_cyrl: '🏆 Даража ҳақида', ru: '🏆 Об уровнях', en: '🏆 About tiers' },
  pointsBalance: {
    uz: `💰 *Ballaringiz: {points}*\n\n📐 100 ball = 1 000 {som}\n💵 Pulga teng qiymat: {value} {som}\n\n🎁 Ballarni "Sovg'alar do'koni"da maxsus mahsulotlarga almashtiring yoki keyingi xaridda chegirma sifatida ishlating.`,
    uz_cyrl: `💰 *Балларингиз: {points}*\n\n📐 100 балл = 1 000 {som}\n💵 Пулга тенг қиймат: {value} {som}\n\n🎁 Балларни "Совғалар дўкони"да махсус маҳсулотларга алмаштиринг ёки кейинги харидда чегирма сифатида ишлатинг.`,
    ru: `💰 *Ваши баллы: {points}*\n\n📐 100 баллов = 1 000 {som}\n💵 Денежная ценность: {value} {som}\n\n🎁 Обменяйте баллы на особые товары в «Магазине подарков» или используйте как скидку при следующей покупке.`,
    en: `💰 *Your points: {points}*\n\n📐 100 points = 1,000 {som}\n💵 Cash value: {value} {som}\n\n🎁 Exchange points for special items in the "Rewards shop" or use them as a discount on your next purchase.`,
  },
  dailyAlready: { uz: "✅ Siz bugun allaqachon bonus olgansiz!\n\n⏰ Ertaga qayta urinib ko'ring.", uz_cyrl: '✅ Сиз бугун аллақачон бонус олгансиз!\n\n⏰ Эртага қайта уриниб кўринг.', ru: '✅ Вы уже получили бонус сегодня!\n\n⏰ Попробуйте завтра.', en: "✅ You've already claimed today's bonus!\n\n⏰ Try again tomorrow." },
  dailyClaimed: {
    uz: `🎉 *Kunlik bonus olindi!*\n\n💰 +{amount} ball\n🔥 Ketma-ket: {streak} kun\n\nErtaga ham qaytib keling!`,
    uz_cyrl: `🎉 *Кунлик бонус олинди!*\n\n💰 +{amount} балл\n🔥 Кетма-кет: {streak} кун\n\nЭртага ҳам қайтиб келинг!`,
    ru: `🎉 *Ежедневный бонус получен!*\n\n💰 +{amount} баллов\n🔥 Подряд: {streak} дней\n\nВозвращайтесь завтра!`,
    en: `🎉 *Daily bonus claimed!*\n\n💰 +{amount} points\n🔥 Streak: {streak} days\n\nCome back tomorrow!`,
  },
  tiersInfo: {
    uz: `🏆 *Sodiqlik Darajalari*\n\n🆕 *Yangi* — 0 {som} dan\n   Chegirma: 0%\n\n🥉 *Bronza* — 1 000 000 {som} dan\n   Chegirma: 1%\n\n🥈 *Kumush* — 5 000 000 {som} dan\n   Chegirma: 3%\n\n🥇 *Oltin* — 20 000 000 {som} dan\n   Chegirma: 5%\n\n💎 *Olmos* — 50 000 000 {som} dan\n   Chegirma: 7%\n\n_Daraja avtomatik jami xaridingiz asosida hisoblanadi._`,
    uz_cyrl: `🏆 *Содиқлик Даражалари*\n\n🆕 *Янги* — 0 {som} дан\n   Чегирма: 0%\n\n🥉 *Бронза* — 1 000 000 {som} дан\n   Чегирма: 1%\n\n🥈 *Кумуш* — 5 000 000 {som} дан\n   Чегирма: 3%\n\n🥇 *Олтин* — 20 000 000 {som} дан\n   Чегирма: 5%\n\n💎 *Олмос* — 50 000 000 {som} дан\n   Чегирма: 7%\n\n_Даража автоматик жами харидингиз асосида ҳисобланади._`,
    ru: `🏆 *Уровни лояльности*\n\n🆕 *Новичок* — от 0 {som}\n   Скидка: 0%\n\n🥉 *Бронза* — от 1 000 000 {som}\n   Скидка: 1%\n\n🥈 *Серебро* — от 5 000 000 {som}\n   Скидка: 3%\n\n🥇 *Золото* — от 20 000 000 {som}\n   Скидка: 5%\n\n💎 *Алмаз* — от 50 000 000 {som}\n   Скидка: 7%\n\n_Уровень рассчитывается автоматически по сумме покупок._`,
    en: `🏆 *Loyalty Tiers*\n\n🆕 *New* — from 0 {som}\n   Discount: 0%\n\n🥉 *Bronze* — from 1,000,000 {som}\n   Discount: 1%\n\n🥈 *Silver* — from 5,000,000 {som}\n   Discount: 3%\n\n🥇 *Gold* — from 20,000,000 {som}\n   Discount: 5%\n\n💎 *Diamond* — from 50,000,000 {som}\n   Discount: 7%\n\n_The tier is calculated automatically based on your total spending._`,
  },
  // tier names
  tier_new: { uz: '🆕 Yangi', uz_cyrl: '🆕 Янги', ru: '🆕 Новичок', en: '🆕 New' },
  tier_bronze: { uz: '🥉 Bronza', uz_cyrl: '🥉 Бронза', ru: '🥉 Бронза', en: '🥉 Bronze' },
  tier_silver: { uz: '🥈 Kumush', uz_cyrl: '🥈 Кумуш', ru: '🥈 Серебро', en: '🥈 Silver' },
  tier_gold: { uz: '🥇 Oltin', uz_cyrl: '🥇 Олтин', ru: '🥇 Золото', en: '🥇 Gold' },
  tier_diamond: { uz: '💎 Olmos', uz_cyrl: '💎 Олмос', ru: '💎 Алмаз', en: '💎 Diamond' },

  // ── REWARDS SHOP ──
  rewardsTitle: {
    uz: `🎁 *Sovg'alar Do'koni*\n\n💰 Sizning ballaringiz: *{points}*\n📐 100 ball = 1 000 {som}\n\nBallaringizga quyidagi maxsus mahsulotlarni oling:`,
    uz_cyrl: `🎁 *Совғалар Дўкони*\n\n💰 Сизнинг балларингиз: *{points}*\n📐 100 балл = 1 000 {som}\n\nБалларингизга қуйидаги махсус маҳсулотларни олинг:`,
    ru: `🎁 *Магазин подарков*\n\n💰 Ваши баллы: *{points}*\n📐 100 баллов = 1 000 {som}\n\nОбменяйте баллы на эти особые товары:`,
    en: `🎁 *Rewards Shop*\n\n💰 Your points: *{points}*\n📐 100 points = 1,000 {som}\n\nRedeem your points for these special items:`,
  },
  rewardsEmpty: {
    uz: "🎁 Hozircha sovg'alar mavjud emas.\n\nTez orada maxsus mahsulotlar qo'shiladi. Ballaringizni to'plashda davom eting!",
    uz_cyrl: '🎁 Ҳозирча совғалар мавжуд эмас.\n\nТез орада махсус маҳсулотлар қўшилади. Балларингизни тўплашда давом этинг!',
    ru: '🎁 Пока подарков нет.\n\nСкоро добавим особые товары. Продолжайте копить баллы!',
    en: "🎁 No rewards available yet.\n\nSpecial items coming soon. Keep collecting points!",
  },
  rewardCost: { uz: '🎁 {name} — {cost} ball', uz_cyrl: '🎁 {name} — {cost} балл', ru: '🎁 {name} — {cost} баллов', en: '🎁 {name} — {cost} points' },
  rewardDetail: {
    uz: `🎁 *{name}*\n\n{desc}💰 Narxi: *{cost} ball* ({value} {som})\n📦 Mavjud: {stock}\n\nSizda: *{points} ball*\n{status}`,
    uz_cyrl: `🎁 *{name}*\n\n{desc}💰 Нархи: *{cost} балл* ({value} {som})\n📦 Мавжуд: {stock}\n\nСизда: *{points} балл*\n{status}`,
    ru: `🎁 *{name}*\n\n{desc}💰 Цена: *{cost} баллов* ({value} {som})\n📦 В наличии: {stock}\n\nУ вас: *{points} баллов*\n{status}`,
    en: `🎁 *{name}*\n\n{desc}💰 Cost: *{cost} points* ({value} {som})\n📦 Available: {stock}\n\nYou have: *{points} points*\n{status}`,
  },
  rewardEnough: { uz: '✅ Ballaringiz yetarli! Olish uchun tugmani bosing.', uz_cyrl: '✅ Балларингиз етарли! Олиш учун тугмани босинг.', ru: '✅ Баллов достаточно! Нажмите кнопку, чтобы получить.', en: '✅ You have enough points! Press the button to redeem.' },
  rewardNotEnough: { uz: '❌ Ballaringiz yetarli emas. Yana {need} ball kerak.', uz_cyrl: '❌ Балларингиз етарли эмас. Яна {need} балл керак.', ru: '❌ Недостаточно баллов. Нужно ещё {need} баллов.', en: '❌ Not enough points. You need {need} more.' },
  rewardOutOfStock: { uz: '❌ Bu sovg\'a tugagan.', uz_cyrl: '❌ Бу совға тугаган.', ru: '❌ Этот подарок закончился.', en: '❌ This reward is out of stock.' },
  btnRedeem: { uz: '🎁 Sovg\'ani olish', uz_cyrl: '🎁 Совғани олиш', ru: '🎁 Получить подарок', en: '🎁 Redeem reward' },
  rewardRedeemed: {
    uz: `🎉 *Tabriklaymiz!*\n\nSiz *{name}* sovg'asini oldingiz!\n💰 -{cost} ball sarflandi.\n💳 Qolgan ballaringiz: {points}\n\n📞 Operatorlarimiz siz bilan bog'lanib, sovg'ani topshirish bo'yicha kelishadi.`,
    uz_cyrl: `🎉 *Табриклаймиз!*\n\nСиз *{name}* совғасини олдингиз!\n💰 -{cost} балл сарфланди.\n💳 Қолган балларингиз: {points}\n\n📞 Операторларимиз сиз билан боғланиб, совғани топшириш бўйича келишади.`,
    ru: `🎉 *Поздравляем!*\n\nВы получили подарок *{name}*!\n💰 Списано -{cost} баллов.\n💳 Остаток баллов: {points}\n\n📞 Наши операторы свяжутся с вами для передачи подарка.`,
    en: `🎉 *Congratulations!*\n\nYou redeemed *{name}*!\n💰 -{cost} points deducted.\n💳 Remaining points: {points}\n\n📞 Our operators will contact you to arrange delivery of the reward.`,
  },

  // ── REFERRAL ──
  referralInfo: {
    uz: `👥 *Do'stlarni Taklif Qilish*\n\nHar bir taklif qilingan do'stingiz uchun siz *{bonus} ball* olasiz!\nDo'stingiz esa *{welcome} ball* bonus bilan boshlaydi.\n\n🔗 Sizning havolangiz:\n\`{link}\`\n\n📊 Siz taklif qilgan do'stlar: *{count}* ta\n💰 Jami olingan referal bonus: *{earnings}* ball`,
    uz_cyrl: `👥 *Дўстларни Таклиф Қилиш*\n\nҲар бир таклиф қилинган дўстингиз учун сиз *{bonus} балл* оласиз!\nДўстингиз эса *{welcome} балл* бонус билан бошлайди.\n\n🔗 Сизнинг ҳаволангиз:\n\`{link}\`\n\n📊 Сиз таклиф қилган дўстлар: *{count}* та\n💰 Жами олинган реферал бонус: *{earnings}* балл`,
    ru: `👥 *Приглашайте друзей*\n\nЗа каждого приглашённого друга вы получаете *{bonus} баллов*!\nА ваш друг начнёт с бонусом *{welcome} баллов*.\n\n🔗 Ваша ссылка:\n\`{link}\`\n\n📊 Приглашено друзей: *{count}*\n💰 Всего реферальных бонусов: *{earnings}* баллов`,
    en: `👥 *Invite Friends*\n\nFor each friend you invite, you get *{bonus} points*!\nYour friend starts with a *{welcome} points* bonus.\n\n🔗 Your link:\n\`{link}\`\n\n📊 Friends invited: *{count}*\n💰 Total referral bonus earned: *{earnings}* points`,
  },
  btnSendToFriend: { uz: "📤 Do'stga yuborish", uz_cyrl: '📤 Дўстга юбориш', ru: '📤 Отправить другу', en: '📤 Send to a friend' },
  referralShareText: { uz: 'BoomStroy — qurilish materiallari! Mendan bonus oling:', uz_cyrl: 'BoomStroy — қурилиш материаллари! Мендан бонус олинг:', ru: 'BoomStroy — строительные материалы! Получите бонус от меня:', en: 'BoomStroy — construction materials! Get a bonus from me:' },

  // ── PROMO ──
  promoEnterPrompt: { uz: '🎟️ *Promo-kodni kiriting:*\n\n_Masalan: PROMO-AB12CD_', uz_cyrl: '🎟️ *Промо-кодни киритинг:*\n\n_Масалан: PROMO-AB12CD_', ru: '🎟️ *Введите промокод:*\n\n_Например: PROMO-AB12CD_', en: '🎟️ *Enter promo code:*\n\n_For example: PROMO-AB12CD_' },
  promoInvalid: { uz: "❌ Promo-kod topilmadi yoki muddati o'tgan.", uz_cyrl: '❌ Промо-код топилмади ёки муддати ўтган.', ru: '❌ Промокод не найден или истёк.', en: '❌ Promo code not found or expired.' },
  promoUsed: { uz: '⚠️ Siz bu promo-koddan allaqachon foydalangansiz.', uz_cyrl: '⚠️ Сиз бу промокоддан аллақачон фойдалангансиз.', ru: '⚠️ Вы уже использовали этот промокод.', en: '⚠️ You have already used this promo code.' },
  promoAccepted: {
    uz: `✅ *Promo-kod qabul qilindi!*\n\n🎟️ {code}\n🎁 Chegirma: {disc}\n\nBu chegirma keyingi buyurtmangizga avtomatik qo'llanadi!`,
    uz_cyrl: `✅ *Промо-код қабул қилинди!*\n\n🎟️ {code}\n🎁 Чегирма: {disc}\n\nБу чегирма кейинги буюртмангизга автоматик қўлланади!`,
    ru: `✅ *Промокод принят!*\n\n🎟️ {code}\n🎁 Скидка: {disc}\n\nСкидка применится автоматически к следующему заказу!`,
    en: `✅ *Promo code accepted!*\n\n🎟️ {code}\n🎁 Discount: {disc}\n\nThis discount will be applied automatically to your next order!`,
  },

  // ── FAVORITES ──
  favRemoved: { uz: '💔 Sevimlilardan olib tashlandi', uz_cyrl: '💔 Севимлилардан олиб ташланди', ru: '💔 Удалено из избранного', en: '💔 Removed from favorites' },
  favAdded: { uz: "❤️ Sevimlilarga qo'shildi!", uz_cyrl: '❤️ Севимлиларга қўшилди!', ru: '❤️ Добавлено в избранное!', en: '❤️ Added to favorites!' },
  favEmpty: { uz: `❤️ Sevimlilar ro'yxati bo'sh.\n\nMahsulotlarni "❤️" tugmasi orqali qo'shing!`, uz_cyrl: `❤️ Севимлилар рўйхати бўш.\n\nМаҳсулотларни "❤️" тугмаси орқали қўшинг!`, ru: `❤️ Список избранного пуст.\n\nДобавляйте товары кнопкой "❤️"!`, en: `❤️ Your favorites list is empty.\n\nAdd products using the "❤️" button!` },
  favTitle: { uz: '❤️ *Sevimlilar* ({n} ta)\n\nTanlang:', uz_cyrl: '❤️ *Севимлилар* ({n} та)\n\nТанланг:', ru: '❤️ *Избранное* ({n})\n\nВыберите:', en: '❤️ *Favorites* ({n})\n\nSelect:' },

  // ── REVIEWS ──
  rateProduct: { uz: '⭐ Mahsulotga baho bering:', uz_cyrl: '⭐ Маҳсулотга баҳо беринг:', ru: '⭐ Оцените товар:', en: '⭐ Rate the product:' },
  reviewStarsChosen: { uz: '{stars} yulduz tanlandi', uz_cyrl: '{stars} юлдуз танланди', ru: 'Выбрано звёзд: {stars}', en: '{stars} star(s) selected' },
  reviewAskComment: { uz: `\n\n✍️ Izoh qoldirishni xohlaysizmi? Yozing yoki "o'tkazib yuborish" deb yuboring.`, uz_cyrl: `\n\n✍️ Изоҳ қолдиришни хоҳлайсизми? Ёзинг ёки "ўтказиб юбориш" деб юборинг.`, ru: `\n\n✍️ Хотите оставить комментарий? Напишите или нажмите «пропустить».`, en: `\n\n✍️ Want to leave a comment? Write it or press "skip".` },
  btnSkip: { uz: "⏭️ O'tkazib yuborish", uz_cyrl: '⏭️ Ўтказиб юбориш', ru: '⏭️ Пропустить', en: '⏭️ Skip' },
  reviewSaved: { uz: '✅ Rahmat! Sharhingiz saqlandi.', uz_cyrl: '✅ Раҳмат! Шарҳингиз сақланди.', ru: '✅ Спасибо! Ваш отзыв сохранён.', en: '✅ Thank you! Your review has been saved.' },
  reviewRatingSaved: { uz: '\n\n✅ Rahmat, bahoyingiz saqlandi!', uz_cyrl: '\n\n✅ Раҳмат, баҳойингиз сақланди!', ru: '\n\n✅ Спасибо, ваша оценка сохранена!', en: '\n\n✅ Thank you, your rating has been saved!' },
  reviewCancelled: { uz: '❌ Bekor qilindi.', uz_cyrl: '❌ Бекор қилинди.', ru: '❌ Отменено.', en: '❌ Cancelled.' },
  noReviews: { uz: "💬 Bu mahsulot uchun hali sharhlar yo'q.", uz_cyrl: '💬 Бу маҳсулот учун ҳали шарҳлар йўқ.', ru: '💬 Для этого товара пока нет отзывов.', en: '💬 No reviews for this product yet.' },
  reviewsTitle: { uz: '💬 *Sharhlar* ({n} ta)', uz_cyrl: '💬 *Шарҳлар* ({n} та)', ru: '💬 *Отзывы* ({n})', en: '💬 *Reviews* ({n})' },
  noComment: { uz: '_(izohsiz)_', uz_cyrl: '_(изоҳсиз)_', ru: '_(без комментария)_', en: '_(no comment)_' },

  // ── RECENTLY VIEWED ──
  recentEmpty: { uz: "🕐 Hali hech narsa ko'rmagansiz.", uz_cyrl: '🕐 Ҳали ҳеч нарса кўрмагансиз.', ru: '🕐 Вы ещё ничего не смотрели.', en: '🕐 You haven\'t viewed anything yet.' },
  recentTitle: { uz: "🕐 *Oxirgi ko'rilganlar*\n\nTanlang:", uz_cyrl: '🕐 *Охирги кўрилганлар*\n\nТанланг:', ru: '🕐 *Недавно просмотренные*\n\nВыберите:', en: '🕐 *Recently viewed*\n\nSelect:' },

  // ── ALERTS ──
  priceAlertSet: { uz: '🔔 Narx kamayganda sizga xabar beramiz!', uz_cyrl: '🔔 Нарх камайганда сизга хабар берамиз!', ru: '🔔 Сообщим вам, когда цена снизится!', en: '🔔 We\'ll notify you when the price drops!' },
  stockAlertSet: { uz: '🔔 Mahsulot kelganda xabar beramiz!', uz_cyrl: '🔔 Маҳсулот келганда хабар берамиз!', ru: '🔔 Сообщим, когда товар поступит!', en: '🔔 We\'ll notify you when it\'s back in stock!' },
  priceDrop: {
    uz: `🔥 *Narx tushdi!*\n\n📦 {name}\n~~{old} {som}~~ → *{new} {som}*\n\nTezroq buyurtma bering!`,
    uz_cyrl: `🔥 *Нарх тушди!*\n\n📦 {name}\n~~{old} {som}~~ → *{new} {som}*\n\nТезроқ буюртма беринг!`,
    ru: `🔥 *Цена снизилась!*\n\n📦 {name}\n~~{old} {som}~~ → *{new} {som}*\n\nЗакажите быстрее!`,
    en: `🔥 *Price dropped!*\n\n📦 {name}\n~~{old} {som}~~ → *{new} {som}*\n\nOrder quickly!`,
  },
  stockArrived: {
    uz: `✅ *Mahsulot qayta zaxiraga keldi!*\n\n📦 {name}\n💰 {price} {som}`,
    uz_cyrl: `✅ *Маҳсулот қайта захирага келди!*\n\n📦 {name}\n💰 {price} {som}`,
    ru: `✅ *Товар снова в наличии!*\n\n📦 {name}\n💰 {price} {som}`,
    en: `✅ *Product back in stock!*\n\n📦 {name}\n💰 {price} {som}`,
  },

  // ── SUPPORT ──
  supportPrompt: { uz: '✍️ Murojaatingizni yozing (savol, shikoyat, taklif):', uz_cyrl: '✍️ Мурожаатингизни ёзинг (савол, шикоят, таклиф):', ru: '✍️ Напишите ваше обращение (вопрос, жалоба, предложение):', en: '✍️ Write your message (question, complaint, suggestion):' },
  supportSent: { uz: '✅ Murojaatingiz qabul qilindi! Tez orada javob beramiz.', uz_cyrl: '✅ Мурожаатингиз қабул қилинди! Тез орада жавоб берамиз.', ru: '✅ Ваше обращение принято! Скоро ответим.', en: '✅ Your message has been received! We\'ll reply soon.' },
  supportNoTickets: { uz: "📋 Sizda murojaatlar yo'q.", uz_cyrl: '📋 Сизда мурожаатлар йўқ.', ru: '📋 У вас нет обращений.', en: '📋 You have no tickets.' },
  supportMyTitle: { uz: '📋 *Murojaatlaringiz:*', uz_cyrl: '📋 *Мурожаатларингиз:*', ru: '📋 *Ваши обращения:*', en: '📋 *Your tickets:*' },
  supportReplyLabel: { uz: '💬 Javob: ', uz_cyrl: '💬 Жавоб: ', ru: '💬 Ответ: ', en: '💬 Reply: ' },
  supportWaiting: { uz: '⏳ Javob kutilmoqda', uz_cyrl: '⏳ Жавоб кутилмоқда', ru: '⏳ Ожидает ответа', en: '⏳ Awaiting reply' },
  supportReplyToYou: { uz: '💬 *Sizning murojaatingizga javob:*', uz_cyrl: '💬 *Сизнинг мурожаатингизга жавоб:*', ru: '💬 *Ответ на ваше обращение:*', en: '💬 *Reply to your message:*' },
  btnNewTicket: { uz: '🆕 Murojaat yuborish', uz_cyrl: '🆕 Мурожаат юбориш', ru: '🆕 Новое обращение', en: '🆕 New ticket' },
  btnMyTickets: { uz: '📋 Murojaatlarim', uz_cyrl: '📋 Мурожаатларим', ru: '📋 Мои обращения', en: '📋 My tickets' },

  // ── ORDER RATING ──
  orderRateAsk: {
    uz: `⭐ Buyurtmangiz ({num}) yetkazildi!\n\nXizmatimizni qanday baholaysiz?`,
    uz_cyrl: `⭐ Буюртмангиз ({num}) етказилди!\n\nХизматимизни қандай баҳолайсиз?`,
    ru: `⭐ Ваш заказ ({num}) доставлен!\n\nКак вы оцениваете наш сервис?`,
    en: `⭐ Your order ({num}) has been delivered!\n\nHow would you rate our service?`,
  },
  thanksFeedback: { uz: '\n\nFikringiz uchun rahmat! 🙏', uz_cyrl: '\n\nФикрингиз учун раҳмат! 🙏', ru: '\n\nСпасибо за отзыв! 🙏', en: '\n\nThank you for your feedback! 🙏' },
  thanks: { uz: 'Rahmat!', uz_cyrl: 'Раҳмат!', ru: 'Спасибо!', en: 'Thank you!' },

  // ── FAQ ──
  faq: {
    uz: `❓ *Tez-tez so'raladigan savollar*\n\n*1. Qanday buyurtma berish mumkin?*\nMahsulotlar bo'limidan tanlang, savatga qo'shing va buyurtma bering.\n\n*2. To'lov qanday amalga oshiriladi?*\nNaqd (yetkazganda/olganda) yoki karta orqali oldindan.\n\n*3. Borib olish mumkinmi?*\nHa! Buyurtma berishda "🏪 Borib olish" ni tanlang — bepul.\n\n*4. Yetkazib berish qancha vaqt oladi?*\nMasofaga qarab 1-8 soat ichida.\n\n*5. Mahsulotni qaytarish mumkinmi?*\nHa, 24 soat ichida {support} ga yozing.\n\n*6. Bonus ballarni qanday ishlatish mumkin?*\n🎁 Bonus va Sodiqlik bo'limida sovg'alarga almashtiring (100 ball = 1 000 {som}).`,
    uz_cyrl: `❓ *Тез-тез сўраладиган саволлар*\n\n*1. Қандай буюртма бериш мумкин?*\nМаҳсулотлар бўлимидан танланг, саватга қўшинг ва буюртма беринг.\n\n*2. Тўлов қандай амалга оширилади?*\nНақд (етказганда/олганда) ёки карта орқали олдиндан.\n\n*3. Бориб олиш мумкинми?*\nҲа! Буюртма беришда "🏪 Бориб олиш" ни танланг — бепул.\n\n*4. Етказиб бериш қанча вақт олади?*\nМасофага қараб 1-8 соат ичида.\n\n*5. Маҳсулотни қайтариш мумкинми?*\nҲа, 24 соат ичида {support} га ёзинг.\n\n*6. Бонус балларни қандай ишлатиш мумкин?*\n🎁 Бонус ва Содиқлик бўлимида совғаларга алмаштиринг (100 балл = 1 000 {som}).`,
    ru: `❓ *Часто задаваемые вопросы*\n\n*1. Как сделать заказ?*\nВыберите в разделе товаров, добавьте в корзину и оформите заказ.\n\n*2. Как происходит оплата?*\nНаличными (при получении) или картой заранее.\n\n*3. Возможен ли самовывоз?*\nДа! При заказе выберите "🏪 Самовывоз" — бесплатно.\n\n*4. Сколько занимает доставка?*\nОт 1 до 8 часов в зависимости от расстояния.\n\n*5. Можно ли вернуть товар?*\nДа, в течение 24 часов напишите {support}.\n\n*6. Как использовать бонусные баллы?*\nОбменяйте их на подарки в разделе «Бонусы и Лояльность» (100 баллов = 1 000 {som}).`,
    en: `❓ *Frequently Asked Questions*\n\n*1. How do I place an order?*\nChoose from the products section, add to cart and order.\n\n*2. How is payment made?*\nCash (on delivery/pickup) or by card in advance.\n\n*3. Is pickup available?*\nYes! When ordering choose "🏪 Pickup" — free.\n\n*4. How long does delivery take?*\n1–8 hours depending on distance.\n\n*5. Can I return a product?*\nYes, within 24 hours write to {support}.\n\n*6. How do I use bonus points?*\nExchange them for rewards in the "Bonus & Loyalty" section (100 points = 1,000 {som}).`,
  },

  // ── RATE LIMIT / BLOCK ──
  rateLimited: { uz: '⚠️ Juda tez xabar yuboryapsiz. Biroz kuting.', uz_cyrl: '⚠️ Жуда тез хабар юборяпсиз. Бироз кутинг.', ru: '⚠️ Слишком частые сообщения. Подождите немного.', en: '⚠️ You\'re sending messages too fast. Please wait a moment.' },
  blocked: { uz: '❌ Hisobingiz bloklangan. {support} ga murojaat qiling.', uz_cyrl: '❌ Ҳисобингиз блокланган. {support} га мурожаат қилинг.', ru: '❌ Ваш аккаунт заблокирован. Обратитесь в {support}.', en: '❌ Your account is blocked. Contact {support}.' },
  locationReceived: { uz: '📍 Joylashuv qabul qilindi. Buyurtma berish uchun savatdan boshlang.', uz_cyrl: '📍 Жойлашув қабул қилинди. Буюртма бериш учун саватдан бошланг.', ru: '📍 Геолокация принята. Чтобы оформить заказ, начните с корзины.', en: '📍 Location received. To order, start from the cart.' },
  // ── YETKAZIB BERISH XATOLARI ──
  deliveryRestricted: {
    uz: `❌ Kechirasiz, "{zone}" hududiga yetkazib berish xizmati mavjud emas.\n\nBiz faqat Toshkent va yaqin atrofiga ({maxkm} km) yetkazib beramiz.\n\n🏪 Yoki "Borib olish" ni tanlang!`,
    uz_cyrl: `❌ Кечирасиз, "{zone}" ҳудудига етказиб бериш хизмати мавжуд эмас.\n\nБиз фақат Тошкент ва яқин атрофига ({maxkm} км) етказиб берамиз.\n\n🏪 Ёки "Бориб олиш" ни танланг!`,
    ru: `❌ К сожалению, доставка в зону "{zone}" недоступна.\n\nМы доставляем только по Ташкенту и окрестностям ({maxkm} км).\n\n🏪 Или выберите "Самовывоз"!`,
    en: `❌ Sorry, delivery to "{zone}" is not available.\n\nWe only deliver within Tashkent and nearby areas ({maxkm} km).\n\n🏪 Or choose "Pickup"!`,
  },
  deliveryTooFar: {
    uz: `❌ Yetkazib berish {maxkm} km gacha. Sizning manzilingiz {dist} km uzoqda.\n\n📍 Manzilingiz: {city}\n🏭 Ombor: {wh}\n\n🏪 "Borib olish" ni tanlashingiz mumkin!`,
    uz_cyrl: `❌ Етказиб бериш {maxkm} км гача. Сизнинг манзилингиз {dist} км узоқда.\n\n📍 Манзилингиз: {city}\n🏭 Омбор: {wh}\n\n🏪 "Бориб олиш" ни танлашингиз мумкин!`,
    ru: `❌ Доставка до {maxkm} км. Ваш адрес в {dist} км.\n\n📍 Ваш адрес: {city}\n🏭 Склад: {wh}\n\n🏪 Можете выбрать "Самовывоз"!`,
    en: `❌ Delivery is up to {maxkm} km. Your address is {dist} km away.\n\n📍 Your address: {city}\n🏭 Warehouse: {wh}\n\n🏪 You can choose "Pickup"!`,
  },

  // ── BUYURTMA HOLATLARI ──
  st_pending:      { uz: '⏳ Kutilmoqda', uz_cyrl: '⏳ Кутилмоқда', ru: '⏳ Ожидает', en: '⏳ Pending' },
  st_confirmed:    { uz: '✅ Tasdiqlangan', uz_cyrl: '✅ Тасдиқланган', ru: '✅ Подтверждён', en: '✅ Confirmed' },
  st_processing:   { uz: '🔧 Tayyorlanmoqda', uz_cyrl: '🔧 Тайёрланмоқда', ru: '🔧 Готовится', en: '🔧 Processing' },
  st_shipped:      { uz: "🚚 Yo'lda", uz_cyrl: '🚚 Йўлда', ru: '🚚 В пути', en: '🚚 Shipped' },
  st_delivered:    { uz: '✅ Yetkazildi', uz_cyrl: '✅ Етказилди', ru: '✅ Доставлен', en: '✅ Delivered' },
  st_cancelled:    { uz: '❌ Bekor qilindi', uz_cyrl: '❌ Бекор қилинди', ru: '❌ Отменён', en: '❌ Cancelled' },
  st_paid:         { uz: "💳 To'langan", uz_cyrl: '💳 Тўланган', ru: '💳 Оплачен', en: '💳 Paid' },
  st_paid_pending: { uz: "💳 To'lov tekshirilmoqda", uz_cyrl: '💳 Тўлов текширилмоқда', ru: '💳 Оплата проверяется', en: '💳 Payment pending' },

  // ── ADMIN → MIJOZGA HOLAT XABARLARI ──
  notifyConfirmed: {
    uz: `✅ *Buyurtma tasdiqlandi!*\n\n📋 {num}\n💰 {grand} {som}\n\n🔧 Mahsulotlar tayyorlanmoqda...`,
    uz_cyrl: `✅ *Буюртма тасдиқланди!*\n\n📋 {num}\n💰 {grand} {som}\n\n🔧 Маҳсулотлар тайёрланмоқда...`,
    ru: `✅ *Заказ подтверждён!*\n\n📋 {num}\n💰 {grand} {som}\n\n🔧 Товары готовятся...`,
    en: `✅ *Order confirmed!*\n\n📋 {num}\n💰 {grand} {som}\n\n🔧 Preparing your items...`,
  },
  notifyShipped: {
    uz: `🚚 *Buyurtma yo'lga chiqdi!*\n\n📋 {num}\n📍 {city}\n\n_Tez orada yetib boradi!_`,
    uz_cyrl: `🚚 *Буюртма йўлга чиқди!*\n\n📋 {num}\n📍 {city}\n\n_Тез орада етиб боради!_`,
    ru: `🚚 *Заказ в пути!*\n\n📋 {num}\n📍 {city}\n\n_Скоро прибудет!_`,
    en: `🚚 *Your order is on the way!*\n\n📋 {num}\n📍 {city}\n\n_Arriving soon!_`,
  },
  notifyReadyPickup: {
    uz: `📦 *Buyurtmangiz tayyor!*\n\n📋 {num}\n🏪 {wh}\n\n_Omborga borib olishingiz mumkin._`,
    uz_cyrl: `📦 *Буюртмангиз тайёр!*\n\n📋 {num}\n🏪 {wh}\n\n_Омборга бориб олишингиз мумкин._`,
    ru: `📦 *Ваш заказ готов!*\n\n📋 {num}\n🏪 {wh}\n\n_Можете забрать со склада._`,
    en: `📦 *Your order is ready!*\n\n📋 {num}\n🏪 {wh}\n\n_You can collect it from the warehouse._`,
  },
  notifyDelivered: {
    uz: `✅ *Buyurtma yetkazildi!*\n\n📋 {num}\n💰 {grand} {som}\n\n⭐ BoomStroy ni tanlaganingiz uchun rahmat!`,
    uz_cyrl: `✅ *Буюртма етказилди!*\n\n📋 {num}\n💰 {grand} {som}\n\n⭐ BoomStroy ни танлаганингиз учун раҳмат!`,
    ru: `✅ *Заказ доставлен!*\n\n📋 {num}\n💰 {grand} {som}\n\n⭐ Спасибо, что выбрали BoomStroy!`,
    en: `✅ *Order delivered!*\n\n📋 {num}\n💰 {grand} {som}\n\n⭐ Thank you for choosing BoomStroy!`,
  },
  notifyCancelled: {
    uz: `❌ *Buyurtma bekor qilindi*\n\n📋 {num}\n\nSabab bo'yicha murojaat qiling.`,
    uz_cyrl: `❌ *Буюртма бекор қилинди*\n\n📋 {num}\n\nСабаб бўйича мурожаат қилинг.`,
    ru: `❌ *Заказ отменён*\n\n📋 {num}\n\nОбратитесь к нам по поводу причины.`,
    en: `❌ *Order cancelled*\n\n📋 {num}\n\nContact us regarding the reason.`,
  },
  notifyPayOk: {
    uz: `✅ *To'lovingiz tasdiqlandi!*\n\n📋 {num}\n💰 {grand} {som}\n\nBuyurtmangiz tayyorlanmoqda! 🔧`,
    uz_cyrl: `✅ *Тўловингиз тасдиқланди!*\n\n📋 {num}\n💰 {grand} {som}\n\nБуюртмангиз тайёрланмоқда! 🔧`,
    ru: `✅ *Ваша оплата подтверждена!*\n\n📋 {num}\n💰 {grand} {som}\n\nЗаказ готовится! 🔧`,
    en: `✅ *Your payment is confirmed!*\n\n📋 {num}\n💰 {grand} {som}\n\nYour order is being prepared! 🔧`,
  },
  notifyPayFail: {
    uz: `❌ *To'lovingiz tasdiqlanmadi*\n\n📋 {num}\n\nIltimos, qayta to'lov qiling yoki bog'laning.`,
    uz_cyrl: `❌ *Тўловингиз тасдиқланмади*\n\n📋 {num}\n\nИлтимос, қайта тўлов қилинг ёки боғланинг.`,
    ru: `❌ *Ваша оплата не подтверждена*\n\n📋 {num}\n\nПожалуйста, оплатите снова или свяжитесь с нами.`,
    en: `❌ *Your payment was not confirmed*\n\n📋 {num}\n\nPlease pay again or contact us.`,
  },

  comeBack: {
    uz: `👋 Sizni sog'indik!\n\n🎁 Qaytib kelganingiz uchun sizga maxsus bonus tayyorladik. "🎁 Bonus va Sodiqlik" bo'limini tekshiring!`,
    uz_cyrl: `👋 Сизни соғиндик!\n\n🎁 Қайтиб келганингиз учун сизга махсус бонус тайёрладик. "🎁 Бонус ва Содиқлик" бўлимини текширинг!`,
    ru: `👋 Мы соскучились!\n\n🎁 Для вашего возвращения мы приготовили особый бонус. Загляните в раздел «🎁 Бонусы и Лояльность»!`,
    en: `👋 We missed you!\n\n🎁 We've prepared a special bonus for your return. Check the "🎁 Bonus & Loyalty" section!`,
  },
};

// ─── ASOSIY FUNKSIYALAR ──────────────────────────────────────────────────────

function interpolate(str, vars = {}) {
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''));
}

function t(lang, key, vars = {}) {
  const l = normalizeLang(lang);
  const entry = T[key];
  if (!entry) return key; // kalit topilmasa o'zini qaytaradi
  const str = entry[l] || entry[DEFAULT_LANG] || entry.uz || key;
  return interpolate(str, vars);
}

// Reply-keyboard tugmasining barcha tillardagi variantlari (bot.hears uchun)
function variants(key) {
  const entry = T[key];
  if (!entry) return [];
  return [...new Set(LANGS.map(l => entry[l]).filter(Boolean))];
}

// Bir nechta kalitlarning barcha variantlari
function variantsOf(...keys) {
  const set = new Set();
  for (const k of keys) variants(k).forEach(v => set.add(v));
  return [...set];
}

// ctx dan foydalanuvchi tilini olish (middleware ctx.state.lang ni o'rnatadi)
function langOf(ctx) {
  return normalizeLang(ctx?.state?.lang);
}

module.exports = {
  LANGS,
  DEFAULT_LANG,
  SITE_URL,
  normalizeLang,
  langOf,
  t,
  variants,
  variantsOf,
  T,
};
