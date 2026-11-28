// Natural skill-SP triggers against the log: per development log and wielder of Thermite Cutter (wpn_sword_0012), OBJ
// Edge of Lightness (wpn_sword_0019) or Frontiers (suit_atb01, 3 pieces), the replay's firings of the SP trigger
// against the log's distinct starts of the buff it makes (listed per application), and the replay's SP just before
// each firing: is a firing the log doesn't show one at the SP cap (a grant that obtains nothing)? Written 2026-11-28
// (Estella and Akekuri logs; open-problems "Akekuri: her SP grants and the buffs they make", in-game test 112): before
// the combo-SP fix 22 firings at the cap the log shows, 11 at the cap it doesn't, 43 below the cap it doesn't.
//
//   node scripts/probes/sp/spcap.ts [short id...]      (default: every development log; writes nothing)
import { loadGameData } from "@efsim/data";
import { spAt, secondsOf, SP } from "@efsim/engine";
import { devFixtures, logBuffReplay } from "@efsim/logs";

const msOf = (f: number) => secondsOf(f) * 1000;

const data = loadGameData();
const ids = process.argv.slice(2);
const WATCH = [
  { weapon: "wpn_sword_0012", trigger: "wpn_sword_0012.skill_sp", buff: "buff_wpn_sword_0012_atk_up" },
  { weapon: "wpn_sword_0019", trigger: "wpn_sword_0019.skill_sp", buff: "buff_wpn_sword_0019_up" },
  { gear: "suit_atb01", trigger: "suit_atb01.skill_sp", buff: "buff_equipsuit_combosuit_01_adddamage" },
];
const tally = { matchedCap: 0, matchedBelow: 0, replayOnlyCap: 0, replayOnlyBelow: 0, logOnly: 0 };
for (const { short, fx } of devFixtures(ids.length ? { ids } : {})) {
  const specs: { op: string; trigger: string; buff: string }[] = [];
  for (const m of fx.team) {
    for (const w of WATCH) {
      const has = w.weapon ? m.weapon?.id === w.weapon : (m.gear ?? []).filter((g: { id: string }) => g.id.includes(`suit_${w.gear!.replace(/^suit_/, "")}`)).length >= 3;
      if (has) specs.push({ op: m.operator, trigger: w.trigger, buff: w.buff });
    }
  }
  if (!specs.length) continue;
  const { replay } = logBuffReplay(data, fx, { trace: specs.map((s) => `trigger:${s.op}:${s.trigger}`) });
  for (const s of specs) {
    const key = `${s.op}:${s.trigger}`;
    const fired: number[] = [];
    for (const t of replay.triggerTraces) if (t.key === key && (t.from === null || t.to.count > t.from.count)) fired.push(t.frame);
    const sinces = new Set<number>();
    for (const h of fx.hits) for (const e of [...(h.effects ?? []), ...(h.boundaryEffects ?? [])]) if (e.source === s.op && e.buff === s.buff && e.since !== undefined) sinces.add(e.since);
    const logged = [...sinces].sort((a, b) => a - b);
    const used = new Set<number>();
    const rows: string[] = [];
    for (const f of [...new Set(fired)].sort((a, b) => a - b)) {
      const st = replay.stateAt(Math.max(0, f - 1));
      const sp = st ? spAt(st, Math.max(0, f - 1)) : NaN;
      const ms = msOf(f);
      const near = logged.find((t) => !used.has(t) && Math.abs(t - ms) <= 400);
      const cap = sp >= SP.max - 0.5;
      if (near !== undefined) { used.add(near); if (cap) tally.matchedCap++; else tally.matchedBelow++; if (cap) rows.push(`    ${(ms / 1000).toFixed(2)} both, SP ${sp.toFixed(0)} (at the cap)`); }
      else { if (cap) tally.replayOnlyCap++; else tally.replayOnlyBelow++; rows.push(`    ${(ms / 1000).toFixed(2)} replay only, SP ${sp.toFixed(0)}${cap ? " (at the cap)" : ""}`); }
    }
    const logOnly = logged.filter((t) => !used.has(t));
    tally.logOnly += logOnly.length;
    process.stdout.write(`${short} ${s.op} ${s.trigger}: replay ${new Set(fired).size}, log ${logged.length}, log only ${logOnly.map((t) => (t / 1000).toFixed(2)).join(" ") || "-"}\n${rows.join("\n")}${rows.length ? "\n" : ""}`);
  }
}
process.stdout.write(`tally ${JSON.stringify(tally)}\n`);
