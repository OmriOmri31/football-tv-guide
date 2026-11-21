// Channel-matching engine: confirmed listings first, then rights rules.
// Every rights rule below cites what it is based on; anything we could not verify is marked 'uncertain'.

export const REGIONS = {
  UK: { name: 'United Kingdom', flag: '🇬🇧', tz: 'Europe/London' },
  IL: { name: 'Israel', flag: '🇮🇱', tz: 'Asia/Jerusalem' },
  SG: { name: 'Singapore', flag: '🇸🇬', tz: 'Asia/Singapore' },
};

// ---------- competition keys ----------
const ESPN_COMP = {
  'eng.1': 'PL', 'eng.2': 'CHAMP', 'eng.3': 'EFL', 'eng.4': 'EFL', 'eng.fa': 'FAC', 'eng.league_cup': 'EFLC', 'eng.charity': 'SHIELD',
  'uefa.champions': 'UCL', 'uefa.europa': 'UEL', 'uefa.europa.conf': 'UECL', 'uefa.super_cup': 'USC',
  'uefa.champions_qual': 'UCLQ', 'uefa.europa_qual': 'UELQ', 'uefa.europa.conf_qual': 'UECLQ',
  'esp.1': 'LALIGA', 'ger.1': 'BUND', 'ita.1': 'SERIEA', 'fra.1': 'L1', 'sco.1': 'SPL', 'isr.1': 'ISR',
};
export function compKey({ slug, name }) {
  if (slug && ESPN_COMP[slug]) return ESPN_COMP[slug];
  const n = (name || '').toLowerCase();
  if (/women|u1\d|u2\d|youth|primavera/.test(n)) return 'OTHER';
  if (/champions league/.test(n) && /qualif/.test(n)) return 'UCLQ';
  if (/champions league/.test(n)) return 'UCL';
  if (/conference league/.test(n)) return 'UECL';
  if (/europa league/.test(n)) return 'UEL';
  if (/super cup/.test(n) && /uefa/.test(n)) return 'USC';
  if (/israel|ligat|ha'al/.test(n)) return /cup|toto|state/.test(n) ? 'ISRCUP' : 'ISR';
  if (/^(english )?premier league$|england - premier league|english premier league/.test(n)) return 'PL';
  if (/championship/.test(n) && /england|english|efl|^championship$/.test(n)) return 'CHAMP';
  if (/fa cup/.test(n)) return 'FAC';
  if (/efl cup|league cup|carabao/.test(n)) return 'EFLC';
  if (/la ?liga/.test(n)) return 'LALIGA';
  if (/bundesliga/.test(n) && !/2|3\./.test(n)) return 'BUND';
  if (/serie a/.test(n)) return 'SERIEA';
  if (/ligue 1/.test(n)) return 'L1';
  if (/scottish premiership/.test(n)) return 'SPL';
  return 'OTHER';
}
export const COMP_NAME = {
  PL: 'Premier League', CHAMP: 'EFL Championship', EFL: 'EFL League One/Two', FAC: 'FA Cup', EFLC: 'Carabao (EFL) Cup', SHIELD: 'Community Shield',
  UCL: 'Champions League', UEL: 'Europa League', UECL: 'Conference League', USC: 'UEFA Super Cup', UCLQ: 'UCL qualifier', UELQ: 'UEL qualifier', UECLQ: 'UECL qualifier',
  LALIGA: 'LaLiga', BUND: 'Bundesliga', SERIEA: 'Serie A', L1: 'Ligue 1', SPL: 'Scottish Premiership', ISR: "Ligat Ha'Al", ISRCUP: 'Israeli cup', OTHER: 'Other',
};

// ---------- which listed channels are Omri's ----------
// UK: Sky Sports (all incl. Ultra HDR 4K), TNT Sports (all incl. Ultimate 4K), TLC (when it shows football).
// IL: Charlton Sport 1-4 and the Sport 5 family (RGE: Sport 5, 5Plus, 5Live, 5Stars, 5Gold, 5 4K).
//     Note: Charlton also runs Sport 6, which is NOT in the user's list.
// SG: all Singapore sports channels (StarHub Hub Premier/Hub Sports, beIN SG, Singtel mio Sports, SPOTV...).
export function classify(region, raw) {
  let name = raw.trim();
  let num = null;
  const m = name.match(/^(\d{2,4})\s+(.*)$/); // "221 Hub Premier 1"
  if (m) { num = m[1]; name = m[2]; }
  const is4k = /ultra hdr|ultimate|4k|uhd/i.test(name);
  const tbc = /tbc/i.test(name);
  let mine = false, kind = 'tv';
  if (region === 'UK') {
    mine = /^sky sports/i.test(name) || /^tnt sports/i.test(name) || /^tlc\b/i.test(name);
    if (/hbo max|discovery\+|now\b|sky go|iplayer|youtube|website|app|play|prime/i.test(name)) kind = 'stream';
  } else if (region === 'IL') {
    mine = /^sport ?[1-4]\b/i.test(name) || /^(sport ?5|5 ?(plus|live|stars|gold|sport)|sport ?5 ?4k)/i.test(name);
  } else if (region === 'SG') {
    mine = true;
    if (/tv\+|connect|go\b|app|cast/i.test(name)) kind = 'stream';
  }
  return { name, num, is4k, tbc, mine, kind };
}

// ---------- time helpers ----------
export function localParts(iso, tz) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', month: 'numeric', year: 'numeric', day: 'numeric' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { dow: p.weekday, h: Number(p.hour), min: Number(p.minute), month: Number(p.month), year: Number(p.year), day: Number(p.day), mins: Number(p.hour) * 60 + Number(p.minute) };
}

