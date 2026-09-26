// Single PC action registry. Gameplay, prompts and controls all read this contract.
// Context actions (confirm, favourite, salvage) are deliberately separate from world actions.
export const ACTIONS = {
  up: { keys: ['KeyW', 'ArrowUp'], label: 'Move forward', glyph: 'W / ↑' },
  down: { keys: ['KeyS', 'ArrowDown'], label: 'Move backward', glyph: 'S / ↓' },
  left: { keys: ['KeyA', 'ArrowLeft'], label: 'Move left', glyph: 'A / ←' },
  right: { keys: ['KeyD', 'ArrowRight'], label: 'Move right', glyph: 'D / →' },
  attack: { keys: ['KeyC'], label: 'Attack / hold to charge (guns: hold to fire)', glyph: 'LMB / C' },
  secondary: { keys: ['KeyX'], label: 'Weapon secondary attack (depends on the weapon)', glyph: 'RMB / X' },
  shield: { keys: ['KeyQ'], label: 'Guard / timed parry', glyph: 'Q' },
  roll: { keys: ['Space', 'ShiftLeft', 'ShiftRight'], label: 'Dodge / backstep', glyph: 'Space / Shift' },
  toolCycle: { keys: ['KeyY'], label:'Swap dungeon tool', glyph:'Y' },
  item: { keys: ['KeyL'], label: 'Dungeon tool', glyph: 'L' },
  interact: { keys: ['KeyF', 'Enter'], label: 'Interact / confirm', glyph: 'F / Enter' },
  potion: { keys: ['KeyH'], label: 'Drink tonic', glyph: 'H' },
  reload: { keys:['KeyZ'],label:'Reload firearm',glyph:'Z' },
  surge: { keys: ['KeyR'], label: 'Bell Surge', glyph: 'R' },
  inventory: { keys: ['KeyE', 'KeyI', 'KeyB'], label: 'Inventory', glyph: 'E' },
  skills: { keys: ['KeyK'], label: 'Skill tree', glyph: 'K' },
  map: { keys: ['KeyM'], label: 'Map', glyph: 'M' },
  journal: { keys: ['KeyJ'], label: 'Quest journal', glyph: 'J' },
  pause: { keys: ['Escape', 'Tab', 'KeyP'], label: 'Pause / back', glyph: 'Esc' },
  music: { keys: ['F8'], label: 'Toggle music', glyph: 'F8' },
  craft: { keys: ['KeyG'], label: 'Crafting and building (Survival)', glyph: 'G' },
  ...Object.fromEntries(Array.from({length:6}, (_, i) => ['ab' + (i+1), { keys: ['Digit'+(i+1), 'Numpad'+(i+1)], label: 'Ability '+(i+1), glyph: String(i+1) }])),
  salvage: { keys: ['KeyX', 'Delete'], label: 'Salvage selected item', glyph: 'X', context: true },
  lock: { keys: ['KeyV'], label: 'Favourite / protect item', glyph: 'V', context: true },
  sort: { keys: ['KeyT'], label: 'Sort inventory', glyph: 'T', context: true },
  filter: { keys: ['KeyG'], label: 'Filter inventory', glyph: 'G', context: true },
};
export const KEYMAP = Object.fromEntries(Object.entries(ACTIONS).map(([id,a]) => [id,a.keys]));
export const glyph = id => ACTIONS[id]?.glyph || id;
export const prompt = id => `<kbd>${glyph(id)}</kbd>`;
export const controlsHTML = () => `<div class="controls-grid">${Object.entries(ACTIONS).filter(([id]) => !['down','left','right','ab2','ab3','ab4','ab5','ab6'].includes(id)).map(([id,a]) => `<div class="control-row"><span>${id === 'up' ? 'Move' : id === 'ab1' ? 'Six equipped abilities' : a.label}${a.context ? '<small>In inventory</small>' : ''}</span><kbd>${id === 'up' ? 'WASD / Arrows' : id === 'ab1' ? '1–6' : a.glyph}</kbd></div>`).join('')}</div><p class="setnote">Mouse aims. C attacks in your facing direction. Gamepad: left stick move, right stick aim, RT weapon secondary, LB guard; hold LT + X / Y / B / A / LB / RB for abilities 1–6. Reload binding: <select aria-label="Reload key" data-reload-key>${['KeyZ','KeyN','KeyU'].map(k=>`<option value="${k}" ${KEYMAP.reload[0]===k?'selected':''}>${k.slice(3)}</option>`).join('')}</select>.</p>`;

export function setReloadKey(code){
 if(!['KeyZ','KeyN','KeyU'].includes(code))return false;
 KEYMAP.reload=[code];ACTIONS.reload.keys=KEYMAP.reload;ACTIONS.reload.glyph=code.slice(3);
 try{globalThis.localStorage?.setItem('mossling-reload-key',code);}catch{}return true;
}
try{const key=globalThis.localStorage?.getItem('mossling-reload-key');if(key)setReloadKey(key);}catch{}
if(typeof document!=='undefined')document.addEventListener('change',e=>{if(e.target.matches('[data-reload-key]'))setReloadKey(e.target.value);});
