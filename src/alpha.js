import {parseTransfer,importCopies} from './persistence/transfer.js';
export const BUILD='Pass 8 · alpha 0.8.0';
export function download(name,body,type='application/json'){
 const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function reportData(g,notes=''){
 return {build:BUILD,date:new Date().toISOString(),notes,area:g.area?.id,room:g.roomId,position:g.player?{x:g.player.x,z:g.player.z}:null,class:g.inv?.cls,level:g.inv?.level,seed:g.world6?.seed,stage:g.flags?.stage,settings:g.settings,viewport:{width:innerWidth,height:innerHeight},browser:navigator.userAgent};
}
export function attachAlphaTools(root,g){
 const host=document.createElement('section');host.className='alpha-tools';
 host.innerHTML='<h3>Alpha field notes</h3><small>'+BUILD+'</small><label>What happened?<textarea maxlength="3000" placeholder="What you tried, what happened, what you expected"></textarea></label><div><button data-alpha="report">Download bug report</button><button data-alpha="shot">Save game screenshot</button><button data-alpha="save">Export adventures</button></div><p>Files stay with you. Attach report and screenshot when sharing feedback. Saves belong to this browser and site address.</p>';
 root.append(host);
 host.querySelector('[data-alpha="report"]').onclick=()=>download('mossling-bug-report.json',JSON.stringify(reportData(g,host.querySelector('textarea').value),null,2));
 host.querySelector('[data-alpha="shot"]').onclick=()=>{try{g.render(0);const a=document.createElement('a');a.href=document.getElementById('game').toDataURL('image/png');a.download='mossling-game.png';a.click();g.ui.toast('Game screenshot saved','Menu overlays are not included.');}catch(e){g.ui.toast('Screenshot unavailable',e.message);}};
 host.querySelector('[data-alpha="save"]').onclick=async()=>{try{if(g.profile&&!g.devSandbox)await g.save();download('mossling-adventures.json',JSON.stringify(g.saveProvider.read(),null,2));}catch(e){g.ui.toast('Export failed',e.message);}};
}
export function chooseImport(g,done){
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
 input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>5_000_000)throw Error('Save exceeds 5 MB.');const data=parseTransfer(await file.text());
  g.ui.ask('Import adventures',`Create ${data.characters.length} character copies? Existing adventures remain intact.`,[{label:'Import copies',cb:()=>{try{const added=importCopies(g.saveProvider,data);g.ui.toast('Import complete',`${added.length} adventures added.`);done();}catch(e){g.ui.toast('Import failed',e.message,6);}}},{label:'Cancel',cb:()=>{}}]);
 }catch(e){g.ui.toast('Import failed',e.message,6);}};input.click();
}
