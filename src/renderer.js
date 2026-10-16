import { PALETTE, materialRecords, bodyMarkup } from '../assets/snake/source/body-geometry-v2.mjs';
import { samplePath, makeCurvePath, neckBodyPath } from './curves.js';
import { wrapTranslations } from './geometry.js';
import { restPath } from './motion.js';
import { mouthIsOpen } from './engine.js';
import { introPath, introViews } from './intro.js';

async function loadImage(path) {
  const image = new Image();
  image.src = path;
  await image.decode();
  return image;
}
async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Asset unavailable: ${path}`);
  return response.json();
}

export async function loadAssets() {
  const [background, food, shapes, heads, openHead, closedHead] = await Promise.all([
    loadImage('./assets/backgrounds/picnic-cloth-flat-v1.png'),
    loadImage('./assets/food/custard-carton-custom-v1.png'),
    loadJson('./assets/snake/source/decal-shapes-v5.json'),
    loadJson('./assets/snake/head/head-states-v1.json'),
    loadImage('./assets/snake/head/tart-snake-head-right-v7.png'),
    loadImage('./assets/snake/head/tart-snake-head-right-closed-v1.png'),
  ]);
  return { background, food, shapes: shapes.shapes, heads, openHead, closedHead };
}

// Exact circular strokes define the body. These sampled outlines only clip decals.
function strokeOutline(path, width) {
  const radius = width / 2;
  const samples = [];
  for (const part of path.parts) {
    const count = part.kind === 'arc' ? 32 : part.kind === 'cubic' ? Math.max(2, Math.ceil(part.length / 2)) : 1;
    for (let i = 0; i <= count; i++) samples.push(samplePath(path, part.start + part.length * i / count));
  }
  const outline = new Path2D();
  if (!samples.length) return outline;
  const first = samples[0], last = samples.at(-1);
  outline.moveTo(first.p[0] + first.n[0] * radius, first.p[1] + first.n[1] * radius);
  for (const sample of samples) outline.lineTo(sample.p[0] + sample.n[0] * radius, sample.p[1] + sample.n[1] * radius);
  const endAngle = Math.atan2(last.t[1], last.t[0]);
  outline.arc(last.p[0], last.p[1], radius, endAngle + Math.PI / 2, endAngle - Math.PI / 2, true);
  for (const sample of [...samples].reverse()) outline.lineTo(sample.p[0] - sample.n[0] * radius, sample.p[1] - sample.n[1] * radius);
  const startAngle = Math.atan2(first.t[1], first.t[0]);
  outline.arc(first.p[0], first.p[1], radius, startAngle - Math.PI / 2, startAngle - Math.PI * 1.5, true);
  outline.closePath();
  return outline;
}

function decalPath(record, shape, path) {
  const output = new Path2D();
  const bounds = shape.bounds;
  const center = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
  const cosine = Math.cos(record.angle), sine = Math.sin(record.angle);
  for (const contour of shape.contours) {
    contour.forEach((point, index) => {
      const u = (point[0] - center[0]) / bounds.width * record.length;
      const v = (point[1] - center[1]) / bounds.height * record.breadth;
      const along = u * cosine - v * sine;
      const lateral = record.lateral + u * sine + v * cosine;
      const sample = samplePath(path, record.m + along);
      const x = sample.p[0] + sample.n[0] * lateral;
      const y = sample.p[1] + sample.n[1] * lateral;
      if (index === 0) output.moveTo(x, y); else output.lineTo(x, y);
    });
    output.closePath();
  }
  return output;
}

export class Renderer {
  constructor(canvas, assets, level) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.assets = assets;
    this.width = level.columns * level.cellSize;
    this.height = level.rows * level.cellSize;
    this.materialCache = new Map();
    this.level = level;
    this.lastPose = null;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    // Resample the stationary backdrop only on resize, not on every RAF.
    this.backdrop = document.createElement('canvas');
    this.backdrop.width = this.canvas.width;
    this.backdrop.height = this.canvas.height;
    const backdrop = this.backdrop.getContext('2d', { alpha: false });
    backdrop.drawImage(this.assets.background, 0, 0, this.backdrop.width, this.backdrop.height);
    backdrop.scale(this.backdrop.width / this.width, this.backdrop.height / this.height);
    const cell = this.level.cellSize;
    for (const [x, y] of this.level.walls) {
      backdrop.fillStyle = '#BC8170';
      backdrop.beginPath();
      backdrop.roundRect(x * cell + cell * 0.07, y * cell + cell * 0.07, cell * 0.86, cell * 0.86, cell * 0.18);
      backdrop.fill();
    }
  }

  background() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.backdrop, 0, 0);
    this.ctx.restore();
  }

  materials(width, seed) {
    const key = `${width}:${seed}`;
    if (!this.materialCache.has(key)) {
      if (this.materialCache.size >= 8) this.materialCache.delete(this.materialCache.keys().next().value);
      this.materialCache.set(key, materialRecords(this.width * this.height / 48 + 500, width, seed));
    }
    return this.materialCache.get(key);
  }

  curtainTexture(index, aspectRatio) {
    const thickness = 64, length = Math.max(2, aspectRatio) * thickness;
    const path = makeCurvePath([{ kind: 'line', a: [thickness / 2, thickness / 2], b: [length - thickness / 2, thickness / 2] }]);
    const records = materialRecords(path.length, thickness, 20261016 + index * 7919);
    const body = bodyMarkup(path, this.assets.shapes, records, { width: thickness, prefix: `curtain-${index}` });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${length} ${thickness}">${body}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  snake(path, width, seed, open, headOffset, wrap = true) {
    const ctx = this.ctx;
    const frame = this.assets.heads.states[open ? 'open' : 'closed'].frames.right;
    const scale = width / frame.neckWidthPx;
    const neckDistance = (frame.rotationPivotPx[0] - frame.neckAnchorPx[0]) * scale;
    const { body, head, neckAnchor } = neckBodyPath(path, neckDistance, headOffset ?? neckDistance);
    const materialPath = makeCurvePath([{ kind: 'line', a: head.p, b: neckAnchor }, ...body.parts]);
    const bodyShape = new Path2D(body.d);
    const fillClip = strokeOutline(body, width * 42 / 64);
    const crustClip = strokeOutline(body, width);
    crustClip.addPath(strokeOutline(body, width * 52 / 64));
    const records = this.materials(width, seed).filter(record => record.m + record.length > neckDistance + width * 0.3 && record.m - record.length < materialPath.length);
    const decals = records.map(record => ({ record, shape: this.assets.shapes[record.variant], path: decalPath(record, this.assets.shapes[record.variant], materialPath) }));
    const points = path.parts.flatMap(part => [part.a, part.b]);
    const copies = wrap ? wrapTranslations(points, this.width, this.height, width * 2.5) : [[0, 0]];
    // Half a cell aligns the visible pivot with the actual grid node at
    // both ends of every movement; the neck stays tangent to the body.
    const heading = Math.atan2(-head.t[1], -head.t[0]);
    const pivot = head.p;
    this.lastPose = { pivot, neck: neckAnchor, heading, width, world: [this.width, this.height] };
    for (const [dx, dy] of copies) {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [strokeWidth, color] of [[width, PALETTE.crust], [width * 52 / 64, PALETTE.rim], [width * 42 / 64, PALETTE.custard]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.stroke(bodyShape);
      }
      for (const kind of ['bake', 'pastry']) {
        ctx.save();
        if (kind === 'bake') ctx.clip(fillClip); else ctx.clip(crustClip, 'evenodd');
        for (const decal of decals) if (decal.record.kind === kind) {
          ctx.fillStyle = decal.shape.color;
          ctx.fill(decal.path);
        }
        ctx.restore();
      }
      ctx.translate(pivot[0], pivot[1]);
      ctx.rotate(heading);
      ctx.drawImage(open ? this.assets.openHead : this.assets.closedHead, -frame.rotationPivotPx[0] * scale, -frame.rotationPivotPx[1] * scale, frame.width * scale, frame.height * scale);
      ctx.restore();
    }
  }

  start(snakes) {
    this.background();
    const cell = this.level.cellSize;
    let activePose;
    for (const [index, intro] of snakes.entries()) {
      for (const view of introViews(intro)) {
        this.snake(introPath(view), cell * 2 / 3, 20261016 + index * 7919, false, cell / 2, false);
        if (index === 0 && view.kind === 'head') activePose = this.lastPose;
      }
    }
    this.lastPose = activePose;
  }

  crumbs(particles) {
    const ctx = this.ctx;
    for (const particle of particles) {
      const progress = particle.age / particle.life;
      const size = particle.size * (1 - progress * 0.35);
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle);
      ctx.globalAlpha = Math.min(1, (1 - progress) * 3);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      if (particle.drop) ctx.ellipse(0, 0, size * 0.65, size * 0.45, 0, 0, Math.PI * 2);
      else {
        ctx.moveTo(-size * 0.65, -size * 0.4);
        ctx.lineTo(size * 0.35, -size * 0.6);
        ctx.lineTo(size * 0.7, size * 0.1);
        ctx.lineTo(size * 0.1, size * 0.65);
        ctx.lineTo(-size * 0.55, size * 0.35);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
  }

  game(game, seed, now, presentationPath = null, direction = game.direction, crumbs = []) {
    this.background();
    const cell = game.level.cellSize;
    if (game.food) {
      const size = cell * 1.12;
      const x = (game.food.x + 0.5) * cell;
      const y = (game.food.y + 0.5) * cell;
      this.ctx.drawImage(this.assets.food, x - size / 2, y - size / 2, size, size);
    }
    this.snake(presentationPath ?? restPath(game), cell * 2 / 3, seed, mouthIsOpen(game, now, direction), cell / 2);
    this.crumbs(crumbs);
  }
}
