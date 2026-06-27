# 🚀 دليل النشر على Render — W Forex

## خطوات النشر (5 دقائق)

### 1️⃣ سجّل دخول Render
- اذهب إلى **https://render.com**
- سجّل بحساب **GitHub** (`ahmadkhldi000-ai`)

### 2️⃣ أنشئ المشروع (Blueprint)
1. بعد تسجيل الدخول → **Dashboard**
2. اضغط **New** → **Blueprint**
3. اختر **w-forex-dashboard** repository
4. Render سيقرأ `render.yaml` تلقائياً
5. اضغط **Apply**

### 3️⃣ عدّل المتغيرات
في Render Dashboard للخدمة `w-forex-vip-dashboard`:

| المتغير | القيمة | ملاحظة |
|---------|--------|--------|
| `AUTH_TOKEN` | أي قيمة قوية | للتواصل مع الـ EA |
| `TELEGRAM_TOKEN` | توكن البوت | اختياري |
| `TELEGRAM_CHAT` | معرّف القناة | اختياري |
| `OWNER_EMAIL` | بريدك | اختياري |
| `SIM_MODE` | `on` | وضع العرض التوضيحي |

### 4️⃣ احصل على الرابط
بعد البناء (دقيقتين)، Render سيعطيك رابط مثل:
```
https://w-forex-vip-dashboard.onrender.com
```

### 5️⃣ تأكد من العمل
```bash
curl https://w-forex-vip-dashboard.onrender.com/api/health
```

---

## 🔧 تحديثات مستقبلية
كل دفعة (push) إلى `main` ستعيد النشر تلقائياً.
