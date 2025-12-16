(() => {
  const AshDash = (window.AshDash = window.AshDash || {});
  const { TYPES, MODES, WORLD } = AshDash;

  const NOTE_CYCLE = [-999, 0,2,4,5,7,9,11,12];

  function makeBlankLevel(){
    return AshDash.levels.normalizeLevel({
      name: "My Level",
      version: 1,
      difficulty: { tier: (AshDash.DIFF?.EASY?.key||"easy"), stars: 3 },
      synth: {
        bpm: 128,
        melody: Array(16).fill(-999),
        bass: Array(16).fill(0),
        drums: Array(16).fill(0),
      },
      objects: [
        { type: TYPES.SOLID, x: -400, y: -WORLD.GROUND_THICK, w: 8400, h: WORLD.GROUND_THICK },
        { type: TYPES.FINISH, x: 2600, y: 0, w: 80, h: 240 }
      ],
    });
  }

  const editorState = {
    open: false,
    level: makeBlankLevel(),
    camX: 0,
    zoom: 1,
    snap: true,
    tool: "select",
    selectedId: null,
    dragging: false,
    mouseWx: 0,
    mouseWy: 0,
    dragStart: null,
    _placeDef: null,
  };

  function setToast(msg){
    const t = document.getElementById("toast");
    if (t) t.textContent = msg;
  }

  function buildToolButtons(){
    const row = document.getElementById("toolRow");
    row.innerHTML = "";

    const tools = [
      { label:"Block", type:TYPES.SOLID, w:112, h:56 },
      { label:"Tall Block", type:TYPES.SOLID, w:112, h:168 },
      { label:"Spike", type:TYPES.SPIKE, w:44, h:44, flip:false },
      { label:"Ceil Spike", type:TYPES.SPIKE, w:44, h:44, flip:true },
      { label:"Pad", type:TYPES.PAD, w:56, h:18, strength:1.15 },
      { label:"Orb", type:TYPES.ORB, w:38, h:38, strength:1.2 },
      { label:"Mode: CUBE", type:TYPES.PORTAL_MODE, w:64, h:220, mode:MODES.CUBE },
      { label:"Mode: BALL", type:TYPES.PORTAL_MODE, w:64, h:220, mode:MODES.BALL },
      { label:"Mode: UFO", type:TYPES.PORTAL_MODE, w:64, h:220, mode:MODES.UFO },
      { label:"Mode: WAVE", type:TYPES.PORTAL_MODE, w:64, h:220, mode:MODES.WAVE },
      { label:"Grav DOWN", type:TYPES.PORTAL_GRAV, w:64, h:220, down:true },
      { label:"Grav UP", type:TYPES.PORTAL_GRAV, w:64, h:220, down:false },
      { label:"Speed x1.10", type:TYPES.PORTAL_SPEED, w:64, h:220, mul:1.10 },
      { label:"Speed x1.25", type:TYPES.PORTAL_SPEED, w:64, h:220, mul:1.25 },
      { label:"Coin", type:TYPES.COIN, w:30, h:30 },
      { label:"Finish", type:TYPES.FINISH, w:80, h:240 },
    ];

    for (const t of tools){
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = t.label;
      b.addEventListener("click", () => {
        editorState.tool = "place";
        editorState._placeDef = t;
        // highlight active placement tool
        [...row.children].forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        setToast(`Place: ${t.label}`);
      });
      row.appendChild(b);
    }
  }

  function buildSeq(containerId, getArr, kind){
    const el = document.getElementById(containerId);
    el.innerHTML = "";
    for(let i=0;i<16;i++){
      const s = document.createElement("div");
      s.className = "step";
      const arr = getArr();
      const v = arr[i];
      if (kind === "mel") {
        s.classList.toggle("on2", v !== -999);
        s.textContent = (v === -999) ? "·" : String(v);
      } else {
        s.classList.toggle("on", !!v);
        s.textContent = v ? "●" : "·";
      }
      s.addEventListener("click", () => {
        const a = getArr();
        if (kind === "mel") {
          const idx = Math.max(0, NOTE_CYCLE.indexOf(a[i]));
          a[i] = NOTE_CYCLE[(idx+1) % NOTE_CYCLE.length];
        } else {
          a[i] = a[i] ? 0 : 1;
        }
        const vv = a[i];
        if (kind === "mel") {
          s.classList.toggle("on2", vv !== -999);
          s.textContent = (vv === -999) ? "·" : String(vv);
        } else {
          s.classList.toggle("on", !!vv);
          s.textContent = vv ? "●" : "·";
        }
      });
      el.appendChild(s);
    }
  }

  function syncSynthUI(){
    const bpm = document.getElementById("bpmSlider");
    const lbl = document.getElementById("bpmLabel");
    bpm.value = String(editorState.level.synth.bpm);
    lbl.textContent = String(editorState.level.synth.bpm);

    bpm.oninput = () => {
      editorState.level.synth.bpm = Number(bpm.value);
      lbl.textContent = String(editorState.level.synth.bpm);
    };

    buildSeq("seqMelody", () => editorState.level.synth.melody, "mel");
    buildSeq("seqBass",   () => editorState.level.synth.bass, "bin");
    buildSeq("seqDrums",  () => editorState.level.synth.drums, "bin");
  }

  function placeAt(wx, wy){
    const d = editorState._placeDef;
    if (!d) return;

    const snap = (v, s) => editorState.snap ? Math.round(v/s)*s : v;
    const grid = 28;

    const o = {
      type: d.type,
      x: snap(wx, grid),
      y: snap(wy, grid),
      w: d.w,
      h: d.h,
    };

    if (o.type === TYPES.SPIKE){
      if (d.flip){
        o.flip = true;
        o.y = WORLD.CEIL - o.h;
      } else {
        o.flip = false;
        o.y = 0;
      }
    }
    if (o.type === TYPES.PAD) { o.y = 0; o.strength = d.strength; }
    if (o.type === TYPES.ORB) { o.strength = d.strength; o.y = Math.max(80, o.y); }
    if (o.type === TYPES.PORTAL_MODE){ o.mode = d.mode; o.y = 0; }
    if (o.type === TYPES.PORTAL_GRAV){ o.down = d.down; o.y = 0; }
    if (o.type === TYPES.PORTAL_SPEED){ o.mul = d.mul; o.y = 0; }
    if (o.type === TYPES.COIN){ o.y = Math.max(60, o.y); }
    if (o.type === TYPES.FINISH){ o.y = 0; }

    editorState.level.objects.push(o);
    editorState.level = AshDash.levels.normalizeLevel(editorState.level);
    editorState.selectedId = o.id;
    setToast("Placed");
  }

  function hitTest(wx, wy){
    const objs = editorState.level.objects;
    for (let i=objs.length-1;i>=0;i--){
      const o = objs[i];
      if (wx >= o.x && wx <= o.x+o.w && wy >= o.y && wy <= o.y+o.h) return o;
    }
    return null;
  }

  function deleteSelected(){
    if (editorState.selectedId == null) return;
    const i = editorState.level.objects.findIndex(o => o.id === editorState.selectedId);
    if (i >= 0){
      editorState.level.objects.splice(i, 1);
      editorState.level = AshDash.levels.normalizeLevel(editorState.level);
      editorState.selectedId = null;
      setToast("Deleted");
    }
  }

  function exportTxt(){
    editorState.level = AshDash.levels.normalizeLevel(editorState.level);
    const json = JSON.stringify({
      version: editorState.level.version,
      name: editorState.level.name,
      difficulty: editorState.level.difficulty,
      synth: editorState.level.synth,
      objects: editorState.level.objects.map(o => ({
        type:o.type,x:o.x,y:o.y,w:o.w,h:o.h,
        flip:o.flip, strength:o.strength, down:o.down, mul:o.mul, mode:o.mode
      }))
    }, null, 2);

    const blob = new Blob([json], {type:"text/plain"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${editorState.level.name.replace(/[^\w\-]+/g,"_")}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setToast("Exported .txt");
    setTimeout(()=>URL.revokeObjectURL(a.href), 1200);
  }

  function importFromText(text){
    const L = AshDash.levels.safeParseLevel(text);
    if (!L) return false;
    editorState.level = L;
    editorState.selectedId = null;
    document.getElementById("editorNamePill").textContent = L.name;
    syncSynthUI();
    setToast(`Imported: ${L.name}`);
    return true;
  }

  function openEditor(){
    editorState.open = true;
    editorState.camX = 0;
    editorState.zoom = 1;
    editorState.snap = true;
    editorState.tool = "select";
    editorState.selectedId = null;
    editorState.dragging = false;
    editorState.dragStart = null;

    buildToolButtons();
    syncSynthUI();
    setToast("Editor ready");
    document.getElementById("editorNamePill").textContent = editorState.level.name;
  }

  AshDash.editor = {
    state: editorState,
    makeBlankLevel,
    openEditor,
    placeAt,
    hitTest,
    deleteSelected,
    exportTxt,
    importFromText,
  };
})();