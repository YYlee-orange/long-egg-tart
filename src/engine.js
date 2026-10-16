export const DIRECTIONS = Object.freeze({
  right: { x: 1, y: 0 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, up: { x: 0, y: -1 },
});
export const mod = (value, size) => ((value % size) + size) % size;
export const cellKey = (point, level) => `${mod(point.x, level.columns)},${mod(point.y, level.rows)}`;
export const opposite = (a, b) => DIRECTIONS[a].x + DIRECTIONS[b].x === 0 && DIRECTIONS[a].y + DIRECTIONS[b].y === 0;

export function validateLevel(level) {
  for (const key of ['columns', 'rows', 'cellSize', 'stepMs']) {
    if (!Number.isInteger(level[key]) || level[key] < 1) throw new Error(`Invalid level ${key}`);
  }
  if (level.columns < 4 || level.rows < 4 || level.stepMs < 60) throw new Error('Level is too small or too fast');
  if (!DIRECTIONS[level.spawn?.direction] || !Number.isInteger(level.spawn.length) || level.spawn.length < 2) throw new Error('Invalid spawn');
  if (!Number.isInteger(level.spawn.x) || !Number.isInteger(level.spawn.y)) throw new Error('Invalid spawn position');
  if (!Array.isArray(level.walls)) throw new Error('Walls must be an array');
  for (const wall of level.walls) {
    if (!Array.isArray(wall) || wall.length !== 2 || !wall.every(Number.isInteger) || wall[0] < 0 || wall[0] >= level.columns || wall[1] < 0 || wall[1] >= level.rows) throw new Error('Invalid wall');
  }
  return level;
}

export function spawnFood(game, random = game.random) {
  const occupied = new Set(game.snake.map(point => cellKey(point, game.level)));
  const available = [];
  for (let y = 0; y < game.level.rows; y++) for (let x = 0; x < game.level.columns; x++) {
    const key = `${x},${y}`;
    if (!occupied.has(key) && !game.walls.has(key)) available.push({ x, y });
  }
  return available.length ? available[Math.min(available.length - 1, Math.floor(random() * available.length))] : null;
}

export function createGame(level, random = Math.random) {
  validateLevel(level);
  const direction = level.spawn.direction;
  const vector = DIRECTIONS[direction];
  const game = {
    level, random, direction, queue: [], score: 0, status: 'running', ticks: 0,
    walls: new Set(level.walls.map(([x, y]) => `${x},${y}`)),
    snake: Array.from({ length: level.spawn.length }, (_, i) => ({ x: level.spawn.x - vector.x * i, y: level.spawn.y - vector.y * i })),
    food: null, lastEatAt: -Infinity, collision: null,
  };
  const initialKeys = game.snake.map(point => cellKey(point, level));
  if (new Set(initialKeys).size !== initialKeys.length || initialKeys.some(key => game.walls.has(key))) throw new Error('Spawn overlaps itself or a wall');
  const first = level.firstFood;
  if (first && Number.isInteger(first.x) && Number.isInteger(first.y) && first.x >= 0 && first.x < level.columns && first.y >= 0 && first.y < level.rows && !initialKeys.includes(cellKey(first, level)) && !game.walls.has(cellKey(first, level))) game.food = { ...first };
  else game.food = spawnFood(game);
  if (!game.food) game.status = 'won';
  return game;
}

export function queueTurn(game, direction, movingDirection = game.direction) {
  if (game.status !== 'running' || !DIRECTIONS[direction] || game.queue.length >= 2) return false;
  const previous = game.queue.at(-1) ?? movingDirection;
  if (direction === previous || opposite(direction, previous)) return false;
  game.queue.push(direction);
  return true;
}

export function stepGame(game, now = 0) {
  if (game.status !== 'running') return { type: 'idle' };
  const direction = game.queue.shift() ?? game.direction;
  const vector = DIRECTIONS[direction];
  const next = { x: game.snake[0].x + vector.x, y: game.snake[0].y + vector.y };
  const key = cellKey(next, game.level);
  const eats = game.food !== null && key === cellKey(game.food, game.level);
  const blocked = game.walls.has(key);
  const self = game.snake.slice(0, eats ? undefined : -1).some(point => cellKey(point, game.level) === key);
  game.direction = direction;
  if (blocked || self) {
    game.status = 'dead';
    game.collision = { type: blocked ? 'wall' : 'self', at: next };
    game.queue.length = 0;
    return { type: 'dead', reason: game.collision.type };
  }
  game.snake.unshift(next);
  if (eats) {
    game.score++;
    game.lastEatAt = now;
    game.food = spawnFood(game);
    if (!game.food) game.status = 'won';
  } else game.snake.pop();
  game.ticks++;
  return { type: game.status === 'won' ? 'won' : eats ? 'eat' : 'move' };
}

export function setPaused(game, paused) {
  if (paused && game.status === 'running') game.status = 'paused';
  else if (!paused && game.status === 'paused') game.status = 'running';
}

export function mouthIsOpen(game, now, direction = game.direction) {
  if (game.status !== 'running' || now - game.lastEatAt < 220 || !game.food) return false;
  const v = DIRECTIONS[direction];
  const head = game.snake[0];
  return [1, 2].some(distance => cellKey({ x: head.x + v.x * distance, y: head.y + v.y * distance }, game.level) === cellKey(game.food, game.level));
}
