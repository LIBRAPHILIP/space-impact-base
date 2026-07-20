/**
 * Procedural audio: neon synthwave BGM + arcade SFX (Web Audio API).
 * No external assets required.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this.musicOn = true;
    this.sfxOn = true;
    this.bgmPlaying = false;
    this.intensity = 0; // 0 normal, 1 boss, 2 enrage
    this._nodes = [];
    this._step = 0;
    this._timer = null;
    this._started = false;
  }

  setIntensity(level = 0) {
    this.intensity = Math.max(0, Math.min(2, level));
    if (this.musicGain && this.musicOn && this.ctx) {
      const base = 0.28 + this.intensity * 0.06;
      this.musicGain.gain.setTargetAtTime(base, this.ctx.currentTime, 0.15);
    }
  }

  async ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.28;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.45;
    this.sfxGain.connect(this.master);

    this._started = true;
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stopBgm();
    else if (this.bgmPlaying) this.startBgm();
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.28 : 0;
    if (!on) this.stopBgmNodes();
    else if (this.bgmPlaying) this._scheduleLoop();
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? 0.45 : 0;
  }

  async unlock() {
    await this.ensure();
  }

  // —— SFX ——
  play(name) {
    if (!this.enabled || !this.sfxOn) return;
    const fn = this[`_sfx_${name}`];
    if (fn) {
      this.ensure().then(() => {
        if (this.ctx) fn.call(this);
      });
    }
  }

  _tone(freq, dur, type = 'square', gain = 0.12, slideTo = null) {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, gain = 0.08, filterFreq = 1200) {
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur);
  }

  _sfx_shoot() {
    this._tone(880, 0.06, 'square', 0.05, 420);
    this._tone(1320, 0.04, 'triangle', 0.03, 600);
  }

  _sfx_rail() {
    this._tone(220, 0.18, 'sawtooth', 0.08, 80);
    this._noise(0.12, 0.06, 800);
  }

  _sfx_hit() {
    this._tone(180, 0.08, 'square', 0.07, 60);
    this._noise(0.06, 0.05, 600);
  }

  _sfx_explosion() {
    this._noise(0.28, 0.14, 400);
    this._tone(120, 0.25, 'sawtooth', 0.1, 40);
    this._tone(90, 0.3, 'triangle', 0.06, 30);
  }

  _sfx_bossExplosion() {
    this._noise(0.55, 0.18, 300);
    this._tone(80, 0.5, 'sawtooth', 0.12, 25);
    this._tone(160, 0.35, 'square', 0.08, 50);
    setTimeout(() => this._noise(0.2, 0.1, 900), 80);
  }

  _sfx_powerup() {
    this._tone(440, 0.08, 'sine', 0.08);
    this._tone(660, 0.1, 'sine', 0.07);
    this._tone(880, 0.14, 'triangle', 0.06);
  }

  _sfx_damage() {
    this._tone(140, 0.15, 'sawtooth', 0.1, 50);
    this._noise(0.12, 0.08, 500);
  }

  _sfx_bossWarn() {
    this._tone(110, 0.35, 'sawtooth', 0.1);
    this._tone(165, 0.35, 'square', 0.06);
    setTimeout(() => {
      this._tone(98, 0.4, 'sawtooth', 0.1);
      this._tone(147, 0.4, 'square', 0.06);
    }, 200);
  }

  _sfx_phase() {
    this._tone(200, 0.2, 'sawtooth', 0.09, 400);
    this._noise(0.2, 0.08, 1500);
  }

  _sfx_levelClear() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => {
      setTimeout(() => this._tone(n, 0.2, 'triangle', 0.08), i * 90);
    });
  }

  _sfx_gameOver() {
    this._tone(330, 0.25, 'sawtooth', 0.1, 110);
    setTimeout(() => this._tone(220, 0.4, 'sawtooth', 0.09, 70), 180);
  }

  _sfx_ui() {
    this._tone(720, 0.05, 'sine', 0.04);
  }

  _sfx_wave() {
    this._tone(520, 0.1, 'triangle', 0.05);
    this._tone(780, 0.12, 'triangle', 0.04);
  }

  // —— BGM: modern neon synthwave pulse ——
  startBgm() {
    this.bgmPlaying = true;
    this.ensure().then(() => {
      if (!this.ctx || !this.enabled || !this.musicOn) return;
      this.stopBgmNodes();
      this._buildPad();
      this._scheduleLoop();
    });
  }

  stopBgm() {
    this.bgmPlaying = false;
    this.stopBgmNodes();
  }

  stopBgmNodes() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    for (const n of this._nodes) {
      try {
        n.stop?.();
        n.disconnect?.();
      } catch {
        /* ignore */
      }
    }
    this._nodes = [];
  }

  pauseBgm() {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(0.02, this.ctx.currentTime, 0.05);
    }
  }

  resumeBgm() {
    if (this.musicGain && this.ctx && this.musicOn) {
      this.musicGain.gain.setTargetAtTime(0.28, this.ctx.currentTime, 0.08);
    }
    if (this.bgmPlaying && !this._timer) this._scheduleLoop();
  }

  _buildPad() {
    // Slow evolving pad
    const freqs = [55, 82.5, 110];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoG = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      lfo.frequency.value = 0.08 + Math.random() * 0.05;
      lfoG.gain.value = 8;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      g.gain.value = 0.04;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start();
      lfo.start();
      this._nodes.push(osc, lfo);
    }
  }

  _scheduleLoop() {
    if (this._timer) clearInterval(this._timer);
    this._step = 0;
    // ~128 BPM sixteenth notes
    const interval = ((60 / 128) * 1000) / 4;
    this._timer = setInterval(() => this._tick(), interval);
  }

  _tick() {
    if (!this.ctx || !this.bgmPlaying || !this.musicOn || !this.enabled) return;
    const step = this._step % 16;
    const bar = Math.floor(this._step / 16) % 4;
    const inten = this.intensity;

    // Kick on 0, 8 (+ extra on enrage)
    if (step === 0 || step === 8 || (inten >= 2 && step === 4)) this._kick();
    if (step === 4 || step === 12) this._hat(0.06, 0.05 + inten * 0.01);
    if (step % 2 === 1 || inten >= 1) this._hat(0.03, 0.02 + inten * 0.01);

    const bassScale =
      inten >= 2
        ? [55, 58.27, 65.41, 73.42, 82.41, 87.31, 73.42, 65.41]
        : [55, 55, 65.41, 73.42, 82.41, 73.42, 65.41, 55];
    if (step % 2 === 0 || inten >= 2) {
      const note = bassScale[(step / 2 + bar) % bassScale.length];
      this._bass(note * (inten >= 2 ? 1.02 : 1));
    }

    const arp =
      inten >= 1
        ? [220, 277.18, 329.63, 440, 493.88, 392, 329.63, 277.18]
        : [220, 277.18, 329.63, 440, 329.63, 277.18, 246.94, 329.63];
    if ((step + bar) % (inten >= 2 ? 1 : 3) !== 2) {
      this._arp(arp[(step + bar * 2) % arp.length] * (bar === 3 && step > 10 ? 1.5 : 1));
    }

    if (step === 0) this._atmos(bar);
    if (inten >= 1 && step === 8) this._atmos(bar + 1);

    this._step += 1;
  }

  _kick() {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.12);
    g.gain.setValueAtTime(0.22, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }

  _hat(dur, gain) {
    this._noiseMusic(dur, gain, 6000);
  }

  _noiseMusic(dur, gain, freq) {
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    src.start(t0);
    src.stop(t0 + dur);
  }

  _bass(freq) {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t0);
    filter.frequency.exponentialRampToValueAtTime(120, t0 + 0.12);
    g.gain.setValueAtTime(0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.16);
  }

  _arp(freq) {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const delay = this.ctx.createDelay();
    const feedback = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    delay.delayTime.value = 0.18;
    feedback.gain.value = 0.25;
    g.gain.setValueAtTime(0.045, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    osc.connect(g);
    g.connect(this.musicGain);
    g.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  }

  _atmos(bar) {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = bar % 2 === 0 ? 330 : 392;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.03, t0 + 0.3);
    g.gain.linearRampToValueAtTime(0.001, t0 + 1.4);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + 1.5);
  }
}

export const audio = new AudioEngine();
