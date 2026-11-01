import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const searchTerms: Record<string, string> = {
  "flamengo": "Flamengo",
  "palmeiras": "Palmeiras",
  "corinthians": "Corinthians",
  "sao-paulo": "Sao Paulo",
  "gremio": "Gremio",
  "atletico-mineiro": "Atletico Mineiro",
  "real-madrid": "Real Madrid",
  "barcelona": "Barcelona",
  "manchester-city": "Manchester City",
  "liverpool": "Liverpool",
  "bayern-munich": "Bayern Munich",
  "paris-saint-germain": "Paris Saint Germain",
};

function positionDetails(raw: unknown): { code: "GK" | "DEF" | "MID" | "ATT"; label: string } {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("goalkeeper") || value === "gk") return { code: "GK", label: "Goleiro" };
  if (value.includes("defend") || value === "def") return { code: "DEF", label: "Defensor" };
  if (value.includes("midfield") || value === "mid") return { code: "MID", label: "Meio-campista" };
  if (value.includes("attack") || value.includes("forward") || value === "att") return { code: "ATT", label: "Atacante" };
  return { code: "MID", label: "Meio-campista" };
}

async function apiFootball(path: string, apiKey: string) {
  const response = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { "x-apisports-key": apiKey },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.errors ? JSON.stringify(payload.errors) : `API-Football respondeu HTTP ${response.status}.`;
    throw new Error(message);
  }
  if (payload?.errors && Object.keys(payload.errors).length) {
    throw new Error(JSON.stringify(payload.errors));
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableMap = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    const secretMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const anonKey = publishableMap.default || Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = secretMap.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("API_FOOTBALL_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("As chaves padrão do Supabase não foram disponibilizadas no runtime da Edge Function. Confira Edge Functions → Secrets.");
    if (!apiKey) throw new Error("A chave API_FOOTBALL_KEY ainda não foi cadastrada em Edge Function Secrets.");

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Sessão não encontrada. Entre na Copa antes de importar." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Sessão inválida ou expirada. Entre novamente na Copa." }, 401);
    const { data: role, error: roleError } = await userClient.rpc("copa_get_role");
    if (roleError || role !== "admin") return json({ error: "Somente o ADM pode importar elencos." }, 403);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await req.json();
    const action = String(body?.action || "");
    const clubId = String(body?.club_id || "");
    if (!clubId) return json({ error: "Clube não informado." }, 400);

    const { data: club, error: clubError } = await service
      .from("game_clubs")
      .select("id,slug,name,country_name,country_code,league_name")
      .eq("id", clubId)
      .single();
    if (clubError || !club) return json({ error: "Clube não encontrado no catálogo." }, 404);

    if (action === "search-team") {
      const query = searchTerms[club.slug] || club.name;
      const payload = await apiFootball(`teams?search=${encodeURIComponent(query)}`, apiKey);
      const teams = (payload?.response || []).map((item: any) => ({
        id: Number(item?.team?.id),
        name: String(item?.team?.name || ""),
        code: String(item?.team?.code || ""),
        country: String(item?.team?.country || ""),
        founded: item?.team?.founded ?? null,
        venue: String(item?.venue?.name || ""),
      })).filter((item: any) => Number.isFinite(item.id) && item.id > 0);
      return json({ teams, provider: "API-Football", query, club: club.name });
    }

    if (action === "sync-squad") {
      const providerTeamId = Number(body?.provider_team_id);
      if (!Number.isInteger(providerTeamId) || providerTeamId <= 0) return json({ error: "ID do clube na API-Football inválido." }, 400);
      const payload = await apiFootball(`players/squads?team=${providerTeamId}`, apiKey);
      const result = (payload?.response || []).find((item: any) => Number(item?.team?.id) === providerTeamId) || payload?.response?.[0];
      if (!result?.team || !Array.isArray(result.players)) return json({ error: "A API não retornou um elenco para esse clube. Confira se selecionou o clube correto." }, 404);
      if (Number(result.team.id) !== providerTeamId) return json({ error: "O ID retornado não corresponde ao clube escolhido." }, 409);

      const players = result.players.filter((player: any) => player?.id && player?.name);
      if (!players.length) return json({ error: "O provedor não retornou jogadores para este clube." }, 404);
      const syncedAt = new Date().toISOString();
      const playerRows = players.map((player: any) => ({
        full_name: String(player.name).trim(),
        display_name: String(player.name).trim(),
        nationality: player.nationality ? String(player.nationality) : null,
        age_at_import: Number.isInteger(Number(player.age)) ? Number(player.age) : null,
        avatar_style: "generic",
        external_provider: "api-football",
        external_player_id: String(player.id),
        updated_at: syncedAt,
      }));
      const { data: savedPlayers, error: playerError } = await service
        .from("game_players")
        .upsert(playerRows, { onConflict: "external_provider,external_player_id" })
        .select("id,external_player_id");
      if (playerError) throw playerError;
      const playerIdByExternal = new Map((savedPlayers || []).map((player: any) => [String(player.external_player_id), player.id]));
      const rosterRows = players.map((player: any) => {
        const position = positionDetails(player.position);
        return {
          club_id: club.id,
          player_id: playerIdByExternal.get(String(player.id)),
          season_label: club.country_code === "BR" ? "2026" : "2026/27",
          shirt_number: Number.isInteger(Number(player.number)) && Number(player.number) >= 1 && Number(player.number) <= 99 ? Number(player.number) : null,
          position_code: position.code,
          position_label: position.label,
          overall: null,
          attributes: {},
          roster_status: "active",
          external_provider: "api-football",
          external_roster_id: String(player.id),
          last_verified_at: syncedAt,
        };
      }).filter((row: any) => Boolean(row.player_id));
      const { data: savedRoster, error: rosterError } = await service
        .from("game_roster_entries")
        .upsert(rosterRows, { onConflict: "club_id,player_id,season_label" })
        .select("id,player_id");
      if (rosterError) throw rosterError;
      const currentPlayerIds = (savedRoster || []).map((row: any) => row.player_id);
      if (currentPlayerIds.length) {
        const keepList = `(${currentPlayerIds.join(",")})`;
        const { error: inactiveError } = await service
          .from("game_roster_entries")
          .update({ roster_status: "inactive" })
          .eq("club_id", club.id)
          .eq("season_label", club.country_code === "BR" ? "2026" : "2026/27")
          .eq("external_provider", "api-football")
          .not("player_id", "in", keepList);
        if (inactiveError) throw inactiveError;
      }
      const seasonLabel = club.country_code === "BR" ? "2026" : "2026/27";
      const { error: clubUpdateError } = await service.from("game_clubs").update({
        external_provider: "api-football",
        external_club_id: String(providerTeamId),
        last_roster_sync_at: syncedAt,
        updated_at: syncedAt,
      }).eq("id", club.id);
      if (clubUpdateError) throw clubUpdateError;

      return json({
        ok: true,
        club: club.name,
        provider_team_id: providerTeamId,
        season_label: seasonLabel,
        imported_count: savedRoster?.length || 0,
        synced_at: syncedAt,
        note: "Elenco atual consultado. A fonte não fornece atributos FIFA individuais neste endpoint; overall permanece vazio até a calibração própria do jogo.",
      });
    }

    return json({ error: "Ação não reconhecida." }, 400);
  } catch (error) {
    console.error("football-catalog error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno ao consultar a fonte esportiva." }, 500);
  }
});
