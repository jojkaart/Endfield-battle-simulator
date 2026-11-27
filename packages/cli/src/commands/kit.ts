// efsim kit: an operator's compiled kit (skills with their timing and hits' frames, buffs, triggers), as the engine
// runs it: what agents otherwise read through a scratch script over createContext (round-4 friction: Si's attack-5 and
// battle-skill hit frames for a log's gaps took three attempts). Kit files have no frames; they come from SkillData.

import { FPS, type GameData, type KitApplication, type KitBuff, type KitHit, type KitSkill, type KitTrigger, type OperatorKit, type TriggerAction } from "@efsim/engine";
import { isSkillFileListed, readSkillFile } from "@efsim/data";
import { landingFrames, operatorNamed } from "@efsim/logs";
import { command } from "../command.ts";
import { heldFrames } from "../gamedata.ts";

const sec = (frames: number) => `${(frames / FPS).toFixed(2)} s`;
const pred = (p: unknown) => (p === undefined ? "" : JSON.stringify(p));

/** One application of a hit (KitHit.applies): kind, element or status, stacks or level, condition (rule-objective report: "which button inflicts which element"). */
function application(a: KitApplication): string {
  const x = a as unknown as Record<string, unknown>;
  const what = [x["element"], x["status"], x["reaction"]].filter((v) => typeof v === "string").join(" ");
  const n = x["stacks"] ?? x["level"];
  return `${a.kind}${what ? ` ${what}` : ""}${n !== undefined ? ` ${typeof n === "number" ? n : JSON.stringify(n)}` : ""}${a.if !== undefined ? ` if ${pred(a.if)}` : ""}`;
}

