/* Reselling-Buch – App (PC + Handy)
 * Daten: Google-Tabelle über Apps-Script-Schnittstelle (Token). Kein Server, keine Kosten.
 */
'use strict';

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
    versender: r[19], artikelIds: r[20], ekQuelle: r[21]
  })).filter(v => v.id && v.datum);
  const E = d.einkaeufe.map(r => ({
    nr: r[0], datum: dat(r[1]), haendler: r[2], shop: r[3], bestellnr: r[4], zahlungsart: r[5], positionen: r[6],
    warenwert: zahl(r[7]) || 0, versand: zahl(r[8]) || 0, gesamt: zahl(r[9]) || 0, beleg: r[10], notiz: r[11],
    quelle: r[13], status: r[14]
  }));
  const B = d.bestand.map(r => ({
    id: r[0], nr: r[1], datum: dat(r[2]), produkt: String(r[3]), kategorie: r[4], details: r[5], suchbegriff: r[6],
    menge: zahl(r[7]) || 0, ekStueck: zahl(r[8]) || 0, ekGesamt: zahl(r[9]) || 0, verkauft: zahl(r[10]) || 0,
    rest: zahl(r[11]) || 0, status: r[12], lagerort: r[13], notiz: r[14]
  }));
  const A = d.ausgaben.map(r => ({
    nr: r[0], datum: dat(r[1]), kategorie: r[2], beschreibung: r[3], haendler: r[4], betrag: zahl(r[5]) || 0,
    zahlungsart: r[6], beleg: r[7], notiz: r[8], quelle: r[10], status: r[11]
  }));
  const Z = d.zuordnung.map(r => ({ verkaufId: r[0], artikelId: r[1], menge: zahl(r[2]) || 0, ek: zahl(r[3]) || 0, art: r[4] }));
  const e = d.einstellungen;
  return { V, E, B, A, Z, e, buchAb: dat(e.buchhaltungAb) || new Date(2026, 11, 1), stand: dat(d.stand) };
}

// ---------- Formatierung ----------
const eur = n => (n === null || n === undefined) ? '–' : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const dt = d => d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
const iso = d => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = n => Math.round(n * 100) / 100;
const umsatzVon = v => v.vk + v.versand - v.erstattet;
const aktiv = v => v.status !== 'Storniert';
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
  $('#stand').textContent = S.d.e.letzteAktualisierung ? 'Stand ' + new Date(S.d.e.letzteAktualisierung).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('aktiv', b.dataset.seite === S.seite));
  ({ start: seiteStart, verkaeufe: seiteVerkaeufe, einkauf: seiteEinkauf, bestand: seiteBestand, ausgaben: seiteAusgaben, berichte: seiteBerichte })[S.seite]();
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

// Säulendiagramm Umsatz pro Monat – eine Reihe, Tooltip beim Drüberfahren/Tippen
function monatsDiagramm(jahr) {
  const D = monatsWerte(jahr);
  const max = rundeHoch(Math.max(...D.map(d => d.umsatz)));
  const W = 640, H = 230, L = 46, R = 6, T = 10, B = 26, ph = H - T - B, bw = (W - L - R) / 12, bb = Math.min(30, bw * 0.62);
  const y = v => T + ph - v / max * ph;
  const gitter = [0, max / 2, max].map(v => `<line class="gitter" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="achse" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${eurKurz(v)}</text>`).join('');
  const saeulen = D.map((d, i) => {
    const x = L + i * bw + (bw - bb) / 2, h = Math.max(0, ph - (y(d.umsatz) - T)), r = Math.min(4, h);
    const top = T + ph - h;
    const pfad = h > 0 ? `M${x},${T + ph} V${top + r} Q${x},${top} ${x + r},${top} H${x + bb - r} Q${x + bb},${top} ${x + bb},${top + r} V${T + ph} Z` : '';
    return `<g data-i="${i}"><rect class="treffer" x="${L + i * bw}" y="${T}" width="${bw}" height="${ph + B}"/>
      ${pfad ? `<path class="balken" d="${pfad}"/>` : ''}
      <text class="achse" x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${d.m}</text></g>`;
  }).join('');
  return { html: `<div class="diagramm" id="dMonat"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Umsatz pro Monat ${jahr}">${gitter}${saeulen}</svg><div class="tipp" hidden></div></div>`,
    verbinden: () => {
      const box = $('#dMonat'); if (!box) return;
      const tipp = $('.tipp', box), svg = $('svg', box);
      box.querySelectorAll('g[data-i]').forEach(g => {
        const zeig = () => {
          const d = D[g.dataset.i];
          box.querySelectorAll('g.aktiv').forEach(x => x.classList.remove('aktiv')); g.classList.add('aktiv');
          tipp.innerHTML = `<b>${monatName(d.key)}</b><br>Umsatz ${eur(d.umsatz)}<br>Gewinn ${eur(d.gewinn)}${d.offen ? ` <span style="opacity:.7">(${d.offen} offen)</span>` : ''}<br>${d.n} Verkäufe`;
          const rs = svg.getBoundingClientRect(), rb = box.getBoundingClientRect();
          const i = Number(g.dataset.i), xs = (L + i * bw + bw / 2) / W * rs.width;
          tipp.style.left = Math.min(rb.width - 70, Math.max(70, xs)) + 'px';
          tipp.style.top = ((y(d.umsatz)) / H * rs.height) + 'px';
          tipp.hidden = false;
        };
        g.addEventListener('mouseenter', zeig); g.addEventListener('click', zeig);
      });
      box.addEventListener('mouseleave', () => { tipp.hidden = true; box.querySelectorAll('g.aktiv').forEach(x => x.classList.remove('aktiv')); });
    } };
}

