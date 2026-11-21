# Football TV Guide

Which of **my** channels show the next match? A small static web app: the home page shows Tottenham Hotspur's next fixture; search any team to see its next fixtures.

Channels covered: **UK** Sky Sports and TNT Sports (incl. 4K: Sky Sports Ultra HDR, TNT Sports Ultimate) and TLC (only when a listing shows football on it); **Israel** Charlton Sport 1–4 and the Sport 5 family; **Singapore** all sports channels (StarHub Hub Premier / Hub Sports, beIN Sports SG, Singtel mio Sports).

## How channels are matched
1. **Confirmed**: Israel – Charlton's official EPG (`sport1.maariv.co.il/wp-json/sport1/v1/broadcast`, fetched live in the browser, snapshot as fallback), matched by kick-off time, competition and Hebrew club names (`charlton.js`). Otherwise a published TV listing for that fixture and region (UK: live-footballontv.com, cross-checked with livesoccertv's Great Britain row; Israel, Singapore, USA, Australia, Canada, India, New Zealand: livesoccertv.com match pages). Refreshed every 4 hours by a GitHub Action into `data/listings.json`.
2. **Not listed yet**: if no guide lists the match for a region, nothing is guessed. The rights rules in `rules.js` are not shown as channels; they only add context to guide-backed results. UK exception: within 7 days, a PL/EFL/cup/UEFA game missing from live-footballontv.com (which lists every televised UK game) is shown as not on UK TV.
3. Fixtures are fetched live in the browser from ESPN's public API, with TheSportsDB (public test key) and the listings as fallbacks.

No API keys or secrets. Always double-check the broadcaster's own guide.

USA, Australia, Canada, India, New Zealand are informational regions: their guide-listed channels are shown separately from my own channels.

Channel names are shown exactly as listed (e.g. "TSN4", "Sky Sports Premier League", "Hub Premier 2"). A family/package name ("TSN", "NBC", "Sky Sports TBC", "TSN Premium") is dropped if any guide names the exact channel, otherwise flagged "exact channel not published yet".
