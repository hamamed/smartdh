// Generates a CSV of random players for testing the Admin > Data > Import feature.
//   node scripts/make-test-users.js            -> 100 users into test-users.csv
//   node scripts/make-test-users.js 500 out.csv
const fs = require('fs');
const path = require('path');

const COUNT = Number(process.argv[2]) || 100;
const OUT = process.argv[3] || path.join(__dirname, '..', 'test-users.csv');
const PASSWORD = 'test1234'; // same for everyone so you can log in as any of them

const FIRST = [
  'Mohammed', 'Youssef', 'Amine', 'Yassine', 'Omar', 'Hamza', 'Karim', 'Anas', 'Bilal', 'Ayoub',
  'Reda', 'Zakaria', 'Ilyas', 'Mehdi', 'Adam', 'Rayan', 'Nabil', 'Khalid', 'Said', 'Rachid',
  'Hicham', 'Tarik', 'Jamal', 'Samir', 'Aziz', 'Younes', 'Soufiane', 'Marouane', 'Badr', 'Othmane',
  'Fatima', 'Aicha', 'Khadija', 'Salma', 'Sara', 'Imane', 'Nadia', 'Hind', 'Meryem', 'Zineb',
  'Yasmine', 'Ghita', 'Rim', 'Laila', 'Amina', 'Houda', 'Siham', 'Karima', 'Naima', 'Loubna',
  'Malika', 'Souad', 'Hanane', 'Chaima', 'Ikram', 'Oumaima', 'Wafa', 'Nezha', 'Asma', 'Btissam'
];
const LAST = [
  'El Amrani', 'Benali', 'Bouzid', 'Alaoui', 'Idrissi', 'Tazi', 'Bennani', 'Chraibi', 'El Fassi',
  'Berrada', 'Lahlou', 'Sekkat', 'Kettani', 'Ziani', 'El Mansouri', 'Rachidi', 'Hakimi', 'Ouazzani',
  'Belhaj', 'Naciri', 'Saidi', 'Cherkaoui', 'Bouhali', 'El Kadiri', 'Zouhair', 'Fikri', 'Ghazi',
  'Harrak', 'Jebli', 'Squalli'
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const int = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

// CSV cell escaping (names contain spaces, and could contain commas)
const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// Default app ids. Change these if you renamed/added apps in the admin panel —
// the import only fills columns whose app actually exists.
const APPS = (process.argv[4] || 'safe,balanced,risky').split(',');
const LEVEL3_XP = 200; // level = floor(sqrt(xp/50))+1, so 200xp = level 3

// A fake Moroccan RIB (24 digits, grouped) — demo only, never a real account.
const fakeRib = () => {
  let d = '';
  for (let i = 0; i < 24; i++) d += int(0, 9);
  return d.replace(/(\d{3})(\d{3})(\d{16})(\d{2})/, '$1 $2 $3 $4');
};

// is_test=yes so these import straight into the Test Lab, kept out of the real
// dashboard, totals and leaderboard. payout_* lets you test withdrawals.
const rows = [['name', 'email', 'status', 'is_test', 'xp', 'earnings', 'password',
  ...APPS.map(a => 'invested_' + a), 'payout_method', 'payout_name', 'payout_account', 'withdrawn']];
const seen = new Set();

while (rows.length <= COUNT) {
  const first = pick(FIRST);
  const last = pick(LAST);
  const name = first + ' ' + last;

  // unique email
  let email = `${slug(first)}.${slug(last)}@example.com`;
  let n = 2;
  while (seen.has(email)) email = `${slug(first)}.${slug(last)}${n++}@example.com`;
  seen.add(email);

  // 70% active, 25% pending, 5% rejected
  const r = Math.random();
  const status = r < 0.70 ? 'active' : r < 0.95 ? 'pending' : 'rejected';

  // active players have progress; pending/rejected ones are fresh
  const xp = status === 'active' ? int(0, 2500) : 0;
  const earnings = status === 'active' ? int(0, 40000) : 0;

  // Investments: only active players hold anything, and each holds a random
  // subset of apps. 'risky' is level-3 locked in the game, so only give it to
  // players whose XP would actually have unlocked it.
  const invested = APPS.map(app => {
    if (status !== 'active') return 0;
    if (app === 'risky' && xp < LEVEL3_XP) return 0;
    if (Math.random() < 0.35) return 0;              // not everyone holds every app
    return int(1, 40) * 500;                          // 500 .. 20,000 in round numbers
  });
  // make sure an active player isn't left with nothing invested
  if (status === 'active' && invested.every(v => v === 0)) invested[0] = int(1, 20) * 500;

  // Payout details so withdrawals can be tested. 60% bank (RIB), 40% PayPal.
  const bank = Math.random() < 0.6;
  const payMethod = bank ? 'bank' : 'paypal';
  const payAccount = bank ? fakeRib() : `${slug(first)}.${slug(last)}@paypal.com`;

  // ~60% of active earners have withdrawn some of their earnings over the 3 months.
  // The import spreads this total across 1–3 random "paid" withdrawals in that window.
  const withdrawn = (status === 'active' && earnings > 0 && Math.random() < 0.6)
    ? Math.round(earnings * (0.1 + Math.random() * 0.4) / 100) * 100 : 0;

  rows.push([name, email, status, 'yes', xp, earnings, PASSWORD, ...invested, payMethod, name, payAccount, withdrawn]);
}

fs.writeFileSync(OUT, '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n'), 'utf8');
console.log(`Wrote ${COUNT} users -> ${OUT}`);
console.log(`Every account's password is: ${PASSWORD}`);
console.log(`Apps: ${APPS.join(', ')} (override: node scripts/make-test-users.js 100 out.csv safe,balanced,risky,app1)`);
