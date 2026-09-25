// DEVELOPMENT AND TESTING ONLY. Pass 6 world commands, plugged into the existing developer
// console (src/dev/commands.js) the same way Pass 5's are: added to its definition and handler
// tables, never replacing Gemini's. /teleport (alias /tp) is extended, not overwritten: places
// it doesn't know about still go to Gemini's handler.
//
// ISOLATION: commands that hand out rewards (/event, /worldboss) refuse to run unless the dev
// sandbox is on (/sandbox on, from pass5.js) — nothing is saved while it is — or "keep" is given.
import { COMMAND_DEFINITIONS, DevCommands } from './commands.js';
import { REGIONS, REGION_IDS, HEART, WORLD_W, WORLD_H } from '../world/layout.js';
import { ANCHORS } from '../world/anchors.js';
import { POOLS } from '../world/encounters.js';
import { GENERATION_VERSION } from '../world/worldseed.js';
import * as E6 from '../entities/events6.js';
import { buildOverworld } from '../world/overworld.js';

const guard = (game, args, log) => {
  if (game.devSandbox || args.includes('keep')) return true;
  log('Refused: this hands out rewards. Run /sandbox on first (nothing is saved while it is on), or add "keep" to write to your profile on purpose.', 'yellow');
  return false;
};
// a representative, walkable spot for each region (a Bellstone or a door)
export const REGION_SPAWN = { heartland: 'village', whisperwood: 'dungeon', deepwood: 'deepwood', glassmere: 'mirrorcellar', lake: 'heronisle', sunscald: 'wells', cinderpeak: 'cinderrest', moonfen: 'moonfen', highlands: 'belfry' };
let _area = null;
const worldArea = game => (game.area && game.area.id === 'overworld') ? game.area : (_area || (_area = buildOverworld()));
function goTo(game, spawn) {
  if (game.area && game.area.id === 'overworld') {
    const s = typeof spawn === 'string' ? game.area.spawns[spawn] : spawn;
    const p = game.player; p.x = s.x; p.z = s.z; p.lastSafe = { x: s.x, z: s.z }; p.setState && p.setState('move'); game.snapCamera(); game.updateRegion(true);
  } else game.warpTo('overworld', spawn);
}

const DEFS = {
  worldseed: { name: 'worldseed', category: 'WORLD', desc: 'Show this character\'s world seed, generator version and what the seed picked.', usage: '/worldseed' },
  regions: { name: 'regions', category: 'WORLD', desc: 'List the eight regions: level, music, discovered or not.', usage: '/regions' },
  landmarks: { name: 'landmarks', category: 'WORLD', desc: 'List authored landmarks (discovered ones marked).', usage: '/landmarks [region]' },
  discover: { name: 'discover', category: 'WORLD', desc: 'Discover a region (fog, name, landmarks) or everything.', usage: '/discover <region|all>' },
  event: { name: 'event', category: 'WORLD', desc: 'Start a world event right here: star, tear, moths, procession, gilded.', usage: '/event <star|tear|moths|procession|gilded> [keep]' },
  worldboss: { name: 'worldboss', category: 'COMBAT', desc: 'Go to a world boss and reset its return timer: tollcrow or toad.', usage: '/worldboss <tollcrow|toad> [keep]' },
  worldviz: { name: 'worldviz', category: 'VISUAL', desc: 'Toggle the developer world overlay: region borders, landmarks, seeded anchors, Bellstones (map and world).', usage: '/worldviz' },
};

