// Kit triggers and the actions they run (KitTrigger, events.ts), and the buffs and stacks they give.

import type { SkillType } from "../attributes.ts";
import type { Build } from "../build.ts";
import { decide, evalContext, type Situation, skillValue } from "../damage.ts";
import { EngineError } from "../errors.ts";
import { type KitBuff, landingFrames, resolveApplication, type StackGain } from "../model.ts";
import { allActions, type BattleEvent, type BuffCategory, causeMatches, eventMatches, type KitTrigger, triggerSkillId } from "../events.ts";
import { type EvalContext, evaluate } from "../expr.ts";
import { type ActiveBuff, applyBuff, buffEndedEvent, buffReach, endBuff, endBuffFor, extendBuff, reaches, withBuff } from "../buffs.ts";
import { applyToEnemy, expireStatus } from "../status.ts";
import { FPS } from "../units.ts";
import type { Origin, PendingHit, Stacks, TimelineContext, TimelineState } from "./state.ts";
import { COMBO_WINDOW_FRAMES, LINK_FRAMES, hasteFrames } from "./rules.ts";
import { panelAt, skillCosts, timingOf } from "./context.ts";
import { shiftEnemy } from "./clock.ts";
import { cooldownEnd, dealPoise, gainEnergy, gainSp, maxEnergy, rateProgress, rateReady, rebaseCooldowns, spGrantOf } from "./resources.ts";
import { actionFrame, ownWindowSkills, playheadOf } from "./timing.ts";
import { artsIntensity, attackerSide, eventCountOf, eventSourceOf, healEvents, situationAt, statusTweaks, triggerSituation } from "./situation.ts";
import { asEvents, delayBursts, draw, landHit, recordStatus } from "./landing.ts";
import { castSkill, endCurrentSkill, takeJump } from "./casting.ts";
import { schedule } from "./schedule.ts";

/**
 * A kit buff applied: what it is for triggers on buff categories (buffReach: categories and the elements each
 * reaches) and whom it reaches (the operators of its last applied instance; none for an enemy buff).
 */
export function buffAppliedEvent(ctx: TimelineContext, frame: number, operator: string, def: KitBuff, fromKind: SkillType | "none", applied: ActiveBuff | null): BattleEvent {
  const reach = buffReach(def);
  const recipients = !applied || applied.target === "enemy" ? [] : ctx.scenario.team.map((b) => b.operator).filter((m) => reaches(applied, m));
  return { type: "buffApplied", frame, operator, buff: def.id, categories: Object.keys(reach) as BuffCategory[], reach, recipients, fromKind, ...(def.gameBuff ? { gameBuff: def.gameBuff } : {}) };
}

/**
 * Applies one of an owner's kit buffs (values for `skillId`); a filtered
 * team buff reaches the members its `recipients` holds for. Returns the
 * state and whether it was applied (a 0 s buff isn't).
 */
export function addBuff(ctx: TimelineContext, st: TimelineState, owner: string, skillId: string, def: KitBuff, frame: number, situation: Situation, only?: readonly string[], untilFrame?: number): { state: TimelineState; applied: boolean; buff: ActiveBuff | null } {
  const build = ctx.builds.get(owner) as Build;
  const panel = panelAt(ctx, owner, frame);
  let recipients: readonly string[] | undefined = only;
  if (only && def.target !== "team") throw new EngineError(`${owner} buff ${def.id}: only a team buff can go to one operator`);
  if (def.recipients && def.target === "team") {
    const filter = def.recipients;
    recipients = ctx.scenario.team
      .filter((m) => !only || only.includes(m.operator))
      .filter((m) => decide(filter, evalContext(ctx.data, m, panelAt(ctx, m.operator, frame), skillId, { ...situationAt(ctx, m.operator, st, frame), owner })))
      .map((m) => m.operator);
  }
  let b = applyBuff(ctx.data, build, panel, skillId, def, frame, situation, recipients);
  if (b && (def.endsWithCast || untilFrame !== undefined)) {
    // It ends with its owner's current skill: at the skill's end (or at its frame `untilFrame`), or earlier if the owner starts another.
    const cur = st.acting[owner];
    const index = st.casts.findLastIndex((c) => c.operator === owner);
    const end = cur ? actionFrame(cur, Math.min(timingOf(ctx, cur.skill).durationFrames, untilFrame ?? Infinity)) : -1;
    b = cur && index >= 0 && end > frame ? { ...b, expiresAt: Math.min(b.expiresAt, end), endsWithCast: index } : null;
  }
  if (!b) return { state: st, applied: false, buff: null };
  // A ticking buff whose tick hits keep an ATK snapshot (KitHit.atkSnapshot) takes its owner's attacker side now.
  if (b.every !== undefined && snapshotTicks(ctx, owner, def.id)) b = { ...b, snapshot: attackerSide(st, owner, frame) };
  const buffs = withBuff(st.buffs, b);
  // An instance weaker than the ones a buff keeps isn't applied (KitBuff.instances).
  return { state: rebaseCooldowns(ctx, st, { ...st, buffs }, frame), applied: buffs.includes(b), buff: b };
}

