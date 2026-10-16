import { DIRECTIONS } from './engine.js';
import { restPath } from './motion.js';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function randomIndex(random, count) {
  const value = Number(random());
  return Math.floor(clamp(Number.isFinite(value) ? value : 0, 0, 1 - Number.EPSILON) * count);
}

export function createIntro(level, random = Math.random, { length = 7, direction = 'right', column, row } = {}) {
  for (const key of ['columns', 'rows', 'cellSize', 'stepMs']) {
    if (!Number.isFinite(level[key]) || level[key] <= 0) throw new Error(`Invalid intro ${key}`);
  }
  if (!Number.isInteger(length) || length < 2 || !DIRECTIONS[direction]) throw new Error('Invalid intro snake');
  const x = column === undefined
    ? clamp(Math.floor(level.columns * 0.65), Math.min(length, level.columns - 1), level.columns - 1)
    : clamp(column, 0, level.columns - 1);
  const y = clamp(row ?? Math.floor(level.rows * 0.55), 0, level.rows - 1);
  const state = {
    level, random, head: { x: (x + 0.5) * level.cellSize, y: (y + 0.5) * level.cellSize },
    direction, length, exits: 0, lastExit: null, lastEntry: null, tails: [], portal: null,
  };
  state.portal = createPortal(state);
  return state;
}

export function createIntroScene(level, random = Math.random) {
  return [
    createIntro(level, random),
    createIntro(level, random, { length: 5, direction: 'left', column: Math.floor(level.columns * 0.4), row: Math.floor(level.rows * 0.37) }),
  ];
}

function edgeDistance(state) {
  const { level, head, direction } = state;
  const width = level.columns * level.cellSize, height = level.rows * level.cellSize;
  if (direction === 'right') return width - head.x;
  if (direction === 'left') return head.x;
  if (direction === 'down') return height - head.y;
  return head.y;
}

function recordExit(state) {
  const { level, head, direction } = state;
  const horizontal = direction === 'right' || direction === 'left';
  const cell = {
    x: horizontal ? direction === 'right' ? level.columns - 1 : 0 : clamp(Math.floor(head.x / level.cellSize), 0, level.columns - 1),
    y: horizontal ? clamp(Math.floor(head.y / level.cellSize), 0, level.rows - 1) : direction === 'down' ? level.rows - 1 : 0,
  };
  return {
    edge: direction,
    x: horizontal ? direction === 'right' ? level.columns * level.cellSize : 0 : head.x,
    y: horizontal ? head.y : direction === 'down' ? level.rows * level.cellSize : 0,
    cell,
  };
}

function createPortal(state) {
  const exit = recordExit(state);
  const { level } = state, cell = level.cellSize;
  const width = level.columns * cell, height = level.rows * cell;
  const candidates = [];
  for (let y = 0; y < level.rows; y++) {
    candidates.push({ edge: 'left', x: 0, y: (y + 0.5) * cell, direction: 'right' });
    candidates.push({ edge: 'right', x: width, y: (y + 0.5) * cell, direction: 'left' });
  }
  for (let x = 0; x < level.columns; x++) {
    candidates.push({ edge: 'up', x: (x + 0.5) * cell, y: 0, direction: 'down' });
    candidates.push({ edge: 'down', x: (x + 0.5) * cell, y: height, direction: 'up' });
  }
  const entries = candidates.filter(point => point.x !== exit.x || point.y !== exit.y);
  return { exit, entry: entries[randomIndex(state.random, entries.length)] };
}

function move(point, direction, distance) {
  const vector = DIRECTIONS[direction];
  point.x += vector.x * distance;
  point.y += vector.y * distance;
}

function moveAll(state, distance) {
  move(state.head, state.direction, distance);
  for (const tail of state.tails) move(tail.head, tail.direction, distance);
  // Only discard old-side copies after the last tail pixels have cleared.
  state.tails = state.tails.filter(tail => edgeDistance({ ...state, ...tail }) + state.length * state.level.cellSize > 0);
}

export function advanceIntro(state, deltaMs) {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return state;
  const speed = state.level.cellSize / state.level.stepMs;
  let remaining = deltaMs * speed;
  while (remaining > 0) {
    const distance = Math.max(0, edgeDistance(state));
    const travelled = Math.min(remaining, distance);
    moveAll(state, travelled);
    remaining -= travelled;
    if (travelled < distance) break;
    const { exit, entry } = state.portal;
    state.tails.push({ head: { ...state.head }, direction: state.direction });
    state.lastExit = exit;
    state.lastEntry = entry;
    state.exits++;
    state.head = { x: entry.x, y: entry.y };
    state.direction = entry.direction;
    state.portal = createPortal(state);
  }
  return state;
}

export function introViews(state) {
  const { entry } = state.portal;
  const distance = edgeDistance(state), vector = DIRECTIONS[entry.direction];
  return [
    ...state.tails.map(tail => ({ ...state, ...tail, kind: 'tail' })),
    { ...state, kind: 'head' },
    // Preview the exact same snake through the destination boundary. Its
    // head appears there while the old-side tail is still sliding out.
    ...(distance <= state.level.cellSize ? [{ ...state, head: { x: entry.x - vector.x * distance, y: entry.y - vector.y * distance }, direction: entry.direction, kind: 'entry' }] : []),
  ];
}

export function introPath(state) {
  const cellSize = state.level.cellSize, vector = DIRECTIONS[state.direction];
  const snake = Array.from({ length: state.length }, (_, i) => ({
    x: state.head.x / cellSize - 0.5 - vector.x * i,
    y: state.head.y / cellSize - 0.5 - vector.y * i,
  }));
  return restPath({ level: state.level, snake, direction: state.direction });
}
