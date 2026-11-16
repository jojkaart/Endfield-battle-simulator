## 2026-11-12: Arcane's WILL touch takes her window's element

Goal: open problem "Arcane's WILL combo touch" (in-game test 33). The
diagnosis held: with no infliction on the enemy at the touch, a later
consumer still consumes one (9a80's Rossi Lift at 7807 ms). Done: a new
application element `"window"` (model.ts, schema): the timeline state
keeps what each combo-window trigger last saw and when (comboTrigger,
recorded even while the cooldown keeps the window shut); a combo hit reads
the latest since its cast began, else the window's opener at the cast,
else (a window the replay never saw open) the enemy's current element
(landing.ts windowSourceAt). Arcane's touch uses it; `"enemy"` and
`"event"` are unchanged. 9a80 −30.7 → −23.6%, 3f78 plain 34 → 41, 489c,
4a64, e82d closer; fixtures/ and hold-out counts unchanged. Dead ends:
the opener at the cast only (0eef −19.9%: the replay casts the combo
before Si's same-ms Cryo, the old dead end); every event the trigger saw
(1cd1 worse, one hold-out log much worse). Open: e82d's extra replay
touch; first opener against latest (test 33's new form).
