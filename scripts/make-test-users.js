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

const rows = [['name', 'email', 'status', 'xp', 'earnings', 'password']];
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

  // active players have progress; pending ones are fresh
  const xp = status === 'active' ? int(0, 2500) : 0;
  const earnings = status === 'active' ? int(0, 40000) : 0;

  rows.push([name, email, status, xp, earnings, PASSWORD]);
}

fs.writeFileSync(OUT, '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n'), 'utf8');
console.log(`Wrote ${COUNT} users -> ${OUT}`);
console.log(`Every account's password is: ${PASSWORD}`);
