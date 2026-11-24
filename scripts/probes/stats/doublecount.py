# Hits whose primary reading has a kit buff and an unmapped log buff with the same zone and value (a likely double count:
# the log lists the kit buff under a game buff it doesn't name, KitBuff.loggedAs). Reads scratch/stats/hits.jsonl
# (build.ts). `python3 -I scripts/probes/stats/doublecount.py` (2026-11-24, the misprediction candidates).
import json, collections
pairs = collections.Counter()
err = collections.Counter()
fights = collections.defaultdict(set)
for l in open('scratch/stats/hits.jsonl'):
    d = json.loads(l)
    mods = d.get('mods') or []
    kit = [(m['zone'], round(m['value'], 4), m['src'][4:]) for m in mods if m['src'].startswith('kit ')]
    log = [(m['zone'], round(m['value'], 4), m['src'][9:]) for m in mods if m['src'].startswith('log buff ')]
    p = d.get('predicted') or 0
    e = abs(d['value'] - p)
    for z, v, k in kit:
        for z2, v2, g in log:
            if z == z2 and abs(v - v2) < 1e-3 and v != 0:
                pairs[(k, g)] += 1
                err[(k, g)] += e
                fights[(k, g)].add(d['fx'])
for (k, g), n in sorted(pairs.items(), key=lambda x: -err[x[0]]):
    print(f'{n:5d} hits err {err[(k, g)]:12.0f} {k} ~ {g} fights {sorted(fights[(k, g)])}')
