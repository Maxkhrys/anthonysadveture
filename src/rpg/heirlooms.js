// Reference-inspired named progression. Prismatic is a signature variant of legendary
// gear; numeric rarity and the existing eight-tier affix system remain save-compatible.
export const HEIRLOOMS = [
 ['wanderblade',"Wanderer's Blade",'samurai','katana',1,0,0xdde1df,{atkSpd:10},'A well-kept blade that has seen many roads.'],
 ['azureedge','Azure Edge','samurai','katana',4,2,0x55bfff,{crit:15},'Forged from distant steel; it hums with calm purpose.'],
 ['voidcutter','Voidcutter','samurai','katana',8,3,0xb765ef,{critDmg:30},'A blade that drinks the shadows between strikes.'],
 ['dawnbringer','Dawnbringer','samurai','katana',12,4,0xffad3b,{},'Basic hits release a wave of light (3s cooldown).'],
 ['heavensdivide',"Heaven’s Divide",'samurai','katana',16,4,0x83dfff,{},'Basic hits summon six spectral cuts (4s cooldown).',true],
 ['hickorybow','Hickory Bow','archer','bow',1,0,0xa57844,{projSpeed:10},'Reliable, simple, and true.'],
 ['moonfeather','Moonfeather Bow','archer','bow',4,2,0x55bfff,{crit:15},'Fletched with silvered dreams.'],
 ['thornwood','Thornwood Bow','archer','bow',8,3,0x72bc44,{},'Basic shots loose two extra arrows at 45% damage each.'],
 ['starfallcrossbow','Starfall Crossbow','archer','bow',12,4,0xebc45d,{},'Arrows pierce. Hits have a 20% chance to call a star (1s cooldown).'],
 ['verdanteclipse','Verdant Eclipse','archer','bow',16,4,0x50efbc,{},'Critical hits release three seeking vines (4s cooldown).',true],
 ['apprenticewand','Apprentice Wand','witch','wand',1,0,0xa77d44,{resRegen:10},'A modest start for curious minds.'],
 ['sagesrod',"Sage’s Rod",'witch','staff',4,2,0x55bfff,{abilityDmg:15},'Carved by those who listened closely.'],
 ['umbraltome','Umbral Tome','witch','wand',8,3,0xb765ef,{cdr:20},'Words that whisper back.'],
 ['orbitinggrimoire','Orbiting Grimoire','witch','wand',12,4,0xebc45d,{},'Two orbiting tomes fire at nearby foes every 1.5s.'],
 ['wayfarerlinks',"Wayfarer's Links",'soulbound','chain',1,0,0xa8a298,{atkSpd:10},'Plain iron links, blessed at a roadside shrine.'],
 ['tidewhisper','Tidewhisper Chain','soulbound','chain',4,2,0x55bfff,{crit:15},'Every link remembers a river crossing.'],
 ['duskcoil','Duskcoil','soulbound','chain',8,3,0xb765ef,{critDmg:30},'It hangs heavier at nightfall, and lighter at dawn.'],
 ['lanternchain',"Lanternbearer's Chain",'soulbound','chain',12,4,0xffc860,{},'Combo finishers free a lantern spirit that seeks a foe (3s cooldown).'],
 ['threshold','The Threshold','soulbound','chain',16,4,0xc8b0ff,{},'Veilshift leaves a door in the Veil: a moment later you step out of it again with a second cut.',true],
 ['fateweaver',"Fateweaver’s Staff",'witch','staff',16,4,0x83dfff,{},'Damaging spells have a 20% chance to echo for 50% damage.',true],
].map(([id,name,cls,kind,lvl,r,col,fixed,text,prismatic=false])=>({id,name,cls,kind,lvl,r,col,fixed,text,prismatic,dmg:r>=4?1.15:1,spd:1,orb:col,reach:kind==='chain'?2.6:1.3,weight:0,src:prismatic?'Very rare legendary variant · level 16+':'World treasure and enemy drops',collection:true}));
export const HEIRLOOM_BY_ID = Object.fromEntries(HEIRLOOMS.map(x=>[x.id,x]));
