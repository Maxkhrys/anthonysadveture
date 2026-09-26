// World pass UI: the discovery card and the map waypoint. Installed after the atlas so it only
// wraps (never replaces) the atlas and minimap drawing.
//  - showReveal({name, level, major}): a parchment title card near the top of the screen. It
//    never pauses play, moves the camera or covers the middle; reduced motion gets no animation.
//  - one user waypoint (flags['w7:waypoint'] = {area, x, z, name}), set or cleared from a place
//    picked in the atlas. Guidance is honest: bearing and straight-line distance, no fake path.
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AREA_NAMES = { overworld: 'Lanternreach', clockwork: 'the Clockwork Garden', rootlight: 'the Rootlight Caverns' };
const bearing = (dx, dz) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];

export function installWorldUI(UI) {
  const P = UI.prototype;
  P.showReveal = function (r) {
    let el = $('region-reveal');
    if (!el) { el = document.createElement('div'); el.id = 'region-reveal'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); $('ui').appendChild(el); }
    el.innerHTML = `<small>${r.major ? 'A new place' : 'Region discovered'}</small><h2>${esc(r.name)}</h2><span>Around level ${r.level} · added to your map and journal</span>`;
    el.className = 'show' + (document.documentElement.classList.contains('reduce-motion') ? ' still' : '');
    clearTimeout(this.revealTimer); this.revealTimer = setTimeout(() => { el.className = 'hide'; }, 4200);
  };
  // ---------------------------------------------------------------- waypoint
  P.onAtlasPick = function (p) { this.atlasPicked = { x: p.x, z: p.z, name: p.name }; this.renderWaypointBar(); };
  P.renderWaypointBar = function () {
    const host = $('tab-map'); if (!host) return;
    let bar = $('atlas-waypoint');
    if (!bar) { bar = document.createElement('div'); bar.id = 'atlas-waypoint'; host.appendChild(bar); }
    const g = this.g, wp = g.flags['w7:waypoint'], pick = this.atlasPicked;
    const here = wp ? (wp.area === g.area.id ? `${esc(wp.name)}` : `${esc(wp.name)} <small>(in ${esc(AREA_NAMES[wp.area] || wp.area)})</small>`) : 'none';
    bar.innerHTML = `<span>Waypoint: <b>${here}</b></span>${pick ? `<button type="button" data-wp="set">Set waypoint: ${esc(pick.name)}</button>` : '<em>Pick a place in the list to set a waypoint.</em>'}${wp ? '<button type="button" data-wp="clear">Clear</button>' : ''}`;
    bar.querySelectorAll('[data-wp]').forEach(b => b.onclick = () => {
      if (b.dataset.wp === 'set' && pick) { g.flags['w7:waypoint'] = { area: g.area.id, x: pick.x, z: pick.z, name: pick.name }; this.toast('Waypoint set', pick.name, 1.6); }
      else g.flags['w7:waypoint'] = null;
      this.atlasIndexKey = null; this.drawBigMap(); this.renderWaypointBar();
    });
  };
  const drawBig = P.drawBigMap;
  P.drawBigMap = function () { drawBig.call(this); if (this.g.area && this.g.player) this.renderWaypointBar(); };
  const drawMini = P.drawMini;
  P.drawMini = function () {
    drawMini.call(this);
    const g = this.g, a = g.area, p = g.player, wp = g.flags && g.flags['w7:waypoint'], cap = $('map-caption');
    if (!a || !p || !wp) return;
    if (wp.area !== a.id) { if (cap) cap.textContent += ` · waypoint in ${AREA_NAMES[wp.area] || wp.area}`; return; }
    const cv = $('minimap'), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
    const x = cv.getContext('2d'), sc = [3, 4.5, 2][this.miniZoom || 0], dx = (wp.x - p.x) * sc, dz = (wp.z - p.z) * sc;
    const k = Math.max(Math.abs(dx) / (W / 2 - 10), Math.abs(dz) / (H / 2 - 10), 1), px = W / 2 + dx / k, pz = H / 2 + dz / k;
    x.save(); x.fillStyle = '#c0503a'; x.strokeStyle = '#3a291b'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(px, pz - 6); x.lineTo(px + 4, pz); x.lineTo(px, pz + 6); x.lineTo(px - 4, pz); x.closePath(); x.fill(); x.stroke(); x.restore();
    const dist = Math.round(Math.hypot(wp.x - p.x, wp.z - p.z));
    if (cap) cap.textContent += dist < 2 ? ' · waypoint reached' : ` · waypoint ${dist} tiles ${bearing(wp.x - p.x, wp.z - p.z)}`;
  };
}
