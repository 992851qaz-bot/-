/* GAMEZH 中英切換
 * 用法：
 *   <h2 data-en="English HTML">中文</h2>          → 切到英文時換掉 innerHTML
 *   <img alt="中文" data-en-alt="English">         → 任何 data-en-XXX 會換掉屬性 XXX（alt、placeholder、aria-label、title、content…）
 *   <div data-only="zh">…</div> / data-only="en"  → 只在該語言顯示
 *   <button data-lang-toggle></button>             → 切換按鈕（文字自動填）
 * 語言決定順序：網址 ?lang=en|zh → 上次選擇（localStorage）→ 瀏覽器語言（非中文就用英文）
 * 頁面上的 JS 可以用 GZ_I18N.t('中文', 'English') 取字串，並監聽 document 的 'gz:lang' 事件重畫動態內容。
 */
(function () {
  var KEY = 'gamezh.lang';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  function pick() {
    var m = /[?&]lang=(en|zh)\b/i.exec(location.search);
    if (m) return m[1].toLowerCase();
    var saved = ls(KEY);
    if (saved === 'en' || saved === 'zh') return saved;
    var langs = navigator.languages || [navigator.language || 'zh'];
    return /^zh/i.test(langs[0] || '') ? 'zh' : 'en';
  }

  var root = document.documentElement;
  var lang = pick();
  var ZH_LANG = root.getAttribute('lang') || 'zh-Hant-TW';
  root.setAttribute('lang', lang === 'en' ? 'en' : ZH_LANG);
  root.setAttribute('data-lang', lang);

  // 只在某語言顯示的區塊；英文頁面先藏起來，避免中文閃一下
  var st = document.createElement('style');
  st.textContent =
    'html[data-lang="en"] [data-only="zh"],html[data-lang="zh"] [data-only="en"]{display:none!important}' +
    'html[data-lang="en"].gz-i18n-pending body{visibility:hidden}' +
    '.lang-toggle{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 12px;border:1px solid rgba(232,214,170,.32);background:transparent;color:inherit;font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em;cursor:pointer;white-space:nowrap;flex:none}' +
    '.lang-toggle:hover,.lang-toggle:focus-visible{border-color:#e3cd9a;outline:none}' +
    '.lang-toggle svg{width:16px;height:16px;flex:none}' +
    '.hd .wrap > .lang-toggle{margin-left:-12px}' +
    '@media(min-width:1100px){body.has-flow-nav .hd .wrap > .btn:has(+ .lang-toggle){margin-left:auto}}' +
    '@media(max-width:480px){.hd .wrap > .lang-toggle{padding:0 9px;margin-left:-16px}}';
  document.head.appendChild(st);
  if (lang === 'en') {
    root.classList.add('gz-i18n-pending');
    setTimeout(function () { root.classList.remove('gz-i18n-pending'); }, 1500); // 保險：出錯也不會一直空白
  }

  var GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';

  function swapAttrs(el, to) {
    var attrs = [].slice.call(el.attributes);
    attrs.forEach(function (a) {
      var m = /^data-en-(.+)$/.exec(a.name);
      if (!m || m[1] === 'only') return;
      var name = m[1], zhKey = 'data-zh-' + name;
      if (!el.hasAttribute(zhKey)) el.setAttribute(zhKey, el.getAttribute(name) || '');
      el.setAttribute(name, to === 'en' ? a.value : el.getAttribute(zhKey));
    });
  }

  function apply(to) {
    [].forEach.call(document.querySelectorAll('[data-en]'), function (el) {
      if (!el.hasAttribute('data-zh')) el.setAttribute('data-zh', el.innerHTML);
      el.innerHTML = to === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-zh');
    });
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i], has = false;
      for (var j = 0; j < el.attributes.length; j++) { if (el.attributes[j].name.indexOf('data-en-') === 0) { has = true; break; } }
      if (has) swapAttrs(el, to);
    }
    [].forEach.call(document.querySelectorAll('[data-lang-toggle]'), function (b) {
      b.innerHTML = GLOBE + '<span>' + (to === 'en' ? '中文' : 'EN') + '</span>';
      b.setAttribute('aria-label', to === 'en' ? '切換成中文' : 'Switch to English');
      b.setAttribute('lang', to === 'en' ? 'zh-Hant' : 'en');
    });
  }

  function set(to, save) {
    lang = to;
    root.setAttribute('lang', to === 'en' ? 'en' : ZH_LANG);
    root.setAttribute('data-lang', to);
    if (save) ls(KEY, to);
    apply(to);
    root.classList.remove('gz-i18n-pending');
    try { document.dispatchEvent(new CustomEvent('gz:lang', { detail: { lang: to } })); } catch (e) {}
  }

  window.GZ_I18N = {
    get lang() { return lang; },
    t: function (zh, en) { return lang === 'en' ? en : zh; },
    set: function (to) { set(to, true); }
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-lang-toggle]');
    if (!b) return;
    e.preventDefault();
    set(lang === 'en' ? 'zh' : 'en', true);
    // 網址上的 ?lang= 跟著更新，分享出去對方看到同一種語言
    try {
      var u = new URL(location.href);
      u.searchParams.set('lang', lang);
      history.replaceState(history.state, '', u.toString());
    } catch (err) {}
  });

  function init() { set(lang, false); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
