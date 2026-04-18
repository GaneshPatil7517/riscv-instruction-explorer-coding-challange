// Tier 2 — scan the ISA manual's AsciiDoc files for extension references
// and cross-reference them against what's in instr_dict.json

import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

// recursively find all .adoc files in a directory
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

// Build a map from normalized extension name -> original JSON name
// e.g. "rv_zba" and "rv64_zba" both normalize to "zba"
export function buildNormalizationMap(jsonExtNames) {
  const map = new Map();
  for (const raw of jsonExtNames) {
    const normalized = normalizeJsonExtName(raw);
    if (!map.has(normalized)) {
      map.set(normalized, raw);
    }
  }
  return map;
}

// strip rv_/rv32_/rv64_/rv128_ prefix and lowercase
export function normalizeJsonExtName(name) {
  return name
    .replace(/^rv(?:32|64|128)?_/, '')
    .toLowerCase();
}

// Scan .adoc files for extension name references.
// This tries to catch the different ways the manual mentions extensions:
// file names, Z* patterns, S-prefix extensions, ext: macros, RV64M-style refs, etc.
export async function scanManualForExtensions(srcDir) {
  const adocFiles = await collectAdocFiles(srcDir);
  const found = new Set();

  // grab extension names from .adoc filenames (zba.adoc, svnapot.adoc, etc)
  for (const filePath of adocFiles) {
    const fileName = filePath.split(/[\\/]/).pop().replace('.adoc', '');
    if (/^z[a-z]/.test(fileName) || /^sv[a-z]/.test(fileName) ||
        /^ss[a-z]/.test(fileName) || /^sm[a-z]/.test(fileName) ||
        /^sh[a-z]/.test(fileName)) {
      found.add(fileName.toLowerCase());
    }
  }

  // now scan file contents with various regex patterns

  // Z-extensions are easy to spot (Zba, Zicsr, Zvk...)
  const zExtPattern = /\bZ[a-z][a-z0-9]*\b/gi;

  // ext: macros like ext:zicsr[], ext:Zba[]
  const extMacroPattern = /ext:([a-zA-Z][a-zA-Z0-9_]*)\[\]/g;

  // single-letter extensions only when they appear in context like "the M extension"
  const singleLetterInContext =
    /\b(?:the\s+)?([IMAFDQCVHNSUB])\s+[Ee]xtension\b/g;

  // RV32I, RV64M etc
  const rvBasePattern = /\bRV(?:32|64|128)([IMAFDQCVHNEGSUB])\b/g;

  // S-prefixed extensions need uppercase S to avoid matching english words
  // require 3+ trailing lowercase chars to reduce noise
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

// common english words that accidentally match S-prefix extension patterns
// (ran into this during testing, words like "Shadow", "Should" etc were showing up)
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

// Compare JSON extensions vs manual extensions and categorize them
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
