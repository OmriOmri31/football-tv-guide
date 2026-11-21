import { REGIONS, MY_REGIONS, INFO_REGIONS, compKey, COMP_NAME, channelsFor, sameTeam, norm } from './rules.js';
import { parseEpg } from './charlton.js';

const ESPN = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_SEARCH = 'https://site.web.api.espn.com/apis/search/v2';
const TSDB = 'https://www.thesportsdb.com/api/v1/json/123'; // TheSportsDB public test key (not a secret)
const DEFAULT_TEAM = { source: 'espn', id: '367', name: 'Tottenham Hotspur', league: 'eng.1' };

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };

let LISTINGS = { listings: [], generatedAt: null, sources: {} };
let CHARLTON = [], CHARLTON_SRC = null;
async function loadListings() {
  const bust = Math.floor(Date.now() / 600000);
  const [l, live] = await Promise.all([
    getJSON(`data/listings.json?t=${bust}`).catch(() => null),
    getJSON('https://sport1.maariv.co.il/wp-json/sport1/v1/broadcast').catch(() => null), // Charlton EPG, live (CORS allows this site)
  ]);
  if (l) LISTINGS = l;
  let epg = live; CHARLTON_SRC = live ? 'live' : null;
  if (!epg) { epg = await getJSON(`data/charlton.json?t=${bust}`).catch(() => null); if (epg) CHARLTON_SRC = 'snapshot'; }
  CHARLTON = epg ? parseEpg(epg) : [];
}
function horizons() {
  const max = {};
  for (const l of LISTINGS.listings) if (!max[l.region] || l.kickoff > max[l.region]) max[l.region] = l.kickoff;
  return max;
}

// ---------- fixtures ----------
function fromEspnEvent(e) {
  const c = e.competitions[0];
  const home = c.competitors.find((x) => x.homeAway === 'home'), away = c.competitors.find((x) => x.homeAway === 'away');
  const st = c.status?.type || e.status?.type || {};
  return {
    id: e.id, kickoff: e.date, timeValid: c.timeValid !== false,
    home: home.team.displayName, away: away.team.displayName,
    homeLogo: home.team.logos?.[0]?.href, awayLogo: away.team.logos?.[0]?.href,
    league: e.league?.slug, leagueName: e.league?.name || e.seasonType?.name,
    comp: compKey({ slug: e.league?.slug, name: e.league?.name }),
    state: st.state, detail: st.shortDetail, venue: c.venue?.fullName,
  };
}
async function espnFixtures(teamId) {
  const d = await getJSON(`${ESPN}/all/teams/${teamId}/schedule?fixture=true`);
  const now = Date.now();
  return (d.events || []).map(fromEspnEvent)
    .filter((f) => f.state !== 'post' && new Date(f.kickoff).getTime() > now - 3 * 3600e3)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}
