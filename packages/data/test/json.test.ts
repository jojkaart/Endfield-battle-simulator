import { describe, expect, it } from "vitest";
import { parseJsonExact } from "../src/index.ts";

describe("parseJsonExact", () => {
  it("keeps int64 IDs exact as strings", () => {
    expect(parseJsonExact('{"id": -941115005296393099}')).toEqual({ id: "-941115005296393099" });
    expect(parseJsonExact("[12345678901234567890]")).toEqual(["12345678901234567890"]);
  });

  it("keeps them exact in exponent notation and with a fraction", () => {
    expect(parseJsonExact("[1e20, 9.1E+15, 12345678901234567.5]")).toEqual(["1e20", "9.1E+15", "12345678901234567.5"]);
    expect(parseJsonExact('{"a": 0.30000001192092896, "b": 1.5e-7}')).toEqual({ a: 0.30000001192092896, b: 1.5e-7 });
  });

  it("leaves ordinary numbers alone", () => {
    expect(parseJsonExact('{"a": 1.7799999713897705, "b": 9007199254740991, "c": -3}')).toEqual({
      a: 1.7799999713897705,
      b: 9007199254740991,
      c: -3,
    });
  });
});
