// Movement, attacks, capture resolution.
(function(){
  const G = window.Game = window.Game || {};

  function state(){ return G.state; }

  function getTile(x,y){
    const s = state();
    if(x<0||y<0||x>=s.map.W||y>=s.map.H) return null;
    return s.map.tiles[y][x];
  }
  function unitAt(x,y){
    return state().units.find(u => !u.dead && u.x===x && u.y===y) || null;
  }

  // BFS reachable tiles with move budget
  function reachable(unit){
    const s = state();
    const start = {x:unit.x, y:unit.y};
    const out = { paths: new Map() }; // key "x,y" -> {cost, from}
    const key = (x,y)=>x+','+y;
    const budget = unit.def.move;
    const q = [[start.x,start.y,0]];
    out.paths.set(key(start.x,start.y), {cost:0, from:null});
    while(q.length){
      const [x,y,c] = q.shift();
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for(const [dx,dy] of dirs){
        const nx=x+dx, ny=y+dy;
        const tile = getTile(nx,ny);
        if(!tile) continue;
        if(!G.canMoveOn(unit, tile)) continue;
        const other = unitAt(nx,ny);
        if(other && other.team !== unit.team) continue;    // enemy blocks
        const cost = c + G.moveCost(unit, tile);
        if(cost > budget) continue;
        const k = key(nx,ny);
        const prev = out.paths.get(k);
        if(!prev || cost < prev.cost){
          out.paths.set(k, {cost, from:{x,y}});
          q.push([nx,ny,cost]);
        }
      }
    }
    // remove occupied-by-friend (can move through but not end on)
    const reachableList = [];
    for(const [k, rec] of out.paths){
      const [xs,ys] = k.split(',').map(Number);
      if(xs===unit.x && ys===unit.y){
        reachableList.push({x:xs,y:ys,cost:0});
        continue;
      }
      const other = unitAt(xs,ys);
      if(other && !(xs===unit.x && ys===unit.y)) continue; // friend blocks ending
      reachableList.push({x:xs,y:ys,cost:rec.cost});
    }
    return reachableList;
  }

  // Where can this unit attack FROM tile (px,py)?
  function attackTargetsFrom(unit, px, py){
    const s = state();
    const rangeMin = unit.def.minRange || 1;
    const rangeMax = unit.def.range || 1;
    const list = [];
    for(let ty=0;ty<s.map.H;ty++){
      for(let tx=0;tx<s.map.W;tx++){
        const dist = Math.abs(tx-px) + Math.abs(ty-py);
        if(dist < rangeMin || dist > rangeMax) continue;
        const tgt = unitAt(tx,ty);
        if(tgt && tgt.team !== unit.team){
          list.push({x:tx,y:ty,unit:tgt});
        }
      }
    }
    return list;
  }

  function damageFrom(atk, def){
    const base = G.DMG[atk.def.key][def.def.key];
    if(base == null) return 0;
    const atkHpFactor = atk.hp/100;                          // weak attackers hit softer
    const defTile = getTile(def.x, def.y);
    const defT = G.TERRAIN_DEF[defTile.type];
    const defB = defTile.building ? G.BUILDING_DEF[defTile.building] : null;
    const tBonus = (defB ? defB.def : defT.def) || 0;        // 0..4
    const tMul = 1 - (tBonus * 0.05);                         // up to -20% at mountain
    const rnd = 0.9 + Math.random()*0.2;                     // small luck
    const dmg = base * atkHpFactor * tMul * rnd;
    return Math.max(0, Math.round(dmg));
  }

  // Apply an attack (attacker already at px,py). Handles counter.
  function attack(attacker, target){
    const dealt = damageFrom(attacker, target);
    target.hp -= dealt;
    let counter = 0;
    if(target.hp <= 0){
      target.hp = 0;
      target.dead = true;
    } else {
      // counter if within direct range and attacker is direct (not indirect)
      if(!attacker.def.indirect){
        const inRange = Math.abs(attacker.x - target.x) + Math.abs(attacker.y - target.y) <= (target.def.range||1)
                     && (target.def.minRange||1) === 1;
        if(inRange && G.DMG[target.def.key] && G.DMG[target.def.key][attacker.def.key] != null){
          counter = damageFrom(target, attacker);
          attacker.hp -= counter;
          if(attacker.hp <= 0){ attacker.hp = 0; attacker.dead = true; }
        }
      }
    }
    return { dealt, counter };
  }

  // Capture: infantry on enemy/neutral building chips cap points equal to HP/10
  function capture(unit, tile){
    if(!unit.def.canCapture) return false;
    if(!tile.building) return false;
    if(tile.team === unit.team) return false;
    const points = Math.max(1, Math.floor(unit.hp/10));
    tile.capHP -= points;
    if(tile.capHP <= 0){
      tile.team = unit.team;
      tile.capHP = G.BUILDING_DEF[tile.building].capMax;
      return 'captured';
    }
    return 'progress';
  }

  function resetCapOnLeave(unit, oldX, oldY){
    // if infantry leaves a building they were capturing, reset cap
    const t = getTile(oldX, oldY);
    if(t && t.building && t.team !== unit.team && t.capHP < G.BUILDING_DEF[t.building].capMax){
      t.capHP = G.BUILDING_DEF[t.building].capMax;
    }
  }

  function removeDeadUnits(){
    const s = state();
    const deadList = s.units.filter(u=>u.dead);
    s.units = s.units.filter(u => !u.dead);
    return deadList;
  }

  function winner(){
    const s = state();
    // HQ captured?
    for(let y=0;y<s.map.H;y++){
      for(let x=0;x<s.map.W;x++){
        const t = s.map.tiles[y][x];
        if(t.building==='hq' && t.originalTeam==='blue' && t.team!=='blue') return 'red';
        if(t.building==='hq' && t.originalTeam==='red'  && t.team!=='red')  return 'blue';
      }
    }
    // elimination
    const redUnits = s.units.filter(u=>u.team==='red' && !u.dead).length;
    const blueUnits = s.units.filter(u=>u.team==='blue' && !u.dead).length;
    const redCanBuy = s.funds.red >= 1000 && ownsProduction(s,'red');
    const blueCanBuy = s.funds.blue >= 1000 && ownsProduction(s,'blue');
    if(redUnits===0 && !redCanBuy) return 'blue';
    if(blueUnits===0 && !blueCanBuy) return 'red';
    return null;
  }

  function ownsProduction(s, team){
    for(let y=0;y<s.map.H;y++){
      for(let x=0;x<s.map.W;x++){
        const t = s.map.tiles[y][x];
        if((t.building==='factory' || t.building==='hq') && t.team===team) return true;
      }
    }
    return false;
  }

  function startOfTurnIncome(team){
    const s = state();
    let income = 0;
    for(let y=0;y<s.map.H;y++){
      for(let x=0;x<s.map.W;x++){
        const t = s.map.tiles[y][x];
        if(t.building && t.team===team){
          income += G.BUILDING_DEF[t.building].income;
          // heal friendly unit parked on own building
          const u = unitAt(x,y);
          if(u && u.team===team && u.hp<100){ u.hp = Math.min(100, u.hp + 20); }
        }
      }
    }
    s.funds[team] += income;
    return income;
  }

  G.getTile = getTile;
  G.unitAt = unitAt;
  G.reachable = reachable;
  G.attackTargetsFrom = attackTargetsFrom;
  G.damageFrom = damageFrom;
  G.attack = attack;
  G.capture = capture;
  G.resetCapOnLeave = resetCapOnLeave;
  G.removeDeadUnits = removeDeadUnits;
  G.winner = winner;
  G.startOfTurnIncome = startOfTurnIncome;
})();
