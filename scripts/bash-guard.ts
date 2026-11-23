// A guard for the shell commands agents run: refuses the forms CLAUDE.md forbids because they damage text silently, a
// heredoc and an inline interpreter script over several lines or with backticks (`python3 -c "…"`, `node -e`, `perl
// -e`, `bash -c`). In a double-quoted argument the shell runs every `code span` of a Markdown text as a command and
// puts its output in its place: round 8's fight totals wrote "the  assumption ()" into docs/open-problems.md that way,
// and three agent rounds in four had one such command slip through, the rule notwithstanding. The safe forms: a file
// written with the Write tool, then one plain command (`node scratch/x.ts`, `python3 -I scratch/x.py`), and for text
// edits `node scripts/edit.ts <edits file>`.
//
// As a Claude Code PreToolUse hook on Bash (the owner wires it in .claude/settings.json; agents don't edit those):
//   { "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command", "command": "node scripts/bash-guard.ts" } ] } ] } }
// it reads the tool call's JSON on stdin and exits 2 with the reason on stderr (the call is refused, the agent reads
// why), else 0. By hand: node scripts/bash-guard.ts --check '<command>' (prints the reason, exit 1; "ok", exit 0).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAFE = "Write the text with the Write tool into scratch/ and run that file with one plain command (node scratch/x.ts, python3 -I scratch/x.py); text replacements: node scripts/edit.ts <edits file> (its header has the format). CLAUDE.md, \"Worktrees and sub-agents\".";

/** An inline interpreter script's flag: python -c, node -e / --eval / -p, perl / ruby -e, sh / bash -c. */
const INLINE = /(?:^|[\s;&|(])(?:python3?|node|perl|ruby|(?:ba|z)?sh)(?:\s+-[A-Za-z]+)*\s+(?:-c|-e|--eval|-p)(?=\s)/;
/** A heredoc (<<WORD, <<-WORD, <<'WORD', <<"WORD"), not a here-string (<<<). */
const HEREDOC = /(?:^|[^<])<<-?\s*(?:'[^']+'|"[^"]+"|\\?[A-Za-z_][\w.-]*)/;

/** Why the command is refused, or undefined. */
export function refusal(command: string): string | undefined {
  // Text inside single quotes can hold "<<" harmlessly only as data; a heredoc there is rare enough to refuse too.
  if (HEREDOC.test(command)) return `a heredoc (CLAUDE.md forbids it: the guard judges the whole text, and a shell expands $ and backticks in an unquoted one). ${SAFE}`;
  if (INLINE.test(command)) {
    if (command.includes("\n")) return `an inline script over several lines (python3 -c / node -e / bash -c with a newline: CLAUDE.md forbids it). ${SAFE}`;
    if (command.includes("`")) return `an inline script with a backtick (in double quotes the shell runs it as a command and puts its output in the text: how docs/open-problems.md got "the  assumption ()"). ${SAFE}`;
  }
  return undefined;
}

function main(argv: readonly string[]): number {
  if (argv[0] === "--check") {
    const why = refusal(argv.slice(1).join(" "));
    process.stdout.write(why ? `refused: ${why}\n` : "ok\n");
    return why ? 1 : 0;
  }
  let input: { tool_name?: string; tool_input?: { command?: unknown } };
  try {
    input = JSON.parse(readFileSync(0, "utf8")) as typeof input;
  } catch {
    return 0; // not a hook call we understand: never block on the guard's own failure
  }
  const command = input.tool_input?.command;
  if ((input.tool_name !== undefined && input.tool_name !== "Bash") || typeof command !== "string") return 0;
  const why = refusal(command);
  if (!why) return 0;
  process.stderr.write(`bash-guard: refused ${why}\n`);
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
