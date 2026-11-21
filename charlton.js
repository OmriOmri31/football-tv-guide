// Charlton (Israel: Sport 1, 2, 3, 4, 6) official EPG → fixture matching.
// EPG JSON: https://sport1.maariv.co.il/wp-json/sport1/v1/broadcast (times are Israel local).
import { sameTeam } from './rules.js';

// EPG channel ids → on-air names. Verified against the rendered schedule page (channel 1's logo is Sport 6, channel 2 is Sport 1).
export const CHARLTON_CH = { 1: 'Sport 6', 2: 'Sport 1', 3: 'Sport 2', 4: 'Sport 3', 5: 'Sport 4' };

const COMP_HE = [
  [/^הליגה האנגלית|^פרמייר ?ליג/, 'PL'], [/^צ'מפיונשיפ/, 'CHAMP'], [/^הגביע האנגלי/, 'FAC'], [/^גביע הליגה האנגלי|^גביע קראבאו/, 'EFLC'],
  [/^הליגה הגרמנית השנייה/, 'OTHER'], [/^הליגה הגרמנית/, 'BUND'], [/^ליגה איטלקית|^הליגה האיטלקית/, 'SERIEA'], [/^ליגה ספרדית|^הליגה הספרדית/, 'LALIGA'],
  [/^ליגה צרפתית|^הליגה הצרפתית/, 'L1'], [/^הליגה האירופית/, 'UEL'], [/^קונפרנס ליג|^הקונפרנס/, 'UECL'], [/^ליגת האלופות(?! אסיה| בכדוריד)/, 'UCL'],
  [/^ליגת ווינר|^ליגת העל/, 'ISR'], [/^גביע המדינה|^גביע הטוטו/, 'ISRCUP'], [/^הליגה הסקוטית/, 'SPL'],
];

// Hebrew club names as Charlton writes them → English (matched with sameTeam).
const HE = {
  "ארסנל": 'Arsenal', "אסטון וילה": 'Aston Villa', "בורנמות'": 'Bournemouth', "בורנמות": 'Bournemouth', "ברנטפורד": 'Brentford', "ברייטון": 'Brighton',
  "צ'לסי": 'Chelsea', "קובנטרי": 'Coventry City', "ק' פאלאס": 'Crystal Palace', "קריסטל פאלאס": 'Crystal Palace', "אברטון": 'Everton', "פולהאם": 'Fulham',
  "האל": 'Hull City', "איפסוויץ'": 'Ipswich Town', "לידס": 'Leeds United', "ליברפול": 'Liverpool', "מנ' סיטי": 'Manchester City', "מנצ'סטר סיטי": 'Manchester City',
  "מנ' יונייטד": 'Manchester United', "מנצ'סטר יונייטד": 'Manchester United', "ניוקאסל": 'Newcastle United', "נוטינגהאם": 'Nottingham Forest', "נוטינגהאם פורסט": 'Nottingham Forest',
  "סנדרלנד": 'Sunderland', "טוטנהאם": 'Tottenham Hotspur', "ווסטהאם": 'West Ham United', "וסטהאם": 'West Ham United', "וולבס": 'Wolverhampton Wanderers', "ברנלי": 'Burnley',
  "לסטר": 'Leicester City', "סאותהמפטון": 'Southampton', "נוריץ'": 'Norwich City', "מילוול": 'Millwall', "ק.פ.ר": 'Queens Park Rangers', "בלקבורן": 'Blackburn Rovers',
  "דרבי": 'Derby County', "מידלסברו": 'Middlesbrough', "סטוק": 'Stoke City', "שפילד יונייטד": 'Sheffield United', "שפילד וונסדיי": 'Sheffield Wednesday', "ווטפורד": 'Watford',
  "ווסט ברום": 'West Bromwich Albion', "בריסטול סיטי": 'Bristol City', "פרסטון": 'Preston North End', "סוונסי": 'Swansea City', "קארדיף": 'Cardiff City', "פורטסמות'": 'Portsmouth',
  "אוקספורד": 'Oxford United', "צ'רלטון": 'Charlton Athletic', "רקסהאם": 'Wrexham', "ברמינגהאם": 'Birmingham City', "בולטון": 'Bolton Wanderers', "לוטון": 'Luton Town', "פליימות'": 'Plymouth Argyle',
  "באיירן מינכן": 'Bayern Munich', "דורטמונד": 'Borussia Dortmund', "לברקוזן": 'Bayer Leverkusen', "לייפציג": 'RB Leipzig', "מנשנגלאדבך": "Borussia M'gladbach", "שטוטגרט": 'Stuttgart',
  "פרנקפורט": 'Eintracht Frankfurt', "וולפסבורג": 'Wolfsburg', "פרייבורג": 'Freiburg', "הופנהיים": 'Hoffenheim', "מיינץ": 'Mainz', "אאוגסבורג": 'Augsburg', "ורדר ברמן": 'Werder Bremen',
  "המבורג": 'Hamburg', "קלן": 'Köln', "שאלקה": 'Schalke 04', "יוניון ברלין": 'Union Berlin', "היידנהיים": 'Heidenheim', "סט. פאולי": 'St. Pauli', "פאדרבורן": 'Paderborn', "אלברסברג": 'Elversberg',
  "יובנטוס": 'Juventus', "מילאן": 'AC Milan', "אינטר": 'Internazionale', "נאפולי": 'Napoli', "רומא": 'Roma', "לאציו": 'Lazio', "אטאלנטה": 'Atalanta', "פיורנטינה": 'Fiorentina',
  "בולוניה": 'Bologna', "טורינו": 'Torino', "גנואה": 'Genoa', "לצ'ה": 'Lecce', "פארמה": 'Parma', "קומו": 'Como', "קליארי": 'Cagliari', "אודינזה": 'Udinese', "ונציה": 'Venezia',
  "סאסואולו": 'Sassuolo', "מונזה": 'Monza', "פרוזינונה": 'Frosinone', "ורונה": 'Verona', "פיזה": 'Pisa', "קרמונזה": 'Cremonese',
  "ריאל מדריד": 'Real Madrid', "ברצלונה": 'Barcelona', "אתלטיקו מדריד": 'Atletico Madrid', "סביליה": 'Sevilla', "ויאריאל": 'Villarreal', "בטיס": 'Real Betis', "ולנסיה": 'Valencia',
  "פ.ס.ז'": 'Paris Saint-Germain', "פריז סן ז'רמן": 'Paris Saint-Germain', "מרסיי": 'Marseille', "ליון": 'Lyon', "מונאקו": 'Monaco', "ליל": 'Lille', "ניס": 'Nice', "לאנס": 'Lens',
  "איאקס": 'Ajax', "פיינורד": 'Feyenoord', "פ.ס.וו איינדהובן": 'PSV Eindhoven', "איינדהובן": 'PSV Eindhoven', "טוונטה": 'Twente', "בנפיקה": 'Benfica', "פורטו": 'Porto', "ספורטינג ליסבון": 'Sporting CP',
  "סלטיק": 'Celtic', "ריינג'רס": 'Rangers', "גלטסראיי": 'Galatasaray', "פנרבחצ'ה": 'Fenerbahce', "בשיקטאש": 'Besiktas', "אולימפיאקוס": 'Olympiacos', "פנאתינייקוס": 'Panathinaikos',
  "אומוניה ניקוסיה": 'Omonia Nicosia', "אפואל": 'APOEL', "תון": 'Thun', "קלאב ברוז'": 'Club Brugge', "אנדרלכט": 'Anderlecht',
  "מכבי חיפה": 'Maccabi Haifa', "מכבי ת\"א": 'Maccabi Tel-Aviv', "מכבי תל אביב": 'Maccabi Tel-Aviv', "הפועל ב\"ש": "Hapoel Be'er Sheva", "הפועל באר שבע": "Hapoel Be'er Sheva",
  "בית\"ר ירושלים": 'Beitar Jerusalem', "הפועל ת\"א": 'Hapoel Tel Aviv', "הפועל תל אביב": 'Hapoel Tel Aviv', "הפועל חיפה": 'Hapoel Haifa', "מכבי נתניה": 'Maccabi Netanya',
  "מכבי פ\"ת": 'Maccabi Petah-Tikva', "הפועל פ\"ת": 'Hapoel Petah Tikva', "בני סכנין": 'Bnei Sakhnin', "הפועל ר\"ג": 'Hapoel Ramat Gan', "עירוני טבריה": 'Ironi Tiberias',
  "עירוני ק\"ש": 'Ironi Kiryat Shmona', "עירוני קרית שמונה": 'Ironi Kiryat Shmona', "מ.ס אשדוד": 'Ashdod', "אשדוד": 'Ashdod', "הפועל ירושלים": 'Hapoel Jerusalem', "הפועל קטמון": 'Hapoel Katamon',
  "מכבי בני ריינה": 'Maccabi Raina', "הפועל חדרה": 'Hapoel Hadera',
};
const clean = (s) => s.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
const heToEn = (s) => HE[clean(s)] || null;

function israelToUtc(local) { // "YYYY-MM-DD HH:MM:SS" in Asia/Jerusalem
  const [d, t] = local.split(' ');
  const [y, m, dd] = d.split('-').map(Number), [hh, mi] = t.split(':').map(Number);
  for (const off of [2, 3]) {
    const ms = Date.UTC(y, m - 1, dd, hh - off, mi);
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).format(new Date(ms)));
    if (h === hh) return ms;
  }
  return Date.UTC(y, m - 1, dd, hh - 2, mi);
}