// ---------- rules ----------
const SKY_MAIN = ['Sky Sports Main Event', 'Sky Sports Premier League', 'Sky Sports Ultra HDR (4K)'];
const SKY_SPREAD = ['Sky Sports Main Event', 'Sky Sports Premier League', 'Sky Sports Football', 'Sky Sports Mix', 'Sky Sports Action', 'Sky Sports Arena', 'Sky Sports+'];
const TNT_MAIN = ['TNT Sports 1', 'TNT Sports Ultimate (4K)'];
const TNT_SPREAD = ['TNT Sports 1', 'TNT Sports 2', 'TNT Sports 3', 'TNT Sports 4', 'TNT Sports 5–10 (digital)', 'TNT Sports Ultimate (4K, top game)'];
const CHARLTON = ['Sport 1', 'Sport 2', 'Sport 3', 'Sport 4'];
const SPORT5 = ['Sport 5', '5Plus', '5Live', '5Stars', '5Gold', 'Sport 5 4K'];
const HUB_PREMIER = ['Hub Premier 1', 'Hub Premier 2', 'Hub Premier 3', 'Hub Premier 4', 'Hub Premier 5', 'Hub Premier 6'];
const BEIN_SG = ['beIN Sports Singapore 1–5', 'beIN Sports Connect (stream)'];

const R = (status, channels, why, extra = {}) => ({ status, channels, why, ...extra });
const pick = (arr, n) => (n <= 1 ? arr.slice(0, 1) : arr.slice(0, Math.min(n, arr.length)));

