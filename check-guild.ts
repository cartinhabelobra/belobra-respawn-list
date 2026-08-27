import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Não autenticado.' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Não autenticado.' }, 401);

    const body = await req.json();
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: character, error: characterError } = await adminClient
      .from('characters')
      .select('id, name, profile_id')
      .eq('id', body.character_id)
      .eq('profile_id', user.id)
      .single();

    if (characterError || !character) {
      return json({ error: 'Personagem não encontrado.' }, 404);
    }

    const apiResponse = await fetch(
      'https://api.tibiadata.com/v4/character/' + encodeURIComponent(character.name) + '.json'
    );
    if (!apiResponse.ok) return json({ error: 'Não foi possível consultar o TibiaData.' }, 503);

    const tibiaData = await apiResponse.json();
    const tibiaCharacter = tibiaData?.character?.character;
    if (!tibiaCharacter) return json({ error: 'Personagem não encontrado no TibiaData.' }, 503);

    const guildName = tibiaCharacter.guild?.name || null;
    const { error: characterUpdateError } = await adminClient
      .from('characters')
      .update({
        guild_name: guildName,
        guild_checked_at: new Date().toISOString()
      })
      .eq('id', character.id);

    if (characterUpdateError) return json({ error: characterUpdateError.message }, 500);

    const { data: verifiedCharacters, error: verifiedCharactersError } = await adminClient
      .from('characters')
      .select('guild_name')
      .eq('profile_id', user.id)
      .eq('verified', true);

    if (verifiedCharactersError) return json({ error: verifiedCharactersError.message }, 500);

    const dominantGuilds = new Set(['rangers', 'rangers academy']);
    const guildClaimActive = (verifiedCharacters || []).some((item) =>
      dominantGuilds.has(String(item.guild_name || '').trim().toLowerCase())
    );

    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({ guild_claim_active: guildClaimActive })
      .eq('id', user.id);

    if (profileUpdateError) return json({ error: profileUpdateError.message }, 500);

    return json({
      ok: true,
      guild_name: guildName,
      guild_claim_active: guildClaimActive
    });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
