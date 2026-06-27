// Reset password for ahmadkhldi000@gmail.com using the exact server hashing logic
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const NEW_PASSWORD = 'Wforex2026!';
const TARGET_EMAIL = 'ahmadkhldi000@gmail.com';

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${derived}`;
}

const file = path.join(__dirname, 'users.json');
const db = JSON.parse(fs.readFileSync(file, 'utf8'));

let changed = false;
for (const u of db.users) {
  if (u.email === TARGET_EMAIL) {
    u.password = hashPassword(NEW_PASSWORD);
    changed = true;
    console.log('Reset password for:', u.email);
  }
}
if (!changed) { console.error('User not found!'); process.exit(1); }

fs.writeFileSync(file, JSON.stringify(db, null, 2) + '\n', 'utf8');
console.log('users.json updated. New password:', NEW_PASSWORD);
