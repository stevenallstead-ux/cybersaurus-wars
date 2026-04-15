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
      movePreview: null,    // {paths: [{x,y,cost}], unit}
      attackPreview: null,  // after choosing a move tile: list of attackable enemies
      pendingMove: null,    // {unit, tx, ty} — selected target but not confirmed (action menu)
      log: [],
      winnerTeam: null,
    };
    return s;
  }

  function makeUnit(type, team, x, y, hp){
    const def = G.UNITS[type];
    return {
      id: (Math.random()*1e9)|0,
      type, def, team, x, y,
      hp: hp != null ? hp : 100,
      moved: false,
      dead: false
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
    // reset moved flags for OPP side
    const other = s.activeTeam === 'red' ? 'blue' : 'red';
    for(const u of s.units){ if(u.team===other) u.moved = false; }
    s.activeTeam = other;
    if(other === 'red') s.turnNum++;
    s.selected = null; s.movePreview = null; s.attackPreview = null; s.pendingMove = null;
    const income = G.startOfTurnIncome(other);
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
  G.log = log;
})();
