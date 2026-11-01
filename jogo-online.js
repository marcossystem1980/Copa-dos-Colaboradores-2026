'use strict';

const CLUB_CATALOG_FALLBACK = [
  {id:'local-flamengo',slug:'flamengo',name:'Flamengo',short_name:'FLA',country_name:'Brasil',country_code:'BR',city:'Rio de Janeiro',league_name:'Brasileirão Série A',primary_color:'#C8102E',secondary_color:'#171717',accent_color:'#F2D6B3',badge_initials:'FLA',season_label:'2026',region_code:'brasil',group_name:'Brasileirão Série A',display_order:1},
  {id:'local-palmeiras',slug:'palmeiras',name:'Palmeiras',short_name:'PAL',country_name:'Brasil',country_code:'BR',city:'São Paulo',league_name:'Brasileirão Série A',primary_color:'#006437',secondary_color:'#F4F0E6',accent_color:'#B58B55',badge_initials:'PAL',season_label:'2026',region_code:'brasil',group_name:'Brasileirão Série A',display_order:2},
  {id:'local-corinthians',slug:'corinthians',name:'Corinthians',short_name:'COR',country_name:'Brasil',country_code:'BR',city:'São Paulo',league_name:'Brasileirão Série A',primary_color:'#F4F0E6',secondary_color:'#171717',accent_color:'#C9A56D',badge_initials:'COR',season_label:'2026',region_code:'brasil',group_name:'Brasileirão Série A',display_order:3},
  {id:'local-sao-paulo',slug:'sao-paulo',name:'São Paulo',short_name:'SAO',country_name:'Brasil',country_code:'BR',city:'São Paulo',league_name:'Brasileirão Série A',primary_color:'#F4F0E6',secondary_color:'#D71920',accent_color:'#171717',badge_initials:'SAO',season_label:'2026',region_code:'brasil',group_name:'Brasileirão Série A',display_order:4},
  {id:'local-gremio',slug:'gremio',name:'Grêmio',short_name:'GRE',country_name:'Brasil',country_code:'BR',city:'Porto Alegre',league_name:'Brasileirão Série A',primary_color:'#00AEEF',secondary_color:'#171717',accent_color:'#F4F0E6',badge_initials:'GRE',season_label:'2026',region_code:'brasil',group_name:'Brasileirão Série A',display_order:5},
  {id:'local-atletico-mineiro',slug:'atletico-mineiro',name:'Atlético Mineiro',short_name:'CAM',country_name:'Brasil',country_code:'BR',city:'Belo Horizonte',league_name:'Brasileirão Série A',primary_color:'#171717',secondary_color:'#F4F0E6',accent_color:'#C9A56D',badge_initials:'CAM',season_label:'2026',region_code:'brasil',group_name:'Brasileirão Série A',display_order:6},
  {id:'local-real-madrid',slug:'real-madrid',name:'Real Madrid',short_name:'RMA',country_name:'Espanha',country_code:'ES',city:'Madrid',league_name:'La Liga',primary_color:'#F7F4EA',secondary_color:'#253D74',accent_color:'#C9A33B',badge_initials:'RMA',season_label:'2026/27',region_code:'europa',group_name:'Principais clubes europeus',display_order:1},
  {id:'local-barcelona',slug:'barcelona',name:'Barcelona',short_name:'BAR',country_name:'Espanha',country_code:'ES',city:'Barcelona',league_name:'La Liga',primary_color:'#A50044',secondary_color:'#004D98',accent_color:'#EDBB00',badge_initials:'BAR',season_label:'2026/27',region_code:'europa',group_name:'Principais clubes europeus',display_order:2},
  {id:'local-manchester-city',slug:'manchester-city',name:'Manchester City',short_name:'MCI',country_name:'Inglaterra',country_code:'GB',city:'Manchester',league_name:'Premier League',primary_color:'#6CABDD',secondary_color:'#1C2C5B',accent_color:'#F4F0E6',badge_initials:'MCI',season_label:'2026/27',region_code:'europa',group_name:'Principais clubes europeus',display_order:3},
  {id:'local-liverpool',slug:'liverpool',name:'Liverpool',short_name:'LIV',country_name:'Inglaterra',country_code:'GB',city:'Liverpool',league_name:'Premier League',primary_color:'#C8102E',secondary_color:'#F4F0E6',accent_color:'#D7B46A',badge_initials:'LIV',season_label:'2026/27',region_code:'europa',group_name:'Principais clubes europeus',display_order:4},
  {id:'local-bayern-munich',slug:'bayern-munich',name:'Bayern de Munique',short_name:'BAY',country_name:'Alemanha',country_code:'DE',city:'Munique',league_name:'Bundesliga',primary_color:'#DC052D',secondary_color:'#0066B2',accent_color:'#F4F0E6',badge_initials:'BAY',season_label:'2026/27',region_code:'europa',group_name:'Principais clubes europeus',display_order:5},
  {id:'local-paris-saint-germain',slug:'paris-saint-germain',name:'Paris Saint-Germain',short_name:'PSG',country_name:'França',country_code:'FR',city:'Paris',league_name:'Ligue 1',primary_color:'#004170',secondary_color:'#DA291C',accent_color:'#F4F0E6',badge_initials:'PSG',season_label:'2026/27',region_code:'europa',group_name:'Principais clubes europeus',display_order:6}
];

const state = { clubs: [], selectedClubId: null, filter: 'all', query: '', client: null, session: null, role: null, dbReady: false, savedSquads: [], roster: [], selections: {}, formation: '2-1', providerCandidates: [], rosterLoading: false, copaTeams: [], selectedCopaTeamId: null, copaLineup: {}, copaSnapshotUpdatedAt: null, copaTeamsLoaded: false, copaSavedLineupId: null, copaLineupSchemaReady: false, copaLegacyLineupNeedsUpdate: false };
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isLocalId = (id) => String(id).startsWith('local-');

function badgeMarkup(club, large = false) {
  const textColor = ['#F4F0E6','#F7F4EA'].includes((club.primary_color || '').toUpperCase()) ? '#21170F' : '#FFFFFF';
  return `<div class="club-badge ${large ? 'club-badge-large' : ''}" style="--club-primary:${esc(club.primary_color)};--club-secondary:${esc(club.secondary_color)};--badge-ink:${textColor}"><span>${esc(club.badge_initials || club.short_name || 'FC')}</span></div>`;
}

function getFilteredClubs() {
  const query = state.query.trim().toLocaleLowerCase('pt-BR');
  return state.clubs.filter((club) => {
    const matchesRegion = state.filter === 'all' || club.region_code === state.filter;
    const searchText = [club.name, club.city, club.league_name, club.country_name, club.short_name].join(' ').toLocaleLowerCase('pt-BR');
    return matchesRegion && (!query || searchText.includes(query));
  });
}

function renderClubGrid() {
  const clubs = getFilteredClubs();
  $('clubTotal').textContent = state.clubs.length;
  if (!clubs.length) {
    $('clubGrid').innerHTML = '<div class="empty-filter">Nenhum clube encontrado. Tente outro nome ou filtro.</div>';
    return;
  }
  $('clubGrid').innerHTML = clubs.map((club) => `
    <button type="button" class="club-card ${String(club.id) === String(state.selectedClubId) ? 'selected' : ''}" data-club-id="${esc(club.id)}" style="--club-primary:${esc(club.primary_color)};--club-secondary:${esc(club.secondary_color)}">
      <div class="club-card-color"></div>
      <div class="club-card-content">
        <div class="club-card-top">${badgeMarkup(club)}<div class="club-card-meta"><small>${esc(club.country_name)} · ${esc(club.short_name)}</small><strong>${esc(club.name)}</strong></div></div>
        <div class="club-card-league"><span>${esc(club.league_name)}</span><b>${club.region_code === 'brasil' ? 'BR' : 'EU'}</b></div>
      </div>
    </button>`).join('');
}

