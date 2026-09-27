// app.config.js — תצורת האפליקציה
self.APP = Object.freeze({
  // ממנו נגזרים ה-scope, קידומת המטמון ושם הפרויקט באנדרואיד
  id: 'gius',
  name: 'גיוס',
  shortName: 'גיוס',
  description: 'ניהול תורמים, התחייבויות, תנועות ומשימות גיוס כספים.',
  prefix: 'g_',
  colors: { theme: '#0f766e', background: '#f4f6f9' },
  // דף האופליין של ה-service worker — הכהה לפי אסימוני הערכה הכהה של האפליקציה
  offline: { light: { bg: '#f4f6f9', ink: '#12202e' }, dark: { bg: '#0d151d', ink: '#e8eef5' }, mark: '📴' },
  // מפתח anon ציבורי ולא מפתח שירות — ההרשאות נאכפות במסד.
  supabase: {
    url: 'https://zrftjkghhjhqzopvdzou.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyZnRqa2doaGpocXpvcHZkem91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMDc4MzQsImV4cCI6MjEwMDg4MzgzNH0.DWcW3o4Y9Is3jGx1frHkrUz7cc045aH1m1uKsrwRhIA'
  },
  android: {
    package: 'com.gius.app',
    // ממנה נגזר המקור היחיד שגשר השיתוף מקבל
    url: 'https://ygtotlrl-lab.github.io/gius/',
    // משפט שלם ולא שם בלבד — הפועל מתאים למין השם
    offlineLine: 'גיוס לא הצליח להתחבר.',
    // צבע כפתור הניסיון החוזר בדף האופליין של המעטפת
    accent: '#0f766e',
    // לעולם אינו יורד — בלי קידום המכשיר המותקן אינו מקבל את ה-APK החדש.
    versionCode: 26,
    versionName: '17.0',
    launcherBg: { kind: 'solid', color: '#0F766E' },
    // FileProvider ו-androidx — רק באפליקציה שמייצאת קובץ
    share: false
  },
  // sign-apk.sh מסרב לחתום בכל מפתח אחר
  signSha256: '30:C3:08:38:6B:2E:19:F6:B2:0C:FF:AE:57:4A:3C:9A:DF:13:63:8C:B6:A6:8F:80:E4:8E:88:9F:1D:00:A9:7A',
  icon: {
    // svg הוא מאסטר גיאומטרי שנקרא ונצבע, ו-master רסטרי הוא ציור שהוקטן — ותואם את סיומת המאסטר.
    art: 'svg',
    master: 'design/icon-master.svg',
    // ריקים ולא נשמטים — המאסטר הגיאומטרי נושא בעצמו את הרקע, הדיו ותיבת הסמל; שדה חסר נקרא לא נשאל.
    ink: null,
    bg: null,
    mark: null,
    bgKey: null,
    keyTol: null,
  }
});
