# Yinglung's Edge stack counts against the logs (2026-11-22)

Task: list deterministic rules for how many Type 50 Yinglung's Edge layers a wearer's combo gets, score each against
the layers every wearer combo's damage implies in the development logs, iterate on the misfits, and implement a
winning rule (branch `worktree-agent-a91601bd8d49ff1f6`, from 1ab4647).

## 1. No view of "the layers a consumed buff had on this cast", engine vs damage

- **What happened:** the question is per cast (a combo), not per hit, and the buff is never listed. I wrote
  scratch/edge-export.ts (readingBasis + landingDamage per combo hit, both readings), a decoder
  (scratch/edge-implied.py: the DMG-bonus gap in 0.2 units, Jade Vessel's 0.3–0.7 told apart because it isn't a
  multiple of 0.2), then a scorer. The first decoding trusted the log reading and was wrong in 9c0b 71.5 (the log
  reading drops an unlisted ATK buff the engine had right to the unit) and 9555 39.2 (the first four slashes carry a
  buff the later ones don't). About a third of the session went into the reading, not the hypotheses.
- **Cause:** `zmdlogs hits --json` gives the primary reading's zones and modifiers but only the log reading's rounded
  value: the log reading's zones and the kit buffs it dropped (never listed by ZMDLogs) aren't exported, so a script
  can't tell "the log reading lacks Edge" from "the log reading lacks an ATK buff". There is no per-cast aggregate.
- **Suggestion:** (a) export `logReading` as an object (value, zones, modifiers, and the kit buffs it dropped because
  no logged name exists) in hitexport.ts; (b) a `zmdlogs consumed <fixture…> --buff <kit buff>` view: per cast of
  the kinds that consume the buff, the engine's layers (ReplayCastFacts consumed), and the layers each reading's
  median implies with how many hits agree and how exact it is (the decoder in scratch/edge-implied.py), other
  consumed buffs (Jade Vessel) solved jointly.
- **Why it helps:** every "is the replay's count of X right" question (Edge, Jade Vessel, Lustrous Carmine's next-cast
  buffs, Bonekrusha) needs exactly this; the decoding pitfalls get solved once.

## 2. `zmdlogs instances` misses casts the replay makes

- **What happened:** my hypotheses ran on `loggedSkillInstances`. 9555 92.3 looked like a misfit for every rule until
  the replay trace showed Last Rite's battle skill at 79.83 s: its hits are logged under
  `buff_chr_0026_lastrite_normal_skill_phantom_main`, which the placement files under a trigger group, so the
  instance view has no battle cast there. Laevatain's during-ultimate battle skill appears twice (db87: the
  `normal_skill` cast event at 27.13 s as "an event only" and the `normal_skill_during_ult` cast from hits at
  29.00 s, one press across Si's ultimate stop) — the replay makes it twice too.
- **Cause:** "the casts of X" has two sources of truth, the query layer (query.ts) and the replay's
  assembleCasts (castsFromBuffLanes / castsFromTriggerHits / withLoggedCasts / castsFromBuffEnds), and they disagree
  without saying so.
- **Suggestion:** give `zmdlogs instances` a column (or `--replay`) with the cast the replay makes for each item and
  the replay-only casts (inferred ones: "from a buff end", "from trigger hits"), and flag an event-only instance
  followed within LOGGED_CAST_MS (world time) by a placed cast of a same-kind slot variant without its own event.
- **Why it helps:** a census over instances then counts what the engine counts; the double press would have been a
  one-line warning.

## 3. Long waits on the shared lock for a one-minute measure

- **What happened:** `npm run measure` waited 20+ min behind other worktrees' snapshots, measures and rule searches
  (with-lock status showed 10 tickets); a re-export of 30 logs (normally 22 s) took 572 s under load. I couldn't
  edit code meanwhile, since measure reads the working tree when it finally starts.
- **Cause:** without `--at`, measure loads the working tree's code when its workers start, after the wait, so an
  edit during the wait would be measured too.
- **Suggestion:** make `npm run measure` default to `--at HEAD` when the tree is clean at enqueue, or snapshot the
  working tree into scratch/at/ at enqueue (as `--at` already does for a ref) so the agent can keep editing.
- **Why it helps:** the wait becomes free time instead of a forced idle.

## 4. Which skill a logged press is gets decided in two places

- **What happened:** Laevatain's Twilight battle skill is made twice in db87 (a logged `normal_skill` press plus a
  `normal_skill_during_ult` cast placed from its hits). I fixed it in withLoggedCasts (merge the press into the
  placed variant); measure showed it also merged Purrchena's battle skill with its counter (04d4), whose kit has the
  same `not X` / `X` shape, so I reverted it (69360fd). Two measure rounds (~40 min of queue) for a rule that could
  not be right statically.
- **Cause:** casts are assembled statically (withLoggedCasts, castsFromBuffEnds: no timeline state) and then
  interpreted with state (replayedSkill: `slot`, `leadsTo`, `shows`, now `expires`); whether a press is the plain
  skill or a variant needs the state, but the duplicate is created in the static pass.
- **Suggestion:** let the static pass mark a press and a nearby placed variant as alternatives of one slot (e.g.
  `alternativeOf` on the press) and let makeCast drop whichever the state rules out (the press when its own skill is
  unavailable and the variant's placed cast follows; else the press is a cast of its own).
- **Why it helps:** fixes db87 without a Purrchena-shaped exception, and gives one place where "what was this press"
  is answered.

## What worked well

`efsim gamedata tree` on the four set buffs settled the data side in minutes (aura, detector, stacking, the clear);
`zmdlogs replay --trace-buff owner:id` showed every add with its cast, which found the forced Final Strokes;
`zmdlogs census --list` gave the press-before-burst pattern with rerun lines ready to cite.

## Outcome (round 5)

2026-11-22, improvement round 5 (docs/friction-done/2026-11-22-round-5.md); what's left is in docs/friction/2026-11-22-backlog-after-round-5.md.

- 1 (a consumed buff's layers per cast, the log reading's parts): not done, carried over to the round-5 backlog (`logReading` as an object in hitexport.ts, `zmdlogs consumed`).
- 2 (`zmdlogs instances` misses casts the replay makes): partly (cec2dd6): `zmdlogs replay`'s EVENT lines say what the replay made of each cast event; the instances view's replay column is carried over to the round-5 backlog.
- 3 (long waits for a one-minute measure; can't edit meanwhile): done (d98b497): measure fixes its code at queue time.
- 4 (which skill a press is gets decided in two places): not done: needs an accuracy task (lead: buffreplay.ts withLoggedCasts / makeCast, `alternativeOf` on a press, db87's double Twilight battle skill and 04d4's Purrchena counter as the two cases; measure moves).
