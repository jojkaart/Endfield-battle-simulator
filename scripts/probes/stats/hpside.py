# Reads hpside.ts lines from stdin: counts per fight, HP side (above / below half) and ratio bucket (0.02 wide).
import sys, collections
c = collections.Counter()
for l in sys.stdin:
    p = l.split()
    if len(p) < 9 or p[3] != 'hpLeft':
        continue
    side = 'above' if float(p[4]) > 0.5 else 'below'
    r = p[8]
    rb = '?' if r == '?' else f'{round(float(r) / 0.02) * 0.02:.2f}'
    c[(p[0], side, rb)] += 1
for k in sorted(c):
    if c[k] >= 2:
        print(k, c[k])
