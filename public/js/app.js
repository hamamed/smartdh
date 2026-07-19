// ---------- PWA service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}

// ---------- Balance history chart ----------
(function () {
  const el = document.getElementById('balanceChart');
  if (!el || !window.Chart) return;
  let pts = [];
  try { pts = JSON.parse(el.dataset.points || '[]'); } catch (e) { return; }
  if (pts.length < 2) return;
  const currency = el.dataset.currency || '';
  const dark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
  const ctx = el.getContext('2d');

  const fill = ctx.createLinearGradient(0, 0, 0, 220);
  fill.addColorStop(0, 'rgba(255,95,109,.35)');
  fill.addColorStop(1, 'rgba(255,95,109,0)');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: pts.map(p => new Date(p.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
      datasets: [{
        data: pts.map(p => p.v),
        borderColor: '#ff5f6d',
        backgroundColor: fill,
        borderWidth: 3,
        fill: true,
        tension: .38,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#ff5f6d'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (c) => c.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + currency }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: dark ? '#8b8391' : '#9a8d86' } },
        y: {
          grid: { color: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)' },
          ticks: { maxTicksLimit: 4, color: dark ? '#8b8391' : '#9a8d86' }
        }
      }
    }
  });
})();

// ---------- Admin live activity chart ----------
(function () {
  const el = document.getElementById('adminChart');
  if (!el || !window.Chart) return;
  const cur = el.dataset.currency || '';
  const ctx = el.getContext('2d');
  const dark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
  const grid = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';
  const tick = dark ? '#8b8391' : '#9a8d86';

  const fill = ctx.createLinearGradient(0, 0, 0, 240);
  fill.addColorStop(0, 'rgba(18,177,214,.30)');
  fill.addColorStop(1, 'rgba(18,177,214,0)');

  const coins = { label: 'coins', data: [], borderColor: '#12b1d6', backgroundColor: fill, borderWidth: 2.5, fill: true, tension: .35, pointRadius: 0, order: 3 };
  // Chart.js also evaluates these callbacks with a context that has no data point
  // (c.raw undefined) while resolving styles — guard so it never throws.
  const rOf = (c) => (c && c.raw && typeof c.raw.r === 'number' ? c.raw.r : 0);
  const dep = { label: 'deposit', type: 'scatter', data: [], backgroundColor: '#16c79a', borderColor: '#0e9d78', pointStyle: 'triangle', pointRadius: c => rOf(c), pointHoverRadius: c => rOf(c) + 2, order: 1 };
  const wd = { label: 'withdraw', type: 'scatter', data: [], backgroundColor: '#ff5964', borderColor: '#d63b46', pointStyle: 'triangle', rotation: 180, pointRadius: c => rOf(c), pointHoverRadius: c => rOf(c) + 2, order: 1 };

  const chart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [coins, dep, wd] },
    options: {
      parsing: false, animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      scales: {
        x: { type: 'linear', grid: { display: false },
             ticks: { maxTicksLimit: 6, color: tick, callback: v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } },
        y: { grid: { color: grid }, ticks: { maxTicksLimit: 4, color: tick, callback: v => Math.round(v).toLocaleString() } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => {
          if (c.dataset.label === 'coins') return c.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + cur;
          const e = c.raw;
          return e.name + ': ' + (c.dataset.label === 'withdraw' ? '−' : '+') + e.amount.toLocaleString() + ' ' + cur;
        } } }
      }
    }
  });

  const WINDOW = 120 * 1000;        // keep the last 2 minutes on screen
  const seen = new Set();
  const trim = (arr, minX) => { while (arr.length && arr[0].x < minX) arr.shift(); };

  async function poll() {
    let s;
    try {
      const res = await fetch('/admin/stats.json', { headers: { 'X-Requested-With': 'fetch' } });
      if (!res.ok) return;
      s = await res.json();
    } catch (e) { return; }

    const now = s.now, minX = now - WINDOW;
    coins.data.push({ x: now, y: s.totalCoins });
    trim(coins.data, minX);

    s.events.forEach(e => {
      if (seen.has(e.id) || e.t < minX) { seen.add(e.id); return; }
      seen.add(e.id);
      const r = Math.max(4, Math.min(13, 4 + Math.log10(Math.max(1, e.amount)) * 2.2));
      (e.type === 'deposit' ? dep : wd).data.push({ x: e.t, y: s.totalCoins, r, name: e.name, amount: e.amount });
    });
    trim(dep.data, minX);
    trim(wd.data, minX);

    const c = document.getElementById('statCoins');
    if (c) c.textContent = Math.round(s.totalCoins).toLocaleString() + ' ' + cur;
    chart.update('none');
  }
  poll();
  setInterval(poll, 1000);   // every second
})();

