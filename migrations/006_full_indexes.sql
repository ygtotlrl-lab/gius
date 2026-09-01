-- ============================================================================
-- 006_full_indexes.sql — החלפת שלושת האינדקסים החלקיים באינדקסים מלאים
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.
--
-- שלושה אינדקסים חלקיים שרדו מ-`0001_init.sql`. נבדקו מול המסד
-- (`pg_indexes` + `pg_index.indisunique`, ולא לפי שם):
--
--   g_pledges_donor_idx  ON g_pledges (donor_id)  WHERE deleted = false
--   g_txns_donor_idx     ON g_txns    (donor_id)  WHERE deleted = false
--   g_txns_pledge_idx    ON g_txns    (pledge_id) WHERE deleted = false
--
-- ⚠️ **תיקון עובדתי, וחשוב שיהיה כתוב:** שלושתם **אינם ייחודיים ואינם יעד
--    של `ON CONFLICT`** (`indisunique = false` בשלושתם), ולכן הם **אינם**
-- גורמים ל-42P10 שתואר ב-schar-limud. מה שכן: המשיכה מביאה
--    גם רשומות מחוקות והסינון עבר ל-`liveRows()` בצד הלקוח — כלומר אף
--    שאילתה כבר אינה חוזרת על התנאי `deleted = false`, ואינדקס חלקי שאין
--    שאילתה שתואמת את התנאי שלו אינו משמש את המתכנן כלל.
--
-- ⛔ הסדר הוא יצירה ואז מחיקה, ולא להפך — שלא ייווצר רגע שבו
--    הטבלה בלי אינדקס על עמודת המפתח הזר.
-- ⛔ אין נגיעה בנתונים, ואין כאן טבלה חדשה — ולכן אין `revoke`/`grant`
-- (0002 כבר צמצם את שבע הטבלאות, ואומת).
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists g_pledges_donor_full_idx on public.g_pledges (donor_id);
drop index if exists public.g_pledges_donor_idx;

create index if not exists g_txns_donor_full_idx on public.g_txns (donor_id);
drop index if exists public.g_txns_donor_idx;

create index if not exists g_txns_pledge_full_idx on public.g_txns (pledge_id);
drop index if exists public.g_txns_pledge_idx;

-- ---------- אימות ----------
-- select indexname, indexdef from pg_indexes
--  where schemaname='public' and indexdef ilike '%where%';
-- מצופה: אפס שורות.
