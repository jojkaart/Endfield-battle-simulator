// efsim kit: an operator's compiled kit (skills with their timing and hits' frames, buffs, triggers), as the engine
// runs it: what agents otherwise read through a scratch script over createContext (round-4 friction: Si's attack-5 and
// battle-skill hit frames for a log's gaps took three attempts). Kit files have no frames; they come from SkillData.

import { FPS, type GameData, type KitHit, type KitSkill, type OperatorKit } from "@efsim/engine";
import { landingFrames, operatorNamed } from "@efsim/logs";
import { command } from "../command.ts";

const sec = (frames: number) => `${(frames / FPS).toFixed(2)} s`;
const pred = (p: unknown) => (p === undefined ? "" : JSON.stringify(p));

function hitLine(h: KitHit): string {
  const frames = landingFrames(h);
  const parts = [
    `${h.id}${h.label ? ` "${h.label}"` : ""}`,
    `frames ${frames ? frames.join(",") : "none (a trigger's, or landing order unknown)"}`,
    `${h.damageType} ${h.element}`,
    ...(h.events.length ? [`keys ${h.events.join(", ")}`] : []),
    ...(h.poise !== undefined ? [`poise ${JSON.stringify(h.poise)}${h.poiseControlledOnly ? " (controlled only)" : ""}`] : []),
    ...(h.enemyDelay !== undefined ? [`lands ${h.enemyDelay} frames after (enemyDelay)`] : []),
    ...(h.detached ? ["detached"] : []),
    ...(h.world ? ["on the world's clock"] : []),
    ...(h.finalStrike ? ["final strike"] : []),
    ...(h.if !== undefined ? [`if ${pred(h.if)}`] : []),
  ];
  return `      ${parts.join("; ")}`;
}

function skillLines(data: GameData, s: KitSkill): string[] {
  const t = data.skills[s.skillId]?.timing;
  const timing = t
    ? `duration ${t.durationFrames} frames (${sec(t.durationFrames)}), uncuttable to frame ${t.exclusiveFrames}${t.windows.length ? `, windows ${t.windows.map((w) => `${w.from}–${w.to} ${w.skills.map((x) => x.replace(/^chr_\d+_[a-z0-9]+_/, "")).join("/")}`).join("; ")}` : ""}${t.slowdowns.length ? `, slow-downs from frame ${t.slowdowns.map((d) => `${d.from} (${d.scales.length} frames, lowest ${Math.min(...d.scales).toFixed(2)})`).join(", ")}` : ""}`
    : "no SkillData timing";
  return [
    `  ${s.skillId} (${s.kind}) "${s.label}": ${timing}`,
    ...(s.available !== undefined ? [`      available if ${pred(s.available)}`] : []),
    ...(s.beside !== undefined ? [`      beside the running cast if ${pred(s.beside)}`] : []),
    ...(s.followUpOnly ? ["      only as a follow-up (a skill's own cast action starts it)"] : []),
    ...s.hits.map(hitLine),
  ];
}

/** `efsim kit <operator>`: the compiled kit's skills (timing, hits and frames), buffs and triggers; `skill`: only skills matching. */
export function kitView(data: GameData, operator: string, skill?: RegExp): string {
  const id = operatorNamed(data, operator);
  const kit: OperatorKit | undefined = data.kits.operators[id];
  if (!kit) throw new Error(`${id}: no kit`);
  const skills = kit.skills.filter((s) => !skill || skill.test(s.skillId));
  const out = [`${data.operators[id]?.name ?? id} (${id}): the compiled kit (frames at ${FPS} a second; a hit's frames are its landings' in its cast; timing from SkillData)`, "Skills:", ...skills.flatMap((s) => skillLines(data, s))];
  if (!skill) {
    out.push("Buffs:", ...kit.buffs.map((b) => `  ${b.id} "${b.label}": ${b.target}${b.duration !== undefined ? `, duration ${JSON.stringify(b.duration)}` : ""}${b.gameBuff ? `, logged as ${b.gameBuff}` : ""}${b.loggedAs?.length ? ` / ${b.loggedAs.join(", ")}` : ""}${b.every !== undefined ? `, ticks every ${JSON.stringify(b.every)}` : ""}${b.endsWithCast ? ", ends with its cast" : ""}`));
    out.push("Triggers:", ...kit.triggers.map((t) => `  ${t.id}: on ${JSON.stringify(t.on)}${t.delay ? `, delay ${t.delay} frames` : ""}`));
  }
  return out.join("\n");
}

export default command({
  name: "kit",
  usage: `  efsim kit <operator>                    An operator's compiled kit (id, name or part of the id): skills with their
                                          duration, uncuttable frames, windows and slow-downs, each hit's frames,
                                          keys, poise and conditions; buffs (logged as which game buff) and triggers
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
