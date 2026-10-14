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
4. Em **Authentication → URL Configuration**, coloque a URL do jogo (ex.: `https://SEU-USUARIO.github.io/worms-ddtank-ai/`) em *Site URL* e *Redirect URLs*.

## 2. Ligar no jogo

Pegue em **Project Settings → API** a *Project URL* e a *anon public key* (são públicas por natureza; a segurança está nas regras RLS das migrações).

- **Local:** copie `.env.example` para `.env` e preencha.
- **GitHub Pages:** em *Settings → Secrets and variables → Actions → Variables*, crie `SUPABASE_URL` e `SUPABASE_ANON_KEY`. O próximo deploy já sai com contas ligadas.

## 3. Testes das regras

As migrações são testadas num Postgres em memória (PGlite) com um stub do `auth` do Supabase: `npm test` roda `test/sql/`.
