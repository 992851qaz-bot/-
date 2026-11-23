/* GAMEZH 英文版應援
 * 英文版 HUD 還在應援階段：英文模式下，所有下載按鈕 [data-dl] 和 [data-cheer] 都會打開應援表單。
 * 表單送到 Cloudflare Worker 的 /api/cheer，由伺服器轉給 Discord；Webhook 只存在 Cloudflare 的加密變數裡，網頁原始碼看不到。
 * 送出成功後在這台裝置的瀏覽器記一筆（localStorage），之後不能再應援，只會顯示「已應援」。
 */
(function () {
  var onWorker = /(^|\.)992851qaz\.workers\.dev$/.test(location.hostname);
  var API = onWorker ? '/api/cheer' : 'https://www.992851qaz.workers.dev/api/cheer';
  var SENT_KEY = 'gamezh.cheer.sent';
  var DISCORD = 'https://discord.gg/WWewHKwMwa';
  var STORE = 'https://apps.microsoft.com/detail/9N19LCKX2NSW';
  var SOURCES = [
    ['YouTube', 'YouTube'], ['Discord', 'Discord'], ['Reddit', 'Reddit'], ['X / Twitter', 'X / Twitter'],
    ['Google', 'Google 搜尋'], ['Friend', '朋友介紹'], ['Bahamut', '巴哈姆特'], ['Other', '其他']
  ];

  function L() { return window.GZ_I18N ? window.GZ_I18N.lang : 'zh'; }
  function t(zh, en) { return L() === 'en' ? en : zh; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function sent() { return !!ls(SENT_KEY); }

  var css = '' +
    '.gzc-bg{position:fixed;inset:0;z-index:210;background:rgba(4,6,12,.74);display:flex;align-items:flex-end;justify-content:center}' +
    '.gzc-bg[hidden]{display:none!important}' +
    '.gzc{position:relative;width:100%;max-width:540px;max-height:94dvh;overflow:auto;background:#141a2f;border:1px solid rgba(232,214,170,.32);border-bottom:0;color:#f1eee6;' +
      'font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;' +
      'padding:18px max(20px,env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left))}' +
    '@media(min-width:600px){.gzc-bg{align-items:center;padding:24px}.gzc{border-bottom:1px solid rgba(232,214,170,.32);padding:24px 26px}}' +
    '.gzc-hd{display:flex;gap:10px;align-items:flex-start;margin-bottom:6px}' +
    '.gzc-hd h3{flex:1;margin:0;font:900 22px/1.3 "Noto Serif TC","Songti TC",Georgia,serif}' +
    '.gzc-x{flex:none;width:40px;height:40px;margin:-6px -8px 0 0;display:grid;place-items:center;background:none;border:0;color:#a3a6b6;font-size:20px;cursor:pointer}' +
    '.gzc-sub{margin:0 0 6px;color:#a3a6b6;font-size:14px}' +
    '.gzc-badge{display:inline-block;margin-bottom:10px;padding:2px 10px;border:1px solid #ffd23f;color:#ffd23f;font-size:12px;letter-spacing:.08em}' +
    '.gzc label.f,.gzc .f{display:block;margin:16px 0 6px;font-size:14px;font-weight:600}' +
    '.gzc .f em{font-style:normal;font-weight:400;color:#6f7386;margin-left:6px;font-size:12.5px}' +
    '.gzc textarea,.gzc input[type=text]{width:100%;padding:11px 13px;border:1px solid rgba(232,214,170,.25);background:#0b0e17;color:#f1eee6;font:inherit;font-size:16px;border-radius:0}' +
    '.gzc textarea{min-height:96px;resize:vertical}' +
    '.gzc textarea:focus,.gzc input[type=text]:focus{outline:none;border-color:#e3cd9a}' +
    '.gzc-count{text-align:right;font-size:12px;color:#6f7386;margin-top:2px}' +
    '.gzc-src{display:flex;flex-wrap:wrap;gap:8px}' +
    '.gzc-src label{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 12px;border:1px solid rgba(232,214,170,.22);font-size:14px;cursor:pointer;user-select:none}' +
    '.gzc-src input{accent-color:#e3cd9a;width:16px;height:16px;margin:0}' +
    '.gzc-src label:has(input:checked){border-color:#e3cd9a;background:rgba(227,205,154,.1)}' +
    '.gzc-row{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}@media(max-width:480px){.gzc-row{grid-template-columns:1fr}}' +
    '.gzc-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
    '.gzc-privacy{margin-top:18px;padding:12px 14px;border-left:2px solid #c9ad6f;background:rgba(227,205,154,.06);font-size:12.5px;line-height:1.6;color:#a3a6b6}' +
    '.gzc-privacy b{color:#f1eee6}' +
    '.gzc-privacy ul{margin:6px 0 0;padding-left:18px}' +
    '.gzc-agree{display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13.5px;cursor:pointer}' +
    '.gzc-agree input{margin-top:4px;accent-color:#e3cd9a}' +
    '.gzc-submit{width:100%;min-height:52px;margin-top:14px;border:0;background:#e3cd9a;color:#1a1508;font:inherit;font-size:16px;font-weight:700;cursor:pointer}' +
    '.gzc-submit:disabled{opacity:.45;cursor:not-allowed}' +
    '.gzc-msg{min-height:20px;margin:10px 0 0;font-size:13.5px}.gzc-msg.err{color:#ff8a8a}' +
    '.gzc-done{text-align:center;padding:18px 0 6px}' +
    '.gzc-done .big{font-size:46px;line-height:1}' +
    '.gzc-done h3{margin:12px 0 6px;font:900 22px/1.3 "Noto Serif TC",Georgia,serif}' +
    '.gzc-done p{color:#a3a6b6;margin:0 0 14px}' +
    '.gzc-ft{margin-top:16px;padding-top:12px;border-top:1px solid rgba(232,214,170,.16);font-size:13px;color:#a3a6b6}' +
    '.gzc-ft a{color:#5cc8ff;text-decoration:underline;text-underline-offset:3px}' +
    '.gzc a.btnl{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border:1px solid rgba(232,214,170,.32);color:#f1eee6;text-decoration:none}' +
    'body.gzc-lock{overflow:hidden}';

  var bg, box, lastFocus, openedAt = 0;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    bg = document.createElement('div'); bg.className = 'gzc-bg'; bg.hidden = true;
    bg.innerHTML = '<div class="gzc" role="dialog" aria-modal="true" aria-labelledby="gzc-t"></div>';
    box = bg.firstChild;
    document.body.appendChild(bg);
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('.gzc-x,[data-gzc-close]')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) close(); });
  }

  function footer() {
    return '<div class="gzc-ft">' + t(
      '急著用？中文版現在就能下載：<a href="' + STORE + '" target="_blank" rel="noopener">Microsoft Store</a> · <a href="' + DISCORD + '" target="_blank" rel="noopener">Discord</a>',
      'Can\'t wait? The Chinese version is available now: <a href="' + STORE + '" target="_blank" rel="noopener">Microsoft Store</a> · Updates on <a href="' + DISCORD + '" target="_blank" rel="noopener">Discord</a>'
    ) + '</div>';
  }

  function renderDone(justNow) {
    box.innerHTML =
      '<div class="gzc-hd"><span style="flex:1"></span><button type="button" class="gzc-x" aria-label="' + t('關閉', 'Close') + '">✕</button></div>' +
      '<div class="gzc-done"><div class="big" aria-hidden="true">💛</div>' +
      '<h3 id="gzc-t">' + (justNow ? t('收到你的應援了！', 'Thanks for cheering!') : t('你已經應援過了', 'You\'ve already cheered')) + '</h3>' +
      '<p>' + t('每個裝置只能應援一次。英文版上線時會在 Discord 公告。', 'Each device can cheer once. We\'ll announce the English release on Discord.') + '</p>' +
      '<a class="btnl" href="' + DISCORD + '" target="_blank" rel="noopener">' + t('加入 Discord 等通知', 'Join Discord for updates') + '</a></div>' +
      footer();
    var x = box.querySelector('.gzc-x'); if (x) x.focus();
  }

  function renderForm() {
    var src = SOURCES.map(function (s, i) {
      return '<label><input type="checkbox" name="src" value="' + esc(s[0]) + '">' + esc(t(s[1], s[0])) + '</label>';
    }).join('');
    box.innerHTML =
      '<div class="gzc-hd"><h3 id="gzc-t">' + t('應援英文版 HUD', 'Cheer for the English HUD') + '</h3><button type="button" class="gzc-x" aria-label="' + t('關閉', 'Close') + '">✕</button></div>' +
      '<span class="gzc-badge">' + t('英文版開發中', 'ENGLISH VERSION IN DEVELOPMENT') + '</span>' +
      '<p class="gzc-sub">' + t('英文版還在準備中。應援的人越多，我們就越快推出。', 'The HUD is Chinese-only for now. The more cheers we get, the sooner the English version ships.') + '</p>' +
      '<form novalidate>' +
        '<label class="f" for="gzc-why">' + t('為什麼想用？', 'Why do you want it?') + '</label>' +
        '<textarea id="gzc-why" maxlength="500" required placeholder="' + esc(t('例：想刷聲骸時不用切視窗算分數', 'e.g. I want to score Echoes without alt-tabbing to a calculator')) + '"></textarea>' +
        '<div class="gzc-count"><span id="gzc-n">0</span> / 500</div>' +
        '<span class="f">' + t('從哪裡知道我們？', 'How did you hear about us?') + '<em>' + t('可複選', 'Pick any') + '</em></span>' +
        '<div class="gzc-src">' + src + '</div>' +
        '<div class="gzc-row">' +
          '<div><label class="f" for="gzc-nick">' + t('暱稱', 'Nickname') + '<em>' + t('選填', 'optional') + '</em></label><input type="text" id="gzc-nick" maxlength="40" autocomplete="nickname"></div>' +
          '<div><label class="f" for="gzc-contact">' + t('聯絡方式', 'Contact') + '<em>' + t('選填', 'optional') + '</em></label><input type="text" id="gzc-contact" maxlength="100" autocomplete="off" placeholder="' + esc(t('Discord ID 或 Email', 'Discord ID or email')) + '"></div>' +
        '</div>' +
        '<input class="gzc-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<div class="gzc-privacy"><b>' + t('資料使用聲明', 'How we use your data') + '</b><ul>' +
          '<li>' + t('你填的內容（想用的原因、得知來源、暱稱、聯絡方式）會傳到 GAMEZH 開發團隊的私人 Discord 頻道，只用來評估英文版需求，以及在上線時通知你（有留聯絡方式才會）。', 'What you enter (reason, how you found us, nickname, contact) is sent to the GAMEZH team\'s private Discord channel. We use it only to gauge demand for the English version and, if you left contact info, to tell you when it launches.') + '</li>' +
          '<li>' + t('另外會附上你的國家/地區（由連線推算，不會傳送 IP 位址）與目前頁面語言，用來了解需求來自哪裡。', 'We also include your country/region (derived from the connection; your IP address itself is not sent) and the page language, to see where demand comes from.') + '</li>' +
          '<li>' + t('不會出售、公開或分享給第三方。想刪除資料，到 Discord 私訊開發者即可。', 'We never sell, publish or share it with third parties. To have it deleted, message the developer on Discord.') + '</li>' +
          '<li>' + t('暱稱與聯絡方式都可以不填。這台裝置的瀏覽器會記住你已應援，避免重複送出。', 'Nickname and contact are optional. This browser remembers that you cheered so the same device can\'t cheer twice.') + '</li>' +
        '</ul></div>' +
        '<label class="gzc-agree"><input type="checkbox" id="gzc-ok"><span>' + t('我已閱讀並同意上述資料使用方式', 'I\'ve read and agree to how my data is used') + '</span></label>' +
        '<p class="gzc-msg" id="gzc-msg" role="status" aria-live="polite"></p>' +
        '<button type="submit" class="gzc-submit" disabled>' + t('送出應援 💛', 'Send my cheer 💛') + '</button>' +
      '</form>' + footer();

    var form = box.querySelector('form'), why = box.querySelector('#gzc-why'), ok = box.querySelector('#gzc-ok');
    var btn = box.querySelector('.gzc-submit'), msg = box.querySelector('#gzc-msg');
    function upd() {
      box.querySelector('#gzc-n').textContent = why.value.length;
      btn.disabled = why.value.trim().length < 3 || !ok.checked;
    }
    why.addEventListener('input', upd); ok.addEventListener('change', upd);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      if (sent()) { renderDone(false); return; }
      var srcs = [].map.call(box.querySelectorAll('input[name=src]:checked'), function (c) { return c.value; });
      var body = {
        reason: why.value.trim(),
        sources: srcs,
        nickname: box.querySelector('#gzc-nick').value.trim(),
        contact: box.querySelector('#gzc-contact').value.trim(),
        lang: L(),
        page: location.pathname.split('/').pop() || 'index.html',
        website: form.querySelector('.gzc-hp').value,
        elapsed: Date.now() - openedAt
      };
      btn.disabled = true; btn.textContent = t('送出中…', 'Sending…'); msg.className = 'gzc-msg'; msg.textContent = '';
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then(function () {
          ls(SENT_KEY, String(Date.now()));
          markButtons();
          renderDone(true);
        })
        .catch(function (err) {
          msg.className = 'gzc-msg err';
          msg.textContent = /429/.test(String(err && err.message))
            ? t('送出太頻繁，請稍後再試。', 'Too many attempts. Please try again in a few minutes.')
            : t('目前無法送出，請稍後再試。', 'Couldn\'t send right now. Please try again later.');
          btn.textContent = t('送出應援 💛', 'Send my cheer 💛'); upd();
        });
    });
    setTimeout(function () { why.focus(); }, 30);
  }

  function open(trigger) {
    if (!bg) build();
    lastFocus = trigger; openedAt = Date.now();
    if (sent()) renderDone(false); else renderForm();
    bg.hidden = false; document.body.classList.add('gzc-lock');
  }
  function close() {
    if (!bg || bg.hidden) return;
    bg.hidden = true; box.innerHTML = ''; document.body.classList.remove('gzc-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // 已應援：按鈕上加個勾
  function markButtons() {
    var done = sent();
    [].forEach.call(document.querySelectorAll('[data-cheer-label]'), function (el) {
      var short = el.hasAttribute('data-cheer-short');
      el.textContent = done ? (short ? t('✓ 已應援', '✓ Cheered') : t('✓ 已應援英文版', '✓ You cheered')) : (short ? t('應援', 'Cheer') : t('應援英文版', 'Cheer for English'));
    });
  }

  // 英文模式下攔截下載按鈕（capture 階段，比 download.js 的監聽先跑）
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-cheer],[data-dl]');
    if (!el) return;
    if (!el.hasAttribute('data-cheer') && L() !== 'en') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) { if (L() === 'en') e.preventDefault(); else return; }
    e.preventDefault(); e.stopImmediatePropagation();
    open(el);
  }, true);

  document.addEventListener('gz:lang', function () {
    markButtons();
    if (bg && !bg.hidden) { if (sent()) renderDone(false); else renderForm(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markButtons); else markButtons();
})();
