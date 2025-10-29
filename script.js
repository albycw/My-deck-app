
const LS = { cards:'cr.cards.v1', deck:'cr.deck.v1' };
let CARDS = [];
let DECK = []; // array of up to 8 names

async function loadBaseCards(){
  if (CARDS.length) return;
  const local = localStorage.getItem(LS.cards);
  if (local){ CARDS = JSON.parse(local); }
  else {
    const res = await fetch('cards.json'); CARDS = await res.json(); saveCards();
  }
}
function saveCards(){ localStorage.setItem(LS.cards, JSON.stringify(CARDS)); }
function saveDeck(){ localStorage.setItem(LS.deck, JSON.stringify(DECK)); }
function loadDeck(){ DECK = JSON.parse(localStorage.getItem(LS.deck) || '[]'); }

function byName(name){ return CARDS.find(c => c.name.toLowerCase() === name.toLowerCase()); }
function ownedCards(){ return CARDS.filter(c => c.owned); }

function averageElixir(deckNames){
  const list = deckNames.map(n=>byName(n)).filter(Boolean);
  if (!list.length) return 0;
  return list.reduce((s,c)=>s+(c.elixir||0),0)/list.length;
}
function roleCoverage(deckNames){
  const roles = {};
  deckNames.forEach(n => {
    const c = byName(n); if (!c) return;
    (c.roles||[]).forEach(r => roles[r]=(roles[r]||0)+1);
  });
  return roles;
}
function needRoles(coverage){
  const required = ["win_condition","mini_wincon","big_spell","small_spell","building","air_dps","splash","swarm","tank","cycle","reset","control"];
  return required.filter(r => !coverage[r]);
}

// UI helpers
function qs(s){ return document.querySelector(s); }
function qsa(s){ return [...document.querySelectorAll(s)]; }
function switchTab(tab){
  qsa('.tab-btn').forEach(b=> b.classList.toggle('active', b.dataset.tab===tab));
  qs('#tab-deck').style.display = (tab==='deck')?'block':'none';
  qs('#tab-cards').style.display = (tab==='cards')?'block':'none';
  qs('#tab-suggest').style.display = (tab==='suggest')?'block':'none';
  qs('#tab-import').style.display = (tab==='import')?'block':'none';
}

function renderCardsGrid(){
  const grid = qs('#cardsGrid');
  const term = (qs('#searchCards').value || '').trim().toLowerCase();
  grid.innerHTML = '';
  CARDS
    .filter(c=> !term || c.name.toLowerCase().includes(term) || (c.roles||[]).join(',').includes(term))
    .sort((a,b)=> a.name.localeCompare(b.name))
    .forEach(c => {
      const el = document.createElement('div'); el.className='card';
      el.innerHTML = `
        <header>${c.name}</header>
        <div class="stat">Elixir: ${c.elixir} • ${c.rarity}${c.isChampion?' • Champion':''}</div>
        <div style="margin:6px 0;">${(c.roles||[]).map(r=>`<span class="role-chip">${r}</span>`).join(' ')}</div>
        <div class="controls">
          <label><input type="checkbox" ${c.owned?'checked':''} data-own="${c.name}"> Owned</label>
          <label>Level <input type="number" min="1" max="15" value="${c.level||1}" data-level="${c.name}"></label>
        </div>`;
      grid.appendChild(el);
    });
  qsa('input[type="checkbox"][data-own]').forEach(ch => {
    ch.addEventListener('change', e => {
      const n = e.target.getAttribute('data-own'); const card = byName(n);
      if (card){ card.owned = e.target.checked; saveCards(); }
    });
  });
  qsa('input[type="number"][data-level]').forEach(inp => {
    inp.addEventListener('change', e => {
      const n = e.target.getAttribute('data-level'); const card = byName(n);
      if (card){ card.level = Number(e.target.value||1); saveCards(); }
    });
  });
}

function renderDeck(){
  const cont = qs('#deckSlots'); cont.innerHTML='';
  for (let i=0;i<8;i++){
    const name = DECK[i];
    const slot = document.createElement('div'); slot.className='slot';
    slot.innerHTML = name ? `<div><strong>${name}</strong><br><span class="stat">tap to remove</span></div>` : '<span class="stat">empty</span>';
    slot.addEventListener('click', () => { if (DECK[i]){ DECK.splice(i,1); saveDeck(); renderDeck(); }});
    cont.appendChild(slot);
  }
  renderDeckStats();
}
function renderDeckStats(){
  const el = qs('#deckStats');
  const avg = averageElixir(DECK).toFixed(1);
  const roles = roleCoverage(DECK);
  const needs = needRoles(roles);
  const ok = needs.length===0 && DECK.length===8;
  el.innerHTML = `Average elixir: <span class="stat ${avg<=3.5?'good':(avg<=4.0?'warn':'bad')}">${avg}</span> • Roles missing: ${
    needs.length ? needs.map(r=>`<span class="badge">${r}</span>`).join(' ') : '<span class="stat good">none</span>'
  }` + (ok ? ' • <span class="stat good">Looks balanced</span>' : '');
}

