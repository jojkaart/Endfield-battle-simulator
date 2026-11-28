// The placement's records in words (round 21, the interrupted-casts report point 5: the casts view's words lived in
// views.ts, so a placement round's new record, LoggedCast.pastChannel, had its decision line held back as another
// agent's file). A placement rule and its line land in one commit here: views.ts castsRecords and the replay's view
// call these. Moved from views.ts (lateJoin, twinWords, joinWords, choiceWords, inTurnWords), with the CAST line's
// paths and past-channel brackets.

import { CAST_SLACK_MS, type CastChoice, type InTurnRecord, type LoggedCast, type PlacedJoin, type PlacedTwin } from "./logcasts.ts";
import { secondsText as s, shortSkill } from "./labels.ts";

/** Whether a join came later than its slot's frame by more than CAST_SLACK_MS (where the slot's frame is unknown: than the slack itself). */
export const lateJoin = (j: PlacedJoin) => j.elapsed > (j.due ?? 0) + CAST_SLACK_MS;

/** The rule that made a hit another target's landing of its slot (PlacedHit.twin), in words. */
export function twinWords(t: PlacedTwin): string {
  if (t.rule === "batch") return `twin: batch, ${t.targets} targets per landing of the ${t.batch} alike hits at this ms (by ${t.by}: targets.ts batchTargets)`;
  if (t.rule === "later") return "twin: later, the used-up cast's last landing on another target, one flush after it";
  if (t.rule === "time") return `twin: time, at its slot's landing's ms with the next slot due ${s(t.due ?? 0)} s later, no stop between`;
  if (t.rule === "used") return "twin: used, the cast's landings of its key all logged";
  return "twin: value, its value the slot's again, not the next slot's";
}

/** A late join (PlacedHit.joined) in words: the rule and the times. */
export function joinWords(j: PlacedJoin): string {
  const from = j.by === "delayed" || j.by === "reach" ? "its cast's start" : "the cast's first landing";
  const rule = j.by === "span" ? "within the cast's landings' span" : j.by === "to come" ? "slots to come within the skill's action" : j.by === "paced" ? "a detached series at its pace" : j.by === "same ultimate" ? "within the ultimate's action" : j.by === "delayed" ? "a delayed hit's landing (joinDelayed)" : "within an earlier cast's reach (joinable)";
  return `joined: ${j.by}, ${rule}: ${s(j.elapsed)} s after ${from}${j.due !== undefined ? `, its slot's frame at ${s(j.due)} s` : ""}`;
}

/** A cast's choice (LoggedCast.chosen) in words: the rule, what decided it and the candidates. */
export function choiceWords(c: CastChoice): string {
  const of = `of ${c.candidates.map(shortSkill).join(", ")}`;
  switch (c.rule) {
    case "anchor": return `anchor: its anchor's start ${s(c.ref ?? 0)} s, ${c.d ?? 0} ms off, ${of}`;
    case "alike": return `alike: nearest the windows of ${shortSkill(c.by?.skillId ?? "")}@${s(c.by?.start ?? 0)} (${c.d ?? 0} ms outside), ${of}`;
    case "window": return `window: the chain step after ${c.via ? `${shortSkill(c.via)} (unlogged) after ` : ""}${shortSkill(c.by?.skillId ?? "")}@${s(c.by?.start ?? 0)}, ${of}`;
    case "restart": return `restart: ${shortSkill(c.by?.skillId ?? "")}@${s(c.by?.start ?? 0)} lists none of them, the first, ${of}`;
    case "late": return `late: a later landing of an opened cast, ${of}`;
    case "first": return `first in kit order, nothing else deciding, ${of}`;
  }
}

/** An in-turn record (Placement.inTurn) in words: the verdict and, for a tried start, its checks. */
export function inTurnWords(r: InTurnRecord): string {
  const c = r.checks;
  const checks = c ? `: early ${c.early ? "yes" : "no"}, reach ${c.reach ? "yes" : "no"} (${s(c.reachMs)} s), free ${c.free ? "yes" : "no"}, quiet ${c.quiet ? "yes" : `no (${c.hitsInside} hits inside)`}` : "";
  return `${r.verdict}${r.candidate !== undefined ? ` at ${s(r.candidate)}` : ""}${checks}`;
}

/** The first landing's other paths (LoggedCast.paths) in words: each start it would give and whether the previous cast allows it; "" without. */
export function pathsWords(c: LoggedCast): string {
  return c.paths?.length ? `paths: ${c.paths.map((p) => `${p.hitId}@${p.frame}${p.jump ? ` on ${p.jump.at}→${p.jump.to}` : " (no jump)"}: start ${s(p.start)}${p.allowed ? ", allowed" : ", not allowed"}${Math.abs(p.start - c.start) < 1 ? " (taken)" : ""}`).join("; ")}` : "";
}

/** A cast opened past the channel's end of the cast before (LoggedCast.pastChannel: logcasts.ts placeWith) in words; "" without. */
export function pastChannelWords(c: LoggedCast): string {
  const pc = c.pastChannel;
  return pc ? `past channel: ${s(pc.elapsed)} s after ${shortSkill(c.group)}@${s(pc.cast)}'s first landing, its channel's end at ${s(pc.end)} s (${pc.by === "slack" ? "past the slack" : "a press between"})` : "";
}
