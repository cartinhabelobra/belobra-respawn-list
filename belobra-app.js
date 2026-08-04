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
    widget.innerHTML = `
      <div class="belobra-user-menu" style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="belobraToggleUserMenu()">
        ${avatarUrl ? `<img src="${avatarUrl}" style="width:26px;height:26px;border-radius:50%;">` : '<div class="avatar"></div>'}
        <span>${name}</span>
        <div id="belobra-user-dropdown" style="display:none;position:absolute;top:56px;right:24px;background:#12151c;border:1px solid #232733;border-radius:10px;padding:8px;min-width:140px;z-index:20;">
          <button onclick="belobraSignOut()" style="width:100%;background:none;border:none;color:#eef0f5;padding:8px 10px;text-align:left;cursor:pointer;font-size:13px;border-radius:6px;">Sair</button>
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
