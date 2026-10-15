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
- [x] **F5-02** · P0 · M — Moeda "Bolotins": ganha por partida, vitória, conquista e desafio diário. Saldo no servidor.
- [x] **F5-03** · P0 · G — Cosméticos: catálogo + inventário + "vestir". Render lê o visual da bolota em vez de cores fixas.
- [x] **F5-04** · P1 · M — Loja: vitrine rotativa diária, preços em Bolotins, prévia da bolota vestida.
- [x] **F5-05** · P2 · M — Baús de conquista (recompensa garantida, sem caixa de sorte paga).

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

- [x] **F6-01** · P0 · M — Rating entre amigos (Glicko-2 ou Elo simples) calculado no servidor ao fim de partida online.
- [x] **F6-02** · P0 · M — Ranking de amigos: geral, semanal e cara a cara (histórico contra cada amigo).
- [x] **F6-03** · P1 · M — Desafio diário: mesma seed para todos, placar de amigos (dano, turnos, precisão).
- [x] **F6-04** · P1 · P — Estatísticas: vitórias, dano total, precisão, arma favorita, maior tiro.
- [x] **F6-05** · P2 · M — Temporadas mensais com cosmético exclusivo para o top do grupo.

## Fase 7 — Conteúdo

- [x] **F7-01** · P1 · M — Caixas que caem do céu entre turnos (arma, vida, utilitário).
- [x] **F7-02** · P1 · M — Morte súbita: a água sobe após N turnos.
- [x] **F7-03** · P1 · G — Co-op contra chefão (estilo DDTank): vocês dois contra um monstro grande com padrões de ataque.
- [x] **F7-04** · P1 · M — Objetos no mapa: barris explosivos, minas, plataformas de metal indestrutíveis.
- [x] **F7-05** · P2 · G — Editor de mapas (desenhar terreno com o dedo/mouse) e compartilhar com amigos.
- [x] **F7-06** · P2 · M — Música dinâmica (calma na mira, tensa nos últimos 5 s).
- [x] **F7-07** · P1 · M — Corda ninja e paraquedas (utilitários que não gastam a vez). *(promovido do banco de ideias)*
- [x] **F7-08** · P1 · G — Missões/quebra-cabeças com estrelas: alvos parados, armas limitadas, vento fixo. *(promovido do banco de ideias)* — 8 missões em `domain/missions.ts` (mapas por código), time `dummy` que nunca joga, derrota quando acaba a munição de ataque; estrelas por tiros.
- [x] **F7-09** · P1 · M — Melhor lance da partida em câmera lenta + gravar vídeo para mandar no WhatsApp. *(promovido do banco de ideias)* — `domain/highlight.ts` fotografa o estado a cada vez e guarda a de mais estrago; replay só daquela vez (mira 3×, voo 0,4×), gravado com `MediaRecorder` (H.264 quando dá) e enviado pelo menu de compartilhar do celular.

---

## Fase 9 — Polimento e gameplay

> Foco no PC. Um commit e push na `main` por item, na ordem.

- [x] **F9-01** · P0 · M — Tutorial interativo de ~2 min: andar, mirar, força, vento, trocar arma, acertar o boneco. Oferecido na primeira vez; sempre acessível no menu. — 3 lições (`domain/tutorial.ts`), +50 🪙 na primeira vez.
- [x] **F9-02** · P0 · P — Prévia do raio de explosão na mira (círculo no fim da trajetória curta, só na vez do humano). — anel do raio real em volta da mira e 0,4 s de trajetória enquanto carrega (`Match.previewShot`, mesma física do tiro).
- [x] **F9-03** · P0 · P — Setinha na borda da tela apontando bolotas fora da câmera (cor do time, distância).
- [x] **F9-04** · P1 · M — Sensação dos golpes: pausa de impacto, rastro de quem é arremessado, falas engraçadas ao levar dano/eliminar. — falas em `render/quips.ts` (catálogo).
- [x] **F9-05** · P1 · M — Configurações: volume de música e efeitos, tempo de turno, velocidade da CPU, tremida de tela, paleta para daltonismo.
- [x] **F9-06** · P1 · G — Itens de turno estilo DDTank (+50% dano, tiro duplo, escudo), gastos sem passar a vez. — `domain/items.ts`; 1 de cada por partida; CPU usa; protocolo v3.
- [x] **F9-07** · P1 · M — Ovelha andante e bomba banana. — ovelha anda pela `stepProjectile` (sobe degrau, pula parede, detona com Espaço); banana com 5 fragmentos.
- [x] **F9-08** · P1 · M — Modo 2x2 (local, contra CPU e online). — 4 times em 2 lados, vez alternada; online cada aparelho controla uma dupla (`guestTeams`).
- [x] **F9-09** · P2 · M — Míssil teleguiado e taco de beisebol. — teleguiado: clique marca, curva depois de 0,45 s (`stepProjectile`); taco: modo `melee`.
- [x] **F9-10** · P2 · M — Viga: construir pontes e muros. — metal indestrutível, ângulo pela mira, prévia verde/vermelha; encerra a vez.
- [x] **F9-11** · P2 · G — Modo rei da colina. — topo do meio do mapa; lado sozinho na colina ao fim da vez marca 1; 6 pontos vence. Local e online.
- [x] **F9-12** · P2 · M — Balanceamento por simulação: CPU x CPU em massa por arma, relatório e ajustes. — `npm run balance` → `docs/balanceamento.md`.

