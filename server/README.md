# W Forex Dashboard

لوحة تحكم حية لـ **W Forex Hedge Scalper EA** — يستقبل البيانات من MT5 EA ويعرضها في واجهة ويب حديثة مع مخططات الشموع اليابانية وملخص الصفقات.

![node](https://img.shields.io/badge/node-%E2%89%A518-green) ![express](https://img.shields.io/badge/express-4.x-black)

---

## ✨ المميزات

- 📊 **مخطط شموع حي** (lightweight-charts) — يحدّثه الـ EA في الزمن الفعلي.
- 🔐 **مصادقة كاملة** — تسجيل/دخول محلي + جلسات آمنة + استعادة كلمة المرور + دعم Google OAuth اختياري.
- 🤖 **تكامل EA** — يستقبل `POST /api/update` محمي بـ token.
- 🎨 **واجهة SaaSPlus** — dark theme + glassmorphism + responsive.
- ⚡ **بدون قاعدة بيانات** — كل البيانات في ملفات JSON (Zero-DB، مثالي للخطة المجانية).

---

## 🚀 التشغيل محلياً

```bash
npm install
npm start          # أو: npm run dev  (مع إعادة تشغيل تلقائي)
```

افتح المتصفح على: <http://localhost:3000/login>

**حساب تجريبي جاهز:**

| Email             | Password        |
|-------------------|-----------------|
| `demo@wforex.io`  | `wforex123`     |

> يمكنك تغييره من `users.json` أو إنشاء حساب جديد من صفحة التسجيل.

---

## ⚙️ متغيرات البيئة (`.env`)

```bash
# Google OAuth (اختياري)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# سر الجلسة (يُولّد تلقائياً إذا تُرك فارغاً)
SESSION_SECRET=

# SMTP لإرسال روابط استعادة كلمة المرور (اختياري — بدونها تُطبع في الكونسول)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

> ⚠️ **لا تُرفع `.env` إلى Git** — مُستثنى عبر `.gitignore`.

---

## 🌐 النشر على Render (مجاني)

هذا المشروع مُهيّأ مسبقاً عبر `render.yaml`:

1. **ارفع الكود إلى GitHub** (انظر الأسفل).
2. ادخل <https://render.com> → **New +** → **Blueprint**.
3. اختر مستودع GitHub. سيقرأ Render ملف `render.yaml` تلقائياً وينشئ الخدمة.
4. أضف المتغيرات البيئية في لوحة Render:
   - `AUTH_TOKEN` = قيمة موافقة لما يرسله الـ EA (افتراضي: `WFOREX_SECRET_2026`)
   - `SESSION_SECRET` = نص عشوائي طويل
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (اختياري)
5. انتظر حتى ينتهي الـ Build → ستحصل على رابط مثل:
   `https://w-forex-dashboard.onrender.com`

> ملاحظة: Render Free "ينام" بعد 15 دقيقة من عدم النشاط. أول زيارة تستيقظه (قد تأخذ ~30 ثانية).

---

## 📡 ربط الـ EA بالسيرفر

الـ EA يرسل `POST /api/update` مع ترويسة:

```
Authorization: Bearer <AUTH_TOKEN>
Content-Type: application/json
```

محتوى JSON يتضمّن: `bot`, `candles`, `positions`, `stats`, `feed` ... إلخ.
غيّر عنوان السيرفر داخل الـ EA إلى رابط Render بعد النشر.

---

## 🗂️ بنية المشروع

```
W-Forex-Dashboard/
├── server.js            # خادم Express + API + WebSocket-ish polling
├── auth.js              # مصادقة محلية + جلسات + reset tokens
├── google.js            # Google OAuth flow
├── data.json            # الحالة الحية (يُستثنى من Git)
├── users.json           # الحسابات (يُستثنى من Git)
├── resets.json          # توكنات استعادة المرور (يُستثنى من Git)
├── render.yaml          # إعداد النشر على Render
└── public/              # واجهة الويب الثابتة
    ├── index.html       # لوحة التحكم
    ├── login.html       # تسجيل الدخول/الإنشاء
    ├── reset.html       # استعادة كلمة المرور
    ├── app.js · auth.js · reset.js
    └── style.css · auth.css · reset.css
```

---

## 🔒 الأمان

- كلمات المرور مُخزّنة بصيغة **salted SHA-512**.
- الجلسات عبر **signed cookies** (HMAC).
- جميع نقاط النهاية الحساسة محمية بـ `requireAuth`.
- `/api/update` محمي بـ `AUTH_TOKEN`.

---

© W Forex. جميع الحقوق محفوظة.
