// Radial Building Wheel for Mossling Survival Mode.
// Opens with 'B' (hold or tap). Displays available build pieces in a dynamic pie formation.
// Selecting a piece enters placement mode immediately with zero screen occlusion.
import { PIECES, pieceParts } from './entities.js';
import { RECIPES } from './craft.js';
import { structureIconURL } from '../preview.js';
import { sfx } from '../engine/audio.js';

const SVG_HAMMER = '<svg viewBox="0 0 32 32" width="28" height="28" fill="#e8c77e"><path d="M22 2l8 8-4 4-2-2-9 9 2 2-3 3-4-4 3-3-2-2 9-9-2-2zM4 24l4 4-6 2z"/></svg>';
const SVG_TRASH = '<svg viewBox="0 0 32 32" width="28" height="28" fill="#ff8a70"><path d="M6 8h20v3H6zm3 5h14l-1 16H10zm4-9h6v2h-6z"/></svg>';

export class BuildWheel {
  constructor(mode) {
    this.m = mode;
    this.g = mode.g;
    this.isOpen = false;
    this.hoverIndex = 0;
    this.slices = [];
    this.holdStart = 0;

    this.el = document.createElement('div');
    this.el.id = 'sv-wheel';
    this.el.className = 'hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Radial building wheel');

    this.el.innerHTML = `
      <div class="wheel-backdrop"></div>
      <div class="wheel-container">
        <svg class="wheel-svg" viewBox="0 0 440 440"></svg>
        <div class="wheel-items"></div>
        <div class="wheel-hub">
          <div class="hub-icon"></div>
          <div class="hub-title">Select a piece</div>
          <div class="hub-subtitle">Move mouse or stick · Release B to place</div>
        </div>
      </div>
    `;

    document.body.appendChild(this.el);

    // Event listeners
    this.el.addEventListener('mousemove', e => this.onMouseMove(e));
    this.el.addEventListener('click', e => this.onClick(e));
    this.el.addEventListener('contextmenu', e => { e.preventDefault(); this.close(); });

