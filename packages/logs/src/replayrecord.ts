// What one replay of a logged fight records as it goes (replayrun.ts replayOnce fills it, step by step): each kit
// buff's and game buff's instances per recipient, the Stagger windows, the traces of the kit buffs and enemy statuses
// asked for, and the slow-downs the timeline applied. Its own module (improvement round 8: the replay's rules and its
// views were one 800-line closure, so a view's new field locked out every rule change in buffreplay.ts): a view's new
// output is an edit here, not in the replay's run.

import { activeAt, reaches, type TimelineState } from "@efsim/engine";

/**
 * How sure the replay is of when its buffs start and end. A start is a
 * logged landing's (or a trigger's on one), within REPLAY_EDGE_MS. An end by
 * expiry is less sure the longer the instance lasted: the timeline extends
 * buffs by every time stop in full and doesn't model hit-stop, and the logs
 * disagree with both (4e5e1390085e: Estella's Physical Susceptibility, 9 s,
 * lasts 10.1 s in the log across her ultimate's 1.8 s time stop and 10.0 s
 * without one; Gilberta's weapon buff, 15 s, 16.1 s and 16.15 s), so it gets
 * REPLAY_EXPIRY_SLACK of the instance's life on top. Within that of a change
 * in the replay's count the replay doesn't decide, and the log's listing
 * stands.
 */
export const REPLAY_EDGE_MS = 500;
export const REPLAY_EXPIRY_SLACK = 0.1;

/** One replayed instance of a kit buff reaching an operator, in frames; `expired`: it ran out (not ended or replaced early). */
export interface Instance {
  readonly start: number;
  readonly end: number;
  readonly expired: boolean;
}

/** A kit buff's instance at a recipient (ReplayRecord.kitInstances), with the instance an application replaced, if one did. */
export interface KitInstance extends Instance {
  /** The start (frames) of the instance at this recipient that this one's application ended (a refresh in the replay). */
  readonly replaces?: number;
}

/** A change in a buff's replayed instances at an operator: when, by how many, and how sure (± frames). */
export interface Change {
  readonly frame: number;
  readonly delta: number;
  readonly slack: number;
}

/** One replayed instance of a kit buff at an operator, in ms (BuffReplay.kitWindows). */
export interface KitWindow {
  readonly start: number;
  readonly end: number;
  readonly expired: boolean;
  /** Its application's frame (ActiveBuff.appliedAt: the instance's identity in BuffReplay.traces); a replay's windows always have it. */
  readonly appliedAt?: number;
  /**
   * Where an application in the replay ended an instance at the operator and took its place (a refresh): that
   * instance's start (ms). The log keeps a refreshed run's `since`; the replay starts a new window, so this is the
   * chain the log shows as one run.
   */
  readonly replaces?: number;
}

/** One change of a traced kit buff (ReplayOptions.trace) at a step of the replay: frames. */
export interface BuffTrace {
  /** `owner:id` and the recipient-independent instance (its start frame). */
  readonly buff: string;
  readonly appliedAt: number;
  /** The step's frame and what it was (a cast, the log's Stagger steps, or time passing to a sample). */
  readonly frame: number;
  readonly step: string;
  /**
   * Its expiry before and after the step (null: it didn't exist / is gone). The state is sampled after each step, so a
   * buff that ran out between two steps shows gone at the later step's frame with `from` its expiry (`from <= frame`):
   * it ran out then, the step didn't cut it (round 6: `zmdlogs clock` first read such an end as a cut).
   */
  readonly from: number | null;
  readonly to: number | null;
}

/**
 * One change of a traced kit trigger's state (ReplayOptions.trace `trigger:<owner:id>`, `zmdlogs replay --trace-trigger`;
 * backlog after round 11 point 11: de6a's Swordmancer ready frame took a stderr print in clock.ts): its ready frame and
 * firing count before and after a step (null: it hadn't fired). A count that rises is a firing; a ready frame that
 * moves without one is its cooldown held (a stop, a hidden hold, a world clock's shift). `key` is the engine's
 * (TimelineState.triggerState: `owner:id`, `owner:id:subject` for a per-subject cooldown).
 */
export interface TriggerTrace {
  readonly key: string;
  readonly frame: number;
  readonly step: string;
  readonly from: { readonly readyAt: number; readonly count: number; readonly world: boolean } | null;
  readonly to: { readonly readyAt: number; readonly count: number; readonly world: boolean };
}

