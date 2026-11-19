/*
 * Presence map: a dot-lattice India showing where SKS Infra Projects is at work.
 * Geometry comes from map-data.js; everything below is plain latitude / longitude.
 *
 * The map carries no project names and no sector colours. Every project is one
 * mark in one colour: a corridor project is a fine line with a small dot at each
 * end, a single-site project is one small dot. The two offices are labelled.
 *
 * To add a single-site project:  add [lat, lon, state] to SITES
 * To add a corridor project:     add [[states it runs through], [[lat, lon], ...]] to CORRIDORS
 *                                (a project with more than one leg lists each leg in turn)
 * `state` is one of the constants below (the 1-based index into MAP.states).
 * The number shown beside each state lives in index.html, in the Presence section.
 */
import { MAP } from './map-data.js';

const UP = 1, PB = 2, MP = 3, HR = 4, RJ = 5, GJ = 6, MH = 7, BR = 8, WB = 9, OD = 10;

/* name, lat, lon, role, label offset (map units) */
export const OFFICES = [
  ['Agra', 27.18, 78.01, 'Head office', [205, -150]],
  ['Noida', 28.57, 77.33, 'Corporate office', [-165, -96]],
];

export const SITES = [
  [31.63, 74.87, PB], [31.45, 74.93, PB], [31.38, 75.38, PB], [30.47, 74.52, PB],
  [27.09, 78.60, UP], [26.23, 81.24, UP], [25.45, 78.57, UP], [25.50, 78.69, UP],
  [26.56, 78.79, MP],
];

export const CORRIDORS = [
  [[RJ, GJ], [[26.00, 73.00], [25.82, 72.58], [25.35, 72.62], [25.00, 72.27], [24.75, 72.21], [24.19, 72.03]]],
  [[UP, BR], [[25.28, 83.12], [24.95, 84.03], [24.91, 84.18], [24.80, 85.03]]],
  [[UP], [[26.93, 81.19], [27.13, 81.96], [26.80, 82.74], [26.74, 83.40]]],
  [[UP, BR], [[26.74, 83.40], [26.50, 83.78], [26.22, 84.36], [25.79, 84.71]]],
  [[UP], [[27.83, 79.92], [27.40, 80.13], [26.83, 80.92]]],
  [[UP, HR], [[27.48, 77.67], [27.80, 77.43], [28.14, 77.33]]],
  [[UP], [[25.53, 81.87], [25.55, 82.31]]],
  [[HR], [[28.70, 76.24], [28.79, 76.14], [28.95, 76.03]], [[28.79, 76.14], [28.86, 76.42]]],
  [[MP, GJ], [[23.34, 75.05], [22.84, 74.25], [22.78, 73.62]]],
  [[MH], [[21.17, 73.80], [21.37, 74.24], [21.32, 74.57], [21.27, 74.66]]],
  [[MH, MP], [[21.05, 75.79], [21.31, 76.23], [21.82, 76.35]]],
  [[MP], [[22.61, 77.77], [22.76, 78.35], [22.95, 79.19], [23.04, 79.48]]],
  [[MH], [[20.67, 75.35], [21.01, 75.56], [21.05, 75.79], [20.89, 76.20], [20.79, 76.69], [20.71, 77.00], [20.86, 77.73]]],
  [[MH], [[20.55, 78.84], [20.25, 79.01], [19.95, 79.30], [19.85, 79.35]]],
  [[GJ], [[21.79, 71.52], [21.60, 71.22], [21.75, 70.62], [21.72, 70.57]]],
  [[OD], [[20.83, 83.92], [20.70, 84.20], [20.63, 84.45]]],
  [[WB], [[22.58, 88.34], [22.92, 88.38], [23.21, 87.97]]],
];

const NS = 'http://www.w3.org/2000/svg';
const D2R = Math.PI / 180;

export function project(lat, lon) {
  const { n, F, rho0, lam0, minx, maxy, scale } = MAP.proj;
  const rho = F / Math.pow(Math.tan(Math.PI / 4 + (lat * D2R) / 2), n);
  const th = n * (lon * D2R - lam0);
  return [(rho * Math.sin(th) - minx) * scale, (maxy - (rho0 - rho * Math.cos(th))) * scale];
}

const el = (tag, attrs, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
};
const dot = (p) => `M${p[0].toFixed(1)} ${p[1].toFixed(1)}h0`;

