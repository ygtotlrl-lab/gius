// app/icons.js — סט האייקונים של הממשק: קו אחד, פינות מעוגלות, בצבע הטקסט
// כולם באותה רשת (24) ובאותו עובי קו — אמוג׳י מתחלף בין מערכות ההפעלה ואינו נשמע לצבע.
import { iconSet } from '../core/icons.js';
var PATHS = {
  dash:     '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l3.6-4.4"/><circle cx="12" cy="16" r="1.3"/><path d="M4 19.5h16"/>',
  cards:    '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10.8" r="2.1"/><path d="M5.9 16.2c.7-1.4 1.8-2.1 3.1-2.1s2.4.7 3.1 2.1"/><path d="M14.6 10h3.9M14.6 13.6h2.6"/>',
  plan:     '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.8 13.8h2.4M13.8 13.8h2.4M7.8 16.8h2.4"/>',
  tasks:    '<path d="M4.5 6.5l1.6 1.6L9.2 5"/><path d="M12.5 6.6h7"/><path d="M4.5 12.5l1.6 1.6 3.1-3.1"/><path d="M12.5 12.6h7"/><circle cx="6.6" cy="18.4" r="1.4"/><path d="M12.5 18.4h7"/>',
  more:     '<rect x="4" y="4" width="6.6" height="6.6" rx="1.9"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.9"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.9"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.9"/>',
  notes:    '<path d="M6 4h12a2 2 0 0 1 2 2v8.5L14.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M20 14.5h-3.5a2 2 0 0 0-2 2V20"/><path d="M8 9h8M8 12.5h5"/>',
  loans:    '<path d="M4 8h13"/><path d="M14 4.5L17.5 8 14 11.5"/><path d="M20 16H7"/><path d="M10 12.5L6.5 16l3.5 3.5"/>',
  budget:   '<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  search:   '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.6 15.6l4.6 4.6"/>',
  prev:     '<path d="M9 6l6 6-6 6"/>',
  next:     '<path d="M15 6l-6 6 6 6"/>',
  up:       '<path d="M6 15l6-6 6 6"/>',
  down:     '<path d="M6 9l6 6 6-6"/>',
  close:    '<path d="M6 6l12 12M18 6L6 18"/>',
  star:     '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>',
  edit:     '<path d="M14.5 5.5l4 4L9 19H5v-4z"/><path d="M12.5 7.5l4 4"/>',
  // אמצעי התשלום — בשורת התשלום בדשבורד
  credit:   '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18M7 14.5h3"/>',
  bank:     '<path d="M3.5 9.5L12 4.5l8.5 5"/><path d="M5.5 10v7M10 10v7M14 10v7M18.5 10v7"/><path d="M3.5 19.5h17"/>',
  cash:     '<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.4"/><path d="M6.5 10v4M17.5 10v4"/>',
  cheque:   '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M6.5 14.5c1.2-1.8 2.3-1.8 3 0s1.8 1.8 3 0"/><path d="M14.5 10.5h3.5"/>',
  phone:    '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 17.5h2"/>',
  repeat:   '<path d="M17 4l3 3-3 3"/><path d="M20 7H9a5 5 0 0 0-5 5"/><path d="M7 20l-3-3 3-3"/><path d="M4 17h11a5 5 0 0 0 5-5"/>',
  check:    '<path d="M5.5 12.5l4.2 4.2L18.5 8"/>',
  dots:     '<circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/>',
  settings: '<path d="M4 6h8.5M16.5 6H20M4 12h2.5M10.5 12H20M4 18h6.5M14.5 18H20"/><circle cx="14.5" cy="6" r="2"/><circle cx="8.5" cy="12" r="2"/><circle cx="12.5" cy="18" r="2"/>'
};

// הצייר — core/icons.js, גוף אחד בכולן; כאן רק הסט.
var icon = iconSet(PATHS);

export { icon };
