// Survival recipes. Small on purpose: gather -> craft -> place -> return. Crafted pieces go to
// the build pouch and are placed from the Build list; taking a piece down returns it whole.
// station: must stand near that placed structure to craft.
export const RECIPES = [
  { id: 'campfire', name: 'Campfire', gives: 'campfire', cost: { wood: 4, stone: 3 }, desc: 'Rest to heal and set your home.' },
  { id: 'workbench', name: 'Workbench', gives: 'workbench', cost: { wood: 8, stone: 2 }, desc: 'Unlocks walls, doors, roofs and storage.' },
  { id: 'torch', name: 'Torches ×2', gives: 'torch', qty: 2, cost: { wood: 1, fibre: 1 }, desc: 'Light for camp at night.' },
  { id: 'floor', name: 'Wooden floor ×2', gives: 'floor', qty: 2, cost: { wood: 3 }, desc: 'Walkable plank tiles.' },
  { id: 'wall', name: 'Wooden wall', gives: 'wall', cost: { wood: 3 }, station: 'workbench', desc: 'A solid wall tile.' },
  { id: 'stonewall', name: 'Stone wall', gives: 'stonewall', cost: { stone: 4 }, station: 'workbench', desc: 'A solid stone wall tile.' },
  { id: 'door', name: 'Doorway', gives: 'door', cost: { wood: 4 }, station: 'workbench', desc: 'An opening you can walk through.' },
  { id: 'roof', name: 'Thatch roof ×2', gives: 'roof', qty: 2, cost: { wood: 1, fibre: 2 }, station: 'workbench', desc: 'Goes over floors, walls and doorways.' },
  { id: 'chest', name: 'Storage chest', gives: 'chest', cost: { wood: 6, stone: 2 }, station: 'workbench', desc: 'Store resources at camp.' },
  { id: 'tonic', name: 'Crystal tonic', gives: 'tonic', cost: { fibre: 3, crystal: 1 }, station: 'workbench', desc: 'Refills one tonic (H).' },
];
