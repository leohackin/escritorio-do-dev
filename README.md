# Escritório do Dev

Uma simulação ao vivo do escritório do **Dev**, das tirinhas [@vidadodev](https://instagram.com/vidadodev), no espírito do descanso de tela *Johnny Castaway*. Você não controla nada, só assiste.

- O relógio é o **horário de Brasília** (America/Sao_Paulo), independente do fuso de quem abre.
- A agenda de cada dia é gerada de forma **determinística**: a semente é a data, então todo mundo vê o mesmo dia ao mesmo tempo, e cada data é diferente.
- **v2:** planta isométrica grande (cozinha completa, banheiro fechado, open space com 12 estações, sala de reunião de vidro, lounge com sofá/TV/videogame/pufes, recepção e entrada), desenhada como tirinha de jornal: contorno preto firme, branco, pontilhado leve, sem sombra. Os bonecos são sprites (PNG transparente) que andam por corredores e portas com A*, somem no banheiro e saem pela porta da frente.
- **Regra de cor:** tudo preto e branco, exceto o post-it amarelo (o **Prompt**, com carinha, só no monitor do Dev) e a caneca azul-acinzentada do Dev. O Dev é o único de camiseta preta "DE BOA".
- A v1 (tudo em SVG feito por código) está guardada na tag git `v1`.

## Rodar local

```bash
npm run dev          # gera version.json e sobe http://localhost:8080
npm test             # valida agenda: cobertura 0–24h, determinismo, dias diferentes
python3 scripts/screenshots.py http://localhost:8080/ '[["nome","?data=2026-10-02&hora=17:55:05&parar",1600,800]]'
```

Não tem bundler: é HTML/CSS/JS estático com ES modules. Só precisa de um servidor HTTP, porque `file://` não carrega os JSON.

## Testar horários pela URL

| parâmetro | exemplo | efeito |
|---|---|---|
| `hora` | `?hora=17:55` ou `17:55:30` | começa nesse horário e o relógio anda a partir dele |
| `dia` | `?dia=sex` | dia da semana da semana atual (`seg`…`dom`, acento opcional) |
| `data` | `?data=2026-10-02` | data exata, que é a semente da agenda |
| `vel` | `?vel=60` | acelera o tempo (1 min real = 1 h), até 3600 |
| `parar` | `?parar` | congela o relógio, útil para screenshot |
| `agenda` | `?agenda=1` | painel com a agenda do Dev no dia |
| `sal` | `?sal=abc` | muda a semente, para ver outro sorteio da mesma data |

Exemplos:
- `?dia=sex&hora=17:55` é o deployzin de sexta.
- `?data=2026-10-02&hora=19:30` é um happy hour.
- `?hora=23:00` mostra o escritório escuro (só o post-it brilha; a janela muda com a hora).
- `?data=2026-10-20&hora=12:45` é o almoço da turma na mesa da cozinha; `?data=2026-10-21&hora=13:30`, o videogame no sofá.
- No celular a planta fica maior e dá para arrastar; abre centrada no Dev.
- `?dia=sab&hora=09:30` mostra a faxina de sábado.

No console, `window.escritorio` expõe `agenda()`, `gerarAgenda('2026-10-30')`, `atualizarBanco()` e `checarVersao()`.

## Dados (editar só JSON)

### `data/personagens.json`

O formato é `{ "versao": 1, "personagens": [...] }`.

| campo | significado |
|---|---|
| `id` | identificador usado nas ações (`dev`, `gerente`, `carla`…) |
| `nome`, `papel` | só informativo |
| `tipo` | `dev` \| `gerente` \| `colega` \| `visitante` (só aparece quando uma ação chama) \| `fixo` (o Prompt) |
| `mesa` | índice da mesa em `cenario.json`; a mesa 5 é a da sala de vidro |
| `dias`, `presenca` | dias em que vem e a chance de vir, de 0 a 1 |
| `visual` | `cabelo`, `oculos`, `barba`, `roupa`, `texto` (estampa), `acessorio`, `sorriso`, `forma` (`pato`/`pombo`/`postit`) |

### `data/acoes.json`

O formato é `{ "padrao": {...}, "acoes": [...] }`.

O bloco `padrao` guarda o que preenche os buracos da agenda:
- os status "trabalhando" de cada pessoa ou tipo
- as poses de trabalho
- as falas ocasionais
- os status de antes, depois, fim de semana e ausente

Cada ação aceita estes campos:

| campo | significado |
|---|---|
| `id`, `nome` | identificação |
| `categoria` | `chegada` \| `almoco` \| `saida` \| `rotina` \| `evento` \| `raro` \| `fds` \| `ambiente`. Uma chegada, um almoço e uma saída são sorteados por pessoa; o resto entra como "recheio" |
| `quem` | `dev`, um id, um tipo, `colega` (qualquer colega), `cenario` ou uma lista |
| `dias` | `["sex"]`, `["sab","dom"]`… |
| `janela` | `["17:53","17:55"]`, intervalo em que a ação pode começar |
| `duracao` | minutos, fixo ou `[min,max]` |
| `peso` | peso no sorteio dentro da categoria (chegada/almoço/saída) |
| `chance` | probabilidade de acontecer no dia (recheio) |
| `maxPorDia`, `intervaloMin` | repetições e espaço mínimo entre elas |
| `prioridade` | quanto maior, mais cedo é encaixado; ≥5 entra antes da saída/almoço |
| `local` | `mesa`, `mesa:<id>` (em pé ao lado da mesa), `teclado:<id>`, `fora`/`porta` (sai pela entrada e some), `banheiro` (entra e some), `banheiro-fila`, `recepcao`, `copa` (em pé na cozinha), `cafeteira`, `micro-ondas` (fila), `geladeira`, `pia`, `mesa-cozinha` (sentado à mesa de jantar), `sofa` (2 no sofá + 2 em pé; a TV mostra o jogo se o id da ação tiver `videogame`), `reuniao`, `janela`, `centro`, `corredor` |
| `slot` | (em etapas) qual ponto do local usar; grupos simultâneos no mesmo local são afastados automaticamente |
| `pose` | `digitando`, `digitando-rapido`, `olhando`, `comendo`, `dormindo`, `em-pe`, `falando`, `cafe`, `brindando`, `ofegante`, `varrendo`, `extintor`, `preocupada`, `prancheta`, `celebrando`. Se o personagem não tem o sprite da pose, usa `em-pe` |
| `props` | `caneca`, `copo`, `garfo`, `vassoura`, `prancheta`, `caneta`, `mochila`, `marmita`, `sacola` |
| `status` | texto do indicador; `{n}` vira o número da repetição (o "4º café") |
| `envolvidos` | outras pessoas: `[{ "quem": "gerente", "local": "mesa:dev", "pose": "falando" }]`. Aceita `colega` e `colegas` |
| `requer` | `["colegas"]`: só acontece se houver colegas livres |
| `falas` | `[{ "quem": "eu"\|id\|"colega"\|"prompt", "texto": "...", "em": 16, "dur": 5 }]`. O texto vai em CAIXA ALTA |
| `variantes` | listas alternativas de falas, uma é sorteada |
| `chanceFalas`, `cicloFalas` | chance de ter falas e período (s) em que o diálogo se repete |
| `efeitos` | `[{ "tipo": "tela"\|"fumaca"\|"bilhete", "mesa": "dev", "texto": "ERRO 500" }]` |
| `bonus` | `[{ "seHouve": "deploy-sexta", "peso": 6 }]`: soma peso se outra ação aconteceu no dia |
| `forcaPresenca` | acontece mesmo se a pessoa não veio (plantão de sábado, faxina) |
| `etapas` | ação em várias partes: `[{ "dur", "status", "papeis": { "eu": {"local","pose"}, "entregador": {...} }, "falas", "efeitos" }]` |

Para **adicionar uma ação**, copie uma parecida em `data/acoes.json`, troque o `id` e pronto. Rode `npm test` para conferir. As páginas que já estão abertas pegam a ação nova em até ~30 min, sem reload (veja abaixo).

`data/cenario.json` (coordenadas no espaço da arte, 2560×1440) guarda:
- `mesas[i].cadeira` (onde o boneco senta), e na mesa do Dev `tela`, `teclado`, `caneca`, `postit` (quadriláteros/pontos onde o código desenha monitor, caneca e post-it);
- `locais.<nome>.pontos` (`x`, `y`, `olhar`, `tipo`: `em-pe` | `costas` (sentado de costas, corte do sprite) | `frente` (sentado de frente comendo), `prof` = profundidade para oclusão), `acesso`/`trilho` (passos fixos antes de chegar, ex.: passar pela porta), `sumir`;
- `janela`, `relogio`, `portas`, `tv`: onde a janela muda com a hora, os ponteiros e as portas abertas são desenhados;
- `escalaBoneco`, `velocidade` (px/s), `luz`;
- `arte`: sementes usadas por `arte/ferramentas/cenario.py` para gerar `profundidade.png` (oclusão) e `andavel.png` (chão andável do A*).

## Rodando indefinidamente (descanso de tela)

A página foi feita para ficar aberta por dias:

1. **O estado é função da hora.** Cada quadro calcula posição, pose, balão e luz direto da hora atual em Brasília, sem nada acumulado.
   - Uma aba em segundo plano não "reproduz" o que perdeu. Ao voltar, o próximo quadro já mostra o estado certo.
   - O `requestAnimationFrame` pausa sozinho em aba oculta.
2. **Meia-noite.** Quando a data de Brasília muda, a agenda do novo dia é gerada na hora. Isso foi testado com `vel=1200` passando das 23:50 para o dia seguinte.
3. **Banco de ações vivo.** A cada 30 min a página busca de novo `data/acoes.json` e `data/personagens.json`, com `?v=<timestamp>` e `cache: no-store`.
   - Se o conteúdo mudou, gera a agenda nova e **mescla a partir de agora+10 min**: o que está acontecendo continua, e o resto do dia passa a usar o banco novo.
   - Personagens novos ganham boneco; os removidos somem.
   - JSON inválido é ignorado e a página segue com o anterior.
4. **Versão do código.** `npm run build` gera `version.json` com o commit e o horário. A página consulta esse arquivo a cada 10 min.
   - Se a versão mudou, marca um reload pendente e recarrega num momento tranquilo: aba oculta, escritório vazio de madrugada (antes das 7h ou depois das 21h) ou fim de semana vazio.
   - Em qualquer caso, recarrega **no máximo 3 h** depois de detectar a versão nova.
5. **Sem vazamento.**
   - Há um único `setInterval` de 60 s para manutenção (banco, versão, reload) e um único loop rAF limitado a ~30 fps.
   - A cena é um único `<canvas>` redesenhado a ~30 fps só quando alguém anda/fala (senão, 4 fps). Os balões (SVG) são reaproveitados por personagem; rotas A* ficam em cache e o cache é limpo a cada dia.
   - Os fetches têm timeout de 15 s e há trava contra execução simultânea.
   - Teste: a contagem de elementos ficou estável (~1100–1150) atravessando 12 h simuladas.
   - Erros num quadro são logados no máximo 1x/min e não derrubam o loop.

## Deploy

É um site estático na Vercel (projeto `escritorio-do-dev`). `vercel.json` define os headers:
- `no-store` em `version.json` e `data/*`
- revalidação em HTML/JS/CSS
- cache longo da fonte

Antes de publicar, rode `npm run build` para gerar o `version.json`. Num build da Vercel, o script usa `VERCEL_GIT_COMMIT_SHA` se existir.

## Estrutura

```
index.html  css/style.css  fonts/PatrickHand.ttf
js/main.js      loop, rotas, poses, balões, luz, HUD, atualização/versão, pan no celular
js/cena.js      carrega arte + sprites, A* no andavel.png, desenho com oclusão por profundidade
js/enfeites.js  relógio, janela por hora, post-it, caneca, monitor, fumaça, jogo na TV
js/agenda.js    PRNG (mulberry32) + gerador determinístico + mescla (sem DOM)
js/relogio.js   hora de Brasília + parâmetros da URL
assets/         cenario.webp, profundidade.png, andavel.png, sprites/<id>/<pose>.png + indice.json
data/*.json     elenco, ações, cenário
arte/           folhas brutas geradas, prompts e ferramentas que produzem assets/
scripts/        gerar-versao, testar-agenda, screenshots
```

## Como gerar a arte

Tudo que está em `assets/` sai de `arte/` com scripts reprodutíveis (Python 3 com `opencv-python-headless numpy scipy pillow`):

```bash
python3 -m venv .venv-arte && .venv-arte/bin/pip install opencv-python-headless numpy scipy pillow
```

1. **Prompts** ficam em `arte/prompts/`:
   - `estilo-base.txt`: estilo comum (tirinha de jornal, contorno firme, branco, pontilhado leve, sem sombra/cinza/cor, **sem texto nem placas**).
   - `cenario.txt`: a planta isométrica com todas as salas (use a imagem de referência de layout só para layout/estilo).
   - `sprite-base.txt` + `folha-sprites.txt`: folha de sprites de um personagem (mesma escala e ângulo, fundo branco liso, poses separadas). Sempre anexe a tirinha de referência do personagem (cores: só o Dev de camiseta preta "DE BOA").
   Gere no gerador de imagem de sua preferência e salve em `arte/bruto/` (`<id>-a.jpg`, `cenario-b.jpg`…).
2. **Cenário:** `cd arte/ferramentas && python cenario.py` limpa a folha (tinta preta pura), apaga o que o código desenha (ponteiros do relógio etc., `arte.apagar`) e gera `assets/cenario.webp`, `profundidade.png` e `andavel.png` usando as sementes de `data/cenario.json → arte`. Ele também grava `/tmp/cenario-debug.png` para conferir.
3. **Sprites:** `python recortar.py ../bruto/dev-a.jpg /tmp/rec-dev` numera os recortes da folha (veja `contato.png`); mapeie número → pose em `arte/sprites.json` (`ref`/`alvo` controlam a escala, `corteTopo` faz o sprite de sofá, `tingir` pinta a caneca, `engrossar` engrossa o traço para combinar com o cenário). Depois `python montar.py` (também em `arte/ferramentas`) grava `assets/sprites/<id>/<pose>.png` (fundo transparente, sem halo) e `indice.json` (tamanho e ponto do pé).
4. Ajuste `escalaBoneco` e os pontos em `data/cenario.json`, e confira com `scripts/screenshots.py`.

Nomes de pose que o código procura: `em-pe`, `andar-frente-1/2`, `andar-costas-1/2`, `correndo-1/2`, `sentado-costas` (digitando, de costas na cadeira), `digitando-rapido`, `dormindo`, `sofa`, `comendo`, `falando`, `cafe`, `brinde`, `ofegante`, `varrendo`, `extintor`, `preocupada`, `sentado-prancheta`, `voando-1/2` (pombo).
