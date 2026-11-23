# Probe (scripts/probes/README.md): Yinglung's Edge rounds: the implied layers per wearer combo (imported by edge-score.py; python3 -I scripts/probes/edge/edge_implied.py scratch/edge-all.json).
# Promoted from that round's scratch/edge-implied.py unchanged but for this header; run it from the repository root.
import json, sys, statistics
# Per wearer combo: the engine's Edge layers and the layers the damage implies.
# Log reading: extra = (value / logExact * dbL - dbL) / 0.2, the DMG bonus the log reading lacks in 0.2 units (it drops
# every unlisted kit buff: Edge, Jade Vessel's next-combo DMG), so extra = edge + jv/0.2 when JV acted.
# Primary (the replay's reading): extraP = (value / primary * dbP - dbP) / 0.2 + engine edge + engine jv / 0.2.
# A combo's value is the median over its non-crit hits; `agree` counts hits within 0.15 of it.
# Decoding: every (jv on/off, layers 0-3) within TOL of the median; several: the engine's jv.
TOL = 0.2

def xs_of(c, which):
    xs = []
    for r in c['rows']:
        if 'unknown' in r or r['crit']: continue
        if which == 'log':
            ratio = r['value'] / r['logExact']; xs.append((ratio * r['dbL'] - r['dbL']) / 0.2)
        else:
            ratio = r['value'] / r['primary']; xs.append((ratio * r['dbP'] - r['dbP']) / 0.2 + r['edgeE'] / 0.2 + r['jvE'] / 0.2)
    return xs

def decode(x, jv, jvE):
    cands = [(j, n) for j in ([0, 1] if jv > 0 else [0]) for n in range(4) if abs(x - (n + j * jv / 0.2)) <= TOL]
    if len(cands) > 1:
        pref = [cn for cn in cands if (cn[0] == 1) == (jvE > 0)]
        if pref: cands = pref
    return cands

def combos(path):
    data = json.loads(open(path).readline())
    out = []
    for fx in data:
        for c in fx['combos']:
            eng = [r for r in c['rows'] if 'unknown' not in r]
            rec = dict(fx=fx['short'], wearer=c['wearer'], start=c['start'], firstHit=c['firstHit'], jv=c['jv'])
            rec['edgeE'] = round(eng[0]['edgeE'] / 0.2) if eng else None
            rec['jvE'] = eng[0]['jvE'] if eng else 0
            for which in ('log', 'primary'):
                xs = xs_of(c, which)
                if not xs: rec[which] = None; continue
                med = statistics.median(xs)
                rec[which] = dict(med=med, n=len(xs), agree=sum(1 for x in xs if abs(x - med) <= 0.15), dec=decode(med, c['jv'], rec['jvE']))
            out.append(rec)
    return out

if __name__ == '__main__':
    for r in combos(sys.argv[1]):
        def f(k):
            v = r[k]
            if v is None: return '%-34s' % 'no clean hit'
            d = ','.join('%s%d' % ('J+' if j else '', n) for j, n in v['dec']) or '-'
            return '%6.2f %2d/%2d -> %-12s' % (v['med'], v['agree'], v['n'], d)
        print('%s %-7s %7.2f eng %s%s | log %s | prim %s' % (r['fx'], r['wearer'][4:11], r['start'] / 1000, 'J+' if r['jvE'] else '', r['edgeE'], f('log'), f('primary')))
