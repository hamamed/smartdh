// ---------- PWA service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}

// ---------- Facebook-style relative time (mirrors the server timeAgo) ----------
function timeAgo(ts) {
  if (!ts) return '';
  const U = {
    en: { now: 'just now', m: 'min', h: 'h', d: 'd', w: 'w', mo: 'mo', y: 'y' },
    fr: { now: 'à l’instant', m: 'min', h: 'h', d: 'j', w: 'sem', mo: 'mois', y: 'an' },
    ar: { now: 'الآن', m: 'دقيقة', h: 'ساعة', d: 'يوم', w: 'أسبوع', mo: 'شهر', y: 'سنة' }
  };
  const L = U[document.documentElement.lang] || U.en;
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 45) return L.now;
  const m = Math.floor(s / 60); if (m < 60) return m + ' ' + L.m;
  const h = Math.floor(m / 60); if (h < 24) return h + ' ' + L.h;
  const d = Math.floor(h / 24); if (d < 7) return d + ' ' + L.d;
  if (d < 30) return Math.floor(d / 7) + ' ' + L.w;
  const mo = Math.floor(d / 30); if (mo < 12) return mo + ' ' + L.mo;
  return Math.floor(d / 365) + ' ' + L.y;
}
// Turn any element with data-ago="<ms timestamp>" into relative time (+ full date on hover).
function applyTimeAgo(root) {
  (root || document).querySelectorAll('[data-ago]').forEach(el => {
    const ts = Number(el.getAttribute('data-ago'));
    if (!ts) return;
    if (!el.title) el.title = new Date(ts).toLocaleString();
    el.textContent = timeAgo(ts);
  });
}
document.addEventListener('DOMContentLoaded', () => applyTimeAgo());
// Keep them fresh without a page reload.
setInterval(() => applyTimeAgo(), 60000);

// ---------- Chart theme (reads the Daylight CSS tokens so charts match + adapt) ----------
function dvTheme() {
  const s = getComputedStyle(document.documentElement);
  const v = (n, f) => (s.getPropertyValue(n).trim() || f);
  return {
    brand:       v('--brand', '#0e9f6e'),
    brandStrong: v('--brand-strong', '#0b7d57'),
    brandRgb:    v('--bs-primary-rgb', '14,159,110'),
    accent:      v('--accent', '#f4a62a'),
    danger:      v('--bs-danger', '#e5484d') || '#e5484d',
    ink:         v('--ink', '#14261c'),
    muted:       v('--muted', '#5f6b62'),
    line:        v('--line', '#e5eae2')
  };
}
// Re-run a chart's restyle() whenever the light/dark theme flips.
function dvOnThemeChange(fn) {
  new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
}
if (window.Chart) {
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = dvTheme().muted;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: 'rgba(18,29,23,.94)', padding: 11, cornerRadius: 12,
    titleColor: '#fff', bodyColor: '#e7efe9', displayColors: false,
    titleFont: { weight: '700' }, bodyFont: { family: "'JetBrains Mono', monospace" }
  });
}

