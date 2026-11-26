// g-gate — שער השטרות: דף השגרירים (dapim) קורא וכותב רק דרכו, במפתח השירות, ורק עם קוד אישי תקף.
// הקוד נבדק בכל בקשה מול g_shtar_links, והשגריר שבשיחה החדשה נקבע כאן — לא בדף.
// העריכה כמו באפליקציה: פרטי האיש (כרטיס בגיוס · שם · טלפון · הערה) ומחיקתו עם שיחותיו, וכל שיחה קודמת — תוצאה · שגריר · סכום ואמצעי או מועד · סיכום, ומחיקתה.
// הכרטיסים יוצאים עם הכוכב (starred) — איש שמקושר לכרטיס בכוכב: מסגרת זהב, ופתיחה רק ב«יש אישור», כמו באפליקציה.
// כל שגריר רואה רק את האנשים שלו — השגריר של האיש (ambassador), ובלעדיו השגריר שבכרטיס המקושר — ואת שיחותיהם, וכותב רק בהם;
// ושגריר מנהל (`sht_managers` שבהגדרות) — את כולם, ויכול לשייך איש לשגריר.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS = ["https://ygtotlrl-lab.github.io"];
const LOCK_MS = 15 * 60 * 1000;
const STATUSES = ["na", "wrong", "yes", "pl", "int", "cb", "no", "rmv"];
// «תרם» ו«התחייב» — נושאות סכום ואמצעי.
const GIVE = ["yes", "pl"];
// «ממתינים לטיפול» — המצב ⟵ המצבים הבאים; כמו SHT_NEXT באפליקציה. «נסלק» אינה תוצאה — רק הסימון «טופל» על שיחת «תרם».
const NEXT: Record<string, string[]> = { int: ["pl", "yes"], pl: ["yes"] };
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "content-type, authorization, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function out(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}
function str(v: unknown, max: number) { return typeof v === "string" && v.length > 0 && v.length <= max ? v : null; }

async function all(table: string, cols: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).eq("deleted", false).order("client_id").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as Record<string, unknown>[]));
    if (!data || data.length < 1000) return rows;
  }
}

// הקוד ⟵ השגריר; קישור שנמחק או שגריר שהוסר מהרשימה — אין כניסה.
async function ambOf(code: string) {
  const { data: l } = await sb.from("g_shtar_links").select("ambassador_client_id").eq("code", code).eq("deleted", false).maybeSingle();
  if (!l) return null;
  const { data: a } = await sb.from("g_lookups").select("label").eq("client_id", l.ambassador_client_id).eq("kind", "ambassador").eq("deleted", false).maybeSingle();
  return a ? String(a.label) : null;
}
// שגריר מנהל — הגדרה פנימית באפליקציה (`sht_managers`, רשימת שגרירים), ולא התפקיד במשתמשי Google.
async function isAdmin(amb: string) {
  const { data: s } = await sb.from("g_settings").select("value").eq("key", "sht_managers").maybeSingle();
  try { const v = s ? JSON.parse(String(s.value)) : []; return Array.isArray(v) && v.includes(amb); } catch { return false; }
}
// השגריר של האיש — מה שנקבע לו, ובלעדיו השגריר שבכרטיס.
function ambOfPerson(p: Record<string, unknown>, donorAmb: Record<string, string>) {
  return String(p.ambassador || (p.donor_client_id ? donorAmb[p.donor_client_id as string] || "" : ""));
}
// מה שהשגריר רואה — null: הכל (מנהל); ואחרת קבוצת המזהים של האנשים שלו.
async function visible(amb: string, admin: boolean) {
  if (admin) return null;
  const people = await all("g_shtar_people", "client_id,donor_client_id,ambassador");
  const donors = await all("g_donors", "client_id,ambassador");
  const da: Record<string, string> = {};
  donors.forEach((d) => { da[d.client_id as string] = String(d.ambassador || ""); });
  return new Set(people.filter((p) => ambOfPerson(p, da) === amb).map((p) => p.client_id as string));
}
async function callPerson(id: string) {
  const { data } = await sb.from("g_shtar_calls").select("person_client_id").eq("client_id", id).maybeSingle();
  return data ? String(data.person_client_id) : null;
}
async function labels(kind: string) {
  const { data } = await sb.from("g_lookups").select("label,sort").eq("kind", kind).eq("deleted", false).order("sort");
  return (data || []).map((x) => String(x.label));
}

