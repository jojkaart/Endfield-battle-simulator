import { describe, expect, it } from "vitest";
import { parseJsonExact } from "../src/index.ts";

describe("parseJsonExact", () => {
  it("keeps int64 IDs exact as strings", () => {
    expect(parseJsonExact('{"id": -941115005296393099}')).toEqual({ id: "-941115005296393099" });
    expect(parseJsonExact("[12345678901234567890]")).toEqual(["12345678901234567890"]);
  });

  it("leaves ordinary numbers alone", () => {
    expect(parseJsonExact('{"a": 1.7799999713897705, "b": 9007199254740991, "c": -3}')).toEqual({
      a: 1.7799999713897705,
      b: 9007199254740991,
      c: -3,
    });
  });
});
