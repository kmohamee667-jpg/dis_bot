# 📊 Leaderboard - Canvas Only (Timer Style Match)

**تم تحسين الليدربورد ليطابق تصميم التايمر بالضبط!**

## 🎯 الميزات الجديدة:
- ✅ **Canvas Only** - بدون Puppeteer/HTML (أسرع + أخف)
- ✅ **تصميم مطابق للتايمر** - قائمة وردية 3 أعمدة + دائرة رئيسية
- ✅ **حجم ثابت 1200x700** - نفس التايمر
- ✅ **الهايلايت + الأيقونات** - 👑🥈🥉 مع أفاتار + وقت

## 📁 تم حذف:
```
❌ utils/leaderboardRenderer.js
❌ public/leaderboard.html  
❌ public/leaderboard.css
```

## 💻 الاستخدام:
```js
const leaderboardBuffer = await drawLeaderboard(topUsers, guildMembers, guildId, user.id, theme);
```

## ✅ جاهز للاختبار:
1. `node index.js`
2. `/start study_time:25 break_time:5 cycles:2`
3. أكمل الدورات → شوف الليدربورد المتطابق! 🔥

## 🚀 الميزات

- ✅ **تصميم احترافي بـ HTML/CSS** - سهل التعديل والتخصيص
- ✅ **Puppeteer Screenshot** - تحويل الصفحة إلى صورة عالية الجودة
- ✅ **Fallback إلى Canvas** - في حالة عدم توفر Puppeteer
- ✅ **Performance محسّن** - إعادة استخدام متصفح واحد

## 📦 التثبيت

### 1. تثبيت Puppeteer (اختياري لكن موصى به)

```bash
npm install puppeteer
```

أو باستخدام yarn:
```bash
yarn add puppeteer
```

### 2. في حالة المشاكل مع Puppeteer

إذا واجهت مشاكل في التثبيت أو الحجم الكبير، يمكنك تثبيت نسخة أخف:

```bash
npm install puppeteer-core
```

## 📁 الملفات الجديدة

```
├── utils/
│   └── leaderboardRenderer.js    ← محرك Puppeteer الجديد
│
└── public/
    ├── leaderboard.html           ← قالب HTML
    └── leaderboard.css            ← أنماط CSS
```

## 💻 طريقة الاستخدام

### في `start.js`:

```javascript
const leaderboardBuffer = await drawLeaderboard(
    topUsers, 
    guildMembers, 
    interaction.guildId, 
    interaction.user.id,  // للهايلايت
    theme  // بيانات الثيم (اختياري)
);
```

## 🎨 التخصيص

### لتعديل التصميم:

1. عدّل `public/leaderboard.css` - كل التصميم هناك
2. عدّل `public/leaderboard.html` - الهيكل
3. أعد تشغيل البوت - سيتم استخدام التصميم الجديد مباشرة

### مثال: تغيير الألوان

في `leaderboard.css`:

```css
.title {
    color: #FFD700;  ← غيّر هنا
}

.podium-item.center .avatar {
    background: rgba(255, 215, 0, 0.4);  ← أو هنا
}
```

## ⚙️ كيفية يعمل؟

1. **البيانات** → `topUsers` و `guildMembers`
2. **إنشاء HTML** → يتم ملء البيانات في قالب HTML
3. **Screenshot** → Puppeteer يأخذ صورة عالية الدقة
4. **إرسال للـ Discord** → الصورة تُرسل مباشرة

## ⚠️ Fallback (في حالة عدم توفر Puppeteer)

إذا لم تثبت Puppeteer، سيتم استخدام Canvas (الطريقة القديمة) تلقائياً:

```
renderLeaderboardScreenshot() → فشل → drawLeaderboardCanvas() ✅
```

## 🔧 حل المشاكل الشائعة

### مشكلة: "Module puppeteer not found"
**الحل:** ثبّت Puppeteer:
```bash
npm install puppeteer
```

### مشكلة: الصور لا تظهر في الليدربورد
**الحل:** تأكد من أن `guildMembers` يحتوي على الصور (Avatars)

### مشكلة: البرنامج بطيء
**الحل:** Puppeteer يستخدم متصفح واحد مُعاد (محسّن)

## 🔄 التحديثات المستقبلية

- إضافة Themes CSS مختلفة
- تصدير PDF بدل PNG
- Caching للصور المكررة

---

**ملاحظة مهمة:** إذا أضفت Puppeteer لاحقاً بعد تشغيل البوت، أعد تشغيل البوت لاستخدام النسخة الجديدة.
