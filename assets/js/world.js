/*
 * SKS Infra Projects: the "corridor" world.
 *
 * A single procedural line-drawn landscape that the hero film and the sector
 * journey both fly through. Everything hangs off one design alignment (J),
 * described the way a highway engineer would describe it: curvature and grade
 * as functions of chainage.
 *
 *   chainage (m)   what is built there
 *   -560 ..  560   six-lane expressway
 *    560 ..  680   taper into a two-lane highway with paved shoulders
 *    680 .. 1180   highway climbing through hills
 *   1180 .. 1660   cable-stayed river bridge, steel rail truss alongside
 *   1040 .. 4300   electrified double-track railway (2x25 kV)
 *   1700 .. 3340   twin water mains, treatment works at ~2500
 *   2560 .. 4300   double-circuit transmission line, substation at ~3470
 *   3300 .. 3950   integrated industrial township
 *
 * Units are metres. x = right, y = up, z = forward. Traffic keeps left.
 */

export const INK = 0, BRIGHT = 1, GREEN = 2, BLUE = 3, DIM = 4, AMBER = 5;

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);

/* deterministic pseudo-random so the world is identical on every visit */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* piecewise function through [s, value] knots; eased = smoothstep between knots */
function knots(pts, eased) {
  return (s) => {
    if (s <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (s <= pts[i][0]) {
        const t = (s - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return lerp(pts[i - 1][1], pts[i][1], eased ? smooth(t) : t);
      }
    }
    return pts[pts.length - 1][1];
  };
}

/* ------------------------------------------------------------------------ */
/* Alignment: integrate curvature into a plan, attach a vertical profile     */
/* ------------------------------------------------------------------------ */
export class Alignment {
  constructor(s0, s1, curvature, elevation) {
    const ds = 1;
    const n = Math.ceil(s1 - s0) + 1;
    this.s0 = s0; this.s1 = s1; this.n = n;
    this.x = new Float32Array(n); this.z = new Float32Array(n);
    this.y = new Float32Array(n); this.th = new Float32Array(n);
    let x = 0, z = s0, th = 0;
    for (let i = 0; i < n; i++) {
      const s = s0 + i * ds;
      this.x[i] = x; this.z[i] = z; this.th[i] = th; this.y[i] = elevation(s);
      const k = curvature(s + 0.5);
      const thMid = th + k * 0.5;
      x += Math.sin(thMid); z += Math.cos(thMid); th += k;
    }
  }
  /* world position at chainage s, `lat` metres to the right, `h` metres above the profile */
  pos(s, lat = 0, h = 0, out = [0, 0, 0]) {
    const f = clamp(s - this.s0, 0, this.n - 1.001);
    const i = f | 0, t = f - i;
    const th = lerp(this.th[i], this.th[i + 1], t);
    out[0] = lerp(this.x[i], this.x[i + 1], t) + lat * Math.cos(th);
    out[1] = lerp(this.y[i], this.y[i + 1], t) + h;
    out[2] = lerp(this.z[i], this.z[i + 1], t) - lat * Math.sin(th);
    return out;
  }
  /* same, but `y` is absolute rather than relative to the road profile */
  ground(s, lat = 0, y = 0, out = [0, 0, 0]) {
    this.pos(s, lat, 0, out); out[1] = y; return out;
  }
  heading(s) {
    const f = clamp(s - this.s0, 0, this.n - 1.001);
    const i = f | 0;
    return lerp(this.th[i], this.th[i + 1], f - i);
  }
  elev(s) {
    const f = clamp(s - this.s0, 0, this.n - 1.001);
    const i = f | 0;
    return lerp(this.y[i], this.y[i + 1], f - i);
  }
}

/* ------------------------------------------------------------------------ */
/* Geometry builder                                                          */
/* ------------------------------------------------------------------------ */
const CHUNK = 14; // points per culling chunk

class Builder {
  constructor() {
    this.p = [];        // flat xyz
    this.c = [];        // chunks: start, count, style, width, alpha, cx, cy, cz, r
    this.flows = [];
    this.lights = [];
  }
  /* pts: array of [x,y,z]; w = physical width in metres; a = alpha multiplier */
  line(pts, style = INK, w = 0.1, a = 1) {
    if (pts.length < 2) return;
    for (let i = 0; i < pts.length - 1; i += CHUNK - 1) {
      const end = Math.min(i + CHUNK, pts.length);
      const start = this.p.length / 3;
      let cx = 0, cy = 0, cz = 0;
      for (let j = i; j < end; j++) {
        const q = pts[j];
        this.p.push(q[0], q[1], q[2]);
        cx += q[0]; cy += q[1]; cz += q[2];
      }
      const m = end - i;
      cx /= m; cy /= m; cz /= m;
      let r = 0;
      for (let j = i; j < end; j++) {
        const q = pts[j];
        r = Math.max(r, Math.hypot(q[0] - cx, q[1] - cy, q[2] - cz));
      }
      this.c.push(start, m, style, w, a, cx, cy, cz, r);
      if (end === pts.length) break;
    }
  }
  seg(a, b, style, w, al) { this.line([a, b], style, w, al); }
  /* horizontal ring */
  ring(c, r, n, style, w, a, wobble) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const f = (i / n) * TAU;
      const rr = wobble ? r * wobble(f) : r;
      pts.push([c[0] + Math.cos(f) * rr, c[1], c[2] + Math.sin(f) * rr]);
    }
    this.line(pts, style, w, a);
  }
  /* axis-aligned-to-heading wireframe box; origin = centre of base */
  box(c, th, lx, lz, h, style, w, a, roof) {
    const cs = Math.cos(th), sn = Math.sin(th);
    const P = (dx, dz, dy) => [c[0] + dx * cs + dz * sn, c[1] + dy, c[2] - dx * sn + dz * cs];
    const x = lx / 2, z = lz / 2;
    const b0 = P(-x, -z, 0), b1 = P(x, -z, 0), b2 = P(x, z, 0), b3 = P(-x, z, 0);
    const t0 = P(-x, -z, h), t1 = P(x, -z, h), t2 = P(x, z, h), t3 = P(-x, z, h);
    this.line([b0, b1, b2, b3, b0], style, w, a * 0.8);
    this.line([t0, t1, t2, t3, t0], style === INK ? BRIGHT : style, w * 1.2, a * 0.92);
    this.seg(b0, t0, style, w, a); this.seg(b1, t1, style, w, a);
    this.seg(b2, t2, style, w, a); this.seg(b3, t3, style, w, a);
    if (roof === 'gable') {
      const r0 = P(0, -z, h + lx * 0.16), r1 = P(0, z, h + lx * 0.16);
      this.line([t0, r0, t1], style, w, a); this.line([t3, r1, t2], style, w, a);
      this.seg(r0, r1, style, w, a);
    } else if (roof === 'saw') {
      const teeth = Math.max(2, Math.round(lx / 14));
      for (let i = 0; i < teeth; i++) {
        const xa = -x + (i / teeth) * lx, xb = -x + ((i + 1) / teeth) * lx;
        const pa = P(xa, -z, h), pk = P(xb, -z, h + 3.4), qa = P(xa, z, h), qk = P(xb, z, h + 3.4);
        this.line([pa, pk, P(xb, -z, h)], style, w, a * 0.9);
        this.line([qa, qk, P(xb, z, h)], style, w, a * 0.9);
        this.seg(pk, qk, style, w, a * 0.7);
      }
    }
    return P;
  }
  /* upright cylinder */
  drum(c, r, h0, h1, n, style, w, a, ribs = 8) {
    this.ring([c[0], c[1] + h0, c[2]], r, n, style, w, a * 0.8);
    this.ring([c[0], c[1] + h1, c[2]], r, n, style, w, a);
    for (let i = 0; i < ribs; i++) {
      const f = (i / ribs) * TAU;
      const x = c[0] + Math.cos(f) * r, z = c[2] + Math.sin(f) * r;
      this.seg([x, c[1] + h0, z], [x, c[1] + h1, z], style, w, a * 0.7);
    }
  }
  /* a path that light pulses travel along */
  flow(pts, o) {
    const n = pts.length;
    const p = new Float32Array(n * 3), cum = new Float32Array(n);
    let len = 0;
    for (let i = 0; i < n; i++) {
      p[i * 3] = pts[i][0]; p[i * 3 + 1] = pts[i][1]; p[i * 3 + 2] = pts[i][2];
      if (i) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
      cum[i] = len;
    }
    const mid = pts[n >> 1];
    let r = 0;
    for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(pts[i][0] - mid[0], pts[i][1] - mid[1], pts[i][2] - mid[2]));
    this.flows.push({ p, cum, n, len, c: mid, r, style: o.style, w: o.w || 0.3, speed: o.speed, tail: o.tail || 20, pulses: o.pulses, a: o.a || 1, closed: !!o.closed, dot: o.dot !== false });
  }
  light(p, style = AMBER, size = 0.35, a = 1, blink = 0) { this.lights.push(p[0], p[1], p[2], style, size, a, blink); }
  finish() {
    return { points: new Float32Array(this.p), chunks: new Float32Array(this.c), flows: this.flows, lights: new Float32Array(this.lights) };
  }
}

