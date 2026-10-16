import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.js';
import { acceptTurn, commitPreparedMotion, initialTailGuide, motionPath, prepareMotion } from '../src/motion.js';

function make({ walls = [], snake, random = () => 0.5 } = {}) {
  const level = {
    columns: 12, rows: 9, cellSize: 48, stepMs: 165,
    spawn: { x: 5, y: 4, direction: 'right', length: 3 },
    firstFood: { x: 10, y: 7 }, walls,
  };
  const game = createGame(level, random);
  if (snake) game.snake = structuredClone(snake);
  return game;
}

for (const phase of [0.05, 0.5, 0.95]) {
  test(`turning at ${phase * 100}% buffers input for the next node without rewriting the current cell`, () => {
    const game = make(), guide = initialTailGuide(game);
    const before = structuredClone(game.snake);
    const pending = prepareMotion(game, guide, 1000);
    // The display has already advanced, but the fixed grid step is still pending.
    assert.ok(motionPath(pending, phase).length > 0);
    const inputTime = 1000 + game.level.stepMs * phase;
    const result = acceptTurn(game, pending, guide, 'up', inputTime, phase);
    assert.equal(result.accepted, true);
    assert.equal(result.redirected, false);
    assert.strictEqual(result.motion, pending);
    assert.equal(result.motion.direction, 'right');
    assert.deepEqual(result.motion.next.snake[0], { x: 6, y: 4 });
    assert.strictEqual(game.queue, pending.next.queue);
    assert.deepEqual(game.queue, ['up']);
    assert.equal(game.direction, 'right');
    assert.deepEqual(game.snake, before);
    assert.equal(game.ticks, 0);
    assert.equal(game.status, 'running');
    // All phases settle at the original deadline, with exactly one grid step.
    const arrived = commitPreparedMotion(result.motion, 1000 + game.level.stepMs);
    assert.equal(arrived.direction, 'right');
    assert.equal(arrived.ticks, 1);
    assert.deepEqual(arrived.snake[0], { x: 6, y: 4 });
    assert.equal(arrived.snake.length, before.length);
    const next = prepareMotion(arrived, pending.tailGuide, 1000 + game.level.stepMs);
    assert.equal(next.direction, 'up');
    assert.deepEqual(next.next.snake[0], { x: 6, y: 3 }, 'turn uses the forward node, not the previous node');
    assert.deepEqual(next.next.queue, []);
    const turned = commitPreparedMotion(next, 1000 + game.level.stepMs * 2);
    assert.equal(turned.ticks, 2);
    assert.deepEqual(turned.snake[0], { x: 6, y: 3 });
  });
}

test('input at the current node may redirect a still-straight step without adding a logical step or resetting its deadline', () => {
  for (const phase of [0, 1e-9]) {
    const game = make(), guide = initialTailGuide(game);
    const before = structuredClone(game.snake);
    const pending = prepareMotion(game, guide, 1000);
    const redirected = acceptTurn(game, pending, guide, 'up', 1000, phase);
    assert.equal(redirected.accepted, true);
    assert.equal(redirected.redirected, true);
    assert.notStrictEqual(redirected.motion, pending);
    assert.equal(redirected.motion.direction, 'up');
    assert.deepEqual(redirected.motion.next.snake[0], { x: 5, y: 3 });
    assert.deepEqual(game.snake, before);
    assert.equal(game.ticks, 0);
    assert.deepEqual(game.queue, []);
    const arrived = commitPreparedMotion(redirected.motion, 1165);
    assert.equal(arrived.ticks, 1);
    assert.deepEqual(arrived.snake[0], { x: 5, y: 3 });
  }
});

