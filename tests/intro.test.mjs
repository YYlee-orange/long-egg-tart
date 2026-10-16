import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createIntro, createIntroScene, advanceIntro, introPath, introViews } from '../src/intro.js';
import { createGame, DIRECTIONS } from '../src/engine.js';
import { restPath } from '../src/motion.js';
import { neckBodyPath } from '../src/curves.js';

const level = JSON.parse(await readFile(new URL('../levels/open-table.json', import.meta.url), 'utf8'));
const width = level.columns * level.cellSize, height = level.rows * level.cellSize;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const firstExitMs = state => (width - state.head.x) / level.cellSize * level.stepMs;
const onBoundary = point => point.x === 0 || point.x === width || point.y === 0 || point.y === height;

test('the start scene has independent seven and five cell snakes with the same portal mechanism', () => {
  const snakes = createIntroScene(level, () => 0.42);
  assert.deepEqual(snakes.map(snake => snake.length), [7, 5]);
  assert.equal(new Set(snakes.map(snake => `${snake.head.x},${snake.head.y}`)).size, 2);
  const otherHeads = snakes.slice(1).map(snake => ({ ...snake.head }));
  advanceIntro(snakes[0], level.stepMs);
  assert.deepEqual(snakes.slice(1).map(snake => snake.head), otherHeads);
  for (const snake of snakes) {
    close(introPath(snake).length, (snake.length - 1) * level.cellSize);
    advanceIntro(snake, level.stepMs * 80);
    assert.ok(snake.exits > 0);
    assert.ok(onBoundary(snake.lastEntry));
    assert.notDeepEqual([snake.lastEntry.x, snake.lastEntry.y], [snake.lastExit.x, snake.lastExit.y]);
  }
});

test('intro keeps seven game-sized cells and the same head and body geometry', () => {
  const state = createIntro(level);
  const game = createGame({ ...level, spawn: { x: 13, y: 6, length: 7, direction: 'right' } });
  assert.equal(state.length, 7);
  assert.equal(introPath(state).d, restPath(game).d);
  const pose = neckBodyPath(introPath(state), 19.25, level.cellSize / 2);
  close(pose.head.p[0], state.head.x);
  close(pose.head.p[1], state.head.y);
  advanceIntro(state, level.stepMs / 4);
  close(state.head.x, pose.head.p[0] + level.cellSize / 4);
  assert.equal(state.direction, 'right');
});

test('random destinations cover all four boundaries, face inward and exclude the exit point', () => {
  const edges = new Set();
  for (let i = 0; i < 200; i++) {
    const state = createIntro(level, () => i / 200);
    const { entry, exit } = state.portal;
    assert.ok(onBoundary(entry));
    assert.notDeepEqual([entry.x, entry.y], [exit.x, exit.y]);
    const vector = DIRECTIONS[entry.direction];
    const inside = { x: entry.x + vector.x, y: entry.y + vector.y };
    assert.ok(inside.x > 0 && inside.x < width && inside.y > 0 && inside.y < height);
    edges.add(entry.edge);
  }
  assert.equal(edges.size, 4);
});

test('the destination head enters gradually while the original tail is still leaving', () => {
  const state = createIntro(level, () => 0.3);
  advanceIntro(state, firstExitMs(state) - level.stepMs / 2);
  const preview = introViews(state).find(view => view.kind === 'entry');
  assert.ok(preview, 'destination is already drawn before the head pivot crosses');
  const entry = state.portal.entry, vector = DIRECTIONS[entry.direction];
  close(preview.head.x, entry.x - vector.x * level.cellSize / 2);
  close(preview.head.y, entry.y - vector.y * level.cellSize / 2);
  const exit = state.portal.exit;
  advanceIntro(state, level.stepMs / 2);
  assert.equal(state.exits, 1);
  assert.ok(onBoundary(state.head), 'head transfers at the boundary, never inside the map');
  assert.deepEqual(state.head, { x: entry.x, y: entry.y });
  const oldTail = introViews(state).find(view => view.kind === 'tail');
  assert.ok(oldTail, 'old-side tail is retained across the transfer');
  close(oldTail.head.x, exit.x);
  close(oldTail.head.y, exit.y);
  advanceIntro(state, level.stepMs);
  assert.ok(state.tails.length > 0);
  assert.equal(state.length, 7);
});

test('all four outgoing directions transfer at the edge and keep the tail until fully clear', () => {
  for (const direction of Object.keys(DIRECTIONS)) {
    const state = Array.from({ length: 100 }, (_, i) => createIntro(level, () => i / 100)).find(candidate => candidate.portal.entry.direction === direction);
    advanceIntro(state, firstExitMs(state));
    assert.equal(state.direction, direction);
    const distance = ['left', 'right'].includes(direction) ? width : height;
    advanceIntro(state, distance / level.cellSize * level.stepMs);
    assert.equal(state.exits, 2);
    assert.equal(state.lastExit.edge, direction);
    assert.ok(onBoundary(state.head));
    assert.ok(state.tails.length > 0);
    advanceIntro(state, level.stepMs * 6.5);
    assert.ok(state.tails.length > 0);
    advanceIntro(state, level.stepMs * 0.5 + 1e-7);
    assert.equal(state.tails.length, 0);
  }
});

test('constant random sources never loop while choosing a different entry point', () => {
  for (const value of [0, 0.5, 1]) {
    const state = createIntro(level, () => value);
    advanceIntro(state, level.stepMs * 1000);
    assert.ok(state.exits > 10);
    assert.ok(onBoundary(state.lastEntry));
    assert.notDeepEqual([state.lastEntry.x, state.lastEntry.y], [state.lastExit.x, state.lastExit.y]);
    assert.equal(state.length, 7);
  }
});

test('elapsed time is preserved across multiple boundary transfers', () => {
  const state = createIntro(level, () => 0.5), split = createIntro(level, () => 0.5);
  advanceIntro(state, level.stepMs * 70.25);
  for (let i = 0; i < 281; i++) advanceIntro(split, level.stepMs / 4);
  close(state.head.x, split.head.x);
  close(state.head.y, split.head.y);
  assert.equal(state.direction, split.direction);
  assert.equal(state.exits, split.exits);
  assert.deepEqual(state.lastEntry, split.lastEntry);
});

test('invalid elapsed times leave the intro unchanged and every portal view remains straight', () => {
  const state = createIntro(level), before = { ...state.head };
  for (const delta of [NaN, Infinity, -Infinity, -10, 0]) advanceIntro(state, delta);
  assert.deepEqual(state.head, before);
  advanceIntro(state, firstExitMs(state) + 10);
  for (const view of introViews(state)) {
    assert.ok(introPath(view).parts.every(part => part.kind === 'line'));
    assert.equal(view.length, 7);
  }
});
