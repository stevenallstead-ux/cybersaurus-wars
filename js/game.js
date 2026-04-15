// Game state machine + core lifecycle.
(function(){
  const G = window.Game = window.Game || {};

  const PHASE = { TITLE:'title', PLAY:'play', GAMEOVER:'gameover' };

  function newState(){
    const map = G.buildMap();
    const units = [];
    for(const u of map.startUnits){
      units.push(makeUnit(u.type, u.team, u.x, u.y, u.hp));
    }
    const apexPicks = (window.__apexPick) || {red:'viridian', blue:randomApex()};
    const s = {
      phase: PHASE.TITLE,
      map,
      units,
      activeTeam: 'red',
      turnNum: 1,
      funds: { red: 2000, blue: 2000 },
      selected: null,
      // UI transient state
      hoveredCell: null,
      movePreview: null,
      attackPreview: null,
      pendingMove: null,
      log: [],
      winnerTeam: null,
      apex: apexPicks,
      charge: { red: 0, blue: 0 },
      ultsUsed: { red: 0, blue: 0 },
      turnEffects: { red: {}, blue: {} },
    };
    return s;
  }

  function randomApex(){
    const keys = Object.keys(G.APEX || {viridian:1,tarsus:1,nova:1,throat:1});
    return keys[(Math.random()*keys.length)|0];
  }

  function makeUnit(type, team, x, y, hp){
    const def = G.UNITS[type];
    return {
      id: (Math.random()*1e9)|0,
      type, def, team, x, y,
      hp: hp != null ? hp : 100,
      moved: false,
      dead: false,
      kills: 0,
      rank: G.rankFor(0)
    };
  }

  function spawnUnit(type, team, x, y){
    const u = makeUnit(type, team, x, y, 100);
    G.state.units.push(u);
    return u;
  }

  function moveUnitTo(unit, nx, ny){
    const ox = unit.x, oy = unit.y;
    if(nx !== ox || ny !== oy){
      G.resetCapOnLeave(unit, ox, oy);
      unit.x = nx; unit.y = ny;
      G.audio && G.audio.play('move');
    }
  }

  function startMatch(){
    G.state = newState();
    G.state.phase = PHASE.PLAY;
    log('system', 'Boot sequence complete.');
    log('red',    `Turn 1 — RED CHROME — income +${G.startOfTurnIncome('red')}`);
    startOfTurnShrines('red');
    G.audio && G.audio.startMusic('battle');
    G.ui.show('game');
    G.ui.refreshAll();
  }

  function endMatch(winnerTeam){
    const s = G.state;
    s.phase = PHASE.GAMEOVER;
    s.winnerTeam = winnerTeam;
    G.audio && G.audio.stopMusic();
    G.audio && G.audio.play(winnerTeam==='red' ? 'victory' : 'defeat');
    G.ui.showGameOver(winnerTeam);
  }

  function endTurn(){
    const s = G.state;
    if(s.phase !== PHASE.PLAY) return;
    // clear turn-scoped effects for the player whose turn is ending
    G.apex && G.apex.clearTurnEffects(s.activeTeam);
    // reset moved flags for OPP side, respecting Chrono-lag
    const other = s.activeTeam === 'red' ? 'blue' : 'red';
    for(const u of s.units){
      if(u.team!==other) continue;
      if(u.lagged){ u.moved = true; u.lagged = false; }
      else u.moved = false;
    }
    s.activeTeam = other;
    if(other === 'red') s.turnNum++;
    s.selected = null; s.movePreview = null; s.attackPreview = null; s.pendingMove = null;
    const income = G.startOfTurnIncome(other);
    // Shrine regen + crystal claims at start of turn
    startOfTurnShrines(other);
    log(other, `Turn ${s.turnNum} — ${other==='red'?'RED CHROME':'BLUE NEON'} — income +${income}`);
    G.audio && G.audio.play('endturn');

    // Check win conditions at start-of-turn
    const w = G.winner();
    if(w){ endMatch(w); return; }

    G.ui.refreshAll();

    if(other === 'blue'){
      // AI plays
      setTimeout(()=>{
        G.runAITurn(null, ()=>{
          G.removeDeadUnits();
          const w2 = G.winner();
          if(w2){ endMatch(w2); return; }
          // auto end turn back to red
          endTurn();
        });
      }, 450);
    }
  }

  function startOfTurnShrines(team){
    const s = G.state;
    for(let y=0;y<s.map.H;y++){
      for(let x=0;x<s.map.W;x++){
        const t = s.map.tiles[y][x];
        if(t.type !== 'shrine') continue;
        // Regen expired crystal
        if(!t.crystal && s.turnNum >= t.regenAt){
          t.crystal = G.rollCrystal();
        }
        // Claim: unit of active team standing here, no crystal yet
        if(!t.crystal) continue;
        const u = G.unitAt(x,y);
        if(u && u.team === team && !u.crystal){
          u.crystal = t.crystal;
          t.crystal = null;
          t.regenAt = s.turnNum + 4;
          const cdef = G.CRYSTALS[u.crystal];
          log(team, `${u.def.name} claimed ${cdef.name}`);
          G.audio && G.audio.play('capture');
        }
      }
    }
  }

  function useCrystal(unit, targetTile){
    const s = G.state;
    if(!unit.crystal) return false;
    const ckey = unit.crystal;
    const cdef = G.CRYSTALS[ckey];
    if(!cdef) return false;

    if(ckey === 'graft'){
      unit.hp = 100;
      unit.moved = false;
      G.log(unit.team, `${unit.def.name} used GRAFT SURGE (heal + act again)`);
      G.audio && G.audio.play('capture');
      unit.crystal = null;
      return true;
    }
    if(ckey === 'echo'){
      s.fossilEcho = { team: unit.team, expiresAtTurn: s.turnNum + 2 };
      G.log(unit.team, `${unit.def.name} used FOSSIL ECHO — enemy auras revealed`);
      G.audio && G.audio.play('build');
      unit.crystal = null;
      return true;
    }
    if(!targetTile) return false;
    const {x:tx, y:ty} = targetTile;

    if(ckey === 'seismic'){
      let hits = 0;
      for(const u of s.units){
        if(u.dead || u.team===unit.team) continue;
        const d = Math.max(Math.abs(u.x-tx), Math.abs(u.y-ty));
        if(d <= 1){
          u.hp -= 30;
          hits++;
          if(u.hp<=0){ u.hp=0; u.dead=true; G.log(unit.team, `${u.def.name} shattered by SEISMIC`); }
          else G.log(unit.team, `${u.def.name} rocked (-30)`);
        }
      }
      G.removeDeadUnits();
      G.audio && G.audio.play('explode');
      unit.crystal = null;
      return true;
    }
    if(ckey === 'chrono'){
      const target = G.unitAt(tx, ty);
      if(!target || target.team === unit.team) return false;
      target.lagged = true;
      G.log(unit.team, `${target.def.name} locked in CHRONO LAG`);
      G.audio && G.audio.play('deny');
      unit.crystal = null;
      return true;
    }
    return false;
  }

  function log(kind, msg){
    const s = G.state;
    if(!s) return;
    s.log.push({ kind, msg, t: Date.now() });
    if(s.log.length > 80) s.log.shift();
    G.ui && G.ui.refreshLog();
  }

  G.PHASE = PHASE;
  G.newState = newState;
  G.makeUnit = makeUnit;
  G.spawnUnit = spawnUnit;
  G.moveUnitTo = moveUnitTo;
  G.startMatch = startMatch;
  G.endMatch = endMatch;
  G.endTurn = endTurn;
  G.useCrystal = useCrystal;
  G.startOfTurnShrines = startOfTurnShrines;
  G.log = log;
})();
