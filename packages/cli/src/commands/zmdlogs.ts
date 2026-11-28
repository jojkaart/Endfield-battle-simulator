// efsim zmdlogs: the log tooling (list, per-hit numbers, raw details, import, the check, buff timing, reactions,
// refresh, scales).

// The logic is @efsim/logs' (reports.ts and the modules it calls); this module checks the arguments and calls it.

import {
  kitBuffKey,
  castsJson,
  eventLagsView,
  stackView,
  followUpsView,
  holdsSteps,
  awayView,
  battleIdOf,
  buffsView,
  burstsView,
  CLOCK_KINDS,
  clocksView,
  droppedView,
  type ClockKind,
  placementView,
  cacheRawDetail,
  cadenceView,
  census,
  decisionsView,
  whyKeptView,
  clockView,
  endsView,
  controlView,
  devFixtures,
  instancesView,
  lanesView,
  worldTimeView,
  worldClockLines,
  seriesClockView,
  replayTimeStops,
  logBuffReplay,
  placeHits,
  holdsView,
  rampView,
  parseSelector,
  checkReactions,
  castsReport,
  checkReport,
  differencesCliReport,
  findScalesReport,
  fitBuildReport,
  formatRaw,
  formatReactionCheck,
  groupsCliReport,
  assumedCliReport,
  boundariesCliReport,
  hitsReport,
  importBattle,
  offsetsReport,
  operatorNamed,
  rawDetail,
  rawDir,
  readDevFixture,
  refreshFromDetail,
  replayReport,
  statusesView,
  scalesReport,
  staggerReport,
  stopsView,
  timingReport,
  totalsAllReport,
  totalsView,
} from "@efsim/logs";
import { readFileSync } from "node:fs";
import { withCurveReading } from "@efsim/engine";
import { parseAssume } from "../assume.ts";
import { command } from "../command.ts";
import { formatLogList, logDirs } from "../logtools.ts";

/**
 * The subcommands that replay the kits (logBuffReplay), so `--assume <id>=<reading>` changes what they show; every one
 * takes it (holds-and-placement report point 2: holds, ramp, bursts, stops and differences didn't, and each needed a
 * code edit the moment after a measure). The others read the log or the placement only and refuse it. A new
 * subcommand goes in one of the two (tests/zmdlogs-cli.test.ts checks every subcommand of the usage is in one).
 */
export const REPLAYING = new Set(["hits", "check", "timing", "bursts", "statuses", "fit-build", "offsets", "replay", "decisions", "stops", "totals", "stagger", "differences", "groups", "assumed", "boundaries", "clock", "holds", "ramp", "clocks", "worldtime", "away", "stack", "followups"]);
export const NOT_REPLAYING = new Set(["list", "raw", "import", "refresh", "reactions", "placement", "scales", "find-scales", "casts", "instances", "census", "buffs", "lanes", "ends", "control", "cadence"]);