function ukRule(comp, fx, overlap) {
  const t = localParts(fx.kickoff, 'Europe/London');
  const sat3pm = t.dow === 'Sat' && t.mins >= 14 * 60 + 45 && t.mins < 17 * 60 + 15;
  const blackout = 'Saturday 14:45–17:15 UK "closed period": no live UK TV for English football.';
  switch (comp) {
    case 'PL': {
      if (sat3pm) return R('none', [], [blackout, 'If the game is later moved for TV, the listing will update.']);
      if (t.dow === 'Sat' && t.mins >= 11 * 60 + 30 && t.mins < 14 * 60) return R('likely', TNT_MAIN, ['Saturday 12:30 slot is TNT Sports\' exclusive package (Package A, 2025–29).']);
      if (t.dow === 'Sun' && t.mins < 13 * 60) return R('likely', [...SKY_MAIN.slice(0, 1), ...TNT_MAIN], ['Sunday early slot: usually Sky, but TNT also takes some Sunday 12:00 picks (e.g. Everton v Liverpool, 29 Nov 2026).'], { mixed: true });
      if (['Tue', 'Wed', 'Thu'].includes(t.dow)) {
        const tnt = t.year === 2027 && (t.month === 2 || t.month === 3);
        const list = tnt ? TNT_SPREAD : SKY_SPREAD;
        return R('likely', overlap > 1 ? list : (tnt ? TNT_MAIN : SKY_MAIN), [
          'Midweek round: Sky has 3 full midweek rounds, TNT has 2 (Feb and Mar 2027).',
          tnt ? 'This date falls in TNT\'s Feb/Mar 2027 window → probably TNT.' : 'Outside TNT\'s Feb/Mar window → probably Sky.',
          overlap > 1 ? `${overlap} PL games kick off together, so they are spread across numbered channels; the exact one is set a few days before.` : '',
        ].filter(Boolean), { oneOf: overlap > 1 });
      }
      return R('likely', overlap > 1 ? SKY_SPREAD : SKY_MAIN, [
        'Every PL game outside the Saturday 3pm window is live in the UK (2025–29 deal). Sky holds Packages B–E: Sat 17:30, Sun 14:00 & 16:30, Mon/Fri nights, final day.',
        overlap > 1 ? `${overlap} PL games at the same time → spread over Sky Sports Main Event / Premier League / Football / Sky Sports+.` : 'Single game in the slot → Main Event + Premier League, with 4K on Ultra HDR.',
      ], { oneOf: overlap > 1 });
    }
    case 'CHAMP': case 'EFL': case 'EFLC':
      if (sat3pm) return R('none', [], [blackout]);
      return R('likely', comp === 'EFLC' ? ['Sky Sports Football', 'Sky Sports Main Event', 'Sky Sports+'] : ['Sky Sports Football', 'Sky Sports+'], ['Sky Sports holds EFL (League, Carabao Cup) UK rights 2024–29; many games stream on Sky Sports+.'], { oneOf: true });
    case 'FAC':
      if (sat3pm) return R('none', [], [blackout]);
      return R('uncertain', ['TNT Sports 1–4'], ['FA Cup UK rights 2025–29: TNT Sports and BBC. Not every tie is televised and some go to BBC only (BBC is not in your channels).'], { oneOf: true });
    case 'SHIELD': return R('likely', TNT_MAIN, ['TNT Sports shows the Community Shield.']);
    case 'UCL': {
      const tue = t.dow === 'Tue' && t.h >= 19;
      return R('likely', overlap > 1 ? TNT_SPREAD : TNT_MAIN, [
        'UEFA club competitions in the UK 2024–27: TNT Sports.',
        tue ? 'Exception: Amazon Prime Video has the first-pick Tuesday-night UCL game in the UK. If this is that game, it is NOT on TNT (Prime is not in your channels).' : '',
        overlap > 1 ? `${overlap} UCL games at the same time → TNT spreads them over TNT Sports 1–4 and 5–10.` : '',
      ].filter(Boolean), { oneOf: overlap > 1, caveat: tue ? 'Prime Video Tuesday pick risk' : null });
    }
    case 'UEL': case 'UECL': case 'USC': case 'UCLQ': case 'UELQ': case 'UECLQ':
      return R(comp.endsWith('Q') ? 'uncertain' : 'likely', TNT_SPREAD, ['UEFA club competitions in the UK 2024–27: TNT Sports (qualifiers are sold separately and may not be shown).'], { oneOf: true });
    case 'BUND': {
      if (t.dow === 'Sat' && t.mins >= 17 * 60 && t.mins < 18 * 60) return R('likely', ['Sky Sports Football', 'Sky Sports Main Event', 'Sky Sports+'], ['Bundesliga UK 2025–29: Sky Sports has the Saturday 17:30 top match.'], { oneOf: true });
      if (t.dow === 'Fri') return R('none', [], ['Bundesliga Friday-night games in the UK stream on the BBC, not on your channels.']);
      return R('uncertain', ['Sky Sports+'], ['Bundesliga UK 2025–29: Sky shows selected games; many others are on Bundesliga YouTube/app.'], { oneOf: true });
    }
    case 'SERIEA': return R('uncertain', ['TNT Sports 1–4', 'HBO Max'], ['Serie A UK 2026–27: every game on DAZN (not yours); TNT Sports shows selected games only.'], { oneOf: true });
    case 'SPL': return R('likely', ['Sky Sports Football', 'Sky Sports Main Event'], ['Scottish Premiership UK live rights: Sky Sports.'], { oneOf: true });
    case 'LALIGA': return R('none', [], ['LaLiga in the UK is on Premier Sports, which is not in your channels.']);
    case 'L1': return R('none', [], ['Ligue 1 in the UK streams on Ligue1+, not on your channels.']);
    case 'ISR': case 'ISRCUP': return R('none', [], ['No UK broadcaster for Israeli football found.']);
    default: return R('uncertain', [], ['No verified UK rights rule for this competition.']);
  }
}