// ---------- Admin trends chart (hourly / daily / weekly / monthly) ----------
(function () {
  const el = document.getElementById('trendChart');
  if (!el || !window.Chart) return;
  const cur = el.dataset.currency || '';
  const ctx = el.getContext('2d');
  const nf = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const OCEAN = '#12b1d6';   // app info/ocean — the "new players" line
  const isDark = () => document.documentElement.getAttribute('data-bs-theme') === 'dark';
  const themeColors = () => ({
    grid: isDark() ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)',
    tick: isDark() ? '#8b8391' : '#9a8d86'
  });

  // Vertical gradient fills so the bars read like the app's jelly buttons.
  const grad = (top, bottom) => { const g = ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, top); g.addColorStop(1, bottom); return g; };
  const depFill = grad('#2ee0a6', '#12b98a');   // success gradient
  const wdFill = grad('#ff7a6b', '#ff4d67');    // danger gradient

  let tc = themeColors();
  const chart = new Chart(ctx, {
    data: {
      labels: [],
      datasets: [
        { type: 'bar', label: el.dataset.ldep || 'Deposits', data: [], counts: [], backgroundColor: depFill, borderRadius: 6, borderSkipped: false, order: 2 },
        { type: 'bar', label: el.dataset.lwd || 'Withdrawals', data: [], counts: [], backgroundColor: wdFill, borderRadius: 6, borderSkipped: false, order: 2 },
        { type: 'line', label: el.dataset.lplayers || 'New players', data: [], borderColor: OCEAN, backgroundColor: OCEAN, pointBackgroundColor: OCEAN, yAxisID: 'y1', tension: .35, pointRadius: 2, borderWidth: 2.5, order: 1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 12, color: tc.tick, autoSkip: true } },
        y: { beginAtZero: true, grid: { color: tc.grid }, ticks: { maxTicksLimit: 5, color: tc.tick, callback: v => nf(v) } },
        y1: { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { maxTicksLimit: 5, color: OCEAN, precision: 0 } }
      },
      plugins: {
        legend: { display: true, labels: { color: tc.tick, usePointStyle: true, boxWidth: 8,
          // solid swatches (bars use gradients, which don't render well in the legend box)
          generateLabels: (ch) => { const solids = ['#16c79a', '#ff5964', OCEAN];
            return ch.data.datasets.map((ds, i) => ({ text: ds.label, fillStyle: solids[i], strokeStyle: solids[i], pointStyle: 'circle', datasetIndex: i })); } } },
        tooltip: { callbacks: { label: (c) => {
          const ds = c.dataset;
          if (ds.yAxisID === 'y1') return ds.label + ': ' + c.parsed.y;
          const n = ds.counts && ds.counts[c.dataIndex] != null ? ds.counts[c.dataIndex] : 0;
          return ds.label + ': ' + nf(c.parsed.y) + ' ' + cur + ' (' + n + ')';
        } } }
      }
    }
  });

  // Re-theme grid/tick/legend colours when the user flips dark mode.
  new MutationObserver(() => {
    tc = themeColors();
    chart.options.scales.x.ticks.color = tc.tick;
    chart.options.scales.y.ticks.color = tc.tick;
    chart.options.scales.y.grid.color = tc.grid;
    chart.options.plugins.legend.labels.color = tc.tick;
    chart.update('none');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

  async function load(range) {
    try {
      const r = await fetch('/admin/analytics.json?range=' + range, { headers: { 'X-Requested-With': 'fetch' } });
      if (!r.ok) return;
      const j = await r.json();
      chart.data.labels = j.buckets.map(b => b.label);
      chart.data.datasets[0].data = j.buckets.map(b => b.depSum);
      chart.data.datasets[0].counts = j.buckets.map(b => b.depCount);
      chart.data.datasets[1].data = j.buckets.map(b => b.wdSum);
      chart.data.datasets[1].counts = j.buckets.map(b => b.wdCount);
      chart.data.datasets[2].data = j.buckets.map(b => b.signups);
      chart.update();
    } catch (e) { /* ignore */ }
  }

  const btns = el.closest('.card-body').querySelectorAll('[data-range]');
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    load(b.dataset.range);
  }));
  load('daily');
})();