// ---------- Balance history chart (bar+line combo, ranges + filter chips) ----------
// Same look as the admin trends chart: rounded bars for the amounts, a line for
// the running total, Hourly/Daily/Weekly/Monthly ranges and toggle chips.
(function () {
  const el = document.getElementById('balanceChart');
  if (!el || !window.Chart) return;
  let pts = [];
  try { pts = JSON.parse(el.dataset.points || '[]'); } catch (e) { return; }
  if (pts.length < 2) return;
  const currency = el.dataset.currency || '';
  const ctx = el.getContext('2d');
  const nf = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  // Compact axis labels so big numbers (20,000) don't get clipped: 20K, 1.2M…
  const fmtAxis = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return +(v / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return +(v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'K';
    return nf(v);
  };
  let T = dvTheme();

  // Soft vertical area gradient, keyed to the theme.
  const areaFill = (rgb) => { const g = ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, `rgba(${rgb},.28)`); g.addColorStop(1, `rgba(${rgb},0)`); return g; };
  // key → colour, matching the wallet cards + chip dots.
  const S = {
    invested: { label: el.dataset.linvested || 'Invested', rgb: () => '229,83,62' },
    earnings: { label: el.dataset.learnings || 'Earnings', rgb: () => T.brandRgb },
    referral: { label: el.dataset.lreferral || 'Referral', rgb: () => '124,107,224' },
    total:    { label: el.dataset.ltotal    || 'Total',    rgb: () => '244,166,42' }
  };

  // Each range is a time WINDOW shown day-by-day (hourly shows the last day by the
  // hour). Weekly = last 7 days, Monthly = last 30 days — every day is a point, so
  // no days are hidden. These are "stock" values, so a day keeps its last snapshot.
  const DAY = 86400000;
  function resample(range) {
    const now = Date.now();
    const win = { hourly: 2 * DAY, weekly: 7 * DAY, monthly: 30 * DAY }[range]; // daily = all history
    const src = win ? pts.filter(p => p.t >= now - win) : pts;
    const use = src.length >= 2 ? src : pts;     // fall back to everything if the window is empty
    const key = (t) => {
      const d = new Date(t);
      return range === 'hourly'
        ? d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() + '-' + d.getHours()
        : d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();   // one point per day
    };
    const m = new Map();
    use.forEach(p => m.set(key(p.t), p));         // last snapshot in each hour/day wins
    return Array.from(m.values());
  }
  function labelFor(t, range) {
    const d = new Date(t);
    if (range === 'hourly') return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });   // exact date, e.g. "Jan 15"
  }

  // Invested + Total are large (the deposited principal), Earnings + Referral are
  // small (the growth). On one axis the small ones vanish, so split them across two:
  //   left axis  (y)  → Invested (filled) + Total (line on top)
  //   right axis (y1) → Earnings (filled) + Referral (dashed), their own scale
  // Filled area lines (not bars) so the chart looks right with 2 points or 200.
  const line = (k, axis, order, opt) => {
    opt = opt || {};
    return {
      type: 'line', label: S[k].label, key: k, yAxisID: axis, data: [],
      borderColor: `rgb(${S[k].rgb()})`,
      backgroundColor: opt.fill ? areaFill(S[k].rgb()) : `rgb(${S[k].rgb()})`,
      fill: !!opt.fill, filled: !!opt.fill,
      pointBackgroundColor: `rgb(${S[k].rgb()})`, pointBorderColor: '#fff', pointBorderWidth: 1.5,
      tension: .35, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2.4,
      borderDash: opt.dash ? [5, 4] : [], order: order
    };
  };
  const chart = new Chart(ctx, {
    data: {
      labels: [],
      datasets: [
        line('invested', 'y', 3, { fill: true }),
        line('total', 'y', 0),
        line('earnings', 'y1', 1, { fill: true }),
        line('referral', 'y1', 2, { dash: true })
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 10, left: 4, right: 4 } },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x:  { offset: false, grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 8, color: T.muted, autoSkip: true, maxRotation: 0 } },
        y:  { beginAtZero: true, grid: { color: T.line }, border: { display: false }, ticks: { maxTicksLimit: 5, color: T.muted, callback: v => fmtAxis(v) } },
        y1: { beginAtZero: true, position: 'right', grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 5, color: T.muted, callback: v => fmtAxis(v) } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + Number(c.parsed.y).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + currency } }
      }
    }
  });

  let curRange = 'daily';
  function draw(range) {
    curRange = range;
    const rows = resample(range);
    chart.data.labels = rows.map(p => labelFor(p.t, range));
    chart.data.datasets.forEach(ds => { ds.data = rows.map(p => (p[ds.key] == null ? null : p[ds.key])); });
    chart.update();
  }

  // Chips: toggle each series on/off
  const idx = {}; chart.data.datasets.forEach((d, i) => idx[d.key] = i);
  document.querySelectorAll('#balFilters .trend-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const k = chip.dataset.series;
      const on = !chart.isDatasetVisible(idx[k]);
      chart.setDatasetVisibility(idx[k], on);
      chip.classList.toggle('active', on);
      chart.update();
    });
  });

  // Range buttons
  const btns = el.closest('.card-body').querySelectorAll('[data-range]');
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    draw(b.dataset.range);
  }));

  // Re-key colours to the theme when dark mode flips.
  dvOnThemeChange(() => {
    T = dvTheme();
    chart.data.datasets.forEach(ds => {
      const rgb = S[ds.key].rgb(), c = `rgb(${rgb})`;
      ds.borderColor = c; ds.pointBackgroundColor = c;
      ds.backgroundColor = ds.filled ? areaFill(rgb) : c;
    });
    chart.options.scales.x.ticks.color = T.muted;
    chart.options.scales.y.ticks.color = T.muted;
    chart.options.scales.y1.ticks.color = T.muted;
    chart.options.scales.y.grid.color = T.line;
    chart.update('none');
  });

  draw('daily');
})();