/* sample a line parallel to the alignment. lat / h may be numbers or functions of s */
function along(A, s0, s1, lat, h, step = 4) {
  const fl = typeof lat === 'function' ? lat : () => lat;
  const fh = typeof h === 'function' ? h : () => h;
  const pts = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= n; i++) {
    const s = lerp(s0, s1, i / n);
    pts.push(A.pos(s, fl(s), fh(s)));
  }
  return pts;
}
function dashed(b, A, s0, s1, lat, h, dash, gap, style, w, a) {
  const fl = typeof lat === 'function' ? lat : () => lat;
  for (let s = s0; s < s1; s += dash + gap) {
    const e = Math.min(s + dash, s1);
    b.seg(A.pos(s, fl(s), h), A.pos(e, fl(e), h), style, w, a);
  }
}
/* evenly spaced pulse phases along a flow, with a little irregularity */
function phases(len, spacing, rand) {
  const out = [];
  for (let s = rand() * spacing; s < len; s += spacing * (0.55 + rand() * 0.9)) out.push(s);
  return out;
}

/* ------------------------------------------------------------------------ */
/* The design alignment                                                      */
/* ------------------------------------------------------------------------ */
const S_START = -640, S_END = 4400;

const curvature = knots([
  [-640, 0], [240, 0], [380, 1 / 1500], [600, 1 / 1500], [700, 0],
  [730, 0], [790, -1 / 250], [850, -1 / 250], [935, 1 / 230], [1010, 1 / 230], [1085, 0],
  [1740, 0], [1840, 1 / 950], [2040, 1 / 950], [2140, 0],
  [2620, 0], [2720, -1 / 1300], [3000, -1 / 1300], [3100, 0], [4400, 0],
]);
const elevation = knots([
  [-640, 0], [600, 0], [720, 3.5], [820, 10], [900, 12], [1000, 8.5], [1090, 10],
  [1200, 18], [1640, 18], [1790, 2.5], [1900, 0], [4400, 0],
], true);

export const J = new Alignment(S_START, S_END, curvature, elevation);

const RAIL_LAT = 46;                                      // rail corridor centre, right of the road
const railElev = knots([[1000, 1], [1150, 1], [1235, 7], [1610, 7], [1700, 1], [4400, 1]], true);
const WATER_Y = -5;

/* ------------------------------------------------------------------------ */
/* Features                                                                  */
/* ------------------------------------------------------------------------ */
const LW = 3.6, MED = 2.6;

function expressway(b, rand) {
  const s0 = -560, s1 = 560, t1 = 680;         // taper ends at t1
  const k = (s) => smooth(clamp((s - s1) / (t1 - s1), 0, 1));
  for (const sg of [-1, 1]) {
    const inner = (s) => sg * lerp(MED, 0, k(s));
    const outer = (s) => sg * lerp(MED + 3 * LW, 3.5, k(s));
    const shoulder = (s) => sg * lerp(MED + 3 * LW + 2.6, 6, k(s));
    const rail = (s) => sg * lerp(MED + 3 * LW + 3.3, 6.5, k(s));
    b.line(along(J, s0, t1, inner, 0.03), BRIGHT, 0.17, 0.85);
    b.line(along(J, s0, t1, outer, 0.03), BRIGHT, 0.17, 0.8);
    b.line(along(J, s0, t1, shoulder, 0), INK, 0.1, 0.5);
    b.line(along(J, s0, s1 + 40, rail, 0.78), INK, 0.09, 0.5);
    for (let s = s0; s < s1 + 40; s += 8) b.seg(J.pos(s, rail(s), 0), J.pos(s, rail(s), 0.78), INK, 0.08, 0.3);
    dashed(b, J, s0, s1 + 20, sg * (MED + LW), 0.03, 3.6, 8.4, BRIGHT, 0.15, 0.9);
    dashed(b, J, s0, s1 - 20, sg * (MED + 2 * LW), 0.03, 3.6, 8.4, BRIGHT, 0.15, 0.9);
    b.line(along(J, s0, s1, sg * (MED + 3 * LW + 9), -2.4, 8), DIM, 0.1, 0.55);   // embankment toe

    /* traffic: left carriageway runs with us (green), right carriageway comes at us (white) */
    for (let lane = 0; lane < 3; lane++) {
      const lat = sg * (MED + LW * (lane + 0.5));
      const path = along(J, s0, s1 + 60, (s) => lerp(lat, sg * 1.75, k(s)), 0.55, 3);
      if (sg > 0) path.reverse();
      const speed = 25 + lane * -2.5 + rand() * 3 + (lane === 0 ? 6 : 0);
      b.flow(path, { style: sg < 0 ? GREEN : BRIGHT, w: 0.34, speed, tail: 20 + rand() * 10, pulses: phases(s1 - s0 + 60, 74 + lane * 26, rand), a: sg < 0 ? 1 : 0.92 });
    }
  }
  /* median: barrier + lighting masts */
  b.line(along(J, s0, s1, 0, 0.9), INK, 0.1, 0.42);
  for (let s = s0 + 22; s < s1 - 10; s += 46) {
    const base = J.pos(s, 0, 0), top = J.pos(s, 0, 11.6);
    b.seg(base, top, INK, 0.16, 0.75);
    const l = J.pos(s, -2.5, 12.2), r = J.pos(s, 2.5, 12.2);
    b.line([l, top, r], INK, 0.12, 0.75);
    b.light(l, AMBER, 0.34, 0.95); b.light(r, AMBER, 0.34, 0.95);
  }
  gantry(b, 318);
  gantry(b, -196);
}

