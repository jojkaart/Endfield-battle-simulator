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

## On the allowlist

Status: **useful** (used for real findings), **untested** (reachable, not yet
used), **blocked by site** (allowed, but the site rejects our requests),
**not useful** (candidate for removal).

| Host | Purpose | Reachable | Status |
|---|---|---|---|
| endfield.wiki.gg | Talos Wiki: formula pages, data | `api.php` only; pages give Cloudflare 403 | untested |
| endfieldhub.org | Database, `/webmcp/*.json` | yes | untested |
| zmdlogs.com | Published battle logs (API) | yes | untested |
| www.end-axis.com | Endaxis simulator site (bare `end-axis.com` not allowed) | yes | untested |
| wiki.biligame.com | CN wiki | yes | untested |
| note.com | Rounding article (note.com/at67275) | yes | untested |
| arknightsendfield.gg | "Datafield runs": in-game damage totals | yes | untested |
| www.gamekee.com | CN wiki, damage formula | yes | untested |
| end.canmoe.com | Datamine-style IDs and level tables | yes | untested |
| www.endfieldsimulations.dev | Zero Sanity live site (source is in `reference/`) | yes | untested |
| endfield.huijiwiki.com | CN wiki, damage formula | no: Cloudflare 403, also on `api.php` | blocked by site |
| www.icy-veins.com | Guides, skill values | no: Cloudflare 403 | blocked by site |
| ngabbs.com | CN forum, community testing | no: site 403 | blocked by site |

If the "blocked by site" hosts stay unreachable, remove them.

## Not added, and why

| Host | Reason |
|---|---|
| end.wiki, www.end.wiki | Domain does not resolve in DNS (2026-10-18). Tried both; removed. |
| endfield.gg, talos2codex.com, arknightsendfield.wiki, qieyou.com, Dexerto | Stale, borrowed from mainline Arknights, or contradict other sources. |
| efsim.app | Closed source, no published numbers. |