function ilRule(comp, fx, overlap) {
  switch (comp) {
    case 'PL': return R(overlap > 2 ? 'uncertain' : 'likely', CHARLTON, [
      'Premier League in Israel 2025–28: Charlton (Sport 1–4; Sport 1 is the flagship).',
      overlap > 2 ? `${overlap} PL games at once: Charlton shows only a selection live (e.g. 2 of 6 at 3pm on 21 Nov 2026), some on Sport 6 which is not in your list.` : 'Big single-slot games usually go on Sport 1.',
    ], { oneOf: true });
    case 'CHAMP': return R('uncertain', CHARLTON, ['Charlton has EFL Championship rights 2024–28 but shows only selected games.'], { oneOf: true });
    case 'UEL': case 'UECL': return R('likely', CHARLTON, ['Europa League & Conference League in Israel 2024–27: Charlton.'], { oneOf: true });
    case 'UCL': return R('likely', overlap > 1 ? SPORT5 : ['5Stars', 'Sport 5 4K'], ['Champions League in Israel 2024–27: Sport 5 (RGE "ערוץ הספורט"). From 2027/28 the rights move to DAZN.'], { oneOf: true });
    case 'USC': return R('uncertain', SPORT5, ['UEFA Super Cup in Israel: not verified (UCL holder Sport 5 is likely).'], { oneOf: true });
    case 'ISR': return R('likely', [...CHARLTON, 'Sport 5'], ["Ligat Ha'Al: Charlton holds the rights (Sport 1–4); the round's main match is on Sport 5."], { oneOf: true });
    case 'ISRCUP': return R('uncertain', [...CHARLTON, 'Sport 5'], ['Israeli cup rights not verified.'], { oneOf: true });
    case 'BUND': return R('likely', CHARLTON, ['Bundesliga in Israel: Charlton (selected games).'], { oneOf: true });
    case 'L1': return R('uncertain', ['5Plus'], ['Recent listings show Ligue 1 on Sport 5 (5Plus) for selected games.'], { oneOf: true });
    case 'LALIGA': return R('none', [], ['Recent listings show LaLiga in Israel on ONE (One Sport), not in your channels.']);
    case 'SERIEA': return R('uncertain', CHARLTON, ['Serie A in Israel is split (ONE2 / Charlton Sport 2 & 6 in recent listings).'], { oneOf: true });
    default: return R('uncertain', [], ['No verified Israeli rights rule for this competition.']);
  }
}

