import { describe, expect, it } from "vitest";
import { compare, sameNumber } from "../src/index.ts";

describe("sameNumber", () => {
  it("treats a float32 written in full and its shortest decimal as equal", () => {
    expect(sameNumber(1.7799999713897705, 1.78)).toBe(true);
    expect(sameNumber(0.004999999888241291, 0.005)).toBe(true);
    expect(sameNumber(4, 4)).toBe(true);
  });

  it("doesn't merge different values or two non-float32 doubles", () => {
    expect(sameNumber(1.78, 1.79)).toBe(false);
    // Both are doubles that round to the same float32; neither is float32.
    expect(sameNumber(22924.36914, 22924.369141)).toBe(false);
  });
});

describe("compare", () => {
  it("reports differences with paths", () => {
    expect(compare({ a: [1, 2], b: "x", c: 1 }, { a: [1, 3], b: "y", d: 1 })).toEqual([
      { path: ".a[1]", a: 2, b: 3 },
      { path: ".b", a: "x", b: "y" },
      { path: ".c", a: 1, b: undefined },
      { path: ".d", a: undefined, b: 1 },
    ]);
    expect(compare([1, 2], [1])).toEqual([{ path: ".length", a: 2, b: 1 }]);
    expect(compare({ x: 1.7799999713897705 }, { x: 1.78 })).toEqual([]);
  });
});
