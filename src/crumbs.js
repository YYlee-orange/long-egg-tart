const COLORS = ['#C38C55', '#DDB575', '#F3D994', '#FFF1C5'];

export function emitCrumbs(particles, x, y, cellSize, seed, reducedMotion = false) {
  // Keep visual randomness independent of food spawning and game rules.
  let value = (seed >>> 0) || 1;
  const random = () => {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
  const count = reducedMotion ? 7 : 18;
  for (let i = 0; i < count; i++) {
    const angle = Math.PI * 2 * (i + random() * 0.6) / count;
    const speed = cellSize * (2.2 + random() * 2.8);
    particles.push({
      x: x + (random() - 0.5) * cellSize * 0.22,
      y: y + (random() - 0.5) * cellSize * 0.18,
      vx: reducedMotion ? 0 : Math.cos(angle) * speed,
      vy: reducedMotion ? 0 : Math.sin(angle) * speed - cellSize * 0.8,
      gravity: reducedMotion ? 0 : cellSize * 4,
      angle: random() * Math.PI * 2,
      spin: reducedMotion ? 0 : (random() - 0.5) * 16,
      size: cellSize * (0.035 + random() * 0.04),
      color: COLORS[i % COLORS.length],
      drop: i % 5 === 0,
      age: 0,
      life: reducedMotion ? 220 : 380 + random() * 280,
    });
  }
  if (particles.length > 96) particles.splice(0, particles.length - 96);
}

export function advanceCrumbs(particles, deltaMs) {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
  const dt = deltaMs / 1000, drag = Math.exp(-2.8 * dt);
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.age += deltaMs;
    if (particle.age >= particle.life) { particles.splice(i, 1); continue; }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt + particle.gravity * dt * dt / 2;
    particle.vx *= drag;
    particle.vy = particle.vy * drag + particle.gravity * dt;
    particle.angle += particle.spin * dt;
  }
}
