#!/usr/bin/env node

/**
 * RISC-V Instruction Set Explorer
 * ================================
 * LFX Mentorship Coding Challenge — "Mapping the RISC-V Extensions Landscape"
 *
 * Usage:
 *   node src/main.mjs [--instr-dict <path>] [--manual-src <path>]
 *
 * Defaults:
 *   --instr-dict  ../riscv-extensions-landscape/src/instr_dict.json
 *   --manual-src  ../riscv-isa-manual/src/
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadInstrDict, groupByExtension, printTier1Report } from './tier1.mjs';
import { buildNormalizationMap, scanManualForExtensions, crossReference, printTier2Report } from './tier2.mjs';
import { buildSharingGraph, printSharingGraph } from './tier3_graph.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Parse CLI arguments ──
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    instrDict: resolve(__dirname, '../../riscv-extensions-landscape/src/instr_dict.json'),
    manualSrc: resolve(__dirname, '../../riscv-isa-manual/src'),
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--instr-dict' && args[i + 1]) {
      opts.instrDict = resolve(args[++i]);
    } else if (args[i] === '--manual-src' && args[i + 1]) {
      opts.manualSrc = resolve(args[++i]);
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node src/main.mjs [--instr-dict <path>] [--manual-src <path>]');
      process.exit(0);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        RISC-V Instruction Set Explorer — Coding Challenge           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  instr_dict.json : ${opts.instrDict}`);
  console.log(`  ISA manual src/ : ${opts.manualSrc}`);
  console.log('');

  // ══════════════════════════════════════════════════════════════════════
  // TIER 1 — Instruction Set Parsing
  // ══════════════════════════════════════════════════════════════════════
  console.log('Loading instr_dict.json …');
  const instrDict = await loadInstrDict(opts.instrDict);
  const totalInstructions = Object.keys(instrDict).length;
  console.log(`  Loaded ${totalInstructions} instruction entries.`);
  console.log('');

  const { byExtension, multiExt } = groupByExtension(instrDict);
  printTier1Report(byExtension, multiExt);

  // ══════════════════════════════════════════════════════════════════════
  // TIER 2 — Cross-Reference with the ISA Manual
  // ══════════════════════════════════════════════════════════════════════
  console.log('Scanning ISA manual AsciiDoc files …');
  const jsonExtNames = [...byExtension.keys()];
  const normMap = buildNormalizationMap(jsonExtNames);
  const manualExts = await scanManualForExtensions(opts.manualSrc);
  console.log(`  Found ${manualExts.size} extension references in the manual.`);
  console.log('');

  const xrefResult = crossReference(normMap, manualExts);
  printTier2Report(xrefResult);

  // ══════════════════════════════════════════════════════════════════════
  // TIER 3 (Bonus) — Extension Sharing Graph
  // ══════════════════════════════════════════════════════════════════════
  const { adjacency, sharedInstructions } = buildSharingGraph(instrDict);
  printSharingGraph(adjacency, sharedInstructions);

  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
