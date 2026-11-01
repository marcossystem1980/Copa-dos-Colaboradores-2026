# Copa dos Colaboradores 2026 — Grupo Zanol & Thomaz

Aplicação estática HTML, CSS e JavaScript conectada ao Supabase (Auth anônimo + PIN, Postgres com RLS, Storage privado e Realtime).

## Como funciona o acesso

A tela de entrada mostra somente duas opções — **ADM** ou **TORCEDOR** — e um campo de senha. Não existe e-mail visível para os participantes:

- **ADM:** pode inscrever jogadores, carregar fotos, criar times, executar/refazer sorteio, registrar placares, importar/exportar backup e alterar a identidade.
- **TORCEDOR:** pode acompanhar o painel, os elencos, confrontos, classificação e resultados. Não pode alterar os dados.

As duas senhas simples informadas para o evento são configuradas pelo SQL inicial e não aparecem no HTML ou JavaScript.

Os PINs não estão no HTML nem no JavaScript. O SQL cadastra apenas hashes no schema privado do banco. O Supabase cria uma sessão anônima e a função `copa_login` valida o PIN no servidor e associa a sessão ao papel correspondente. A senha `123` é intencionalmente curta e deve ser tratada como uma senha simples de evento, não como proteção para informações confidenciais. O SQL também limita cinco tentativas incorretas por IP/sessão por dez minutos.

## 1. Criar e configurar o projeto Supabase

1. Abra o Supabase e crie um projeto (ou use o projeto que já criou para a Copa).
2. No Dashboard, entre em **Authentication → Sign In / Providers → Anonymous Sign-Ins** e habilite **Allow anonymous sign-ins**. O login por PIN depende desse recurso.
3. Abra **SQL Editor → New query**.
4. Abra o arquivo local `SUPABASE_SETUP.sql`, copie todo o conteúdo, cole no SQL Editor e clique em **Run**. Ele cria as tabelas, as funções de acesso, as políticas RLS, o bucket privado `copa-fotos` e a publicação Realtime.
5. A consulta final deverá mostrar dois papéis: `admin` e `torcedor`.
6. **Não publique `SUPABASE_SETUP.sql` no GitHub.** Ele contém os PINs iniciais usados para gerar os hashes no banco. O `.gitignore` deste pacote já impede que esse arquivo seja incluído no `git add .`.

> Não crie usuários de e-mail e não desative confirmações de e-mail. Esta versão usa usuários anônimos do Supabase e os PINs são validados pela função SQL.

## 2. Informar a URL e a chave pública

No Dashboard do Supabase, abra **Project Settings → API** (ou **API Keys**, conforme a interface) e copie:

- **Project URL**;
- **Publishable key** (ou a antiga `anon` / `public` key).

Abra `supabase-config.js` e substitua os dois valores:

```js
window.COPA_SUPABASE_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  publishableKey: "SUA_CHAVE_PUBLICA",
  bucket: "copa-fotos"
};
```

A chave publicável/anon é apropriada para uso no navegador quando as tabelas e os arquivos estão protegidos com RLS. **Nunca** coloque no site `service_role`, `secret key`, senha do banco ou qualquer chave privada. A chave publicável não é uma senha administrativa.

## 3. Testar antes de publicar

1. Abra `index.html` pelo Live Server do VS Code (recomendado; não use o endereço `file://`).
2. Entre em **ADM** com `102030`.
3. Na primeira entrada, se o banco ainda estiver vazio, o site envia para o Supabase os dados locais antigos deste navegador, incluindo as fotos. Isso é feito apenas se ainda não existir um registro da Copa no banco.
4. Cadastre/ajuste um participante e uma foto, ou altere o nome de um time. Aguarde a confirmação de sincronização e atualize a página.
5. Abra o site em uma janela anônima ou outro navegador e entre em **TORCEDOR** com `123`. Os dados devem aparecer, e os campos para alteração/placar ficam ocultos.
6. Faça uma alteração de teste como ADM. Os navegadores conectados recebem atualizações pelo Realtime; se ele não estiver habilitado no plano/projeto, os dados também serão carregados ao entrar/recarregar.

