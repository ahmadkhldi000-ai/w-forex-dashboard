#!/usr/bin/env node
// W Forex — سكربت فحص شامل للمشروع

import fs from 'fs';

const root = process.cwd();
const checks = [];

function check(name, result, details = '') {
  checks.push({ name, result: result ? '✓' : '✗', details });
}

// فحص الملفات الحرجة
check('EA (SmartGridEA_MaxTrades.mq5)', fs.existsSync('ea/SmartGridEA_MaxTrades.mq5'));
check('EA (InstitutionalHedgeEA.mq5)', fs.existsSync('ea/InstitutionalHedgeEA.mq5'));
check('Server (server.js)', fs.existsSync('server/server.js'));
check('Server (index.html)', fs.existsSync('server/public/index.html'));
check('README.md (root)', fs.existsSync('README.md'));
check('TASLEEM_REPORT.md', fs.existsSync('TASLEEM_REPORT.md'));
check('DETAILED_GUIDE.md', fs.existsSync('DETAILED_GUIDE.md'));
check('run_all.sh', fs.existsSync('run_all.sh'));

// فحص الإعدادات
check('Server .env', fs.existsSync('server/.env'));
check('Server .env.example', fs.existsSync('server/.env.example'));
check('Server package.json', fs.existsSync('server/package.json'));
check('render.yaml', fs.existsSync('render.yaml'));

// فحص البنية
check('Server node_modules موجود', fs.existsSync('server/node_modules'));

// فحص المحتوى
try {
  const serverJs = fs.readFileSync('server/server.js', 'utf8');
  check('Server.js صالح', serverJs.includes('W Forex Dashboard v4.0'));
} catch {
  check('Server.js صالح', false, 'error reading');
}

try {
  const mq5 = fs.readFileSync('ea/SmartGridEA_MaxTrades.mq5', 'utf8');
  check('EA يحتوي DashboardURL', mq5.includes('DashboardURL'));
  check('EA يحتوي TelegramToken', mq5.includes('TelegramToken'));
} catch {
  check('EA يحتوي DashboardURL', false, 'error reading');
  check('EA يحتوي TelegramToken', false, 'error reading');
}

// فحص المنافذ (اختياري)
try {
  const ps = require('child_process').execSync('lsof -i:3000 2>/dev/null', { encoding: 'utf8' });
  const hasServer = ps.includes('LISTEN') && ps.includes(':3000');
  check('السيرفر يعمل على المنفذ 3000', hasServer);
} catch {
  check('السيرفر يعمل على المنفذ 3000', false, 'منفذ مشغول أو أداة lsof غير موجودة');
}

// عرض النتائج
console.log('\n=========================================');
console.log('   فحص W Forex — النتائج');
console.log('=========================================\n');

let passed = 0, failed = 0;
for (const c of checks) {
  if (c.result === '✓') {
    passed++;
    console.log(`  ✓ ${c.name}`);
  } else {
    failed++;
    console.log(`  ✗ ${c.name}${c.details ? ` — ${c.details}` : ''}`);
  }
}

console.log('\n=========================================');
console.log(`   المجموع: ${checks.length}  |  ✓ ${passed}  |  ✗ ${failed}`);
console.log('=========================================\n');

if (failed === 0) {
  console.log('✅ كل شيء جاهز! يمكنك المتابعة بالتشغيل أو التسليم.\n');
} else {
  console.log('⚠️  توجد ' + failed + ' عناصر ناقصة. راجع القائمة أعلاه.\n');
}

process.exit(failed === 0 ? 0 : 1);