function renderSelectedClub() {
  const club = state.clubs.find((item) => String(item.id) === String(state.selectedClubId));
  if (!club) {
    $('detailCurrentLabel').textContent = 'NENHUM CLUBE SELECIONADO';
    $('clubDetailCard').innerHTML = '<div class="detail-empty"><span>⚽</span><strong>Selecione um clube acima</strong><p>Os dados e o elenco aparecerão nesta área.</p></div>';
    $('squadSeasonLabel').textContent = 'AGUARDANDO CLUBE';
    $('squadWorkspace').innerHTML = '<div class="squad-empty"><strong>Seu elenco será montado aqui</strong><p>Selecione um clube para visualizar suas posições e jogadores disponíveis.</p></div>';
    return;
  }
  $('detailCurrentLabel').textContent = 'CLUBE EM DESTAQUE';
  $('squadSeasonLabel').textContent = `ELENCO ATUAL · REFERÊNCIA ${club.season_label}`;
  const alreadySaved = state.savedSquads.some((item) => String(item.club_id) === String(club.id) && item.season_label === club.season_label);
  $('clubDetailCard').innerHTML = `
    <div class="club-detail-layout">
      <div class="club-detail-main" style="--club-primary:${esc(club.primary_color)};--club-secondary:${esc(club.secondary_color)}">
        ${badgeMarkup(club, true)}
        <div class="club-detail-copy">
          <div class="league-kicker">${esc(club.group_name || (club.region_code === 'brasil' ? 'BRASILEIRÃO' : 'SELEÇÃO EUROPEIA'))}</div>
          <h3>${esc(club.name)}</h3>
          <p>${esc(club.city || '')}${club.city ? ' · ' : ''}${esc(club.country_name)}<br/>Competição: ${esc(club.league_name)}</p>
          <div class="club-data-tags"><span>REFERÊNCIA ${esc(club.season_label)}</span><span>${club.region_code === 'brasil' ? 'CATÁLOGO BRASILEIRO' : 'CATÁLOGO EUROPEU'}</span><span>AVATARES GENÉRICOS</span></div>
        </div>
      </div>
      <div class="club-detail-action">
        <small>CLUBE ESCOLHIDO</small>
        <strong>${alreadySaved ? 'Esta equipe já está no seu perfil.' : 'Deseja salvar esta equipe no seu perfil?'}</strong>
        <button type="button" id="saveSelectedClubBtn" class="select-club-btn">${alreadySaved ? 'CLUBE JÁ SALVO ✓' : 'ESCOLHER ESTE CLUBE →'}</button>
        <div class="selection-save-note" id="selectionSaveNote">${alreadySaved ? 'Sua escolha foi recuperada do Supabase.' : 'A escolha será salva no Supabase quando você estiver autenticado no portal da Copa.'}</div>
      </div>
    </div>
    ${state.role === 'admin' ? renderAdminImportPanel(club) : ''}`;

  renderSquadView(club);
  const saveButton = $('saveSelectedClubBtn');
  saveButton?.addEventListener('click', () => saveSelectedClub(club, saveButton));
  bindProviderImportEvents(club);
  loadClubRoster(club);
}

function renderAdminImportPanel(club) {
  return `<div class="provider-admin-panel">
    <div class="provider-admin-copy"><span class="eyebrow eyebrow-muted">FERRAMENTA DO ADMINISTRADOR</span><strong>Importar elenco atual da API-Football</strong><p>Localize o clube na base esportiva e importe os atletas, posições, idades e números de camisa. A chave da API fica protegida no servidor.</p></div>
    <button type="button" class="provider-search-btn" id="searchProviderTeamBtn">LOCALIZAR CLUBE E IMPORTAR ELENCO</button>
    <div class="provider-results" id="providerTeamResults" aria-live="polite"></div>
  </div>`;
}

function avatarSvg() {
  return '<div class="generic-avatar"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="22" r="12"/><path d="M10 59c1-14 9-22 22-22s21 8 22 22"/></svg></div>';
}

function renderSquadView(club) {
  state.roster = [];
  state.selections = {};
  state.formation = '2-1';
  const saved = state.savedSquads.find((item) => String(item.club_id) === String(club.id) && item.season_label === club.season_label);
  if (saved) state.formation = ['2-1','1-2'].includes(saved.formation) ? saved.formation : '2-1';
  $('squadWorkspace').innerHTML = `
    <div class="squad-builder">
      <div class="squad-builder-toolbar">
        <div><span class="eyebrow eyebrow-muted">MONTAGEM DA EQUIPE</span><h3>Elenco e escalação</h3><p id="rosterSyncNote">Consultando o elenco atual deste clube...</p></div>
        <label class="formation-select">FORMAÇÃO
          <select id="formationSelect"><option value="2-1">2–1 · Equilibrada</option><option value="1-2">1–2 · Ofensiva</option></select>
        </label>
      </div>
      <div class="squad-roster-layout">
        <div class="tactical-pitch-wrap">
          <div class="roster-preview-head"><h3>Escalação titular</h3><span id="starterCount">0 / 4 TITULARES</span></div>
          <div class="tactical-pitch" id="tacticalPitch" aria-label="Prévia da escalação titular">
            <div class="pitch-box top"></div><div class="pitch-box bottom"></div>
            <div class="pitch-slot" data-slot="1" style="left:50%;top:87%"><span class="pitch-avatar">GK</span><small>GOLEIRO</small><b>—</b></div>
            <div class="pitch-slot" data-slot="2" style="left:25%;top:58%"><span class="pitch-avatar">DEF</span><small>LINHA 01</small><b>—</b></div>
            <div class="pitch-slot" data-slot="3" style="left:75%;top:58%"><span class="pitch-avatar">DEF</span><small>LINHA 02</small><b>—</b></div>
            <div class="pitch-slot" data-slot="4" style="left:50%;top:28%"><span class="pitch-avatar">ATT</span><small>LINHA 03</small><b>—</b></div>
          </div>
          <div class="pitch-legend"><span>01 GOLEIRO</span><span>02–04 JOGADORES DE LINHA</span></div>
          <button type="button" class="save-lineup-btn" id="saveLineupBtn">SALVAR ESCALAÇÃO</button>
          <p class="lineup-help">Selecione sete titulares na formação 2–3–1 e até cinco reservas.</p>
        </div>
        <div class="roster-preview">
          <div class="roster-preview-head"><h3>Jogadores disponíveis</h3><span id="rosterTotal">AGUARDANDO ELENCO</span></div>
          <div class="roster-grid" id="realRosterGrid"><div class="squad-empty compact"><strong>Carregando jogadores...</strong></div></div>
          <div class="roster-import-note" id="rosterImportNote"><strong>Dados reais de elenco.</strong> As fichas usam avatares genéricos. Os atributos esportivos do jogo serão calibrados em uma etapa separada; não exibiremos notas inventadas.</div>
        </div>
      </div>
    </div>`;
  $('formationSelect').value = state.formation;
  $('formationSelect').addEventListener('change', (event) => {
    state.formation = event.target.value;
    updateLineupPreview();
  });
  $('realRosterGrid').addEventListener('click', handleRosterAction);
  $('saveLineupBtn').addEventListener('click', () => saveLineup(club));
  updateLineupPreview();
}

function positionName(code) {
  return ({GK:'GOLEIRO',DEF:'DEFENSOR',MID:'MEIO-CAMPISTA',ATT:'ATACANTE'}[code] || 'JOGADOR');
}

