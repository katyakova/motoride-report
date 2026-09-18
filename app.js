(function () {
"use strict";
const CFG = window.MOTORIDE_CONFIG || {};
const WSD = CFG.WEEK_START_DAY == null ? 1 : CFG.WEEK_START_DAY; // 0=вс, 1=пн ... 5=пт
const $ = (s, r) => (r || document).querySelector(s);
const nf = (n, d) => (n == null || !isFinite(n)) ? "—" : n.toLocaleString("ru-RU", { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });
const rub = n => (n == null || !isFinite(n)) ? "—" : nf(n) + " ₽";
const pc = n => (n == null || !isFinite(n)) ? "—" : nf(n * 100, 1) + "%";
const div = (a, b) => (b > 0 ? a / b : null);
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/* ---------- Каналы ---------- */
const CH = [
  { id: "avito", name: "Авито", color: "var(--c1)" },
  { id: "direct", name: "Яндекс Директ", color: "var(--c2)" },
  { id: "maps", name: "Яндекс Карты", color: "var(--c3)" },
  { id: "gis", name: "2ГИС", color: "var(--c4)" },
  { id: "organic", name: "Органика (сайт/SEO)", color: "var(--c5)" },
  { id: "tg", name: "Telegram", color: "var(--c6)" },
  { id: "other", name: "Рекомендации и неизвестно", color: "var(--c7)" }
];
const CAMPS = [["search", "Поиск"], ["rsya", "РСЯ"], ["mk", "МК (мастер-класс)"]];

/* ---------- Поля. freq: week = раз в неделю (или автоматом по API), day = каждый день ---------- */
const campGroup = ([k, n]) => ({ freq: "week", title: "Яндекс Директ — " + n, fields: [["direct_" + k + "_shows", "Показы"], ["direct_" + k + "_clicks", "Переходы"], ["direct_" + k + "_leads_form", "Лид: заявки Tilda"], ["direct_" + k + "_leads_msgr", "Лид: переход в мессенджер"], ["direct_" + k + "_spend", "Расход, ₽"]] });
const pointGroup = (p, n) => ({ freq: "week", title: "Яндекс Карты — " + n, fields: [[p + "_discovery", "Дискавери в картах"], [p + "_direct", "Прямые переходы"], [p + "_photo", "Просмотр фото"], [p + "_reviews", "Просмотр отзывов"], [p + "_route", "Проложен маршрут"], [p + "_site", "Переход на сайт"], [p + "_phone", "Клик по телефону"]] });
const SCHEMA = [
  { freq: "day", title: "Квалифицированные заявки за день", note: "Сколько заявок по каждому каналу признано «квал».", fields: CH.map(c => ["qual_" + c.id, c.name]) },
  { freq: "day", title: "Продажи за день", note: "Сколько человек оплатили обучение, по каналу, откуда они пришли.", fields: CH.map(c => ["sales_" + c.id, c.name]) },
  { freq: "day", title: "Заявки из карт, 2ГИС, Telegram и других источников", note: "Заявки и звонки, которые приходят в личные сообщения и по телефону.", fields: [["maps_leads", "Заявки из Яндекс Карт"], ["maps_calls", "Звонки из Яндекс Карт"], ["gis_leads", "2ГИС: заявки или звонки"], ["tg_button", "Telegram: кнопка «Записаться»"], ["tg_dm", "Telegram: запрос в личку"], ["direct_visits", "Прямой заход на сайт"], ["seo_leads", "SEO-выдача"], ["referral_leads", "По рекомендации"], ["unknown_leads", "Неизвестный источник"]] },
  { freq: "week", title: "Авито", fields: [["avito_shows", "Показы"], ["avito_views", "Просмотры"], ["avito_fav", "Избранное"], ["avito_contacts", "Контакты"], ["avito_spend", "Расход, ₽"]] },
  ...CAMPS.map(campGroup),
  pointGroup("lenin", "Ленинский проспект"), pointGroup("teply", "Тёплый Стан"),
  { freq: "week", title: "2ГИС", fields: [["gis_shows", "Показы"], ["gis_position", "Позиция в выдаче (средняя)"]] }
];
const WEEKLY_KEYS = SCHEMA.filter(g => g.freq === "week").flatMap(g => g.fields.map(f => f[0]));
const DAILY_KEYS = SCHEMA.filter(g => g.freq === "day").flatMap(g => g.fields.map(f => f[0]));
const KEYS = ["date"].concat(WEEKLY_KEYS, DAILY_KEYS);
const DATA_KEYS = KEYS.slice(1);
const AVG_KEYS = ["gis_position"];
window.MOTORIDE_KEYS = KEYS;

/* ---------- Даты ---------- */
const parseISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dm = d => String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
const ru = s => s.split("-").reverse().join(".");
const weekStart = d => addDays(d, -((d.getDay() - WSD + 7) % 7));
const monthLabel = k => MONTHS[+k.slice(5, 7) - 1] + " " + k.slice(2, 4);
const prevMonth = k => { const y = +k.slice(0, 4), m = +k.slice(5, 7); return m === 1 ? (y - 1) + "-12" : y + "-" + String(m - 1).padStart(2, "0"); };
const lastDayOfMonth = k => iso(new Date(+k.slice(0, 4), +k.slice(5, 7), 0));

/* ---------- Данные ---------- */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(",").map(s => s.trim().replace(/^"|"$/g, ""));
  if (head[0] === "week_start") head[0] = "date"; // совместимость со старым форматом
  return lines.slice(1).map(l => {
    const c = l.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
    const r = {};
    head.forEach((h, i) => { if (h === "date") r.date = c[i]; else if (c[i] !== undefined && c[i] !== "") r[h] = parseFloat(c[i].replace(",", ".")) || 0; });
    return r;
  }).filter(r => r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
}
let baseRows = window.MOTORIDE_CSV ? parseCSV(window.MOTORIDE_CSV) : [];
const LS = "motoride_rows_v2";
const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { return {}; } };
const saveLocal = o => { try { localStorage.setItem(LS, JSON.stringify(o)); return true; } catch (e) { return false; } };
let rows = [];
function rebuildRows() {
  const map = {};
  baseRows.forEach(r => { map[r.date] = Object.assign(map[r.date] || {}, r); });
  const loc = loadLocal(); let dirty = false;
  Object.keys(loc).forEach(k => {
    // если подключена общая таблица — свои записи держим только 15 минут, пока таблица обновляется
    if (CFG.FORM_ENDPOINT && loc[k]._t && Date.now() - loc[k]._t > 15 * 60e3) { delete loc[k]; dirty = true; return; }
    const v = Object.assign({}, loc[k]); delete v._t;
    map[k] = Object.assign(map[k] || {}, v);
  });
  if (dirty) saveLocal(loc);
  rows = Object.values(map).sort((a, b) => a.date < b.date ? -1 : 1);
}
const inRange = (f, t) => rows.filter(r => r.date >= f && r.date <= t);

/* ---------- Расчёты ---------- */
function sum(rs) {
  const s = {}; DATA_KEYS.forEach(k => { s[k] = 0; });
  rs.forEach(r => DATA_KEYS.forEach(k => { s[k] += (r[k] || 0); }));
  AVG_KEYS.forEach(k => { const v = rs.map(r => r[k]).filter(x => x > 0); s[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
  return s;
}
function derive(s) {
  const d = { s };
  d.dl = {}; d.dsp = {}; d.dclk = {}; d.dsh = {};
  CAMPS.forEach(([c]) => {
    d.dl[c] = s["direct_" + c + "_leads_form"] + s["direct_" + c + "_leads_msgr"];
    d.dsp[c] = s["direct_" + c + "_spend"]; d.dclk[c] = s["direct_" + c + "_clicks"]; d.dsh[c] = s["direct_" + c + "_shows"];
  });
  const sumo = o => Object.values(o).reduce((a, b) => a + b, 0);
  d.direct_leads = sumo(d.dl); d.direct_spend = sumo(d.dsp); d.direct_clicks = sumo(d.dclk); d.direct_shows = sumo(d.dsh);
  d.leads = { avito: s.avito_contacts, direct: d.direct_leads, maps: s.maps_leads + s.maps_calls, gis: s.gis_leads, organic: s.direct_visits + s.seo_leads, tg: s.tg_button + s.tg_dm, other: s.referral_leads + s.unknown_leads };
  d.qualBy = {}; d.salesBy = {};
  CH.forEach(c => { d.qualBy[c.id] = s["qual_" + c.id]; d.salesBy[c.id] = s["sales_" + c.id]; });
  d.total = sumo(d.leads); d.qual = sumo(d.qualBy); d.sales = sumo(d.salesBy);
  d.spend = s.avito_spend + d.direct_spend;
  d.paidLeads = d.leads.avito + d.leads.direct;
  d.paidSales = d.salesBy.avito + d.salesBy.direct;
  d.cpl = div(d.spend, d.paidLeads); d.cps = div(d.spend, d.paidSales);
  d.conv = div(d.sales, d.total);
  d.mapsActions = ["lenin", "teply"].map(p => ["photo", "reviews", "route", "site", "phone"].reduce((a, k) => a + s[p + "_" + k], 0));
  return d;
}
const CHSPEND = { avito: d => d.s.avito_spend, direct: d => d.direct_spend };

/* ---------- Период ---------- */
const state = { mode: "week", week: null, month: null, from: null, to: null, tab: "overview", inMode: "day" };
const monthKey = r => r.date.slice(0, 7);
const months = () => [...new Set(rows.map(monthKey))];
function weekList() {
  if (!rows.length) return [];
  const out = []; let w = weekStart(parseISO(rows[0].date)); const last = weekStart(parseISO(rows[rows.length - 1].date));
  while (w <= last) { out.push(iso(w)); w = addDays(w, 7); }
  return out;
}
const mk = (label, f, t) => ({ label, d: derive(sum(inRange(f, t))) });
function getPeriod() {
  let curRange, prevRange, buckets = [], label;
  const maxDate = rows.length ? rows[rows.length - 1].date : "";
  if (state.mode === "week") {
    const a = parseISO(state.week);
    curRange = [state.week, iso(addDays(a, 6))]; prevRange = [iso(addDays(a, -7)), iso(addDays(a, -1))];
    for (let k = 7; k >= 0; k--) { const st = addDays(a, -7 * k); buckets.push(mk(dm(st), iso(st), iso(addDays(st, 6)))); }
    label = "Неделя " + dm(a) + " – " + dm(addDays(a, 6)) + "." + addDays(a, 6).getFullYear();
  } else if (state.mode === "month") {
    const m = state.month, ms = months();
    curRange = [m + "-01", lastDayOfMonth(m)]; const pm = prevMonth(m); prevRange = [pm + "-01", lastDayOfMonth(pm)];
    let k = m; const list = [];
    for (let n = 0; n < 6; n++) { list.unshift(k); k = prevMonth(k); }
    list.forEach(x => { if (ms.includes(x)) buckets.push(mk(monthLabel(x), x + "-01", lastDayOfMonth(x))); });
    label = "Месяц: " + monthLabel(m);
  } else {
    const f = state.from, t = state.to, len = Math.round((parseISO(t) - parseISO(f)) / 864e5) + 1;
    curRange = [f, t]; prevRange = [iso(addDays(parseISO(f), -len)), iso(addDays(parseISO(f), -1))];
    let w = weekStart(parseISO(f));
    while (iso(w) <= t) { buckets.push(mk(dm(w), iso(w) < f ? f : iso(w), iso(addDays(w, 6)) > t ? t : iso(addDays(w, 6)))); w = addDays(w, 7); }
    label = "Период: " + ru(f) + " – " + ru(t);
  }
  const curRows = inRange(curRange[0], curRange[1]), prevRows = inRange(prevRange[0], prevRange[1]);
  return { cur: derive(sum(curRows)), prev: prevRows.length ? derive(sum(prevRows)) : null, buckets, label, empty: curRows.length === 0,
    partial: prevRows.length > 0 && maxDate < curRange[1] ? maxDate : null };
}

/* ---------- Мелкие компоненты ---------- */
function delta(cur, prev, lowerBetter) {
  if (prev == null || !isFinite(prev) || prev === 0 || cur == null || !isFinite(cur)) return '<span class="delta">нет сравнения</span>';
  const ch = (cur - prev) / Math.abs(prev);
  if (Math.abs(ch) < 0.005) return '<span class="delta">▬ 0%</span>';
  const up = ch > 0, good = lowerBetter ? !up : up;
  return '<span class="delta ' + (good ? "good" : "bad") + '">' + (up ? "▲ +" : "▼ −") + nf(Math.abs(ch) * 100, 0) + "% к пред. периоду</span>";
}
const tile = (l, v, dl) => '<div class="tile"><div class="l">' + l + '</div><div class="v">' + v + "</div>" + (dl || "") + "</div>";
const card = (t, inner, sub) => '<div class="card"><h3>' + t + "</h3>" + (sub ? '<div class="sub">' + sub + "</div>" : "") + inner + "</div>";
const shortDelta = x => x.replace("к пред. периоду", "");

/* ---------- Графики (чистый SVG) ---------- */
const REG = {}; let regN = 0;
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
function chart(type, labels, series, o) {
  o = o || {};
  const id = "ch" + (++regN); const fv = o.fmt || (v => nf(v, o.dec || 0));
  REG[id] = { labels, series, fv };
  const W = 720, H = 240, L = 46, R = 10, T = 10, B = 26, iw = W - L - R, ih = H - T - B, n = labels.length;
  if (!n) return '<div class="sub">Нет данных за период</div>';
  const totals = labels.map((_, i) => type === "stack" ? series.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max.apply(null, series.map(s => s.values[i] || 0)));
  const max = niceMax(Math.max.apply(null, totals.concat([0])) * 1.02 / 4) * 4;
  const y = v => T + ih - (v / max) * ih, slot = iw / n;
  let g = "";
  for (let k = 0; k <= 4; k++) { const v = max * k / 4, yy = y(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" style="stroke:var(--grid)"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + nf(v, max < 10 ? 1 : 0) + "</text>"; }
  const step = Math.ceil(n / 10);
  labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += '<text x="' + (L + slot * i + slot / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + l + "</text>"; });
  if (type === "stack") {
    const bw = Math.min(46, slot * 0.62);
    labels.forEach((_, i) => { let acc = 0; series.forEach(s => { const v = s.values[i] || 0; if (v <= 0) return; const y0 = y(acc), y1 = y(acc + v); acc += v; g += '<rect x="' + (L + slot * i + (slot - bw) / 2) + '" y="' + y1 + '" width="' + bw + '" height="' + Math.max(0, y0 - y1) + '" style="fill:' + s.color + ';stroke:var(--surface);stroke-width:2"/>'; }); });
  } else {
    series.forEach(s => {
      const pts = labels.map((_, i) => [L + slot * i + slot / 2, y(s.values[i] || 0)]);
      g += '<polyline fill="none" stroke-linejoin="round" stroke-linecap="round" points="' + pts.map(p => p.join(",")).join(" ") + '" style="stroke:' + s.color + ';stroke-width:2"/>';
      pts.forEach(p => { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" style="fill:' + s.color + ';stroke:var(--surface);stroke-width:2"/>'; });
    });
  }
  g += '<line class="xh" y1="' + T + '" y2="' + (T + ih) + '" style="stroke:var(--muted);stroke-width:1;opacity:0"/>';
  labels.forEach((_, i) => { g += '<rect class="hit" data-c="' + id + '" data-i="' + i + '" x="' + (L + slot * i) + '" y="' + T + '" width="' + slot + '" height="' + ih + '" fill="transparent"/>'; });
  const legend = series.length > 1 ? '<div class="legend">' + series.map(s => '<span><i style="background:' + s.color + '"></i>' + s.name + "</span>").join("") + "</div>" : "";
  const table = '<details><summary>Таблица</summary><div class="tablewrap"><table><tr><th></th>' + labels.map(l => "<th>" + l + "</th>").join("") + "</tr>" +
    series.map(s => "<tr><td>" + s.name + "</td>" + s.values.map(v => "<td>" + fv(v) + "</td>").join("") + "</tr>").join("") + "</table></div></details>";
  return legend + '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + (o.aria || "График") + '">' + g + "</svg>" + table;
}
const tip = $("#tip");
function showTip(t, cx, cy) {
  document.querySelectorAll(".xh").forEach(x => x.style.opacity = 0);
  if (!t || !t.classList || !t.classList.contains("hit")) { tip.hidden = true; return; }
  const c = REG[t.dataset.c], i = +t.dataset.i, svg = t.ownerSVGElement;
  const x = +t.getAttribute("x") + +t.getAttribute("width") / 2, xh = svg.querySelector(".xh");
  xh.setAttribute("x1", x); xh.setAttribute("x2", x); xh.style.opacity = 1;
  tip.innerHTML = "<b>" + c.labels[i] + "</b>" + c.series.map(s => '<div><i style="background:' + s.color + '"></i>' + s.name + ": " + c.fv(s.values[i] || 0) + "</div>").join("");
  tip.hidden = false;
  tip.style.left = Math.max(6, Math.min(window.innerWidth - 270, cx + 14)) + "px"; tip.style.top = (cy + 14) + "px";
}
document.addEventListener("mousemove", e => showTip(e.target, e.clientX, e.clientY));
document.addEventListener("touchstart", e => { const t = e.touches[0]; showTip(document.elementFromPoint(t.clientX, t.clientY), t.clientX, t.clientY - 60); }, { passive: true });

/* ---------- Экраны ---------- */
const S = (name, color, fn, P) => ({ name, color, values: P.buckets.map(b => fn(b.d)) });
function insights(P) {
  const c = P.cur, p = P.prev, out = [];
  if (c.total === 0) return [["", "За выбранный период нет заявок — проверьте, что данные внесены."]];
  const paid = CH.filter(x => CHSPEND[x.id]).map(x => ({ x, sp: CHSPEND[x.id](c), l: c.leads[x.id], sl: c.salesBy[x.id] })).filter(a => a.sp > 0);
  paid.forEach(a => { if (a.l === 0) out.push(["bad", a.x.name + ": потрачено " + rub(a.sp) + ", заявок нет. Проверьте настройки или остановите трату."]); });
  paid.forEach(a => { if (a.l >= 10 && a.sl === 0) out.push(["bad", a.x.name + ": " + nf(a.l) + " заявок и " + rub(a.sp) + " расхода, но ни одной продажи. Возможно, приходят нецелевые заявки."]); });
  const w = paid.filter(a => a.sl > 0).map(a => ({ n: a.x.name, cps: a.sp / a.sl })).sort((a, b) => b.cps - a.cps);
  if (w.length > 1) out.push(["", "Цена продажи: " + w[0].n + " — " + rub(w[0].cps) + ", против " + rub(w[w.length - 1].cps) + " в канале «" + w[w.length - 1].n + "». Есть смысл перераспределить бюджет."]);
  else { const w2 = paid.filter(a => a.l > 0).map(a => ({ n: a.x.name, cpl: a.sp / a.l })).sort((a, b) => b.cpl - a.cpl); if (w2.length > 1) out.push(["", "Цена заявки: " + w2[0].n + " — " + rub(w2[0].cpl) + ", против " + rub(w2[w2.length - 1].cpl) + " в канале «" + w2[w2.length - 1].n + "»."]); }
  if (p) CH.forEach(x => { const a = c.leads[x.id], b = p.leads[x.id]; if (b >= 5 && (a - b) / b <= -0.2) out.push(["bad", x.name + ": заявок " + nf(a) + " против " + nf(b) + " (−" + nf((b - a) / b * 100) + "%). Стоит выяснить причину."]); if (b >= 5 && (a - b) / b >= 0.2) out.push(["good", x.name + ": рост заявок " + nf(b) + " → " + nf(a) + ". Что сработало — можно масштабировать."]); });
  const top = CH.map(x => ({ x, v: c.leads[x.id] })).sort((a, b) => b.v - a.v)[0];
  if (top.v / c.total > 0.5) out.push(["", "Больше половины заявок (" + nf(top.v / c.total * 100) + "%) приходит из одного канала — «" + top.x.name + "». Это риск: канал упадёт — упадут и продажи."]);
  const act = c.s.lenin_route + c.s.teply_route + c.s.lenin_site + c.s.teply_site;
  if (act > 20 && c.leads.maps < act * 0.1) out.push(["", "Яндекс Карты: " + nf(act) + " маршрутов и переходов на сайт, но всего " + nf(c.leads.maps) + " заявок. Проверьте карточку: цены, кнопки записи, актуальность фото."]);
  if (c.conv != null && c.conv < 0.1) out.push(["bad", "Конверсия заявки в продажу " + pc(c.conv) + ". Возможно, узкое место в обработке заявок, а не в трафике."]);
  return out.length ? out : [["good", "Существенных отклонений не найдено."]];
}
function chanTiles(P, id) {
  const c = P.cur, p = P.prev, sp = CHSPEND[id] ? CHSPEND[id](c) : null;
  return tile("Квал. заявки", nf(c.qualBy[id]), delta(c.qualBy[id], p && p.qualBy[id])) + tile("Продажи", nf(c.salesBy[id]), delta(c.salesBy[id], p && p.salesBy[id])) +
    tile("Заявка → продажа", pc(div(c.salesBy[id], c.leads[id])), "") +
    (sp != null ? tile("Цена продажи", rub(div(sp, c.salesBy[id])), delta(div(sp, c.salesBy[id]), p && div(CHSPEND[id](p), p.salesBy[id]), true)) : "");
}
function vOverview(P) {
  const c = P.cur, p = P.prev, pp = p || {};
  let h = '<div class="tiles">' +
    tile("Заявки", nf(c.total), delta(c.total, pp.total)) + tile("Квал. заявки", nf(c.qual), delta(c.qual, pp.qual)) +
    tile("Продажи", nf(c.sales), delta(c.sales, pp.sales)) + tile("Заявка → продажа", pc(c.conv), delta(c.conv, pp.conv)) +
    tile("Расход на рекламу", rub(c.spend), delta(c.spend, pp.spend, true)) + tile("Цена заявки (платные)", rub(c.cpl), delta(c.cpl, pp.cpl, true)) +
    tile("Цена продажи (платные)", rub(c.cps), delta(c.cps, pp.cps, true)) + "</div>";
  const L = P.buckets.map(b => b.label);
  h += '<div class="grid2">' + card("Заявки по каналам", chart("stack", L, CH.map(x => S(x.name, x.color, d => d.leads[x.id], P)), { aria: "Заявки по каналам" })) +
    card("Продажи по каналам", chart("stack", L, CH.map(x => S(x.name, x.color, d => d.salesBy[x.id], P)), { aria: "Продажи по каналам" })) + "</div>";
  h += card("Сводка по каналам", '<div class="tablewrap"><table><tr><th>Канал</th><th>Заявки</th><th>Доля</th><th>к пред.</th><th>Квал</th><th>Продажи</th><th>Расход</th><th>Цена заявки</th><th>Цена продажи</th></tr>' +
    CH.map(x => { const l = c.leads[x.id], sp = CHSPEND[x.id] ? CHSPEND[x.id](c) : null; return '<tr><td><span class="legend" style="display:inline"><i style="background:' + x.color + '"></i></span>' + x.name + "</td><td>" + nf(l) + "</td><td>" + pc(div(l, c.total)) + "</td><td>" + (p ? shortDelta(delta(l, p.leads[x.id])) : "—") + "</td><td>" + nf(c.qualBy[x.id]) + "</td><td>" + nf(c.salesBy[x.id]) + "</td><td>" + (sp != null ? rub(sp) : "—") + "</td><td>" + (sp != null ? rub(div(sp, l)) : "—") + "</td><td>" + (sp != null ? rub(div(sp, c.salesBy[x.id])) : "—") + "</td></tr>"; }).join("") + "</table></div>");
  h += card("Точки роста", '<ul class="insights">' + insights(P).map(i => '<li class="' + i[0] + '">' + i[1] + "</li>").join("") + "</ul>", "Подсказки считаются автоматически по правилам — это повод присмотреться, а не приговор.");
  return h;
}
function funnelRow(name, cur, prev, f, low) { return "<tr><td>" + name + "</td><td>" + f(cur) + "</td><td>" + (prev == null ? "—" : f(prev)) + "</td><td>" + shortDelta(delta(cur, prev, low)) + "</td></tr>"; }
function vAvito(P) {
  const c = P.cur, p = P.prev, s = c.s, ps = p ? p.s : {};
  let h = '<div class="tiles">' + tile("Показы", nf(s.avito_shows), delta(s.avito_shows, ps.avito_shows)) + tile("Просмотры", nf(s.avito_views), delta(s.avito_views, ps.avito_views)) + tile("Контакты", nf(s.avito_contacts), delta(s.avito_contacts, ps.avito_contacts)) + tile("Расход", rub(s.avito_spend), delta(s.avito_spend, ps.avito_spend, true)) + tile("Цена контакта", rub(div(s.avito_spend, s.avito_contacts)), delta(div(s.avito_spend, s.avito_contacts), p ? div(ps.avito_spend, ps.avito_contacts) : null, true)) + chanTiles(P, "avito") + "</div>";
  const rr = (n, fn, f, low) => funnelRow(n, fn(s), p ? fn(ps) : null, f, low);
  h += card("Воронка Авито", '<div class="tablewrap"><table><tr><th>Показатель</th><th>Сейчас</th><th>Пред.</th><th>Δ</th></tr>' +
    rr("Показы", x => x.avito_shows, nf) + rr("Просмотры", x => x.avito_views, nf) + rr("Избранное", x => x.avito_fav, nf) + rr("Контакты", x => x.avito_contacts, nf) + rr("Квал. контакты", x => x.qual_avito, nf) + rr("Продажи", x => x.sales_avito, nf) +
    rr("Конверсия показ → просмотр", x => div(x.avito_views, x.avito_shows), pc) + rr("Конверсия просмотр → контакт", x => div(x.avito_contacts, x.avito_views), pc) + rr("Конверсия контакт → квал", x => div(x.qual_avito, x.avito_contacts), pc) + rr("Конверсия квал → продажа", x => div(x.sales_avito, x.qual_avito), pc) +
    rr("Цена просмотра", x => div(x.avito_spend, x.avito_views), rub, true) + rr("Цена контакта", x => div(x.avito_spend, x.avito_contacts), rub, true) + rr("Цена квал. контакта", x => div(x.avito_spend, x.qual_avito), rub, true) + rr("Цена продажи", x => div(x.avito_spend, x.sales_avito), rub, true) + "</table></div>");
  const L = P.buckets.map(b => b.label);
  h += '<div class="grid2">' + card("Контакты", chart("line", L, [S("Контакты", "var(--c1)", d => d.s.avito_contacts, P)], {})) + card("Расход, ₽", chart("line", L, [S("Расход", "var(--c1)", d => d.s.avito_spend, P)], { fmt: rub })) + card("Цена контакта, ₽", chart("line", L, [S("Цена контакта", "var(--c1)", d => div(d.s.avito_spend, d.s.avito_contacts) || 0, P)], { fmt: rub })) + card("Продажи", chart("line", L, [S("Продажи", "var(--c1)", d => d.salesBy.avito, P)], {})) + "</div>";
  return h;
}
function vDirect(P) {
  const c = P.cur, p = P.prev;
  let h = '<div class="tiles">' + tile("Показы", nf(c.direct_shows), delta(c.direct_shows, p && p.direct_shows)) + tile("Переходы", nf(c.direct_clicks), delta(c.direct_clicks, p && p.direct_clicks)) + tile("CTR", pc(div(c.direct_clicks, c.direct_shows)), "") + tile("Заявки", nf(c.direct_leads), delta(c.direct_leads, p && p.direct_leads)) + tile("Расход", rub(c.direct_spend), delta(c.direct_spend, p && p.direct_spend, true)) + tile("Цена заявки", rub(div(c.direct_spend, c.direct_leads)), delta(div(c.direct_spend, c.direct_leads), p && div(p.direct_spend, p.direct_leads), true)) + chanTiles(P, "direct") + "</div>";
  const row = (n, sh, cl, lf, lm, sp) => "<tr><td>" + n + "</td><td>" + nf(sh) + "</td><td>" + nf(cl) + "</td><td>" + pc(div(cl, sh)) + "</td><td>" + nf(lf) + "</td><td>" + nf(lm) + "</td><td>" + rub(sp) + "</td><td>" + rub(div(sp, cl)) + "</td><td>" + rub(div(sp, lf + lm)) + "</td></tr>";
  h += card("Кампании", '<div class="tablewrap"><table><tr><th>Кампания</th><th>Показы</th><th>Переходы</th><th>CTR</th><th>Заявки Tilda</th><th>В мессенджер</th><th>Расход</th><th>Цена клика</th><th>Цена лида</th></tr>' +
    CAMPS.map(([k, n]) => row(n, c.s["direct_" + k + "_shows"], c.s["direct_" + k + "_clicks"], c.s["direct_" + k + "_leads_form"], c.s["direct_" + k + "_leads_msgr"], c.s["direct_" + k + "_spend"])).join("") +
    "<tr><th>Итого</th><th>" + nf(c.direct_shows) + "</th><th>" + nf(c.direct_clicks) + "</th><th>" + pc(div(c.direct_clicks, c.direct_shows)) + "</th><th>" + nf(CAMPS.reduce((a, [k]) => a + c.s["direct_" + k + "_leads_form"], 0)) + "</th><th>" + nf(CAMPS.reduce((a, [k]) => a + c.s["direct_" + k + "_leads_msgr"], 0)) + "</th><th>" + rub(c.direct_spend) + "</th><th>" + rub(div(c.direct_spend, c.direct_clicks)) + "</th><th>" + rub(div(c.direct_spend, c.direct_leads)) + "</th></tr></table></div>");
  const L = P.buckets.map(b => b.label), col = ["var(--c2)", "var(--c4)", "var(--c5)"];
  h += '<div class="grid2">' + card("Заявки по кампаниям", chart("stack", L, CAMPS.map(([k, n], i) => S(n, col[i], d => d.dl[k], P)), {})) + card("Расход по кампаниям, ₽", chart("stack", L, CAMPS.map(([k, n], i) => S(n, col[i], d => d.dsp[k], P)), { fmt: rub })) + "</div>";
  return h;
}
function vMaps(P) {
  const c = P.cur, p = P.prev, s = c.s, ps = p ? p.s : {};
  const acts = (x, pre) => ["photo", "reviews", "route", "site", "phone"].reduce((a, k) => a + x[pre + "_" + k], 0);
  const tot = x => acts(x, "lenin") + acts(x, "teply");
  let h = '<div class="tiles">' + tile("Действия в карточках", nf(tot(s)), delta(tot(s), p && tot(ps))) + tile("Проложено маршрутов", nf(s.lenin_route + s.teply_route), delta(s.lenin_route + s.teply_route, p && ps.lenin_route + ps.teply_route)) + tile("Переходы на сайт", nf(s.lenin_site + s.teply_site), delta(s.lenin_site + s.teply_site, p && ps.lenin_site + ps.teply_site)) + tile("Заявки и звонки из карт", nf(c.leads.maps), delta(c.leads.maps, p && p.leads.maps)) + chanTiles(P, "maps") + "</div>";
  const pts = [["lenin", "Ленинский проспект"], ["teply", "Тёплый Стан"]];
  const cols = [["discovery", "Дискавери"], ["direct", "Прямые переходы"], ["photo", "Просмотр фото"], ["reviews", "Просмотр отзывов"], ["route", "Маршрут"], ["site", "Переход на сайт"], ["phone", "Клик по телефону"]];
  h += card("Точки", '<div class="tablewrap"><table><tr><th>Точка</th>' + cols.map(x => "<th>" + x[1] + "</th>").join("") + "<th>Действий всего</th></tr>" + pts.map(([k, n]) => "<tr><td>" + n + "</td>" + cols.map(x => "<td>" + nf(s[k + "_" + x[0]]) + "</td>").join("") + "<td>" + nf(acts(s, k)) + "</td></tr>").join("") + "</table></div>", "«Дискавери» и «Прямые переходы» — это охват, в «Действия» они не входят.");
  const L = P.buckets.map(b => b.label);
  h += '<div class="grid2">' + card("Действия по точкам", chart("stack", L, [S("Ленинский проспект", "var(--c3)", d => d.mapsActions[0], P), S("Тёплый Стан", "var(--c1)", d => d.mapsActions[1], P)], {})) + card("Заявки и звонки из карт", chart("line", L, [S("Заявки и звонки", "var(--c3)", d => d.leads.maps, P)], {})) + "</div>";
  return h;
}
function vGis(P) {
  const c = P.cur, p = P.prev, s = c.s, ps = p ? p.s : {};
  const L = P.buckets.map(b => b.label);
  return '<div class="tiles">' + tile("Показы", nf(s.gis_shows), delta(s.gis_shows, ps.gis_shows)) + tile("Заявки / звонки", nf(s.gis_leads), delta(s.gis_leads, ps.gis_leads)) + tile("Средняя позиция", nf(s.gis_position, 1), delta(s.gis_position, ps.gis_position, true)) + chanTiles(P, "gis") + "</div>" +
    '<div class="grid2">' + card("Показы", chart("line", L, [S("Показы", "var(--c4)", d => d.s.gis_shows, P)], {})) + card("Заявки / звонки", chart("line", L, [S("Заявки", "var(--c4)", d => d.s.gis_leads, P)], {})) + card("Позиция в выдаче", chart("line", L, [S("Позиция", "var(--c4)", d => d.s.gis_position, P)], { dec: 1 }), "Чем меньше число — тем выше позиция.") + "</div>";
}
function vOther(P) {
  const c = P.cur, p = P.prev, s = c.s, ps = p ? p.s : {};
  const L = P.buckets.map(b => b.label);
  return '<div class="tiles">' + tile("Органика (сайт + SEO)", nf(c.leads.organic), delta(c.leads.organic, p && p.leads.organic)) + tile("Telegram", nf(c.leads.tg), delta(c.leads.tg, p && p.leads.tg)) + tile("По рекомендации", nf(s.referral_leads), delta(s.referral_leads, ps.referral_leads)) + tile("Неизвестный источник", nf(s.unknown_leads), delta(s.unknown_leads, ps.unknown_leads, true)) + "</div>" +
    card("Квал. заявки и продажи", '<div class="tablewrap"><table><tr><th>Канал</th><th>Заявки</th><th>Квал</th><th>Продажи</th><th>Заявка → продажа</th></tr>' + ["organic", "tg", "other"].map(id => "<tr><td>" + CH.find(x => x.id === id).name + "</td><td>" + nf(c.leads[id]) + "</td><td>" + nf(c.qualBy[id]) + "</td><td>" + nf(c.salesBy[id]) + "</td><td>" + pc(div(c.salesBy[id], c.leads[id])) + "</td></tr>").join("") + "</table></div>") +
    card("Заявки из прочих источников", chart("stack", L, [S("Прямой заход", "var(--c5)", d => d.s.direct_visits, P), S("SEO-выдача", "var(--c1)", d => d.s.seo_leads, P), S("Telegram", "var(--c6)", d => d.leads.tg, P), S("Рекомендации", "var(--c7)", d => d.s.referral_leads, P), S("Неизвестно", "var(--c4)", d => d.s.unknown_leads, P)], {}), "Если «Неизвестно» растёт — значит, мы плохо спрашиваем у клиентов, откуда они пришли.");
}

/* ---------- Ввод данных ---------- */
function vInput() {
  const day = state.inMode === "day", today = iso(new Date());
  const groups = SCHEMA.filter(g => g.freq === (day ? "day" : "week"));
  let h = "<h2>Ввод данных</h2>" +
    '<div class="seg" id="inSeg"><button data-m="day" class="' + (day ? "on" : "") + '">Каждый день</button><button data-m="week" class="' + (!day ? "on" : "") + '">Раз в неделю</button></div>' +
    '<p class="sub" style="margin:10px 0">' + (day ? "Квал. заявки, продажи и заявки из личных источников. Пустое поле = «не менять». Кнопки «+» и «−» помогают быстро вносить числа с телефона." : "Статистика каналов из кабинетов (Авито, Директ, Карты, 2ГИС). Всё, что подтягивается по API, сюда вносить не нужно. Пустое поле = «не менять».") + "</p>" +
    '<div class="card"><label class="pick">' + (day ? "День" : "Любая дата внутри нужной недели") + ': <input type="date" id="fDate" value="' + today + '"></label><div class="sub" id="fDateNote"></div></div>' +
    groups.map(g => '<div class="card"><h3>' + g.title + "</h3>" + (g.note ? '<div class="sub">' + g.note + "</div>" : "") + '<div class="formgrid' + (day ? " daily" : "") + '">' + g.fields.map(f => "<label>" + f[1] + (day ? '<div class="stp"><button type="button" data-d="-1" aria-label="минус">−</button><input type="number" inputmode="decimal" step="any" min="0" data-k="' + f[0] + '"><button type="button" data-d="1" aria-label="плюс">+</button></div>' : '<input type="number" inputmode="decimal" step="any" min="0" data-k="' + f[0] + '">') + "</label>").join("") + "</div></div>").join("") +
    '<div class="savebar"><button class="btn primary" style="margin-left:0" id="fSave">Сохранить</button><button class="btn" id="fCsv">Скачать все данные (CSV)</button><button class="btn" id="fClear">Очистить данные этого браузера</button></div>' +
    '<div id="fMsg" class="msg" hidden></div>' +
    '<div class="msg">' + (CFG.FORM_ENDPOINT ? "Данные отправляются в общую Google Таблицу. Отчёт обновится в течение нескольких минут." : "Общая таблица пока не подключена: данные хранятся только в этом браузере. Как подключить — этап 2 в ИНСТРУКЦИИ.") + "</div>";
  return h;
}
function bindInput() {
  const fDate = $("#fDate"); if (!fDate) return;
  const day = state.inMode === "day";
  const msg = t => { const m = $("#fMsg"); m.textContent = t; m.hidden = false; };
  const target = () => day ? fDate.value : iso(weekStart(parseISO(fDate.value)));
  const fill = () => {
    if (!fDate.value) return;
    const t = target(), r = rows.find(x => x.date === t) || {};
    document.querySelectorAll("[data-k]").forEach(i => { i.value = r[i.dataset.k] != null ? r[i.dataset.k] : ""; });
    const a = parseISO(t);
    $("#fDateNote").textContent = day ? "" : "Данные запишутся на неделю " + dm(a) + " – " + dm(addDays(a, 6)) + " (начало недели: " + ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"][WSD] + ").";
  };
  fDate.onchange = fill; fill();
  $("#inSeg").onclick = e => { const b = e.target.closest("button"); if (b) { state.inMode = b.dataset.m; render(); switchTab("input"); } };
  document.querySelectorAll(".stp button").forEach(b => { b.onclick = () => { const i = b.parentNode.querySelector("input"); i.value = Math.max(0, (parseFloat(i.value) || 0) + (+b.dataset.d)); }; });
  $("#fSave").onclick = () => {
    if (!fDate.value) return msg("Выберите дату.");
    const t = target(), part = { date: t }; let n = 0;
    document.querySelectorAll("[data-k]").forEach(i => { if (i.value !== "") { part[i.dataset.k] = parseFloat(i.value) || 0; n++; } });
    if (!n) return msg("Все поля пустые — сохранять нечего.");
    const loc = loadLocal(); loc[t] = Object.assign(loc[t] || {}, part, { _t: Date.now() }); saveLocal(loc);
    if (CFG.FORM_ENDPOINT) fetch(CFG.FORM_ENDPOINT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(part) }).catch(() => {});
    rebuildRows(); init(true); switchTab("input");
    const m = $("#fMsg"); m.hidden = false; m.textContent = "Сохранено: " + ru(t) + " (полей: " + n + ")" + (CFG.FORM_ENDPOINT ? ", отправлено в таблицу." : ".");
    m.scrollIntoView({ block: "nearest" });
  };
  $("#fCsv").onclick = () => {
    const csv = KEYS.join(",") + "\n" + rows.map(r => KEYS.map(k => r[k] == null ? "" : r[k]).join(",")).join("\n") + "\n";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "weeks.csv"; a.click();
  };
  $("#fClear").onclick = () => { saveLocal({}); rebuildRows(); init(true); switchTab("input"); msg("Данные, внесённые в этом браузере, удалены."); };
}

/* ---------- Каркас ---------- */
const TABS = [["overview", "Обзор", vOverview], ["avito", "Авито", vAvito], ["direct", "Яндекс Директ", vDirect], ["maps", "Яндекс Карты", vMaps], ["gis", "2ГИС", vGis], ["other", "Органика и прочее", vOther], ["input", "Ввод данных", null]];
function switchTab(t) {
  state.tab = t;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("on", v.id === "view-" + t));
  $("#controls").style.display = t === "input" ? "none" : "";
}
function render() {
  const v = $("#views");
  if (!rows.length) {
    $("#printTitle").textContent = "";
    v.innerHTML = TABS.map(([id, , fn]) => '<section class="view" id="view-' + id + '">' + (fn ? '<div class="msg">Пока нет данных. Откройте вкладку «Ввод данных» и добавьте первые цифры.</div>' : vInput()) + "</section>").join("");
    bindInput(); switchTab(state.tab === "input" ? "input" : "overview"); return;
  }
  const P = getPeriod();
  $("#printTitle").textContent = "Motoride — маркетинговый отчёт · " + P.label;
  const heads = { overview: "Обзор", avito: "Авито", direct: "Яндекс Директ", maps: "Яндекс Карты", gis: "2ГИС", other: "Органика и прочее" };
  const note = P.partial ? '<div class="msg">Внимание: данные внесены только до ' + ru(P.partial) + ", поэтому период неполный. Сравнения «к пред. периоду» могут быть неточными.</div>" : "";
  v.innerHTML = TABS.map(([id, name, fn]) => '<section class="view" id="view-' + id + '">' + (fn ? "<h2>" + heads[id] + ' <span class="sub">· ' + P.label + "</span></h2>" + (P.empty ? '<div class="msg">За этот период нет данных.</div>' : note + fn(P)) : vInput()) + "</section>").join("");
  bindInput(); switchTab(state.tab);
}
function init(keep) {
  const ws = weekList(), ms = months();
  if (!keep || !ws.includes(state.week)) state.week = ws[ws.length - 1] || null;
  if (!keep || !ms.includes(state.month)) state.month = ms[ms.length - 1] || null;
  if (rows.length && (!keep || !state.from)) { state.from = rows[0].date; state.to = rows[rows.length - 1].date; }
  $("#selWeek").innerHTML = ws.slice().reverse().map(w => { const a = parseISO(w); return '<option value="' + w + '">' + dm(a) + " – " + dm(addDays(a, 6)) + "." + addDays(a, 6).getFullYear() + "</option>"; }).join("");
  $("#selMonth").innerHTML = ms.slice().reverse().map(m => '<option value="' + m + '">' + monthLabel(m) + "</option>").join("");
  if (state.week) $("#selWeek").value = state.week;
  if (state.month) $("#selMonth").value = state.month;
  $("#dFrom").value = state.from || ""; $("#dTo").value = state.to || "";
  render();
}
function setMode(m) {
  state.mode = m;
  document.querySelectorAll("#modeSeg button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
  $("#pickWeek").hidden = m !== "week"; $("#pickMonth").hidden = m !== "month"; $("#pickCustom").hidden = m !== "custom";
  render();
}
function boot() {
  $("#tabs").innerHTML = TABS.map(t => '<button role="tab" data-t="' + t[0] + '">' + t[1] + "</button>").join("");
  $("#tabs").onclick = e => { const b = e.target.closest("button"); if (b) switchTab(b.dataset.t); };
  $("#modeSeg").onclick = e => { const b = e.target.closest("button"); if (b) setMode(b.dataset.mode); };
  $("#selWeek").onchange = e => { state.week = e.target.value; render(); };
  $("#selMonth").onchange = e => { state.month = e.target.value; render(); };
  $("#dFrom").onchange = e => { state.from = e.target.value; render(); };
  $("#dTo").onchange = e => { state.to = e.target.value; render(); };
  $("#btnPdf").onclick = () => window.print();
  $("#demoBanner").hidden = !!CFG.HIDE_DEMO_BANNER;
  rebuildRows(); init(false);
  if (CFG.SHEET_CSV_URL) {
    fetch(CFG.SHEET_CSV_URL).then(r => r.text()).then(t => { baseRows = parseCSV(t); rebuildRows(); init(true); $("#demoBanner").hidden = true; }).catch(() => {});
  }
}
boot();
})();
