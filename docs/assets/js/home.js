/* Home: contagens e status da playlist selecionada (armazenamento local). */
(function () {
  'use strict';

  function set(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

  async function refresh() {
    const c = NovaStore.counts();
    set('count-live', c.channels + (c.channels === 1 ? ' canal' : ' canais'));
    set('count-movies', c.movies + (c.movies === 1 ? ' filme' : ' filmes'));
    set('count-series', c.series + (c.series === 1 ? ' série' : ' séries'));

    const box = document.getElementById('home-status');
    if (!box) return;
    const p = NovaStore.selectedPlaylist();
    if (!NovaStore.state.playlists.length) {
      box.className = 'home-status empty';
      box.innerHTML = '<span>' + Nova.icon('warn') + ' Nenhuma playlist adicionada. Use o botão <strong>Adicionar playlist</strong>.</span>' +
        '<button class="btn-ghost btn-sm" id="home-status-add">Adicionar playlist</button>';
    } else if (p && p.lastError) {
      box.className = 'home-status error';
      box.innerHTML = '<span>' + Nova.icon('warn') + ' <strong>' + Nova.escapeHtml(p.name) + '</strong>: ' + Nova.escapeHtml(p.lastError) + '</span>' +
        '<span class="d-flex gap-2"><button class="btn-ghost btn-sm" id="home-status-retry">Tentar novamente</button>' +
        '<button class="btn-ghost btn-sm" id="home-status-open">Gerenciar</button></span>';
    } else if (p) {
      box.className = 'home-status ok';
      box.innerHTML = '<span>' + Nova.icon('check') + ' Exibindo <strong>' + Nova.escapeHtml(p.name) + '</strong> — ' +
        c.channels + ' canais • ' + c.movies + ' filmes • ' + c.series + ' séries</span>' +
        '<span class="d-flex gap-2"><button class="btn-ghost btn-sm" id="home-status-retry">Atualizar</button>' +
        '<button class="btn-ghost btn-sm" id="home-status-open">Gerenciar</button></span>';
    } else {
      box.className = 'home-status';
      box.innerHTML = '<span>' + Nova.icon('list') + ' Exibindo todas as playlists — ' + c.channels + ' canais • ' + c.movies + ' filmes • ' + c.series + ' séries</span>' +
        '<button class="btn-ghost btn-sm" id="home-status-open">Gerenciar</button>';
    }
    const add = document.getElementById('home-status-add');
    if (add) add.addEventListener('click', () => NovaPlaylists.open());
    const open = document.getElementById('home-status-open');
    if (open) open.addEventListener('click', () => NovaPlaylists.open());
    const retry = document.getElementById('home-status-retry');
    if (retry) retry.addEventListener('click', async () => {
      const target = NovaStore.selectedPlaylist();
      if (!target) return;
      retry.disabled = true; Nova.loading.show('Atualizando "' + target.name + '"'); Nova.loading.step('Consultando o provedor...');
      try {
        await NovaStore.sync(target.id);
        Nova.loading.step('Conteúdo salvo no dispositivo...');
        Nova.toast('Playlist atualizada.');
        await refresh();
        setTimeout(() => Nova.loading.hide(), 400);
      } catch (e) {
        Nova.loading.hide();
        Nova.toast(e.message, 'error');
        await refresh();
      }
      retry.disabled = false;
    });
  }

  window.addEventListener('load', () => {
    NovaStore.ready.then(() => { refresh(); }).catch(() => { refresh(); });
    const add = document.getElementById('home-add-playlist');
    if (add) add.addEventListener('click', () => NovaPlaylists.open());
    window.addEventListener('novaplay:playlists-changed', refresh);
    const first = document.querySelector('.home-grid [data-focusable]');
    if (first) Nova.setFocus(first);
  });
})();