function renderRosterCards() {
  const grid = $('realRosterGrid');
  if (!grid) return;
  if (!state.roster.length) {
    grid.innerHTML = `<div class="roster-empty-state"><div class="empty-ball">⚽</div><strong>Nenhum elenco importado ainda</strong><p>${state.role === 'admin' ? 'Use o botão “Localizar clube e importar elenco” acima para buscar os jogadores na API-Football.' : 'O administrador ainda não importou o elenco deste clube.'}</p></div>`;
    $('rosterTotal').textContent = '0 JOGADORES';
    return;
  }
  $('rosterTotal').textContent = `${state.roster.length} JOGADORES`;
  grid.innerHTML = state.roster.map((entry) => {
    const player = entry.game_players || {};
    const selection = state.selections[entry.id];
    const typeLabel = !selection ? 'DISPONÍVEL' : selection.is_starter ? `TITULAR · ${selection.slot_number}` : 'RESERVA';
    const action = selection ? `<button type="button" class="roster-action remove" data-roster-remove="${esc(entry.id)}">RETIRAR</button>` : `<span class="roster-actions"><button type="button" class="roster-action" data-roster-starter="${esc(entry.id)}">TITULAR</button><button type="button" class="roster-action secondary" data-roster-bench="${esc(entry.id)}">RESERVA</button></span>`;
    return `<article class="real-player-card ${selection ? 'selected' : ''}">
      ${avatarSvg()}
      <div class="real-player-copy"><strong>${esc(player.display_name || player.full_name || 'Jogador')}</strong><small>${esc(positionName(entry.position_code))} · ${entry.shirt_number ? `CAMISA ${entry.shirt_number}` : 'SEM NÚMERO'}${player.age_at_import ? ` · ${player.age_at_import} ANOS` : ''}</small><em>${esc(typeLabel)}</em></div>
      ${action}
    </article>`;
  }).join('');
}

function handleRosterAction(event) {
  const starter = event.target.closest('[data-roster-starter]');
  const bench = event.target.closest('[data-roster-bench]');
  const remove = event.target.closest('[data-roster-remove]');
  const id = starter?.dataset.rosterStarter || bench?.dataset.rosterBench || remove?.dataset.rosterRemove;
  if (!id) return;
  if (remove) {
    delete state.selections[id];
  } else if (starter) {
    const entry = state.roster.find((item) => item.id === id);
    const isGoalkeeper = entry?.position_code === 'GK';
    const occupied = Object.values(state.selections).filter((item) => item.is_starter).map((item) => item.slot_number);
    let slot = isGoalkeeper ? 1 : [2,3,4].find((number) => !occupied.includes(number));
    if (!isGoalkeeper && !slot) return showToast('As 3 vagas de linha já estão ocupadas. Retire um titular antes.', 'warning');
    if (isGoalkeeper && occupied.includes(1)) return showToast('A vaga de goleiro já está ocupada.', 'warning');
    if (isGoalkeeper && Object.values(state.selections).filter((item) => item.is_starter).length >= 4) return showToast('Os 4 titulares já estão definidos.', 'warning');
    state.selections[id] = {is_starter:true, slot_number:slot};
  } else if (bench) {
    const benchCount = Object.values(state.selections).filter((item) => !item.is_starter).length;
    if (benchCount >= 2) return showToast('O banco tem espaço para até 2 reservas nesta versão.', 'warning');
    const freeBenchSlot = [5,6].find((number) => !Object.values(state.selections).some((selection) => !selection.is_starter && selection.slot_number === number));
    if (!freeBenchSlot) return showToast('As duas vagas de reserva já estão ocupadas.', 'warning');
    state.selections[id] = {is_starter:false, slot_number:freeBenchSlot};
  }
  renderRosterCards();
  updateLineupPreview();
}

function updateLineupPreview() {
  const starters = Object.entries(state.selections).filter(([, value]) => value.is_starter);
  const pitchPositions = state.formation === '1-2'
    ? {2:{left:'50%',top:'62%'},3:{left:'28%',top:'31%'},4:{left:'72%',top:'31%'}}
    : {2:{left:'25%',top:'58%'},3:{left:'75%',top:'58%'},4:{left:'50%',top:'28%'}};
  Object.entries(pitchPositions).forEach(([slot, position]) => {
    const element = document.querySelector(`.pitch-slot[data-slot="${slot}"]`);
    if (element) { element.style.left = position.left; element.style.top = position.top; }
  });
  const count = $('starterCount');
  if (count) count.textContent = `${starters.length} / 4 TITULARES`;
  const slots = [1,2,3,4];
  slots.forEach((slot) => {
    const target = document.querySelector(`.pitch-slot[data-slot="${slot}"]`);
    if (!target) return;
    const match = starters.find(([, selection]) => selection.slot_number === slot);
    const entry = match ? state.roster.find((item) => item.id === match[0]) : null;
    const player = entry?.game_players || {};
    target.querySelector('b').textContent = entry ? (player.display_name || player.full_name).split(' ').slice(-1)[0] : '—';
    target.classList.toggle('occupied', Boolean(entry));
  });
}

async function loadClubRoster(club) {
  if (!state.client || !state.dbReady || isLocalId(club.id) || !state.session) {
    renderRosterCards();
    return;
  }
  const grid = $('realRosterGrid');
  if (grid) grid.innerHTML = '<div class="squad-empty compact"><strong>Consultando elenco no Supabase...</strong></div>';
  state.rosterLoading = true;
  try {
    const { data, error } = await state.client
      .from('game_roster_entries')
      .select('id,club_id,season_label,shirt_number,position_code,position_label,overall,attributes,roster_status,is_captain,last_verified_at,game_players(id,full_name,display_name,nationality,age_at_import,avatar_style)')
      .eq('club_id', club.id)
      .eq('season_label', club.season_label)
      .eq('roster_status', 'active')
      .order('position_code', {ascending:true})
      .order('shirt_number', {ascending:true});
    if (error) throw error;
    state.roster = data || [];
    await loadSavedLineup(club);
    renderRosterCards();
    updateLineupPreview();
    const verified = state.roster.map((item) => item.last_verified_at).filter(Boolean).sort().at(-1);
    const note = $('rosterSyncNote');
    if (note) note.textContent = state.roster.length ? `${state.roster.length} atletas importados · última verificação ${verified ? new Date(verified).toLocaleDateString('pt-BR') : 'sem data'}.` : 'Nenhum elenco sincronizado. O administrador pode importar pela API-Football.';
    const importNote = $('rosterImportNote');
    if (importNote) importNote.innerHTML = '<strong>Fichas provisórias do jogo.</strong> Os dados de elenco e posição vêm da fonte esportiva. Notas de ritmo, passe, chute e defesa serão definidas em etapa própria com critérios transparentes.';
  } catch (error) {
    console.error('Erro ao carregar elenco:', error);
    if (grid) grid.innerHTML = '<div class="roster-empty-state"><strong>Não foi possível carregar o elenco.</strong><p>Confira se a migração SUPABASE_JOGO_ONLINE_ELENCOS.sql foi executada.</p></div>';
  } finally {
    state.rosterLoading = false;
  }
}

async function loadSavedLineup(club) {
  if (!state.session) return;
  const saved = state.savedSquads.find((item) => String(item.club_id) === String(club.id) && item.season_label === club.season_label);
  if (!saved) return;
  state.formation = ['2-1','1-2'].includes(saved.formation) ? saved.formation : '2-1';
  const { data, error } = await state.client.from('game_user_squad_players')
    .select('roster_entry_id,slot_number,is_starter')
    .eq('squad_id', saved.id)
    .eq('user_id', state.session.user.id);
  if (error) throw error;
  state.selections = {};
  (data || []).forEach((item) => {
    state.selections[item.roster_entry_id] = {is_starter:item.is_starter,slot_number:item.slot_number};
  });
  const formation = $('formationSelect');
  if (formation) formation.value = state.formation;
}

