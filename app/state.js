// app/state.js — המצב המשותף בין המודולים

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
// state הוא תצוגה ולא מקור אמת — applyMirrorToState היא הדרך היחידה למלא אותו.
// אין לכתוב ישירות ל-state.donors — כתיבה כזו אינה מגיעה לדיסק ואינה נדחפת, ונעלמת בסנכרון הבא.
// החודש של היום מותקן בעלייה — מקורו בתחום, והקובץ הזה אינו מייבא ממנו.
var state = {
  screen: 'home',
  month: '',
  config: { categories: [], causes: [], domains: [] },
  donors: [], pledges: [], txns: [], tasks: [], targets: [],
  donorId: null,
  donorSearch: '',
  pf: { agent: '', status: '', cause: '', from: '', to: '' }
};

// גרירה על אירועי מצביע — dragstart, dragover ו-drop אינם נורים במגע.
// הגרירה מתחילה מהידית בלבד — כרטיס שכולו נגרר חוטף את גלילת המסך.
// הגרירה היא העברת שלב ולא שינוי סדר — הנמדד הוא העמודה שמתחת לשחרור.
var KDRAG = { el: null, col: null };

// ── מה שמסך צריך מ-main ──
// main רושם כאן בעלייה — מודול שמייבא מ-main סוגר מעגל, והרישום הוא הכיוון האחד.
const shell = { render: null };

export { KDRAG, S, shell, state };
