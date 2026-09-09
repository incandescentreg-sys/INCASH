(function () {
  'use strict';

  const LEVELS = [
    { level: 1, title: 'Новичок', xp: 0 },
    { level: 2, title: 'Игрок', xp: 500 },
    { level: 3, title: 'Счастливчик', xp: 1500 },
    { level: 4, title: 'Делец', xp: 4000 },
    { level: 5, title: 'Магнат', xp: 10000 },
    { level: 6, title: 'Элита', xp: 25000 },
    { level: 7, title: 'Миллиардер', xp: 60000 },
    { level: 8, title: 'Легенда', xp: 150000 },
    { level: 9, title: 'Император', xp: 400000 },
    { level: 10, title: 'Вершина 🏆', xp: 1000000 }
  ];

  const LOCAL_KEY = 'incash_save';
  const SAVE_DEBOUNCE = 1500;

  function format(n) { return n.toLocaleString('ru-RU'); }

  let state = {
    balance: 0,
    xp: 0,
    gamesPlayed: 0,
    totalWagered: 0,
    totalWon: 0,
    props: [],
    cars: [],
    lastIncome: Date.now(),
    claimedBonus: false,
    name: ''
  };

  let tg = null;
  let tgUser = null;          // { id, first_name, last_name, username }
  let lastLocalSave = '';
  let saveTimer = null;
  let serverReady = false;    // server save enabled once we know telegramId
  let saving = false;
  let pendingSave = false;

  /* ---------- helpers ---------- */

  function telegramId() {
    return tgUser ? String(tgUser.id) : '';
  }

  function localSave() {
    try {
      const s = JSON.stringify(state);
      if (s === lastLocalSave) return;
      lastLocalSave = s;
      localStorage.setItem(LOCAL_KEY, s);
    } catch (e) {}
  }

  function loadLocal() {
    try {
      const s = localStorage.getItem(LOCAL_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        Object.assign(state, parsed);
        lastLocalSave = s;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function pushLocal() {
    try {
      const s = JSON.stringify(state);
      if (s !== lastLocalSave) {
        lastLocalSave = s;
        localStorage.setItem(LOCAL_KEY, s);
      }
    } catch (e) {}
  }

  /* ---------- server ---------- */

  async function serverSave(immediate) {
    if (!serverReady) return;
    if (saving) { pendingSave = true; return; }
    if (!immediate) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => serverSave(true), SAVE_DEBOUNCE);
      return;
    }
    saving = true;
    try {
      const body = {
        telegramId: telegramId(),
        name: state.name,
        username: tgUser && tgUser.username ? tgUser.username : null,
        data: {
          balance: state.balance,
          xp: state.xp,
          gamesPlayed: state.gamesPlayed,
          totalWagered: state.totalWagered,
          totalWon: state.totalWon,
          props: state.props,
          cars: state.cars,
          lastIncome: state.lastIncome,
          claimedBonus: state.claimedBonus,
          name: state.name
        }
      };
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('server save failed: ' + res.status);
    } catch (e) {
      console.warn('server save error', e);
    } finally {
      saving = false;
      if (pendingSave) {
        pendingSave = false;
        serverSave(true);
      }
    }
  }

  async function serverGet() {
    if (!telegramId()) return;
    try {
      const res = await fetch('/api/state?telegramId=' + encodeURIComponent(telegramId()));
      if (!res.ok) throw new Error('server get failed: ' + res.status);
      const json = await res.json();
      return json && json.data ? json.data : null;
    } catch (e) {
      console.warn('server get error', e);
      return null;
    }
  }

  /* ---------- core ---------- */

  function save() {
    localSave();
    serverSave(false);
  }

  function getLevel() {
    let lv = LEVELS[0];
    for (const l of LEVELS) {
      if (state.xp >= l.xp) lv = l;
    }
    return lv;
  }

  function getNextLevel() {
    const cur = getLevel();
    const idx = LEVELS.indexOf(cur);
    return idx + 1 < LEVELS.length ? LEVELS[idx + 1] : null;
  }

  function getTotalRate() {
    let r = 0;
    state.props.forEach(pid => {
      const item = REALTY.find(x => x.id === pid);
      if (item) r += item.rate;
    });
    state.cars.forEach(cid => {
      const item = CARS.find(x => x.id === cid);
      if (item) r += item.bonus;
    });
    return r;
  }

  function addXP(amount) {
    state.xp += amount;
    updateXP();
  }

  function spend(amount) {
    if (state.balance < amount) return false;
    state.balance -= amount;
    state.totalWagered += amount;
    state.gamesPlayed++;
    addXP(Math.round(amount / 5));
    refresh();
    save();
    return true;
  }

  function win(amount) {
    state.balance += amount;
    state.totalWon += amount;
    refresh();
    save();
  }

  function refresh() {
    document.getElementById('balance').textContent = format(state.balance);
    document.getElementById('statProp').textContent = state.props.length + state.cars.length;
    document.getElementById('statRate').textContent = format(getTotalRate());
    document.getElementById('statLevel').textContent = getLevel().level;
  }

  function refreshProfile() {
    const name = state.name || 'Игрок';
    document.getElementById('profileName').textContent = name;
    document.getElementById('welcomeName').textContent = name;

    const telEl = document.getElementById('profileTelegram');
    if (telEl) {
      if (tgUser) {
        telEl.textContent = 'Telegram: ' + (tgUser.username ? '@' + tgUser.username : 'ID ' + tgUser.id);
      } else {
        telEl.textContent = '';
      }
    }

    document.getElementById('profileLevel').textContent = getLevel().level;
    document.getElementById('profileTitle').textContent = getLevel().title;
    document.getElementById('profileGames').textContent = format(state.gamesPlayed);
    document.getElementById('profileWagered').textContent = format(state.totalWagered);
    document.getElementById('profileWon').textContent = format(state.totalWon);
    const cur = getLevel();
    const next = getNextLevel();
    const fill = document.getElementById('xpFill');
    if (!next) { fill.style.width = '100%'; return; }
    fill.style.width = Math.min(100, Math.max(0, (state.xp - cur.xp) / (next.xp - cur.xp) * 100)) + '%';
  }

  function updateXP() { refreshProfile(); }

  function updateIncomeCard() {
    const el = document.getElementById('incomeCard');
    const rate = getTotalRate();
    if (rate <= 0) { el.classList.add('hidden'); return; }
    const elapsed = Math.min(Date.now() - state.lastIncome, 24 * 60 * 60 * 1000);
    const amount = Math.round((rate / 3600) * (elapsed / 1000));
    document.getElementById('incomeAmount').textContent = format(amount);
    el.classList.remove('hidden');
  }

  function claimIncome() {
    const rate = getTotalRate();
    if (rate <= 0) return;
    const elapsed = Math.min(Date.now() - state.lastIncome, 24 * 60 * 60 * 1000);
    const amount = Math.round((rate / 3600) * (elapsed / 1000));
    if (amount <= 0) { toast('Дохода пока нет', 'bad'); return; }
    state.balance += amount;
    state.lastIncome = Date.now();
    save();
    refresh();
    refreshProfile();
    updateIncomeCard();
    toast('Доход +' + format(amount) + ' 🪙', 'good');
  }

  function claimBonus() {
    if (state.claimedBonus) return;
    state.balance += 1000;
    state.claimedBonus = true;
    save();
    refresh();
    document.getElementById('bonusCard').classList.add('hidden');
    toast('Бонус +1 000 🪙 — удачной игры!', 'good');
  }

  function toast(text, type) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.className = 'toast ' + (type || '') + ' hidden';
    void el.offsetHeight;
    el.className = 'toast ' + (type || '');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  function modal(title, text) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalText').textContent = text;
    document.getElementById('modal').classList.remove('hidden');
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + id);
    if (screen) screen.classList.add('active');
    document.querySelectorAll('[data-nav]').forEach(n => n.classList.toggle('active', n.dataset.nav === id));
    if (id === 'crash' && window.Games) {
      setTimeout(() => window.Games.resizeCrashCanvas(), 100);
    }
    if (id === 'home' || id === 'property' || id === 'profile' || id === 'shop') {
      refresh();
      refreshProfile();
    }
    if (id === 'home') {
      updateIncomeCard();
      renderHomeProps();
    }
    if (id === 'shop') renderShop();
    if (id === 'property') renderProperty();
  }

  function renderHomeProps() {
    const el = document.getElementById('homeProps');
    const all = [
      ...state.props.map(id => ({ ...REALTY.find(x => x.id === id), kind: 'r' })),
      ...state.cars.map(id => ({ ...CARS.find(x => x.id === id), kind: 'c' }))
    ].filter(Boolean);
    if (all.length === 0) {
      el.innerHTML = '<div class="prop-empty">Нет имущества. Купи в магазине!</div>';
      return;
    }
    el.innerHTML = all.slice(0, 4).map(item => {
      const rate = item.kind === 'r' ? item.rate + ' 🪙/ч' : '+' + item.bonus + ' 🪙/ч (авто)';
      return '<div class="home-prop"><span class="p-ico">' + item.ico +
        '</span><div><div class="p-name">' + item.name + '</div><div class="p-rate">' + rate + '</div></div></div>';
    }).join('');
    if (all.length > 4) {
      el.innerHTML += '<div class="prop-empty">и ещё ' + (all.length - 4) + ' шт...</div>';
    }
  }

  function renderShop() {
    const tab = document.querySelector('.tab.active');
    const isRealty = tab.dataset.tab === 'realty';
    const items = isRealty ? REALTY : CARS;
    const ownedKey = isRealty ? 'props' : 'cars';
    const el = document.getElementById('shopList');

    el.innerHTML = items.map(item => {
      const owned = state[ownedKey].includes(item.id);
      const rate = isRealty ? item.rate + ' 🪙/ч' : '+' + item.bonus + ' 🪙/ч';
      return '<div class="shop-item' + (owned ? ' owned' : '') + '">' +
        '<div class="s-ico">' + item.ico + '</div>' +
        '<div class="s-info"><div class="s-name">' + item.name + '</div>' +
        '<div class="s-desc">' + item.desc + '</div>' +
        '<div class="s-rate">' + rate + '</div></div>' +
        '<div class="s-price">' + (owned ? '✓' : format(item.cost) + ' 🪙') + '</div>' +
        '<button class="s-buy" data-item="' + item.id + '" data-type="' + ownedKey + '" data-cost="' + item.cost + '">' +
        (owned ? 'Владею' : 'Купить') + '</button></div>';
    }).join('');

    el.querySelectorAll('.s-buy').forEach(btn => {
      if (btn.textContent === 'Владею') return;
      btn.addEventListener('click', () => buyItem(btn.dataset.item, btn.dataset.type, parseInt(btn.dataset.cost, 10)));
    });
  }

  function buyItem(id, key, cost) {
    if (state[key].includes(id)) return;
    if (state.balance < cost) { toast('Не хватает 🪙', 'bad'); return; }
    state.balance -= cost;
    state[key].push(id);
    save();
    refresh();
    renderShop();
    toast('Приобретено! 🎉', 'good');
  }

  function renderProperty() {
    const rate = getTotalRate();
    document.getElementById('propStats').innerHTML =
      '<div class="prop-stat-box"><span class="v">' + format(rate) +
      '</span><span class="l">🪙/ч доход</span></div>' +
      '<div class="prop-stat-box"><span class="v">' + state.props.length +
      '</span><span class="l">объектов</span></div>' +
      '<div class="prop-stat-box"><span class="v">' + state.cars.length +
      '</span><span class="l">машин</span></div>';

    const realtyEl = document.getElementById('propRealty');
    realtyEl.innerHTML = state.props.length === 0
      ? '<div class="prop-empty">Нет недвижимости</div>'
      : state.props.map(id => {
          const item = REALTY.find(x => x.id === id);
          return '<div class="shop-item owned"><div class="s-ico">' + item.ico +
            '</div><div class="s-info"><div class="s-name">' + item.name +
            '</div><div class="s-rate">' + item.rate + ' 🪙/ч</div></div></div>';
        }).join('');

    const carsEl = document.getElementById('propCars');
    carsEl.innerHTML = state.cars.length === 0
      ? '<div class="prop-empty">Нет машин</div>'
      : state.cars.map(id => {
          const item = CARS.find(x => x.id === id);
          return '<div class="shop-item owned"><div class="s-ico">' + item.ico +
            '</div><div class="s-info"><div class="s-name">' + item.name +
            '</div><div class="s-rate">+' + item.bonus + ' 🪙/ч</div></div></div>';
        }).join('');
  }

  function resetGame() {
    modal('Сброс прогресса', 'Точно удалить всё имущество и монеты? Это необратимо.');
    const ok = document.getElementById('modalOk');
    const prev = ok.onclick;
    ok.onclick = () => {
      state.balance = 0;
      state.xp = 0;
      state.gamesPlayed = 0;
      state.totalWagered = 0;
      state.totalWon = 0;
      state.props = [];
      state.cars = [];
      state.lastIncome = Date.now();
      state.claimedBonus = false;
      lastLocalSave = '';
      save();
      document.getElementById('modal').classList.add('hidden');
      ok.onclick = prev;
      showScreen('home');
      refresh();
      refreshProfile();
      updateBonusCard();
      toast('Прогресс сброшен', 'bad');
    };
  }

  function updateBonusCard() {
    const el = document.getElementById('bonusCard');
    if (state.claimedBonus) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
  }

  function initTelegram() {
    try { tg = window.Telegram?.WebApp; } catch (e) {}
    if (tg) {
      tg.expand();
      tg.ready();
      const u = tg.initDataUnsafe?.user;
      if (u) {
        tgUser = u;
        state.name = (u.first_name || '') + (u.last_name ? ' ' + u.last_name : '');
      }
      tg.onEvent('viewportChanged', () => tg.expand());
    }
  }

  function initNav() {
    document.querySelectorAll('[data-back]').forEach(btn => {
      btn.addEventListener('click', () => showScreen(btn.dataset.back));
    });
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => showScreen(btn.dataset.nav));
    });
    document.querySelectorAll('[data-game]').forEach(card => {
      card.addEventListener('click', () => showScreen(card.dataset.game));
    });
    document.getElementById('homeToShop').addEventListener('click', () => showScreen('shop'));
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        renderShop();
      });
    });
  }

  /* ---------- startup ---------- */

  async function init() {
    initTelegram();

    // 1. Load local quickly so UI is instant
    loadLocal();

    // 2. If we have telegram user — fetch server state, prefer newest
    if (telegramId()) {
      const server = await serverGet();
      if (server) {
        const serverTs = new Date(server.updatedAt || 0).getTime();
        const localWasPresent = !!localStorage.getItem(LOCAL_KEY);
        // If server is our source of truth, or local was never saved → take server
        const localLast = state.lastIncome || 0;
        const serverLast = server.lastIncome || 0;
        if (!localWasPresent || serverLast >= localLast) {
          Object.assign(state, server);
        }
      }
    }

    // 3. Ensure sane defaults
    state.lastIncome = state.lastIncome || Date.now();
    if (state.claimedBonus && state.balance < 1000 && state.xp === 0 && state.gamesPlayed === 0) {
      // edge: keep whatever
    }

    // 4. Auto-claim starting bonus for brand-new players
    if (!state.claimedBonus) {
      claimBonus();
    }

    if (!state.name && tgUser) {
      state.name = (tgUser.first_name || '') + (tgUser.last_name ? ' ' + tgUser.last_name : '');
    }

    serverReady = Boolean(telegramId());

    // 5. Render UI
    refresh();
    refreshProfile();
    updateBonusCard();
    updateIncomeCard();
    renderHomeProps();
    renderShop();
    renderProperty();
    showScreen('home');
    initNav();
    Games.initAll();

    document.getElementById('claimBonusBtn').addEventListener('click', claimBonus);
    document.getElementById('claimIncomeBtn').addEventListener('click', claimIncome);
    document.getElementById('howToBtn').addEventListener('click', () => showScreen('help'));
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('modalOk').addEventListener('click', () => {
      document.getElementById('modal').classList.add('hidden');
    });

    // 6. Periodical income tick + save
    setInterval(() => {
      updateIncomeCard();
      localSave();
      serverSave(false);
    }, 15000);

    // 7. Flush on close
    window.addEventListener('pagehide', () => serverSave(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') serverSave(true);
    });
  }

  window.Game = {
    get balance() { return state.balance; },
    getLevel,
    getNextLevel,
    spend,
    win,
    toast,
    modal,
    format
  };

  document.addEventListener('DOMContentLoaded', init);
})();