/** Whether a triggerState key is one a `trigger:` trace asks for: `owner:id` (and its per-subject keys), or `id` for any owner. */
export function tracesTrigger(spec: string, key: string): boolean {
  if (key.includes("@")) return false;
  if (spec.includes(":")) return key === spec || key.startsWith(`${spec}:`);
  return key.split(":")[1] === spec;
}

/** An enemy status as a trace sees it (frames): its level or stacks, application and expiry, and a held ramp's end. */
export interface TracedStatus {
  readonly level: number;
  /** The status's application (absent for Vulnerable, which has none): it moves with every stop that holds its ramp. */
  readonly appliedAt?: number;
  readonly expiresAt: number;
  /** Corrosion's ramp held until then (ActiveStatus.rampHeld), standing at `elapsed` frames. */
  readonly rampHeld?: { readonly until: number; readonly elapsed: number };
}

/**
 * One change of a traced enemy status (ReplayOptions.trace `status:<status>`) at a step of the replay: its applier's
 * instance before and after the step (null: none). Keyed by status and applier, not by application: a hold moves
 * appliedAt (timeline/clock.ts shiftEnemy), so a moved application here is a hold, not a new one (round 8: 4d60's
 * Corrosion at 73.65 s, d774's Electrification).
 */
export interface StatusTrace {
  /** `corrosion`, `vulnerable`, a physical or control status. */
  readonly status: string;
  readonly operator: string;
  readonly frame: number;
  readonly step: string;
  readonly from: TracedStatus | null;
  readonly to: TracedStatus | null;
}

/**
 * A slow-down the replay's timeline applied (TimelineState.slowdowns as each step left them: a reset's cut shortens one,
 * an end or a jump never starts one), frames; `operator` the caster it doesn't hold.
 */
export interface AppliedStop {
  readonly start: number;
  readonly scales: readonly number[];
  readonly operator: string | null;
  readonly ultimate: boolean;
  readonly priority?: number;
}

/** One replay's record (replayRecorder's finish). */
export interface ReplayRecord {
  /** Per game buff and operator (`gameBuff|operator`): its instances (summed over the kit buffs standing for it). */
  readonly instances: ReadonlyMap<string, readonly Instance[]>;
  /** Every kit buff's instances per recipient (`owner:id|operator`). */
  readonly kitInstances: ReadonlyMap<string, readonly KitInstance[]>;
  readonly staggerWindows: readonly Instance[];
  readonly traces: readonly BuffTrace[];
  readonly statusTraces: readonly StatusTrace[];
  readonly triggerTraces: readonly TriggerTrace[];
  readonly appliedStops: readonly AppliedStop[];
  readonly changes: ReadonlyMap<string, readonly Change[]>;
  readonly kitChanges: ReadonlyMap<string, readonly Change[]>;
}

/** What a recorder needs of the replay: the decided kit buffs, the team, what to trace, the Stagger's length (frames) and REPLAY_EDGE_MS in frames. */
export interface RecorderInput {
  readonly kitIds: readonly { readonly g: string; readonly owner: string; readonly id: string }[];
  readonly team: readonly string[];
  /** ReplayOptions.trace: kit buffs (`owner:id`), enemy statuses (`status:<status>`) and kit triggers (`trigger:<owner:id>`). */
  readonly trace: readonly string[];
  readonly staggerFrames: () => number;
  readonly edge: number;
}

/** A replay's recorder: `sample` at each sample step, `step` after every step (the traces), `finish` at the end. */
export interface ReplayRecorder {
  /** The state at a sample's frame: the buffs' and the Stagger's instances seen there. */
  sample(st: TimelineState, frame: number): void;
  /** The state after a step (its words: stepWords): the traced buffs' and statuses' changes, the slow-downs it applied. */
  step(st: TimelineState, words: string): void;
  /** The instances still open closed at the end (or where the replay broke off), and the record. */
  finish(brokenAt: number | null): ReplayRecord;
}

type Open = { key: string; owner: string; id: string; start: number; expiresAt: number };
type OpenKit = { key: string; start: number; expiresAt: number; replaces?: number };

