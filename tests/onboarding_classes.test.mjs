import {sim,mouseAt} from './lib.mjs';
export default async function(page,R){
 for(const cls of ['archer','witch']){
  await page.evaluate(cls=>window.__start(true,cls),cls);
  await page.evaluate(()=>{const g=window.__game;g.player.x=161;g.player.z=136.5;g.player.facing=Math.PI;g.snapCamera();});await sim(page,2);await mouseAt(page,161,134.5);
  await sim(page,1,['KeyC']);await sim(page,40);
  R.ok(await page.evaluate(()=>!!window.__game.flags.onboarding.done.attack),`${cls} basic projectile registers on straw target`);
  await sim(page,1,['Digit1']);await sim(page,40);
  R.ok(await page.evaluate(()=>!!window.__game.flags.onboarding.done.ability),`${cls} first ability registers during training`);
  R.ok(await page.evaluate(()=>window.__game.entities.filter(e=>e.trainingTarget).length===2&&window.__game.entities.filter(e=>e.trainingTarget).every(e=>e.hp===e.maxHp)),`${cls} practice targets survive combat`);
 }
 await page.evaluate(()=>{const g=window.__game;delete g.flags.onboarding;g.startIntroFight();});
 R.ok(await page.evaluate(()=>{const a=window.__game.entities.find(e=>e.id==='intro');return a.waves.length===3&&a.waves[0].length===3;}),'legacy save retains its original intro battle');
}
