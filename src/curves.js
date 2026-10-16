// Presentation geometry only: these curves never change grid movement or collision.
const EPS = 1e-9;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const normalized = (v, fallback = [1, 0]) => {
  const length = Math.hypot(...v);
  return length > EPS ? [v[0] / length, v[1] / length] : [...fallback];
};
const coordinates = p => p.map(value => Number(value.toFixed(6))).join(' ');
const curveCache = new WeakMap();

function cubicPoint(part, t) {
  const q = 1 - t;
  return [0, 1].map(axis => q ** 3 * part.a[axis] + 3 * q * q * t * part.c1[axis]
    + 3 * q * t * t * part.c2[axis] + t ** 3 * part.b[axis]);
}

function cubicDerivative(part, t) {
  const q = 1 - t;
  return [0, 1].map(axis => 3 * q * q * (part.c1[axis] - part.a[axis])
    + 6 * q * t * (part.c2[axis] - part.c1[axis]) + 3 * t * t * (part.b[axis] - part.c2[axis]));
}

// Five point Gauss integration makes the LUT accurate without a dense polygon.
const QUADRATURE = [
  [0, 0.5688888888888889],
  [-0.5384693101056831, 0.4786286704993665], [0.5384693101056831, 0.4786286704993665],
  [-0.906179845938664, 0.2369268850561891], [0.906179845938664, 0.2369268850561891],
];

function cubicLength(part, from, to) {
  const half = (to - from) / 2, middle = (from + to) / 2;
  let total = 0;
  for (const [offset, weight] of QUADRATURE) total += weight * Math.hypot(...cubicDerivative(part, middle + half * offset));
  return total * half;
}

function curveMetrics(part) {
  if (curveCache.has(part)) return curveCache.get(part);
  const polygon = distance(part.a, part.c1) + distance(part.c1, part.c2) + distance(part.c2, part.b);
  const count = clamp(Math.ceil(polygon / 4), 4, 256);
  const lut = [{ t: 0, s: 0 }];
  let length = 0;
  for (let i = 1; i <= count; i++) {
    length += cubicLength(part, (i - 1) / count, i / count);
    lut.push({ t: i / count, s: length });
  }
  const result = { length, lut };
  curveCache.set(part, result);
  return result;
}

function cubicParameter(part, s) {
  const { length, lut } = curveMetrics(part);
  if (length <= EPS || s <= 0) return 0;
  if (s >= length) return 1;
  let low = 0, high = lut.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (lut[middle].s <= s) low = middle; else high = middle;
  }
  const a = lut[low], b = lut[high], span = b.s - a.s;
  let t = a.t + (b.t - a.t) * (span > EPS ? (s - a.s) / span : 0);
  // Refine within the LUT interval; endpoints remain exact, including slices.
  for (let i = 0; i < 2; i++) {
    const speed = Math.hypot(...cubicDerivative(part, t));
    if (speed <= EPS) break;
    t = clamp(t - (a.s + cubicLength(part, a.t, t) - s) / speed, a.t, b.t);
  }
  return t;
}

function primitiveSample(part, localDistance) {
  const fraction = part.length > EPS ? clamp(localDistance / part.length, 0, 1) : 0;
  let p, tangent;
  if (part.kind === 'line') {
    p = mix(part.a, part.b, fraction);
    tangent = normalized([part.b[0] - part.a[0], part.b[1] - part.a[1]]);
  } else if (part.kind === 'arc') {
    const angle = part.theta + part.delta * fraction, sign = Math.sign(part.delta) || 1;
    p = [part.c[0] + part.r * Math.cos(angle), part.c[1] + part.r * Math.sin(angle)];
    tangent = [-Math.sin(angle) * sign, Math.cos(angle) * sign];
  } else {
    const t = cubicParameter(part, localDistance);
    p = cubicPoint(part, t);
    const fallback = normalized([part.b[0] - part.a[0], part.b[1] - part.a[1]]);
    tangent = normalized(cubicDerivative(part, t), fallback);
  }
  return { p, t: tangent, n: [-tangent[1], tangent[0]] };
}

export function samplePath(path, s = 0) {
  if (!path.parts.length) {
    const tangent = normalized(path.tangent ?? [1, 0]);
    return { p: [...(path.anchor ?? [0, 0])], t: tangent, n: [-tangent[1], tangent[0]] };
  }
  s = clamp(Number.isFinite(s) ? s : 0, 0, path.length);
  let low = 0, high = path.parts.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1, part = path.parts[middle];
    if (s <= part.start + part.length) high = middle; else low = middle + 1;
  }
  const part = path.parts[low];
  return primitiveSample(part, s - part.start);
}

