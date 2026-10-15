# Balanceamento

Gerado por `npm run balance` (20 partidas por linha, CPU difícil x CPU difícil, 2 bolotas por time).

## Armas básicas: duelo só com aquela arma

| Arma | Dano por tiro | Acerto | Vezes até acabar |
| --- | ---: | ---: | ---: |
| Bazuca | 23.7 | 60% | 14.3 |
| Granada | 14.3 | 37% | 22.1 |
| Tiro Triplo | 27.5 | 71% | 12.8 |
| Fragmentação | 22.6 | 75% | 14.1 |

## Quem começa leva vantagem?

Partida normal (arsenal completo, itens, caixas): o time que começa venceu **65%** de 40 partidas decididas. Duração média: 17.9 vezes.

## Armas especiais: dano num alvo (explosão bem no pé dele, média de 5 posições)

| Arma | Dano | Observação |
| --- | ---: | --- |
| Dinamite | 69 | solta aos pés; precisa chegar perto |
| Ataque Aéreo | 24 | um míssil do ataque (são 5 espalhados) |
| Ovelha | 59 | anda até o alvo; dá para desviar |
| Bomba Banana | 98 | explosão + 5 bananas; quase sempre várias acertam |
| Míssil Teleguiado | 40 | precisa marcar o alvo |

Referência: bolota tem 100 de vida. Uma arma especial (1 por partida) que mata de uma vez sem esforço desequilibra.

## Ajustes feitos com estes números (F9-12)

Antes → depois, medindo de novo depois de cada mudança:

- **Tiro triplo**: leque ±5° → ±3°, dano 25 → 30, raio 30 → 32. Rendia 13 de dano por tiro (os mísseis se espalhavam demais); agora ~27, justo para uma arma com 3 de munição.
- **Granada**: raio 48 → 50. Quicar menos (testado) piorou: a CPU erra mais a conta dos quiques. Os números baixos da granada são limite da CPU, não da arma.
- **Bomba Banana**: pedaços 30 → 20 de dano, raio 42 → 34. Matava qualquer bolota de uma vez (133); agora ~98, ainda a mais forte, mas com munição 1.
- **Ovelha**: dano 55 → 65, raio 62 → 70 (49 → 59). Dá trabalho e pode ser desviada; precisava valer mais.
- **Míssil teleguiado**: dano 42 → 46.

Para acompanhar: quem começa venceu 50% (20 partidas) e 65% (40 partidas). Pode haver uma vantagem leve; se continuar acima de 60% com mais partidas, compensar o segundo time (ex.: um escudo a mais).