/* overhead sign gantry spanning the full formation */
function gantry(b, s) {
  const half = MED + 3 * LW + 3.9, top = 8.3, bot = 7.1;
  for (const sg of [-1, 1]) {
    b.seg(J.pos(s, sg * half, 0), J.pos(s, sg * half, top), INK, 0.22, 0.9);
    b.seg(J.pos(s, sg * (half + 0.9), 0), J.pos(s, sg * (half + 0.9), top), INK, 0.16, 0.6);
  }
  b.seg(J.pos(s, -half - 0.9, top), J.pos(s, half + 0.9, top), INK, 0.2, 0.9);
  b.seg(J.pos(s, -half, bot), J.pos(s, half, bot), INK, 0.18, 0.85);
  const bays = 16;
  for (let i = 0; i <= bays; i++) {
    const a = lerp(-half, half, i / bays);
    b.seg(J.pos(s, a, bot), J.pos(s, a, top), INK, 0.1, 0.55);
    if (i < bays) {
      const c = lerp(-half, half, (i + 1) / bays);
      b.seg(J.pos(s, a, i % 2 ? top : bot), J.pos(s, c, i % 2 ? bot : top), INK, 0.08, 0.45);
    }
  }
  /* sign faces over the carriageway that reads them (ours: the left) */
  for (const [c, wd] of [[-(MED + LW * 0.9), 6.4], [-(MED + LW * 2.3), 5.2]]) {
    const y0 = bot - 2.9, y1 = bot - 0.25, x0 = c - wd / 2, x1 = c + wd / 2;
    const p = (x, y) => J.pos(s - 0.3, x, y);
    b.line([p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1), p(x0, y0)], GREEN, 0.12, 0.95);
    b.seg(p(x0 + 0.7, y1 - 0.75), p(x1 - 1.6, y1 - 0.75), GREEN, 0.1, 0.6);
    b.seg(p(x0 + 0.7, y1 - 1.45), p(x1 - 2.6, y1 - 1.45), GREEN, 0.1, 0.45);
    const ax = x1 - 0.95;
    b.line([p(ax, y1 - 0.5), p(ax, y0 + 0.45)], GREEN, 0.1, 0.8);
    b.line([p(ax - 0.42, y0 + 0.9), p(ax, y0 + 0.45), p(ax + 0.42, y0 + 0.9)], GREEN, 0.1, 0.8);
  }
}

function highway(b, rand) {
  const s0 = 680, s1 = 3290;
  b.line(along(J, s0, s1, -3.5, 0.03), BRIGHT, 0.16, 0.8);
  b.line(along(J, s0, s1, 3.5, 0.03), BRIGHT, 0.16, 0.8);
  b.line(along(J, s0, s1, -6, 0), INK, 0.1, 0.5);
  b.line(along(J, s0, s1, 6, 0), INK, 0.1, 0.5);
  dashed(b, J, 640, s1, 0, 0.03, 3, 6, BRIGHT, 0.15, 0.9);
  /* delineator posts through the hills, guard rail on the outside of each bend */
  for (let s = 700; s < 1180; s += 18) {
    for (const sg of [-1, 1]) b.seg(J.pos(s, sg * 6.7, 0), J.pos(s, sg * 6.7, 1.05), INK, 0.09, 0.5);
  }
  b.line(along(J, 720, 1180, -6.5, 0.78, 6), INK, 0.09, 0.5);
  b.line(along(J, 720, 1180, 6.5, 0.78, 6), INK, 0.09, 0.5);
  /* embankment: ribs falling 1-in-2 to natural ground, and the toe line they meet */
  const fill = (s) => Math.max(0, J.elev(s));
  for (const sg of [-1, 1]) {
    for (const [a, e] of [[640, 1190], [1650, 1900]]) {
      for (const k of [0.34, 0.67, 1]) {
        b.line(along(J, a, e, (s) => sg * (6.5 + fill(s) * 1.9 * k), (s) => -fill(s) * k, 6), DIM, 0.1, k === 1 ? 0.75 : 0.4);
      }
      for (let s = a + 30; s < e - 10; s += 44) {
        const f = fill(s);
        if (f > 2) b.seg(J.pos(s, sg * 6.5, 0), J.pos(s, sg * (6.5 + f * 1.9), -f), DIM, 0.08, 0.34);
      }
    }
  }
  /* traffic */
  for (const sg of [-1, 1]) {
    const path = along(J, 640, s1, sg * 1.75, 0.55, 3);
    if (sg > 0) path.reverse();
    b.flow(path, { style: sg < 0 ? GREEN : BRIGHT, w: 0.34, speed: 21 + rand() * 3, tail: 18, pulses: phases(s1 - 640, 96, rand) });
  }
}

/* wireframe hills: stacked contour rings */
function hills(b, rand) {
  const list = [
    [716, -84, 62, 34], [764, 108, 82, 52], [842, -136, 100, 66], [910, 92, 74, 46], [992, -78, 60, 34],
    [1052, 124, 88, 48], [884, 244, 126, 84], [800, -272, 136, 76], [1012, -224, 108, 58], [690, 220, 98, 44],
    [1112, -156, 72, 30], [934, 398, 156, 96], [640, -210, 90, 40],
  ];
  for (const [s, lat, R, H] of list) {
    const c = J.ground(s, lat, 0);
    const p1 = rand() * TAU, p2 = rand() * TAU, e1 = 0.1 + rand() * 0.14, e2 = 0.05 + rand() * 0.09;
    const dx = (rand() - 0.5) * R * 0.35, dz = (rand() - 0.5) * R * 0.35;
    const levels = Math.round(H / 4.6);
    for (let k = 0; k < levels; k++) {
      const t = k / levels;
      const r = R * Math.pow(1 - t, 0.72);
      b.ring([c[0] + dx * t, t * H, c[2] + dz * t], r, Math.max(30, Math.round(r * 0.85)), k % 4 === 0 ? INK : DIM, 0.13, 0.5 + 0.48 * t,
        (f) => 1 + e1 * Math.sin(2 * f + p1) + e2 * Math.sin(3 * f + p2 + t * 2));
    }
  }
}

