/* GAMEZH 流動頁籤
 * 桌機在上方標題列、手機在底部。線在目前頁籤旁彎成一道流動的光（金色主線＋紅／青色邊），附幾顆閃爍粒子。
 * 捲動到哪個區塊，就自動切到對應頁籤，光會直接切過去並閃一下。
 */
(function () {
  var nav = document.querySelector('.flow-nav');
  if (!nav) return;
  document.body.classList.add('has-flow-nav');

  var links = [].slice.call(nav.querySelectorAll('a[href^="#"]'));
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'fn-glow');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<defs><filter id="fnBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>' +
    '<path class="halo" stroke="rgba(255,226,160,.55)" stroke-width="6" filter="url(#fnBlur)"/>' +
    '<path class="red" stroke="rgba(255,96,80,.75)" stroke-width="1.2"/>' +
    '<path class="cyan" stroke="rgba(110,220,255,.7)" stroke-width="1.2"/>' +
    '<path class="core" stroke="#fff3cf" stroke-width="1.6"/>';
  nav.appendChild(svg);
  var P = { halo: svg.querySelector('.halo'), red: svg.querySelector('.red'), cyan: svg.querySelector('.cyan'), core: svg.querySelector('.core') };
  var sparks = [];
  for (var i = 0; i < 4; i++) { var s = document.createElement('span'); s.className = 'fn-spark'; nav.appendChild(s); sparks.push(s); }

  var mq = window.matchMedia('(min-width: 1100px)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var active = 0, pos = null, target = 0, t = 0, raf = 0, last = 0;

  function center(a) {
    var r = a.getBoundingClientRect(), n = nav.getBoundingClientRect();
    return r.left - n.left + r.width / 2;
  }

  // 沿著直線（或橫線）畫一段 S 形彎曲：envelope 控制只在 c 附近彎
  function shape(c, len, amp, shift, phase) {
    var pts = [], half = 78;
    for (var d = -half; d <= half; d += 3) {
      var env = Math.exp(-(d * d) / (2 * 30 * 30));
      var off = Math.sin(d / 17 + phase) * amp * env + shift * env;
      pts.push([c + d, 36 + off]);
    }
    return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
  }

  function draw() {
    var amp = 7 + Math.sin(t * 1.3) * 2.5, ph = t * 2.2;
    P.halo.setAttribute('d', shape(pos, 0, amp, 0, ph));
    P.red.setAttribute('d', shape(pos, 0, amp * 1.08, 1.6, ph - 0.25));
    P.cyan.setAttribute('d', shape(pos, 0, amp * 0.92, -1.6, ph + 0.25));
    P.core.setAttribute('d', shape(pos, 0, amp, 0, ph));
    // 粒子散在光的周圍
    var a = links[active].getBoundingClientRect(), n = nav.getBoundingClientRect();
    sparks.forEach(function (s, k) {
      var ang = k * 1.7 + t * 0.4, r = 18 + k * 7;
      // 光在線上：桌機線在標題列底部，手機線在底部頁籤列頂端
      var lineY = mq.matches ? n.height : 0;
      var x = pos + Math.cos(ang) * r * 1.3, y = lineY + Math.sin(ang) * 10 - (mq.matches ? 2 : 8);
      s.style.left = x + 'px'; s.style.top = y + 'px';
    });
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
    t += dt;
    draw();
  }

  function setActive(i, jump) {
    active = i;
    links.forEach(function (a, k) {
      a.classList.toggle('on', k === i);
      if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    target = center(links[i]);
    pos = target; // 直接切到新頁籤（不滑動），再用一下閃光帶出來
    if (!jump && !reduce) {
      svg.style.transformOrigin = pos + 'px 36px';
      svg.classList.remove('fn-flash'); void svg.getBoundingClientRect(); svg.classList.add('fn-flash');
      sparks.forEach(function (sp) { sp.style.animation = 'none'; void sp.offsetWidth; sp.style.animation = ''; });
    }
    draw();
  }

  // 捲動偵測：最接近畫面上方 40% 的區塊
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var lockUntil = 0; // 點頁籤後平滑捲動期間，不讓捲動偵測把頁籤切回去
  function spy() {
    if (Date.now() < lockUntil) return;
    var best = 0, line = window.innerHeight * 0.4;
    sections.forEach(function (sec, k) {
      if (sec && sec.getBoundingClientRect().top - line <= 0) best = k;
    });
    if (best !== active) setActive(best);
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; spy(); });
  }, { passive: true });
  window.addEventListener('resize', function () { setActive(active, true); });
  if (mq.addEventListener) mq.addEventListener('change', function () { setActive(active, true); });

  links.forEach(function (a, k) { a.addEventListener('click', function () { lockUntil = Date.now() + 1000; setActive(k); }); });

  setActive(0, true);
  spy();
  if (!reduce) {
    raf = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
    });
  } else { draw(); }
})();