test('once a turn begins, further valid turns stay queued for subsequent cells', () => {
  const game = make(), guide = initialTailGuide(game);
  const straight = prepareMotion(game, guide, 0);
  const first = acceptTurn(game, straight, guide, 'up', 0, 0);
  const second = acceptTurn(game, first.motion, guide, 'left', 60, 60 / 165);
  assert.equal(second.accepted, true);
  assert.equal(second.redirected, false);
  assert.strictEqual(second.motion, first.motion);
  assert.strictEqual(game.queue, first.motion.next.queue);
  assert.deepEqual(game.queue, ['left']);
  const third = acceptTurn(game, first.motion, guide, 'down', 80, 80 / 165);
  assert.equal(third.accepted, true);
  assert.equal(third.redirected, false);
  assert.deepEqual(first.motion.next.queue, ['left', 'down']);
  assert.equal(acceptTurn(game, first.motion, guide, 'right', 90, 90 / 165).accepted, false, 'queue remains bounded');

  const up = commitPreparedMotion(first.motion, 165);
  const left = prepareMotion(up, first.motion.tailGuide, 165);
  assert.equal(left.direction, 'left');
  assert.deepEqual(left.next.snake[0], { x: 4, y: 3 });
  assert.deepEqual(left.next.queue, ['down']);
  const down = prepareMotion(commitPreparedMotion(left, 330), left.tailGuide, 330);
  assert.equal(down.direction, 'down');
  assert.deepEqual(down.next.snake[0], { x: 4, y: 4 });
});

test('duplicate and reverse directions never replace the current pending step', () => {
  const game = make(), guide = initialTailGuide(game);
  const straight = prepareMotion(game, guide, 0);
  for (const direction of ['right', 'left', 'diagonal']) {
    const rejected = acceptTurn(game, straight, guide, direction, 70, 70 / 165);
    assert.equal(rejected.accepted, false);
    assert.equal(rejected.redirected, false);
    assert.strictEqual(rejected.motion, straight);
    assert.deepEqual(game.queue, []);
  }
  const up = acceptTurn(game, straight, guide, 'up', 0, 0).motion;
  for (const direction of ['up', 'down']) {
    const rejected = acceptTurn(game, up, guide, direction, 100, 100 / 165);
    assert.equal(rejected.accepted, false);
    assert.strictEqual(rejected.motion, up);
    assert.deepEqual(game.queue, []);
  }
});

test('a wall collision can be avoided while still at the node', () => {
  const game = make({ walls: [[6, 4]] }), guide = initialTailGuide(game);
  const blocked = prepareMotion(game, guide, 0);
  assert.deepEqual(blocked.event, { type: 'dead', reason: 'wall' });
  const redirected = acceptTurn(game, blocked, guide, 'up', 0, 0);
  assert.equal(redirected.redirected, true);
  assert.equal(game.status, 'running');
  const arrived = commitPreparedMotion(redirected.motion, 165);
  assert.equal(arrived.status, 'running');
  assert.equal(arrived.collision, null);
  assert.equal(arrived.ticks, 1);
  assert.deepEqual(arrived.snake[0], { x: 5, y: 3 });
});

test('a self collision can be avoided while still at the node without retaining its death state', () => {
  const game = make({ snake: [
    { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 3 }, { x: 5, y: 3 },
    { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 7, y: 4 },
  ] });
  const guide = initialTailGuide(game), blocked = prepareMotion(game, guide, 0);
  assert.deepEqual(blocked.event, { type: 'dead', reason: 'self' });
  const redirected = acceptTurn(game, blocked, guide, 'down', 0, 0);
  assert.equal(redirected.redirected, true);
  const arrived = commitPreparedMotion(redirected.motion, 165);
  assert.equal(arrived.status, 'running');
  assert.equal(arrived.collision, null);
  assert.deepEqual(arrived.snake[0], { x: 5, y: 5 });
  assert.equal(arrived.snake.length, 7);
});

test('late buffered input cannot undo the wall or self collision of a cell already being traversed', () => {
  const scenarios = [
    { game: make({ walls: [[6, 4]] }), direction: 'up', reason: 'wall' },
    { game: make({ snake: [
      { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 3 }, { x: 5, y: 3 },
      { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 7, y: 4 },
    ] }), direction: 'down', reason: 'self' },
  ];
  for (const { game, direction, reason } of scenarios) {
    const guide = initialTailGuide(game), before = structuredClone(game.snake);
    const blocked = prepareMotion(game, guide, 0);
    assert.deepEqual(blocked.event, { type: 'dead', reason });
    const buffered = acceptTurn(game, blocked, guide, direction, 148.5, 0.9);
    assert.equal(buffered.accepted, true);
    assert.equal(buffered.redirected, false);
    assert.strictEqual(buffered.motion, blocked);
    assert.equal(buffered.motion.direction, 'right');
    assert.equal(game.status, 'running');
    assert.deepEqual(game.snake, before);
    assert.equal(game.ticks, 0);
    const arrived = commitPreparedMotion(buffered.motion, 165);
    assert.equal(arrived.status, 'dead');
    assert.equal(arrived.collision.type, reason);
    assert.deepEqual(arrived.collision.at, { x: 6, y: 4 });
    assert.deepEqual(arrived.snake, before);
    assert.equal(arrived.ticks, 0);
  }
});