// Farbe folgt dem Konto (feste Reihenfolge nach Namen), nie dem Rang
function kontoFarben() {
  const namen = [...new Set(S.d.V.map(v => v.plattform + ' · ' + v.konto))].sort();
  const f = {}; namen.forEach((n, i) => { f[n] = i < 4 ? `var(--s${i + 1})` : 'var(--leise)'; });
  return f;
}

function kontoBalken(V) {
  const farbe = kontoFarben(), proKonto = {};
  V.forEach(v => { const k = v.plattform + ' · ' + v.konto; const p = proKonto[k] || (proKonto[k] = { u: 0, n: 0, g: 0 }); p.u += umsatzVon(v); p.n++; p.g += v.gewinn || 0; });
  const L = Object.entries(proKonto).sort((a, b) => b[1].u - a[1].u);
  const max = Math.max(1, ...L.map(x => x[1].u));
  return L.length ? `<div class="hbalken">${L.map(([k, p]) => `<div class="hb-zeile">
      <div class="hb-name"><span class="punkt" style="background:${farbe[k]}"></span>${esc(k)}</div>
      <div class="hb-wert">${eur(r2(p.u))} <span class="leise klein">· ${p.n}</span></div>
      <div class="hb-bahn"><div style="width:${p.u / max * 100}%;background:${farbe[k]}"></div></div></div>`).join('')}</div>`
    : '<div class="leer">Noch keine Verkäufe.</div>';
}

function grenzeRing(k) {
  const g = S.d.e.grenzeVorjahr || 25000;
  const p = k.hochrechnung / g * 100;
  const st = p >= 100 ? ['krit', '⛔', 'Über der Grenze'] : p >= 80 ? ['warn', '⚠', 'Knapp – aufpassen'] : ['gut', '✓', 'Im grünen Bereich'];
  const farbe = { gut: 'var(--gut)', warn: 'var(--warn)', krit: 'var(--krit)' }[st[0]];
  const U = 2 * Math.PI * 46, voll = Math.min(100, p) / 100 * U;
  return `<div class="ring"><svg viewBox="0 0 112 112" role="img" aria-label="Hochrechnung ${Math.round(p)} Prozent der Grenze">
      <circle cx="56" cy="56" r="46" fill="none" stroke="var(--flaeche-2)" stroke-width="11"/>
      <circle cx="56" cy="56" r="46" fill="none" stroke="${farbe}" stroke-width="11" stroke-linecap="round"
        stroke-dasharray="${voll} ${U}" transform="rotate(-90 56 56)"/>
      <text x="56" y="62" text-anchor="middle" style="font-size:20px;font-weight:800;fill:var(--text)">${Math.round(p)}%</text></svg>
    <div><span class="status ${st[0]}">${st[1]} ${st[2]}</span>
      <div class="klein" style="margin-top:8px">Hochrechnung bis 31.12.: <b>${eur(k.hochrechnung)}</b></div>
      <div class="klein leise">Grenze ${eur(g)} · bisher ${eur(k.umsatz)}</div></div></div>`;
}