async function saveLineup(club) {
  if (!state.client || !state.session || !state.dbReady || isLocalId(club.id)) {
    return showToast('Entre na Copa e confirme que o catálogo Supabase está conectado.', 'warning');
  }
  const starters = Object.values(state.selections).filter((item) => item.is_starter);
  if (starters.length !== 4 || !starters.some((item) => item.slot_number === 1)) {
    return showToast('Defina 4 titulares: 1 goleiro e 3 jogadores de linha.', 'warning');
  }
  const button = $('saveLineupBtn');
  button.disabled = true;
  button.textContent = 'SALVANDO ESCALAÇÃO...';
  try {
    const payload = {user_id:state.session.user.id,club_id:club.id,season_label:club.season_label,squad_name:`${club.name} · Meu clube online`,formation:state.formation,status:'ready'};
    const {data:squad,error:squadError} = await state.client.from('game_user_squads')
      .upsert(payload,{onConflict:'user_id,club_id,season_label'}).select('id,club_id,season_label,formation,status,updated_at').single();
    if (squadError) throw squadError;
    const {error:deleteError} = await state.client.from('game_user_squad_players').delete().eq('squad_id',squad.id).eq('user_id',state.session.user.id);
    if (deleteError) throw deleteError;
    const rows = Object.entries(state.selections).map(([rosterEntryId,selection]) => ({
      squad_id:squad.id,user_id:state.session.user.id,roster_entry_id:rosterEntryId,slot_number:selection.slot_number,is_starter:selection.is_starter
    }));
    const {error:insertError} = await state.client.from('game_user_squad_players').insert(rows);
    if (insertError) throw insertError;
    state.savedSquads = [squad,...state.savedSquads.filter((item) => item.id !== squad.id)];
    showToast('Escalação salva no Supabase. Seu clube está pronto para a próxima etapa.', 'success');
    button.textContent = 'ESCALAÇÃO SALVA ✓';
  } catch (error) {
    console.error('Erro ao salvar escalação:',error);
    showToast(error.message || 'Não foi possível salvar a escalação.', 'error');
    button.textContent = 'SALVAR ESCALAÇÃO';
    button.disabled = false;
  }
}

function bindProviderImportEvents(club) {
  const searchButton = $('searchProviderTeamBtn');
  if (!searchButton) return;
  searchButton.addEventListener('click', () => searchProviderTeam(club, searchButton));
}


async function invokeFootballFunction(body) {
  const {data,error} = await state.client.functions.invoke('football-catalog',{body});
  if (!error) return data;
  let message = error.message || 'A Edge Function não conseguiu concluir a operação.';
  if (error.context && typeof error.context.json === 'function') {
    try { const detail = await error.context.json(); if (detail?.error) message = detail.error; } catch (_) { /* resposta sem JSON */ }
  }
  throw new Error(message);
}

async function searchProviderTeam(club, button) {
  if (!state.client || !state.session || state.role !== 'admin') return showToast('Somente o ADM autenticado pode importar elencos.', 'warning');
  button.disabled = true;
  button.textContent = 'PESQUISANDO NA API-FOOTBALL...';
  $('providerTeamResults').innerHTML = '<p class="provider-loading">Consultando clubes disponíveis...</p>';
  try {
    const data = await invokeFootballFunction({action:'search-team',club_id:club.id});
    state.providerCandidates = (data?.teams || []).slice(0, 8);
    if (!state.providerCandidates.length) {
      $('providerTeamResults').innerHTML = '<p class="provider-loading">Nenhum clube correspondente foi encontrado. Confira a chave da API nas Edge Function Secrets.</p>';
      return;
    }
    $('providerTeamResults').innerHTML = `<div class="provider-result-heading">CONFIRME O CLUBE CORRETO NA FONTE</div>${state.providerCandidates.map((team) => `
      <div class="provider-result-row"><div class="provider-result-badge">${esc((team.code || team.name || 'FC').slice(0,3).toUpperCase())}</div><div class="provider-result-copy"><strong>${esc(team.name)}</strong><small>${esc(team.country || 'País não informado')} · ID ${esc(team.id)}</small></div><button type="button" class="provider-link-btn" data-provider-team-id="${esc(team.id)}">VINCULAR E IMPORTAR</button></div>`).join('')}`;
    $('providerTeamResults').querySelectorAll('[data-provider-team-id]').forEach((candidateButton) => candidateButton.addEventListener('click', () => syncProviderSquad(club,candidateButton.dataset.providerTeamId,candidateButton)));
  } catch (error) {
    console.error('Busca API-Football:',error);
    $('providerTeamResults').innerHTML = `<p class="provider-error">${esc(error.message || 'Falha ao consultar a API-Football. Confira a Edge Function e sua chave.')}</p>`;
  } finally {
    button.disabled = false;
    button.textContent = 'LOCALIZAR CLUBE E IMPORTAR ELENCO';
  }
}

async function syncProviderSquad(club, providerTeamId, button) {
  button.disabled = true;
  button.textContent = 'IMPORTANDO...';
  try {
    const data = await invokeFootballFunction({action:'sync-squad',club_id:club.id,provider_team_id:Number(providerTeamId)});
    showToast(`${data.imported_count} atletas importados para ${club.name}.`, 'success');
    $('providerTeamResults').innerHTML = `<p class="provider-success">Elenco sincronizado: ${data.imported_count} atletas. Fonte consultada em ${new Date(data.synced_at).toLocaleString('pt-BR')}.</p>`;
    const updatedClub = {...club,external_provider:'api-football',external_club_id:String(providerTeamId)};
    state.clubs = state.clubs.map((item) => item.id === club.id ? updatedClub : item);
    await loadClubRoster(updatedClub);
  } catch (error) {
    console.error('Importação do elenco:',error);
    showToast(error.message || 'Não foi possível importar o elenco.', 'error');
    button.disabled = false;
    button.textContent = 'TENTAR NOVAMENTE';
  }
}

function setCatalogStatus(message, mode = '') {
  const el = $('catalogStatus');
  el.className = `catalog-status ${mode}`;
  el.innerHTML = `<span class="status-dot"></span>${esc(message)}`;
  const online = $('connectionStatus');
  online.classList.toggle('connected', mode === 'success');
  online.innerHTML = `<i></i>${mode === 'success' ? 'CATÁLOGO SUPABASE CONECTADO' : mode === 'warning' ? 'MODO DE PRÉVIA' : 'CONECTANDO AO CATÁLOGO'}`;
}

function flattenClub(row) {
  const group = row.game_catalog_groups || {};
  return {
    ...row,
    region_code: group.region_code || (row.country_code === 'BR' ? 'brasil' : 'europa'),
    season_label: group.season_label || (row.country_code === 'BR' ? '2026' : '2026/27'),
    group_name: group.name || (row.country_code === 'BR' ? 'Brasileirão Série A' : 'Principais clubes europeus')
  };
}

