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
    ui.refreshCharge && ui.refreshCharge();
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
      const rankName = u.rank ? u.rank.name : 'ROOKIE';
      const next = u.rank ? G.nextRank(u.rank) : null;
      const rankLabel = next ? `${rankName} · ${u.kills||0}/${next.threshold}` : `${rankName} · MAX`;
      const crystalTxt = u.crystal ? ` · ✦ ${G.CRYSTALS[u.crystal].name}` : '';
      $('pu-name').textContent = u.def.name + ' · ' + (u.team==='red'?'RED':'BLUE');
      $('pu-hp').textContent = u.hp;
      $('pu-move').textContent = u.def.move;
      $('pu-atk').textContent = u.def.indirect ? 'IND' : 'DIR';
      $('pu-rng').textContent = u.def.range === 1 ? '1' : `${u.def.minRange}-${u.def.range}`;
      $('pu-lore').textContent = rankLabel + crystalTxt + ' · ' + u.def.lore;
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
      const actualCost = G.apex ? G.apex.unitCost(k, s.activeTeam) : def.cost;
      const row = document.createElement('div');
      const can = s.funds[s.activeTeam] >= actualCost;
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
      cost.textContent = '§' + actualCost;
      if(actualCost !== def.cost) cost.style.color = '#b5ff3d';
      row.appendChild(cost);
      if(can){
        row.addEventListener('click', ()=>{
          s.funds[s.activeTeam] -= actualCost;
          const u = G.spawnUnit(k, s.activeTeam, tile.x, tile.y);
          u.moved = true;
          G.log(s.activeTeam, `Built ${def.name} (-§${actualCost})`);
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
    // opts: { canAttack, canCapture, hasCrystal, crystalName, onAction(name) }
    const panel = $('panel-action');
    panel.classList.remove('hidden');
    $('act-attack').disabled = !opts.canAttack;
    $('act-capture').disabled = !opts.canCapture;
    const cBtn = $('act-crystal');
    cBtn.disabled = !opts.hasCrystal;
    cBtn.textContent = opts.hasCrystal ? (opts.crystalName || 'CRYSTAL') : 'CRYSTAL';
    cBtn.style.color = opts.hasCrystal ? '#e2c2ff' : '';
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

  ui.renderApexCards = function(onPick){
    const container = $('apex-cards');
    if(!container || !G.APEX) return;
    container.innerHTML = '';
    const order = ['viridian','throat','nova','tarsus'];
    for(const key of order){
      const a = G.APEX[key];
      const card = document.createElement('div');
      card.className = 'apex-card';
      card.dataset.apex = key;
      card.innerHTML = `
        <div class="apex-name" style="color:${a.color};text-shadow:0 0 8px ${a.color}aa">${a.name}</div>
        <div class="apex-title">${a.title}</div>
        <div class="apex-passive"><span class="plbl">PASSIVE</span>${a.passiveDesc}</div>
        <div class="apex-ult"><span class="ulbl">${a.ultName}</span>${a.ultDesc}</div>`;
      card.addEventListener('click', ()=>{
        container.querySelectorAll('.apex-card').forEach(c=>c.classList.remove('selected'));
        card.classList.add('selected');
        window.__apexPick = { red:key, blue:randomEnemyApex(key) };
        $('btn-start').disabled = false;
        $('btn-start').textContent = 'START CAMPAIGN';
        onPick && onPick(key);
      });
      container.appendChild(card);
    }
  };
  function randomEnemyApex(notKey){
    const keys = Object.keys(G.APEX).filter(k=>k!==notKey);
    return keys[(Math.random()*keys.length)|0];
  }

  ui.refreshCharge = function(){
    const s = G.state; if(!s) return;
    const val = s.charge ? (s.charge.red||0) : 0;
    const pct = (val/10)*100;
    const fill = $('hud-charge-fill');
    const num  = $('hud-charge-num');
    const btn  = $('btn-ult');
    if(fill) fill.style.width = pct + '%';
    if(fill) fill.classList.toggle('full', val >= 10);
    if(num)  num.textContent = val;
    if(btn){
      const ready = val >= 10;
      btn.disabled = !ready;
      btn.classList.toggle('ready', ready);
      const apxKey = s.apex && s.apex.red;
      const apx = apxKey && G.APEX[apxKey];
      btn.textContent = apx ? (apx.ultName + ' · Q') : 'ULT · Q';
    }
  };

  ui.bindUlt = function(cb){ $('btn-ult').addEventListener('click', cb); };
  ui.bindTitleStart = function(cb){ $('btn-start').addEventListener('click', cb); };
  ui.bindPlayAgain  = function(cb){ $('btn-again').addEventListener('click', cb); };
  ui.bindEndTurn    = function(cb){ $('btn-end-turn').addEventListener('click', cb); };
  ui.bindFactoryClose = function(cb){ $('btn-factory-close').addEventListener('click', cb); };

  // expose
  G.ui = ui;
  G.ui.refreshHud = refreshHud;
  G.ui.refreshUnit = refreshUnitPanel;
})();
