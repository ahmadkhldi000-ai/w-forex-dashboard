#!/bin/bash
# W Forex — استكشاف وإصلاح المشاكل الشائع

echo "========================================="
echo "   W Forex — استكشاف الأخطاء"
echo "========================================="
echo ""

# 1) فحص node
echo "1) فحص Node.js:"
if command -v node >/dev/null 2>&1; then
  echo "   ✓ Node مثبت: $(node --version)"
else
  echo "   ✗ Node غير مثبت — ثبّته من nodejs.org"
fi

# 2) فحص npm
echo ""
echo "2) فحص npm:"
if command -v npm >/dev/null 2>&1; then
  echo "   ✓ npm مثبت: $(npm --version)"
else
  echo "   ✗ npm غير مثبت"
fi

# 3) فحص المنافذ
echo ""
echo "3) فحص المنافذ النشطة:"
if lsof -i:3000 -nP 2>/dev/null | grep LISTEN >/dev/null 2>&1; then
  echo "   ✓ المنفذ 3000 (السيرفر) مفتوح"
else
  echo "   ✗ المنفذ 3000 مغلق"
fi


# 4) فحص الملفات
echo ""
echo "4) فحص الملفات الحرجة:"
[ -f server/server.js ] && echo "   ✓ server/server.js" || echo "   ✗ server/server.js"
[ -f server/public/index.html ] && echo "   ✓ server/public/index.html" || echo "   ✗ server/public/index.html"
[ -f ea/SmartGridEA_MaxTrades.mq5 ] && echo "   ✓ ea/SmartGridEA_MaxTrades.mq5" || echo "   ✗ ea/SmartGridEA_MaxTrades.mq5"

# 5) فحص node_modules
echo ""
echo "5) فحص التبعيات:"
[ -d server/node_modules ] && echo "   ✓ server/node_modules موجود" || echo "   ✗ server/node_modules ناقص"

# 6) فحص .env
echo ""
echo "6) فحص الإعدادات:"
[ -f server/.env ] && echo "   ✓ server/.env موجود" || echo "   ✗ server/.env ناقص"
if [ -f server/.env ]; then
  echo "   محتويات .env (بدون قيم حساسة):"
  grep -E "^[A-Z_]+=" server/.env | grep -v "TOKEN\|SECRET\|CLIENT_ID" | head -5 | sed 's/^/     /'
fi

# 7) اختبار السيرفر
echo ""
echo "7) اختبار السيرفر:"
if curl -s -m 3 http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "   ✓ السيرفر يستجيب على http://localhost:3000"
else
  echo "   ✗ السيرفر لا يستجيب"
  echo "   لتشغيله: cd server && node server.js"
fi

# 8) توصيات
echo ""
echo "========================================="
echo "   توصيات للإصلاح"
echo "========================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "- ثبّت Node.js من nodejs.org"
fi

if ! [ -d server/node_modules ]; then
  echo "- في مجلد server، شغّل: npm install"
fi

if ! [ -f server/.env ]; then
  echo "- في مجلد server، انسخ .env.example إلى .env وعدّله"
fi

echo ""
echo "لتشغيل كل شيء:"
echo "  ./run_all.sh"
echo ""
echo "للفحص الشامل:"
echo "  npm run check"
echo ""