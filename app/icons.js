// app/icons.js — סט האייקונים של הניווט: קו אחד, פינות מעוגלות, בצבע הטקסט
// כולם באותה רשת (24) ובאותו עובי קו — אמוג׳י מתחלף בין מערכות ההפעלה ואינו נשמע לצבע.
var PATHS = {
  dash:     '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l3.6-4.4"/><circle cx="12" cy="16" r="1.3"/><path d="M4 19.5h16"/>',
  cards:    '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10.8" r="2.1"/><path d="M5.9 16.2c.7-1.4 1.8-2.1 3.1-2.1s2.4.7 3.1 2.1"/><path d="M14.6 10h3.9M14.6 13.6h2.6"/>',
  plan:     '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.8 13.8h2.4M13.8 13.8h2.4M7.8 16.8h2.4"/>',
  tasks:    '<path d="M4.5 6.5l1.6 1.6L9.2 5"/><path d="M12.5 6.6h7"/><path d="M4.5 12.5l1.6 1.6 3.1-3.1"/><path d="M12.5 12.6h7"/><circle cx="6.6" cy="18.4" r="1.4"/><path d="M12.5 18.4h7"/>',
  more:     '<rect x="4" y="4" width="6.6" height="6.6" rx="1.9"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.9"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.9"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.9"/>',
  notes:    '<path d="M6 4h12a2 2 0 0 1 2 2v8.5L14.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M20 14.5h-3.5a2 2 0 0 0-2 2V20"/><path d="M8 9h8M8 12.5h5"/>',
  loans:    '<path d="M4 8h13"/><path d="M14 4.5L17.5 8 14 11.5"/><path d="M20 16H7"/><path d="M10 12.5L6.5 16l3.5 3.5"/>',
  budget:   '<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  settings: '<path d="M4 6h8.5M16.5 6H20M4 12h2.5M10.5 12H20M4 18h6.5M14.5 18H20"/><circle cx="14.5" cy="6" r="2"/><circle cx="8.5" cy="12" r="2"/><circle cx="12.5" cy="18" r="2"/>'
};

function icon(name) {
  return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + (PATHS[name] || '') + '</svg>';
}

export { icon };
