import { roundOrthogonal } from '../assets/snake/source/body-geometry-v2.mjs';

export function simplifyPoints(points) {
  const result = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (previous && previous[0] === point[0] && previous[1] === point[1]) continue;
    while (result.length >= 2) {
      const a = result.at(-2), b = result.at(-1);
      const u = [b[0] - a[0], b[1] - a[1]], v = [point[0] - b[0], point[1] - b[1]];
      if (u[0] * v[1] - u[1] * v[0] === 0 && u[0] * v[0] + u[1] * v[1] > 0) result.pop();
      else break;
    }
    result.push([...point]);
  }
  return result;
}

export function snakePath(snake, cellSize) {
  const points = simplifyPoints(snake.map(({ x, y }) => [(x + 0.5) * cellSize, (y + 0.5) * cellSize]));
  return roundOrthogonal(points, cellSize / 2);
}

export function wrapTranslations(points, width, height, padding) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs) - padding, maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding, maxY = Math.max(...ys) + padding;
  const result = [];
  for (let x = Math.ceil(-maxX / width); x <= Math.floor((width - minX) / width); x++) {
    for (let y = Math.ceil(-maxY / height); y <= Math.floor((height - minY) / height); y++) result.push([x * width, y * height]);
  }
  return result;
}
