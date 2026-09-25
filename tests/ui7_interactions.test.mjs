import { fresh, sim } from './lib.mjs';
export default async function(page,R){
 await fresh(page,'witch',{level:12});
 await page.evaluate(()=>{const g=window.__game;g.inv.sp=20;g.ui.navigate('skills');});
 await page.locator('.tn[data-id="kindling"]').click();await page.locator('[data-act="learn"]').click();
 R.ok(await page.evaluate(()=>window.__game.inv.tree.kindling===1&&window.__game.inv.sp===19),'learn node spends one point');
 await page.locator('.tn[data-id="nova"]').click();await page.locator('[data-assign="5"]').click();
 R.ok(await page.evaluate(()=>window.__game.inv.loadout[5]==='nova'),'assign through sixth socket');
 await page.keyboard.press('Tab');
 R.ok(await page.evaluate(()=>!!document.activeElement.closest('#inventory')),'keyboard focus stays inside menu');
 await page.evaluate(()=>{const g=window.__game;g.ui.navigate('bag');const it=window.__items.genItem({level:5,slot:'helm',rarity:2});g.inv.equip.helm=it;g.recalc();g.ui.invSel=-1;g.ui.renderInventory();});
 await page.locator('[data-act="unequip"]').click();
 R.ok(await page.evaluate(()=>window.__game.inv.equip.helm===null&&window.__game.inv.bag.some(it=>it.slot==='helm')),'unequip moves same item to bag');
 await page.evaluate(()=>{const g=window.__game;g.inv.bag.push(window.__items.genItem({level:5,slot:'ring',rarity:2}));g.ui.invSel=g.inv.bag.length-1;g.ui.renderInventory();});
 await page.getByLabel('Ring slot').selectOption('ring2');await page.locator('[data-act="equip"]').click();
 R.ok(await page.evaluate(()=>!!window.__game.inv.equip.ring2&&!window.__game.inv.equip.ring1),'ring comparison target matches equip target');
 await page.evaluate(()=>window.__game.ui.navigate('resume'));await page.keyboard.press('j');await page.waitForFunction(()=>window.__game.ui.curTab==='quests');
 R.ok(await page.locator('.quest-list').isVisible(),'J opens journal');
 await page.evaluate(()=>window.__game.ui.navigate('resume'));
 await page.keyboard.press('/');await page.waitForFunction(()=>window.__game.input.paused);
 R.ok(await page.locator('#dev-console').isVisible(),'newer slash shortcut preserved');
 await page.evaluate(()=>{window.__dev.execute('/sandbox on');window.__dev.execute('/devroom');});
 await page.waitForFunction(()=>window.__game.area.id==='devroom');await page.screenshot({path:'docs/screens/pass7/devroom.jpg'});
 R.ok(await page.evaluate(()=>window.__game.devSandbox),'test facility screenshot uses isolated sandbox');
}
