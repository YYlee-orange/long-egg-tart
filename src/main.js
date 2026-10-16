import { createGame, stepGame, setPaused } from './engine.js';
import { Renderer, loadAssets } from './renderer.js';
import { initialTailGuide, restPath, prepareMotion, motionPath, acceptTurn, commitPreparedMotion } from './motion.js';
import { createCountdown, timeBudget, advanceCountdown, remainingSeconds } from './countdown.js';
import { CountdownCue } from './countdown-cue.js';
import { createIntroScene, advanceIntro } from './intro.js';
import { emitCrumbs, advanceCrumbs } from './crumbs.js';

const stage = document.querySelector('#stage');
const startScreen = document.querySelector('#start-screen');
const gameScreen = document.querySelector('#game-screen');
const startButton = document.querySelector('#start');
const pauseButton = document.querySelector('#pause');
const overlay = document.querySelector('#overlay');
const continueButton = document.querySelector('#continue');
const homeButton = document.querySelector('#home');
const modalPanel = document.querySelector('.modal-panel');
const lengthWrap = document.querySelector('#length-wrap');
const continueLabel = document.querySelector('#continue-label');
const continueIcon = document.querySelector('#continue-icon');
const timeLeft = document.querySelector('#time-left');
const modalTitle = document.querySelector('#modal-title');
const finalLength = document.querySelector('#final-length');
const gameHud = document.querySelector('.game-hud');
const curtain = document.querySelector('#curtain');
const announcer = document.querySelector('#announcer');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const countdownCue = new CountdownCue(timeLeft);
const params = new URLSearchParams(location.search);
const testMode = params.get('test') === '1';
const manualClock = testMode && params.get('live') !== '1';
let renderer, level, game, countdown, intro;
let screen = 'start', busy = false, phase = 'idle';
let lastCoverOpaque = null;
let seed = 20261016, accumulator = 0, lastFrame = 0, animationFrame = 0;
let motion = null, tailGuide = null;
const crumbs = [];
const drawStats = { frames: 0, durations: [] };
let pointerStart = null;

const strips = Array.from({ length: 8 }, (_, index) => {
  const strip = document.createElement('div');
  strip.className = 'curtain-strip';
  strip.style.top = `calc(${index * 12.5}% - 0.5px)`;
  curtain.append(strip);
  return strip;
});

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

function prepareCurtain() {
  strips.forEach((strip, index) => {
    const rect = strip.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const key = aspect.toFixed(3);
    if (strip.dataset.textureAspect === key) return;
    strip.style.backgroundImage = `url("${renderer.curtainTexture(index, aspect)}")`;
    strip.dataset.textureAspect = key;
  });
}

function presentationPath() {
  return motion ? motionPath(motion, accumulator / level.stepMs) : restPath(game, tailGuide ?? initialTailGuide(game));
}

function render(now = performance.now()) {
  if (!renderer) return;
  const started = performance.now();
  if (screen === 'start') renderer.start(intro);
  else {
    const path = presentationPath();
    renderer.game(game, seed, now, path, motion?.direction ?? game.direction, crumbs);
  }
  if (testMode) {
    drawStats.frames++;
    drawStats.durations.push(performance.now() - started);
    if (drawStats.durations.length > 120) drawStats.durations.shift();
  }
}

function resetPresentation() {
  countdownCue.reset();
  motion = null;
  tailGuide = game ? initialTailGuide(game) : null;
  accumulator = 0;
  lastFrame = 0;
  crumbs.length = 0;
}

function syncTime() {
  if (!countdown) return;
  const seconds = String(remainingSeconds(countdown));
  if (timeLeft.textContent !== seconds) {
    timeLeft.value = seconds;
    timeLeft.textContent = seconds;
    timeLeft.setAttribute('aria-label', `剩余时间 ${seconds} 秒`);
  }
  countdownCue.update(Number(seconds), {
    active: screen === 'game' && game.status === 'running' && !busy && !document.hidden,
    reducedMotion: reducedMotion.matches,
  });
}

