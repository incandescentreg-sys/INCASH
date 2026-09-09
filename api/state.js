const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const telegramId =
    (req.method === 'GET' && req.query.telegramId) ||
    (req.method === 'POST' && req.body && req.body.telegramId);

  if (!telegramId) {
    res.status(400).json({ error: 'telegramId is required' });
    return;
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS players (
        telegram_id BIGINT PRIMARY KEY,
        name TEXT,
        username TEXT,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT data, name, username, updated_at
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
        updatedAt: rows[0].updated_at
      });
      return;
    }

    if (req.method === 'POST') {
      const { data, name, username } = req.body || {};
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