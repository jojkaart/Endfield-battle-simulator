// efsim: Endfield battle simulator command line. The entry is main.ts, which runs the checkout check (checkout.ts)
// before this module and its imports are linked.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cacheDir, cacheDisabled, clearGameDataCache, gameDataCacheKey, listGameDataCache, loadGameData, withKitFiles } from "@efsim/data";
import { EngineError, FPS, simulate as simulateScenario, withSeconds, type CritMode, type TimelineScenario } from "@efsim/engine";
import { calc, compare, find, readBuild, template, type CalcOptions } from "./commands.ts";
import { kitDraft } from "./kitdraft.ts";
import { formatRuns, formatSimulation, loopCommand, readScenario, searchCommand } from "./simulate.ts";
import { checkLog, engineHits, engineReport, findScales, formatLogCheck, formatSimulatedLog, impliedScales, logBuffReplay, simulateLog } from "./logcheck.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
import { importBattle, LOG_DIRS, logFixtureFiles, readDevFixture, readLogFixture, readLogSplit, refreshFixture, refuseHoldoutFile } from "./logs.ts";
import { checkReactions, formatReactionCheck } from "./reactioncheck.ts";
import { formatCensus, kitCensus } from "./census.ts";
import { formatTrim, kitTrim } from "./kittrim.ts";
import { knifeEdge, type EdgePool } from "./edge.ts";
import { fixtureTiming, formatTimingReport } from "./bufftiming.ts";
import { formatPayoffs, runPayoffs } from "./payoffs.ts";
import { formatGear, gearAscent, gearCandidates, type GearCandidatesFile } from "./gear.ts";
import { readRuleList, rulesCommand } from "./rules.ts";
import { formatGuided, guidedSearch, writeGuided } from "./guided.ts";
import { formatLogList, logDirs } from "./logtools.ts";
import { exportHits, exportHitsParallel, formatRecord, type HitRecord } from "./hitexport.ts";
import { battleIdOf, cacheRawDetail, formatRaw, rawDetail, rawDir } from "./zmdraw.ts";
import { formatMentions, gamedataTree, whoMentions } from "./gamedata.ts";
import { diagnose, formatDiagnosis } from "./diagnose.ts";
import { formatRuleGear, gearOnRules } from "./gearrules.ts";
import { parseAssume, underAssume, zeroCompanion } from "./assume.ts";
import { setWorkerKitFiles } from "./rulespool.ts";