async function initializeSupabase() {
  const config = window.COPA_SUPABASE_CONFIG || {};
  const url = config.url;
  const key = config.publishableKey;
  if (!url || !key || String(url).includes('COLE_AQUI') || String(key).includes('COLE_AQUI') || !window.supabase?.createClient) {
    state.clubs = CLUB_CATALOG_FALLBACK;
    state.selectedClubId = state.clubs[0].id;
    setCopaTeamsStatus('Configure o Supabase e entre pela Central da Copa para carregar os times cadastrados.', 'warning');
    renderCopaTeamGrid();
    renderCopaTeamWorkspace();
    renderAll();
    setCatalogStatus('Prévia local exibida. Configure o Supabase para habilitar o salvamento.', 'warning');
    return;
  }

  try {
    state.client = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data: sessionData, error: sessionError } = await state.client.auth.getSession();
    if (sessionError) throw sessionError;
    state.session = sessionData?.session || null;
    if (state.session) {
      const { data: role, error: roleError } = await state.client.rpc('copa_get_role');
      if (roleError) throw roleError;
      state.role = role;
      if (!['admin','torcedor'].includes(role)) state.session = null;
    }

    await loadCopaTeamsFromCloud();

    const { data, error } = await state.client
      .from('game_clubs')
      .select('id,slug,name,short_name,country_name,country_code,city,league_name,primary_color,secondary_color,accent_color,badge_initials,display_order,catalog_group_id,game_catalog_groups(name,slug,season_label,region_code)')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) throw error;
    state.clubs = (data || []).map(flattenClub).sort((a, b) => (a.region_code === b.region_code ? a.display_order - b.display_order : (a.region_code === 'brasil' ? -1 : 1)));
    state.dbReady = true;
    if (!state.clubs.length) {
      state.clubs = CLUB_CATALOG_FALLBACK;
      setCatalogStatus('O catálogo ainda não foi semeado. Execute o SQL de Jogo Online no Supabase.', 'warning');
    } else {
      setCatalogStatus(`Catálogo carregado do Supabase · ${state.clubs.length} clubes disponíveis.`, 'success');
    }

    if (state.session) await loadSavedClubs();
    const savedClubId = state.savedSquads.find((saved) => state.clubs.some((club) => String(club.id) === String(saved.club_id)))?.club_id;
    state.selectedClubId = savedClubId || state.clubs[0]?.id || null;
  } catch (error) {
    console.error('Falha ao carregar catálogo do Supabase:', error);
    state.clubs = CLUB_CATALOG_FALLBACK;
    state.selectedClubId = state.clubs[0].id;
    setCatalogStatus('Não foi possível consultar o catálogo do Supabase. Exibindo prévia local. Confira a migração e sua sessão.', 'warning');
  }
  renderAll();
}

async function loadSavedClubs() {
  const { data, error } = await state.client
    .from('game_user_squads')
    .select('id,club_id,season_label,formation,status,updated_at')
    .eq('user_id', state.session.user.id)
    .order('updated_at', { ascending: false });
  if (error) {
    console.warn('Não foi possível carregar clubes já escolhidos:', error);
    return;
  }
  state.savedSquads = data || [];
}

async function saveSelectedClub(club, button) {
  if (!state.client || !state.dbReady || isLocalId(club.id)) {
    showToast('Esta é uma prévia visual. Execute a migração do catálogo no Supabase para salvar o clube.', 'warning');
    return;
  }
  if (!state.session) {
    showToast('Entre primeiro na Central da Copa com sua senha ADM ou Torcedor. Depois volte ao Jogo Online.', 'warning');
    return;
  }
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = 'SALVANDO...';
  try {
    const payload = {
      user_id: state.session.user.id,
      club_id: club.id,
      season_label: club.season_label,
      squad_name: `${club.name} · Meu clube online`,
      formation: '2-1',
      status: 'draft'
    };
    const { data, error } = await state.client
      .from('game_user_squads')
      .upsert(payload, { onConflict: 'user_id,club_id,season_label' })
      .select('id,club_id,season_label,formation,status,updated_at')
      .single();
    if (error) throw error;
    state.savedSquads = [data, ...state.savedSquads.filter((item) => item.id !== data.id)];
    $('selectionSaveNote').textContent = 'Clube salvo no seu perfil. A próxima etapa será importar o elenco oficial e montar titulares e reservas.';
    button.textContent = 'CLUBE SALVO ✓';
    showToast(`${club.name} foi salvo no seu perfil.`, 'success');
  } catch (error) {
    console.error('Erro ao salvar clube:', error);
    showToast(error.message || 'Não foi possível salvar o clube. Confira as políticas RLS.', 'error');
    button.innerHTML = original;
    button.disabled = false;
  }
}

/* =====================================================================
   TIMES DA COPA · FONTE: public.copa_state (cadastro oficial da empresa)
   A seleção usa os nomes, fotos, níveis e times já sincronizados pela Copa.
   ===================================================================== */
