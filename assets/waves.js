/* GAMEZH 金色波紋背景
 * 用法：<canvas class="gz-waves" aria-hidden="true"></canvas> + <script src="assets/waves.js" defer></script>
 * - 上層：數條細金線緩慢飄動
 * - 下層：粒子點陣波浪（透視排列）
 * 省電：分頁隱藏時暫停、手機降到約 30fps、使用者開啟「減少動態」時只畫一張靜態畫面。
 */
(function () {
  var canvas = document.querySelector('canvas.gz-waves');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var W = 0, H = 0, dpr = 1, raf = 0, last = 0, t = 0;
  var minFrame = coarse ? 1000 / 30 : 1000 / 60;

  // 金線：每條有自己的基準高度、振幅、波長、速度
  var LINES = [];
  for (var i = 0; i < 7; i++) {
    LINES.push({
      base: 0.34 + i * 0.05,
      amp: 0.035 + (i % 3) * 0.012,
      len: 0.9 + (i % 4) * 0.22,
      speed: 0.05 + (i % 5) * 0.015,
      phase: i * 0.9,
      tilt: -0.10 + i * 0.012,
      alpha: 0.10 + (i % 3) * 0.06,
      width: i % 4 === 0 ? 1.1 : 0.7
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function goldStroke(alpha) {
    var g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(227,205,154,0)');
    g.addColorStop(0.25, 'rgba(227,205,154,' + alpha + ')');
    g.addColorStop(0.6, 'rgba(236,214,166,' + (alpha * 1.15) + ')');
    g.addColorStop(1, 'rgba(227,205,154,0)');
    return g;
  }

  function drawLines() {
    var step = Math.max(8, W / 140);
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i];
      ctx.beginPath();
      for (var x = -step; x <= W + step; x += step) {
        var u = x / W;
        var y = H * (L.base + L.tilt * u)
          + Math.sin(u * Math.PI * 2 / L.len + t * L.speed + L.phase) * H * L.amp
          + Math.sin(u * Math.PI * 5.3 + t * L.speed * 1.7 + L.phase * 2) * H * L.amp * 0.25;
        if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      // 先畫一層寬而淡的光暈，再畫細線，看起來柔和不刺眼
      ctx.strokeStyle = goldStroke(L.alpha * 0.22);
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = goldStroke(L.alpha);
      ctx.lineWidth = L.width;
      ctx.stroke();
    }
  }

  function drawDots() {
    // 底部 38% 的透視點陣：越下方越大、越亮
    var rows = coarse ? 14 : 20;
    var top = H * 0.62;
    for (var r = 0; r < rows; r++) {
      var depth = r / (rows - 1);              // 0 遠 → 1 近
      var y0 = top + Math.pow(depth, 1.6) * (H - top);
      var gap = 7 + depth * 16;
      var size = 0.5 + depth * 1.4;
      var a = 0.03 + depth * 0.16;
      ctx.fillStyle = 'rgba(227,205,154,' + a.toFixed(3) + ')';
      for (var x = (r % 2) * gap / 2; x < W; x += gap) {
        var u = x / W;
        var y = y0
          + Math.sin(u * 7 + t * 0.32 + r * 0.35) * (4 + depth * 14)
          + Math.sin(u * 2.3 - t * 0.18) * (3 + depth * 8);
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < minFrame) return;
    t += Math.min(now - last, 100) / 1000;
    last = now;
    ctx.clearRect(0, 0, W, H);
    drawLines();
    drawDots();
  }

  function start() { if (!raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  resize();
  if (reduce) { t = 2; drawLines(); drawDots(); }
  else start();

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { resize(); if (reduce) { drawLines(); drawDots(); } }, 150);
  });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
})();
