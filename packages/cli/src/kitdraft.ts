// efsim kit-draft (v2): a kit skeleton in the current kit format, compiled
// from the operator's SkillData (packages/data skillCompile.ts): hits with
// frames, counts, log event keys, factors, element, stagger, bonuses,
// inflictions, forced reactions and physical statuses, energy, SP, detached
// and Final Strike per landing; alternatives of one landing as `branch` hits,
// conditions the compiler can say as `if`; the skill's team-energy frame and
// energy block; what happens with no landing (energy, a hitless skill's SP,
// applications) as cast triggers. What the compiler can't decide (other
// conditions, jumps, event-driven hits) goes into notes, with the buffs each
// skill creates and on whom. Ends with which of its event keys appear in the
// log fixtures.

import type { GameData, Predicate } from "@efsim/engine";
import { allOf, compileSkill, formatCompiledValue, prefixOf, type BranchStep, type CompiledCost, type CompiledEffect, type CompiledJump, type CompiledLanding, type CompiledPoiseLanding, type CompiledSkill, type CompiledValue, type Placement } from "@efsim/data";

const FPS = 30;
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Puts arrays of plain values (frames, keys, events) on one line. */
const compactArrays = (text: string) => text.replace(/\[\n\s+([^[\]{}]*?)\n\s*\]/g, (_m, inner: string) => `[${inner.split(/,\n\s+/).join(", ")}]`);

/** A value as a kit ValueExpr: a key, key × literal, a product of keys, or a literal; null when it's an expression. Literals are rounded to 6 places (the data's are float32: 0.300000012). */
function valueExpr(v: CompiledValue, coefficient = 1): Json | null {
  if (v.expr) return null;
  const factor = round(v.factor * coefficient, 6);
  if (v.keys.length === 0) return v.value === null ? null : round(v.value * coefficient, 6);
  const terms: Json[] = [...v.keys, ...(factor === 1 ? [] : [factor])];
  return terms.length === 1 ? (terms[0] as Json) : { product: terms };
}

/** The single key a value is (factor 1), or null. */
const singleKey = (v: CompiledValue | null | undefined): string | null => (v && !v.expr && v.keys.length === 1 && v.factor === 1 ? (v.keys[0] as string) : null);

/** Whether a fact goes with a landing: the one the compiler linked it to, or an alternative of it (same file and frame, one branch inside the other). */
const goesWith = (p: Placement & { landing: number | null }, l: CompiledLanding, all: readonly CompiledLanding[]) => {
  const anchor = p.landing === null ? undefined : all[p.landing];
  return !!anchor && anchor.file === l.file && anchor.frame === l.frame && (prefixOf(l.branch, p.branch) || prefixOf(p.branch, l.branch));
};

const placeText = (p: Placement) => `f${p.frame} ${p.file}${p.branch.length ? ` (${p.branch.join(", ")})` : ""}`;

/** The predicate for conditions beyond the ones a fact shares with its landing; undefined when there are none, null when one can't be said as a predicate. */
function extraPred(steps: readonly BranchStep[], from: number): Predicate | null | undefined {
  const extra = steps.slice(from);
  return extra.length ? allOf(extra.map((s) => s.pred)) : undefined;
}

/** A value that applies only when `pred` holds (0 otherwise). */
const gated = (v: Json, pred: Predicate | undefined): Json => (pred && v !== 0 ? ({ if: pred as unknown as Json, then: v } as Json) : v);

