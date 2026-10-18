/** A table didn't have the shape or values we rely on. Never caught to fall back. */
export class DataError extends Error {
  constructor(
    readonly source: string,
    readonly path: string,
    message: string,
  ) {
    super(`${source}: ${path}: ${message}`);
    this.name = "DataError";
  }
}
