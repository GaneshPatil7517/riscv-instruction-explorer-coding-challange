/**
 * Tier 1 — Instruction Set Parsing
 *
 * Reads instr_dict.json, groups instructions by extension tag,
 * prints a summary table, and identifies multi-extension instructions.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Load and parse instr_dict.json from the given path.
 * @param {string} filePath – absolute or relative path to instr_dict.json
 * @returns {Record<string, object>} parsed instruction dictionary
 */
export async function loadInstrDict(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Normalize an instr_dict.json key back to a human-readable mnemonic.
 * Convention: lowercase key with underscores → UPPERCASE with dots.
 *   e.g. "sc_w" → "SC.W", "add_uw" → "ADD.UW", "c_lw" → "C.LW"
 * @param {string} key
 * @returns {string}
 */
export function keyToMnemonic(key) {
  // The first underscore after a single-char prefix that matches a known
  // prefix (c, v) should be treated as a dot separator for compressed/vector.
  // General rule: replace underscores with dots then uppercase.
  return key.replace(/_/g, '.').toUpperCase();
}

/**
 * Group all instructions by their extension tag(s).
 * Each instruction may belong to one or more extensions.
 *
 * @param {Record<string, object>} instrDict
 * @returns {{ byExtension: Map<string, string[]>, multiExt: Array<{mnemonic: string, extensions: string[]}> }}
 */
export function groupByExtension(instrDict) {
  /** @type {Map<string, string[]>} extension → [mnemonic, …] */
  const byExtension = new Map();

  /** Instructions that belong to more than one extension */
  const multiExt = [];

  for (const [key, details] of Object.entries(instrDict)) {
    const mnemonic = keyToMnemonic(key);
    const extensions = details.extension ?? [];

    if (extensions.length > 1) {
      multiExt.push({ mnemonic, extensions: [...extensions] });
    }

    for (const ext of extensions) {
      if (!byExtension.has(ext)) {
        byExtension.set(ext, []);
      }
      byExtension.get(ext).push(mnemonic);
    }
  }

  // Sort extensions alphabetically for stable output
  const sorted = new Map([...byExtension.entries()].sort((a, b) => a[0].localeCompare(b[0])));

  return { byExtension: sorted, multiExt };
}

/**
 * Print the Tier 1 summary table to stdout.
 */
export function printTier1Report(byExtension, multiExt) {
  console.log('='.repeat(70));
  console.log('TIER 1 — Instruction Set Parsing');
  console.log('='.repeat(70));
  console.log('');

  // ── Summary table ──
  console.log('Extension Tag            | # Instructions | Example Mnemonic');
  console.log('─'.repeat(65));

  for (const [ext, mnemonics] of byExtension) {
    const padExt = ext.padEnd(24);
    const padCount = String(mnemonics.length).padStart(14);
    const example = mnemonics[0];
    console.log(`${padExt} | ${padCount} | ${example}`);
  }

  console.log('');
  console.log(`Total extensions: ${byExtension.size}`);
  console.log(`Total instruction entries: ${[...byExtension.values()].reduce((s, a) => s + a.length, 0)} (includes duplicates across extensions)`);
  console.log('');

  // ── Multi-extension instructions ──
  console.log('─'.repeat(65));
  console.log(`Instructions belonging to more than one extension: ${multiExt.length}`);
  console.log('─'.repeat(65));

  if (multiExt.length === 0) {
    console.log('  (none)');
  } else {
    for (const { mnemonic, extensions } of multiExt.sort((a, b) => a.mnemonic.localeCompare(b.mnemonic))) {
      console.log(`  ${mnemonic.padEnd(20)} → ${extensions.join(', ')}`);
    }
  }

  console.log('');
}
