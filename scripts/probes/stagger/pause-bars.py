# Probe (scripts/probes/README.md): Si's strokes round (2026-11-23): the enemy's Stagger bar and the debuffs carried across each hitless pause (python3 -I scripts/probes/stagger/pause-bars.py [min s] [ids]).
# Promoted from that round's scratch/pause-bars.py unchanged but for this header; run it from the repository root.
import json, glob, sys
# Around each pause with no hit (>= MIN s): the enemy's Stagger bar on the last poise hits before and the first after
# (a new enemy entity starts with its own bar), and the listed enemy debuffs (effects whose source is a team member
# and that sit on the enemy: Vulnerable, Susceptibility, Corrosion ...) carried across, by buff id.
MIN = float(sys.argv[1]) if len(sys.argv) > 1 else 4.5
only = sys.argv[2:]
files = sorted(glob.glob('fixtures/*.json') + glob.glob('fixtures/pending/*.json'))
for f in files:
    d = json.load(open(f))
    short = f.split('zmdlogs-')[-1][:4]
    if only and short not in only: continue
    hits = sorted(d['hits'], key=lambda h: h['t'])
    for i, (a, b) in enumerate(zip(hits, hits[1:])):
        if b['t'] - a['t'] < MIN * 1000: continue
        before = [h for h in hits[:i + 1] if h.get('poise')][-3:]
        after = [h for h in hits[i + 1:] if h.get('poise')][:3]
        eb = {e['buff'] for e in a['effects']}
        ea = {e['buff'] for e in b['effects']}
        common = sorted(x for x in eb & ea if 'common' in x or 'vul' in x or 'spell' in x)
        print('%s %7.2f-%7.2f bars before %s | after %s | debuffs kept %d of %d: %s' % (short, a['t'] / 1000, b['t'] / 1000,
              ' '.join('%.1f:%d' % (h['t'] / 1000, h['poise']['bar']) for h in before), ' '.join('%.1f:%d' % (h['t'] / 1000, h['poise']['bar']) for h in after),
              len(eb & ea), len(eb), ' '.join(x.replace('buff_', '')[:30] for x in common[:6])))
