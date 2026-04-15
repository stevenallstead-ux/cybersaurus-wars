// Boot, render loop, input.
(function(){
  const G = window.Game = window.Game || {};
  const TS = 48;        // tile size

  let canvas, ctx;
  let tNow = 0;         // anim tick

  // Interaction state
  let mode = 'idle';    // 'idle' | 'selected' | 'action' | 'attack' | 'ai'
  let selected = null;
  let reachSet = null;  // Map of "x,y" -> reach entry
  let attackTargets = null;
  let prevMovePos = null; // saved original pos before tentative move

  function init(){
    canvas = document.getElementById('board');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Build procedural assets
    G.buildSprites();
    G.buildTerrain();

    // Init state to show title; starting match happens on button click
    G.state = G.newState();
    G.state.phase = G.PHASE.TITLE;
    G.ui.show('title');
    G.ui.renderApexCards && G.ui.renderApexCards();

    // Music — title theme starts on first user gesture due to autoplay
    G.ui.bindTitleStart(()=>{
      if(document.getElementById('btn-start').disabled) return;
      G.audio.ensureCtx();
      G.audio.startMusic('battle');
      G.startMatch();
      mode = 'idle'; selected = null; reachSet = null; attackTargets = null;
    });
    G.ui.bindUlt && G.ui.bindUlt(handleUlt);
    G.ui.bindPlayAgain(()=>{
      G.ui.hideGameOver();
      G.startMatch();
      mode='idle'; selected=null; reachSet=null; attackTargets=null;
    });
    G.ui.bindEndTurn(handleEndTurn);
    G.ui.bindFactoryClose(()=>{
      G.ui.hideFactoryMenu();
      mode = 'idle';
    });

    // Mouse & keyboard
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', ()=>{ G.state.hoveredCell = null; G.ui.refreshUnit(); });
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('contextmenu', (e)=>{ e.preventDefault(); cancelSelection(); });
    document.addEventListener('keydown', onKey);

    window.__rerender = render;

    // Dev hooks for autonomous testing
    window.__devWin = ()=>{
      // set blue HQ to red
      const s = G.state;
      for(let y=0;y<s.map.H;y++) for(let x=0;x<s.map.W;x++){
        const t = s.map.tiles[y][x];
        if(t.building==='hq' && t.originalTeam==='blue'){ t.team = 'red'; t.capHP = 0; }
      }
      G.endMatch('red');
    };
    window.__devLose = ()=>{
      const s = G.state;
      for(let y=0;y<s.map.H;y++) for(let x=0;x<s.map.W;x++){
        const t = s.map.tiles[y][x];
        if(t.building==='hq' && t.originalTeam==='red'){ t.team = 'blue'; t.capHP = 0; }
      }
      G.endMatch('blue');
    };
    window.__devFunds = (n)=>{ G.state.funds.red += n||10000; G.ui.refreshHud(); };
    window.__devCharge = (team, n)=>{ G.state.charge[team||'red'] = n != null ? n : 10; G.ui.refreshAll(); };
    window.__state = ()=>G.state;

    // Start render loop
    requestAnimationFrame(frame);
  }

  function frame(t){
    tNow = t;
    render();
    requestAnimationFrame(frame);
  }

  // --- Rendering ---
  function cellFromEvent(e){
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / (r.width / canvas.width) / TS);
    const y = Math.floor((e.clientY - r.top)  / (r.height / canvas.height) / TS);
    return {x,y};
  }

  function render(){
    if(!G.state) return;
    const s = G.state;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    // Draw terrain
    for(let y=0;y<s.map.H;y++){
      for(let x=0;x<s.map.W;x++){
        const t = s.map.tiles[y][x];
        const variants = G.terrainTiles[t.building?'ground':t.type] || G.terrainTiles.plains;
        const v = variants[(x*3 + y*7) % variants.length];
        ctx.drawImage(v, x*TS, y*TS);
      }
    }

    // Overlays: movement reach
    if(reachSet){
      ctx.save();
      ctx.fillStyle = 'rgba(25,230,255,0.20)';
      ctx.strokeStyle = 'rgba(158,242,255,0.55)';
      ctx.lineWidth = 1;
      for(const key of reachSet.keys()){
        const [x,y] = key.split(',').map(Number);
        ctx.fillRect(x*TS+2, y*TS+2, TS-4, TS-4);
        ctx.strokeRect(x*TS+2.5, y*TS+2.5, TS-5, TS-5);
      }
      ctx.restore();
    }

    // Attack targets overlay
    if(mode === 'attack' && attackTargets){
      ctx.save();
      const pulse = 0.3 + 0.3*Math.sin(tNow/120);
      ctx.fillStyle = `rgba(255,47,133,${0.25+pulse*0.2})`;
      ctx.strokeStyle = `rgba(255,122,182,${0.6+pulse*0.3})`;
      ctx.lineWidth = 2;
      for(const t of attackTargets){
        ctx.fillRect(t.x*TS+2, t.y*TS+2, TS-4, TS-4);
        ctx.strokeRect(t.x*TS+2.5, t.y*TS+2.5, TS-5, TS-5);
      }
      ctx.restore();
    }

    // Shrines — pulsing crystal core overlay (only when crystal present)
    for(let y=0;y<s.map.H;y++){
      for(let x=0;x<s.map.W;x++){
        const t = s.map.tiles[y][x];
        if(t.type !== 'shrine') continue;
        const hasCrystal = !!t.crystal;
        const cx = x*TS + 24, cy = y*TS + 20;
        if(hasCrystal){
          const pulse = 0.55 + 0.35*Math.sin((tNow + x*97 + y*41)/140);
          ctx.save();
          ctx.fillStyle = `rgba(178,100,255,${pulse*0.4})`;
          ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = `rgba(226,194,255,${pulse})`;
          ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fill();
          ctx.restore();
        } else {
          // dim state
          ctx.save();
          ctx.fillStyle = 'rgba(80,60,110,0.25)';
          ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
          ctx.restore();
        }
      }
    }

    // Buildings
    for(let y=0;y<s.map.H;y++){
      for(let x=0;x<s.map.W;x++){
        const t = s.map.tiles[y][x];
        if(!t.building) continue;
        const spr = G.buildings[t.building][t.team] || G.buildings[t.building].neutral;
        ctx.drawImage(spr, x*TS, y*TS);
        // cap progress bar
        const maxCap = G.BUILDING_DEF[t.building].capMax;
        if(t.capHP < maxCap){
          const frac = t.capHP / maxCap;
          ctx.fillStyle='#0c0c0c'; ctx.fillRect(x*TS+6, y*TS+2, TS-12, 3);
          ctx.fillStyle = '#ffcc3d';
          ctx.fillRect(x*TS+6, y*TS+2, (TS-12)*frac, 3);
        }
      }
    }

    // Units (with idle bob)
    for(const u of s.units){
      if(u.dead) continue;
      const spr = G.sprites[u.type][u.team];
      const bob = (Math.floor(tNow/220) % 2 === 0) ? 0 : -1;
      ctx.save();
      if(u.moved){ ctx.globalAlpha = 0.55; }
      ctx.drawImage(spr, u.x*TS, u.y*TS + bob);
      ctx.restore();
      // HP bar bottom-right corner of tile
      const echo = s.fossilEcho && s.fossilEcho.expiresAtTurn >= s.turnNum
                && s.fossilEcho.team !== u.team;
      if(u.hp < 100 || echo){
        const disp = Math.ceil(u.hp/10);
        ctx.fillStyle = '#0c0c0c';
        ctx.fillRect(u.x*TS+TS-16, u.y*TS+TS-10, 14, 8);
        ctx.fillStyle = u.hp > 50 ? '#b5ff3d' : u.hp > 20 ? '#ffcc3d' : '#ff5252';
        ctx.font = 'bold 9px Orbitron';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(disp, u.x*TS+TS-9, u.y*TS+TS-5);
        if(echo){
          // purple outline to signal fossil-echo reveal
          ctx.strokeStyle = 'rgba(226,194,255,.9)';
          ctx.lineWidth = 1;
          ctx.strokeRect(u.x*TS+TS-16.5, u.y*TS+TS-10.5, 15, 9);
        }
      }
      if(u.lagged){
        // chrono lag visual
        ctx.save();
        ctx.strokeStyle = 'rgba(178,100,255,.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3,3]);
        ctx.strokeRect(u.x*TS+2.5, u.y*TS+2.5, TS-5, TS-5);
        ctx.restore();
      }
      // team corner tag
      ctx.fillStyle = u.team==='red' ? '#ff2f85' : '#19e6ff';
      ctx.fillRect(u.x*TS+2, u.y*TS+TS-5, 6, 3);
      // rank pips (bottom-center)
      if(u.rank && u.rank.key !== 'rookie'){
        const pips = u.rank.key === 'apex' ? 2 : 1;
        const pipColor = u.team==='red' ? '#ffcc3d' : '#b5ff3d';
        ctx.fillStyle = pipColor;
        for(let p=0;p<pips;p++){
          ctx.fillRect(u.x*TS+10 + p*4, u.y*TS+TS-4, 2, 2);
        }
        if(u.rank.key === 'apex'){
          ctx.save();
          const aura = 0.35 + 0.25*Math.sin(tNow/180 + u.id);
          ctx.strokeStyle = `rgba(255,204,61,${aura})`;
          ctx.lineWidth = 1;
          ctx.strokeRect(u.x*TS+3.5, u.y*TS+3.5, TS-7, TS-7);
          ctx.restore();
        }
      }
    }

    // Selection ring
    if(selected){
      ctx.save();
      const pulse = 0.4 + 0.4*Math.sin(tNow/140);
      ctx.strokeStyle = selected.team==='red' ? `rgba(255,122,182,${pulse})` : `rgba(158,242,255,${pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(selected.x*TS+1, selected.y*TS+1, TS-2, TS-2);
      ctx.restore();
    }

    // Hover crosshair (with stormcall 3x3 preview)
    const hc = s.hoveredCell;
    if(hc && hc.x>=0 && hc.y>=0){
      ctx.save();
      if(mode === 'ult-target'){
        const pulse = 0.35 + 0.35*Math.sin(tNow/90);
        ctx.fillStyle = `rgba(255,204,61,${0.18+pulse*0.15})`;
        ctx.strokeStyle = `rgba(255,232,138,${0.6+pulse*0.3})`;
        ctx.lineWidth = 2;
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
          const tx = hc.x+dx, ty = hc.y+dy;
          if(tx<0||ty<0||tx>=s.map.W||ty>=s.map.H) continue;
          ctx.fillRect(tx*TS+2, ty*TS+2, TS-4, TS-4);
          ctx.strokeRect(tx*TS+1.5, ty*TS+1.5, TS-3, TS-3);
        }
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(hc.x*TS+0.5, hc.y*TS+0.5, TS-1, TS-1);
      }
      ctx.restore();
    }

    // Grid ink
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for(let x=0;x<=s.map.W;x++){ ctx.beginPath(); ctx.moveTo(x*TS+.5,0); ctx.lineTo(x*TS+.5,s.map.H*TS); ctx.stroke(); }
    for(let y=0;y<=s.map.H;y++){ ctx.beginPath(); ctx.moveTo(0,y*TS+.5); ctx.lineTo(s.map.W*TS, y*TS+.5); ctx.stroke(); }
    ctx.restore();
  }

  // --- Input handling ---
  function onMouseMove(e){
    const {x,y} = cellFromEvent(e);
    if(x<0||y<0||x>=G.state.map.W||y>=G.state.map.H){ G.state.hoveredCell = null; }
    else G.state.hoveredCell = {x,y};
    G.ui.refreshUnit();
  }

  function onCanvasClick(e){
    const s = G.state;
    if(!s || s.phase!==G.PHASE.PLAY) return;
    if(s.activeTeam!=='red') return; // only human on red plays with mouse
    const {x,y} = cellFromEvent(e);
    if(x<0||y<0||x>=s.map.W||y>=s.map.H) return;
    const tile = s.map.tiles[y][x];
    const unit = G.unitAt(x,y);

    if(mode === 'ult-target'){
      tryUltTarget(x, y);
      return;
    }
    if(mode === 'crystal-target'){
      const u = crystalTargetUnit;
      const ok = G.useCrystal(u, {x,y});
      if(ok){
        u.moved = true;
        crystalTargetUnit = null;
        mode = 'idle';
        canvas.classList.remove('ult-target');
        finishAction();
        G.ui.refreshAll();
        const w = G.winner(); if(w){ G.endMatch(w); return; }
      } else {
        G.log('system', 'Invalid crystal target.');
      }
      return;
    }

    if(mode === 'idle'){
      if(unit && unit.team==='red' && !unit.moved){
        selectUnit(unit);
        G.audio.play('select');
      } else if(tile.building==='factory' && tile.team==='red'){
        if(!unit){
          mode = 'buying';
          selected = null;
          G.ui.showFactoryMenu(tile);
          G.audio.play('select');
        }
      } else if(unit){
        // show info only
        s.selected = unit;
        G.ui.refreshUnit();
      }
      return;
    }

    if(mode === 'selected'){
      const key = x+','+y;
      if(reachSet && reachSet.has(key)){
        // move (tentatively — no undo; confirmation via action menu)
        prevMovePos = { x: selected.x, y: selected.y };
        G.moveUnitTo(selected, x, y);
        showActionFor(selected);
      } else if(unit === selected){
        // wait in place
        showActionFor(selected);
      } else {
        cancelSelection();
      }
      return;
    }

    if(mode === 'attack'){
      const hit = attackTargets && attackTargets.find(t => t.x===x && t.y===y);
      if(hit){
        const res = G.attack(selected, hit.unit);
        const sfx = selected.def.moveType==='tread'||selected.def.isAir ? 'attack_heavy':'attack_light';
        G.audio.play(sfx);
        if(res.dealt>0) G.log('red', `${selected.def.name} → ${hit.unit.def.name} (-${res.dealt})`);
        if(hit.unit.dead){ G.audio.play('explode'); G.log('red', `${hit.unit.def.name} destroyed`); }
        if(res.counter>0) G.log('blue', `counter (-${res.counter})`);
        if(selected.dead){ G.audio.play('explode'); G.log('system', `${selected.def.name} destroyed in counter`); }
        selected.moved = true;
        G.removeDeadUnits();
        finishAction();
        const w = G.winner(); if(w){ G.endMatch(w); return; }
      } else {
        // cancel back to selected
        mode='selected';
        G.ui.hideActionMenu();
        recomputeAttackTargetsFromSelected();
        showActionFor(selected);
      }
      return;
    }
  }

  function selectUnit(u){
    selected = u;
    G.state.selected = u;
    mode = 'selected';
    const list = G.reachable(u);
    reachSet = new Map();
    for(const r of list){ reachSet.set(r.x+','+r.y, r); }
    G.ui.refreshUnit();
  }

  function showActionFor(u){
    mode = 'action';
    // compute attack targets at new pos
    let canAttack = false;
    let canCapture = false;
    if(!u.def.indirect || (prevMovePos && prevMovePos.x===u.x && prevMovePos.y===u.y)){
      const targets = G.attackTargetsFrom(u, u.x, u.y);
      canAttack = targets.length > 0;
    }
    const tile = G.getTile(u.x, u.y);
    if(u.def.canCapture && tile.building && tile.team !== u.team) canCapture = true;

    reachSet = null;
    const cdef = u.crystal ? G.CRYSTALS[u.crystal] : null;
    G.ui.showActionMenu({
      canAttack, canCapture,
      hasCrystal: !!u.crystal,
      crystalName: cdef ? cdef.name : 'CRYSTAL',
      onAction: (name)=>{
        if(name==='wait'){ u.moved = true; finishAction(); }
        else if(name==='attack'){ enterAttackMode(u); }
        else if(name==='capture'){ doCapture(u); }
        else if(name==='crystal'){ useCrystalAction(u); }
        else if(name==='cancel'){
          if(prevMovePos){ u.x = prevMovePos.x; u.y = prevMovePos.y; }
          cancelSelection();
        }
      }
    });
  }

  function useCrystalAction(u){
    const cdef = G.CRYSTALS[u.crystal];
    if(!cdef) return;
    if(cdef.kind === 'self'){
      const ok = G.useCrystal(u, null);
      if(ok){
        // graft un-marks moved; echo doesn't affect moved
        finishAction();
        G.ui.refreshAll();
      }
    } else {
      // enter crystal-target mode
      mode = 'crystal-target';
      crystalTargetUnit = u;
      canvas.classList.add('ult-target');
      G.ui.hideActionMenu();
      G.log('red', `[${cdef.name}] pick a target...`);
    }
  }
  let crystalTargetUnit = null;

  function recomputeAttackTargetsFromSelected(){
    attackTargets = G.attackTargetsFrom(selected, selected.x, selected.y);
  }

  function enterAttackMode(u){
    mode = 'attack';
    G.ui.hideActionMenu();
    recomputeAttackTargetsFromSelected();
    if(!attackTargets || attackTargets.length===0){
      mode = 'action';
      showActionFor(u);
    }
  }

  function doCapture(u){
    const tile = G.getTile(u.x, u.y);
    const r = G.capture(u, tile);
    G.audio.play('capture');
    if(r==='captured') G.log('red', `${tile.building.toUpperCase()} captured`);
    else if(r==='progress') G.log('red', `capturing ${tile.building}... (${tile.capHP})`);
    u.moved = true;
    finishAction();
    const w = G.winner(); if(w){ G.endMatch(w); }
  }

  function finishAction(){
    mode = 'idle';
    selected = null;
    G.state.selected = null;
    reachSet = null;
    attackTargets = null;
    prevMovePos = null;
    G.ui.hideActionMenu();
    G.ui.refreshAll();
  }

  function cancelSelection(){
    if(mode==='action' && prevMovePos && selected){
      selected.x = prevMovePos.x; selected.y = prevMovePos.y;
    }
    mode = 'idle';
    selected = null;
    G.state.selected = null;
    reachSet = null;
    attackTargets = null;
    prevMovePos = null;
    G.ui.hideFactoryMenu();
    G.ui.hideActionMenu();
    G.ui.refreshAll();
  }

  function handleEndTurn(){
    if(G.state.activeTeam!=='red') return;
    cancelSelection();
    G.endTurn();
  }

  function handleUlt(){
    const s = G.state;
    if(!s || s.phase!==G.PHASE.PLAY || s.activeTeam!=='red') return;
    if(!G.apex || !G.apex.canCast('red')) return;
    const key = s.apex.red;
    const def = G.APEX[key];
    if(def.ultKind === 'target'){
      mode = 'ult-target';
      canvas.classList.add('ult-target');
      G.log('red', `[${def.name}] awaiting target...`);
    } else {
      G.apex.castSelf('red', null);
      G.ui.refreshAll();
    }
  }

  function tryUltTarget(tx, ty){
    const ok = G.apex.castSelf('red', {x:tx, y:ty});
    mode = 'idle';
    canvas.classList.remove('ult-target');
    G.ui.refreshAll();
    const w = G.winner(); if(w) G.endMatch(w);
    return ok;
  }

  function onKey(e){
    if(e.key === 'e' || e.key === 'E'){ handleEndTurn(); }
    else if(e.key === 'q' || e.key === 'Q'){ handleUlt(); }
    else if(e.key === 'Escape'){
      if(mode === 'ult-target'){
        mode = 'idle';
        canvas.classList.remove('ult-target');
      } else { cancelSelection(); }
    }
    else if(e.key === ' '){ G.audio && G.audio.toggleMute(); e.preventDefault(); }
  }

  // Boot on DOM ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
