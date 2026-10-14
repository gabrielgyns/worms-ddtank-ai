# Backlog

Itens concretos, agrupados pelas fases do [ROADMAP](ROADMAP.md).

**Prioridade:** P0 = bloqueia a fase · P1 = importante · P2 = desejável
**Tamanho:** P (horas) · M (1–2 dias) · G (vários dias)
**Status:** `[ ]` a fazer · `[~]` em andamento · `[x]` feito

---

## Fase 1 — Fundação

- [x] **F1-01** · P0 · P — Deploy estático com HTTPS (Cloudflare Pages ou Vercel) a cada push na `main`.
- [x] **F1-02** · P0 · M — Vitest + testes do domínio: terreno (escavar, normal), física (queda, dano), armas, fim de partida. Inclui o teste "N partidas CPU x CPU terminam sem travar".
- [x] **F1-03** · P0 · M — Comandos serializáveis: `Command = {turn, tick, type, args}`; `Match.apply(cmd)` como única porta. Humano e CPU passam a gerar comandos.
- [x] **F1-04** · P0 · M — Determinismo: tirar `Math.random()` de qualquer regra; `checksum()` do estado (terreno + bolotas + projéteis + vento). Teste: mesma seed + mesmos comandos ⇒ mesmo checksum.
- [x] **F1-05** · P1 · P — `Match.snapshot()` / `Match.restore()` (estado completo, terreno comprimido) para ressincronizar e salvar partida.
- [x] **F1-06** · P1 · M — Replay local: gravar comandos e reassistir; botão "ver jogada de novo" no fim da partida.
- [x] **F1-07** · P2 · P — CI no GitHub Actions: typecheck + testes + build.

## Fase 2 — Celular

- [x] **F2-01** · P0 · P — PWA: `manifest.webmanifest`, ícones, `display: fullscreen`, `orientation: landscape`, service worker para jogar offline.
- [x] **F2-02** · P0 · P — Botão de tela cheia (Fullscreen API + `screen.orientation.lock`) e aviso "gire o celular" em retrato.
- [x] **F2-03** · P0 · M — Mira por arrastar: arrasta a partir da bolota, direção = ângulo, distância = força (opcional, mantém os botões).
- [x] **F2-04** · P1 · P — Pinça para zoom e dois dedos para mover a câmera.
- [x] **F2-05** · P1 · P — Perfil de aparelho (`pointer: coarse` + tamanho): HUD compacto, botões maiores, vibração (`navigator.vibrate`) em explosões.
- [x] **F2-06** · P1 · P — Desempenho em celular fraco: limitar partículas, DPR máx. 1,5, pausar fundo quando parado.
- [x] **F2-07** · P2 · M — App nas lojas via Capacitor (só se o PWA não bastar).

## Fase 3 — Multiplayer online

- [x] **F3-01** · P0 · M — Salas: criar sala → código de 4 letras + link `…/#sala-ABCD`; entrar pelo código.
- [x] **F3-02** · P0 · G — Transporte (Supabase Realtime Broadcast) + protocolo: `join`, `start{seed, setup}`, `cmd`, `turnEnd{checksum}`, `resync{snapshot}`.
- [x] **F3-03** · P0 · M — Lockstep por turno: só o dono do turno envia comandos; o outro aplica com pequeno atraso de buffer (~100 ms) para ficar suave.
- [x] **F3-04** · P0 · M — Checksum no fim do turno; se divergir, o dono do turno manda `resync`.
- [x] **F3-05** · P1 · M — Reconexão (voltar para a mesma sala), "aguardando oponente", abandono = derrota após 60 s.
- [x] **F3-06** · P1 · P — Lobby da sala: escolher time/cor, cenário, bolotas por time, botão "pronto".
- [x] **F3-07** · P1 · P — Emotes e frases rápidas ("Boa!", "Ops…", "Revanche?") com balão sobre a bolota.
- [x] **F3-08** · P2 · G — Turno assíncrono (estilo "Words with Friends"): joga sua vez quando puder, recebe aviso quando for sua vez.

## Fase 4 — Contas e amigos

- [x] **F4-01** · P0 · M — Supabase Auth: link mágico por e-mail + Google; conta convidado com upgrade.
- [x] **F4-02** · P0 · M — Tabelas: `profiles`, `friendships`, `matches`, `match_players` com RLS.
- [x] **F4-03** · P0 · M — Amigos: código pessoal `#BOLOTA-4821`, link de convite, aceitar/recusar, remover.
- [x] **F4-04** · P1 · P — Presença (online / em partida) e "convidar para sala".
- [x] **F4-05** · P1 · P — Perfil: nome, nome do time, bolota favorita, estatísticas básicas.

## Fase 5 — Conquistas, moedas e loja