// חותמת השינוי — האפליקציה בודקת אותה כל כמה שניות ומושכת כשהתקדמה.
async function touch() {
  const t = Date.now();
  await sb.from("g_settings").upsert({ key: "last_changed", value: JSON.stringify(t), updated_at: t }, { onConflict: "key" });
}
// מחיקה רכה — ארבעת השדות ברגע אחד, כמו במחיקה מהאפליקציה.
function tomb(dev: string) {
  const t = Date.now();
  return { deleted: true, updated_at: t, deleted_at: new Date(t).toISOString(), deleted_by: dev };
}

const CALL_COLS = "client_id,person_client_id,call_at,ambassador,status,amount,method,callback_at,note,handled";
const PEOPLE_COLS = "client_id,donor_client_id,name,phone,db_name,wa_groups,sources,tried,past,note,ambassador";

// פרטי השיחה מהבקשה — תוצאה, ולפיה סכום ואמצעי או מועד לחזור, וסיכום.
function callFields(c: Record<string, unknown>) {
  const status = str(c.status, 10);
  if (!status || !STATUSES.includes(status)) return { why: "args" };
  const amount = c.amount == null || c.amount === "" ? null : Number(c.amount);
  if (amount != null && !(amount > 0 && amount < 1e10)) return { why: "amount" };
  const cb = c.callback_at ? new Date(String(c.callback_at)) : null;
  if (cb && isNaN(cb.getTime())) return { why: "when" };
  return { row: {
    status, amount: GIVE.includes(status) ? amount : null, method: GIVE.includes(status) ? str(c.method, 60) : null,
    callback_at: status === "cb" && cb ? cb.toISOString() : null, note: str(c.note, 4000), updated_at: Date.now(),
  } as Record<string, unknown> };
}

