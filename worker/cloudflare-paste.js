// =====================================================================
// GAMEZH — Cloudflare Worker 單檔版（直接貼到 Cloudflare 網頁編輯器）
//
// 做的事：
//   1. www.992851qaz.workers.dev/任何頁面  → 顯示 GitHub Pages 上同一頁
//      （https://992851qaz-bot.github.io/-/…），GitHub 一更新這邊就跟著更新
//   2. /download/windows → 直接下載 GitHub Releases 最新版的 .exe
//      /download/mac     → 最新版的 .dmg（沒有的話回下載頁）
//      /download/latest.json → 最新版資訊（版本、檔名、大小）
//
// 用法：Cloudflare → Workers & Pages → www → Edit code
//       把 worker.js 內容全部換成這個檔案 → 右上 Deploy
// =====================================================================

const ORIGIN = 'https://992851qaz-bot.github.io/-';   // 網站本體（GitHub Pages）
const REPO = '992851qaz-bot/-';                         // 安裝檔放的 GitHub repo
const STORE_URL = 'https://apps.microsoft.com/detail/9N19LCKX2NSW';
const PAGE_CACHE_SECONDS = 300;      // 網頁在 Cloudflare 快取 5 分鐘
const RELEASE_CACHE_SECONDS = 600;   // 最新版資訊快取 10 分鐘

const PLATFORMS = {
  windows: (name) => /\.(exe|msi|msix|msixbundle)$/i.test(name),
  mac: (name) => /\.(dmg|pkg)$/i.test(name) || /mac.*\.zip$/i.test(name)
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/download' || url.pathname.startsWith('/download/')) {
      return handleDownload(url, env, ctx);
    }
    return proxyPage(request, url);
  }
};

// ---------------------------------------------------------------------
// 1. 網頁：轉給 GitHub Pages
// ---------------------------------------------------------------------
async function proxyPage(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const upstreamUrl = ORIGIN + url.pathname + url.search;
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: { 'User-Agent': request.headers.get('User-Agent') || 'gamezh-worker' },
    redirect: 'manual',
    cf: { cacheTtl: PAGE_CACHE_SECONDS, cacheEverything: true }
  });

  const headers = new Headers(upstream.headers);
  // GitHub 的轉址（例如補斜線）要改回自己的網址
  const loc = headers.get('Location');
  if (loc) {
    const fixed = loc.startsWith(ORIGIN) ? url.origin + loc.slice(ORIGIN.length)
      : loc.startsWith('/-/') ? url.origin + loc.slice(2)
      : loc;
    headers.set('Location', fixed);
  }
  headers.delete('x-github-request-id');
  headers.delete('via');
  headers.set('X-Served-By', 'gamezh-worker');
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

// ---------------------------------------------------------------------
// 2. 下載：轉到 GitHub Releases 最新版
// ---------------------------------------------------------------------
async function latestRelease(env, ctx) {
  const api = `https://api.github.com/repos/${REPO}/releases/latest`;
  const cache = caches.default;
  const key = new Request(api);
  let res = await cache.match(key);
  if (!res) {
    const headers = { 'User-Agent': 'gamezh-download-worker', Accept: 'application/vnd.github+json' };
    if (env && env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const upstream = await fetch(api, { headers });
    if (!upstream.ok) return null;
    res = new Response(upstream.body, upstream);
    res.headers.set('Cache-Control', `public, max-age=${RELEASE_CACHE_SECONDS}`);
    ctx.waitUntil(cache.put(key, res.clone()));
  }
  return res.json();
}

// 從 tag 或檔名抓版本號：「GameZH_.HUD_v4.0.14.exe」→「v4.0.14」
function versionOf(release) {
  const names = [release.tag_name, release.name].concat((release.assets || []).map((a) => a.name));
  for (const n of names) {
    const m = /v?(\d+(?:\.\d+){1,3})/i.exec(n || '');
    if (m) return 'v' + m[1];
  }
  return release.tag_name || null;
}

function pickAsset(release, platform) {
  const test = PLATFORMS[platform];
  if (!release || !test) return null;
  return (release.assets || []).find((a) => test(a.name)) || null;
}

async function handleDownload(url, env, ctx) {
  const what = url.pathname.replace(/\/+$/, '').split('/')[2] || 'windows';
  let release = null;
  try { release = await latestRelease(env, ctx); } catch (e) { release = null; }

  if (what === 'latest.json') {
    const info = { version: release ? versionOf(release) : null, published: release ? release.published_at : null, assets: {} };
    for (const p of Object.keys(PLATFORMS)) {
      const a = pickAsset(release, p);
      if (a) info.assets[p] = { name: a.name, size: a.size, url: `/download/${p}` };
    }
    return new Response(JSON.stringify(info), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${RELEASE_CACHE_SECONDS}` }
    });
  }

  const fallback = new URL('/exe.html#download', url).toString();
  if (!PLATFORMS[what]) return Response.redirect(fallback, 302);
  const asset = pickAsset(release, what);
  if (asset) return Response.redirect(asset.browser_download_url, 302);
  return Response.redirect(what === 'windows' ? STORE_URL : fallback, 302);
}
