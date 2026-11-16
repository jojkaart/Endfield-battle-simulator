## 2026-10-26: what isn't simulated accurately (three audits, a plan)

The owner put engine accuracy above the search's scoring and asked for a
comprehensive analysis. Three read-only audits (logs, kits vs data,
engine mechanics) → docs/accuracy-plan.md. Main finding: most of today's
log totals error (−12% to −61%) is the log tooling's (casts merged under
1 s, Si's Final Stroke not replayed, unknown crits read as non-crits,
damage past the kill, a missed event prefix, hitless casts' Amp); the
matched hits alone are −2.6% to −19% in the verified fixtures. The
engine's largest known error is Stagger (the bar never recovers: wrong
windows in 22 of 29 logs). Checked by hand: `CAST_SLACK_MS` 1000; the bar
only falls; the native settings' Solidification 6–9 s and
`atbRecoverInterval` 0.5 (the engine pauses SP 1.5 s). Asked the owner
whether teammates basic-attack on their own: "Yes, the non-controlled
operators do basic attacks on the enemies, though not quite at the pace
the controlled operator does and certain skills, like liino's stance and
ultimate prevent that." Now plan item B0.
