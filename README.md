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
