// Prueft die Temperaturrechnung der Anzeige gegen das Protokoll:  node auswerten.js [protokoll.jsonl]
// Fuer jede Station X und Stunde t (Vorhersage mit 1-3 Stunden Vorlauf): Wie gut trifft die Methode die echte Messung von X,
// wenn nur die Vorhersage am Ort X und die Messungen der ANDEREN Stationen bekannt sind (wie bei einem Ort ohne eigene Station)?
//   A  nur Vorhersage                      B  Vorhersage + 1/d²-gewichteter Fehler der anderen (so rechnet die Anzeige)
//   C  Vorhersage + einfacher Mittelwert der Fehler der anderen   D  B zu 40 % zum Mittelwert hin geglaettet
const fs = require('fs');
const ST = { Baerl: [51.52, 6.70], Geldern: [51.4942, 6.2463], Borken: [51.87, 6.88], Essen: [51.4041, 6.9677], Duesseldorf: [51.30, 6.77] };
const N = Object.keys(ST);
const km = (a, b) => Math.hypot((b[1] - a[1]) * Math.cos((a[0] + b[0]) / 2 * Math.PI / 180) * 111.32, (b[0] - a[0]) * 110.57);
const zeilen = fs.readFileSync(process.argv[2] || 'data/protokoll.jsonl', 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const mess = {}, vor = {};                       // mess[st][zeit] = Temp;  vor[st][zeit] = [[Vorlauf h, Temp]]
N.forEach(n => { mess[n] = {}; vor[n] = {}; });
for (const z of zeilen) for (const n of N) {
  const e = z.st[n]; if (!e) continue;
  e.mess.forEach(([t, v]) => mess[n][t] = v);
  e.vor.forEach(([t, v]) => { const h = (Date.parse(t + 'Z') - Date.parse(z.lauf + 'Z')) / 36e5; if (h >= 1 && h <= 3) (vor[n][t] = vor[n][t] || []).push(v); });
}
const fc = (n, t) => { const l = vor[n][t]; return l && l.length ? l[0] : null; };   // aelteste Vorhersage mit 1-3 h Vorlauf
const S = { A: [0, 0], B: [0, 0], C: [0, 0], D: [0, 0] }, nachts = { A: [0, 0], B: [0, 0], C: [0, 0], D: [0, 0] };
let paare = 0;
const zeiten = new Set(); N.forEach(n => Object.keys(mess[n]).forEach(t => zeiten.add(t)));
for (const t of zeiten) for (const x of N) {
  const o = mess[x][t], f = fc(x, t); if (o == null || f == null) continue;
  const fehler = N.filter(y => y !== x && mess[y][t] != null && fc(y, t) != null).map(y => ({ e: mess[y][t] - fc(y, t), g: 1 / Math.pow(Math.max(1, km(ST[x], ST[y])), 2) }));
  if (fehler.length < 3) continue;
  const gw = fehler.reduce((s, q) => s + q.g, 0), idw = fehler.reduce((s, q) => s + q.e * q.g, 0) / gw, mw = fehler.reduce((s, q) => s + q.e, 0) / fehler.length;
  const p = { A: f, B: f + idw, C: f + mw, D: f + .6 * idw + .4 * mw };
  const nacht = (h => h >= 20 || h <= 5)(+t.slice(11, 13));   // UTC-Stunden, grob die Nacht
  paare++;
  for (const k in p) { const d = p[k] - o; S[k][0] += d * d; S[k][1]++; if (nacht) { nachts[k][0] += d * d; nachts[k][1]++; } }
}
console.log('Zeilen im Protokoll:', zeilen.length, '| auswertbare Paare:', paare);
if (paare < 100) console.log('(noch zu wenig fuer eine belastbare Aussage: mindestens ca. 100 Paare, nach einer Woche etwa 600)');
const fmt = (o, k) => o[k][1] ? Math.sqrt(o[k][0] / o[k][1]).toFixed(2) + ' °C (' + o[k][1] + ')' : '-';
for (const k of ['A', 'B', 'C', 'D']) console.log(k, { A: 'nur Vorhersage', B: 'Anzeige (1/d²)', C: 'Mittelwert aller Fehler', D: 'B zu 40 % geglaettet' }[k].padEnd(26), 'alle Stunden', fmt(S, k).padEnd(16), 'Nacht', fmt(nachts, k));
