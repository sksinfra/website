/*
 * Presence map: a dot-lattice India with the states, cities and corridors
 * SKS Infra Projects is working in. Geometry comes from map-data.js; the
 * places below are plain latitude / longitude so they are easy to edit.
 *
 * To add a city:      add a row to PLACES  -> [name, lat, lon, state, kind]
 * To add a corridor:  add a row to CORRIDORS -> [kind, [states], [[lat, lon], ...]]
 * `state` is the index (1-based) into MAP.states; kind is office | road | rail | power.
 */
import { MAP } from './map-data.js';

const UP = 1, PB = 2, MP = 3, HR = 4, RJ = 5, GJ = 6, MH = 7, BR = 8, WB = 9, OD = 10;

export const PLACES = [
  ['Agra', 27.18, 78.01, UP, 'office', 'Head office'],
  ['Noida', 28.57, 77.33, UP, 'office', 'Corporate office'],
  ['Amritsar', 31.63, 74.87, PB, 'road'],
  ['Raebareli', 26.23, 81.24, UP, 'road'],
  ['Jhansi', 25.45, 78.57, UP, 'road'],
  ['Bhind', 26.56, 78.79, MP, 'road'],
  ['Etawah', 26.78, 79.02, UP, 'road'],
  ['Tarn Taran', 31.45, 74.93, PB, 'power'],
  ['Kapurthala', 31.38, 75.38, PB, 'power'],
  ['Sri Muktsar Sahib', 30.47, 74.52, PB, 'power'],
  ['Fazilka', 30.40, 74.03, PB, 'power'],
  ['Mathura', 27.48, 77.67, UP, 'rail'],
  ['Palwal', 28.14, 77.33, HR, 'rail'],
  ['Bhiwani', 28.79, 76.14, HR, 'rail'],
  ['Lucknow', 26.83, 80.92, UP, 'rail'],
  ['Shahjahanpur', 27.83, 79.92, UP, 'rail'],
  ['Barabanki', 26.93, 81.19, UP, 'rail'],
  ['Gorakhpur', 26.74, 83.40, UP, 'rail'],
  ['Chhapra', 25.79, 84.71, BR, 'rail'],
  ['Prayagraj', 25.53, 81.87, UP, 'rail'],
  ['Janghai', 25.55, 82.31, UP, 'rail'],
  ['Pt. Deen Dayal Upadhyaya Nagar', 25.28, 83.12, UP, 'rail'],
  ['Gaya', 24.80, 85.03, BR, 'rail'],
  ['Howrah', 22.58, 88.34, WB, 'rail'],
  ['Bandel', 22.92, 88.38, WB, 'rail'],
  ['Saktigarh', 23.21, 87.97, WB, 'rail'],
  ['Sonepur', 20.83, 83.92, OD, 'rail'],
  ['Purunakatak', 20.63, 84.45, OD, 'rail'],
  ['Hinganghat', 20.55, 78.84, MH, 'rail'],
  ['Ballarshah', 19.85, 79.35, MH, 'rail'],
  ['Dhasa', 21.79, 71.52, GJ, 'rail'],
  ['Jetalsar', 21.72, 70.57, GJ, 'rail'],
  ['Ratlam', 23.34, 75.05, MP, 'rail'],
  ['Godhra', 22.78, 73.62, GJ, 'rail'],
  ['Nandurbar', 21.37, 74.24, MH, 'rail'],
  ['Bhusaval', 21.05, 75.79, MH, 'rail'],
  ['Khandwa', 21.82, 76.35, MP, 'rail'],
  ['Luni', 26.00, 73.00, RJ, 'rail'],
  ['Samdari', 25.82, 72.58, RJ, 'rail'],
  ['Bhildi', 24.19, 72.03, GJ, 'rail'],
  ['Itarsi', 22.61, 77.77, MP, 'rail'],
  ['Shridham', 23.04, 79.48, MP, 'rail'],
  ['Pachora', 20.67, 75.35, MH, 'rail'],
  ['Badnera', 20.86, 77.73, MH, 'rail'],
];

