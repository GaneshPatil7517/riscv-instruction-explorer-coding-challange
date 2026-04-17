/**
 * Unit tests for Tier 3 — Extension Sharing Graph
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSharingGraph } from '../src/tier3_graph.mjs';

describe('buildSharingGraph', () => {
  it('creates edges between extensions sharing an instruction', () => {
    const dict = {
      andn: {
        extension: ['rv_zbb', 'rv_zbkb'],
      },
    };

    const { adjacency, sharedInstructions } = buildSharingGraph(dict);

    assert.ok(adjacency.get('rv_zbb')?.has('rv_zbkb'));
    assert.ok(adjacency.get('rv_zbkb')?.has('rv_zbb'));

    const edgeKey = 'rv_zbb↔rv_zbkb';
    assert.deepEqual(sharedInstructions.get(edgeKey), ['ANDN']);
  });

  it('handles instructions belonging to 3+ extensions', () => {
    const dict = {
      foo: {
        extension: ['ext_a', 'ext_b', 'ext_c'],
      },
    };

    const { adjacency } = buildSharingGraph(dict);

    // Should create edges: a↔b, a↔c, b↔c
    assert.ok(adjacency.get('ext_a')?.has('ext_b'));
    assert.ok(adjacency.get('ext_a')?.has('ext_c'));
    assert.ok(adjacency.get('ext_b')?.has('ext_c'));
  });

  it('accumulates multiple shared instructions on the same edge', () => {
    const dict = {
      andn: { extension: ['rv_zbb', 'rv_zbkb'] },
      xnor: { extension: ['rv_zbb', 'rv_zbkb'] },
      rol: { extension: ['rv_zbb', 'rv_zbkb'] },
    };

    const { sharedInstructions } = buildSharingGraph(dict);
    const edgeKey = 'rv_zbb↔rv_zbkb';
    assert.equal(sharedInstructions.get(edgeKey)?.length, 3);
  });

  it('returns empty graph when no multi-extension instructions', () => {
    const dict = {
      add: { extension: ['rv_i'] },
      mul: { extension: ['rv_m'] },
    };

    const { adjacency, sharedInstructions } = buildSharingGraph(dict);
    assert.equal(adjacency.size, 0);
    assert.equal(sharedInstructions.size, 0);
  });

  it('handles missing extension field gracefully', () => {
    const dict = {
      nop: { encoding: '0000' },
    };

    const { adjacency } = buildSharingGraph(dict);
    assert.equal(adjacency.size, 0);
  });
});
