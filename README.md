# Bolotas em Guerra

Jogo de artilharia por turnos no estilo **Worms Armageddon** com a pegada do **DDTank**: segure para carregar a força, solte para atirar e preste atenção no vento. Roda no navegador do PC e do celular (PWA), sem nenhum asset externo: arte vetorial procedural e sons sintetizados.

## Como rodar

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm test           # testes (Vitest): regras, determinismo, rede, SQL no PGlite
npm run build      # typecheck + dist/index.html (arquivo único, abre direto no navegador)
```

O push na `main` publica no GitHub Pages (`.github/workflows/deploy.yml`). Para isso, uma vez só: **Settings → Pages → Source: GitHub Actions**.

## Modos

- **Contra a CPU** (fácil, normal, difícil) ou **2 no mesmo aparelho**.
- **Online**: crie uma sala, mande o código/link, a outra pessoa entra (WebRTC, sem servidor).
- **Por link**: cada jogada vira um link para mandar no WhatsApp; quem recebe assiste ao lance e responde.
- **Co-op contra o Rei Bolotão**: você + aliado (CPU ou amigo online) contra um chefão com ataques próprios.
- **Missões**: 8 quebra-cabeças com munição limitada e vento fixo; menos tiros, mais estrelas.
- **Desafio do dia**: mesmo mapa e mesma semente para todo mundo, com placar.
- **Editor de mapas**: desenhe terra e metal, teste e compartilhe por link.

Fora da partida: perfil, conquistas (fácil → lendária), moedas, loja e baús só de cosméticos, amigos, ranking (Elo, diário, temporada), histórico, replay da partida e **melhor lance em câmera lenta**, que pode ser gravado em vídeo e compartilhado.

## Controles

| Tecla | Ação |
| --- | --- |
| ← → / A D | andar (na corda: balançar) |
| ↑ ↓ / W S | mirar (Shift = ajuste fino; na corda: encurtar/soltar) |
| Espaço (segurar) | carregar força e atirar |
| Enter / Backspace | pulo / mortal pra trás |
| 1–9, Q/E, Tab | trocar arma |
| Clique no mapa | ataque aéreo / teletransporte |
| Arrastar / roda do mouse | mover câmera / zoom |
| T | emotes |
| Esc/P, M, F | pausa, som, tela cheia |

No celular: mira arrastando (estilingue), pinça para zoom e botões na tela.

## Arsenal

Bazuca, Granada (pavio de 3 s, quica), Tiro Triplo, Fragmentação, Dinamite, Ataque Aéreo, Teletransporte, **Corda Ninja** e **Paraquedas**. Pelo mapa: caixas de munição e vida, barris explosivos, minas e vigas de metal indestrutíveis. Morte súbita faz a água subir.

## Arquitetura

Modelagem por domínio primeiro: o domínio não sabe desenhar e a render só lê o estado. Detalhes e regras em [CLAUDE.md](CLAUDE.md); plano e decisões em [ROADMAP.md](ROADMAP.md).

```
src/
  domain/    regras puras e determinísticas (rodam no Node): Match, física, armas, IA, chefão, missões, melhor lance
  render/    arte procedural em Canvas
  ui/        telas e HUD em DOM
  net/       salas, lockstep, partida por link
  progress/  estatísticas, conquistas, moedas, loja, ranking local
  services/  local-first; Supabase opcional (docs/servidor.md)
  platform/  perfil de aparelho, tela cheia, vibração
  core/      Rng seedado, input, áudio e música sintetizados
```

Servidor (contas, amigos, ranking compartilhado): [docs/servidor.md](docs/servidor.md). App de loja (Capacitor): [docs/app-nativo.md](docs/app-nativo.md).