function bridge(b, rand) {
  const sA = 1180, sB = 1660, p1 = 1300, p2 = 1540, half = 6.6;
  /* deck: top edges, soffit edges, diaphragms, parapet */
  for (const sg of [-1, 1]) {
    b.line(along(J, sA, sB, sg * half, 0.04), BRIGHT, 0.2, 0.9);
    b.line(along(J, sA, sB, sg * (half - 0.8), -2.1), INK, 0.14, 0.65);
    b.line(along(J, sA, sB, sg * half, 1.1), INK, 0.08, 0.55);
    for (let s = sA; s <= sB; s += 6) b.seg(J.pos(s, sg * half, 0.04), J.pos(s, sg * half, 1.1), INK, 0.07, 0.3);
  }
  for (let s = sA; s <= sB; s += 12) {
    b.line([J.pos(s, -half, 0.04), J.pos(s, -half + 0.8, -2.1), J.pos(s, half - 0.8, -2.1), J.pos(s, half, 0.04)], INK, 0.09, 0.42);
  }
  /* approach piers */
  for (const s of [1180, 1220, 1260, 1580, 1620, 1660]) {
    const y0 = s > 1262 && s < 1578 ? WATER_Y : 0;
    for (const sg of [-1, 1]) b.seg(J.ground(s, sg * 2.4, y0), J.pos(s, sg * 2.4, -3.2), INK, 0.2, 0.75);
    b.line([J.pos(s, -2.4, -3.2), J.pos(s, -5.4, -2.1), J.pos(s, 5.4, -2.1), J.pos(s, 2.4, -3.2), J.pos(s, -2.4, -3.2)], INK, 0.16, 0.7);
  }
  /* pylons: H-frames leaning in towards the head */
  const PH = 64;
  for (const sp of [p1, p2]) {
    const legLat = (h) => lerp(9.4, 4.6, clamp(h / PH, 0, 1));
    for (const sg of [-1, 1]) {
      for (const ds of [-1.5, 1.5]) {
        const pts = [];
        pts.push(J.ground(sp + ds, sg * 10.4, WATER_Y));
        for (let h = 0; h <= PH; h += 8) pts.push(J.pos(sp + ds, sg * legLat(h), h));
        b.line(pts, BRIGHT, 0.3, 0.9);
      }
      b.seg(J.pos(sp - 1.5, sg * legLat(PH), PH), J.pos(sp + 1.5, sg * legLat(PH), PH), BRIGHT, 0.3, 0.9);
      b.light(J.pos(sp, sg * legLat(PH), PH + 1.2), GREEN, 0.5, 1, 1);
    }
    for (const h of [-3.4, 30, 58]) {
      for (const ds of [-1.5, 1.5]) b.seg(J.pos(sp + ds, -legLat(Math.max(h, 0)), h), J.pos(sp + ds, legLat(Math.max(h, 0)), h), BRIGHT, 0.26, 0.8);
    }
    /* pile cap at water level */
    const cap = [J.ground(sp - 6, -13, WATER_Y + 1.2), J.ground(sp + 6, -13, WATER_Y + 1.2), J.ground(sp + 6, 13, WATER_Y + 1.2), J.ground(sp - 6, 13, WATER_Y + 1.2)];
    b.line([...cap, cap[0]], INK, 0.16, 0.6);
    /* stay cables, semi-fan */
    for (const dir of [-1, 1]) {
      for (let k = 0; k < 10; k++) {
        const sAnch = sp + dir * (14 + k * 10.6);
        const h = 31 + k * 3.05;
        for (const sg of [-1, 1]) {
          b.seg(J.pos(sp + dir * 0.8, sg * legLat(h), h), J.pos(sAnch, sg * half, 0.3), BRIGHT, 0.13, 0.62);
        }
      }
    }
  }
  /* river: lines that run with the current, plus the two banks */
  const bank = (s, ph) => (lat) => s + 9 * Math.sin(lat / 70 + ph) + 5 * Math.sin(lat / 23 + ph * 2.3);
  const riverLine = (sBase, ph, a, style, w) => {
    const f = bank(sBase, ph), pts = [];
    for (let lat = -640; lat <= 640; lat += 16) pts.push(J.ground(f(lat), lat, WATER_Y));
    b.line(pts, style, w, a);
    return pts;
  };
  riverLine(1262, 0.4, 0.6, INK, 0.16); riverLine(1578, 2.1, 0.6, INK, 0.16);
  for (let i = 0; i < 13; i++) {
    const pts = riverLine(1284 + i * 23, i * 0.9, 0.34 + (i % 3) * 0.1, BLUE, 0.14);
    if (i % 2 === 0) b.flow(pts, { style: BLUE, w: 0.5, speed: 7 + rand() * 4, tail: 38, pulses: phases(1280, 210, rand), a: 0.8, dot: false });
  }

  /* steel rail truss alongside: six Warren through-spans */
  const tA = 1235, span = 62.5, panels = 8, th = 9.2, tw = 3.5;
  const R = (s, lat, h) => J.ground(s, RAIL_LAT + lat, railElev(s) + h);
  for (let i = 0; i < 6; i++) {
    const a = tA + i * span;
    for (const sg of [-1, 1]) {
      const lat = sg * (2.65 + tw);
      b.seg(R(a, lat, 0), R(a + span, lat, 0), INK, 0.24, 0.85);
      const pw = span / panels;
      b.line([R(a, lat, 0), R(a + pw, lat, th), R(a + span - pw, lat, th), R(a + span, lat, 0)], INK, 0.22, 0.85);
      for (let k = 1; k < panels; k++) {
        b.seg(R(a + k * pw, lat, 0), R(a + k * pw, lat, th), INK, 0.12, 0.55);
        if (k < panels - 1) b.seg(R(a + k * pw, lat, k % 2 ? th : 0), R(a + (k + 1) * pw, lat, k % 2 ? 0 : th), INK, 0.12, 0.55);
      }
    }
    const pw = span / panels;
    for (let k = 1; k < panels; k++) {
      b.seg(R(a + k * pw, -(2.65 + tw), th), R(a + k * pw, 2.65 + tw, th), INK, 0.1, 0.45);
      if (k < panels - 1) b.seg(R(a + k * pw, (k % 2 ? 1 : -1) * (2.65 + tw), th), R(a + (k + 1) * pw, (k % 2 ? -1 : 1) * (2.65 + tw), th), INK, 0.08, 0.35);
    }
  }
  for (let i = 0; i <= 6; i++) {
    const s = tA + i * span;
    for (const sg of [-1, 1]) b.seg(J.ground(s, RAIL_LAT + sg * 4.2, WATER_Y), R(s, sg * 4.2, -1.2), INK, 0.2, 0.7);
    b.seg(R(s, -6.6, -1.2), R(s, 6.6, -1.2), INK, 0.16, 0.7);
  }
}