function sgRule(comp, fx, overlap) {
  switch (comp) {
    case 'PL': return R(overlap > 6 ? 'uncertain' : 'likely', overlap > 1 ? HUB_PREMIER : HUB_PREMIER.slice(0, 1), [
      'Premier League in Singapore 2022–28: StarHub exclusive (Hub Premier channels; Singtel TV gets them via cross-carriage, ch 102–107).',
      overlap > 1 ? `${overlap} games at once → spread over Hub Premier 1–6.` : '',
      overlap > 6 ? 'More games than Hub Premier channels: some will be delayed (replay within 48h).' : '',
    ].filter(Boolean), { oneOf: overlap > 1 });
    case 'FAC': return R('likely', ['Hub Sports 2', 'Hub Sports 1'], ['FA Cup in Singapore: StarHub (Hub Sports), also for Singtel PL cross-carriage customers.'], { oneOf: true });
    case 'UCL': case 'UEL': case 'UECL': case 'USC': return R('likely', BEIN_SG, ['UEFA club competitions in Singapore 2024–27: beIN Sports (on StarHub/Singtel).'], { oneOf: true });
    case 'LALIGA': case 'BUND': return R('likely', BEIN_SG, ['Recent listings show this league on beIN Sports Singapore.'], { oneOf: true });
    case 'CHAMP': case 'EFLC': case 'EFL': return R('uncertain', ['mio Sports (Singtel)', 'Hub Sports'], ['EFL in Singapore: selected games seen on Singtel mio Sports; not verified.'], { oneOf: true });
    case 'ISR': case 'ISRCUP': return R('none', [], ['No Singapore broadcaster for Israeli football found.']);
    case 'L1': case 'SERIEA': return R('uncertain', [], ['Recent listings show no Singapore TV channel for this league.']);
    default: return R('uncertain', [], ['No verified Singapore rights rule for this competition.']);
  }
}

export function ruleFor(region, comp, fx, overlap) {
  if (region === 'UK') return ukRule(comp, fx, overlap);
  if (region === 'IL') return ilRule(comp, fx, overlap);
  return sgRule(comp, fx, overlap);
}

// ---------- team-name matching for listings ----------
const STOP = new Set(['fc', 'afc', 'cf', 'sc', 'ac', 'as', 'ss', 'rc', 'cd', 'ud', 'sd', 'the', 'de', 'del', 'club', 'calcio', 'football', 'hotspur', 'and']);
export function norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).join(' ');
}
const ALIAS = { 'man utd': 'manchester united', 'man city': 'manchester city', 'spurs': 'tottenham', 'wolves': 'wolverhampton wanderers', 'psg': 'paris saint germain', 'inter': 'internazionale', 'inter milan': 'internazionale', 'bayern munchen': 'bayern munich' };
const al = (s) => ALIAS[s] || s;
export function sameTeam(a, b) {
  const x = al(norm(a)), y = al(norm(b));
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const xa = x.split(' '), ya = y.split(' ');
  // first distinctive word equal (celta vigo / celta), but not for generic city prefixes
  const generic = new Set(['manchester', 'real', 'athletic', 'atletico', 'sporting', 'hapoel', 'maccabi', 'borussia', 'west', 'aston', 'inter', 'racing', 'bnei', 'beitar', 'ironi', 'olympique', 'stade', 'queens', 'sheffield', 'bristol', 'nottingham', 'crystal']);
  if (xa[0] === ya[0] && !generic.has(xa[0]) && xa[0].length >= 4) return true;
  if (generic.has(xa[0]) && xa[0] === ya[0] && xa[1] && ya[1] && xa[1].slice(0, 4) === ya[1].slice(0, 4)) return true;
  return false;
}
export function findListing(listings, region, fx) {
  const t = new Date(fx.kickoff).getTime();
  let best = null;
  for (const l of listings) {
    if (l.region !== region) continue;
    const dt = Math.abs(new Date(l.kickoff).getTime() - t);
    if (dt > 3 * 3600e3) continue;
    const both = (sameTeam(l.home, fx.home) && sameTeam(l.away, fx.away)) || (sameTeam(l.home, fx.away) && sameTeam(l.away, fx.home));
    const one = sameTeam(l.home, fx.home) || sameTeam(l.away, fx.away) || sameTeam(l.home, fx.away) || sameTeam(l.away, fx.home);
    const score = both ? 2 : (one && dt <= 15 * 60e3 ? 1 : 0);
    if (!score) continue;
    if (/women|u1\d|u2\d/i.test(l.home + l.away) !== /women|u1\d|u2\d/i.test(fx.home + fx.away)) continue;
    if (!best || score > best.score || (score === best.score && dt < best.dt)) best = { l, score, dt };
  }
  return best && best.l;
}