function application(e: CompiledEffect): { app: Record<string, Json> | null; note: string | null } {
  switch (e.kind) {
    case "infliction":
      return { app: { kind: "infliction", element: e.element }, note: e.isExtra ? "infliction isExtra" : null };
    case "forcedReaction": {
      if (!e.status) return { app: null, note: `forced reaction of unknown status (${e.source})` };
      const notes: string[] = [];
      // The level: a literal count, or a key whose level value is a whole level (noted: potentials may change it).
      let level: number | null = null;
      if (e.level && !e.level.expr && e.level.value !== null && Number.isInteger(e.level.value) && e.level.value >= 1 && e.level.value <= 4) {
        level = e.level.value;
        if (e.level.keys.length) notes.push(`level ${level} from ${formatCompiledValue(e.level)}`);
      } else if (e.level) notes.push(`level from ${formatCompiledValue(e.level)}`);
      const durationKey = singleKey(e.duration);
      if (e.duration && !durationKey) notes.push(`duration ${formatCompiledValue(e.duration)}`);
      const scale = e.assigned["extra_scaling"];
      const scaleKey = singleKey(scale);
      if (scale && !scaleKey) notes.push(`extra_scaling ${formatCompiledValue(scale)}`);
      const others = Object.entries(e.assigned).filter(([k]) => k !== "extra_scaling");
      if (others.length) notes.push(`also assigned ${others.map(([k, v]) => `${k} = ${formatCompiledValue(v)}`).join(", ")}`);
      return {
        app: { kind: "forcedReaction", status: e.status, ...(level !== null ? { level } : {}), ...(durationKey ? { durationKey } : {}), ...(scaleKey ? { scaleKey } : {}) },
        note: `forced ${e.status} by ${e.source}${notes.length ? `: ${notes.join("; ")}` : ""}`,
      };
    }
    case "consumeInfliction": {
      if (!e.element) return { app: null, note: `consumes buffs with tags ${e.tags.join(", ")}` };
      const stacks = e.layers ? valueExpr(e.layers) : null;
      return { app: { kind: "consumeInfliction", elements: [e.element], ...(stacks !== null ? { stacks } : {}) }, note: null };
    }
    case "burst":
      return { app: null, note: `${e.element ?? "?"} burst by ${e.source} (a reaction-type hit: see the kit's reaction field)` };
    case "physicalStatus": {
      const notes: string[] = [];
      const multiplierKey = singleKey(e.multiplier);
      if (e.multiplier && !multiplierKey && !(e.multiplier.keys.length === 0 && e.multiplier.value === 1)) notes.push(`Crush damageMultiplier ${formatCompiledValue(e.multiplier)}`);
      if (e.isExtra) notes.push(`${e.status} isExtra`);
      return { app: { kind: "physicalStatus", status: e.status, ...(e.forced ? { forced: true } : {}), ...(multiplierKey ? { multiplierKey } : {}) }, note: notes.length ? notes.join("; ") : null };
    }
    case "vulnerable": {
      const n = e.stacks.keys.length === 0 && !e.stacks.expr ? e.stacks.value : null;
      if (n === null || !Number.isInteger(n) || n < 1 || n > 4) return { app: { kind: "vulnerable" }, note: `Vulnerable stacks ${formatCompiledValue(e.stacks)}` };
      return { app: { kind: "vulnerable", ...(n !== 1 ? { stacks: n } : {}) }, note: null };
    }
  }
}

const costText = (c: CompiledCost) => `${c.costType === 0 ? "energy" : "SP"} ${formatCompiledValue(c.value)}${c.coefficient !== 1 ? ` × ${round(c.coefficient, 6)}` : ""}${c.isPercent ? " (percent)" : ""}`;

/** Which alternatives each choice site has with landings (BranchStep.site → alts). */
function siteAlternatives(landings: readonly CompiledLanding[]): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>();
  for (const l of landings) for (const s of l.steps) if (s.site !== null) out.set(s.site, new Set([...(out.get(s.site) ?? []), s.alt]));
  return out;
}

/** The ability-event handler a landing is dealt in (compiler step "on ability event N"), or undefined. */
const eventStep = (l: Placement) => l.steps.find((s) => s.site === null && s.label.startsWith("on ability event "));

