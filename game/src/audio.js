// Synthesized WebAudio sound for Solmar Bay: gunshots, pickups, cash,
// sirens, an engine hum and a low-key bass music loop. Everything is built
// from oscillators and filtered noise, so the game loads no audio files.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (err) {
      return false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      gain.gain.setValueAtTime(vol || 0.2, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain); gain.connect(this.master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (err) { /* audio is best-effort */ }
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1800;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.3, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter); filter.connect(gain); gain.connect(this.master);
      src.start(t0);
    } catch (err) { /* audio is best-effort */ }
  }

  shot(isSmg) {
    this.noise(isSmg ? 0.07 : 0.14, isSmg ? 0.22 : 0.4, isSmg ? 2600 : 1400);
    this.tone(isSmg ? 220 : 140, 0.08, 'square', 0.12, 60);
  }

  hit() { this.tone(320, 0.08, 'triangle', 0.18, 180); }
  pickup() { this.tone(660, 0.12, 'sine', 0.22); this.tone(990, 0.18, 'sine', 0.18); }
  cash() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.2), i * 70));
  }

  denied() { this.tone(160, 0.16, 'sawtooth', 0.14, 110); }
  busted() { this.tone(440, 0.5, 'sawtooth', 0.18, 220); this.tone(330, 0.6, 'sawtooth', 0.14, 165); }
  wasted() { this.tone(220, 0.9, 'sawtooth', 0.2, 55); }

  setEngine(speed01) {
    if (!this.ctx) return;
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 700;
        this.engineOsc.connect(filter); filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      const target = speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.1);
    } catch (err) { /* audio is best-effort */ }
  }

  setSiren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.sirenOn) {
        this.sirenOn = true;
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'square';
        this.sirenOsc.frequency.value = 720;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.035;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.9;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start(); lfo.start();
        this.sirenLfo = lfo;
      } else if (!on && this.sirenOn) {
        this.sirenOn = false;
        try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (err) { /* already stopped */ }
        this.sirenOsc = null; this.sirenLfo = null;
      }
    } catch (err) { /* audio is best-effort */ }
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    // A-minor bass walk with a soft pad note, one step every 320 ms.
    const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
    const pad = [220, 261.63, 329.63, 220];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const step = this.musicStep % 8;
      this.tone(bass[step], 0.3, 'triangle', 0.11);
      if (step % 2 === 0) this.tone(pad[(step / 2) | 0], 0.6, 'sine', 0.045);
      this.musicStep += 1;
    }, 320);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
