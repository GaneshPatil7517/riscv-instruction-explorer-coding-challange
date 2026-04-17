# RISC-V Instruction Set Explorer

> LFX Mentorship Coding Challenge — **Mapping the RISC-V Extensions Landscape**

A JavaScript (Node.js) program that parses the RISC-V instruction dictionary,
cross-references it against the official ISA manual, and generates a visual
extension-sharing graph.

## Prerequisites

- **Node.js** ≥ 18 (uses `node:test`, ES modules, `matchAll`)
- **Git** (to clone the ISA manual)
- No external npm dependencies — uses only Node.js built-in modules

## Setup

```bash
# 1. Clone the required repositories (if not already present)
git clone https://github.com/rpsene/riscv-extensions-landscape.git
git clone https://github.com/riscv/riscv-isa-manual.git

# 2. No install needed — zero dependencies
```

## Usage

```bash
# Run from the project root
node src/main.mjs

# Or with custom paths
node src/main.mjs \
  --instr-dict /path/to/riscv-extensions-landscape/src/instr_dict.json \
  --manual-src /path/to/riscv-isa-manual/src/
```

**Default paths** (relative to `src/`):
- `--instr-dict` → `../riscv-extensions-landscape/src/instr_dict.json`
- `--manual-src` → `../riscv-isa-manual/src/`

## Running Tests

```bash
node --test test/tier1.test.mjs test/tier2.test.mjs test/tier3.test.mjs
```

25 unit tests covering all three tiers.

## Project Structure

```
riscv-instruction-explorer/
├── src/
│   ├── main.mjs           # Entry point — orchestrates all tiers
│   ├── tier1.mjs           # Tier 1: Instruction parsing & grouping
│   ├── tier2.mjs           # Tier 2: ISA manual cross-reference
│   └── tier3_graph.mjs     # Tier 3: Extension sharing graph
├── test/
│   ├── tier1.test.mjs      # Tests for parsing & grouping logic
│   ├── tier2.test.mjs      # Tests for normalization & cross-reference
│   └── tier3.test.mjs      # Tests for graph construction
├── sample_output.txt        # Full program output
├── package.json
└── README.md
```

---

## Tier 1 — Instruction Set Parsing

**What it does:**
1. Reads `instr_dict.json` (1,188 instruction entries)
2. Groups every instruction by its extension tag(s) (114 extensions found)
3. Prints a summary table: extension | instruction count | example mnemonic
4. Lists all 73 instructions that belong to more than one extension

**Key design decisions:**
- Mnemonic normalization: converts `instr_dict.json` keys (e.g., `sc_w`) back
  to readable mnemonics (`SC.W`) by replacing `_` with `.` and uppercasing
- Extensions are sorted alphabetically for deterministic output
- Multi-extension detection is O(n) — single pass over the dictionary

### Sample Output (Tier 1)

```
Extension Tag            | # Instructions | Example Mnemonic
─────────────────────────────────────────────────────────────────
rv_a                     |             11 | AMOADD.W
rv_c                     |             23 | C.ADD
rv_i                     |             37 | ADD
rv_m                     |              8 | DIV
rv_v                     |            627 | VAADD.VV
rv_zba                   |              3 | SH1ADD
rv_zbb                   |             17 | ANDN
...

Total extensions: 114
Total instruction entries: 1343 (includes duplicates across extensions)

Instructions belonging to more than one extension: 73
  ANDN                 → rv_zbb, rv_zkn, rv_zks, rv_zk, rv_zbkb
  CLMUL                → rv_zbc, rv_zkn, rv_zks, rv_zk, rv_zbkc
  ...
```

---

## Tier 2 — Cross-Reference with the ISA Manual

