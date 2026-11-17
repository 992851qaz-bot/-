/* GAMEZH 懸浮程式直接下載
 * 頁面上所有 [data-dl] 連結都會變成「最新版安裝檔」的直接下載：
 *   - 讀 GitHub Releases 最新版，找出 .exe / .msi / .msix
 *   - 填入檔名 [data-dl-name]、大小 [data-dl-size]、版本 [data-dl-ver]
 * 在 Cloudflare（www.992851qaz.workers.dev）上走 /download/windows，GitHub Pages 上直接連到 GitHub 檔案。
 * 讀不到時保留原本的連結（Releases 頁面），不會壞掉。
 */
(function () {
  var REPO = '992851qaz-bot/-';
  var els = [].slice.call(document.querySelectorAll('[data-dl]'));
  if (!els.length && !document.querySelector('[data-latest-ver]')) return;
  var onWorker = !/github\.io$/.test(location.hostname) && location.protocol !== 'file:' && !/^(localhost|127\.)/.test(location.hostname);
  var KEY = 'gamezh.dl.latest';

  function apply(a) {
    if (a.ver) [].forEach.call(document.querySelectorAll('[data-latest-ver]'), function (el) { el.textContent = a.ver; });
    els.forEach(function (el) {
      el.href = onWorker ? 'download/windows' : a.url;
      el.hidden = false;
      el.setAttribute('data-dl-ready', '');
      var n = el.querySelector('[data-dl-name]'); if (n) n.textContent = a.name;
      var s = el.querySelector('[data-dl-size]'); if (s && a.size) s.textContent = Math.round(a.size / 1048576) + ' MB';
      var v = el.querySelector('[data-dl-ver]'); if (v && a.ver) v.textContent = a.ver;
      el.title = '下載 ' + a.name + (a.size ? '（' + Math.round(a.size / 1048576) + ' MB）' : '');
    });
  }

  function fromRelease(rel) {
    var asset = (rel.assets || []).filter(function (x) { return /\.(exe|msi|msix|msixbundle)$/i.test(x.name); })[0];
    if (!asset) return null;
    var m = /v?(\d+(?:\.\d+){1,3})/i.exec((rel.tag_name || '') + ' ' + asset.name);
    return { url: asset.browser_download_url, name: asset.name, size: asset.size, ver: m ? 'v' + m[1] : '' };
  }

  try {
    var c = JSON.parse(sessionStorage.getItem(KEY));
    if (c && Date.now() - c.t < 10 * 60 * 1000) { apply(c.a); return; }
  } catch (e) {}

  fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rel) {
      var a = rel && fromRelease(rel);
      if (!a) return;
      apply(a);
      try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), a: a })); } catch (e) {}
    })
    .catch(function () {});
})();
