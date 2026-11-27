# NovaPlay IPTV — versão estática (GitHub Pages)

Esta pasta contém uma versão **100% HTML/CSS/JavaScript**, sem PHP. Pode ser hospedada no GitHub Pages.

## Publicar

1. Faça o push do repositório para o GitHub.
2. Em **Settings → Pages**, escolha:
   - Source: **Deploy from a branch**
   - Branch: `main`, folder: `/ (root)`
3. Acesse `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/static/`.

A pasta `static/` é autocontida: inclui `assets/` (CSS, JS, ícones e bibliotecas locais), então funciona mesmo que o site seja publicado com a pasta `static/` como raiz.

## Como funciona

- `js/static-api.js` substitui o proxy PHP:
  - M3U/M3U8: busca a URL (ou lê o arquivo) e faz o parse no navegador.
  - Xtream Codes: chama `player_api.php` diretamente no provedor.
  - URLs relativas da playlist são resolvidas para absolutas.
- Playlists, favoritos, progresso e conteúdo ficam no dispositivo (`localStorage` + `IndexedDB`, com chaves próprias `novaplay:static:v1` / `novaplay-static` para não misturar com a versão PHP).
- HLS.js toca as transmissões diretamente da URL do provedor.

## Limitação importante: CORS

O navegador só consegue buscar a playlist/API do provedor se ele permitir **CORS**. Muitos provedores não permitem — nesses casos a importação falha com:

> O provedor não permite acesso direto pelo navegador (CORS). Use a versão PHP em uma hospedagem com proxy.

Isso não é um bug do player: é uma restrição de segurança do navegador. A versão PHP (pasta raiz) resolve porque o servidor faz a requisição por você.

## Recomendação

- Use esta versão estática apenas se o provedor permitir CORS ('ou se você usar arquivos M3U locais, que não exigem rede).
- Para provedores Xtream/M3U típicos, prefira a versão PHP em uma hospedagem com PHP 8.1+ (veja `DEPLOY.md` na raiz).
