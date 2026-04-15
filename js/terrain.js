// Procedural 48x48 terrain tile generator.
(function(){
  const G = window.Game = window.Game || {};
  const SIZE = 48;

  function mk(){
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return {c,x};
  }

  // deterministic pseudo-random per seed
  function rng(seed){
    let s = seed|0 || 1;
    return ()=> ((s = (s*1664525 + 1013904223) | 0) >>> 0) / 4294967296;
  }

  function drawPlains(x,seed){
    // base soil
    x.fillStyle='#1a3028'; x.fillRect(0,0,SIZE,SIZE);
    // subtle grid noise
    const r = rng(seed);
    for(let i=0;i<120;i++){
      const px=(r()*SIZE)|0, py=(r()*SIZE)|0;
      const v = r();
      x.fillStyle = v<.5 ? '#1f3a30' : '#23402f';
      x.fillRect(px,py,1,1);
    }
    // grass tufts
    for(let i=0;i<12;i++){
      const px=(r()*SIZE)|0, py=(r()*(SIZE-4)+4)|0;
      x.fillStyle='#3b6a3a';
      x.fillRect(px,py,1,2);
      x.fillStyle='#6cba57';
      x.fillRect(px,py,1,1);
    }
    // border hint
    x.strokeStyle='rgba(0,0,0,.35)'; x.lineWidth=1;
    x.strokeRect(.5,.5,SIZE-1,SIZE-1);
  }

  function drawForest(x,seed){
    drawPlains(x,seed);
    // dark canopies (overlapping discs)
    const r = rng(seed+99);
    for(let i=0;i<5;i++){
      const cx=(r()*SIZE)|0, cy=(r()*SIZE)|0, rad=6+((r()*4)|0);
      x.fillStyle='#0e201a';
      x.beginPath(); x.arc(cx,cy,rad,0,Math.PI*2); x.fill();
      x.fillStyle='#163327';
      x.beginPath(); x.arc(cx-1,cy-1,rad-1,0,Math.PI*2); x.fill();
      // highlight tips
      x.fillStyle='#2a5d45';
      x.beginPath(); x.arc(cx-2,cy-2,rad-3,0,Math.PI*2); x.fill();
      // magenta neon fungus dot
      x.fillStyle='#ff2f85';
      x.fillRect(cx+((r()*4)|0)-2, cy+((r()*4)|0)-2, 1,1);
    }
    // trunks
    for(let i=0;i<3;i++){
      const px=6+((r()*32)|0), py=30+((r()*10)|0);
      x.fillStyle='#3a1f12';
      x.fillRect(px,py,2,6);
    }
  }

  function drawMountain(x,seed){
    // rocky base
    x.fillStyle='#1b1f27'; x.fillRect(0,0,SIZE,SIZE);
    const r = rng(seed+7);
    // big chrome wedges
    x.fillStyle='#2d3640';
    x.beginPath();
    x.moveTo(4,SIZE-2); x.lineTo(20,14); x.lineTo(34,SIZE-2); x.closePath(); x.fill();
    x.fillStyle='#3a4654';
    x.beginPath();
    x.moveTo(20,SIZE-2); x.lineTo(34,20); x.lineTo(46,SIZE-2); x.closePath(); x.fill();
    // highlights
    x.fillStyle='#5a6b7d';
    x.beginPath(); x.moveTo(20,14); x.lineTo(22,16); x.lineTo(20,22); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(34,20); x.lineTo(36,22); x.lineTo(34,28); x.closePath(); x.fill();
    // speckle
    for(let i=0;i<30;i++){
      const px=(r()*SIZE)|0, py=(r()*SIZE)|0;
      x.fillStyle='rgba(255,255,255,.05)';
      x.fillRect(px,py,1,1);
    }
    // snow tips
    x.fillStyle='#9ef2ff';
    x.fillRect(19,14,3,1); x.fillRect(33,20,3,1);
  }

  function drawRoad(x,seed){
    drawPlains(x,seed);
    // dark strip
    x.fillStyle='#0e1621'; x.fillRect(0,18,SIZE,12);
    // edges
    x.fillStyle='#223244'; x.fillRect(0,17,SIZE,1); x.fillRect(0,30,SIZE,1);
    // dashed center line (circuit look)
    x.fillStyle='#19e6ff';
    for(let px=2;px<SIZE;px+=8){
      x.fillRect(px,23,4,2);
    }
    // little perpendicular nodes
    x.fillStyle='#9ef2ff';
    x.fillRect(10,16,1,2); x.fillRect(38,30,1,2);
  }

  function drawWater(x,seed){
    x.fillStyle='#0b1a2b'; x.fillRect(0,0,SIZE,SIZE);
    // horizontal bands
    for(let y=0;y<SIZE;y+=3){
      x.fillStyle = (y%6===0) ? '#113353' : '#0d2442';
      x.fillRect(0,y,SIZE,1);
    }
    // neon ripples
    const r = rng(seed+21);
    for(let i=0;i<6;i++){
      const py=(r()*SIZE)|0, px=(r()*SIZE)|0;
      x.fillStyle='rgba(25,230,255,.5)';
      x.fillRect(px,py,6,1);
    }
    // specular sparks
    for(let i=0;i<10;i++){
      const py=(r()*SIZE)|0, px=(r()*SIZE)|0;
      x.fillStyle='rgba(255,255,255,.3)';
      x.fillRect(px,py,1,1);
    }
  }

  // Shrine — purple obelisk over stone plinth (terrain only; pulse is rendered live in main.js)
  function drawShrine(x,seed){
    // ground base
    x.fillStyle='#121a24'; x.fillRect(0,0,SIZE,SIZE);
    const r = rng(seed+131);
    for(let i=0;i<80;i++){
      const px=(r()*SIZE)|0, py=(r()*SIZE)|0;
      x.fillStyle = (r()<.5) ? '#1b2735' : '#0e141c';
      x.fillRect(px,py,1,1);
    }
    // stone plinth
    x.fillStyle='#2a2233';
    x.beginPath();
    x.moveTo(8,42); x.lineTo(16,36); x.lineTo(32,36); x.lineTo(40,42); x.closePath(); x.fill();
    x.fillStyle='#3e3148';
    x.beginPath();
    x.moveTo(12,38); x.lineTo(36,38); x.lineTo(36,42); x.lineTo(12,42); x.closePath(); x.fill();
    // plinth crack
    x.fillStyle='#1a1322';
    x.fillRect(20,38,1,4); x.fillRect(26,38,1,4);
    // obelisk
    x.fillStyle='#2b1a3f';
    x.beginPath();
    x.moveTo(20,36); x.lineTo(20,12); x.lineTo(24,6); x.lineTo(28,12); x.lineTo(28,36); x.closePath(); x.fill();
    x.fillStyle='#3a2757';
    x.beginPath();
    x.moveTo(20,36); x.lineTo(20,12); x.lineTo(24,6); x.closePath(); x.fill();
    // inlaid runes (vertical dashes)
    x.fillStyle='#b264ff';
    for(let y=14;y<34;y+=4){ x.fillRect(23,y,2,2); }
    // top spike
    x.fillStyle='#e2c2ff';
    x.fillRect(23,4,2,2);
    // shadow
    x.fillStyle='rgba(0,0,0,.5)';
    x.beginPath(); x.ellipse(24,45,16,2,0,0,Math.PI*2); x.fill();
    // border
    x.strokeStyle='rgba(0,0,0,.35)'; x.strokeRect(.5,.5,SIZE-1,SIZE-1);
  }

  // Generic "ground" under buildings
  function drawGround(x,seed){
    x.fillStyle='#15202a'; x.fillRect(0,0,SIZE,SIZE);
    const r = rng(seed+55);
    for(let i=0;i<50;i++){
      const px=(r()*SIZE)|0, py=(r()*SIZE)|0;
      x.fillStyle = (r()<.5) ? '#1c2d39' : '#0f1a22';
      x.fillRect(px,py,1,1);
    }
    x.strokeStyle='rgba(0,0,0,.4)'; x.strokeRect(.5,.5,SIZE-1,SIZE-1);
  }

  const DRAWERS = {
    plains: drawPlains,
    forest: drawForest,
    mountain: drawMountain,
    road: drawRoad,
    water: drawWater,
    ground: drawGround,
    shrine: drawShrine
  };

  function buildAll(){
    const out = {};
    let i=0;
    for(const k of Object.keys(DRAWERS)){
      // produce 4 variants per terrain for mild repetition break
      out[k] = [];
      for(let v=0;v<4;v++){
        const {c,x} = mk();
        DRAWERS[k](x, i*31 + v*7 + 1);
        out[k].push(c);
      }
      i++;
    }
    G.terrainTiles = out;
  }

  G.buildTerrain = buildAll;
})();
