import {readFile} from 'node:fs/promises';
import {fresh,sim,talkThrough} from './lib.mjs';
export default async function(page,R){
 await fresh(page,'witch',{level:16,stage:1});
 R.ok(await page.evaluate(()=>window.__game.story.objective().includes('Hobb')),'opening objective offers short Hobb route');
 const relic=await page.evaluate(()=>{const g=window.__game,I=window.__items;g.inv.equip.charm=I.makeNamed('wayfarersatchel',7);g.recalc();g.inv.bag=Array.from({length:31},()=>I.genItem({ developer:true,level:3}));const cap=g.bagCapacity();g.ui.navigate('bag');g.ui.renderInventory();return cap;});
 R.ok(relic===32,'satchel expands usable bag to 32');
 R.ok(await page.locator('.bag-capacity').innerText().then(t=>t.includes('/ 32')),'capacity displayed consistently');
 const safe=await page.evaluate(()=>{const g=window.__game;g.inv.bag[0]=window.__items.makeNamed('phoenixfeather',12);g.equipItem(0);return g.inv.equip.charm.unique==='wayfarersatchel';});R.ok(safe,'cannot replace satchel while excess items remain');
 await page.evaluate(()=>{const g=window.__game;g.inv.bag=[];g.inv.equip.charm=window.__items.makeNamed('phoenixfeather',12);g.recalc();g.ui.navigate('resume');g.inv.hp=1;g.player.takeDamage(99,12);});
 R.ok(await page.evaluate(()=>{const g=window.__game;return g.inv.hp===Math.ceil(g.inv.maxHp*.4)&&g.flags.phoenixSpent&&g.player.state!=='dead';}),'Phoenix restores health once and persists spent state');
 await page.evaluate(()=>{const g=window.__game;g.inv.equip.charm=window.__items.makeNamed('worldseed',16);g.recalc();});await sim(page,3);
 R.ok(await page.evaluate(()=>window.__game.ui.talking),'Worldseed presents boon choice');
 await page.getByText('Might · +10% damage',{exact:true}).click();await sim(page,3);
 R.ok(await page.evaluate(()=>window.__game.flags['boon:overworld']==='might'),'Worldseed stores chosen area boon');
 await page.evaluate(()=>{const g=window.__game;g.loadArea('grotto','entrance');});
 R.ok(await page.evaluate(()=>!window.__game.inv.areaBoon),'new area cannot retain previous boon');
 await sim(page,3);await page.getByText('Shelter · +15 armour',{exact:true}).click();
 R.ok(await page.evaluate(()=>window.__game.flags['boon:grotto']==='shelter'),'next area has its own independent choice');
 await page.evaluate(()=>{const g=window.__game;g.inv.equip.charm=null;g.recalc();g.ui.navigate('settings');});
 await page.getByRole('button',{name:'Interface',exact:true}).click();
 R.ok(await page.getByRole('button',{name:'Download bug report'}).isVisible(),'alpha report tools accessible in Interface settings');
 await page.getByRole('textbox',{name:'What happened?'}).fill('Testing export');
 const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download bug report'}).click()]);
 const report=JSON.parse(await readFile(await d.path(),'utf8'));R.ok(report.notes==='Testing export'&&report.area==='grotto'&&report.build.includes('0.8.0'),'report includes reproducible build and location context');
 R.ok(d.suggestedFilename()==='mossling-bug-report.json','report downloads locally');
 const [save]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export adventures'}).click()]);
 R.ok(save.suggestedFilename()==='mossling-adventures.json','adventure export downloads');
 await page.screenshot({path:'/tmp/mossling-alpha8.jpg'});
 const savePath=await save.path();const exported=JSON.parse(await readFile(savePath,'utf8'));
 await page.reload();await page.waitForFunction(()=>window.__game&&!document.getElementById('loading'));
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByText('Import adventures…',{exact:true}).click()]);
 await chooser.setFiles(savePath);await page.getByText('Import copies',{exact:true}).click();
 R.ok(await page.evaluate(n=>window.__game.saveProvider.read().characters.length===n*2,exported.characters.length),'title import creates copies while retaining original adventures');

}
