// Map data + builder. 14x10 grid of Tile objects.
(function(){
  const G = window.Game = window.Game || {};

  // Terrain types: plains, forest, mountain, road, water, ground (for buildings)
  // Building types on top: hq, factory, base
  const TERRAIN_DEF = {
    plains:   { def:0, name:'PLAINS',   lore:'Open ground. No cover.' },
    forest:   { def:2, name:'FOREST',   lore:'Canopy gives cover. Slows tanks.' },
    mountain: { def:4, name:'MOUNTAIN', lore:'Impassable to tanks and tread units.' },
    road:     { def:0, name:'CIRCUIT ROAD', lore:'Fast lane. Cuts move cost.' },
    water:    { def:0, name:'WATER',    lore:'Only air can cross.' },
    ground:   { def:3, name:'STRUCTURE',lore:'Fortified platform.' },
  };

  const BUILDING_DEF = {
    hq:      { def:4, name:'HQ',       income:1000, capMax:20, capturable:true,
               lore:'Command spine. Capture it to win.' },
    factory: { def:3, name:'HATCHERY', income:1000, capMax:20, capturable:true,
               lore:'Breeds units. Capture to flip production.' },
    base:    { def:3, name:'OUTPOST',  income:1000, capMax:20, capturable:true,
               lore:'Captured income point.' }
  };

  // Hand-authored symmetric 14x10 map
  // Legend: . plains, F forest, M mountain, R road, W water
  //         * base, % factory, # HQ (team via coord)
  const ROWS = [
    /* 0 */ 'M..F........#.',
    /* 1 */ '...F....R.F.%.',
    /* 2 */ '.*.RR...R..FF.',
    /* 3 */ '....R...R.*...',
    /* 4 */ '...FRWWWWRF...',
    /* 5 */ '...FRWWWWRF...',
    /* 6 */ '...*.R...R....',
    /* 7 */ '.FF..R...RR.*.',
    /* 8 */ '.%.F.R........',
    /* 9 */ '.#........F..M'
  ];

  function build(){
    const W = 14, H = 10;
    const tiles = [];
    for(let y=0;y<H;y++){
      const row = ROWS[y];
      const tr = [];
      for(let x=0;x<W;x++){
        const ch = row[x] || '.';
        let type='plains', building=null, team='neutral';
        if(ch==='.') type='plains';
        else if(ch==='F') type='forest';
        else if(ch==='M') type='mountain';
        else if(ch==='R') type='road';
        else if(ch==='W') type='water';
        else if(ch==='*'){ type='ground'; building='base'; team='neutral'; }
        else if(ch==='%'){ type='ground'; building='factory'; team = (y>=5)?'red':'blue'; }
        else if(ch==='#'){ type='ground'; building='hq'; team = (y>=5)?'red':'blue'; }
        tr.push({
          x,y, type, building, team,
          originalTeam: team,
          capHP: building ? BUILDING_DEF[building].capMax : 0
        });
      }
      tiles.push(tr);
    }
    // starting units: place one raptor and one rex per side near HQ
    const startUnits = [
      {type:'raptor', team:'red',  x:2,  y:9, hp:100},
      {type:'rex',    team:'red',  x:2,  y:8, hp:100},
      {type:'trike',  team:'red',  x:3,  y:9, hp:100},
      {type:'raptor', team:'blue', x:11, y:0, hp:100},
      {type:'rex',    team:'blue', x:11, y:1, hp:100},
      {type:'trike',  team:'blue', x:10, y:0, hp:100},
    ];
    return { W, H, tiles, startUnits };
  }

  G.TERRAIN_DEF = TERRAIN_DEF;
  G.BUILDING_DEF = BUILDING_DEF;
  G.buildMap = build;
})();
