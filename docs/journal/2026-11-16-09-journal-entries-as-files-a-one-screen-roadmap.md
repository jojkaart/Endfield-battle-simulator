## 2026-11-16: Journal entries as files; a one-screen roadmap

Architecture review item 6: the journal and the roadmap were 8 of the 16
recorded merge conflicts and most of the 21k words of session-start
reading. Now each entry is its own file, docs/journal/YYYY-MM-DD-NN-slug.md
(NN orders one date's entries), its first line the heading as before.
`npm run journal` (scripts/journal.ts) builds docs/journal.md (the last 10
entries) and docs/journal/README.md (an index of all); `npm run check`
starts with `journal:check`, and premerge wants a new entry file, not a
journal.md change. `npm run journal:new -- "Title"` starts an entry;
`npm run journal:adopt` turns entries written the old way (a conflicted
docs/journal.md, or `-- --from MERGE_HEAD`) into files, matched by heading.
All 83 entries converted, the archive's too (one format, one index, and
the adopt step can tell every old entry by its heading); the conversion
reproduces the old text exactly (links rebased to docs/journal/). The
roadmap is one screen; its old text, unchanged, is in roadmap-details.md.
Session-start reading (CLAUDE.md, README, journal, roadmap): 21.2k words
→ about 4.6k. The built files still conflict when two branches add
entries; that's resolved by rebuilding, never by hand.
