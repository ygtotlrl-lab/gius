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

## כללים קריטיים לפיתוח

1. **`node tools/check-js.mjs` לפני כל push** — חובה מוחלטת. השער מחלץ את ה-JS
   המוטבע מ-`index.html`, מריץ `node --check` עליו ועל `sw.js`, ומריץ את כל
   שערי האחידות ואת חבילות בדיקות הסבבים.
2. **קידום `CACHE_NAME` ב-`sw.js`** בכל שינוי קוד — בלי זה העדכון לא מגיע
   למשתמשים (כלל ברזל 9 שברשימת כללי הברזל שב-CLAUDE.md).
3. **מחיקה רכה בלבד** — `deleted`+`deleted_at`; ⛔ אין `DELETE` פיזי בשום מקום.
4. **אין סכומים מחושבים שמורים** — «נגבה»/«נותר»/סטטוס מחושבים בזמן ריצה
   מ-`g_txns`.
5. **`strip: ['password']` על `g_users`** — הסיסמה אינה יורדת לדיסק, בשלוש
   נקודות אכיפה (משיכה · כתיבה מקומית · שער הדיסק).

```bash
node tools/check-js.mjs      # השער — חובה לפני כל push
node tools/gen-icons.mjs     # מחדש את האייקונים (PWA + APK)
```

---

## טבלאות

| טבלה | תפקיד | הערות |
|---|---|---|
| `g_users` | משתמשי המערכת | `role` = `owner`/`manager`, `NOT NULL` בלי DEFAULT · ⛔ מוחרגת מ-`PUSH_TABLES` |
| `g_donors` | תורמים | `agent` = שגריר (טקסט חופשי מול `full_name`) |
| `g_pledges` | התחייבויות | FK ל-`g_donors` ב-RESTRICT |
| `g_txns` | תנועות | FK ל-`g_donors` ול-`g_pledges` (האחרון nullable) |
| `g_tasks` | משימות | קנבן בארבעה שלבים; `log` הוא טקסט מצטבר |
| `g_targets` | יעד חודשי | `month` בפורמט `YYYY-MM`, ייחודי |
| `g_config` | רשימות בחירה | `categories` · `causes` · `domains` (jsonb) |
| `sync_log`, `kv_backup` | יומן וגיבוי | `INSERT`+`SELECT` בלבד — יומני ראיות (`migrations/0004`) |

⚠️ **פרויקט Supabase נפרד:** שלוש האחיות חולקות את `kxbtskqobynewvnckaaz`;
gius יושבת ב-`zrftjkghhjhqzopvdzou`. לכן `kv_backup` ו-`sync_log` נוצרו כאן
מחדש ב-`0004`, **בסכימה זהה בית-לבית** — זה מה שמאפשר למודול הגיבוי המשותף
להיות זהה בארבעתן.

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

## פרטי מערכת
- ⛔ **לעולם לא TWA ולא PWABuilder** — TWA מריץ את האתר בתוך כרום, וסינון התוכן
  במכשירי המשתמשים חוסם את כרום. זה נמדד: ה-TWA הראשון של gius פשוט לא נפתח.
- חתימה: `signing/gius.keystore` (alias `gius`) — ⛔ המפתח הקבוע
- סנכרון: משיכה ← מיזוג ← דחיפת מה שמקומי-וחדש-יותר. ⛔ אין תור יוצא
  (`g_outbox` הוסר בסבב 12 שלב 3 ולא ייבנה מחדש).
- RLS פתוח (`using (true)`) — החלטה מודעת ומתועדת; ההרשאות נאכפות בשכבת
  האפליקציה. ר' כלל ברזל 7 שב-CLAUDE.md.

<!-- SHARED:start id="context-smali-scope" -->
## תיקון URL ב-APK קיים ובנוי (בלי מקור) — smali בלבד

⚠️ **הפרק הזה רלוונטי רק ל-APK ישן שנבנה לפני `android/`.** בנייה רגילה היום
היא מ-`android/` דרך `.github/workflows/build-apk.yml`, והמעטפת טוענת מהרשת —
ולכן אין בה URL שצריך לתקן.
⛔ **smali בלבד — לא binary patch.** עריכה בינארית של ה-APK שוברת את החתימה
ואינה ניתנת לאימות, ⛔ והחתימה מחדש היא במפתח הקבוע של הריפו בלבד — ר' הפרק
«חתימת APK» ב-CLAUDE.md.
<!-- SHARED:end -->

```bash
apktool d <app>.apk -o /tmp/gius_work -f
# תקן את ה-URL ב-MainActivity.smali ו-MainActivity$2.smali
rm -rf /tmp/gius_work/build          # חובה לפני בנייה חוזרת
apktool b /tmp/gius_work -o built.apk
zipalign -f 4 built.apk aligned.apk
apksigner sign --ks signing/gius.keystore --ks-key-alias gius \
  --ks-pass pass:gius123 --key-pass pass:gius123 --out output.apk aligned.apk
```

⚠️ **ה-APK הישן כאן היה TWA** שנבנה ב-PWABuilder, ⛔ ואין לבנות אותו מחדש
(ר' «מעטפת ה-APK» ב-CLAUDE.md). ⭐ וה-keystore הוחלף בסבב 39 — כל חתימה היא
ב-`signing/gius.keystore` בלבד.

<!-- SHARED:start id="context-cache-apk" -->
### ⚠️ Cache APK — כלל זהב

שם קובץ חוזר נתפס במטמון — של הדפדפן, של מנהל ההורדות ושל המכשיר — והמשתמש
מתקין שוב את הבנייה **הקודמת** בלי לדעת. ⛔ **תמיד שם חדש בכל בנייה**, עם
חותמת זמן:
<!-- SHARED:end -->

```bash
TS=$(date +%s) && apksigner sign ... --out gius-${TS}.apk
```

הכללים המחייבים והתיעוד המלא — ב-[CLAUDE.md](CLAUDE.md).
