// The Soulbound's data: class, save compatibility, SoulChain items, the tree, Echo costs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, costLabel, resLabel, echoCount, ECHO, MAX_ECHOES, computeStats } from '../src/rpg/classes.js';
import { normalizeCharacter, createProfile, defaultInventory } from '../src/persistence/model.js';
import { starterWeapon, genItem, makeNamed, WEAPONS } from '../src/rpg/items.js';
import { weaponFamily, CLASS_FAMILIES } from '../src/rpg/gear.js';
import { TREES, SKILLS, PATHS, ensureTree, spendNode, respecTree, treeOf, legacyAbilities } from '../src/rpg/skills.js';
import { RECIPES } from '../src/rpg/crafting.js';
import { chainColors } from '../src/hero.js';
import { chainStyle } from '../src/weaponModels.js';
import { Player } from '../src/entities/player.js';

test('the Soulbound is a full class with Soul Echoes as its resource', () => {
  const C = CLASSES.soulbound;
  assert.equal(C.name, 'Soulbound');
  assert.equal(C.tagline, 'Between life and death, the path remains.');
  assert.ok(C.echo && C.res === 'Soul Echoes' && C.resRegen === 0);
  assert.equal(C.abilities.length, 3);
  assert.equal(MAX_ECHOES * ECHO, 100, 'five Echoes fill the usual 0-100 pool');
  assert.equal(echoCount(59.9), 2); assert.equal(echoCount(60), 3);
  assert.equal(costLabel('soulbound', 40), '2 Soul Echoes'); assert.equal(costLabel('soulbound', 20), '1 Soul Echo'); assert.equal(costLabel('soulbound', 0), 'Free');
  assert.equal(costLabel('samurai', 25), '25 Ki', 'other classes read costs as before');
  assert.equal(resLabel('soulbound', 80), 'Soul Echoes 4 / 5');
});

test('a Soulbound character is created, saved and reloaded like any other', () => {
  const inventory = defaultInventory('soulbound'); inventory.equip.weapon = starterWeapon('soulbound');
  const p = createProfile({ name: 'Wren', classId: 'soulbound', inventory });
  const q = normalizeCharacter(JSON.parse(JSON.stringify(p)));
  assert.equal(q.classId, 'soulbound');
  assert.equal(q.inventory.equip.weapon.base, 'tetherchain');
  assert.equal(weaponFamily(q.inventory.equip.weapon), 'chain');
  assert.throws(() => normalizeCharacter({ ...JSON.parse(JSON.stringify(p)), classId: 'necromancer' }), /Unsupported character class/);
});

test('the live Soulbound player routes its starting chain into the lash combo', () => {
  const inv = defaultInventory('soulbound'); inv.equip.weapon = starterWeapon('soulbound');
  const g = { inv, pstats: computeStats(inv), res: 100, time: 0, nearestEnemy: () => null };
  const p = new Player(g, 10, 10);
  p.basicAttack();
  assert.equal(p.family, 'chain');
  assert.equal(p.state, 'lash', 'a Soulbound attack enters the chain lash state, not the Samurai sword state');
  assert.equal(p.combo, 1);
  assert.ok(p.chainRange() >= 2.5);
});

test('SoulChains are a weapon family of their own and roll melee affixes', () => {
  for (const base of ['tetherchain', 'veilchain']) {
    const style = chainStyle({base});
    assert.deepEqual(chainColors({base}), [style.a, style.spirit]);
  }
  assert.deepEqual(CLASS_FAMILIES.soulbound, ['chain']);
  const chains = WEAPONS.filter(w => w.kind === 'chain');
  assert.ok(chains.filter(w => !w.named).length >= 8, 'eight chain bases');
  assert.ok(chains.filter(w => w.named).length >= 5, 'five named SoulChains in the collection');
  for (const w of chains) assert.ok(w.reach >= 2.4, w.id + ' has a lash reach');
  let rolled = 0;
  for (let i = 0; i < 300; i++) { const it = genItem({ cls: 'soulbound', slot: 'weapon', level: 12, rarity: 2 }); if (it.kind === 'chain') { rolled++; assert.ok(it.affixes.length > 0 && it.min > 0 && it.max > it.min); } }
  assert.ok(rolled > 150, 'Soulbound weapon drops are mostly SoulChains');
  const L = makeNamed('lanternchain', 12); assert.equal(L.kind, 'chain'); assert.equal(L.unique, 'lanternchain');
  assert.ok(RECIPES.some(r => r.cls === 'soulbound' && r.kind === 'weapon') && RECIPES.some(r => r.cls === 'soulbound' && r.kind === 'sigil'));
});

test('the tree: three paths, nine abilities, free grants at 1/3/6, respec is exact', () => {
  assert.equal(PATHS.soulbound.length, 3);
  const t = treeOf('soulbound');
  assert.equal(t.filter(n => n.skill).length, 9);
  assert.equal(t.filter(n => n.type === 'key').length, 3);
  for (const n of t) for (const r of n.req) assert.ok(t.some(m => m.id === r), n.id + ' requires ' + r);
  for (const n of t.filter(n => n.skill)) assert.equal(SKILLS[n.skill].cls, 'soulbound');
  assert.deepEqual(legacyAbilities('soulbound'), ['soulhook', 'veilshift', 'kindred']);
  const inv = { ...defaultInventory('soulbound'), level: 12, sp: 11 };
  ensureTree(inv);
  assert.deepEqual([inv.tree.soulhook, inv.tree.veilshift, inv.tree.kindred], [1, 1, 1]);
  assert.deepEqual(inv.loadout.slice(0, 3), ['soulhook', 'veilshift', 'kindred']);
  assert.ok(spendNode(inv, 'longchain') && spendNode(inv, 'reapingcoil'));
  assert.equal(inv.sp, 9);
  assert.equal(respecTree(inv), 2); assert.equal(inv.sp, 11);
  // every ability cost is a whole number of Echoes
  for (const s of Object.values(SKILLS).filter(s => s.cls === 'soulbound')) assert.equal(s.cost % ECHO, 0, s.id);
});