function hitLine(h: KitHit, indent = "      "): string {
  const frames = landingFrames(h);
  const parts = [
    `${h.id}${h.label ? ` "${h.label}"` : ""}`,
    `frames ${frames ? frames.join(",") : "none (a trigger's, or landing order unknown)"}${h.latestFrame !== undefined ? ` (a channel's: up to frame ${h.latestFrame} for an enemy in reach late)` : ""}`, // split:channel-end
    `${h.damageType} ${h.element}`,
    ...(h.events.length ? [`keys ${h.events.join(", ")}`] : []),
    ...(h.poise !== undefined ? [`poise ${JSON.stringify(h.poise)}${h.poiseControlledOnly ? " (controlled only)" : ""}`] : []),
    ...(h.enemyDelay !== undefined ? [`lands ${h.enemyDelay} frames after (enemyDelay)`] : []),
    ...(h.detached ? ["detached"] : []),
    ...(h.world ? ["on the world's clock"] : []),
    ...(h.finalStrike ? ["final strike"] : []),
    ...(h.if !== undefined ? [`if ${pred(h.if)}`] : []),
    ...(h.applies?.length ? [`applies ${h.applies.map(application).join(", ")}`] : []),
  ];
  return `${indent}${parts.join("; ")}`;
}

/** The fields of an action other than its kind and `if`, compactly (`key value`; objects as JSON). */
function fields(a: object, skip: readonly string[] = []): string {
  return Object.entries(a)
    .filter(([k]) => !["kind", "if", ...skip].includes(k))
    .map(([k, v]) => `${k} ${typeof v === "string" || typeof v === "number" ? v : JSON.stringify(v)}`)
    .join(", ");
}

/**
 * A trigger's actions, a line each (one-sided report point 4, physical-statuses report point 2: a trigger's hits,
 * gains, buffs and jumps were only in the kit file): hits with their frames, keys and conditions as a skill's; a
 * `choose` with its options' actions below it.
 */
function actionLines(actions: readonly TriggerAction[], indent: string): string[] {
  return actions.flatMap((a): string[] => {
    const cond = a.if !== undefined ? ` if ${pred(a.if)}` : "";
    switch (a.kind) {
      case "hits":
        return [`${indent}hits${a.now ? " (now)" : ""}${a.world ? " (on the world's clock)" : ""}${cond}:`, ...a.hits.map((h) => hitLine(h, `${indent}  `))];
      case "gain":
        return [`${indent}gain ${a.gains.map((g) => `${g.stack} ${typeof g.amount === "number" ? g.amount : JSON.stringify(g.amount)}${g.if !== undefined ? ` if ${pred(g.if)}` : ""}`).join(", ")}${cond}`];
      case "apply":
        return [`${indent}apply ${a.applies.map(application).join(", ")}${cond}`];
      case "jump":
        return [`${indent}jump ${a.skill}: from frame ${a.from} until ${a.until} to ${a.to}${cond}`];
      case "choose":
        return [`${indent}choose one${cond}:`, ...a.options.flatMap((o, i) => [`${indent}  option ${i + 1}, weight ${pred(o.weight)}:`, ...actionLines(o.do, `${indent}    `)])];
      default: {
        const f = fields(a);
        return [`${indent}${a.kind}${f ? `: ${f}` : ""}${cond}`];
      }
    }
  });
}

/** A trigger: its event and settings on one line, its cooldown's clock and the game's mechanism behind it, then its actions. */
function triggerLines(t: KitTrigger): string[] {
  const settings = fields(t, ["id", "on", "do", "label", "note", "notes", "cooldownFrom"]);
  return [`  ${t.id}: on ${JSON.stringify(t.on)}${settings ? `; ${settings}` : ""}${t.if !== undefined ? `; if ${pred(t.if)}` : ""}`, ...cooldownLines(t), ...actionLines(t.do, "      ")];
}

/** The game's mechanisms (cooldown-clock report point 3, KitTrigger.cooldownFrom) a timer's kind names. */
const COOLDOWN_KINDS: Readonly<Record<string, string>> = { globalCd: "a CD timer (AddGlobalCDTimer)", cdBuff: "a `_cd` buff", marker: "a timed marker (CreateTimedMarker)" };

/**
 * A trigger's cooldown: the clock it runs on (KitTrigger.cooldownClock: the world's, held by stops and holds, or raw
 * time) and the game's mechanism the compiler found for it (KitTrigger.cooldownFrom, kits.ts cooldownClockOf), or that
 * the data shows none (the kit's own cooldownClock, with its evidence in the trigger's note, or raw).
 */
export function cooldownLines(t: KitTrigger): string[] {
  if (t.cooldown === undefined) return [];
  const clock = t.cooldownClock === "world" ? "the world's clock (held by stops and holds)" : "raw time";
  const from = (t.cooldownFrom ?? []).map((x) => `${COOLDOWN_KINDS[x.kind] ?? x.kind} in ${x.source}, length ${typeof x.length === "number" ? `${x.length} s` : `key ${x.length}`}`);
  const why = from.length ? from.join("; ") : t.cooldownClock === "world" ? "none in the data: the kit's own cooldownClock (its note)" : "none in the data";
  return [`      cooldown ${JSON.stringify(t.cooldown)} on ${clock}: ${why} (engine assumption trigger-cooldowns can put every trigger on one clock)`];
}

/** The triggers' jumps and end-actions on a skill (they move or end its playhead from outside its own timeline). */
function triggerJumps(kit: OperatorKit, skillId: string): string[] {
  return kit.triggers.flatMap((t) =>
    t.do.flatMap((a) => (a.kind === "jump" && a.skill === skillId ? [`trigger ${t.id} (on ${JSON.stringify(t.on)}) jumps it from frame ${a.from} until ${a.until} to ${a.to}${a.if !== undefined ? ` if ${pred(a.if)}` : ""}`] : [])),
  );
}

function skillLines(data: GameData, operator: string, s: KitSkill, kit: OperatorKit): string[] {
  const t = data.skills[s.skillId]?.timing;
  // The world frames each slow-down holds, and all of them together (a path's ends and jumps aside: pathSlowdowns).
  const held = heldFrames(t?.slowdowns ?? []);
  const timing = t
    ? `duration ${t.durationFrames} frames (${sec(t.durationFrames)}), uncuttable to frame ${t.exclusiveFrames}${t.windows.length ? `, windows ${t.windows.map((w) => `${w.from}–${w.to} ${w.skills.map((x) => x.replace(/^chr_\d+_[a-z0-9]+_/, "")).join("/")}`).join("; ")}` : ""}${t.slowdowns.length ? `, slow-downs from frame ${t.slowdowns.map((d, i) => `${d.from} (${d.scales.length} frames, lowest ${Math.min(...d.scales).toFixed(2)}, holds ${(held.each[i] as number).toFixed(1)})`).join(", ")}${t.slowdowns.length > 1 ? ` (together ${held.together.toFixed(1)} frames held at the lowest scale)` : ""}` : ""}`
    : "no SkillData timing";
  // The skill's group in CharGrowthTable (its levels): a basic attack in the battle skill's or ultimate's group is an
  // enhanced one (the finisher-gate report: the Finisher's gate rests on it).
  const group = data.operators[operator]?.skillGroups[s.skillId];
  const kind = group !== undefined && group !== s.kind ? `${s.kind}; skill group ${group}${s.kind === "basic" ? ": an enhanced basic attack" : ""}` : s.kind;
  // Every time-dilation action in its SkillData file and what the compiler made of it (a reset, a priority, or dropped:
  // friction round 7, Arcane's combo reset was dropped silently).
  const file = isSkillFileListed(s.skillId) ? readSkillFile(s.skillId) : null;
  const dilations = [...(file?.dilations ?? [])].sort((a, b) => a.frame - b.frame).map((d) => `frame ${d.frame} ${d.type === "UltimateTimeAction" ? "ultimate stop" : `dilation layer ${d.layer ?? "?"}${d.curve ? ` (${d.curve})` : ""}`}${d.priority !== null ? ` priority ${d.priority}` : ""}: ${d.compiled}`);
  // Where its playhead jumps or the action ends (the data's, the kit's conditions, the triggers'): a landing after an
  // end or inside a jump never lands, without a word in the replay (physical-statuses report point 2).
  const paths = [
    ...(t?.jumps ?? []).map((j) => `jump at frame ${j.at} to ${j.to}${j.conditional ? " (conditional)" : ""}`),
    ...(s.jumps ?? []).map((j) => `kit: jump at frame ${j.at}${j.to !== undefined ? ` to ${j.to}` : ""} if ${pred(j.if)}`),
    ...(t?.ends.length ? [`ends at frame ${t.ends.join(", ")}`] : []),
    ...(t?.recasts?.length ? [`casts its next skill at frame ${t.recasts.join(", ")}`] : []),
    ...(t?.interruptibleFrom?.length ? [`interruptible from frame ${t.interruptibleFrom.join(", ")}`] : []),
    ...triggerJumps(kit, s.skillId),
  ];
  return [
    `  ${s.skillId} (${kind}) "${s.label}": ${timing}`,
    ...(dilations.length ? [`      time dilations: ${dilations.join("; ")}`] : []),
    ...(paths.length ? [`      paths: ${paths.join("; ")}`] : []),
    ...(s.available !== undefined ? [`      available if ${pred(s.available)}`] : []),
    ...(s.beside !== undefined ? [`      beside the running cast if ${pred(s.beside)}`] : []),
    ...(s.followUpOnly ? ["      only as a follow-up (a skill's own cast action starts it)"] : []),
    ...s.hits.map((h) => hitLine(h)),
  ];
}

/** `efsim kit <operator>`: the compiled kit's skills (timing, hits and frames), buffs and triggers; `skill`: only skills matching. */
export function kitView(data: GameData, operator: string, skill?: RegExp): string {
  // A weapon's or gear set's kit by its id (wpn_…, suit_…): its buffs and triggers (cooldown-clock report point 3:
  // Swordmancer's CD timer is a gear set's).
  const equipment = data.kits.equipment[operator];
  if (equipment) return [`${operator}: the compiled equipment kit`, "Buffs:", ...equipment.buffs.map(buffLine), "Triggers:", ...equipment.triggers.flatMap(triggerLines)].join("\n");
  const id = operatorNamed(data, operator);
  const kit: OperatorKit | undefined = data.kits.operators[id];
  if (!kit) throw new Error(`${id}: no kit`);
  const skills = kit.skills.filter((s) => !skill || skill.test(s.skillId));
  const out = [`${data.operators[id]?.name ?? id} (${id}): the compiled kit (frames at ${FPS} a second; a hit's frames are its landings' in its cast; timing from SkillData)`, "Skills:", ...skills.flatMap((s) => skillLines(data, id, s, kit))];
  if (!skill) {
    out.push("Buffs:", ...kit.buffs.map(buffLine));
    out.push("Triggers:", ...kit.triggers.flatMap(triggerLines));
  }
  return out.join("\n");
}

/** A kit buff on one line: its target, duration, the game buff it is logged as, its ticks, whether it ends with its cast. */
function buffLine(b: KitBuff): string {
  return `  ${b.id} "${b.label}": ${b.target}${b.duration !== undefined ? `, duration ${JSON.stringify(b.duration)}` : ""}${b.gameBuff ? `, logged as ${b.gameBuff}` : ""}${b.loggedAs?.length ? ` / ${b.loggedAs.join(", ")}` : ""}${b.every !== undefined ? `, ticks every ${JSON.stringify(b.every)}` : ""}${b.endsWithCast ? ", ends with its cast" : ""}`;
}

export default command({
  name: "kit",
  usage: `  efsim kit <operator>                    An operator's compiled kit (id, name or part of the id): skills with their
                                          duration, uncuttable frames, windows and slow-downs, paths (the data's
                                          jumps and ends, the kit's and the triggers' jumps), skill group when it
                                          isn't the kind (an enhanced basic attack), each hit's frames, keys,
                                          poise, conditions and applications (inflictions, statuses, reactions);
                                          buffs (logged as which game buff) and triggers with each action
                                          (hits as a skill's, gains, buffs, jumps, a choice's options), and each
                                          cooldown's clock with the game's mechanism behind it (a CD timer, a _cd
                                          buff, a timed marker: KitTrigger.cooldownFrom)
  efsim kit <weapon or gear-set id>       Its buffs and triggers (wpn_…, suit_…; ids: efsim find <name>)
                [--skill <regex>]         Only skills matching (no buffs or triggers)
`,
  options: {
    skill: { type: "string" },
  },
  run: (ctx) => {
    ctx.need(1);
    const skill = ctx.values.skill as string | undefined;
    return kitView(ctx.data(), ctx.args[0] as string, skill !== undefined ? new RegExp(skill) : undefined);
  },
});
