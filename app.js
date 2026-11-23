/* Reselling-Buch – App (PC + Handy)
 * Daten: Google-Tabelle über Apps-Script-Schnittstelle (Token). Kein Server, keine Kosten.
 */
'use strict';
const APP_VERSION = '10';

// ---------- Zustand ----------
const S = { cfg: null, d: null, seite: 'start', filter: {}, jahr: new Date().getFullYear() };
const $ = (sel, el = document) => el.querySelector(sel);
const inhalt = () => $('#inhalt');

// ---------- Einrichtung (Zugang) ----------
function cfgLaden() {
  const h = location.hash.match(/setup=([\w-]+)/);
  if (h) {
    try {
      const j = JSON.parse(atob(h[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (j.u && j.t) localStorage.setItem('rb_cfg', JSON.stringify({ url: j.u, token: j.t }));
    } catch (e) { /* ungültig */ }
    history.replaceState(null, '', location.pathname);
  }
  try { S.cfg = JSON.parse(localStorage.getItem('rb_cfg') || 'null'); } catch (e) { S.cfg = null; }
}

function einrichtungZeigen(fehler) {
  inhalt().innerHTML = `
    <h1>App einrichten</h1>
    <div class="karte">
      <p>Öffne auf diesem Gerät den <b>Einrichtungs-Link</b> aus deiner E-Mail
      („App auf Handy/PC einrichten“). Dann ist alles fertig.</p>
      <p class="leise klein">Die Mail schickst du dir in der Google-Tabelle über das Menü
      <b>Verkäufe → App-Link per Mail senden</b>.</p>
      ${fehler ? `<div class="hinweis">${esc(fehler)}</div>` : ''}
      <details><summary class="klein leise">Manuell einrichten</summary>
        <label>Web-App-Adresse</label><input id="eUrl" placeholder="https://script.google.com/macros/s/…/exec">
        <label>Zugang (Token)</label><input id="eTok" type="password">
        <div class="knopfleiste"><button class="knopf" id="eOk">Speichern</button></div>
      </details>
    </div>`;
  $('#eOk').onclick = () => {
    const url = $('#eUrl').value.trim(), token = $('#eTok').value.trim();
    if (!url || !token) return;
    localStorage.setItem('rb_cfg', JSON.stringify({ url, token }));
    S.cfg = { url, token };
    laden(true);
  };
}

// ---------- Schnittstelle ----------
async function api(aktion, daten) {
  const r = await fetch(S.cfg.url, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: S.cfg.token, aktion, quelle: 'App', daten: daten || {} })
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.fehler || 'Unbekannter Fehler');
  return j;
}

async function laden(zeigeFehler) {
  const btn = $('#btnSync');
  btn.classList.add('dreht');
  try {
    const j = await api('daten');
    S.d = aufbereiten(j.daten);
    try { localStorage.setItem('rb_daten', JSON.stringify(j.daten)); } catch (e) { /* zu groß */ }
    zeichnen();
  } catch (e) {
    if (String(e.message).includes('Token')) { einrichtungZeigen('Zugang ungültig – bitte neu einrichten.'); }
    else if (zeigeFehler || !S.d) toast('Laden fehlgeschlagen: ' + e.message);
  } finally {
    btn.classList.remove('dreht');
  }
}

// ---------- Daten aufbereiten ----------
const zahl = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
const dat = v => (v ? new Date(v) : null);

function aufbereiten(d) {
  const V = d.verkaeufe.map(r => ({
    datum: dat(r[0]), plattform: r[1], konto: r[2], bestellnr: String(r[3]), artikel: String(r[4]), kaeufer: r[5],
    vk: zahl(r[6]) || 0, versand: zahl(r[7]) || 0, gebuehren: zahl(r[8]), porto: zahl(r[9]), erstattet: zahl(r[10]) || 0,
    ek: zahl(r[11]), gewinn: typeof r[12] === 'number' ? r[12] : null, gewinnText: typeof r[12] === 'string' ? r[12] : '',
    sendung: String(r[13] || ''), status: String(r[14] || ''), hinweis: r[16], monat: String(r[17] || ''), id: r[18],
    versender: r[19], artikelIds: r[20], ekQuelle: r[21], privat: r[24] === 'ja'
  })).filter(v => v.id && v.datum);
  const E = d.einkaeufe.map(r => ({
    nr: r[0], datum: dat(r[1]), haendler: r[2], shop: r[3], bestellnr: r[4], zahlungsart: r[5], positionen: r[6],
    warenwert: zahl(r[7]) || 0, versand: zahl(r[8]) || 0, gesamt: zahl(r[9]) || 0, beleg: r[10], notiz: r[11],
    quelle: r[13], status: r[14]
  }));
  const B = d.bestand.map(r => ({
    id: r[0], nr: r[1], datum: dat(r[2]), produkt: String(r[3]), kategorie: r[4], details: r[5], suchbegriff: r[6],
    menge: zahl(r[7]) || 0, ekStueck: zahl(r[8]) || 0, ekGesamt: zahl(r[9]) || 0, verkauft: zahl(r[10]) || 0,
    rest: zahl(r[11]) || 0, status: r[12], lagerort: r[13], notiz: r[14], marktwert: zahl(r[15])
  }));
  const A = d.ausgaben.map(r => ({
    nr: r[0], datum: dat(r[1]), kategorie: r[2], beschreibung: r[3], haendler: r[4], betrag: zahl(r[5]) || 0,
    zahlungsart: r[6], beleg: r[7], notiz: r[8], quelle: r[10], status: r[11]
  }));
  const Z = d.zuordnung.map(r => ({ verkaufId: r[0], artikelId: r[1], menge: zahl(r[2]) || 0, ek: zahl(r[3]) || 0, art: r[4] }));
  const e = d.einstellungen;
  return { V, E, B, A, Z, e, buchAb: dat(e.buchhaltungAb) || new Date(2026, 11, 1), stand: dat(d.stand),
    privatGeprueft: new Set(d.privatGeprueft || []) };
}

// ---------- Formatierung ----------
const eur = n => (n === null || n === undefined) ? '–' : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const dt = d => d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
const iso = d => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = n => Math.round(n * 100) / 100;
const umsatzVon = v => v.vk + v.versand - v.erstattet;
// „aktiv“ = zählt für die Buchhaltung: nicht storniert und nicht als privat markiert (Reiter „Privat prüfen“)
const aktiv = v => v.status !== 'Storniert' && !v.privat;
const gueltig = x => x.status !== 'Storniert';
const monatName = m => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

function trackingUrl(nr, versender) {
  const v = String(versender || '').toUpperCase(), n = encodeURIComponent(nr);
  if (/HERMES/.test(v)) return 'https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation#' + n;
  if (/DPD/.test(v)) return 'https://tracking.dpd.de/status/de_DE/parcel/' + n;
  if (/GLS/.test(v)) return 'https://gls-group.com/DE/de/paketverfolgung?match=' + n;
  return 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=' + n;
}

function toast(t) {
  const el = $('#toast');
  el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3500);
}

function dialog(html, init) {
  const d = $('#dialog'), b = $('#dialogBox');
  b.innerHTML = html; d.hidden = false;
  d.onclick = e => { if (e.target === d) dialogZu(); };
  if (init) init(b);
}
function dialogZu() { $('#dialog').hidden = true; $('#dialogBox').innerHTML = ''; }

