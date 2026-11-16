## 2026-11-16: Friction reports after every sub-agent task

The owner, after the architecture review: make that kind of analysis part
of the default workflow. Every finished sub-agent is resumed once to write a
friction report (structural problems in code, repository, docs or tools
that slowed it, with suggestions complete enough to act on alone) into
[docs/friction/](../friction/README.md); when about five unprocessed
reports collect, one sub-agent reads them, implements the common
improvements and moves them to
[docs/friction-done/](../friction-done/README.md) (the owner: keep the
first folder for what still needs doing). Rule in CLAUDE.md "Friction
reports". First reports requested from the agents that finished today
(rules phase 1 and 2, Si's Haste, Arts Intensity, docs workflow, test
speed, data cache).