// ---------- the engine ----------
// fx: { kickoff, home, away, comp }  ctx: { listings, horizon: {UK, IL, SG} (ISO), overlap }
export function channelsFor(fx, ctx) {
  const comp = fx.comp;
  const out = {};
  for (const region of ['UK', 'IL', 'SG']) {
    const rule = ruleFor(region, comp, fx, ctx.overlap || 1);
    const listing = findListing(ctx.listings, region, fx);
    const farAhead = new Date(fx.kickoff).getTime() - Date.now() > 2 * 86400e3;
    if (listing && region !== 'UK' && !listing.channels.length && farAhead) {
      const chans = rule.channels.map((c) => ({ ...classify(region, c), mine: true, name: c, is4k: /4k/i.test(c) }));
      out[region] = { ...rule, channels: chans, status: rule.status === 'likely' ? 'likely' : rule.status, url: listing.url, why: rule.status === 'none' ? rule.why : [`${listing.source} has the match but no ${REGIONS[region].name} channel yet (usually added a few days before).`, ...rule.why] };
      continue;
    }
    if (listing) {
      const chans = listing.channels.map((c) => classify(region, c));
      const mine = chans.filter((c) => c.mine);
      const others = chans.filter((c) => !c.mine);
      if (mine.length) {
        out[region] = { status: 'confirmed', channels: mine, others, source: listing.source, url: listing.url, why: [`Listed by ${listing.source}.`, ...rule.why.slice(0, 1)] };
      } else {
        out[region] = { status: 'none', channels: [], others, source: listing.source, url: listing.url, why: [others.length ? `Listed by ${listing.source}, but only on channels you don't have.` : `${listing.source} lists the match with no ${REGIONS[region].name} TV channel.`, ...rule.why] };
      }
      continue;
    }
    // No listing. If the fixture is inside the listing source's horizon, "not listed" is itself evidence.
    const horizon = ctx.horizon?.[region];
    const inHorizon = horizon && new Date(fx.kickoff) <= new Date(horizon) && new Date(fx.kickoff) >= new Date(ctx.generatedAt || 0);
    const chans = rule.channels.map((c) => ({ ...classify(region, c), mine: true, name: c, is4k: /4k/i.test(c) }));
    if (region === 'UK' && inHorizon && ['PL', 'CHAMP', 'EFLC', 'FAC', 'UCL', 'UEL', 'UECL'].includes(comp)) {
      if (rule.status === 'none') out[region] = { ...rule, channels: [], why: [...rule.why, 'Not in the UK TV listings either.'], status: 'none', confirmedNone: true };
      else out[region] = { ...rule, channels: chans, status: 'uncertain', why: ['Not (yet) in the UK TV listings.', ...rule.why] };
      continue;
    }
    out[region] = { ...rule, channels: chans };
  }
  return out;
}