export function replayRecorder(o: RecorderInput): ReplayRecorder {
  const instances = new Map<string, Instance[]>();
  const kitInstances = new Map<string, KitInstance[]>();
  const staggerWindows: Instance[] = [];
  // The instances seen at the last sample, by identity (kit buff, owner, start, recipients, and which of several at one start).
  const open = new Map<string, Open>();
  const close = (key: string, start: number, end: number, expired: boolean) => instances.set(key, [...(instances.get(key) ?? []), { start, end, expired }]);
  const openKit = new Map<string, OpenKit>();
  const closeKit = (rec: OpenKit, end: number, expired: boolean) =>
    kitInstances.set(rec.key, [...(kitInstances.get(rec.key) ?? []), { start: rec.start, end, expired, ...(rec.replaces !== undefined ? { replaces: rec.replaces } : {}) }]);
  let staggerOpen: { start: number; until: number } | null = null;
  let lastSample = 0;
  const traced = new Set(o.trace.filter((x) => !x.startsWith("status:") && !x.startsWith("trigger:")));
  const tracedStatuses = new Set(o.trace.filter((x) => x.startsWith("status:")).map((x) => x.slice("status:".length)));
  const tracedTriggers = o.trace.filter((x) => x.startsWith("trigger:")).map((x) => x.slice("trigger:".length));
  const traces: BuffTrace[] = [];
  const statusTraces: StatusTrace[] = [];
  const triggerTraces: TriggerTrace[] = [];
  let triggersNow: TimelineState["triggerState"] = {};
  let tracedNow = new Map<string, number>();
  let statusesNow = new Map<string, TracedStatus>();
  const stops = new Map<string, { readonly first: number; stop: AppliedStop }[]>();
  return {
    sample(st, frame) {
      const seen = new Map<string, Open>();
      for (const { g, owner, id } of o.kitIds) {
        const live = st.buffs.filter((b) => b.id === id && b.owner === owner && b.cast === undefined && activeAt(b, frame));
        for (const op of o.team) {
          const counted = new Map<string, number>();
          for (const b of live) {
            if (!reaches(b, op)) continue;
            const base = `${g}|${op}#${owner}|${id}|${b.appliedAt}|${b.recipients?.join(",") ?? ""}`;
            const n = counted.get(base) ?? 0;
            counted.set(base, n + 1);
            seen.set(`${base}|${n}`, { key: `${g}|${op}`, owner, id, start: b.appliedAt, expiresAt: b.expiresAt });
          }
        }
      }
      // Every kit buff (KitBuff.gameBuff or not), by identity as above.
      const seenKit = new Map<string, OpenKit>();
      for (const b of st.buffs) {
        if (b.cast !== undefined || !activeAt(b, frame)) continue;
        for (const op of o.team) {
          if (!reaches(b, op)) continue;
          const base = `${b.owner}:${b.id}|${op}#${b.appliedAt}|${b.recipients?.join(",") ?? ""}`;
          let n = 0;
          while (seenKit.has(`${base}|${n}`)) n++;
          const k = `${base}|${n}`;
          const was = openKit.get(k)?.replaces;
          seenKit.set(k, { key: `${b.owner}:${b.id}|${op}`, start: b.appliedAt, expiresAt: b.expiresAt, ...(was !== undefined ? { replaces: was } : {}) });
        }
      }
      for (const [k, rec] of openKit) {
        if (seenKit.has(k)) continue;
        const expired = rec.expiresAt <= frame;
        // Ended early with a new instance at the recipient since the last sample: that one replaced it (KitInstance.replaces).
        if (!expired) {
          let by: OpenKit | null = null;
          for (const [k2, v] of seenKit) if (!openKit.has(k2) && v.key === rec.key && v.start > rec.start && v.start <= frame && (!by || v.start > by.start)) by = v;
          if (by) by.replaces = rec.start;
        }
        closeKit(rec, expired ? rec.expiresAt : frame, expired);
      }
      openKit.clear();
      for (const [k, v] of seenKit) openKit.set(k, v);
      // The Stagger window (TimelineState.stagger: until when the enemy is Staggered).
      // One window while it lasts: a time stop or freeze moving its end keeps it (its new end); it closes where it ran
      // out or was ended (a refill, the log's calm hit), and a Stagger after that is a new one.
      // (A Stagger that began after the last sample's ended is a new one: its end less its length is past that end; a
      // stop between the samples only moved the running one's.)
      const until = st.stagger.until !== null && st.stagger.until > frame ? st.stagger.until : null;
      if (staggerOpen && (until === null || (staggerOpen.until <= frame && until - o.staggerFrames() >= staggerOpen.until))) {
        staggerWindows.push({ start: staggerOpen.start, end: Math.min(staggerOpen.until, frame), expired: staggerOpen.until <= frame });
        staggerOpen = null;
      }
      if (until !== null && staggerOpen) staggerOpen.until = until;
      // Its start: its end less its length, but not before the last sample, which had none (a Stagger the log's listing
      // held, holdStagger, ends at the listing's next moment: pending/zmdlogs-d4fb69b036fe.json's from 97.26 s read 86.50 s).
      if (until !== null && !staggerOpen) staggerOpen = { start: Math.max(0, lastSample, until - o.staggerFrames()), until };
      lastSample = frame;
      for (const [k, rec] of open) {
        if (seen.has(k)) continue;
        // Gone: it ran out, or ended early (used up, or replaced by a new instance at its start: the replacement's start is its end).
        const expired = rec.expiresAt <= frame;
        const replacement = [...seen.values()].filter((x) => x.key === rec.key && x.owner === rec.owner && x.id === rec.id && x.start > rec.start && x.start <= frame).map((x) => x.start);
        close(rec.key, rec.start, expired ? rec.expiresAt : replacement.length ? Math.max(...replacement) : frame, expired);
      }
      open.clear();
      for (const [k, v] of seen) open.set(k, v);
    },
    step(st, words) {
      // Per start, caster, priority and kind; a cast may start two there (Purrchena's shielded combo: its frame-0
      // slow-down and its path's, 20 and 18 frames), each matched to the record first seen at least as long.
      const groups = new Map<string, TimelineState["slowdowns"][number][]>();
      for (const x of st.slowdowns) {
        const k = `${x.start}|${x.exempt ?? ""}|${x.priority ?? ""}|${x.ultimate ? 1 : 0}`;
        groups.set(k, [...(groups.get(k) ?? []), x]);
      }
      for (const [k, xs] of groups) {
        const recs = stops.get(k) ?? [];
        const free = new Set(recs);
        for (const x of [...xs].sort((a, b) => a.scales.length - b.scales.length)) {
          const rec = recs.filter((r) => free.has(r) && r.first >= x.scales.length).sort((a, b) => a.first - b.first)[0];
          const stop: AppliedStop = { start: x.start, scales: x.scales, operator: x.exempt ?? null, ultimate: x.ultimate === true, ...(x.priority !== undefined ? { priority: x.priority } : {}) };
          // A reset cuts a running one short: the shortest the steps saw is what the timeline applied.
          if (!rec) recs.push({ first: x.scales.length, stop });
          else {
            free.delete(rec);
            if (x.scales.length < rec.stop.scales.length) rec.stop = stop;
          }
        }
        stops.set(k, recs);
      }
      if (traced.size) {
        const now = new Map<string, number>();
        for (const b of st.buffs) if (b.cast === undefined && traced.has(`${b.owner}:${b.id}`)) now.set(`${b.owner}:${b.id}|${b.appliedAt}`, b.expiresAt);
        for (const [k, to] of now) if (tracedNow.get(k) !== to) traces.push({ buff: k.split("|")[0] as string, appliedAt: Number(k.split("|")[1]), frame: st.frame, step: words, from: tracedNow.get(k) ?? null, to });
        for (const [k, from] of tracedNow) if (!now.has(k)) traces.push({ buff: k.split("|")[0] as string, appliedAt: Number(k.split("|")[1]), frame: st.frame, step: words, from, to: null });
        tracedNow = now;
      }
      if (tracedStatuses.size) {
        const now = enemyStatuses(st, tracedStatuses);
        const same = (a: TracedStatus, b: TracedStatus) => JSON.stringify(a) === JSON.stringify(b);
        for (const [k, to] of now) {
          const from = statusesNow.get(k) ?? null;
          if (!from || !same(from, to)) statusTraces.push({ status: k.split("|")[0] as string, operator: k.split("|")[1] as string, frame: st.frame, step: words, from, to });
        }
        for (const [k, from] of statusesNow) if (!now.has(k)) statusTraces.push({ status: k.split("|")[0] as string, operator: k.split("|")[1] as string, frame: st.frame, step: words, from, to: null });
        statusesNow = now;
      }
      if (tracedTriggers.length && st.triggerState !== triggersNow) {
        for (const [k, to] of Object.entries(st.triggerState)) {
          if (!tracedTriggers.some((spec) => tracesTrigger(spec, k))) continue;
          const from = triggersNow[k];
          if (from && from.readyAt === to.readyAt && from.count === to.count) continue;
          triggerTraces.push({ key: k, frame: st.frame, step: words, from: from ? { readyAt: from.readyAt, count: from.count, world: from.world === true } : null, to: { readyAt: to.readyAt, count: to.count, world: to.world === true } });
        }
        triggersNow = st.triggerState;
      }
    },
    finish(brokenAt) {
      for (const rec of open.values()) close(rec.key, rec.start, brokenAt ?? rec.expiresAt, brokenAt === null && Number.isFinite(rec.expiresAt));
      for (const rec of openKit.values()) closeKit(rec, brokenAt ?? rec.expiresAt, brokenAt === null && Number.isFinite(rec.expiresAt));
      const lastStagger = staggerOpen as { start: number; until: number } | null;
      if (lastStagger) staggerWindows.push({ start: lastStagger.start, end: brokenAt ?? lastStagger.until, expired: brokenAt === null });
      return {
        instances,
        kitInstances,
        staggerWindows,
        traces,
        statusTraces,
        triggerTraces,
        appliedStops: [...stops.values()].flatMap((recs) => recs.map((r) => r.stop)).sort((a, b) => a.start - b.start),
        changes: countChanges(instances, o.edge),
        kitChanges: countChanges(kitInstances, o.edge),
      };
    },
  };
}