// ---------- Admin trends chart (hourly / daily / weekly / monthly) ----------
(function () {
  const el = document.getElementById('trendChart');
  if (!el || !window.Chart) return;
  const cur = el.dataset.currency || '';
  const ctx = el.getContext('2d');
  const nf = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

  // Deposits = emerald (brand), withdrawals = danger red, new players = amber accent.
  // Soft vertical gradient on the bars, keyed to the theme.
  const softBar = (rgb) => { const g = ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, `rgba(${rgb},.95)`); g.addColorStop(1, `rgba(${rgb},.55)`); return g; };
  const dangerRgb = '229,72,77';
  const palette = () => { const T = dvTheme(); return { T, dep: softBar(T.brandRgb), wd: softBar(dangerRgb) }; };

  let P = palette();
  const chart = new Chart(ctx, {
    data: {
      labels: [],
      datasets: [
        { type: 'bar', label: el.dataset.ldep || 'Deposits', data: [], counts: [], backgroundColor: P.dep, borderRadius: 7, borderSkipped: false, maxBarThickness: 34, order: 2 },
        { type: 'bar', label: el.dataset.lwd || 'Withdrawals', data: [], counts: [], backgroundColor: P.wd, borderRadius: 7, borderSkipped: false, maxBarThickness: 34, order: 2 },
        { type: 'line', label: el.dataset.lplayers || 'New players', data: [], borderColor: P.T.accent, backgroundColor: P.T.accent, pointBackgroundColor: P.T.accent, pointBorderColor: '#fff', pointBorderWidth: 1.5, yAxisID: 'y1', tension: .4, pointRadius: 3, borderWidth: 2.5, order: 1 },
        { type: 'line', label: el.dataset.lref || 'Referrals', data: [], borderColor: '#7c6be0', backgroundColor: '#7c6be0', pointBackgroundColor: '#7c6be0', pointBorderColor: '#fff', pointBorderWidth: 1.5, yAxisID: 'y1', tension: .4, pointRadius: 3, borderWidth: 2.5, borderDash: [5, 4], order: 0 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 12, color: P.T.muted, autoSkip: true } },
        y: { beginAtZero: true, grid: { color: P.T.line }, border: { display: false }, ticks: { maxTicksLimit: 5, color: P.T.muted, callback: v => nf(v) } },
        y1: { beginAtZero: true, position: 'right', grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 5, color: P.T.accent, precision: 0 } }
      },
      plugins: {
        legend: { display: false },   /* replaced by the filter chips above the chart */
        tooltip: { callbacks: { label: (c) => {
          const ds = c.dataset;
          if (ds.yAxisID === 'y1') return ds.label + ': ' + c.parsed.y;
          const n = ds.counts && ds.counts[c.dataIndex] != null ? ds.counts[c.dataIndex] : 0;
          return ds.label + ': ' + nf(c.parsed.y) + ' ' + cur + ' (' + n + ')';
        } } }
      }
    }
  });

  // Re-key every colour to the theme when the user flips dark mode.
  dvOnThemeChange(() => {
    P = palette();
    chart.data.datasets[0].backgroundColor = P.dep;
    chart.data.datasets[1].backgroundColor = P.wd;
    chart.data.datasets[2].borderColor = P.T.accent;
    chart.data.datasets[2].backgroundColor = P.T.accent;
    chart.data.datasets[2].pointBackgroundColor = P.T.accent;
    chart.options.scales.x.ticks.color = P.T.muted;
    chart.options.scales.y.ticks.color = P.T.muted;
    chart.options.scales.y.grid.color = P.T.line;
    chart.options.scales.y1.ticks.color = P.T.accent;
    chart.options.plugins.legend.labels.color = P.T.muted;
    chart.update('none');
  });

  // ----- Activity list under the chart (same time window as the chart) -----
  const actEl = document.getElementById('trendActivity');
  const actCount = document.getElementById('actCount');
  let L = {}; try { L = JSON.parse(actEl && actEl.dataset.i18n || '{}'); } catch (e) {}
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const statusClass = (s) => (s === 'approved' || s === 'paid' || s === 'active') ? 'success' : (s === 'rejected' ? 'danger' : 'warning');

  function renderActivity(events, total) {
    if (!actEl) return;
    if (actCount) actCount.textContent = total ? total + '' : '';
    if (!events.length) { actEl.innerHTML = '<p class="text-muted small mb-0">' + esc(L.empty || 'No activity in this range.') + '</p>'; return; }
    const rows = events.map(e => {
      const when = timeAgo(e.at), whenFull = new Date(e.at).toLocaleString();
      let icon, tint, title, amountHtml = '';
      if (e.kind === 'signup') {
        icon = e.referred ? 'user-round-plus' : 'user-plus';
        tint = e.referred ? 'ti-lilac' : 'ti-yellow';
        title = esc(e.name) + ' · ' + esc(L.joined || 'joined');
        if (e.referred) title += ' · ' + esc(L.invited_by || 'invited by') + ' ' + esc(e.referrer || '');
      } else {
        const dep = e.kind === 'deposit';
        icon = dep ? 'arrow-down-circle' : 'arrow-up-circle';
        tint = dep ? 'ti-mint' : 'ti-coral';
        title = esc(e.name) + (e.app ? ' · ' + esc(e.app) : '');
        amountHtml = '<div class="fw-semibold text-nowrap text-' + (dep ? 'success' : 'danger') + '">' + (dep ? '+' : '−') + nf(e.amount) + ' ' + esc(cur) + '</div>';
      }
      const statusTxt = L[e.status] || e.status || '';
      const badge = e.status ? '<span class="badge bg-' + statusClass(e.status) + '-subtle text-' + statusClass(e.status) + '">' + esc(statusTxt) + '</span>' : '';
      // whole row → the player's admin page; deposits/withdrawals also get an invoice button
      const userHref = e.userId != null ? '/admin/users/' + e.userId : '#';
      const invoice = (e.kind !== 'signup' && e.id != null)
        ? '<a class="btn btn-sm btn-outline-secondary btn-icon flex-shrink-0" style="width:30px;height:30px" title="' + esc(L.invoice || 'Invoice') + '" '
          + 'href="/admin/invoice/' + (e.kind === 'deposit' ? 'deposit' : 'withdraw') + '/' + e.id + '" target="_blank" rel="noopener">'
          + '<i data-lucide="file-text"></i></a>'
        : '';
      return '<div class="act-row d-flex align-items-center gap-2 py-2 border-top">'
        + '<a href="' + userHref + '" class="d-flex align-items-center gap-2 flex-grow-1 min-w-0 text-reset" style="text-decoration:none">'
        + '<span class="tile-icon ' + tint + ' flex-shrink-0" style="width:34px;height:34px;font-size:.95rem"><i data-lucide="' + icon + '"></i></span>'
        + '<span class="flex-grow-1 min-w-0"><span class="d-block small fw-semibold text-truncate">' + title + '</span>'
        + '<span class="d-block text-muted text-truncate" style="font-size:.75rem" title="' + esc(whenFull) + '">' + esc(when) + '</span></span></a>'
        + '<div class="d-flex align-items-center gap-2 flex-shrink-0">'
        +   '<div class="text-end lh-sm">' + amountHtml + badge + '</div>'
        +   invoice
        + '</div>'
        + '</div>';
    }).join('');
    actEl.innerHTML = rows;
    if (window.renderIcons) window.renderIcons();
  }

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
      chart.data.datasets[3].data = j.buckets.map(b => b.referrals);
      chart.update();
      lastEvents = j.events || [];
      renderFiltered();
    } catch (e) { /* ignore */ }
  }

  // ----- Series filters (chips): toggle chart series + activity list together -----
  const filters = { deposit: true, withdraw: true, signup: true, referral: true };
  const seriesIdx = { deposit: 0, withdraw: 1, signup: 2, referral: 3 };
  let lastEvents = [];
  function renderFiltered() {
    const ev = lastEvents.filter(e => filters[e.kind]);
    renderActivity(ev, ev.length);
  }
  document.querySelectorAll('#trendFilters .trend-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const s = chip.dataset.series;
      filters[s] = !filters[s];
      chip.classList.toggle('active', filters[s]);
      chart.setDatasetVisibility(seriesIdx[s], filters[s]);
      chart.update();
      renderFiltered();
    });
  });

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
