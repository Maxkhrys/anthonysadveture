// Survival recipes. Small on purpose: gather -> craft -> place -> return. Crafted pieces go to
// the build pouch and are placed from the Build list; taking a piece down returns it whole.
// station: must stand near that placed structure to craft.
export const RECIPES = [
  { id: 'campfire', name: 'Campfire', gives: 'campfire', cost: { wood: 4, stone: 3 }, desc: 'Rest to heal and set your home.' },
  { id: 'workbench', name: 'Workbench', gives: 'workbench', cost: { wood: 8, stone: 2 }, desc: 'Unlocks walls, doors, roofs and storage.' },
  { id: 'torch', name: 'Torches ×2', gives: 'torch', qty: 2, cost: { wood: 1, fibre: 1 }, desc: 'Light for camp at night.' },
  // the modular house kit (one module = 2×2 tiles; see kit.js for ids and rules)
  { id: 'stone_foundation', name: 'Stone foundation', gives: 'stone_foundation', cost: { stone: 6 }, desc: 'A raised stone base for one module.' },
  { id: 'timber_floor', name: 'Timber floor', gives: 'timber_floor', cost: { wood: 4 }, desc: 'A plank floor for one module, on the ground or upstairs.' },
  { id: 'timber_wall', name: 'Timber wall', gives: 'timber_wall', cost: { wood: 4 }, station: 'workbench', desc: 'A timber-framed wall for one side of a module.' },
  { id: 'timber_window', name: 'Window wall', gives: 'timber_window', cost: { wood: 5 }, station: 'workbench', desc: 'A wall with a shuttered window.' },
  { id: 'stone_wall', name: 'Stone wall', gives: 'stone_wall', cost: { stone: 6 }, station: 'workbench', desc: 'A heavy stone wall for one side of a module.' },
  { id: 'timber_doorway', name: 'Doorway', gives: 'timber_doorway', cost: { wood: 3 }, station: 'workbench', desc: 'An open timber doorway.' },
  { id: 'timber_door', name: 'Door', gives: 'timber_door', cost: { wood: 6 }, station: 'workbench', desc: 'A doorway with a door that opens and closes (F).' },
  { id: 'timber_post', name: 'Timber post', gives: 'timber_post', cost: { wood: 2 }, station: 'workbench', desc: 'Holds up a floor above (porches, balconies).' },
  { id: 'timber_stairs', name: 'Stairs', gives: 'timber_stairs', cost: { wood: 8 }, station: 'workbench', desc: 'Climbs one storey across a module.' },
  { id: 'thatch_roof', name: 'Thatch roof', gives: 'thatch_roof', cost: { wood: 2, fibre: 3 }, station: 'workbench', desc: 'A sloped roof over one module.' },
  { id: 'thatch_ridge', name: 'Roof ridge', gives: 'thatch_ridge', cost: { wood: 2, fibre: 3 }, station: 'workbench', desc: 'The peak between two slopes (roofs three modules deep).' },
  { id: 'timber_gable', name: 'Gable end', gives: 'timber_gable', cost: { wood: 3 }, station: 'workbench', desc: 'Closes the sloped end of a roof.' },
  { id: 'chest', name: 'Storage chest', gives: 'chest', cost: { wood: 6, stone: 2 }, station: 'workbench', desc: 'Store resources at camp, downstairs or up.' },
  { id: 'tonic', name: 'Crystal tonic', gives: 'tonic', cost: { fibre: 3, crystal: 1 }, station: 'workbench', desc: 'Refills one tonic (H).' },
  // the first pass's 1-tile pieces: still valid for older worlds and scripts, not listed any more
  { id: 'floor', name: 'Wooden floor tile ×2', gives: 'floor', qty: 2, cost: { wood: 3 }, legacy: true, desc: 'Walkable plank tiles.' },
  { id: 'wall', name: 'Wooden wall block', gives: 'wall', cost: { wood: 3 }, station: 'workbench', legacy: true, desc: 'A solid wall tile.' },
  { id: 'stonewall', name: 'Stone wall block', gives: 'stonewall', cost: { stone: 4 }, station: 'workbench', legacy: true, desc: 'A solid stone wall tile.' },
  { id: 'door', name: 'Doorway frame', gives: 'door', cost: { wood: 4 }, station: 'workbench', legacy: true, desc: 'An opening you can walk through.' },
  { id: 'roof', name: 'Thatch roof tile ×2', gives: 'roof', qty: 2, cost: { wood: 1, fibre: 2 }, station: 'workbench', legacy: true, desc: 'Goes over floors, walls and doorways.' },
];
