const axios = require('axios');

// Ombor koordinatalari (admin paneldagi asosiy ombor)
const WAREHOUSE = {
  lat: parseFloat(process.env.WAREHOUSE_LAT || '41.299496'),
  lng: parseFloat(process.env.WAREHOUSE_LNG || '69.240073'),
  name: process.env.WAREHOUSE_NAME || 'Asosiy Ombor (Toshkent)',
};

const BASE_FEE = parseInt(process.env.BASE_DELIVERY_FEE || '10000');
const PER_KM = parseInt(process.env.DELIVERY_PER_KM || '2000');
const MAX_KM = parseInt(process.env.MAX_DELIVERY_KM || '50');

// Taqiqlangan hududlar - Bo'ka tumani va boshqalar
const RESTRICTED_KEYWORDS = [
  "bo'ka", "boka", "bo`ka", "бўка", "бока",
  "bo'ka tumani", "boka tumani", "bo'ka district",
  // Qo'shimcha masofadagi hududlar
  "sirdaryo", "jizzax", "samarqand", "navoiy", "buxoro",
  "qashqadaryo", "surxondaryo", "xorazm", "qoraqalpog",
  "fergana", "farg'ona", "namangan", "andijon",
];

/**
 * Haversine formula - ikki nuqta orasidagi masofani km da hisoblaydi
 */
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Koordinatalardan manzil nomini oladi (Nominatim)
 */
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=uz,ru`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'BoomStroy-Bot/2.0' },
      timeout: 5000,
    });
    const d = res.data;
    const addr = d.address || {};
    return {
      display: d.display_name || `${lat}, ${lng}`,
      city: addr.city || addr.town || addr.village || addr.county || '',
      district: addr.county || addr.suburb || addr.district || '',
      region: addr.state || addr.province || '',
      country: addr.country || '',
      raw: addr,
    };
  } catch (e) {
    return {
      display: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      city: '', district: '', region: '', country: '', raw: {},
    };
  }
}

/**
 * Manzilni qidiradi va koordinatalarini qaytaradi
 */
async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=uz,ru`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'BoomStroy-Bot/2.0' },
      timeout: 5000,
    });
    if (res.data && res.data.length > 0) {
      const r = res.data[0];
      return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), display: r.display_name };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Hudud taqiqlangan yoki yo'qligini tekshiradi
 */
function isRestrictedZone(addressInfo) {
  const text = [
    addressInfo.city, addressInfo.district, addressInfo.region, addressInfo.display
  ].join(' ').toLowerCase();

  for (const kw of RESTRICTED_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      return { restricted: true, reason: kw };
    }
  }
  return { restricted: false };
}

/**
 * Yetkazib berish narxini hisoblaydi
 * Buyurtmalar soniga qarab avtomatik ko'payadi
 */
function calcDeliveryFee(distanceKm, orderCount = 1) {
  if (distanceKm > MAX_KM) {
    return {
      success: false,
      error: `Yetkazib berish ${MAX_KM} km gacha. Sizning manzilingiz ${distanceKm.toFixed(1)} km uzoqda.`,
    };
  }

  const baseFee = BASE_FEE;
  const distanceFee = Math.round(distanceKm * PER_KM);

  // Buyurtmalar soniga qarab chegirma/oshirish
  let multiplier = 1;
  if (orderCount >= 10) multiplier = 0.85; // 15% chegirma
  else if (orderCount >= 5) multiplier = 0.90; // 10% chegirma
  else if (orderCount >= 3) multiplier = 0.95; // 5% chegirma

  const total = Math.round((baseFee + distanceFee) * multiplier);

  return {
    success: true,
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    baseFee,
    distanceFee,
    multiplier,
    total,
    breakdown: `${fmtNum(baseFee)} + ${fmtNum(distanceFee)} (${distanceKm.toFixed(1)} km × ${fmtNum(PER_KM)})`,
    discount: multiplier < 1 ? `${Math.round((1 - multiplier) * 100)}% chegirma (${orderCount} buyurtma)` : null,
  };
}

/**
 * To'liq yetkazib berish tekshiruvi va narx hisoblash
 */
async function checkDelivery(lat, lng, orderCount = 1) {
  // Manzilni olish
  const geoInfo = await reverseGeocode(lat, lng);

  // Taqiqlangan hudud tekshiruvi
  const restriction = isRestrictedZone(geoInfo);
  if (restriction.restricted) {
    return {
      success: false,
      restricted: true,
      reason: restriction.reason,
      address: geoInfo.display,
      message: `❌ Kechirasiz, "${restriction.reason}" hududiga yetkazib berish xizmati mavjud emas.\n\nBiz faqat Toshkent va yaqin atrofiga (${MAX_KM} km) yetkazib beramiz.`,
    };
  }

  // Masofa hisoblash
  const distance = calcDistance(WAREHOUSE.lat, WAREHOUSE.lng, lat, lng);

  // Narx hisoblash
  const fee = calcDeliveryFee(distance, orderCount);
  if (!fee.success) {
    return {
      success: false,
      restricted: false,
      tooFar: true,
      address: geoInfo.display,
      distance: parseFloat(distance.toFixed(2)),
      message: `❌ ${fee.error}\n\n📍 Manzilingiz: ${escapeMd(geoInfo.city || geoInfo.district)}\n🏭 Ombor: ${escapeMd(WAREHOUSE.name)}`,
    };
  }

  return {
    success: true,
    address: geoInfo.display,
    city: geoInfo.city || geoInfo.district,
    district: geoInfo.district,
    distance: fee.distanceKm,
    deliveryFee: fee.total,
    breakdown: fee.breakdown,
    discount: fee.discount,
    warehouse: WAREHOUSE.name,
    mapsLink: `https://www.google.com/maps?q=${lat},${lng}`,
    yandexLink: `https://yandex.uz/maps/?pt=${lng},${lat}&z=15`,
  };
}

function fmtNum(n) {
  return Math.round(n || 0).toLocaleString('uz-UZ');
}

function escapeMd(text) {
  if (!text) return '';
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

module.exports = {
  checkDelivery,
  reverseGeocode,
  geocodeAddress,
  calcDistance,
  isRestrictedZone,
  calcDeliveryFee,
  escapeMd,
  WAREHOUSE,
  BASE_FEE,
  PER_KM,
  MAX_KM,
  RESTRICTED_KEYWORDS,
};
