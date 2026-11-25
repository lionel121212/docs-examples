# הפעלת תשלום (Google Play + RevenueCat)

הקוד מוכן: מסך תשלום עם מסלול חודשי ושנתי, קנייה, שחזור רכישות, מנוי שמחובר לחשבון, ובדיקה בשרת.
מה שנשאר הוא לפתוח את החשבונות. **החשבונות צריכים להיות על שם מישהו מעל 18 עם חשבון בנק** (אם אתה מתחת ל-18, על שם אחד ההורים).

| צעד | מי | מה מקבלים |
|---|---|---|
| 1. חשבון מפתח ב-Google Play | אתה / הורה | פרסום אפליקציות (25$ חד-פעמי) |
| 2. פרופיל תשלומים | אתה / הורה | הכסף מהמנויים נכנס לבנק |
| 3. מפתח העלאה | אתה (או אני אצור) | חתימה קבועה לאפליקציה |
| 4. העלאה ראשונה לבדיקות פנימיות | אתה | האפליקציה קיימת ב-Play |
| 5. יצירת שני מנויים | אתה | ₪14.90 לחודש ו-₪99 לשנה |
| 6. RevenueCat | אתה | ניהול המנויים, חינם עד 2,500$ הכנסה בחודש |
| 7. שליחת המפתח הציבורי אליי | אתה | אני מחבר ובונה |
| 8. קנייה לבדיקה | אתה | בודק שהכול עובד, בלי לשלם |

## 1. חשבון מפתח
play.google.com/console → יצירת חשבון (Personal), תשלום 25$ ואימות זהות.

## 2. פרופיל תשלומים
ב-Play Console: **Settings → Payments profile**. ממלאים פרטים ומחברים חשבון בנק.

## 3. מפתח העלאה (Upload key)
זה קובץ שחותם את האפליקציה. **אסור לאבד אותו, ואסור לשים אותו בריפו.**
```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks > upload.b64
```
ב-GitHub: **Settings → Secrets and variables → Actions → New repository secret**, ומוסיפים:
- `ANDROID_UPLOAD_KEYSTORE_B64`: התוכן של `upload.b64`
- `ANDROID_UPLOAD_STORE_PASSWORD`: הסיסמה שבחרת
- `ANDROID_UPLOAD_KEY_ALIAS`: `upload`
- `ANDROID_UPLOAD_KEY_PASSWORD`: הסיסמה של המפתח (בדרך כלל אותה סיסמה)

מהבנייה הבאה, GitHub יבנה גם קובץ `task-nagger-play-aab` (ב-Actions, תחת Artifacts, לא פומבי).

## 4. העלאה ראשונה
Play Console → **Create app** → שם: מציק משימות. אחר כך **Testing → Internal testing → Create release**, מעלים את ה-AAB ומוסיפים את האימייל שלך כבודק.
(Google יבקשו גם מדיניות פרטיות, דירוג גיל ותיאור לחנות. את אלה אני מכין כשנגיע לשלב הזה.)

## 5. המנויים
**Monetize → Subscriptions → Create subscription**:
- `premium_monthly`: Base plan חודשי, auto-renewing, ‏₪14.90
- `premium_yearly`: Base plan שנתי, auto-renewing, ‏₪99

לוחצים **Activate** על שניהם. Google ממירים אוטומטית למחירים במדינות אחרות.

## 6. RevenueCat (app.revenuecat.com)
1. יוצרים Project, ואחריו **Add app → Play Store**, עם ה-package ‏`com.tasknagger.app`.
2. מחברים את Google לפי ההוראות של RevenueCat (Service account credentials).
3. **Products**: מייבאים את `premium_monthly` ואת `premium_yearly`.
4. **Entitlements**: יוצרים `premium` ומצרפים אליו את שני המוצרים.
5. **Offerings**: ה-offering ‏`default` (Current), עם החבילות Monthly ‏→ `premium_monthly` ו-Annual ‏→ `premium_yearly`.

## 7. מפתחות
- **Public SDK key** (מתחיל ב-`goog_`): **שלח לי.** הוא ציבורי, ואני אכניס אותו ל-`app.json`.
- **Secret API key** (מתחיל ב-`sk_`): **לא בצ'אט.** מכניסים לשרת:
  `npx wrangler secret put REVENUECAT_SECRET`

## 8. בדיקה בלי לשלם
Play Console → **Settings → License testing**, ומוסיפים את האימייל שלך. מתקינים מקישור הבדיקות הפנימיות וקונים: Google מסמנים את זה כקניית בדיקה ולא מחייבים.
