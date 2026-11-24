# Misprediction statistics, 2026-11-24: the tables scripts/probes/stats/build.ts writes, as pandas frames with the
# derived columns every analysis reads (imported by analyze.py and the other stats probes; run from the repository root).
#
# Per hit: P, the engine's primary reading (crit-less hits whose crit the log doesn't give: the nearer of P and P with
# the landing's Crit DMG, so an unlogged crit isn't counted as an error), r = value / P, lr = ln r, err = |value − P|
# (the damage a hit's misprediction puts into a fight's matched share), off = err > 1.5 (the ±1 of a plain match),
# timing = the log's reading (every kit buff as the log lists it) fits where the primary doesn't (the replay's buff
# windows), and the feature columns the attribution tables group by.

import json
import math
import os

import numpy as np
import pandas as pd

ROOT = os.getcwd()
D = os.path.join(ROOT, "scratch", "stats")


def jl(name):
    with open(os.path.join(D, name)) as f:
        return [json.loads(x) for x in f if x.strip()]


def names():
    with open(os.path.join(D, "names.json")) as f:
        return json.load(f)


NAMES = None


def name(op):
    global NAMES
    if NAMES is None:
        NAMES = names()
    return NAMES.get(op, op)


def stage_of(enemy):
    # eny_0120_klbear_tower015 -> tower015; eny_0051_rodin -> rodin (no stage suffix)
    parts = enemy.split("_")
    tail = parts[-1]
    if tail.startswith(("tower", "hdg", "dung")) or tail == "assult":
        return "_".join(p for p in parts[3:] if p)
    return "plain"


def bins(x, edges, labels):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "none"
    for e, l in zip(edges, labels):
        if x < e:
            return l
    return labels[-1]


def crit_dmg(mods):
    return sum(m["value"] for m in mods if m["zone"] == "critDamage")


def load_hits():
    rows = jl("hits.jsonl")
    df = pd.DataFrame(rows)
    df["opname"] = df["operator"].map(name)
    df["stage"] = df["enemy"].map(stage_of)
    has = df["predicted"].notna() & (df["predicted"] > 0)
    df["has"] = has
    P = df["predicted"].astype(float)
    # Crit-less in the log: the nearer of P and P x (1 + Crit DMG) (the replay's crit isn't the log's to grade).
    cd = df["mods"].map(lambda m: crit_dmg(m) if isinstance(m, list) else 0.0)
    pc = P * (1 + cd)
    unknown_crit = df["crit"].isna()
    # A capped hit (the killing blow) is graded on its uncapped value, as the check grades it.
    df["V"] = df["uncapped"].fillna(df["value"]).astype(float)
    use_crit = unknown_crit & has & ((df["V"] - pc).abs() < (df["V"] - P).abs())
    df["Pc"] = np.where(use_crit, pc, P)
    df["critPicked"] = use_crit
    df["r"] = np.where(has, df["V"] / df["Pc"], np.nan)
    df["lr"] = np.log(df["r"])
    df["err"] = np.where(has, (df["V"] - df["Pc"]).abs(), np.nan)
    df["serr"] = np.where(has, df["Pc"] - df["V"], np.nan)  # predicted − logged (the totals' sign)
    df["off"] = has & (df["err"] > 1.5)
    lrd = df["logReading"].astype(float)
    df["logFits"] = df["logReading"].notna() & ((df["V"] - lrd).abs() <= 1.5)
    df["rlog"] = df["V"] / lrd
    # The primary off, the log's listing of the kit buffs fits: the replay's buff windows (timing); off under both: not
    # the kit buffs' timing (a build, a kit value, Stagger, a status, a crit, resistance).
    df["why"] = np.select(
        [~has, ~df["off"], df["off"] & df["logFits"], df["off"] & df["logReading"].notna() & ~df["logFits"]],
        ["no reading", "on", "listing fits", "both off"],
        "off, no log reading",
    )
    df["critLog"] = df["crit"].map(lambda c: "unknown" if c is None or (isinstance(c, float) and math.isnan(c)) else ("crit" if c else "no crit"))
    df["staggerPair"] = [
        ("log+engine" if a and b else "log only" if a else "engine only" if b else "neither") if h else "none"
        for a, b, h in zip(df["loggedStagger"], df["engineStagger"].fillna(False), has)
    ]
    df["diffs"] = df["differences"].map(lambda ds: sorted({f"{d['kind']}:{d['what']}" for d in ds}) if isinstance(ds, list) else [])
    df["diffKinds"] = df["differences"].map(lambda ds: "+".join(sorted({d["kind"] for d in ds})) if isinstance(ds, list) and ds else "none")
    df["sinceCastBin"] = df["sinceCast"].map(lambda x: bins(x, [0, 500, 1000, 2000, 4000], ["<0", "0-0.5s", "0.5-1s", "1-2s", "2-4s", ">4s"]) if x == x else "none")
    df["tBin"] = df["tFrac"].map(lambda x: bins(x, [0.1, 0.25, 0.5, 0.75, 0.9, 2], ["0-10%", "10-25%", "25-50%", "50-75%", "75-90%", "90-100%"]))
    df["ageBin"] = df["minAge"].map(lambda x: bins(x, [100, 300, 1000, 3000, 1e12], ["<0.1s", "0.1-0.3s", "0.3-1s", "1-3s", ">3s"]) if x == x and x is not None else "none")
    df["dtLand"] = df["landingMs"] - df["t"]
    df["dtBin"] = df["dtLand"].map(lambda x: bins(abs(x), [1, 50, 200, 1000, 1e12], ["0", "<50ms", "50-200ms", "0.2-1s", ">1s"]) if x == x else "none")
    df["inStop"] = df["stop"].notna()
    df["hold"] = df["hold1s"] > 0
    df["cut"] = df["cuts"].map(lambda c: "+".join(sorted(set(c))) if c else "none")
    df["corrosion"] = df["unquantified"].map(lambda u: any("corr" in b or "corrupt" in b for b in u))
    df["enemySt"] = df["enemyStatus"].map(lambda s: "+".join(sorted({x.rstrip("0123456789") for x in s})) if isinstance(s, list) and s else "none")
    df["layered"] = df["layers"].map(lambda l: bool(l) if isinstance(l, list) else False)
    df["selfControlled"] = df["controlled"] == df["operator"]
    df["fightOp"] = df["fx"] + " " + df["opname"]
    return df


def load_onesided():
    df = pd.DataFrame(jl("onesided.jsonl"))
    df["opname"] = df["operator"].map(name)
    df["stage"] = df["enemy"].map(stage_of)
    df["flagset"] = df["flags"].map(lambda f: "+".join(sorted(f)) if f else "none")
    return df


def load_fights():
    df = pd.DataFrame(jl("fights.jsonl"))
    df["stage"] = df["enemy"].map(stage_of)
    return df
