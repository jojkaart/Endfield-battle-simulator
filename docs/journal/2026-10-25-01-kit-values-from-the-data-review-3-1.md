## 2026-10-25: kit values from the data (review 3.1)

**Goal:** kits take what the game data has from the data; a hand-written
value that differs must say why (review 2026-10-22, 3.1).

**Done** (one commit per step; design.md "Kits and the game data"):
- Safety net: `tests/kits.test.ts` snapshots every loaded kit (canonical
  JSON digests; `EFSIM_KITS_DUMP` writes them to diff).
- One matcher and one compile in packages/data (`kitMatch.ts`:
  `compileOperatorSkill` with kit-draft's options, cached; `matchSkill`
  from the test's `kitDisagreements`); kit-draft's output is unchanged.
- The loader fills what a kit leaves out where the landings agree:
  frames (a hit's landings must be one branch path of its own), count,
  events, factor, element, poise, poiseControlledOnly, detached, energy,
  SP (where the data places all of a skill's grants), team energy, energy
  blocks. `efsim kit-trim [--write]` removed 1,404 values equal to these
  (events 393, frames 330, poise 166, count 113, sp 106, factor 85,
  detached 53, element 53, poiseControlledOnly 39, energy 30, teamEnergy
  24, spBeforeDamage 11, energyBlockSeconds 1; 57 KB), each only where
  the file loads exactly as before (generated commits).
- A written value that differs is a load error unless marked
  (`dataOverride: {field: "reason"}` on the hit, trigger, buff or skill);
  a mark where nothing differs is one too. The 178 KNOWN entries moved into
  the kits with their comments as reasons; the comparison now also covers
  SP and its timing, launch, detached, a skill's cast triggers (hits,
  energy, SP, applications at the delay), equipment's triggered hits and
  buff durations against the CreateBuff. 209 marks in all.
- Load-time references: event keys name data files, `gameBuffs` BuffData
  files, application keys skill values (`scaleKey` only on Breach);
  isFinalStrike reads BuffData too and fails on a missing file.
- `skillTypes.ts` lists all 338 node types of the fetched SkillData and
  BuffData (interpreted, an undecided condition, or uninterpreted with
  why); `skillTypes.test.ts` fails on a new one.
- Load time 16.3 s → 11.0 s: parseJsonExact skips its reviver when no
  number can be unsafe (6× faster parsing), which more than pays for
  compiling every kit skill (3 s).

**What the comparison found, fixed in the kits** (no example total or
verified verdict moved): 24 SP grants the data gives only while controlled
were ungated, 11 lacked spBeforeDamage; Laevatain's Twilight and
Purrchena's shield named a skill key their buff doesn't use (same values).

**Numbers that moved:** only the pending fixtures with Mi Fu, when her
(and Da Pan's) hits got their event keys from the data (kept `[]` and
marked until then): 2fd9 / 99fb / de6a, Mi Fu's 79 / 64 / 76 uncovered
hits are now mismatches (one unquantified each in 99fb and de6a; Chen
in de6a fallback 2 → assumed 2); d572, Mi Fu plain 2 → 18, assumed
0 → 102, mismatch 4 → 21, and with her casts in the buff replay Rossi
assumed 201 → 444 (fallback 254 → 11), Camille plain and assumed 121 →
115 (fallback 9 → 21), Gilberta plain 138 → 140. d572 fits her kit;
the other three are off by a per-fixture factor (roadmap 3).

**Decisions and why:** the loaded-kits snapshot, not the files, is what
the trim keeps identical (one field at a time, all of a hit's first). A
cast trigger with a random choice isn't matched (its options are the
data's branches of one landing). SP is filled only where the data places
every grant, else the engine's first-hit `atb` stays (Last Rite's
battle skill, hitless skills, grants on branches). Buff durations are
compared, not filled: a kit buff without one lasts until ended. The
`conditions` plumbing stays (owner's decision pending).

**Left:** fill launch, applications and bonuses from the data; SP for
hitless skills as cast triggers; the 5 hits still writing `events:
[skillId]` (their landings span files); a parse cache for the build
(the compiler re-reads shared files); Mi Fu's per-fixture factor.