// ---------- Seite: Start ----------
function seiteStart() {
  const j = S.jahr = new Date().getFullYear();
  const k = jahresZahlen(j);
  const offen = ohneEk();
  const lager = imBestand();
  const kapital = lager.reduce((s, b) => s + b.rest * b.ekStueck, 0);
  const monat = iso().slice(0, 7);
  const km = S.d.V.filter(v => v.monat === monat && aktiv(v));
  const versenden = S.d.V.filter(v => aktiv(v) && /versenden|^Bezahlt$/.test(v.status));
  const gebuehren = k.V.reduce((s, v) => s + (v.gebuehren || 0), 0);
  const zuletzt = S.d.V.slice().sort((a, b) => b.datum - a.datum).slice(0, 5);
  const dia = monatsDiagramm(j);
  inhalt().innerHTML = `
    <div class="hero">
      <div class="label">Umsatz ${j} · alle Konten</div>
      <div class="gross">${eur(k.umsatz)}</div>
      <div class="reihe-h">
        <div class="pille"><div class="k">Gewinn ${k.offen ? `(${k.V.length - k.offen} von ${k.V.length} mit EK)` : ''}</div><div class="w">${eur(k.gewinn)}</div></div>
        <div class="pille"><div class="k">${new Date().toLocaleDateString('de-DE', { month: 'long' })}</div><div class="w">${eur(r2(km.reduce((s, v) => s + umsatzVon(v), 0)))}</div></div>
        <div class="pille"><div class="k">Verkäufe ${j}</div><div class="w">${k.V.length}</div></div>
      </div>
    </div>
    <div class="kacheln">
      <div class="kachel ${offen.length ? 'warnung' : ''}" onclick="filterSetzen('ekfehlt')" style="cursor:pointer"><div class="ic">🧾</div><div class="wert">${offen.length}</div><div class="text">Einkaufspreis fehlt</div></div>
      <div class="kachel" onclick="filterSetzen('versenden')" style="cursor:pointer"><div class="ic">📮</div><div class="wert">${versenden.length}</div><div class="text">Noch versenden</div></div>
      <div class="kachel" onclick="geheZu('bestand')" style="cursor:pointer"><div class="ic">📦</div><div class="wert">${eur(r2(kapital))}</div><div class="text">In Ware · ${lager.reduce((s, b) => s + b.rest, 0)} Stück</div></div>
      <div class="kachel"><div class="ic">💸</div><div class="wert">${eur(r2(gebuehren))}</div><div class="text">Gebühren ${j}</div></div>
    </div>
    <div class="raster zwei">
      <div class="karte"><div class="karte-kopf"><h3>Umsatz pro Monat</h3><span class="leise klein">${j}</span></div>${dia.html}</div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="karte"><div class="karte-kopf"><h3>Kleinunternehmer-Grenze</h3></div>${grenzeRing(k)}</div>
        <div class="karte"><div class="karte-kopf"><h3>Umsatz nach Konto</h3><span class="leise klein">${j}</span></div>${kontoBalken(k.V)}</div>
      </div>
    </div>
    <div class="schnell keindruck">
      <button onclick="geheZu('einkauf')"><b>🛒 Einkauf erfassen</b><span>mit Beleg-Foto</span></button>
      <button onclick="ausgabeDialog()"><b>🧾 Ausgabe erfassen</b><span>Versandmaterial, Abo …</span></button>
    </div>
    ${offen.length ? `<h2>Einkaufspreis fehlt</h2><div class="liste">${offen.slice(0, 5).map(zeileVerkauf).join('')}</div>
      ${offen.length > 5 ? `<p class="leise klein"><a href="#" onclick="filterSetzen('ekfehlt');return false">Alle ${offen.length} anzeigen →</a></p>` : ''}` : ''}
    <h2>Zuletzt verkauft</h2>
    <div class="liste">${zuletzt.map(zeileVerkauf).join('') || '<div class="leer">Noch keine Verkäufe.</div>'}</div>
    ${S.d.e.fehler && S.d.e.fehler !== '–' ? `<div class="hinweis klein">Letzter Abruf meldet: ${esc(S.d.e.fehler)}</div>` : ''}`;
  dia.verbinden();
  aktionenVerbinden();
}

