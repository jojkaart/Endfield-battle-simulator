# Probe (scripts/probes/README.md): Yinglung's Edge rounds: the stack-count hypotheses H1-H13 scored against scratch/edge-all.json (edge-export.ts).
# Promoted from that round's scratch/edge-score.py unchanged but for this header and the import path; run it from the repository root.
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import edge_implied as imp
# Scores stack-count hypotheses for Type 50 Yinglung's Edge against the layers each wearer combo's damage implies.
# Ground truth: the log reading's decoding when at least half the combo's hits agree, else the primary's; Estella's
# single combo hit by the primary (the log doesn't list her Razorhorn ATK). Excluded (non-Edge causes): 8915 before
# 86.8 s (the stage's shields), a9d7 (a stage factor on every operator), 7b54's split combos (its hits' other zones are
# off: implied negative), Chen in 7e19 (the two readings disagree), combos no reading decodes.
# A wearer's first combo may carry layers from before the log: it fits when the prediction <= the implied count.
PATH = 'scratch/edge-all.json'
data = json.loads(open(PATH).readline())
recs = imp.combos(PATH)

def truth(r):
    if r['fx'] == 'a9d7': return None, 'a9d7 stage factor'
    if r['fx'] == '8915' and r['start'] < 86800: return None, '8915 shields'
    if r['fx'] == '7b54' and r['wearer'] == 'chr_0036_jsspsi' and (r['start'] < 16500 or r['start'] > 46000): return None, '7b54 split combo'
    if r['wearer'] == 'chr_0005_chen': return None, 'Chen readings disagree'
    if r['wearer'] == 'chr_0021_whiten':
        v = r['primary']
        return (v['dec'][0][1], 'primary') if v and len(v['dec']) == 1 else (None, 'undecoded')
    # Each reading: its median's decoding and how far the median is from it. An exact one (within 0.05 of a layer)
    # decides; two exact ones that differ leave the combo open; with no exact one, a decoding at most TOL off whose
    # combo hits mostly agree.
    got = {}
    for k in ('log', 'primary'):
        v = r[k]
        if v and len(v['dec']) == 1:
            j, n = v['dec'][0]
            got[k] = (n, abs(v['med'] - (n + j * r['jv'] / 0.2)), v['agree'] * 2 >= v['n'])
    exact = {k: g[0] for k, g in got.items() if g[1] < 0.05}
    if len(set(exact.values())) > 1: return None, 'readings disagree (log %d, primary %d)' % (exact['log'], exact['primary'])
    if exact: return list(exact.values())[0], '+'.join(exact) + ' exact'
    loose = {k: g[0] for k, g in got.items() if g[2]}
    if len(set(loose.values())) == 1: return list(loose.values())[0], '+'.join(loose) + ' approx'
    return None, 'undecoded'

import glob as _glob
_PH = {}
def lastrite_phantoms(short):
    if short not in _PH:
        out = []
        for f in _glob.glob('fixtures/*.json') + _glob.glob('fixtures/pending/*.json'):
            if short not in f: continue
            ts = sorted(h['t'] for h in json.load(open(f)).get('hits', []) if h['event'] == 'buff_chr_0026_lastrite_normal_skill_phantom_main')
            for t in ts:
                if not out or t - out[-1][-1] > 3000: out.append([t])
                else: out[-1].append(t)
        _PH[short] = [g[0] for g in out]
    return _PH[short]

SUB = ('_1', '_2', '_during_ult', 'normalskill_2', 'normalskill_3', 'floating_start')

def events(fx):
    """Every instance as (time, operator, category, instance)."""
    out = []
    for i in fx['instances']:
        k, frm, sk = i['kind'], i['from'], i['skill']
        if k == 'battle':
            if frm == 'hits': cat = 'B'
            elif i['op'] == 'chr_0036_jsspsi': cat = 'Esi'
            else: cat = 'Eoth'
        elif k == 'ultimate': cat = 'U'
        elif k == 'combo': cat = 'C' if frm == 'hits' else 'Cev'
        else: continue
        out.append((i['start'], i['op'], cat, i))
    # Last Rite's battle skill placed as a trigger's hits (her phantom's keys; the replay casts it: 9555 at 79.83 s): a
    # battle cast at its group's first hit less 0.84 s (79.83 against 80.67 there), unless an instance of it is near.
    for t in lastrite_phantoms(fx['short']):
        if not any(e[1] == 'chr_0026_lastrite' and e[2] in ('B', 'Eoth') and abs(e[0] - (t - 840)) < 3000 for e in out):
            out.append((t - 840, 'chr_0026_lastrite', 'B', {'op': 'chr_0026_lastrite', 'skill': 'chr_0026_lastrite_normal_skill', 'kind': 'battle', 'start': t - 840, 'firstHit': t, 'lastHit': t, 'hits': 1, 'keys': [], 'events': [], 'from': 'hits'}))
    out.sort(key=lambda e: e[0])
    # One press logged twice: a battle-skill cast event with no hits of its skill id, then (within 2.5 s: a time stop
    # may hold the hits back) a battle cast of the same operator placed from hits with no cast event of its own
    # (Laevatain's normal_skill event and her normal_skill_during_ult hits, db87).
    drop = set()
    for a in out:
        if a[2] != 'Eoth': continue
        for b in out:
            if b[2] == 'B' and b[1] == a[1] and not b[3]['events'] and 0 <= b[0] - a[0] <= 2500:
                drop.add(id(b)); break
    return [e for e in out if id(e) not in drop]