## 4. Publicar no GitHub / Vercel

Envie para a raiz do repositório os arquivos `index.html`, `style.css`, `script.js`, `supabase-config.js`, `README.md`, `.gitignore` e a pasta `assets/`. **Não envie `SUPABASE_SETUP.sql` ao GitHub**; ele deve ficar apenas na sua pasta local e ser usado no SQL Editor do Supabase. No Vercel, mantenha **Root Directory vazio**, **Framework Preset: Other** e sem comando de build.

```powershell
git add .
git commit -m "Conecta Copa dos Colaboradores ao Supabase"
git push
```

## Banco e sincronização

- `public.copa_state` guarda todo o estado do campeonato em um registro JSONB. O ADM pode inserir/atualizar; qualquer sessão com PIN aprovado pode ler.
- `public.copa_profiles` associa a sessão anônima ao papel ADM ou Torcedor. A função de login é a única rotina autorizada a criar/alterar esse papel.
- `private.copa_access_codes` guarda somente hashes bcrypt dos PINs. O schema `private` não é exposto pela API.
- `storage.copa-fotos` é um bucket privado. Fotos dos jogadores e escudos são comprimidos em WebP e enviados para o Storage. O site cria URLs assinadas temporárias para visualizá-las.
- RLS protege o banco e o Storage: o torcedor só consulta; o ADM administra.
- Realtime propaga alterações da Copa entre navegadores conectados.

## Backup e migração dos dados locais

- Na primeira autenticação como ADM, se não houver ainda um estado remoto, a aplicação migra os dados existentes no `localStorage` daquele navegador para o Supabase e envia fotos antigas em data URL ao bucket privado.
- Depois da migração, o Supabase passa a ser a fonte central. Todos os computadores veem a mesma Copa após autenticação.
- O backup JSON exporta os dados e referências de fotos do projeto Supabase; as imagens ficam no bucket privado e não são incorporadas ao arquivo JSON. Mantenha o projeto Supabase e o bucket junto do backup.
- Faça um backup antes de refazer sorteios ou reiniciar o campeonato.

## Arquivos

```text
Copa-dos-Colaboradores-2026/
├── index.html
├── style.css
├── script.js
├── supabase-config.js
├── SUPABASE_SETUP.sql
├── README.md
└── assets/img/
    ├── estadio-background.jpg
    ├── logo-empresa-branco.png
    └── logo-empresa-original.png
```

## Observações de segurança

Os PINs são uma barreira simples para um evento interno, não um sistema de autenticação corporativa de alta segurança. Não use este esquema para documentos ou dados sensíveis. As permissões reais continuam aplicadas no Postgres e no Storage por RLS. Para um portal corporativo permanente, substitua os PINs por contas individuais e senhas fortes.

O Supabase cria uma identidade anônima por navegador/dispositivo. A sessão persiste nesse navegador, mas não pode ser recuperada depois de sair, limpar os dados do navegador ou mudar de dispositivo; nesses casos, o usuário entra novamente com o PIN e recebe uma nova identidade. O Supabase também recomenda CAPTCHA/Turnstile para limitar abuso na criação pública de sessões anônimas. Consulte a documentação antes de expor o portal amplamente.

## Módulo novo: Jogo Online — Modo Clubes

Foi adicionada a página `jogo-online.html`, acessível pelo menu lateral **Jogo Online**. Ela apresenta o catálogo inicial de 12 clubes em uma tela separada da Copa corporativa:

