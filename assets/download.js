/* GAMEZH 懸浮程式下載
 * 頁面上所有 [data-dl] 連結：
 *   1. 讀 GitHub Releases 最新版，填入檔名 [data-dl-name]、大小 [data-dl-size]、版本 [data-dl-ver]/[data-latest-ver]
 *   2. 點下去跳出「選擇下載方式」
 *      - 電腦：Microsoft Store（推薦）／直接下載安裝檔／Google 雲端／「我不是電腦，切換為手機」
 *      - 手機：Google Play 安裝／APK 下載／雲端下載（手機版測試中 → 填 Email 申請測試資格）／「我不是手機，切換為電腦」
 *   3. 申請測試資格送到 Cloudflare Worker 的 /api/beta，由伺服器轉給 Discord。
 *      Discord Webhook 只存在 Cloudflare 的加密變數裡，網頁原始碼看不到。
 */
(function () {
  var REPO = '992851qaz-bot/-';
  var BETA_API = 'https://www.992851qaz.workers.dev/api/beta';
  var STORE = 'https://apps.microsoft.com/detail/9N19LCKX2NSW';
  var DRIVE = 'https://drive.google.com/drive/folders/17pFcXxshUHvVkvNWgxLp6Lpw0tpbyRNR?usp=sharing';
  var DISCORD = 'https://discord.gg/WWewHKwMwa';
  var RELEASES = 'https://github.com/' + REPO + '/releases/latest';
  var KEY = 'gamezh.dl.latest';
  var BETA_KEY = 'gamezh.beta.sent';

  var els = [].slice.call(document.querySelectorAll('[data-dl]'));
  if (!els.length && !document.querySelector('[data-latest-ver]')) return;
  var onWorker = !/github\.io$/.test(location.hostname) && location.protocol !== 'file:' && !/^(localhost|127\.)/.test(location.hostname);
  var isPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // ---------- 最新版資訊 ----------
  var latest = null;
  function sizeText(a) { return a && a.size ? Math.round(a.size / 1048576) + ' MB' : ''; }
  function apply(a) {
    latest = a;
    if (a.ver) [].forEach.call(document.querySelectorAll('[data-latest-ver]'), function (el) { el.textContent = a.ver; });
    els.forEach(function (el) {
      el.href = onWorker ? 'download/windows' : a.url;
      el.hidden = false;
      el.setAttribute('data-dl-ready', '');
      var n = el.querySelector('[data-dl-name]'); if (n) n.textContent = a.name;
      var s = el.querySelector('[data-dl-size]'); if (s && a.size) s.textContent = sizeText(a);
      var v = el.querySelector('[data-dl-ver]'); if (v && a.ver) v.textContent = a.ver;
    });
  }
  function fromRelease(rel) {
    var asset = (rel.assets || []).filter(function (x) { return /\.(exe|msi|msix|msixbundle)$/i.test(x.name); })[0];
    if (!asset) return null;
    var m = /v?(\d+(?:\.\d+){1,3})/i.exec((rel.tag_name || '') + ' ' + asset.name);
    return { url: asset.browser_download_url, name: asset.name, size: asset.size, ver: m ? 'v' + m[1] : '' };
  }

  // ---------- 視窗 ----------
  var ICON = {
    dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    ms: '<path d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z" fill="currentColor" stroke="none"/>',
    drive: '<path d="M8 3h8l6 10-4 7H6l-4-7z"/><path d="M8 3l6 10H2M16 3l-6 10 4 7M22 13h-8"/>',
    play: '<path d="M5 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 5 3.5z"/>',
    apk: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3M10 18h4"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    pc: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  function svg(k, size) { return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var css = '' +
    '.gzdl-bg{position:fixed;inset:0;z-index:200;background:rgba(4,6,12,.72);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .18s}' +
    '.gzdl-bg[hidden]{display:none!important}' +
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
    '.gzdl-x,.gzdl-back{flex:none;width:40px;height:40px;display:grid;place-items:center;background:none;border:0;color:#a3a6b6;cursor:pointer}' +
    '.gzdl-back{margin-left:-10px}' +
    '.gzdl-opt{display:grid;grid-template-columns:44px 1fr auto;gap:14px;align-items:center;width:100%;padding:14px 16px;margin-top:10px;border:1px solid rgba(232,214,170,.18);background:rgba(255,255,255,.02);color:inherit;font:inherit;text-align:left;text-decoration:none;cursor:pointer;transition:border-color .15s,background .15s}' +
    '.gzdl-opt:hover,.gzdl-opt:focus-visible{border-color:#e3cd9a;background:rgba(227,205,154,.07);outline:none}' +
    '.gzdl-opt .ic{width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(232,214,170,.32);color:#e3cd9a}' +
    '.gzdl-opt.main{border-color:rgba(227,205,154,.55);background:linear-gradient(90deg,rgba(227,205,154,.12),rgba(227,205,154,.03))}' +
    '.gzdl-opt.main .ic{background:#e3cd9a;color:#1a1508;border-color:#e3cd9a}' +
    '.gzdl-opt b{display:block;font-size:16px}' +
    '.gzdl-opt small{display:block;font-size:12.5px;color:#a3a6b6;line-height:1.45;word-break:break-all}' +
    '.gzdl-opt .tag{font-size:11px;letter-spacing:.06em;padding:2px 8px;border:1px solid currentColor;color:#e3cd9a;white-space:nowrap}' +
    '.gzdl-opt .arrow{color:#6f7386;font-size:18px}' +
    '.gzdl-swap{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;margin-top:12px;background:none;border:1px dashed rgba(232,214,170,.28);color:#a3a6b6;font:inherit;font-size:14px;cursor:pointer}' +
    '.gzdl-swap:hover,.gzdl-swap:focus-visible{color:#f1eee6;border-color:#e3cd9a;outline:none}' +
    '.gzdl-note{margin:0 0 4px;padding:10px 12px;background:rgba(92,200,255,.08);border:1px solid rgba(92,200,255,.28);color:#bfe8ff;font-size:13.5px}' +
    '.gzdl-form label{display:block;margin:14px 0 6px;font-size:14px;font-weight:600}' +
    '.gzdl-form input[type=email]{width:100%;padding:12px 14px;border:1px solid rgba(232,214,170,.25);background:#0b0e17;color:#f1eee6;font:inherit;font-size:16px;border-radius:0}' +
    '.gzdl-form input[type=email]:focus{outline:none;border-color:#e3cd9a}' +
    '.gzdl-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
    '.gzdl-agree{display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12.5px;color:#a3a6b6}' +
    '.gzdl-agree input{margin-top:3px}' +
    '.gzdl-submit{width:100%;min-height:50px;margin-top:14px;border:0;background:#e3cd9a;color:#1a1508;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer}' +
    '.gzdl-submit:disabled{opacity:.5;cursor:not-allowed}' +
    '.gzdl-msg{min-height:20px;margin:10px 0 0;font-size:13.5px}.gzdl-msg.err{color:#ff8a8a}.gzdl-msg.ok{color:#3fd28c}' +
    '.gzdl-ft{margin-top:16px;padding-top:14px;border-top:1px solid rgba(232,214,170,.16);font-size:13px;color:#a3a6b6}' +
    '.gzdl-ft a{color:#5cc8ff;text-decoration:underline;text-underline-offset:3px}' +
    'body.gzdl-lock{overflow:hidden}' +
    '@media(prefers-reduced-motion:reduce){.gzdl-bg,.gzdl{transition:none}}';

  var bg = null, box = null, lastFocus = null, closeTimer = 0, mode = isPhone ? 'phone' : 'pc';

  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    bg = document.createElement('div');
    bg.className = 'gzdl-bg'; bg.hidden = true;
    bg.innerHTML = '<div class="gzdl" role="dialog" aria-modal="true" aria-labelledby="gzdl-t"></div>';
    box = bg.firstChild;
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) {
      if (e.target === bg || e.target.closest('.gzdl-x')) { close(); return; }
      var sw = e.target.closest('[data-swap]'); if (sw) { mode = sw.getAttribute('data-swap'); render(); focusFirst(); return; }
      var bk = e.target.closest('.gzdl-back'); if (bk) { render(); focusFirst(); return; }
      var beta = e.target.closest('[data-beta]'); if (beta) { renderBeta(beta.getAttribute('data-beta')); return; }
      if (e.target.closest('a.gzdl-opt')) setTimeout(close, 150);
    });
    document.addEventListener('keydown', function (e) {
      if (!bg || bg.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        var f = box.querySelectorAll('a,button,input'), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  function head(title, sub, back) {
    return '<div class="gzdl-grab" aria-hidden="true"></div><div class="gzdl-hd">' +
      (back ? '<button type="button" class="gzdl-back" aria-label="返回">' + svg('back', 22) + '</button>' : '') +
      '<div style="flex:1"><h3 id="gzdl-t">' + title + '</h3><p>' + sub + '</p></div>' +
      '<button type="button" class="gzdl-x" aria-label="關閉">' + svg('x', 20) + '</button></div>';
  }
  function opt(tag, attrs, icon, title, sub, right, main) {
    return '<' + tag + ' class="gzdl-opt' + (main ? ' main' : '') + '" ' + attrs + '><span class="ic">' + svg(icon) + '</span><span><b>' + title + '</b><small>' + sub + '</small></span>' + right + '</' + tag + '>';
  }

  function render() {
    var ver = latest && latest.ver ? latest.ver : '最新版';
    if (mode === 'pc') {
      var direct = onWorker ? 'download/windows' : (latest ? latest.url : RELEASES);
      var file = latest ? esc(latest.name) + (sizeText(latest) ? ' · ' + sizeText(latest) : '') : '下載安裝檔自己安裝';
      box.innerHTML = head('選擇下載方式', 'GameZH 懸浮分析 · ' + esc(ver) + ' · Windows 電腦') +
        opt('a', 'href="' + STORE + '" target="_blank" rel="noopener"', 'ms', 'Microsoft Store', '經微軟審核，安裝後會自動更新', '<span class="tag">推薦</span>', true) +
        opt('a', 'href="' + direct + '"', 'dl', '直接下載安裝檔', file, '<span class="arrow">↓</span>') +
        opt('a', 'href="' + DRIVE + '" target="_blank" rel="noopener"', 'drive', 'Google 雲端硬碟', '備用載點，另外兩個連不上時用', '<span class="arrow">↗</span>') +
        '<button type="button" class="gzdl-swap" data-swap="phone">' + svg('phone', 18) + '我不是電腦，切換為手機選項</button>' +
        '<p class="gzdl-ft">裝好後到 <a href="' + DISCORD + '" target="_blank" rel="noopener">Discord 群組</a> 輸入 /授權碼 領授權碼，就能開始用。</p>';
    } else {
      box.innerHTML = head('選擇下載方式', 'GameZH 手機版 · 測試中') +
        '<p class="gzdl-note">手機版目前封閉測試中，選一個安裝方式後留下 Email，開放測試時會優先通知你。</p>' +
        opt('button', 'type="button" data-beta="Google Play"', 'play', 'Google Play 安裝', '加入測試名單，從 Play 商店安裝', '<span class="tag">推薦</span>', true) +
        opt('button', 'type="button" data-beta="APK"', 'apk', 'APK 下載', '直接安裝檔（Android）', '<span class="arrow">›</span>') +
        opt('button', 'type="button" data-beta="雲端下載"', 'drive', '雲端下載', '從雲端硬碟下載', '<span class="arrow">›</span>') +
        '<button type="button" class="gzdl-swap" data-swap="pc">' + svg('pc', 18) + '我不是手機，切換為電腦選項</button>' +
        '<p class="gzdl-ft">現在就想用？手機可以先用 <a href="20260828.html">網頁版聲骸分析儀</a>，免安裝。</p>';
    }
  }

  function renderBeta(channel) {
    var sent = ls(BETA_KEY);
    box.innerHTML = head('申請手機版測試', '安裝方式：' + esc(channel), true) +
      '<form class="gzdl-form" novalidate>' +
        '<p class="gzdl-note">手機版還在測試，留下 Email，開放 <b>' + esc(channel) + '</b> 測試時會寄通知給你。只用來通知測試資格，不會拿去做其他用途。</p>' +
        '<label for="gzdl-email">Email</label>' +
        '<input type="email" id="gzdl-email" name="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@example.com">' +
        '<input class="gzdl-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<label class="gzdl-agree"><input type="checkbox" name="agree" required> 我同意 GAMEZH 用這個 Email 通知我測試資格</label>' +
        '<button type="submit" class="gzdl-submit" disabled>送出申請</button>' +
        '<p class="gzdl-msg" role="status" aria-live="polite">' + (sent ? '你之前已經申請過了，再送一次也可以。' : '') + '</p>' +
      '</form>';
    var form = box.querySelector('form'), email = form.email, agree = form.agree, btn = form.querySelector('.gzdl-submit'), msg = form.querySelector('.gzdl-msg');
    var opened = Date.now();
    function valid() { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()) && email.value.length <= 254 && agree.checked; }
    function upd() { btn.disabled = !valid(); }
    email.addEventListener('input', upd); agree.addEventListener('change', upd);
    setTimeout(function () { email.focus(); }, 60);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valid()) return;
      var last = parseInt(ls('gamezh.beta.ts'), 10);
      if (last && Date.now() - last < 60000) { msg.className = 'gzdl-msg err'; msg.textContent = '剛剛才送出過，請一分鐘後再試。'; return; }
      btn.disabled = true; btn.textContent = '送出中…'; msg.className = 'gzdl-msg'; msg.textContent = '';
      fetch(BETA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.value.trim(), channel: channel, website: form.website.value, elapsed: Date.now() - opened, page: location.pathname, ua: navigator.userAgent.slice(0, 200) })
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j && res.j.error || ('HTTP ' + res.status));
          ls(BETA_KEY, '1'); ls('gamezh.beta.ts', String(Date.now()));
          msg.className = 'gzdl-msg ok'; msg.textContent = '申請成功！開放測試時會寄信通知你。';
          btn.textContent = '已送出';
        })
        .catch(function (err) {
          msg.className = 'gzdl-msg err';
          msg.innerHTML = (/429|太頻繁/.test(String(err && err.message)) ? '送出太頻繁，請稍後再試。' : '目前無法送出，請稍後再試，或直接到 <a href="' + DISCORD + '" target="_blank" rel="noopener" style="color:#5cc8ff">Discord 群組</a> 申請。');
          btn.textContent = '送出申請'; upd();
        });
    });
  }

  function focusFirst() { var f = box.querySelector('.gzdl-opt,.gzdl-swap'); if (f) f.focus(); }
  function open(trigger) {
    if (!bg) build();
    clearTimeout(closeTimer);
    mode = isPhone ? 'phone' : 'pc';
    render();
    lastFocus = trigger;
    bg.hidden = false; document.body.classList.add('gzdl-lock');
    requestAnimationFrame(function () { bg.classList.add('open'); focusFirst(); });
  }
  function close() {
    if (!bg || bg.hidden) return;
    bg.classList.remove('open'); document.body.classList.remove('gzdl-lock');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () { bg.hidden = true; box.innerHTML = ''; }, 180);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  els.forEach(function (el) {
    el.setAttribute('aria-haspopup', 'dialog');
    el.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
      e.preventDefault();
      open(el);
    });
  });

  // ---------- 讀最新版 ----------
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
