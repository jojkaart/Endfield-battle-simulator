// English display names, from rmxlinux's I18nTextTable_EN. Names are for
// display and lookup only; the engine works with internal IDs.

import { DataError } from "./errors.ts";
import { get, obj, str, type Ctx } from "./fields.ts";
import { readTable } from "./sources.ts";

export class Names {
  private readonly text: Map<string, string>;

  constructor() {
    const ctx: Ctx = { source: "rmxlinux", path: "I18nTextTable_EN" };
    const table = obj(readTable("rmxlinux", "I18nTextTable_EN"), ctx);
    this.text = new Map(Object.entries(table).map(([id, t]) => [id, str(t, { ...ctx, path: `${ctx.path}.${id}` })]));
  }

  /** Resolves a `{id, text}` text reference. */
  resolve(ref: unknown, ctx: Ctx): string {
    const r = obj(ref, ctx);
    const inline = get(r, "text", ctx, str);
    if (inline !== "") return inline;
    const id = String(r["id"]);
    const text = this.text.get(id);
    if (text === undefined) throw new DataError(ctx.source, ctx.path, `no English text for id ${id}`);
    return text;
  }
}
