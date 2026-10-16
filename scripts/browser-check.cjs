const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const output = path.resolve(__dirname, '../previews/prototype');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const snapshot = () => page.evaluate(() => window.__tartTest.snapshot());
  const capture = name => page.locator('#stage').screenshot({ path: path.join(output, name) });
  const waitReady = async target => {
    await target.waitForFunction(() => !!window.__tartTest && !document.querySelector('#start').disabled);
    assert.equal(await target.locator('#load-error').isVisible(), false);
  };
  const waitIdle = () => page.waitForFunction(() => window.__tartTest.snapshot().screen === 'game' && !window.__tartTest.snapshot().busy);

  try {
    await page.goto('http://127.0.0.1:4173/?test=1');
    await waitReady(page);
    await capture('start.png');
    const bounds = await page.evaluate(() => {
      const stage = document.querySelector('#stage').getBoundingClientRect();
      return { x: stage.x, y: stage.y, right: innerWidth - stage.right, bottom: innerHeight - stage.bottom, width: stage.width, background: getComputedStyle(document.body).backgroundImage };
    });
    assert.equal(bounds.background, 'none');
    assert.ok(Math.min(bounds.x, bounds.y, bounds.right, bounds.bottom) >= 23.5);
    const sizeRatio = (bounds.width / 960 * 32) / (1440 / 1536 * 32);
    assert.ok(sizeRatio >= 1.5);
    await page.getByRole('button', { name: '开始游戏', exact: true }).click();
    await page.waitForTimeout(230);
    await capture('transition.png');
    await waitIdle();
    assert.equal((await snapshot()).game.status, 'running');
    assert.equal((await snapshot()).lastCoverOpaque, true);
    assert.equal(await page.locator('#time-left').textContent(), '60');
    assert.equal(await page.locator('#score').count(), 0);

    await page.evaluate(() => window.__tartTest.step(5));
    assert.equal((await snapshot()).game.score, 1);
    assert.equal((await snapshot()).game.snake.length, 9);
    await page.keyboard.press('ArrowUp'); await page.evaluate(() => window.__tartTest.step(3));
    await page.keyboard.press('ArrowLeft'); await page.evaluate(() => window.__tartTest.step(4));
    await page.keyboard.press('ArrowDown'); await page.evaluate(() => window.__tartTest.step(3));
    assert.equal((await snapshot()).game.status, 'running');
    await capture('gameplay.png');

    await page.getByRole('button', { name: '暂停游戏', exact: true }).click();
    const paused = await snapshot();
    assert.equal(paused.game.status, 'paused');
    assert.ok(await page.getByRole('dialog', { name: '已暂停', exact: true }).isVisible());
    assert.equal(await page.locator('#final-length').isVisible(), false);
    await page.evaluate(() => window.__tartTest.step(2));
    await page.evaluate(() => window.__tartTest.advance(1000));
    assert.deepEqual((await snapshot()).game.snake, paused.game.snake);
    assert.equal((await snapshot()).remainingMs, paused.remainingMs, 'pause freezes the countdown');
    await capture('paused.png');
    await page.keyboard.press('Space');
    assert.equal((await snapshot()).game.status, 'running');
    assert.equal((await snapshot()).remainingMs, paused.remainingMs, 'resume preserves remaining time');
    assert.equal(await page.getByRole('dialog').isVisible(), false);

    await page.evaluate(() => window.__tartTest.load({
      snake: Array.from({ length: 8 }, (_, i) => ({ x: 19 - i, y: 5 })),
      direction: 'right', food: { x: 0, y: 5 }, score: 3,
    }));
    await page.evaluate(() => window.__tartTest.step());
    const wrapped = await snapshot();
    assert.equal(wrapped.game.snake[0].x, 20);
    assert.equal(wrapped.game.score, 4);
    await capture('wrap.png');
    const noBridge = await page.evaluate(async () => {
      const canvas = document.querySelector('#game');
      const reference = document.createElement('canvas');
      reference.width = canvas.width; reference.height = canvas.height;
      const ctx = reference.getContext('2d');
      const image = new Image(); image.src = './assets/backgrounds/picnic-cloth-flat-v1.png'; await image.decode();
      ctx.drawImage(image, 0, 0, reference.width, reference.height);
      const x = Math.round(480 / 960 * canvas.width), y = Math.round(264 / 528 * canvas.height);
      const actual = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
      const expected = ctx.getImageData(x, y, 1, 1).data;
      return [0, 1, 2].every(i => Math.abs(actual[i] - expected[i]) <= 5);
    });
    assert.ok(noBridge, 'Screen wrapping must not draw a line through the center');

    await page.evaluate(() => window.__tartTest.load({
      snake: [{x:14,y:4},{x:13,y:4},{x:12,y:4},{x:11,y:4},{x:11,y:5},{x:11,y:6},{x:10,y:6},{x:9,y:6},{x:8,y:6},{x:7,y:6},{x:7,y:5},{x:7,y:4},{x:7,y:3},{x:6,y:3},{x:5,y:3},{x:4,y:3},{x:4,y:4},{x:4,y:5}],
      direction: 'right', food: { x: 16, y: 4 }, score: 10,
    }));
    await capture('gameplay-long.png');
    await page.screenshot({ path: path.join(output, 'map-boundaries.png') });
    const turnPoses = [];
    await page.keyboard.press('ArrowUp');
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      await page.evaluate(value => window.__tartTest.motion(value), progress);
      turnPoses.push((await snapshot()).pose);
      await capture(`turn-${Math.round(progress * 100)}.png`);
    }
    assert.ok(new Set(turnPoses.map(pose => pose.pivot.join(','))).size === 5);

    const inputBufferReport = [];
    const poseDistance = (a, b) => Math.hypot(a.pivot[0] - b.pivot[0], a.pivot[1] - b.pivot[1]);
    const assertHeadAtNode = state => {
      const head = state.game.snake[0];
      const expected = [(head.x + 0.5) * 48, (head.y + 0.5) * 48];
      assert.ok(Math.hypot(state.pose.pivot[0] - expected[0], state.pose.pivot[1] - expected[1]) < 1e-5,
        'visible head pivot matches its committed grid node');
    };
    const loadStraight = progress => page.evaluate(value => {
      window.__tartTest.load({
        snake: Array.from({ length: 8 }, (_, i) => ({ x: 10 - i, y: 6 })),
        direction: 'right', food: { x: 16, y: 3 },
      });
      window.__tartTest.motion(value);
    }, progress);
    const advanceToNextNode = async () => {
      const state = await snapshot();
      // A tiny positive epsilon avoids floating point rounding just below a tick.
      await page.evaluate(delta => window.__tartTest.advance(delta), (1 - state.progress) * 165 + 1e-7);
      const arrived = await snapshot();
      assertHeadAtNode(arrived);
      return arrived;
    };

    await loadStraight(0);
    const atNode = await snapshot();
    assertHeadAtNode(atNode);
    await page.keyboard.press('ArrowUp');
    const departedUp = await snapshot();
    assert.equal(departedUp.movingDirection, 'up', 'a turn requested at the node may select its outgoing step');
    assert.deepEqual(departedUp.game.queue, []);
    assert.ok(poseDistance(atNode.pose, departedUp.pose) < 1e-5);
    const firstUp = await advanceToNextNode();
    assert.equal(firstUp.game.ticks, 1);
    assert.equal(firstUp.game.direction, 'up');
    assert.deepEqual(firstUp.game.snake[0], { x: 10, y: 5 });

    for (const progress of [0.001, 0.05, 0.5, 0.9, 0.999]) {
      await loadStraight(progress);
      const before = await snapshot();
      await page.keyboard.press('ArrowUp');
      const accepted = await snapshot();
      assert.equal(accepted.movingDirection, 'right', `input at progress ${progress} preserves the departed node's step`);
      assert.deepEqual(accepted.game.queue, ['up'], 'input is buffered immediately for the next node');
      assert.equal(accepted.progress, before.progress, 'input does not restart the cell timer');
      assert.deepEqual(accepted.game.snake, before.game.snake, 'input preserves grid position until its fixed tick');
      assert.ok(poseDistance(accepted.pose, before.pose) < 1e-5, 'buffering input preserves the currently visible head');
      assert.ok(Math.abs(accepted.pose.heading - before.pose.heading) < 1e-5);
      if (progress === 0.5) await capture('buffered-turn-input.png');
      await page.evaluate(delta => window.__tartTest.advance(delta), (1 - progress) * 165 - 0.01);
      const beforeCommit = await snapshot();
      assert.equal(beforeCommit.game.ticks, 0);
      assert.equal(beforeCommit.movingDirection, 'right');
      const committed = await advanceToNextNode();
      assert.equal(committed.game.ticks, 1);
      assert.equal(committed.game.direction, 'right');
      assert.deepEqual(committed.game.snake[0], { x: 11, y: 6 });
      assert.equal(committed.movingDirection, 'up', 'the buffered turn starts at the next node');
      assert.deepEqual(committed.game.queue, []);
      assert.ok(poseDistance(beforeCommit.pose, committed.pose) < 0.1, 'the next node is reached without a position jump');
      assert.ok(Math.abs(beforeCommit.pose.heading - committed.pose.heading) < 0.01);
      if (progress === 0.5) await capture('buffered-turn-next-node.png');
      const turned = await advanceToNextNode();
      assert.equal(turned.game.ticks, 2);
      assert.equal(turned.game.direction, 'up');
      assert.deepEqual(turned.game.snake[0], { x: 11, y: 5 });
      if (progress === 0.5) await capture('buffered-turn-arrival.png');
      inputBufferReport.push({ inputAtProgress: progress, queuedImmediately: true, departedNodePreserved: true, nextNodeTurn: true, alignedHeadAtEachTick: true });
    }

    await loadStraight(0.9);
    await page.keyboard.press('ArrowUp');
    const beforeSecondInput = await snapshot();
    await page.keyboard.press('ArrowLeft');
    const afterSecondInput = await snapshot();
    assert.equal(afterSecondInput.movingDirection, 'right');
    assert.deepEqual(afterSecondInput.game.queue, ['up', 'left']);
    assert.ok(poseDistance(beforeSecondInput.pose, afterSecondInput.pose) < 1e-5, 'rapid buffered input does not jump the head');
    const reachedForward = await advanceToNextNode();
    assert.equal(reachedForward.game.ticks, 1);
    assert.deepEqual(reachedForward.game.snake[0], { x: 11, y: 6 });
    assert.equal(reachedForward.movingDirection, 'up');
    assert.deepEqual(reachedForward.game.queue, ['left']);
    await page.evaluate(() => window.__tartTest.advance(40));
    await page.keyboard.press('Space');
    const pausedTravel = await snapshot();
    await page.evaluate(() => window.__tartTest.advance(40));
    const stillPaused = await snapshot();
    assert.deepEqual(stillPaused.pose, pausedTravel.pose);
    assert.equal(stillPaused.progress, pausedTravel.progress);
    assert.deepEqual(stillPaused.game.queue, pausedTravel.game.queue);
    await page.keyboard.press('Space');
    const rapidTurns = await advanceToNextNode();
    assert.equal(rapidTurns.game.ticks, 2);
    assert.deepEqual(rapidTurns.game.snake[0], { x: 11, y: 5 });
    assert.equal(rapidTurns.movingDirection, 'left');
    await page.evaluate(() => window.__tartTest.advance(164.99));
    const beforeThirdNode = await snapshot();
    const thirdNode = await advanceToNextNode();
    assert.equal(thirdNode.game.ticks, 3);
    assert.deepEqual(thirdNode.game.snake[0], { x: 10, y: 5 });
    assert.equal(thirdNode.game.direction, 'left');
    assert.ok(poseDistance(beforeThirdNode.pose, thirdNode.pose) < 0.1, 'successive buffered turns meet without a position jump');
    assert.ok(Math.abs(beforeThirdNode.pose.heading - thirdNode.pose.heading) < 0.01);

    await page.evaluate(() => window.__tartTest.load({
      snake: [{ x: 10, y: 8 }, { x: 10, y: 9 }, { x: 9, y: 9 }, { x: 9, y: 8 }, { x: 9, y: 7 }],
      direction: 'left', food: { x: 16, y: 8 }, score: 7,
    }));
    await page.evaluate(() => window.__tartTest.step());
    assert.equal((await snapshot()).game.status, 'dead');
    assert.ok(await page.getByRole('dialog', { name: '超长长长蛋挞最终长度', exact: true }).isVisible());
    assert.equal(await page.locator('#final-length').textContent(), String((await snapshot()).game.snake.length));
    assert.ok(await page.getByRole('button', { name: '再来一次', exact: true }).isVisible());
    await capture('game-over.png');
    await page.getByRole('button', { name: '再来一次', exact: true }).click();
    await waitIdle();
    assert.equal((await snapshot()).game.score, 0);
    assert.equal((await snapshot()).game.snake.length, 8);
    assert.equal(await page.locator('#time-left').textContent(), '60');
    await page.evaluate(() => { window.__tartTest.remaining(1); window.__tartTest.advance(1); });
    const timedOut = await snapshot();
    assert.equal(timedOut.game.status, 'timeout');
    assert.equal(timedOut.remainingMs, 0);
    assert.equal(await page.locator('#time-left').textContent(), '0');
    assert.ok(await page.getByRole('dialog', { name: '超长长长蛋挞最终长度', exact: true }).isVisible());
    assert.equal(await page.locator('#final-length').textContent(), String(timedOut.game.snake.length));
    await page.evaluate(() => window.__tartTest.advance(1000));
    assert.deepEqual((await snapshot()).game.snake, timedOut.game.snake, 'timeout stops movement');
    await page.getByRole('button', { name: '再来一次', exact: true }).click();
    await waitIdle();
    assert.equal(await page.locator('#time-left').textContent(), '60');
    assert.equal((await snapshot()).game.snake.length, 8);
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: '回到开始界面', exact: true }).click();
    await page.waitForFunction(() => window.__tartTest.snapshot().screen === 'start' && !window.__tartTest.snapshot().busy);

    const wallPage = await context.newPage();
    await wallPage.goto('http://127.0.0.1:4173/?level=bakery-walls&test=1');
    await waitReady(wallPage);
    await wallPage.evaluate(() => window.__tartTest.load({
      snake: [{x:18,y:4},{x:17,y:4}], direction: 'right', food: { x: 13, y: 5 },
    }));
    await wallPage.evaluate(() => window.__tartTest.step());
    assert.equal(await wallPage.evaluate(() => window.__tartTest.snapshot().game.status), 'dead');
    await wallPage.locator('#stage').screenshot({ path: path.join(output, 'walls.png') });
    await wallPage.close();

    const small = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
    const mobile = await small.newPage();
    await mobile.goto('http://127.0.0.1:4173/?test=1');
    await waitReady(mobile);
    await mobile.getByRole('button', { name: '开始游戏', exact: true }).click();
    assert.equal(await mobile.evaluate(() => window.__tartTest.snapshot().busy), false);
    assert.equal(await mobile.evaluate(() => window.__tartTest.snapshot().game.status), 'running');
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mobile.screenshot({ path: path.join(output, 'mobile.png') });
    await small.close();

    // Normal session, without test hooks, must advance and respond to keyboard.
    const live = await context.newPage();
    await live.goto('http://127.0.0.1:4173/');
    await live.waitForFunction(() => !document.querySelector('#start').disabled);
    assert.equal(await live.evaluate(() => '__tartTest' in window), false);
    await live.getByRole('button', { name: '开始游戏', exact: true }).click();
    await live.waitForFunction(() => document.querySelector('#stage').dataset.screen === 'game' && document.querySelector('#stage').getAttribute('aria-busy') === 'false');
    await live.waitForFunction(() => Number(document.querySelector('#time-left').textContent) < 60, null, { timeout: 2500 });
    await live.keyboard.press('ArrowUp');
    await live.waitForTimeout(200);
    await live.keyboard.press('Space');
    assert.ok(await live.getByRole('button', { name: '继续游戏', exact: true }).isVisible());
    await live.close();

    const smooth = await context.newPage();
    await smooth.goto('http://127.0.0.1:4173/?test=1&live=1');
    await waitReady(smooth);
    await smooth.getByRole('button', { name: '开始游戏', exact: true }).click();
    await smooth.waitForFunction(() => !window.__tartTest.snapshot().busy && window.__tartTest.snapshot().screen === 'game');
    const motionReport = await smooth.evaluate(() => new Promise(resolve => {
      const started = performance.now();
      const first = window.__tartTest.snapshot();
      const positions = new Set();
      function collect(now) {
        const state = window.__tartTest.snapshot();
        positions.add(state.pose.pivot.map(value => value.toFixed(3)).join(','));
        if (now - started < 800) return requestAnimationFrame(collect);
        const durations = state.drawStats.durations.slice().sort((a,b) => a-b);
        resolve({ frames: state.drawStats.frames - first.drawStats.frames, logicalSteps: state.game.ticks - first.game.ticks, uniquePositions: positions.size, elapsedMs: now - started, p95DrawMs: durations[Math.floor(durations.length * 0.95)] });
      }
      requestAnimationFrame(collect);
    }));
    assert.ok(motionReport.frames > 25);
    assert.ok(motionReport.uniquePositions > 25);
    assert.ok(motionReport.logicalSteps >= 4 && motionReport.logicalSteps <= 6);
    await smooth.evaluate(() => window.__tartTest.load({
      snake: Array.from({ length: 8 }, (_, i) => ({ x: 10 - i, y: 6 })),
      direction: 'right', food: { x: 16, y: 3 },
    }));
    await smooth.waitForFunction(() => {
      const s = window.__tartTest.snapshot();
      return s.progress >= 0.2 && s.progress < 0.4;
    }, null, { polling: 'raf' });
    const liveInput = await smooth.evaluate(() => new Promise(resolve => {
      const first = window.__tartTest.snapshot(), started = performance.now();
      // Dispatch and inspect in the same task, so an intervening RAF cannot
      // hide the immediate queue acceptance at the end of a short grid step.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      const accepted = window.__tartTest.snapshot();
      let nextNode = null;
      function collect() {
        const state = window.__tartTest.snapshot();
        if (!nextNode && state.game.ticks === first.game.ticks + 1) {
          nextNode = { elapsedMs: performance.now() - started, head: state.game.snake[0], outgoingDirection: state.movingDirection };
        }
        if (state.game.ticks === first.game.ticks + 2) return resolve({
          queuedAtInput: accepted.game.queue,
          directionAtInput: accepted.movingDirection,
          ticksAtInput: first.game.ticks,
          ticksAfterTurn: state.game.ticks,
          startHead: first.game.snake[0], nextNode,
          finalHead: state.game.snake[0], finalDirection: state.game.direction,
          elapsedMs: performance.now() - started,
        });
        if (performance.now() - started > 600) return resolve({ failed: true });
        requestAnimationFrame(collect);
      }
      collect();
    }));
    assert.equal(liveInput.failed, undefined);
    assert.equal(liveInput.directionAtInput, 'right');
    assert.deepEqual(liveInput.queuedAtInput, ['up'], 'the live clock immediately buffers input between nodes');
    assert.equal(liveInput.ticksAfterTurn, liveInput.ticksAtInput + 2);
    assert.deepEqual(liveInput.nextNode.head, { x: liveInput.startHead.x + 1, y: liveInput.startHead.y });
    assert.equal(liveInput.nextNode.outgoingDirection, 'up');
    assert.deepEqual(liveInput.finalHead, { x: liveInput.startHead.x + 1, y: liveInput.startHead.y - 1 });
    assert.equal(liveInput.finalDirection, 'up');
    await smooth.waitForTimeout(20);
    await smooth.keyboard.press('Space');
    const beforePause = await smooth.evaluate(() => window.__tartTest.snapshot());
    await smooth.waitForTimeout(150);
    const afterPause = await smooth.evaluate(() => window.__tartTest.snapshot());
    assert.equal(afterPause.game.status, 'paused');
    assert.deepEqual(afterPause.pose, beforePause.pose);
    assert.equal(afterPause.progress, beforePause.progress);
    await smooth.keyboard.press('Space');
    await smooth.waitForTimeout(40);
    assert.equal(await smooth.evaluate(() => window.__tartTest.snapshot().game.status), 'running');
    await smooth.close();

    assert.deepEqual(errors, []);
    const report = { passed: true, sizeRatio: Number(sizeRatio.toFixed(3)), motion: motionReport, inputBuffering: inputBufferReport, liveInput, checks: ['initial 60 second countdown', 'score HUD removed', 'pause dialog and frozen remaining time', 'resume preserves remaining time', 'timeout at zero opens final length dialog', 'timeout stops movement', 'restart resets time and snake length', 'asset loading', '1.5x gameplay scale', 'solid page background and visible margins', 'start and curtain transition', 'opaque curtain coverage', 'food and growth', 'keyboard turns', 'pause and resume', 'four-edge rendering', 'no across-screen connector', 'self collision and restart', 'return to start', 'configured boundary walls', 'mobile fit', 'reduced motion', 'real game clock and controls', 'per-frame motion positions', 'pause preserves partial motion', 'input at the node selects the outgoing step', 'early middle and late input is buffered for the next node', 'departed nodes cannot be rewritten', 'input preserves current pose and timer', 'head pivot aligns with the committed node at each tick', 'rapid buffered turns remain continuous', 'pause preserves travel progress and queued turns'], consoleErrors: errors };
    await fs.writeFile(path.join(output, 'browser-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
