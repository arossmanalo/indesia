/**
 * All game audio is synthesized at runtime with the Web Audio API: no sound files, so
 * nothing to download or license. Sound effects are short envelopes on oscillators and
 * noise; music is a tiny step sequencer scheduled slightly ahead of time.
 */

export type Sfx =
  | 'arrow'
  | 'cannon'
  | 'bolt'
  | 'shard'
  | 'hit'
  | 'kill'
  | 'leak'
  | 'build'
  | 'upgrade'
  | 'sell'
  | 'wave'
  | 'waveClear'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'error';

export type Track = 'menu' | 'battle';

/** Minimum milliseconds between two plays of the same effect (keeps 3x speed bearable). */
const THROTTLE: Partial<Record<Sfx, number>> = {
  arrow: 45,
  cannon: 80,
  bolt: 60,
  shard: 60,
  hit: 40,
  kill: 35,
};

const A4 = 440;
const note = (semitonesFromA4: number) => A4 * 2 ** (semitonesFromA4 / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private music!: GainNode;
  private sfx!: GainNode;
  private noise!: AudioBuffer;
  private lastPlayed = new Map<Sfx, number>();
  private musicVolume = 0.6;
  private sfxVolume = 0.8;
  private track: Track | null = null;
  private sequencer: number | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;

  /** Browsers only allow audio after a user gesture: call from input handlers. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      const master = this.ctx.createGain();
      master.gain.value = 0.8;
      master.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.connect(master);
      this.sfx.connect(master);
      this.applyVolumes();
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      if (this.track) this.startSequencer();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Volumes 0-100 (perceptual curve). */
  setVolumes(music: number, sfx: number): void {
    this.musicVolume = (music / 100) ** 2;
    this.sfxVolume = (sfx / 100) ** 2;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(this.musicVolume * 0.5, this.ctx.currentTime, 0.05);
    this.sfx.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.02);
  }

  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.sfxVolume === 0) return;
    const now = performance.now();
    const gap = THROTTLE[name];
    if (gap && now - (this.lastPlayed.get(name) ?? 0) < gap) return;
    this.lastPlayed.set(name, now);
    SOUNDS[name](this, ctx.currentTime);
  }

  setTrack(track: Track | null): void {
    if (this.track === track) return;
    this.track = track;
    this.stopSequencer();
    if (track && this.ctx) this.startSequencer();
  }

  // --- synthesis helpers ------------------------------------------------------------

  tone(opts: {
    t: number;
    type: OscillatorType;
    from: number;
    to?: number;
    dur: number;
    vol: number;
    attack?: number;
    out?: 'sfx' | 'music';
    filter?: number;
  }): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.from, opts.t);
    if (opts.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), opts.t + opts.dur);
    }
    const attack = opts.attack ?? 0.005;
    gain.gain.setValueAtTime(0.0001, opts.t);
    gain.gain.exponentialRampToValueAtTime(opts.vol, opts.t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.t + opts.dur);
    let node: AudioNode = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      osc.connect(f);
      node = f;
    }
    node.connect(gain);
    gain.connect(opts.out === 'music' ? this.music : this.sfx);
    osc.start(opts.t);
    osc.stop(opts.t + opts.dur + 0.02);
  }

  burst(opts: {
    t: number;
    dur: number;
    vol: number;
    type: BiquadFilterType;
    freq: number;
    q?: number;
    out?: 'sfx' | 'music';
  }): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.value = opts.freq;
    filter.Q.value = opts.q ?? 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.vol, opts.t);
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.t + opts.dur);
    src
      .connect(filter)
      .connect(gain)
      .connect(opts.out === 'music' ? this.music : this.sfx);
    src.start(opts.t, Math.random() * 0.5);
    src.stop(opts.t + opts.dur + 0.02);
  }

  // --- music ------------------------------------------------------------------------

  private startSequencer(): void {
    const ctx = this.ctx!;
    this.nextStepTime = ctx.currentTime + 0.1;
    this.stepIndex = 0;
    this.sequencer = window.setInterval(() => this.schedule(), 25);
  }

  private stopSequencer(): void {
    if (this.sequencer !== null) window.clearInterval(this.sequencer);
    this.sequencer = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    const song = SONGS[this.track];
    const stepDur = 60 / song.bpm / 4;
    while (this.nextStepTime < ctx.currentTime + 0.12) {
      song.step(this, this.stepIndex, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.stepIndex++;
    }
  }
}