export const CORRIDORS = [
  ['rail', [RJ, GJ], [[26.00, 73.00], [25.82, 72.58], [25.35, 72.62], [25.00, 72.27], [24.75, 72.21], [24.19, 72.03]]],
  ['rail', [UP, BR], [[25.28, 83.12], [24.95, 84.03], [24.91, 84.18], [24.80, 85.03]]],
  ['rail', [UP], [[26.93, 81.19], [27.13, 81.96], [26.80, 82.74], [26.74, 83.40]]],
  ['rail', [UP, BR], [[26.74, 83.40], [26.50, 83.78], [26.22, 84.36], [25.79, 84.71]]],
  ['rail', [UP], [[27.83, 79.92], [27.40, 80.13], [26.83, 80.92]]],
  ['rail', [UP, HR], [[27.48, 77.67], [27.80, 77.43], [28.14, 77.33]]],
  ['rail', [UP], [[25.53, 81.87], [25.55, 82.31]]],
  ['rail', [HR], [[28.70, 76.24], [28.79, 76.14], [28.95, 76.03]]],
  ['rail', [HR], [[28.79, 76.14], [28.86, 76.42]]],
  ['rail', [MP, GJ], [[23.34, 75.05], [22.84, 74.25], [22.78, 73.62]]],
  ['rail', [MH], [[21.17, 73.80], [21.37, 74.24], [21.32, 74.57], [21.27, 74.66]]],
  ['rail', [MH, MP], [[21.05, 75.79], [21.31, 76.23], [21.82, 76.35]]],
  ['rail', [MP], [[22.61, 77.77], [22.76, 78.35], [22.95, 79.19], [23.04, 79.48]]],
  ['rail', [MH], [[20.67, 75.35], [21.01, 75.56], [21.05, 75.79], [20.89, 76.20], [20.79, 76.69], [20.71, 77.00], [20.86, 77.73]]],
  ['rail', [MH], [[20.55, 78.84], [20.25, 79.01], [19.95, 79.30], [19.85, 79.35]]],
  ['rail', [GJ], [[21.79, 71.52], [21.60, 71.22], [21.75, 70.62], [21.72, 70.57]]],
  ['rail', [OD], [[20.83, 83.92], [20.70, 84.20], [20.63, 84.45]]],
  ['rail', [WB], [[22.58, 88.34], [22.92, 88.38], [23.21, 87.97]]],
  ['road', [UP], [[27.18, 78.01], [27.10, 78.59], [26.78, 79.02]]],
];

