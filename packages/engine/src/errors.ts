/** An input the engine can't simulate correctly. Never caught to fall back (design principle 7). */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}
