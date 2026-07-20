// Seed N fully-populated TEST users straight into the database — invested funds,
// payout details, deposits, XP/earnings, streaks. They're all test accounts, so
// they show only in Admin > Test Lab and never touch the real dashboard/totals.
//
//   node scripts/seed-test-users.js 300
//   systemctl restart smartdh        # the running app caches the DB — restart to load
//
// Every account's password is: test1234
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { load, save, refCode } = require('../db');

const COUNT = Number(process.argv[2]) || 300;
const PASSWORD = 'test1234';
const DAY = 86400000, now = Date.now();

const FIRST = ['Mohammed','Youssef','Amine','Yassine','Omar','Hamza','Karim','Anas','Bilal','Ayoub','Reda','Zakaria','Ilyas','Mehdi','Adam','Rayan','Nabil','Khalid','Said','Rachid','Hicham','Tarik','Samir','Aziz','Younes','Soufiane','Badr','Othmane','Fatima','Aicha','Khadija','Salma','Sara','Imane','Nadia','Hind','Meryem','Zineb','Yasmine','Ghita','Rim','Laila','Amina','Houda','Siham','Karima','Naima','Loubna','Souad','Chaima'];
const LAST = ['El Amrani','Benali','Bouzid','Alaoui','Idrissi','Tazi','Bennani','Chraibi','El Fassi','Berrada','Lahlou','Sekkat','Kettani','Ziani','El Mansouri','Rachidi','Hakimi','Ouazzani','Belhaj','Naciri','Saidi','Cherkaoui','Bouhali','El Kadiri','Fikri','Ghazi','Harrak','Jebli','Squalli'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const int = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const fakeRib = () => { let d = ''; for (let i = 0; i < 24; i++) d += int(0, 9); return d.replace(/(\d{3})(\d{3})(\d{16})(\d{2})/, '$1 $2 $3 $4'); };

const db = load();
const apps = db.settings.plans;            // use whatever apps actually exist
const LEVEL3_XP = 200;
const hash = bcrypt.hashSync(PASSWORD, 10); // one hash — everyone shares the password
const seen = new Set(db.users.map(u => u.email.toLowerCase()));

let created = 0;
for (let i = 0; i < COUNT; i++) {
  const first = pick(FIRST), last = pick(LAST), name = first + ' ' + last;
  let email = `${slug(first)}.${slug(last)}@example.com`, n = 2;
  while (seen.has(email)) email = `${slug(first)}.${slug(last)}${n++}@example.com`;
  seen.add(email);

  const r = Math.random();
  const status = r < 0.70 ? 'active' : r < 0.95 ? 'pending' : 'rejected';
  const xp = status === 'active' ? int(0, 2500) : 0;
  const earnings = status === 'active' ? int(0, 40000) : 0;

  const invested = {};
  if (status === 'active') {
    apps.forEach(p => {
      if (p.id === 'risky' && xp < LEVEL3_XP) return;
      if (Math.random() < 0.35) return;
      invested[p.id] = int(1, 40) * 500;
    });
    if (!Object.keys(invested).length) invested[apps[0].id] = int(1, 20) * 500;
  }

  const bank = Math.random() < 0.6;
  const id = db.nextUserId++;
  const u = {
    id, name, email, passwordHash: hash, isAdmin: false, status, lang: null, isTest: true, role: null,
    invested, earnings, xp, lastAccrual: now, createdAt: now - int(0, 60) * DAY,
    transactions: [], achievements: [], history: [],
    streak: { count: status === 'active' ? int(0, 12) : 0, lastClaim: null },
    payout: { method: bank ? 'bank' : 'paypal', name, paypal: bank ? '' : `${slug(first)}.${slug(last)}@paypal.com`, rib: bank ? fakeRib() : '' },
    referralEarnings: 0, refAccrued: 0, refLastTx: 0, campaignClaims: 0, campaignRewarded: false,
    avatar: '', onboarded: true, reset: null, referralCode: refCode(id), referredBy: null,
    emailToken: crypto.randomBytes(16).toString('hex'), emailOptOut: false, gsDismissed: true
  };
  db.users.push(u);

  // Back each holding with an approved (some past the 30-day lock, some not) deposit.
  Object.entries(invested).forEach(([plan, amount]) => {
    const p = apps.find(x => x.id === plan);
    const at = now - int(0, 90) * DAY;
    db.deposits.push({ id: db.nextDepositId++, userId: id, userName: name, plan, planLabel: p.name, amount, status: 'approved', note: '', receipt: '', byAdmin: true, createdAt: at, approvedAt: at });
    u.transactions.push({ type: 'deposit', amount, note: p.name, at });
  });
  created++;
}

save(db);
console.log(`✓ Seeded ${created} test users (password: ${PASSWORD}).`);
console.log('  They appear in Admin > Test Lab, with invested funds + payout details.');
console.log('  Now restart the app so it loads them:  systemctl restart smartdh');
