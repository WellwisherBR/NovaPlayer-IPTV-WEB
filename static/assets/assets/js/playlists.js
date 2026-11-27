/* Modal de playlists: adicionar M3U (link/arquivo) ou Xtream, sincronizar e remover. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => Nova.escapeHtml(s);
  let modal = null;

  function open() {
    if (!modal) return;
    modal.show();
    render();
  }

  function changed() {
    window.dispatchEvent(new Event('novaplay:playlists-changed'));
  }

  function render() {
    const box = $('playlist-list');
    if (!box) return;
    const ps = NovaStore.state.playlists;
    if (!ps.length) {
      box.innerHTML = '<div class="empty-state" style="min-height:150px">' + Nova.icon('list') +
        '<strong>Nenhuma playlist adicionada</strong><span>Use o formulário acima para adicionar M3U ou Xtream Codes.</span></div>';
      return;
    }
    const selected = NovaStore.state.selectedId;
    const selectedName = selected ? (NovaStore.getPlaylist(selected) || {}).name : 'Todas as playlists';
    box.innerHTML = '<div class="d-flex align-items-center gap-2 flex-wrap mb-2 small text-secondary">' +
      '<span>Exibindo: <strong class="text-white">' + esc(selectedName || 'Todas as playlists') + '</strong></span>' +
      (selected ? '<button class="btn-ghost btn-sm" id="select-all">Ver todas</button>' : '') + '</div>' +
      ps.map(p => {
        const c = NovaStore.state.content[p.id];
        const counts = c ? c.counts : null;
        const synced = c && c.syncedAt ? new Date(c.syncedAt).toLocaleString('pt-BR') : 'nunca';
        const tipo = p.type === 'xtream' ? 'Xtream / API' : (p.type === 'm3u8' ? 'M3U8' : 'M3U');
        const isSel = selected === p.id;
        return '<div class="playlist-row' + (isSel ? ' selected' : '') + '" data-id="' + esc(p.id) + '"><div class="pl-main">' +
          '<div class="pl-name">' + esc(p.name) + ' <span class="badge-soft">' + tipo + '</span>' +
          (isSel ? '<span class="badge-soft ok">selecionada</span>' : '') + '</div>' +
          '<div class="pl-url">' + esc(p.url || 'arquivo local') + '</div>' +
          '<div class="small text-secondary mt-1">' + (counts ? counts.channels + ' canais • ' + counts.movies + ' filmes • ' + counts.series + ' séries' : 'não sincronizada') + ' • ' + esc(synced) + '</div>' +
          (p.lastError ? '<div class="small text-danger mt-1">' + esc(p.lastError) + '</div>' : '') +
          '</div>' +
          '<button class="btn-ghost btn-sm" data-select="' + esc(p.id) + '">' + (isSel ? 'Selecionada' : 'Selecionar') + '</button>' +
          '<button class="btn-ghost btn-sm" data-sync="' + esc(p.id) + '">Atualizar</button>' +
          '<button class="btn-ghost btn-sm" data-del="' + esc(p.id) + '">Excluir</button></div>';
      }).join('');
    const allBtn = $('select-all');
    if (allBtn) allBtn.addEventListener('click', () => {
      NovaStore.selectPlaylist(null); Nova.toast('Exibindo todas as playlists.'); render(); changed();
    });
    box.querySelectorAll('[data-select]').forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.dataset.select;
      const p = NovaStore.getPlaylist(id);
      if (!p) return;
      NovaStore.selectPlaylist(id);
      btn.disabled = true;
      Nova.loading.show('Selecionando "' + p.name + '"');
      Nova.loading.step('Atualizando conteúdo...');
      try {
        const counts = await NovaStore.sync(id);
        Nova.loading.step('Salvando no dispositivo...');
        Nova.toast('Playlist "' + p.name + '" pronta: ' + counts.channels + ' canais, ' + counts.movies + ' filmes, ' + counts.series + ' séries.');
        setStatus('Selecionada e atualizada: ' + p.name);
        render(); changed();
        setTimeout(() => { Nova.loading.hide(); modal.hide(); }, 650);
      } catch (e) {
        Nova.loading.hide();
        setStatus('Playlist selecionada, mas a atualização falhou: ' + e.message, true);
        Nova.toast(e.message, 'error');
        render(); changed();
      }
      btn.disabled = false;
    }));
    box.querySelectorAll('[data-sync]').forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.dataset.sync;
      const p = NovaStore.getPlaylist(id);
      if (p.type !== 'xtream' && !p.url) {
        setStatus('Esta playlist veio de arquivo. Reenvie o arquivo para atualizar.', true);
        Nova.toast('Reenvie o arquivo M3U para atualizar.', 'error');
        return;
      }
      btn.disabled = true; btn.textContent = 'ATUALIZANDO...';
      Nova.loading.show('Atualizando "' + p.name + '"');
      Nova.loading.step('Consultando o provedor...');
      setStatus('Atualizando "' + p.name + '"...');
      try {
        const counts = await NovaStore.sync(id);
        Nova.loading.step('Salvando no dispositivo...');
        setStatus('Atualizado: ' + counts.channels + ' canais, ' + counts.movies + ' filmes, ' + counts.series + ' séries.');
        Nova.toast('Playlist atualizada com sucesso.');
        render(); changed();
        setTimeout(() => Nova.loading.hide(), 500);
      } catch (e) {
        Nova.loading.hide();
        setStatus('Falha ao atualizar: ' + e.message, true);
        Nova.toast(e.message, 'error');
        btn.disabled = false; btn.textContent = 'Atualizar';
      }
    }));
    box.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
      if (!confirm('Remover esta playlist e seu conteúdo salvo?')) return;
      NovaStore.removePlaylist(btn.dataset.del);
      Nova.toast('Playlist removida.');
      render(); changed();
    }));
  }

  function setStatus(msg, error) {
    const el = $('playlist-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'small mt-3' + (error ? ' text-danger' : ' text-secondary');
  }

  function activeTab() {
    return $('tab-m3u').classList.contains('active') ? 'm3u' : 'xtream';
  }

  async function add() {
    const btn = $('btn-add-playlist');
    btn.disabled = true; btn.textContent = 'IMPORTANDO...';
    setStatus('');
    let playlist = null, text = null;
    try {
      if (activeTab() === 'm3u') {
        const form = $('form-m3u');
        const name = form.elements.name.value.trim();
        const url = form.elements.url.value.trim();
        const file = form.elements.file.files[0];
        if (!name) throw new Error('Informe o nome da playlist.');
        if (!url && !file) throw new Error('Informe o link ou selecione um arquivo M3U.');
        if (file) {
          text = await file.text();
          playlist = NovaStore.addPlaylist({ name, type: 'm3u', url: '' });
        } else {
          playlist = NovaStore.addPlaylist({ name, type: url.endsWith('.m3u8') ? 'm3u8' : 'm3u', url });
        }
      } else {
        const form = $('form-xtream');
        const name = form.elements.name.value.trim();
        const url = form.elements.url.value.trim();
        const username = form.elements.username.value.trim();
        const password = form.elements.password.value;
        if (!name || !url || !username || !password) throw new Error('Preencha nome, URL do servidor, usuário e senha.');
        playlist = NovaStore.addPlaylist({ name, type: 'xtream', url, username, password });
      }
      NovaStore.selectPlaylist(playlist.id);
      Nova.loading.show('Adicionando "' + playlist.name + '"');
      Nova.loading.step('Conectando ao provedor...');
      const counts = await NovaStore.sync(playlist.id, text);
      Nova.loading.step('Salvando conteúdo no dispositivo...');
      Nova.toast('Importado: ' + counts.channels + ' canais, ' + counts.movies + ' filmes, ' + counts.series + ' séries.');
      document.querySelectorAll('#form-m3u input, #form-xtream input').forEach(i => { i.value = ''; });
      setStatus('Playlist "' + playlist.name + '" salva e selecionada neste dispositivo.');
      render(); changed();
      setTimeout(() => {
        Nova.loading.hide();
        modal.hide();
        if (window.Nova && Nova.go) Nova.go('home');
      }, 900);
    } catch (e) {
      Nova.loading.hide();
      if (playlist) NovaStore.selectPlaylist(playlist.id);
      setStatus(playlist ? 'Playlist salva e selecionada, mas a importação falhou: ' + e.message : e.message, true);
      Nova.toast(e.message, 'error');
      render(); changed();
    }
    btn.disabled = false; btn.textContent = 'Adicionar e importar';
  }

  function init() {
    if (!window.NovaStore) return;
    modal = Nova.modal($('playlists-modal'));
    $('playlists-modal').addEventListener('shown.bs.modal', render);
    $('btn-add-playlist').addEventListener('click', add);
    render();
  }

  window.NovaPlaylists = { open, render };
  window.addEventListener('load', init);
})();
