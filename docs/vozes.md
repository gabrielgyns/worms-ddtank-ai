# Roteiro de gravação: pacote de voz

> **Pacotes prontos:** Voz original (`public/voices/original.mp3`, item `voice-original` na loja).

Cada pacote de voz é um personagem (Padrão, Pirata, Vovó, Robô, Caipira…). Para cada um, grave as falas abaixo. No jogo eu deixo a voz mais aguda (efeito esquilo), varío o tom por time e sorteio entre as versões de cada momento.

## Como gravar (no celular)

- Grave num **lugar quieto** (quarto com cortina e roupa ajuda; banheiro ecoa demais), com o celular a **um palmo da boca**.
- **Exagere**: fale como desenho animado. Quanto mais caricato, melhor fica depois de acelerado.
- Grave **2 ou 3 versões** de cada fala, com jeitos diferentes (bravo, rindo, cansado).
- Pode ser **um arquivo só, bem longo**: fale o número do item, espere 1 segundo, fale a fala, espere 2 segundos e passe para a próxima. Eu corto pelos silêncios.
- Formato: qualquer um que o celular gravar (m4a, mp3, wav). Mande junto o nome do personagem.
- Falas curtas: **no máximo 2 segundos** cada.

## As falas

As marcadas com ⭐ são as mais importantes. Com elas o pacote já funciona.

### Começo do turno
1. ⭐ "Minha vez!"
2. "Deixa comigo!"
3. "Hora do show!"

### Mirando e atirando
4. ⭐ "Toma!"
5. "Lá vai!"
6. "Fogo!"
7. "Segura essa!"

### Acertou o inimigo
8. ⭐ "Na mosca!"
9. "Bem feito!"
10. "Hehehe!"

### Eliminou alguém
11. ⭐ "Próximo!"
12. "Tchau, tchau!"
13. "Foi mal… só que não."

### Errou o tiro
14. ⭐ "Errei!"
15. "Ah, não!"
16. "Era pra ser assim mesmo…"

### Acertou a si mesmo
17. ⭐ "Ops…"
18. "Ninguém viu isso."

### Acertou o próprio time
19. ⭐ "Fogo amigo?!"
20. "Ei, eu sou do seu time!"

### Tomou dano
21. ⭐ "Ai!" (curtinho)
22. "Ui!"
23. ⭐ "AAAAI!" (dano grande, gritado)
24. "Essa doeu!"

### Vida baixa
25. ⭐ "Socorro!"
26. "Tô mal…"

### Caindo ou na água
27. ⭐ "Aaaaaaa!" (grito de queda, uns 2 segundos)
28. "Glub glub!"

### Morreu
29. ⭐ "Tchau!"
30. "Fui…"

### Venceu e perdeu
31. ⭐ "Vitória!"
32. "Somos os melhores!"
33. ⭐ "Perdemos…"

### Tempo acabando
34. "Rápido, rápido!"

### Pegou caixa
35. "Oba, presente!"

### Armas especiais (opcional)
36. "Bééé!" (ovelha)
37. "Ataque aéreo!"
38. "Banana!"
39. "Teletransporte!"

### Sons sem palavra (valem ouro)
40. Risada maldosa ("Muahaha!")
41. Suspiro de alívio ("Ufa!")
42. "Hmpf!" (bravo)
43. Assobio

## Ideias de personagem

- **Padrão**: animado, voz de desenho.
- **Pirata**: "Arrr!", "Ao mar!", "Pelas barbas do Netuno!"
- **Vovó**: "Ai, minha coluna!", "No meu tempo era diferente!"
- **Robô**: falas pausadas, "Alvo. Eliminado."
- **Caipira**: "Eita!", "Uai!", "Ô trem bão!"

Os personagens podem trocar as falas por equivalentes do jeito deles. O que importa é cobrir os momentos ⭐.

## Como um pacote entra no jogo (para quem for processar)

1. Converta a gravação: `ffmpeg -i gravacao.m4a -ac 1 -ar 16000 <pasta>/vox/full16k.wav` (e outra a 48000 em `full48k.wav`).
2. `scripts/voz/1_cortar_e_transcrever.py`: acha as falas pelos silêncios e transcreve (modelo Whisper offline do sherpa-onnx, baixado dos releases do GitHub). Confira a ordem contra o roteiro e descarte ruídos.
3. `scripts/voz/2_montar_pacote.py`: limpa, iguala o volume e junta tudo em `public/voices/<id>.mp3`; o JSON vira a lista de falas em `src/core/voicepacks.ts`.
4. `scripts/voz/3_conferir.py`: transcreve de novo a partir do mp3 pronto e checa se nenhuma fala foi cortada.
5. Cadastre o item no catálogo (`src/domain/cosmetics.ts`, espaço `voice`).

No jogo, a fala toca acelerada (efeito esquilo) conforme o bicho: bolota 1,32×, gato 1,45×, hamster 1,62×, Rei 0,8× (grave).