function draftHits(c: CompiledSkill, skillType: string, logged: ReadonlyMap<string, number>, element: string | undefined) {
  const skillId = c.skillId;
  const fsFiles = new Set(c.landings.filter((l) => l.finalStrike).map((l) => l.file));
  type Entry = { sig: string; landings: CompiledLanding[]; hit: Record<string, Json>; notes: string[] };
  const groups: Entry[] = [];
  const used = new Set<object>();
  // Landings an ability event handler deals (a Final Strike's event 302, a crit's 43): triggers to write, not hits at fixed frames.
  const byEvent: CompiledLanding[] = [];
  for (const l of c.landings) {
    if (eventStep(l)) {
      byEvent.push(l);
      continue;
    }
    const apps: Json[] = [];
    const notes: string[] = [];
    for (const e of c.effects) {
      if (!goesWith(e, l, c.landings)) continue;
      used.add(e);
      const a = application(e);
      const pred = extraPred(e.steps, l.steps.length);
      if (a.app) apps.push(pred ? { ...a.app, if: pred as unknown as Json } : a.app);
      if (a.note) notes.push(a.note);
      if (pred === null) notes.push(`${e.kind} only ${e.branch.slice(l.branch.length).join(", ")}`);
    }
    const cost = (type: 0 | 1) => {
      const list = (type === 0 ? c.energy : c.sp).filter((x) => goesWith(x, l, c.landings));
      for (const x of list) used.add(x);
      const first = list[0];
      if (!first) return null;
      if (list.length > 1) notes.push(`${list.length} ${type === 0 ? "energy" : "SP"} grants here: ${list.map(costText).join("; ")}`);
      const extra = extraPred(first.steps, l.steps.length);
      if (extra === null) notes.push(`${costText(first)} only ${first.branch.slice(l.branch.length).join(", ")}`);
      if (first.isPercent) notes.push(`${costText(first)}: a percentage`);
      if (type === 1 && first.beforeDamage) spBefore = true;
      const v = valueExpr(first.value, first.coefficient);
      if (v === null) notes.push(`${costText(first)}: not a kit value`);
      // atbOnlyMainChar: only while controlled.
      const controlled: Predicate = { controlled: true };
      const said = (p: Predicate) => JSON.stringify(p) === JSON.stringify(controlled) || ("all" in p && p.all.some((q) => JSON.stringify(q) === JSON.stringify(controlled)));
      const pred = first.controlledOnly && !(extra && said(extra)) && !l.steps.some((s) => s.pred && said(s.pred)) ? (extra ? allOf([extra, controlled]) : controlled) : extra;
      return v === null ? null : gated(v, pred ?? undefined);
    };
    let spBefore = false;
    const energy = cost(0);
    const sp = cost(1);
    // Whom it heals (HealAction at this landing): an event for heal triggers.
    const healsHere = c.heals.filter((x) => goesWith(x, l, c.landings));
    for (const x of healsHere) used.add(x);
    const heals = healsHere.find((x) => x.target !== "unknown")?.target ?? null;
    if (healsHere.some((x) => x.target === "unknown")) notes.push("a heal of an unknown target here");
    const scale = l.scale.keys.length ? [...l.scale.keys] : [l.scale.expr ?? `LITERAL_${l.scale.value ?? 0}`];
    if (l.scale.expr) notes.push(`scale is ${l.scale.expr}: not key × literal (write it by hand)`);
    else if (l.scale.keys.length === 0) notes.push(`scale is the literal ${l.scale.value ?? "?"}`);
    const foreign = l.scale.keys.filter((_, i) => l.scale.origins[i] !== skillId);
    if (foreign.length) notes.push(`${foreign.join(", ")} from ${[...new Set(l.scale.origins.filter((o) => o !== skillId))].join(", ")}'s blackboard (not passed down by ${skillId})`);
    const factor = round(l.scale.factor, 6);
    const finalStrike = l.finalStrike ? true : fsFiles.has(l.file) ? false : null;
    const poise = l.poise ? valueExpr(l.poise.value) : null;
    if (l.poise && poise === null) notes.push(`stagger ${formatCompiledValue(l.poise.value)}: not a kit value`);
    const hitElement = l.element && l.element !== element ? l.element : null;
    if (!l.element) notes.push(`damageType ${l.damageType}: no element`);
    const bonuses: Json[] = [];
    for (const b of l.bonuses) {
      const key = singleKey(b.value);
      if (key) bonuses.push({ zone: b.zone, key });
      else notes.push(`${b.zone} bonus ${formatCompiledValue(b.value)} (not a key: write it by hand)`);
    }
    const hitIf = l.steps.length ? allOf(l.steps.map((s) => s.pred)) : null;
    // A landing whose decorate mask lacks its skill's kind bit takes another type's bonus (none without a kind bit).
    const hitType = l.kind !== skillType ? (l.kind ?? "none") : null;
    const sig = JSON.stringify([l.file, scale, factor, l.decorateMask, finalStrike, l.branch, apps, energy, sp, heals, l.detached, poise, l.poise?.controlledOnly ?? false, hitElement, bonuses, notes]);
    let g = groups.find((x) => x.sig === sig);
    if (!g) {
      const hit: Record<string, Json> = { scale };
      g = { sig, landings: [], hit, notes };
      if (hitIf) hit["if"] = hitIf as unknown as Json;
      if (hitElement) hit["element"] = hitElement;
      if (hitType) hit["damageType"] = hitType;
      if (factor !== 1) hit["factor"] = factor;
      if (bonuses.length) hit["bonuses"] = bonuses;
      if (apps.length) hit["applies"] = apps;
      if (energy !== null) hit["energy"] = energy;
      if (sp !== null) hit["sp"] = sp;
      if (sp !== null && spBefore) hit["spBeforeDamage"] = true;
      if (heals) hit["heals"] = heals;
      if (poise !== null) hit["poise"] = poise;
      if (l.poise?.controlledOnly) hit["poiseControlledOnly"] = true;
      if (l.detached) hit["detached"] = true;
      if (finalStrike !== null) hit["finalStrike"] = finalStrike;
      groups.push(g);
    }
    g.landings.push(l);
  }

  // Alternatives of one landing: a choice site each of whose sides with landings is exactly one hit, all landing equally often, becomes a `branch`.
  const alts = siteAlternatives(c.landings);
  const stepsOf = (g: Entry) => (g.landings[0] as CompiledLanding).steps;
  const branchOf = new Map<Entry, number>();
  const valid = new Map<number, boolean>();
  for (const [site, sides] of alts) {
    if (sides.size < 2) continue;
    const members = groups.filter((g) => stepsOf(g).some((s) => s.site === site));
    const bySide = new Map<number, Entry[]>();
    for (const g of members) {
      const alt = (stepsOf(g).find((s) => s.site === site) as BranchStep).alt;
      bySide.set(alt, [...(bySide.get(alt) ?? []), g]);
    }
    valid.set(site, [...bySide.values()].every((gs) => gs.length === 1) && new Set(members.map((g) => g.landings.length)).size === 1);
  }
  for (const g of groups) {
    const s = stepsOf(g).find((x) => x.site !== null && valid.get(x.site) === true);
    if (s && s.site !== null) branchOf.set(g, s.site);
    else if (stepsOf(g).some((x) => x.site !== null && valid.get(x.site) === false)) g.notes.push("an alternative of other hits here (no branch: its sides aren't one hit each landing equally often)");
  }
  const branchNames = new Map<number, string>();
  for (const [g, site] of branchOf) {
    if (branchNames.has(site)) continue;
    const base = `at${Math.min(...g.landings.map((l) => l.frame))}`;
    let name = base;
    for (let k = 2; [...branchNames.values()].includes(name); k++) name = `${base}_${k}`;
    branchNames.set(site, name);
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
    const site = branchOf.get(g);
    const unsaid = first.steps.length > 0 && !g.hit["if"];
    const note = [
      `${frames.length} landing(s) in ${first.file}${first.via.length ? ` (first via ${first.via.join("; ")})` : ""}`,
      `mask ${first.decorateMask} (${kind}${kind !== skillType ? `, skill is ${skillType}` : ""})`,
      ...(first.branch.length ? [`only ${first.branch.join(", ")}${unsaid ? (site !== undefined ? " (no kit condition: write its if, or the first alternative lands)" : " (no kit condition: lands always)") : ""}`] : []),
      ...g.notes,
      `logged ${logged.get(first.file) ?? 0}×`,
    ].join("; ");
    const { scale, if: hitIf, ...rest } = g.hit;
    return {
      id,
      ...(site !== undefined ? { branch: branchNames.get(site) as string } : {}),
      ...(hitIf !== undefined ? { if: hitIf } : {}),
      scale: scale as Json,
      ...(frames.length > 1 ? { count: frames.length } : {}),
      frames,
      events: [first.file],
      ...rest,
      note,
    } as Record<string, Json>;
  });
  // One note per handler, file and scale.
  const eventNotes = new Map<string, { label: string; frames: number[] }>();
  for (const l of byEvent) {
    const step = eventStep(l) as BranchStep;
    const key = `${step.label}: ${l.file} ${formatCompiledValue(l.scale)}`;
    const e = eventNotes.get(key) ?? { label: key, frames: [] };
    e.frames.push(l.frame);
    eventNotes.set(key, e);
  }
  const eventDriven = [...eventNotes.values()].map((e) => `event-driven landing (write a trigger: ${e.label.replace(/^on ability event (\d+)/, "ability event $1")}${e.frames.length > 1 ? `, ${e.frames.length} paths` : ""}; frames are lower bounds: ${[...new Set(e.frames)].slice(0, 4).join(", ")})`);
  return { hits, used, eventDriven };
}

