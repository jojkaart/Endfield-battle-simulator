// efsim zmdlogs: the log tooling (list, per-hit numbers, raw details, import, the check, buff timing, reactions,
// refresh, scales).

// The logic is @efsim/logs' (reports.ts and the modules it calls); this module checks the arguments and calls it.

import {
  battleIdOf,
  buffsView,
  cacheRawDetail,
  cadenceView,
  census,
  clockView,
  controlView,
  devFixtures,
  instancesView,
  lanesView,
  worldTimeView,
  holdsView,
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
  hitsReport,
  importBattle,
  operatorNamed,
  rawDetail,
  rawDir,
  readDevFixture,
  refreshFromDetail,
  replayReport,
  scalesReport,
  staggerReport,
  timingReport,
} from "@efsim/logs";
import { readFileSync } from "node:fs";
import { parseAssume } from "../assume.ts";
import { command } from "../command.ts";
import { formatLogList, logDirs } from "../logtools.ts";

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
                [--assume <id>=<reading>] Under another reading of an open assumption, as check's (not cached)
                [--fixtures-from <file>]  Also the fixtures listed in a file, one per line (# comments)
                [--reading log]           Text lines also give the log's reading and its error: off under both is the
                                          build or a kit value, off only under the primary the replay's timing
                [--json] [--workers n]    JSON Lines; fixtures on n worker threads (default 1)
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
  efsim zmdlogs scales <fixture> <op>     Multiplier each logged hit of an operator implies
  efsim zmdlogs find-scales <fixture> <op> Skill values (keys) that explain each logged event
  efsim zmdlogs casts <fixture>           The placement in time order: each logged hit with the cast, slot and
                                          frame it was placed at, the log's cast events, the placed casts and their
                                          time stops
                [--from s] [--to s]       Only this window (seconds); --operator: only these operators' hits, casts
  efsim zmdlogs replay <fixture>          The replay in time order: its landings with the logged hit each stands for
                                          (or "replay only"), logged hits without a landing and why, casts it
                                          couldn't make or made without the log, its Stagger windows
                [--kit-buff owner:id[@op]] Also a kit buff's windows at an operator (default its owner; repeatable)
                [--trace-buff owner:id]   Each change of a kit buff's expiry and the step that made it (a cast, a
                                          pause or stop, the log's Stagger steps; repeatable)
                [--assume <id>=<reading>] Under another reading of an open assumption, as check's
                [--from s] [--to s]       Only this window; --operator: only these operators
  efsim zmdlogs stagger [fixture…]        Each logged Stagger run (first to last Staggered hit) against the replay's
                                          windows and where the engine's own would have ended; with several logs
                                          (default: every development log) a summary of the shortfalls
  efsim zmdlogs differences <fixture…|--all>  Where the log's listing and the replay disagree (a kit buff,
                                          Stagger), grouped, with the logged value ÷ the engine's reading per group:
                                          does the damage side with the log or the replay?
                [--what <regex>] [--hits] Only differences about this; each hit too. --operator, --event, --workers n,
                                          --fixtures-from, --no-cache as hits
  efsim zmdlogs groups --operator <op> [fixture…]  An operator's mismatches sorted into causes: team-wide (a
                                          teammate mismatches at the same ratio nearby), no landing, own by skill
                                          event and by what the log and replay disagree on (default: every
                                          development log with it; --verbose each mismatch; --workers n)
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
  efsim zmdlogs worldtime <fixture> <from s> <to s>  The world's time between two log moments under the time
                                          stops of the replay's casts (placed, from cast events, inferred), and the
                                          stops between (operator, skill, frames, lowest scale)
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
  efsim zmdlogs control <fixture>         Who the log shows controlled when (a basic hit with Stagger is the
                                          controlled operator's: controlledFromLog) and every cast, logged or
                                          inferred from hits, with who was controlled at its start; --operator
  efsim zmdlogs cadence --operator <op> --event <regex> [fixture…]  The operator's hit groups of matching keys
                                          in each log (default: every verified and pending development log with the
                                          operator), with world-time gaps (time stops taken out), the stops between
                                          and the nearest cast event; the gaps' spread (timer, cooldown or event?)
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
    "trace-buff": { type: "string", multiple: true, default: [] },
    what: { type: "string" },
    hits: { type: "boolean", default: false },
    assume: { type: "string", multiple: true, default: [] },
    "no-foods": { type: "boolean", default: false },
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
  },
  run: async (ctx) => {
    const { values, args, data } = ctx;
    const [sub, arg, op] = args;
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
    // Operators by id, name or part of the id (operatorNamed), in every view.
    const operators = values.operator.map((o) => operatorNamed(data(), o));
    const selection = { named: args.slice(1), all: values.all, ...(values["fixtures-from"] !== undefined ? { fixturesFrom: values["fixtures-from"] } : {}) };
    const event = values.event !== undefined ? { event: new RegExp(values.event) } : {};
    if (sub === "worldtime") {
      const [from, to] = [Number(args[2]), Number(args[3])];
      if (args.length !== 4 || !arg || !Number.isFinite(from) || !Number.isFinite(to)) throw new Error("zmdlogs worldtime takes one fixture and two times in seconds: <fixture> <from s> <to s>");
      return worldTimeView(data(), readDevFixture(arg), from * 1000, to * 1000);
    }
    if (sub === "holds") {
      if (args.length !== 2 || !arg) throw new Error("zmdlogs holds takes one fixture (a path or an id such as 0c14)");
      return holdsView(data(), readDevFixture(arg), { verbose: values.verbose });
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
      const kitBuff = values["kit-buff"][0] as string;
      const named = args.slice(1);
      const logs = devFixtures({ ...(named.length ? { ids: named } : { withOperators: [kitBuff.split(":")[0] as string] }) });
      return clockView(data(), logs, kitBuff, parseAssume(data(), values.assume));
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
    if (sub === "hits") {
      if (values.reading !== undefined && values.reading !== "log" && values.reading !== "primary") throw new Error("--reading takes log (or primary)");
      const reading = values.reading === "log" ? "log" : "primary";
      return hitsReport(data, selection, { workers: values.workers, ...(values.kind !== undefined ? { kind: values.kind } : {}), operators, ...event, json: values.json, reading, cache: !values["no-cache"], assume: parseAssume(data(), values.assume), progress });
    }
    if (sub === "timing") {
      return timingReport(data, args.slice(1), { assumed: values.assumed, singles: values.singles, verbose: values.verbose, ...(values.top !== undefined ? { top: Number(values.top) } : {}), progress });
    }
    if (sub === "casts" || sub === "replay") {
      if (args.length !== 2 || !arg) throw new Error(`zmdlogs ${sub} takes one fixture file (--from s, --to s, --operator op${sub === "replay" ? ", --kit-buff owner:id[@op], --assume id=reading" : ""})`);
      const seconds = (v: string | undefined, name: string) => {
        if (v === undefined) return {};
        const x = Number(v);
        if (!Number.isFinite(x)) throw new Error(`--${name} takes seconds`);
        return { [name]: x * 1000 };
      };
      const filter = { ...seconds(values.from, "from"), ...seconds(values.to, "to"), operators };
      const fx = readDevFixture(arg);
      return sub === "casts" ? castsReport(data(), fx, filter) : replayReport(data(), fx, { ...filter, buffs: values["kit-buff"], trace: values["trace-buff"], assume: parseAssume(data(), values.assume) });
    }
    if (sub === "stagger") return staggerReport(data(), args.slice(1), progress);
    if (sub === "differences") return differencesCliReport(data, selection, { workers: values.workers, operators, ...event, ...(values.what !== undefined ? { what: values.what } : {}), hits: values.hits, cache: !values["no-cache"], progress });
    if (sub === "groups") {
      if (values.operator.length !== 1) throw new Error("zmdlogs groups takes one --operator <op> (an id, its name or part of the id) and optional fixtures");
      return groupsCliReport(data, values.operator[0] as string, selection, { workers: values.workers, verbose: values.verbose, cache: !values["no-cache"], progress });
    }
    if (sub === "fit-build") {
      if (args.length !== 2 || !arg || values.operator.length !== 1) throw new Error("zmdlogs fit-build takes one fixture file and one --operator <op> (--top n, --no-foods)");
      return fitBuildReport(data(), readDevFixture(arg), values.operator[0] as string, { ...(values.top !== undefined ? { top: Number(values.top) } : {}), foods: !values["no-foods"] });
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
      return `${arg}: ${r.casts} cast(s), ${r.poise} hit(s) with Stagger; added ${r.added.length ? r.added.join(", ") : "nothing"}${parser}`;
    }
    if (sub === "reactions") {
      const fx = readDevFixture(arg);
      return formatReactionCheck(checkReactions(data(), fx));
    }
    if (sub === "check") {
      const fx = readDevFixture(arg);
      return checkReport(data(), fx, { logBuffs: values["log-buffs"], simulate: values.simulate, assume: parseAssume(data(), values.assume) });
    }
    const file = await importBattle(data(), arg, values["enemy-level"] === undefined ? undefined : Number(values["enemy-level"]), values.note, values.detail, (d) => cacheRawDetail(arg, d));
    return `wrote ${file}`;
  },
});
