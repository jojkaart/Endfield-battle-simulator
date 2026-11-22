// The CLI's commands, in the order the usage text lists them. A new command: a module here (command.ts `command`),
// added to this list.

import type { Command } from "../command.ts";
import find from "./find.ts";
import template from "./template.ts";
import calc from "./calc.ts";
import compare from "./compare.ts";
import edge from "./edge.ts";
import simulate from "./simulate.ts";
import search from "./search.ts";
import rules from "./rules.ts";
import payoffs from "./payoffs.ts";
import diagnose from "./diagnose.ts";
import gear from "./gear.ts";
import zmdlogs from "./zmdlogs.ts";
import gamedata from "./gamedata.ts";
import kit from "./kit.ts";
import repair from "./repair.ts";
import assumptions from "./assumptions.ts";
import kitDraft from "./kit-draft.ts";
import kitCensus from "./kit-census.ts";
import kitTrim from "./kit-trim.ts";
import cache from "./cache.ts";

export const COMMANDS: readonly Command[] = [find, template, calc, compare, edge, simulate, search, rules, payoffs, diagnose, gear, repair, assumptions, zmdlogs, gamedata, kit, kitDraft, kitCensus, kitTrim, cache];
