// Test telemetry, measured from resolved gameplay: the health a target actually lost on each
// hit or damage-over-time tick (never particles or tooltip numbers).
//
// Categories: direct (your attacks and abilities), dot (status ticks such as Burning),
// summon (hits whose source is not you: turrets, familiars, spirits), proc (item and echo
// follow-ups the combat code flags as secondary).
// Windows: "rolling DPS" = damage in the last 5 s / 5; "average DPS" = all damage / seconds
// since the first hit of this test. Crit rate = crits / direct hits (procs, DoT and summons
// are not eligible). Release rate = attack/spell releases per second since the first hit.
// Status uptime = share of test time a target carried any status. Histories are bounded.
const WINDOW = 5, HISTORY = 400;
export class Telemetry {
  constructor(g) { this.g = g; this.reset(); }
  reset() {
    this.t = 0; this.first = null; this.log = []; this.total = 0; this.n = 0;
    this.by = { direct: 0, dot: 0, summon: 0, proc: 0 }; this.count = { direct: 0, dot: 0, summon: 0, proc: 0 };
    this.crits = 0; this.releases = 0; this.statusTime = 0; this.sampleTime = 0; this.max = 0;
  }
  started() { if (this.first == null) this.first = this.t; }
  add(kind, dmg, crit) {
    if (!(dmg > 0)) return;
    this.started();
    this.total += dmg; this.n++; this.by[kind] += dmg; this.count[kind]++; if (kind === 'direct' && crit) this.crits++;
    this.max = Math.max(this.max, dmg);
    this.log.push({ t: this.t, dmg }); if (this.log.length > HISTORY) this.log.shift();
  }
  hit(e, h, dmg, r) {
    if (r !== 'hit') return;
    const p = this.g.player;
    const kind = h.src && h.src !== p ? 'summon' : h.secondary || h.shared ? 'proc' : 'direct';
    this.add(kind, dmg, !!h.crit);
  }
  dot(e, dmg) { this.add('dot', dmg, false); }
  release() { this.started(); this.releases++; }
  tick(dt, targets) {
    this.t += dt;
    if (this.first == null) return;
    this.sampleTime += dt;
    const live = targets.filter(e => !e.dead);
    if (live.some(e => e.status && Object.entries(e.status).some(([k, v]) => typeof v === 'number' && v > 0 && k !== 'burnDps' && k !== 'burnTick'))) this.statusTime += dt;
  }
  summary() {
    const el = this.first == null ? 0 : Math.max(0.001, this.t - this.first);
    const recent = this.log.filter(x => x.t > this.t - WINDOW).reduce((a, x) => a + x.dmg, 0);
    return {
      elapsed: el, total: Math.round(this.total), hits: this.n, maxHit: Math.round(this.max),
      rolling: Math.round(recent / Math.min(WINDOW, Math.max(el, 0.001))), average: Math.round(el ? this.total / el : 0),
      perHit: this.n ? Math.round(this.total / this.n) : 0,
      critRate: this.count.direct ? this.crits / this.count.direct : 0,
      releaseRate: el ? this.releases / el : 0,
      uptime: this.sampleTime ? this.statusTime / this.sampleTime : 0,
      procs: this.count.proc, by: Object.fromEntries(Object.entries(this.by).map(([k, v]) => [k, Math.round(v)])), count: { ...this.count },
    };
  }
}
