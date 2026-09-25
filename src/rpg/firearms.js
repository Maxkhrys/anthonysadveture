// Serializable magazine state lives on each weapon instance, so swapping or saving cannot refill it.
export const FIREARMS = Object.freeze({revolver:{capacity:6,interval:.46,reload:1.45,power:1.35},rifle:{capacity:18,interval:.14,reload:1.9,power:.5}});
export const isFirearm = w => !!FIREARMS[w?.kind];
export function magazine(w) {
 const f=FIREARMS[w?.kind];if(!f)return null;
 if(!w.magazine)w.magazine={rounds:f.capacity,fired:0,opening:0,finalHit:false};
 const m=w.magazine;m.rounds=Math.max(0,Math.min(f.capacity,Math.floor(Number(m.rounds)||0)));
 m.fired=Math.max(0,Math.min(f.capacity,Math.floor(Number(m.fired)||0)));
 return m;
}
export function completeReload(w,highNoon=false,clean=false) {
 const m=magazine(w),f=FIREARMS[w.kind];if(!m)return;
 const empty=m.rounds===0,fullCycle=m.fired>=f.capacity;
 m.opening=(clean?.25:0)+(empty&&highNoon?1:0)+(m.finalHit&&w.unique==='sundownsix'?.75:0);
 m.spectral=w.unique==='seventhchime'&&fullCycle&&empty;
 m.rounds=f.capacity;m.fired=0;m.finalHit=false;
}
export function spendRounds(w,n=1) {const m=magazine(w);if(!m||m.rounds<n)return false;m.rounds-=n;m.fired=Math.min(FIREARMS[w.kind].capacity,m.fired+n);return true;}
