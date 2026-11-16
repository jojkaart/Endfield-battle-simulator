## 2026-10-18: account data capture

- No official API for player data. SKPORT's unofficial API exposes roster,
  builds (artificing per gear substat) and inventory, but needs the login
  token; Gryphline warns against third-party logins. Findings:
  [player-data.md](../player-data.md).
- Owner's idea, built: a Brave/Chrome extension
  ([tools/skport-capture](../../tools/skport-capture/README.md)) that passively
  copies what SKPORT's own pages load and saves it to a file. No requests
  of its own, no headers or tokens. Unit tests plus an end-to-end test in
  Chromium against a fake SKPORT.
- Problem found: Chrome injects a content-script file only once per page,
  even across worlds, so the isolated relay can't share `core.js` with the
  page hook; validation moved to the background worker.
- Not yet tested against the real SKPORT pages; the owner's first capture
  will show which endpoints the pages actually call.