/** Whether one of an owner's buffTick triggers on a buff lands a hit with an ATK snapshot (KitHit.atkSnapshot). */
function snapshotTicks(ctx: TimelineContext, owner: string, buff: string): boolean {
  return (ctx.kits.get(owner)?.triggers ?? []).some((t) => t.on.event === "buffTick" && "buff" in t.on && t.on.buff === buff && allActions(t.do).some((a) => a.kind === "hits" && a.hits.some((h) => h.atkSnapshot)));
}

/** The stacks whose count differs between two snapshots of an operator's stacks. */
export function changedStacks(was: Readonly<Record<string, number>>, now: Readonly<Record<string, number>>): string[] {
  return [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((k) => (was[k] ?? 0) !== (now[k] ?? 0));
}

export function gainStacks(ctx: TimelineContext, stacks: Stacks, owner: string, gains: readonly StackGain[], ec: EvalContext): Stacks {
  let out = stacks;
  for (const g of gains) {
    if (g.if && !decide(g.if, ec)) continue;
    const def = ctx.kits.get(owner)?.stacks.find((x) => x.id === g.stack);
    if (!def) throw new EngineError(`${owner} has no stack ${g.stack}`);
    const own = out[owner] ?? {};
    const amount = evaluate(g.amount, ec);
    // Negative gains use stacks up, down to 0.
    out = { ...out, [owner]: { ...own, [g.stack]: Math.max(0, Math.min(def.max, (own[g.stack] ?? 0) + amount)) } };
  }
  return out;
}

/** At most this many events in one chain of triggers (a loop in kit data is an error, not a hang). */
const MAX_CHAIN = 500;

/**
 * Runs every team member's triggers on a chain of events, in order; what
 * they do can add events to the chain. `only` limits which triggers the
 * initial events run (a hit's own status events: KitTrigger.beforeDamage);
 * `reactOnInitial: false` leaves the engine's own reactions to them
 * (freezes, Lift stagger) to a later run.
 */
export function runTriggers(ctx: TimelineContext, state: TimelineState, initial: readonly BattleEvent[], origin: Origin | null, only?: (t: KitTrigger) => boolean, reactOnInitial = true): TimelineState {
  let st = state;
  const queue = [...initial];
  const first = new Set(initial);
  for (let n = 0; queue.length > 0; n++) {
    if (n > MAX_CHAIN) throw new EngineError(`more than ${MAX_CHAIN} chained events at frame ${queue[0]?.frame}: a trigger loop in the kits?`);
    const e = queue.shift() as BattleEvent;
    // The engine's own reactions to an event (freezes, Lift stagger) happen once: for a hit's own status events
    // after its damage, not in the before-damage run, so buffs the hit applies are frozen with the enemy too.
    const engine = reactOnInitial || !first.has(e);
    // A control status that freezes the enemy stops its clock (overlapping freezes count once).
    if (engine && e.type === "status" && e.event.kind === "control" && e.event.freezes && !ctx.scenario.target.controlImmune) {
      const end = e.frame + e.event.frames;
      const lost = Math.max(0, end - Math.max(e.frame, st.enemyFrozenUntil));
      st = { ...shiftEnemy(st, e.frame, lost), enemyFrozenUntil: Math.max(st.enemyFrozenUntil, end) };
    }
    // Lift and Knock Down stagger: 10 × (1 + AI/200) of the applier.
    if (engine && e.type === "status" && e.event.kind === "physical" && (e.event.status === "lift" || e.event.status === "knockdown") && ctx.builds.has(e.operator)) {
      const r = dealPoise(ctx, st, e.operator, 10 * (1 + artsIntensity(ctx, st, e.operator, e.frame) / 200), e.frame);
      st = r.state;
      queue.push(...r.events);
    }
    // A combo window that lasts while a buff is active closes when it ends (and doesn't reopen with a new instance).
    if (e.type === "buffEnded" && Object.values(st.comboWindow).some((w) => w.whileBuff === e.buff)) {
      const prefix = `${e.operator}>`;
      st = { ...st, comboWindow: Object.fromEntries(Object.entries(st.comboWindow).filter(([k, w]) => !(w.whileBuff === e.buff && (k === e.operator || k.startsWith(prefix))))) };
    }
    // Every trigger on this event judges its condition on the situation at the event, before any of them acts
    // (the game raises the event for all its listeners at once: an equipment set still sees what its owner's trigger consumes).
    const atEvent = st;
    for (const b of ctx.scenario.team) {
      const owner = b.operator;
      for (const t of ctx.kits.get(owner)?.triggers ?? []) {
        if (only && first.has(e) && !only(t)) continue;
        if (!eventMatches(t.on, e, owner, st.stacks[owner] ?? {}) || !causeMatches(t.by, e, owner, t.on)) continue;
        const subject = e.type === "heal" ? e.target : e.operator;
        const key = t.cooldownPer === "eventSubject" ? `${owner}:${t.id}:${subject}` : `${owner}:${t.id}`;
        const ts = st.triggerState[key];
        if (ts && ((ts.readyAt ?? 0) > e.frame || (t.maxCount !== undefined && ts.count >= t.maxCount))) continue;
        // Per cast: counted for the cast whose hit caused the event.
        const cast = e.type === "hit" || e.type === "status" ? e.cast : undefined;
        const castKey = t.maxPerCast !== undefined && cast !== undefined ? `${owner}:${t.id}@${cast}` : undefined;
        if (castKey && (st.triggerState[castKey]?.count ?? 0) >= (t.maxPerCast as number)) continue;
        const panel = panelAt(ctx, owner, e.frame);
        const ec = evalContext(ctx.data, b, panel, triggerSkillId(owner, t), triggerSituation(ctx, owner, atEvent, e));
        if (t.if && !decide(t.if, ec)) continue;
        if (t.chance !== undefined) {
          const roll = draw(ctx, st, "chance");
          st = roll.state;
          if (roll.value >= evaluate(t.chance, ec)) continue;
        }
        const cooldown = t.cooldown === undefined ? 0 : Math.round(evaluate(t.cooldown, ec) * FPS);
        st = { ...st, triggerState: { ...st.triggerState, [key]: { readyAt: e.frame + cooldown, count: (ts?.count ?? 0) + 1 } } };
        if (castKey) st = { ...st, triggerState: { ...st.triggerState, [castKey]: { readyAt: 0, count: (st.triggerState[castKey]?.count ?? 0) + 1 } } };
        if (t.delay) {
          // A detached trigger's actions are the cast's own until their launch.
          const cast = e.type === "cast" && e.cast !== undefined && (!t.detached || t.launch !== undefined) ? { cast: { operator: e.operator, index: e.cast } } : undefined;
          // A cast's own effects at frames play at its speed, as its hits do (Haste).
          const acting = e.type === "cast" ? st.acting[e.operator] : undefined;
          const scaled = (f: number) => (acting && acting.frame === e.frame ? hasteFrames(f, acting.speed) : f);
          const launch = t.detached && t.launch !== undefined && cast ? { detached: true as const, launchAt: e.frame + scaled(t.launch) } : {};
          // On its cast's operator's clock (as the cast's hits), else its owner's.
          st = schedule(st, [{ kind: "action", frame: e.frame + scaled(t.delay), clock: { operator: cast?.cast.operator ?? owner }, owner, trigger: t.id, event: e, origin, ...cast, ...launch, ...(t.awaited ? { awaited: true } : {}), ...(t.afterHits ? { afterHits: true } : {}) }]);
          continue;
        }
        const r = runActions(ctx, st, t, owner, e, origin, atEvent);
        st = r.state;
        queue.push(...r.events);
      }
    }
  }
  return st;
}

/**
 * Does what a trigger says, as its owner, at the event's frame: its actions, in order; returns the events they
 * caused. `atEvent`: the state at its event, before
 * any trigger on it acted: a buff takes its values from it, as the
 * trigger's `if` does (Grizzled Edge sees the crystals its owner's Crush
 * consumes); delayed actions read the state when they run.
 */
export function runActions(ctx: TimelineContext, state: TimelineState, t: KitTrigger, owner: string, e: BattleEvent, origin: Origin | null, atEvent?: TimelineState): { state: TimelineState; events: BattleEvent[] } {
  let st = state;
  const events: BattleEvent[] = [];
  const frame = e.frame;
  const build = ctx.builds.get(owner) as Build;
  const panel = panelAt(ctx, owner, frame);
  let consumed = 0;
  const ec = () => evalContext(ctx.data, build, panel, triggerSkillId(owner, t), triggerSituation(ctx, owner, st, e, consumed));
  // Each action with its place in the trigger (triggerActionAt): a chosen option's actions run next, in place.
  const work = t.do.map((a, i) => ({ a, place: [i] }));
  for (let next = work.shift(); next; next = work.shift()) {
    const { a, place } = next;
    if (a.if && !decide(a.if, ec())) continue;
    switch (a.kind) {
      case "openCombo": {
        // An operator's own combo doesn't open its window, except a window of its own skills (its next sequence).
        if (!a.skills && origin && origin.operator === owner && origin.kind === "combo") break;
        // Not while every combo the window is for is on cooldown (the regular window: those without one of their own, and cast with one).
        const own = ownWindowSkills(ctx, owner);
        const combos = (ctx.kits.get(owner)?.skills ?? []).filter((s) => s.kind === "combo" && (a.skills ? a.skills.includes(s.skillId) : s.comboWindow !== false && !own.has(s.skillId)));
        if (combos.length > 0 && combos.every((s) => (st.readyAt[s.skillId] ?? 0) > frame)) break;
        const until = frame + (a.seconds === undefined ? (a.whileBuff ? Infinity : COMBO_WINDOW_FRAMES) : Math.round(evaluate(a.seconds, ec()) * FPS));
        for (const key of a.skills ? a.skills.map((id) => `${owner}>${id}`) : [owner]) {
          // The window keeps the largest count of the events that opened it (Si's finisher reads it).
          const open = st.comboWindow[key];
          const count = Math.max(eventCountOf(e), open && open.until >= frame ? open.count : 0);
          // …and what the latest event that opened or refreshed it was (Antal's combo repeats it: assumed, the data overwrites it).
          const source = eventSourceOf(e) ?? (open && open.until >= frame ? open.source : undefined);
          st = { ...st, comboWindow: { ...st.comboWindow, [key]: { from: frame, until, count, ...(source ? { source } : {}), ...(a.whileBuff ? { whileBuff: a.whileBuff } : {}) } } };
        }
        break;
      }
      case "apply": {
        const ai = artsIntensity(ctx, st, owner, frame);
        for (const app of a.applies) {
          if (app.if && !decide(app.if, ec())) continue;
          const resolved = resolveApplication(app, (v) => evaluate(v, ec()), eventSourceOf(e));
          if (!resolved) continue;
          const side = st;
          const r = applyToEnemy(expireStatus(st.enemy, frame), resolved, frame, owner, ai, (key) => skillValue(ctx.data, panel, build, triggerSkillId(owner, t), key), statusTweaks(ctx, st, owner, frame), () => attackerSide(side, owner, frame));
          const fromKind = origin && origin.operator === owner ? origin.kind : "none";
          const d = delayBursts(ctx, { ...st, enemy: r.state }, r.events, fromKind);
          st = recordStatus(ctx, d.state, d.now, r.state);
          for (const x of r.events) if (x.kind === "consumed") consumed += x.stacks;
          events.push(...asEvents(d.now, fromKind));
        }
        break;
      }
      case "gain":
      {
        const was = st.stacks[owner] ?? {};
        st = { ...st, stacks: gainStacks(ctx, st.stacks, owner, a.gains, ec()) };
        events.push({ type: "stacks", frame, operator: owner, changed: changedStacks(was, st.stacks[owner] ?? {}) });
      }
        break;
      case "energy": {
        const v = evaluate(a.value, ec());
        st = gainEnergy(ctx, st, owner, a.percentOfMax ? v * maxEnergy(ctx, owner) : v, frame, a);
        break;
      }
      case "clearEnergy":
        st = { ...st, energy: { ...st.energy, [owner]: 0 } };
        break;
      case "sp":
        {
          const amount = evaluate(a.value, ec());
          const grant = spGrantOf(ctx, triggerSkillId(owner, t), a.value, a.spKind);
          st = gainSp(st, amount, frame, grant.kind);
          if (amount > 0) events.push({ type: "sp", frame, operator: owner, amount, kind: origin && origin.operator === owner ? origin.kind : "none", natural: grant.kind === "natural", ...(grant.sourceType !== undefined ? { sourceType: grant.sourceType } : {}) });
        }
        break;
      case "buff": {
        const def = ctx.kits.get(owner)?.buffs.find((x) => x.id === a.buff);
        if (!def) throw new EngineError(`${owner} has no buff ${a.buff}`);
        const subject = a.to === "eventSubject" ? [e.type === "heal" ? e.target : e.operator] : undefined;
        const layers = a.layers === undefined ? 1 : Math.max(0, Math.round(evaluate(a.layers, ec())));
        // This application's own duration (the same buff, so one layer cap: BuffApplication.duration).
        const applying = a.duration !== undefined ? { ...def, duration: a.duration } : def;
        let applied: ActiveBuff | null = null;
        for (let i = 0; i < layers; i++) {
          const r = addBuff(ctx, st, owner, triggerSkillId(owner, t), applying, frame, triggerSituation(ctx, owner, atEvent ?? st, e, consumed), subject, a.untilFrame);
          st = r.state;
          if (r.applied) applied = r.buff;
        }
        if (applied) events.push(buffAppliedEvent(ctx, frame, owner, def, origin && origin.operator === owner ? origin.kind : "none", applied));
        break;
      }
      case "extendBuff": {
        const buffs = extendBuff(st.buffs, a.buff, owner, frame, Math.round(evaluate(a.seconds, ec()) * FPS));
        if (buffs) st = rebaseCooldowns(ctx, st, { ...st, buffs }, frame);
        break;
      }
      case "heal":
        events.push(...healEvents(ctx, st, owner, a.target === "eventOperator" ? [e.operator] : a.target, frame, a.healKind ?? "none"));
        break;
      case "endBuff": {
        const r = a.to === "eventSubject"
          ? endBuffFor(st.buffs, a.buff, owner, frame, e.type === "heal" ? e.target : e.operator, ctx.scenario.team.map((b) => b.operator))
          : endBuff(st.buffs, a.buff, owner, frame, a.layers);
        // For one member only: the buff goes on for the others (the state changes, no buffEnded).
        if (!r.ended && a.to === "eventSubject") st = { ...st, buffs: r.buffs };
        if (r.ended) {
          st = rebaseCooldowns(ctx, st, { ...st, buffs: r.buffs }, frame);
          events.push(buffEndedEvent(r.gone, frame, true));
        }
        break;
      }
      case "link": {
        const n = Math.max(0, Math.round(evaluate(a.count ?? 1, ec())));
        const until = frame + Math.round(evaluate(a.seconds ?? LINK_FRAMES / FPS, ec()) * FPS);
        st = { ...st, link: [...st.link.filter((f) => f > frame), ...Array.from({ length: n }, () => until)] };
        // Link stacks are the team's: every member gains them (BattleEvent linkGained).
        if (n > 0) events.push(...ctx.scenario.team.map((b): BattleEvent => ({ type: "linkGained", frame, operator: b.operator, from: owner, count: n })));
        break;
      }
      case "endAction": {
        const r = endCurrentSkill(st, owner, frame);
        st = rebaseCooldowns(ctx, st, { ...r.state, acting: Object.fromEntries(Object.entries(r.state.acting).filter(([k]) => k !== owner)) }, frame);
        events.push(...r.events);
        break;
      }
      case "jump": {
        const cur = st.acting[owner];
        if (!cur || cur.skill !== a.skill || cur.cast === undefined) break;
        // The playhead: real frames since the start, plus what jumps skipped, in skill frames.
        const playhead = playheadOf(cur, frame);
        if (playhead < a.from || playhead >= a.until || a.to <= playhead) break;
        const r = takeJump(st, { kind: "jump", frame, clock: { operator: owner }, cast: { operator: owner, index: cur.cast }, operator: owner, from: playhead, to: a.to });
        st = rebaseCooldowns(ctx, st, r.state, frame);
        events.push(...r.events);
        break;
      }
      case "cancelHits":
        st = { ...st, scheduled: st.scheduled.filter((h) => !(h.kind === "hit" && h.operator === owner && h.trigger?.id === a.trigger)) };
        break;
      case "cooldown": {
        const who = a.who === "self" ? owner : a.who === "eventOperator" ? e.operator : ctx.scenario.team[a.who.slot]?.operator;
        if (!who) break;
        const v = evaluate("seconds" in a ? a.seconds : "fraction" in a ? a.fraction : "set" in a ? a.set : a.setFraction, ec());
        const readyAt = { ...st.readyAt };
        for (const s of ctx.kits.get(who)?.skills ?? []) {
          if (s.kind !== a.skills) continue;
          // Setting starts a cooldown whether one runs or not: of `set` seconds, or that fraction of the skill's own full cooldown.
          if ("set" in a || "setFraction" in a) {
            readyAt[s.skillId] = cooldownEnd(ctx, st.buffs, who, s, frame, Math.round("set" in a ? v * FPS : v * skillCosts(ctx, who, s.skillId, frame).cooldownFrames));
            continue;
          }
          // Changes apply only to a running one.
          if ((readyAt[s.skillId] ?? 0) <= frame) continue;
          // A fraction is of the skill's full cooldown (assumed; in-game test 36).
          const change = Math.round("seconds" in a ? v * FPS : v * skillCosts(ctx, who, s.skillId, frame).cooldownFrames);
          // At a recovery rate (attribute 93) the change is to what's left at rate 1.
          if (ctx.comboRates && s.kind === "combo") readyAt[s.skillId] = rateReady(ctx, st.buffs, who, frame, rateProgress(ctx, st.buffs, who, frame, readyAt[s.skillId] ?? 0) + change);
          else readyAt[s.skillId] = Math.max(frame, (readyAt[s.skillId] ?? 0) + change);
        }
        st = { ...st, readyAt };
        break;
      }
      case "cast": {
        // A follow-up the owner casts by itself (CastSkill): no control, cost or cooldown; it ends the owner's current skill.
        const r = castSkill(ctx, st, owner, a.skill, frame, true);
        st = r.state;
        events.push(...r.events);
        break;
      }
      case "hits": {
        const [index, ...nested] = place as [number, ...number[]];
        const pending: PendingHit[] = [];
        // `now`: its frame-0 hits land as the action runs, before the trigger's next action (a DamageAction inside an event handler).
        const landNow: PendingHit[] = [];
        const clock = { operator: owner };
        for (const h of a.hits) {
          // A count that's a value is judged as the action runs.
          (typeof h.count === "number" ? (h.frames ?? Array.from({ length: h.count }, () => 0)) : landingFrames(h, evaluate(h.count, ec()))).forEach((f, i) => {
            const p: PendingHit = {
              kind: "hit", frame: frame + f, clock, operator: owner, skillId: triggerSkillId(owner, t), hitId: h.id, sp: 0, trigger: { id: t.id, action: index, ...(nested.length ? { nested } : {}) },
              ...(h.branch ? { branch: `${owner}:${t.id}:${frame}:${h.branch}:${i}` } : {}), ...(h.fixedDamage !== undefined ? { fixed: evaluate(h.fixedDamage, ec()) } : {}),
              // A tick's hit with an ATK snapshot keeps the attacker side its buff took when applied.
              ...(h.atkSnapshot && e.type === "buffTick" && e.snapshot ? { snapshot: e.snapshot } : {}),
            };
            (a.now && f === 0 ? landNow : pending).push(p);
          });
        }
        st = schedule(st, pending);
        for (const p of landNow) st = landHit(ctx, st, p);
        break;
      }
      case "choose": {
        // One roll whatever the weights, so the stream doesn't depend on them.
        const weights = a.options.map((o) => evaluate(o.weight, ec()));
        if (weights.some((w) => !(w >= 0))) throw new EngineError(`${owner} trigger ${t.id}: choose weights must be ≥ 0 (${weights.join(", ")})`);
        const roll = draw(ctx, st, "chance");
        st = roll.state;
        const total = weights.reduce((x, w) => x + w, 0);
        if (total === 0) break;
        // Option i covers [Σ_{<i} w, Σ_{≤i} w) of the roll × Σ w (rounding past the end: the last positive one).
        const r = roll.value * total;
        let chosen = -1;
        for (let i = 0, sum = 0; i < weights.length; i++) {
          const w = weights[i] as number;
          if (w === 0) continue;
          chosen = i;
          sum += w;
          if (r < sum) break;
        }
        work.unshift(...(a.options[chosen]?.do ?? []).map((x, j) => ({ a: x, place: [...place, chosen, j] })));
        break;
      }
    }
  }
  return { state: st, events };
}