function railway(b, rand) {
  const s0 = 1040, s1 = 4300;
  const R = (s, lat, h) => J.ground(s, RAIL_LAT + lat, railElev(s) + h);
  const run = (a, e, lat, h, step) => {
    const pts = [];
    const n = Math.ceil((e - a) / step);
    for (let i = 0; i <= n; i++) { const s = lerp(a, e, i / n); pts.push(R(s, lat, h)); }
    return pts;
  };
  const tracks = [-2.65, 2.65];
  for (const c of tracks) {
    b.line(run(s0, s1, c - 0.84, 0.2, 4), BRIGHT, 0.08, 0.85);
    b.line(run(s0, s1, c + 0.84, 0.2, 4), BRIGHT, 0.08, 0.85);
    for (let s = 1640; s < 2760; s += 2.6) b.seg(R(s, c - 1.35, 0.08), R(s, c + 1.35, 0.08), INK, 0.12, 0.3);
  }
  b.line(run(s0, s1, -7, -1, 8), DIM, 0.1, 0.6);
  b.line(run(s0, s1, 7, -1, 8), DIM, 0.1, 0.6);

  /* overhead equipment: masts, cantilevers, catenary + contact wire, droppers, AT feeder */
  const SPAN = 54, first = 1066;
  const onTruss = (s) => s > 1228 && s < 1616;
  const supports = [];
  for (let s = first, i = 0; s < s1; s += SPAN, i++) supports.push([s, i]);
  for (const [s, i] of supports) {
    const stagger = i % 2 ? 0.22 : -0.22;
    for (const sg of [-1, 1]) {
      const c = sg * 2.65, m = sg * 5.75;
      if (!onTruss(s)) {
        b.seg(R(s, m, -0.4), R(s, m, 9.5), INK, 0.2, 0.9);
        b.seg(R(s, m, 8.5), R(s, c, 7.05), INK, 0.09, 0.8);                       // stay
        b.seg(R(s, m, 6.3), R(s, c, 7.05), INK, 0.1, 0.8);                        // bracket tube
        b.seg(R(s, m, 6.0), R(s, c + stagger - sg * 0.9, 5.95), INK, 0.08, 0.7);  // register arm
        b.seg(R(s, c + stagger - sg * 0.9, 5.95), R(s, c + stagger, 5.62), INK, 0.07, 0.7);
        b.seg(R(s, m, 9.2), R(s, m + sg * 1.0, 9.2), INK, 0.09, 0.8);             // feeder bracket
      }
    }
  }
  for (const sg of [-1, 1]) {
    const c = sg * 2.65, m = sg * 5.75;
    const contact = [], mess = [], feeder = [];
    for (let j = 0; j < supports.length - 1; j++) {
      const [sa, i] = supports[j], sb = supports[j + 1][0];
      const stA = i % 2 ? 0.22 : -0.22, stB = -stA;
      for (let q = 0; q < 8; q++) {
        const t = q / 8, s = lerp(sa, sb, t);
        const sag = 4 * t * (1 - t);
        contact.push(R(s, c + lerp(stA, stB, t), 5.62));
        mess.push(R(s, c + lerp(stA, stB, t) * 0.4, 7.05 - 1.02 * sag));
        feeder.push(R(s, m + sg * 1.0, 9.05 - 0.75 * sag));
      }
      if (sa > 1560 && sa < 2800) {
        for (const t of [0.14, 0.32, 0.5, 0.68, 0.86]) {
          const s = lerp(sa, sb, t), sag = 4 * t * (1 - t), lt = c + lerp(stA, stB, t);
          b.seg(R(s, lt, 5.62), R(s, c + lerp(stA, stB, t) * 0.4, 7.05 - 1.02 * sag), INK, 0.05, 0.6);
        }
      }
    }
    b.line(contact, BRIGHT, 0.09, 0.95);
    b.line(mess, INK, 0.08, 0.9);
    b.line(feeder, GREEN, 0.08, 0.9);
    b.flow(feeder, { style: GREEN, w: 0.22, speed: 95, tail: 46, pulses: phases(s1 - s0, 520, rand), a: 0.95 });
  }
  /* a colour-light signal showing proceed */
  const sig = 1912;
  b.seg(R(sig, -8.4, -0.4), R(sig, -8.4, 5.4), INK, 0.16, 0.85);
  b.line([R(sig, -8.9, 5.4), R(sig, -7.9, 5.4), R(sig, -7.9, 7.5), R(sig, -8.9, 7.5), R(sig, -8.9, 5.4)], INK, 0.1, 0.85);
  b.light(R(sig - 0.2, -8.4, 6.05), GREEN, 0.34, 1);
  /* train: three stacked streaks read as a lit rake at speed */
  const trainPath = run(s0, s1, 2.65, 0, 3);
  for (const [h, style, w, a] of [[1.1, BRIGHT, 0.5, 0.75], [2.5, BRIGHT, 0.9, 1], [3.9, BLUE, 0.4, 0.8]]) {
    b.flow(trainPath.map((p) => [p[0], p[1] + h, p[2]]), { style, w, speed: 44, tail: 250, pulses: [0, 1500], a, dot: h === 2.5 });
  }
}

function water(b, rand) {
  /* twin mains beside the road */
  const s0 = 1700, s1 = 3340, DIA = 1.15;
  for (const lat of [-22, -27]) {
    for (const [dl, dh] of [[0, DIA], [0, -DIA], [DIA, 0], [-DIA, 0]]) {
      b.line(along(J, s0, s1, lat + dl, 1.9 + dh, 6), BLUE, 0.08, dh > 0 ? 0.75 : 0.45);
    }
    for (let s = 2120; s < 2840; s += 7) {
      const th = J.heading(s), c = J.pos(s, lat, 1.9), pts = [];
      for (let i = 0; i <= 14; i++) {
        const f = (i / 14) * TAU;
        pts.push([c[0] + Math.cos(th) * Math.cos(f) * DIA, c[1] + Math.sin(f) * DIA, c[2] - Math.sin(th) * Math.cos(f) * DIA]);
      }
      b.line(pts, BLUE, 0.07, 0.5);
      if (((s - 2120) / 7) % 3 === 0) {
        b.line([J.pos(s, lat - 1.3, 0), J.pos(s, lat - 0.5, 0.9), J.pos(s, lat + 0.5, 0.9), J.pos(s, lat + 1.3, 0)], INK, 0.09, 0.45);
      }
    }
    b.flow(along(J, s0, s1, lat, 1.9, 4), { style: BLUE, w: 0.6, speed: 15, tail: 24, pulses: phases(s1 - s0, 88, rand), a: 0.95, dot: false });
  }
  /* treatment works */
  const P = (s, lat, y = 0) => J.ground(s, lat, y);
  const fence = [P(2372, -40), P(2664, -40), P(2664, -236), P(2372, -236), P(2372, -40)];
  b.line(fence, DIM, 0.1, 0.8);
  for (const [s, lat] of [[2438, -84], [2504, -128], [2438, -176]]) {
    const c = P(s, lat);
    b.drum(c, 21, 0, 3.2, 44, BLUE, 0.12, 0.8, 22);
    b.ring([c[0], 3.2, c[2]], 19.4, 44, BLUE, 0.07, 0.5);
    b.ring([c[0], 2.6, c[2]], 6.2, 24, BLUE, 0.09, 0.7);
    b.drum(c, 1.6, 0, 4.6, 10, INK, 0.1, 0.7, 4);
    const th = rand() * TAU;
    b.line([[c[0] + Math.cos(th) * 21, 4.2, c[2] + Math.sin(th) * 21], [c[0], 4.6, c[2]]], INK, 0.2, 0.85);
    b.line([[c[0] + Math.cos(th) * 21, 3.2, c[2] + Math.sin(th) * 21], [c[0] + Math.cos(th) * 21, 4.2, c[2] + Math.sin(th) * 21]], INK, 0.14, 0.7);
    for (const [r, n, sp] of [[13.5, 3, 5], [18, 4, 3.4]]) {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const f = (i / 40) * TAU; pts.push([c[0] + Math.cos(f) * r, 2.7, c[2] + Math.sin(f) * r]); }
      const len = TAU * r, ph = [];
      for (let q = 0; q < n; q++) ph.push((q / n) * len);
      b.flow(pts, { style: BLUE, w: 0.5, speed: sp, tail: 16, pulses: ph, closed: true, a: 0.9, dot: false });
    }
    b.seg(P(s, -27), P(s, lat + 21), BLUE, 0.1, 0.45);
  }
  /* filter house: a grid of beds */
  const th = J.heading(2580);
  const fc = P(2580, -92);
  const Pf = b.box(fc, th, 30, 72, 4.2, INK, 0.12, 0.8);
  for (let i = 1; i < 6; i++) b.seg(Pf(-15, -36 + i * 12, 4.2), Pf(15, -36 + i * 12, 4.2), INK, 0.08, 0.5);
  b.seg(Pf(0, -36, 4.2), Pf(0, 36, 4.2), INK, 0.08, 0.5);
  b.box(P(2652, -112), J.heading(2652), 18, 26, 7.5, INK, 0.12, 0.8, 'gable');
  b.box(P(2630, -196), J.heading(2630), 22, 30, 6, INK, 0.12, 0.7);
  /* elevated service reservoir */
  const e = P(2592, -178);
  for (let i = 0; i < 8; i++) {
    const f = (i / 8) * TAU, x = e[0] + Math.cos(f) * 6.2, z = e[2] + Math.sin(f) * 6.2;
    b.seg([x, 0, z], [x, 21, z], INK, 0.2, 0.85);
  }
  for (const h of [7, 14]) b.ring([e[0], h, e[2]], 6.2, 16, INK, 0.1, 0.6);
  b.ring([e[0], 21, e[2]], 6.2, 20, BLUE, 0.12, 0.85);
  b.ring([e[0], 23.4, e[2]], 10, 28, BLUE, 0.12, 0.9);
  b.ring([e[0], 30, e[2]], 10, 28, BLUE, 0.12, 0.9);
  b.ring([e[0], 32.4, e[2]], 6, 20, BLUE, 0.1, 0.8);
  b.ring([e[0], 33.4, e[2]], 1.6, 10, BLUE, 0.1, 0.8);
  for (let i = 0; i < 12; i++) {
    const f = (i / 12) * TAU, cx = Math.cos(f), sz = Math.sin(f);
    b.line([[e[0] + cx * 6.2, 21, e[2] + sz * 6.2], [e[0] + cx * 10, 23.4, e[2] + sz * 10], [e[0] + cx * 10, 30, e[2] + sz * 10], [e[0] + cx * 6, 32.4, e[2] + sz * 6], [e[0] + cx * 1.6, 33.4, e[2] + sz * 1.6]], BLUE, 0.07, 0.5);
  }
  b.light([e[0], 34.4, e[2]], BLUE, 0.4, 1, 1);
}

