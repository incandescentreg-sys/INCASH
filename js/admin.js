const Admin = (() => {
  let isAdminUser = false;
  let playersCache = [];

  function init() {
    document.getElementById('devBtn').addEventListener('click', () => showAdmin());
    document.getElementById('adminSelfGrant').addEventListener('click', selfGrant);
    document.getElementById('adminSelfSetBtn').addEventListener('click', selfSet);
    document.getElementById('adminSearchBtn').addEventListener('click', searchPlayers);
    document.getElementById('adminBatchGrant').addEventListener('click', batchGrant);
    document.getElementById('banReloadBtn').addEventListener('click', () => location.reload());

    document.querySelectorAll('[data-atab]').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('[data-atab]').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('apanel-' + t.dataset.atab).classList.add('active');
      });
    });

    // search on Enter
    document.getElementById('adminSearch').addEventListener('keydown', e => {
      if (e.key === 'Enter') searchPlayers();
    });

    // Load admin status via /api/admin GET (requires init-data header)
    checkAdmin();
  }

  function getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (initData) h['X-Telegram-Init-Data'] = initData;
    } catch (e) {}
    return h;
  }

  async function apiAdmin(body) {
    try {
      const res = await fetch('/api/admin', {
        method: body ? 'POST' : 'GET',
        headers: getHeaders(),
        body: body ? JSON.stringify(body) : undefined
      });
      return await res.json();
    } catch (e) {
      console.warn('admin api error', e);
      return { error: e.message };
    }
  }

  async function checkAdmin() {
    const json = await apiAdmin(null);
    if (json && json.players) {
      isAdminUser = true;
      document.getElementById('devBtn').style.display = 'block';
    } else if (json && json.error === 'forbidden') {
      isAdminUser = false;
    }
  }

  function showAdmin() {
    const g = window.Game;
    document.getElementById('adminMyId').textContent = '—';
    document.getElementById('adminMyBalance').textContent = '—';
    // Fill self info
    try {
      const tg = window.Telegram?.WebApp;
      const user = tg?.initDataUnsafe?.user;
      if (user) document.getElementById('adminMyId').textContent = String(user.id);
    } catch (e) {}
    document.getElementById('adminMyBalance').textContent = g.format(g.balance);
    window.Game.showScreen('admin');
    // Load players list
    searchPlayers();
  }

  async function selfGrant() {
    const amount = parseInt(document.getElementById('adminSelfAmount').value, 10) || 0;
    if (amount <= 0) return;
    const g = window.Game;
    try {
      const tg = window.Telegram?.WebApp;
      const userId = tg?.initDataUnsafe?.user?.id;
      if (!userId) { g.toast('Не определён Telegram ID', 'bad'); return; }
      const json = await apiAdmin({ action: 'grant-coins', targetId: String(userId), amount });
      if (json.ok) {
        // Reload from server
        setTimeout(() => location.reload(), 500);
        g.toast('Выдано +' + g.format(amount) + ' 🪙', 'good');
      } else {
        g.toast(json.error || 'Ошибка', 'bad');
      }
    } catch (e) { g.toast('Ошибка', 'bad'); }
  }

  async function selfSet() {
    const amount = parseInt(document.getElementById('adminSelfSet').value, 10) || 0;
    if (amount < 0) return;
    const g = window.Game;
    try {
      const tg = window.Telegram?.WebApp;
      const userId = tg?.initDataUnsafe?.user?.id;
      if (!userId) { g.toast('Не определён Telegram ID', 'bad'); return; }
      const json = await apiAdmin({ action: 'set-balance', targetId: String(userId), amount });
      if (json.ok) {
        setTimeout(() => location.reload(), 500);
        g.toast('Баланс установлен: ' + g.format(amount) + ' 🪙', 'good');
      } else {
        g.toast(json.error || 'Ошибка', 'bad');
      }
    } catch (e) { g.toast('Ошибка', 'bad'); }
  }

  async function searchPlayers() {
    const q = document.getElementById('adminSearch').value.trim();
    const json = await apiAdmin({ action: 'search', query: q || '' });
    const el = document.getElementById('adminPlayerList');
    if (json.error || !json.players) {
      el.innerHTML = '<div class="prop-empty">' + (json.error || 'Ничего не найдено') + '</div>';
      return;
    }
    playersCache = json.players;
    el.innerHTML = json.players.map(p => {
      const b = parseInt(p.balance || '0', 10);
      return '<div class="admin-player-card">' +
        '<div class="ap-row">' +
        '<span class="ap-name">' + (p.name || '—') + '</span>' +
        '<span class="ap-balance">' + (b).toLocaleString('ru-RU') + ' 🪙</span>' +
        '</div>' +
        '<div class="ap-row">' +
        '<span class="ap-id">@' + (p.username || '—') + ' · ID ' + p.telegram_id + '</span>' +
        (p.banned ? '<span class="ap-banned">🚫 ЗАБАНЕН</span>' : '') +
        '</div>' +
        '<div class="ap-actions">' +
        '<button class="btn btn-sm btn-gold" data-admin-grant="' + p.telegram_id + '">Выдать 5000</button>' +
        '<button class="btn btn-sm" data-admin-set="' + p.telegram_id + '">Уст. 999999</button>' +
        (p.banned
          ? '<button class="btn btn-sm btn-green" data-admin-unban="' + p.telegram_id + '">Разбанить</button>'
          : '<button class="btn btn-sm btn-red" data-admin-ban="' + p.telegram_id + '">Забанить</button>'
        ) +
        '</div></div>';
    }).join('');

    el.querySelectorAll('[data-admin-grant]').forEach(b => {
      b.addEventListener('click', () => adminAction('grant-coins', b.dataset.adminGrant, { amount: 5000 }));
    });
    el.querySelectorAll('[data-admin-set]').forEach(b => {
      b.addEventListener('click', () => adminAction('set-balance', b.dataset.adminSet, { amount: 999999 }));
    });
    el.querySelectorAll('[data-admin-ban]').forEach(b => {
      b.addEventListener('click', () => adminAction('ban', b.dataset.adminBan));
    });
    el.querySelectorAll('[data-admin-unban]').forEach(b => {
      b.addEventListener('click', () => adminAction('unban', b.dataset.adminUnban));
    });
  }

  async function adminAction(action, targetId, extra) {
    const g = window.Game;
    const body = { action, targetId: String(targetId), ...extra };
    const json = await apiAdmin(body);
    if (json.ok) {
      g.toast('Готово ✅', 'good');
      searchPlayers();
    } else {
      g.toast(json.error || 'Ошибка', 'bad');
    }
  }

  async function batchGrant() {
    const g = window.Game;
    const filter = document.getElementById('adminBatchFilter').value.trim();
    const amount = parseInt(document.getElementById('adminBatchAmount').value, 10) || 0;
    if (amount <= 0) { g.toast('Укажи сумму', 'bad'); return; }
    const json = await apiAdmin({ action: 'grant-batch', amount, usernameFilter: filter });
    if (json.ok) {
      g.toast('Выдано ' + g.format(amount) + ' 🪙 ' + json.updated + ' игрокам', 'good');
      searchPlayers();
    } else {
      g.toast(json.error || 'Ошибка', 'bad');
    }
  }

  return { init, checkAdmin, isAdmin: () => isAdminUser };
})();