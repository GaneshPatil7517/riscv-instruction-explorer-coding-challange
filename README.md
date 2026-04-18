**RISC-V Instruction Set Explorer**

Coding challenge for the LFX Mentorship "Mapping the RISC-V Extensions Landscape".

This is a Node.js CLI tool that parses `instr_dict.json` from the landscape repo, cross-references extension names with the official ISA manual, and builds a graph showing which extensions share instructions.

**How to run**

You'll need Node.js 18+ (I used the built-in `node:test` runner and ES modules). No npm install needed — there are zero external dependencies.

```bash
# clone the data sources first
git clone https://github.com/rpsene/riscv-extensions-landscape.git
git clone https://github.com/riscv/riscv-isa-manual.git

# then just run it
node src/main.mjs
```

You can also pass custom paths if your repos are somewhere else:
```bash
node src/main.mjs --instr-dict /some/path/instr_dict.json --manual-src /some/path/riscv-isa-manual/src/
```

By default it looks for the sibling repos relative to this project folder.

**Tests**

```bash
node --test test/tier1.test.mjs test/tier2.test.mjs test/tier3.test.mjs
```

There are 25 tests across all three tiers.

**What each tier does**

**Tier 1 Parsing and grouping**

Reads `instr_dict.json` (1,188 entries), groups them by extension tag, and prints a summary table. Also finds instructions that show up in multiple extensions — there are 73 of those.

I convert the JSON keys back to readable mnemonics by replacing underscores with dots and uppercasing, so `sc_w` becomes `SC.W`, `c_lw` becomes `C.LW`, etc.

**Tier 2 Cross-referencing with the ISA manual**

This was the trickiest part. The JSON file uses names like `rv_zba`, `rv64_zba` while the manual just says "Zba" or uses `ext:zba[]` macros in AsciiDoc. So I had to normalize both sides — strip the `rv_`/`rv32_`/`rv64_` prefix from JSON names, lowercase everything, then match.

For scanning the manual I look at:
- `.adoc` filenames (like `zba.adoc`)
- Z-extension patterns in text (`Zba`, `Zicsr`, etc.)
- S-prefixed extensions with uppercase S (`Svnapot`, `Sscounterenw`, `Smstateen`)
- `ext:` AsciiDoc macros
- `RV64M`-style references for single-letter extensions

One annoying issue I ran into was that S-prefix patterns were matching regular English words like "Shadow", "Shift", "Should" etc. Fixed it by only matching uppercase-S patterns and keeping a small list of false positives to filter out.

Results: 56 extensions match between both sources, 29 are only in the JSON (mostly compound names like `rv_d_zfa`), and 152 are only in the manual. The asymmetry makes sense though — lots of manual extensions define CSRs or address translation modes rather than actual opcodes, so they don't show up in `instr_dict.json`.

**Tier 3 (Bonus) Sharing graph**

Builds a graph where extensions are connected if they share at least one instruction. Outputs both a text adjacency list and DOT format you can paste into [Graphviz Online](https://dreampuf.github.io/GraphvizOnline) to visualize.

The crypto extensions (Zk, Zkn, Zks) create really dense clusters since they're basically "bundle" extensions that re-export instructions from smaller ones like Zbkb, Zbkc, Zknh, etc.

**Some notes**

- Used `.mjs` with ES module imports since it felt cleaner than CommonJS for this
- Zero external deps — `node:test`, `node:fs`, `node:path` cover everything
- `instr_dict.json` is treated as source of truth for instruction encodings
- Many manual-only extensions dont have a JSON match and thats expected — they define behaviors/CSRs not opcodes