function tower(b, c, th, H = 46) {
  const cs = Math.cos(th), sn = Math.sin(th);
  /* local: u = across the line (cross-arm direction), v = along the line */
  const P = (u, v, h) => [c[0] + u * cs + v * sn, c[1] + h, c[2] - u * sn + v * cs];
  const half = (h) => (h <= 27 ? lerp(5.4, 1.7, h / 27) : h <= 40 ? lerp(1.7, 1.15, (h - 27) / 13) : lerp(1.15, 0.05, (h - 40) / (H - 40)));
  const levels = [0, 7, 13.2, 18.6, 23.2, 27, 30.2, 33.5, 36.8, 40];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [a, d] of corners) {
    const pts = levels.map((h) => P(a * half(h), d * half(h), h));
    pts.push(P(0, 0, H));
    b.line(pts, INK, 0.2, 0.9);
  }
  for (let i = 0; i < levels.length; i++) {
    const h = levels[i], w = half(h);
    if (i) b.line([P(-w, -w, h), P(w, -w, h), P(w, w, h), P(-w, w, h), P(-w, -w, h)], INK, 0.09, 0.5);
    if (i < levels.length - 1) {
      const h2 = levels[i + 1], w2 = half(h2);
      for (let f = 0; f < 4; f++) {
        const [a0, d0] = corners[f], [a1, d1] = corners[(f + 1) % 4];
        b.seg(P(a0 * w, d0 * w, h), P(a1 * w2, d1 * w2, h2), INK, 0.08, 0.5);
        b.seg(P(a1 * w, d1 * w, h), P(a0 * w2, d0 * w2, h2), INK, 0.08, 0.5);
      }
    }
  }
  const arms = [[27, 8.4], [33.5, 7.3], [40, 6.2]];
  const attach = [];
  for (const [h, reach] of arms) {
    const w = half(h);
    for (const sg of [-1, 1]) {
      const tip = P(sg * reach, 0, h + 0.2);
      b.line([P(sg * w, -w, h), tip, P(sg * w, w, h)], INK, 0.12, 0.85);
      b.line([P(sg * w, -w, h - 2.3), tip, P(sg * w, w, h - 2.3)], INK, 0.09, 0.6);
      const low = P(sg * reach, 0, h - 3.1);
      b.seg(tip, low, AMBER, 0.1, 0.8);            // insulator string
      attach.push(low);
    }
  }
  attach.push(P(0, 0, H));
  b.light(P(0, 0, H + 0.8), AMBER, 0.42, 1, 1);
  return attach;
}

function transmission(b, rand) {
  const LAT = 140;
  const stations = [2560, 2880, 3200, 3520, 3840, 4160];
  let prev = null;
  for (const s of stations) {
    const att = tower(b, J.ground(s, LAT, 0), J.heading(s));
    if (prev) {
      for (let k = 0; k < att.length; k++) {
        const a = prev[k], e = att[k], sag = k === att.length - 1 ? 6.5 : 11.5, pts = [];
        for (let i = 0; i <= 14; i++) {
          const t = i / 14;
          pts.push([lerp(a[0], e[0], t), lerp(a[1], e[1], t) - sag * 4 * t * (1 - t), lerp(a[2], e[2], t)]);
        }
        b.line(pts, k === att.length - 1 ? INK : BRIGHT, 0.06, k === att.length - 1 ? 0.6 : 0.85);
        if (k < att.length - 1 && k % 2 === 0) {
          b.flow(pts, { style: AMBER, w: 0.3, speed: 120, tail: 54, pulses: [rand() * 320], a: 1 });
        }
      }
    }
    prev = att;
  }
  /* substation: gantry bays, busbars, transformers, with a drop from the nearest tower */
  const sc = 3470, lat0 = 92;
  const P = (ds, dl, y) => J.ground(sc + ds, lat0 + dl, y);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      b.seg(P(r * 22, c * 14, 0), P(r * 22, c * 14, 12.5), INK, 0.16, 0.85);
      if (c < 4) {
        b.seg(P(r * 22, c * 14, 12.5), P(r * 22, (c + 1) * 14, 12.5), INK, 0.14, 0.8);
        b.seg(P(r * 22, c * 14, 11), P(r * 22, (c + 1) * 14, 11), INK, 0.08, 0.5);
      }
    }
  }
  for (let c = 0; c < 4; c++) {
    for (const o of [3, 7, 11]) b.line([P(0, c * 14 + o, 9), P(22, c * 14 + o, 8.2), P(44, c * 14 + o, 9), P(66, c * 14 + o, 8.2)], BRIGHT, 0.05, 0.75);
  }
  for (const [ds, dl] of [[11, 7], [11, 35], [55, 21], [55, 49]]) {
    b.box(P(ds, dl, 0), J.heading(sc), 6, 9, 5, AMBER, 0.12, 0.75);
  }
  b.box(P(33, -16, 0), J.heading(sc), 12, 26, 5.5, INK, 0.12, 0.8);
  const fence = [P(-12, -30, 0), P(80, -30, 0), P(80, 68, 0), P(-12, 68, 0), P(-12, -30, 0)];
  b.line(fence, DIM, 0.1, 0.8);
  for (const o of [3, 7, 11]) {
    const a = J.ground(3520, LAT - 8.4 + o * 0.6, 24), e = P(66, 42 + o, 12.5), pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([lerp(a[0], e[0], t), lerp(a[1], e[1], t) - 3 * 4 * t * (1 - t), lerp(a[2], e[2], t)]); }
    b.line(pts, BRIGHT, 0.05, 0.7);
  }
}

