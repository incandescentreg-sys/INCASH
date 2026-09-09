const crypto = require('crypto');

/**
 * Validates Telegram WebApp initData using HMAC-SHA256.
 * @param {string} initData - raw query string from tg.initData
 * @param {string} botToken - TELEGRAM_BOT_TOKEN from env
 * @returns {object|null} parsed data or null
 */
function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const sorted = [];
  for (const [k, v] of params.entries()) {
    sorted.push(k + '=' + v);
  }
  sorted.sort();
  const dataCheckString = sorted.join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) return null;

  const userStr = params.get('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Checks if a telegram_id is in the ADMIN_IDS list.
 * ADMIN_IDS from env — comma-separated numbers, e.g. "123456,789012"
 */
function isAdmin(telegramId) {
  if (!telegramId) return false;
  const ids = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return ids.includes(String(telegramId));
}

module.exports = { validateInitData, isAdmin };