// Standalone browser checks. No shared test configuration changes.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
let chromium;try{({chromium}=await import('playwright'));}catch{({chromium}=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright/index.mjs'));}
const root=fileURLToPath(new URL('../../',import.meta.url));
const server=process.env.PREVIEW_URL?null:spawn(process.execPath,['serve.mjs'],{cwd:root,env:{...process.env,PORT:'8080'},stdio:'ignore'});
const base=process.env.PREVIEW_URL||'http://localhost:8080';
const shots=fileURLToPath(new URL('./screens/',import.meta.url));mkdirSync(shots,{recursive:true});
let browser;let checks=0;const ok=(v,label)=>{assert.ok(v,label);checks++;console.log('PASS '+label);};
try{
if(server)await new Promise(r=>setTimeout(r,500));
browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  const seed=0x718d22;let x=seed;Math.random=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
  window.__storageCalls=[];for(const name of ['getItem','setItem','removeItem','clear']){const fn=Storage.prototype[name];Storage.prototype[name]=function(...args){window.__storageCalls.push([name,...args]);return fn.apply(this,args);};}
});
await page.goto(base+'/dev/inventory-preview/index.html');await page.waitForFunction(()=>window.__inventoryPreview?.portrait.hero);await page.waitForFunction(()=>[...document.querySelectorAll('#bag-grid img')].every(i=>i.complete&&i.naturalWidth));
const run=fn=>page.evaluate(fn);
ok(await run(()=>!window.__game),'no game bootstrap');
ok(await run(()=>__storageCalls.length===0),'zero storage reads/writes on load');
const before=await run(()=>JSON.stringify(__inventoryPreview.state.all()));
await page.locator('#search').fill('no-such-equipment');ok(await page.locator('#empty').isVisible(),'no-results message');await page.locator('#reset-filters').click();
await page.locator('#sort').selectOption('name');const names=await run(()=>__inventoryPreview.state.visible().map(i=>i.name));ok(names.every((n,i)=>!i||names[i-1].localeCompare(n)<=0),'name sorting');
for(let r=0;r<6;r++){await page.locator('#rarity').selectOption(String(r));ok(await run(()=>__inventoryPreview.state.visible().length>0&&__inventoryPreview.state.visible().every(it=>it.r===Number(__inventoryPreview.state.rarity)||it.prismatic)),'rarity filter '+r);}
await page.locator('#reset-filters').click();await page.locator('[data-category="armour"]').click();ok(await run(()=>__inventoryPreview.state.visible().every(i=>!['weapon','ring','charm'].includes(i.slot))),'armour category');await page.locator('#reset-filters').click();
const primary=await page.evaluate(async()=>{const {itemInfo}=await import('/src/item_info.js');return itemInfo(__inventoryPreview.state.selected,__inventoryPreview.state.context).weapon.primary;});await page.locator('#search').fill(primary);ok(await page.locator('#bag-grid button').count()>0,'search matches primary attack');await page.locator('#reset-filters').click();
ok(await page.evaluate(async()=>{const {itemInfo}=await import('/src/item_info.js');const {state}=__inventoryPreview,info=itemInfo(state.selected,state.context);return info.unique.every(s=>document.getElementById('item-content').textContent.includes(s))&&document.querySelector('.ii-stats').textContent.includes('vs. family base rate');}),'unique mechanics visible and speed multiplier labelled');
await page.locator('#details').focus();await page.keyboard.press('Enter');ok(await page.locator('#details').getAttribute('aria-expanded')==='true','keyboard Details');ok(await page.locator('.ii-meta').isVisible(),'expanded metadata');ok(await page.locator('.roll-ranges').count()>0,'real roll ranges');await page.locator('#details').click();
ok((await run(()=>JSON.stringify(__inventoryPreview.state.all())))===before,'view/filter/sort do not mutate items');
const selected=await run(()=>JSON.stringify(__inventoryPreview.state.selected));await page.locator('#equip').click();ok(await run(()=>__inventoryPreview.state.equippedSlot(__inventoryPreview.state.selected)),'equip selected sample');ok(await run(()=>JSON.stringify(__inventoryPreview.state.selected))===selected,'equip retains exact rolls');
await page.locator('#protect').click();ok(await run(()=>__inventoryPreview.state.isProtected(__inventoryPreview.state.selected)),'protect selected sample');await page.locator('#equip').click();ok(await run(()=>__inventoryPreview.state.inv.bag.includes(__inventoryPreview.state.selected)),'unequip sample');
const renderer=await run(()=>{__inventoryPreview.rendererBefore=__inventoryPreview.portrait.pixel.renderer;return true;});
for(const cls of ['witch','archer','soulbound','gunslinger','samurai']){await page.locator('#class-select').selectOption(cls);ok(await run(()=>__inventoryPreview.portrait.cls===__inventoryPreview.state.inv.cls),'class rig '+cls);}
ok(await run(()=>__inventoryPreview.rendererBefore===__inventoryPreview.portrait.pixel.renderer),'single portrait renderer reused across classes');
const rot=await run(()=>__inventoryPreview.portrait.rotY);await page.locator('#turn-left').click();await page.locator('#turn-right').click();const doll=await page.locator('#doll-host').boundingBox();await page.mouse.move(doll.x+doll.width/2,doll.y+doll.height/2);await page.mouse.down();await page.mouse.move(doll.x+doll.width/2+40,doll.y+doll.height/2);await page.mouse.up();ok(await run(()=>__inventoryPreview.portrait.rotY)!==rot,'drag rotation');
await page.locator('#zoom').focus();await page.keyboard.press('ArrowRight');ok(await run(()=>__inventoryPreview.portrait.zoom)!==1,'keyboard zoom');
await page.evaluate(()=>{const {state,render}=__inventoryPreview;state.selected=state.inv.bag.find(i=>i.r===4)||state.inv.bag[0];state.expanded=false;const weapon=state.inv.bag.find(i=>i.slot==='weapon'&&i.r===2);if(weapon){const selected=state.selected;state.selected=weapon;state.equip();state.selected=selected;}__inventoryPreview.portrait.rotY=.3;__inventoryPreview.portrait.setZoom(1);document.getElementById('zoom').value=1;document.getElementById('notice').textContent='';render();});
await page.screenshot({path:shots+'compact-1280.png'});
await page.locator('#details').click();await page.locator('#item-content').evaluate(e=>e.scrollTop=e.scrollHeight);const action=await page.locator('#equip').boundingBox();ok(action.y+action.height<720,'actions remain visible while details scroll');await page.locator('#item-content').evaluate(e=>e.scrollTop=0);await page.screenshot({path:shots+'details-1280.png'});
await page.setViewportSize({width:1920,height:1080});await page.locator('#details').click();await page.screenshot({path:shots+'compact-1920.png'});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:shots+'narrow-390.png',fullPage:true});ok(await run(()=>document.documentElement.scrollWidth<=innerWidth),'narrow viewport no horizontal overflow');
await page.locator('#details').tap().catch(()=>page.locator('#details').click());ok(await page.locator('#details').getAttribute('aria-expanded')==='true','narrow Details interaction');
ok(await page.evaluate(async()=>{const {computeStats}=await import('/src/rpg/classes.js');const {state}=__inventoryPreview;return state.stats.maxHp===computeStats(state.inv).maxHp&&document.getElementById('character-stats').textContent.includes(String(state.stats.maxHp));}),'displayed character stats match shared calculation');
const edge=await page.evaluate(async()=>{const {state,render}=__inventoryPreview;const {itemInfo}=await import('/src/item_info.js');const longest=state.all().reduce((a,b)=>b.name.length>a.name.length?b:a);state.selected=longest;state.expanded=true;render();const a=document.getElementById('item-content');return a.scrollWidth<=a.clientWidth+1&&a.textContent.includes(longest.name);});ok(edge,'longest sample name and expanded item stay in panel');
const emptyResult=await run(()=>{const {state,render}=__inventoryPreview,bag=state.inv.bag;state.inv.bag=[];state.selected=null;render();const result=document.querySelector('#empty').textContent.includes('empty')&&document.querySelector('#equip').disabled;state.inv.bag=bag;state.selected=bag[0];render();return result;});ok(emptyResult,'empty bag and no selection safe');
const full=await run(()=>{const {state}=__inventoryPreview,oldBag=state.inv.bag,selected=state.selected,item=state.inv.equip.chest;state.inv.bag=Array.from({length:30},()=>structuredClone(oldBag[0]));state.selected=item;const message=state.equip(),safe=message.includes('full')&&state.inv.equip.chest===item&&state.inv.bag.length===30;state.inv.bag=oldBag;state.selected=selected;return safe;});ok(full,'full bag blocks unequip safely');
ok(await run(()=>__storageCalls.length===0),'zero storage reads/writes after interactions');ok(errors.length===0,'no preview runtime errors: '+errors.join('; '));
await page.goto(base+'/index.html');await page.waitForFunction(()=>window.__game&&!document.getElementById('loading'),null,{timeout:60000});ok(await page.locator('#title').isVisible(),'original game title smoke check');ok(errors.length===0,'no original entry runtime errors');
console.log(`${checks} checks passed.`);
}finally{await browser?.close();server?.kill();}