/**
 * Stagger-only DamageActions (CompiledSkill.poiseOnly): one is folded into
 * the landing it goes with when that landing deals no stagger of its own
 * and the only extra condition is none or "controlled" (then
 * poiseControlledOnly, as CheckMainCharacterCondition gates it); the others
 * become poise-only hits of their own.
 */
function foldPoise(c: CompiledSkill): { skill: CompiledSkill; rest: CompiledPoiseLanding[] } {
  const landings = [...c.landings];
  const rest: CompiledPoiseLanding[] = [];
  for (const p of c.poiseOnly) {
    const l = p.landing === null ? undefined : landings[p.landing];
    const extra = l && prefixOf(l.branch, p.branch) ? p.steps.slice(l.steps.length) : null;
    const controlledGate = extra?.length === 1 && JSON.stringify(extra[0]?.pred) === JSON.stringify({ controlled: true });
    if (l && p.landing !== null && l.file === p.file && l.frame === p.frame && !l.poise && extra && (extra.length === 0 || controlledGate)) {
      landings[p.landing] = { ...l, poise: { value: p.poise.value, controlledOnly: p.poise.controlledOnly || controlledGate } };
    } else rest.push(p);
  }
  return { skill: { ...c, landings }, rest };
}

/** Poise-only landings that fold into no hit: hits with `poiseOnly`, alike ones grouped. */
function poiseHits(c: CompiledSkill, rest: readonly CompiledPoiseLanding[], taken: ReadonlySet<string>, logged: ReadonlyMap<string, number>): Record<string, Json>[] {
  const groups = new Map<string, CompiledPoiseLanding[]>();
  for (const p of rest) {
    const sig = JSON.stringify([p.file, formatCompiledValue(p.poise.value), p.poise.controlledOnly, p.branch, p.detached]);
    groups.set(sig, [...(groups.get(sig) ?? []), p]);
  }
  const ids = new Set(taken);
  return [...groups.values()].map((ps) => {
    const first = ps[0] as CompiledPoiseLanding;
    const frames = ps.map((p) => p.frame).sort((a, b) => a - b);
    const base = `${(first.file === c.skillId ? "hit" : first.file.startsWith(`${c.skillId}_`) ? first.file.slice(c.skillId.length + 1) : first.file.replace(/^buff_/, "")).replace(/[^a-z0-9_]/gi, "_")}_poise`;
    let id = base;
    for (let k = 2; ids.has(id); k++) id = `${base}_${k}`;
    ids.add(id);
    const pred = first.steps.length ? allOf(first.steps.map((s) => s.pred)) : null;
    const poise = valueExpr(first.poise.value);
    const notes = [
      `${frames.length} stagger-only landing(s) in ${first.file}${first.via.length ? ` (first via ${first.via.join("; ")})` : ""}: a DamageAction whose units are all stagger`,
      ...(first.branch.length ? [`only ${first.branch.join(", ")}${pred ? "" : " (no kit condition: lands always)"}`] : []),
      ...(poise === null ? [`stagger ${formatCompiledValue(first.poise.value)}: not a kit value`] : []),
      `logged ${logged.get(first.file) ?? 0}×`,
    ];
    return {
      id,
      ...(pred ? { if: pred as unknown as Json } : {}),
      scale: [],
      ...(frames.length > 1 ? { count: frames.length } : {}),
      frames,
      events: [first.file],
      poiseOnly: true,
      poise: poise ?? 0,
      ...(first.poise.controlledOnly ? { poiseControlledOnly: true } : {}),
      ...(first.detached ? { detached: true } : {}),
      note: notes.join("; "),
    };
  });
}

