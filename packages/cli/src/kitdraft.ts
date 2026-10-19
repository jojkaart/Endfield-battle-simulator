// efsim kit-draft (v2): a kit skeleton in the current kit format, compiled
// from the operator's SkillData (packages/data skillCompile.ts): hits with
// frames, counts, log event keys, factors, inflictions, energy, SP,
// detached and Final Strike per landing; the skill's team-energy frame and
// energy block. What the compiler can't decide (branches, jumps, event-driven
// hits) goes into notes. Ends with which of its event keys appear in the log
// fixtures.

import type { GameData } from "@efsim/engine";
import { compileSkill, formatCompiledValue, prefixOf, type CompiledCost, type CompiledEffect, type CompiledLanding, type CompiledSkill, type CompiledValue, type Placement } from "@efsim/data";

const FPS = 30;
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Puts arrays of plain values (frames, keys, events) on one line. */
const compactArrays = (text: string) => text.replace(/\[\n\s+([^[\]{}]*?)\n\s*\]/g, (_m, inner: string) => `[${inner.split(/,\n\s+/).join(", ")}]`);

/** A value as a kit ValueExpr: a key, key × literal, a product of keys, or a literal; null when it's an expression. */
function valueExpr(v: CompiledValue, coefficient = 1): Json | null {
  if (v.expr) return null;
  const factor = round(v.factor * coefficient, 9);
  if (v.keys.length === 0) return v.value === null ? null : round(v.value * coefficient, 9);
  const terms: Json[] = [...v.keys, ...(factor === 1 ? [] : [factor])];
  return terms.length === 1 ? (terms[0] as Json) : { product: terms };
}

/** Whether a fact goes with a landing: the one the compiler linked it to, or an alternative of it (same file and frame, one branch inside the other). */
const goesWith = (p: Placement & { landing: number | null }, l: CompiledLanding, all: readonly CompiledLanding[]) => {
  const anchor = p.landing === null ? undefined : all[p.landing];
  return !!anchor && anchor.file === l.file && anchor.frame === l.frame && (prefixOf(l.branch, p.branch) || prefixOf(p.branch, l.branch));
};

const placeText = (p: Placement) => `f${p.frame} ${p.file}${p.branch.length ? ` (${p.branch.join(", ")})` : ""}`;

function application(e: CompiledEffect): { app: Json | null; note: string | null } {
  switch (e.kind) {
    case "infliction":
      return { app: { kind: "infliction", element: e.element }, note: e.isExtra ? "infliction isExtra" : null };
    case "forcedReaction": {
      if (!e.status) return { app: null, note: `forced reaction of unknown status (${e.source})` };
      const level = e.level && e.level.keys.length === 0 && e.level.value !== null && e.level.value >= 1 && e.level.value <= 4 ? Math.round(e.level.value) : null;
      return {
        app: { kind: "forcedReaction", status: e.status, ...(level !== null ? { level } : {}) },
        note: `forced ${e.status} by ${e.source}${e.level && level === null ? `, level from ${formatCompiledValue(e.level)}` : ""}${e.duration ? `, duration ${formatCompiledValue(e.duration)}` : ""}`,
      };
    }
    case "consumeInfliction": {
      if (!e.element) return { app: null, note: `consumes buffs with tags ${e.tags.join(", ")}` };
      const stacks = e.layers ? valueExpr(e.layers) : null;
      return { app: { kind: "consumeInfliction", elements: [e.element], ...(stacks !== null ? { stacks } : {}) }, note: null };
    }
    case "burst":
      return { app: null, note: `${e.element ?? "?"} burst by ${e.source} (a reaction-type hit: see the kit's reaction field)` };
  }
}

const costText = (c: CompiledCost) => `${c.costType === 0 ? "energy" : "SP"} ${formatCompiledValue(c.value)}${c.coefficient !== 1 ? ` × ${round(c.coefficient, 6)}` : ""}${c.isPercent ? " (percent)" : ""}`;