async function tsdbFixtures(name) {
  const s = await getJSON(`${TSDB}/searchteams.php?t=${encodeURIComponent(name)}`);
  const t = (s.teams || []).find((x) => x.strSport === 'Soccer');
  if (!t) return [];
  const n = await getJSON(`${TSDB}/eventsnext.php?id=${t.idTeam}`);
  return (n.events || []).filter((e) => e.strSport === 'Soccer').map((e) => ({
    id: `tsdb${e.idEvent}`, kickoff: (e.strTimestamp || `${e.dateEvent}T${e.strTime}`).replace(/(\d{2}:\d{2}:\d{2})$/, '$1Z'), timeValid: true,
    home: e.strHomeTeam, away: e.strAwayTeam, homeLogo: e.strHomeTeamBadge, awayLogo: e.strAwayTeamBadge,
    leagueName: e.strLeague, comp: compKey({ name: e.strLeague }), state: 'pre', venue: e.strVenue, src: 'TheSportsDB',
  }));
}
function listingFixtures(name) {
  // livesoccertv rows double as a fixture source for teams the APIs miss.
  const seen = new Map();
  for (const l of LISTINGS.listings) {
    if (l.region === 'UK' && !/premier league|championship|cup|champions|europa|conference/i.test(l.comp)) continue;
    if (!(sameTeam(l.home, name) || sameTeam(l.away, name))) continue;
    if (/women|u1\d|u2\d/i.test(l.home + l.away) && !/women|u1\d|u2\d/i.test(name)) continue;
    if (new Date(l.kickoff).getTime() < Date.now() - 3 * 3600e3) continue;
    const k = `${l.kickoff.slice(0, 13)}|${norm(l.home)}`;
    if (!seen.has(k)) seen.set(k, { id: k, kickoff: l.kickoff, timeValid: true, home: l.home, away: l.away, leagueName: l.comp.replace(/^\w+ - /, ''), comp: compKey({ name: l.comp }), state: 'pre', src: l.source });
  }
  return [...seen.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

// Simultaneous fixtures in the same competition (drives channel spreading).
const sbCache = new Map();
async function overlapFor(fx) {
  if (!fx.league) {
    const t = new Date(fx.kickoff).getTime();
    const same = LISTINGS.listings.filter((l) => l.region !== 'UK' && compKey({ name: l.comp }) === fx.comp && Math.abs(new Date(l.kickoff).getTime() - t) <= 15 * 60e3);
    return Math.max(1, new Set(same.map((l) => l.home)).size);
  }
  const day = fx.kickoff.slice(0, 10).replace(/-/g, '');
  const key = `${fx.league}|${day}`;
  if (!sbCache.has(key)) sbCache.set(key, getJSON(`${ESPN}/${fx.league}/scoreboard?dates=${day}`).catch(() => ({ events: [] })));
  const d = await sbCache.get(key);
  const t = new Date(fx.kickoff).getTime();
  return Math.max(1, (d.events || []).filter((e) => Math.abs(new Date(e.date).getTime() - t) <= 15 * 60e3).length);
}

// ---------- rendering ----------
const fmt = (iso, tz, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).format(new Date(iso));
const STATUS = {
  confirmed: ['Confirmed', 'From a TV listing'],
  likely: ['Likely', 'From broadcast-rights rules'],
  uncertain: ['Uncertain', 'Rights or pick not verified'],
  none: ['Not on your channels', ''],
};
function chip(c) {
  return el('span', { class: `chip${c.is4k ? ' k4' : ''}${c.kind === 'stream' ? ' stream' : ''}` }, c.tbc ? `${c.name.replace(/\s*TBC/i, '')} (channel TBC)` : c.name, c.num ? el('small', {}, ` ch ${c.num}`) : null, c.is4k ? el('b', {}, '4K') : null);
}
function regionBlock(region, r) {
  const [label, sub] = STATUS[r.status] || STATUS.uncertain;
  const R = REGIONS[region];
  return el('div', { class: `region ${r.status}` },
    el('div', { class: 'rhead' },
      el('span', { class: 'rname' }, `${R.flag} ${R.name}`),
      el('span', { class: `badge ${r.status}`, title: sub }, label)),
    r.channels.length
      ? el('div', { class: 'chips' }, r.oneOf && r.status !== 'confirmed' ? el('span', { class: 'oneof' }, 'one of:') : null, r.channels.map(chip))
      : el('div', { class: 'nochan' }, r.status === 'none' ? r.why[0] : 'No channel confirmed yet – see why'),
    r.others?.length ? el('div', { class: 'others' }, 'Also on (not yours): ', r.others.map((c) => c.name).join(', ')) : null,
    el('details', {}, el('summary', {}, 'Why'), el('ul', {}, r.why.map((w) => el('li', {}, w))),
      r.url ? el('a', { href: r.url, target: '_blank', rel: 'noopener' }, 'Source listing') : null));
}
function infoRow(region, r) {
  const R = REGIONS[region];
  const [label] = STATUS[r.status] || STATUS.uncertain;
  return el('div', { class: 'irow' },
    el('span', { class: 'iname' }, `${R.flag} ${R.name}`),
    el('span', { class: 'ichans' }, r.channels.length ? r.channels.map((c) => c.name).join(' · ') : (r.status === 'none' ? 'no broadcaster found' : '—')),
    el('span', { class: `badge sm ${r.status}`, title: r.why.join(' ') }, r.status === 'none' ? 'None' : label));
}
function countdown(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600e3), d = Math.floor(h / 24);
  return d >= 2 ? `in ${d} days` : h >= 1 ? `in ${h}h ${Math.floor((ms % 3600e3) / 60e3)}m` : `in ${Math.max(1, Math.round(ms / 60e3))} min`;
}
async function fixtureCard(fx, open) {
  const overlap = await overlapFor(fx);
  const res = channelsFor(fx, { listings: LISTINGS.listings, horizon: horizons(), generatedAt: LISTINGS.generatedAt, overlap, charlton: CHARLTON });
  const live = fx.state === 'in';
  const mineCount = MY_REGIONS.reduce((n, rg) => n + (res[rg].status !== 'none' ? res[rg].channels.filter((c) => c.kind !== 'stream').length : 0), 0);
  const body = el('div', { class: 'regions' }, MY_REGIONS.map((rg) => regionBlock(rg, res[rg])),
    el('div', { class: 'infohead' }, 'Other countries · for reference, not your subscriptions'),
    el('div', { class: 'info' }, INFO_REGIONS.map((rg) => infoRow(rg, res[rg]))));
  const card = el('article', { class: `fixture${open ? ' open' : ''}` },
    el('div', { class: 'teams', onclick: () => card.classList.toggle('open') },
      el('div', { class: 'team' }, fx.homeLogo ? el('img', { src: fx.homeLogo, alt: '', loading: 'lazy' }) : null, el('span', {}, fx.home)),
      el('div', { class: 'mid' },
        live ? el('span', { class: 'live' }, 'LIVE ', fx.detail || '') : el('span', { class: 'il-time' }, fmt(fx.kickoff, 'Asia/Jerusalem', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })),
        el('span', { class: 'date' }, fmt(fx.kickoff, 'Asia/Jerusalem', { weekday: 'short', day: 'numeric', month: 'short' }), ' · Israel'),
        !live && countdown(fx.kickoff) ? el('span', { class: 'cd' }, countdown(fx.kickoff)) : null),
      el('div', { class: 'team' }, fx.awayLogo ? el('img', { src: fx.awayLogo, alt: '', loading: 'lazy' }) : null, el('span', {}, fx.away))),
    el('div', { class: 'meta' },
      el('span', { class: 'comp' }, COMP_NAME[fx.comp] !== 'Other' ? COMP_NAME[fx.comp] : (fx.leagueName || 'Other')),
      el('span', {}, `UK ${fmt(fx.kickoff, 'Europe/London', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} · SG ${fmt(fx.kickoff, 'Asia/Singapore', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })}`),
      overlap > 1 ? el('span', { class: 'ov', title: 'Games in the same competition kicking off together' }, `${overlap} games at this time`) : null,
      !fx.timeValid ? el('span', { class: 'ov' }, 'kick-off time TBC') : null,
      el('span', { class: 'count' }, mineCount ? `${mineCount} of your channels` : 'not on your channels')),
    body);
  return card;
}

