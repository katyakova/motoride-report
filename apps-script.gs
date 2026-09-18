/**
 * Motoride: приём данных из формы в Google Таблицу.
 * Инструкция — в файле ИНСТРУКЦИЯ.md, этап 2.
 */
const SHEET_NAME = "weeks";
const KEYS = ["date", "avito_shows", "avito_views", "avito_fav", "avito_contacts", "avito_spend", "direct_search_shows", "direct_search_clicks", "direct_search_leads_form", "direct_search_leads_msgr", "direct_search_spend", "direct_rsya_shows", "direct_rsya_clicks", "direct_rsya_leads_form", "direct_rsya_leads_msgr", "direct_rsya_spend", "direct_mk_shows", "direct_mk_clicks", "direct_mk_leads_form", "direct_mk_leads_msgr", "direct_mk_spend", "lenin_discovery", "lenin_direct", "lenin_photo", "lenin_reviews", "lenin_route", "lenin_site", "lenin_phone", "teply_discovery", "teply_direct", "teply_photo", "teply_reviews", "teply_route", "teply_site", "teply_phone", "gis_shows", "gis_position", "qual_avito", "qual_direct", "qual_maps", "qual_gis", "qual_organic", "qual_tg", "qual_other", "sales_avito", "sales_direct", "sales_maps", "sales_gis", "sales_organic", "sales_tg", "sales_other", "maps_leads", "maps_calls", "gis_leads", "tg_button", "tg_dm", "direct_visits", "seo_leads", "referral_leads", "unknown_leads"];

// Запустите ОДИН раз вручную: создаст лист weeks с заголовками
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.getRange("A:A").setNumberFormat("@");            // даты храним как текст, чтобы Google не «улучшал» их
  sh.getRange(1, 1, 1, KEYS.length).setValues([KEYS]);
  sh.setFrozenRows(1);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const data = JSON.parse(e.postData.contents);          // например {date:"2026-09-14", sales_avito:1}
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const last = sh.getLastRow();
    const dates = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
    const idx = dates.indexOf(String(data.date));
    const target = idx >= 0 ? idx + 2 : last + 1;          // день уже есть — обновляем, иначе добавляем строку
    const current = idx >= 0 ? sh.getRange(target, 1, 1, KEYS.length).getValues()[0] : KEYS.map(() => "");
    // меняем ТОЛЬКО присланные поля, остальные (в т.ч. данные от API) остаются как были
    const row = KEYS.map((k, i) => (k !== "date" && data[k] !== undefined) ? data[k] : current[i]);
    row[0] = String(data.date);
    sh.getRange(target, 1).setNumberFormat("@");
    sh.getRange(target, 1, 1, KEYS.length).setValues([row]);
    return ContentService.createTextOutput("ok");
  } finally {
    lock.releaseLock();
  }
}