function draftHits(c: CompiledSkill, skillType: string, logged: ReadonlyMap<string, number>) {
  const skillId = c.skillId;
  const fsFiles = new Set(c.landings.filter((l) => l.finalStrike).map((l) => l.file));
  type Entry = { sig: string; landings: CompiledLanding[]; hit: Record<string, Json>; notes: string[] };
  const groups: Entry[] = [];
  const used = new Set<object>();
  for (const l of c.landings) {
    const apps: Json[] = [];
    const notes: string[] = [];
    for (const e of c.effects) {
      if (!goesWith(e, l, c.landings)) continue;
      used.add(e);
      const a = application(e);
      if (a.app) apps.push(a.app);
      if (a.note) notes.push(a.note);
      if (e.branch.length > l.branch.length) notes.push(`${e.kind} only ${e.branch.slice(l.branch.length).join(", ")}`);
    }
    const cost = (type: 0 | 1) => {
      const list = (type === 0 ? c.energy : c.sp).filter((x) => goesWith(x, l, c.landings));
      for (const x of list) used.add(x);
      const first = list[0];
      if (!first) return null;
      if (list.length > 1) notes.push(`${list.length} ${type === 0 ? "energy" : "SP"} grants here: ${list.map(costText).join("; ")}`);
      if (first.branch.length > l.branch.length) notes.push(`${costText(first)} only ${first.branch.slice(l.branch.length).join(", ")}`);
      if (first.isPercent) notes.push(`${costText(first)}: a percentage`);
      const v = valueExpr(first.value, first.coefficient);
      if (v === null) notes.push(`${costText(first)}: not a kit value`);
      return v;
    };
    const energy = cost(0);
    const sp = cost(1);
    const scale = l.scale.keys.length ? [...l.scale.keys] : [l.scale.expr ?? `LITERAL_${l.scale.value ?? 0}`];
    if (l.scale.expr) notes.push(`scale is ${l.scale.expr}: not key × literal (write it by hand)`);
    else if (l.scale.keys.length === 0) notes.push(`scale is the literal ${l.scale.value ?? "?"}`);
    const foreign = l.scale.keys.filter((_, i) => l.scale.origins[i] !== skillId);
    if (foreign.length) notes.push(`${foreign.join(", ")} from ${[...new Set(l.scale.origins.filter((o) => o !== skillId))].join(", ")}'s blackboard (not passed down by ${skillId})`);
    const factor = round(l.scale.factor, 9);
    const finalStrike = l.finalStrike ? true : fsFiles.has(l.file) ? false : null;
    const sig = JSON.stringify([l.file, scale, factor, l.decorateMask, finalStrike, l.branch, apps, energy, sp, l.detached, notes]);
    let g = groups.find((x) => x.sig === sig);
    if (!g) {
      const hit: Record<string, Json> = { scale };
      g = { sig, landings: [], hit, notes };
      if (factor !== 1) hit["factor"] = factor;
      if (apps.length) hit["applies"] = apps;
      if (energy !== null) hit["energy"] = energy;
      if (sp !== null) hit["sp"] = sp;
      if (l.detached) hit["detached"] = true;
      if (finalStrike !== null) hit["finalStrike"] = finalStrike;
      groups.push(g);
    }
    g.landings.push(l);
  }
  const ids = new Set<string>();
  const hits = groups.map((g) => {
    const first = g.landings[0] as CompiledLanding;
    const frames = g.landings.map((l) => l.frame).sort((a, b) => a - b);
    const base = (first.file === skillId ? "hit" : first.file.startsWith(`${skillId}_`) ? first.file.slice(skillId.length + 1) : first.file.replace(/^buff_/, "")).replace(/[^a-z0-9_]/gi, "_");
    let id = base;
    for (let k = 2; ids.has(id); k++) id = `${base}_${k}`;
    ids.add(id);
    const kind = first.kind ?? "none";
    const note = [
      `${frames.length} landing(s) in ${first.file}${first.via.length ? ` (first via ${first.via.join("; ")})` : ""}`,
      `mask ${first.decorateMask} (${kind}${kind !== skillType ? `, skill is ${skillType}` : ""})`,
      ...(first.branch.length ? [`only ${first.branch.join(", ")}`] : []),
      ...g.notes,
      `logged ${logged.get(first.file) ?? 0}×`,
    ].join("; ");
    const { scale, ...rest } = g.hit;
    return { id, scale: scale as Json, ...(frames.length > 1 ? { count: frames.length } : {}), frames, events: [first.file], ...rest, note } as Record<string, Json>;
  });
  return { hits, used };
}

