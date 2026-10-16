# Arte com IA: como gerar e como entra no jogo

A ideia é **você gerar as imagens** (Nano Banana / Gemini é grátis e mantém bem o personagem entre imagens) e **eu transformar em peças do jogo**: tiro o fundo, corto em partes, monto o "esqueleto" e animo por código. Os olhos, bocas e expressões continuam desenhados por código por cima, então os humores (mirar, chorar, bravo…) seguem funcionando.

## O que mais muda o visual (em ordem)

1. **Cenários de fundo**: cada cenário vira 3–4 camadas pintadas (céu, montanhas longe, morros perto). É só imagem: entra fácil e muda o jogo inteiro.
2. **Personagens**: bolota e bichos pintados, em peças (corpo, cabeça, orelhas, patas, rabo) animadas por código, como no DDTank.
3. **Interface**: logo, botões, ícones de arma, molduras.
4. **Armas e itens**: bazuca, granada, tatu-bomba, caixas.

## Como me mandar

- Anexe as imagens aqui no chat (como os áudios), em PNG e no tamanho máximo que a ferramenta der.
- Diga o que é cada uma ("cenário prado, camada de trás", "gato, peças").
- Pode mandar várias tentativas: eu escolho a que encaixa melhor e aviso o que ajustar.

## Regras para a imagem funcionar no jogo

- **Fundo liso de uma cor só** (verde-limão `#00FF00` ou branco puro), sem sombra no chão e sem cenário atrás do personagem.
- **Contorno escuro grosso** e cores chapadas com uma sombra só (cel shading): fica bonito pequeno na tela e vira vetor sem perder qualidade.
- **Personagem virado de 3/4 para a direita** (eu espelho para a esquerda).
- **Peças separadas, sem encostar umas nas outras**, quando for folha de peças.
- **Não peça "no estilo DDTank/Worms"** nem cite outro jogo ou personagem: descreva o estilo (abaixo). Assim a arte é nossa.

## Prompts prontos (em inglês, a IA entende melhor)

### 1. Guia de estilo (gere primeiro e use como referência em todas as outras)

```
Key art for a cute 2D artillery game. A round chubby blob character called "Bolota" (orange, big shiny anime eyes, small hands and feet, red headband with flowing tails) holding a cartoon bazooka, standing on a grassy floating island. Style: bold thick dark-brown outlines, flat cel shading with one shadow tone, saturated warm colors, soft glossy highlights, chibi proportions, playful anime/cartoon look, clean vector-like shapes. Bright sky, fluffy clouds. No text.
```

### 2. Folha de peças de um personagem (repita para cada bicho)

Anexe a imagem do guia de estilo junto e escreva:

```
Using the same art style as the reference image, draw a character parts sheet for a cute chibi cat character (orange tabby). Separate, non-overlapping pieces laid out in a grid on a plain solid #00FF00 green background: 1) head without eyes and without mouth, facing 3/4 right, 2) body (sitting, pear-shaped, cream belly), 3) front paw, 4) back leg with paw, 5) tail, 6) left ear, 7) right ear. Thick dark-brown outlines, flat cel shading with one shadow tone, no cast shadows, no text, no labels.
```

Troque "cat (orange tabby)" por: `round blob character (orange, red headband)`, `hamster with big cheek pouches`, `floppy-eared puppy with a spot`, `armadillo carrying a round black bomb on its shell`…

### 3. Personagem inteiro em poses (para eu conferir proporção e cor)

```
Same character and style as the reference. Turnaround sheet on plain solid #00FF00 background: idle, walking, aiming a bazooka, jumping, hurt, celebrating. Facing 3/4 right. Thick dark outlines, flat cel shading, no text.
```

### 4. Cenário em camadas (uma imagem por camada)

```
Side-scrolling 2D game background layer, wide panoramic 3:1, same art style as the reference. Layer: distant mountains with soft atmospheric haze, meadow theme, warm afternoon light. Only this layer, plain solid #00FF00 background above the mountain silhouette, seamless left-right edges. No characters, no text.
```

Peça separado: céu (sem `#00FF00`, é o fundo inteiro), montanhas longe, morros médios, árvores/arbustos perto. Temas: `meadow`, `desert canyon`, `snowy mountains`, `candy land with lollipop trees`.

### 5. Ícones de arma

```
Game UI icon set in the same style: bazooka, grenade, triple-shot rocket, cluster bomb, dynamite, airstrike radio, teleport device, ninja rope, parachute, armadillo bomb, banana bomb, homing missile, baseball bat, steel girder. Each icon separate on plain solid #00FF00 background, thick dark outlines, flat cel shading, no text.
```

## O que eu faço com o que você mandar

1. Tiro o fundo (por cor ou com o `rembg`, que roda aqui offline).
2. Corto e nomeio as peças; se a arte for de cores chapadas, viro vetor com o `vtracer` (arquivo pequeno e nítido em qualquer zoom).
3. Monto o esqueleto no código (pivôs de cabeça, patas, rabo) e reaproveito as animações que já existem: andar, pular, apanhar, comemorar, expressões.
4. Cenários entram como camadas de paralaxe na GPU.
5. Mando print/vídeo para você aprovar antes de subir.
