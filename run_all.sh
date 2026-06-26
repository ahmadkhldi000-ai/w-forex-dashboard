#!/bin/bash
# W Forex — تشغيل كامل (السيرفر + التطبيق)
# استخدم هذا النص في الترمينال الآخر لتشغيل كل شيء جاهزاً

set -e

echo "=============================================="
echo "   تشغيل W Forex — السيرفر + التطبيق"
echo "=============================================="
echo ""

# إيقاف أي عمليات سابقة
echo "1) إيقاف العمليات السابقة..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
sleep 2
echo "   ✓ تم التنظيف"
echo ""

# تشغيل السيرفر
echo "2) تشغيل السيرفر..."
cd server
nohup node server.js > /tmp/wforex_server.log 2>&1 &
echo "   السيرفر يعمل في الخلفية (PID: $!)"
echo "   السجل: /tmp/wforex_server.log"
echo ""

# الانتظار حتى يصبح السيرفر جاهزاً
echo "3) التحقق من السيرفر..."
sleep 5
if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "   ✓ السيرفر جاهز على http://localhost:3000"
else
  echo "   ✗ السيرفر لم يبدأ بعد — تأكد من منفذ 3000"
  exit 1
fi
echo ""

# تشغيل تطبيق الهاتف
echo "4) تشغيل تطبيق الهاتف (Expo)..."
cd ../mobile
if [ ! -d node_modules ]; then
  echo "   ⚠️  تبعيات غير مثبتة — سيتم التثبيت الآن (قد يستغرق 5-10 دقائق)..."
  npm install --no-audit --no-fund
fi

# تأكد من الإصدارات المتوافقة
echo "   ضبط الإصدارات المتوافقة مع Expo SDK 52..."
./node_modules/.bin/expo install expo-asset expo-file-system expo-font expo-constants @expo/vector-icons react-native-svg react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated >/dev/null 2>&1 || true

# تشغيل Expo
echo "   بدء Expo..."
nohup ./node_modules/.bin/expo start --lan > /tmp/expo_log.txt 2>&1 &
echo "   Expo يعمل في الخلفية (PID: $!)"
echo "   السجل: /tmp/expo_log.txt"
echo ""

# الانتظار حتى يصبح Metro جاهزاً
echo "5) التحقق من Expo..."
sleep 25
if lsof -i:8081 -nP 2>/dev/null | grep LISTEN >/dev/null 2>&1; then
  echo "   ✓ Expo جاهز على المنفذ 8081"
else
  echo "   ○ Expo قد يكون لا يزال يبدأ — راجع /tmp/expo_log.txt"
fi
echo ""

echo "=============================================="
echo "   كل شيء يعمل!"
echo "=============================================="
echo ""
echo "الموقع:   http://localhost:3000"
echo "Expo QR:  راجع الترمينال حيث يعمل Expo"
echo ""
echo "للتحقق:"
echo "  curl http://localhost:3000/api/health"
echo ""
echo "لإيقاف كل شيء:"
echo "  pkill -f 'node server.js' && pkill -f 'expo start'"
echo ""