/** The enemy's statuses of the names asked for (or every one, for `*`), by `status|applier` (Vulnerable's applier ""). */
function enemyStatuses(st: TimelineState, names: ReadonlySet<string>): Map<string, TracedStatus> {
  const want = (s: string) => names.has(s) || names.has("*");
  const out = new Map<string, TracedStatus>();
  const e = st.enemy;
  for (const x of e.statuses) if (want(x.status)) out.set(`${x.status}|${x.operator}`, { level: x.level, appliedAt: x.appliedAt, expiresAt: x.expiresAt, ...(x.rampHeld ? { rampHeld: x.rampHeld } : {}) });
  for (const x of e.physical) if (want(x.status)) out.set(`${x.status}|${x.operator}`, { level: x.level, appliedAt: x.appliedAt, expiresAt: x.expiresAt });
  for (const x of e.controls) if (want(x.status)) out.set(`${x.status}|${x.operator}`, { level: 1, appliedAt: x.appliedAt, expiresAt: x.expiresAt });
  if (e.vulnerable && want("vulnerable")) out.set("vulnerable|", { level: e.vulnerable.stacks, expiresAt: e.vulnerable.expiresAt });
  // The Arts infliction: its element in the key, its stacks as the level (`status:infliction`).
  if (e.infliction && want("infliction")) out.set(`infliction:${e.infliction.element}|${e.infliction.by?.join(",") ?? ""}`, { level: e.infliction.stacks, expiresAt: e.infliction.expiresAt });
  return out;
}

/** The changes in each key's count: starts and ends at one frame net out (a refresh), each with its slack (REPLAY_EDGE_MS, and an expiry's share of its life). */
export function countChanges(instances: ReadonlyMap<string, readonly Instance[]>, edge: number): Map<string, Change[]> {
  const changes = new Map<string, Change[]>();
  for (const [key, list] of instances) {
    const at = new Map<number, { delta: number; slack: number }>();
    const add = (frame: number, delta: number, slack: number) => {
      const cur = at.get(frame) ?? { delta: 0, slack: 0 };
      at.set(frame, { delta: cur.delta + delta, slack: Math.max(cur.slack, slack) });
    };
    for (const i of list) {
      add(i.start, 1, edge);
      if (Number.isFinite(i.end)) add(i.end, -1, edge + (i.expired ? Math.round(REPLAY_EXPIRY_SLACK * (i.end - i.start)) : 0));
    }
    changes.set(key, [...at].filter(([, c]) => c.delta !== 0).map(([frame, c]) => ({ frame, ...c })).sort((a, b) => a.frame - b.frame));
  }
  return changes;
}
