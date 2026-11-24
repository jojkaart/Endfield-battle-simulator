# Misprediction statistics, 2026-11-24: the ×1.5 band of off hits split into its groups (Zhuang Fangyi's Empyrean
# combos by their Stagger origin, the hits in a window with Liino's ultimate projectiles at ×1.5, Alesh's ultimate,
# Ardelia's basic attacks, the rest), with each group's share of the non-stage off |err|.
#   python3 -I scripts/probes/stats/bands.py   (reads scratch/stats/hits.jsonl; build it at the code to judge)
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyze import STAGE  # noqa: E402
from load import load_hits  # noqa: E402

df = load_hits()
df = df[~df.fx.isin(STAGE)]
tot = df[df.off].err.sum()
band = df[df.off & ((df.lr - math.log(1.5)).abs() <= 0.006)].copy()
# Windows: a Liino ultimate projectile at ×1.5 and every off ×1.5 hit within 1.5 s of one in the same fight
liino = band[band.event == "chr_0035_liino_ultimate_skill_projhit"]


def group(r):
    if r.event == "chr_0030_zhuangfy_combo_skill" and str(r.poiseOrigin).endswith("_ult"):
        return "Zhuang Fangyi's Empyrean combo (Stagger origin combo_skill_ult)"
    w = liino[liino.fx == r.fx]
    if len(w) and (w.t - r.t).abs().min() <= 1500:
        return "a team window with Liino's ultimate projectiles at ×1.5"
    if r.opname == "Liino":
        return "Liino, elsewhere"
    if r.event == "chr_0024_deepfin_ultimate_skill":
        return "Alesh's ultimate"
    if r.opname == "Ardelia" and "attack" in r.event:
        return "Ardelia's basic attacks"
    return "other"


band["g"] = band.apply(group, axis=1)
t = band.groupby("g").agg(hits=("err", "size"), err=("err", "sum"), fights=("fx", "nunique"), operators=("opname", "nunique"))
t["share of off |err|"] = (t.err / tot).map(lambda x: f"{100 * x:.1f}%")
print(f"×1.5 band (±0.6%): {len(band)} off hits, {100 * band.err.sum() / tot:.1f}% of the non-stage off |err|")
print(t.sort_values("err", ascending=False).drop(columns="err").to_string())
print("\nfights of the Liino windows: " + ", ".join(sorted(band[band.g.str.startswith('a team window')].fx.unique())))
print("Alesh: " + ", ".join(f"{a} {b}" for (a, b), _ in band[band.g == "Alesh's ultimate"].groupby(["fx", "t"]).size().items()))