def predict(fx, wearer, rule):
    """rule(e, wearer, fx) -> layers added (0/1) for a non-combo event; the wearer's combo (hits) consumes at rule's
    consume time. Returns {combo start: count}."""
    stacks, res, t_last = 0, {}, {}
    evs = events(fx)
    adds = []
    for t, op, cat, i in evs:
        if cat == 'C' and op == wearer: continue
        a = rule['add'](t, op, cat, i, wearer, fx)
        if a: adds.append((a if isinstance(a, (int, float)) and a > 1 else t, 1))
    consumes = sorted(rule['consume'](i) for t, op, cat, i in evs if cat == 'C' and op == wearer)
    clears = sorted(rule.get('clear', lambda fx, w: [])(fx, wearer))
    timeline = [(t, 0, 'add') for t, _ in adds] + [(t, 1, 'clear') for t in clears] + [(t, 1, 'consume') for t in consumes]
    # same instant: rule['order'] 'add-first' (default) or 'consume-first'
    if rule.get('order') == 'consume-first': timeline = [(t, -p, w) for t, p, w in timeline]
    timeline.sort()
    stamps = []
    exp = rule.get('expiry')
    for t, _, what in timeline:
        if what == 'add':
            stamps.append(t)
            if len(stamps) > 3: stamps = stamps[-3:] if rule.get('cap') == 'refresh' else stamps[:3]
        elif what == 'clear': stamps = []
        else:
            live = [s for s in stamps if exp is None or t - s <= exp]
            res[t] = len(live)
            stamps = []
    return res

def score(name, rule, show=False):
    exact = lower = n = 0
    wrong = []
    for fx in data:
        for w in fx['wearers']:
            if w == 'chr_0021_whiten': continue  # her single combo hit carries the Razorhorn ATK fitted on it
            mine = [r for r in recs if r['fx'] == fx['short'] and r['wearer'] == w]
            pred = predict(fx, w, rule)
            consumes = sorted(pred.keys())
            for idx, r in enumerate(mine):
                tv, how = truth(r)
                if tv is None: continue
                inst = [i for i in fx['instances'] if i['op'] == w and i['kind'] == 'combo' and i['from'] == 'hits' and i['start'] == r['start']][0]
                p = pred.get(rule['consume'](inst))
                first = idx == 0
                n += 1
                if p == tv: exact += 1
                elif first and p < tv: lower += 1
                else: wrong.append('%s %s %.1f %d/%d%s' % (r['fx'], w[9:13], r['start'] / 1000, p, tv, '*' if first else ''))
    print('%-46s exact %2d, first-combo lower bound %2d, wrong %2d of %d' % (name, exact, lower, len(wrong), n))
    if show: print('    wrong (pred/implied, * first combo):', '; '.join(wrong))
    return exact, lower, wrong

def at_start(i): return i['start']
def at_first_hit(i): return i['firstHit']

anyone = lambda cats: (lambda t, op, cat, i, w, fx: cat in cats)
HYP = {}
HYP['H1 every logged battle cast (hits or event), anyone'] = dict(add=anyone({'B', 'Esi', 'Eoth'}), consume=at_start)
HYP['H2 battle casts with hits, anyone'] = dict(add=anyone({'B'}), consume=at_start)
HYP['H3 battle casts, Si hitless events out'] = dict(add=anyone({'B', 'Eoth'}), consume=at_start)
HYP['H4 = H3 + every ultimate'] = dict(add=anyone({'B', 'Eoth', 'U'}), consume=at_start)
HYP['H5 = H3, the wearer own casts only'] = dict(add=lambda t, op, cat, i, w, fx: cat in {'B', 'Eoth'} and op == w, consume=at_start)
HYP['H6 = H3, teammates only'] = dict(add=lambda t, op, cat, i, w, fx: cat in {'B', 'Eoth'} and op != w, consume=at_start)
HYP['H7 = H3, consumed at the first combo hit'] = dict(add=anyone({'B', 'Eoth'}), consume=at_first_hit)
HYP['H8 = H3, added at the first battle hit'] = dict(add=lambda t, op, cat, i, w, fx: (i['firstHit'] or t) if cat in {'B', 'Eoth'} else 0, consume=at_start)
for e in (5000, 10000, 15000, 20000, 30000):
    HYP['H9 = H3, expiry %d s' % (e / 1000)] = dict(add=anyone({'B', 'Eoth'}), consume=at_start, expiry=e)
HYP['H10 = H3, cap keeps the newest'] = dict(add=anyone({'B', 'Eoth'}), consume=at_start, cap='refresh')
HYP['H11 = H3, any wearer combo clears all'] = dict(add=anyone({'B', 'Eoth'}), consume=at_start, clear=lambda fx, w: [i['start'] for i in fx['instances'] if i['kind'] == 'combo' and i['from'] == 'hits' and i['op'] in fx['wearers'] and i['op'] != w])
HYP['H12 = H3, the wearer ultimate clears'] = dict(add=anyone({'B', 'Eoth'}), consume=at_start, clear=lambda fx, w: [i['start'] for i in fx['instances'] if i['kind'] == 'ultimate' and i['op'] == w])
HYP['H13 = H3, any combo cast event consumes'] = dict(add=anyone({'B', 'Eoth'}), consume=at_start, clear=lambda fx, w: [i['start'] for i in fx['instances'] if i['kind'] == 'combo' and i['from'] == 'event' and i['op'] == w])

if __name__ == '__main__':
    show = '-v' in sys.argv
    for k, v in HYP.items(): score(k, v, show)
