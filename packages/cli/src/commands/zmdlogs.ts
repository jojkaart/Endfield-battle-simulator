// efsim zmdlogs: the log tooling (list, per-hit numbers, raw details, import, the check, buff timing, reactions,
// refresh, scales).

import { basename, join } from "node:path";
import { command } from "../command.ts";
import { fixtureTiming, formatTimingReport } from "../bufftiming.ts";
import { exportHits, exportHitsParallel, formatRecord, type HitRecord } from "../hitexport.ts";
import { checkLog, engineHits, engineReport, findScales, formatLogCheck, formatSimulatedLog, impliedScales, logBuffReplay, simulateLog } from "../logcheck.ts";
import { importBattle, LOG_DIRS, logFixtureFiles, readDevFixture, readLogFixture, readLogSplit, refreshFixture, refuseHoldoutFile } from "../logs.ts";
import { formatLogList, logDirs } from "../logtools.ts";
import { checkReactions, formatReactionCheck } from "../reactioncheck.ts";
import { battleIdOf, cacheRawDetail, formatRaw, rawDetail, rawDir } from "../zmdraw.ts";
import { ROOT } from "./shared.ts";

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
      return lines.join("\n");
    }
    if (sub === "timing") {
      const start = performance.now();
      const sel = timingFixtures(args.slice(1));
      const reports = sel.files.map((f) => {
        process.stderr.write(`timing ${basename(f)}\n`);
        return fixtureTiming(data(), readLogFixture(f), { assumed: values.assumed, pairs: !values.singles });
      });
      return formatTimingReport(data(), reports, { verbose: values.verbose, skipped: sel.skipped, seconds: (performance.now() - start) / 1000, ...(values.top !== undefined ? { top: Number(values.top) } : {}) });
    }
    if ((sub === "scales" || sub === "find-scales") && arg && op) {
      const fx = readDevFixture(arg);
      const lines: string[] = [];
      if (sub === "scales") {
        for (const r of impliedScales(data(), fx, op)) {
          const s = r.bySkillType;
          lines.push(`${r.event} t=${r.t}${r.unquantified.length ? ` [${r.unquantified.join(",")}]` : ""} crit=${r.crit} value=${r.value}` +
            ` basic=${s.basic.toFixed(4)} battle=${s.battle.toFixed(4)} combo=${s.combo.toFixed(4)} ultimate=${s.ultimate.toFixed(4)}`);
        }
      } else {
        for (const m of findScales(data(), fx, op)) {
          lines.push(`${m.event} (${m.hits} hits)`);
          for (const x of m.matches) lines.push(`   ${x.agree}/${m.hits}  ${x.skillId} ${x.keys.join(" * ")} ${x.damageType}${x.corrosion ? ` corrosion L${x.corrosion}` : ""}`);
        }
      }
      return lines.join("\n");
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
      if (values.simulate) return formatSimulatedLog(data(), fx, simulateLog(data(), fx));
      const replay = values["log-buffs"] ? null : logBuffReplay(data(), fx);
      const byHit = replay ? engineHits(data(), fx, replay) : undefined;
      const verdicts = checkLog(data(), fx, replay ? { replay, ...(byHit ? { engineHits: byHit } : {}) } : { buffs: "log" });
      return formatLogCheck(data(), fx, verdicts, replay ?? undefined, replay && byHit ? engineReport(data(), fx, replay, byHit, verdicts) : undefined);
    }
    const file = await importBattle(data(), arg, values["enemy-level"] === undefined ? undefined : Number(values["enemy-level"]), values.note, values.detail, (d) => cacheRawDetail(arg, d));
    return `wrote ${file}`;
  },
});
