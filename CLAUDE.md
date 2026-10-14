# CLAUDE.md

Guia para quem (humano ou agente) for mexer neste repositório.

**Bolotas em Guerra**: jogo de artilharia por turnos no estilo Worms Armageddon com a pegada do DDTank. TypeScript + Vite + Canvas 2D, sem framework, sem assets externos (arte procedural, sons sintetizados).

## Leia antes de começar

| Arquivo | Para quê |
| --- | --- |
| [ROADMAP.md](ROADMAP.md) | Objetivo final, fases e a ordem delas (de trás para frente) |
| [BACKLOG.md](BACKLOG.md) | Itens concretos por fase, com prioridade e tamanho. Banco de ideias no fim |
| [README.md](README.md) | Como rodar, controles, arsenal |

Antes de implementar algo, ache o item no BACKLOG. Ao terminar, marque como feito e anote decisões relevantes na seção "Decisões" do ROADMAP.

## Comandos

```bash
npm install
npm run dev        # servidor local (Vite)
npm run typecheck  # tsc --noEmit — tem que passar sempre
npm run build      # typecheck + dist/index.html em arquivo único
npm test           # Vitest: testes do domínio em test/ (inclui partidas CPU x CPU completas)
```

Mudou regra de jogo? Rode `npm test` e confira no navegador.

## Arquitetura

Modelagem por domínio primeiro. A regra mais importante: **o domínio não sabe desenhar e a render não muda o estado.**

```
src/
  domain/    regras puras, sem DOM
    terrain.ts   máscara de bits destrutível (Uint8Array); avisa ouvintes ao escavar
    physics.ts   bolota andando/caindo, voo de projétil, dano de explosão
    weapons.ts   catálogo de armas (dados: dano, raio, pavio, vento, fragmentos)
    match.ts     a partida: turnos, fases, comandos, eventos (GameEvent)
    ai.ts        CPU: simula tiros com a MESMA stepProjectile do jogo
    unit.ts      Unit (bolota) e Team
    theme.ts     paletas dos cenários (só dados)
  render/    desenho em Canvas; só lê o estado
  ui/        HUD e controles de toque em DOM
  core/      math (Rng seedado), input, áudio
  game.ts    cola tudo: loop de passo fixo 60 Hz, controladores, câmera, som
  main.ts    menus, telas, partida demo atrás do menu
```

### Regras que não podem quebrar

1. **`src/domain` não importa nada de `render/`, `ui/`, `core/audio` ou DOM.** Precisa rodar no Node (testes, servidor, simulação da IA).
2. **Estado muda só por comandos do `Match`** (`walk`, `aimBy`, `startCharge`, `releaseCharge`, `fireAt`, `selectWeapon`, `jump`). Humano, CPU e, no futuro, a rede usam a mesma porta de entrada.
3. **Efeitos colaterais saem por eventos** (`match.on(...)`): som, partículas, banners, e no futuro conquistas e estatísticas. Não chame som ou efeito de dentro do domínio.
4. **Aleatoriedade de regra usa `match.rng`** (seedado), nunca `Math.random()`. `Math.random()` só em coisa cosmética (partículas, piscar de olho). Isso é a base do multiplayer.
5. **Passo fixo de 1/60 s.** Não use o `dt` real do frame na simulação.
6. **A IA usa a física do jogo.** Se mudar `stepProjectile`, a IA se ajusta sozinha; não duplique física.

### Convenções

- Textos de interface e comentários em **português do Brasil**; identificadores de código em inglês.
- Estilo: TypeScript estrito, sem `any`. Comente o porquê, não o quê.
- Dados de conteúdo (armas, temas, futuros cosméticos e conquistas) são **catálogos declarativos**, não lógica espalhada.
- Visual: cartoon vetorial com contorno grosso (`INK = #2a1a12`), fonte de título Lilita One, corpo Nunito. Tudo desenhado por código.

## Deploy

Hoje: `npm run build` gera `dist/index.html` autocontido. Hospedagem pública está no BACKLOG (`F1-01`).
