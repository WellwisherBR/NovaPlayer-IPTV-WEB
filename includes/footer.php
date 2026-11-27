<?php /** Rodapé e carregamento de scripts — modo local. */ ?>
<footer class="app-footer">
  <div class="footer-left">
    <span class="status-dot" id="conn-dot"></span><span id="conn-label">Pronto</span>
    <span class="footer-sep">•</span><span id="footer-playlists">0 playlists</span>
    <span class="footer-sep">•</span><span>Dados salvos neste dispositivo</span>
  </div>
  <div class="footer-right">
    <span><?= e(APP_NAME) ?> <?= e(APP_VERSION) ?></span><span class="footer-sep">•</span>
    <span class="footer-terms">Uso licenciado. Sem contas ou coleta de dados.</span>
  </div>
</footer>

<script src="<?= e(asset('js/vendor/bootstrap.bundle.min.js') . '?v=' . APP_BUILD) ?>"></script>
<script src="<?= e(asset('js/vendor/hls.min.js') . '?v=' . APP_BUILD) ?>"></script>
<script src="<?= e(asset('js/vendor/video.min.js') . '?v=' . APP_BUILD) ?>"></script>
<script>window.NOVAPLAY = <?= json_encode(['base' => APP_URL, 'page' => $pageId, 'name' => APP_NAME, 'version' => APP_VERSION], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;</script>
<script src="<?= e(asset('js/app.js') . '?v=' . APP_BUILD) ?>"></script>
<script src="<?= e(asset('js/store.js') . '?v=' . APP_BUILD) ?>"></script>
<script src="<?= e(asset('js/playlists.js') . '?v=' . APP_BUILD) ?>"></script>
<script src="<?= e(asset('js/player.js') . '?v=' . APP_BUILD) ?>"></script>
<?php foreach ($pageScripts as $script): ?>
<script src="<?= e(asset('js/' . $script) . '?v=' . APP_BUILD) ?>"></script>
<?php endforeach; ?>
</body>
</html>
