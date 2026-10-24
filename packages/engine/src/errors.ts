/** An input the engine can't simulate correctly. Never caught to fall back (design principle 7), except as below. */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}

/**
 * A kit value that reads what only a fight knows (an event's count, stacks,
 * consumed inflictions, the enemy, a buff's layers, a condition the context
 * leaves open), asked for without it. In a simulation the timeline gives
 * every such context, so there it is a bug like any other error. Static
 * checks that try readings without a fight's state (the log checker) catch
 * this one, and only this one: that reading doesn't apply. It isn't an
 * EngineError (it wasn't before it had its own class, 2026-10-24), so what
 * catches EngineErrors doesn't start catching it.
 */
export class NeedsSituation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeedsSituation";
  }
}

/**
 * A kit hit asked for in a situation that rules it out (KitHit.if false, or
 * undecided without an assumption: computeHit). An EngineError, as it was
 * before it had its own class; the log checker catches this one only, for
 * a reading under which the hit doesn't happen.
 */
export class HitRuledOut extends EngineError {
  constructor(message: string) {
    super(message);
    this.name = "HitRuledOut";
  }
}

/** Whether an error only says a reading doesn't apply (NeedsSituation, HitRuledOut): what a static check may catch. */
export function readingDoesNotApply(e: unknown): boolean {
  return e instanceof NeedsSituation || e instanceof HitRuledOut;
}