export function parseEpg(epg) {
  const shows = [];
  for (const ch of epg?.broadcast || []) {
    const name = CHARLTON_CH[ch.id] || ch.title;
    for (const s of ch.shows || []) {
      if (!s.live) continue; // live broadcasts only (no replays / condensed)
      const desc = (s.description || '').trim();
      const comp = (COMP_HE.find(([re]) => re.test(desc)) || [])[1] || null;
      const title = clean(s.title || '');
      const parts = title.split(' - ');
      const multi = parts.length < 2 && /חגיגה|כל המשחקים|ערב אנגלי|מחזור/.test(title) && !!comp;
      if (parts.length < 2 && !multi) continue;
      shows.push({ channel: name, start: israelToUtc(s.start_time), title: s.title, desc, comp, multi,
        home: parts.length >= 2 ? heToEn(parts[0]) : null, away: parts.length >= 2 ? heToEn(parts[1]) : null });
    }
  }
  return shows;
}

export function epgHorizon(shows) {
  return shows.length ? Math.max(...shows.map((s) => s.start)) : 0;
}

// Return matching live shows (one fixture can be on several channels).
export function charltonFor(fx, shows, overlap) {
  const k = new Date(fx.kickoff).getTime();
  const win = shows.filter((s) => s.start >= k - 50 * 60e3 && s.start <= k + 10 * 60e3);
  const byTeam = win.filter((s) => !s.multi && ((s.home && (sameTeam(s.home, fx.home) || sameTeam(s.home, fx.away))) || (s.away && (sameTeam(s.away, fx.away) || sameTeam(s.away, fx.home)))));
  if (byTeam.length) return { shows: byTeam, how: 'team' };
  const sameComp = win.filter((s) => s.comp && s.comp === fx.comp);
  const multi = sameComp.filter((s) => s.multi);
  if (multi.length) return { shows: multi, how: 'multi' };
  // Unmapped Hebrew names: accept only if it is the only game of that competition at that time.
  const single = sameComp.filter((s) => !s.multi && !s.home && !s.away);
  if (single.length === 1 && overlap <= 1) return { shows: single, how: 'unique' };
  return null;
}
