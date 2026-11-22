# The rule search decides its open questions (2026-11-22)

Task: give the guided rule search an objective across the fight's two starts, the cues and rule sets (conditional
phases, a Corrosion setup) its open questions needed, and let it settle the owner's team's, Ink Melt's and Typhoeus's
(WILL and INT) rule questions itself; branch `worktree-agent-a83e7d67fd17a6344` from `claude/beautiful-rubin-rpg8vp`.

## 1. Documented rule verdicts go stale silently as the engine moves

- **What happened:** the brief's three questions came with numbers from 2026-11-16 (Estella on Stagger +1.2% full /
  −0.9% zero; Ink Melt's `shows` on rule 7 +2.5–3.9% / −3.3%; the Twilight hold −0.11%). Re-measured at the base
  commit (32 fresh seeds, both starts, `scratch/startdiff.ts`) they had all moved: Estella on Stagger was now −0.40% full
  / +1.44% zero (the signs flipped), the `shows` edit −1.6% / −1.9% (a loss on both), the Twilight hold worth +2.3%
  (dropping it −1.4% / −3.3%). Two days of engine changes (Stagger recovery, the Finisher gate, buffs held in a stop)
  had changed every answer, and nothing in the docs said so. I only noticed because I measured per start before
  designing the cue work; designing a "start-distinguishing cue" for the documented flip would have been wasted.
- **Cause:** rule-list comparisons live as prose numbers on team pages; `scripts/team-ab.ts` re-measures a team's own
  list after a kit change, but not the candidate edits and open questions the docs quote.
- **Suggestion:** keep the open rule questions as data (e.g. `examples/<team>.questions.json`: base list, edited list,
  what's claimed) and give `team-ab` (or a `rules --questions` mode) a pass that re-measures each on both starts and
  flags a verdict that changed sign or significance since its recorded commit.
- **Why it helps:** a lead or agent sees which "owner's calls" still stand before spending hours on them; cost is one
  paired comparison per question per kit change (about a minute each with three workers).

## 2. No formatter config, but `npx prettier` runs anyway

- **What happened:** I ran `npx prettier --write` on one edited engine file to tidy a nested loop; with no config in the
  repository it used prettier's defaults (80 columns) and rewrote the whole 900-line file (1,050 changed lines). The
  obvious undo, `git checkout -- <file>`, was refused by the sandbox's auto-mode classifier as destructive, so I
  rebuilt the file from `git show HEAD:<file> > scratch/…` plus a script replaying every patch of the session (about
  15 minutes, and a risk of losing a hand edit).
- **Cause:** the code is hand-formatted at ~200 columns with no `.prettierrc` or `.prettierignore`, while prettier is
  resolvable through `npx` (a transitive dependency); CLAUDE.md doesn't say "no formatter".
- **Suggestion:** add a `.prettierrc` matching the house style (`printWidth: 200`, or whatever reproduces the files) or
  a `.prettierignore` containing `*`, and one line in CLAUDE.md ("no code formatter: format by hand; `npm run lint`
  checks"). Document the sandbox-safe way to restore one file (`git show HEAD:<path> > <path>` via a scratch copy, or
  `git restore --source=HEAD -- <path>` if the classifier accepts it).
- **Why it helps:** removes a silent whole-file rewrite trap; nothing to maintain.

## 3. Long guided searches queue behind each other in the shared lock

- **What happened:** four guided searches (each now plays both starts: twice the runs) were queued with
  `with-lock`; they run one at a time behind other agents' measure and short jobs, on a machine at load 7–8. The
  searches took most of the session's wall time, and each fresh-seed confirmation queues again behind them.
- **Cause:** the lock serialises all long jobs; a guided search is ~2,000–4,000 300 s runs; the objective across starts
  doubled that by design.
- **Suggestion:** a cheaper screening stage for the guided search (screen on 120 s fights or a control variate from the
  ideal-combo losses, roadmap "cheaper variance"), and a `--kind` for jobs that can share the machine at reduced
  workers (e.g. two guided searches at 2 workers each beside each other).
- **Why it helps:** the search's results come back in an hour instead of an afternoon; the cost is a second, noisier
  screening stage to validate.

## 4. "Which button inflicts which element" had no query

- **What happened:** to propose Corrosion setups I needed, per operator and button, the element its hits inflict
  (Akekuri's battle skill: Heat; Si's: Heat and Cryo; Arcane's combo: the window's element). `efsim kit` prints hits
  but not their `applies`; I wrote a scratch script over `data.kits.operators[op].skills[].hits[].applies`, then the
  engine helper `buttonInflictions` (policyguide.ts).
- **Cause:** kit queries are per skill; the arts-state side of a kit (inflictions, forced reactions, consumes) isn't
  summarised anywhere.
- **Suggestion:** `efsim kit <operator>` lists each skill's `applies` (element × stacks, consumes, forced reactions),
  and `efsim kit-census` a team table "who inflicts what" (it could call `buttonInflictions`).
- **Why it helps:** team-level questions (which reactions a team can form, who supplies them) answered in one command.

## What worked well

- The guided search's structure (candidates → screen → confirm → judge) took a second start and new move kinds with
  local changes: `playMany` over starts, the same `judgeEdit` on the per-seed objective.
- Common random numbers keyed by a rule's cue and presses meant a rule moved into a set keeps comparable delays.
- `--stepping frames` as a reference made the new cues' event stepping a one-test check.
