// The weapon visual registry covers every weapon base and never owns gameplay data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEAPONS } from '../src/rpg/items.js';
import { WEAPON_VISUALS, getWeaponVisual, ICON_INDEX, ICON_ATLAS, rarityTier, weaponElements, ELEMENT_VISUAL, RARITY_VISUAL } from '../src/rpg/weaponVisuals.js';

const SHEET = ['shinai', 'rustkatana', 'wakizashi', 'tachi', 'uchigatana', 'nodachi', 'moonkatana', 'onicleaver', 'dragontachi', 'stormedge',
  'twigbow', 'huntbow', 'recurve', 'longbow', 'composite', 'reedbow', 'elmwarbow', 'galebow', 'sunbow',
  'twigwand', 'acornstaff', 'crookstaff', 'shroomwand', 'candlestaff', 'owlstaff', 'hexwand', 'frostrod', 'starstaff'];

test('every weapon base has a visual, keyed by its base id', () => {
  for (const w of WEAPONS) { const v = getWeaponVisual(w.id); assert.ok(v, w.id + ' has a visual'); assert.ok(v.family && v.model, w.id); }
});
test('every weapon on the approved sheet has its own icon cell (no shared icons)', () => {
  const atlas = JSON.parse(readFileSync(new URL('../assets/weapons/atlas.json', import.meta.url)));
  assert.deepEqual(atlas.index, ICON_INDEX, 'registry mirrors the generated atlas index');
  assert.equal(atlas.cell, ICON_ATLAS.cell);
  for (const id of SHEET) assert.notEqual(getWeaponVisual(id).icon, null, id);
  const cells = Object.values(ICON_INDEX); assert.equal(new Set(cells).size, cells.length);
  for (const w of WEAPONS.filter(w => w.kind === 'chain')) assert.notEqual(getWeaponVisual(w.id).icon, null, w.id + ' chain icon');
});
test('the registry is visual only: no stats', () => {
  for (const [id, v] of Object.entries(WEAPON_VISUALS)) for (const k of ['dmg', 'spd', 'reach', 'lvl', 'affixes', 'stats']) assert.ok(!(k in v), `${id}.${k}`);
});
test('rarity tiers and elements read from the item through small adapters', () => {
  assert.equal(rarityTier({ r: 2 }), 2); assert.equal(rarityTier({ r: 4, prismatic: true }), 5); assert.equal(rarityTier({ rarity: 'prismatic' }), 5);
  assert.equal(RARITY_VISUAL.length, 6); assert.equal(RARITY_VISUAL[0].beam, 0, 'common drops stay plain');
  assert.deepEqual(weaponElements({ base: 'uchigatana', stats: { chill: 8 } }), ['frost']);
  assert.deepEqual(weaponElements({ base: 'uchigatana', element: 'poison', stats: {} }), ['poison']);
  assert.ok(weaponElements({ base: 'stormedge', stats: {} }).includes('lightning'));
  for (const e of ['fire', 'frost', 'lightning', 'poison', 'bleed', 'shadow', 'holy', 'arcane']) assert.ok(ELEMENT_VISUAL[e], e);
});
