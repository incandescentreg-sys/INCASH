const { sql } = require('@vercel/postgres');
const { validateInitData, isAdmin } = require('../lib/auth');

function extractTelegramId(headers, body, query) {
  const initData = headers['x-telegram-init-data'];
  if (!initData) {
    // admin endpoints use raw telegramId
    return (query && query.telegramId) || (body && body.telegramId) || null;
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const user = validateInitData(initData, botToken);
  return user ? String(user.id) : null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const telegramId = extractTelegramId(req.headers, req.body, req.query);

  if (!telegramId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS players (
        telegram_id BIGINT PRIMARY KEY,
        name TEXT,
        username TEXT,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        banned BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT data, name, username, banned, updated_at
        FROM players
        WHERE telegram_id = ${telegramId}
      `;
      if (rows.length === 0) {
        res.status(200).json({ data: null });
        return;
      }
      res.status(200).json({
        data: rows[0].data,
        name: rows[0].name,
        username: rows[0].username,
        banned: !!rows[0].banned,
        updatedAt: rows[0].updated_at
      });
      return;
    }

    if (req.method === 'POST') {
      const { data, name, username } = req.body || {};

      // Block banned players from saving
      const { rows: check } = await sql`
        SELECT banned FROM players WHERE telegram_id = ${telegramId}
      `;
      if (check.length > 0 && check[0].banned) {
        res.status(403).json({ error: 'banned' });
        return;
      }

      const payload = data && typeof data === 'object' ? JSON.stringify(data) : '{}';
      const { rows } = await sql`
        INSERT INTO players (telegram_id, name, username, data, updated_at)
        VALUES (${telegramId}, ${name || null}, ${username || null}, ${payload}::jsonb, NOW())
        ON CONFLICT (telegram_id) DO UPDATE SET
          data = EXCLUDED.data,
          name = COALESCE(EXCLUDED.name, players.name),
          username = COALESCE(EXCLUDED.username, players.username),
          updated_at = NOW()
        RETURNING data
      `;
      res.status(200).json({ ok: true, data: rows[0].data });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('api/state error:', err);
    res.status(500).json({ error: 'internal error' });
  }
};