## Fase 10 — Skins e polimento visual

> Cosmético nunca muda a regra. A bolota mantém a cor do time (para reconhecer o lado); a skin acrescenta o bicho.

- [x] **F10-01** · P1 · M — Bichos: hamster e gato (orelhas, focinho, bigodes/bochechas, rabo). Encaixe novo "Bicho" na loja e no Visual.
- [ ] **F10-07** · P0 · G — Render na GPU (PixiJS): camadas novas (céu, paralaxe, terreno, efeitos) na GPU; o desenho atual vira uma camada por cima até ser trocado. Escolha nos Ajustes (Clássico / Novo).
- [ ] **F10-08** · P0 · G — Efeitos estilo Worms W.M.D./anime por código: fogo, fumaça em camadas, brasas, destroços, onda de choque, quadro de impacto, linhas de velocidade, brilho aditivo.
- [ ] **F10-09** · P1 · G — Terreno e céu "pintados": textura e luz no terreno, grama caindo pela borda, paralaxe com perspectiva de ar, partículas no ar (folhas, poeira).
- [ ] **F10-10** · P1 · G — Bolota com esqueleto (peças + animação: parado, andar, pular, apanhar, comemorar); skins trocam peças. **v1 feita**: rosto anime com humores (mirar, carregar, apanhar, cair, preocupado, comemorar), estica-e-achata, sombreado cel, faixa de anime, arma atrás do corpo. Gato virou personagem inteiro (cabeçona, corpo, 4 patas, rabo e orelhas que mostram o humor, coleira com sininho) e o hamster também (bochechas que enchem ao carregar o tiro, dentões, focinho que fareja, patinhas rosas). Falta: esqueleto de verdade com peças trocáveis.
- [ ] **F10-02** · P2 · M — Mais bichos: cachorro, coelho, panda, sapo, pinguim.
- [ ] **F10-03** · P2 · M — Prévia giratória na loja e no Visual (bolota andando, pulando e comemorando com o item).
- [ ] **F10-04** · P2 · M — Polimento do menu: fundo animado mais rico, transições entre telas, botões com som e "pop".
- [ ] **F10-05** · P2 · M — Explosões e água mais bonitas (fumaça em camadas, onda na água, respingo com espuma).
- [ ] **F10-06** · P2 · P — Expressões: bolota sorri ao acertar, fica brava ao errar, chora ao perder muita vida.

## Fase 11 — Administração

- [x] **F11-01** · P1 · M — Painel de admin com feature flags: ligar/desligar armas, modos e itens para todo mundo. Só o dono acessa.

## Fase 8 — Celular de verdade (futuro)

> Foco atual é o PC (ROADMAP D14). Nada aqui começa antes de o PC estar redondo.

- [ ] **F8-01** · P1 · P — Levantar os bugs do celular na V1 (aparelho, navegador, o que acontece), com print ou vídeo.
- [ ] **F8-02** · P1 · M — Protótipo para decidir: web consertada x Capacitor x motor nativo (Godot/Unity). Critério principal: dá para jogar online contra o PC sem duas físicas diferentes?
- [ ] **F8-03** · P2 · G — Implementar o caminho escolhido.

## Banco de ideias

Ideias soltas para avaliar. Promova para uma fase quando fizer sentido.

**Armas e utilitários**
- Soco de fogo; item "voo".

**Modos**
- Forte: cada time constrói sua base antes de começar.
- Capturar a bandeira.
- Treino com prévia da trajetória.

**Social e diversão**
- Espectador: amigos assistem à partida ao vivo.
- Bolotas com nomes dados pelos jogadores.
