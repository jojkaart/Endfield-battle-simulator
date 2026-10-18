# Network allowlist

The cloud environment only reaches hosts on its allowlist, which the owner
edits in the environment settings. This file records what is on it, what
each host is for, and whether it has turned out to be useful, so the list
can be kept short. Update it whenever a host is added, removed, or found
useful or useless.

GitHub (and the package registries) are always reachable and not listed.

**How to test a host:** `curl -s -o /dev/null -w '%{http_code}' https://HOST/`.
A `000` with a `403` for that host under `recentRelayFailures` in
`curl -sS "$HTTPS_PROXY/__agentproxy/status"` means the host is not allowed;
a `502` there means it is allowed but the site did not answer. A `403` from
the site itself (e.g. `server: cloudflare`) means it is allowed but blocks
automated requests.

**User agent:** use a descriptive one, e.g.
`EndfieldBattleSimulator-research/0.1`. On endfield.wiki.gg, `Mozilla/5.0`
is blocked outright and a full browser string gets a challenge page.
Site terms that limit automated use are summarised in
[data-sources.md](data-sources.md#licences-and-terms-in-short); keep to
occasional, targeted requests.

## On the allowlist

Status: **useful** (used for real findings), **untested** (reachable, not yet
used), **blocked by site** (allowed, but the site rejects our requests),
**not useful** (candidate for removal).

| Host | Purpose | Reachable | Status |
|---|---|---|---|
| endfield.wiki.gg | Talos Wiki: formula pages, data | `api.php` only, with a descriptive user agent | useful (licence read; robots.txt disallows `/api.php`, so only a few targeted lookups) |
| endfieldhub.org | Database, `/webmcp/*.json` | yes | useful, limited: light spot checks only (no skill values in JSON; derived from other sites) |
| zmdlogs.com | Published battle logs (API) | yes | **most useful**: per-hit ground truth |
| www.end-axis.com | Endaxis simulator site (bare `end-axis.com` not allowed) | yes | not useful (same data as `reference/Endaxis`; no API) |
| wiki.biligame.com | CN wiki | yes, but returns Tencent EdgeOne "567 Restricted Access" after a few requests; title search disabled | blocked by site (licence read before the block) |
| note.com | Rounding article (note.com/at67275) | yes; `/api/v3/notes/{id}` returns the full article | useful |
| arknightsendfield.gg | "Datafield runs": in-game damage totals | yes | useful (run figures confirmed) |
| www.gamekee.com | CN wiki, damage formula (article updated 2026-04-12) | pages are a JS shell; JSON API `/v1/content/detail/{id}` with header `game-alias: zmd` works | useful |
| end.canmoe.com | Datamine-style IDs and level tables (CEP planner, AGPL) | yes | not useful (display strings only, no Si) |
| www.endfieldsimulations.dev | Zero Sanity live site (source is in `reference/`) | yes | not useful (devlog older than the repo; use the repo) |
| endfield.huijiwiki.com | CN wiki, damage formula | no: Cloudflare 403, also on `api.php` | blocked by site |
| www.icy-veins.com | Guides, skill values | no: Cloudflare 403 | blocked by site |
| ngabbs.com | CN forum, community testing | no: site 403 | blocked by site |

If the "blocked by site" hosts stay unreachable, remove them.

**Removal candidates (2026-10-18):** www.end-axis.com, end.canmoe.com,
www.endfieldsimulations.dev (not useful); endfield.huijiwiki.com,
www.icy-veins.com, ngabbs.com (blocked by site). wiki.biligame.com is
borderline (blocked after a few requests, behind on 1.6).

## Candidates (not added)

Only needed to read the terms still unverified in
[data-sources.md](data-sources.md#licences-and-terms-in-short):
wiki.gg (wiki.gg network ToS), terms.help-note.com (note.com terms),
yhxy.biligame.com (Bilibili user agreement), endfield.gryphline.com /
www.gryphline.com (publisher fan-content policy).

## Not added, and why

| Host | Reason |
|---|---|
| end.wiki, www.end.wiki | Domain does not resolve in DNS (2026-10-18). Tried both; removed. |
| endfield.gg, talos2codex.com, arknightsendfield.wiki, qieyou.com, Dexerto | Stale, borrowed from mainline Arknights, or contradict other sources. |
| efsim.app | Closed source, no published numbers. |
