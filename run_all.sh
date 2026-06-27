#!/bin/bash
# W Forex — تشغيل السيرفر
# استخدم هذا النص في الترمينال الآخر لتشغيل السيرفر جاهزاً

set -e

echo "=============================================="
echo "   تشغيل W Forex — السيرفر"
echo "=============================================="
echo ""

# إيقاف أي عمليات سابقة
echo "1) إيقاف العمليات السابقة..."
pkill -f "node server.js" 2>/dev/null || true
sleep 1
echo "   ✓ تم"
echo ""

# التأكد من التبعيات
echo "2) فحص التبعيات..."
cd server
if [ ! -d node_modules ]; then
  echo "   ⚠️  تبعيات غير مثبتة — سيتم التثبيت الآن..."
  npm install --no-audit --no-fund
fi
echo "   ✓ التبعيات جاهزة"
echo ""

# تشغيل السيرفر
echo "3) تشغيل السيرفر..."
nohup node server.js > server.log 2>&1 &
SERVER_PID=$!
echo "   ✓ السيرفر يعمل في الخلفية (PID: $SERVER_PID)"
echo "   السجل: server/server.log"
echo ""

# التحقق من الإقلاع
echo "4) التحقق من الإقلاع..."
sleep 3
if lsof -i:3000 -nP 2>/dev/null | grep LISTEN >/dev/null 2>&1; then
  echo "   ✓ السيرفر جاهز على المنفذ 3000"
else
  echo "   ✗ السيرفر لم يبدأ بعد — تأكد من منفذ 3000"
  exit 1
fi
echo ""

echo "=============================================="
echo "   السيرفر يعمل!"
echo "=============================================="
echo ""
echo "الموقع:   http://localhost:3000"
echo ""
echo "للتحقق:"
echo "  curl http://localhost:3000/api/health"
echo ""
echo "للإيقاف:"
echo "  pkill -f 'node server.js'"
echo ""
