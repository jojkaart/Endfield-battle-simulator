// Probe (scripts/probes/README.md): team-SP round (2026-11-28): the log replay's team SP between two times, frame by
// frame: every change other than regeneration (a grant or a spend) and the casts at it, so a short cast's SP can be
// followed back (79cc's opening: only Arcane's two Final Strikes' 17.3 SP between 200 at the start and four battle
// skills by 10.73 s).
//
//   node scripts/probes/sp/grants.ts <short id> [from s] [to s] [--assume id=reading]...   (writes nothing)
import { loadGameData } from "@efsim/data";
import { framesOf, secondsOf, spAt } from "@efsim/engine";
import { devFixtures, logBuffReplay } from "@efsim/logs";

const data = loadGameData();
const args = process.argv.slice(2);
const assume: Record<string, string> = {};
for (let i = 0; i < args.length; i++) if (args[i] === "--assume") { const [k, v] = (args[++i] ?? "").split("="); if (k && v) assume[k] = v; }
const pos = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--assume");
const [id, from, to] = [pos[0] ?? "79cc", Number(pos[1] ?? 0), Number(pos[2] ?? 15)];
for (const { short, fx } of devFixtures({ ids: [id] })) {
  const r = logBuffReplay(data, fx, Object.keys(assume).length ? { assume } : {}).replay;
  process.stdout.write(`${short}: the replay's SP from ${from} to ${to} s, changes beyond regeneration (8/s) and casts\n`);
  let prev: { f: number; sp: number } | null = null;
  for (let f = framesOf(from); f <= framesOf(to); f++) {
    const st = r.stateAt(f);
    if (!st) continue;
    const sp = spAt(st, f);
    if (prev) {
      const d = sp - prev.sp;
      const p = prev;
      const castsBetween = st.casts.filter((c) => c.frame > p.f && c.frame <= f);
      if (Math.abs(d) > (8 * (f - p.f)) / 30 + 0.01 || castsBetween.length) {
        process.stdout.write(`${secondsOf(f).toFixed(2)} SP ${p.sp.toFixed(1)} -> ${sp.toFixed(1)} (${d >= 0 ? "+" : ""}${d.toFixed(1)})${castsBetween.map((c) => `  [${data.operators[c.operator]?.name} ${c.skill.replace(/^chr_\d+_[a-z]+_/, "")}]`).join("")}\n`);
      }
    }
    prev = { f, sp };
  }
}
