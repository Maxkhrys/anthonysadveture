# Weapon attacks: kits, secondaries and presentation hooks

Weapons change **what** you do; skill trees change **how**; affixes change **what happens**.

Code: `src/rpg/weapon_attacks.js` (data + state machine + executors), `src/rpg/combat_events.js` (event bus).

## Controls

| Action | Mouse / keys | Gamepad |
|---|---|---|
| Primary (weapon's basic attack) | Left click / C | X |
| Secondary (weapon-specific) | **Right click / X** | **RT** |
| Guard / timed parry | Q | LB |

Right click cancels a held ground-target preview (a context action) instead of attacking.

## Kits

Each weapon resolves to an archetype (`ARCHETYPE_OF`, falling back on the weapon's kind). Named weapons patch their kit in `WEAPON_OVERRIDES`.

| Class | Archetype | Weapons | Left click | Right click |
|---|---|---|---|---|
| Samurai | katana | rust katana, tachi, uchigatana, dragonbone… | 3-cut combo | **Draw Cut**: counter stance, then a dashing cut |
| | fastblade | shinai, wakizashi, *hatpin* | 3-cut combo | **Flurry**: 4 rapid cuts (*Needlework*: jabs + piercing lunge) |
| | greatblade | nodachi, oni cleaver, *clapper*, parasol, teaspoon | heavy combo | **Overhead Cleave**: slow, heavy, guard/shield-breaking (*Toll the Clapper*) |
| | elemblade | moonlit (frost), stormedge (lightning), wickblade (fire) | 3-cut combo | **Elemental Slash**: an element crescent |
| Archer | longbow | longbow, elm warbow, *lilypad* | arrow / charge | **Deadeye Shot**: long hold-draw piercing shot (*Lily Splash*) |
| | recurve | recurve, twig, hunting, reedwhistle… | arrow / charge | **Triple Shot**: 3 rapid arrows |
| | crossbow | composite, starfall crossbow | arrow / charge | **Armour-breaker**: heavy bolt, breaks shields, marks |
| | elembow | galestring (wind), sunshot (fire), glasswing, verdant eclipse | arrow / charge | **Elemental Arrow** |
| Witch | firestaff | acorn, candle, *candelabra* | Ember Bolt (burn) | **Charged Fireball** (*Chandler's Blaze* splits in 3) |
| | froststaff | rimefrost rod, sage's rod | Ice Shard (freeze build-up) | **Ice Lance**: pierce, +50% vs chilled, shatters the frozen |
| | stormstaff | owlwood, porcelain conductor, fateweaver | Arc Bolt (arcs once) | **Chain Lightning**: cursor target, line-of-sight hops |
| | arcanestaff | crooked, starfall, *mothlight* | Magic Missile (bounded seek) | **Arcane Orb**: slow piercing orb + burst (*Moth Lantern*) |
| | hexwand | twig, hexbone, umbral tome, apprentice | Curse Bolt (hex) | **Hex Burst**: delayed curse explosion |
| | emberwand | toadstool, orbiting grimoire | Fire Darts (pairs) | **Flame Cone**: 0.55 s channel |
| Soulbound | heavychain | grave-anchor, ferryman, eternal bond… | 4-lash combo | **Anchor Yank**: drag a foe in (large foes: anchored + marked) |
| | longchain | tether, wanderer's, veilthread… | 4-lash combo | **Reaper's Reach**: ~1.9× reach line |
| | spiritchain | shrine cord, lantern links, mothsilk, wispwoven, *lanternchain* | 4-lash combo | **Spectral Follow-up**: lash + spirit echo; spends an Echo for spirits |
| Gunslinger | revolver | trail, copper, marshal, *sundown six*, seventh chime | hold to fire | **Fan the Hammer**: 3 rounds (*Sundown Fan*: the whole cylinder) |
| | rifle | woodstock, brassline, ironbark, kilnrunner, bellfoundry | hold to fire | **Controlled Burst**: 4 accurate rounds, suppresses (slows) |

Existing skill abilities are unchanged and separate.

## The attack state machine (`Player` state `weapon2`)

`windup → [charge] → release → [active] → recover → move`

- Validity, resource and cooldown are checked **before** the windup. A refused attack costs nothing.
- At **release**, the cost is paid, the cooldown starts and the damage spawns in one call. Nothing can cancel in between.
- A dodge cancels a windup or charge for free. After release, only a channel (`cancel.active`) or a recovery past `cancel.recover` can be dodged.
- Presses are edge-triggered, and a running secondary ignores new presses, so buffered input cannot duplicate an attack.
- Charge attacks: a tap still casts, at minimum charge; holding longer grows the attack to full.
- Counter stance (Draw Cut): a frontal hit during the windup is parried. The cut then releases at once as a guaranteed crit.

## Presentation hooks

```js
import { combatEvents } from './rpg/combat_events.js';
combatEvents(game).on('attack.release', ({ attack, weapon, p, charge }) => { /* attack.fx e.g. 'witch.fireball' */ });
```

| Event | Payload |
|---|---|
| `attack.windup` | `{attack, weapon, p}` |
| `attack.release` | `{attack, weapon, p, charge}` |
| `attack.impact` | `{attack, target, x, z, element}` |
| `attack.cancel` | `{attack, reason}` |
| `spell.cast` | `{attack, weapon, p, element}` |
| `spell.impact` | `{attack, target, x, z, element}` |
| `weapon.secondary` | `{attack, weapon, p}` |
| `weapon.reload` | `{weapon, p}` |

Every attack definition carries an `fx` id (`samurai.drawcut`, `witch.icelance`, `gun.fan.sundown`, …) and an `anim` profile (`drawCut`, `overhead`, `bowDraw`, `staffRaise`, `chainThrow`, `fan`, …) for lookup tables.

## Adding or overriding

- **New base weapon:** add its id to an archetype list in `ARCHETYPE_LIST`.
- **Named weapon with its own secondary:** add it to `WEAPON_OVERRIDES`:
  ```js
  mynamed: { secondary: { extends: 'cleave', name: '…', desc: '…', toll: true, fx: 'samurai.cleave.mine' } }
  ```
  `extends` picks the executor; the other keys are flags that executor reads. `primary: {…}` and `element` can be patched the same way.
- **New secondary type:** add an entry to `SECONDARIES` with `windup`, `recover`, `cd`, `cost`, optional `charge` / `active` / `valid` / `counter`, and the `release(p, a)` / `tick(p, dt, a)` functions. Damage must go through `g.playerHit` / `Projectile` / `blast`, and statuses through `applyStatus` (`applyPack`), so shields, reactions, boss rules and item procs all apply. Pass `procCoeff` for rapid hits.
