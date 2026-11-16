## 2026-10-18: TypeScript project foundation

**Goal:** start roadmap step 3, the code base everything else builds on.

**Done:** npm workspaces (`packages/data`, `packages/engine`), TypeScript
5.9 strict, Vitest 5, ESLint 10 with rules enforcing engine independence
and no `Math.random` / `Date.now`; GitHub Actions CI; cloud session start
hook; `scripts/fetch-data.sh` (sparse fetch of only the listed tables at
the pinned commits: 4.5 s and 63 MB instead of minutes and 3.5 GB). Data
loader with strict, source-aware field readers, exact int64 parsing, and
normalisers for BattleConst, SkillPatchTable and CharacterTable;
cross-check of all three between rmxlinux and 555me passes; spot checks
against values verified on the web. Engine has only unit types so far
(frames at 30 FPS, seconds, ratios). 22 tests plus the extension's.

**Decisions:**
- The account importer waits until the system is verified and finds
  useful new rotations (owner).
- Number equality across sources: identical, or the same float32 with one
  side exactly float32 (555me prints shortest decimals, rmxlinux full
  float32; some fields are doubles).
- Packages export TypeScript sources directly; no build step until needed.
- TypeScript stays 5.9: typescript-eslint doesn't support 6.1+ yet.

**Problems:**
- Liino's `chr_0035_liino_normal_skill_combo` repeats the blackboard key
  `music_trigger` with the same value at every level; same-value repeats
  are accepted, conflicting ones fail.
- Vitest 3 pulled in tinypool with critical advisories; upgraded to 5.
- Root `"type": "module"` broke the extension's CommonJS tests; the
  extension folder has its own `package.json`.
