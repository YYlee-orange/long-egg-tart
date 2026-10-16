import { DIRECTIONS, stepGame, queueTurn, spawnFood } from './engine.js';
import { snakePath } from './geometry.js';
import { slicePath } from '../assets/snake/source/body-geometry-v2.mjs';

export function initialTailGuide(game) {
  const tail = game.snake.at(-1), before = game.snake.at(-2);
  return { x: tail.x * 2 - before.x, y: tail.y * 2 - before.y };
}

// Each marker is an edge midpoint. At a turn the path between consecutive
// midpoints is an exact quarter circle; otherwise it is one straight cell.
export function edgeMarkers(route, cellSize) {
  const markers = [cellSize / 2];
  for (let i = 1; i < route.length - 1; i++) {
    const a = route[i - 1], b = route[i], c = route[i + 1];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    markers.push(markers.at(-1) + (cross === 0 ? cellSize : Math.PI * cellSize / 4));
  }
  return markers;
}

export function restPath(game, tailGuide = initialTailGuide(game)) {
  const route = [...game.snake, tailGuide];
  const markers = edgeMarkers(route, game.level.cellSize);
  return slicePath(snakePath(route, game.level.cellSize), markers[0], markers.at(-1));
}

export function prepareMotion(game, tailGuide, now) {
  // Prediction must not consume real random values. A redirected prediction
  // can be discarded; select the next actual food only when the step commits.
  const next = { ...game, random: () => 0, snake: game.snake.map(point => ({ ...point })), queue: [...game.queue] };
  const event = stepGame(next, now + game.level.stepMs);
  next.random = game.random;
  // The remaining input queue is shared with the pending state, so input
  // received during travel is preserved at the next node.
  game.queue = next.queue;
  const vector = DIRECTIONS[next.direction];
  const attemptedHead = { x: game.snake[0].x + vector.x, y: game.snake[0].y + vector.y };
  const route = [attemptedHead, ...game.snake, tailGuide];
  const markers = edgeMarkers(route, game.level.cellSize);
  const grown = next.snake.length > game.snake.length;
  return {
    next, event, direction: next.direction,
    path: snakePath(route, game.level.cellSize),
    headFrom: markers[1], headTo: markers[0],
    tailFrom: markers[game.snake.length],
    tailTo: markers[grown ? game.snake.length : game.snake.length - 1],
    tailGuide: grown || event.type === 'dead' ? tailGuide : { ...game.snake.at(-1) },
  };
}

export function acceptTurn(game, currentMotion, tailGuide, direction, now, progress = 0) {
  // A departed node is immutable. Input is always buffered, but only a turn
  // requested while still exactly at the node may replace its outgoing step.
  const canRedirect = currentMotion && progress <= 1e-9 && currentMotion.direction === game.direction && game.queue.length === 0;
  const accepted = queueTurn(game, direction, currentMotion?.direction ?? game.direction);
  if (!accepted) return { accepted: false, redirected: false, motion: currentMotion };
  if (!canRedirect) return { accepted: true, redirected: false, motion: currentMotion };
  return { accepted: true, redirected: true, motion: prepareMotion(game, tailGuide, now) };
}

export function commitPreparedMotion(motion, now) {
  if (motion.committed) return motion.next;
  motion.committed = true;
  if (motion.event.type === 'eat' || motion.event.type === 'won') {
    motion.next.lastEatAt = now;
    if (motion.event.type === 'eat') motion.next.food = spawnFood(motion.next);
  }
  return motion.next;
}

export function motionPath(motion, progress) {
  const alpha = Math.max(0, Math.min(1, progress));
  const head = motion.headFrom + (motion.headTo - motion.headFrom) * alpha;
  const tail = motion.tailFrom + (motion.tailTo - motion.tailFrom) * alpha;
  return slicePath(motion.path, head, tail);
}
