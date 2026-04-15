// Procedural audio — Web Audio API only, no samples.
(function(){
  const G = window.Game = window.Game || {};

  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuffer = null;

  let musicTimer = null;
  let musicStep = 0;
  let activeTrack = null;

  // Notes (Hz), E minor pentatonic-ish
  const N = {
    E2: 82.41, G2:98.0, A2:110.0, B2:123.47, D3:146.83,
    E3:164.81, G3:196.0, A3:220.0, B3:246.94, D4:293.66,
    E4:329.63, G4:392.0, A4:440.0, B4:493.88, D5:587.33, E5:659.25,
    C4:261.63, F4:349.23
  };

  function ensureCtx(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
    sfxGain   = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    // precompute a noise buffer
    const len = ctx.sampleRate * 1.0;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    return ctx;
  }

  function env(param, t, atk, sus, dec, peak, susLv){
    param.cancelScheduledValues(t);
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t+atk);
    param.linearRampToValueAtTime(susLv!=null?susLv:peak*.7, t+atk+0.02);
    param.linearRampToValueAtTime(0, t+atk+sus+dec);
  }

  function tone({freq, type='sine', dur=0.2, vol=0.3, bend=0, filterF=null, filterQ=1, out=null, at=0}){
    const c = ensureCtx();
    const t0 = c.currentTime + at;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if(bend) osc.frequency.exponentialRampToValueAtTime(Math.max(20,freq*bend), t0+dur);
    const g = c.createGain();
    env(g.gain, t0, 0.005, Math.max(0.01,dur-0.05), 0.05, vol, vol*.6);
    let last = g;
    if(filterF){
      const f = c.createBiquadFilter();
      f.type='lowpass'; f.frequency.value=filterF; f.Q.value=filterQ;
      g.connect(f); last = f;
    }
    last.connect(out || sfxGain);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0+dur+0.05);
  }

  function noise({dur=0.2, vol=0.3, filterF=1200, filterQ=1, highpass=false, bend=0, out=null, at=0}){
    const c = ensureCtx();
    const t0 = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const f = c.createBiquadFilter();
    f.type = highpass ? 'highpass' : 'lowpass';
    f.frequency.setValueAtTime(filterF, t0);
    if(bend) f.frequency.exponentialRampToValueAtTime(Math.max(80,filterF*bend), t0+dur);
    f.Q.value = filterQ;
    const g = c.createGain();
    env(g.gain, t0, 0.005, dur*0.5, dur*0.5, vol, vol*.4);
    src.connect(f); f.connect(g); g.connect(out || sfxGain);
    src.start(t0);
    src.stop(t0+dur+0.05);
  }

  // --- SFX library ---
  const SFX = {
    select(){ tone({freq:N.E5, type:'triangle', dur:0.08, vol:0.25, bend:1.2, filterF:4000}); },
    cursor(){ tone({freq:N.B4, type:'square',   dur:0.04, vol:0.12, filterF:3000}); },
    deny()  { tone({freq:N.E3, type:'sawtooth', dur:0.2,  vol:0.25, bend:0.6, filterF:800}); },
    move()  {
      noise({dur:0.28, vol:0.18, filterF:1400, bend:.5, filterQ:2});
      tone({freq:N.A3, type:'square', dur:0.15, vol:0.1, bend:.7, filterF:1400});
    },
    attack_light(){
      noise({dur:0.18, vol:0.35, filterF:2400, bend:.2});
      tone({freq:N.E4, type:'sawtooth', dur:0.12, vol:0.2, bend:.3, filterF:1800});
    },
    attack_heavy(){
      noise({dur:0.4, vol:0.45, filterF:800, bend:.2, filterQ:3});
      tone({freq:N.E2, type:'sawtooth', dur:0.35, vol:0.3, bend:.4, filterF:600});
      tone({freq:N.A2, type:'square',   dur:0.15, vol:0.15, bend:.5, filterF:1200, at:0.05});
    },
    explode(){
      noise({dur:0.55, vol:0.55, filterF:2000, bend:.15, filterQ:1});
      tone({freq:60, type:'sine', dur:0.5, vol:0.4, bend:.4});
    },
    capture(){
      const base = [N.E4,N.G4,N.B4,N.E5];
      base.forEach((f,i)=>tone({freq:f,type:'triangle',dur:0.12,vol:0.3,at:i*0.08,filterF:4000}));
    },
    build(){
      tone({freq:N.A3,type:'square',dur:0.1,vol:0.25,at:0.0});
      tone({freq:N.E4,type:'square',dur:0.12,vol:0.25,at:0.09});
      tone({freq:N.A4,type:'triangle',dur:0.16,vol:0.28,at:0.18,filterF:3500});
    },
    endturn(){
      tone({freq:N.G3, type:'sawtooth', dur:0.12, vol:0.2, bend:.8, filterF:1600});
      tone({freq:N.D4, type:'sawtooth', dur:0.12, vol:0.2, bend:.8, filterF:1600, at:0.09});
    },
    victory(){
      [N.E4,N.G4,N.B4,N.E5,N.B4,N.E5,N.E5].forEach((f,i)=>{
        tone({freq:f,type:'triangle',dur:0.18,vol:0.35,at:i*0.14,filterF:4500});
        tone({freq:f*2,type:'sine',dur:0.2,vol:0.12,at:i*0.14});
      });
    },
    defeat(){
      [N.E4,N.D4,N.B3,N.G3,N.E3].forEach((f,i)=>{
        tone({freq:f,type:'sawtooth',dur:0.3,vol:0.25,at:i*0.22,filterF:900});
      });
    }
  };

  function play(name){
    if(!SFX[name]) return;
    try { ensureCtx(); SFX[name](); } catch(e){ /* noop */ }
  }

  // --- Music tracks: compact step sequencer ---
  // Each track: { bpm, stepsPerBeat, length, onStep(step, time) }
  function beatDur(bpm, stepsPerBeat){
    return 60 / bpm / stepsPerBeat;
  }

  const bassRiff  = [N.E2,null,N.E2,null,  N.G2,null,null,null,  N.A2,null,N.A2,null,  N.B2,null,N.D3,null];
  const leadRiff  = [N.E4, N.G4, N.B4, N.D5,  N.E5, N.D5, N.B4, N.G4,  N.A4, N.G4, N.E4, N.D4,  N.B3, N.D4, N.E4, N.G4];
  const titleRiff = [N.E3, null, N.G3, null,  N.B3, null, N.A3, null,  N.E3, null, N.D4, null,  N.B3, null, N.G3, null];

  function trackTitle(step, tStep){
    // soft arpeggio + pad
    const sIdx = step % 16;
    const f = titleRiff[sIdx];
    if(f){
      tone({freq:f, type:'triangle', dur:tStep*1.5, vol:0.22, filterF:2400, out: musicGain});
      tone({freq:f*2, type:'sine',   dur:tStep*1.5, vol:0.08, out: musicGain});
    }
    // pad swell every 8 steps
    if(sIdx%8===0){
      tone({freq:N.E2, type:'sawtooth', dur:tStep*7, vol:0.07, filterF:600, out: musicGain});
      tone({freq:N.B2, type:'sawtooth', dur:tStep*7, vol:0.05, filterF:700, out: musicGain});
    }
    // hi-hat every other step
    if(sIdx%2===1){
      noise({dur:0.05, vol:0.05, filterF:6000, highpass:true, out: musicGain});
    }
  }

  function trackBattle(step, tStep){
    const sIdx = step % 16;
    // bass
    const bf = bassRiff[sIdx];
    if(bf){
      tone({freq:bf, type:'square', dur:tStep*1.5, vol:0.18, filterF:900, out: musicGain});
    }
    // lead
    const lf = leadRiff[sIdx];
    if(lf){
      tone({freq:lf, type:'sawtooth', dur:tStep*1.1, vol:0.12, filterF:2800, out: musicGain});
    }
    // kick on 0 and 8
    if(sIdx===0 || sIdx===8){
      tone({freq:55, type:'sine', dur:0.18, vol:0.45, bend:.35, out: musicGain});
    }
    // snare on 4 and 12
    if(sIdx===4 || sIdx===12){
      noise({dur:0.12, vol:0.25, filterF:1800, filterQ:2, out: musicGain});
      tone({freq:220, type:'triangle', dur:0.08, vol:0.12, out: musicGain});
    }
    // hats every step
    noise({dur:0.03, vol:0.04, filterF:6500, highpass:true, out: musicGain});
  }

  const TRACKS = {
    title:  { bpm:90,  stepsPerBeat:4, fn:trackTitle },
    battle: { bpm:110, stepsPerBeat:4, fn:trackBattle }
  };

  function startMusic(name){
    ensureCtx();
    if(activeTrack === name) return;
    stopMusic();
    const t = TRACKS[name];
    if(!t) return;
    activeTrack = name;
    musicStep = 0;
    const dur = beatDur(t.bpm, t.stepsPerBeat);
    const tick = () => {
      try { t.fn(musicStep, dur); } catch(e){}
      musicStep++;
    };
    // kick first step immediately so we don't feel latency
    tick();
    musicTimer = setInterval(tick, dur*1000);
  }

  function stopMusic(){
    if(musicTimer){ clearInterval(musicTimer); musicTimer=null; }
    activeTrack = null;
  }

  function toggleMute(){
    ensureCtx();
    master.gain.value = master.gain.value > 0.01 ? 0 : 0.8;
  }

  function setMusicVol(v){ ensureCtx(); musicGain.gain.value = v; }

  G.audio = { ensureCtx, play, startMusic, stopMusic, toggleMute, setMusicVol };
})();