    window.addEventListener('keyup', e => {
      if (e.code === 'KeyB' && this.isOpen) {
        // If held for more than 160ms, release activates hovered piece
        if (performance.now() - this.holdStart > 160) {
          this.activateHovered();
        }
      }
      if (e.code === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  getAvailableSlices() {
    const R = this.m.record || {};
    const kits = R.kits || {};
    const readyTypes = Object.entries(kits).filter(([k, count]) => count > 0 && PIECES[k]).map(([k]) => k);

    let pieceList = [];
    if (readyTypes.length >= 1) {
      pieceList = [...readyTypes];
      if (pieceList.length < 4) {
        const defaults = ['floor', 'wall', 'door', 'roof', 'campfire', 'workbench', 'chest', 'bed', 'brazier'];
        for (const d of defaults) {
          if (!pieceList.includes(d) && this.m.canCraft(d, 1).ok) {
            pieceList.push(d);
          }
        }
      }
    } else {
      const defaults = ['floor', 'wall', 'door', 'roof', 'campfire', 'workbench', 'chest', 'bed', 'brazier'];
      pieceList = defaults.filter(k => PIECES[k]);
    }

    const slices = pieceList.map(type => {
      const piece = PIECES[type];
      const count = kits[type] || 0;
      const recipe = RECIPES.find(r => r.gives === type);
      return {
        id: type,
        name: piece.name,
        count,
        desc: piece.desc,
        recipe,
        canCraft: this.m.canCraft(recipe?.id || type, 1).ok,
        iconURL: structureIconURL(type, pieceParts(type)),
      };
    });

    slices.push({
      id: 'demolish',
      name: 'Take Down / Demolish',
      count: null,
      desc: 'Dismantle an existing piece. The full kit is returned to your build pouch.',
      recipe: null,
      canCraft: true,
      isDemolish: true,
      svgIcon: SVG_TRASH,
    });

    return slices;
  }

  tick(dt) {
    if (!this.isOpen || this.slices.length === 0) return;
    const pad = navigator.getGamepads?.()[0];
    if (pad) {
      const rx = Math.abs(pad.axes[2]) > 0.35 ? pad.axes[2] : Math.abs(pad.axes[0]) > 0.35 ? pad.axes[0] : 0;
      const ry = Math.abs(pad.axes[3]) > 0.35 ? pad.axes[3] : Math.abs(pad.axes[1]) > 0.35 ? pad.axes[1] : 0;
      if (Math.hypot(rx, ry) > 0.35) {
        const n = this.slices.length;
        const step = (Math.PI * 2) / n;
        const offset = -Math.PI / 2 - step / 2;
        let angle = Math.atan2(ry, rx) - offset;
        while (angle < 0) angle += Math.PI * 2;
        angle = angle % (Math.PI * 2);
        const index = Math.floor(angle / step) % n;
        if (index !== this.hoverIndex) this.updateHover(index, true);
      }
    }
  }

  open() {
    if (!this.m.active || this.g.dead || this.g.locked() || this.g.ui.invOpen) return;
    this.isOpen = true;
    this.holdStart = performance.now();
    this.slices = this.getAvailableSlices();
    this.hoverIndex = 0;
    this.render();
    this.el.classList.remove('hidden');
    sfx('select');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
  }

  render() {
    const svg = this.el.querySelector('.wheel-svg');
    const items = this.el.querySelector('.wheel-items');
    svg.innerHTML = '';
    items.innerHTML = '';

    const n = this.slices.length;
    if (n === 0) return;

    const cx = 220, cy = 220;
    const R_out = 195, R_in = 75;
    const step = (Math.PI * 2) / n;
    // Rotate so first slice starts at the top (-90 degrees)
    const offset = -Math.PI / 2 - step / 2;

    this.slices.forEach((slice, i) => {
      const start = offset + i * step;
      const end = start + step;
      const mid = (start + end) / 2;

      // Outer & inner arc coords
      const x1 = cx + R_out * Math.cos(start), y1 = cy + R_out * Math.sin(start);
      const x2 = cx + R_out * Math.cos(end), y2 = cy + R_out * Math.sin(end);
      const x3 = cx + R_in * Math.cos(end), y3 = cy + R_in * Math.sin(end);
      const x4 = cx + R_in * Math.cos(start), y4 = cy + R_in * Math.sin(start);
      const largeArc = step > Math.PI ? 1 : 0;

      const pathData = `M ${x1} ${y1} A ${R_out} ${R_out} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${R_in} ${R_in} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('class', `wheel-slice-path ${slice.isDemolish ? 'slice-demolish' : ''}`);
      path.dataset.index = i;
      svg.appendChild(path);

      // Node for icon and quantity
      const itemR = (R_out + R_in) / 2;
      const itemX = cx + itemR * Math.cos(mid);
      const itemY = cy + itemR * Math.sin(mid);

      const itemEl = document.createElement('div');
      itemEl.className = 'wheel-item-node';
      itemEl.dataset.index = i;
      itemEl.style.left = `${itemX}px`;
      itemEl.style.top = `${itemY}px`;

      const iconHtml = slice.isDemolish
        ? slice.svgIcon
        : `<img src="${slice.iconURL}" alt="${slice.name}" class="wheel-icon-img">`;

      const countBadge = slice.count !== null
        ? `<span class="wheel-count-badge ${slice.count > 0 ? 'has-kits' : 'no-kits'}">×${slice.count}</span>`
        : '';

      itemEl.innerHTML = `
        <div class="wheel-icon-wrap">${iconHtml}</div>
        <div class="wheel-item-name">${slice.name}</div>
        ${countBadge}
      `;
      items.appendChild(itemEl);
    });

    this.updateHover(this.hoverIndex, false);
  }

  onMouseMove(e) {
    if (!this.isOpen || this.slices.length === 0) return;
    const container = this.el.querySelector('.wheel-container');
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < 40) return; // inner deadzone

    const n = this.slices.length;
    const step = (Math.PI * 2) / n;
    const offset = -Math.PI / 2 - step / 2;
    let angle = Math.atan2(dy, dx) - offset;
    while (angle < 0) angle += Math.PI * 2;
    angle = angle % (Math.PI * 2);

    const index = Math.floor(angle / step) % n;
    if (index !== this.hoverIndex) {
      this.updateHover(index, true);
    }
  }

  updateHover(index, playSound = true) {
    this.hoverIndex = index;
    const paths = this.el.querySelectorAll('.wheel-slice-path');
    const itemNodes = this.el.querySelectorAll('.wheel-item-node');

    paths.forEach((p, i) => p.classList.toggle('selected', i === index));
    itemNodes.forEach((node, i) => node.classList.toggle('selected', i === index));

    const selected = this.slices[index];
    if (!selected) return;

    if (playSound) sfx('select');

    // Update center hub
    const hub = this.el.querySelector('.wheel-hub');
    const hubIcon = hub.querySelector('.hub-icon');
    const hubTitle = hub.querySelector('.hub-title');
    const hubSubtitle = hub.querySelector('.hub-subtitle');

    if (selected.isDemolish) {
      hubIcon.innerHTML = selected.svgIcon;
      hubTitle.textContent = selected.name;
      hubSubtitle.textContent = 'Dismantle built structures · click or release B';
    } else {
      hubIcon.innerHTML = `<img src="${selected.iconURL}" alt="">`;
      hubTitle.textContent = selected.name;
      const count = selected.count || 0;
      if (count > 0) {
        hubSubtitle.innerHTML = `<b class="ok">${count} ready in pouch</b> · release B or click to place`;
      } else if (selected.canCraft) {
        hubSubtitle.innerHTML = `<span class="ready-craft">Ready to craft & place</span> · click to build`;
      } else {
        hubSubtitle.innerHTML = `<span class="no">Needs materials</span> · ${selected.desc}`;
      }
    }
  }

  onClick(e) {
    if (!this.isOpen) return;
    const target = e.target.closest('[data-index]');
    if (target) {
      const idx = +target.dataset.index;
      if (Number.isInteger(idx) && this.slices[idx]) {
        this.hoverIndex = idx;
        this.activateHovered();
        return;
      }
    }
    // Click in outer/inner area activates hovered slice if far enough from center
    const container = this.el.querySelector('.wheel-container');
    const rect = container.getBoundingClientRect();
    const dist = Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
    if (dist > 40 && dist < 220) {
      this.activateHovered();
    } else if (dist <= 40) {
      this.close();
    }
  }

  activateHovered() {
    const selected = this.slices[this.hoverIndex];
    this.close();
    if (!selected) return;

    if (selected.isDemolish) {
      this.m.startBuild('demolish');
      return;
    }

    const kits = this.m.record.kits || {};
    if ((kits[selected.id] || 0) > 0) {
      this.m.startBuild(selected.id);
    } else if (selected.canCraft && selected.recipe) {
      // Instant craft and place
      const res = this.m.craft(selected.recipe.id, 1);
      if (res.ok) {
        this.m.startBuild(selected.id);
      }
    } else {
      sfx('error');
      this.g.ui.toast && this.g.ui.toast('Cannot build ' + selected.name, 'Gather the required materials first.', 1.6);
    }
  }
}
