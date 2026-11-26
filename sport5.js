// Official Sport 5 (RGE) schedule: https://www.sport5.co.il/html/pages/broadcastsheet.html
// Each channel has its own tab, including a separate 4K tab. Sport 5 and Sport 5 4K
// often carry different programmes (e.g. Champions League on Sport 5, F1 on Sport 5 4K).
import { sameTeam } from './rules.js';
import { heToEn, israelToUtc, cleanHe } from './charlton.js';

export const SPORT5_TABS = {
  '5': 'Sport 5',
  '5P': 'Sport 5 Plus',
  'LIVE': 'Sport 5 Live',
  '5STARS': 'Sport 5 Stars',
  '5MAX': 'Sport 5 Max',
  'GOLD': 'Sport 5 Gold',
  '4K': 'Sport 5 4K',
};
// 5MOBILE mirrors Sport 5 — skip it.
export const SPORT5_URL = 'https://www.sport5.co.il/html/pages/broadcastsheet.html';
export const SPORT5_AJAX = 'https://www.sport5.co.il/Ajax/GetBroadcastSheetData.aspx';

// Extra Hebrew abbreviations as Sport 5 writes them (after י-ם etc. are expanded).
const EXTRA = {
  "בית\"ר ירושלים": 'Beitar Jerusalem', "ביתר ירושלים": 'Beitar Jerusalem',
  "הפועל ירושלים": 'Hapoel Jerusalem',
  "הפועל פתח תקווה": 'Hapoel Petah Tikva', "מכבי פתח תקווה": 'Maccabi Petah-Tikva',
  "איטליה": 'Italy', "טורקיה": 'Turkey', "הולנד": 'Netherlands', "ישראל": 'Israel',
  "סרביה": 'Serbia', "ליטא": 'Lithuania',
  "אמפולי": 'Empoli', "ורונה": 'Verona',
  "סבאח": 'Sabah', "קלאב ברוז'": 'Club Brugge', "ברוז'": 'Club Brugge',
};