const USAGE = `Usage:
  efsim find <text>                       Look up operator, weapon, gear and enemy IDs by name
  efsim template <operator> [--weapon id] Print a build file to start from
  efsim calc <build.json> [options]       Stat panel and damage per hit
  efsim compare <a.json> <b.json> [opts]  Two builds of one operator side by side
  efsim edge <build.json> <pool.json>     Loadouts from owned weapons and gear that put a mode's two attributes
                                          on a knife edge (Arcane's INT / WILL; pool: {weapons?, gear}; --top n)
  efsim simulate <scenario.json>          Run a team rotation on the timeline (--verbose: every hit); with
                                          expected crits also the total's distribution (mean, standard
                                          deviation, 5–95%, bounds)
                [--duration s]            Fight length instead of the scenario's (also for search)
                [--seed n]                Seed of the battle's rolls (scenario crit "rolled")
                [--battles k]             Seeded battles for the distribution when random outcomes change
                                          what follows (crit-triggered effects, dodges, chances; default 8)
                [--runs n]                n battles with rolled crits: the spread of the damage
                [--attack-every s]        The enemy attacks the controlled operator every s seconds
                [--dodge p]               Dash at every enemy attack, perfect with chance p (0–1)
  efsim search <scenario.json>            Find a rotation for the scenario's team (its rotation is ignored)
                [--beam n] [--out file]   Beam width w (default 24): runs w/2, w and 2w, keeps the best and
                                          shows how far apart they are; save the rotation as a scenario
                [--single]                Only beam w (a third of the time, no spread)
                [--loop] [--loops n]      An opener and a loop instead of one fight: rounds from a cast of the
                                          slowest ultimate to its next, each the best closing plan at beam w
                                          or the last replayed, until one plays 3 more times exactly
                                          (--out saves the opener and n plays of the loop, default 4)
                [--rounds n]              With --loop: rounds searched at most (default 12)
                [--sync]                  With --loop: rounds from a moment every ultimate is ready to the
                                          next, each cast at least once (fast ones held for the slowest)
                [--prune]                 Drop dominated states and, by branch and bound on the payoff table's
                                          ceilings (efsim payoffs), states that can't beat the best so far
                [--no-macros]             Without the payoff table's chains (efsim payoffs) as one choice each
                                          where their first step is one (default: with them, in an extra
                                          half-beam share; finds more, takes 1.6–3.8× as long)
                [--skeletons]             Guide every width by three skeletons: the payoff table's chains and
                                          their merges scheduled greedily by value per second (extra beam share)
                [--setup score|share]     Count what the pieces a state holds are worth to payoffs it can still
                                          cast (the payoff table's ceilings): in the score, or only in the
                                          ranking of an extra half-beam share
                [--swaps]                 Let the rotation swap the controlled operator (default: never; the
                                          scenario's controlled operator does every basic attack and dive)
                [--seeds k]               With random outcomes: battles each candidate is ranked over (default 4)
                [--percentile p]          Rank by that percentile (0–100) of them instead of the mean
                [--runs n]                Battles for the found rotation's distribution (default 50; 0: none)
                [--seed n] [--dodge p] [--attack-every s]  As for simulate
  efsim rules <scenario.json> <rules.json> A rule-based rotation (opener, then "when cue X is visible, do Y";
                                          schemas/rules.schema.json) played by a simulated player with a
                                          reaction delay over a long fight: sustained DPS after the opener,
                                          its spread over seeds, robustness to the delay, rules fired,
                                          learnability; the scenario's own rotation as the 60 s reference
                [--duration s]            Fight length (default 300)
                [--reaction s]            Reaction delay (default 0.3, jittered ±50%, seeded; 0: a bot)
                [--seeds k]               Delay seeds (default 5)
                [--first-seed n]          The first of them (default 1; 1001: fresh seeds, for numbers to write down)
                [--search] [--out file]   Local search over rule lists from this one: the Pareto front of DPS
                                          against complexity, the best (less --penalty a complexity point,
                                          default 0.002) saved to --out
                [--iterations n]          Lists scored (default 150)
                [--search-seconds s]      Searched fights' length (default 180)
                [--search-seeds k]        Seeds per list in the search (default 2)
                [--front n]               Front lists scored again over the whole fight (default 8)
                [--compare <rules.json>]  Another list against this one: the paired gain ± standard error on seeds
                                          1–k and on fresh seeds 1001… (--fresh n, default 32; 0: none)
                [--assume <id>=<reading>] Run under another reading of a kit's open assumption (repeatable; e.g.
                                          si-haste-every-end=every-end, in-game test 109; the kits register them)
                [--assumptions]           Also under each other reading of the team's kits' open assumptions: the
                                          list's DPS and whether --compare's verdict holds or flips there
                [--workers n]             Worker threads (default: cores less one; 1: none)
                [--guided] [--out file]   The payoff-guided search instead: each damage window's ideal combo (every
                                          multiplier the team puts on it, on every hit) and what each missing one
                                          costs; edits aimed at the biggest losses (hold the giver for the window's
                                          visible cue, chain the presses, start the window when the multiplier is up,
                                          save SP, "shows", spare SP; a few random moves), screened on common seeds,
                                          the best played on more, one kept a round when its gain clears twice its
                                          standard error; achievement before / after; the final list to --out
                [--rounds n] [--edits n] [--random n]  Rounds at most (default 6), directed edits a round
                                          (default 28), random ones added (default 4)
                [--screen-seeds k] [--confirm-seeds k] [--extend n]  Seeds each edit is screened on (default 6),
                                          the best n (default 4) are played on (default 32)
                [--max-seeds k]           Seeds a close call (1.2 to 2 standard errors) is taken to (default 64)
                [--also <scenario.json>]  A second start of the fight: the best edits are played on it too, and one is
                                          kept only if it isn't worse there (by more than one standard error);
                                          default: the zero-energy companion (<team>-zero.scenario.json) if there is
                                          one. --assume, --assumptions (the final check under each other reading) and
                                          --out (written as rounds keep lists, then the final one) as above
                [--check-seeds k] [--workers n]  The final list against the start on k fresh seeds (default the
                                          confirm seeds; 0: none); worker threads (default: cores less one)
  efsim payoffs <scenario.json>           The team's payoff table (engine probes): what each step produces and
                                          which combo windows it opens, each damaging step's ceiling under the
                                          best bundle of what the team achieves (and who achieves each piece),
                                          and chains in which each step opens or sets up the next; with a
                                          rotation, how close its casts came to their ceilings
                [--top n] [--json]        Rows printed per table (default 15; data is never cut); everything as JSON
                [--depth n]               Longest chain (default 6)
  efsim diagnose <scenario.json> <rules.json>  What a rule list leaves on the table, averaged over reaction-delay
                                          seeds (common random numbers): per operator ultimate energy gained
                                          (by source), spent, wasted at the cap, time ready but not cast (and
                                          why), combos lit but unused, team SP at the cap, what drives the main
                                          damage dealer (other operators' effects and enemy states on its hits),
                                          damage shares, sustained DPS's spread (reaction delays vs crits);
                                          then marginal values: team sustained DPS for one gear-line-sized step
                                          of each stat gear offers on each operator; findings in plain words
                [--duration s] [--reaction s]  As for rules (default 300, 0.3)
                [--seeds k]               Seeds of the diagnosis (default 5)
                [--marginal-seeds k]      Seeds of each marginal value (default 4; 0: none)
                [--operator <op>]         Only this operator's marginal values (repeatable)
                [--workers n]             Worker threads (default: cores less one; 1: none)
                [--json]                  Everything as JSON
                [--assume <id>=<reading>] [--assumptions]  As for rules: the diagnosis under each other reading
  efsim gear <scenario.json>              Each operator's gear from the loadouts seen in the logs (fixtures; hold-outs left out), scored
                                          on the scenario's rotation with only that operator's gear swapped (full artifice), best
                                          per operator with the others fixed until nothing changes; a table per operator
                [--candidates file]       More loadouts to try: {"candidates": [{"operator", "gear": [4 ids], "source"}]}
                [--keep <operator>]       Don't vary this operator (repeatable); its candidates' mode attributes are shown
                [--min-count n] [--top n] Log loadouts seen at least n times (default 2), at most n per operator (default 6)
                [--repairs n]             Where steps of the rotation can't be played with a loadout: start each later (up to 2 s,
                                          or with a later step) or drop it, if at most n (default 20; 0: never)
                [--search-beam n]         With more: a narrow search at beam n (default 12)
                [--passes n] [--out file] Passes at most (default 4; 3 with --rules); save the scenario with the chosen gear (its rotation kept)
                [--rules <rules.json>]    Score loadouts by playing this rule list instead (sustained DPS over reaction-delay
                                          seeds, common random numbers; a change only when its gain is beyond twice its
                                          standard error); candidates also from the diagnosis' marginal values (piece swaps
                                          that keep the active sets, each set's best loadout screened by play); prints the
                                          diagnosis before and after (efsim diagnose)
                [--seeds k] [--duration s] [--reaction s] [--marginal-seeds k] [--workers n]  With --rules (default 6 seeds,
                                          300 s, 0.3 s, 4, cores less one)
                [--generated n] [--sets n]  With --rules: swaps per operator per pass (default 4), set builds kept after
                                          screening (default 2)
                [--also <scenario.json>]  With --rules: a change is taken only if it isn't worse on this start (by more
                                          than one standard error); default the zero-energy companion if there is one
                [--assume <id>=<reading>] [--assumptions]  With --rules: as for rules (the chosen gear on fresh seeds
                                          under each other reading)
  efsim zmdlogs list                      The development logs (never a hold-out): file, team with potentials,
                                          enemy, hits, casts, length; the safe start of any scan over the logs
                [--with <operator>]       Only logs whose team has it (id or part of the name; repeatable: all of them)
                [--dir <dir>] [--json]    Only verified, pending or multi (repeatable); everything as JSON
  efsim zmdlogs hits [fixture…]           The log check's numbers per logged hit, one line each (default: every
                                          verified and pending development log; never a hold-out): logged value,
                                          verdict and class, the engine's primary reading and its error; with
                                          --json a JSON line with its scale parts, zones, modifiers, the landing's
                                          operator and, for kit hits, the enemy's statuses (applier, level,
                                          Arts Intensity)
                [--kind <k>] [--operator <op>]  Only this reaction kind ("skill": kit hits) / operator (repeatable)
                [--json] [--workers n]    JSON Lines; fixtures on n worker threads (default 1)
  efsim zmdlogs raw <fixture | id>        A battle's raw detail as ZMDLogs recorded it: buff lanes (key, target,
                                          source, start–end, effects) and events (key, value, the skill a Stagger is
                                          credited to). From the git-ignored cache (filled by import and refresh),
                                          else fetched once; never a hold-out
                [--buffs <regex>] [--events <regex>]  Only buff lanes / events whose key matches
  efsim zmdlogs import <battle id>        Turn a ZMDLogs battle into fixtures/zmdlogs-<id>.json
                                          (fixtures/multi-target/ when it hit several enemies)
                [--enemy-level n]         (default: the stage's, else inferred from total damage on a clear)
                [--detail file]           Use an already downloaded /api/battles/<id> response
                [--note text]             Extra provenance note (repeatable)
  efsim zmdlogs check <fixture.json>      Predict every logged hit and compare (kit buffs from the
                                          replay of the logged casts; where it and the log disagree;
                                          whether it verifies the fixture, matches per operator as
                                          plain / assumed / log-listing fallback, and their strength)
                [--log-buffs]             Kit buffs as the log lists them instead (the check before 2026-10-22)
                [--simulate]              Simulate the logged casts instead and compare each hit with its landing
                                          (crits, enemy HP and effects no kit models from the log)
  efsim zmdlogs timing [fixture…]         Buff timing report (a diagnostic, never scored): which kit buff's
                                          window, shifted, fits the hits the check doesn't (fallback, mismatch),
                                          as patterns across logs with mechanism candidates (default: every
                                          development log; hold-out logs are skipped)
                [--assumed]               Assumed matches too
                [--singles]               No pairs of toggles
                [--top n] [--verbose]     Patterns shown (default 20); every run, and each hit's best fit
  efsim zmdlogs reactions <fixture.json>  Replay the kits' inflictions; compare bursts and reactions
  efsim zmdlogs refresh <fixture.json> --detail <file>
                                          Add what a downloaded battle detail records that an older
                                          import lacks: casts without damage, each hit's Stagger
  efsim zmdlogs scales <fixture> <op>     Multiplier each logged hit of an operator implies
  efsim zmdlogs find-scales <fixture> <op> Skill values (keys) that explain each logged event
  efsim gamedata tree <id>                A BuffData or SkillData file as an event → action → condition tree:
                                          presentation and defaults left out, value fields as "key k (default v)",
                                          known enums named (docs/game-data-format.md)
                [--grep <regex>] [--depth n]  Only matching lines (with their ancestors and subtrees); levels shown
  efsim gamedata who <id>                 Every BuffData / SkillData file that names a buff or skill id: the action
                                          around it (who creates, finishes or checks it), its buff event or frame
  efsim kit-draft <operator>              Draft a kit from SkillData (to verify against logs)
  efsim kit-census                        Kit features per operator, for the review after each new kit
  efsim kit-trim [--write]                Kit values the loader takes from the data anyway (--write removes them)
  efsim cache [clear]                     The compiled game-data cache: where it is, its entries, whether the
                                          current inputs have one; clear removes them (EFSIM_NO_CACHE=1: off)

Any command reading the game data:
  --kit <file>        An operator kit file (as in packages/data/kits/operators/, any name) in place of that
                      operator's own, for this run (repeatable): what-if variants without editing the real kit

Options for calc and compare:
  --enemy <id>        Target (default eny_0051_rodin, Rhodagn)
  --level <n>         Enemy level (default 90)
  --crit <mode>       never | always | expected (default expected)
  --staggered         Target is staggered
  --buff <id>[:<n>]   Count a kit buff (own or equipment) as active, with n layers (repeatable; calc)
  --verbose           Every stat contribution and the zones of a hit
`;

