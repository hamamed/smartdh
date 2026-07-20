// Reset any user's password directly on the server — no email needed.
// Use this if SMTP isn't set up and someone (incl. the admin) is locked out.
//
//   node scripts/set-password.js <email> <newPassword>
//
// The running app keeps the database in memory, so after this restart it:
//   systemctl restart smartdh
const bcrypt = require('bcryptjs');
const { load, save } = require('../db');

const [, , email, pw] = process.argv;
if (!email || !pw) {
  console.error('Usage: node scripts/set-password.js <email> <newPassword>');
  process.exit(1);
}
if (pw.length < 4) {
  console.error('Password must be at least 4 characters.');
  process.exit(1);
}

const db = load();
const u = db.users.find(x => x.email.toLowerCase() === email.toLowerCase());
if (!u) {
  console.error('No user with email: ' + email);
  console.error('Known emails: ' + db.users.map(x => x.email).join(', '));
  process.exit(1);
}

u.passwordHash = bcrypt.hashSync(pw, 10);
u.reset = null;
save(db);
console.log(`✓ Password updated for ${u.name} <${u.email}>.`);
console.log('  Now restart the app so it reloads:  systemctl restart smartdh');
