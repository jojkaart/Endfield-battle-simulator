// Committed snapshots of results (tests/snapshots/*.json): a regression baseline, not expected values with
// provenance (docs/design.md principle 11). A test compares what the code gives now with the file; a deliberate
// change is written with EFSIM_UPDATE_SNAPSHOTS=1 (`npm run snapshots:update`), and the file's diff goes in the
// commit with the reason.

import { closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(resolve(dirname(fileURLToPath(import.meta.url))), "snapshots");

/** Whether this run writes the snapshots instead of checking them. */
export const UPDATING = process.env.EFSIM_UPDATE_SNAPSHOTS === "1";

export const UPDATE_HINT = "if the change is deliberate, run `npm run snapshots:update` and commit the snapshot's diff with the reason";

/** A snapshot file: its entries by key, and (when updating) the entries this run gives, written at the end. */
export class Snapshot<T> {
  readonly file: string;
  readonly stored: Readonly<Record<string, T>>;
  private readonly current = new Map<string, T>();

  /** With `compact`, each entry's fields are written one per line (an operator's counts on one line), else indented JSON. */
  private readonly compact: boolean;

  constructor(name: string, compact = false) {
    this.compact = compact;
    this.file = join(DIR, name);
    this.stored = existsSync(this.file) ? (JSON.parse(readFileSync(this.file, "utf8")) as Record<string, T>) : {};
  }

  /** Records an entry; returns the stored one (undefined when there is none). */
  record(key: string, value: T): T | undefined {
    this.current.set(key, value);
    return this.stored[key];
  }

  /**
   * When updating, writes the file: the entries recorded this run over the file as it is now (several test files
   * may share it: a lock keeps their writes apart), less the entries `keep` rejects (a removed example or fixture).
   */
  write(keep: (key: string) => boolean = () => true): void {
    if (!UPDATING) return;
    const lock = `${this.file}.lock`;
    for (let tries = 0; ; tries++) {
      try {
        closeSync(openSync(lock, "wx"));
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST" || tries > 600) throw e;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
    }
    try {
      const onDisk = existsSync(this.file) ? (JSON.parse(readFileSync(this.file, "utf8")) as Record<string, T>) : {};
      const out: Record<string, T> = {};
      const keys = new Set([...Object.keys(onDisk).filter(keep), ...this.current.keys()]);
      for (const k of [...keys].sort()) out[k] = (this.current.has(k) ? this.current.get(k) : onDisk[k]) as T;
      writeFileSync(this.file, this.format(out) + "\n");
    } finally {
      rmSync(lock, { force: true });
    }
  }

  private format(out: Record<string, T>): string {
    const entry = (v: T) =>
      `{\n${Object.entries(v as Record<string, unknown>)
        .map(([f, x]) => `  ${JSON.stringify(f)}: ${JSON.stringify(x)}`)
        .join(",\n")}\n }`;
    return this.compact ? `{\n${Object.entries(out).map(([k, v]) => ` ${JSON.stringify(k)}: ${entry(v)}`).join(",\n")}\n}` : JSON.stringify(out, null, 1);
  }
}