const HANDLERS = {
  worldseed(game, args, log) {
    const W = game.world6; if (!W) return log('No character loaded.', 'yellow');
    const M = W.generated;
    log(`Seed ${W.seed} · generation v${W.generationVersion} (current generator v${GENERATION_VERSION})`, 'gold');
    log(`Camps: ${M.camps.map(c => c.id + '[' + c.kinds.join('/') + (c.elite ? ' ★' : '') + ']').join(', ')}`);
    log(`Rare: ${M.rare.map(r => r.name + (r.night ? ' (night)' : '') + ' @' + r.id).join(', ')}`);
    log(`Pedlar stops: ${M.merchants[0].stops.map(s => s.id).join(' → ')} · today: ${M.merchants[0].stops[(game.worldDay() + M.merchants[0].offset) % M.merchants[0].stops.length].id}`);
    log(`Caves: ${Object.entries(M.caves).map(([k, c]) => k + '@' + c.id).join(', ')} · Caches: ${M.pockets.map(k => k.id + '(' + k.mat + ')').join(', ')}`);
    log(`Events: stars ${M.events.stars.map(s => s.id).join(', ')} · tears ${M.events.incursions.map(s => s.id).join(', ')} · moths ${M.events.moths.id} · procession ${M.events.procession.id}`);
  },
  regions(game, args, log) {
    const D = game.world6 && game.world6.discovery;
    for (const id of REGION_IDS) { const R = REGIONS[id], on = D && D.regions.includes(id); log(`${on ? '●' : '○'} ${id.padEnd(12)} ${R.name.padEnd(24)} lvl ${R.level}  music:${R.music}  night pool: ${POOLS[id].night.join('/')}`, on ? 'green' : 'dim'); }
    log('Teleport with /tp <region>.', 'dim');
  },
  landmarks(game, args, log) {
    const a = worldArea(game), D = game.world6 && game.world6.discovery;
    for (const L of a.landmarks) if (!args[0] || L.region === args[0]) log(`${D && D.landmarks.includes(L.id) ? '●' : '○'} ${L.id.padEnd(12)} ${L.name}  (${L.region}) @ ${L.x.toFixed(0)},${L.z.toFixed(0)}${L.hidden ? '  [secret]' : ''}`, D && D.landmarks.includes(L.id) ? 'green' : 'dim');
  },
  discover(game, args, log) {
    const W = game.world6; if (!W) return;
    const ids = args[0] === 'all' ? REGION_IDS : [args[0]];
    if (!ids.every(i => REGION_IDS.includes(i))) return log('Usage: /discover <' + REGION_IDS.join('|') + '|all>', 'yellow');
    for (const id of ids) { if (!W.discovery.regions.includes(id)) W.discovery.regions.push(id); if (game.area && game.area.id === 'overworld') game.revealRegion(id); }
    if (args[0] === 'all' && game.area && game.area.id === 'overworld') for (const L of game.area.landmarks) game.discoverLandmark(L, true);
    log('Discovered: ' + ids.join(', '), 'green');
  },
  event(game, args, log) {
    if (!guard(game, args, log)) return;
    if (!game.area || game.area.id !== 'overworld') return log('Events happen in the overworld.', 'yellow');
    const p = game.player, x = p.x + 5, z = p.z + 2, key = 'dev:' + Date.now();
    switch (args[0]) {
      case 'star': game.spawn(new E6.FallenStar(game, { x, z, key })); break;
      case 'tear': game.spawn(new E6.RiftTear(game, { x, z, key })); break;
      case 'moths': game.spawn(new E6.MothDrift(game, { x, z, key })); break;
      case 'procession': game.spawn(new E6.Procession(game, { key, pts: [[Math.floor(p.x) + 2, Math.floor(p.z)], [Math.floor(p.x) + 8, Math.floor(p.z) + 2], [Math.floor(p.x) + 12, Math.floor(p.z) + 6]] })); break;
      case 'gilded': game.spawnEnemy('gilded', x, z, { noRoom: true, eliteChance: 0 }); break;
      default: return log('Usage: /event <star|tear|moths|procession|gilded> [keep]', 'yellow');
    }
    log('Event started: ' + args[0], 'green');
  },
  worldboss(game, args, log) {
    if (!guard(game, args, log)) return;
    const W = game.world6;
    if (args[0] === 'tollcrow') { if (W.events.tollcrow) W.events.tollcrow.day = -99; goTo(game, { x: 118.5, z: 44 }); if (game.area.id === 'overworld') game.warpTo('overworld', { x: 118.5, z: 44 }); }
    else if (args[0] === 'toad') { delete game.flags.toadAt; game.warpTo('overworld', 'fen'); }
    else return log('Usage: /worldboss <tollcrow|toad> [keep]', 'yellow');
    log('Off to the ' + args[0] + '. (Its return timer was reset.)', 'green');
  },
  worldviz(game, args, log) {
    game.devMapOverlay = !game.devMapOverlay;
    if (game.devViz) { for (const m of game.devViz) m.parent && m.parent.remove(m); game.devViz = null; }
    if (game.devMapOverlay && game.area && game.area.id === 'overworld') game.devViz = buildViz(game);
    log('World overlay ' + (game.devMapOverlay ? 'ON (map shows borders and anchors; pillars in the world)' : 'OFF'), 'green');
  },
};

