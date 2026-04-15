// Apex Commanders — passives and charge-based ultimates.
(function(){
  const G = window.Game = window.Game || {};

  const APEX = {
    viridian: {
      key: 'viridian',
      name: 'VIRIDIAN',
      title: 'Raptor-Prime · the Veiled',
      color: '#b5ff3d',
      passiveDesc: 'All infantry +1 move',
      ultName: 'PHASE SHIFT',
      ultDesc: 'Your infantry get +3 move, no counterattack, this turn',
      ultKind: 'self',
    },
    tarsus: {
      key: 'tarsus',
      name: 'TARSUS',
      title: 'Forge-Master · the Mender',
      color: '#ffcc3d',
      passiveDesc: 'Buildings heal +30 HP; unit cost −10%',
      ultName: 'RESURRECTION FORGE',
      ultDesc: 'All your units heal to full HP instantly',
      ultKind: 'self',
    },
    nova: {
      key: 'nova',
      name: 'NOVA',
      title: 'Storm-Prime · the Detonator',
      color: '#19e6ff',
      passiveDesc: 'Ptero +20% damage; +1 range when firing from road',
      ultName: 'STORMCALL',
      ultDesc: 'Pick a tile — 35 damage in a 3×3 zone',
      ultKind: 'target',
    },
    throat: {
      key: 'throat',
      name: 'THROAT',
      title: 'Alpha Rex · the Crusher',
      color: '#ff2f85',
      passiveDesc: 'Heavy units −1500 cost; counters +25% damage',
      ultName: 'BERSERK SURGE',
      ultDesc: 'All your unmoved units get to act again this turn',
      ultKind: 'self',
    }
  };

  // --- Passive hook helpers ---

  // Infantry move bonus for Viridian.
  function moveBonus(unit){
    const apx = G.state && G.state.apex && G.state.apex[unit.team];
    let bonus = 0;
    if(apx === 'viridian' && unit.def.isInfantry) bonus += 1;
    // turn-scoped Phase Shift stacks
    if(G.state && G.state.turnEffects && G.state.turnEffects[unit.team] && G.state.turnEffects[unit.team].phaseShift && unit.def.isInfantry){
      bonus += 3;
    }
    return bonus;
  }

  // Cost discount for Tarsus / Throat.
  function unitCost(unitKey, team){
    const base = G.UNITS[unitKey].cost;
    const apx = G.state && G.state.apex && G.state.apex[team];
    if(apx === 'tarsus') return Math.round(base * 0.9);
    if(apx === 'throat' && (unitKey==='rex'||unitKey==='trike'||unitKey==='stego')){
      return Math.max(500, base - 1500);
    }
    return base;
  }

  // Heal amount when parked on friendly building.
  function healAmount(team){
    const apx = G.state && G.state.apex && G.state.apex[team];
    return apx === 'tarsus' ? 30 : 20;
  }

  // Extra damage multiplier (Nova ptero, Throat counter).
  function damageBonus(attacker, isCounter){
    let m = 1.0;
    const apx = G.state && G.state.apex && G.state.apex[attacker.team];
    if(apx === 'nova' && attacker.def.isAir) m *= 1.20;
    if(apx === 'throat' && isCounter) m *= 1.25;
    return m;
  }

  // Counter-immunity (Viridian Phase Shift target).
  function counterImmune(target){
    const te = G.state && G.state.turnEffects && G.state.turnEffects[target.team];
    return !!(te && te.phaseShift && target.def.isInfantry);
  }

  // Nova road-firing +1 range (not re-used in plan since it's easy to forget, but
  // hook is here for future combat.js to call).
  function rangeBonus(attacker){
    const apx = G.state && G.state.apex && G.state.apex[attacker.team];
    if(apx === 'nova'){
      const tile = G.getTile(attacker.x, attacker.y);
      if(tile && tile.type === 'road') return 1;
    }
    return 0;
  }

  // --- Charge ---
  function addCharge(team, amount){
    const s = G.state;
    if(!s || !s.charge) return;
    s.charge[team] = Math.min(10, Math.max(0, (s.charge[team]||0) + amount));
  }

  // --- Ultimates ---
  function canCast(team){
    return G.state && (G.state.charge[team]||0) >= 10;
  }

  // Returns true on success.
  function castSelf(team, targetTile){
    if(!canCast(team)) return false;
    const apx = G.state.apex[team];
    const def = APEX[apx];
    if(!def) return false;
    let used = false;

    if(apx === 'viridian'){
      ensureTurnEffects();
      G.state.turnEffects[team].phaseShift = true;
      used = true;
      G.log && G.log(team, `${def.name} casts ${def.ultName} — phase cloak engaged`);
    } else if(apx === 'tarsus'){
      for(const u of G.state.units){ if(u.team===team && !u.dead) u.hp = 100; }
      used = true;
      G.log && G.log(team, `${def.name} casts ${def.ultName} — all units reforged`);
    } else if(apx === 'throat'){
      for(const u of G.state.units){ if(u.team===team && !u.dead) u.moved = false; }
      used = true;
      G.log && G.log(team, `${def.name} casts ${def.ultName} — alpha roar shakes the map`);
    } else if(apx === 'nova'){
      if(!targetTile) return false;
      const {x:tx, y:ty} = targetTile;
      const hit = [];
      for(const u of G.state.units){
        if(u.dead) continue;
        const d = Math.max(Math.abs(u.x-tx), Math.abs(u.y-ty));
        if(d <= 1){
          const dmg = 35;
          u.hp -= dmg;
          hit.push({name:u.def.name, team:u.team, dmg, dead:u.hp<=0});
          if(u.hp<=0){ u.hp=0; u.dead=true; }
        }
      }
      G.removeDeadUnits && G.removeDeadUnits();
      used = true;
      G.log && G.log(team, `${def.name} calls STORMCALL at (${tx},${ty})`);
      hit.forEach(h=>G.log && G.log(h.team, `  ${h.name} hit (-${h.dmg})${h.dead?' [lost]':''}`));
    }

    if(used){
      G.state.charge[team] = 0;
      G.state.ultsUsed[team] = (G.state.ultsUsed[team]||0) + 1;
      G.audio && G.audio.play('capture');
      G.audio && G.audio.play('explode');
    }
    return used;
  }

  function ensureTurnEffects(){
    if(!G.state.turnEffects) G.state.turnEffects = { red:{}, blue:{} };
  }

  function clearTurnEffects(team){
    if(!G.state.turnEffects) return;
    G.state.turnEffects[team] = {};
  }

  G.APEX = APEX;
  G.apex = {
    moveBonus, unitCost, healAmount, damageBonus, counterImmune, rangeBonus,
    addCharge, canCast, castSelf, clearTurnEffects, ensureTurnEffects
  };
})();