test('discarding predicted growth consumes no random values and commits no food, score or length change', () => {
  let randomCalls = 0;
  const game = make({ random: () => { randomCalls++; return 0.9; } });
  const guide = initialTailGuide(game), before = structuredClone(game.snake);
  game.food = { x: 6, y: 4 };
  const growth = prepareMotion(game, guide, 0);
  assert.equal(growth.event.type, 'eat');
  assert.equal(randomCalls, 0);
  const redirected = acceptTurn(game, growth, guide, 'up', 0, 0);
  assert.equal(redirected.redirected, true);
  const arrived = commitPreparedMotion(redirected.motion, 165);
  assert.equal(arrived.score, 0);
  assert.equal(arrived.snake.length, before.length);
  assert.deepEqual(arrived.food, { x: 6, y: 4 });
  assert.equal(arrived.lastEatAt, -Infinity);
  assert.equal(randomCalls, 0);
  assert.deepEqual(game.snake, before);
  assert.equal(game.score, 0);
});

test('actual growth selects food once at commit, using the real random source and actual commit time', () => {
  let randomCalls = 0;
  const game = make({ random: () => { randomCalls++; return 0.999; } });
  game.food = { x: 5, y: 3 };
  const guide = initialTailGuide(game), straight = prepareMotion(game, guide, 1000);
  const growth = acceptTurn(game, straight, guide, 'up', 1000, 0).motion;
  assert.equal(growth.event.type, 'eat');
  assert.equal(randomCalls, 0);
  assert.equal(game.score, 0);
  assert.deepEqual(game.food, { x: 5, y: 3 });
  const arrived = commitPreparedMotion(growth, 1170);
  assert.equal(randomCalls, 1);
  assert.equal(arrived.score, 1);
  assert.equal(arrived.ticks, 1);
  assert.equal(arrived.snake.length, 4);
  assert.equal(arrived.lastEatAt, 1170);
  assert.deepEqual(arrived.food, { x: 11, y: 8 }, 'real random chooses the last free cell');
  assert.strictEqual(commitPreparedMotion(growth, 1300), arrived);
  assert.equal(randomCalls, 1);
  assert.equal(arrived.lastEatAt, 1170);
  assert.strictEqual(arrived.random, game.random);
});

test('eating the final free cell wins once without trying to generate unavailable food', () => {
  let randomCalls = 0;
  const game = createGame({
    columns: 4, rows: 4, cellSize: 48, stepMs: 165,
    spawn: { x: 2, y: 3, direction: 'right', length: 2 },
    firstFood: { x: 3, y: 3 }, walls: [],
  }, () => { randomCalls++; return 0.5; });
  game.snake = [
    { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 2 },
    { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 1 },
    { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 },
    { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
  ];
  const pending = prepareMotion(game, initialTailGuide(game), 40);
  assert.equal(pending.event.type, 'won');
  assert.equal(game.status, 'running');
  assert.equal(game.snake.length, 15);
  const arrived = commitPreparedMotion(pending, 165);
  assert.equal(arrived.status, 'won');
  assert.equal(arrived.snake.length, 16);
  assert.equal(arrived.score, 1);
  assert.equal(arrived.ticks, 1);
  assert.equal(arrived.food, null);
  assert.equal(arrived.lastEatAt, 165);
  assert.equal(randomCalls, 0);
  assert.strictEqual(commitPreparedMotion(pending, 330), arrived);
  assert.equal(randomCalls, 0);
});

test('input before motion preparation queues normally, and paused input is rejected', () => {
  const game = make(), guide = initialTailGuide(game);
  const queued = acceptTurn(game, null, guide, 'up', 0);
  assert.equal(queued.accepted, true);
  assert.equal(queued.redirected, false);
  assert.equal(queued.motion, null);
  assert.deepEqual(game.queue, ['up']);
  game.status = 'paused';
  const rejected = acceptTurn(game, null, guide, 'left', 20);
  assert.equal(rejected.accepted, false);
  assert.deepEqual(game.queue, ['up']);
});
