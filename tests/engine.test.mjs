import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, stepGame, queueTurn, setPaused, spawnFood, cellKey, mouthIsOpen, validateLevel } from '../src/engine.js';
import { snakePath, wrapTranslations } from '../src/geometry.js';
import { verifyGeometry, materialRecords, at } from '../assets/snake/source/body-geometry-v2.mjs';

const base = JSON.parse(await readFile(new URL('../levels/open-table.json', import.meta.url), 'utf8'));
const make = (overrides = {}) => createGame({ ...structuredClone(base), ...overrides }, () => 0.37);

test('all four edges wrap with unchanged row/column and heading', () => {
  const { columns, rows } = base;
  for (const [direction, snake, expected] of [
    ['right', [{ x: columns - 1, y: 5 }, { x: columns - 2, y: 5 }], '0,5'],
    ['left', [{ x: 0, y: 5 }, { x: 1, y: 5 }], `${columns - 1},5`],
    ['up', [{ x: 8, y: 0 }, { x: 8, y: 1 }], `8,${rows - 1}`],
    ['down', [{ x: 8, y: rows - 1 }, { x: 8, y: rows - 2 }], '8,0'],
  ]) {
    const game = make(); Object.assign(game, { direction, snake });
    assert.equal(stepGame(game).type, 'move');
    assert.equal(cellKey(game.snake[0], game.level), expected);
    assert.equal(game.direction, direction);
    assert.equal(Math.abs(game.snake[0].x - game.snake[1].x) + Math.abs(game.snake[0].y - game.snake[1].y), 1);
  }
});

test('food adds exactly one segment and one point, and respawns in free space', () => {
  const game = make(); game.food = { x: game.snake[0].x + 1, y: game.snake[0].y };
  const initialLength = game.snake.length;
  assert.equal(stepGame(game, 1000).type, 'eat');
  assert.equal(game.score, 1); assert.equal(game.snake.length, initialLength + 1);
  assert.equal(game.lastEatAt, 1000);
  assert.ok(!game.snake.some(p => cellKey(p, game.level) === cellKey(game.food, game.level)));
  assert.equal(stepGame(game).type, 'move');
  assert.equal(game.snake.length, initialLength + 1);
});

test('turn queue rejects reversal and consumes two quick turns on separate ticks', () => {
  const game = make();
  assert.equal(queueTurn(game, 'left'), false);
  assert.equal(queueTurn(game, 'up'), true);
  assert.equal(queueTurn(game, 'down'), false);
  assert.equal(queueTurn(game, 'left'), true);
  assert.equal(queueTurn(game, 'down'), false);
  stepGame(game); assert.equal(game.direction, 'up');
  stepGame(game); assert.equal(game.direction, 'left');
});

test('configured wall blocks a wrapped destination; unconfigured edge remains open', () => {
  const game = make({ walls: [[0, 9]] });
  game.snake = [{ x: base.columns - 1, y: 9 }, { x: base.columns - 2, y: 9 }];
  assert.deepEqual(stepGame(game), { type: 'dead', reason: 'wall' });
  assert.equal(game.snake[0].x, base.columns - 1);
  const open = make({ walls: [[0, 8]] });
  open.snake = [{ x: base.columns - 1, y: 9 }, { x: base.columns - 2, y: 9 }];
  assert.equal(stepGame(open).type, 'move');
});

test('self collision checks wrapped occupancy, but a departing tail is legal', () => {
  const game = make();
  game.snake = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }];
  game.direction = 'up'; queueTurn(game, 'right');
  assert.equal(stepGame(game).type, 'move');
  const blocked = make();
  blocked.snake = [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: -1, y: 2 }, { x: -1, y: 1 }, { x: -1, y: 0 }];
  blocked.direction = 'left';
  assert.deepEqual(stepGame(blocked), { type: 'dead', reason: 'self' });
});

test('pause freezes position, score and queued movement', () => {
  const game = make(); queueTurn(game, 'up');
  setPaused(game, true);
  const before = JSON.stringify({ snake: game.snake, queue: game.queue, score: game.score });
  assert.equal(stepGame(game).type, 'idle');
  assert.equal(queueTurn(game, 'left'), false);
  assert.equal(JSON.stringify({ snake: game.snake, queue: game.queue, score: game.score }), before);
  setPaused(game, false); stepGame(game); assert.equal(game.direction, 'up');
});

test('filling the entire board wins without a food-spawn loop', () => {
  const game = make({ columns: 4, rows: 4, spawn: { x: 1, y: 0, direction: 'right', length: 2 }, firstFood: { x: 2, y: 0 } });
  game.snake = [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }];
  assert.equal(stepGame(game).type, 'won'); assert.equal(game.food, null);
  assert.equal(game.snake.length, 16); assert.equal(spawnFood(game), null);
});

test('mouth opens only for food ahead and closes during the bite', () => {
  const game = make();
  const { x, y } = game.snake[0];
  game.food = { x: x + 2, y };
  assert.equal(mouthIsOpen(game, 1000), true);
  game.food = { x: x - 1, y }; assert.equal(mouthIsOpen(game, 1000), false);
  game.food = { x: x + 1, y }; stepGame(game, 1000);
  game.food = { x: x + 2, y }; assert.equal(mouthIsOpen(game, 1100), false);
  assert.equal(mouthIsOpen(game, 1300), true);
});

test('tight consecutive bends retain exact tangency and positive inner radius', () => {
  const snake = [{ x: 4, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 4 }];
  const path = snakePath(snake, 48);
  const verified = verifyGeometry(path, 32);
  assert.equal(verified.minimumCenterRadius, 24);
  assert.ok(verified.maxGap < 1e-5 && verified.maxTangentError < 1e-5);
  assert.ok(verified.minimumCenterRadius > 32 / 2);
  const head = at(path, 0); assert.deepEqual(head.p, [216, 72]);
});

test('material identities and appearance remain stable when the visible body grows', () => {
  const short = materialRecords(400, 32, 123).filter(r => r.kind === 'bake');
  const long = materialRecords(800, 32, 123).filter(r => r.kind === 'bake');
  assert.deepEqual(short, long.slice(0, short.length));
  for (let i = 2; i < long.length; i++) {
    assert.notEqual(long[i].variant, long[i - 1].variant);
    assert.notEqual(long[i].variant, long[i - 2].variant);
  }
});

test('render copies cover both edges, even after multiple unwrapped circuits', () => {
  const copies = wrapTranslations([[1536 * 8 + 10, -10], [1536 * 8 - 80, -10]], 1536, 864, 80);
  assert.ok(copies.some(([x, y]) => x === -1536 * 8 && y === 0));
  assert.ok(copies.some(([x, y]) => x === -1536 * 7 && y === 864));
});

test('invalid level data fails before gameplay', () => {
  assert.throws(() => validateLevel({ ...base, spawn: { ...base.spawn, x: 1.2 } }));
  assert.throws(() => make({ walls: [[base.columns, 0]] }));
});