function searchToAdd(){
  const term = (qs('#searchDeck').value||'').trim().toLowerCase();
  const out = qs('#deckSearchResults'); out.innerHTML='';
  if (!term) return;
  ownedCards().filter(c=> !DECK.includes(c.name))
    .filter(c=> c.name.toLowerCase().includes(term) || (c.roles||[]).join(',').includes(term))
    .slice(0,20)
    .forEach(c => {
      const div = document.createElement('div'); div.className='card';
      div.innerHTML = `<header>${c.name}</header>
        <div class="stat">Elixir ${c.elixir} • Lvl ${c.level}</div>
        <div>${(c.roles||[]).map(r=>`<span class="role-chip">${r}</span>`).join(' ')}</div>
        <div class="controls"><button class="btn" data-add="${c.name}">Add to deck</button></div>`;
      out.appendChild(div);
    });
  qsa('button[data-add]').forEach(b => b.addEventListener('click', e => {
    const n = e.target.getAttribute('data-add');
    if (DECK.length<8 && !DECK.includes(n)){ DECK.push(n); saveDeck(); renderDeck(); }
  }));
}

function addCustomCard(){
  const name = prompt('Card name'); if (!name) return;
  const elixir = Number(prompt('Elixir cost', '3')||3);
  const roles = (prompt('Roles (comma separated)', '')||'').split(',').map(s=>s.trim()).filter(Boolean);
  const rarity = prompt('Rarity (Common/Rare/Epic/Legendary/Champion)','Rare')||'Rare';
  const isChampion = /champion/i.test(rarity);
  const level = Number(prompt('Your current level for this card','11')||11);
  CARDS.push({name,elixir,roles,rarity,isChampion,owned:true,level});
  saveCards(); renderCardsGrid();
}

// Suggestions
function suggestImprovements(){
  const target = Number(qs('#targetElixir').value);
  const focus = qs('#focusMode').value;
  const owned = ownedCards();

  const roles = roleCoverage(DECK);
  const needs = needRoles(roles);
  const avg = averageElixir(DECK);
  const roleFixes = [];

  needs.forEach(role => {
    const candidates = owned.filter(c => (c.roles||[]).includes(role) && !DECK.includes(c.name));
    candidates.sort((a,b)=> (b.level-a.level) || (Math.abs((b.elixir||0)-target) - Math.abs((a.elixir||0)-target)));
    roleFixes.push({role, picks:candidates.slice(0,3)});
  });

  const subs = [];
  DECK.forEach(name => {
    const c = byName(name); if (!c) return;
    const pool = owned.filter(o => o.name!==c.name && !DECK.includes(o.name) && (o.roles||[]).some(r => (c.roles||[]).includes(r)));
    pool.sort((a,b)=> (b.level-a.level) || (Math.abs((b.elixir||0)-target) - Math.abs((a.elixir||0)-target)));
    subs.push({for:name, picks:pool.slice(0,2)});
  });

  function focusScore(card){
    if (focus==='cycle') return card.elixir<=3 ? 2:0;
    if (focus==='beatdown') return (card.elixir>=5 || (card.roles||[]).includes('heavy_tank')) ? 2:0;
    if (focus==='control') return ((card.roles||[]).includes('control') || (card.roles||[]).includes('tornado')) ? 2:0;
    if (focus==='spellbait') return ((card.roles||[]).includes('spell_bait') || (card.roles||[]).includes('spell-bait')) ? 2:0;
    return 0;
  }
  const focusTop = owned.filter(c => !DECK.includes(c.name))
    .sort((a,b)=> (focusScore(b)-focusScore(a)) || (b.level-a.level)).slice(0,5);

  const container = document.getElementById('suggestOutput'); container.innerHTML='';
  if (roleFixes.length){
    const sec = document.createElement('div'); sec.className='panel';
    sec.innerHTML = `<h3>Fix missing roles</h3>` + roleFixes.map(r => {
      const picks = r.picks;
      return `<div class="card"><header>Role: ${r.role}</header>${
        picks.length ? picks.map(p=>`<div>${p.name} <span class="stat">L${p.level} • elixir ${p.elixir}</span></div>`).join('') :
        `<div class="stat bad">No owned substitutes found — consider acquiring/leveling for this role.</div>`
      }</div>`;
    }).join('');
    container.appendChild(sec);
  }
  const sec2 = document.createElement('div'); sec2.className='panel';
  sec2.innerHTML = `<h3>Per-card substitutes</h3>` + subs.map(s => {
    return `<div class="card"><header>Swap options for <strong>${s.for}</strong></header>${
      s.picks.length ? s.picks.map(p=>`<div>${p.name} <span class="stat">L${p.level} • elixir ${p.elixir}</span></div>`).join('') :
      `<div class="stat">No obvious substitutes (owned).</div>`
    }</div>`;
  }).join('');
  container.appendChild(sec2);

  const sec3 = document.createElement('div'); sec3.className='panel';
  sec3.innerHTML = `<h3>Focus-based picks (${focus})</h3>` + (
    focusTop.length ? focusTop.map(p=>`<div>${p.name} <span class="stat">L${p.level} • ${(p.roles||[]).slice(0,3).join(', ')}</span></div>`).join('')
    : `<div class="stat">No matching owned cards.</div>`
  );
  container.appendChild(sec3);

  const avgEl = document.createElement('div'); avgEl.className='stat'; avgEl.style.marginTop='8px';
  avgEl.textContent = `Current avg elixir: ${avg.toFixed(1)} • Target: ${target.toFixed(1)}`;
  container.appendChild(avgEl);
}

