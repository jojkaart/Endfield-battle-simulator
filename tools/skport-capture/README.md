# Endfield SKPORT capture

A browser extension (Chrome / Brave, Manifest V3) that saves the Endfield
player data SKPORT's own pages load while you use them: roster, builds and
inventory. Background: [docs/player-data.md](../../docs/player-data.md).

- **Passive:** it copies the responses the official page has already
  received. It sends no requests, so it only captures what the pages you
  open load.
- **No credentials:** it never reads request headers, cookies or tokens,
  and never captures login, token, sign-in or settings endpoints. Which
  endpoints it does capture: `TARGET_PREFIXES` in [core.js](core.js).
- **Local only:** the file goes to your Downloads folder. Nothing is sent
  anywhere.

## Install (Brave)

1. Open `brave://extensions` and turn on **Developer mode** (top right).
2. **Load unpacked** → select this `tools/skport-capture` folder.
3. If Brave asks where to save every download, the capture will open a save
   dialog each time. To avoid that, turn off "Ask where to save each file" in
   `brave://settings/downloads`.

After pulling a new version, press the reload icon on the extension's card.

## Use

1. Log in to SKPORT and open the Endfield pages that hold the data:
   - the **game card** (operator roster, equipped builds); click an
     operator to load their detailed build;
   - **Team Picks** (roster, owned weapons and gear, equipped loadouts);
   - the **cost calculator**, `game.skport.com/tools/endfield/cost-calculator`
     (roster, weapons, material stock).
2. A few seconds after a page stops loading new data, the extension saves
   `Downloads/endfield-capture/skport-<time>.json`, one file per page visit,
   updated as you click around. The toolbar icon shows how many responses
   that page has captured.
3. Send me the files.

The files contain your nickname, UID and role IDs. Don't commit them to the
repository.

## Develop

- `core.js`: all capture logic (which URLs, what's stored, file format),
  shared by the scripts and tests.
- `page-hook.js`: runs in the page's world, wraps `fetch` and
  `XMLHttpRequest`, posts matching responses to the relay.
- `relay.js`: isolated world, collects them per page visit and hands them
  to the background worker. (Chrome injects a file only once per page, so
  it can't load `core.js` itself.)
- `background.js`: validates with `core.js` and saves the file.

Tests:

```sh
node --test test/*.test.js                                   # unit tests
NODE_PATH=$(npm root -g) node test/e2e.js [path-to-chromium] # loads the extension in Chromium against a fake SKPORT
```

The end-to-end test serves fake pages and responses, so it never touches
the real site.
