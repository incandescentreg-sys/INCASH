const { sql } = require('@vercel/postgres');
const { validateInitData, isAdmin } = require('../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Auth: validate Telegram initData
  const initData = req.headers['x-telegram-init-data'];
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const user = validateInitData(initData, botToken);
  if (!user || !isAdmin(String(user.id))) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const { action } = req.body || {};

  try {
    // GET /api/admin — list all players with basic info
    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT telegram_id, name, username, banned,
               data->>'balance' AS balance,
               data->>'gamesPlayed' AS games_played,
               updated_at
        FROM players ORDER BY updated_at DESC LIMIT 200
      `;
      res.status(200).json({ players: rows });
      return;
    }

    // --- BATCH: grant coins to many players ---
    if (action === 'grant-batch') {
      const { amount, usernameFilter } = req.body;
      const num = parseInt(amount, 10);
      if (isNaN(num) || num < 0 || num > 999999999) {
        res.status(400).json({ error: 'invalid amount (1–999999999)' });
        return;
      }

      const { rows } = await sql`
        SELECT telegram_id, data FROM players
        WHERE username ILIKE ${'%' + (usernameFilter || '') + '%'} OR
              (data->>'balance')::text IS NOT NULL
        LIMIT 500
      `;

      let updated = 0;
      for (const row of rows) {
        const d = typeof row.data === 'object' ? row.data : {};
        const cur = parseInt(d.balance || '0', 10);
        d.balance = cur + num;
        await sql`
          UPDATE players SET data = ${JSON.stringify(d)}::jsonb, updated_at = NOW()
          WHERE telegram_id = ${row.telegram_id}
        `;
        updated++;
      }
      res.status(200).json({ ok: true, updated });
      return;
    }

    // --- SINGLE TARGET ---
    const targetId = req.body.targetId;
    if (!targetId) {
      res.status(400).json({ error: 'targetId required' });
      return;
    }

    // action: set-balance
    if (action === 'set-balance') {
      const amount = parseInt(req.body.amount, 10);
      if (isNaN(amount) || amount < 0) {
        res.status(400).json({ error: 'invalid amount' });
        return;
      }
      const { rows } = await sql`
        SELECT data FROM players WHERE telegram_id = ${targetId}
      `;
      if (rows.length === 0) { res.status(404).json({ error: 'player not found' }); return; }
      const d = typeof rows[0].data === 'object' ? rows[0].data : {};
      d.balance = amount;
      await sql`
        UPDATE players SET data = ${JSON.stringify(d)}::jsonb, updated_at = NOW()
        WHERE telegram_id = ${targetId}
      `;
      res.status(200).json({ ok: true, balance: amount });
      return;
    }

    // action: grant-coins
    if (action === 'grant-coins') {
      const amount = parseInt(req.body.amount, 10);
      if (isNaN(amount) || amount <= 0) {
        res.status(400).json({ error: 'invalid amount' });
        return;
      }
      const { rows } = await sql`
        SELECT data FROM players WHERE telegram_id = ${targetId}
      `;
      if (rows.length === 0) { res.status(404).json({ error: 'player not found' }); return; }
      const d = typeof rows[0].data === 'object' ? rows[0].data : {};
      d.balance = (parseInt(d.balance || '0', 10)) + amount;
      await sql`
        UPDATE players SET data = ${JSON.stringify(d)}::jsonb, updated_at = NOW()
        WHERE telegram_id = ${targetId}
      `;
      res.status(200).json({ ok: true, balance: d.balance });
      return;
    }

    // action: ban / unban
    if (action === 'ban' || action === 'unban') {
      const banned = action === 'ban';
      const { rows } = await sql`
        UPDATE players SET banned = ${banned}, updated_at = NOW()
        WHERE telegram_id = ${targetId}
        RETURNING telegram_id, banned, name, username
      `;
      if (rows.length === 0) { res.status(404).json({ error: 'player not found' }); return; }
      res.status(200).json({ ok: true, player: rows[0] });
      return;
    }

    // action: info
    if (action === 'info') {
      const { rows } = await sql`
        SELECT telegram_id, name, username, banned, data, updated_at
        FROM players WHERE telegram_id = ${targetId}
      `;
      if (rows.length === 0) { res.status(404).json({ error: 'player not found' }); return; }
      res.status(200).json({ player: rows[0] });
      return;
    }

    // action: search by username
    if (action === 'search') {
      const q = '%' + (req.body.query || '') + '%';
      const { rows } = await sql`
        SELECT telegram_id, name, username, banned,
               data->>'balance' AS balance,
               data->>'gamesPlayed' AS games_played,
               updated_at
        FROM players
        WHERE username ILIKE ${q} OR name ILIKE ${q}
        ORDER BY updated_at LIMIT 50
      `;
      res.status(200).json({ players: rows });
      return;
    }

    res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    console.error('api/admin error:', err);
    res.status(500).json({ error: 'internal error' });
  }
};