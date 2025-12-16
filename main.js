(() => {
  const AshDash = (window.AshDash = window.AshDash || {});
  const { TYPES, MODES, WORLD, DIFF } = AshDash;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const menuEl = document.getElementById("menu");
  const editorEl = document.getElementById("editor");

  const hudSubtitle = document.getElementById("hudSubtitle");
  const progressFill = document.getElementById("progressFill");
  const modeText = document.getElementById("modeText");
  const coinText = document.getElementById("coinText");
  const deathText = document.getElementById("deathText");
  const unlockPill = document.getElementById("unlockPill");

  const btnStart = document.getElementById("btnStart");
  const btnMenu = document.getElementById("btnMenu");
  const btnPause = document.getElementById("btnPause");
  const btnRestart = document.getElementById("btnRestart");
  const btnEditor = document.getElementById("btnEditor");
  const btnReset = document.getElementById("btnReset");
  const btnImport = document.getElementById("btnImport");
  const btnImport2 = document.getElementById("btnImport2");
  const fileInput = document.getElementById("fileInput");

  const speedSlider = document.getElementById("speedSlider");
  const speedLabel = document.getElementById("speedLabel");
  const togSound = document.getElementById("togSound");
  const togParticles = document.getElementById("togParticles");
  const cubeSkin = document.getElementById("cubeSkin");
  const CUBE_SKIN_KEY = "ashdash_cube_skin_v1";
  let cubeSkinMode = localStorage.getItem(CUBE_SKIN_KEY) || "neon";
  if (cubeSkin){
    cubeSkin.value = cubeSkinMode;
    cubeSkin.addEventListener("change", () => {
      cubeSkinMode = cubeSkin.value || "neon";
      localStorage.setItem(CUBE_SKIN_KEY, cubeSkinMode);
    });
  }

  const btnToolSelect = document.getElementById("btnToolSelect");
  const btnToolPan = document.getElementById("btnToolPan");
  const btnToolDelete = document.getElementById("btnToolDelete");
  const btnSnap = document.getElementById("btnSnap");
  const btnZoomIn = document.getElementById("btnZoomIn");
  const btnZoomOut = document.getElementById("btnZoomOut");
  const btnTestPlay = document.getElementById("btnTestPlay");
  const btnExport = document.getElementById("btnExport");
  const btnEditorBack = document.getElementById("btnEditorBack");
  const btnPreview = document.getElementById("btnPreview");
  const btnStopPreview = document.getElementById("btnStopPreview");

  const mobileControls = document.getElementById("mobileControls");
  const btnMobileJump = document.getElementById("btnMobileJump");
  const btnMobilePause = document.getElementById("btnMobilePause");
  const pointerCoarse = matchMedia && matchMedia("(pointer: coarse)").matches;

  // Device chooser (shown on first open)
  const devicePick = document.getElementById("devicePick");
  const btnDeviceDesktop = document.getElementById("btnDeviceDesktop");
  const btnDeviceMobile = document.getElementById("btnDeviceMobile");
  const btnDeviceAuto = document.getElementById("btnDeviceAuto");
  const DEVICE_KEY = "ashdash_device_v1";
  let deviceMode = localStorage.getItem(DEVICE_KEY) || "";

  function isMobileMode(){
    if (deviceMode === "mobile") return true;
    if (deviceMode === "desktop") return false;
    return !!pointerCoarse;
  }

  function applyDevice(mode){
    deviceMode = mode;
    localStorage.setItem(DEVICE_KEY, deviceMode);
    if (devicePick) devicePick.classList.add("hidden");
    document.body.classList.toggle("mobile-mode", isMobileMode());
    if (!isMobileMode()) mobileControls.classList.add("hidden");
  }

  function showDevicePickIfNeeded(){
    document.body.classList.toggle("mobile-mode", isMobileMode());
    if (!devicePick) return;
    if (!localStorage.getItem(DEVICE_KEY)) devicePick.classList.remove("hidden");
  }

  btnDeviceDesktop?.addEventListener("click", () => applyDevice("desktop"));
  btnDeviceMobile?.addEventListener("click", () => applyDevice("mobile"));
  btnDeviceAuto?.addEventListener("click", () => applyDevice(pointerCoarse ? "mobile" : "desktop"));

  const diffTabsEl = document.getElementById("diffTabs");

  const synth = new AshDash.audio.StepSynth();

  const SAVE_KEY = "ashdash_save_v2";
  const CUSTOM_KEY = "ashdash_custom_v2";
  const TIER_KEY = "ashdash_tier_v1";
  const save = loadSave();

  let built = AshDash.levels.makeBuiltinLevels();
  let custom = loadCustomLevels();

  const TIERS = [
    { key: DIFF.EASY.key,   label: DIFF.EASY.label },
    { key: DIFF.NORMAL.key, label: DIFF.NORMAL.label },
    { key: DIFF.HARD.key,   label: DIFF.HARD.label },
    { key: DIFF.INSANE.key, label: DIFF.INSANE.label },
    { key: DIFF.DEMON.key,  label: DIFF.DEMON.label },
    { key: "custom", label: "Custom" },
  ];

  let activeTier = localStorage.getItem(TIER_KEY) || DIFF.EASY.key;

  const STATE = { MENU:0, PLAY:1, PAUSE:2, EDIT:3 };
  let state = STATE.MENU;

  let selected = { kind: "built", idx: 0 };
  let level = built[0];

  let camX = 0;
  let time = 0;
  let deaths = 0;
  let coins = 0;
  const collected = new Set();
  const touched = new Set();

  const input = { down:false, pressed:false, released:false };

  const player = {
    x: 160, y: 0,
    w: 42, h: 42,
    vy: 0,
    gravDown: true,
    grounded: true,
    mode: MODES.CUBE,
    speedBase: 220,
    speedMul: 1,
    lastTapT: -999,
    jumpBuffer: 0,
    coyote: 0,
  };

  const particles = [];

  let dpr = 1, cw=0, ch=0, groundYpx=0;

  function resize(){
    dpr = Math.max(1, Math.min(2.25, window.devicePixelRatio || 1));
    cw = Math.floor(innerWidth * dpr);
    ch = Math.floor(innerHeight * dpr);
    canvas.width = cw;
    canvas.height = ch;
    groundYpx = Math.floor((ch / dpr) * 0.78);
  }
  addEventListener("resize", resize, {passive:true});
  resize();

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp  = (a,b,t)=>a+(b-a)*t;

  function rectOverlap(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  function playerRect(){
    return { x:player.x, y:player.y, w:player.w, h:player.h };
  }

  function setMode(m){
    player.mode = m;
    if (m === MODES.WAVE){ player.w=30; player.h=30; }
    else if (m === MODES.BALL){ player.w=40; player.h=40; }
    else if (m === MODES.UFO){ player.w=42; player.h=34; }
    else { player.w=42; player.h=42; }
    modeText.textContent = m.toUpperCase();
  }

  function toast(msg){
    const t = document.getElementById("toast");
    if (t) t.textContent = msg;
  }

  function spawnParticle(x,y,vx,vy,life,size){
    particles.push({x,y,vx,vy,life,ttl:life,size});
  }
  function burst(x,y){
    if (!togParticles.checked) return;
    for(let i=0;i<18;i++){
      const a = Math.random()*Math.PI*2;
      const s = 220 + Math.random()*220;
      spawnParticle(x,y,Math.cos(a)*s,Math.sin(a)*s,0.55+Math.random()*0.4,2+Math.random()*4);
    }
  }

  function die(){
    deaths++;
    deathText.textContent = String(deaths);
    burst(player.x + player.w*0.5, player.y + player.h*0.5);

    player.x = 160;
    player.y = 0;
    player.vy = 0;
    player.gravDown = true;
    player.grounded = true;
    player.speedMul = 1;
    player.jumpBuffer = 0;
    player.coyote = 0;
    setMode(MODES.CUBE);

    camX = 0;
    time = 0;
    coins = 0;
    collected.clear();
    touched.clear();
  }

  function win(){
    if (selected.kind === "built"){
      if (save.unlocked < built.length && (selected.idx + 1) >= save.unlocked){
        save.unlocked = Math.min(built.length, save.unlocked + 1);
      }
      writeSave();
    }
    showMenu();
  }

  function spikeHit(o){
    const pr = playerRect();
    if (!rectOverlap(pr, o)) return false;

    const ax = o.x, bx = o.x + o.w, cx = o.x + o.w/2;
    if (!o.flip){
      return pointInTri(pr, ax, o.y, bx, o.y, cx, o.y + o.h);
    } else {
      return pointInTri(pr, ax, o.y + o.h, bx, o.y + o.h, cx, o.y);
    }
  }

  function pointInTri(rect, ax,ay, bx,by, cx,cy){
    const pts = [
      [rect.x, rect.y],
      [rect.x+rect.w, rect.y],
      [rect.x, rect.y+rect.h],
      [rect.x+rect.w, rect.y+rect.h],
    ];
    for (const [px,py] of pts){
      if (bary(px,py, ax,ay,bx,by,cx,cy)) return true;
    }
    return false;
  }
  function bary(px,py, ax,ay,bx,by,cx,cy){
    const v0x = cx-ax, v0y = cy-ay;
    const v1x = bx-ax, v1y = by-ay;
    const v2x = px-ax, v2y = py-ay;
    const dot00 = v0x*v0x+v0y*v0y;
    const dot01 = v0x*v1x+v0y*v1y;
    const dot02 = v0x*v2x+v0y*v2y;
    const dot11 = v1x*v1x+v1y*v1y;
    const dot12 = v1x*v2x+v1y*v2y;
    const inv = 1 / (dot00*dot11 - dot01*dot01 + 1e-9);
    const u = (dot11*dot02 - dot01*dot12) * inv;
    const v = (dot00*dot12 - dot01*dot02) * inv;
    return u>=0 && v>=0 && u+v<=1;
  }

  function applyJump(str=1.0){
    const J = 860 * str; // lower jump height
    player.vy = player.gravDown ? J : -J;
    player.grounded = false;
  }

  function scanNear(xMin, xMax){
    const out = [];
    for (const o of level.objects){
      if (o.x > xMax) break;
      if (o.x + o.w < xMin) continue;
      out.push(o);
    }
    return out;
  }

  function step(dt){
    if (state !== STATE.PLAY) return;
    time += dt;

    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

    let speed = player.speedBase * player.speedMul;

    // Slight extra forward travel while the cube is airborne
    if (player.mode === MODES.CUBE && !player.grounded) speed *= 1.03;
    player.x += speed * dt;

    camX = lerp(camX, player.x - 220, 1 - Math.pow(0.0001, dt));
    camX = Math.max(0, camX);

    if (player.mode === MODES.WAVE){
      const waveV = 520;
      const dir = (input.down ? 1 : -1) * (player.gravDown ? 1 : -1);
      player.vy = dir * waveV;
      player.y += player.vy * dt;
      if (player.y < 0 || player.y + player.h > WORLD.CEIL) die();
    } else {
      const g = 2400;
      const grav = player.gravDown ? -g : g;
      player.vy += grav * dt;
      player.y += player.vy * dt;

      if (player.gravDown){
        if (player.y < 0){
          player.y = 0;
          player.vy = 0;
          player.grounded = true;
        } else player.grounded = false;

        if (player.y + player.h > WORLD.CEIL + 160) die();
      } else {
        const ceilY = WORLD.CEIL - player.h;
        if (player.y > ceilY){
          player.y = ceilY;
          player.vy = 0;
          player.grounded = true;
        } else player.grounded = false;

        if (player.y < -160) die();
      }

      if (player.grounded) player.coyote = 0.10;
      else player.coyote = Math.max(0, player.coyote - dt);

      if (player.mode === MODES.CUBE){
        if (player.jumpBuffer > 0 && player.coyote > 0){
          applyJump(1.0);
          player.jumpBuffer = 0;
          player.coyote = 0;
        }
      } else if (input.pressed){
        const now = time;
        if (player.mode === MODES.UFO){
          if (now - player.lastTapT > 0.05){
            player.lastTapT = now;
            player.vy = player.gravDown ? 900 : -900;
          }
        } else if (player.mode === MODES.BALL){
          if (now - player.lastTapT > 0.07){
            player.lastTapT = now;
            player.gravDown = !player.gravDown;
            player.vy = player.gravDown ? 420 : -420;
          }
        }
      }
    }

    const near = scanNear(player.x - 80, player.x + 700);

    for (const o of near){
      const pr = playerRect();
      if (!rectOverlap(pr, o)) continue;

      if (o.type === TYPES.PORTAL_SPEED && !touched.has(o.id)){
        touched.add(o.id);
        player.speedMul = clamp(o.mul || 1.0, 0.7, 1.6);
      }
      if (o.type === TYPES.PORTAL_GRAV && !touched.has(o.id)){
        touched.add(o.id);
        player.gravDown = !!o.down;
        player.vy *= 0.6;
      }
      if (o.type === TYPES.PORTAL_MODE && !touched.has(o.id)){
        touched.add(o.id);
        setMode(o.mode || MODES.CUBE);
      }

      if (o.type === TYPES.PAD && !touched.has(o.id) && player.mode !== MODES.WAVE){
        touched.add(o.id);
        applyJump(o.strength || 1.15);
      }

      if (o.type === TYPES.ORB && player.mode !== MODES.WAVE){
        if (input.pressed && !touched.has(o.id)){
          touched.add(o.id);
          applyJump(o.strength || 1.2);
        }
      }

      if (o.type === TYPES.COIN && !collected.has(o.id)){
        collected.add(o.id);
        coins++;
        coinText.textContent = `${coins}/${level.coinsTotal}`;
        burst(o.x+o.w/2, o.y+o.h/2);
      }

      if (o.type === TYPES.FINISH){
        win(); return;
      }
    }

    for (const o of near){
      if (o.type === TYPES.SPIKE){
        if (spikeHit(o)) { die(); return; }
      }
    }

    for (const o of near){
      if (o.type !== TYPES.SOLID) continue;
      const pr = playerRect();
      if (!rectOverlap(pr, o)) continue;

      if (player.mode === MODES.WAVE){
        die(); return;
      }

      if (player.gravDown){
        const top = o.y + o.h;
        const prev = pr.y - player.vy * dt;
        if (player.vy < 0 && prev >= top - 2 && pr.y < top){
          player.y = top;
          player.vy = 0;
          player.grounded = true;
        } else {
          die(); return;
        }
      } else {
        const bottom = o.y;
        const prevTop = (pr.y - player.vy * dt) + pr.h;
        const curTop = pr.y + pr.h;
        if (player.vy > 0 && prevTop <= bottom + 2 && curTop > bottom){
          player.y = bottom - player.h;
          player.vy = 0;
          player.grounded = true;
        } else {
          die(); return;
        }
      }
    }

    if (togParticles.checked && Math.random() < 0.6){
      spawnParticle(
        player.x + Math.random()*player.w,
        player.y + Math.random()*player.h,
        -80 - Math.random()*220,
        (Math.random()*2-1)*80,
        0.25+Math.random()*0.2,
        2+Math.random()*2
      );
    }
  }

  function stepParticles(dt){
    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0){ particles.splice(i,1); continue; }
      p.vx *= Math.pow(0.06, dt);
      p.vy *= Math.pow(0.06, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function worldToScreenX(wx, cam, zoom){
    return (wx - cam) * zoom * dpr;
  }
  function worldToScreenY(wy, zoom){
    return (groundYpx - wy * zoom) * dpr;
  }

  function drawBackground(){
    ctx.fillStyle = "#050512";
    ctx.fillRect(0,0,cw,ch);

    const cx = cw*0.55 + Math.sin(time*0.5)*cw*0.06;
    const cy = ch*0.40 + Math.cos(time*0.45)*ch*0.05;
    const rr = Math.max(cw,ch)*0.65;
    const g = ctx.createRadialGradient(cx,cy,rr*0.10,cx,cy,rr);
    g.addColorStop(0, "rgba(124,255,222,0.10)");
    g.addColorStop(0.55, "rgba(255,91,214,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,cw,ch);

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    const gy = groundYpx*dpr;
    ctx.fillRect(0, gy, cw, ch-gy);
  }

  function roundRect(c, x,y,w,h,r){
    r = Math.min(r, w/2, h/2);
    c.beginPath();
    c.moveTo(x+r,y);
    c.arcTo(x+w,y,x+w,y+h,r);
    c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r);
    c.arcTo(x,y,x+w,y,r);
    c.closePath();
  }

  function drawWorld(viewCamX, viewZoom){
    const zoom = viewZoom || 1;
    const cam = viewCamX || camX;

    const wWorld = (cw/dpr) / zoom;
    const xMin = cam - 120/zoom;
    const xMax = cam + wWorld + 600/zoom;

    const objs = [];
    for (const o of level.objects){
      if (o.x > xMax) break;
      if (o.x + o.w < xMin) continue;
      objs.push(o);
    }

    for (const o of objs){
      const sx = worldToScreenX(o.x, cam, zoom);
      const sy = worldToScreenY(o.y + o.h, zoom);
      const sw = o.w * zoom * dpr;
      const sh = o.h * zoom * dpr;

      if (o.type === TYPES.SOLID){
        const grad = ctx.createLinearGradient(sx, sy, sx, sy+sh);
        grad.addColorStop(0, "rgba(255,255,255,0.12)");
        grad.addColorStop(1, "rgba(0,0,0,0.14)");
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = "rgba(124,255,222,0.35)";
        ctx.lineWidth = 2*dpr;
        ctx.strokeRect(sx+1*dpr, sy+1*dpr, sw-2*dpr, sh-2*dpr);
      }

      if (o.type === TYPES.SPIKE){
        ctx.save();
        ctx.strokeStyle = o.flip ? "rgba(255,91,214,0.95)" : "rgba(124,255,222,0.95)";
        ctx.lineWidth = 2*dpr;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        if (!o.flip){
          ctx.moveTo(sx, sy+sh);
          ctx.lineTo(sx+sw, sy+sh);
          ctx.lineTo(sx+sw/2, sy);
        } else {
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx+sw, sy);
          ctx.lineTo(sx+sw/2, sy+sh);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      if (o.type === TYPES.PAD){
        ctx.fillStyle = "rgba(255,209,102,0.15)";
        ctx.strokeStyle = "rgba(255,209,102,0.95)";
        ctx.lineWidth = 2*dpr;
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeRect(sx+1*dpr, sy+1*dpr, sw-2*dpr, sh-2*dpr);
      }

      if (o.type === TYPES.ORB){
        const cx0 = sx+sw/2, cy0 = sy+sh/2;
        ctx.fillStyle = "rgba(124,255,222,0.18)";
        ctx.strokeStyle = "rgba(124,255,222,0.95)";
        ctx.lineWidth = 2*dpr;
        ctx.beginPath(); ctx.arc(cx0,cy0,Math.min(sw,sh)*0.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
      }

      if (o.type === TYPES.PORTAL_MODE || o.type === TYPES.PORTAL_GRAV || o.type === TYPES.PORTAL_SPEED){
        let color = "rgba(255,209,102,0.95)";
        let label = "?";
        if (o.type === TYPES.PORTAL_MODE){ color="rgba(255,209,102,0.95)"; label=(o.mode||"cube").toUpperCase(); }
        if (o.type === TYPES.PORTAL_GRAV){ color=o.down?"rgba(124,255,222,0.95)":"rgba(255,91,214,0.95)"; label=o.down?"DOWN":"UP"; }
        if (o.type === TYPES.PORTAL_SPEED){ color="rgba(110,245,122,0.95)"; label=`x${(o.mul||1).toFixed(2)}`; }

        ctx.strokeStyle = color;
        ctx.lineWidth = 3*dpr;
        ctx.globalAlpha = 0.85;
        roundRect(ctx, sx, sy, sw, sh, 14*dpr);
        ctx.stroke();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = color;
        roundRect(ctx, sx, sy, sw, sh, 14*dpr);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = `${16*dpr}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(label, sx+sw/2, sy+sh/2);
        ctx.globalAlpha = 1;
      }

      if (o.type === TYPES.COIN && !collected.has(o.id)){
        const cx0 = sx+sw/2, cy0 = sy+sh/2;
        ctx.strokeStyle = "rgba(255,209,102,0.95)";
        ctx.lineWidth = 2*dpr;
        ctx.fillStyle = "rgba(255,209,102,0.12)";
        ctx.beginPath(); ctx.ellipse(cx0,cy0,sw*0.45,sh*0.55,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      }

      if (o.type === TYPES.FINISH){
        ctx.strokeStyle = "rgba(233,240,255,0.75)";
        ctx.lineWidth = 4*dpr;
        ctx.beginPath();
        ctx.moveTo(sx+sw*0.35, sy+sh);
        ctx.lineTo(sx+sw*0.35, sy);
        ctx.stroke();

        ctx.fillStyle = "rgba(124,255,222,0.35)";
        ctx.strokeStyle = "rgba(124,255,222,0.95)";
        ctx.lineWidth = 2*dpr;
        ctx.beginPath();
        ctx.moveTo(sx+sw*0.35, sy+14*dpr);
        ctx.lineTo(sx+sw*0.90, sy+22*dpr);
        ctx.lineTo(sx+sw*0.35, sy+46*dpr);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    }
  }

  function drawPlayer(viewCamX, viewZoom){
    const zoom = viewZoom || 1;
    const cam = viewCamX || camX;

    const sx = worldToScreenX(player.x, cam, zoom);
    const sy = worldToScreenY(player.y + player.h, zoom);
    const sw = player.w * zoom * dpr;
    const sh = player.h * zoom * dpr;

    ctx.save();
    ctx.translate(sx + sw/2, sy + sh/2);
    const rot = (player.mode === MODES.WAVE) ? (input.down ? 0.35 : -0.35) : (player.x * 0.02 * (player.gravDown?1:-1));
    ctx.rotate(rot);

    const grad = ctx.createLinearGradient(-sw/2,-sh/2,sw/2,sh/2);
    grad.addColorStop(0, "rgba(124,255,222,0.95)");
    grad.addColorStop(1, "rgba(255,91,214,0.95)");
    ctx.fillStyle = grad;

    if (player.mode === MODES.BALL){
      ctx.beginPath(); ctx.arc(0,0,Math.min(sw,sh)*0.52,0,Math.PI*2); ctx.fill();
    } else if (player.mode === MODES.UFO){
      roundRect(ctx, -sw/2, -sh/2, sw, sh, 12*dpr);
      ctx.fill();
    } else if (player.mode === MODES.WAVE){
      ctx.beginPath();
      ctx.moveTo(-sw/2, 0);
      ctx.lineTo(0, -sh/2);
      ctx.lineTo(sw/2, 0);
      ctx.lineTo(0, sh/2);
      ctx.closePath();
      ctx.fill();
        } else {
      // CUBE skins
      const skin = (typeof cubeSkinMode === "string") ? cubeSkinMode : "neon";

      if (skin === "hollow") {
        ctx.fillStyle = "rgba(0,0,0,0)";
        ctx.strokeStyle = "rgba(233,240,255,0.9)";
        ctx.lineWidth = 3*dpr;
        ctx.strokeRect(-sw/2, -sh/2, sw, sh);

        // corner glow
        ctx.strokeStyle = "rgba(124,255,222,0.75)";
        ctx.lineWidth = 2*dpr;
        ctx.strokeRect(-sw/2 + 4*dpr, -sh/2 + 4*dpr, sw - 8*dpr, sh - 8*dpr);

      } else if (skin === "glass") {
        // glassy cube
        const g2 = ctx.createLinearGradient(-sw/2, -sh/2, sw/2, sh/2);
        g2.addColorStop(0, "rgba(255,255,255,0.22)");
        g2.addColorStop(1, "rgba(255,255,255,0.06)");
        ctx.fillStyle = g2;
        roundRect(ctx, -sw/2, -sh/2, sw, sh, 12*dpr);
        ctx.fill();

        ctx.strokeStyle = "rgba(124,255,222,0.7)";
        ctx.lineWidth = 3*dpr;
        roundRect(ctx, -sw/2, -sh/2, sw, sh, 12*dpr);
        ctx.stroke();

        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "rgba(255,91,214,0.9)";
        roundRect(ctx, -sw/2 + 6*dpr, -sh/2 + 6*dpr, sw*0.55, sh*0.25, 10*dpr);
        ctx.fill();
        ctx.globalAlpha = 1;

      } else if (skin === "pixel") {
        // pixel grid cube
        ctx.fillStyle = grad;
        ctx.fillRect(-sw/2, -sh/2, sw, sh);

        ctx.globalAlpha = 0.35;
        const cells = 6;
        const px = sw / cells;
        const py = sh / cells;
        for (let iy=0; iy<cells; iy++){
          for (let ix=0; ix<cells; ix++){
            if ((ix+iy) % 2 === 0) {
              ctx.fillStyle = "rgba(255,255,255,0.10)";
              ctx.fillRect(-sw/2 + ix*px, -sh/2 + iy*py, px, py);
            }
          }
        }
        ctx.globalAlpha = 1;

        ctx.strokeStyle = "rgba(233,240,255,0.65)";
        ctx.lineWidth = 2*dpr;
        ctx.strokeRect(-sw/2, -sh/2, sw, sh);

      } else if (skin === "star") {
        // star inside cube frame
        ctx.fillStyle = "rgba(0,0,0,0)";
        ctx.strokeStyle = "rgba(233,240,255,0.75)";
        ctx.lineWidth = 2*dpr;
        ctx.strokeRect(-sw/2, -sh/2, sw, sh);

        // star
        const R = Math.min(sw, sh) * 0.46;
        const r = R * 0.42;
        ctx.fillStyle = grad;
        ctx.beginPath();
        for (let i=0;i<10;i++){
          const ang = (Math.PI/2) + i*(Math.PI/5);
          const rad = (i%2===0)?R:r;
          const x = Math.cos(ang)*rad;
          const y = -Math.sin(ang)*rad;
          if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.closePath();
        ctx.fill();

      } else {
        // neon (default)
        ctx.fillStyle = grad;
        ctx.fillRect(-sw/2, -sh/2, sw, sh);

        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "rgba(255,255,255,0.20)";
        ctx.fillRect(-sw/2 + 5*dpr, -sh/2 + 5*dpr, sw*0.40, sh*0.18);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = "rgba(233,240,255,0.55)";
        ctx.lineWidth = 2*dpr;
        ctx.strokeRect(-sw/2, -sh/2, sw, sh);
      }
    }

    ctx.restore();
  }

  function drawParticles(viewCamX, viewZoom){
    if (!togParticles.checked) return;
    const zoom = viewZoom || 1;
    const cam = viewCamX || camX;

    for (const p of particles){
      const a = clamp(p.life/p.ttl, 0, 1);
      ctx.globalAlpha = a * 0.45;
      ctx.fillStyle = "rgba(124,255,222,0.9)";
      const sx = worldToScreenX(p.x, cam, zoom);
      const sy = worldToScreenY(p.y, zoom);
      const s = p.size * zoom * dpr;
      ctx.fillRect(sx, sy, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawEditorOverlay(E){
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "rgba(124,255,222,0.7)";
    ctx.lineWidth = 1*dpr;

    const grid = 28;
    const step = grid * E.zoom * dpr;
    const offset = -((E.camX % grid) * E.zoom * dpr);

    for (let x = offset; x < cw; x += step){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,ch); ctx.stroke();
    }
    ctx.restore();

    if (E.selectedId != null){
      const o = E.level.objects.find(o=>o.id===E.selectedId);
      if (o){
        const sx = worldToScreenX(o.x, E.camX, E.zoom);
        const sy = worldToScreenY(o.y + o.h, E.zoom);
        ctx.save();
        ctx.strokeStyle = "rgba(255,209,102,0.95)";
        ctx.lineWidth = 3*dpr;
        ctx.strokeRect(sx, sy, o.w*E.zoom*dpr, o.h*E.zoom*dpr);
        ctx.restore();
      }
    }
  
    // Placement preview
    if (E.tool === "place" && E._placeDef) {
      const d = E._placeDef;
      const snap = (v, s) => E.snap ? Math.round(v / s) * s : v;
      const grid = 28;

      let wx = (E.mouseWx != null ? E.mouseWx : (E.camX + 400));
      let wy = (E.mouseWy != null ? E.mouseWy : 140);

      let x = snap(wx, grid);
      let y = snap(wy, grid);
      let w = d.w, h = d.h;

      let flip = false, down = true, mul = 1.0, mode = "cube", strength = 1.15;
      if (d.type === TYPES.SPIKE) {
        flip = !!d.flip;
        y = flip ? (WORLD.CEIL - h) : 0;
      }
      if (d.type === TYPES.PAD) { y = 0; strength = d.strength || 1.15; }
      if (d.type === TYPES.ORB) { y = Math.max(80, y); strength = d.strength || 1.2; }
      if (d.type === TYPES.PORTAL_MODE) { y = 0; mode = d.mode || "cube"; }
      if (d.type === TYPES.PORTAL_GRAV) { y = 0; down = !!d.down; }
      if (d.type === TYPES.PORTAL_SPEED) { y = 0; mul = d.mul || 1.0; }
      if (d.type === TYPES.COIN) { y = Math.max(60, y); }
      if (d.type === TYPES.FINISH) { y = 0; }

      const sx = worldToScreenX(x, E.camX, E.zoom);
      const sy = worldToScreenY(y + h, E.zoom);
      const sw = w * E.zoom * dpr;
      const sh = h * E.zoom * dpr;

      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([10*dpr, 8*dpr]);
      ctx.lineWidth = 2*dpr;
      ctx.strokeStyle = "rgba(233,240,255,0.95)";
      ctx.fillStyle = "rgba(255,255,255,0.06)";

      if (d.type === TYPES.SPIKE) {
        ctx.beginPath();
        if (!flip) {
          ctx.moveTo(sx, sy+sh);
          ctx.lineTo(sx+sw, sy+sh);
          ctx.lineTo(sx+sw/2, sy);
        } else {
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx+sw, sy);
          ctx.lineTo(sx+sw/2, sy+sh);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else if (d.type === TYPES.ORB) {
        const cx0 = sx+sw/2, cy0 = sy+sh/2;
        ctx.beginPath(); ctx.arc(cx0,cy0,Math.min(sw,sh)*0.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
      } else if (d.type === TYPES.COIN) {
        const cx0 = sx+sw/2, cy0 = sy+sh/2;
        ctx.beginPath(); ctx.ellipse(cx0,cy0,sw*0.45,sh*0.55,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      } else if (d.type === TYPES.FINISH) {
        ctx.beginPath();
        ctx.moveTo(sx+sw*0.35, sy+sh);
        ctx.lineTo(sx+sw*0.35, sy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(sx+sw*0.35, sy+14*dpr);
        ctx.lineTo(sx+sw*0.90, sy+22*dpr);
        ctx.lineTo(sx+sw*0.35, sy+46*dpr);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        // blocks, pads, portals
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.fillRect(sx, sy, sw, sh);
      }

      ctx.restore();
    }
}

  let last = performance.now();
  let acc = 0;
  const fixed = 1/120;

  function loop(now){
    const dt = Math.min(0.05, (now-last)/1000);
    last = now;

    if (state === STATE.PLAY){
      acc += dt;
      while (acc >= fixed){
        step(fixed);
        stepParticles(fixed);
        acc -= fixed;
      }
    } else {
      time += dt * 0.4;
      stepParticles(dt * 0.6);
    }

    render();

    input.pressed = false;
    input.released = false;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function render(){
    drawBackground();

    if (state === STATE.EDIT){
      const E = AshDash.editor.state;
      level = E.level;
      drawWorld(E.camX, E.zoom);
      drawPlayer(E.camX, E.zoom);
      drawEditorOverlay(E);
    } else {
      drawWorld(camX, 1);
      drawParticles(camX, 1);
      drawPlayer(camX, 1);
    }

    progressFill.style.width = `${clamp(player.x/(level.finishX||3000),0,1)*100}%`;
    coinText.textContent = `${coins}/${level.coinsTotal||0}`;
    deathText.textContent = String(deaths);
  }

  function showMenu(){
    state = STATE.MENU;
    menuEl.classList.remove("hidden");
    editorEl.classList.add("hidden");
    mobileControls.classList.add("hidden");
    hudSubtitle.textContent = "Menu";
    synth.stop();

    built = AshDash.levels.makeBuiltinLevels();
    renderDiffTabs();
    ensureValidSelection();
    renderLevelList();
  }

  function getSelectedLevel(){
    if (selected.kind === "custom"){
      return custom[selected.idx] || custom[0] || null;
    }
    return built[selected.idx] || built[0] || null;
  }

  function startSelected(){
    const L0 = getSelectedLevel();
    if (!L0) return;

    if (selected.kind === "built" && (selected.idx + 1) > save.unlocked) return;

    level = AshDash.levels.normalizeLevel(L0);

    state = STATE.PLAY;
    menuEl.classList.add("hidden");
    editorEl.classList.add("hidden");
    hudSubtitle.textContent = (selected.kind==="built")
      ? `Level ${selected.idx+1}: ${level.name}`
      : `Custom: ${level.name}`;

    time=0; deaths=0; coins=0;
    collected.clear(); touched.clear();

    player.speedBase = Number(speedSlider.value || 220);
    player.speedMul = 1;
    player.x = 160;
    player.y = 0;
    player.vy = 0;
    player.gravDown = true;
    player.grounded = true;
    player.jumpBuffer = 0;
    player.coyote = 0;
    setMode(MODES.CUBE);
    camX = 0;

    synth.setPattern(level.synth);
    if (togSound.checked) synth.start();

    if (isMobileMode()) mobileControls.classList.remove("hidden");
  }

  function togglePause(){
    if (state === STATE.PLAY){
      state = STATE.PAUSE;
      synth.stop();
      hudSubtitle.textContent = "Paused";
    } else if (state === STATE.PAUSE){
      state = STATE.PLAY;
      if (togSound.checked) synth.start();
      hudSubtitle.textContent = level.name;
    }
  }

  function restart(){
    if (state !== STATE.PLAY && state !== STATE.PAUSE) return;
    deaths = 0; coins = 0;
    collected.clear(); touched.clear();
    player.x=160; player.y=0; player.vy=0;
    player.gravDown=true; player.grounded=true; player.speedMul=1;
    player.jumpBuffer = 0;
    player.coyote = 0;
    setMode(MODES.CUBE);
    camX=0; time=0;
  }

  function starsLine(stars){
    if (typeof AshDash.starsText === "function") return AshDash.starsText(stars);
    return "★".repeat(stars);
  }

  function renderDiffTabs(){
    diffTabsEl.innerHTML = "";
    const hasCustom = custom.length > 0;

    for (const t of TIERS){
      if (t.key === "custom" && !hasCustom) continue;
      const b = document.createElement("button");
      b.className = "chip" + (t.key === activeTier ? " on" : "");
      b.textContent = t.label;
      b.addEventListener("click", () => {
        activeTier = t.key;
        localStorage.setItem(TIER_KEY, activeTier);
        renderDiffTabs();
        ensureValidSelection();
        renderLevelList();
      });
      diffTabsEl.appendChild(b);
    }
  }

  function ensureValidSelection(){
    const filtered = getFilteredList();
    if (filtered.length === 0){
      selected = { kind:"built", idx:0 };
      return;
    }
    const ok = filtered.some(it => it.kind===selected.kind && it.idx===selected.idx);
    if (!ok){
      selected = { kind: filtered[0].kind, idx: filtered[0].idx };
    }
  }

  function getFilteredList(){
    if (activeTier === "custom"){
      return custom.map((L, idx)=>({kind:"custom", idx, L}));
    }
    return built
      .map((L, idx)=>({kind:"built", idx, L}))
      .filter(it => (it.L?.difficulty?.tier || DIFF.EASY.key) === activeTier);
  }

  function renderLevelList(){
    const list = document.getElementById("levelList");
    list.innerHTML = "";

    unlockPill.textContent = `Unlocked: ${save.unlocked}/${built.length}`;

    const items = getFilteredList();

    items.forEach((it) => {
      const locked = (it.kind==="built") && ((it.idx+1) > save.unlocked);
      const div = document.createElement("div");
      div.className = "levelBtn" + (locked ? " locked" : "");
      const stars = clamp(Number(it.L?.difficulty?.stars || 1), 1, 10);
      div.innerHTML = `
        <b>${it.kind==="built" ? `Level ${it.idx+1}` : `Custom`} — ${it.L.name}</b>
        <small>${locked ? "Locked" : "Tap to select"}</small>
        <div class="stars">${starsLine(stars)} <span style="opacity:.85">(${stars}/10)</span></div>
      `;
      div.addEventListener("click", () => {
        if (locked) return;
        selected = { kind: it.kind, idx: it.idx };
        highlightSelection();
      });
      list.appendChild(div);
    });

    highlightSelection();
  }

  function highlightSelection(){
    const list = document.getElementById("levelList");
    const items = getFilteredList();
    [...list.children].forEach((c, i) => {
      const it = items[i];
      const on = it && it.kind === selected.kind && it.idx === selected.idx;
      c.style.outline = on ? "2px solid rgba(124,255,222,.45)" : "none";
    });
  }

  function openFilePicker(){
    fileInput.value = "";
    fileInput.click();
  }

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const text = await f.text();

    if (state === STATE.EDIT){
      const ok = AshDash.editor.importFromText(text);
      if (!ok) toast("Bad level file");
      return;
    }

    const L = AshDash.levels.safeParseLevel(text);
    if (!L) return;

    custom.unshift(L);
    custom = custom.slice(0, 50);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    renderDiffTabs();
    if (activeTier !== "custom") { activeTier = "custom"; localStorage.setItem(TIER_KEY, activeTier); }
    ensureValidSelection();
    renderLevelList();
  });

  function openEditor(){
    state = STATE.EDIT;
    menuEl.classList.add("hidden");
    editorEl.classList.remove("hidden");
    mobileControls.classList.add("hidden");
    hudSubtitle.textContent = "Editor";
    synth.stop();

    AshDash.editor.state.level = AshDash.editor.makeBlankLevel();
    AshDash.editor.openEditor();

    player.x = 160; player.y = 0; player.vy = 0; player.gravDown = true;
    setMode(MODES.CUBE);
  }

  function loadSave(){
    try{
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      const unlocked = Math.max(1, Number(s.unlocked||1));
      return { unlocked };
    }catch{ return {unlocked:1}; }
  }
  function writeSave(){
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }
  function loadCustomLevels(){
    try{
      const arr = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
      if (!Array.isArray(arr)) return [];
      return arr.map(AshDash.levels.normalizeLevel);
    }catch{ return []; }
  }

  function isUiTarget(target){
    if (!target || !target.closest) return false;
    return !!target.closest(".overlay") || !!target.closest(".hud") || !!target.closest(".mobile") ||
      target.tagName==="BUTTON" || target.tagName==="INPUT";
  }

  async function press(){
    input.down = true;
    input.pressed = true;
    player.jumpBuffer = 0.14;

    synth.ensure();
    await synth.resumeIfNeeded();
    if (togSound.checked && (state === STATE.PLAY) && !synth.running) synth.start();
  }
  function release(){
    input.down = false;
    input.released = true;
  }

  addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code==="Space" || e.code==="ArrowUp" || e.code==="KeyW") press();
    if (e.code==="KeyP" || e.code==="Escape") togglePause();
    if (e.code==="KeyR") restart();
    if (e.code==="Delete" && state===STATE.EDIT) AshDash.editor.deleteSelected();
  });

  addEventListener("keyup", (e) => {
    if (e.code==="Space" || e.code==="ArrowUp" || e.code==="KeyW") release();
  });

  addEventListener("pointerdown", (e) => {
    if (isUiTarget(e.target)) return;
    if (state === STATE.MENU) startSelected();
    if (state === STATE.PAUSE) togglePause();
    if (state === STATE.EDIT) return;
    press();
  }, {passive:true});

  addEventListener("pointerup", (e) => {
    if (isUiTarget(e.target)) return;
    if (state === STATE.EDIT) return;
    release();
  }, {passive:true});

  addEventListener("pointercancel", () => release(), {passive:true});

  btnMobileJump.addEventListener("pointerdown", (e)=>{ e.preventDefault(); press(); }, {passive:false});
  btnMobileJump.addEventListener("pointerup", (e)=>{ e.preventDefault(); release(); }, {passive:false});
  btnMobileJump.addEventListener("pointercancel", (e)=>{ e.preventDefault(); release(); }, {passive:false});
  btnMobilePause.addEventListener("click", ()=>togglePause());

  // Editor canvas interaction
  canvas.addEventListener("pointerdown", (e) => {
    if (state !== STATE.EDIT) return;

    const E = AshDash.editor.state;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left);
    const py = (e.clientY - rect.top);

    const wx = E.camX + (px / E.zoom);
    const wy = (groundYpx - py) / E.zoom;

    if (E.tool === "delete"){
      const hit = AshDash.editor.hitTest(wx, wy);
      if (hit){ E.selectedId = hit.id; AshDash.editor.deleteSelected(); }
      return;
    }

    if (E.tool === "pan"){
      E.dragging = true;
      E.dragStart = { sx:e.clientX, cam:E.camX };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (E.tool === "select"){
      const hit = AshDash.editor.hitTest(wx, wy);
      if (hit){
        E.selectedId = hit.id;
        E.dragging = true;
        E.dragStart = { wx, wy, ox:hit.x, oy:hit.y };
        canvas.setPointerCapture(e.pointerId);
      } else {
        E.selectedId = null;
      }
      return;
    }

    AshDash.editor.placeAt(wx, wy);
  }, {passive:true});

  canvas.addEventListener("pointermove", (e) => {
    if (state !== STATE.EDIT) return;
    const E = AshDash.editor.state;

    // Track mouse position for placement preview
    {
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left);
      const py = (e.clientY - rect.top);
      E.mouseWx = E.camX + (px / E.zoom);
      E.mouseWy = (groundYpx - py) / E.zoom;
    }
    if (!E.dragging || !E.dragStart) return;

    if (E.tool === "pan"){
      const dx = (e.clientX - E.dragStart.sx);
      E.camX = Math.max(0, E.dragStart.cam - dx / E.zoom);
      return;
    }

    if (E.tool === "select" && E.selectedId != null){
      const o = E.level.objects.find(o=>o.id===E.selectedId);
      if (!o) return;

      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left);
      const py = (e.clientY - rect.top);

      const wx = E.camX + (px / E.zoom);
      const wy = (groundYpx - py) / E.zoom;

      let nx = E.dragStart.ox + (wx - E.dragStart.wx);
      let ny = E.dragStart.oy + (wy - E.dragStart.wy);

      if (E.snap){
        const s = 28;
        nx = Math.round(nx/s)*s;
        ny = Math.round(ny/s)*s;
      }

      o.x = nx;
      o.y = ny;
      E.level = AshDash.levels.normalizeLevel(E.level);
    }
  }, {passive:true});

  canvas.addEventListener("pointerup", () => {
    if (state !== STATE.EDIT) return;
    const E = AshDash.editor.state;
    E.dragging = false;
    E.dragStart = null;
  }, {passive:true});

  btnStart.addEventListener("click", startSelected);
  btnMenu.addEventListener("click", showMenu);
  btnPause.addEventListener("click", togglePause);
  btnRestart.addEventListener("click", restart);
  btnEditor.addEventListener("click", openEditor);
  btnReset.addEventListener("click", () => { save.unlocked = 1; writeSave(); renderLevelList(); });
  btnImport.addEventListener("click", openFilePicker);
  btnImport2.addEventListener("click", openFilePicker);

  speedSlider.addEventListener("input", () => speedLabel.textContent = String(speedSlider.value|0));
  speedLabel.textContent = String(speedSlider.value|0);

  btnToolSelect.addEventListener("click", () => setEditorTool("select", btnToolSelect));
  btnToolPan.addEventListener("click", () => setEditorTool("pan", btnToolPan));
  btnToolDelete.addEventListener("click", () => setEditorTool("delete", btnToolDelete));

  function setEditorTool(tool, btn){
    const E = AshDash.editor.state;
    E.tool = tool;
    [btnToolSelect, btnToolPan, btnToolDelete].forEach(b=>b.classList.remove("on"));
    btn.classList.add("on");
    toast(`Tool: ${tool}`);
  }

  btnSnap.addEventListener("click", () => {
    const E = AshDash.editor.state;
    E.snap = !E.snap;
    btnSnap.classList.toggle("on", E.snap);
    btnSnap.textContent = `Snap: ${E.snap ? "ON" : "OFF"}`;
  });

  btnZoomIn.addEventListener("click", () => {
    const E = AshDash.editor.state;
    E.zoom = clamp(E.zoom * 1.12, 0.55, 2.2);
  });
  btnZoomOut.addEventListener("click", () => {
    const E = AshDash.editor.state;
    E.zoom = clamp(E.zoom / 1.12, 0.55, 2.2);
  });

  btnExport.addEventListener("click", () => AshDash.editor.exportTxt());

  btnEditorBack.addEventListener("click", () => {
    const E = AshDash.editor.state;
    custom.unshift(AshDash.levels.normalizeLevel(E.level));
    custom = custom.slice(0, 50);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    renderDiffTabs();
    activeTier = "custom"; localStorage.setItem(TIER_KEY, activeTier);
    ensureValidSelection();
    showMenu();
  });

  btnTestPlay.addEventListener("click", () => {
    const E = AshDash.editor.state;
    const L = AshDash.levels.normalizeLevel(E.level);
    level = L;

    state = STATE.PLAY;
    menuEl.classList.add("hidden");
    editorEl.classList.add("hidden");

    time=0; deaths=0; coins=0;
    collected.clear(); touched.clear();

    player.speedBase = Number(speedSlider.value || 220);
    player.speedMul = 1;
    player.x=160; player.y=0; player.vy=0;
    player.gravDown=true; player.grounded=true;
    player.jumpBuffer=0; player.coyote=0;
    setMode(MODES.CUBE);
    camX=0;

    synth.setPattern(level.synth);
    if (togSound.checked) synth.start();
    if (isMobileMode()) mobileControls.classList.remove("hidden");

    hudSubtitle.textContent = `Test: ${level.name}`;
    selected = { kind:"custom", idx: 0 };
  });

  btnPreview.addEventListener("click", async () => {
    const E = AshDash.editor.state;
    synth.setPattern(E.level.synth);
    synth.ensure();
    await synth.resumeIfNeeded();
    synth.start();
    toast("Preview playing");
  });
  btnStopPreview.addEventListener("click", () => {
    synth.stop();
    toast("Preview stopped");
  });

  function syncOverlays(){
    editorEl.classList.toggle("hidden", state !== STATE.EDIT);
    menuEl.classList.toggle("hidden", state !== STATE.MENU);
    if (!isMobileMode()) mobileControls.classList.add("hidden");
  }
  setInterval(syncOverlays, 80);

  if (!isMobileMode()) mobileControls.classList.add("hidden");
  renderDiffTabs();
  ensureValidSelection();
  renderLevelList();
  showDevicePickIfNeeded();
  showMenu();
})();