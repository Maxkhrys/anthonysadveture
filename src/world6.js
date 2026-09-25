// Pass 6 runtime: the living world on top of the authored map.
//  - applies the character's generated manifest (camps, rare elites, caches, cave mouths, the
//    pedlar's stop for the day) to the overworld when it loads
//  - spawns the Pass 6 object types
//  - discovery: map fog, regions and landmarks found, vistas
//  - the events director: stars, Hush tears, moth migrations, the midnight procession, the
//    gilded beetle, and night patrols; NPCs that keep night hours
import * as O6 from './entities/objects6.js';
import * as E6 from './entities/events6.js';
import { NPC, Arena } from './entities/objects.js';
import { Tollcrow } from './entities/bosses6.js';
import { dayRoll } from './world/worldseed.js';
import { POOLS, NIGHT_PRESSURE } from './world/encounters.js';
import { REGIONS, BIOMES, FOG, FOG_W, FOG_H, hx, hz } from './world/layout.js';
import { T } from './world/tiles.js';
import { sfx, playMusic } from './engine/audio.js';
import { GearDrop } from './rpg/combat.js';
import { makeNamed, makeReward } from './rpg/items.js';
import { gainMat } from './rpg/crafting.js';

const OPEN = new Set([T.GRASS, T.FLOWERS, T.FOREST, T.PATH, T.SAND, T.MOSS, T.MUD, T.CLAY, T.STONE, T.ASH]);
const SAFE_PLACES = new Set(['Thimblewick', 'Mirrow Landing', 'Cinder Rest']);

