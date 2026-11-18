// Synthesized sound for Solmar Bay: every effect and the music are made with WebAudio.
// No audio files are loaded. Everything is safe to call before the audio context exists.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicOn = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    let node = src;
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  shot() {
    this.noise(0.12, 0.5, 3200);
    this.tone(180, 0.08, 'square', 0.15, 0, 60);
  }

  dryClick() {
    this.tone(1200, 0.04, 'square', 0.08);
  }

  reload() {
    this.tone(500, 0.05, 'square', 0.1);
    this.tone(700, 0.05, 'square', 0.1, 0.09);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.2);
    this.tone(990, 0.12, 'sine', 0.2, 0.08);
  }

  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.tone(n, 0.22, 'triangle', 0.22, i * 0.12));
  }

  busted() {
    this.tone(392, 0.3, 'sawtooth', 0.18);
    this.tone(311, 0.3, 'sawtooth', 0.18, 0.25);
    this.tone(233, 0.6, 'sawtooth', 0.18, 0.5);
  }

  crash() {
    this.noise(0.25, 0.4, 900);
  }

  setEngine(level) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      this.engineOsc.connect(f);
      f.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = level <= 0.01 ? 0 : 0.03 + level * 0.05;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + level * 130, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.05;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      let hi = true;
      this.sirenTimer = window.setInterval(() => {
        if (!this.sirenOsc) return;
        hi = !hi;
        this.sirenOsc.frequency.setTargetAtTime(hi ? 950 : 700, this.ctx.currentTime, 0.05);
      }, 380);
    } else if (!on && this.sirenOsc) {
      window.clearInterval(this.sirenTimer);
      this.sirenTimer = null;
      const osc = this.sirenOsc;
      const g = this.sirenGain;
      this.sirenOsc = null;
      this.sirenGain = null;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      window.setTimeout(() => {
        try {
          osc.stop();
        } catch {
          // already stopped
        }
      }, 300);
    }
  }

  startMusic() {
    if (this.musicOn || !this.ensure()) return;
    this.musicOn = true;
    // A slow sun-soaked groove: Am - F - C - G, one bar a second, soft pad plus bass.
    const chords = [
      [220, 261.6, 329.6],
      [174.6, 220, 261.6],
      [196, 261.6, 329.6],
      [196, 246.9, 293.7],
    ];
    const bass = [110, 87.3, 130.8, 98];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const i = this.musicStep % 4;
      const chord = chords[i];
      chord.forEach((f) => this.tone(f, 0.95, 'sine', 0.045));
      this.tone(bass[i], 0.9, 'triangle', 0.07);
      this.musicStep++;
    }, 1000);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