// ---------- Navigation ----------
function zeichnen() {
  if (!S.d) return;
  $('#stand').textContent = (S.d.e.letzteAktualisierung ? 'Stand ' + new Date(S.d.e.letzteAktualisierung).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · ' : '') + 'App v' + APP_VERSION;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('aktiv', b.dataset.seite === S.seite));
  const erl = erledigtListe(), pakete = zuVersenden().filter(v => !erl[v.id]).length;
  $('#navPakete').hidden = !pakete; $('#navPakete').textContent = pakete;
  ({ start: seiteStart, verkaeufe: seiteVerkaeufe, einkauf: seiteEinkauf, bestand: seiteBestand, ausgaben: seiteAusgaben,
    berichte: seiteBerichte, auswertung: seiteAuswertung, versand: seiteVersand, steuer: seiteSteuer })[S.seite]();
  window.scrollTo(0, 0);
}

// ---------- Kennzahlen ----------
function jahresZahlen(jahr) {
  const V = S.d.V.filter(v => v.datum.getFullYear() === jahr && aktiv(v));
  const umsatz = V.reduce((s, v) => s + umsatzVon(v), 0) + (jahr === new Date().getFullYear() ? (S.d.e.sonstigerUmsatz || 0) : 0);
  const gewinn = V.reduce((s, v) => s + (v.gewinn || 0), 0);
  const offen = V.filter(v => v.gewinn === null).length;
  const start = new Date(jahr, 0, 1), heute = new Date();
  const ende = heute.getFullYear() === jahr ? heute : new Date(jahr, 11, 31);
  const tage = Math.max(1, Math.round((ende - start) / 864e5) + 1);
  const jahrTage = Math.round((new Date(jahr, 11, 31) - start) / 864e5) + 1;
  return { V, umsatz: r2(umsatz), gewinn: r2(gewinn), offen, tage, hochrechnung: r2(umsatz / tage * jahrTage) };
}

// ---------- Monatsbudget: Ziel = jedes Jahr unter der Kleinunternehmer-Grenze (25.000 €) bleiben ----------
const jahresZiel = () => S.d.e.grenzeVorjahr || 25000;
const monatsBudget = () => r2(jahresZiel() / 12);
const umsatzMonat = key => r2(S.d.V.filter(v => aktiv(v) && v.monat === key).reduce((s, v) => s + umsatzVon(v), 0));
function budgetStand() {
  const heute = new Date(), j = heute.getFullYear(), mi = heute.getMonth();
  const key = j + '-' + String(mi + 1).padStart(2, '0');
  const vorher = S.d.V.filter(v => aktiv(v) && v.datum.getFullYear() === j && v.monat < key).reduce((s, v) => s + umsatzVon(v), 0) + (S.d.e.sonstigerUmsatz || 0);
  const monat = umsatzMonat(key);
  const restJahr = r2(jahresZiel() - vorher - monat);
  const drin = r2(Math.max(0, Math.min(monatsBudget(), (jahresZiel() - vorher) / (12 - mi))));   // was diesen Monat realistisch passt
  const st = restJahr < 0 ? ['krit', '⛔', 'Jahresgrenze überschritten'] : monat > drin ? ['krit', '⚠', 'Zu viel diesen Monat']
    : monat > drin * 0.8 ? ['warn', '⚠', 'Knapp'] : ['gut', '✓', 'Passt'];
  return { key, monat, budget: monatsBudget(), drin, restJahr, restMonate: 12 - mi, st };
}
function budgetKarte() {
  const b = budgetStand(), p = b.drin ? Math.min(100, b.monat / b.drin * 100) : 100;
  const farbe = { gut: 'var(--gut)', warn: 'var(--warn)', krit: 'var(--krit)' }[b.st[0]];
  return `<div class="karte klickbar" onclick="grenzeDialog()" title="Verlauf Monat für Monat">
    <div class="karte-kopf"><h3>Monatsbudget ${new Date().toLocaleDateString('de-DE', { month: 'long' })}</h3><span class="status ${b.st[0]}">${b.st[1]} ${b.st[2]}</span></div>
    <div style="font-size:22px;font-weight:800">${eur(b.monat)} <span class="leise" style="font-size:14px;font-weight:600">von ${eur(b.drin)}</span></div>
    <div class="hb-bahn" style="margin:8px 0"><div style="width:${p}%;background:${farbe}"></div></div>
    <div class="klein">Bis 31.12. noch frei: <b>${eur(Math.max(0, b.restJahr))}</b>${b.restJahr < 0 ? ` <span class="chip rot">${eur(-b.restJahr)} drüber</span>` : ''}</div>
    <div class="klein leise">Normal ${eur(b.budget)} pro Monat (${eur(jahresZiel())} ÷ 12)${b.drin < b.budget ? ' – wegen der Vormonate diesen Monat nur ' + eur(b.drin) : ''}.</div>
  </div>`;
}
const budgetLegende = () => `<div class="klein leise" style="margin-top:6px"><span style="display:inline-block;width:18px;border-top:2px dashed var(--text-2);vertical-align:middle"></span> Monatsbudget ${eur(monatsBudget())}
  &nbsp; <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--krit);vertical-align:middle"></span> Monat über Budget</div>`;

const ohneEk = () => S.d.V.filter(v => v.datum >= S.d.buchAb && aktiv(v) && v.status !== 'Unbezahlt' && v.ek === null)
  .sort((a, b) => b.datum - a.datum);
const imBestand = () => S.d.B.filter(b => b.rest > 0 && !['Storniert', 'Privat', 'Verkauft'].includes(b.status));

// ---------- Diagramme (Farben: geprüfte Referenzpalette, Rollen über CSS-Variablen) ----------
const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const eurKurz = n => n >= 1000 ? (n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' T€' : Math.round(n) + ' €';
const rundeHoch = n => { if (n <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(n))); return Math.ceil(n / p * 2) / 2 * p; };

function monatsWerte(jahr) {
  return MONATE_KURZ.map((m, i) => {
    const key = jahr + '-' + String(i + 1).padStart(2, '0');
    const V = S.d.V.filter(v => v.monat === key && aktiv(v));
    return { m, key, umsatz: r2(V.reduce((s, v) => s + umsatzVon(v), 0)), gewinn: r2(V.reduce((s, v) => s + (v.gewinn || 0), 0)),
      n: V.length, offen: V.filter(v => v.gewinn === null).length };
  });
}

// Säulendiagramm (eine Reihe). D = [{ label, wert, tipp, blass }]; beiKlick(i) optional.
let DIA_NR = 0;
function saeulen(D, beiKlick, titel, linie) {
  const id = 'dia' + (++DIA_NR);
  const n = D.length, max = rundeHoch(Math.max(linie || 0, ...D.map(d => d.wert)));
  const W = 640, H = 230, L = 46, R = 6, T = 10, B = 26, ph = H - T - B, bw = (W - L - R) / n, bb = Math.min(30, bw * 0.66);
  const y = v => T + ph - v / max * ph;
  const gitter = [0, max / 2, max].map(v => `<line class="gitter" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="achse" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${eurKurz(v)}</text>`).join('');
  const zeigLabel = i => n <= 14 || i === 0 || (i + 1) % 5 === 0 || i === n - 1;
  const s = D.map((d, i) => {
    const x = L + i * bw + (bw - bb) / 2, h = Math.max(0, ph - (y(d.wert) - T)), r = Math.min(4, h, bb / 2), top = T + ph - h;
    const pfad = h > 0 ? `M${x},${T + ph} V${top + r} Q${x},${top} ${x + r},${top} H${x + bb - r} Q${x + bb},${top} ${x + bb},${top + r} V${T + ph} Z` : '';
    return `<g data-i="${i}" class="${beiKlick ? 'klickbar' : ''}"><rect class="treffer" x="${L + i * bw}" y="${T}" width="${bw}" height="${ph + B}"/>
      ${pfad ? `<path class="balken ${d.blass ? 'blass' : ''} ${linie && d.wert > linie ? 'ueber' : ''}" d="${pfad}"/>` : ''}
      ${zeigLabel(i) ? `<text class="achse" x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${d.label}</text>` : ''}</g>`;
  }).join('');
  const budget = linie ? `<line class="budgetlinie" x1="${L}" x2="${W - R}" y1="${y(linie)}" y2="${y(linie)}"/>` : '';
  return { html: `<div class="diagramm" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titel || 'Diagramm')}">${gitter}${s}${budget}</svg><div class="tipp" hidden></div></div>`,
    verbinden: () => {
      const box = document.getElementById(id); if (!box) return;
      const tipp = $('.tipp', box), svg = $('svg', box);
      box.querySelectorAll('g[data-i]').forEach(g => {
        const i = Number(g.dataset.i), d = D[i];
        g.addEventListener('mouseenter', () => {
          box.querySelectorAll('g.aktiv').forEach(x => x.classList.remove('aktiv')); g.classList.add('aktiv');
          tipp.innerHTML = d.tipp + (beiKlick ? '<br><span style="opacity:.7">Klicken für Details</span>' : '');
          const rs = svg.getBoundingClientRect(), rb = box.getBoundingClientRect();
          tipp.style.left = Math.min(rb.width - 80, Math.max(80, (L + i * bw + bw / 2) / W * rs.width)) + 'px';
          tipp.style.top = (y(d.wert) / H * rs.height) + 'px';
          tipp.hidden = false;
        });
        if (beiKlick) g.addEventListener('click', () => beiKlick(i));
      });
      box.addEventListener('mouseleave', () => { tipp.hidden = true; box.querySelectorAll('g.aktiv').forEach(x => x.classList.remove('aktiv')); });
    } };
}

const tippMonat = (titel, V) => {
  const u = V.reduce((s, v) => s + umsatzVon(v), 0), g = V.reduce((s, v) => s + (v.gewinn || 0), 0), o = V.filter(v => v.gewinn === null).length;
  return `<b>${titel}</b><br>Umsatz ${eur(r2(u))}<br>Gewinn ${eur(r2(g))}${o ? ` <span style="opacity:.7">(${o} offen)</span>` : ''}<br>${V.length} Verkäufe`;
};

// Umsatz pro Monat eines Jahres; markierte Monate kräftig, Rest blass. Klick → Auswertung des Monats
function monatsDiagramm(jahr, markiert) {
  const D = MONATE_KURZ.map((m, i) => {
    const key = jahr + '-' + String(i + 1).padStart(2, '0');
    const V = S.d.V.filter(v => v.monat === key && aktiv(v));
    const wert = r2(V.reduce((s, v) => s + umsatzVon(v), 0)), b = monatsBudget();
    const budgetText = wert > b ? `<br><span style="color:var(--krit)">⚠ ${eur(r2(wert - b))} über Monatsbudget</span>` : V.length ? `<br>✓ im Monatsbudget (${eur(b)})` : '';
    return { key, label: m, wert, tipp: tippMonat(monatName(key), V) + budgetText,
      blass: markiert && markiert.length && !markiert.includes(key) };
  });
  return saeulen(D, i => auswertung({ jahr, monate: [D[i].key] }), 'Umsatz pro Monat ' + jahr, monatsBudget());
}

// Umsatz pro Tag eines Monats
function tagesDiagramm(key) {
  const j = Number(key.slice(0, 4)), m = Number(key.slice(5, 7)) - 1, tage = new Date(j, m + 1, 0).getDate();
  const D = [];
  for (let t = 1; t <= tage; t++) {
    const V = S.d.V.filter(v => aktiv(v) && v.monat === key && v.datum.getDate() === t);
    D.push({ label: String(t), wert: r2(V.reduce((s, v) => s + umsatzVon(v), 0)), tipp: tippMonat(t + '. ' + monatName(key), V) });
  }
  return saeulen(D, null, 'Umsatz pro Tag ' + monatName(key));
}

// Farbe folgt dem Konto (feste Reihenfolge nach Namen), nie dem Rang
const kontoName = v => v.plattform + ' · ' + v.konto;
function kontoFarben() {
  const namen = [...new Set(S.d.V.map(kontoName))].sort();
  const f = {}; namen.forEach((n, i) => { f[n] = i < 4 ? `var(--s${i + 1})` : 'var(--leise)'; });
  return f;
}

// Balken je Konto – Klick filtert (Funktion beiKlick bekommt den Kontonamen)
function kontoBalken(V, aktivesKonto) {
  const farbe = kontoFarben(), proKonto = {};
  V.forEach(v => { const k = kontoName(v); const p = proKonto[k] || (proKonto[k] = { u: 0, n: 0, g: 0 }); p.u += umsatzVon(v); p.n++; p.g += v.gewinn || 0; });
  const L = Object.entries(proKonto).sort((a, b) => b[1].u - a[1].u);
  const max = Math.max(1, ...L.map(x => x[1].u));
  return L.length ? `<div class="hbalken">${L.map(([k, p]) => `<div class="hb-zeile klickbar ${aktivesKonto && aktivesKonto !== k ? 'blass' : ''}" data-konto="${esc(k)}" title="Nur ${esc(k)} anzeigen">
      <div class="hb-name"><span class="punkt" style="background:${farbe[k]}"></span>${esc(k)}</div>
      <div class="hb-wert">${eur(r2(p.u))} <span class="leise klein">· ${p.n}</span></div>
      <div class="hb-bahn"><div style="width:${p.u / max * 100}%;background:${farbe[k]}"></div></div></div>`).join('')}</div>`
    : '<div class="leer">Keine Verkäufe.</div>';
}

function grenzeRing(k) {
  const g = S.d.e.grenzeVorjahr || 25000;
  const p = k.hochrechnung / g * 100;
  const st = p >= 100 ? ['krit', '⛔', 'Über der Grenze'] : p >= 80 ? ['warn', '⚠', 'Knapp – aufpassen'] : ['gut', '✓', 'Im grünen Bereich'];
  const farbe = { gut: 'var(--gut)', warn: 'var(--warn)', krit: 'var(--krit)' }[st[0]];
  const U = 2 * Math.PI * 46, voll = Math.min(100, p) / 100 * U;
  return `<div class="ring klickbar" onclick="grenzeDialog()" title="Details zur Grenze"><svg viewBox="0 0 112 112" role="img" aria-label="Hochrechnung ${Math.round(p)} Prozent der Grenze">
      <circle cx="56" cy="56" r="46" fill="none" stroke="var(--flaeche-2)" stroke-width="11"/>
      <circle cx="56" cy="56" r="46" fill="none" stroke="${farbe}" stroke-width="11" stroke-linecap="round"
        stroke-dasharray="${voll} ${U}" transform="rotate(-90 56 56)"/>
      <text x="56" y="62" text-anchor="middle" style="font-size:20px;font-weight:800;fill:var(--text)">${Math.round(p)}%</text></svg>
    <div><span class="status ${st[0]}">${st[1]} ${st[2]}</span>
      <div class="klein" style="margin-top:8px">Hochrechnung bis 31.12.: <b>${eur(k.hochrechnung)}</b></div>
      <div class="klein leise">Grenze ${eur(g)} · bisher ${eur(k.umsatz)}</div>
      <div class="klein" style="margin-top:4px;color:var(--akzent)">Details ›</div></div></div>`;
}

// Erklärung der Grenze + Verlauf Monat für Monat
function grenzeDialog() {
  const j = new Date().getFullYear(), k = jahresZahlen(j), g = S.d.e.grenzeVorjahr || 25000, gl = S.d.e.grenzeLaufend || 100000;
  let summe = S.d.e.sonstigerUmsatz || 0;
  const zeilen = MONATE_KURZ.map((m, i) => {
    const key = j + '-' + String(i + 1).padStart(2, '0');
    const u = S.d.V.filter(v => v.monat === key && aktiv(v)).reduce((s, v) => s + umsatzVon(v), 0);
    summe += u;
    return i <= new Date().getMonth() ? `<tr><td>${monatName(key)}</td><td>${eur(r2(u))}</td><td>${eur(r2(summe))}</td><td>${Math.round(summe / g * 100)} %</td></tr>` : '';
  }).join('');
  dialog(`<h2 style="margin-top:0">Kleinunternehmer-Grenze ${j}</h2>
    <div class="klein">Zählt: gewerblicher Umsatz aller Konten (Preis + Versand, abzüglich Erstattungen)${S.d.e.sonstigerUmsatz ? ' plus sonstiger Umsatz' : ''}. Als privat markierte Verkäufe (Reiter „Privat prüfen“ in der Tabelle) zählen nicht mit. Monatsbudget: ${eur(monatsBudget())}.</div>
    <div class="tabelle-scroll" style="margin-top:10px"><table><tr><th>Monat</th><th>Umsatz</th><th>Summe</th><th>Grenze</th></tr>${zeilen}</table></div>
    <div class="hinweis klein"><b>Die Regeln (§19 UStG):</b><br>
      • Über <b>${eur(g)}</b> in diesem Jahr → <b>nächstes Jahr</b> keine Kleinunternehmerregelung.<br>
      • Über <b>${eur(gl)}</b> im laufenden Jahr → <b>sofort</b> umsatzsteuerpflichtig.<br>
      Hochrechnung: bisher ${eur(k.umsatz)} in ${k.tage} Tagen → <b>${eur(k.hochrechnung)}</b> bis 31.12.
      Bei 80 % bekommst du automatisch eine Mail. Kein Ersatz für Steuerberatung.</div>
    <div class="knopfleiste"><button class="knopf" onclick="dialogZu()">Schließen</button></div>`);
}
window.grenzeDialog = grenzeDialog;

// ---------- Seite: Start ----------
function seiteStart() {
  const j = S.jahr = new Date().getFullYear();
  const k = jahresZahlen(j);
  const offen = ohneEk();
  const lager = imBestand();
  const kapital = lager.reduce((s, b) => s + b.rest * b.ekStueck, 0);
  const monat = iso().slice(0, 7);
  const km = S.d.V.filter(v => v.monat === monat && aktiv(v));
  const erlV = erledigtListe(), versenden = zuVersenden().filter(v => !erlV[v.id]);
  const gebuehren = k.V.reduce((s, v) => s + (v.gebuehren || 0), 0);
  const zuletzt = S.d.V.slice().sort((a, b) => b.datum - a.datum).slice(0, 5);
  const dia = monatsDiagramm(j);
  const marktwert = lager.reduce((s, b) => s + b.rest * (marktwertVon(b) || b.ekStueck), 0);
  const alt = ladenhueter();
  inhalt().innerHTML = `
    <div class="hero">
      <div class="klickbar" onclick="auswertung({jahr:${j},monate:[]})" title="Auswertung öffnen">
        <div class="label">Umsatz ${j} · gewerblich, alle Konten ›</div>
        <div class="gross">${eur(k.umsatz)}</div>
      </div>
      <div class="reihe-h">
        <div class="pille klickbar" onclick="auswertung({jahr:${j},monate:[]})"><div class="k">Gewinn ${k.offen ? `(${k.V.length - k.offen} von ${k.V.length} mit EK)` : ''}</div><div class="w">${eur(k.gewinn)}</div></div>
        <div class="pille klickbar" onclick="auswertung({jahr:${j},monate:['${monat}']})"><div class="k">${new Date().toLocaleDateString('de-DE', { month: 'long' })} ›</div><div class="w">${eur(r2(km.reduce((s, v) => s + umsatzVon(v), 0)))}</div></div>
        <div class="pille klickbar" onclick="geheZu('verkaeufe')"><div class="k">Verkäufe ${j} ›</div><div class="w">${k.V.length}</div></div>
      </div>
    </div>
    <div class="kacheln">
      <div class="kachel klickbar ${offen.length ? 'warnung' : ''}" onclick="filterSetzen('ekfehlt')"><div class="ic">🧾</div><div class="wert">${offen.length}</div><div class="text">Einkaufspreis fehlt ›</div></div>
      <div class="kachel klickbar ${versenden.length ? 'warnung' : ''}" onclick="geheZu('versand')"><div class="ic">📮</div><div class="wert">${versenden.length}</div><div class="text">Noch versenden ›</div></div>
      <div class="kachel klickbar" onclick="geheZu('bestand')"><div class="ic">📦</div><div class="wert">${eur(r2(kapital))}</div><div class="text">Einkauf · Marktwert ${eur(r2(marktwert))} ›</div></div>
      <div class="kachel klickbar" onclick="auswertung({jahr:${j},monate:[]})"><div class="ic">💸</div><div class="wert">${eur(r2(gebuehren))}</div><div class="text">Gebühren ${j} ›</div></div>
    </div>
    <div class="raster zwei">
      <div class="karte"><div class="karte-kopf"><h3>Umsatz pro Monat</h3><span class="leise klein">${j}</span></div>${dia.html}${budgetLegende()}</div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${budgetKarte()}
        <div class="karte"><div class="karte-kopf"><h3>Kleinunternehmer-Grenze</h3></div>${grenzeRing(k)}</div>
        <div class="karte"><div class="karte-kopf"><h3>Umsatz nach Konto</h3><span class="leise klein">${j}</span></div>${kontoBalken(k.V)}</div>
      </div>
    </div>
    <div class="schnell keindruck">
      <button onclick="geheZu('einkauf')"><b>🛒 Einkauf erfassen</b><span>mit Beleg-Foto</span></button>
      <button onclick="ausgabeDialog()"><b>🧾 Ausgabe erfassen</b><span>Versandmaterial, Abo …</span></button>
    </div>
    ${alt.length ? `<h2>⏳ Ladenhüter <span class="chip gelb">${alt.length}</span></h2>
      <p class="leise klein" style="margin-top:-6px">Länger als ${LADENHUETER_TAGE} Tage im Bestand – Kapital frei machen?</p>
      <div class="liste">${alt.slice(0, 4).map(zeileBestand).join('')}</div>
      ${alt.length > 4 ? `<p class="klein"><a href="#" onclick="S.filter.b={suche:'',alle:false,nur:'alt'};geheZu('bestand');return false">Alle ${alt.length} Ladenhüter →</a></p>` : ''}` : ''}
    ${offen.length ? `<h2>Einkaufspreis fehlt</h2><div class="liste">${offen.slice(0, 5).map(zeileVerkauf).join('')}</div>
      ${offen.length > 5 ? `<p class="leise klein"><a href="#" onclick="filterSetzen('ekfehlt');return false">Alle ${offen.length} anzeigen →</a></p>` : ''}` : ''}
    <h2>Zuletzt verkauft</h2>
    <div class="liste">${zuletzt.map(zeileVerkauf).join('') || '<div class="leer">Noch keine Verkäufe.</div>'}</div>
    ${S.d.e.fehler && S.d.e.fehler !== '–' ? `<div class="hinweis klein">Letzter Abruf meldet: ${esc(S.d.e.fehler)}</div>` : ''}`;
  dia.verbinden();
  document.querySelectorAll('[data-konto]').forEach(z => z.onclick = () => auswertung({ jahr: j, monate: [], konto: z.dataset.konto }));
  aktionenVerbinden();
}

function filterSetzen(nur) { S.filter.v = { suche: '', monat: '', plattform: '', konto: '', nur }; geheZu('verkaeufe'); }
window.filterSetzen = filterSetzen;

// ---------- Verkäufe ----------
function zeileVerkauf(v) {
  const fehlt = v.ek === null && aktiv(v) && v.datum >= S.d.buchAb && v.status !== 'Unbezahlt';
  const gew = v.gewinn !== null ? `<span class="gewinn ${v.gewinn >= 0 ? 'plus' : 'minus'}">${v.gewinn >= 0 ? '+' : ''}${eur(v.gewinn)}</span>`
    : (aktiv(v) ? `<span class="chip gelb">${esc(v.gewinnText || 'offen')}</span>` : '');
  const cm = v.plattform === 'Cardmarket';
  return `<div class="eintrag klickbar ${fehlt ? 'offen' : ''}" data-verkauf="${esc(v.id)}">
    <div class="avatar ${cm ? 'av-cm' : 'av-eb'}">${cm ? 'CM' : 'eB'}</div>
    <div class="haupt" title="${esc(v.artikel)}">${esc(v.artikel)}</div><div class="rechts">${eur(umsatzVon(v))}</div>
    <div class="unter"><span>${dt(v.datum)} · ${esc(v.konto)}</span>${gew}${v.privat ? '<span class="chip" title="Zählt nicht zum Umsatz">🏠 privat</span>' : ''}
      <span class="chip ${v.status === 'Storniert' ? 'rot' : /Angekommen|Versendet/.test(v.status) ? 'gruen' : ''}">${esc(v.status)}</span>
      ${v.sendung ? `<a href="${trackingUrl(v.sendung, v.versender)}" target="_blank" rel="noopener">📦 Sendung</a>` : ''}</div>
    ${aktiv(v) ? `<div class="aktionen keindruck">
      <span class="chip">Gebühr ${eur(v.gebuehren)}</span><span class="chip">Porto ${eur(v.porto)}</span><span class="chip">EK ${eur(v.ek)}</span>
      <button class="knopf klein ${fehlt ? '' : 'zwei'}" data-zuordnen="${esc(v.id)}">${v.ek === null ? 'Einkauf zuordnen' : 'EK ändern'}</button>
      ${v.porto === null ? `<button class="knopf klein zwei" data-porto="${esc(v.id)}">Porto</button>` : ''}
    </div>` : ''}
  </div>`;
}

function seiteVerkaeufe() {
  const f = S.filter.v || (S.filter.v = { suche: '', monat: '', plattform: '', konto: '', nur: '' });
  const konten = [...new Set(S.d.V.map(kontoName))].sort();
  const monate = [...new Set(S.d.V.map(v => v.monat))].filter(Boolean).sort().reverse();
  let L = S.d.V.slice().sort((a, b) => b.datum - a.datum);
  if (f.monat) L = L.filter(v => v.monat === f.monat);
  if (f.plattform) L = L.filter(v => v.plattform === f.plattform);
  if (f.konto) L = L.filter(v => kontoName(v) === f.konto);
  if (f.nur === 'ekfehlt') L = L.filter(v => v.ek === null && aktiv(v) && v.status !== 'Unbezahlt');
  if (f.nur === 'versenden') L = L.filter(v => /versenden|Bezahlt$/.test(v.status));
  if (f.nur === 'privat') L = L.filter(v => v.privat);
  if (f.suche) { const s = f.suche.toLowerCase(); L = L.filter(v => (v.artikel + ' ' + v.kaeufer + ' ' + v.bestellnr).toLowerCase().includes(s)); }
  const summe = L.filter(aktiv).reduce((s, v) => s + umsatzVon(v), 0);
  inhalt().innerHTML = `
    <h1>Verkäufe</h1>
    <div class="filter keindruck">
      <input id="fSuche" placeholder="Suchen …" value="${esc(f.suche)}">
      <select id="fMonat"><option value="">Alle Monate</option>${monate.map(m => `<option value="${m}" ${m === f.monat ? 'selected' : ''}>${monatName(m)}</option>`).join('')}</select>
      <select id="fPlatt"><option value="">Alle Plattformen</option>${['eBay', 'Cardmarket'].map(p => `<option ${p === f.plattform ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <select id="fKonto"><option value="">Alle Konten</option>${konten.map(k => `<option ${k === f.konto ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
      <select id="fNur"><option value="">Alle</option><option value="ekfehlt" ${f.nur === 'ekfehlt' ? 'selected' : ''}>EK fehlt</option><option value="versenden" ${f.nur === 'versenden' ? 'selected' : ''}>Noch versenden</option><option value="privat" ${f.nur === 'privat' ? 'selected' : ''}>Nur privat</option></select>
    </div>
    <p class="leise klein">${L.length} Verkäufe · gewerblicher Umsatz ${eur(r2(summe))}${L.some(v => v.privat) ? ` · privat ${eur(r2(L.filter(v => v.privat && v.status !== 'Storniert').reduce((s, v) => s + umsatzVon(v), 0)))} (zählt nicht)` : ''}</p>
    <div class="liste">${L.slice(0, 200).map(zeileVerkauf).join('') || '<div class="leer">Keine Verkäufe gefunden.</div>'}</div>`;
  const neu = () => { f.suche = $('#fSuche').value; f.monat = $('#fMonat').value; f.plattform = $('#fPlatt').value; f.konto = $('#fKonto').value; f.nur = $('#fNur').value; seiteVerkaeufe(); };
  ['#fMonat', '#fPlatt', '#fKonto', '#fNur'].forEach(s => $(s).onchange = neu);
  $('#fSuche').onchange = neu;
  aktionenVerbinden();
}

function aktionenVerbinden() {
  document.querySelectorAll('[data-verkauf]').forEach(k => k.onclick = e => {
    if (e.target.closest('button, a, input, label')) return;
    verkaufDialog(k.dataset.verkauf);
  });
  document.querySelectorAll('[data-zuordnen]').forEach(b => b.onclick = () => zuordnenDialog(b.dataset.zuordnen));
  document.querySelectorAll('[data-porto]').forEach(b => b.onclick = () => portoDialog(b.dataset.porto));
  document.querySelectorAll('[data-artikel]').forEach(b => b.onclick = () => artikelDialog(b.dataset.artikel));
}

// Ähnlichkeit Verkaufstitel ↔ Bestand (für Vorschläge)
function aehnlich(a, b) {
  const w = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9äöüß ]/g, ' ').split(/\s+/).filter(x => x.length > 2));
  const A = w(a), B = w(b);
  let n = 0; A.forEach(x => { if (B.has(x)) n++; });
  return n / Math.max(1, Math.min(A.size, B.size));
}

function zuordnenDialog(id) {
  const v = S.d.V.find(x => x.id === id);
  const m = v.artikel.match(/^(\d+)x /);
  const mengeVor = m ? Number(m[1]) : 1;
  const zug = S.d.Z.filter(z => z.verkaufId === id && z.menge > 0);
  const kandidaten = imBestand().map(b => ({ b, s: aehnlich(v.artikel, b.produkt + ' ' + (b.suchbegriff || '')) }))
    .sort((x, y) => y.s - x.s || x.b.datum - y.b.datum);
  let gewaehlt = null;
  dialog(`
    <h2 style="margin-top:0">Einkauf zuordnen</h2>
    <div class="klein"><b>${esc(v.artikel)}</b><br>${dt(v.datum)} · ${esc(v.plattform)} · ${eur(umsatzVon(v))}</div>
    ${zug.length ? `<div class="hinweis klein">Zugeordnet: ${zug.map(z => z.menge + '× ' + esc(z.artikelId) + ' (' + eur(z.ek) + ')').join(', ')}
      <button class="knopf klein rot" id="zLoesch" style="margin-left:6px">Entfernen</button></div>` : ''}
    <label>Aus dem Bestand wählen</label>
    <input id="zSuche" placeholder="Bestand durchsuchen …">
    <div class="auswahl" id="zListe"></div>
    <div class="reihe"><div><label>Menge</label><input id="zMenge" type="number" min="1" value="${mengeVor}"></div><div></div></div>
    <div class="knopfleiste">
      <button class="knopf" id="zOk" disabled>Zuordnen</button>
      <button class="knopf zwei" id="zManuell">EK direkt eingeben</button>
      <button class="knopf zwei" onclick="dialogZu()">Abbrechen</button>
    </div>`, box => {
    const liste = s => {
      const q = (s || '').toLowerCase();
      const L = kandidaten.filter(k => !q || (k.b.produkt + ' ' + k.b.id + ' ' + (k.b.suchbegriff || '')).toLowerCase().includes(q)).slice(0, 30);
      $('#zListe', box).innerHTML = L.map(k => `<button data-id="${esc(k.b.id)}"><b>${esc(k.b.produkt)}</b><br>
        <span class="klein leise">${esc(k.b.id)} · ${dt(k.b.datum)} · EK ${eur(k.b.ekStueck)}/Stk · noch ${k.b.rest}</span></button>`).join('')
        || '<div class="leise klein">Nichts im Bestand. Erst Einkauf erfassen – oder EK direkt eingeben.</div>';
      box.querySelectorAll('#zListe button').forEach(b => b.onclick = () => {
        gewaehlt = b.dataset.id;
        box.querySelectorAll('#zListe button').forEach(x => x.classList.toggle('gewaehlt', x === b));
        $('#zOk', box).disabled = false;
      });
    };
    liste('');
    $('#zSuche', box).oninput = e => liste(e.target.value);
    $('#zOk', box).onclick = () => speichern('zuordnen', { verkaufId: id, artikelId: gewaehlt, menge: Number($('#zMenge', box).value) || 1 }, 'Zugeordnet');
    $('#zManuell', box).onclick = () => {
      const wert = prompt('Einkaufspreis (gesamt) für diesen Verkauf in €:', v.ek !== null ? String(v.ek).replace('.', ',') : '');
      if (wert !== null) speichern('ekManuell', { verkaufId: id, ek: wert }, 'Einkaufspreis gespeichert');
    };
    const l = $('#zLoesch', box);
    if (l) l.onclick = () => speichern('zuordnungLoeschen', { verkaufId: id }, 'Zuordnung entfernt');
  });
}

function portoDialog(id) {
  const wert = prompt('Porto (was du selbst bezahlt hast) in €:', '');
  if (wert !== null && wert.trim() !== '') speichern('portoSetzen', { verkaufId: id, porto: wert }, 'Porto gespeichert');
}

async function speichern(aktion, daten, meldung) {
  try {
    document.body.style.cursor = 'progress';
    const r = await api(aktion, daten);
    dialogZu();
    toast(meldung + (r.ergebnis && r.ergebnis.belegNr ? ': ' + r.ergebnis.belegNr : ''));
    await laden();
    return r;
  } catch (e) {
    toast('Fehler: ' + e.message);
    throw e;
  } finally {
    document.body.style.cursor = '';
  }
}

// ---------- Einkauf erfassen ----------
const KATEGORIEN = ['TCG / Sammelkarten', 'Spielzeug / LEGO', 'Konsolen', 'Elektronik', 'Sneaker', 'Fashion / Sonstiges'];
const ZAHLUNG = ['PayPal', 'Karte', 'Überweisung', 'Bar', 'Klarna', 'eBay-Guthaben', 'Cardmarket-Guthaben', 'Sonstiges'];

function positionHtml(i) {
  return `<div class="position" data-pos="${i}">
    <label>Produkt</label><input class="pProdukt" placeholder="z. B. Pokémon 151 Booster Display (DE)">
    <div class="reihe3">
      <div><label>Kategorie</label><select class="pKat">${KATEGORIEN.map(k => `<option>${k}</option>`).join('')}</select></div>
      <div><label>Menge</label><input class="pMenge" type="number" min="1" value="1" inputmode="numeric"></div>
      <div><label>Preis/Stück €</label><input class="pPreis" inputmode="decimal" placeholder="0,00"></div>
    </div>
    <label>Suchbegriff für automatische Zuordnung <span class="leise">(optional, z. B. „151C Booster Box“)</span></label>
    <input class="pSuch">
  </div>`;
}

function seiteEinkauf() {
  const E = S.d.E.slice().sort((a, b) => b.datum - a.datum);
  inhalt().innerHTML = `
    <div class="titelzeile"><h1 id="eTitel">Einkauf erfassen</h1>
      <button class="knopf zwei klein keindruck" onclick="geheZu('ausgaben')">🧾 Ausgaben ›</button></div>
    <div class="karte" id="eForm">
      <div class="reihe">
        <div><label>Datum</label><input id="eDatum" type="date" value="${iso()}"></div>
        <div><label>Zahlungsart</label><select id="eZahl">${ZAHLUNG.map(z => `<option>${z}</option>`).join('')}</select></div>
      </div>
      <div class="reihe">
        <div><label>Händler / Verkäufer</label><input id="eHaendler" placeholder="z. B. Smyths, eBay-Verkäufer …"></div>
        <div><label>Shop / Plattform</label><input id="eShop" placeholder="Laden, Amazon, eBay, Cardmarket …"></div>
      </div>
      <div class="reihe">
        <div><label>Bestellnr. (optional)</label><input id="eBest"></div>
        <div><label>Versand €</label><input id="eVersand" inputmode="decimal" placeholder="0,00"></div>
      </div>
      <div id="ePos">${positionHtml(0)}</div>
      <button class="knopf zwei klein" id="ePlus" style="margin-top:8px">+ weitere Position</button>
      <label>Beleg (Foto oder PDF)</label>
      <input id="eBeleg" type="file" accept="image/*,application/pdf">
      <label>Notiz</label><input id="eNotiz">
      <div class="summe"><span>Gesamt</span><span id="eSumme">0,00 €</span></div>
      <div class="knopfleiste"><button class="knopf" id="eSpeichern">Einkauf speichern</button></div>
    </div>
    <h2>Letzte Einkäufe</h2>
    <div class="liste">${E.slice(0, 30).map(e => `<div class="eintrag">
      <div class="avatar av-ek">EK</div>
      <div class="haupt" title="${esc(e.positionen)}">${esc(e.positionen)}</div><div class="rechts">${eur(e.gesamt)}</div>
      <div class="unter"><span>${esc(e.nr)}</span><span>${dt(e.datum)}</span><span>${esc(e.haendler)}</span><span>${esc(e.zahlungsart)}</span>
      ${e.beleg ? `<a href="${esc(e.beleg)}" target="_blank" rel="noopener">Beleg</a>` : '<span class="chip gelb">kein Beleg</span>'}
      ${e.status === 'Storniert' ? '<span class="chip rot">Storniert</span>' : ''}</div></div>`).join('') || '<div class="leer">Noch keine Einkäufe.</div>'}</div>`;
  let n = 1;
  const summe = () => {
    let s = zahlEin($('#eVersand').value);
    document.querySelectorAll('#ePos .position').forEach(p => { s += zahlEin($('.pPreis', p).value) * (Number($('.pMenge', p).value) || 1); });
    $('#eSumme').textContent = eur(r2(s));
  };
  $('#ePlus').onclick = () => { $('#ePos').insertAdjacentHTML('beforeend', positionHtml(n++)); };
  $('#inhalt').oninput = e => { if (e.target.closest('#ePos') || e.target.id === 'eVersand') summe(); };
  $('#eSpeichern').onclick = async () => {
    const pos = [...document.querySelectorAll('#ePos .position')].map(p => ({
      produkt: $('.pProdukt', p).value.trim(), kategorie: $('.pKat', p).value, menge: Number($('.pMenge', p).value) || 1,
      preisStueck: zahlEin($('.pPreis', p).value), suchbegriff: $('.pSuch', p).value.trim()
    })).filter(p => p.produkt);
    if (!pos.length) return toast('Bitte mindestens ein Produkt eintragen.');
    if (pos.some(p => !p.preisStueck)) return toast('Bitte bei jeder Position einen Preis eintragen.');
    const btn = $('#eSpeichern'); btn.disabled = true; btn.textContent = 'Speichere …';
    try {
      const beleg = await belegLesen($('#eBeleg').files[0]);
      await speichern('einkaufNeu', {
        datum: $('#eDatum').value, haendler: $('#eHaendler').value.trim(), shop: $('#eShop').value.trim(),
        bestellnr: $('#eBest').value.trim(), zahlungsart: $('#eZahl').value, versand: zahlEin($('#eVersand').value),
        notiz: $('#eNotiz').value.trim(), positionen: pos, beleg
      }, 'Einkauf gespeichert');
    } catch (e) { btn.disabled = false; btn.textContent = 'Einkauf speichern'; }
  };
}

function zahlEin(s) {
  s = String(s || '').replace(/[€\s]/g, '');
  if (!s) return 0;
  const n = /,\d{1,2}$/.test(s) ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s.replace(/,/g, ''));
  return isNaN(n) ? 0 : r2(n);
}