function syncUI() {
  startScreen.hidden = screen !== 'start';
  gameScreen.hidden = screen !== 'game';
  stage.dataset.screen = screen;
  const stopped = screen === 'game' && game.status !== 'running';
  stage.dataset.modal = String(stopped);
  // The viewport dialog closes before the stage's transition starts covering.
  overlay.hidden = !stopped || busy;
  homeButton.disabled = busy;
  continueButton.disabled = busy;
  gameHud.inert = stopped;
  syncDialogLayout();
  if (screen !== 'game') { countdownCue.stop(); return; }
  syncTime();
  pauseButton.hidden = stopped;
  const paused = game.status === 'paused';
  modalPanel.dataset.state = paused ? 'pause' : 'result';
  modalTitle.textContent = paused ? '已暂停' : '超长长长蛋挞最终长度';
  lengthWrap.hidden = paused;
  finalLength.hidden = paused;
  finalLength.value = String(game.snake.length);
  finalLength.textContent = finalLength.value;
  const digits = finalLength.value.length;
  const numberSize = digits <= 3 ? 72 : digits <= 5 ? 56 : Math.min(36, 288 / digits);
  finalLength.style.setProperty('--length-size', `${numberSize}px`);
  continueLabel.textContent = paused ? '继续游戏' : '再来一次';
  continueButton.setAttribute('aria-label', continueLabel.textContent);
  continueIcon.src = `./assets/ui/dialogs/icon-${paused ? 'play' : 'retry'}-v1.svg`;
}

function syncDialogLayout() {
  modalPanel.dataset.compact = String(stage.clientHeight <= 440 || innerHeight <= 520);
}

function stopLoop() {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  lastFrame = 0;
}

function finishMotion(now) {
  const result = motion.event;
  const eatenFood = game.food;
  game = commitPreparedMotion(motion, now);
  tailGuide = motion.tailGuide;
  if ((result.type === 'eat' || result.type === 'won') && eatenFood) {
    const cell = level.cellSize;
    emitCrumbs(crumbs, (eatenFood.x + 0.5) * cell, (eatenFood.y + 0.5) * cell, cell, seed ^ game.ticks, reducedMotion.matches);
  }
  if (result.type === 'eat') {
    game.lastEatAt = now;
    syncUI();
    announcer.textContent = `吃到蛋挞液，当前长度 ${game.snake.length}`;
  }
  if (result.type === 'dead' || result.type === 'won') {
    game.queue.length = 0;
    pointerStart = null;
    accumulator = level.stepMs;
    announcer.textContent = `${result.type === 'won' ? '全部吃完' : '游戏结束'}，最终长度 ${game.snake.length}`;
    syncUI();
    continueButton.focus({ preventScroll: true });
  } else motion = prepareMotion(game, tailGuide, now - accumulator);
}

function advanceMotion(delta, now) {
  accumulator += delta;
  while (accumulator >= level.stepMs && game.status === 'running') {
    accumulator -= level.stepMs;
    finishMotion(now);
  }
}

function advanceRound(delta, now, maximumMotionDelta = 100) {
  if (game.status !== 'running') return;
  const budget = timeBudget(countdown, delta);
  advanceCrumbs(crumbs, budget);
  // Movement retains its frame-stall cap; the countdown uses elapsed time.
  // Clip both to the deadline so no movement or food is committed afterwards.
  if (budget > 0) advanceMotion(Math.min(budget, maximumMotionDelta), now);
  const { expired } = advanceCountdown(countdown, budget);
  if (expired && game.status === 'running') {
    game.status = 'timeout';
    game.queue.length = 0;
    pointerStart = null;
    announcer.textContent = `时间结束，最终长度 ${game.snake.length}`;
    syncUI();
    continueButton.focus({ preventScroll: true });
  }
  syncTime();
}

function settleClock(now = performance.now()) {
  if (lastFrame && !manualClock) advanceRound(Math.max(0, now - lastFrame), now);
  lastFrame = now;
}

function frame(now) {
  animationFrame = 0;
  if (busy || manualClock || document.hidden) return;
  if (screen === 'start') {
    if (lastFrame) for (const snake of intro) advanceIntro(snake, Math.min(Math.max(0, now - lastFrame), 100));
    lastFrame = now;
    render(now);
    animationFrame = requestAnimationFrame(frame);
    return;
  }
  if (game.status !== 'running') return;
  settleClock(now);
  // Simulation commits only at fixed grid boundaries; display advances every RAF.
  render(now);
  if (game.status === 'running') animationFrame = requestAnimationFrame(frame);
}

function startLoop() {
  stopLoop();
  if (!renderer || busy || manualClock || document.hidden) return;
  if (screen === 'start' && reducedMotion.matches) return;
  if (screen === 'game') {
    if (game.status !== 'running') return;
    if (!motion) motion = prepareMotion(game, tailGuide, performance.now());
  }
  lastFrame = performance.now();
  animationFrame = requestAnimationFrame(frame);
}

