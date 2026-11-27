// A replay's cast errors that are the code's own (a ReferenceError, a TypeError), not the replay's refusals (no SP, a
// cast it can't make): measure's worker sends them per log and measure.ts reads a part of a split that threw so as "not
// measured alone" (round 21, the interrupted-casts report point 1: a hunk using a name only another hunk declares was
// caught per cast, so every moved log read as losing every landing, a −100% "result"). The messages name identifiers,
// never a log, an operator or a skill: a hold-out's may be printed.

/** The JavaScript engine's own error texts (V8): an undeclared or misused name, a property of undefined. */
const CODE_ERROR = /\bis not defined\b|\bis not a function\b|\bis not iterable\b|\bCannot read propert|\bCannot access '|\bCannot set propert|\bis not a constructor\b|\bundefined is not\b/;

/** The distinct messages among a replay's cast errors (BuffReplay.failed's `error`) that are code errors, the first few. */
export function codeErrors(messages: readonly string[], most = 3): string[] {
  const out: string[] = [];
  for (const m of messages) {
    const line = m.split("\n")[0] ?? "";
    // "the replay stops at <ms> ms: <the error>" (replayrun.ts): the error is the part after the colon.
    const own = line.replace(/^the replay stops at \d+ ms: /, "");
    if (CODE_ERROR.test(own) && !out.includes(own)) out.push(own);
    if (out.length >= most) break;
  }
  return out;
}

/** A measured part's code errors as one sentence (null: none), for "not measured alone". */
export function threwNote(threw: ReadonlyMap<string, readonly string[]>, measured: number): string | null {
  const msgs = [...new Set([...threw.values()].flat())];
  return threw.size ? `the replay threw in ${threw.size} of the ${measured} log(s) measured: ${msgs.slice(0, 2).join("; ")}` : null;
}
