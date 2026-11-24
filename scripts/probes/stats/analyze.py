# Misprediction statistics, 2026-11-24 (docs/analysis/2026-11-24-misprediction-stats.md): every table of the
# analysis from the tables scripts/probes/stats/build.ts, names.ts and buffprops.ts write (scratch/stats/).
#
#   python3 -I scripts/probes/stats/analyze.py [section…] > scratch/stats/report.txt
#
# Sections: summary, explain, buffs, clusters, features, interactions, tree, onesided, fights (default: all).
# Development logs only (the builder never reads a hold-out). The stage logs (7b54, 6339, 8915, c6d8: shields and
# phase factors, OFFSETS_EXPLAINED) are reported apart and left out of the attribution.

import json
import math
import os
import sys
from collections import Counter, defaultdict

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from load import D, load_fights, load_hits, load_onesided, name  # noqa: E402

pd.set_option("display.width", 250)
pd.set_option("display.max_rows", 200)
pd.set_option("display.max_colwidth", 70)
STAGE = {"7b54", "6339", "8915", "c6d8"}
RNG = np.random.default_rng(20261124)
B = 300  # bootstrap resamples (fights)
SHUFFLES = 20


def pct(x):
    return f"{100 * x:.1f}%"


def head(t):
    print(f"\n## {t}\n")


# ---------------------------------------------------------------- the per-hit frame with explanations

def best_cf(r, boundary=False):
    """The counterfactual reading nearest the logged value: one difference the log's way (default), or one boundary
    kit buff on / off or Stagger toggled at a boundary (`boundary`)."""
    best = None
    for c in r.cf if isinstance(r.cf, list) else []:
        if c["reading"] is None or c["kind"] == "crit" or c["kind"].startswith("boundary") != boundary:
            continue
        rd = c["reading"] * (r.Pc / r.predicted if r.predicted else 1)
        e2 = abs(r.V - rd)
        if best is None or e2 < best[0]:
            best = (e2, c)
    return best


def fight_op_offsets(df):
    """A fight-operator's tight factor: the median lr of its non-crit kit hits, half of them within 0.3%, |median| ≥ 1%."""
    out = {}
    base = df[(df.critLog == "no crit") & (df.nature == "kit hit") & df.has]
    for (fx, op), w in base.groupby(["fx", "operator"]):
        if len(w) < 8:
            continue
        m = w.lr.median()
        if abs(m) >= 0.01 and ((w.lr - m).abs() < 0.003).mean() >= 0.5:
            out[(fx, op)] = m
    return out


def explain(df):
    """Each off hit's first explanation: one disagreement with the log taken the log's way fits; the whole listing
    fits; a tight fight-operator factor; an alternative reading (assumed); the listing with alternatives (fallback);
    Corrosion unquantified; else unexplained."""
    offs = fight_op_offsets(df)
    expl, what, wkind = [], [], []
    for _, r in df.iterrows():
        if not r.off:
            expl.append("on")
            what.append(None)
            wkind.append(None)
            continue
        b = best_cf(r)
        tol = max(1.5, 0.001 * r.V)
        off = offs.get((r.fx, r.operator))
        w, k = None, None
        if b and b[0] <= tol:
            e = "Stagger the log's way" if b[1]["what"] == "Stagger" else f"one buff ({b[1]['kind']})"
            w, k = b[1]["what"], b[1]["kind"]
        elif r.logFits:
            e = "the listing (several buffs)"
        elif (bb := best_cf(r, True)) and bb[0] <= tol:
            e = f"a boundary buff ({bb[1]['kind']})"
            w, k = bb[1]["what"], bb[1]["kind"]
        elif off is not None and abs(r.lr - off) < 0.003:
            e = "fight-operator factor"
        elif r.cls == "assumed":
            e = "an alternative reading"
        elif r.cls == "fallback":
            e = "listing + alternatives"
        elif r.cls == "unquantified":
            e = "Corrosion unquantified"
        else:
            e = f"unexplained ({r.cls})"
        expl.append(e)
        what.append(w)
        wkind.append(k)
    df["expl"] = expl
    df["explWhat"] = what
    df["explKind"] = wkind
    return offs


