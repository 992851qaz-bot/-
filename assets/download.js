/* GAMEZH 懸浮程式下載
 * 頁面上所有 [data-dl] 連結：
 *   1. 讀 GitHub Releases 最新版，填入檔名 [data-dl-name]、大小 [data-dl-size]、版本 [data-dl-ver]/[data-latest-ver]
 *   2. 點下去跳出「選擇下載方式」：直接下載安裝檔／Microsoft Store／Google 雲端（讓玩家自己選）
 * 在 Cloudflare（www.992851qaz.workers.dev）上直接下載走 /download/windows，GitHub Pages 上直接連 GitHub 檔案。
 * 讀不到 GitHub 時，直接下載會改連到 Releases 頁面，不會壞掉。
 */
(function () {
  var REPO = '992851qaz-bot/-';
  var els = [].slice.call(document.querySelectorAll('[data-dl]'));
  if (!els.length && !document.querySelector('[data-latest-ver]')) return;
  var onWorker = !/github\.io$/.test(location.hostname) && location.protocol !== 'file:' && !/^(localhost|127\.)/.test(location.hostname);
  var KEY = 'gamezh.dl.latest';

  var latest = null;
  function apply(a) {
    latest = a;
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


  // ---------- 選擇下載方式 ----------
  var STORE = 'https://apps.microsoft.com/detail/9N19LCKX2NSW';
  var DRIVE = 'https://drive.google.com/drive/folders/17pFcXxshUHvVkvNWgxLp6Lpw0tpbyRNR?usp=sharing';
  var DISCORD = 'https://discord.gg/WWewHKwMwa';
  var RELEASES = 'https://github.com/' + REPO + '/releases/latest';
  var ICON = {
    dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    ms: '<path d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z" fill="currentColor" stroke="none"/>',
    drive: '<path d="M8 3h8l6 10-4 7H6l-4-7z"/><path d="M8 3l6 10H2M16 3l-6 10 4 7M22 13h-8"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  function svg(k, size) { return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>'; }

  var css = '' +
    '.gzdl-bg{position:fixed;inset:0;z-index:200;background:rgba(4,6,12,.72);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .18s}' +
    '.gzdl-bg.open{opacity:1}' +
    '.gzdl{width:100%;max-width:520px;max-height:92dvh;overflow:auto;background:#141a2f;border:1px solid rgba(232,214,170,.32);border-bottom:0;color:#f1eee6;' +
      'font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;' +
      'padding:10px max(20px,env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));transform:translateY(24px);transition:transform .22s cubic-bezier(.16,1,.3,1)}' +
    '.gzdl-bg.open .gzdl{transform:none}' +
    '@media(min-width:600px){.gzdl-bg{align-items:center;padding:24px}.gzdl{border-bottom:1px solid rgba(232,214,170,.32);padding-bottom:22px}}' +
    '.gzdl-grab{width:40px;height:4px;background:#3a3f55;margin:2px auto 12px}@media(min-width:600px){.gzdl-grab{display:none}}' +
    '.gzdl-hd{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px}' +
    '.gzdl-hd h3{margin:0;flex:1;font:900 21px/1.35 "Noto Serif TC","Songti TC",serif;letter-spacing:.02em}' +
    '.gzdl-hd p{margin:2px 0 0;font-size:13px;color:#a3a6b6}' +
    '.gzdl-x{flex:none;width:40px;height:40px;display:grid;place-items:center;background:none;border:0;color:#a3a6b6;cursor:pointer}' +
    '.gzdl-opt{display:grid;grid-template-columns:44px 1fr auto;gap:14px;align-items:center;padding:14px 16px;margin-top:10px;border:1px solid rgba(232,214,170,.18);background:rgba(255,255,255,.02);color:inherit;text-decoration:none;transition:border-color .15s,background .15s}' +
    '.gzdl-opt:hover,.gzdl-opt:focus-visible{border-color:#e3cd9a;background:rgba(227,205,154,.07);outline:none}' +
    '.gzdl-opt .ic{width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(232,214,170,.32);color:#e3cd9a}' +
    '.gzdl-opt.main{border-color:rgba(227,205,154,.55);background:linear-gradient(90deg,rgba(227,205,154,.12),rgba(227,205,154,.03))}' +
    '.gzdl-opt.main .ic{background:#e3cd9a;color:#1a1508;border-color:#e3cd9a}' +
    '.gzdl-opt b{display:block;font-size:16px}' +
    '.gzdl-opt small{display:block;font-size:12.5px;color:#a3a6b6;line-height:1.45;word-break:break-all}' +
    '.gzdl-opt .tag{font-size:11px;letter-spacing:.06em;padding:2px 8px;border:1px solid currentColor;color:#e3cd9a;white-space:nowrap}' +
    '.gzdl-opt .arrow{color:#6f7386;font-size:18px}' +
    '.gzdl-ft{margin-top:16px;padding-top:14px;border-top:1px solid rgba(232,214,170,.16);font-size:13px;color:#a3a6b6}' +
    '.gzdl-ft a{color:#5cc8ff;text-decoration:underline;text-underline-offset:3px}' +
    'body.gzdl-lock{overflow:hidden}' +
    '@media(prefers-reduced-motion:reduce){.gzdl-bg,.gzdl{transition:none}}';

  var bg = null, lastFocus = null;
  function sizeText(a) { return a && a.size ? Math.round(a.size / 1048576) + ' MB' : ''; }
  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    bg = document.createElement('div');
    bg.className = 'gzdl-bg'; bg.hidden = true;
    bg.innerHTML =
      '<div class="gzdl" role="dialog" aria-modal="true" aria-labelledby="gzdl-t">' +
        '<div class="gzdl-grab" aria-hidden="true"></div>' +
        '<div class="gzdl-hd"><div><h3 id="gzdl-t">選擇下載方式</h3><p>GameZH 聲骸評分 HUD · <span data-gz="ver">最新版</span> · Windows</p></div>' +
        '<button type="button" class="gzdl-x" aria-label="關閉">' + svg('x', 20) + '</button></div>' +
        '<a class="gzdl-opt main" data-gz="direct" href="' + RELEASES + '">' +
          '<span class="ic">' + svg('dl') + '</span>' +
          '<span><b>直接下載安裝檔</b><small data-gz="file">最快，下載完直接安裝</small></span><span class="tag">推薦</span></a>' +
        '<a class="gzdl-opt" href="' + STORE + '" target="_blank" rel="noopener">' +
          '<span class="ic">' + svg('ms') + '</span>' +
          '<span><b>Microsoft Store</b><small>從微軟商城安裝，之後會自動更新</small></span><span class="arrow">↗</span></a>' +
        '<a class="gzdl-opt" href="' + DRIVE + '" target="_blank" rel="noopener">' +
          '<span class="ic">' + svg('drive') + '</span>' +
          '<span><b>Google 雲端硬碟</b><small>備用載點，另外兩個連不上時用</small></span><span class="arrow">↗</span></a>' +
        '<p class="gzdl-ft">裝好後到 <a href="' + DISCORD + '" target="_blank" rel="noopener">Discord 群組</a> 輸入 /授權碼 領授權碼，就能開始用。</p>' +
      '</div>';
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) {
      if (e.target === bg || e.target.closest('.gzdl-x')) close();
      else if (e.target.closest('.gzdl-opt')) setTimeout(close, 150);
    });
    document.addEventListener('keydown', function (e) {
      if (bg.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { // 焦點留在視窗裡
        var f = bg.querySelectorAll('a,button'), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
  function open(trigger) {
    if (!bg) build();
    var direct = bg.querySelector('[data-gz="direct"]');
    if (latest) {
      direct.href = onWorker ? 'download/windows' : latest.url;
      bg.querySelector('[data-gz="file"]').textContent = latest.name + (sizeText(latest) ? ' · ' + sizeText(latest) : '');
      if (latest.ver) bg.querySelector('[data-gz="ver"]').textContent = latest.ver;
    } else {
      direct.href = onWorker ? 'download/windows' : RELEASES;
    }
    lastFocus = trigger;
    bg.hidden = false; document.body.classList.add('gzdl-lock');
    requestAnimationFrame(function () { bg.classList.add('open'); direct.focus(); });
  }
  function close() {
    bg.classList.remove('open'); document.body.classList.remove('gzdl-lock');
    setTimeout(function () { bg.hidden = true; }, 180);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  els.forEach(function (el) {
    el.setAttribute('aria-haspopup', 'dialog');
    el.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return; // 讓進階使用者用新分頁直接開
      e.preventDefault();
      open(el);
    });
  });

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
