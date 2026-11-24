// app/state.js — המצב המשותף בין המודולים
import { ASSIGNEES } from './constants.js';

// מצב שמודולים שונים כותבים — אובייקט אחד, כי קישור מיובא אינו ניתן להשמה.
const S = {
  sb: null,
  _pulling: false,
  _netWarned: false,
  _lastPullOk: 0,
  _gSeenTs: 0,
  _lastSeenOk: 0,
  _gPullLogged: false,
  lastViewKey: ''
};

// ── מצב האפליקציה ──
// state הוא תצוגה ולא מקור אמת — applyMirrorToState היא הדרך היחידה למלא את הנתונים בו.
// אין לכתוב ישירות ל-state.donors — כתיבה כזו אינה מגיעה לדיסק ואינה נדחפת, ונעלמת בסנכרון הבא.
// החודשים של היום מותקנים בעלייה — מקורם בתחום, והקובץ הזה אינו מייבא ממנו.
var state = {
  screen: 'dash',
  month: '',
  // תשלומי החודש בלוח — שלושה אחרונים, או כולם אחרי «הצג את כל»; מתאפס בכל מעבר חודש.
  dashPayAll: false,
  planMonth: '',
  planOpen: {},
  donors: [], pledges: [], txns: [], plan: [], tasks: [], targets: [],
  notes: [], loans: [], loanMoves: [], budget: [], events: [],
  shtarPeople: [], shtarCalls: [], shtarLinks: [],
  // שטרות — החיפוש, הסינון, האיש הפתוח, השיחה שנרשמה בפתיחה הזו, סדר «הקודם/הבא» ומספר השורות המוצגות;
  // amb — השגריר המטלפן, נשאר בין איש לאיש.
  sht: { q: '', f: 'queue', open: null, call: null, nav: [], lim: 0, amb: '' },
  // תקציב אירוע — האירוע הפתוח; כל האירועים סגורים בכניסה.
  budgetOpen: null,
  // כרטיסים ותשלומים — בכל כניסה למסך: בלי סינון, ממוין לפי א״ב, ובלי כרטיס פתוח.
  cards: { q: '', aff: '', pf: '', sort: 'sum', open: null, plOpen: null, tlOpen: false },
  // מיון ההלוואות — name · taken · end · status.
  loansQ: '', loansStatus: '', loansSort: '', loansOpen: null, // loansOpen — חלון ההלוואה ('new' — הלוואה חדשה)
  lnWin: '', // החלון שנפתח מהכפתורים: 'chart' (גרף הלוואות) · 'due' (תאריכי פירעון)
  ixOpen: {}, // מדדי הסוגים שבדשבורד — סגורים, ולחיצה פותחת
  // משימות — האחראי שנבחר, והרשימה שנפתחה (שלב), או null לשלושת הכרטיסים.
  tasks_ui: { who: ASSIGNEES[0], stage: null, q: '' }
};

// ── מה שמסך צריך מ-main ──
// main רושם כאן בעלייה — מודול שמייבא מ-main סוגר מעגל, והרישום הוא הכיוון האחד.
const shell = { render: null };

export { S, shell, state };