export default command({
  name: "zmdlogs",
  usage: `  efsim zmdlogs list                      The development logs (never a hold-out): file, team with potentials,
                                          enemy, hits, casts, length; the safe start of any scan over the logs
                [--with <operator>]       Only logs whose team has it (id or part of the name; repeatable: all of them)
                [--dir <dir>] [--json]    Only verified, pending or multi (repeatable); everything as JSON
                [--ids]                   Each operator's id and weapon name too (efsim find <name> for one)
  efsim zmdlogs hits <fixture…|--all>     The log check's numbers per logged hit, one line each (fixtures: paths or
                                          ids such as 0c14; --all every verified and pending development log; never
                                          a hold-out): logged value, verdict and class, the engine's primary reading
                                          and its error; with --json a JSON line with its scale parts, zones,
                                          modifiers, the log's reading (logReading: every kit buff as the log lists
                                          it), the landing's operator and, for kit hits, the enemy's statuses
                                          (applier, level, Arts Intensity). Cached per fixture and code in
                                          scratch/hits-cache/ (--no-cache: neither read nor write it)
                [--kind <k>] [--operator <op>]  Only this reaction kind ("skill": kit hits) / operator (id or name;
                                          repeatable)
                [--event <regex>]         Only hits whose logged event key matches
                [--from s] [--to s]       Only hits logged in this window (seconds, both ends included)
                [--assume <id>=<reading>] Under another reading of an open assumption, as check's (not cached)
                [--against <id>=<reading>] Instead: only the hits whose class or primary reading that reading (on top
                                          of --assume) changes, both sides and the modifiers only one has, then a
                                          count per change (measure --hits for these logs, no lock; repeatable)
                [--fixtures-from <file>]  Also the fixtures listed in a file, one per line (# comments)
                [--layers <owner:id>]     Instead: a layered kit buff per hit, the log's entries of its game buff
                                          (their lane starts), the replay's layers (its modifiers in the primary
                                          reading) and the layers the logged value implies, then by the log's count
                [--targets]               Instead: per fight read per target, how many replays it took and the hits
                                          whose check target, the replay's own (the assignment it was made on: ≠
                                          replay) and the landing's (≠ landing) disagree
                [--same-listing s]        Instead (one fixture): the hit at that moment and the nearest hits with the
                                          very same listing (buff, source, value), with their verdicts and a count by
                                          class: a listing difference that reads plain next door is no cause
                                          (--operator, --event, --kind pick the hit at the moment)
                [--against-hit s]         Instead (one fixture): each hit's zones, crit and modifiers as the
                                          difference from the hit at that moment (a plain neighbour: what one
                                          modifier the off hit has otherwise); --operator / --event pick it there
                [--listed <regex>]        Only hits listing a matching buff (effects or boundary); text lines end with
                                          those entries' sources, sinces and values (--all --event: one hit key's
                                          listings across logs)
                [--reading log]           Text lines also give the log's reading and its error: off under both is the
                                          build or a kit value, off only under the primary the replay's timing
                [--zones]                 Text lines also give the primary reading's zones, the replay's crit and
                                          its source (log, shown, layers, values, none) and the modifiers; with
                                          scripts/cli-ab.ts <ref> --key '^(\\S+  t=\\d+  \\S+  \\S+)' which zone moved
                [--json] [--workers n]    JSON Lines; fixtures on n worker threads (default 1). With --operator only
                                          the logs whose team has one are read (an uncached --all takes ~8 s a log)
  efsim zmdlogs raw <fixture | id>        A battle's raw detail as ZMDLogs recorded it: buff lanes (key, target,
                                          source, start–end, effects) and events (key, value, the skill a Stagger is
                                          credited to). A lane's end is a logged event's time near its last listed
                                          hit, not the buff's expiry (zmdlogs lanes brackets it). From the
                                          git-ignored cache (filled by import and refresh), else fetched once; never
                                          a hold-out
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
                [--assume <id>=<reading>] Replay under another reading of a kit's or the engine's open assumption
                                          (e.g. control-immunity=bosses; repeatable; scripts/measure.ts --assume for
                                          every log)
  efsim zmdlogs timing [fixture…]         Buff timing report (a diagnostic, never scored): which kit buff's
                                          window, shifted, fits the hits the check doesn't (fallback, mismatch),
                                          as patterns across logs with mechanism candidates (default: every
                                          development log; hold-out logs are skipped)
                [--assumed]               Assumed matches too
                [--singles]               No pairs of toggles
                [--top n] [--verbose]     Patterns shown (default 20); every run, and each hit's best fit
  efsim zmdlogs reactions <fixture.json>  Replay the kits' inflictions; compare bursts and reactions
  efsim zmdlogs clocks <fixture…|--all>   How late each clock of known pace runs across the time stops inside it
                                          (clocksview.ts): enemy tick chains, a cast's landings against its kit
                                          frames, bursts against their delay; per clock kind and what holds it (no
                                          stop, combos only, an ultimate, other stops), the ticks also in and out of the
                                          log's Stagger: rows, residual and held medians, Σ residual ÷ Σ held
                [--clock tick,cast,burst] The clocks (default tick,cast; burst replays each log)
                [--by operator] [--rows]  Also per combo operator (rows with one operator's combos only); each row
  efsim zmdlogs placement <fixture…|--all> What the placement's passes leave: ultimates whose time stops still
                                          overlap after the in-turn rule, and the casts a third pass would move
                                          (the placement isn't a fixed point there: logcasts.ts placeHits)
                [--choices]               Under each overlap, what the in-turn rule decided for both casts and the
                                          checks of the start it tried (Placement.inTurn)
  efsim zmdlogs statuses <fixture>        The replay's status record: each burst, reaction, consumption, physical
                                          status and Combustion tick with its operator, its target (in a fight
                                          read per target), its damage and the target's statuses after it; the
                                          replay's deaths between
                [--target n] [--operator <op>] [--from s] [--to s]  Only these targets (repeatable), operators, window
                [--inflictions]           Also each target's infliction (element×stacks) where a frame of kit
                                          landings changed it, with those landings (a stack's arrival)
  efsim zmdlogs statuses --controls <fixture…|--all>  Each control status the replay applied, whether it froze the
                                          enemy and to when (none on a control-immune one), every target's statuses
                                          at it, a count per fight: is there a freeze in these fights? (--all: a
                                          replay per log, minutes: in the background)
  efsim zmdlogs bursts <fixture…|--all>   Each Arts Burst, logged against the check's replay (paired as the check
                                          pairs them, the offset; log only with the reason; replay only), each
                                          side's likely cause (the operator's latest inflicting hit at least the
                                          burst delay of world time before) and the time stops between; counts per
                                          operator (--all: every verified and pending development log)
                [--operator <op>] [--from s] [--to s]  Only these operators' bursts; this window
  efsim zmdlogs refresh <fixture.json>    Add what the battle's detail records that an older import lacks
                                          (casts without damage, each hit's Stagger and its credited skill,
                                          buff effects' giver and start): from the raw cache, else fetched
                                          once; writes nothing when the detail's hits differ from the fixture's
                [--detail file]           Use an already downloaded /api/battles/<id> response
  efsim zmdlogs fit-build <fixture> --operator <op>  The build inputs the export omits or may have wrong, fitted:
                                          every attribute-node count, weapon level and food (or none) scored by the
                                          operator's clean hits (log and replay agree) within ±1; the evidence for a
                                          fixture's buildOverrides
                [--top n] [--no-foods]    Candidates shown (default 8); without trying foods
                [--pairs]                 Also the wider space as single changes and pairs (potential, weapon skill
                                          levels, levels, gear swaps within the worn set, nodes) whose ATK gives
                                          the offset, with how many do: one constant, many explanations?
  efsim zmdlogs offsets <fixture…|--all>  The build-offset screen: per log and operator, the median of logged ÷ the
                                          primary reading over non-crit kit hits and the share within 1% of it; a
                                          tight median off by 0.3% and 2 damage or more (*) is one factor all fight
                                          (a food, a node, a weapon level; the check's ±1 makes it cost every hit):
                                          fit-build's next candidate (tests/slow/ fails on one nothing accounts
                                          for), candidates by mismatches. From scratch/hits-cache/ as hits
                [--operator <op>] [--top n] [--workers n] [--no-cache]  Only these operators; rows (default 25, 0
                                          every one)
                [--bound]                 Also per operator and event the factor interval that puts every clean
                                          hit within ±1 (empty: no one factor; the factor fitting most)
  efsim zmdlogs scales <fixture> <op>     Multiplier each logged hit of an operator implies
  efsim zmdlogs find-scales <fixture> <op> Skill values (keys) that explain each logged event
  efsim zmdlogs casts <fixture>           The placement in time order: each logged hit with the cast, slot and
                                          frame it was placed at, the log's cast events, the placed casts and their
                                          time stops
                [--choices]               On each CAST line, the rule that chose its skill among those sharing its
                                          key (logcasts.ts choose: anchor, alike, window, restart, first, late);
                                          on a HIT that joined its cast over 1 s past its slot's frame, the join's
                                          rule and times (span, to come, paced, same ultimate, delayed, reach);
                                          on a HIT that is another target's landing of its slot, the twin rule
                                          (value, used; several targets: batch with its targets per landing,
                                          later); REALIGN lines: what the realignment by value did with a cast's key
                [--json]                  Instead: a JSON line per line (castsRecords: kind, t, operator, skill,
                                          key, rule, the hit's cast and slot, its join, the text)
                [--from s] [--to s]       Only this window (seconds); --operator: only these operators' hits, casts
  efsim zmdlogs casts --event-lags <fixture…|--all>  Each operator's logged cast events against their casts' placed
                                          starts, per skill kind: n, median, 10–90%, min–max of the lag (log time;
                                          the median in world time too): a press's log time against a kit frame is
                                          off by this before anything is wrong (--operator op, --verbose each cast)
  efsim zmdlogs replay <fixture>          The replay in time order: its landings with the logged hit each stands for
                                          (or "replay only"), logged hits without a landing and why, casts it
                                          couldn't make or made without the log, its Stagger windows
                [--kit-buff owner:id[@op]] Also a kit buff's windows at an operator (default its owner; repeatable),
                                          each saying which window it refreshes (the log keeps a refreshed run's since)
                [--against-lanes]         With --kit-buff: at the end, each logged run's since beside the replay's
                                          nearest window start (chains only) and the offset, unpaired ones on each
                                          side, the median offset: a kit trigger fix's check
                [--trace-buff owner:id]   Each change of a kit buff's expiry and the step that made it (a cast, a
                                          pause or stop, the log's Stagger steps; repeatable)
                [--trace-buff status:<s>] The same for an enemy status (corrosion, electrification, vulnerable, a
                                          physical status, infliction: its element and stacks by appliers;
                                          status:* every one), keyed by status and applier (a moved
                                          application is a hold), with the log's runs of it (LANE)
                [--trace-trigger owner:id] Each firing of a kit trigger (owner:id, or the id alone for any owner:
                                          suit_phy01.proc), its ready frame, and each shift of it with the step
                                          that made it (a stop, a hidden hold: a world clock's cooldown); repeatable
                [--trace-stack owner:stack] Each change of a kit stack's value (efsim kit <operator> lists its
                                          stacks: a bank, a counter) and the step that made it; repeatable
                [--stops]                 The slow-downs the replay's timeline applied (STOP), against the stop list
                                          the log tools build for its casts: where they differ, the list isn't the
                                          engine's
                [--assume <id>=<reading>] Under another reading of an open assumption, as check's
                [--from s] [--to s]       Only this window; --operator: only these operators
  efsim zmdlogs decisions <fixture…|--all> --assume <id>=<reading>  The replay's decisions (SKIP, TAILCUT, FAILED,
                                          MISSED, INFER, MADE, PATH, JUMPDROP, BOTHPATHS, BATCH, FORCED, INSIDE, CUTS, as replay prints
                                          them) that differ between the default readings (-) and the given one (+), per log,
                                          then a count per kind: a replay rule's false positives before a measure
                                          (two replays per log, seconds each); without --assume every decision;
                                          --operator: only these operators'; --all takes about 3 min, past the
                                          2-minute foreground limit: run it in the background, output to a file
                [--why-kept]              Instead (one fixture): per TAILKEPT line, the replay with that tail cut and
                                          the logged hits whose landing, class or primary reading moved, a count per
                                          class change: what the kept tail stands for (one check per kept tail)
  efsim zmdlogs stops <fixture…|--all>    replay --stops' STOP lines over several logs (default: every verified and
                                          pending development log with --all), then a count per kind (as listed,
                                          covered, length, timeline only, list only) and how many logs have each
                [--differ] [--operator <op>]  Only the lines that differ (not as listed, not covered); these operators
  efsim zmdlogs totals <fixture>          The simulated total's parts per operator: the landings standing for
                                          logged hits (predicted vs logged), the replay-only landings (largest
                                          first) and the logged hits without a counted landing: which side moved a
                                          total (with scripts/cli-ab.ts: between two commits)
                [--operator <op>] [--top n] [--assume <id>=<reading>]  Only these operators; landings listed
                                          (default 10)
                [--by event]              Instead: the parts per operator and logged event (matched, replay-only
                                          by skill and hit, log-only), largest |share| first
                [--by crit]               Instead: the matched parts per operator by how the totals took each crit
                                          (known, exact, read from the value, expected crits): the model or the dice?
                [--kinds]                 Instead: every replay-only landing and log-only hit, largest first, with
                                          its kind (onesided.ts: where it sits, nature, skill kind, flags) and twin
  efsim zmdlogs totals --all | <fixture…>  Every fight's total error split into matched / replay-only / log-only
                                          shares of its logged total, largest |error| first, with the operators
                                          carrying it and each group's means (hold-outs: measure's summary only)
                [--workers n] [--operator <op>] [--top n] [--no-cache]  Threads; only fights with these operators;
                                          operators per row (default 3); recompute what scratch/hits-cache holds
                [--kinds]                 Instead: the one-sided landings ranked by kind (where they sit, nature,
                                          skill kind) per group, then by operator and key (hold-outs: measure's
                                          summary, by kind only)
                [--json]                  Instead: every one-sided landing, a JSON line each (fight, group, side,
                                          operator, t, damage, key, skill, nature, context, flags, twin; share: %
                                          of the fight's logged total; logged, fightError, stage, severalTargets:
                                          the fight's), cached with the shares: a new ranking question is a jq
                                          line, not a replay of every log
                [--skip <id|stage|several>,…]  Leave these fights out of the table, --kinds and --json: short ids,
                                          every stage fight, every fight against several targets under one id
  efsim zmdlogs stagger [fixture…]        Each logged Stagger run (first to last Staggered hit) against the replay's
                                          windows and where the engine's own would have ended; with several logs
                                          (default: every development log) a summary of the shortfalls
  efsim zmdlogs differences <fixture…|--all>  Where the log's listing and the replay disagree (a kit buff,
                                          Stagger), grouped, with the logged value ÷ the engine's reading per group:
                                          does the damage side with the log or the replay?
                [--what <regex>] [--hits] Only differences about this; each hit too. --operator, --event, --workers n,
                                          --fixtures-from, --no-cache as hits
                [--clusters]              Each group's ratios in clusters (×1.023 n=26, ×1.085 n=21, …): equal steps
                                          are a layered buff the log lists once (with --operator: one operator's)
  efsim zmdlogs groups --operator <op> [fixture…]  An operator's mismatches sorted into causes: team-wide (a
                                          teammate mismatches at the same ratio nearby), no landing, own by skill
                                          event and by what the log and replay disagree on (default: every
                                          development log with it; --verbose each mismatch; --workers n); and
                                          the casts whose every landing matched only as the event's other kit hit
  efsim zmdlogs assumed --operator <op> [fixture…]  What the operator's non-plain matches assume (the verdict's
                                          first fitting reading): by kind, kind set, event and kind, folded label
                                          (default: every development log with it; cached as hits; --workers n)
                [--kind <set>]            The hits of one kind set (crit, boundary+logListing, …); --top n rows
  efsim zmdlogs boundaries <fixture…|--all>  Kit buffs listed at a hit's boundary (the log can't say whether they
                                          applied): per kit buff and side (the run's start or its end), how many
                                          hits read with it, without it, both, neither: a boundary rule's base rate
                                          before a measure (cached as hits; --operator: their hits; --workers n)
                [--kit-buff <regex>]      Only the kit buffs (owner:id) matching
The log itself (query.ts; no replay of buffs; every view takes ids such as 0c14 and operators by name):
  efsim zmdlogs instances <fixture>       Every real cast as the log means it (loggedSkillInstances): placed from its
                                          hits (combos log no cast event), with the log's cast events of it (an
                                          ultimate's repeat every ~3.5 s), or a cast event alone with no hit of it
                                          (Si's periodic battle-button events); --operator, --kind <k>
  efsim zmdlogs census [fixture…] --select <sel>  How many items a selection picks per log (default: every
                                          verified and pending development log); the output's first lines record the
                                          selection and the command that reruns it: cite them with a claim.
                                          <sel>: cast:<regex> (skill instances), event:<regex> (hit groups of a logged
                                          event key, a gap over 1 s starts one), buff:<regex> (runs of a listed buff),
                                          origin:<regex> (hit groups whose Stagger the log credits to a matching
                                          skill: poise.origin, imports since 2026-11-16)
                [--operator <op>]         Only these operators' items (repeatable)
                [--near <sel>] [--near-operator <op>]  Also whether an item of this selection is near each item…
                [--within ms | --window from,to]  …within ±ms (default 1000), or from..to ms relative to it (0,700:
                                          only after)
                [--list]                  Each item with its nearest near item
                [--fixtures-from <file>] [--dir multi]  Logs listed in a file; the multi-target logs instead
  efsim zmdlogs buffs [fixture…]          Every listed game buff over the logs (default: every verified and pending
                                          development log) with the team kit buffs it stands for (gameBuff, loggedAs,
                                          affixes; or an engine status; or none), its sources, whose hits list it
                                          ("only on its source's own hits": a weapon's team buff), values
                [--buff <regex>] [--operator <op>]  Only buffs matching; only buffs from or of these operators
  efsim zmdlogs lanes <fixture> [--buff <regex>]  Each run of a listed buff (one per source and since): since,
                                          first and last listed hit, the next hit of its hitters that doesn't list
                                          it, values (since is the lane's start as logged: a refresh may move it)
                [--world]                 Each run's length in world time too (the stops of the replay's casts
                                          taken out: placed, from cast events, inferred)
                                          Beside each end: the log's moment spacing there and the cast events
                                          within it (an end within one grain of an event has no order)
  efsim zmdlogs ends <fixture>            Per logged moment, the runs of the listed buffs that end there together
                                          (a debuff's affixes once), how many of that side's runs go on across it
                                          ("all": a purge's shape; PURGE: loggedPurges' reading) and the moment
                                          spacing: did a buff end alone or with everything else?
                [--min n] [--side enemy|team]  Moments where at least n runs end (default 2); one side only
                [--at s]                  Instead: that moment's runs ending (each with its next unlisted moment),
                                          going on and starting, and the cast events within its grain
                [--from s] [--to s] [--operator <op>]  This window; runs from these sources only
  efsim zmdlogs stack <owner:stack> <fixture…|--all>  A kit stack's value at each cast the replay made (its
                                          owner's): before the cast's frame → just before the owner's next cast,
                                          with the changes between and their steps; then a count per skill and
                                          value before (--all: every development log with the owner)
                [--at-cast <regex>]       Instead: the casts whose made skill matches, any operator's (the casts
                                          that read or spend it: a combo's conversion)
  efsim zmdlogs followups <fixture…|--all> --operator <op>  An operator's kit triggers' own landings (an entity's
                                          follow-ups, harasses, lasers) against the events that fired them: each
                                          landing's delay after its event, the logged hit it stands for (Δ) and
                                          the log's delay after the event's logged hit; the triggers' log-only
                                          hits with the nearest replay-only landing; per trigger the counts and
                                          medians (--all: every development log with the operator; --kit, --assume)
                [--trigger <regex>]       Only the triggers whose id matches
  efsim zmdlogs away <fixture…|--all>     Per away stretch (no logged hit for 6 s or more): the hold placement's
                                          clocks listed on both sides of it (team and enemy) with their asks, the
                                          hold placed inside it, each operator's basic step across it, and a
                                          verdict (pause: the clocks ask half its length or more; runs on: about
                                          nothing); a count over the logs (--assume: under another reading)
  efsim zmdlogs worldtime <fixture> <from s> <to s>  The world's time between two log moments under the time
                                          stops of the replay's casts (placed, from cast events, inferred), and the
                                          stops between (operator, skill, frames, lowest scale): the hold
                                          placement's own list, so an event the replay read as a buff's tick is a
                                          line without frames (--assume: under another reading)
                [--holds] [--without <op>] Also the world with the hidden holds out on top (the engine adds them to
                                          any stop) and with an operator's own stops left in (they don't hold her
                                          clock), per stop source: the list and the timeline's applied slow-downs
  efsim zmdlogs worldtime <fixture> --series <regex>  Each chain of a tick series (holds.ts tickChains) on the replay's
                                          clock: log span, world with every applied stop out, with the series
                                          operator's own left in, with the hidden holds out too, against (ticks − 1)
                                          × period: which holds hold an entity's or a status's ticks
                [--period ms] [--operator <op>]  A series outside HOLD_SERIES at this period; these operators only
                [--gap ms]                A chain's next tick up to this past the period in log time (default 1500:
                                          an ultimate's stop inside an array splits it; 3000 spans one)
  efsim zmdlogs clock --kit-buff owner:id [fixture…]  Each instance of a kit buff: the expiry the replay first
                                          gave it, its expiry on the replay's own clock (no hidden holds, no log
                                          ends) and how it ended there, how it ended in the check's replay, the
                                          log's run of it (since, last listed, next unlisted hit) and the last
                                          listed hit's lateness past the own expiry (real and world time); default
                                          every development log with the owner, then the lateness's spread
                [--assume <id>=<reading>] The check's replay under another reading
  efsim zmdlogs holds <fixture>           The fight's hidden holds the replay places (hidden-holds placed): the
                                          least total, each 0.512 s unit with its earliest and latest time and the
                                          clocks spanning it, the bounds dropped; --verbose every bound
                [--why <regex>]           Instead: each replayed instance of the matching kit buffs (owner:id) and
                                          enemy statuses (status:<name>), the log's run paired with it, and why it
                                          is a clock or not (the rule that skipped it), kept or dropped
                [--steps <from>-<to>]     Instead: the holds' per-frame steps in that window (seconds), each with
                                          the hold so far, beside the slow-downs applied there and the log's breaks
                [--assume <id>=<reading>] Under another reading of an open assumption
                                          Between two commits' code: node scripts/cli-ab.ts <ref> --holds <fixture>
  efsim zmdlogs holds --dropped <fixture…|--all>  The placement's dropped bounds over the logs, grouped by bound kind
                                          and what covers their span (the log's Stagger; the kinds of stops inside),
                                          with the logs, the asks and how many of the group were kept; --verbose each
  efsim zmdlogs ramp <fixture>            Corrosion's ramp as the logged hits read it: per listed Corrosion, the
                                          hits whose fitting step differs from the replay's or whose placed hold
                                          falls outside what the steps allow (--verbose every hit)
                [--held]                  Each reading with what held the replay's ramp since its application:
                                          each time stop's share, the placed hidden holds, the rest
  efsim zmdlogs control <fixture>         Who the log shows controlled when (a basic hit with Stagger is the
                                          controlled operator's: controlledFromLog) and every cast, logged or
                                          inferred from hits, with who was controlled at its start; --operator
  efsim zmdlogs cadence --operator <op> --event <regex> [fixture…]  The operator's hit groups of matching keys
                                          in each log (default: every verified and pending development log with the
                                          operator), with world-time gaps (time stops taken out), the stops between
                                          and the nearest cast event; the gaps' spread (timer, cooldown or event?)
--assume <id>=<reading> (repeatable) goes with every subcommand that replays the kits (${[...REPLAYING].join(", ")}),
under another reading of a kit's or the engine's open assumption; the others read the log or the placement only and
refuse it. Their --operator takes ids or names, --from / --to seconds.
`,
  options: {
    with: { type: "string", multiple: true, default: [] },
    dir: { type: "string", multiple: true, default: [] },
    json: { type: "boolean", default: false },
    kind: { type: "string" },
    operator: { type: "string", multiple: true, default: [] },
    workers: { type: "string" },
    buffs: { type: "string" },
    events: { type: "string" },
    "enemy-level": { type: "string" },
    detail: { type: "string" },
    note: { type: "string", multiple: true, default: [] },
    "log-buffs": { type: "boolean", default: false },
    simulate: { type: "boolean", default: false },
    assumed: { type: "boolean", default: false },
    singles: { type: "boolean", default: false },
    top: { type: "string" },
    verbose: { type: "boolean", default: false },
    from: { type: "string" },
    to: { type: "string" },
    "kit-buff": { type: "string", multiple: true, default: [] },
    target: { type: "string", multiple: true, default: [] },
    "trace-buff": { type: "string", multiple: true, default: [] },
    "trace-trigger": { type: "string", multiple: true, default: [] },
    trigger: { type: "string" },
    steps: { type: "string" },
    "trace-stack": { type: "string", multiple: true, default: [] },
    what: { type: "string" },
    hits: { type: "boolean", default: false },
    assume: { type: "string", multiple: true, default: [] },
    against: { type: "string", multiple: true, default: [] },
    "no-foods": { type: "boolean", default: false },
    "same-listing": { type: "string" },
    "against-hit": { type: "string" },
    "against-lanes": { type: "boolean", default: false },
    "why-kept": { type: "boolean", default: false },
    inflictions: { type: "boolean", default: false },
    layers: { type: "string" },
    pairs: { type: "boolean", default: false },
    listed: { type: "string" },
    all: { type: "boolean", default: false },
    event: { type: "string" },
    "fixtures-from": { type: "string" },
    reading: { type: "string" },
    "no-cache": { type: "boolean", default: false },
    ids: { type: "boolean", default: false },
    select: { type: "string" },
    near: { type: "string" },
    "near-operator": { type: "string", multiple: true, default: [] },
    within: { type: "string" },
    window: { type: "string" },
    list: { type: "boolean", default: false },
    buff: { type: "string", multiple: true, default: [] },
    world: { type: "boolean", default: false },
    why: { type: "string" },
    held: { type: "boolean", default: false },
    stops: { type: "boolean", default: false },
    zones: { type: "boolean", default: false },
    by: { type: "string" },
    differ: { type: "boolean", default: false },
    kinds: { type: "boolean", default: false },
    skip: { type: "string", multiple: true, default: [] },
    clock: { type: "string" },
    rows: { type: "boolean", default: false },
    choices: { type: "boolean", default: false },
    dropped: { type: "boolean", default: false },
    clusters: { type: "boolean", default: false },
    at: { type: "string" },
    "at-cast": { type: "string" },
    side: { type: "string" },
    min: { type: "string" },
    bound: { type: "boolean", default: false },
    holds: { type: "boolean", default: false },
    without: { type: "string" },
    series: { type: "string" },
    period: { type: "string" },
    gap: { type: "string" },
    "event-lags": { type: "boolean", default: false },
    targets: { type: "boolean", default: false },
    controls: { type: "boolean", default: false },
  },
  run: async (ctx) => {
    const { values, args } = ctx;
    const [sub, arg, op] = args;
    if (sub !== undefined && values.assume.length && !REPLAYING.has(sub)) throw new Error(`zmdlogs ${sub} doesn't replay the kits, so --assume changes nothing there; the subcommands that do: ${[...REPLAYING].join(", ")}`);
    // The readings every replaying view runs under (none: the default replay, the very same call).
    const assume = values.assume.length ? parseAssume(ctx.data(), values.assume) : {};
    // Engine assumption combo-curve: every view's stop lists on the reading's curve, as its replay's timeline.
    const data = () => withCurveReading(ctx.data(), assume);
    if (sub === "list") {
      if (args.length !== 1) throw new Error("zmdlogs list takes no argument (--with <operator>, --dir <dir>, --json, --ids)");
      const dirs = logDirs(values.dir);
      return formatLogList(data(), { withOperators: values.with, ...(dirs ? { dirs } : {}), json: values.json, ids: values.ids });
    }
    if (sub === "raw") {
      if (args.length !== 2 || !arg) throw new Error("zmdlogs raw takes one fixture file, fixture id or battle id (--buffs <regex>, --events <regex>)");
      const battleId = arg.endsWith(".json") ? readDevFixture(arg).provenance.battleId : battleIdOf(arg);
      const { detail, fetched } = await rawDetail(battleId);
      if (fetched) process.stderr.write(`fetched ${battleId} once from zmdlogs.com; cached in ${rawDir()}\n`);
      return formatRaw(detail, { ...(values.buffs !== undefined ? { buffs: values.buffs } : {}), ...(values.events !== undefined ? { events: values.events } : {}) });
    }
    const progress = (l: string) => process.stderr.write(l + "\n");
    // `--trace-stack owner:stack`, the owner by id or name.
    const stackSpec = (x: string) => {
      const i = x.lastIndexOf(":");
      if (i <= 0) throw new Error(`--trace-stack ${x}: takes owner:stack (efsim kit <operator> lists its stacks)`);
      return `${operatorNamed(data(), x.slice(0, i))}:${x.slice(i + 1)}`;
    };
    // Operators by id, name or part of the id (operatorNamed), in every view.
    const operators = values.operator.map((o) => operatorNamed(data(), o));
    const selection = { named: args.slice(1), all: values.all, ...(values["fixtures-from"] !== undefined ? { fixturesFrom: values["fixtures-from"] } : {}) };
    const event = values.event !== undefined ? { event: new RegExp(values.event) } : {};
    if (sub === "worldtime") {
      const period = values.period !== undefined ? Number(values.period) : undefined;
      if (period !== undefined && !(period > 0)) throw new Error("zmdlogs worldtime --period takes ms (a tick series' period)");
      if (values.series !== undefined) {
        // Round 22 (the barrage-array report point 1): a tick series' chains on the replay's clock.
        if (args.length !== 2 || !arg) throw new Error("zmdlogs worldtime --series <regex> takes one fixture (--period ms for an event outside HOLD_SERIES, --operator op, --assume id=reading)");
        const fx = readDevFixture(arg);
        const replay = logBuffReplay(data(), fx, placeHits(data(), fx, assume), { assume }).replay;
        const gap = values.gap !== undefined ? Number(values.gap) : undefined;
        if (gap !== undefined && !(gap >= 0)) throw new Error("zmdlogs worldtime --gap takes ms (how far past its period a tick may come and still be the chain's next)");
        return seriesClockView(data(), fx, replay, { event: new RegExp(values.series), ...(period !== undefined ? { period } : {}), ...(gap !== undefined ? { gap } : {}), operators });
      }
      const [from, to] = [Number(args[2]), Number(args[3])];
      if (args.length !== 4 || !arg || !Number.isFinite(from) || !Number.isFinite(to)) throw new Error("zmdlogs worldtime takes one fixture and two times in seconds: <fixture> <from s> <to s> (or --series <regex>)");
      if (period !== undefined) throw new Error("zmdlogs worldtime --period goes with --series");
      // The replay's own stops (an event it read as a buff's tick holds nothing: round 15), under --assume.
      const fx = readDevFixture(arg);
      const placement = placeHits(data(), fx, assume);
      const replay = logBuffReplay(data(), fx, placement, { assume }).replay;
      const text = worldTimeView(data(), fx, from * 1000, to * 1000, replay, placement);
      if (!values.holds && values.without === undefined) return text;
      const without = values.without !== undefined ? { without: operatorNamed(data(), values.without) } : {};
      return [text, ...worldClockLines(data(), from * 1000, to * 1000, replayTimeStops(data(), fx, placement, replay), replay, { ...without, holds: values.holds })].join("\n");
    }
    if (sub === "ramp") {
      if (args.length !== 2 || !arg) throw new Error("zmdlogs ramp takes one fixture (a path or an id such as db87)");
      return rampView(data(), readDevFixture(arg), { verbose: values.verbose, why: values.held, assume });
    }
    if (sub === "holds" && values.dropped) {
      const named = args.slice(1);
      if (!named.length && !values.all) throw new Error("zmdlogs holds --dropped takes fixtures (ids such as 0c14) or --all (every verified and pending development log)");
      if (named.length && values.all) throw new Error("zmdlogs holds --dropped: fixtures or --all, not both");
      return droppedView(data(), devFixtures(named.length ? { ids: named } : {}), { assume, verbose: values.verbose, progress });
    }
    if (sub === "holds" && values.steps !== undefined) {
      const m = /^([\d.]+)-([\d.]+)$/.exec(values.steps);
      if (args.length !== 2 || !arg || !m) throw new Error("zmdlogs holds --steps takes one fixture and a window in seconds: --steps 43-46");
      return holdsSteps(data(), readDevFixture(arg), Number(m[1]) * 1000, Number(m[2]) * 1000, { assume });
    }
    if (sub === "holds") {
      if (args.length !== 2 || !arg) throw new Error("zmdlogs holds takes one fixture (a path or an id such as 0c14); --dropped for several or --all");
      return holdsView(data(), readDevFixture(arg), { verbose: values.verbose, ...(values.why !== undefined ? { why: new RegExp(values.why) } : {}), assume });
    }
    if (sub === "clocks") {
      const named = args.slice(1);
      if (!named.length && !values.all) throw new Error("zmdlogs clocks takes fixtures (ids such as 0c14) or --all (every verified and pending development log; --clock tick,cast,burst, --by operator, --rows)");
      if (named.length && values.all) throw new Error("zmdlogs clocks: fixtures or --all, not both");
      const kinds = (values.clock ?? "tick,cast").split(",").filter(Boolean);
      const bad = kinds.filter((k) => !(CLOCK_KINDS as readonly string[]).includes(k));
      if (bad.length || !kinds.length) throw new Error(`--clock takes ${CLOCK_KINDS.join(", ")} (comma-separated)`);
      if (values.by !== undefined && values.by !== "operator" && values.by !== "kind") throw new Error("zmdlogs clocks --by takes operator (or kind, the default)");
      return clocksView(data(), devFixtures(named.length ? { ids: named } : {}), { kinds: kinds as ClockKind[], ...(values.by === "operator" ? { by: "operator" as const } : {}), rows: values.rows, assume, progress });
    }
    if (sub === "followups") {
      const named = args.slice(1);
      if (values.operator.length !== 1) throw new Error("zmdlogs followups takes one --operator <op> (an id, its name or part of the id), then fixtures or --all (--trigger <regex>, --assume id=reading, --kit)");
      if (!named.length && !values.all) throw new Error("zmdlogs followups takes fixtures (ids such as d4fb) or --all");
      if (named.length && values.all) throw new Error("zmdlogs followups: fixtures or --all, not both");
      const op = operatorNamed(data(), values.operator[0] as string);
      const logs = devFixtures(named.length ? { ids: named } : { withOperators: [op] });
      return followUpsView(data(), logs, op, { ...(values.trigger !== undefined ? { trigger: new RegExp(values.trigger) } : {}), assume, progress });
    }
    if (sub === "stack") {
      const [spec, ...named] = args.slice(1);
      if (spec === undefined || (!named.length && !values.all)) throw new Error("zmdlogs stack takes owner:stack (efsim kit <operator> lists its stacks), then fixtures or --all (--at-cast <regex>, --assume id=reading)");
      if (named.length && values.all) throw new Error("zmdlogs stack: fixtures or --all, not both");
      const [owner, stack] = stackSpec(spec).split(/:(?=[^:]*$)/) as [string, string];
      const logs = devFixtures(named.length ? { ids: named } : { withOperators: [owner] });
      return stackView(data(), logs, owner, stack, { ...(values["at-cast"] !== undefined ? { skill: new RegExp(values["at-cast"]) } : {}), assume, progress });
    }
    if (sub === "away") {
      const named = args.slice(1);
      if (!named.length && !values.all) throw new Error("zmdlogs away takes fixtures (ids such as 4d60) or --all (every verified and pending development log; --assume id=reading)");
      if (named.length && values.all) throw new Error("zmdlogs away: fixtures or --all, not both");
      return awayView(data(), devFixtures(named.length ? { ids: named } : {}), { assume, progress });
    }
    if (sub === "ends") {
      if (args.length !== 2 || !arg) throw new Error("zmdlogs ends takes one fixture (a path or an id such as 6339; --at s, --min n, --side enemy|team, --from s, --to s, --operator op)");
      if (values.side !== undefined && values.side !== "enemy" && values.side !== "team") throw new Error("zmdlogs ends --side takes enemy or team");
      const num = (v: string | undefined, name: string, scale = 1) => {
        if (v === undefined) return undefined;
        const x = Number(v);
        if (!Number.isFinite(x)) throw new Error(`zmdlogs ends --${name} takes a number`);
        return x * scale;
      };
      const [at, min, from, to] = [num(values.at, "at", 1000), num(values.min, "min"), num(values.from, "from", 1000), num(values.to, "to", 1000)];
      return endsView(data(), readDevFixture(arg), { operators, ...(at !== undefined ? { at } : {}), ...(min !== undefined ? { min } : {}), ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}), ...(values.side !== undefined ? { side: values.side as "enemy" | "team" } : {}) });
    }
    if (sub === "instances" || sub === "control" || sub === "lanes") {
      if (args.length !== 2 || !arg) throw new Error(`zmdlogs ${sub} takes one fixture (a path or an id such as 0c14)`);
      const fx = readDevFixture(arg);
      if (sub === "instances") return instancesView(data(), fx, { operators, ...(values.kind !== undefined ? { kind: values.kind } : {}) });
      if (sub === "control") return controlView(data(), fx, { operators });
      if (values.buff.length > 1) throw new Error("zmdlogs lanes takes one --buff <regex>");
      return lanesView(data(), fx, values.buff[0] !== undefined ? new RegExp(values.buff[0]) : undefined, { world: values.world });
    }
    if (sub === "clock") {
      if (values["kit-buff"].length !== 1) throw new Error("zmdlogs clock takes one --kit-buff owner:id (efsim kit <operator> lists its buffs) and optional fixtures");
      const kitBuff = kitBuffKey(data(), values["kit-buff"][0] as string);
      const named = args.slice(1);
      const logs = devFixtures({ ...(named.length ? { ids: named } : { withOperators: [kitBuff.split(":")[0] as string] }) });
      return clockView(data(), logs, kitBuff, assume);
    }
    if (sub === "census" || sub === "buffs" || sub === "cadence") {
      const named = args.slice(1);
      const ids = [...named, ...(values["fixtures-from"] !== undefined ? readFileSync(values["fixtures-from"], "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean) : [])];
      const dirs = logDirs(values.dir);
      const withOps = sub === "cadence" ? operators : [];
      const logs = devFixtures({ ...(ids.length ? { ids } : {}), ...(dirs ? { dirs } : {}), ...(withOps.length ? { withOperators: withOps } : {}) });
      const which = ids.length ? logs.map((d) => d.short).join(" ") : `every ${dirs ? dirs.join(" and ") : "verified and pending"} development log`;
      if (sub === "buffs") {
        if (values.buff.length > 1) throw new Error("zmdlogs buffs takes one --buff <regex>");
        return buffsView(data(), logs, { ...(values.buff[0] !== undefined ? { buff: new RegExp(values.buff[0]) } : {}), operators });
      }
      if (sub === "cadence") {
        if (operators.length !== 1 || values.event === undefined) throw new Error("zmdlogs cadence takes one --operator <op> and --event <regex>");
        return cadenceView(data(), logs, operators[0] as string, new RegExp(values.event));
      }
      if (values.select === undefined) throw new Error("zmdlogs census takes --select <cast:|event:|buff:|origin:regex>");
      const window = values.window !== undefined ? values.window.split(",").map(Number) : values.within !== undefined ? [-Number(values.within), Number(values.within)] : [-1000, 1000];
      if (window.length !== 2 || window.some((x) => !Number.isFinite(x))) throw new Error("--within takes ms, --window from,to (ms)");
      const nearOps = values["near-operator"].map((o) => operatorNamed(data(), o));
      const rerun = [
        "efsim zmdlogs census",
        ...named,
        ...(values["fixtures-from"] !== undefined ? [`--fixtures-from ${values["fixtures-from"]}`] : []),
        ...(dirs ? dirs.map((d) => `--dir ${d}`) : []),
        `--select '${values.select}'`,
        ...operators.map((o) => `--operator ${o}`),
        ...(values.near !== undefined ? [`--near '${values.near}'`, ...nearOps.map((o) => `--near-operator ${o}`), `--window=${window.join(",")}`] : []),
      ].join(" ");
      return census(data(), logs, {
        select: parseSelector(values.select),
        operators,
        ...(values.near !== undefined ? { near: parseSelector(values.near), nearOperators: nearOps, window: { from: window[0] as number, to: window[1] as number } } : {}),
        list: values.list,
        rerun,
        logs: which,
      });
    }
    const seconds = (v: string | undefined, name: "from" | "to") => {
      if (v === undefined) return {};
      const x = Number(v);
      if (!Number.isFinite(x)) throw new Error(`--${name} takes seconds`);
      return { [name]: x * 1000 };
    };
    if (sub === "hits") {
      if (values.reading !== undefined && values.reading !== "log" && values.reading !== "primary") throw new Error("--reading takes log (or primary)");
      const reading = values.reading === "log" ? "log" : "primary";
      const window = { ...seconds(values.from, "from"), ...seconds(values.to, "to") };
      const against = values.against.length ? parseAssume(ctx.data(), values.against) : {};
      if (values.against.length && values.json) throw new Error("zmdlogs hits --against prints the changed hits as text lines (no --json)");
      const sameAt = values["same-listing"] !== undefined ? Number(values["same-listing"]) * 1000 : undefined;
      if (sameAt !== undefined && !Number.isFinite(sameAt)) throw new Error("zmdlogs hits --same-listing takes seconds");
      if (sameAt !== undefined && (values.against.length || values.json || values.listed !== undefined)) throw new Error("zmdlogs hits --same-listing prints text lines alone (no --against, --json or --listed)");
      const againstHit = values["against-hit"] !== undefined ? Number(values["against-hit"]) * 1000 : undefined;
      if (againstHit !== undefined && !Number.isFinite(againstHit)) throw new Error("zmdlogs hits --against-hit takes seconds");
      if (againstHit !== undefined && (sameAt !== undefined || values.against.length || values.json || values.listed !== undefined)) throw new Error("zmdlogs hits --against-hit prints text lines alone (no --same-listing, --against, --json or --listed)");
      // --layers: an owner given by its name ("Liino:wpn_lance_0014.atk"): its id (clockview.ts kitBuffKey).
      const layers = values.layers !== undefined ? { layers: kitBuffKey(data(), values.layers) } : {};
      if (values.layers !== undefined && (values.json || values.against.length || sameAt !== undefined || againstHit !== undefined)) throw new Error("zmdlogs hits --layers prints text lines alone (no --json, --against, --same-listing or --against-hit)");
      if (values.targets && (values.json || values.against.length || sameAt !== undefined || againstHit !== undefined || values.layers !== undefined)) throw new Error("zmdlogs hits --targets prints text lines alone (no --json, --against, --same-listing, --against-hit or --layers)");
      return hitsReport(data, selection, { targets: values.targets, ...layers, workers: values.workers, ...(values.kind !== undefined ? { kind: values.kind } : {}), operators, ...event, ...window, json: values.json, reading, zones: values.zones, cache: !values["no-cache"], assume, against, ...(sameAt !== undefined ? { sameListing: sameAt } : {}), ...(againstHit !== undefined ? { againstHit } : {}), ...(values.listed !== undefined ? { listed: new RegExp(values.listed) } : {}), progress });
    }
    if (sub === "timing") {
      return timingReport(data, args.slice(1), { assumed: values.assumed, singles: values.singles, verbose: values.verbose, ...(values.top !== undefined ? { top: Number(values.top) } : {}), assume, progress });
    }
    if (sub === "casts" && values["event-lags"]) {
      // Round 22 (the barrage-array report point 3): the log's cast events against the placed starts, over logs.
      const named = args.slice(1);
      if (!named.length && !values.all) throw new Error("zmdlogs casts --event-lags takes fixtures (ids such as fc63) or --all (every verified and pending development log; --operator op, --verbose)");
      if (named.length && values.all) throw new Error("zmdlogs casts --event-lags: fixtures or --all, not both");
      const logs = devFixtures(named.length ? { ids: named } : {}).filter((d) => !operators.length || d.fx.team.some((b) => operators.includes(b.operator)));
      return eventLagsView(data(), logs, { operators, verbose: values.verbose });
    }
    if (sub === "casts" || sub === "replay") {
      if (args.length !== 2 || !arg) throw new Error(`zmdlogs ${sub} takes one fixture file (--from s, --to s, --operator op${sub === "replay" ? ", --kit-buff owner:id[@op], --assume id=reading" : ""})`);
      const filter = { ...seconds(values.from, "from"), ...seconds(values.to, "to"), operators };
      const fx = readDevFixture(arg);
      // An owner given by its name ("Zhuang Fangyi:suit_expend_spell01.spell_dmg"): its id (clockview.ts kitBuffKey).
      const keyed = (xs: readonly string[]) => xs.map((x) => kitBuffKey(data(), x));
      if (sub === "casts" && values.json) return castsJson(data(), fx, { ...filter, rules: values.choices });
      return sub === "casts" ? castsReport(data(), fx, { ...filter, rules: values.choices }) : replayReport(data(), fx, { ...filter, buffs: keyed(values["kit-buff"]), trace: [...keyed(values["trace-buff"]), ...values["trace-trigger"].map((x) => `trigger:${x}`), ...values["trace-stack"].map((x) => `stack:${stackSpec(x)}`)], assume, stops: values.stops, againstLanes: values["against-lanes"] });
    }
    if (sub === "totals") {
      const top = values.top !== undefined ? { top: Number(values.top) } : {};
      if (values.all || args.length > 2 || values["fixtures-from"] !== undefined) return totalsAllReport(data, selection, { workers: values.workers, operators, ...top, cache: !values["no-cache"], assume, kinds: values.kinds, json: values.json, skip: values.skip, progress });
      if (values.skip.length) throw new Error("zmdlogs totals --skip goes with several fixtures or --all");
      if (args.length !== 2 || !arg) throw new Error("zmdlogs totals takes one fixture file (--operator op, --top n, --by event|crit, --kinds, --assume id=reading), or several / --all for the table of every fight (--workers n, --kinds)");
      if (values.by !== undefined && values.by !== "event" && values.by !== "crit") throw new Error("zmdlogs totals --by takes event or crit");
      return totalsView(data(), readDevFixture(arg), { operators, ...top, assume, byEvent: values.by === "event", byCrit: values.by === "crit", kinds: values.kinds });
    }
    if (sub === "stagger") return staggerReport(data(), args.slice(1), progress, assume);
    if (sub === "stops") {
      const named = args.slice(1);
      if (!named.length && !values.all) throw new Error("zmdlogs stops takes fixtures (ids such as 0c14) or --all (every verified and pending development log; --differ, --operator op)");
      if (named.length && values.all) throw new Error("zmdlogs stops: fixtures or --all, not both");
      const logs = devFixtures(named.length ? { ids: named } : {});
      return stopsView(data(), logs, { differ: values.differ, operators, assume, progress });
    }
    if (sub === "decisions") {
      const named = args.slice(1);
      // Round 21 (the tail-cut report point 2): the counterfactual per kept tail.
      if (values["why-kept"]) {
        if (named.length !== 1 || values.all) throw new Error("zmdlogs decisions --why-kept takes one fixture (an id such as 6339; --assume id=reading, --operator op)");
        return whyKeptView(data(), readDevFixture(named[0] as string), { ...(Object.keys(assume).length ? { assume } : {}), operators, progress });
      }
      if (!named.length && !values.all) throw new Error("zmdlogs decisions takes fixtures (ids such as 0c14) or --all (every verified and pending development log), with --assume <id>=<reading> (without it: every decision)");
      if (named.length && values.all) throw new Error("zmdlogs decisions: fixtures or --all, not both");
      // With --operator, only the logs whose team has one of them.
      const logs = devFixtures(named.length ? { ids: named } : {}).filter((d) => !operators.length || d.fx.team.some((b) => operators.includes(b.operator)));
      // Round 21 (the tail-cut report point 4): a run past the foreground limit loses what was piped after it.
      if (values.all) process.stderr.write(`zmdlogs decisions --all: ${logs.length} logs, about 3 s each: run it in the background with its output to a file\n`);
      return decisionsView(data(), logs, { assume, operators, progress });
    }
    if (sub === "placement") {
      const named = args.slice(1);
      if (!named.length && !values.all) throw new Error("zmdlogs placement takes fixtures (ids such as 0c14) or --all (every verified and pending development log)");
      if (named.length && values.all) throw new Error("zmdlogs placement: fixtures or --all, not both");
      return placementView(data(), devFixtures(named.length ? { ids: named } : {}), { progress, rules: values.choices });
    }
    if (sub === "statuses" && values.controls) {
      // Round 22 (the check-targets report point 2): is there a freeze in these fights? Over logs, one replay each.
      const named = args.slice(1);
      if (!named.length && !values.all) throw new Error("zmdlogs statuses --controls takes fixtures (ids such as 6339) or --all (every verified and pending development log; --operator op, --from s, --to s, --assume id=reading)");
      if (named.length && values.all) throw new Error("zmdlogs statuses --controls: fixtures or --all, not both");
      if (values.inflictions || values.target.length) throw new Error("zmdlogs statuses --controls lists the control statuses alone (no --inflictions, --target)");
      const logs = devFixtures(named.length ? { ids: named } : {}).filter((d) => !operators.length || d.fx.team.some((b) => operators.includes(b.operator)));
      if (values.all) process.stderr.write(`zmdlogs statuses --controls --all: ${logs.length} logs, a replay each (about 3 s): run it in the background with its output to a file\n`);
      return logs.map((d) => statusesView(data(), d.fx, { ...seconds(values.from, "from"), ...seconds(values.to, "to"), operators, assume, controls: true })).join("\n");
    }
    if (sub === "statuses") {
      if (args.length !== 2 || !arg) throw new Error("zmdlogs statuses takes one fixture file (--target n, --operator op, --from s, --to s, --assume id=reading; --controls: several or --all)");
      const targets = values.target.map((x) => {
        const n = Number(x);
        if (!Number.isInteger(n) || n < 0) throw new Error(`zmdlogs statuses --target ${x}: a target number (0, 1, …: the T<n> of its lines)`);
        return n;
      });
      return statusesView(data(), readDevFixture(arg), { ...seconds(values.from, "from"), ...seconds(values.to, "to"), operators, assume, targets, inflictions: values.inflictions });
    }
    if (sub === "bursts") {
      const named = args.slice(1);
      if (!named.length && !values.all) throw new Error("zmdlogs bursts takes fixtures (ids such as 0c14) or --all (every verified and pending development log; --operator op, --from s, --to s)");
      if (named.length && values.all) throw new Error("zmdlogs bursts: fixtures or --all, not both");
      // With --operator, only the logs whose team has one of them.
      const logs = devFixtures(named.length ? { ids: named } : {}).filter((d) => !operators.length || d.fx.team.some((b) => operators.includes(b.operator)));
      return burstsView(data(), logs, { operators, ...seconds(values.from, "from"), ...seconds(values.to, "to"), assume, progress });
    }
    if (sub === "differences") return differencesCliReport(data, selection, { workers: values.workers, operators, ...event, ...(values.what !== undefined ? { what: values.what } : {}), hits: values.hits, clusters: values.clusters, cache: !values["no-cache"], assume, progress });
    if (sub === "groups") {
      if (values.operator.length !== 1) throw new Error("zmdlogs groups takes one --operator <op> (an id, its name or part of the id) and optional fixtures");
      return groupsCliReport(data, values.operator[0] as string, selection, { workers: values.workers, verbose: values.verbose, cache: !values["no-cache"], assume, progress });
    }
    if (sub === "boundaries") {
      if (values["kit-buff"].length > 1) throw new Error("zmdlogs boundaries takes one --kit-buff <regex>");
      return boundariesCliReport(data, selection, { workers: values.workers, operators, ...(values["kit-buff"][0] !== undefined ? { kitBuff: new RegExp(values["kit-buff"][0]) } : {}), cache: !values["no-cache"], assume, progress });
    }
    if (sub === "assumed") {
      if (values.operator.length !== 1) throw new Error("zmdlogs assumed takes one --operator <op> (an id, its name or part of the id) and optional fixtures (--kind <set>, --top n)");
      return assumedCliReport(data, values.operator[0] as string, selection, { workers: values.workers, ...(values.kind !== undefined ? { kind: values.kind } : {}), ...(values.top !== undefined ? { top: Number(values.top) } : {}), cache: !values["no-cache"], assume, progress });
    }
    if (sub === "offsets") return offsetsReport(data, selection, { workers: values.workers, operators, ...(values.top !== undefined ? { top: Number(values.top) } : {}), cache: !values["no-cache"], assume, bound: values.bound, progress });
    if (sub === "fit-build") {
      if (args.length !== 2 || !arg || values.operator.length !== 1) throw new Error("zmdlogs fit-build takes one fixture file and one --operator <op> (--top n, --no-foods)");
      return fitBuildReport(data(), readDevFixture(arg), values.operator[0] as string, { ...(values.top !== undefined ? { top: Number(values.top) } : {}), foods: !values["no-foods"], assume, pairs: values.pairs });
    }
    if ((sub === "scales" || sub === "find-scales") && arg && op) {
      const fx = readDevFixture(arg);
      return sub === "scales" ? scalesReport(data(), fx, op) : findScalesReport(data(), fx, op);
    }
    if (args.length !== 2 || !arg || (sub !== "import" && sub !== "check" && sub !== "reactions" && sub !== "refresh")) throw new Error(`zmdlogs takes import <battle id>, check <file>, reactions <file>, refresh <file>, scales <file> <op> or find-scales <file> <op>\n\n${ctx.usage}`);
    if (sub === "refresh") {
      const r = await refreshFromDetail(arg, values.detail !== undefined ? { detailFile: values.detail } : {});
      if (r.fetched) process.stderr.write(`fetched the detail once from zmdlogs.com; cached in ${rawDir()}\n`);
      const parser = r.parserVersion !== undefined ? `; ZMDLogs now parses it with ${r.parserVersion}` : "";
      const kept = r.keptUnquantified ? `; ${r.keptUnquantified} hit(s) keep their unquantified listing (the detail no longer marks it unvalued)` : "";
      return `${arg}: ${r.casts} cast(s), ${r.poise} hit(s) with Stagger; added ${r.added.length ? r.added.join(", ") : "nothing"}${parser}${kept}`;
    }
    if (sub === "reactions") {
      const fx = readDevFixture(arg);
      return formatReactionCheck(checkReactions(data(), fx));
    }
    if (sub === "check") {
      const fx = readDevFixture(arg);
      return checkReport(data(), fx, { logBuffs: values["log-buffs"], simulate: values.simulate, assume });
    }
    const file = await importBattle(data(), arg, values["enemy-level"] === undefined ? undefined : Number(values["enemy-level"]), values.note, values.detail, (d) => cacheRawDetail(arg, d));
    return `wrote ${file}`;
  },
});
