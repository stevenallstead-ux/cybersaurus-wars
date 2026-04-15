// Procedural sprite generator for CyberSaurus Wars.
// Each unit is drawn at 48x48 onto an offscreen canvas, once, at boot.
// Team colors: 'red' = magenta; 'blue' = cyan.
(function(){
  const G = window.Game = window.Game || {};
  const SIZE = 48;

  const TEAM = {
    red:  { primary:'#ff2f85', glow:'#ff7ab6', deep:'#7a0f3d', eye:'#ffcc3d' },
    blue: { primary:'#19e6ff', glow:'#9ef2ff', deep:'#0b5b70', eye:'#b5ff3d' },
    neutral: { primary:'#7a8a95', glow:'#c8d8e0', deep:'#2a3840', eye:'#d6e6ea' }
  };

  function mk(){
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return {c,x};
  }

  // Helpers — pixel-art-ish rectangles & ellipses
  function rect(x,px,py,w,h,fill){ x.fillStyle=fill; x.fillRect(px,py,w,h); }
  function pix(x,px,py,fill){ x.fillStyle=fill; x.fillRect(px,py,1,1); }
  function disc(x,cx,cy,r,fill){
    x.fillStyle=fill; x.beginPath(); x.arc(cx,cy,r,0,Math.PI*2); x.fill();
  }
  function stroke(x,fn,color,w){ x.strokeStyle=color; x.lineWidth=w||1; fn(); }

  // --- Individual unit drawers ---
  // All drawers receive an already-sized context and the team palette.
  // Coord system: 0..47, origin top-left. "Ground line" at y=42.

  function drawRaptor(x,t){
    // body: low crouched, tail extending behind, head forward, one raised claw
    // base chassis (dark)
    const dark = '#1a232b', mid = '#2e3d47', metal = '#506876';
    // tail
    x.fillStyle=dark;
    x.beginPath();
    x.moveTo(4,34); x.quadraticCurveTo(2,28,10,26);
    x.lineTo(16,30); x.lineTo(14,36); x.closePath(); x.fill();
    // tail tip cable
    rect(x,3,30,3,2, t.primary);
    // body
    x.fillStyle=mid;
    x.beginPath();
    x.moveTo(12,26); x.quadraticCurveTo(22,14,32,22);
    x.lineTo(36,32); x.lineTo(14,36); x.closePath(); x.fill();
    // body plate highlight
    rect(x,18,22,10,3, metal);
    // head
    x.fillStyle=mid;
    x.beginPath();
    x.moveTo(30,22); x.quadraticCurveTo(40,16,44,22);
    x.lineTo(42,28); x.lineTo(32,28); x.closePath(); x.fill();
    // snout teeth
    rect(x,42,24,2,2,'#d4dde2');
    rect(x,40,27,4,1,'#1a232b');
    // visor / eye
    rect(x,35,22,5,2, t.deep);
    rect(x,36,22,3,1, t.primary);
    pix(x,37,22, t.glow);
    // antenna
    rect(x,33,14,1,4, metal);
    pix(x,33,13, t.primary);
    // raised foreleg / claw
    x.fillStyle=dark;
    x.beginPath(); x.moveTo(28,30); x.lineTo(34,34); x.lineTo(30,38); x.lineTo(26,34); x.closePath(); x.fill();
    rect(x,30,34,3,1,t.primary);
    // legs
    rect(x,18,36,3,6,dark);
    rect(x,26,36,3,6,dark);
    rect(x,18,41,3,1,metal);
    rect(x,26,41,3,1,metal);
    // shadow
    x.fillStyle='rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(24,44,14,2,0,0,Math.PI*2); x.fill();
  }

  function drawRex(x,t){
    const dark='#1a232b', mid='#34444f', metal='#627a88';
    // tail
    x.fillStyle=dark;
    x.beginPath();
    x.moveTo(2,30); x.quadraticCurveTo(4,22,12,22);
    x.lineTo(16,28); x.lineTo(14,34); x.closePath(); x.fill();
    // torso (beefy)
    x.fillStyle=mid;
    x.beginPath();
    x.moveTo(10,22); x.quadraticCurveTo(20,8,30,14);
    x.lineTo(36,20); x.lineTo(34,34); x.lineTo(14,36); x.closePath(); x.fill();
    // back plating / spine
    for(let i=0;i<4;i++){ rect(x, 14+i*5, 12+i, 3, 2, metal); }
    // head — large, forward
    x.fillStyle=mid;
    x.beginPath();
    x.moveTo(30,14); x.quadraticCurveTo(46,10,46,22); x.lineTo(42,28); x.lineTo(32,26); x.closePath(); x.fill();
    // jaw
    rect(x,38,24,8,3,dark);
    // teeth
    for(let i=0;i<4;i++) rect(x,39+i*2,25,1,2,'#e3ecf0');
    // eye socket + glowing eye
    rect(x,36,16,5,3,dark);
    rect(x,37,17,3,1,t.primary);
    pix(x,38,17,t.glow);
    // brow bolt
    rect(x,35,14,2,2,metal);
    // chain-gun on right arm (back)
    rect(x,24,24,10,3,dark);
    rect(x,32,23,6,5,metal);
    rect(x,38,24,4,3,'#0c0c0c');
    pix(x,40,25,t.primary);
    // small arm (classic tiny rex arm)
    rect(x,22,28,3,3,dark);
    rect(x,23,31,2,1,t.primary);
    // legs
    rect(x,16,36,4,7,dark);
    rect(x,28,36,4,7,dark);
    rect(x,16,42,4,1,metal);
    rect(x,28,42,4,1,metal);
    // exhaust vent
    rect(x,12,20,3,2,dark);
    pix(x,12,20,t.primary);
    // shadow
    x.fillStyle='rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(26,44,15,2,0,0,Math.PI*2); x.fill();
  }

  function drawTrike(x,t){
    const dark='#1a232b', mid='#3a4a55', metal='#708894', plate='#2c3842';
    // body
    x.fillStyle=mid;
    x.beginPath();
    x.moveTo(6,32); x.quadraticCurveTo(24,22,42,30); x.lineTo(42,38); x.lineTo(6,38); x.closePath(); x.fill();
    // armor plating side
    rect(x,8,30,34,3,plate);
    rect(x,10,29,2,1,metal); rect(x,16,29,2,1,metal); rect(x,22,29,2,1,metal);
    rect(x,28,29,2,1,metal); rect(x,34,29,2,1,metal);
    // head + frill
    x.fillStyle=mid;
    x.beginPath();
    x.moveTo(30,22); x.quadraticCurveTo(40,14,44,22); x.lineTo(48,28); x.lineTo(40,32); x.lineTo(30,28); x.closePath(); x.fill();
    // frill edges team color
    x.strokeStyle=t.deep; x.lineWidth=1;
    x.beginPath(); x.moveTo(30,22); x.quadraticCurveTo(40,14,44,22); x.stroke();
    rect(x,32,20,2,2,t.primary); rect(x,38,17,2,2,t.primary);
    // horns (2 upper + 1 nose)
    x.fillStyle='#e3ecf0';
    x.beginPath(); x.moveTo(36,18); x.lineTo(38,10); x.lineTo(40,18); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(42,22); x.lineTo(44,14); x.lineTo(46,22); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(44,26); x.lineTo(48,26); x.lineTo(46,30); x.closePath(); x.fill();
    // eye
    rect(x,38,22,3,2,dark); pix(x,39,22,t.primary);
    // turret dome on back
    x.fillStyle=plate;
    x.beginPath(); x.arc(20,26,6,Math.PI,0); x.closePath(); x.fill();
    rect(x,18,20,4,1,metal);
    // cannon barrel
    rect(x,10,24,12,2,dark);
    rect(x,8,24,2,2,t.primary);
    // legs / treads
    rect(x,8,38,8,5,dark);
    rect(x,24,38,8,5,dark);
    for(let i=0;i<4;i++){ rect(x,9+i*2,40,1,3,metal); rect(x,25+i*2,40,1,3,metal); }
    // shadow
    x.fillStyle='rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(24,45,18,2,0,0,Math.PI*2); x.fill();
  }

  function drawPtero(x,t){
    const dark='#1a232b', mid='#3a4a55', metal='#708894';
    // shadow (airborne)
    x.fillStyle='rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(24,44,10,2,0,0,Math.PI*2); x.fill();
    // left wing
    x.fillStyle=mid;
    x.beginPath();
    x.moveTo(24,22); x.quadraticCurveTo(6,14,2,24); x.quadraticCurveTo(10,24,20,26); x.closePath(); x.fill();
    // right wing
    x.beginPath();
    x.moveTo(24,22); x.quadraticCurveTo(42,14,46,24); x.quadraticCurveTo(38,24,28,26); x.closePath(); x.fill();
    // wing ribs team color
    x.strokeStyle=t.primary; x.lineWidth=1;
    x.beginPath(); x.moveTo(24,22); x.lineTo(8,20); x.moveTo(24,22); x.lineTo(12,24); x.stroke();
    x.beginPath(); x.moveTo(24,22); x.lineTo(40,20); x.moveTo(24,22); x.lineTo(36,24); x.stroke();
    // body
    x.fillStyle=dark;
    x.beginPath(); x.ellipse(24,28,6,7,0,0,Math.PI*2); x.fill();
    // head crest
    x.fillStyle=mid;
    x.beginPath();
    x.moveTo(24,20); x.lineTo(34,18); x.lineTo(30,22); x.closePath(); x.fill();
    // beak
    x.fillStyle='#d4dde2';
    x.beginPath(); x.moveTo(30,24); x.lineTo(40,26); x.lineTo(30,28); x.closePath(); x.fill();
    // visor
    rect(x,26,24,4,2, t.deep);
    rect(x,27,24,2,1, t.primary);
    pix(x,28,24,t.glow);
    // jet engines under wings
    rect(x,10,26,6,3,'#0c0c0c'); rect(x,10,28,6,1,t.primary);
    rect(x,32,26,6,3,'#0c0c0c'); rect(x,32,28,6,1,t.primary);
    // exhaust plumes
    x.fillStyle='rgba(255,255,255,.4)';
    rect(x,8,27,2,1,'rgba(255,255,255,.6)');
    rect(x,38,27,2,1,'rgba(255,255,255,.6)');
    // feet tucked
    rect(x,22,34,2,3,dark); rect(x,24,34,2,3,dark);
  }

  function drawStego(x,t){
    const dark='#1a232b', mid='#354551', metal='#708894';
    // tail
    x.fillStyle=dark;
    x.beginPath();
    x.moveTo(2,34); x.quadraticCurveTo(2,28,8,28); x.lineTo(14,34); x.lineTo(8,38); x.closePath(); x.fill();
    // tail spikes
    x.fillStyle='#e3ecf0';
    x.beginPath(); x.moveTo(2,34); x.lineTo(4,30); x.lineTo(6,34); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(2,36); x.lineTo(4,40); x.lineTo(6,36); x.closePath(); x.fill();
    // body
    x.fillStyle=mid;
    x.beginPath();
    x.moveTo(10,30); x.quadraticCurveTo(24,18,38,30); x.lineTo(36,38); x.lineTo(12,38); x.closePath(); x.fill();
    // plates along spine
    const platesX = [14,20,26,32];
    for(const px of platesX){
      x.fillStyle=dark;
      x.beginPath(); x.moveTo(px-3,24); x.lineTo(px,16); x.lineTo(px+3,24); x.closePath(); x.fill();
      x.fillStyle=t.primary;
      x.beginPath(); x.moveTo(px-1,22); x.lineTo(px,18); x.lineTo(px+1,22); x.closePath(); x.fill();
    }
    // shoulder cannons
    rect(x,14,22,4,3,'#0c0c0c'); rect(x,10,22,4,3,metal);
    rect(x,28,22,4,3,'#0c0c0c'); rect(x,32,22,4,3,metal);
    pix(x,10,23,t.primary); pix(x,35,23,t.primary);
    // head
    x.fillStyle=mid;
    x.beginPath();
    x.moveTo(36,28); x.quadraticCurveTo(44,26,44,32); x.lineTo(40,34); x.lineTo(36,32); x.closePath(); x.fill();
    // eye
    rect(x,40,29,2,2,dark); pix(x,41,29,t.primary);
    // legs (4 stumpy)
    rect(x,12,38,4,5,dark); rect(x,20,38,4,5,dark);
    rect(x,28,38,4,5,dark); rect(x,32,38,4,5,dark);
    rect(x,12,42,4,1,metal); rect(x,20,42,4,1,metal);
    rect(x,28,42,4,1,metal); rect(x,32,42,4,1,metal);
    // shadow
    x.fillStyle='rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(24,45,18,2,0,0,Math.PI*2); x.fill();
  }

  const DRAWERS = {
    raptor: drawRaptor,
    rex:    drawRex,
    trike:  drawTrike,
    ptero:  drawPtero,
    stego:  drawStego
  };

  // Cache: sprites[type][team] => canvas
  const sprites = {};

  function buildAll(){
    const teams = ['red','blue'];
    for(const type of Object.keys(DRAWERS)){
      sprites[type] = {};
      for(const team of teams){
        const {c,x} = mk();
        DRAWERS[type](x, TEAM[team]);
        sprites[type][team] = c;
      }
    }

    // HQ / base / factory "building" marker canvases (small)
    const bCfg = [
      { key:'hq',       label:'HQ' },
      { key:'base',     label:'◆'  },
      { key:'factory',  label:'F'  },
    ];
    const buildings = {};
    for(const cfg of bCfg){
      buildings[cfg.key] = {};
      for(const team of ['red','blue','neutral']){
        const {c,x} = mk();
        drawBuilding(x, TEAM[team], cfg.label, cfg.key);
        buildings[cfg.key][team] = c;
      }
    }

    G.sprites = sprites;
    G.buildings = buildings;
  }

  function drawBuilding(x,t,label,kind){
    // platform shadow
    x.fillStyle='rgba(0,0,0,.5)';
    x.fillRect(4,40,40,4);
    // structure base
    x.fillStyle='#0f1a22'; x.fillRect(6,18,36,22);
    x.fillStyle='#1d2d37'; x.fillRect(6,18,36,4);
    // side struts
    x.fillStyle='#2a3a44';
    x.fillRect(6,22,2,18); x.fillRect(40,22,2,18);
    // team glow panel
    x.fillStyle=t.deep; x.fillRect(10,24,28,12);
    // animated "screen"
    x.fillStyle=t.primary; x.fillRect(11,25,26,1);
    x.fillStyle=t.glow;    x.fillRect(11,34,26,1);
    // label
    x.fillStyle='#fff'; x.font='bold 10px Orbitron, sans-serif';
    x.textAlign='center'; x.textBaseline='middle';
    x.fillText(label, 24, 30);
    // antenna for HQ / factory
    if(kind!=='base'){
      x.fillStyle='#708894'; x.fillRect(23,10,2,8);
      x.fillStyle=t.primary; x.fillRect(22,8,4,2);
    }
    // dome for HQ
    if(kind==='hq'){
      x.fillStyle='#2a3a44';
      x.beginPath(); x.arc(24,18,10,Math.PI,0); x.closePath(); x.fill();
      x.strokeStyle=t.primary; x.lineWidth=1;
      x.beginPath(); x.arc(24,18,10,Math.PI,0); x.stroke();
    }
    // scanlines
    for(let y=26;y<36;y+=2){
      x.fillStyle='rgba(0,0,0,.25)'; x.fillRect(10,y,28,1);
    }
  }

  G.SpriteSize = SIZE;
  G.buildSprites = buildAll;
})();