async function personOut(id: string) {
  const { data: p } = await sb.from("g_shtar_people").select(PEOPLE_COLS).eq("client_id", id).maybeSingle();
  if (!p) return p;
  let da = "";
  if (p.donor_client_id) {
    const { data: d } = await sb.from("g_donors").select("name,ambassador").eq("client_id", p.donor_client_id).maybeSingle();
    if (d) { p.name = d.name; da = String(d.ambassador || ""); }
  }
  (p as Record<string, unknown>).amb = String(p.ambassador || da);
  return p;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return out(req, { ok: false, why: "method" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return out(req, { ok: false, why: "body" }, 400); }
  const code = str(b.code, 80);
  if (!code) return out(req, { ok: false, why: "code" }, 403);
  try {
    const amb = await ambOf(code);
    if (!amb) return out(req, { ok: false, why: "code" }, 403);
    const a = b.a;
    const dev = str(b.dev, 80) || "page";
    const admin = await isAdmin(amb);
    const vis = await visible(amb, admin);
    const sees = (pid: string | null) => !!pid && (!vis || vis.has(pid));
    const deny = () => out(req, { ok: false, why: "owner" }, 403);

    if (a === "load" || a === "calls") {
      const calls = (await all("g_shtar_calls", CALL_COLS)).filter((c) => sees(c.person_client_id as string));
      if (a === "calls") return out(req, { ok: true, calls });
      const people = (await all("g_shtar_people", PEOPLE_COLS)).filter((p) => sees(p.client_id as string));
      const donors = await all("g_donors", "client_id,name,phone,starred,ambassador");
      const names: Record<string, string> = {}, da: Record<string, string> = {};
      donors.forEach((d) => { names[d.client_id as string] = d.name as string; da[d.client_id as string] = String(d.ambassador || ""); });
      people.forEach((p) => {
        p.amb = ambOfPerson(p, da);
        if (p.donor_client_id && names[p.donor_client_id as string]) p.name = names[p.donor_client_id as string];
      });
      return out(req, { ok: true, amb, admin, people, calls, donors, methods: await labels("method"), ambs: await labels("ambassador") });
    }

    if (a === "open" || a === "beat" || a === "release") {
      const person = str(b.person, 80);
      if (!person || !str(b.dev, 80)) return out(req, { ok: false, why: "args" }, 400);
      if (!sees(person)) return deny();
      const { data: r } = await sb.from("g_shtar_locks").select("client_id,device,updated_at").eq("person_client_id", person).maybeSingle();
      const mine = !!r && r.device === dev, now = Date.now();
      if (a === "open") {
        if (r && r.device && !mine && now - Number(r.updated_at) < LOCK_MS) return out(req, { ok: false, why: "locked" });
        const { error } = await sb.from("g_shtar_locks").upsert({ client_id: r ? r.client_id : crypto.randomUUID(), person_client_id: person,
          device: dev, ambassador: amb, updated_at: now, deleted: false }, { onConflict: "client_id" });
        if (error) throw error;
        return out(req, { ok: true });
      }
      if (mine) await sb.from("g_shtar_locks").update({ device: a === "release" ? null : dev, updated_at: now }).eq("client_id", r!.client_id);
      return out(req, { ok: true });
    }

    // השיחה שבטופס — חדשה, או תיקון של אותה שיחה באותה פתיחה.
    if (a === "call") {
      const c = (b.call || {}) as Record<string, unknown>;
      const id = str(c.client_id, 80), person = str(c.person_client_id, 80);
      const f = callFields(c);
      if (!id || !person || !f.row) return out(req, { ok: false, why: f.why || "args" }, 400);
      if (!sees(person)) return deny();
      const { data: cur } = await sb.from("g_shtar_calls").select("client_id,ambassador,person_client_id,deleted").eq("client_id", id).maybeSingle();
      if (cur) {
        if (cur.deleted || cur.ambassador !== amb || cur.person_client_id !== person) return out(req, { ok: false, why: "owner" }, 403);
        const { error } = await sb.from("g_shtar_calls").update(f.row).eq("client_id", id);
        if (error) throw error;
      } else {
        const { data: p } = await sb.from("g_shtar_people").select("client_id").eq("client_id", person).eq("deleted", false).maybeSingle();
        if (!p) return out(req, { ok: false, why: "person" }, 400);
        const { error } = await sb.from("g_shtar_calls").insert({ ...f.row, client_id: id, person_client_id: person, ambassador: amb,
          call_at: new Date().toISOString(), handled: false, deleted: false });
        if (error) throw error;
      }
      await touch();
      const { data: saved } = await sb.from("g_shtar_calls").select(CALL_COLS).eq("client_id", id).maybeSingle();
      return out(req, { ok: true, call: saved });
    }

    // עריכת שיחה קודמת — כל שיחה, כמו באפליקציה; השגריר — מרשימת השגרירים, או זה שכבר רשום בה.
    if (a === "call_edit") {
      const c = (b.call || {}) as Record<string, unknown>;
      const id = str(c.client_id, 80), who = str(c.ambassador, 200), f = callFields(c);
      if (!id || !who || !f.row) return out(req, { ok: false, why: f.why || "args" }, 400);
      if (!sees(await callPerson(id))) return deny();
      const { data: cur } = await sb.from("g_shtar_calls").select("ambassador,deleted").eq("client_id", id).maybeSingle();
      if (!cur || cur.deleted) return out(req, { ok: false, why: "gone" }, 404);
      if (who !== cur.ambassador && !(await labels("ambassador")).includes(who)) return out(req, { ok: false, why: "amb" }, 400);
      const { error } = await sb.from("g_shtar_calls").update({ ...f.row, ambassador: who }).eq("client_id", id);
      if (error) throw error;
      await touch();
      const { data: saved } = await sb.from("g_shtar_calls").select(CALL_COLS).eq("client_id", id).maybeSingle();
      return out(req, { ok: true, call: saved });
    }
    if (a === "call_del") {
      const id = str(b.id, 80);
      if (!id) return out(req, { ok: false, why: "args" }, 400);
      if (!sees(await callPerson(id))) return deny();
      const { error } = await sb.from("g_shtar_calls").update(tomb(dev)).eq("client_id", id).eq("deleted", false);
      if (error) throw error;
      await touch();
      return out(req, { ok: true });
    }

    // עריכת פרטי האיש — כרטיס בגיוס (והשם ממנו), או שם; טלפון חובה; הערה.
    if (a === "person") {
      const id = str(b.id, 80), donor = b.donor ? str(b.donor, 80) : null;
      const phone = (str(b.phone, 40) || "").replace(/[\s-]/g, "");
      if (!id || !/\d/.test(phone)) return out(req, { ok: false, why: "phone" }, 400);
      if (!sees(id)) return deny();
      const { data: p } = await sb.from("g_shtar_people").select("deleted").eq("client_id", id).maybeSingle();
      if (!p || p.deleted) return out(req, { ok: false, why: "gone" }, 404);
      if (donor) {
        const { data: d } = await sb.from("g_donors").select("client_id").eq("client_id", donor).eq("deleted", false).maybeSingle();
        if (!d) return out(req, { ok: false, why: "donor" }, 400);
      }
      const row: Record<string, unknown> = { donor_client_id: donor, name: donor ? null : str(String(b.name || "").trim(), 200),
        phone, note: str(String(b.note || "").trim(), 4000), updated_at: Date.now() };
      // השגריר של האיש — רק מנהל משייך; ריק — השגריר שבכרטיס.
      if (admin && "amb" in b) {
        const who = b.amb ? str(b.amb, 200) : null;
        if (who && !(await labels("ambassador")).includes(who)) return out(req, { ok: false, why: "amb" }, 400);
        row.ambassador = who;
      }
      const { error } = await sb.from("g_shtar_people").update(row).eq("client_id", id);
      if (error) throw error;
      await touch();
      return out(req, { ok: true, person: await personOut(id) });
    }
    // מחיקת האיש — ושיחותיו איתו, באותו רגע.
    if (a === "person_del") {
      const id = str(b.id, 80);
      if (!id) return out(req, { ok: false, why: "args" }, 400);
      if (!sees(id)) return deny();
      const t = tomb(dev);
      const { error } = await sb.from("g_shtar_people").update(t).eq("client_id", id).eq("deleted", false);
      if (error) throw error;
      const { error: e2 } = await sb.from("g_shtar_calls").update(t).eq("person_client_id", id).eq("deleted", false);
      if (e2) throw e2;
      await sb.from("g_shtar_locks").update({ device: null, updated_at: t.updated_at }).eq("person_client_id", id);
      await touch();
      return out(req, { ok: true });
    }

    // «נסלק» — הסימון «טופל» על שיחת «תרם», בלי שיחה חדשה.
    if (a === "cleared") {
      const id = str(b.id, 80);
      if (!id) return out(req, { ok: false, why: "args" }, 400);
      if (!sees(await callPerson(id))) return deny();
      const { data: cur } = await sb.from("g_shtar_calls").select("status,handled,deleted").eq("client_id", id).maybeSingle();
      if (!cur || cur.deleted || cur.handled || cur.status !== "yes") return out(req, { ok: false, why: "state" }, 409);
      const { error } = await sb.from("g_shtar_calls").update({ handled: true, updated_at: Date.now() }).eq("client_id", id);
      if (error) throw error;
      await touch();
      const { data: rows } = await sb.from("g_shtar_calls").select(CALL_COLS).eq("client_id", id);
      return out(req, { ok: true, calls: rows });
    }
    // המעבר לשלב הבא — שיחה חדשה ביום הלחיצה, בשגריר של הקישור, והקודמת מסומנת «טופל».
    if (a === "next") {
      const from = str(b.from, 80), to = str(b.to, 10), id = str(b.id, 80);
      if (!from || !to || !id) return out(req, { ok: false, why: "args" }, 400);
      const { data: cur } = await sb.from("g_shtar_calls").select("person_client_id,status,handled,deleted").eq("client_id", from).maybeSingle();
      if (!cur || cur.deleted || cur.handled || !(NEXT[cur.status] || []).includes(to)) return out(req, { ok: false, why: "state" }, 409);
      if (!sees(cur.person_client_id as string)) return deny();
      const f = callFields({ status: to, amount: b.amount, method: b.method });
      if (!f.row) return out(req, { ok: false, why: f.why }, 400);
      const { error } = await sb.from("g_shtar_calls").insert({ ...f.row, client_id: id, person_client_id: cur.person_client_id, ambassador: amb,
        call_at: new Date().toISOString(), handled: false, deleted: false });
      if (error) throw error;
      const { error: e2 } = await sb.from("g_shtar_calls").update({ handled: true, updated_at: Date.now() }).eq("client_id", from);
      if (e2) throw e2;
      await touch();
      const { data: rows } = await sb.from("g_shtar_calls").select(CALL_COLS).in("client_id", [from, id]);
      return out(req, { ok: true, calls: rows });
    }

    return out(req, { ok: false, why: "action" }, 400);
  } catch (e) {
    console.error("[g-gate]", e);
    return out(req, { ok: false, why: "server" }, 500);
  }
});