function draftSkill(c: CompiledSkill, groupType: string, logged: ReadonlyMap<string, number>, operator: string): Record<string, Json> {
  const kinds = new Set(c.landings.map((l) => l.kind));
  const only = kinds.size === 1 ? [...kinds][0] : undefined;
  const damageType = only ?? (["basic", "battle", "combo", "ultimate"].includes(groupType) ? groupType : "basic");
  const { hits, used } = draftHits(c, damageType, logged);
  const notes: string[] = [];
  if (only && only !== groupType) notes.push(`damageType ${only} from the decorate masks; the skill's group is ${groupType}`);
  const team = c.teamEnergy.filter((t) => t.branch.length === 0);
  // Each unconditional part at its frame, its ratio of the energy (the whole when the parts don't say).
  let parts = team.map((t) => ({ frame: t.frame, ratio: t.ratio ?? 1 }));
  if (parts.reduce((x, t) => x + t.ratio, 0) > 1 + 1e-9) {
    notes.push(`team energy created ${team.length}× (frames ${team.map((t) => t.frame).join(", ")}), more than the whole; the first is used`);
    parts = parts.slice(0, 1).map((t) => ({ ...t, ratio: 1 }));
  }
  const teamEnergy = parts.length && !(parts.length === 1 && parts[0]?.frame === 0 && parts[0].ratio === 1) ? parts : undefined;
  if (team.some((t) => t.ratio === null)) notes.push(`team energy ratio not a literal at ${team.filter((t) => t.ratio === null).map(placeText).join("; ")} (1 assumed)`);
  const conditional = c.teamEnergy.filter((t) => t.branch.length > 0);
  if (conditional.length) notes.push(`team energy (buff_common_obtain_ultimate_sp) also conditionally: ${conditional.map((t) => `${placeText(t)} ratio ${t.ratio ?? "?"}`).join("; ")}`);
  const blocks = c.energyBlocks.filter((b) => b.branch.length === 0 && b.until !== null);
  const energyBlockSeconds = blocks.length ? round(Math.max(...blocks.map((b) => b.until as number)) / FPS) : undefined;
  if (blocks.length) notes.push(`energy blocked by ${blocks.map((b) => `${b.buff ?? "the skill's RefrainObtainUsp"} f${b.frame}–${b.until}`).join(", ")}`);
  const condBlocks = c.energyBlocks.filter((b) => b.branch.length > 0 || b.until === null);
  if (condBlocks.length) notes.push(`${condBlocks.length} more energy block(s), conditional or unbounded: ${[...new Set(condBlocks.map((b) => `${b.buff ?? "skill"}${b.until === null ? " (until ended)" : ""}${b.branch.length ? ` (${b.branch.join(", ")})` : ""}`))].slice(0, 4).join("; ")}`);
  for (const e of c.effects) if (!used.has(e)) notes.push(`${e.kind} at ${placeText(e)} with no landing: ${application(e).note ?? JSON.stringify(application(e).app)}`);
  for (const x of [...c.energy, ...c.sp]) if (!used.has(x)) notes.push(`${costText(x)} at ${placeText(x)} with no landing`);
  for (const j of c.jumps) notes.push(`JumpToAction at ${placeText(j)} → frame ${j.destFrame} (${j.condition}); not followed`);
  for (const k of c.casts) notes.push(`casts ${k.skillId} at ${placeText(k)}${k.followed ? " (compiled into this skill)" : ""}`);
  return {
    skillId: c.skillId,
    label: c.skillId.replace(`${operator}_`, ""),
    damageType,
    ...(teamEnergy ? { teamEnergy } : {}),
    ...(energyBlockSeconds ? { energyBlockSeconds } : {}),
    ...(notes.length ? { note: notes.join(" | ") } : {}),
    hits,
  };
}

export function kitDraft(data: GameData, operator: string, loggedEvents: ReadonlyMap<string, number>): string {
  const op = data.operators[operator];
  if (!op) throw new Error(`unknown operator ${operator}`);
  const top = new Set(Object.keys(op.skillGroups));
  const skills: Record<string, Json>[] = [];
  const empty: string[] = [];
  const covered = new Set<string>();
  for (const id of [...top].sort()) {
    const values = data.skills[id]?.levels.at(-1)?.blackboard;
    const c = compileSkill(id, { followCast: (s) => !top.has(s), ...(values ? { values } : {}) });
    if (!c || (c.landings.length === 0 && c.energy.length === 0 && c.teamEnergy.length === 0 && c.energyBlocks.length === 0)) {
      empty.push(c ? id : `${id} (no SkillData file)`);
      continue;
    }
    for (const l of c.landings) covered.add(l.file);
    skills.push(draftSkill(c, op.skillGroups[id] ?? "basic", loggedEvents, operator));
  }
  const kit = {
    $schema: "../../../../schemas/kit.schema.json",
    operator,
    sources: [`Draft compiled from rmxlinux Json/SkillData ${operator}_* and the files they reach by efsim kit-draft v2 (packages/data skillCompile.ts; timing values at each skill's highest level); verify against log fixtures and descriptions.`],
    ...(op.element ? { element: op.element } : {}),
    skills,
  };
  const lines = [compactArrays(JSON.stringify(kit, null, 2))];
  const notInDraft = [...loggedEvents].filter(([e]) => !covered.has(e));
  if (empty.length) lines.push("", "// Skills with nothing compiled (no damage, energy or blocks):", ...empty.map((s) => `//   ${s}`));
  if (notInDraft.length) lines.push("", "// Logged event keys not in the draft:", ...notInDraft.map(([e, n]) => `//   ${e} ×${n}`));
  return lines.join("\n");
}