// Foto verkleinern (spart Speicher und Zeit), PDF unverändert
async function belegLesen(datei) {
  if (!datei) return null;
  const b64 = blob => new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = err; r.readAsDataURL(blob); });
  if (datei.type === 'application/pdf') {
    if (datei.size > 15e6) throw new Error('PDF zu groß (max. 15 MB)');
    return { name: datei.name, mime: datei.type, base64: await b64(datei) };
  }
  try {
    const bild = await createImageBitmap(datei);
    const max = 2000, f = Math.min(1, max / Math.max(bild.width, bild.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bild.width * f); c.height = Math.round(bild.height * f);
    c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
    return { name: datei.name.replace(/\.\w+$/, '') + '.jpg', mime: 'image/jpeg', base64: await b64(blob) };
  } catch (e) {
    return { name: datei.name, mime: datei.type || 'application/octet-stream', base64: await b64(datei) };
  }
}

// ---------- Bestand ----------
function zeileBestand(b) {
  const tage = tageIm(b), mw = marktwertVon(b);
  const plus = mw ? r2((mw - b.ekStueck) * b.rest) : null;
  const alt = tage > LADENHUETER_TAGE && b.rest > 0;
  const tipp = alt ? (mw ? `Tipp: für ca. ${eur(r2(Math.max(b.ekStueck * 1.05, mw * 0.92)))} anbieten – Kapital frei machen` : 'Tipp: Marktwert eintragen und Preis prüfen') : '';
  return `<div class="eintrag ${alt ? 'offen' : ''}">
    <div class="avatar av-be">${b.rest}</div>
    <div class="haupt" title="${esc(b.produkt)}">${esc(b.produkt)}</div><div class="rechts">${eur(r2(b.rest * b.ekStueck))}</div>
    <div class="unter"><span>${b.rest} von ${b.menge} · EK ${eur(b.ekStueck)}/Stk</span>
      ${mw ? `<span>Markt ${eur(mw)}/Stk <b class="${plus >= 0 ? 'plus' : 'minus'}">${plus >= 0 ? '+' : ''}${eur(plus)}</b></span>` : '<span class="chip">Marktwert fehlt</span>'}
      <span class="chip ${alt ? 'gelb' : ''}">${tage} Tage</span><span class="chip">${esc(b.status)}</span>
      ${b.suchbegriff ? `<span>🔎 ${esc(b.suchbegriff)}</span>` : ''}</div>
    ${tipp ? `<div class="unter" style="grid-column:2/4"><span class="warn">💡 ${tipp}</span></div>` : ''}
    <div class="aktionen keindruck"><button class="knopf klein zwei" data-sku="${esc(b.id)}" title="Als SKU ins eBay-Angebot eintragen – dann wird der Verkauf automatisch zugeordnet">📋 SKU ${esc(b.id)}</button>
      <button class="knopf klein zwei" data-artikel="${esc(b.id)}">Bearbeiten</button></div>
  </div>`;
}