**What it does:**
1. Clones/reads the [official RISC-V ISA manual](https://github.com/riscv/riscv-isa-manual)
2. Scans all AsciiDoc files under `src/` for extension name references
3. Normalizes naming differences (`rv_zba` → `zba`, `Zba` → `zba`)
4. Cross-references the two sources and reports mismatches

**Name normalization strategy:**
- `instr_dict.json` names are prefixed: `rv_zba`, `rv64_zba`, `rv32_i`
- Strip the `rv_`, `rv32_`, `rv64_`, `rv128_` prefix, then lowercase
- ISA manual references are extracted from: file names (e.g., `zba.adoc`),
  inline capitalized patterns (`Zba`, `Svnapot`, `Smstateen`),
  `ext:` macros (`ext:zba[]`), and `RVxxY` patterns (`RV64M`)

**Edge case handling:**
- Compound extension names like `rv_d_zfa` (D + Zfa joint) have no direct
  manual counterpart — correctly classified as "JSON only"
- English words matching S-prefix patterns (`Small`, `Shadow`, `Shift`) are
  filtered via a false-positive exclusion list
- Single-letter extensions (I, M, A, F, D, Q, C, V) are only matched in
  explicit context ("the M extension", "RV64M") to avoid false positives

### Sample Output (Tier 2)

```
Summary: 56 matched, 29 in JSON only, 152 in manual only

Matched extensions (in both instr_dict.json and ISA manual): 56
  ✓ rv_zba
  ✓ rv_zbb
  ✓ rv_zvkned
  ...

Extensions in instr_dict.json but NOT in the ISA manual: 29
  ✗ rv_d_zfa          (compound extension — D+Zfa joint instructions)
  ✗ rv_zbp             (draft/vendor extension not in current manual)
  ✗ rv_zvfbdot32f      (proposed vector extension, not yet ratified)
  ...

Extensions in the ISA manual but NOT in instr_dict.json: 152
  ◦ smstateen          (supervisor extension — defines CSRs, not instructions)
  ◦ ssaia              (interrupt controller — no unique opcodes)
  ◦ svnapot            (address translation — no unique opcodes)
  ◦ zicntr             (counter extension — uses CSR instructions from Zicsr)
  ...
```

**Why the asymmetry?** Many manual-only extensions define CSRs, address
translation modes, or behavioral constraints — not new instruction opcodes.
They don't appear in `instr_dict.json` because that file only tracks
instruction encodings.

---

## Tier 3 (Bonus) — Extension Sharing Graph

**What it does:**
1. Builds an adjacency graph: two extensions are connected if they share at
   least one instruction
2. Prints the adjacency list with shared instruction details
3. Outputs a DOT-format graph for visualization with
   [Graphviz Online](https://dreampuf.github.io/GraphvizOnline)

**Key insight:** The RISC-V cryptography extensions (Zk, Zkn, Zks) are
"bundle" extensions that re-export instructions from component extensions
(Zbkb, Zbkc, Zbkx, Zknh, Zksed, Zksh). This creates dense clusters in the
sharing graph.

### Sample Output (Tier 3)

```
Adjacency List (extensions sharing at least one instruction):
  rv_zbb ↔ rv_zbkb, rv_zk, rv_zkn, rv_zks
  rv_zbc ↔ rv_zbkc, rv_zk, rv_zkn, rv_zks
  rv_zvbb ↔ rv_zvkn, rv_zvks
  ...

Shared instructions per edge:
  rv_zbb↔rv_zbkb: ANDN, ORN, ROL, ROR, XNOR (5 shared)
  rv_zvkn↔rv_zvkned: VAESDF.VS, VAESDF.VV, ... (11 shared)
  ...

DOT format (paste into https://dreampuf.github.io/GraphvizOnline):
  graph ExtensionSharing {
    "rv_zbb" -- "rv_zbkb" [label="5"];
    "rv_zbb" -- "rv_zk" [label="5"];
    ...
  }
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Zero dependencies** | Keeps the project lightweight and avoids supply-chain concerns. Node.js built-in `node:test`, `node:fs`, `node:path` are sufficient. |
| **ES modules (`.mjs`)** | Modern JavaScript standard; cleaner imports, better tree-shaking if bundled. |
| **Separate modules per tier** | Each tier is independently testable and has a clear single responsibility. |
| **BigInt not needed** | Unlike the main landscape app's validator, this challenge only needs string/set operations — no bitfield math required. |
| **Case-sensitive S-extension matching** | RISC-V S-prefix extensions (Sv*, Ss*, Sm*, Sh*) are always written with capital S in the manual, while English words are lowercase at sentence boundaries. This eliminates most false positives without a massive word list. |
| **Normalization-based cross-reference** | `instr_dict.json` uses `rv_`/`rv64_` prefixes; the manual uses bare names. Stripping the prefix and lowercasing both sides enables reliable matching despite naming differences. |
| **DOT graph output** | Graphviz DOT is a widely-supported, human-readable format. Users can paste directly into online renderers. |

## Assumptions

1. `instr_dict.json` is the authoritative source for instruction encodings
2. The ISA manual's `src/` directory contains the latest AsciiDoc sources
3. Extension names in `instr_dict.json` always follow the `rv[32|64|128]_<name>` pattern
4. Some extensions in the manual define CSRs or behavioral constraints (not opcodes)
   and will naturally have no `instr_dict.json` counterpart
