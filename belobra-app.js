// ============================================================
// BELOBRA RESPAWN LIST — Conexao com Supabase
// Inclua este arquivo em toda pagina, depois do CDN do supabase-js
// ============================================================

const SUPABASE_URL = "https://dfbuvkgnczgdhfcgvxjv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYnV2a2duY3pnZGhmY2d2eGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2OTM3NjUsImV4cCI6MjEwMzI2OTc2NX0.4z9m9sLNfXlxSCR9VcwaZGsfH_-kPD7N8Z7Ee5T9Hs0";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------
// Login / Logout
// ------------------------------------------------------------
async function belobraSignInDiscord(){
  const redirectTo = window.location.origin + window.location.pathname;
  await supabaseClient.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo }
  });
}

async function belobraSignOut(){
  await supabaseClient.auth.signOut();
  window.location.reload();
}

async function belobraGetUser(){
  const { data } = await supabaseClient.auth.getUser();
  return data ? data.user : null;
}

// ------------------------------------------------------------
// Atualiza o widget de usuario no cabecalho (avatar + nome / botao de login)
// Espera encontrar um elemento com id="belobra-user-widget" no HTML
// ------------------------------------------------------------
async function belobraRenderUserWidget(){
  const widget = document.getElementById('belobra-user-widget');
  if(!widget) return;

  const user = await belobraGetUser();

  if(user){
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || meta.custom_claims?.global_name || 'Jogador';
    const avatarUrl = meta.avatar_url || '';
    const role = await belobraGetMyRole();
    const adminLink = (role === 'admin' || role === 'moderator')
      ? '<a href="belobra-admin-tickets.html" style="display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:#e0a94a;padding:10px;text-align:left;cursor:pointer;font-size:13px;border-radius:6px;text-decoration:none;">&#128737;&#65039; Painel de Tickets</a>'
      : '';
    const banLink = (role === 'admin')
      ? '<a href="belobra-admin-bans.html" style="display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:#e2574c;padding:10px;text-align:left;cursor:pointer;font-size:13px;border-radius:6px;text-decoration:none;">&#128683; Banimentos</a>'
      : '';
    widget.innerHTML = `
      <div class="belobra-user-menu" style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="belobraToggleUserMenu()">
        ${avatarUrl ? `<img src="${avatarUrl}" style="width:26px;height:26px;border-radius:50%;">` : '<div class="avatar"></div>'}
        <span>${name}</span>
        <div id="belobra-user-dropdown" style="display:none;position:absolute;top:56px;right:24px;background:#12151c;border:1px solid #232733;border-radius:10px;padding:8px;min-width:180px;z-index:20;">
          <a href="belobra-personagem.html" style="display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:#eef0f5;padding:10px;text-align:left;cursor:pointer;font-size:13px;border-radius:6px;text-decoration:none;">&#9999;&#65039; Trocar Personagem</a>
          <a href="belobra-suporte.html" style="display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:#eef0f5;padding:10px;text-align:left;cursor:pointer;font-size:13px;border-radius:6px;text-decoration:none;">&#128231; Central de Suporte</a>
          ${adminLink}
          ${banLink}
          <div style="height:1px;background:#232733;margin:4px 0;"></div>
          <button onclick="belobraSignOut()" style="display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:#e2574c;padding:10px;text-align:left;cursor:pointer;font-size:13px;border-radius:6px;">&#8618; Sair</button>
        </div>
      </div>
    `;
  } else {
    widget.innerHTML = `
      <button onclick="belobraSignInDiscord()" style="display:flex;align-items:center;gap:8px;background:#5865F2;color:#fff;border:none;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;">
        Entrar com Discord
      </button>
    `;
  }
}

