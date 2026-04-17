/**
 * Tier 3 (Bonus) — Extension Sharing Graph
 *
 * Generates a text-based graph showing which extensions share instructions.
 * Two extensions are connected if at least one instruction belongs to both.
 */

/**
 * Build an adjacency list of extensions that share at least one instruction.
 *
 * @param {Record<string, object>} instrDict – parsed instr_dict.json
 * @returns {{ adjacency: Map<string, Set<string>>, sharedInstructions: Map<string, string[]> }}
 *   adjacency: ext → Set of connected extensions
 *   sharedInstructions: "extA↔extB" → [mnemonic, …]
 */
export function buildSharingGraph(instrDict) {
  const adjacency = new Map();
  const sharedInstructions = new Map();

  for (const [key, details] of Object.entries(instrDict)) {
    const extensions = details.extension ?? [];
    if (extensions.length < 2) continue;

    const mnemonic = key.replace(/_/g, '.').toUpperCase();

    // For each pair of extensions this instruction belongs to, add an edge
    for (let i = 0; i < extensions.length; i++) {
      for (let j = i + 1; j < extensions.length; j++) {
        const a = extensions[i];
        const b = extensions[j];

        if (!adjacency.has(a)) adjacency.set(a, new Set());
        if (!adjacency.has(b)) adjacency.set(b, new Set());
        adjacency.get(a).add(b);
        adjacency.get(b).add(a);

        const edgeKey = [a, b].sort().join('↔');
        if (!sharedInstructions.has(edgeKey)) sharedInstructions.set(edgeKey, []);
        sharedInstructions.get(edgeKey).push(mnemonic);
      }
    }
  }

  return { adjacency, sharedInstructions };
}

/**
 * Print the sharing graph as a text-based adjacency list with DOT format.
 */
export function printSharingGraph(adjacency, sharedInstructions) {
  console.log('='.repeat(70));
  console.log('TIER 3 (Bonus) — Extension Sharing Graph');
  console.log('='.repeat(70));
  console.log('');

  if (adjacency.size === 0) {
    console.log('No instructions are shared between extensions.');
    console.log('');
    return;
  }

  // ── Text adjacency list ──
  console.log('Adjacency List (extensions sharing at least one instruction):');
  console.log('─'.repeat(65));

  const sortedExts = [...adjacency.keys()].sort();
  for (const ext of sortedExts) {
    const neighbors = [...adjacency.get(ext)].sort();
    console.log(`  ${ext} ↔ ${neighbors.join(', ')}`);
  }
  console.log('');

  // ── Shared instructions per edge ──
  console.log('Shared instructions per edge:');
  console.log('─'.repeat(65));

  const sortedEdges = [...sharedInstructions.keys()].sort();
  for (const edge of sortedEdges) {
    const mnemonics = sharedInstructions.get(edge);
    console.log(`  ${edge}: ${mnemonics.join(', ')} (${mnemonics.length} shared)`);
  }
  console.log('');

  // ── DOT graph format (can be visualized with Graphviz) ──
  console.log('DOT format (paste into https://dreampuf.github.io/GraphvizOnline):');
  console.log('─'.repeat(65));
  console.log('graph ExtensionSharing {');
  console.log('  rankdir=LR;');
  console.log('  node [shape=box, style=filled, fillcolor="#e8f4f8"];');
  console.log('');

  const printedEdges = new Set();
  for (const ext of sortedExts) {
    const neighbors = [...adjacency.get(ext)].sort();
    for (const neighbor of neighbors) {
      const edgeId = [ext, neighbor].sort().join('--');
      if (printedEdges.has(edgeId)) continue;
      printedEdges.add(edgeId);

      const edgeKey = [ext, neighbor].sort().join('↔');
      const count = sharedInstructions.get(edgeKey)?.length ?? 0;
      console.log(`  "${ext}" -- "${neighbor}" [label="${count}"];`);
    }
  }

  console.log('}');
  console.log('');
}
