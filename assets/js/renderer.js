/*
 * Line renderer for the corridor world (see world.js).
 *
 * Plain Canvas 2D, no dependencies. Every frame: cull chunks against the
 * camera, project, bucket segments by colour / opacity / width, then stroke
 * each bucket twice: crisp on the main canvas, and fat and faint on a
 * quarter-resolution canvas that the browser scales up underneath it. That
 * soft copy is the glow. A third, tiny canvas paints the sky.
 */

const STYLES = [
  /* INK    */ [176, 204, 238],
  /* BRIGHT */ [236, 245, 255],
  /* GREEN  */ [54, 232, 148],
  /* BLUE   */ [84, 170, 255],
  /* DIM    */ [122, 156, 204],
  /* AMBER  */ [255, 204, 128],
];
const N_STYLE = STYLES.length;
const A_STEPS = 8;
const WIDTHS = [0.7, 0.95, 1.3, 1.8, 2.5, 3.4];
const N_W = WIDTHS.length;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Renderer {
  constructor(stage, world, opts = {}) {
    this.world = world;
    /* glow: 2 = halo + core, 1 = core only, 0 = off (the page steps this down on slow devices) */
    this.opts = Object.assign({ fogNear: 90, fogFar: 1500, maxPixels: 3.2e6, maxDpr: 2, glow: 2, sky: 1, lift: 0 }, opts);
    this.sky = stage.querySelector('[data-sky]');
    this.canvas = stage.querySelector('[data-lines]');
    this.ctx = this.canvas.getContext('2d');
    this.skyCtx = this.sky ? this.sky.getContext('2d') : null;
    this.glow = document.createElement('canvas');
    this.glow.setAttribute('data-glow', '');
    stage.insertBefore(this.glow, this.canvas);
    this.glowCtx = this.glow.getContext('2d');
    this.buckets = new Array(N_STYLE * A_STEPS * N_W);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
    this.dots = [];
    this.w = this.h = 0;
    this.cam = { eye: [0, 10, -50], tgt: [0, 0, 100], fov: 50 };
  }

  resize(cssW, cssH) {
    const o = this.opts;
    let dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr);
    const px = cssW * cssH * dpr * dpr;
    if (px > o.maxPixels) dpr *= Math.sqrt(o.maxPixels / px);
    const w = Math.max(2, Math.round(cssW * dpr)), h = Math.max(2, Math.round(cssH * dpr));
    if (w === this.w && h === this.h) return false;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = w; this.canvas.height = h;
    this.glow.width = Math.max(1, Math.round(w / 4)); this.glow.height = Math.max(1, Math.round(h / 4));
    if (this.sky) { this.sky.width = Math.max(2, Math.round(cssW / 5)); this.sky.height = Math.max(2, Math.round(cssH / 5)); }
    return true;
  }

  /* -------------------------------------------------------------------- */
  render(cam, time) {
    const { ctx, w, h, world, opts } = this;
    if (!w) return;
    const eye = cam.eye, tgt = cam.tgt;
    /* camera basis */
    let fx = tgt[0] - eye[0], fy = tgt[1] - eye[1], fz = tgt[2] - eye[2];
    let l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l;
    /* right = up x f  (up = +y) */
    let rx = fz, rz = -fx; l = Math.hypot(rx, rz) || 1; rx /= l; rz /= l;
    /* camUp = f x right */
    const upx = fy * rz, upy = fz * rx - fx * rz, upz = -fy * rx;
    const focal = (0.5 * Math.sqrt(w * h)) / Math.tan((cam.fov * Math.PI) / 360);
    const cx0 = w / 2, cy0 = h / 2 - h * opts.lift;
    const near = 0.6;
    const fogN = opts.fogNear, fogF = opts.fogFar, fogSpan = fogF - fogN;
    const dpr = this.dpr;
    const P = world.points, C = world.chunks, nC = C.length / 9;
    const buckets = this.buckets;
    for (let i = 0; i < buckets.length; i++) buckets[i].length = 0;

    const fogAt = (d) => { const t = 1 - (d - fogN) / fogSpan; return t >= 1 ? 1 : t <= 0 ? 0 : t * t * (1.6 - 0.6 * t); };
    const widthIdx = (px) => { for (let i = 0; i < N_W; i++) if (px <= WIDTHS[i] * 1.18) return i; return N_W - 1; };

    /* ---- static line work ---- */
    for (let ci = 0; ci < nC; ci++) {
      const o = ci * 9;
      const ccx = C[o + 5] - eye[0], ccy = C[o + 6] - eye[1], ccz = C[o + 7] - eye[2], rad = C[o + 8];
      const cd = ccx * fx + ccy * fy + ccz * fz;                 // depth of chunk centre
      if (cd < -rad || cd - rad > fogF) continue;
      /* cheap side cull: project centre, allow radius */
      if (cd > rad + 1) {
        const sx = (ccx * rx + ccz * rz) / cd, sy = (ccx * upx + ccy * upy + ccz * upz) / cd;
        const m = rad / cd + 0.05;
        if (Math.abs(sx) * focal > cx0 + m * focal || Math.abs(sy) * focal > h * (0.5 + Math.abs(opts.lift)) + m * focal) continue;
      }
      const start = C[o], count = C[o + 1], style = C[o + 2], wWorld = C[o + 3], aMul = C[o + 4];
      let px = 0, py = 0, pz = 0, pValid = false, lastKey = -1, lastBucket = null;
      for (let k = 0; k < count; k++) {
        const pi = (start + k) * 3;
        const dx = P[pi] - eye[0], dy = P[pi + 1] - eye[1], dz = P[pi + 2] - eye[2];
        const qx = dx * rx + dz * rz, qy = dx * upx + dy * upy + dz * upz, qz = dx * fx + dy * fy + dz * fz;
        if (k > 0) {
          let ax = px, ay = py, az = pz, bx = qx, by = qy, bz = qz;
          if (az >= near || bz >= near) {
            if (az < near) { const t = (near - az) / (bz - az); ax += (bx - ax) * t; ay += (by - ay) * t; az = near; }
            else if (bz < near) { const t = (near - bz) / (az - bz); bx += (ax - bx) * t; by += (ay - by) * t; bz = near; }
            const md = (az + bz) * 0.5;
            const alpha = aMul * fogAt(md);
            if (alpha > 0.02) {
              const ai = clamp((alpha * A_STEPS) | 0, 0, A_STEPS - 1);
              const wi = widthIdx(clamp((wWorld * focal) / md, 0.7 * dpr, 3.4 * dpr) / dpr);
              const key = (style * A_STEPS + ai) * N_W + wi;
              const sax = cx0 + (ax / az) * focal, say = cy0 - (ay / az) * focal;
              const sbx = cx0 + (bx / bz) * focal, sby = cy0 - (by / bz) * focal;
              if (key === lastKey && pValid) lastBucket.push(sbx, sby);
              else { lastBucket = buckets[key]; lastBucket.push(NaN, sax, say, sbx, sby); lastKey = key; }
              pValid = bz > near;
            } else { lastKey = -1; }
          } else { lastKey = -1; }
        }
        px = qx; py = qy; pz = qz;
      }
    }

    /* ---- pulses ---- */
    const dots = this.dots; dots.length = 0;
    const flows = world.flows;
    const TAILS = [1, 0.5, 0.2], seg = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let fi = 0; fi < flows.length; fi++) {
      const F = flows[fi];
      const ccx = F.c[0] - eye[0], ccy = F.c[1] - eye[1], ccz = F.c[2] - eye[2];
      const cd = ccx * fx + ccy * fy + ccz * fz;
      if (cd < -F.r || cd - F.r > fogF) continue;
      const len = F.len, travel = F.speed * time;
      for (let pi = 0; pi < F.pulses.length; pi++) {
        let head = (F.pulses[pi] + travel) % len; if (head < 0) head += len;
        /* four samples: head and three steps back along the path */
        let ok = true;
        for (let q = 0; q < 4; q++) {
          let s = head - (F.tail * q) / 3;
          if (s < 0) { if (F.closed) s += len; else { ok = q > 1; s = 0; } }
          /* binary search the cumulative-length table */
          let lo = 0, hi = F.n - 1;
          while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (F.cum[mid] <= s) lo = mid; else hi = mid; }
          const t = (s - F.cum[lo]) / (F.cum[hi] - F.cum[lo] || 1);
          const a3 = lo * 3, b3 = hi * 3;
          const wx = F.p[a3] + (F.p[b3] - F.p[a3]) * t - eye[0];
          const wy = F.p[a3 + 1] + (F.p[b3 + 1] - F.p[a3 + 1]) * t - eye[1];
          const wz = F.p[a3 + 2] + (F.p[b3 + 2] - F.p[a3 + 2]) * t - eye[2];
          seg[q * 3] = wx * rx + wz * rz; seg[q * 3 + 1] = wx * upx + wy * upy + wz * upz; seg[q * 3 + 2] = wx * fx + wy * fy + wz * fz;
        }
        if (!ok) continue;
        if (seg[2] < near || seg[11] < near || seg[2] > fogF) continue;
        const fog = fogAt(seg[2]);
        if (fog < 0.03) continue;
        /* fade pulses in and out at the ends of open paths */
        let edge = 1;
        if (!F.closed) edge = clamp(Math.min(head, len - head) / 60, 0, 1);
        const base = F.a * fog * edge;
        for (let q = 0; q < 3; q++) {
          const az = seg[q * 3 + 2], bz = seg[q * 3 + 5];
          const alpha = base * TAILS[q];
          if (alpha < 0.03) continue;
          const ai = clamp((alpha * A_STEPS) | 0, 0, A_STEPS - 1);
          const wpx = clamp((F.w * (1 - q * 0.16) * focal) / az, 1.0 * dpr, 3.4 * dpr) / dpr;
          const bucket = buckets[(F.style * A_STEPS + ai) * N_W + widthIdx(wpx)];
          bucket.push(NaN, cx0 + (seg[q * 3] / az) * focal, cy0 - (seg[q * 3 + 1] / az) * focal, cx0 + (seg[q * 3 + 3] / bz) * focal, cy0 - (seg[q * 3 + 4] / bz) * focal);
        }
        if (F.dot) dots.push(cx0 + (seg[0] / seg[2]) * focal, cy0 - (seg[1] / seg[2]) * focal, clamp((F.w * 0.95 * focal) / seg[2], 0.9 * dpr, 3.2 * dpr), F.style, clamp(base * 1.25, 0, 1));
      }
    }

    /* ---- point lights ---- */
    const L = world.lights;
    for (let i = 0; i < L.length; i += 7) {
      const dx = L[i] - eye[0], dy = L[i + 1] - eye[1], dz = L[i + 2] - eye[2];
      const qz = dx * fx + dy * fy + dz * fz;
      if (qz < near || qz > fogF) continue;
      let a = L[i + 5] * fogAt(qz);
      if (L[i + 6]) a *= 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(time * 2.2 + i), 3);
      if (a < 0.04) continue;
      const qx = dx * rx + dz * rz, qy = dx * upx + dy * upy + dz * upz;
      dots.push(cx0 + (qx / qz) * focal, cy0 - (qy / qz) * focal, clamp((L[i + 4] * focal) / qz, 0.8 * dpr, 3.6 * dpr), L[i + 3], a);
    }

    /* ---- draw: every bucket once sharp, once (or twice) soft ---- */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const g = this.glowCtx, glow = opts.glow, gs = this.glow.width / w;
    /* glow radius follows the size of the picture, so a small card still is not drowned in haze */
    const gk = clamp(Math.sqrt(w * h) / dpr / 1100, 0.34, 1.15) * dpr;
    if (!glow !== this.glow.hidden) this.glow.hidden = !glow;      // no glow: drop the layer entirely
    if (glow) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.glow.width, this.glow.height);
      g.setTransform(gs, 0, 0, gs, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round';
    }
    for (let s = 0; s < N_STYLE; s++) {
      const c = STYLES[s], rgb = `${c[0]},${c[1]},${c[2]}`;
      for (let a = 0; a < A_STEPS; a++) {
        const alpha = (a + 0.75) / A_STEPS;
        let set = false;
        for (let wi = 0; wi < N_W; wi++) {
          const bk = buckets[(s * A_STEPS + a) * N_W + wi];
          const n = bk.length;
          if (!n) continue;
          const path = new Path2D();
          for (let i = 0; i < n; i++) {
            const v = bk[i];
            if (v !== v) { path.moveTo(bk[i + 1], bk[i + 2]); i += 2; }
            else { path.lineTo(v, bk[i + 1]); i += 1; }
          }
          if (!set) { ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(3)})`; set = true; }
          ctx.lineWidth = WIDTHS[wi] * dpr;
          ctx.stroke(path);
          if (glow && a > 0) {
            g.strokeStyle = `rgba(${rgb},${(alpha * 0.36).toFixed(3)})`;
            g.lineWidth = WIDTHS[wi] * 2.4 * dpr + 4 * gk;
            g.stroke(path);
            if (glow > 1 && a > 2) {
              g.strokeStyle = `rgba(${rgb},${(alpha * 0.13).toFixed(3)})`;
              g.lineWidth = WIDTHS[wi] * 3 * dpr + 15 * gk;
              g.stroke(path);
            }
          }
        }
      }
    }
    for (let i = 0; i < dots.length; i += 5) {
      const c = STYLES[dots[i + 3]], rgb = `${c[0]},${c[1]},${c[2]}`, al = dots[i + 4];
      ctx.fillStyle = `rgba(${rgb},${al.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(dots[i], dots[i + 1], dots[i + 2], 0, 6.2832); ctx.fill();
      if (glow) {
        /* distant lights are tiny: let their halo shrink with them so the horizon does not blow out */
        const r = dots[i + 2], near = Math.min(1, r / (2.4 * dpr)), ga = al * near * near;
        g.fillStyle = `rgba(${rgb},${(ga * 0.34).toFixed(3)})`;
        g.beginPath(); g.arc(dots[i], dots[i + 1], r * 2 + 2 * gk, 0, 6.2832); g.fill();
        if (glow > 1) { g.fillStyle = `rgba(${rgb},${(ga * 0.13).toFixed(3)})`; g.beginPath(); g.arc(dots[i], dots[i + 1], r * 3.6 + 6 * gk, 0, 6.2832); g.fill(); }
      }
    }

    if (this.skyCtx && opts.sky) {
      /* horizon line on screen: where a level ray lands */
      const horizon = cy0 + (fy / Math.max(0.05, Math.hypot(fx, fz))) * focal;
      this.drawSky(horizon / h, time);
    }
  }

  /* a dusk sky: deep navy overhead, a band of brand colour at the horizon, slow aurora */
  drawSky(hy, time) {
    const c = this.skyCtx, w = this.sky.width, h = this.sky.height;
    const y = clamp(hy, -0.6, 1.6) * h;
    c.globalCompositeOperation = 'source-over';
    const g = c.createLinearGradient(0, y - h * 0.95, 0, y + h * 0.7);
    g.addColorStop(0, '#020710');
    g.addColorStop(0.52, '#04162c');
    g.addColorStop(0.83, '#07304f');
    g.addColorStop(0.955, '#0d5466');
    g.addColorStop(1, '#0f6a66');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    /* ground: darker, fading up into the horizon haze */
    const gg = c.createLinearGradient(0, y, 0, y + h * 0.75);
    gg.addColorStop(0, 'rgba(6,34,52,0.96)');
    gg.addColorStop(0.06, 'rgba(4,20,36,0.98)');
    gg.addColorStop(0.4, 'rgba(3,11,24,1)');
    gg.addColorStop(1, 'rgba(2,7,16,1)');
    c.fillStyle = gg; c.fillRect(0, y, w, h - y + 1);
    /* aurora ribbons */
    c.globalCompositeOperation = 'lighter';
    const ribbons = [
      [0.30, 0.22, 'rgba(40,150,255,', 0.16, 0.11, 0],
      [0.62, 0.30, 'rgba(34,214,150,', 0.14, 0.085, 2.1],
      [0.84, 0.18, 'rgba(60,120,255,', 0.10, 0.13, 4.2],
    ];
    for (const [px, sw, col, al, sp, ph] of ribbons) {
      const cxp = (px + 0.07 * Math.sin(time * sp + ph)) * w;
      const cyp = y - h * (0.16 + 0.05 * Math.sin(time * sp * 0.7 + ph * 1.7));
      const rx = sw * w * (1.5 + 0.25 * Math.sin(time * sp * 0.9 + ph)), ry = h * 0.42;
      c.save(); c.translate(cxp, cyp); c.scale(1, ry / rx);
      const rg = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      rg.addColorStop(0, col + al + ')'); rg.addColorStop(0.5, col + al * 0.42 + ')'); rg.addColorStop(1, col + '0)');
      c.fillStyle = rg; c.beginPath(); c.arc(0, 0, rx, 0, 6.2832); c.fill(); c.restore();
    }
    /* horizon glow line */
    const hg = c.createLinearGradient(0, y - h * 0.07, 0, y + h * 0.05);
    hg.addColorStop(0, 'rgba(60,220,190,0)'); hg.addColorStop(0.58, 'rgba(90,230,200,0.20)'); hg.addColorStop(1, 'rgba(60,220,190,0)');
    c.fillStyle = hg; c.fillRect(0, y - h * 0.07, w, h * 0.12);
    c.globalCompositeOperation = 'source-over';
  }
}
