# Roadmap

Planejado de trás para frente: primeiro o destino, depois o que precisa existir antes dele.

## Destino

> Eu no PC e minha esposa no celular (ou no PC dela), cada um no seu aparelho, abrindo um link e jogando juntos. Cada um tem perfil, bolotas com visual próprio comprado com moedas do jogo, conquistas para caçar e um ranking entre amigos que dá vontade de pedir revanche.

## Do destino para trás

| Para ter… | …precisa antes de |
| --- | --- |
| Ranking entre amigos | partidas online com resultado confiável + contas + lista de amigos |
| Loja e cosméticos persistentes | contas (para guardar inventário) + moeda ganha jogando |
| Conquistas que dão itens | motor de conquistas ouvindo os eventos do jogo + inventário |
| Amigos | contas |
| Jogar online em dois aparelhos | simulação determinística + salas com código + jogo publicado numa URL |
| Jogar bem no celular | PWA em tela cheia + controles de toque pensados para o dedo |

Daí a ordem das fases. Cada uma entrega algo jogável sozinha.

## Fases

### Fase 0 — Jogo local ✅
Partida contra CPU ou 2 jogadores no mesmo PC, 7 armas, vento, 4 cenários, toque básico.

### Fase 1 — Fundação
Deixar o código pronto para rede e publicar numa URL.
- Testes de simulação (Vitest) e partida headless no CI.
- Determinismo: partida reproduzível a partir de `seed + lista de comandos`.
- Comandos serializáveis (`{turn, tick, cmd, args}`) — a mesma porta para humano, CPU e rede.
- Replay local (grátis depois do item anterior).
- Deploy estático com HTTPS (Cloudflare Pages ou Vercel).

### Fase 2 — Celular de verdade
- PWA instalável (`manifest`, ícone, `display: fullscreen`, orientação paisagem).
- Botão de tela cheia + bloqueio de orientação quando o navegador permitir.
- Mira por arrastar (estilo estilingue) e pinça para zoom.
- Perfil de aparelho: PC continua exatamente como hoje; celular troca HUD e controles.

### Fase 3 — Multiplayer online (sem conta)
- Criar sala → código curto/link → outra pessoa entra.
- Modelo **lockstep por turno**: só o jogador da vez envia comandos; os dois simulam igual.
- Ao fim de cada turno, o dono do turno manda um checksum do estado; se divergir, manda o estado completo (ressincroniza).
- Reconexão, "o outro saiu", tempo de turno no servidor.

### Fase 4 — Contas, perfil e amigos
- Login (e-mail mágico / Google). Conta convidado que vira conta real depois.
- Perfil: nome, nome do time, avatar da bolota.
- Amigos por código (`#BOLOTA-4821`) ou link de convite; presença online; convidar para sala.

### Fase 5 — Progressão: conquistas, moedas e loja
- Motor de conquistas que escuta `GameEvent` (fácil → lendária).
- Moeda ganha jogando (vitória, conquista, desafio diário). **Sem pay-to-win:** loja só de cosméticos.
- Inventário e "vestir" a bolota: chapéus, cores, lápides, rastro de míssil, explosão, dancinha de vitória.

### Fase 6 — Competição
- Ranking entre amigos (rating tipo Elo/Glicko) + placar de estatísticas (vitórias, dano, precisão).
- Desafio diário: mesmo mapa/vento para todos, placar de amigos.
- Histórico de partidas e "cara a cara" com cada amigo.

### Fase 7 — Conteúdo contínuo
Novas armas, modos (co-op contra chefão, 2x2, missões), editor de mapas. Ver banco de ideias no BACKLOG.

## Decisões técnicas recomendadas

Registro das escolhas e do porquê. Atualize quando mudar.

| # | Decisão | Por quê |
| --- | --- | --- |
| D1 | Multiplayer por **lockstep de comandos por turno**, não por streaming de estado | O jogo é por turnos: só um jogador age por vez, poucos comandos por segundo, pouquíssima banda. A arquitetura atual (comandos no `Match`, `Rng` seedado) já aponta para isso. |
| D2 | **Checksum por turno + ressincronização** em vez de confiar em determinismo perfeito | `Math.sin/cos/exp/hypot` podem diferir entre motores (Chrome/V8 x Safari/JavaScriptCore). Se a esposa jogar no iPhone, isso importa. Somar/multiplicar é idêntico; funções transcendentais, não. Alternativa futura: tabelas próprias de seno ou ponto fixo. |
| D3 | Backend recomendado: **Supabase** (Auth + Postgres + Realtime) | Um serviço cobre contas, amigos, inventário, conquistas, ranking (Postgres com RLS) e salas (Realtime Broadcast + Presence). Plano grátis basta para família e amigos. Alternativa: Cloudflare Durable Objects para as salas, se precisar de servidor autoritativo. |
| D4 | Uma base de código para PC e celular, **PWA** primeiro | Mantém o "jeito web" intacto no PC. Loja de apps (Capacitor) só se fizer falta depois. |
| D5 | Loja **só cosmética**, moeda só ganha jogando, sem dinheiro real por enquanto | Mantém a competição justa no ranking e evita pagamentos, impostos e regras das lojas de apps. |
| D6 | Conquistas, estatísticas e moedas calculadas a partir de `GameEvent` | O barramento de eventos já existe; nada novo precisa entrar no domínio. Online, o servidor valida o resultado para evitar trapaça no ranking. |