def boot_share(df, mask_col, value, weight="err", B=B):
    fights = df.fx.unique()
    by = {f: g for f, g in df.groupby("fx")}
    shares = []
    for _ in range(B):
        pick = RNG.choice(fights, size=len(fights), replace=True)
        num = den = 0.0
        for f in pick:
            g = by[f]
            num += g.loc[g[mask_col] == value, weight].sum()
            den += g[weight].sum()
        shares.append(num / den if den else 0)
    return np.percentile(shares, [2.5, 97.5])


def shuffled_share(df, col, value, weight="err", n=SHUFFLES):
    vals = []
    for _ in range(n):
        s = df.groupby("fx")[col].transform(lambda x: x.sample(frac=1, random_state=int(RNG.integers(1 << 30))).values)
        vals.append(df.loc[s == value, weight].sum() / df[weight].sum())
    return float(np.mean(vals)), float(np.percentile(vals, 97.5)), float(np.percentile(vals, 2.5))


# ---------------------------------------------------------------- sections

def summary(all_df, df, fights):
    head("Data summary")
    print(f"Fights {all_df.fx.nunique()} (verified {fights[fights.group=='verified'].shape[0]}, development {fights[fights.group=='development'].shape[0]}, earlier pending {fights[fights.group=='earlier'].shape[0]}); logged hits {len(all_df)}")
    t = all_df.groupby("group").agg(hits=("V", "size"), off=("off", "sum"), err=("err", "sum"), logged=("V", "sum"))
    t["off%"] = (t.off / t.hits).map(pct)
    t["|err| of logged"] = (t.err / t.logged).map(pct)
    print(t.to_string())
    st = all_df.fx.isin(STAGE)
    print(f"\nStage logs (7b54, 6339, 8915, c6d8): {st.sum()} hits, {all_df[st].off.sum()} off, {pct(all_df[st].err.sum() / all_df.err.sum())} of all |err|; left out from here on.")
    print(f"Non-stage: {len(df)} hits, {df.off.sum()} off ({pct(df.off.mean())}), |err| {df.err.sum():.0f} = {pct(df.err.sum() / df.V.sum())} of the logged damage")
    c = df.groupby("cls").agg(hits=("V", "size"), off=("off", "sum"), err=("err", "sum"))
    c["err share"] = (c.err / df.err.sum()).map(pct)
    print(c.to_string())
    fo = df[df.off].groupby(["fx", "opname"]).err.sum().sort_values(ascending=False)
    cs = (fo.cumsum() / df.err.sum()).values
    print(f"\nConcentration: {len(fo)} fight-operators with an off hit; the top 10 carry {pct(cs[9])}, top 20 {pct(cs[19])}, top 50 {pct(cs[min(49, len(cs)-1)])} of |err|.")
    print(f"Crit flags: off hits whose logged crit flipped fits: {int(sum(1 for _, r in df[df.off].iterrows() for c in (r.cf or []) if c['kind']=='crit' and c['reading'] is not None and abs(r.V - c['reading']) <= max(1.5, 0.001*r.V)))} of {int(df.off.sum())}")


def explain_section(df):
    head("Off hits by first explanation (non-stage)")
    o = df[df.off]
    tot = o.err.sum()
    g = o.groupby("expl").agg(hits=("err", "size"), err=("err", "sum"), fights=("fx", "nunique"), operators=("opname", "nunique"))
    g["share of |err|"] = (g.err / tot).map(pct)
    g["share of off hits"] = (g.hits / len(o)).map(pct)
    print(g.sort_values("err", ascending=False).to_string())
    for e in ["an alternative reading", "listing + alternatives"]:
        w = o[o.expl == e]
        ac = Counter()
        for al in w.assumed:
            for a in set(al):
                ac[a] += 1
        print(f"\n{e}: assumption kinds (hits): " + "; ".join(f"{k} {n}" for k, n in ac.most_common(8)))
    u = o[o.expl.str.startswith("unexplained")]
    print("\nUnexplained by fight and operator (top 25):")
    t = u.groupby(["fx", "opname"]).agg(hits=("err", "size"), err=("err", "sum"), median_ratio=("r", "median")).sort_values("err", ascending=False).head(25)
    t["share"] = (t.err / tot).map(pct)
    t["median_ratio"] = t.median_ratio.round(3)
    print(t.to_string())
    print("\nUnexplained by operator and skill kind (top 20):")
    t = u.groupby(["opname", "skillKind"]).agg(hits=("err", "size"), err=("err", "sum"), fights=("fx", "nunique"), median_ratio=("r", "median")).sort_values("err", ascending=False).head(20)
    t["share"] = (t.err / tot).map(pct)
    t["median_ratio"] = t.median_ratio.round(3)
    print(t.to_string())


