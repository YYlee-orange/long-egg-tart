import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, queueTurn, mod, DIRECTIONS } from '../src/engine.js';
import { initialTailGuide, restPath, prepareMotion, motionPath, commitPreparedMotion } from '../src/motion.js';
import { neckBodyPath } from '../src/curves.js';
import { at, materialRecords, verifyGeometry } from '../assets/snake/source/body-geometry-v2.mjs';

const level = JSON.parse(await readFile(new URL('../levels/open-table.json', import.meta.url), 'utf8'));
const shapes = JSON.parse(await readFile(new URL('../assets/snake/source/decal-shapes-v5.json', import.meta.url), 'utf8')).shapes;
const EPS = 1e-7;

function near(actual, expected, message) {
  assert.equal(actual.length, expected.length, message);
  for (let i = 0; i < actual.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) < EPS, `${message}: ${actual} vs ${expected}`);
}

function make(snake, direction = 'right') {
  const game = createGame(structuredClone(level), () => 0.37);
  if (snake) game.snake = structuredClone(snake);
  game.direction = direction;
  game.food = null; // Geometry scenarios must not accidentally grow at the level's first food.
  return game;
}

function texturePoints(record, path) {
  const shape = shapes[record.variant], bounds = shape.bounds;
  const center = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
  const cosine = Math.cos(record.angle), sine = Math.sin(record.angle);
  return shape.contours.flatMap(contour => contour.map(point => {
    const u = (point[0] - center[0]) / bounds.width * record.length;
    const v = (point[1] - center[1]) / bounds.height * record.breadth;
    const sample = at(path, record.m + u * cosine - v * sine);
    const lateral = record.lateral + u * sine + v * cosine;
    return [sample.p[0] + sample.n[0] * lateral, sample.p[1] + sample.n[1] * lateral];
  }));
}

function sameVisiblePath(a, b, label) {
  near([a.length], [b.length], `${label}: total length`);
  for (let i = 0; i <= 80; i++) {
    const s = a.length * i / 80, before = at(a, s), after = at(b, s);
    near(before.p, after.p, `${label}: point ${i}`);
    near(before.t, after.t, `${label}: tangent ${i}`);
  }
  const visible = materialRecords(a.length, level.cellSize * 2 / 3, 20261016)
    .filter(record => record.m - record.length > 0 && record.m + record.length < a.length);
  assert.ok(visible.length > 0, `${label}: checks actual visible texture shapes`);
  for (const record of visible) {
    const before = texturePoints(record, a), after = texturePoints(record, b);
    assert.equal(before.length, after.length);
    before.forEach((point, i) => near(point, after[i], `${label}: ${record.id} contour ${i}`));
  }
}

function commitAndCheck(game, tailGuide, direction, nextDirection, tick = 0) {
  if (direction !== game.direction) assert.equal(queueTurn(game, direction), true);
  const motion = prepareMotion(game, tailGuide, tick * level.stepMs);
  assert.equal(motion.event.type, 'move');
  const arrived = motionPath(motion, 1);
  const nextGame = motion.next;
  if (nextDirection !== nextGame.direction) assert.equal(queueTurn(nextGame, nextDirection), true);
  const nextMotion = prepareMotion(nextGame, motion.tailGuide, (tick + 1) * level.stepMs);
  sameVisiblePath(arrived, motionPath(nextMotion, 0), `${direction} to ${nextDirection}`);
  return { game: nextGame, tailGuide: motion.tailGuide, motion };
}

test('preparing a smooth movement reserves input but commits no position, food, score or tick', () => {
  const game = make();
  const guide = initialTailGuide(game);
  game.food = { x: game.snake[0].x, y: game.snake[0].y - 1 };
  assert.equal(queueTurn(game, 'up'), true);
  const before = structuredClone({ snake: game.snake, direction: game.direction, food: game.food, score: game.score, ticks: game.ticks, status: game.status });
  const motion = prepareMotion(game, guide, 1000);
  assert.deepEqual({ snake: game.snake, direction: game.direction, food: game.food, score: game.score, ticks: game.ticks, status: game.status }, before);
  assert.equal(motion.event.type, 'eat');
  assert.equal(motion.next.score, 1);
  assert.equal(motion.next.ticks, 1);
  assert.equal(motion.next.lastEatAt, 1000 + level.stepMs);
  assert.equal(motion.next.snake.length, game.snake.length + 1);
  assert.notStrictEqual(motion.next.snake[1], game.snake[0]);
  assert.strictEqual(game.queue, motion.next.queue);
  assert.equal(game.queue.length, 0);
});

