/**
 * Tier 2 — Cross-Reference with the ISA Manual
 *
 * Scans AsciiDoc source files from the riscv-isa-manual repository
 * for extension name references and cross-references them against
 * the extensions found in instr_dict.json.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

/**
 * Recursively collect all .adoc file paths under a directory.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectAdocFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectAdocFiles(fullPath));
    } else if (extname(entry.name) === '.adoc') {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Build a normalization map for instr_dict.json extension names.
 *
 * instr_dict.json uses names like "rv_zba", "rv64_zba", "rv32_i", "rv_i", "rv_c", etc.
 * The ISA manual refers to them as "Zba", "I", "C", "M", "Zicsr", etc.
 *
 * Normalization strategy:
 *   1. Strip the "rv_", "rv32_", "rv64_", "rv128_" prefix
 *   2. Lowercase the result for case-insensitive matching
 *
 * @param {string[]} jsonExtNames – raw extension names from instr_dict.json
 * @returns {Map<string, string>} normalized (lowercase) → original json name
 */
export function buildNormalizationMap(jsonExtNames) {
  const map = new Map();
  for (const raw of jsonExtNames) {
    const normalized = normalizeJsonExtName(raw);
    // Keep the first occurrence if duplicates arise
    if (!map.has(normalized)) {
      map.set(normalized, raw);
    }
  }
  return map;
}

/**
 * Normalize a single instr_dict.json extension name.
 * "rv_zba" → "zba", "rv64_zba" → "zba", "rv_i" → "i", "rv32_c" → "c"
 */
export function normalizeJsonExtName(name) {
  return name
    .replace(/^rv(?:32|64|128)?_/, '')
    .toLowerCase();
}

/**
 * Scan all .adoc files under `srcDir` and extract extension name references.
 *
 * We look for several AsciiDoc patterns the manual uses to reference extensions:
 *   - Section anchors: [[zba]], [[Zba]], [[zicsr]]
 *   - Cross-references: <<zba>>, <<#zba>>, <<#zba,Zba>>
 *   - ext: macro: ext:zba[], ext:Zba[]
 *   - Inline text patterns: "Zba extension", "the Zba", "`Zba`"
 *   - Titles: == Zba, === "Zba" …
 *
 * We match known RISC-V extension naming patterns:
 *   Single-letter: I, M, A, F, D, Q, C, V, H, N, S, U, B, E, G, J, K, L, P, T
 *   Multi-letter:  Z[a-z]+, S[a-z]+, Ss[a-z]+, Sv[a-z]+, Sm[a-z]+, Sh[a-z]+
 *
 * @param {string} srcDir – path to riscv-isa-manual/src/
 * @returns {Promise<Set<string>>} set of normalized (lowercase) extension names found
 */
export async function scanManualForExtensions(srcDir) {
  const adocFiles = await collectAdocFiles(srcDir);
  const found = new Set();

  // ── Step 1: Extract extension names from .adoc file names ──
  // Files like zba.adoc, svnapot.adoc, sscofpmf.adoc are named after extensions
  for (const filePath of adocFiles) {
    const fileName = filePath.split(/[\\/]/).pop().replace('.adoc', '');
    if (/^z[a-z]/.test(fileName) || /^sv[a-z]/.test(fileName) ||
        /^ss[a-z]/.test(fileName) || /^sm[a-z]/.test(fileName) ||
        /^sh[a-z]/.test(fileName)) {
      found.add(fileName.toLowerCase());
    }
  }

  // ── Step 2: Scan file contents ──

  // Z-extensions: case-insensitive, very distinctive (Zba, Zicsr, Zvk, etc.)
  const zExtPattern = /\bZ[a-z][a-z0-9]*\b/gi;

  // ext: macros — ext:zicsr[], ext:Zba[], ext:svinval[]
  const extMacroPattern = /ext:([a-zA-Z][a-zA-Z0-9_]*)\[\]/g;

  // Single-letter standard extensions in explicit context
  const singleLetterInContext =
    /\b(?:the\s+)?([IMAFDQCVHNSUB])\s+[Ee]xtension\b/g;

  // RV32I, RV64M, RV128I, etc.
  const rvBasePattern = /\bRV(?:32|64|128)([IMAFDQCVHNEGSUB])\b/g;

  // S-prefixed extensions (case-sensitive) — require uppercase S + specific prefix
  // Followed by at least 3 more lowercase chars to avoid short English words
  const sExtPatterns = [
    /\bSv[a-z]{2,}[a-z0-9]*\b/g,     // Svnapot, Svinval, Svpbmt, Svadu, ...
    /\bSs[a-z]{2,}[a-z0-9]*\b/g,     // Sscofpmf, Sscounterenw, Ssdbltrp, ...
    /\bSm[a-z]{2,}[a-z0-9]*\b/g,     // Smstateen, Smrnmi, Smepmp, ...
    /\bSh[a-z]{2,}[a-z0-9]*\b/g,     // Shcounterenw, Shgatpa, ...
  ];

  for (const fp of adocFiles) {
    const content = await readFile(fp, 'utf-8');

    // Z-extensions
    for (const match of content.matchAll(zExtPattern)) {
      found.add(match[0].toLowerCase());
    }

    // S-prefixed extensions (case-sensitive)
    for (const pattern of sExtPatterns) {
      for (const match of content.matchAll(pattern)) {
        const name = match[0].toLowerCase();
        if (!ENGLISH_FALSE_POSITIVES.has(name)) {
          found.add(name);
        }
      }
    }

    // ext: macros
    for (const match of content.matchAll(extMacroPattern)) {
      found.add(match[1].toLowerCase());
    }

    // Single-letter extensions in context
    for (const match of content.matchAll(singleLetterInContext)) {
      found.add(match[1].toLowerCase());
    }

    // RV32I, RV64M, etc.
    for (const match of content.matchAll(rvBasePattern)) {
      found.add(match[1].toLowerCase());
    }
  }

  return found;
}

