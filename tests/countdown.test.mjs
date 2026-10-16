import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceCountdown, createCountdown, remainingSeconds, timeBudget } from '../src/countdown.js';
import { createGame, setPaused } from '../src/engine.js';
import { acceptTurn, commitPreparedMotion, initialTailGuide, prepareMotion } from '../src/motion.js';

const level = {
  columns: 12, rows: 9, cellSize: 48, stepMs: 165,
  spawn: { x: 5, y: 4, direction: 'right', length: 3 },
  firstFood: { x: 10, y: 7 }, walls: [],
};

test('countdown starts with 60 seconds by default and accepts a custom duration', () => {
  assert.deepEqual(createCountdown(), { durationMs: 60000, remainingMs: 60000 });
  assert.deepEqual(createCountdown(90), { durationMs: 90000, remainingMs: 90000 });
  assert.deepEqual(createCountdown(0.125), { durationMs: 125, remainingMs: 125 });
});

test('countdown rejects nonpositive, nonnumeric or nonfinite durations', () => {
  for (const seconds of [0, -1, NaN, Infinity, -Infinity, Number.MAX_VALUE, '60', null]) {
    assert.throws(() => createCountdown(seconds), RangeError);
  }
});

test('frame deltas accumulate without rounding away partial seconds', () => {
  const clock = createCountdown();
  let elapsedMs = 0;
  for (const delta of [16.25, 16.25, 17.5, 20, 930]) {
    const result = advanceCountdown(clock, delta);
    elapsedMs += result.elapsedMs;
    assert.equal(result.expired, false);
  }
  assert.equal(elapsedMs, 1000);
  assert.equal(clock.remainingMs, 59000);
  assert.equal(remainingSeconds(clock), 59);
});

test('invalid and negative frame deltas do not consume time', () => {
  const clock = createCountdown();
  for (const delta of [-1, NaN, Infinity, -Infinity, '16', undefined, null, 0]) {
    assert.equal(timeBudget(clock, delta), 0);
    assert.deepEqual(advanceCountdown(clock, delta), { elapsedMs: 0, expired: false });
  }
  assert.equal(clock.remainingMs, 60000);
});

test('paused countdown freezes and resumes from the same remaining time', () => {
  const clock = createCountdown(5);
  advanceCountdown(clock, 500);
  assert.deepEqual(advanceCountdown(clock, 9000, false), { elapsedMs: 0, expired: false });
  assert.equal(clock.remainingMs, 4500);
  assert.deepEqual(advanceCountdown(clock, 500), { elapsedMs: 500, expired: false });
  assert.equal(clock.remainingMs, 4000);
});

test('time budget caps a frame at the deadline without mutating the countdown', () => {
  const clock = createCountdown(0.5);
  assert.equal(timeBudget(clock, 1000), 500);
  assert.equal(clock.remainingMs, 500);
  assert.deepEqual(advanceCountdown(clock, 1000), { elapsedMs: 500, expired: true });
  assert.equal(clock.remainingMs, 0);
  assert.equal(timeBudget(clock, 16), 0);
  assert.deepEqual(advanceCountdown(clock, 16), { elapsedMs: 0, expired: true });
  assert.deepEqual(advanceCountdown(clock, 16, false), { elapsedMs: 0, expired: false });
});

test('remaining seconds uses ceiling so the final millisecond still displays one', () => {
  const clock = createCountdown(2);
  assert.equal(remainingSeconds(clock), 2);
  advanceCountdown(clock, 1000);
  assert.equal(remainingSeconds(clock), 1);
  advanceCountdown(clock, 999);
  assert.equal(clock.remainingMs, 1);
  assert.equal(remainingSeconds(clock), 1);
  advanceCountdown(clock, 1);
  assert.equal(remainingSeconds(clock), 0);
});

test('a new round gets a fresh independent countdown', () => {
  const previous = createCountdown(60);
  advanceCountdown(previous, 60000);
  const restarted = createCountdown(60);
  assert.equal(previous.remainingMs, 0);
  assert.equal(restarted.remainingMs, 60000);
  assert.notStrictEqual(previous, restarted);
});

test('committing a prepared movement never rolls back an independent countdown', () => {
  let game = createGame(level, () => 0.42);
  const clock = createCountdown();
  let guide = initialTailGuide(game);
  for (let step = 0; step < 3; step++) {
    const pending = prepareMotion(game, guide, step * level.stepMs);
    advanceCountdown(clock, 80);
    advanceCountdown(clock, 85);
    game = commitPreparedMotion(pending, (step + 1) * level.stepMs);
    guide = pending.tailGuide;
    assert.equal(clock.remainingMs, 60000 - (step + 1) * level.stepMs);
    assert.equal(game.ticks, step + 1);
    assert.equal('remainingMs' in game, false);
    assert.equal('countdown' in game, false);
  }
});

test('discarding predicted growth and committing its replacement cannot reset elapsed time', () => {
  const game = createGame(level, () => 0.42);
  game.food = { x: 6, y: 4 };
  const clock = createCountdown();
  advanceCountdown(clock, 5000);
  const guide = initialTailGuide(game);
  const growth = prepareMotion(game, guide, 5000);
  assert.equal(growth.event.type, 'eat');
  const redirected = acceptTurn(game, growth, guide, 'up', 5000, 0);
  assert.equal(redirected.redirected, true);
  advanceCountdown(clock, level.stepMs);
  const arrived = commitPreparedMotion(redirected.motion, 5165);
  assert.equal(arrived.score, 0);
  assert.equal(arrived.snake.length, 3);
  assert.equal(clock.remainingMs, 54835);
});

test('pause and resume preserve both a pending movement and its independent countdown', () => {
  const game = createGame(level, () => 0.42);
  const clock = createCountdown();
  const pending = prepareMotion(game, initialTailGuide(game), 0);
  advanceCountdown(clock, 80, game.status === 'running');
  setPaused(game, true);
  assert.deepEqual(advanceCountdown(clock, 10000, game.status === 'running'), { elapsedMs: 0, expired: false });
  assert.equal(clock.remainingMs, 59920);
  setPaused(game, false);
  advanceCountdown(clock, 85, game.status === 'running');
  const arrived = commitPreparedMotion(pending, 10165);
  assert.equal(arrived.ticks, 1);
  assert.equal(arrived.status, 'running');
  assert.equal(clock.remainingMs, 59835);
});
