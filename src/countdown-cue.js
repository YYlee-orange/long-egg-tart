// Presentation follows the round clock; it never starts its own timer.
export class CountdownCue {
  constructor(element) {
    this.element = element;
    this.lastSecond = null;
    this.animation = null;
    this.audio = null;
    this.voice = null;
  }

  unlock() {
    // Create/resume only from a start or continue gesture (browser audio policy).
    try {
      const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Audio) return;
      if (!this.audio || this.audio.state === 'closed') this.audio = new Audio({ latencyHint: 'interactive' });
      if (this.audio.state !== 'running') this.audio.resume().catch(() => {});
    } catch {
      this.audio = null;
    }
  }

  update(seconds, { active, reducedMotion = false }) {
    const urgent = seconds >= 0 && seconds <= 10;
    this.element.classList.toggle('is-urgent', urgent);
    if (!active || !urgent || seconds === 0) {
      this.stop();
      if (!urgent) this.lastSecond = null;
      return;
    }
    if (reducedMotion) this.cancelPulse();
    // UI syncs and pause/resume must not replay the current second's cue.
    if (seconds === this.lastSecond) return;
    this.lastSecond = seconds;
    if (!reducedMotion) this.pulse();
    this.beep();
  }

  pulse() {
    this.cancelPulse();
    this.animation = this.element.animate([
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.3, .88)', offset: 0.18 },
      { transform: 'scale(.92, 1.16)', offset: 0.4 },
      { transform: 'scale(1.08, .96)', offset: 0.63 },
      { transform: 'scale(.98, 1.03)', offset: 0.82 },
      { transform: 'scale(1)', offset: 1 },
    ], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  beep() {
    if (this.audio?.state !== 'running') return;
    this.stopVoice();
    const oscillator = this.audio.createOscillator();
    const gain = this.audio.createGain();
    const now = this.audio.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(960, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.008);
    gain.gain.setValueAtTime(0.12, now + 0.055);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    oscillator.connect(gain);
    gain.connect(this.audio.destination);
    const voice = { oscillator, gain };
    this.voice = voice;
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      if (this.voice === voice) this.voice = null;
    };
    oscillator.start(now);
    oscillator.stop(now + 0.14);
  }

  cancelPulse() {
    this.animation?.cancel();
    this.animation = null;
  }

  stopVoice() {
    if (!this.voice) return;
    this.voice.oscillator.stop();
    this.voice.oscillator.disconnect();
    this.voice.gain.disconnect();
    this.voice = null;
  }

  stop() {
    this.cancelPulse();
    this.stopVoice();
  }

  reset() {
    this.stop();
    this.lastSecond = null;
    this.element.classList.remove('is-urgent');
  }

  dispose() {
    this.stop();
    if (this.audio && this.audio.state !== 'closed') this.audio.close().catch(() => {});
    this.audio = null;
  }
}
