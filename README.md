# NovaPlay IPTV — modo local

Player IPTV sem usuários e sem banco de dados. Playlists/credenciais, favoritos e preferências ficam no `localStorage`; o conteúdo importado (canais, filmes e séries) fica no **IndexedDB** do navegador, para suportar listas grandes sem estourar o limite do `localStorage`. O PHP é usado somente como **proxy** para buscar e converter M3U/M3U8 e consultar APIs Xtream Codes (evitando problemas de CORS no navegador).

> `preview.html` abre a interface sem servidor PHP (a importação real exige o proxy).

## Requisitos

- PHP 8.1+ com `curl`, `json`, `mbstring`.
- Servidor web Apache ou Nginx apontando para a pasta do projeto.
- Chrome, Edge, Firefox, Android TV / Smart TV com navegador compatível.

## Instalação

1. Copie os arquivos para o servidor (ex.: `public_html/novaplay`).
2. Não há banco, login, instalador nem painel administrativo.
3. Acesse `http://seu-servidor/novaplay/` — a aplicação inteira abre em `index.php` na raiz. Use a barra inferior ou os cartões para alternar entre Início, Live TV, Filmes e Séries; também é possível usar `index.php#live`, `#movies` e `#series`.
4. Clique em **Adicionar playlist** (botão na tela inicial ou ícone no topo).

### Nginx

Bloqueie o acesso direto a pastas internas:

```nginx
location ~ ^/(config|includes)/ { deny all; }
```

## Adicionar playlist

Na tela inicial, botão **Adicionar playlist**:

| Aba | Campos | O que acontece |
|---|---|---|
| **M3U / M3U8** | Nome + link `http(s)://.../playlist.m3u8` **ou** arquivo `.m3u`/`.m3u8` | O proxy baixa/converte o arquivo e salva canais, filmes e séries no dispositivo |
| **Xtream Codes / API** | Nome, URL do servidor (ex.: `http://host:8080`), Usuário, Senha | O proxy consulta `player_api.php` e salva canais, filmes, séries, episódios e EPG |

Depois de adicionar, use **Atualizar** na lista para sincronizar novamente. **Excluir** remove a playlist e o conteúdo salvo.

> As credenciais Xtream ficam no `localStorage` do dispositivo, em texto legível pelo próprio navegador. Não use um dispositivo compartilhado se isso for uma preocupação.

## Como funciona

- `api/proxy/m3u.php` — baixa a URL (ou recebe o texto do arquivo) e devolve JSON com `channels`, `movies`, `series` e `categories`. Reconhece `#EXTINF`, `tvg-id`, `tvg-logo`, `group-title`, `tvg-chno`, `#EXTGRP` e episódios `S01E02`.
- `api/proxy/xtream.php` — consulta `get_live_categories`, `get_live_streams`, `get_vod_*`, `get_series*`, `get_series_info` e `get_epg` sob demanda.
- `api/proxy/hls.php` — proxy de manifestos/segmentos HLS; reescreve URLs relativos e adiciona CORS, permitindo reproduzir em `localhost` mesmo quando o provedor não libera CORS direto.
- `assets/js/store.js` — camada de persistência local (`novaplay:v1` no `localStorage`).
- `assets/js/playlists.js` — modal de alta/adicionar/sincronizar/excluir playlists.
- `assets/js/player.js` — player HLS.js / Video.js / HTML5, com qualidade e reconexão. As bibliotecas HLS.js, Video.js e Bootstrap estão em `assets/js/vendor` e `assets/css/vendor`, funcionando sem CDN (importante em Smart TVs). Canais Xtream tentam `.m3u8` e, se falhar, `.ts`.

As URLs de stream são construídas a partir da playlist (M3U direto ou padrão Xtream `/live`, `/movie`, `/series`). A reprodução depende do provedor permitir acesso ao vídeo pelo navegador (CORS/HLS).

## Telas (uma única página)

- **Início**: Live TV à esquerda; Movies e Series empilhados à direita; botão de playlists.
- **Live TV**: categorias, busca, favoritos, player com qualidade e EPG (quando o provedor fornece).
- **Filmes / Séries**: filtros por categoria, busca, detalhes, favoritos e "continuar assistindo".
- A navegação inferior funciona com mouse, toque ou controle remoto (setas + Enter); `Esc` retorna ao início.

Atalhos: setas navegam, `Enter` seleciona, `Esc`/`Voltar` retorna, `P` play/pause, `M` mudo, `F` tela cheia, `PageUp`/`PageDown` trocam de canal.

### Compatibilidade com Smart TV / controle remoto

- Navegação espacial com setas (também aceita os códigos usados por controles de TV e os nomes `Left/Right/Up/Down`).
- Qualquer botão, link, campo de formulário e cartão é alcançável sem mouse; o elemento focado recebe borda luminosa reforçada.
- Modais limitam a navegação ao seu conteúdo, focam automaticamente o primeiro campo e devolvem o foco ao botão de origem ao fechar.
- `Esc`, `Backspace` e o botão **Voltar** do controle oferecem saída em camadas: primeiro saem do campo; com filme, episódio ou canal aberto, encerram o player e retornam à lista; pressionados novamente, voltam ao Início.
- A barra inferior de navegação fica fixa e acessível em qualquer tela.
- Vídeos têm `tabindex` e podem ser focados; `P`/`M`/`F` funcionam com o controle.

## Estrutura

```
api/proxy/    M3U e Xtream (proxy/parser)
index.php     aplicação única (Home + Live TV + Movies + Series)
live-tv.php, movies.php, series.php  atalhos para as visões (redirecionam com hash)
assets/css/   base, home, app
assets/js/    app, store, playlists, player, home, live, movies, series
config/       app.php (sem banco)
includes/     bootstrap, functions, header, footer
storage/      cache local do servidor (protegido)
manifest.json + sw.js  PWA
preview.html  pré-visualização estática
```

## Solução de problemas

| Sintoma | Causa | Ação |
|---|---|---|
| "Servidor proxy indisponível" | chamada ao `api/proxy` falhou | conferir se o projeto está sob PHP e se o caminho está correto |
| "URLs internas/privadas não são permitidas" | proxy bloqueia SSRF | usar URL pública; para teste local, ajustar `safe_remote_url()` em `includes/functions.php` |
| Vídeo não toca | provedor sem CORS ou HLS inválido | testar a URL no navegador; verificar console |
| Sem EPG | provedor não fornece | normal; o painel informa "EPG indisponível" |

Projeto independente, sem marcas de terceiros. Use apenas conteúdo que você tem autorização para reproduzir.
