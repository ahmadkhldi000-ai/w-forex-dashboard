// W Forex App — الإعدادات العامة
// غيّر SERVER_URL إلى عنوان السيرفر المنشور عند التسليم
// محلياً: استخدم IP جهازك على نفس الشبكة (مثلاً http://192.168.1.5:3000)
// لا تستخدم localhost داخل الجهاز لأن المحاكي/الجهاز لا يصل إليه

import { Platform } from 'react-native';

// عنوان السيرفر — عدّله عند النشر
export const SERVER_URL = 'http://192.168.2.102:3000';

// معلومات البوت
export const BOT_INFO = {
  name: 'W Forex SmartGrid',
  symbol: 'XAUUSD',
  version: '1.10',
  maxTrades: 15,
  profitTarget: 0.30,
  channel: 'W Forex VIP',
};

// لوحة الألوان (مطابقة للموقع)
export const COLORS = {
  bg: '#08080d',
  bg2: '#0d0d15',
  surface: 'rgba(255,255,255,0.04)',
  surface2: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.16)',
  gold: '#f5c542',
  gold2: '#eab308',
  green: '#22c55e',
  greenBg: 'rgba(34,197,94,0.12)',
  red: '#ef4444',
  redBg: 'rgba(239,68,68,0.12)',
  text: '#f4f4f5',
  muted: '#9ca3af',
  muted2: '#6b7280',
  telegram: '#229ED9',
};

export const FONT = Platform.select({
  ios: { family: 'Cairo', monoFamily: 'Menlo' },
  android: { family: 'Cairo', monoFamily: 'monospace' },
  default: { family: 'Cairo', monoFamily: 'monospace' },
});