test('new input uses the reserved moving direction and remains shared with the next simulation state', () => {
  const game = make();
  assert.equal(queueTurn(game, 'up'), true);
  const motion = prepareMotion(game, initialTailGuide(game), 0);
  assert.equal(game.direction, 'right');
  assert.equal(motion.direction, 'up');
  assert.equal(queueTurn(game, 'down', motion.direction), false);
  assert.equal(queueTurn(game, 'left', motion.direction), true);
  assert.equal(queueTurn(game, 'down', motion.direction), true);
  assert.deepEqual(motion.next.queue, ['left', 'down']);
  assert.equal(queueTurn(game, 'right', motion.direction), false);
  const next = prepareMotion(motion.next, motion.tailGuide, level.stepMs);
  assert.equal(next.direction, 'left');
  assert.deepEqual(next.next.queue, ['down']);
});

test('rest, straight movement and a turn meet without a head, tail, tangent or texture discontinuity', () => {
  const game = make(), guide = initialTailGuide(game);
  const motion = prepareMotion(game, guide, 0);
  sameVisiblePath(restPath(game, guide), motionPath(motion, 0), 'rest to first motion');
  commitAndCheck(game, guide, 'right', 'up');
});

test('successive S bends remain tangent and every step boundary preserves visible texture geometry', () => {
  let game = make(), guide = initialTailGuide(game);
  const directions = ['up', 'right', 'up', 'right', 'up', 'right', 'up', 'right', 'up', 'right'];
  for (let i = 0; i < directions.length - 1; i++) {
    const result = commitAndCheck(game, guide, directions[i], directions[i + 1], i);
    for (const alpha of [0, 0.15, 0.5, 0.85, 1]) {
      const path = motionPath(result.motion, alpha);
      const geometry = verifyGeometry(path, level.cellSize * 2 / 3);
      assert.ok(geometry.maxGap < EPS && geometry.maxTangentError < EPS);
    }
    game = result.game;
    guide = result.tailGuide;
    // The helper predicts the following step only for comparison; each loop starts a fresh prediction.
    game.queue.length = 0;
  }
});

test('the tail exits a bend continuously using its real departing history', () => {
  const game = make([{ x: 6, y: 2 }, { x: 5, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }]);
  const historicalGuide = { x: 3, y: 3 }; // Last removed cell: the tail entered from the left.
  const extrapolatedGuide = initialTailGuide(game);
  assert.notDeepEqual(historicalGuide, extrapolatedGuide);
  const motion = prepareMotion(game, historicalGuide, 0);
  sameVisiblePath(restPath(game, historicalGuide), motionPath(motion, 0), 'historical tail at start');
  assert.deepEqual(motion.tailGuide, game.snake.at(-1));
  const tailBefore = at(motionPath(motion, 0), motionPath(motion, 0).length);
  const tailMiddle = at(motionPath(motion, 0.5), motionPath(motion, 0.5).length);
  assert.ok(Math.abs(tailMiddle.t[0]) > 0.1 && Math.abs(tailMiddle.t[1]) > 0.1, 'tail actually traverses the quarter circle');
  assert.notDeepEqual(tailBefore.p, tailMiddle.p);
  const nextMotion = prepareMotion(motion.next, motion.tailGuide, level.stepMs);
  sameVisiblePath(motionPath(motion, 1), motionPath(nextMotion, 0), 'tail leaving bend');
});

test('growth holds the tail and its history still throughout the entire movement', () => {
  const game = make([{ x: 6, y: 2 }, { x: 5, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }]);
  const guide = { x: 3, y: 3 };
  game.food = { x: 7, y: 2 };
  const motion = prepareMotion(game, guide, 0);
  assert.equal(motion.event.type, 'eat');
  assert.deepEqual(motion.tailGuide, guide);
  assert.equal(motion.tailFrom, motion.tailTo);
  const original = restPath(game, guide), tail = at(original, original.length);
  for (const alpha of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
    const path = motionPath(motion, alpha), sample = at(path, path.length);
    near(sample.p, tail.p, `growth tail at ${alpha}`);
    near(sample.t, tail.t, `growth tail tangent at ${alpha}`);
  }
  motion.next.food = null;
  const nextMotion = prepareMotion(motion.next, motion.tailGuide, level.stepMs);
  sameVisiblePath(motionPath(motion, 1), motionPath(nextMotion, 0), 'growth to following movement');
});

