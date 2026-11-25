# שרת התכנון החכם (AI) של מציק משימות

שרת קטן (Cloudflare Worker) שמקבל תיאור חופשי של היום ומחזיר רשימת משימות מסודרת.
הוא משתמש ב-Claude Opus 5.5 דרך ה-SDK הרשמי של Anthropic, עם פלט מובנה, כך שהאפליקציה תמיד מקבלת JSON תקין.

**למה צריך שרת:** מפתח ה-API לא יכול להיות בתוך האפליקציה, כי כל אחד היה יכול לחלץ אותו ולהשתמש בו על חשבונך.

## מי יכול להשתמש
- **מנויים:** נבדקים מול RevenueCat (`REVENUECAT_SECRET`). מפעילים כשהאפליקציה בחנויות ויש בה מנוי.
- **בודקים:** קוד מתוך `ACCESS_CODES`. כך אפשר לנסות את התכנון כבר עכשיו, בלי חנות.
- כל מי שאינו מנוי או בודק מקבל 402, והאפליקציה מציגה מסך "פרימיום".

## העלאה (פעם אחת)
1. יוצרים מפתח API ב-platform.claude.com, וקובעים שם **הגבלת הוצאה חודשית**.
2. פותחים חשבון חינמי ב-cloudflare.com.
3. מריצים:
   ```bash
   cd task-nagger-server
   npm install
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY    # מדביקים את המפתח
   npx wrangler secret put ACCESS_CODES         # למשל: mycode123
   npx wrangler deploy
   ```
   בסוף מתקבלת כתובת, למשל `https://task-nagger-planner.<שם>.workers.dev`.
4. מכניסים את הכתובת ב-`task-nagger/app.json`, בשדה `extra.plannerUrl`, ודוחפים. GitHub בונה APK חדש.

## עלות
כל תכנון עולה כמה סנטים, לפי האורך. הגבלת ההוצאה ב-Anthropic מגינה עליך מהפתעות.

## בדיקות
`npm test` מריץ את הבדיקות עם תשובה מדומה (לא עולה כסף). `npm run typecheck` בודק טיפוסים.
