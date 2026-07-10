# تطبيق الجوال (Android/iOS) عبر Capacitor

يغلّف Capacitor **نفس تطبيق الويب** (React) في تطبيق أصلي — للتجربة على هاتفك
(APK) ثم النشر في المتجر. لا إعادة كتابة، ونفس الكود يخدم الويب والجوال.

**تطبيقان منفصلان من نفس الكود** (يُثبَّتان جنباً إلى جنب، ومربوطان بنفس قاعدة البيانات):

| التطبيق | المعرّف | الاسم | الأيقونة | هدف البناء |
|---|---|---|---|---|
| العميل | `sd.qareeb.app` | قريب | خضراء · دبوس أبيض | `VITE_APP=customer` |
| السائق | `sd.qareeb.captain` | كابتن قريب | صفراء · دبوس أخضر | `VITE_APP=driver` |

- كل تطبيق يحمل **كوده فقط** (`VITE_APP` يستبعد كود الآخر) فيكون التحميل أصغر.
- الفصل الأصلي عبر **product flavors** في `android/app/build.gradle` (customer / driver).
- الإعداد في `capacitor.config.ts`، ومشروع أندرويد في `android/`.

---

## المتطلّبات (على حاسوبك — لا يُبنى على الهاتف مباشرة)
- **Node** (لبناء الويب) + **JDK 17** + **Android Studio** (أو Android SDK + Gradle).
- أول مرة: افتح Android Studio مرّة ليُنزّل الـ SDK.

## 1) املأ مفاتيح البيئة (مهم جداً)
مفاتيح `VITE_*` تُدمَج وقت البناء داخل التطبيق. أنشئ `.env`:
```
cp .env.example .env    # ثم املأ القيم الحقيقية
```
بدونها يعمل التطبيق في **وضع المعاينة** (بيانات وهمية).

> **خرائط قوقل:** إن قيّدت المفتاح بنطاق الويب فقط، لن تظهر الخريطة داخل التطبيق.
> للتجربة استخدم مفتاحاً غير مقيّد، أو أضِف قيود «تطبيقات Android» (بصمة SHA‑1 + `sd.qareeb.app`).

## 2) بناء APK للتجربة (تطبيقان)
```
npm run apk:customer   # قريب (العميل)
npm run apk:driver     # كابتن قريب (السائق)
```
يُنتجان:
- `android/app/build/outputs/apk/customer/debug/app-customer-debug.apk`
- `android/app/build/outputs/apk/driver/debug/app-driver-debug.apk`

التثبيت على الهاتف (يعملان معاً — معرّفان مختلفان):
```
adb install -r -d android/app/build/outputs/apk/customer/debug/app-customer-debug.apk
adb install -r -d android/app/build/outputs/apk/driver/debug/app-driver-debug.apk
```

## 3) تطوير حيّ على الهاتف (اختياري — الأسرع للتجربة)
1. في `capacitor.config.ts` فكّ تعليق `server.url` وضع **IP حاسوبك على الشبكة** (مثل `http://192.168.1.10:5173`).
2. شغّل `npm run dev` على الحاسوب.
3. ابنِ التطبيق مرّة وشغّله على الهاتف — يتحدّث فوراً مع كل تعديل دون إعادة بناء.
4. أعِد تعليق `server.url` قبل بناء نسخة الإنتاج.

## 4) بعد أي تعديل على الكود
أعد بناء التطبيق المتأثّر (`apk:customer` و/أو `apk:driver` من الخطوة 2).

## 5) النشر في متجر Play (لاحقاً)
- أنشئ keystore للتوقيع، ثم ابنِ حزمة AAB **لكل تطبيق على حدة**:
  ```
  cross-env VITE_APP=customer npm run build && npx cap sync android && cd android && ./gradlew bundleCustomerRelease
  cross-env VITE_APP=driver   npm run build && npx cap sync android && cd android && ./gradlew bundleDriverRelease
  ```
  يُنتجان AABين موقّعين لرفعهما كإدراجين منفصلين على Play Console (بعد ضبط التوقيع في `android/app/build.gradle`).
- **iOS:** يتطلّب جهاز Mac + Xcode: `npm i @capacitor/ios && npx cap add ios && npx cap open ios`.

---

## تحسينات أصلية لاحقة (تعمل الآن لكنها أفضل أصلياً)
- **الإشعارات:** الويب Push عبر Service Worker لا يعمل داخل WebView الأصلي —
  للإشعارات الأصلية استخدم FCM عبر `@capacitor/push-notifications` (خطوة لاحقة).
- **الموقع:** `navigator.geolocation` يعمل داخل WebView بعد منح إذن الموقع؛
  للحصول على تجربة أمتن أضِف `@capacitor/geolocation`. صلاحيات الموقع مضبوطة في `AndroidManifest.xml`.
- **شاشة البداية/الحالة:** `@capacitor/splash-screen` و`@capacitor/status-bar` لللمسات النهائية.