type Sound = (a: AudioEngine, t: number) => void;

const SOUNDS: Record<Sfx, Sound> = {
  arrow: (a, t) => {
    a.tone({ t, type: 'triangle', from: 1100, to: 380, dur: 0.07, vol: 0.18 });
    a.burst({ t, dur: 0.04, vol: 0.12, type: 'highpass', freq: 3500 });
  },
  cannon: (a, t) => {
    a.tone({ t, type: 'sine', from: 140, to: 40, dur: 0.3, vol: 0.5 });
    a.burst({ t, dur: 0.22, vol: 0.35, type: 'lowpass', freq: 700 });
  },
  bolt: (a, t) => {
    a.tone({ t, type: 'square', from: 520, to: 1400, dur: 0.12, vol: 0.08, filter: 2400 });
    a.tone({ t: t + 0.02, type: 'sine', from: 1600, to: 900, dur: 0.1, vol: 0.06 });
  },
  shard: (a, t) => {
    a.tone({ t, type: 'sine', from: 1900, dur: 0.18, vol: 0.08 });
    a.tone({ t: t + 0.03, type: 'sine', from: 2530, dur: 0.16, vol: 0.06 });
  },
  hit: (a, t) => a.burst({ t, dur: 0.03, vol: 0.08, type: 'bandpass', freq: 1800, q: 2 }),
  kill: (a, t) => {
    a.tone({ t, type: 'square', from: 340, to: 90, dur: 0.08, vol: 0.07, filter: 1800 });
    a.tone({ t: t + 0.05, type: 'square', from: note(15), dur: 0.05, vol: 0.04, filter: 4000 });
    a.tone({ t: t + 0.09, type: 'square', from: note(20), dur: 0.07, vol: 0.04, filter: 4000 });
  },
  leak: (a, t) => {
    a.tone({ t, type: 'square', from: 220, to: 160, dur: 0.16, vol: 0.12, filter: 1200 });
    a.tone({ t: t + 0.18, type: 'square', from: 165, to: 110, dur: 0.22, vol: 0.12, filter: 1200 });
  },
  build: (a, t) => {
    a.burst({ t, dur: 0.12, vol: 0.3, type: 'lowpass', freq: 500 });
    a.tone({ t, type: 'sine', from: 180, to: 90, dur: 0.12, vol: 0.25 });
  },
  upgrade: (a, t) => {
    [0, 4, 7, 12].forEach((s, i) =>
      a.tone({
        t: t + i * 0.06,
        type: 'square',
        from: note(3 + s),
        dur: 0.1,
        vol: 0.06,
        filter: 3000,
      }),
    );
  },
  sell: (a, t) => {
    [19, 15, 12].forEach((s, i) =>
      a.tone({
        t: t + i * 0.05,
        type: 'square',
        from: note(s),
        dur: 0.06,
        vol: 0.05,
        filter: 4000,
      }),
    );
  },
  wave: (a, t) => {
    a.tone({
      t,
      type: 'sawtooth',
      from: note(-14),
      dur: 0.9,
      vol: 0.12,
      attack: 0.15,
      filter: 900,
    });
    a.tone({ t, type: 'sawtooth', from: note(-7), dur: 0.9, vol: 0.08, attack: 0.15, filter: 900 });
    a.burst({ t, dur: 0.3, vol: 0.2, type: 'lowpass', freq: 200 });
  },
  waveClear: (a, t) => {
    [0, 7, 12].forEach((s, i) =>
      a.tone({ t: t + i * 0.08, type: 'triangle', from: note(3 + s), dur: 0.14, vol: 0.1 }),
    );
  },
  victory: (a, t) => {
    [0, 4, 7, 12, 7, 12].forEach((s, i) =>
      a.tone({
        t: t + i * 0.13,
        type: 'square',
        from: note(3 + s),
        dur: i === 5 ? 0.6 : 0.12,
        vol: 0.08,
        filter: 3500,
      }),
    );
  },
  defeat: (a, t) => {
    [7, 3, 0, -5].forEach((s, i) =>
      a.tone({ t: t + i * 0.22, type: 'triangle', from: note(s), dur: 0.3, vol: 0.12 }),
    );
  },
  click: (a, t) =>
    a.tone({ t, type: 'square', from: 900, to: 600, dur: 0.03, vol: 0.04, filter: 3000 }),
  error: (a, t) => {
    a.tone({ t, type: 'square', from: 180, dur: 0.07, vol: 0.06, filter: 1000 });
    a.tone({ t: t + 0.09, type: 'square', from: 150, dur: 0.09, vol: 0.06, filter: 1000 });
  },
};

