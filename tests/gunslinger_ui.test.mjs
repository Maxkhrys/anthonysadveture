import {mkdirSync} from 'node:fs';
export default async function(page,R){
 await page.getByText('Play Story',{exact:true}).click();await page.getByText('New Character',{exact:true}).click();
 const root=page.locator('#character-creator');await root.locator('[data-category="Class"]').click();await root.locator('[data-class="gunslinger"]').click();
 R.ok(await root.locator('.creator-class-label').textContent()==='Gunslinger','real creator selects the fifth class');
 mkdirSync('docs/screens/gunslinger',{recursive:true});await page.screenshot({path:'docs/screens/gunslinger/creator.png'});
 await root.locator('[data-category="Name"]').click();await page.locator('#creator-name').fill('Copper');await root.locator('[data-action="next"]').click();
 await page.waitForFunction(()=>window.__game.inv?.cls==='gunslinger'&&window.__game.player);
 R.ok(await page.evaluate(()=>__game.profile.name==='Copper'&&__game.inv.equip.weapon.kind==='revolver'),'creator starts a saved Gunslinger with a revolver');
 await page.evaluate(()=>{const g=__game;g.cutscene=false;g.ui.talking=false;g.flags.guideDone=true;g.ui.navigate('settings');});
 await page.locator('#tab-settings [data-category=Controls]').click();const select=page.locator('#tab-settings [data-reload-key]');if(await select.count()){await select.selectOption('KeyN');R.ok(await page.evaluate(async()=>{const a=await import('/src/engine/actions.js');return a.KEYMAP.reload[0]==='KeyN';}),'reload binding changes through controls');}
 await page.evaluate(async()=>{await __game.save();});await page.reload();await page.waitForFunction(()=>window.__game&&!document.getElementById('loading'));
 await page.getByText('Play Story',{exact:true}).click();await page.getByText('Copper · gunslinger · Lv 1',{exact:true}).click();await page.waitForFunction(()=>window.__game.profile?.name==='Copper');
 R.ok(await page.evaluate(()=>__game.inv.cls==='gunslinger'),'Gunslinger continues from the real save menu');
}

