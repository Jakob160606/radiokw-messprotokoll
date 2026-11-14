// Schreibt stuendlich auf, was der Wetterdienst (ueber Bright Sky) an 5 Messstationen vorhersagt und misst.
// Daraus laesst sich spaeter pruefen, ob die Temperaturrechnung der Radar-Anzeige stimmt (auswerten.js).
// Je Lauf eine Zeile in data/protokoll.jsonl: { lauf, st: { Name: { vor: [[Zeit, Temp]], mess: [[Zeit, Temp]] } } }
const fs = require('fs');
const STATIONEN = { Baerl: ['13670', 51.52, 6.70], Geldern: ['01590', 51.4942, 6.2463], Borken: ['00617', 51.87, 6.88],
  Essen: ['01303', 51.4041, 6.9677], Duesseldorf: ['01078', 51.30, 6.77] };
const BS = 'https://api.brightsky.dev/weather?tz=UTC&';
async function holen(q) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(BS + q); if (r.ok) return r.json(); } catch (e) {}
    await new Promise(r => setTimeout(r, 3000));
  }
  return null;
}
(async () => {
  const jetzt = Date.now(), tag = d => new Date(jetzt + d * 864e5).toISOString().slice(0, 10), erg = {};
  for (const n in STATIONEN) {
    const [id, lat, lon] = STATIONEN[n];
    const m = await holen(`dwd_station_id=${id}&date=${tag(-1)}&last_date=${tag(1)}`);       // Messungen (vergangene Stunden)
    const v = await holen(`lat=${lat}&lon=${lon}&date=${tag(0)}&last_date=${tag(1)}`);       // Punktvorhersage MOSMIX (kommende Stunden)
    if (!m || !v) continue;
    const art = j => Object.fromEntries((j.sources || []).map(s => [s.id, s.observation_type]));
    const am = art(m), av = art(v);
    erg[n] = {
      mess: (m.weather || []).filter(x => typeof x.temperature === 'number' && Date.parse(x.timestamp) <= jetzt && Date.parse(x.timestamp) > jetzt - 6 * 36e5 && am[x.source_id] !== 'forecast').map(x => [x.timestamp.slice(0, 16), x.temperature]),
      vor: (v.weather || []).filter(x => typeof x.temperature === 'number' && Date.parse(x.timestamp) > jetzt - 36e5 && Date.parse(x.timestamp) <= jetzt + 6 * 36e5 && av[x.source_id] === 'forecast').map(x => [x.timestamp.slice(0, 16), x.temperature])
    };
  }
  if (!Object.keys(erg).length) { console.error('keine Daten'); process.exit(1); }
  fs.mkdirSync('data', { recursive: true });
  fs.appendFileSync('data/protokoll.jsonl', JSON.stringify({ lauf: new Date(jetzt).toISOString().slice(0, 16), st: erg }) + '\n');
  console.log('geschrieben:', Object.entries(erg).map(([n, e]) => n + ' mess ' + e.mess.length + ' vor ' + e.vor.length).join(', '));
})();
