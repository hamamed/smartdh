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
    'err=locked': ['warning', M.e_locked]
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