/**
 * The logs the buff timing report reads: those named (paths, or ids under fixtures/pending/), else every development
 * log of the split (fixtures/holdout/holdout.json). Hold-out logs are never read (only counted as skipped): they're
 * measured, never debugged (docs/accuracy-plan.md, "Choosing logs").
 */
function timingFixtures(named: readonly string[]): { files: string[]; skipped: number } {
  const split = readLogSplit(ROOT);
  const holdout = split.holdout;
  const idOf = (f: string) => basename(f).replace(/\.json$/, "");
  const wanted = named.length ? named : split.development;
  const files = wanted.filter((f) => !holdout.has(idOf(f))).map((f) => (f.endsWith(".json") ? f : join(ROOT, "fixtures/pending", `${f.startsWith("zmdlogs-") ? f : `zmdlogs-${f}`}.json`)));
  return { files, skipped: wanted.length - files.length };
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      enemy: { type: "string", default: "eny_0051_rodin" },
      level: { type: "string", default: "90" },
      crit: { type: "string", default: "expected" },
      staggered: { type: "boolean", default: false },
      buff: { type: "string", multiple: true, default: [] },
      weapon: { type: "string" },
      "enemy-level": { type: "string" },
      detail: { type: "string" },
      note: { type: "string", multiple: true, default: [] },
      verbose: { type: "boolean", default: false },
      "log-buffs": { type: "boolean", default: false },
      simulate: { type: "boolean", default: false },
      beam: { type: "string", default: "24" },
      top: { type: "string" },
      single: { type: "boolean", default: false },
      swaps: { type: "boolean", default: false },
      loop: { type: "boolean", default: false },
      loops: { type: "string" },
      rounds: { type: "string" },
      sync: { type: "boolean", default: false },
      seed: { type: "string" },
      runs: { type: "string" },
      seeds: { type: "string" },
      battles: { type: "string" },
      percentile: { type: "string" },
      dodge: { type: "string" },
      "attack-every": { type: "string" },
      out: { type: "string" },
      write: { type: "boolean", default: false },
      assumed: { type: "boolean", default: false },
      singles: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      prune: { type: "boolean", default: false },
      macros: { type: "boolean", default: true },
      skeletons: { type: "boolean", default: false },
      setup: { type: "string" },
      depth: { type: "string" },
      candidates: { type: "string" },
      keep: { type: "string", multiple: true, default: [] },
      "min-count": { type: "string" },
      "search-beam": { type: "string" },
      repairs: { type: "string" },
      passes: { type: "string" },
      duration: { type: "string" },
      search: { type: "boolean", default: false },
      guided: { type: "boolean", default: false },
      "screen-seeds": { type: "string" },
      "confirm-seeds": { type: "string" },
      "check-seeds": { type: "string" },
      "max-seeds": { type: "string" },
      also: { type: "string" },
      extend: { type: "string" },
      edits: { type: "string" },
      random: { type: "string" },
      reaction: { type: "string" },
      iterations: { type: "string" },
      "search-seconds": { type: "string" },
      "search-seeds": { type: "string" },
      penalty: { type: "string" },
      front: { type: "string" },
      "marginal-seeds": { type: "string" },
      operator: { type: "string", multiple: true, default: [] },
      workers: { type: "string" },
      rules: { type: "string" },
      generated: { type: "string" },
      sets: { type: "string" },
      compare: { type: "string" },
      fresh: { type: "string" },
      "first-seed": { type: "string" },
      assume: { type: "string", multiple: true, default: [] },
      assumptions: { type: "boolean", default: false },
      kit: { type: "string", multiple: true, default: [] },
      with: { type: "string", multiple: true, default: [] },
      kind: { type: "string" },
      buffs: { type: "string" },
      grep: { type: "string" },
      events: { type: "string" },
      dir: { type: "string", multiple: true, default: [] },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, ...args] = positionals;
  if (values.help || !command) {
    process.stdout.write(USAGE);
    return command || values.help ? 0 : 1;
  }
  const crit = values.crit as CritMode;
  if (!["never", "always", "expected"].includes(crit)) throw new Error(`--crit must be never, always or expected`);
  const level = Number(values.level);
  if (!Number.isInteger(level) || level < 1) throw new Error(`--level must be a whole number`);
  const options: CalcOptions = {
    target: { enemy: values.enemy, level },
    crit,
    staggered: values.staggered,
    buffs: values.buff.map((b) => {
      const [buff, n] = b.split(":");
      const layers = n === undefined ? 1 : Number(n);
      if (!buff || !Number.isInteger(layers) || layers < 1) throw new Error(`--buff takes <id> or <id>:<layers>`);
      return { buff, layers };
    }),
    verbose: values.verbose,
  };

  const need = (n: number) => {
    if (args.length !== n) throw new Error(`${command} takes ${n} argument${n === 1 ? "" : "s"}\n\n${USAGE}`);
  };
  /** The scenario with --seed, --dodge and --attack-every applied (simulate and search). */
  const withBattleOptions = (scenario: TimelineScenario): TimelineScenario => {
    const seed = values.seed === undefined ? undefined : Number(values.seed);
    if (seed !== undefined && !(Number.isInteger(seed) && seed >= 0)) throw new Error(`--seed must be a whole number ≥ 0`);
    const chance = values.dodge === undefined ? undefined : Number(values.dodge);
    if (chance !== undefined && !(chance >= 0 && chance <= 1)) throw new Error(`--dodge must be a chance from 0 to 1`);
    const every = values["attack-every"] === undefined ? undefined : Number(values["attack-every"]);
    if (every !== undefined && !(every > 0)) throw new Error(`--attack-every must be a positive number of seconds`);
    return {
      ...scenario,
      options: { ...scenario.options, ...(seed !== undefined ? { seed } : {}), ...(chance !== undefined ? { dodge: { chance } } : {}) },
      ...(every !== undefined ? { enemyActions: [...(scenario.enemyActions ?? []), { kind: "attack" as const, every: every * FPS }] } : {}),
    };
  };
  // Loaded on first use, after the arguments and input files are checked (a mistake is reported without the load's wait).
  // --kit: what-if kit files in place of the operators' own (withKitFiles); worker threads load them too.
  setWorkerKitFiles(values.kit.map((f) => resolve(f)));
  let loaded: ReturnType<typeof loadGameData> | undefined;
  const data = () => (loaded ??= withKitFiles(loadGameData(), values.kit));
  /** The scenario with --duration (simulate, search): the fight's length in seconds. */
  const withDuration = (scenario: TimelineScenario): TimelineScenario => {
    if (values.duration === undefined) return scenario;
    const s = Number(values.duration);
    if (!(s > 0)) throw new Error("--duration must be a number of seconds > 0");
    return withSeconds(scenario, s);
  };
  let text: string;
  switch (command) {
    case "find":
      need(1);
      text = find(data(), args[0] as string);
      break;
    case "template":
      need(1);
      text = template(data(), args[0] as string, values.weapon);
      break;
    case "calc":
      need(1);
      {
        const build = readBuild(args[0] as string);
        text = calc(data(), build, options);
      }
      break;
    case "zmdlogs": {
      const [sub, arg, op] = args;
      if (sub === "list") {
        if (args.length !== 1) throw new Error("zmdlogs list takes no argument (--with <operator>, --dir <dir>, --json)");
        const dirs = logDirs(values.dir);
        text = formatLogList(data(), { withOperators: values.with, ...(dirs ? { dirs } : {}), json: values.json });
        break;
      }
      if (sub === "raw") {
        if (args.length !== 2 || !arg) throw new Error("zmdlogs raw takes one fixture file, fixture id or battle id (--buffs <regex>, --events <regex>)");
        const battleId = arg.endsWith(".json") ? readDevFixture(arg).provenance.battleId : battleIdOf(arg);
        const { detail, fetched } = await rawDetail(battleId);
        if (fetched) process.stderr.write(`fetched ${battleId} once from zmdlogs.com; cached in ${rawDir()}\n`);
        text = formatRaw(detail, { ...(values.buffs !== undefined ? { buffs: values.buffs } : {}), ...(values.events !== undefined ? { events: values.events } : {}) });
        break;
      }
      if (sub === "hits") {
        const named = args.slice(1);
        for (const f of named) refuseHoldoutFile(f);
        const files = named.length ? named : logFixtureFiles(ROOT, [LOG_DIRS.verified, LOG_DIRS.pending]);
        const workers = values.workers === undefined ? 1 : Number(values.workers);
        if (!(Number.isInteger(workers) && workers >= 1)) throw new Error("--workers must be a whole number ≥ 1");
        const lines: string[] = [];
        const filter = { ...(values.kind !== undefined ? { kind: values.kind } : {}), operators: values.operator, progress: (l: string) => process.stderr.write(l + "\n") };
        const out = (r: HitRecord) => lines.push(formatRecord(r, values.json));
        if (workers > 1) await exportHitsParallel(files, workers, out, filter);
        else exportHits(data(), files, readLogFixture, out, filter);
        text = lines.join("\n");
        break;
      }
      if (sub === "timing") {
        const start = performance.now();
        const sel = timingFixtures(args.slice(1));
        const reports = sel.files.map((f) => {
          process.stderr.write(`timing ${basename(f)}\n`);
          return fixtureTiming(data(), readLogFixture(f), { assumed: values.assumed, pairs: !values.singles });
        });
        text = formatTimingReport(data(), reports, { verbose: values.verbose, skipped: sel.skipped, seconds: (performance.now() - start) / 1000, ...(values.top !== undefined ? { top: Number(values.top) } : {}) });
        break;
      }
      if ((sub === "scales" || sub === "find-scales") && arg && op) {
        const fx = readDevFixture(arg);
        if (sub === "scales") {
          const lines: string[] = [];
          for (const r of impliedScales(data(), fx, op)) {
            const s = r.bySkillType;
            lines.push(`${r.event} t=${r.t}${r.unquantified.length ? ` [${r.unquantified.join(",")}]` : ""} crit=${r.crit} value=${r.value}` +
              ` basic=${s.basic.toFixed(4)} battle=${s.battle.toFixed(4)} combo=${s.combo.toFixed(4)} ultimate=${s.ultimate.toFixed(4)}`);
          }
          text = lines.join("\n");
        } else {
          const lines: string[] = [];
          for (const m of findScales(data(), fx, op)) {
            lines.push(`${m.event} (${m.hits} hits)`);
            for (const x of m.matches) lines.push(`   ${x.agree}/${m.hits}  ${x.skillId} ${x.keys.join(" * ")} ${x.damageType}${x.corrosion ? ` corrosion L${x.corrosion}` : ""}`);
          }
          text = lines.join("\n");
        }
        break;
      }
      if (args.length !== 2 || !arg || (sub !== "import" && sub !== "check" && sub !== "reactions" && sub !== "refresh")) throw new Error(`zmdlogs takes import <battle id>, check <file>, reactions <file>, refresh <file> --detail <file>, scales <file> <op> or find-scales <file> <op>\n\n${USAGE}`);
      if (sub === "refresh") {
        if (!values.detail) throw new Error("zmdlogs refresh needs --detail <file> (an already downloaded /api/battles/<id> response)");
        const r = refreshFixture(arg, values.detail, (d) => cacheRawDetail(readDevFixture(arg).provenance.battleId, d));
        text = `${arg}: ${r.casts} cast(s), ${r.poise} hit(s) with Stagger`;
      } else if (sub === "reactions") {
        const fx = readDevFixture(arg);
        text = formatReactionCheck(checkReactions(data(), fx));
      } else if (sub === "check") {
        const fx = readDevFixture(arg);
        if (values.simulate) {
          text = formatSimulatedLog(data(), fx, simulateLog(data(), fx));
          break;
        }
        const replay = values["log-buffs"] ? null : logBuffReplay(data(), fx);
        const byHit = replay ? engineHits(data(), fx, replay) : undefined;
        const verdicts = checkLog(data(), fx, replay ? { replay, ...(byHit ? { engineHits: byHit } : {}) } : { buffs: "log" });
        text = formatLogCheck(data(), fx, verdicts, replay ?? undefined, replay && byHit ? engineReport(data(), fx, replay, byHit, verdicts) : undefined);
      } else {
        const file = await importBattle(data(), arg, values["enemy-level"] === undefined ? undefined : Number(values["enemy-level"]), values.note, values.detail, (d) => cacheRawDetail(arg, d));
        text = `wrote ${file}`;
      }
      break;
    }
    case "simulate":
      need(1);
      {
        const seeded = withDuration(withBattleOptions(readScenario(args[0] as string)));
        const runs = values.runs === undefined ? undefined : Number(values.runs);
        if (runs !== undefined && !(Number.isInteger(runs) && runs >= 1)) throw new Error(`--runs must be a whole number ≥ 1`);
        const battles = values.battles === undefined ? undefined : Number(values.battles);
        if (battles !== undefined && !(Number.isInteger(battles) && battles >= 1)) throw new Error(`--battles must be a whole number ≥ 1`);
        text = runs === undefined ? formatSimulation(data(), seeded, values.verbose, battles) : formatRuns(data(), seeded, runs);
      }
      break;
    case "search":
      need(1);
      {
        const seeds = values.seeds === undefined ? undefined : Number(values.seeds);
        if (seeds !== undefined && !(Number.isInteger(seeds) && seeds >= 1)) throw new Error(`--seeds must be a whole number ≥ 1`);
        const percentile = values.percentile === undefined ? undefined : Number(values.percentile);
        if (percentile !== undefined && !(percentile >= 0 && percentile <= 100)) throw new Error(`--percentile must be 0–100`);
        const runs = values.runs === undefined ? undefined : Number(values.runs);
        if (runs !== undefined && !(Number.isInteger(runs) && runs >= 0)) throw new Error(`--runs must be a whole number ≥ 0`);
        const beam = Number(values.beam);
        if (!(Number.isInteger(beam) && beam >= 1)) throw new Error(`--beam must be a whole number ≥ 1`);
        const scenario = withDuration(withBattleOptions(readScenario(args[0] as string)));
        if (values.loop) {
          const loops = values.loops === undefined ? undefined : Number(values.loops);
          if (loops !== undefined && !(Number.isInteger(loops) && loops >= 1)) throw new Error(`--loops must be a whole number ≥ 1`);
          const rounds = values.rounds === undefined ? undefined : Number(values.rounds);
          if (rounds !== undefined && !(Number.isInteger(rounds) && rounds >= 4)) throw new Error(`--rounds must be a whole number ≥ 4`);
          text = loopCommand(data(), scenario, { beam, swaps: values.swaps, sync: values.sync, ...(values.out ? { out: values.out } : {}), ...(loops !== undefined ? { loops } : {}), ...(rounds !== undefined ? { rounds } : {}), progress: (line) => process.stderr.write(line + "\n") });
          break;
        }
        text = searchCommand(data(), scenario, {
          beam,
          single: values.single,
          swaps: values.swaps,
          ...(values.out ? { out: values.out } : {}),
          ...(seeds !== undefined ? { seeds } : {}),
          ...(percentile !== undefined ? { percentile } : {}),
          ...(runs !== undefined ? { runs } : {}),
          verbose: values.verbose,
          prune: values.prune,
          macros: values.macros,
          skeletons: values.skeletons,
          ...(values.setup !== undefined ? { setup: setupMode(values.setup) } : {}),
        });
      }
      break;
    case "rules":
      need(2);
      {
        const positive = (v: string | undefined, name: string, whole = false) => {
          if (v === undefined) return undefined;
          const x = Number(v);
          if (!(x > 0) || (whole && !Number.isInteger(x))) throw new Error(`--${name} must be a ${whole ? "whole " : ""}number > 0`);
          return x;
        };
        const reaction = values.reaction === undefined ? undefined : Number(values.reaction);
        if (reaction !== undefined && !(reaction >= 0)) throw new Error("--reaction must be a number of seconds ≥ 0");
        const penalty = values.penalty === undefined ? undefined : Number(values.penalty);
        if (penalty !== undefined && !(penalty >= 0)) throw new Error("--penalty must be ≥ 0");
        const opt = (k: string, v: number | undefined) => (v === undefined ? {} : { [k]: v });
        if (values.guided) {
          const count = (v: string | undefined, name: string, min: number) => {
            if (v === undefined) return undefined;
            const x = Number(v);
            if (!(Number.isInteger(x) && x >= min)) throw new Error(`--${name} must be a whole number ≥ ${min}`);
            return x;
          };
          const scenario = underAssume(withBattleOptions(readScenario(args[0] as string)), parseAssume(data(), values.assume));
          const team = scenario.team.map((b) => b.operator);
          const also = values.also ?? zeroCompanion(args[0] as string);
          const g = await guidedSearch(data(), scenario, readRuleList(args[1] as string), {
            ...opt("seconds", positive(values.duration, "duration")),
            ...opt("reaction", reaction),
            ...opt("screenSeeds", count(values["screen-seeds"], "screen-seeds", 2)),
            ...opt("confirmSeeds", count(values["confirm-seeds"], "confirm-seeds", 2)),
            ...opt("checkSeeds", count(values["check-seeds"], "check-seeds", 0)),
            ...opt("maxSeeds", count(values["max-seeds"], "max-seeds", 2)),
            ...(also ? { also: { scenario: underAssume(withBattleOptions(readScenario(also)), parseAssume(data(), values.assume)), label: also } } : {}),
            assumptions: values.assumptions,
            ...(values.out ? { out: values.out } : {}),
            ...opt("extend", count(values.extend, "extend", 1)),
            ...opt("rounds", count(values.rounds, "rounds", 1)),
            ...opt("candidates", count(values.edits, "edits", 1)),
            ...opt("random", count(values.random, "random", 0)),
            ...opt("penalty", penalty),
            ...opt("workers", count(values.workers, "workers", 1)),
            progress: (line) => process.stderr.write(line + "\n"),
          });
          text = formatGuided(data(), g, `Guided rule search: ${team.map((op) => data().operators[op]?.name ?? op).join(", ")}`, args[1] as string);
          if (values.out) {
            writeGuided(g, values.out, args[1] as string);
            text += `\n\nWrote ${values.out} (the final list).`;
          }
          break;
        }
        text = await rulesCommand(data(), underAssume(withBattleOptions(readScenario(args[0] as string)), parseAssume(data(), values.assume)), readRuleList(args[1] as string), args[1] as string, {
          ...opt("seconds", positive(values.duration, "duration")),
          ...opt("reactionSeconds", reaction),
          ...opt("seeds", positive(values.seeds, "seeds", true)),
          search: values.search,
          ...opt("iterations", positive(values.iterations, "iterations", true)),
          ...opt("searchSeconds", positive(values["search-seconds"], "search-seconds")),
          ...opt("searchSeeds", positive(values["search-seeds"], "search-seeds", true)),
          ...opt("penalty", penalty),
          ...opt("front", positive(values.front, "front", true)),
          ...(values.out ? { out: values.out } : {}),
          ...(values.compare ? { compare: { list: readRuleList(values.compare), file: values.compare } } : {}),
          ...(values.fresh !== undefined ? { fresh: Number(values.fresh) } : {}),
          ...opt("firstSeed", positive(values["first-seed"], "first-seed", true)),
          ...opt("workers", positive(values.workers, "workers", true)),
          assumptions: values.assumptions,
          progress: (line) => process.stderr.write(line + "\n"),
        });
      }
      break;
    case "diagnose":
      need(2);
      {
        const count = (v: string | undefined, name: string, min: number) => {
          if (v === undefined) return undefined;
          const x = Number(v);
          if (!(Number.isInteger(x) && x >= min)) throw new Error(`--${name} must be a whole number ≥ ${min}`);
          return x;
        };
        const reaction = values.reaction === undefined ? undefined : Number(values.reaction);
        if (reaction !== undefined && !(reaction >= 0)) throw new Error("--reaction must be a number of seconds ≥ 0");
        const seconds = values.duration === undefined ? undefined : Number(values.duration);
        if (seconds !== undefined && !(seconds > 0)) throw new Error("--duration must be > 0");
        const scenario = underAssume(readScenario(args[0] as string), parseAssume(data(), values.assume));
        const team = scenario.team.map((b) => b.operator);
        const ops = values.operator.map((x) => {
          const id = team.find((op) => op === x || data().operators[op]?.name.toLowerCase() === x.toLowerCase());
          if (!id) throw new Error(`--operator ${x}: not in the scenario's team`);
          return id;
        });
        const opt = (k: string, v: number | undefined) => (v === undefined ? {} : { [k]: v });
        const d = await diagnose(data(), scenario, readRuleList(args[1] as string), {
          ...opt("seconds", seconds),
          ...opt("reaction", reaction),
          ...opt("seeds", count(values.seeds, "seeds", 1)),
          ...opt("marginalSeeds", count(values["marginal-seeds"], "marginal-seeds", 0)),
          ...opt("workers", count(values.workers, "workers", 1)),
          ...(ops.length ? { operators: ops } : {}),
          assumptions: values.assumptions,
          progress: (line) => process.stderr.write(line + "\n"),
        });
        text = values.json ? JSON.stringify(d, null, 2) : formatDiagnosis(data(), d, `Diagnosis of ${args[1]} on ${args[0]}: ${team.map((op) => data().operators[op]?.name ?? op).join(", ")}`);
      }
      break;
    case "payoffs":
      need(1);
      {
        const depth = values.depth === undefined ? undefined : Number(values.depth);
        if (depth !== undefined && !(Number.isInteger(depth) && depth >= 2)) throw new Error(`--depth must be a whole number ≥ 2`);
        const run = runPayoffs(data(), readScenario(args[0] as string), depth !== undefined ? { depth } : {});
        text = values.json ? JSON.stringify(run, (_k, v: unknown) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v), 2) : formatPayoffs(data(), run, values.top === undefined ? 15 : Number(values.top));
      }
      break;
    case "gear":
      need(1);
      {
        const whole = (v: string | undefined, name: string, min: number) => {
          if (v === undefined) return undefined;
          const n = Number(v);
          if (!(Number.isInteger(n) && n >= min)) throw new Error(`--${name} must be a whole number ≥ ${min}`);
          return n;
        };
        const scenario = readScenario(args[0] as string);
        const extra = values.candidates ? (JSON.parse(readFileSync(values.candidates, "utf8")) as GearCandidatesFile) : undefined;
        if (extra && !Array.isArray(extra.candidates)) throw new Error(`${values.candidates}: a candidates file has "candidates": [{ "operator", "gear", "source" }]`);
        const keep = new Set(values.keep);
        for (const k of keep) if (!scenario.team.some((b) => b.operator === k)) throw new Error(`--keep ${k}: not in the scenario's team`);
        const minCount = whole(values["min-count"], "min-count", 1);
        const top = whole(values.top, "top", 0);
        const candidates = gearCandidates(data(), scenario, { files: logFixtureFiles(ROOT), ...(extra ? { extra } : {}), ...(minCount !== undefined ? { minCount } : {}), ...(top !== undefined ? { top } : {}) });
        const beam = whole(values["search-beam"], "search-beam", 1);
        const passes = whole(values.passes, "passes", 1);
        const repairs = whole(values.repairs, "repairs", 0);
        if (values.rules) {
          const reaction = values.reaction === undefined ? undefined : Number(values.reaction);
          if (reaction !== undefined && !(reaction >= 0)) throw new Error("--reaction must be a number of seconds ≥ 0");
          const seconds = values.duration === undefined ? undefined : Number(values.duration);
          if (seconds !== undefined && !(seconds > 0)) throw new Error("--duration must be > 0");
          const opt = (k: string, v: number | undefined) => (v === undefined ? {} : { [k]: v });
          const also = values.also ?? zeroCompanion(args[0] as string);
          const assume = parseAssume(data(), values.assume);
          const rg = await gearOnRules(data(), underAssume(scenario, assume), readRuleList(values.rules), candidates, {
            keep,
            ...(also ? { also: { scenario: underAssume(readScenario(also), assume), label: also } } : {}),
            assumptions: values.assumptions,
            ...opt("seconds", seconds),
            ...opt("reaction", reaction),
            ...opt("seeds", whole(values.seeds, "seeds", 2)),
            ...opt("marginalSeeds", whole(values["marginal-seeds"], "marginal-seeds", 0)),
            ...opt("workers", whole(values.workers, "workers", 1)),
            ...opt("passes", passes),
            ...opt("generated", whole(values.generated, "generated", 0)),
            ...opt("sets", whole(values.sets, "sets", 0)),
            ...(values.operator.length ? { operators: values.operator.map((x) => {
              const id = scenario.team.map((b) => b.operator).find((op) => op === x || data().operators[op]?.name.toLowerCase() === x.toLowerCase());
              if (!id) throw new Error(`--operator ${x}: not in the scenario's team`);
              return id;
            }) } : {}),
            progress: (line) => process.stderr.write(line + "\n"),
          });
          text = formatRuleGear(data(), rg, `efsim gear --rules ${values.rules} on ${args[0]}`);
          if (values.out) {
            // The timeline rotation only if the chosen gear still plays it (a loadout that moves ultimates may not); else none.
            let plays = true;
            try {
              simulateScenario(data(), { ...scenario, team: [...rg.team] });
            } catch (e) {
              if (!(e instanceof EngineError)) throw e;
              plays = false;
            }
            writeGearScenario(args[0] as string, values.out, rg.team, plays ? undefined : []);
            text += `\n\nWrote ${values.out} (the chosen gear; ${plays ? "the timeline rotation as it was, which it still plays" : "no timeline rotation: the old one can't be played with this gear"}; the rules are the rotation here).`;
          }
          break;
        }
        const r = gearAscent(data(), scenario, candidates, { keep, ...(beam !== undefined ? { beam } : {}), ...(repairs !== undefined ? { repairs } : {}), ...(passes !== undefined ? { passes } : {}), progress: (line) => process.stderr.write(line + "\n") });
        text = formatGear(data(), scenario, r);
        if (values.out) {
          writeGearScenario(args[0] as string, values.out, r.team, r.rotationReplaced || r.rotationRepaired ? r.rotation : undefined);
          text += `\n\nWrote ${values.out} (the chosen gear, ${r.rotationReplaced ? "the narrow search's rotation" : r.rotationRepaired ? `the rotation with the ${r.rotationRepaired} step${r.rotationRepaired === 1 ? "" : "s"} it couldn't play moved or dropped` : "the rotation as it was"}).`;
        }
      }
      break;
    case "gamedata": {
      const [sub, id] = args;
      if (args.length !== 2 || !id || (sub !== "tree" && sub !== "who")) throw new Error(`gamedata takes tree <id> or who <id>\n\n${USAGE}`);
      if (sub === "who") text = formatMentions(id, whoMentions(id));
      else {
        const depth = values.depth === undefined ? undefined : Number(values.depth);
        if (depth !== undefined && !(Number.isInteger(depth) && depth >= 0)) throw new Error("--depth must be a whole number ≥ 0");
        text = gamedataTree(id, { ...(values.grep !== undefined ? { grep: values.grep } : {}), ...(depth !== undefined ? { depth } : {}) });
      }
      break;
    }
    case "kit-census":
      text = formatCensus(kitCensus());
      break;
    case "cache":
      text = cacheCommand(args[0]);
      break;
    case "kit-trim":
      text = formatTrim(kitTrim(data(), values.write), values.write);
      break;
    case "kit-draft": {
      need(1);
      const op = args[0] as string;
      const logged = new Map<string, number>();
      for (const f of readdirSync(join(ROOT, "fixtures")).filter((x) => x.startsWith("zmdlogs-"))) {
        for (const h of readLogFixture(join(ROOT, "fixtures", f)).hits) if (h.operator === op) logged.set(h.event, (logged.get(h.event) ?? 0) + 1);
      }
      text = kitDraft(data(), op, logged);
      break;
    }
    case "compare":
      need(2);
      {
        const builds = [readBuild(args[0] as string), readBuild(args[1] as string)] as const;
        text = compare(data(), builds[0], builds[1], options, [basename(args[0] as string), basename(args[1] as string)]);
      }
      break;
    case "edge":
      need(2);
      {
        const build = readBuild(args[0] as string);
        const pool = JSON.parse(readFileSync(args[1] as string, "utf8")) as EdgePool;
        if (!Array.isArray(pool.gear)) throw new Error(`${args[1]}: a pool has "gear": [{ "id", "artifice" }] (and optional "weapons")`);
        text = knifeEdge(data(), build, pool, values.top === undefined ? 5 : Number(values.top));
      }
      break;
    default:
      throw new Error(`unknown command ${command}\n\n${USAGE}`);
  }
  process.stdout.write(text + "\n");
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`efsim: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);

/** A scenario file with its team's gear replaced (efsim gear --out): everything else as it was. */
function writeGearScenario(from: string, to: string, team: readonly { readonly operator: string; readonly gear: readonly unknown[] }[], rotation?: TimelineScenario["rotation"]): void {
  const doc = JSON.parse(readFileSync(from, "utf8")) as { team: ({ operator: string; gear: unknown[] } | string)[]; rotation: unknown[] };
  if (rotation) doc.rotation = rotation.map((a) => ({ operator: a.operator, skill: a.skill, ...(a.at !== undefined ? { at: a.at / FPS } : {}) }));
  doc.team = doc.team.map((t) => {
    if (typeof t === "string") throw new Error(`${from}: --out needs the team's builds inline, not as files`);
    const b = team.find((x) => x.operator === t.operator);
    return b ? { ...t, gear: [...b.gear] } : t;
  });
  writeFileSync(to, JSON.stringify(doc, null, 2) + "\n");
}

