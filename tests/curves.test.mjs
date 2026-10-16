import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCurvePath, samplePath, sliceCurvePath, blendCurvePaths, neckBodyPath } from '../src/curves.js';
import { roundOrthogonal, at } from '../assets/snake/source/body-geometry-v2.mjs';

const near = (actual, expected, tolerance = 1e-6) => {
  for (let i = 0; i < actual.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) <= tolerance, `${actual} vs ${expected}`);
};
const line = (a, b) => ({ kind: 'line', a, b });
const cubic = { kind: 'cubic', a: [0, 0], c1: [35, 0], c2: [60, 25], b: [60, 60] };

test('line and circular paths retain their existing position and tangent sampling', () => {
  const original = roundOrthogonal([[0, 0], [100, 0], [100, 100]], 24);
  const copy = makeCurvePath(original.parts);
  assert.equal(copy.length, original.length);
  for (let i = 0; i <= 100; i++) {
    const distance = original.length * i / 100;
    near(samplePath(copy, distance).p, at(original, distance).p);
    near(samplePath(copy, distance).t, at(original, distance).t);
  }
});

test('cubic arc length sampling preserves endpoint positions and tangent directions', () => {
  const path = makeCurvePath([cubic]);
  assert.ok(path.length > Math.hypot(60, 60));
  assert.match(path.d, / C /);
  near(samplePath(path, 0).p, cubic.a);
  near(samplePath(path, path.length).p, cubic.b);
  near(samplePath(path, 0).t, [1, 0]);
  near(samplePath(path, path.length).t, [0, 1]);
  const steps = Array.from({ length: 20 }, (_, i) => {
    const a = samplePath(path, path.length * i / 20).p, b = samplePath(path, path.length * (i + 1) / 20).p;
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
  assert.ok(Math.max(...steps) - Math.min(...steps) < 0.02, 'equal arc lengths produce nearly equal short chords');
});

test('slicing keeps exact line, arc and cubic primitive types and continuous arc length coordinates', () => {
  const arc = roundOrthogonal([[60, 60], [60, 120], [120, 120]], 20);
  const path = makeCurvePath([line([-20, 0], [0, 0]), cubic, ...arc.parts]);
  const from = 32, to = path.length - 17, slice = sliceCurvePath(path, from, to);
  assert.ok(slice.parts.some(part => part.kind === 'cubic'));
  assert.ok(slice.parts.some(part => part.kind === 'arc'));
  assert.ok(slice.parts.some(part => part.kind === 'line'));
  assert.ok(Math.abs(slice.length - (to - from)) < 1e-6);
  for (let i = 0; i <= 100; i++) {
    const distance = slice.length * i / 100;
    near(samplePath(slice, distance).p, samplePath(path, from + distance).p, 1e-5);
    near(samplePath(slice, distance).t, samplePath(path, from + distance).t, 1e-5);
  }
});

test('blend endpoints follow their weighted source and target without changing either endpoint path', () => {
  const source = makeCurvePath([line([0, 0], [140, 0])]);
  const target = makeCurvePath([cubic, line([60, 60], [60, 180])]);
  assert.strictEqual(blendCurvePaths(source, target, 0), source);
  assert.strictEqual(blendCurvePaths(source, target, 1), target);
  for (const weight of [0.001, 0.2, 0.5, 0.8, 0.999]) {
    const path = blendCurvePaths(source, target, weight);
    near(samplePath(path, 0).p, [0, 0]);
    near(samplePath(path, path.length).p, [140 * (1 - weight) + 60 * weight, 180 * weight]);
    for (let i = 0; i < path.parts.length - 1; i++) {
      const a = makeCurvePath([path.parts[i]]), b = makeCurvePath([path.parts[i + 1]]);
      near(samplePath(a, a.length).p, samplePath(b, 0).p);
      near(samplePath(a, a.length).t, samplePath(b, 0).t);
    }
    const expected = [140 * (1 - weight), target.length * weight];
    const length = Math.hypot(...expected);
    near(samplePath(path, path.length).t, expected.map(value => value / length));
  }
});

test('the head extends from the exact neck tangent without introducing a tighter body curve', () => {
  const path = sliceCurvePath(roundOrthogonal([[0, 0], [70, 0], [70, 100]], 24), 56);
  const { body, head, neckAnchor } = neckBodyPath(path, 19.25);
  const leading = samplePath(path, 0);
  assert.strictEqual(body, path, 'the original circular primitives and radius remain unchanged');
  near(neckAnchor, leading.p);
  near(neckAnchor, head.p.map((v, axis) => v + head.t[axis] * 19.25));
  near(head.t, leading.t);
  near(head.n, leading.n);
  near(samplePath(body, 0).p, neckAnchor);
  for (let i = 0; i <= 30; i++) {
    near(samplePath(body, body.length * i / 30).p, samplePath(path, path.length * i / 30).p);
    near(samplePath(body, body.length * i / 30).t, samplePath(path, path.length * i / 30).t);
  }
});

test('straight necks use the same forward head offset without trimming the material path', () => {
  const path = makeCurvePath([line([0, 0], [150, 0])]);
  const { body, head, neckAnchor } = neckBodyPath(path, 19.25);
  assert.strictEqual(body, path);
  near(head.p, [-19.25, 0]);
  near(neckAnchor, [0, 0]);
  assert.equal(body.length, 150);
  for (let i = 0; i <= 30; i++) near(samplePath(body, body.length * i / 30).p, samplePath(path, body.length * i / 30).p);
});

test('empty, zero length, short sliced curves and opposing blends stay finite', () => {
  const empty = makeCurvePath([line([3, 4], [3, 4]), { ...cubic, a: [3, 4], c1: [3, 4], c2: [3, 4], b: [3, 4] }]);
  near(samplePath(empty, 0).p, [3, 4]);
  assert.equal(empty.length, 0);
  const path = makeCurvePath([cubic]);
  const slice = sliceCurvePath(path, 16, 16);
  near(samplePath(slice, 0).p, samplePath(path, 16).p);
  const short = neckBodyPath(makeCurvePath([line([0, 0], [10, 0])]), 19.25);
  assert.equal(short.body.length, 10);
  near(short.head.p, [-19.25, 0]);
  near(short.neckAnchor, [0, 0]);
  const opposing = blendCurvePaths(makeCurvePath([line([0, 0], [100, 0])]), makeCurvePath([line([100, 0], [0, 0])]), 0.5);
  for (const candidate of [empty, slice, short.body, opposing]) {
    const sample = samplePath(candidate, candidate.length * 0.5);
    assert.ok([...sample.p, ...sample.t, ...sample.n, candidate.length].every(Number.isFinite));
  }
});

test('a half-cell head offset aligns all four head pivots with their grid centers', () => {
  for (const forward of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const leading = [100 - forward[0] * 24, 100 - forward[1] * 24];
    const path = makeCurvePath([line(leading, leading.map((v, axis) => v - forward[axis] * 150))]);
    const { body, head, neckAnchor } = neckBodyPath(path, 19.25, 24);
    near(head.p, [100, 100]);
    near(neckAnchor, leading.map((v, axis) => v + forward[axis] * 4.75));
    near(samplePath(body, 0).p, neckAnchor);
    near(samplePath(body, 0).t, head.t);
    near(samplePath(body, 4.75).p, leading);
    assert.ok(Math.abs(body.length - (path.length + 4.75)) < 1e-7);
  }
});

test('a half-cell head offset adds a tangent extension while preserving arc endpoints and radius', () => {
  const full = roundOrthogonal([[0, 0], [70, 0], [70, 100]], 24);
  for (const from of [46, 56, 46 + Math.PI * 12]) {
    const path = sliceCurvePath(full, from);
    const { body, head, neckAnchor } = neckBodyPath(path, 19.25, 24);
    const leading = samplePath(path, 0);
    near(head.p, leading.p.map((v, axis) => v - leading.t[axis] * 24));
    near(neckAnchor, head.p.map((v, axis) => v + head.t[axis] * 19.25));
    assert.equal(body.parts[0].kind, 'line');
    assert.ok(Math.abs(body.parts[0].length - 4.75) < 1e-7);
    near(samplePath(body, 4.75).p, leading.p);
    near(samplePath(body, 4.75).t, leading.t);
    if (body.parts.length > 1) {
      const extension = makeCurvePath([body.parts[0]]), original = makeCurvePath(body.parts.slice(1));
      near(samplePath(extension, extension.length).t, samplePath(original, 0).t);
    }
    for (const part of body.parts) if (part.kind === 'arc') assert.equal(part.r, 24);
    for (let i = 0; i <= 30; i++) {
      const distance = path.length * i / 30;
      near(samplePath(body, 4.75 + distance).p, samplePath(path, distance).p);
      near(samplePath(body, 4.75 + distance).t, samplePath(path, distance).t);
    }
  }
});