function belobraToggleUserMenu(){
  const dropdown = document.getElementById('belobra-user-dropdown');
  if(dropdown){
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
}

// Atualiza o widget quando o estado de login muda (login, logout, retorno do OAuth)
supabaseClient.auth.onAuthStateChange((_event, _session) => {
  belobraRenderUserWidget();
});

// Roda assim que a pagina carrega
document.addEventListener('DOMContentLoaded', belobraRenderUserWidget);

// ------------------------------------------------------------
// Personagens (Main / Maker)
// ------------------------------------------------------------
function belobraGenerateCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for(let i=0;i<10;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

async function belobraGetMyCharacters(){
  const user = await belobraGetUser();
  if(!user) return [];
  const { data, error } = await supabaseClient
    .from('characters')
    .select('*')
    .eq('profile_id', user.id)
    .order('type', { ascending: true });
  if(error){ console.error(error); return []; }
  return data;
}

// Retorna so os personagens VERIFICADOS do usuario logado (para usar nas filas)
async function belobraGetVerifiedCharacters(){
  const all = await belobraGetMyCharacters();
  return all.filter(c => c.verified);
}

// Cria ou atualiza um personagem (Main ou Maker) com um novo codigo de verificacao
async function belobraSaveCharacter(name, type){
  const user = await belobraGetUser();
  if(!user) throw new Error('Voce precisa estar logado.');
  if(!['main','maker'].includes(type)) throw new Error('Tipo de personagem invalido.');

  const code = belobraGenerateCode();

  // Verifica se ja existe um personagem desse tipo pro usuario
  const { data: existing } = await supabaseClient
    .from('characters')
    .select('id')
    .eq('profile_id', user.id)
    .eq('type', type)
    .maybeSingle();

  if(existing){
    const { data, error } = await supabaseClient
      .from('characters')
      .update({ name, verification_code: code, verified: false })
      .eq('id', existing.id)
      .select()
      .single();
    if(error) throw error;
    return data;
  } else {
    const { data, error } = await supabaseClient
      .from('characters')
      .insert({ profile_id: user.id, name, type, verification_code: code, verified: false })
      .select()
      .single();
    if(error) throw error;
    return data;
  }
}

// ------------------------------------------------------------
// Service — personagem de outra conta usado com autorizacao
// ------------------------------------------------------------
async function belobraGetMyServicePermissions(){
  const { data, error } = await supabaseClient.rpc('get_my_service_permissions');
  if(error) throw error;
  return data || [];
}

async function belobraGetMyServiceCharacters(){
  const { data, error } = await supabaseClient.rpc('get_my_service_characters');
  if(error) throw error;
  return (data || []).map(c => ({
    id: c.id,
    name: c.name,
    type: 'service',
    verified: !!c.verified,
    ownerProfileId: c.owner_profile_id,
    servicePermissionId: c.service_permission_id
  }));
}

async function belobraGetMyQueueCharacterOptions(){
  const own = (await belobraGetVerifiedCharacters()).map(c => ({
    ...c,
    servicePermissionId: null
  }));
  let service = [];
  try { service = await belobraGetMyServiceCharacters(); }
  catch(e){ console.warn('Service ainda nao configurado:', e.message); }
  return own.concat(service);
}

async function belobraCreateServiceInvite(characterId){
  const { data, error } = await supabaseClient.rpc('create_service_invite', { p_character_id: characterId });
  if(error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function belobraAcceptServiceInvite(inviteCode){
  const { data, error } = await supabaseClient.rpc('accept_service_invite', { p_invite_code: inviteCode.trim() });
  if(error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function belobraRevokeServicePermission(permissionId){
  const { error } = await supabaseClient.rpc('revoke_service_permission', { p_permission_id: permissionId });
  if(error) throw error;
}

// Chama a Edge Function que confere o comentario do personagem no tibia.com
async function belobraVerifyCharacter(characterId){
  const { data, error } = await supabaseClient.functions.invoke('verify-character', {
    body: { character_id: characterId }
  });
  if(error) throw error;
  return data; // { verified: true/false, message: '...' }
}

// ------------------------------------------------------------
// RESPAWNS (lista vinda do banco, nao mais fixa no codigo)
// ------------------------------------------------------------
async function belobraGetRespawns(){
  const { data, error } = await supabaseClient
    .from('respawns')
    .select('id, name')
    .order('name', { ascending: true });
  if(error) throw error;
  return data;
}

// ------------------------------------------------------------
// FILA DE RESPAWN (compartilhada entre todos os jogadores)
// ------------------------------------------------------------
function belobraGroupQueueRows(rows){
  let active = null, calling = null;
  const waiting = [];
  rows.forEach(r => {
    const entry = {
      id: r.id,
      name: r.characters ? r.characters.name : '???',
      type: r.characters ? r.characters.type : 'main',
      durationMin: r.duration_min,
      joinedAt: new Date(r.joined_at).getTime(),
      startedAt: r.started_at ? new Date(r.started_at).getTime() : null,
      deadline: r.call_deadline ? new Date(r.call_deadline).getTime() : null,
      characterId: r.character_id,
      afkChallengeDeadline: r.afk_challenge_deadline ? new Date(r.afk_challenge_deadline).getTime() : null,
      claimPriorityAt: r.claim_priority_at ? new Date(r.claim_priority_at).getTime() : null,
      returnToQueueAfterHunt: r.return_to_queue_after_hunt === true,
      claimReducedDuration: r.claim_reduced_duration === true,
      queuedByProfileId: r.queued_by_profile_id || null,
      servicePermissionId: r.service_permission_id || null
    };
    if(r.status === 'active') active = entry;
    else if(r.status === 'calling') calling = entry;
    else waiting.push(entry);
  });
  waiting.sort((a,b) => (a.claimPriorityAt ?? Number.POSITIVE_INFINITY) - (b.claimPriorityAt ?? Number.POSITIVE_INFINITY) || a.joinedAt - b.joinedAt);
  return { active, calling, waiting };
}

async function belobraLoadRespawnQueue(respawnId){
  const { data, error } = await supabaseClient
    .from('queue_entries')
    .select('id, respawn_id, character_id, status, duration_min, joined_at, started_at, call_deadline, afk_challenge_deadline, claim_priority_at, return_to_queue_after_hunt, claim_reduced_duration, queued_by_profile_id, service_permission_id, characters(name, type)')
    .eq('respawn_id', respawnId)
    .order('joined_at', { ascending: true });
  if(error){ console.error(error); return { active:null, calling:null, waiting:[] }; }
  return belobraGroupQueueRows(data);
}

// Avanca o estado da fila: encerra hunts/chamadas vencidas e chama o proximo.
// Roda no servidor (Edge Function), com permissao total, pra nao depender
// da trava de "so o dono mexe" que protege as acoes manuais dos jogadores.
async function belobraTickRespawnQueue(respawnId){
  try{
    await supabaseClient.functions.invoke('tick-queue', {
      body: { respawn_id: respawnId }
    });
  }catch(e){
    console.error('Erro ao avancar a fila:', e);
  }
  return belobraLoadRespawnQueue(respawnId);
}

function belobraIsOcupado(q){ return !!q.active || !!q.calling; }
function belobraQueueCount(q){ return q.waiting.length + (q.calling ? 1 : 0); }

async function belobraJoinRespawnQueue(respawnId, characterId, durationMin, servicePermissionId = null){
  const { data, error } = await supabaseClient.rpc('join_respawn_queue', {
    p_respawn_id: respawnId,
    p_character_id: characterId,
    p_duration_min: durationMin,
    p_service_permission_id: servicePermissionId || null
  });
  if(error) throw error;
  return data;
}

async function belobraEndHunt(entryId){
  const { error } = await supabaseClient.rpc('service_end_hunt', { p_entry_id: entryId });
  if(error) throw error;
}

async function belobraAcceptVaga(entryId){
  const { error } = await supabaseClient.rpc('service_accept_queue', { p_entry_id: entryId });
  if(error) throw error;
}

async function belobraLeaveQueueEntry(entryId){
  const { error } = await supabaseClient.rpc('service_leave_queue', { p_entry_id: entryId });
  if(error) throw error;
}

// Todas as filas de uma vez (usado na lista principal, pra mostrar status/contagem/quem esta caçando em cada card)
async function belobraLoadAllQueueStatus(){
  const { data, error } = await supabaseClient
    .from('queue_entries')
    .select('id, respawn_id, status, duration_min, started_at, character_id, service_permission_id, characters(name, type)');
  const map = {};
  if(error){ console.error(error); return map; }
  (data || []).forEach(r => {
    if(!map[r.respawn_id]) map[r.respawn_id] = { active:false, calling:false, waitingCount:0, activeName:null, activeType:null, activeCharacterId:null, huntEndsAt:null };
    if(r.status === 'active'){
      map[r.respawn_id].active = true;
      map[r.respawn_id].activeName = r.characters ? r.characters.name : null;
      map[r.respawn_id].activeType = r.service_permission_id ? 'service' : (r.characters ? r.characters.type : null);
      map[r.respawn_id].activeCharacterId = r.character_id;
      map[r.respawn_id].huntEndsAt = new Date(r.started_at).getTime() + (r.duration_min + 15) * 60000;
    }
    else if(r.status === 'calling') map[r.respawn_id].calling = true;
    else map[r.respawn_id].waitingCount++;
  });
  return map;
}

// Verifica, pra uma lista de personagens (Main e Maker da mesma conta),
// se algum deles ja esta ocupado em qualquer fila/hunt, ou se a CONTA
// esta de cooldown. Se estiver, TODOS os personagens da conta ficam
// bloqueados (a regra vale pra conta inteira, nao so pra 1 personagem).
async function belobraGetCharacterAvailability(characterIds){
  const map = {};
  if(!characterIds.length) return map;

  const user = await belobraGetUser();
  if(!user) return map;

  const loadRows = async () => {
    const { data, error } = await supabaseClient
      .from('queue_entries')
      .select('id, character_id, respawn_id, status, duration_min, started_at, call_deadline, claim_reduced_duration, queued_by_profile_id, characters(name, profile_id)')
      .in('character_id', characterIds);
    if(error) throw error;
    return data || [];
  };

  const rows = await loadRows();
  const respawnsToClean = new Set();
  const now = Date.now();
  rows.forEach(r => {
    let expired = false;
    if(r.status === 'active' && r.started_at){
      const endsAt = new Date(r.started_at).getTime() + (r.claim_reduced_duration ? r.duration_min : r.duration_min + 15) * 60000;
      if(now >= endsAt) expired = true;
    }
    if(r.status === 'calling' && r.call_deadline && now > new Date(r.call_deadline).getTime()) expired = true;
    if(expired) respawnsToClean.add(r.respawn_id);
  });

  for(const respawnId of respawnsToClean){
    try{ await belobraTickRespawnQueue(respawnId); }catch(e){ console.error(e); }
  }

  const freshRows = await loadRows();
  const ownRows = freshRows.filter(r => r.queued_by_profile_id === user.id);
  const accountBusy = ownRows.length > 0;
  const ownBusyName = ownRows[0]?.characters?.name || null;
  const usedByOther = {};
  freshRows.filter(r => r.queued_by_profile_id !== user.id).forEach(r => {
    usedByOther[r.character_id] = r.characters?.name || 'outro jogador';
  });

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('cooldown_until')
    .eq('id', user.id)
    .single();
  const cooldownUntil = profile?.cooldown_until ? new Date(profile.cooldown_until).getTime() : null;
  const onCooldown = cooldownUntil && cooldownUntil > Date.now();

  characterIds.forEach(id => {
    const otherName = usedByOther[id] || null;
    map[id] = {
      busy: accountBusy || !!otherName,
      busyWith: accountBusy ? ownBusyName : otherName,
      cooldownUntil: onCooldown ? cooldownUntil : null
    };
  });
  return map;
}

// Busca a entrada de fila/hunt ativa do usuario atual, em qualquer respawn
// (Main ou Maker) — usada pra mostrar o bloco fixo "voce esta aqui" na home
async function belobraGetMyActiveEntry(){
  const user = await belobraGetUser();
  if(!user) return null;

  const { data, error } = await supabaseClient
    .from('queue_entries')
    .select('id, respawn_id, status, duration_min, started_at, call_deadline, joined_at, afk_challenge_deadline, claim_reduced_duration, queued_by_profile_id, service_permission_id, characters(name, type), respawns(name)')
    .eq('queued_by_profile_id', user.id)
    .limit(1)
    .maybeSingle();

  if(error || !data) return null;

  return {
    id: data.id,
    respawnId: data.respawn_id,
    respawnName: data.respawns ? data.respawns.name : '?',
    characterName: data.characters ? data.characters.name : '?',
    characterType: data.service_permission_id ? 'service' : (data.characters ? data.characters.type : 'main'),
    servicePermissionId: data.service_permission_id || null,
    status: data.status,
    durationMin: data.duration_min,
    claimReducedDuration: data.claim_reduced_duration === true,
    startedAt: data.started_at ? new Date(data.started_at).getTime() : null,
    callDeadline: data.call_deadline ? new Date(data.call_deadline).getTime() : null,
    joinedAt: data.joined_at ? new Date(data.joined_at).getTime() : null,
    afkChallengeDeadline: data.afk_challenge_deadline ? new Date(data.afk_challenge_deadline).getTime() : null,
  };
}

// Retorna os IDs dos respawns onde o usuario tem algum personagem esperando na fila
// (usado pra so liberar o botao de Denunciar pra quem realmente esta na fila)
async function belobraGetMyWaitingRespawnIds(){
  const user = await belobraGetUser();
  if(!user) return [];

  const { data } = await supabaseClient
    .from('queue_entries')
    .select('respawn_id')
    .eq('queued_by_profile_id', user.id)
    .eq('status', 'waiting');

  return (data || []).map(r => r.respawn_id);
}

// ============================================================
// Cargo do usuario (user / moderator / admin)
// ============================================================
async function belobraGetMyRole(){
  const user = await belobraGetUser();
  if(!user) return 'guest';
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if(error || !data) return 'user';
  return data.role;
}

// ============================================================
// Upload de anexos de ticket (Supabase Storage)
// ============================================================
async function belobraUploadTicketAttachment(file){
  const user = await belobraGetUser();
  const ext = file.name.split('.').pop();
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await supabaseClient.storage.from('ticket-attachments').upload(path, file);
  if(error) throw error;
  const { data } = supabaseClient.storage.from('ticket-attachments').getPublicUrl(path);
  return data.publicUrl;
}

// ============================================================
// Tickets — jogador
// ============================================================
async function belobraGetMyTickets(){
  const user = await belobraGetUser();
  const { data, error } = await supabaseClient
    .from('tickets')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false });
  if(error) throw error;
  return data;
}

async function belobraCreateTicket(category, description, characterId, attachmentUrls, reportedCharacterId, reportedRespawnId){
  const user = await belobraGetUser();
  const { data, error } = await supabaseClient
    .from('tickets')
    .insert({
      profile_id: user.id,
      character_id: characterId || null,
      category,
      description,
      attachments: attachmentUrls || [],
      reported_character_id: reportedCharacterId || null,
      reported_respawn_id: reportedRespawnId || null
    })
    .select()
    .single();
  if(error) throw error;
  return data;
}

// ============================================================
// Report AFK (dentro da hunt, com confirmacao de presenca)
// ============================================================

// So o proximo da fila consegue chamar isso com sucesso (validado no banco)
async function belobraReportAfk(targetEntryId){
  const { error } = await supabaseClient.rpc('service_report_afk', { p_target_entry_id: targetEntryId });
  if(error) throw error;
}

// Chamado pelo proprio caçador pra provar que esta la
async function belobraConfirmAfkPresence(entryId){
  const { error } = await supabaseClient.rpc('service_confirm_afk', { p_entry_id: entryId });
  if(error) throw error;
}

// Verifica se algum personagem meu e o "proximo da fila" (pode reportar AFK) num respawn
async function belobraAmINextInQueue(respawnId, myCharacterIds){
  if(!myCharacterIds.length) return false;
  const { data } = await supabaseClient
    .from('queue_entries')
    .select('character_id')
    .eq('respawn_id', respawnId)
    .eq('status', 'waiting')
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return !!(data && myCharacterIds.includes(data.character_id));
}

// ============================================================
// Banimentos (somente ADM)
// ============================================================

const BAN_DAYS = { 1: 1, 2: 7, 3: 30 }; // estagio 4 = permanente (sem data)

// Aplica o proximo estagio de banimento a conta dona de um personagem
async function belobraBanCharacterOwner(characterId, reason){
  const { data: character, error: charError } = await supabaseClient
    .from('characters')
    .select('profile_id, name')
    .eq('id', characterId)
    .single();
  if(charError || !character) throw new Error('Personagem nao encontrado.');

  const { data: profile, error: profError } = await supabaseClient
    .from('profiles')
    .select('ban_stage')
    .eq('id', character.profile_id)
    .single();
  if(profError || !profile) throw new Error('Perfil nao encontrado.');

  const newStage = Math.min(4, (profile.ban_stage || 0) + 1);
  const bannedUntil = newStage === 4 ? null : new Date(Date.now() + BAN_DAYS[newStage] * 86400000).toISOString();

  // Remove qualquer entrada de fila ativa da conta banida
  const { data: allChars } = await supabaseClient.from('characters').select('id').eq('profile_id', character.profile_id);
  const charIds = (allChars || []).map(c => c.id);
  if(charIds.length){
    await supabaseClient.from('queue_entries').delete().in('character_id', charIds);
  }

  const { error: updateError } = await supabaseClient
    .from('profiles')
    .update({ ban_stage: newStage, banned_until: bannedUntil, ban_reason: reason || null })
    .eq('id', character.profile_id);
  if(updateError) throw updateError;

  return { stage: newStage, bannedUntil, profileId: character.profile_id, characterName: character.name };
}

// Lista todos os perfis que ja foram banidos alguma vez (estagio > 0)
async function belobraGetBannedProfiles(){
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, discord_username, discord_avatar_url, ban_stage, banned_until, ban_reason')
    .gt('ban_stage', 0)
    .order('banned_until', { ascending: false, nullsFirst: false });
  if(error) throw error;
  return data;
}

// Remove o banimento e deixa a conta marcada no estagio escolhido (pra escalar certo da proxima vez)
async function belobraUnbanProfile(profileId, keepStage){
  const { error } = await supabaseClient
    .from('profiles')
    .update({ banned_until: null, ban_stage: keepStage })
    .eq('id', profileId);
  if(error) throw error;
}

// ============================================================
// Tickets — staff (admin/moderador)
// ============================================================
async function belobraGetAllTickets(){
  const { data, error } = await supabaseClient
    .from('tickets')
    .select('*, profiles(discord_username), character:character_id(name, type), reported_character:reported_character_id(id, name, type, profile_id)')
    .order('created_at', { ascending: false });
  if(error) throw error;
  return data;
}

async function belobraUpdateTicketStatus(ticketId, status){
  const { error } = await supabaseClient
    .from('tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  if(error) throw error;
}

// Exclui um ticket manualmente (staff). As mensagens ligadas a ele
// somem juntas por causa do "on delete cascade" no banco.
async function belobraDeleteTicket(ticketId){
  const { error } = await supabaseClient
    .from('tickets')
    .delete()
    .eq('id', ticketId);
  if(error) throw error;
}

// ============================================================
// Mensagens dentro de um ticket (conversa)
// ============================================================
async function belobraGetTicketMessages(ticketId){
  const { data, error } = await supabaseClient
    .from('ticket_messages')
    .select('*, profiles(discord_username)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if(error) throw error;
  return data;
}

async function belobraSendTicketMessage(ticketId, message, isStaff){
  const user = await belobraGetUser();
  const { error } = await supabaseClient
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      sender_profile_id: user.id,
      message,
      is_staff: !!isStaff
    });
  if(error) throw error;
}
// CLAIM — guild dominante e administrador autorizado
async function belobraGetMyClaimPermission(){
  const { data, error } = await supabaseClient.rpc('get_my_claim_permission');
  if(error) throw error;
  const permission = Array.isArray(data) ? data[0] : data;
  return {
    claimEnabled: permission?.claim_enabled === true,
    guildClaimActive: permission?.guild_claim_active === true,
    canClaim: permission?.can_claim === true
  };
}

async function belobraGetClaimEligibleCharacters(){
  const ownCharacters = await belobraGetMyCharacters();
  let permission;
  try {
    permission = await belobraGetMyClaimPermission();
  } catch(e) {
    console.warn('Permissao de Claim ainda nao configurada:', e.message);
    return [];
  }

  let serviceCharacters = [];
  if(permission.claimEnabled || permission.guildClaimActive){
    try { serviceCharacters = await belobraGetMyServiceCharacters(); }
    catch(e){ console.warn('Service Claim ainda nao configurado:', e.message); }
  }

  const characters = (permission.claimEnabled || permission.guildClaimActive)
    ? ownCharacters.concat(serviceCharacters)
    : ownCharacters;

  return characters.filter(c => {
    if(!c.verified || !permission.canClaim) return false;
    if(permission.claimEnabled) return true;
    return permission.guildClaimActive
      && ['rangers','rangers academy'].includes(String(c.guild_name || '').trim().toLowerCase());
  });
}
async function belobraCreateClaim(activeEntryId,characterId){
 const {data,error}=await supabaseClient.rpc('create_claim',{p_active_entry_id:activeEntryId,p_claimer_character_id:characterId});
 if(error) throw error; return data;
}
async function belobraGetOpenClaims(respawnId){
 const {data,error}=await supabaseClient.from('claim_requests').select('id,respawn_id,active_entry_id,claimer_character_id,claimer_profile_id,status,created_at,response_deadline').eq('respawn_id',respawnId).eq('status','pending');
 if(error) throw error; return data||[];
}
async function belobraResolveClaim(claimId,decision){
 const {error}=await supabaseClient.rpc('resolve_claim',{p_claim_id:claimId,p_decision:decision});
 if(error) throw error;
}
async function belobraExpireClaims(){
 const {error}=await supabaseClient.rpc('expire_claims'); if(error) console.warn('Claim tick',error);
}

async function belobraCheckGuildDaily(){
  const u=await belobraGetUser();
  if(!u)return {skipped:true};
  const {data:chars,error}=await supabaseClient.from('characters').select('id,verified,guild_checked_at').eq('profile_id',u.id).eq('verified',true);
  if(error)throw error;
  const now=Date.now();
  const due=(chars||[]).filter(c=>!c.guild_checked_at || now-new Date(c.guild_checked_at).getTime()>=86400000);
  const results=[];
  for(const c of due){
    const r=await supabaseClient.functions.invoke('check-guild',{body:{character_id:c.id}});
    if(r.error){results.push({id:c.id,ok:false,error:r.error.message});continue}
    results.push(r.data);
  }
  return {checked:results};
}