def buffs_section(df):
    head("One buff the log's way: by kit buff and by mechanism (non-stage)")
    with open(os.path.join(D, "buffs.json")) as f:
        props = json.load(f)
    o = df[df.off]
    tot = o.err.sum()
    w = o[o.expl.str.startswith("one buff")].copy()
    w["buff"] = w.explWhat

    def mech(r):
        keys = r.buff.split(" + ")
        p = [props.get(k, {}) for k in keys]
        origin = "/".join(sorted({x.get("origin", "?") for x in p}))
        target = "/".join(sorted({x.get("target", "?") for x in p}))
        consumed = "consumed" if any(x.get("consumedBy") for x in p) else "-"
        inst = "instances" if any(x.get("instances") is not None for x in p) else "-"
        on = "/".join(sorted({e for x in p for e in x.get("on", [])})) or "-"
        return pd.Series({"m_origin": origin, "m_target": target, "m_consumed": consumed, "m_instances": inst, "m_on": on})

    w = pd.concat([w, w.apply(mech, axis=1)], axis=1)
    w["buff"] = w.buff.map(lambda b: " + ".join(sorted({x.split(":")[1] for x in b.split(" + ")}))[:60] + f" ({name(b.split(' + ')[0].split(':')[0])})")
    g = w.groupby(["buff", "explKind"]).agg(hits=("err", "size"), err=("err", "sum"), fights=("fx", "nunique"), median_ratio=("r", "median")).sort_values("err", ascending=False)
    g["share"] = (g.err / tot).map(pct)
    g["median_ratio"] = g.median_ratio.round(3)
    print(g.head(30).to_string())
    for col in ["explKind", "m_origin", "m_target", "m_consumed", "m_instances", "m_on"]:
        t = w.groupby(col).agg(hits=("err", "size"), err=("err", "sum"), fights=("fx", "nunique"), buffs=("buff", "nunique"))
        t["share of all off |err|"] = (t.err / tot).map(pct)
        print(f"\nby {col}:")
        print(t.sort_values("err", ascending=False).head(12).to_string())
    t = w.groupby(["explKind", "m_consumed", "m_origin"]).agg(hits=("err", "size"), err=("err", "sum"), fights=("fx", "nunique"), buffs=("buff", "nunique"))
    t["share"] = (t.err / tot).map(pct)
    print("\nby kind × consumed × origin:")
    print(t.sort_values("err", ascending=False).head(15).to_string())


def clusters(df):
    head("Ratio clusters of off hits (non-stage; logged ÷ the primary reading)")
    o = df[df.off & (df.lr.abs() < 3)].copy()
    tot = df[df.off].err.sum()
    step = 0.004
    o["b"] = np.round(o.lr / step) * step
    h = o.groupby("b").agg(n=("err", "size"), err=("err", "sum")).reindex(np.round(np.arange(o.b.min(), o.b.max() + step / 2, step) / step) * step, fill_value=0)
    sm = h.n.rolling(5, center=True, min_periods=1).mean()
    base = h.n.rolling(51, center=True, min_periods=1).median()
    peaks = []
    vals = sm.values
    for i in range(2, len(vals) - 2):
        if vals[i] == max(vals[i - 2 : i + 3]) and vals[i] >= 2.5 * max(base.values[i], 1) and h.n.values[i - 1 : i + 2].sum() >= 25:
            peaks.append(h.index[i])
    rows = []
    for p in peaks:
        w = o[(o.lr - p).abs() <= step * 1.5]
        cf = Counter()
        for _, r in w.iterrows():
            b = best_cf(r)
            if b and b[0] <= max(1.5, 0.001 * r.V):
                cf[b[1]["what"].split(" + ")[0] + f" ({b[1]['kind']})"] += 1
        top_op = w.groupby("opname").err.sum().sort_values(ascending=False)
        top_fx = w.groupby("fx").size().sort_values(ascending=False)
        dc = Counter(d for ds in w.diffs for d in ds)
        rows.append({
            "ratio": round(math.exp(p), 3), "hits": len(w), "err": f"{pct(w.err.sum() / tot)}", "fights": w.fx.nunique(), "operators": w.opname.nunique(),
            "top fights": ", ".join(f"{k} {v}" for k, v in top_fx.head(3).items()),
            "top operators (err)": ", ".join(top_op.head(3).index),
            "stagger log/eng": f"{(w.staggerPair=='log+engine').mean():.0%}",
            "one buff fits": f"{sum(cf.values())}: " + "; ".join(f"{k} {n}" for k, n in cf.most_common(2)),
            "commonest difference": "; ".join(f"{k[:55]} {n}" for k, n in dc.most_common(1)),
        })
    print(pd.DataFrame(rows).to_string(index=False))
    # Fixed factors the zones could miss: each one's band of off hits and their spread over fights
    print("\nNamed factors (±0.4%): hits, share of off |err|, fights, operators")
    for name, f in [("×1.3 (Stagger's DMG Taken)", 1.3), ("÷1.3", 1 / 1.3), ("×1.5 (Crit DMG 50%)", 1.5), ("÷1.5", 1 / 1.5), ("×1.1", 1.1), ("÷1.1", 1 / 1.1), ("×1.2", 1.2), ("÷1.2", 1 / 1.2), ("×1.18", 1.18), ("×1.15", 1.15), ("×0.9", 0.9), ("×2", 2.0), ("×0.5", 0.5)]:
        w = o[(o.lr - math.log(f)).abs() <= 0.004]
        print(f"  {name:28s} {len(w):5d} {pct(w.err.sum() / tot):>6s} {w.fx.nunique():3d} {w.opname.nunique():3d}  top: " + ", ".join(f"{a} {b}" for (a, b), _ in w.groupby(['fx', 'opname']).size().sort_values(ascending=False).head(3).items()))