/* smooth path through points (Catmull-Rom -> cubic Bezier) */
function curve(pts) {
  if (pts.length < 3) return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export function mountMap(root, { reduce = false } = {}) {
  const svg = el('svg', { viewBox: `-40 -24 ${MAP.w + 80} ${MAP.h + 48}`, 'aria-hidden': 'true', focusable: 'false' });
  el('path', { class: 'map-outline', d: MAP.outline }, svg);

  /* the lattice, grouped by state so a whole state can light up at once */
  const groups = MAP.states.map(() => '');
  let base = '';
  MAP.rows.forEach((row, r) => {
    const y = (r + 0.5) * MAP.dy;
    const x0 = (r % 2 ? MAP.dx / 2 : 0) + MAP.dx / 4;
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      const seg = dot([x0 + c * MAP.dx, y]);
      if (ch === '0') base += seg; else groups[parseInt(ch, 36) - 1] += seg;
    }
  });
  el('path', { class: 'map-dots map-dots--base', d: base, 'stroke-width': (MAP.dy * 0.34).toFixed(2) }, svg);
  const stateEls = MAP.states.map((name, i) => {
    const g = el('g', {}, svg);
    const outline = el('path', { class: 'map-state-outline', d: MAP.stateOutlines[i] }, g);
    const dots = el('path', { class: 'map-dots map-dots--state', d: groups[i], 'stroke-width': (MAP.dy * 0.42).toFixed(2) }, g);
    return { outline, dots };
  });

  /* projects */
  const marks = [], lines = [];
  CORRIDORS.forEach(([states, ...legs], i) => {
    const g = el('g', { class: 'map-project' }, svg);
    let ends = '';
    for (const leg of legs) {
      const pts = leg.map(([lat, lon]) => project(lat, lon));
      const line = el('path', { class: 'map-corridor', d: curve(pts), pathLength: 1 }, g);
      if (!reduce) {
        /* drawn in from one end once the map scrolls into view */
        line.style.strokeDasharray = '1 2';
        line.style.strokeDashoffset = 1;
        line.style.transition = `stroke-dashoffset 1.5s cubic-bezier(.16,1,.3,1) ${(0.35 + i * 0.06).toFixed(2)}s`;
        lines.push(line);
      }
      ends += dot(pts[0]) + dot(pts[pts.length - 1]);
    }
    el('path', { class: 'map-node', d: ends }, g);
    marks.push({ node: g, states });
  });
  for (const [lat, lon, state] of SITES) {
    marks.push({ node: el('path', { class: 'map-node map-node--site', d: dot(project(lat, lon)) }, svg), states: [state] });
  }

  /* offices: a white dot with a slow pulse, and a label on a leader line */
  const chips = [];
  for (const [name, lat, lon, role, [dx, dy]] of OFFICES) {
    const [x, y] = project(lat, lon);
    const chip = el('g', { class: 'map-chip' }, svg);
    const cx = x + dx, cy = y + dy;
    el('line', { x1: x.toFixed(1), y1: y.toFixed(1), x2: cx.toFixed(1), y2: cy.toFixed(1) }, chip);
    const rect = el('rect', {}, chip);
    const text = el('text', { x: cx.toFixed(1), y: cy.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, chip);
    text.textContent = name + '  ';
    el('tspan', {}, text).textContent = role.toUpperCase();
    chips.push([text, rect, cx, cy]);
    const g = el('g', { class: 'map-office', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, svg);
    if (!reduce) { el('circle', { class: 'map-ring', r: 6 }, g); el('circle', { class: 'map-ring map-ring--2', r: 6 }, g); }
    el('circle', { r: 5.5 }, g);
  }

  root.appendChild(svg);
  /* size each label to its text now that it is in the document */
  for (const [text, rect, cx, cy] of chips) {
    const size = parseFloat(getComputedStyle(text).fontSize) || 21;
    const w = text.getComputedTextLength() + size * 1.6, h = size * 1.8;
    rect.setAttribute('x', (cx - w / 2).toFixed(1)); rect.setAttribute('y', (cy - h / 2).toFixed(1));
    rect.setAttribute('width', w.toFixed(1)); rect.setAttribute('height', h.toFixed(1)); rect.setAttribute('rx', (h / 2).toFixed(1));
  }

  let active = 0;
  function setActive(i) {
    if (i === active) return;
    active = i;
    root.classList.toggle('has-active', i > 0);
    stateEls.forEach((s, k) => { const on = k + 1 === i; s.dots.classList.toggle('is-on', on); s.outline.classList.toggle('is-on', on); });
    marks.forEach((m) => m.node.classList.toggle('is-off', i > 0 && !m.states.includes(i)));
  }
  function reveal() {
    root.classList.add('is-ready');
    lines.forEach((line) => { line.style.strokeDashoffset = 0; });
  }
  return { setActive, reveal, get active() { return active; } };
}
