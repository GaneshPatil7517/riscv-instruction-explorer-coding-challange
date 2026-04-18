// tests for tier 1 parsing logic

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { keyToMnemonic, groupByExtension } from '../src/tier1.mjs';

describe('keyToMnemonic', () => {
  it('converts simple instruction key', () => {
    assert.equal(keyToMnemonic('add'), 'ADD');
  });

  it('converts underscore-separated key to dot notation', () => {
    assert.equal(keyToMnemonic('sc_w'), 'SC.W');
  });

  it('converts add_uw to ADD.UW', () => {
    assert.equal(keyToMnemonic('add_uw'), 'ADD.UW');
  });

  it('converts compressed instruction key', () => {
    assert.equal(keyToMnemonic('c_lw'), 'C.LW');
  });

  it('handles single-char key', () => {
    assert.equal(keyToMnemonic('j'), 'J');
  });
});

describe('groupByExtension', () => {
  const sampleDict = {
    add: {
      encoding: '0000000----------000-----0110011',
      variable_fields: ['rd', 'rs1', 'rs2'],
      extension: ['rv_i'],
      match: '0x33',
      mask: '0xfe00707f',
    },
    sh1add: {
      encoding: '0010000----------010-----0110011',
      variable_fields: ['rd', 'rs1', 'rs2'],
      extension: ['rv_zba'],
      match: '0x20002033',
      mask: '0xfe00707f',
    },
    andn: {
      encoding: '0100000----------111-----0110011',
      variable_fields: ['rd', 'rs1', 'rs2'],
      extension: ['rv_zbb', 'rv_zbkb'],
      match: '0x40007033',
      mask: '0xfe00707f',
    },
  };

  it('groups instructions by extension correctly', () => {
    const { byExtension } = groupByExtension(sampleDict);
    assert.equal(byExtension.get('rv_i')?.length, 1);
    assert.equal(byExtension.get('rv_zba')?.length, 1);
    assert.equal(byExtension.get('rv_zbb')?.length, 1);
    assert.equal(byExtension.get('rv_zbkb')?.length, 1);
  });

  it('identifies multi-extension instructions', () => {
    const { multiExt } = groupByExtension(sampleDict);
    assert.equal(multiExt.length, 1);
    assert.equal(multiExt[0].mnemonic, 'ANDN');
    assert.deepEqual(multiExt[0].extensions, ['rv_zbb', 'rv_zbkb']);
  });

  it('returns empty multiExt when no shared instructions', () => {
    const noShared = {
      add: { extension: ['rv_i'] },
      mul: { extension: ['rv_m'] },
    };
    const { multiExt } = groupByExtension(noShared);
    assert.equal(multiExt.length, 0);
  });

  it('handles entries with missing extension field', () => {
    const dict = {
      nop: { encoding: '00000000000000000000000000010011' },
    };
    const { byExtension, multiExt } = groupByExtension(dict);
    assert.equal(byExtension.size, 0);
    assert.equal(multiExt.length, 0);
  });
});