function seiteBestand() {
  const f = S.filter.b || (S.filter.b = { suche: '', alle: false, nur: '' });
  let L = (f.alle ? S.d.B : f.nur === 'alt' ? ladenhueter() : imBestand()).slice().sort((a, b) => (a.datum || 0) - (b.datum || 0));
  if (f.suche) { const s = f.suche.toLowerCase(); L = L.filter(b => (b.produkt + ' ' + b.id + ' ' + (b.suchbegriff || '')).toLowerCase().includes(s)); }
  const wert = L.reduce((s, b) => s + b.rest * b.ekStueck, 0);
  const markt = L.reduce((s, b) => s + b.rest * (marktwertVon(b) || b.ekStueck), 0);
  const stueck = L.reduce((s, b) => s + b.rest, 0);
  inhalt().innerHTML = `
    <h1>Bestand</h1>
    <div class="hero" style="padding:18px 20px">
      <div class="label">Warenwert (Einkauf)</div>
      <div class="gross" style="font-size:34px">${eur(r2(wert))}</div>
      <div class="reihe-h">
        <div class="pille"><div class="k">Marktwert</div><div class="w">${eur(r2(markt))}</div></div>
        <div class="pille"><div class="k">möglicher Gewinn</div><div class="w">${eur(r2(markt - wert))}</div></div>
        <div class="pille"><div class="k">Stück</div><div class="w">${stueck}</div></div>
      </div>
    </div>
    <div class="filter keindruck" style="margin-top:14px">
      <input id="bSuche" placeholder="Suchen …" value="${esc(f.suche)}">
      <select id="bAlle"><option value="">Nur vorhandene</option><option value="alt" ${f.nur === 'alt' ? 'selected' : ''}>Nur Ladenhüter (&gt; ${LADENHUETER_TAGE} Tage)</option><option value="alle" ${f.alle ? 'selected' : ''}>Alle (auch verkauft)</option></select>
    </div>
    <p class="leise klein">${L.length} Positionen. Tipp: Trag die Artikel-ID als <b>SKU</b> in dein eBay-Angebot ein – dann wird der Verkauf automatisch zugeordnet.</p>
    <div class="liste">${L.map(zeileBestand).join('') || '<div class="leer">Kein Bestand. Einkäufe erscheinen hier automatisch.</div>'}</div>`;
  $('#bSuche').onchange = e => { f.suche = e.target.value; seiteBestand(); };
  $('#bAlle').onchange = e => { f.alle = e.target.value === 'alle'; f.nur = e.target.value === 'alt' ? 'alt' : ''; seiteBestand(); };
  document.querySelectorAll('[data-sku]').forEach(b => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.sku); toast('SKU kopiert: ' + b.dataset.sku + ' – bei eBay ins Feld „SKU“ einfügen'); }
    catch (e) { toast('SKU: ' + b.dataset.sku); }
  });
  aktionenVerbinden();
}