/** efsim cache [clear]: the compiled game-data cache (packages/data cache.ts). */
function cacheCommand(sub: string | undefined): string {
  const dir = cacheDir();
  if (sub === "clear") {
    const n = clearGameDataCache(dir);
    return `Removed ${n} file${n === 1 ? "" : "s"} from ${dir}.`;
  }
  if (sub !== undefined) throw new Error(`efsim cache takes no argument, or "clear"`);
  let key: string;
  try {
    key = gameDataCacheKey();
  } catch (e) {
    key = `(none: ${e instanceof Error ? e.message : String(e)})`;
  }
  const entries = listGameDataCache(dir);
  const cached = entries.some((e) => basename(e.file) === `gamedata-${key}.v8`);
  return [
    `Game-data cache: ${dir}${cacheDisabled() ? " (off: EFSIM_NO_CACHE)" : ""}`,
    `The current inputs' key: ${key} (${cached ? "cached" : "not cached: the next load builds it"})`,
    ...entries.map((e) => `  ${basename(e.file)}  ${(e.bytes / 1e6).toFixed(1)} MB  used ${e.used.toISOString()}`),
  ].join("\n");
}

/** --setup's mode. */
function setupMode(v: string): "score" | "share" {
  if (v !== "score" && v !== "share") throw new Error(`--setup must be score or share`);
  return v;
}
