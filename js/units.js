// Unit definitions + damage matrix.
(function(){
  const G = window.Game = window.Game || {};

  // Unit definitions
  const UNITS = {
    raptor: {
      key:'raptor',
      name:'RAPTOR SCOUT',
      cost: 1000,
      hpMax: 100,
      move: 6,
      moveType: 'foot',      // can cross mountains
      range: 1,              // direct
      minRange: 1,
      canCapture: true,
      isInfantry: true,
      isAir: false,
      lore:'Feathered chassis, blade-toed reconnaissance unit. Captures objectives.'
    },
    rex: {
      key:'rex',
      name:'REX BRUISER',
      cost: 3000,
      hpMax: 100,
      move: 3,
      moveType: 'heavyfoot',
      range: 1,
      minRange: 1,
      canCapture: true,
      isInfantry: true,
      lore:'Chain-gun arm, reinforced plating. Can ground-chew airborne targets.'
    },
    trike: {
      key:'trike',
      name:'TRIKE TANK',
      cost: 7000,
      hpMax: 100,
      move: 6,
      moveType: 'tread',
      range: 1,
      minRange: 1,
      canCapture: false,
      lore:'Armored triceratops with a turret-dome. Crushes forests under treads.'
    },
    ptero: {
      key:'ptero',
      name:'PTERO JET',
      cost: 9000,
      hpMax: 100,
      move: 9,
      moveType: 'air',
      range: 1,
      minRange: 1,
      canCapture: false,
      isAir: true,
      lore:'Jet-winged pterosaur. Ignores terrain. Thin-skinned.'
    },
    stego: {
      key:'stego',
      name:'STEGO ARTILLERY',
      cost: 6000,
      hpMax: 100,
      move: 4,
      moveType: 'tread',
      range: 3,
      minRange: 2,
      canCapture: false,
      indirect: true,         // cannot attack after moving
      lore:'Spike-backed platform, twin shoulder cannons. Must stand still to fire.'
    }
  };

  // Base damage matrix: attacker -> defender -> base damage (percent HP removed at full health)
  const DMG = {
    raptor: { raptor:55, rex:45, trike:5,  ptero:0,  stego:55 },
    rex:    { raptor:65, rex:55, trike:15, ptero:75, stego:70 },
    trike:  { raptor:75, rex:70, trike:55, ptero:0,  stego:85 },
    ptero:  { raptor:80, rex:60, trike:45, ptero:55, stego:85 },
    stego:  { raptor:90, rex:85, trike:70, ptero:75, stego:60 },
  };

  function canMoveOn(unit, terrain){
    const t = terrain.type;
    if(unit.def.isAir) return true;             // air ignores all
    if(t==='water') return false;
    if(t==='mountain'){
      return unit.def.moveType==='foot';        // only raptors
    }
    return true;
  }

  function moveCost(unit, terrain){
    const t = terrain.type;
    if(unit.def.isAir) return 1;
    if(t==='road') return 1;
    if(t==='plains') return 1;
    if(t==='forest') return unit.def.moveType==='tread' ? 3 : 2;
    if(t==='mountain') return 2;
    if(t==='water') return 99;
    // buildings count as road
    return 1;
  }

  G.UNITS = UNITS;
  G.DMG = DMG;
  G.canMoveOn = canMoveOn;
  G.moveCost = moveCost;
})();