function artikelDialog(id) {
  const b = S.d.B.find(x => x.id === id);
  const st = S.d.e.bestandStatus || ['Bestellt', 'Auf Lager', 'Gelistet', 'Verkauft', 'Privat', 'Defekt', 'Retoure'];
  dialog(`<h2 style="margin-top:0">${esc(b.produkt)}</h2>
    <div class="klein leise">${esc(b.id)} · gekauft ${dt(b.datum)} · ${b.menge} Stk · EK ${eur(b.ekStueck)}/Stk · verkauft ${b.verkauft}</div>
    <label>Produkt</label><input id="aProd" value="${esc(b.produkt)}">
    <label>Suchbegriff (automatische Zuordnung)</label><input id="aSuch" value="${esc(b.suchbegriff)}">
    <div class="reihe"><div><label>Status</label><select id="aStat">${st.map(s => `<option ${s === b.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div><label>Lagerort</label><input id="aOrt" value="${esc(b.lagerort)}"></div></div>
    <div class="reihe"><div><label>Marktwert pro Stück €</label><input id="aMarkt" inputmode="decimal" value="${marktwertVon(b) !== null ? String(marktwertVon(b)).replace('.', ',') : ''}" placeholder="z. B. 120,00"></div>
      <div><label>&nbsp;</label><a class="knopf zwei klein" style="display:inline-block" target="_blank" rel="noopener"
        href="https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(b.produkt.replace(/[–()]/g, ' '))}&LH_Sold=1&LH_Complete=1">eBay: verkaufte Preise ansehen</a></div></div>
    <label>Notiz</label><input id="aNotiz" value="${esc(b.notiz)}">
    <div class="knopfleiste"><button class="knopf" id="aOk">Speichern</button><button class="knopf zwei" onclick="dialogZu()">Abbrechen</button></div>`,
  box => {
    $('#aOk', box).onclick = () => speichern('artikelAendern', { artikelId: id, felder: {
      produkt: $('#aProd', box).value, suchbegriff: $('#aSuch', box).value, status: $('#aStat', box).value,
      lagerort: $('#aOrt', box).value, notiz: $('#aNotiz', box).value, marktwert: $('#aMarkt', box).value } }, 'Gespeichert');
  });
}

// ---------- Ausgaben ----------
function seiteAusgaben() {
  const A = S.d.A.slice().sort((a, b) => b.datum - a.datum);
  const jahr = new Date().getFullYear();
  const summe = A.filter(a => gueltig(a) && a.datum && a.datum.getFullYear() === jahr).reduce((s, a) => s + a.betrag, 0);
  inhalt().innerHTML = `
    <h1>Ausgaben</h1>
    <p class="leise klein">Alles, was keine Ware ist: Versandmaterial, Abos, Software, Porto ohne Bestellung … · ${jahr}: ${eur(r2(summe))}</p>
    <div class="knopfleiste keindruck" style="margin:0 0 12px"><button class="knopf" onclick="ausgabeDialog()">+ Ausgabe erfassen</button></div>
    <div class="liste">${A.map(a => `<div class="eintrag">
      <div class="avatar av-au">A</div>
      <div class="haupt">${esc(a.beschreibung || a.kategorie)}</div><div class="rechts">${eur(a.betrag)}</div>
      <div class="unter"><span>${esc(a.nr)}</span><span>${dt(a.datum)}</span><span>${esc(a.kategorie)}</span><span>${esc(a.haendler)}</span>
      ${a.beleg ? `<a href="${esc(a.beleg)}" target="_blank" rel="noopener">Beleg</a>` : '<span class="chip gelb">kein Beleg</span>'}
      ${a.status === 'Storniert' ? '<span class="chip rot">Storniert</span>' : ''}</div></div>`).join('') || '<div class="leer">Noch keine Ausgaben.</div>'}</div>`;
}

function ausgabeDialog(vor) {
  vor = vor || {};
  const kat = S.d.e.ausgabeKategorien || ['Versandmaterial', 'Sonstiges'];
  dialog(`<h2 style="margin-top:0">Ausgabe erfassen</h2>
    <div class="reihe"><div><label>Datum</label><input id="aDat" type="date" value="${vor.datum || iso()}"></div>
      <div><label>Betrag €</label><input id="aBet" inputmode="decimal" placeholder="0,00" value="${vor.betrag !== null && vor.betrag !== undefined ? String(vor.betrag).replace('.', ',') : ''}"></div></div>
    <label>Kategorie</label><select id="aKat">${kat.map(k => `<option ${k === vor.kategorie ? 'selected' : ''}>${k}</option>`).join('')}</select>
    <label>Beschreibung</label><input id="aBes" placeholder="z. B. 100 Luftpolsterumschläge" value="${esc(vor.beschreibung || '')}">
    <div class="reihe"><div><label>Händler</label><input id="aHae" value="${esc(vor.haendler || '')}"></div>
      <div><label>Zahlungsart</label><select id="aZahl">${ZAHLUNG.map(z => `<option>${z}</option>`).join('')}</select></div></div>
    <label>Beleg (Foto oder PDF)</label><input id="aBel" type="file" accept="image/*,application/pdf">
    <div class="knopfleiste"><button class="knopf" id="aSp">Speichern</button><button class="knopf zwei" onclick="dialogZu()">Abbrechen</button></div>`,
  box => {
    $('#aSp', box).onclick = async () => {
      const betrag = zahlEin($('#aBet', box).value);
      if (!betrag) return toast('Bitte Betrag eintragen.');
      $('#aSp', box).disabled = true;
      try {
        await speichern('ausgabeNeu', { datum: $('#aDat', box).value, betrag, kategorie: $('#aKat', box).value,
          beschreibung: $('#aBes', box).value.trim(), haendler: $('#aHae', box).value.trim(), zahlungsart: $('#aZahl', box).value,
          beleg: await belegLesen($('#aBel', box).files[0]) }, 'Ausgabe gespeichert');
      } catch (e) { $('#aSp', box).disabled = false; }
    };
  });
}

// ---------- Berichte & Finanzamt ----------
function euer(jahr) {
  const V = S.d.V.filter(v => v.datum.getFullYear() === jahr && aktiv(v));
  const einnahmen = V.reduce((s, v) => s + umsatzVon(v), 0);
  const ware = S.d.E.filter(e => gueltig(e) && e.datum && e.datum.getFullYear() === jahr).reduce((s, e) => s + e.gesamt, 0);
  const gebuehren = V.reduce((s, v) => s + (v.gebuehren || 0), 0);
  const porto = V.reduce((s, v) => s + (v.porto || 0), 0);
  const sonst = {};
  S.d.A.filter(a => gueltig(a) && a.datum && a.datum.getFullYear() === jahr).forEach(a => { sonst[a.kategorie] = (sonst[a.kategorie] || 0) + a.betrag; });
  const ausgaben = ware + gebuehren + porto + Object.values(sonst).reduce((s, x) => s + x, 0);
  return { jahr, einnahmen: r2(einnahmen), ware: r2(ware), gebuehren: r2(gebuehren), porto: r2(porto), sonst, ausgaben: r2(ausgaben), ergebnis: r2(einnahmen - ausgaben) };
}

function monatsZeilen(jahr) {
  const zeilen = [];
  for (let m = 1; m <= 12; m++) {
    const key = jahr + '-' + String(m).padStart(2, '0');
    const V = S.d.V.filter(v => v.monat === key && aktiv(v));
    const ek = S.d.E.filter(e => gueltig(e) && e.datum && iso(e.datum).slice(0, 7) === key).reduce((s, e) => s + e.gesamt, 0);
    const aus = S.d.A.filter(a => gueltig(a) && a.datum && iso(a.datum).slice(0, 7) === key).reduce((s, a) => s + a.betrag, 0);
    if (!V.length && !ek && !aus) continue;
    zeilen.push({ key, anzahl: V.length, umsatz: r2(V.reduce((s, v) => s + umsatzVon(v), 0)),
      gebuehren: r2(V.reduce((s, v) => s + (v.gebuehren || 0), 0)), porto: r2(V.reduce((s, v) => s + (v.porto || 0), 0)),
      gewinn: r2(V.reduce((s, v) => s + (v.gewinn || 0), 0)), offen: V.filter(v => v.gewinn === null).length,
      einkauf: r2(ek), ausgaben: r2(aus) });
  }
  return zeilen;
}

function seiteBerichte() {
  const jahre = [...new Set(S.d.V.map(v => v.datum.getFullYear()).concat(S.d.E.filter(e => e.datum).map(e => e.datum.getFullYear()), [new Date().getFullYear()]))].sort().reverse();
  const j = S.jahr;
  const M = monatsZeilen(j);
  const e = euer(j);
  const k = jahresZahlen(j);
  const sum = f => r2(M.reduce((s, x) => s + x[f], 0));
  const dia = monatsDiagramm(j);
  const PJ = S.d.V.filter(v => v.privat && v.status !== 'Storniert' && v.datum.getFullYear() === j);
  const privatJahr = { n: PJ.length, summe: r2(PJ.reduce((s, v) => s + umsatzVon(v), 0)) };
  inhalt().innerHTML = `
    <h1>Berichte</h1>
    <div class="filter keindruck"><div class="segment">${jahre.map(x => `<button data-jahr="${x}" class="${x === j ? 'aktiv' : ''}">${x}</button>`).join('')}</div></div>
    <div class="hero" style="padding:18px 20px">
      <div class="label">Ergebnis ${j} fürs Finanzamt (EÜR)</div>
      <div class="gross" style="font-size:32px">${eur(e.ergebnis)}</div>
      <div class="reihe-h">
        <div class="pille"><div class="k">Einnahmen</div><div class="w">${eur(e.einnahmen)}</div></div>
        <div class="pille"><div class="k">Ausgaben</div><div class="w">${eur(e.ausgaben)}</div></div>
        <div class="pille"><div class="k">Gewinn pro Verkauf</div><div class="w">${eur(k.gewinn)}</div></div>
      </div>
    </div>
    <div class="raster zwei">
      <div class="karte"><div class="karte-kopf"><h3>Umsatz pro Monat</h3></div>${dia.html}${budgetLegende()}</div>
      <div class="karte"><div class="karte-kopf"><h3>Umsatz nach Konto</h3></div>${kontoBalken(k.V)}</div>
    </div>
    <div class="karte klickbar keindruck" style="margin-top:14px;display:flex;gap:14px;align-items:center" onclick="S.steuerJahr=${j};geheZu('steuer')">
      <div style="font-size:28px">🧾</div>
      <div style="flex:1"><b>Steuererklärung ${j} vorbereiten ›</b>
        <div class="klein leise">Checkliste, was noch fehlt, und welche Zahl in welches ELSTER-Feld gehört.</div></div>
    </div>
    ${privatJahr.n ? `<div class="hinweis klein">🏠 <b>${privatJahr.n} Verkäufe ${j} als privat markiert</b> (${eur(privatJahr.summe)}) – zählen nicht zu Umsatz, Grenze und EÜR.
      <a href="#" onclick="S.filter.v={suche:'',monat:'',plattform:'',konto:'',nur:'privat'};geheZu('verkaeufe');return false">Anzeigen ›</a></div>` : ''}

    <h2>Monate ${j}</h2>
    <div class="karte tabelle-scroll"><table>
      <tr><th>Monat</th><th>Verk.</th><th>Umsatz</th><th>Budget</th><th>Gebühren</th><th>Porto</th><th>Gewinn</th><th>Einkauf</th><th>Ausgaben</th></tr>
      ${M.map(x => `<tr class="klickbar" data-mk="${x.key}" title="Monat öffnen"><td>${monatName(x.key)} ›</td><td>${x.anzahl}</td><td>${eur(x.umsatz)}</td>
        <td>${x.umsatz > monatsBudget() ? `<span class="chip rot">⚠ +${eur(r2(x.umsatz - monatsBudget()))}</span>` : `<span class="chip gruen">✓ passt</span>`}</td><td>${eur(x.gebuehren)}</td><td>${eur(x.porto)}</td>
        <td class="${x.gewinn >= 0 ? 'plus' : 'minus'}">${eur(x.gewinn)}${x.offen ? ` <span class="chip gelb">${x.offen} offen</span>` : ''}</td><td>${eur(x.einkauf)}</td><td>${eur(x.ausgaben)}</td></tr>`).join('')}
      <tr class="gesamt"><td>Gesamt</td><td>${M.reduce((s, x) => s + x.anzahl, 0)}</td><td>${eur(sum('umsatz'))}</td><td>${sum('umsatz') > jahresZiel() ? `<span class="chip rot">⚠ über ${eur(jahresZiel())}</span>` : `<span class="chip gruen">✓ unter ${eur(jahresZiel())}</span>`}</td><td>${eur(sum('gebuehren'))}</td><td>${eur(sum('porto'))}</td><td>${eur(sum('gewinn'))}</td><td>${eur(sum('einkauf'))}</td><td>${eur(sum('ausgaben'))}</td></tr>
    </table></div>
    <p class="leise klein">„Gewinn“ = pro Verkauf (Preis + Versand − Gebühren − Porto − Einkaufspreis). „Offen“ = Einkaufspreis oder Porto fehlt. „Budget“ = Monatsziel ${eur(monatsBudget())} (${eur(jahresZiel())} ÷ 12). Zeile antippen = Monat öffnen.</p>

    <h2>Was lohnt sich? Nach Produktart ${j}</h2>
    <div class="karte tabelle-scroll"><table>
      <tr><th>Produktart</th><th>Verk.</th><th>Umsatz</th><th>Ø Preis</th><th>Gewinn</th><th>Marge</th></tr>
      ${produktarten(k.V).map(p => `<tr><td>${esc(p.art)}</td><td>${p.n}</td><td>${eur(p.u)}</td><td>${eur(r2(p.u / p.n))}</td>
        <td>${p.ok ? eur(p.g) + (p.ok < p.n ? ` <span class="chip gelb">${p.n - p.ok} offen</span>` : '') : '–'}</td>
        <td>${p.ok && p.uOk ? Math.round(p.g / p.uOk * 100) + ' %' : '–'}</td></tr>`).join('')}
    </table></div>
    <p class="leise klein">Marge nur aus Verkäufen mit Einkaufspreis. Je mehr Einkäufe zugeordnet sind, desto genauer.</p>


    <h2>Fürs Finanzamt: Einnahmen-Überschuss-Rechnung ${j}</h2>
    <div class="karte tabelle-scroll"><table>
      <tr><td>Betriebseinnahmen (Verkäufe inkl. Versand, abzgl. Erstattungen)</td><td>${eur(e.einnahmen)}</td></tr>
      <tr><td>Wareneinkauf</td><td>− ${eur(e.ware)}</td></tr>
      <tr><td>Verkaufsgebühren (eBay, Cardmarket)</td><td>− ${eur(e.gebuehren)}</td></tr>
      <tr><td>Porto / Versandetiketten</td><td>− ${eur(e.porto)}</td></tr>
      ${Object.entries(e.sonst).map(([kat, b]) => `<tr><td>${esc(kat)}</td><td>− ${eur(r2(b))}</td></tr>`).join('')}
      <tr class="gesamt"><td>Ergebnis (Gewinn / Verlust)</td><td class="${e.ergebnis >= 0 ? 'plus' : 'minus'}">${eur(e.ergebnis)}</td></tr>
    </table></div>
    <div class="hinweis klein">Kleinunternehmer (§19 UStG): keine Umsatzsteuer. Wareneinkauf zählt im Jahr der Zahlung.
      ${j === 2026 ? `<br>2026: Einkäufe vor dem ${dt(S.d.buchAb)} fehlen noch, solange sie nicht nachgetragen sind – das Ergebnis ist dann zu hoch.` : ''}
      <br>Vorbereitung für die Steuererklärung (Anlage EÜR) – ersetzt keine Steuerberatung.</div>
    <div class="karte keindruck" style="margin-top:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:220px"><b>📦 Jahresabschluss-Paket ${j}</b>
        <div class="klein leise">Eine ZIP-Datei mit EÜR, Verkäufen, Einkäufen, Ausgaben, Bestandsliste und allen Belegen – für ELSTER oder Steuerberater.</div></div>
      <button class="knopf" id="xJ">Paket erstellen</button>
    </div>
    <div class="knopfleiste keindruck">
      <button class="knopf zwei" id="xV">Verkäufe als CSV</button>
      <button class="knopf zwei" id="xE">Einkäufe als CSV</button>
      <button class="knopf zwei" id="xA">Ausgaben als CSV</button>
      <button class="knopf zwei" id="xU">EÜR als CSV</button>
      <button class="knopf zwei" onclick="window.print()">Drucken / PDF</button>
    </div>`;
  document.querySelectorAll('[data-jahr]').forEach(b => b.onclick = () => { S.jahr = Number(b.dataset.jahr); seiteBerichte(); });
  document.querySelectorAll('[data-mk]').forEach(r => r.onclick = () => auswertung({ jahr: j, monate: [r.dataset.mk] }));
  document.querySelectorAll('[data-konto]').forEach(z => z.onclick = () => auswertung({ jahr: j, monate: [], konto: z.dataset.konto }));
  dia.verbinden();
  const jahrFilter = x => x.datum && x.datum.getFullYear() === j;
  const z = n => (n === null || n === undefined) ? '' : String(n).replace('.', ',');
  $('#xV').onclick = () => csv('Verkaeufe_' + j, ['Datum', 'Plattform', 'Konto', 'Bestellnr', 'Artikel', 'Käufer', 'Verkaufspreis', 'Versand', 'Gebühren', 'Porto', 'Erstattet', 'Einkaufspreis', 'Gewinn', 'Status', 'Sendungsnummer', 'Privat (nicht im Umsatz)'],
    S.d.V.filter(jahrFilter).sort((a, b) => a.datum - b.datum).map(v => [dt(v.datum), v.plattform, v.konto, v.bestellnr, v.artikel, v.kaeufer, z(v.vk), z(v.versand), z(v.gebuehren), z(v.porto), z(v.erstattet), z(v.ek), z(v.gewinn), v.status, v.sendung, v.privat ? 'ja' : '']));
  $('#xE').onclick = () => csv('Einkaeufe_' + j, ['Beleg-Nr', 'Datum', 'Händler', 'Shop', 'Bestellnr', 'Zahlungsart', 'Positionen', 'Warenwert', 'Versand', 'Gesamt', 'Beleg', 'Status'],
    S.d.E.filter(jahrFilter).sort((a, b) => a.datum - b.datum).map(e => [e.nr, dt(e.datum), e.haendler, e.shop, e.bestellnr, e.zahlungsart, e.positionen, z(e.warenwert), z(e.versand), z(e.gesamt), e.beleg, e.status]));
  $('#xA').onclick = () => csv('Ausgaben_' + j, ['Beleg-Nr', 'Datum', 'Kategorie', 'Beschreibung', 'Händler', 'Betrag', 'Zahlungsart', 'Beleg', 'Status'],
    S.d.A.filter(jahrFilter).sort((a, b) => a.datum - b.datum).map(a => [a.nr, dt(a.datum), a.kategorie, a.beschreibung, a.haendler, z(a.betrag), a.zahlungsart, a.beleg, a.status]));
  $('#xU').onclick = () => csv('EUER_' + j, ['Posten', 'Betrag'], [['Betriebseinnahmen', z(e.einnahmen)], ['Wareneinkauf', z(-e.ware)], ['Verkaufsgebühren', z(-e.gebuehren)],
    ['Porto / Versandetiketten', z(-e.porto)]].concat(Object.entries(e.sonst).map(([kat, b]) => [kat, z(-r2(b))]), [['Ergebnis', z(e.ergebnis)]]));
  $('#xJ').onclick = async () => {
    const btn = $('#xJ'); btn.disabled = true; btn.textContent = 'Erstelle … (bis 1 Min.)';
    const neu = (name, kopf, zeilen) => ({ name, text: csvText(kopf, zeilen) });
    const fang = [];
    window.__sammeln = (name, kopf, zeilen) => fang.push(neu(name + '.csv', kopf, zeilen));
    ['#xV', '#xE', '#xA', '#xU'].forEach(s => $(s).onclick());
    window.__sammeln = null;
    fang.push(neu('Bestand_Stand_' + iso() + '.csv', ['Artikel-ID', 'Beleg-Nr', 'Kaufdatum', 'Produkt', 'Menge', 'Rest', 'EK/Stück', 'Restwert EK', 'Marktwert/Stück', 'Status'],
      S.d.B.filter(b => b.rest > 0 && !['Storniert', 'Privat'].includes(b.status)).map(b => [b.id, b.nr, dt(b.datum), b.produkt, b.menge, b.rest, z(b.ekStueck), z(r2(b.rest * b.ekStueck)), z(marktwertVon(b)), b.status])));
    try {
      const r = await api('jahresabschluss', { jahr: j, dateien: fang });
      const g = r.ergebnis;
      dialog(`<h2 style="margin-top:0">📦 Jahresabschluss ${j} fertig</h2>
        <p>${g.dateien} Dateien in einer ZIP – davon ${g.belege} Belege${g.fehlend ? ` (${g.fehlend} Belege nicht gefunden)` : ''}.</p>
        <p class="klein leise">Liegt in Google Drive im Ordner „Buchhaltung – Belege/${j}“.</p>
        <div class="knopfleiste"><a class="knopf" href="${esc(g.link)}" target="_blank" rel="noopener">In Drive öffnen / herunterladen</a>
        <button class="knopf zwei" onclick="dialogZu()">Schließen</button></div>`);
    } catch (e) { toast('Fehler: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Paket erstellen';
  };
}

// Nach Produktart (aus dem Verkaufstitel erkannt)
function produktarten(V) {
  const g = {};
  V.forEach(v => { const a = produktart(v.artikel); const p = g[a] || (g[a] = { art: a, n: 0, u: 0, g: 0, ok: 0, uOk: 0 });
    p.n++; p.u += umsatzVon(v); if (v.gewinn !== null) { p.ok++; p.g += v.gewinn; p.uOk += umsatzVon(v); } });
  return Object.values(g).map(p => Object.assign(p, { u: r2(p.u), g: r2(p.g) })).sort((a, b) => b.u - a.u);
}

function csvText(kopf, zeilen) {
  const zelle = x => { const s = String(x === null || x === undefined ? '' : x); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [kopf].concat(zeilen).map(r => r.map(zelle).join(';')).join('\r\n');
}

function csv(name, kopf, zeilen) {
  if (window.__sammeln) return window.__sammeln(name, kopf, zeilen);
  const text = '﻿' + csvText(kopf, zeilen);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Hilfen: Marktwert, Ladenhüter, Produktart ----------
const LADENHUETER_TAGE = 45;
const marktwertVon = b => {
  if (b.marktwert) return b.marktwert;
  const m = String(b.details || '').match(/Marktpreis[^:]*:\s*([\d.,]+)/);
  return m ? zahlEin(m[1]) : null;
};
const tageIm = b => b.datum ? Math.floor((Date.now() - b.datum) / 864e5) : 0;
const ladenhueter = () => imBestand().filter(b => tageIm(b) > LADENHUETER_TAGE).sort((a, b) => tageIm(b) - tageIm(a));
function produktart(titel) {
  const t = String(titel).toLowerCase();
  if (/display|booster ?box|boosterbox|36 booster|surprise box/.test(t)) return 'Display / Booster-Box';
  if (/elite trainer|top.?trainer|\betb\b/.test(t)) return 'Top-Trainer-Box';
  if (/bundle/.test(t)) return 'Booster-Bundle';
  if (/kollektion|collection|tin\b|blister|premium/.test(t)) return 'Kollektion / Tin';
  if (/booster|pack/.test(t)) return 'Booster';
  if (/\) - [^-]+ - (german|english|japanese|deutsch|englisch|japanisch|french|italian|spanish|korean|s-chinese|t-chinese)/.test(t) || /- (nm|ex|gd|lp|mt)\b/.test(t)) return 'Einzelkarte';
  if (/tonie|controller|lego|blind box|figur|spielzeug|legami/.test(t)) return 'Sonstige Ware';
  return 'Sonstiges';
}

// ---------- Auswertung: Jahr + frei wählbare Monate (+ optional Konto) ----------
function auswertung(opts) { S.aus = Object.assign({ jahr: new Date().getFullYear(), monate: [], konto: '' }, opts || {}); geheZu('auswertung'); }
window.auswertung = auswertung;

function seiteAuswertung() {
  const a = S.aus || (S.aus = { jahr: new Date().getFullYear(), monate: [], konto: '' });
  const jahre = [...new Set(S.d.V.map(v => v.datum.getFullYear()).concat([new Date().getFullYear()]))].sort().reverse();
  const keys = MONATE_KURZ.map((m, i) => a.jahr + '-' + String(i + 1).padStart(2, '0'));
  const sel = a.monate.length ? a.monate : keys;
  const VJ = S.d.V.filter(v => aktiv(v) && v.datum.getFullYear() === a.jahr && sel.includes(v.monat));
  const V = VJ.filter(v => !a.konto || kontoName(v) === a.konto).sort((x, y) => y.datum - x.datum);
  const summe = f => r2(V.reduce((s, v) => s + (f(v) || 0), 0));
  const umsatz = summe(umsatzVon), gewinn = summe(v => v.gewinn), geb = summe(v => v.gebuehren), porto = summe(v => v.porto);
  const offen = V.filter(v => v.gewinn === null).length, mitEk = V.length - offen;
  const umsatzMitEk = r2(V.filter(v => v.gewinn !== null).reduce((s, v) => s + umsatzVon(v), 0));
  const titel = (a.monate.length === 0 ? 'Ganzes Jahr ' + a.jahr : a.monate.length === 1 ? monatName(a.monate[0]) : a.monate.length + ' Monate ' + a.jahr) + (a.konto ? ' · ' + a.konto : '');
  const dia = sel.length === 1 && a.monate.length === 1 ? tagesDiagramm(a.monate[0]) : monatsDiagramm(a.jahr, a.monate);
  const top = {};
  V.forEach(v => { const k = String(v.artikel).replace(/^\d+x /, '').slice(0, 70); const t = top[k] || (top[k] = { n: 0, u: 0, g: 0, ok: 0 }); t.n++; t.u += umsatzVon(v); if (v.gewinn !== null) { t.g += v.gewinn; t.ok++; } });
  const topL = Object.entries(top).sort((x, y) => y[1].u - x[1].u).slice(0, 5);
  S.portoAuswahl = { V, titel };
  inhalt().innerHTML = `
    <h1>Auswertung</h1>
    <div class="filter keindruck"><div class="segment">${jahre.map(x => `<button data-j="${x}" class="${x === a.jahr ? 'aktiv' : ''}">${x}</button>`).join('')}</div></div>
    <div class="monatswahl keindruck">
      <button data-m="" class="${a.monate.length ? '' : 'aktiv'}">Ganzes Jahr</button>
      ${keys.map((k, i) => { const hat = S.d.V.some(v => v.monat === k && aktiv(v)); return `<button data-m="${k}" class="${a.monate.includes(k) ? 'aktiv' : ''} ${hat ? '' : 'leer'}">${MONATE_KURZ[i]}</button>`; }).join('')}
    </div>
    <p class="leise klein" style="margin:-4px 0 12px">Tippe mehrere Monate an, um sie zusammenzurechnen.${a.konto ? ` Filter: <b>${esc(a.konto)}</b> <a href="#" id="kontoWeg">✕ aufheben</a>` : ''}</p>
    <div class="hero" style="padding:18px 20px">
      <div class="label">${esc(titel)}</div>
      <div class="gross" style="font-size:34px">${eur(umsatz)}</div>
      <div class="reihe-h">
        <div class="pille"><div class="k">Gewinn (${mitEk} von ${V.length} mit EK)</div><div class="w">${eur(gewinn)}</div></div>
        <div class="pille"><div class="k">Marge</div><div class="w">${umsatzMitEk ? Math.round(gewinn / umsatzMitEk * 100) + ' %' : '–'}</div></div>
        <div class="pille"><div class="k">Verkäufe</div><div class="w">${V.length}</div></div>
      </div>
    </div>
    <div class="kacheln">
      <div class="kachel"><div class="ic">💸</div><div class="wert">${eur(geb)}</div><div class="text">Gebühren (${umsatz ? Math.round(geb / umsatz * 100) : 0} %)</div></div>
      <div class="kachel klickbar" onclick="portoDialog()" title="Welche Versandprodukte?"><div class="ic">✉</div><div class="wert">${eur(porto)}</div><div class="text">Porto / Etiketten ›</div></div>
      <div class="kachel"><div class="ic">🧮</div><div class="wert">${V.length ? eur(r2(umsatz / V.length)) : '–'}</div><div class="text">Ø pro Verkauf</div></div>
      <div class="kachel klickbar ${offen ? 'warnung' : ''}" onclick="filterSetzen('ekfehlt')"><div class="ic">🧾</div><div class="wert">${offen}</div><div class="text">ohne Einkaufspreis ›</div></div>
    </div>
    <div class="raster zwei">
      <div class="karte"><div class="karte-kopf"><h3>${sel.length === 1 && a.monate.length === 1 ? 'Umsatz pro Tag' : 'Umsatz pro Monat'}</h3><span class="leise klein">Säule antippen = Monat öffnen</span></div>${dia.html}</div>
      <div class="karte"><div class="karte-kopf"><h3>Nach Konto</h3><span class="leise klein">antippen = filtern</span></div>${kontoBalken(VJ, a.konto)}</div>
    </div>
    ${topL.length ? `<h2>Top-Artikel</h2><div class="karte tabelle-scroll"><table><tr><th>Artikel</th><th>Stk</th><th>Umsatz</th><th>Gewinn</th></tr>
      ${topL.map(([k, t]) => `<tr><td style="white-space:normal">${esc(k)}</td><td>${t.n}</td><td>${eur(r2(t.u))}</td><td>${t.ok ? eur(r2(t.g)) : '–'}</td></tr>`).join('')}</table></div>` : ''}
    <h2>Verkäufe (${V.length})</h2>
    <div class="liste">${V.slice(0, 150).map(zeileVerkauf).join('') || '<div class="leer">Keine Verkäufe in dieser Auswahl.</div>'}</div>`;
  document.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { a.jahr = Number(b.dataset.j); a.monate = []; seiteAuswertung(); });
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const k = b.dataset.m;
    if (!k) a.monate = []; else a.monate = a.monate.includes(k) ? a.monate.filter(x => x !== k) : a.monate.concat(k).sort();
    seiteAuswertung();
  });
  document.querySelectorAll('[data-konto]').forEach(z => z.onclick = () => { a.konto = a.konto === z.dataset.konto ? '' : z.dataset.konto; seiteAuswertung(); });
  const kw = $('#kontoWeg'); if (kw) kw.onclick = e => { e.preventDefault(); a.konto = ''; seiteAuswertung(); };
  dia.verbinden();
  aktionenVerbinden();
}

// ---------- Verkauf im Detail ----------
function bestellLink(v) {
  return v.plattform === 'Cardmarket' ? 'https://www.cardmarket.com/de/Pokemon/Orders/' + encodeURIComponent(v.bestellnr)
    : 'https://www.ebay.de/mesh/ord/details?orderid=' + encodeURIComponent(v.bestellnr);
}
function verkaufDialog(id) {
  const v = S.d.V.find(x => x.id === id);
  if (!v) return;
  const z = S.d.Z.filter(x => x.verkaufId === id && x.menge > 0);
  const zeile = (k, w, extra) => `<tr><td>${k}</td><td>${w}${extra || ''}</td></tr>`;
  dialog(`<div style="display:flex;gap:12px;align-items:center"><div class="avatar ${v.plattform === 'Cardmarket' ? 'av-cm' : 'av-eb'}" style="grid-row:auto">${v.plattform === 'Cardmarket' ? 'CM' : 'eB'}</div>
      <div><b>${esc(v.artikel)}</b><div class="klein leise">${dt(v.datum)} · ${esc(kontoName(v))} · Käufer ${esc(v.kaeufer)}</div></div></div>
    <div class="tabelle-scroll" style="margin-top:12px"><table>
      ${zeile('Verkaufspreis', eur(v.vk))}${zeile('+ Versand vom Käufer', eur(v.versand))}
      ${v.erstattet ? zeile('− Erstattet', eur(v.erstattet)) : ''}
      ${zeile('− Gebühren', eur(v.gebuehren))}${zeile('− Porto / Etikett', eur(v.porto))}
      ${zeile('− Einkaufspreis', eur(v.ek), v.ekQuelle ? ` <span class="chip">${esc(v.ekQuelle)}</span>` : '')}
      <tr class="gesamt"><td>Gewinn</td><td class="${v.gewinn === null ? '' : v.gewinn >= 0 ? 'plus' : 'minus'}">${v.gewinn !== null ? eur(v.gewinn) : `<span class="chip gelb">${esc(v.gewinnText || 'offen')}</span>`}</td></tr>
    </table></div>
    ${z.length ? `<div class="klein" style="margin-top:8px">Aus Bestand: ${z.map(x => x.menge + '× ' + esc(x.artikelId)).join(', ')}</div>` : ''}
    <div class="klein" style="margin-top:8px">Status: <span class="chip">${esc(v.status)}</span> · Bestellnr. ${esc(v.bestellnr)}
      ${v.sendung ? ` · <a href="${trackingUrl(v.sendung, v.versender)}" target="_blank" rel="noopener">📦 Sendung verfolgen</a>` : ''}</div>
    ${v.privat ? '<div class="hinweis klein">🏠 <b>Privatverkauf</b> – zählt nicht zu Umsatz, 25.000-€-Grenze und EÜR. Ändern im Reiter „Privat prüfen“ der Tabelle.</div>'
      : (v.plattform === 'Cardmarket' || v.konto !== 'Haupt') ? '<div class="klein leise" style="margin-top:6px">Gewerblich gezählt. War das privat? Im Reiter „Privat prüfen“ der Tabelle anhaken.</div>' : ''}
    <div class="knopfleiste">
      ${aktiv(v) ? `<button class="knopf" id="vdZu">${v.ek === null ? 'Einkauf zuordnen' : 'EK ändern'}</button>
        <button class="knopf zwei" id="vdPorto">Porto ${v.porto === null ? 'eintragen' : 'ändern'}</button>` : ''}
      <a class="knopf zwei" href="${bestellLink(v)}" target="_blank" rel="noopener">Bestellung öffnen</a>
      <button class="knopf zwei" onclick="dialogZu()">Schließen</button></div>`, box => {
    const zu = $('#vdZu', box); if (zu) zu.onclick = () => zuordnenDialog(id);
    const po = $('#vdPorto', box); if (po) po.onclick = () => { dialogZu(); portoDialog(id); };
  });
}

// ---------- Versand: welche Versandprodukte wie oft? ----------
// Briefe am Etikett-Preis (Deutsche-Post-Tarife), Pakete am Versanddienst erkennen
const DP_TARIFE = { '0.95': 'Standardbrief', '1.10': 'Kompaktbrief', '1.80': 'Großbrief', '2.90': 'Maxibrief' };
function versandProdukt(v) {
  const vs = String(v.versender || ''), key = v.porto.toFixed(2);
  if (/hermes/i.test(vs)) return { dienst: 'Hermes', name: 'Hermes-Paket' };
  if (/dpd/i.test(vs)) return { dienst: 'DPD', name: 'DPD-Paket' };
  if (/dhl germany/i.test(vs)) return { dienst: 'DHL', name: 'DHL Paket / Päckchen' };
  if (DP_TARIFE[key]) return { dienst: 'Deutsche Post', name: DP_TARIFE[key] };
  if (/deutsche post/i.test(vs)) return { dienst: 'Deutsche Post', name: 'Sonstige Post-Sendung' };
  return { dienst: '', name: v.porto >= 4 ? 'Paket (Versanddienst unbekannt)' : 'Sonstige Sendung' };
}
function portoDialog() {
  const { V, titel } = S.portoAuswahl || { V: [], titel: '' };
  const mit = V.filter(v => v.porto !== null && v.porto > 0);
  const ohne = V.filter(v => v.porto === null && /Versendet|Angekommen|Teilweise/.test(v.status));
  const monate = Math.max(1, new Set(V.map(v => v.monat)).size);
  const g = {};
  mit.forEach(v => {
    const p = versandProdukt(v), k = p.name + '|' + v.porto.toFixed(2);
    const x = g[k] || (g[k] = { name: p.name, dienst: p.dienst, preis: v.porto, n: 0, s: 0 });
    x.n++; x.s += v.porto;
  });
  const reihen = Object.values(g).sort((a, b) => b.n - a.n || b.preis - a.preis);
  const summe = r2(mit.reduce((s, v) => s + v.porto, 0)), max = Math.max(1, ...reihen.map(r => r.n));
  dialog(`<h2 style="margin-top:0">✉ Versand · ${esc(titel)}</h2>
    <div class="klein">${mit.length} Sendungen mit eBay-Etikett · zusammen <b>${eur(summe)}</b>${mit.length ? ` · Ø ${eur(r2(summe / mit.length))} pro Sendung` : ''}</div>
    <div class="tabelle-scroll" style="margin-top:10px"><table>
      <tr><th>Versandprodukt</th><th>Preis</th><th>Anzahl</th>${monate > 1 ? '<th>Ø/Monat</th>' : ''}<th>Summe</th></tr>
      ${reihen.map(r => `<tr><td style="white-space:normal;min-width:170px"><b>${esc(r.name)}</b>${r.dienst && !r.name.startsWith(r.dienst) ? ` <span class="leise klein">${esc(r.dienst)}</span>` : ''}
          <div class="hb-bahn" style="height:6px;margin-top:5px"><div style="width:${r.n / max * 100}%;background:var(--s1)"></div></div></td>
        <td>${eur(r.preis)}</td><td><b>${r.n}×</b></td>${monate > 1 ? `<td>${(r.n / monate).toLocaleString('de-DE', { maximumFractionDigits: 1 })}</td>` : ''}<td>${eur(r2(r.s))}</td></tr>`).join('') || '<tr><td colspan="5" class="leise">Keine Sendungen mit eBay-Etikett in dieser Auswahl.</td></tr>'}
      ${reihen.length ? `<tr class="gesamt"><td>Gesamt</td><td></td><td>${mit.length}×</td>${monate > 1 ? `<td>${(mit.length / monate).toLocaleString('de-DE', { maximumFractionDigits: 1 })}</td>` : ''}<td>${eur(summe)}</td></tr>` : ''}
    </table></div>
    ${ohne.length ? `<div class="hinweis klein"><b>${ohne.length} weitere Sendungen ohne Etikett-Kosten</b> (${ohne.filter(v => v.plattform === 'Cardmarket').length} Cardmarket, ${ohne.filter(v => v.plattform !== 'Cardmarket').length} eBay) – mit Briefmarken oder Online-Frankierung verschickt. Diese Kosten kommen über deine Ausgaben (Kategorie „Porto (ohne Bestellung)“).</div>` : ''}
    <p class="klein leise">Briefe erkenne ich am Preis (Deutsche Post: Standardbrief 0,95 €, Kompaktbrief 1,10 €, Großbrief 1,80 €, Maxibrief 2,90 €), Pakete am Versanddienst. Andere Beträge stehen mit ihrem Preis da.</p>
    <div class="knopfleiste"><button class="knopf zwei" onclick="dialogZu()">Schließen</button></div>`);
}
window.portoDialog = portoDialog;

// ---------- Steuererklärung: Checkliste + ELSTER-Ausfüllhilfe ----------
const privatKandidat = v => v.plattform === 'Cardmarket' || (v.plattform === 'eBay' && v.konto !== 'Haupt');
function seiteSteuer() {
  const jahre = [...new Set(S.d.V.map(v => v.datum.getFullYear()))].sort().reverse();
  const j = S.steuerJahr || (new Date().getFullYear() - 1);
  const e = euer(j);
  const VJ = S.d.V.filter(v => v.datum.getFullYear() === j && v.status !== 'Storniert');
  const gew = VJ.filter(aktiv);
  const kand = VJ.filter(privatKandidat), geprueft = kand.filter(v => S.d.privatGeprueft.has(v.id)).length;
  const EJ = S.d.E.filter(x => gueltig(x) && x.datum && x.datum.getFullYear() === j);
  const AJ = S.d.A.filter(a => gueltig(a) && a.datum && a.datum.getFullYear() === j);
  const portoBelege = r2(AJ.filter(a => /Porto/i.test(a.kategorie)).reduce((s, a) => s + a.betrag, 0));
  const ohnePorto = gew.filter(v => v.porto === null && /Versendet|Angekommen|Teilweise/.test(v.status)).length;
  const ohneGeb = gew.filter(v => v.gebuehren === null).length;
  const proKonto = {}; VJ.forEach(v => { const k = kontoName(v); proKonto[k] = (proKonto[k] || 0) + 1; });
  const kontenText = Object.entries(proKonto).sort().map(([k, n]) => `${esc(k)}: ${n}`).join(' · ');
  const zweitFehlt = !VJ.some(v => v.plattform === 'eBay' && v.konto === 'Zweit');
  const punkt = (st, titel, text, knopf) => {
    const s = { gut: ['gut', '✓', 'Erledigt'], warn: ['warn', '⚠', 'Offen'], krit: ['krit', '⛔', 'Fehlt'], info: ['', 'ℹ', 'Hinweis'] }[st];
    return `<div class="eintrag" style="grid-template-columns:auto 1fr"><span class="status ${s[0]}" style="grid-row:span 2;align-self:start">${s[1]} ${s[2]}</span>
      <div class="haupt" style="white-space:normal">${titel}</div><div class="unter" style="grid-column:2">${text}${knopf ? ` ${knopf}` : ''}</div></div>`;
  };
  const gebuehrenEbay = r2(gew.filter(v => v.plattform === 'eBay').reduce((s, v) => s + (v.gebuehren || 0), 0));
  const gebuehrenCm = r2(gew.filter(v => v.plattform === 'Cardmarket').reduce((s, v) => s + (v.gebuehren || 0), 0));
  const sonstSumme = r2(Object.values(e.sonst).reduce((s, x) => s + x, 0));
  const uebrige = r2(e.gebuehren + e.porto + sonstSumme);
  inhalt().innerHTML = `
    <h1>Steuererklärung ${j}</h1>
    <div class="filter keindruck"><div class="segment">${jahre.map(x => `<button data-sj="${x}" class="${x === j ? 'aktiv' : ''}">${x}</button>`).join('')}</div></div>
    <div class="hero" style="padding:18px 20px">
      <div class="label">Gewinn ${j} laut deinen Daten (Anlage EÜR)</div>
      <div class="gross" style="font-size:32px">${eur(e.ergebnis)}</div>
      <div class="reihe-h">
        <div class="pille"><div class="k">Einnahmen</div><div class="w">${eur(e.einnahmen)}</div></div>
        <div class="pille"><div class="k">Ausgaben</div><div class="w">${eur(e.ausgaben)}</div></div>
        <div class="pille"><div class="k">davon Wareneinkauf</div><div class="w">${eur(e.ware)}</div></div>
      </div>
    </div>
    ${!EJ.length ? `<div class="hinweis"><b>⛔ Wichtig:</b> Für ${j} sind noch <b>keine Einkäufe</b> erfasst. So würdest du fast den ganzen Umsatz als Gewinn versteuern. Erst Einkäufe nachtragen, dann abgeben.</div>` : ''}

    <h2>Checkliste</h2>
    <div class="liste">
      ${punkt(zweitFehlt && j >= 2025 ? 'warn' : 'gut', `Verkäufe ${j} vollständig: ${VJ.length}`, kontenText + (zweitFehlt ? ` · <b>Vom eBay-Zweitkonto sind für ${j} keine Verkäufe da – stimmt das?</b>` : ''))}
      ${punkt(ohneGeb ? 'warn' : 'gut', 'Verkaufsgebühren', ohneGeb ? `${ohneGeb} Verkäufe ohne Gebühr` : `alle exakt von eBay/Cardmarket übernommen (${eur(e.gebuehren)})`)}
      ${punkt(!kand.length || geprueft === kand.length ? 'gut' : 'warn', 'Privat oder gewerblich entschieden', kand.length ? `${geprueft} von ${kand.length} Verkäufen (eBay-Zweitkonto + Cardmarket) entschieden – im Reiter „Privat prüfen“ der Tabelle anhaken.` : 'keine Verkäufe zu prüfen')}
      ${punkt(EJ.length ? 'gut' : 'krit', `Einkäufe ${j}`, EJ.length ? `${EJ.length} Einkäufe, zusammen ${eur(e.ware)}` : 'noch keine erfasst – Belege, Kontoauszüge oder PayPal-Liste nachtragen.', '<button class="knopf klein zwei" onclick="geheZu(\'einkauf\')">Einkauf erfassen</button>')}
      ${punkt(ohnePorto && !portoBelege ? 'warn' : 'gut', 'Porto / Versand', `eBay-Versandetiketten: ${eur(e.porto)}${portoBelege ? ` · Porto-Belege: ${eur(portoBelege)}` : ''}${ohnePorto ? ` · <b>${ohnePorto} Sendungen ohne eBay-Etikett</b> (Briefmarken, Online-Frankierung, Cardmarket) – Belege als Ausgabe „Porto (ohne Bestellung)“ erfassen.` : ''}`, ohnePorto && !portoBelege ? '<button class="knopf klein zwei" onclick="ausgabeDialog()">Ausgabe erfassen</button>' : '')}
      ${punkt(AJ.length ? 'gut' : 'warn', `Sonstige Ausgaben ${j}`, AJ.length ? `${AJ.length} Ausgaben, zusammen ${eur(sonstSumme)}` : 'noch keine – z. B. Versandmaterial, Hüllen, Toploader, Abos, Software.', '<button class="knopf klein zwei" onclick="ausgabeDialog()">Ausgabe erfassen</button>')}
      ${punkt('info', 'Brief vom Finanzamt', 'Die Frist im Brief zählt. Reicht sie nicht, kurz beim Finanzamt um Fristverlängerung bitten.')}
    </div>

    <h2>ELSTER: Anlage EÜR ${j}</h2>
    <div class="karte tabelle-scroll"><table>
      <tr><th>Feld in ELSTER (Bezeichnung)</th><th>Betrag</th></tr>
      <tr><td>Betriebseinnahmen als umsatzsteuerlicher Kleinunternehmer</td><td><b>${eur(e.einnahmen)}</b></td></tr>
      <tr class="gesamt"><td>Summe Betriebseinnahmen</td><td>${eur(e.einnahmen)}</td></tr>
      <tr><td>Waren, Rohstoffe und Hilfsstoffe einschließlich der Nebenkosten</td><td><b>${eur(e.ware)}</b></td></tr>
      <tr><td>Übrige unbeschränkt abziehbare Betriebsausgaben<div class="klein leise">Verkaufsgebühren eBay ${eur(gebuehrenEbay)} · Cardmarket ${eur(gebuehrenCm)} · Versandetiketten ${eur(e.porto)}${Object.entries(e.sonst).map(([k, b]) => ` · ${esc(k)} ${eur(r2(b))}`).join('')}</div></td><td><b>${eur(uebrige)}</b></td></tr>
      <tr class="gesamt"><td>Summe Betriebsausgaben</td><td>${eur(e.ausgaben)}</td></tr>
      <tr class="gesamt"><td>Gewinn → in die <b>Anlage G</b> übernehmen</td><td class="${e.ergebnis >= 0 ? 'plus' : 'minus'}">${eur(e.ergebnis)}</td></tr>
    </table></div>
    <p class="leise klein">Als Kleinunternehmer trägst du alle Beträge <b>brutto</b> ein (so wie bezahlt). Die Zeilennummern ändern sich je nach Formularjahr – in ELSTER einfach nach der Bezeichnung suchen.
      Werbegebühren von eBay („Anzeigen“) stecken in den Verkaufsgebühren; auf Wunsch kann man sie unter „Werbekosten“ eintragen – am Gewinn ändert das nichts.
      Erstattungen an Käufer sind von den Einnahmen schon abgezogen. Privat markierte Verkäufe sind nicht enthalten.</p>

    <h2>Welche Formulare du brauchst</h2>
    <div class="karte"><ul style="margin:0;padding-left:18px;line-height:1.7">
      <li><b>Hauptvordruck (Mantelbogen)</b> der Einkommensteuererklärung</li>
      <li><b>Anlage EÜR</b> – Pflicht, nur online über ELSTER (Werte oben)</li>
      <li><b>Anlage G</b> – Gewinn aus Gewerbebetrieb (Einzelunternehmen „Online-Handel“, Gewinn aus der EÜR)</li>
      <li><b>Anlage N</b> – nur wenn du angestellt warst (Werte von der Lohnsteuerbescheinigung)</li>
      <li><b>Anlage SO</b> – nur wenn du <i>privat</i> etwas innerhalb eines Jahres nach dem Kauf mit Gewinn verkauft hast (steuerfrei, solange alle solchen Gewinne im Jahr unter 1.000 € bleiben)</li>
      <li><b>Anlage KAP</b> – Kapitalerträge (z. B. Trade Republic); meist freiwillig, wenn die Steuer schon abgezogen wurde</li>
      <li><b>Keine Umsatzsteuererklärung</b> als Kleinunternehmer – außer das Finanzamt fordert sie an</li>
      <li><b>Gewerbesteuererklärung</b> nur, wenn der Gewinn über 24.500 € liegt</li>
    </ul></div>
    <div class="knopfleiste keindruck">
      <button class="knopf" onclick="S.jahr=${j};geheZu('berichte');setTimeout(()=>{const b=document.getElementById('xJ');if(b)b.click();},50)">📦 Jahresabschluss-Paket ${j} erstellen</button>
      <button class="knopf zwei" onclick="window.print()">Drucken / PDF</button>
    </div>
    <p class="leise klein">Das ist eine Ausfüllhilfe aus deinen Daten, keine Steuerberatung. Bei Unsicherheit (z. B. privat/gewerblich) kurz mit einem Steuerberater abstimmen.</p>`;
  document.querySelectorAll('[data-sj]').forEach(b => b.onclick = () => { S.steuerJahr = Number(b.dataset.sj); seiteSteuer(); });
}

// ---------- Bestellungen: abends abarbeiten (versenden + Etiketten drucken) ----------
// Nur Bestellungen der letzten 3 Wochen gelten als „offen“; ältere ohne Versand-Mail landen in „vermutlich versendet“.
const PAKET_TAGE = 21;
const versandOffen = v => v.status !== 'Storniert' && /versenden|^Bezahlt$|Teilweise/.test(v.status);   // auch private Pakete
const zuVersenden = () => S.d.V.filter(v => versandOffen(v) && tageIm(v) <= PAKET_TAGE).sort((a, b) => a.datum - b.datum);
const versandUnklar = () => S.d.V.filter(v => versandOffen(v) && tageIm(v) > PAKET_TAGE).sort((a, b) => b.datum - a.datum);
function erledigtListe() { try { return JSON.parse(localStorage.getItem('rb_erledigt') || '{}'); } catch (e) { return {}; } }
function erledigtSetzen(id, an) {
  const e = erledigtListe(); if (an) e[id] = Date.now(); else delete e[id];
  try { localStorage.setItem('rb_erledigt', JSON.stringify(e)); } catch (x) { /* egal */ }
}

function seiteVersand() {
  const L = zuVersenden(), erl = erledigtListe(), alt = versandUnklar();
  const offen = L.filter(v => !erl[v.id]), fertig = L.filter(v => erl[v.id]);
  const gruppe = (titel, liste) => liste.length ? `<h2>${titel} <span class="chip">${liste.length}</span></h2>
    <div class="liste">${liste.map(v => `<div class="eintrag versand ${erl[v.id] ? 'fertig' : ''}">
      <label class="haken"><input type="checkbox" data-erl="${esc(v.id)}" ${erl[v.id] ? 'checked' : ''}><span></span></label>
      <div class="haupt" title="${esc(v.artikel)}">${esc(v.artikel)}</div><div class="rechts">${eur(umsatzVon(v))}</div>
      <div class="unter"><span>${dt(v.datum)} · ${esc(v.konto)}</span><span>an <b>${esc(v.kaeufer)}</b></span>
        <span class="chip ${Date.now() - v.datum > 2 * 864e5 ? 'gelb' : ''}">seit ${Math.max(0, Math.floor((Date.now() - v.datum) / 864e5))} Tagen</span>
        <a href="${bestellLink(v)}" target="_blank" rel="noopener">Bestellung öffnen ›</a></div></div>`).join('')}</div>` : '';
  const cm = offen.filter(v => v.plattform === 'Cardmarket'), eb = offen.filter(v => v.plattform !== 'Cardmarket');
  inhalt().innerHTML = `
    <h1>Bestellungen</h1>
    <div class="hero" style="padding:18px 20px">
      <div class="label">Heute zu erledigen</div>
      <div class="gross" style="font-size:34px">${offen.length} ${offen.length === 1 ? 'Paket' : 'Pakete'}</div>
      <div class="reihe-h">
        <div class="pille"><div class="k">Cardmarket</div><div class="w">${cm.length}</div></div>
        <div class="pille"><div class="k">eBay</div><div class="w">${eb.length}</div></div>
        <div class="pille"><div class="k">Erledigt</div><div class="w">${fertig.length}</div></div>
      </div>
    </div>
    <div class="schnell keindruck">
      ${istHandy ? '<button type="button" class="schnellknopf" id="btnHandyDruck"><b>🖨 Etikett drucken</b><span>Datei wählen → Brother-App</span></button>'
        : '<a class="schnellknopf" href="etikettdruck://start" id="btnDruck"><b>🖨 Etiketten drucken</b><span>öffnet deine Drucker-App</span></a>'}
      <a class="schnellknopf" href="https://www.ebay.de/sh/ord/?filter=status:AWAITING_SHIPMENT" target="_blank" rel="noopener"><b>🏷 eBay-Etiketten kaufen</b><span>eBay Verkäufer-Cockpit</span></a>
    </div>
    <p class="leise klein">Ablauf: Etikett kaufen und herunterladen → ${istHandy ? '„Etikett drucken“ → Datei wählen → an iPrint&amp;Label senden' : '„Etiketten drucken“'} → Paket packen → abhaken. Abgehakte Pakete verschwinden, sobald die Plattform „versendet“ meldet.</p>
    ${offen.length ? '' : '<div class="karte leer">🎉 Alles versendet – nichts offen.</div>'}
    ${gruppe('Cardmarket', cm)}${gruppe('eBay', eb)}${gruppe('Abgehakt', fertig)}
    ${alt.length ? `<details class="karte" style="margin-top:16px"><summary style="cursor:pointer"><b>Älter als ${PAKET_TAGE} Tage – vermutlich schon versendet</b>
      <span class="chip">${alt.filter(v => !erl[v.id]).length}</span>
      <div class="klein leise">Dafür kam keine Versand-Mail an. Bitte kurz prüfen und abhaken.</div></summary>${gruppe('', alt).replace(/^<h2>.*?<\/h2>/s, '')}</details>` : ''}`;
  document.querySelectorAll('[data-erl]').forEach(c => c.onchange = () => {
    const auf = !!c.closest('details')?.open, y = window.scrollY;
    erledigtSetzen(c.dataset.erl, c.checked); zeichnen();
    if (auf) { const d = document.querySelector('main details'); if (d) d.open = true; }
    window.scrollTo(0, y);
  });
  if (istHandy) { $('#btnHandyDruck').onclick = etikettenWaehlen; return; }
  $('#btnDruck').onclick = () => {
    toast('Drucker-App wird geöffnet … (lädt ein paar Sekunden)');
    setTimeout(() => { if (document.hasFocus()) toast('Kein Fenster zu sehen? Unten in der Taskleiste auf „Etiketten drucken“ klicken.'); }, 9000);
  };
}
// ---------- Etiketten am Handy: zuschneiden wie die PC-Drucker-App, dann an „Brother iPrint&Label“ geben ----------
const ET_DPMM = 300 / 25.4;               // Brother QL-820NWB: 300 Punkte pro Zoll
const ET_BREITE = 696, ET_HOEHE = 1109;   // bedruckbare Fläche 62 × 100 mm in Druckerpunkten
const istHandy = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
let pdfjsVersprechen = null;

function pdfjsLaden() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsVersprechen) pdfjsVersprechen = new Promise((ok, nein) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror = () => { pdfjsVersprechen = null; nein(new Error('PDF-Leser nicht geladen – Internet an?')); };
    document.head.appendChild(s);
  });
  return pdfjsVersprechen;
}

// Ganze Etikett-Seite als Bild (A4-Breite 2480 Punkte = 300 dpi, wie am PC)
async function etikettSeite(datei) {
  const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
  if (datei.type === 'application/pdf' || /\.pdf$/i.test(datei.name)) {
    const lib = await pdfjsLaden();
    const doc = await lib.getDocument({ data: await datei.arrayBuffer() }).promise;
    const seite = await doc.getPage(1);
    const vp = seite.getViewport({ scale: 2480 / seite.getViewport({ scale: 1 }).width });
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await seite.render({ canvasContext: g, viewport: vp }).promise;
    doc.destroy();
  } else {
    const bild = await createImageBitmap(datei);
    c.width = bild.width; c.height = bild.height;
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bild, 0, 0);
    if (bild.close) bild.close();
  }
  return c;
}

// Umriss aller dunklen Pixel im Bereich; „ecke“ = Eck-Quadrate (Schnittmarken) auslassen
function dunkleBox(px, W, l, t, r, b, ecke) {
  let x0 = r, y0 = b, x1 = -1, y1 = -1;
  for (let y = t; y < b; y++) {
    const randY = ecke && (y < t + ecke || y >= b - ecke);
    for (let x = l; x < r; x++) {
      if (randY && (x < l + ecke || x >= r - ecke)) continue;
      const i = (y * W + x) * 4;
      if (px[i] + px[i + 1] + px[i + 2] < 450) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  return x1 < 0 ? null : { l: x0, t: y0, r: x1 + 1, b: y1 + 1 };
}

// Etikett finden: sitzt oben links auf der Seite (obere 47 %), dazu 1 mm Rand; „innen“ = ohne Schnittmarken
function etikettZuschnitt(seite) {
  const W = seite.width, H = seite.height, px = seite.getContext('2d').getImageData(0, 0, W, H).data;
  const proMm = W / 210, pad = Math.round(proMm);
  const box = dunkleBox(px, W, 0, 0, W, Math.floor(H * 0.47), 0);
  if (!box) throw new Error('Kein Etikett auf der Seite gefunden');
  const aussen = { l: Math.max(0, box.l - pad), t: Math.max(0, box.t - pad), r: Math.min(W, box.r + pad), b: Math.min(H, box.b + pad) };
  const i0 = dunkleBox(px, W, aussen.l, aussen.t, aussen.r, aussen.b, Math.round(7 * proMm)) || aussen;
  const innen = { l: Math.max(aussen.l, i0.l - pad), t: Math.max(aussen.t, i0.t - pad), r: Math.min(aussen.r, i0.r + pad), b: Math.min(aussen.b, i0.b + pad) };
  const gross = Math.min(aussen.r - aussen.l, aussen.b - aussen.t) / proMm > 70;   // z. B. DHL-Paketschein
  return { seite, proMm, aussen, innen, gross };
}

// Druckbild: groß = hochkant auf 62 × 100 mm; klein = quer auf 62 mm Endlosrolle; reines Schwarz-Weiß
function etikettBild(z, klein) {
  const r = klein ? z.innen : z.aussen, ow = r.r - r.l, oh = r.b - r.t;
  const drehen = klein ? oh > ow : ow > oh;
  const wMm = (drehen ? oh : ow) / z.proMm, hMm = (drehen ? ow : oh) / z.proMm;
  const endlos = klein || z.gross;
  const s = endlos ? Math.min(1, 58 / wMm) : Math.min(1, 58 / wMm, 96 / hMm);
  const bw = Math.round(wMm * s * ET_DPMM), bh = Math.round(hMm * s * ET_DPMM);
  const c = document.createElement('canvas');
  c.width = ET_BREITE; c.height = endlos ? Math.max(Math.round(29 * ET_DPMM), bh) : ET_HOEHE;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.translate(Math.round((c.width - bw) / 2), Math.round((c.height - bh) / 2));
  if (drehen) { g.translate(bw, 0); g.rotate(Math.PI / 2); g.drawImage(z.seite, r.l, r.t, ow, oh, 0, 0, bh, bw); }
  else g.drawImage(z.seite, r.l, r.t, ow, oh, 0, 0, bw, bh);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const v = p[i] + p[i + 1] + p[i + 2] < 480 ? 0 : 255; p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  return new Promise(ok => c.toBlob(ok, 'image/png'));
}

function gedrucktListe() { try { return JSON.parse(localStorage.getItem('rb_gedruckt') || '{}'); } catch (e) { return {}; } }
function gedrucktMerken(name) {
  const g = gedrucktListe(); g[name] = Date.now();
  Object.keys(g).forEach(k => { if (Date.now() - g[k] > 60 * 864e5) delete g[k]; });
  try { localStorage.setItem('rb_gedruckt', JSON.stringify(g)); } catch (e) { /* egal */ }
}

function etikettenWaehlen() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/pdf,image/*'; inp.multiple = true;
  inp.onchange = () => { if (inp.files.length) etikettenDialog([...inp.files]); };
  inp.click();
}

async function etikettenDialog(dateien) {
  const kleinStd = localStorage.getItem('rb_etikett') === 'klein';
  const E = dateien.map((f, i) => ({ i, f, name: f.name.replace(/\.(pdf|png|jpe?g)$/i, '').replace(/ \(\d+\)$/, ''), klein: kleinStd, gross: false, bild: {}, url: {}, fehler: '' }));
  dialog(`<h2 style="margin-top:0">🖨 Etiketten drucken</h2><p class="leise">Wird zugeschnitten …</p>`);
  for (const e of E) {
    try {
      const z = etikettZuschnitt(await etikettSeite(e.f));
      e.gross = z.gross; if (z.gross) e.klein = false;
      for (const k of z.gross ? [false] : [false, true]) { const b = await etikettBild(z, k); e.bild[k] = b; e.url[k] = URL.createObjectURL(b); }
      z.seite.width = 0; z.seite = null;   // Speicher frei machen
    } catch (x) { e.fehler = x.message; }
  }
  const malen = () => {
    const gedruckt = gedrucktListe(), ok = E.filter(e => !e.fehler);
    $('#dialogBox').innerHTML = `<h2 style="margin-top:0">🖨 Etiketten drucken</h2>
      <p class="klein leise">„An Drucker senden“ antippen und <b>iPrint&amp;Label</b> wählen. Rolle: <b>Groß</b> = 62 × 100-mm-Etiketten, <b>Klein</b> = 62-mm-Endlosrolle.</p>
      <div class="et-liste">${E.map(e => `<div class="et-karte ${gedruckt[e.name] ? 'fertig' : ''}">
        ${e.fehler ? '<div class="et-bild leer">?</div>' : `<img class="et-bild" src="${e.url[e.klein]}" alt="Vorschau">`}
        <div class="et-info"><b>${esc(e.name.replace(/^eBay label\s*/i, ''))}</b>
          ${e.fehler ? `<span class="chip rot">${esc(e.fehler)}</span>`
            : e.gross ? '<span class="chip gelb">DHL-Paketschein – wird verkleinert, Endlosrolle nehmen</span>'
            : `<div class="segment"><button data-et="${e.i}" data-k="0" class="${e.klein ? '' : 'aktiv'}">Groß (Paket)</button><button data-et="${e.i}" data-k="1" class="${e.klein ? 'aktiv' : ''}">Klein (Brief)</button></div>`}
          ${gedruckt[e.name] ? '<span class="chip gruen">schon gesendet ✓</span>' : ''}
          ${e.fehler ? '' : `<button class="knopf klein" data-send="${e.i}">An Drucker senden</button>`}
        </div></div>`).join('')}</div>
      <div class="knopfleiste">${ok.length > 1 ? `<button class="knopf" id="etAlle">Alle ${ok.length} senden</button>` : ''}<button class="knopf zwei" id="etZu">Fertig</button></div>`;
    document.querySelectorAll('[data-et]').forEach(b => b.onclick = () => { E[b.dataset.et].klein = b.dataset.k === '1'; malen(); });
    document.querySelectorAll('[data-send]').forEach(b => b.onclick = () => senden([E[b.dataset.send]]));
    if ($('#etAlle')) $('#etAlle').onclick = () => senden(ok);
    $('#etZu').onclick = () => { E.forEach(e => Object.values(e.url).forEach(u => URL.revokeObjectURL(u))); dialogZu(); };
  };
  const senden = async liste => {
    const files = liste.map(e => new File([e.bild[e.klein]], `${e.name} ${e.klein ? 'klein' : 'gross'}.png`, { type: 'image/png' }));
    try {
      if (navigator.canShare && navigator.canShare({ files })) await navigator.share({ files });
      else {
        files.forEach(f => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); });
        toast('Als Bild gespeichert – in iPrint&Label unter „Fotos“ öffnen und drucken.');
      }
    } catch (x) { if (x.name !== 'AbortError') toast('Senden ging nicht: ' + x.message); return; }
    liste.forEach(e => gedrucktMerken(e.name));
    try { localStorage.setItem('rb_etikett', liste[liste.length - 1].klein ? 'klein' : 'gross'); } catch (x) { /* egal */ }
    malen();
  };
  malen();
}

// ---------- Start ----------
function geheZu(seite) { S.seite = seite; zeichnen(); }
window.geheZu = geheZu; window.dialogZu = dialogZu; window.ausgabeDialog = ausgabeDialog;

document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { if (S.d) geheZu(b.dataset.seite); });
$('#btnSync').onclick = async () => {
  if (!S.cfg) return;
  $('#btnSync').classList.add('dreht');
  try { await api('aktualisieren'); toast('Neue Verkäufe abgerufen'); } catch (e) { toast('Abruf: ' + e.message); }
  await laden(true);
};
// Selbst-Update: beim Öffnen/Zurückkehren nach neuer Version schauen und dann neu laden
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hatteSW = !!navigator.serviceWorker.controller;
  let updateBereit = false;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const pruefen = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (updateBereit) location.reload(); else pruefen();
    });
    setInterval(pruefen, 30 * 60 * 1000);
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteSW || updateBereit) return;
    // Nicht mitten in einer Eingabe neu laden
    if (!$('#dialog').hidden || ['einkauf', 'ausgaben'].includes(S.seite)) { updateBereit = true; toast('Neue App-Version – wird beim nächsten Öffnen geladen.'); }
    else location.reload();
  });
}

cfgLaden();
if (!S.cfg) einrichtungZeigen();
else {
  try { const c = localStorage.getItem('rb_daten'); if (c) { S.d = aufbereiten(JSON.parse(c)); zeichnen(); } } catch (e) { /* egal */ }
  laden();
}