function autoFill(){
  const keyRoles = ["win_condition","big_spell","small_spell","building","air_dps","splash","tank","cycle"];
  const pool = ownedCards().filter(c => !DECK.includes(c.name));
  keyRoles.forEach(role => {
    if (DECK.length>=8) return;
    const pick = pool.filter(c => (c.roles||[]).includes(role))
      .sort((a,b)=> (b.level-a.level) || (a.elixir-b.elixir))[0];
    if (pick) DECK.push(pick.name);
  });
  while (DECK.length<8){
    const pick = pool.filter(c => !DECK.includes(c.name)).sort((a,b)=> (b.level-a.level) || (a.elixir-b.elixir))[0];
    if (!pick) break;
    DECK.push(pick.name);
  }
  saveDeck(); renderDeck();
}

// import/export
function exportJSON(){
  const blob = new Blob([JSON.stringify({cards:CARDS, deck:DECK}, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'cr-deck-data.json'; a.click();
  URL.revokeObjectURL(url);
}
function handleImport(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if (data.cards) CARDS = data.cards;
      if (data.deck) DECK = data.deck;
      saveCards(); saveDeck();
      renderCardsGrid(); renderDeck();
      alert('Import complete!');
    }catch(e){ alert('Import failed: '+e.message); }
  };
  reader.readAsText(file);
}


function quickSetup(){
  const deckText = (document.getElementById('pasteDeck').value||'').trim();
  const missingText = (document.getElementById('missingCards').value||'').trim();

  if (!deckText){
    alert('Please paste your 8 card names, comma-separated.'); return;
  }
  const names = deckText.split(',').map(s=>s.trim()).filter(Boolean);
  if (names.length!==8){
    if (!confirm('You entered ' + names.length + ' names. Continue anyway?')) return;
  }

  // Mark missing cards as unowned
  if (missingText){
    const miss = missingText.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    CARDS.forEach(c => {
      if (miss.includes(c.name.toLowerCase())) c.owned = false;
    });
  }

  // Ensure cards exist; if not, add as custom placeholders (owned)
  names.forEach(n => {
    let c = CARDS.find(x => x.name.toLowerCase()===n.toLowerCase());
    if (!c){
      c = {name:n, elixir:3, roles:[], rarity:'Rare', isChampion:false, owned:true, level:11};
      CARDS.push(c);
    } else {
      c.owned = true;
    }
  });
  saveCards();

  // Apply deck
  DECK = names.slice(0,8);
  saveDeck();
  renderCardsGrid(); renderDeck();
  switchTab('suggest');
  alert('Deck applied! Head to Suggestions to see swaps and role fixes.');
}

// init
async function init(){
  await loadBaseCards(); loadDeck();
  qsa('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  qs('#searchCards').addEventListener('input', renderCardsGrid);
  qs('#addCard').addEventListener('click', addCustomCard);
  qs('#searchDeck').addEventListener('input', searchToAdd);
  qs('#clearDeck').addEventListener('click', ()=>{ DECK=[]; saveDeck(); renderDeck(); });
  qs('#autoFill').addEventListener('click', autoFill);
  qs('#runSuggest').addEventListener('click', suggestImprovements);
  qs('#exportBtn').addEventListener('click', exportJSON);
  const applyBtn = document.getElementById('applySetup'); if (applyBtn) applyBtn.addEventListener('click', quickSetup);
  qs('#importFile').addEventListener('change', e => { if (e.target.files[0]) handleImport(e.target.files[0]); });
  renderCardsGrid(); renderDeck();
}
document.addEventListener('DOMContentLoaded', init);
