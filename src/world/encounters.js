// Pass 6 encounter ecology: which creatures live where, by day and by night. Pure data, used
// by the world builder's authored packs, the seeded camps and rare spawns, night patrols and
// the dev registry. Not every creature lives everywhere.

export const POOLS = {
  heartland: { day: ['blot', 'beetle', 'puffer', 'brigand'], night: ['blot', 'wisp', 'wraith'], camp: ['brigand', 'brigand', 'blot'], rare: ['brigand', 'beetle', 'knight'] },
  whisperwood: { day: ['blot', 'sporeling', 'puffer', 'wisp', 'beetle'], night: ['wisp', 'moth', 'wraith'], camp: ['sporeling', 'blot', 'beetle'], rare: ['treant', 'beetle'] },
  deepwood: { day: ['beetle', 'moth', 'treant', 'sporeling', 'mantis'], night: ['moth', 'wisp', 'wraith', 'mantis'], camp: ['beetle', 'mantis', 'sporeling'], rare: ['treant', 'mantis', 'beetle'] },
  glassmere: { day: ['mantis', 'moth', 'porcelain'], night: ['moth', 'wisp', 'leech'], camp: ['porcelain', 'mantis', 'moth'], rare: ['porcelain', 'mantis'] },
  lake: { day: ['leech', 'slug', 'moth', 'brigand'], night: ['wraith', 'leech', 'moth'], camp: ['brigand', 'brigand', 'slug'], rare: ['leech', 'slug'] },
  sunscald: { day: ['scorpion', 'brigand', 'imp', 'golem', 'porcelain'], night: ['scorpion', 'wraith', 'moth'], camp: ['brigand', 'scorpion', 'brigand'], rare: ['golem', 'scorpion', 'brigand'] },
  cinderpeak: { day: ['imp', 'golem', 'slug', 'knight', 'scorpion'], night: ['imp', 'wraith', 'slug'], camp: ['imp', 'imp', 'golem'], rare: ['golem', 'knight', 'imp'] },
  moonfen: { day: ['wisp', 'leech', 'slug', 'sporeling'], night: ['wraith', 'wisp', 'leech', 'moth'], camp: ['wraith', 'leech', 'wisp'], rare: ['wraith', 'leech'] },
  highlands: { day: ['golem', 'knight', 'leech', 'porcelain', 'wraith'], night: ['wisp', 'wraith', 'knight'], camp: ['knight', 'porcelain', 'golem'], rare: ['knight', 'golem', 'porcelain'] },
};

// Night makes some places more dangerous than others: how many extra night patrols a region
// fields near the player (Moonfen is the one that truly wakes up).
export const NIGHT_PRESSURE = { heartland: 0.2, whisperwood: 0.4, deepwood: 0.6, glassmere: 0.4, lake: 0.5, sunscald: 0.4, cinderpeak: 0.3, moonfen: 1, highlands: 0.5 };

// Crafting materials each region is known for (hidden caches, events, elites).
export const REGION_MATS = {
  heartland: ['shard'], whisperwood: ['thornheart', 'shard'], deepwood: ['thornheart', 'mantis'], glassmere: ['moth', 'porcelain'],
  lake: ['wax', 'echo'], sunscald: ['porcelain', 'ember'], cinderpeak: ['ember', 'filament'], moonfen: ['moth', 'echo', 'wax'], highlands: ['echo', 'filament'],
};

// Names for the seeded rare elites: every world has its own local legends.
export const RARE_FIRST = ['Old', 'Grey', 'Mossback', 'One-Eyed', 'Crooked', 'Ashen', 'Pale', 'Gnarl', 'Rusty', 'Hollow', 'Quiet', 'Nettle'];
export const RARE_LAST = { blot: 'Blot', brigand: 'Rourke', beetle: 'Greyback', knight: 'Vesper', treant: 'Oakmother', mantis: 'Scythe', porcelain: 'Glaze', leech: 'Snapjaw', slug: 'Tallowgut', golem: 'Cairn', scorpion: 'Stinger', imp: 'Cinder', wraith: 'Weeper', wisp: 'Willow', moth: 'Duskwing', sporeling: 'Puffball' };