- [x] **F5-01** · P0 · M — Motor de conquistas: catálogo declarativo (`id, nome, descrição, raridade, condição, recompensa`) avaliado sobre `GameEvent` e estatísticas acumuladas. Funciona offline (localStorage) e sincroniza com a conta.
- [ ] **F5-02** · P0 · M — Moeda "Bolotins": ganha por partida, vitória, conquista e desafio diário. Saldo no servidor.
- [ ] **F5-03** · P0 · G — Cosméticos: catálogo + inventário + "vestir". Render lê o visual da bolota em vez de cores fixas.
- [ ] **F5-04** · P1 · M — Loja: vitrine rotativa diária, preços em Bolotins, prévia da bolota vestida.
- [ ] **F5-05** · P2 · M — Baús de conquista (recompensa garantida, sem caixa de sorte paga).

### Primeiras conquistas sugeridas

| Raridade | Nome | Condição | Recompensa |
| --- | --- | --- | --- |
| Fácil | Primeiro Bum | Causar dano pela primeira vez | 50 Bolotins |
| Fácil | Banho Frio | Derrubar um inimigo na água | Chapéu de boia |
| Fácil | Ninguém Viu | Acertar a si mesmo | Lápide "Ops" |
| Média | Atirador de Elite | Acertar a mais de 1200 px | Mira dourada |
| Média | Contra o Vento | Acertar com vento 8+ contra | Rastro de folhas |
| Média | Dois Coelhos | Atingir 2 inimigos com um tiro | 200 Bolotins |
| Difícil | Strike! | Eliminar 3 bolotas com um tiro | Explosão de confete |
| Difícil | Intocável | Vencer sem perder nenhuma bolota | Coroa |
| Difícil | Granadeiro | Vencer usando só granadas | Granada de abacaxi (visual) |
| Lendária | Davi e Golias | Vencer 1 bolota contra 4 | Título "Lenda" |
| Lendária | Sem Ar | Vencer no Difícil sem a CPU acertar você | Bolota dourada |

### Ideias de cosméticos

Chapéus (pirata, chef, coroa, cartola), cores e padrões de corpo, olhos (óculos escuros, monóculo), lápides, rastro de projétil, cor e formato da explosão, texto de impacto ("BUM!" → "SPLASH!"), dancinha de vitória, pacote de vozes ("Aiii!"), bandeira do time.

## Fase 6 — Competição

- [ ] **F6-01** · P0 · M — Rating entre amigos (Glicko-2 ou Elo simples) calculado no servidor ao fim de partida online.
- [ ] **F6-02** · P0 · M — Ranking de amigos: geral, semanal e cara a cara (histórico contra cada amigo).
- [ ] **F6-03** · P1 · M — Desafio diário: mesma seed para todos, placar de amigos (dano, turnos, precisão).
- [ ] **F6-04** · P1 · P — Estatísticas: vitórias, dano total, precisão, arma favorita, maior tiro.
- [ ] **F6-05** · P2 · M — Temporadas mensais com cosmético exclusivo para o top do grupo.

## Fase 7 — Conteúdo

- [ ] **F7-01** · P1 · M — Caixas que caem do céu entre turnos (arma, vida, utilitário).
- [ ] **F7-02** · P1 · M — Morte súbita: a água sobe após N turnos.
- [ ] **F7-03** · P1 · G — Co-op contra chefão (estilo DDTank): vocês dois contra um monstro grande com padrões de ataque.
- [ ] **F7-04** · P1 · M — Objetos no mapa: barris explosivos, minas, plataformas de metal indestrutíveis.
- [ ] **F7-05** · P2 · G — Editor de mapas (desenhar terreno com o dedo/mouse) e compartilhar com amigos.
- [ ] **F7-06** · P2 · M — Música dinâmica (calma na mira, tensa nos últimos 5 s).

---

## Banco de ideias

Ideias soltas para avaliar. Promova para uma fase quando fizer sentido.

**Armas e utilitários**
- Ovelha andante, bomba banana, míssil teleguiado, taco de beisebol, soco de fogo.
- Corda ninja e paraquedas (mobilidade é o que deixa o Worms profundo).
- Viga para construir pontes e muros.
- Itens estilo DDTank, gastos no turno: "+50% dano", "tiro duplo", "voo", "escudo".

**Modos**
- Missões/quebra-cabeças: "derrube as 3 bolotas com vento 10 usando 2 tiros". Bom para ensinar e para conquistas.
- 2x2 (casal contra casal de amigos).
- Forte: cada time constrói sua base antes de começar.
- Rei da colina, capturar a bandeira.
- Treino com prévia da trajetória.

**Social e diversão**
- Câmera lenta no tiro final + replay automático do melhor lance da partida.
- Gerar GIF/vídeo do lance para mandar no WhatsApp.
- Espectador: amigos assistem à partida ao vivo.
- Bolotas com nomes dados pelos jogadores, falas engraçadas ao levar dano.

**Qualidade de vida**
- Pré-visualização do raio de explosão na mira.
- Indicador fora da tela apontando inimigos.
- Tutorial interativo de 2 minutos.
- Configurações: velocidade da CPU, tempo de turno, volume separado de música e efeitos.
- Acessibilidade: paleta para daltonismo nos times, reduzir tremida de tela.
