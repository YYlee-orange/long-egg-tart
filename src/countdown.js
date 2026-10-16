export function createCountdown(seconds = 60) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(seconds * 1000)) {
    throw new RangeError('Countdown duration must be a finite positive number of seconds.');
  }
  const durationMs = seconds * 1000;
  return { durationMs, remainingMs: durationMs };
}

export function timeBudget(clock, deltaMs) {
  if (typeof deltaMs !== 'number' || !Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return Math.min(deltaMs, Math.max(0, clock.remainingMs));
}

export function advanceCountdown(clock, deltaMs, running = true) {
  const elapsedMs = running ? timeBudget(clock, deltaMs) : 0;
  clock.remainingMs = Math.max(0, clock.remainingMs - elapsedMs);
  return { elapsedMs, expired: running && clock.remainingMs === 0 };
}

export function remainingSeconds(clock) {
  return Math.ceil(Math.max(0, clock.remainingMs) / 1000);
}
