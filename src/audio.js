export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.lastStep = 0;
    this.original = new Audio(`${import.meta.env.BASE_URL}original/audio/scream2.wav`);
    this.original.preload = 'auto';
    this.original.volume = .88;
    this.nearbyOriginal = new Audio(`${import.meta.env.BASE_URL}original/audio/nearbysound.wav`);
    this.nearbyOriginal.volume = .45;
    this.switchOriginal = new Audio(`${import.meta.env.BASE_URL}original/audio/switch.ogg`);
    this.switchOriginal.volume = .38;
    this.originalUrl = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = .72;
    this.master.connect(this.ctx.destination);
    const droneBus = this.ctx.createGain();
    droneBus.gain.value = .18;
    droneBus.connect(this.master);
    for (const [freq, type, amp] of [[49, 'sine', .4], [51.4, 'triangle', .18], [73, 'sine', .08]]) {
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = type; osc.frequency.value = freq; gain.gain.value = amp;
      osc.connect(gain); gain.connect(droneBus); osc.start();
    }
    const len = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let prior = 0;
    for (let i = 0; i < len; i++) { prior = (prior + (Math.random() * 2 - 1) * .025) / 1.008; data[i] = prior * 2.4; }
    const wind = this.ctx.createBufferSource(), windFilter = this.ctx.createBiquadFilter(), windGain = this.ctx.createGain();
    wind.buffer = buffer; wind.loop = true;
    windFilter.type = 'lowpass'; windFilter.frequency.value = 650; windGain.gain.value = .23;
    wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(this.master); wind.start();
    this.ambient = { windGain, droneBus };
  }

  tone(frequency, duration = .2, type = 'sine', volume = .3, end = null) {
    if (!this.ctx || this.muted) return;
    const start = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .018);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(start); osc.stop(start + duration + .015);
  }

  noise(duration, volume = .2, filterFrequency = 1700) {
    if (!this.ctx || this.muted) return;
    const len = Math.max(1024, Math.round(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - .35 * (i / len));
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = filterFrequency;
    filter.Q.value = .45;
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + Math.min(.05, duration / 3));
    gain.gain.exponentialRampToValueAtTime(.001, t + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(t); source.stop(t + duration);
  }

  step(sprint) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStep < (sprint ? .26 : .42)) return;
    this.lastStep = now;
    this.noise(.105, sprint ? .08 : .048, 240);
    this.tone(64 + Math.random() * 15, .09, 'sine', .055, 35);
  }

  pickup() {
    this.tone(440, .15, 'sine', .14, 650);
    setTimeout(() => this.tone(680, .35, 'sine', .12, 900), 95);
  }

  battery() { this.tone(280, .18, 'triangle', .10, 460); }
  scareCue() {
    this.noise(.35, .25, 750);
    this.tone(58, .5, 'sawtooth', .17, 37);
    if (!this.muted) { this.nearbyOriginal.currentTime = 0; this.nearbyOriginal.play().catch(() => {}); }
  }
  switch() {
    if (!this.muted) { this.switchOriginal.currentTime = 0; this.switchOriginal.play().catch(() => {}); }
  }
  heartbeat() { this.tone(65, .12, 'sine', .23, 43); setTimeout(() => this.tone(58, .16, 'sine', .18, 38), 140); }

  async setScreamFile(file) {
    if (!file || !file.type.startsWith('audio/')) throw new Error('Elige un archivo de audio válido.');
    if (this.originalUrl) URL.revokeObjectURL(this.originalUrl);
    this.originalUrl = URL.createObjectURL(file);
    this.original = new Audio(this.originalUrl);
    this.original.preload = 'auto';
    this.original.volume = this.muted ? 0 : .88;
    await new Promise((resolve, reject) => {
      this.original.addEventListener('canplaythrough', resolve, { once: true });
      this.original.addEventListener('error', () => reject(new Error('No se pudo leer ese audio.')), { once: true });
      this.original.load();
    });
    return file.name;
  }

  scream() {
    if (this.original) {
      this.original.currentTime = 0;
      this.original.volume = this.muted ? 0 : .88;
      this.original.play().catch(() => this.fallbackScream());
    } else this.fallbackScream();
  }

  fallbackScream() {
    this.noise(1.55, .55, 1500);
    this.tone(265, 1.3, 'sawtooth', .32, 90);
    this.tone(440, 1.1, 'square', .17, 155);
    this.tone(690, .8, 'sawtooth', .12, 210);
    setTimeout(() => this.noise(.7, .32, 2900), 320);
  }

  setMuted(value) {
    this.muted = value;
    if (this.master) this.master.gain.setTargetAtTime(value ? .0001 : .72, this.ctx.currentTime, .04);
    if (this.original) this.original.volume = value ? 0 : .88;
    this.nearbyOriginal.volume = value ? 0 : .45;
    this.switchOriginal.volume = value ? 0 : .38;
  }
}