/** What a skill creates on whom, in short. */
function buffNotes(c: CompiledSkill): string[] {
  const out: string[] = [];
  const groups: [string, readonly string[]][] = [
    ["on the enemy", ["enemy"]],
    ["on its target (the enemy hit)", ["target"]],
    ["through an aura (on whoever is inside)", ["aura"]],
    ["on the team", ["team"]],
    ["on self", ["self"]],
    ["on an unknown target", ["unknown"]],
  ];
  for (const [label, targets] of groups) {
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const b of c.buffs) {
      if (!targets.includes(b.target) || seen.has(b.buff)) continue;
      seen.add(b.buff);
      // A clip shorter than the cast (autoFinishByAction): the kit's untilFrame.
      const until = b.untilFrame !== undefined && b.untilFrame < c.durationFrames ? [`untilFrame ${b.untilFrame} (autoFinishByAction)`] : [];
      const detail = [`f${b.frame}`, ...(b.seconds !== null ? [`${round(b.seconds, 3)} s`] : []), ...until, ...(b.summary ? [b.summary] : []), ...(b.branch.length ? [`only ${b.branch.join(", ")}`] : [])];
      parts.push(`${b.buff} (${detail.join("; ")})`);
    }
    if (parts.length) out.push(`creates ${label}: ${parts.join(", ")}`);
  }
  return out;
}