FEATURES = ["opname", "skillKind", "nature", "hitElement", "critLog", "critSource", "staggerPair", "staggerNear", "inStop", "hold", "cut", "nearEnd", "nearAway",
            "sinceCastBin", "tBin", "tS", "ageBin", "dtBin", "corrosion", "enemySt", "layered", "selfControlled", "spTopUp", "beforeStop", "diffKinds", "parser", "stage", "group", "hasBoundary", "boundaryKitBuff"]


def prep_features(df):
    df["hasBoundary"] = df.boundary > 0
    df["boundaryKitBuff"] = df.boundaryKit.map(lambda b: "kit" if isinstance(b, list) and b else "none") if "boundaryKit" in df else "?"
    df["tS"] = pd.cut(df.t / 1000, [0, 10, 20, 40, 60, 90, 120, 200, 600]).astype(str)
    for c in FEATURES:
        df[c] = df[c].astype(str)


def features(df):
    head("Where the error concentrates: by feature value (non-stage; every hit)")
    print("err share: of all |err|; hits share: of all hits; lift = err share ÷ hits share; CI: 95% over 300 resamples of whole fights;")
    print("within-fight shuffle: the err share when the feature's values are shuffled inside each fight (mean of 20): a share")
    print("near it is the fights' doing, not the hits'. off rate: the share of its hits off (size-independent: |err| favours big")
    print("hits), against the overall rate; shuffled off rate likewise. Rows: err lift ≥ 1.5 or ≤ 0.5 with ≥ 1% err share, or")
    print("an off rate ×1.4 / ×0.6 the overall with ≥ 200 hits; by err share.\n")
    tot = df.err.sum()
    base = df.off.mean()
    rows = []
    for col in FEATURES:
        for v, g in df.groupby(col):
            es = g.err.sum() / tot
            hs = len(g) / len(df)
            if hs == 0:
                continue
            lift = es / hs
            ol = g.off.mean() / base
            if not ((es >= 0.01 and not 0.5 < lift < 1.5) or (len(g) >= 200 and not 0.6 < ol < 1.4)):
                continue
            rows.append((col, v, len(g), int(g.off.sum()), g.fx.nunique(), es, hs, lift, g.off.mean()))
    rows.sort(key=lambda x: -x[5])
    out = []
    df["_off"] = df.off.astype(float)
    for col, v, n, off, nf, es, hs, lift, orate in rows[:50]:
        lo, hi = boot_share(df, col, v)
        sh, _, _ = shuffled_share(df, col, v)
        so, _, _ = shuffled_share(df, col, v, weight="_off")
        so_rate = so * df.off.sum() / n
        out.append({"feature": col, "value": v[:34], "hits": n, "fights": nf, "err share": pct(es), "CI": f"{pct(lo)}–{pct(hi)}", "hits share": pct(hs), "err lift": round(lift, 2), "shuffled": pct(sh), "off rate": pct(orate), "shuffled off rate": pct(so_rate), "survives": ("err " if abs(es - sh) > 0.25 * max(es, sh) else "") + ("off" if abs(orate - so_rate) > 0.25 * max(orate, so_rate) else "") or "no"})
    print(f"overall off rate {pct(base)}")
    print(pd.DataFrame(out).to_string(index=False))


