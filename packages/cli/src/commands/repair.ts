// efsim repair: an example timeline that stops playing after an engine timing change (an EngineError: a step that
// can't start where it stands), fixed the way the gear ascent fixes a rotation for a new loadout (gear.ts
// repairRotation): each failing step tried as its other variants at the same time, then moved to the first later start
// that works, else dropped; the file rewritten with only its rotation changed (round-4 friction: two examples needed a
// hand-written repair script after buff-in-stop; the Haste round wrote frames where the file wants seconds).

import { readFileSync, writeFileSync } from "node:fs";
import { EngineError, FPS, simulate, type GameData, type TimelineScenario } from "@efsim/engine";
import { command } from "../command.ts";
import { num } from "../format.ts";
import { repairRotation, type RepairedRotation } from "../gear.ts";
import { applyEdits, parseSpans, prop } from "../jsonEdit.ts";
import { readScenario } from "../simulate.ts";

const sec = (frames: number) => +(frames / FPS).toFixed(4);

/**
 * A scenario file's text with its rotation replaced by `rotation` (frames → seconds), one step per line at the file's
 * indentation. Steps kept unmoved keep their own text when the file's rotation maps one to one onto the scenario's (no
 * `repeat`); moved steps get their new `at`.
 */
export function withRotation(text: string, scenario: TimelineScenario, fixed: RepairedRotation): string {
  const root = parseSpans(text);
  const node = prop(root, "rotation");
  if (!node || node.kind !== "array") throw new Error("the scenario file has no rotation array");
  const items = node.items.map((it) => text.slice(it.span.start, it.span.end));
  const oneToOne = items.length === scenario.rotation.length && !items.some((t) => /"repeat"\s*:/.test(t));
  const first = node.items[0];
  const indent = first ? text.slice(text.lastIndexOf("\n", first.span.start - 1) + 1, first.span.start) : "    ";
  const closing = text.slice(text.lastIndexOf("\n", node.span.end - 1) + 1, node.span.end - 1);
  // The kept steps in the order they were played: an unmoved one is the scenario's own step (its text kept), a moved one
  // a copy with its new start (and variant).
  const line = (x: TimelineScenario["rotation"][number]): string => {
    const i = scenario.rotation.indexOf(x);
    if (i >= 0 && oneToOne) return items[i] as string;
    return `{ "operator": ${JSON.stringify(x.operator)}, "skill": ${JSON.stringify(x.skill)}${x.at !== undefined ? `, "at": ${sec(x.at)}` : ""} }`;
  };
  const body = fixed.rotation.map((x) => `${indent}${line(x)}`).join(",\n");
  return applyEdits(text, [{ start: node.span.start, end: node.span.end, text: `[\n${body}\n${closing}]` }]);
}

/** `efsim repair`: what the repair moved and dropped, the totals, and (with `out`) the file written. */
export function repairScenario(data: GameData, file: string, out?: string): string {
  const scenario = readScenario(file);
  const name = (op: string) => data.operators[op]?.name ?? op;
  let before: number | null;
  try {
    before = simulate(data, scenario).total;
  } catch (e) {
    if (!(e instanceof EngineError)) throw e;
    before = null;
  }
  const fixed = repairRotation(data, scenario, { variants: true });
  if (!fixed.moved.length && !fixed.dropped.length) return `${file}: plays as it is${before !== null ? ` (total ${num(Math.round(before), 0)})` : ""}; nothing to repair.`;
  const after = simulate(data, { ...scenario, rotation: fixed.rotation }).total;
  const step = (i: number, s: TimelineScenario["rotation"][number]) => `step ${i + 1} (${name(s.operator)} ${s.skill}${s.at !== undefined ? ` at ${sec(s.at)} s` : ""})`;
  const lines = [
    `${file}: ${before === null ? "doesn't play (an EngineError)" : `plays (total ${num(Math.round(before), 0)}) but some steps don't start where they stand`}; repaired: ${fixed.moved.length} step(s) moved, ${fixed.dropped.length} dropped; total ${num(Math.round(after), 0)}.`,
    ...fixed.moved.map((m) => `  moved   ${step(m.index, m.step)} → ${m.as ? `as ${m.as} ` : ""}at ${sec(m.to)} s`),
    ...fixed.dropped.map((d) => `  dropped ${step(d.index, d.step)}: no later start within 15 s works`),
  ];
  if (out) {
    writeFileSync(out, withRotation(readFileSync(file, "utf8"), scenario, fixed));
    const check = simulate(data, readScenario(out)).total;
    lines.push(`Wrote ${out} (only its rotation changed); it plays: total ${num(Math.round(check), 0)}. Then \`npm run snapshots:update\` for the examples' snapshot.`);
  }
  return lines.join("\n");
}

export default command({
  name: "repair",
  usage: `  efsim repair <scenario.json>            A timeline that stops playing (an EngineError after a timing change):
                                          each failing step tried as its other variants at the same time, then moved
                                          to the first later start that works, else dropped (gear.ts repairRotation);
                                          prints what moved
                [--write | --out <file>]  Rewrite the file (or write another) with only its rotation changed
`,
  options: { write: { type: "boolean", default: false }, out: { type: "string" } },
  run: (ctx) => {
    ctx.need(1);
    const file = ctx.args[0] as string;
    const out = (ctx.values.out as string | undefined) ?? (ctx.values.write ? file : undefined);
    return repairScenario(ctx.data(), file, out);
  },
});
