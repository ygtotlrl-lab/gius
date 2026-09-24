/* ═══ app.config.js — תצורת האפליקציה ════════════════════════════════════
   ⛔ המקום היחיד של ערכי האפליקציה — ⚠️ הדפדפן טוען אותו בתג, ה-service
      worker ב-`importScripts`, והכלים ב-`tools/gen-app.mjs`: ⭐ ערך שכתוב
      במקום שני הוא שני מקורות שמתיישנים זה מול זה.
   ⛔ קובצי הפלטפורמה נוצרים מכאן — ⚠️ `node tools/gen-app.mjs`, ⭐ ומי שעורך
      אותם ביד נדרס בהרצה הבאה.
   ════════════════════════════════════════════════════════════════════ */
self.APP = Object.freeze({
  /*  ⛔ שם הריפו — ⚠️ ממנו נגזרים ה-scope, קידומת המטמון ושם הפרויקט באנדרואיד. */
  id: 'gius',
  name: 'גיוס',
  shortName: 'גיוס',
  description: 'ניהול תורמים, התחייבויות, תנועות ומשימות גיוס כספים.',
  /*  ⛔ תחילית הטבלאות והאחסון — ⚠️ כל אות בה פותחת מילה בשם הריפו, בסדר. */
  prefix: 'g_',
  colors: { theme: '#0f766e', background: '#f4f6f9' },
  /*  ⚠️ דף האופליין של ה-service worker — ⭐ צבע הרקע והדיו שלו, והסמל. */
  offline: { bg: '#f4f6f9', ink: '#12202e', mark: '📴' },
  /*  ⚠️ המפתח הוא מפתח `anon` ציבורי — ⛔ ולא מפתח שירות: ההרשאות במסד. */
  supabase: {
    url: 'https://zrftjkghhjhqzopvdzou.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyZnRqa2doaGpocXpvcHZkem91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMDc4MzQsImV4cCI6MjEwMDg4MzgzNH0.DWcW3o4Y9Is3jGx1frHkrUz7cc045aH1m1uKsrwRhIA'
  },
  android: {
    package: 'com.gius.app',
    /*  ⛔ הכתובת שהמעטפת טוענת — ⚠️ וממנה נגזר המקור היחיד שגשר השיתוף מקבל. */
    url: 'https://ygtotlrl-lab.github.io/gius/',
    /*  ⚠️ המשפט שלם ⛔ ולא שם בלבד — ⭐ הפועל מתאים למין השם. */
    offlineLine: 'גיוס לא הצליח להתחבר.',
    /*  ⚠️ צבע כפתור הניסיון החוזר בדף האופליין של המעטפת. */
    accent: '#0f766e',
    /*  ⛔ `versionCode` לעולם אינו יורד, ⚠️ ומקודם בכל שינוי תחת `android/` —
        ⭐ בלי קידום המכשיר המותקן אינו מקבל את ה-APK החדש. */
    versionCode: 23,
    versionName: '17.0',
    launcherBg: { kind: 'solid', color: '#0F766E' },
    /*  ⚠️ גשר השיתוף — ⭐ `FileProvider` ו-`androidx`, רק באפליקציה שמייצאת קובץ. */
    share: false
  },
  /*  ⛔ טביעת מפתח החתימה הקבוע — ⚠️ `sign-apk.sh` מסרב לחתום בכל מפתח אחר. */
  signSha256: '30:C3:08:38:6B:2E:19:F6:B2:0C:FF:AE:57:4A:3C:9A:DF:13:63:8C:B6:A6:8F:80:E4:8E:88:9F:1D:00:A9:7A',
  /*  ⛔ נכסי האייקון — ⚠️ `tools/gen-icons.mjs` קורא אותם. */
  icon: {
    /*  ⛔ הצורה מוצהרת, ⛔ ותואמת את סיומת המאסטר — ⚠️ `svg` הוא
        מאסטר גיאומטרי שנקרא ונצבע, ⭐ ו-`master` הוא ציור רסטרי שהוקטן. */
    art: 'svg',
    master: 'design/icon-master.svg',
    /*  ⛔ חמשת השדות ריקים ⛔ ואינם נשמטים — ⚠️ המאסטר הגיאומטרי נושא בעצמו
        את הרקע, את הדיו ואת תיבת הסמל: ⭐ שדה חסר נקרא «לא נשאל», וריק נקרא
        «נמדד ואין». */
    ink: null,
    bg: null,
    mark: null,
    bgKey: null,
    keyTol: null,
  }
});