def drift(df):
    head("Time in fight: the off rate's drift (non-stage)")
    d = df[df.has]
    t = d.groupby("tS", observed=True).agg(hits=("off", "size"), off_rate=("off", "mean"), fights=("fx", "nunique"))
    t["off_rate"] = t.off_rate.map(pct)
    print(t.to_string())
    up = down = 0
    for _, g in d.groupby("fx"):
        a, b = g[g.tFrac < 0.5].off.mean(), g[g.tFrac >= 0.5].off.mean()
        up += b > a
        down += b < a
    n = up + down
    p = sum(math.comb(n, k) for k in range(max(up, down), n + 1)) / 2 ** n * 2
    print(f"\nPer fight, the second half's off rate above the first's in {up} fights, below in {down} (sign test, two-sided p = {p:.2f})")
    for label, m in [("first 10 s", d.t < 10000), ("10 s on", d.t >= 10000)]:
        w = d[m & d.off]
        print(f"{label}: off rate {pct(d[m].off.mean())}; of its off hits, one buff the log's way {pct(w.expl.str.startswith('one buff').mean())}, a fight-operator factor {pct((w.expl == 'fight-operator factor').mean())}, unexplained {pct(w.expl.str.startswith('unexplained').mean())}")


def boundary(df):
    head("Buffs starting or ending at the hit (the log's boundary effects; non-stage)")
    d = df[df.has]
    tot = d.err.sum()
    print(f"hits with a boundary effect: {pct(d.hasBoundary.eq('True').mean())}; their off rate {pct(d[d.hasBoundary == 'True'].off.mean())} against {pct(d[d.hasBoundary == 'False'].off.mean())}")
    print(f"with a team kit buff among them: {pct(d.boundaryKitBuff.eq('kit').mean())} of hits, off rate {pct(d[d.boundaryKitBuff == 'kit'].off.mean())}; boundary only log-only buffs: off rate {pct(d[(d.hasBoundary == 'True') & (d.boundaryKitBuff != 'kit')].off.mean())}")
    rows = []
    cnt = Counter(b for bs in d.boundaryBuffs for b in bs)
    for b, n in cnt.most_common(60):
        m = d.boundaryBuffs.map(lambda bs: b in bs)
        g = d[m]
        rows.append({"buff": b[:58], "hits": n, "fights": g.fx.nunique(), "off rate": pct(g.off.mean()), "err share": pct(g.err.sum() / tot), "kit": "kit" if g.boundaryKit.map(lambda k: bool(k)).any() else "-"})
    rows.sort(key=lambda r: -float(r["err share"][:-1]))
    print(pd.DataFrame(rows[:20]).to_string(index=False))
    o = d[d.off]
    w = o[o.expl.str.startswith("a boundary buff")]
    print(f"\nOff hits a boundary kit buff taken the other way fits (after one difference and the listing): {len(w)} hits, {pct(w.err.sum() / o.err.sum())} of off |err|, {w.fx.nunique()} fights")
    t = w.groupby(["explWhat", "explKind"]).agg(hits=("err", "size"), err=("err", "sum"), fights=("fx", "nunique"), median_ratio=("r", "median")).sort_values("err", ascending=False).head(15)
    t["share"] = (t.err / o.err.sum()).map(pct)
    t["median_ratio"] = t.median_ratio.round(3)
    print(t.drop(columns="err").to_string())
    ob = o[o.hasBoundary == "True"]
    print("Off hits with a boundary effect, by first explanation: " + "; ".join(f"{k} {pct(v)}" for k, v in (ob.groupby("expl").err.sum() / ob.err.sum()).sort_values(ascending=False).head(8).items()))
    # The same hit kinds with and without a boundary effect: is it the hit or the boundary?
    print("\nOff rate with / without a boundary effect within each skill kind and Stagger pair:")
    for k, g in d.groupby(["skillKind", "staggerPair"]):
        if len(g) < 300:
            continue
        a, b = g[g.hasBoundary == "True"], g[g.hasBoundary == "False"]
        if len(a) >= 50 and len(b) >= 50:
            print(f"  {k[0]:9s} {k[1]:11s} with {pct(a.off.mean()):>6s} ({len(a)}), without {pct(b.off.mean()):>6s} ({len(b)})")


