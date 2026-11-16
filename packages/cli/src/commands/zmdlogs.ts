// efsim zmdlogs: the log tooling (list, per-hit numbers, raw details, import, the check, buff timing, reactions,
// refresh, scales).

// The logic is @efsim/logs' (reports.ts and the modules it calls); this module checks the arguments and calls it.

import {
  battleIdOf,
  cacheRawDetail,
  checkReactions,
  checkReport,
  findScalesReport,
  formatRaw,
  formatReactionCheck,
  hitsReport,
  importBattle,
  rawDetail,
  rawDir,
  readDevFixture,
  refreshFixture,
  scalesReport,
  timingReport,
} from "@efsim/logs";
import { command } from "../command.ts";
import { formatLogList, logDirs } from "../logtools.ts";

export default command({
  name: "zmdlogs",
  usage: `  efsim zmdlogs list                      The development logs (never a hold-out): file, team with potentials,
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
  },
  run: async (ctx) => {
    const { values, args, data } = ctx;
    const [sub, arg, op] = args;
    if (sub === "list") {
      if (args.length !== 1) throw new Error("zmdlogs list takes no argument (--with <operator>, --dir <dir>, --json)");
      const dirs = logDirs(values.dir);
      return formatLogList(data(), { withOperators: values.with, ...(dirs ? { dirs } : {}), json: values.json });
    }
    if (sub === "raw") {
      if (args.length !== 2 || !arg) throw new Error("zmdlogs raw takes one fixture file, fixture id or battle id (--buffs <regex>, --events <regex>)");
      const battleId = arg.endsWith(".json") ? readDevFixture(arg).provenance.battleId : battleIdOf(arg);
      const { detail, fetched } = await rawDetail(battleId);
      if (fetched) process.stderr.write(`fetched ${battleId} once from zmdlogs.com; cached in ${rawDir()}\n`);
      return formatRaw(detail, { ...(values.buffs !== undefined ? { buffs: values.buffs } : {}), ...(values.events !== undefined ? { events: values.events } : {}) });
    }
    const progress = (l: string) => process.stderr.write(l + "\n");
    if (sub === "hits") {
      return hitsReport(data, args.slice(1), { workers: values.workers, ...(values.kind !== undefined ? { kind: values.kind } : {}), operators: values.operator, json: values.json, progress });
    }
    if (sub === "timing") {
      return timingReport(data, args.slice(1), { assumed: values.assumed, singles: values.singles, verbose: values.verbose, ...(values.top !== undefined ? { top: Number(values.top) } : {}), progress });
    }
    if ((sub === "scales" || sub === "find-scales") && arg && op) {
      const fx = readDevFixture(arg);
      return sub === "scales" ? scalesReport(data(), fx, op) : findScalesReport(data(), fx, op);
    }
    if (args.length !== 2 || !arg || (sub !== "import" && sub !== "check" && sub !== "reactions" && sub !== "refresh")) throw new Error(`zmdlogs takes import <battle id>, check <file>, reactions <file>, refresh <file> --detail <file>, scales <file> <op> or find-scales <file> <op>\n\n${ctx.usage}`);
    if (sub === "refresh") {
      if (!values.detail) throw new Error("zmdlogs refresh needs --detail <file> (an already downloaded /api/battles/<id> response)");
      const r = refreshFixture(arg, values.detail, (d) => cacheRawDetail(readDevFixture(arg).provenance.battleId, d));
      return `${arg}: ${r.casts} cast(s), ${r.poise} hit(s) with Stagger`;
    }
    if (sub === "reactions") {
      const fx = readDevFixture(arg);
      return formatReactionCheck(checkReactions(data(), fx));
    }
    if (sub === "check") {
      const fx = readDevFixture(arg);
      return checkReport(data(), fx, { logBuffs: values["log-buffs"], simulate: values.simulate });
    }
    const file = await importBattle(data(), arg, values["enemy-level"] === undefined ? undefined : Number(values["enemy-level"]), values.note, values.detail, (d) => cacheRawDetail(arg, d));
    return `wrote ${file}`;
  },
});