function township(b, rand) {
  const s0 = 3290, s1 = 3990;
  /* the highway opens into a four-lane avenue */
  const k = (s) => smooth(clamp((s - s0) / 60, 0, 1));
  for (const sg of [-1, 1]) {
    b.line(along(J, s0, s1 + 300, (s) => sg * lerp(0, 0.9, k(s)), 0.03), BRIGHT, 0.16, 0.8);
    b.line(along(J, s0, s1 + 300, (s) => sg * lerp(3.5, 8.3, k(s)), 0.03), BRIGHT, 0.16, 0.8);
    b.line(along(J, s0, s1 + 300, (s) => sg * lerp(6, 11.4, k(s)), 0), INK, 0.1, 0.5);
    dashed(b, J, s0 + 60, s1 + 300, sg * 4.6, 0.03, 3, 6, BRIGHT, 0.14, 0.85);
    for (let lane = 0; lane < 2; lane++) {
      const path = along(J, s0, s1 + 300, (s) => sg * lerp(1.75, 2.75 + lane * 3.7, k(s)), 0.55, 3);
      if (sg > 0) path.reverse();
      b.flow(path, { style: sg < 0 ? GREEN : BRIGHT, w: 0.34, speed: 15 + rand() * 4, tail: 15, pulses: phases(s1 + 300 - s0, 120, rand) });
    }
    for (let s = s0 + 40; s < s1; s += 36) {
      const lat = sg * 12.4;
      b.seg(J.pos(s, lat, 0), J.pos(s, lat, 9), INK, 0.12, 0.6);
      b.seg(J.pos(s, lat, 9), J.pos(s, lat - sg * 2, 9.4), INK, 0.1, 0.6);
      b.light(J.pos(s, lat - sg * 2, 9.4), AMBER, 0.3, 0.9);
    }
  }
  /* internal road grid on the left: 18 m, 24 m and 30 m corridors */
  const cross = [3352, 3482, 3612, 3742, 3872, 3990];
  const rows = [[-140, 12], [-268, 9], [-388, 9]];
  const P = (s, lat, y = 0) => J.ground(s, lat, y);
  for (const [lat, half] of rows) {
    for (const sg of [-1, 1]) b.line(along(J, cross[0] - 30, cross[cross.length - 1] + 20, lat + sg * half, 0, 6).map((p) => [p[0], 0, p[2]]), INK, 0.12, 0.6);
    dashed(b, J, cross[0] - 30, cross[cross.length - 1] + 20, lat, 0, 4, 9, BRIGHT, 0.12, 0.45);
    const path = along(J, cross[0] - 30, cross[cross.length - 1] + 20, lat - 2.2, 0.5, 4);
    b.flow(path, { style: lat === -140 ? GREEN : BRIGHT, w: 0.3, speed: 11, tail: 12, pulses: phases(680, 170, rand), a: 0.9 });
    for (let s = cross[0] - 10; s < cross[cross.length - 1]; s += 43) {
      const q = P(s, lat + half + 1.5);
      b.seg(q, [q[0], 8, q[2]], INK, 0.1, 0.5);
      b.light([q[0], 8.3, q[2]], AMBER, 0.3, 0.85);
    }
  }
  for (const s of cross) {
    for (const sg of [-1, 1]) {
      const pts = [];
      for (let lat = -12; lat >= -410; lat -= 14) pts.push(P(s + sg * 9, lat));
      b.line(pts, INK, 0.12, 0.6);
    }
    const mid = [];
    for (let lat = -14; lat >= -404; lat -= 6) mid.push(P(s, lat, 0.5));
    for (let i = 0; i < mid.length - 1; i += 3) b.seg([mid[i][0], 0, mid[i][2]], [mid[i + 1][0], 0, mid[i + 1][2]], BRIGHT, 0.12, 0.4);
    if (s !== cross[cross.length - 1]) b.flow(mid, { style: BRIGHT, w: 0.3, speed: 10, tail: 12, pulses: phases(390, 190, rand), a: 0.85 });
    for (let lat = -40; lat > -400; lat -= 46) {
      const q = P(s + 10.5, lat);
      b.light([q[0], 8.3, q[2]], AMBER, 0.3, 0.8);
    }
  }
  /* central roundabout */
  const rc = P(3612, 0);
  b.ring(rc, 24, 44, BRIGHT, 0.16, 0.8); b.ring(rc, 12.5, 30, INK, 0.14, 0.8); b.ring(rc, 18, 36, BRIGHT, 0.1, 0.35);
  /* plots: sheds, admin blocks, tanks, stacks */
  const lats = [-12, -128, -152, -259, -277, -379];
  for (let i = 0; i < cross.length - 1; i++) {
    for (let j = 0; j < 3; j++) {
      const sa = cross[i] + 16, sb = cross[i + 1] - 16;
      const la = lats[j * 2] - 8, lb = lats[j * 2 + 1] + 8;
      const sc = (sa + sb) / 2, lc = (la + lb) / 2, th = J.heading(sc);
      const kind = (i * 3 + j * 5 + 1) % 6;
      if (kind === 0) {
        b.box(P(sc - 18, lc), th, 62, 48, 11, INK, 0.12, 0.8, 'saw');
        b.box(P(sc + 34, lc - 10), th, 24, 22, 17, INK, 0.12, 0.8);
      } else if (kind === 1) {
        b.box(P(sc, lc + 16), th, 34, 84, 12, INK, 0.12, 0.8, 'gable');
        b.box(P(sc, lc - 26), th, 34, 84, 12, INK, 0.12, 0.8, 'gable');
      } else if (kind === 2) {
        for (const [ds, dl] of [[-26, 14], [0, 14], [26, 14], [-26, -18], [0, -18]]) b.drum(P(sc + ds, lc + dl), 9.5, 0, 13, 20, BLUE, 0.1, 0.75, 6);
        b.box(P(sc + 32, lc - 20), th, 20, 18, 8, INK, 0.12, 0.75);
      } else if (kind === 3) {
        b.box(P(sc - 8, lc), th, 62, 70, 13, INK, 0.12, 0.8, 'saw');
        const st = P(sc + 40, lc + 24);
        b.drum(st, 2.4, 0, 46, 10, INK, 0.12, 0.85, 4);
        b.light([st[0], 47, st[2]], AMBER, 0.4, 1, 1);
      } else if (kind === 4) {
        b.box(P(sc, lc), th, 30, 30, 34, INK, 0.13, 0.85);
        for (const h of [8.5, 17, 25.5]) {
          const Q = b.box(P(sc, lc), th, 30, 30, 0, INK, 0.07, 0);
          b.line([Q(-15, -15, h), Q(15, -15, h), Q(15, 15, h), Q(-15, 15, h), Q(-15, -15, h)], INK, 0.07, 0.45);
        }
        b.box(P(sc - 36, lc + 20), th, 26, 40, 9, INK, 0.12, 0.75);
      } else {
        b.box(P(sc - 20, lc + 12), th, 40, 46, 10, INK, 0.12, 0.8, 'gable');
        b.box(P(sc + 26, lc - 14), th, 44, 30, 15, INK, 0.12, 0.8);
        b.box(P(sc + 26, lc + 26), th, 20, 20, 7, INK, 0.12, 0.7);
      }
    }
  }
  /* rail-served logistics: sidings and a goods shed between avenue and main line */
  const R = (s, lat, h) => J.ground(s, RAIL_LAT + lat, railElev(s) + h);
  for (const off of [-9.5, -14.5]) {
    for (const rail of [-0.84, 0.84]) {
      const pts = [];
      for (let s = 3440; s <= 3820; s += 6) {
        const t = Math.min(smooth(clamp((s - 3440) / 70, 0, 1)), smooth(clamp((3820 - s) / 70, 0, 1)));
        pts.push(R(s, lerp(-2.65, off, t) + rail, 0.2));
      }
      b.line(pts, BRIGHT, 0.08, 0.7);
    }
  }
  b.box(J.ground(3630, RAIL_LAT - 23, 0), J.heading(3630), 12, 150, 8.5, INK, 0.12, 0.8, 'gable');
  /* 11 kV distribution along the first internal road */
  let last = null;
  for (let s = cross[0] - 20; s <= cross[cross.length - 1]; s += 52) {
    const base = P(s, -124), top = [base[0], 10.5, base[2]];
    b.seg(base, top, INK, 0.14, 0.75);
    const th = J.heading(s), ax = Math.cos(th) * 1.3, az = -Math.sin(th) * 1.3;
    const l = [top[0] - ax, 10, top[2] - az], r = [top[0] + ax, 10, top[2] + az];
    b.seg(l, r, INK, 0.1, 0.75);
    if (last) { b.seg(last[0], l, AMBER, 0.04, 0.6); b.seg(last[1], r, AMBER, 0.04, 0.6); b.seg(last[2], top, AMBER, 0.04, 0.6); }
    last = [l, r, top];
  }
}

