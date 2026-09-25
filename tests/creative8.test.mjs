import {fresh,sim} from './lib.mjs';
export default async function(page,R){
 await fresh(page,'samurai',{level:16});
 await page.evaluate(()=>window.__game.ui.navigate('bag'));
 R.ok(await page.locator('#creative-inventory').count()===0,'creative catalogue absent outside devroom');
 R.ok(await page.evaluate(async()=>{const {grantCreative}=await import('./src/dev/creative.js');return grantCreative(window.__game,'gear:heavensdivide')===false;}),'spawn action also rejects outside-devroom calls');
 await page.evaluate(()=>{const g=window.__game;g.ui.navigate('resume');g.loadArea('devroom','spawn');g.ui.navigate('bag');});
 const search=page.getByRole('searchbox',{name:'Search every item'});
 R.ok(await search.isVisible(),'opening devroom inventory shows creative search');
 R.ok(await page.evaluate(async()=>{const {CREATIVE_ITEMS}=await import('./src/dev/creative.js');const I=window.__items;return [...I.WEAPONS,...I.ARMORS,...I.LEGENDARIES,...I.ACCESSORIES].every(x=>CREATIVE_ITEMS.some(c=>c.id==='gear:'+x.id))&&CREATIVE_ITEMS.every(x=>typeof x.name==='string');}),'catalogue covers every registered equipment base and named variant');
 await search.fill('heaven');await page.getByRole('button',{name:'Add Heaven’s Divide',exact:true}).click();
 R.ok(await page.evaluate(()=>window.__game.inv.bag.some(x=>x.unique==='heavensdivide'&&x.prismatic)),'searched prismatic weapon creates real usable item');
 await search.fill('hush shard');await page.getByLabel('Spawn quantity',{exact:true}).selectOption('64');
 const before=await page.evaluate(()=>window.__game.inv.mats.shard||0);
 await page.getByRole('button',{name:'Add Hush Shard',exact:true}).click();
 R.ok(await page.evaluate(()=>window.__game.inv.mats.shard)===before+64,'stack quantity applies to materials');
 await search.fill('cinder rod');await page.getByRole('button',{name:'Add Cinder Rod',exact:true}).click();
 R.ok(await page.evaluate(()=>window.__game.inv.fireRod&&window.__game.inv.activeTool==='fireRod'),'tool entry grants functional tool');
 await search.fill('nothingmatches123');R.ok(await page.getByText('No items match. Try another name or category.').isVisible(),'empty search has clear feedback');
 await search.fill('');await page.getByLabel('Item category',{exact:true}).selectOption('Equipment');
 await page.screenshot({path:'/tmp/mossling-creative8.jpg'});
 await page.getByRole('button',{name:'My bag',exact:true}).click();
 R.ok(await page.locator('#baggrid').isVisible(),'My bag restores regular equipment management');
 await page.evaluate(()=>{const g=window.__game;g.ui.navigate('resume');g.loadArea('overworld','village');g.ui.navigate('bag');});
 R.ok(await page.locator('#creative-inventory').count()===0&&await page.locator('#baggrid').isVisible(),'leaving devroom removes creative controls');
}
