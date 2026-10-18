// Plain-text tables for terminal output.

export function table(header: readonly string[], rows: readonly (readonly string[])[], align: readonly ("l" | "r")[] = []): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const pad = (cells: readonly string[]) =>
    cells
      .map((c, i) => ((align[i] ?? "l") === "r" ? c.padStart(widths[i] ?? 0) : c.padEnd(widths[i] ?? 0)))
      .join("  ")
      .trimEnd();
  return [pad(header), widths.map((w) => "-".repeat(w)).join("  "), ...rows.map(pad)].join("\n");
}

export function num(n: number, digits = 2): string {
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function signedPct(ratio: number): string {
  const v = ratio * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
