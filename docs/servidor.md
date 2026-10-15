# Servidor de contas (Supabase)

Sem servidor o jogo funciona inteiro **neste aparelho**: CPU, 2 jogadores no mesmo PC, online por sala (P2P), partida por link, conquistas, moedas e loja locais.

O servidor liga o que precisa ser compartilhado: **contas, amigos, quem está online, convites, ranking entre amigos e progresso salvo em qualquer aparelho**.

## 1. Criar o projeto

1. Crie um projeto grátis em <https://supabase.com>.
2. Em **SQL Editor**, rode os arquivos de `supabase/migrations/` em ordem (ou use a CLI: `supabase db push`).
3. Em **Authentication → Providers**:
   - **Email**: ligado (link mágico).
   - **Anonymous sign-ins**: ligado (conta convidado).
   - **Google** (opcional): siga o guia do Supabase para criar o client OAuth.
4. Em **Authentication → URL Configuration**, coloque a URL do jogo (`https://worms-ddtank-ai.vercel.app`) em *Site URL* e *Redirect URLs*; para as prévias da Vercel, acrescente também `https://worms-ddtank-*-gabriel-silva-soares-projects.vercel.app/**`.

## 2. Ligar no jogo

Pegue em **Project Settings → API** a *Project URL* e a *anon public key* (são públicas por natureza; a segurança está nas regras RLS das migrações).

- **Local:** copie `.env.example` para `.env` e preencha.
- **Vercel:** em *Settings → Environment Variables*, crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Production e Preview) e faça **Redeploy**: as variáveis entram no build.

## Contas criadas antes das migrações

O perfil nasce por gatilho no cadastro. Se alguém se cadastrou antes de as migrações rodarem, a migração 9 (`backfill_profiles()`) cria o que falta; pode rodar `select public.backfill_profiles();` de novo quando quiser.

## 3. Testes das regras

As migrações são testadas num Postgres em memória (PGlite) com um stub do `auth` do Supabase: `npm test` roda `test/sql/`.
