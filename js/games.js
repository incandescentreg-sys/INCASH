const Games = (() => {
  const G = () => window.Game;

  function wireBetPanel(panel, inputId, min) {
    const input = document.getElementById(inputId);
    panel.querySelector('[data-bet="half"]').addEventListener('click', () => {
      input.value = Math.max(min, Math.floor(parseInt(input.value || min, 10) / 2 / min) * min);
    });
    panel.querySelector('[data-bet="double"]').addEventListener('click', () => {
      const g = G();
      input.value = Math.min(g.balance, Math.max(min, (parseInt(input.value || min, 10) || min) * 2));
    });
    panel.querySelector('[data-bet="max"]').addEventListener('click', () => {
      input.value = Math.max(min, G().balance);
    });
    input.addEventListener('change', () => {
      let v = parseInt(input.value, 10);
      if (isNaN(v) || v < min) v = min;
      input.value = v;
    });
  }

  function format(n) {
    return n.toLocaleString('ru-RU');
  }

  /* ============ SLOTS ============ */
  const SLOT_SYMBOLS = ['🍒', '7', '🍋', '💎'];
  const SLOT_PAY = { '💎': 50, '7': 20, '🍒': 8, '🍋': 5 };
  let slots = { busy: false, cells: [[], [], []] };

  function buildStrip(reel) {
    reel.innerHTML = '';
    const vis = [];
    for (let k = 0; k < 3; k++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = SLOT_SYMBOLS[(k + 1) % SLOT_SYMBOLS.length];
      reel.appendChild(cell);
      vis.push(cell);
    }
    return vis;
  }

  function initSlots() {
    for (let i = 0; i < 3; i++) {
      slots.cells[i] = buildStrip(document.getElementById('reel' + i));
    }
    wireBetPanel(document.querySelector('#screen-slots .bet-panel'), 'slotsBet', 10);
    document.getElementById('slotsSpin').addEventListener('click', spinSlots);
  }

  function rollSymbol() {
    const r = Math.random();
    if (r < 0.006) return '💎';
    if (r < 0.04) return '7';
    if (r < 0.25) return '🍒';
    return '🍋';
  }

  function randSym() {
    return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
  }

  function spinSlots() {
    const g = G();
    if (slots.busy) return;
    const bet = parseInt(document.getElementById('slotsBet').value, 10) || 10;
    if (!g.spend(bet)) { g.toast('Недостаточно монет', 'bad'); return; }
    slots.busy = true;

    const winEl = document.getElementById('slotsWin');
    winEl.className = 'win-line neutral';
    winEl.textContent = 'Крутим...';

    const results = [rollSymbol(), rollSymbol(), rollSymbol()];
    let stopped = 0;

    [0, 1, 2].forEach((i) => {
      const cells = slots.cells[i];
      let frame = 0;
      const stopFrame = 7 + i * 5;
      let running = false;

      function tick() {
        if (!running) return;
        cells.forEach(c => { c.textContent = randSym(); });
        frame++;
        if (frame >= stopFrame) {
          running = false;
          cells[1].textContent = results[i];
          stopped++;
          if (stopped === 3) finishSlots(results, bet, winEl);
          return;
        }
        setTimeout(tick, 50 + frame * 5);
      }
      setTimeout(() => { running = true; tick(); }, i * 180);
    });
  }

  function finishSlots(results, bet, winEl) {
    const g = G();
    const line = [results[0], results[1], results[2]];
    let mult = 0;
    const ms = {};
    line.forEach(s => { ms[s] = (ms[s] || 0) + 1; });
    if (ms['💎'] === 3) mult = 50;
    else if (ms['7'] === 3) mult = 20;
    else if (ms['🍒'] === 3) mult = 8;
    else if (ms['🍋'] === 3) mult = 5;
    else if (Object.values(ms).some(v => v >= 2)) mult = 1.5;

    if (mult > 0) {
      const win = Math.round(bet * mult);
      g.win(win);
      winEl.className = 'win-line win';
      winEl.textContent = line.join(' ') + ' — выигрыш +' + format(win) + ' 🪙';
      g.toast('+' + format(win) + ' 🪙', 'good');
    } else {
      winEl.className = 'win-line lose';
      winEl.textContent = line.join(' ') + ' — проигрыш';
    }
    slots.busy = false;
  }

  /* ============ DICE ============ */
  const DICE_BETS = {
    '7': { fn: (a, b) => a + b === 7, mult: 5 },
    'low': { fn: (a, b) => a + b < 7, mult: 2 },
    'high': { fn: (a, b) => a + b > 7, mult: 2 },
    'even': { fn: (a, b) => (a + b) % 2 === 0 && a + b !== 7, mult: 2 },
    'odd': { fn: (a, b) => (a + b) % 2 === 1, mult: 2 },
    'duo': { fn: (a, b) => a === b, mult: 6 }
  };
  let dice = { pick: null, busy: false };

  function initDice() {
    wireBetPanel(document.querySelector('#screen-dice .bet-panel'), 'diceBet', 10);
    document.querySelectorAll('[data-dice]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip[data-dice]').forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
        dice.pick = btn.dataset.dice;
      });
    });
    document.getElementById('diceRoll').addEventListener('click', rollDice);
  }

  function rollDice() {
    const g = G();
    if (dice.busy) return;
    if (!dice.pick) { g.toast('Выбери ставку: сумма, больше, меньше...', 'bad'); return; }
    const bet = parseInt(document.getElementById('diceBet').value, 10) || 10;
    if (!g.spend(bet)) { g.toast('Недостаточно монет', 'bad'); return; }
    dice.busy = true;

    const dA = document.getElementById('diceA');
    const dB = document.getElementById('diceB');
    dA.classList.add('rolling');
    dB.classList.add('rolling');
    const winEl = document.getElementById('diceWin');
    winEl.className = 'win-line neutral';
    winEl.textContent = 'Бросаем...';

    setTimeout(() => {
      const a = 1 + Math.floor(Math.random() * 6);
      const b = 1 + Math.floor(Math.random() * 6);
      dA.textContent = a;
      dB.textContent = b;
      dA.classList.remove('rolling');
      dB.classList.remove('rolling');

      const cfg = DICE_BETS[dice.pick];
      const won = cfg.fn(a, b);
      const sum = a + b;
      if (won) {
        const win = Math.round(bet * cfg.mult);
        g.win(win);
        winEl.className = 'win-line win';
        winEl.textContent = sum + ' — выигрыш +' + format(win) + ' 🪙';
        g.toast('+' + format(win) + ' 🪙', 'good');
      } else {
        winEl.className = 'win-line lose';
        winEl.textContent = sum + ' — проигрыш';
      }
      dice.busy = false;
    }, 700);
  }

  /* ============ CRASH ============ */
  let crash = { state: 'idle', busy: false, anim: null, t0: 0, mult: 1, crashPoint: 0, bet: 0, canvas: null, ctx: null, pts: [] };

  function initCrash() {
    wireBetPanel(document.querySelector('#screen-crash .bet-panel'), 'crashBet', 10);
    crash.canvas = document.getElementById('crashCanvas');
    crash.ctx = crash.canvas.getContext('2d');
    window.addEventListener('resize', () => { if (crash.canvas) resizeCrashCanvas(); });
    document.getElementById('crashStart').addEventListener('click', startCrash);
    document.getElementById('crashCash').addEventListener('click', cashOutCrash);
  }

  function resizeCrashCanvas() {
    const wrap = document.querySelector('.crash-chart');
    if (!crash.canvas || !wrap) return;
    const w = wrap.clientWidth || 320;
    const h = wrap.clientHeight || 180;
    const dpr = window.devicePixelRatio || 1;
    crash.canvas.width = w * dpr;
    crash.canvas.height = h * dpr;
    crash.canvas.style.width = w + 'px';
    crash.canvas.style.height = h + 'px';
    crash.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCrash(crash.pts.length > 0 ? crash.mult : 1, false);
  }

  function startCrash() {
    const g = G();
    if (crash.busy || crash.state !== 'idle') return;
    const bet = parseInt(document.getElementById('crashBet').value, 10) || 10;
    if (!g.spend(bet)) { g.toast('Недостаточно монет', 'bad'); return; }
    crash.busy = true;
    crash.state = 'running';
    crash.bet = bet;
    crash.mult = 1;
    crash.pts = [];
    const r = Math.random();
    crash.crashPoint = Math.max(1.05, 0.99 / (1 - r));
    crash.t0 = performance.now();

    document.getElementById('crashStart').classList.add('hidden');
    document.getElementById('crashCash').classList.remove('hidden');
    const st = document.getElementById('crashStatus');
    st.className = 'crash-status big';
    st.textContent = 'Ставка ' + format(bet) + ' 🪙 — взлетаем!';

    resizeCrashCanvas();
    crash.anim = requestAnimationFrame(crashTick);
  }

  function crashTick(now) {
    const t = (now - crash.t0) / 1000;
    crash.mult = Math.exp(0.12 * t);
    crash.pts.push({ t, m: crash.mult });
    if (crash.pts.length > 600) crash.pts.shift();

    document.getElementById('crashMult').textContent = crash.mult.toFixed(2) + 'x';
    const cashVal = Math.round(crash.bet * (crash.mult - 0.02));
    document.getElementById('crashCash').textContent = 'Забрать ' + format(cashVal) + ' 🪙';

    drawCrash(crash.mult);
    if (crash.mult >= crash.crashPoint) {
      crashCrash();
      return;
    }
    crash.anim = requestAnimationFrame(crashTick);
  }

  function crashCrash() {
    cancelAnimationFrame(crash.anim);
    crash.state = 'crashed';
    document.getElementById('crashMult').textContent = crash.crashPoint.toFixed(2) + 'x';
    document.getElementById('crashMult').style.color = 'var(--red)';
    const st = document.getElementById('crashStatus');
    st.className = 'crash-status big';
    st.textContent = '💥 Крэш на ' + crash.crashPoint.toFixed(2) + 'x — ставка сгорела';
    document.getElementById('crashCash').classList.add('hidden');
    document.getElementById('crashStart').classList.remove('hidden');
    drawCrash(crash.crashPoint, true);
    crash.state = 'idle';
    crash.busy = false;
    setTimeout(() => {
      document.getElementById('crashMult').style.color = 'var(--green)';
      st.className = 'crash-status';
      st.textContent = 'Ставь и взлетай!';
    }, 2500);
  }

  function cashOutCrash() {
    const g = G();
    if (crash.state !== 'running') return;
    cancelAnimationFrame(crash.anim);
    const win = Math.round(crash.bet * (crash.mult - 0.02));
    if (win > 0) {
      g.win(win);
      g.toast('Снято +' + format(win) + ' 🪙 при ' + crash.mult.toFixed(2) + 'x', 'good');
    }
    const st = document.getElementById('crashStatus');
    st.className = 'crash-status big';
    st.textContent = '✅ Снято на ' + crash.mult.toFixed(2) + 'x: +' + format(win) + ' 🪙';
    document.getElementById('crashCash').classList.add('hidden');
    document.getElementById('crashStart').classList.remove('hidden');
    document.getElementById('crashStart').textContent = '🚀 Ставка и взлёт';
    crash.state = 'idle';
    crash.busy = false;
    setTimeout(() => {
      st.className = 'crash-status';
      st.textContent = 'Ставь и взлетай!';
    }, 2500);
  }

  function drawCrash(cur, crashed) {
    const ctx = crash.ctx;
    const canvas = crash.canvas;
    if (!ctx || !canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    if (w < 10 || h < 10) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    const scale = window.devicePixelRatio || 1;
    const maxM = Math.max(2, crashed ? crash.crashPoint + 0.2 : Math.max(cur * 1.3, 2));
    const maxT = Math.max(crash.pts.length ? crash.pts[crash.pts.length - 1].t : 1, 1) * 1.15;

    // grid lines
    ctx.strokeStyle = 'rgba(139,146,184,.12)';
    ctx.fillStyle = 'rgba(139,146,184,.4)';
    ctx.lineWidth = 1;
    ctx.font = '9px sans-serif';
    for (let i = 1; i <= 4; i++) {
      const y = (h * 0.05) + (h * 0.85) * (1 - i / 4);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillText((i / 4 * maxM).toFixed(1) + 'x', 4, y - 2);
    }

    const X = t => (t / maxT) * (w - 8) + 4;
    const Y = m => (h * 0.05) + (h * 0.85) * (1 - m / maxM);

    // curve
    ctx.beginPath();
    crash.pts.forEach((p, i) => {
      const px = X(p.t);
      const py = Y(p.m);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = crashed ? '#ff5d73' : '#3ddc84';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // crash marker
    if (crashed && crash.pts.length > 0) {
      const last = crash.pts[crash.pts.length - 1];
      const lx = X(last.t);
      const ly = Y(last.m);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(Math.min(lx + 24, w - 4), Math.max(0, ly - 32));
      ctx.strokeStyle = '#ff5d73';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ============ COIN ============ */
  let coin = { busy: false };

  function initCoin() {
    wireBetPanel(document.querySelector('#screen-coin .bet-panel'), 'coinBet', 10);
    document.getElementById('coinFlip').addEventListener('click', flipCoin);
    document.querySelectorAll('#screen-coin [data-coin]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#screen-coin [data-coin]').forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  }

  function flipCoin() {
    const g = G();
    if (coin.busy) return;
    const bet = parseInt(document.getElementById('coinBet').value, 10) || 10;
    if (!g.spend(bet)) { g.toast('Недостаточно монет', 'bad'); return; }
    coin.busy = true;

    const face = document.getElementById('coinFace');
    const winEl = document.getElementById('coinWin');
    face.classList.add('flip');
    winEl.className = 'win-line neutral';
    winEl.textContent = 'Подбрасываем...';

    setTimeout(() => {
      const result = Math.random() < 0.5 ? 'О' : 'Р';
      face.textContent = result;
      face.classList.remove('flip');
      const chosen = document.querySelector('.chip[data-coin].selected');
      if (chosen && chosen.dataset.coin === (result === 'О' ? '0' : '1')) {
        const win = Math.round(bet * 1.9);
        g.win(win);
        winEl.className = 'win-line win';
        winEl.textContent = result + ' — выигрыш +' + format(win) + ' 🪙';
        g.toast('+' + format(win) + ' 🪙', 'good');
      } else {
        winEl.className = 'win-line lose';
        winEl.textContent = result + ' — проигрыш';
      }
      coin.busy = false;
    }, 900);
  }

  /* ============ ROULETTE ============ */
  const RED_NUMS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const isRed = n => RED_NUMS.includes(n);
  let roulette = { pick: null, busy: false };

  function initRoulette() {
    const board = document.getElementById('rouletteBoard');
    const zero = document.createElement('div');
    zero.className = 'rb-cell zero';
    zero.textContent = '0';
    zero.dataset.num = '0';
    zero.addEventListener('click', () => selectNumber('0', zero));
    board.appendChild(zero);
    for (let n = 1; n <= 36; n++) {
      const cell = document.createElement('div');
      cell.className = 'rb-cell ' + (isRed(n) ? 'red' : 'black');
      cell.textContent = n;
      cell.dataset.num = String(n);
      cell.addEventListener('click', () => selectNumber(String(n), cell));
      board.appendChild(cell);
    }
    document.querySelectorAll('[data-rb]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-rb]').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.rb-cell').forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
        roulette.pick = { spec: btn.dataset.rb };
      });
    });
    wireBetPanel(document.querySelector('#screen-roulette .bet-panel'), 'rouletteBet', 10);
    document.getElementById('rouletteSpinBtn').addEventListener('click', spinRoulette);
  }

  function selectNumber(num, cell) {
    document.querySelectorAll('[data-rb]').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.rb-cell').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    roulette.pick = { num: parseInt(num, 10) };
  }

  function resolveRouletteBet(n) {
    if (roulette.pick.num !== undefined) {
      return { won: roulette.pick.num === n, mult: 36 };
    }
    switch (roulette.pick.spec) {
      case 'red': return { won: n !== 0 && isRed(n), mult: 2 };
      case 'black': return { won: n !== 0 && !isRed(n), mult: 2 };
      case 'even': return { won: n !== 0 && n % 2 === 0, mult: 2 };
      case 'odd': return { won: n % 2 === 1, mult: 2 };
      case 'low': return { won: n >= 1 && n <= 18, mult: 2 };
      case 'high': return { won: n >= 19 && n <= 36, mult: 2 };
      case 'dozen1': return { won: n >= 1 && n <= 12, mult: 3 };
      case 'dozen2': return { won: n >= 13 && n <= 24, mult: 3 };
      case 'dozen3': return { won: n >= 25 && n <= 36, mult: 3 };
      default: return { won: false, mult: 0 };
    }
  }

  function spinRoulette() {
    const g = G();
    if (roulette.busy) return;
    if (!roulette.pick) { g.toast('Выбери число или ставку', 'bad'); return; }
    const bet = parseInt(document.getElementById('rouletteBet').value, 10) || 10;
    if (!g.spend(bet)) { g.toast('Недостаточно монет', 'bad'); return; }
    roulette.busy = true;

    const wheel = document.getElementById('rouletteWheel');
    const winEl = document.getElementById('rouletteWin');
    const resEl = document.getElementById('rouletteResult');
    winEl.className = 'win-line neutral';
    winEl.textContent = 'Крутим...';

    const n = Math.floor(Math.random() * 37);
    const wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    const idx = wheelOrder.indexOf(n);
    const slotAngle = (360 / 37) * idx;
    const base = 360 * (5 + Math.floor(Math.random() * 5));
    wheel.style.transition = 'none';
    const cur = parseFloat(wheel.dataset.angle || '0');
    wheel.style.transform = 'rotate(' + (cur % 360) + 'deg)';
    void wheel.offsetHeight;
    const target = base + (360 - slotAngle) % 360 + cur - (cur % 360) + 360;
    wheel.dataset.angle = target;
    wheel.style.transition = 'transform 3.6s cubic-bezier(.12,.65,.1,1)';
    wheel.style.transform = 'rotate(' + target + 'deg)';

    setTimeout(() => {
      const out = resolveRouletteBet(n);
      resEl.textContent = n;
      if (n === 0) resEl.style.background = 'linear-gradient(135deg, #2ecc71, #1f9d55)';
      else if (isRed(n)) resEl.style.background = 'linear-gradient(135deg, #ff5d73, #e0334d)';
      else resEl.style.background = 'linear-gradient(135deg, #3a3f55, #1c1f2e)';
      if (out.won) {
        const win = Math.round(bet * out.mult);
        g.win(win);
        winEl.className = 'win-line win';
        winEl.textContent = n + ' — выигрыш +' + format(win) + ' 🪙';
        g.toast('+' + format(win) + ' 🪙', 'good');
      } else {
        winEl.className = 'win-line lose';
        winEl.textContent = n + ' — проигрыш';
      }
      roulette.busy = false;
      roulette.pick = null;
      document.querySelectorAll('.rb-cell.selected, [data-rb].selected').forEach(c => c.classList.remove('selected'));
    }, 3800);
  }

  return {
    initAll() {
      initSlots();
      initDice();
      initCrash();
      initCoin();
      initRoulette();
    },
    resizeCrashCanvas
  };
})();

window.Games = Games;