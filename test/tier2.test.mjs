// tests for tier 2 normalization and cross-reference

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJsonExtName, buildNormalizationMap, crossReference } from '../src/tier2.mjs';

describe('normalizeJsonExtName', () => {
  it('strips rv_ prefix', () => {
    assert.equal(normalizeJsonExtName('rv_zba'), 'zba');
  });

  it('strips rv32_ prefix', () => {
    assert.equal(normalizeJsonExtName('rv32_i'), 'i');
  });

  it('strips rv64_ prefix', () => {
    assert.equal(normalizeJsonExtName('rv64_zba'), 'zba');
  });

  it('strips rv128_ prefix', () => {
    assert.equal(normalizeJsonExtName('rv128_i'), 'i');
  });

  it('preserves names without rv prefix', () => {
    assert.equal(normalizeJsonExtName('zba'), 'zba');
  });

  it('lowercases the result', () => {
    assert.equal(normalizeJsonExtName('rv_ZBA'), 'zba');
  });
});

describe('buildNormalizationMap', () => {
  it('maps multiple JSON names that normalize to the same key', () => {
    const names = ['rv_zba', 'rv64_zba', 'rv_i', 'rv32_i'];
    const map = buildNormalizationMap(names);

    // First occurrence wins
    assert.equal(map.get('zba'), 'rv_zba');
    assert.equal(map.get('i'), 'rv_i');
  });

  it('handles empty input', () => {
    const map = buildNormalizationMap([]);
    assert.equal(map.size, 0);
  });
});

describe('crossReference', () => {
  it('correctly categorizes matched, JSON-only, and manual-only', () => {
    const normMap = new Map([
      ['zba', 'rv_zba'],
      ['zbb', 'rv_zbb'],
      ['zbc', 'rv_zbc'],
      ['i', 'rv_i'],
    ]);

    const manualExts = new Set(['zba', 'zbb', 'i', 'zicsr', 'zifencei']);

    const result = crossReference(normMap, manualExts);

    assert.deepEqual(result.matched, ['rv_i', 'rv_zba', 'rv_zbb']);
    assert.deepEqual(result.jsonOnly, ['rv_zbc']);
    assert.deepEqual(result.manualOnly, ['zicsr', 'zifencei']);
  });

  it('handles no matches', () => {
    const normMap = new Map([['zba', 'rv_zba']]);
    const manualExts = new Set(['zicsr']);

    const result = crossReference(normMap, manualExts);

    assert.equal(result.matched.length, 0);
    assert.deepEqual(result.jsonOnly, ['rv_zba']);
    assert.deepEqual(result.manualOnly, ['zicsr']);
  });

  it('handles complete overlap', () => {
    const normMap = new Map([['zba', 'rv_zba']]);
    const manualExts = new Set(['zba']);

    const result = crossReference(normMap, manualExts);

    assert.deepEqual(result.matched, ['rv_zba']);
    assert.equal(result.jsonOnly.length, 0);
    assert.equal(result.manualOnly.length, 0);
  });
});
