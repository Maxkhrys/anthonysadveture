// Developer Console UI & Obscure Activation System for Mossling (Pass 2).
// DEVELOPER TOOLING ONLY.
//
// OBSCURITY NOTE:
// This activation mechanism is intentionally obscure to avoid confusing playtesters,
// but it is obscurity, NOT cryptography or security. Never put secrets or API keys
// in client code.

import { DevCommands, COMMAND_DEFINITIONS, COMMAND_CATEGORIES } from './commands.js';

export class DevConsole {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.history = [];
    this.historyIdx = -1;
    this.commandList = Object.keys(COMMAND_DEFINITIONS);

    this.buildUI();
    this.bindEvents();

    // Global developer hook for testing or scripted inspection
    window.__dev = {
      execute: (cmd) => DevCommands.execute(this.game, cmd, (msg, type) => this.log(msg, type)),
      toggle: () => this.toggle(),
      open: () => this.open(),
      close: () => this.close(),
    };
  }

  buildUI() {
    this.el = document.createElement('div');
    this.el.id = 'dev-console';
    this.el.className = 'dev-console hidden';

    this.el.innerHTML = `
      <div class="dev-header">
        <span class="dev-tag">[DEVELOPER TEST FACILITY — PASS 2]</span>
        <span class="dev-hint">Press \` or Esc to close · /help for categories</span>
      </div>
      <div class="dev-toolbar">
        <button type="button" class="dev-btn" data-cmd="/devroom">⚡ Dev Room</button>
        <button type="button" class="dev-btn" data-cmd="/god">🛡️ God Mode</button>
        <button type="button" class="dev-btn" data-cmd="/noclip">👻 NoClip</button>
        <button type="button" class="dev-btn" data-cmd="/heal">💚 Heal</button>
        <button type="button" class="dev-btn" data-cmd="/giveall">📦 Give All</button>
        <button type="button" class="dev-btn" data-cmd="/rollweapon">⚔️ Roll Weapon</button>
        <button type="button" class="dev-btn" data-cmd="/clear">🧹 Clear Foes</button>
        <button type="button" class="dev-btn" data-cmd="/perf">📊 Perf HUD</button>
        <button type="button" class="dev-btn" data-cmd="/gamepad">🎮 Gamepad</button>
      </div>
      <div class="dev-categories">
        <span class="dev-cat-label">Categories:</span>
        <button type="button" class="dev-cat-btn" data-cmd="/help">ALL</button>
        <button type="button" class="dev-cat-btn" data-cmd="/help character">CHAR</button>
        <button type="button" class="dev-cat-btn" data-cmd="/help loot">LOOT</button>
        <button type="button" class="dev-cat-btn" data-cmd="/help combat">COMBAT</button>
        <button type="button" class="dev-cat-btn" data-cmd="/help world">WORLD</button>
        <button type="button" class="dev-cat-btn" data-cmd="/help crafting">CRAFT</button>
        <button type="button" class="dev-cat-btn" data-cmd="/help quest">QUEST</button>
        <button type="button" class="dev-cat-btn" data-cmd="/help visual">VISUAL</button>
        <button type="button" class="dev-cat-btn" data-cmd="/help performance">PERF</button>
      </div>
      <div class="dev-log" id="dev-console-log"></div>
      <div class="dev-autocomplete hidden" id="dev-console-auto"></div>
      <div class="dev-input-row">
        <span class="dev-prompt">/</span>
        <input type="text" id="dev-console-input" class="dev-input" autocomplete="off" spellcheck="false" placeholder="Type dev command (e.g. help, god, devroom, rollweapon, tp)..." />
        <button type="button" class="dev-send" id="dev-console-send">Run</button>
      </div>
    `;

    document.body.appendChild(this.el);
    this.logEl = document.getElementById('dev-console-log');
    this.inputEl = document.getElementById('dev-console-input');
    this.autoEl = document.getElementById('dev-console-auto');
    this.sendBtn = document.getElementById('dev-console-send');

    // Initial greeting
    this.log('Mossling Comprehensive Developer Testing Facility Active.', 'gold');
    this.log('Type "/help" for category index or click quick shortcuts above.', 'dim');
  }

  bindEvents() {
    // Obscure activation keys:
    // 1. Backquote (`) / Tilde (~)
    // 2. Ctrl + Shift + D
    // 3. Forward Slash (/)
    window.addEventListener('keydown', (e) => {
      const isSlashTrigger = e.key === '/' && !this.isOpen && document.activeElement?.tagName !== 'INPUT';
      if (e.code === 'Backquote' || (e.ctrlKey && e.shiftKey && e.code === 'KeyD') || isSlashTrigger) {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
        return;
      }

      if (this.isOpen && e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    }, true);

    const stopPropagation = (e) => {
      if (this.isOpen) e.stopPropagation();
    };

    this.inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();

      if (e.key === 'Enter') {
        e.preventDefault();
        this.runCurrentInput();
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory(-1);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory(1);
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        this.applyAutocomplete();
        return;
      }
    });

    this.inputEl.addEventListener('keyup', stopPropagation);
    this.inputEl.addEventListener('input', () => this.updateAutocomplete());
    this.sendBtn.addEventListener('click', () => this.runCurrentInput());

    // Toolbar buttons
    this.el.querySelectorAll('.dev-btn, .dev-cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cmd = btn.dataset.cmd;
        if (cmd) {
          this.log(`> ${cmd}`, 'cyan');
          DevCommands.execute(this.game, cmd, (msg, type) => this.log(msg, type));
          this.inputEl.focus();
        }
      });
    });

    // Obscure mouse activation: Clicking 5 times rapidly on the bottom-right version footer
    let clickCount = 0;
    let lastClickTime = 0;
    window.addEventListener('click', (e) => {
      if (e.clientX > window.innerWidth - 80 && e.clientY > window.innerHeight - 60) {
        const now = Date.now();
        if (now - lastClickTime < 600) {
          clickCount++;
          if (clickCount >= 5) {
            clickCount = 0;
            this.toggle();
          }
        } else {
          clickCount = 1;
        }
        lastClickTime = now;
      }
    });
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.el.classList.remove('hidden');
    this.inputEl.value = '';
    this.inputEl.focus();
    this.commandList = Object.keys(COMMAND_DEFINITIONS);

    // Lock game input so WASD / abilities don't fire
    if (this.game && this.game.input) {
      this.game.input.paused = true;
      this.game.input.keys.clear();
      this.game.input.taps.clear();
    }
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.autoEl.classList.add('hidden');
    this.inputEl.blur();

    if (this.game && this.game.input) {
      this.game.input.paused = false;
    }
  }

  log(msg, type = 'info') {
    const line = document.createElement('div');
    line.className = `dev-msg dev-${type}`;
    line.textContent = msg;
    this.logEl.appendChild(line);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  runCurrentInput() {
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.log(`> /${text.replace(/^\//, '')}`, 'cyan');
    this.history.push(text);
    this.historyIdx = this.history.length;

    this.inputEl.value = '';
    this.autoEl.classList.add('hidden');

    DevCommands.execute(this.game, text, (msg, type) => this.log(msg, type));
  }

  navigateHistory(direction) {
    if (!this.history.length) return;

    this.historyIdx = Math.max(0, Math.min(this.history.length, this.historyIdx + direction));
    if (this.historyIdx < this.history.length) {
      this.inputEl.value = this.history[this.historyIdx];
    } else {
      this.inputEl.value = '';
    }
  }

  updateAutocomplete() {
    const val = this.inputEl.value.trim().toLowerCase().replace(/^\//, '');
    if (!val) {
      this.autoEl.classList.add('hidden');
      return;
    }

    const matches = this.commandList.filter(c => c.startsWith(val));
    if (!matches.length || (matches.length === 1 && matches[0] === val)) {
      this.autoEl.classList.add('hidden');
      return;
    }

    this.autoEl.innerHTML = matches.slice(0, 10).map(m => `<span class="dev-match">/${m}</span>`).join(' ');
    this.autoEl.classList.remove('hidden');
  }

  applyAutocomplete() {
    const val = this.inputEl.value.trim().toLowerCase().replace(/^\//, '');
    if (!val) return;

    const matches = this.commandList.filter(c => c.startsWith(val));
    if (matches.length) {
      this.inputEl.value = matches[0] + ' ';
      this.autoEl.classList.add('hidden');
    }
  }
}
