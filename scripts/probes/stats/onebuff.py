# Kit buff leads, 2026-11-24 (docs/open-problems.md "Misprediction statistics"): one kit buff's "one buff the log's
# way" hits (analyze.py's first explanation), per fight: time, operator, event, logged ÷ primary, the counterfactual's
# kind (engine: the engine has it, the log doesn't; log: the other way; values: both, other values) and the hit's
# differences about it. Reads the tables build.ts writes (scratch/stats/); stage logs left out as in analyze.py.
#
#   python3 -I scripts/probes/stats/onebuff.py <buff regex> [fx…]
#
# Since round 11 the same as `python3 -I scripts/probes/stats/analyze.py buff <buff regex> [fx…]` (analyze.buff_hits);
# kept for the docs that name it.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze  # noqa: E402

if len(sys.argv) < 2:
    sys.exit("onebuff.py <buff regex> [fx…]")
analyze.buff_hits(sys.argv[1], sys.argv[2:])
