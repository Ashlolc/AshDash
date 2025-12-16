(() => {
  const AshDash = (window.AshDash = window.AshDash || {});

  class StepSynth {
    constructor(){
      this.ac = null;
      this.master = null;
      this.running = false;
      this.timer = null;
      this.pattern = null;
      this.step = 0;
      this.nextTime = 0;
    }

    ensure(){
      if (this.ac) return;
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ac.destination);
    }

    async resumeIfNeeded(){
      if (!this.ac) return;
      if (this.ac.state === "suspended") {
        try { await this.ac.resume(); } catch {}
      }
    }

    setPattern(p){
      this.pattern = p || null;
      this.step = 0;
      if (this.ac) this.nextTime = this.ac.currentTime + 0.05;
    }

    start(){
      this.ensure();
      if (this.running) return;
      this.running = true;
      this.step = 0;
      this.nextTime = this.ac.currentTime + 0.05;
      this.timer = setInterval(() => this._schedule(), 25);
    }

    stop(){
      this.running = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }

    _kick(t){
      const o = this.ac.createOscillator();
      const g = this.ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.8, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.2);
    }

    _hat(t){
      const n = Math.floor(this.ac.sampleRate * 0.03);
      const b = this.ac.createBuffer(1, n, this.ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i=0;i<n;i++) d[i] = (Math.random()*2-1) * (1 - i/n);
      const src = this.ac.createBufferSource();
      src.buffer = b;

      const hp = this.ac.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 7000;

      const g = this.ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

      src.connect(hp); hp.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + 0.04);
    }

    _tone(t, freq, dur, type, amp){
      const o = this.ac.createOscillator();
      const g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    }

    _freqFromSemi(semi){
      return 220 * Math.pow(2, semi/12);
    }

    _schedule(){
      if (!this.running || !this.pattern || !this.ac) return;
      const bpm = Math.max(90, Math.min(180, Number(this.pattern.bpm || 128)));
      const spb = 60 / bpm;
      const lookahead = 0.12;
      const now = this.ac.currentTime;

      while (this.nextTime < now + lookahead) {
        const s = this.step % 16;

        if (s % 4 === 0) this._kick(this.nextTime);

        if (this.pattern.drums?.[s]) this._hat(this.nextTime + 0.02);

        if (this.pattern.bass?.[s]) {
          this._tone(this.nextTime, this._freqFromSemi(-12), 0.22, "sawtooth", 0.12);
        }

        const m = this.pattern.melody?.[s];
        if (m != null && m !== -999) {
          if (s % 2 === 0) this._tone(this.nextTime + 0.01, this._freqFromSemi(m), 0.16, "square", 0.10);
        }

        this.step++;
        this.nextTime += spb / 4;
      }
    }
  }

  AshDash.audio = { StepSynth };
})();