/**
 * Common English words that match S-prefix extension patterns (Sv*, Ss*, Sm*, Sh*).
 * These are filtered out during manual scanning.
 */
const ENGLISH_FALSE_POSITIVES = new Set([
  // Sh-prefix false positives
  'shadow', 'shadowed', 'shadows', 'shaked', 'shall', 'shamt', 'shannon',
  'shanbhogue', 'shangmi', 'shape', 'share', 'shared', 'shares', 'sharing',
  'shift', 'shifted', 'shifter', 'shifting', 'shiftrows', 'shifts',
  'shootdown', 'shootdowns', 'short', 'shortage', 'shortcuts', 'shorten',
  'shorter', 'shortest', 'shorthand', 'shot', 'should', 'show', 'showing',
  'shown', 'shows', 'shrink', 'shuffle', 'shub',
  // Sm-prefix false positives
  'small', 'smaller', 'smallest', 'smart',
  // Sv-prefix false positives
  // (Sv* words are mostly RISC-V specific, few false positives)
  // Ss-prefix false positives
  // (Ss* very rare in English)
]);

/**
 * Cross-reference JSON extensions against manual extensions, produce a report.
 *
 * @param {Map<string, string>} normMap – normalized → original JSON ext name
 * @param {Set<string>} manualExts – normalized extension names from manual
 * @returns {{ matched: string[], jsonOnly: string[], manualOnly: string[] }}
 */
export function crossReference(normMap, manualExts) {
  const matched = [];
  const jsonOnly = [];
  const manualOnly = [];

  // Check each JSON extension against the manual
  for (const [normalized, original] of normMap) {
    if (manualExts.has(normalized)) {
      matched.push(original);
    } else {
      jsonOnly.push(original);
    }
  }

  // Check which manual extensions have no JSON counterpart
  const jsonNormalized = new Set(normMap.keys());
  for (const manualExt of [...manualExts].sort()) {
    if (!jsonNormalized.has(manualExt)) {
      manualOnly.push(manualExt);
    }
  }

  return {
    matched: matched.sort(),
    jsonOnly: jsonOnly.sort(),
    manualOnly: manualOnly.sort(),
  };
}

/**
 * Print the Tier 2 cross-reference report.
 */
export function printTier2Report(result) {
  const { matched, jsonOnly, manualOnly } = result;

  console.log('='.repeat(70));
  console.log('TIER 2 — Cross-Reference with the ISA Manual');
  console.log('='.repeat(70));
  console.log('');

  console.log(`Summary: ${matched.length} matched, ${jsonOnly.length} in JSON only, ${manualOnly.length} in manual only`);
  console.log('');

  // ── Matched ──
  console.log('─'.repeat(65));
  console.log(`Matched extensions (in both instr_dict.json and ISA manual): ${matched.length}`);
  console.log('─'.repeat(65));
  for (const ext of matched) {
    console.log(`  ✓ ${ext}`);
  }
  console.log('');

  // ── JSON only ──
  console.log('─'.repeat(65));
  console.log(`Extensions in instr_dict.json but NOT in the ISA manual: ${jsonOnly.length}`);
  console.log('─'.repeat(65));
  for (const ext of jsonOnly) {
    console.log(`  ✗ ${ext}`);
  }
  console.log('');

  // ── Manual only ──
  console.log('─'.repeat(65));
  console.log(`Extensions in the ISA manual but NOT in instr_dict.json: ${manualOnly.length}`);
  console.log('─'.repeat(65));
  for (const ext of manualOnly) {
    console.log(`  ◦ ${ext}`);
  }
  console.log('');
}
