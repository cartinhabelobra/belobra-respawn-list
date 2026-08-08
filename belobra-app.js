// ============================================================
// BELOBRA RESPAWN LIST — Conexao com Supabase
// Inclua este arquivo em toda pagina, depois do CDN do supabase-js
// ============================================================

const SUPABASE_URL = "https://uenrrdydgvssjlwbasbn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlbnJyZHlkZ3Zzc2psd2Jhc2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Mzg2MzgsImV4cCI6MjEwMTMxNDYzOH0.YJ3VqrZuM4Fw0IIGgmwRgeI1kRTR1DbMQ_V2VPlAkHI";

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
    widget.innerHTML = `
      <div class="belobra-user-menu" style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="belobraToggleUserMenu()">
        ${avatarUrl ? `<img src="${avatarUrl}" style="width:26px;height:26px;border-radius:50%;">` : '<div class="avatar"></div>'}
        <span>${name}</span>
        <div id="belobra-user-dropdown" style="display:none;position:absolute;top:56px;right:24px;background:#12151c;border:1px solid #232733;border-radius:10px;padding:8px;min-width:180px;z-index:20;">
          <a href="belobra-personagem.html" style="display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:#eef0f5;padding:10px;text-align:left;cursor:pointer;font-size:13px;border-radius:6px;text-decoration:none;">&#9999;&#65039; Trocar Personagem</a>
          <a href="belobra-suporte.html" style="display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:#eef0f5;padding:10px;text-align:left;cursor:pointer;font-size:13px;border-radius:6px;text-decoration:none;">&#128231; Central de Suporte</a>
          ${adminLink}
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

// Chama a Edge Function que confere o comentario do personagem no tibia.com
async function belobraVerifyCharacter(characterId){
  const { data, error } = await supabaseClient.functions.invoke('swift-responder', {
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
      characterId: r.character_id
    };
    if(r.status === 'active') active = entry;
    else if(r.status === 'calling') calling = entry;
    else waiting.push(entry);
  });
  waiting.sort((a,b) => a.joinedAt - b.joinedAt);
  return { active, calling, waiting };
}

async function belobraLoadRespawnQueue(respawnId){
  const { data, error } = await supabaseClient
    .from('queue_entries')
    .select('id, respawn_id, character_id, status, duration_min, joined_at, started_at, call_deadline, characters(name, type)')
    .eq('respawn_id', respawnId)
    .order('joined_at', { ascending: true });
  if(error){ console.error(error); return { active:null, calling:null, waiting:[] }; }
  return belobraGroupQueueRows(data);
}

// Avanca o estado da fila: encerra hunts/chamadas vencidas e chama o proximo.
// Qualquer jogador que estiver com a pagina aberta ajuda a "empurrar" esse relogio.
async function belobraTickRespawnQueue(respawnId){
  const q = await belobraLoadRespawnQueue(respawnId);
  const now = Date.now();

  if(q.active){
    const totalMs = (q.active.durationMin + 15) * 60000;
    if(now - q.active.startedAt >= totalMs){
      await supabaseClient.from('queue_entries').delete().eq('id', q.active.id);
      return belobraTickRespawnQueue(respawnId);
    }
  }
  if(q.calling && now > q.calling.deadline){
    await supabaseClient.from('queue_entries').delete().eq('id', q.calling.id);
    return belobraTickRespawnQueue(respawnId);
  }
  if(!q.active && !q.calling && q.waiting.length > 0){
    const next = q.waiting[0];
    await supabaseClient
      .from('queue_entries')
      .update({ status:'calling', call_deadline: new Date(now + 5*60000).toISOString() })
      .eq('id', next.id);
    return belobraLoadRespawnQueue(respawnId);
  }
  return q;
}

function belobraIsOcupado(q){ return !!q.active || !!q.calling; }
function belobraQueueCount(q){ return q.waiting.length + (q.calling ? 1 : 0); }

async function belobraJoinRespawnQueue(respawnId, characterId, durationMin){
  const { error } = await supabaseClient.from('queue_entries').insert({
    respawn_id: respawnId,
    character_id: characterId,
    duration_min: durationMin,
    status: 'waiting',
    joined_at: new Date().toISOString()
  });
  if(error) throw error;
}

async function belobraEndHunt(entryId){
  const { error } = await supabaseClient.from('queue_entries').delete().eq('id', entryId);
  if(error) throw error;
}

async function belobraAcceptVaga(entryId){
  const { error } = await supabaseClient
    .from('queue_entries')
    .update({ status:'active', started_at: new Date().toISOString(), call_deadline: null })
    .eq('id', entryId);
  if(error) throw error;
}

async function belobraLeaveQueueEntry(entryId){
  const { error } = await supabaseClient.from('queue_entries').delete().eq('id', entryId);
  if(error) throw error;
}

// Todas as filas de uma vez (usado na lista principal, pra mostrar status/contagem de cada card)
async function belobraLoadAllQueueStatus(){
  const { data, error } = await supabaseClient.from('queue_entries').select('respawn_id, status');
  const map = {};
  if(error){ console.error(error); return map; }
  (data || []).forEach(r => {
    if(!map[r.respawn_id]) map[r.respawn_id] = { active:false, calling:false, waitingCount:0 };
    if(r.status === 'active') map[r.respawn_id].active = true;
    else if(r.status === 'calling') map[r.respawn_id].calling = true;
    else map[r.respawn_id].waitingCount++;
  });
  return map;
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

async function belobraCreateTicket(category, description, characterId, attachmentUrls){
  const user = await belobraGetUser();
  const { data, error } = await supabaseClient
    .from('tickets')
    .insert({
      profile_id: user.id,
      character_id: characterId || null,
      category,
      description,
      attachments: attachmentUrls || []
    })
    .select()
    .single();
  if(error) throw error;
  return data;
}

// ============================================================
// Tickets — staff (admin/moderador)
// ============================================================
async function belobraGetAllTickets(){
  const { data, error } = await supabaseClient
    .from('tickets')
    .select('*, profiles(discord_username), characters(name, type)')
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
