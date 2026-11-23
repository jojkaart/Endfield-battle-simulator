// scripts/verify-at.ts --test: a new test run at the base commit should fail there; what vitest's output says of it.
import { describe, expect, it } from "vitest";
import { baseOutcome } from "../scripts/verify-at.ts";

describe("verify-at --test", () => {
  it("reads a base run as failing, passing, or not runnable there", () => {
    expect(baseOutcome(1, "AssertionError: expected 1 to be 2\n Tests  1 failed | 3 skipped (4)")).toBe("fails");
    expect(baseOutcome(0, " Tests  1 passed | 11 skipped (12)")).toBe("passes");
    expect(baseOutcome(0, " Tests  12 skipped (12)")).toBe("unrunnable");
    expect(baseOutcome(1, "SyntaxError: The requested module '@efsim/logs' does not provide an export named 'notAClock'")).toBe("unrunnable");
  });
});
