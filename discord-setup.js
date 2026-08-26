// ============================================================
// BELOBRA — Script de configuracao automatica do servidor Discord
// ============================================================
// O que este script faz, na ordem:
// 1. Cria os cargos: ADM, Moderador, Usuario
// 2. Cria uma categoria "MODERACAO" com os canais de texto
//    #tickets-suporte e #denuncias, visiveis SO para ADM e Moderador
// 3. Cria uma categoria "BELOBRA" com um canal de voz publico
//    (visivel para todo mundo, inclusive quem nao tem nenhum cargo)
// 4. Cria um Webhook em cada canal de texto (tickets e denuncias)
//    e imprime as URLs no final — GUARDE ELAS, vamos usar depois
//
// REQUISITOS ANTES DE RODAR:
// - Ter o Node.js instalado no seu PC (versao 18 ou mais nova)
//   Baixe em: https://nodejs.org (se nao tiver certeza, baixe a
//   versao "LTS")
// - Um Bot do Discord criado e JA CONVIDADO pro seu servidor
//   com a permissao "Administrator" (veja o passo a passo que
//   te mandei junto com este arquivo)
//
// COMO RODAR:
// 1. Preencha as duas linhas abaixo (BOT_TOKEN e GUILD_ID)
// 2. Abra o terminal/prompt de comando na pasta onde salvou este arquivo
// 3. Digite: node discord-setup.js
// 4. Espere terminar e leia o resultado no terminal
// ============================================================

const BOT_TOKEN = "COLE_AQUI_O_TOKEN_DO_BOT";
const GUILD_ID = "COLE_AQUI_O_ID_DO_SERVIDOR";

const API = "https://discord.com/api/v10";

// Valores de permissao do Discord (nao precisa mexer nisso)
const PERM_VIEW_CHANNEL = 1024n;      // 0x400
const PERM_CONNECT = 1048576n;        // 0x100000 (entrar em canal de voz)
const PERM_SPEAK = 2097152n;          // 0x200000
const PERM_SEND_MESSAGES = 2048n;     // 0x800
const PERM_ADMINISTRATOR = 8n;        // 0x8

async function discordFetch(endpoint, options = {}) {
  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ${res.status} em ${endpoint}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function main() {
  if (BOT_TOKEN.includes("COLE_AQUI") || GUILD_ID.includes("COLE_AQUI")) {
    console.log("\n⚠️  Preencha o BOT_TOKEN e o GUILD_ID no topo do arquivo antes de rodar!\n");
    return;
  }

  console.log("Buscando cargo @everyone...");
  const roles = await discordFetch(`/guilds/${GUILD_ID}/roles`);
  const everyoneRole = roles.find(r => r.name === "@everyone");

  console.log("Criando cargo ADM...");
  const admRole = await discordFetch(`/guilds/${GUILD_ID}/roles`, {
    method: "POST",
    body: JSON.stringify({ name: "ADM", color: 14730058, hoist: true, permissions: PERM_ADMINISTRATOR.toString(), mentionable: false })
  });

  console.log("Criando cargo Moderador...");
  const modRole = await discordFetch(`/guilds/${GUILD_ID}/roles`, {
    method: "POST",
    body: JSON.stringify({ name: "Moderador", color: 3131783, hoist: true, permissions: "0", mentionable: false })
  });

  console.log("Criando cargo Usuario...");
  const userRole = await discordFetch(`/guilds/${GUILD_ID}/roles`, {
    method: "POST",
    body: JSON.stringify({ name: "Usuario", color: 9145244, hoist: false, permissions: "0", mentionable: false })
  });

  console.log("Criando categoria MODERACAO...");
  const modCategory = await discordFetch(`/guilds/${GUILD_ID}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: "MODERACAO",
      type: 4,
      permission_overwrites: [
        { id: everyoneRole.id, type: 0, deny: PERM_VIEW_CHANNEL.toString() },
        { id: admRole.id, type: 0, allow: PERM_VIEW_CHANNEL.toString() },
        { id: modRole.id, type: 0, allow: PERM_VIEW_CHANNEL.toString() }
      ]
    })
  });

  console.log("Criando canal #tickets-suporte...");
  const ticketsChannel = await discordFetch(`/guilds/${GUILD_ID}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: "tickets-suporte",
      type: 0,
      parent_id: modCategory.id,
      permission_overwrites: [
        { id: everyoneRole.id, type: 0, deny: PERM_VIEW_CHANNEL.toString() },
        { id: admRole.id, type: 0, allow: PERM_VIEW_CHANNEL.toString() },
        { id: modRole.id, type: 0, allow: PERM_VIEW_CHANNEL.toString() }
      ]
    })
  });

  console.log("Criando canal #denuncias...");
  const denunciasChannel = await discordFetch(`/guilds/${GUILD_ID}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: "denuncias",
      type: 0,
      parent_id: modCategory.id,
      permission_overwrites: [
        { id: everyoneRole.id, type: 0, deny: PERM_VIEW_CHANNEL.toString() },
        { id: admRole.id, type: 0, allow: PERM_VIEW_CHANNEL.toString() },
        { id: modRole.id, type: 0, allow: PERM_VIEW_CHANNEL.toString() }
      ]
    })
  });

  console.log("Criando categoria BELOBRA (publica)...");
  const geralCategory = await discordFetch(`/guilds/${GUILD_ID}/channels`, {
    method: "POST",
    body: JSON.stringify({ name: "BELOBRA", type: 4 })
  });

  console.log("Criando canal de voz Belobra (publico para todo mundo)...");
  await discordFetch(`/guilds/${GUILD_ID}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: "Belobra",
      type: 2,
      parent_id: geralCategory.id,
      permission_overwrites: [
        { id: everyoneRole.id, type: 0, allow: (PERM_VIEW_CHANNEL | PERM_CONNECT | PERM_SPEAK).toString() }
      ]
    })
  });

  console.log("Criando webhook do canal #tickets-suporte...");
  const ticketsWebhook = await discordFetch(`/channels/${ticketsChannel.id}/webhooks`, {
    method: "POST",
    body: JSON.stringify({ name: "Belobra Bot" })
  });

  console.log("Criando webhook do canal #denuncias...");
  const denunciasWebhook = await discordFetch(`/channels/${denunciasChannel.id}/webhooks`, {
    method: "POST",
    body: JSON.stringify({ name: "Belobra Bot" })
  });

  console.log("\n\n========================================");
  console.log("TUDO PRONTO! Guarde essas duas URLs:");
  console.log("========================================");
  console.log("WEBHOOK TICKETS:   ", ticketsWebhook.url);
  console.log("WEBHOOK DENUNCIAS: ", denunciasWebhook.url);
  console.log("========================================");
  console.log("\nCargos criados: ADM, Moderador, Usuario");
  console.log("Lembre-se de: ir no Discord > clicar com o botao direito no seu proprio nome > Cargos > marcar 'ADM'");
  console.log("Para dar o cargo Moderador a alguem, faca o mesmo processo com a pessoa.");
}

main().catch(err => console.error("\nErro ao configurar o servidor:\n", err.message));