function draftSkill(compiled: CompiledSkill, groupType: string, logged: ReadonlyMap<string, number>, operator: string, element: string | undefined, timingJumps: readonly { at: number; to: number; conditional: boolean }[] = []): { skill: Record<string, Json>; triggers: Record<string, Json>[] } {
  const { skill: c, rest } = foldPoise(compiled);
  const kinds = new Set(c.landings.map((l) => l.kind));
  const only = kinds.size === 1 ? [...kinds][0] : undefined;
  const damageType = only ?? (["basic", "battle", "combo", "ultimate"].includes(groupType) ? groupType : "basic");
  const drafted = draftHits(c, damageType, logged, element);
  const { used } = drafted;
  const hits = [...drafted.hits, ...poiseHits(c, rest.filter((p) => !eventStep(p)), new Set(drafted.hits.map((h) => String(h["id"]))), logged)];
  const notes: string[] = [...drafted.eventDriven];
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

  // What happens with no landing: a cast trigger at its frame when its conditions can be said (energy and applications; SP only for a skill without hits, whose own atb the engine doesn't give).
  const label = c.skillId.replace(`${operator}_`, "");
  const atFrame = new Map<number, { do: Json[]; notes: string[]; detached: boolean }>();
  const later = (p: Placement, action: Record<string, Json>, text: string): boolean => {
    const pred = p.steps.length ? allOf(p.steps.map((s) => s.pred)) : undefined;
    if (pred === null) return false;
    const slot = atFrame.get(p.frame) ?? { do: [], notes: [], detached: false };
    slot.do.push(pred ? { ...action, if: pred as unknown as Json } : action);
    slot.notes.push(`${text} at ${placeText(p)}`);
    slot.detached ||= p.detached;
    atFrame.set(p.frame, slot);
    return true;
  };
  for (const e of c.effects) {
    if (used.has(e)) continue;
    const a = application(e);
    if (!(a.app && later(e, { kind: "apply", applies: [a.app] }, `${e.kind}${a.note ? ` (${a.note})` : ""}`))) notes.push(`${e.kind} at ${placeText(e)} with no landing: ${a.note ?? JSON.stringify(a.app)}`);
  }
  for (const x of [...c.energy, ...c.sp]) {
    if (used.has(x)) continue;
    const v = valueExpr(x.value, x.coefficient);
    const kind = x.costType === 0 ? "energy" : "sp";
    // The engine gives a skill's own `atb` on its first hit: SP from that key becomes a trigger only in a skill without hits.
    const ownAtb = kind === "sp" && hits.length > 0 && x.value.keys.includes("atb");
    const value = v !== null && x.controlledOnly ? gated(v, { controlled: true }) : v;
    const ok = value !== null && !x.isPercent && !ownAtb && later(x, { kind, value }, costText(x));
    if (!ok) notes.push(`${costText(x)} at ${placeText(x)} with no landing${ownAtb ? " (the engine gives the skill's atb on its first hit)" : ""}`);
  }
  // A heal with no landing: a heal action at its frame (its heal tag's kind).
  const unplaced = new Map<string, number>();
  for (const h of c.heals) {
    if (used.has(h)) continue;
    const ok = h.target !== "unknown" && later(h, { kind: "heal", target: h.target, ...(h.healKind ? { healKind: h.healKind } : {}) }, `heal (${h.target})`);
    if (!ok) unplaced.set(`${h.target} in ${h.file}`, (unplaced.get(`${h.target} in ${h.file}`) ?? 0) + 1);
  }
  if (unplaced.size) notes.push(`heals with no landing or no known target (whom: write by hand): ${[...unplaced].map(([k, n]) => `${k} ×${n}`).join(", ")}`);
  // The same action on both sides of one condition (energy if controlled, and if not) happens either way.
  for (const slot of atFrame.values()) {
    const text = (a: Json | undefined) => JSON.stringify(a ?? null);
    for (let i = 0; i < slot.do.length; i++) {
      const { if: p, ...rest } = slot.do[i] as Record<string, Json>;
      if (p === undefined) continue;
      const j = slot.do.findIndex((b, k) => {
        if (k === i) return false;
        const { if: q, ...other } = b as Record<string, Json>;
        return text(other) === text(rest) && (text(q) === text({ not: p }) || text(p) === text({ not: q ?? null }));
      });
      if (j < 0) continue;
      slot.do.splice(Math.max(i, j), 1);
      slot.do[Math.min(i, j)] = rest;
      i = -1;
    }
  }
  const triggers = [...atFrame].sort(([a], [b]) => a - b).map(([frame, slot]) => ({
    id: `${label}_f${frame}`,
    on: { event: "cast", skills: [c.skillId] },
    by: "self",
    skill: c.skillId,
    ...(frame > 0 ? { delay: frame } : {}),
    ...(slot.detached ? { detached: true } : {}),
    do: slot.do,
    note: `No landing at this frame: ${slot.notes.join("; ")}`,
  }));

  notes.push(...buffNotes(c));
  // Jumps, one note per jump (not per path to it); a conditional jump on the skill's own timeline whose condition can be said becomes a kit `jumps` entry.
  const jumps: Record<string, Json>[] = [];
  const jumpGroups = new Map<string, CompiledJump[]>();
  for (const j of c.jumps) {
    const key = JSON.stringify([j.frame, j.file, j.destFrame, j.condition]);
    jumpGroups.set(key, [...(jumpGroups.get(key) ?? []), j]);
  }
  for (const group of jumpGroups.values()) {
    const j = group[0] as CompiledJump;
    const preds = new Set(group.map((x) => JSON.stringify(x.pred)));
    const pred = preds.size === 1 ? j.pred : null;
    const listed = timingJumps.filter((x) => x.conditional && x.at === j.frame && x.to === j.destFrame);
    const emitted = j.file === c.skillId && !j.detached && pred !== null && listed.length === 1 && group.length === c.jumps.filter((x) => x.frame === j.frame && x.destFrame === j.destFrame).length;
    if (emitted) jumps.push({ at: j.frame, to: j.destFrame, if: pred as unknown as Json });
    notes.push(`JumpToAction at ${placeText(j)}${group.length > 1 ? ` (and ${group.length - 1} more path(s) to it)` : ""} → frame ${j.destFrame} (${j.condition}); ${emitted ? "in jumps" : "not followed"}`);
  }
  for (const k of c.casts) notes.push(`casts ${k.skillId} at ${placeText(k)}${k.followed ? " (compiled into this skill)" : ""}`);
  // The compiler's own assumptions and what it didn't follow (not the one-enemy decisions every skill has).
  notes.push(...c.notes.filter((n) => !/^(CheckEntityNum decided|CheckTargetsEqual decided)/.test(n)).map((n) => `compiler: ${n}`));
  return {
    skill: {
      skillId: c.skillId,
      label,
      damageType,
      ...(teamEnergy ? { teamEnergy } : {}),
      ...(energyBlockSeconds ? { energyBlockSeconds } : {}),
      ...(jumps.length ? { jumps } : {}),
      ...(notes.length ? { note: notes.join(" | ") } : {}),
      hits,
    },
    triggers,
  };
}

