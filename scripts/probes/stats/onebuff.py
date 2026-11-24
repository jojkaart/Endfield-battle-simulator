# Kit buff leads, 2026-11-24 (docs/open-problems.md "Misprediction statistics"): one kit buff's "one buff the log's
# way" hits (analyze.py's first explanation), per fight: time, operator, event, logged ÷ primary, the counterfactual's
# kind (engine: the engine has it, the log doesn't; log: the other way; values: both, other values) and the hit's
# differences about it. Reads the tables build.ts writes (scratch/stats/); stage logs left out as in analyze.py.
#
#   python3 -I scripts/probes/stats/onebuff.py <buff regex> [fx…]
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from load import load_hits  # noqa: E402
import analyze  # noqa: E402

pat = re.compile(sys.argv[1])
fxs = set(sys.argv[2:])
df = load_hits()
df = df[~df.fx.isin(analyze.STAGE)].copy()
analyze.explain(df)
w = df[df.off & df.expl.str.startswith("one buff") & df.explWhat.fillna("").str.contains(pat)]
if fxs:
    w = w[w.fx.isin(fxs)]
for fx, g in w.groupby("fx"):
    print(f"\n== {fx} ({len(g)} hits, err {g.err.sum():.0f}) team {g.team.iloc[0]}")
    for _, r in g.sort_values("t").iterrows():
        diffs = "; ".join(f"{d.get('what')}:{d.get('kind', '')}" for d in (r.differences or []) if pat.search(str(d.get("what", ""))))
        print(f"  {r.t / 1000:8.2f}s {r.opname:14s} {r.event[-40:]:40s} r={r.r:.3f} {r.explKind:7s} {r.explWhat} | {diffs}")