let current = DEFAULT_TEAM;
async function showTeam(team) {
  current = team;
  const out = $('#results');
  out.replaceChildren(el('div', { class: 'loading' }, `Loading ${team.name}…`));
  $('#q').value = team.id === DEFAULT_TEAM.id ? '' : team.name;
  $('#title').textContent = team.name;
  try {
    let fx = [];
    if (team.source === 'espn') fx = await espnFixtures(team.id).catch(() => []);
    if (!fx.length) fx = listingFixtures(team.name);
    if (!fx.length) fx = await tsdbFixtures(team.name).catch(() => []);
    if (!fx.length) { out.replaceChildren(el('div', { class: 'empty' }, `No upcoming fixtures found for ${team.name}.`)); return; }
    const shown = fx.slice(0, team.id === DEFAULT_TEAM.id ? 4 : 3);
    const cards = await Promise.all(shown.map((f, i) => fixtureCard(f, i === 0)));
    out.replaceChildren(el('h2', { class: 'next' }, 'Next fixture'), cards[0], cards.length > 1 ? el('h2', { class: 'next' }, 'After that') : null, ...cards.slice(1));
  } catch (e) {
    out.replaceChildren(el('div', { class: 'empty' }, `Couldn't load fixtures (${e.message}). Try again.`));
  }
}

