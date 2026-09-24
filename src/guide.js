// Guided first-session tutorial: a live checklist that reacts to what you do.
import { sfx } from './engine/audio.js';

const CHARGE = { samurai: 'Hold <kbd>J</kbd>, release to spin-slash', archer: 'Hold <kbd>J</kbd> to charge a piercing shot', witch: 'Hold <kbd>J</kbd> to hurl a fireball' };
export function guideSteps(cls) {
  return [
    { id: 'move', text: 'Move with <kbd>WASD</kbd>' },
    { id: 'attack', text: 'Hit a Hushling with <kbd>J</kbd> / click' },
    { id: 'charge', text: CHARGE[cls] || CHARGE.samurai },
    { id: 'roll', text: 'Roll through danger with <kbd>Space</kbd>' },
    { id: 'guard', text: 'Guard with <kbd>K</kbd> (tap it just before a hit to parry)' },
    { id: 'ability', text: 'Use your first ability: <kbd>1</kbd>' },
    { id: 'loot', text: 'Walk over dropped gear to pick it up' },
    { id: 'equip', text: 'Open your bag <kbd>I</kbd> and equip gear <kbd>E</kbd>' },
    { id: 'talk', text: 'Talk to Elder Tamsin <kbd>E</kbd>' },
    { id: 'chest', text: 'Open a loot chest (◆ gold on your map <kbd>Esc</kbd>)' },
    { id: 'level', text: 'Reach level 3 and spend a skill point (<kbd>I</kbd> → Skills)' },
    { id: 'dungeon', text: 'Find Rootwell Hollow in the west woods' },
  ];
}

export class Guide {
  constructor(g) { this.g = g; this.moved = 0; }
  get done() { return this.g.flags.guide || (this.g.flags.guide = {}); }
  get finished() { return !!this.g.flags.guideDone; }
  event(id) {
    const g = this.g;
    if (this.finished || this.done[id]) return;
    const steps = guideSteps(g.inv.cls);
    const st = steps.find(s => s.id === id);
    if (!st) return;
    this.done[id] = true;
    sfx('switch');
    this.render(id);
    if (steps.every(s => this.done[s.id])) {
      g.flags.guideDone = true;
      g.gainXp(120);
      g.ui.banner('GUIDE COMPLETE', 'You\'re ready, little one.', 2.5);
      setTimeout(() => document.getElementById('guide').classList.add('hidden'), 2500);
    }
  }
  tick(dt) {
    const g = this.g, p = g.player;
    if (this.finished || !p) return;
    if (!this.done.move && g.input.mx ** 2 + g.input.mz ** 2 > 0.1 && !g.locked()) { this.moved += dt; if (this.moved > 1.2) this.event('move'); }
    if (!this.done.talk && (g.flags.stage || 0) >= 1) this.event('talk');
    if (!this.done.level && g.inv.level >= 3 && g.inv.skills.some((r, i) => r > 1)) this.event('level');
    if (!this.done.dungeon && g.area && g.area.id === 'dungeon') this.event('dungeon');
  }
  render(justDone) {
    const el = document.getElementById('guide');
    if (!el) return;
    const g = this.g;
    const show = g.settings.guide !== false && !this.finished && g.inv;
    el.classList.toggle('hidden', !show);
    if (!show) return;
    const steps = guideSteps(g.inv.cls);
    const todo = steps.filter(s => !this.done[s.id]).slice(0, 3);
    const recent = justDone ? steps.filter(s => s.id === justDone) : [];
    const n = steps.filter(s => this.done[s.id]).length;
    el.querySelector('.gd-list').innerHTML = recent.map(s => `<div class="gd-item done">${s.text}</div>`).join('') + todo.map((s, i) => `<div class="gd-item ${i === 0 ? 'cur' : ''}">${s.text}</div>`).join('') + `<div class="gd-h" style="margin-top:4px">${n} / ${steps.length}</div>`;
    if (justDone) { clearTimeout(this.rt); this.rt = setTimeout(() => this.render(), 1600); }
  }
}
