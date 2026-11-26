"""Damage-factors round (2026-11-26). Rossi's ultimate slash2 (the last ultimate_skill hit of each cast) in every
development log: whether the log has a Seething Blood extra at its ms, the bleed ticks around it, and how many hits
(and of them listing the bleed) follow within 3 s: the three without an extra are a fight's or a life's last hit.
Run from the repository root: python3 -I scripts/probes/rossi/slash2.py (reads fixtures/ and fixtures/pending/)."""
import json, glob, sys

R = "chr_0028_wulfa"
for path in sorted(glob.glob("fixtures/pending/*.json") + glob.glob("fixtures/zmdlogs-*.json")):
    fx = json.load(open(path))
    if not any(b["operator"] == R for b in fx["team"]):
        continue
    hits = fx["hits"]
    ult = [h for h in hits if h["operator"] == R and h["event"] == f"{R}_ultimate_skill"]
    if not ult:
        continue
    casts, cur = [], [ult[0]]
    for h in ult[1:]:
        if h["t"] - cur[-1]["t"] > 3000:
            casts.append(cur); cur = [h]
        else:
            cur.append(h)
    casts.append(cur)
    ticks = [h["t"] for h in hits if h["event"] == "buff_chr_0028_wulfa_normal_bleed"]
    for c in casts:
        s2 = c[-1]
        t = s2["t"]
        extra = any(h["t"] == t and h["event"] == "buff_chr_0028_wulfa_normal_bleed_crit_extra_damage" for h in hits)
        before = [x for x in ticks if x <= t]
        after = [x for x in ticks if x > t]
        lists = lambda h: any(e["buff"] == "buff_chr_0028_wulfa_normal_bleed" for e in h.get("effects", []))
        listed_at = lists(s2)
        later = [h for h in hits if t < h["t"] <= t + 3000]
        later_list = sum(1 for h in later if lists(h))
        since = [e.get("since") for e in s2.get("effects", []) if e["buff"] == "buff_chr_0028_wulfa_normal_bleed"]
        print(f"{fx['id'][8:12]} slash2 {t/1000:7.2f} crit {s2.get('crit')} extra {extra!s:5} listed {listed_at!s:5} since {since[:1]} "
              f"last tick {before[-1]/1000 if before else None} next tick {after[0]/1000 if after else None} "
              f"hits listing it in the next 3 s {later_list}/{len(later)}")