export function makeCurvePath(primitives) {
  const parts = [];
  let length = 0;
  for (const source of primitives) {
    const part = { ...source, a: [...source.a], b: [...source.b] };
    if (part.kind === 'line') part.length = distance(part.a, part.b);
    else if (part.kind === 'arc') {
      part.c = [...source.c];
      part.length = Math.abs(part.r * part.delta);
      part.a = [part.c[0] + part.r * Math.cos(part.theta), part.c[1] + part.r * Math.sin(part.theta)];
      part.b = [part.c[0] + part.r * Math.cos(part.theta + part.delta), part.c[1] + part.r * Math.sin(part.theta + part.delta)];
    } else if (part.kind === 'cubic') {
      part.c1 = [...source.c1]; part.c2 = [...source.c2];
      part.length = curveMetrics(part).length;
    } else throw new Error(`Unsupported curve primitive: ${part.kind}`);
    if (!Number.isFinite(part.length) || ![...part.a, ...part.b].every(Number.isFinite)) throw new Error('Non-finite curve geometry');
    if (part.length <= EPS) continue;
    part.start = length;
    length += part.length;
    parts.push(part);
  }
  let d = parts.length ? `M ${coordinates(parts[0].a)}` : '';
  for (const part of parts) {
    if (part.kind === 'line') d += ` L ${coordinates(part.b)}`;
    else if (part.kind === 'cubic') d += ` C ${coordinates(part.c1)} ${coordinates(part.c2)} ${coordinates(part.b)}`;
    else d += ` A ${part.r} ${part.r} 0 ${Math.abs(part.delta) > Math.PI ? 1 : 0} ${part.delta > 0 ? 1 : 0} ${coordinates(part.b)}`;
  }
  return { parts, length, d, anchor: [...(parts[0]?.a ?? primitives[0]?.a ?? [0, 0])] };
}

function splitCubic(part, t) {
  const ab = mix(part.a, part.c1, t), bc = mix(part.c1, part.c2, t), cd = mix(part.c2, part.b, t);
  const abc = mix(ab, bc, t), bcd = mix(bc, cd, t), point = mix(abc, bcd, t);
  return [
    { kind: 'cubic', a: [...part.a], c1: ab, c2: abc, b: point },
    { kind: 'cubic', a: point, c1: bcd, c2: cd, b: [...part.b] },
  ];
}

export function sliceCurvePath(path, from = 0, to = path.length) {
  from = clamp(Number.isFinite(from) ? from : 0, 0, path.length);
  to = clamp(Number.isFinite(to) ? to : path.length, from, path.length);
  const parts = [];
  for (const part of path.parts) {
    const start = Math.max(from, part.start), end = Math.min(to, part.start + part.length);
    if (end - start <= EPS) continue;
    if (part.kind === 'line') parts.push({ kind: 'line', a: primitiveSample(part, start - part.start).p, b: primitiveSample(part, end - part.start).p });
    else if (part.kind === 'arc') parts.push({ ...part, theta: part.theta + part.delta * (start - part.start) / part.length, delta: part.delta * (end - start) / part.length });
    else {
      const t0 = cubicParameter(part, start - part.start), t1 = cubicParameter(part, end - part.start);
      const prefix = t1 < 1 ? splitCubic(part, t1)[0] : part;
      parts.push(t0 > EPS && t1 > EPS ? splitCubic(prefix, t0 / t1)[1] : prefix);
    }
  }
  const result = makeCurvePath(parts);
  if (!result.parts.length) {
    const sample = samplePath(path, from);
    result.anchor = sample.p; result.tangent = sample.t;
  }
  return result;
}

export function blendCurvePaths(source, target, weight) {
  weight = clamp(Number.isFinite(weight) ? weight : 0, 0, 1);
  if (weight === 0) return source;
  if (weight === 1) return target;
  const count = Math.max(1, Math.ceil(Math.max(source.length, target.length) / 5));
  const samples = [];
  for (let i = 0; i <= count; i++) {
    const fraction = i / count, a = samplePath(source, source.length * fraction), b = samplePath(target, target.length * fraction);
    samples.push({
      p: mix(a.p, b.p, weight),
      derivative: mix(a.t.map(v => v * source.length), b.t.map(v => v * target.length), weight),
    });
  }
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = samples[i], b = samples[i + 1], scale = 1 / (3 * count);
    parts.push({ kind: 'cubic', a: a.p, c1: a.p.map((v, axis) => v + a.derivative[axis] * scale), c2: b.p.map((v, axis) => v - b.derivative[axis] * scale), b: b.p });
  }
  const result = makeCurvePath(parts);
  if (!result.parts.length) result.anchor = samples[0].p;
  return result;
}

export function neckBodyPath(path, neckDistance, headOffset = neckDistance) {
  const leading = samplePath(path, 0);
  neckDistance = Math.max(0, Number.isFinite(neckDistance) ? neckDistance : 0);
  headOffset = Math.max(0, Number.isFinite(headOffset) ? headOffset : neckDistance);
  // Keep the rigid face on its interaction anchor. A short tangent extension
  // attaches the neck to the original curve without tightening that curve.
  const head = { ...leading, p: leading.p.map((v, axis) => v - leading.t[axis] * headOffset) };
  const neckAnchor = head.p.map((v, axis) => v + leading.t[axis] * neckDistance);
  const body = Math.abs(headOffset - neckDistance) <= EPS ? path
    : makeCurvePath([{ kind: 'line', a: neckAnchor, b: leading.p }, ...path.parts]);
  return { body, head, neckAnchor };
}
