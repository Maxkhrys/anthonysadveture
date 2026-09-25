// Eligibility applies to newly generated rewards only; never to existing saved equipment.
export const CLASS_CAPABILITIES = {
 samurai:['melee','charge','heavy','echo'], archer:['projectile','charge','trap','echo'],
 witch:['projectile','charge','spell','summon','echo'], soulbound:['melee','charge','heavy','summon','echo'],
 gunslinger:['projectile','firearm','heavy','trap','turret','summon','echo'],
};
export const ITEM_CLASSES = {
 kabuto:['samurai'],gi:['samurai'],oyoroi:['samurai'],hakama:['samurai'],
 witchbrim:['witch'],robe:['witch'],rangercowl:['archer'],leafhood:['archer'],
 stillwater:['samurai','archer','witch','soulbound'],briarbond:['archer'],
};
export function eligible(base, cls, unique=null) {
 if(!CLASS_CAPABILITIES[cls]) throw new Error('Reward recipient class is required');
 if(!base) return false;
 const allowed=ITEM_CLASSES[unique?.id]||ITEM_CLASSES[base.id]||base.classes||(base.cls?[base.cls]:null);
 return !allowed||allowed.includes(cls);
}
export function modifierEligible(id,cls) {
 if(!cls)return true;const tags=CLASS_CAPABILITIES[cls]||[];
 const need={spellDamage:'spell',castSpeed:'spell',projectileSpeed:'projectile',projectileCount:'projectile',pierce:'projectile',bounce:'projectile',summonDamage:'summon',summonDuration:'summon',trapDamage:'trap',turretDamage:'turret',reach:'melee',projSize:'projectile'}[id];
 return !need||tags.includes(need);
}
