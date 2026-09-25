// Small illustrated inventory symbols for non-equipment entries. Equipment uses real 3D renders.
import {MATS} from '../rpg/crafting.js';
export function catalogueIcon(item){
 const id=item.id.split(':').pop(),color=MATS[id]?.color||'#dfbd69';
 const drawings={
  gem:'<path d="M18 14H42L51 28 30 54 9 28Z"/><path d="M18 14L23 28 30 54 38 28 42 14M9 28H51" fill="none" stroke="#fff5c0"/>',
  feather:'<path d="M14 51L18 26 35 10 50 8 48 26 33 43Z"/><path d="M12 55L43 17M22 42L23 27M30 34L43 32" fill="none" stroke="#fff0c0" stroke-width="3"/>',
  leaf:'<path d="M10 43Q6 12 49 10Q58 48 20 50Z"/><path d="M9 55L43 19M26 38L16 26M33 31L44 34" fill="none" stroke="#e5fac9" stroke-width="3"/>',
  scroll:'<path d="M14 10H46V52H14Z" fill="#e8d2a0"/><path d="M10 9H49V16H10ZM11 47H51V54H11Z" fill="#957049"/><path d="M22 23H40M22 30H37M22 37H41" stroke="#6e5139" stroke-width="3"/>',
  map:'<path d="M8 15L23 9 39 16 54 10V49L39 55 23 48 8 54Z" fill="#dec68d"/><path d="M23 9V48M39 16V55" stroke="#aa8050"/><path d="M15 41L30 23 45 32" fill="none" stroke="#879452" stroke-width="4"/><path d="M39 26L50 37M50 26L39 37" stroke="#9d4135" stroke-width="3"/>',
  flame:'<path d="M31 7Q48 28 47 40Q43 57 26 53Q6 47 17 28L25 36Z" fill="#f79841"/><path d="M30 29Q43 45 31 49Q21 46 30 29Z" fill="#ffe5a0"/>',
  key:'<path d="M26 29V54H34V45H44V37H34V29Z"/><path d="M17 10H41V31H17Z"/><path d="M24 17H34V24H24Z" fill="#33291c"/>',
  potion:'<path d="M23 8H39V14H23Z" fill="#9f7046"/><path d="M25 14V23L16 31V50L22 55H42L48 50V31L37 23V14Z" fill="#bcd7d2"/><path d="M20 34H44V48L40 51H24L20 48Z" fill="#d95061"/><path d="M23 29V43" stroke="#fff4d5" stroke-width="3"/>',
  heart:'<path d="M9 16H25L31 24 37 16H53V34L31 54 9 34Z" fill="#dc6373"/><path d="M15 22H23V28H15Z" fill="#ffbdba"/>',
  bell:'<path d="M15 44L21 36V23Q21 12 32 12Q43 12 43 23V36L49 44Z"/><path d="M12 44H52V50H12ZM28 52H36V57H28ZM29 7H35V13H29Z"/><path d="M26 22V33" stroke="#fff5c0" stroke-width="3"/>',
  wax:'<path d="M21 23H43V54H21Z" fill="#f3dcaa"/><path d="M21 25L25 35 29 27 36 38 39 25" fill="#fff0c9"/><path d="M31 5Q44 23 32 25Q21 22 31 5Z" fill="#ffb64d"/>',
  thread:'<path d="M18 12H46V19H18ZM18 47H46V54H18Z" fill="#a47b51"/><path d="M22 19H42V47H22Z"/><path d="M23 24H41M23 30H41M23 36H41M23 42H41" stroke="#fff0c0" stroke-width="2"/>',
  tongs:'<path d="M16 10L42 52M48 10L20 52" stroke="#b5c6cf" stroke-width="7"/><circle cx="32" cy="34" r="5" fill="#dca45a"/>',
  bellows:'<path d="M18 16L47 25 47 39 18 49 10 32Z" fill="#9e5840"/><path d="M18 16L25 31 18 49M25 31H48" fill="none" stroke="#edb778" stroke-width="4"/><path d="M47 27H58V36H47Z" fill="#a8cad1"/>',
 };
 let kind=item.category==='Recipes'||id==='score'?'scroll':item.id.startsWith('map:')?'map':item.id.startsWith('chime:')?'bell':id==='bellows'?'bellows':id==='fireRod'||id==='ember'?'flame':id.includes('key')?'key':id==='potion'?'potion':id==='heart'||id==='thornheart'?'heart':id==='tongs'?'tongs':id==='wax'?'wax':/feather|moth/.test(id)?'feather':/thread|filament|sailcloth/.test(id)?'thread':/mantis/.test(id)?'leaf':'gem';
 return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="'+color+'" stroke="#33291c" stroke-width="2" stroke-linejoin="round">'+drawings[kind]+'</g></svg>');
}
