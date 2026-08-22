import { BEAT_MS } from "./engine";
import {
  hitsAtStep,
  midiToHz,
  themeStepMs,
  type ThemeMode,
  type ThemeVoice,
} from "./theme";

const THEME_STEP_SEC = themeStepMs(BEAT_MS) / 1000;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.14;
const SONG_GAIN = 0.28;
const SFX_GAIN = 0.05;

export function getAudioContext(ref: { current: AudioContext | null }) {
  if (ref.current) return ref.current;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ref.current = new Ctor();
  return ref.current;
}

export function playSfx(ctx: AudioContext, kind: "hit" | "cringe" | "six") {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  if (kind === "cringe") {
    osc.frequency.value = 70;
    osc.type = "sawtooth";
    gain.gain.setValueAtTime(SFX_GAIN, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.17);
    return;
  }
  if (kind === "six") {
    osc.frequency.value = 392;
    osc.type = "triangle";
    gain.gain.setValueAtTime(SFX_GAIN, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.23);
    return;
  }
  osc.frequency.value = 220;
  osc.type = "triangle";
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  osc.start(now);
  osc.stop(now + 0.11);
}

function distortionCurve(amount: number) {
  const samples = 256;
  const curve = new Float32Array(samples);
  const k = amount;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function noiseBuffer(ctx: AudioContext) {
  const length = Math.floor(ctx.sampleRate * 0.35);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class AuraTheme {
  private readonly master: GainNode;
  private readonly bus: GainNode;
  private readonly noise: AudioBuffer;
  private readonly crush: WaveShaperNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private nextStep = 0;
  private nextTime = 0;
  private playing = false;
  private muted = false;
  private mode: ThemeMode = "intro";

  constructor(private readonly ctx: AudioContext) {
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.crush = ctx.createWaveShaper();
    this.crush.curve = distortionCurve(2.4);
    this.crush.oversample = "2x";

    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.crush);
    this.crush.connect(this.master);

    this.noise = noiseBuffer(ctx);
  }

  start(mode: ThemeMode) {
    this.mode = mode;
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    this.setMaster(this.muted ? 0 : SONG_GAIN, 0.04);
    if (this.playing) return;
    this.playing = true;
    this.nextStep = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.tick();
    this.timer = setInterval(() => this.tick(), LOOKAHEAD_MS);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.playing) {
      this.master.gain.value = 0;
      return;
    }
    this.setMaster(muted ? 0 : SONG_GAIN, 0.05);
  }

  stop(fadeSec = 0.45) {
    if (!this.playing) return;
    this.setMaster(0.0001, fadeSec);
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => this.halt(), fadeSec * 1000 + 20);
  }

  dispose() {
    this.halt();
    this.master.disconnect();
  }

  private halt() {
    this.playing = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.value = 0;
  }

  private setMaster(value: number, seconds: number) {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now);
    this.master.gain.exponentialRampToValueAtTime(Math.max(value, 0.0001), now + seconds);
  }

  private tick() {
    if (!this.playing) return;
    const horizon = this.ctx.currentTime + SCHEDULE_AHEAD_SEC;
    while (this.nextTime < horizon) {
      for (const note of hitsAtStep(this.nextStep, this.mode)) {
        this.voice(note.voice, this.nextTime, note.gain, note.midi, note.slideTo);
      }
      this.nextStep += 1;
      this.nextTime += THEME_STEP_SEC;
    }
  }

  private voice(
    kind: ThemeVoice,
    time: number,
    gain: number,
    midi?: number,
    slideTo?: number,
  ) {
    if (kind === "kick") this.kick(time, gain);
    else if (kind === "clap") this.clap(time, gain);
    else if (kind === "hat") this.hat(time, gain);
    else if (kind === "cowbell") this.cowbell(time, gain);
    else if (kind === "bass") this.bass(time, gain, midi ?? 27, slideTo);
    else this.lead(time, gain, midi ?? 63);
  }

  private kick(time: number, gain: number) {
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(168, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.09);
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    osc.connect(amp);
    amp.connect(this.bus);
    osc.start(time);
    osc.stop(time + 0.26);

    const click = this.ctx.createOscillator();
    const clickAmp = this.ctx.createGain();
    click.type = "square";
    click.frequency.value = 92;
    clickAmp.gain.setValueAtTime(gain * 0.18, time);
    clickAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    click.connect(clickAmp);
    clickAmp.connect(this.bus);
    click.start(time);
    click.stop(time + 0.04);
  }

  private clap(time: number, gain: number) {
    for (const offset of [0, 0.012, 0.026]) {
      const src = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const amp = this.ctx.createGain();
      src.buffer = this.noise;
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      filter.Q.value = 0.9;
      amp.gain.setValueAtTime(gain, time + offset);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + offset + 0.12);
      src.connect(filter);
      filter.connect(amp);
      amp.connect(this.bus);
      src.start(time + offset);
      src.stop(time + offset + 0.14);
    }
  }

  private hat(time: number, gain: number) {
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const amp = this.ctx.createGain();
    src.buffer = this.noise;
    filter.type = "highpass";
    filter.frequency.value = 7200;
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.bus);
    src.start(time);
    src.stop(time + 0.05);
  }

  private cowbell(time: number, gain: number) {
    for (const freq of [545, 808]) {
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(gain, time);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
      osc.connect(amp);
      amp.connect(this.bus);
      osc.start(time);
      osc.stop(time + 0.18);
    }
  }

  private bass(time: number, gain: number, midi: number, slideTo?: number) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const amp = this.ctx.createGain();
    osc.type = "sine";
    const startHz = midiToHz(midi);
    osc.frequency.setValueAtTime(startHz, time);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(midiToHz(slideTo), time + 0.2);
    }
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, time);
    filter.frequency.exponentialRampToValueAtTime(140, time + 0.28);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(gain, time + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.62);
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(this.bus);
    osc.start(time);
    osc.stop(time + 0.64);
  }

  private lead(time: number, gain: number, midi: number) {
    const freq = midiToHz(midi);
    for (const detune of [-8, 7]) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const amp = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, time);
      filter.frequency.exponentialRampToValueAtTime(520, time + 0.28);
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.exponentialRampToValueAtTime(gain, time + 0.03);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
      osc.connect(filter);
      filter.connect(amp);
      amp.connect(this.bus);
      osc.start(time);
      osc.stop(time + 0.44);
    }
  }
}