- **Brasil / Brasileirão Série A 2026:** Flamengo, Palmeiras, Corinthians, São Paulo, Grêmio e Atlético Mineiro. A seleção foi conferida na lista de participantes publicada pela CBF.
- **Europa / seleção 2026/27:** Real Madrid, Barcelona, Manchester City, Liverpool, Bayern de Munique e Paris Saint-Germain.
- Os escudos nesta primeira tela são marcas tipográficas originais com as iniciais dos clubes e cores de referência; não reproduzem os escudos oficiais.
- Os cards de atletas são avatares genéricos de prévia. **Nenhum jogador fictício é gravado no banco.** A tabela de elencos está preparada, mas começa vazia até integrar uma fonte de dados e confirmar os direitos de uso.
- A escolha de clube pode ser salva no perfil Supabase do usuário autenticado. O campo de escalação é preparado para formação 3–1 e será preenchido após a importação dos elencos.

### Instalar o catálogo no Supabase

1. Execute primeiro `SUPABASE_SETUP.sql` (caso ainda não tenha executado).
2. No Supabase, abra **SQL Editor → New query**.
3. Copie o conteúdo de `SUPABASE_JOGO_ONLINE_CATALOGO.sql` e clique em **Run**.
4. A consulta final deve listar 2 grupos de catálogo e 12 clubes.
5. Abra o site, entre com ADM ou Torcedor e clique em **Jogo Online**. A página consulta as tabelas pelo mesmo `supabase-config.js` e sessão do portal.

**Não publique `SUPABASE_JOGO_ONLINE_CATALOGO.sql` no GitHub.** O `.gitignore` já o exclui; ele deve ser usado somente no SQL Editor. A migração cria tabelas com RLS: ADM pode manter o catálogo e os elencos; cada usuário autenticado pode salvar e consultar suas próprias escalações.

### Estrutura do módulo

- `game_catalog_groups`: grupos Brasil e Europa, com a temporada correspondente.
- `game_clubs`: clubes, país, cidade, liga, cores e identidade gráfica própria.
- `game_players`: cadastro canônico dos atletas e referência de avatar.
- `game_roster_entries`: vínculo do atleta a clube e temporada, número, posição, nota e atributos.
- `game_user_squads`: clubes/escalações escolhidos por cada usuário.
- `game_user_squad_players`: jogadores associados a uma escalação, posição no campo e condição de titular/reserva.

### Próxima integração de elencos

A próxima fase deve importar os elencos reais por temporada usando uma API de futebol, com a chave guardada no servidor (por exemplo, Supabase Edge Function), nunca no JavaScript público. A API-Football documenta o endpoint `players/squads`; o Sportmonks documenta endpoints de elencos por clube e temporada. Antes de exibir fotos, escudos oficiais ou dados proprietários, confirmar as licenças de uso.

### Arquivos do Jogo Online

```text
jogo-online.html
jogo-online.css
jogo-online.js
SUPABASE_JOGO_ONLINE_CATALOGO.sql  # manter local; executar no SQL Editor
```

## Atualização: importação de elencos e montagem da escalação

Esta versão acrescenta a tela para consultar elencos atuais e montar uma escalação pessoal com 4 titulares (1 goleiro + 3 jogadores de linha) e até 2 reservas. As formações disponíveis no protótipo são `2–1` e `1–2`. A validação de slots também é feita no navegador; a próxima etapa do servidor do jogo deverá reforçar todas as regras no backend.

### Fonte de dados: API-Football

A integração usa o endpoint `players/squads` da API-Football para consultar o elenco atual do clube. A interface usa o endpoint `teams?search=...` para localizar o ID correto do clube. Os registros importados incluem nome, idade quando fornecida, número da camisa e posição. Os cards usam avatares genéricos; o campo de foto do provedor não é copiado para o banco nesta fase.

**A consulta `players/squads` entrega o elenco atual, não um arquivo histórico de todas as temporadas.** O projeto grava o rótulo de temporada de referência e a data `last_roster_sync_at` para identificar quando os dados foram consultados. A recomendação do provedor é consultar esse endpoint aproximadamente uma vez por semana, então a sincronização é manual, não executada a cada abertura da página.

