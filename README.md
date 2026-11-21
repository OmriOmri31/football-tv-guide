# Football TV Guide

Which of **my** channels show the next match? A small static web app: the home page shows Tottenham Hotspur's next fixture; search any team to see its next fixtures.

Channels covered: **UK** Sky Sports and TNT Sports (incl. 4K: Sky Sports Ultra HDR, TNT Sports Ultimate) and TLC (only when a listing shows football on it); **Israel** Charlton Sport 1–4 and the Sport 5 family; **Singapore** all sports channels (StarHub Hub Premier / Hub Sports, beIN Sports SG, Singtel mio Sports).

## How channels are matched
1. **Confirmed**: Israel – Charlton's official EPG (`sport1.maariv.co.il/wp-json/sport1/v1/broadcast`, fetched live in the browser, snapshot as fallback), matched by kick-off time, competition and Hebrew club names (`charlton.js`). Otherwise a published TV listing for that fixture and region (UK: live-footballontv.com; Israel, Singapore, USA, Australia, Canada, India: livesoccertv.com match pages). Refreshed every 4 hours by a GitHub Action into `data/listings.json`.
2. **Likely / Uncertain**: otherwise a rule engine (`rules.js`) works from the competition, the kick-off day and slot in UK time (incl. the Saturday 14:45–17:15 blackout), the region's rights holder, and how many games in the same competition kick off together (they get spread across numbered channels).
3. Fixtures are fetched live in the browser from ESPN's public API, with TheSportsDB (public test key) and the listings as fallbacks.

No API keys or secrets. Always double-check the broadcaster's own guide.

USA, Australia, Canada and India are informational regions: their main rights holders are shown separately from my own channels.
