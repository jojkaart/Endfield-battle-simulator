// Probe (scripts/probes/README.md): Yinglung's Edge rounds (2026-11-22, 2026-11-23): node scripts/probes/edge/edge-export.ts > scratch/edge-all.json, then python3 -I scripts/probes/edge/edge-score.py.
// Promoted from that round's scratch/edge-export.ts unchanged but for this header; run it from the repository root.
// Per Type 50 Yinglung's Edge wearer combo in the development logs: the engine's layers, the layers the combo's
// damage implies under the log's own reading (every listed buff as the log lists it; the unlisted consumed buffs
// Edge and Jade Vessel's next-combo DMG out), and every cast instance of the fight (for the hypotheses).
// node scratch/edge-export.ts > scratch/edge.json
import { loadGameData } from "@efsim/data";
import { landingDamage, readingDoesNotApply, kitBuffModifiers } from "@efsim/engine";
import { devFixtures, engineCheck, hitPlace, logBuffReplay, loggedSkillInstances, placeHits, readingBasis, teamPanels } from "@efsim/logs";

const data = loadGameData();
const out: unknown[] = [];
const only = process.argv.slice(2);
for (const { short, fx, dir } of devFixtures()) {
  if (only.length && !only.includes(short)) continue;
  const wearers = fx.team.filter((b) => (b.gear ?? []).filter((g) => g.id.includes("suit_atk02")).length >= 3).map((b) => b.operator);
  if (!wearers.length) continue;
  const placement = placeHits(data, fx);
  const replay = logBuffReplay(data, fx, placement);
  const c = engineCheck(data, fx, replay.replay);
  const inst = loggedSkillInstances(data, fx, { placement });
  const panels = teamPanels(data, fx).panels;
  const combos: unknown[] = [];
  for (const w of wearers) {
    const build = fx.team.find((b) => b.operator === w)!;
    const panel = panels.get(w)!.panel;
    let jv = 0;
    try {
      jv = kitBuffModifiers(data, build, panel, "wpn_claym_0018.combo_ready", 1).reduce((s, m) => s + m.value, 0);
    } catch {
      jv = 0;
    }
    for (const i of inst.filter((x) => x.operator === w && x.kind === "combo" && x.from === "hits")) {
      const hits = fx.hits.filter((h) => h.operator === w && i.keys.includes(h.event) && h.t >= (i.firstHit ?? 0) && h.t <= (i.lastHit ?? 0));
      const rows: unknown[] = [];
      for (const hit of hits) {
        const basis = readingBasis(c, hit, hitPlace(data, fx, placement, replay, hit));
        if ("unknown" in basis.landing) {
          rows.push({ t: hit.t, unknown: basis.landing.unknown });
          continue;
        }
        const ok = basis as Exclude<typeof basis, { readonly landing: { readonly unknown: string } }>;
        try {
          const p = landingDamage(data, c.target, ok.primary.inputs, ok.primary.options, ok.primary.other);
          const lr = ok.logReading();
          const l = landingDamage(data, c.target, lr.inputs, lr.options, lr.other);
          const edgeE = p.modifiers.filter((m) => m.kitBuff?.id === "suit_atk02.edge").reduce((s, m) => s + m.value, 0);
          const jvE = p.modifiers.filter((m) => m.kitBuff?.id === "wpn_claym_0018.combo_ready").reduce((s, m) => s + m.value, 0);
          const edgeL = l.modifiers.filter((m) => m.kitBuff?.id === "suit_atk02.edge").reduce((s, m) => s + m.value, 0);
          rows.push({
            t: hit.t, value: hit.value, crit: hit.crit, event: hit.event,
            primary: p.exact, logExact: l.exact, dbP: p.zones.damageBonus, dbL: l.zones.damageBonus,
            edgeE, jvE, edgeL, zonesP: p.zones, zonesL: l.zones,
            listed: hit.effects.map((e) => e.buff),
          });
        } catch (err) {
          if (!readingDoesNotApply(err)) throw err;
          rows.push({ t: hit.t, unknown: "no reading" });
        }
      }
      combos.push({ wearer: w, start: i.start, firstHit: i.firstHit, lastHit: i.lastHit, jv, rows });
    }
  }
  out.push({
    short, dir, wearers, team: fx.team.map((b) => b.operator),
    instances: inst.map((i) => ({ op: i.operator, skill: i.skillId, kind: i.kind, start: i.start, firstHit: i.firstHit, lastHit: i.lastHit, hits: i.hits, keys: i.keys, events: i.events, from: i.from })),
    casts: fx.casts ?? [],
    combos,
  });
  process.stderr.write(`${short} ${wearers.join(",")}\n`);
}
process.stdout.write(JSON.stringify(out));
process.stdout.write("\n");
