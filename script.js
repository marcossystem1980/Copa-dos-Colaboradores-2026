'use strict';

const STORAGE_KEY = 'copaColaboradores2026_v2';
const LEGACY_STORAGE_KEY = 'copaColaboradores2026_v1';
const DEFAULT_SETTINGS = {
  eventName: 'Copa dos Colaboradores 2026',
  companyName: 'Grupo Zanol & Thomaz',
  teamCount: 8
};
const PLAYER_LEVELS = { 1: 'Iniciante', 2: 'Básico', 3: 'Intermediário', 4: 'Avançado', 5: 'Destaque' };
const NATIONS = [
  { name: 'Brasil', flag: '🇧🇷', dark: '#174c38', mid: '#2f7250' },
  { name: 'Argentina', flag: '🇦🇷', dark: '#24516b', mid: '#367f9c' },
  { name: 'Portugal', flag: '🇵🇹', dark: '#174b39', mid: '#a34c36' },
  { name: 'França', flag: '🇫🇷', dark: '#203b6b', mid: '#4c6197' },
  { name: 'Alemanha', flag: '🇩🇪', dark: '#282521', mid: '#65574a' },
  { name: 'Espanha', flag: '🇪🇸', dark: '#8d302e', mid: '#b66a36' },
  { name: 'Inglaterra', flag: '🇬🇧', dark: '#2e3b4d', mid: '#5b6a7c' },
  { name: 'Itália', flag: '🇮🇹', dark: '#20594a', mid: '#407e67' },
  { name: 'Uruguai', flag: '🇺🇾', dark: '#23618a', mid: '#5693b7' },
  { name: 'Croácia', flag: '🇭🇷', dark: '#742f3d', mid: '#a44c56' },
  { name: 'Japão', flag: '🇯🇵', dark: '#353b4d', mid: '#686e84' },
  { name: 'México', flag: '🇲🇽', dark: '#22503c', mid: '#478060' },
  { name: 'Holanda', flag: '🇳🇱', dark: '#a34e26', mid: '#cc7944' },
  { name: 'Marrocos', flag: '🇲🇦', dark: '#6b2630', mid: '#a23f43' },
  { name: 'Bélgica', flag: '🇧🇪', dark: '#433126', mid: '#80603d' },
  { name: 'Colômbia', flag: '🇨🇴', dark: '#8a5b19', mid: '#b88d31' }
];
const GROUP_LETTERS = ['A', 'B', 'C', 'D'];
function createDefaultTeamProfiles(count) {
  return NATIONS.slice(0, count).map((nation) => ({ name: nation.name, flag: nation.flag, dark: nation.dark, mid: nation.mid, photo: '' }));
}

