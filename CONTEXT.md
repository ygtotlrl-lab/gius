# גיוס — קונטקסט פיתוח

## פרטי ריפו
- **ריפו:** `ygtotlrl-lab/gius`
- **GitHub Pages:** `https://ygtotlrl-lab.github.io/gius/`
- **טוקן:** מנוהל ב-Windows Credential Manager (host `github.com`) — לעולם לא בקובץ
- **קובץ ראשי:** `index.html`
- **Supabase:** project `zrftjkghhjhqzopvdzou` (⚠️ **ייעודי**, לא הפרויקט המשותף
  של שלוש האחיות) | טבלאות `g_*` (ראה למטה)

---

<!-- SHARED:start id="context-grant" -->
## ⚠️ Supabase — GRANT חובה לטבלאות חדשות

כל טבלה חדשה שנוצרת ב-`public` schema חייבת לכלול GRANT מפורש — אחרת supabase-js
לא יוכל לגשת אליה. **⛔ וכאן הסדר הוא `revoke` ואז `grant`, ולא `grant` לבדו:**

```sql
revoke all on public.TABLE_NAME from anon, authenticated;
grant select, insert, update on public.TABLE_NAME to anon, authenticated;
grant all on public.TABLE_NAME to service_role;
alter table public.TABLE_NAME enable row level security;
```
<!-- SHARED:end -->

⚠️ **הסיבה:** `GRANT` הוא **אדיטיבי בלבד ואינו מסיר דבר**, ופרויקט Supabase
סטנדרטי מגיע עם `alter default privileges … grant all on tables` — כלומר
**כל טבלה נולדת עם `DELETE` ו-`TRUNCATE`**. מחיקה בארגון היא תמיד `deleted=true`
(כלל ברזל 6 סעיף 1), ולכן ההרשאות האלה מיותרות בהגדרה ומסוכנות בפועל: מפתח
ה-anon יושב גלוי ב-`index.html` הציבורי. ר' `migrations/0002_revoke_delete.sql`.

מקור האמת המלא לסכימה: `migrations/0001_init.sql` (+`0002`/`0003`/`0004`).

---

## מצב נוכחי
- בית · תורמים · התחייבויות · משימות · הגדרות ✅
- עבודה אופליין מלאה: מראה מקומית, מיזוג ברמת רשומה, tombstones, סימון ⏳ ✅
- כניסה אופליין מרובת-משתמשים מול `pass_salt`+`pass_fp` ✅ (סבב 23)
- גיבוי יומי ויומן פעולות מהמודול המשותף ✅ (סבב 30)
- PWA + באנר עדכון ✅ · מעטפת APK מסוג WebView ב-`android/` ✅

**מצב המיגרציות:** `0001`–`0006` **הורצו ואומתו** — `0004` ב-2026-08-17,
`0005` (משימת ה-`pg_cron`) ו-`0006` (אינדקסים מלאים) ב-2026-08-18. הטבלה
המלאה יושבת ב-CLAUDE.md, פרק «הרצת ה-migration». ⛔ «נכתב» אינו «רץ».

---

⛔ **הקובץ הזה מחזיק לקוח וצורך בלבד** (כלל ברזל 23) — כללי הפיתוח,
הסכימה ופרטי המערכת יושבים ב-[CLAUDE.md](CLAUDE.md), ב-[README.md](README.md)
וב-[android/README.md](android/README.md). ⛔ תיאור שחוזר משם נסחף בשקט.