O endpoint de elencos não fornece atributos completos equivalentes a FIFA/EA Sports. Por isso `overall` permanece nulo e os cards não inventam notas de ritmo, chute, passe, drible, defesa ou físico. Uma futura etapa poderá criar atributos próprios com uma metodologia pública e consistente, usando estatísticas da temporada quando disponíveis.

### 1. Executar a migração de elencos

Depois de executar `SUPABASE_SETUP.sql` e `SUPABASE_JOGO_ONLINE_CATALOGO.sql`, execute `SUPABASE_JOGO_ONLINE_ELENCOS.sql` no Supabase **SQL Editor → New query**. Essa migração adiciona o campo de idade de importação, a data da última sincronização dos clubes e índices de consulta.

Não publique esse arquivo SQL no GitHub; ele está incluído no `.gitignore` e deve ser executado somente no SQL Editor.

### 2. Criar uma chave API-Football

Crie uma conta em https://www.api-football.com/ e gere uma API key. O plano Free publica limite de 100 requisições por dia. A primeira sincronização dos 12 clubes pode usar cerca de 24 chamadas (uma busca de ID e uma importação por clube), desde que não haja tentativas extras. Confira os limites atuais na página oficial de preços antes de ampliar as consultas.

### 3. Guardar a chave no Supabase (nunca no navegador)

No Dashboard do Supabase, abra **Edge Functions → Secrets** e adicione:

- Nome: `API_FOOTBALL_KEY`
- Valor: sua chave privada da API-Football

Não coloque essa chave em `supabase-config.js`, `jogo-online.js`, HTML, GitHub ou Vercel. O navegador chama somente a Edge Function `football-catalog`; ela lê a chave protegida do ambiente do Supabase.

A Edge Function utiliza as variáveis padrão `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` e `SUPABASE_SECRET_KEYS` fornecidas pelo runtime Supabase (lendo a chave `default`). Há compatibilidade de fallback com as variáveis legadas `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. Não é necessário copiar a publishable ou a secret key para o código; a secret permanece exclusivamente no servidor.

### 4. Publicar a Edge Function

A pasta `supabase/` precisa permanecer na raiz do projeto, junto do `index.html` e `supabase-config.js`. A configuração `supabase/config.toml` mantém a verificação JWT ativa para a função.

Com Node.js 20 ou superior (este projeto usa Node 24), abra o terminal do VS Code na raiz do projeto. Para executar a CLI sem instalá-la permanentemente no projeto, use `npx --yes supabase@latest`:

```powershell
npx --yes supabase@latest login
npx --yes supabase@latest link --project-ref udlouujpwpkifipambgz
npx --yes supabase@latest functions deploy football-catalog --use-api
```

O `--use-api` permite que o CLI faça o bundle no serviço remoto, sem exigir Docker local. A função valida a sessão e consulta `copa_get_role()`; somente o papel `admin` pode pesquisar e importar elencos. O acesso não depende de esconder o botão na interface.

### 5. Importar os elencos

1. Entre no portal da Copa com o perfil ADM.
2. Abra **Jogo Online** e selecione um clube.
3. Na ficha do clube, clique em **Localizar clube e importar elenco**.
4. Confira o nome e o país dos resultados da API-Football. Não selecione apenas pelo nome abreviado: confirme que o país e a equipe correspondem ao catálogo.
5. Clique em **Vincular e importar** no resultado correto.
6. Aguarde a confirmação e confira a lista de atletas.
7. Repita para os demais clubes. A atualização é manual; não faça chamadas repetidas sem necessidade para respeitar a cota diária.

### 6. Montar e salvar a escalação

Na área **Elenco e escalação**, selecione 1 goleiro e 3 jogadores de linha como titulares; opcionalmente, escolha até 2 reservas. Selecione a formação `2–1` (equilibrada) ou `1–2` (ofensiva) e clique em **Salvar escalação**. A escalação é gravada em `game_user_squads` e `game_user_squad_players` para o usuário autenticado. Cada usuário salva sua própria escalação.

### Estrutura de arquivos acrescentada

```text
supabase/
├── config.toml
└── functions/
    └── football-catalog/
        └── index.ts
