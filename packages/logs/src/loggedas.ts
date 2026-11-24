// The likely-loggedAs screen (stats-candidates report point 1, round 11): a hit whose landing has a kit buff's modifier
// and whose listing has a game buff no kit buff stands for (enginecheck.ts logOnly: the check adds it as a "log buff")
// with the same zone, element and value, from the kit buff's owner or under its equipment's id. The check then counts
// one effect twice: the kit buff's own game buff is another file (the Endministrator's and Chen Qianyu's weapon "ready"
// buffs: the kit's gameBuff `_exist`, the listed one the attached `_valid` with the modifier; Yvonne's P5 child), and
// every view showed it as a state error ("engine has it, the log doesn't"); finding it took a hit row read by hand and
// a scan (scripts/probes/stats/doublecount.py). The fix is the kit buff's `loggedAs` (packages/data/kits/).
//
// `zmdlogs differences` lists the pairs; the pending suite (tests/slow/pending.ts) fails on one LOGGED_AS_EXPLAINED
// doesn't name, as the offsets screen does.

import type { GameData } from "@efsim/engine";
import { logOnly, teamBuffNames } from "./enginecheck.ts";
import type { LogFixture, LogHit } from "./zmdlogs.ts";

/** A kit buff and an unmapped listed game buff with the same effect at some hits. */
export interface LoggedAsPair {
  /** `owner:id` */
  readonly kitBuff: string;
  readonly gameBuff: string;
  readonly hits: number;
  /** The first hit's time (ms). */
  readonly first: number;
}

/** Pairs looked at and kept as they are (a coincidence of value, not one effect): `kit buff|game buff` and why. */
export const LOGGED_AS_EXPLAINED: ReadonlyMap<string, string> = new Map();

/** What the screen reads of a landing's modifier (LandedHit.modifiers, or a hit record's landing.modifiers parsed). */
export interface ScreenModifier {
  readonly zone: string;
  readonly element?: string | null;
  readonly value: number;
  readonly kitBuff?: { readonly owner: string; readonly id: string };
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-3 * Math.max(1, Math.abs(a), Math.abs(b));

/** A kit buff id's equipment prefix (`wpn_sword_0021.ready` → wpn_sword_0021), or null for an operator's own buff. */
const equipmentOf = (id: string) => (id.includes(".") ? id.slice(0, id.indexOf(".")) : null);

/**
 * A fight's likely-loggedAs pairs: at each hit with a landing (`landingOf`), every kit modifier of the landing (its
 * kitBuff) against every log-only effect of the hit (logOnly: no kit buff stands for it, not an engine status, not the
 * hitter's food) with the same zone, element and value (≠ 0), the effect from the kit buff's owner (LogEffect.source)
 * or named under its equipment's id (`buff_wpn_sword_0021_valid` for `wpn_sword_0021.ready`).
 */
export function loggedAsPairs(data: GameData, fx: LogFixture, landingOf: (h: LogHit) => { readonly modifiers: readonly ScreenModifier[] } | null): LoggedAsPair[] {
  const names = teamBuffNames(data, fx);
  const pairs = new Map<string, { kitBuff: string; gameBuff: string; hits: number; first: number }>();
  for (const h of [...fx.hits].sort((a, b) => a.t - b.t)) {
    const l = landingOf(h);
    if (!l) continue;
    const kit = l.modifiers.filter((m) => m.kitBuff !== undefined && m.value !== 0);
    if (!kit.length) continue;
    const { effects } = logOnly(data, fx, names, h);
    const seen = new Set<string>();
    for (const m of kit) {
      const { owner, id } = m.kitBuff as { owner: string; id: string };
      const eq = equipmentOf(id);
      for (const e of effects) {
        if (e.zone !== m.zone || (e.element ?? null) !== (m.element ?? null) || !near(e.value, m.value)) continue;
        if (e.source !== owner && !(eq && e.buff.includes(eq))) continue;
        const key = `${owner}:${id}|${e.buff}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const p = pairs.get(key) ?? { kitBuff: `${owner}:${id}`, gameBuff: e.buff, hits: 0, first: h.t };
        p.hits++;
        pairs.set(key, p);
      }
    }
  }
  return [...pairs.values()].sort((a, b) => b.hits - a.hits || a.kitBuff.localeCompare(b.kitBuff));
}

/** The pairs LOGGED_AS_EXPLAINED doesn't name. */
export function unexplainedLoggedAs(pairs: readonly LoggedAsPair[]): LoggedAsPair[] {
  return pairs.filter((p) => !LOGGED_AS_EXPLAINED.has(`${p.kitBuff}|${p.gameBuff}`));
}

/** `zmdlogs differences`' section: the pairs over some fights, each with its hits, fights and the fix. */
export function loggedAsLines(perFight: readonly { readonly label: string; readonly pairs: readonly LoggedAsPair[] }[]): string[] {
  const by = new Map<string, { kitBuff: string; gameBuff: string; hits: number; fights: string[] }>();
  for (const f of perFight)
    for (const p of f.pairs) {
      const key = `${p.kitBuff}|${p.gameBuff}`;
      const r = by.get(key) ?? { kitBuff: p.kitBuff, gameBuff: p.gameBuff, hits: 0, fights: [] };
      r.hits += p.hits;
      r.fights.push(`${f.label} ${(p.first / 1000).toFixed(2)} s`);
      by.set(key, r);
    }
  const head = "Likely loggedAs (loggedas.ts): a kit buff's modifier and a listed game buff no kit buff stands for, with the same zone, element and value at one hit, from the kit buff's owner or under its equipment's id: the check counts one effect twice (the kit buff's `loggedAs` is the fix)";
  if (!by.size) return [`${head}: none`];
  return [
    `${head}:`,
    ...[...by.values()].sort((a, b) => b.hits - a.hits).map((r) => `  ${r.kitBuff} ~ ${r.gameBuff}: ${r.hits} hit(s) in ${r.fights.length} fight(s) (first ${r.fights.slice(0, 4).join(", ")}${r.fights.length > 4 ? ", …" : ""})${LOGGED_AS_EXPLAINED.has(`${r.kitBuff}|${r.gameBuff}`) ? ` [explained: ${LOGGED_AS_EXPLAINED.get(`${r.kitBuff}|${r.gameBuff}`)}]` : ""}`),
  ];
}
