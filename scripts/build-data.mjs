// Builds data/listings.json from public TV listing pages.
// Runs in GitHub Actions on a schedule (no API keys, no secrets).
//  - UK: live-footballontv.com (all UK football on TV, months ahead)
//  - Israel + Singapore: livesoccertv.com match pages (per-country channel lists), next N days
import { writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 football-tv-guide/1.0';
const DAYS = Number(process.env.LSTV_DAYS || 9);
const DELAY = Number(process.env.LSTV_DELAY_MS || 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…' };
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const strip = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

async function get(url, tries = 3) {
  // curl (not Node fetch): some listing sites reject Node's TLS client.
  for (let i = 0; i < tries; i++) {
    try {
      const { stdout } = await run('curl', ['-sS', '-L', '--compressed', '--max-time', '30', '-A', UA, '-H', 'Accept-Language: en-GB,en;q=0.9', '-w', '\n__HTTP__%{http_code}', url], { maxBuffer: 64 * 1024 * 1024 });
      const k = stdout.lastIndexOf('\n__HTTP__');
      const code = Number(stdout.slice(k + 9));
      if (code === 200) return stdout.slice(0, k);
      console.warn(`HTTP ${code} ${url}`);
      if (code === 404) return null;
    } catch (e) { console.warn(`fetch fail ${url}: ${e.message}`); }
    await sleep(1500 * (i + 1));
  }
  return null;
}

// ---------- UK: live-footballontv ----------
const MONTHS = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
// Convert a UK wall-clock time to a UTC ISO string (handles GMT/BST).
function ukToUtc(y, m, d, hh, mm) {
  // Try BST (UTC+1) and GMT (UTC+0); pick the one whose London rendering matches.
  for (const off of [0, 1]) {
    const t = Date.UTC(y, m, d, hh - off, mm);
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', day: '2-digit' }).formatToParts(new Date(t));
    const H = Number(parts.find((p) => p.type === 'hour').value);
    const D = Number(parts.find((p) => p.type === 'day').value);
    if (H === hh && D === d) return new Date(t).toISOString();
  }
  return new Date(Date.UTC(y, m, d, hh, mm)).toISOString();
}

async function ukListings() {
  const h = await get('https://www.live-footballontv.com/');
  if (!h) return [];
  const out = [];
  const re = /<div class="fixture-date">([^<]*)<\/div>|<div class="fixture">([\s\S]*?)<\/div><\/div><\/div>/g;
  let date = null, m;
  while ((m = re.exec(h))) {
    if (m[1]) {
      const dm = m[1].match(/(\d+)\w*\s+(\w+)\s+(\d{4})/);
      date = dm ? { d: Number(dm[1]), m: MONTHS[dm[2]], y: Number(dm[3]) } : null;
      continue;
    }
    if (!date) continue;
    const b = m[2];
    const time = (b.match(/fixture__time">([^<]*)/) || [])[1] || '';
    const teams = strip((b.match(/fixture__teams">([\s\S]*?)<\/div>/) || [])[1] || '');
    const comp = strip((b.match(/fixture__competition">([\s\S]*?)<\/div>/) || [])[1] || '');
    const channels = [...b.matchAll(/channel-pill[^>]*>([^<]*)</g)].map((x) => strip(x[1])).filter(Boolean);
    const tm = time.match(/(\d{1,2}):(\d{2})/);
    const [home, away] = teams.split(/\s+v\s+/);
    if (!tm || !away) continue;
    out.push({
      region: 'UK', source: 'live-footballontv.com',
      kickoff: ukToUtc(date.y, date.m, date.d, Number(tm[1]), Number(tm[2])),
      home: home.trim(), away: away.trim(), comp, channels,
    });
  }
  return out;
}

// ---------- Israel + Singapore: livesoccertv ----------
const LSTV_COMPS = new Set([
  'England - Premier League', 'England - Championship', 'England - FA Cup', 'England - EFL Cup', 'England - League Cup', 'England - Carabao Cup', 'England - Community Shield',
  'Europe - UEFA Champions League', 'Europe - UEFA Europa League', 'Europe - UEFA Conference League', 'Europe - UEFA Europa Conference League', 'Europe - UEFA Super Cup',
  'Spain - La Liga', 'Spain - Copa del Rey', 'Germany - Bundesliga', 'Germany - DFB Pokal', 'Italy - Serie A', 'Italy - Coppa Italia', 'France - Ligue 1',
  'Scotland - Scottish Premiership', 'Israel - Ligat Ha\'Al', 'Israel - State Cup', 'Israel - Toto Cup',
]);
const KEEP_COUNTRIES = { Israel: 'IL', Singapore: 'SG', USA: 'US', Australia: 'AU', Canada: 'CA', India: 'IN', 'New Zealand': 'NZ' };

function ymd(d) { return d.toISOString().slice(0, 10); }

let lstvCount = 0;
async function lstvListings() {
  const matches = new Map();
  const cidName = new Map();
  const now = new Date();
  for (let i = 0; i < DAYS; i++) {
    const day = ymd(new Date(now.getTime() + i * 86400000));
    const h = await get(`https://www.livesoccertv.com/schedules/${day}/`);
    await sleep(DELAY);
    if (!h) continue;
    // Walk comp header rows and match rows in order.
    const re = /<tr class="sortable_comp"[\s\S]*?<span class="flag [^"]*">([^<]*)<\/span>|<tr id="(\d+)"[^>]*data-ko="[^"]*"([\s\S]*?)<\/tr>/g;
    for (const x of h.matchAll(/<tr class="sortable_comp" id="(\d+)"[\s\S]*?<span class="flag [^"]*">([^<]*)<\/span>/g)) cidName.set(x[1], strip(x[2]));
    for (const x of h.matchAll(/showMatches\('(\d+)'[^)]*\)"[\s\S]*?<span class="flag [^"]*">([^<]*)<\/span>/g)) cidName.set(x[1], strip(x[2]));
    let comp = null, m;
    while ((m = re.exec(h))) {
      if (m[1]) { comp = strip(m[1]); continue; }
      if (!comp || !LSTV_COMPS.has(comp)) continue;
      const b = m[3];
      const link = b.match(/href="(\/match\/[^"#]*)[^"]*" title="([^"]*)"/);
      const dv = b.match(/dv='(\d+)'/);
      if (!link || !dv) continue;
      const [home, away] = decode(link[2]).split(/\s+vs\s+/);
      if (!away) continue;
      matches.set(m[2], { id: m[2], path: link[1], comp, kickoff: new Date(Number(dv[1])).toISOString(), home, away });
    }
  }
  // Competitions collapsed on the day pages (e.g. Ligat Ha'Al) load via a robots-disallowed endpoint,
  // so for Israeli football we read the public team pages instead.
  const until = now.getTime() + DAYS * 86400000;
  const comp = await get('https://www.livesoccertv.com/competitions/israel/premier-league/');
  await sleep(DELAY);
  const slugs = new Set();
  if (comp) {
    for (const x of comp.matchAll(/href="\/teams\/israel\/([^"/]+)\/"/g)) slugs.add(x[1]);
    for (const x of comp.matchAll(/<tr id="\d+"[^>]*data-cid="143"[\s\S]*?href="\/match\/([^"/]+)\//g)) for (const t of x[1].split('-vs-')) slugs.add(t);
  }
  for (const slug of slugs) {
    const h = await get(`https://www.livesoccertv.com/teams/israel/${slug}/`);
    await sleep(DELAY);
    if (!h) continue;
    for (const m of h.matchAll(/<tr id="(\d+)"[^>]*data-ko="[^"]*"[^>]*data-cid="(\d+)"([\s\S]*?)<\/tr>/g)) {
      const cname = cidName.get(m[2]) || (m[2] === '143' ? "Israel - Ligat Ha'Al" : null);
      if (!cname || !LSTV_COMPS.has(cname) || matches.has(m[1])) continue;
      const link = m[3].match(/href="(\/match\/[^"#]*)[^"]*" title="([^"]*)"/);
      const dv = m[3].match(/dv='(\d+)'/);
      if (!link || !dv) continue;
      const t = Number(dv[1]);
      if (t < now.getTime() - 3 * 3600e3 || t > until) continue;
      const [home, away] = decode(link[2]).split(/\s+vs\s+/);
      if (away) matches.set(m[1], { id: m[1], path: link[1], comp: cname, kickoff: new Date(t).toISOString(), home, away });
    }
  }
  console.log(`livesoccertv: ${matches.size} matches in tracked competitions (Israeli team pages: ${slugs.size})`);
  const out = [];
  for (const mt of matches.values()) {
    const h = await get(`https://www.livesoccertv.com${mt.path}`);
    await sleep(DELAY);
    if (!h) continue;
    const byCountry = {};
    for (const x of h.matchAll(/<span class="flag [^"]*">([^<]*)<\/span><\/td><td valign='top'>([\s\S]*?)<\/td><\/tr>/g)) {
      const c = strip(x[1]);
      if (!KEEP_COUNTRIES[c]) continue;
      byCountry[c] = [...x[2].matchAll(/>([^<]+)<\/a>/g)].map((y) => strip(y[1])).filter(Boolean);
    }
    const base = { source: 'livesoccertv.com', url: `https://www.livesoccertv.com${mt.path}`, kickoff: mt.kickoff, home: mt.home, away: mt.away, comp: mt.comp };
    // Only emit a region when the page actually has a row for that country.
    // A missing country row means "no data", NOT "not on TV there" (this caused the Spurs v Ipswich / Sport 1 bug).
    out.push({ ...base, region: 'FX', channels: [] }); // fixture-only row (used when the APIs lack a team)
    for (const [country, region] of Object.entries(KEEP_COUNTRIES)) {
      if (byCountry[country]) out.push({ ...base, region, channels: byCountry[country] });
    }
    lstvCount++;
  }
  return out;
}

// Charlton (Sport 1-4, 6) official EPG. The browser fetches it live; this snapshot is the fallback.
async function charltonEpg() {
  const t = await get('https://sport1.maariv.co.il/wp-json/sport1/v1/broadcast');
  if (!t) return null;
  try { const d = JSON.parse(t); return Array.isArray(d.broadcast) ? d : null; } catch { return null; }
}

await mkdir('data', { recursive: true });
const [uk, lstv, epg] = await Promise.all([ukListings(), lstvListings(), charltonEpg()]);
if (epg) await writeFile('data/charlton.json', JSON.stringify(epg));
console.log(`charlton EPG: ${epg ? epg.broadcast.reduce((n, c) => n + c.shows.length, 0) + ' shows' : 'unavailable'}`);
const data = {
  generatedAt: new Date().toISOString(),
  sources: {
    UK: { name: 'live-footballontv.com', count: uk.length },
    IL_SG: { name: 'livesoccertv.com', count: lstvCount, days: DAYS },
    IL_EPG: { name: 'sport1.maariv.co.il (Charlton EPG)', ok: !!epg },
  },
  listings: [...uk, ...lstv],
};
await writeFile('data/listings.json', JSON.stringify(data));
console.log(`wrote data/listings.json: UK ${uk.length}, livesoccertv matches ${lstvCount}`);
if (!uk.length && !lstv.length) process.exit(1);