/* a handful of always-on labels at the edges of the network, for orientation */
const LABELS = { Amritsar: [-12, -10, 'end'], Howrah: [14, 6, 'start'], Jetalsar: [-12, 20, 'end'], Ballarshah: [12, 20, 'start'], Luni: [-12, -8, 'end'], Gorakhpur: [10, -12, 'start'], Sonepur: [-12, 22, 'end'] };

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
  const labelBoxes = [];
  const svg = el('svg', { viewBox: `-40 -24 ${MAP.w + 80} ${MAP.h + 48}`, 'aria-hidden': 'true', focusable: 'false' });
  el('path', { class: 'map-outline', d: MAP.outline }, svg);

  /* dots, grouped by state so a whole state can light up at once */
  const groups = MAP.states.map(() => '');
  let base = '';
  MAP.rows.forEach((row, r) => {
    const y = ((r + 0.5) * MAP.dy).toFixed(1);
    const x0 = (r % 2 ? MAP.dx / 2 : 0) + MAP.dx / 4;
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      const seg = `M${(x0 + c * MAP.dx).toFixed(1)} ${y}h0`;
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

  /* corridors */
  const corridorEls = CORRIDORS.map(([kind, states, pts], i) => {
    const d = curve(pts.map(([lat, lon]) => project(lat, lon)));
    const path = el('path', { class: `map-corridor map-corridor--${kind}`, d }, svg);
    const len = path.getTotalLength();
    if (!reduce) {
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.style.transition = `stroke-dashoffset 1.6s cubic-bezier(.16,1,.3,1) ${0.5 + i * 0.07}s, opacity .5s`;
    }
    return { path, states };
  });

  /* places */
  const tip = document.createElement('div');
  tip.className = 'map-tip';
  const placeEls = PLACES.map(([name, lat, lon, state, kind, role]) => {
    const [x, y] = project(lat, lon);
    const g = el('g', { class: `map-place map-place--${kind}`, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, svg);
    if (kind === 'office') {
      if (!reduce) { el('circle', { class: 'map-ring', r: 7 }, g); el('circle', { class: 'map-ring map-ring--2', r: 7 }, g); }
      el('circle', { r: 6.5 }, g);
    } else {
      el('circle', { r: 4.4 }, g);
    }
    const hit = el('circle', { r: 16, fill: 'transparent', stroke: 'none' }, g);
    hit.style.pointerEvents = 'all';
    const show = () => {
      const a = root.getBoundingClientRect(), b = hit.getBoundingClientRect();
      tip.textContent = role ? `${name} · ${role}` : name;
      tip.style.left = `${b.left + b.width / 2 - a.left}px`;
      tip.style.top = `${b.top + b.height / 2 - a.top}px`;
      tip.classList.add('is-on');
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => tip.classList.remove('is-on'));
    return { g, state, name };
  });

  /* labels: office chips on leader lines, plus a few edge-of-network anchors */
  const CHIPS = { Agra: [205, -150], Noida: [-165, -96] };
  for (const [name, lat, lon, , kind, role] of PLACES) {
    const [x, y] = project(lat, lon);
    if (kind === 'office') {
      const [dx, dy] = CHIPS[name] || [120, -80];
      const g = el('g', { class: 'map-chip' }, svg);
      const cx = x + dx, cy = y + dy;
      el('line', { x1: x.toFixed(1), y1: y.toFixed(1), x2: cx.toFixed(1), y2: cy.toFixed(1) }, g);
      const rect = el('rect', {}, g);
      const t = el('text', { x: cx.toFixed(1), y: cy.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
      t.textContent = name + '  ';
      el('tspan', {}, t).textContent = role.toUpperCase();
      labelBoxes.push([t, rect, cx, cy]);
    } else if (LABELS[name]) {
      const [dx, dy, anchor] = LABELS[name];
      el('text', { class: 'map-label', x: (x + dx).toFixed(1), y: (y + dy).toFixed(1), 'text-anchor': anchor }, svg).textContent = name;
    }
  }

  root.appendChild(svg);
  root.appendChild(tip);
  /* size each chip to its text now that it is in the document */
  for (const [t, rect, cx, cy] of labelBoxes) {
    const size = parseFloat(getComputedStyle(t).fontSize) || 21;
    const w = t.getComputedTextLength() + size * 1.6, h = size * 1.8;
    rect.setAttribute('x', (cx - w / 2).toFixed(1)); rect.setAttribute('y', (cy - h / 2).toFixed(1));
    rect.setAttribute('width', w.toFixed(1)); rect.setAttribute('height', h.toFixed(1)); rect.setAttribute('rx', (h / 2).toFixed(1));
  }

  let active = 0;
  function setActive(i) {
    if (i === active) return;
    active = i;
    root.classList.toggle('has-active', i > 0);
    stateEls.forEach((s, k) => { const on = k + 1 === i; s.dots.classList.toggle('is-on', on); s.outline.classList.toggle('is-on', on); });
    corridorEls.forEach((c) => c.path.classList.toggle('is-off', i > 0 && !c.states.includes(i)));
    placeEls.forEach((p) => p.g.classList.toggle('is-off', i > 0 && p.state !== i));
  }
  function reveal() {
    root.classList.add('is-ready');
    corridorEls.forEach((c) => { c.path.style.strokeDashoffset = 0; });
  }
  return { setActive, reveal, get active() { return active; } };
}
