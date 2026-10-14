# Bolotas em Guerra

Jogo de artilharia por turnos no estilo **Worms Armageddon** com a pegada do **DDTank**: segure para carregar a força, solte para atirar e preste atenção no vento.

## Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # gera dist/index.html (arquivo único, abre direto no navegador)
```

## Controles

| Tecla | Ação |
| --- | --- |
| ← → / A D | andar |
| ↑ ↓ / W S | mirar (Shift = ajuste fino) |
| Espaço (segurar) | carregar força e atirar |
| Enter / Backspace | pulo / mortal pra trás |
| 1–7, Q/E, Tab | trocar arma |
| Clique no mapa | ataque aéreo / teletransporte |
| Arrastar / roda do mouse | mover câmera / zoom |
| Esc, M | pausa, som |

No celular aparecem botões na tela.

## Arsenal

Bazuca, Granada (pavio de 3s, quica), Tiro Triplo, Fragmentação, Dinamite, Ataque Aéreo e Teletransporte.

## Arquitetura

O domínio não sabe desenhar; a render só lê o estado.

```
src/
  domain/   regras puras: Terrain (máscara destrutível), physics, weapons, Match (turnos + eventos), ai
  render/   arte procedural em Canvas: terreno, céu/paralaxe, bolotas, efeitos, câmera
  ui/       HUD e controles de toque em DOM
  core/     matemática, input, sons sintetizados (WebAudio)
  game.ts   liga tudo: loop de passo fixo (60 Hz), controladores, som
```

A IA usa a mesma função `stepProjectile` do jogo para simular centenas de tiros, avalia o dano esperado em inimigos e aliados e aplica um erro de mira conforme a dificuldade.

Nenhum asset externo: toda a arte é vetorial e procedural, e os sons são sintetizados.
