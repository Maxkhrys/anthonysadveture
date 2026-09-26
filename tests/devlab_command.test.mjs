import {mkdirSync} from 'node:fs';
import {fresh} from './lib.mjs';
export default async function(page,R){
 await fresh(page,'archer');
 const before=await page.evaluate(async()=>{const g=__game;g.noRender=true;g.settings.devMode=false;await g.save();return JSON.stringify(g.inv);});
 await page.keyboard.press('/');
 R.ok(await page.locator('#dev-console-input').isVisible(),'slash opens command input');
 R.ok(await page.locator('[data-cmd="/devlab"]').isVisible(),'lab shortcut is visible in command toolbar');
 mkdirSync('docs/screens/fieldcraft',{recursive:true});await page.screenshot({path:'docs/screens/fieldcraft/devlab-command.jpg',type:'jpeg',quality:85});
 await page.locator('#dev-console-input').fill('/devlab');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>__game.devlab.active&&__game.devlab.overlayOpen);
 R.ok(await page.evaluate(()=>__game.settings.devMode&&!__game.devConsole.isOpen&&!__game.input.paused),'devlab enables mode and closes the console input lock');
 const first=await page.evaluate(()=>{const g=__game;return JSON.stringify(g.inv.equip);});
 await page.evaluate(async()=>{const g=__game;g.devlabUI.close();const {DevCommands}=await import('/src/dev/commands.js');await DevCommands.execute(g,'/mossdev',()=>{});});
 R.ok(await page.evaluate(v=>JSON.stringify(__game.inv.equip)===v,first),'alias reopens existing lab without resetting items');
 await page.evaluate(async()=>{await __game.devlab.exit();});
 R.ok(await page.evaluate(v=>JSON.stringify(__game.inv)===v,before),'command round trip preserves adventure inventory');
}