function normalizeCopaPlayerKey(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function copaInitials(value) {
  return String(value || 'Jogador').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('pt-BR');
}

function copaStars(level) {
  const rating = Math.max(0, Math.min(5, Number(level) || 0));
  return `<span class="copa-stars" aria-label="${rating} de 5 estrelas">${[1,2,3,4,5].map((star) => `<i class="${star <= rating ? 'on' : ''}">★</i>`).join('')}</span>`;
}

function copaAvatar(player, className = 'copa-player-avatar') {
  const image = player?.photoUrl || '';
  return `<span class="${className}">${image ? `<img src="${esc(image)}" alt="Foto de ${esc(player.name)}" loading="lazy">` : `<b>${esc(copaInitials(player?.name))}</b>`}</span>`;
}

function copaTeamBadge(team, large = false) {
  const image = team?.photoUrl || '';
  if (image) return `<span class="copa-team-badge ${large ? 'large' : ''}"><img src="${esc(image)}" alt="Escudo de ${esc(team.name)}"></span>`;
  return `<span class="copa-team-badge ${large ? 'large' : ''} fallback"><b>${esc(copaInitials(team?.name))}</b></span>`;
}

async function signedCopaPhoto(value) {
  if (!value || typeof value !== 'string') return '';
  if (/^(data:image\/|https?:\/\/)/i.test(value)) return value;
  if (!state.client) return '';
  try {
    const { data, error } = await state.client.storage.from('copa-fotos').createSignedUrl(value, 60 * 60);
    if (error) throw error;
    return data?.signedUrl || '';
  } catch (error) {
    console.warn('Não foi possível gerar link temporário da foto da Copa:', error);
    return '';
  }
}

function setCopaTeamsStatus(message, mode = '') {
  const el = $('copaTeamsStatus');
  if (!el) return;
  el.className = `copa-source-status ${mode}`;
  el.innerHTML = `<span class="status-dot"></span>${esc(message)}`;
}

async function loadCopaTeamsFromCloud() {
  state.copaTeamsLoaded = false;
  if (!state.client || !state.session || !['admin', 'torcedor'].includes(state.role)) {
    state.copaTeams = [];
    setCopaTeamsStatus('Entre primeiro na Central da Copa com sua senha ADM ou Torcedor. Depois volte ao Jogo Online.', 'warning');
    renderCopaTeamGrid();
    renderCopaTeamWorkspace();
    return;
  }

  setCopaTeamsStatus('Carregando os participantes e times sincronizados da Copa...');
  try {
    const { data, error } = await state.client
      .from('copa_state')
      .select('payload,updated_at')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    const payload = data?.payload || {};
    const names = Array.isArray(payload.players) ? payload.players : [];
    const levels = payload.playerLevels && typeof payload.playerLevels === 'object' ? payload.playerLevels : {};
    const photos = payload.playerPhotos && typeof payload.playerPhotos === 'object' ? payload.playerPhotos : {};
    const teams = Array.isArray(payload.teams) ? payload.teams : [];
    state.copaSnapshotUpdatedAt = data?.updated_at || null;

    const photoValues = new Map();
    const normalizedPlayers = new Map(names.map((name) => [normalizeCopaPlayerKey(name), String(name).trim()]));
    const getPhotoPath = (name) => photos[normalizeCopaPlayerKey(name)] || '';

    state.copaTeams = teams.map((team, index) => {
      const rosterNames = Array.isArray(team.players) ? team.players : [];
      return {
        sourceId: String(team.id || `copa-team-${index + 1}`),
        name: String(team.name || `Time ${index + 1}`),
        flag: team.flag || '⚽',
        dark: team.dark || '#352319',
        mid: team.mid || '#68472e',
        photoPath: team.photo || '',
        photoUrl: '',
        players: rosterNames.map((rawName) => {
          const name = normalizedPlayers.get(normalizeCopaPlayerKey(rawName)) || String(rawName || '').trim();
          const key = normalizeCopaPlayerKey(name);
          const numericLevel = Number(levels[key] || 0);
          return {
            key,
            name,
            level: Number.isInteger(numericLevel) && numericLevel >= 1 && numericLevel <= 5 ? numericLevel : 0,
            photoPath: getPhotoPath(name),
            photoUrl: ''
          };
        }).filter((player) => player.name)
      };
    });

    const photoJobs = [];
    state.copaTeams.forEach((team) => {
      if (team.photoPath) photoJobs.push(signedCopaPhoto(team.photoPath).then((url) => { team.photoUrl = url; }));
      team.players.forEach((player) => {
        if (player.photoPath && !photoValues.has(player.photoPath)) {
          const job = signedCopaPhoto(player.photoPath).then((url) => photoValues.set(player.photoPath, url));
          photoJobs.push(job);
        }
      });
    });
    await Promise.all(photoJobs);
    state.copaTeams.forEach((team) => team.players.forEach((player) => { player.photoUrl = photoValues.get(player.photoPath) || ''; }));

    const savedSelectedId = localStorage.getItem('copaJogoOnlineSelectedTeam') || '';
    state.selectedCopaTeamId = state.copaTeams.some((team) => team.sourceId === savedSelectedId)
      ? savedSelectedId
      : state.copaTeams[0]?.sourceId || null;
    state.copaTeamsLoaded = true;

    if (!names.length) {
      setCopaTeamsStatus('O cadastro de participantes da Copa está vazio. O ADM precisa inscrever os colaboradores.', 'warning');
    } else if (!teams.length) {
      setCopaTeamsStatus(`${names.length} participantes cadastrados, mas ainda não há times sorteados e sincronizados.`, 'warning');
    } else {
      const totalPlayers = state.copaTeams.reduce((sum, team) => sum + team.players.length, 0);
      const lastSync = data?.updated_at ? new Date(data.updated_at).toLocaleString('pt-BR') : 'data não informada';
      setCopaTeamsStatus(`${teams.length} times · ${totalPlayers} atletas distribuídos · sincronização ${lastSync}.`, 'success');
    }
    renderCopaTeamGrid();
    await loadSavedCopaLineupForSelectedTeam();
    renderCopaTeamWorkspace();
  } catch (error) {
    console.error('Falha ao carregar os times da Copa:', error);
    state.copaTeams = [];
    setCopaTeamsStatus(error.message || 'Não foi possível consultar copa_state. Verifique o login, a sincronização da Copa e as políticas RLS.', 'error');
    renderCopaTeamGrid();
    renderCopaTeamWorkspace();
  }
}

function renderCopaTeamGrid() {
  const grid = $('copaTeamGrid');
  if (!grid) return;
  const totalTeams = state.copaTeams.length;
  const totalPlayers = state.copaTeams.reduce((sum, team) => sum + team.players.length, 0);
  if ($('copaTeamTotal')) $('copaTeamTotal').textContent = String(totalTeams).padStart(2, '0');
  if ($('copaPlayerTotal')) $('copaPlayerTotal').textContent = String(totalPlayers).padStart(2, '0');
  if (!totalTeams) {
    const hasSession = Boolean(state.session);
    grid.innerHTML = `<div class="copa-empty-state">${hasSession ? '<strong>Nenhum time disponível ainda</strong><p>O ADM precisa concluir o sorteio na Copa e aguardar a sincronização com o Supabase. Depois clique em “Atualizar times”.</p><a href="index.html" class="copa-empty-link">VOLTAR À CENTRAL DA COPA →</a>' : '<strong>É necessário entrar na Copa</strong><p>Abra a Central da Copa, entre com sua senha e depois volte para esta página.</p><a href="index.html" class="copa-empty-link">IR PARA A CENTRAL →</a>'}</div>`;
    return;
  }
  grid.innerHTML = state.copaTeams.map((team) => {
    const avg = team.players.length ? team.players.reduce((sum, player) => sum + player.level, 0) / team.players.length : 0;
    return `<button type="button" class="copa-team-card ${team.sourceId === state.selectedCopaTeamId ? 'selected' : ''}" data-copa-team-id="${esc(team.sourceId)}">
      ${copaTeamBadge(team)}
      <span class="copa-team-card-copy"><strong>${esc(team.name)}</strong><small>${team.players.length} jogadores · nível médio ${avg ? avg.toFixed(1).replace('.', ',') : '—'}</small></span>
      <span class="copa-team-card-arrow">›</span>
    </button>`;
  }).join('');
}

const COPA_GAME_POSITIONS = [
  { code: 'GK', label: 'GOLEIRO', slot: 1 },
  { code: 'DEF1', label: 'ZAGUEIRO ESQ.', slot: 2 },
  { code: 'DEF2', label: 'ZAGUEIRO DIR.', slot: 3 },
  { code: 'MID1', label: 'MEIO ESQ.', slot: 4 },
  { code: 'MID2', label: 'MEIO CENTRAL', slot: 5 },
  { code: 'MID3', label: 'MEIO DIR.', slot: 6 },
  { code: 'ATT', label: 'ATACANTE', slot: 7 }
];
const COPA_BENCH_SLOTS = [8, 9, 10, 11, 12];
const COPA_FORMATION_LABEL = '2–3–1';

async function loadSavedCopaLineupForSelectedTeam() {
  state.copaLineup = {};
  state.copaSavedLineupId = null;
  state.copaLegacyLineupNeedsUpdate = false;
  const team = state.copaTeams.find((item) => item.sourceId === state.selectedCopaTeamId);
  if (!team || !state.client || !state.session) return;
  try {
    const { data, error } = await state.client.from('game_copa_user_squads')
      .select('id,source_team_id,team_name,formation,lineup,starting_lineup,bench_lineup,lineup_version,status,source_state_updated_at,updated_at')
      .eq('user_id', state.session.user.id)
      .eq('source_team_id', team.sourceId)
      .maybeSingle();
    if (error) throw error;
    state.copaLineupSchemaReady = true;
    if (!data) return;
    const validKeys = new Set(team.players.map((player) => player.key));
    const restore = (items, isStarter) => {
      (Array.isArray(items) ? items : []).forEach((saved) => {
        const key = normalizeCopaPlayerKey(saved.player_key || saved.player_name);
        if (!validKeys.has(key)) return;
        const player = team.players.find((item) => item.key === key);
        if (!player) return;
        state.copaLineup[key] = {
          player_key: key,
          player_name: player.name,
          level: player.level,
          photoPath: player.photoPath,
          photoUrl: player.photoUrl,
          position_code: saved.position_code || null,
          slot_number: Number(saved.slot_number || 0),
          is_starter: isStarter
        };
      });
    };
    restore(data.starting_lineup, true);
    restore(data.bench_lineup, false);
    const starters = Object.values(state.copaLineup).filter((item) => item.is_starter);
    const complete = starters.length === 7 && COPA_GAME_POSITIONS.every((position) => starters.some((player) => player.slot_number === position.slot && player.position_code === position.code));
    // A escalação antiga de 4x4 continua preservada no banco, mas precisa ser refeita para 7x7.
    if (data.status === 'ready' && complete) state.copaSavedLineupId = data.id;
    else if (Array.isArray(data.lineup) && data.lineup.length) {
      state.copaLegacyLineupNeedsUpdate = true;
    }
  } catch (error) {
    state.copaLineupSchemaReady = false;
    console.warn('Escalação 7x7 ainda não disponível. Execute SUPABASE_FUTEBOL_ARENA_7X7.sql.', error);
  }
}

function renderCopaTeamWorkspace() {
  const workspace = $('copaTeamWorkspace');
  if (!workspace) return;
  const team = state.copaTeams.find((item) => item.sourceId === state.selectedCopaTeamId);
  if (!team) {
    workspace.innerHTML = '<div class="copa-empty-state large"><div class="copa-empty-ball">⚽</div><strong>Selecione um time para começar</strong><p>Os jogadores, fotos e níveis serão carregados automaticamente do cadastro oficial da Copa.</p></div>';
    return;
  }
  const selected = Object.values(state.copaLineup);
  const starters = selected.filter((item) => item.is_starter);
  const reserves = selected.filter((item) => !item.is_starter);
  const average = team.players.length ? team.players.reduce((sum, player) => sum + player.level, 0) / team.players.length : 0;
  const complete = starters.length === 7 && COPA_GAME_POSITIONS.every((position) => starters.some((player) => player.slot_number === position.slot && player.position_code === position.code));
  const pitchSlots = COPA_GAME_POSITIONS.map((position) => {
    const player = starters.find((item) => item.slot_number === position.slot);
    return `<div class="copa-pitch-slot ${player ? 'occupied' : ''}" data-pitch-slot="${position.slot}">${player ? copaAvatar(player, 'copa-pitch-avatar') : '<span class="copa-pitch-placeholder">+</span>'}<small>${position.label}</small><strong>${player ? esc(player.player_name) : 'VAGA LIVRE'}</strong></div>`;
  }).join('');
  const bench = COPA_BENCH_SLOTS.map((slot) => {
    const player = reserves.find((item) => item.slot_number === slot);
    return `<div class="copa-bench-slot ${player ? 'occupied' : ''}">${player ? copaAvatar(player, 'copa-bench-avatar') : '<span class="copa-bench-plus">+</span>'}<span>${player ? esc(player.player_name) : `RESERVA ${slot - 7}`}</span></div>`;
  }).join('');
  const rosterCards = team.players.map((player) => {
    const entry = state.copaLineup[player.key];
    const currentPosition = entry?.position_code || '';
    const status = !entry ? 'DISPONÍVEL' : entry.is_starter ? COPA_GAME_POSITIONS.find((pos) => pos.slot === entry.slot_number)?.label || 'TITULAR' : 'RESERVA';
    return `<article class="copa-roster-card ${entry ? 'selected' : ''}" data-copa-player-key="${esc(player.key)}">
      ${copaAvatar(player, 'copa-roster-avatar')}
      <div class="copa-roster-player-copy"><strong>${esc(player.name)}</strong><small>${player.level ? `${player.level}/5 · ${['','Iniciante','Básico','Intermediário','Avançado','Destaque'][player.level]}` : 'NÍVEL NÃO DEFINIDO'}</small>${copaStars(player.level)}<em>${status}</em></div>
      <div class="copa-roster-actions">
        <select class="copa-position-select" data-copa-position aria-label="Posição de ${esc(player.name)}"><option value="" ${!currentPosition ? 'selected' : ''}>POSIÇÃO</option>${COPA_GAME_POSITIONS.map((pos) => `<option value="${pos.code}" ${currentPosition === pos.code ? 'selected' : ''}>${pos.label}</option>`).join('')}</select>
        <button type="button" class="copa-action-btn" data-copa-action="starter" ${entry && !entry.is_starter ? 'disabled' : ''}>TITULAR</button>
        <button type="button" class="copa-action-btn secondary" data-copa-action="reserve" ${entry && !entry.is_starter ? 'disabled' : ''}>RESERVA</button>
        ${entry ? '<button type="button" class="copa-remove-btn" data-copa-action="remove">RETIRAR</button>' : ''}
      </div>
    </article>`;
  }).join('');

  workspace.innerHTML = `
    <div class="copa-selected-team-heading">
      <div class="copa-selected-team-identity">${copaTeamBadge(team, true)}<div><span class="eyebrow eyebrow-muted">TIME DA COPA</span><h3>${esc(team.name)}</h3><p>${team.players.length} jogadores · nível médio ${average ? average.toFixed(1).replace('.', ',') : 'não avaliado'}</p></div></div>
      <div class="copa-selected-team-summary"><strong>${starters.length}/7</strong><span>TITULARES</span><strong>${reserves.length}/5</strong><span>RESERVAS</span></div>
    </div>
    ${team.players.length < 7 ? `<div class="copa-warning-note">Este time tem ${team.players.length} jogador(es). São necessários pelo menos 7 participantes no elenco para montar a escalação 7x7.</div>` : ''}
    ${state.copaLegacyLineupNeedsUpdate ? '<div class="copa-warning-note">Sua escalação anterior era 4x4. Monte novamente os sete titulares e salve para jogar no Futebol Arena 3D.</div>' : ''}
    ${!state.copaLineupSchemaReady ? `<div class="copa-warning-note">Para salvar a escalação 7x7, execute a migração <strong>SUPABASE_FUTEBOL_ARENA_7X7.sql</strong> no SQL Editor do Supabase.</div>` : ''}
    <div class="copa-lineup-editor">
      <section class="copa-tactics-column">
        <div class="copa-subheading"><div><span class="eyebrow eyebrow-muted">FORMAÇÃO INICIAL</span><h4>${COPA_FORMATION_LABEL}</h4></div><span>7 TITULARES</span></div>
        <div class="copa-mini-pitch copa-mini-pitch-7"><div class="copa-pitch-center-circle"></div><div class="copa-pitch-midline"></div><div class="copa-pitch-goal top"></div><div class="copa-pitch-goal bottom"></div><div class="copa-pitch-slots">${pitchSlots}</div></div>
        <div class="copa-bench-heading"><strong>BANCO DE RESERVAS</strong><span>${reserves.length}/5</span></div>
        <div class="copa-bench-grid copa-bench-grid-5">${bench}</div>
        <button type="button" class="copa-save-lineup-btn" id="saveCopaLineupBtn" ${complete && state.copaLineupSchemaReady ? '' : 'disabled'}>${state.copaSavedLineupId ? 'ATUALIZAR ESCALAÇÃO' : 'SALVAR ESCALAÇÃO 7X7'}</button>
        <p class="copa-lineup-help">Defina 1 goleiro, 2 defensores, 3 meio-campistas e 1 atacante. Você pode escolher até cinco reservas.</p>
        <button type="button" class="copa-ai-start-btn" data-copa-play-ai ${complete && state.copaSavedLineupId ? '' : 'disabled'}>⚽ JOGAR NO FUTEBOL ARENA 3D</button>
        <button type="button" class="copa-room-disabled-btn" disabled>PARTIDA MULTIPLAYER ONLINE · PRÓXIMA ETAPA</button>
      </section>
      <section class="copa-roster-column"><div class="copa-subheading"><div><span class="eyebrow eyebrow-muted">ELENCO DISPONÍVEL</span><h4>Escolha seus atletas</h4></div><span>${team.players.length} JOGADORES</span></div><div class="copa-roster-list">${rosterCards || '<div class="copa-empty-state">Este time ainda não possui jogadores vinculados.</div>'}</div></section>
    </div>`;
  $('saveCopaLineupBtn')?.addEventListener('click', saveCopaLineup);
}

function handleCopaRosterAction(event) {
  const button = event.target.closest('[data-copa-action]');
  if (!button) return;
  const card = button.closest('[data-copa-player-key]');
  const key = card?.dataset.copaPlayerKey;
  const team = state.copaTeams.find((item) => item.sourceId === state.selectedCopaTeamId);
  const player = team?.players.find((item) => item.key === key);
  if (!player) return;
  const action = button.dataset.copaAction;
  const existing = state.copaLineup[key];
  if (action === 'remove') {
    delete state.copaLineup[key];
  } else if (action === 'starter') {
    const positionCode = card.querySelector('[data-copa-position]')?.value || '';
    const position = COPA_GAME_POSITIONS.find((item) => item.code === positionCode);
    if (!position) return showToast('Escolha a posição do jogador antes de escalá-lo.', 'warning');
    const occupied = Object.values(state.copaLineup).find((item) => item.is_starter && item.slot_number === position.slot && item.player_key !== key);
    if (occupied) return showToast(`A vaga ${position.label} já está ocupada.`, 'warning');
    if (!existing?.is_starter && Object.values(state.copaLineup).filter((item) => item.is_starter).length >= 7) return showToast('Os sete titulares já estão definidos.', 'warning');
    state.copaLineup[key] = {player_key:key,player_name:player.name,level:player.level,photoPath:player.photoPath,photoUrl:player.photoUrl,position_code:position.code,slot_number:position.slot,is_starter:true};
  } else if (action === 'reserve') {
    const reserveCount = Object.values(state.copaLineup).filter((item) => !item.is_starter).length;
    if (!existing && reserveCount >= 5) return showToast('O banco tem espaço para até cinco reservas.', 'warning');
    if (existing?.is_starter && reserveCount >= 5) return showToast('O banco já está completo. Retire um reserva antes.', 'warning');
    const slot = COPA_BENCH_SLOTS.find((number) => !Object.values(state.copaLineup).some((item) => !item.is_starter && item.slot_number === number && item.player_key !== key));
    if (!slot) return showToast('As cinco vagas de reserva já estão ocupadas.', 'warning');
    state.copaLineup[key] = {player_key:key,player_name:player.name,level:player.level,photoPath:player.photoPath,photoUrl:player.photoUrl,position_code:null,slot_number:slot,is_starter:false};
  }
  state.copaSavedLineupId = null;
  state.copaLegacyLineupNeedsUpdate = false;
  renderCopaTeamWorkspace();
}

async function saveCopaLineup() {
  const team = state.copaTeams.find((item) => item.sourceId === state.selectedCopaTeamId);
  if (!team || !state.client || !state.session || !state.role) return showToast('Entre na Central da Copa para salvar sua escalação.', 'warning');
  const selected = Object.values(state.copaLineup);
  const starters = selected.filter((item) => item.is_starter).sort((a,b) => a.slot_number - b.slot_number);
  const reserves = selected.filter((item) => !item.is_starter).sort((a,b) => a.slot_number - b.slot_number);
  const complete = starters.length === 7 && COPA_GAME_POSITIONS.every((position) => starters.some((player) => player.slot_number === position.slot && player.position_code === position.code));
  if (!complete) return showToast('Complete os sete titulares: 1 goleiro, 2 defensores, 3 meio-campistas e 1 atacante.', 'warning');
  if (reserves.length > 5) return showToast('A escalação permite até cinco reservas.', 'warning');

  const button = $('saveCopaLineupBtn');
  if (button) { button.disabled = true; button.textContent = 'SALVANDO ESCALAÇÃO...'; }
  const toSnapshot = (player, isStarter) => ({
    player_key: player.player_key,
    player_name: player.player_name,
    level: player.level,
    photo_path: player.photoPath || null,
    position_code: player.position_code,
    slot_number: player.slot_number,
    is_starter: isStarter
  });
  try {
    const { data, error } = await state.client.from('game_copa_user_squads').upsert({
      user_id: state.session.user.id,
      source_team_id: team.sourceId,
      team_name: team.name,
      team_photo_path: team.photoPath || null,
      formation: '2-3-1',
      starting_lineup: starters.map((player) => toSnapshot(player, true)),
      bench_lineup: reserves.map((player) => toSnapshot(player, false)),
      lineup_version: 2,
      source_state_updated_at: state.copaSnapshotUpdatedAt,
      status: 'ready',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,source_team_id' })
      .select('id,source_team_id,team_name,formation,starting_lineup,bench_lineup,lineup_version,status,updated_at')
      .single();
    if (error) throw error;
    state.copaSavedLineupId = data.id;
    state.copaLegacyLineupNeedsUpdate = false;
    showToast(`Escalação 7x7 do ${team.name} salva no Supabase.`, 'success');
    renderCopaTeamWorkspace();
  } catch (error) {
    console.error('Erro ao salvar escalação 7x7:', error);
    showToast(error.message || 'Não foi possível salvar. Confira se a migração SUPABASE_FUTEBOL_ARENA_7X7.sql foi executada.', 'error');
    if (button) { button.disabled = false; button.textContent = 'TENTAR NOVAMENTE'; }
  }
}

function bindCopaTeamEvents() {
  $('copaTeamGrid')?.addEventListener('click', async (event) => {
    const card = event.target.closest('[data-copa-team-id]');
    if (!card) return;
    state.selectedCopaTeamId = card.dataset.copaTeamId;
    localStorage.setItem('copaJogoOnlineSelectedTeam', state.selectedCopaTeamId);
    state.copaLineup = {};
    state.copaSavedLineupId = null;
    renderCopaTeamGrid();
    renderCopaTeamWorkspace();
    await loadSavedCopaLineupForSelectedTeam();
    renderCopaTeamWorkspace();
  });
  $('copaTeamWorkspace')?.addEventListener('click', (event) => {
    const playButton = event.target.closest('[data-copa-play-ai]');
    if (playButton) {
      const team = state.copaTeams.find((item) => item.sourceId === state.selectedCopaTeamId);
      if (!team || !state.copaSavedLineupId) return showToast('Salve uma escalação completa antes de iniciar a partida.', 'warning');
      window.location.href = `partida.html?mode=ai&teamId=${encodeURIComponent(team.sourceId)}`;
      return;
    }
    handleCopaRosterAction(event);
  });
  $('reloadCopaTeamsBtn')?.addEventListener('click', () => loadCopaTeamsFromCloud());
  $('onlineModeInfoBtn')?.addEventListener('click', () => showToast('O modo contra outra pessoa será ativado quando o servidor multiplayer estiver publicado. Por enquanto, jogue contra a IA.', 'warning'));
  $('chooseAiModeBtn')?.addEventListener('click', () => window.setTimeout(() => $('copaTeamsPanel')?.scrollIntoView({behavior:'smooth',block:'start'}), 80));
}

function showToast(message, mode = '') {
  const toast = $('gameToast');
  toast.textContent = message;
  toast.className = `game-toast show ${mode}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.className = 'game-toast'; }, 3600);
}

function renderAll() {
  renderCopaTeamGrid();
  renderCopaTeamWorkspace();
  renderClubGrid();
  renderSelectedClub();
}

function bindEvents() {
  document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    renderClubGrid();
  }));

  $('clubSearch').addEventListener('input', (event) => {
    state.query = event.target.value || '';
    renderClubGrid();
  });

  $('clubGrid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-club-id]');
    if (!button) return;
    state.selectedClubId = button.dataset.clubId;
    renderAll();
    $('clubDetailSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

bindEvents();
bindCopaTeamEvents();
initializeSupabase();