/** Buffs the operator's talents and potentials attach, with the predicate that holds while each is attached (the lowest talent level or potential). */
function attachedBuffs(data: GameData, operator: string): Map<string, Predicate> {
  const op = data.operators[operator];
  const out = new Map<string, Predicate>();
  if (!op) return out;
  for (const n of [...op.talentNodes].sort((a, b) => a.level - b.level))
    for (const e of n.effects) if (e.kind === "buff" && !out.has(e.buffId)) out.set(e.buffId, { talentAtLeast: [n.index, n.level] });
  op.potentials.forEach((effects, i) => {
    for (const e of effects) if (e.kind === "buff" && !out.has(e.buffId)) out.set(e.buffId, { potentialAtLeast: i + 1 });
  });
  return out;
}

/**
 * A skill's keys that are 0 at every level and only set (op set, > 0) by one
 * talent's levels or by potentials, with the predicate under which they're
 * set: Wulfgard's talent2, Alesh's exist_talent_1. A key another source also
 * changes (Avywenna's talent0_usp, which P1 adds to) isn't a gate.
 */
function valueGates(data: GameData, operator: string, skillId: string, values: Readonly<Record<string, number>> | undefined): Map<string, { pred: Predicate; min: number; max: number }> {
  const op = data.operators[operator];
  const out = new Map<string, { pred: Predicate; min: number; max: number }>();
  if (!op) return out;
  type Source = { pred: Predicate; source: string; level: number; op: string; value: number };
  const byKey = new Map<string, Source[]>();
  const add = (key: string, s: Source) => byKey.set(key, [...(byKey.get(key) ?? []), s]);
  for (const n of op.talentNodes)
    for (const e of n.effects) if (e.kind === "skillValue" && e.skillId === skillId) add(e.key, { pred: { talentAtLeast: [n.index, n.level] }, source: `talent ${n.index}`, level: n.level, op: e.op, value: e.value });
  op.potentials.forEach((effects, i) => {
    for (const e of effects) if (e.kind === "skillValue" && e.skillId === skillId) add(e.key, { pred: { potentialAtLeast: i + 1 }, source: "potential", level: i + 1, op: e.op, value: e.value });
  });
  const levels = data.skills[skillId]?.levels ?? [];
  for (const [key, sources] of byKey) {
    const base = [values?.[key], data.skills[skillId]?.defaults[key], ...levels.map((l) => l.blackboard[key])].filter((x): x is number => x !== undefined);
    if (base.some((x) => x !== 0) || new Set(sources.map((s) => s.source)).size !== 1 || sources.some((s) => s.op !== "set" || !(s.value > 0))) continue;
    const first = [...sources].sort((a, b) => a.level - b.level)[0] as Source;
    out.set(key, { pred: first.pred, min: Math.min(...sources.map((s) => s.value)), max: Math.max(...sources.map((s) => s.value)) });
  }
  return out;
}

