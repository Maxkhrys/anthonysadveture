// Mouse inspection, Diablo-style: the cursor highlights what it points at (drops, NPCs, enemies,
// chests, signs, Bellstones...) with a ground ring and a name tag. Hovering a drop shows its
// tooltip from any distance, so loot can be read before walking over. A click on a highlighted
// thing within reach picks it up / talks / interacts instead of swinging; out of reach it says so.
// Holding Alt labels every drop on screen (click a label to pick it up when close).
import * as THREE from 'three';
import {ELITES,enemyBadges,roleOf} from './rpg/combat_readability.js';
import { RARITY } from './rpg/items.js';

export const REACH = 1.8; // how far a click can pick up or interact (world units)
const COL = { npc: 0xf0c35a, enemy: 0xe8483a, object: 0xf6ead0 };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = s => s.replace(/([a-z])([A-Z])/g, '$1 $2');
const CHEST = ['Wooden Chest', 'Iron Chest', 'Gilded Chest'];

export class Hover {
  constructor(g) {
    this.g = g; this.target = null; this.consume = false; this.t = 0;
    const ui = document.getElementById('ui');
    this.tag = document.createElement('div'); this.tag.id = 'hover-tag'; this.tag.className = 'hidden'; ui.appendChild(this.tag);
    this.tip = document.createElement('div'); this.tip.id = 'hover-tip'; this.tip.className = 'hidden'; ui.appendChild(this.tip);
    this.labels = document.createElement('div'); this.labels.id = 'drop-labels'; ui.appendChild(this.labels);
    this.labels.addEventListener('mousedown', e => { const el = e.target.closest('[data-i]'); if (!el) return; e.preventDefault(); e.stopPropagation(); const d = this.shown[+el.dataset.i]; if (d && !d.dead) this.activate(d); });
    this.shown = [];
    // one shared ground ring, recoloured per target
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 28).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.visible = false; this.ring.renderOrder = 2;
    this.altDown = false;
    addEventListener('keydown', e => { if (e.key === 'Alt') { this.altDown = true; e.preventDefault(); } });
    addEventListener('keyup', e => { if (e.key === 'Alt') this.altDown = false; });
    addEventListener('blur', () => { this.altDown = false; });
  }
  kind(e) {
    if (!e || e.dead || e === this.g.player) return null;
    const n = e.constructor && e.constructor.name;
    if (n === 'GearDrop' && e.item) return 'drop';
    if (e.isEnemy) return e.spawnT > 0 || e.hidden ? null : 'enemy';
    if (n === 'NPC') return 'npc';
    if (e.interactable && e.prompt) return 'object';
    return null;
  }
  label(e, k) {
    const g = this.g;
    if (k === 'drop') return e.item.name;
    if (k === 'npc') return e.name || 'Villager';
    if (k === 'enemy') return (e.elite && e.elite.name ? e.elite.name + ' ' : '') + g.nameOf(e).replace(/^(a|an|the) /i, '');
    const n = e.constructor.name;
    if (n === 'LootChest') return CHEST[e.tier || 0] || 'Chest';
    if (e.displayName || e.hoverName) return e.displayName || e.hoverName;
    return (e.name && n === 'Bellstone' ? e.name + ' ' : '') + words(n);
  }
  height(e, k) { return k === 'drop' ? 0.35 : k === 'enemy' ? 0.5 * (e.eliteScale || 1) : 0.55; }
  ground(e) { return this.g.groundAt ? this.g.groundAt(e.x, e.z) : 0; }
  reach(e) { const p = this.g.player; return Math.hypot(e.x - p.x, e.z - p.z) - Math.max(e.hw || 0.2, e.hd || 0.2) <= REACH; }
  active() {
    const g = this.g, i = g.input;
    const pause = document.getElementById('pause');
    return !!g.player && i.onCanvas && !g.locked() && !g.ui.invOpen && !g.ui.craftOpen && !g.dead && !(pause && !pause.classList.contains('hidden'));
  }
  pick() {
    const g = this.g, i = g.input, k0 = Math.max(0.7, innerHeight / 720);
    let best = null, bd = 1;
    for (const e of g.entities) {
      const k = this.kind(e); if (!k) continue;
      if (Math.abs(e.x - g.player.x) > 14 || Math.abs(e.z - g.player.z) > 11) continue;
      const s = g.pr.project({ x: e.x, y: this.ground(e) + this.height(e, k) * 0.6, z: e.z });
      const r = (k === 'drop' ? 26 : k === 'enemy' ? 30 * (e.eliteScale || 1) : 32) * k0;
      const d = Math.hypot(s.x - i.mouseX, (s.y - i.mouseY) * 0.85) / r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // pick up / talk / use — only within reach
  activate(e) {
    const g = this.g, k = this.kind(e);
    if (!k || k === 'enemy') return false;
    if (!this.reach(e)) { g.ui.float(e.x, 0.9, e.z, 'Too far', '#f6ead0', false, true); return true; }
    if (k === 'drop') { if (g.pickupItem(e.item)) e.remove(); else g.ui.toast('Your bag is full!', 'Press E and salvage something.', 2); }
    else { const p = g.player; p.facing = Math.atan2(e.x - p.x, e.z - p.z); e.interact(); }
    return true;
  }
  update(dt) {
    const g = this.g, inp = g.input;
    this.t += dt;
    if (!this.ring.parent && g.scene) g.scene.add(this.ring);
    // a click that was spent on a pick-up must not also swing, until the button is released
    if (this.consume) { if (inp.mouse.has(0)) inp.state.attack = false; else this.consume = false; }
    const on = this.active();
    const t = on ? this.pick() : null;
    this.target = t;
    if (t && inp.pressed('attack') && inp.mouse.has(0) && this.kind(t) !== 'enemy') {
      if (this.activate(t)) { this.consume = true; inp.state.attack = false; }
    }
    this.draw(t);
    this.drawLabels(on && this.altDown);
  }
  draw(t) {
    const g = this.g, k = t ? this.kind(t) : null;
    if (!t || !k || t.dead) { this.ring.visible = false; this.tag.classList.add('hidden'); this.tip.classList.add('hidden'); this.lastTip = null; return; }
    const R = k === 'drop' ? (t.item.prismatic ? { hex: 0x93dfff, color: '#93dfff' } : RARITY[t.item.r]) : null;
    this.ring.visible = true;
    this.ring.position.set(t.x, this.ground(t) + 0.03, t.z);
    this.ring.scale.setScalar((k === 'drop' ? 0.38 : k === 'enemy' ? 0.5 * (t.eliteScale || 1) : 0.46) * (1 + Math.sin(this.t * 6) * 0.06));
    this.ringMat.color.setHex(R ? R.hex : COL[k]);
    const near = this.reach(t);
    const s = g.pr.project({ x: t.x, y: this.ground(t) + this.height(t, k) + 0.45, z: t.z });
    let h = `<b style="color:${R ? R.color : ''}">${esc(this.label(t, k))}</b>`;
    if (k === 'enemy') {
      const lv = t.level ? `<small>Lv ${t.level}</small>` : '';
      h = `<small>${esc(roleOf(t))}${ELITES[t.elite]?' · '+esc(ELITES[t.elite][1]):''}</small><b class="foe">${esc(this.label(t, k))}</b>${lv}<small>${enemyBadges(t).map(b=>b.icon+' '+b.name).join(' · ')}</small><i class="hp"><i style="width:${Math.max(0, Math.min(100, t.hp / (t.maxHp || 1) * 100))}%"></i></i>`;
    } else {
      const act = k === 'drop' ? 'pick up' : k === 'npc' ? 'talk' : (t.prompt || 'use').toLowerCase();
      h += `<small class="${near ? 'near' : 'far'}">${near ? 'Click to ' + esc(act) : 'Too far to reach'}</small>`;
    }
    this.tag.innerHTML = h;
    this.tag.className = 'k-' + k;
    this.tag.style.transform = `translate(${Math.round(s.x)}px,${Math.round(s.y)}px) translate(-50%,-100%)`;
    // drops: the full tooltip beside the cursor, readable from any distance
    if (k === 'drop') {
      if (this.lastTip !== t) {
        this.lastTip = t;
        const it = t.item, eq = g.inv.equip || {}, cur = eq[it.slot === 'armor' ? 'armor' : it.slot];
        try { this.tip.innerHTML = g.ui.itemHtml ? g.ui.itemHtml(it, cur) : `<b>${esc(it.name)}</b>`; } catch (e) { this.tip.innerHTML = `<b>${esc(it.name)}</b>`; }
      }
      const i = g.input, w = this.tip.offsetWidth || 300, hh = this.tip.offsetHeight || 200;
      // below-right of the cursor, so it never covers the drop's own name tag
      const x = Math.min(innerWidth - w - 12, i.mouseX + 28), y = Math.max(12, Math.min(innerHeight - hh - 12, i.mouseY + 18));
      this.tip.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
      this.tip.classList.remove('hidden');
    } else { this.tip.classList.add('hidden'); this.lastTip = null; }
  }
  drawLabels(show) {
    const g = this.g;
    if (!show) { if (this.shown.length) { this.labels.innerHTML = ''; this.shown = []; } return; }
    const drops = g.entities.filter(e => this.kind(e) === 'drop' && Math.abs(e.x - g.player.x) < 14 && Math.abs(e.z - g.player.z) < 11).slice(0, 30);
    if (drops.length !== this.shown.length || drops.some((d, i) => d !== this.shown[i])) {
      this.shown = drops;
      this.labels.innerHTML = drops.map((d, i) => { const R = d.item.prismatic ? { color: '#93dfff' } : RARITY[d.item.r]; return `<span data-i="${i}" style="color:${R.color}">${esc(d.item.name)}</span>`; }).join('');
    }
    // stack labels so they never overlap: top to bottom, nudging down when two collide
    const placed = [];
    [...this.labels.children].forEach((el, i) => {
      const d = drops[i], s = g.pr.project({ x: d.x, y: this.ground(d) + 0.6, z: d.z });
      let y = s.y; const w = el.offsetWidth || 100;
      for (const p of placed) if (Math.abs(p.x - s.x) < (w + p.w) / 2 && Math.abs(p.y - y) < 22) y = p.y + 22;
      placed.push({ x: s.x, y, w });
      el.style.transform = `translate(${Math.round(s.x)}px,${Math.round(y)}px) translate(-50%,-100%)`;
      el.classList.toggle('far', !this.reach(d));
    });
  }
}