function filterSetzen(nur) { S.filter.v = { suche: '', monat: '', plattform: '', nur }; geheZu('verkaeufe'); }
window.filterSetzen = filterSetzen;

// ---------- Verkäufe ----------
function zeileVerkauf(v) {
  const fehlt = v.ek === null && aktiv(v) && v.datum >= S.d.buchAb && v.status !== 'Unbezahlt';
  const gew = v.gewinn !== null ? `<span class="gewinn ${v.gewinn >= 0 ? 'plus' : 'minus'}">${v.gewinn >= 0 ? '+' : ''}${eur(v.gewinn)}</span>`
    : (aktiv(v) ? `<span class="chip gelb">${esc(v.gewinnText || 'offen')}</span>` : '');
  const cm = v.plattform === 'Cardmarket';
  return `<div class="eintrag ${fehlt ? 'offen' : ''}">
    <div class="avatar ${cm ? 'av-cm' : 'av-eb'}">${cm ? 'CM' : 'eB'}</div>
    <div class="haupt" title="${esc(v.artikel)}">${esc(v.artikel)}</div><div class="rechts">${eur(umsatzVon(v))}</div>
    <div class="unter"><span>${dt(v.datum)} · ${esc(v.konto)}</span>${gew}
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
  const f = S.filter.v || (S.filter.v = { suche: '', monat: '', plattform: '', nur: '' });
  const monate = [...new Set(S.d.V.map(v => v.monat))].filter(Boolean).sort().reverse();
  let L = S.d.V.slice().sort((a, b) => b.datum - a.datum);
  if (f.monat) L = L.filter(v => v.monat === f.monat);
  if (f.plattform) L = L.filter(v => v.plattform === f.plattform);
  if (f.nur === 'ekfehlt') L = L.filter(v => v.ek === null && aktiv(v) && v.status !== 'Unbezahlt');
  if (f.nur === 'versenden') L = L.filter(v => /versenden|Bezahlt$/.test(v.status));
  if (f.suche) { const s = f.suche.toLowerCase(); L = L.filter(v => (v.artikel + ' ' + v.kaeufer + ' ' + v.bestellnr).toLowerCase().includes(s)); }
  const summe = L.filter(aktiv).reduce((s, v) => s + umsatzVon(v), 0);
  inhalt().innerHTML = `
    <h1>Verkäufe</h1>
    <div class="filter keindruck">
      <input id="fSuche" placeholder="Suchen …" value="${esc(f.suche)}">
      <select id="fMonat"><option value="">Alle Monate</option>${monate.map(m => `<option value="${m}" ${m === f.monat ? 'selected' : ''}>${monatName(m)}</option>`).join('')}</select>
      <select id="fPlatt"><option value="">Alle Plattformen</option>${['eBay', 'Cardmarket'].map(p => `<option ${p === f.plattform ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <select id="fNur"><option value="">Alle</option><option value="ekfehlt" ${f.nur === 'ekfehlt' ? 'selected' : ''}>EK fehlt</option><option value="versenden" ${f.nur === 'versenden' ? 'selected' : ''}>Noch versenden</option></select>
    </div>
    <p class="leise klein">${L.length} Verkäufe · Umsatz ${eur(r2(summe))}</p>
    <div class="liste">${L.slice(0, 200).map(zeileVerkauf).join('') || '<div class="leer">Keine Verkäufe gefunden.</div>'}</div>`;
  const neu = () => { f.suche = $('#fSuche').value; f.monat = $('#fMonat').value; f.plattform = $('#fPlatt').value; f.nur = $('#fNur').value; seiteVerkaeufe(); };
  ['#fMonat', '#fPlatt', '#fNur'].forEach(s => $(s).onchange = neu);
  $('#fSuche').onchange = neu;
  aktionenVerbinden();
}

function aktionenVerbinden() {
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
    <h1 id="eTitel">Einkauf erfassen</h1>
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
  const tage = b.datum ? Math.floor((Date.now() - b.datum) / 864e5) : 0;
  return `<div class="eintrag">
    <div class="avatar av-be">${b.rest}</div>
    <div class="haupt" title="${esc(b.produkt)}">${esc(b.produkt)}</div><div class="rechts">${eur(r2(b.rest * b.ekStueck))}</div>
    <div class="unter"><span>${b.rest} von ${b.menge} · EK ${eur(b.ekStueck)}/Stk</span>
      <span class="chip ${tage > 45 && b.rest > 0 ? 'gelb' : ''}">${tage} Tage</span><span class="chip">${esc(b.status)}</span>
      ${b.suchbegriff ? `<span>🔎 ${esc(b.suchbegriff)}</span>` : ''}</div>
    <div class="aktionen keindruck"><span class="chip">${esc(b.id)}</span><button class="knopf klein zwei" data-artikel="${esc(b.id)}">Bearbeiten</button></div>
  </div>`;
}

function seiteBestand() {
  const f = S.filter.b || (S.filter.b = { suche: '', alle: false });
  let L = (f.alle ? S.d.B : imBestand()).slice().sort((a, b) => (a.datum || 0) - (b.datum || 0));
  if (f.suche) { const s = f.suche.toLowerCase(); L = L.filter(b => (b.produkt + ' ' + b.id + ' ' + (b.suchbegriff || '')).toLowerCase().includes(s)); }
  const wert = L.reduce((s, b) => s + b.rest * b.ekStueck, 0);
  inhalt().innerHTML = `
    <h1>Bestand</h1>
    <div class="filter keindruck">
      <input id="bSuche" placeholder="Suchen …" value="${esc(f.suche)}">
      <select id="bAlle"><option value="">Nur vorhandene</option><option value="1" ${f.alle ? 'selected' : ''}>Alle (auch verkauft)</option></select>
    </div>
    <p class="leise klein">${L.length} Positionen · Warenwert ${eur(r2(wert))}</p>
    <div class="liste">${L.map(zeileBestand).join('') || '<div class="leer">Kein Bestand. Einkäufe erscheinen hier automatisch.</div>'}</div>`;
  $('#bSuche').onchange = e => { f.suche = e.target.value; seiteBestand(); };
  $('#bAlle').onchange = e => { f.alle = !!e.target.value; seiteBestand(); };
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
    <label>Notiz</label><input id="aNotiz" value="${esc(b.notiz)}">
    <div class="knopfleiste"><button class="knopf" id="aOk">Speichern</button><button class="knopf zwei" onclick="dialogZu()">Abbrechen</button></div>`,
  box => {
    $('#aOk', box).onclick = () => speichern('artikelAendern', { artikelId: id, felder: {
      produkt: $('#aProd', box).value, suchbegriff: $('#aSuch', box).value, status: $('#aStat', box).value,
      lagerort: $('#aOrt', box).value, notiz: $('#aNotiz', box).value } }, 'Gespeichert');
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
  const plattformen = {};
  k.V.forEach(v => { const p = plattformen[v.plattform + ' · ' + v.konto] || (plattformen[v.plattform + ' · ' + v.konto] = { n: 0, u: 0, g: 0 }); p.n++; p.u += umsatzVon(v); p.g += v.gewinn || 0; });
  const dia = monatsDiagramm(j);
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
      <div class="karte"><div class="karte-kopf"><h3>Umsatz pro Monat</h3></div>${dia.html}</div>
      <div class="karte"><div class="karte-kopf"><h3>Umsatz nach Konto</h3></div>${kontoBalken(k.V)}</div>
    </div>

    <h2>Monate ${j}</h2>
    <div class="karte tabelle-scroll"><table>
      <tr><th>Monat</th><th>Verk.</th><th>Umsatz</th><th>Gebühren</th><th>Porto</th><th>Gewinn</th><th>Einkauf</th><th>Ausgaben</th></tr>
      ${M.map(x => `<tr><td>${monatName(x.key)}</td><td>${x.anzahl}</td><td>${eur(x.umsatz)}</td><td>${eur(x.gebuehren)}</td><td>${eur(x.porto)}</td>
        <td class="${x.gewinn >= 0 ? 'plus' : 'minus'}">${eur(x.gewinn)}${x.offen ? ` <span class="chip gelb">${x.offen} offen</span>` : ''}</td><td>${eur(x.einkauf)}</td><td>${eur(x.ausgaben)}</td></tr>`).join('')}
      <tr class="gesamt"><td>Gesamt</td><td>${M.reduce((s, x) => s + x.anzahl, 0)}</td><td>${eur(sum('umsatz'))}</td><td>${eur(sum('gebuehren'))}</td><td>${eur(sum('porto'))}</td><td>${eur(sum('gewinn'))}</td><td>${eur(sum('einkauf'))}</td><td>${eur(sum('ausgaben'))}</td></tr>
    </table></div>
    <p class="leise klein">„Gewinn“ = pro Verkauf (Preis + Versand − Gebühren − Porto − Einkaufspreis). „Offen“ = Einkaufspreis oder Porto fehlt.</p>


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
    <div class="knopfleiste keindruck">
      <button class="knopf" id="xV">Verkäufe als CSV</button>
      <button class="knopf zwei" id="xE">Einkäufe als CSV</button>
      <button class="knopf zwei" id="xA">Ausgaben als CSV</button>
      <button class="knopf zwei" id="xU">EÜR als CSV</button>
      <button class="knopf zwei" onclick="window.print()">Drucken / PDF</button>
    </div>`;
  document.querySelectorAll('[data-jahr]').forEach(b => b.onclick = () => { S.jahr = Number(b.dataset.jahr); seiteBerichte(); });
  dia.verbinden();
  const jahrFilter = x => x.datum && x.datum.getFullYear() === j;
  const z = n => (n === null || n === undefined) ? '' : String(n).replace('.', ',');
  $('#xV').onclick = () => csv('Verkaeufe_' + j, ['Datum', 'Plattform', 'Konto', 'Bestellnr', 'Artikel', 'Käufer', 'Verkaufspreis', 'Versand', 'Gebühren', 'Porto', 'Erstattet', 'Einkaufspreis', 'Gewinn', 'Status', 'Sendungsnummer'],
    S.d.V.filter(jahrFilter).sort((a, b) => a.datum - b.datum).map(v => [dt(v.datum), v.plattform, v.konto, v.bestellnr, v.artikel, v.kaeufer, z(v.vk), z(v.versand), z(v.gebuehren), z(v.porto), z(v.erstattet), z(v.ek), z(v.gewinn), v.status, v.sendung]));
  $('#xE').onclick = () => csv('Einkaeufe_' + j, ['Beleg-Nr', 'Datum', 'Händler', 'Shop', 'Bestellnr', 'Zahlungsart', 'Positionen', 'Warenwert', 'Versand', 'Gesamt', 'Beleg', 'Status'],
    S.d.E.filter(jahrFilter).sort((a, b) => a.datum - b.datum).map(e => [e.nr, dt(e.datum), e.haendler, e.shop, e.bestellnr, e.zahlungsart, e.positionen, z(e.warenwert), z(e.versand), z(e.gesamt), e.beleg, e.status]));
  $('#xA').onclick = () => csv('Ausgaben_' + j, ['Beleg-Nr', 'Datum', 'Kategorie', 'Beschreibung', 'Händler', 'Betrag', 'Zahlungsart', 'Beleg', 'Status'],
    S.d.A.filter(jahrFilter).sort((a, b) => a.datum - b.datum).map(a => [a.nr, dt(a.datum), a.kategorie, a.beschreibung, a.haendler, z(a.betrag), a.zahlungsart, a.beleg, a.status]));
  $('#xU').onclick = () => csv('EUER_' + j, ['Posten', 'Betrag'], [['Betriebseinnahmen', z(e.einnahmen)], ['Wareneinkauf', z(-e.ware)], ['Verkaufsgebühren', z(-e.gebuehren)],
    ['Porto / Versandetiketten', z(-e.porto)]].concat(Object.entries(e.sonst).map(([kat, b]) => [kat, z(-r2(b))]), [['Ergebnis', z(e.ergebnis)]]));
}

function csv(name, kopf, zeilen) {
  const zelle = x => { const s = String(x === null || x === undefined ? '' : x); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const text = '﻿' + [kopf].concat(zeilen).map(r => r.map(zelle).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
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
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

cfgLaden();
if (!S.cfg) einrichtungZeigen();
else {
  try { const c = localStorage.getItem('rb_daten'); if (c) { S.d = aufbereiten(JSON.parse(c)); zeichnen(); } } catch (e) { /* egal */ }
  laden();
}