/* faint field boundaries: gives the ground plane something to read against from height */
function fields(b, rand) {
  const lats = [-64, -118, -196, -300, -430, -590, 86, 190, 262, 372, 520, 700];
  for (const lat of lats) {
    const ph = rand() * 9, amp = 6 + rand() * 12;
    let s = S_START + 40;
    while (s < S_END - 40) {
      const len = 180 + rand() * 520;
      const e = Math.min(s + len, S_END - 40);
      const skip = (s < 1120 && e > 640 && Math.abs(lat) < 320) || (s < 1640 && e > 1200) || (lat < 0 && lat > -440 && e > 3300 && s < 4010) || (lat < -30 && lat > -250 && e > 2360 && s < 2680);
      if (!skip) {
        const pts = [];
        for (let q = s; q <= e; q += 26) pts.push(J.ground(q, lat + amp * Math.sin(q / 190 + ph), 0));
        b.line(pts, DIM, 0.12, 0.34 + rand() * 0.2);
      }
      s = e + 30 + rand() * 120;
    }
  }
  for (let s = S_START + 60; s < S_END - 60; s += 90 + rand() * 170) {
    if ((s > 620 && s < 1700) || (s > 3280 && s < 4020)) continue;
    for (const sg of [-1, 1]) {
      if (rand() < 0.3) continue;
      const a = sg * (30 + rand() * 60), e = sg * (160 + rand() * 520);
      if (sg > 0 && Math.abs(a) < 60) continue;
      if (sg < 0 && s > 2340 && s < 2700) continue;
      const skew = (rand() - 0.5) * 60;
      b.seg(J.ground(s, sg > 0 ? Math.max(a, 60) : a, 0), J.ground(s + skew, e, 0), DIM, 0.12, 0.3 + rand() * 0.16);
    }
  }
}

/* The world is built one feature at a time so the page can breathe between steps:
   call next() until it returns false, then finish(). */
export function worldBuilder() {
  const b = new Builder();
  const rand = rng(20261119);
  const steps = [fields, expressway, highway, hills, bridge, railway, water, transmission, township];
  let i = 0;
  return {
    next() { if (i < steps.length) steps[i++](b, rand); return i < steps.length; },
    finish: () => b.finish(),
  };
}

export function buildWorld() {
  const w = worldBuilder();
  while (w.next());
  return w.finish();
}

/* ------------------------------------------------------------------------ */
/* Camera choreography: positions are chainage / offset / height, like a     */
/* drone pilot's shot list. `p` = eye, `t` = look-at. Heights are above the  */
/* road profile at that chainage.                                            */
/* ------------------------------------------------------------------------ */
const shot = (ps, pl, ph, ts, tl, th, fov = 50) => ({ p: [ps, pl, ph], t: [ts, tl, th], fov });

/* opening frame of the film: landscape and portrait framings */
export const HERO_SHOT = shot(-210, -26, 20, 190, -62, 2, 50);
export const HERO_SHOT_TALL = shot(-170, -22, 30, 160, -30, 0, 56);

/* where the journey camera starts, before it drops onto the carriageway */
export const JOURNEY_INTRO = shot(-330, -64, 44, 60, 6, 0, 48);

/* two keys per sector: where the shot starts and where it has drifted to by the time we leave */
export const JOURNEY = [
  /* 01 expressways  */ [shot(-30, -4.4, 6.2, 190, 0, 3.4, 54), shot(130, -4.4, 5.2, 360, 1, 3.6, 54)],
  /* 02 highways     */ [shot(726, -7, 9, 842, 5, 2, 52), shot(838, 10, 7.5, 960, -4, 2.5, 52)],
  /* 03 bridges      */ [shot(1176, -124, 14, 1400, 4, 24, 50), shot(1262, -92, 7, 1470, 6, 30, 50)],
  /* 04 railways     */ [shot(1936, RAIL_LAT - 2.5, 4.3, 2070, RAIL_LAT + 0.5, 6.1, 56), shot(2050, RAIL_LAT - 2.4, 4.0, 2190, RAIL_LAT + 0.6, 6.0, 56)],
  /* 05 water        */ [shot(2262, 26, 52, 2452, -118, 0, 48), shot(2352, 4, 40, 2512, -128, 2, 48)],
  /* 06 transmission */ [shot(2706, 96, 30, 3010, 142, 31, 50), shot(2796, 104, 33, 3110, 142, 30, 50)],
  /* 07 integrated   */ [shot(3150, -150, 96, 3610, -70, 0, 52), shot(3232, -196, 116, 3650, -92, 0, 52)],
];

/* stills used on the project cards */
export const STILLS = {
  bypass: shot(318, -66, 44, 600, 14, 0, 44),
  ring: shot(742, -150, 96, 900, 10, 6, 42),
  corridor: shot(3330, -470, 120, 3640, -214, 0, 46),
  rail: shot(1958, RAIL_LAT + 0.2, 3.3, 2110, RAIL_LAT - 0.4, 5.6, 60),
  rail2: shot(2190, RAIL_LAT + 34, 15, 2340, RAIL_LAT - 6, 5, 44),
  power: shot(3372, 22, 24, 3520, 128, 9, 48),
  hills: shot(700, -34, 17, 868, 2, 8, 48),
};

/* resolve a shot (chainage space) into world-space eye / target */
export function resolve(sh, out) {
  const o = out || { eye: [0, 0, 0], tgt: [0, 0, 0], fov: 50 };
  J.pos(sh.p[0], sh.p[1], 0, o.eye); o.eye[1] = Math.max(J.elev(sh.p[0]), 0) + sh.p[2];
  J.pos(sh.t[0], sh.t[1], 0, o.tgt); o.tgt[1] = Math.max(J.elev(sh.t[0]), 0) + sh.t[2];
  o.fov = sh.fov;
  return o;
}

/* interpolate two chainage-space shots (so the camera follows the alignment, not a chord) */
export function mixShots(a, b, t, out) {
  for (let i = 0; i < 3; i++) { out.p[i] = lerp(a.p[i], b.p[i], t); out.t[i] = lerp(a.t[i], b.t[i], t); }
  out.fov = lerp(a.fov, b.fov, t);
  return out;
}
