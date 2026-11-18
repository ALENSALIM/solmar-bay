// All sound is synthesized with WebAudio: no audio files, no network. A tiny
// step-sequenced bass line and pad play as music, and every game event has a sound.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let muted = false;
  let musicTimer = null;
  let step = 0;

  // A lazy, low-key bass line in A minor over a soft pad: the city's own radio.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  const CHORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 207.65, 246.94]];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 500;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function note(freq, when, dur, type, gainValue, dest) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(gainValue, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(dest || master);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  function noiseBurst(when, dur, gainValue, filterFreq) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(when);
  }

  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      const bass = BASS[step % BASS.length];
      if (bass > 0) note(bass, now, 0.22, 'triangle', 0.5, musicGain);
      if (step % 16 === 0) {
        const chord = CHORDS[(step / 16) % CHORDS.length | 0];
        for (const freq of chord) note(freq, now, 1.8, 'sine', 0.12, musicGain);
      }
      if (step % 4 === 2) noiseBurst(now, 0.03, 0.05, 6000);
      step += 1;
    }, 140);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get isMuted() { return muted; },
    setEngine(speed01, on) {
      if (!ctx) return;
      const target = on ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(400 + speed01 * 1400, ctx.currentTime, 0.1);
    },
    gunshot() {
      if (!ensure()) return;
      noiseBurst(ctx.currentTime, 0.12, 0.5, 2500);
      note(90, ctx.currentTime, 0.1, 'square', 0.25);
    },
    sirenBlip() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      note(880, now, 0.16, 'sine', 0.12);
      note(1174, now + 0.18, 0.16, 'sine', 0.12);
    },
    crash() {
      if (!ensure()) return;
      noiseBurst(ctx.currentTime, 0.25, 0.4, 900);
    },
    pickup() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      note(523.25, now, 0.09, 'sine', 0.3);
      note(659.25, now + 0.09, 0.09, 'sine', 0.3);
      note(783.99, now + 0.18, 0.16, 'sine', 0.3);
    },
    missionDone() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, now + i * 0.11, 0.22, 'triangle', 0.3));
    },
    missionFail() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      note(220, now, 0.3, 'sawtooth', 0.2);
      note(174.61, now + 0.25, 0.45, 'sawtooth', 0.2);
    },
    click() {
      if (!ensure()) return;
      note(660, ctx.currentTime, 0.05, 'square', 0.15);
    },
  };
}
