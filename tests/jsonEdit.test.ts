// Formatting-preserving JSON edits (packages/cli/src/jsonEdit.ts), which efsim kit-trim uses on the kit files.

import { describe, expect, it } from "vitest";
import { addPropertyEdit, applyEdits, canonicalJson, parseSpans, prop, removePropertyEdit } from "@efsim/cli";

const text = `{
  "a": 1,
  "b": { "x": [1, 2], "y": "s,}" },
  "c": [true, null]
}
`;

describe("jsonEdit", () => {
  it("records each value's span", () => {
    const root = parseSpans(text);
    const b = prop(root, "b");
    expect(b && text.slice(b.span.start, b.span.end)).toBe('{ "x": [1, 2], "y": "s,}" }');
  });

  it("removes a property and its separator, the last one too", () => {
    const root = parseSpans(text);
    expect(applyEdits(text, [removePropertyEdit(root, "a")])).toBe(`{
  "b": { "x": [1, 2], "y": "s,}" },
  "c": [true, null]
}
`);
    expect(applyEdits(text, [removePropertyEdit(root, "c")])).toBe(`{
  "a": 1,
  "b": { "x": [1, 2], "y": "s,}" }
}
`);
    const b = prop(root, "b") as NonNullable<ReturnType<typeof prop>>;
    expect(applyEdits(text, [removePropertyEdit(b, "y")])).toContain('"b": { "x": [1, 2] },');
    expect(() => removePropertyEdit(parseSpans('{"only": 1}'), "only")).toThrow();
  });

  it("adds a property on its own line, or after a space on one line", () => {
    const root = parseSpans(text);
    expect(applyEdits(text, [addPropertyEdit(text, root, "a", "n", "[]")])).toContain('  "a": 1,\n  "n": [],\n  "b"');
    const b = prop(root, "b") as NonNullable<ReturnType<typeof prop>>;
    expect(applyEdits(text, [addPropertyEdit(text, b, "x", "z", "0")])).toContain('{ "x": [1, 2], "z": 0, "y"');
  });

  it("compares values whatever their key order", () => {
    expect(canonicalJson({ b: [1, { d: 1, c: 2 }], a: undefined })).toBe(canonicalJson({ b: [1, { c: 2, d: 1 }] }));
  });
});