async function transition(swap) {
  if (busy) return;
  busy = true;
  stopLoop();
  syncUI();
  stage.setAttribute('aria-busy', 'true');
  curtain.dataset.active = 'true';
  if (reducedMotion.matches) {
    swap();
  } else {
    prepareCurtain();
    phase = 'covering';
    const covers = strips.map((strip, index) => strip.animate([
      { transform: 'translate3d(-110%,0,0)' },
      { transform: 'translate3d(-15%,0,0)' },
    ], { duration: 380, delay: index * 28, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' }));
    await Promise.all(covers.map(animation => animation.finished));
    strips.forEach(strip => { strip.style.transform = 'translate3d(-15%,0,0)'; });
    covers.forEach(animation => animation.cancel());
    phase = 'covered';
    if (testMode) {
      const bounds = stage.getBoundingClientRect();
      const rows = strips.map(strip => strip.getBoundingClientRect());
      lastCoverOpaque = rows[0].top <= bounds.top && rows.at(-1).bottom >= bounds.bottom
        && rows.every((row, index) => row.left + row.height / 2 < bounds.left && row.right - row.height / 2 > bounds.right && (!index || row.top <= rows[index - 1].bottom));
    }
    swap();
    await nextFrame();
    phase = 'revealing';
    const reveals = strips.map((strip, index) => strip.animate([
      { transform: 'translate3d(-15%,0,0)' },
      { transform: 'translate3d(85%,0,0)' },
    ], { duration: 380, delay: index * 28, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' }));
    await Promise.all(reveals.map(animation => animation.finished));
    strips.forEach(strip => { strip.style.transform = 'translate3d(-110%,0,0)'; });
    reveals.forEach(animation => animation.cancel());
  }
  curtain.dataset.active = 'false';
  stage.setAttribute('aria-busy', 'false');
  busy = false;
  phase = 'idle';
  if (document.hidden && screen === 'game') { setPaused(game, true); render(); }
  syncUI();
  if (screen === 'game' && game.status !== 'running') continueButton.focus({ preventScroll: true });
  else stage.focus({ preventScroll: true });
  startLoop();
}

function beginGame() {
  if (busy) return;
  countdownCue.unlock();
  return transition(() => {
    game = createGame(level, testMode ? () => 0.42 : Math.random);
    countdown = createCountdown(level.roundSeconds ?? 60);
    resetPresentation();
    seed = (seed + 7919) >>> 0;
    screen = 'game';
    syncUI();
    render();
    announcer.textContent = `游戏开始，剩余 ${remainingSeconds(countdown)} 秒。方向键或 WASD 转向，空格暂停。`;
  });
}

function togglePause(forcePause = false) {
  if (busy || screen !== 'game' || !['running', 'paused'].includes(game.status)) return;
  if (game.status === 'running') settleClock();
  if (!['running', 'paused'].includes(game.status)) { render(); return; }
  const paused = forcePause || game.status === 'running';
  if (!paused) countdownCue.unlock();
  setPaused(game, paused);
  pointerStart = null;
  syncUI();
  render();
  announcer.textContent = paused ? '已暂停' : '继续游戏';
  if (paused) { stopLoop(); continueButton.focus({ preventScroll: true }); }
  else { stage.focus({ preventScroll: true }); startLoop(); }
}

startButton.addEventListener('click', beginGame);
pauseButton.addEventListener('click', () => togglePause());
continueButton.addEventListener('click', () => game.status === 'paused' ? togglePause() : beginGame());
homeButton.addEventListener('click', () => transition(() => {
  screen = 'start';
  game = null;
  countdown = null;
  intro = createIntroScene(level, testMode ? () => 0.42 : Math.random);
  resetPresentation();
  syncUI();
  render();
  announcer.textContent = '开始界面';
}));
document.querySelector('#reload').addEventListener('click', () => location.reload());

const keyDirections = { arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left' };

function requestTurn(direction) {
  if (busy || screen !== 'game' || game.status !== 'running') return false;
  const result = acceptTurn(game, motion, tailGuide, direction, performance.now() - accumulator, accumulator / level.stepMs);
  if (!result.accepted) return false;
  if (result.redirected) {
    motion = result.motion;
    render();
  }
  return true;
}

addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (screen !== 'game') return;
  if (key === 'tab' && !overlay.hidden && !busy) {
    const buttons = [homeButton, continueButton];
    const index = buttons.indexOf(document.activeElement);
    const next = index < 0 ? (event.shiftKey ? buttons.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next].focus();
    return;
  }
  if (keyDirections[key]) {
    event.preventDefault();
    requestTurn(keyDirections[key]);
  } else if (key === ' ' || key === 'escape') {
    if (key === ' ' && event.target.closest?.('button')) return;
    event.preventDefault();
    if (!event.repeat) togglePause();
  } else if (key === 'r' && !event.repeat && !busy) {
    event.preventDefault();
    beginGame();
  }
});
stage.addEventListener('pointerdown', event => {
  if (screen !== 'game' || busy || game.status !== 'running' || event.target.closest('button')) return;
  pointerStart = { x: event.clientX, y: event.clientY };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointerup', event => {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.hypot(dx, dy) < 12) return;
  requestTurn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
stage.addEventListener('pointercancel', () => { pointerStart = null; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (screen === 'start') stopLoop();
    else togglePause(true);
  } else if (screen === 'start' && !busy) startLoop();
});

function onReducedMotionChange() {
  if (reducedMotion.matches) countdownCue.cancelPulse();
  if (screen === 'start' && !busy) { startLoop(); render(); }
}
reducedMotion.addEventListener('change', onReducedMotionChange);

const resizeObserver = new ResizeObserver(() => {
  syncDialogLayout();
  if (renderer) { renderer.resize(); render(); }
});
resizeObserver.observe(stage);

try {
  const levelName = params.get('level') === 'bakery-walls' ? 'bakery-walls' : 'open-table';
  const response = await fetch(`./levels/${levelName}.json`);
  if (!response.ok) throw new Error('Level unavailable');
  level = await response.json();
  countdown = createCountdown(level.roundSeconds ?? 60);
  intro = createIntroScene(level, testMode ? () => 0.42 : Math.random);
  stage.style.setProperty('--map-aspect', String(level.columns / level.rows));
  createGame(level); // Validate before presenting an interactive start button.
  const assets = await loadAssets();
  renderer = new Renderer(document.querySelector('#game'), assets, level);
  render();
  startButton.disabled = false;
  stage.setAttribute('aria-busy', 'false');
  startLoop();

  if (testMode) {
    // Test-only hooks. Regular game sessions expose no mutable debug state.
    window.__tartTest = {
      snapshot: () => ({ screen, busy, phase, lastCoverOpaque, progress: accumulator / level.stepMs, remainingMs: countdown?.remainingMs, remainingSeconds: countdown && remainingSeconds(countdown), movingDirection: motion?.direction ?? game?.direction, intro: { head: { ...intro[0].head }, direction: intro[0].direction, length: intro[0].length, exits: intro[0].exits, lastExit: intro[0].lastExit && structuredClone(intro[0].lastExit) }, introLengths: intro.map(snake => snake.length), pose: renderer.lastPose, drawStats: { frames: drawStats.frames, durations: [...drawStats.durations] }, game: game ? { snake: structuredClone(game.snake), direction: game.direction, queue: [...game.queue], food: game.food && { ...game.food }, score: game.score, status: game.status, ticks: game.ticks } : null }),
      step: (count = 1) => { for (let i = 0; i < count; i++) stepGame(game, performance.now()); resetPresentation(); syncUI(); render(); },
      load: (data) => {
        stopLoop();
        screen = 'game';
        game = createGame(level, () => 0.42);
        countdown = createCountdown(level.roundSeconds ?? 60);
        Object.assign(game, data);
        game.snake = game.snake.map(point => ({ ...point }));
        resetPresentation();
        syncUI(); render();
        startLoop();
      },
      draw: render,
      pause: togglePause,
      motion: (progress) => {
        if (!motion) motion = prepareMotion(game, tailGuide, performance.now());
        accumulator = progress * level.stepMs;
        render();
      },
      advance: (delta) => {
        if (game.status !== 'running') return;
        if (!motion) motion = prepareMotion(game, tailGuide, performance.now());
        advanceRound(delta, performance.now(), Infinity);
        render();
      },
      remaining: (milliseconds) => {
        countdown.remainingMs = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
        syncTime();
      },
      introAdvance: (delta) => {
        if (screen !== 'start') return;
        for (const snake of intro) advanceIntro(snake, delta);
        render();
      },
    };
  }
} catch (error) {
  console.error(error);
  document.querySelector('#load-error').hidden = false;
  stage.setAttribute('aria-busy', 'false');
}

addEventListener('pagehide', () => { stopLoop(); countdownCue.dispose(); resizeObserver.disconnect(); reducedMotion.removeEventListener('change', onReducedMotionChange); });