function freshState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    players: [],
    playerLevels: {},
    playerPhotos: {},
    drawProgress: null,
    teams: [],
    groups: [],
    groupMatches: [],
    playoffRounds: [],
    createdAt: null,
    completedAt: null
  };
}
let migratedFromLegacy = false;
function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeLoadedState(JSON.parse(current));
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      const migrated = freshState();
      migrated.settings = { ...migrated.settings, ...(legacy.settings || {}), companyLogo: undefined };
      migrated.players = Array.isArray(legacy.players) ? legacy.players : [];
      migrated.playerLevels = legacy.playerLevels && typeof legacy.playerLevels === 'object' ? legacy.playerLevels : {};
      // A estrutura da competição mudou; antigos placares de chaveamento não são copiados.
      migrated.settings.teamCount = clampNumber(migrated.settings.teamCount, 2, 16, 8);
      delete migrated.settings.playersPerTeam;
      migratedFromLegacy = true;
      return migrated;
    }
  } catch (error) {
    console.warn('Não foi possível carregar os dados anteriores.', error);
  }
  return freshState();
}
function normalizeLoadedState(parsed) {
  const base = freshState();
  const next = { ...base, ...(parsed || {}) };
  next.settings = { ...base.settings, ...(parsed?.settings || {}) };
  delete next.settings.companyLogo;
  next.players = Array.isArray(next.players) ? next.players.map(normalizeName).filter(Boolean) : [];
  next.playerLevels = next.playerLevels && typeof next.playerLevels === 'object' ? next.playerLevels : {};
  next.playerPhotos = next.playerPhotos && typeof next.playerPhotos === 'object' ? next.playerPhotos : {};
  next.drawProgress = next.drawProgress && typeof next.drawProgress === 'object' && Array.isArray(next.drawProgress.plan) && Array.isArray(next.drawProgress.teams) ? next.drawProgress : null;
  next.teams = Array.isArray(next.teams) ? next.teams : [];
  next.groups = Array.isArray(next.groups) ? next.groups : [];
  next.groupMatches = Array.isArray(next.groupMatches) ? next.groupMatches : [];
  next.playoffRounds = Array.isArray(next.playoffRounds) ? next.playoffRounds : [];
  next.settings.teamCount = clampNumber(next.settings.teamCount, 2, 16, 8);
  delete next.settings.playersPerTeam;
  const savedProfiles = Array.isArray(next.settings.teamProfiles) ? next.settings.teamProfiles : (next.teams.length ? next.teams : []);
  const defaults = createDefaultTeamProfiles(next.settings.teamCount);
  next.settings.teamProfiles = Array.from({ length: next.settings.teamCount }, (_, index) => {
    const profile = savedProfiles[index] || defaults[index] || {};
    const fallback = defaults[index] || NATIONS[index % NATIONS.length];
    return { name: normalizeName(profile.name) || fallback.name, flag: profile.flag || fallback.flag, dark: profile.dark || fallback.dark, mid: profile.mid || fallback.mid, photo: typeof profile.photo === 'string' ? profile.photo : '' };
  });
  // Guard against a backup from the first version, whose tournament fields had a different format.
  if (!Array.isArray(next.groups) || !Array.isArray(next.groupMatches) || !Array.isArray(next.playoffRounds)) {
    next.teams = []; next.groups = []; next.groupMatches = []; next.playoffRounds = [];
  }
  return next;
}
let state = loadState();
let currentView = 'dashboard';
let selectedMatchday = 'all';
let presentationMode = false;
let supabaseClient = null;
let currentRole = null;
let currentUserId = null;
let cloudSaveTimer = null;
let cloudSaveInFlight = false;
let cloudSavePending = false;
let applyingCloudState = false;
let appInitialized = false;
let liveChannel = null;
let photoRefreshTimer = null;
const CLOUD_TABLE = 'copa_state';
const PHOTO_BUCKET = 'copa-fotos';
const PHOTO_URL_CACHE = new Map();
const isAdmin = () => currentRole === 'admin';
const isTorcedor = () => currentRole === 'torcedor';

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const normalizeName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim();
const playerKey = (name) => normalizeName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const getTeam = (id) => state.teams.find((team) => team.id === id) || null;
const getGroup = (id) => state.groups.find((group) => group.id === id) || null;
const getGroupMatch = (id) => state.groupMatches.find((match) => match.id === id) || null;
const getKnockoutMatch = (roundIndex, matchIndex) => state.playoffRounds[roundIndex]?.matches[matchIndex] || null;
const createId = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const clampNumber = (value, min, max, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
function getPlayerLevel(name) {
  const value = Number(state.playerLevels?.[playerKey(name)] || 0);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0;
}
function playerInitials(name) {
  return normalizeName(name).split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('pt-BR') || 'J';
}
function photoDisplayUrl(value) {
  if (!value) return '';
  if (/^(data:image\/|https?:\/\/)/i.test(value)) return value;
  return PHOTO_URL_CACHE.get(value) || '';
}
function playerAvatarMarkup(name, className = 'player-avatar') {
  const photo = photoDisplayUrl(state.playerPhotos?.[playerKey(name)]);
  return `<span class="${className}">${photo ? `<img src="${escapeHtml(photo)}" alt="Foto de ${escapeHtml(name)}" loading="lazy" />` : `<b>${escapeHtml(playerInitials(name))}</b>`}</span>`;
}
function teamArtworkMarkup(team, className = 'team-artwork') {
  const photo = photoDisplayUrl(team?.photo);
  if (photo) return `<span class="${className}"><img src="${escapeHtml(photo)}" alt="Escudo de ${escapeHtml(team.name || 'time')}" /></span>`;
  return `<span class="${className} team-artwork-fallback">${escapeHtml(team?.flag || '⚽')}</span>`;
}
function levelStarsMarkup(level, className = 'level-stars') {
  const current = Number(level || 0);
  return `<span class="${className}" title="${current ? `${current} de 5 estrelas` : 'Nível não definido'}">${[1,2,3,4,5].map((star) => `<i class="${star <= current ? 'on' : ''}">★</i>`).join('')}</span>`;
}
function compressImageFile(file, maxDimension = 420) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) { reject(new Error('Selecione um arquivo de imagem.')); return; }
    if (file.size > 12 * 1024 * 1024) { reject(new Error('A imagem deve ter no máximo 12 MB.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Formato de imagem não reconhecido.'));
      image.onload = () => {
        const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/webp', 0.8);
        resolve(data);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
function getTeamProfiles() {
  const count = clampNumber(state.settings.teamCount, 2, 16, 8);
  const defaults = createDefaultTeamProfiles(count);
  if (!Array.isArray(state.settings.teamProfiles)) state.settings.teamProfiles = defaults;
  state.settings.teamProfiles = Array.from({ length: count }, (_, index) => ({ ...defaults[index], ...(state.settings.teamProfiles[index] || {}) }));
  return state.settings.teamProfiles;
}
function getAverageLevel(names) {
  const levels = (names || []).map(getPlayerLevel).filter(Boolean);
  return levels.length ? levels.reduce((sum, level) => sum + level, 0) / levels.length : 0;
}
function formatAverage(value) {
  return value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
}
function parseNames(raw) {
  const values = String(raw ?? '').replace(/^\uFEFF/, '').split(/[\r\n,;]+/).map(normalizeName).filter(Boolean);
  const unique = [];
  const seen = new Set();
  let duplicates = 0;
  values.forEach((name) => {
    const key = playerKey(name);
    if (seen.has(key)) { duplicates += 1; return; }
    seen.add(key); unique.push(name);
  });
  return { names: unique, duplicates, originalCount: values.length };
}
function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error(error);
    toast('Não foi possível atualizar o cache local. Verifique o espaço disponível.', 'error');
  }
  if (isAdmin() && supabaseClient && !applyingCloudState) scheduleCloudSave();
}
function scheduleCloudSave() {
  if (!isAdmin() || !supabaseClient || applyingCloudState) return;
  cloudSavePending = true;
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(() => saveCloudStateNow(), 650);
}
async function saveCloudStateNow() {
  if (!isAdmin() || !supabaseClient || applyingCloudState || cloudSaveInFlight) return;
  cloudSaveInFlight = true;
  cloudSavePending = false;
  const payload = JSON.parse(JSON.stringify(state));
  try {
    const { error } = await supabaseClient.from(CLOUD_TABLE).upsert({
      id: 1,
      payload,
      updated_at: new Date().toISOString(),
      updated_by: currentUserId
    }, { onConflict: 'id' });
    if (error) throw error;
  } catch (error) {
    console.error('Falha ao sincronizar a Copa com o Supabase:', error);
    toast('Não foi possível sincronizar com o Supabase. Confira sua conexão e tente novamente.', 'error');
  } finally {
    cloudSaveInFlight = false;
    if (cloudSavePending) scheduleCloudSave();
  }
}
async function uploadDataUrlToStorage(dataUrl, folder) {
  if (!supabaseClient || !isAdmin()) throw new Error('Somente o ADM pode enviar fotos.');
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;
  const path = `${folder}/${fileName}`;
  const { error } = await supabaseClient.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: 'image/webp', cacheControl: '3600', upsert: false
  });
  if (error) throw error;
  const { data: signed, error: signedError } = await supabaseClient.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  if (signedError) throw signedError;
  PHOTO_URL_CACHE.set(path, signed.signedUrl);
  return path;
}
async function migrateEmbeddedPhotosToStorage() {
  const moved = new Map();
  const migrate = async (value, folder) => {
    if (typeof value !== 'string' || !value.startsWith('data:image/')) return value || '';
    if (moved.has(value)) return moved.get(value);
    const path = await uploadDataUrlToStorage(value, folder);
    moved.set(value, path);
    return path;
  };
  for (const [key, value] of Object.entries(state.playerPhotos || {})) state.playerPhotos[key] = await migrate(value, 'jogadores');
  for (const profile of state.settings.teamProfiles || []) profile.photo = await migrate(profile.photo, 'times');
  for (const team of state.teams || []) team.photo = await migrate(team.photo, 'times');
}
async function refreshSignedPhotoUrls() {
  if (!supabaseClient) return;
  const paths = new Set();
  Object.values(state.playerPhotos || {}).forEach((value) => { if (value && !value.startsWith('data:image/') && !/^https?:\/\//i.test(value)) paths.add(value); });
  (state.settings.teamProfiles || []).forEach((profile) => { if (profile.photo && !profile.photo.startsWith('data:image/') && !/^https?:\/\//i.test(profile.photo)) paths.add(profile.photo); });
  (state.teams || []).forEach((team) => { if (team.photo && !team.photo.startsWith('data:image/') && !/^https?:\/\//i.test(team.photo)) paths.add(team.photo); });
  await Promise.all([...paths].map(async (path) => {
    const { data, error } = await supabaseClient.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
    if (!error && data?.signedUrl) PHOTO_URL_CACHE.set(path, data.signedUrl);
    else console.warn('Não foi possível gerar URL temporária da foto:', path, error);
  }));
}
async function loadCloudState() {
  const { data, error } = await supabaseClient.from(CLOUD_TABLE).select('payload, updated_at, updated_by').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (data?.payload) {
    applyingCloudState = true;
    try {
      state = normalizeLoadedState(data.payload);
      drawCeremony = state.drawProgress ? { ...state.drawProgress, running: false } : null;
      await refreshSignedPhotoUrls();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } finally {
      applyingCloudState = false;
    }
  }
  if (isAdmin()) {
    state = normalizeLoadedState(state);
    await migrateEmbeddedPhotosToStorage();
    await refreshSignedPhotoUrls();
    await saveCloudStateNow();
    return true;
  }
  state = freshState();
  drawCeremony = null;
  return false;
}
function subscribeToCloudChanges() {
  if (!supabaseClient || liveChannel) return;
  if (photoRefreshTimer) window.clearInterval(photoRefreshTimer);
  photoRefreshTimer = window.setInterval(async () => { try { await refreshSignedPhotoUrls(); renderAll(); } catch (error) { console.warn('Não foi possível renovar as imagens temporárias.', error); } }, 45 * 60 * 1000);
  liveChannel = supabaseClient.channel('copa-estado-em-tempo-real')
    .on('postgres_changes', { event: '*', schema: 'public', table: CLOUD_TABLE, filter: 'id=eq.1' }, async (payload) => {
      if (isAdmin() && (cloudSavePending || cloudSaveInFlight)) return;
      if (payload.eventType === 'DELETE' || !payload.new?.payload) return;
      try {
        applyingCloudState = true;
        state = normalizeLoadedState(payload.new.payload);
        drawCeremony = state.drawProgress ? { ...state.drawProgress, running: false } : null;
        await refreshSignedPhotoUrls();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        fillIdentityInputs(); renderAll();
        toast('A Copa foi atualizada com as informações mais recentes.', 'success');
      } catch (error) { console.error(error); }
      finally { applyingCloudState = false; }
    }).subscribe();
}
function showAuthMessage(message, type = '') {
  const target = $('authMessage');
  if (!target) return;
  target.textContent = message;
  target.className = `auth-message ${type}`;
}
function setLoginRole(role) {
  document.querySelectorAll('[data-role-choice]').forEach((button) => {
    const active = button.dataset.roleChoice === role;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  $('authForm').dataset.role = role;
  $('accessPin').value = '';
  $('accessPin').focus?.();
}
function applyRoleInterface() {
  document.body.classList.toggle('torcedor-mode', isTorcedor());
  $('accessRolePill').textContent = isAdmin() ? 'ACESSO ADM' : 'TORCEDOR · LEITURA';
  $('accessRolePill').classList.toggle('fan', isTorcedor());
  document.querySelectorAll('.admin-only, [data-admin-only]').forEach((element) => { element.hidden = !isAdmin(); });
  document.querySelectorAll('.admin-nav').forEach((element) => { element.hidden = !isAdmin(); });
}
async function signOutApp() {
  if (cloudSaveTimer) { window.clearTimeout(cloudSaveTimer); cloudSaveTimer = null; }
  if (isAdmin() && cloudSavePending) await saveCloudStateNow();
  if (liveChannel) { await supabaseClient.removeChannel(liveChannel); liveChannel = null; }
  if (photoRefreshTimer) { window.clearInterval(photoRefreshTimer); photoRefreshTimer = null; }
  await supabaseClient.auth.signOut();
  currentRole = null; currentUserId = null;
  $('appShell').hidden = true; $('authGate').hidden = false;
  document.body.classList.remove('torcedor-mode');
  $('accessPin').value = '';
  showAuthMessage('Acesso encerrado. Entre novamente para continuar.');
}
async function loginWithPin(role, pin) {
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    const { error } = await supabaseClient.auth.signInAnonymously();
    if (error) throw error;
  }
  const { data, error } = await supabaseClient.rpc('copa_login', { p_role: role, p_pin: pin });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'Senha incorreta. Confira e tente novamente.');
  const { data: userData } = await supabaseClient.auth.getUser();
  currentUserId = userData?.user?.id || null;
  currentRole = data.role;
  const hasCloudData = await loadCloudState();
  if (!hasCloudData && isTorcedor()) showAuthMessage('Ainda não há campeonato publicado. Peça ao ADM para concluir a configuração.', 'warning');
  initializeApp();
  applyRoleInterface();
  $('authGate').hidden = true; $('appShell').hidden = false;
  subscribeToCloudChanges();
  if (isAdmin()) toast('Acesso de organização liberado. Alterações serão sincronizadas com o Supabase.');
}
async function bootAuthentication() {
  const cfg = window.COPA_SUPABASE_CONFIG || {};
  const url = cfg.url || '';
  const key = cfg.publishableKey || cfg.anonKey || '';
  if (!url.startsWith('https://') || !key || /SUA_SUPABASE|COLE_AQUI|PROJECT_URL/i.test(url + key)) {
    showAuthMessage('Configure a URL e a chave pública no arquivo supabase-config.js para conectar o projeto.', 'error');
    return;
  }
  if (!window.supabase?.createClient) { showAuthMessage('Não foi possível carregar o cliente Supabase. Verifique sua conexão.', 'error'); return; }
  supabaseClient = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  document.querySelectorAll('[data-role-choice]').forEach((button) => button.addEventListener('click', () => setLoginRole(button.dataset.roleChoice)));
  $('authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const role = $('authForm').dataset.role || 'admin';
    const pin = $('accessPin').value.trim();
    if (!pin) { showAuthMessage('Digite a senha de acesso.', 'error'); return; }
    $('authSubmitBtn').disabled = true;
    $('authSubmitBtn').textContent = 'Verificando acesso...';
    showAuthMessage('Conectando ao ambiente seguro da Copa...');
    try { await loginWithPin(role, pin); }
    catch (error) { console.error(error); showAuthMessage(error.message || 'Não foi possível entrar. Verifique a configuração do Supabase.', 'error'); }
    finally { $('authSubmitBtn').disabled = false; $('authSubmitBtn').innerHTML = 'Entrar na Copa <span>→</span>'; $('accessPin').value = ''; }
  });
  $('logoutBtn').addEventListener('click', signOutApp);
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      const { data: role, error } = await supabaseClient.rpc('copa_get_role');
      if (!error && ['admin', 'torcedor'].includes(role)) {
        const { data: userData } = await supabaseClient.auth.getUser();
        currentRole = role; currentUserId = userData?.user?.id || null;
        const hasCloudData = await loadCloudState();
        if (!hasCloudData && isTorcedor()) showAuthMessage('Ainda não há campeonato publicado. Peça ao ADM para concluir a configuração.', 'warning');
        initializeApp(); applyRoleInterface();
        $('authGate').hidden = true; $('appShell').hidden = false;
        subscribeToCloudChanges();
        return;
      }
      await supabaseClient.auth.signOut();
    }
  } catch (error) { console.error(error); showAuthMessage('Não foi possível validar a sessão. Tente entrar novamente.', 'error'); }
}

function toast(message, type = 'success') {
  const region = $('toastRegion');
  if (!region) return;
  const item = document.createElement('div');
  item.className = `toast ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : ''}`;
  item.textContent = message;
  while (region.children.length >= 3) region.firstElementChild.remove();
  region.appendChild(item);
  window.setTimeout(() => item.remove(), 4200);
}
function setView(view) {
  if (isTorcedor() && ['participants', 'draw', 'settings'].includes(view)) { toast('Essa área é exclusiva da organização.', 'warning'); return; }
  if (!['dashboard', 'participants', 'teams', 'draw', 'confrontos', 'competition', 'settings'].includes(view)) return;
  currentView = view;
  document.querySelectorAll('.view').forEach((element) => element.classList.toggle('active', element.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((element) => element.classList.toggle('active', element.dataset.view === view));
  const labels = { dashboard: 'VISÃO GERAL', participants: 'INSCRITOS', teams: 'TIMES', draw: 'SORTEIO OFICIAL', confrontos: 'CONFRONTOS', competition: 'CAMPEONATO', settings: 'ORGANIZAÇÃO' };
  $('breadcrumbCurrent').textContent = labels[view] || 'CAMPEONATO';
  $('sidebar').classList.remove('open');
  if (view === 'settings') fillIdentityInputs();
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Tournament structure: group stage followed by knockout. */
function groupCountForTeamCount(teamCount) {
  if (teamCount <= 5) return 1;
  if (teamCount <= 8) return 2;
  if (teamCount <= 12) return 3;
  return 4;
}
function createGroupsAndFixtures(teams) {
  const groupCount = groupCountForTeamCount(teams.length);
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: GROUP_LETTERS[index], name: `Grupo ${GROUP_LETTERS[index]}`, teamIds: []
  }));
  const shuffledTeams = shuffle(teams);
  let direction = 1;
  let targetGroup = 0;
  shuffledTeams.forEach((team) => {
    groups[targetGroup].teamIds.push(team.id);
    targetGroup += direction;
    if (targetGroup >= groupCount) { targetGroup = groupCount - 1; direction = -1; }
    else if (targetGroup < 0) { targetGroup = 0; direction = 1; }
  });
  // Circle-method schedule, so each group has real rounds and each pair meets once.
  const groupMatches = [];
  groups.forEach((group) => {
    const ids = group.teamIds.slice();
    if (ids.length < 2) return;
    if (ids.length % 2 === 1) ids.push(null);
    const cycle = ids.slice();
    const rounds = cycle.length - 1;
    for (let round = 1; round <= rounds; round += 1) {
      for (let pair = 0; pair < cycle.length / 2; pair += 1) {
        const first = cycle[pair];
        const second = cycle[cycle.length - 1 - pair];
        if (!first || !second) continue;
        groupMatches.push({
          id: createId('gm'), groupId: group.id, round,
          team1Id: first, team2Id: second,
          goals1: null, goals2: null, played: false
        });
      }
      const fixed = cycle[0];
      const remainder = cycle.slice(1);
      remainder.unshift(remainder.pop());
      cycle.splice(0, cycle.length, fixed, ...remainder);
    }
  });
  return { groups, groupMatches };
}
function blankKnockoutMatch(roundIndex, matchIndex, sources) {
  const match = {
    id: createId('ko'), roundIndex, matchIndex, sources,
    team1Id: null, team2Id: null,
    goals1: null, goals2: null, penalties1: null, penalties2: null, winnerId: null
  };
  match.team1Id = resolveSource(sources[0]);
  match.team2Id = resolveSource(sources[1]);
  return match;
}
function resolveSource(source) {
  if (!source) return null;
  if (source.kind === 'team') return source.teamId || null;
  if (source.kind === 'winner') return state.playoffRounds[source.roundIndex]?.matches[source.matchIndex]?.winnerId || null;
  return null;
}
function groupStandings(groupId) {
  const group = getGroup(groupId);
  if (!group) return [];
  const rows = group.teamIds.map((teamId) => ({
    teamId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
  }));
  const lookup = new Map(rows.map((row) => [row.teamId, row]));
  state.groupMatches.filter((match) => match.groupId === groupId && match.played).forEach((match) => {
    const one = lookup.get(match.team1Id);
    const two = lookup.get(match.team2Id);
    if (!one || !two) return;
    one.played += 1; two.played += 1;
    one.goalsFor += Number(match.goals1); one.goalsAgainst += Number(match.goals2);
    two.goalsFor += Number(match.goals2); two.goalsAgainst += Number(match.goals1);
    if (Number(match.goals1) > Number(match.goals2)) { one.wins += 1; two.losses += 1; one.points += 3; }
    else if (Number(match.goals1) < Number(match.goals2)) { two.wins += 1; one.losses += 1; two.points += 3; }
    else { one.draws += 1; two.draws += 1; one.points += 1; two.points += 1; }
  });
  rows.forEach((row) => { row.goalDifference = row.goalsFor - row.goalsAgainst; });
  rows.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || b.wins - a.wins || (getTeam(a.teamId)?.name || '').localeCompare(getTeam(b.teamId)?.name || '', 'pt-BR'));
  return rows;
}
function allGroupMatchesPlayed() {
  return state.groupMatches.length > 0 && state.groupMatches.every((match) => match.played);
}
function allGroupMatchesCount() { return state.groupMatches.filter((match) => match.played).length; }
function knockoutMatchCount() { return state.playoffRounds.reduce((sum, round) => sum + round.matches.length, 0); }
function allMatchesCount() { return state.groupMatches.length + knockoutMatchCount(); }
function allMatchesPlayedCount() { return allGroupMatchesCount() + state.playoffRounds.reduce((sum, round) => sum + round.matches.filter((match) => Boolean(match.winnerId)).length, 0); }
function getChampion() {
  if (!state.playoffRounds.length) return null;
  const final = state.playoffRounds[state.playoffRounds.length - 1];
  return final?.matches?.[0]?.winnerId || null;
}
function getQualifiedTeams() {
  const entries = [];
  state.groups.forEach((group) => {
    const standings = groupStandings(group.id);
    standings.slice(0, 2).forEach((row, index) => entries.push({ ...row, groupId: group.id, position: index + 1 }));
  });
  return entries;
}
function qualificationSeedSort(entries) {
  return entries.slice().sort((a, b) => a.position - b.position || b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || (getTeam(a.teamId)?.name || '').localeCompare(getTeam(b.teamId)?.name || '', 'pt-BR'));
}
function buildPlayoffRounds() {
  if (!allGroupMatchesPlayed()) return [];
  const teamCount = state.teams.length;
  const groups = state.groups;
  const sourceTeam = (teamId) => ({ kind: 'team', teamId });
  const sourceWinner = (roundIndex, matchIndex) => ({ kind: 'winner', roundIndex, matchIndex });
  const makeRound = (name, pairs) => ({ name, matches: pairs.map((sources, matchIndex) => blankKnockoutMatch(state.playoffRounds.length, matchIndex, sources)), complete: false });
  let rounds = [];
  if (teamCount <= 5) {
    const standings = groupStandings(groups[0].id);
    if (standings.length < 2) return [];
    rounds = [{ name: 'Grande Final', matches: [blankKnockoutMatch(0, 0, [sourceTeam(standings[0].teamId), sourceTeam(standings[1].teamId)])] }];
  } else if (teamCount <= 8) {
    const a = groupStandings('A'); const b = groupStandings('B');
    if (a.length < 2 || b.length < 2) return [];
    rounds = [
      { name: 'Semifinais', matches: [
        blankKnockoutMatch(0, 0, [sourceTeam(a[0].teamId), sourceTeam(b[1].teamId)]),
        blankKnockoutMatch(0, 1, [sourceTeam(b[0].teamId), sourceTeam(a[1].teamId)])
      ] },
      { name: 'Grande Final', matches: [
        blankKnockoutMatch(1, 0, [sourceWinner(0, 0), sourceWinner(0, 1)])
      ] }
    ];
  } else if (teamCount <= 12) {
    const seeds = qualificationSeedSort(getQualifiedTeams());
    if (seeds.length < 6) return [];
    rounds = [
      { name: 'Repescagem para a semifinal', matches: [
        blankKnockoutMatch(0, 0, [sourceTeam(seeds[2].teamId), sourceTeam(seeds[5].teamId)]),
        blankKnockoutMatch(0, 1, [sourceTeam(seeds[3].teamId), sourceTeam(seeds[4].teamId)])
      ] },
      { name: 'Semifinais', matches: [
        blankKnockoutMatch(1, 0, [sourceTeam(seeds[0].teamId), sourceWinner(0, 1)]),
        blankKnockoutMatch(1, 1, [sourceTeam(seeds[1].teamId), sourceWinner(0, 0)])
      ] },
      { name: 'Grande Final', matches: [
        blankKnockoutMatch(2, 0, [sourceWinner(1, 0), sourceWinner(1, 1)])
      ] }
    ];
  } else {
    const findPlace = (groupId, place) => groupStandings(groupId)[place - 1]?.teamId || null;
    const specs = [
      [sourceTeam(findPlace('A', 1)), sourceTeam(findPlace('B', 2))],
      [sourceTeam(findPlace('B', 1)), sourceTeam(findPlace('A', 2))],
      [sourceTeam(findPlace('C', 1)), sourceTeam(findPlace('D', 2))],
      [sourceTeam(findPlace('D', 1)), sourceTeam(findPlace('C', 2))]
    ];
    rounds = [
      { name: 'Quartas de final', matches: specs.map((sources, index) => blankKnockoutMatch(0, index, sources)) },
      { name: 'Semifinais', matches: [
        blankKnockoutMatch(1, 0, [sourceWinner(0, 0), sourceWinner(0, 1)]),
        blankKnockoutMatch(1, 1, [sourceWinner(0, 2), sourceWinner(0, 3)])
      ] },
      { name: 'Grande Final', matches: [
        blankKnockoutMatch(2, 0, [sourceWinner(1, 0), sourceWinner(1, 1)])
      ] }
    ];
  }
  return rounds;
}
function syncKnockoutRounds() {
  state.playoffRounds.forEach((round, roundIndex) => {
    round.matches.forEach((match, matchIndex) => {
      match.roundIndex = roundIndex;
      match.matchIndex = matchIndex;
      if (Array.isArray(match.sources)) {
        match.team1Id = resolveSource(match.sources[0]);
        match.team2Id = resolveSource(match.sources[1]);
      }
      if (match.winnerId && match.winnerId !== match.team1Id && match.winnerId !== match.team2Id) {
        match.winnerId = null; match.goals1 = null; match.goals2 = null; match.penalties1 = null; match.penalties2 = null;
      }
    });
    round.complete = round.matches.length > 0 && round.matches.every((match) => Boolean(match.winnerId));
  });
}
function resetKnockoutFrom(roundIndex) {
  for (let r = roundIndex + 1; r < state.playoffRounds.length; r += 1) {
    state.playoffRounds[r].matches.forEach((match) => {
      match.goals1 = null; match.goals2 = null; match.penalties1 = null; match.penalties2 = null; match.winnerId = null;
    });
  }
  syncKnockoutRounds();
}
function resetTournamentKeepPlayers() {
  if (drawTimer) window.clearTimeout(drawTimer);
  drawTimer = null;
  drawCeremony = null;
  state.drawProgress = null;
  state.teams = []; state.groups = []; state.groupMatches = []; state.playoffRounds = []; state.createdAt = null; state.completedAt = null; selectedMatchday = 'all';
}
function initializePlayoffs() {
  if (state.playoffRounds.length || !allGroupMatchesPlayed()) return false;
  state.playoffRounds = buildPlayoffRounds();
  if (!state.playoffRounds.length) return false;
  syncKnockoutRounds();
  persist();
  return true;
}

/* Participant management */
function renderParticipants() {
  const input = $('participantInput');
  if (input && input.dataset.initialized !== 'true') { input.value = state.players.join('\n'); input.dataset.initialized = 'true'; }
  const parsed = parseNames(input?.value || '');
  $('draftCounter').textContent = `${parsed.names.length} nomes`;
  $('participantBigCount').textContent = state.players.length;
  $('savedCounter').textContent = `${state.players.length} inscritos`;
  const teamCount = clampNumber($('teamCount')?.value || state.settings.teamCount, 2, 16, 8);
  $('plannedTeams').textContent = String(teamCount);
  $('plannedDistribution').textContent = state.players.length ? `${Math.floor(state.players.length / teamCount)}–${Math.ceil(state.players.length / teamCount)} por time` : 'Aguardando lista';
  $('duplicateHint').textContent = parsed.duplicates ? `${parsed.duplicates} duplicado(s) na área de texto` : '';
  const rated = state.players.filter((name) => getPlayerLevel(name) > 0).length;
  const missing = state.players.length - rated;
  const percent = state.players.length ? (rated / state.players.length) * 100 : 0;
  $('playerLevelProgress').textContent = `${rated}/${state.players.length} avaliados`;
  $('playerLevelBar').style.width = `${percent}%`;
  $('levelNotice').classList.toggle('ready', state.players.length > 0 && missing === 0);
  $('levelNotice').textContent = !state.players.length
    ? 'Salve a lista de participantes para começar a avaliação.'
    : missing
      ? `Faltam avaliar ${missing} participante(s). O sorteio fica bloqueado até todos receberem de 1 a 5 estrelas.`
      : 'Todos foram avaliados. O sorteio está liberado; as fotos e os níveis acompanharão cada jogador em todas as telas.';
  const container = $('savedParticipants');
  if (!state.players.length) {
    container.innerHTML = '<div class="empty-inline">Nenhum participante cadastrado ainda. Importe ou cole a lista acima e clique em “Salvar lista”.</div>';
  } else {
    container.innerHTML = state.players.map((name, index) => {
      const level = getPlayerLevel(name);
      const levelLabel = level ? PLAYER_LEVELS[level] : 'Nível não definido';
      const stars = [1, 2, 3, 4, 5].map((star) => `<button type="button" class="rating-star ${star <= level ? 'is-filled' : ''} ${star === level ? 'is-selected' : ''}" data-player-level data-player-index="${index}" data-level="${star}" aria-label="${escapeHtml(name)}: definir nível ${star}, ${escapeHtml(PLAYER_LEVELS[star])}" aria-pressed="${star === level ? 'true' : 'false'}" title="${star} estrela${star > 1 ? 's' : ''} · ${escapeHtml(PLAYER_LEVELS[star])}">★</button>`).join('');
      const avatar = playerAvatarMarkup(name, 'player-avatar participant-avatar');
      return `<div class="rating-row ${level ? 'rated' : 'unrated'}"><span class="rating-index">${String(index + 1).padStart(2, '0')}</span>${avatar}<div class="rating-person"><strong>${escapeHtml(name)}</strong><small>${level ? `${level} ${level === 1 ? 'estrela' : 'estrelas'} · ${escapeHtml(levelLabel)}` : 'Clique nas estrelas para avaliar'}</small></div><div class="rating-photo-control"><label class="photo-upload-btn" for="playerPhoto${index}" title="Adicionar ou alterar foto">▧ <span>${state.playerPhotos[playerKey(name)] ? 'Alterar foto' : 'Adicionar foto'}</span></label><input type="file" id="playerPhoto${index}" accept="image/*" data-player-photo="${index}" hidden /></div><div class="rating-stars" role="group" aria-label="Avaliação de ${escapeHtml(name)}">${stars}</div></div>`;
    }).join('');
  }
}
function saveParticipantList() {
  if (!isAdmin()) return false;
  const parsed = parseNames($('participantInput').value);
  if (!parsed.names.length) { toast('Adicione pelo menos um participante antes de salvar.', 'warning'); return false; }
  const changed = JSON.stringify(parsed.names) !== JSON.stringify(state.players);
  if (changed && state.teams.length) {
    if (!window.confirm('A lista de participantes mudou. Isso apagará os times e placares para evitar dados incorretos. Deseja continuar?')) return false;
    resetTournamentKeepPlayers();
  }
  const nextKeys = new Set(parsed.names.map(playerKey));
  const retainedLevels = {};
  const retainedPhotos = {};
  Object.entries(state.playerLevels).forEach(([key, value]) => { if (nextKeys.has(key)) retainedLevels[key] = value; });
  Object.entries(state.playerPhotos || {}).forEach(([key, value]) => { if (nextKeys.has(key)) retainedPhotos[key] = value; });
  state.playerLevels = retainedLevels;
  state.playerPhotos = retainedPhotos;
  state.players = parsed.names;
  $('participantInput').value = state.players.join('\n');
  $('participantInput').dataset.initialized = 'true';
  persist(); renderAll();
  toast(`${state.players.length} participante(s) salvo(s). ${parsed.duplicates ? `${parsed.duplicates} duplicado(s) ignorado(s).` : 'Agora avalie cada participante.'}`);
  return true;
}

/* Team setup, balanced draw and team rosters */
let drawCeremony = state.drawProgress ? { ...state.drawProgress, running: false } : null;
let drawTimer = null;
function persistDrawProgress() {
  if (!drawCeremony || drawCeremony.completed) { state.drawProgress = null; return; }
  state.drawProgress = { teams: drawCeremony.teams, plan: drawCeremony.plan, index: drawCeremony.index, current: drawCeremony.current, recent: drawCeremony.recent, completed: false };
  persist();
}
function renderTeamSetup() {
  const container = $('teamSetupGrid');
  if (!container) return;
  const profiles = getTeamProfiles();
  const locked = state.teams.length > 0;
  container.innerHTML = profiles.map((profile, index) => `<article class="team-setup-card"><div class="team-setup-card-head"><span class="team-setup-index">${String(index + 1).padStart(2, '0')}</span><strong>TIME ${String(index + 1).padStart(2, '0')}</strong>${profile.photo ? '<span class="photo-ready-tag">ESCUDO ADICIONADO</span>' : ''}</div><div class="team-setup-fields"><label class="team-setup-image" for="teamPhoto${index}">${photoDisplayUrl(profile.photo) ? `<img src="${escapeHtml(photoDisplayUrl(profile.photo))}" alt="Escudo do ${escapeHtml(profile.name)}" />` : `<span>${escapeHtml(profile.flag || '⚽')}</span>`}<small>${locked ? 'ESCUDO' : 'ENVIAR ESCUDO'}</small></label><input type="file" id="teamPhoto${index}" accept="image/*" data-team-photo="${index}" ${locked ? 'disabled' : ''} hidden /><div class="team-setup-name"><label class="field-label" for="teamName${index}">NOME DO TIME</label><input class="text-input" id="teamName${index}" value="${escapeHtml(profile.name)}" maxlength="32" data-team-name="${index}" ${locked ? 'disabled' : ''} /></div></div></article>`).join('');
  container.parentElement.querySelectorAll('.team-lock-notice').forEach((notice) => notice.remove());
  if (locked) {
    container.insertAdjacentHTML('beforebegin', '<div class="team-lock-notice">Os times já foram sorteados. Para alterar nomes ou escudos, use “Refazer sorteio” na tela Sorteio oficial.</div>');
  }
}
function prepareBalancedDrawPlan() {
  const profiles = getTeamProfiles();
  const teams = profiles.map((profile, index) => ({
    id: createId('team'), name: normalizeName(profile.name) || `Time ${index + 1}`,
    flag: profile.flag || '⚽', dark: profile.dark || '#352319', mid: profile.mid || '#68472e', photo: profile.photo || '',
    players: [], seed: index + 1
  }));
  const orderedPlayers = [5, 4, 3, 2, 1].flatMap((level) => shuffle(state.players.filter((name) => getPlayerLevel(name) === level)));
  const plan = [];
  orderedPlayers.forEach((name) => {
    const minCount = Math.min(...teams.map((team) => team.players.length));
    const candidates = teams.map((team, index) => ({ team, index })).filter(({ team }) => team.players.length === minCount);
    const minStrength = Math.min(...candidates.map(({ team }) => team.players.reduce((sum, player) => sum + getPlayerLevel(player), 0)));
    const balanced = candidates.filter(({ team }) => team.players.reduce((sum, player) => sum + getPlayerLevel(player), 0) === minStrength);
    const selected = balanced[Math.floor(Math.random() * balanced.length)];
    selected.team.players.push(name);
    plan.push({ name, level: getPlayerLevel(name), teamIndex: selected.index });
  });
  teams.forEach((team) => { team.players = []; });
  return { teams, plan };
}
function startDrawCeremony() {
  if (!isAdmin()) return;
  if (!state.players.length) { toast('Cadastre os participantes antes do sorteio.', 'warning'); setView('participants'); return; }
  const missing = state.players.filter((name) => !getPlayerLevel(name));
  if (missing.length) { toast(`Avalie os ${missing.length} participante(s) que ainda estão sem nível.`, 'warning'); setView('participants'); return; }
  const teamCount = clampNumber($('teamCount')?.value || state.settings.teamCount, 2, 16, 8);
  if (state.players.length < teamCount) { toast(`Você tem ${state.players.length} participante(s), mas criou ${teamCount} times. Reduza a quantidade de times ou adicione participantes.`, 'error'); setView('teams'); return; }
  if (state.teams.length && !window.confirm('Refazer o sorteio substituirá os elencos, a fase de grupos e todos os placares. Deseja continuar?')) return;
  if (state.teams.length) resetTournamentKeepPlayers();
  if (drawTimer) window.clearTimeout(drawTimer);
  const prepared = prepareBalancedDrawPlan();
  state.settings.teamCount = teamCount;
  drawCeremony = { teams: prepared.teams, plan: prepared.plan, index: 0, current: null, recent: [], running: false, completed: false };
  persistDrawProgress();
  setView('draw');
  renderDrawView();
}
function revealNextDrawPlayer() {
  if (!isAdmin()) return;
  if (!drawCeremony || drawCeremony.completed) return;
  // O último jogador permanece em destaque até o organizador confirmar a finalização.
  if (drawCeremony.index >= drawCeremony.plan.length) { finishDrawCeremony(); return; }
  const entry = drawCeremony.plan[drawCeremony.index];
  drawCeremony.teams[entry.teamIndex].players.push(entry.name);
  drawCeremony.current = entry;
  drawCeremony.recent.unshift(entry);
  drawCeremony.recent = drawCeremony.recent.slice(0, 5);
  drawCeremony.index += 1;
  drawCeremony.running = false;
  persistDrawProgress();
  renderDrawView();
}
function finishDrawCeremony() {
  if (!drawCeremony || drawCeremony.completed) return;
  if (drawTimer) window.clearTimeout(drawTimer);
  drawTimer = null;
  drawCeremony.running = false;
  drawCeremony.completed = true;
  drawCeremony.teams.forEach((team) => { team.players.sort((a, b) => getPlayerLevel(b) - getPlayerLevel(a) || a.localeCompare(b, 'pt-BR')); });
  state.teams = drawCeremony.teams;
  state.drawProgress = null;
  state.settings.teamProfiles = state.teams.map(({ name, flag, dark, mid, photo }) => ({ name, flag, dark, mid, photo }));
  if (state.teams.length === 2) {
    state.groups = [];
    state.groupMatches = [];
    const finalMatch = blankKnockoutMatch(0, 0, [
      { kind: 'team', teamId: state.teams[0].id },
      { kind: 'team', teamId: state.teams[1].id }
    ]);
    state.playoffRounds = [{ name: 'Grande Final', matches: [finalMatch], complete: false }];
  } else {
    const schedule = createGroupsAndFixtures(state.teams);
    state.groups = schedule.groups;
    state.groupMatches = schedule.groupMatches;
    state.playoffRounds = [];
  }
  state.createdAt = new Date().toISOString();
  state.completedAt = null;
  persist();
  renderAll();
  toast(`${state.teams.length} times formados! Todos os ${state.players.length} jogadores foram distribuídos.`);
}
function renderDrawView() {
  const workspace = $('drawWorkspace');
  if (!workspace) return;
  if (!drawCeremony) {
    if (state.teams.length) {
      workspace.innerHTML = `<section class="draw-complete-panel"><div class="draw-complete-icon">🏆</div><div class="eyebrow muted-eyebrow">SORTEIO CONCLUÍDO</div><h2>Os times estão definidos!</h2><p>${state.players.length} jogadores distribuídos em ${state.teams.length} equipes, com diferença máxima de um atleta por elenco.</p><div class="draw-complete-actions"><button class="btn btn-outline" data-go="teams">Ver composição dos times</button><button class="btn btn-brass" data-action="start-draw">Refazer sorteio</button></div></section>`;
      return;
    }
    const rated = state.players.filter((name) => getPlayerLevel(name)).length;
    const missing = state.players.length - rated;
    const teamCount = clampNumber(state.settings.teamCount, 2, 16, 8);
    workspace.innerHTML = `<section class="draw-preflight-panel"><div class="draw-preflight-orb">✦</div><div class="eyebrow muted-eyebrow">TUDO PRONTO PARA A REVELAÇÃO</div><h2>A hora de conhecer os times</h2><p>Os jogadores serão chamados um a um. Cada revelação mostra a foto, o nível e o time de destino em uma animação preparada para o telão.</p><div class="draw-preflight-stats"><div><strong>${state.players.length}</strong><span>JOGADORES</span></div><div><strong>${teamCount}</strong><span>TIMES CRIADOS</span></div><div><strong>${rated}/${state.players.length}</strong><span>NÍVEIS AVALIADOS</span></div></div>${missing ? `<div class="draw-block-warning">Ainda faltam avaliar ${missing} jogador(es). Volte às inscrições para completar as estrelas.</div>` : ''}<button class="btn btn-brass draw-start-button" data-action="start-draw" ${!state.players.length || missing || state.players.length < teamCount ? 'disabled' : ''}>✦ Iniciar cerimônia do sorteio</button><small class="draw-preflight-foot">A distribuição equilibra a quantidade de jogadores e a soma dos níveis técnicos.</small></section>`;
    return;
  }
  const current = drawCeremony.current;
  const team = current ? drawCeremony.teams[current.teamIndex] : null;
  const progress = drawCeremony.plan.length ? drawCeremony.index / drawCeremony.plan.length * 100 : 0;
  const finished = drawCeremony.completed;
  const recent = drawCeremony.recent.map((item) => `<div class="draw-recent-row">${playerAvatarMarkup(item.name, 'player-avatar small-avatar')}<div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(drawCeremony.teams[item.teamIndex]?.name || 'Time')}</small></div>${levelStarsMarkup(item.level)}</div>`).join('');
  const teamProgress = drawCeremony.teams.map((item, index) => `<div class="draw-team-progress">${teamArtworkMarkup(item, 'team-artwork small-team-artwork')}<span>${escapeHtml(item.name)}</span><b>${item.players.length}</b></div>`).join('');
  workspace.innerHTML = `<div class="draw-ceremony-top"><div><div class="eyebrow muted-eyebrow">CERIMÔNIA AO VIVO</div><h2>${finished ? 'Sorteio finalizado' : current ? 'Jogador revelado' : 'Aguardando o primeiro sorteado'}</h2></div><div class="draw-progress-copy"><strong>${drawCeremony.index}</strong><span> / ${drawCeremony.plan.length} JOGADORES</span></div></div><div class="draw-progress-track"><span style="width:${progress}%"></span></div>${finished ? `<section class="draw-complete-panel compact-complete"><div class="draw-complete-icon">🏆</div><h2>Elencos completos!</h2><p>O sorteio terminou. Todos os participantes já conhecem seu time.</p><div class="draw-complete-actions"><button class="btn btn-outline" data-go="teams">Ver os times</button><button class="btn btn-brass" data-go="confrontos">Ver confrontos</button><button class="btn btn-outline" data-action="start-draw">Refazer sorteio</button></div></section>` : `<div class="draw-live-grid"><section class="draw-reveal-panel"><div class="draw-reveal-kicker">JOGADOR SORTEADO</div><div class="draw-reveal-glow"></div><div class="draw-reveal-player">${current ? playerAvatarMarkup(current.name, 'player-avatar draw-player-avatar') : ''}<div class="draw-player-name">${current ? escapeHtml(current.name) : 'Aguardando...'}</div><div class="draw-player-level">${current ? levelStarsMarkup(current.level, 'level-stars draw-level-stars') : ''}<span>${current ? `${current.level} · ${PLAYER_LEVELS[current.level]}` : ''}</span></div></div><div class="draw-destination-label">DESTINO DO JOGADOR</div><div class="draw-destination">${team ? teamArtworkMarkup(team, 'team-artwork draw-team-artwork') : ''}<div><small>VAI JOGAR PELO</small><strong>${team ? escapeHtml(team.name) : 'A definir'}</strong></div><span class="draw-destination-arrow">➜</span></div><div class="draw-controls"><button class="btn btn-brass draw-next-button" data-action="next-draw">${drawCeremony.index >= drawCeremony.plan.length ? 'Finalizar sorteio e montar campeonato →' : 'Próximo sorteado →'}</button><small class="draw-manual-hint">Cada clique revela apenas um participante. Avance quando terminar a apresentação do jogador.</small></div></section><aside class="draw-side-column"><section class="draw-side-panel"><div class="draw-side-heading"><strong>ÚLTIMAS REVELAÇÕES</strong><span>${Math.min(drawCeremony.index, drawCeremony.plan.length)} de ${drawCeremony.plan.length}</span></div><div class="draw-recent-list">${recent}</div></section><section class="draw-side-panel"><div class="draw-side-heading"><strong>ELENCOS EM FORMAÇÃO</strong><span>${drawCeremony.teams.length} TIMES</span></div><div class="draw-team-progress-list">${teamProgress}</div></section></aside></div>`}`;
}
function renderTeams() {
  $('teamCount').value = state.settings.teamCount;
  $('teamCountBadge').textContent = `${state.teams.length} times`;
  $('teamsSectionTitle').textContent = state.teams.length ? 'Elencos definidos' : 'Composição dos times';
  renderTeamSetup();
  const grid = $('teamsGrid');
  if (!state.teams.length) {
    grid.innerHTML = '<div class="empty-state full-empty"><span class="empty-ball">⚽</span><strong>Os elencos ainda não foram sorteados</strong><p>Defina os nomes e escudos dos times e depois inicie a cerimônia oficial.</p><button class="btn btn-outline" data-go="draw">Ir para o sorteio</button></div>';
    return;
  }
  grid.innerHTML = state.teams.map((team, index) => {
    const group = state.groups.find((item) => item.teamIds.includes(team.id));
    const avg = formatAverage(getAverageLevel(team.players));
    const roster = team.players.slice().sort((a, b) => getPlayerLevel(b) - getPlayerLevel(a) || a.localeCompare(b, 'pt-BR'));
    const rosterHtml = roster.map((name, rosterIndex) => `<div class="roster-player">${playerAvatarMarkup(name, 'player-avatar roster-avatar')}<div class="roster-player-copy"><strong>${escapeHtml(name)}</strong>${levelStarsMarkup(getPlayerLevel(name))}</div><span class="player-number">${String(rosterIndex + 1).padStart(2, '0')}</span></div>`).join('');
    return `<article class="team-card" style="--team-dark:${team.dark};--team-mid:${team.mid}"><div class="team-card-top">${teamArtworkMarkup(team, 'team-artwork team-card-artwork')}<div class="team-card-title"><div class="team-card-kicker">EQUIPE · ${String(index + 1).padStart(2, '0')}</div><h3>${escapeHtml(team.name)}</h3></div><span class="team-card-rank">${group ? `GRUPO ${group.id}` : 'TIME'}</span></div><div class="team-card-stats"><div class="team-stat"><span>JOGADORES</span><strong>${team.players.length}</strong></div><div class="team-stat"><span>NÍVEL MÉDIO</span><strong>${avg}</strong></div><div class="team-stat"><span>PONTOS DE NÍVEL</span><strong>${team.players.reduce((sum, name) => sum + getPlayerLevel(name), 0)}</strong></div></div><div class="team-roster"><div class="roster-heading"><span>ELENCO COMPLETO</span><small>${team.players.length} jogadores</small></div><div class="roster-list">${rosterHtml}</div></div></article>`;
  }).join('');
}
function getNextConfrontation() {
  const nextGroup = state.groupMatches.find((match) => !match.played);
  if (nextGroup) return { match: nextGroup, phase: `FASE DE GRUPOS · GRUPO ${nextGroup.groupId}`, type: 'group' };
  for (let roundIndex = 0; roundIndex < state.playoffRounds.length; roundIndex += 1) {
    const match = state.playoffRounds[roundIndex].matches.find((item) => item.team1Id && item.team2Id && !item.winnerId);
    if (match) return { match, phase: state.playoffRounds[roundIndex].name.toUpperCase(), type: 'knockout' };
  }
  return null;
}
function renderConfrontationSide(team) {
  const roster = team.players.slice().sort((a, b) => getPlayerLevel(b) - getPlayerLevel(a) || a.localeCompare(b, 'pt-BR'));
  return `<section class="confront-team-panel"><div class="confront-team-identity">${teamArtworkMarkup(team, 'team-artwork confront-team-artwork')}<div><small>TIME</small><h3>${escapeHtml(team.name)}</h3><span>${roster.length} jogadores · Nível médio ${formatAverage(getAverageLevel(team.players))}</span></div></div><div class="confront-roster-list">${roster.map((name, index) => `<div class="confront-player-row">${playerAvatarMarkup(name, 'player-avatar confront-player-avatar')}<span class="confront-player-number">${String(index + 1).padStart(2, '0')}</span><div class="confront-player-copy"><strong>${escapeHtml(name)}</strong>${levelStarsMarkup(getPlayerLevel(name))}</div></div>`).join('')}</div></section>`;
}
function renderConfrontos() {
  const workspace = $('confrontosWorkspace');
  if (!workspace) return;
  if (!state.teams.length) {
    workspace.innerHTML = '<div class="empty-state full-empty"><span class="empty-ball">⚽</span><strong>Os confrontos serão definidos após o sorteio</strong><p>Assim que os times estiverem completos, os próximos duelos e os jogadores de cada lado aparecerão aqui.</p><button class="btn btn-outline" data-go="draw">Abrir sorteio</button></div>';
    return;
  }
  const upcoming = getNextConfrontation();
  if (!upcoming) {
    workspace.innerHTML = `<section class="draw-complete-panel"><div class="draw-complete-icon">🏆</div><div class="eyebrow muted-eyebrow">${getChampion() ? 'CAMPEONATO ENCERRADO' : 'AGENDA ATUALIZADA'}</div><h2>${getChampion() ? `${escapeHtml(getTeam(getChampion())?.name || 'Campeão')} é o grande campeão!` : 'Não há confronto pendente neste momento'}</h2><p>${getChampion() ? 'Confira a jornada da equipe campeã na área Campeonato.' : 'Confira a classificação e a fase eliminatória.'}</p><div class="draw-complete-actions"><button class="btn btn-brass" data-go="competition">Abrir campeonato</button></div></section>`;
    return;
  }
  const { match, phase, type } = upcoming;
  const one = getTeam(match.team1Id); const two = getTeam(match.team2Id);
  const nextMatches = type === 'group'
    ? state.groupMatches.filter((item) => !item.played).slice(1, 5)
    : state.playoffRounds.flatMap((round) => round.matches.filter((item) => item.team1Id && item.team2Id && !item.winnerId)).slice(1, 5);
  const logo = '<img src="assets/img/logo-empresa-branco.png" alt="Grupo Zanol & Thomaz" />';
  workspace.innerHTML = `<section class="confront-pitch-stage">
    <div class="confront-pitch-inner">
      <div class="confront-main-card">
        <div class="confront-main-top"><div><div class="eyebrow muted-eyebrow">PRÓXIMO CONFRONTO</div><h2>${escapeHtml(phase)}</h2></div><span class="confront-status-pill"><i></i> AGUARDANDO APITO</span></div>
        <div class="confront-scoreboard">
          <div class="confront-score-team">${teamArtworkMarkup(one, 'team-artwork confront-score-artwork')}<h3>${escapeHtml(one?.name || 'A definir')}</h3><small>TIME 01</small></div>
          <div class="confront-vs">VS</div>
          <div class="confront-score-team">${teamArtworkMarkup(two, 'team-artwork confront-score-artwork')}<h3>${escapeHtml(two?.name || 'A definir')}</h3><small>TIME 02</small></div>
        </div>
        <div class="confront-brand-line"><span class="confront-brand-rule"></span>${logo}<div><strong>GRUPO ZANOL & THOMAZ</strong><small>UMA SÓ EQUIPE · UM SÓ ESPÍRITO</small></div><span class="confront-brand-rule"></span></div>
        <div class="confront-rosters-grid">${one ? renderConfrontationSide(one) : '<div class="empty-inline">Time a definir</div>'}${two ? renderConfrontationSide(two) : '<div class="empty-inline">Time a definir</div>'}</div>
        <div class="confront-main-actions"><span>Escudos, fotos e níveis dos atletas acompanham os elencos automaticamente.</span><button class="btn btn-brass btn-small" data-go="competition">Abrir tabela e placares →</button></div>
      </div>
    </div>
  </section>${nextMatches.length ? `<section class="panel upcoming-confronts"><div class="panel-heading"><div><div class="eyebrow muted-eyebrow">NA SEQUÊNCIA</div><h3>Próximos jogos</h3></div><button class="text-link" data-go="competition">Ver todos ↗</button></div>${nextMatches.map((item) => `<div class="upcoming-confront-row"><span>${type === 'group' ? `RODADA ${item.round}` : 'ELIMINATÓRIA'}</span><strong>${escapeHtml(getTeam(item.team1Id)?.name || 'A definir')}</strong><b>×</b><strong>${escapeHtml(getTeam(item.team2Id)?.name || 'A definir')}</strong></div>`).join('')}</section>` : ''}`;
}

/* Result entry and group standings */
function saveGroupResult(matchId) {
  if (!isAdmin()) return;
  const match = getGroupMatch(matchId);
  if (!match) return;
  const row = document.querySelector(`[data-group-match="${CSS.escape(matchId)}"]`);
  const one = row?.querySelector('[data-group-score="one"]');
  const two = row?.querySelector('[data-group-score="two"]');
  if (!one || !two || one.value === '' || two.value === '') { toast('Preencha os dois placares antes de registrar o resultado.', 'warning'); return; }
  const goals1 = clampNumber(one.value, 0, 99, -1);
  const goals2 = clampNumber(two.value, 0, 99, -1);
  if (goals1 < 0 || goals2 < 0) { toast('Use placares inteiros entre 0 e 99.', 'warning'); return; }
  const hasChanged = !match.played || match.goals1 !== goals1 || match.goals2 !== goals2;
  if (!hasChanged) { toast('Este placar já está registrado.'); return; }
  if (state.playoffRounds.length) {
    if (!window.confirm('Alterar um placar da fase de grupos pode mudar a classificação. O mata-mata e os placares eliminatórios serão reiniciados. Deseja continuar?')) return;
    state.playoffRounds = [];
  }
  match.goals1 = goals1; match.goals2 = goals2; match.played = true;
  const playoffsCreated = allGroupMatchesPlayed() && initializePlayoffs();
  persist(); renderAll();
  if (playoffsCreated) toast('Fase de grupos concluída! O mata-mata foi montado automaticamente.');
  else toast('Resultado da fase de grupos registrado.');
}
function teamLabel(teamId, emptyLabel = 'A definir') {
  const team = getTeam(teamId);
  if (!team) return `<span class="team-placeholder">${escapeHtml(emptyLabel)}</span>`;
  return `${teamArtworkMarkup(team, 'team-artwork team-artwork-tiny')}<span>${escapeHtml(team.name)}</span>`;
}
function renderStandingsTable(group) {
  const standings = groupStandings(group.id);
  const matchTotal = state.groupMatches.filter((match) => match.groupId === group.id).length;
  const played = state.groupMatches.filter((match) => match.groupId === group.id && match.played).length;
  const htmlRows = standings.map((row, index) => {
    const team = getTeam(row.teamId);
    const qualified = index < 2;
    return `<tr class="${qualified ? 'qualified-row' : ''}"><td>${index + 1}</td><td><span class="group-team-cell">${teamArtworkMarkup(team, 'team-artwork team-artwork-tiny standings-team-artwork')}<span>${escapeHtml(team?.name || 'Time')}</span>${qualified ? '<i class="qualified-chip">CLASS.</i>' : ''}</span></td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.goalsFor}</td><td>${row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td><td class="points-cell">${row.points}</td></tr>`;
  }).join('');
  return `<div class="standings-table-wrap"><table class="standings-table"><thead><tr><th>#</th><th>TIME</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>SG</th><th>PTS</th></tr></thead><tbody>${htmlRows}</tbody></table></div><div class="group-footnote"><span>${played}/${matchTotal} jogos disputados</span><strong>2 VAGAS PARA O MATA-MATA</strong></div>`;
}
function renderGroupCards() {
  return `<div class="groups-grid">${state.groups.map((group) => {
    const total = state.groupMatches.filter((match) => match.groupId === group.id).length;
    const played = state.groupMatches.filter((match) => match.groupId === group.id && match.played).length;
    const complete = total > 0 && played === total;
    return `<article class="group-card"><div class="group-card-heading"><div class="group-title-lockup"><span class="group-letter">${group.id}</span><span><h3>Grupo ${group.id}</h3><small>${group.teamIds.length} times · todos contra todos</small></span></div><span class="group-status">${complete ? 'ENCERRADO' : `${played}/${total} JOGOS`}</span></div>${renderStandingsTable(group)}</article>`;
  }).join('')}</div>`;
}
function groupMatchCountPerRound() {
  return [...new Set(state.groupMatches.map((match) => match.round))].sort((a, b) => a - b);
}
function renderGroupFixtures() {
  const rounds = groupMatchCountPerRound();
  const selected = selectedMatchday === 'all' ? null : Number(selectedMatchday);
  const tabs = [`<button type="button" class="matchday-tab ${selected === null ? 'active' : ''}" data-matchday="all">Todas as rodadas</button>`, ...rounds.map((round) => `<button type="button" class="matchday-tab ${selected === round ? 'active' : ''}" data-matchday="${round}">Rodada ${round}</button>`)].join('');
  const shownRounds = selected === null ? rounds : rounds.filter((round) => round === selected);
  const body = shownRounds.map((round) => {
    const matches = state.groupMatches.filter((match) => match.round === round).sort((a, b) => a.groupId.localeCompare(b.groupId));
    if (!matches.length) return '';
    return `<div class="fixture-round-label">RODADA ${round}</div>${matches.map((match) => renderGroupFixture(match)).join('')}`;
  }).join('');
  return `<section class="panel matches-panel"><div class="panel-heading"><div><div class="eyebrow muted-eyebrow">FASE DE GRUPOS</div><h3>Calendário de partidas</h3><p>Registre cada placar. As tabelas e a classificação são atualizadas automaticamente.</p></div><span class="counter-badge">${allGroupMatchesCount()}/${state.groupMatches.length} finalizados</span></div><div class="matchday-tabs">${tabs}</div><div class="fixtures-grouped">${body || '<div class="empty-inline">Nenhum jogo nesta rodada.</div>'}</div></section>`;
}
function renderGroupFixture(match) {
  const team1 = getTeam(match.team1Id); const team2 = getTeam(match.team2Id);
  const score1 = match.goals1 == null ? '' : match.goals1;
  const score2 = match.goals2 == null ? '' : match.goals2;
  return `<div class="fixture-row ${match.played ? 'fixture-played' : ''}" data-group-match="${match.id}"><div class="fixture-row-meta">GRUPO ${match.groupId}<br />JOGO</div><div class="fixture-versus"><div class="fixture-team">${teamLabel(match.team1Id)}</div><div class="fixture-vs-line">VS</div><div class="fixture-team">${teamLabel(match.team2Id)}</div>${match.played ? '<div class="fixture-result-label">✓ RESULTADO REGISTRADO</div>' : ''}</div><div class="fixture-score-form"><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Gols de ${escapeHtml(team1?.name || 'seleção 1')}" data-group-score="one" value="${score1}" /><span class="score-separator">–</span><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Gols de ${escapeHtml(team2?.name || 'seleção 2')}" data-group-score="two" value="${score2}" /><button type="button" class="score-save-btn" data-save-group="${match.id}">${match.played ? 'Atualizar' : 'Registrar'}</button></div></div>`;
}
function renderKnockoutRound(round, roundIndex) {
  const matches = round.matches.map((match, matchIndex) => {
    const one = getTeam(match.team1Id); const two = getTeam(match.team2Id);
    const tied = match.goals1 != null && match.goals2 != null && match.goals1 === match.goals2;
    const winnerTeam = match.winnerId ? getTeam(match.winnerId) : null;
    const winnerLabel = winnerTeam ? `✓ CLASSIFICADO: ${escapeHtml(winnerTeam.name)}` : '';
    const teamRow = (team, score, side) => `<div class="knockout-team-row ${match.winnerId === team?.id ? 'winner' : ''}">${team ? `${teamArtworkMarkup(team, 'team-artwork team-artwork-tiny knockout-team-artwork')}<strong>${escapeHtml(team.name)}</strong>` : `<span class="flag-mini">⚑</span><strong>Aguardando classificação</strong>`}<span class="team-score-badge">${score == null ? '–' : score}</span></div>`;
    return `<article class="knockout-match ${match.winnerId ? 'is-decided' : ''}" data-knockout-match="${roundIndex}" data-knockout-index="${matchIndex}"><div class="knockout-match-label">${roundIndex === state.playoffRounds.length - 1 ? 'DECISÃO' : `CONFRONTO ${String(matchIndex + 1).padStart(2, '0')}`}</div><div class="knockout-matchup">${teamRow(one, match.goals1, 'one')}<div class="knockout-vs">VS</div>${teamRow(two, match.goals2, 'two')}</div>${one && two ? `<div class="knockout-inputs"><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Gols de ${escapeHtml(one.name)}" data-ko-score="one" value="${match.goals1 == null ? '' : match.goals1}" /><span class="score-separator">–</span><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Gols de ${escapeHtml(two.name)}" data-ko-score="two" value="${match.goals2 == null ? '' : match.goals2}" /><button type="button" class="score-save-btn" data-save-knockout="${roundIndex}:${matchIndex}">${match.winnerId ? 'Corrigir' : 'Registrar'}</button></div>` : ''}<div class="penalty-wrap" ${tied ? '' : 'hidden'}><label>Desempate por pênaltis</label><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Pênaltis de ${escapeHtml(one?.name || 'seleção 1')}" data-ko-penalty="one" value="${match.penalties1 == null ? '' : match.penalties1}" /><span>–</span><input class="score-input" type="number" min="0" max="99" inputmode="numeric" aria-label="Pênaltis de ${escapeHtml(two?.name || 'seleção 2')}" data-ko-penalty="two" value="${match.penalties2 == null ? '' : match.penalties2}" /><span class="penalty-help">Se o jogo empatar, preencha os pênaltis e registre novamente.</span></div>${winnerLabel ? `<div class="knockout-winner-badge">${winnerLabel}</div>` : ''}</article>`;
  }).join('');
  const completed = round.matches.filter((match) => Boolean(match.winnerId)).length;
  return `<section class="knockout-round"><div class="knockout-round-header"><strong>${escapeHtml(round.name)}</strong><span>${completed}/${round.matches.length} DECIDIDOS</span></div><div class="knockout-matches">${matches}</div></section>`;
}
function renderPlayoffs() {
  if (!state.playoffRounds.length) {
    const completed = allGroupMatchesPlayed();
    return `<section class="panel knockout-section"><div class="panel-heading"><div><div class="eyebrow muted-eyebrow">ELIMINATÓRIAS</div><h3>${completed ? 'Classificados definidos' : 'Caminho até a final'}</h3><p>${completed ? 'A fase de grupos terminou. O mata-mata será montado automaticamente.' : 'As dois melhores times de cada grupo avançam quando todos os jogos da fase de grupos tiverem resultado.'}</p></div><span class="counter-badge">${completed ? 'PRONTO PARA AVANÇAR' : 'AGUARDANDO GRUPOS'}</span></div>${completed ? '<div class="empty-inline">Atualize o campeonato para montar o mata-mata.</div>' : '<div class="empty-inline">A classificação define os confrontos eliminatórios. Empates no mata-mata serão resolvidos nos pênaltis.</div>'}<div class="form-actions" style="padding:0 20px 18px;margin-top:0"><button type="button" class="btn btn-brass" id="createPlayoffsBtn" ${completed ? '' : 'disabled'}>✦ Montar mata-mata</button></div></section>`;
  }
  return `<section class="knockout-section"><div class="knockout-heading"><div><div class="eyebrow muted-eyebrow">A DECISÃO COMEÇA AQUI</div><h2>Fase eliminatória</h2><p>Resultado empatado? Registre a disputa de pênaltis para definir quem avança.</p></div><span class="counter-badge">${state.playoffRounds.flatMap((round) => round.matches).filter((match) => match.winnerId).length}/${knockoutMatchCount()} jogos decididos</span></div>${state.playoffRounds.map((round, index) => renderKnockoutRound(round, index)).join('')}</section>`;
}
function renderCompetition() {
  const intro = $('competitionIntro'); const workspace = $('competitionWorkspace'); const banner = $('championBanner');
  if (!state.teams.length) {
    intro.hidden = false; banner.hidden = true;
    workspace.innerHTML = '<div class="empty-state full-empty"><span class="empty-ball">⚽</span><strong>O primeiro apito ainda vai acontecer</strong><p>Monte os elencos na aba Times para gerar a tabela da competição.</p><button class="btn btn-outline" data-go="teams">Preparar times</button></div>';
    return;
  }
  intro.hidden = true;
  const groupDone = allGroupMatchesPlayed();
  const groupsDone = state.groups.length;
  const directFinal = state.teams.length === 2 && state.playoffRounds.length > 0 && state.groups.length === 0;
  const groupLabel = directFinal ? '2 times · decisão direta em partida única' : `${groupsDone} ${groupsDone === 1 ? 'grupo' : 'grupos'} · ${state.teams.length} times · ${state.groupMatches.length} jogos na primeira fase`;
  const phaseTitle = directFinal ? (getChampion() ? 'Grande final concluída' : 'Grande final') : state.playoffRounds.length ? (getChampion() ? 'Campeonato concluído' : 'Mata-mata em andamento') : (groupDone ? 'Fase de grupos encerrada' : 'Fase de grupos');
  const phaseDescription = state.playoffRounds.length ? (getChampion() ? 'A taça já tem dona. Confira o resultado da grande final.' : 'As classificadas disputam vagas rodada a rodada até a final.') : (groupDone ? 'Todos os resultados foram registrados. Confirme a classificação e monte as eliminatórias.' : 'Cada time enfrenta as demais equipes do grupo. Vitória vale 3 pontos e empate vale 1 ponto para cada lado.');
  const progressPill = getChampion() ? 'CAMPEÃO DEFINIDO' : state.playoffRounds.length ? 'MATA-MATA' : groupDone ? 'CLASSIFICADOS DEFINIDOS' : 'FASE DE GRUPOS';
  const groupsHtml = `<div class="format-banner"><span class="format-banner-icon">▤</span><div class="format-banner-copy"><strong>${phaseTitle}</strong><p>${groupLabel}. ${directFinal ? 'Os dois times disputam diretamente a taça.' : phaseDescription}</p></div><span class="format-banner-pill">${directFinal ? (getChampion() ? 'CAMPEÃO DEFINIDO' : 'DECISÃO') : progressPill}</span></div>`;
  const playoffHtml = renderPlayoffs();
  workspace.innerHTML = `${groupsHtml}${state.groups.length ? renderGroupCards() + renderGroupFixtures() : ''}${playoffHtml}`;
  const championId = getChampion();
  banner.hidden = !championId;
  if (championId) { const champion = getTeam(championId); $('championNameBanner').innerHTML = `${teamArtworkMarkup(champion, 'team-artwork champion-team-artwork')}<span>${escapeHtml(champion?.name || 'Time campeão')}</span>`; }
}

/* Overview, counters and identity */
function renderMiniMatch(match, type) {
  const one = getTeam(match.team1Id); const two = getTeam(match.team2Id);
  const label = type === 'group' ? `GRUPO ${match.groupId}` : (state.playoffRounds[match.roundIndex]?.name || 'MATA-MATA');
  const date = type === 'group' ? `RODADA ${match.round}` : `JOGO ${match.matchIndex + 1}`;
  const score = match.goals1 != null && match.goals2 != null ? `${match.goals1} – ${match.goals2}` : 'A JOGAR';
  return `<div class="next-match-row"><div class="next-match-meta">${escapeHtml(label)}<br />${escapeHtml(date)}</div><div class="next-match-teams"><div class="next-team">${one ? teamArtworkMarkup(one, 'team-artwork team-artwork-tiny') : '<span class="flag-mini">⚑</span>'}<span>${escapeHtml(one?.name || 'A definir')}</span></div><div class="next-team">${two ? teamArtworkMarkup(two, 'team-artwork team-artwork-tiny') : '<span class="flag-mini">⚑</span>'}<span>${escapeHtml(two?.name || 'A definir')}</span></div></div><div class="next-score ${match.winnerId || match.played ? '' : 'pending'}">${score}</div></div>`;
}
function renderNextMatches() {
  const container = $('nextMatches');
  let matches = [];
  if (state.teams.length && state.groupMatches.length && !allGroupMatchesPlayed()) {
    matches = state.groupMatches.filter((match) => !match.played).slice(0, 4).map((match) => ({ match, type: 'group' }));
    $('nextMatchesSubtitle').textContent = 'Jogos pendentes da fase de grupos.';
  } else if (state.playoffRounds.length) {
    const knockout = state.playoffRounds.flatMap((round, roundIndex) => round.matches.map((match, matchIndex) => ({ ...match, roundIndex, matchIndex }))).filter((match) => match.team1Id && match.team2Id && !match.winnerId);
    matches = knockout.slice(0, 4).map((match) => ({ match, type: 'knockout' }));
    $('nextMatchesSubtitle').textContent = getChampion() ? 'A grande final definiu a time campeão.' : 'Próximas partidas decisivas da fase eliminatória.';
  } else if (state.teams.length && state.groupMatches.length && allGroupMatchesPlayed()) {
    $('nextMatchesSubtitle').textContent = 'Fase de grupos encerrada; o mata-mata está pronto para ser montado.';
  } else {
    $('nextMatchesSubtitle').textContent = 'Os próximos confrontos aparecem aqui após o sorteio.';
  }
  if (!matches.length) {
    if (getChampion()) {
      container.innerHTML = `<div class="empty-state compact-empty"><span>🏆</span><strong>Campeonato encerrado</strong><p>${escapeHtml(getTeam(getChampion())?.name || 'A time campeão')} levantou a taça.</p><button class="btn btn-small btn-outline" data-go="competition">Ver campeão</button></div>`;
    } else if (state.teams.length && state.groupMatches.length && allGroupMatchesPlayed()) {
      container.innerHTML = '<div class="empty-state compact-empty"><span class="empty-ball">🏆</span><strong>Classificação concluída</strong><p>Confira as tabelas e monte a fase eliminatória.</p><button class="btn btn-small btn-outline" data-go="competition">Abrir campeonato</button></div>';
    } else {
      container.innerHTML = '<div class="empty-state compact-empty"><span class="empty-ball">⚽</span><strong>O estádio está pronto</strong><p>Cadastre os participantes e forme os times para organizar a competição.</p><button class="btn btn-small btn-outline" data-go="participants">Começar agora</button></div>';
    }
    return;
  }
  container.innerHTML = matches.map(({ match, type }) => renderMiniMatch(match, type)).join('');
}
function renderDashboardStandings() {
  const target = $('dashboardStandings');
  if (!state.groups.length) {
    target.innerHTML = '<div class="standings-empty">A classificação aparecerá depois que os times e os grupos forem definidos.</div>';
    return;
  }
  target.innerHTML = `<div class="groups-grid">${state.groups.map((group) => {
    const standings = groupStandings(group.id);
    return `<div class="dashboard-table-wrap"><table class="dashboard-table"><thead><tr><th colspan="2">GRUPO ${group.id}</th><th>J</th><th>SG</th><th>PTS</th></tr></thead><tbody>${standings.map((row, index) => {
      const team = getTeam(row.teamId);
      return `<tr><td class="table-position ${index < 2 ? 'qualified' : ''}">${index + 1}</td><td class="team-name-cell"><span class="group-team-cell">${teamArtworkMarkup(team, 'team-artwork team-artwork-tiny standings-team-artwork')}<span>${escapeHtml(team?.name || 'Time')}</span></span></td><td>${row.played}</td><td>${row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td><td><strong>${row.points}</strong></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }).join('')}</div>`;
}
function updateCounters() {
  const played = allMatchesPlayedCount(); const total = allMatchesCount(); const teams = state.teams.length; const champion = getChampion();
  $('statParticipants').textContent = String(state.players.length);
  $('statParticipantsNote').textContent = `${state.players.filter((name) => getPlayerLevel(name)).length} níveis avaliados`;
  $('statTeams').textContent = String(teams);
  $('statTeamsNote').textContent = teams ? `${teams} times formados` : 'Aguardando sorteio';
  $('statPlayed').innerHTML = `${played}<span class="stat-total" id="statTotal"> / ${total}</span>`;
  $('statPhaseNote').textContent = champion ? 'Todos os jogos decisivos concluídos' : state.playoffRounds.length ? 'Disputa eliminatória' : state.teams.length ? `${allGroupMatchesCount()} de ${state.groupMatches.length} jogos de grupos` : 'A bola ainda não rolou';
  $('statChampion').textContent = champion ? (getTeam(champion)?.name || 'Campeão') : 'EM ABERTO';
  $('championNote').textContent = champion ? 'A taça tem dona!' : 'A próxima história será escrita em campo';
  $('participantProgress').style.width = `${Math.min(100, state.players.length / 48 * 100)}%`;
  $('teamProgress').style.width = `${teams ? 100 : 0}%`;
  $('matchProgress').style.width = `${total ? played / total * 100 : 0}%`;
  $('navParticipantCount').textContent = String(state.players.length);
  $('eventStatus').textContent = champion ? 'CAMPEÃO DEFINIDO' : state.playoffRounds.length ? 'MATA-MATA' : state.teams.length ? (allGroupMatchesPlayed() ? 'GRUPOS ENCERRADOS' : 'EM DISPUTA') : state.players.length ? 'INSCRIÇÕES ABERTAS' : 'PRÉ-TEMPORADA';
  $('stepPlayersState').textContent = state.players.length && state.players.every((name) => getPlayerLevel(name)) ? 'CONCLUÍDO' : state.players.length ? 'EM ANDAMENTO' : 'PENDENTE';
  $('stepProfilesState').textContent = getTeamProfiles().length >= state.settings.teamCount ? 'CONCLUÍDO' : 'PENDENTE';
  $('stepTeamsState').textContent = teams ? 'CONCLUÍDO' : 'PENDENTE';
  $('stepGroupsState').textContent = state.teams.length ? ((!state.groupMatches.length || allGroupMatchesPlayed()) ? 'CONCLUÍDO' : 'EM ANDAMENTO') : 'PENDENTE';
  $('stepFinalState').textContent = champion ? 'CONCLUÍDO' : state.playoffRounds.length ? 'EM ANDAMENTO' : 'PENDENTE';
  ['stepPlayersState', 'stepProfilesState', 'stepTeamsState', 'stepGroupsState', 'stepFinalState'].forEach((id) => { if ($(id)) $(id).classList.toggle('done', $(id).textContent === 'CONCLUÍDO'); });
  $('journeyFooterText').textContent = champion ? `${getTeam(champion)?.name || 'A campeã'} conquistou a Copa` : state.playoffRounds.length ? 'A disputa pelo título está em andamento' : state.teams.length ? 'A fase de grupos define quem segue na competição' : 'Prepare os jogadores, crie os times e abra a cerimônia do sorteio';
}
function updatePublishedIdentity() {
  const eventName = normalizeName(state.settings.eventName) || DEFAULT_SETTINGS.eventName;
  const companyName = normalizeName(state.settings.companyName) || DEFAULT_SETTINGS.companyName;
  const uppercaseEvent = eventName.toLocaleUpperCase('pt-BR');
  document.title = `${eventName} | ${companyName}`;
  ['topbarEventName', 'footerEventName', 'previewEventName'].forEach((id) => { if ($(id)) $(id).textContent = uppercaseEvent; });
  ['topbarCompanyName', 'previewCompanyName'].forEach((id) => { if ($(id)) $(id).textContent = companyName.toLocaleUpperCase('pt-BR'); });
  if (eventName.toLocaleLowerCase('pt-BR') === DEFAULT_SETTINGS.eventName.toLocaleLowerCase('pt-BR')) {
    $('heroEventName').innerHTML = 'COPA DOS<br /><span>COLABORADORES</span> <b>2026</b>';
  } else {
    $('heroEventName').textContent = uppercaseEvent;
  }
  $('heroCompanyLine').textContent = companyName ? `${companyName} · Talento em campo. União em cada jogada.` : 'Talento em campo. União em cada jogada.';
}
function fillIdentityInputs() {
  $('eventNameInput').value = state.settings.eventName || DEFAULT_SETTINGS.eventName;
  $('companyNameInput').value = state.settings.companyName || DEFAULT_SETTINGS.companyName;
  updateIdentityPreview();
}
function updateIdentityPreview() {
  $('previewEventName').textContent = normalizeName($('eventNameInput').value || DEFAULT_SETTINGS.eventName).toLocaleUpperCase('pt-BR');
  $('previewCompanyName').textContent = normalizeName($('companyNameInput').value || DEFAULT_SETTINGS.companyName).toLocaleUpperCase('pt-BR');
}
function renderAll() {
  renderParticipants(); renderTeams(); renderDrawView(); renderConfrontos(); renderCompetition(); renderNextMatches(); renderDashboardStandings(); updateCounters(); updatePublishedIdentity();
}

/* Backup management */
function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
function exportBackup() {
  if (!isAdmin()) { toast('Backup disponível somente para o ADM.', 'warning'); return; }
  const payload = { ...state, backupVersion: 3, exportedAt: new Date().toISOString() };
  downloadBlob('copa-colaboradores-2026-backup.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  toast('Backup exportado. As fotos ficam no armazenamento privado do Supabase e acompanham a restauração neste mesmo projeto.');
}
function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!imported || !Array.isArray(imported.players) || !imported.settings) throw new Error('Formato inválido');
      if (!window.confirm('Importar este backup substituirá os dados atuais deste navegador. Deseja continuar?')) return;
      if (drawTimer) window.clearTimeout(drawTimer);
      drawTimer = null;
      state = normalizeLoadedState(imported);
      drawCeremony = state.drawProgress ? { ...state.drawProgress, running: false } : null;
      // If a backup was created with the earlier knockout-only version, start its tournament again safely.
      if (![2, 3].includes(imported.backupVersion) || !Array.isArray(imported.groups) || !Array.isArray(imported.groupMatches)) resetTournamentKeepPlayers();
      await migrateEmbeddedPhotosToStorage(); await refreshSignedPhotoUrls();
      persist(); fillIdentityInputs(); renderAll(); toast('Backup importado com sucesso.');
    } catch (error) {
      toast('Não foi possível importar. Selecione um backup JSON válido da Copa.', 'error');
    }
    $('backupInput').value = '';
  };
  reader.onerror = () => toast('Não foi possível ler o arquivo.', 'error');
  reader.readAsText(file, 'UTF-8');
}
function saveIdentity() {
  if (!isAdmin()) return;
  state.settings.eventName = normalizeName($('eventNameInput').value) || DEFAULT_SETTINGS.eventName;
  state.settings.companyName = normalizeName($('companyNameInput').value) || DEFAULT_SETTINGS.companyName;
  persist(); fillIdentityInputs(); renderAll(); toast('Identidade atualizada no menu, cabeçalho e painel principal.');
}
function togglePresentationMode() {
  presentationMode = !presentationMode;
  document.body.classList.toggle('presentation-mode', presentationMode);
  $('presentationModeBtn').innerHTML = presentationMode ? '× <span>Sair do telão</span>' : '▣ <span>Modo telão</span>';
  $('presentationModeBtn').title = presentationMode ? 'Sair do modo telão' : 'Ativar modo telão';
  if (presentationMode && !document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (!presentationMode && document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

/* Event binding */
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.addEventListener('click', (event) => {
  const go = event.target.closest('[data-go]');
  if (go) { event.preventDefault(); setView(go.dataset.go); return; }
  const saveGroup = event.target.closest('[data-save-group]');
  if (saveGroup && !isAdmin()) { toast('Somente o ADM pode registrar resultados.', 'warning'); return; }
  if (saveGroup) { saveGroupResult(saveGroup.dataset.saveGroup); return; }
  const saveKo = event.target.closest('[data-save-knockout]');
  if (saveKo && !isAdmin()) { toast('Somente o ADM pode registrar resultados.', 'warning'); return; }
  if (saveKo) {
    const [round, match] = saveKo.dataset.saveKnockout.split(':').map(Number);
    saveKnockoutResult(round, match); return;
  }
  const day = event.target.closest('[data-matchday]');
  if (day) { selectedMatchday = day.dataset.matchday; renderCompetition(); return; }
  if (event.target.closest('#createPlayoffsBtn')) {
    if (!isAdmin()) { toast('Somente o ADM pode organizar as fases.', 'warning'); return; }
    if (!allGroupMatchesPlayed()) { toast('Registre todos os resultados da fase de grupos antes de montar o mata-mata.', 'warning'); return; }
    if (initializePlayoffs()) { renderAll(); toast('Mata-mata criado conforme a classificação dos grupos.'); }
    else toast('Não foi possível criar as eliminatórias. Confira o número de times e os grupos.', 'error');
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'start-draw' || action === 'next-draw') { if (!isAdmin()) { toast('O sorteio é exclusivo do ADM.', 'warning'); return; } }
  if (action === 'start-draw') { startDrawCeremony(); return; }
  if (action === 'next-draw') { revealNextDrawPlayer(); return; }
});
$('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('exportTopBtn').addEventListener('click', exportBackup);
$('exportBackupBtn').addEventListener('click', exportBackup);
$('presentationModeBtn').addEventListener('click', togglePresentationMode);
$('participantInput').addEventListener('input', () => { if (!isAdmin()) return;
  const parsed = parseNames($('participantInput').value);
  $('draftCounter').textContent = `${parsed.names.length} nomes`;
  $('duplicateHint').textContent = parsed.duplicates ? `${parsed.duplicates} duplicado(s) na área de texto` : '';
  const teamCount = clampNumber($('teamCount')?.value || state.settings.teamCount, 2, 16, 8);
  $('plannedDistribution').textContent = parsed.names.length ? `${Math.floor(parsed.names.length / teamCount)}–${Math.ceil(parsed.names.length / teamCount)} por time` : 'Aguardando lista';
});
$('saveParticipantsBtn').addEventListener('click', () => { if (isAdmin()) saveParticipantList(); });
$('goTeamsBtn').addEventListener('click', () => { if (!isAdmin()) return;
  if (!state.players.length || JSON.stringify(parseNames($('participantInput').value).names) !== JSON.stringify(state.players)) {
    if (!saveParticipantList()) return;
  }
  setView('teams');
});
$('participantFile').addEventListener('change', (event) => { if (!isAdmin()) return;
  const file = event.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let text = String(reader.result || '').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length > 1 && /^(nome|participante|name|colaborador)/i.test(lines[0].split(/[;,]/)[0].trim())) {
      text = lines.slice(1).map((line) => line.split(/[;,]/)[0]).join('\n');
    }
    $('participantInput').value = text; $('participantInput').dispatchEvent(new Event('input', { bubbles: true }));
    const parsed = parseNames(text);
    toast(`Arquivo lido. Identificamos ${parsed.names.length} nomes; confira e clique em “Salvar lista”.`);
  };
  reader.onerror = () => toast('Não foi possível ler esse arquivo.', 'error');
  reader.readAsText(file, 'UTF-8'); event.target.value = '';
});
$('downloadTemplateBtn').addEventListener('click', () => downloadBlob('modelo-participantes-copa-2026.csv', 'Nome\nAna Souza\nBruno Lima\nCarlos Santos\n', 'text/csv;charset=utf-8'));
$('teamCount').addEventListener('change', () => { if (!isAdmin()) return;
  const next = clampNumber($('teamCount').value, 2, 16, 8);
  if (state.teams.length && next !== state.settings.teamCount) {
    if (!window.confirm('Alterar a quantidade de times exige refazer o sorteio e apaga os placares. Continuar?')) { $('teamCount').value = state.settings.teamCount; return; }
    resetTournamentKeepPlayers();
  }
  const oldProfiles = getTeamProfiles();
  const defaults = createDefaultTeamProfiles(next);
  state.settings.teamProfiles = Array.from({ length: next }, (_, index) => ({ ...defaults[index], ...(oldProfiles[index] || {}) }));
  state.settings.teamCount = next; $('teamCount').value = next; persist(); renderAll();
});
document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
  const input = $(button.dataset.step); const next = clampNumber(Number(input.value) + Number(button.dataset.delta), Number(input.min), Number(input.max), Number(input.value));
  input.value = next; input.dispatchEvent(new Event('change', { bubbles: true }));
}));
$('savedParticipants').addEventListener('click', (event) => { if (!isAdmin()) return;
  const button = event.target.closest('[data-player-level]'); if (!button) return;
  const index = Number(button.dataset.playerIndex); const name = state.players[index]; if (!name) return;
  const oldLevel = getPlayerLevel(name); const newLevel = clampNumber(button.dataset.level, 1, 5, 3);
  if (oldLevel === newLevel) return;
  if (state.teams.length) {
    if (!window.confirm('Alterar o nível depois do sorteio invalida o equilíbrio dos times e apaga os placares. Deseja continuar?')) return;
    resetTournamentKeepPlayers();
  }
  state.playerLevels[playerKey(name)] = newLevel; persist(); renderAll();
  toast(`Nível ${newLevel} · ${PLAYER_LEVELS[newLevel]} definido para ${name}.`);
});
$('savedParticipants').addEventListener('change', async (event) => { if (!isAdmin()) return;
  const input = event.target.closest('[data-player-photo]'); if (!input) return;
  const index = Number(input.dataset.playerPhoto); const name = state.players[index]; const file = input.files?.[0]; if (!name || !file) return;
  try { const compressed = await compressImageFile(file, 360); state.playerPhotos[playerKey(name)] = await uploadDataUrlToStorage(compressed, 'jogadores'); persist(); renderAll(); toast(`Foto de ${name} atualizada em todo o campeonato.`); }
  catch (error) { toast(error.message || 'Não foi possível processar a foto.', 'error'); }
});
$('teamSetupGrid').addEventListener('input', (event) => { if (!isAdmin()) return;
  const input = event.target.closest('[data-team-name]'); if (!input || state.teams.length) return;
  const index = Number(input.dataset.teamName); const profile = getTeamProfiles()[index]; if (!profile) return;
  profile.name = normalizeName(input.value) || `Time ${index + 1}`; persist();
});
$('teamSetupGrid').addEventListener('change', async (event) => { if (!isAdmin()) return;
  const input = event.target.closest('[data-team-photo]'); if (!input) return;
  const index = Number(input.dataset.teamPhoto); const file = input.files?.[0]; const profile = getTeamProfiles()[index]; if (!profile || !file) return;
  try { const compressed = await compressImageFile(file, 480); profile.photo = await uploadDataUrlToStorage(compressed, 'times'); persist(); renderAll(); toast(`Escudo de ${profile.name} adicionado.`); }
  catch (error) { toast(error.message || 'Não foi possível processar o escudo.', 'error'); }
});
$('refreshCompetitionBtn').addEventListener('click', () => { renderCompetition(); toast('Tabelas e confrontos atualizados.'); });
$('printCompetitionBtn').addEventListener('click', () => { setView('competition'); window.setTimeout(() => window.print(), 80); });
$('eventNameInput').addEventListener('input', () => { if (isAdmin()) updateIdentityPreview(); });
$('companyNameInput').addEventListener('input', () => { if (isAdmin()) updateIdentityPreview(); });
$('saveIdentityBtn').addEventListener('click', () => { if (isAdmin()) saveIdentity(); });
$('backupInput').addEventListener('change', (event) => { if (isAdmin()) importBackup(event.target.files?.[0]); });
$('resetTournamentBtn').addEventListener('click', () => { if (!isAdmin()) return;
  if (!window.confirm('Remover os times e todos os placares, mantendo os inscritos e as avaliações?')) return;
  resetTournamentKeepPlayers(); persist(); renderAll(); toast('Sorteio e jogos removidos. A lista de participantes foi mantida.');
});
$('clearAllBtn').addEventListener('click', () => { if (!isAdmin()) return;
  if (!window.confirm('Isso apagará participantes, avaliações, times, placares e identidade deste navegador. Deseja continuar?')) return;
  if (drawTimer) window.clearTimeout(drawTimer); drawTimer = null; drawCeremony = null;
  state = freshState(); persist(); $('participantInput').value = ''; $('participantInput').dataset.initialized = 'true'; fillIdentityInputs(); renderAll(); setView('dashboard'); toast('Campeonato limpo. Você pode começar de novo.');
});
$('competitionWorkspace').addEventListener('input', (event) => { if (!isAdmin()) return;
  const field = event.target.closest('[data-ko-score]');
  if (!field) return;
  const card = field.closest('[data-knockout-match]');
  const one = card?.querySelector('[data-ko-score="one"]'); const two = card?.querySelector('[data-ko-score="two"]');
  const penalty = card?.querySelector('.penalty-wrap');
  if (penalty) penalty.hidden = !(one?.value !== '' && two?.value !== '' && Number(one.value) === Number(two.value));
});

function saveKnockoutResult(roundIndex, matchIndex) {
  if (!isAdmin()) return;
  const match = getKnockoutMatch(roundIndex, matchIndex);
  if (!match) return;
  if (!match.team1Id || !match.team2Id) { toast('Aguardando os times classificados para este confronto.', 'warning'); return; }
  const card = document.querySelector(`[data-knockout-match="${roundIndex}"][data-knockout-index="${matchIndex}"]`);
  const one = card?.querySelector('[data-ko-score="one"]'); const two = card?.querySelector('[data-ko-score="two"]');
  if (!one || !two || one.value === '' || two.value === '') { toast('Preencha os dois placares para registrar a partida.', 'warning'); return; }
  const goals1 = clampNumber(one.value, 0, 99, -1); const goals2 = clampNumber(two.value, 0, 99, -1);
  if (goals1 < 0 || goals2 < 0) { toast('Use placares inteiros entre 0 e 99.', 'warning'); return; }
  let winnerId = null; let penalties1 = null; let penalties2 = null;
  if (goals1 > goals2) winnerId = match.team1Id;
  else if (goals2 > goals1) winnerId = match.team2Id;
  else {
    const pen1 = card?.querySelector('[data-ko-penalty="one"]'); const pen2 = card?.querySelector('[data-ko-penalty="two"]');
    if (!pen1 || !pen2 || pen1.value === '' || pen2.value === '') { toast('O jogo terminou empatado. Preencha os placares dos pênaltis para decidir quem avança.', 'warning'); card?.querySelector('.penalty-wrap')?.removeAttribute('hidden'); return; }
    penalties1 = clampNumber(pen1.value, 0, 99, -1); penalties2 = clampNumber(pen2.value, 0, 99, -1);
    if (penalties1 < 0 || penalties2 < 0 || penalties1 === penalties2) { toast('Os pênaltis precisam ter placares válidos e um vencedor.', 'warning'); return; }
    winnerId = penalties1 > penalties2 ? match.team1Id : match.team2Id;
  }
  const changed = match.goals1 !== goals1 || match.goals2 !== goals2 || match.winnerId !== winnerId || match.penalties1 !== penalties1 || match.penalties2 !== penalties2;
  if (!changed) { toast('Este resultado já está registrado.'); return; }
  const downstreamHasResults = state.playoffRounds.slice(roundIndex + 1).some((round) => round.matches.some((item) => item.winnerId));
  if (downstreamHasResults && !window.confirm('Alterar este resultado pode mudar os confrontos seguintes. Os placares das próximas fases serão reiniciados. Continuar?')) return;
  match.goals1 = goals1; match.goals2 = goals2; match.penalties1 = penalties1; match.penalties2 = penalties2; match.winnerId = winnerId;
  resetKnockoutFrom(roundIndex);
  syncKnockoutRounds();
  if (getChampion()) state.completedAt = new Date().toISOString(); else state.completedAt = null;
  persist(); renderAll();
  toast(`${getTeam(winnerId)?.name || 'Time'} classificado para a próxima fase.`);
}

// Application initialization runs only after a valid Supabase PIN session.
function initializeApp() {
  if (appInitialized) {
    $('teamCount').value = state.settings.teamCount;
    fillIdentityInputs(); renderAll();
    return;
  }
  appInitialized = true;
  $('teamCount').value = state.settings.teamCount;
  if (state.playoffRounds.length) syncKnockoutRounds();
  getTeamProfiles();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  fillIdentityInputs(); renderAll();
  if (migratedFromLegacy && isAdmin()) toast('Dados anteriores encontrados. Participantes e avaliações foram preservados.');
}

setLoginRole('admin');
bootAuthentication();