export function kitDraft(data: GameData, operator: string, loggedEvents: ReadonlyMap<string, number>): string {
  const op = data.operators[operator];
  if (!op) throw new Error(`unknown operator ${operator}`);
  const top = new Set(Object.keys(op.skillGroups));
  const attached = attachedBuffs(data, operator);
  const skills: Record<string, Json>[] = [];
  const triggers: Record<string, Json>[] = [];
  const empty: string[] = [];
  const covered = new Set<string>();
  for (const id of [...top].sort()) {
    const values = data.skills[id]?.levels.at(-1)?.blackboard;
    const c = compileSkill(id, { followCast: (s) => !top.has(s), attachedBuffs: attached, valueGates: valueGates(data, operator, id, values), ...(values ? { values } : {}) });
    if (!c || (c.landings.length === 0 && c.poiseOnly.length === 0 && c.energy.length === 0 && c.sp.length === 0 && c.teamEnergy.length === 0 && c.energyBlocks.length === 0 && !c.effects.length)) {
      empty.push(c ? id : `${id} (no SkillData file)`);
      continue;
    }
    for (const l of c.landings) covered.add(l.file);
    const d = draftSkill(c, op.skillGroups[id] ?? "basic", loggedEvents, operator, op.element, data.skills[id]?.timing?.jumps ?? []);
    skills.push(d.skill);
    triggers.push(...d.triggers);
  }
  const kit = {
    $schema: "../../../../schemas/kit.schema.json",
    operator,
    sources: [`Draft compiled from rmxlinux Json/SkillData ${operator}_* and the files they reach by efsim kit-draft v2 (packages/data skillCompile.ts; timing values at each skill's highest level); verify against log fixtures and descriptions.`],
    ...(op.element ? { element: op.element } : {}),
    ...(triggers.length ? { triggers } : {}),
    skills,
  };
  const lines = [compactArrays(JSON.stringify(kit, null, 2))];
  const notInDraft = [...loggedEvents].filter(([e]) => !covered.has(e));
  if (empty.length) lines.push("", "// Skills with nothing compiled (no damage, energy, SP, applications or blocks):", ...empty.map((s) => `//   ${s}`));
  if (notInDraft.length) lines.push("", "// Logged event keys not in the draft:", ...notInDraft.map(([e]) => `//   ${e} ×${loggedEvents.get(e) ?? 0}`));
  return lines.join("\n");
}
