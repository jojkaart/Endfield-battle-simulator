## 2026-10-25: the log check reads facts from the replay (review 3.2)

**Goal:** have `zmdlogs check` take what the kit-buff replay already knows
instead of trying alternatives (review 3.2), a family at a time, each
held to the verified ratchet and the negative control.

**Done** (one commit per family; design.md, "What the replay decides"):
- Infrastructure: the replay always runs; it records per cast
  (`castFacts`) and per logged landing (`landing`: `LandedHit` with
  `LandingFacts`, engine, replay only) what it knows, and marks a fact
  unknown where its own timing could change it (REPLAY_EDGE_MS).
- Link from the cast (predictedLink, linkGrants, LINK_MS gone); cast-
  consumed buffs; combo event counts; own stacks, own buff layers and the
  landed kit hit; Corrosion (the engine's shred at the landing); the log's
  crits fed to the replay (`loggedCrits`), so crit-triggered buffs are
  decided where a second replay (unlogged crits all critting) agrees;
  layers of buffs listed once at the replay's count; trigger landings
  matched to the log within NEAR_FRAMES; heals of the controlled operator
  left to the log; casts without damage from the detail's cast events
  (`LogFixture.casts`, `zmdlogs casts`; added to 40d9, 4e5e, 0eef) and
  from buff lanes (`castsFromBuffLanes`); `zmdlogs check --simulate`, the
  end point as a diagnostic.
- Bugs found on the way: a phantom cast from a late kit frame (placement:
  a key's first landing now joins the cast it can belong to; a later cast
  of the operator ends an earlier one's landings to come); pinned landings
  dropped or moved by their skill's jumps (Rossi's wolves); layered buffs
  undercounted (a pushed-out layer ended at the wrong layer's start).
- 0eef and dbae verify again: back in fixtures/ (pending README).

**Numbers** (four verified fixtures 40d9, 4e5e, b7b3, bdf2): readings
108,913 → 33,007 (per judged hit 166 → 50; 4e5e 91,895 → 25,936, median
6 → 3, max 8,640 → 2,400), check time 13.7 s → 5.2 s; across the six now
verified, plain matches 160 → 396, assumed 398 → 303, fallback 114 → 49.
Negative control (×0.97 / ×1.03): 4e5e 11/0 → 2/0, bdf2 3/5 → 0/0, dbae
1/0 → 0/0, 0eef 0/7 → 0/0, 40d9 and b7b3 0/0: the bound is 1% (was 4%).
Pending (20): 260 s → 99 s, readings per hit 210 → 81, plain 1,169 →
1,808, fallback 1,584 → 1,384, mismatch 5,726 → 5,770 (the losses are
disagreements the replay now shows: pending README). `npm run test:logs`
239 s → about 105 s.

**Decisions and why:**
- A fact the replay's timing could change is unknown, as for the buffs it
  decides; there the old alternatives are tried, labelled "(the replay
  can't say: why)". Strict facts are what tightens the negative control:
  a relaxed second stage would give its chance matches back.
- The enemy's side of a landing (inflictions, Vulnerable, consumed stacks)
  isn't taken from the replay: its inflictions aren't checked against the
  log (Typhoeus's Nature bursts in 0eef / dbae consume an infliction the
  replay doesn't have). The landed kit hit is first, the placement's
  others tried (a perfect combo is the player's timing).
- Placed casts keep the placement's start: the log's cast event can come
  before the skill acts (0eef Liino's battle skill at 760 ms, its buffs at
  1314 ms); moving starts to it lost a Liino match. Only casts the hits
  can't show are added.
- 2026-10-24's dead end (Arcane's Corrosion cap losing Si's matches) was
  the cap on the log's time; on the replay's own ramp it fits (bdf2 hits
  within Corrosion's range 93 → 26).

**Dead ends:** the landed kit hit as the only one (4e5e Rossi's perfect
combo, b7b3 Tangtang's dive spouts placed as her battle skill's) and the
enemy's side from the landing (dbae Typhoeus's bursts) lost matches;
moving placed casts to the log's cast events (above); NEAR_FRAMES 2
missed 0eef's volley (logged at 4187 ms, landed 4433–4733).

**Left:** the enemy's side and reaction levels from the replay
(reactioncheck.ts still runs its own enemy replay); the end point matches
a third of 4e5e's hits (kit buffs named after other game buffs than the
log's count twice there); the kit notes of Liino, Typhoeus, Si's weapon,
Yinglung, Spellburst and funnel_0019 still name `fixtures/pending/` for
0eef and dbae (kit JSON, left to the data-layer work); Si's Yinglung's
Edge one layer short (b7b3 first combo, abfd; in-game test 29), the
Endministrator's Grand Vision on her shatter, Chen's Glorious Memory
count (d4fb).