interface Song {
  bpm: number;
  step: (a: AudioEngine, i: number, t: number, stepDur: number) => void;
}

// Chords as semitones from A4 (roots in the bass octave): Am, F, C, G.
const PROGRESSION = [
  [0, 3, 7],
  [-4, 0, 3],
  [3, 7, 10],
  [-2, 2, 5],
];

const SONGS: Record<Track, Song> = {
  menu: {
    bpm: 76,
    step: (a, i, t, d) => {
      const chord = PROGRESSION[Math.floor(i / 32) % 4]!;
      const pos = i % 32;
      if (pos === 0) {
        for (const s of chord) {
          a.tone({
            t,
            type: 'triangle',
            from: note(s - 12),
            dur: d * 30,
            vol: 0.05,
            attack: 0.6,
            out: 'music',
          });
        }
      }
      if (pos % 4 === 0) {
        const s = chord[(pos / 4) % 3]! + 12 + (pos % 16 === 8 ? 12 : 0);
        a.tone({
          t,
          type: 'sine',
          from: note(s),
          dur: d * 3.5,
          vol: 0.035,
          attack: 0.02,
          out: 'music',
        });
      }
    },
  },
  battle: {
    bpm: 116,
    step: (a, i, t, d) => {
      const chord = PROGRESSION[Math.floor(i / 16) % 4]!;
      const pos = i % 16;
      // Bass on the beat, with a pickup.
      if (pos % 4 === 0 || pos === 14) {
        a.tone({
          t,
          type: 'triangle',
          from: note(chord[0]! - 24),
          dur: d * 1.8,
          vol: 0.16,
          out: 'music',
        });
      }
      // Arpeggio.
      const arp = [0, 1, 2, 1][pos % 4]!;
      a.tone({
        t,
        type: 'square',
        from: note(chord[arp]! + (pos >= 8 ? 12 : 0)),
        dur: d * 0.9,
        vol: 0.025,
        filter: 1800,
        out: 'music',
      });
      // Drums: kick, snare and hats.
      if (pos === 0 || pos === 8 || pos === 10) {
        a.tone({ t, type: 'sine', from: 150, to: 45, dur: 0.14, vol: 0.22, out: 'music' });
      }
      if (pos === 4 || pos === 12)
        a.burst({ t, dur: 0.1, vol: 0.08, type: 'bandpass', freq: 1800, out: 'music' });
      if (pos % 2 === 1)
        a.burst({ t, dur: 0.03, vol: 0.03, type: 'highpass', freq: 7000, out: 'music' });
    },
  },
};

export const audio = new AudioEngine();