test('all four screen crossings preserve unwrapped paths, wrapped positions and step-boundary continuity', () => {
  const { columns, rows, cellSize } = level;
  const cases = [
    ['right', [{ x: columns - 1, y: 5 }, { x: columns - 2, y: 5 }, { x: columns - 3, y: 5 }], [0, 5]],
    ['left', [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }], [columns - 1, 5]],
    ['up', [{ x: 8, y: 0 }, { x: 8, y: 1 }, { x: 8, y: 2 }], [8, rows - 1]],
    ['down', [{ x: 8, y: rows - 1 }, { x: 8, y: rows - 2 }, { x: 8, y: rows - 3 }], [8, 0]],
  ];
  for (const [direction, snake, expected] of cases) {
    const game = make(snake, direction), guide = initialTailGuide(game);
    const { motion } = commitAndCheck(game, guide, direction, direction);
    assert.deepEqual([mod(motion.next.snake[0].x, columns), mod(motion.next.snake[0].y, rows)], expected);
    const start = at(motionPath(motion, 0), 0).p;
    const end = at(motionPath(motion, 1), 0).p;
    near([Math.hypot(end[0] - start[0], end[1] - start[1])], [cellSize], `${direction}: no full-screen interpolation`);
    const midpoint = at(motionPath(motion, 0.5), 0).p;
    near(midpoint, [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2], `${direction}: continuous half-step`);
  }
});

test('collision prediction does not end the live game or move its cells early', () => {
  const game = make(), guide = initialTailGuide(game);
  game.walls.add(`${game.snake[0].x + 1},${game.snake[0].y}`);
  const before = structuredClone(game.snake);
  const motion = prepareMotion(game, guide, 0);
  assert.equal(game.status, 'running');
  assert.deepEqual(game.snake, before);
  assert.equal(game.ticks, 0);
  assert.deepEqual(motion.event, { type: 'dead', reason: 'wall' });
  assert.equal(motion.next.status, 'dead');
  assert.deepEqual(motion.next.snake, before);
  assert.deepEqual(motion.tailGuide, guide);
});

test('the visible head pivot matches the real grid nodes for straight moves and all four rounded turns', () => {
  const turns = { right: 'up', up: 'left', left: 'down', down: 'right' };
  const center = point => [(point.x + 0.5) * level.cellSize, (point.y + 0.5) * level.cellSize];
  for (const direction of Object.keys(DIRECTIONS)) {
    const vector = DIRECTIONS[direction];
    for (const nextDirection of [direction, turns[direction]]) {
      const game = make(Array.from({ length: 5 }, (_, i) => ({ x: 10 - vector.x * i, y: 5 - vector.y * i })), direction);
      const guide = initialTailGuide(game);
      const rest = neckBodyPath(restPath(game, guide), 19.25, level.cellSize / 2);
      near(rest.head.p, center(game.snake[0]), `${direction}: rest head is on its interaction node`);
      if (nextDirection !== direction) queueTurn(game, nextDirection);
      const motion = prepareMotion(game, guide, 0);
      const start = neckBodyPath(motionPath(motion, 0), 19.25, level.cellSize / 2);
      const end = neckBodyPath(motionPath(motion, 1), 19.25, level.cellSize / 2);
      near(start.head.p, center(game.snake[0]), `${direction}/${nextDirection}: departure node`);
      near(end.head.p, center(motion.next.snake[0]), `${direction}/${nextDirection}: arrival node`);
      const following = prepareMotion(motion.next, motion.tailGuide, level.stepMs);
      const followingStart = neckBodyPath(motionPath(following, 0), 19.25, level.cellSize / 2);
      near(end.head.p, followingStart.head.p, `${direction}/${nextDirection}: head does not jump at commit`);
      near(end.head.t, followingStart.head.t, `${direction}/${nextDirection}: heading does not jump at commit`);
      if (nextDirection === direction) for (const progress of [0.25, 0.5, 0.75]) {
        const pose = neckBodyPath(motionPath(motion, progress), 19.25, level.cellSize / 2);
        near(pose.head.p, center(game.snake[0]).map((v, axis) => v + [vector.x, vector.y][axis] * level.cellSize * progress), `${direction}: continuous head progress ${progress}`);
      }
    }
  }
});

test('food and wall events settle when the visible head reaches their interaction node', () => {
  for (const blocked of [false, true]) {
    const game = make(), guide = initialTailGuide(game);
    const target = { x: game.snake[0].x + 1, y: game.snake[0].y };
    if (blocked) game.walls.add(`${target.x},${target.y}`);
    else game.food = target;
    const motion = prepareMotion(game, guide, 0);
    const end = neckBodyPath(motionPath(motion, 1), 19.25, level.cellSize / 2);
    near(end.head.p, [(target.x + 0.5) * level.cellSize, (target.y + 0.5) * level.cellSize], `${blocked ? 'wall' : 'food'}: visible head and target node agree`);
    assert.equal(game.status, 'running');
    assert.equal(game.score, 0);
    const committed = commitPreparedMotion(motion, level.stepMs);
    if (blocked) assert.deepEqual(committed.collision.at, target);
    else { assert.equal(committed.score, 1); assert.deepEqual(committed.snake[0], target); }
  }
});
