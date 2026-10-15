// Adminlar ro'yxati (bitta joyda):
//   ADMIN_TELEGRAM_ID — asosiy adminlar (vergul bilan)
//   ADMIN_EXTRA_IDS   — qo'shimcha adminlar (vergul bilan)
const parse = (v) => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
const ADMIN_IDS = [...new Set([...parse(process.env.ADMIN_TELEGRAM_ID), ...parse(process.env.ADMIN_EXTRA_IDS)])];
const isAdminId = (id) => ADMIN_IDS.includes(String(id));
module.exports = { ADMIN_IDS, isAdminId };