function expandAbbr(s) {
  return s
    .replace(/\u200f|\u200e/g, '')
    .replace(/י-ם/g, 'ירושלים')
    .replace(/פ['׳''״\"]ת/g, 'פתח תקווה')
    .replace(/ת['׳''״\"]א/g, 'תל אביב')
    .replace(/ב['׳''״\"]ש/g, 'באר שבע')
    .replace(/ק['׳''״\"]ש/g, 'קרית שמונה')
    .replace(/ר['׳''״\"]ג/g, 'רמת גן')
    .replace(/בית['׳''״\"]ר/g, 'בית"ר')
    .replace(/פ\.?\s*ס\.?\s*ז['׳']?/g, "פ.ס.ז'")
    .replace(/פסז['׳']?/g, "פ.ס.ז'");
}

function prepTitle(raw) {
  let t = expandAbbr(cleanHe(raw || ''));
  t = t.replace(/[;،].*$/, '').replace(/\s*מח\.?\s*\d+.*$/, '').replace(/\s*סיבוב.*$/, '');
  return t.trim();
}

function teamsFrom(title) {
  const t = prepTitle(title);
  // Prefer " - " then a single hyphen (abbreviations already expanded so י-ם is gone).
  const parts = t.includes(' - ') ? t.split(' - ') : t.split('-').map((x) => x.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { home: null, away: null };
  const ev = (s) => EXTRA[s] || heToEn(s) || EXTRA[cleanHe(s)] || heToEn(cleanHe(s));
  return { home: ev(parts[0].trim()), away: ev(parts[1].trim()), raw: parts };
}

function isLiveRow(td) {
  if (!td) return false;
  if (/ישיר/.test(td.textContent || '')) return true;
  return !![...td.querySelectorAll?.('img') || []].find((i) => /ישיר|live/i.test((i.alt || '') + (i.title || '') + (i.src || '')));
}

// Parse one channel-tab HTML page into shows. `date` is YYYY-M-D or YYYY-MM-DD (Israel calendar day).
export function parseSheet(html, channel, date) {
  const shows = [];
  if (!html || /no-programs/.test(html)) return shows;
  const [y, mo, d] = date.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  const day = `${y}-${pad(mo)}-${pad(d)}`;
  // Node (no DOM) and the browser both work with a regex over rows.
  const rows = html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi);
  for (const row of rows) {
    const tr = row[0];
    if (/tr-header/.test(tr)) continue;
    const timeM = tr.match(/(\d{1,2}:\d{2})/);
    const titleM = tr.match(/class="text"[^>]*>([\s\S]*?)<\/td>/i) || tr.match(/<td class="text">([\s\S]*?)<\/td>/i);
    if (!timeM || !titleM) continue;
    const title = cleanHe(titleM[1].replace(/<[^>]+>/g, ' '));
    if (!title) continue;
    const live = /ישיר|img-live/i.test(tr);
    const start = israelToUtc(`${day} ${timeM[1].padStart(5, '0')}:00`);
    const { home, away } = teamsFrom(title);
    shows.push({ channel, title, start, live, home, away });
  }
  return shows;
}

export function sport5Horizon(shows) {
  const live = (shows || []).filter((s) => s.live);
  const src = live.length ? live : (shows || []);
  return src.length ? Math.max(...src.map((s) => s.start)) : 0;
}

// Official EPG match for a fixture. Only live ("ישיר") rows count — replays on the 4K
// channel must not make a live match look like it is in 4K.
export function sport5For(fx, shows, overlap = 1) {
  if (!shows?.length) return null;
  const k = new Date(fx.kickoff).getTime();
  const NOT_FOOTBALL = /פורמולה|formula|\bf1\b|מוטו|moto\s*gp|u?fc\b|חדשות|אולפן|חמש באוויר|יציע|מגזין|\bnba\b|\bnfl\b|\bnhl\b|טופ 10|והרי התחזית|שייט|שער השבת|מעקבדיה|ריסטארט/i;
  const win = shows.filter((s) => s.live && s.start >= k - 50 * 60e3 && s.start <= k + 20 * 60e3 && !NOT_FOOTBALL.test(s.title));
  const byTeam = win.filter((s) => (s.home && (sameTeam(s.home, fx.home) || sameTeam(s.home, fx.away)))
    || (s.away && (sameTeam(s.away, fx.away) || sameTeam(s.away, fx.home))));
  if (byTeam.length) return { shows: byTeam, how: 'team' };
  return null;
}

export function isSport5Family(name) {
  if (isSport54K(name)) return false;
  return /^(sport ?5|5sport|5 ?(plus|live|stars|gold|max))\b/i.test(name);
}
export function isSport54K(name) {
  return /sport ?5 ?4k|5sport ?4k|^5 ?4k$/i.test(name);
}

// Browser (and tests): pull official tabs. `get` is async (url) => text|null.
export async function fetchSport5(get, { days = 5, types = Object.keys(SPORT5_TABS) } = {}) {
  const shows = [];
  const now = new Date();
  // Iterate Israel calendar days.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: 'numeric', day: 'numeric' });
  const startIl = fmt.format(now); // YYYY-M-D or YYYY-MM-DD depending on engine
  const [ys, ms, ds] = startIl.split('-').map(Number);
  const origin = Date.UTC(ys, ms - 1, ds, 12);
  for (let i = 0; i < days; i++) {
    const dt = new Date(origin + i * 86400000);
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
    const date = `${y}-${m}-${d}`; // official JS format (unpadded)
    const dateP = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    for (const typ of types) {
      const html = await get(`${SPORT5_AJAX}?Type=${encodeURIComponent(typ)}&Date=${dateP}`)
        || await get(`${SPORT5_AJAX}?Type=${encodeURIComponent(typ)}&Date=${date}`);
      if (!html) continue;
      shows.push(...parseSheet(html, SPORT5_TABS[typ], dateP));
    }
  }
  return shows;
}

// Snapshot rows store {channel,title,date,time,live}; turn them into the same shape as parseSheet.
export function hydrateShows(rows) {
  const out = [];
  for (const s of rows || []) {
    if (s.start && (s.home !== undefined || s.away !== undefined)) { out.push(s); continue; }
    const date = s.date, time = s.time;
    if (!date || !time) { if (s.start) out.push({ ...s, ...teamsFrom(s.title || '') }); continue; }
    const start = s.start || israelToUtc(`${date} ${time}:00`);
    out.push({ channel: s.channel, title: s.title, start, live: !!s.live, ...teamsFrom(s.title || '') });
  }
  return out;
}
