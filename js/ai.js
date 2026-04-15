// Heuristic AI for the blue team.
(function(){
  const G = window.Game = window.Game || {};

  function runAITurn(onStep, onDone){
    const s = G.state;
    const team = s.activeTeam; // should be 'blue' when called
    // 1. Produce at factories if funds allow and unit count low
    tryBuild(team);

    // 2. For each of our units (copy list since it may mutate):
    const mine = s.units.filter(u=>u.team===team && !u.moved && !u.dead).slice();
    // sort: infantry last so combat units lead the line
    mine.sort((a,b)=> (a.def.isInfantry?1:0) - (b.def.isInfantry?1:0));

    let i = 0;
    const next = () => {
      if(i>=mine.length){ onDone && onDone(); return; }
      const u = mine[i++];
      if(u.dead || u.moved){ setTimeout(next, 10); return; }
      actForUnit(u);
      setTimeout(next, 240); // pacing for readability
    };
    next();
  }

  function tryBuild(team){
    const s = G.state;
    const unitCount = s.units.filter(u=>u.team===team && !u.dead).length;
    if(unitCount >= 8) return;
    // find empty own factories
    for(let y=0;y<s.map.H;y++){
      for(let x=0;x<s.map.W;x++){
        const t = s.map.tiles[y][x];
        if(t.building==='factory' && t.team===team){
          if(G.unitAt(x,y)) continue;
          // pick best unit we can afford
          const picks = ['trike','rex','stego','ptero','raptor'];
          for(const k of picks){
            const ud = G.UNITS[k];
            if(s.funds[team] >= ud.cost){
              const u = G.spawnUnit(k, team, x, y);
              u.moved = true; // built units wait
              s.funds[team] -= ud.cost;
              G.log(team, `Built ${ud.name}`);
              G.audio && G.audio.play('build');
              return;
            }
          }
        }
      }
    }
  }

  function actForUnit(u){
    const s = G.state;
    // 1. Compute reachable
    const reach = G.reachable(u);
    const enemies = s.units.filter(x=>x.team!==u.team && !x.dead);
    let best = null;

    // KILLING BLOW: pick reach tile that lets us kill an enemy this turn
    for(const tile of reach){
      // indirect: can't attack after moving
      if(u.def.indirect && (tile.x!==u.x || tile.y!==u.y)) continue;
      const targets = G.attackTargetsFromHypothetical(u, tile.x, tile.y, enemies);
      for(const t of targets){
        // simulate
        const pseudo = Object.assign({}, u, {x:tile.x, y:tile.y});
        const dmg = G.damageFrom(pseudo, t.unit);
        const kills = dmg >= t.unit.hp;
        const score = dmg * (kills?3:1) + (kills ? 500 : 0) - (t.unit.def.cost/50);
        if(!best || score > best.score){
          best = { kind:'attack', tile, target:t, score };
        }
      }
    }

    // CAPTURE: infantry on enemy/neutral building within reach
    if(u.def.canCapture){
      for(const tile of reach){
        const t = G.getTile(tile.x,tile.y);
        if(t.building && t.team !== u.team){
          const other = G.unitAt(tile.x,tile.y);
          if(other && other!==u) continue;
          const score = 800 + (t.building==='hq'?500:0) - tile.cost*2;
          if(!best || score > best.score) best = { kind:'capture', tile, score };
        }
      }
    }

    // MOVE TOWARD HIGH-VALUE TARGET if no attack/capture found
    if(!best){
      // target = nearest enemy unit (weakest weighted) / enemy HQ for infantry
      let targetPoint = null;
      let bestD = Infinity;
      if(u.def.canCapture){
        // head to enemy HQ or factories
        for(let y=0;y<s.map.H;y++){
          for(let x=0;x<s.map.W;x++){
            const t = s.map.tiles[y][x];
            if(t.building && t.team!==u.team){
              const d = Math.abs(x-u.x)+Math.abs(y-u.y);
              const weight = t.building==='hq'?0.5: t.building==='factory'?0.7:1;
              const score = d*weight;
              if(score < bestD){ bestD = score; targetPoint = {x,y}; }
            }
          }
        }
      }
      if(!targetPoint){
        for(const e of enemies){
          const d = Math.abs(e.x-u.x)+Math.abs(e.y-u.y);
          const wf = e.hp/100;  // prefer weak
          const score = d + wf*3;
          if(score < bestD){ bestD = score; targetPoint = {x:e.x,y:e.y}; }
        }
      }
      if(targetPoint){
        // among reachable tiles, pick one minimizing manhattan to targetPoint
        let nearest = reach[0];
        let nBest = Infinity;
        for(const tile of reach){
          if(G.unitAt(tile.x,tile.y) && !(tile.x===u.x && tile.y===u.y)) continue;
          const d = Math.abs(tile.x-targetPoint.x)+Math.abs(tile.y-targetPoint.y);
          if(d < nBest){ nBest = d; nearest = tile; }
        }
        best = { kind:'move', tile:nearest };
      }
    }

    if(!best){ u.moved = true; return; }

    // Execute
    G.moveUnitTo(u, best.tile.x, best.tile.y);
    if(best.kind==='attack'){
      // target may have been stale; re-find at same pos
      const t = G.unitAt(best.target.x, best.target.y);
      if(t){
        const res = G.attack(u, t);
        const nm = u.def.moveType === 'tread' || u.def.moveType==='air' ? 'attack_heavy':'attack_light';
        G.audio && G.audio.play(nm);
        if(res.dealt>0) G.log(u.team, `${u.def.name} → ${t.def.name} (-${res.dealt})`);
        if(t.dead){ G.audio && G.audio.play('explode'); G.log(u.team, `${t.def.name} destroyed`); }
        if(res.counter>0){ G.log(t.team || 'system', `counter (-${res.counter})`); }
        if(u.dead){ G.audio && G.audio.play('explode'); G.log('system', `${u.def.name} destroyed in counter`); }
      }
    } else if(best.kind==='capture'){
      const tile = G.getTile(u.x, u.y);
      const r = G.capture(u, tile);
      G.audio && G.audio.play('capture');
      if(r==='captured') G.log(u.team, `${tile.building.toUpperCase()} captured`);
      else if(r==='progress') G.log(u.team, `capturing ${tile.building}... (${tile.capHP})`);
    }
    u.moved = true;
    G.removeDeadUnits();
  }

  // attack-from-hypothetical pos (for planning)
  G.attackTargetsFromHypothetical = function(unit, px, py, enemies){
    const rangeMin = unit.def.minRange||1;
    const rangeMax = unit.def.range||1;
    const list = [];
    for(const e of enemies){
      if(e.dead) continue;
      const d = Math.abs(e.x-px)+Math.abs(e.y-py);
      if(d>=rangeMin && d<=rangeMax){
        list.push({x:e.x,y:e.y,unit:e});
      }
    }
    return list;
  };

  G.runAITurn = runAITurn;
})();