// coloured pillars over every authored landmark and seeded anchor (developer eyes only)
import * as THREE from 'three';
function buildViz(game) {
  const out = [], M = game.world6.generated;
  const pillar = (x, z, c, h = 4) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, 0.2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6, depthWrite: false })); m.position.set(x, h / 2 + game.groundAt(x, z), z); game.scene.add(m); out.push(m); };
  for (const L of game.area.landmarks) pillar(L.x, L.z, 0xffff60, 6);
  for (const c of M.camps) pillar(c.x, c.z, 0xff3030);
  for (const r of M.rare) pillar(r.x, r.z, 0xff9a2a);
  for (const k of M.pockets) pillar(k.x, k.z, 0x40ff60, 2);
  for (const s of M.merchants[0].stops) pillar(s.x, s.z, 0x40e0ff);
  for (const s of M.events.stars) pillar(s.x, s.z, 0xffffff, 3);
  for (const s of M.events.incursions) pillar(s.x, s.z, 0x9a5cff, 3);
  for (const c of Object.values(M.caves)) pillar(c.x, c.z, 0x8a5a2a, 5);
  for (const d of game.area.defs) if (d.type === 'bellstone') pillar(d.x, d.z, 0x00ffff, 7);
  return out;
}
// what the overlay draws on the big map (called by ui.drawBigMap)
export function drawDevOverlay(game, x, sc) {
  const a = game.area, M = game.world6.generated;
  x.save();
  // region borders: wherever the place's region changes
  x.fillStyle = '#ff00ff90';
  for (let z = 0; z < a.h; z += 2) for (let xx = 0; xx < a.w; xx += 2) { const r = a.places[a.regionIdx[z * a.w + xx]].id, r2 = a.places[a.regionIdx[z * a.w + Math.min(a.w - 1, xx + 2)]].id, r3 = a.places[a.regionIdx[Math.min(a.h - 1, z + 2) * a.w + xx]].id; if (r !== r2 || r !== r3) x.fillRect(xx * sc, z * sc, sc * 2, sc * 2); }
  const dot = (px, pz, c, s = 4) => { x.fillStyle = c; x.fillRect(px * sc - s / 2, pz * sc - s / 2, s, s); };
  for (const L of a.landmarks) dot(L.x, L.z, '#ffff60', 5);
  for (const c of M.camps) dot(c.x, c.z, '#ff3030');
  for (const r of M.rare) dot(r.x, r.z, '#ff9a2a');
  for (const k of M.pockets) dot(k.x, k.z, '#40ff60', 3);
  for (const s of M.merchants[0].stops) dot(s.x, s.z, '#40e0ff');
  for (const s of M.events.stars) dot(s.x, s.z, '#ffffff', 3);
  for (const s of M.events.incursions) dot(s.x, s.z, '#9a5cff', 3);
  for (const c of Object.values(M.caves)) dot(c.x, c.z, '#8a5a2a', 5);
  for (const d of a.defs) if (d.type === 'bellstone') dot(d.x, d.z, '#00ffff', 5);
  x.restore();
}

Object.assign(COMMAND_DEFINITIONS, DEFS);
Object.assign(DevCommands.handlers, HANDLERS);

// /teleport (and its alias /tp) also understands regions, landmarks and Pass 6 spawns
const geminiTeleport = DevCommands.handlers.teleport;
DevCommands.handlers.teleport = (game, args, log) => {
  const k = (args[0] || '').toLowerCase();
  const a = worldArea(game);
  if (REGION_IDS.includes(k)) { goTo(game, REGION_SPAWN[k]); return log('Teleporting to ' + REGIONS[k].name, 'green'); }
  const L = a.landmarks.find(l => l.id === k);
  if (L) { const s = a.spawns[k] || { x: L.x, z: L.z + Math.max(2.5, 0.6) }; goTo(game, s); return log('Teleporting to ' + L.name, 'green'); }
  if (a.spawns[k] && !['village', 'dungeon', 'grotto', 'conservatory', 'fen', 'start'].includes(k)) { goTo(game, k); return log('Teleporting to ' + k, 'green'); }
  return geminiTeleport(game, args, log);
};
if (COMMAND_DEFINITIONS.teleport) COMMAND_DEFINITIONS.teleport.usage += ' · Pass 6: /tp <region|landmark>';