export function installWorld6(Game) {
  const P = Game.prototype;
  // one world day is 420 seconds; a night keeps one index from dusk to dawn
  P.worldDay = function () { return Math.floor((this.time + (this.flags.dayOffset || 0)) / 420 + 0.32); };
  P.worldNight = function () { return Math.floor((this.time + (this.flags.dayOffset || 0)) / 420 + 0.62); };
  P.dayFraction = function () { return (((this.time + (this.flags.dayOffset || 0)) / 420 + 0.32) % 1 + 1) % 1; };

  // ------------------------------------------------ the manifest, applied at load
  P.world6Prepare = function (area) {
    if (area.id !== 'overworld' || !this.world6) return;
    const M = this.world6.generated, defs = area.defs;
    for (const c of M.camps) defs.push({ type: 'camp6', id: c.id, x: c.x, z: c.z, kinds: c.kinds, elite: c.elite, title: ({ brigand: 'Brigand camp!', imp: 'An imp nest!', knight: 'A Hush bivouac!', wraith: 'Wraiths gather…', porcelain: 'A porcelain picket!' })[c.kinds[0]] });
    for (const r of M.rare) defs.push({ type: 'rare6', ...r });
    for (const k of M.pockets) defs.push({ type: 'pocket6', ...k });
    for (const [to, c] of Object.entries(M.caves)) { defs.push({ type: 'cavemouth', to, x: c.x, z: c.z, look: to === 'teapot' ? 'teapot' : 'burrow' }); area.spawns['cave:' + to] = { x: c.x, z: c.z + 1.4 }; }
    const ped = M.merchants[0]; if (ped && ped.stops.length) { const s = ped.stops[(this.worldDay() + ped.offset) % ped.stops.length]; defs.push({ type: 'pedlar6', x: s.x, z: s.z, stop: s.id }); }
    if (this.flags.passOpen) area.defs = area.defs.filter(d => d.type !== 'boulder');
    // Thimblewick keeps night hours too
    for (const d of defs) if (d.type === 'npc') {
      if (d.id === 'ada') d.night = { x: hx(56.5), z: hz(92.4) };
      if (d.id === 'fennel') d.night = { x: hx(55.5), z: hz(69.6) };
      if (d.id === 'brisk') d.nightWander = 4;
    }
  };

  // ------------------------------------------------ Pass 6 object types
  P.spawnDef6 = function (d) {
    switch (d.type) {
      case 'vista': return new O6.Vista(this, d);
      case 'tangle': return new O6.Tangle(this, d);
      case 'clue': return new O6.Clue(this, d);
      case 'moonpath': { const e = new O6.MoonPath(this, d); return e; }
      case 'nightdoor': return new O6.NightDoor(this, d);
      case 'ferry': return new O6.Ferry(this, d);
      case 'camp6': return new O6.Camp(this, d);
      case 'rare6': return new O6.RareSpawn(this, d);
      case 'pocket6': { const e = new O6.Pocket(this, d); return e.dead ? null : e; }
      case 'cavemouth': return new O6.CaveMouth(this, d);
      case 'pedlar6': return new O6.Pedlar(this, d);
      case 'warband': return this.makeWarband(d);
      case 'mdsecret': { const e = new O6.CrackedWall(this, d); return e.dead ? null : e; }
      case 'mdarena': {
        const A = new Arena(this, { id: d.id, room: d.room }, d.waves, { title: d.title, victory: 'The room falls quiet.', eliteChance: 0.08, onClear: () => {
          if (d.goal) { this.flags['md:' + d.goal] = true; this.stats.miniDungeons = Object.keys(this.flags).filter(k => k.startsWith('md:')).length; this.ui.toast('Cleared: ' + this.area.name, 'A mini-dungeon is marked done on your map.', 2.6); }
          this.save();
        } });
        A.alwaysUpdate = true; return A;
      }
      case 'tollcrow': {
        const S = this.world6 && this.world6.events.tollcrow;
        if (S && S.at !== undefined && this.worldDay() - S.day < 3) return null; // it comes back to its bell after a few days
        const e = new Tollcrow(this, d.x, d.z); e.alwaysUpdate = true; this.tollcrow = e; return e;
      }
    }
    return null;
  };
  // the Dustbowl: a warband dug in on open ground. A crowd fight, then a quiet basin.
  P.makeWarband = function (d) {
    const lvl = 10;
    const W = [
      Array.from({ length: 10 }, (_, i) => ['blot', Math.cos(i / 10 * 6.28) * 5, Math.sin(i / 10 * 6.28) * 4]),
      [...Array.from({ length: 8 }, (_, i) => ['blot', Math.cos(i / 8 * 6.28) * 5.5, Math.sin(i / 8 * 6.28) * 4.5]), ['brigand', -2, 0], ['brigand', 2, 0], ['scorpion', 0, -3], ['scorpion', 0, 3]],
      [...Array.from({ length: 8 }, (_, i) => ['blot', Math.cos(i / 8 * 6.28) * 6, Math.sin(i / 8 * 6.28) * 4.5]), ['knight', 0, -2, 'champion'], ['brigand', -3, 2], ['brigand', 3, 2], ['imp', -5, -3], ['imp', 5, -3]],
    ];
    const g = this;
    const A = new Arena(g, { id: d.id, x: d.x, z: d.z, radius: d.radius }, W, { title: 'THE DUSTBOWL', victory: 'The warband scatters into the dunes.', music: 'boss', eliteChance: 0.08, onClear: () => { g.dropGear(d.x, d.z, { level: lvl + 1, floor: 3, bonus: 1.2 }); g.dropGear(d.x + 1, d.z, { level: lvl, floor: 2, bonus: 0.6 }); g.stats.warbands = (g.stats.warbands || 0) + 1; } });
    A.alwaysUpdate = true;
    return A;
  };

  // ------------------------------------------------ the Tollcrow (world boss, Chime Highlands)
  P.startTollcrow = function (b) {
    const L = this.area.landmarks.find(l => l.id === 'greatbell'); if (L) this.discoverLandmark(L, true);
    this.bossIntro(b, 'WHAT NESTS IN THE GREAT BELL', { x: b.home.x, z: b.home.z + 1.5, y: 1.2 }, () => {});
    b.wake();
  };
  P.onTollcrowDead = function (b) {
    const E = this.world6.events, S = E.tollcrow || (E.tollcrow = { kills: 0 });
    const first = !S.kills;
    S.kills++; S.day = this.worldDay(); S.at = this.time; this.bossActive = null; this.tollcrow = null;
    this.musicOverride(null); playMusic(null);
    setTimeout(() => {
      this.cutscene = false; this.camFocus = null; this.camZoom = 1;
      this.ui.banner('VICTORY', 'The Great Bell is quiet again', 2.5); sfx('fanfare');
      this.gainXp(first ? 1400 : 700);
      gainMat(this, 'crowfeather', first ? 2 : 1, b.x, b.z);
      // the unique drops once; the bell's crow comes back every few days, the mantle doesn't
      if (first) this.spawn(new GearDrop(this, b.x, b.z + 1.5, makeReward('crowmantle', this.inv.cls, Math.max(14, this.inv.level))));
      this.dropGear(b.x - 1, b.z + 1, { level: 15, floor: 3, bonus: 1.5 }); this.dropGear(b.x + 1, b.z + 1, { level: 14, floor: 2, bonus: 0.8 });
      this.flags.tollcrowKills = S.kills;
      this.save();
    }, 1200);
  };

  // ------------------------------------------------ discovery
  P.fogBits = function () {
    const D = this.world6.discovery;
    if (!this._fog || this._fogSrc !== D) {
      this._fogSrc = D; this._fog = new Uint8Array(FOG_W * FOG_H);
      for (let k = 0; k < this._fog.length; k++) { const nib = parseInt(D.fog[k >> 2] || '0', 16); this._fog[k] = (nib >> (k & 3)) & 1; }
    }
    return this._fog;
  };
  P.writeFog = function () {
    const F = this.fogBits(); let s = '';
    for (let k = 0; k < F.length; k += 4) s += ((F[k] | (F[k + 1] << 1) | (F[k + 2] << 2) | (F[k + 3] << 3)) & 15).toString(16);
    this.world6.discovery.fog = s.padEnd(Math.ceil(FOG_W * FOG_H / 4), '0');
  };
  P.revealAround = function (x, z, r, landmarks) {
    if (!this.world6 || !this.area || this.area.id !== 'overworld') return;
    const F = this.fogBits(); let ch = false;
    for (let cz = Math.max(0, Math.floor((z - r) / FOG)); cz <= Math.min(FOG_H - 1, Math.floor((z + r) / FOG)); cz++) for (let cx = Math.max(0, Math.floor((x - r) / FOG)); cx <= Math.min(FOG_W - 1, Math.floor((x + r) / FOG)); cx++) {
      const k = cz * FOG_W + cx; if (F[k]) continue;
      if (Math.hypot((cx + 0.5) * FOG - x, (cz + 0.5) * FOG - z) > r + FOG * 0.7) continue;
      F[k] = 1; ch = true;
    }
    if (ch) this.writeFog();
    if (landmarks) for (const L of this.area.landmarks) if (!L.hidden && Math.hypot(L.x - x, L.z - z) < r) this.discoverLandmark(L, true);
  };
  P.discoverLandmark = function (L, quiet) {
    const D = this.world6.discovery;
    if (D.landmarks.includes(L.id)) return false;
    D.landmarks.push(L.id);
    if (!quiet) this.ui.toast('Found: ' + L.name, '', 1.8);
    return true;
  };
  P.markLandmarks = function (ids) {
    if (!this.world6) return;
    const D = this.world6.discovery;
    for (const id of ids) if (!D.marked.includes(id) && !D.landmarks.includes(id)) D.marked.push(id);
  };
  P.revealRegion = function (id) {
    if (!this.world6 || !this.area || this.area.id !== 'overworld') return;
    const a = this.area, F = this.fogBits(), bi = BIOMES.indexOf(id === 'whisperwood' ? 'whisperwood' : id);
    for (let cz = 0; cz < FOG_H; cz++) for (let cx = 0; cx < FOG_W; cx++) {
      const x = Math.min(a.w - 1, cx * FOG + 4), z = Math.min(a.h - 1, cz * FOG + 4);
      if (a.biome[z * a.w + x] === bi) F[cz * FOG_W + cx] = 1;
    }
    this.writeFog();
    for (const L of a.landmarks) if (L.region === id && !L.hidden) this.markLandmarks([L.id]);
  };
  P.world6Fast = function (dt) {
    if (!this.world6 || !this.area || this.area.id !== 'overworld' || !this.player) { this.vistaK = 1; return; }
    // vistas pull the camera back while you stand on them
    this.vistaT = (this.vistaT || 0) - dt;
    const want = this.vistaT > 0 ? this.vistaWant : 1;
    this.vistaK = (this.vistaK || 1) + (want - (this.vistaK || 1)) * Math.min(1, dt * 1.6);
    // accessories that mend you out in the world
    const U = this.pstats.uniques, inv = this.inv;
    if (inv.hp < inv.maxHp && ((U.has('moonwellcenser') && this.isNight) || (U.has('tidebell') && this.tileAt(Math.floor(this.player.x), Math.floor(this.player.z)) === T.SHALLOW))) { inv.hp = Math.min(inv.maxHp, inv.hp + inv.maxHp * 0.012 * dt); this.hudDirty = true; }
    this.discT = (this.discT || 0) - dt;
    if (this.discT > 0) return;
    this.discT = 0.5;
    const p = this.player;
    this.revealAround(p.x, p.z, 13, false);
    const D = this.world6.discovery;
    const reg = this.area.placeAt(p.x, p.z).id;
    if (!D.regions.includes(reg)) {
      D.regions.push(reg);
      if (D.regions.length > 1) { sfx('secret'); this.ui.toast('Region discovered', REGIONS[reg].name, 2.6); }
      this.stats.regions = D.regions.length;
    }
    for (const L of this.area.landmarks) if (!L.hidden && Math.abs(L.x - p.x) < 16 && Math.abs(L.z - p.z) < 14) this.discoverLandmark(L, false);
    else if (L.hidden && Math.abs(L.x - p.x) < 5 && Math.abs(L.z - p.z) < 5) this.discoverLandmark(L, false);
    // NPCs who keep night hours
    const night = !!this.isNight;
    if (this._lastNight !== night) { this._lastNight = night; this.applyMusic(); }
    for (const e of this.entities) if (e instanceof NPC && e.sdef) {
      const d = e.sdef;
      if (d.nightOnly) { e.obj.visible = night; e.interactable = night; e.solid = night; continue; }
      const tgt = night && d.night ? d.night : { x: d.x, z: d.z };
      if (d.night && (e.home.x !== tgt.x || e.home.z !== tgt.z) && (Math.hypot(p.x - e.x, p.z - e.z) > 14 || !this.onScreen(e.x, e.z, 1))) { e.home = { ...tgt }; e.x = tgt.x; e.z = tgt.z; e.sync(); }
      if (d.nightWander) e.wanderR = night ? d.nightWander : (d.wander || 0);
    }
  };

  // ------------------------------------------------ events and night
  P.world6Tick = function () {
    if (!this.world6 || this.area.id !== 'overworld') return;
    const E = this.world6.events, M = this.world6.generated, seed = this.world6.seed;
    const day = this.worldDay(), night = this.worldNight(), frac = this.dayFraction(), p = this.player;
    const has = key => this.entities.some(e => e.key === key && !e.dead);
    // forget events older than a few days (the save stays small)
    for (const k of Object.keys(E)) { const m = /:(\d+)$/.exec(k); if (m && +m[1] < day - 4 && /^(star|tear|moths|proc|gilded):/.test(k)) delete E[k]; }
    // a star falls on some nights; its crater stays through the next day
    for (const n of [night, night - 1]) {
      const key = 'star:' + n;
      if (n === night && this.isNight && E[key] === undefined) E[key] = dayRoll(seed, n, 'star') < 0.5 ? { state: 'fallen', i: Math.floor(dayRoll(seed, n, 'star-i') * M.events.stars.length) } : { state: 'none' };
      const S = E[key];
      if (S && S.state !== 'none' && !has(key)) {
        const a = M.events.stars[S.i % M.events.stars.length];
        const st = new E6.FallenStar(this, { x: a.x, z: a.z, key }); this.spawn(st);
        if (n === night && !S.seen && this.isNight) { S.seen = true; this.ui.toast('A star falls!', 'It came down somewhere toward ' + REGIONS[this.area.placeAt(a.x, a.z).id].name + '.', 3); for (let i = 0; i < 30; i++) this.fx.add({ x: p.x + 8 - i * 0.5, y: 9 - i * 0.25, z: p.z - 10, vx: -2, vy: -1, g: 0, color: i % 3 ? 0xc8e8ff : 0xffffff, life: 0.6 + i * 0.02, size: 0.08 }); }
      }
    }
    // the Hush tears through by a road on some days
    { const key = 'tear:' + day;
      if (!this.isNight && E[key] === undefined) E[key] = dayRoll(seed, day, 'tear') < 0.4 ? { state: 'open', i: Math.floor(dayRoll(seed, day, 'tear-i') * M.events.incursions.length) } : { state: 'none' };
      const S = E[key];
      if (S && S.state !== 'none' && !has(key)) { const a = M.events.incursions[S.i % M.events.incursions.length]; this.spawn(new E6.RiftTear(this, { x: a.x, z: a.z, key })); } }
    // moths migrate at dusk
    { const key = 'moths:' + day;
      if (frac > 0.6 && frac < 0.7 && E[key] === undefined) E[key] = dayRoll(seed, day, 'moths') < 0.6 ? { dust: 5 } : { dust: 0, none: true };
      const S = E[key];
      if (S && !S.none && !has(key)) { const a = M.events.moths; this.spawn(new E6.MothDrift(this, { x: a.x, z: a.z, key })); } }
    // the midnight procession in Moonfen
    { const key = 'proc:' + night;
      if (this.isNight && E[key] === undefined) E[key] = dayRoll(seed, night, 'proc') < 0.55 ? { state: 'walking' } : { state: 'none' };
      const S = E[key];
      if (this.isNight && S && S.state === 'walking' && !has(key)) this.spawn(new E6.Procession(this, { pts: M.events.procession.pts, key })); }
    // now and then, a Gilded Beetle
    { const key = 'gilded:' + day;
      if (E[key] === undefined) E[key] = dayRoll(seed, day, 'gilded') < 0.5 ? { state: 'waiting', at: 60 + dayRoll(seed, day, 'gilded-t') * 200 } : { state: 'none' };
      const S = E[key];
      if (S.state === 'waiting' && this.inv.level >= 3 && (this.time % 420) > S.at && !this.entities.some(e => e.kind === 'gilded' && !e.dead)) {
        for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, x = p.x + Math.cos(a) * 10, z = p.z + Math.sin(a) * 10; if (OPEN.has(this.tileAt(Math.floor(x), Math.floor(z))) && Math.abs(this.tileGround(Math.floor(x), Math.floor(z)) - (p.gy || 0)) < 0.3) { this.spawnEnemy('gilded', x, z, { noRoom: true, eliteChance: 0 }); S.state = 'seen'; this.ui.toast('A Gilded Beetle!', 'It sheds pips when struck — catch it before it burrows!', 2.6); sfx('secret'); break; } }
      } }
    // Quill's bounty: Old Snapjaw waits in Heron Isle's reeds once the bounty is posted
    if (this.flags.q_snapjaw === 1 && !this.flags.snapjawDead && Math.hypot(p.x - 164, p.z - 213) < 14 && !this.entities.some(e => e.snapjaw && !e.dead)) {
      const e = this.spawnEnemy('leech', 164.5, 212.5, { noRoom: true, eliteChance: 0 });
      if (e) { this.makeElite(e); e.hp *= 2.5; e.maxHp = e.hp; e.snapjaw = true; e.displayName = 'Old Snapjaw'; e.obj.scale.setScalar(1.8); e.eliteScale = 1.8; const od = e.die.bind(e); e.die = (h, how) => { this.flags.snapjawDead = true; od(h, how); this.save(); }; this.ui.toast('Old Snapjaw!', 'Something the size of a rowboat rises from the reeds.', 2.6); }
    }
    // night patrols: some places wake up after dark (Moonfen most of all)
    const place = this.area.placeAt(p.x, p.z);
    this.patrolT = (this.patrolT || 0) - 2;
    if (this.isNight && this.patrolT <= 0 && !SAFE_PLACES.has(place.name) && !this.bossActive) {
      this.patrolT = 8;
      const pressure = NIGHT_PRESSURE[place.id] ?? 0.3, cap = Math.round(pressure * 4);
      const n = this.entities.filter(e => e.patrol && !e.dead).length;
      if (n < cap && Math.random() < 0.3 + pressure * 0.5) {
        const pool = POOLS[place.id].night;
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * 6.28, x = p.x + Math.cos(a) * 13, z = p.z + Math.sin(a) * 10;
          if (!OPEN.has(this.tileAt(Math.floor(x), Math.floor(z))) || this.onScreen(x, z, -1)) continue;
          if (Math.abs(this.tileGround(Math.floor(x), Math.floor(z)) - (p.gy || 0)) > 0.3) continue;
          const e = this.spawnEnemy(pool[Math.floor(Math.random() * pool.length)], x, z, { noRoom: true, eliteChance: place.id === 'moonfen' ? 0.15 : 0.06 });
          if (e) e.patrol = true;
          break;
        }
      }
    }
    // morning: night patrols melt back into the dark places they came from
    if (!this.isNight) for (const e of this.entities) if (e.patrol && !e.dead && !this.onScreen(e.x, e.z, 2)) e.remove();
  };
}