def interactions(df):
    head("Interactions: pairs of feature values with err share well above both alone (non-stage)")
    tot = df.err.sum()
    cols = ["opname", "skillKind", "nature", "staggerPair", "inStop", "cut", "sinceCastBin", "enemySt", "diffKinds", "critLog", "layered", "hold"]
    rows = []
    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            for (va, vb), g in df.groupby([a, b]):
                if len(g) < 30:
                    continue
                es = g.err.sum() / tot
                if es < 0.01:
                    continue
                hs = len(g) / len(df)
                la = df.loc[df[a] == va].err.sum() / tot / (df[a] == va).mean()
                lb = df.loc[df[b] == vb].err.sum() / tot / (df[b] == vb).mean()
                lift = es / hs
                if lift > 1.5 * max(la, lb):
                    rows.append({"pair": f"{a}={va[:25]} × {b}={vb[:25]}", "hits": len(g), "fights": g.fx.nunique(), "err share": pct(es), "lift": round(lift, 2), "lift a": round(la, 2), "lift b": round(lb, 2)})
    rows.sort(key=lambda r: -float(r["err share"][:-1]))
    print(pd.DataFrame(rows[:30]).to_string(index=False))


# A small regression tree (CART) on min(|lr|, 0.7), one-hot features, as a screen.
def one_hot(df, cols, min_n=40):
    X, names = [], []
    for c in cols:
        for v, n in df[c].value_counts().items():
            if n >= min_n:
                X.append((df[c] == v).values)
                names.append(f"{c}={v}")
    return np.array(X).T, names


def tree(X, y, depth, min_leaf, names, idx=None, prefix=""):
    if idx is None:
        idx = np.arange(len(y))
    node = {"n": len(idx), "mean": float(y[idx].mean()) if len(idx) else 0.0}
    if depth == 0 or len(idx) < 2 * min_leaf:
        return node
    yi = y[idx]
    base = ((yi - yi.mean()) ** 2).sum()
    best = None
    for j in range(X.shape[1]):
        m = X[idx, j]
        nl = m.sum()
        if nl < min_leaf or len(idx) - nl < min_leaf:
            continue
        a, b = yi[m], yi[~m]
        gain = base - ((a - a.mean()) ** 2).sum() - ((b - b.mean()) ** 2).sum()
        if best is None or gain > best[0]:
            best = (gain, j)
    if not best or best[0] <= 0:
        return node
    j = best[1]
    m = X[idx, j]
    node.update({"split": names[j], "gain": best[0] / max(1e-12, ((y - y.mean()) ** 2).sum()), "yes": tree(X, y, depth - 1, min_leaf, names, idx[m]), "no": tree(X, y, depth - 1, min_leaf, names, idx[~m])})
    return node


def predict(node, X, names):
    out = np.zeros(len(X))
    for i in range(len(X)):
        n = node
        while "split" in n:
            n = n["yes"] if X[i, names.index(n["split"])] else n["no"]
        out[i] = n["mean"]
    return out


def show(node, indent=""):
    if "split" not in node:
        print(f"{indent}leaf n={node['n']} mean |lr|={node['mean']:.4f}")
        return
    print(f"{indent}{node['split']} (n={node['n']}, mean {node['mean']:.4f}, gain {pct(node['gain'])})")
    show(node["yes"], indent + "  yes: ")
    show(node["no"], indent + "  no:  ")


def lasso(X, y, lam, iters=60):
    Xs = X.astype(float)
    mu, sd = Xs.mean(0), Xs.std(0) + 1e-9
    Z = (Xs - mu) / sd
    yc = y - y.mean()
    w = np.zeros(Z.shape[1])
    r = yc.copy()
    n = len(y)
    for _ in range(iters):
        for j in range(Z.shape[1]):
            r += Z[:, j] * w[j]
            rho = Z[:, j] @ r / n
            w[j] = np.sign(rho) * max(abs(rho) - lam, 0)
            r -= Z[:, j] * w[j]
    return w


