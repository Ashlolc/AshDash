(() => {
  const AshDash = (window.AshDash = window.AshDash || {});

  const TYPES = (AshDash.TYPES = {
    SOLID: "solid",
    SPIKE: "spike",
    PAD: "pad",
    ORB: "orb",
    PORTAL_MODE: "portal_mode",
    PORTAL_GRAV: "portal_grav",
    PORTAL_SPEED: "portal_speed",
    COIN: "coin",
    FINISH: "finish",
  });

  const MODES = (AshDash.MODES = {
    CUBE: "cube",
    BALL: "ball",
    UFO: "ufo",
    WAVE: "wave",
  });

  const DIFF = (AshDash.DIFF = {
    EASY:   { key:"easy",   label:"Easy" },
    NORMAL: { key:"normal", label:"Normal" },
    HARD:   { key:"hard",   label:"Hard" },
    INSANE: { key:"insane", label:"Insane" },
    DEMON:  { key:"demon",  label:"Demon" },
  });

  const WORLD = (AshDash.WORLD = {
    CEIL: 360,
    GROUND_THICK: 120,
  });

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function fix16(arr, fill){
    const out = Array.isArray(arr) ? arr.slice(0,16).map(n=>Number(n)) : [];
    while(out.length<16) out.push(fill);
    return out;
  }

  function normalizeLevel(level) {
    const L = JSON.parse(JSON.stringify(level || {}));
    if (!Array.isArray(L.objects)) L.objects = [];
    L.name = String(L.name || "Untitled");
    L.version = Number(L.version || 1);

    if (!L.difficulty) L.difficulty = { tier: DIFF.EASY.key, stars: 1 };
    if (!L.difficulty.tier) L.difficulty.tier = DIFF.EASY.key;
    L.difficulty.stars = clamp(Number(L.difficulty.stars || 1), 1, 10);

    if (!L.synth) {
      L.synth = {
        bpm: 128,
        melody: [0,2,4,7, 4,2,0,2, 0,2,4,7, 9,7,4,2],
        bass:   [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
        drums:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      };
    }
    L.synth.bpm = clamp(Number(L.synth.bpm || 128), 90, 180);
    L.synth.melody = fix16(L.synth.melody, -999);
    L.synth.bass   = fix16(L.synth.bass, 0).map(v => v ? 1 : 0);
    L.synth.drums  = fix16(L.synth.drums, 0).map(v => v ? 1 : 0);

    let id = 1;
    let coinsTotal = 0;
    let finishX = 2400;

    for (const o of L.objects) {
      if (o.id == null) o.id = id++;
      id = Math.max(id, o.id + 1);

      o.type = String(o.type || TYPES.SOLID);
      o.x = Number(o.x || 0);
      o.y = Number(o.y || 0);
      o.w = Number(o.w || 0);
      o.h = Number(o.h || 0);

      if (o.type === TYPES.SPIKE) o.flip = !!o.flip;
      if (o.type === TYPES.PAD || o.type === TYPES.ORB) o.strength = Number(o.strength || 1.15);
      if (o.type === TYPES.PORTAL_GRAV) o.down = !!o.down;
      if (o.type === TYPES.PORTAL_SPEED) o.mul = clamp(Number(o.mul || 1.0), 0.7, 1.6);
      if (o.type === TYPES.PORTAL_MODE) o.mode = String(o.mode || MODES.CUBE);

      if (o.type === TYPES.COIN) coinsTotal++;
      finishX = Math.max(finishX, o.x + o.w + 600);
    }

    // Auto-fix: old levels might use huge ground slab at y=0 (overlaps player y=0).
    for (const o of L.objects) {
      if (o.type === TYPES.SOLID && o.y === 0 && o.w >= 2500 && o.h >= 80) {
        o.y = -Math.abs(o.h);
      }
    }

    L.objects.sort((a, b) => a.x - b.x);

    L.coinsTotal = coinsTotal;
    L.finishX = finishX;

    if (!L.objects.some(o => o.type === TYPES.FINISH)) {
      L.objects.push({ id:id++, type:TYPES.FINISH, x:finishX-260, y:0, w:80, h:240 });
      L.objects.sort((a,b)=>a.x-b.x);
    }

    return L;
  }

  function safeParseLevel(text) {
    try {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== "object") return null;
      if (!Array.isArray(obj.objects)) return null;
      return normalizeLevel(obj);
    } catch {
      return null;
    }
  }

  // Deterministic RNG for generated levels
  function makeRng(seed){
    let s = (seed|0) || 1;
    return () => {
      s ^= s << 13; s ^= s >> 17; s ^= s << 5;
      return ((s>>>0) / 4294967296);
    };
  }
  function pick(r, arr){ return arr[(arr.length * r()) | 0]; }

  function starsText(n){
    const a = "★".repeat(Math.max(0, Math.min(10, n)));
    const b = "☆".repeat(Math.max(0, 10 - Math.min(10,n)));
    return a + b;
  }
  AshDash.starsText = starsText;

  function makeBuiltinLevels() {
    const { SOLID, SPIKE, PAD, ORB, PORTAL_MODE, PORTAL_GRAV, PORTAL_SPEED, COIN, FINISH } = TYPES;
    const { CEIL, GROUND_THICK } = WORLD;

    const mk = (name, synth, difficulty, builder) => {
      const L = { version: 1, name, difficulty, objects: [], synth };
      let id = 1;
      const add = (o) => { o.id = id++; L.objects.push(o); };

      // Base ground below y=0
      add({ type: SOLID, x: -400, y: -GROUND_THICK, w: 12000, h: GROUND_THICK });
      builder(add);
      return normalizeLevel(L);
    };

    const S1 = { bpm:124,
      melody:[0,2,4,7, 4,2,0,2, 0,2,4,7, 9,7,4,2],
      bass:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      drums:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    };
    const S2 = { bpm:132,
      melody:[0,4,7,11, 7,4,0,4, 0,2,4,7, 9,7,4,2],
      bass:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      drums:[1,1,1,1, 1,0,1,0, 1,1,1,1, 1,0,1,0],
    };
    const S3 = { bpm:140,
      melody:[0,2,5,9, 7,5,2,0, 0,2,5,9, 12,9,5,2],
      bass:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      drums:[1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1],
    };

    // Handcrafted starter set (easier 1st jump)
    const built = [
      mk("Neon Alley", S1, {tier:DIFF.EASY.key, stars:2}, (add) => {
        let x = 520;
        const spike = (n) => { for (let i=0;i<n;i++) add({type:SPIKE,x:x+i*52,y:0,w:44,h:44,flip:false}); x+=n*52; };
        const block = (w,h,y) => add({type:SOLID,x,y,w,h});
        const coin  = (cx,cy) => add({type:COIN,x:cx,y:cy,w:30,h:30});
        const pad   = (px,str=1.15) => add({type:PAD,x:px,y:0,w:56,h:18,strength:str});
        const speed = (px,m) => add({type:PORTAL_SPEED,x:px,y:0,w:64,h:220,mul:m});

        spike(1); x+=120;
        spike(2); x+=120;
        block(160,112, 0); coin(x-60, 170);
        spike(2); pad(x+30,1.12); x+=240;
        speed(x,1.05); x+=200;
        block(180,168, 0); coin(x+40, 260); x+=420;
        add({type:FINISH,x:x+420,y:0,w:80,h:240});
      }),

      mk("Pulse Reactor (Ball)", S2, {tier:DIFF.NORMAL.key, stars:4}, (add) => {
        let x = 420;
        const spike = (n) => { for (let i=0;i<n;i++) add({type:SPIKE,x:x+i*52,y:0,w:44,h:44,flip:false}); x+=n*52; };
        const cspike = (n) => { for (let i=0;i<n;i++) add({type:SPIKE,x:x+i*52,y:CEIL-44,w:44,h:44,flip:true}); x+=n*52; };
        const mode = (px,m)=>add({type:PORTAL_MODE,x:px,y:0,w:64,h:220,mode:m});
        const grav = (px,down)=>add({type:PORTAL_GRAV,x:px,y:0,w:64,h:220,down});
        const coin = (cx,cy)=>add({type:COIN,x:cx,y:cy,w:30,h:30});

        spike(2); x+=120;
        mode(x, "ball"); x+=220;
        grav(x, false); x+=220; // UP
        add({type:SOLID,x:x,y:CEIL,w:1100,h:60});
        cspike(2); coin(x+520, CEIL-90); x+=1100;
        grav(x, true); x+=220; // DOWN
        add({type:FINISH,x:x+420,y:0,w:80,h:240});
      }),

      mk("Sky Circuit (UFO)", S1, {tier:DIFF.NORMAL.key, stars:5}, (add) => {
        let x=420;
        const mode=(px,m)=>add({type:PORTAL_MODE,x:px,y:0,w:64,h:220,mode:m});
        const block=(px,py,w,h)=>add({type:SOLID,x:px,y:py,w,h});
        const spike=(px,py,flip=false)=>add({type:SPIKE,x:px,y:py,w:44,h:44,flip});
        const coin=(px,py)=>add({type:COIN,x:px,y:py,w:30,h:30});

        mode(x,"ufo"); x+=240;
        block(x,140,180,60); coin(x+70,230); x+=360;
        block(x,220,180,60); spike(x+240,0,false); x+=460;
        block(x,170,180,60); coin(x+90,300); x+=460;
        add({type:FINISH,x:x+420,y:0,w:80,h:240});
      }),

      mk("Laser Canyon (Wave)", S3, {tier:DIFF.HARD.key, stars:7}, (add) => {
        let x=420;
        const mode=(px,m)=>add({type:PORTAL_MODE,x:px,y:0,w:64,h:220,mode:m});
        const wall=(px,py,w,h)=>add({type:SOLID,x:px,y:py,w,h});
        const coin=(px,py)=>add({type:COIN,x:px,y:py,w:30,h:30});
        mode(x,"wave"); x+=240;
        wall(x, 40, 1200, 40);
        wall(x, 320, 1200, 40);
        wall(x+260, 80, 70, 220);
        wall(x+560, 160, 70, 180);
        wall(x+880, 80, 70, 220);
        coin(x+660, 260);
        add({type:FINISH,x:x+1500,y:0,w:80,h:240});
      }),

      mk("Hyper Prism (Mixed)", S3, {tier:DIFF.INSANE.key, stars:9}, (add) => {
        let x=420;
        const spike=(n)=>{ for(let i=0;i<n;i++) add({type:SPIKE,x:x+i*52,y:0,w:44,h:44,flip:false}); x+=n*52; };
        const mode=(px,m)=>add({type:PORTAL_MODE,x:px,y:0,w:64,h:220,mode:m});
        const speed=(px,m)=>add({type:PORTAL_SPEED,x:px,y:0,w:64,h:220,mul:m});
        const grav=(px,down)=>add({type:PORTAL_GRAV,x:px,y:0,w:64,h:220,down});
        const block=(px,py,w,h)=>add({type:SOLID,x:px,y:py,w,h});
        const coin=(px,py)=>add({type:COIN,x:px,y:py,w:30,h:30});

        spike(2); x+=140;
        speed(x,1.15); x+=220;
        block(x,0,200,60); coin(x+80,120); x+=420;

        mode(x,"ball"); x+=240;
        grav(x,false); x+=240;
        block(x,CEIL,900,60); coin(x+420,CEIL-90); x+=900;
        grav(x,true); x+=260;

        mode(x,"ufo"); x+=240;
        block(x,180,180,60); x+=360;

        mode(x,"wave"); x+=240;
        block(x,40,760,40); block(x,320,760,40);
        block(x+260,80,70,220);
        x+=980;

        mode(x,"cube"); x+=240;
        spike(4);
        add({type:FINISH,x:x+520,y:0,w:80,h:240});
      }),
    ];

    // Generated levels (25 more)
    function genCube(name, tier, stars, seed){
      const r = makeRng(seed);
      const synth = pick(r, [S1,S2,S3]);
      return mk(name, synth, {tier, stars}, (add) => {
        let x = 420;
        const spike = (n) => { for(let i=0;i<n;i++) add({type:SPIKE,x:x+i*52,y:0,w:44,h:44,flip:false}); x += n*52; };
        const block = (w,h,y=0)=>add({type:SOLID,x:x,y,w,h});
        const coin  = (cx,cy)=>add({type:COIN,x:cx,y:cy,w:30,h:30});
        const pad   = (px,str)=>add({type:PAD,x:px,y:0,w:56,h:18,strength:str});
        const orb   = (px,py,str)=>add({type:ORB,x:px,y:py,w:38,h:38,strength:str});
        const speed = (px,m)=>add({type:PORTAL_SPEED,x:px,y:0,w:64,h:220,mul:m});

        const segs = 10 + Math.floor(stars*1.2);
        const baseGap = 190 - stars*8;
        const maxCluster = 2 + Math.floor(stars/2);

        if (stars >= 6 && r() < 0.55) speed(x+120, 1.10 + (stars>=8?0.10:0));

        for(let s=0;s<segs;s++){
          x += baseGap + (r()*80|0);

          const cl = 1 + (r()*maxCluster|0);
          spike(cl);

          if (r() < 0.25 + stars*0.035){
            x += 110 + (r()*70|0);
            const h = (stars<=3)? 84 : (stars<=6? 112 : 168);
            block(140 + (r()*80|0), h, 0);
            if (r()<0.35) coin(x+30, h+70);
            x += 240;
          } else {
            x += 140 + (r()*80|0);
          }

          if (stars >= 4 && r() < 0.20){
            const px = x + 40;
            pad(px, 1.10 + r()*0.15);
          }
          if (stars >= 6 && r() < 0.18){
            orb(x + 120, 120 + (r()*120|0), 1.15 + r()*0.2);
          }
        }

        add({type:FINISH,x:x+520,y:0,w:80,h:240});
      });
    }

    function genUfo(name, tier, stars, seed){
      const r = makeRng(seed);
      const synth = pick(r, [S1,S2,S3]);
      return mk(name, synth, {tier, stars}, (add) => {
        let x=420;
        const mode=(px)=>add({type:PORTAL_MODE,x:px,y:0,w:64,h:220,mode:MODES.UFO});
        const block=(px,py,w,h)=>add({type:SOLID,x:px,y:py,w,h});
        const spike=(px,py,flip=false)=>add({type:SPIKE,x:px,y:py,w:44,h:44,flip});
        const coin=(px,py)=>add({type:COIN,x:px,y:py,w:30,h:30});
        mode(x); x+=260;

        const hops = 9 + Math.floor(stars*1.3);
        let y = 160;
        for(let i=0;i<hops;i++){
          y += ((r()*2-1) * (40 + stars*6));
          y = clamp(y, 80, 260);
          const w = 160 + (r()*120|0);
          block(x, y, w, 60);
          if (r()<0.30) coin(x + (w*0.5|0), y+92);
          if (r()<0.35 + stars*0.03) spike(x + w + 40, 0, false);
          x += w + 220 - stars*8;
        }

        add({type:FINISH,x:x+420,y:0,w:80,h:240});
      });
    }

    function genBall(name, tier, stars, seed){
      const r = makeRng(seed);
      const synth = pick(r, [S1,S2,S3]);
      return mk(name, synth, {tier, stars}, (add) => {
        let x=420;
        const mode=(px)=>add({type:PORTAL_MODE,x:px,y:0,w:64,h:220,mode:MODES.BALL});
        const grav=(px,down)=>add({type:PORTAL_GRAV,x:px,y:0,w:64,h:220,down});
        const spike=(px,py,flip=false)=>add({type:SPIKE,x:px,y:py,w:44,h:44,flip});
        const block=(px,py,w,h)=>add({type:SOLID,x:px,y:py,w,h});
        const coin=(px,py)=>add({type:COIN,x:px,y:py,w:30,h:30});

        mode(x); x+=260;

        const flips = 10 + Math.floor(stars*1.2);
        let down = true;
        for(let i=0;i<flips;i++){
          const run = 520 + (r()*240|0) - stars*18;
          if (!down){
            block(x, CEIL, run, 60);
            if (r()<0.35) coin(x + (run*0.6|0), CEIL-90);
            if (r()<0.45) spike(x + 200, CEIL-44, true);
          } else {
            if (r()<0.40) spike(x + 200, 0, false);
            if (r()<0.25) coin(x + (run*0.5|0), 140);
          }
          x += run;
          down = !down;
          grav(x, down); x+=260;
        }

        add({type:FINISH,x:x+420,y:0,w:80,h:240});
      });
    }

    function genWave(name, tier, stars, seed){
      const r = makeRng(seed);
      const synth = pick(r, [S2,S3]);
      return mk(name, synth, {tier, stars}, (add) => {
        let x=420;
        const mode=(px)=>add({type:PORTAL_MODE,x:px,y:0,w:64,h:220,mode:MODES.WAVE});
        const wall=(px,py,w,h)=>add({type:SOLID,x:px,y:py,w,h});
        const coin=(px,py)=>add({type:COIN,x:px,y:py,w:30,h:30});
        mode(x); x+=260;

        const len = 1500 + stars*260;
        const topY = 320;
        const botY = 40;
        wall(x, botY, len, 40);
        wall(x, topY, len, 40);

        const pillars = 4 + Math.floor(stars*0.8);
        for(let i=0;i<pillars;i++){
          const px = x + 240 + i*(len/(pillars+1));
          const gap = 120 - stars*6 + (r()*30|0);
          const mid = 180 + (r()*60|0);
          wall(px, botY+40, 70, mid-gap);
          wall(px, mid+gap, 70, topY-(mid+gap));
          if (r()<0.35) coin(px+90, mid);
        }

        add({type:FINISH,x:x+len+420,y:0,w:80,h:240});
      });
    }

    // Add 25 generated (variety)
    let seed = 9001;
    function pushMany(fn, count, tier, baseStars, prefix){
      for(let i=0;i<count;i++){
        const stars = clamp(baseStars + i%2, 1, 10);
        built.push(fn(`${prefix} ${i+1}`, tier, stars, seed++));
      }
    }

    // We already have 5. Add 25 more:
    pushMany(genCube, 7, DIFF.EASY.key,   2, "Streetlights");     // 7
    pushMany(genCube, 6, DIFF.NORMAL.key, 4, "Voltage");         // 6
    built.push(genBall("Polarity Shift", DIFF.NORMAL.key, 5, seed++)); // 1
    built.push(genUfo("Cloud Hopper", DIFF.NORMAL.key, 5, seed++));   // 1
    pushMany(genCube, 6, DIFF.HARD.key,   7, "Neon Gauntlet");    // 6
    built.push(genWave("Glass Tunnel", DIFF.HARD.key, 8, seed++));    // 1
    pushMany(genCube, 3, DIFF.INSANE.key, 9, "Overdrive");        // 3
    built.push(genWave("Prism Serpent", DIFF.INSANE.key, 9, seed++)); // 1
    built.push(genCube("Demon Draft", DIFF.DEMON.key, 10, seed++));   // 1

    return built.map(normalizeLevel);
  }

  AshDash.levels = { normalizeLevel, safeParseLevel, makeBuiltinLevels };
})();