// ---------- Dark mode toggle ----------
(function () {
  const btn = document.getElementById('themeToggle');
  const setIcon = (t) => {
    if (!btn) return;
    btn.innerHTML = '<i data-lucide="' + (t === 'dark' ? 'sun' : 'moon') + '"></i>';
    if (window.renderIcons) window.renderIcons();
  };
  let theme = 'light';
  try { theme = localStorage.getItem('theme') || 'light'; } catch (e) {}
  document.documentElement.setAttribute('data-bs-theme', theme);
  setIcon(theme);
  if (btn) btn.addEventListener('click', () => {
    theme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
    setIcon(theme);
  });
})();

// ---------- Live-growing balance counters ----------
(function () {
  const els = document.querySelectorAll('.live-counter');
  if (!els.length) return;
  const state = [...els].map(el => ({
    el,
    value: parseFloat(el.dataset.value) || 0,
    perSec: parseFloat(el.dataset.persec) || 0,
    currency: el.dataset.currency || ''
  }));
  let last = performance.now();
  function fmt(n, cur) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur; }
  function tick(now) {
    const dt = (now - last) / 1000;
    last = now;
    state.forEach(s => {
      if (s.perSec > 0) {
        s.value += s.perSec * dt;
        s.el.textContent = fmt(s.value, s.currency);
      }
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// ---------- Landing earnings calculator (plan-aware) ----------
(function () {
  const amountEl = document.getElementById('calcAmount');
  const planEl = document.getElementById('calcPlan');
  if (!amountEl || !planEl) return;
  const box = amountEl.closest('.card-body').querySelector('[data-currency]');
  const currency = box.dataset.currency;
  const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + currency;
  function update() {
    const amount = parseFloat(amountEl.value) || 0;
    const rate = parseFloat(planEl.value) || 0;
    const per15 = amount * rate;
    document.getElementById('calcDaily').textContent = fmt(per15 / 15);
    document.getElementById('calc15').textContent = fmt(per15);
    document.getElementById('calcMonthly').textContent = fmt(per15 * 2);
  }
  amountEl.addEventListener('input', update);
  planEl.addEventListener('change', update);
  update();
})();

// ---------- Invest cards: live 30-day earnings preview under the amount input ----------
(function () {
  const inputs = document.querySelectorAll('[data-earn-input]');
  if (!inputs.length) return;
  const M = window.MSG || {};
  const cur = M.cur || '';
  const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + cur;
  inputs.forEach((input) => {
    const out = input.closest('form').querySelector('[data-earn-out]');
    if (!out) return;
    const span = out.querySelector('span');
    const rate = parseFloat(input.dataset.rate) || 0;
    const update = () => {
      const amount = parseFloat(input.value) || 0;
      if (amount > 0 && rate > 0) {
        span.textContent = '+' + fmt(amount * rate * 2) + ' · ' + (M.earn30 || '30d');
        out.classList.remove('d-none');
      } else {
        out.classList.add('d-none');
      }
    };
    input.addEventListener('input', update);
    update();
  });
})();

// ---------- Profile photo: live preview ----------
(function () {
  const input = document.getElementById('photoInput');
  const preview = document.getElementById('photoPreview');
  const flag = document.getElementById('hasPhoto');
  if (!input || !preview) return;
  input.addEventListener('change', function () {
    const f = input.files && input.files[0];
    if (flag) flag.value = f ? '1' : '0';
    if (!f) { preview.classList.add('d-none'); return; }
    preview.src = URL.createObjectURL(f);
    preview.classList.remove('d-none');
  });
})();

// ---------- Payout: show only the fields for the chosen method ----------
(function () {
  const sel = document.querySelector('.payout-method');
  if (!sel) return;
  function sync() {
    const bank = sel.value === 'bank';
    document.querySelectorAll('.payout-if-bank').forEach(el => el.classList.toggle('d-none', !bank));
    document.querySelectorAll('.payout-if-paypal').forEach(el => el.classList.toggle('d-none', bank));
  }
  sel.addEventListener('change', sync);
  sync();
})();

// ---------- Admin: bulk select on the users list ----------
(function () {
  const all = document.getElementById('checkAll');
  const bar = document.getElementById('bulkBar');
  if (!all || !bar) return;
  const boxes = () => [...document.querySelectorAll('.row-check:not([disabled])')];
  const countEl = document.getElementById('bulkCount');

  function sync() {
    const picked = boxes().filter(b => b.checked).length;
    countEl.textContent = picked;
    bar.classList.toggle('d-none', picked === 0);
    bar.classList.toggle('d-flex', picked > 0);
    const total = boxes().length;
    all.checked = picked > 0 && picked === total;
    all.indeterminate = picked > 0 && picked < total;   // partial selection
  }
  all.addEventListener('change', () => { boxes().forEach(b => { b.checked = all.checked; }); sync(); });
  boxes().forEach(b => b.addEventListener('change', sync));
  sync();
})();

// Batch-deposit modal: copy the currently checked user ids into the modal form.
(function () {
  const modal = document.getElementById('batchDepModal');
  if (!modal) return;
  modal.addEventListener('show.bs.modal', function () {
    const ids = [...document.querySelectorAll('.row-check:checked')].map(b => b.value);
    const box = document.getElementById('batchIds');
    box.innerHTML = ids.map(id => '<input type="hidden" name="ids" value="' + id + '">').join('');
    const c = document.getElementById('batchCount');
    if (c) c.textContent = ids.length;
  });
})();

// Confirm destructive bulk actions. Returns false to block the submit.
function dvConfirmBulk(form) {
  const n = document.querySelectorAll('.row-check:checked').length;
  const M = window.MSG || {};
  if (!n) return false;
  // the clicked button is the submitter; fall back to reading the form
  const action = (document.activeElement && document.activeElement.value) || '';
  if (action === 'delete') return confirm((M.bulk_confirm_delete || 'Delete {n} players?').replace('{n}', n));
  if (action === 'reject') return confirm((M.bulk_confirm_reject || 'Reject {n} players?').replace('{n}', n));
  return true;
}

// ---------- Referral copy ----------
(function () {
  const btn = document.getElementById('copyRef');
  const input = document.getElementById('refLink');
  if (!btn || !input) return;
  const M = window.MSG || { copied: 'Copied!', copy: 'Copy link' };
  const paint = (icon, text) => { btn.innerHTML = '<i data-lucide="' + icon + '" class="me-1"></i>' + text; if (window.renderIcons) window.renderIcons(); };
  btn.addEventListener('click', () => {
    const link = location.origin + '/signup?ref=' + input.value;
    const done = () => { paint('check', M.copied); setTimeout(() => paint('copy', M.copy), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done).catch(done);
    else { input.select(); document.execCommand('copy'); done(); }
  });
})();

// ---------- Dashboard flash messages ----------
(function () {
  const flash = document.getElementById('flash');
  if (!flash) return;
  const M = window.MSG || {};
  const params = new URLSearchParams(location.search);
  const amt = params.get('amt');
  const messages = {
    'ok=funds': ['success', M.f_funds],
    'ok=deprequested': ['success', M.f_deprequested],
    'ok=campaign': ['success', M.f_campaign + (amt ? ' (+' + amt + ')' : '')],
    'err=campaign': ['warning', M.e_campaign],
    'ok=withdraw': ['success', M.f_withdraw],
    'err=payout': ['danger', M.e_payout],
    'ok=bonus': ['success', M.f_bonus + (amt ? ' (+' + amt + ')' : '')],
    'ok=sent': ['success', M.f_sent],
    'err=amount': ['danger', M.e_amount],
    'err=plan': ['danger', M.e_plan],
    'err=wamount': ['danger', M.e_wamount],
    'err=tamount': ['danger', M.e_tamount],
    'err=recipient': ['danger', M.e_recipient],
    'err=insufficient': ['danger', M.e_insufficient],
    'err=cadence': ['warning', M.e_cadence],
    'err=claimed': ['warning', M.e_claimed],
    'err=locked': ['warning', M.e_locked],
    'err=wlocked': ['warning', M.e_wlocked],
    'err=needdeposit': ['warning', M.e_needdeposit]
  };
  for (const [key, [type, text]] of Object.entries(messages)) {
    const [k, v] = key.split('=');
    if (params.get(k) === v && text) {
      flash.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show">
        ${text}<button class="btn-close" data-bs-dismiss="alert"></button></div>`;
      history.replaceState({}, '', location.pathname);
      break;
    }
  }
})();