def tree_section(df):
    head("Screen: a regression tree and a lasso on min(|ln(logged ÷ predicted)|, 0.7), held out by whole fights (non-stage)")
    cols = [c for c in FEATURES if c not in ("group", "parser", "stage")] + ["enemy"]
    d = df[df.has].copy()
    d["enemy"] = d["enemy"].astype(str)
    y = np.minimum(d.lr.abs().values, 0.7)
    X, names = one_hot(d, cols)
    folds = {"development+verified → earlier": (d.group.isin(["development", "verified"]).values, (d.group == "earlier").values), "earlier → development+verified": ((d.group == "earlier").values, d.group.isin(["development", "verified"]).values)}
    for label, (tr, te) in folds.items():
        t = tree(X[tr], y[tr], 4, 150, names)
        p = predict(t, X[te], names)
        r2 = 1 - ((y[te] - p) ** 2).sum() / ((y[te] - y[te].mean()) ** 2).sum()
        print(f"\n{label}: test R² {r2:.3f}")
        show(t)
    # fight identity alone, for scale: the fight's mean as the prediction (in sample; an upper bound of what fights explain)
    fm = d.groupby("fx").lr.transform(lambda s: np.minimum(s.abs(), 0.7).mean())
    print(f"\nFor scale: each fight's own mean |lr| explains R² {1 - ((y - fm.values) ** 2).sum() / ((y - y.mean()) ** 2).sum():.3f} in sample.")
    print("\nLasso (standardized one-hots, λ = 0.002): coefficients ≥ 0.002 on both folds' training sets, same sign:")
    ws = {}
    for label, (tr, te) in folds.items():
        ws[label] = lasso(X[tr], y[tr], 0.002)
    a, b = ws.values()
    keep = [(names[j], a[j], b[j]) for j in range(len(names)) if abs(a[j]) >= 0.002 and abs(b[j]) >= 0.002 and np.sign(a[j]) == np.sign(b[j])]
    keep.sort(key=lambda x: -abs(x[1] + x[2]))
    for n, x1, x2 in keep[:30]:
        print(f"  {n:55s} {x1:+.4f} {x2:+.4f}")
    print("Coefficients on one fold only (≥ 0.004): " + "; ".join(f"{names[j]} {a[j]:+.3f}/{b[j]:+.3f}" for j in range(len(names)) if (abs(a[j]) >= 0.004) != (abs(b[j]) >= 0.004))[:1500])
    # negative control: features shuffled within fights
    Xs = X.copy()
    fx = d.fx.values
    for f in np.unique(fx):
        m = np.where(fx == f)[0]
        Xs[m] = Xs[RNG.permutation(m)]
    for label, (tr, te) in folds.items():
        t = tree(Xs[tr], y[tr], 4, 150, names)
        p = predict(t, Xs[te], names)
        print(f"Negative control (rows' features shuffled within fights), {label}: test R² {1 - ((y[te] - p) ** 2).sum() / ((y[te] - y[te].mean()) ** 2).sum():.3f}; first split {t.get('split')}")


def onesided(os_df, fights):
    head("One-sided landings (replay-only and log-only; non-stage)")
    o = os_df[~os_df.fx.isin(STAGE) & (os_df.fx != "9c6e")].copy()
    n = o.fx.nunique()
    o["gross"] = o.share.abs()
    f = fights[~fights.fx.isin(STAGE) & (fights.fx != "9c6e")]
    print(f"{n} fights (9c6e, two targets, left out too); mean per fight: |matched| {f.matched.abs().mean():.2f}%, replay-only {f.replayOnly.mean():.2f}%, log-only {f.logOnly.mean():.2f}%, |error| {f.error.abs().mean():.2f}%")
    print(f"gross one-sided per fight {o.gross.sum() / n:.2f}% of its logged total; net {o.share.sum() / n:+.2f}%")
    for cols in [["side", "context"], ["nature"], ["skill"], ["side", "context", "nature"], ["flagset"], ["opname"], ["opname", "side", "key"]]:
        t = o.groupby(cols).agg(n=("gross", "size"), gross=("gross", "sum"), net=("share", "sum"), fights=("fx", "nunique"))
        t["gross/fight"] = (t.gross / n).round(3)
        t["net/fight"] = (t.net / n).round(3)
        t["share of gross"] = (t.gross / o.gross.sum()).map(pct)
        print(f"\nby {' × '.join(cols)}:")
        print(t.sort_values("gross", ascending=False).drop(columns=["gross", "net"]).head(15).to_string())
    # concentration and the near-cast cut / stop flags
    fl = Counter()
    for _, r in o.iterrows():
        for x in r["flags"]:
            fl[x] += r.gross
    print("\nflags (gross share): " + "; ".join(f"{k} {pct(v / o.gross.sum())}" for k, v in fl.most_common()))
    top = o.groupby("fx").gross.sum().sort_values(ascending=False)
    print(f"top 5 fights carry {pct(top.head(5).sum() / top.sum())} of the gross: " + ", ".join(f"{k} {v:.1f}%" for k, v in top.head(8).items()))
    # pairing: a replay-only and a log-only of one operator within 3 s that cancel (twins the 1.5 s rule misses)
    tw = 0.0
    for (fx, op), g in o.groupby(["fx", "operator"]):
        r = g[(g.side == "replay") & ~g.context.str.startswith("twin")]
        l = g[(g.side == "log") & ~g.context.str.startswith("twin")]
        used = set()
        for _, x in r.iterrows():
            c = l[(l.t - x.t).abs().between(1500, 3000) & ~l.index.isin(used)]
            if len(c):
                y = c.iloc[(c.share.abs() - x.share).abs().argsort().iloc[0]]
                if 1 / 1.5 <= abs(y.share) / max(x.share, 1e-9) <= 1.5:
                    used.add(y.name)
                    tw += min(abs(y.share), x.share) * 2
    print(f"replay-only and log-only of one operator 1.5–3 s apart, values within ×1.5 (twins past TWIN_MS): {tw / n:.3f}% per fight gross")


