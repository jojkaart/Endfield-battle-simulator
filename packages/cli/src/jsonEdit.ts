// Edits of hand-formatted JSON files (the kits) that keep their formatting:
// a parser that records where each value is in the text, and removing or
// adding an object's property in place.

/** Where a value is in the text: [start, end). */
export interface Span {
  readonly start: number;
  readonly end: number;
}

export type JsonNode =
  | { readonly kind: "object"; readonly span: Span; readonly props: readonly { readonly key: string; readonly keySpan: Span; readonly value: JsonNode }[] }
  | { readonly kind: "array"; readonly span: Span; readonly items: readonly JsonNode[] }
  | { readonly kind: "scalar"; readonly span: Span };

/** Parses JSON text into nodes with their spans (the values themselves come from JSON.parse of a span). */
export function parseSpans(text: string): JsonNode {
  let i = 0;
  const ws = () => {
    while (i < text.length && /\s/.test(text[i] as string)) i++;
  };
  const fail = (what: string): never => {
    throw new Error(`JSON: ${what} at offset ${i}`);
  };
  const string = (): Span => {
    const start = i;
    if (text[i] !== '"') fail("expected a string");
    i++;
    while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    if (i >= text.length) fail("unterminated string");
    i++;
    return { start, end: i };
  };
  const value = (): JsonNode => {
    ws();
    const start = i;
    const c = text[i];
    if (c === "{") {
      i++;
      const props: { key: string; keySpan: Span; value: JsonNode }[] = [];
      ws();
      if (text[i] === "}") {
        i++;
        return { kind: "object", span: { start, end: i }, props };
      }
      for (;;) {
        ws();
        const keySpan = string();
        ws();
        if (text[i] !== ":") fail("expected :");
        i++;
        props.push({ key: JSON.parse(text.slice(keySpan.start, keySpan.end)) as string, keySpan, value: value() });
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          return { kind: "object", span: { start, end: i }, props };
        }
        fail("expected , or }");
      }
    }
    if (c === "[") {
      i++;
      const items: JsonNode[] = [];
      ws();
      if (text[i] === "]") {
        i++;
        return { kind: "array", span: { start, end: i }, items };
      }
      for (;;) {
        items.push(value());
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return { kind: "array", span: { start, end: i }, items };
        }
        fail("expected , or ]");
      }
    }
    if (c === '"') return { kind: "scalar", span: string() };
    const m = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 64));
    if (!m) fail("unexpected character");
    i += (m as RegExpExecArray)[0].length;
    return { kind: "scalar", span: { start, end: i } };
  };
  const root = value();
  ws();
  if (i !== text.length) fail("trailing text");
  return root;
}

/** The property node of an object node, if it has one. */
export function prop(node: JsonNode, key: string): JsonNode | undefined {
  return node.kind === "object" ? node.props.find((p) => p.key === key)?.value : undefined;
}

/** A text edit: replace [start, end) with `text`. */
export interface TextEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/**
 * The edit that removes a property from an object: from its key to the next
 * property's key (its comma and line break with it), or, when it's the last,
 * from the end of the property before it.
 */
export function removePropertyEdit(obj: JsonNode, key: string): TextEdit {
  if (obj.kind !== "object") throw new Error("not an object");
  const k = obj.props.findIndex((p) => p.key === key);
  if (k < 0) throw new Error(`no property ${key}`);
  const p = obj.props[k] as (typeof obj.props)[number];
  const next = obj.props[k + 1];
  if (next) return { start: p.keySpan.start, end: next.keySpan.start, text: "" };
  const prev = obj.props[k - 1];
  if (!prev) throw new Error(`can't remove ${key}, the object's only property`);
  return { start: prev.value.span.end, end: p.value.span.end, text: "" };
}

/**
 * The edit that adds a property after an existing one, on a line of its own
 * at the same indentation when the object is written over several lines, else
 * after a space. `valueText` is the new value's JSON text.
 */
export function addPropertyEdit(text: string, obj: JsonNode, afterKey: string, key: string, valueText: string): TextEdit {
  if (obj.kind !== "object") throw new Error("not an object");
  const p = obj.props.find((x) => x.key === afterKey);
  if (!p) throw new Error(`no property ${afterKey}`);
  const lineStart = text.lastIndexOf("\n", p.keySpan.start - 1) + 1;
  const before = text.slice(lineStart, p.keySpan.start);
  const sep = /^\s*$/.test(before) ? `\n${before}` : " ";
  return { start: p.value.span.end, end: p.value.span.end, text: `,${sep}${JSON.stringify(key)}: ${valueText}` };
}

/** JSON with every object's keys sorted (undefined fields left out), so two values compare equal whatever order their fields were written in. */
export function canonicalJson(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canonicalJson).join(",")}]`;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(x);
}

/** Applies edits that don't overlap. */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (let k = 1; k < sorted.length; k++) if ((sorted[k] as TextEdit).end > (sorted[k - 1] as TextEdit).start) throw new Error("overlapping edits");
  let out = text;
  for (const e of sorted) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}
