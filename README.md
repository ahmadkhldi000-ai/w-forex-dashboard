<div align="center">

# W Forex VIP — Smart Gold Trading System

**نظام تداول ذكي متكامل للذهب** — لوحة تحكم حية + تطبيق موبايل + بوت MT5

[![Node.js](https://img.shields.io/badge/Node.js-19+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React Native](https://img.shields.io/badge/React_Native-Expo-61DAFB?logo=react&logoColor=black)](https://expo.dev)
[![MetaTrader 5](https://img.shields.io/badge/MT5-EA-0072C6?logo=metatrader&logoColor=white)](https://www.metatrader5.com)
[![License](https://img.shields.io/badge/License-Private-CC0000)]()

</div>

---

نظام **W Forex VIP** هو منصة تداول ذكية متكاملة تقدم لوحة تحكم احترافية بتصميم شبيه بـ TradingView مع شموع ذهب حية، تطبيق موبايل عبر Expo، وبوتات تداول MQL5 تعمل على MetaTrader 5. يشمل النظام بثّاً حيًا عبر SSE، تسجيل دخول بـ Google OAuth، إشعارات Telegram، ووضع SIM للعرض التوضيحي.

---

## Screenshots

| Dashboard | Mobile App | MT5 EA |
|:---:|:---:|:---:|
| <img src="screenshots/dashboard.png" alt="Dashboard" width="400"/> | <img src="screenshots/mobile.png" alt="Mobile" width="400"/> | <img src="screenshots/mt5-ea.png" alt="MT5 EA" width="400"/> |

> *أضف صورًا حقيقية للمشروع في مجلد `screenshots/`*

---

## ✨ Features

### Dashboard (لوحة التحكم)
- شارت شموع ذهب حية بتصميم TradingView-like
- بث مباشر للبيانات عبر Server-Sent Events (SSE)
- محاكاة بيانات ذهب حقيقية من Yahoo Finance
- تسجيل دخول بـ Google OAuth أو email/password
- عرض الصفقات المفتوحة والمغلقة والإحصائيات
- وضع SIM للعرض بدون اتصال بـ EA
- تصميم عربي RTL متجاوب بالكامل

### Mobile App (تطبيق الهاتف)
- شاشة Home مع عرض مباشر للسعر والصفقات
- شاشة Telegram للتواصل والإشعارات
- شاشة About مع معلومات النظام
- بنية Expo/React Native مع TypeScript

### Telegram Bot
- إشعارات فورية للصفقات المفتوحة والمغلقة
- تنبيهات الأرباح والخسائر
- تحكم بالبوت عبر الأوامر

### MT5 Expert Advisors
- **SmartGridEA_MaxTrades** — بوت شبكة ذكي بحد أقصى للصفقات
- **InstitutionalHedgeEA** — بوت تحوط مؤسسي للذهب

---

## 📁 Project Structure

```
W-Forex-FINAL/
├── server/                          # سيرفر Node.js/Express
│   ├── server.js                    # نقطة الدخول الرئيسية
│   ├── .env.example                 # قالب متغيرات البيئة
│   ├── package.json
│   └── ...
├── mobile/                          # تطبيق Expo/React Native
│   ├── index.js                     # نقطة الدخول
│   ├── App.js                       # المكون الرئيسي
│   ├── tsconfig.json
│   ├── package.json
│   └── ...
├── ea/                              # بوتات MetaTrader 5
│   ├── SmartGridEA_MaxTrades.mq5    # بوت الشبكة الذكي
│   └── InstitutionalHedgeEA.mq5     # بوت التحوط المؤسسي
├── render.yaml                      # إعدادات النشر على Render
├── run_all.sh                        # تشغيل جميع المكونات
├── package.json                     # إعدادات المشروع الرئيسية
└── README.md                        # هذا الملف
```

---

## 🚀 Local Development

### المتطلبات
- Node.js 18+
- npm أو yarn
- Expo CLI (للتطبيق)
- MetaTrader 5 (للبوتات)

### تشغيل السيرفر

```bash
cd server
npm install
cp .env.example .env    # عدّل المتغيرات حسب الحاجة
node server.js
```

السيرفر سيعمل على `http://localhost:3000`

### تشغيل تطبيق الموبايل

```bash
cd mobile
npm install
npx expo start
```

> افتح الرابط في Expo Go على هاتفك أو اضغط `a` لـ Android أو `i` لـ iOS

### تشغيل البوتات MT5

1. انسخ ملفات `.mq5` من مجلد `ea/`
2. الصقها في `MQL5/Experts/` داخل مجلد MetaTrader 5
3. افتح MetaTrader 5 وافتح الملفات من Navigator
4. فعّل AutoTrading واترك البوت يعمل

---

## ☁️ Deploy to Render

النشر مجانيًا على Render.com باستخدام Blueprint:

### الخطوات

1. **ارفع المشروع إلى GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<username>/W-Forex-FINAL.git
   git push -u origin main
   ```

2. **أنشئ مشروعًا جديدًا على Render**
   - اذهب إلى [render.com](https://render.com)
   - اضغط **New** > **Blueprint**
   - اختر مستودع GitHub
   - Render سيقرأ `render.yaml` تلقائيًا

3. **الخدمات التي ستنشر تلقائيًا**
   - `w-forex-vip-dashboard` — السيرفر (Web Service)
   - `w-forex-vip-mobile` — تطبيق الموبايل (Docker)

### إعداد متغيرات البيئة على Render

أضف هذه المتغيرات في Render Dashboard:

| المتغير | الوصف |
|---|---|
| `GOOGLE_CLIENT_ID` | معرّف OAuth من Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | مفتاح OAuth من Google Cloud Console |
| `TELEGRAM_BOT_TOKEN` | توكن بوت Telegram من @BotFather |
| `TELEGRAM_CHAT_ID` | معرّف المحادثة على Telegram |
| `SESSION_SECRET` | مفتاح تشفير الجلسات (سلسلة عشوائية) |

---

## ⚙️ Environment Variables

انسخ ملف القالب وعدّل القيم:

```bash
cd server
cp .env.example .env
```

| المتغير | الوصف | الافتراضي |
|---|---|---|
| `PORT` | منفذ السيرفر | `3000` |
| `AUTH_TOKEN` | رمز التوثيق | `WFOREX_SECRET` |
| `SESSION_SECRET` | مفتاح تشفير الجلسات | — |
| `GOOGLE_CLIENT_ID` | معرّف Google OAuth | — |
| `GOOGLE_CLIENT_SECRET` | مفتاح Google OAuth | — |
| `TELEGRAM_BOT_TOKEN` | توكن بوت تيليجرام | — |
| `TELEGRAM_CHAT_ID` | معرّف محادثة تيليجرام | — |
| `SIM_MODE` | وضع العرض التوضيحي | `true` |
| `DATA_PROVIDER` | مزود بيانات الذهب | `simulation` |

---

## 🛠️ Tech Stack

| المكون | التقنيات |
|---|---|
| **Backend** | Node.js, Express.js |
| **Real-time** | Server-Sent Events (SSE) |
| **Auth** | Google OAuth 2.0, Passport.js |
| **Data** | Yahoo Finance API |
| **Mobile** | React Native, Expo, TypeScript |
| **Notifications** | Telegram Bot API |
| **Trading** | MQL5 (MetaTrader 5) |
| **Deployment** | Render.com, Docker |
| **Charts** | Custom Canvas (TradingView-style) |

---

## 🔐 Security Notes

- لا ترفع ملف `.env` إلى GitHub — استخدم `.env.example` كقالب
- احرص على إضافة `.env` إلى `.gitignore`
- غيّر `AUTH_TOKEN` و `SESSION_SECRET` إلى قيم قوية في الإنتاج
- فعّل HTTPS على Render تلقائيًا

---

## 📄 License

هذا المشروع خاص ومرخص للاستخدام الشخصي فقط. © 2026 **W Forex VIP**

---

<div align="center">

**W Forex VIP** — بوت التداول الذكي للذهب

Made with ❤️ by Ahmad Khaldi

</div>
