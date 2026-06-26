// W Forex App — عميل API للاتصال بالسيرفر
import { SERVER_URL } from './config';

// helper: fetch with timeout so the UI never hangs on a dead server
async function getJSON(path, { timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`${SERVER_URL}${path}`, {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// جلب الحالة الكاملة (شموع + صفقات + حساب)
export async function fetchState() {
  return getJSON('/api/state');
}

// جلب آخر رسائل تيليجرام
export async function fetchTelegram(limit = 15) {
  return getJSON(`/api/telegram?limit=${limit}`);
}

// فحص صحة الخادم
export async function fetchHealth() {
  return getJSON('/api/health', { timeout: 4000 });
}

// تنسيق الوقت
export function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts > 1e12 ? ts : ts * 1000);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - (ts > 1e12 ? ts / 1000 : ts);
  if (diff < 60) return 'قبل ' + diff + ' ثانية';
  if (diff < 3600) return 'قبل ' + Math.floor(diff / 60) + ' دقيقة';
  return 'قبل ' + Math.floor(diff / 3600) + ' ساعة';
}

export function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