def fights_section(fights, df):
    head("Fight level: what the fights' |error| goes with (development, earlier pending, verified; non-stage)")
    f = fights[~fights.fx.isin(STAGE)].copy()
    f["abs"] = f.error.abs()
    f["oneSided"] = f.replayOnly - f.logOnly
    f["absMatched"] = f.matched.abs()
    print(f.groupby("group")[["abs", "absMatched", "replayOnly", "logOnly", "oneSided"]].mean().round(2).to_string())
    f["measuredDate"] = f.measured.str[:10]
    f["boss"] = f.enemy.str.contains("jsspsi|fdcentur|babyents|tower015")
    for col in ["parser", "stage", "refreshed", "group", "boss"]:
        t = f.groupby(col).agg(fights=("abs", "size"), mean_abs=("abs", "mean"), one_sided=("oneSided", "mean"), matched=("absMatched", "mean"))
        print(f"\nby {col}:")
        print(t.round(2).to_string())
    from itertools import chain
    ops = sorted(set(chain.from_iterable(f.team)))
    rows = []
    for op in ops:
        m = f.team.map(lambda t: op in t)
        if m.sum() < 3 or (~m).sum() < 3:
            continue
        rows.append((op, int(m.sum()), f[m]["abs"].mean(), f[~m]["abs"].mean(), f[m].oneSided.mean(), f[m].absMatched.mean()))
    rows.sort(key=lambda x: -(x[2] - x[3]))
    print("\nteam member: fights with / mean |error| with / without / one-sided with / |matched| with")
    for op, n, a, b, o1, mm in rows:
        print(f"  {name(op):16s} {n:3d}  {a:5.2f}  {b:5.2f}  {o1:5.2f}  {mm:5.2f}")
    print("\nlength (s) against |error|: Spearman " + f"{f[['lengthS', 'abs']].corr(method='spearman').iloc[0, 1]:.2f}; import date against |error|: " + f"{pd.Series(pd.to_datetime(f.measured.str[:19]).rank()).corr(f['abs'].rank()):.2f}")


def main():
    want = set(sys.argv[1:]) or {"summary", "explain", "buffs", "clusters", "drift", "boundary", "features", "interactions", "tree", "onesided", "fights"}
    all_df = load_hits()
    fights = load_fights()
    df = all_df[~all_df.fx.isin(STAGE)].copy()
    explain(df)
    prep_features(df)
    if "summary" in want:
        summary(all_df, df, fights)
    if "explain" in want:
        explain_section(df)
    if "buffs" in want:
        buffs_section(df)
    if "clusters" in want:
        clusters(df)
    if "drift" in want:
        drift(df)
    if "boundary" in want:
        boundary(df)
    if "features" in want:
        features(df)
    if "interactions" in want:
        interactions(df)
    if "tree" in want:
        tree_section(df)
    if "onesided" in want:
        onesided(load_onesided(), fights)
    if "fights" in want:
        fights_section(fights, df)
    print("\nEFSIM-DONE stats-analyze pass")


if __name__ == "__main__":
    main()
