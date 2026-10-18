# Reference simulators

Existing Endfield simulators, linked as git submodules for use as a starting
point: reading their formulas, data handling and test cases, and comparing
their outputs with ours. Evaluation: [`docs/data-sources.md`](../docs/data-sources.md#4-reference-results-and-existing-simulators).

| Path | Upstream | Licence | What we can do with it |
|---|---|---|---|
| `zero-sanity-timeline/` | [mitchell-ma/zero-sanity-timeline](https://github.com/mitchell-ma/zero-sanity-timeline) | MIT | Reuse code and data with attribution. Its damage tests have in-game verified expected values. |
| `Endaxis/` | [Lieyuan621/Endaxis](https://github.com/Lieyuan621/Endaxis) | **None** (all rights reserved) | Read for understanding and compare outputs. **Do not copy code.** |
| `End-DPScope/` | [Lex1slt/End-DPScope](https://github.com/Lex1slt/End-DPScope) | MIT for its own code only | Reuse its own code and scenario files with attribution. It bundles the Endaxis engine, which is not covered by its licence. |

Fetch with:

```sh
git submodule update --init reference/
```
