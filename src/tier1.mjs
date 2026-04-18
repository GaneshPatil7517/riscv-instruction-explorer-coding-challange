// Tier 1 — parse instr_dict.json, group by extension, find multi-ext instructions

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Load and parse instr_dict.json
export async function loadInstrDict(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

// Turn a JSON key like "sc_w" into a readable mnemonic like "SC.W"
export function keyToMnemonic(key) {
  return key.replace(/_/g, '.').toUpperCase();
}

// Group instructions by extension. Also collects ones that appear in 2+ extensions.
export function groupByExtension(instrDict) {
  const byExtension = new Map();
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

  // sort alphabetically so output is deterministic
  const sorted = new Map([...byExtension.entries()].sort((a, b) => a[0].localeCompare(b[0])));

  return { byExtension: sorted, multiExt };
}

// Print the tier 1 summary to stdout
export function printTier1Report(byExtension, multiExt) {
  console.log('='.repeat(70));
  console.log('TIER 1 — Instruction Set Parsing');
  console.log('='.repeat(70));
  console.log('');

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
