// Synthesized WebAudio: engine hum, gunshots, sirens, chimes and a small
// music loop. Everything is generated locally; no audio files, no network.
// The context is created on the first user gesture (Enter / click) and all
// calls are no-ops until then, so headless runs stay silent and error-free.
export function makeAudio() {
  return {
    ctx: null,
    master: null,
    musicGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
    musicTimer: null,
    step: 0,
  };
}

export function initAudio(audio) {
  if (audio.ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.14;
    audio.musicGain.connect(audio.master);
    // Engine hum: sawtooth through a lowpass, pitch follows speed.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 50;
    const lp = audio.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0.0;
    audio.engineOsc.connect(lp);
    lp.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Siren: triangle wave whose frequency wails between two tones.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenOsc.frequency.value = 750;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0.0;
    const lfo = audio.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.9;
    const lfoGain = audio.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(audio.sirenOsc.frequency);
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    lfo.start();
    startMusic(audio);
  } catch {
    audio.ctx = null;
  }
}

function note(audio, freq, when, dur, type, vol, dest) {
  if (!audio.ctx) return;
  const o = audio.ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(dest || audio.master);
  o.start(when);
  o.stop(when + dur + 0.05);
}

// A laid-back 16-step loop: bassline + sparse chords, Am - F - C - G.
function startMusic(audio) {
  if (!audio.ctx || audio.musicTimer !== null) return;
  const bass = [110, 0, 110, 0, 87.31, 0, 87.31, 0, 130.81, 0, 130.81, 0, 98, 0, 98, 0];
  const chord = [220, 261.63, 329.63];
  audio.musicTimer = window.setInterval(() => {
    if (!audio.ctx || audio.ctx.state === 'suspended') return;
    const t = audio.ctx.currentTime + 0.05;
    const b = bass[audio.step % 16];
    if (b > 0) note(audio, b, t, 0.22, 'sine', 0.5, audio.musicGain);
    if (audio.step % 8 === 0) {
      const root = [0, -4, 3, -2][Math.floor(audio.step / 8) % 4];
      for (const f of chord) note(audio, f * Math.pow(2, root / 12), t, 1.6, 'triangle', 0.12, audio.musicGain);
    }
    if (audio.step % 4 === 2) note(audio, 880, t, 0.08, 'sine', 0.05, audio.musicGain);
    audio.step++;
  }, 240);
}

export function setEngine(audio, speedNorm) {
  if (!audio.ctx || !audio.engineOsc) return;
  const t = audio.ctx.currentTime;
  audio.engineOsc.frequency.setTargetAtTime(48 + speedNorm * 130, t, 0.08);
  audio.engineGain.gain.setTargetAtTime(speedNorm > 0.03 ? 0.05 + speedNorm * 0.05 : 0.0, t, 0.1);
}

export function setSiren(audio, on) {
  if (!audio.ctx || !audio.sirenGain) return;
  audio.sirenOn = on;
  audio.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0.0, audio.ctx.currentTime, 0.2);
}

export function playShot(audio) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  const dur = 0.14;
  const buf = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * dur), audio.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audio.ctx.createBufferSource();
  src.buffer = buf;
  const f = audio.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(300, t + dur);
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(audio.master);
  src.start(t);
}

export function playChime(audio) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  note(audio, 660, t, 0.18, 'sine', 0.3);
  note(audio, 990, t + 0.1, 0.3, 'sine', 0.3);
}

export function playHorn(audio) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  note(audio, 370, t, 0.25, 'square', 0.12);
  note(audio, 466, t, 0.25, 'square', 0.1);
}

export function playThud(audio) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  note(audio, 90, t, 0.2, 'sine', 0.5);
}

export function playClick(audio) {
  if (!audio.ctx) return;
  note(audio, 520, audio.ctx.currentTime, 0.07, 'sine', 0.2);
}
