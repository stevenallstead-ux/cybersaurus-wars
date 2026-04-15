// HUD updates, panels, modal, buy menu, action menu, log rendering.
(function(){
  const G = window.Game = window.Game || {};

  const ui = {};

  const $ = id => document.getElementById(id);

  ui.show = function(screen){
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if(screen==='title') $('title-screen').classList.add('active');
    if(screen==='game')  $('game-screen').classList.add('active');
  };

  ui.refreshAll = function(){
    refreshHud();
    refreshUnitPanel();
    ui.refreshLog();
  };

  function refreshHud(){
    const s = G.state; if(!s) return;
    $('hud-turn-num').textContent = s.turnNum;
    $('hud-active-player').textContent = s.activeTeam==='red' ? 'RED CHROME' : 'BLUE NEON';
    const top = $('hud-top');
    top.classList.toggle('red-turn', s.activeTeam==='red');
    top.classList.toggle('blue-turn', s.activeTeam==='blue');
    const showingTeam = 'red';     // always show human player funds prominently
    $('hud-funds').textContent     = s.funds.red.toLocaleString();
    $('hud-enemy-funds').textContent = s.funds.blue.toLocaleString();
  }

  function refreshUnitPanel(){
    const s = G.state; if(!s) return;
    const u = s.selected;
    const panel = $('panel-unit');
    const tpanel = $('panel-terrain');
    if(u){
      panel.classList.remove('hidden');
      $('pu-name').textContent = u.def.name + ' · ' + (u.team==='red'?'RED':'BLUE');
      $('pu-hp').textContent = u.hp;
      $('pu-move').textContent = u.def.move;
      $('pu-atk').textContent = u.def.indirect ? 'IND' : 'DIR';
      $('pu-rng').textContent = u.def.range === 1 ? '1' : `${u.def.minRange}-${u.def.range}`;
      $('pu-lore').textContent = u.def.lore;
    } else {
      panel.classList.add('hidden');
    }
    // terrain panel under hovered cell
    const hc = s.hoveredCell;
    if(hc){
      const t = G.getTile(hc.x, hc.y);
      if(t){
        tpanel.classList.remove('hidden');
        if(t.building){
          const bd = G.BUILDING_DEF[t.building];
          $('pt-name').textContent = bd.name + ' · ' + (t.team==='neutral'?'NEUTRAL':t.team.toUpperCase());
          $('pt-def').textContent = bd.def;
          $('pt-move').textContent = '1';
          let capLore = '';
          if(t.capHP < bd.capMax){ capLore = ` · cap ${t.capHP}/${bd.capMax}`; }
          $('pt-lore').textContent = bd.lore + capLore;
        } else {
          const td = G.TERRAIN_DEF[t.type];
          $('pt-name').textContent = td.name;
          $('pt-def').textContent = td.def;
          $('pt-move').textContent = t.type==='road'?'1':t.type==='forest'?'2':t.type==='water'?'∞':'1';
          $('pt-lore').textContent = td.lore;
        }
      } else tpanel.classList.add('hidden');
    } else tpanel.classList.add('hidden');
  }

  ui.refreshLog = function(){
    const s = G.state; if(!s) return;
    const list = $('log-list');
    list.innerHTML = '';
    for(let i=Math.max(0, s.log.length-14); i<s.log.length; i++){
      const e = s.log[i];
      const li = document.createElement('li');
      li.className = e.kind;
      li.textContent = e.msg;
      list.appendChild(li);
    }
  };

  ui.showFactoryMenu = function(tile){
    const s = G.state;
    const panel = $('panel-factory');
    const list = $('buy-list');
    list.innerHTML = '';
    const affordOrder = ['raptor','rex','stego','trike','ptero'];
    for(const k of affordOrder){
      const def = G.UNITS[k];
      const row = document.createElement('div');
      const can = s.funds[s.activeTeam] >= def.cost;
      row.className = 'buy-row' + (can?'':' disabled');
      const thumb = G.sprites[k][s.activeTeam];
      const tc = document.createElement('canvas');
      tc.width=28; tc.height=28; tc.className='bthumb';
      tc.getContext('2d').drawImage(thumb, 0,0,48,48, 0,0,28,28);
      row.appendChild(tc);
      const label = document.createElement('div');
      label.textContent = def.name;
      row.appendChild(label);
      const cost = document.createElement('div');
      cost.className='bcost';
      cost.textContent = '§' + def.cost;
      row.appendChild(cost);
      if(can){
        row.addEventListener('click', ()=>{
          s.funds[s.activeTeam] -= def.cost;
          const u = G.spawnUnit(k, s.activeTeam, tile.x, tile.y);
          u.moved = true;
          G.log(s.activeTeam, `Built ${def.name} (-§${def.cost})`);
          G.audio && G.audio.play('build');
          ui.hideFactoryMenu();
          refreshHud();
          window.__rerender && window.__rerender();
        });
      }
      list.appendChild(row);
    }
    panel.classList.remove('hidden');
  };
  ui.hideFactoryMenu = function(){ $('panel-factory').classList.add('hidden'); };

  ui.showActionMenu = function(opts){
    // opts: { canAttack, canCapture, onAction(name) }
    const panel = $('panel-action');
    panel.classList.remove('hidden');
    $('act-attack').disabled = !opts.canAttack;
    $('act-capture').disabled = !opts.canCapture;
    panel.querySelectorAll('.action-btn').forEach(btn => {
      btn.onclick = () => opts.onAction(btn.dataset.action);
    });
  };
  ui.hideActionMenu = function(){ $('panel-action').classList.add('hidden'); };

  ui.showGameOver = function(team){
    const s = G.state;
    const el = $('gameover');
    const titleEl = $('go-title');
    const subEl = $('go-sub');
    const statsEl = $('go-stats');
    const win = team==='red';
    titleEl.textContent = win ? 'VICTORY' : 'DEFEAT';
    titleEl.className = 'go-title ' + (win?'win':'lose');
    subEl.textContent = win
      ? 'RED CHROME CLAIMS THE MESOZOIC'
      : 'BLUE NEON DATA-PRINTS YOUR BONES';
    const redAlive = s.units.filter(u=>u.team==='red' && !u.dead).length;
    const blueAlive = s.units.filter(u=>u.team==='blue' && !u.dead).length;
    statsEl.innerHTML =
      `turns: <b>${s.turnNum}</b> · funds red: <b>§${s.funds.red}</b> · blue: <b>§${s.funds.blue}</b><br>` +
      `units standing — red <b>${redAlive}</b> · blue <b>${blueAlive}</b>`;
    el.classList.remove('hidden');
  };
  ui.hideGameOver = function(){ $('gameover').classList.add('hidden'); };

  ui.bindTitleStart = function(cb){ $('btn-start').addEventListener('click', cb); };
  ui.bindPlayAgain  = function(cb){ $('btn-again').addEventListener('click', cb); };
  ui.bindEndTurn    = function(cb){ $('btn-end-turn').addEventListener('click', cb); };
  ui.bindFactoryClose = function(cb){ $('btn-factory-close').addEventListener('click', cb); };

  // expose
  G.ui = ui;
  G.ui.refreshHud = refreshHud;
  G.ui.refreshUnit = refreshUnitPanel;
})();