SUPABASE_JOGO_ONLINE_ELENCOS.sql  # executar no SQL Editor; não publicar
jogo-online.html
jogo-online.css
jogo-online.js
```

### Limitações intencionais desta etapa

- Não é ainda uma partida multiplayer; esta entrega trata do catálogo, importação e montagem do elenco.
- As imagens de atletas permanecem genéricas enquanto os direitos de uso não forem verificados.
- O endpoint de elenco não retorna atributos individuais completos de jogo. Não são criadas notas arbitrárias.
- As listas são importadas manualmente por clube, para controlar consumo de API e permitir conferência humana do clube correto.


## Atualização: Jogo Online com Times da Copa

O Jogo Online agora prioriza os **times e participantes já cadastrados na Copa dos Colaboradores**. Não é necessário usar a API-Football para esta modalidade. A integração antiga com clubes reais permanece reservada para uma etapa futura.

### Como funciona

- A página `jogo-online.html` lê o registro `public.copa_state`, que contém os participantes, níveis, caminhos das fotos e times sorteados pela Copa.
- As fotos dos participantes e dos escudos são lidas do bucket privado `copa-fotos` por URLs assinadas temporárias.
- O usuário escolhe um dos times da competição e monta uma escalação simplificada 3+1: goleiro, defesa, meio e ataque, com até dois reservas.
- Cada usuário salva sua própria escalação em `public.game_copa_user_squads`; a escalação não altera o sorteio nem os elencos oficiais da Copa.
- O botão de sala online permanece desativado nesta etapa. O próximo desenvolvimento será o sistema de salas multiplayer e o campo jogável.

### Instalar a migração de escalações

1. Abra **Supabase → SQL Editor → New query**.
2. Execute o conteúdo de `SUPABASE_JOGO_ONLINE_TIMES_COPA.sql`.
3. Atualize `jogo-online.html` pelo Live Server ou no Vercel.
4. Entre primeiro em `index.html` com ADM ou Torcedor e depois abra **Jogo Online**.
5. Os times aparecerão se o ADM já tiver concluído o sorteio e se o estado da Copa tiver sido sincronizado com `public.copa_state`. Use **Atualizar times** após qualquer novo sorteio.

O SQL dessa migração é complementar: não apaga nem modifica participantes, níveis, fotos, times ou resultados existentes. O `.gitignore` impede o envio do arquivo SQL ao GitHub.


## Atualização: partidas contra IA e preparação do multiplayer

A página `jogo-online.html` agora apresenta dois modos de partida:

- **Partida contra IA:** disponível como protótipo jogável local. O usuário precisa ter uma escalação completa e salva em `game_copa_user_squads`. A página `partida.html` carrega o time e a escalação do usuário no Supabase, escolhe outro time da Copa como adversário (ou monta um adversário de prévia se houver apenas um time) e inicia uma partida de 4 atletas por lado, incluindo goleiro.
- **Contra outro jogador:** aparece no menu, mas continua em preparação. O botão explica que o servidor multiplayer autoritativo ainda precisa ser implantado; esta versão não simula uma conexão entre duas pessoas.

### Controles da partida contra IA

- `W`, `A`, `S`, `D`: movimentar o atleta controlado.
- `Q`: trocar o atleta controlado.
- `Espaço`: passe ou tentativa de domínio/roubo quando estiver perto da bola.
- `J`: chute.
- `K`: corrida acelerada enquanto a tecla estiver pressionada.
- Em telas sensíveis ao toque, há direcional e botões de ação na própria página.

A IA possui três dificuldades (Fácil, Normal e Desafio), movimenta o adversário, pressiona o portador da bola e tenta finalizar. A primeira versão usa um motor local Canvas 2D, com partida de 3 ou 5 minutos. É um protótipo de jogabilidade, não uma reprodução do FIFA nem ainda um jogo competitivo validado por servidor.

### Histórico de partidas contra IA

Para gravar os resultados no Supabase, execute `SUPABASE_JOGO_ONLINE_PARTIDAS.sql` em **SQL Editor → New query**. A tabela `game_copa_ai_matches` guarda usuário, times, placar, dificuldade, duração e eventos. RLS permite que cada usuário consulte apenas o próprio histórico. Se a migração ainda não tiver sido executada, a partida continua normalmente, mas o resultado não será gravado no banco.

Os resultados locais contra IA não são autoritativos e não devem alimentar ranking competitivo. O multiplayer futuro usará um servidor Colyseus para validar movimento, bola, gols e placares antes de registrar resultados oficiais.

### Arquivos desta atualização

```text
jogo-online.html
jogo-online.css
jogo-online.js
partida.html
partida.css
partida.js
SUPABASE_JOGO_ONLINE_PARTIDAS.sql  # executar no SQL Editor; manter fora do GitHub
```


## Atualização: Futebol Arena 26 3D integrado à Copa (7x7)

A tela **Jogo Online → Times da Copa** agora trabalha com sete titulares e até cinco reservas por time. A escalação é salva em `game_copa_user_squads.starting_lineup` e `bench_lineup`, mantendo o registro anterior `lineup` para compatibilidade com versões antigas. A formação usada pelo jogo é **2–3–1**.

### Atualizar o banco

1. No Supabase, abra **SQL Editor → New query**.
2. Execute o arquivo `SUPABASE_FUTEBOL_ARENA_7X7.sql` desta versão.
3. A migração preserva RLS e os registros já salvos. Ela corrige também a antiga restrição que permitia somente a formação `3+1` e passa a aceitar `2-3-1`.
4. Volte ao Jogo Online, escolha seu time, monte novamente os sete titulares e salve. Escalações antigas 4x4 são preservadas, mas precisam ser refeitas para a nova versão.

### Como a partida usa os dados

- O jogo consulta a sessão do Supabase e valida o papel pela função `copa_get_role`.
- O time selecionado e os sete titulares vêm de `copa_state` e `game_copa_user_squads`.
- O adversário é formado com jogadores de outro time da Copa; quando não houver sete disponíveis, posições restantes são completadas por atletas genéricos controlados pela IA.
- As cores de uniforme vêm das cores do time cadastrado na Copa.
- A partida 3D ainda é **local contra IA**. O multiplayer com dois jogadores humanos exige uma etapa separada de servidor em tempo real e não é apresentado como já implementado.

### Controles

**Computador:** WASD/setas movimentam; Espaço passa ou troca de jogador; K chuta ou dá carrinho; L faz lançamento; Shift corre; P pausa.

**Celular:** gire para horizontal; analógico virtual à esquerda; CHUTE, PASSE, LOB, CORRER e TROCAR à direita/esquerda. Os controles respondem a toque e pointer events.

### Teste recomendado

1. Entre na Central da Copa com ADM ou Torcedor e abra **Jogo Online**.
2. Selecione um time com pelo menos sete participantes.
3. Defina um jogador em cada vaga: goleiro, dois defensores, três meio-campistas e atacante.
4. Opcionalmente, escolha até cinco reservas e clique em **Salvar escalação 7x7**.
5. Clique em **Jogar no Futebol Arena 3D**, confira os dois times e inicie a partida.
6. Teste no computador e em um celular na horizontal.

Observação: os jogadores 3D são modelos genéricos do motor Futebol Arena. Os nomes e níveis reais aparecem na prévia da escalação; não são aplicados rostos ou modelos 3D individuais das fotos dos colaboradores nesta etapa.