// ---------- search ----------
let searchSeq = 0;
async function search(q) {
  const seq = ++searchSeq;
  const box = $('#suggest');
  if (q.trim().length < 2) { box.replaceChildren(); return; }
  let items = [];
  try {
    const d = await getJSON(`${ESPN_SEARCH}?query=${encodeURIComponent(q)}&limit=12&type=team`);
    for (const r of d.results || []) if (r.type === 'team') for (const c of r.contents) {
      if (c.sport !== 'soccer') continue;
      const id = (c.uid.match(/t:(\d+)/) || [])[1];
      if (id) items.push({ source: 'espn', id, name: c.displayName, sub: c.subtitle, logo: c.image?.default, league: c.defaultLeagueSlug });
    }
  } catch { /* fall through */ }
  if (!items.length) {
    try {
      const s = await getJSON(`${TSDB}/searchteams.php?t=${encodeURIComponent(q)}`);
      items = (s.teams || []).filter((t) => t.strSport === 'Soccer').map((t) => ({ source: 'tsdb', id: `tsdb${t.idTeam}`, name: t.strTeam, sub: t.strLeague, logo: t.strBadge }));
    } catch { /* none */ }
  }
  if (seq !== searchSeq) return;
  items = items.filter((t) => !/women|u1\d|u2\d|castilla|youth/i.test(`${t.name} ${t.sub}`)).concat(items.filter((t) => /women|u1\d|u2\d|castilla|youth/i.test(`${t.name} ${t.sub}`))).slice(0, 8);
  box.replaceChildren(...items.map((t) => el('button', { class: 'sug', type: 'button', onclick: () => pickTeam(t) },
    t.logo ? el('img', { src: t.logo, alt: '' }) : el('span', { class: 'ph' }), el('span', {}, t.name, el('small', {}, t.sub || '')))));
  if (!items.length) box.replaceChildren(el('div', { class: 'sug none' }, 'No team found'));
}
function pickTeam(t) {
  $('#suggest').replaceChildren();
  const p = new URLSearchParams({ team: t.name, id: t.id, src: t.source });
  history.replaceState(null, '', t.id === DEFAULT_TEAM.id ? location.pathname : `?${p}`);
  showTeam(t);
}

async function main() {
  let timer;
  $('#q').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => search(e.target.value), 250); });
  $('#form').addEventListener('submit', async (e) => { e.preventDefault(); await search($('#q').value); $('#suggest .sug')?.click(); });
  for (const b of document.querySelectorAll('[data-team]')) b.addEventListener('click', async () => {
    if (b.dataset.team === 'spurs') return pickTeam(DEFAULT_TEAM);
    $('#q').value = b.dataset.team; await search(b.dataset.team); $('#suggest .sug')?.click();
  });
  await loadListings();
  const g = LISTINGS.generatedAt;
  $('#fresh').textContent = (g ? `Listings updated ${fmt(g, 'Asia/Jerusalem', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} (Israel time). ` : 'Listings unavailable – rules only. ') + `Charlton schedule: ${CHARLTON_SRC === 'live' ? 'live' : CHARLTON_SRC === 'snapshot' ? 'snapshot' : 'unavailable'}. Fixtures are fetched live.`;
  const p = new URLSearchParams(location.search);
  const team = p.get('id') ? { source: p.get('src') || 'espn', id: p.get('id'), name: p.get('team') || 'Team' } : DEFAULT_TEAM;
  showTeam(team);
  setInterval(() => { if (!document.hidden && !$('#suggest').children.length) showTeam(current); }, 5 * 60e3);
}
main();
