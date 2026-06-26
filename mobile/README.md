# W Forex — تطبيق الهاتف 📱

تطبيق جاهز للتسليم (React Native + Expo) لعرض بوت التداول **W Forex SmartGrid**.
يعمل على **Android** و **iOS** من نفس الكود، ويتصل بنفس سيرفر الموقع لعرض:
- ✅ شارت الذهب المباشر (شموع يابانية، مطابق لـ MT5)
- ✅ الصفقات المفتوحة لحظياً (تحديث كل 3 ثوانٍ)
- ✅ معلومات الحساب والأرباح
- ✅ قناة تيليجرام W Forex VIP (آخر الإشارات)
- ✅ تعريف احترافي عن البوت ومميزاته

---

## 🚀 التشغيل المحلي

### 1) المتطلبات
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- تطبيق **Expo Go** على هاتفك (من Google Play / App Store)

### 2) التثبيت
```bash
cd mobile
npm install
```

### 3) ضبط عنوان السيرفر
افتح `src/config.js` وعدّل `SERVER_URL` إلى عنوان سيرفرك على نفس شبكة الواي فاي:
```js
export const SERVER_URL = 'http://192.168.1.100:3000';  // IP جهازك
```
> ملاحظة: لا تستخدم `localhost` — الجهاز لا يصل إليه. استخدم IP الحاسوب على الشبكة.

### 4) تشغيل التطبيق
```bash
npx expo start
```
- امسح رمز QR بـ **Expo Go** على هاتفك
- أو اضغط `a` للأندرويد / `i` للـ iOS (المحاكي)

---

## 📦 بناء نسخة جاهزة للتسليم (APK / IPA)

### أندرويد (APK)
```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
النتيجة: ملف `.apk` قابل للتثبيت مباشرة على أي جهاز أندرويد.

### iOS (يتطلب حساب Apple Developer)
```bash
eas build -p ios
```

### تفاصيل بناء preview
يمكنك بناء APK محلي (بدون سحابة) عبر:
```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```
الـ APK سيكون في `android/app/build/outputs/apk/release/`.

---

## 🗂️ بنية المشروع
```
mobile/
├── App.js                    # المكوّن الرئيسي + التنقل السفلي
├── index.js                  # نقطة الدخول
├── app.json                  # إعدادات Expo (الاسم، الأيقونة، الباقة)
├── babel.config.js
├── package.json
└── src/
    ├── config.js             # عنوان السيرفر + الألوان + معلومات البوت
    ├── api.js                # دوال الاتصال بالسيرفر
    ├── components/
    │   └── CandleChart.js    # شارت الشموع اليابانية (SVG مخصص)
    └── screens/
        ├── HomeScreen.js     # الرئيسية: شارت + صفقات + حساب
        ├── TelegramScreen.js # قناة تيليجرام
        └── AboutScreen.js    # عن البوت + المميزات
```

---

## 🔗 الربط مع السيرفر
التطبيق يتصل بنفس سيرفر الموقع. الـ endpoints المستخدمة:
| المسار | الوصف |
|--------|-------|
| `GET /api/state`   | الحالة الكاملة (شموع، صفقات، حساب) |
| `GET /api/telegram`| آخر رسائل قناة تيليجرام |
| `GET /api/health`  | فحص الاتصال |

تأكد أن السيرفر يعمل ويسمح بالاتصال (CORS مفعّل افتراضياً).

---

## ⚙️ الإعدادات المهمة قبل التسليم
1. **`src/config.js`** → `SERVER_URL`: ضع عنوان السيرفر المنشور النهائي.
2. **`app.json`** → `slug`, `ios.bundleIdentifier`, `android.package`: عدّلها لقيم فريدة.
3. **الأيقونات**: ضع صور `assets/icon.png` و `splash.png` (1024×1024 و 1244×2432).

---

© 2026 W Forex VIP
